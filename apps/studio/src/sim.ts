import type { Metric, TelemetrySnapshot } from '@engine/telemetry/snapshot';

const m = (value: number | null, unit: string): Metric<number> => ({
  value,
  unit,
  quality: value === null ? 'unavailable' : 'ok',
  source: 'sim',
});

// Simulated telemetry so Studio is usable with no panel/ProbeHost connected.
export function simSnapshot(t: number): TelemetrySnapshot {
  const cpu = Math.round(50 + 40 * Math.sin(t / 3));
  const gpu = Math.round(45 + 35 * Math.sin(t / 4 + 1));
  return {
    schemaVersion: 2,
    generatedAt: '',
    cpu: { tempC: m(58, 'C'), loadPercent: m(cpu, '%') },
    gpu: { tempC: m(64, 'C'), loadPercent: m(gpu, '%') },
    memory: { usedMiB: m(18000, 'MiB'), totalMiB: m(32768, 'MiB'), loadPercent: m(55, '%') },
    storage: { tempC: m(41, 'C'), usedPercent: m(63, '%') },
    network: { downBps: m(24e6, 'B/s'), upBps: m(3e6, 'B/s') },
  };
}
