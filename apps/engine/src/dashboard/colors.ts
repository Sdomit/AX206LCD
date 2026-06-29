// Shared color palette (RGB tuples). Surfaces convert to their own format (RGB565, canvas).
export type RGB = [number, number, number];

export const COLORS = {
  bg: [10, 14, 26],
  surf: [17, 26, 46],
  stroke: [36, 49, 80],
  t1: [230, 237, 247],
  t2: [133, 149, 181],
  cyan: [34, 211, 238],
  green: [52, 211, 153],
  amber: [245, 158, 11],
  red: [248, 113, 113],
  violet: [167, 139, 250],
  star: [43, 58, 99],
  // Depth palette — vertical gradients + fake (no-alpha) shadows give cards and the
  // backdrop a sense of layering. bgTop/Bot: screen backdrop. surfHi/Lo: card body
  // top→bottom. shadow: drop-shadow base. hi: top-edge highlight line.
  bgTop: [16, 22, 42],
  bgBot: [6, 9, 18],
  surfHi: [26, 38, 64],
  surfLo: [14, 22, 40],
  shadow: [3, 5, 12],
  hi: [54, 72, 110],
} as const satisfies Record<string, RGB>;

export type ColorName = keyof typeof COLORS;

export function loadColor(v: number): RGB {
  if (v >= 90) return COLORS.red;
  if (v >= 70) return COLORS.amber;
  return COLORS.green;
}
