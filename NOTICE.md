# NOTICE — Third-Party Attribution

OrbitPanel incorporates and derives from third-party open-source software. Original authorship of the forked/embedded code is **not** claimed. This file must be kept current as dependencies are added.

## Derived / forked

OrbitPanel contains **no forked code**. The SensorPanel fork was evaluated in Phase 0 and dropped (Path C, 2026-06-28); the USB driver is our own implementation.

| Project | License | Use | Obligation |
|---|---|---|---|
| LibreHardwareMonitor | MIT | Windows sensor collection in ProbeHost | Retain copyright + MIT text |

## Protocol references (no code copied)

The AX206 USB-Display protocol was learned from **dpf-ax** (github.com/dreamlayers/dpf-ax) and **qiita.com/nak435** — reference/documentation only. OrbitPanel's driver is an independent implementation; credit these as references.

## Bundled dependencies (to verify before ship)

| Dependency | License | Status |
|---|---|---|
| `usb` (node-usb; bundles libusb) | MIT + libusb LGPL-2.1 | Verify LGPL dynamic-link compliance before ship |
| Electron | MIT | OK |
| React + TypeScript toolchain | MIT | OK |
| Structured logger (pino) | MIT | OK |

## Development-only (not shipped)

| Tool | License | Note |
|---|---|---|
| USBPcap | GPL-2.0 | Phase 0 capture only. Not redistributed. No license impact on OrbitPanel. |
| Wireshark | GPL-2.0 | Analysis only. Not redistributed. |

## Action

Before shipping: create `LICENSES/` with `MIT-librehardwaremonitor.txt` and the licenses of bundled npm deps (Electron, node-usb/libusb). No SensorPanel license needed (not used).
