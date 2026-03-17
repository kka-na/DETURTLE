const { app, BrowserWindow, ipcMain, Menu, Notification, screen, session } = require('electron');
const path = require('path');
const fs = require('fs');

const configPath = path.join(app.getPath('userData'), 'config.json');
const defaultConfig = { serverUrl: '' };
let config = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
  : defaultConfig;
let win;

app.whenReady().then(() => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: 100, height: 100,
    x: width - 120, y: height - 120,
    frame: false, transparent: true, alwaysOnTop: true,
    resizable: false, skipTaskbar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  const csp = `default-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://storage.googleapis.com; media-src 'self' mediastream:; connect-src *;`;
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] } });
  });

  win.loadFile('renderer/index.html');
  ipcMain.handle('get-config', () => config);
  ipcMain.handle('save-config', (_, newConfig) => {
    config = { ...config, ...newConfig };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return config;
  });

});

app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());

ipcMain.on('resize', (_, { w, h, restore }) => {
  if (!win) return;
  win.setResizable(true);
  win.setSize(w, h);
  win.setResizable(false);
  if (restore) {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    win.setPosition(width - w - 20, height - h - 20);
  }
});

const menuTemplate = () => Menu.buildFromTemplate([
  { label: '캘리브레이션 재설정', click: () => win.webContents.send('action', 'recalibrate') },
  { label: '사용자 전환',         click: () => win.webContents.send('action', 'switch-user') },
  { label: '휴식 설정',           click: () => win.webContents.send('action', 'break-settings') },
  { label: '서버 주소 변경',      click: () => win.webContents.send('action', 'change-server') },
  { type: 'separator' },
  { label: '종료', click: () => app.quit() },
]);
ipcMain.on('show-menu', () => menuTemplate().popup({ window: win }));

ipcMain.on('notify', (_, { title, body }) => {
  if (Notification.isSupported()) new Notification({ title, body }).show();
});

