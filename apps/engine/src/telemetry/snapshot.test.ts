import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot } from './snapshot';

const GOOD = JSON.stringify({
  schemaVersion: 1,
  generatedAt: '2026-06-28T00:00:00.000Z',
  cpu: {
    tempC: { value: null, unit: 'C', quality: 'unavailable', source: 'LHM' },
    loadPercent: { value: 42.5, unit: '%', quality: 'ok', source: 'LHM' },
  },
  memory: {
    usedMiB: { value: 8000, unit: 'MiB', quality: 'ok', source: 'LHM' },
    totalMiB: { value: 32000, unit: 'MiB', quality: 'ok', source: 'LHM' },
    loadPercent: { value: 25, unit: '%', quality: 'ok', source: 'LHM' },
  },
});

test('parses a valid snapshot and preserves null (not zero)', () => {
  const s = parseSnapshot(GOOD);
  assert.ok(s);
  assert.equal(s!.cpu.loadPercent.value, 42.5);
  assert.equal(s!.cpu.tempC.value, null);
  assert.equal(s!.cpu.tempC.quality, 'unavailable');
});

test('rejects malformed JSON', () => {
  assert.equal(parseSnapshot('{not json'), null);
});

test('rejects a wrong schemaVersion', () => {
  assert.equal(parseSnapshot(JSON.stringify({ schemaVersion: 2, generatedAt: 'x', cpu: {}, memory: {} })), null);
});

test('rejects missing sections', () => {
  assert.equal(parseSnapshot(JSON.stringify({ schemaVersion: 1, generatedAt: 'x' })), null);
});
