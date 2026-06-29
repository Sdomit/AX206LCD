// Config dir + active profile under %APPDATA%\OrbitPanel (never Program Files, per project rules).
// The engine renders the active profile so dashboards built/exported in Studio actually reach the
// panel. Missing or invalid profile.json -> ORBIT_DEFAULT (honest fallback; the panel never goes
// dark over a bad file).
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { validateProfile, type Profile } from './dashboard/schema';
import { ORBIT_DEFAULT } from './dashboard/profiles/orbit-default';

export function configDir(): string {
  const base = process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming');
  const dir = join(base, 'OrbitPanel');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export const PROFILE_FILE = 'profile.json';

// Load the active profile from `dir` (defaults to the config dir). Falls back to ORBIT_DEFAULT
// when the file is absent, unreadable, or fails validation — logging the reason for invalid files.
export function loadActiveProfile(dir: string = configDir()): Profile {
  const p = join(dir, PROFILE_FILE);
  if (!existsSync(p)) return ORBIT_DEFAULT;
  try {
    const r = validateProfile(readFileSync(p, 'utf8'));
    if (r.ok) return r.profile;
    console.error(`[config] ${p} invalid: ${r.error} — using built-in default`);
  } catch (e) {
    console.error(`[config] ${p} unreadable: ${(e as Error).message} — using built-in default`);
  }
  return ORBIT_DEFAULT;
}
