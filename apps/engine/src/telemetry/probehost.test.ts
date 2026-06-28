import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProbeHost } from './probehost';

const GOOD = JSON.stringify({
  schemaVersion: 1,
  generatedAt: '2026-06-28T00:00:00.000Z',
  cpu: {
    tempC: { value: 55, unit: 'C', quality: 'ok', source: 'LHM' },
    loadPercent: { value: 10, unit: '%', quality: 'ok', source: 'LHM' },
  },
  memory: {
    usedMiB: { value: 8000, unit: 'MiB', quality: 'ok', source: 'LHM' },
    totalMiB: { value: 32000, unit: 'MiB', quality: 'ok', source: 'LHM' },
    loadPercent: { value: 25, unit: '%', quality: 'ok', source: 'LHM' },
  },
});

test('ingest emits parsed snapshots and ignores garbage', () => {
  const ph = new ProbeHost({ staleMs: 1000 });
  let snapshots = 0;
  let badlines = 0;
  ph.on('snapshot', () => snapshots++);
  ph.on('badline', () => badlines++);

  ph.ingest(GOOD, 1000);
  ph.ingest('not json at all', 1000);
  ph.ingest('', 1000); // blank line ignored silently

  assert.equal(snapshots, 1);
  assert.equal(badlines, 1);
});

test('latest reports staleness against the injected clock', () => {
  const ph = new ProbeHost({ staleMs: 1000 });
  assert.equal(ph.latest(0).stale, true); // nothing yet
  ph.ingest(GOOD, 1000);
  assert.equal(ph.latest(1500).stale, false);
  assert.equal(ph.latest(2500).stale, true);
});
