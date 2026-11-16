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
 * 2.796.0 (Tim: "the model manager filters are not working, clean up the ui a little, use dropdowns instead of radiogroups if
 * possible"): THE BUG - a card of this computer already has a `source` of its own (how its Civitai details were matched: "name",
 * "sha256" …), so merge() kept it and every local card counted / filtered as that word: the counts said 0 and unticking Local hid
 * nothing. The place is now c.place (placeOf). The four ticks are ONE dropdown #mmPlace: All places / This computer / RunPod /
 * OpenRouter, each with its count (kept in localStorage h3.mmsrc as {place}).
 * Pure (Node: scripts/test-mmsources790.js): merge, placeOf, shown, counts, barHtml, tagHtml.
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
    var tagL = function (c) { return Object.assign({}, c, { place: "local" }); };   // 2.796.0: c.source is the card's own (how it was matched)
    var tagR = function (k) { return function (c) { return Object.assign({}, c, { place: k }); }; };
    var d = Object.assign({}, base, {
      models: (base.models || []).map(tagL).concat(((rp && rp.models) || []).map(tagR("runpod")), ((or && or.models) || []).map(tagR("openrouter"))),
      loras: (base.loras || []).map(tagL).concat(((rp && rp.loras) || []).map(tagR("runpod"))),
      remote_list: !!(mode && mode.pods_mode), sources: true });
    var fam = (d.families || []).slice(), have = {};
    fam.forEach(function (f) { have[f.id] = 1; });
    d.models.concat(d.loras).forEach(function (c) { if (c.family && !have[c.family]) { have[c.family] = 1; fam.push({ id: c.family, label: c.family_label || c.family, category: c.category }); } });
    d.families = fam;
    return d;
  }
  /** where a card is: local | runpod | openrouter (2.796.0 - c.place; a card from before merge() by its source) */
  function placeOf(c) { var k = c && c.place; if (k) return k; k = c && c.source; return k === "runpod" || k === "openrouter" ? k : "local"; }
  /** place = "all" | "local" | "runpod" | "openrouter" */
  function shown(c, place) { var p = typeof place === "string" ? place : "all"; return p === "all" || placeOf(c) === p; }
  function counts(cards) { var n = { local: 0, runpod: 0, openrouter: 0 }; (cards || []).forEach(function (c) { var k = placeOf(c); if (n[k] != null) n[k]++; }); return n; }
  /** the place dropdown (pure): place + the counts */
  function barHtml(place, n) {
    var p = place || "all", c = n || {}, tot = (c.local || 0) + (c.runpod || 0) + (c.openrouter || 0);
    var sel = function (v) { return '<option value="' + v + '"' + (p === v ? " selected" : "") + ">"; };   // the words written out, so the translator sees them
    return '<select id="mmPlace" data-mmsrc="place" aria-label="Where the models are" title="Where the models are - this computer, your pods or OpenRouter">'
      + sel("all") + "All places (" + tot + ")</option>" + sel("local") + "This computer (" + (c.local || 0) + ")</option>"
      + sel("runpod") + "RunPod (" + (c.runpod || 0) + ")</option>" + sel("openrouter") + "OpenRouter (" + (c.openrouter || 0) + ")</option></select>";
  }
  function tagHtml(c) {
    var k = placeOf(c);
    var t = k === "runpod" ? (c.nopod ? "NO_Pod" : "RunPod") : k === "openrouter" ? "OpenRouter" : "Local";
    return '<span class="tag src src-' + k + '" title="' + esc(k === "runpod" ? (c.pod_name ? "On " + c.pod_name : "runpod/pods/remote_models.json") : k === "openrouter" ? (c.endpoint || "OpenRouter") : "This computer") + '">' + esc(t) + "</span>";
  }

  function live(win) {
    var LS = "h3.mmsrc", S = { place: "all" };
    try { var j = JSON.parse(win.localStorage.getItem(LS) || "null"); if (j && /^(all|local|runpod|openrouter)$/.test(j.place || "")) S.place = j.place; } catch (e) { /* private window */ }
    function keep() { try { win.localStorage.setItem(LS, JSON.stringify({ place: S.place })); } catch (e) { /* fine */ } }
    function load(jget, refresh) {
      var none = function () { return {}; };
      return Promise.all([
        jget("/api/modelmgr/cards?local=1" + (refresh ? "&refresh=1" : "")).catch(function (e) { return { error: e.message }; }),
        jget("/api/modelmgr/sources?src=runpod").catch(none),
        jget("/api/modelmgr/sources?src=openrouter").catch(none),
        jget("/api/remotemodels/mode").catch(none)
      ]).then(function (r) { return merge(r[0], r[1], r[2], r[3]); });
    }
    function set(v) { S.place = /^(all|local|runpod|openrouter)$/.test(v || "") ? v : "all"; keep(); }
    function remove(key) {
      return win.fetch("/api/modelmgr/sources/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: key }) }).then(function (r) { return r.json(); });
    }
    return { SOURCES: SOURCES, merge: merge, counts: counts, tagHtml: tagHtml, load: load, set: set, remove: remove,
      placeOf: placeOf, shown: function (c) { return shown(c, S.place); }, barHtml: function (n) { return barHtml(S.place, n); }, state: function () { return S; } };
  }
  return { SOURCES: SOURCES, merge: merge, placeOf: placeOf, shown: shown, counts: counts, barHtml: barHtml, tagHtml: tagHtml, live: live };
});
