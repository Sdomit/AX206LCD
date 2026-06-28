# OrbitPanel — Plan & Validation Record

Token-optimized. Tables over prose. Source of truth for scope, sequence, and gates.

> **Status 2026-06-28: Phase 0 COMPLETE.** AX206 panel driven over WinUSB — 480×320 RGB565, native orientation, 2.8 fps full-frame, reconnect OK. Evidence: [device-compatibility.md](device-compatibility.md), `device-profiles/ax206_usbdisplay.json`, `scripts/phase0/`. **Stack DECIDED (Path C, 2026-06-28):** Node/TypeScript engine + React Studio + .NET 9 ProbeHost child, Electron shell, `node-usb` driver — Go/SensorPanel fork dropped. ADR + scores: [architecture.md](architecture.md). **Progress through Slice 2A:** 1A — TS `node-usb` driver drives the panel (red CSW=0); 1B — device state machine + auto-reconnect + frame scheduler + headless service; 2A — .NET ProbeHost streams live CPU/RAM telemetry over JSON Lines, supervised + null-safe (CPU temp reports unavailable, never 0). **2B DONE** — live CPU-load + RAM bars render on the real panel from ProbeHost telemetry (threshold colors; null/stale shown explicitly). 19/19 unit tests. **2C DONE** — approved themed UI ported to the panel: CPU arc gauge, RAM card, status, custom 5×7 bitmap font; null/stale-safe; fixed a stale-halt open timeout and an unlistened-error crash. 22/22 unit tests. **2D DONE** — ProbeHost expanded to GPU/disk/network + CPU/GPU temps (schema v2); themed GPU/RAM/NET cards on the panel; robust open (drains a stale pipe + retries dimensions). GPU temp live; CPU temp needs an elevated run; disk temp unavailable on this drive (shown honestly). 18 unit tests. Next: **5A** Claude/Codex 5h-window usage progress (local-only, configurable limit, Codex honest-unavailable), then **1C** Electron tray.

## Verdict — Approve with changes

1. Hardware-first is correct. Phase 0 mandatory before architecture locks.
2. Path A (SensorPanel fork) is the default — but compatibility with *this* panel is a hypothesis, not a fact.
3. Go + .NET + React tri-process split is justified by domain boundaries. Keep it.
4. JSON Lines over stdin/stdout for ProbeHost is correct. No local hardware-data port in MVP.
5. Telemetry schema is sound. `null` (never zero) for unavailable is the right invariant.
6. LibreHardwareMonitor needs admin for most thermals/fans on Win10/11. Plan for it; don't hide it.
7. Claude OTel metrics-only is correct. Opt-in wizard. No logs/traces/prompt content.
8. No safe official local Codex usage source exists today. Ship "Unavailable — source not configured"; don't block MVP.
9. SensorPanel MIT, LibreHardwareMonitor MIT. No license blockers. Attribution required.
10. Phase 0 is the single hard dependency before all other work.

## Facts vs assumptions (verify locally)

| Item | Status | Verify |
|---|---|---|
| AX206 controller | Assumption | Device Manager / USBView |
| USB VID/PID | Unknown | `Get-PnpDevice`, USBView |
| Resolution | Assumption | Frame byte count from capture (w*h*2) |
| RGB565 byte order | Unknown | Full-red frame, inspect bytes |
| Endpoint layout / packet size | Unknown | USBView / USBPcap |
| Init sequence | Unknown | Capture before first frame on connect |
| WinUSB vs libusb driver | Unknown | Device Manager driver entry |
| AIDA64 driver reusable | Unknown | Check signed/proprietary lock |
| Dirty-region / partial writes | Unknown | Protocol RE after full-frame works |
| Brightness control | Unknown | Capture AIDA64 brightness change |
| SensorPanel drives this panel | Assumption | Run SensorPanel enumeration on hardware |
| LHM reads this CPU/GPU | Assumption | Run LHM, check sensor output |
| LHM needs elevation | Likely | Run without admin, compare sensor count |
| Claude OTel stable/local | Mostly | Read current OTEL exporter config |
| Codex stable machine-readable status | Likely false | Check Codex CLI docs |

## Architecture decision (ADR summary)

Path A = **3.80**, Path B = **2.45**. **Choose Path A.** Full weighted table in [architecture.md](architecture.md). Decision rule: A if it shows a correct static test pattern and reconnects cleanly; B only if a real incompatibility cannot be fixed by a device profile or small driver extension.

## Critical corrections

