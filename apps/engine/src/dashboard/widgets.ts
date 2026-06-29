// Widget registry: each type knows how to draw itself to a Surface from its props + the
// current telemetry/context. Coordinates are relative to the widget box so widgets move
// freely in the editor. Shared by engine (RGB565) and Studio (canvas) — identical output.
import { COLORS, loadColor, type ColorName, type RGB } from './colors';
import type { Surface } from './surface';
import { drawText, drawTextCentered, drawTextRight, textWidth } from './text';
import { strokeRect, bar, arcGauge } from './draw';
import { getMetric, formatMetric, fmtTokens, type Format, type RenderEnv } from './bindings';
import type { Widget } from './schema';

const col = (v: unknown, fallback: RGB): RGB => (typeof v === 'string' && v in COLORS ? COLORS[v as ColorName] : fallback);
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const num = (v: unknown, d = 0): number => (typeof v === 'number' ? v : d);
const fmtOf = (v: unknown, d: Format): Format => (typeof v === 'string' ? (v as Format) : d);

function cardBg(s: Surface, x: number, y: number, w: number, h: number): void {
  s.fillRect(x, y, w, h, COLORS.surf);
  strokeRect(s, x, y, w, h, COLORS.stroke);
}

export type WidgetDraw = (s: Surface, wdg: Widget, env: RenderEnv) => void;

