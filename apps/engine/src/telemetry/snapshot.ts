// Telemetry snapshot contract (v2) shared with ProbeHost. null (never zero) = unavailable;
// every metric carries quality + source. Mirrors apps/probehost/Program.cs output.
export type Quality = 'ok' | 'stale' | 'unavailable' | 'error';

export interface Metric<T> {
  value: T | null;
  unit?: string;
  quality: Quality;
  source: string;
}

export interface TelemetrySnapshot {
  schemaVersion: 2;
  generatedAt: string;
  cpu: { tempC: Metric<number>; loadPercent: Metric<number> };
  gpu: { tempC: Metric<number>; loadPercent: Metric<number> };
  memory: { usedMiB: Metric<number>; totalMiB: Metric<number>; loadPercent: Metric<number> };
  storage: { tempC: Metric<number>; usedPercent: Metric<number> };
  network: { downBps: Metric<number>; upBps: Metric<number> };
}

function isMetric(m: unknown): boolean {
  return !!m && typeof m === 'object' && 'value' in m && 'quality' in m;
}

function group(o: Record<string, unknown>, key: string, fields: string[]): boolean {
  const g = o[key] as Record<string, unknown> | undefined;
  if (!g) return false;
  return fields.every((f) => isMetric(g[f]));
}

// Parse one JSON-Lines record. Returns null for malformed input or a schemaVersion mismatch
// (caller logs/ignores); never throws.
export function parseSnapshot(line: string): TelemetrySnapshot | null {
  let o: unknown;
  try {
    o = JSON.parse(line);
  } catch {
    return null;
  }
  if (!o || typeof o !== 'object') return null;
  const r = o as Record<string, unknown>;
  if (r.schemaVersion !== 2 || typeof r.generatedAt !== 'string') return null;
  if (!group(r, 'cpu', ['tempC', 'loadPercent'])) return null;
  if (!group(r, 'gpu', ['tempC', 'loadPercent'])) return null;
  if (!group(r, 'memory', ['usedMiB', 'totalMiB', 'loadPercent'])) return null;
  if (!group(r, 'storage', ['tempC', 'usedPercent'])) return null;
  if (!group(r, 'network', ['downBps', 'upBps'])) return null;
  return o as TelemetrySnapshot;
}
