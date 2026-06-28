// Supervises the .NET ProbeHost child: spawns it, parses its JSON-Lines stdout into
// snapshots, restarts it on crash (backoff), and reports staleness. A ProbeHost crash
// must never crash the engine — telemetry just goes stale/unavailable.
import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { parseSnapshot, type TelemetrySnapshot } from './snapshot';

export interface ProbeHostOptions {
  command?: string;
  args?: string[];
  staleMs?: number;
  restartDelayMs?: number;
}

export function defaultProbeHostArgs(): { command: string; args: string[] } {
  const dll =
    process.env.PROBEHOST_DLL ??
    resolve(__dirname, '..', '..', '..', 'probehost', 'bin', 'Release', 'net9.0', 'ProbeHost.dll');
  return { command: 'dotnet', args: [dll] };
}

export class ProbeHost extends EventEmitter {
  private child: ChildProcess | null = null;
  private stopped = true;
  private last: TelemetrySnapshot | null = null;
  private lastAt = 0;
  private readonly opts: ProbeHostOptions;

  constructor(opts: ProbeHostOptions = {}) {
    super();
    this.opts = opts;
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.spawnChild();
  }

  stop(): void {
    this.stopped = true;
    if (this.child) {
      try {
        this.child.stdin?.end();
        this.child.kill();
      } catch {
        // ignore
      }
      this.child = null;
    }
  }

  // Parse one line; update state and emit. Exposed for unit tests (no process needed).
  ingest(line: string, now: number = Date.now()): void {
    const snap = parseSnapshot(line);
    if (!snap) {
      if (line.trim().length > 0) this.emit('badline', line);
      return;
    }
    this.last = snap;
    this.lastAt = now;
    this.emit('snapshot', snap);
  }

  latest(now: number = Date.now()): { snapshot: TelemetrySnapshot | null; stale: boolean } {
    const staleMs = this.opts.staleMs ?? 5000;
    const stale = this.last === null || now - this.lastAt > staleMs;
    return { snapshot: this.last, stale };
  }

  private spawnChild(): void {
    const { command, args } = {
      command: this.opts.command ?? defaultProbeHostArgs().command,
      args: this.opts.args ?? defaultProbeHostArgs().args,
    };
    let child: ChildProcess;
    try {
      child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      this.emit('error', e instanceof Error ? e.message : String(e));
      return;
    }
    this.child = child;

    if (child.stdout) {
      const rl = createInterface({ input: child.stdout });
      rl.on('line', (line) => this.ingest(line));
    }
    child.stderr?.on('data', (d: Buffer) => this.emit('stderr', d.toString()));
    child.on('error', (e) => this.emit('error', e.message));
    child.on('exit', (code) => {
      this.child = null;
      this.emit('exit', code);
      if (!this.stopped) {
        setTimeout(() => {
          if (!this.stopped) this.spawnChild();
        }, this.opts.restartDelayMs ?? 1000);
      }
    });
  }
}
