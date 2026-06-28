// RGB565, high-byte-first (RRRRRGGG GGGBBBBB) — verified against the AX206 panel in Phase 0.
export function rgb565(r: number, g: number, b: number): [number, number] {
  return [((r & 0xf8) | (g >> 5)) & 0xff, (((g & 0x1c) << 3) | (b >> 3)) & 0xff];
}

export function solid(w: number, h: number, r: number, g: number, b: number): Buffer {
  const [b0, b1] = rgb565(r, g, b);
  const buf = Buffer.allocUnsafe(w * h * 2);
  for (let i = 0; i < buf.length; i += 2) {
    buf[i] = b0;
    buf[i + 1] = b1;
  }
  return buf;
}