- "AX206" treated as fact in later sections — keep it uncertain through Phase 0.
- "No admin requirement" (Phase 1 exit) is wrong: restate as "no *default* admin; elevation per-feature with explanation."
- Engine must supervise ProbeHost crash/restart — document that state machine explicitly.
- Profile schema needs `deviceProfileId`; a 320x240 profile must fail loudly on a 480x320 panel.
- Missing from brief: WinUSB/libusb driver-switch path (Zadig), installer code-signing/SmartScreen, versioned ProbeHost JSON-Lines contract before Phase 2.
- Defer full "ambiguous sensor selector" UI to Phase 3; ship config-file selection in Phase 2.
- Dirty-region: Phase 0 proved it's **supported** (rect blit `x0,y0,x1,y1`) and **necessary** (full-frame measured 2.8 fps / 0.86 MB/s over USB 1.1). Promote from Phase 4 nicety to MVP-critical for any moving widget.

## MVP cutline

**In:** Phase 0 done · tray + reconnect state machine · static dashboard on real panel from fixture JSON · CPU temp, CPU load, RAM used/total, system time (4 widgets) · demo mode.
**Defer:** GPU/storage/network/audio widgets · visual editor (config-file first) · profile import/export · AI widgets · dirty-region perf.
Rationale: a 4-metric static dashboard on real hardware proves the whole stack.

## Phases

| Phase | Goal | Exit |
|---|---|---|
| 0 Discovery | Know what the panel is; one correct frame reaches it | Static test pattern correct; orientation+channels right; reconnects without reboot; profile committed with evidence; no firmware change |
| 1 Engine skeleton | Tray app renders static dashboard on real panel | Start/stop/reconnect/error visible; static dashboard correct in preview + hardware; no default admin |
| 2 Telemetry bridge | Accurate PC sensors, robust | CPU/GPU/RAM/disk/net/time/audio work when exposed; missing = unavailable not false; ProbeHost restart doesn't crash engine |
| 3 Widgets + editor | Build layouts without code | Reproduce default + build a 2nd dashboard no-code; profiles survive restart + import elsewhere; invalid JSON fails with diagnostics not data loss |
| 4 Real-time + perf | Smooth without wasting CPU/bandwidth | No flicker; audio meter responsive without full redraw; benchmark-driven defaults; CPU/mem recorded in diagnostics |
| 5 AI providers | Privacy-respecting Claude + Codex | Claude daily aggregate without prompt/code capture; Codex shows verified data or clear unavailable; no credentials/cookies stored |
| 6 Hardening + release | Stable, understandable Windows app | Fresh install works w/ driver guidance; profile restore after update/failure; license notices complete; no secrets/prompts in logs/exports by default |

## Backlog (ordered; DoD + test type)

### Phase 0
| Task | Dep | DoD | Test |
|---|---|---|---|
| Device identity (VID/PID, endpoint, driver) | hardware | written to device-compatibility.md | manual |
| Backup AIDA64 config | — | export saved + verified | manual |
| Spike existing AX206 drivers (python `ax206`, lcd4linux, sigrok) against this VID/PID | identity | each tried; whether any already drives the panel recorded; if yes, re-open stack decision | manual |
| Install USBPcap/Wireshark | — | capture runs on USB interface | manual |
| Capture 5 known frames (R/G/B/W/K) from AIDA64 | wireshark | 5 .pcapng saved | manual |
| Analyze captures → protocol | captures | init seq, frame cmd, endpoint, resolution, byte order confirmed | manual |
| SensorPanel device probe | SP cloned | detected/not + profile recorded | manual |
| Reconnect stress (AIDA64) | — | 10 unplug/replug documented | manual |
| Document original-driver recovery plan | identity | restore steps in docs | manual |

### Phase 0 effort box & Plan-B trigger

Phase 0 is the highest-variance task (USB protocol RE can be 1 day or 2 weeks). Box it; do not let it silently consume the project.

- **Effort box:** cap protocol reverse-engineering at **5 working days** from start of capture analysis. Owner may adjust, but the number must be set, not open-ended.
- **Trigger — existing driver wins:** if the spike shows an existing open driver already drives the panel, **re-open the stack decision** before forking SensorPanel. A single-stack build (all-.NET or all-TypeScript+USB lib) may be simpler to finish; Go's only justification is SensorPanel reuse. See ADR in [architecture.md](architecture.md).
- **Trigger — Path A blocked:** if no existing driver works AND no correct frame from a SensorPanel device profile within the effort box, **STOP and reassess** — do not push deeper into the Go fork on momentum. Re-score Path A vs B vs single-stack with the new evidence.
- **Trigger — hard stop (already a stop condition):** AIDA64 driver signed/locked AND a WinUSB switch would break AIDA64 → STOP, report, do not proceed.
- **Question the Go engine:** the tri-process split is correct *only if* Path A holds. If Phase 0 kills Path A, drop Go and collapse to one toolchain before building features.

