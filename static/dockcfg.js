/* bitGen Studio — DOCKER CONFIGS (2.392.0), window.DockCfg.
 *
 * Tim (verbatim): "setting heights when other dockers are open to maintain ui / add a button to the right hand side of
 * the main menubar - docker configs / create a file, docker.cfg / this file will house docker sizes when open with
 * other dockers. example if music, prompt chat and prompt dockers are open, record the sizes of all the dockers when the
 * button is pressed / when only they are opened again together, load the default sizes from cfg file. if a new docker
 * is opened, look to see if their is a configuration for the 4 dockers together while they are open. / i would like to
 * maintain a consistant ui. not one that has mostly cut off. and because people will likely use different resolutions
 * they should have the option to layout the dockers as they like but not have to do it each time."
 *
 *   THE SET       the column dockers that are OPEN (on screen and not collapsed - the floating prompt counts while it
 *                 is shown) -> a key "chatdock+musicdock+promptdock" (sorted ids)
 *   BUTTON        icon only (2.394.0): ⊞ - its tooltip and aria-label say "Docker configs"
 *   SAVE          ⊞ Docker configs ▸ 💾 Save: every docker's size as it is now (heights, the side docks' widths, 📌
 *                 maxes, the maximized one, the prompt's floating box) for THIS set at THIS window size -> docker.cfg
 *                 (lib/dockerCfg.js). A set can hold a layout per window size (up to 6) - another screen, another
 *                 layout, each made once.
 *   LOAD          whenever the set changes (a docker opened / closed / hidden / shown) and at start: the saved layout
 *                 for the new set - the one saved at the nearest window size - is applied; at another size its heights
 *                 are scaled to the column and the side widths to the window, so nothing ends up cut off. No layout
 *                 for the set = the column's own fit (as before). "Load automatically" can be turned off.
 * The pure parts (the key, the pick, the scaling) are tested in Node; the page part uses index.html's layoutState() /
 * applyLayout() / reflowSoon() (the docker_status.json machinery) and the floating prompt's PFloat.restore().
 */
