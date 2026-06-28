// OrbitPanel themed frame composer: dark space dashboard with a CPU-load arc gauge and
// GPU / RAM / NET cards, plus a status strip (panel state, disk temp, uptime).
// Pure (snapshot -> RGB565 buffer), unit-testable. Unavailable metrics render as "--",
// never a fake zero; stale data paints a red strip at the top.
import { rgb565 } from '../driver/rgb565';
import { fillRect, strokeRect, type Px } from './pixel';
import { drawText, drawTextCentered, textWidth } from './font';
import type { Metric, TelemetrySnapshot } from '../telemetry/snapshot';

const C = {
  bg: rgb565(10, 14, 26),
  surf: rgb565(17, 26, 46),
  stroke: rgb565(36, 49, 80),
  t1: rgb565(230, 237, 247),
  t2: rgb565(133, 149, 181),
  cyan: rgb565(34, 211, 238),
  green: rgb565(52, 211, 153),
  amber: rgb565(245, 158, 11),
  red: rgb565(248, 113, 113),
  violet: rgb565(167, 139, 250),
  star: rgb565(43, 58, 99),
};

const STARS: [number, number][] = [[300, 28], [205, 60], [448, 152], [60, 70], [392, 256], [150, 250]];

export interface OrbitContext {
  timeStr: string;
  uptimeStr: string;
  panelState: string;
}

export function loadColor(v: number): Px {
  if (v >= 90) return C.red;
  if (v >= 70) return C.amber;
  return C.green;
}

const temp = (m: Metric<number>): string => (m.value === null ? '-- °C' : `${Math.round(m.value)}°C`);
const pct = (m: Metric<number>): string => (m.value === null ? '--%' : `${Math.round(m.value)}%`);
const mb = (m: Metric<number>): string => (m.value === null ? '--' : (m.value / 1e6).toFixed(1));
const gb = (m: Metric<number>): string => (m.value === null ? '--' : (m.value / 1024).toFixed(1));

function card(buf: Buffer, w: number, h: number, x: number, y: number, cw: number, ch: number): void {
  fillRect(buf, w, h, x, y, cw, ch, C.surf);
  strokeRect(buf, w, h, x, y, cw, ch, C.stroke);
}

function metricCard(
  buf: Buffer,
  w: number,
  h: number,
  x: number,
  y: number,
  cw: number,
  ch: number,
  label: string,
  main: string,
  right: string,
  rightColor: Px,
  barFrac: number | null,
  barColor: Px,
): void {
  card(buf, w, h, x, y, cw, ch);
  drawText(buf, w, h, x + 12, y + 9, label, 2, C.t2);
  drawText(buf, w, h, x + cw - 12 - textWidth(right, 2), y + 9, right, 2, rightColor);
  drawText(buf, w, h, x + 12, y + 28, main, 2, C.t1);
  const by = y + ch - 12;
  fillRect(buf, w, h, x + 12, by, cw - 24, 6, C.stroke);
  if (barFrac !== null) fillRect(buf, w, h, x + 12, by, Math.round((cw - 24) * Math.max(0, Math.min(1, barFrac))), 6, barColor);
}

function arcGauge(buf: Buffer, w: number, h: number, cx: number, cy: number, rOut: number, rIn: number, frac: number, fill: Px, track: Px): void {
  const r2o = rOut * rOut;
  const r2i = rIn * rIn;
  for (let yy = Math.max(0, cy - rOut); yy <= cy + rOut && yy < h; yy++) {
    for (let xx = Math.max(0, cx - rOut); xx <= cx + rOut && xx < w; xx++) {
      const dx = xx - cx;
      const dy = yy - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2o || d2 < r2i) continue;
      let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (ang < 0) ang += 360;
      const delta = (ang - 135 + 360) % 360;
      if (delta > 270) continue;
      const c = delta / 270 <= frac ? fill : track;
      const i = (yy * w + xx) * 2;
      buf[i] = c[0];
      buf[i + 1] = c[1];
    }
  }
}

