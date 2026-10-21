/* bitGen Studio — static/housebuilder.js (2.524.0): 🏠 THE HOUSE BUILDER, a floating docker (window.H3House).
 * Tim (verbatim): "i would like a floorplan/housebuilder floating docker that i can use as a location as well"
 *   🏠 House (statusbar)  shows / hides it. A house is saved per project (lib/house.js); the geometry is static/housegeo.js
 *   PLAN (2D)     metres on a 0.05 m grid (1 m lines): ▭ Room (drag) / ⬠ Polygon room (click the corners, click the first
 *                 again) - a room brings its walls (a shared wall is one wall); ╱ Wall (click, click …, Enter / double-click /
 *                 Esc ends); 🚪 Door, 🪟 Window, ⇋ Glass door, ▢ Opening, 🚗 Garage door (click on a wall); 🛋 Furniture (pick from
 *                 the library, click to place, R turns it); ⇗ Stairs (to the floor above - its hole is cut there); 📷 Camera
 *                 (press where it stands, drag where it looks); ⬚ Select: drag to move (a wall's end drags the corner),
 *                 R / Shift+R turn 15°, arrows nudge 5 cm, Delete removes; wheel zooms, right-drag / ✋ pans; Ctrl+Z / Ctrl+Y
 *   FLOORS        tabs; ＋ a floor above (its height); the floor below shows faintly while you draw
 *   3D            three.js: materials with procedural textures, the sun from the hour (the north arrow turns it), lamps,
 *                 shadows; orbit, or 👁 a camera's own view - drag in it to aim that camera
 *   LOCATION      for the picked camera: 📍 360° location (a 4096 × 2048 panorama -> a Location, the same as any other: its
 *                 view, its @tag, the global prompt's location block); 📷 Shot + depth + normal maps (-> Image assets);
 *                 ✨ Make it real (the shot -> an image style that takes a picture, with a prompt written from the room);
 *                 ⤓ .obj (+ .mtl) for Blender / Unreal
 *   ◯ LIGHT       2.538.0 (Tim: "add a circle to the toolbar in home builder, this will show location for lights"): press
 *                 where the light hangs, drag out how far it reaches - the plan shows its circle; ⬚ Select drags it, its
 *                 ◦ handle on the circle sizes the reach; the panel: name, height over the floor, brightness, colour.
 *                 The 3D view, the shots and the panoramas light them (always - the 💡 lamps tick is the furniture's lamps)
 *   🖼 REFERENCES 2.539.0 (Tim: "can we use our reference docker images , like walls, furniture, lights etc in
 *                 homebuilder"): drag a picture from the References docker onto a wall / a room / a piece / a light on the
 *                 plan - or pick one in its panel (🖼 From References…, From disk…). A wall / a room's floor WEARS it (its
 *                 texture in the 3D view, the shots and the panoramas; Tile = the metres one picture covers); a piece of
 *                 furniture / a light keeps its shape and ✨ Make it real gets the picture with "make the sofa look like
 *                 the one in picture N (its description)". The pictures are kept with the house (refs/).
 * Pure (Node: scripts/test-house524.js, test-house538.js, test-refinfo539.js): snap, fmtLen, fmtArea, hitItem, ptSegDist,
 * paletteFor, reachOf, looksSeen, picPlan.
 */
