// bitGen Studio — optional Electron shell.
//
// Runs the existing Express server in-process and shows it in a FRAMELESS
// window with a custom title bar, so the app looks like a Windows 11 app
// rather than a browser tab. Nothing here is required: the studio still runs
// perfectly in a browser, and start.bat falls back to that when Electron is
// not installed.
//
// The server is untouched — this file spawns it exactly as start.bat does.
const { app, BrowserWindow, ipcMain, shell, dialog, session, desktopCapturer, screen } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

const PORT = process.env.H3_PORT || 8311;
const ROOT = path.join(__dirname, "..");
// 2.331.0: the installer's portable tools (runtime/: Node, Python, git,
// ffmpeg) come first on PATH for the server and everything it starts - a
// Start-menu / desktop shortcut can launch this directly, no console window
try {
  const dirs = require(path.join(ROOT, "lib", "setupRun")).runtimeDirs().filter((d) => require("fs").existsSync(d));
  const key = Object.keys(process.env).find((k) => k.toUpperCase() === "PATH") || "PATH";
  if (dirs.length) process.env[key] = dirs.concat([process.env[key] || ""]).join(path.delimiter);
} catch (e) { console.error("[electron] runtime PATH: " + e.message); }
let server = null;
let win = null;

function startServer() {
  // If something is already serving (a start.bat window, say), reuse it rather
  // than fighting over the port.
  return fetch(`http://127.0.0.1:${PORT}/api/health`).then(
    () => { console.log("[electron] reusing the server already on " + PORT); },
    () => new Promise((resolve, reject) => {
      server = spawn(process.execPath, [path.join(ROOT, "server.js")], {
        cwd: ROOT,
        // H3_PARENT_PID lets the server notice this process VANISHING — a crash
        // or a task-manager kill never fires before-quit, and on Windows a
        // killed child runs no exit handlers, so without a parent watchdog the
        // ComfyUI it launched would outlive everything as a hidden orphan.
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1",
               H3_PARENT_PID: String(process.pid) },
        stdio: ["ignore", "pipe", "pipe"],
      });
      server.stdout.on("data", (d) => process.stdout.write("[server] " + d));
      server.stderr.on("data", (d) => process.stderr.write("[server] " + d));
      server.on("exit", (c) => { if (c) console.error("[electron] server exited " + c); });
      const deadline = Date.now() + 30000;
      const poll = () => {
        fetch(`http://127.0.0.1:${PORT}/api/health`).then(resolve, () => {
          if (Date.now() > deadline) return reject(new Error("server did not start in 30s"));
          setTimeout(poll, 300);
        });
      };
      setTimeout(poll, 300);
    })
  );
}

