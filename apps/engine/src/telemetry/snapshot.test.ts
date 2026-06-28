import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot } from './snapshot';

const ok = (value: number | null, unit: string) => ({ value, unit, quality: value === null ? 'unavailable' : 'ok', source: 'LHM' });
const GOOD = JSON.stringify({
  schemaVersion: 2,
  generatedAt: '2026-06-28T00:00:00.000Z',
  cpu: { tempC: ok(null, 'C'), loadPercent: ok(42.5, '%') },
  gpu: { tempC: ok(61, 'C'), loadPercent: ok(70, '%') },
  memory: { usedMiB: ok(8000, 'MiB'), totalMiB: ok(32000, 'MiB'), loadPercent: ok(25, '%') },
  storage: { tempC: ok(44, 'C'), usedPercent: ok(63, '%') },
  network: { downBps: ok(24_500_000, 'B/s'), upBps: ok(3_100_000, 'B/s') },
});

test('parses a valid v2 snapshot and preserves null (not zero)', () => {
  const s = parseSnapshot(GOOD);
  assert.ok(s);
  assert.equal(s!.cpu.loadPercent.value, 42.5);
  assert.equal(s!.cpu.tempC.value, null);
  assert.equal(s!.gpu.tempC.value, 61);
  assert.equal(s!.network.downBps.value, 24_500_000);
});

test('rejects malformed JSON', () => {
  assert.equal(parseSnapshot('{not json'), null);
});

test('rejects an old schemaVersion (1)', () => {
  assert.equal(parseSnapshot(JSON.stringify({ schemaVersion: 1, generatedAt: 'x', cpu: {}, memory: {} })), null);
});

test('rejects a snapshot missing a section', () => {
  assert.equal(
    parseSnapshot(JSON.stringify({ schemaVersion: 2, generatedAt: 'x', cpu: { tempC: ok(1, 'C'), loadPercent: ok(1, '%') }, memory: {} })),
    null,
  );
});
