/* bitGen Studio — static/palette.js (2.530.0): ⌕ THE COMMAND PALETTE (Ctrl+K) and the 📖 Help window (window.H3Palette).
 * The last of the recommendations Tim asked to be worked through: "Ctrl+K command palette: type 'depth map', 'lora',
 * 'house' and jump to any docker, setting, or action".
 *   Ctrl+K (or ⌕ in the menu bar)  a search box over EVERYTHING - every docker (shown + scrolled to), every floating
 *      window, every button of the menu bar and the statusbar (even those a workspace hides), every Settings field (the
 *      dialog opens on its tab with the field lit), the workspaces, the Generate modes, the picture / video styles, every
 *      section of the guide (docs/USAGE.md - read in the 📖 Help window) and every shortcut key.
 *      Type words in any order; ↑ ↓ pick, Enter runs, Esc closes. What you run often comes first.
 *   Ctrl+K where a docker uses it itself (the timeline's split, the image editor's own palette) still does that there.
 * Pure (Node: scripts/test-palette530.js): score(entry, words), rank(entries, query, recent), mdToHtml(md).
 */
(function (root) {
  "use strict";
  function norm(t) { return String(t || "").toLowerCase().replace(/[^\p{L}\p{N}+]+/gu, " ").trim(); }
  /** how well an entry matches the query's words (0 = not at all): every word must be found; the label counts most (pure) */
  function score(e, words) {
    if (!words.length) return 1;
    var lab = " " + norm(e.label) + " ", hint = " " + norm(e.hint) + " ", body = e.body ? " " + norm(e.body) + " " : "", s = 0;
    for (var i = 0; i < words.length; i++) {
      var w = words[i], k = 0;
      if (lab.indexOf(" " + w) >= 0) k = lab.indexOf(" " + w + " ") >= 0 ? 6 : 4;
      else if (lab.indexOf(w) >= 0) k = 3;
      else if (hint.indexOf(" " + w) >= 0) k = 2;
      else if (hint.indexOf(w) >= 0 || body.indexOf(" " + w) >= 0) k = 1;
      else return 0;
      s += k;
    }
    if (norm(e.label).indexOf(words.join(" ")) === 0) s += 5;           // the label starts with what was typed
    return s + (e.boost || 0);
  }
  /** the entries for a query, best first; recently run ones lifted (pure) */
  function rank(entries, query, recent, max) {
    var words = norm(query).split(" ").filter(Boolean), rc = recent || [];
    return entries.map(function (e) { var s = score(e, words); if (s && rc.indexOf(e.id) >= 0) s += words.length ? 3 : 20 - rc.indexOf(e.id); return { e: e, s: s }; })
      .filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s || a.e.label.length - b.e.label.length; }).slice(0, max || 60).map(function (x) { return x.e; });
  }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function inline(t) { return esc(t).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>").replace(/\[([^\]]+)\]\((?:[^)]*)\)/g, "$1"); }
  /** the guide's markdown -> HTML for the Help window: headings, paragraphs, lists, tables, code (pure, escaped) */
  function mdToHtml(md) {
    var L = String(md || "").split(/\r?\n/), out = [], i = 0;
    while (i < L.length) {
      var l = L[i];
      if (/^```/.test(l)) { var code = []; i++; while (i < L.length && !/^```/.test(L[i])) code.push(L[i++]); i++; out.push("<pre><code>" + esc(code.join("\n")) + "</code></pre>"); continue; }
      var h = /^(#{2,4})\s+(.*)$/.exec(l); if (h) { out.push("<h" + (h[1].length + 1) + ">" + inline(h[2]) + "</h" + (h[1].length + 1) + ">"); i++; continue; }
      if (/^\s*\|/.test(l)) {
        var rows = []; while (i < L.length && /^\s*\|/.test(L[i])) rows.push(L[i++]);
        var cells = function (r) { return r.trim().replace(/^\||\|$/g, "").split("|").map(function (c) { return c.trim(); }); };
        var body = rows.filter(function (r) { return !/^\s*\|?\s*:?-{2,}/.test(r); });
        out.push("<table>" + body.map(function (r, k) { var t = k === 0 && rows.length > 1 && /^\s*\|?\s*:?-{2,}/.test(rows[1]) ? "th" : "td"; return "<tr>" + cells(r).map(function (c) { return "<" + t + ">" + inline(c) + "</" + t + ">"; }).join("") + "</tr>"; }).join("") + "</table>");
        continue;
      }
      if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
        var ol = /^\s*\d+\./.test(l), items = [];
        while (i < L.length && (/^\s*([-*]|\d+\.)\s+/.test(L[i]) || (/^\s{2,}\S/.test(L[i]) && items.length))) {
          if (/^\s*([-*]|\d+\.)\s+/.test(L[i])) items.push(L[i].replace(/^\s*([-*]|\d+\.)\s+/, "")); else items[items.length - 1] += " " + L[i].trim();
          i++;
        }
        out.push("<" + (ol ? "ol" : "ul") + ">" + items.map(function (t) { return "<li>" + inline(t) + "</li>"; }).join("") + "</" + (ol ? "ol" : "ul") + ">");
        continue;
      }
      if (!l.trim() || /^-{3,}\s*$/.test(l)) { i++; continue; }
      var para = []; while (i < L.length && L[i].trim() && !/^(#{2,4}\s|```|\s*\||\s*([-*]|\d+\.)\s+)/.test(L[i])) para.push(L[i++]);
      out.push("<p>" + inline(para.join(" ")) + "</p>");
    }
    return out.join("\n");
  }
  var pure = { norm: norm, score: score, rank: rank, mdToHtml: mdToHtml };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var CSS = "#palOv{position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.35);display:none}#palOv.on{display:block}"
    + "#palBox{position:absolute;left:50%;top:70px;transform:translateX(-50%);width:min(680px,92vw);background:var(--panel,#1b1814);border:1px solid var(--tiger,#f59e2c);border-radius:8px;box-shadow:0 18px 50px rgba(0,0,0,.55);overflow:hidden}"
    + "#palIn{width:100%;box-sizing:border-box;font-size:1rem;padding:10px 12px;border:0;border-bottom:1px solid var(--line,#3a342a);background:transparent;color:inherit;outline:none}"
    + "#palList{max-height:min(60vh,520px);overflow:auto;margin:0;padding:4px 0;list-style:none}#palList li{display:flex;gap:8px;align-items:baseline;padding:5px 12px;cursor:pointer}"
    + "#palList li.on{background:rgba(245,158,44,.16)}#palList .pg{flex:none;font-size:.62rem;text-transform:uppercase;letter-spacing:.05em;color:var(--tiger,#f59e2c);min-width:66px}"
    + "#palList .pl{flex:1;min-width:0}#palList .ph{display:block;font-size:.68rem;color:var(--dim,#999);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#palList kbd{font-size:.64rem;border:1px solid var(--line,#555);border-radius:3px;padding:0 4px}"
    + "#palFoot{font-size:.66rem;color:var(--dim,#999);padding:4px 12px;border-top:1px solid var(--line,#3a342a)}"
    + ".palflash{outline:2px solid var(--tiger,#f59e2c)!important;outline-offset:2px;transition:outline-color .3s}"
    + ".hlp{height:100%;overflow:auto;font-size:.8rem;line-height:1.45;padding:2px 10px 10px}.hlp h3{color:var(--tiger,#f59e2c);margin:.9em 0 .3em}.hlp h4,.hlp h5{margin:.8em 0 .2em}"
    + ".hlp table{border-collapse:collapse;margin:.4em 0;font-size:.74rem}.hlp td,.hlp th{border:1px solid var(--line,#3a342a);padding:3px 6px;vertical-align:top}.hlp th{background:rgba(255,255,255,.04)}"
    + ".hlp code{font-family:var(--mono,monospace);font-size:.72rem;background:rgba(255,255,255,.06);padding:0 3px;border-radius:3px}.hlp pre{background:rgba(255,255,255,.05);padding:6px;overflow:auto}"
    + ".hlp .hlpbar{display:flex;gap:6px;align-items:center;position:sticky;top:0;background:var(--panel,#1b1814);padding:4px 0}.hlp .hlpbar select{flex:1;min-width:0}";
  var S = { open: false, sel: 0, list: [], help: null, recent: [] };
  function $(id) { return document.getElementById(id); }
  try { S.recent = JSON.parse(localStorage.getItem("h3pal.recent") || "[]"); } catch (e) { S.recent = []; }
  function remember(id) { S.recent = [id].concat(S.recent.filter(function (x) { return x !== id; })).slice(0, 12); try { localStorage.setItem("h3pal.recent", JSON.stringify(S.recent)); } catch (e) { /* fine */ } }
  function txt(el) { return el ? String(el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim() : ""; }
  function flash(el) { if (!el) return; try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) { /* fine */ } el.classList.add("palflash"); setTimeout(function () { el.classList.remove("palflash"); }, 1600); }

  /* ---------------- the index: built when the palette opens (the app changes as it runs) */
  function dockName(id) { var D = root.DockCfg && DockCfg.NAMES; return (D && D[id]) || id; }
  function showDock(id) {
    var el = $(id); if (!el) return;
    var G = root.H3GoneDocks || {}, btn = Object.keys(G).find(function (b) { return G[b] === id; });
    if (el.classList.contains("dockgone") && typeof root.toggleDockGone === "function") root.toggleDockGone(id, btn);
    if (el.classList.contains("collapsed") && typeof root.toggleCollapse === "function") root.toggleCollapse(id);
    setTimeout(function () { flash(el); }, 80);
  }
  var SIDES = { ldock: ["tL", "no-left", "Left dock (Settings, system)"], refsdock: ["tRefs", "no-refs", "References"], assetsdock: ["tAssets", "no-assets", "Assets"], qdock: ["tQ", "no-queue", "Queue"], rdock: ["tR", "no-right", "Gallery"] };
  function openSettings(tab, el) {
    var dlg = $("settings"); if (!dlg) return;
    if (root.H3TestEvent) root.H3TestEvent("palette_settings", tab);
    if (!dlg.open) { var b = $("openSettings"); if (b) b.click(); }
    setTimeout(function () { var t = document.querySelector('#settings .stabs [data-stab="' + tab + '"]'); if (t) t.click(); setTimeout(function () { flash(el); if (el && el.matches && el.matches("input,select,textarea")) try { el.focus({ preventScroll: true }); } catch (e) { /* fine */ } }, 120); }, 80);
  }
  function build() {
    var E = [], seenBtn = {}, ids = {};
    var add = function (e) { if (e && e.label && !ids[e.id]) { ids[e.id] = 1; E.push(e); } };
    // dockers in the column
    Object.keys(root.H3GoneDocks || {}).forEach(function (btnId) {
      var id = root.H3GoneDocks[btnId], b = $(btnId); seenBtn[btnId] = 1;
      add({ id: "dock:" + id, group: "Docker", label: dockName(id) || txt(b), hint: (b && b.title) || "", run: function () { showDock(id); } });
    });
    Object.keys(SIDES).forEach(function (id) {
      var s = SIDES[id]; seenBtn[s[0]] = 1;
      add({ id: "side:" + id, group: "Docker", label: s[2], hint: ($(s[0]) || {}).title || "", run: function () { var app = $("app"); if (app && app.classList.contains(s[1])) { var b = $(s[0]); if (b) b.click(); } setTimeout(function () { flash($(id)); }, 80); } });
    });
    // floating windows
    if (root.SecFloat && SecFloat.windows) Object.keys(SecFloat.windows).forEach(function (id) {
      var w = SecFloat.windows[id], t = w && w.el && w.el.querySelector(".sft");
      add({ id: "float:" + id, group: "Window", label: txt(t) || id, hint: (w.spec && w.spec.button && w.spec.button.title) || "", run: function () { SecFloat.show(id, true); } });
      if (w.spec && w.spec.button && w.spec.button.id) seenBtn[w.spec.button.id] = 1;
    });
    // every button of the menu bar and the statusbar (a workspace may hide them - they still run)
    document.querySelectorAll("#menubar button, #statusbar button").forEach(function (b) {
      if (!b.id || seenBtn[b.id] || b.id === "palBtn") return;
      var lab = txt(b), tip = b.title || "";
      if (!lab && !tip) return;
      if (lab.length <= 2 || /^[\W_]+$/.test(lab)) lab = (tip.split(/[-–—:(]/)[0] || lab).trim();
      add({ id: "btn:" + b.id, group: b.closest("#menubar") ? "Menu" : "Statusbar", label: lab, hint: tip, run: function () { b.click(); } });
    });
    // Settings: each tab, each field
    document.querySelectorAll("#settings .stabs [data-stab]").forEach(function (t) {
      var tab = t.dataset.stab, tn = txt(t), pane = $("stab-" + tab);
      add({ id: "set:" + tab, group: "Settings", label: tn + " settings", hint: "the Settings dialog's " + tn + " tab", run: function () { openSettings(tab, pane); } });
      if (!pane) return;
      pane.querySelectorAll("label, h3, h4, legend, .f").forEach(function (el, k) {
        var tx = txt(el); if (!tx || tx.length < 3 || tx.length > 90) return;
        var target = el.htmlFor ? $(el.htmlFor) : (el.querySelector("input,select,textarea") || (el.nextElementSibling && el.nextElementSibling.matches("input,select,textarea") ? el.nextElementSibling : null));
        add({ id: "set:" + tab + ":" + k, group: "Settings", label: tx, hint: "Settings › " + tn + (el.title ? " - " + el.title : ""), run: function () { openSettings(tab, target || el); } });
      });
    });
    // the workspaces, the Generate modes, the styles
    if (root.H3Workspace) H3Workspace.IDS.forEach(function (id) { add({ id: "ws:" + id, group: "Workspace", label: H3Workspace.LABELS[id] + " workspace", hint: H3Workspace.DEFS[id].tip, run: function () { H3Workspace.use(id); } }); });
    var g = $("genModeSel"); if (g) [].forEach.call(g.options, function (o) { add({ id: "gen:" + o.value, group: "Generate", label: txt(o) + " (Generate mode)", hint: "the Generate mode", run: function () { g.value = o.value; g.dispatchEvent(new Event("change", { bubbles: true })); flash(g); } }); });
    [["styleSel", "Picture style"], ["videoStyleSel", "Video style"]].forEach(function (p) {
      var s = $(p[0]); if (!s) return;
      [].forEach.call(s.options, function (o) { if (!o.value) return; add({ id: "style:" + p[0] + ":" + o.value, group: "Style", label: txt(o), hint: p[1], run: function () { s.value = o.value; s.dispatchEvent(new Event("change", { bubbles: true })); flash(s); } }); });
    });
    // the guide + the keys
    if (S.help) {
      S.help.sections.forEach(function (sec) { add({ id: "help:" + sec.id, group: "Help", label: sec.title, hint: "the guide", body: sec.text, boost: -1, run: function () { showHelp(sec.id); } }); });
      S.help.shortcuts.groups.forEach(function (gr, gi) { gr.rows.forEach(function (r, ri) { add({ id: "key:" + gi + ":" + ri, group: "Keys", label: r[1], hint: r[0] + " · " + gr.title, keys: r[0], boost: -1, run: function () { showHelp("keys:" + gi); } }); }); });
    }
    return E;
  }

  /* ---------------- the palette */
  function paint() {
    var ul = $("palList"); if (!ul) return;
    ul.innerHTML = S.list.map(function (e, i) {
      return '<li role="option" data-i="' + i + '"' + (i === S.sel ? ' class="on" aria-selected="true"' : "") + '><span class="pg">' + esc(e.group) + '</span><span class="pl">' + esc(e.label)
        + (e.hint ? '<span class="ph">' + esc(e.hint) + "</span>" : "") + "</span>" + (e.keys ? "<kbd>" + esc(e.keys) + "</kbd>" : "") + "</li>";
    }).join("") || '<li class="ph" style="cursor:default">nothing matches - try other words</li>';
    var on = ul.querySelector("li.on"); if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest" });
    $("palFoot").textContent = S.list.length + (S.list.length === 60 ? "+" : "") + " · ↑ ↓ pick · Enter runs · Esc closes";
  }
  function search() {
    if (!S.all || Date.now() - (S.builtAt || 0) > 1500) { S.all = build(); S.builtAt = Date.now(); }   // the app changes while it is open (styles arriving …)
    S.list = rank(S.all || [], $("palIn").value, S.recent, 60); S.sel = 0; paint();
  }
  function run(i) {
    var e = S.list[i]; if (!e) return;
    close(); remember(e.id);
    if (root.H3TestEvent) root.H3TestEvent("palette_run", e.label);      // 2.532.0: the 🧪 checklist ticks itself
    try { e.run(); } catch (er) { console.warn("palette:", er); }
  }
  function open(q) {
    if (!$("palOv")) mount();
    S.all = build(); S.builtAt = Date.now(); S.open = true;
    $("palOv").classList.add("on"); $("palIn").value = q || ""; search(); $("palIn").focus();
    if (!S.help) loadHelp().then(function () { if (S.open) { S.all = build(); search(); } });
    return true;
  }
  function close() { S.open = false; var o = $("palOv"); if (o) o.classList.remove("on"); }
  function loadHelp() { return fetch("/api/help").then(function (r) { return r.json(); }).then(function (j) { S.help = j && j.sections ? j : { sections: [], shortcuts: { groups: [] } }; return S.help; }).catch(function () { S.help = { sections: [], shortcuts: { groups: [] } }; return S.help; }); }
  function mount() {
    if (!$("palCss")) { var st = document.createElement("style"); st.id = "palCss"; st.textContent = CSS; document.head.appendChild(st); }
    var ov = document.createElement("div"); ov.id = "palOv"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "Find anything");
    ov.innerHTML = '<div id="palBox"><input id="palIn" type="text" autocomplete="off" spellcheck="false" placeholder="Find anything - a docker, a setting, a button, a style, the guide …" aria-label="Find anything" aria-controls="palList"><ul id="palList" role="listbox"></ul><div id="palFoot"></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener("mousedown", function (e) { if (e.target === ov) close(); });
    $("palIn").addEventListener("input", search);
    $("palIn").addEventListener("keydown", function (e) {
      e.stopPropagation();
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); S.sel = Math.min(S.list.length - 1, S.sel + 1); paint(); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); S.sel = Math.max(0, S.sel - 1); paint(); return; }
      if (e.key === "Enter") { e.preventDefault(); run(S.sel); }
    });
    $("palList").addEventListener("click", function (e) { var li = e.target.closest("li[data-i]"); if (li) run(+li.dataset.i); });
  }

  /* ---------------- 📖 Help */
  var helpBody = null;
  function showHelp(which) {
    if (root.H3TestEvent) root.H3TestEvent("help_open", which || "");
    var go = function () {
      if (!helpBody) return;
      var sel = helpBody.querySelector("select"), box = helpBody.querySelector(".hlpc"), html = "";
      if (/^keys:/.test(which)) { var gr = S.help.shortcuts.groups[+which.slice(5)] || { title: "", rows: [] }; html = "<h3>⌨ " + esc(gr.title) + "</h3><table>" + gr.rows.map(function (r) { return "<tr><td><kbd>" + esc(r[0]) + "</kbd></td><td>" + esc(r[1]) + "</td></tr>"; }).join("") + "</table>"; }
      else { var sec = S.help.sections.find(function (x) { return x.id === which; }) || S.help.sections[0]; if (sec) { html = "<h3>" + esc(sec.title) + "</h3>" + mdToHtml(sec.md); which = sec.id; } }
      box.innerHTML = html; sel.value = which; helpBody.scrollTop = 0;
      if (root.SecFloat) SecFloat.show("help", true);
    };
    return (S.help ? Promise.resolve() : loadHelp()).then(function () {
      var sel = helpBody && helpBody.querySelector("select");
      if (sel && !sel.options.length) sel.innerHTML = S.help.sections.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.title) + "</option>"; }).join("") + S.help.shortcuts.groups.map(function (gr, i) { return '<option value="keys:' + i + '">⌨ ' + esc(gr.title) + "</option>"; }).join("");
      go();
    });
  }
  function start() {
    if (!$("menubar") || !root.SecFloat || !SecFloat.add || !SecFloat.started) { setTimeout(start, 200); return; }
    if ($("palBtn")) return;
    if (!$("palCss")) { var st = document.createElement("style"); st.id = "palCss"; st.textContent = CSS; document.head.appendChild(st); }
    var btn = document.createElement("button"); btn.type = "button"; btn.className = "ghost"; btn.id = "palBtn"; btn.textContent = "🔍";
    btn.title = "Find anything - a docker, a setting, a button, a style, the guide (Ctrl+K)"; btn.setAttribute("aria-label", "Find anything (Ctrl+K)");
    var ws = $("wsWrap"), pb = $("menubar").querySelector(".projbtns");
    if (ws && ws.parentNode) ws.parentNode.insertBefore(btn, ws.nextSibling); else if (pb && pb.nextSibling) $("menubar").insertBefore(btn, pb.nextSibling); else $("menubar").appendChild(btn);
    btn.onclick = function () { open(""); };
    setTimeout(loadHelp, 5000);                         // the guide is ready before the first Ctrl+K (a quiet moment after start)
    helpBody = document.createElement("div"); helpBody.className = "hlp"; helpBody.id = "hlpBody";
    helpBody.innerHTML = '<div class="hlpbar"><select aria-label="Guide section"></select></div><div class="hlpc"></div>';
    helpBody.querySelector("select").onchange = function (e) { showHelp(e.target.value); };
    SecFloat.add({ id: "help", title: "📖 Help", w: 620, h: 640, body: helpBody, onShow: function () { if (!helpBody.querySelector(".hlpc").innerHTML) showHelp(""); } });
    // Ctrl+K - unless a docker used it itself (the timeline's split, the image editor's own palette)
    root.addEventListener("keydown", function (e) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || (e.key !== "k" && e.key !== "K")) return;
      if (e.defaultPrevented) return;
      e.preventDefault();
      if (S.open) close(); else open("");
    });
  }
  root.H3Palette = Object.assign({ open: open, close: close, entries: function () { return build(); }, search: function (q) { return rank(build(), q, S.recent, 60); }, showHelp: showHelp, state: function () { return S; } }, pure);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
