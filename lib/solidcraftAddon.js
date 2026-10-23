// bitGen Studio — lib/solidcraftAddon.js (2.578.0): Settings ▸ Add-ons ▸ SolidCraft - its browser build, served by this
// app for the 📐 SolidCraft docker (ext/solidcraftdock).
//
// Tim: "is it possible to make our cad tools in imageeditor work and look like solidcraft with all the solidcraft
// features?" -> "yes, lets build a solidcraft bridge, but we will put it in it's own docker".
// SolidCraft (https://solidcraft.io, github.com/tangency-labs/solidcraft) is open-source parametric 3D CAD in Rust,
// MIT OR Apache-2.0. Every release carries solidcraft-web-<v>.zip, "a static site to host yourself" (WebAssembly +
// WebGPU / WebGL). The add-on downloads that zip ONCE from the GitHub release (or takes one you downloaded - offline)
// and unpacks it to <install>/solidcraft/web/; routes/solidcraft.js serves it at /solidcraft-app/ - the SAME origin as
// the app, so the docker's page reaches its command API (window.solidcraft) and its private file storage (OPFS).
// Nothing runs on a server: SolidCraft works offline in the app (its own service worker keeps the build).
//   dir() / webDir()           <install>/solidcraft, <install>/solidcraft/web
//   status()                   {installed, version, note}
//   latest(deps)               {version, url, size} of the newest release (the GitHub API), or {error}
//   assetUrl(v)                the release's web zip URL for a version
//   checkZip(buf)              {ok, root, version} | {ok:false, error} - a SolidCraft web build? (index.html + a *_bg.wasm)
//   unpack(zipPath, log)       -> {ok, version} - into web.new, then swapped in (the old build stays until it worked)
//   install(log, opts, deps)   opts.zip (a local zip) | opts.version; deps.download / deps.getJson (tests)
//   remove(log)                -> {ok}
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const core = require("./core");

const REPO = "tangency-labs/solidcraft";
const PINNED = "0.17.0";                                   // tried with this app (2.578.0) - the fallback when offline
let BASE_DIR = null;
function setBase(d) { BASE_DIR = d; }
const dir = () => path.join(BASE_DIR || core.BASE, "solidcraft");
const webDir = () => path.join(dir(), "web");
const verFile = () => path.join(dir(), "version.json");

function readVer() { try { return JSON.parse(fs.readFileSync(verFile(), "utf8")); } catch { return null; } }
function status() {
  const ok = fs.existsSync(path.join(webDir(), "index.html"));
  const v = readVer();
  return { installed: ok, version: ok && v ? v.version : "", note: ok ? `SolidCraft ${v && v.version ? v.version : "(version unknown)"} in ${webDir()}` : "not installed" };
}
const assetUrl = (v) => `https://github.com/${REPO}/releases/download/v${v}/solidcraft-web-${v}.zip`;

/** the newest release's web zip (deps.getJson = setupExec.getJson in the app) */
async function latest(deps) {
  const get = (deps && deps.getJson) || require("./setupExec").getJson;
  const r = await get(`https://api.github.com/repos/${REPO}/releases/latest`, { Accept: "application/vnd.github+json" });
  if (!r || r.status !== 200 || !r.json) return { error: r && r.status ? `GitHub answered ${r.status}` : "no internet (GitHub did not answer)" };
  const tag = String(r.json.tag_name || "").replace(/^v/, "");
  const a = (r.json.assets || []).find((x) => /^solidcraft-web-.*\.zip$/i.test(x.name || ""));
  if (!tag || !a) return { error: "the newest SolidCraft release has no web build" };
  return { version: tag, url: a.browser_download_url, size: a.size || 0, name: a.name };
}

/** a SolidCraft web build? its files may sit in one top folder (solidcraft-web-<v>/) */
function checkZip(buf) {
  const Z = require("./unzip");
  let ents;
  try { ents = Z.entries(buf); } catch (e) { return { ok: false, error: "not a zip: " + e.message }; }
  const idx = ents.find((e) => /(^|\/)index\.html$/.test(e.name) && e.name.split("/").length <= 2);
  if (!idx) return { ok: false, error: "this zip has no index.html - pick solidcraft-web-<version>.zip from a SolidCraft release" };
  const root = idx.name.slice(0, idx.name.length - "index.html".length);
  if (!ents.some((e) => e.name.startsWith(root) && /_bg\.wasm$/.test(e.name))) return { ok: false, error: "this zip has no SolidCraft WebAssembly (*_bg.wasm) - is it the web build?" };
  let version = "";
  const bj = ents.find((e) => e.name === root + "build.json");
  if (bj) { try { version = String(JSON.parse(Z.read(buf, bj).toString("utf8")).version || "").split("-")[0]; } catch { version = ""; } }
  if (!version) { const m = /solidcraft-web-(\d+\.\d+\.\d+)/.exec(root); if (m) version = m[1]; }
  return { ok: true, root, version };
}

