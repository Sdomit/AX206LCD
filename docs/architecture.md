# OrbitPanel — Architecture

## Components

```text
┌─────────────── OrbitPanel Studio (React + TypeScript) ───────────────┐
│ preview canvas · widget palette · inspector · profiles · diagnostics │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ profile JSON / preview data (WebSocket)
┌───────────────────────────▼──────────────────────────────────────────┐
│ OrbitPanel Engine (Node/TypeScript · Electron)                       │
│ device lifecycle · frame scheduler · RGB565 · dirty-region           │
│ node-usb driver · profile loader · WebSocket API · tray · logs        │
└──────────────┬───────────────────────────────┬───────────────────────┘
               │ child process, JSON Lines      │ WebSocket
┌──────────────▼─────────────┐    ┌────────────▼────────────────────────┐
│ ProbeHost (.NET 9)         │    │ Theme/runtime renderer (React/TS)    │
│ LibreHardwareMonitor       │    │ consumes normalized data →           │
│ Windows audio · health     │    │ dashboard frame / preview            │
└──────────────┬─────────────┘    └──────────────────────────────────────┘
               │ normalized snapshot
┌──────────────▼───────────────────────────────────────────────────────┐
│ Providers: hardware · audio · network · Claude metrics · Codex (opt) │
└───────────────────────────────────────────────────────────────────────┘
```

## Why this split

- **TS engine** (Node/Electron) shares the widget schema and render helpers with React Studio so preview matches the panel; it owns the verified `node-usb` AX206 driver (ported from `scripts/phase0/`).
- **.NET ProbeHost** is the native, mature home for LibreHardwareMonitor — correct place for Windows sensor collection.
- **JSON Lines over stdin/stdout**: ProbeHost is launched and supervised by the engine. Avoids opening a public local port for hardware data in MVP; boundary is easy to inspect and test.
- **Shared React widget schema** between Studio and runtime renderer so preview matches the physical LCD pixel-for-pixel.

Engine **owns ProbeHost lifecycle**: launch, health-check via heartbeat, restart on crash with backoff. A ProbeHost crash must degrade telemetry to `unavailable`, never crash the display.

## ADR: Path A (extend SensorPanel) vs Path B (standalone Rust)

| Criterion | Weight | A | B |
|---|---:|---:|---:|
| Exact display compatibility | 35% | 4 | 2 |
| Fastest path to useful physical panel | 25% | 4 | 2 |
| Ability to create visual editor | 15% | 4 | 3 |
| Windows sensor integration quality | 10% | 3 | 3 |
| Long-term maintainability | 10% | 3 | 4 |
| Fit with existing skills/tooling | 5% | 4 | 2 |
| **Weighted** | | **3.80** | **2.45** |

**Decision: Path A.** Reasons: AX206/generic-display concepts, RGB conversion, WebSocket delivery, diagnostics, and benchmarking already exist; React/TS editor plumbing already present. Path B pays weeks of unsafe/libusb work before the first pixel and the same .NET sensor child is needed either way.
**Reverse only if** Phase 0 proves a real incompatibility unfixable by a device profile or small driver extension.

## ADR re-score — Phase 0 evidence (2026-06-28)

Phase 0 made USB a solved, ~120-line problem (verified WinUSB driver in `scripts/phase0/`). That removes Path A's main advantage (the original ADR put 60% of weight on display-compatibility + fastest-to-panel, both of which assumed USB was hard). Re-scoring **Path A** (fork SensorPanel: Go engine + React + .NET child) vs **Path C** (own engine in **Node/TypeScript**, our driver, keep the .NET 9 ProbeHost child — same 3-box architecture, engine language swapped Go→TS so editor and runtime share one stack):

