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
// Returns null if the object has no recognizable token fields.
function tokensFromUsage(u: Record<string, unknown> | undefined): number | null {
  if (!u || typeof u !== 'object') return null;
  const n = (k: string): number => (typeof u[k] === 'number' ? (u[k] as number) : 0);
  if (typeof u.total_tokens === 'number') return u.total_tokens;
  const inOut = n('input_tokens') + n('output_tokens');
  if (inOut > 0) return inOut;
  const promptCompletion = n('prompt_tokens') + n('completion_tokens');
  if (promptCompletion > 0) return promptCompletion;
  return null;
}

// Pure: sum per-response token usage from JSONL lines whose timestamp is within
// [now-windowMs, now]. Per-response (not cumulative) usage objects only, so summing is
// correct. Lines without a timestamp or a recognizable usage object are skipped.
export function aggregateCodex(
  lines: Iterable<string>,
  nowMs: number,
  windowMs: number,
): { usedTokens: number; samples: number } {
  let usedTokens = 0;
  let samples = 0;
  const cutoff = nowMs - windowMs;
  for (const line of lines) {
    if (!line.includes('usage') && !line.includes('token')) continue;
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
    const usage =
      (o.usage as Record<string, unknown>) ??
      (msg?.usage as Record<string, unknown>) ??
      (resp?.usage as Record<string, unknown>);
    const t = tokensFromUsage(usage);
    if (t === null) continue;
    usedTokens += t;
    samples++;
  }
  return { usedTokens, samples };
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
  const limit = opts.limit ?? (Number.isFinite(envLimit) ? envLimit : null);
  const base = join(opts.homeDir ?? homedir(), '.codex', 'sessions');

  const files = recentJsonl(base, nowMs - windowMs);
  if (files.length === 0) {
    return { available: false, usedTokens: 0, limit, windowMs, samples: 0, state: 'source not configured' };
  }

  let usedTokens = 0;
  let samples = 0;
  for (const fp of files) {
    try {
      const r = aggregateCodex(readFileSync(fp, 'utf8').split('\n'), nowMs, windowMs);
      usedTokens += r.usedTokens;
      samples += r.samples;
    } catch {
      // unreadable file — skip
    }
  }
  if (samples === 0) {
    return { available: false, usedTokens: 0, limit, windowMs, samples: 0, state: 'no token records' };
  }
  return { available: true, usedTokens, limit, windowMs, samples, state: 'ok' };
}
