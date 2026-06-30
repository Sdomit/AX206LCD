// OrbitPanel shell. Provides a control window (run/pause/stop/restart + live status) and a
// tray. The engine (dashboard-service) runs as a child under system Node so node-usb keeps
// its Node ABI — no electron-rebuild needed. The child gets an IPC channel: the shell sends
// pause/resume/status, the engine reports status back, which the shell relays to the window.
import { app, Tray, Menu, BrowserWindow, ipcMain, nativeImage, shell, type MenuItemConstructorOptions, type NativeImage } from 'electron';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONTROL_HTML } from './control-ui';
import { configDir } from './config';

// Run elevated by default so ProbeHost can read CPU temperature (LibreHardwareMonitor's ring0
// driver needs admin). Covers every launch path — .bat, "Start at login", and `npm run tray` —
// not just the .bat. `--elevated` breaks any relaunch loop; declining UAC falls through to a
// normal run (everything works except CPU temp). Windows only.
function isAdminWin(): boolean {
  try {
    execFileSync('net', ['session'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
function relaunchElevated(): boolean {
  const q = (s: string): string => `'${s.replace(/'/g, "''")}'`; // PowerShell single-quote escape
  const args = [...process.argv.slice(1), '--elevated'];
  const cmd =
    `Start-Process -FilePath ${q(process.execPath)} ` +
    `-ArgumentList ${args.map(q).join(',')} ` +
    `-WorkingDirectory ${q(process.cwd())} -Verb RunAs`;
  try {
    execFileSync('powershell', ['-NoProfile', '-Command', cmd], { stdio: 'ignore' });
    return true; // elevated instance launched — this one should exit
  } catch {
    return false; // UAC declined or failed — keep running without elevation
  }
}
if (process.platform === 'win32' && !process.argv.includes('--elevated') && !isAdminWin() && relaunchElevated()) {
  process.exit(0);
}

// Single instance: a second launch (re-running the .bat, login + manual, a leftover orphan)
// must not start a rival engine fighting over the one USB panel — that contention leaves the
// panel frozen on a stale frame. Exit and let the running instance keep the device.
if (!app.requestSingleInstanceLock()) {
  process.exit(0);
}

let tray: Tray | null = null;
let win: BrowserWindow | null = null;
let engine: ChildProcess | null = null;

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

function relay(status: unknown): void {
  if (win && !win.isDestroyed()) win.webContents.send('status', status);
}

function startEngine(): void {
  if (engine) return;
  // stdio: keep stdout/stderr inherited for logs, add a 4th 'ipc' channel for control.
  engine = spawn('node', [join(__dirname, 'dashboard-service.js')], {
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
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
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  void win.loadFile(htmlPath);
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
    { label: 'Open config folder', click: () => void shell.openPath(configDir()) }, // drop profile.json here
    { type: 'separator' },
    { label: 'Start at login', type: 'checkbox', checked: login, click: () => app.setLoginItemSettings({ openAtLogin: !login, path: process.execPath, args: [join(__dirname, 'electron-main.js')] }) },
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

app.whenReady().then(() => {
  app.setName('OrbitPanel');
  tray = new Tray(trayIcon());
  createWindow();
  startEngine();
  refreshMenu();
  const ttl = process.env.ORBIT_TTL ? Number(process.env.ORBIT_TTL) : 0;
  if (ttl > 0) setTimeout(() => app.quit(), ttl * 1000); // smoke-test auto-exit
});

app.on('second-instance', () => createWindow()); // a blocked second launch pokes us — show the window
app.on('activate', () => createWindow()); // macOS dock / re-open
app.on('window-all-closed', () => {
  // tray-only app: stay alive with no windows
});
app.on('before-quit', () => stopEngine());
