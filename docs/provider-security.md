# Provider Security & Privacy

Local-first by default. No account login for PC monitoring. No external server for the normal dashboard.

## Core rules

1. No browser-cookie reading, dashboard scraping, or session-token extraction. Ever.
2. Do not log raw AI prompts, code, or source paths unless the user explicitly enables debug capture.
3. Never run permanently elevated. Request elevation only for a narrowly justified sensor feature, with an explanation of which sensor needs it.
4. Bind any local dev server to loopback (`127.0.0.1`) only, with origin checks or a short-lived token.
5. Store settings under `%APPDATA%\OrbitPanel`, not Program Files. Atomic writes + profile backups.
6. USB operations isolated: a malformed frame or dropped device must never crash the editor.
7. No plaintext provider credentials. No credential/cookie storage or access by OrbitPanel.
8. A visible **Data Sources** page lists every enabled provider and exactly what it collects.

## Claude Code provider — supported

**Metrics only**, opt-in via setup wizard. Default: off.

Allowed (aggregate, local):
- Current/last session state.
- Tokens today (input/output/cache when available).
- Approximate cost today (labeled approximate, as upstream does).
- Sessions today; active/last activity; current/last model.

Forbidden in default setup: logs, traces, prompt capture, tool-input capture, source-code capture, prompt-content collection.

Implementation notes:
- Prefer a local OpenTelemetry path; store daily aggregates in `%APPDATA%\OrbitPanel\metrics\`.
- **Verify before shipping**: confirm the OTEL exporter Claude Code ships does not emit span attributes containing tool input or source paths when traces are disabled. Read the actual exporter config.
- Handle telemetry-disabled / unavailable gracefully.

## Codex provider — experimental, feature-flagged

Default: `codex_provider_enabled = false`. Requires explicit user toggle.

Allowed sources only:
- Documented local Codex CLI status/usage output **if** machine-readable and stable.
- User-provided manual usage value / reset time.
- An official documented API/OAuth endpoint the user explicitly configures.

Not allowed: browser dashboard scraping, cookie/token reading, plaintext credential storage, features built on undocumented endpoints.

If exact remaining quota cannot be obtained safely and reliably: show `Unavailable — source not configured`. Do not fake precision. As of 2026-06, no confirmed safe official local source — ship the unavailable stub.

## Data Sources page (spec)

For each provider show: enabled state, data collected, storage location, on/off toggle. Include a **Copy diagnostics** command that redacts secrets before writing to clipboard.

## What must remain opt-in

- Claude metrics collection (wizard).
- Any debug capture of prompts/paths.
- Codex provider entirely.
- Admin elevation for specific sensors.
