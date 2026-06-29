// OrbitPanel shell. Provides a control window (run/pause/stop/restart + live status) and a
// tray. The engine (dashboard-service) runs as a child under system Node so node-usb keeps
// its Node ABI — no electron-rebuild needed. The child gets an IPC channel: the shell sends
// pause/resume/status, the engine reports status back, which the shell relays to the window.
import { app, Tray, Menu, BrowserWindow, ipcMain, nativeImage, type MenuItemConstructorOptions, type NativeImage } from 'electron';
import { spawn, execSync, type ChildProcess } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONTROL_HTML } from './control-ui';

interface Settings {
  claudeLimit: number | null;
  codexLimit: number | null;
}

let tray: Tray | null = null;
let win: BrowserWindow | null = null;
let engine: ChildProcess | null = null;
let settings: Settings = { claudeLimit: null, codexLimit: null };

const STOPPED_STATUS = {
  type: 'status',
  alive: false,
  paused: false,
  device: 'NotDetected',
  screen: null,
  fps: 0,
  rendered: 0,
  skipped: 0,
  failed: 0,
};

const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

// On Windows, CPU temp needs elevation. `net session` succeeds only when elevated.
function detectElevated(): boolean {
  if (process.platform !== 'win32') return true;
  try {
    execSync('net session', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const ELEVATED = detectElevated();

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json'); // %APPDATA%\OrbitPanel\settings.json
}
function loadSettings(): Settings {
  try {
    const o = JSON.parse(readFileSync(settingsPath(), 'utf8'));
    return { claudeLimit: numOrNull(o.claudeLimit), codexLimit: numOrNull(o.codexLimit) };
  } catch {
    return { claudeLimit: null, codexLimit: null };
  }
}
function saveSettings(s: Settings): void {
  try {
    writeFileSync(settingsPath(), JSON.stringify(s, null, 2));
  } catch {
    // best effort
  }
}

function trayIcon(): NativeImage {
  const s = 16;
  const buf = Buffer.alloc(s * s * 4);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = x - 7.5;
      const dy = y - 7.5;
      const d = Math.sqrt(dx * dx + dy * dy);
      const on = d > 3.5 && d < 7; // cyan ring
      const i = (y * s + x) * 4;
      buf[i] = on ? 238 : 0; // B
      buf[i + 1] = on ? 211 : 0; // G
      buf[i + 2] = on ? 34 : 0; // R
      buf[i + 3] = on ? 255 : 0; // A
    }
  }
  return nativeImage.createFromBuffer(buf, { width: s, height: s });
}

function relay(status: Record<string, unknown>): void {
  if (win && !win.isDestroyed()) win.webContents.send('status', { ...status, elevated: ELEVATED });
}

function startEngine(): void {
  if (engine) return;
  // Pass the configured token limits to the engine via env so the progress bars render.
  // Settings take precedence; an externally-set env var still works when no setting exists.
  const env = { ...process.env };
  if (settings.claudeLimit) env.CLAUDE_5H_TOKEN_LIMIT = String(settings.claudeLimit);
  if (settings.codexLimit) env.CODEX_TOKEN_LIMIT = String(settings.codexLimit);
  // stdio: keep stdout/stderr inherited for logs, add a 4th 'ipc' channel for control.
  engine = spawn('node', [join(__dirname, 'dashboard-service.js')], {
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    env,
  });
  engine.on('message', (m: { type?: string }) => {
    if (m && m.type === 'status') relay(m);
  });
  engine.on('exit', () => {
    engine = null;
    relay(STOPPED_STATUS);
    refreshMenu();
  });
  refreshMenu();
}

function stopEngine(): void {
  if (!engine) return;
  engine.kill();
  engine = null;
  relay(STOPPED_STATUS);
  refreshMenu();
}

