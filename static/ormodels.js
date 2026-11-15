/* bitGen Studio — static/ormodels.js (2.786.0): ☁ REMOTE GENERATION ▸ OPENROUTER MODELS… - THE DIALOG (window.H3OrModels;
 * routes/orModels.js, lib/orModels.js).
 *
 * Tim (verbatim): "Add an openrouter button to remote generation docker to select models to use, show dialog with free and paid
 * models and tabs for each type and inside each type have tabs for each family + 1 tab for all - but show price for paid
 * service. use 2 frames in the dialog 1 tab to show available models and 1 to show added models, when user double clicks model
 * then add the model to users models with a delete button at the end of each model name. when user closes the dialog update all
 * the dropdowns with the new lists"
 *   Type tabs      Image · Video · LLM · Vision LLM (how many of yours each)
 *   Family tabs    All + each maker (Google, OpenAI, ByteDance Seed …) with how many models
 *   Search, ☑ Free ☑ Paid, sort (name / cheapest / newest), ⟳ asks OpenRouter again
 *   Available      OpenRouter's models of that type + family: name, price (free in green, paid with its price), ✓ = yours.
 *                  Double-click (or Enter) adds it to yours; a click shows its details below
 *   My models      yours of that type, each with 🗑 at the end
 *   Closing (✕, Esc, outside) sends "h3:ormodels" - static/ormine.js puts the lists into the dropdowns as "openrouter/<id>".
 *   A model OpenRouter no longer lists is taken off yours when the dialog asks (the line under the frames says which).
 * Pure (Node: scripts/test-ormodels786.js): filterList, sortList, typeLabel.
 */
