# OrbitPanel — Developer Guide

## Prerequisites

| Tool | Use |
|---|---|
| Node.js + npm | `apps/engine` (TS engine + Electron) and `apps/studio` |
| .NET 9 SDK | `apps/probehost` |
| node-usb | engine USB driver (needs WinUSB bound via Zadig) |
| USBView (Windows SDK) | Phase 0 device inspection |
| Wireshark + USBPcap | Phase 0 capture (dev only, not shipped) |

## Repo layout

```text
apps/
  engine/        Node/TypeScript engine (Electron): device lifecycle, scheduler, RGB565, node-usb driver, WebSocket, tray
  probehost/     .NET 9: LibreHardwareMonitor + Windows audio, JSON Lines on stdout
  studio/        React + TypeScript: visual editor + runtime renderer
packages/
  dashboard-schema/   JSON schema, validation, migrations
  widget-sdk/         widget contracts + shared render helpers
  test-fixtures/      sample telemetry, device frame fixtures
themes/orbit-default/
docs/   scripts/   tests/
```

## Build

```powershell
npm --prefix apps/engine install ; npm --prefix apps/engine run build
dotnet build apps/probehost
npm --prefix apps/studio install ; npm --prefix apps/studio run build
```

## Run without hardware

Use demo-data mode so UI/editor work never needs the physical panel:

```powershell
# engine (Electron) in demo mode — no panel needed
npm --prefix apps/engine run dev -- --demo
```

Studio uses simulated telemetry from the **same source of truth** as the output renderer, so preview matches hardware.

## ProbeHost ↔ Engine contract (JSON Lines v1)

- Transport: ProbeHost is a child process of the engine. One JSON object per line on **stdout**, newline-delimited. stderr is logs.
- Engine supervises: launch, heartbeat health-check, restart with backoff on crash. ProbeHost death → telemetry `unavailable`, display stays up.
- Every line carries `schemaVersion`. Version negotiation: engine rejects unknown major versions loudly.
- Payload conforms to `TelemetrySnapshot` (see [architecture.md](architecture.md)). `null` for unavailable, never zero. Each metric carries `quality` + `source`.
- Author the full v1 spec in `packages/dashboard-schema` **before** Phase 2 coding.

## Device state machine

`NotDetected → Connecting → Ready → Degraded → Reconnecting`. Transitions covered by unit tests. Reconnect must not require a Windows restart (baseline measured in Phase 0).

## Test layers

| Layer | Tests |
|---|---|
| Device protocol | golden RGB565 frame fixtures, packet-construction tests, optional manual hardware test |
| Engine | state-machine, reconnect, scheduler, config migration, provider supervision |
| ProbeHost | sensor normalization, missing-source states, snapshot schema validation |
| Studio | widget property validation, layout ops, import/export, undo/redo |
| End-to-end | demo snapshot → renderer → frame hash / screenshot → virtual or physical panel |

## Conventions

- Versioned, unit-explicit telemetry. Providers must not leak vendor sensor names into widget bindings.
- Profiles: portable JSON, versioned, migrations from v1.
- One slice per change; buildable at every commit. Manual hardware validation for any transport change.
- Bind WebSocket to `127.0.0.1` only.

## Phase 0 quick commands

```powershell
# device identity
Get-PnpDevice | Where-Object { $_.FriendlyName -like "*LCD*" -or $_.Class -eq "USB" } | Select-Object FriendlyName, DeviceID, Status
```

Capture 5 known frames (red/green/blue/white/black) from AIDA64 via USBPcap, save to `docs/captures/`, index them in [device-compatibility.md](device-compatibility.md). Do not send custom frames to the panel until captures are analyzed.
