/* bitGen Studio — lib/noPodWhere.js (2.793.0): WHERE A TERMINATED POD'S FILE CAN RUN NOW (pure - no files, no network).
 * Tim (verbatim): "also ask the user if the model + vae + textencoder should be added to an existing pod. show user running pods
 * and stopped pods. check if the files exist, only upload necessary files that don't exist on the pod" + "if user chooses new pod
 * or uses an existing one then change the name of the model to pod name/model name so it is assigned a new name. check the full
 * list of pods and models in the pods to see if the model exists in any other pod - advise the user of which pod has it and ask if
 * it should start that pod, create a new pod or add the model to a different pod"
 *   companions(inv, f)         what a model needs with it from the NO_Pod's inventory: its VAE + text encoders (a LoRA = nothing)
 *   findIn(inv, f)             the pod's own file for f (the same name in its kind's folders, else the same file name in another
 *                              folder; when both sizes are known they must agree) -> the inventory entry | null
 *   where(file, comps, invs, status, nopodId)
 *                              -> {has: [...], others: [...]}: every OTHER pod bitGen knows (running or stopped - not terminated)
 *                              {id, name, label, status running|starting|stopped|unknown, gpu, has_model, there [names], missing [names],
 *                              send_bytes, send_gb, free_gb, last_seen, warn [words]}; has = the pods with the file itself
 *                              (running first), others = the rest (running first, then the least to send)
 *   vramOf(gpu)                a card's memory in GB from its name (the cards RunPod rents; 0 = not known)
 *   mergeTodo(files, adds)     a pod's inventory with the files to put on it added as "todo" (ones it has are kept as they are)
 *   renameIn(obj, map)         every string in obj that map() changes, changed -> how many (Basic Settings' saved fields, a
 *                              style's saved Basic Settings, the temporary LoRAs)
 *   refMap(from, to, prefix)   the map: a value equal to `from` (any case) -> `to`; prefix = every value starting with `from`
 * scripts/test-nopodwhere793.js.
 */
