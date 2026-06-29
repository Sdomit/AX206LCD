import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadActiveProfile, PROFILE_FILE } from './config';
import { ORBIT_DEFAULT } from './dashboard/profiles/orbit-default';

const dirWith = (content: string | null): string => {
  const d = mkdtempSync(join(tmpdir(), 'orbit-cfg-'));
  if (content !== null) writeFileSync(join(d, PROFILE_FILE), content);
  return d;
};

test('loadActiveProfile falls back to ORBIT_DEFAULT when no profile.json exists', () => {
  assert.equal(loadActiveProfile(dirWith(null)).name, ORBIT_DEFAULT.name);
});

test('loadActiveProfile returns a valid profile from disk', () => {
  const custom = { ...ORBIT_DEFAULT, name: 'My Panel' };
  const got = loadActiveProfile(dirWith(JSON.stringify(custom)));
  assert.equal(got.name, 'My Panel');
  assert.equal(got.widgets.length, ORBIT_DEFAULT.widgets.length);
});

test('loadActiveProfile falls back on invalid JSON', () => {
  assert.equal(loadActiveProfile(dirWith('{ not json')).name, ORBIT_DEFAULT.name);
});

test('loadActiveProfile falls back on schema-invalid profile', () => {
  assert.equal(loadActiveProfile(dirWith(JSON.stringify({ name: 'X', widgets: 'nope' }))).name, ORBIT_DEFAULT.name);
});
