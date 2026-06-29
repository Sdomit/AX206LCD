// Resolve a telemetry binding path (e.g. "cpu.loadPercent") to a Metric, plus value
// formatting. Shared by widgets so engine + Studio format identically.
import type { Metric, TelemetrySnapshot } from '../telemetry/snapshot';

// One AI provider's usage line. `available` false → render an honest "--" (never zero);
// `limit` null → show the count without a progress bar (no fake precision).
export interface AiLine {
  used: number;
  limit: number | null;
  available: boolean;
  state?: string;
}

export interface RenderCtx {
  timeStr: string;
  uptimeStr: string;
  panelState: string;
  ai?: { claude: AiLine; codex: AiLine };
}

export interface RenderEnv {
  snapshot: TelemetrySnapshot | null;
  stale: boolean;
  ctx: RenderCtx;
}

export function getMetric(snap: TelemetrySnapshot | null, path: string): Metric<number> | null {
  if (!snap) return null;
  const [group, field] = path.split('.');
  const g = (snap as unknown as Record<string, Record<string, Metric<number>>>)[group];
  return g?.[field] ?? null;
}

// 'mbps' is a deprecated alias for 'rate', kept so saved profiles authored against the
// old default still render (it now scales the same way, not fixed MB/s).
export type Format = 'int' | 'temp' | 'pct' | 'gib' | 'rate' | 'mbps';

// Auto-scaling byte-rate (input is B/s). Fixed MB/s read 0.0 for all normal traffic, so
// scale the unit instead: bytes → K → M, bytes implied. e.g. 235 KB/s → "235K",
// 4.2 MB/s → "4.2M", idle → "0".
export function fmtRate(bps: number): string {
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)}M`;
  if (bps >= 1e3) return `${Math.round(bps / 1e3)}K`;
  return String(Math.round(bps));
}

export function formatMetric(m: Metric<number> | null, fmt: Format): string {
  if (!m || m.value === null) {
    return fmt === 'temp' ? '-- °C' : fmt === 'pct' ? '--%' : '--';
  }
  switch (fmt) {
    case 'int':
      return String(Math.round(m.value));
    case 'temp':
      return `${Math.round(m.value)}°C`;
    case 'pct':
      return `${Math.round(m.value)}%`;
    case 'gib':
      return (m.value / 1024).toFixed(1);
    case 'rate':
    case 'mbps':
      return fmtRate(m.value);
    default:
      // Unknown format from a forward-authored or corrupt profile — fail honest, not a crash.
      return '--';
  }
}

export function fmtTokens(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(Math.round(n));
}
