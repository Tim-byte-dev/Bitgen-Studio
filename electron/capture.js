// bitGen Studio — the Electron side of SCREEN CAPTURE + SCREEN RECORD (2.367.0).
//
// Tim: "can we add a screen capture and screen record button in the left docker menubar, icon only. so i can
// make a promotional video and tutorials".
//
// The page (static/screencap.js) asks through the preload (window.h3shell.capture):
//   capture:setup {target, systemAudio}   what the NEXT getDisplayMedia() gets - "window" = this app's window
//                                         (a clean tutorial frame), "screen" = the whole screen the window is
//                                         on; systemAudio = the computer's own sound (Windows loopback, so the
//                                         renders you play are in the recording)
//   capture:shot {target}                 a PNG of the app window (webContents.capturePage - pixel-exact, no
//                                         picker) or of its screen (desktopCapturer at the display's real size)
// Without Electron (a browser tab) the page uses the browser's own picker instead - nothing here is needed.
"use strict";

const prefs = { target: "window", systemAudio: true };

function pickSource(sources, want, win, screenApi) {
  if (!sources || !sources.length) return null;
  if (want === "screen") {
    let id = null;
    try { id = String(screenApi.getDisplayMatching(win.getBounds()).id); } catch {}
    return sources.find((s) => s.id.startsWith("screen:") && String(s.display_id) === id)
      || sources.find((s) => s.id.startsWith("screen:")) || sources[0];
  }
  let mine = "";
  try { mine = win.getMediaSourceId(); } catch {}
  return sources.find((s) => s.id === mine)
    || sources.find((s) => s.id.startsWith("window:") && /bitgen/i.test(s.name || ""))
    || sources.find((s) => s.id.startsWith("screen:")) || sources[0];
}

/** register({ipcMain, session, desktopCapturer, screen, getWin, platform}) - called once from main.js. */
function register(o) {
  const { ipcMain, session, desktopCapturer, screen } = o;
  const platform = o.platform || process.platform;
  const ses = session && session.defaultSession;
  if (ses && typeof ses.setDisplayMediaRequestHandler === "function") {
    ses.setDisplayMediaRequestHandler((request, callback) => {
      const win = o.getWin();
      desktopCapturer.getSources({ types: ["window", "screen"], thumbnailSize: { width: 0, height: 0 } })
        .then((sources) => {
          const src = win ? pickSource(sources, prefs.target, win, screen) : sources[0];
          if (!src) return callback({});
          const out = { video: src };
          // the computer's own sound: Windows only (Electron's loopback); elsewhere the page adds the mic
          if (request && request.audioRequested && prefs.systemAudio && platform === "win32") out.audio = "loopback";
          callback(out);
        })
        .catch(() => callback({}));
    });
  }
  ipcMain.handle("capture:setup", (_e, p) => {
    if (p && (p.target === "window" || p.target === "screen")) prefs.target = p.target;
    if (p && typeof p.systemAudio === "boolean") prefs.systemAudio = p.systemAudio;
    return { ...prefs, systemAudioSupported: platform === "win32" };
  });
  ipcMain.handle("capture:shot", async (_e, p) => {
    const win = o.getWin();
    if (!win) throw new Error("no app window");
    const target = (p && p.target) || prefs.target;
    if (target === "screen") {
      const d = screen.getDisplayMatching(win.getBounds());
      const sf = d.scaleFactor || 1;
      const sources = await desktopCapturer.getSources({ types: ["screen"],
        thumbnailSize: { width: Math.round(d.size.width * sf), height: Math.round(d.size.height * sf) } });
      const src = pickSource(sources, "screen", win, screen);
      if (!src) throw new Error("no screen to capture");
      return src.thumbnail.toPNG();
    }
    const img = await win.webContents.capturePage();
    return img.toPNG();
  });
}

module.exports = { register, pickSource, prefs };
