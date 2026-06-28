// Frame scheduler: fires a render at the target fps, never overlaps a render
// (counts a skip instead), and tracks rendered/skipped/failed. The timer is
// injectable so timing logic is unit-testable without real clocks.
type Timer = { clear: () => void };

export interface FrameSchedulerOptions {
  fps: number;
  render: () => Promise<boolean>;
  schedule?: (fn: () => void, ms: number) => Timer;
}

export class FrameScheduler {
  rendered = 0;
  skipped = 0;
  failed = 0;
  private timer: Timer | null = null;
  private inFlight = false;
  private readonly opts: FrameSchedulerOptions;

  constructor(opts: FrameSchedulerOptions) {
    this.opts = opts;
  }

  start(): void {
    if (this.timer) return;
    const interval = Math.max(1, Math.round(1000 / this.opts.fps));
    this.timer = this.scheduleTick(() => void this.tick(), interval);
  }

  stop(): void {
    this.timer?.clear();
    this.timer = null;
  }

  private scheduleTick(fn: () => void, ms: number): Timer {
    if (this.opts.schedule) return this.opts.schedule(fn, ms);
    const id = setInterval(fn, ms);
    return { clear: () => clearInterval(id) };
  }

  private async tick(): Promise<void> {
    if (this.inFlight) {
      this.skipped++;
      return;
    }
    this.inFlight = true;
    try {
      const ok = await this.opts.render();
      if (ok) this.rendered++;
      else this.failed++;
    } catch {
      this.failed++;
    } finally {
      this.inFlight = false;
    }
  }
}
