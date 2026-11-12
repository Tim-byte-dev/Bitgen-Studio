/* bitGen Studio — lib/podOnline.js (2.765.0): A MODEL OF THIS COMPUTER FOUND ON CIVITAI - the pod downloads it from there
 * (civitai.com or civitai.red) instead of it being sent from this computer.
 *
 * Tim (verbatim): "can you find my checkpoint and send it to the pod via civitai or civitai.red . if is very slow from my pc ,
 * 0.5mb/sec"
 *
 *   find(abs, say)   the file's card (<stem>.bitgen.json - Model manager's 🔎 Civitai look-up writes it) names its Civitai
 *                    version -> that version's file with the same SHA-256 (or, with no SHA-256 kept, the same name and size);
 *                    else its SHA-256 (read once - kept in the card) -> Civitai's by-hash look-up, asked on the site picked in
 *                    Settings ▸ General ▸ Civitai first, then the other (civitai.red holds what civitai.com does not show).
 *                    -> {url, site, file, size, sha256, version_id, model, from} | null (not on Civitai / Civitai not reached)
 *   Only the SAME file is taken: a version's file whose SHA-256 is not this file's is not used.
 *   The pod downloads it with the Civitai API key as ?token= (lib/podModels.js fromLink - never as a header: Civitai sends the
 *   download on to its file host); the key is not kept in the pod's file list. lib/podSend.js sendOne asks here first and
 *   sends from this computer only when the pod could not get it (not on Civitai, refused, failed).
 * Pure (scripts/test-podonline765.js): sitesFor, matchFile, dlUrl, isCivitaiDownload.
 */
"use strict";
const path = require("path");
const SITES = ["civitai.red", "civitai.com"];

/** the sites to ask, the one picked in Settings first (pure) */
function sitesFor(site) { return SITES.includes(site) ? [site].concat(SITES.filter((s) => s !== site)) : SITES.slice(); }
/** a Civitai version's file that IS this file (pure): want = {sha256, name, size} -> the file | null */
function matchFile(ver, want) {
  const files = ((ver && ver.files) || []).filter((f) => f && f.downloadUrl);
  const sha = String((want && want.sha256) || "").toLowerCase();
  if (sha) return files.find((f) => String(((f.hashes || {}).SHA256) || "").toLowerCase() === sha) || null;
  const nm = String((want && want.name) || "").toLowerCase(), size = +((want && want.size) || 0);
  return files.find((f) => String(f.name || "").toLowerCase() === nm && size > 0 && Math.abs((+f.sizeKB || 0) * 1024 - size) <= Math.max(2048, size * 0.001)) || null;
}
/** a Civitai download address on the site asked (pure); token only when given (the pod's job - never kept) */
function dlUrl(u, site, token) {
  let x; try { x = new URL(String(u || "")); } catch { return ""; }
  if (!/^(civitai\.com|civitai\.red)$/i.test(x.hostname)) return "";
  if (SITES.includes(site)) x.hostname = site;
  x.searchParams.delete("token");
  if (token) x.searchParams.set("token", String(token));
  return x.toString();
}
/** Civitai's download address (pure) */
function isCivitaiDownload(u) { return /^https:\/\/(civitai\.com|civitai\.red)\/api\/download\/models\/\d+([/?#]|$)/i.test(String(u || "")); }

/* ---------------- live */
function defaults() {
  const CV = require("./civitai"), MC = require("./modelCards"), fs = require("fs");
  return {
    cfg: () => { const c = ((require("./core").getConfig() || {}).civitai) || {}; return { token: String(c.token || "").trim(), site: String(c.site || "") }; },
    card: (abs) => { try { return JSON.parse(fs.readFileSync(MC.sidecarPath(abs), "utf8")) || {}; } catch { return {}; } },
    keepSha: (abs, sha) => { try { const cur = defaults().card(abs); MC.writeCivitai(abs, cur.civitai || null, { sha256: sha }); } catch { /* the next time reads it again */ } },
    sha256: (abs, onProgress) => CV.sha256(abs, onProgress),
    /** GET https://<site>/api/v1<p> -> the JSON | null (404 / not there); throws when Civitai cannot be reached */
    get: async (site, p, token) => {
      const r = await require("./setupExec").getJson(CV.siteBase(site) + p, token ? { Authorization: "Bearer " + token, Accept: "application/json" } : { Accept: "application/json" });
      if (r.status === 404 || (r.status === 200 && !r.json)) return null;
      if (r.status !== 200) { const e = new Error(r.status ? "Civitai answered HTTP " + r.status : "Civitai could not be reached"); e.status = r.status || 502; throw e; }
      return r.json;
    },
    size: (abs) => { try { return fs.statSync(abs).size; } catch { return 0; } },
  };
}
async function find(abs, say, deps) {
  const D = Object.assign(defaults(), deps || {}), tell = (t) => { if (say) try { say(t); } catch { /* fine */ } };
  const name = path.basename(String(abs)), size = D.size(abs), c = D.cfg(), card = D.card(abs) || {};
  let sha = String(card.sha256 || "").toLowerCase();
  const out = (site, ver, f, from) => ({ url: dlUrl(f.downloadUrl, site, ""), site, file: f.name, size: Math.round((+f.sizeKB || 0) * 1024) || size,
    sha256: String(((f.hashes || {}).SHA256) || sha).toLowerCase(), version_id: ver.id, model: [((ver.model || {}).name || ""), ver.name || ""].filter(Boolean).join(" - "), from });
  const ask = async (site, p) => { try { return await D.get(site, p, c.token); } catch { return null; } };
  // 1. its card names the version (Model manager's Civitai look-up or a Civitai download)
  const vid = card.civitai && (card.civitai.id || card.civitai.version_id);
  if (vid) {
    for (const site of sitesFor(c.site)) {
      const ver = await ask(site, "/model-versions/" + encodeURIComponent(vid));
      const f = ver && matchFile(ver, { sha256: sha, name, size });
      if (f) return out(site, ver, f, "its card");
      if (ver) break;   // the version answered: this file is not one of its files
    }
  }
  // 2. its SHA-256 (read once, kept in its card)
  if (!sha) {
    tell("reading " + name + " to find it on Civitai (once)");
    let last = 0;
    sha = String(await D.sha256(abs, (g) => { const p = size ? Math.floor(100 * g / size) : 0; if (p >= last + 5) { last = p; tell("reading " + name + " to find it on Civitai (once) - " + p + "%"); } }) || "").toLowerCase();
    if (sha) D.keepSha(abs, sha);
  }
  if (!sha) return null;
  tell("asking Civitai for " + name);
  for (const site of sitesFor(c.site)) {
    const ver = await ask(site, "/model-versions/by-hash/" + sha.toUpperCase());
    const f = ver && matchFile(ver, { sha256: sha });
    if (f) return out(site, ver, f, "its SHA-256");
  }
  return null;
}
module.exports = { SITES, sitesFor, matchFile, dlUrl, isCivitaiDownload, find };
