# Device Compatibility — Phase 0 Evidence

**Status: PHASE 0 COMPLETE ✓ (2026-06-28).** Panel fully driven over WinUSB — identity, endpoints, protocol, byte order, 480×320, native orientation, 2.8 fps benchmark, and reconnect recovery all confirmed. No firmware touched. Device profile: `device-profiles/ax206_usbdisplay.json`. Reproducible tools: `scripts/phase0/`.

## Panel identity

| Field | Value | Source |
|---|---|---|
| Brand / label | _pending_ | photo / packaging (owner) |
| Purchase link | _pending_ | owner |
| Cable type | _pending_ | inspection |
| Marketed controller | **AX206 CONFIRMED** — USBView vendor string = "APPOTECH LIMITED" (AppoTech makes the AX206) | USBView |
| USB Vendor ID | `0x1908` (AppoTech) | `Get-PnpDevice` |
| USB Product ID | `0x0102` | `Get-PnpDevice` |
| bcdDevice (REV) | `0x0100` | descriptor |
| bcdUSB / speed | `0x0110` — USB 1.1, **Full-speed (12 Mbit/s)** | descriptor |
| MaxPacketSize0 | 64 | descriptor |
| Configurations | 1 — currently **unconfigured** (CurrentConfigurationValue 0; no driver) | descriptor |
| Serial / instance | `20201115` | InstanceId |
| Location | `Port_#0002.Hub_#0012` | LocationInfo |
| Driver (now) | **WinUSB v6.1.7600.16385** bound via Zadig 2026-06-28 (was: none, code 28) | Zadig |
| Device class | `0xDC`/`0xA0`/`0xB0` vendor (no inbox driver) | CompatibleIds |
| Known-good | **Yes** — owner confirms panel displayed images before; code 28 is missing driver, not dead hardware | owner |
| Interface endpoints | **CONFIRMED** (pyusb/WinUSB): Interface 0 class 0xDC/0xA0/0xB0; bulk OUT `0x01` + bulk IN `0x81`, maxPacket 64; Config 1, 400mA | pyusb |
| Device strings | mfr `QTKeJi.Ltd` · product `USB-Display` · serial `20201115` (chip = AppoTech AX206 per VID) | pyusb |
| Reported resolution | **480 × 320** (device-reported via get-dimensions; 307200 B/frame RGB565) | pyusb |

## Protocol (from capture analysis)

| Field | Value | Evidence |
|---|---|---|
| Resolution (w×h) | **480 × 320** (307200 B/frame) | get-dimensions 0xCD/0x02 |
| Pixel format | **RGB565** | protocol |
| Byte order | **CONFIRMED high-byte-first** `RRRRRGGG GGGBBBBB` (red=`F8 00`, white=`FF FF`, green=`07 E0`, blue=`00 1F`) | red frame shows red on panel |
| Orientation | **CONFIRMED native** — no rotation/mirror; R=TL G=TR B=BL W=BR exactly as sent | orient frame, visual |
| Init sequence | **none** in display mode — get-dimensions then blit directly | confirmed |
| Frame command (blit) | CBW(31)=`USBC`+tag(`DEADBEEF`)+len+flags+`00 10`+CB; CB=`CD 00 00 00 00 06 12`+`<x0 y0 x1 y1 LE>`+`00`; then RGB565 data; then CSW(13), status 0=pass | confirmed (CSW=0) |
| Packet chunk size | EP maxPacket 64; bulk stream chunked by stack | descriptor |
| Brightness control | 0xCD brightness subcmd per dpf-ax — to test | pending |
| Partial / dirty-region writes | **SUPPORTED** — blit takes `x0,y0,x1,y1` rectangle → native dirty-region (offsets USB 1.1 ceiling) | protocol |
| Driver requirement | **WinUSB** — vendor class 0xDC, no inbox driver (currently code 28). Bind via Zadig/INF (reversible). | CompatibleIds |

## Capture index

Store binaries in `docs/captures/` (gitignored). Index them here.

| File | Pattern | Notes |
|---|---|---|
| `frame_red.pcapng` | solid 255,0,0 | _pending_ |
| `frame_green.pcapng` | solid 0,255,0 | _pending_ |
| `frame_blue.pcapng` | solid 0,0,255 | _pending_ |
| `frame_white.pcapng` | solid 255,255,255 | _pending_ |
| `frame_black.pcapng` | solid 0,0,0 | _pending_ |
| `frame_checker.pcapng` | checkerboard | optional |
| `frame_corners.pcapng` | numbered corner markers | orientation |

## Benchmarks

| Metric | Value |
|---|---|
| Bus ceiling | USB 1.1 Full-speed; **measured 0.86 MB/s usable** (BOT wrapper + pyusb overhead below the ~1.0–1.5 raw) |
| Full-frame update rate | **2.8 fps measured** (30× 480×320 RGB565 = 307200 B/frame, pyusb/WinUSB, 2026-06-28) → dirty-region mandatory for responsive widgets |
| Small-region estimate | ~100×40 meter = 8000 B → ~20–30 fps feasible (verify in Phase 4) |

## Reconnect behavior

| Test | Result |
|---|---|
| Unplug/replug (WinUSB) | **Recovered** — white frame PASS after replug, no rebind |
| Cycles tested | 1 clean cycle (engine handles continuous reconnect) |
| OS recovery time | immediate — pyusb re-finds device on replug |
| Requires Windows restart | **NO** ✓ |

## Original-state recovery plan

| Item | Detail |
|---|---|
| AIDA64 config backup location | N/A — AIDA64 not installed on this PC |
| Pre-project driver name/version | none — device was code 28 (no driver) before WinUSB |
| Steps to restore original driver | Device Manager → `USB-Display`/WinUSB Device → Uninstall device (leave "delete driver" unchecked) → Action → Scan for hardware changes → returns to code 28 |
| Zadig / WinUSB switch used? | Yes — WinUSB v6.1.7600.16385 bound 2026-06-28 |

## Exit checklist

- [x] Correct static test pattern reaches the physical panel — red / corners / orient all PASS, visually correct
- [x] Orientation + color channels correct — native, RGB565 high-byte-first
- [x] Reconnects without Windows restart — white frame PASS after replug, no rebind, no restart
- [x] Device profile committed — `device-profiles/ax206_usbdisplay.json`, this doc, and `scripts/phase0/`
- [x] No firmware modified — image blits only
- [x] Original driver state + recovery steps documented — Zadig WinUSB; revert via Device Manager uninstall + rescan

## Stop conditions (report and halt)

- VID/PID matches a known-incompatible protocol variant.
- WinUSB co-installer required but would break AIDA64.
- Capture shows encrypted/obfuscated protocol.
