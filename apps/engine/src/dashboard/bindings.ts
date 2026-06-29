// Resolve a telemetry binding path (e.g. "cpu.loadPercent") to a Metric, plus value
// formatting. Shared by widgets so engine + Studio format identically.
import type { Metric, TelemetrySnapshot } from '../telemetry/snapshot';

export interface RenderCtx {
  timeStr: string;
  uptimeStr: string;
  panelState: string;
  ai?: { claudeUsed: number; claudeLimit: number | null; codexState: string };
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

export type Format = 'int' | 'temp' | 'pct' | 'gib' | 'mbps';

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
    case 'mbps':
      return (m.value / 1e6).toFixed(1);
  }
}

export function fmtTokens(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(Math.round(n));
}
