const { app, BrowserWindow, ipcMain, Menu, Notification, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
let win;

app.whenReady().then(() => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: 100, height: 100,
    x: width - 120, y: height - 120,
    frame: false, transparent: true, alwaysOnTop: true,
    resizable: false, skipTaskbar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  win.loadFile('renderer/index.html');
  ipcMain.handle('get-config', () => config);
  win.webContents.openDevTools({ mode: 'detach' });

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
  { type: 'separator' },
  { label: '종료', click: () => app.quit() },
]);
ipcMain.on('show-menu', () => menuTemplate().popup({ window: win }));

ipcMain.on('notify', (_, { title, body }) => {
  if (Notification.isSupported()) new Notification({ title, body }).show();
});

