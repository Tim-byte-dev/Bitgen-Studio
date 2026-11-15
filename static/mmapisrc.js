/* bitGen Studio — static/mmapisrc.js (2.795.0): 🧩 MODEL MANAGER ▸ ＋ ADD SOURCE - A TAB PER MODEL API (window.H3ApiSrc;
 * lib/apiSources.js, routes/apiSources.js).
 * Tim (verbatim): "make the model manager dynamic, add source button will create a tab, in the tab we have a settings button to
 * bring up a dialog, for url, api key and endpoint format. (the endpoint will automatically be filled in by bitgen with the url and
 * api key and the model chosen from the list of models that we can get through the api)"
 *   ＋ Add source      a new source "Source N" (POST /api/sources) - its tab opens with the ⚙ dialog
 *   🔌 <name> tab      ⚙ Settings · ⟳ Models (asks the API) · search · type · 🗑 Remove source; your models first (🗑), then the
 *                      API's (each with its type, ＋ adds it; hover = the endpoint bitGen calls)
 *   ⚙ dialog          Name, Format (OpenAI-compatible / Ollama / Anthropic-style / Custom template), URL, API key (kept encrypted;
 *                      empty = keep), for Custom: the list + chat templates ({url} {model}) and the key's header; Model (from ✓ Test)
 *                      and the Endpoint filled in from them; ✓ Test asks the API with what is typed; Save
 *   The prompt docker's LLM / Vision lists get "🔌 <source> · your models" (<source>/<model>); a pick = that model through the
 *   source (POST /api/sources/use); any other pick in that list ends it.
 * Pure (Node: scripts/test-apisources795.js): esc, tabsHtml, rowsHtml, dialogHtml, groupOf, fillTpl
 * API: H3ApiSrc {load, mountTabs, render(host, id, ctx), openDialog(id), add(), state} */