(function (root) {
  "use strict";
  var BOTTOM = ["previewdock", "timelinedock", "videodock", "imageeditdock", "comfydock", "musicdock", "stemsdock",
                "sfxdock", "chatdock", "promptdock", "consoledock"];
  var SIDE = ["ldock", "refs", "assets", "qdock", "rdock"];
  var NAMES = { previewdock: "Preview", timelinedock: "Timeline", videodock: "StoryBoard", imageeditdock: "Image editor",
                comfydock: "ComfyUI", musicdock: "Music", stemsdock: "Stems", sfxdock: "SFX", chatdock: "Chat",
                promptdock: "Prompt", consoledock: "Console" };
  var SAME = 40;                     // window sizes within 40 px are "the same screen"

  /** the open set -> its key (known column dockers only, sorted, no repeats) */
  function keyOf(ids) {
    var seen = {}, out = [];
    (ids || []).forEach(function (id) { if (BOTTOM.indexOf(id) >= 0 && !seen[id]) { seen[id] = 1; out.push(id); } });
    return out.sort().join("+");
  }
  function namesOf(key) { return String(key || "").split("+").filter(Boolean).map(function (id) { return NAMES[id] || id; }); }
  /** the layout saved at the window size nearest (w, h): the same screen first, else the closest by size */
  function pick(variants, w, h) {
    var best = null, bd = Infinity;
    (variants || []).forEach(function (v) {
      var ww = (v.window || {}).w || 0, hh = (v.window || {}).h || 0;
      var d = Math.abs(ww - w) + Math.abs(hh - h);
      if (d < bd) { bd = d; best = v; }
    });
    return best ? { variant: best, exact: bd <= SAME * 2 } : null;
  }
  /** the docks to apply: the set's heights scaled to this column (col_h / saved col h), the side widths to this window,
   *  never below 60 px a docker / 140 px a side dock; docks outside the set left alone; hidden never touched */
  function scaled(variant, key, colH, winW) {
    var v = variant || {}, set = String(key || "").split("+"), out = {};
    var ks = v.col && v.col.h > 0 && colH > 0 && Math.abs(colH - v.col.h) > 4 ? colH / v.col.h : 1;
    var kw = v.window && v.window.w > 0 && winW > 0 && Math.abs(winW - v.window.w) > SAME ? winW / v.window.w : 1;
    Object.keys(v.docks || {}).forEach(function (id) {
      var d = v.docks[id] || {};
      if (BOTTOM.indexOf(id) >= 0) {
        if (set.indexOf(id) < 0) return;
        var o = { state: "open", maximized: !!d.maximized };
        if (d.height > 0) o.height = Math.max(60, Math.round(d.height * ks));
        o.max_height = d.max_height > 0 ? Math.max(60, Math.round(d.max_height * ks)) : 0;
        out[id] = o;
      } else if (SIDE.indexOf(id) >= 0) {
        var s = {};
        if (d.width > 0) s.width = Math.max(140, Math.min(640, Math.round(d.width * kw)));
        s.max_width = d.max_width > 0 ? Math.max(140, Math.min(640, Math.round(d.max_width * kw))) : 0;
        out[id] = s;
      }
    });
    return { docks: out, scale: ks, wscale: kw };
  }

  /* ================================ the page ================================ */
  function start() {
    if (typeof document === "undefined" || DockCfg.started) return;
    DockCfg.started = true;
    var $ = function (id) { return document.getElementById(id); };
    var CFG = (root.H3_DOCK_CFG && root.H3_DOCK_CFG.configs) ? root.H3_DOCK_CFG : { version: 1, auto: true, configs: {} };
    var lastKey = null, applying = false, timer = null;

    function openIds() {
      return BOTTOM.filter(function (id) {
        var el = $(id);
        return !!el && !el.classList.contains("dockgone") && !el.classList.contains("collapsed") && !el.classList.contains("minned");
      });
    }
    function colH() { var c = $("maincol"); return c ? Math.round(c.clientHeight) : 0; }
    function winSize() { return { w: root.innerWidth || 0, h: root.innerHeight || 0 }; }
    function say(t) { var n = $("scNotes"); if (typeof root.logLine === "function") root.logLine("[docker configs] " + t); var m = $("dockCfgMsg"); if (m) m.textContent = t; }

    function apply(key, why) {
      var c = CFG.configs[key];
      if (!c || !(c.variants || []).length || typeof root.applyLayout !== "function") return false;
      var ws = winSize(), p = pick(c.variants, ws.w, ws.h);
      var sc = scaled(p.variant, key, colH(), ws.w);
      // the set's dockers are open by definition, the side docks stay as they are now (applyLayout would otherwise
      // re-apply a stale hidden flag from the docker_status record)
      key.split("+").forEach(function (id) { if (sc.docks[id]) sc.docks[id].hidden = false; });
      var SIDE_CLS = { ldock: "no-left", refs: "no-refs", assets: "no-assets", qdock: "no-queue", rdock: "no-right" };
      var app = $("app"), vis = p.variant.vis || null;
      // 2.432.0: a layout saved with what was on screen shows / hides the side docks as they were; an older one leaves them
      SIDE.forEach(function (id) {
        if (vis && vis.side && typeof vis.side[id] === "boolean") { sc.docks[id] = sc.docks[id] || {}; sc.docks[id].hidden = vis.side[id]; }
        else if (sc.docks[id] && app) sc.docks[id].hidden = app.classList.contains(SIDE_CLS[id]);
      });
      applying = true;
      try {
        root.applyLayout(sc.docks);
        var pr = p.variant.prompt;
        if (pr && key.split("+").indexOf("promptdock") >= 0 && typeof root.dsEntry === "function") {
          var e = root.dsEntry("promptdock");
          ["floating", "x", "y", "float_w", "float_h", "dock_to", "dock_side", "dock_w"].forEach(function (k) { if (pr[k] !== undefined) e[k] = pr[k]; });
          if (root.PFloat && root.PFloat.restore) root.PFloat.restore();
        }
        applyPanels(p.variant);
        if (typeof root.reflowSoon === "function") root.reflowSoon();
        if (typeof root.saveLayout === "function") setTimeout(root.saveLayout, 50);
      } finally { setTimeout(function () { applying = false; }, 300); }
      say("layout loaded for " + namesOf(key).join(" + ") + (p.exact ? "" : " (saved at " + p.variant.window.w + "×" + p.variant.window.h + ", fitted to this window)") + (why ? " - " + why : ""));
      paint();
      return true;
    }
    /** 2.432.0: the floating panels (Basic Settings, the negative prompt, the camera ... - SecFloat), the dockers beside
     *  the timeline canvas (🎤 Karaoke, 🧰 Tools - TlStageDock) and their columns: where, how big, shown */
    function applyPanels(v) {
      try { if (v.floats && root.SecFloat && root.SecFloat.applyStates) root.SecFloat.applyStates(v.floats); } catch (e) { console.warn("docker layout floats:", e); }
      try {
        var T = root.TlStageDock;
        if (T && v.cols && T.colW) { if (v.cols.L > 0) T.colW("L", v.cols.L); if (v.cols.R > 0) T.colW("R", v.cols.R); }
        if (T && v.panels) Object.keys(v.panels).forEach(function (id) { var P = T.panels[id]; if (P && P.apply) P.apply(v.panels[id]); });
      } catch (e) { console.warn("docker layout panels:", e); }
    }
    function check(why) {
      if (applying) return;
      var key = keyOf(openIds());
      if (key === lastKey) return;
      lastKey = key;
      paint();
      // 2.575.0: at start the layout the app was closed with is put back (docker_status / panel_layout) - a saved docker
      // config does not override it while the dockers settle; it applies again from the user's own opening / closing
      if (Date.now() < bootUntil) return;
      if (CFG.auto !== false && key) apply(key, why);
    }
    function soon() { clearTimeout(timer); timer = setTimeout(function () { check("these dockers were opened together"); }, 180); }

    function snapshot() {
      var docks = typeof root.layoutState === "function" ? root.layoutState() : {};
      var e = typeof root.dsEntry === "function" ? root.dsEntry("promptdock") : {};
      // 2.432.0: what is on screen (every docker: hidden / collapsed; the side docks) + the floating panels
      var vis = { bottom: {}, side: {} }, app = $("app");
      var SIDE_CLS = { ldock: "no-left", refs: "no-refs", assets: "no-assets", qdock: "no-queue", rdock: "no-right" };
      BOTTOM.forEach(function (id) { var el = $(id); if (el) vis.bottom[id] = { gone: el.classList.contains("dockgone"), collapsed: el.classList.contains("collapsed") }; });
      SIDE.forEach(function (id) { if (app) vis.side[id] = app.classList.contains(SIDE_CLS[id]); });
      var floats = root.SecFloat && root.SecFloat.states ? root.SecFloat.states() : {};
      var panels = {}, cols = {}, T = root.TlStageDock;
      if (T && T.panels) Object.keys(T.panels).forEach(function (id) { var P = T.panels[id]; if (P && P.state) panels[id] = P.state(); });
      if (T && T.colW) { cols.L = T.colW("L"); cols.R = T.colW("R"); }
      return { open: openIds(), window: winSize(), col: { h: colH() }, docks: docks, vis: vis, floats: floats, panels: panels, cols: cols,
               prompt: { floating: e.floating, x: e.x, y: e.y, float_w: e.float_w, float_h: e.float_h, dock_to: e.dock_to || "", dock_side: e.dock_side || "", dock_w: e.dock_w || 0 } };
    }
    function post(url, body, method) {
      return fetch(url, { method: method || "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "refused"); return j; }); });
    }
    function save() {
      var s = snapshot();
      if (!s.open.length) { say("open the dockers you want first"); return Promise.resolve(null); }
      return post("/api/docker-cfg/save", s).then(function (j) {
        CFG = j.cfg || CFG; lastKey = keyOf(s.open);
        say("saved: " + namesOf(lastKey).join(" + ") + " at " + s.window.w + "×" + s.window.h + " - which dockers are shown, their sizes and the floating panels' places; they open like this whenever they are open together");
        paint(); return j;
      }).catch(function (e) { say("could not save: " + e.message); });
    }
    function remove(key, w, h) {
      return post("/api/docker-cfg/delete", { key: key, w: w, h: h }).then(function (j) { CFG = j.cfg || CFG; say("layout removed"); paint(); })
        .catch(function (e) { say("could not remove: " + e.message); });
    }
    function setAuto(on) {
      return post("/api/docker-cfg/settings", { auto: !!on }).then(function (j) { CFG = j.cfg || CFG; paint(); }).catch(function () {});
    }

    /* the menubar button + its panel */
    var bar = $("menubar");
    if (!bar || $("dockCfgBtn")) return;
    var wrap = document.createElement("span"); wrap.id = "dockCfgWrap"; wrap.style.cssText = "margin-left:auto;position:relative;display:inline-flex";
    wrap.innerHTML = '<button class="ghost" id="dockCfgBtn" type="button" title="Docker configs - save the sizes of the dockers open now; they open the same way whenever they are open together again (docker.cfg)" aria-label="Docker configs" aria-haspopup="true" aria-expanded="false">⊞</button>'
      + '<div id="dockCfgPanel" role="dialog" aria-label="Docker configs" style="display:none"></div>';
    bar.appendChild(wrap);
    var panel = $("dockCfgPanel"), btn = $("dockCfgBtn");
    function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function paint() {
      if (!panel) return;
      var key = keyOf(openIds()), ws = winSize(), cur = CFG.configs[key];
      var mine = cur && (cur.variants || []).length ? pick(cur.variants, ws.w, ws.h) : null;
      btn.classList.toggle("on", !!mine);
      var rows = Object.keys(CFG.configs).sort().map(function (k) {
        return (CFG.configs[k].variants || []).map(function (v) {
          return '<div class="dcrow' + (k === key ? " cur" : "") + '"><span class="dcn">' + esc(namesOf(k).join(" + ")) + '</span><span class="dcs">' + v.window.w + "×" + v.window.h + "</span>"
            + '<button class="ghost" data-dcapply="' + esc(k) + '" title="Open these dockers and size them like this">Load</button>'
            + '<button class="ghost" data-dcdel="' + esc(k) + '" data-w="' + v.window.w + '" data-h="' + v.window.h + '" title="Forget this layout">✕</button></div>';
        }).join("");
      }).join("");
      panel.innerHTML = '<div class="dchead"><b class="dct">Docker layout</b> · open now: <b>' + esc(key ? namesOf(key).join(" + ") : "no docker") + "</b>"
        + '<div class="dcsub">' + (mine ? (mine.exact ? "a layout is saved for these at this window size" : "a layout is saved for these at " + mine.variant.window.w + "×" + mine.variant.window.h + " - it is fitted to this window")
          : "no layout saved for these yet") + " · this window " + ws.w + "×" + ws.h + "</div></div>"
        + '<div class="dcbtns"><button class="ghost" id="dockCfgSave" type="button" title="Keep which dockers are shown, every docker\'s size and the floating panels\' places for these dockers at this window size">💾 Save layout</button>'
        + (mine ? '<button class="ghost" id="dockCfgLoad" type="button">↺ Load it again</button>' : "") + "</div>"
        // 2.438.0: empty named dockers (static/floatpanels.js) - any floating docker docks in them
        + (root.H3Panels ? '<div class="dcbtns"><button class="ghost" id="dockCfgNew" type="button" title="An empty floating docker with a name - drag floating dockers into it; ⚙ on it: main docker or confined to a docker">▣ New docker…</button>'
          + root.H3Panels.list().filter(function (d) { return d.kind === "docker"; }).map(function (d) { return '<button class="ghost" data-fpshow="' + esc(d.id) + '" title="Show it">▣ ' + esc(d.title) + "</button>"; }).join("") + "</div>" : "")
        + '<label class="dcauto"><input type="checkbox" id="dockCfgAuto"' + (CFG.auto !== false ? " checked" : "") + '> Load saved layouts automatically</label>'
        + '<div class="dclist">' + (rows || '<div class="dcsub">Nothing saved yet. Open the dockers you work with together, size them, then 💾 Save.</div>') + "</div>"
        + '<div class="dcsub" id="dockCfgMsg" aria-live="polite"></div>';
      $("dockCfgSave").onclick = function () { save(); };
      if ($("dockCfgNew")) $("dockCfgNew").onclick = function () { root.H3Panels.ask("New docker", "Name of the new docker:", "Docker").then(function (n) { if (n && String(n).trim()) { root.H3Panels.newDocker({ name: String(n).trim() }); paint(); } }); };
      panel.querySelectorAll("[data-fpshow]").forEach(function (b) { b.onclick = function () { root.H3Panels.show(b.getAttribute("data-fpshow"), true); }; });
      if ($("dockCfgLoad")) $("dockCfgLoad").onclick = function () { apply(key, "loaded by hand"); };
      $("dockCfgAuto").onchange = function (e) { setAuto(e.target.checked); };
      panel.querySelectorAll("[data-dcapply]").forEach(function (b) { b.onclick = function () { openSet(b.getAttribute("data-dcapply")); }; });
      panel.querySelectorAll("[data-dcdel]").forEach(function (b) { b.onclick = function () { remove(b.getAttribute("data-dcdel"), +b.dataset.w, +b.dataset.h); }; });
    }
    /** "Load" on a saved row: those dockers shown and opened (the others put away), then their layout */
    function openSet(key) {
      var want = key.split("+");
      // 2.432.0: a docker outside the set that was on screen (its header) when it was saved stays on screen, collapsed
      var c = CFG.configs[key], ws = winSize(), pk = c && (c.variants || []).length ? pick(c.variants, ws.w, ws.h) : null;
      var vb = pk && pk.variant.vis ? pk.variant.vis.bottom || {} : {};
      applying = true;
      try {
        BOTTOM.forEach(function (id) {
          var el = $(id); if (!el) return;
          var inSet = want.indexOf(id) >= 0, keepHead = !inSet && !!(vb[id] && !vb[id].gone);
          var on = inSet || keepHead, gone = el.classList.contains("dockgone");
          var G = root.H3GoneDocks || {};
          var btnId = Object.keys(G).find(function (b) { return G[b] === id; });
          if (on && gone && typeof root.toggleDockGone === "function") root.toggleDockGone(id, btnId);
          if (!on && !gone && typeof root.toggleDockGone === "function") root.toggleDockGone(id, btnId);
          if (typeof root.toggleCollapse === "function") {
            if (inSet && el.classList.contains("collapsed")) root.toggleCollapse(id);
            if (keepHead && !el.classList.contains("collapsed")) root.toggleCollapse(id);
          }
        });
      } finally { applying = false; }
      lastKey = keyOf(openIds());
      apply(lastKey, "loaded by hand");
    }
    btn.onclick = function (e) {
      e.stopPropagation();
      var on = panel.style.display === "none";
      panel.style.display = on ? "block" : "none"; btn.setAttribute("aria-expanded", on ? "true" : "false");
      if (on) paint();
    };
    document.addEventListener("pointerdown", function (e) { if (panel.style.display !== "none" && !wrap.contains(e.target)) { panel.style.display = "none"; btn.setAttribute("aria-expanded", "false"); } });

    /* watch the set: any class change on a column docker (hidden / collapsed) */
    if (typeof MutationObserver === "function") {
      var mo = new MutationObserver(soon);
      BOTTOM.forEach(function (id) { var el = $(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ["class"] }); });
    }
    lastKey = null;
    // 2.575.0: the boot's own settling (restored dockers, extension dockers mounting) is not "these dockers were opened
    // together" - until the user's first press / key (or 8 s) a set change does not load a saved config over it
    var bootUntil = Date.now() + 8000;
    var userGo = function (e) { if (e && e.isTrusted === false) return; bootUntil = 0; document.removeEventListener("pointerdown", userGo, true); document.removeEventListener("keydown", userGo, true); };
    document.addEventListener("pointerdown", userGo, true); document.addEventListener("keydown", userGo, true);
    check("at start");
    DockCfg.save = save; DockCfg.apply = apply; DockCfg.openSet = openSet; DockCfg.state = function () { return CFG; };
    DockCfg.openKey = function () { return keyOf(openIds()); }; DockCfg.check = check; DockCfg.paint = paint;
  }

  var DockCfg = { BOTTOM: BOTTOM, SIDE: SIDE, NAMES: NAMES, keyOf: keyOf, namesOf: namesOf, pick: pick, scaled: scaled, start: start, started: false };
  if (typeof module !== "undefined" && module.exports) module.exports = DockCfg;
  else root.DockCfg = DockCfg;
})(typeof window !== "undefined" ? window : globalThis);
