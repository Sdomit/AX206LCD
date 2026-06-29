import type { Profile } from '../schema';

// The default dashboard, expressed as a portable profile. Engine and Studio both render
// this through renderProfile, so the preview matches the panel exactly.
export const ORBIT_DEFAULT: Profile = {
  schemaVersion: 1,
  name: 'Orbit Default',
  deviceProfileId: 'ax206-usbdisplay',
  width: 480,
  height: 320,
  widgets: [
    { id: 'backdrop', type: 'backdrop', x: 0, y: 0, w: 480, h: 320, props: {} },
    { id: 'state', type: 'statusDot', x: 16, y: 15, w: 8, h: 8, props: {} },
    { id: 'brand', type: 'label', x: 30, y: 13, w: 200, h: 16, props: { text: 'ORBITPANEL', scale: 2, color: 't1' } },
    { id: 'clock', type: 'clock', x: 300, y: 8, w: 168, h: 16, props: { source: 'time', scale: 2, color: 't1', align: 'right' } },
    { id: 'uptime', type: 'clock', x: 300, y: 26, w: 168, h: 8, props: { source: 'uptime', scale: 1, color: 't2', align: 'right', prefix: 'UP ' } },
    { id: 'cpu', type: 'arcGauge', x: 20, y: 44, w: 192, h: 200, props: { binding: 'cpu.loadPercent', label: 'CPU LOAD', tempBinding: 'cpu.tempC' } },
    { id: 'gpu', type: 'statCard', x: 232, y: 46, w: 236, h: 64, props: { label: 'GPU', mainBinding: 'gpu.tempC', mainFmt: 'temp', rightBinding: 'gpu.loadPercent', rightFmt: 'pct', rightColorMode: 'load', barBinding: 'gpu.loadPercent', barMax: 100, barColorMode: 'load' } },
    { id: 'ram', type: 'statCard', x: 232, y: 116, w: 236, h: 64, props: { label: 'RAM', mainBinding: 'memory.usedMiB', mainFmt: 'gib', mainBinding2: 'memory.totalMiB', mainSuffix: ' GB', rightBinding: 'memory.loadPercent', rightFmt: 'pct', accent: 'cyan', barBinding: 'memory.loadPercent', barMax: 100, barColor: 'cyan' } },
    { id: 'net', type: 'statCard', x: 232, y: 186, w: 236, h: 64, props: { label: 'NET', mainPrefix: 'DN ', mainBinding: 'network.downBps', mainFmt: 'rate', rightPrefix: 'UP ', rightBinding: 'network.upBps', rightFmt: 'rate', accent: 'violet', barBinding: 'network.downBps', barMax: 12500000, barColor: 'green' } },
    { id: 'ai', type: 'aiUsage', x: 12, y: 262, w: 456, h: 46, props: {} },
  ],
};