function pill(buf: Buffer, w: number, h: number, x: number, y: number, cw: number, dot: Px | null, text: string, right?: string): void {
  card(buf, w, h, x, y, cw, 34);
  let tx = x + 12;
  if (dot) {
    fillRect(buf, w, h, x + 12, y + 13, 8, 8, dot);
    tx = x + 28;
  }
  drawText(buf, w, h, tx, y + 11, text, 2, C.t1);
  if (right) drawText(buf, w, h, x + cw - 12 - textWidth(right, 2), y + 11, right, 2, C.t1);
}

export function buildOrbitFrame(w: number, h: number, snap: TelemetrySnapshot | null, stale: boolean, ctx: OrbitContext): Buffer {
  const buf = Buffer.allocUnsafe(w * h * 2);
  fillRect(buf, w, h, 0, 0, w, h, C.bg);
  for (const [sx, sy] of STARS) fillRect(buf, w, h, sx, sy, 1, 1, C.star);

  // Header
  fillRect(buf, w, h, 16, 15, 7, 7, C.cyan);
  drawText(buf, w, h, 30, 14, 'ORBITPANEL', 2, C.t1);
  drawText(buf, w, h, w - 2 - textWidth(ctx.timeStr, 2), 14, ctx.timeStr, 2, C.t1);
  fillRect(buf, w, h, 12, 36, w - 24, 1, C.stroke);

  // CPU arc gauge (left)
  const cx = 116;
  const cy = 156;
  const load = snap?.cpu.loadPercent.value ?? null;
  drawTextCentered(buf, w, h, cx, 50, 'CPU LOAD', 2, C.cyan);
  arcGauge(buf, w, h, cx, cy, 80, 64, load === null ? 0 : Math.max(0, Math.min(1, load / 100)), load === null ? C.stroke : loadColor(load), C.stroke);
  const loadStr = load === null ? '--' : String(Math.round(load));
  drawTextCentered(buf, w, h, cx, cy - 16, loadStr, 4, C.t1);
  if (load !== null) drawText(buf, w, h, Math.round(cx + textWidth(loadStr, 4) / 2 + 4), cy - 14, '%', 2, C.t2);
  if (snap) drawTextCentered(buf, w, h, cx, cy + 60, temp(snap.cpu.tempC), 2, C.t2);

  // Right column cards
  if (snap) {
    const gx = 232;
    const gw = 236;
    metricCard(buf, w, h, gx, 46, gw, 66, 'GPU', temp(snap.gpu.tempC), pct(snap.gpu.loadPercent), snap.gpu.loadPercent.value === null ? C.t2 : loadColor(snap.gpu.loadPercent.value), snap.gpu.loadPercent.value === null ? null : snap.gpu.loadPercent.value / 100, snap.gpu.loadPercent.value === null ? C.stroke : loadColor(snap.gpu.loadPercent.value));
    metricCard(buf, w, h, gx, 118, gw, 66, 'RAM', `${gb(snap.memory.usedMiB)} / ${gb(snap.memory.totalMiB)} GB`, pct(snap.memory.loadPercent), C.cyan, snap.memory.loadPercent.value === null ? null : snap.memory.loadPercent.value / 100, C.cyan);
    metricCard(buf, w, h, gx, 190, gw, 66, 'NET', `DN ${mb(snap.network.downBps)}`, `UP ${mb(snap.network.upBps)}`, C.violet, snap.network.downBps.value === null ? null : snap.network.downBps.value / 125e6, C.green);
  } else {
    card(buf, w, h, 232, 46, 236, 210);
    drawTextCentered(buf, w, h, 350, 145, 'NO DATA', 3, C.t2);
  }

  // Status strip
  const stateColor = ctx.panelState === 'Ready' ? C.green : ctx.panelState === 'Reconnecting' || ctx.panelState === 'Degraded' ? C.amber : C.t2;
  pill(buf, w, h, 12, 264, 150, stateColor, ctx.panelState.toUpperCase());
  pill(buf, w, h, 170, 264, 140, null, `DISK ${snap ? temp(snap.storage.tempC) : '-- °C'}`);
  pill(buf, w, h, 318, 264, 150, null, 'UP', ctx.uptimeStr);

  if (stale || !snap) fillRect(buf, w, h, 0, 0, w, 6, C.red);
  return buf;
}
