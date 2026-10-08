const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('tukukDesktop', {
  platform: process.platform,
  isDesktop: true,
  version: process.versions.electron || 'unknown'
});
