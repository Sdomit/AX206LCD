// Abstract drawing surface. The ONLY primitive is fillRect — text, gauges and bars are
// built on top of it (in text.ts / draw.ts) so the exact same widget code renders to both
// the engine's RGB565 framebuffer and Studio's HTML canvas (guaranteed pixel parity).
import type { RGB } from './colors';

export interface Surface {
  readonly width: number;
  readonly height: number;
  fillRect(x: number, y: number, w: number, h: number, color: RGB): void;
}
