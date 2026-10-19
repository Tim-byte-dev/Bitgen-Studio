/* bitGen Studio — static/workspaces.js (2.526.0): THE WORKSPACE dropdown in the main menu bar (window.H3Workspace).
 * Tim (verbatim): "lets add a workspace dropdown to the main menubar - image editing, video editing, music video,basic,
 * expert. to make it easier to navigate the app" - he chose: layout + menus (the dockers and the statusbar / menu bar
 * buttons each workspace needs; the rest hidden, never disabled; your own changes remembered per workspace).
 *
 *   A WORKSPACE   which column dockers are shown (open / collapsed), which side docks, which floating panels; the
 *                 statusbar + menu-bar buttons it HIDES (Expert hides none); the Generate mode it sets (Image editing ->
 *                 🖼 Image, Video editing -> 🎬 Video)
 *   SWITCHING     the workspace you leave is KEPT as you left it (sizes, what is shown, the floating panels - the same
 *                 snapshot ⊞ Docker layout makes) in workspaces.json (lib/workspaces.js); the one you go to comes back
 *                 as you left it, or as its default the first time. ↺ puts the current one back to its default.
 *   EXPERT        everything - and the first time you leave it, the layout you had becomes Expert's
 *   AT START      the current workspace's buttons are hidden again (the layout itself is docker_status.json's, which
 *                 is the current workspace's)
 * Pure (Node: scripts/test-workspaces526.js): IDS, DEFS, LABELS, plan(id), hidden(id), BOTTOM, SIDE, SIDE_CLS.
 */
