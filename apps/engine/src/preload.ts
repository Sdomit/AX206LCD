// Preload bridge for the control window. Exposes a tiny, safe `window.orbit` API over IPC
// (contextIsolation on, nodeIntegration off). The renderer can push commands and subscribe
// to engine status; it cannot touch Node or the engine process directly.
import { contextBridge, ipcRenderer } from 'electron';

export interface OrbitStatus {
  alive: boolean;
  paused: boolean;
  device: string;
  screen: { name: string; profile: string; width: number; height: number } | null;
  fps: number;
  rendered: number;
  skipped: number;
  failed: number;
}

contextBridge.exposeInMainWorld('orbit', {
  onStatus: (cb: (s: OrbitStatus) => void): void => {
    ipcRenderer.on('status', (_e, s: OrbitStatus) => cb(s));
  },
  run: (): Promise<void> => ipcRenderer.invoke('run'),
  pause: (): Promise<void> => ipcRenderer.invoke('pause'),
  stop: (): Promise<void> => ipcRenderer.invoke('stop'),
  restart: (): Promise<void> => ipcRenderer.invoke('restart'),
  requestStatus: (): Promise<void> => ipcRenderer.invoke('requestStatus'),
});
