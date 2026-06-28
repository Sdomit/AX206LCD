import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProbeHost } from './probehost';

const ok = (value: number | null, unit: string) => ({ value, unit, quality: value === null ? 'unavailable' : 'ok', source: 'LHM' });
const GOOD = JSON.stringify({
  schemaVersion: 2,
  generatedAt: '2026-06-28T00:00:00.000Z',
  cpu: { tempC: ok(55, 'C'), loadPercent: ok(10, '%') },
  gpu: { tempC: ok(60, 'C'), loadPercent: ok(40, '%') },
  memory: { usedMiB: ok(8000, 'MiB'), totalMiB: ok(32000, 'MiB'), loadPercent: ok(25, '%') },
  storage: { tempC: ok(44, 'C'), usedPercent: ok(63, '%') },
  network: { downBps: ok(1000, 'B/s'), upBps: ok(500, 'B/s') },
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
