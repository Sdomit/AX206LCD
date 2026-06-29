import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregate, FIVE_HOURS_MS } from './claude-usage';
import { readCodexUsage, aggregateCodex } from './codex-usage';

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

test('codex usage is unavailable when no local logs exist', () => {
  // Point at a homeDir with no ~/.codex/sessions — must report unavailable, never a fake 0.
  const u = readCodexUsage({ homeDir: '/nonexistent-home-for-test' });
  assert.equal(u.available, false);
  assert.equal(u.usedTokens, 0);
});

test('aggregateCodex sums per-response usage in window, tolerant of field shapes', () => {
  const now = Date.parse('2026-06-28T12:00:00Z');
  const lines = [
    JSON.stringify({ timestamp: '2026-06-28T11:30:00Z', usage: { input_tokens: 10, output_tokens: 5 } }), // 15
    JSON.stringify({ timestamp: '2026-06-28T11:40:00Z', response: { usage: { total_tokens: 7 } } }), // 7
    JSON.stringify({ timestamp: '2026-06-28T11:45:00Z', message: { usage: { prompt_tokens: 3, completion_tokens: 2 } } }), // 5
    JSON.stringify({ timestamp: '2026-06-28T05:00:00Z', usage: { input_tokens: 999, output_tokens: 1 } }), // 7h old -> excluded
    JSON.stringify({ timestamp: '2026-06-28T11:50:00Z', message: {} }), // no usage -> skipped
    'not json',
  ];
  const r = aggregateCodex(lines, now, FIVE_HOURS_MS);
  assert.equal(r.samples, 3);
  assert.equal(r.usedTokens, 27);
});

test('aggregateCodex reads the real Codex token_count event shape', () => {
  const now = Date.parse('2026-06-28T12:00:00Z');
  const ev = (ts: string, last: number, total: number, pct?: number): string =>
    JSON.stringify({
      timestamp: ts,
      type: 'event_msg',
      payload: {
        type: 'token_count',
        info: { last_token_usage: { total_tokens: last }, total_token_usage: { total_tokens: total } },
        ...(pct !== undefined ? { rate_limits: { primary: { used_percent: pct, window_minutes: 300 } } } : {}),
      },
    });
  const lines = [ev('2026-06-28T11:30:00Z', 100, 100, 40), ev('2026-06-28T11:45:00Z', 50, 150, 59)];
  const r = aggregateCodex(lines, now, FIVE_HOURS_MS);
  assert.equal(r.samples, 2);
  assert.equal(r.usedTokens, 150); // sums per-response last_token_usage, NOT cumulative total
  assert.equal(r.usedPercent, 59); // latest reading wins (not the earlier 40)
});

test('aggregateCodex excludes cached input tokens from the count', () => {
  const now = Date.parse('2026-06-28T12:00:00Z');
  // total_tokens 100 but 94 are cached -> only 6 real tokens counted.
  const line = JSON.stringify({
    timestamp: '2026-06-28T11:30:00Z',
    payload: { type: 'token_count', info: { last_token_usage: { total_tokens: 100, cached_input_tokens: 94 } } },
  });
  assert.equal(aggregateCodex([line], now, FIVE_HOURS_MS).usedTokens, 6);
});
