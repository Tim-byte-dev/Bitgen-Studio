/* bitGen Studio — static/remotehosts.js (2.785.0): "RUNS ON" - ONE DROPDOWN PER TYPE AT THE TOP OF THE ☁ REMOTE GENERATION
 * DOCKER (window.H3RemoteHosts; lib/remoteHosts.js, GET / POST /api/remotehosts).
 *
 * Tim (verbatim): "remove the radiogroups from remote generation docker, replace them with a dropdown, local, runpod,
 * openrouter,LAN,Team (gray out lan and team for now , until we get them working) for each type. show the pods button in
 * statusbar only if one of the selections is runpod" + "go"
 *   Set all          one dropdown that sets every row (a choice a row cannot take is skipped - OpenRouter sets the LLMs only)
 *   Image · Video · Music · Text to speech · Speech to text · Song separation · LLM · Vision LLM
 *                    Local / RunPod / OpenRouter / LAN / Team - greyed ones say why in their words; a line under a row says
 *                    where it runs now (the pod for it, or what is missing)
 *   The old radio groups (All local / All remote / Both, Remote servers, each type's Local / Remote, the LLM rows) are hidden -
 *   their status lines stay. RunPod ▸ Pods / Serverless stays in Settings ▸ Remote generation.
 * Pure (Node: scripts/test-remotehosts785.js): optionText, setAllValue.
 */
