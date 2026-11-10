// bitGen Studio — lib/podShortcuts.js (2.754.0): POD SHORTCUTS - RunPod templates to deploy, kept in the Remote
// generation docker (static/remotedock.js).
// Tim (verbatim): "i would like to add public pods to my account is it possible to have a shortcut to them?"
//   A "public pod" is a public TEMPLATE (RunPod's Explore page: runpod.io/console/explore/<id>) that you deploy into your
//   own account. RunPod's API lists only your own templates (GET /v2/templates - "owned by the authenticated user"), so
//   the shortcuts are the ones you add: paste the template's page link (or its deploy link, or its ID) and a name.
//   Deploy ↗ opens RunPod's deploy page with the template picked and bitGen's referral code:
//     https://runpod.io/console/deploy?template=<id>&ref=gbj9zxqh
//   rgpu.pod_shortcuts = [{id, name}]  (20 at most)
// Pure (scripts/test-remotedock754.js): REF, templateId, deployUrl, pageUrl, EXPLORE.
"use strict";

const REF = "gbj9zxqh";                                   // bitGen's RunPod referral code (2.753.1)
const EXPLORE = "https://www.runpod.io/console/explore";
const MAX = 20;
const ID = /^[a-z0-9]{6,20}$/i;

/** a pasted link or ID -> the template's ID, "" when none (pure)
 *    https://www.runpod.io/console/explore/57we0zdwtt · https://console.runpod.io/hub/... ?template=57we0zdwtt · 57we0zdwtt */
function templateId(text) {
  const s = String(text || "").trim();
  if (!s) return "";
  const q = /[?&]template=([A-Za-z0-9]+)/.exec(s);
  if (q && ID.test(q[1])) return q[1];
  const e = /\/explore\/([A-Za-z0-9]+)(?:[/?#]|$)/.exec(s);
  if (e && ID.test(e[1])) return e[1];
  return ID.test(s) && !/^https?/i.test(s) ? s : "";
}
const deployUrl = (id) => `https://runpod.io/console/deploy?template=${encodeURIComponent(id)}&ref=${REF}`;
const pageUrl = (id) => `${EXPLORE}/${encodeURIComponent(id)}`;

/* ---------------- live */
function core() { return require("./core"); }
function list() {
  const r = ((core().getConfig() || {}).rgpu) || {};
  return (Array.isArray(r.pod_shortcuts) ? r.pod_shortcuts : []).filter((x) => x && ID.test(x.id || ""))
    .map((x) => ({ id: x.id, name: String(x.name || x.id).slice(0, 80), deploy: deployUrl(x.id), page: pageUrl(x.id) }));
}
/** {add: {name, link}} | {remove: id} -> the list */
function change(b) {
  const c = core().getConfig(), r = c.rgpu = c.rgpu || { mode: "local" };
  let cur = Array.isArray(r.pod_shortcuts) ? r.pod_shortcuts.slice() : [];
  if (b && b.add) {
    const id = templateId(b.add.link || b.add.id);
    if (!id) { const e = new Error("that is not a RunPod template link - copy it from the template's page (runpod.io ▸ Explore ▸ the template)"); e.status = 400; throw e; }
    const name = String(b.add.name || "").trim().slice(0, 80) || id;
    cur = cur.filter((x) => x.id !== id);
    cur.push({ id, name });
    if (cur.length > MAX) { const e = new Error(`${MAX} shortcuts at most - remove one first`); e.status = 400; throw e; }
  }
  if (b && b.remove) cur = cur.filter((x) => x.id !== String(b.remove));
  r.pod_shortcuts = cur; core().setConfig(c);
  return list();
}

module.exports = { REF, EXPLORE, MAX, templateId, deployUrl, pageUrl, list, change };
