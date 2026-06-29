// Output-quality pipeline for the panel: downsample the supersampled buffer with ordered
// (Bayer) dithering to RGB565 (anti-aliasing + reduced color banding), then dirty-region
// diffing so only the changed rectangle is sent over USB.
import type { SupersampleSurface } from './supersample-surface';

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// 4x4 Bayer matrix, normalized to [-0.5, 0.5).
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const clamp = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v);

// Average each scale x scale block to RGB888, dither, pack to RGB565 (high-byte-first).
export function downsampleToRgb565(ss: SupersampleSurface, out: Buffer): void {
  const s = ss.scale;
  const w = ss.width;
  const h = ss.height;
  const n = s * s;
  for (let y = 0; y < h; y++) {
    const bayerRow = BAYER[y & 3];
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let dy = 0; dy < s; dy++) {
        let i = ((y * s + dy) * ss.sw + x * s) * 3;
        for (let dx = 0; dx < s; dx++) {
          r += ss.rgb[i++];
          g += ss.rgb[i++];
          b += ss.rgb[i++];
        }
      }
      r /= n;
      g /= n;
      b /= n;
      const t = (bayerRow[x & 3] + 0.5) / 16 - 0.5; // [-0.5, 0.5)
      // dither amplitude ~ one RGB565 quantization step (R/B drop 3 bits = 8, G drops 2 = 4)
      const rd = clamp(r + t * 8);
      const gd = clamp(g + t * 4);
      const bd = clamp(b + t * 8);
      const o = (y * w + x) * 2;
      out[o] = ((rd & 0xf8) | (gd >> 5)) & 0xff;
      out[o + 1] = (((gd & 0x1c) << 3) | (bd >> 3)) & 0xff;
    }
  }
}

// Bounding box of pixels that differ between prev and next (null if identical, full if no prev).
export function changedRect(prev: Buffer | null, next: Buffer, w: number, h: number): Rect | null {
  if (!prev || prev.length !== next.length) return { x0: 0, y0: 0, x1: w - 1, y1: h - 1 };
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 2;
      if (prev[i] !== next[i] || prev[i + 1] !== next[i + 1]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x0: minX, y0: minY, x1: maxX, y1: maxY };
}

// Copy a sub-rectangle's pixels into a tightly-packed buffer for a partial blit.
export function extractRect(buf: Buffer, w: number, r: Rect): Buffer {
  const rw = r.x1 - r.x0 + 1;
  const rh = r.y1 - r.y0 + 1;
  const out = Buffer.allocUnsafe(rw * rh * 2);
  let o = 0;
  for (let y = r.y0; y <= r.y1; y++) {
    let i = (y * w + r.x0) * 2;
    for (let x = 0; x < rw; x++) {
      out[o++] = buf[i++];
      out[o++] = buf[i++];
    }
  }
  return out;
}
