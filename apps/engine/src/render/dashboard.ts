// Pure frame composer: turns a telemetry snapshot into an RGB565 framebuffer.
// No USB, no device — unit-testable. CPU-load bar uses threshold colors; a null
// metric shows an explicit "unavailable" marker (never a zero-length "0%" bar);
// stale/no data paints a red strip along the top.
import { rgb565 } from '../driver/rgb565';
import type { TelemetrySnapshot } from '../telemetry/snapshot';

type RGB = [number, number, number];
const BG: RGB = [8, 12, 24];
const TRACK: RGB = [30, 38, 54];
const GRID: RGB = [60, 70, 90];
const UNAVAIL: RGB = [90, 90, 90];
const RAM_COLOR: RGB = [0, 200, 255];

function put(buf: Buffer, w: number, x: number, y: number, c: [number, number]): void {
  const i = (y * w + x) * 2;
  buf[i] = c[0];
  buf[i + 1] = c[1];
}

function rect(buf: Buffer, w: number, h: number, x: number, y: number, rw: number, rh: number, c: RGB): void {
  const px = rgb565(c[0], c[1], c[2]);
  for (let yy = Math.max(0, y); yy < y + rh && yy < h; yy++) {
    for (let xx = Math.max(0, x); xx < x + rw && xx < w; xx++) {
      put(buf, w, xx, yy, px);
    }
  }
}

function loadColor(v: number): RGB {
  if (v >= 90) return [255, 60, 60];
  if (v >= 70) return [255, 180, 0];
  return [0, 220, 120];
}

function drawBar(
  buf: Buffer,
  w: number,
  h: number,
  x: number,
  y: number,
  tw: number,
  th: number,
  value: number | null,
  color: (v: number) => RGB,
): void {
  rect(buf, w, h, x, y, tw, th, TRACK);
  for (const p of [0.25, 0.5, 0.75]) rect(buf, w, h, x + Math.round(tw * p), y, 1, th, GRID);
  if (value === null) {
    rect(buf, w, h, x, y, 12, th, UNAVAIL); // explicit unavailable marker
    return;
  }
  const v = Math.max(0, Math.min(100, value));
  rect(buf, w, h, x, y, Math.round((tw * v) / 100), th, color(v));
}

export function buildTelemetryFrame(w: number, h: number, snap: TelemetrySnapshot | null, stale: boolean): Buffer {
  const buf = Buffer.allocUnsafe(w * h * 2);
  rect(buf, w, h, 0, 0, w, h, BG);

  const m = 30;
  const trackW = w - 2 * m;
  const barH = 60;
  drawBar(buf, w, h, m, 70, trackW, barH, snap?.cpu.loadPercent.value ?? null, loadColor); // CPU load
  drawBar(buf, w, h, m, 190, trackW, barH, snap?.memory.loadPercent.value ?? null, () => RAM_COLOR); // RAM

  if (!snap || stale) rect(buf, w, h, 0, 0, w, 8, [255, 60, 60]); // no fresh data
  return buf;
}