function createWindow() {
  win = new BrowserWindow({
    width: 1600, height: 950, minWidth: 1100, minHeight: 700,
    frame: false,                       // frameless: our own title bar
    backgroundColor: "#100e0b",         // matches --ink, so no white flash
    icon: path.join(ROOT, "static", "icon.png"),   // 2.331.0 taskbar / dock icon
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.once("ready-to-show", () => win.show());
  // keep external links in the real browser, not in a chromeless app window
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.on("maximize", () => win.webContents.send("h3:maximized", true));
  win.on("unmaximize", () => win.webContents.send("h3:maximized", false));
  win.loadURL(`http://127.0.0.1:${PORT}/`);
}

/* ------------------------------------------------------------- SETUP window
   2.220.0 "create a windows 11 look installer using nodejs"; 2.331.0 rebuilt
   (Tim: "on the first page offer comfyui, input with folder select button
   for existing comfyui package, comfyui nodes ... omnivoice ... a list of
   models ... hf token ... Do a gpu check, set up bitgen studio for the
   hardware ... start using bitgen studio immediately after setup" + "make
   it crossplatform"). The page (electron/installer.html) drives
   lib/setupRun.js through these IPC handlers - no PowerShell, the same
   engine on Windows, macOS and Linux (and scripts/setup-cli.js headless).
   Shown when the installer left .setup-pending, when H3_SETUP=1, or - for a
   zip install - while no ComfyUI is set up (lib/comfy.js setupNeeded). */
let setupWin = null;
const Setup = () => require(path.join(ROOT, "lib", "setupRun"));
const setupEmit = (m) => setupWin && !setupWin.isDestroyed() && setupWin.webContents.send("setup:event", m);

function createSetupWindow() {
  setupWin = new BrowserWindow({
    width: 860, height: 720, resizable: false,
    frame: false,                       // frameless: the page's own title bar
    backgroundColor: "#100e0b",
    icon: path.join(ROOT, "static", "icon.png"),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "installer-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  setupWin.once("ready-to-show", () => setupWin.show());
  setupWin.loadFile(path.join(__dirname, "installer.html"));
}

async function launchApp() {
  const sw = setupWin;
  setupWin = null;                       // window-all-closed must not fire quit
  try { await startServer(); }
  catch (e) { console.error("[electron] " + e.message); }
  createWindow();
  if (sw && !sw.isDestroyed()) sw.close();
}

ipcMain.handle("setup:detect", () => Setup().detect());
// the native folder picker: an existing folder OR a new one
ipcMain.handle("setup:browse", async (_e, o) => {
  const opt = o && typeof o === "object" ? o : { start: o };
  const r = await dialog.showOpenDialog(setupWin, {
    title: opt.title || "Pick a folder",
    defaultPath: typeof opt.start === "string" && opt.start ? opt.start : path.join(ROOT, "comfy"),
    properties: ["openDirectory", "createDirectory", "promptToCreate"],
  });
  return r.canceled || !r.filePaths.length ? null : r.filePaths[0];
});
ipcMain.handle("setup:inspect", (_e, dir) => Setup().inspectComfy(dir));
ipcMain.handle("setup:packages", (_e, hw, o) => Setup().packages(hw, o));   // 2.519.0: the package page (lib/hwPlan.js)
ipcMain.handle("setup:install", (_e, plan) => Setup().install(plan, setupEmit));
ipcMain.handle("setup:token", (_e, t) => require(path.join(ROOT, "lib", "setupModels")).checkToken(t));
ipcMain.handle("setup:models", (_e, t, o) => Setup().models(t, o));
ipcMain.handle("setup:disk", () => Setup().freeSpace());   // 2.341.0: lib/setupRun.freeSpace (the in-app Models dialog asks too)
ipcMain.handle("setup:download", (_e, ids, t, o) => Setup().download(ids, t, setupEmit, o));   // 2.341.0: o.engine
ipcMain.handle("setup:hfcli", () => Setup().hfCli());                                            // 2.341.0
ipcMain.handle("setup:hfcli-install", () => Setup().hfCliInstall(setupEmit));
ipcMain.handle("setup:finish", () => { Setup().finish(); return launchApp(); });
ipcMain.handle("setup:skip", () => {
  // the never-ask-again marker start.bat and lib/comfy.js already honour
  const fs = require("fs");
  try {
    fs.mkdirSync(path.join(ROOT, "comfy"), { recursive: true });
    fs.writeFileSync(path.join(ROOT, "comfy", ".declined"), "");
  } catch {}
  Setup().finish();
  return launchApp();
});
ipcMain.handle("setup:launch", () => launchApp());

ipcMain.handle("h3:win", (_e, action) => {
  // the setup window borrows minimize/close from the same channel
  if (!win && setupWin) {
    if (action === "minimize") setupWin.minimize();
    else if (action === "close") setupWin.close();
    return false;
  }
  if (!win) return null;
  if (action === "minimize") win.minimize();
  else if (action === "maximize") win.isMaximized() ? win.unmaximize() : win.maximize();
  else if (action === "close") win.close();
  else if (action === "isMaximized") return win.isMaximized();
  return win.isMaximized();
});

app.whenReady().then(async () => {
  // 2.220.0: first-run setup comes before the app — same gate as start.bat's
  // console prompt, H3_SETUP=1 forces it. The setup window hands off to the
  // app via setup:launch / setup:skip; closing it with ✕ launches too (a
  // skip-once: nothing remembered).
  // 2.331.0: the installer's .setup-pending / H3_SETUP=1 / (zip installs)
  // no ComfyUI set up yet - lib/setupRun.js wanted()
  // 2.367.0: the left dock's 📷 / ⏺ (screenshot, screen recording) - which window / screen and the
  // computer's own sound - electron/capture.js
  try {
    require("./capture").register({ ipcMain, session, desktopCapturer, screen, getWin: () => win });
  } catch (e) { console.error("[electron] capture: " + e.message); }
  let showSetup = false;
  try {
    let fallback = false;
    try { fallback = require(path.join(ROOT, "lib", "comfy")).setupNeeded(ROOT); } catch {}
    showSetup = Setup().wanted(fallback);
  } catch (e) { console.error("[electron] setup gate: " + e.message); showSetup = process.env.H3_SETUP === "1"; }
  if (showSetup) { createSetupWindow(); }
  else {
    try { await startServer(); }
    catch (e) { console.error("[electron] " + e.message); }
    createWindow();
  }
  app.on("activate", () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

// The server is left running on purpose when only the window closes on macOS;
// on Windows/Linux quitting means quitting.
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
/* QUITTING MUST GO THROUGH THE SERVER, not over it. server.kill() on Windows is
   TerminateProcess: the server dies with its exit handlers never run, so the
   shutdown sweep in lib/comfy.js — the thing that kills the ComfyUI tree —
   never happens, and a hidden ComfyUI keeps port 8188 and the VRAM. That is
   exactly "i quit our app and launch comfy, it doesn't launch".
   So: hold the quit once, ask the server to shut down cleanly (it sweeps and
   exits itself), give it a moment, then fall back to kill() only if it is
   somehow still alive, and quit for real. */
let quitting = false;
app.on("before-quit", (e) => {
  if (quitting) return;                      // second pass: really quit
  quitting = true;
  e.preventDefault();
  const done = () => {
    if (server) { try { server.kill(); } catch {} }   // no-op if already gone
    app.quit();
  };
  try {
    const req = require("http").request(
      { host: "127.0.0.1", port: PORT, path: "/api/shutdown", method: "POST",
        timeout: 4000 },
      () => setTimeout(done, 1500));         // let the sweep run
    req.on("error", done);
    req.on("timeout", () => { try { req.destroy(); } catch {} done(); });
    req.end();
  } catch { done(); }
});
