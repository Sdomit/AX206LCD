// OrbitPanel tray shell. Electron only provides the tray + lifecycle; it spawns the
// engine (dashboard-service) under system Node so node-usb keeps its Node ABI — no
// electron-rebuild needed. Tray: start/stop/restart engine, start-at-login, quit.
import { app, Tray, Menu, nativeImage, type MenuItemConstructorOptions, type NativeImage } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';

let tray: Tray | null = null;
let engine: ChildProcess | null = null;

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

function startEngine(): void {
  if (engine) return;
  engine = spawn('node', [join(__dirname, 'dashboard-service.js')], { stdio: 'inherit' });
  engine.on('exit', () => {
    engine = null;
    refreshMenu();
  });
  refreshMenu();
}

function stopEngine(): void {
  if (!engine) return;
  engine.kill();
  engine = null;
  refreshMenu();
}

function refreshMenu(): void {
  if (!tray) return;
  const running = engine !== null;
  const login = app.getLoginItemSettings().openAtLogin;
  const template: MenuItemConstructorOptions[] = [
    { label: `OrbitPanel — engine ${running ? 'running' : 'stopped'}`, enabled: false },
    { type: 'separator' },
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

app.whenReady().then(() => {
  tray = new Tray(trayIcon());
  startEngine();
  refreshMenu();
  const ttl = process.env.ORBIT_TTL ? Number(process.env.ORBIT_TTL) : 0;
  if (ttl > 0) setTimeout(() => app.quit(), ttl * 1000); // smoke-test auto-exit
});

app.on('window-all-closed', () => {
  // tray-only app: stay alive with no windows
});
app.on('before-quit', () => stopEngine());
