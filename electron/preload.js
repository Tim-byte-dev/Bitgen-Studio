// Bridges the frameless window's title-bar buttons to the main process.
// contextIsolation stays on: the page gets a few functions, not `require`.
const { contextBridge, ipcRenderer, webFrame } = require("electron");

contextBridge.exposeInMainWorld("h3shell", {
  isElectron: true,
  minimize: () => ipcRenderer.invoke("h3:win", "minimize"),
  maximize: () => ipcRenderer.invoke("h3:win", "maximize"),
  close: () => ipcRenderer.invoke("h3:win", "close"),
  isMaximized: () => ipcRenderer.invoke("h3:win", "isMaximized"),
  onMaximized: (cb) => ipcRenderer.on("h3:maximized", (_e, v) => cb(v)),
  relaunch: () => ipcRenderer.invoke("h3:relaunch"),   // 2.540.5: ⟳ Restart now after an update
  booted: () => ipcRenderer.invoke("h3:booted"),       // 2.891.0: the page came up (electron/recover.js)
  resetLayout: () => ipcRenderer.invoke("h3:resetLayout"),   // 2.891.0: 🧯 Reset the dockers and the cache
  // 2.988.0: the UI size zooms the whole page (static/uizoom.js) - text, buttons, icons, dockers, canvases sharp
  zoom: (f) => { const n = Number(f); if (Number.isFinite(n) && n >= 0.5 && n <= 3) webFrame.setZoomFactor(n); },
  zoomFactor: () => webFrame.getZoomFactor(),
  // 2.367.0: the left dock's 📷 screenshot / ⏺ screen recording (electron/capture.js)
  capture: {
    setup: (p) => ipcRenderer.invoke("capture:setup", p),
    shot: (p) => ipcRenderer.invoke("capture:shot", p),
  },
});
