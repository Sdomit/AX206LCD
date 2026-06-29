// Codex usage provider. No stable, official, consented local source for remaining
// quota exists (browser-dashboard scraping and cookie/token reading are forbidden by
// project policy), so this honestly reports unavailable rather than faking precision.
// Wire a real source here only when an official documented local API/CLI exists.
export interface CodexUsage {
  available: false;
  state: string;
}

export function readCodexUsage(): CodexUsage {
  return { available: false, state: 'source not configured' };
}
