// Headless engine service: connects the panel, renders a moving bar at the target
// fps, and auto-reconnects on unplug. Proves the device lifecycle end to end.
// Usage: npm run service [-- --demo] [-- --seconds=N]
import { DeviceManager } from './device/manager';
import { FrameScheduler } from './scheduler';
import { rgb565 } from './driver/rgb565';
import type { Panel, Result } from './driver/ax206';

const FPS = 2;
const BAR_STEP = 16;
const BAR_WIDTH = 24;

function buildBar(w: number, h: number, phase: number): Buffer {
  const bg = rgb565(8, 12, 24);
  const bar = rgb565(0, 200, 255);
  const bx = phase % w;
  const buf = Buffer.allocUnsafe(w * h * 2);
  let i = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = x >= bx && x < bx + BAR_WIDTH ? bar : bg;
      buf[i++] = c[0];
      buf[i++] = c[1];
    }
  }
  return buf;
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

function main(): void {
  const demo = process.argv.includes('--demo');
  const secondsArg = process.argv.find((a) => a.startsWith('--seconds='));

  const mgr = new DeviceManager(
    demo
      ? { openFn: async (): Promise<Result<Panel>> => ({ ok: true, value: fakePanel() }) }
      : { retryDelayMs: 1000 },
  );
  mgr.on('state', (s: string) => console.log(`[state] ${s}`));
  mgr.on('ready', (info: { width: number; height: number }) => console.log(`[ready] ${info.width}x${info.height}`));
  mgr.on('error', (e: string) => console.log(`[device] ${e}`));
  mgr.start();

  let phase = 0;
  const sched = new FrameScheduler({
    fps: FPS,
    render: async (): Promise<boolean> => {
      const info = mgr.panelInfo;
      if (!info) return false;
      const ok = await mgr.blit(buildBar(info.width, info.height, phase));
      phase += BAR_STEP;
      return ok;
    },
  });
  sched.start();

  const stats = setInterval(
    () =>
      console.log(
        `[frames] rendered=${sched.rendered} skipped=${sched.skipped} failed=${sched.failed} state=${mgr.currentState}`,
      ),
    3000,
  );

  const shutdown = (): void => {
    clearInterval(stats);
    sched.stop();
    mgr.stop();
    setTimeout(() => process.exit(0), 100);
  };
  process.on('SIGINT', shutdown);
  if (secondsArg) setTimeout(shutdown, Number(secondsArg.split('=')[1]) * 1000);

  console.log(`service started (${demo ? 'demo' : 'hardware'}) at ${FPS} fps. Ctrl+C to stop.`);
}

main();
