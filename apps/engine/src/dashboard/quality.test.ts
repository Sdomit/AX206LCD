import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SupersampleSurface } from './supersample-surface';
import { downsampleToRgb565, changedRect, extractRect } from './quality';

test('downsample of a uniform fill yields that solid RGB565', () => {
  const ss = new SupersampleSurface(2, 2, 2);
  ss.fillRect(0, 0, 2, 2, [255, 255, 255]);
  const out = Buffer.alloc(2 * 2 * 2);
  downsampleToRgb565(ss, out);
  for (let i = 0; i < out.length; i += 2) {
    assert.equal(out[i], 0xff); // white -> 0xFFFF regardless of dither
    assert.equal(out[i + 1], 0xff);
  }
});

test('downsample averages a half-lit block (anti-aliasing)', () => {
  const ss = new SupersampleSurface(1, 1, 2); // one logical pixel = 2x2 subpixels
  ss.fillRect(0, 0, 1, 0.5, [255, 255, 255]); // top half white, bottom black
  const out = Buffer.alloc(2);
  downsampleToRgb565(ss, out);
  // average ~127 grey -> red channel high bits between black and white
  const r5 = (out[0] & 0xf8) >> 3;
  assert.ok(r5 > 4 && r5 < 28, `expected mid grey, got r5=${r5}`);
});

test('changedRect: full on first frame, bbox of a change, null when identical', () => {
  const w = 4;
  const h = 4;
  const a = Buffer.alloc(w * h * 2);
  assert.deepEqual(changedRect(null, a, w, h), { x0: 0, y0: 0, x1: 3, y1: 3 });
  const b = Buffer.from(a);
  assert.equal(changedRect(a, b, w, h), null);
  b[(2 * w + 1) * 2] = 0xff; // change pixel (1,2)
  assert.deepEqual(changedRect(a, b, w, h), { x0: 1, y0: 2, x1: 1, y1: 2 });
});

test('extractRect copies a tight sub-rectangle', () => {
  const w = 3;
  const h = 3;
  const buf = Buffer.alloc(w * h * 2);
  buf[(1 * w + 1) * 2] = 0xab;
  buf[(1 * w + 1) * 2 + 1] = 0xcd;
  const sub = extractRect(buf, w, { x0: 1, y0: 1, x1: 2, y1: 2 });
  assert.equal(sub.length, 2 * 2 * 2);
  assert.equal(sub[0], 0xab);
  assert.equal(sub[1], 0xcd);
});
