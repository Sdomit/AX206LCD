// Device lifecycle state machine (pure, unit-testable).
// NotDetected → Connecting → Ready → Degraded → Reconnecting.
export type DeviceState = 'NotDetected' | 'Connecting' | 'Ready' | 'Degraded' | 'Reconnecting';
export type DeviceEvent = 'start' | 'opened' | 'openFailed' | 'ioError' | 'lost' | 'retry' | 'recovered' | 'stop';

const TRANSITIONS: Record<DeviceState, Partial<Record<DeviceEvent, DeviceState>>> = {
  NotDetected: { start: 'Connecting' },
  Connecting: { opened: 'Ready', openFailed: 'Reconnecting', stop: 'NotDetected' },
  Ready: { ioError: 'Degraded', lost: 'Reconnecting', stop: 'NotDetected' },
  Degraded: { recovered: 'Ready', ioError: 'Degraded', lost: 'Reconnecting', stop: 'NotDetected' },
  Reconnecting: { retry: 'Connecting', stop: 'NotDetected' },
};

// Returns the next state, or null if the event is not valid in the current state.
export function nextState(state: DeviceState, event: DeviceEvent): DeviceState | null {
  return TRANSITIONS[state][event] ?? null;
}