function createWindow(): void {
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
    return;
  }
  const htmlPath = join(app.getPath('temp'), 'orbitpanel-control.html');
  writeFileSync(htmlPath, CONTROL_HTML);
  win = new BrowserWindow({
    width: 500,
    height: 600,
    minWidth: 420,
    minHeight: 520,
    title: 'OrbitPanel',
    backgroundColor: '#0a0e1a',
    autoHideMenuBar: true,
    show: false, // show on ready-to-show to avoid a white flash / invisible window
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.once('ready-to-show', () => {
    win?.show();
    win?.focus();
    console.log('[ui] control window shown');
  });
  win.webContents.on('did-fail-load', (_e, code, desc) => console.error(`[ui] window failed to load: ${code} ${desc}`));
  void win.loadFile(htmlPath).catch((e) => console.error(`[ui] loadFile error: ${String(e)}`));
  console.log(`[ui] control window created (${htmlPath})`);
  win.on('closed', () => {
    win = null;
  });
}

function refreshMenu(): void {
  if (!tray) return;
  const running = engine !== null;
  const login = app.getLoginItemSettings().openAtLogin;
  const template: MenuItemConstructorOptions[] = [
    { label: `OrbitPanel — engine ${running ? 'running' : 'stopped'}`, enabled: false },
    { type: 'separator' },
    { label: 'Control panel…', click: createWindow },
    running ? { label: 'Stop engine', click: stopEngine } : { label: 'Start engine', click: startEngine },
    { label: 'Restart engine', click: () => { stopEngine(); startEngine(); } },
    { type: 'separator' },
    { label: 'Start at login', type: 'checkbox', checked: login, click: () => app.setLoginItemSettings({ openAtLogin: !login }) },
    { type: 'separator' },
    { label: 'Quit OrbitPanel', click: () => app.quit() },
  ];
  tray.setContextMenu(Menu.buildFromTemplate(template));
  tray.setToolTip(`OrbitPanel — engine ${running ? 'running' : 'stopped'}`);
}

// Control commands from the window.
ipcMain.handle('run', () => {
  if (!engine) startEngine();
  else engine.send({ cmd: 'resume' });
});
ipcMain.handle('pause', () => engine?.send({ cmd: 'pause' }));
ipcMain.handle('stop', () => stopEngine());
ipcMain.handle('restart', () => {
  stopEngine();
  startEngine();
});
ipcMain.handle('requestStatus', () => {
  if (engine) engine.send({ cmd: 'status' });
  else relay(STOPPED_STATUS);
});
ipcMain.handle('getSettings', () => settings);
ipcMain.handle('setSettings', (_e, s: Partial<Settings>) => {
  settings = { claudeLimit: numOrNull(s?.claudeLimit), codexLimit: numOrNull(s?.codexLimit) };
  saveSettings(settings);
  if (engine) {
    stopEngine();
    startEngine();
  } else {
    relay(STOPPED_STATUS);
  }
});
ipcMain.handle('relaunchAdmin', () => {
  if (process.platform !== 'win32') return;
  try {
    const quote = (a: string): string => `'${a.replace(/'/g, "''")}'`;
    const argList = process.argv.slice(1).map(quote).join(',');
    const cmd = `Start-Process -FilePath ${quote(process.execPath)} -Verb RunAs` + (argList ? ` -ArgumentList ${argList}` : '');
    spawn('powershell', ['-NoProfile', '-Command', cmd], { detached: true, stdio: 'ignore' }).unref();
    app.quit();
  } catch {
    // if elevation is declined, stay running unelevated
  }
});

app.whenReady().then(() => {
  app.setName('OrbitPanel');
  try {
    settings = loadSettings();
  } catch (e) {
    console.error(`[settings] ${String(e)}`);
  }
  // Open the window FIRST so a tray or engine failure can never block the UI.
  createWindow();
  try {
    tray = new Tray(trayIcon());
    refreshMenu();
  } catch (e) {
    console.error(`[tray] failed (continuing with window only): ${String(e)}`);
  }
  try {
    startEngine();
  } catch (e) {
    console.error(`[engine] failed to start: ${String(e)}`);
  }
  const ttl = process.env.ORBIT_TTL ? Number(process.env.ORBIT_TTL) : 0;
  if (ttl > 0) setTimeout(() => app.quit(), ttl * 1000); // smoke-test auto-exit
}).catch((e) => console.error(`[startup] ${String(e)}`));

app.on('activate', () => createWindow()); // macOS dock / re-open
app.on('window-all-closed', () => {
  // tray-only app: stay alive with no windows
});
app.on('before-quit', () => stopEngine());
