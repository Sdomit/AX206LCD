// AX206 USB-Display driver over node-usb (WinUSB). Ported from the verified Phase 0
// Python tool (scripts/phase0/ax206_testframe.py). USB Mass Storage Bulk-Only Transport:
// CBW(31) -> data -> CSW(13); vendor opcode 0xCD. See docs/device-compatibility.md.
import { findByIds, type Device, type Interface, type InEndpoint, type OutEndpoint } from 'usb';
import { AX206, GET_DIMS, buildCbw, buildBlitCmd } from './protocol';

export { AX206 } from './protocol';
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function outT(ep: OutEndpoint, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => ep.transfer(data, (e) => (e ? reject(e) : resolve())));
}
function inT(ep: InEndpoint, len: number): Promise<Buffer> {
  return new Promise((resolve, reject) => ep.transfer(len, (e, d) => (e ? reject(e) : resolve(d as Buffer))));
}

// Best-effort: clear a stale endpoint halt left by an abrupt prior exit (which otherwise
// makes the next transfer time out). Resolves regardless of outcome.
function clearHaltSafe(ep: InEndpoint | OutEndpoint): Promise<void> {
  return new Promise((resolve) => {
    try {
      ep.clearHalt(() => resolve());
    } catch {
      resolve();
    }
  });
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Panel {
  readonly width: number;
  readonly height: number;
  blit(pixels: Buffer, rect?: Rect): Promise<Result<number>>;
  close(): void;
}

export async function openPanel(): Promise<Result<Panel>> {
  const device = findByIds(AX206.vid, AX206.pid) as Device | undefined;
  if (!device) return { ok: false, error: 'AX206 not found (WinUSB bound via Zadig? panel plugged in?)' };
  let iface: Interface | undefined;
  try {
    device.open();
    iface = device.interface(0);
    try {
      if (iface.isKernelDriverActive()) iface.detachKernelDriver();
    } catch {
      // not supported on Windows/WinUSB; safe to ignore
    }
    iface.claim();
    const out = iface.endpoint(AX206.epOut) as OutEndpoint | undefined;
    const inp = iface.endpoint(AX206.epIn) as InEndpoint | undefined;
    if (!out || !inp) throw new Error('AX206 bulk endpoints 0x01/0x81 not found');
    out.timeout = 10000;
    inp.timeout = 3000;
    await clearHaltSafe(out);
    await clearHaltSafe(inp);

    // Read dimensions, draining any stale IN data (a leftover CSW from an abrupt prior
    // exit desyncs the data phase — it surfaces as a bogus size like 21333x21314 = "USBS").
    let width = 0;
    let height = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      inp.timeout = 200;
      for (let i = 0; i < 4; i++) {
        try {
          await inT(inp, 64);
        } catch {
          break;
        }
      }
      inp.timeout = 3000;
      try {
        await outT(out, buildCbw(GET_DIMS, 5, true));
        const data = await inT(inp, 5);
        await inT(inp, 13); // CSW
        width = data.readUInt16LE(0);
        height = data.readUInt16LE(2);
      } catch {
        width = 0;
      }
      if (width > 0 && width <= 2048 && height > 0 && height <= 2048) break;
    }
    if (!(width > 0 && width <= 2048 && height > 0 && height <= 2048)) {
      throw new Error(`could not read panel dimensions (got ${width}x${height})`);
    }

    const releaseAndClose = (): void => {
      try {
        iface!.release(true, () => {
          try {
            device.close();
          } catch {
            // ignore
          }
        });
      } catch {
        try {
          device.close();
        } catch {
          // ignore
        }
      }
    };

    const panel: Panel = {
      width,
      height,
      async blit(pixels: Buffer, rect?: Rect): Promise<Result<number>> {
        const r = rect ?? { x0: 0, y0: 0, x1: width - 1, y1: height - 1 };
        try {
          await outT(out, buildCbw(buildBlitCmd(r.x0, r.y0, r.x1, r.y1), pixels.length, false));
          await outT(out, pixels);
          const csw = await inT(inp, 13);
          if (csw.toString('ascii', 0, 4) !== 'USBS') {
            return { ok: false, error: `bad CSW signature ${csw.subarray(0, 4).toString('hex')}` };
          }
          return { ok: true, value: csw[12] };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
      },
      close: releaseAndClose,
    };
    return { ok: true, value: panel };
  } catch (e) {
    try {
      iface?.release(true, () => {
        /* ignore */
      });
    } catch {
      // ignore
    }
    try {
      device.close();
    } catch {
      // ignore
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
