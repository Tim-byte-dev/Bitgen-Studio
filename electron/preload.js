// Bridges the frameless window's title-bar buttons to the main process.
// contextIsolation stays on: the page gets a few functions, not `require`.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("h3shell", {
  isElectron: true,
  minimize: () => ipcRenderer.invoke("h3:win", "minimize"),
  maximize: () => ipcRenderer.invoke("h3:win", "maximize"),
  close: () => ipcRenderer.invoke("h3:win", "close"),
  isMaximized: () => ipcRenderer.invoke("h3:win", "isMaximized"),
  onMaximized: (cb) => ipcRenderer.on("h3:maximized", (_e, v) => cb(v)),
  relaunch: () => ipcRenderer.invoke("h3:relaunch"),   // 2.540.5: ⟳ Restart now after an update
  // 2.367.0: the left dock's 📷 screenshot / ⏺ screen recording (electron/capture.js)
  capture: {
    setup: (p) => ipcRenderer.invoke("capture:setup", p),
    shot: (p) => ipcRenderer.invoke("capture:shot", p),
  },
});
