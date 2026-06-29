# OrbitPanel

## Project Type
Windows desktop app. USB LCD dashboard (panel believed AX206 controller). Local-first.

## Status
Phases 0–5 substantially built: AX206 driver (node-usb, 480×320 RGB565), state machine + reconnect, ProbeHost telemetry (CPU/GPU/RAM/disk/net), schema-driven widgets + React Studio, dirty-region + supersample AA, Claude/Codex usage bars, tray + control window. Stack: **Path C** (TS engine + React Studio + .NET ProbeHost, Electron). Recent: admin-by-default elevation (CPU temp), depth theme, engine loads active profile from `%APPDATA%\OrbitPanel\profile.json` (Studio→panel pipeline). Next: Phase 6 hardening — CI (typecheck/test/build), structured logger + rotation, installer/portable ZIP. See [docs/plan.md](docs/plan.md).

## Stack
- `apps/engine` — Node/TypeScript, Electron. Device lifecycle, frame scheduler, RGB565, dirty-region, WebSocket API, tray. `node-usb` driver (verified AX206 profile).
- `apps/probehost` — .NET 9. LibreHardwareMonitor + Windows audio. Child process of engine, JSON Lines over stdout.
- `apps/studio` — React + TypeScript. Visual editor + runtime renderer (shared widget schema).

## Key Files
- [docs/plan.md](docs/plan.md) — validation report, backlog, phases, MVP cutline.
- [docs/architecture.md](docs/architecture.md) — components, ADR (Path A vs B), data contracts.
- [docs/device-compatibility.md](docs/device-compatibility.md) — Phase 0 evidence (VID/PID, protocol). PENDING.
- [docs/provider-security.md](docs/provider-security.md) — privacy, Claude OTel, Codex, security rules.

## Hard Rules
- NEVER flash panel. NEVER alter USB driver without reversible backup. NEVER run AIDA64 + OrbitPanel on panel simultaneously.
- `null` is the only unavailable numeric value. Never substitute zero.
- No browser cookie/session-token reading. No prompt/code/tool-arg logging by default.
- Bind dev WebSocket to 127.0.0.1 only. Settings under %APPDATA%\OrbitPanel, never Program Files.
- USB is solved: port the verified Phase 0 protocol (`scripts/phase0/`, `device-profiles/ax206_usbdisplay.json`) to `node-usb`. Don't re-reverse-engineer it.

## Conventions
- Telemetry: versioned, unit-explicit, every metric carries quality + source. Schema in `packages/dashboard-schema`.
- Profiles: portable JSON, validate against versioned schema, migrations from v1.
- One slice at a time. Buildable at every commit. Tests at changed boundary. Manual hardware test for transport changes.

## Rules
- All global rules from ~/.claude/CLAUDE.md apply.