(function (root) {
  "use strict";
  var BOTTOM = ["previewdock", "timelinedock", "videodock", "imageeditdock", "comfydock", "musicdock", "stemsdock",
                "sfxdock", "chatdock", "promptdock", "consoledock"];
  var SIDE = ["ldock", "refs", "assets", "qdock", "rdock"];
  var SIDE_CLS = { ldock: "no-left", refs: "no-refs", assets: "no-assets", qdock: "no-queue", rdock: "no-right" };
  var IDS = ["basic", "image", "video", "musicvideo", "expert"];
  var LABELS = { basic: "Basic", image: "Image editing", video: "Video editing", musicvideo: "Music video", expert: "Expert" };
  var ICONS = { basic: "◯", image: "🖼", video: "🎬", musicvideo: "🎵", expert: "◆" };
  /* bottom = shown open, collapsed = shown with only their header; side = the side docks shown; sb / menu = buttons
     HIDDEN; genMode = the Generate mode it sets ("" = leave it); share = a docker's height as a part of the column the
     first time (the storyboard - the elastic one - takes what is left); max = the maximized docker */
  var DEFS = {
    basic: { tip: "Make pictures and videos from a prompt - the prompt, the preview, the gallery and the queue; the rest is out of the way",
      bottom: ["previewdock", "promptdock"], collapsed: [], side: ["ldock", "refs", "qdock", "rdock"], genMode: "", share: { previewdock: 0.55, promptdock: 0.38 },
      sb: ["tT", "tV", "tMu", "tSt", "tSfx", "tIE", "tCF", "tC", "negBtn", "mmBtn", "ltBtn", "hbBtn"],
      menu: ["projBgp", "projUe", "capRec", "projBin", "projReset", "thEditBtn", "quWrap", "dockCfgWrap"] },
    image: { tip: "Make and edit pictures - the image editor, the prompt, references, assets and the gallery",
      bottom: ["imageeditdock", "promptdock"], collapsed: ["chatdock"], side: ["ldock", "refs", "assets", "qdock", "rdock"], genMode: "image", share: { promptdock: 0.3 }, max: "imageeditdock",
      sb: ["tPv", "tT", "tV", "tMu", "tSt", "tSfx"], menu: ["projUe", "capRec"] },
    video: { tip: "Make and cut video - the preview, the timeline, the storyboard, sound effects and the prompt",
      bottom: ["previewdock", "timelinedock", "videodock", "sfxdock", "promptdock"], collapsed: ["consoledock"], side: ["ldock", "refs", "assets", "qdock", "rdock"], genMode: "video",
      share: { previewdock: 0.34, timelinedock: 0.22, sfxdock: 0.12, promptdock: 0.18 },
      sb: ["tIE", "tMu", "tSt"], menu: [] },
    musicvideo: { tip: "A song and its video - music, stems, the timeline, the storyboard, the preview and the prompt",
      bottom: ["previewdock", "timelinedock", "videodock", "musicdock", "stemsdock", "promptdock"], collapsed: [], side: ["ldock", "refs", "assets", "qdock", "rdock"], genMode: "",
      share: { previewdock: 0.26, timelinedock: 0.18, musicdock: 0.16, stemsdock: 0.13, promptdock: 0.16 },
      sb: ["tIE", "tCF"], menu: [] },
    expert: { tip: "Everything - every docker and every button",
      bottom: ["previewdock", "timelinedock", "videodock", "imageeditdock", "musicdock", "stemsdock", "sfxdock", "promptdock"],
      collapsed: ["comfydock", "chatdock", "consoledock"], side: ["ldock", "refs", "assets", "qdock", "rdock"], genMode: "", sb: [], menu: [] }
  };
  function valid(id) { return IDS.indexOf(id) >= 0; }
  /** what a workspace's default looks like: {bottom: {id: "open"|"collapsed"|"gone"}, side: {id: shown}} (pure) */
  function plan(id) {
    var d = DEFS[valid(id) ? id : "expert"], b = {}, s = {};
    BOTTOM.forEach(function (k) { b[k] = d.bottom.indexOf(k) >= 0 ? "open" : d.collapsed.indexOf(k) >= 0 ? "collapsed" : "gone"; });
    SIDE.forEach(function (k) { s[k] = d.side.indexOf(k) >= 0; });
    return { bottom: b, side: s, genMode: d.genMode };
  }
  /** the default heights in px for a column `colH` tall: {dock: px} - at least 60 each (pure) */
  function heights(id, colH) {
    var d = DEFS[valid(id) ? id : "expert"], out = {}, sh = d.share || {};
    Object.keys(sh).forEach(function (k) { out[k] = Math.max(60, Math.round((colH || 0) * sh[k])); });
    return out;
  }
  /** the button ids a workspace hides (pure) */
  function hidden(id) { var d = DEFS[valid(id) ? id : "expert"]; return d.sb.concat(d.menu); }
  var pure = { IDS: IDS, DEFS: DEFS, LABELS: LABELS, ICONS: ICONS, BOTTOM: BOTTOM, SIDE: SIDE, SIDE_CLS: SIDE_CLS, plan: plan, hidden: hidden, valid: valid, heights: heights };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var CSS = "#wsWrap{display:inline-flex;align-items:center;gap:4px;font-size:.76rem}#wsWrap select{font-size:.76rem;padding:2px 4px;max-width:170px}"
    + "#wsWrap .wslab{color:var(--dim,#999);font-size:.68rem;text-transform:uppercase;letter-spacing:.06em}"
    + ".ws-hide{display:none!important}#wsMsg{position:fixed;left:50%;top:44px;transform:translateX(-50%);z-index:9000;background:var(--panel,#1b1814);"
    + "border:1px solid var(--tiger,#f59e2c);border-radius:6px;padding:4px 12px;font-size:.76rem;pointer-events:none;opacity:0;transition:opacity .25s}#wsMsg.on{opacity:1}";
  var REC = { current: "expert", saved: {} }, busy = false, loaded = false;
  function $(id) { return document.getElementById(id); }
  function post(url, body) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "refused"); return j; }); });
  }
  function toast(t) {
    var m = $("wsMsg"); if (!m) { m = document.createElement("div"); m.id = "wsMsg"; m.setAttribute("aria-live", "polite"); document.body.appendChild(m); }
    m.textContent = t; m.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(function () { m.classList.remove("on"); }, 2200);
    if (typeof root.logLine === "function") try { root.logLine("[workspace] " + t); } catch (e) { /* fine */ }
  }

  /* ---- what is on screen now (the ⊞ Docker layout snapshot's shape - lib/dockerCfg.cleanVariant keeps it) */
  function snapshot() {
    var docks = typeof root.layoutState === "function" ? root.layoutState() : {};
    var vis = { bottom: {}, side: {} }, app = $("app");
    BOTTOM.forEach(function (id) { var el = $(id); if (el) vis.bottom[id] = { gone: el.classList.contains("dockgone"), collapsed: el.classList.contains("collapsed") }; });
    SIDE.forEach(function (id) { if (app) vis.side[id] = app.classList.contains(SIDE_CLS[id]); });
    var floats = root.SecFloat && root.SecFloat.states ? root.SecFloat.states() : {};
    var e = typeof root.dsEntry === "function" ? root.dsEntry("promptdock") : {};
    return { window: { w: root.innerWidth || 0, h: root.innerHeight || 0 }, col: { h: $("maincol") ? $("maincol").clientHeight : 0 }, docks: docks, vis: vis, floats: floats,
             prompt: { floating: e.floating, x: e.x, y: e.y, float_w: e.float_w, float_h: e.float_h, dock_to: e.dock_to || "", dock_side: e.dock_side || "", dock_w: e.dock_w || 0 } };
  }

  /* ---- showing / hiding through the app's own toggles (index.html: toggleDockGone, toggleCollapse, applyLayout) */
  function setBottom(id, want) {                      // want: open | collapsed | gone
    var el = $(id); if (!el) return;
    var G = root.H3GoneDocks || {}, btn = Object.keys(G).find(function (b) { return G[b] === id; });
    var gone = el.classList.contains("dockgone");
    if (want === "gone") { if (!gone && typeof root.toggleDockGone === "function") root.toggleDockGone(id, btn); return; }
    if (gone && typeof root.toggleDockGone === "function") root.toggleDockGone(id, btn);   // shown (it opens)
    var coll = el.classList.contains("collapsed");
    if (typeof root.toggleCollapse === "function" && coll !== (want === "collapsed")) root.toggleCollapse(id);
  }
  function setSides(map) {                            // {id: shown}
    var docks = {};
    SIDE.forEach(function (id) { if (typeof map[id] === "boolean") docks[id] = { hidden: !map[id] }; });
    if (typeof root.applyLayout === "function") root.applyLayout(docks);
  }
  function setFloats(showIds) {
    var SF = root.SecFloat; if (!SF || !SF.windows) return;
    Object.keys(SF.windows).forEach(function (id) { var on = showIds.indexOf(id) >= 0; if (!!SF.state(id).shown !== on) SF.show(id, on); });
  }
  function setGenMode(m) {
    var g = $("genModeSel"); if (!m || !g || g.value === m) return;
    if (![].some.call(g.options, function (o) { return o.value === m; })) return;
    g.value = m; g.dispatchEvent(new Event("change", { bubbles: true }));
  }
  /* the buttons: hidden by the workspace, never disabled (the elements stay - shortcuts and the palette still reach them) */
  function chrome(id) {
    var hide = hidden(id);
    document.querySelectorAll(".ws-hide").forEach(function (el) { if (hide.indexOf(el.id) < 0) el.classList.remove("ws-hide"); });
    hide.forEach(function (bid) { var el = $(bid); if (el) el.classList.add("ws-hide"); });
    document.body.setAttribute("data-workspace", id);
  }
  function applyDefault(id) {
    var p = plan(id), d = DEFS[id];
    if (typeof root.toggleMax === "function") document.querySelectorAll(".bdock.maxed").forEach(function (m) { root.toggleMax(m.id, false); });
    BOTTOM.forEach(function (k) { setBottom(k, p.bottom[k]); });
    setSides(p.side);
    setFloats([]);
    setGenMode(p.genMode);
    // the heights after ⊞ Docker layout has reacted to the new set (~180 ms): a share of the column each, then the max
    return new Promise(function (ok) {
      setTimeout(function () {
        try {
          var col = $("maincol"), hs = heights(id, col ? col.clientHeight : 0), docks = {};
          Object.keys(hs).forEach(function (k) { docks[k] = { height: hs[k] }; });
          if (Object.keys(docks).length && typeof root.applyLayout === "function") root.applyLayout(docks);
          if (d.max && typeof root.toggleMax === "function") root.toggleMax(d.max, true);
          if (typeof root.reflowSoon === "function") root.reflowSoon();
          if (typeof root.saveLayout === "function") setTimeout(root.saveLayout, 60);
        } catch (e) { console.warn("workspace:", e); }
        ok();
      }, 420);
    });
  }
  function applySnap(id, s) {
    var vb = (s.vis && s.vis.bottom) || {};
    BOTTOM.forEach(function (k) { if (vb[k]) setBottom(k, vb[k].gone ? "gone" : vb[k].collapsed ? "collapsed" : "open"); });
    var side = {}; SIDE.forEach(function (k) { if (s.vis && s.vis.side && typeof s.vis.side[k] === "boolean") side[k] = !s.vis.side[k]; });
    setSides(side);
    // the sizes AFTER ⊞ Docker layout has reacted to the new set (it loads the set's saved sizes ~180 ms later): the
    // workspace's own sizes win
    return new Promise(function (ok) {
      setTimeout(function () {
        try {
          var d = {}; Object.keys(s.docks || {}).forEach(function (k) { if (BOTTOM.indexOf(k) >= 0) { d[k] = Object.assign({}, s.docks[k]); delete d[k].hidden; delete d[k].state; } });
          if (typeof root.applyLayout === "function") root.applyLayout(d);
          var pr = s.prompt;
          if (pr && typeof root.dsEntry === "function" && vb.promptdock && !vb.promptdock.gone) {
            var e = root.dsEntry("promptdock");
            ["floating", "x", "y", "float_w", "float_h", "dock_to", "dock_side", "dock_w"].forEach(function (k) { if (pr[k] !== undefined) e[k] = pr[k]; });
            if (root.PFloat && root.PFloat.restore) root.PFloat.restore();
          }
          if (s.floats && root.SecFloat && root.SecFloat.applyStates) root.SecFloat.applyStates(s.floats);
          if (typeof root.reflowSoon === "function") root.reflowSoon();
          if (typeof root.saveLayout === "function") setTimeout(root.saveLayout, 60);
        } catch (e) { console.warn("workspace:", e); }
        ok();
      }, 420);
    });
  }

  /** do two "what is on screen" records show different dockers? (pure-ish; the tests use it) */
  function differs(a, b) {
    var x = false;
    BOTTOM.forEach(function (k) { var p = (a.bottom || {})[k], q = (b.bottom || {})[k]; if (p && q && (p.gone !== q.gone || p.collapsed !== q.collapsed)) x = true; });
    SIDE.forEach(function (k) { var p = (a.side || {})[k], q = (b.side || {})[k]; if (typeof p === "boolean" && typeof q === "boolean" && p !== q) x = true; });
    return x;
  }
  /** switch: keep the one we leave, show the one we go to (its saved state, else its default) */
  function use(id, opts) {
    if (!valid(id) || busy || !loaded) return Promise.resolve(false);   // not before the record is known (it would keep the wrong one)
    var from = REC.current, o = opts || {};
    if (id === from && !o.force) return Promise.resolve(false);
    busy = true;
    var keep = o.noSave ? null : snapshot();
    return post("/api/workspaces/switch", { from: from, snap: keep, to: id }).then(function (j) {
      REC = j;
      var s = o.fresh ? null : (REC.saved || {})[id];
      chrome(id);
      var done = s && s.vis ? applySnap(id, s) : applyDefault(id);
      paint();
      return done.then(function () {
        if (s) setGenMode(plan(id).genMode);
        toast(ICONS[id] + " " + LABELS[id] + (s ? "" : " (its default layout)"));
        return true;
      });
    }).catch(function (e) { toast("workspace: " + e.message); paint(); return false; })
      .then(function (r) { busy = false; return r; });
  }
  function reset() {
    var id = REC.current;
    return post("/api/workspaces/reset", { id: id }).then(function (j) { REC = j; chrome(id); paint(); return applyDefault(id).then(function () { toast("↺ " + LABELS[id] + " is back to its default layout"); return true; }); })
      .catch(function (e) { toast("workspace: " + e.message); return false; });
  }
  function paint() {
    var s = $("wsSel"); if (!s) return;
    s.value = REC.current;
    s.title = "Workspace: " + LABELS[REC.current] + " - " + DEFS[REC.current].tip + ". Each workspace keeps your own changes; ↺ puts it back.";
  }
  var early = false;
  function start() {
    if (!early && document.body) {                    // the buttons hide before the boot is done (no flash of Expert)
      early = true;
      if (!$("wsCss")) { var st0 = document.createElement("style"); st0.id = "wsCss"; st0.textContent = CSS; document.head.appendChild(st0); }
      if (root.H3_WORKSPACES && valid(root.H3_WORKSPACES.current)) { REC = root.H3_WORKSPACES; chrome(REC.current); }
    }
    var bar = $("menubar");
    if (!bar || typeof dsReady === "undefined" || !dsReady || !root.SecFloat || !root.SecFloat.started) { setTimeout(start, 200); return; }   // eslint-disable-line no-undef
    if ($("wsWrap")) return;
    if (!$("wsCss")) { var st = document.createElement("style"); st.id = "wsCss"; st.textContent = CSS; document.head.appendChild(st); }
    var wrap = document.createElement("span"); wrap.id = "wsWrap";
    wrap.innerHTML = '<span class="wslab">Workspace</span><select id="wsSel" aria-label="Workspace">'
      + IDS.map(function (id) { return '<option value="' + id + '" title="' + DEFS[id].tip + '">' + ICONS[id] + " " + LABELS[id] + "</option>"; }).join("")
      + '</select><button class="ghost" id="wsReset" type="button" title="Put this workspace back to its default layout">↺</button>';
    var pb = bar.querySelector(".projbtns");
    if (pb && pb.nextSibling) bar.insertBefore(wrap, pb.nextSibling); else bar.appendChild(wrap);
    $("wsSel").onchange = function (e) { use(e.target.value); };
    $("wsReset").onclick = function () { reset(); };
    // buttons other scripts add later (🧩 Models, 🎓 LoRA, 🏠 House, the queue presets …) are hidden as they arrive
    if (typeof MutationObserver === "function") {
      var again = function () { clearTimeout(again.t); again.t = setTimeout(function () { chrome(REC.current); }, 50); };
      [bar, $("statusbar")].forEach(function (el) { if (el) new MutationObserver(again).observe(el, { childList: true, subtree: true }); });
    }
    // leaving the app keeps the current workspace as it is
    root.addEventListener("beforeunload", function () {
      // only once workspaces are in use: someone who never picks one gets no workspaces.json at all
      if (REC.current === "expert" && !Object.keys(REC.saved || {}).length) return;
      try { if (navigator.sendBeacon) navigator.sendBeacon("/api/workspaces/snapshot", new Blob([JSON.stringify({ id: REC.current, snap: snapshot() })], { type: "application/json" })); } catch (e) { /* fine */ }
    });
    // the record came in the page's head (routes/dockerStatus.js page); asked for only when it did not
    (root.H3_WORKSPACES && root.H3_WORKSPACES.current ? Promise.resolve(root.H3_WORKSPACES)
      : fetch("/api/workspaces", { cache: "no-store" }).then(function (r) { return r.json(); })).then(function (j) {
      if (j && j.current) REC = j;
      loaded = true;
      chrome(REC.current); paint();
      // (the layout the app starts with is docker_status.json's - the current workspace's as it was left; it is not
      // re-applied here, so a layout set any other way is never fought)
    })
      .catch(function () { loaded = true; chrome(REC.current); paint(); });
  }
  root.H3Workspace = Object.assign({ use: use, reset: reset, snapshot: snapshot, differs: differs, current: function () { return REC.current; }, record: function () { return REC; }, chrome: chrome }, pure);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
