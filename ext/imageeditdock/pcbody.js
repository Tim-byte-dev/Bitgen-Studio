/* pcbody.js — PARAMETRIC 3D BODIES in the image editor (2.471.0), window.PCBody.
 *
 * Tim (verbatim): "can we add fusion 360 style extrude, revolve, fillet, split to create new bodies 3d layers and make it
 * parametric like fusion 360?" (the engine: Settings ▸ 3D - OpenCascade in the page or Blender, static/body3d.js).
 *
 *   A BODY LAYER is a smart object whose picture is the body drawn from its features: L.smart.body = {params, features,
 *   view, look, k, anchor, snap} (static/body3d.js) - so moving, scaling, rotating, filters and masks all work, and the
 *   body is drawn again (from the cached mesh) when its view / look changes, or built again when a feature, a parameter
 *   or a sketch it uses changes. Each edit = one undo step; a sketch edited later rebuilds its bodies by itself.
 *   The CAD toolbar's SOLID tab (and Layer ▸ 3D Body):
 *     CREATE   Extrude (a sketch's closed profiles: distance, one side / symmetric / two sides, New Body / Join / Cut /
 *              Intersect into a body), Revolve (round the sketch's X / Y axis or one of its lines, an angle)
 *     MODIFY   Fillet, Chamfer (edges: all / top / bottom / vertical / horizontal), Shell (open at the top / bottom),
 *              Split Body (a plane: one side stays, the other side becomes a NEW BODY LAYER), Change Parameters (ƒx)
 *     VIEW     Home (iso) / Front / Top / Right / Left / Back, 🖐 Orbit (drag the body round)
 *     EXPORT   STL, glTF (.glb), STEP (OpenCascade), → Timeline (a 3D layer there)
 *   The 🧊 Body tab (Properties): the FEATURES in order - ☑ on / off (suppress), double-click / ✎ = edit, ✕ delete,
 *   ↑ ↓ reorder; errors in red; the parameters; the view (turn / tilt / roll) and the look (colour, metal, rough, edges).
 *   2.494.0 (Tim: "add orbit and pan viewport like fusion 360 does / select shape to extrude, revolve like fusion 360 does"):
 *     the VIEWPORT - Shift + middle-drag = orbit the picked body, middle-drag = pan, the wheel = zoom (as before); the
 *     VIEW CUBE (top right while a body is picked): click a face = that view, a corner = the view from that corner, drag
 *     it = orbit; under it Home · Orbit · Pan · Fit. PICK THE PROFILE: Extrude / Revolve on a sketch with more than one
 *     closed region -> click the regions on the canvas (they light up; again = off), Enter / ✓ = the settings; regions
 *     already picked with Sketch Select (their lines) are taken as they are.
 * Pure (Node: scripts/test-pcbody.js): rotM(view), projBox(mesh, view, k, pad), reanchor(quad, w0, h0, a0, w1, h1, a1),
 *   VIEWS, featureLabel(f), CUBE_FACES, cubeFaces(view, size), cornerView(sx, sy, sz).
 */
