/* pcframes.js — FRAMES (CorelDRAW's PowerClip) IN THE IMAGE EDITOR (2.442.0), window.PCFrames.
 *
 * Tim (verbatim): "if a shape is selected and user generates image , put that image in the shape. let user add any
 * layer or layers to frame(a closed shape). add option to edit frame. when editing a frame layers inside that frame can
 * be worked on, transform, move, rotate etc) when in the frame add option to exit. and go back into normal mode. the
 * frame will move and rotate and scale as normal but everything inside will rotate, scale and move at the same time
 * keeping the frame contents consistent.keep he layers in the frame in a tree of layers inside the shape layer operated on."
 *
 *   A FRAME      any closed shape layer (rectangle, ellipse, polygon, a closed path) with L.frame = {geo, lock}: the
 *                layers inside it are its children in the layer tree (L.parent = the frame's id, right below it in
 *                the flat list - pcdoc.js treats a frame like a group there) and show only inside its outline. The
 *                frame draws its fill, then its contents clipped to it, then its outline on top.
 *   PLACE        Layer ▸ Frame ▸ Place Inside Frame… - the picked layers (Ctrl-click in Layers) and / or the active
 *                one go into a closed shape (the one picked with them, or chosen in the dialog); or drag a layer onto
 *                a closed shape's row in Layers (the middle of the row). "Centre the contents" is an option.
 *   EDIT         Edit Frame Contents (double-click the frame with the Move tool): the contents show whole (what is
 *                outside the frame faint), each can be moved / transformed / painted like any layer; the bar on the
 *                canvas (✓ Finish Editing Frame) or the menu goes back to normal mode.
 *   FOLLOW       the frame moved / turned / scaled / skewed by anything (the Move tool, the property bar, the
 *                Transform docker, the path tools) - its contents follow live (drawn through the same matrix while
 *                dragging) and are changed with it in the SAME undo step: the matrix is the least-squares affine map
 *                of the frame's nodes before -> after (a node edit that is not an affine change leaves them where
 *                they are). Lock Contents to Frame off = the frame moves alone.
 *   EXTRACT      Extract Contents - out of the frame, above it, where they are.
 *   GENERATE     ✨ Generate (the AI panel) with a closed shape active and nothing else asked: it generates in the
 *                shape's box and ✔ Apply puts the picture INSIDE the shape (a frame). Layer ▸ Frame ▸ ✨ Generate Into
 *                the Picked Shape switches it off / on.
 *
 * Pure (Node: scripts/test-frames.js): isClosedShape, geoOf, fitAffine, isIdent, applyM, invM, mulM, frameOf, underFrame,
 * moveInto, extractPlan.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const CLOSED_KINDS = new Set(["rect", "ellipse", "polygon", "triangle"]);
  /** a closed shape layer that can hold layers (not a line / a dimension / a connector) */
  function isClosedShape(L) {
    if (!L || L.type !== "shape" || !L.shape) return false;
    const s = L.shape;
    if (s.dim || (s.line && (s.line.labels || s.line.connect))) return false;
    if (CLOSED_KINDS.has(s.kind)) return Math.abs(s.w) > 0 && Math.abs(s.h) > 0;
    return s.kind === "path" && !!s.path && Array.isArray(s.path.subs) && s.path.subs.some((q) => q.closed && q.pts && q.pts.length > 2);
  }
  /** the frame's nodes [[x, y]…] - the path's anchors (a rectangle / ellipse / polygon through PCPath.fromShape, the
   *  same nodes it gets when it is turned into a path - so a rectangle turned by the Transform docker still matches) */
  function geoOf(s, Q) {
    if (!s) return [];
    Q = Q || root.PCPath;
    let p = null;
    if (s.kind === "path") { if (Q && Q.fitShape) Q.fitShape(s); p = s.path; }
    else if (Q && Q.fromShape) p = Q.fromShape(s);
    if (!p) { const x = Math.min(s.x, s.x + s.w), y = Math.min(s.y, s.y + s.h), w = Math.abs(s.w), h = Math.abs(s.h); return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; }
    const out = [];
    for (const q of p.subs || []) for (const a of q.pts || []) out.push([a.x, a.y]);
    return out;
  }
  /** [a b c d e f]: x' = a x + c y + e, y' = b x + d y + f (the canvas order) */
  const applyM = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const mulM = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
  function invM(m) { const d = m[0] * m[3] - m[1] * m[2]; if (Math.abs(d) < 1e-12) return null; return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d]; }
  const isIdent = (m, eps) => { const e = eps == null ? 1e-6 : eps; return !m || (Math.abs(m[0] - 1) < e && Math.abs(m[1]) < e && Math.abs(m[2]) < e && Math.abs(m[3] - 1) < e && Math.abs(m[4]) < 1e-4 && Math.abs(m[5]) < 1e-4); };
  function det3(a) { return a[0] * (a[4] * a[8] - a[5] * a[7]) - a[1] * (a[3] * a[8] - a[5] * a[6]) + a[2] * (a[3] * a[7] - a[4] * a[6]); }
  /** the affine map that takes the points A to B (least squares over all of them), or null: not the same count, all on
   *  one line, or not an affine change (a node moved on its own: an error over `tol` px) */
  function fitAffine(A, B, tol) {
    if (!Array.isArray(A) || !Array.isArray(B) || A.length !== B.length || A.length < 3) return null;
    const n = A.length;
    let mx = 0, my = 0; for (const [x, y] of A) { mx += x; my += y; } mx /= n; my /= n;      // centred: better conditioned
    let sxx = 0, sxy = 0, syy = 0, sx = 0, sy = 0;
    for (const [x0, y0] of A) { const x = x0 - mx, y = y0 - my; sxx += x * x; sxy += x * y; syy += y * y; sx += x; sy += y; }
    const M = [sxx, sxy, sx, sxy, syy, sy, sx, sy, n], D = det3(M);
    const scale = Math.max(1, sxx + syy);
    if (Math.abs(D) < 1e-9 * scale * scale) return null;
    const solve = (k) => {
      let bx = 0, by = 0, b1 = 0;
      for (let i = 0; i < n; i++) { const x = A[i][0] - mx, y = A[i][1] - my, v = B[i][k]; bx += x * v; by += y * v; b1 += v; }
      const r = [bx, by, b1];
      const col = (j) => { const c = M.slice(); c[j] = r[0]; c[3 + j] = r[1]; c[6 + j] = r[2]; return det3(c) / D; };
      return [col(0), col(1), col(2)];
    };
    const [a, c, e0] = solve(0), [b, d, f0] = solve(1);
    const m = [a, b, c, d, e0 - a * mx - c * my, f0 - b * mx - d * my];
    const t = tol == null ? 0.75 : tol;
    for (let i = 0; i < n; i++) { const [x, y] = applyM(m, A[i][0], A[i][1]); if (Math.hypot(x - B[i][0], y - B[i][1]) > t) return null; }
    return m.map((v) => Math.round(v * 1e9) / 1e9);
  }
  /** the nearest frame a layer is inside (its id), else null */
  function frameOf(layers, L) {
    const byId = new Map(layers.map((x) => [x.id, x]));
    let p = L && L.parent, n = 0;
    while (p != null && n++ < 60) { const P = byId.get(p); if (!P) return null; if (P.frame) return P.id; p = P.parent; }
    return null;
  }
  /** is there a frame between L and the layer `stopId` (L follows that frame, not whatever moves `stopId`)? */
  function underFrame(layers, L, stopId) {
    const byId = new Map(layers.map((x) => [x.id, x]));
    let p = L && L.parent, n = 0;
    while (p != null && p !== stopId && n++ < 60) { const P = byId.get(p); if (!P) return false; if (P.frame) return true; p = P.parent; }
    return false;
  }
  /** the layers `ids` (with what is in them) moved into the frame `fid` as its top children, in their order - a tree
   *  op on the flat list (pcdoc's toTree / fromTree); the frame must already carry L.frame. Throws when one holds it. */
  function moveInto(D, layers, ids, fid) {
    const T = D.toTree(layers), f = D.findNode(T, fid); if (!f) throw new Error("the frame is gone");
    const F = f.list[f.i];
    const order = layers.filter((x) => ids.includes(x.id)).map((x) => x.id);       // bottom-to-top as they are
    for (const id of order) {
      if (id === fid) continue;
      if (D.descendants(layers, id).some((x) => x.id === fid)) throw new Error("a layer cannot go into a frame that is inside it");
      const r = D.findNode(T, id); if (!r) continue;
      if (r.parent && ids.includes(r.parent.L.id) && r.parent.L.id !== fid) continue;   // its group goes in with it
      const node = r.list.splice(r.i, 1)[0];
      node.L.parent = fid; F.kids.push(node);
    }
    return D.fromTree(T);
  }
  /** Extract Contents: the frame's children out, right above it, in its parent; the frame plain again */
  function extractPlan(D, layers, fid) {
    const T = D.toTree(layers), f = D.findNode(T, fid); if (!f) return layers;
    const F = f.list[f.i], kids = F.kids.splice(0);
    for (const k of kids) k.L.parent = F.L.parent != null ? F.L.parent : null;
    f.list.splice(f.i + 1, 0, ...kids);
    F.L.frame = null;
    return D.fromTree(T);
  }

  /* ================================ drawing (pcdoc.js calls it) ================================ */
  let live = { editing: null };
  /** the matrix the contents are drawn through now (the frame changed and not committed yet), or null */
  function liveMatrix(L) {
    if (!L || !L.frame || L.frame.lock === false || live.editing === L.id) return null;
    const m = fitAffine(L.frame.geo, geoOf(L.shape));
    return m && !isIdent(m) ? m : null;
  }
  function clipCanvas(env, L, W, H) {
    const c = env.newCanvas(W, H), g = c.getContext("2d"), s = L.shape, Q = root.PCPath, D = root.PCDoc;
    if (s.kind === "path" && Q) Q.fillArea(g, s.path, "#000");
    else if (D) { D.shapePath(g, s); g.fillStyle = "#000"; g.fill(); }
    return c;
  }
  /** a frame's look: its fill, its contents clipped to it, its outline on top (editing: the contents whole, faint) */
  function content(env, node, W, H, renderList) {
    const L = node.L, out = env.newCanvas(W, H), g = out.getContext("2d"), s = L.shape;
    const outline = !!(s.strokeOn && s.strokeW > 0);
    if (outline) {                                           // the fill only first (the outline goes on top)
      const f = env.newCanvas(W, H), fg = f.getContext("2d"), D = root.PCDoc;
      if (s.fillOn !== false) {
        if (s.kind === "path" && root.PCPath) root.PCPath.fillArea(fg, s.path, s.fill || "#000");
        else if (D) { D.shapePath(fg, s); fg.fillStyle = s.fill || "#000"; fg.fill(); }
      }
      g.drawImage(f, 0, 0);
    } else g.drawImage(env.srcFor(L), 0, 0);
    let kids = env.newCanvas(W, H);
    renderList(env, node.kids, kids, W, H);
    const m = liveMatrix(L);
    if (m) { const t = env.newCanvas(W, H), tg = t.getContext("2d"); tg.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); tg.imageSmoothingQuality = "high"; tg.drawImage(kids, 0, 0); tg.setTransform(1, 0, 0, 1, 0, 0); kids = t; }
    if (env.screen && live.editing === L.id) { g.save(); g.globalAlpha = 0.3; g.drawImage(kids, 0, 0); g.restore(); }
    const kg = kids.getContext("2d");
    kg.globalCompositeOperation = "destination-in"; kg.drawImage(clipCanvas(env, L, W, H), 0, 0); kg.globalCompositeOperation = "source-over";
    g.drawImage(kids, 0, 0);
    if (outline) {
      const D = root.PCDoc, so = Object.assign({}, s, { fillOn: false });
      if (s.kind === "path" && root.PCPath) { g.save(); root.PCPath.drawPathShape(g, so); g.restore(); }
      else if (D) D.drawShape(g, so);
    }
    return out;
  }
  const holds = (node) => !!(node && node.L && node.L.frame && node.L.type === "shape" && node.L.shape && node.kids && node.kids.length);

  /* ================================ the editor ================================ */
  function install(E) {
    const { S, D, doc, say, store } = E;
    const Q = root.PCPath, P = E.P || root.PCSel;
    if (!E.ui || !E.ui.addCmd || !Q || !E.dockers) return;
    const kx = E.stage && E.stage.closest ? E.stage.closest(".kx") : null;
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const set = Object.assign({ gen: true, center: false }, store.get("frames", {}) || {});
    const keep = () => store.set("frames", set);
    S.frameEdit = null;
    const byId = (id) => S.layers.find((x) => x.id === id) || null;
    const isFrame = (L) => !!(L && L.frame && L.type === "shape");
    const kidsOf = (F) => (F ? D.descendants(S.layers, F.id) : []);
    const hasKids = (F) => isFrame(F) && S.layers.some((x) => x.parent === F.id);
    const A = () => (S.w ? E.layer() : null);
    /** the frame the active layer belongs to (itself when it is one) */
    const frameHere = () => { const L = A(); if (!L) return null; if (isFrame(L)) return L; const f = frameOf(S.layers, L); return f != null ? byId(f) : null; };
    function makeFrame(F) { if (!F.frame) F.frame = { geo: geoOf(F.shape), lock: true }; else F.frame.geo = geoOf(F.shape); return F; }

    /* ---- one undo step around f(list): the struct before / after + the pixel steps in list */
    function op(label, f) {
      if (!S.w) return false;
      const before = E.snapStruct(), list = [];
      let r;
      try { r = f(list); } catch (e) { E.putStruct(before); say(label + ": " + e.message); E.refresh(); E.renderLayersPanel(); return false; }
      if (r === false) { E.putStruct(before); return false; }
      list.push({ t: "struct", before, after: E.snapStruct() });
      seen.add(list); E.push({ t: "multi", list, label });
      E.refresh(); E.renderLayersPanel();
      return true;
    }

    /* ---- PLACE INSIDE */
    function place(contents, F, center) {
      if (!isClosedShape(F)) return say("a frame is a closed shape (rectangle, ellipse, polygon, a closed path)");
      const ids = contents.filter((x) => x && x !== F).map((x) => x.id);
      if (!ids.length) return say("pick the layers to put inside (Ctrl-click in Layers), then Place Inside Frame");
      return op("place inside frame", (list) => {
        makeFrame(F);
        if (center) {
          const bs = ids.map((id) => E.dockers.boxOf(byId(id))).filter(Boolean), fb = E.dockers.boxOf(F);
          if (bs.length && fb) {
            const u = bs.reduce((a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), r: Math.max(a.r, b.x + b.w), b: Math.max(a.b, b.y + b.h) }), { x: Infinity, y: Infinity, r: -Infinity, b: -Infinity });
            const dx = Math.round(fb.x + fb.w / 2 - (u.x + u.r) / 2), dy = Math.round(fb.y + fb.h / 2 - (u.y + u.b) / 2);
            if (dx || dy) for (const id of ids) E.dockers.xformLayer(byId(id), [1, 0, 0, 1, dx, dy], list);
          }
        }
        S.layers = moveInto(D, S.layers, ids, F.id);
        F.open = true;
        S.active = S.layers.indexOf(F);
        S.picks = [];
        say(`${ids.length} layer(s) inside ${F.name} - they move / turn / scale with it; Edit Frame Contents (double-click it with the Move tool) to work on them`);
      });
    }
    function placeDialog() {
      if (!S.w) return say("open a picture first");
      const picked = (E.picked ? E.picked() : []).filter(Boolean), act = A();
      const movers = picked.slice(); if (act && !movers.includes(act)) movers.push(act);
      const frames = S.layers.filter((L) => isClosedShape(L)).reverse();
      if (!frames.length) return say("draw a closed shape first (a rectangle, an ellipse, a polygon …) - it is the frame");
      // the frame: a closed shape that was picked with them (the active one first), else the nearest one above the active
      let pre = movers.length > 1 ? (isClosedShape(act) ? act : movers.find((x) => isClosedShape(x))) : null;
      if (!pre && act) { const i = S.layers.indexOf(act); pre = S.layers.slice(i + 1).find((x) => isClosedShape(x) && !D.descendants(S.layers, act.id).includes(x)) || frames.find((x) => x !== act) || null; }
      const contents = movers.filter((x) => x !== pre);
      if (!contents.length) return say("pick the layers to put inside (Ctrl-click in Layers) - or make another layer active");
      E.ui.dialog("Place Inside Frame", `<div class="kxrow" style="color:var(--pc-dim)">${contents.length} layer(s): ${esc(contents.map((x) => x.name).join(", ").slice(0, 120))}</div>
        <div class="kxrow"><span>Frame</span><select id="frSel">${frames.filter((x) => !contents.includes(x)).map((x) => `<option value="${x.id}"${x === pre ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div>
        <div class="kxrow"><label><input type="checkbox" id="frCtr"${set.center ? " checked" : ""}> Centre the contents in the frame</label></div>`,
      (d) => { set.center = d.querySelector("#frCtr").checked; keep(); const F = byId(+d.querySelector("#frSel").value) || byId(d.querySelector("#frSel").value); place(contents, F, set.center); }, { okLabel: "▣ Place" });
    }

    /* ---- EDIT / FINISH */
    let bar = null;
    function showBar() {
      const F = S.frameEdit != null ? byId(S.frameEdit) : null;
      if (!F) { if (bar) bar.style.display = "none"; return; }
      if (!bar) {
        bar = doc.createElement("div"); bar.id = "pcFrameBar"; bar.className = "pcframebar";
        const st = doc.createElement("style"); st.id = "pcFrameCss";
        st.textContent = ".kx .pcframebar{position:absolute;left:50%;top:8px;transform:translateX(-50%);z-index:30;display:flex;gap:8px;align-items:center;padding:4px 8px;border:1px solid var(--pc-accent);border-radius:6px;background:var(--pc-panel,#2b2b2b);color:var(--pc-text);font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,.35)}.kx .pcframebar button{padding:2px 8px}";
        doc.head.appendChild(st);
        E.stage.appendChild(bar);
      }
      bar.innerHTML = `<span>▣ Editing the contents of <b>${esc(F.name)}</b></span><button id="pcFrameDone" title="Back to normal mode - the frame and what is in it move as one">✓ Finish Editing Frame</button>`;
      bar.style.display = "";
      bar.querySelector("#pcFrameDone").onclick = (e) => { e.stopPropagation(); finish(); };
      bar.onpointerdown = (e) => e.stopPropagation();
    }
    function edit(F) {
      F = F || frameHere();
      if (!isFrame(F) || !hasKids(F)) return say("pick a frame that holds layers (Place Inside Frame first)");
      if (S.frameEdit != null && S.frameEdit !== F.id) finish(true);
      S.frameEdit = F.id; live.editing = F.id;
      F.frame.geo = geoOf(F.shape);
      const L = A(); if (!L || L === F || frameOf(S.layers, L) !== F.id) { const top = S.layers.filter((x) => x.parent === F.id).pop(); if (top) E.setActive(S.layers.indexOf(top)); }
      F.open = true;
      showBar(); E.refresh(); E.renderLayersPanel();
      say(`editing the contents of ${F.name} - move / transform / paint them; ✓ Finish Editing Frame goes back`);
    }
    function finish(quiet) {
      const F = S.frameEdit != null ? byId(S.frameEdit) : null;
      S.frameEdit = null; live.editing = null;
      if (F) { F.frame.geo = geoOf(F.shape); E.setActive(S.layers.indexOf(F)); }
      showBar(); E.refresh(); E.renderLayersPanel();
      if (!quiet) say(F ? `${F.name}: normal mode - the frame and its contents move as one` : "normal mode");
    }
    function extract(F) {
      F = F || frameHere();
      if (!isFrame(F)) return say("pick a frame");
      if (S.frameEdit === F.id) finish(true);
      const n = S.layers.filter((x) => x.parent === F.id).length;
      op("extract contents", () => { S.layers = extractPlan(D, S.layers, F.id); S.active = S.layers.indexOf(F); });
      say(`${n} layer(s) out of ${F.name}`);
    }
    function toggleLock(F) {
      F = F || frameHere(); if (!isFrame(F)) return say("pick a frame");
      op(F.frame.lock === false ? "lock contents to frame" : "unlock contents from frame", () => { F.frame = Object.assign({}, F.frame, { lock: F.frame.lock === false, geo: geoOf(F.shape) }); });
      say(F.frame.lock === false ? `${F.name}: the frame moves alone now` : `${F.name}: the contents move with the frame`);
    }

    /* ---- FOLLOW: after every new undo step, a frame that changed by an affine map takes its contents with it (same step) */
    const seen = new WeakSet();
    const docLike = (e) => !!e && (e.t === "doc" || (e.t === "multi" && (e.list || []).some(docLike)));
    function follow() {
      if (!S.w || !S.undo || !S.undo.length || (S.redo && S.redo.length)) return;
      const top = S.undo[S.undo.length - 1];
      if (seen.has(top) || seen.has(top.list)) return;
      seen.add(top);
      if (S.frameEdit != null && !byId(S.frameEdit)) { S.frameEdit = null; live.editing = null; showBar(); }
      const frames = S.layers.filter(isFrame); if (!frames.length) return;
      const before = E.snapStruct(), list = [];
      let changed = 0, moved = 0;
      const wholeDoc = docLike(top);
      for (const F of frames) {
        const g = geoOf(F.shape), m = fitAffine(F.frame.geo, g);
        const same = !!m && isIdent(m);
        if (same && F.frame.geo.length === g.length) continue;
        if (m && !same && !wholeDoc && F.frame.lock !== false && S.frameEdit !== F.id) {
          for (const K of kidsOf(F)) {
            if (K.type === "group" || K.type === "adjust" || K.type === "fill") continue;
            try { E.dockers.xformLayer(K, m, list); } catch (e) { say(`${K.name}: ${e.message}`); }
          }
          for (const K of kidsOf(F)) if (isFrame(K)) K.frame = Object.assign({}, K.frame, { geo: geoOf(K.shape) });
          moved++;
        }
        F.frame = Object.assign({}, F.frame, { geo: g });
        changed++;
      }
      if (!changed) return;
      list.push({ t: "struct", before, after: E.snapStruct() });
      const merged = { t: "multi", list: [top].concat(list), label: top.label || "change" };
      seen.add(merged);
      S.undo[S.undo.length - 1] = merged;
      if (moved) E.renderSoon ? E.renderSoon() : E.refresh();
    }
    const prevHistory = E.ui.history;
    E.ui.history = function () { const r = prevHistory ? prevHistory.apply(this, arguments) : undefined; try { follow(); } catch (e) { /* never stop an edit */ } return r; };

    /* ---- the layer tree: a closed shape takes a layer dropped on the middle of its row */
    const prevDrop = E.dropLayer;
    E.dropLayer = (id, refId, where) => {
      const R = byId(refId), L = byId(id);
      if (where === "in" && R && L && isClosedShape(R) && R.type !== "group") return place([L], R, false);
      return prevDrop(id, refId, where);
    };

    /* ---- picking on the canvas: what is inside a frame is picked as the frame (normal mode) */
    E.hitLayer = (L, x, y) => {
      const f = frameOf(S.layers, L);
      if (f != null && f !== S.frameEdit) return false;
      if (hasKids(L) && S.frameEdit !== L.id) {
        const c = E.newCanvas(1, 1), g = c.getContext("2d");
        if (L.shape.kind === "path") { Q.traceAll(g, L.shape.path); return g.isPointInPath(x + 0.5, y + 0.5, "evenodd") || null; }
        D.shapePath(g, L.shape); return g.isPointInPath(x + 0.5, y + 0.5) || null;
      }
      return null;
    };
    /* 2.453.0 (Tim: "lock contents to the frame when put in frame like in coreldraw, make frame behave like coreldraw frame,
     * right click context menu to enter frame and edit contents of the frame. right click context menu to finish editing
     * frame. move scale and rotate frames contents with selected frame"):
     *   LOCKED      what is inside a locked frame is never moved / transformed on its own outside Edit mode - the Move
     *               tool (and its handles, pchandles.js) take the FRAME when such a layer is the active one
     *   RIGHT-CLICK on the canvas: Edit Frame Contents / Finish Editing Frame / Extract Contents / Lock Contents to Frame
     *               (+ Place Inside Frame…, Duplicate, Delete); in Edit mode a right-click offers ✓ Finish first
     *   (a double-click on a frame is the Move tool's rotate handles now - 2.452.0) */
    const owner = (L) => {
      if (!L || S.frameEdit != null && (S.frameEdit === L.id || frameOf(S.layers, L) === S.frameEdit || underFrame(S.layers, L, S.frameEdit))) return null;
      let f = frameOf(S.layers, L), top = null;
      while (f != null) { const F = byId(f); if (!F) break; if (F.frame && F.frame.lock !== false && S.frameEdit !== F.id) top = F; f = frameOf(S.layers, F); }
      return top;
    };
    E.stage.addEventListener("pointerdown", (e) => {
      if (S.tool !== "move" || !S.w || e.button !== 0) return;
      const o = owner(A()); if (o) { E.setActive(S.layers.indexOf(o)); say(`${o.name}: its contents are locked to it - right-click ▸ Edit Frame Contents to work on them`); }
    }, true);
    E.stage.addEventListener("contextmenu", (e) => {
      if (!S.w || !E.ui.menuAt) return;
      e.preventDefault(); e.stopPropagation();
      if (S.frameEdit == null) { const [fx, fy] = E.pos(e), i = E.layerAt(Math.floor(fx), Math.floor(fy)); if (i >= 0 && i !== S.active) E.setActive(i); }
      const F = frameHere(), items = [];
      // 2.604.0 (Tim: "add a rightclick context menu with rasterize text"): on a text layer it comes first
      { const Lc = A(); if (Lc && Lc.type === "text") items.push("layer.rasterizetext", sep); }
      if (S.frameEdit != null) items.push("frame.finish", sep, "frame.extract", "frame.lock");
      else if (F && hasKids(F)) items.push("frame.edit", "frame.extract", "frame.lock");
      else items.push("frame.place");
      items.push(sep, "layer.dup", "layer.del");
      const more = E.ui.stageCtxItems || [];                       // 2.594.0: modules' items (static/mesh3dctx.js: 🧊 Convert to 3D)
      if (more.length) items.push(sep, ...more);
      const kr = (kx || E.stage).getBoundingClientRect();
      E.ui.menuAt(items, e.clientX - kr.left, e.clientY - kr.top, 0);
    });

    /* ---- ✨ Generate with a closed shape active: in its box, the result inside it */
    E.beforeGenerate = (mode) => {
      if (mode !== "generate" || S.genInto || !set.gen) return;
      const F = A(); if (!isClosedShape(F)) return;
      const b = E.dockers.boxOf(F); if (!b) return;
      const x0 = Math.max(0, Math.floor(b.x)), y0 = Math.max(0, Math.floor(b.y)), x1 = Math.min(S.w, Math.ceil(b.x + b.w)), y1 = Math.min(S.h, Math.ceil(b.y + b.h));
      if (x1 - x0 < 2 || y1 - y0 < 2) return;
      const a = new Uint8Array(S.w * S.h);
      for (let y = y0; y < y1; y++) a.fill(255, y * S.w + x0, y * S.w + x1);
      E.applyShape(a, "replace", "select the shape's box");
      S.genInto = { id: F.id, how: "frame" };
      say(`generating into ${F.name} - ✔ Apply puts the picture inside it (Layer ▸ Frame ▸ ✨ Generate Into the Picked Shape turns this off)`);
    };
    /** the ✔ Applied result inside the frame (one undo step) */
    function placeResult(L, F) {
      const before = E.snapStruct();
      makeFrame(F);
      S.layers = D.insert(S.layers, L, F.id, true);
      F.open = true;
      S.active = S.layers.indexOf(L);
      const e = { t: "struct", before, after: E.snapStruct(), label: "generate into shape" };
      seen.add(e); E.push(e);
      return L;
    }

    /* ---- the edited frame's outline on the canvas */
    E.overlayHooks.push((g, px) => {
      const F = S.frameEdit != null ? byId(S.frameEdit) : null;
      if (!F) { if (S.frameEdit != null) { S.frameEdit = null; live.editing = null; showBar(); } return; }
      g.save(); g.lineWidth = 1.5 * px; g.strokeStyle = "#ff8a00"; g.setLineDash([6 * px, 4 * px]);
      if (F.shape.kind === "path") Q.traceAll(g, F.shape.path); else D.shapePath(g, F.shape);
      g.stroke(); g.restore();
    });

    /* ---- the menus */
    const C = E.ui.addCmd, sep = E.ui.sep;
    C("frame.place", "Place Inside Frame…", "", placeDialog, { enabled: () => !!S.w && S.layers.some((x) => isClosedShape(x)) });
    C("frame.edit", "Edit Frame Contents", "", () => edit(), { enabled: () => { const F = frameHere(); return !!F && hasKids(F) && S.frameEdit !== F.id; } });
    C("frame.finish", "Finish Editing Frame", "", () => finish(), { enabled: () => S.frameEdit != null });
    C("frame.extract", "Extract Contents", "", () => extract(), { enabled: () => !!frameHere() });
    C("frame.lock", "Lock Contents to Frame", "", () => toggleLock(), { enabled: () => !!frameHere(), checked: () => { const F = frameHere(); return !!F && F.frame.lock !== false; } });
    C("frame.gen", "✨ Generate Into the Picked Shape", "", () => { set.gen = !set.gen; keep(); say(set.gen ? "✨ Generate with a closed shape active puts the picture inside it" : "✨ Generate ignores the active shape"); }, { checked: () => set.gen });
    const Lm = E.ui.MENUS.find(([n]) => n === "Layer");
    if (Lm) {
      const items = Lm[1], at = items.indexOf("layer.dimscale");
      const sub = { label: "Frame", items: ["frame.place", "frame.edit", "frame.finish", "frame.extract", sep, "frame.lock", "frame.gen"] };
      if (at >= 0) items.splice(at + 1, 0, sep, sub); else items.push(sep, sub);
    }
    E.ui.layerCtxItems = (E.ui.layerCtxItems || []).concat(["frame.place", "frame.edit", "frame.finish", "frame.extract"]);

    E.frames = { isFrame, isClosedShape, hasKids, place, placeDialog, edit, finish, extract, toggleLock, placeResult, follow, settings: set, editing: () => S.frameEdit, geoOf, owner, kidsOf };
  }

  const PCFrames = { isClosedShape, geoOf, fitAffine, isIdent, applyM, invM, mulM, frameOf, underFrame, moveInto, extractPlan, content, holds, liveMatrix, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCFrames;
  else root.PCFrames = PCFrames;
})(typeof window !== "undefined" ? window : globalThis);
