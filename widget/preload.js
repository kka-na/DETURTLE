const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig:  () => ipcRenderer.invoke('get-config'),
  saveConfig: (cfg) => ipcRenderer.invoke('save-config', cfg),
  resize:    (w, h, restore = false) => ipcRenderer.send('resize', { w, h, restore }),
  notify:    (title, body) => ipcRenderer.send('notify', { title, body }),
  showMenu:  () => ipcRenderer.send('show-menu'),
  onAction:  (fn) => ipcRenderer.on('action', (_, action) => fn(action)),
});
