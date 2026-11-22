// bitGen Studio — lib/apkShare.js (2.912.0): THE 📱 APP ONTO THE PHONE WITHOUT DEBUGGING.
//
// Tim: "debugging is disabled - can we use windows phone link?" -> "ok, lets build all 3":
//   📲 QR install     a QR on this PC; the phone's camera opens http://<this PC>:<port>/apk/<token>/bitGen.apk, the phone's
//                     browser downloads it, you tap Install (Android always asks - only debugging installs without a tap).
//                     The token is random, works 15 minutes for any number of downloads (a browser may ask twice), and a
//                     new QR cancels the old one; it reaches nothing but this one file (lib/remoteGuard.js isOpen).
//   ⬆ Update          the app asks GET /api/app/update (its key) -> the build here {id, version, size, at}; a newer id than
//                     its own (www/lib/build.js) = ⬆ Update: GET /api/app/apk (its key) -> Android's installer.
//   📂 Show the APK   Explorer with mobile/dist/bitGen.apk selected - to drag into Phone Link or Share ▸ Phone Link.
// Samsung's Auto Blocker blocks every install from outside the Galaxy Store / Play Store - it has to be off for any of these.
//   mint(now) / valid(token, now) / qrInfo() / buildInfo() / revealCmd(plat, file)
// Pure (scripts/test-912.js): valid (with a token given), revealCmd, isNewer.
"use strict";
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const TTL = 15 * 60 * 1000;
let tok = null;                      // {t, exp} - one at a time, in memory (a restart cancels a QR on screen)
function mint(now) { const n = now || Date.now(); tok = { t: crypto.randomBytes(18).toString("base64url"), exp: n + TTL }; return tok; }
function valid(t, now) { return !!(tok && t && t === tok.t && (now || Date.now()) <= tok.exp); }
function cancel() { tok = null; }
/** the explorer command that shows a file selected (pure) -> [cmd, args] */
function revealCmd(plat, file) {
  if (plat === "win32") return ["explorer.exe", ["/select," + file]];
  if (plat === "darwin") return ["open", ["-R", file]];
  return ["xdg-open", [path.dirname(file)]];
}
/** is the PC's build newer than the app's own? (pure) - ids are UTC stamps "YYYYMMDDhhmmss"; "dev" = a build by hand */
function isNewer(pcId, appId) {
  const p = String(pcId || ""), a = String(appId || "");
  if (!/^\d{14}$/.test(p)) return false;
  if (!/^\d{14}$/.test(a)) return true;
  return p > a;
}
function apkFile() { return require("./apkBuild").apkOut(); }
function buildInfo() {
  const c = (require("./core").getConfig() || {}).apk || {};
  let st = null; try { st = fs.statSync(apkFile()); } catch { st = null; }
  if (!st) return { available: false };
  return { available: true, id: c.built_id || "", version: c.built_app || "", size: st.size, at: st.mtimeMs };
}
/** the QR for the phone's browser -> {url, qr, expires_at, lan, candidates} or {error} */
function qrInfo(port, ip) {
  const remote = require("./remote");
  if (!fs.existsSync(apkFile())) return { error: "there is no APK yet - 🔨 Build the app first", status: 409 };
  if (!remote.enabled()) return { error: "tick Remote access above first (the phone downloads the app from this PC over Wi-Fi), then restart bitGen Studio", status: 409 };
  if (remote.restartNeeded()) return { error: "Remote access is on, but bitGen Studio still listens only on this computer - close it and start it again, then make the QR", status: 409 };
  const cands = remote.lanCandidates();
  if (!cands.length) return { error: "this computer has no network address the phone could reach - check Wi-Fi / the network adapter", status: 409 };
  const chosen = cands.find((c) => c.ip === ip) || cands[0];
  const t = mint();
  const url = `http://${chosen.ip}:${port}/apk/${t.t}/bitGen.apk`;
  let qr = ""; try { qr = require("./qrcode").svg(url, { scale: 6 }); } catch { qr = ""; }
  return { url, qr, expires_at: t.exp, lan: chosen.ip, candidates: cands };
}
function reveal() {
  const f = apkFile();
  if (!fs.existsSync(f)) { const e = new Error("there is no APK yet - 🔨 Build the app first"); e.status = 409; throw e; }
  const [cmd, args] = revealCmd(process.platform, f);
  try {
    const ch = require("child_process").spawn(cmd, args, { detached: true, stdio: "ignore", windowsHide: false });
    ch.on("error", () => { /* no file manager here (a server without a desktop) - the path is in the answer */ });
    ch.unref();
  }
  catch (e) { const er = new Error("the folder could not be opened: " + e.message); er.status = 500; throw er; }
  return { ok: true, file: f };
}
module.exports = { TTL, mint, valid, cancel, revealCmd, isNewer, buildInfo, qrInfo, reveal, apkFile };
