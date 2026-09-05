const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  updateTitleBarOverlay: (isDark) => {
    ipcRenderer.send('update-titlebar-theme', isDark);
  },
  selectDirectory: (defaultPath) => ipcRenderer.invoke('select-directory', defaultPath),
});
