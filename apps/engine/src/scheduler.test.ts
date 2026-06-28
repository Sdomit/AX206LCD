import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FrameScheduler } from './scheduler';

test('counts a render and skips a tick that overlaps an in-flight render', async () => {
  let tick: () => void = () => {};
  let resolveRender: ((ok: boolean) => void) | null = null;

  const sched = new FrameScheduler({
    fps: 10,
    render: () => new Promise<boolean>((res) => { resolveRender = res; }),
    schedule: (fn) => {
      tick = fn;
      return { clear: () => {} };
    },
  });
  sched.start();

  tick(); // begins render #1 (in flight)
  await Promise.resolve();
  tick(); // overlaps the in-flight render → skipped
  assert.equal(sched.skipped, 1);
  assert.equal(sched.rendered, 0);

  resolveRender!(true); // finish render #1
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(sched.rendered, 1);
  assert.equal(sched.failed, 0);

  sched.stop();
});

test('a render returning false counts as failed, not rendered', async () => {
  let tick: () => void = () => {};
  const sched = new FrameScheduler({
    fps: 10,
    render: async () => false,
    schedule: (fn) => {
      tick = fn;
      return { clear: () => {} };
    },
  });
  sched.start();
  tick();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(sched.failed, 1);
  assert.equal(sched.rendered, 0);
  sched.stop();
});
