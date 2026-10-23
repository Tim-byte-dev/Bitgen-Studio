/* bitGen Studio — static/dockreset.js (2.579.0): SETTINGS ▸ DOCKERS - every docker, and ↺ Reset (window.H3DockReset).
 * Tim: "in settings dialog add dockers tab, add all the dockers to that tab including custom/new dockers with a reset
 * button. reset that docker's position and size to default if reset is clicked".
 * The tab lists, as they are now:
 *   the main column's dockers   Preview, Timeline, StoryBoard … Console (docker_status.json) + every extension docker
 *                               (ext/<id> - the custom / new ones, found on the page, so one added later is listed too)
 *   the side dockers            Settings, References, Assets, Queue, Gallery
 *   the floating windows        Basic Settings, LLM tokens, Model manager, House builder … (SecFloat)
 * each with where it is (in its place / floating / in a ▣ docker / maximized / closed / hidden) and ↺ Reset:
 *   a docker      back in its home spot (out of a floating window or a ▣ docker), not maximized, shown and open, its
 *                 shipped height / width (GET /api/docker-status/defaults - lib/dockerStatus.js), no 📌 pin
 *   the prompt    floating at its first place (its default)
 *   a window      not maximized / minimized, floating at its first place at its first size (shown or not as it was)
 * ↺ Reset all does every row. A docker that is not installed (the 📐 SolidCraft docker without SolidCraft) is not
 * listed. Pure: nameOf(text) (scripts/test-send579.js). */
