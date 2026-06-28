// Telemetry snapshot contract (v1) shared with ProbeHost. null (never zero) = unavailable;
// every metric carries quality + source. Mirrors apps/probehost/Program.cs output.
export type Quality = 'ok' | 'stale' | 'unavailable' | 'error';

export interface Metric<T> {
  value: T | null;
  unit?: string;
  quality: Quality;
  source: string;
}

export interface TelemetrySnapshot {
  schemaVersion: 1;
  generatedAt: string;
  cpu: {
    tempC: Metric<number>;
    loadPercent: Metric<number>;
  };
  memory: {
    usedMiB: Metric<number>;
    totalMiB: Metric<number>;
    loadPercent: Metric<number>;
  };
}

function isMetric(m: unknown): boolean {
  return !!m && typeof m === 'object' && 'value' in m && 'quality' in m;
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
  if (r.schemaVersion !== 1 || typeof r.generatedAt !== 'string') return null;
  const cpu = r.cpu as Record<string, unknown> | undefined;
  const mem = r.memory as Record<string, unknown> | undefined;
  if (!cpu || !mem) return null;
  if (!isMetric(cpu.tempC) || !isMetric(cpu.loadPercent)) return null;
  if (!isMetric(mem.usedMiB) || !isMetric(mem.totalMiB) || !isMetric(mem.loadPercent)) return null;
  return o as TelemetrySnapshot;
}
