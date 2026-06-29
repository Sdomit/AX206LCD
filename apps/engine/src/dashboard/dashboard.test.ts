import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateProfile } from './schema';
import { renderProfile } from './render';
import { RgbSurface } from './rgb-surface';
import { fmtTokens } from './bindings';
import { ORBIT_DEFAULT } from './profiles/orbit-default';

const env = {
  snapshot: null,
  stale: true,
  ctx: { timeStr: '00:00:00', uptimeStr: '00:00:00', panelState: 'NotDetected' },
};

test('the default profile validates', () => {
  const r = validateProfile(ORBIT_DEFAULT);
  assert.ok(r.ok);
});

test('validateProfile rejects junk and bad widgets', () => {
  assert.equal(validateProfile('{bad json').ok, false);
  assert.equal(validateProfile({ width: 1, height: 1 }).ok, false); // no widgets[]
  assert.equal(validateProfile({ width: 1, height: 1, widgets: [{ id: 'x' }] }).ok, false); // bad widget
});

test('renderProfile fills the whole buffer and tolerates a null snapshot', () => {
  const s = new RgbSurface(480, 320);
  renderProfile(s, ORBIT_DEFAULT, env);
  assert.equal(s.buf.length, 480 * 320 * 2);
  // top strip is the red stale marker (rgb565 of 248,113,113)
  assert.notEqual(s.buf[0] | s.buf[1], 0);
});

test('fmtTokens scales to K/M', () => {
  assert.equal(fmtTokens(950), '950');
  assert.equal(fmtTokens(12_000), '12K');
  assert.equal(fmtTokens(2_400_000), '2.40M');
});
