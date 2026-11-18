/* pcdocmargins.js — 📏 A WP FRAME'S EDGES = THE PAGE'S MARGINS (2.840.0), window.PCDocMargins.
 *
 * Tim (verbatim): "allow user to resize wp frame to change it's margins".
 *   With the Move tool or the Document Text tool, the pointer near a WP frame's edge shows a resize arrow; drag the edge and
 *   the frame's margin on that side changes - every frame of the story (its pages) the same, the text flowing again as you
 *   drag; the margins are shown in millimetres from the page's edges while dragging. One undo step. Layer ▸ 📏 WP Margins…
 *   (and the right-click on a WP layer) types them in mm. The Word export already takes its page margins from the first frame.
 * Pure (Node: scripts/test-840.js): edgeAt, dragTo, mmOf, fromMargins.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  /** which edges of frame f {x, y, w, h} the point is on (within tol): "l" | "r" | "t" | "b" | "lt" … | "" */
  function edgeAt(f, x, y, tol) {
    const inY = y >= f.y - tol && y <= f.y + f.h + tol, inX = x >= f.x - tol && x <= f.x + f.w + tol;
    let s = "";
    if (inY && Math.abs(x - f.x) <= tol) s += "l"; else if (inY && Math.abs(x - (f.x + f.w)) <= tol) s += "r";
    if (inX && Math.abs(y - f.y) <= tol) s += "t"; else if (inX && Math.abs(y - (f.y + f.h)) <= tol) s += "b";
    return s;
  }
  /** the frame f0 with its edges `edges` dragged by (dx, dy), kept on the page (W x H) and at least 40 x 30 -> {x, y, w, h} */
  function dragTo(f0, edges, dx, dy, W, H) {
    let x0 = f0.x, x1 = f0.x + f0.w, y0 = f0.y, y1 = f0.y + f0.h;
    if (edges.includes("l")) x0 = Math.max(0, Math.min(x1 - 40, x0 + dx));
    if (edges.includes("r")) x1 = Math.min(W, Math.max(x0 + 40, x1 + dx));
    if (edges.includes("t")) y0 = Math.max(0, Math.min(y1 - 30, y0 + dy));
    if (edges.includes("b")) y1 = Math.min(H, Math.max(y0 + 30, y1 + dy));
    return { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
  }
  /** a frame on a W x H page at dpi -> its margins in mm {top, right, bottom, left} (one decimal) */
  function mmOf(f, W, H, dpi) {
    const k = 25.4 / (dpi || 150), r = (v) => Math.round(Math.max(0, v) * k * 10) / 10;
    return { top: r(f.y), right: r(W - f.x - f.w), bottom: r(H - f.y - f.h), left: r(f.x) };
  }
  /** margins in mm on a W x H page at dpi -> the frame {x, y, w, h} (null when they leave no room) */
  function fromMargins(m, W, H, dpi) {
    const k = (dpi || 150) / 25.4, x = Math.round((+m.left || 0) * k), y = Math.round((+m.top || 0) * k);
    const w = Math.round(W - x - (+m.right || 0) * k), h = Math.round(H - y - (+m.bottom || 0) * k);
    return w >= 40 && h >= 30 ? { x, y, w, h } : null;
  }
  const pure = { edgeAt, dragTo, mmOf, fromMargins };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ================================ the page ================================ */
  function install(E) {
    const { S, doc, win } = E, say = E.say || (() => {});
    if (!E.docText || !E.ui || !E.ui.addCmd || !E.stage) return;
    const isDoc = (L) => !!(L && L.type === "doc" && L.doc);
    const TOOLS = ["move", "doctext", "none", "", null, undefined];
    const dpiNow = () => { const pg = E.pages && E.pages.current ? E.pages.current() : null; return (pg && pg.dpi) || Math.round(((S.layers.find(isDoc) || {}).doc || {}).k * 96) || 150; };
    const CUR = { l: "ew-resize", r: "ew-resize", t: "ns-resize", b: "ns-resize", lt: "nwse-resize", rb: "nwse-resize", rt: "nesw-resize", lb: "nesw-resize" };
    let drag = null, hot = "";
    function frameEdgeAt(x, y) {
      const tol = 6 / (S.zoom || 1);
      for (let i = S.layers.length - 1; i >= 0; i--) { const L = S.layers[i]; if (!isDoc(L) || L.visible === false || L.locks && L.locks.all) continue; const e = edgeAt(L.doc, x, y, tol); if (e) return { L, edges: e }; }
      return null;
    }
    const usable = () => TOOLS.includes(S.tool) && S.w && !(E.docText.editing && E.docText.editing());
    win.addEventListener("pointermove", (e) => {
      if (drag) return;
      if (!usable() || !E.stage.contains(e.target)) { if (hot) { hot = ""; E.stage.style.removeProperty("cursor"); } return; }
      const [x, y] = E.pos(e), h = frameEdgeAt(x, y), c = h ? CUR[h.edges] || "move" : "";
      if (c !== hot) { hot = c; if (c) E.stage.style.setProperty("cursor", c, "important"); else E.stage.style.removeProperty("cursor"); }
    }, true);
    win.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.shiftKey || e.ctrlKey || e.altKey || !usable() || !E.stage.contains(e.target)) return;
      const [x, y] = E.pos(e), h = frameEdgeAt(x, y); if (!h) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const story = E.docText.storyOf(h.L);
      drag = { L: h.L, edges: h.edges, x0: x, y0: y, f0: { x: h.L.doc.x, y: h.L.doc.y, w: h.L.doc.w, h: h.L.doc.h }, before: E.snapStruct(), story, starts: story.map((F) => ({ F, f: { x: F.doc.x, y: F.doc.y, w: F.doc.w, h: F.doc.h } })), t: 0 };
      E.setActive(S.layers.indexOf(h.L));
    }, true);
    function apply(d, fNew) {
      const dx0 = fNew.x - d.f0.x, dw = fNew.w - d.f0.w, dy0 = fNew.y - d.f0.y, dh = fNew.h - d.f0.h;
      for (const { F, f } of d.starts) { F.doc.x = f.x + dx0; F.doc.w = Math.max(40, f.w + dw); F.doc.y = f.y + dy0; F.doc.h = Math.max(30, f.h + dh); }
    }
    win.addEventListener("pointermove", (e) => {
      const d = drag; if (!d) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const [x, y] = E.pos(e); apply(d, dragTo(d.f0, d.edges, x - d.x0, y - d.y0, S.w, S.h));
      const now = Date.now(); if (now - d.t > 120) { d.t = now; E.docText.reflow(d.L.doc.flow && d.L.doc.flow.id); }
      E.drawOverlay();
    }, true);
    win.addEventListener("pointerup", (e) => {
      const d = drag; if (!d) return; drag = null;
      e.preventDefault(); e.stopImmediatePropagation();
      const [x, y] = E.pos(e); apply(d, dragTo(d.f0, d.edges, x - d.x0, y - d.y0, S.w, S.h));
      E.docText.reflow(d.L.doc.flow && d.L.doc.flow.id);
      if (d.L.doc.x !== d.f0.x || d.L.doc.y !== d.f0.y || d.L.doc.w !== d.f0.w || d.L.doc.h !== d.f0.h) {
        E.push({ t: "struct", before: d.before, after: E.snapStruct(), label: "WP margins" });
        const m = mmOf(d.L.doc, S.w, S.h, dpiNow());
        say(`📏 margins: top ${m.top} · right ${m.right} · bottom ${m.bottom} · left ${m.left} mm` + (d.starts.length > 1 ? ` - all ${d.starts.length} frames of the story` : ""));
      }
      E.refresh(); E.drawOverlay();
    }, true);
    // the margins in mm while dragging
    E.overlayHooks.push((g, px) => {
      const d = drag; if (!d) return;
      const f = d.L.doc, m = mmOf(f, S.w, S.h, dpiNow());
      g.save(); g.strokeStyle = "#2680eb"; g.fillStyle = "#2680eb"; g.lineWidth = px; g.setLineDash([2 * px, 3 * px]);
      g.strokeRect(f.x, f.y, f.w, f.h);
      g.setLineDash([]); g.font = `${Math.round(12 * px)}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
      const tag = (t, x, y) => { const w = g.measureText(t).width + 8 * px; g.fillStyle = "rgba(38,128,235,.92)"; g.fillRect(x - w / 2, y - 9 * px, w, 18 * px); g.fillStyle = "#fff"; g.fillText(t, x, y); };
      const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
      g.strokeStyle = "rgba(38,128,235,.6)";
      const line = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
      line(0, cy, f.x, cy); line(f.x + f.w, cy, S.w, cy); line(cx, 0, cx, f.y); line(cx, f.y + f.h, cx, S.h);
      tag(m.left + " mm", f.x / 2, cy); tag(m.right + " mm", (f.x + f.w + S.w) / 2, cy); tag(m.top + " mm", cx, f.y / 2); tag(m.bottom + " mm", cx, (f.y + f.h + S.h) / 2);
      g.restore();
    });
    // Layer ▸ 📏 WP Margins… (typed in mm)
    function dialog() {
      const L = E.layer(); if (!isDoc(L)) return say("pick a WP layer first");
      const dpi = dpiNow(), m = mmOf(L.doc, S.w, S.h, dpi), story = E.docText.storyOf(L);
      const row = (k, t) => `<div class="rw"><span>${t} (mm)</span><input type="number" id="pdm_${k}" value="${m[k]}" min="0" step="0.5"></div>`;
      E.ui.dialog("📏 WP Margins", row("top", "Top") + row("bottom", "Bottom") + row("left", "Left") + row("right", "Right")
        + `<div style="color:var(--pc-dim);margin-top:6px">${story.length > 1 ? `All ${story.length} frames of the story get them.` : "The frame is the page less these margins."}</div>`, (dlg) => {
        const v = (k) => +dlg.querySelector("#pdm_" + k).value, f = fromMargins({ top: v("top"), bottom: v("bottom"), left: v("left"), right: v("right") }, S.w, S.h, dpi);
        if (!f) { say("those margins leave no room for the text"); return false; }
        E.structOp("WP margins", () => { for (const F of story) Object.assign(F.doc, f); });
        E.docText.reflow(L.doc.flow && L.doc.flow.id);
        return true;
      }, { okLabel: "Apply" });
    }
    E.ui.addCmd("layer.docmargins", "📏 WP Margins…", "", dialog, { enabled: () => isDoc(E.layer()) }, ["Layer", "layer.docedit"]);
    E.ui.layerCtxItems = (E.ui.layerCtxItems || []).concat(["layer.docmargins"]);
    E.docMargins = { dialog, dragging: () => !!drag };
  }
  const PCDocMargins = Object.assign({ install }, pure);
  root.PCDocMargins = PCDocMargins;
})(typeof window !== "undefined" ? window : globalThis);
