// Integrated service: ProbeHost telemetry -> engine -> panel. Renders live CPU-load
// and RAM bars on the real device, auto-reconnecting the panel and supervising ProbeHost.
// Usage: npm run dashboard [-- --demo] [-- --seconds=N]
import { DeviceManager } from './device/manager';
import { ProbeHost } from './telemetry/probehost';
import { FrameScheduler } from './scheduler';
import { buildTelemetryFrame } from './render/dashboard';
import type { Panel, Result } from './driver/ax206';
import type { TelemetrySnapshot } from './telemetry/snapshot';

const FPS = 2;

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
  const load = Math.round(50 + 40 * Math.sin(t / 3));
  return {
    schemaVersion: 1,
    generatedAt: '',
    cpu: {
      tempC: { value: null, quality: 'unavailable', source: 'demo' },
      loadPercent: { value: load, unit: '%', quality: 'ok', source: 'demo' },
    },
    memory: {
      usedMiB: { value: 8000, unit: 'MiB', quality: 'ok', source: 'demo' },
      totalMiB: { value: 32000, unit: 'MiB', quality: 'ok', source: 'demo' },
      loadPercent: { value: 25, unit: '%', quality: 'ok', source: 'demo' },
    },
  };
}

function main(): void {
  const demo = process.argv.includes('--demo');
  const secondsArg = process.argv.find((a) => a.startsWith('--seconds='));

  const mgr = new DeviceManager(
    demo ? { openFn: async (): Promise<Result<Panel>> => ({ ok: true, value: fakePanel() }) } : { retryDelayMs: 1000 },
  );
  mgr.on('state', (s: string) => console.log(`[panel] ${s}`));

  const ph = demo ? null : new ProbeHost();
  ph?.on('error', (e: string) => console.error(`[probehost] ${e} — build it: dotnet build apps/probehost -c Release`));
  ph?.on('exit', (code: number | null) => console.log(`[probehost exited ${code}]`));
  mgr.start();
  ph?.start();

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
      return mgr.blit(buildTelemetryFrame(info.width, info.height, snapshot, stale));
    },
  });
  sched.start();

  const stats = setInterval(() => {
    const cpu = getSnapshot().snapshot?.cpu.loadPercent.value;
    console.log(`[frames] rendered=${sched.rendered} skipped=${sched.skipped} failed=${sched.failed} cpu=${cpu ?? '—'}%`);
  }, 3000);

  const shutdown = (): void => {
    clearInterval(stats);
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
