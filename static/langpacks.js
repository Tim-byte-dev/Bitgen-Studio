/* bitGen Studio — static/langpacks.js (2.715.0): SETTINGS ▸ LANGUAGES - the language packs (lib/langPacks.js,
 * routes/langPacks.js).
 *
 * Tim (verbatim): "lets do number 2, this way we don't have to create all the packs at once - if we could have a master pack
 * so users can translate the strings and upload to tigerart for the community it would be ideal"
 *
 * Each language a row: its name, built in / installed, how much is translated (the app's words, the guide, the ❔ help, the
 * shortcuts, the feature list), Use, ⤓ Export for translating, ✕ Remove (installed ones). Below: ⤒ Install a pack (.zip -
 * checked first; a language already there asks before it is replaced) and ⤓ Master pack (everything in English, to start a
 * new language). The language list next to ⊞ follows at once (H3HelpLang.refresh).
 *   pct(c) (pure)       "97 %" / "3 of 3" / "—" for a {done, total}
 *   summary(cov) (pure) [[label, text]] for a pack's coverage
 */
(function (root) {
  "use strict";
  function pct(c) {
    if (!c || !c.total) return c && c.total === 0 ? "—" : c && c.done ? String(c.done) : "—";
    if (c.total <= 30) return c.done + " of " + c.total;
    var p = Math.floor((c.done / c.total) * 100);
    return (c.done && !p ? "<1" : p) + " %";
  }
  function summary(cov) {
    if (!cov) return [];
    var out = [["App", pct({ done: (cov.ui ? cov.ui.done : 0) + (cov.patterns ? cov.patterns.done : 0), total: (cov.ui ? cov.ui.total : 0) + (cov.patterns ? cov.patterns.total : 0) })],
      ["Guide", pct(cov.guide)], ["Help", pct(cov.help)], ["Shortcuts", pct(cov.shortcuts)], ["Features", pct(cov.features)]];
    if (cov.site && (cov.site.done || cov.site.total)) out.push(["Website", pct(cov.site)]);
    return out;
  }
  var pure = { pct: pct, summary: summary };
  if (typeof module !== "undefined" && module.exports && typeof window === "undefined") { module.exports = pure; return; }

  var doc = root.document, $ = function (id) { return doc.getElementById(id); };
  var CSS = "#stab-langs .lprow{display:grid;grid-template-columns:1fr auto;gap:4px 10px;align-items:center;padding:8px 10px;border:1px solid var(--line,#3a342a);border-radius:6px;margin-bottom:6px}"
    + "#stab-langs .lprow.on{border-color:var(--tiger,#f59e2c)}#stab-langs .lpname{font-size:1.02rem}#stab-langs .lpname small{color:var(--dim,#998);margin-left:6px}"
    + "#stab-langs .lptag{font-size:.72rem;padding:1px 6px;border-radius:9px;border:1px solid var(--line,#3a342a);color:var(--dim,#998);margin-left:6px;white-space:nowrap}"
    + "#stab-langs .lpcov{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:4px 14px;font-size:.8rem;color:var(--dim,#998)}#stab-langs .lpcov b{color:var(--text,#ddd);font-weight:600}"
    + "#stab-langs .lpacts{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}#stab-langs .lpwarn{margin:4px 0 0 18px;font-size:.8rem}"
    + "#stab-langs .lpbtn{text-decoration:none;padding:2px 8px;border:1px solid var(--line,#444);border-radius:5px;color:inherit}#stab-langs #s_lpask:not(:empty){padding:8px 10px;border:1px solid var(--tiger,#f59e2c);border-radius:6px;margin:8px 0;display:flex;gap:8px;align-items:center;flex-wrap:wrap}";
  var COV = {};
  // the words, where scripts/ui-dynamic.js can read them for the translations (label: …, .textContent = "…", .title = "…")
  var COVL = [{ key: "app", label: "App" }, { key: "guide", label: "Guide" }, { key: "help", label: "Help" }, { key: "shortcuts", label: "Shortcuts" }, { key: "features", label: "Features" }, { key: "site", label: "Website" }];
  function msgEl(bad) { var m = $("s_lpmsg"); m.style.color = bad ? "var(--bad,#e66)" : ""; return m; }
  function el(tag, cls, parent) { var e = doc.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
  function useBtn(parent, on) {
    if (on) { var u = el("span", "hint", parent); u.textContent = "In use"; return; }
    var b = el("button", "ghost", parent); b.type = "button"; b.setAttribute("data-lpuse", ""); b.textContent = "Use";
  }
  function row(p, box) {
    var on = root.H3HelpLang && H3HelpLang.get() === p.id;
    var r = el("div", "lprow" + (on ? " on" : ""), box); r.setAttribute("data-lp", p.id);
    var head = el("div", "", r);
    var nm = el("span", "lpname", head); nm.lang = p.id; nm.setAttribute("data-noi18n", ""); nm.textContent = p.native;      // a pack's own words: never markup, never translated
    if (p.id !== "en") { var sm = el("small", "", head); sm.setAttribute("data-noi18n", ""); sm.textContent = (p.name !== p.native ? p.name + " · " : "") + p.id; }
    var tag = el("span", "lptag", head);
    tag.textContent = p.source === "installed" ? (p.replaces ? "installed - used instead of the built-in one" : "installed") : "built in";
    if (p.version) { var v = el("span", "lptag", head); v.setAttribute("data-noi18n", ""); v.textContent = "v" + p.version; }
    if (p.authors && p.authors.length) { var by = el("small", "", head); by.setAttribute("data-noi18n", ""); by.title = "Translated by"; by.textContent = p.authors.join(", "); }
    var acts = el("div", "lpacts", r);
    useBtn(acts, on);
    if (p.id === "en") return;
    var ex = el("a", "ghost lpbtn", acts); ex.href = "/api/langpacks/" + encodeURIComponent(p.id) + "/export.zip"; ex.download = "bitGen-language-pack-" + p.id + ".zip"; ex.setAttribute("data-lpexport", "");
    ex.title = "The pack as a .zip with today's English added where it is not translated yet - to carry on translating, or to share";
    ex.textContent = "⤓ Export for translating";
    if (p.source === "installed") {
      var rm = el("button", "ghost", acts); rm.type = "button"; rm.setAttribute("data-lpremove", "");
      rm.title = p.replaces ? "Remove it - the built-in one comes back" : "Remove this language pack";
      rm.textContent = "✕ Remove";
    }
    var cov = el("div", "lpcov", r), c = COV[p.id];
    if (!c) { var w = el("span", "hint", cov); w.textContent = "…"; return; }
    var S = {}; summary(c).forEach(function (x) { S[x[0]] = x[1]; });
    COVL.forEach(function (L) {
      var val = S[{ app: "App", guide: "Guide", help: "Help", shortcuts: "Shortcuts", features: "Features", site: "Website" }[L.key]];
      if (val == null) return;
      var it = el("span", "", cov); it.appendChild(doc.createTextNode(L.label + " ")); var bb = el("b", "", it); bb.textContent = val;
      if (L.key === "guide" && c.guide && c.guide.stale) { var o = el("small", "", it); o.textContent = " " + c.guide.stale + " older"; o.title = "Sections whose English is newer than the translation"; }
    });
  }
  function paint() {
    var box = $("s_lplist"); if (!box || !root.H3HelpLang) return;
    while (box.firstChild) box.removeChild(box.firstChild);
    row({ id: "en", native: "English", name: "English", source: "built-in" }, box);
    H3HelpLang.packs().forEach(function (p) { row(p, box); });
  }
  function coverage() {
    var packs = root.H3HelpLang ? H3HelpLang.packs() : [];
    return Promise.all(packs.map(function (p) {
      return root.fetch("/api/langpacks/" + encodeURIComponent(p.id) + "/coverage").then(function (r) { return r.ok ? r.json() : null; })
        .then(function (c) { if (c) COV[p.id] = c; }).catch(function () { /* shown without */ });
    })).then(paint);
  }
  function reload() { COV = {}; return H3HelpLang.refresh().then(function () { paint(); return coverage(); }); }
  function post(url, body) {
    return root.fetch(url, { method: "POST", headers: { "Content-Type": "application/zip" }, body: body })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) { var e = new Error(j.error || r.statusText); e.data = j; e.status = r.status; throw e; } return j; }); });
  }
  function installed(r) {
    var w = r.warnings || [];
    msgEl().textContent = w.length ? "Installed " + r.pack.native + " (" + r.pack.id + "). Notes:" : "Installed " + r.pack.native + " (" + r.pack.id + ").";
    var box = $("s_lpwarn"); while (box.firstChild) box.removeChild(box.firstChild);
    w.forEach(function (x) { var li = el("li", "", box); li.setAttribute("data-noi18n", ""); li.textContent = x; });
    return reload();
  }
  function install(buf) {
    var ask = $("s_lpask"); ask.textContent = "";
    var box = $("s_lpwarn"); box.textContent = "";
    msgEl().textContent = "Checking the pack…";
    return post("/api/langpacks/check", buf).then(function (c) {
      if (!c.installed) return post("/api/langpacks/install", buf).then(installed);
      // already there: ask before replacing (built in = used instead of it until removed)
      msgEl().textContent = "";
      var q = el("span", "", ask);
      q.textContent = c.installed.source === "built-in" ? c.pack.native + " (" + c.pack.id + ") is built in. Use this pack instead of it? Removing the pack brings the built-in one back."
        : c.pack.native + " (" + c.pack.id + ") is installed already (v" + c.installed.version + "). Replace it with this one (v" + c.pack.version + ")?";
      var yes = el("button", "ghost", ask); yes.type = "button"; yes.id = "s_lpyes"; yes.textContent = "Replace";
      var no = el("button", "ghost", ask); no.type = "button"; no.id = "s_lpno"; no.textContent = "Cancel";
      return new Promise(function (done) {
        yes.onclick = function () { ask.textContent = ""; post("/api/langpacks/install?replace=1", buf).then(installed).then(done, function (e) { msgEl(true).textContent = e.message; done(); }); };
        no.onclick = function () { ask.textContent = ""; msgEl().textContent = "Not installed."; done(); };
      });
    }).catch(function (e) { msgEl(true).textContent = e.message || String(e); });
  }
  function boot() {
    var dlg = $("settings"), tabs = dlg && dlg.querySelector(".stabs");
    if (!tabs || $("stab-langs")) return !!tabs;
    var st = doc.createElement("style"); st.textContent = CSS; doc.head.appendChild(st);
    var b = doc.createElement("button"); b.dataset.stab = "langs"; b.type = "button"; b.textContent = "Languages"; b.title = "Language packs: the languages of the app, the guide and the help";
    var th = tabs.querySelector('[data-stab="themes"]'); if (th) th.after(b); else tabs.appendChild(b);
    var pane = doc.createElement("div"); pane.className = "stab"; pane.id = "stab-langs";
    pane.innerHTML = '<p class="hint" style="margin-top:0">Each language besides English is a language pack: the app\'s own words, the guide, the ❔ help pages, the shortcut list and the feature list. Anything a pack has not translated shows in English. Pick the language with the dropdown next to ⊞ on the menu bar, or with Use here.</p>'
      + '<div id="s_lplist" aria-label="Language packs"></div>'
      + '<div id="s_lpask" aria-live="polite"></div>'
      + '<div class="rowbtns" style="margin-top:8px;align-items:center">'
      + '<button type="button" class="ghost" id="s_lpinstall" title="Add a language from a language pack .zip (it is checked first)">⤒ Install a pack</button>'
      + '<a class="ghost" id="s_lpmaster" href="/api/langpacks/master.zip" download="bitGen-language-pack-master.zip" title="Every part in English, with TRANSLATING.txt - to start a new language" style="text-decoration:none;padding:2px 8px;border:1px solid var(--line,#444);border-radius:5px;color:inherit">⤓ Master pack</a>'
      + '<input type="file" id="s_lpfile" accept=".zip,application/zip" hidden></div>'
      + '<div id="s_lpmsg" class="hint" aria-live="polite" style="margin-top:6px"></div><ul id="s_lpwarn" class="lpwarn hint"></ul>'
      + '<details style="margin-top:10px"><summary>Translate bitGen Studio into your language</summary><ol class="hint">'
      + "<li>⤓ Master pack - a .zip with everything in English and TRANSLATING.txt (how to fill each file in).</li>"
      + "<li>Unzip it, put your language's code and name in pack.json, and translate what you can - the app's words (ui.json) first make the biggest difference. Anything left as it is stays English.</li>"
      + "<li>Zip the folder again and ⤒ Install a pack - try it in the app.</li>"
      + "<li>Share it: upload the .zip on tigerart.com.au so everyone can install it.</li>"
      + "<li>Later, ⤓ Export for translating gives your pack back with the parts added since then, your translations kept.</li></ol></details>";
    var all = dlg.querySelectorAll(".stab"), themes = $("stab-themes");
    if (themes) themes.after(pane); else if (all.length) all[all.length - 1].after(pane); else tabs.after(pane);
    // a listener, not onclick: the page's own tab code (index.html) sets every tab's onclick after the scripts load
    b.addEventListener("click", function () {
      dlg.querySelectorAll(".stabs button").forEach(function (x) { x.classList.toggle("active", x === b); });
      doc.querySelectorAll(".stab").forEach(function (t) { t.classList.toggle("active", t.id === "stab-langs"); });
      reload();
    });
    $("s_lpinstall").onclick = function () { $("s_lpfile").click(); };
    $("s_lpfile").onchange = function () {
      var f = this.files && this.files[0]; this.value = "";
      if (!f) return;
      f.arrayBuffer().then(install);
    };
    pane.addEventListener("click", function (e) {
      var t = e.target, r = t.closest && t.closest("[data-lp]"); if (!r) return;
      var id = r.getAttribute("data-lp");
      if (t.closest("[data-lpuse]")) { H3HelpLang.set(id); paint(); }
      else if (t.closest("[data-lpremove]")) {
        root.fetch("/api/langpacks/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id }) })
          .then(function (x) { return x.json().then(function (j) { if (!x.ok) throw new Error(j.error); return j; }); })
          .then(function (j) { msgEl().textContent = j.builtin ? "Removed - the built-in one is back." : "Removed."; return reload(); }).catch(function (e2) { msgEl(true).textContent = e2.message; });
      }
    });
    if (root.H3HelpLang) { H3HelpLang.onPacks(function () { if (pane.classList.contains("active")) paint(); }); H3HelpLang.onChange(function () { if (pane.classList.contains("active")) paint(); }); }
    return true;
  }
  root.H3LangPacks = Object.assign({ boot: boot, reload: reload, install: install, state: function () { return { cov: COV }; } }, pure);
  (function wait(n) { if (!boot() && n < 100) setTimeout(function () { wait(n + 1); }, 100); })(0);
})(typeof window !== "undefined" ? window : globalThis);