"use strict";
const CATS = { model: ["checkpoints", "diffusion_models", "unet", "diffusers"], vae: ["vae", "vae_approx"], te: ["text_encoders", "clip"], lora: ["loras", "lycoris"] };
const norm = (p) => String(p || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
const base = (p) => norm(p).split("/").pop().toLowerCase();
const catsOf = (f) => CATS[(f && f.kind) || ""] || [String((f && f.cat) || "")];

function companions(inv, f) {
  if (!f || f.kind !== "model") return [];
  return ((inv && inv.files) || []).filter((x) => x.kind === "vae" || x.kind === "te");
}
/** sizes agree (pure): unknown on either side = agree; else within 1 % */
function sameSize(a, b) { const x = +a || 0, y = +b || 0; return !x || !y || Math.abs(x - y) <= Math.max(x, y) * 0.01; }
function findIn(inv, f) {
  if (!inv || !f) return null;
  const cs = catsOf(f), r = norm(f.rel).toLowerCase(), b = base(f.rel);
  const L = (inv.files || []).filter((x) => cs.includes(x.cat) && sameSize(x.size, f.size));
  return L.find((x) => norm(x.rel).toLowerCase() === r) || L.find((x) => base(x.rel) === b) || null;
}
const VRAM = [[/B200/i, 180], [/H200/i, 141], [/H100/i, 80], [/A100.*40/i, 40], [/A100/i, 80], [/MI300/i, 192], [/RTX PRO 6000/i, 96], [/6000 Ada/i, 48],
  [/L40S?/i, 48], [/A6000/i, 48], [/A40\b/i, 48], [/A5000/i, 24], [/A4500/i, 20], [/A4000/i, 16], [/5090/, 32], [/5080/, 16], [/4090/, 24], [/4080/, 16],
  [/3090/, 24], [/3080/, 10], [/L4\b/i, 24], [/T4\b/i, 16], [/V100/i, 16]];
function vramOf(gpu) { const g = String(gpu || ""); for (const [rx, gb] of VRAM) if (rx.test(g)) return gb; return 0; }
const gb = (n) => Math.round((+n || 0) / 1e8) / 10;
function stateOf(s) { const t = String(s || "").toUpperCase(); return /RUNNING/.test(t) ? "running" : /STARTING|PROVISIONING|CREATED|RESTARTING/.test(t) ? "starting" : /EXITED|STOPPED/.test(t) ? "stopped" : /TERMINATED/.test(t) ? "terminated" : "unknown"; }

function where(file, comps, invs, status, nopodId) {
  const st = status || {}, has = [], others = [], want = [file].concat(comps || []);
  for (const inv of invs || []) {
    if (!inv || inv.gone || inv.id === nopodId) continue;
    const s = st[inv.id] || {}, state = stateOf(s.status);
    if (state === "terminated") continue;
    const there = [], missing = [];
    let send = 0;
    for (const f of want) { if (findIn(inv, f)) there.push(base(f.rel)); else { missing.push(base(f.rel)); send += +f.size || 0; } }
    const hasModel = !!findIn(inv, file), free = inv.disk && +inv.disk.free > 0 ? +inv.disk.free : 0;
    const warn = [];
    if (free && send > free) warn.push("not enough room on it (" + gb(free) + " GB free)");
    const vram = vramOf(s.gpu), need = +file.size || 0;
    if (file.kind === "model" && vram && need > vram * 1e9 * 0.95) warn.push("may not fit its " + vram + " GB card");
    const row = { id: inv.id, name: inv.name || inv.id, label: String(inv.name || inv.id), status: state, gpu: s.gpu || "", has_model: hasModel, there, missing,
      send_bytes: send, send_gb: gb(send), free_gb: free ? gb(free) : 0, last_seen: inv.listed_at || inv.at || 0, warn };
    (hasModel ? has : others).push(row);
  }
  const rank = (x) => ({ running: 0, starting: 1, stopped: 2 }[x.status] === undefined ? 3 : { running: 0, starting: 1, stopped: 2 }[x.status]);
  has.sort((a, b) => rank(a) - rank(b) || a.send_bytes - b.send_bytes || a.name.localeCompare(b.name));
  others.sort((a, b) => rank(a) - rank(b) || a.send_bytes - b.send_bytes || a.name.localeCompare(b.name));
  return { has, others };
}
/** the words for a row (pure): "VAE + text encoder there, sends 6.9 GB" / "all there" / "sends 12 GB" */
function rowWords(r) {
  const parts = [];
  if (r.has_model && !r.missing.length) parts.push("everything is there");
  else if (r.there.length) parts.push(r.there.join(" + ") + " there");
  if (r.missing.length) parts.push("sends " + (r.send_gb ? r.send_gb + " GB" : r.missing.join(" + ")));
  return parts.concat(r.warn || []).join(", ");
}
function mergeTodo(files, adds) {
  const L = (files || []).slice();
  for (const f of adds || []) {
    if (!f || !f.rel) continue;
    if (L.some((x) => x.cat === f.cat && norm(x.rel).toLowerCase() === norm(f.rel).toLowerCase())) continue;
    L.push({ cat: f.cat, rel: norm(f.rel), size: +f.size || 0, kind: f.kind || "other", state: "todo" });
  }
  return L;
}
function refMap(from, to, prefix) {
  const f = String(from || ""), lf = f.toLowerCase();
  if (!f) return () => null;
  return (v) => {
    const lv = String(v).toLowerCase();
    if (prefix) return lv.startsWith(lf) ? to + String(v).slice(f.length) : null;
    return lv === lf ? to : null;
  };
}
function renameIn(obj, map) {
  let n = 0;
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (typeof v === "string") { const w = map(v); if (w != null && w !== v) { o[k] = w; n++; } }
      else if (v && typeof v === "object") walk(v);
    }
  };
  walk(obj);
  return n;
}
module.exports = { CATS, catsOf, companions, sameSize, findIn, vramOf, stateOf, where, rowWords, mergeTodo, refMap, renameIn };
