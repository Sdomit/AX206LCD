"""Phase 0: send one solid test frame to the AX206 USB-Display (1908:0102) over WinUSB.
WRITES an image to the LCD (reversible; next frame overwrites; no firmware touched).
Usage: python ax206_testframe.py [red|green|blue|white|black|corners]
Logs each step (flushed) to ax206.log so a native libusb crash is still diagnosable.
Source: dpf-ax / AX206 (qiita.com/nak435, dreamlayers/dpf-ax)."""
import os
import sys
import struct
import traceback
import usb.core
import usb.util

LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ax206.log")
VID, PID = 0x1908, 0x0102
EP_OUT, EP_IN = 0x01, 0x81
TAG = b'\xde\xad\xbe\xef'
COLORS = {"red": (255, 0, 0), "green": (0, 255, 0), "blue": (0, 0, 255),
          "white": (255, 255, 255), "black": (0, 0, 0)}


def log(m):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(str(m) + "\n")
        f.flush()


def find_device():
    try:
        import libusb_package
        d = libusb_package.find(idVendor=VID, idProduct=PID)
        if d is not None:
            return d
    except ImportError:
        pass
    return usb.core.find(idVendor=VID, idProduct=PID)


def rgb565(r, g, b):
    return bytes(((r & 0xf8) | (g >> 5), ((g & 0x1c) << 3) | (b >> 3)))


def send_cbw(dev, cmd16, data_len, direction_in):
    flags = 0x80 if direction_in else 0x00
    pkt = b'USBC' + TAG + struct.pack('<I', data_len) + bytes([flags, 0x00, 0x10]) + cmd16
    assert len(pkt) == 31
    dev.write(EP_OUT, pkt, timeout=2000)


def read_csw(dev):
    csw = bytes(dev.read(EP_IN, 13, timeout=3000))
    if csw[:4] != b'USBS':
        raise RuntimeError(f"bad CSW signature {csw[:4]!r}")
    return csw[12]


def get_dimensions(dev):
    log("  get_dimensions: send CBW")
    send_cbw(dev, bytes([0xcd, 0, 0, 0, 0, 0x02]) + bytes(10), 5, True)
    log("  get_dimensions: read data")
    data = bytes(dev.read(EP_IN, 5, timeout=3000))
    log(f"  get_dimensions: data={data.hex()}")
    read_csw(dev)
    return data[0] | (data[1] << 8), data[2] | (data[3] << 8)


def blit(dev, w, h, pixels):
    cmd = bytes([0xcd, 0, 0, 0, 0, 0x06, 0x12]) + struct.pack('<HHHH', 0, 0, w - 1, h - 1) + bytes([0x00])
    assert len(cmd) == 16
    log("  blit: send CBW")
    send_cbw(dev, cmd, len(pixels), False)
    log(f"  blit: write {len(pixels)} data bytes")
    dev.write(EP_OUT, pixels, timeout=10000)
    log("  blit: read CSW")
    return read_csw(dev)


def build(mode, w, h):
    if mode == "corners":
        blue, red = rgb565(0, 0, 255), rgb565(255, 0, 0)
        out = bytearray()
        for y in range(h):
            for x in range(w):
                edge = (x < 20 or x >= w - 20) and (y < 20 or y >= h - 20)
                out += red if edge else blue
        return bytes(out)
    if mode == "orient":
        black = rgb565(0, 0, 0)
        tl, tr, bl, br = rgb565(255, 0, 0), rgb565(0, 255, 0), rgb565(0, 0, 255), rgb565(255, 255, 255)
        m = 60
        out = bytearray()
        for y in range(h):
            for x in range(w):
                if x < m and y < m:
                    out += tl
                elif x >= w - m and y < m:
                    out += tr
                elif x < m and y >= h - m:
                    out += bl
                elif x >= w - m and y >= h - m:
                    out += br
                else:
                    out += black
        return bytes(out)
    return rgb565(*COLORS[mode]) * (w * h)


def main():
    open(LOG, "w").close()
    mode = sys.argv[1] if len(sys.argv) > 1 else "red"
    log(f"=== run mode={mode}")
    assert rgb565(255, 0, 0) == b'\xf8\x00' and rgb565(0, 0, 255) == b'\x00\x1f'
    dev = None
    try:
        dev = find_device()
        log(f"device={'found' if dev is not None else 'NONE'}")
        if dev is None:
            return
        try:
            usb.util.dispose_resources(dev)
            log("disposed stale resources")
        except Exception as e:
            log(f"dispose: {e!r}")
        try:
            cfg = dev.get_active_configuration()
            log(f"active config = {cfg.bConfigurationValue}")
        except Exception as e:
            log(f"no active config ({e!r}); calling set_configuration")
            dev.set_configuration()
            log("set_configuration ok")
        for ep in (EP_OUT, EP_IN):
            try:
                dev.clear_halt(ep)
                log(f"clear_halt {ep:#04x} ok")
            except Exception as e:
                log(f"clear_halt {ep:#04x}: {e!r}")
        w, h = get_dimensions(dev)
        log(f"dimensions={w}x{h}")
        if not (0 < w <= 2048 and 0 < h <= 2048):
            log("implausible dims; abort")
            return
        if mode == "bench":
            import time
            frame = rgb565(255, 0, 0) * (w * h)
            n = 30
            t0 = time.perf_counter()
            for _ in range(n):
                blit(dev, w, h, frame)
            dt = time.perf_counter() - t0
            log(f"bench: {n} full frames in {dt:.3f}s = {n / dt:.1f} fps, {n * len(frame) / dt / 1e6:.2f} MB/s")
        else:
            status = blit(dev, w, h, build(mode, w, h))
            log(f"blit '{mode}': CSW status={status} ({'PASS' if status == 0 else 'FAIL'})")
    except Exception:
        log("EXCEPTION:\n" + traceback.format_exc())
    finally:
        try:
            usb.util.dispose_resources(dev)
            log("final dispose ok")
        except Exception as e:
            log(f"final dispose: {e!r}")
    log("=== end")


if __name__ == "__main__":
    main()
    sys.exit(0)
