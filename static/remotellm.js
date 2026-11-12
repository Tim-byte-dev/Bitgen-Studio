/* bitGen Studio — static/remotellm.js (2.768.0): IN REMOTE MODE THE PROMPT DOCKER'S LLM AND VISION LISTS ARE THE REMOTE HOST'S
 * MODELS (window.H3RemoteLlm; lib/remoteLlm.js, routes/remoteLlm.js).
 * Tim (verbatim): "when in remote mode clear the llm and vllm dropdown lists in prompt docker add the list of free llm and vl
 * models from openrouter(default) or the selected host in our prompt llm and vllm dropdowns."
 *   #llmSel / #visionSel (ext/promptdock)  remote (GET /api/remotellm says a host): this computer's GGUFs are cleared and the
 *              host's models listed under "☁ OpenRouter - free models" / "☁ RunPod pod" / "☁ RunPod vLLM"; picking one saves it
 *              (POST /api/remotellm/pick) - nothing is started here. Back to Local: the computer's lists come back.
 *   The page's own fillers are kept out while remote: refreshLlms (static/index.html) asks owns("llm"); the vision list's
 *   loader (ext/promptdock) is stopped at its focus and undone if it fills the list anyway (a MutationObserver); a change
 *   is caught before the page's own handler (it would load the model here).
 *   Reloaded on "h3:rgpu" (Basic Settings ▸ GPU, the ☁ Remote generation docker, OpenRouter's picker).
 * Pure (Node: scripts/test-remotellm768.js): optionsOf, shortName.
 */
