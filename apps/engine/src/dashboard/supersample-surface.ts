// Supersampling Surface: widgets draw at logical 480x320, but pixels are stored at
// (scale x) resolution in RGB888. Downsampling that back to 480x320 averages each block,
// which anti-aliases text, the arc gauge and bars. See quality.ts for the downsample.
import type { RGB } from './colors';
import type { Surface } from './surface';

export class SupersampleSurface implements Surface {
  readonly rgb: Uint8Array;
  readonly sw: number;
  readonly sh: number;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly scale: number = 2,
  ) {
    this.sw = width * scale;
    this.sh = height * scale;
    this.rgb = new Uint8Array(this.sw * this.sh * 3);
  }

  fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
    const s = this.scale;
    const x0 = Math.max(0, Math.round(x * s));
    const y0 = Math.max(0, Math.round(y * s));
    const x1 = Math.min(this.sw, Math.round((x + w) * s));
    const y1 = Math.min(this.sh, Math.round((y + h) * s));
    for (let yy = y0; yy < y1; yy++) {
      let i = (yy * this.sw + x0) * 3;
      for (let xx = x0; xx < x1; xx++) {
        this.rgb[i++] = c[0];
        this.rgb[i++] = c[1];
        this.rgb[i++] = c[2];
      }
    }
  }
}