(function (root) {
  "use strict";
  var TYPES = [["image", "Image"], ["video", "Video"], ["llm", "LLM"], ["vlm", "Vision LLM"]];
  function hay(m) { return [m.id, m.name, m.maker, m.price, m.free ? "free" : "paid", m.desc].join(" ").toLowerCase(); }
  /** the Available frame's models (pure): o = {fam, q, free, paid} */
  function filterList(models, o) {
    var x = o || {}, words = String(x.q || "").toLowerCase().split(/\s+/).filter(Boolean);
    return (models || []).filter(function (m) {
      if (x.fam && x.fam !== "all" && (m.maker || String(m.id).split("/")[0]) !== x.fam) return false;
      if (m.free ? x.free === false : x.paid === false) return false;
      var h = hay(m); return words.every(function (w) { return h.indexOf(w) >= 0; });
    });
  }
  function costOf(m) { return m.free ? 0 : m.usd != null ? +m.usd : m.in != null || m.out != null ? (+m.in || 0) + (+m.out || 0) : Infinity; }
  /** sorted (pure): name | price (cheapest first, unknown last) | newest */
  function sortList(list, by) {
    var cmp = by === "price" ? function (a, b) { return costOf(a) - costOf(b) || String(a.name).localeCompare(String(b.name)); }
      : by === "newest" ? function (a, b) { return (+b.created || 0) - (+a.created || 0) || String(a.name).localeCompare(String(b.name)); }
      : function (a, b) { return (b.free - a.free) || String(a.name).localeCompare(String(b.name)); };
    return (list || []).slice().sort(cmp);
  }
  /** a type tab's words (pure) */
  function typeLabel(t, n) { var l = (TYPES.filter(function (x) { return x[0] === t; })[0] || [t, t])[1]; return l + (n ? " (" + n + ")" : ""); }
  var pure = { TYPES: TYPES, filterList: filterList, sortList: sortList, typeLabel: typeLabel };
  if (typeof module === "object" && module.exports && !root.document) { module.exports = pure; return; }

  var doc = root.document;
  var S = { type: "image", fam: "all", q: "", free: true, paid: true, sort: "name", v: null, sel: "", busy: false, changed: false, ask: 0 };
  function $(id) { return doc.getElementById(id); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function post(u, b) { return root.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json(); }); }
  var CSS = "dialog.orDlg{width:min(1080px,96vw);height:min(760px,90vh);padding:12px 14px;display:none;flex-direction:column;gap:6px}"
    + "dialog.orDlg[open]{display:flex}.orDlg .orHead{display:flex;align-items:center;gap:10px}.orDlg .orHead h3{margin:0;font-size:1rem;flex:1}"
    + ".orDlg .orTabs{display:flex;gap:4px;flex-wrap:nowrap;overflow-x:auto;padding-bottom:2px}.orDlg .orTabs button{white-space:nowrap;font-size:.76rem;padding:3px 9px}"
    + ".orDlg .orTabs button[aria-selected=\"true\"]{background:var(--tiger,#f59e2c);color:#111;border-color:var(--tiger,#f59e2c)}"
    + ".orDlg .orBar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:.76rem}.orDlg .orBar input[type=search]{flex:1;min-width:160px}"
    + ".orDlg .orBar select{width:auto!important;flex:0 0 auto}.orDlg .orBar button,.orDlg .orBar label{flex:0 0 auto}"
    + ".orDlg .orFrames{display:grid;grid-template-columns:3fr 2fr;gap:10px;flex:1;min-height:0}"
    + ".orDlg .orFrames section{display:flex;flex-direction:column;min-height:0;border:1px solid var(--line,#3a342a);border-radius:8px;padding:6px 8px}"
    + ".orDlg .orFrames h4{margin:0 0 4px;font-size:.78rem}.orDlg .orList{list-style:none;margin:0;padding:0;overflow:auto;flex:1;min-height:0}"
    + ".orDlg .orList li{display:flex;gap:8px;align-items:center;padding:4px 6px;border-radius:5px;cursor:default;font-size:.78rem}"
    + ".orDlg .orList li:hover{background:var(--panel-2,rgba(255,255,255,.05))}.orDlg .orList li.sel{outline:1px solid var(--tiger,#f59e2c)}"
    + ".orDlg .orList .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.orDlg .orList small{color:var(--dim,#999)}"
    + ".orDlg .orPrice{white-space:nowrap;font-size:.72rem}.orDlg .orPrice.free{color:#7c7}.orDlg .orPrice.paid{color:var(--tiger,#f59e2c)}"
    + ".orDlg .orList .mine{color:#7c7}.orDlg .orList button{padding:1px 6px;font-size:.74rem}.orDlg #orDesc{min-height:2.6em;max-height:5.5em;overflow:auto}";
  function css() { if ($("orCss")) return; var s = doc.createElement("style"); s.id = "orCss"; s.textContent = CSS; doc.head.appendChild(s); }
  function build() {
    if ($("orDlg")) return $("orDlg");
    css();
    var d = doc.createElement("dialog"); d.id = "orDlg"; d.className = "orDlg"; d.setAttribute("aria-label", "OpenRouter models");
    d.innerHTML = '<div class="orHead"><h3>☁ OpenRouter models</h3><span class="hint" id="orDlgKey"></span><button type="button" class="ghost" id="orDlgX" title="Close - the dropdowns get your list">✕</button></div>'
      + '<div class="orTabs" id="orTypes" role="tablist" aria-label="Type"></div>'
      + '<div class="orTabs" id="orFams" role="tablist" aria-label="Family"></div>'
      + '<div class="orBar"><input type="search" id="orQ" placeholder="Search models" aria-label="Search models">'
      + '<label class="chk"><input type="checkbox" id="orFree" checked> Free</label><label class="chk"><input type="checkbox" id="orPaid" checked> Paid</label>'
      + '<select id="orSort" aria-label="Sort"><option value="name">Free first, by name</option><option value="price">Cheapest first</option><option value="newest">Newest first</option></select>'
      + '<button type="button" class="ghost" id="orRefresh" title="Ask OpenRouter again">⟳</button></div>'
      + '<div class="orFrames"><section aria-label="Available"><h4>Available <span class="hint" id="orAvN"></span></h4><div class="hint">Double-click a model (or Enter) to add it to yours</div><ul class="orList" id="orAvail" tabindex="0"></ul></section>'
      + '<section aria-label="My models"><h4>My models <span class="hint" id="orMyN"></span></h4><div class="hint">In the dropdowns as openrouter/&lt;model&gt;</div><ul class="orList" id="orMine"></ul></section></div>'
      + '<div class="hint" id="orMsg"></div><div class="hint" id="orDesc"></div>';
    doc.body.appendChild(d);
    $("orDlgX").onclick = close;
    d.addEventListener("cancel", function (e) { e.preventDefault(); close(); });
    d.addEventListener("click", function (e) { if (e.target === d) close(); });
    d.addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Enter" && e.target && e.target.id === "orAvail" && S.sel) add(S.sel); });
    $("orQ").addEventListener("input", function () { S.q = $("orQ").value; drawAvail(); });
    $("orFree").onchange = function () { S.free = $("orFree").checked; drawAvail(); };
    $("orPaid").onchange = function () { S.paid = $("orPaid").checked; drawAvail(); };
    $("orSort").onchange = function () { S.sort = $("orSort").value; drawAvail(); };
    $("orRefresh").onclick = function () { load(true); };
    $("orTypes").onclick = function (e) { var b = e.target.closest("[data-ort]"); if (b) { S.type = b.dataset.ort; S.fam = "all"; S.sel = ""; load(false); } };
    $("orFams").onclick = function (e) { var b = e.target.closest("[data-orf]"); if (b) { S.fam = b.dataset.orf; drawFams(); drawAvail(); } };
    var av = $("orAvail");
    av.addEventListener("click", function (e) { var li = e.target.closest("li[data-id]"); if (li) { S.sel = li.dataset.id; mark(); desc(li.dataset.id); } });
    av.addEventListener("dblclick", function (e) { var li = e.target.closest("li[data-id]"); if (li) add(li.dataset.id); });
    $("orMine").addEventListener("click", function (e) {
      var b = e.target.closest("[data-ordel]"); if (b) { remove(b.dataset.ordel); return; }
      var li = e.target.closest("li[data-id]"); if (li) desc(li.dataset.id, true);
    });
    return d;
  }
  function say(t, bad) { var m = $("orMsg"); if (m) { m.textContent = t || ""; m.style.color = bad ? "var(--bad,#e66)" : ""; } }
  function drawTypes() {
    var v = S.v || {}, n = {}; (v.types || []).forEach(function (t) { n[t.id] = t.n; });
    $("orTypes").innerHTML = TYPES.map(function (t) { return '<button type="button" class="ghost" role="tab" data-ort="' + t[0] + '" aria-selected="' + (t[0] === S.type) + '">' + esc(typeLabel(t[0], n[t[0]])) + "</button>"; }).join("");
  }
  function drawFams() {
    var f = (S.v && S.v.families) || [{ id: "all", label: "All", n: 0 }];
    if (!f.some(function (x) { return x.id === S.fam; })) S.fam = "all";
    $("orFams").innerHTML = f.map(function (x) { return '<button type="button" class="ghost" role="tab" data-orf="' + esc(x.id) + '" aria-selected="' + (x.id === S.fam) + '">' + esc(x.label) + " " + x.n + "</button>"; }).join("");
  }
  function priceHtml(m) { return '<span class="orPrice ' + (m.free ? "free" : "paid") + '">' + esc(m.free ? "free" : m.price || "paid") + "</span>"; }
  function mineIds() { return ((S.v && S.v.mine) || []).map(function (m) { return m.id; }); }
  function drawAvail() {
    var v = S.v || {}, ids = mineIds();
    var l = sortList(filterList(v.models, { fam: S.fam, q: S.q, free: S.free, paid: S.paid }), S.sort);
    $("orAvN").textContent = l.length + " of " + (v.models || []).length;
    $("orAvail").innerHTML = l.length ? l.map(function (m) {
      var on = ids.indexOf(m.id) >= 0;
      return '<li data-id="' + esc(m.id) + '"' + (m.id === S.sel ? ' class="sel"' : "") + ' title="' + esc(m.id + (m.desc ? " - " + m.desc.slice(0, 200) : "")) + '"><span class="nm"><b>' + esc(m.name) + "</b> <small>" + esc(m.id) + "</small></span>" + priceHtml(m) + (on ? ' <span class="mine" title="In your models">✓</span>' : "") + "</li>";
    }).join("") : '<li class="hint">' + (v.error ? "OpenRouter did not answer - " + esc(v.error) : (v.models || []).length ? "Nothing matches" : "Loading…") + "</li>";
  }
  function drawMine() {
    var l = (S.v && S.v.mine) || [];
    $("orMyN").textContent = String(l.length);
    $("orMine").innerHTML = l.length ? l.map(function (m) {
      return '<li data-id="' + esc(m.id) + '"><span class="nm"><b>' + esc(m.name) + "</b> <small>openrouter/" + esc(m.id) + "</small></span>" + priceHtml(m)
        + ' <button type="button" class="ghost" data-ordel="' + esc(m.id) + '" title="Take ' + esc(m.name) + ' off your models" aria-label="Delete ' + esc(m.name) + '">🗑</button></li>';
    }).join("") : '<li class="hint">None yet - double-click a model on the left.</li>';
  }
  function mark() { Array.prototype.forEach.call($("orAvail").querySelectorAll("li[data-id]"), function (li) { li.classList.toggle("sel", li.dataset.id === S.sel); }); }
  function desc(id, mine) {
    var l = mine ? (S.v.mine || []) : (S.v.models || []), m = l.filter(function (x) { return x.id === id; })[0] || (S.v.models || []).filter(function (x) { return x.id === id; })[0];
    var c = m && m.caps, bits = [];
    if (c && c.durations && c.durations.length) bits.push("lengths " + c.durations.join(", ") + " s");
    if (c && c.resolution && c.resolution.length) bits.push(c.resolution.join(" / "));
    if (c && c.aspect && c.aspect.length) bits.push("aspect " + c.aspect.slice(0, 8).join(", "));
    if (c && c.refs != null) bits.push("up to " + c.refs + " reference picture" + (c.refs === 1 ? "" : "s"));
    if (m && m.ctx) bits.push(Math.round(m.ctx / 1000) + "k context");
    $("orDesc").textContent = m ? (m.name + " - " + (m.free ? "free" : m.price || "paid") + (bits.length ? " · " + bits.join(" · ") : "") + (m.desc ? ". " + m.desc : "")) : "";
  }
  function draw() { drawTypes(); drawFams(); drawAvail(); drawMine(); }
  function load(force) {
    var my = ++S.ask;
    if (!S.v || S.v.type !== S.type) S.v = { type: S.type, models: [], mine: (S.v && S.v.type === S.type && S.v.mine) || [], families: null, types: S.v && S.v.types };
    draw(); say(force ? "Asking OpenRouter…" : "");
    return root.fetch("/api/ormodels?type=" + encodeURIComponent(S.type) + (force ? "&refresh=1" : "")).then(function (r) { return r.json(); }).then(function (v) {
      if (my !== S.ask) return;
      if (!v || v.error && !v.models) { say("✗ " + ((v && v.error) || "no answer"), true); return; }
      S.v = v; draw();
      $("orDlgKey").textContent = v.key ? "" : "Listing needs no key - rendering does: ⚙ Settings ▸ Remote generation ▸ OpenRouter";
      if (v.removed && v.removed.length) { S.changed = true; say("OpenRouter no longer lists " + v.removed.map(function (m) { return m.name || m.id; }).join(", ") + " - taken off your models."); }
      else if (v.error) say("✗ OpenRouter did not answer - " + v.error, true);
      else say("");
    }).catch(function (e) { if (my === S.ask) say("✗ " + (e && e.message || e), true); });
  }
  function add(id) {
    if (S.busy || mineIds().indexOf(id) >= 0) { if (mineIds().indexOf(id) >= 0) say(id + " is already in your models"); return; }
    S.busy = true;
    post("/api/ormodels/add", { type: S.type, id: id }).then(function (j) {
      S.busy = false;
      if (!j || j.error) { say("✗ " + ((j && j.error) || "not added"), true); return; }
      S.v.mine = j.mine; S.changed = true;
      (S.v.types || []).forEach(function (t) { if (t.id === S.type) t.n = j.mine.length; });
      drawTypes(); drawAvail(); drawMine(); say("Added " + id + " - in the dropdowns as openrouter/" + id + " when you close this.");
    }).catch(function () { S.busy = false; });
  }
  function remove(id) {
    post("/api/ormodels/remove", { type: S.type, id: id }).then(function (j) {
      if (!j || j.error) { say("✗ " + ((j && j.error) || "not removed"), true); return; }
      S.v.mine = j.mine; S.changed = true;
      (S.v.types || []).forEach(function (t) { if (t.id === S.type) t.n = j.mine.length; });
      drawTypes(); drawAvail(); drawMine(); say("Took " + id + " off your models.");
    });
  }
  function open(type) {
    var d = build();
    if (type && TYPES.some(function (t) { return t[0] === type; })) S.type = type;
    S.changed = false;
    try { if (!d.open) d.showModal(); } catch (e) { d.setAttribute("open", ""); }
    load(false);
    setTimeout(function () { var q = $("orQ"); if (q) q.focus(); }, 30);
  }
  function close() {
    var d = $("orDlg"); if (!d) return;
    try { d.close(); } catch (e) { d.removeAttribute("open"); }
    // Tim: "when user closes the dialog update all the dropdowns with the new lists" (static/ormine.js)
    try { doc.dispatchEvent(new CustomEvent("h3:ormodels", { detail: { changed: S.changed } })); } catch (e) { /* fine */ }
  }
  /* the button in ☁ Remote generation (under Runs on) */
  function ensureBtn() {
    var box = $("rgdWhere"); if (!box || $("rhOrBtn")) return;
    var b = doc.createElement("button"); b.type = "button"; b.id = "rhOrBtn"; b.className = "ghost"; b.style.cssText = "margin-top:8px;font-size:.78rem";
    b.textContent = "☁ OpenRouter models…"; b.title = "Pick the OpenRouter models you use - pictures, video, LLM, vision LLM (free and paid)";
    b.onclick = function () { open(); };
    box.appendChild(b);
  }
  function boot() { ensureBtn(); setInterval(ensureBtn, 1500); }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3OrModels = Object.assign({ open: open, close: close, load: load, state: function () { return S; } }, pure);
})(typeof window !== "undefined" ? window : globalThis);
