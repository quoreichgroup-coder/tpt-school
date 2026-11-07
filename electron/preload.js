// Context bridge — extend here if renderer needs IPC access
// Electron preload scripts are loaded as CommonJS by Electron.
/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('tptDesktop', {
  platform: process.platform,
})
