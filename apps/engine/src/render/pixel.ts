// Low-level RGB565 framebuffer primitives. A color is a [byte0, byte1] pair (high-byte-first).
export type Px = [number, number];

export function fillRect(buf: Buffer, w: number, h: number, x: number, y: number, rw: number, rh: number, c: Px): void {
  const x1 = Math.min(w, x + rw);
  const y1 = Math.min(h, y + rh);
  for (let yy = Math.max(0, y); yy < y1; yy++) {
    const row = yy * w;
    for (let xx = Math.max(0, x); xx < x1; xx++) {
      const i = (row + xx) * 2;
      buf[i] = c[0];
      buf[i + 1] = c[1];
    }
  }
}

export function strokeRect(buf: Buffer, w: number, h: number, x: number, y: number, rw: number, rh: number, c: Px): void {
  fillRect(buf, w, h, x, y, rw, 1, c);
  fillRect(buf, w, h, x, y + rh - 1, rw, 1, c);
  fillRect(buf, w, h, x, y, 1, rh, c);
  fillRect(buf, w, h, x + rw - 1, y, 1, rh, c);
}
