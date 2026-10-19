// bitGen Studio — SETUP window bridge (2.220.0; 2.331.0 the cross-platform
// wizard). contextIsolation stays on: the page gets exactly these calls into
// lib/setupRun.js (via electron/main.js) - never `require`.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("h3setup", {
  detect: () => ipcRenderer.invoke("setup:detect"),
  browse: (o) => ipcRenderer.invoke("setup:browse", o),
  inspect: (dir) => ipcRenderer.invoke("setup:inspect", dir),
  packages: (hw, o) => ipcRenderer.invoke("setup:packages", hw, o),   // 2.519.0: hw = the answers the wizard asked for
  install: (plan) => ipcRenderer.invoke("setup:install", plan),
  token: (t) => ipcRenderer.invoke("setup:token", t),
  models: (t, o) => ipcRenderer.invoke("setup:models", t, o),
  disk: () => ipcRenderer.invoke("setup:disk"),
  download: (ids, t, o) => ipcRenderer.invoke("setup:download", ids, t, o),   // 2.341.0: o.engine auto | hf | builtin
  hfcli: () => ipcRenderer.invoke("setup:hfcli"),
  hfcliInstall: () => ipcRenderer.invoke("setup:hfcli-install"),
  finish: () => ipcRenderer.invoke("setup:finish"),
  skip: () => ipcRenderer.invoke("setup:skip"),
  minimize: () => ipcRenderer.invoke("h3:win", "minimize"),
  close: () => ipcRenderer.invoke("h3:win", "close"),
  onEvent: (cb) => ipcRenderer.on("setup:event", (_e, m) => cb(m)),
});
