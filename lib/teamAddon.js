// bitGen Studio — lib/teamAddon.js (2.589.0): Settings ▸ Add-ons ▸ Team render farm - the OPTIONAL extension ext/teamdock.
//
// Tim: "i suspect the malwarebytes detection is due to the team renderhub ext. i think we remove this from bitgen and give
// it as an additional addon with notes saying this may trigger virus checkers".
// 2.583.0's render farm (Settings ▸ Team, the status bar's 🖥 Render on) is no longer part of bitGen: its code lives in
// ext/teamdock/ (server part ext/teamdock/server/, the page part ext/teamdock/team.js) and ships ONLY as
// bitgen-ext-teamdock-v<version>.zip - the repo, full and flat zips do not carry it. What it does that antivirus
// programs can read as ransomware / a backdoor: it makes ed25519 signing keys (private keys on disk), listens on a
// network port (0.0.0.0) for the team's PCs, and writes to the team folder (a NAS share) every 15 s.
//   status()                 {installed, mounted, note}
//   install(log)             finds bitgen-ext-teamdock-v*.zip in the app folder or Downloads (the newest) -> ext/teamdock
//   installZip(buf, log)     the zip the page sent (📦 Install from a zip…)
//   remove(log)              ext/teamdock deleted (this PC's team identity in <app>/team/ stays - delete it by hand)
// A change takes effect after a restart of bitGen (an extension's server part is mounted at start).
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

const ID = "teamdock";
const X = () => require("./extensions");
const base = () => require("./core").BASE;
const ZIP_RE = /^bitgen-ext-teamdock-v(\d+)\.(\d+)\.(\d+)\.zip$/i;
const WARN = "may trigger virus checkers: it makes signing keys, listens for the team's PCs on a network port and writes to the team folder every 15 s - Malwarebytes has flagged that as ransomware. Install it only on the PCs that render for each other; if your antivirus stops it, allow bitGen's folder (or remove the add-on)";

function status() {
  const inst = X().installed(ID, base());
  const mounted = X().mountedServers().some((m) => m.id === ID && m.ok);
  return { installed: inst, mounted,
    note: inst ? (mounted ? "installed and running - Settings ▸ Team" : "installed - restart bitGen to start it (Settings ▸ Team appears then)")
      : (mounted ? "removed - restart bitGen to stop it" : "not installed - 📦 Install from a zip… (bitgen-ext-teamdock-v<version>.zip), or put the zip in the app folder / Downloads and Install") };
}
/** where a downloaded zip may be: the app folder, its parent, Downloads -> the newest version's path or "" */
function findZip(dirs) {
  const list = (dirs || [base(), path.dirname(base()), path.join(os.homedir(), "Downloads")]);
  let best = null;
  for (const d of list) {
    let fl = []; try { fl = fs.readdirSync(d); } catch { fl = []; }
    for (const f of fl) {
      const m = ZIP_RE.exec(f); if (!m) continue;
      const v = m.slice(1).map(Number);
      const newer = !best || v[0] > best.v[0] || (v[0] === best.v[0] && (v[1] > best.v[1] || (v[1] === best.v[1] && v[2] > best.v[2])));
      if (newer) best = { v, p: path.join(d, f) };
    }
  }
  return best ? best.p : "";
}
function installZip(buf, log) {
  const r = X().installZipBuffer(buf, ID, base());
  log(`[ok] the Team render farm extension is in ext/teamdock (${r.files} files)`, false);
  log("[warn] it " + WARN, true);
  log("[ok] restart bitGen - Settings ▸ Team and the status bar's 🖥 Render on appear then", false);
  return { ok: true };
}
async function install(log, dirs) {
  const z = findZip(dirs);
  if (!z) return { ok: false, error: "no bitgen-ext-teamdock-v<version>.zip in the app folder or Downloads - use 📦 Install from a zip…" };
  log(`[..] ${z}`, false);
  return installZip(fs.readFileSync(z), log);
}
async function remove(log) {
  if (!X().installed(ID, base())) return { ok: false, error: "the Team render farm extension is not installed" };
  X().removeExt(ID, base());
  log("[ok] ext/teamdock removed - restart bitGen to stop it. This PC's team identity and keys stay in <app>/team/ (delete that folder to forget the team)", false);
  return { ok: true };
}
module.exports = { ID, WARN, status, findZip, install, installZip, remove };
