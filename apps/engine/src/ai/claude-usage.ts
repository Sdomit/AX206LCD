// Claude Code usage provider. Reads the user's OWN local Claude Code session logs
// (~/.claude/projects/**/*.jsonl) and sums token usage in a rolling window. Token
// counts and timestamps ONLY — never prompt/response content. Local-only; no network.
// The 5h limit is NOT officially exposed, so it is user-configured (env
// CLAUDE_5H_TOKEN_LIMIT); without it we show usage but no progress bar (no fake precision).
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

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
    usedTokens +=
      (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
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
  const limit = opts.limit ?? (Number.isFinite(envLimit) ? envLimit : null);
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
