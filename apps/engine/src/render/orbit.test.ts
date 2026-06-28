import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOrbitFrame, loadColor } from './orbit';
import { drawText } from './font';
import { rgb565 } from '../driver/rgb565';

test('loadColor uses thresholds (green < 70 <= amber < 90 <= red)', () => {
  assert.deepEqual(loadColor(50), rgb565(52, 211, 153));
  assert.deepEqual(loadColor(75), rgb565(245, 158, 11));
  assert.deepEqual(loadColor(95), rgb565(248, 113, 113));
});

test('drawText writes glyph pixels at scale 1', () => {
  const w = 6;
  const h = 8;
  const buf = Buffer.alloc(w * h * 2);
  drawText(buf, w, h, 0, 0, '7', 1, [0xab, 0xcd]); // glyph "7" top row is "#####"
  assert.deepEqual([buf[0], buf[1]], [0xab, 0xcd]); // (0,0) is lit
  // row 1 of "7" is "....#": (0,1) is off, (4,1) is lit
  const off = (1 * w + 0) * 2;
  const on = (1 * w + 4) * 2;
  assert.deepEqual([buf[off], buf[off + 1]], [0, 0]);
  assert.deepEqual([buf[on], buf[on + 1]], [0xab, 0xcd]);
});

test('buildOrbitFrame returns w*h*2 bytes and tolerates a null snapshot', () => {
  const f = buildOrbitFrame(480, 320, null, true, { timeStr: '00:00:00', uptimeStr: '00:00:00', panelState: 'NotDetected' });
  assert.equal(f.length, 480 * 320 * 2);
});
