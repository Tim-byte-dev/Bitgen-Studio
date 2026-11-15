/* bitGen Studio — lib/mmSources.js (2.790.0): 🧩 MODEL MANAGER'S CARDS FROM EVERY PLACE YOUR MODELS ARE - this computer, RunPod,
 * OpenRouter - so ☐ Local ☐ RunPod ☐ OpenRouter ☐ All can filter them (static/mmsrc.js), and 🗑 does the right thing for each.
 * Tim (verbatim): "in model manager docker add checkboxes for local - runpod - openrouter - all use this to filter the models the
 * user uses, allow user to delete models, if model is local delete the model (exists but without the local clause), if model is
 * remote or runpod remove it from the list"
 *   local       GET /api/modelmgr/cards?local=1 (as before - lib/modelCards.js; 🗑 deletes the file, lib/modelDelete.js)
 *   runpod      runpod/pods/remote_models.json (lib/remoteModels.js cards - "rm:<id>", ✕ takes it off the list) + every pod's
 *               files (lib/podInv.js, 2.787.0) as "pi:<pod>|<cat>|<rel>" cards named "<pod name>/<rel>" (the name Basic Settings'
 *               lists use - picking one renders on that pod); 🗑 = taken off the lists (podInv.hide - the pod keeps the file)
 *   openrouter  your OpenRouter picture + video models (lib/orModels.js mine) as "or:<type>:<id>" cards named "openrouter/<id>";
 *               🗑 = taken off your list (orModels.remove)
 * Every card says where it is: source local | runpod | openrouter.
 * Pure (scripts/test-mmsources790.js): podCards, orCard.
 */
"use strict";
const MC = () => require("./modelCards");

/** a pod's files as cards (pure; mk = modelCards.cardFrom, PI = lib/podInv's pure parts) */
function podCards(invs, mk, PI) {
  const out = { models: [], loras: [] };
  for (const inv of invs || []) {
    if (!PI.listed(inv)) continue;
    const lab = PI.labelOf(inv), hid = new Set(inv.hidden || []);
    for (const f of inv.files || []) {
      if (!PI.LIST_CATS.includes(f.cat) || hid.has(f.cat + "/" + f.rel)) continue;
      const c = mk({ cat: f.cat, name: f.rel, size: f.size }, null, null, {}, {});
      Object.assign(c, { key: "pi:" + inv.id + "|" + f.cat + "|" + f.rel, name: lab + "/" + f.rel, title: f.rel.split("/").pop().replace(/\.[^.]+$/, ""), source: "runpod", pi: true,
        pod: inv.id, pod_name: lab, pod_cat: f.cat, pod_rel: f.rel, nopod: !!inv.gone, folder: lab, file_date: "",
        description: (inv.gone ? "On " + lab + " - its pod was terminated; picking it asks before the pod is made again." : "On the pod " + lab + (f.state === "sent" ? " (bitGen sent it)" : "") + " - picking it renders there.") });
      (f.cat === "loras" ? out.loras : out.models).push(c);
    }
  }
  return out;
}
/** one of your OpenRouter models as a card (pure) */
function orCard(m, type, familyLabel) {
  const maker = m.maker || String(m.id).split("/")[0];
  return { key: "or:" + type + ":" + m.id, name: "openrouter/" + m.id, title: m.name || m.id, kind: "model", cat: "openrouter", source: "openrouter", or: true, or_type: type, or_id: m.id,
    family: "or:" + maker, family_label: familyLabel ? familyLabel(maker) : maker, category: type === "video" ? "video" : "image", model_type: (type === "video" ? "Video" : "Picture") + " API",
    dead: !!m.dead, or_state: m.dead ? "dead" : m.free ? "free" : "paid",
    description: (m.dead ? "No longer on OpenRouter - 🗑 takes it off. " : "") + (m.free ? "Free" : m.price || "Paid") + " · renders at " + (m.endpoint || "OpenRouter") + (m.desc ? " - " + m.desc : ""), endpoint: m.endpoint || "", price: m.price || "", free: !!m.free,
    folder: "OpenRouter", released: m.added ? "added " + new Date(m.added).toISOString().slice(0, 10) : "", file_date: "", thumb: false, size: 0 };
}

/* ---------------- live */
function runpod() {
  const RM = require("./remoteModels"), PI = require("./podInv"), out = { models: [], loras: [] };
  try { const c = RM.cards(); out.models.push(...c.models.map((x) => Object.assign(x, { source: "runpod" }))); out.loras.push(...c.loras.map((x) => Object.assign(x, { source: "runpod" }))); } catch { /* no list */ }
  try { const p = podCards(PI.live(), MC().cardFrom, PI); out.models.push(...p.models); out.loras.push(...p.loras); } catch { /* no pods */ }
  return out;
}
function openrouter() {
  const OM = require("./orModels"), mine = OM.mine(), models = [];
  for (const t of ["image", "video"]) for (const m of mine[t] || []) models.push(orCard(m, t, OM.familyLabel));
  return { models, loras: [] };
}
/** 🗑 on a card that is not on this computer: taken off its list -> {ok, said} */
function remove(key) {
  const k = String(key || "");
  let m = /^rm:(.+)$/.exec(k);
  if (m) { const ok = require("./remoteModels").remove(m[1]); return { ok: !!ok, said: ok ? "taken off runpod/pods/remote_models.json (the pods keep their copies)" : "not in the list" }; }
  m = /^pi:([A-Za-z0-9]+)\|([^|]+)\|(.+)$/.exec(k);
  if (m) { const r = require("./podInv").hide(m[1], m[2], m[3]); return { ok: !!r, said: r ? "taken off the lists - the pod keeps the file (🖥 PODS ▸ 📁 Files deletes it there)" : "that pod does not have it" }; }
  m = /^or:(image|video|llm|vlm):(.+)$/.exec(k);
  if (m) { const r = require("./orModels").remove(m[1], m[2]); return { ok: !!r.removed, said: r.removed ? "taken off your OpenRouter models" : "not in your OpenRouter models" }; }
  throw Object.assign(new Error("a card of this computer is deleted from the disk (🗑 asks first)"), { status: 400 });
}
module.exports = { podCards, orCard, runpod, openrouter, remove };
