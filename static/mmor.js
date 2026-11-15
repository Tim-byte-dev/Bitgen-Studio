/* bitGen Studio — static/mmor.js (2.790.0): 🧩 MODEL MANAGER ▸ ☁ OPENROUTER - OpenRouter's models, ＋ adds one to your list with its
 * endpoint.
 * Tim (verbatim): "add an openrouter tab show models from openrouter , free , paid and the other filters, put a + button next to the
 * openrouter model to add the model to our model list and save it's endpoint"
 *   the types Image / Video / LLM / Vision LLM, the family (maker), a search, ☑ Free ☑ Paid, sort (free first / cheapest / newest),
 *   ⟳ asks OpenRouter again - the same lists as ☁ Remote generation ▸ OpenRouter models… (GET /api/ormodels?type=, lib/orModels.js)
 *   ＋  POST /api/ormodels/add {type, id} - your list keeps it with its endpoint (image <base>/images, video <base>/videos, the LLMs
 *       <base>/chat/completions); then it is in Basic Settings' / the prompt docker's dropdowns as openrouter/<id> (static/ormine.js)
 *       and on the Models tab under ☐ OpenRouter
 *   ✓ 🗑 a model already in your list: 🗑 takes it off
 * Pure (Node: scripts/test-mmsources790.js): cardHtml.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && root.document) root.H3MmOr = api.live(root);
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  var TYPES = [["image", "Image"], ["video", "Video"], ["llm", "LLM"], ["vlm", "Vision LLM"]];
  var esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  function cardHtml(m, mine) {
    return '<div class="mmorc' + (mine ? " mine" : "") + '" data-orid="' + esc(m.id) + '" title="' + esc(m.id + (m.desc ? " - " + m.desc.slice(0, 300) : "")) + '">'
      + '<div class="nm"><b>' + esc(m.name || m.id) + "</b><small>" + esc(m.id) + "</small></div>"
      + '<div class="mt"><span class="orp ' + (m.free ? "free" : "paid") + '">' + esc(m.free ? "free" : m.price || "paid") + "</span>" + (m.maker ? '<span class="tag">' + esc(m.maker) + "</span>" : "") + "</div>"
      + (m.desc ? '<div class="ds">' + esc(m.desc.slice(0, 160)) + "</div>" : "")
      + (mine ? '<div class="ac"><span class="ok" title="In your models">✓ yours</span><button type="button" class="ghost" data-orrm="' + esc(m.id) + '" title="Take it off your models">🗑</button></div>'
        : '<div class="ac"><button type="button" class="ghost orAdd" data-oradd="' + esc(m.id) + '" title="＋ Add ' + esc(m.name || m.id) + ' to your models (its endpoint is kept with it)" aria-label="Add ' + esc(m.name || m.id) + '">＋</button></div>')
      + "</div>";
  }
  var CSS = ".mmorbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:4px 0}.mmorbar select,.mmorbar input[type=search]{width:auto!important;min-width:0}"
    + ".mmorbar input[type=search]{flex:1 1 140px}.mmorgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:6px;overflow:auto}"
    + ".mmorc{border:1px solid var(--line,#333);border-radius:6px;padding:6px 8px;display:flex;flex-direction:column;gap:3px;font-size:.74rem;min-width:0}"
    + ".mmorc.mine{border-color:var(--accent,#e8a33d)}.mmorc .nm{display:flex;flex-direction:column;min-width:0}.mmorc .nm b,.mmorc .nm small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
    + ".mmorc .nm small{color:var(--dim)}.mmorc .mt{display:flex;gap:5px;flex-wrap:wrap}.mmorc .orp.free{color:#7c7}.mmorc .orp.paid{color:var(--accent,#e8a33d)}"
    + ".mmorc .ds{color:var(--dim);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.mmorc .ac{display:flex;gap:6px;align-items:center;justify-content:flex-end;margin-top:auto}"
    + ".mmorc .ac button{width:auto;padding:0 10px}.mmorc .ok{color:#7c7}.mmortypes button[aria-selected=true]{border-color:var(--accent,#e8a33d);color:var(--accent,#e8a33d)}";

  function live(win) {
    var doc = win.document, S = { type: "image", fam: "", q: "", free: true, paid: true, sort: "name", v: null, busy: false, host: null, say: null, onChange: null };
    var jget = function (u) { return win.fetch(u).then(function (r) { return r.json(); }); };
    var post = function (u, b) { return win.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json(); }); };
    var say = function (t, k) { if (S.say) S.say(t, k); };
    function css() { if (doc.getElementById("mmorCss")) return; var s = doc.createElement("style"); s.id = "mmorCss"; s.textContent = CSS; doc.head.appendChild(s); }
    function pure() { return win.H3OrModels || null; }
    function filtered() {
      var v = S.v || {}, P = pure(), list = v.models || [];
      if (P && P.filterList) list = P.sortList(P.filterList(list, { fam: S.fam || "all", q: S.q, free: S.free, paid: S.paid }), S.sort);
      return list;
    }
    function mineIds() { return ((S.v && S.v.mine) || []).map(function (m) { return m.id; }); }
    function drawGrid() {
      var g = S.host && S.host.querySelector(".mmorgrid"); if (!g) return;
      var v = S.v || {}, ids = mineIds(), L = filtered();
      var n = S.host.querySelector(".mmorn"); if (n) n.textContent = L.length + " of " + (v.models || []).length + (ids.length ? " · " + ids.length + " yours" : "");
      g.innerHTML = L.length ? L.slice(0, 400).map(function (m) { return cardHtml(m, ids.indexOf(m.id) >= 0); }).join("")
        : '<div class="mmmsg" style="grid-column:1/-1">' + (S.busy ? "asking OpenRouter…" : v.error ? "OpenRouter did not answer - " + esc(v.error) : (v.models || []).length ? "nothing matches" : "no models") + "</div>";
    }
    function draw() {
      if (!S.host) return;
      var v = S.v || {}, n = {}; (v.types || []).forEach(function (t) { n[t.id] = t.n; });
      var fams = (v.families || []).filter(function (f) { return f.id !== "all"; });
      S.host.innerHTML = '<div class="mmorbar mmortypes" role="tablist" aria-label="Type">' + TYPES.map(function (t) { return '<button type="button" class="ghost" role="tab" data-ortype="' + t[0] + '" aria-selected="' + (t[0] === S.type) + '">' + t[1] + (n[t[0]] ? " (" + n[t[0]] + ")" : "") + "</button>"; }).join("") + "</div>"
        + '<div class="mmorbar"><input type="search" class="mmorq" placeholder="Search OpenRouter\'s models…" aria-label="Search OpenRouter\'s models" value="' + esc(S.q) + '">'
        + '<select class="mmorfam" aria-label="Family"><option value="">every family</option>' + fams.map(function (f) { return '<option value="' + esc(f.id) + '"' + (f.id === S.fam ? " selected" : "") + ">" + esc(f.label) + " (" + f.n + ")</option>"; }).join("") + "</select>"
        + '<label title="Free models"><input type="checkbox" class="mmorfree"' + (S.free ? " checked" : "") + "> Free</label><label title=\"Paid models\"><input type=\"checkbox\" class=\"mmorpaid\"" + (S.paid ? " checked" : "") + "> Paid</label>"
        + '<select class="mmorsort" aria-label="Sort"><option value="name">free first, A-Z</option><option value="price">cheapest</option><option value="newest">newest</option></select>'
        + '<button type="button" class="ghost mmorre" title="Ask OpenRouter again">⟳</button><span class="mmorn" style="color:var(--dim);font-size:.72rem"></span></div>'
        + (v.key === false ? '<div class="mmmsg">Listing needs no key - rendering does: ⚙ Settings ▸ Remote generation ▸ OpenRouter.</div>' : "")
        + '<div class="mmorgrid"></div>';
      S.host.querySelector(".mmorsort").value = S.sort;
      drawGrid();
    }
    function load(force) {
      S.busy = true; draw();
      return jget("/api/ormodels?type=" + S.type + (force ? "&refresh=1" : "")).then(function (v) { S.v = v; if (v.removed && v.removed.length) say("taken off your models (OpenRouter no longer lists them): " + v.removed.map(function (m) { return m.name; }).join(", ")); })
        .catch(function (e) { S.v = { error: e.message, models: [] }; }).then(function () { S.busy = false; draw(); });
    }
    /** the dropdowns + the Models tab read your list again -> a promise (the message comes after the Models tab's own status) */
    function changed() {
      try { if (win.H3OrMine && win.H3OrMine.load) win.H3OrMine.load(); } catch (e) { /* fine */ }
      var p = null; if (S.onChange) try { p = S.onChange(); } catch (e) { p = null; }
      return Promise.resolve(p).catch(function () { return null; });
    }
    function add(id) {
      return post("/api/ormodels/add", { type: S.type, id: id }).then(function (j) {
        if (j.error) { say(j.error, "bad"); return; }
        S.v.mine = j.mine;
        var e = j.entry || (j.mine || []).filter(function (m) { return m.id === id; })[0] || {};
        drawGrid();
        return changed().then(function () { say("＋ " + (e.name || id) + " is in your models - renders at " + (e.endpoint || "OpenRouter") + "; listed as openrouter/" + id, "ok"); });
      });
    }
    function rm(id) {
      return post("/api/ormodels/remove", { type: S.type, id: id }).then(function (j) { if (j.error) { say(j.error, "bad"); return; } S.v.mine = j.mine; drawGrid(); return changed().then(function () { say("🗑 " + id + " taken off your models", "ok"); }); });
    }
    function bind(host) {
      if (host._mmor) return; host._mmor = true;
      host.addEventListener("click", function (e) {
        var t = e.target.closest && e.target.closest("[data-ortype]"); if (t) { S.type = t.dataset.ortype; S.fam = ""; load(false); return; }
        var a = e.target.closest && e.target.closest("[data-oradd]"); if (a) { a.disabled = true; add(a.dataset.oradd); return; }
        var r = e.target.closest && e.target.closest("[data-orrm]"); if (r) { rm(r.dataset.orrm); return; }
        if (e.target.closest && e.target.closest(".mmorre")) load(true);
      });
      host.addEventListener("input", function (e) { if (e.target.classList.contains("mmorq")) { S.q = e.target.value; drawGrid(); } });
      host.addEventListener("change", function (e) {
        var c = e.target.classList;
        if (c.contains("mmorfam")) S.fam = e.target.value; else if (c.contains("mmorfree")) S.free = e.target.checked; else if (c.contains("mmorpaid")) S.paid = e.target.checked; else if (c.contains("mmorsort")) S.sort = e.target.value; else return;
        drawGrid();
      });
      host.addEventListener("keydown", function (e) { e.stopPropagation(); });
    }
    /** modelmgr.js paint(): the tab's body */
    function render(host, o) {
      css(); S.host = host; S.say = (o && o.say) || null; S.onChange = (o && o.onChange) || null; bind(host);
      if (!S.v) load(false); else draw();
    }
    return { render: render, load: load, add: add, state: function () { return S; }, cardHtml: cardHtml };
  }
  return { cardHtml: cardHtml, live: live };
});