(function (root) {
  "use strict";
  var MAIN = [["previewdock", "Preview"], ["timelinedock", "Timeline"], ["videodock", "StoryBoard"], ["imageeditdock", "Image editor"], ["comfydock", "ComfyUI"],
    ["musicdock", "Music"], ["stemsdock", "Stems"], ["sfxdock", "SFX"], ["chatdock", "Prompt chat"], ["promptdock", "Prompt"], ["consoledock", "Console"]];
  var SIDE = [["ldock", "ldock", "Settings", "no-left"], ["refs", "refsdock", "References", "no-refs"], ["assets", "assetsdock", "Assets", "no-assets"], ["qdock", "qdock", "Queue", "no-queue"], ["rdock", "rdock", "Gallery", "no-right"]];
  /** a docker header's words without its arrows, buttons' glyphs and pins (pure) */
  function nameOf(t) { return String(t || "").replace(/[▾▸⛶✕]|\u{1F5D7}|\u{1F4CC}/gu, "").replace(/\s+/g, " ").trim().slice(0, 40); }
  if (typeof module !== "undefined" && module.exports) { module.exports = { nameOf: nameOf, MAIN: MAIN, SIDE: SIDE }; return; }

  var doc = root.document;
  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var DEF = null;
  function defaults() {
    if (DEF) return Promise.resolve(DEF);
    return fetch("/api/docker-status/defaults").then(function (r) { return r.json(); }).then(function (j) { DEF = j; return j; }).catch(function () { return { docks: {} }; });
  }
  function headName(el) {
    var h = el && el.querySelector(".bhead, .dockhead h1"); if (!h) return el ? el.id : "";
    var c = h.cloneNode(true); c.querySelectorAll("button, .pin, kbd").forEach(function (x) { x.remove(); });
    return nameOf(c.textContent) || el.id;
  }
  function btnOf(id) { var G = root.H3GoneDocks || {}; for (var k in G) if (G[k] === id) return k; return $("tX_" + id) ? "tX_" + id : null; }
  function panel(pid) { try { return root.H3Panels && root.H3Panels.get ? root.H3Panels.get(pid) : null; } catch (e) { return null; } }

  /** every docker on the page now: [{kind: main | ext | side | win, id, el?, name}] */
  function list() {
    var out = [], seen = {};
    MAIN.forEach(function (m) { var el = $(m[0]); if (el) { out.push({ kind: "main", id: m[0], el: el, name: m[1] }); seen[m[0]] = 1; } });
    doc.querySelectorAll(".bdock[id]").forEach(function (el) {
      if (seen[el.id] || /^dgp_/.test(el.id) || el.classList.contains("dgperm") || el.classList.contains("sc-absent")) return;   // not installed = not shown
      seen[el.id] = 1; out.push({ kind: "ext", id: el.id, el: el, name: headName(el) });
    });
    SIDE.forEach(function (s) { var el = $(s[1]); if (el) out.push({ kind: "side", id: s[0], elId: s[1], cls: s[3], el: el, name: s[2] }); });
    var W = (root.SecFloat && root.SecFloat.windows) || {};
    Object.keys(W).forEach(function (id) { out.push({ kind: "win", id: id, name: nameOf((W[id].spec && W[id].spec.title) || id) }); });
    return out;
  }
  /** where it is now (words) */
  function where(d) {
    if (d.kind === "win") {
      var st = root.SecFloat.state(d.id) || {}, w = root.SecFloat.windows[d.id];
      var s = st.shown ? (w && w.max ? "maximized" : st.min ? "minimized" : st.mode && st.mode !== "float" ? "docked (" + st.mode + ")" : "floating") : "closed";
      return s + (st.shown && st.mode === "float" && st.w ? " · " + Math.round(st.w) + " × " + Math.round(st.h) : "");
    }
    var el = d.el, p = [];
    if (d.kind === "side") {
      if ($("app") && $("app").classList.contains(d.cls)) p.push("hidden");
      if ($("dgph_" + d.elId)) p.push("in a ▣ docker"); else if (el.closest(".h3fp")) p.push("floating");
      if (root.H3SideCollapse && root.H3SideCollapse.folded && root.H3SideCollapse.folded(d.elId)) p.push("folded");
      if (!p.length) p.push("in its place");
      p.push(Math.round(el.getBoundingClientRect().width) + " px wide");
      return p.join(" · ");
    }
    if (el.classList.contains("dockgone")) p.push("hidden");
    if (el.closest(".h3fp")) p.push(el.closest(".h3fd") ? "in a ▣ docker" : "floating");
    else if (d.id === "promptdock") p.push(el.classList.contains("pf-float") ? "floating" : el.classList.contains("pf-side") || (el.parentElement && el.parentElement.classList.contains("pf-row")) ? "docked beside a docker" : "in the column");
    else if (!el.closest("#maincol")) p.push("moved");
    else if (!p.length) p.push("in its place");
    if (el.classList.contains("maxed")) p.push("maximized");
    if (el.classList.contains("collapsed")) p.push("closed");
    var h = Math.round(el.getBoundingClientRect().height); if (h && !el.classList.contains("dockgone")) p.push(h + " px high");
    return p.join(" · ");
  }

  function showDock(id) {
    var el = $(id); if (!el) return;
    if (el.classList.contains("dockgone") && typeof root.toggleDockGone === "function") root.toggleDockGone(id, btnOf(id));
    if (el.classList.contains("collapsed") && typeof root.toggleCollapse === "function") root.toggleCollapse(id);
  }
  /** ↺ one docker -> a promise (the words of what was done) */
  function reset(d) {
    return defaults().then(function (D) {
      var def = (D.docks || {})[d.id] || {};
      if (d.kind === "win") {
        var SF = root.SecFloat, w = SF.windows[d.id]; if (!w) return "";
        if (w.max) SF.maximize(d.id, false);
        if (w.el.classList.contains("sf-min")) SF.minimize(d.id, false);
        SF.applyStates((function () { var o = {}; o[d.id] = { x: -1, y: -1, w: 0, h: 0, mode: "float", to: "", side: "", dw: 0, dh: 0, min: false }; return o; })());
        return d.name + ": back at its first place and size";
      }
      if (d.kind === "side") {
        var pr = panel("bd." + d.elId); if (pr && pr.state !== "home") root.H3Panels.home("bd." + d.elId);
        if (root.H3SideCollapse && root.H3SideCollapse.set) try { root.H3SideCollapse.set(d.elId, false); } catch (e) { /* fine */ }
        var o = {}; o[d.id] = { width: def.width || 260, max_width: 0, hidden: false };
        if (typeof root.applyLayout === "function") root.applyLayout(o);
        return d.name + ": back in its column, " + (def.width || 260) + " px wide";
      }
      var el = d.el;
      if (el.classList.contains("maxed") && typeof root.toggleMax === "function") root.toggleMax(d.id, false);
      if (d.id === "promptdock" && root.PFloat && root.PFloat.float) {
        var e = typeof root.dsEntry === "function" ? root.dsEntry("promptdock") : {};
        Object.assign(e, { floating: true, x: -1, y: -1, float_w: 0, float_h: 0, dock_to: "", dock_side: "", dock_w: 0 });
        var gp = panel("pf.promptdock"); if (gp && gp.state !== "home") root.H3Panels.home("pf.promptdock");
        try { root.PFloat.unplace(); } catch (er) { /* fine */ }
        root.PFloat.float(null, null, null, null);
      } else {
        var pid = d.id === "videodock" ? "sb.dock" : "bd." + d.id, p = panel(pid);
        if (p && p.state !== "home") root.H3Panels.home(pid);
      }
      showDock(d.id);
      if (d.kind === "main" && def.height && typeof root.applyLayout === "function") {
        var o2 = {}; o2[d.id] = { height: def.height, max_height: 0, maximized: false, hidden: false, state: "open" };
        root.applyLayout(o2);
      } else { el.style.height = ""; el.style.maxHeight = ""; el.style.flex = ""; }
      return d.name + (d.id === "promptdock" ? ": floating at its first place" : ": back in its place" + (def.height ? ", " + def.height + " px high" : ""));
    }).then(function (words) {
      try { if (typeof root.paintPins === "function") root.paintPins(); if (typeof root.saveLayout === "function") root.saveLayout(); if (typeof root.reflowSoon === "function") root.reflowSoon(); root.dispatchEvent(new Event("resize")); } catch (e) { /* jsdom */ }
      if (root.H3TestEvent) try { root.H3TestEvent("docker_reset", d.id); } catch (e) { /* fine */ }
      return words;
    });
  }

  /* ---- the tab */
  var CSS = "#stab-dockers table{width:100%;border-collapse:collapse;font-size:12px}#stab-dockers td,#stab-dockers th{padding:4px 6px;border-bottom:1px solid var(--line,#3a352e);text-align:left;vertical-align:middle}"
    + "#stab-dockers th{font-weight:600;opacity:.75}#stab-dockers td.w{opacity:.75}#stab-dockers h4{margin:10px 0 4px;font-size:12px}#stab-dockers .k{opacity:.6;font-size:11px}";
  var GROUPS = [["main", "The main column"], ["ext", "Extension dockers (custom / new)"], ["side", "The side dockers"], ["win", "Floating windows"]];
  function paint(msg) {
    var host = $("drList"); if (!host) return;
    var all = list();
    host.innerHTML = GROUPS.map(function (g) {
      var rows = all.filter(function (d) { return d.kind === g[0]; });
      if (!rows.length) return "";
      return "<h4>" + esc(g[1]) + '</h4><table><tr><th style="width:30%">Docker</th><th>Now</th><th style="width:90px"></th></tr>' + rows.map(function (d) {
        return '<tr><td>' + esc(d.name) + ' <span class="k">' + esc(d.id) + '</span></td><td class="w">' + esc(where(d)) + '</td><td><button type="button" class="ghost" data-drreset="' + esc(d.kind + ":" + d.id) + '" title="Put ' + esc(d.name) + ' back at its default place and size">↺ Reset</button></td></tr>';
      }).join("") + "</table>";
    }).join("");
    $("drMsg").textContent = msg || "";
    host.querySelectorAll("[data-drreset]").forEach(function (b) {
      b.onclick = function () {
        var k = b.dataset.drreset, d = list().find(function (x) { return x.kind + ":" + x.id === k; }); if (!d) return;
        reset(d).then(function (w) { setTimeout(function () { paint("↺ " + w); }, 250); }).catch(function (e) { paint("↺ " + d.name + ": " + e.message); });
      };
    });
  }
  function resetAll() {
    var all = list(), words = [];
    return all.reduce(function (p, d) { return p.then(function () { return reset(d).then(function (w) { if (w) words.push(w); }).catch(function () { /* the next */ }); }); }, Promise.resolve())
      .then(function () { setTimeout(function () { paint("↺ every docker reset (" + words.length + ")"); }, 300); return words; });
  }
  function boot() {
    var dlg = $("settings"), tabs = dlg && dlg.querySelector(".stabs");
    if (!tabs || $("stab-dockers")) return !!tabs;
    var st = doc.createElement("style"); st.textContent = CSS; doc.head.appendChild(st);
    var b = doc.createElement("button"); b.dataset.stab = "dockers"; b.textContent = "Dockers"; b.type = "button";
    var ext = tabs.querySelector('[data-stab="extensions"]'); if (ext) ext.after(b); else tabs.appendChild(b);
    var pane = doc.createElement("div"); pane.className = "stab"; pane.id = "stab-dockers";
    pane.innerHTML = '<p class="hint help" style="margin:0 0 8px">Every docker and floating window, where it is now, and ↺ Reset: back at its default place and size '
      + "(out of a floating window or a ▣ docker, not maximized, shown and open, its first height / width). Dockers you add later (extensions) are listed too.</p>"
      + '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><button type="button" class="ghost" id="drAll" title="Reset every docker and window">↺ Reset all</button>'
      + '<button type="button" class="ghost" id="drRefresh" title="Read where they are again">⟳</button><span id="drMsg" class="hint"></span></div><div id="drList"></div>';
    var all = dlg.querySelectorAll(".stab"); if (all.length) all[all.length - 1].after(pane); else tabs.after(pane);
    b.onclick = function () {
      dlg.querySelectorAll(".stabs button").forEach(function (x) { x.classList.toggle("active", x === b); });
      doc.querySelectorAll(".stab").forEach(function (t) { t.classList.toggle("active", t.id === "stab-dockers"); });
      paint();
    };
    $("drAll").onclick = function () {
      var ask = typeof root.appConfirm === "function" ? root.appConfirm("Put EVERY docker and floating window back at its default place and size?", "Reset all dockers") : Promise.resolve(root.confirm("Reset every docker?"));
      Promise.resolve(ask).then(function (ok) { if (ok) resetAll(); });
    };
    $("drRefresh").onclick = function () { paint(); };
    return true;
  }
  function open() {
    if (typeof root.openSettings === "function") root.openSettings(); else if ($("settings") && !$("settings").open) $("settings").showModal();
    var b = doc.querySelector('#settings .stabs [data-stab="dockers"]'); if (b) b.click();
  }
  root.H3DockReset = { list: list, where: where, reset: reset, resetAll: resetAll, paint: paint, open: open, nameOf: nameOf };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : globalThis);
