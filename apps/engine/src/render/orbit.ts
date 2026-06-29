// OrbitPanel themed frame composer: dark space dashboard with a CPU-load arc gauge,
// GPU / RAM / NET cards, and a Claude 5h-usage card (Codex honest-unavailable).
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

const STARS: [number, number][] = [[300, 28], [205, 58], [448, 150], [60, 70], [392, 250], [150, 244]];

export interface OrbitContext {
  timeStr: string;
  uptimeStr: string;
  panelState: string;
  ai?: { claudeUsed: number; claudeLimit: number | null; codexState: string };
}

export function loadColor(v: number): Px {
  if (v >= 90) return C.red;
  if (v >= 70) return C.amber;
  return C.green;
}

function stateColor(state: string): Px {
  if (state === 'Ready') return C.green;
  if (state === 'Reconnecting' || state === 'Degraded') return C.amber;
  return C.t2;
}

export function fmtTokens(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(Math.round(n));
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

function aiCard(buf: Buffer, w: number, h: number, ai: OrbitContext['ai']): void {
  card(buf, w, h, 12, 262, 456, 46);
  drawText(buf, w, h, 24, 270, 'CLAUDE 5H', 2, C.violet);
  if (!ai) {
    drawText(buf, w, h, 150, 270, '-- NOT CONFIGURED', 2, C.t2);
    return;
  }
  if (ai.claudeLimit && ai.claudeLimit > 0) {
    const frac = ai.claudeUsed / ai.claudeLimit;
    const c = frac >= 0.9 ? C.red : frac >= 0.7 ? C.amber : C.green;
    fillRect(buf, w, h, 150, 270, 300, 10, C.stroke);
    fillRect(buf, w, h, 150, 270, Math.round(300 * Math.max(0, Math.min(1, frac))), 10, c);
    drawText(buf, w, h, 24, 290, `${fmtTokens(ai.claudeUsed)} / ${fmtTokens(ai.claudeLimit)}`, 2, C.t1);
    drawText(buf, w, h, 210, 290, `${Math.round(frac * 100)}%`, 2, c);
  } else {
    drawText(buf, w, h, 150, 270, `${fmtTokens(ai.claudeUsed)} TOK`, 2, C.t1);
    drawText(buf, w, h, 24, 290, 'SET CLAUDE 5H TOKEN LIMIT', 1, C.t2);
  }
  const codex = `CODEX ${ai.codexState}`;
  drawText(buf, w, h, 456 - textWidth(codex, 1), 290, codex, 1, C.t2);
}

export function buildOrbitFrame(w: number, h: number, snap: TelemetrySnapshot | null, stale: boolean, ctx: OrbitContext): Buffer {
  const buf = Buffer.allocUnsafe(w * h * 2);
  fillRect(buf, w, h, 0, 0, w, h, C.bg);
  for (const [sx, sy] of STARS) fillRect(buf, w, h, sx, sy, 1, 1, C.star);

  // Header: state dot + wordmark, clock + uptime
  fillRect(buf, w, h, 16, 15, 7, 7, stateColor(ctx.panelState));
  drawText(buf, w, h, 30, 14, 'ORBITPANEL', 2, C.t1);
  drawText(buf, w, h, w - 2 - textWidth(ctx.timeStr, 2), 8, ctx.timeStr, 2, C.t1);
  const up = `UP ${ctx.uptimeStr}`;
  drawText(buf, w, h, w - 2 - textWidth(up, 1), 26, up, 1, C.t2);
  fillRect(buf, w, h, 12, 36, w - 24, 1, C.stroke);

  // CPU arc gauge (left)
  const cx = 116;
  const cy = 152;
  const load = snap?.cpu.loadPercent.value ?? null;
  drawTextCentered(buf, w, h, cx, 48, 'CPU LOAD', 2, C.cyan);
  arcGauge(buf, w, h, cx, cy, 78, 62, load === null ? 0 : Math.max(0, Math.min(1, load / 100)), load === null ? C.stroke : loadColor(load), C.stroke);
  const loadStr = load === null ? '--' : String(Math.round(load));
  drawTextCentered(buf, w, h, cx, cy - 16, loadStr, 4, C.t1);
  if (load !== null) drawText(buf, w, h, Math.round(cx + textWidth(loadStr, 4) / 2 + 4), cy - 14, '%', 2, C.t2);
  if (snap) drawTextCentered(buf, w, h, cx, cy + 58, temp(snap.cpu.tempC), 2, C.t2);

  // Right column cards
  if (snap) {
    const gx = 232;
    const gw = 236;
    const gpuV = snap.gpu.loadPercent.value;
    metricCard(buf, w, h, gx, 46, gw, 64, 'GPU', temp(snap.gpu.tempC), pct(snap.gpu.loadPercent), gpuV === null ? C.t2 : loadColor(gpuV), gpuV === null ? null : gpuV / 100, gpuV === null ? C.stroke : loadColor(gpuV));
    metricCard(buf, w, h, gx, 116, gw, 64, 'RAM', `${gb(snap.memory.usedMiB)} / ${gb(snap.memory.totalMiB)} GB`, pct(snap.memory.loadPercent), C.cyan, snap.memory.loadPercent.value === null ? null : snap.memory.loadPercent.value / 100, C.cyan);
    metricCard(buf, w, h, gx, 186, gw, 64, 'NET', `DN ${mb(snap.network.downBps)}`, `UP ${mb(snap.network.upBps)}`, C.violet, snap.network.downBps.value === null ? null : snap.network.downBps.value / 125e6, C.green);
  } else {
    card(buf, w, h, 232, 46, 236, 204);
    drawTextCentered(buf, w, h, 350, 140, 'NO DATA', 3, C.t2);
  }

  aiCard(buf, w, h, ctx.ai);

  if (stale || !snap) fillRect(buf, w, h, 0, 0, w, 6, C.red);
  return buf;
}
