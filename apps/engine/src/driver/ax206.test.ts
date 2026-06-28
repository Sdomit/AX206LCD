import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rgb565 } from './rgb565';
import { buildCbw, buildBlitCmd, GET_DIMS } from './protocol';

test('rgb565 packing is high-byte-first (verified on panel)', () => {
  assert.deepEqual(rgb565(255, 0, 0), [0xf8, 0x00]);
  assert.deepEqual(rgb565(255, 255, 255), [0xff, 0xff]);
  assert.deepEqual(rgb565(0, 255, 0), [0x07, 0xe0]);
  assert.deepEqual(rgb565(0, 0, 255), [0x00, 0x1f]);
});

test('CBW is a valid 31-byte Bulk-Only wrapper', () => {
  const b = buildCbw(GET_DIMS, 5, true);
  assert.equal(b.length, 31);
  assert.equal(b.toString('ascii', 0, 4), 'USBC');
  assert.deepEqual([...b.subarray(4, 8)], [0xde, 0xad, 0xbe, 0xef]);
  assert.equal(b.readUInt32LE(8), 5);
  assert.equal(b[12], 0x80); // IN
  assert.equal(b[13], 0x00); // LUN
  assert.equal(b[14], 0x10); // CB length 16
  assert.equal(b[15], 0xcd); // opcode
  assert.equal(b[20], 0x02); // get-dimensions subcommand
});

test('blit command packs the rectangle little-endian', () => {
  const c = buildBlitCmd(0, 0, 479, 319);
  assert.equal(c.length, 16);
  assert.deepEqual([...c.subarray(0, 7)], [0xcd, 0, 0, 0, 0, 0x06, 0x12]);
  assert.equal(c.readUInt16LE(7), 0);
  assert.equal(c.readUInt16LE(9), 0);
  assert.equal(c.readUInt16LE(11), 479);
  assert.equal(c.readUInt16LE(13), 319);
});
