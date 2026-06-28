// Device manager: owns the panel connection, drives connect/reconnect with backoff,
// and emits state changes. A blit failure degrades and triggers reconnect — a dropped
// device must never crash the caller.
import { EventEmitter } from 'node:events';
import { openPanel, type Panel, type Result } from '../driver/ax206';
import { nextState, type DeviceState, type DeviceEvent } from './state-machine';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export interface DeviceManagerOptions {
  retryDelayMs?: number;
  openFn?: () => Promise<Result<Panel>>; // injectable for tests / demo mode
}

export class DeviceManager extends EventEmitter {
  private state: DeviceState = 'NotDetected';
  private panel: Panel | null = null;
  private stopped = true;
  private connecting = false;
  private readonly retryDelayMs: number;
  private readonly opener: () => Promise<Result<Panel>>;

  constructor(opts: DeviceManagerOptions = {}) {
    super();
    this.retryDelayMs = opts.retryDelayMs ?? 1000;
    this.opener = opts.openFn ?? openPanel;
  }

  get currentState(): DeviceState {
    return this.state;
  }

  get panelInfo(): { width: number; height: number } | null {
    return this.panel ? { width: this.panel.width, height: this.panel.height } : null;
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.dispatch('start');
    void this.ensureConnected();
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.closePanel();
    this.dispatch('stop');
  }

  // Returns true only on a confirmed successful blit (CSW status 0).
  async blit(pixels: Buffer): Promise<boolean> {
    if (!this.panel) {
      void this.ensureConnected();
      return false;
    }
    const r = await this.panel.blit(pixels);
    if (r.ok && r.value === 0) return true;
    this.dispatch('ioError'); // Ready → Degraded
    this.closePanel();
    this.dispatch('lost'); // → Reconnecting
    void this.ensureConnected();
    return false;
  }

  private dispatch(event: DeviceEvent): void {
    const ns = nextState(this.state, event);
    if (ns && ns !== this.state) {
      this.state = ns;
      this.emit('state', ns);
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.connecting || this.stopped || this.panel) return;
    this.connecting = true;
    try {
      while (!this.stopped && !this.panel) {
        if (this.state === 'Reconnecting') this.dispatch('retry'); // → Connecting
        const res = await this.opener();
        if (res.ok) {
          this.panel = res.value;
          this.dispatch('opened'); // Connecting → Ready
          this.emit('ready', this.panelInfo);
          return;
        }
        this.emit('deviceError', res.error); // not 'error' — reserved event throws if unlistened
        this.dispatch('openFailed'); // Connecting → Reconnecting
        await sleep(this.retryDelayMs);
      }
    } finally {
      this.connecting = false;
    }
  }

  private closePanel(): void {
    if (this.panel) {
      try {
        this.panel.close();
      } catch {
        // ignore
      }
      this.panel = null;
    }
  }
}
