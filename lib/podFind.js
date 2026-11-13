/* bitGen Studio — lib/podFind.js (2.778.0): A FILE THE POD NEEDS, FOUND ONLINE BY ITS NAME.
 * Tim's log: "[pod] krea2_nsfw-aio-2.safetensors - not on the pod, not in bitGen's download list and not on this computer"
 * then "the checkpoint is on civitai". A style made ready on a pod looked in three places only: the pod, bitGen's download
 * list (lib/modelCatalog.json) and this computer. A model picked in remote mode comes from runpod/pods/remote_models.json -
 * with its own download link - and a Civitai model may be known by its name alone. Before a file is called missing:
 *   1. runpod/pods/remote_models.json - an entry of that name with a link (lib/remoteModels.js byName)
 *   2. its Civitai info card (<app>/model_info/<models|loras>/<stem>/info.json - lib/modelInfo.js) - the version it matched,
 *      asked for again, and the file of that name in it
 *   3. a Civitai search by the file's name (lib/modelInfo.js cleanQuery + matchVersion: the SAME file name, or the same stem -
 *      a guess by size alone is not taken)
 * The pod then downloads it (lib/podSend.js pullWait; a Civitai link tried on civitai.com and civitai.red, with the saved
 * Civitai key) and it goes in remote_models.json. A hit is kept for 10 minutes (the same name asked again = no new search).
 *   find(cats, name, say) -> {url, folder, name, size, from, site, how: list | info | search, model, sha256} | null
 * Pure (scripts/test-podfind778.js): catOf, entryHit, fileOf, kindOf.
 */
"use strict";

const KEEP = 10 * 60 * 1000;
const HIT = new Map();   // "cats|name" -> {at, hit}
let D = null;            // deps (tests replace them)

const norm = (n) => String(n || "").replace(/\\/g, "/").replace(/^\/+/, "");
const baseOf = (n) => norm(n).split("/").pop();
/** the ComfyUI folder a need goes in (pure): unet -> diffusion_models, else its own; checkpoints for a model need */
function catOf(cats) { const c = (cats && cats[0]) || "checkpoints"; return c === "unet" ? "diffusion_models" : c; }
function kindOf(cats) { return (cats || []).includes("loras") ? "lora" : "model"; }
/** a remote_models.json entry -> the hit (pure) | null */
function entryHit(e) {
  if (!e || !e.url) return null;
  const from = e.source === "civitai" ? "Civitai" : e.source === "your-hf" ? "your Hugging Face" : e.source === "link" ? "its link" : "Hugging Face";
  return { url: e.url, folder: e.folder, name: e.name, size: +e.size || 0, from, site: /civitai\.red/i.test(e.url) ? "civitai.red" : /civitai\.com/i.test(e.url) ? "civitai.com" : "", how: "list", model: e.label || "", sha256: e.sha256 || "" };
}
/** the file of that name in a Civitai version (pure) -> {url, size, sha256} | null */
function fileOf(ver, name) {
  const want = baseOf(name).toLowerCase();
  const f = ((ver && ver.files) || []).find((x) => x && x.downloadUrl && String(x.name || "").toLowerCase() === want);
  return f ? { url: String(f.downloadUrl), size: Math.round((+f.sizeKB || 0) * 1024), sha256: String(((f.hashes || {}).SHA256) || "").toLowerCase() } : null;
}

function deps() {
  return D || {
    remote: (cats, name) => { const RM = require("./remoteModels"); return RM.byName(RM.load(), cats, name); },
    info: (kind, name) => require("./modelInfo").readInfo({ kind, name: baseOf(name) }),
    version: (id) => require("./civitai").api("/model-versions/" + String(id).replace(/\D/g, "")),
    search: (q, kind) => { const cv = require("./civitai"); return cv.api("/models", { query: q, types: kind === "lora" ? "LORA,LoCon,DoRA" : "Checkpoint", limit: 20, nsfw: cv.cfg().mature ? "true" : "false" }); },
    site: () => { try { return String(require("./civitai").cfg().site || "civitai.com"); } catch { return "civitai.com"; } },
  };
}
function setDeps(d) { D = d ? Object.assign({}, deps(), d) : null; HIT.clear(); }