export const WIDGETS: Record<string, WidgetDraw> = {
  label(s, wdg, env) {
    const p = wdg.props;
    let text = str(p.text);
    if (p.binding) text = str(p.prefix) + formatMetric(getMetric(env.snapshot, str(p.binding)), fmtOf(p.fmt, 'int'));
    const scale = num(p.scale, 2);
    const color = col(p.color, COLORS.t1);
    const align = str(p.align, 'left');
    if (align === 'center') drawTextCentered(s, wdg.x + wdg.w / 2, wdg.y, text, scale, color);
    else if (align === 'right') drawTextRight(s, wdg.x + wdg.w, wdg.y, text, scale, color);
    else drawText(s, wdg.x, wdg.y, text, scale, color);
  },

  clock(s, wdg, env) {
    const p = wdg.props;
    const text = str(p.prefix) + (str(p.source, 'time') === 'uptime' ? env.ctx.uptimeStr : env.ctx.timeStr);
    const scale = num(p.scale, 2);
    const color = col(p.color, COLORS.t1);
    if (str(p.align, 'left') === 'right') drawTextRight(s, wdg.x + wdg.w, wdg.y, text, scale, color);
    else drawText(s, wdg.x, wdg.y, text, scale, color);
  },

  statusDot(s, wdg, env) {
    const st = env.ctx.panelState;
    const c = st === 'Ready' ? COLORS.green : st === 'Reconnecting' || st === 'Degraded' ? COLORS.amber : COLORS.t2;
    s.fillRect(wdg.x, wdg.y, wdg.w, wdg.h, c);
  },

  arcGauge(s, wdg, env) {
    const p = wdg.props;
    const m = getMetric(env.snapshot, str(p.binding, 'cpu.loadPercent'));
    const v = m && m.value !== null ? m.value : null;
    const cx = Math.round(wdg.x + wdg.w / 2);
    const cy = Math.round(wdg.y + wdg.h / 2) + 8;
    const rOut = Math.min(wdg.w, wdg.h) / 2 - 6;
    const rIn = rOut - 16;
    if (p.label) drawTextCentered(s, cx, wdg.y, str(p.label), 2, COLORS.cyan);
    arcGauge(s, cx, cy, rOut, rIn, v === null ? 0 : Math.max(0, Math.min(1, v / 100)), v === null ? COLORS.stroke : loadColor(v), COLORS.stroke);
    const big = v === null ? '--' : String(Math.round(v));
    drawTextCentered(s, cx, cy - 18, big, 5, COLORS.t1);
    if (v !== null) drawText(s, Math.round(cx + textWidth(big, 5) / 2 + 4), cy - 14, '%', 2, COLORS.t2);
    if (p.tempBinding) drawTextCentered(s, cx, cy + 44, formatMetric(getMetric(env.snapshot, str(p.tempBinding)), 'temp'), 2, COLORS.t2);
  },

  statCard(s, wdg, env) {
    const p = wdg.props;
    const { x, y } = wdg;
    cardBg(s, x, y, wdg.w, wdg.h);
    drawText(s, x + 12, y + 9, str(p.label), 2, COLORS.t2);

    let main = str(p.mainPrefix) + formatMetric(getMetric(env.snapshot, str(p.mainBinding)), fmtOf(p.mainFmt, 'int'));
    if (p.mainBinding2) {
      const a = formatMetric(getMetric(env.snapshot, str(p.mainBinding)), fmtOf(p.mainFmt, 'gib'));
      const b = formatMetric(getMetric(env.snapshot, str(p.mainBinding2)), fmtOf(p.mainFmt, 'gib'));
      main = `${str(p.mainPrefix)}${a} / ${b}${str(p.mainSuffix)}`;
    }
    drawText(s, x + 12, y + 28, main, 2, COLORS.t1);

    if (p.rightBinding) {
      const rm = getMetric(env.snapshot, str(p.rightBinding));
      const rtext = str(p.rightPrefix) + formatMetric(rm, fmtOf(p.rightFmt, 'pct'));
      const rcolor = p.rightColorMode === 'load' && rm && rm.value !== null ? loadColor(rm.value) : col(p.accent, COLORS.cyan);
      drawTextRight(s, x + wdg.w - 12, y + 9, rtext, 2, rcolor);
    }

    if (p.barBinding) {
      const bm = getMetric(env.snapshot, str(p.barBinding));
      const frac = bm && bm.value !== null ? bm.value / num(p.barMax, 100) : null;
      const bcolor = p.barColorMode === 'load' && bm && bm.value !== null ? loadColor(bm.value) : col(p.barColor, COLORS.cyan);
      bar(s, x + 12, y + wdg.h - 12, wdg.w - 24, 6, frac, COLORS.stroke, bcolor);
    }
  },

  progressBar(s, wdg, env) {
    const p = wdg.props;
    const m = getMetric(env.snapshot, str(p.binding));
    const frac = m && m.value !== null ? m.value / num(p.max, 100) : null;
    bar(s, wdg.x, wdg.y, wdg.w, wdg.h, frac, COLORS.stroke, col(p.color, COLORS.cyan));
  },

  aiUsage(s, wdg, env) {
    const { x, y } = wdg;
    cardBg(s, x, y, wdg.w, wdg.h);
    drawText(s, x + 12, y + 8, 'CLAUDE 5H', 2, COLORS.violet);
    const ai = env.ctx.ai;
    if (!ai) {
      drawText(s, x + 138, y + 8, '-- NOT CONFIGURED', 2, COLORS.t2);
      return;
    }
    if (ai.claudeLimit && ai.claudeLimit > 0) {
      const frac = ai.claudeUsed / ai.claudeLimit;
      const c = frac >= 0.9 ? COLORS.red : frac >= 0.7 ? COLORS.amber : COLORS.green;
      bar(s, x + 138, y + 8, 300, 10, frac, COLORS.stroke, c);
      drawText(s, x + 12, y + 28, `${fmtTokens(ai.claudeUsed)} / ${fmtTokens(ai.claudeLimit)}`, 2, COLORS.t1);
      drawText(s, x + 198, y + 28, `${Math.round(frac * 100)}%`, 2, c);
    } else {
      drawText(s, x + 138, y + 8, `${fmtTokens(ai.claudeUsed)} TOK`, 2, COLORS.t1);
      drawText(s, x + 12, y + 28, 'SET CLAUDE 5H TOKEN LIMIT', 1, COLORS.t2);
    }
    drawTextRight(s, x + wdg.w - 12, y + 28, `CODEX ${ai.codexState}`, 1, COLORS.t2);
  },
};
