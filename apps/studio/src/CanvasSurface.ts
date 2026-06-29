import type { RGB, Surface } from '@dash';

// Studio Surface: draws to a 2D canvas at an integer zoom. Same widget code as the engine,
// so the preview is pixel-for-pixel what the panel shows (just scaled up).
export class CanvasSurface implements Surface {
  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    readonly width: number,
    readonly height: number,
    private readonly scale: number,
  ) {}

  fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
    this.ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    this.ctx.fillRect(Math.round(x * this.scale), Math.round(y * this.scale), Math.round(w * this.scale), Math.round(h * this.scale));
  }
}
