// Engine-side Surface: writes RGB565 (high-byte-first) into a Buffer for the panel.
// (Studio implements its own canvas-backed Surface; the widget code is shared.)
import type { RGB } from './colors';
import type { Surface } from './surface';

export class RgbSurface implements Surface {
  readonly buf: Buffer;
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.buf = Buffer.allocUnsafe(width * height * 2);
  }

  fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
    const b0 = ((c[0] & 0xf8) | (c[1] >> 5)) & 0xff;
    const b1 = (((c[1] & 0x1c) << 3) | (c[2] >> 3)) & 0xff;
    const x1 = Math.min(this.width, x + w);
    const y1 = Math.min(this.height, y + h);
    for (let yy = Math.max(0, y); yy < y1; yy++) {
      const row = yy * this.width;
      for (let xx = Math.max(0, x); xx < x1; xx++) {
        const i = (row + xx) * 2;
        this.buf[i] = b0;
        this.buf[i + 1] = b1;
      }
    }
  }
}
