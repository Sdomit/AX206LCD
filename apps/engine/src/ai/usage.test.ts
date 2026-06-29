import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregate, FIVE_HOURS_MS } from './claude-usage';
import { readCodexUsage } from './codex-usage';

const line = (tsIso: string, out: number): string =>
  JSON.stringify({
    timestamp: tsIso,
    message: { usage: { input_tokens: 1, output_tokens: out, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } },
  });

test('aggregate sums tokens within the window, ignoring old lines and garbage', () => {
  const now = Date.parse('2026-06-28T12:00:00Z');
  const lines = [
    line('2026-06-28T11:30:00Z', 100), // in window -> 1 + 100
    line('2026-06-28T05:00:00Z', 999), // 7h old -> excluded
    'not json',
    JSON.stringify({ timestamp: '2026-06-28T11:45:00Z', message: {} }), // no usage
  ];
  const r = aggregate(lines, now, FIVE_HOURS_MS);
  assert.equal(r.samples, 1);
  assert.equal(r.usedTokens, 101);
});

test('aggregate ignores future-dated lines', () => {
  const now = Date.parse('2026-06-28T12:00:00Z');
  const r = aggregate([line('2026-06-28T13:00:00Z', 50)], now, FIVE_HOURS_MS);
  assert.equal(r.samples, 0);
});

test('codex usage is unavailable (no safe local source)', () => {
  assert.equal(readCodexUsage().available, false);
});
