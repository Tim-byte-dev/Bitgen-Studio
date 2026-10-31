/* bitGen Studio — ext/pushpulldock/pparchtools.js (2.620.0): THE ARCHITECTURE TOOLS of the 📏 PushPull docker (window.PPArchTools)
 * + the properties panel (#ppProps) for what is picked / the tool's settings.
 *
 * Tim (verbatim): "add architectural tools like floor, walls,windows, ceiling,roof  etc. rooms will be able to be dragged,
 * their  walls can snap to another room and share the wall, door or window etc. add lights, downlights, pendant lights,
 * chandelier lights, ceiling mounted lights etc."
 *   U Room     two corners (or "4,3") - walls + floor + ceiling; a corner snaps to another room's corner / wall middle
 *   W Wall     click, click … - a free-standing wall; back on its start = a room; double-click / Esc ends it
 *   D Door     click on a wall (single · double · sliding · glass · an opening without a door)  - "0.9,2.1" = its size
 *   I Window   click on a wall (single · double · slider) - "1.2,1.2"
 *   J Floor    two corners: a floor without walls (a deck, a storey's floor plate) - "4,3"
 *   K Ceiling  click a room: its ceiling on / off
 *   Y Roof     click a room: a roof over it (gable · hip · shed · flat); Shift+click another: the same roof over it too
 *   X Light    downlight · ceiling · pendant · chandelier · spot · wall light · floor lamp · table lamp - a click puts it on
 *              the ceiling of the room under the mouse (the room's middle snaps), a wall light on the wall
 *   V Stairs   the foot, then the direction + length - its rise in the panel
 *   Select (Space): press on a room and DRAG it - its wall snaps onto a neighbour's wall (one wall, shared) and its corners
 *   onto theirs; a door / window drags along its wall (and onto another); a light, stairs, a floor drag too. Delete erases.
 *   B Paint on a wall paints that room's walls (outside: all the outside walls), a floor, a ceiling, a door, a roof …
 *   E Eraser on any of them erases it.
 * 2.624.0 (Tim: "when user creates walls add offset input to offset wall from edge of floor, allow user to drag walls but show
 * snap regions on floor and allow user to snap wall to floor edge, when user double clicks the the top of a wall cut the face
 * allow the use to drag that edge up and down and delete the edge when the del button is pressed and edge is selected. allow
 * user to select edges on the wall to change slope of the wall. in ceiling options add flat ceiling, follow slope of walls,
 * with roof follow slope of walls add eaves width input"):
 *   Room / Wall: "Offset from floor edge" - drawn along a floor's (J) edge, the wall's outside face sits that far in; points
 *   snap onto floors' edges ("On Floor Edge"). Select: press a WALL and drag = that wall moves out / in (the room
 *   stretches; a free wall moves whole); press the floor / ceiling = the room moves - the floors' snap regions show (the
 *   band where a wall's outside face snaps to the edge, offset in) and the wall snaps there (or onto another room's wall).
 *   Double-click the TOP of a wall = a cut there (a line down the wall); press the cut / a top edge and drag up / down = the
 *   wall's top slopes (a corner moves the wall beside it too); Delete = the cut goes (a top edge: its cuts go). Ceiling:
 *   none / flat / follow the walls' slope; Roof "Follow the walls' slope" with its eaves width.
 * create(ctx) -> {owns(tool), use, down / move / up / dbl, vcb, key, selectDown / selectMove / selectUp, eraseAt, paintAt,
 *   sel(), setSel(), props(), summary()} - wired into pptools.js; ctx = the docker (ppdock.js) */