(function (root) {
  "use strict";
  const VIEWS = { home: { yaw: -35, pitch: 25, roll: 0 }, front: { yaw: 0, pitch: 0, roll: 0 }, back: { yaw: 180, pitch: 0, roll: 0 }, top: { yaw: 0, pitch: 90, roll: 0 },
    bottom: { yaw: 0, pitch: -90, roll: 0 }, right: { yaw: -90, pitch: 0, roll: 0 }, left: { yaw: 90, pitch: 0, roll: 0 } };
  /** three.js Euler "XYZ" (pitch about X, yaw about Y, roll about Z) as a 3 x 3 matrix (rows) */
  function rotM(v) {
    const r = (d) => ((d || 0) * Math.PI) / 180, a = r(v.pitch), b = r(v.yaw), c = r(v.roll);
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
    return [[cb * cc, -cb * sc, sb], [ca * sc + sa * sb * cc, ca * cc - sa * sb * sc, -sa * cb], [sa * sc - ca * sb * cc, sa * cc + ca * sb * sc, ca * cb]];
  }
  /** the body's picture box when drawn with `view` at k px per unit: {w, h, ox, oy} (ox / oy = the model origin) */
  function projBox(m, view, k, pad) {
    const R = rotM(view), V = m.vertices; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < V.length; i += 3) {
      const x = R[0][0] * V[i] + R[0][1] * V[i + 1] + R[0][2] * V[i + 2], y = R[1][0] * V[i] + R[1][1] * V[i + 1] + R[1][2] * V[i + 2];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (!Number.isFinite(x0)) { x0 = y0 = -1; x1 = y1 = 1; }
    const p = pad == null ? 6 : pad;
    return { w: Math.max(2, Math.ceil((x1 - x0) * k + 2 * p)), h: Math.max(2, Math.ceil((y1 - y0) * k + 2 * p)), ox: -x0 * k + p, oy: y1 * k + p };
  }
  /** the smart object's quad after its picture changed size: the model origin stays where it is on the canvas, the
   *  same scale and turn (a parallelogram); a perspective quad is kept as it is */
  function reanchor(q, w0, h0, a0, w1, h1, a1) {
    const isPar = Math.abs((q[1][0] - q[0][0]) - (q[2][0] - q[3][0])) < 0.01 && Math.abs((q[1][1] - q[0][1]) - (q[2][1] - q[3][1])) < 0.01;
    if (!isPar) return q;
    const u = [(q[1][0] - q[0][0]) / w0, (q[1][1] - q[0][1]) / w0], v = [(q[3][0] - q[0][0]) / h0, (q[3][1] - q[0][1]) / h0];
    const O = [q[0][0] + u[0] * a0[0] + v[0] * a0[1], q[0][1] + u[1] * a0[0] + v[1] * a0[1]];
    const T = [O[0] - u[0] * a1[0] - v[0] * a1[1], O[1] - u[1] * a1[0] - v[1] * a1[1]];
    return [T, [T[0] + u[0] * w1, T[1] + u[1] * w1], [T[0] + u[0] * w1 + v[0] * h1, T[1] + u[1] * w1 + v[1] * h1], [T[0] + v[0] * h1, T[1] + v[1] * h1]];
  }
  const ICON = { extrude: "⬆", revolve: "↻", fillet: "◜", chamfer: "◺", split: "⫽", shell: "▢" };
  function featureLabel(f) {
    const m = f.mode && f.mode !== "join" ? " · " + { new: "New Body", cut: "Cut", intersect: "Intersect" }[f.mode] : "";
    if (f.type === "extrude") return `${ICON.extrude} ${f.name} - ${f.dist}${f.dir === "sym" ? " ⇕" : f.dir === "two" ? " / " + f.dist2 : ""}${m}`;
    if (f.type === "revolve") return `${ICON.revolve} ${f.name} - ${f.angle}° round ${f.axis === "x" || f.axis === "y" ? f.axis.toUpperCase() : "a line"}${m}`;
    if (f.type === "fillet") return `${ICON.fillet} ${f.name} - r ${f.radius} (${f.edges})`;
    if (f.type === "chamfer") return `${ICON.chamfer} ${f.name} - ${f.dist} (${f.edges})`;
    if (f.type === "split") return `${ICON.split} ${f.name} - ${f.plane} at ${f.offset} (${f.keep === "neg" ? "the − side" : "the + side"})`;
    if (f.type === "shell") return `${ICON.shell} ${f.name} - ${f.thick} (open ${f.face})`;
    return f.name;
  }
  /** 2.494.0: the view cube's faces (the VIEWS names) - outward normal + the face's two edge directions */
  const CUBE_FACES = [["front", [0, 0, 1], [1, 0, 0], [0, 1, 0]], ["back", [0, 0, -1], [-1, 0, 0], [0, 1, 0]], ["right", [1, 0, 0], [0, 0, -1], [0, 1, 0]],
    ["left", [-1, 0, 0], [0, 0, 1], [0, 1, 0]], ["top", [0, 1, 0], [1, 0, 0], [0, 0, -1]], ["bottom", [0, -1, 0], [1, 0, 0], [0, 0, 1]]];
  /** the faces turned toward the viewer, back to front: [{name, pts: [[x, y] x 4], z}] (y down, centre at size / 2) */
  function cubeFaces(view, size) {
    const R = rotM(view), h = size / 2, sc = size * 0.27;
    const tr = (p) => [R[0][0] * p[0] + R[0][1] * p[1] + R[0][2] * p[2], R[1][0] * p[0] + R[1][1] * p[1] + R[1][2] * p[2], R[2][0] * p[0] + R[2][1] * p[1] + R[2][2] * p[2]];
    const out = [];
    for (const [name, n, u, v] of CUBE_FACES) {
      const nz = tr(n)[2]; if (nz <= 1e-6) continue;
      const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => { const q = tr([n[0] + a * u[0] + b * v[0], n[1] + a * u[1] + b * v[1], n[2] + a * u[2] + b * v[2]]); return [h + q[0] * sc, h - q[1] * sc]; });
      out.push({ name, pts, z: nz });
    }
    return out.sort((a, b) => a.z - b.z);
  }
  /** the view looking at the cube from a corner (sx, sy, sz = +-1: right / top / front) -> {yaw, pitch, roll} */
  function cornerView(sx, sy, sz) {
    const yaw = Math.round(Math.atan2(-sx, sz) * 180 / Math.PI), pitch = Math.round(Math.atan2(sy, Math.SQRT2) * 180 / Math.PI);
    return { yaw: sz < 0 && sx === 0 ? 180 : yaw, pitch, roll: 0 };
  }
  const pure = { VIEWS, rotM, projBox, reanchor, featureLabel, ICON, CUBE_FACES, cubeFaces, cornerView };

  function install(E) {
    const { S, doc, say, store, kx } = E, SM = root.PCSmart, X = root.PCMesh, BD = () => root.Body3D, K = () => root.PCSketch;
    if (!SM || !X || !E.stage) return;
    const $ = (id) => doc.getElementById(id);
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const isBody = (L) => !!(L && L.type === "smart" && L.smart && L.smart.body);
    const curBody = () => { const L = S.w ? E.layer() : null; return isBody(L) ? L : null; };
    const sketches = () => S.layers.filter((L) => L.type === "sketch" && L.sketch);
    const bodies = () => S.layers.filter(isBody);
    const byId = (id) => S.layers.find((L) => String(L.id) === String(id)) || null;
    const meshes = new Map();                 // layer id -> {key, mesh, errors, warnings}
    let pending = 0;                                  // new bodies being built
    const busy = new Set(), failed = new Map();     // layer id -> the key that would not build (not tried again until it changes)
    let lastErr = "";
    const clone = (o) => JSON.parse(JSON.stringify(o));
    /** a sketch for a feature: the live sketch layer, else the copy kept when the body was last built */
    const sketchFor = (body) => (id) => { const L = byId(id); if (L && L.type === "sketch" && L.sketch) return L.sketch; return body.snap && body.snap[id] ? body.snap[id] : null; };
    const sketchKey = (body) => JSON.stringify((body.features || []).filter((f) => f.sketch != null).map((f) => { const s = sketchFor(body)(f.sketch); return s ? [s.pts, s.ents, s.origin] : null; }));
    const keyOf = (body) => JSON.stringify([body.params, body.features]) + sketchKey(body);
    async function three() { if (!root.H3M3D || !root.H3M3D.load) throw new Error("the 3D renderer (static/m3d.js) is not loaded"); return root.H3M3D.load(); }

    /** plan + build (the engine chosen in Settings ▸ 3D) -> {mesh, errors, warnings} */
    async function buildBody(body) {
      const B = BD(); if (!B) throw new Error("static/body3d.js is not loaded");
      const pl = B.plan(body, sketchFor(body), K());
      if (!pl.job.ops.length) { const e = new Error(pl.errors.length ? pl.errors.map((x) => x.msg).join("; ") : "no features"); e.errors = pl.errors; throw e; }
      const mesh = await B.build(pl.job);
      return { mesh, errors: pl.errors, warnings: mesh.warnings || [] };
    }
    /** the body's picture (from its mesh) -> {canvas, w, h, anchor} */
    async function picture(body, mesh) {
      const T = await three(), B = BD(), k = body.k || 2, box = projBox(mesh, body.view, k, 6);
      const lk = body.look || {};
      const cv = B.render(T, mesh, { w: box.w, h: box.h, view: body.view, place: { x: box.ox, y: box.oy, scale: k }, color: lk.color, metal: lk.metal, rough: lk.rough, edges: lk.edges !== false, edgeColor: lk.edgeColor, edgeLines: mesh.edgeLines });
      const c = doc.createElement("canvas"); c.width = box.w; c.height = box.h; c.getContext("2d").drawImage(cv, 0, 0);
      return { canvas: c, w: box.w, h: box.h, anchor: [box.ox, box.oy] };
    }
    function keepSnaps(body) { body.snap = {}; for (const f of body.features || []) if (f.sketch != null) { const s = sketchFor(body)(f.sketch); if (s) body.snap[f.sketch] = clone(s); } }
    /** put a new picture on the layer (inside a struct op or not) */
    function applyPic(L, body, pic) {
      const sm = L.smart, a0 = (sm.body && sm.body.anchor) || [sm.w / 2, sm.h / 2];
      const id = SM.addSource(pic.canvas, null);
      if (sm.t && sm.t.quad && !sm.t.warp) sm.t.quad = reanchor(sm.t.quad, sm.w, sm.h, a0, pic.w, pic.h, pic.anchor);
      sm.src = id; sm.w = pic.w; sm.h = pic.h;
      body.anchor = pic.anchor; sm.body = body;
      SM.render(L); L.ver = (L.ver || 0) + 1;
    }
    /** change a body: the new body built, then one undo step */
    async function commit(L, body, label) {
      if (busy.has(L.id)) return say("3D: still building - one moment");
      busy.add(L.id); paintTab("building…");
      try {
        const r = await buildBody(body), pic = await picture(body, r.mesh);
        keepSnaps(body); body.built = keyOf(body);
        meshes.set(L.id, { key: keyOf(body), mesh: r.mesh, errors: r.errors, warnings: r.warnings });
        E.structOp(label, () => applyPic(L, body, pic));
        E.refresh(); E.renderLayersPanel(); pushSoon(L);
        lastErr = r.errors.concat(r.warnings).map((x) => x.msg).join("; ");
        say(`${label}: ${r.mesh.engine === "blender" ? "Blender" : "OpenCascade"} - ${Math.round(r.mesh.ms)} ms${lastErr ? " · " + lastErr : ""}`);
        return true;
      } catch (e) { lastErr = e.message; say("3D body: " + e.message); return false; }
      finally { busy.delete(L.id); paintTab(); }
    }
    /** a new body layer (above `after`) built from `body` */
    async function newBodyLayer(body, name, at, after) {
      if (!S.w) return say("open or make a picture first");
      pending++; paintTab("building…");
      try {
        const r = await buildBody(body), pic = await picture(body, r.mesh);
        keepSnaps(body); body.anchor = pic.anchor; body.built = keyOf(body);
        let L = null;
        const id = SM.addSource(pic.canvas, null), k = body.k || 2;
        E.structOp("new body", () => {
          L = E.makeLayer(name, S.w, S.h, "smart");
          const x = at[0] - pic.anchor[0] / k, y = at[1] - pic.anchor[1] / k;
          L.smart = { src: id, w: pic.w, h: pic.h, t: { quad: X.rectQuad(x, y, pic.w / k, pic.h / k), warp: null }, filters: [], body };
          const i = after ? S.layers.indexOf(after) + 1 : S.layers.length; S.layers.splice(i, 0, L); S.active = S.layers.indexOf(L);
          SM.render(L);
        });
        meshes.set(L.id, { key: keyOf(body), mesh: r.mesh, errors: r.errors, warnings: r.warnings });
        E.refresh(); E.renderLayersPanel();
        lastErr = r.errors.concat(r.warnings).map((x) => x.msg).join("; ");
        say(`${name}: a 3D body (${r.mesh.engine === "blender" ? "Blender" : "OpenCascade"}, ${Math.round(r.mesh.ms)} ms)${lastErr ? " · " + lastErr : ""} - the 🧊 Body tab has its features`);
        if (S.tool !== "move" && E.setTool) E.setTool("move");             // the work moves on from the sketch (the body picked)
        if (E.ui.showTab) E.ui.showTab("kbody");
        return L;
      } catch (e) { lastErr = e.message; say("3D body: " + e.message); return null; }
      finally { pending--; }
    }
    /** drawn again (the view / the look), no rebuild */
    async function redraw(L, body, label, quiet) {
      const m = meshes.get(L.id);
      if (!m || m.key !== keyOf(body)) return commit(L, body, label);
      const pic = await picture(body, m.mesh);
      if (quiet) { applyPic(L, body, pic); E.refresh(); return true; }
      E.structOp(label, () => applyPic(L, body, pic)); E.refresh(); return true;
    }
    /** a sketch changed (or an undo brought back another body): built again, quietly (no undo step - it follows) */
    let checkT = 0;
    function scheduleCheck() { root.clearTimeout(checkT); checkT = root.setTimeout(checkAll, 350); }
    async function checkAll() {
      for (const L of bodies()) {
        const body = L.smart.body, m = meshes.get(L.id), key = keyOf(body);
        if (m && m.key === key) continue;
        if (!m && body.built === key) continue;             // opened from a file: its picture is right
        if (busy.has(L.id) || failed.get(L.id) === key) continue;
        busy.add(L.id);
        try {
          const r = await buildBody(body), b2 = clone(body), pic = await picture(b2, r.mesh);
          keepSnaps(b2); b2.built = key;
          meshes.set(L.id, { key, mesh: r.mesh, errors: r.errors, warnings: r.warnings });
          if (S.layers.includes(L)) { applyPic(L, b2, pic); E.refresh(); pushSoon(L); }
        } catch (e) { lastErr = e.message; failed.set(L.id, key); }
        finally { busy.delete(L.id); }
      }
      paintTab();
    }
    if (E.onPush) { const prev = E.onPush; E.onPush = function (e) { try { if (prev) prev.apply(this, arguments); } finally { scheduleCheck(); } }; } else E.onPush = () => scheduleCheck();
    E.overlayHooks.push(() => { if (bodies().length) scheduleCheck(); });

    /* ================================ the dialogs ================================ */
    const B0 = () => BD();
    const opt = (v, cur, label) => `<option value="${esc(v)}"${String(v) === String(cur) ? " selected" : ""}>${esc(label)}</option>`;
    function profilesHtml(sk, cur) {
      if (!sk) return '<span class="hint">-</span>';
      const all = K().profiles(sk, { withPaths: false }), sel = cur === "all" || cur == null ? null : [].concat(cur).map(Number);
      const holes = new Set(); for (const q of all) for (const h of q.holes || []) holes.add(h);
      return `<label><input type="radio" name="bdPr" value="all"${sel ? "" : " checked"}> All closed profiles (${all.filter((q) => !holes.has(q)).length}${holes.size ? ", holes cut out" : ""})</label>`
        + `<label><input type="radio" name="bdPr" value="some"${sel ? " checked" : ""}> These: </label>` + all.map((p, i) => `<label class="bdpc"><input type="checkbox" data-pi="${i}"${sel && sel.includes(i) ? " checked" : ""}> ${i + 1} <span class="hint">(${Math.round(p.area)} px²)</span></label>`).join("");
    }
    const readProfiles = (d) => (d.querySelector('input[name="bdPr"][value="some"]') && d.querySelector('input[name="bdPr"][value="some"]').checked ? [...d.querySelectorAll("[data-pi]")].filter((x) => x.checked).map((x) => +x.dataset.pi) : "all");
    function axisOpts(sk, cur) {
      let h = opt("x", cur, "the sketch's X axis (across)") + opt("y", cur, "the sketch's Y axis (up)");
      if (sk) for (const e of sk.ents) if (e.t === "line" && !e.axis) h += opt(e.id, cur, `line ${e.id}${e.cons ? " (construction)" : ""}`);
      return h;
    }
    const exprRow = (id, label, v, hint) => `<div class="rw"><span>${label}</span><input type="text" id="${id}" value="${esc(v)}" spellcheck="false" style="width:120px"><span class="hint" id="${id}V"></span>${hint ? `<span class="hint">${hint}</span>` : ""}</div>`;
    function liveValues(d, body) {
      const vals = B0().resolveParams(body.params).values;
      d.querySelectorAll('input[type="text"]').forEach((inp) => {
        const out = d.querySelector("#" + inp.id + "V"); if (!out) return;
        const upd = () => { try { out.textContent = "= " + (Math.round(B0().expr(inp.value, vals) * 1000) / 1000); out.style.color = ""; } catch (e) { out.textContent = e.message; out.style.color = "#e5534b"; } };
        inp.addEventListener("input", upd); upd();
      });
    }
    const paramHint = (body) => (body.params.length ? "parameters: " + body.params.map((p) => p.name).join(", ") : "numbers or sums (2 * 10 + 5, 1 in, 30 deg); ƒx Parameters makes names");
    /** Extrude / Revolve: f = the feature (edit) or null (new); L = the body layer (edit / join) or null */
    function sketchDialog(type, L0, f0, pre) {
      const sks = sketches(); if (!sks.length) return say(`${type === "extrude" ? "Extrude" : "Revolve"}: draw a sketch first (SKETCH ▸ Create Sketch) - a closed shape`);
      const A = E.layer(), Lb = L0 || (isBody(A) ? A : null), body = Lb ? Lb.smart.body : B0().newBody();
      const f = f0 ? clone(f0) : B0().normFeature(Object.assign({ type, sketch: (pre && pre.sketch != null ? byId(pre.sketch) || A : A && A.type === "sketch" ? A : sks[sks.length - 1]).id, mode: Lb ? "join" : "new" }, pre && pre.profiles != null ? { profiles: pre.profiles } : {}));
      const bl = bodies(), isFirst = Lb && body.features.findIndex((x) => x.id === f.id) === 0;
      const html = `<div class="rw"><span>Sketch</span><select id="bdSk">${sks.map((s) => opt(s.id, f.sketch, s.name)).join("")}</select></div>`
        + `<div class="rw" style="flex-wrap:wrap" id="bdPrs"></div>`
        + (type === "extrude"
          ? exprRow("bdD", "Distance", f.dist, "") + `<div class="rw"><span>Direction</span><select id="bdDir">${opt("one", f.dir, "One side")}${opt("sym", f.dir, "Symmetric")}${opt("two", f.dir, "Two sides")}</select></div>` + exprRow("bdD2", "Other side", f.dist2, "(two sides)")
          : `<div class="rw"><span>Axis</span><select id="bdAx"></select></div>` + exprRow("bdA", "Angle (°)", f.angle, ""))
        + exprRow("bdZ", "Start offset (Z)", f.z, "")
        + (f0 ? (isFirst ? "" : `<div class="rw"><span>Operation</span><select id="bdOp">${opt("join", f.mode, "Join")}${opt("cut", f.mode, "Cut")}${opt("intersect", f.mode, "Intersect")}</select></div>`)
          : `<div class="rw"><span>Operation</span><select id="bdOp">${opt("new", Lb ? "join" : "new", "New Body (a new layer)")}${bl.length ? opt("join", Lb ? "join" : "", "Join") + opt("cut", "", "Cut") + opt("intersect", "", "Intersect") : ""}</select>`
            + (bl.length ? `<select id="bdTgt" title="Into which body">${bl.map((b) => opt(b.id, (Lb || bl[bl.length - 1]).id, b.name)).join("")}</select>` : "") + "</div>")
        + `<div class="hint" style="padding:2px 10px">${esc(paramHint(body))}</div>`;
      E.ui.dialog(f0 ? `Edit ${f.name}` : type === "extrude" ? "Extrude" : "Revolve", html, (d) => {
        const q = (id) => d.querySelector("#" + id);
        f.sketch = +q("bdSk").value || q("bdSk").value; f.profiles = readProfiles(d); f.z = q("bdZ").value;
        if (type === "extrude") { f.dist = q("bdD").value; f.dir = q("bdDir").value; f.dist2 = q("bdD2").value; }
        else { f.axis = q("bdAx").value; f.angle = q("bdA").value; }
        const op = q("bdOp") ? q("bdOp").value : f.mode;
        if (f0) { const b2 = clone(Lb.smart.body); const i = b2.features.findIndex((x) => x.id === f.id); f.mode = op; b2.features[i] = f; commit(Lb, b2, "edit " + f.name.toLowerCase()); return; }
        if (op === "new" || !bl.length) {
          const b2 = B0().newBody(); f.mode = "new"; f.name = type === "extrude" ? "Extrude1" : "Revolve1"; b2.features.push(f);
          const skL = byId(f.sketch), o = skL && K().pt(skL.sketch, skL.sketch.origin.pt);
          newBodyLayer(b2, nextName(), o ? [o.x, o.y] : [S.w / 2, S.h / 2], skL || null).then((L) => { if (L && skL && store.get("body.hideSketch", true) !== false) { skL.visible = false; E.refresh(); E.renderLayersPanel(); } });
          return;
        }
        const T = byId(q("bdTgt") ? q("bdTgt").value : (Lb || bl[bl.length - 1]).id) || bl[bl.length - 1], b2 = clone(T.smart.body);
        f.mode = op; f.name = uniqueName(b2, type === "extrude" ? "Extrude" : "Revolve"); b2.features.push(f);
        commit(T, b2, type + " " + op);
      }, { okLabel: "OK", init: (d) => {
        const q = (id) => d.querySelector("#" + id);
        const fill = () => { const s = byId(q("bdSk").value); q("bdPrs").innerHTML = profilesHtml(s && s.sketch, f.profiles); if (q("bdAx")) q("bdAx").innerHTML = axisOpts(s && s.sketch, f.axis); };
        q("bdSk").onchange = fill; fill(); liveValues(d, body);
      } });
    }
    const uniqueName = (body, base) => { let n = 1; while (body.features.some((x) => x.name === base + n)) n++; return base + n; };
    const nextName = () => { let n = 1; while (S.layers.some((L) => L.name === "Body" + n)) n++; return "Body" + n; };
    const needBody = (what) => { const L = curBody(); if (!L) say(`${what}: pick a body layer first (Extrude or Revolve a sketch to make one)`); return L; };
    function edgeDialog(type, L0, f0) {
      const L = L0 || needBody(type === "fillet" ? "Fillet" : "Chamfer"); if (!L) return;
      const body = L.smart.body, f = f0 ? clone(f0) : B0().normFeature({ type });
      const k = type === "fillet" ? "radius" : "dist";
      E.ui.dialog(f0 ? `Edit ${f.name}` : type === "fillet" ? "Fillet" : "Chamfer",
        exprRow("bdR", type === "fillet" ? "Radius" : "Distance", f[k], "")
        + `<div class="rw"><span>Edges</span><select id="bdE">${opt("all", f.edges, "All sharp edges")}${opt("top", f.edges, "Top (the far end, Z max)")}${opt("bottom", f.edges, "Bottom (Z min)")}${opt("vertical", f.edges, "Vertical (along Z)")}${opt("horizontal", f.edges, "Round the faces (not along Z)")}</select></div>`
        + `<div class="hint" style="padding:2px 10px">${esc(paramHint(body))}</div>`, (d) => {
        f[k] = d.querySelector("#bdR").value; f.edges = d.querySelector("#bdE").value;
        const b2 = clone(body); if (f0) b2.features[b2.features.findIndex((x) => x.id === f.id)] = f; else { f.name = uniqueName(b2, type === "fillet" ? "Fillet" : "Chamfer"); b2.features.push(f); }
        commit(L, b2, (f0 ? "edit " : "") + type);
      }, { init: (d) => liveValues(d, body) });
    }
    function shellDialog(L0, f0) {
      const L = L0 || needBody("Shell"); if (!L) return;
      const body = L.smart.body, f = f0 ? clone(f0) : B0().normFeature({ type: "shell" });
      E.ui.dialog(f0 ? `Edit ${f.name}` : "Shell", exprRow("bdT", "Thickness", f.thick, "") + `<div class="rw"><span>Open face</span><select id="bdF">${opt("top", f.face, "Top (Z max)")}${opt("bottom", f.face, "Bottom (Z min)")}</select></div>`, (d) => {
        f.thick = d.querySelector("#bdT").value; f.face = d.querySelector("#bdF").value;
        const b2 = clone(body); if (f0) b2.features[b2.features.findIndex((x) => x.id === f.id)] = f; else { f.name = uniqueName(b2, "Shell"); b2.features.push(f); }
        commit(L, b2, (f0 ? "edit " : "") + "shell");
      }, { init: (d) => liveValues(d, body) });
    }
    /** Split Body: this layer keeps one side; the other side = a new body layer (both stay parametric) */
    function splitDialog(L0, f0) {
      const L = L0 || needBody("Split Body"); if (!L) return;
      const body = L.smart.body, f = f0 ? clone(f0) : B0().normFeature({ type: "split" });
      E.ui.dialog(f0 ? `Edit ${f.name}` : "Split Body", `<div class="rw"><span>Plane</span><select id="bdP">${opt("XY", f.plane, "XY (across Z)")}${opt("XZ", f.plane, "XZ (across Y)")}${opt("YZ", f.plane, "YZ (across X)")}</select></div>`
        + exprRow("bdO", "At", f.offset, "") + `<div class="rw"><span>This layer keeps</span><select id="bdK">${opt("pos", f.keep, "the + side")}${opt("neg", f.keep, "the − side")}</select></div>`
        + (f0 ? "" : '<label class="rw"><input type="checkbox" id="bdNew" checked> the other side becomes a new body layer</label>'), (d) => {
        f.plane = d.querySelector("#bdP").value; f.offset = d.querySelector("#bdO").value; f.keep = d.querySelector("#bdK").value;
        const b2 = clone(body); if (f0) { b2.features[b2.features.findIndex((x) => x.id === f.id)] = f; commit(L, b2, "edit split"); return; }
        f.name = uniqueName(b2, "Split"); b2.features.push(f);
        const other = d.querySelector("#bdNew") && d.querySelector("#bdNew").checked;
        commit(L, b2, "split body").then((ok) => {
          if (!ok || !other) return;
          const b3 = clone(body), g = Object.assign({}, f, { id: undefined, keep: f.keep === "pos" ? "neg" : "pos" }); b3.features.push(B0().normFeature(g));
          const q = L.smart.t.quad, u = [(q[1][0] - q[0][0]) / L.smart.w, (q[1][1] - q[0][1]) / L.smart.w], v = [(q[3][0] - q[0][0]) / L.smart.h, (q[3][1] - q[0][1]) / L.smart.h], a = L.smart.body.anchor;
          const O = [q[0][0] + u[0] * a[0] + v[0] * a[1], q[0][1] + u[1] * a[0] + v[1] * a[1]];
          b3.k = L.smart.body.k; b3.view = clone(L.smart.body.view); b3.look = clone(L.smart.body.look);
          newBodyLayer(b3, L.name + " (2)", O, L);
        });
      }, { init: (d) => liveValues(d, body) });
    }
    /** ƒx Change Parameters: name = expression (each may use the others) */
    function paramsDialog(L0) {
      const L = L0 || needBody("Parameters"); if (!L) return;
      const body = L.smart.body; let rows = clone(body.params);
      const draw = (d) => {
        const r = B0().resolveParams(rows), host = d.querySelector("#bdPar");
        host.innerHTML = rows.map((p, i) => `<div class="rw"><input type="text" data-n="${i}" value="${esc(p.name)}" style="width:90px" spellcheck="false"> = <input type="text" data-e="${i}" value="${esc(p.expr)}" style="width:130px" spellcheck="false">`
          + `<span class="hint" style="min-width:70px;${r.errors[p.name] ? "color:#e5534b" : ""}">${r.errors[p.name] ? esc(r.errors[p.name]) : "= " + (Math.round(r.values[p.name] * 1000) / 1000)}</span><button class="ghost" data-x="${i}" title="Remove">✕</button></div>`).join("")
          + '<button class="ghost" id="bdParAdd">＋ Parameter</button>';
        host.querySelectorAll("[data-n]").forEach((x) => { x.onchange = () => { rows[+x.dataset.n].name = x.value.trim(); draw(d); }; });
        host.querySelectorAll("[data-e]").forEach((x) => { x.onchange = () => { rows[+x.dataset.e].expr = x.value; draw(d); }; });
        host.querySelectorAll("[data-x]").forEach((x) => { x.onclick = () => { rows.splice(+x.dataset.x, 1); draw(d); }; });
        host.querySelector("#bdParAdd").onclick = () => { let n = 1; while (rows.some((p) => p.name === "d" + n)) n++; rows.push({ name: "d" + n, expr: "10" }); draw(d); };
      };
      E.ui.dialog("Change Parameters - " + L.name, '<div class="hint" style="padding:2px 0 6px">Use the names in any feature\'s numbers (Distance = <b>depth</b>, Radius = <b>depth / 10</b>…); change one here and the body follows.</div><div id="bdPar"></div>', () => {
        rows.forEach((x) => { x.name = String(x.name || "").trim(); x.expr = String(x.expr == null ? "" : x.expr); });
        const r = B0().resolveParams(rows); if (Object.keys(r.errors).length) { say("Parameters: " + Object.entries(r.errors).map(([n, m]) => n + ": " + m).join("; ")); return false; }
        const b2 = clone(body); b2.params = rows.filter((x) => x.name); commit(L, b2, "change parameters");
      }, { wide: true, init: draw });
    }
    function editFeature(L, f) {
      if (f.type === "extrude" || f.type === "revolve") return sketchDialog(f.type, L, f);
      if (f.type === "fillet" || f.type === "chamfer") return edgeDialog(f.type, L, f);
      if (f.type === "split") return splitDialog(L, f);
      if (f.type === "shell") return shellDialog(L, f);
    }
    /* ---- view / look */
    function setView(v, L0) { const L = L0 || needBody("View"); if (!L) return; const b2 = clone(L.smart.body); b2.view = Object.assign({}, v); return redraw(L, b2, "body view"); }
    function setLook(o, L0) { const L = L0 || curBody(); if (!L) return; const b2 = clone(L.smart.body); b2.look = Object.assign({}, b2.look, o); return redraw(L, b2, "body look"); }
    /* ---- 🖐 orbit: drag on the body turns it (Shift = roll) */
    let orbitOn = false, orb = null;
    E.stage.addEventListener("pointerdown", (e) => {
      const mid = e.button === 1 && e.shiftKey;                // 2.494.0: Shift + middle-drag = orbit (any tool)
      if (!mid && (!orbitOn || e.button !== 0 || S.tool !== "move")) return;
      const L = curBody(); if (!L) return;
      e.stopImmediatePropagation(); e.preventDefault();
      const sm = L.smart;
      startOrbit(L, e, mid, E.stage);
    }, true);
    function startOrbit(L, e, mid, el) {
      const sm = L.smart;
      orb = { L, x: e.clientX, y: e.clientY, v0: Object.assign({}, sm.body.view), body0: clone(sm.body), sm0: { src: sm.src, w: sm.w, h: sm.h, quad: clone(sm.t.quad) }, t: 0, mid };
      try { el.setPointerCapture(e.pointerId); } catch (er) { /* fine */ }
    }
    function orbitMove(e) {
      if (!orb) return false;
      const dx = e.clientX - orb.x, dy = e.clientY - orb.y, v = orb.L.smart.body.view;
      if (e.shiftKey && !orb.mid) v.roll = Math.round(orb.v0.roll + dx * 0.5); else { v.yaw = Math.round(orb.v0.yaw + dx * 0.5); v.pitch = Math.max(-90, Math.min(90, Math.round(orb.v0.pitch + dy * 0.5))); }
      if (!orb.t) orb.t = root.setTimeout(() => { if (!orb) return; orb.t = 0; const L = orb.L; redraw(L, L.smart.body, "", true); paintCube(); }, 30);
      paintCube();
      return true;
    }
    function orbitEnd() {
      if (!orb) return; const o = orb; orb = null; root.clearTimeout(o.t);
      const after = clone(o.L.smart.body), sm = o.L.smart;
      if (JSON.stringify(after.view) === JSON.stringify(o.body0.view)) { sm.body = o.body0; return; }
      sm.body = o.body0; sm.src = o.sm0.src; sm.w = o.sm0.w; sm.h = o.sm0.h; sm.t.quad = o.sm0.quad;   // as it was: the drag = one undo step
      redraw(o.L, after, "body view");
    }
    E.stage.addEventListener("pointermove", (e) => { orbitMove(e); });
    E.stage.addEventListener("pointerup", orbitEnd);
    E.stage.addEventListener("auxclick", (e) => { if (e.button === 1 && e.shiftKey && curBody()) e.preventDefault(); });

    /* ---- 2.494.0: the VIEW CUBE + the navigation buttons (top right of the canvas while a body is picked) */
    const CUBE = 96, cube = doc.createElement("div"); cube.id = "bdCube"; cube.style.display = "none";
    cube.innerHTML = `<canvas width="${CUBE * 2}" height="${CUBE * 2}" style="width:${CUBE}px;height:${CUBE}px;cursor:pointer;display:block" title="Click a face = that view · a corner = the view from it · drag = orbit"></canvas>`
      + '<div class="bdnav"><button type="button" class="ghost" data-nav="home" title="Home (the corner view)">⌂</button><button type="button" class="ghost" data-nav="orbit" title="Orbit: drag the body (or Shift + middle-drag, any time)">⟳</button>'
      + '<button type="button" class="ghost" data-nav="pan" title="Pan: the Hand tool (or middle-drag, any time)">✋</button><button type="button" class="ghost" data-nav="fit" title="Fit the picture on the screen (the wheel zooms)">⤢</button></div>';
    const cubeCss = doc.createElement("style");
    cubeCss.textContent = "#bdCube{position:absolute;z-index:7;user-select:none;pointer-events:auto}#bdCube .bdnav{display:flex;gap:2px;justify-content:center;margin-top:2px}#bdCube .bdnav button{min-width:0;width:22px;height:20px;padding:0;font-size:12px;background:rgba(30,28,25,.75)}"
      + "#bdCube .bdnav button.on{border-color:var(--pc-accent,#f59e2c);color:var(--pc-accent,#f59e2c)}";
    doc.head.appendChild(cubeCss);
    kx.appendChild(cube);
    const cv = cube.querySelector("canvas");
    let cubeHover = null;
    function paintCube() {
      const L = curBody(), on = !!(L && S.w);
      cube.style.display = on ? "" : "none"; if (!on) return;
      const r = E.stage.getBoundingClientRect(), kr = kx.getBoundingClientRect();
      cube.style.left = Math.round(r.right - kr.left - CUBE - 14) + "px"; cube.style.top = Math.round(r.top - kr.top + 22) + "px";
      const g = cv.getContext("2d"), view = L.smart.body.view; g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, CUBE, CUBE);
      for (const f of cubeFaces(view, CUBE)) {
        g.beginPath(); f.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
        const lit = 0.55 + 0.4 * f.z; g.fillStyle = cubeHover === f.name ? "rgba(38,128,235,0.85)" : `rgba(${Math.round(200 * lit)},${Math.round(205 * lit)},${Math.round(215 * lit)},0.92)`; g.fill();
        g.strokeStyle = "rgba(20,20,20,0.8)"; g.lineWidth = 1; g.stroke();
        if (f.z > 0.25) { const c = f.pts.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]); g.fillStyle = cubeHover === f.name ? "#fff" : "#222"; g.font = `600 ${Math.round(9 + 3 * f.z)}px system-ui,sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(f.name.toUpperCase(), c[0], c[1]); }
      }
      cube.querySelector('[data-nav="orbit"]').classList.toggle("on", orbitOn);
      cube.querySelector('[data-nav="pan"]').classList.toggle("on", S.tool === "hand");
    }
    const inPoly = (p, q) => { let c = false; for (let i = 0, j = q.length - 1; i < q.length; j = i++) if ((q[i][1] > p[1]) !== (q[j][1] > p[1]) && p[0] < (q[j][0] - q[i][0]) * (p[1] - q[i][1]) / (q[j][1] - q[i][1]) + q[i][0]) c = !c; return c; };
    /** what is under (x, y) on the cube: {face} | {corner: [sx, sy, sz]} | null */
    function cubeAt(x, y) {
      const L = curBody(); if (!L) return null;
      const R = rotM(L.smart.body.view), h = CUBE / 2, sc = CUBE * 0.27;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        const p = [sx, sy, sz], z = R[2][0] * sx + R[2][1] * sy + R[2][2] * sz; if (z < 0.2) continue;
        const X = h + (R[0][0] * p[0] + R[0][1] * p[1] + R[0][2] * p[2]) * sc, Y = h - (R[1][0] * p[0] + R[1][1] * p[1] + R[1][2] * p[2]) * sc;
        if (Math.hypot(X - x, Y - y) < 7) return { corner: [sx, sy, sz] };
      }
      const fs = cubeFaces(L.smart.body.view, CUBE).reverse(); for (const f of fs) if (inPoly([x, y], f.pts)) return { face: f.name };
      return null;
    }
    let cubeDown = null;
    cv.addEventListener("pointerdown", (e) => { e.stopPropagation(); e.preventDefault(); const L = curBody(); if (!L) return; const r = cv.getBoundingClientRect(); cubeDown = { x: e.clientX, y: e.clientY, at: cubeAt(e.clientX - r.left, e.clientY - r.top), moved: false }; startOrbit(L, e, true, cv); });
    cv.addEventListener("pointermove", (e) => {
      const r = cv.getBoundingClientRect();
      if (cubeDown) { e.stopPropagation(); if (Math.hypot(e.clientX - cubeDown.x, e.clientY - cubeDown.y) > 3) cubeDown.moved = true; if (cubeDown.moved) orbitMove(e); return; }
      const a = cubeAt(e.clientX - r.left, e.clientY - r.top), hv = a && a.face ? a.face : null; if (hv !== cubeHover) { cubeHover = hv; paintCube(); }
    });
    cv.addEventListener("pointerup", (e) => {
      e.stopPropagation(); const d = cubeDown; cubeDown = null; if (!d) return;
      if (d.moved) { orbitEnd(); return; }
      if (orb) { const o = orb; orb = null; root.clearTimeout(o.t); o.L.smart.body = o.body0; }
      if (d.at && d.at.face) setView(VIEWS[d.at.face]); else if (d.at && d.at.corner) setView(cornerView(...d.at.corner));
    });
    cv.addEventListener("pointerleave", () => { if (cubeHover) { cubeHover = null; paintCube(); } });
    cube.addEventListener("wheel", (e) => e.stopPropagation());
    cube.querySelectorAll("[data-nav]").forEach((b) => {
      b.addEventListener("pointerdown", (e) => e.stopPropagation());
      b.onclick = () => {
        const k = b.dataset.nav;
        if (k === "home") setView(VIEWS.home);
        else if (k === "orbit") { orbitOn = !orbitOn; if (orbitOn && S.tool !== "move") E.setTool("move"); say(orbitOn ? "⟳ Orbit: drag the body to turn it (Shift = roll) - Shift + middle-drag orbits any time" : "Orbit off"); paintTab(); }
        else if (k === "pan") { E.setTool(S.tool === "hand" ? "move" : "hand"); say("✋ Pan: drag the canvas (middle-drag pans any time; the wheel zooms)"); }
        else if (k === "fit" && E.ui.run) E.ui.run("view.fit");
        paintCube();
      };
    });
    E.overlayHooks.push(() => paintCube());
    root.addEventListener("resize", () => paintCube());

    /* ---- 2.494.0: PICK THE PROFILES on the canvas (Extrude / Revolve) */
    let pickP = null;                       // {type, L, list, picked: Set, hover, prev}
    function pickProfiles(type) {
      const A = S.w ? E.layer() : null, sks = sketches();
      if (!sks.length || curBody()) return sketchDialog(type);
      const skL = A && A.type === "sketch" && A.sketch ? A : sks[sks.length - 1];
      const list = K().profiles(skL.sketch, { withPaths: false });
      if (!list.length) return say(`${type === "extrude" ? "Extrude" : "Revolve"}: ${skL.name} has no closed profile - lines / arcs that meet at their points, or circles`);
      const picked = E.sketch && E.sketch.sel ? E.sketch.sel().filter((q) => q.k === "ent").map((q) => q.id) : [];
      const pre = picked.length && skL === A ? K().profilesOfEnts(skL.sketch, picked, list) : [];
      if (pre.length) return sketchDialog(type, null, null, { sketch: skL.id, profiles: pre });
      if (list.length === 1) return sketchDialog(type, null, null, { sketch: skL.id, profiles: "all" });
      pickP = { type, L: skL, list, picked: new Set(), hover: -1, prev: S.tool };
      if (!skL.visible) { skL.visible = true; E.refresh(); E.renderLayersPanel(); }
      E.setTool("bd_profile");
      say(`${type === "extrude" ? "Extrude" : "Revolve"}: click the closed regions to use (again = off) - Enter / ✓ = the settings, Esc = stop`);
      return true;
    }
    function pickDone(ok) {
      const P = pickP; if (!P) return; pickP = null;
      E.setTool(P.prev && !/^sk_/.test(P.prev) && P.prev !== "bd_profile" ? P.prev : "move");
      if (!ok) { say("Pick profiles: stopped"); E.drawOverlay(); return; }
      const pr = [...P.picked].sort((a, b) => a - b);
      sketchDialog(P.type, null, null, { sketch: P.L.id, profiles: pr.length ? pr : "all" });
    }
    const pickInfo = () => (pickP ? `${pickP.picked.size} of ${pickP.list.length} region(s) picked` : "");
    E.tools.bd_profile = {
      id: "bd_profile", name: "Pick Profiles", cursor: "pointer",
      options: () => `<span class="hint">click the closed regions to ${pickP && pickP.type === "revolve" ? "revolve" : "extrude"} (again = off) · Enter / ✓ = the settings · Esc</span><span class="sep"></span><b id="bdPkN">${esc(pickInfo())}</b>`
        + '<button type="button" class="ghost" id="bdPkAll" title="Every closed region">All</button><button type="button" id="bdPkOk" title="On to the settings (Enter)">✓ OK</button><button type="button" class="ghost" id="bdPkNo" title="Stop (Esc)">✕</button>',
      bindOptions(o) {
        const a = o.querySelector("#bdPkAll"); if (a) a.onclick = () => { if (!pickP) return; pickP.picked = new Set(pickP.list.map((_, i) => i).filter((i) => !pickP.list.some((q) => (q.holes || []).includes(pickP.list[i])))); upd(); };
        const k = o.querySelector("#bdPkOk"); if (k) k.onclick = () => pickDone(true);
        const n = o.querySelector("#bdPkNo"); if (n) n.onclick = () => pickDone(false);
      },
      down(e, fx, fy) {
        if (!pickP) { E.setTool("move"); return false; }
        const i = K().profileAt(pickP.L.sketch, fx, fy, pickP.list);
        if (i < 0) { say("Pick profiles: click inside a closed region (Enter / ✓ when done)"); return false; }
        if (pickP.picked.has(i)) pickP.picked.delete(i); else pickP.picked.add(i);
        upd(); return false;
      },
      hover(e, fx, fy) { if (!pickP) return; const i = K().profileAt(pickP.L.sketch, fx, fy, pickP.list); if (i !== pickP.hover) { pickP.hover = i; E.drawOverlay(); } },
      dblclick() { if (pickP && pickP.picked.size) pickDone(true); },
      key(e) { const k = (e.key || "").toLowerCase(); if (k === "enter") { pickDone(true); return true; } if (k === "escape") { pickDone(false); return true; } return false; },
      leave() { if (pickP) { pickP = null; E.drawOverlay(); } },
    };
    function upd() { const n = doc.getElementById("bdPkN"); if (n) n.textContent = pickInfo(); E.drawOverlay(); }
    E.overlayHooks.push((g, px) => {
      if (!pickP || S.tool !== "bd_profile") return;
      const draw = (p, fill) => { g.beginPath(); for (const poly of [p.poly].concat((p.holes || []).map((h) => h.poly))) poly.forEach((q, j) => (j ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.fillStyle = fill; g.fill("evenodd"); };
      g.save();
      pickP.list.forEach((p, i) => { if (pickP.picked.has(i)) draw(p, "rgba(38,128,235,0.45)"); });
      if (pickP.hover >= 0 && !pickP.picked.has(pickP.hover)) draw(pickP.list[pickP.hover], "rgba(38,128,235,0.2)");
      g.strokeStyle = "#2680eb"; g.lineWidth = 1.2 * px; g.setLineDash([4 * px, 3 * px]);
      for (const p of pickP.list) { g.beginPath(); p.poly.forEach((q, j) => (j ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.stroke(); }
      g.restore();
    });
    /* ---- export */
    function meshOf(L) { const m = meshes.get(L.id); return m && m.key === keyOf(L.smart.body) ? m.mesh : null; }
    async function ensureMesh(L) { let m = meshOf(L); if (m) return m; const r = await buildBody(L.smart.body); meshes.set(L.id, { key: keyOf(L.smart.body), mesh: r.mesh, errors: r.errors, warnings: r.warnings }); return r.mesh; }
    async function exportAs(kind, L0) {
      const L = L0 || needBody("Export"); if (!L) return;
      try {
        let blob, name = L.name.replace(/[^\w.-]+/g, "_");
        if (kind === "step") { if (!root.Body3DOCC) throw new Error("STEP needs the OpenCascade engine"); blob = await root.Body3DOCC.step(BD().plan(L.smart.body, sketchFor(L.smart.body), K()).job); name += ".step"; }
        else { const m = await ensureMesh(L); blob = new root.Blob([kind === "stl" ? BD().toSTL(m, L.name) : BD().toGLB(m, { color: L.smart.body.look.color, metal: L.smart.body.look.metal, rough: L.smart.body.look.rough, name: L.name })], { type: kind === "stl" ? "model/stl" : "model/gltf-binary" }); name += kind === "stl" ? ".stl" : ".glb"; }
        const a = doc.createElement("a"); a.href = root.URL.createObjectURL(blob); a.download = name; doc.body.appendChild(a); a.click(); a.remove();
        say(`${name} saved (your downloads)`);
        return { name, size: blob.size };
      } catch (e) { say("Export: " + e.message); return null; }
    }
    /** → Timeline: a .glb into the project's 3D models, a 3D layer at the playhead (ext/timelinedock/m3d.js) */
    async function toTimeline(L0) {
      const L = L0 || needBody("→ Timeline"); if (!L) return;
      try {
        const m = await ensureMesh(L), glb = BD().toGLB(m, { color: L.smart.body.look.color, metal: L.smart.body.look.metal, rough: L.smart.body.look.rough, name: L.name });
        const name = "body_" + L.name.replace(/[^\w-]+/g, "_") + ".glb";
        const r = await fetch("/api/tlcanvas/model?name=" + encodeURIComponent(name), { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: glb });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status);
        if (root.TlM3D && root.TlM3D.add) root.TlM3D.add("model", j.name || name, { x: 0, y: 0 });
        L.smart.body.tl = j.name || name;
        say(`${L.name} → the timeline: a 3D layer of ${j.name || name}`);
        return j.name || name;
      } catch (e) { say("→ Timeline: " + e.message); return null; }
    }
    /** the live link: a body sent to the timeline is sent again (same file) and its 3D layers re-baked */
    async function pushTimeline(L) {
      const name = L.smart.body.tl; if (!name) return 0;
      const m = await ensureMesh(L), glb = BD().toGLB(m, { color: L.smart.body.look.color, metal: L.smart.body.look.metal, rough: L.smart.body.look.rough, name: L.name });
      const r = await fetch("/api/tlcanvas/model?name=" + encodeURIComponent(name), { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: glb });
      if (!r.ok) return 0;
      return root.TlBody && root.TlBody.reload ? root.TlBody.reload(name) : 0;
    }
    const tlTimers = new Map();
    function pushSoon(L) { if (!L.smart.body.tl) return; root.clearTimeout(tlTimers.get(L.id)); tlTimers.set(L.id, root.setTimeout(() => { pushTimeline(L).catch(() => {}); }, 600)); }
    /* ================================ the 🧊 Body tab ================================ */
    const ctl = kx.querySelector('.pcgrp .pctabs [data-tab="kxCtl"]');
    if (ctl) {
      const tabs = ctl.parentElement, holder = tabs.parentElement;
      const b = doc.createElement("button"); b.type = "button"; b.dataset.tab = "kbody"; b.dataset.grp = "props"; b.textContent = "🧊 Body";
      b.onclick = () => E.ui.showTab("kbody");
      (tabs.querySelector('[data-tab="ksk"]') || ctl).after(b);
      const body = doc.createElement("div"); body.className = "pcbody kxsec"; body.dataset.body = "kbody"; body.id = "kbodyBody"; holder.appendChild(body);
      const css = doc.createElement("style");
      css.textContent = "#kbodyBody{padding:6px 8px;font-size:11px}#kbodyBody .r{display:flex;gap:4px;align-items:center;margin:3px 0;flex-wrap:wrap}#kbodyBody h5{margin:8px 0 2px;font-size:11px}"
        + "#kbodyBody .ft{display:flex;align-items:center;gap:4px;padding:2px 3px;border-radius:3px;cursor:default}#kbodyBody .ft:hover{background:var(--pc-bg)}#kbodyBody .ft.off .nm{opacity:.45;text-decoration:line-through}"
        + "#kbodyBody .ft .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#kbodyBody .ft.err .nm{color:#e5534b}#kbodyBody .ft button{min-width:0;padding:0 4px}#kbodyBody .msg{color:var(--pc-dim);margin-top:4px;min-height:14px}"
        + "#kbodyBody input[type=range]{flex:1;min-width:70px}#kbodyBody .bdv button{min-width:0;padding:1px 5px}.kxdlg .bdpc{margin-right:6px}";
      doc.head.appendChild(css);
      const prev = E.ui.showTab;
      E.ui.showTab = function (id) { const r = prev.apply(this, arguments); if (id === "kbody") paintTab(); return r; };
    }
    function paintTab(msg) {
      const host = $("kbodyBody"); if (!host || !host.classList.contains("on")) return;
      const L = curBody();
      if (!L) { host.innerHTML = '<div class="msg">Pick a body layer - or draw a closed sketch and press SOLID ▸ Extrude / Revolve (the CAD toolbar along the top).</div>'; return; }
      const body = L.smart.body, m = meshes.get(L.id), pl = BD().plan(body, sketchFor(body), K()), bad = new Map(pl.errors.concat((m && m.warnings) || []).map((x) => [x.id, x.msg]));
      const info = m && m.mesh ? BD().meshInfo(m.mesh) : null;
      host.innerHTML = `<div class="r"><b>${esc(L.name)}</b><span class="hint">${info ? `${info.tris} triangles · volume ${Math.round(info.volume)} · ${m.mesh.engine === "blender" ? "Blender" : "OpenCascade"} ${Math.round(m.mesh.ms || 0)} ms` : ""}</span></div>`
        + "<h5>Features</h5>" + body.features.map((f, i) => `<div class="ft${f.off ? " off" : ""}${bad.has(f.id) ? " err" : ""}" data-i="${i}" title="${esc(bad.get(f.id) || "double-click to edit")}"><input type="checkbox" data-on="${i}"${f.off ? "" : " checked"} title="On / off (suppress)"><span class="nm">${esc(featureLabel(f))}</span>`
          + `<button class="ghost" data-up="${i}" title="Earlier">↑</button><button class="ghost" data-dn="${i}" title="Later">↓</button><button class="ghost" data-ed="${i}" title="Edit">✎</button><button class="ghost" data-del="${i}" title="Delete">✕</button></div>`).join("")
        + `<div class="r"><button class="ghost" id="bdTabPar">ƒx Parameters${body.params.length ? " (" + body.params.length + ")" : ""}</button>${body.params.map((p) => `<span class="hint">${esc(p.name)} = ${esc(p.expr)}</span>`).join(" ")}</div>`
        + "<h5>View</h5>" + `<div class="r bdv">${Object.keys(VIEWS).map((k) => `<button class="ghost" data-v="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join("")}<button class="ghost${orbitOn ? " on" : ""}" id="bdOrb" title="Drag the body round on the canvas (Shift = roll)">🖐 Orbit</button></div>`
        + ["yaw", "pitch", "roll"].map((k) => `<div class="r"><span style="min-width:34px">${{ yaw: "Turn", pitch: "Tilt", roll: "Roll" }[k]}</span><input type="range" min="${k === "pitch" ? -90 : -180}" max="${k === "pitch" ? 90 : 180}" value="${body.view[k] || 0}" data-vw="${k}"><span class="hint">${body.view[k] || 0}°</span></div>`).join("")
        + "<h5>Look</h5>" + `<div class="r"><input type="color" id="bdCol" value="${esc(body.look.color)}"><span>Metal</span><input type="range" min="0" max="1" step="0.05" id="bdMet" value="${body.look.metal}"><span>Rough</span><input type="range" min="0" max="1" step="0.05" id="bdRou" value="${body.look.rough}"><label><input type="checkbox" id="bdEdg"${body.look.edges !== false ? " checked" : ""}> edges</label></div>`
        + `<div class="r"><span>Detail</span><select id="bdK">${[1, 2, 3, 4].map((k) => opt(k, body.k || 2, k + " px / unit")).join("")}</select></div>`
        + "<h5>Export</h5>" + '<div class="r"><button class="ghost" data-x="stl">STL</button><button class="ghost" data-x="glb">glTF (.glb)</button><button class="ghost" data-x="step">STEP</button><button class="ghost" id="bdTl">→ Timeline</button></div>'
        + `<div class="msg" id="bdMsg">${esc(msg || lastErr || "")}</div>`;
      const q = (s) => host.querySelector(s);
      const change = (fn, label) => { const b2 = clone(body); fn(b2); commit(L, b2, label); };
      host.querySelectorAll("[data-on]").forEach((x) => { x.onchange = () => change((b2) => { b2.features[+x.dataset.on].off = !x.checked; }, x.checked ? "unsuppress feature" : "suppress feature"); });
      host.querySelectorAll("[data-up]").forEach((x) => { x.onclick = () => { const i = +x.dataset.up; if (i > 0) change((b2) => { const t = b2.features[i]; b2.features[i] = b2.features[i - 1]; b2.features[i - 1] = t; }, "reorder features"); }; });
      host.querySelectorAll("[data-dn]").forEach((x) => { x.onclick = () => { const i = +x.dataset.dn; if (i < body.features.length - 1) change((b2) => { const t = b2.features[i]; b2.features[i] = b2.features[i + 1]; b2.features[i + 1] = t; }, "reorder features"); }; });
      host.querySelectorAll("[data-ed]").forEach((x) => { x.onclick = () => editFeature(L, body.features[+x.dataset.ed]); });
      host.querySelectorAll(".ft").forEach((x) => { x.ondblclick = () => editFeature(L, body.features[+x.dataset.i]); });
      host.querySelectorAll("[data-del]").forEach((x) => { x.onclick = () => { if (body.features.length === 1) return say("a body needs one feature at least - delete the layer instead"); change((b2) => { b2.features.splice(+x.dataset.del, 1); }, "delete feature"); }; });
      q("#bdTabPar").onclick = () => paramsDialog(L);
      host.querySelectorAll("[data-v]").forEach((x) => { x.onclick = () => setView(VIEWS[x.dataset.v], L); });
      q("#bdOrb").onclick = () => { orbitOn = !orbitOn; paintTab(); say(orbitOn ? "🖐 Orbit: drag the body on the canvas to turn it (Shift = roll) - again to stop" : "Orbit off"); };
      host.querySelectorAll("[data-vw]").forEach((x) => { x.oninput = () => { x.nextElementSibling.textContent = x.value + "°"; }; x.onchange = () => { const v = Object.assign({}, body.view); v[x.dataset.vw] = +x.value; setView(v, L); }; });
      q("#bdCol").onchange = () => setLook({ color: q("#bdCol").value }, L);
      q("#bdMet").onchange = () => setLook({ metal: +q("#bdMet").value }, L);
      q("#bdRou").onchange = () => setLook({ rough: +q("#bdRou").value }, L);
      q("#bdEdg").onchange = () => setLook({ edges: q("#bdEdg").checked }, L);
      q("#bdK").onchange = () => { const b2 = clone(body); b2.k = +q("#bdK").value; redraw(L, b2, "body detail"); };
      host.querySelectorAll("[data-x]").forEach((x) => { x.onclick = () => exportAs(x.dataset.x, L); });
      q("#bdTl").onclick = () => toTimeline(L);
    }
    E.overlayHooks.push(() => { const host = $("kbodyBody"); const L = curBody(); const k = L ? L.id + ":" + (L.ver || 0) : "-"; if (host && host.dataset.k !== k) { host.dataset.k = k; paintTab(); } });

    /* ================================ commands + the SOLID tab ================================ */
    const C = E.ui.addCmd, has = () => !!curBody();
    if (C) {
      C("solid.extrude", "Extrude…", "", () => pickProfiles("extrude"), {}, ["Layer", "sketch.profiles", true]);
      C("solid.revolve", "Revolve…", "", () => pickProfiles("revolve"), {}, ["Layer", "solid.extrude"]);
      C("solid.fillet", "Fillet…", "", () => edgeDialog("fillet"), { enabled: has }, ["Layer", "solid.revolve"]);
      C("solid.chamfer", "Chamfer…", "", () => edgeDialog("chamfer"), { enabled: has }, ["Layer", "solid.fillet"]);
      C("solid.shell", "Shell…", "", () => shellDialog(), { enabled: has }, ["Layer", "solid.chamfer"]);
      C("solid.split", "Split Body…", "", () => splitDialog(), { enabled: has }, ["Layer", "solid.shell"]);
      C("solid.params", "Change Parameters…", "", () => paramsDialog(), { enabled: has }, ["Layer", "solid.split"]);
      C("solid.totimeline", "3D Body → Timeline", "", () => toTimeline(), { enabled: has }, ["Layer", "solid.params"]);
    }
    const addTab = () => {
      if (!E.cadBar || !E.cadBar.addTab) return false;
      const I = (root.PCCadBar && root.PCCadBar.ICONS) || {}, sv = (d) => `<svg viewBox="0 0 24 24">${d}</svg>`;
      const icons = { extrude: sv('<path d="M5 15l7 4 7-4M5 15V9l7-4 7 4v6M12 19v-6M5 9l7 4 7-4"/><path d="M12 2v3"/>'), revolve: sv('<ellipse cx="12" cy="6" rx="7" ry="2.5"/><ellipse cx="12" cy="18" rx="7" ry="2.5"/><path d="M5 6v12M19 6v12"/>'),
        shell: sv('<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M7 9.5l5-2.5 5 2.5v5l-5 2.5-5-2.5z"/>'), split: sv('<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M3 13l18-4" stroke-dasharray="3 2"/>'),
        params: sv('<path d="M9 19c2 0 2-14 5-14M8 11h7"/><path d="M15 15l4 4M19 15l-4 4"/>'), timeline: sv('<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 9h18M8 5v4M13 5v4"/>') };
      E.cadBar.addTab({ id: "solid", label: "Solid", groups: [
        { label: "Create", show: 2, items: [{ id: "b_extrude", label: "Extrude", icon: icons.extrude, key: "E", run: () => pickProfiles("extrude") }, { id: "b_revolve", label: "Revolve", icon: icons.revolve, run: () => pickProfiles("revolve") }] },
        { label: "Modify", show: 4, items: [{ id: "b_fillet", label: "Fillet", icon: I.fillet || "◜", run: () => edgeDialog("fillet"), enabled: has }, { id: "b_chamfer", label: "Chamfer", icon: I.chamfer || "◺", run: () => edgeDialog("chamfer"), enabled: has },
          { id: "b_shell", label: "Shell", icon: icons.shell, run: () => shellDialog(), enabled: has }, { id: "b_split", label: "Split Body", icon: icons.split, run: () => splitDialog(), enabled: has },
          { sep: true }, { id: "b_params", label: "Change Parameters", icon: icons.params, run: () => paramsDialog(), enabled: has }] },
        { label: "View", inline: true, items: Object.keys(VIEWS).map((k) => ({ id: "bv_" + k, label: "View: " + k, icon: { home: "⌂", front: "F", back: "Bk", top: "T", bottom: "Bt", right: "R", left: "L" }[k], run: () => setView(VIEWS[k]), enabled: has }))
          .concat([{ id: "bv_orbit", label: "Orbit (drag the body)", icon: "🖐", run: () => { orbitOn = !orbitOn; say(orbitOn ? "🖐 Orbit: drag the body to turn it (Shift = roll)" : "Orbit off"); paintTab(); }, enabled: has, active: () => orbitOn }]) },
        { label: "Export", show: 1, items: [{ id: "b_tl", label: "→ Timeline", icon: icons.timeline, run: () => toTimeline(), enabled: has }, { id: "b_stl", label: "Export STL", icon: I.dxfout || "⇩", run: () => exportAs("stl"), enabled: has },
          { id: "b_glb", label: "Export glTF (.glb)", icon: I.dxfout || "⇩", run: () => exportAs("glb"), enabled: has }, { id: "b_step", label: "Export STEP", icon: I.dxfout || "⇩", run: () => exportAs("step"), enabled: has },
          { sep: true }, { id: "b_engine", label: "3D engine (Settings ▸ 3D)…", icon: "⚙", run: () => { if (root.Settings3D) root.Settings3D.open(); } }] },
      ] });
      return true;
    };
    if (!addTab()) root.setTimeout(addTab, 300);
    // the tab follows the work: a body picked -> SOLID
    let seenBody = null;
    E.overlayHooks.push(() => { const L = curBody(), id = L ? L.id : null; if (id !== seenBody) { seenBody = id; if (id && E.cadBar && E.cadBar.ui && E.cadBar.ui.tab() !== "solid") E.cadBar.ui.setTab("solid"); } });

    E.body = { isBody, bodies, sketchDialog, pickProfiles, pickDone, picking: () => (pickP ? { type: pickP.type, sketch: pickP.L.id, picked: [...pickP.picked], n: pickP.list.length } : null), cubeAt, paintCube, edgeDialog, shellDialog, splitDialog, paramsDialog, editFeature, commit, newBodyLayer, buildBody, picture, redraw, setView, setLook, exportAs, toTimeline, pushTimeline, meshOf, ensureMesh, checkAll,
      orbit: (v) => { if (v != null) orbitOn = !!v; return orbitOn; }, paintTab, busy: () => busy.size > 0 || pending > 0, lastError: () => lastErr };
  }
  const PCBody = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = PCBody;
  else root.PCBody = PCBody;
})(typeof window !== "undefined" ? window : globalThis);