function unpack(zipPath, log) {
  const lg = log || (() => {});
  const Z = require("./unzip");
  const buf = fs.readFileSync(zipPath);
  const c = checkZip(buf);
  if (!c.ok) return { ok: false, error: c.error };
  const nu = path.join(dir(), "web.new"), old = path.join(dir(), "web.old");
  fs.rmSync(nu, { recursive: true, force: true }); fs.mkdirSync(nu, { recursive: true });
  let n = 0;
  for (const e of Z.entries(buf)) {
    if (Z.unsafe(e.name)) return { ok: false, error: "refusing an unsafe path in the zip: " + e.name };
    if (!e.name.startsWith(c.root)) continue;
    const rel = e.name.slice(c.root.length); if (!rel) continue;
    const dest = path.join(nu, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, Z.read(buf, e)); n++;
  }
  lg(`[ok] ${n} files unpacked`, false);
  fs.rmSync(old, { recursive: true, force: true });
  if (fs.existsSync(webDir())) fs.renameSync(webDir(), old);
  fs.renameSync(nu, webDir());
  fs.rmSync(old, { recursive: true, force: true });
  fs.writeFileSync(verFile(), JSON.stringify({ version: c.version, installed_at: Date.now(), from: path.basename(zipPath) }, null, 2));
  return { ok: true, version: c.version, files: n };
}

async function install(log, opts, deps) {
  const lg = log || (() => {});
  const o = opts || {}, d = deps || {};
  fs.mkdirSync(dir(), { recursive: true });
  if (o.zip) {
    lg(`[..] unpacking ${path.basename(o.zip)}`, false);
    const r = unpack(o.zip, lg);
    if (r.ok) lg(`[ok] SolidCraft ${r.version || ""} installed - open the 📐 SolidCraft docker`, false);
    return r.ok ? { ok: true, version: r.version } : { ok: false, error: r.error };
  }
  let v = o.version, url = "", size = 0;
  if (!v) {
    lg("[..] asking GitHub for the newest SolidCraft", false);
    const L = await latest(d);
    if (L.error) { lg(`[warn] ${L.error} - using ${PINNED}`, true); v = PINNED; }
    else { v = L.version; url = L.url; size = L.size; }
  }
  url = url || assetUrl(v);
  const tmp = path.join(os.tmpdir(), `solidcraft-web-${v}.zip`);
  lg(`[..] downloading SolidCraft ${v} (${size ? Math.round(size / 1048576) + " MB" : "about 20 MB"}) from ${url}`, false);
  const dl = d.download || require("./setupExec").download;
  let last = -10;
  const r = await dl(url, tmp, { size, onProgress: (p) => { const pct = p.total ? Math.floor(p.got / p.total * 100) : 0; if (pct >= last + 10) { last = pct; lg(`[..] ${pct}%`, false); } } });
  if (!r || !r.ok) return { ok: false, error: `the download failed (${(r && r.error) || "no answer"}) - try again, or download solidcraft-web-${v}.zip from ${`https://github.com/${REPO}/releases`} and use "Install from a zip…" in the SolidCraft docker` };
  const u = unpack(tmp, lg);
  try { fs.rmSync(tmp, { force: true }); } catch { /* fine */ }
  if (!u.ok) return { ok: false, error: u.error };
  lg(`[ok] SolidCraft ${u.version || v} installed - open the 📐 SolidCraft docker`, false);
  return { ok: true, version: u.version || v };
}

function remove(log) {
  const lg = log || (() => {});
  lg(`[..] removing ${dir()}`, false);
  try { fs.rmSync(dir(), { recursive: true, force: true }); } catch (e) { return { ok: false, error: `could not remove ${dir()}: ${e.message}` }; }
  lg("[ok] removed (designs you saved stay in each project's solidcraft folder)", false);
  return { ok: true };
}

module.exports = { REPO, PINNED, setBase, dir, webDir, status, latest, assetUrl, checkZip, unpack, install, remove };
