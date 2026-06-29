// Preload bridge for the control window. Exposes a tiny, safe `window.orbit` API over IPC
// (contextIsolation on, nodeIntegration off). The renderer can push commands, read/write
// settings, and subscribe to engine status; it cannot touch Node or the engine directly.
import { contextBridge, ipcRenderer } from 'electron';

export interface AiLineStatus {
  used: number;
  limit: number | null;
  available: boolean;
  state?: string;
}

export interface OrbitStatus {
  alive: boolean;
  paused: boolean;
  device: string;
  screen: { name: string; profile: string; width: number; height: number } | null;
  fps: number;
  rendered: number;
  skipped: number;
  failed: number;
  elevated: boolean;
  ai?: { claude: AiLineStatus; codex: AiLineStatus };
}

export interface OrbitSettings {
  claudeLimit: number | null;
  codexLimit: number | null;
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
  getSettings: (): Promise<OrbitSettings> => ipcRenderer.invoke('getSettings'),
  setSettings: (s: OrbitSettings): Promise<void> => ipcRenderer.invoke('setSettings', s),
  relaunchAdmin: (): Promise<void> => ipcRenderer.invoke('relaunchAdmin'),
});