(function (root) {
  "use strict";
  var SHORT = { "not working yet - coming later": "coming later", "OpenRouter does not run this in bitGen": "LLMs only" };
  /** an option's words (pure): a greyed one says why in a few words */
  function optionText(o) {
    if (!o.off) return o.label;
    return o.label + " (" + (SHORT[o.why] || (/next release/.test(o.why) ? "next release" : "not available")) + ")";
  }
  /** what the Set all dropdown shows (pure): the one host every row is on, else "" (mixed) */
  function setAllValue(hosts) {
    var v = Object.keys(hosts || {}).map(function (k) { return hosts[k]; });
    return v.length && v.every(function (h) { return h === v[0]; }) ? v[0] : "";
  }
  var pure = { optionText: optionText, setAllValue: setAllValue };
  if (typeof module === "object" && module.exports && !root.document) { module.exports = pure; return; }

  var doc = root.document, S = { v: null, g: null, busy: false };
  function $(id) { return doc.getElementById(id); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var CSS = "#rgdWhere #gpuWhere,#rgdWhere #gpuLine,.rtSec[data-rtsec=\"servers\"],.rtSec .rtGrid,#gpuLlmWhere .rpRow,#rgdBody .rtSec #gpuLlmWhere .rpRow{display:none!important}"
    + ".rtSec[data-rtsec=\"gen\"]:not(:has(#rpSt_video:not(:empty))),.rtSec[data-rtsec=\"audio\"]{display:none!important}"
    + ".rhGrid{display:grid;grid-template-columns:minmax(110px,max-content) minmax(140px,260px);gap:4px 12px;align-items:center}"
    + ".rhGrid .rhName{font-size:.78rem}.rhGrid select{font-size:.76rem;width:100%}.rhGrid .rhNote{grid-column:2;font-size:.68rem;margin:-2px 0 2px}.rhGrid .rhNote:empty{display:none}"
    + ".rhGrid .rhAll{font-weight:600}.rhGrid hr{grid-column:1/-1;border:0;border-top:1px solid var(--line,#3a342a);margin:2px 0;width:100%}";
  function sel(k, opts, host) {
    return '<select data-rhkind="' + esc(k) + '" aria-label="' + esc(k) + ' runs on">' + (k === "all" ? '<option value="">— mixed —</option>' : "")
      + opts.map(function (o) { return '<option value="' + esc(o.id) + '"' + (o.off ? " disabled" : "") + (o.id === host ? " selected" : "") + ' title="' + esc(o.why || "") + '">' + esc(optionText(o)) + "</option>"; }).join("") + "</select>";
  }
  function noteOf(k) {
    var v = S.v, h = v.hosts[k], g = S.g || {};
    if (h === "local") return "";
    var row = (v.kinds || []).filter(function (x) { return x.k === k; })[0];
    if (/^local:\d+$/.test(h)) return (row && row.note) || "";   // 2.794.0: a card of its own - what runs there (lib/remoteHosts.js cardNote)
    if (h === "openrouter" && row && row.note) return row.note;   // 2.786.0: the picture / video model on OpenRouter + its price
    if (h === "runpod" && root.H3RemoteTypes && H3RemoteTypes.noteOf && ["image", "video", "music", "tts", "stt", "stems"].indexOf(k) >= 0) return H3RemoteTypes.noteOf(g, k);
    if (k === "llm" || k === "vlm") return h === "openrouter" ? "pick the model in the prompt docker's list" : "on your pod - set up when you first send a prompt";
    return "";
  }
  function paint() {
    var box = $("rgdWhere"); if (!box || !S.v) return;
    if (!$("rhCss")) { var st = doc.createElement("style"); st.id = "rhCss"; st.textContent = CSS; doc.head.appendChild(st); }
    var h4 = box.querySelector("h4"); if (h4 && h4.textContent !== "Runs on") h4.textContent = "Runs on";
    var g = $("rhGrid");
    if (!g) { g = doc.createElement("div"); g.id = "rhGrid"; g.className = "rhGrid"; g.setAttribute("role", "group"); g.setAttribute("aria-label", "Where each type of work runs");
      if (h4 && h4.nextSibling) box.insertBefore(g, h4.nextSibling); else box.appendChild(g); }
    var all = S.v.kinds[0].options.map(function (o) { return { id: o.id, label: o.label, off: o.id === "lan" || o.id === "team", why: o.id === "lan" || o.id === "team" ? o.why : "" }; });
    var html = '<span class="rhName rhAll" title="Every type at once - a choice a type cannot take is skipped">Set all</span>' + sel("all", all, setAllValue(S.v.hosts)) + "<hr>";
    S.v.kinds.forEach(function (x) { var n = noteOf(x.k);
      html += '<span class="rhName">' + esc(x.label) + "</span>" + sel(x.k, x.options, x.host) + '<span class="hint rhNote" id="rhNote_' + esc(x.k) + '"' + (/^✗/.test(n) ? ' style="color:var(--bad,#e66)"' : "") + ">" + esc(n) + "</span>"; });
    if (g.dataset.html !== html) { g.dataset.html = html; g.innerHTML = html;
      g.querySelectorAll("select").forEach(function (s) { s.onchange = function () { if (s.value) choose(s.dataset.rhkind, s.value); }; s.addEventListener("keydown", function (e) { e.stopPropagation(); }); }); }
  }
  function say(t) { var m = $("gpuMsg"); if (m) m.textContent = t || ""; }
  function choose(kind, host) {
    S.busy = true; say("");
    return root.fetch("/api/remotehosts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: kind, host: host }) })
      .then(function (r) { return r.json(); }).then(function (v) {
        S.busy = false;
        if (v.error) { say("✗ " + v.error); return load(); }
        S.v = v; if (v.mode_switch && v.mode_switch.note) say(v.mode_switch.note);
        try { doc.dispatchEvent(new Event("h3:rgpu")); } catch (e) { /* the other parts reload */ }
        if (v.mode_switch && v.mode_switch.changed && root.H3RemoteModels && H3RemoteModels.recheck) H3RemoteModels.recheck(true);
        return loadSplit().then(paint);
      }).catch(function () { S.busy = false; });
  }
  function loadSplit() { return root.fetch("/api/gpusplit").then(function (r) { return r.json(); }).then(function (g) { if (g && g.where) S.g = g; }).catch(function () { /* fine */ }); }
  function load() {
    return Promise.all([root.fetch("/api/remotehosts").then(function (r) { return r.json(); }), loadSplit()]).then(function (a) { if (a[0] && a[0].kinds) { S.v = a[0]; paint(); } return S.v; }).catch(function () { /* offline */ });
  }
  function boot() {
    if (!$("rgdWhere")) { setTimeout(boot, 400); return; }
    load();
    doc.addEventListener("h3:rgpu", function () { if (!S.busy) setTimeout(load, 300); });
    setInterval(function () { var b = $("rgdWhere"); if (b && b.offsetParent !== null && !S.busy) load(); }, +(root.H3_RH_POLL || 8000));
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3RemoteHosts = Object.assign({ load: load, choose: choose, state: function () { return S; } }, pure);
})(typeof window !== "undefined" ? window : globalThis);
