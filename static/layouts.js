/* bitGen Studio — static/layouts.js (2.587.0): Settings ▸ Dockers - 👁 TURN A DOCKER OFF (it and its status-bar button
 * go) + LAYOUTS (the dockers + the theme, saved / exported / imported / made the default) - window.H3Layouts.
 * Tim: "in dockers add a visible icon next to the dockers name is clicked change the visibility of the icon - if hidden
 * hide the docker and the statusbar button for the docker - allow user to export/import theme and dockers layout .
 * themes will be saved in themes and full docker layouts folder which i can copy into the repo and make it the default
 * theme/layout".
 *   👁 / 🚫 (beside each docker's name in Settings ▸ Dockers)  off = the docker is hidden AND its status-bar button is
 *       gone (so it cannot be opened by accident); 👁 again brings both back. Kept in this browser (h3.dockoff) and in
 *       a layout. A floating window's own button goes too.
 *   🗂 Layouts  💾 Save layout = layouts/<name>.json (the install folder's layout files + this browser's docker memory +
 *       the theme); ↺ Apply (the page reloads into it); ⤓ Export a .json; ⤒ Import one; ★ Save as the default =
 *       layouts/default.json. Copy layouts/default.json (and themes/default.json) into the repo: a fresh install starts
 *       from them (routes/layouts.js seed) - a browser that never picked a theme takes themes/default.json.
 * Pure (scripts/test-layouts587.js): pickLocal(storage keys -> the layout's), offList(json). */
