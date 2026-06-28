import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextState } from './state-machine';

test('happy path: NotDetected → Connecting → Ready', () => {
  assert.equal(nextState('NotDetected', 'start'), 'Connecting');
  assert.equal(nextState('Connecting', 'opened'), 'Ready');
});

test('failure + reconnect path', () => {
  assert.equal(nextState('Connecting', 'openFailed'), 'Reconnecting');
  assert.equal(nextState('Reconnecting', 'retry'), 'Connecting');
  assert.equal(nextState('Ready', 'ioError'), 'Degraded');
  assert.equal(nextState('Degraded', 'lost'), 'Reconnecting');
  assert.equal(nextState('Degraded', 'recovered'), 'Ready');
});

test('stop returns to NotDetected from any active state', () => {
  assert.equal(nextState('Ready', 'stop'), 'NotDetected');
  assert.equal(nextState('Reconnecting', 'stop'), 'NotDetected');
});

test('invalid transitions return null', () => {
  assert.equal(nextState('NotDetected', 'opened'), null);
  assert.equal(nextState('Ready', 'start'), null);
});
