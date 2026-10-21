/* pcdocs.js — IMAGE EDITOR DOCUMENTS: every New / Open is a document of its own, in a floating document window or
 * docked as a tab (2.430.0), window.PCDocs.
 *
 * Tim (verbatim): "in image editor open/create new file in a modular docker, when docked show open documents as tabs"
 * (with the plan: float or dock as tabs, Photoshop's way).
 *
 *   A DOCUMENT       everything that belongs to one picture: its size, layers, undo / redo, selection, paths, channels,
 *                    the view (zoom / pan), a PDF's pages (pcpdf.js's session) - DOC_KEYS. The one in front is LIVE in
 *                    the editor's state (S); the others are PARKED (their state kept by reference - nothing copied).
 *   OPEN / NEW       a new document. Window ▸ Arrange ▸ Open Documents as Tabs off (the default): the first one docks
 *                    (it fills the room), the next ones open in their own floating window (cascaded); on: all dock.
 *   DOCKED           the tab strip above the canvas: one tab each (● = unsaved changes), click = to the front, ✕ /
 *                    middle-click = close; drag a tab off the strip = float it there.
 *   FLOATING         a window over the canvas room: title bar (drag; dropped on the tab strip = docked again; double-
 *                    click = dock), ⇲ dock, ✕ close, the corner resizes. A window in the back shows its picture as it was
 *                    left; a click brings it to the front (the canvas moves into it).
 *   CLOSE            Ctrl+W (File ▸ Close), Alt+Ctrl+W Close All; unsaved changes ask first (💾 Save and close / Close /
 *                    Cancel). Ctrl+Tab / Shift+Ctrl+Tab = next / previous document. Window ▸ Arrange: Consolidate All to
 *                    Tabs, Float in Window, Float All in Windows, Tile, Cascade.
 *
 * Pure (Node: scripts/test-psdocs.js): DOC_KEYS, blank, take / give, dirty, cascade, tile, nextId, overStrip.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  /** what one document is (everything else in S is the editor's: tools, colours, settings) */
  const DOC_KEYS = ["w", "h", "name", "layers", "active", "sel", "selVer", "selCount", "undo", "redo", "results", "preview", "previewIndex",
    "float", "pts", "maskEdit", "fmaskEdit", "qm", "qmDirty", "qmBefore", "lastSel", "histSrc", "paths", "work", "ptarget", "channels",
    "picks", "zoom", "panX", "panY", "userView", "lastPaint", "viewMask", "cloneSrc", "cloneOff", "cloneMark", "savedTop",
    "comps", "compOn", "compSel", "compLast",                                      // 2.434.0: a document's layer comps (pccomps.js)
    "bgiName", "guides", "dimScale",
    "samplers", "notes", "counts", "fileInfo", "imgMode", "imgModeOpt", "zones"];   // 2.569.0: 🔲 zones (pczones.js)   // 2.487.0: Image ▸ Mode (pcmode.js; S.mode is the selection mode)                                                // 2.483.0: colour samplers, notes, count marks (pcmeasure.js)                                              // 2.441.0: its dimension scale (pcdims.js)                                                          // 2.440.0: its guidelines (pcguides.js)                                                                    // 2.436.0: the .bgi it was opened / saved as (pcbgi.js)
  function blank() {
    return { w: 0, h: 0, name: "", layers: [], active: 0, sel: null, selVer: 0, selCount: 0, undo: [], redo: [], results: [], preview: null, previewIndex: 0,
      float: null, pts: [], maskEdit: false, fmaskEdit: false, qm: null, qmDirty: false, qmBefore: null, lastSel: null, histSrc: new Map(), paths: [], work: null,
      ptarget: null, channels: [], picks: [], zoom: 1, panX: 0, panY: 0, userView: false, lastPaint: null, viewMask: false, cloneSrc: null, cloneOff: null,
      cloneMark: null, savedTop: undefined, comps: [], compOn: null, compSel: null, compLast: null, bgiName: "", guides: [], dimScale: null,
      samplers: [], notes: [], counts: null, fileInfo: null, imgMode: "rgb", imgModeOpt: null, zones: [] };
  }
  /** the document part of a state (by reference) */
  function take(S) { const o = {}; for (const k of DOC_KEYS) o[k] = S[k]; return o; }
  function give(S, st) { const b = blank(); for (const k of DOC_KEYS) S[k] = st && k in st ? st[k] : b[k]; return S; }
  /** changed since it was opened / last saved: the newest undo step is not the one it was saved at */
  function dirty(st) { if (!st || !st.undo || !st.undo.length) return st ? st.savedTop !== undefined && st.savedTop !== null : false; return st.undo[st.undo.length - 1] !== st.savedTop; }
  /** the k-th floating window's rectangle in a room {w, h} (cascaded, 28 px apart, 72 % of the room) */
  function cascade(k, room) {
    const w = Math.max(240, Math.round(room.w * 0.72)), h = Math.max(180, Math.round(room.h * 0.72));
    const steps = Math.max(1, Math.floor(Math.min(room.w - w, room.h - h) / 28));
    const i = k % (steps + 1);
    return { x: 12 + i * 28, y: 12 + i * 28, w: Math.min(w, Math.max(160, room.w - 24)), h: Math.min(h, Math.max(120, room.h - 24)) };
  }
  /** n windows tiled in a room: columns first (2 -> side by side, 3 -> three columns, 4 -> 2 x 2 ...) */
  function tile(n, room) {
    if (n < 1) return [];
    const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols), out = [];
    const cw = Math.floor(room.w / cols), rh = Math.floor(room.h / rows);
    for (let i = 0; i < n; i++) { const c = i % cols, r = Math.floor(i / cols); out.push({ x: c * cw, y: r * rh, w: cw, h: rh }); }
    return out;
  }
  /** the id after / before `id` in `ids` (wrapping) */
  function nextId(ids, id, dir) {
    if (!ids.length) return null;
    const i = ids.indexOf(id);
    if (i < 0) return ids[0];
    return ids[(i + (dir < 0 ? -1 : 1) + ids.length) % ids.length];
  }
  /** a point over the tab strip (a little taller than it, so it is easy to hit) */
  function overStrip(x, y, r) { return !!r && x >= r.left && x <= r.right && y >= r.top - 6 && y <= r.bottom + 14; }

  /* ================================ the page ================================ */
  function install(E) {
    const { S, doc, win, kx, $, say, store, newCanvas, ctx } = E;
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    if (!doc.getElementById("pcdocsCss")) {
      const st = doc.createElement("style"); st.id = "pcdocsCss";
      st.textContent = ".kx .kxmain{position:relative}"
        + ".kx .pcdarea{flex:1 1 auto;display:flex;flex-direction:column;min-width:0;min-height:0;position:relative}"
        + ".kx .pcdtabs{flex:none;display:flex;align-items:flex-end;gap:1px;min-height:26px;padding-top:3px;box-sizing:border-box;background:var(--pc-bg);border-bottom:1px solid var(--pc-line);overflow-x:auto;overflow-y:hidden;scrollbar-width:thin}"
        + ".kx .pcdtabs:empty{display:none}.kx .pcdtabs.drop{outline:2px solid var(--pc-accent);outline-offset:-2px}"
        + ".kx .pcdtab{flex:none;display:flex;align-items:center;gap:6px;max-width:220px;height:23px;box-sizing:border-box;padding:0 6px 0 10px;font-size:11px;color:var(--pc-dim);background:var(--pc-panel);border:1px solid var(--pc-line);border-bottom:0;border-radius:4px 4px 0 0;cursor:pointer;user-select:none;touch-action:none}"
        + ".kx .pcdtab .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kx .pcdtab .dt{color:var(--pc-accent);font-size:9px}"
        + ".kx .pcdtab.on{color:var(--pc-text);background:var(--pc-canvas);border-color:var(--pc-accent)}.kx .pcdtab.front{color:var(--pc-text)}"
        + ".kx .pcdtab .x,.kx .pcdwin .x,.kx .pcdwin .dk{border:0;background:none;color:var(--pc-dim);padding:0 3px;cursor:pointer;font-size:11px;line-height:14px;min-width:0;min-height:0}"
        + ".kx .pcdtab .x:hover,.kx .pcdwin .x:hover,.kx .pcdwin .dk:hover{color:var(--pc-accent)}"
        + ".kx .pcdhold{flex:1 1 auto;display:flex;min-width:0;min-height:0;position:relative;background:var(--pc-canvas)}"
        + ".kx .pcdhold > .kxstage{flex:1 1 auto}"
        + ".kx .pcdstill{position:absolute;inset:0;margin:auto;max-width:calc(100% - 24px);max-height:calc(100% - 24px);display:none;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,.4)}"
        + ".kx .pcdfloat{position:absolute;inset:0;pointer-events:none;z-index:12}"
        + ".kx .pcdwin{position:absolute;pointer-events:auto;display:flex;flex-direction:column;min-width:160px;min-height:120px;background:var(--pc-canvas);border:1px solid var(--pc-line);border-radius:5px;box-shadow:0 8px 26px rgba(0,0,0,.5);overflow:hidden}"
        + ".kx .pcdwin.on{border-color:var(--pc-accent)}"
        + ".kx .pcdwin .tb{flex:none;display:flex;align-items:center;gap:6px;padding:3px 6px;font-size:11px;color:var(--pc-dim);background:var(--pc-panel);border-bottom:1px solid var(--pc-line);cursor:move;user-select:none;touch-action:none}"
        + ".kx .pcdwin.on .tb{color:var(--pc-text)}.kx .pcdwin .tb .nm{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kx .pcdwin .tb .dt{color:var(--pc-accent);font-size:9px}"
        + ".kx .pcdwin .bd{flex:1 1 auto;display:flex;min-height:0;position:relative}.kx .pcdwin .bd > .kxstage{flex:1 1 auto}"
        + ".kx .pcdwin .bd canvas.still{position:absolute;inset:0;margin:auto;max-width:calc(100% - 12px);max-height:calc(100% - 12px);cursor:pointer}"
        + ".kx .pcdwin .rs{position:absolute;right:0;bottom:0;width:14px;height:14px;cursor:nwse-resize;background:linear-gradient(135deg,transparent 50%,var(--pc-line) 50%);touch-action:none}"
        + ".kx .pcdclose .rw{display:block}";
      doc.head.appendChild(st);
    }
    /* ---------------- the room: [tab strip / the docked canvas] + the floating layer ---------------- */
    const stage = $("ieStage"), main = kx.querySelector(".kxmain");
    const area = doc.createElement("div"); area.className = "pcdarea"; area.id = "pcDArea";
    area.innerHTML = '<div class="pcdtabs" id="pcDTabs" role="tablist" aria-label="Open documents"></div><div class="pcdhold" id="pcDHold"><canvas class="pcdstill" id="pcDStill" title="Click to bring this document to the front"></canvas></div>';
    main.insertBefore(area, stage);
    $("pcDHold").appendChild(stage);
    const flo = doc.createElement("div"); flo.className = "pcdfloat"; flo.id = "pcDFloat"; $("pcDHold").appendChild(flo);
    const tabsEl = $("pcDTabs"), hold = $("pcDHold"), still = $("pcDStill");

    const docs = [];            // {id, name, st (null = live), pdf, float: null | {x, y, w, h}, view, z}
    let live = null, uid = 0, zTop = 1, frontDocked = null;
    let asTabs = !!store.get("docs.tabs", false);
    const rec = (id) => docs.find((d) => d.id === id) || null;
    const liveRec = () => rec(live);
    const room = () => ({ w: Math.max(200, hold.clientWidth || 800), h: Math.max(160, hold.clientHeight || 600) });
    const stOf = (d) => (d.id === live ? S : d.st);
    const isDirty = (d) => dirty(stOf(d));

    /** a small picture of the live document (what a window in the back shows) */
    function snapshot() {
      if (!S.w) return null;
      try {
        const f = E.flatten(), k = Math.min(1, 1400 / Math.max(S.w, S.h));
        const c = newCanvas(Math.max(1, Math.round(S.w * k)), Math.max(1, Math.round(S.h * k))), g = ctx(c);
        g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height);   // transparency as white (only a still picture)
        g.drawImage(f, 0, 0, c.width, c.height);
        return c;
      } catch (e) { return null; }
    }
    /** the live document goes into its record (S is left empty for the next one) */
    function park() {
      const d = liveRec();
      if (!d) { live = null; return; }
      if (S.drag && S.drag.paint && E.endStroke) { try { E.endStroke(0, 0); } catch (e) { /* no stroke */ } }
      d.view = snapshot();
      d.st = take(S); d.name = S.name || d.name;
      d.pdf = E.pdfSession ? E.pdfSession.get() : null;
      if (E.pdfSession) E.pdfSession.set(null);
      give(S, blank());
      S.drag = null; S.stroke = null;
      if (E.pathsIdle) E.pathsIdle();
      live = null;
    }
    /** a parked document to the front */
    function activate(id) {
      const d = rec(id); if (!d) return false;
      if (d.id === live) { if (d.float) { d.z = ++zTop; place(); } return true; }
      if (E.smartBusy && E.smartBusy()) { say("finish editing the smart object's contents first (✔ Done / ✕ Cancel)"); return false; }
      if (E.ui.closeMenus) E.ui.closeMenus();
      park();
      give(S, d.st); d.st = null; live = d.id; d.view = null;
      if (E.pdfSession) E.pdfSession.set(d.pdf); d.pdf = null;
      if (E.pathsIdle) E.pathsIdle();
      if (d.float) d.z = ++zTop; else frontDocked = d.id;
      place();
      E.sizeCanvases();
      E.setSel(S.sel && S.sel.length === S.w * S.h ? S.sel : new Uint8Array(S.w * S.h), true);
      $("ieHint").style.display = S.w ? "none" : "";
      if (!S.userView) E.fitView(); else E.applyView();
      E.refresh(); E.renderLayersPanel();
      if (E.ui.history) E.ui.history();
      if (E.ui.comps) E.ui.comps();                       // 2.434.0
      if (E.api && E.api.onOpen) E.api.onOpen(S.name);
      paint();
      return true;
    }
    /* the editor's openDoc: before = the document in front is kept; after = the new one gets a record */
    E.docBefore = (inPlace) => { if (!inPlace) park(); };
    E.docAfter = (inPlace) => {
      if (inPlace && liveRec()) { liveRec().name = S.name; paint(); return; }
      const docked = docs.filter((x) => !x.float).length, floats = docs.filter((x) => x.float).length;
      const d = { id: "d" + (++uid), name: S.name, st: null, pdf: null, float: null, view: null, z: ++zTop };
      if (!asTabs && (docked || floats)) d.float = cascade(floats, room());
      docs.push(d); live = d.id; if (!d.float) frontDocked = d.id;
      S.savedTop = undefined;
      place(); paint();
      if (!S.userView) E.fitView();
    };

    /* ---------------- where the canvas is: the docked room or the front window ---------------- */
    function place() {
      for (const w of flo.querySelectorAll(".pcdwin")) { const x = rec(w.dataset.id); if (!x || !x.float) w.remove(); }
      const d = liveRec();
      const target = d && d.float ? winOf(d).querySelector(".bd") : hold;
      if (stage.parentNode !== target) target.appendChild(stage);
      // the canvas is in a window: the docked room shows its front document as it was left (a click brings it back)
      const fd = d && d.float && frontDocked && rec(frontDocked) && !rec(frontDocked).float ? rec(frontDocked) : null;
      if (fd && fd.view) { still.width = fd.view.width; still.height = fd.view.height; ctx(still).drawImage(fd.view, 0, 0); still.dataset.id = fd.id; still.style.display = "block"; }
      else { still.style.display = "none"; still.dataset.id = ""; }
      for (const x of docs) if (x.float) { const w = winOf(x); w.style.zIndex = String(x.z || 1); w.classList.toggle("on", x.id === live); stillIn(x, w); }
    }
    still.onclick = () => { if (still.dataset.id) activate(still.dataset.id); };
    function stillIn(d, w) {
      const bd = w.querySelector(".bd"); let c = bd.querySelector("canvas.still");
      if (d.id === live || !d.view) { if (c) c.remove(); return; }
      if (!c) { c = doc.createElement("canvas"); c.className = "still"; c.title = "Click to bring this document to the front"; bd.appendChild(c); c.onclick = () => activate(d.id); }
      c.width = d.view.width; c.height = d.view.height; ctx(c).drawImage(d.view, 0, 0);
    }
    function winOf(d) {
      let w = flo.querySelector(`.pcdwin[data-id="${d.id}"]`);
      if (!w) {
        w = doc.createElement("div"); w.className = "pcdwin"; w.dataset.id = d.id;
        w.innerHTML = '<div class="tb"><span class="nm"></span><span class="dt"></span><button type="button" class="dk" title="Dock as a tab (or drag me onto the tab strip)">⇲</button><button type="button" class="x" title="Close (Ctrl+W)">✕</button></div><div class="bd"></div><div class="rs" title="Resize"></div>';
        flo.appendChild(w);
        w.addEventListener("pointerdown", () => { if (d.id !== live) activate(d.id); else if (d.float) { d.z = ++zTop; w.style.zIndex = String(d.z); } }, true);
        w.querySelector(".dk").onclick = (e) => { e.stopPropagation(); dock(d.id); };
        w.querySelector(".x").onclick = (e) => { e.stopPropagation(); close(d.id); };
        w.querySelector(".tb").ondblclick = (e) => { if (e.target.closest("button")) return; dock(d.id); };
        dragWin(d, w); resizeWin(d, w);
      }
      const f = d.float; w.style.left = f.x + "px"; w.style.top = f.y + "px"; w.style.width = f.w + "px"; w.style.height = f.h + "px";
      w.querySelector(".nm").textContent = d.name || "Untitled"; w.querySelector(".nm").title = d.name || "";
      return w;
    }
    function dragWin(d, w) {
      const tb = w.querySelector(".tb");
      tb.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 || e.target.closest("button")) return;
        e.preventDefault();
        const ar = hold.getBoundingClientRect(), ox = e.clientX - (ar.left + d.float.x), oy = e.clientY - (ar.top + d.float.y);
        tb.setPointerCapture && tb.setPointerCapture(e.pointerId);
        const mv = (ev) => {
          d.float.x = Math.round(Math.max(-d.float.w + 60, Math.min(ar.width - 60, ev.clientX - ar.left - ox)));
          d.float.y = Math.round(Math.max(0, Math.min(ar.height - 30, ev.clientY - ar.top - oy)));
          w.style.left = d.float.x + "px"; w.style.top = d.float.y + "px";
          tabsEl.classList.toggle("drop", overStrip(ev.clientX, ev.clientY, stripRect()));
        };
        const up = (ev) => {
          tb.removeEventListener("pointermove", mv); tb.removeEventListener("pointerup", up); tb.removeEventListener("pointercancel", up);
          const on = overStrip(ev.clientX, ev.clientY, stripRect()); tabsEl.classList.remove("drop");
          if (on) dock(d.id);
        };
        tb.addEventListener("pointermove", mv); tb.addEventListener("pointerup", up); tb.addEventListener("pointercancel", up);
      });
    }
    /** the tab strip's box (when it is empty it is a thin line at the top of the room) */
    function stripRect() {
      const r = tabsEl.getBoundingClientRect(), a = area.getBoundingClientRect();
      return r.height > 2 ? r : { left: a.left, right: a.right, top: a.top, bottom: a.top + 24 };
    }
    function resizeWin(d, w) {
      const h = w.querySelector(".rs");
      h.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return; e.preventDefault(); e.stopPropagation();
        const x0 = e.clientX, y0 = e.clientY, w0 = d.float.w, h0 = d.float.h;
        h.setPointerCapture && h.setPointerCapture(e.pointerId);
        const mv = (ev) => { d.float.w = Math.max(160, Math.round(w0 + ev.clientX - x0)); d.float.h = Math.max(120, Math.round(h0 + ev.clientY - y0)); w.style.width = d.float.w + "px"; w.style.height = d.float.h + "px"; };
        const up = () => { h.removeEventListener("pointermove", mv); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up); if (d.id === live && !S.userView) E.fitView(); };
        h.addEventListener("pointermove", mv); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
      });
    }

    /* ---------------- the tab strip ---------------- */
    function paint() {
      const docked = docs.filter((d) => !d.float);
      const fd = live && liveRec() && liveRec().float ? frontDocked : null;
      tabsEl.innerHTML = docked.map((d) => `<div class="pcdtab${d.id === live ? " on" : ""}${d.id === fd ? " front" : ""}" role="tab" aria-selected="${d.id === live}" data-id="${d.id}" title="${esc(d.name)}${isDirty(d) ? " (not saved)" : ""}"><span class="nm">${esc(d.name || "Untitled")}</span><span class="dt">${isDirty(d) ? "●" : ""}</span><button type="button" class="x" title="Close (Ctrl+W)">✕</button></div>`).join("");
      tabsEl.querySelectorAll(".pcdtab").forEach((t) => {
        const id = t.dataset.id;
        t.querySelector(".x").onclick = (e) => { e.stopPropagation(); close(id); };
        t.onauxclick = (e) => { if (e.button === 1) { e.preventDefault(); close(id); } };
        t.addEventListener("pointerdown", (e) => {
          if (e.button !== 0 || e.target.closest("button")) return;
          const x0 = e.clientX, y0 = e.clientY; let off = false;
          t.setPointerCapture && t.setPointerCapture(e.pointerId);
          const mv = (ev) => { off = !overStrip(ev.clientX, ev.clientY, stripRect()) && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 24; t.style.opacity = off ? "0.5" : ""; };
          const up = (ev) => {
            t.removeEventListener("pointermove", mv); t.removeEventListener("pointerup", up); t.removeEventListener("pointercancel", up); t.style.opacity = "";
            if (off) { const a = hold.getBoundingClientRect(), R = room(), c = cascade(0, R); float(id, { x: Math.max(0, Math.round(ev.clientX - a.left - 60)), y: Math.max(0, Math.round(ev.clientY - a.top - 12)), w: c.w, h: c.h }); }
            else activate(id);
          };
          t.addEventListener("pointermove", mv); t.addEventListener("pointerup", up); t.addEventListener("pointercancel", up);
        });
      });
      for (const d of docs) if (d.float) {
        const w = winOf(d); w.querySelector(".dt").textContent = isDirty(d) ? "●" : "";
      }
      place();
    }
    /** only the ● of the live document (every undo step) */
    function paintDirty() {
      const d = liveRec(); if (!d) return;
      const on = isDirty(d);
      const t = tabsEl.querySelector(`.pcdtab[data-id="${d.id}"] .dt`); if (t) t.textContent = on ? "●" : "";
      const w = flo.querySelector(`.pcdwin[data-id="${d.id}"] .dt`); if (w) w.textContent = on ? "●" : "";
    }
    const prevHistory = E.ui.history;
    E.ui.history = function () { const r = prevHistory ? prevHistory.apply(this, arguments) : undefined; paintDirty(); return r; };

    /* ---------------- float / dock / arrange ---------------- */
    function float(id, rect) {
      const d = rec(id); if (!d) return;
      d.float = rect || cascade(docs.filter((x) => x.float).length, room()); d.z = ++zTop;
      if (frontDocked === id) frontDocked = (docs.filter((x) => !x.float).pop() || {}).id || null;
      if (d.id !== live) activate(d.id); else { paint(); if (!S.userView) E.fitView(); }
    }
    function dock(id) {
      const d = rec(id); if (!d) return;
      d.float = null; frontDocked = d.id;
      if (d.id !== live) activate(d.id); else { paint(); if (!S.userView) E.fitView(); }
    }
    function consolidate() { for (const d of docs) d.float = null; if (live) frontDocked = live; paint(); if (S.w && !S.userView) E.fitView(); }
    function floatAll() { const R = room(); docs.forEach((d, k) => { d.float = cascade(k, R); d.z = ++zTop; }); if (liveRec()) liveRec().z = ++zTop; paint(); if (S.w && !S.userView) E.fitView(); }
    function tileAll() { const R = room(), t = tile(docs.length, R); docs.forEach((d, k) => { d.float = t[k]; }); paint(); if (S.w && !S.userView) E.fitView(); }
    function cascadeAll() { floatAll(); }

    /* ---------------- close ---------------- */
    function drop(d, pdf) {
      const i = docs.indexOf(d); if (i >= 0) docs.splice(i, 1);
      const w = flo.querySelector(`.pcdwin[data-id="${d.id}"]`); if (w) w.remove();
      if (pdf && E.pdfSession && E.pdfSession.drop) E.pdfSession.drop(pdf);
      if (frontDocked === d.id) frontDocked = (docs.filter((x) => !x.float).pop() || {}).id || null;
    }
    function closeNow(id) {
      const d = rec(id); if (!d) return false;
      if (d.id !== live) { drop(d, d.pdf); paint(); return true; }
      // the live one: the next document comes to the front (the newest window, else the neighbouring tab)
      const pdf = E.pdfSession ? E.pdfSession.get() : null;
      const i = docs.indexOf(d), others = docs.filter((x) => x !== d);
      const nextFloat = others.filter((x) => x.float).sort((a, b) => (b.z || 0) - (a.z || 0))[0];
      const docked = docs.filter((x) => !x.float), di = docked.indexOf(d);
      const nextDocked = di >= 0 ? (docked[di + 1] || docked[di - 1]) : (rec(frontDocked) || docked[docked.length - 1]);
      const next = (d.float ? nextFloat || nextDocked : (nextDocked && nextDocked !== d ? nextDocked : nextFloat)) || others[Math.min(i, others.length - 1)];
      if (E.pdfSession) E.pdfSession.set(null);
      give(S, blank()); live = null;
      drop(d, pdf);
      if (next) activate(next.id);
      else { E.blankDoc(); place(); paint(); }
      return true;
    }
    function close(id, force) {
      const d = rec(id || live); if (!d) return false;
      if (force || !isDirty(d)) return closeNow(d.id);
      if (d.id !== live) activate(d.id);
      E.ui.dialog("Close", `<div class="pcdclose">Save the changes to <b>${esc(d.name || "Untitled")}</b> in the project's Images before closing?</div>`, () => {
        Promise.resolve(E.saveToImages()).then((n) => { if (n) closeNow(d.id); });
      }, { okLabel: "💾 Save and close", extra: '<button class="ghost" id="pcdNoSave" title="Close it - the changes are lost">Close without saving</button>',
        init: (dl) => { dl.querySelector("#pcdNoSave").onclick = () => { dl.remove(); closeNow(d.id); }; } });
      return false;
    }
    function closeAll(force) {
      const dirtyOnes = docs.filter(isDirty);
      if (!force && dirtyOnes.length) {
        E.ui.dialog("Close All", `<div class="pcdclose">${dirtyOnes.length} document(s) have changes that are not saved: ${dirtyOnes.map((d) => `<b>${esc(d.name || "Untitled")}</b>`).join(", ")}.</div>`, () => { closeAll(true); },
          { okLabel: "Close all without saving" });
        return false;
      }
      for (const d of docs.slice()) if (d.id !== live) drop(d, d.pdf);
      if (live) closeNow(live); else { E.blankDoc(); paint(); }
      return true;
    }

    /* ---------------- saved = not dirty ---------------- */
    const prevSave = E.saveToImages;
    E.saveToImages = async function (blob, name) {
      const top = S.undo[S.undo.length - 1], id = live;
      const n = await prevSave.apply(this, arguments);
      if (n && !blob && id === live) { S.savedTop = top; paintDirty(); }
      return n;
    };

    /* ---------------- commands ---------------- */
    const C = E.ui.addCmd, sep = E.ui.sep;
    C("file.close", "Close", "Ctrl+W", () => close(live), { enabled: () => !!live }, ["File", "file.place"]);
    C("file.closeall", "Close All", "Alt+Ctrl+W", () => closeAll(false), { enabled: () => docs.length > 0 }, ["File", "file.close"]);
    C("win.docnext", "Next Document", "Ctrl+Tab", () => { const n = nextId(docs.map((d) => d.id), live, 1); if (n) activate(n); }, { enabled: () => docs.length > 1 });
    C("win.docprev", "Previous Document", "Shift+Ctrl+Tab", () => { const n = nextId(docs.map((d) => d.id), live, -1); if (n) activate(n); }, { enabled: () => docs.length > 1 });
    C("win.consolidate", "Consolidate All to Tabs", "", consolidate, { enabled: () => docs.some((d) => d.float) });
    C("win.floatone", "Float in Window", "", () => float(live), { enabled: () => !!(liveRec() && !liveRec().float) });
    C("win.floatall", "Float All in Windows", "", floatAll, { enabled: () => docs.length > 0 });
    C("win.tile", "Tile", "", tileAll, { enabled: () => docs.length > 0 });
    C("win.cascade", "Cascade", "", cascadeAll, { enabled: () => docs.length > 0 });
    C("win.docmode", "Open Documents as Tabs", "", () => { asTabs = !asTabs; store.set("docs.tabs", asTabs); say(asTabs ? "new documents open as tabs" : "new documents open in their own window (the first one docks)"); }, { checked: () => asTabs });
    const W = E.ui.MENUS.find(([n]) => n === "Window");
    if (W) W[1].unshift({ label: "Arrange", items: ["win.consolidate", sep, "win.floatone", "win.floatall", "win.tile", "win.cascade", sep, "win.docnext", "win.docprev", sep, "win.docmode"] }, sep);

    E.docs = { list: () => docs.map((d) => ({ id: d.id, name: d.id === live ? S.name : d.name, live: d.id === live, float: d.float ? Object.assign({}, d.float) : null, dirty: isDirty(d) })),
      live: () => live, park, activate, close, closeAll, closeNow, float, dock, consolidate, floatAll, tile: tileAll, cascade: cascadeAll, paint,
      setTabs(on) { asTabs = !!on; store.set("docs.tabs", asTabs); }, asTabs: () => asTabs };
    paint();
  }

  const PCDocs = { DOC_KEYS, blank, take, give, dirty, cascade, tile, nextId, overStrip, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCDocs;
  else root.PCDocs = PCDocs;
})(typeof window !== "undefined" ? window : globalThis);