(function (root) {
  "use strict";
  var LOCAL = /^h3\.(g|v|c|d|s)\.[A-Za-z0-9_.-]+$|^h3\.dockoff$/;
  /** the layout's share of this browser's memory: which dockers are hidden / folded / turned off, their sizes (pure) */
  function pickLocal(entries) { var o = {}; (entries || []).forEach(function (kv) { if (LOCAL.test(kv[0])) o[kv[0]] = String(kv[1]); }); return o; }
  function offList(txt) { try { var a = JSON.parse(txt || "[]"); return Array.isArray(a) ? a.filter(function (x) { return typeof x === "string" && /^[A-Za-z0-9_:-]{1,60}$/.test(x); }) : []; } catch (e) { return []; } }
  if (typeof module !== "undefined" && module.exports) { module.exports = { pickLocal: pickLocal, offList: offList, LOCAL: LOCAL }; return; }

  var doc = root.document;
  function $(id) { return doc.getElementById(id); }
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var ls = {
    get: function (k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { if (v == null) root.localStorage.removeItem(k); else root.localStorage.setItem(k, v); } catch (e) { /* private */ } },
    keys: function () { var out = []; try { for (var i = 0; i < root.localStorage.length; i++) out.push(root.localStorage.key(i)); } catch (e) { /* none */ } return out; },
  };
  var SIDE_BTN = { ldock: "tL", refs: "tRefs", assets: "tAssets", qdock: "tQ", rdock: "tR" };
  var SIDE_EL = { ldock: "ldock", refs: "refsdock", assets: "assetsdock", qdock: "qdock", rdock: "rdock" };
  function offs() { return offList(ls.get("h3.dockoff")); }
  function keyOf(d) { return d.kind === "win" ? "win:" + d.id : d.id; }
  function isOff(d) { return offs().indexOf(keyOf(d)) >= 0; }
  function btnFor(kind, id) {
    if (kind === "win") { var w = root.SecFloat && root.SecFloat.windows && root.SecFloat.windows[id]; return w && w.spec && w.spec.button ? w.spec.button : null; }
    if (kind === "side") return $(SIDE_BTN[id]);
    var G = root.H3GoneDocks || {}; for (var k in G) if (G[k] === id) return $(k);
    return $("tX_" + id);
  }
  function kindOf(key) { return /^win:/.test(key) ? "win" : SIDE_BTN[key] ? "side" : "dock"; }
  /** the docker on / off - off: hidden + its status-bar button gone */
  function setOne(kind, id, off) {
    var b = btnFor(kind, id); if (b) b.classList.toggle("dockoffbtn", off);
    if (kind === "win") { if (off && root.SecFloat && root.SecFloat.show) try { root.SecFloat.show(id, false); } catch (e) { /* fine */ } return; }
    if (kind === "side") {
      var o = {}; o[id] = { hidden: off };
      if (typeof root.applyLayout === "function") try { root.applyLayout(o); } catch (e) { /* fine */ }
      var el = $(SIDE_EL[id]); if (el) el.classList.toggle("dockoff", off);
      return;
    }
    var d = $(id); if (!d) return;
    var gone = d.classList.contains("dockgone");
    if (off !== gone && typeof root.toggleDockGone === "function") root.toggleDockGone(id, b ? b.id : null);
    d.classList.toggle("dockoff", off);
  }
  function set(d, off) {
    var k = keyOf(d), l = offs().filter(function (x) { return x !== k; });
    if (off) l.push(k);
    ls.set("h3.dockoff", l.length ? JSON.stringify(l) : null);
    setOne(d.kind === "win" ? "win" : d.kind === "side" ? "side" : "dock", d.id, off);
    try { if (typeof root.saveLayout === "function") root.saveLayout(); if (typeof root.reflowSoon === "function") root.reflowSoon(); root.dispatchEvent(new Event("resize")); } catch (e) { /* jsdom */ }
    return off;
  }
  /** at start: the turned-off dockers stay off (after the page has restored its layout) */
  function applyAll() { offs().forEach(function (k) { var kind = kindOf(k); setOne(kind, kind === "win" ? k.slice(4) : k, true); }); }

  /* ---------------- layouts */
  function jget(u) { return fetch(u).then(function (r) { return r.json(); }); }
  function jpost(u, b) { return fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json().then(function (j) { if (!r.ok && !j.error) j.error = "HTTP " + r.status; return j; }); }); }
  function localNow() { return pickLocal(ls.keys().map(function (k) { return [k, ls.get(k)]; })); }
  function themeNow(name) { try { return root.H3Theme && root.H3Theme.snapshot ? root.H3Theme.snapshot(name) : null; } catch (e) { return null; } }
  function flush() { try { if (typeof root.saveLayout === "function") root.saveLayout(); if (typeof root.flushLayout === "function") root.flushLayout(); } catch (e) { /* fine */ } }
  function save(name) {
    flush();
    return new Promise(function (ok) { setTimeout(ok, 700); }).then(function () { return jpost("/api/layouts/save", { name: name, local: localNow(), theme: themeNow(name) }); });
  }
  function useLocal(local) {
    ls.keys().forEach(function (k) { if (LOCAL.test(k)) ls.set(k, null); });
    Object.keys(local || {}).forEach(function (k) { if (LOCAL.test(k)) ls.set(k, local[k]); });
  }
  function apply(name) {
    return jpost("/api/layouts/apply", { name: name }).then(function (r) {
      if (r.error) return r;
      useLocal(r.local);
      if (r.theme && root.H3Theme && root.H3Theme.use) try { root.H3Theme.use(r.theme); } catch (e) { /* the colours stay */ }
      if (root.H3TestEvent) try { root.H3TestEvent("layout_applied", name); } catch (e) { /* fine */ }
      if (!root.__H3_NO_RELOAD) setTimeout(function () { root.location.reload(); }, 150);
      return r;
    });
  }
  function say(t, bad) { var m = $("lyMsg"); if (m) { m.textContent = t || ""; m.style.color = bad ? "#e66" : ""; } }
  function paint() {
    var host = $("lyBox"); if (!host) return Promise.resolve();
    return jget("/api/layouts").then(function (j) {
      var L = j.layouts || [];
      $("lyList").innerHTML = L.length ? "<table><tr><th>Layout</th><th>Saved</th><th>Has</th><th></th></tr>" + L.map(function (x) {
        return "<tr><td>" + (x.default ? "★ " : "") + esc(x.name) + '</td><td class="k">' + esc(x.saved ? new Date(x.saved).toLocaleString() : "") + '</td><td class="k">' + esc(x.files.length + " layout file(s)" + (x.theme ? " · theme " + x.theme : "")) + "</td>"
          + '<td style="white-space:nowrap"><button class="ghost" type="button" data-lyapply="' + esc(x.name) + '" title="Put the dockers (and the theme) back as this layout has them - the page reloads">↺ Apply</button> '
          + '<a class="ghost" href="/api/layouts/' + encodeURIComponent(x.name) + '?download=1" download="' + esc(x.name) + '.json" style="text-decoration:none;padding:2px 7px;border:1px solid var(--line,#444);border-radius:5px;color:inherit" title="The layout as a .json file">⤓ Export</a> '
          + '<button class="ghost" type="button" data-lydel="' + esc(x.name) + '" title="Delete layouts/' + esc(x.name) + '.json">✕</button></td></tr>';
      }).join("") + "</table>" : '<div class="k">No layouts saved yet.</div>';
      $("lyList").querySelectorAll("[data-lyapply]").forEach(function (b) { b.onclick = function () { say("applying " + b.dataset.lyapply + "…"); apply(b.dataset.lyapply).then(function (r) { if (r.error) say(r.error, true); }); }; });
      $("lyList").querySelectorAll("[data-lydel]").forEach(function (b) { b.onclick = function () {
        var c = root.appConfirm ? root.appConfirm("Delete layouts/" + b.dataset.lydel + ".json?") : Promise.resolve(root.confirm("Delete?"));
        Promise.resolve(c).then(function (ok) { if (ok) jpost("/api/layouts/delete", { name: b.dataset.lydel }).then(function () { say("deleted"); paint(); }); });
      }; });
    });
  }
  function boot() {
    var pane = $("stab-dockers"); if (!pane || $("lyBox")) return !!pane;
    var st = doc.createElement("style");
    st.textContent = ".dockoff{display:none!important}.dockoffbtn{display:none!important}#lyBox{border:1px solid var(--line,#3a352e);border-radius:8px;padding:8px 10px;margin:12px 0 0}#lyBox table{width:100%;border-collapse:collapse;font-size:12px}"
      + "#lyBox td,#lyBox th{padding:3px 6px;border-bottom:1px solid var(--line,#3a352e);text-align:left}#lyBox .k{opacity:.65;font-size:11px}#lyBox .r{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:4px 0}"
      + ".drvis{padding:0 5px;margin-right:4px;font-size:13px;line-height:18px}.drvis.off{opacity:.7}";
    doc.head.appendChild(st);
    var box = doc.createElement("div"); box.id = "lyBox";
    box.innerHTML = '<h4 style="margin:0 0 6px;font-size:12.5px">🗂 Layouts - the dockers (where, how big, shown / hidden / off) + the theme</h4>'
      + '<div class="r"><input type="text" id="lyName" placeholder="a name, e.g. Editing 1440p" style="min-width:200px"><button type="button" id="lySave" title="layouts/<name>.json in the install folder">💾 Save layout</button>'
      + '<button class="ghost" type="button" id="lyDefault" title="Save the dockers and the theme as they are now as layouts/default.json - copy it into the repo (with themes/default.json) to make it the default">★ Save as the default</button>'
      + '<button class="ghost" type="button" id="lyImport">⤒ Import…</button><input type="file" id="lyFile" accept=".json,application/json" class="hidden"></div>'
      + '<div id="lyList"></div><div class="k" id="lyMsg" role="status" style="margin-top:4px"></div>'
      + '<div class="k" style="margin-top:4px">A layout is layouts/&lt;name&gt;.json; a theme is themes/&lt;name&gt;.json (Settings ▸ Themes ▸ 💾 Save theme, ⤓ Export, ⤒ Import). '
      + "Copy <b>layouts/default.json</b> and <b>themes/default.json</b> into the repo: a fresh install starts with that layout, and a browser that never picked a theme takes that one.</div>";
    pane.appendChild(box);
    $("lyName").onkeydown = function (e) { e.stopPropagation(); if (e.key === "Enter") $("lySave").click(); };
    $("lySave").onclick = function () { var n = $("lyName").value.trim(); if (!n) { say("give the layout a name", true); return; } save(n).then(function (r) { if (r.error) say(r.error, true); else { say("💾 saved as " + r.file); paint(); } }); };
    $("lyDefault").onclick = function () {
      save("default").then(function (r) {
        if (r.error) { say(r.error, true); return; }
        var th = themeNow("default"), p = th && root.fetch ? jpost("/api/themes/save", { name: "default", theme: th }) : Promise.resolve(null);
        p.then(function () { say("★ saved as layouts/default.json + themes/default.json - copy both into the repo to make them the default"); paint(); });
      });
    };
    $("lyImport").onclick = function () { $("lyFile").value = ""; $("lyFile").click(); };
    $("lyFile").onchange = function () {
      var f = this.files && this.files[0]; if (!f) return;
      f.text().then(function (txt) {
        return fetch("/api/layouts/import?name=" + encodeURIComponent(f.name.replace(/\.json$/i, "")), { method: "POST", headers: { "Content-Type": "text/plain" }, body: txt }).then(function (r) { return r.json(); });
      }).then(function (r) { if (r.error) say(r.error, true); else { say("⤒ imported as " + r.file + " - ↺ Apply it"); paint(); } });
    };
    var tabBtn = doc.querySelector('#settings .stabs [data-stab="dockers"]'); if (tabBtn) tabBtn.addEventListener("click", function () { setTimeout(paint, 50); });
    paint();
    return true;
  }
  /** a fresh install seeded from layouts/default.json: this browser takes its docker memory once; a browser that never
   *  picked a theme takes themes/default.json */
  function firstRun() {
    jget("/api/layouts").then(function (j) {
      var s = j.seeded;
      if (s && ls.get("h3.layoutSeed") !== s.token) {
        ls.set("h3.layoutSeed", s.token);
        useLocal(s.local);
        if (s.theme && root.H3Theme && root.H3Theme.use && !ls.get("h3.theme") && !ls.get("h3.themeName")) try { root.H3Theme.use(s.theme); } catch (e) { /* fine */ }
        applyAll();
      }
    }).catch(function () { /* no server */ });
    if (!ls.get("h3.theme") && !ls.get("h3.themeName") && !ls.get("h3.themeVars") && !ls.get("h3.themeDefaultTried")) {
      ls.set("h3.themeDefaultTried", "1");
      fetch("/api/themes/default").then(function (r) { return r.ok ? r.json() : null; }).then(function (t) { if (t && t.vars && root.H3Theme && root.H3Theme.use) root.H3Theme.use(t); }).catch(function () { /* none */ });
    }
  }
  root.H3Layouts = { isOff: isOff, set: set, applyAll: applyAll, save: save, apply: apply, paint: paint, offs: offs, localNow: localNow, pickLocal: pickLocal };
  function start() { boot() || setTimeout(boot, 1500); setTimeout(function () { applyAll(); firstRun(); }, 1200); }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
