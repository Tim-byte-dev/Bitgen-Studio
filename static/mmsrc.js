/* bitGen Studio — static/mmsrc.js (2.790.0): 🧩 MODEL MANAGER - ☐ Local ☐ RunPod ☐ OpenRouter ☐ All, AND 🗑 FOR EVERY CARD.
 * Tim (verbatim): "in model manager docker add checkboxes for local - runpod - openrouter - all use this to filter the models the
 * user uses, allow user to delete models, if model is local delete the model (exists but without the local clause), if model is
 * remote or runpod remove it from the list"
 *   load(jget, refresh)  this computer's cards (GET /api/modelmgr/cards?local=1 - in remote mode too) + RunPod's (remote_models.json
 *                        + every pod's files) + your OpenRouter picture / video models (GET /api/modelmgr/sources) in ONE list
 *                        for the Models / LoRAs / 📌 tabs; remote_list = remote mode (the ⇪ pods bar as before)
 *   shown(c)             the ticks (kept in localStorage h3.mmsrc): a card shows when its source is ticked; All = the three
 *   barHtml / tag        the ticks in the search bar, a small "Local / RunPod / OpenRouter" tag on each card
 *   remove(key)          🗑 on a RunPod / OpenRouter card = off its list (POST /api/modelmgr/sources/remove) - a card of this
 *                        computer keeps the 🗑 that deletes the file (static/modelmgr.js delModel, asks first)
 * Pure (Node: scripts/test-mmsources790.js): merge, shown, counts, barHtml, tagHtml.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && root.document) root.H3MmSrc = api.live(root);
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  var SOURCES = [["local", "Local", "This computer's ComfyUI folders"], ["runpod", "RunPod", "Your pods' files + runpod/pods/remote_models.json"], ["openrouter", "OpenRouter", "Your OpenRouter picture + video models"]];
  var esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  /** this computer's answer + the other places' cards -> one answer (pure) */
  function merge(local, rp, or, mode) {
    var base = local && !local.error ? local : { models: [], loras: [], vae: [], te: [], families: [], categories: (local && local.categories) || [], model_types: (local && local.model_types) || [], templates: (local && local.templates) || [], warnings: local && local.error ? ["this computer's models: " + local.error] : [] };
    var tagL = function (c) { return Object.assign({}, c, { source: c.source || "local" }); };
    var d = Object.assign({}, base, {
      models: (base.models || []).map(tagL).concat((rp && rp.models) || [], (or && or.models) || []),
      loras: (base.loras || []).map(tagL).concat((rp && rp.loras) || []),
      remote_list: !!(mode && mode.pods_mode), sources: true });
    var fam = (d.families || []).slice(), have = {};
    fam.forEach(function (f) { have[f.id] = 1; });
    d.models.concat(d.loras).forEach(function (c) { if (c.family && !have[c.family]) { have[c.family] = 1; fam.push({ id: c.family, label: c.family_label || c.family, category: c.category }); } });
    d.families = fam;
    return d;
  }
  function shown(c, src) { var s = src || {}; return s[(c && c.source) || "local"] !== false; }
  function counts(cards) { var n = { local: 0, runpod: 0, openrouter: 0 }; (cards || []).forEach(function (c) { var k = c.source || "local"; if (n[k] != null) n[k]++; }); return n; }
  function barHtml(src, n) {
    var s = src || {}, all = SOURCES.every(function (x) { return s[x[0]] !== false; });
    return '<span class="mmsrc" role="group" aria-label="Where the models are" style="display:inline-flex;gap:8px;align-items:center;white-space:nowrap;font-size:.72rem">'
      + SOURCES.map(function (x) { return '<label title="' + esc(x[2]) + '"><input type="checkbox" data-mmsrc="' + x[0] + '"' + (s[x[0]] !== false ? " checked" : "") + "> " + x[1] + (n ? " " + (n[x[0]] || 0) : "") + "</label>"; }).join("")
      + '<label title="Every place"><input type="checkbox" data-mmsrc="all"' + (all ? " checked" : "") + "> All</label></span>";
  }
  function tagHtml(c) {
    var k = (c && c.source) || "local";
    var t = k === "runpod" ? (c.nopod ? "NO_Pod" : "RunPod") : k === "openrouter" ? "OpenRouter" : "Local";
    return '<span class="tag src src-' + k + '" title="' + esc(k === "runpod" ? (c.pod_name ? "On " + c.pod_name : "runpod/pods/remote_models.json") : k === "openrouter" ? (c.endpoint || "OpenRouter") : "This computer") + '">' + esc(t) + "</span>";
  }

  function live(win) {
    var LS = "h3.mmsrc", S = { src: { local: true, runpod: true, openrouter: true } };
    try { var j = JSON.parse(win.localStorage.getItem(LS) || "null"); if (j) SOURCES.forEach(function (x) { if (j[x[0]] === false) S.src[x[0]] = false; }); } catch (e) { /* private window */ }
    function keep() { try { win.localStorage.setItem(LS, JSON.stringify(S.src)); } catch (e) { /* fine */ } }
    function load(jget, refresh) {
      var none = function () { return {}; };
      return Promise.all([
        jget("/api/modelmgr/cards?local=1" + (refresh ? "&refresh=1" : "")).catch(function (e) { return { error: e.message }; }),
        jget("/api/modelmgr/sources?src=runpod").catch(none),
        jget("/api/modelmgr/sources?src=openrouter").catch(none),
        jget("/api/remotemodels/mode").catch(none)
      ]).then(function (r) { return merge(r[0], r[1], r[2], r[3]); });
    }
    function set(k, on) {
      if (k === "all") SOURCES.forEach(function (x) { S.src[x[0]] = !!on; }); else S.src[k] = !!on;
      keep();
    }
    function remove(key) {
      return win.fetch("/api/modelmgr/sources/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: key }) }).then(function (r) { return r.json(); });
    }
    return { SOURCES: SOURCES, merge: merge, counts: counts, tagHtml: tagHtml, load: load, set: set, remove: remove,
      shown: function (c) { return shown(c, S.src); }, barHtml: function (n) { return barHtml(S.src, n); }, state: function () { return S; } };
  }
  return { SOURCES: SOURCES, merge: merge, shown: shown, counts: counts, barHtml: barHtml, tagHtml: tagHtml, live: live };
});