| Criterion (re-weighted) | Weight | A: SensorPanel fork | C: TS engine |
|---|--:|--:|--:|
| Fastest path to working MVP | 25% | 3 | 4 |
| Visual editor + preview parity | 20% | 3 | 4 |
| Dirty-region / render control (2.8 fps ceiling) | 15% | 3 | 4 |
| Maintainability / fewest toolchains / no fork | 20% | 2 | 4 |
| Windows sensor integration (.NET ProbeHost, equal) | 10% | 3 | 3 |
| Display compatibility (now solved, equal) | 5% | 4 | 4 |
| Skills/tooling fit | 5% | 3 | 4 |
| **Weighted** | | **2.85** | **3.90** |

**Recommendation: Path C.** Drop the Go/SensorPanel fork. Engine in TypeScript (Node) sharing the widget schema with React Studio (preview == output for free); port the verified driver to `node-usb`; keep the .NET 9 ProbeHost child for LibreHardwareMonitor over JSON Lines. Net: 2 languages (TS + C#) not 3, no upstream fork to track, full control of dirty-region rendering. Desktop shell (Electron vs Tauri vs thin tray) is a Slice-1A detail — Electron keeps it pure TS; Tauri is leaner but re-adds a third language (Rust).

Bonus: dropping the fork also removes the SensorPanel MIT obligation from `NOTICE.md` (protocol credit goes to dpf-ax / AX206 docs, which we used directly).

**DECIDED 2026-06-28: Path C** — Node/TypeScript engine + React Studio + .NET 9 ProbeHost child, **Electron** shell, `node-usb` driver. Go/SensorPanel fork dropped.

## Data contracts

### Telemetry snapshot (versioned, unit-explicit)

```ts
type MetricQuality = "ok" | "stale" | "unavailable" | "error";
type Metric<T> = { value: T | null; unit?: string; quality: MetricQuality; updatedAt: string; source: string; displayName?: string };

type TelemetrySnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  host: {
    cpu: { packageTempC: Metric<number>; loadPercent: Metric<number>; clockMHz: Metric<number>; powerW: Metric<number> };
    gpu: { tempC: Metric<number>; hotspotC: Metric<number>; loadPercent: Metric<number>; vramUsedMiB: Metric<number>; powerW: Metric<number> };
    memory: { usedMiB: Metric<number>; totalMiB: Metric<number>; loadPercent: Metric<number> };
    storage: Record<string, { tempC: Metric<number>; freeGiB: Metric<number>; usedPercent: Metric<number> }>;
    network: { downBps: Metric<number>; upBps: Metric<number> };
    audio: { volumePercent: Metric<number>; muted: Metric<boolean>; peak: Metric<number> /* 0–1 */ };
    uptimeSeconds: Metric<number>;
  };
  ai: {
    claude?: { todayTokens: Metric<number>; todayCostUsd: Metric<number>; sessionCount: Metric<number>; lastActivityAt: Metric<string>; model: Metric<string> };
    codex?:  { remainingPercent: Metric<number>; resetAt: Metric<string>; sourceState: Metric<string> };
  };
};
```

Rules: `null` is the only unavailable numeric value (never zero). Every metric carries quality + source. Units travel with values; transforms live in presentation helpers. Providers publish at their own cadence; engine merges safely. Short in-memory history only for widgets that request it. Never persist raw AI prompts, code, command args, cookies, tokens, or session secrets.

### Profile schema

Portable JSON, validated against a versioned schema, **migrations from v1**.

Each profile stores:
- `deviceProfileId` + target screen / logical canvas size (must fail loudly on a mismatched panel).
- Background style.
- Widgets: `id`, type, geometry, z-index, styling, data binding, formatting, threshold rules, refresh behavior.
- Default orientation + brightness preferences.
- (Later) page/rotation schedule.

### ProbeHost ↔ Engine contract

JSON Lines over stdout, one object per line, newline-delimited. Versioned. Carries: schema version, heartbeat, normalized snapshot, provider health. Full v1 spec authored before Phase 2 coding — see [developer-guide.md](developer-guide.md).

## Constraints

- Dirty-region rendering stays gated on Phase 0 protocol proof.
- WebSocket binds `127.0.0.1` only, origin-checked.
- No display transport change ships without manual hardware validation.
