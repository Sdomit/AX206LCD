// Codex log inspector — a privacy-safe diagnostic for verifying (or fixing) the Codex usage
// provider against real local data. It locates ~/.codex logs, reports where token-usage
// records live and their shape, and prints what readCodexUsage currently computes.
//
// PRIVACY: it never prints prompt/response content. Every string value is redacted to its
// length (e.g. "<str:1234>"); only numbers (token counts), booleans, and KEY NAMES are
// shown. The output is safe to paste back so the parser can be matched to your format.
//
// Usage: npm run codex-inspect [-- --home=/path/to/home] [-- --window-hours=120]
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readCodexUsage } from './ai/codex-usage';

const MAX_FILES = 40;
const MAX_LINES = 8000;
const MAX_EXAMPLES = 8;

function arg(name: string): string | undefined {
  const p = process.argv.find((a) => a.startsWith(`--${name}=`));
  return p ? p.split('=')[1] : undefined;
}

function walkJsonl(dir: string, out: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (out.length >= MAX_FILES) return;
    const p = join(dir, e.name);
    try {
      if (e.isDirectory()) walkJsonl(p, out);
      else if (e.name.endsWith('.jsonl')) out.push(p);
    } catch {
      // skip
    }
  }
}

// Deep-redact: strings -> "<str:len>", keep numbers/booleans/null, cap depth/breadth.
function redact(v: unknown, depth = 0): unknown {
  if (depth > 6) return '<…>';
  if (typeof v === 'string') return `<str:${v.length}>`;
  if (Array.isArray(v)) return v.slice(0, 2).map((x) => redact(x, depth + 1)).concat(v.length > 2 ? [`<+${v.length - 2} more>`] : []);
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) o[k] = redact(val, depth + 1);
    return o;
  }
  return v; // number | boolean | null
}

function sig(o: Record<string, unknown>): string {
  return Object.keys(o).sort().join(',');
}

function main(): void {
  const home = arg('home') ?? homedir();
  const base = join(home, '.codex');
  console.log(`Codex inspector — scanning ${base}`);

  const files: string[] = [];
  walkJsonl(base, files);
  if (files.length === 0) {
    console.log('No *.jsonl files found under ~/.codex. Is the Codex CLI installed and used on this machine?');
    console.log('(Looked recursively; the provider reads ~/.codex/sessions specifically.)');
    return;
  }
  files.sort((a, b) => {
    try {
      return statSync(b).mtimeMs - statSync(a).mtimeMs;
    } catch {
      return 0;
    }
  });
  console.log(`Found ${files.length} .jsonl file(s) (showing newest first):`);
  for (const f of files.slice(0, 8)) console.log(`  ${f.replace(home, '~')}`);

  const sigCounts = new Map<string, number>();
  const usageSigCounts = new Map<string, number>();
  const examples = new Map<string, string>(); // signature -> redacted example (token-bearing)
  let lines = 0;

  for (const f of files) {
    if (lines >= MAX_LINES) break;
    let text: string;
    try {
      text = readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split('\n')) {
      if (lines >= MAX_LINES) break;
      if (!line.trim()) continue;
      lines++;
      let o: Record<string, unknown>;
      try {
        o = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (!o || typeof o !== 'object') continue;
      const s = sig(o);
      sigCounts.set(s, (sigCounts.get(s) ?? 0) + 1);
      const hasUsage = line.includes('usage') || line.includes('token');
      if (hasUsage) {
        usageSigCounts.set(s, (usageSigCounts.get(s) ?? 0) + 1);
        if (!examples.has(s) && examples.size < MAX_EXAMPLES) {
          examples.set(s, JSON.stringify(redact(o), null, 2));
        }
      }
    }
  }

  console.log(`\nParsed ${lines} line(s). Top-level record shapes (by key signature):`);
  for (const [s, n] of [...sigCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${n.toString().padStart(6)}  [${s}]${usageSigCounts.has(s) ? '  <- has usage/token' : ''}`);
  }

  if (examples.size === 0) {
    console.log('\nNo lines containing "usage"/"token" found — Codex may not log token counts in these files.');
  } else {
    console.log(`\nRedacted examples of token-bearing records (strings shown as <str:len>, numbers kept):`);
    for (const [s, ex] of examples) {
      console.log(`\n--- shape [${s}] ---\n${ex}`);
    }
  }

  const u = readCodexUsage({ homeDir: home });
  console.log(`\nreadCodexUsage() result: available=${u.available} usedTokens=${u.usedTokens} samples=${u.samples} state="${u.state}" (window ${Math.round(u.windowMs / 3.6e6)}h)`);
  if (!u.available && examples.size > 0) {
    console.log('Token records exist but the provider did not match them — paste the redacted examples above and the parser can be tuned to this shape.');
  }
}

main();