(function (root) {
  "use strict";
  const P = () => root.PPArch, G = () => root.PPGeo;
  const TOOLS = [["room", "⌂", "Room", "u"], ["wall", "▮", "Wall", "w"], ["door", "🚪", "Door", "d"], ["window", "🪟", "Window", "i"], ["floor", "▦", "Floor", "j"],
    ["ceiling", "⌓", "Ceiling", "k"], ["roof", "△", "Roof", "y"], ["light", "💡", "Light", "x"], ["stairs", "▟", "Stairs", "v"], ["furniture", "🛋", "Furniture", "a"], ["camera", "📷", "Camera", "z"]];
  const HINT = {
    room: "Click a corner, click the opposite corner (or type  4,3) - walls, a floor and a ceiling; corners snap to other rooms",
    wall: "Click, click … a free-standing wall · back on its start = a room · double-click or Esc ends it · type a length",
    door: "Click on a wall to put a door in it (the style in the panel) · type  width,height",
    window: "Click on a wall to put a window in it · type  width,height",
    floor: "Click a corner, click the opposite corner (or type  4,3) - a floor without walls",
    ceiling: "Click a room - its ceiling on / off",
    roof: "Click a room - a roof over it · Shift+click more rooms - the same roof over them · type the pitch",
    light: "Click in a room - the light on its ceiling (the room's middle snaps) · a wall light: click a wall · the type in the panel",
    stairs: "Click the foot of the stairs, click the direction + length (or type it) - the height in the panel",
    camera: "Click where the camera stands, click where it looks - then 📷 shot + depth + normal maps, 📍 a 360° location in its panel",
    furniture: "Pick a piece in the panel, click on a floor to put it there · R turns it 90° · type degrees · Select drags it",
  };
  const VCB = { room: "Width,Depth", wall: "Length", door: "Width,Height", window: "Width,Height", floor: "Width,Depth", roof: "Pitch°", light: "Lumens", stairs: "Length", furniture: "Turn°", camera: "Lens°" };
  const OPT0 = { room: { h: 2.7, t: 0.15, z: 0, ceilOn: true, off: 0, autoRoof: false, autoFloor: false }, wall: { h: 2.7, t: 0.15, z: 0, off: 0 }, door: { style: "single", w: 0.9, h: 2.1 }, window: { style: "double", w: 1.2, h: 1.2, sill: 0.9 },
    floor: { z: 0, th: 0.2 }, roof: { type: "gable", pitch: 30, over: 0.4 }, light: { type: "downlight", col: "#ffcf9e", lm: 0 }, stairs: { w: 1, rise: 2.7 }, furniture: { type: "sofa", cat: "Living", rot: 0, color: "" }, camera: { eye: 1.6, fov: 60 } };

  function create(ctx) {
    const V = ctx.V, v3 = () => G().v3;
    let tool = null, st = {}, asel = null, through = null;      // through: 2.631.0 the camera the view looks through
    const O = JSON.parse(JSON.stringify(OPT0));
    try { const s = JSON.parse(root.localStorage.getItem("pp.archopt") || "{}"); Object.keys(O).forEach((k) => { if (s[k] && typeof s[k] === "object") Object.assign(O[k], s[k]); }); } catch (e) { /* fine */ }
    const keepOpt = () => { try { root.localStorage.setItem("pp.archopt", JSON.stringify(O)); } catch (e) { /* fine */ } };
    const AV = () => ctx.archView(), AR = () => P().of(ctx.model());
    const fmt = (m) => G().fmtLen(m);
    const owns = (n) => !!HINT[n];

    /* ---- the mouse on a level */
    /** 2.625.0: the ray on a vertical plane (a wall's face) through p, square to n */
    function wallAt(ev, p, n) { const r = V.ray(ev), den = r.d[0] * n[0] + r.d[1] * n[1]; if (Math.abs(den) < 0.12) return null; const t = ((p[0] - r.o[0]) * n[0] + (p[1] - r.o[1]) * n[1]) / den; return t > 0 ? [r.o[0] + r.d[0] * t, r.o[1] + r.d[1] * t, r.o[2] + r.d[2] * t] : null; }
    /** 2.625.0: the picked door / window's grip under the pointer (on the wall's face toward the camera) -> {key, n, p} | null */
    /** 2.633.0: the rotate ring under the pointer (a picked camera / piece of furniture) -> {key, axis, c} | null */
    function ringAt(ev) {
      if (!asel || (asel.ak !== "cam" && asel.ak !== "item") || !root.PPCam) return null;
      const o = P().find(AR(), asel.ak, asel.id); if (!o) return null;
      const G0 = root.PPCam.rings(asel.ak, o), r = V.canvas.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
      let best = null;
      const cp = V.cam().position, vd = [G0.c[0] - cp.x, G0.c[1] - cp.y, G0.c[2] - cp.z], vl = Math.hypot(vd[0], vd[1], vd[2]) || 1;
      G0.rings.forEach((rg) => {
        // a ring seen edge-on is a line through the middle - it gives way to an open one (and turning it by dragging round would not read)
        const open = Math.abs((rg.axis[0] * vd[0] + rg.axis[1] * vd[1] + rg.axis[2] * vd[2]) / vl); if (open < 0.08) return;
        const S = rg.pts.map((p) => V.screen(p));
        for (let i = 0; i < S.length; i++) {
          const a = S[i], b = S[(i + 1) % S.length]; if (a[2] > 1 || b[2] > 1) continue;
          const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((mx - a[0]) * dx + (my - a[1]) * dy) / L2));
          const d = Math.hypot(mx - a[0] - dx * t, my - a[1] - dy * t) + (1 - open) * 4;
          if (d < 8 && (!best || d < best.d)) best = { d, key: rg.key, axis: rg.axis, c: G0.c };
        }
      });
      return best;
    }
    function gripAt(ev) {
      if (!asel || asel.ak !== "op") return null;
      const A = AR(), op = A.ops.find((o) => o.id === asel.id), I = op && P().opInfo(A, op); if (!I) return null;
      const r = V.canvas.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top, cam = V.cam().position;
      const side = (cam.x - I.c[0]) * I.nl[0] + (cam.y - I.c[1]) * I.nl[1] >= 0 ? 1 : 0;
      let best = null;
      P().opHandles(A, op).forEach((h) => { const q = V.screen(h.sides[side]); if (q[2] > 1) return; const d = Math.hypot(q[0] - mx, q[1] - my); if (d < 11 && (!best || d < best.d)) best = { d, key: h.key, p: h.sides[side], n: I.nl }; });
      return best;
    }
    /** 2.628.0: the floor under a plan point - a room's, else a floor slab's top, else the ground */
    function floorAt(A, p) {
      const R = P().roomAt(A, p, null); if (R) return R.z;
      const sl = A.slabs.find((s) => P().inPoly(p, s.pts)); return sl ? sl.z : 0;
    }
    function furnAt(ev) {
      const A = AR(), q = planeAt(ev, 0); if (!q) return null;
      let z = floorAt(A, q), p = planeAt(ev, z) || q; z = floorAt(A, p);
      return root.PPFurn ? root.PPFurn.make(O.furniture.type, p, z, O.furniture.rot, O.furniture.color, O.furniture.pose) : null;
    }
    function planeAt(ev, z) { const r = V.ray(ev); if (Math.abs(r.d[2]) < 1e-9) return null; const t = (z - r.o[2]) / r.d[2]; return t > 0 ? [r.o[0] + r.d[0] * t, r.o[1] + r.d[1] * t, z] : null; }
    function snapPlan(ev, z, from) {
      const s = V.snap(ev, { from: from ? [from[0], from[1], z] : null, plane: { n: [0, 0, 1], p: [0, 0, z] }, extra: P().snapPoints(AR(), z), group: ctx.group() });
      let p = [s.p[0], s.p[1], z];
      if ((s.kind === "On Face" || s.kind === "On Edge") && Math.abs(s.p[2] - z) > 1e-3) { const q = planeAt(ev, z); if (q) p = q; }
      // 2.624.0: onto a floor's edge (On Floor Edge) when nothing stronger caught the pointer
      if (!/Endpoint|Midpoint|Origin|Axis/.test(s.kind)) {
        const tol = pxTol(p); let best = null;
        P().slabEdges(AR()).forEach((e) => { const sd = P().segDist([p[0], p[1]], e.a, e.b); if (sd.d < tol && (!best || sd.d < best.d)) best = { d: sd.d, q: [e.a[0] + (e.b[0] - e.a[0]) * sd.t, e.a[1] + (e.b[1] - e.a[1]) * sd.t] }; });
        if (best) { p = [best.q[0], best.q[1], z]; return { p, s: Object.assign({}, s, { p, kind: "On Floor Edge", label: "On Floor Edge", color: "#f59e2c" }) }; }
      }
      return { p, s };
    }
    function pxTol(p) { const a = V.screen(p), b = V.screen([p[0] + 1, p[1], p[2]]), c = V.screen([p[0], p[1] + 1, p[2]]); const ppm = Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), Math.hypot(c[0] - a[0], c[1] - a[1]), 1); return Math.min(1.2, Math.max(0.03, 14 / ppm)); }
    function show(s, o) {
      const p = o || {};
      V.preview({ lines: p.lines || [], dashed: (p.dashed || []).concat(p.from && s.axis != null ? [{ seg: [p.from, s.p], color: s.color }] : []), faces: p.faces, marker: { p: p.at || s.p, color: p.mcol || s.color }, tip: (p.tip ? p.tip + (s.label && !p.noLabel ? "  ·  " : "") : "") + (p.noLabel ? "" : s.label || ""), tipAt: p.at || s.p, color: p.color || 0x2563eb });
    }
    const loop3 = (P2, z) => P2.map((p, i) => { const q = P2[(i + 1) % P2.length]; return [[p[0], p[1], z], [q[0], q[1], z]]; });
    /** the room / wall under the mouse */
    function hitAt(ev) {
      const h = AV() && AV().pick(ev); if (h) return { xy: [h.point[0] - h.n[0] * 0.02, h.point[1] - h.n[1] * 0.02], z: h.point[2], hit: h, t: AV().resolve(h) };
      const q = planeAt(ev, 0); return q ? { xy: [q[0], q[1]], z: 0, hit: null, t: null } : null;
    }
    function roomUnder(ev) {
      const H = hitAt(ev); if (!H) return null;
      if (H.t && H.t.ak === "room") return P().room(AR(), H.t.id);
      return P().roomAt(AR(), H.xy, H.z);
    }
    const before = () => ctx.snapshot();
    function done(label, b, sel) { ctx.commit(label, b); if (sel !== undefined) setSel(sel); else props(); }

    /* ---- the tools */
    function use(name) {
      tool = owns(name) ? name : null; st = {};
      if (AV()) AV().setHover(null);
      if (tool) setSel(null, true);
      props();
    }
    function rectTool(ev, z, finish) {
      const { p, s } = snapPlan(ev, z, st.a);
      if (!st.a) { st.a = p; return; }
      finish(st.a, p, s);
    }
    function down(ev) {
      if (ev.button !== 0) return;
      const A = AR();
      if (tool === "room") return rectTool(ev, O.room.z, (a, b) => finishRoom(a, b));
      if (tool === "floor") return rectTool(ev, O.floor.z, (a, b) => finishSlab(a, b));
      if (tool === "wall") {
        const from = st.pts && st.pts[st.pts.length - 1], { p } = snapPlan(ev, O.wall.z, from);
        if (!st.pts) { st.pts = [p]; return; }
        if (st.pts.length >= 3 && Math.hypot(p[0] - st.pts[0][0], p[1] - st.pts[0][1]) < 1e-6) { finishWall(true); return; }
        if (Math.hypot(p[0] - from[0], p[1] - from[1]) < 1e-6) return;
        st.pts.push(p); return;
      }
      if (tool === "door" || tool === "window") {
        const w = st.w || wallFor(ev); if (!w) { ctx.status("point at a wall - a " + tool + " goes in a wall"); return; }
        const b = before(), kind = tool === "door" && O.door.style === "opening" ? "opening" : tool;
        const o = tool === "door" ? { w: O.door.w, h: O.door.h, sill: 0, style: kind === "opening" ? "plain" : O.door.style } : { w: O.window.w, h: O.window.h, sill: O.window.sill, style: O.window.style };
        const op = P().addOp(A, kind, w, o); st.last = op.id;
        done(kind, b); ctx.status((kind === "opening" ? "▯ an opening" : tool === "door" ? "🚪 a door" : "🪟 a window") + " in " + w.R.name + "'s wall - drag it along (Select), its size in the panel"); return;
      }
      if (tool === "ceiling") {
        const R = roomUnder(ev); if (!R) { ctx.status("click a room"); return; }
        const b = before(); R.ceilOn = !R.ceilOn; done("ceiling", b); ctx.status("⌓ " + R.name + ": ceiling " + (R.ceilOn ? "on" : "off")); return;
      }
      if (tool === "roof") {
        const R = roomUnder(ev); if (!R) { ctx.status("click a room - the roof goes over it"); return; }
        const last = st.roof && A.roofs.find((x) => x.id === st.roof);
        if (ev.shiftKey && last) { if (!last.rooms.includes(R.id)) { const b = before(); last.rooms.push(R.id); done("roof", b); } ctx.status("△ the roof covers " + last.rooms.length + " rooms"); return; }
        const own = A.roofs.find((x) => x.rooms.includes(R.id));
        if (own) { st.roof = own.id; setSel({ ak: "roof", id: own.id }); ctx.status("△ " + R.name + " already has a roof - its settings are in the panel (Shift+click adds rooms to it)"); return; }
        const b = before(), rf = P().addRoof(A, [R.id], { type: O.roof.type, pitch: O.roof.pitch, over: O.roof.over }); st.roof = rf.id;
        done("roof", b); ctx.status("△ a " + rf.type + " roof over " + R.name + " · Shift+click more rooms to put them under it"); return;
      }
      if (tool === "light") {
        const L0 = st.lp || lightFor(ev); if (!L0) return;
        const b = before(), d = P().LIGHTS[O.light.type];
        const L = P().addLight(A, O.light.type, L0.p, { room: L0.room, col: O.light.col, lm: O.light.lm > 0 ? O.light.lm : d.lm, dir: L0.dir || 0 });
        done("light", b); ctx.status("💡 a " + d.label.toLowerCase() + (L0.room ? " in " + P().room(A, L0.room).name : "") + " · 🌙 Night shows what it lights"); void L; return;
      }
      if (tool === "camera" && root.PPCam) {                             // 2.629.0: 📷 where it stands, then where it looks
        const q = planeAt(ev, 0); if (!q) return;
        const z = floorAt(A, q), p = planeAt(ev, z) || q;
        if (!st.cp) { st.cp = [p[0], p[1]]; st.cz = floorAt(A, p); ctx.status("📷 now click where it looks"); return; }
        const b = before(), c = root.PPCam.make(st.cp, [p[0], p[1]], st.cz, O.camera.eye, O.camera.fov, "Camera " + ((A.cams || []).length + 1));
        if (!A.cams) A.cams = []; c.id = A.n++; A.cams.push(c); st = {};
        done("camera", b, { ak: "cam", id: c.id }); ctx.status("📷 " + c.name + " - 👁 look through it, 📷 shots, 📍 a 360° location in its panel"); return;
      }
      if (tool === "furniture") {                                        // 2.628.0: 🛋 a piece on the floor under the click
        const it = furnAt(ev); if (!it) return;
        const b = before(); if (!A.items) A.items = []; it.id = A.n++; A.items.push(it);
        done("furniture", b, { ak: "item", id: it.id }); ctx.status("🛋 " + root.PPFurn.label(it) + " · R turns the next one · Select drags it"); return;
      }
      if (tool === "stairs") {
        const { p } = snapPlan(ev, 0, st.a);
        if (!st.a) { st.a = p; return; }
        finishStairs(st.a, p); return;
      }
    }
    function move(ev) {
      const A = AR();
      if (tool === "camera" && st.cp) {
        const q = planeAt(ev, st.cz || 0); if (!q) return;
        const e = [st.cp[0], st.cp[1], (st.cz || 0) + O.camera.eye];
        V.preview({ lines: [[e, [q[0], q[1], e[2]]]], marker: { p: e, color: "#2563eb" }, tip: "📷 looking " + Math.round(((-Math.atan2(q[1] - e[1], q[0] - e[0]) * 180 / Math.PI) + 360) % 360) + "°", tipAt: e, color: 0x2563eb });
        return;
      }
      if (tool === "furniture") {
        const it = furnAt(ev); if (!it) { V.preview({}); return; }
        const F = root.PPFurn.footprint(it), z = it.z + 0.01, lines = F.map((p, i) => { const q = F[(i + 1) % 4]; return [[p[0], p[1], z], [q[0], q[1], z]]; });
        const fr = [(F[0][0] + F[1][0]) / 2, (F[0][1] + F[1][1]) / 2];
        lines.push([[it.x, it.y, z], [it.x + (it.x - fr[0]) * 0.8, it.y + (it.y - fr[1]) * 0.8, z]]);      // its front
        V.preview({ lines, tip: "🛋 " + root.PPFurn.label(it) + " · " + it.rot + "°", tipAt: [it.x, it.y, it.z + it.h], color: 0x2563eb });
        return;
      }
      if (tool === "room" || tool === "floor") {
        const z = tool === "room" ? O.room.z : O.floor.z, { p, s } = snapPlan(ev, z, st.a);
        if (!st.a) { show(s, { tip: tool === "room" ? "a room's corner" : "a floor's corner" }); return; }
        st.cur = p; const R = P().rectPts(st.a, p), w = Math.abs(p[0] - st.a[0]), d = Math.abs(p[1] - st.a[1]);
        const lines = loop3(R, z); if (tool === "room") { loop3(R, z + O.room.h).forEach((x) => lines.push(x)); R.forEach((q) => lines.push([[q[0], q[1], z], [q[0], q[1], z + O.room.h]])); }
        show(s, { from: st.a, lines, faces: [[[R[0][0], R[0][1], z], [R[1][0], R[1][1], z], [R[2][0], R[2][1], z]], [[R[0][0], R[0][1], z], [R[2][0], R[2][1], z], [R[3][0], R[3][1], z]]], tip: fmt(w) + " × " + fmt(d) });
        ctx.vcbValue((+w.toFixed(3)) + "," + (+d.toFixed(3))); return;
      }
      if (tool === "wall") {
        const from = st.pts && st.pts[st.pts.length - 1], { p, s } = snapPlan(ev, O.wall.z, from);
        if (!from) { show(s, { tip: "the wall's start" }); return; }
        st.cur = p; const pts = st.pts.concat([p]), lines = [];
        for (let i = 0; i + 1 < pts.length; i++) { const a = pts[i], b = pts[i + 1]; lines.push([a, b], [[a[0], a[1], a[2] + O.wall.h], [b[0], b[1], b[2] + O.wall.h]]); }
        const closes = st.pts.length >= 3 && Math.hypot(p[0] - st.pts[0][0], p[1] - st.pts[0][1]) < 1e-6;
        show(s, { from, lines, tip: fmt(Math.hypot(p[0] - from[0], p[1] - from[1])) + (closes ? " · closes it: a room" : "") }); ctx.vcbValue(fmt(Math.hypot(p[0] - from[0], p[1] - from[1]))); return;
      }
      if (tool === "door" || tool === "window") {
        const w = wallFor(ev); st.w = w;
        if (!w) { V.preview({}); AV().setHover(null); return; }
        const o = tool === "door" ? O.door : O.window, I = P().opInfo(A, { room: w.room, edge: w.edge, at: w.at, w: o.w, h: o.h, sill: tool === "door" ? 0 : o.sill });
        if (!I) { V.preview({}); return; }
        const lines = []; [I.z0, I.z1].forEach((z) => loop3(I.rect, z).forEach((x) => lines.push(x))); I.rect.forEach((q) => lines.push([[q[0], q[1], I.z0], [q[0], q[1], I.z1]]));
        V.preview({ lines, tip: (tool === "door" ? "🚪 " : "🪟 ") + fmt(o.w) + " × " + fmt(o.h) + " · " + w.R.name + " · " + fmt(Math.max(0, I.x0)) + " from the corner" + (w.mid ? " · the middle" : ""), tipAt: [I.c[0], I.c[1], I.z1], color: 0x2563eb });
        return;
      }
      if (tool === "ceiling" || tool === "roof") { const R = roomUnder(ev); AV().setHover(R ? { ak: "room", id: R.id } : null); return; }
      if (tool === "light") {
        const L = lightFor(ev); st.lp = L;
        if (!L) { V.preview({}); return; }
        const fl = L.floorZ != null ? L.floorZ : 0;
        V.preview({ marker: { p: L.p, color: "#f59e2c" }, dashed: [{ seg: [[L.p[0], L.p[1], fl], L.p], color: "#f59e2c" }], tip: "💡 " + P().LIGHTS[O.light.type].label + (L.label ? " · " + L.label : ""), tipAt: L.p });
        return;
      }
      if (tool === "stairs") {
        const { p, s } = snapPlan(ev, 0, st.a);
        if (!st.a) { show(s, { tip: "the foot of the stairs" }); return; }
        st.cur = p; const tmp = stairOf(st.a, p); if (!tmp) { show(s); return; }
        const B = P().build({ n: 1, ext: "#ffffff", rooms: [], ops: [], roofs: [], slabs: [], stairs: [tmp], lights: [] });
        show(s, { from: st.a, lines: B.lines, tip: fmt(tmp.len) + " · " + Math.max(2, Math.round(tmp.rise / 0.18)) + " steps" }); ctx.vcbValue(fmt(tmp.len)); return;
      }
    }
    function up() { /* the tools are click-click */ }
    function dbl() { if (tool === "wall" && st.pts && st.pts.length >= 2) finishWall(false); }
    function wallFor(ev) {
      const H = hitAt(ev); if (!H) return null;
      const w = P().nearestWall(AR(), H.xy, 0.35, H.z); if (!w) return null;
      if (Math.abs(w.at - w.e.L / 2) < Math.max(0.08, pxTol([H.xy[0], H.xy[1], H.z]) * 0.6)) { w.at = w.e.L / 2; w.mid = true; }   // the middle of the wall snaps
      return w;
    }
    function lightFor(ev) {
      const H = hitAt(ev); if (!H) return null;
      const A = AR(), type = O.light.type, d = P().LIGHTS[type];
      if (d.mount === "wall") {
        const w = P().nearestWall(A, H.xy, 0.5, H.z); if (!w) { ctx.status("a wall light goes on a wall - point at one"); return null; }
        const R = w.R, nl = [-w.e.u[1], w.e.u[0]], side = w.side, off = R.t / 2 + 0.012;
        const x = w.e.a[0] + w.e.u[0] * w.at + nl[0] * side * off, y = w.e.a[1] + w.e.u[1] * w.at + nl[1] * side * off;
        const inRoom = R.closed && side > 0 ? R.id : P().roomAt(A, [x + nl[0] * side * 0.1, y + nl[1] * side * 0.1], R.z + 0.1);
        return { p: [x, y, R.z + (d.hz || 1.8)], room: typeof inRoom === "number" ? inRoom : inRoom ? inRoom.id : null, dir: Math.atan2(nl[1] * side, nl[0] * side) * 180 / Math.PI, floorZ: R.z, label: R.name + "'s wall" };
      }
      let xy = H.xy.slice(), label = "";
      const sp = P().lightSpot(A, type, xy, H.t && H.t.part === "ceil" ? null : H.z);
      const R = sp.room ? P().room(A, sp.room) : null;
      if (R) {
        const c = P().centroid(P().interior(R)), tol = pxTol([c[0], c[1], R.z]);
        if (Math.hypot(xy[0] - c[0], xy[1] - c[1]) < tol) { xy = c; label = "the middle of " + R.name; } else label = R.name;
      }
      const z = d.mount === "floor" ? (R ? R.z : H.z) : sp.z;
      return { p: [xy[0], xy[1], z], room: sp.room, floorZ: R ? R.z : 0, label };
    }
    function finishRoom(a, b) {
      const w = Math.abs(b[0] - a[0]), d = Math.abs(b[1] - a[1]);
      if (w < 0.3 || d < 0.3) { ctx.status("a room 30 cm across at least"); return; }
      const of = P().offsetOnFloor(AR(), P().rectPts(a, b), true, O.room.t, O.room.off);       // 2.624.0: off a floor's edge
      const bf = before(), R = P().addRoom(AR(), of.pts, { z: O.room.z, h: O.room.h, t: O.room.t, ceilOn: O.room.ceilOn, slab: !!O.room.autoFloor });
      st = {}; V.preview({});
      if (!R) { ctx.status("that room is too small"); return; }
      if (O.room.autoRoof) P().addRoof(AR(), [R.id], { type: O.roof.type, pitch: O.roof.pitch, over: O.roof.over });   // 2.631.0: the auto roof
      done("room", bf, { ak: "room", id: R.id });
      const shared = sharedWith(R);
      ctx.status("⌂ " + R.name + " " + fmt(w) + " × " + fmt(d) + (shared.length ? " - sharing a wall with " + shared.join(", ") : "") + (of.moved ? " · " + of.moved + " wall(s) " + fmt(O.room.off) + " in from the floor's edge" : "") + " · drag it (Select), doors D, windows I");
    }
    function sharedWith(R) {
      const A = AR(), out = [];
      A.rooms.forEach((Q) => { if (Q === R || Math.abs(Q.z - R.z) > 0.01) return; const s = P().snapMove(A, [R.id], [0, 0], 1e-4); if (s.hit && s.hit.room === Q.id) out.push(Q.name); });
      return out;
    }
    function finishSlab(a, b) {
      const w = Math.abs(b[0] - a[0]), d = Math.abs(b[1] - a[1]); if (w < 0.1 || d < 0.1) return;
      const bf = before(), A = AR(), s = { id: A.n++, pts: P().rectPts(a, b), z: O.floor.z, th: O.floor.th, col: P().DEF.slab }; A.slabs.push(s);
      st = {}; V.preview({}); done("floor", bf, { ak: "slab", id: s.id }); ctx.status("▦ a floor " + fmt(w) + " × " + fmt(d) + " at " + fmt(O.floor.z));
    }
    function finishWall(closed) {
      const pts = (st.pts || []).map((p) => [p[0], p[1]]); st = {}; V.preview({});
      if (pts.length < (closed ? 3 : 2)) return;
      const of = P().offsetOnFloor(AR(), pts, closed, O.wall.t, O.wall.off);                     // 2.624.0: off a floor's edge
      const bf = before(), R = P().addRoom(AR(), of.pts, { closed, z: O.wall.z, h: O.wall.h, t: O.wall.t });
      if (!R) { ctx.status("that wall is too small"); return; }
      done(closed ? "room" : "wall", bf, { ak: "room", id: R.id }); ctx.status((closed ? "⌂ the walls closed round " + R.name : "▮ " + R.name + " - doors and windows go in it too") + (of.moved ? " · " + of.moved + " run(s) " + fmt(O.wall.off) + " in from the floor's edge" : ""));
    }
    function stairOf(a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); if (L < 0.3) return null; return { id: 0, x: a[0], y: a[1], ang: Math.atan2(dy, dx) * 180 / Math.PI, w: O.stairs.w, len: L, rise: O.stairs.rise, z: 0, col: P().DEF.stair }; }
    function finishStairs(a, b) {
      const s = stairOf(a, b); if (!s) return;
      const bf = before(), A = AR(); s.id = A.n++; A.stairs.push(s); st = {}; V.preview({});
      done("stairs", bf, { ak: "stair", id: s.id }); ctx.status("▟ stairs " + fmt(s.len) + " long, " + fmt(s.rise) + " up");
    }
    function vcb(text) {
      const g = G().parseVcb(text), A = AR();
      if (tool === "camera") { const deg = parseFloat(String(text).replace(/[^\d.]/g, "")); if (!(deg >= 3 && deg <= 140)) return false; O.camera.fov = deg; keepOpt(); props(); ctx.status("📷 lens " + deg + "°"); return true; }
      if (tool === "furniture") { const deg = parseFloat(String(text).replace(/[^\d.-]/g, "")); if (!Number.isFinite(deg)) return false; O.furniture.rot = ((Math.round(deg) % 360) + 360) % 360; keepOpt(); props(); ctx.status("🛋 turned " + O.furniture.rot + "°"); return true; }
      if (tool === "roof") {
        const deg = parseFloat(String(text).replace(/[^\d.]/g, "")); if (!Number.isFinite(deg)) return false;
        O.roof.pitch = Math.max(0, Math.min(75, deg)); keepOpt();
        const rf = st.roof && A.roofs.find((x) => x.id === st.roof); if (rf) { const b = before(); rf.pitch = O.roof.pitch; done("roof", b); }
        ctx.status("△ pitch " + O.roof.pitch + "°"); props(); return true;
      }
      if (tool === "light") { const lm = parseFloat(text); if (!(lm >= 0)) return false; O.light.lm = lm; keepOpt(); props(); ctx.status("💡 " + lm + " lm"); return true; }
      if (!g) return false;
      const L = g.vals[0], L2 = g.vals[1];
      if ((tool === "room" || tool === "floor") && st.a) {
        const c = st.cur || [st.a[0] + 1, st.a[1] + 1], sx = c[0] >= st.a[0] ? 1 : -1, sy = c[1] >= st.a[1] ? 1 : -1;
        const b = [st.a[0] + sx * L, st.a[1] + sy * (L2 != null ? L2 : L), st.a[2]];
        if (tool === "room") finishRoom(st.a, b); else finishSlab(st.a, b); return true;
      }
      if (tool === "wall" && st.pts) { const from = st.pts[st.pts.length - 1], c = st.cur || [from[0] + 1, from[1], from[2]], d = Math.hypot(c[0] - from[0], c[1] - from[1]) || 1; st.pts.push([from[0] + (c[0] - from[0]) / d * L, from[1] + (c[1] - from[1]) / d * L, from[2]]); return true; }
      if (tool === "stairs" && st.a) { const c = st.cur || [st.a[0] + 1, st.a[1], 0], d = Math.hypot(c[0] - st.a[0], c[1] - st.a[1]) || 1; finishStairs(st.a, [st.a[0] + (c[0] - st.a[0]) / d * L, st.a[1] + (c[1] - st.a[1]) / d * L, 0]); return true; }
      if (tool === "door" || tool === "window") {
        const o = O[tool]; o.w = L; if (L2 != null) o.h = L2; keepOpt();
        const op = st.last && A.ops.find((x) => x.id === st.last); if (op) { const b = before(); op.w = o.w; op.h = o.h; done("size", b); }
        props(); ctx.status((tool === "door" ? "🚪 " : "🪟 ") + fmt(o.w) + " × " + fmt(o.h)); return true;
      }
      return false;
    }
    function key(e, baseTool) {
      const k = e.key;
      if (owns(baseTool) && k === "Escape") {
        if (baseTool === "wall" && st.pts && st.pts.length >= 2) { finishWall(false); return true; }
        if (Object.keys(st).length) { st = {}; V.preview({}); ctx.status(HINT[baseTool]); return true; }
        if (asel) { setSel(null); ctx.status("nothing picked - Esc again: ⬚ Select"); return true; }   // 2.632.0: Esc deselects with a Build tool too
        return false;
      }
      if (asel && (k === "Delete" || k === "Backspace") && (baseTool === "select" || owns(baseTool))) { eraseSel(); return true; }
      if ((k === "r" || k === "R") && !e.ctrlKey && !e.metaKey && !e.altKey) {                      // 2.628.0: R turns the next piece / the picked one 90°
        if (baseTool === "furniture") { O.furniture.rot = (O.furniture.rot + 90) % 360; keepOpt(); props(); ctx.status("🛋 " + O.furniture.rot + "°"); return true; }
        if (asel && asel.ak === "item" && baseTool === "select") { const b = before(), it = P().find(AR(), "item", asel.id); if (it) { it.rot = (((it.rot + (e.shiftKey ? -90 : 90)) % 360) + 360) % 360; done("turn", b); } return true; }
        // 2.632.0: R / Shift+R turn a picked camera 15° (clockwise / back)
        if (asel && asel.ak === "cam" && (baseTool === "select" || baseTool === "camera")) { const b = before(), c = P().find(AR(), "cam", asel.id); if (c) { c.yaw = (((c.yaw + (e.shiftKey ? -15 : 15)) % 360) + 360) % 360; done("turn", b); ctx.status("📷 " + c.name + " turned to " + c.yaw + "° · R / Shift+R"); } return true; }
      }
      if (asel && k === "Escape" && !owns(baseTool)) { setSel(null); return true; }
      return false;
    }

    /* ---- Select: pick + drag */
    function nearerThanModel(ev, h) {
      const mp = V.pick(ev, { group: ctx.group() }); if (!mp) return true;
      const r = V.ray(ev), d = Math.hypot(mp.point[0] - r.o[0], mp.point[1] - r.o[1], mp.point[2] - r.o[2]);
      return h.dist <= d + 1e-3;
    }
    /** 2.624.0: the top of a wall under the pointer -> topHit (a cut / an end within reach, else the top edge there) */
    function topUnder(h) {
      if (!h || (h.tag.ak !== "wall")) return null;
      const tol = Math.max(0.06, pxTol(h.point) * 0.7);
      return P().topHit(AR(), [h.point[0] - h.n[0] * 0.02, h.point[1] - h.n[1] * 0.02], h.point[2], tol);
    }
    function selectDown(ev) {
      const rg = ringAt(ev);                                             // 2.633.0: a rotate ring - yaw / pitch / roll by dragging round it
      if (rg) {
        const r = V.canvas.getBoundingClientRect(), cs = V.screen(rg.c), cp = V.cam().position;
        const toV = [cp.x - rg.c[0], cp.y - rg.c[1], cp.z - rg.c[2]], facing = rg.axis[0] * toV[0] + rg.axis[1] * toV[1] + rg.axis[2] * toV[2] >= 0 ? 1 : -1;
        st.drag = { t: asel, mode: "spin", key: rg.key, cx: r.left + cs[0], cy: r.top + cs[1], a0: Math.atan2(ev.clientY - r.top - cs[1], ev.clientX - r.left - cs[0]), facing, x0: ev.clientX, y0: ev.clientY, before: before(), base: JSON.stringify(AR()), moved: false };
        const pa = ringAngle(ev, rg.c, rg.axis); if (pa !== null) Object.assign(st.drag, { pc: rg.c, pn: rg.axis, pa0: pa });   // the ring seen open enough: follow it in its own plane
        return true;
      }
      const gp = gripAt(ev);
      if (gp) { st.drag = { t: asel, mode: "grip", key: gp.key, p: gp.p, n: gp.n, x0: ev.clientX, y0: ev.clientY, before: before(), base: JSON.stringify(AR()), moved: false }; return true; }
      const h = AV() && AV().pick(ev);
      if (!h || (h.tag.ak !== "cam" && !nearerThanModel(ev, h))) { if (asel) setSel(null); return false; }   // 2.632.0: a camera is always on top
      // a view straight down (Top) sees only the walls' tops - there a press moves the wall; the slopes are edited from the side
      const th = Math.abs(V.ray(ev).d[2]) > 0.85 ? null : topUnder(h);
      if (th) {                                                        // 2.624.0: a cut / a top edge: dragged up / down
        const sel = th.k >= 0 ? { ak: "wpt", room: th.room, edge: th.edge, k: th.k } : { ak: "wtop", room: th.room, edge: th.edge, k: th.seg };
        ctx.setSel({ f: [], e: [], k: [] }); setSel(sel);
        st.drag = { t: sel, mode: "top", p0: h.point, z0: h.point[2], x0: ev.clientX, y0: ev.clientY, before: before(), base: JSON.stringify(AR()), moved: false };
        return true;
      }
      const t = AV().resolve(h); if (!t) return false;
      ctx.setSel({ f: [], e: [], k: [] }); setSel(t);
      const A = AR(), x = P().find(A, t.ak, t.id);
      if (t.ak === "room" && t.part === "wall" && t.edge != null && x && x.closed) {      // 2.624.0: one wall of the room
        const start = planeAt(ev, x.z);
        if (start) st.drag = { t, mode: "edge", z: x.z, start, x0: ev.clientX, y0: ev.clientY, before: before(), base: JSON.stringify(A), moved: false };
        return true;
      }
      const z = t.ak === "room" ? x.z : t.ak === "light" || t.ak === "item" || t.ak === "cam" ? x.z : t.ak === "stair" ? x.z : t.ak === "slab" ? x.z : h.point[2];
      const start = planeAt(ev, z);
      if (t.ak !== "roof" && start) st.drag = { t, z, start, x0: ev.clientX, y0: ev.clientY, before: before(), base: JSON.stringify(A), moved: false };
      if (t.ak === "op" && st.drag) { const I = P().opInfo(A, x); if (I) Object.assign(st.drag, { wp: h.point, wn: I.nl, along0: (h.point[0] - I.o[0]) * I.u[0] + (h.point[1] - I.o[1]) * I.u[1], at0: I.at, sill0: x.sill, room0: x.room, edge0: x.edge }); }   // 2.625.0: up / down too
      return true;
    }
    function selectMove(ev) {
      const D = st.drag;
      if (!D) {
        const h = AV() && AV().pick(ev), near = h && nearerThanModel(ev, h), th = near ? topUnder(h) : null;
        AV() && AV().setHover(th ? (th.k >= 0 ? { ak: "wpt", room: th.room, edge: th.edge, k: th.k } : { ak: "wtop", room: th.room, edge: th.edge, k: th.seg }) : near ? AV().resolve(h) : null);   // 2.624.0: a wall's top shows what a press takes
        return false;
      }
      if (!(ev.buttons & 1)) { st.drag = null; V.preview({}); return false; }
      if (!D.moved && Math.hypot(ev.clientX - D.x0, ev.clientY - D.y0) < 4) return true;
      D.moved = true;
      if (D.mode === "top") return dragTop(ev, D);
      if (D.mode === "grip") return dragGrip(ev, D);
      if (D.mode === "spin") return dragSpin(ev, D);
      const cur = planeAt(ev, D.z); if (!cur && !D.wp) return true;     // 2.625.0: a door / window drags on its wall's face
      if (D.mode === "edge") return dragEdge(ev, D, cur);
      let d = cur ? [cur[0] - D.start[0], cur[1] - D.start[1]] : [0, 0];
      if (ev.shiftKey) { if (Math.abs(d[0]) > Math.abs(d[1])) d[1] = 0; else d[0] = 0; }
      const M = ctx.model(); M.arch = P().clean(JSON.parse(D.base)); const A = M.arch, t = D.t, x = P().find(A, t.ak, t.id); if (!x) return true;
      if (t.ak === "room") {
        const tol = pxTol(cur), off = (x.closed ? O.room.off : O.wall.off) || 0;
        let s = P().snapMove(A, [t.id], d, tol), fl = null;
        if (!s.hit) { fl = P().snapToFloor(A, [t.id], d, tol, off); if (fl.hit) s = { d: fl.d, hit: null }; }    // 2.624.0: onto a floor's edge
        P().moveRooms(A, [t.id], s.d);
        regions(A, x.z, tol, off, fl && fl.hit);
        const Q = s.hit && P().room(A, s.hit.room);
        ctx.status(Q ? "⌂ " + x.name + " shares a wall with " + Q.name + (s.hit.kind === "corner" ? " · corners in line" : "") : fl && fl.hit ? "⌂ " + x.name + " - its wall " + fmt(off) + " in from the floor's edge" : "⌂ " + x.name + " moved " + fmt(Math.hypot(s.d[0], s.d[1])));
      } else if (t.ak === "op") {
        const w = cur ? P().nearestWall(A, [cur[0], cur[1]], 1.0, null) : null, q = D.wp && Math.abs(V.ray(ev).d[2]) < 0.85 ? wallAt(ev, D.wp, D.wn) : null;
        const I0 = q ? P().opInfo(A, x) : null, al0 = I0 ? (q[0] - I0.o[0]) * I0.u[0] + (q[1] - I0.o[1]) * I0.u[1] : null;
        if (I0 && al0 > -0.3 && al0 < I0.e.L + 0.3) {                                           // 2.625.0: on its own wall - along it and (a window) up / down
          const I = I0, along = al0;
          x.at = D.at0 + along - D.along0;
          if (x.kind !== "door") { const R = P().room(A, x.room); x.sill = Math.round(Math.max(0, Math.min(R.h - x.h, D.sill0 + q[2] - D.wp[2])) * 1000) / 1000; }
          const I2 = P().opInfo(A, x);
          ctx.status((x.kind === "window" ? "🪟 " : x.kind === "door" ? "🚪 " : "▯ ") + I2.R.name + " · " + fmt(Math.max(0, I2.x0)) + " from the corner" + (x.kind !== "door" ? " · " + fmt(x.sill) + " up" : ""));
        } else if (w) { x.room = w.room; x.edge = w.edge; x.at = w.at; ctx.status((x.kind === "window" ? "🪟 " : "🚪 ") + w.R.name + " · " + fmt(Math.max(0, w.at - x.w / 2)) + " from the corner"); }
      } else if (t.ak === "light") {
        x.x += d[0]; x.y += d[1];
        const def = P().LIGHTS[x.type];
        if (def.mount === "ceil") { const sp = P().lightSpot(A, x.type, [x.x, x.y], null); x.z = sp.z; x.room = sp.room; }
        else if (def.mount === "floor") { const R = P().roomAt(A, [x.x, x.y], x.z); x.room = R ? R.id : null; }
        ctx.status("💡 moved " + fmt(Math.hypot(d[0], d[1])));
      } else if (t.ak === "stair") { x.x += d[0]; x.y += d[1]; }
      else if (t.ak === "cam") { x.x = Math.round((x.x + d[0]) * 1000) / 1000; x.y = Math.round((x.y + d[1]) * 1000) / 1000; ctx.status("📷 " + x.name + " moved"); }
      else if (t.ak === "item") { x.x = Math.round((x.x + d[0]) * 1000) / 1000; x.y = Math.round((x.y + d[1]) * 1000) / 1000; x.z = floorAt(A, [x.x, x.y]); ctx.status("🛋 " + root.PPFurn.label(x) + " moved " + fmt(Math.hypot(d[0], d[1]))); }
      else if (t.ak === "slab") { x.pts = x.pts.map((p) => [p[0] + d[0], p[1] + d[1]]); }
      AV().rebuild();
      return true;
    }
    /** the angle (radians, right-handed about n) of where the pointer's ray meets the plane through c across n - null when that
        plane is seen nearly edge-on */
    function ringAngle(ev, c, n) {
      const r = V.ray(ev), den = r.d[0] * n[0] + r.d[1] * n[1] + r.d[2] * n[2]; if (Math.abs(den) < 0.2) return null;
      const t = ((c[0] - r.o[0]) * n[0] + (c[1] - r.o[1]) * n[1] + (c[2] - r.o[2]) * n[2]) / den; if (!(t > 0)) return null;
      const q = [0, 1, 2].map((k) => r.o[k] + r.d[k] * t - c[k]), cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const t0 = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]; let u = cr(n, t0); const l = Math.hypot(u[0], u[1], u[2]) || 1; u = u.map((x) => x / l); const v = cr(n, u);
      return Math.atan2(q[0] * v[0] + q[1] * v[1] + q[2] * v[2], q[0] * u[0] + q[1] * u[1] + q[2] * u[2]);
    }
    function dragSpin(ev, D) {
      let rh;
      const pa = D.pn ? ringAngle(ev, D.pc, D.pn) : null;
      if (pa !== null) { rh = (pa - D.pa0) * 180 / Math.PI; rh = ((rh + 540) % 360) - 180; }                   // 2.633.0: true to the ring (a ring seen at a slant is an ellipse on screen)
      else { const a = Math.atan2(ev.clientY - D.cy, ev.clientX - D.cx); let deg = (a - D.a0) * 180 / Math.PI; deg = ((deg + 540) % 360) - 180; rh = -deg * D.facing; }  // screen-clockwise = a left-handed turn when the axis faces us
      if (!ev.shiftKey) rh = Math.round(rh / 5) * 5;                                                            // 5° steps (Shift: free)
      const M = ctx.model(); M.arch = P().clean(JSON.parse(D.base)); const o = P().find(M.arch, D.t.ak, D.t.id); if (!o) return true;
      root.PPCam.turnBy(o, D.key, rh, D.t.ak);
      ctx.status((D.t.ak === "cam" ? "📷 " + o.name : "🛋 " + root.PPFurn.label(o)) + " · " + { yaw: "turn", pitch: "pitch", roll: "roll" }[D.key] + " " + (D.key === "yaw" ? (D.t.ak === "cam" ? o.yaw : o.rot) : o[D.key]) + "° (5° steps - Shift: free)");
      AV().rebuild(); AV().setSel(D.t);
      if (through && D.t.ak === "cam" && through.id === o.id) lookThrough(o);
      return true;
    }
    function dragGrip(ev, D) {
      const q = wallAt(ev, D.p, D.n); if (!q) return true;
      const M = ctx.model(); M.arch = P().clean(JSON.parse(D.base)); const A = M.arch, op = A.ops.find((o) => o.id === D.t.id); if (!op) return true;
      const I = P().opInfo(A, op), along = (q[0] - I.o[0]) * I.u[0] + (q[1] - I.o[1]) * I.u[1];
      P().resizeOp(A, op, D.key, along, q[2]);
      ctx.status((op.kind === "door" ? "🚪 " : op.kind === "window" ? "🪟 " : "▯ ") + fmt(op.w) + " × " + fmt(op.h) + (op.kind !== "door" ? " · " + fmt(op.sill) + " up" : ""));
      AV().rebuild();
      return true;
    }
    function selectUp() {
      const D = st.drag; if (!D) return false;
      st.drag = null; V.preview({});
      if (D.moved) { ctx.commit(D.mode === "top" ? "wall top" : D.mode === "grip" ? "resize" : D.mode === "spin" ? "turn" : "move", D.before); props(); }
      return true;
    }
    /** 2.624.0: the floors' snap regions on the floor - the band where a wall's outside face is caught, the line it goes to
        (`off` in from the edge); the edge snapped to drawn in the accent colour */
    function regions(A, z, tol, off, hit) {
      const faces = [], dashed = [], lines = [], zz = z + 0.004;
      P().slabEdges(A).forEach((e) => {
        const L = (k) => [e.a[0] + e.n[0] * k, e.a[1] + e.n[1] * k], Lb = (k) => [e.b[0] + e.n[0] * k, e.b[1] + e.n[1] * k];
        const a0 = L(off - tol), a1 = L(off + tol), b0 = Lb(off - tol), b1 = Lb(off + tol), P3 = (q) => [q[0], q[1], zz];
        faces.push([P3(a0), P3(b0), P3(b1)], [P3(a0), P3(b1), P3(a1)]);
        const on = hit && Math.abs(hit.a[0] - e.a[0]) < 1e-9 && Math.abs(hit.a[1] - e.a[1]) < 1e-9 && Math.abs(hit.b[0] - e.b[0]) < 1e-9 && Math.abs(hit.b[1] - e.b[1]) < 1e-9;
        (on ? lines : dashed).push(on ? [P3(L(off)), P3(Lb(off))] : { seg: [P3(L(off)), P3(Lb(off))], color: "#f59e2c" });
      });
      V.preview({ faces, faceColor: 0xf59e2c, dashed, lines, color: 0xf59e2c });
    }
    /** 2.624.0: one wall of a room dragged out / in - onto another room's wall or a floor's edge */
    function dragEdge(ev, D, cur) {
      const M = ctx.model(); M.arch = P().clean(JSON.parse(D.base)); const A = M.arch, R = P().room(A, D.t.id); if (!R) return true;
      const e = P().edgesOf(R)[D.t.edge]; if (!e) return true;
      const out = [e.u[1], -e.u[0]], tol = ev.shiftKey ? 0 : pxTol(cur), off = O.room.off || 0;
      const sn = P().snapEdge(A, R.id, D.t.edge, (cur[0] - D.start[0]) * out[0] + (cur[1] - D.start[1]) * out[1], tol, off);
      P().moveEdge(A, R.id, D.t.edge, sn.dist);
      AV().rebuild(); AV().setSel(D.t);
      regions(A, R.z, tol, off, sn.hit && sn.hit.kind === "floor" ? sn.hit : null);
      ctx.status("▮ " + R.name + "'s wall " + (sn.dist >= 0 ? "out " : "in ") + fmt(Math.abs(sn.dist)) + (sn.hit ? sn.hit.kind === "floor" ? " · on the floor's edge" + (off ? " (" + fmt(off) + " in)" : "") : " · on " + (P().room(A, sn.hit.room) || {}).name + "'s wall" : "") + " · Shift = no snap");
      return true;
    }
    /** 2.624.0: a cut / a top edge of a wall dragged up / down (its height on the vertical line through where it was pressed) */
    function dragTop(ev, D) {
      const r = V.ray(ev), c = G().linesClosest(D.p0, [0, 0, 1], r.o, r.d);
      let dz = c.point[2] - D.z0;
      const M = ctx.model(); M.arch = P().clean(JSON.parse(D.base)); const A = M.arch, t = D.t, R = P().room(A, t.room); if (!R) return true;
      const prof = P().profile(R, t.edge);
      if (t.ak === "wpt") {
        let h = prof[t.k][1] + dz; if (Math.abs(h - R.h) < 0.04) h = R.h; h = Math.round(h * 1000) / 1000;      // the room's height catches it
        P().moveTopPoint(A, t.room, t.edge, t.k, h); ctx.status("▮ the wall's top here: " + fmt(h) + " · Delete = the cut goes");
      } else {
        const lo = Math.min(prof[t.k][1], prof[t.k + 1][1]); if (Math.abs(lo + dz - R.h) < 0.04) dz = R.h - lo;
        P().moveTopSeg(A, t.room, t.edge, t.k, Math.round(dz * 1000) / 1000, prof); ctx.status("▮ the wall's top edge " + (dz >= 0 ? "up " : "down ") + fmt(Math.abs(dz)) + " · Delete = its cuts go");
      }
      AV().rebuild(); AV().setSel(t);
      return true;
    }
    /** 2.624.0: double-click the top of a wall = a cut there (Select) */
    function selectDbl(ev) {
      const h = AV() && AV().pick(ev); if (!h || !nearerThanModel(ev, h) || h.tag.ak !== "wall") return false;
      const tol = Math.max(0.12, pxTol(h.point) * 1.2);
      const th = P().topHit(AR(), [h.point[0] - h.n[0] * 0.02, h.point[1] - h.n[1] * 0.02], h.point[2], tol); if (!th) return false;
      const b = before(), k = P().cutTop(AR(), th.room, th.edge, th.t); if (k < 0) return false;
      done("cut", b, { ak: "wpt", room: th.room, edge: th.edge, k });
      ctx.status("✂ a cut in " + th.R.name + "'s wall - drag it up / down (a slope), Delete takes it away");
      return true;
    }
    function eraseAt(ev) {
      const h = AV() && AV().pick(ev); if (!h || !nearerThanModel(ev, h)) return false;
      const t = AV().resolve(h); if (!t) return false;
      const b = before(); if (P().remove(AR(), t.ak, t.id)) { if (asel && asel.ak === t.ak && asel.id === t.id) asel = null; done("erase", b); ctx.status("⌫ erased the " + nameOf(t)); }
      return true;
    }
    function paintAt(ev, col, pickOnly) {
      const h = AV() && AV().pick(ev); if (!h || !nearerThanModel(ev, h)) return null;
      const A = AR(), tg = h.tag;
      let get, set;
      if (tg.ak === "wall") { const R = tg.room ? P().room(A, tg.room) : null; get = () => (R ? R.wall : A.ext); set = (c) => { if (R) R.wall = c; else A.ext = c; }; }
      else if (tg.ak === "room") { const R = P().room(A, tg.id); if (!R) return null; const k = tg.part === "ceil" ? "ceilCol" : "floor"; get = () => R[k]; set = (c) => { R[k] = c; }; }
      else { const x = P().find(A, tg.ak, tg.id); if (!x) return null; get = () => x.col; set = (c) => { x.col = c; }; }
      if (pickOnly) return get();
      const b = before(); set(col); done("paint", b);
      ctx.status("🪣 " + (tg.ak === "wall" ? (tg.room ? P().room(A, tg.room).name + "'s walls" : "the outside walls") : tg.ak === "room" ? (tg.part === "ceil" ? "the ceiling" : "the floor") : "the " + nameOf({ ak: tg.ak })) + " painted");
      return col;
    }
    function eraseSel() {
      if (!asel) return;
      const b = before(), t = asel;
      if (t.ak === "wpt" || t.ak === "wtop") {                          // 2.624.0: Delete on a cut / a top edge
        const ok = t.ak === "wpt" ? P().removeTopPoint(AR(), t.room, t.edge, t.k) : P().removeTopSeg(AR(), t.room, t.edge, t.k);
        if (ok) { asel = null; done("erase", b, null); ctx.status(t.ak === "wpt" ? "⌫ the cut is gone" : "⌫ that top edge is straight again"); }
        return;
      }
      if (P().remove(AR(), t.ak, t.id)) { asel = null; done("erase", b, null); ctx.status("⌫ erased the " + nameOf(t)); }
    }
    /* 2.629.0: 📷 a camera's view / pictures / 360° location */
    /** 👁 the view from a camera - its place, its way, its lens (2.631.0: and nothing of the camera itself in the way); the first
        orbit / pan / zoom leaves it (the lens as it was, the cameras shown again) */
    function lookThrough(c) {
      if (!c) return;
      const d = root.PPCam.dir(c); if (V.isOrtho) V.ortho(false);
      const cam = V.cam();
      if (!through) through = { fov: cam.fov };
      through.id = c.id;
      cam.fov = c.fov || 60; cam.updateProjectionMatrix();
      cam.position.set(c.x, c.y, c.z); V.controls.target.set(c.x + d[0] * 2, c.y + d[1] * 2, c.z + d[2] * 2); V.controls.update();
      if (c.roll) cam.rotateZ(-(c.roll * Math.PI / 180));               // 2.633.0: its roll (right-handed about the way it looks)
      if (AV() && AV().camsShown) AV().camsShown(false);
      V.draw();
      ctx.status("👁 the view from " + c.name + " - orbit / pan / zoom to leave it");
      if (ctx.onThrough) ctx.onThrough(c.id);
    }
    function leaveThrough() {
      if (!through) return;
      const cam = V.cam(); cam.fov = through.fov; cam.updateProjectionMatrix(); through = null;
      if (AV() && AV().camsShown) AV().camsShown(true);
      V.draw(); if (ctx.onThrough) ctx.onThrough(null);
    }
    V.controls.addEventListener("start", () => { if (through) leaveThrough(); });   // the user's orbit / pan / zoom
    const modelName = () => (root.H3PushPull && root.H3PushPull.nameNow ? root.H3PushPull.nameNow() : "model");
    function camShots(c) {
      const [w, h] = String(O.camera.size || "1920x1080").split("x").map(Number);
      ctx.status("📷 rendering " + c.name + " …");
      return root.PPCam.shots(V, c, modelName(), w, h).then((r) => { ctx.status("📷 " + r.shot + " + its depth and normal maps are in the Image assets"); last.shots = r; return r; })
        .catch((e) => { ctx.status("📷 " + (e.message || e)); return null; });
    }
    function camLocation(c) {
      ctx.status("📍 rendering the 360° panorama of " + c.name + " …");
      return root.PPCam.location(V, c, modelName()).then((r) => { ctx.status("📍 the Location " + r.name + " (@" + r.tag + ") is ready - its 360° view is the model as built"); last.location = r; return r; })
        .catch((e) => { ctx.status("📍 " + (e.message || e)); return null; });
    }
    const last = {};
    /** 2.629.0: 🪄 the room as the House builder's model (plan y down) -> /api/house/furnish -> its pieces back in the Sketcher */
    function furnishRoom(R, words) {
      const A = AR(), inn = P().interior(R).map((p) => [p[0], -p[1]]), E = P().edgesOf(R);
      const model = { name: "sketcher", floors: [{ id: "f0", name: "Ground", height: R.h }], rooms: [{ id: "r1", floor: 0, name: R.name, poly: inn }],
        walls: E.map((e, i) => ({ id: "w" + i, floor: 0, a: [e.a[0], -e.a[1]], b: [e.b[0], -e.b[1]], thick: R.t })), openings: [], items: [], stairs: [], cameras: [], lights: [] };
      ctx.status("🪄 furnishing " + R.name + " …");
      return root.fetch("/api/house/furnish", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ model, room: "r1", prompt: String(words || "").trim() }) })
        .then((r) => r.json()).then((j) => {
          if (j.error) { ctx.status("🪄 " + j.error); return j; }
          const b = before(), A2 = AR(); if (!A2.items) A2.items = [];
          (j.items || []).forEach((it) => { const n = root.PPFurn.make(it.type, [it.x, -it.y], R.z, it.rot || 0, it.color || ""); if (!n) return; if (it.w) n.w = it.w; if (it.d) n.d = it.d; if (it.h) n.h = it.h; n.id = A2.n++; A2.items.push(n); });
          done("furnish", b); last.furnish = j;
          ctx.status("🪄 " + (j.items || []).length + " pieces in " + R.name + " (" + (j.by === "llm" ? "the LLM picked them" : "a " + j.kind + "'s set") + ") · Ctrl+Z takes them out");
          return j;
        }).catch((e) => { ctx.status("🪄 " + (e.message || e)); return null; });
    }
    function nameOf(t) { const x = t.id != null ? P().find(AR(), t.ak, t.id) : null; return { room: x ? x.name : "room", op: x ? (x.kind === "opening" ? "opening" : x.kind) : "door / window", light: "light", roof: "roof", stair: "stairs", slab: "floor", cam: x ? x.name : "camera", item: x && root.PPFurn ? root.PPFurn.label(x).toLowerCase() : "piece" }[t.ak] || t.ak; }
    function setSel(t, quiet) {
      asel = t && t.ak ? Object.assign({ ak: t.ak, id: t.id }, t.edge != null ? { edge: t.edge } : {}, t.room != null ? { room: t.room } : {}, t.k != null ? { k: t.k } : {}, t.part ? { part: t.part } : {}) : null;
      if (AV()) AV().setSel(asel);
      if (!quiet) props();
      if (ctx.onSel) ctx.onSel();
    }

    /* ---- the panel: the tool's settings / what is picked */
    function props() {
      const box = root.document && root.document.getElementById("ppProps"); if (!box) return;
      box.innerHTML = "";
      const A = ctx.model() ? AR() : null;
      const x = asel && A ? (asel.ak === "wpt" || asel.ak === "wtop" ? P().room(A, asel.room) : P().find(A, asel.ak, asel.id)) : null;
      if (asel && !x) asel = null;
      const ED = ctx.edit ? ctx.edit() : null, edit = !tool && !x && ED && ED.wants();     // 2.625.0: a face / edges / a corner of the model
      if (!tool && !x && !edit) { box.style.display = "none"; ctx.resized && ctx.resized(); return; }
      box.style.display = "block";
      const el = (tag, cls, txt) => { const e = root.document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
      // a narrow docker: the panel folds to a ⚙ tab over the view (it would cover it) - a click opens / closes it
      const tog = el("button", "ghost pptog", box.classList.contains("open") ? "✕" : "⚙ Settings"); tog.type = "button"; tog.title = "The settings (this docker is narrow - ⛶ maximize it for room)";
      tog.onclick = () => { box.classList.toggle("open"); props(); }; box.appendChild(tog);
      const head = (t) => box.appendChild(el("div", "pph", t));
      const row = (label, input, title) => { const r = el("label", "ppr"); r.appendChild(el("span", "", label)); r.appendChild(input); if (title) r.title = title; box.appendChild(r); return input; };
      const numIn = (label, val, on, step, min, max, unit) => { const i = el("input"); i.type = "number"; i.step = step || 0.01; if (min != null) i.min = min; if (max != null) i.max = max; i.value = +(+val).toFixed(3); i.onchange = () => { const v = parseFloat(i.value); if (Number.isFinite(v)) on(Math.min(max != null ? max : Infinity, Math.max(min != null ? min : -Infinity, v))); }; return row(label + (unit ? " (" + unit + ")" : ""), i); };
      const selIn = (label, val, opts, on) => { const s = el("select"); opts.forEach(([v, t]) => { const o = el("option", "", t); o.value = v; if (String(v) === String(val)) o.selected = true; s.appendChild(o); }); s.onchange = () => on(s.value); return row(label, s); };
      const colIn = (label, val, on) => { const i = el("input"); i.type = "color"; i.value = val; i.onchange = () => on(i.value); return row(label, i); };
      const chkIn = (label, val, on) => { const i = el("input"); i.type = "checkbox"; i.checked = !!val; i.onchange = () => on(i.checked); return row(label, i); };
      const txtIn = (label, val, on) => { const i = el("input"); i.type = "text"; i.value = val; i.onchange = () => on(i.value.trim().slice(0, 60) || val); return row(label, i); };
      const btns = (list) => { const r = el("div", "ppbtns"); list.forEach(([t, fn, tip]) => { const b = el("button", "ghost", t); b.type = "button"; if (tip) b.title = tip; b.onclick = fn; r.appendChild(b); }); box.appendChild(r); };
      const ch = (fn) => (v) => { const b = before(); fn(v); ctx.commit("edit", b); props(); };
      const kel = (val, on) => { const k = P().KELVIN.find((q) => q[1] === val); selIn("Colour", k ? k[1] : "custom", P().KELVIN.map((q) => [q[1], q[2]]).concat([["custom", "Another colour…"]]), (v) => { if (v !== "custom") on(v); else props(); }); colIn("", val, on); };
      const opt = (k) => (v) => { O[tool][k] = v; keepOpt(); props(); };
      if (edit) { ED.panel({ box, el, head, row, numIn, selIn, chkIn, btns, refresh: props }); ctx.resized && ctx.resized(); return; }
      if (tool && !(tool === "camera" && x && asel.ak === "cam")) {     // 2.629.0: a camera just placed shows ITS panel (its buttons)
        head({ room: "⌂ Room", wall: "▮ Wall", door: "🚪 Door", window: "🪟 Window", floor: "▦ Floor", ceiling: "⌓ Ceiling", roof: "△ Roof", light: "💡 Light", stairs: "▟ Stairs", furniture: "🛋 Furniture", camera: "📷 Camera" }[tool] + " - the next one");
        const o = O[tool];
        if (tool === "room" || tool === "wall") { numIn("Wall height", o.h, opt("h"), 0.05, 0.1, 50, "m"); numIn("Wall thickness", o.t, opt("t"), 0.01, 0.02, 2, "m"); numIn("Floor level", o.z, opt("z"), 0.05, -100, 1000, "m");
          numIn("Offset from floor edge", o.off || 0, opt("off"), 0.01, -5, 5, "m");      // 2.624.0
          if (tool === "room") { chkIn("Auto roof (the Roof tool's type)", !!o.autoRoof, opt("autoRoof")); chkIn("Auto floor (a slab under the walls)", !!o.autoFloor, opt("autoFloor")); }   // 2.631.0
          if (tool === "room") chkIn("Ceiling", o.ceilOn, opt("ceilOn"));
          box.appendChild(el("div", "pphint", "Drawn along a floor's (J) edge, the wall's outside face sits the offset in from it. Corners snap to floors' edges.")); }
        if (tool === "door") { selIn("Style", o.style, [["single", "Single"], ["double", "Double"], ["sliding", "Sliding glass"], ["glass", "Glass panel"], ["opening", "An opening (no door)"]], opt("style")); numIn("Width", o.w, opt("w"), 0.05, 0.3, 10, "m"); numIn("Height", o.h, opt("h"), 0.05, 0.5, 10, "m"); }
        if (tool === "window") { selIn("Style", o.style, [["single", "Single pane"], ["double", "Two panes"], ["slider", "Sliding"]], opt("style")); numIn("Width", o.w, opt("w"), 0.05, 0.2, 20, "m"); numIn("Height", o.h, opt("h"), 0.05, 0.2, 10, "m"); numIn("Elevation (height from floor)", o.sill, opt("sill"), 0.05, 0, 10, "m"); }
        if (tool === "floor") { numIn("Top at", o.z, opt("z"), 0.05, -100, 1000, "m"); numIn("Thickness", o.th, opt("th"), 0.01, 0.01, 5, "m"); }
        if (tool === "roof") { selIn("Type", o.type, ROOF_OPTS(), opt("type")); if (o.type !== "follow") numIn("Pitch", o.pitch, opt("pitch"), 1, 0, 75, "°"); numIn(o.type === "follow" ? "Eaves width" : "Overhang", o.over, opt("over"), 0.05, 0, 5, "m");
          btns([["△ Roof the whole storey", () => roofAll(), "One roof over every room on the ground floor (or the picked room's floor)"]]); }
        if (tool === "camera") {
          numIn("Eye height", o.eye, opt("eye"), 0.05, 0.1, 20, "m");
          const C0 = root.PPCam;                                         // 2.633.0: the lens presets, focal length, field of view
          if (C0) { selIn("Lens", C0.lensOf(C0.mmOf(o.fov)), C0.LENSES.map((l) => [l[0], l[1]]).concat([["custom", "Custom"]]), (v) => { const L = C0.LENSES.find((l) => l[0] === v); if (L) o.fov = C0.fovOf(L[2]); keepOpt(); props(); });
            numIn("Focal length", C0.mmOf(o.fov), (v) => { o.fov = C0.fovOf(v); keepOpt(); props(); }, 1, 4.4, 2000, "mm"); }
          numIn("Field of view", o.fov, opt("fov"), 1, 3, 140, "°");
        }
        if (tool === "furniture" && root.PPFurn) {                       // 2.628.0: the House builder's library + the project's 3D models
          const F = root.PPFurn, cats = F.categories().concat(["People", "3D models"]);       // 2.630.0: + 🧍 People
          if (!cats.includes(o.cat)) o.cat = cats[0];
          selIn("Category", o.cat, cats.map((c) => [c, c]), (v) => { o.cat = v; const first = F.pieces().find((p) => p.cat === v); if (first) o.type = first.type; keepOpt(); props(); });
          if (o.cat === "People") {
            if (o.type !== "person") { o.type = "person"; o.pose = o.pose || "stand"; }
            const P0 = F.POSES(), grid = el("div", "ppfurn"); grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:3px;margin:4px 0";
            Object.keys(P0).forEach((k) => { const b = el("button", "ghost", "🧍 " + P0[k]); b.type = "button"; b.dataset.pose = k; b.style.cssText = "font-size:11px;padding:2px 4px;text-align:left" + (k === o.pose ? ";outline:1px solid var(--tiger,#f59e2c)" : ""); b.onclick = () => { o.type = "person"; o.pose = k; keepOpt(); props(); ctx.status("🧍 " + P0[k] + " - click on a floor"); }; grid.appendChild(b); });
            box.appendChild(grid);
            numIn("Turn", o.rot, (v) => { o.rot = ((Math.round(v) % 360) + 360) % 360; keepOpt(); props(); }, 15, -360, 360, "°");
            box.appendChild(el("div", "pphint", "A mannequin where someone stands - name them in their panel; a character's name helps ✨ the real photo"));
          } else if (o.cat !== "3D models") {
            const list = F.pieces().filter((p) => p.cat === o.cat);
            if (!list.some((p) => p.type === o.type) && list[0]) o.type = list[0].type;
            const grid = el("div", "ppfurn"); grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:3px;margin:4px 0";
            list.forEach((p) => { const b = el("button", "ghost" + (p.type === o.type ? " on" : ""), p.label); b.type = "button"; b.dataset.type = p.type; b.title = p.w + " × " + p.d + " × " + p.h + " m"; b.style.cssText = "font-size:11px;padding:2px 4px;text-align:left" + (p.type === o.type ? ";outline:1px solid var(--tiger,#f59e2c)" : ""); b.onclick = () => { o.type = p.type; keepOpt(); props(); ctx.status("🛋 " + p.label + " - click on a floor"); }; grid.appendChild(b); });
            box.appendChild(grid);
            numIn("Turn", o.rot, (v) => { o.rot = ((Math.round(v) % 360) + 360) % 360; keepOpt(); props(); }, 15, -360, 360, "°");
            chkIn("Own colour", !!o.color, (v) => { o.color = v ? "#8a8378" : ""; keepOpt(); props(); });
            if (o.color) colIn("Colour", o.color, (v) => { o.color = v; keepOpt(); });
          } else {
            const pick = el("div", "pphint", "the project's 3D models (.glb / .obj - SolidCraft's, imported): one comes in as a group you can move, scale and paint");
            box.appendChild(pick);
            const lb = el("div", "ppbtns"); box.appendChild(lb);
            if (ctx.models) ctx.models().then((names) => { lb.innerHTML = ""; if (!names.length) lb.appendChild(el("div", "pphint", "(no 3D models in the project yet)")); names.forEach((n) => { const b = el("button", "ghost", "⤒ " + n); b.type = "button"; b.dataset.model = n; b.onclick = () => ctx.importModel && ctx.importModel(n); lb.appendChild(b); }); }).catch(() => {});
          }
        }
        if (tool === "light") { selIn("Type", o.type, Object.keys(P().LIGHTS).map((k) => [k, P().LIGHTS[k].label]), opt("type")); kel(o.col, opt("col")); numIn("Brightness (0 = usual)", o.lm, opt("lm"), 50, 0, 100000, "lm"); }
        if (tool === "stairs") { numIn("Width", o.w, opt("w"), 0.05, 0.3, 10, "m"); numIn("Height (up)", o.rise, opt("rise"), 0.05, 0.1, 20, "m"); }
        if (tool === "ceiling") box.appendChild(el("div", "pphint", "Click a room: its ceiling on / off. ⌂ Cut-away in the bar hides every ceiling and roof to look in from above."));
        ctx.resized && ctx.resized(); return;
      }
      // what is picked
      if (asel.ak === "wpt" || asel.ak === "wtop") {                   // 2.624.0: a cut / a top edge of a wall
        const R = x, prof = P().profile(R, asel.edge), e = P().edgesOf(R)[asel.edge];
        head("▮ " + R.name + " · " + (asel.ak === "wpt" ? (asel.k === 0 || asel.k === prof.length - 1 ? "a corner of the wall's top" : "a cut in the wall's top") : "a top edge of the wall"));
        if (asel.ak === "wpt") { numIn("Height", prof[asel.k][1], ch((v) => { P().moveTopPoint(AR(), R.id, asel.edge, asel.k, v); }), 0.05, 0.05, 50, "m"); if (e) box.appendChild(el("div", "pphint", fmt(prof[asel.k][0] * e.L) + " along the wall")); }
        else { numIn("Start height", prof[asel.k][1], ch((v) => { P().moveTopPoint(AR(), R.id, asel.edge, asel.k, v); }), 0.05, 0.05, 50, "m"); numIn("End height", prof[asel.k + 1][1], ch((v) => { P().moveTopPoint(AR(), R.id, asel.edge, asel.k + 1, v); }), 0.05, 0.05, 50, "m"); }
        btns([["🗑 Delete", eraseSel, asel.ak === "wpt" ? "The cut goes (a corner: back to the room's height)" : "Its cuts go - one straight top again"]]);
        box.appendChild(el("div", "pphint", "Drag it up / down (Select) to slope the wall. Double-click the top of a wall for another cut."));
        ctx.resized && ctx.resized(); return;
      }
      if (asel.ak === "room") {
        const R = x, rect = R.closed && R.pts.length === 4 && isRect(R);
        head((R.closed ? "⌂ " : "▮ ") + R.name + (R.closed ? " · " + (+P().roomArea(R).toFixed(2)) + " m²" : ""));
        txtIn("Name", R.name, ch((v) => { R.name = v; }));
        if (rect) { const e = P().edgesOf(R); numIn("Width", e[0].L, ch((v) => P().resizeRect(AR(), R.id, v, e[1].L)), 0.05, 0.3, 500, "m"); numIn("Depth", e[1].L, ch((v) => P().resizeRect(AR(), R.id, e[0].L, v)), 0.05, 0.3, 500, "m"); }
        numIn("Wall height", R.h, ch((v) => P().setRoom(AR(), R.id, { h: v })), 0.05, 0.1, 50, "m");
        numIn("Wall thickness", R.t, ch((v) => P().setRoom(AR(), R.id, { t: v })), 0.01, 0.02, 2, "m");
        numIn("Floor level", R.z, ch((v) => P().setRoom(AR(), R.id, { z: v })), 0.05, -100, 1000, "m");
        colIn(R.closed ? "Walls inside" : "Wall", R.wall, ch((v) => { R.wall = v; }));
        if (R.closed) { colIn("Floor", R.floor, ch((v) => { R.floor = v; })); colIn("Ceiling", R.ceilCol, ch((v) => { R.ceilCol = v; })); chkIn("Has a floor", R.floorOn, ch((v) => { R.floorOn = v; })); selIn("Ceiling", !R.ceilOn ? "none" : R.ceil === "follow" ? "follow" : "flat", [["none", "None"], ["flat", "Flat"], ["follow", "Follows the walls' slope"]], ch((v) => { R.ceilOn = v !== "none"; R.ceil = v === "follow" ? "follow" : "flat"; })); }   // 2.624.0
        if (R.closed) {                                                   // 2.631.0: the auto floor slab + the auto roof for this room
          chkIn("Floor slab under the walls", !!R.slab, ch((v) => { R.slab = v; }));
          const own = AR().roofs.find((rf) => rf.rooms.includes(R.id));
          chkIn("Roof", !!own, ch((v) => { const A2 = AR(); if (v && !A2.roofs.some((rf) => rf.rooms.includes(R.id))) P().addRoof(A2, [R.id], { type: O.roof.type, pitch: O.roof.pitch, over: O.roof.over }); if (!v) A2.roofs.forEach((rf) => { rf.rooms = rf.rooms.filter((q) => q !== R.id); }), A2.roofs = A2.roofs.filter((rf) => rf.rooms.length); }));
        }
        colIn("Outside walls (all)", AR().ext, ch((v) => { AR().ext = v; }));
        btns([["⟳ 90°", ch(() => P().rotateRoom(AR(), R.id, 90)), "Turn it a quarter round its middle"], ["⧉ Duplicate", () => dupRoom(R.id), "A copy beside it, sharing its wall"],
          ["△ Roof", () => { const b = before(); const rf = P().addRoof(AR(), [R.id], { type: O.roof.type, pitch: O.roof.pitch, over: O.roof.over }); done("roof", b, { ak: "roof", id: rf.id }); }, "A roof over this room"], ["🗑 Delete", eraseSel, "Delete (its doors, windows and lights too)"]]);
        box.appendChild(el("div", "pphint", "Drag it (Select) - a wall near another room's wall snaps onto it and they share it. Shift keeps the drag straight."));
        if (R.closed && root.PPFurn) {                                    // 2.629.0: 🪄 Furnish (the House builder's - the LLM when one runs, else a room's set)
          const wi = el("input"); wi.type = "text"; wi.placeholder = "e.g. a cosy reading corner"; wi.id = "ppFurnWords"; row("Furnish with", wi, "optional words - the LLM picks from the furniture library");
          btns([["🪄 Furnish", () => furnishRoom(R, wi.value), "Fill the room with furniture (Ctrl+Z takes it out)"]]);
        }
      } else if (asel.ak === "op") {
        const op = x, I = P().opInfo(AR(), op), R = P().room(AR(), op.room);
        head((op.kind === "door" ? "🚪 Door" : op.kind === "window" ? "🪟 Window" : "▯ Opening") + " · " + (R ? R.name : ""));
        selIn("Kind", op.kind, [["door", "Door"], ["window", "Window"], ["opening", "Opening"]], ch((v) => { const d = P().OPS[v]; op.kind = v; op.style = d.style; op.sill = d.sill; if (v === "window") { op.h = Math.min(op.h, d.h); op.col = P().DEF.frame; } else op.col = v === "door" ? P().DEF.door : P().DEF.frame; }));
        if (op.kind !== "opening") selIn("Style", op.style, P().STYLES[op.kind].map((s) => [s, s[0].toUpperCase() + s.slice(1)]), ch((v) => { op.style = v; }));
        numIn("Width", op.w, ch((v) => { op.w = v; }), 0.05, 0.2, 20, "m"); numIn("Height", op.h, ch((v) => { op.h = v; }), 0.05, 0.2, 20, "m");
        if (op.kind !== "door") numIn("Elevation (height from floor)", op.sill, ch((v) => { op.sill = Math.max(0, v); }), 0.05, 0, 20, "m");   // 2.625.0
        if (I) numIn("From the corner", Math.max(0, I.x0), ch((v) => { op.at = v + op.w / 2; }), 0.05, 0, 500, "m");
        if (op.kind !== "opening") colIn(op.kind === "door" ? "Door" : "Frame", op.col, ch((v) => { op.col = v; }));
        if (op.kind === "door") chkIn("Handle on the other side", op.flip, ch((v) => { op.flip = v; }));
        if (op.kind !== "opening") {                                     // 2.631.0: how far it is open, which way
          numIn("Open", op.open || 0, ch((v) => { op.open = Math.max(0, Math.min(100, Math.round(v))); }), 5, 0, 100, "%");
          const sliding = op.style === "sliding" || op.style === "slider";
          chkIn(sliding ? "The other pane slides" : op.kind === "door" ? "Opens outward" : "Opens inward", !!op.dir, ch((v) => { op.dir = v; }));
        }
        btns([["🗑 Delete", eraseSel]]);
        box.appendChild(el("div", "pphint", "Drag it (Select) along its wall, onto another wall" + (op.kind !== "door" ? ", or up / down (its elevation)" : "") + ". Drag a grip (the small squares on its sides, top" + (op.kind !== "door" ? " and bottom" : "") + ") to resize it."));
      } else if (asel.ak === "light") {
        const L = x, def = P().LIGHTS[L.type];
        head("💡 " + def.label);
        selIn("Type", L.type, Object.keys(P().LIGHTS).map((k) => [k, P().LIGHTS[k].label]), ch((v) => { const d0 = P().LIGHTS[L.type], d1 = P().LIGHTS[v]; if (L.lm === d0.lm) L.lm = d1.lm; L.type = v; if (d1.mount === "ceil") { const sp = P().lightSpot(AR(), v, [L.x, L.y], null); L.z = sp.z; } }));
        chkIn("On", L.on, ch((v) => { L.on = v; }));
        kel(L.col, ch((v) => { L.col = v; }));
        numIn("Brightness", L.lm, ch((v) => { L.lm = v; }), 50, 0, 100000, "lm");
        if (L.type === "pendant" || L.type === "chandelier") numIn("Hangs down", L.drop, ch((v) => { L.drop = v; }), 0.05, 0.05, 10, "m");
        if (L.type === "downlight" || L.type === "spot") numIn("Beam", L.ang, ch((v) => { L.ang = v; }), 1, 5, 85, "°");
        numIn("Height", L.z, ch((v) => { L.z = v; }), 0.05, -100, 1000, "m");
        btns([["🗑 Delete", eraseSel]]);
        box.appendChild(el("div", "pphint", "🌙 Night (in the bar) turns the sun down - the lights light the rooms. Drag a light (Select) to move it."));
      } else if (asel.ak === "roof") {
        const rf = x;
        head("△ Roof · " + rf.rooms.length + " room" + (rf.rooms.length > 1 ? "s" : ""));
        selIn("Type", rf.type, ROOF_OPTS(), ch((v) => { rf.type = v; }));
        if (rf.type !== "follow") numIn("Pitch", rf.pitch, ch((v) => { rf.pitch = v; }), 1, 0, 75, "°");
        numIn(rf.type === "follow" ? "Eaves width" : "Overhang", rf.over, ch((v) => { rf.over = v; }), 0.05, 0, 5, "m"); numIn("Thickness", rf.th, ch((v) => { rf.th = v; }), 0.01, 0.02, 2, "m");
        selIn("Ridge", rf.ridge, [["auto", "Along the long side"], ["u", "Along the first wall"], ["v", "Across the first wall"]], ch((v) => { rf.ridge = v; }));
        colIn("Colour", rf.col, ch((v) => { rf.col = v; }));
        btns([["△ Over the whole storey", ch(() => { const R0 = P().room(AR(), rf.rooms[0]); rf.rooms = P().level(AR(), R0 ? R0.z : 0); }), "Every room on its floor under this roof"], ["🗑 Delete", eraseSel]]);
      } else if (asel.ak === "stair") {
        const s = x; head("▟ Stairs · " + Math.max(2, Math.round(s.rise / 0.18)) + " steps");
        numIn("Width", s.w, ch((v) => { s.w = v; }), 0.05, 0.3, 10, "m"); numIn("Length", s.len, ch((v) => { s.len = v; }), 0.05, 0.3, 50, "m"); numIn("Height (up)", s.rise, ch((v) => { s.rise = v; }), 0.05, 0.1, 20, "m");
        numIn("Starts at", s.z, ch((v) => { s.z = v; }), 0.05, -100, 1000, "m"); colIn("Colour", s.col, ch((v) => { s.col = v; }));
        btns([["⟳ 90°", ch(() => { s.ang += 90; })], ["🗑 Delete", eraseSel]]);
      } else if (asel.ak === "cam" && root.PPCam) {                      // 2.629.0: 📷 a camera
        const c = x; head("📷 " + c.name);
        if (through && through.id === c.id) lookThrough(c);             // 2.631.0: looking through it - its new turn / tilt / lens / place shown
        txtIn("Name", c.name, ch((v) => { c.name = v; }));
        numIn("Eye height", Math.round((c.z - floorAt(AR(), [c.x, c.y])) * 1000) / 1000, ch((v) => { c.z = floorAt(AR(), [c.x, c.y]) + v; }), 0.05, 0.05, 50, "m");
        numIn("Turn (yaw)", c.yaw, ch((v) => { c.yaw = ((v % 360) + 360) % 360; }), 5, -720, 720, "°"); numIn("Tilt (pitch)", c.pitch, ch((v) => { c.pitch = Math.max(-89, Math.min(89, v)); }), 2, -89, 89, "°");
        numIn("Roll", c.roll || 0, ch((v) => { c.roll = Math.max(-180, Math.min(180, v)); }), 5, -180, 180, "°");      // 2.633.0
        const C0 = root.PPCam, mm = C0.mmOf(c.fov);
        selIn("Lens", C0.lensOf(mm), C0.LENSES.map((l) => [l[0], l[1]]).concat([["custom", "Custom"]]), ch((v) => { const L = C0.LENSES.find((l) => l[0] === v); if (L) c.fov = C0.fovOf(L[2]); }));
        numIn("Focal length", mm, ch((v) => { c.fov = C0.fovOf(v); }), 1, 4.4, 2000, "mm");
        numIn("Field of view", c.fov, ch((v) => { c.fov = Math.max(3, Math.min(140, v)); }), 1, 3, 140, "°");
        const sz = el("select"); [["1920x1080", "1920 × 1080"], ["1280x720", "1280 × 720"], ["1080x1920", "1080 × 1920 (upright)"], ["1024x1024", "1024 × 1024"]].forEach(([v, t]) => { const q = el("option", "", t); q.value = v; sz.appendChild(q); }); sz.value = O.camera.size || "1920x1080"; sz.onchange = () => { O.camera.size = sz.value; keepOpt(); }; row("Shot size", sz);
        btns([["👁 Look through", () => lookThrough(c)], ["📷 Shot + depth + normal", () => camShots(c)], ["📍 360° location", () => camLocation(c)], ["🗑 Delete", eraseSel]]);
        box.appendChild(el("div", "pphint", "📷 the shot (the photo look) + its depth and normal maps go to the Image assets; 📍 a 360° panorama from it becomes a Location (its @tag, the prompt's location)."));
      } else if (asel.ak === "item" && root.PPFurn) {                    // 2.628.0: a piece of furniture
        const it = x; head((it.type === "person" ? "🧍 " : "🛋 ") + root.PPFurn.label(it));
        if (it.type === "person") {                                       // 2.630.0: a person - name, pose, height
          txtIn("Name", it.name || "", ch((v) => { it.name = v; }));
          selIn("Pose", it.pose, Object.keys(root.PPFurn.POSES()).map((k) => [k, root.PPFurn.POSES()[k]]), ch((v) => { it.pose = v; }));
          numIn("Height", it.h, ch((v) => { it.h = v; }), 0.05, 0.9, 2.3, "m");
        } else {
        numIn("Width", it.w, ch((v) => { it.w = v; }), 0.05, 0.02, 50, "m"); numIn("Depth", it.d, ch((v) => { it.d = v; }), 0.05, 0.02, 50, "m"); numIn("Height", it.h, ch((v) => { it.h = v; }), 0.05, 0.01, 50, "m"); }
        numIn("Turn (yaw)", it.rot, ch((v) => { it.rot = ((Math.round(v) % 360) + 360) % 360; }), 15, -360, 360, "°");
        numIn("Pitch", it.pitch || 0, ch((v) => { it.pitch = Math.max(-180, Math.min(180, v)); }), 5, -180, 180, "°"); numIn("Roll", it.roll || 0, ch((v) => { it.roll = Math.max(-180, Math.min(180, v)); }), 5, -180, 180, "°");   // 2.633.0
        numIn("Up from the floor", it.z, ch((v) => { it.z = v; }), 0.05, -100, 1000, "m");
        chkIn("Own colour", !!it.color, ch((v) => { it.color = v ? "#8a8378" : ""; }));
        if (it.color) colIn("Colour", it.color, ch((v) => { it.color = v; }));
        btns([["⟳ 90°", ch(() => { it.rot = (it.rot + 90) % 360; })], ["⧉ Duplicate", () => { const b = before(), A = AR(), c = Object.assign({}, it, { id: A.n++, x: it.x + it.w + 0.1 }); A.items.push(c); done("duplicate", b, { ak: "item", id: c.id }); }], ["🗑 Delete", eraseSel]]);
        box.appendChild(el("div", "pphint", "Drag it (Select); R turns it 90°; Delete removes it."));
      } else if (asel.ak === "slab") {
        const s = x; head("▦ Floor · " + (+Math.abs(P().area2(s.pts)).toFixed(2)) + " m²");
        numIn("Top at", s.z, ch((v) => { s.z = v; }), 0.05, -100, 1000, "m"); numIn("Thickness", s.th, ch((v) => { s.th = v; }), 0.01, 0.01, 5, "m"); colIn("Colour", s.col, ch((v) => { s.col = v; }));
        btns([["🗑 Delete", eraseSel]]);
      }
      ctx.resized && ctx.resized();
    }
    function ROOF_OPTS() { return P().ROOFS.map((r) => [r, r === "follow" ? "Follows the walls' slope" : r[0].toUpperCase() + r.slice(1)]); }
    function isRect(R) { const e = P().edgesOf(R); return e.length === 4 && e.every((a, i) => Math.abs(a.u[0] * e[(i + 1) % 4].u[0] + a.u[1] * e[(i + 1) % 4].u[1]) < 1e-6); }
    function dupRoom(id) {
      const A = AR(), R = P().room(A, id); if (!R) return;
      const e = P().edgesOf(R)[0], b = before(), C = P().duplicateRoom(A, id, [e.u[0] * e.L, e.u[1] * e.L]);
      done("duplicate", b, { ak: "room", id: C.id }); ctx.status("⧉ " + C.name + " beside it - sharing the wall");
    }
    function roofAll() {
      const A = AR(), R0 = asel && asel.ak === "room" ? P().room(A, asel.id) : null, ids = P().level(A, R0 ? R0.z : 0);
      if (!ids.length) { ctx.status("no rooms on that floor yet"); return; }
      const b = before(), rf = P().addRoof(A, ids, { type: O.roof.type, pitch: O.roof.pitch, over: O.roof.over }); st.roof = rf.id;
      done("roof", b, { ak: "roof", id: rf.id }); ctx.status("△ one roof over " + ids.length + " rooms");
    }
    function summary() {
      const A = ctx.model() && ctx.model().arch; if (!A || !P().has(A)) return "";
      const n = (k, w) => (k ? k + " " + w + (k > 1 ? (w === "stairs" ? "" : "s") : "") : "");
      const rooms = A.rooms.filter((R) => R.closed).length, walls = A.rooms.length - rooms;
      return [n(rooms, "room"), n(walls, "wall"), n(A.ops.filter((o) => o.kind === "door").length, "door"), n(A.ops.filter((o) => o.kind === "window").length, "window"), n(A.roofs.length, "roof"), n(A.lights.length, "light"), n(A.stairs.length, "stairs"), n(A.slabs.length, "floor")].filter(Boolean).join(" · ");
    }
    return { furnishRoom, lookThrough, leaveThrough, through: () => (through ? through.id : null), camShots, camLocation, lastCam: () => last, owns, use, down, move, up, dbl, vcb, key, selectDown, selectMove, selectUp, selectDbl, eraseAt, paintAt, sel: () => asel, setSel, props, summary, state: () => st, opts: O, roofAll, TOOLS, HINT, VCB };
  }
  root.PPArchTools = { create, TOOLS, HINT, VCB, OPT0 };
})(typeof window !== "undefined" ? window : globalThis);
