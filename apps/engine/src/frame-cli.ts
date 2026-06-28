// Hardware parity tool: drive one test frame to the panel from the TS engine.
// Usage: npm run frame -- [red|green|blue|white|black|orient] [--demo]
import { openPanel } from './driver/ax206';
import { rgb565, solid } from './driver/rgb565';

const COLORS: Record<string, [number, number, number]> = {
  red: [255, 0, 0],
  green: [0, 255, 0],
  blue: [0, 0, 255],
  white: [255, 255, 255],
  black: [0, 0, 0],
};

function buildOrient(w: number, h: number): Buffer {
  const m = 60;
  const black = rgb565(0, 0, 0);
  const tl = rgb565(255, 0, 0);
  const tr = rgb565(0, 255, 0);
  const bl = rgb565(0, 0, 255);
  const br = rgb565(255, 255, 255);
  const buf = Buffer.allocUnsafe(w * h * 2);
  let i = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c = black;
      if (x < m && y < m) c = tl;
      else if (x >= w - m && y < m) c = tr;
      else if (x < m && y >= h - m) c = bl;
      else if (x >= w - m && y >= h - m) c = br;
      buf[i++] = c[0];
      buf[i++] = c[1];
    }
  }
  return buf;
}

function buildFrame(mode: string, w: number, h: number): Buffer | null {
  if (mode in COLORS) {
    const [r, g, b] = COLORS[mode];
    return solid(w, h, r, g, b);
  }
  if (mode === 'orient') return buildOrient(w, h);
  return null;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const demo = args.includes('--demo');
  const mode = args.find((a) => !a.startsWith('--')) ?? 'red';

  if (demo) {
    const f = buildFrame(mode, 480, 320);
    if (!f) {
      console.error(`unknown mode '${mode}'`);
      process.exit(2);
    }
    console.log(`[demo] built '${mode}' frame: ${f.length} bytes (no USB performed)`);
    return;
  }

  const res = await openPanel();
  if (!res.ok) {
    console.error('open failed:', res.error);
    process.exit(1);
  }
  const panel = res.value;
  console.log(`panel ${panel.width}x${panel.height} (${panel.width * panel.height * 2} bytes/frame)`);

  const pixels = buildFrame(mode, panel.width, panel.height);
  if (!pixels) {
    console.error(`unknown mode '${mode}'; use ${Object.keys(COLORS).join('|')}|orient`);
    panel.close();
    process.exit(2);
  }

  const r = await panel.blit(pixels);
  panel.close();
  if (!r.ok) {
    console.error('blit failed:', r.error);
    process.exit(1);
  }
  console.log(`blit '${mode}': CSW=${r.value} (${r.value === 0 ? 'PASS' : 'FAIL'})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
