// Higher-level drawing helpers, all built on Surface.fillRect (so engine + Studio match).
import type { RGB } from './colors';
import type { Surface } from './surface';

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
