const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script for secure IPC communication
 * Exposes safe APIs to the renderer process via contextBridge
 */

// Expose Electron API to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform information
  platform: process.platform,

  // Check if running in Electron
  isElectron: true,

  // File dialog operations (for future settings window)
  openFileDialog: (options) => ipcRenderer.invoke('dialog:openFile', options),

  // YAML configuration operations (for future settings window)
  readYaml: (filePath) => ipcRenderer.invoke('config:readYaml', filePath),
  generateConfig: (yamlPath) => ipcRenderer.invoke('config:generate', yamlPath),
  deleteCurrentGame: () => ipcRenderer.invoke('config:deleteCurrent'),

  // Configuration reload
  reloadConfig: () => ipcRenderer.invoke('config:reload'),
  onReloadConfig: (callback) => {
    ipcRenderer.on('reload-config', callback);
  },

  // Version information
  getVersion: () => ipcRenderer.invoke('app:getVersion')
});

// Log that preload script has loaded (development only)
console.log('Preload script loaded successfully');
