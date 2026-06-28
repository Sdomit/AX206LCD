import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTelemetryFrame } from './dashboard';
import { rgb565 } from '../driver/rgb565';
import type { TelemetrySnapshot } from '../telemetry/snapshot';

const W = 480;
const H = 320;

function snap(cpuLoad: number | null): TelemetrySnapshot {
  return {
    schemaVersion: 1,
    generatedAt: '',
    cpu: {
      tempC: { value: null, quality: 'unavailable', source: 't' },
      loadPercent: { value: cpuLoad, unit: '%', quality: cpuLoad === null ? 'unavailable' : 'ok', source: 't' },
    },
    memory: {
      usedMiB: { value: 1, unit: 'MiB', quality: 'ok', source: 't' },
      totalMiB: { value: 2, unit: 'MiB', quality: 'ok', source: 't' },
      loadPercent: { value: 50, unit: '%', quality: 'ok', source: 't' },
    },
  };
}

function px(buf: Buffer, x: number, y: number): [number, number] {
  const i = (y * W + x) * 2;
  return [buf[i], buf[i + 1]];
}

test('frame is exactly w*h*2 bytes', () => {
  assert.equal(buildTelemetryFrame(W, H, snap(100), false).length, W * H * 2);
});

test('100% CPU load fills the bar with the high-load (red) color', () => {
  const f = buildTelemetryFrame(W, H, snap(100), false);
  assert.deepEqual(px(f, 40, 100), rgb565(255, 60, 60));
});

test('null CPU load leaves the track empty (no fake 0% fill)', () => {
  const f = buildTelemetryFrame(W, H, snap(null), false);
  assert.deepEqual(px(f, 200, 100), rgb565(30, 38, 54)); // track color past the marker
});

test('stale data paints a red strip at the top', () => {
  const f = buildTelemetryFrame(W, H, snap(50), true);
  assert.deepEqual(px(f, 100, 2), rgb565(255, 60, 60));
});
