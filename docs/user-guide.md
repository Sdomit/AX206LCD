# OrbitPanel — User Guide

> Pre-release. Phase 0 in progress; features below describe the target product.

## Install

- Portable ZIP or installer (early releases are not silently auto-updated).
- No administrator account required to run. Specific sensors may request elevation with an explanation — you can decline and still use the rest.
- Settings and profiles live under `%APPDATA%\OrbitPanel`.

## First run

1. OrbitPanel starts in the Windows tray and auto-reconnects to the display.
2. If the panel is missing, the dashboard shows a clear disconnected state — the app keeps running.
3. Open **OrbitPanel Studio** from the tray to edit dashboards.

## Tray

| Action | Effect |
|---|---|
| Open Studio | Launch the visual editor |
| Connect / Disconnect | Toggle the display link |
| Status icon | Reflects device state (NotDetected → Connecting → Ready → Degraded → Reconnecting) |
| Quit | Stop OrbitPanel |

## Studio

- **Preview canvas** — pixel-accurate, 1:1 with the physical LCD.
- **Widget palette** — text/label, stat card, progress bar, sparkline, gauge, status pill, clock/date, audio meter.
- **Layout** — drag, resize, align, snap, duplicate, delete, group, layer (z-order). Keyboard shortcuts + undo/redo.
- **Inspector** — fonts, colors, units, thresholds, rounding, history duration, data binding, refresh policy.
- **Live preview** uses simulated data even when the panel is disconnected.

## Data shown

CPU temp/load/clock/power · GPU temp/hotspot/load/power/VRAM · RAM used/total/% · SSD/NVMe temp + free space · network up/down · fan RPM · master volume/mute/peak · uptime · time/date · (optional) Claude/Codex metrics.

A value that is unavailable shows `—` plus an unobtrusive health state. OrbitPanel never shows a fake zero.

## Profiles

- Create, duplicate, save, import, export, switch named profiles.
- Profiles are portable JSON and validate against a versioned schema.
- A profile built for one panel size will refuse to load on a different-size panel rather than render broken.
- Invalid profile JSON fails with a useful diagnostic — your existing profiles are not lost.

## Diagnostics page

Device identity, connection state, measured transfer performance, sensor availability, logs, and driver guidance. Includes **Copy diagnostics** (secrets redacted).

## AI metrics (optional, opt-in)

- **Claude Code**: a setup wizard enables aggregate metrics only (tokens, approximate cost, sessions today). No prompt or code content is collected.
- **Codex**: shown only when a supported source is configured; otherwise `Unavailable — source not configured`.

## Safety

- Do not run AIDA64 and OrbitPanel against the panel at the same time.
- OrbitPanel never flashes the panel or modifies firmware.

## Troubleshooting

| Symptom | Check |
|---|---|
| Panel not detected | Diagnostics → device identity; driver guidance |
| Sensor shows `—` | Sensor not exposed by hardware, or elevation declined |
| Stuck Reconnecting | Replug panel; check Diagnostics logs |
| Profile won't load | Wrong panel size or invalid JSON — see diagnostic message |