(function (root) {
  "use strict";
  var IDS = { llm: "llmSel", vlm: "visionSel" };
  /** the options for a host's list (pure) -> {label, items: [{value, text, selected}], empty} */
  /** does a model match a search (pure): every word in its id / name / note; "free" / "paid" / "vision" match those */
  function matches(m, q) {
    var hay = [m.id, m.name, m.note, m.free ? "free" : "paid", m.vision ? "vision 👁" : ""].join(" ").toLowerCase();
    return String(q || "").toLowerCase().split(/\s+/).filter(Boolean).every(function (w) { return hay.indexOf(w) >= 0; });
  }
  /** 2.770.0 (Tim: "add the list to the dropdowns but only show 10 at a time, add a search to each dropdown") (pure): the options -
   *  {label, items: [{value, text, selected}] (the search's first `per` - 10 - and the current one), more: how many are not shown, empty} */
  function optionsOf(L, q, per) {
    var x = L || {}, all = x.models || [], n = per || 10;
    var ms = all.filter(function (m) { return matches(m, q); });
    var shown = ms.slice(0, n);
    var cur = all.find ? all.find(function (m) { return m.id === x.current; }) : null;
    if (cur && shown.indexOf(cur) < 0) shown.unshift(cur);
    var label = x.host === "openrouter" ? "☁ OpenRouter" : "☁ " + (x.label || x.host || "remote");
    var items = shown.map(function (m) { return { value: m.id, text: (m.name || m.id) + (m.note ? " · " + m.note : ""), selected: m.id === x.current }; });
    var empty = x.error ? "(" + x.label + " did not list its models - " + x.error + ")" : !all.length ? "(no models " + (x.label || "") + " lists)" : !ms.length ? "(nothing matches \"" + q + "\")" : "";
    return { label: label, items: items, empty: empty, more: Math.max(0, ms.length - Math.min(ms.length, n)) };
  }
  /** the Show all list (pure): filters {q, free, paid, vision} and a sort - name | price | context | newest */
  function listOf(models, f, by) {
    var o = f || {};
    var l = (models || []).filter(function (m) { return (m.free ? o.free !== false : o.paid !== false) && (!o.vision || m.vision) && matches(m, o.q); });
    var price = function (m) { return m.free ? 0 : (+m.in || 0) + (+m.out || 0); };
    var cmp = { price: function (a, b) { return price(a) - price(b) || String(a.name).localeCompare(String(b.name)); },
      context: function (a, b) { return (+b.ctx || 0) - (+a.ctx || 0) || String(a.name).localeCompare(String(b.name)); },
      newest: function (a, b) { return (+b.created || 0) - (+a.created || 0); },
      name: function (a, b) { return String(a.name).localeCompare(String(b.name)); } }[by] || function (a, b) { return String(a.name).localeCompare(String(b.name)); };
    return l.slice().sort(cmp);
  }
  /** "google/gemma-4-31b-it:free" -> "gemma-4-31b-it:free" (pure, the status bar) */
  function shortName(id) { return String(id || "").split("/").pop().replace(/\.gguf$/i, "").slice(0, 22); }
  var api = { optionsOf: optionsOf, listOf: listOf, matches: matches, shortName: shortName, IDS: IDS };
  if (typeof module === "object" && module.exports && !root.document) { module.exports = api; return; }

  var doc = root.document, S = { v: null, own: { llm: false, vlm: false }, painting: false, obs: {}, q: { llm: "", vlm: "" }, all: null, dsel: "" };
  function $(id) { return doc.getElementById(id); }
  function post(u, b) { return root.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json(); }); }
  function owns(k) { return !!S.own[k]; }
  function paint(k) {
    var sel = $(IDS[k]), L = S.v && S.v[k]; if (!sel || !L || !L.host) return;
    tools(k);
    var o = optionsOf(L, S.q[k] || "", 10);
    S.painting = true;
    sel.innerHTML = "";
    var g = doc.createElement("optgroup"); g.label = o.label; g.dataset.rl = "1";
    if (o.empty) { var e = doc.createElement("option"); e.value = ""; e.textContent = o.empty; g.appendChild(e); }
    o.items.forEach(function (it) { var op = doc.createElement("option"); op.value = it.value; op.textContent = it.text; op.dataset.rl = "1"; if (it.selected) op.selected = true; g.appendChild(op); });
    if (o.more) { var mo = doc.createElement("option"); mo.value = ""; mo.disabled = true; mo.textContent = "… " + o.more + " more - search, or ☰ All"; g.appendChild(mo); }
    sel.appendChild(g);
    sel.disabled = !!L.fixed && o.items.length < 2;
    sel.title = (k === "vlm" ? "Vision LLM" : "LLM") + " on " + (L.label || L.host) + (L.note ? " - " + L.note : "");
    sel.dataset.rlHost = L.host;
    S.painting = false;
    // nothing picked yet: the first one (saved, so a prompt works at once)
    if (!L.current && o.items.length && !L.fixed && !S.q[k]) { sel.selectedIndex = o.empty ? 1 : 0; pick(k, sel.value); }
    if (k === "llm" && $("sbllm")) { $("sbllm").textContent = "LLM: ☁ " + shortName(sel.value || L.current) + " (" + (L.label || L.host) + ")"; $("sbllm").style.color = "var(--dim)"; }
  }
  /* 2.770.0: a search box before each remote list, ☰ All after the Vision list (shown in remote mode only) */
  function tools(k) {
    var sel = $(IDS[k]); if (!sel) return;
    if (!$("rlQ_" + k)) {
      var q = doc.createElement("input"); q.type = "search"; q.id = "rlQ_" + k; q.className = "rlQ"; q.placeholder = "🔍"; q.setAttribute("aria-label", "Search the " + (k === "vlm" ? "Vision LLM" : "LLM") + " models");
      q.style.cssText = "flex:0 0 74px;width:74px;min-width:0;padding:3px 5px;font-size:.74rem";
      q.title = "Search the models (every word: name, maker, free, paid, vision) - the list shows 10 at a time";
      q.addEventListener("keydown", function (e) { e.stopPropagation(); });
      q.addEventListener("input", function () { S.q[k] = q.value; paint(k); });
      sel.parentNode.insertBefore(q, sel);
    }
    if (!$("rlAll") && $(IDS.vlm)) {
      var b = doc.createElement("button"); b.type = "button"; b.id = "rlAll"; b.className = "ghost ibtn"; b.textContent = "☰ All";
      b.title = "Show all OpenRouter models - filter, sort, search, free / paid, details; Use puts the one you pick in the LLM or Vision list";
      b.onclick = function () { allDialog(owns("vlm") && !owns("llm") ? "vlm" : "llm"); };
      $(IDS.vlm).parentNode.insertBefore(b, $(IDS.vlm).nextSibling);
    }
    ["llm", "vlm"].forEach(function (x) { var e = $("rlQ_" + x); if (e) e.style.display = owns(x) ? "" : "none"; });
    if ($("rlAll")) $("rlAll").style.display = (owns("llm") && S.v.llm.host === "openrouter") || (owns("vlm") && S.v.vlm.host === "openrouter") ? "" : "none";
  }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  /* 2.770.0 (Tim: "add a button to the docker, show all - this will show all openrouter models in a dialog, with filtering,sort,search,
     free, paid and details in a list, when user selects one and clicks use then change the dropdown to the model and we use that model") */
  function allDialog(kind) {
    var d = $("rlDlg");
    if (!d) {
      if (!$("rlCss")) { var st = doc.createElement("style"); st.id = "rlCss"; st.textContent = "#rlDlg{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center}"
        + "#rlDlg .in{background:var(--panel,#1b1814);color:var(--text,#eee);border:1px solid var(--line,#3a342a);border-radius:10px;width:min(980px,96vw);height:min(720px,92vh);display:flex;flex-direction:column;gap:6px;padding:10px 12px}"
        + "#rlDlg .bar{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;font-size:.78rem}#rlDlg .bar input[type=search]{flex:1;min-width:160px}"
        + "#rlDlg .body{flex:1;min-height:0;display:flex;gap:10px}#rlDlg .list{flex:3;overflow:auto;border:1px solid var(--line,#3a342a);border-radius:6px}"
        + "#rlDlg .det{flex:2;overflow:auto;font-size:.78rem;line-height:1.45;border:1px solid var(--line,#3a342a);border-radius:6px;padding:8px}"
        + "#rlDlg table{width:100%;border-collapse:collapse;font-size:.76rem}#rlDlg th{position:sticky;top:0;background:var(--panel,#1b1814);text-align:left;padding:4px 6px;cursor:pointer}"
        + "#rlDlg td{padding:3px 6px;border-top:1px solid rgba(255,255,255,.05)}#rlDlg tr.on td{background:rgba(245,158,44,.18)}#rlDlg tbody tr{cursor:pointer}"
        + "#rlDlg .num{text-align:right;white-space:nowrap}@media (max-width:700px){#rlDlg .body{flex-direction:column}}"; doc.head.appendChild(st); }
      d = doc.createElement("div"); d.id = "rlDlg"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-labelledby", "rlDlgT");
      d.innerHTML = '<div class="in"><div class="bar"><b id="rlDlgT">OpenRouter models</b><span class="hint" id="rlDlgN"></span></div>'
        + '<div class="bar"><input type="search" id="rlDlgQ" placeholder="Search - name, maker, free, paid, vision…" aria-label="Search the models">'
        + '<label class="chk" style="margin:0"><input type="checkbox" id="rlDlgFree" checked> Free</label><label class="chk" style="margin:0"><input type="checkbox" id="rlDlgPaid" checked> Paid</label>'
        + '<label class="chk" style="margin:0" title="Only models that take pictures"><input type="checkbox" id="rlDlgVis"> 👁 Vision</label>'
        + '<label style="margin:0">Sort <select id="rlDlgSort"><option value="name">Name</option><option value="price">Price (low first)</option><option value="context">Context (large first)</option><option value="newest">Newest</option></select></label></div>'
        + '<div class="body"><div class="list"><table><thead><tr><th data-s="name">Model</th><th data-s="price" class="num">$ in / out per M</th><th data-s="context" class="num">Context</th><th>👁</th></tr></thead><tbody id="rlDlgRows"></tbody></table></div>'
        + '<div class="det" id="rlDlgDet" aria-live="polite"><span class="hint">Pick a model to see its details.</span></div></div>'
        + '<div class="bar"><span>Use for</span><label class="chk" style="margin:0"><input type="radio" name="rlDlgK" value="llm"> LLM</label><label class="chk" style="margin:0"><input type="radio" name="rlDlgK" value="vlm"> Vision LLM</label>'
        + '<span style="flex:1"></span><span class="hint" id="rlDlgMsg" aria-live="polite"></span><button type="button" id="rlDlgUse" disabled>Use</button><button type="button" class="ghost" id="rlDlgClose">Close</button></div></div>';
      doc.body.appendChild(d);
      d.addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Escape") d.style.display = "none"; });
      d.addEventListener("click", function (e) { if (e.target === d) d.style.display = "none"; });
      $("rlDlgClose").onclick = function () { d.style.display = "none"; };
      ["rlDlgQ", "rlDlgFree", "rlDlgPaid", "rlDlgVis", "rlDlgSort"].forEach(function (id) { $(id).addEventListener(id === "rlDlgQ" ? "input" : "change", drawAll); });
      d.querySelectorAll("th[data-s]").forEach(function (th) { th.onclick = function () { $("rlDlgSort").value = th.dataset.s; drawAll(); }; });
      d.querySelectorAll('input[name="rlDlgK"]').forEach(function (r) { r.onchange = function () { if (r.value === "vlm") $("rlDlgVis").checked = true; drawAll(); }; });
      $("rlDlgUse").onclick = function () {
        var k = (d.querySelector('input[name="rlDlgK"]:checked') || {}).value || "llm", id = S.dsel; if (!id) return;
        $("rlDlgMsg").textContent = "saving…";
        pick(k, id).then(function (r) {
          if (!r || r.error) { $("rlDlgMsg").textContent = "✗ " + ((r && r.error) || "not saved"); return; }
          S.q[k] = ""; if ($("rlQ_" + k)) $("rlQ_" + k).value = "";
          d.style.display = "none"; load();
        });
      };
    }
    d.style.display = "flex";
    d.querySelectorAll('input[name="rlDlgK"]').forEach(function (r) { r.checked = r.value === kind; });
    $("rlDlgVis").checked = kind === "vlm";
    S.dsel = ""; $("rlDlgUse").disabled = true; $("rlDlgMsg").textContent = "";
    $("rlDlgRows").innerHTML = '<tr><td colspan="4" class="hint">asking OpenRouter for its models…</td></tr>';
    root.fetch("/api/openrouter/models").then(function (r) { return r.json(); }).then(function (j) {
      if (j.error) { $("rlDlgRows").innerHTML = '<tr><td colspan="4">✗ ' + esc(j.error) + "</td></tr>"; return; }
      S.all = j.models || []; drawAll();
    }).catch(function () { $("rlDlgRows").innerHTML = '<tr><td colspan="4">✗ OpenRouter could not be reached</td></tr>'; });
    setTimeout(function () { try { $("rlDlgQ").focus(); } catch (e) { /* fine */ } }, 30);
  }
  function money(n) { return n == null ? "-" : "$" + (Math.round(n * 100) / 100); }
  function drawAll() {
    var l = listOf(S.all || [], { q: $("rlDlgQ").value, free: $("rlDlgFree").checked, paid: $("rlDlgPaid").checked, vision: $("rlDlgVis").checked }, $("rlDlgSort").value);
    $("rlDlgN").textContent = l.length + " of " + (S.all || []).length + " models";
    $("rlDlgRows").innerHTML = l.slice(0, 600).map(function (m) {
      return '<tr data-id="' + esc(m.id) + '"' + (m.id === S.dsel ? ' class="on"' : "") + ' tabindex="0"><td><b>' + esc(m.name) + '</b><br><span class="hint">' + esc(m.id) + "</span></td>"
        + '<td class="num">' + (m.free ? "free" : esc(money(m.in) + " / " + money(m.out))) + '</td><td class="num">' + (m.ctx ? Math.round(m.ctx / 1000) + "k" : "-") + "</td><td>" + (m.vision ? "👁" : "") + "</td></tr>";
    }).join("") || '<tr><td colspan="4" class="hint">No model matches.</td></tr>';
    $("rlDlgRows").querySelectorAll("tr[data-id]").forEach(function (tr) {
      var choose = function () { S.dsel = tr.dataset.id; $("rlDlgRows").querySelectorAll("tr.on").forEach(function (x) { x.classList.remove("on"); }); tr.classList.add("on"); $("rlDlgUse").disabled = false; detail(); };
      tr.onclick = choose; tr.ondblclick = function () { choose(); $("rlDlgUse").click(); };
      tr.onkeydown = function (e) { if (e.key === "Enter") { choose(); } };
    });
  }
  function detail() {
    var m = (S.all || []).find(function (x) { return x.id === S.dsel; }); if (!m) return;
    $("rlDlgDet").innerHTML = "<b>" + esc(m.name) + '</b><div class="hint">' + esc(m.id) + "</div>"
      + "<div>" + (m.free ? "Free (rate-limited by OpenRouter and the provider)" : "Paid: " + esc(money(m.in)) + " per million tokens in, " + esc(money(m.out)) + " out") + "</div>"
      + "<div>Context: " + (m.ctx ? m.ctx.toLocaleString() + " tokens" : "not said") + " · " + (m.vision ? "takes pictures 👁" : "text only") + "</div>"
      + (m.created ? "<div>Added: " + esc(new Date(m.created * 1000).toISOString().slice(0, 10)) + "</div>" : "")
      + (m.desc ? '<p style="margin:6px 0 0">' + esc(m.desc) + "</p>" : "");
  }
  function watch(k) {
    var sel = $(IDS[k]); if (!sel || S.obs[k] || !root.MutationObserver) return;
    // the page's own loader fills the list again (the vision list on load / focus): the host's list goes back
    S.obs[k] = new MutationObserver(function () { if (owns(k) && !S.painting && !sel.querySelector("[data-rl]")) paint(k); });
    S.obs[k].observe(sel, { childList: true });
  }
  function pick(k, id) {
    if (!id) return Promise.resolve(null);
    return post("/api/remotellm/pick", { kind: k, id: id }).then(function (r) {
      if (r && !r.error && S.v && S.v[k]) S.v[k].current = r.current;
      if (k === "llm" && $("sbllm") && r && !r.error) $("sbllm").textContent = "LLM: ☁ " + shortName(id) + " (" + ((S.v && S.v.llm && S.v.llm.label) || "") + ")";
      try { doc.dispatchEvent(new CustomEvent("h3:remotellm", { detail: { kind: k, id: id } })); } catch (e) { /* fine */ }
      return r;
    }).catch(function () { return null; });
  }
  function load() {
    return root.fetch("/api/remotellm").then(function (r) { return r.json(); }).then(function (v) {
      if (!v || v.error) return v;
      S.v = v;
      ["llm", "vlm"].forEach(function (k) {
        var was = owns(k), now = !!(v[k] && v[k].host);
        S.own[k] = now;
        if (now) { watch(k); paint(k); return; }
        tools(k);
        if (was) {   // back to this computer: its own list
          var sel = $(IDS[k]); if (sel) { sel.disabled = false; delete sel.dataset.rlHost; sel.innerHTML = ""; }
          if (k === "llm" && typeof root.refreshLlms === "function") root.refreshLlms();
          if (k === "vlm" && sel) sel.dispatchEvent(new Event("focus"));
        }
      });
      return v;
    }).catch(function () { /* offline */ });
  }
  // a pick in a remote list is saved - the page's own handler (it would load the model on this computer) never sees it
  doc.addEventListener("change", function (e) {
    var t = e.target, k = t && t.id === IDS.llm ? "llm" : t && t.id === IDS.vlm ? "vlm" : "";
    if (!k || !owns(k)) return;
    e.stopPropagation();
    if (k === "llm") { try { if (root.store && root.store.set) root.store.set("llm", t.value); } catch (x) { /* fine */ } }
    pick(k, t.value);
  }, true);
  // the vision list's own loader runs on focus - not while it lists the host's models
  doc.addEventListener("focus", function (e) { var t = e.target; if (t && t.id === IDS.vlm && owns("vlm")) e.stopPropagation(); }, true);
  doc.addEventListener("h3:rgpu", function () { setTimeout(load, 50); });
  function boot() { if (!$(IDS.llm)) { setTimeout(boot, 800); return; } load(); setTimeout(load, 3000); }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3RemoteLlm = Object.assign({ load: load, owns: owns, paint: paint, pick: pick, state: function () { return S; } }, api);
})(typeof window !== "undefined" ? window : globalThis);
