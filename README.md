# OrbitPanel

Windows-first desktop app that drives a small USB LCD (panel believed to use an **AX206** controller) as a live dashboard for PC sensors, audio, and AI-coding workflow metrics. Local-first: no cloud account, no telemetry, no external server required.

> **Status: Phase 0 COMPLETE.** AX206 panel driven over WinUSB — 480×320 RGB565, native orientation, reconnect OK. Stack decided: **Path C** (TypeScript engine + React Studio + .NET 9 ProbeHost, Electron). Next: Slice 1A. See [docs/plan.md](docs/plan.md) and [docs/device-compatibility.md](docs/device-compatibility.md).

## What it does (target)

- Drives the physical USB LCD reliably, resilient to disconnect/reconnect.
- Live dashboard: CPU/GPU/RAM/disk/network/fan sensors, audio status, Claude/Codex workflow metrics.
- **OrbitPanel Studio**: visual editor with pixel-accurate preview, widget palette, drag/resize/snap, profiles (create/import/export/switch), diagnostics.
- Demo-data mode so the editor works with the panel disconnected.

## Architecture

```text
Studio (React/TS)  ──profile JSON / preview──►  Engine (Node/TypeScript, Electron)
   visual editor                                  device lifecycle · RGB565 · scheduler
                                                  node-usb driver · WebSocket · tray
                                                        │ child process, JSON Lines
                                                        ▼
                                                  ProbeHost (.NET 9)
                                                  LibreHardwareMonitor · audio · health
```

Why the split: the engine and Studio share the TS widget schema (preview == output) and the engine owns the verified `node-usb` AX206 driver; .NET is the native home for LibreHardwareMonitor; JSON Lines over stdin/stdout avoids opening a local port for hardware data. Full rationale + ADR (incl. the Phase 0 re-score) in [docs/architecture.md](docs/architecture.md).

## Repo layout

```text
apps/engine/        Node/TypeScript engine (Electron, node-usb)
apps/probehost/     .NET 9 sensor/audio bridge
apps/studio/        React + TypeScript editor
packages/           dashboard-schema · widget-sdk · test-fixtures
themes/orbit-default/
docs/               plan · architecture · device-compatibility · provider-security · guides
scripts/  tests/
```

## Build

Phase 0 done (panel driven; see [docs/device-compatibility.md](docs/device-compatibility.md)). Slice 1A scaffolds the TS engine.

```powershell
npm --prefix apps/engine install && npm --prefix apps/engine run build    # TS engine (Electron, node-usb)
dotnet build apps/probehost                                                # .NET 9 ProbeHost
npm --prefix apps/studio install && npm --prefix apps/studio run build     # React Studio
```

## Safety

- **Never** flash the panel or alter its USB driver without a reversible backup/recovery plan.
- **Never** run AIDA64 and OrbitPanel against the panel at the same time.
- Settings live under `%APPDATA%\OrbitPanel`. App runs without admin by default; elevation is requested per-sensor with explanation.

## License & attribution

OrbitPanel extends MIT-licensed upstream projects. See [NOTICE.md](NOTICE.md). Original authorship of upstream code is **not** claimed.

## Docs

| Doc | Purpose |
|---|---|
| [plan.md](docs/plan.md) | Validation verdict, backlog, phases, MVP cutline, quality gates |
| [architecture.md](docs/architecture.md) | Components, ADR, telemetry + profile schemas |
| [device-compatibility.md](docs/device-compatibility.md) | Phase 0 protocol evidence (pending) |
| [provider-security.md](docs/provider-security.md) | Privacy, Claude OTel, Codex, security ops |
| [user-guide.md](docs/user-guide.md) | Install, tray, Studio, profiles, diagnostics |
| [developer-guide.md](docs/developer-guide.md) | Build, ProbeHost contract, test layers |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Working agreement, quality gates, slice workflow |
