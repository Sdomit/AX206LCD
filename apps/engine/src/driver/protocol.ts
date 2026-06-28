// Pure AX206 protocol encoders — no USB/native dependency, fully unit-testable.
// USB Mass Storage Bulk-Only Transport; vendor opcode 0xCD. See docs/device-compatibility.md.
export const AX206 = { vid: 0x1908, pid: 0x0102, epOut: 0x01, epIn: 0x81 } as const;
const TAG = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
export const GET_DIMS = Buffer.from([0xcd, 0, 0, 0, 0, 0x02]);

export function buildCbw(cmd: Buffer, dataLen: number, dirIn: boolean): Buffer {
  const b = Buffer.alloc(31);
  b.write('USBC', 0, 'ascii');
  TAG.copy(b, 4);
  b.writeUInt32LE(dataLen >>> 0, 8);
  b[12] = dirIn ? 0x80 : 0x00; // bmCBWFlags
  b[13] = 0x00; // LUN
  b[14] = 0x10; // CB length = 16
  cmd.copy(b, 15, 0, Math.min(cmd.length, 16));
  return b;
}

export function buildBlitCmd(x0: number, y0: number, x1: number, y1: number): Buffer {
  const cmd = Buffer.alloc(16);
  cmd[0] = 0xcd;
  cmd[5] = 0x06;
  cmd[6] = 0x12;
  cmd.writeUInt16LE(x0, 7);
  cmd.writeUInt16LE(y0, 9);
  cmd.writeUInt16LE(x1, 11);
  cmd.writeUInt16LE(y1, 13);
  cmd[15] = 0x00;
  return cmd;
}