function civHit(cats, name, ver, f, how) {
  return { url: f.url, folder: catOf(cats), name: baseOf(name), size: f.size, from: "Civitai", site: /civitai\.red/i.test(f.url) ? "civitai.red" : "civitai.com", how,
    model: [((ver && ver.model) || {}).name, ver && ver.name].filter(Boolean).join(" - "), sha256: f.sha256 };
}

async function find(cats, name, say) {
  const d = deps(), k = (cats || []).join(",") + "|" + baseOf(name).toLowerCase(), tell = (t) => { if (say) try { say(t); } catch { /* fine */ } };
  const kept = HIT.get(k);
  if (kept && Date.now() - kept.at < KEEP) return kept.hit;
  const keep = (hit) => { HIT.set(k, { at: Date.now(), hit }); return hit; };
  // 1. the remote models list
  try { const h = entryHit(d.remote(cats, name)); if (h) return keep(h); } catch { /* not readable - the next way */ }
  const kind = kindOf(cats);
  // 2. the Civitai info card
  try {
    const i = d.info(kind, name), vid = i && i.status === "found" && i.civitai && i.civitai.id;
    if (vid) {
      tell("looking for " + baseOf(name) + " on Civitai (its info card)");
      const ver = await d.version(vid), f = fileOf(ver, name);
      if (f) return keep(civHit(cats, name, ver, f, "info"));
    }
  } catch { /* the next way */ }
  // 3. a Civitai search by its name
  try {
    const MI = require("./modelInfo");
    const q = MI.cleanQuery(baseOf(name).replace(/\.[^.]+$/, ""));
    for (const s of [q, q.split(" ").slice(0, 2).join(" ")].filter((x, i, a) => x && a.indexOf(x) === i)) {
      tell("looking for " + baseOf(name) + " on Civitai (\"" + s + "\")");
      const j = await d.search(s, kind);
      const hit = MI.matchVersion((j && j.items) || [], baseOf(name), 0);
      if (hit && hit.file && hit.file.downloadUrl && hit.how !== "size") {
        const f = { url: String(hit.file.downloadUrl), size: Math.round((+hit.file.sizeKB || 0) * 1024), sha256: String(((hit.file.hashes || {}).SHA256) || "").toLowerCase() };
        return keep(civHit(cats, name, Object.assign({ model: { name: hit.model && hit.model.name } }, hit.version), f, "search"));
      }
    }
  } catch (e) { tell("Civitai could not be asked for " + baseOf(name) + ": " + String((e && e.message) || e).slice(0, 160)); }
  return keep(null);
}
/** the pod downloads it (a Civitai link tried on both sites) -> "" | why it failed */
async function pull(id, port, hit, say, opts) {
  const SD = require("./podSend"), PO = require("./podOnline"), o = opts || {};
  const folder = hit.folder && hit.folder.includes("/") ? hit.folder : require("./podSend").folderFor(catOf([hit.folder || "checkpoints"]), o.rel || hit.name);
  const sites = /civitai\.(com|red)/i.test(hit.url) ? PO.sitesFor(hit.site || deps().site()) : [""];
  let why = "";
  for (const s of sites) {
    const url = s ? (PO.dlUrl(hit.url, s, "") || hit.url) : hit.url;
    why = await SD.pullWait(id, port, { url, folder, name: hit.name, size: hit.size, from: s || hit.from, pod_name: o.pod_name }, say);
    if (!why) {
      try { require("./remoteModels").add({ label: hit.model || hit.name, folder, name: hit.name, url, source: s ? "civitai" : undefined, sha256: hit.sha256, size: hit.size, pods: { [id]: "done" } }); } catch { /* a nicety */ }
      return "";
    }
  }
  return why || "no answer";
}
module.exports = { catOf, kindOf, entryHit, fileOf, find, pull, setDeps, KEEP };