(function (root) {
  "use strict";
  var KIND_NAMES = { llm: "LLM", vlm: "Vision LLM", image: "Image", video: "Video" };
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fillTpl(tpl, url, model) { return String(tpl || "").replace(/\{url\}/g, String(url || "").replace(/\/+$/, "").replace(/\/v1$/i, "")).replace(/\{model\}/g, model || "<model>"); }
  /** the sources' tab buttons (pure) */
  function tabsHtml(sources, cur) {
    return (sources || []).map(function (s) { var t = "src:" + s.id; return '<button class="ghost' + (t === cur ? " on" : "") + '" data-mmtab="' + esc(t) + '" type="button" title="' + esc(s.format_name + " · " + (s.url || "no URL yet")) + '">🔌 ' + esc(s.name) + "</button>"; }).join("");
  }
  function kindSel(k, attr) { return '<select ' + attr + ' aria-label="type">' + ["llm", "vlm", "image", "video"].map(function (x) { return '<option value="' + x + '"' + (x === k ? " selected" : "") + ">" + KIND_NAMES[x] + "</option>"; }).join("") + "</select>"; }
  /** a tab's model rows (pure): yours first (🗑), then the API's matching q / kind (＋), at most max */
  function rowsHtml(view, q, kind, max) {
    var mine = view.models || [], have = {}, qq = String(q || "").toLowerCase(), n = 0, more = 0, out = "";
    mine.forEach(function (m) { have[m.id] = 1; });
    var ok = function (m, k) { return (!qq || (m.id + " " + (m.name || "")).toLowerCase().indexOf(qq) >= 0) && (!kind || kind === k); };
    var yours = mine.filter(function (m) { return ok(m, m.kind); });
    out += '<div class="srch">Your models from this source (' + mine.length + ")</div>";
    out += yours.length ? yours.map(function (m) { return '<div class="srrow mine" title="' + esc(m.endpoint || "") + '"><code>' + esc(m.id) + '</code><span class="srk">' + esc(KIND_NAMES[m.kind] || m.kind) + '</span><button class="ghost" data-srdel="' + esc(m.id) + '" type="button" title="Take it off your models">🗑</button></div>'; }).join("")
      : '<div class="hint">None yet - ＋ one below (ask the API with ⟳ Models).</div>';
    var L = (view.list || []).filter(function (m) { return !have[m.id] && ok(m, m.kind); });
    out += '<div class="srch">The API\'s models (' + (view.list || []).length + ")</div>";
    L.forEach(function (m) { if (n >= (max || 200)) { more++; return; } n++; out += '<div class="srrow" title="' + esc("Endpoint: " + (m.endpoint || "")) + '"><code>' + esc(m.id) + "</code>" + kindSel(m.kind, 'data-srkind="' + esc(m.id) + '"') + '<button class="ghost" data-sradd="' + esc(m.id) + '" type="button" title="Add it to your models">＋</button></div>'; });
    if (more) out += '<div class="hint">' + more + " more - type in the search to find them</div>";
    if (!(view.list || []).length) out += '<div class="hint">No list yet - ⚙ Settings (URL, API key, format), then ⟳ Models.</div>';
    return out;
  }
  /** the ⚙ dialog's body (pure): s = the source's view, formats = [{id, name, list, chat, auth, key, url}] */
  function dialogHtml(s, formats) {
    var f = (formats || []).filter(function (x) { return x.id === s.format; })[0] || {};
    var custom = s.format === "custom";
    return '<h3>⚙ ' + esc(s.name) + "</h3>"
      + '<label class="f">Name<input id="srName" value="' + esc(s.name) + '" maxlength="40"></label>'
      + '<label class="f">Format<select id="srFormat">' + (formats || []).map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === s.format ? " selected" : "") + ">" + esc(x.name) + "</option>"; }).join("") + "</select></label>"
      + '<label class="f">URL<input id="srUrl" value="' + esc(s.url || "") + '" placeholder="' + esc(f.url || "https://…") + '"></label>'
      + '<label class="f">API key<input id="srKey" type="password" autocomplete="off" placeholder="' + esc(s.has_key ? "kept (" + s.key_tail + ") - type to change" : (f.key === false ? "not needed" : "paste the key")) + '"></label>'
      + '<div id="srCustom"' + (custom ? "" : ' style="display:none"') + '>'
      + '<label class="f">Model list address<input id="srListTpl" value="' + esc(s.list_tpl || "{url}/v1/models") + '"></label>'
      + '<label class="f">Chat address<input id="srChatTpl" value="' + esc(s.chat_tpl || "{url}/v1/chat/completions") + '"></label>'
      + '<label class="f">Key header<select id="srAuth">' + [["bearer", "Authorization: Bearer <key>"], ["x-api-key", "x-api-key: <key>"], ["none", "no key"]].map(function (a) { return '<option value="' + a[0] + '"' + (s.auth === a[0] ? " selected" : "") + ">" + esc(a[1]) + "</option>"; }).join("") + "</select></label>"
      + '<p class="hint">{url} = the URL above, {model} = the model picked. The chat is sent in OpenAI\'s shape (messages).</p></div>'
      + '<label class="f">Model<select id="srModel"><option value="">— ✓ Test lists the models —</option>' + (s.list || []).slice(0, 400).map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.id) + "</option>"; }).join("") + "</select></label>"
      + '<label class="f">Endpoint (filled in by bitGen)<input id="srEndpoint" readonly value="' + esc(fillTpl(custom ? (s.chat_tpl || "{url}/v1/chat/completions") : (f.chat || ""), s.url, (s.list && s.list[0] && s.list[0].id) || "")) + '"></label>'
      + '<div class="hint" id="srMsg" aria-live="polite"></div>'
      + '<div class="rowbtns"><button class="ghost" id="srTest" type="button">✓ Test</button><span style="flex:1"></span><button class="ghost" id="srCancel" type="button">Cancel</button><button class="go" id="srSave" type="button">Save</button></div>';
  }
  /** "🔌 <source> · your models" for an LLM / Vision list (pure): mine = [{source, name, model, kind, ref}] */
  function groupOf(mine, kind) { return (mine || []).filter(function (m) { return m.kind === kind || (kind === "llm" && m.kind === "vlm"); }); }
  var pure = { esc: esc, tabsHtml: tabsHtml, rowsHtml: rowsHtml, dialogHtml: dialogHtml, groupOf: groupOf, fillTpl: fillTpl, KIND_NAMES: KIND_NAMES };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var doc = root.document, S = { sources: [], formats: [], use: {}, mine: [], views: {}, q: {}, kind: {}, busy: false, obs: {}, painting: false };
  function $(id) { return doc.getElementById(id); }
  function api(p, body, method) { return root.fetch(p, body !== undefined || method ? { method: method || "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) } : undefined).then(function (r) { return r.json(); }); }
  function note(t) { try { if (typeof root.appNote === "function") root.appNote(t); } catch (e) { /* fine */ } }
  var CSS = ".mmsrctabs{display:contents}.mmapisrc .srbar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0}.mmapisrc .srbar input{flex:1;min-width:120px}"
    + ".mmapisrc .srch{font-weight:600;margin:8px 0 2px;opacity:.85}.mmapisrc .srrow{display:flex;gap:6px;align-items:center;padding:2px 0;border-bottom:1px solid var(--line,#333)}"
    + ".mmapisrc .srrow code{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mmapisrc .srrow select,.mmapisrc .srbar select{width:auto;flex:0 0 auto}.mmapisrc .srrow button{flex:0 0 auto}.mmapisrc .srrow.mine code{color:var(--accent,#7cf)}.mmapisrc .srk{opacity:.7;font-size:.9em}"
    + "#srcDlg{min-width:460px;max-width:620px}#srcDlg label.f{display:block;margin:6px 0}#srcDlg label.f input,#srcDlg label.f select{width:100%;box-sizing:border-box}";
  function css() { if (!$("srcCss")) { var st = doc.createElement("style"); st.id = "srcCss"; st.textContent = CSS; doc.head.appendChild(st); } }
  function load() {
    return api("/api/sources").then(function (j) { if (!j || j.error) return; S.sources = j.sources || []; S.formats = j.formats || []; S.use = j.use || {}; mountTabs(); return loadMine(); }).catch(function () { /* older server */ });
  }
  function mountTabs() {
    css();
    var box = $("mmSrcTabs"); if (!box) return;
    var cur = root.H3ModelMgr && H3ModelMgr.state ? H3ModelMgr.state().tab : "";
    var html = tabsHtml(S.sources, cur);
    if (box.dataset.html !== html) { box.dataset.html = html; box.innerHTML = html;
      box.querySelectorAll("[data-mmtab]").forEach(function (b) { b.onclick = function () { if (root.H3ModelMgr) H3ModelMgr.openTab(b.dataset.mmtab); }; }); }
    var add = $("mmAddSrc"); if (add && !add.dataset.wired) { add.dataset.wired = "1"; add.onclick = function () { addSource(); }; }
  }
  function addSource() {
    return api("/api/sources", {}).then(function (j) {
      if (!j || j.error) { note("✗ " + ((j && j.error) || "could not add a source")); return; }
      S.sources = j.sources; mountTabs();
      if (root.H3ModelMgr) H3ModelMgr.openTab("src:" + j.id);
      openDialog(j.id);
    });
  }
  function src(id) { return S.sources.filter(function (s) { return s.id === id; })[0]; }
  function render(host, id, ctx) {
    css(); if (!host) return;
    if (ctx && ctx.say) S.ctx = ctx;   // the Model manager's own message line (not a pop-up note)
    var s = src(id);
    if (!s) { host.innerHTML = '<p class="hint">This source is not there any more (removed?) - ＋ Add source makes a new one.</p>'; if (!S.sources.length) load(); return; }
    var v = S.views[id] || { list: s.list || [], models: s.models || [] };
    var when = s.list_at ? new Date(s.list_at).toLocaleString() : "never";
    host.innerHTML = '<div class="srbar"><button class="ghost" id="srSet" type="button" title="URL, API key, format - the endpoint bitGen fills in">⚙ Settings</button>'
      + '<button class="ghost" id="srAsk" type="button" title="Ask the API for its models again">⟳ Models</button>'
      + '<input id="srQ" type="search" placeholder="Search the models" value="' + esc(S.q[id] || "") + '">'
      + '<select id="srKindF" aria-label="type"><option value="">All types</option>' + ["llm", "vlm", "image", "video"].map(function (k) { return '<option value="' + k + '"' + (S.kind[id] === k ? " selected" : "") + ">" + KIND_NAMES[k] + "</option>"; }).join("") + "</select>"
      + '<button class="ghost" id="srDel" type="button" title="Remove this source (its tab, its models, its key)">🗑 Remove source</button></div>'
      + '<div class="hint">' + esc(s.format_name) + " · " + esc(s.url || "no URL yet") + " · " + (s.has_key ? "key " + esc(s.key_tail) : "no key") + " · models asked " + esc(when)
      + '<br>Your LLM / Vision LLM models are in the prompt docker\'s LLM / Vision lists as ' + esc(s.name) + "/&lt;model&gt;. Picture and video models are kept here; rendering with them comes in the next update.</div>"
      + '<div id="srRows">' + rowsHtml(v, S.q[id], S.kind[id], 200) + "</div>";
    var say = (ctx && ctx.say) || note;
    $("srSet").onclick = function () { openDialog(id); };
    $("srAsk").onclick = function () { ask(id, true, host, ctx); };
    $("srDel").onclick = function () {
      if ($("srDel").dataset.sure !== "1") { $("srDel").dataset.sure = "1"; $("srDel").textContent = "🗑 Press again to remove " + s.name; return; }
      api("/api/sources/" + encodeURIComponent(id), {}, "DELETE").then(function (j) { if (j.error) return say("✗ " + j.error); S.sources = j.sources; mountTabs(); loadMine(); if (root.H3ModelMgr) H3ModelMgr.openTab("models"); });
    };
    $("srQ").oninput = function () { S.q[id] = this.value; $("srRows").innerHTML = rowsHtml(v, S.q[id], S.kind[id], 200); wireRows(id, host, ctx); };
    $("srKindF").onchange = function () { S.kind[id] = this.value; $("srRows").innerHTML = rowsHtml(v, S.q[id], S.kind[id], 200); wireRows(id, host, ctx); };
    wireRows(id, host, ctx);
    var f = S.formats.filter(function (x) { return x.id === s.format; })[0] || {};
    if (!S.views[id] && s.url && (s.has_key || f.key === false)) ask(id, false, host, ctx);   // a new source waits for ⚙ Settings
  }
  function wireRows(id, host, ctx) {
    var box = $("srRows"); if (!box) return; var say = (ctx && ctx.say) || note;
    box.querySelectorAll("[data-sradd]").forEach(function (b) { b.onclick = function () {
      var m = b.dataset.sradd, ks = box.querySelector('[data-srkind="' + m.replace(/"/g, '\\"') + '"]');
      api("/api/sources/" + encodeURIComponent(id) + "/mine", { model: m, kind: ks ? ks.value : "llm", add: true }).then(function (j) { if (j.error) return say("✗ " + j.error); say("＋ " + m + " is one of your models"); refresh(id, host, ctx); });
    }; });
    box.querySelectorAll("[data-srdel]").forEach(function (b) { b.onclick = function () {
      api("/api/sources/" + encodeURIComponent(id) + "/mine", { model: b.dataset.srdel, add: false }).then(function (j) { if (j.error) return say("✗ " + j.error); refresh(id, host, ctx); });
    }; });
  }
  function refresh(id, host, ctx) { return load().then(function () { return ask(id, false, host, ctx || S.ctx); }); }
  function ask(id, again, host, ctx) {
    var say = (ctx && ctx.say) || note;
    if (again) say("asking " + ((src(id) || {}).name || "the source") + " for its models…");
    return root.fetch("/api/sources/" + encodeURIComponent(id) + "/models" + (again ? "?refresh=1" : "")).then(function (r) { return r.json(); }).then(function (j) {
      if (j.error) { say("✗ " + j.error); return; }
      var s = src(id); if (s) { s.list = j.list; s.list_at = j.list_at; }
      var ends = {}; (j.list || []).forEach(function (m) { ends[m.id] = m.endpoint; });
      S.views[id] = { list: j.list || [], models: (j.models || []).map(function (m) { return Object.assign({ endpoint: ends[m.id] || "" }, m); }) };
      if (again) say((j.list || []).length + " models from " + j.name);
      if (host && host.isConnected) render(host, id, ctx);
    });
  }
  /* ---- the ⚙ dialog */
  function openDialog(id) {
    css();
    var s = src(id); if (!s) return;
    var d = $("srcDlg"); if (!d) { d = doc.createElement("dialog"); d.id = "srcDlg"; d.className = "h3dlg"; doc.body.appendChild(d); }
    d.innerHTML = dialogHtml(s, S.formats);
    var vals = function () { return { id: id, name: $("srName").value, format: $("srFormat").value, url: $("srUrl").value, key: $("srKey").value, list_tpl: $("srListTpl").value, chat_tpl: $("srChatTpl").value, auth: $("srAuth").value }; };
    var fmt = function () { return S.formats.filter(function (x) { return x.id === $("srFormat").value; })[0] || {}; };
    var ep = function () { var f = fmt(); $("srEndpoint").value = fillTpl($("srFormat").value === "custom" ? $("srChatTpl").value : f.chat, $("srUrl").value || f.url, $("srModel").value); };
    $("srFormat").onchange = function () { var f = fmt(); $("srCustom").style.display = f.id === "custom" ? "" : "none"; if (!$("srUrl").value || S.formats.some(function (x) { return x.url && x.url === $("srUrl").value; })) $("srUrl").value = f.url || ""; $("srKey").placeholder = s.has_key ? "kept (" + s.key_tail + ") - type to change" : (f.key === false ? "not needed" : "paste the key"); ep(); };
    ["srUrl", "srChatTpl", "srModel"].forEach(function (k) { $(k).addEventListener("input", ep); $(k).addEventListener("change", ep); });
    $("srTest").onclick = function () {
      $("srMsg").textContent = "asking…";
      api("/api/sources/test", vals()).then(function (j) {
        if (j.error) { $("srMsg").textContent = "✗ " + j.error; return; }
        $("srMsg").textContent = "✓ " + j.count + " models - " + (j.sample || []).join(", ");
        var ms = $("srModel"), keep = ms.value;
        ms.innerHTML = (j.models || []).map(function (m) { return '<option value="' + esc(m) + '">' + esc(m) + "</option>"; }).join("");
        if (keep && (j.models || []).indexOf(keep) >= 0) ms.value = keep;
        ep();
      }).catch(function () { $("srMsg").textContent = "✗ could not reach the studio"; });
    };
    $("srCancel").onclick = function () { d.close(); };
    $("srSave").onclick = function () {
      api("/api/sources/" + encodeURIComponent(id), vals()).then(function (j) {
        if (j.error) { $("srMsg").textContent = "✗ " + j.error; return; }
        S.sources = j.sources; d.close(); mountTabs(); delete S.views[id];
        if (root.H3ModelMgr) H3ModelMgr.openTab("src:" + id);
        var host = $("mmApiSrc"); if (host && src(id) && src(id).url) ask(id, true, host, S.ctx || {});
      });
    };
    d.addEventListener("keydown", function (e) { e.stopPropagation(); });
    if (d.showModal) { try { d.showModal(); } catch (e) { d.setAttribute("open", ""); } } else d.setAttribute("open", "");
  }
  /* ---- the prompt docker's LLM / Vision lists */
  var SEL = { llm: "llmSel", vlm: "visionSel" };
  function loadMine() {
    return api("/api/sources/mine").then(function (j) { if (!j || j.error) return; S.mine = j.mine || []; S.use = j.use || {}; paintSel("llm"); paintSel("vlm"); }).catch(function () { /* fine */ });
  }
  function paintSel(k) {
    var sel = $(SEL[k]); if (!sel) return;
    S.painting = true;
    try {
      sel.querySelectorAll("optgroup[data-src]").forEach(function (g) { g.remove(); });
      var by = {}; groupOf(S.mine, k).forEach(function (m) { (by[m.source] = by[m.source] || []).push(m); });
      Object.keys(by).forEach(function (sid) {
        var g = doc.createElement("optgroup"); g.label = "🔌 " + by[sid][0].name + " · your models"; g.dataset.src = sid;
        by[sid].forEach(function (m) { var o = doc.createElement("option"); o.value = m.ref; o.textContent = m.ref; o.dataset.src = sid; o.dataset.model = m.model; g.appendChild(o); });
        sel.appendChild(g);
      });
      var u = S.use[k];
      if (u) { var o = sel.querySelector('option[data-src="' + u.source + '"][data-model="' + String(u.model).replace(/"/g, '\\"') + '"]'); if (o) sel.value = o.value; }
    } finally { S.painting = false; }
    if (!S.obs[k] && root.MutationObserver) {
      S.obs[k] = new MutationObserver(function () { if (S.painting || sel.querySelector("optgroup[data-src]") || !groupOf(S.mine, k).length) return; setTimeout(function () { paintSel(k); }, 0); });
      S.obs[k].observe(sel, { childList: true });
    }
  }
  doc.addEventListener("change", function (e) {
    var t = e.target, k = t && t.id === SEL.llm ? "llm" : t && t.id === SEL.vlm ? "vlm" : "";
    if (!k) return;
    var o = t.options[t.selectedIndex];
    if (o && o.dataset.src) {
      e.stopImmediatePropagation(); e.stopPropagation();
      api("/api/sources/use", { kind: k, source: o.dataset.src, model: o.dataset.model }).then(function (j) {
        if (j.error) { note("✗ " + j.error); return; }
        S.use = j.use || S.use;
        try { if (typeof root.logLine === "function") root.logLine("[source] " + (k === "vlm" ? "Vision LLM" : "LLM") + " = " + o.value + " - " + j.endpoint); } catch (x) { /* fine */ }
        try { doc.dispatchEvent(new Event("h3:rgpu")); } catch (x) { /* fine */ }
      });
    } else if (S.use[k]) { api("/api/sources/use", { kind: k }).then(function (j) { S.use = (j && j.use) || {}; }); }
  }, true);
  doc.addEventListener("h3:rgpu", function () { setTimeout(loadMine, 700); });
  function boot() { if (!$("llmSel") && !$("mmSrcTabs")) { setTimeout(boot, 800); return; } load(); }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3ApiSrc = Object.assign({ load: load, mountTabs: mountTabs, render: render, openDialog: openDialog, add: addSource, state: function () { return S; } }, pure);
})(typeof window !== "undefined" ? window : globalThis);
