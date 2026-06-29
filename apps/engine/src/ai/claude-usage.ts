// Claude Code usage provider. Reads the user's OWN local Claude Code session logs
// (~/.claude/projects/**/*.jsonl) and sums token usage in a rolling window. Token
// counts and timestamps ONLY — never prompt/response content. Local-only; no network.
// The 5h limit is NOT officially exposed, so it is user-configured (env
// CLAUDE_5H_TOKEN_LIMIT); without it we show usage but no progress bar (no fake precision).
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

// Claude's 5h cap is not exposed in logs, so the bar needs a reference cap. This editable
// estimate (billable tokens, see aggregate) lets the bar render out of the box; override with
// CLAUDE_5H_TOKEN_LIMIT to match your plan exactly. Not a measured value — a display reference.
export const DEFAULT_CLAUDE_5H_LIMIT = 88_000_000;

export interface ClaudeUsage {
  usedTokens: number;
  limit: number | null;
  windowMs: number;
  samples: number;
}

// Pure: sum tokens from JSONL lines whose timestamp is within [now-windowMs, now].
export function aggregate(lines: Iterable<string>, nowMs: number, windowMs: number): { usedTokens: number; samples: number } {
  let usedTokens = 0;
  let samples = 0;
  const cutoff = nowMs - windowMs;
  for (const line of lines) {
    if (!line.includes('"usage"')) continue;
    let o: { timestamp?: unknown; usage?: Record<string, number>; message?: { usage?: Record<string, number> } };
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    const ts = typeof o.timestamp === 'string' ? Date.parse(o.timestamp) : NaN;
    if (!Number.isFinite(ts) || ts < cutoff || ts > nowMs) continue;
    const u = o.message?.usage ?? o.usage;
    if (!u) continue;
    // Billable tokens only. cache_read is a cache HIT (≈0.1x cost) and dominates the raw sum
    // ~10x, which would peg any plan-cap bar — exclude it so the count tracks real consumption.
    // ponytail: flat exclude, not the exact 0.1x weight Anthropic uses — close enough for a bar.
    usedTokens += (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0);
    samples++;
  }
  return { usedTokens, samples };
}

export function readClaudeUsage(
  opts: { nowMs?: number; windowMs?: number; homeDir?: string; limit?: number | null } = {},
): ClaudeUsage {
  const nowMs = opts.nowMs ?? Date.now();
  const windowMs = opts.windowMs ?? FIVE_HOURS_MS;
  const envLimit = process.env.CLAUDE_5H_TOKEN_LIMIT ? Number(process.env.CLAUDE_5H_TOKEN_LIMIT) : NaN;
  const limit = opts.limit ?? (Number.isFinite(envLimit) ? envLimit : DEFAULT_CLAUDE_5H_LIMIT);
  const base = join(opts.homeDir ?? homedir(), '.claude', 'projects');

  let usedTokens = 0;
  let samples = 0;
  try {
    for (const proj of readdirSync(base, { withFileTypes: true })) {
      if (!proj.isDirectory()) continue;
      const dir = join(base, proj.name);
      let files: string[];
      try {
        files = readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
      } catch {
        continue;
      }
      for (const f of files) {
        const fp = join(dir, f);
        try {
          if (statSync(fp).mtimeMs < nowMs - windowMs) continue; // untouched within window
          const r = aggregate(readFileSync(fp, 'utf8').split('\n'), nowMs, windowMs);
          usedTokens += r.usedTokens;
          samples += r.samples;
        } catch {
          // unreadable file — skip
        }
      }
    }
  } catch {
    // base dir missing — Claude Code not installed / no logs
  }
  return { usedTokens, limit, windowMs, samples };
}