### Phase 1
| Task | Dep | DoD | Test |
|---|---|---|---|
| Scaffold TS engine (Electron) + monorepo workspaces; no fork | P0 done | `npm run build` green in `apps/engine` | build |
| Port Phase 0 driver to TS `node-usb` module | P0 done | engine drives a red frame (parity with python tool), CSW=0 | manual hw |
| Structured logger + rotation | fork | log created, rotates 10MB | unit |
| Device state machine (5 states) | P0 protocol | transitions covered | unit |
| Demo-data mode flag | state machine | `--demo` bypasses USB | unit |
| orbit-default theme fixture | studio scaffold | loads, validates | schema |
| Render static dashboard on panel | state machine+fixture | colors+layout correct on hardware | manual hw |
| Tray icon + connect/disconnect/quit | state machine | actions work, state in icon | manual |
| Config dir %APPDATA%\OrbitPanel | — | created first run | integration |
| Golden frame fixture test | renderer | frame hash matches | golden |

### Phase 2
| Task | Dep | DoD | Test |
|---|---|---|---|
| ProbeHost JSON-Lines schema v1 (versioned) | — | doc committed before code | schema |
| ProbeHost skeleton (.NET) | schema | valid JSON Lines on stdout | schema |
| LHM traversal CPU/GPU/RAM/disk/fan | skeleton | real values on dev PC | integration |
| Normalize → TelemetrySnapshot | traversal | null not zero; missing-sensor unit tests | unit |
| Windows audio provider (Core Audio) | skeleton | volume/mute/peak emitted | integration |
| Provider health / stale detection | normalize | stale if no update in 2x interval | unit |
| Engine supervises ProbeHost restart | probehost | survives SIGKILL, no display drop | integration |
| Per-sensor elevation prompt w/ reason | LHM | runs without admin sensors | manual |
| Test no-GPU / rejected-elevation | normalize | unavailable, no crash | unit/integration |

### Phase 3
| Task | Dep | DoD | Test |
|---|---|---|---|
| Widget registry + contracts | P2 schema | 8 types typed config+schema | schema |
| 8 MVP widgets | registry | each renders in preview | visual/unit |
| Studio canvas drag/resize/snap/align/z | widgets | no pixel-accuracy regression | manual |
| Inspector (binding/type/threshold/color) | canvas | live preview updates | manual |
| Keyboard shortcuts + undo/redo | canvas | 10-level undo all ops | manual |
| Profile save/load/import/export | schema | JSON round-trips + validates | unit |
| Schema migration harness v1→ | schema | migration test w/ v1 fixture | unit |
| Simulated telemetry in Studio | — | usable without ProbeHost | integration |
| Preview == physical output | renderer | screenshot hash matches hw | golden |

### Phase 4
| Task | Dep | DoD | Test |
|---|---|---|---|
| Independent provider poll rates | P2 | each configurable | unit |
| Per-widget refresh policy | widgets | high-rate widget no full redraw | unit |
| Frame scheduler + rate limit + skip counters | renderer | telemetry in diagnostics | integration |
| Dirty-region updates | P0 dirty-region proof | benchmark shows gain or disabled | benchmark |
| Performance/quiet mode | scheduler | CPU/mem recorded | benchmark |

### Phase 5
| Task | Dep | DoD | Test |
|---|---|---|---|
| Claude OTel wizard (opt-in, metrics only) | P3 | local OTEL endpoint, no log/trace path | manual |
| Aggregate token/cost/session daily | OTel | correct totals for test session | integration |
| Audit: no prompt/code/tool content exits | wizard | documented audit of emitted data | manual audit |
| Codex stub: Unavailable | P3 | renders unavailable, no error | unit |
| Codex official-source research | — | result documented; implement only if stable | research |

### Phase 6
| Task | Dep | DoD | Test |
|---|---|---|---|
| Installer or portable ZIP | P5 | fresh install + driver guidance | manual |
| Autostart toggle | tray | registry set/cleared | integration |
| Profile backup/restore | P3 | restore after simulated corruption | integration |
| Crash-safe logs + secret redaction | logger | exported diagnostics secret-free | manual audit |
| Device compatibility report export | P0 doc | matches device-compatibility.md | unit |
| CI: lint/typecheck/unit/schema/build | all | passes on clean clone | CI |
| Dependency/security scan | all | no known CVE shipped | CI |
| Manual hardware regression checklist | all | committed to docs | manual |

## First implementation slice (after Phase 0 data)

**Slice 1A — engine scaffold + driver port.** Create the Electron + TypeScript `apps/engine` scaffold and monorepo workspaces; port the verified Phase 0 protocol (`scripts/phase0/ax206_testframe.py`) to a TS `node-usb` driver module; drive one solid test frame to the panel from the engine.
**Acceptance:** `npm run build` green; `apps/engine` pushes a red frame to the panel via node-usb (parity with the Python tool), CSW status 0; demo-mode flag bypasses USB.
**Blocked on:** nothing — Phase 0 unblocked it.

## Need from owner before Phase 0

1. Panel brand/label + purchase link.
2. `Get-PnpDevice` output for the panel (or Device Manager screenshot).
3. USBView/USBPcap capture if already done.
4. AIDA64 edition (Extreme/Engineer/Business).
5. Wireshark + USBPcap installed? Y/N.
