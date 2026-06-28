// OrbitPanel themed frame composer: dark space dashboard with a CPU-load arc gauge,
// RAM card, and a status card. Pure (snapshot -> RGB565 buffer), unit-testable.
// Binds only metrics ProbeHost currently provides (CPU load/temp, RAM); unavailable
// values render as "--", never a fake zero. GPU/NET come when ProbeHost is expanded.
import { rgb565 } from '../driver/rgb565';
import { fillRect, strokeRect, type Px } from './pixel';
import { drawText, drawTextCentered, textWidth } from './font';
import type { TelemetrySnapshot } from '../telemetry/snapshot';

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
  star: rgb565(43, 58, 99),
};

const STARS: [number, number][] = [
  [300, 28], [210, 60], [445, 150], [165, 252], [60, 72], [395, 255], [285, 305], [95, 300],
];

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

function card(buf: Buffer, w: number, h: number, x: number, y: number, cw: number, ch: number): void {
  fillRect(buf, w, h, x, y, cw, ch, C.surf);
  strokeRect(buf, w, h, x, y, cw, ch, C.stroke);
}

function arcGauge(
  buf: Buffer,
  w: number,
  h: number,
  cx: number,
  cy: number,
  rOut: number,
  rIn: number,
  startDeg: number,
  sweepDeg: number,
  frac: number,
  fill: Px,
  track: Px,
): void {
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
      const delta = (ang - startDeg + 360) % 360;
      if (delta > sweepDeg) continue;
      const c = delta / sweepDeg <= frac ? fill : track;
      const i = (yy * w + xx) * 2;
      buf[i] = c[0];
      buf[i + 1] = c[1];
    }
  }
}

export function buildOrbitFrame(
  w: number,
  h: number,
  snap: TelemetrySnapshot | null,
  stale: boolean,
  ctx: OrbitContext,
): Buffer {
  const buf = Buffer.allocUnsafe(w * h * 2);
  fillRect(buf, w, h, 0, 0, w, h, C.bg);
  for (const [sx, sy] of STARS) fillRect(buf, w, h, sx, sy, 1, 1, C.star);

  // Header
  fillRect(buf, w, h, 16, 16, 7, 7, C.cyan);
  drawText(buf, w, h, 30, 15, 'ORBITPANEL', 2, C.t1);
  drawText(buf, w, h, w - 2 - textWidth(ctx.timeStr, 2), 14, ctx.timeStr, 2, C.t1);
  fillRect(buf, w, h, 12, 38, w - 24, 1, C.stroke);

  // CPU arc gauge
  const cx = 120;
  const cy = 180;
  const load = snap?.cpu.loadPercent.value ?? null;
  drawTextCentered(buf, w, h, cx, 70, 'CPU LOAD', 2, C.cyan);
  arcGauge(buf, w, h, cx, cy, 82, 66, 135, 270, load === null ? 0 : Math.max(0, Math.min(1, load / 100)), load === null ? C.stroke : loadColor(load), C.stroke);
  const loadStr = load === null ? '--' : String(Math.round(load));
  drawTextCentered(buf, w, h, cx, cy - 16, loadStr, 4, C.t1);
  if (load !== null) drawText(buf, w, h, Math.round(cx + textWidth(loadStr, 4) / 2 + 4), cy - 14, '%', 2, C.t2);
  const temp = snap?.cpu.tempC.value ?? null;
  drawTextCentered(buf, w, h, cx, cy + 26, temp === null ? '-- °C' : `${Math.round(temp)}°C`, 2, C.t2);

  // RAM card
  card(buf, w, h, 232, 52, 236, 80);
  drawText(buf, w, h, 246, 62, 'RAM', 2, C.t2);
  const used = snap?.memory.usedMiB.value ?? null;
  const total = snap?.memory.totalMiB.value ?? null;
  const pct = snap?.memory.loadPercent.value ?? null;
  const ramText = used !== null && total !== null ? `${(used / 1024).toFixed(1)} / ${Math.round(total / 1024)} GB` : '-- GB';
  drawText(buf, w, h, 246, 84, ramText, 2, C.t1);
  const pctStr = pct === null ? '--%' : `${Math.round(pct)}%`;
  drawText(buf, w, h, 454 - textWidth(pctStr, 2), 62, pctStr, 2, C.cyan);
  fillRect(buf, w, h, 246, 114, 208, 8, C.stroke);
  if (pct !== null) fillRect(buf, w, h, 246, 114, Math.round((208 * Math.max(0, Math.min(100, pct))) / 100), 8, C.cyan);

  // Status card
  card(buf, w, h, 232, 140, 236, 76);
  drawText(buf, w, h, 246, 150, 'UPTIME', 2, C.t2);
  drawText(buf, w, h, 454 - textWidth(ctx.uptimeStr, 2), 150, ctx.uptimeStr, 2, C.t1);
  const stateColor =
    ctx.panelState === 'Ready' ? C.green : ctx.panelState === 'Reconnecting' || ctx.panelState === 'Degraded' ? C.amber : C.t2;
  fillRect(buf, w, h, 246, 184, 8, 8, stateColor);
  drawText(buf, w, h, 262, 182, ctx.panelState.toUpperCase(), 2, C.t1);

  if (stale || !snap) fillRect(buf, w, h, 0, 0, w, 6, C.red);
  return buf;
}
