// Codex usage provider. Reads the user's OWN local Codex CLI session logs
// (~/.codex/sessions/**/*.jsonl) and sums per-response token usage in a rolling window —
// the same consent model as the Claude provider (local-only, token counts + timestamps
// ONLY, never prompt/response content). Browser-dashboard scraping and cookie/token
// reading remain forbidden by project policy.
//
// Honesty: we only report `available: true` when we actually find token-usage records in a
// known-safe per-response shape. If the directory is missing or no usage is found, we report
// unavailable (never a fake zero). The exact on-disk Codex format may vary by CLI version;
// the parser below is tolerant of the common OpenAI usage shapes and degrades to unavailable
// rather than guessing.
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

export interface CodexUsage {
  available: boolean;
  usedTokens: number;
  limit: number | null;
  windowMs: number;
  samples: number;
  state: string;
}

// Pull a token count out of an OpenAI-style usage object, tolerant of field naming.
// Excludes cached input (cache hits, ~0 cost) — for Codex that's ~94% of the raw total, so
// counting it makes the displayed number ~15x too high. Returns null if no recognizable fields.
function tokensFromUsage(u: Record<string, unknown> | undefined): number | null {
  if (!u || typeof u !== 'object') return null;
  const n = (k: string): number => (typeof u[k] === 'number' ? (u[k] as number) : 0);
  const cached = n('cached_input_tokens') + n('cache_read_input_tokens');
  if (typeof u.total_tokens === 'number') return Math.max(0, u.total_tokens - cached);
  const inOut = n('input_tokens') + n('output_tokens');
  if (inOut > 0) return Math.max(0, inOut - cached);
  const promptCompletion = n('prompt_tokens') + n('completion_tokens');
  if (promptCompletion > 0) return promptCompletion;
  return null;
}

export interface CodexAgg {
  usedTokens: number;
  samples: number;
  // Codex's OWN reported usage of the rolling 5h window (rate_limits.primary.used_percent),
  // from the most recent token_count event in range. null if no such field was seen.
  usedPercent: number | null;
  percentTs: number; // timestamp of that percent reading, so callers can keep the latest across files
}

// Pure: sum per-response token usage from JSONL lines whose timestamp is within
// [now-windowMs, now]. Per-response (not cumulative) usage objects only, so summing is
// correct. Lines without a timestamp or a recognizable usage object are skipped.
export function aggregateCodex(lines: Iterable<string>, nowMs: number, windowMs: number): CodexAgg {
  let usedTokens = 0;
  let samples = 0;
  let usedPercent: number | null = null;
  let percentTs = -Infinity;
  const cutoff = nowMs - windowMs;
  for (const line of lines) {
    if (!line.includes('usage') && !line.includes('token') && !line.includes('rate_limit')) continue;
    let o: Record<string, unknown>;
    try {
      o = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    const tsRaw = (o.timestamp ?? o.ts ?? o.time) as unknown;
    const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : typeof tsRaw === 'number' ? tsRaw : NaN;
    if (!Number.isFinite(ts) || ts < cutoff || ts > nowMs) continue;
    const msg = o.message as Record<string, unknown> | undefined;
    const resp = o.response as Record<string, unknown> | undefined;
    // Codex CLI/desktop shape: {payload:{type:'token_count',info:{last_token_usage:{...}},rate_limits:{...}}}.
    const payload = o.payload as Record<string, unknown> | undefined;
    const info = payload?.info as Record<string, unknown> | undefined;
    // Capture Codex's own window-usage percent (the primary/5h limit), latest reading wins.
    const primary = (payload?.rate_limits as Record<string, unknown> | undefined)?.primary as
      | Record<string, unknown>
      | undefined;
    if (primary && typeof primary.used_percent === 'number' && ts >= percentTs) {
      percentTs = ts;
      usedPercent = primary.used_percent;
    }
    // last_token_usage is the per-response delta (total_token_usage is cumulative — never sum that).
    const usage =
      (o.usage as Record<string, unknown>) ??
      (msg?.usage as Record<string, unknown>) ??
      (resp?.usage as Record<string, unknown>) ??
      (info?.last_token_usage as Record<string, unknown>);
    const t = tokensFromUsage(usage);
    if (t === null) continue;
    usedTokens += t;
    samples++;
  }
  return { usedTokens, samples, usedPercent, percentTs };
}

// Recursively collect *.jsonl files under dir whose mtime is within the window.
function recentJsonl(dir: string, sinceMs: number): string[] {
  const out: string[] = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    try {
      if (e.isDirectory()) out.push(...recentJsonl(p, sinceMs));
      else if (e.name.endsWith('.jsonl') && statSync(p).mtimeMs >= sinceMs) out.push(p);
    } catch {
      // unreadable entry — skip
    }
  }
  return out;
}

export function readCodexUsage(
  opts: { nowMs?: number; windowMs?: number; homeDir?: string; limit?: number | null } = {},
): CodexUsage {
  const nowMs = opts.nowMs ?? Date.now();
  const windowMs = opts.windowMs ?? FIVE_HOURS_MS;
  const envLimit = process.env.CODEX_TOKEN_LIMIT ? Number(process.env.CODEX_TOKEN_LIMIT) : NaN;
  let limit = opts.limit ?? (Number.isFinite(envLimit) ? envLimit : null);
  const base = join(opts.homeDir ?? homedir(), '.codex', 'sessions');

  const files = recentJsonl(base, nowMs - windowMs);
  if (files.length === 0) {
    return { available: false, usedTokens: 0, limit, windowMs, samples: 0, state: 'source not configured' };
  }

  let usedTokens = 0;
  let samples = 0;
  let usedPercent: number | null = null;
  let percentTs = -Infinity;
  for (const fp of files) {
    try {
      const r = aggregateCodex(readFileSync(fp, 'utf8').split('\n'), nowMs, windowMs);
      usedTokens += r.usedTokens;
      samples += r.samples;
      if (r.usedPercent !== null && r.percentTs >= percentTs) {
        percentTs = r.percentTs;
        usedPercent = r.usedPercent;
      }
    } catch {
      // unreadable file — skip
    }
  }
  if (samples === 0) {
    return { available: false, usedTokens: 0, limit, windowMs, samples: 0, state: 'no token records' };
  }
  // No env override? Reconstruct an implied cap from Codex's own reported window percent so the
  // existing used/limit bar renders Codex's real %: frac = used / (used / pct) = pct exactly.
  // The token COUNT shown stays our real window sum; only the cap is reconstructed.
  if (limit === null && usedPercent !== null && usedPercent > 0 && usedTokens > 0) {
    limit = Math.round(usedTokens / (usedPercent / 100));
  }
  return { available: true, usedTokens, limit, windowMs, samples, state: 'ok' };
}