(function (root) {
  "use strict";
  var G = root.H3HouseGeo || (typeof require === "function" ? require("./housegeo.js") : null);
  function snap(v, step) { var s = step || 0.05; return Math.round(v / s) * s; }
  function fmtLen(m) { return (Math.round(m * 100) / 100).toFixed(2) + " m"; }
  function fmtArea(a) { return (Math.round(Math.abs(a) * 10) / 10).toFixed(1) + " m²"; }
  function ptSegDist(p, a, b) { var L2 = Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2); if (!L2) return Math.hypot(p[0] - a[0], p[1] - a[1]); var t = Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / L2)); return Math.hypot(p[0] - (a[0] + t * (b[0] - a[0])), p[1] - (a[1] + t * (b[1] - a[1]))); }
  /** is p on the item (its rotated footprint)? */
  function hitItem(it, p) { var a = -it.rot * Math.PI / 180, dx = p[0] - it.x, dy = p[1] - it.y, lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a); return Math.abs(lx) <= it.w / 2 + 0.05 && Math.abs(ly) <= it.d / 2 + 0.05; }
  /** the library grouped by category (pure) */
  function paletteFor(cat) { var out = {}; Object.keys(cat).forEach(function (k) { (out[cat[k].cat] = out[cat[k].cat] || []).push({ type: k, label: cat[k].label, w: cat[k].w, d: cat[k].d }); }); return out; }
  function segX(a, b, c, d) {             // where segment ab crosses segment cd -> [t on ab, u on cd] | null
    var r0 = b[0] - a[0], r1 = b[1] - a[1], s0 = d[0] - c[0], s1 = d[1] - c[1], den = r0 * s1 - r1 * s0;
    if (Math.abs(den) < 1e-9) return null;
    var t = ((c[0] - a[0]) * s1 - (c[1] - a[1]) * s0) / den, u = ((c[0] - a[0]) * r1 - (c[1] - a[1]) * r0) / den;
    return t > 0.001 && t < 0.999 && u >= 0 && u <= 1 ? [t, u] : null;
  }
  /** 2.528.0: the people a camera sees (in its view, not behind a wall - a door / opening / window lets the view through),
   *  left to right: [{q, side, depth, ndc, dist}] - for the ✨ prompt (pure) */
  function seen(m, c, aspect) {
    var yaw = c.yaw * Math.PI / 180, half = Math.atan(Math.tan(c.fov * Math.PI / 360) * (aspect || 16 / 9)), out = [];
    var walls = (m.walls || []).filter(function (w) { return w.floor === c.floor; });
    (m.people || []).forEach(function (q) {
      if (q.floor !== c.floor) return;
      var dx = q.x - c.x, dy = q.y - c.y, dist = Math.hypot(dx, dy);
      if (dist < 0.3) return;
      var ang = Math.atan2(dy, dx) - yaw; while (ang > Math.PI) ang -= 2 * Math.PI; while (ang < -Math.PI) ang += 2 * Math.PI;
      if (Math.abs(ang) >= Math.PI / 2) return;
      var ndc = Math.tan(ang) / Math.tan(half);
      if (Math.abs(ndc) > 1.05) return;
      var blocked = walls.some(function (w) {
        var hit = segX([c.x, c.y], [q.x, q.y], w.a, w.b); if (!hit) return false;
        var L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]), t = hit[1] * L;
        return !(m.openings || []).some(function (o) { return o.wall === w.id && Math.abs(t - o.t) <= o.w / 2; });
      });
      if (blocked) return;
      out.push({ q: q, ndc: ndc, dist: dist, side: ndc < -0.33 ? "on the left" : ndc > 0.33 ? "on the right" : "in the middle", depth: dist < 2.5 ? "in the foreground" : dist < 5 ? "in the middle distance" : "in the background" });
    });
    return out.sort(function (a, b) { return a.ndc - b.ndc; });
  }
  /** 2.538.0: a ◯ light's reach from its centre to p (0.5-30 m, 0.05 steps) (pure) */
  function reachOf(c, p) { var r = Math.hypot(p[0] - c[0], p[1] - c[1]); return Math.round(Math.max(0.5, Math.min(30, r)) * 20) / 20; }
  /** 2.539.0: the pieces / lights with a 🖼 look a camera sees (in its cone, on its floor), nearest first; + the textures of
   *  the room it stands in -> [{ref, what, side, kind}] once per picture (pure: m = the model, c = the camera) */
  function looksSeen(m, c, aspect) {
    var yaw = c.yaw * Math.PI / 180, half = Math.atan(Math.tan(c.fov * Math.PI / 360) * (aspect || 16 / 9)), out = [], have = {};
    var refs = {}; (m.refs || []).forEach(function (q) { refs[q.id] = q; });
    var add = function (rid, what, side, kind, d) { if (!rid || !refs[rid] || have[rid]) return; have[rid] = 1; out.push({ ref: rid, what: what, side: side, kind: kind, d: d }); };
    var cand = [];
    (m.items || []).forEach(function (it) { if (it.ref && it.floor === c.floor) cand.push({ o: it, what: ((G.CATALOGUE[it.type] || {}).label || it.type).replace(/ \(.*\)$/, "").toLowerCase(), kind: "furniture" }); });
    (m.lights || []).forEach(function (q) { if (q.ref && q.floor === c.floor) cand.push({ o: q, what: "light", kind: "light" }); });
    cand.map(function (x) {
      var dx = x.o.x - c.x, dy = x.o.y - c.y, dist = Math.hypot(dx, dy), a = Math.atan2(dy, dx) - yaw;
      while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI;
      return { x: x, dist: dist, a: a };
    }).filter(function (z) { return z.dist > 0.2 && Math.abs(z.a) <= half; }).sort(function (p, q) { return p.dist - q.dist; }).forEach(function (z) {
      var ndc = z.a / half;
      add(z.x.o.ref, z.x.what, ndc < -0.33 ? "on the left" : ndc > 0.33 ? "on the right" : "in the middle", z.x.kind, z.dist);
    });
    var rm = G.roomOf(m, c.floor, [c.x, c.y]);
    if (rm && rm.tex) add(rm.tex, "floor", "", "floor", 0);
    (m.walls || []).forEach(function (w) { if (w.floor === c.floor && w.tex && rm && edgeOn(w, rm.poly)) add(w.tex, "walls", "", "wall", 0); });
    return out;
  }
  function edgeOn(w, poly) { var on = function (p) { for (var i = 0; i < poly.length; i++) if (ptSegDist(p, poly[i], poly[(i + 1) % poly.length]) < 0.05) return true; return false; }; return on(w.a) && on(w.b); }
  /** which pictures ✨ Make it real sends: the shot (1), the characters (2…), then the looks - as many as the style takes
   *  (slots; a FLUX.2 Klein swap takes 3) -> {chars: [...], looks: [...], left} (pure) */
  function picPlan(chars, looks, st) {
    var room = st && st.slots ? Math.max(0, st.slots - 1) : (st && st.swapped ? 2 : 0);
    var c = (chars || []).slice(0, room), l = (looks || []).slice(0, Math.max(0, room - c.length));
    return { chars: c, looks: l, left: (chars || []).length - c.length + (looks || []).length - l.length };
  }
  var pure = { looksSeen: looksSeen, picPlan: picPlan, reachOf: reachOf, snap: snap, fmtLen: fmtLen, fmtArea: fmtArea, ptSegDist: ptSegDist, hitItem: hitItem, paletteFor: paletteFor, seen: seen };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var CSS = ".hbd{display:flex;flex-direction:column;height:100%;min-height:0;font-size:.74rem;gap:4px}"
    + ".hbd .hbar{display:flex;gap:4px;align-items:center;flex-wrap:wrap}.hbd .hbar select{max-width:200px}.hbd .hbar .sep{width:1px;height:18px;background:var(--line,#3a342a);margin:0 3px}"
    + ".hbd .hmain{flex:1;min-height:0;display:flex;gap:4px}.hbd .htools{display:flex;flex-direction:column;gap:3px;width:40px}"
    + ".hbd .htools button{width:38px;height:32px;padding:0;font-size:1rem}.hbd .htools button.on,.hbd .hbar button.on{border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c);background:rgba(245,158,44,.12)}"
    + ".hbd .hviews{flex:1;min-width:0;display:flex;gap:4px}.hbd .hview{flex:1;min-width:0;position:relative;border:1px solid var(--line,#3a342a);border-radius:6px;overflow:hidden;background:#11100e}"
    + ".hbd .hview canvas{position:absolute;inset:0;width:100%;height:100%;display:block}.hbd .hview .hcap{position:absolute;left:6px;top:4px;font-size:.66rem;color:var(--dim,#999);pointer-events:none;text-shadow:0 1px 2px #000}"
    + ".hbd .hside{width:250px;overflow:auto;display:flex;flex-direction:column;gap:6px}.hbd .hsec{border:1px solid var(--line,#3a342a);border-radius:6px;padding:5px 6px;background:var(--panel,#1b1814)}"
    + ".hbd .hsec h5{margin:0 0 4px;color:var(--tiger,#f59e2c);font-size:.68rem;text-transform:uppercase;letter-spacing:.06em}"
    + ".hbd .hf{display:grid;grid-template-columns:86px 1fr;gap:3px 6px;align-items:center}.hbd .hf input,.hbd .hf select,.hbd .hf textarea{width:100%;min-width:0}.hbd .hf input[type=color]{height:22px;padding:0}"
    + ".hbd .hlib{display:grid;grid-template-columns:1fr 1fr;gap:3px}.hbd .hlib button{font-size:.66rem;padding:3px 2px;text-align:left}.hbd .hlib h6{grid-column:1/-1;margin:4px 0 0;font-size:.64rem;color:var(--dim,#999)}"
    + ".hbd .hbref{display:flex;gap:6px;align-items:center}.hbd .hbref img{width:54px;height:40px;object-fit:cover;border-radius:4px;border:1px solid var(--line,#444)}.hbd .hbref span{font-size:.68rem}"
    + ".hbd .hbrefpick{display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-top:4px;max-height:220px;overflow:auto}.hbd .hbrefpick h6{grid-column:1/-1;margin:2px 0 0;font-size:.64rem;color:var(--dim,#999)}.hbd .hbrefpick button{display:flex;flex-direction:column;align-items:center;padding:2px;font-size:.6rem}.hbd .hbrefpick img{width:100%;height:48px;object-fit:cover;border-radius:3px}"
    + ".hbd .hnote{color:var(--dim,#999);font-size:.68rem}.hbd .hok{color:#7c7}.hbd .hbad{color:#e66}.hbd textarea{min-height:60px;font-size:.7rem}";
  var TOOLS = [["select", "⬚", "Select (V) - click a piece: drag it, ↻ its round handle turns it, its corner squares size it (Shift keeps the shape); drag on an empty spot for a box, Shift+click adds - R turns, Delete removes them all. A 📷 camera: drag it through the plan (the 3D view looks through it), ← → turn, ↑ ↓ tilt, hold Shift to rise (3 m over the roof at most), hold Alt to sink (the ground floor)"], ["room", "▭", "Room - drag a rectangle (its walls come with it)"], ["poly", "⬠", "Polygon room - click its corners, click the first again"],
    ["wall", "╱", "Wall - click, click … (Enter / double-click ends)"], ["door", "🚪", "Door - click on a wall"], ["window", "🪟", "Window - click on a wall"], ["slide", "⇋", "Glass sliding door - click on a wall"],
    ["opening", "▢", "Opening (no door) - click on a wall"], ["garage", "🚗", "Garage door - click on a wall"], ["item", "🛋", "Furniture - pick it in the library, click to place, R turns it"],
    ["stairs", "⇗", "Stairs up to the next floor - click; R turns them"], ["camera", "📷", "Camera - press where it stands, drag where it looks"], ["person", "🧍", "Person - press where they stand, drag the way they face; pick the character in the properties (✨ Make it real puts them in)"], ["light", "◯", "Light - press where it hangs, drag out how far it reaches (its circle); ⬚ Select moves it, the dot on its circle sizes it - its height, brightness and colour in the properties"], ["pan", "✋", "Pan (or right-drag)"]];
  var S = { list: [], m: null, slug: "", floor: 0, tool: "select", sel: null, view: "both", undo: [], redo: [], dirty: false, zoom: 40, ox: 60, oy: 60,
    draft: null, hover: null, libType: "sofa", libRot: 0, drag: null, three: null, look: "orbit", ceil: false, saveT: null, styles: null, lastShot: {}, multi: null, walk: null };
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function say(t, cls) { var m = $("hbMsg"); if (m) { m.textContent = t || ""; m.className = "hnote " + (cls || ""); } }
  function jget(u) { return fetch(u).then(function (r) { return r.json().then(function (j) { if (!r.ok && !j.error) j.error = "HTTP " + r.status; return j; }); }); }
  function opt(list, v) { return list.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (String(x[0]) === String(v) ? " selected" : "") + ">" + esc(x[1]) + "</option>"; }).join(""); }

  /* ---------------- the model + undo */
  function fresh(name) { return G.normalize({ name: name || "My house" }); }
  function snapshot() { S.undo.push(JSON.stringify(S.m)); if (S.undo.length > 80) S.undo.shift(); S.redo = []; }
  function changed(noSnap) { S.dirty = true; S.m = G.normalize(S.m); paint(); rebuild3d(); paintSide(); if (S.slug) { clearTimeout(S.saveT); S.saveT = setTimeout(function () { save(true); }, 20000); } void noSnap; }
  function undo() { if (!S.undo.length) return; S.redo.push(JSON.stringify(S.m)); S.m = JSON.parse(S.undo.pop()); S.sel = null; changed(); }
  function redo() { if (!S.redo.length) return; S.undo.push(JSON.stringify(S.m)); S.m = JSON.parse(S.redo.pop()); S.sel = null; changed(); }
  function find(kind, id) { var arr = { wall: S.m.walls, room: S.m.rooms, item: S.m.items, opening: S.m.openings, stairs: S.m.stairs, camera: S.m.cameras, person: S.m.people, light: S.m.lights }[kind]; return arr ? arr.find(function (x) { return x.id === id; }) : null; }
  function selObj() { return S.sel ? find(S.sel.kind, S.sel.id) : null; }

  /* ---------------- the plan (2D) */
  function cv() { return $("hbPlan"); }
  function toS(p) { return [p[0] * S.zoom + S.ox, p[1] * S.zoom + S.oy]; }
  function toW(x, y) { return [(x - S.ox) / S.zoom, (y - S.oy) / S.zoom]; }
  function evPt(e) { var r = cv().getBoundingClientRect(); return toW(e.clientX - r.left, e.clientY - r.top); }
  function snapPt(p, e) {
    var q = [snap(p[0]), snap(p[1])];
    // corners of the walls on this floor win (within 15 px)
    var best = null, bd = 15 / S.zoom;
    S.m.walls.forEach(function (w) { if (w.floor !== S.floor) return; [w.a, w.b].forEach(function (c) { var d = G.dist(c, p); if (d < bd) { bd = d; best = c; } }); });
    if (best && !(e && e.altKey)) return [best[0], best[1]];
    return q;
  }
  function paint() {
    var c = cv(); if (!c || !S.m) return;
    var r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(r.width * dpr) || c.height !== Math.round(r.height * dpr)) { c.width = Math.max(1, Math.round(r.width * dpr)); c.height = Math.max(1, Math.round(r.height * dpr)); }
    var x = c.getContext && c.getContext("2d"); if (!x) return;   // no canvas (a test page)
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawPlan(x, r.width, r.height, false);
  }
  function drawPlan(x, W, H, print) {
    var m = S.m, f = S.floor;
    x.fillStyle = print ? "#ffffff" : "#16140f"; x.fillRect(0, 0, W, H);
    // grid
    var w0 = toW(0, 0), w1 = toW(W, H), step = S.zoom > 30 ? 0.5 : 1;
    for (var gx = Math.floor(w0[0] / step) * step; gx <= w1[0]; gx += step) { var sx = toS([gx, 0])[0], major = Math.abs(gx - Math.round(gx)) < 1e-6; x.strokeStyle = print ? (major ? "#ddd" : "#f0f0f0") : (major ? "#2c2922" : "#1e1c17"); x.lineWidth = 1; x.beginPath(); x.moveTo(sx + 0.5, 0); x.lineTo(sx + 0.5, H); x.stroke(); }
    for (var gy = Math.floor(w0[1] / step) * step; gy <= w1[1]; gy += step) { var sy = toS([0, gy])[1], major2 = Math.abs(gy - Math.round(gy)) < 1e-6; x.strokeStyle = print ? (major2 ? "#ddd" : "#f0f0f0") : (major2 ? "#2c2922" : "#1e1c17"); x.beginPath(); x.moveTo(0, sy + 0.5); x.lineTo(W, sy + 0.5); x.stroke(); }
    // 2.529.0: the plan picture to trace over (under everything else)
    if (m.trace && S.traceImg && S.traceImg.complete && S.traceImg.naturalWidth && (m.trace.floor || 0) === f) {
      var tp = toS([m.trace.x, m.trace.y]), tk = m.trace.mpp * S.zoom;
      x.globalAlpha = m.trace.opacity; x.drawImage(S.traceImg, tp[0], tp[1], S.traceImg.naturalWidth * tk, S.traceImg.naturalHeight * tk); x.globalAlpha = 1;
    }
    if (S.scaleMode && S.scaleMode.pts.length && !print) { var sp = toS(S.scaleMode.pts[0]); x.fillStyle = "#f59e2c"; x.beginPath(); x.arc(sp[0], sp[1], 5, 0, 7); x.fill(); if (S.hover) { var hv = toS(S.hover); x.strokeStyle = "#f59e2c"; x.setLineDash([4, 3]); x.beginPath(); x.moveTo(sp[0], sp[1]); x.lineTo(hv[0], hv[1]); x.stroke(); x.setLineDash([]); label(x, fmtLen(G.dist(S.scaleMode.pts[0], S.hover)) + " now", hv[0] + 10, hv[1] - 10, "#f59e2c", 11, true); } }
    // the floor below, faint
    if (f > 0 && !print) m.walls.forEach(function (w) { if (w.floor !== f - 1) return; var a = toS(w.a), b = toS(w.b); x.strokeStyle = "rgba(160,150,130,.25)"; x.lineWidth = Math.max(1, w.thick * S.zoom); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); });
    // rooms
    m.rooms.forEach(function (rm) {
      if (rm.floor !== f) return;
      x.beginPath(); rm.poly.forEach(function (p, i) { var s = toS(p); if (i) x.lineTo(s[0], s[1]); else x.moveTo(s[0], s[1]); }); x.closePath();
      x.fillStyle = hexA(rm.color, print ? 0.35 : 0.28); x.fill();
      if (isSel("room", rm.id)) { x.strokeStyle = "#f59e2c"; x.lineWidth = 2; x.setLineDash([6, 4]); x.stroke(); x.setLineDash([]); }
    });
    // stairs
    m.stairs.forEach(function (s) {
      if (s.floor !== f && s.floor !== f - 1) return;
      var pts = G.rectOf(s.x, s.y, s.rot, s.w, s.len).map(toS);
      x.beginPath(); pts.forEach(function (p, i) { if (i) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); }); x.closePath();
      x.fillStyle = s.floor === f ? "rgba(185,138,90,.45)" : "rgba(185,138,90,.15)"; x.fill(); x.strokeStyle = isSel("stairs", s.id) ? "#f59e2c" : "#8a6a48"; x.lineWidth = 1.5; x.stroke();
      var a = s.rot * Math.PI / 180, n = Math.max(3, Math.round(((m.floors[s.floor] || {}).height + 0.2) / 0.18));
      for (var i = 1; i < n; i++) { var al = -s.len / 2 + s.len * i / n, c0 = toS([s.x + Math.cos(a) * al - Math.sin(a) * s.w / 2, s.y + Math.sin(a) * al + Math.cos(a) * s.w / 2]), c1 = toS([s.x + Math.cos(a) * al + Math.sin(a) * s.w / 2, s.y + Math.sin(a) * al - Math.cos(a) * s.w / 2]); x.beginPath(); x.moveTo(c0[0], c0[1]); x.lineTo(c1[0], c1[1]); x.stroke(); }
      var t0 = toS([s.x - Math.cos(a) * s.len * 0.35, s.y - Math.sin(a) * s.len * 0.35]), t1 = toS([s.x + Math.cos(a) * s.len * 0.35, s.y + Math.sin(a) * s.len * 0.35]);
      arrow(x, t0, t1, s.floor === f ? "#f0d8b0" : "rgba(240,216,176,.4)");
    });
    // walls
    var byWall = {}; m.openings.forEach(function (q) { (byWall[q.wall] = byWall[q.wall] || []).push(q); });
    m.walls.forEach(function (w) {
      if (w.floor !== f) return;
      var a = toS(w.a), b = toS(w.b), L = G.dist(w.a, w.b), ux = (w.b[0] - w.a[0]) / L, uy = (w.b[1] - w.a[1]) / L;
      x.strokeStyle = isSel("wall", w.id) ? "#f59e2c" : (print ? "#222" : "#d8d0c0"); x.lineWidth = Math.max(2, w.thick * S.zoom); x.lineCap = "square";
      x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); x.lineCap = "butt";
      (byWall[w.id] || []).forEach(function (q) {
        var p0 = toS([w.a[0] + ux * (q.t - q.w / 2), w.a[1] + uy * (q.t - q.w / 2)]), p1 = toS([w.a[0] + ux * (q.t + q.w / 2), w.a[1] + uy * (q.t + q.w / 2)]);
        x.strokeStyle = print ? "#fff" : "#16140f"; x.lineWidth = Math.max(2, w.thick * S.zoom) + 1; x.beginPath(); x.moveTo(p0[0], p0[1]); x.lineTo(p1[0], p1[1]); x.stroke();
        var sc = isSel("opening", q.id) ? "#f59e2c" : (print ? "#555" : "#9fc4e0");
        x.strokeStyle = sc; x.lineWidth = 1.5;
        if (q.kind === "door") { var r = q.w * S.zoom, ang = Math.atan2(uy, ux); x.beginPath(); x.moveTo(p0[0], p0[1]); x.lineTo(p0[0] - uy * r, p0[1] + ux * r); x.stroke(); x.beginPath(); x.arc(p0[0], p0[1], r, ang, ang + Math.PI / 2); x.stroke(); }
        else if (q.kind === "window" || q.kind === "slide") { var nx = -uy * w.thick * S.zoom / 3, ny = ux * w.thick * S.zoom / 3; [-1, 1].forEach(function (k) { x.beginPath(); x.moveTo(p0[0] + nx * k, p0[1] + ny * k); x.lineTo(p1[0] + nx * k, p1[1] + ny * k); x.stroke(); }); }
        else if (q.kind === "garage") { x.setLineDash([4, 3]); x.beginPath(); x.moveTo(p0[0], p0[1]); x.lineTo(p1[0], p1[1]); x.stroke(); x.setLineDash([]); }
      });
      if (S.zoom >= 25 && !print || print) { var mid = toS([(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2]), nx2 = -uy, ny2 = ux, off = (w.thick * S.zoom) / 2 + 9; label(x, fmtLen(L), mid[0] + nx2 * off, mid[1] + ny2 * off, print ? "#666" : "#8f8778", 10); }
    });
    // items
    m.items.forEach(function (it) {
      if (it.floor !== f) return;
      var c = G.CATALOGUE[it.type], pts = G.rectOf(it.x, it.y, it.rot + 90, it.w, it.d).map(toS);
      x.beginPath(); pts.forEach(function (p, i) { if (i) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); }); x.closePath();
      x.fillStyle = c.light ? "rgba(255,230,160,.35)" : hexA(it.color || "#8c8070", print ? 0.5 : 0.55); x.fill();
      x.strokeStyle = isSel("item", it.id) ? "#f59e2c" : (print ? "#444" : "#c9bfa9"); x.lineWidth = isSel("item", it.id) ? 2 : 1; x.stroke();
      var a = it.rot * Math.PI / 180, fr = toS([it.x - Math.sin(a) * it.d / 2 * 0.8, it.y + Math.cos(a) * it.d / 2 * 0.8]);   // its front
      x.fillStyle = print ? "#444" : "#e9dfc8"; x.beginPath(); x.arc(fr[0], fr[1], 2, 0, 7); x.fill();
      if (S.zoom * Math.min(it.w, it.d) > 26) label(x, c.label.replace(/ \(.*\)$/, ""), toS([it.x, it.y])[0], toS([it.x, it.y])[1], print ? "#222" : "#f2ead8", 9);
    });
    // room labels
    // 2.539.0: 🖼 a wall / an item / a light wearing a reference picture
    if (!print) {
      m.walls.forEach(function (w) { if (w.floor === f && w.tex) { var mp = toS([(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2]); label(x, "🖼", mp[0], mp[1], "#ffe7b0", 10); } });
      m.items.forEach(function (it) { if (it.floor === f && it.ref) { var ip = toS([it.x, it.y]); label(x, "🖼", ip[0] + 10, ip[1] - 10, "#ffe7b0", 10); } });
      (m.lights || []).forEach(function (q) { if (q.floor === f && q.ref) { var lp2 = toS([q.x, q.y]); label(x, "🖼", lp2[0] + 12, lp2[1] + 2, "#ffe7b0", 10); } });
    }
    m.rooms.forEach(function (rm) { if (rm.floor !== f) return; var c = toS(G.centroid(rm.poly)); label(x, rm.name + (rm.tex && !print ? " 🖼" : ""), c[0], c[1] - 7, print ? "#111" : "#f5efe2", 12, true); label(x, fmtArea(G.area(rm.poly)), c[0], c[1] + 8, print ? "#555" : "#b5ac9a", 10); });
    // 2.528.0: people (a dot, the way they face, their name)
    (m.people || []).forEach(function (q) {
      if (q.floor !== f) return;
      var p = toS([q.x, q.y]), a = q.rot * Math.PI / 180, r = Math.max(5, 0.22 * S.zoom), sel = isSel("person", q.id);
      x.fillStyle = sel ? "rgba(245,158,44,.45)" : "rgba(200,170,255,.35)"; x.strokeStyle = sel ? "#f59e2c" : (print ? "#555" : "#c8aaff"); x.lineWidth = 1.5;
      x.beginPath(); x.arc(p[0], p[1], r, 0, 7); x.fill(); x.stroke();
      x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(p[0] + Math.cos(a) * r * 1.7, p[1] + Math.sin(a) * r * 1.7); x.stroke();
      label(x, "🧍 " + personName(q), p[0], p[1] - r - 7, print ? "#333" : "#e4d8ff", 10);
    });
    // 2.538.0: ◯ lights - the circle they reach, a bright centre, the name
    (m.lights || []).forEach(function (q) {
      if (q.floor !== f) return;
      var p = toS([q.x, q.y]), R = q.reach * S.zoom, sel = isSel("light", q.id);
      if (!print) { var gr = x.createRadialGradient(p[0], p[1], 0, p[0], p[1], Math.max(1, R)); gr.addColorStop(0, hexA(q.color, sel ? 0.32 : 0.22)); gr.addColorStop(1, hexA(q.color, 0)); x.fillStyle = gr; x.beginPath(); x.arc(p[0], p[1], R, 0, 7); x.fill(); }
      x.strokeStyle = sel ? "#f59e2c" : (print ? "#777" : hexA(q.color, 0.85)); x.lineWidth = sel ? 2 : 1.2; x.setLineDash([5, 4]); x.beginPath(); x.arc(p[0], p[1], R, 0, 7); x.stroke(); x.setLineDash([]);
      x.fillStyle = sel ? "#f59e2c" : q.color; x.strokeStyle = print ? "#444" : "#fff6dc"; x.lineWidth = 1.5; x.beginPath(); x.arc(p[0], p[1], 6, 0, 7); x.fill(); x.stroke();
      label(x, "◯ " + q.name, p[0], p[1] - 14, print ? "#333" : "#ffe7b0", 10);
    });
    // cameras
    m.cameras.forEach(function (cm) {
      if (cm.floor !== f || print) return;
      var p = toS([cm.x, cm.y]), a = cm.yaw * Math.PI / 180, h = cm.fov * Math.PI / 360, R = 34;
      x.fillStyle = isSel("camera", cm.id) ? "rgba(245,158,44,.35)" : "rgba(120,190,255,.22)"; x.beginPath(); x.moveTo(p[0], p[1]); x.arc(p[0], p[1], R, a - h, a + h); x.closePath(); x.fill();
      x.fillStyle = isSel("camera", cm.id) ? "#f59e2c" : "#78beff"; x.beginPath(); x.arc(p[0], p[1], 5, 0, 7); x.fill();
      label(x, "📷 " + cm.name, p[0], p[1] - 12, "#cfe6ff", 10);
    });
    // 2.532.0: the selected piece's handles, the box being dragged, several selected
    if (!print && S.tool === "select" && S.sel && !many()) {
      var ho = selObj();
      if (ho) handles(S.sel.kind, ho).forEach(function (hd) {
        var hs0 = toS(hd.p);
        if (hd.h === "rot") { var hf = toS(hd.from); x.strokeStyle = "#f59e2c"; x.lineWidth = 1; x.beginPath(); x.moveTo(hf[0], hf[1]); x.lineTo(hs0[0], hs0[1]); x.stroke(); x.fillStyle = "#16140f"; x.beginPath(); x.arc(hs0[0], hs0[1], 7, 0, 7); x.fill(); x.stroke(); label(x, "↻", hs0[0], hs0[1] + 0.5, "#f59e2c", 10, true); }
        else { x.fillStyle = "#f59e2c"; x.strokeStyle = "#16140f"; x.lineWidth = 1; x.fillRect(hs0[0] - 4, hs0[1] - 4, 8, 8); x.strokeRect(hs0[0] - 4, hs0[1] - 4, 8, 8); }
      });
    }
    if (!print && S.drag && S.drag.box) { var ba = toS(S.drag.a), bb2 = toS(S.drag.b); x.strokeStyle = "#f59e2c"; x.fillStyle = "rgba(245,158,44,.08)"; x.lineWidth = 1; x.setLineDash([4, 3]); x.fillRect(ba[0], ba[1], bb2[0] - ba[0], bb2[1] - ba[1]); x.strokeRect(ba[0], ba[1], bb2[0] - ba[0], bb2[1] - ba[1]); x.setLineDash([]); }
    if (!print && many()) { var gc = toS(centerOf(S.multi)); label(x, "⬚ " + S.multi.length + " selected · drag one to move them · R turns · Delete", gc[0], gc[1] - 22, "#f59e2c", 10, true); }
    // the drawing in progress + the hover
    var d = S.draft;
    if (d && d.kind === "room" && d.b) { var a2 = toS(d.a), b2 = toS(d.b); x.strokeStyle = "#f59e2c"; x.lineWidth = 2; x.setLineDash([5, 4]); x.strokeRect(a2[0], a2[1], b2[0] - a2[0], b2[1] - a2[1]); x.setLineDash([]); label(x, fmtLen(Math.abs(d.b[0] - d.a[0])) + " × " + fmtLen(Math.abs(d.b[1] - d.a[1])), (a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2, "#f59e2c", 11, true); }
    if (d && (d.kind === "poly" || d.kind === "wall") && d.pts.length) {
      x.strokeStyle = "#f59e2c"; x.lineWidth = d.kind === "wall" ? Math.max(2, 0.15 * S.zoom) : 2; x.beginPath();
      d.pts.concat(S.hover ? [S.hover] : []).forEach(function (p, i) { var s = toS(p); if (i) x.lineTo(s[0], s[1]); else x.moveTo(s[0], s[1]); }); x.stroke();
      if (S.hover && d.pts.length) { var l = d.pts[d.pts.length - 1], s1 = toS(S.hover); label(x, fmtLen(G.dist(l, S.hover)), s1[0] + 10, s1[1] - 10, "#f59e2c", 11, true); }
    }
    if (d && d.kind === "person") { var pp = toS(d.at), pa = d.yaw * Math.PI / 180; x.strokeStyle = "#c8aaff"; x.lineWidth = 2; x.beginPath(); x.arc(pp[0], pp[1], 0.22 * S.zoom, 0, 7); x.moveTo(pp[0], pp[1]); x.lineTo(pp[0] + Math.cos(pa) * 30, pp[1] + Math.sin(pa) * 30); x.stroke(); }
    if (d && d.kind === "light") { var lp = toS(d.at); x.strokeStyle = "#ffd9a0"; x.lineWidth = 2; x.setLineDash([5, 4]); x.beginPath(); x.arc(lp[0], lp[1], d.reach * S.zoom, 0, 7); x.stroke(); x.setLineDash([]); x.fillStyle = "#ffd9a0"; x.beginPath(); x.arc(lp[0], lp[1], 6, 0, 7); x.fill(); label(x, "reach " + fmtLen(d.reach), lp[0], lp[1] - 14, "#ffd9a0", 11, true); }
    if (d && d.kind === "camera") { var cp = toS(d.at), ca = d.yaw * Math.PI / 180; x.strokeStyle = "#78beff"; x.lineWidth = 2; x.beginPath(); x.moveTo(cp[0], cp[1]); x.lineTo(cp[0] + Math.cos(ca) * 40, cp[1] + Math.sin(ca) * 40); x.stroke(); }
    if (S.hover && !print && /^(door|window|slide|opening|garage)$/.test(S.tool)) {
      var nw = G.nearestWall(m, f, S.hover, 0.6);
      if (nw) { var def = G.OPENINGS[S.tool], wl = nw.wall, Lw = G.dist(wl.a, wl.b), t = Math.max(def.w / 2, Math.min(Lw - def.w / 2, nw.t)), ux2 = (wl.b[0] - wl.a[0]) / Lw, uy2 = (wl.b[1] - wl.a[1]) / Lw;
        var q0 = toS([wl.a[0] + ux2 * (t - def.w / 2), wl.a[1] + uy2 * (t - def.w / 2)]), q1 = toS([wl.a[0] + ux2 * (t + def.w / 2), wl.a[1] + uy2 * (t + def.w / 2)]);
        x.strokeStyle = "#f59e2c"; x.lineWidth = Math.max(3, wl.thick * S.zoom); x.beginPath(); x.moveTo(q0[0], q0[1]); x.lineTo(q1[0], q1[1]); x.stroke(); }
    }
    if (S.hover && !print && (S.tool === "item" || S.tool === "stairs")) {
      var ghost = S.tool === "item" ? G.rectOf(S.hover[0], S.hover[1], S.libRot + 90, G.CATALOGUE[S.libType].w, G.CATALOGUE[S.libType].d) : G.rectOf(S.hover[0], S.hover[1], S.libRot, 1, 3.6);
      x.strokeStyle = "#f59e2c"; x.setLineDash([4, 3]); x.beginPath(); ghost.map(toS).forEach(function (p, i) { if (i) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); }); x.closePath(); x.stroke(); x.setLineDash([]);
    }
    if (S.hover && !print && S.tool !== "select" && S.tool !== "pan") { var hs = toS(S.hover); x.strokeStyle = "rgba(245,158,44,.7)"; x.lineWidth = 1; x.beginPath(); x.moveTo(hs[0] - 7, hs[1]); x.lineTo(hs[0] + 7, hs[1]); x.moveTo(hs[0], hs[1] - 7); x.lineTo(hs[0], hs[1] + 7); x.stroke(); }
    // the north arrow + the scale
    var na = (270 + (m.light.north || 0)) * Math.PI / 180, nc = [W - 28, 30];
    x.strokeStyle = print ? "#333" : "#d8d0c0"; x.fillStyle = x.strokeStyle; x.lineWidth = 2; arrow(x, [nc[0] - Math.cos(na) * 14, nc[1] - Math.sin(na) * 14], [nc[0] + Math.cos(na) * 14, nc[1] + Math.sin(na) * 14], x.strokeStyle);
    label(x, "N", nc[0] + Math.cos(na) * 24, nc[1] + Math.sin(na) * 24, x.strokeStyle, 10, true);
    x.fillStyle = print ? "#333" : "#8f8778"; x.fillRect(12, H - 16, S.zoom, 3); label(x, "1 m", 12 + S.zoom / 2, H - 24, x.fillStyle, 10);
  }
  function label(x, t, cx, cy, color, size, bold) { x.font = (bold ? "600 " : "") + (size || 10) + "px system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = color; x.fillText(t, cx, cy); }
  function arrow(x, a, b, color) { x.strokeStyle = color; x.fillStyle = color; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); var ang = Math.atan2(b[1] - a[1], b[0] - a[0]); x.beginPath(); x.moveTo(b[0], b[1]); x.lineTo(b[0] - Math.cos(ang - 0.45) * 8, b[1] - Math.sin(ang - 0.45) * 8); x.lineTo(b[0] - Math.cos(ang + 0.45) * 8, b[1] - Math.sin(ang + 0.45) * 8); x.closePath(); x.fill(); }
  function hexA(hex, a) { var h = /^#[0-9a-f]{6}$/i.test(hex || "") ? hex : "#888888"; return "rgba(" + parseInt(h.substr(1, 2), 16) + "," + parseInt(h.substr(3, 2), 16) + "," + parseInt(h.substr(5, 2), 16) + "," + a + ")"; }
  function isSel(kind, id) { if (S.sel && S.sel.kind === kind && S.sel.id === id) return true; return !!(S.multi && S.multi.some(function (q) { return q.kind === kind && q.id === id; })); }
  function many() { return !!(S.multi && S.multi.length > 1); }

  /* ---------------- 2.532.0: ⬚ select - handles (↻ turn, ▪ size), a box / Shift+click for several, a camera walked
     Tim: "add a select button to the house builder to select components, rotate and scale. allow user to grab the camera
     and drag it through the floorplan. update the 3d view to the camera view as it moves. up and down arrows change pitch,
     left and right change yaw. shift button raises cameras elevation to maximum 3m over the roof, alt button drops camera
     elevation to min. ground floor floor." */
  function frameOf(k, o) {                 // a piece's own axes: u (w / len) and v (d / w) - its corners size it
    if (!o) return null;
    if (k === "item" || k === "stairs") {
      var a = o.rot * Math.PI / 180, u = [Math.cos(a), Math.sin(a)], v = [-Math.sin(a), Math.cos(a)];
      return k === "item" ? { c: [o.x, o.y], u: u, v: v, hu: o.w / 2, hv: o.d / 2, ku: "w", kv: "d", rot: "rot", off: 90 }
        : { c: [o.x, o.y], u: u, v: v, hu: o.len / 2, hv: o.w / 2, ku: "len", kv: "w", rot: "rot", off: 90 };
    }
    if (k === "person") return { c: [o.x, o.y], rot: "rot", off: 0, knob: 0.7 };
    if (k === "camera") return { c: [o.x, o.y], rot: "yaw", off: 0, knob: 0.9 };
    if (k === "light") return { c: [o.x, o.y], reach: "reach" };
    return null;
  }
  /** the handles of one piece (plan metres): {h: "scale", su, sv, p} ×4 + {h: "rot", p, from} (pure but for S.zoom) */
  function handles(k, o) {
    var F = frameOf(k, o), out = []; if (!F) return out;
    if (F.reach) { out.push({ h: "reach", p: [F.c[0] + o.reach, F.c[1]] }); return out; }   // 2.538.0: ◯ the dot on its circle
    if (F.u) {
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (sg) { out.push({ h: "scale", su: sg[0], sv: sg[1], p: [F.c[0] + F.u[0] * F.hu * sg[0] + F.v[0] * F.hv * sg[1], F.c[1] + F.u[1] * F.hu * sg[0] + F.v[1] * F.hv * sg[1]] }); });
      var kd = F.hv + Math.max(0.35, 22 / S.zoom);
      out.push({ h: "rot", p: [F.c[0] - F.v[0] * kd, F.c[1] - F.v[1] * kd], from: [F.c[0] - F.v[0] * F.hv, F.c[1] - F.v[1] * F.hv] });
    } else {
      var an = o[F.rot] * Math.PI / 180, kn = Math.max(F.knob, 30 / S.zoom);
      out.push({ h: "rot", p: [F.c[0] + Math.cos(an) * kn, F.c[1] + Math.sin(an) * kn], from: F.c });
    }
    return out;
  }
  /** a corner dragged to p: the opposite corner stays (keep = the same proportions) -> {size u, size v, x, y} (pure) */
  function scaleTo(F, hd, p, keep) {
    var opp = [F.c[0] - F.u[0] * F.hu * hd.su - F.v[0] * F.hv * hd.sv, F.c[1] - F.u[1] * F.hu * hd.su - F.v[1] * F.hv * hd.sv];
    var dq = [p[0] - opp[0], p[1] - opp[1]];
    var nu = Math.max(0.1, snap((dq[0] * F.u[0] + dq[1] * F.u[1]) * hd.su)), nv = Math.max(0.1, snap((dq[0] * F.v[0] + dq[1] * F.v[1]) * hd.sv));
    if (keep) { var kk = Math.max(nu / (2 * F.hu), nv / (2 * F.hv)); nu = Math.max(0.1, snap(2 * F.hu * kk)); nv = Math.max(0.1, snap(2 * F.hv * kk)); }
    return { u: nu, v: nv, x: opp[0] + F.u[0] * nu / 2 * hd.su + F.v[0] * nv / 2 * hd.sv, y: opp[1] + F.u[1] * nu / 2 * hd.su + F.v[1] * nv / 2 * hd.sv };
  }
  /** the ↻ handle dragged to p -> the angle (15° steps unless free) (pure) */
  function turnTo(F, p, free) { var a = Math.atan2(p[1] - F.c[1], p[0] - F.c[0]) * 180 / Math.PI + F.off; if (!free) a = Math.round(a / 15) * 15; return ((Math.round(a) % 360) + 360) % 360; }
  function hitHandle(e) {
    if (!S.sel || many() || S.tool !== "select") return null;
    var o = selObj(); if (!o) return null;
    var r = cv().getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top, best = null;
    handles(S.sel.kind, o).forEach(function (hd) { var q = toS(hd.p), dd = Math.hypot(q[0] - sx, q[1] - sy); if (dd <= 8 && (!best || dd < best.dd)) best = Object.assign({ dd: dd }, hd); });
    return best;
  }
  function ptsOf(k, o) { return o.x != null ? [[o.x, o.y]] : o.poly ? o.poly : o.a ? [o.a, o.b] : []; }
  function centerOf(list) {
    var xs = [], ys = []; list.forEach(function (q) { var o = find(q.kind, q.id); if (o) ptsOf(q.kind, o).forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
    return xs.length ? [(Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2] : [0, 0];
  }
  function rotPt(p, c, deg) { var a = deg * Math.PI / 180, dx = p[0] - c[0], dy = p[1] - c[1]; return [c[0] + dx * Math.cos(a) - dy * Math.sin(a), c[1] + dx * Math.sin(a) + dy * Math.cos(a)]; }
  function deg360(v) { return ((Math.round(v) % 360) + 360) % 360; }
  /** turn a piece about c (a group's centre, or its own) - clockwise on the plan, like R (pure on o) */
  function rotObj(k, o, c, deg) {
    if (o.x != null) { var q = rotPt([o.x, o.y], c, deg); o.x = q[0]; o.y = q[1]; if (k === "camera") o.yaw = deg360(o.yaw + deg); else if (o.rot != null) o.rot = deg360(o.rot + deg); }
    else if (o.poly) o.poly = o.poly.map(function (p) { return rotPt(p, c, deg); });
    else if (o.a) { o.a = rotPt(o.a, c, deg); o.b = rotPt(o.b, c, deg); }
  }
  function moveObj(o, orig, dx, dy) {
    if (orig.x != null) { o.x = snap(orig.x + dx); o.y = snap(orig.y + dy); }
    else if (orig.poly) o.poly = orig.poly.map(function (p) { return [snap(p[0] + dx), snap(p[1] + dy)]; });
    else if (orig.a) { o.a = [snap(orig.a[0] + dx), snap(orig.a[1] + dy)]; o.b = [snap(orig.b[0] + dx), snap(orig.b[1] + dy)]; }
  }
  /** everything on this floor inside the box a-b: pieces by their centre, rooms / walls when all of them is inside */
  function boxPick(a, b) {
    var x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]), f = S.floor, m = S.m, out = [];
    var inB = function (p) { return p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1; };
    [["item", m.items], ["stairs", m.stairs], ["camera", m.cameras], ["person", m.people || []], ["light", m.lights || []], ["room", m.rooms], ["wall", m.walls]].forEach(function (g) {
      g[1].forEach(function (o) { if (o.floor === f && ptsOf(g[0], o).every(inB)) out.push({ kind: g[0], id: o.id }); });
    });
    return out;
  }
  function removeObj(k, idv) {
    var m = S.m, arr = { wall: "walls", room: "rooms", item: "items", opening: "openings", stairs: "stairs", camera: "cameras", person: "people", light: "lights" }[k];
    if (!arr || !m[arr]) return;
    m[arr] = m[arr].filter(function (x) { return x.id !== idv; });
    if (k === "wall") m.openings = m.openings.filter(function (q) { return q.wall !== idv; });
  }
  function turnSel(deg) {
    var list = many() ? S.multi : S.sel ? [S.sel] : [];
    if (!list.length) return false;
    snapshot();
    var c = list.length === 1 && (list[0].kind === "room" || list[0].kind === "wall") ? centerOf(list) : list.length === 1 ? null : centerOf(list);
    list.forEach(function (q) { var o = find(q.kind, q.id); if (!o) return; if (c) rotObj(q.kind, o, c, deg); else if (q.kind === "camera") o.yaw = deg360(o.yaw + deg); else if (o.rot != null) o.rot = deg360(o.rot + deg); });
    changed(); return true;
  }

  /* the walking camera: the selected one, or the one the 3D view looks through */
  function walkCam() {
    if (many()) return null;
    if (S.sel && S.sel.kind === "camera") return find("camera", S.sel.id);
    if (!S.sel && S.look !== "orbit") return find("camera", S.look);
    return null;
  }
  /** the 3D view looks through c (the plan-only view shows both) */
  function lookThrough(c) {
    if (!c || S.look === c.id) return;
    S.look = c.id; var s = $("hbLook"); if (s) s.value = c.id;
    if (S.view === "plan") setView("both"); else rebuild3d();
    tev("house_walk", c.name);
  }
  var camT = null;
  function camTouched(c) {
    lookThrough(c); applyLook(); paint(); S.dirty = true;
    clearTimeout(camT); camT = setTimeout(function () { S.m = G.normalize(S.m); paintSide(); if (S.slug) { clearTimeout(S.saveT); S.saveT = setTimeout(function () { save(true); }, 20000); } }, 350);
  }
  function elevText(c) { var E = G.elevations(S.m), R = G.heightRange(S.m), abs = (E[c.floor] || 0) + c.z; return "📷 " + c.name + " · " + abs.toFixed(2) + " m over the ground (" + (S.m.floors[c.floor] || {}).name + " + " + c.z.toFixed(2) + " m) · " + R.min.toFixed(2) + "–" + R.max.toFixed(2) + " m"; }
  /** hold Shift (dir 1) / Alt (dir -1): the camera rises / sinks 2 m a second */
  function glide(dir) {
    var c0 = walkCam(); if (!c0) return false;
    if (S.walk) { S.walk.dir = dir; return true; }
    snapshot(); lookThrough(c0);
    S.walk = { dir: dir, id: c0.id, t: (root.performance || Date).now() };
    var step = function (now) {
      var w = S.walk; if (!w) return;
      var c = find("camera", w.id); if (!c) { S.walk = null; return; }
      var dt = Math.max(0, Math.min(0.1, ((now || Date.now()) - w.t) / 1000)); w.t = now || Date.now();
      var r = walkStep(S.m, c, w.dir, dt);
      if (r.floorChanged && S.sel && S.sel.id === c.id) { S.floor = c.floor; paintFloors(); }
      applyLook(); paint(); say(elevText(c), r.atEnd ? "hok" : "");
      w.raf = (root.requestAnimationFrame || setTimeout)(step, 16);
    };
    S.walk.raf = (root.requestAnimationFrame || setTimeout)(step, 16);
    return true;
  }
  /** one step of the glide (pure on m / c) -> {floorChanged, atEnd} */
  function walkStep(m, c, dir, dt) {
    var E = G.elevations(m), R = G.heightRange(m), abs = (E[c.floor] || 0) + c.z, want = abs + dir * 2 * dt;
    var nv = Math.max(R.min, Math.min(R.max, want)), at = G.camAt(m, nv), was = c.floor;
    c.floor = at.floor; c.z = Math.round(at.z * 1000) / 1000;
    return { floorChanged: at.floor !== was, atEnd: nv !== want, abs: nv };
  }
  function stopGlide() {
    clearTimeout(S.walkWait); S.walkWait = null;
    if (!S.walk) return;
    var w = S.walk; S.walk = null;
    try { (root.cancelAnimationFrame || clearTimeout)(w.raf); } catch (e) { /* fine */ }
    S.m = G.normalize(S.m); S.dirty = true; paintSide(); fillLook();
  }

  /* ---------------- picking + the tools */
  function pick(p) {
    var f = S.floor, m = S.m, tol = 8 / S.zoom;
    var c = m.cameras.find(function (x) { return x.floor === f && G.dist([x.x, x.y], p) < 0.3; }); if (c) return { kind: "camera", id: c.id };
    var pe = (m.people || []).find(function (x) { return x.floor === f && G.dist([x.x, x.y], p) < 0.3; }); if (pe) return { kind: "person", id: pe.id };
    var lt = (m.lights || []).find(function (x) { return x.floor === f && G.dist([x.x, x.y], p) < Math.max(0.25, 8 / S.zoom); }); if (lt) return { kind: "light", id: lt.id };   // 2.538.0: its centre
    var items = m.items.filter(function (it) { return it.floor === f && hitItem(it, p); }).sort(function (a, b) { return a.w * a.d - b.w * b.d; });
    if (items.length) return { kind: "item", id: items[0].id };
    var o = m.openings.find(function (q) { var w = find("wall", q.wall); if (!w || w.floor !== f) return false; var L = G.dist(w.a, w.b), ux = (w.b[0] - w.a[0]) / L, uy = (w.b[1] - w.a[1]) / L, c0 = [w.a[0] + ux * q.t, w.a[1] + uy * q.t]; return G.dist(c0, p) < Math.max(q.w / 2, 0.25) && ptSegDist(p, w.a, w.b) < w.thick / 2 + tol; });
    if (o) return { kind: "opening", id: o.id };
    var s = m.stairs.find(function (x) { return x.floor === f && hitItem({ x: x.x, y: x.y, rot: x.rot + 90, w: x.w, d: x.len }, p); }); if (s) return { kind: "stairs", id: s.id };
    var ws = m.walls.filter(function (w) { return w.floor === f && ptSegDist(p, w.a, w.b) < w.thick / 2 + tol; });
    if (ws.length) { var w = ws[0], end = G.dist(p, w.a) < 0.25 ? "a" : G.dist(p, w.b) < 0.25 ? "b" : null; return { kind: "wall", id: w.id, end: end }; }
    var r = m.rooms.filter(function (x) { return x.floor === f && G.inside(p, x.poly); }).sort(function (a, b) { return Math.abs(G.area(a.poly)) - Math.abs(G.area(b.poly)); });
    if (r.length) return { kind: "room", id: r[0].id };
    return null;
  }
  function down(e) {
    if (!S.m) return;
    clearTimeout(S.walkWait); S.walkWait = null;               // a Shift+click is not a camera rising
    var c = cv(); c.focus && $("hbBody").focus();
    if (e.button === 2 || S.tool === "pan" || e.button === 1) { S.drag = { pan: true, x: e.clientX, y: e.clientY, ox: S.ox, oy: S.oy }; e.preventDefault(); return; }
    var p = evPt(e), q = snapPt(p, e), m = S.m, f = S.floor;
    if (S.scaleMode && m.trace) { scaleClick(p); return; }
    if (S.tool === "tracemove" && m.trace) { snapshot(); S.drag = { trace: true, start: p, ox: m.trace.x, oy: m.trace.y, moved: false }; return; }
    if (S.tool === "select") {
      var hd = hitHandle(e);
      if (hd) { var o0 = selObj(); snapshot(); S.drag = { handle: hd, sel: S.sel, orig: JSON.parse(JSON.stringify(o0)), moved: false }; return; }
      var h = pick(p);
      if (e.shiftKey && h) {                                   // Shift+click: add / take off
        var L = S.multi ? S.multi.slice() : (S.sel ? [S.sel] : []), at = L.findIndex(function (z) { return z.kind === h.kind && z.id === h.id; });
        if (at >= 0) L.splice(at, 1); else L.push({ kind: h.kind, id: h.id });
        S.multi = L.length > 1 ? L : null; S.sel = L.length ? L[L.length - 1] : null;
        if (L.length > 1) tev("house_select", L.length + " pieces");
        paintSide(); paint(); return;
      }
      if (h && many() && isSel(h.kind, h.id)) {                // drag one of several = move them all
        snapshot(); S.drag = { group: true, start: q, orig: S.multi.map(function (z) { return JSON.parse(JSON.stringify(find(z.kind, z.id) || {})); }), moved: false }; return;
      }
      S.multi = null; S.sel = h; paintSide();
      if (h) { var o = selObj(); snapshot(); S.drag = { sel: h, start: q, orig: JSON.parse(JSON.stringify(o)), moved: false, walls: h.kind === "wall" && h.end ? cornerWalls(o[h.end]) : null }; }
      else S.drag = { box: true, a: p, b: p };
      paint(); return;
    }
    if (S.tool === "room") { S.draft = { kind: "room", a: q, b: q }; return; }
    if (S.tool === "poly") {
      S.draft = S.draft && S.draft.kind === "poly" ? S.draft : { kind: "poly", pts: [] };
      if (S.draft.pts.length >= 3 && G.dist(q, S.draft.pts[0]) < 12 / S.zoom) { finishPoly(); return; }
      S.draft.pts.push(q); paint(); return;
    }
    if (S.tool === "wall") {
      S.draft = S.draft && S.draft.kind === "wall" ? S.draft : { kind: "wall", pts: [] };
      var qq = S.draft.pts.length ? ortho(S.draft.pts[S.draft.pts.length - 1], q, e) : q;
      if (S.draft.pts.length) { var a = S.draft.pts[S.draft.pts.length - 1]; if (G.dist(a, qq) > 0.05) { snapshot(); G.uncovered(m, f, a, qq).forEach(function (sg) { m.walls.push({ id: G.newId("w"), floor: f, a: sg[0], b: sg[1], thick: 0.15, mat: "plaster", color: G.MATERIALS.plaster.color }); }); changed(); } }
      S.draft.pts.push(qq); paint(); return;
    }
    if (/^(door|window|slide|opening|garage)$/.test(S.tool)) {
      var nw = G.nearestWall(m, f, p, 0.6);
      if (!nw) { say("click on a wall", "hbad"); return; }
      var def = G.OPENINGS[S.tool], L = G.dist(nw.wall.a, nw.wall.b);
      if (L < def.w + 0.05) { say("that wall is too short for a " + def.label.toLowerCase(), "hbad"); return; }
      snapshot(); var op = { id: G.newId("o"), wall: nw.wall.id, kind: S.tool, t: snap(Math.max(def.w / 2, Math.min(L - def.w / 2, nw.t))), w: def.w, h: def.h, sill: def.sill };
      m.openings.push(op); S.sel = { kind: "opening", id: op.id }; changed(); return;
    }
    if (S.tool === "item") { snapshot(); var c0 = G.CATALOGUE[S.libType], it = { id: G.newId("i"), floor: f, type: S.libType, x: q[0], y: q[1], rot: S.libRot, w: c0.w, d: c0.d, h: c0.h, color: c0.color || "" }; m.items.push(it); S.sel = { kind: "item", id: it.id }; changed(); return; }
    if (S.tool === "stairs") {
      if (f >= m.floors.length - 1) { say("stairs go up to the floor above - ＋ add a floor first", "hbad"); return; }
      snapshot(); var st = { id: G.newId("s"), floor: f, x: q[0], y: q[1], rot: S.libRot, w: 1, len: 3.6 }; m.stairs.push(st); S.sel = { kind: "stairs", id: st.id }; changed(); return;
    }
    if (S.tool === "camera") { S.draft = { kind: "camera", at: q, yaw: 0 }; return; }
    if (S.tool === "person") { S.draft = { kind: "person", at: q, yaw: 90 }; return; }
    if (S.tool === "light") { S.draft = { kind: "light", at: q, reach: 4, moved: false }; paint(); return; }
  }
  function cornerWalls(pt) { var out = []; S.m.walls.forEach(function (w) { if (w.floor !== S.floor) return; if (G.dist(w.a, pt) < 0.01) out.push([w.id, "a"]); if (G.dist(w.b, pt) < 0.01) out.push([w.id, "b"]); }); return out; }
  function ortho(a, q, e) { if (e && e.shiftKey) return q; var dx = q[0] - a[0], dy = q[1] - a[1], ang = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI) % 90; if (ang < 8 || ang > 82) return Math.abs(dx) > Math.abs(dy) ? [q[0], a[1]] : [a[0], q[1]]; return q; }
  function move(e) {
    if (!S.m) return;
    if (S.drag && S.drag.pan) { S.ox = S.drag.ox + e.clientX - S.drag.x; S.oy = S.drag.oy + e.clientY - S.drag.y; paint(); return; }
    var p = evPt(e), q = snapPt(p, e);
    S.hover = S.draft && S.draft.kind === "wall" && S.draft.pts.length ? ortho(S.draft.pts[S.draft.pts.length - 1], q, e) : q;
    if (S.draft && S.draft.kind === "room") S.draft.b = q;
    if (S.draft && S.draft.kind === "person" && G.dist(S.draft.at, p) > 0.15) S.draft.yaw = Math.atan2(p[1] - S.draft.at[1], p[0] - S.draft.at[0]) * 180 / Math.PI;
    if (S.draft && S.draft.kind === "light" && G.dist(S.draft.at, p) > 0.3) { S.draft.reach = reachOf(S.draft.at, p); S.draft.moved = true; }
    if (S.draft && S.draft.kind === "camera") S.draft.yaw = Math.atan2(p[1] - S.draft.at[1], p[0] - S.draft.at[0]) * 180 / Math.PI;
    var d = S.drag;
    if (d && d.box) { d.b = p; paint(); return; }
    if (d && d.handle) {
      var ho2 = selObj(); if (!ho2) return;
      var F = frameOf(d.sel.kind, d.orig);
      if (d.handle.h === "reach") ho2.reach = reachOf(F.c, p);
      else if (d.handle.h === "rot") ho2[F.rot] = turnTo(F, p, e.shiftKey);
      else { var sc = scaleTo(F, d.handle, p, e.shiftKey); ho2[F.ku] = sc.u; ho2[F.kv] = sc.v; ho2.x = sc.x; ho2.y = sc.y; }
      d.moved = true;
      if (d.sel.kind === "camera") camTouched(ho2); else paint();
      return;
    }
    if (d && d.group) {
      var gx2 = q[0] - d.start[0], gy2 = q[1] - d.start[1]; if (Math.abs(gx2) + Math.abs(gy2) > 0) d.moved = true;
      S.multi.forEach(function (z, i) { var oz = find(z.kind, z.id); if (oz) moveObj(oz, d.orig[i], gx2, gy2); });
      paint(); return;
    }
    if (d && d.trace) { S.m.trace.x = d.ox + p[0] - d.start[0]; S.m.trace.y = d.oy + p[1] - d.start[1]; d.moved = true; paint(); return; }
    if (d && d.sel) {
      var o = selObj(); if (!o) return;
      var dx = q[0] - d.start[0], dy = q[1] - d.start[1]; if (Math.abs(dx) + Math.abs(dy) > 0) d.moved = true;
      var k = d.sel.kind;
      if (k === "item" || k === "stairs" || k === "camera" || k === "person" || k === "light") { o.x = snap(d.orig.x + dx); o.y = snap(d.orig.y + dy); if (k === "camera" && d.moved) { camTouched(o); return; } }
      else if (k === "room") o.poly = d.orig.poly.map(function (pp) { return [snap(pp[0] + dx), snap(pp[1] + dy)]; });
      else if (k === "wall" && d.walls) d.walls.forEach(function (we) { var w = find("wall", we[0]); if (w) w[we[1]] = q; });
      else if (k === "wall") { o.a = [snap(d.orig.a[0] + dx), snap(d.orig.a[1] + dy)]; o.b = [snap(d.orig.b[0] + dx), snap(d.orig.b[1] + dy)]; }
      else if (k === "opening") { var w2 = find("wall", o.wall); if (w2) { var L = G.dist(w2.a, w2.b), ux = (w2.b[0] - w2.a[0]) / L, uy = (w2.b[1] - w2.a[1]) / L; o.t = snap(Math.max(o.w / 2, Math.min(L - o.w / 2, (p[0] - w2.a[0]) * ux + (p[1] - w2.a[1]) * uy))); } }
    }
    paint();
  }
  function up() {
    var d = S.drag; S.drag = null;
    if (d && d.box) {
      var r0 = cv().getBoundingClientRect(), pa = toS(d.a), pb = toS(d.b);
      if (Math.abs(pa[0] - pb[0]) + Math.abs(pa[1] - pb[1]) < 6) { paint(); return; }
      var got = boxPick(d.a, d.b); void r0;
      S.multi = got.length > 1 ? got : null; S.sel = got[0] || null;
      if (got.length > 1) tev("house_select", got.length + " pieces");
      paintSide(); paint(); return;
    }
    if (d && d.handle) { if (d.moved) { changed(); if (d.handle.h === "scale") tev("house_scale", d.sel.kind); if (d.handle.h === "reach") tev("house_light", "reach"); } else S.undo.pop(); return; }
    if (d && d.group) { if (d.moved) changed(); else S.undo.pop(); return; }
    if (d && d.trace) { if (d.moved) changed(); else S.undo.pop(); return; }
    if (d && d.sel) { if (d.moved) changed(); else S.undo.pop(); return; }
    var df = S.draft;
    if (df && df.kind === "room") {
      S.draft = null;
      var x0 = Math.min(df.a[0], df.b[0]), x1 = Math.max(df.a[0], df.b[0]), y0 = Math.min(df.a[1], df.b[1]), y1 = Math.max(df.a[1], df.b[1]);
      if (x1 - x0 < 0.5 || y1 - y0 < 0.5) { paint(); return; }
      snapshot(); var r = G.addRoom(S.m, S.floor, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], "Room " + (S.m.rooms.length + 1)); S.sel = { kind: "room", id: r.id }; changed(); return;
    }
    if (df && df.kind === "person") {
      S.draft = null; snapshot();
      S.m.people = S.m.people || [];
      var pq = { id: G.newId("p"), floor: S.floor, x: df.at[0], y: df.at[1], rot: Math.round(((df.yaw % 360) + 360) % 360), pose: "stand", h: 1.75, char: "", name: "", color: "" };
      S.m.people.push(pq); S.sel = { kind: "person", id: pq.id }; changed(); return;
    }
    if (df && df.kind === "light") {          // 2.538.0: ◯ a light where it was pressed, reaching as far as it was dragged
      S.draft = null; snapshot();
      S.m.lights = S.m.lights || [];
      var H0 = S.m.floors[S.floor].height, lq = { id: G.newId("l"), floor: S.floor, name: "Light " + (S.m.lights.length + 1), x: df.at[0], y: df.at[1], z: Math.max(0.3, Math.round((H0 - 0.3) * 20) / 20), intensity: 1, color: "#ffd9a0", reach: df.reach };
      var lrm = G.roomOf(S.m, S.floor, df.at); if (lrm) lq.name = lrm.name + " light" + (S.m.lights.some(function (z) { return z.name === lrm.name + " light"; }) ? " " + (S.m.lights.length + 1) : "");
      S.m.lights.push(lq); S.sel = { kind: "light", id: lq.id }; tev("house_light", lq.name); changed(); return;
    }
    if (df && df.kind === "camera") {
      S.draft = null; snapshot();
      var cm = { id: G.newId("c"), floor: S.floor, name: "Camera " + (S.m.cameras.length + 1), x: df.at[0], y: df.at[1], z: 1.6, yaw: Math.round(df.yaw), pitch: 0, fov: 70 };
      var rm = G.roomOf(S.m, S.floor, df.at); if (rm) cm.name = rm.name + (S.m.cameras.some(function (c) { return c.name === rm.name; }) ? " " + (S.m.cameras.length + 1) : "");
      S.m.cameras.push(cm); S.sel = { kind: "camera", id: cm.id }; changed(); fillLook(); lookThrough(find("camera", cm.id)); return;
    }
  }
  function finishPoly() {
    var d = S.draft; S.draft = null;
    if (d && d.pts.length >= 3) { snapshot(); var r = G.addRoom(S.m, S.floor, d.pts, "Room " + (S.m.rooms.length + 1)); S.sel = { kind: "room", id: r.id }; changed(); }
    else paint();
  }
  function key(e) {
    if (!S.m) return;
    var t = e.target, typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
    if (e.ctrlKey && !e.altKey && (e.key === "z" || e.key === "Z") && !typing) { e.preventDefault(); e.stopPropagation(); if (e.shiftKey) redo(); else undo(); return; }
    if (e.ctrlKey && !e.altKey && (e.key === "y" || e.key === "Y") && !typing) { e.preventDefault(); e.stopPropagation(); redo(); return; }
    if (e.ctrlKey && !e.altKey && (e.key === "s" || e.key === "S")) { e.preventDefault(); e.stopPropagation(); save(); return; }
    // 2.532.0: hold Shift = the camera rises, hold Alt = it sinks (a short wait: Shift+click / Shift+R are not a rise)
    if (!typing && (e.key === "Shift" || e.key === "Alt") && !e.ctrlKey && !e.metaKey && (walkCam() || S.walk)) {
      if (e.key === "Alt") e.preventDefault();
      e.stopPropagation();
      var dir = e.key === "Shift" ? 1 : -1;
      if (S.walk) { S.walk.dir = dir; return; }
      if (!e.repeat && !S.walkWait) S.walkWait = setTimeout(function () { S.walkWait = null; glide(dir); }, e.key === "Alt" ? 0 : 160);
      return;
    }
    if (e.key !== "Shift" && e.key !== "Alt") { clearTimeout(S.walkWait); S.walkWait = null; }
    if (typing || e.ctrlKey || e.altKey || e.metaKey) return;
    e.stopPropagation();
    if (e.key === "Escape") { stopGlide(); if (S.draft && S.draft.kind === "poly" && S.draft.pts.length >= 3) finishPoly(); S.draft = null; S.sel = null; S.multi = null; paint(); paintSide(); return; }
    if (e.key === "Enter" && S.draft) { if (S.draft.kind === "poly") finishPoly(); else { S.draft = null; paint(); } return; }
    if (e.key === "v" || e.key === "V") { setTool("select"); return; }
    if (e.key === "r" || e.key === "R") {
      var d = e.shiftKey ? -15 : 15;
      if (S.tool === "item" || S.tool === "stairs") { S.libRot = ((S.libRot + (S.tool === "item" ? (e.shiftKey ? -90 : 90) : 90)) % 360 + 360) % 360; paint(); return; }
      if (S.sel && S.sel.kind !== "opening") turnSel(d);       // 2.532: several pieces turn about their middle, a room / wall about its own
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") { delSel(); e.preventDefault(); return; }
    // 2.532.0: a camera: ← → turn it (yaw), ↑ ↓ tilt it (pitch) - the 3D view looks through it
    var wc = /^Arrow/.test(e.key) ? walkCam() : null;
    if (wc) {
      e.preventDefault(); if (!e.repeat) snapshot();
      if (e.key === "ArrowLeft") wc.yaw = deg360(wc.yaw - 3); else if (e.key === "ArrowRight") wc.yaw = deg360(wc.yaw + 3);
      else wc.pitch = Math.max(-80, Math.min(80, wc.pitch + (e.key === "ArrowUp" ? 2 : -2)));
      camTouched(wc); say(elevText(wc) + " · looks " + wc.yaw + "°, tilt " + wc.pitch + "°"); return;
    }
    var mv = { ArrowLeft: [-0.05, 0], ArrowRight: [0.05, 0], ArrowUp: [0, -0.05], ArrowDown: [0, 0.05] }[e.key];
    if (mv && many()) { e.preventDefault(); snapshot(); S.multi.forEach(function (z) { var oz = find(z.kind, z.id); if (oz) moveObj(oz, JSON.parse(JSON.stringify(oz)), mv[0], mv[1]); }); changed(); return; }
    if (mv && S.sel) {
      e.preventDefault(); var o2 = selObj(); if (!o2) return; snapshot();
      if (o2.x != null) { o2.x += mv[0]; o2.y += mv[1]; } else if (o2.poly) o2.poly = o2.poly.map(function (p) { return [p[0] + mv[0], p[1] + mv[1]]; }); else if (o2.a) { o2.a = [o2.a[0] + mv[0], o2.a[1] + mv[1]]; o2.b = [o2.b[0] + mv[0], o2.b[1] + mv[1]]; }
      changed();
    }
  }
  function delSel() {
    if (!S.sel && !many()) return; snapshot();
    (many() ? S.multi : [S.sel]).forEach(function (z) { removeObj(z.kind, z.id); });
    S.sel = null; S.multi = null; changed(); fillLook();
  }
  function setTool(t) {
    S.tool = t; S.draft = null;
    document.querySelectorAll("#hbBody .htools button").forEach(function (b) { b.classList.toggle("on", b.dataset.tool === t); });
    cv().style.cursor = t === "pan" || t === "tracemove" ? "grab" : t === "select" ? "default" : "crosshair";
    paintSide(); paint();
  }

  /* ---------------- 2.539.0: 🖼 pictures from the References docker (kept with the house: refs/<file>) */
  function refUrl(file) { return "/api/house/" + encodeURIComponent(S.slug) + "/ref/" + encodeURIComponent(file); }
  function refOf(rid) { return rid ? (S.m.refs || []).find(function (q) { return q.id === rid; }) || null : null; }
  var REFKIND = { wall: "wall", room: "floor", item: "furniture", light: "light" };
  function refRowHtml(k, o) {
    var tex = k === "wall" || k === "room", rid = tex ? o.tex : o.ref, q = refOf(rid);
    var title = tex ? (k === "room" ? "🖼 Floor picture" : "🖼 Wall picture") : "🖼 Looks like";
    var tip = tex ? "A picture from the References docker on it - its texture in the 3D view, the shots and the panoramas (drag one from the References docker onto it on the plan, too)"
      : "A picture of the real thing - ✨ Make it real paints it in (the 3D view keeps the simple shape). Drag one from the References docker onto it on the plan, too";
    return '<h5 style="margin-top:8px" title="' + esc(tip) + '">' + title + "</h5>"
      + (q ? '<div class="hbref"><img src="' + esc(refUrl(q.file)) + '" alt=""><span>' + esc(q.desc || q.file) + "</span></div>" : '<div class="hnote">none - ' + (tex ? "its material and colour" : "the plain shape") + "</div>")
      + (q ? '<div class="hf">' + fld("Description", '<input type="text" id="hbRefDesc" maxlength="200" value="' + esc(q.desc) + '" placeholder="what it is">') + (tex ? fld("Tile (m)", '<input type="number" data-k="texScale" step="0.1" min="0.1" max="10" value="' + (o.texScale || 1) + '" title="How many metres one copy of the picture covers">') : "") + "</div>" : "")
      + '<div class="hbar" style="margin-top:4px"><button type="button" class="ghost" id="hbRefPick" title="Pick one of the References docker\'s pictures (wall / floor / furniture / light first)">🖼 From References…</button>'
      + '<label class="ghost" style="padding:3px 8px;border:1px solid var(--line,#444);border-radius:5px;cursor:pointer">From disk…<input type="file" id="hbRefFile" accept="image/png,image/jpeg,image/webp" style="display:none"></label>'
      + (q ? '<button type="button" class="ghost" id="hbRefOff" title="Take the picture off (it stays with the house)">✕</button>' : "") + "</div>"
      + '<div class="hbrefpick" id="hbRefList" style="display:none"></div>';
  }
  function bindRefRow(k, o) {
    if (!o || !$("hbRefPick")) return;
    var target = { kind: k, id: o.id };
    $("hbRefPick").onclick = function () { refPicker(target); };
    if ($("hbRefFile")) $("hbRefFile").onchange = function (e) { var f = e.target.files && e.target.files[0]; if (f) attachRef(target, { blob: f, name: f.name, desc: "" }); };
    if ($("hbRefOff")) $("hbRefOff").onclick = function () { var ob = find(target.kind, target.id); if (!ob) return; snapshot(); if (k === "wall" || k === "room") { delete ob.tex; delete ob.texScale; } else delete ob.ref; changed(); rebuild3d(); };
    if ($("hbRefDesc")) $("hbRefDesc").onchange = function () { var ob = find(target.kind, target.id), q = ob && refOf(k === "wall" || k === "room" ? ob.tex : ob.ref); if (!q) return; snapshot(); q.desc = $("hbRefDesc").value.replace(/\s+/g, " ").trim().slice(0, 200); changed(); };
  }
  /** the References docker's pictures (window.H3Refs, static/index.html) + this house's own, to pick from */
  function refPicker(target) {
    var box = $("hbRefList"); if (!box) return;
    if (box.style.display !== "none") { box.style.display = "none"; return; }
    var want = REFKIND[target.kind], dock = root.H3Refs ? H3Refs.images() : [];
    if (root.RefInfo) dock = RefInfo.houseFirst(dock, want);
    var mine = S.m.refs || [];
    box.innerHTML = (dock.length ? "<h6>References docker</h6>" + dock.map(function (r) { return '<button type="button" class="ghost" data-dockref="' + r.i + '" title="' + esc((r.role ? r.role + " - " : "") + (r.desc || r.name)) + '"><img src="' + esc(r.url) + '" alt=""><span>' + esc(r.desc || r.name) + "</span></button>"; }).join("")
        : '<div class="hnote">The References docker has no pictures - drop some in its Image tab (Type: wall / floor / furniture / light)</div>')
      + (mine.length ? "<h6>In this house</h6>" + mine.map(function (q) { return '<button type="button" class="ghost" data-houseref="' + esc(q.id) + '" title="' + esc(q.desc || q.file) + '"><img src="' + esc(refUrl(q.file)) + '" alt=""><span>' + esc(q.desc || q.file) + "</span></button>"; }).join("") : "");
    box.style.display = "";
    box.querySelectorAll("[data-dockref]").forEach(function (b) { b.onclick = function () { var r = (root.H3Refs ? H3Refs.images() : [])[+b.dataset.dockref]; if (r) fromDock(target, r); }; });
    box.querySelectorAll("[data-houseref]").forEach(function (b) { b.onclick = function () { useRef(target, b.dataset.houseref); }; });
  }
  function fromDock(target, r) {
    var get = r.file ? Promise.resolve(r.file) : fetch(r.url).then(function (x) { return x.blob(); });
    return get.then(function (blob) { return attachRef(target, { blob: blob, name: r.name, desc: r.desc || "", role: r.role }); });
  }
  /** a picture -> kept with the house (POST /api/house/<slug>/ref) -> on the piece */
  function attachRef(target, src) {
    return needSaved().then(function () {
      return fetch("/api/house/" + encodeURIComponent(S.slug) + "/ref?name=" + encodeURIComponent(src.name || "ref.png"), { method: "POST", headers: { "Content-Type": (src.blob && src.blob.type) || "application/octet-stream" }, body: src.blob }).then(function (x) { return x.json(); });
    }).then(function (j) {
      if (!j || j.error) { say("🖼 " + ((j && j.error) || "not kept"), "hbad"); return null; }
      S.m.refs = S.m.refs || [];
      var q = S.m.refs.find(function (z) { return z.file === j.file; });
      var kind = G.REF_KINDS.indexOf(src.role) >= 0 ? src.role : REFKIND[target.kind];
      if (!q) { q = { id: G.newId("x"), file: j.file, kind: kind, desc: String(src.desc || "").slice(0, 200) }; snapshot(); S.m.refs.push(q); }
      else if (src.desc && !q.desc) q.desc = String(src.desc).slice(0, 200);
      return useRef(target, q.id);
    }).catch(function (e) { say("🖼 " + (e && e.message || e), "hbad"); return null; });
  }
  function useRef(target, rid) {
    var ob = find(target.kind, target.id), q = refOf(rid); if (!ob || !q) return null;
    snapshot();
    if (target.kind === "wall" || target.kind === "room") { ob.tex = rid; ob.texScale = ob.texScale || 1; } else ob.ref = rid;
    S.sel = { kind: target.kind, id: target.id }; S.multi = null;
    changed(); rebuild3d();
    tev("house_ref", target.kind);
    say("🖼 " + (q.desc || q.file) + (target.kind === "wall" || target.kind === "room" ? " on the " + (target.kind === "room" ? "floor" : "wall") + " (its texture in 3D and the shots)" : " - ✨ Make it real paints it in"), "hok");
    return q;
  }
  /** a drop on the plan: a picture from the References docker (or a file) onto the wall / room / piece / light under it */
  function planDrop(e) {
    if (!S.m) return;
    var dt = e.dataTransfer, idx = dt ? dt.getData("application/x-h3ref") : "", f = dt && dt.files && dt.files[0];
    if (idx === "" && !(f && /^image\//.test(f.type))) return;
    e.preventDefault(); e.stopPropagation();
    var h = pick(evPt(e));
    if (!h || !/^(wall|room|item|light)$/.test(h.kind)) { say("🖼 drop it on a wall, a room, a piece of furniture or a light", "hbad"); return; }
    if (idx !== "") { var r = (root.H3Refs ? H3Refs.images() : [])[+idx]; if (r) fromDock({ kind: h.kind, id: h.id }, r); }
    else attachRef({ kind: h.kind, id: h.id }, { blob: f, name: f.name, desc: "" });
  }

  /* ---------------- the side panel */
  function fld(lbl, html) { return "<label>" + esc(lbl) + "</label>" + html; }
  function numIn(k, v, step, min, max) { return '<input type="number" data-k="' + k + '" value="' + v + '" step="' + (step || 0.05) + '"' + (min != null ? ' min="' + min + '"' : "") + (max != null ? ' max="' + max + '"' : "") + ">"; }
  function matSel(k, v, filter) { return '<select data-k="' + k + '">' + opt(Object.keys(G.MATERIALS).filter(filter || function () { return true; }).map(function (x) { return [x, G.MATERIALS[x].label]; }), v) + "</select>"; }
  function paintSide() {
    var host = $("hbProps"); if (!host || !S.m) return;
    var o = selObj(), k = S.sel && S.sel.kind, h = "";
    if (S.tool === "item") {
      var pal = paletteFor(G.CATALOGUE);
      h = "<h5>🛋 Furniture</h5><div class=\"hnote\">pick, then click on the plan · R turns it (" + S.libRot + "°)</div><div class=\"hlib\">" + Object.keys(pal).map(function (c) {
        return "<h6>" + esc(c) + "</h6>" + pal[c].map(function (x) { return '<button type="button" class="ghost' + (x.type === S.libType ? " on" : "") + '" data-lib="' + x.type + '" title="' + x.w + " × " + x.d + ' m">' + esc(x.label) + "</button>"; }).join("");
      }).join("") + "</div>";
    } else if (many()) {
      var cnt = {}; S.multi.forEach(function (z) { cnt[z.kind] = (cnt[z.kind] || 0) + 1; });
      h = "<h5>⬚ " + S.multi.length + " selected</h5><div class=\"hnote\">" + esc(Object.keys(cnt).map(function (kk) { return cnt[kk] + " " + kk + (cnt[kk] > 1 ? "s" : ""); }).join(", "))
        + " · drag one of them to move them all, ← → ↑ ↓ nudge, R / Shift+R turn them about their middle, Delete removes them · Shift+click adds or takes one off</div>"
        + '<div class="hbar" style="margin-top:4px"><button type="button" class="ghost" id="hbGrpL" title="Turn them 15° anticlockwise (Shift+R)">↺ 15°</button><button type="button" class="ghost" id="hbGrpR" title="Turn them 15° clockwise (R)">↻ 15°</button><button type="button" class="ghost" id="hbGrp90" title="A quarter turn">↻ 90°</button><button type="button" class="ghost" id="hbGrpDel" title="Delete them (Delete)">🗑 Delete</button><button type="button" class="ghost" id="hbGrpNone" title="Esc">✕ Deselect</button></div>';
    } else if (!o) {
      var fl = S.m.floors[S.floor];
      h = "<h5>House</h5><div class=\"hf\">" + fld("Name", '<input type="text" data-house="name" value="' + esc(S.m.name) + '">')
        + fld("This floor", '<input type="text" data-floor="name" value="' + esc(fl.name) + '">') + fld("Ceiling height", '<input type="number" data-floor="height" step="0.05" min="2" max="6" value="' + fl.height + '">') + "</div>"
        + '<div class="hnote" style="margin-top:4px">' + esc(G.describe(S.m)) + " · " + fmtArea(S.m.rooms.reduce(function (a, r) { return a + Math.abs(G.area(r.poly)); }, 0)) + "</div>"
        // 2.529.0: the roof over the top floor
        + '<h5 style="margin-top:8px">⌂ Roof</h5><div class="hf">' + fld("Kind", '<select data-roof="kind">' + opt(Object.keys(G.ROOFS).map(function (x) { return [x, G.ROOFS[x]]; }), S.m.roof.kind) + "</select>")
        + (S.m.roof.kind !== "none" ? fld("Pitch (°)", '<input type="number" data-roof="pitch" min="5" max="60" step="1" value="' + S.m.roof.pitch + '">') + fld("Overhang", '<input type="number" data-roof="overhang" min="0" max="1.5" step="0.05" value="' + S.m.roof.overhang + '">')
          + fld("Material", '<select data-roof="mat">' + opt(Object.keys(G.MATERIALS).filter(function (x) { return /^roof_|^concrete$/.test(x); }).map(function (x) { return [x, G.MATERIALS[x].label]; }), S.m.roof.mat) + "</select>") + fld("Colour", '<input type="color" data-roof="color" value="' + S.m.roof.color + '">') : "") + "</div>"
        // 2.529.0: a floor-plan picture to trace over
        + '<h5 style="margin-top:8px">🖼 Plan picture to trace</h5>'
        + (S.m.trace ? '<div class="hf">' + fld("See-through", '<input type="range" data-trace="opacity" min="0.05" max="1" step="0.05" value="' + S.m.trace.opacity + '">') + '</div><div class="hbar" style="margin-top:4px">'
            + '<button type="button" class="ghost" id="hbTrScale" title="Click two points on the plan picture you know the distance between, then type it">📐 Set the scale</button>'
            + '<button type="button" class="ghost" id="hbTrMove" title="Drag the picture into place">✋ Move it</button><button type="button" class="ghost" id="hbTrDel" title="Take the picture away (the walls you drew stay)">🗑</button></div>'
            + '<div class="hnote">' + (S.scaleMode ? "📐 click the " + (S.scaleMode.pts.length ? "second" : "first") + " point…" : "1 px = " + (S.m.trace.mpp * 100).toFixed(2) + " cm") + "</div>"
          : '<div class="hbar"><label class="ghost" style="padding:3px 8px;border:1px solid var(--line,#444);border-radius:5px;cursor:pointer">📂 Load a plan picture…<input type="file" id="hbTrFile" accept="image/png,image/jpeg,image/webp" style="display:none"></label></div><div class="hnote">A drawn or photographed floor plan, under your walls - draw over it.</div>');
    } else if (k === "room") {
      h = "<h5>Room</h5><div class=\"hf\">" + fld("Name", '<input type="text" data-k="name" value="' + esc(o.name) + '">') + fld("Floor", matSel("mat", o.mat, function (x) { return /oak|walnut|tile|marble|carpet|concrete|stone|grass|wood/.test(x); }))
        + fld("Colour", '<input type="color" data-k="color" value="' + o.color + '">') + fld("Ceiling", '<label class="hnote"><input type="checkbox" data-k="ceiling"' + (o.ceiling ? " checked" : "") + "> in the 3D view / shots</label>") + "</div>"
        + '<div class="hnote">' + fmtArea(G.area(o.poly)) + " · " + o.poly.length + " corners</div>"
        + '<div class="hbar" style="margin-top:4px"><button type="button" class="ghost" id="hbRoomWalls" title="Give this room\'s walls one material + colour">🎨 Walls…</button></div>'
        + '<h5 style="margin-top:8px">🪄 Furnish</h5><textarea id="hbFurnWords" placeholder="what should go in? e.g. a cosy reading nook with a piano and plants (blank = what a ' + esc(o.name.toLowerCase()) + ' usually has)" style="width:100%"></textarea>'
        + '<div class="hbar" style="margin-top:4px"><button type="button" id="hbFurnish" title="The LLM picks from the furniture library (when one is running - else the rules by the kind of room), the pieces go against the walls, clear of the doors">🪄 Furnish this room</button></div>'
        + '<div id="hbRW" style="display:none" class="hf">' + fld("Walls", matSel("_wm", "plaster", function (x) { return /plaster|paint|brick|stone|concrete|wood|tile|marble/.test(x); })) + fld("Colour", '<input type="color" data-k="_wc" value="#ece6dc">') + '<span></span><button type="button" id="hbRWGo">Apply</button></div>';
    } else if (k === "wall") {
      var L = G.dist(o.a, o.b);
      h = "<h5>Wall</h5><div class=\"hf\">" + fld("Length", numIn("_len", L.toFixed(2), 0.05, 0.1, 100)) + fld("Thickness", numIn("thick", o.thick, 0.01, 0.05, 0.6)) + fld("Material", matSel("mat", o.mat, function (x) { return /plaster|paint|brick|stone|concrete|wood|tile|marble|glass/.test(x); }))
        + fld("Colour", '<input type="color" data-k="color" value="' + o.color + '">') + "</div>"
        + '<div class="hbar" style="margin-top:4px"><button type="button" class="ghost" id="hbAllWalls" title="Every wall on this floor gets this material + colour">⧉ All walls like this</button></div>';
    } else if (k === "opening") {
      h = "<h5>" + esc(G.OPENINGS[o.kind].label) + "</h5><div class=\"hf\">" + fld("Kind", '<select data-k="kind">' + opt(Object.keys(G.OPENINGS).map(function (x) { return [x, G.OPENINGS[x].label]; }), o.kind) + "</select>")
        + fld("Width", numIn("w", o.w, 0.05, 0.3, 10)) + fld("Height", numIn("h", o.h, 0.05, 0.3, 6)) + fld("Sill", numIn("sill", o.sill, 0.05, 0, 4)) + fld("From the wall's end", numIn("t", o.t, 0.05, 0, 100)) + "</div>";
    } else if (k === "item") {
      var c = G.CATALOGUE[o.type];
      h = "<h5>" + esc(c.label) + "</h5><div class=\"hf\">" + fld("Width", numIn("w", o.w, 0.05, 0.05, 20)) + fld("Depth", numIn("d", o.d, 0.05, 0.05, 20)) + fld("Height", numIn("h", o.h, 0.05, 0.01, 6))
        + fld("Turn (°)", numIn("rot", o.rot, 15, 0, 359)) + fld("Colour", '<input type="color" data-k="color" value="' + (o.color || "#8c8070") + '">') + "</div>"
        + '<div class="hbar" style="margin-top:4px"><button type="button" class="ghost" id="hbDup">⧉ Copy</button><button type="button" class="ghost" id="hbDel">🗑</button></div>';
    } else if (k === "stairs") {
      h = "<h5>Stairs</h5><div class=\"hf\">" + fld("Width", numIn("w", o.w, 0.05, 0.6, 3)) + fld("Length", numIn("len", o.len, 0.05, 1.5, 8)) + fld("Turn (°)", numIn("rot", o.rot, 15, 0, 359)) + "</div><div class=\"hnote\">up to " + esc((S.m.floors[o.floor + 1] || {}).name || "the floor above") + " - its floor gets a hole here</div>";
    } else if (k === "person") {
      h = "<h5>🧍 Person</h5><div class=\"hf\">" + fld("Character", '<select data-k="char"><option value="">- none (a person) -</option>' + (S.chars || []).map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === o.char ? " selected" : "") + ">" + esc(c.name) + "</option>"; }).join("") + "</select>")
        + fld("Name", '<input type="text" data-k="name" value="' + esc(o.name) + '" placeholder="' + esc(personName(o)) + '">') + fld("Pose", '<select data-k="pose">' + opt(Object.keys(G.POSES).map(function (x) { return [x, G.POSES[x]]; }), o.pose) + "</select>")
        + fld("LoRA", '<select data-k="lora"><option value="">- none -</option>' + (S.loras || []).concat(o.lora && (S.loras || []).indexOf(o.lora) < 0 ? [o.lora] : []).map(function (l) { return '<option value="' + esc(l) + '"' + (l === o.lora ? " selected" : "") + ">" + esc(l) + "</option>"; }).join("") + "</select>")
        + fld("LoRA weight", numIn("lw", o.lw, 0.05, -2, 2))
        + fld("Height", numIn("h", o.h, 0.05, 0.9, 2.3)) + fld("Faces (°)", numIn("rot", o.rot, 15, 0, 359)) + fld("Colour", '<input type="color" data-k="color" value="' + (o.color || "#b9bdc3") + '">') + "</div>"
        + '<div class="hnote">A grey mannequin in the 3D view, the shots and their depth maps. ✨ Make it real puts the character in its place'
        + (o.char ? " (their picture goes with the shot)" : "") + (o.lora ? "; their LoRA rides along - it must be made for the ✨ style's model family" : "") + ".</div>";
    } else if (k === "light") {
      h = "<h5>◯ Light</h5><div class=\"hf\">" + fld("Name", '<input type="text" data-k="name" value="' + esc(o.name) + '">') + fld("Height", numIn("z", o.z, 0.05, 0.05, S.m.floors[o.floor].height + 3))
        + fld("Reach (m)", numIn("reach", o.reach, 0.25, 0.5, 30)) + fld("Brightness", numIn("intensity", o.intensity, 0.1, 0.1, 5)) + fld("Colour", '<input type="color" data-k="color" value="' + o.color + '">') + "</div>"
        + '<div class="hbar" style="margin-top:4px"><button type="button" class="ghost" id="hbLDup">⧉ Copy</button><button type="button" class="ghost" id="hbDel">🗑</button></div>'
        + '<div class="hnote">The circle is how far it lights. Height is over this floor (' + esc(S.m.floors[o.floor].name) + ', ceiling ' + S.m.floors[o.floor].height + ' m). Lit in the 3D view, the shots and the panoramas.</div>';
    } else if (k === "camera") {
      h = "<h5>📷 Camera</h5><div class=\"hf\">" + fld("Name", '<input type="text" data-k="name" value="' + esc(o.name) + '">') + fld("Eye height", numIn("z", o.z, 0.05, 0.1, 40)) + fld("Looks (°)", numIn("yaw", o.yaw, 5, 0, 359))
        + fld("Tilt (°)", numIn("pitch", o.pitch, 1, -80, 80)) + fld("Lens (fov °)", numIn("fov", o.fov, 1, 20, 120)) + "</div>"
        + '<div class="hbar" style="margin-top:4px"><button type="button" class="ghost" id="hbLookCam">👁 Its view in 3D</button></div>'
        + '<div class="hnote">drag it on the plan - the 3D view looks through it · ← → turn · ↑ ↓ tilt · hold Shift: up (3 m over the roof at most) · hold Alt: down (the ground floor) · ' + esc(elevText(o).replace(/^📷 [^·]*· /, "")) + "</div>";
    }
    if (o && !many() && /^(wall|room|item|light)$/.test(k)) h += refRowHtml(k, o);    // 2.539.0: 🖼 a reference picture
    host.innerHTML = h;
    if ($("hbGrpL")) { $("hbGrpL").onclick = function () { turnSel(-15); }; $("hbGrpR").onclick = function () { turnSel(15); }; $("hbGrp90").onclick = function () { turnSel(90); }; $("hbGrpDel").onclick = delSel; $("hbGrpNone").onclick = function () { S.multi = null; S.sel = null; paint(); paintSide(); }; }
    host.querySelectorAll("[data-lib]").forEach(function (b) { b.onclick = function () { S.libType = b.dataset.lib; paintSide(); }; });
    host.querySelectorAll("[data-k]").forEach(function (el) {
      el.onchange = function () {
        var obj = selObj(); if (!obj) return; var kk = el.dataset.k; if (kk.charAt(0) === "_" && kk !== "_len") return;
        snapshot();
        var v = el.type === "checkbox" ? el.checked : el.type === "number" ? +el.value : el.value;
        if (kk === "_len") { var L2 = G.dist(obj.a, obj.b), ux = (obj.b[0] - obj.a[0]) / L2, uy = (obj.b[1] - obj.a[1]) / L2, nb = [obj.a[0] + ux * v, obj.a[1] + uy * v]; cornerWalls(obj.b).forEach(function (we) { var w = find("wall", we[0]); if (w) w[we[1]] = nb; }); }
        else { obj[kk] = v; if (kk === "kind") { var dd = G.OPENINGS[v]; obj.w = dd.w; obj.h = dd.h; obj.sill = dd.sill; } }
        if (kk === "mat" && S.sel.kind !== "opening") obj.color = G.MATERIALS[v].color;
        changed(); if (kk === "name") fillLook();
      };
    });
    host.querySelectorAll("[data-house]").forEach(function (el) { el.onchange = function () { snapshot(); S.m.name = el.value.trim() || S.m.name; changed(); }; });
    host.querySelectorAll("[data-floor]").forEach(function (el) { el.onchange = function () { snapshot(); var fl2 = S.m.floors[S.floor]; fl2[el.dataset.floor] = el.type === "number" ? +el.value : el.value; changed(); paintFloors(); }; });
    if ($("hbAllWalls")) $("hbAllWalls").onclick = function () { snapshot(); S.m.walls.forEach(function (w) { if (w.floor === S.floor) { w.mat = o.mat; w.color = o.color; } }); changed(); };
    if ($("hbRoomWalls")) $("hbRoomWalls").onclick = function () { $("hbRW").style.display = ""; };
    if ($("hbRWGo")) $("hbRWGo").onclick = function () { snapshot(); var mat = host.querySelector('[data-k="_wm"]').value, colr = host.querySelector('[data-k="_wc"]').value; S.m.walls.forEach(function (w) { if (w.floor === o.floor && edgeOf(w, o.poly)) { w.mat = mat; w.color = colr; } }); changed(); };
    host.querySelectorAll("[data-roof]").forEach(function (el) { el.onchange = function () { snapshot(); var k2 = el.dataset.roof; S.m.roof[k2] = el.type === "number" ? +el.value : el.value; if (k2 === "mat") S.m.roof.color = G.MATERIALS[el.value].color; if (k2 === "kind" && el.value !== "none" && !S.roof) { S.roof = true; if ($("hbRoofShow")) $("hbRoofShow").checked = true; } changed(); }; });
    host.querySelectorAll("[data-trace]").forEach(function (el) { el.oninput = function () { S.m.trace.opacity = +el.value; paint(); }; el.onchange = function () { S.dirty = true; }; });
    if ($("hbTrFile")) $("hbTrFile").onchange = function (e) { var f = e.target.files && e.target.files[0]; if (f) loadTrace(f); };
    if ($("hbTrScale")) $("hbTrScale").onclick = function () { S.scaleMode = { pts: [] }; setTool("select"); say("📐 click the first point on the plan picture"); paintSide(); };
    if ($("hbTrMove")) $("hbTrMove").onclick = function () { setTool("tracemove"); say("✋ drag the plan picture into place"); };
    if ($("hbTrDel")) $("hbTrDel").onclick = function () { snapshot(); S.m.trace = null; S.traceImg = null; changed(); };
    if ($("hbFurnish")) $("hbFurnish").onclick = function () { furnish(o, ($("hbFurnWords") || {}).value || ""); };
    if ($("hbDup")) $("hbDup").onclick = function () { snapshot(); var n = JSON.parse(JSON.stringify(o)); n.id = G.newId("i"); n.x += 0.3; n.y += 0.3; S.m.items.push(n); S.sel = { kind: "item", id: n.id }; changed(); };
    if ($("hbDel")) $("hbDel").onclick = delSel;
    bindRefRow(k, o);                                                                  // 2.539.0
    if ($("hbLDup")) $("hbLDup").onclick = function () { snapshot(); var n = JSON.parse(JSON.stringify(o)); n.id = G.newId("l"); n.x += 0.5; n.y += 0.5; n.name = o.name + " copy"; S.m.lights.push(n); S.sel = { kind: "light", id: n.id }; changed(); };
    if ($("hbLookCam")) $("hbLookCam").onclick = function () { S.look = o.id; fillLook(); setView(S.view === "plan" ? "both" : S.view); rebuild3d(); };
    host.querySelectorAll("input,select,textarea").forEach(function (el) { el.addEventListener("keydown", function (e) { e.stopPropagation(); }); });
  }
  function edgeOf(w, poly) { var on = function (p) { for (var i = 0; i < poly.length; i++) if (ptSegDist(p, poly[i], poly[(i + 1) % poly.length]) < 0.05) return true; return false; }; return on(w.a) && on(w.b); }
  function paintFloors() {
    var h = $("hbFloors"); if (!h || !S.m) return;
    h.innerHTML = S.m.floors.map(function (f, i) { return '<button type="button" class="ghost' + (i === S.floor ? " on" : "") + '" data-fl="' + i + '">' + esc(f.name) + "</button>"; }).join("")
      + '<button type="button" class="ghost" id="hbAddFloor" title="A floor above">＋</button>' + (S.m.floors.length > 1 ? '<button type="button" class="ghost" id="hbDelFloor" title="Remove the top floor (and everything on it)">－</button>' : "");
    h.querySelectorAll("[data-fl]").forEach(function (b) { b.onclick = function () { S.floor = +b.dataset.fl; S.sel = null; S.draft = null; paintFloors(); paint(); paintSide(); rebuild3d(); }; });
    $("hbAddFloor").onclick = function () { if (S.m.floors.length >= 8) return; snapshot(); S.m.floors.push({ id: "f" + (S.m.floors.length + 1), name: "Floor " + (S.m.floors.length + 1), height: 2.7 }); S.floor = S.m.floors.length - 1; changed(); paintFloors(); };
    if ($("hbDelFloor")) $("hbDelFloor").onclick = function () {
      var top = S.m.floors.length - 1, ok = typeof appConfirm === "function" ? appConfirm("Remove " + S.m.floors[top].name + " and everything on it?") : Promise.resolve(confirm("Remove the top floor?"));
      Promise.resolve(ok).then(function (y) { if (!y) return; snapshot(); var keep = function (x) { return x.floor !== top; }; var gone = S.m.walls.filter(function (w) { return w.floor === top; }).map(function (w) { return w.id; });
        ["walls", "rooms", "items", "stairs", "cameras", "people", "lights"].forEach(function (a) { S.m[a] = (S.m[a] || []).filter(keep); }); S.m.stairs = S.m.stairs.filter(function (s) { return s.floor + 1 < top; });   // stairs up to the removed floor go too
        S.m.openings = S.m.openings.filter(function (q) { return gone.indexOf(q.wall) < 0; }); S.m.floors.pop(); S.floor = Math.min(S.floor, S.m.floors.length - 1); changed(); paintFloors(); });
    };
  }

  /* ---------------- 3D */
  function loadThree() {
    if (root.H3THREE) return Promise.resolve(root.H3THREE);
    if (root.H3M3D && H3M3D.load) return H3M3D.load();
    return new Promise(function (ok, no) { var s = document.createElement("script"); s.src = "/static/vendor/three-m3d.min.js"; s.onload = function () { root.H3THREE ? ok(root.H3THREE) : no(new Error("three.js did not load")); }; s.onerror = function () { no(new Error("static/vendor/three-m3d.min.js is missing")); }; document.head.appendChild(s); });
  }
  var TEX = {};
  function texture(T, kind) {
    if (!kind) return null;
    if (TEX[kind]) return TEX[kind];
    var c = document.createElement("canvas"); c.width = c.height = 256; var x = c.getContext("2d"), rnd = mulberry(kind.length * 7919);
    x.fillStyle = "#ffffff"; x.fillRect(0, 0, 256, 256);
    var noise = function (n, a) { for (var i = 0; i < n; i++) { x.fillStyle = "rgba(0,0,0," + (rnd() * a) + ")"; x.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2); } };
    if (kind === "planks" || kind === "grain") {
      var pw = kind === "planks" ? 256 / 5.5 : 256;
      for (var p = 0; p * pw < 256; p++) { x.fillStyle = "rgba(0,0,0," + (0.03 + rnd() * 0.09) + ")"; x.fillRect(p * pw, 0, pw, 256); for (var g = 0; g < 14; g++) { x.strokeStyle = "rgba(60,30,10," + (0.04 + rnd() * 0.08) + ")"; x.lineWidth = 1; x.beginPath(); var gx = p * pw + rnd() * pw; x.moveTo(gx, 0); x.bezierCurveTo(gx + rnd() * 8 - 4, 80, gx + rnd() * 8 - 4, 170, gx + rnd() * 6 - 3, 256); x.stroke(); }
        if (kind === "planks") { x.fillStyle = "rgba(0,0,0,.35)"; x.fillRect(p * pw, 0, 1.5, 256); x.fillRect(p * pw, (p * 97) % 256, pw, 1.5); } }
    } else if (kind === "tiles") { noise(400, 0.04); x.strokeStyle = "rgba(0,0,0,.28)"; x.lineWidth = 2; for (var t = 0; t <= 2; t++) { x.beginPath(); x.moveTo(t * 128, 0); x.lineTo(t * 128, 256); x.moveTo(0, t * 128); x.lineTo(256, t * 128); x.stroke(); } }
    else if (kind === "brick") { x.fillStyle = "#d8d2c8"; x.fillRect(0, 0, 256, 256); var bh = 256 / 13; for (var row = 0; row < 13; row++) for (var col = -1; col < 5; col++) { x.fillStyle = "rgb(" + (235 + rnd() * 20 | 0) + "," + (235 + rnd() * 20 | 0) + "," + (235 + rnd() * 20 | 0) + ")"; x.fillRect(col * 59 + (row % 2) * 29 + 2, row * bh + 2, 55, bh - 3); } }
    else if (kind === "marble") { noise(300, 0.03); for (var v = 0; v < 9; v++) { x.strokeStyle = "rgba(90,90,100," + (0.08 + rnd() * 0.15) + ")"; x.lineWidth = 0.5 + rnd() * 1.5; x.beginPath(); var mx = rnd() * 256, my = 0; x.moveTo(mx, my); for (var s = 0; s < 8; s++) { mx += rnd() * 60 - 30; my += 32; x.lineTo(mx, my); } x.stroke(); } }
    else if (kind === "carpet") noise(9000, 0.12);
    else if (kind === "stone" || kind === "concrete") { noise(5000, 0.1); if (kind === "stone") { x.strokeStyle = "rgba(0,0,0,.25)"; for (var k2 = 0; k2 < 12; k2++) { x.beginPath(); x.arc(rnd() * 256, rnd() * 256, 20 + rnd() * 40, 0, 7); x.stroke(); } } }
    else noise(2500, 0.05);
    var tex = new T.CanvasTexture(c); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
    TEX[kind] = tex; return tex;
  }
  /** 2.539.0: a reference picture as a repeating texture (metres-UVs: one copy every `scale` m); the live view redraws when
   *  it arrives, a shot waits for it (built.ready) */
  var REFTEX = {};
  function refTexture(T, url, scale, loads) {
    var base = REFTEX[url];
    if (!base) {
      base = REFTEX[url] = { tex: null, p: null };
      base.p = new Promise(function (ok) {
        base.tex = new T.TextureLoader().load(url, function () { ok(); try { render3d(); } catch (e) { /* not drawn yet */ } }, undefined, function () { ok(); });
        base.tex.wrapS = base.tex.wrapT = T.RepeatWrapping; base.tex.colorSpace = T.SRGBColorSpace; base.tex.anisotropy = 4;
      });
    }
    if (loads) loads.push(base.p);
    var t = base.tex.clone(); t.repeat.set(1 / (scale || 1), 1 / (scale || 1)); t.needsUpdate = true;
    base.p.then(function () { t.needsUpdate = true; });
    return t;
  }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  /** the scene for a model: {scene, group, sun, bounds} */
  function makeScene(T, model, upTo, ceilings, roof) {
    var b = G.build(model, { upTo: upTo, ceilings: ceilings, roof: !!roof }), scene = new T.Scene(), group = new T.Group(), sn = G.sun(model.light), loads = [];
    b.meshes.forEach(function (g) {
      var geo = new T.BufferGeometry();
      geo.setAttribute("position", new T.Float32BufferAttribute(g.pos, 3)); geo.setAttribute("normal", new T.Float32BufferAttribute(g.nrm, 3)); geo.setAttribute("uv", new T.Float32BufferAttribute(g.uv, 2)); geo.setIndex(g.idx);
      var M = G.MATERIALS[g.mat] || {}, rt = g.tex && S.slug ? refTexture(T, refUrl(g.tex), g.texScale, loads) : null;   // 2.539.0: a reference picture on it
      var mat = new T.MeshStandardMaterial({ color: new T.Color(rt ? "#ffffff" : g.color), roughness: M.rough != null ? M.rough : 0.8, metalness: M.metal || 0, map: rt || texture(T, M.tex), side: T.DoubleSide });
      if (M.opacity != null) { mat.transparent = true; mat.opacity = M.opacity; mat.depthWrite = false; }
      if (M.emissive) { mat.emissive = new T.Color(g.color); mat.emissiveIntensity = model.light.lamps || sn.night ? 1.4 : 0.25; }
      var mesh = new T.Mesh(geo, mat); mesh.castShadow = M.opacity == null && !M.emissive; mesh.receiveShadow = true; group.add(mesh);
    });
    scene.add(group);
    var bb = b.bounds, cx = (bb[0] + bb[3]) / 2, cz = (bb[2] + bb[5]) / 2, R = Math.max(6, Math.hypot(bb[3] - bb[0], bb[5] - bb[2]));
    var ground = new T.Mesh(new T.PlaneGeometry(R * 6, R * 6), new T.MeshStandardMaterial({ color: new T.Color(sn.night ? "#1c2418" : "#6d8a4f"), roughness: 1, map: texture(T, "carpet") }));
    ground.material.map = ground.material.map && ground.material.map.clone(); if (ground.material.map) { ground.material.map.repeat.set(R * 6, R * 6); ground.material.map.needsUpdate = true; }
    ground.rotation.x = -Math.PI / 2; ground.position.set(cx, -0.01, cz); ground.receiveShadow = true; scene.add(ground);
    scene.background = new T.Color(sn.sky);
    var amb = (model.light.ambient != null ? model.light.ambient : 0.55) * (sn.night ? 0.3 : 1);
    // no global illumination in a real-time view: a neutral ambient + a sky / ground fill stand in for the light bouncing round the rooms
    scene.add(new T.AmbientLight(0xffffff, amb * 1.5)); scene.add(new T.HemisphereLight(new T.Color(sn.sky), new T.Color(sn.ground), amb * 1.1));
    if (model.light.sun !== false && !sn.night) {
      var sl = new T.DirectionalLight(new T.Color(sn.color), sn.intensity * 1.4), az = sn.az * Math.PI / 180, el = sn.el * Math.PI / 180;
      sl.position.set(cx + Math.cos(az) * Math.cos(el) * R * 2, Math.sin(el) * R * 2, cz + Math.sin(az) * Math.cos(el) * R * 2); sl.target.position.set(cx, 0, cz);
      sl.castShadow = true; sl.shadow.mapSize.set(2048, 2048); var sc = sl.shadow.camera; sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.near = 0.5; sc.far = R * 5; sl.shadow.bias = -0.0005; sl.shadow.normalBias = 0.02;
      scene.add(sl); scene.add(sl.target);
    }
    // 2.538.0: the ◯ lights placed on the plan are always on (their colour + reach); the furniture's lamps with 💡 / at night
    var lamps = b.lights.filter(function (L) { return L.placed; }).slice(0, 24).concat(model.light.lamps || sn.night ? b.lights.filter(function (L) { return !L.placed; }).slice(0, 16) : []);
    lamps.forEach(function (L) { var pl = new T.PointLight(L.color ? new T.Color(L.color) : 0xffd9a0, 10 * L.intensity, L.reach ? L.reach * 1.25 : 10, 1.6); pl.position.set(L.x, L.y, L.z); scene.add(pl); });
    return { scene: scene, group: group, bounds: bb, center: [cx, (bb[1] + bb[4]) / 2, cz], R: R, elevations: b.elevations, ready: Promise.all(loads) };
  }
  function ensure3d() {
    if (S.three) return Promise.resolve(S.three);
    return loadThree().then(function (T) {
      var host = $("hb3dHost"), canvas = $("hb3d");
      var R = new T.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true });
      R.outputColorSpace = T.SRGBColorSpace; R.shadowMap.enabled = true; R.shadowMap.type = T.PCFShadowMap;
      var cam = new T.PerspectiveCamera(55, 1, 0.05, 500), ctl = new T.OrbitControls(cam, canvas);
      ctl.enableDamping = false; ctl.addEventListener("change", render3d);
      S.three = { T: T, R: R, cam: cam, ctl: ctl, built: null, host: host };
      // drag inside a camera's own view = aim that camera
      var aim = null;
      canvas.addEventListener("pointerdown", function (e) { if (S.look === "orbit") return; var c = find("camera", S.look); if (!c) return; aim = { x: e.clientX, y: e.clientY, yaw: c.yaw, pitch: c.pitch }; snapshot(); canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener("pointermove", function (e) { if (!aim) return; var c = find("camera", S.look); if (!c) return; c.yaw = ((aim.yaw + (e.clientX - aim.x) * 0.25) % 360 + 360) % 360; c.pitch = Math.max(-80, Math.min(80, aim.pitch - (e.clientY - aim.y) * 0.25)); applyLook(); paint(); });
      canvas.addEventListener("pointerup", function () { if (aim) { aim = null; S.m = G.normalize(S.m); S.dirty = true; paintSide(); } });
      if (root.ResizeObserver) new ResizeObserver(function () { size3d(); render3d(); }).observe(host);
      return S.three;
    });
  }
  function size3d() { var t = S.three; if (!t) return; var r = t.host.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return; t.R.setPixelRatio(window.devicePixelRatio || 1); t.R.setSize(r.width, r.height, false); t.cam.aspect = r.width / r.height; t.cam.updateProjectionMatrix(); }
  var rb = null;
  function rebuild3d() {
    if (S.view === "plan" || !$("hb3d")) return;
    clearTimeout(rb); rb = setTimeout(function () {
      ensure3d().then(function (t) {
        var first = !t.built;
        if (t.built) t.built.scene.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material && !o.material.map) o.material.dispose(); });
        var lc = S.look !== "orbit" ? find("camera", S.look) : null;
        t.built = makeScene(t.T, S.m, lc ? undefined : S.floor, S.ceil || !!lc, lc ? true : S.roof);   // a camera's own view has its ceilings (as its shot will)
        if (first) { var c = t.built.center, R = t.built.R; t.cam.position.set(c[0] + R * 0.45, R * 0.75, c[2] + R * 0.7); t.ctl.target.set(c[0], 0.8, c[2]); }
        size3d(); applyLook();
      }).catch(function (e) { say("3D: " + (e && e.message || e), "hbad"); });
    }, 60);
  }
  function camPose(T, c, E) { var a = c.yaw * Math.PI / 180, p = c.pitch * Math.PI / 180, y = (E[c.floor] || 0) + c.z; return { pos: new T.Vector3(c.x, y, c.y), dir: new T.Vector3(Math.cos(a) * Math.cos(p), Math.sin(p), Math.sin(a) * Math.cos(p)) }; }
  function applyLook() {
    var t = S.three; if (!t || !t.built) return;
    var c = S.look !== "orbit" ? find("camera", S.look) : null;
    t.ctl.enabled = !c;
    if (c) { var ps = camPose(t.T, c, t.built.elevations); t.cam.position.copy(ps.pos); t.cam.lookAt(ps.pos.clone().add(ps.dir)); t.cam.fov = c.fov * (t.cam.aspect < 1 ? 1 : 1); t.cam.updateProjectionMatrix(); }
    else { t.cam.fov = 55; t.cam.updateProjectionMatrix(); t.ctl.update(); }
    render3d();
  }
  function render3d() { var t = S.three; if (!t || !t.built) return; t.R.render(t.built.scene, t.cam); var cap = $("hb3dCap"); if (cap) cap.textContent = S.look === "orbit" ? "3D · drag to orbit, right-drag to pan, wheel to zoom" : "👁 " + ((find("camera", S.look) || {}).name || "") + " · drag to aim it · on the plan: drag it, ← → ↑ ↓ turn / tilt, hold Shift / Alt: up / down"; }
  function fillLook() {
    var s = $("hbLook"); if (!s || !S.m) return;
    if (S.look !== "orbit" && !find("camera", S.look)) S.look = "orbit";
    s.innerHTML = '<option value="orbit">🧭 Orbit</option>' + S.m.cameras.map(function (c) { return '<option value="' + esc(c.id) + '">👁 ' + esc(c.name) + "</option>"; }).join(""); s.value = S.look;
    var lc = $("hbCam"); if (lc) { var was = lc.value; lc.innerHTML = S.m.cameras.length ? S.m.cameras.map(function (c) { return '<option value="' + esc(c.id) + '">📷 ' + esc(c.name) + "</option>"; }).join("") : '<option value="">- place a 📷 camera first -</option>'; if (was && find("camera", was)) lc.value = was; else if (S.sel && S.sel.kind === "camera") lc.value = S.sel.id; }
  }
  function setView(v) {
    S.view = v;
    document.querySelectorAll("#hbBody [data-view]").forEach(function (b) { b.classList.toggle("on", b.dataset.view === v); });
    $("hbPlanHost").style.display = v === "3d" ? "none" : ""; $("hb3dHost").style.display = v === "plan" ? "none" : "";
    setTimeout(function () { paint(); if (v !== "plan") rebuild3d(); }, 30);
  }

  /* ---------------- the renders: shot / depth / normal / 360 */
  var OFF = null;
  function offscreen(T, w, h) { if (!OFF) { OFF = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); OFF.outputColorSpace = T.SRGBColorSpace; OFF.shadowMap.enabled = true; OFF.shadowMap.type = T.PCFShadowMap; } OFF.setPixelRatio(1); OFF.setSize(w, h, false); return OFF; }
  function toBlob(canvas) { return new Promise(function (ok) { canvas.toBlob(function (b) { ok(b); }, "image/png"); }); }
  /** a camera's picture (+ "depth" / "normal") -> PNG blobs */
  function renderShot(c, w, h, kinds) {
    return ensure3d().then(function (t) {
      var T = t.T, built = makeScene(T, S.m, undefined, true, true);
      return built.ready.then(function () { return shotOf(T, built, c, w, h, kinds); });
    });
  }
  function shotOf(T, built, c, w, h, kinds) {
    {
      var R = offscreen(T, w, h), ps = camPose(T, c, built.elevations);
      var cam = new T.PerspectiveCamera(c.fov, w / h, 0.05, 300); cam.position.copy(ps.pos); cam.lookAt(ps.pos.clone().add(ps.dir)); cam.updateMatrixWorld();
      var out = {}, chain = Promise.resolve();
      (kinds || ["shot"]).forEach(function (k) {
        chain = chain.then(function () {
          var bg = built.scene.background;
          if (k === "depth") {
            built.scene.overrideMaterial = new T.ShaderMaterial({ uniforms: { near: { value: 0.3 }, far: { value: Math.max(8, built.R * 1.2) } },
              vertexShader: "varying float vZ; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vZ = -mv.z; gl_Position = projectionMatrix * mv; }",
              fragmentShader: "uniform float near; uniform float far; varying float vZ; void main(){ float d = clamp((vZ - near) / (far - near), 0.0, 1.0); float v = 1.0 - pow(d, 0.6); gl_FragColor = vec4(vec3(v), 1.0); }", side: T.DoubleSide });
            built.scene.background = new T.Color(0x000000);
          } else if (k === "normal") { built.scene.overrideMaterial = new T.MeshNormalMaterial({ side: T.DoubleSide }); built.scene.background = new T.Color(0x8080ff); }
          else built.scene.overrideMaterial = null;
          R.render(built.scene, cam);
          built.scene.overrideMaterial = null; built.scene.background = bg;
          return toBlob(R.domElement).then(function (b) { out[k] = b; });
        });
      });
      return chain.then(function () { dispose(built.scene); return out; });
    }
  }
  /** the 360° panorama (equirectangular, w × w/2): the camera's direction in the middle - the Location's yaw 0 */
  function renderPano(c, w) {
    return ensure3d().then(function (t0) {
      var built0 = makeScene(t0.T, S.m, undefined, true, true);
      return built0.ready.then(function () { dispose(built0.scene); return t0; });   // 2.539.0: its reference pictures first (cached)
    }).then(function (t) {
      var T = t.T, built = makeScene(T, S.m, undefined, true, true), W = w || 4096, H = W / 2, R = offscreen(T, W, H);
      var rt = new T.WebGLCubeRenderTarget(Math.min(2048, W / 4), { generateMipmaps: false }), cc = new T.CubeCamera(0.05, 300, rt);
      var ps = camPose(T, c, built.elevations); cc.position.copy(ps.pos); built.scene.add(cc); cc.update(R, built.scene);
      var mat = new T.ShaderMaterial({ uniforms: { tCube: { value: rt.texture }, yaw: { value: c.yaw * Math.PI / 180 } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
        fragmentShader: "uniform samplerCube tCube; uniform float yaw; varying vec2 vUv;"
          + "vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(vec3(0.0031308), c)); }"
          + "void main(){ float lon = yaw + (vUv.x - 0.5) * 6.28318530718; float lat = (vUv.y - 0.5) * 3.14159265359;"
          + " vec3 d = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon)); vec4 c = textureCube(tCube, d); gl_FragColor = vec4(toSRGB(c.rgb), 1.0); }",
        depthTest: false, depthWrite: false });
      var quad = new T.Mesh(new T.PlaneGeometry(2, 2), mat), sc = new T.Scene(); sc.add(quad);
      R.render(sc, new T.OrthographicCamera(-1, 1, 1, -1, 0, 1));
      return toBlob(R.domElement).then(function (b) { rt.dispose(); mat.dispose(); dispose(built.scene); return b; });
    });
  }
  function dispose(scene) { scene.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose && !o.material.map) o.material.dispose(); }); }
  function curCam() { var v = $("hbCam") && $("hbCam").value; return v ? find("camera", v) : null; }
  function needSaved() { return S.slug ? Promise.resolve() : save(); }
  function upload(kind, cam, blob) { return fetch("/api/house/" + encodeURIComponent(S.slug) + "/render?kind=" + kind + "&cam=" + encodeURIComponent(cam), { method: "POST", headers: { "Content-Type": "image/png" }, body: blob }).then(function (r) { return r.json(); }); }
  function doShot() {
    var c = curCam(); if (!c) { say("place a 📷 camera on the plan first", "hbad"); return Promise.resolve(null); }
    var sz = ($("hbSize").value || "1920x1080").split("x").map(Number);
    say("📷 rendering " + c.name + "…");
    return needSaved().then(function () { return renderShot(c, sz[0], sz[1], ["shot", "depth", "normal"]); }).then(function (b) {
      return upload("shot", c.name, b.shot).then(function (r1) { return upload("depth", c.name, b.depth).then(function (r2) { return upload("normal", c.name, b.normal).then(function (r3) {
        if (r1.error) { say(r1.error, "hbad"); return null; }
        S.lastShot[c.id] = { asset: r1.asset, w: sz[0], h: sz[1] };
        say("📷 " + r1.asset + " + its depth and normal maps are in the Image assets", "hok");
        $("hbShots").innerHTML = [r1, r2, r3].map(function (r) { return r.file ? '<img alt="" title="' + esc(r.file) + '" src="/api/house/' + encodeURIComponent(S.slug) + "/render/" + encodeURIComponent(r.file) + "?t=" + Date.now() + '" style="width:31%;border-radius:4px">' : ""; }).join(" ");
        return r1;
      }); }); });
    }).catch(function (e) { say("📷 " + (e && e.message || e), "hbad"); return null; });
  }
  function doPano() {
    var c = curCam(); if (!c) { say("place a 📷 camera on the plan first", "hbad"); return Promise.resolve(null); }
    var name = (S.m.name + " " + c.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    say("📍 rendering the 360° panorama of " + c.name + "…");
    var blob = null;
    return needSaved().then(function () { return renderPano(c, 4096); }).then(function (b) {
      blob = b;
      upload("pano", c.name, b).catch(function () { /* the house's copy is a convenience */ });
      return fetch("/api/environments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name, yaw: 0, pitch: c.pitch, fov: Math.max(30, Math.min(140, c.fov)) }) }).then(function (r) { return r.json(); });
    }).then(function (r) {
      if (r.error) throw new Error(r.error);
      var envName = (r.env && r.env.name) || name, fd = new FormData(); fd.append("file", blob, name + "-360.png");
      return fetch("/api/environments/" + encodeURIComponent(envName) + "/pano", { method: "POST", body: fd }).then(function (x) { return x.json(); }).then(function (j) {
        if (j.error) throw new Error(j.error);
        say("📍 the Location " + envName + " (@" + ((j.env && j.env.tag) || envName) + ") is ready - its 360° view is the room as built", "hok");
        return j;
      });
    }).catch(function (e) { say("📍 " + (e && e.message || e), "hbad"); return null; });
  }
  /* 2.529.0: the plan picture */
  function traceImage() { if (!S.m || !S.m.trace || !S.slug) { S.traceImg = null; return; } var im = new Image(); im.onload = function () { paint(); }; im.src = "/api/house/" + encodeURIComponent(S.slug) + "/trace?t=" + Date.now(); S.traceImg = im; }
  function loadTrace(file) {
    return needSaved().then(function () {
      return fetch("/api/house/" + encodeURIComponent(S.slug) + "/trace", { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file }).then(function (r) { return r.json(); });
    }).then(function (j) {
      if (!j || j.error) { say("🖼 " + ((j && j.error) || "not loaded"), "hbad"); return; }
      snapshot();
      var w0 = toW(20, 20);
      S.m.trace = { file: j.file, x: snap(w0[0]), y: snap(w0[1]), mpp: 0.02, opacity: 0.5, floor: S.floor };
      changed(); traceImage(); say("🖼 the plan picture is under the plan - 📐 Set the scale with two points you know the distance between, then draw over it", "hok");
    }).catch(function (e) { say("🖼 " + (e && e.message || e), "hbad"); });
  }
  function scaleClick(p) {
    var sm = S.scaleMode; sm.pts.push(p);
    if (sm.pts.length < 2) { paint(); paintSide(); say("📐 now the second point"); return; }
    var got = G.dist(sm.pts[0], sm.pts[1]); S.scaleMode = null;
    if (got < 0.01) { paintSide(); return; }
    var ask = root.H3Panels && H3Panels.ask ? H3Panels.ask("The scale", "How far apart are those two points, in metres?", "") : Promise.resolve(window.prompt("How far apart are those two points, in metres?", ""));
    Promise.resolve(ask).then(function (v) {
      var real = parseFloat(String(v || "").replace(",", ".")); if (!(real > 0)) { paintSide(); return; }
      snapshot(); var k = real / got, t = S.m.trace, a = sm.pts[0];
      t.mpp = t.mpp * k; t.x = a[0] - (a[0] - t.x) * k; t.y = a[1] - (a[1] - t.y) * k;   // the first point stays where it is
      changed(); say("📐 scaled: 1 px = " + (t.mpp * 100).toFixed(2) + " cm", "hok");
    });
  }
  /* 2.529.0: 🪄 furnish a room */
  function furnish(room, words) {
    say("🪄 furnishing " + room.name + "…");
    return fetch("/api/house/furnish", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ model: S.m, room: room.id, prompt: words }) }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.error) { say("🪄 " + j.error, "hbad"); return j; }
      snapshot(); (j.items || []).forEach(function (it) { S.m.items.push(it); }); S.sel = { kind: "room", id: room.id }; changed();
      var left = (j.skipped || []).length ? " - no room for: " + j.skipped.map(function (t) { return (G.CATALOGUE[t] || {}).label || t; }).join(", ") : "";
      say("🪄 " + (j.items || []).length + " pieces (" + (j.by === "llm" ? "the LLM picked them" : "a " + j.kind + "'s set" + (words ? " + what you asked for" : "")) + ")" + left + " · Ctrl+Z takes them out", left ? "" : "hok");
      return j;
    }).catch(function (e) { say("🪄 " + (e && e.message || e), "hbad"); });
  }
  /* 2.529.0: 🎬 every camera -> a shot (+ depth / normal) and, ticked, a StoryBoard scene with the shot as its first frame */
  function tev(n, w) { if (root.H3TestEvent) root.H3TestEvent(n, w); }   // 2.532.0: the 🧪 checklist ticks itself
  function shotList(toBoard) {
    tev("house_shotlist", (S.m.cameras || []).length + " cameras");
    var cams = S.m.cameras.slice(); if (!cams.length) { say("place a 📷 camera first", "hbad"); return Promise.resolve(null); }
    var sz = ($("hbSize").value || "1920x1080").split("x").map(Number), rows = [], i = 0;
    var next = function () {
      if (i >= cams.length) return null;
      var c = cams[i++];
      say("🎬 " + i + " / " + cams.length + ": " + c.name + "…");
      return renderShot(c, sz[0], sz[1], ["shot", "depth"]).then(function (b) {
        return upload("shot", c.name, b.shot).then(function (r1) { return upload("depth", c.name, b.depth).then(function () {
          var rm = G.roomOf(S.m, c.floor, [c.x, c.y]), who = seenBy(c, sz[0] / sz[1]);
          var text = "Interior, " + (rm ? G.describe(S.m, rm.id) : S.m.name) + (who.length ? ". With " + who.map(function (w) { return personName(w.q) + " (" + G.POSES[w.q.pose] + ", " + w.side + ")"; }).join(" and ") : "") + ". Shot from the " + c.name + " camera, " + Math.round(c.fov) + "° lens, eye height " + c.z + " m.";
          var row = { cam: c.name, room: rm ? rm.name : "", lens: c.fov, height: c.z, people: who.map(function (w) { return personName(w.q) + " (" + G.POSES[w.q.pose] + ", " + w.side + ")"; }), shot: r1.asset, scene: null, text: text };
          rows.push(row);
          if (!toBoard) return;
          return fetch("/api/scenes/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text, raw: true }) }).then(function (x) { return x.json(); }).then(function (j) {
            var list = (j && j.list) || []; var n = list.length ? list[list.length - 1].n : null;
            if (j.error || n == null) { row.note = [j.error || "not added"].concat((j.errors || []).slice(0, 1)).join(": "); return; }
            row.scene = n;
            return fetch("/api/scenes/" + n + "/fl", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot: "first", kind: "asset", name: r1.asset }) }).then(function (x) { return x.json(); }).then(function (k) { if (k.error) row.note = k.error; });
          });
        }); });
      }).then(next);
    };
    return needSaved().then(next).then(function () {
      var md = "# Shot list - " + S.m.name + "\n\n| # | Camera | Room | Lens | Eye height | Who | Shot | StoryBoard |\n|---|---|---|---|---|---|---|---|\n"
        + rows.map(function (r, k) { return "| " + (k + 1) + " | " + r.cam + " | " + r.room + " | " + r.lens + "° | " + r.height + " m | " + (r.people.join("; ") || "-") + " | " + r.shot + " | " + (r.scene != null ? "scene " + r.scene : (r.note || "-")) + " |"; }).join("\n") + "\n";
      S.lastList = { rows: rows, md: md };
      var bad = rows.filter(function (r) { return toBoard && r.scene == null; }).length;
      say("🎬 " + rows.length + " shot" + (rows.length === 1 ? "" : "s") + " in the Image assets" + (toBoard ? (bad ? " - " + bad + " not added to the StoryBoard (" + (rows.find(function (r) { return r.note; }) || {}).note + ")" : ", " + rows.length + " StoryBoard scene" + (rows.length === 1 ? "" : "s") + " with the shot as the first frame") : "") + " · ⤓ the list", bad ? "hbad" : "hok");
      var a = $("hbListMd"); if (a) { a.style.display = ""; a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" })); }
      return S.lastList;
    }).catch(function (e) { say("🎬 " + (e && e.message || e), "hbad"); return null; });
  }
  function charOf(id) { return (S.chars || []).find(function (c) { return c.id === id; }) || null; }
  function personName(q) { var c = q && q.char ? charOf(q.char) : null; return (q && q.name) || (c && c.name) || "a person"; }
  function loadLoras() { return jget("/api/comfymodels").then(function (j) { var f = (((j || {}).categories || {}).loras || {}).files || []; S.loras = f.map(function (x) { return typeof x === "string" ? x : (x && (x.name || x.rel || x.path)) || ""; }).filter(Boolean).sort(); }).catch(function () { S.loras = []; }); }
  function loadChars() { return jget("/api/characters").then(function (j) { S.chars = (j && j.characters || []).map(function (c) { return { id: c.id, name: c.name, age: c.age || "", notes: c.notes || "", type: c.type || "", images: c.images || [] }; }); paintSide(); }).catch(function () { S.chars = []; }); }
  function realPrompt(c) {
    var rm = G.roomOf(S.m, c.floor, [c.x, c.y]), sn = G.sun(S.m.light);
    var when = sn.night ? "at night, lamps on, warm interior light" : sn.el < 18 ? "golden-hour light through the windows" : "soft natural daylight through the windows";
    var sz = (($("hbSize") && $("hbSize").value) || "1920x1080").split("x").map(Number);
    var who = seenBy(c, sz[0] / sz[1]), refs = refsOf(who), people = "";
    var pp = picPlan(refs, looksSeen(S.m, c, sz[0] / sz[1]), curStyle()), lk = "";    // 2.539.0: the 🖼 looks, after the characters
    if (pp.looks.length) lk = " " + pp.looks.map(function (L, j) {
      var q = refOf(L.ref) || {}, n = 2 + pp.chars.length + j, d = q.desc ? " (" + q.desc + ")" : "";
      return L.kind === "wall" ? "The walls are like picture " + n + d + "." : L.kind === "floor" ? "The floor is like picture " + n + d + "."
        : "Make the " + L.what + " " + L.side + " look exactly like the one in picture " + n + d + ".";
    }).join(" ");
    if (who.length) {
      people = " Replace " + (who.length > 1 ? "each grey mannequin" : "the grey mannequin") + " with a real person, in the same place, pose and size: " + who.map(function (w) {
        var ch = w.q.char ? charOf(w.q.char) : null, ri = refs.indexOf(w.q.char);
        var bits = [ch ? (ri >= 0 ? "the person in picture " + (ri + 2) + " (" + [ch.name, ch.age ? ch.age : "", ch.notes].filter(Boolean).join(", ") + ")" : ch.name) : (w.q.name || "a person")];
        return "the mannequin " + w.side + " " + w.depth + " is " + bits[0] + ", " + G.POSES[w.q.pose];
      }).join("; ") + ". Keep each face and outfit from their picture.";
    }
    return "Photorealistic interior photograph of " + (rm ? "a " + G.describe(S.m, rm.id) : "a " + G.describe(S.m)) + "." + people + lk + " Keep the exact room layout, walls, windows, doors and furniture positions from the picture; realistic materials and textures, " + when + ", 35mm lens, architectural photography.";
  }
  /** the people a camera sees, left to right: [{q, side, depth, ndc, dist}] */
  function seenBy(c, aspect) { return seen(S.m, c, aspect); }
  /** the characters among them, once each, in picture order (picture 1 is the shot) */
  function refsOf(who) { var out = []; who.forEach(function (w) { if (w.q.char && out.indexOf(w.q.char) < 0 && charOf(w.q.char)) out.push(w.q.char); }); return out; }
  function curStyle() { var v = $("hbStyle") && $("hbStyle").value; return (S.styles || []).find(function (x) { return x.id === v; }) || {}; }
  function doReal() {
    var c = curCam(); if (!c) { say("place a 📷 camera on the plan first", "hbad"); return; }
    var sid = $("hbStyle").value; if (!sid) { say("no image style takes a picture yet - add an edit style (Qwen Image Edit, Kontext, FLUX.2 Klein) in Settings -> Image", "hbad"); return; }
    var have = S.lastShot[c.id];
    (have ? Promise.resolve({ asset: have.asset }) : doShot()).then(function (r) {
      if (!r || !r.asset) return;
      var sh = S.lastShot[c.id] || {};
      say("✨ queueing…");
      // 2.528.0: the characters the camera sees go with the shot (picture 2, 3 …) - as many as the style takes
      var st = (S.styles || []).find(function (x) { return x.id === sid; }) || {};
      var ids = refsOf(seenBy(c, (sh.w || 16) / (sh.h || 9)));
      // 2.539.0: + the 🖼 looks it sees (furniture / lights, the room's walls / floor) - after the characters, as many as fit
      var pp = picPlan(ids, looksSeen(S.m, c, (sh.w || 16) / (sh.h || 9)), st), use = pp.chars;
      var charP = Promise.all(use.map(function (cid) { return fetch("/api/house/charref", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ char: cid, house: S.slug }) }).then(function (x) { return x.json(); }); }));
      var lookP = Promise.all(pp.looks.map(function (L) { var q = refOf(L.ref); return q ? fetch("/api/house/refasset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ house: S.slug, file: q.file }) }).then(function (x) { return x.json(); }) : null; }));
      return Promise.all([charP, lookP]).then(function (both) {
        var rs = both[0].concat(both[1]);
        var imgs = [r.asset].concat(rs.filter(function (x) { return x && x.name; }).map(function (x) { return x.name; }));
        var left = pp.left;
        // the people's LoRAs (once each) ride along like Basic Settings' temporary LoRAs
        var loras = [], seenL = {};
        seenBy(c, (sh.w || 16) / (sh.h || 9)).forEach(function (w) { if (w.q.lora && !seenL[w.q.lora]) { seenL[w.q.lora] = 1; loras.push({ path: w.q.lora, weight: w.q.lw }); } });
        return fetch("/api/genimage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: $("hbPrompt").value || realPrompt(c), style_id: sid, images: imgs, width: sh.w, height: sh.h, extra_loras: loras }) }).then(function (x) { return x.json(); }).then(function (j) {
          if (j.error) { say("✨ " + j.error, "hbad"); return; }
          say("✨ queued (job " + (j.job && j.job.id || j.id || "") + ") with " + imgs.length + " picture" + (imgs.length > 1 ? "s" : "") + (left > 0 ? " - " + left + " picture(s) left out: " + (st.name || "this style") + " takes " + (st.slots || 1) + " (FLUX.2 Klein edit takes 3, Qwen Image 2.1 edit 8)" : "") + " - the photoreal picture lands in the gallery", left > 0 ? "" : "hok");
          var jid = j.job && j.job.id || j.id;
          if (jid && window.H3Steps && $("hbMsg")) window.H3Steps.watch($("hbMsg"), jid);   // 2.574.0: "… · step n of total" while it renders
        });
      });
    });
  }
  function loadStyles() {
    return jget("/api/house/styles").then(function (l) {
      S.styles = Array.isArray(l) ? l : [];
      var s = $("hbStyle"); if (!s) return;
      s.innerHTML = S.styles.length ? S.styles.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + (x.swapped ? " (its edit workflow)" : "") + "</option>"; }).join("") : '<option value="">- no style takes a picture -</option>';
      var pref = S.styles.find(function (x) { return /qwen.*edit|kontext|klein/i.test(x.name); }); if (pref) s.value = pref.id;
    }).catch(function () { /* offline */ });
  }

  /* ---------------- houses: list, open, save */
  function loadList() { return jget("/api/house").then(function (l) { S.list = Array.isArray(l) ? l : []; var s = $("hbHouse"); if (!s) return; s.innerHTML = '<option value="">' + (S.slug ? "" : "- not saved yet -") + "</option>" + S.list.map(function (h) { return '<option value="' + esc(h.slug) + '"' + (h.slug === S.slug ? " selected" : "") + ">🏠 " + esc(h.name) + " (" + h.rooms + " rooms, " + h.area + " m²)</option>"; }).join(""); }); }
  function open(slug) {
    return jget("/api/house/" + encodeURIComponent(slug)).then(function (m) {
      if (m.error) { say(m.error, "hbad"); return; }
      S.m = G.normalize(m); S.slug = slug; S.floor = 0; S.sel = null; S.undo = []; S.redo = []; S.dirty = false; S.look = "orbit"; S.scaleMode = null; traceImage(); fit(); paintFloors(); paint(); paintSide(); fillLook(); rebuild3d(); say("🏠 " + S.m.name);
    });
  }
  function save(quiet) {
    if (!S.m) return Promise.resolve();
    var m = G.normalize(S.m);
    return fetch("/api/house", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(m) }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.error) { say(j.error, "hbad"); throw new Error(j.error); }
      S.slug = j.slug; S.dirty = false;
      return planPng().then(function (b) { return b ? upload("plan", "plan", b) : null; }).catch(function () { /* the list's picture is a nicety */ })
        .then(loadList).then(function () { if (!quiet) say("💾 saved " + m.name, "hok"); });
    });
  }
  function planPng() {
    var W = 1200, H = 900, c = document.createElement("canvas"); c.width = W; c.height = H;
    var keep = [S.zoom, S.ox, S.oy, S.sel]; S.sel = null; fitTo(W, H); drawPlan(c.getContext("2d"), W, H, true); S.zoom = keep[0]; S.ox = keep[1]; S.oy = keep[2]; S.sel = keep[3];
    return toBlob(c);
  }
  function fitTo(W, H) {
    var pts = []; S.m.walls.forEach(function (w) { if (w.floor === S.floor) pts.push(w.a, w.b); }); S.m.rooms.forEach(function (r) { if (r.floor === S.floor) pts = pts.concat(r.poly); });
    if (!pts.length) { S.zoom = 40; S.ox = 60; S.oy = 60; return; }
    var x0 = Math.min.apply(null, pts.map(function (p) { return p[0]; })), x1 = Math.max.apply(null, pts.map(function (p) { return p[0]; })), y0 = Math.min.apply(null, pts.map(function (p) { return p[1]; })), y1 = Math.max.apply(null, pts.map(function (p) { return p[1]; }));
    S.zoom = Math.max(8, Math.min(140, Math.min((W - 80) / Math.max(1, x1 - x0), (H - 80) / Math.max(1, y1 - y0))));
    S.ox = W / 2 - (x0 + x1) / 2 * S.zoom; S.oy = H / 2 - (y0 + y1) / 2 * S.zoom;
  }
  function fit() { var r = cv().getBoundingClientRect(); if (r.width > 10) fitTo(r.width, r.height); paint(); }

  /* ---------------- the docker */
  function build() {
    var body = document.createElement("div"); body.className = "hbd"; body.id = "hbBody"; body.tabIndex = 0;
    body.innerHTML = '<div class="hbar"><select id="hbHouse" aria-label="House"></select><button type="button" class="ghost" id="hbNew">＋ New</button><button type="button" class="ghost" id="hbEx" title="A furnished example to start from">📋 Example</button>'
      + '<button type="button" id="hbSave" title="Ctrl+S">💾 Save</button><button type="button" class="ghost" id="hbDelH" title="Delete this house">🗑</button><span class="sep"></span>'
      + '<span id="hbFloors" class="hbar"></span><span class="sep"></span><button type="button" class="ghost" id="hbUndo" title="Ctrl+Z">↶</button><button type="button" class="ghost" id="hbRedo" title="Ctrl+Y">↷</button><button type="button" class="ghost" id="hbFit" title="Fit the plan">⤢</button><span class="sep"></span>'
      + '<button type="button" class="ghost" data-view="plan">Plan</button><button type="button" class="ghost" data-view="both">Both</button><button type="button" class="ghost" data-view="3d">3D</button>'
      + '<select id="hbLook" title="The 3D view: orbit, or a camera\'s own view"></select><label class="hnote"><input type="checkbox" id="hbCeil"> ceilings</label><label class="hnote" title="The roof in the orbit view (the shots, 360°s and exports always have it)"><input type="checkbox" id="hbRoofShow"> roof</label></div>'
      + '<div class="hmain"><div class="htools">' + TOOLS.map(function (t) { return '<button type="button" class="ghost" data-tool="' + t[0] + '" title="' + esc(t[2]) + '">' + t[1] + "</button>"; }).join("") + "</div>"
      + '<div class="hviews"><div class="hview" id="hbPlanHost"><canvas id="hbPlan"></canvas><div class="hcap">Plan · metres · wheel = zoom, right-drag = pan</div></div>'
      + '<div class="hview" id="hb3dHost"><canvas id="hb3d"></canvas><div class="hcap" id="hb3dCap">3D</div></div></div>'
      + '<div class="hside"><div class="hsec" id="hbProps"></div>'
      + '<div class="hsec"><h5>☀ Light</h5><div class="hf"><label>Time</label><input type="range" id="hbHour" min="0" max="24" step="0.5"><label>North</label><input type="range" id="hbNorth" min="-180" max="180" step="5">'
      + '<label>Sun</label><label class="hnote"><input type="checkbox" id="hbSun"> sunlight + shadows</label><label>Lamps</label><label class="hnote"><input type="checkbox" id="hbLamps"> on (always at night)</label><label>Ambient</label><input type="range" id="hbAmb" min="0" max="1.5" step="0.05"></div><div class="hnote" id="hbSunInfo"></div></div>'
      + '<div class="hsec"><h5>📍 As a location</h5><div class="hf"><label>Camera</label><select id="hbCam"></select><label>Shot size</label><select id="hbSize">' + opt([["1920x1080", "1920 × 1080"], ["1280x720", "1280 × 720"], ["1080x1920", "1080 × 1920 (tall)"], ["1024x1024", "1024 × 1024"], ["2048x1152", "2048 × 1152"]], "1920x1080") + "</select></div>"
      + '<div class="hbar" style="margin-top:4px"><button type="button" id="hbPano" title="A 360° panorama from the camera -> a Location (its view, its @tag)">📍 360° location</button><button type="button" class="ghost" id="hbShot" title="The camera\'s picture + its depth and normal maps -> Image assets">📷 Shot + maps</button></div>'
      + '<div id="hbShots" style="margin-top:4px"></div>'
      + '<div class="hf" style="margin-top:6px"><label>✨ Style</label><select id="hbStyle"></select><label>Prompt</label><textarea id="hbPrompt" placeholder="written from the room - edit it"></textarea></div>'
      + '<div class="hbar" style="margin-top:4px"><button type="button" class="ghost" id="hbPromptGo" title="Write the prompt from the camera\'s room">✍ From the room</button><button type="button" id="hbReal" title="The shot -> a photoreal picture (an image style that takes a picture)">✨ Make it real</button></div>'
      + '<div class="hbar" style="margin-top:6px"><a class="ghost" id="hbObj" download style="text-decoration:none;padding:3px 8px;border:1px solid var(--line,#444);border-radius:5px;color:inherit" title="house.obj + house.mtl (metres, Y up) for Blender / Unreal">⤓ .obj</a>'
      + '<a class="ghost" id="hbGlb" download style="text-decoration:none;padding:3px 8px;border:1px solid var(--line,#444);border-radius:5px;color:inherit" title="One .glb (binary glTF) with its materials - Blender, Unreal, Godot, most 3D viewers">⤓ .glb</a></div>'
      + '<h5 style="margin-top:8px">🎬 Shot list</h5><div class="hbar"><label class="hnote"><input type="checkbox" id="hbToBoard" checked> add them to the StoryBoard</label></div>'
      + '<div class="hbar" style="margin-top:4px"><button type="button" class="ghost" id="hbList" title="Every camera: its shot + depth map in the Image assets, a StoryBoard scene each (the shot as its first frame), and the list as .md">🎬 Every camera</button><a id="hbListMd" download="shot-list.md" style="display:none" class="ghost">⤓ the list</a></div></div>'
      + '</div></div><div class="hnote" id="hbMsg" aria-live="polite"></div>';
    return body;
  }
  function paintLight() {
    var L = S.m.light, sn = G.sun(L);
    $("hbHour").value = L.hour; $("hbNorth").value = L.north; $("hbSun").checked = L.sun !== false; $("hbLamps").checked = !!L.lamps; $("hbAmb").value = L.ambient;
    var hh = Math.floor(L.hour), mm = Math.round((L.hour - hh) * 60);
    $("hbSunInfo").textContent = (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm + " · " + (sn.night ? "night - the lamps light it" : "the sun " + Math.round(sn.el) + "° up") + " (southern hemisphere: noon sun in the north)";
  }
  function wire(body) {
    var c = cv();
    c.addEventListener("pointerdown", function (e) { c.setPointerCapture(e.pointerId); down(e); });
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", up);
    c.addEventListener("dblclick", function () { if (S.draft && S.draft.kind === "wall") { S.draft = null; paint(); } });
    c.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    c.addEventListener("wheel", function (e) { e.preventDefault(); var r = c.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, w = toW(mx, my), k = e.deltaY < 0 ? 1.15 : 1 / 1.15; S.zoom = Math.max(6, Math.min(300, S.zoom * k)); S.ox = mx - w[0] * S.zoom; S.oy = my - w[1] * S.zoom; paint(); }, { passive: false });
    c.addEventListener("pointerleave", function () { S.hover = null; paint(); });
    c.addEventListener("dragover", function (e) { var t = e.dataTransfer && e.dataTransfer.types; if (t && (Array.prototype.indexOf.call(t, "application/x-h3ref") >= 0 || Array.prototype.indexOf.call(t, "Files") >= 0)) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } });
    c.addEventListener("drop", planDrop);                                               // 2.539.0
    body.addEventListener("keydown", key);
    body.addEventListener("keyup", function (e) { if (e.key === "Shift" || e.key === "Alt") { if (e.key === "Alt") e.preventDefault(); clearTimeout(S.walkWait); S.walkWait = null; stopGlide(); } });
    window.addEventListener("blur", stopGlide);
    body.querySelectorAll("[data-tool]").forEach(function (b) { b.onclick = function () { setTool(b.dataset.tool); }; });
    body.querySelectorAll("[data-view]").forEach(function (b) { b.onclick = function () { setView(b.dataset.view); }; });
    $("hbNew").onclick = function () {
      var ask = root.H3Panels && H3Panels.ask ? H3Panels.ask("New house", "A name for it:", "My house") : Promise.resolve(window.prompt ? prompt("A name for the house:", "My house") : "My house");
      Promise.resolve(ask).then(function (n) { if (!n) return; S.m = fresh(n); S.slug = ""; S.floor = 0; S.sel = null; S.undo = []; S.look = "orbit"; S.zoom = 40; S.ox = 60; S.oy = 60; paintFloors(); paint(); paintSide(); fillLook(); rebuild3d(); setTool("room"); say("▭ drag a room on the plan to start"); });
    };
    $("hbEx").onclick = function () { tev("house_example", "📋"); snapshotIf(); S.m = G.example(); S.slug = ""; S.floor = 0; S.sel = null; S.look = "orbit"; fit(); paintFloors(); paintSide(); fillLook(); if (S.three) S.three.built = null; rebuild3d(); say("📋 the example - 💾 Save it under its own name to keep it"); };
    $("hbSave").onclick = function () { save(); };
    $("hbDelH").onclick = function () {
      if (!S.slug) { S.m = fresh(); paint(); rebuild3d(); return; }
      var ok = typeof appConfirm === "function" ? appConfirm("Delete the house " + S.m.name + "? (its Locations and shots stay)") : Promise.resolve(confirm("Delete " + S.m.name + "?"));
      Promise.resolve(ok).then(function (y) { if (!y) return; fetch("/api/house/" + encodeURIComponent(S.slug), { method: "DELETE" }).then(function () { S.slug = ""; S.m = fresh(); paintFloors(); paint(); paintSide(); rebuild3d(); loadList(); }); });
    };
    $("hbHouse").onchange = function (e) { if (e.target.value) open(e.target.value); };
    $("hbUndo").onclick = undo; $("hbRedo").onclick = redo; $("hbFit").onclick = fit;
    $("hbLook").onchange = function (e) { S.look = e.target.value; rebuild3d(); };
    $("hbCeil").onchange = function (e) { S.ceil = e.target.checked; rebuild3d(); };
    $("hbRoofShow").onchange = function (e) { S.roof = e.target.checked; rebuild3d(); };
    var lt = function (k, f) { $(k).oninput = function (e) { S.m.light[f] = e.target.type === "checkbox" ? e.target.checked : +e.target.value; S.dirty = true; paintLight(); clearTimeout(S.lt); S.lt = setTimeout(rebuild3d, 120); if (f === "north") paint(); }; $(k).onchange = $(k).oninput; };
    lt("hbHour", "hour"); lt("hbNorth", "north"); lt("hbSun", "sun"); lt("hbLamps", "lamps"); lt("hbAmb", "ambient");
    $("hbPano").onclick = doPano; $("hbShot").onclick = doShot; $("hbReal").onclick = doReal;
    $("hbPromptGo").onclick = function () { var cc = curCam(); if (cc) $("hbPrompt").value = realPrompt(cc); };
    $("hbCam").onchange = function () { var cc = curCam(); if (cc && !$("hbPrompt").value) $("hbPrompt").value = realPrompt(cc); };
    $("hbGlb").onclick = function (e) { if (!S.slug) { e.preventDefault(); save().then(function () { location.assign("/api/house/" + encodeURIComponent(S.slug) + "/glb"); }); return; } this.href = "/api/house/" + encodeURIComponent(S.slug) + "/glb"; };
    $("hbList").onclick = function () { shotList($("hbToBoard").checked); };
    $("hbObj").onclick = function (e) { if (!S.slug) { e.preventDefault(); save().then(function () { location.assign("/api/house/" + encodeURIComponent(S.slug) + "/obj"); }); return; } this.href = "/api/house/" + encodeURIComponent(S.slug) + "/obj"; };
    body.querySelectorAll(".hside input,.hside select,.hside textarea,.hbar select").forEach(function (el) { el.addEventListener("keydown", function (e) { e.stopPropagation(); }); });
    if (root.ResizeObserver) new ResizeObserver(function () { paint(); }).observe($("hbPlanHost"));
  }
  function snapshotIf() { if (S.m) snapshot(); }
  function start() {
    if (!root.SecFloat || !SecFloat.add || !SecFloat.started || !$("tP") || !G) { setTimeout(start, 150); return; }
    if ($("hbBody")) return;
    if (!$("hbCss")) { var st = document.createElement("style"); st.id = "hbCss"; st.textContent = CSS; document.head.appendChild(st); }
    var body = build();
    var btn = document.createElement("button"); btn.type = "button"; btn.id = "hbBtn"; btn.textContent = "🏠 House";
    btn.title = "House builder - draw a floor plan, furnish it, see it in 3D, and make it a Location (360°), shots + depth maps, ✨ photoreal, .obj";
    var anchor = $("ltBtn") || $("mmBtn") || $("tP"); anchor.parentNode.insertBefore(btn, anchor.nextSibling);
    SecFloat.add({ id: "house", title: "🏠 House builder", w: 1220, h: 800, body: body, button: btn, onShow: function () { if (!S.m) S.m = fresh(); loadList(); loadStyles(); loadChars(); loadLoras(); paintFloors(); paintLight(); fillLook(); setTimeout(function () { if (!S.slug && !S.m.walls.length) fit(); paint(); paintSide(); rebuild3d(); }, 60); } });
    S.m = fresh(); wire(body); setTool("select"); setView("both"); paintFloors(); paintLight();
    // 2.527.0: already shown at start (a layout put it back) - fill it as onShow would (the list, the styles)
    setTimeout(function () { if (SecFloat.state("house").shown) { loadList(); loadStyles(); loadChars(); loadLoras(); fillLook(); rebuild3d(); } }, 300);
  }
  root.H3House = Object.assign({ furnish: furnish, shotList: shotList, loadTrace: loadTrace, state: function () { return S; }, open: open, save: save, renderShot: renderShot, renderPano: renderPano, doPano: doPano, doShot: doShot, doReal: doReal, realPrompt: realPrompt,
    frameOf: frameOf, handles: handles, reachOf: reachOf, pick: pick, attachRef: attachRef, useRef: useRef, fromDock: fromDock, refPicker: refPicker, scaleTo: scaleTo, turnTo: turnTo, rotObj: rotObj, boxPick: boxPick, walkStep: walkStep, walkCam: walkCam, glide: glide, stopGlide: stopGlide, turnSel: turnSel, delSel: delSel, applyLook: applyLook,
    setTool: setTool, setView: setView, show: function (on) { return root.SecFloat && SecFloat.show ? SecFloat.show("house", on) : false; }, model: function () { return S.m; }, load: function (m) { S.m = G.normalize(m); S.slug = ""; fit(); paintFloors(); paintSide(); fillLook(); rebuild3d(); } }, pure);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
