// Integrated service: ProbeHost telemetry -> engine -> panel. Renders live CPU-load
// and RAM bars on the real device, auto-reconnecting the panel and supervising ProbeHost.
// Usage: npm run dashboard [-- --demo] [-- --seconds=N]
import { DeviceManager } from './device/manager';
import { ProbeHost } from './telemetry/probehost';
import { FrameScheduler } from './scheduler';
import { buildOrbitFrame } from './render/orbit';
import { readClaudeUsage } from './ai/claude-usage';
import type { Panel, Result } from './driver/ax206';
import type { Metric, TelemetrySnapshot } from './telemetry/snapshot';

const FPS = 2;

const pad = (n: number): string => String(n).padStart(2, '0');
function clock(): string {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function dur(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}

function fakePanel(): Panel {
  return {
    width: 480,
    height: 320,
    async blit(): Promise<Result<number>> {
      return { ok: true, value: 0 };
    },
    close(): void {
      /* no-op */
    },
  };
}

function synthSnapshot(t: number): TelemetrySnapshot {
  const m = (value: number | null, unit: string): Metric<number> => ({ value, unit, quality: value === null ? 'unavailable' : 'ok', source: 'demo' });
  const cpu = Math.round(50 + 40 * Math.sin(t / 3));
  const gpu = Math.round(45 + 35 * Math.sin(t / 4 + 1));
  return {
    schemaVersion: 2,
    generatedAt: '',
    cpu: { tempC: m(null, 'C'), loadPercent: m(cpu, '%') },
    gpu: { tempC: m(58, 'C'), loadPercent: m(gpu, '%') },
    memory: { usedMiB: m(8000, 'MiB'), totalMiB: m(32000, 'MiB'), loadPercent: m(25, '%') },
    storage: { tempC: m(41, 'C'), usedPercent: m(63, '%') },
    network: { downBps: m(24_000_000, 'B/s'), upBps: m(3_000_000, 'B/s') },
  };
}

function main(): void {
  const demo = process.argv.includes('--demo');
  const secondsArg = process.argv.find((a) => a.startsWith('--seconds='));

  const mgr = new DeviceManager(
    demo ? { openFn: async (): Promise<Result<Panel>> => ({ ok: true, value: fakePanel() }) } : { retryDelayMs: 1000 },
  );
  mgr.on('state', (s: string) => console.log(`[panel] ${s}`));
  mgr.on('deviceError', (e: string) => console.log(`[panel] ${e}`));

  const ph = demo ? null : new ProbeHost();
  ph?.on('error', (e: string) => console.error(`[probehost] ${e} — build it: dotnet build apps/probehost -c Release`));
  ph?.on('exit', (code: number | null) => console.log(`[probehost exited ${code}]`));
  mgr.start();
  ph?.start();

  const started = Date.now();
  let claudeUsed = 0;
  let claudeLimit: number | null = null;
  const refreshClaude = (): void => {
    if (demo) {
      claudeUsed = 1_240_000;
      claudeLimit = 4_000_000;
      return;
    }
    const u = readClaudeUsage();
    claudeUsed = u.usedTokens;
    claudeLimit = u.limit;
  };
  refreshClaude();
  const aiTimer = setInterval(refreshClaude, 15000);
  let tick = 0;
  const getSnapshot = (): { snapshot: TelemetrySnapshot | null; stale: boolean } => {
    if (demo) return { snapshot: synthSnapshot(tick), stale: false };
    return ph!.latest();
  };

  const sched = new FrameScheduler({
    fps: FPS,
    render: async (): Promise<boolean> => {
      tick++;
      const info = mgr.panelInfo;
      if (!info) return false;
      const { snapshot, stale } = getSnapshot();
      return mgr.blit(
        buildOrbitFrame(info.width, info.height, snapshot, stale, {
          timeStr: clock(),
          uptimeStr: dur(Date.now() - started),
          panelState: mgr.currentState,
          ai: { claudeUsed, claudeLimit, codexState: '--' },
        }),
      );
    },
  });
  sched.start();

  const stats = setInterval(() => {
    const cpu = getSnapshot().snapshot?.cpu.loadPercent.value;
    console.log(`[frames] rendered=${sched.rendered} skipped=${sched.skipped} failed=${sched.failed} cpu=${cpu ?? '—'}%`);
  }, 3000);

  const shutdown = (): void => {
    clearInterval(stats);
    clearInterval(aiTimer);
    sched.stop();
    ph?.stop();
    mgr.stop();
    setTimeout(() => process.exit(0), 100);
  };
  process.on('SIGINT', shutdown);
  if (secondsArg) setTimeout(shutdown, Number(secondsArg.split('=')[1]) * 1000);

  console.log(`dashboard started (${demo ? 'demo' : 'hardware'}) at ${FPS} fps. Ctrl+C to stop.`);
}

main();
