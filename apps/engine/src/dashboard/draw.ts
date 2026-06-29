// Higher-level drawing helpers, all built on Surface.fillRect (so engine + Studio match).
import { COLORS, type RGB } from './colors';
import type { Surface } from './surface';

const WHITE: RGB = [255, 255, 255];

// Per-channel linear blend, t clamped to [0,1].
export function mix(a: RGB, b: RGB, t: number): RGB {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return [Math.round(a[0] + (b[0] - a[0]) * k), Math.round(a[1] + (b[1] - a[1]) * k), Math.round(a[2] + (b[2] - a[2]) * k)];
}

// Vertical gradient (top->bottom), one fillRect per logical row. Cheap next to the arc's
// per-pixel loop, and built on fillRect so engine (RGB565) and Studio (canvas) match.
export function vGradient(s: Surface, x: number, y: number, w: number, h: number, top: RGB, bot: RGB): void {
  for (let i = 0; i < h; i++) s.fillRect(x, y + i, w, 1, mix(top, bot, h <= 1 ? 0 : i / (h - 1)));
}

// Fake drop shadow (surfaces have no alpha): layered offset rects, darkest just outside the
// box and fading to the background outward, biased downward. Draw before the panel body.
export function softShadow(s: Surface, x: number, y: number, w: number, h: number, depth = 3): void {
  for (let i = depth; i >= 1; i--) {
    const c = mix(COLORS.shadow, COLORS.bgBot, (i - 1) / depth);
    s.fillRect(x - i, y - i + 2, w + i * 2, h + i * 2, c);
  }
}

// A card with depth: drop shadow, top->bottom surface gradient, a 1px top highlight, border.
export function panel(s: Surface, x: number, y: number, w: number, h: number): void {
  softShadow(s, x, y, w, h);
  vGradient(s, x, y, w, h, COLORS.surfHi, COLORS.surfLo);
  s.fillRect(x, y, w, 1, COLORS.hi); // top edge catches the light
  strokeRect(s, x, y, w, h, COLORS.stroke);
}

// Glossy progress bar: track + vertical-gradient fill (c1 top, c2 bottom) + a thin top sheen.
export function gradBar(s: Surface, x: number, y: number, w: number, h: number, frac: number | null, track: RGB, c1: RGB, c2: RGB): void {
  s.fillRect(x, y, w, h, track);
  if (frac === null) return;
  const fw = Math.round(w * Math.max(0, Math.min(1, frac)));
  if (fw <= 0) return;
  vGradient(s, x, y, fw, h, c1, c2);
  s.fillRect(x, y, fw, 1, mix(c1, WHITE, 0.25));
}

export function strokeRect(s: Surface, x: number, y: number, w: number, h: number, c: RGB): void {
  s.fillRect(x, y, w, 1, c);
  s.fillRect(x, y + h - 1, w, 1, c);
  s.fillRect(x, y, 1, h, c);
  s.fillRect(x + w - 1, y, 1, h, c);
}

export function bar(s: Surface, x: number, y: number, w: number, h: number, frac: number | null, track: RGB, fill: RGB): void {
  s.fillRect(x, y, w, h, track);
  if (frac !== null) s.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), h, fill);
}

// 270-degree arc gauge (gap at the bottom), filled up to `frac`.
export function arcGauge(s: Surface, cx: number, cy: number, rOut: number, rIn: number, frac: number, fill: RGB, track: RGB): void {
  const r2o = rOut * rOut;
  const r2i = rIn * rIn;
  for (let yy = cy - rOut; yy <= cy + rOut; yy++) {
    for (let xx = cx - rOut; xx <= cx + rOut; xx++) {
      const dx = xx - cx;
      const dy = yy - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2o || d2 < r2i) continue;
      let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (ang < 0) ang += 360;
      const delta = (ang - 135 + 360) % 360;
      if (delta > 270) continue;
      s.fillRect(xx, yy, 1, 1, delta / 270 <= frac ? fill : track);
    }
  }
}

// Same 270° arc, with depth: radial gloss across the ring (dim inner -> bright outer), a bright
// leading edge, and a soft glow just past the fill head. `bg` is what the dim side fades toward.
export function arcGaugeGlow(
  s: Surface,
  cx: number,
  cy: number,
  rOut: number,
  rIn: number,
  frac: number,
  fill: RGB,
  track: RGB,
  bg: RGB,
): void {
  const r2o = rOut * rOut;
  const r2i = rIn * rIn;
  const f = Math.max(0, Math.min(1, frac));
  const dimFill = mix(fill, bg, 0.45);
  for (let yy = cy - rOut; yy <= cy + rOut; yy++) {
    for (let xx = cx - rOut; xx <= cx + rOut; xx++) {
      const dx = xx - cx;
      const dy = yy - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2o || d2 < r2i) continue;
      let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (ang < 0) ang += 360;
      const delta = (ang - 135 + 360) % 360;
      if (delta > 270) continue;
      const pos = delta / 270;
      let c: RGB;
      if (pos <= f) {
        const radial = (Math.sqrt(d2) - rIn) / (rOut - rIn); // 0 inner .. 1 outer
        c = mix(dimFill, fill, radial);
        if (f - pos < 0.04) c = mix(c, WHITE, 0.45); // leading-edge highlight
      } else if (f > 0 && pos - f < 0.06) {
        c = mix(track, fill, 0.5); // soft glow past the head
      } else {
        c = track;
      }
      s.fillRect(xx, yy, 1, 1, c);
    }
  }
}
