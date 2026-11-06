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
 *   Y Roof     click a room: a roof over it (gable · hip · skillion · dutch gable · clipped gable · gambrel · mansard · saltbox · pyramid · butterfly · flat - 2.666.0); Shift+click another: the same roof over it too
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
  const VCB = { room: "Width,Length", wall: "Length", door: "Width,Height", window: "Width,Height", floor: "Width,Depth", roof: "Pitch°", light: "Lumens", stairs: "Length", furniture: "Turn°", camera: "Lens°" };
  const OPT0 = { room: { h: 2.7, t: 0.15, z: 0, ceilOn: true, off: 0, autoRoof: false, autoFloor: false, w: 0, l: 0 }, wall: { h: 2.7, t: 0.15, z: 0, off: 0 }, door: { style: "single", w: 0.9, h: 2.1 }, window: { style: "double", w: 1.2, h: 1.2, sill: 0.9 },
    floor: { z: 0, th: 0.2 }, roof: { type: "gable", pitch: 30, over: 0.4, eave: "boxed", fascia: true, gutter: "quad", downpipes: true }, light: { type: "downlight", col: "#ffcf9e", lm: 0 }, stairs: { w: 1, rise: 2.7 }, furniture: { type: "sofa", cat: "Living", rot: 0, color: "" }, camera: { eye: 1.6, fov: 60 } };

  function create(ctx) {
    const V = ctx.V, v3 = () => G().v3;
    let tool = null, st = {}, asel = null, through = null;
    let amore = [];                                                    // 2.648.0: Ctrl+click - the others picked with asel      // through: 2.631.0 the camera the view looks through
    let gizmo = "move";                                           // 2.641.0: a picked camera's widget - "move" (arrows) | "rotate" (rings, a double-click)
    const O = JSON.parse(JSON.stringify(OPT0));
    try { const s = JSON.parse(root.localStorage.getItem("pp.archopt") || "{}"); Object.keys(O).forEach((k) => { if (s[k] && typeof s[k] === "object") Object.assign(O[k], s[k]); }); } catch (e) { /* fine */ }
    ["wall", "room"].forEach((k) => { if (!(O[k].t >= 0.02 && O[k].t < 2)) O[k].t = OPT0[k].t; });   // 2.691.0: 2 m = a size in mm held at the top - back to 150 mm
    const keepOpt = () => { try { root.localStorage.setItem("pp.archopt", JSON.stringify(O)); } catch (e) { /* fine */ } };
    /** 2.691.0 (Tim: "use last set wall thickness for the wall thickness right now u have it set at 2m"): a wall thickness typed
        anywhere (the Wall / Room tool, a picked wall or room) = the next walls' and rooms' too; over 2 = millimetres (200 = 0.2 m) */
    const tOf = (v) => Math.min(2, Math.max(0.02, v > 2 ? v / 1000 : v));
    const lastT = (v) => { O.wall.t = v; O.room.t = v; keepOpt(); };
    const AV = () => ctx.archView(), AR = () => P().of(ctx.model());
    const fmt = (m) => G().fmtLen(m);
    const owns = (n) => !!HINT[n];

    /* ---- the mouse on a level */
    /** 2.625.0: the ray on a vertical plane (a wall's face) through p, square to n */
    function wallAt(ev, p, n) { const r = V.ray(ev), den = r.d[0] * n[0] + r.d[1] * n[1]; if (Math.abs(den) < 0.12) return null; const t = ((p[0] - r.o[0]) * n[0] + (p[1] - r.o[1]) * n[1]) / den; return t > 0 ? [r.o[0] + r.d[0] * t, r.o[1] + r.d[1] * t, r.o[2] + r.d[2] * t] : null; }
    /** 2.625.0: the picked door / window's grip under the pointer (on the wall's face toward the camera) -> {key, n, p} | null */
    /** 2.633.0: the rotate ring under the pointer (a picked camera / piece of furniture) -> {key, axis, c} | null */
    /** 2.643.0: the picked camera's widget place - ahead of the eye when the view looks through it, else null (at the eye) */
    const widgetOf = (o) => (through && asel && asel.ak === "cam" && through.id === asel.id && root.PPCam ? root.PPCam.widgetAt(o) : null);
    function ringAt(ev) {
      if (!asel || (asel.ak !== "cam" && asel.ak !== "item") || !root.PPCam) return null;
      if (asel.ak === "cam" && gizmo !== "rotate") return null;                         // 2.641.0: a camera's rings after a double-click
      const o = P().find(AR(), asel.ak, asel.id); if (!o) return null;
      const G0 = root.PPCam.rings(asel.ak, o, asel.ak === "cam" ? widgetOf(o) : null), r = V.canvas.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
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
    /** 2.641.0: the picked camera's move arrow under the pointer (move mode) -> {key, dir, c} | null */
    function axisAt(ev) {
      if (!asel || asel.ak !== "cam" || gizmo !== "move" || !root.PPCam) return null;
      const o = P().find(AR(), "cam", asel.id); if (!o) return null;
      const wa = widgetOf(o), W = root.PPCam.moveAxes(o, wa), r = V.canvas.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
      const eye = V.screen(W.c); if (!wa && eye[2] < 1 && Math.hypot(eye[0] - mx, eye[1] - my) < 14) return null;   // on the camera itself: a free move, not an arrow
      let best = null;
      W.axes.forEach((ax) => {
        const a = V.screen(W.c.map((v, k) => v + ax.dir[k] * 0.1)), b = V.screen(W.c.map((v, k) => v + ax.dir[k] * (W.len + 0.12)));
        if (a[2] > 1 || b[2] > 1) return;
        const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy; if (L2 < 100) return;          // seen end-on: not grabbable
        const t = Math.max(0, Math.min(1, ((mx - a[0]) * dx + (my - a[1]) * dy) / L2)), d = Math.hypot(mx - a[0] - dx * t, my - a[1] - dy * t);
        if (d < 9 && (!best || d < best.d)) best = { d, key: ax.key, dir: ax.dir, c: W.c, sa: a, sb: b, len: W.len + 0.02 };
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
      if (O.furniture.type === "joinery" && root.PPJoinery) return joineryAt(A, p, z, O.furniture.spec, O.furniture.rot);   // 2.689.0
      return root.PPFurn ? root.PPFurn.make(O.furniture.type, p, z, O.furniture.rot, O.furniture.color, O.furniture.pose) : null;
    }
    /** 2.689.0: a cupboard / shelving / walk-in robe put where the pointer is - inside a room its BACK goes against the nearest
     *  inside face of a wall, facing into the room, slid along it (flush with a corner within 15 cm); else free, turned as set */
    function jWallFor(A, p, z, D) {                                     // (wallFor(ev) is the doors' / lights' own, below)
      const R = P().roomAt(A, p, z), poly = R && P().interior(R); if (!poly || poly.length < 3) return null;
      let best = null;
      for (let k = 0; k < poly.length; k++) {
        const a = poly[k], b = poly[(k + 1) % poly.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.2) continue;
        const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], s0 = P().segDist(p, a, b);
        if (!best || s0.d < best.d) best = { R, a, b, u, L, d: s0.d, k };
      }
      return best && best.d <= Math.max(1.2, (D || 0) + 0.6) ? best : null;
    }
    /** 2.689.0: ↔ Fit the wall - the cupboard as wide as the wall behind it (L / U: as deep as the room), against it */
    function fitWall(it) {
      const J = root.PPJoinery, A = AR(), a = -(it.rot || 0) * Math.PI / 180, back = [it.x + (it.d / 2) * Math.sin(a), it.y - (it.d / 2) * Math.cos(a)];
      const w = jWallFor(A, back, it.z, it.d); if (!w) { ctx.status("↔ no room wall behind it - put it against one first"); return; }
      const s = J.clean(it.spec); s.w = Math.round(w.L * 1000) / 1000;
      if (s.layout !== "run") {                                            // as deep as the room: to the face across from it
        const n = [-w.u[1], w.u[0]], poly = P().interior(w.R), mid = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
        let far = 0; poly.forEach((q) => { far = Math.max(far, (q[0] - mid[0]) * n[0] + (q[1] - mid[1]) * n[1]); });
        if (far > s.d + 0.3) s.side = Math.round(far * 1000) / 1000;      // the room's full depth (to the face across)
      }
      const placed = joineryAt(A, [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2], it.z, s, it.rot);
      Object.assign(it, { x: placed.x, y: placed.y, rot: placed.rot }); J.apply(it, s);
      ctx.status("↔ " + J.label(it) + " - " + Math.round(s.w * 1000) + " mm wide, against the wall");
    }
    function joineryAt(A, p, z, spec, rot) {
      const J = root.PPJoinery, s = J.clean(spec || J.DEFAULT), D = J.dims(s), w = jWallFor(A, p, z, D.d);
      if (!w) return Object.assign(J.makeItem(s, p, z, rot), { against: null });
      const n = [-w.u[1], w.u[0]];                                          // the walls run anticlockwise: left = into the room
      let t = (p[0] - w.a[0]) * w.u[0] + (p[1] - w.a[1]) * w.u[1];
      t = D.w >= w.L ? w.L / 2 : Math.max(D.w / 2, Math.min(w.L - D.w / 2, t));
      if (t - D.w / 2 < 0.15) t = Math.min(w.L / 2, D.w / 2); else if (w.L - (t + D.w / 2) < 0.15) t = Math.max(w.L / 2, w.L - D.w / 2);   // flush into a corner
      const c = [w.a[0] + w.u[0] * t + n[0] * (D.d / 2 + 0.002), w.a[1] + w.u[1] * t + n[1] * (D.d / 2 + 0.002)];
      const r = ((Math.round(Math.atan2(n[0], n[1]) * 180 / Math.PI) % 360) + 360) % 360;
      return Object.assign(J.makeItem(s, c, z, r), { against: { room: w.R.id, len: w.L } });
    }
    function planeAt(ev, z) { const r = V.ray(ev); if (Math.abs(r.d[2]) < 1e-9) return null; const t = (z - r.o[2]) / r.d[2]; return t > 0 ? [r.o[0] + r.d[0] * t, r.o[1] + r.d[1] * t, z] : null; }
    function snapPlan(ev, z, from, onWall) {
      let s = V.snap(ev, { from: from ? [from[0], from[1], z] : null, plane: { n: [0, 0, 1], p: [0, 0, z] }, extra: P().snapPoints(AR(), z), group: ctx.group() });
      let p = [s.p[0], s.p[1], z];
      // 2.663.0: the up (blue) axis means nothing on a floor plan - seen from above it caught the pointer anywhere on the line
      // to the view's middle (the wall's next point stuck on its start): the floor under the pointer instead
      if (/Blue Axis/.test(s.kind || "")) { const q = planeAt(ev, z); if (q) { p = q; s = Object.assign({}, s, { p: q, kind: "On Plane", label: "On Plane", axis: null }); } }
      if ((s.kind === "On Face" || s.kind === "On Edge") && Math.abs(s.p[2] - z) > 1e-3) { const q = planeAt(ev, z); if (q) p = q; }
      // 2.663.0 (Tim: "the wall tool walls can start and finish from the room walls anywhere along the wall"): the pointer on a
      // wall (its face / its top / the floorplan) - onto that wall's line (a split point / corner: Endpoint wins)
      if (onWall && !/Endpoint|Midpoint/.test(s.kind)) {
        const h = AV() && AV().pick(ev), q = h && h.tag.ak === "wall" && nearerThanModel(ev, h) ? [h.point[0] - h.n[0] * 0.02, h.point[1] - h.n[1] * 0.02] : [p[0], p[1]];
        const w = P().nearestWall(AR(), q, Math.max(pxTol(p), 0.05), z);
        if (w) { const c = [w.e.a[0] + w.e.u[0] * w.at, w.e.a[1] + w.e.u[1] * w.at]; p = [c[0], c[1], z]; return { p, s: Object.assign({}, s, { p, kind: "On Wall", label: "On Wall · " + w.R.name + " " + fmt(w.at) + " along", color: "#f59e2c" }) }; }
      }
      // 2.624.0: onto a floor's edge (On Floor Edge) when nothing stronger caught the pointer
      if (!/Endpoint|Midpoint|Origin|Axis/.test(s.kind)) {
        const tol = pxTol(p); let best = null;
        P().slabEdges(AR()).forEach((e) => { const sd = P().segDist([p[0], p[1]], e.a, e.b); if (sd.d < tol && (!best || sd.d < best.d)) best = { d: sd.d, q: [e.a[0] + (e.b[0] - e.a[0]) * sd.t, e.a[1] + (e.b[1] - e.a[1]) * sd.t] }; });
        if (best) { p = [best.q[0], best.q[1], z]; return { p, s: Object.assign({}, s, { p, kind: "On Floor Edge", label: "On Floor Edge", color: "#f59e2c" }) }; }
      }
      return { p, s };
    }
    /** 2.690.0: a wall's point pulled onto another wall's end / corner when it is close (15 cm, or 14 px when zoomed out) */
    function endMagnet(p, z) {
      const tol = Math.min(0.6, Math.max(0.15, pxTol([p[0], p[1], z]))), e = P().endNear(AR(), p, tol, z);   // pxTol = 14 px in metres
      return e ? { p: [e.p[0], e.p[1], z], name: e.R.name, kind: e.R.closed ? "corner" : "end" } : null;
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
    const fixedSize = () => O.room.w > 0.05 && O.room.l > 0.05;            // 2.647.0: the Room tool's Width + Length set
    function rectTool(ev, z, finish) {
      const { p, s } = snapPlan(ev, z, st.a);
      if (!st.a) { st.a = p; return; }
      finish(st.a, p, s);
    }
    function down(ev) {
      if (ev.button !== 0) return;
      const A = AR();
      if (tool === "room" && fixedSize()) { const { p } = snapPlan(ev, O.room.z); finishRoom(p, [p[0] + O.room.w, p[1] + O.room.l]); return; }   // 2.647.0: a set size = one click
      if (tool === "room") return rectTool(ev, O.room.z, (a, b) => finishRoom(a, b));
      if (tool === "floor") return rectTool(ev, O.floor.z, (a, b) => finishSlab(a, b));
      if (tool === "wall") {
        const from = st.pts && st.pts[st.pts.length - 1]; let { p } = snapPlan(ev, O.wall.z, from, true);   // 2.663.0: on a wall's line too
        const mg = !ev.shiftKey && endMagnet(p, O.wall.z); if (mg) p = mg.p;              // 2.690.0: onto another wall's end (Shift: free)
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
        const b = before(), rf = P().addRoof(A, [R.id], roofOpts()); st.roof = rf.id;
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
        delete it.against;
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
        const jn = it.type === "joinery";
        V.preview({ lines, tip: (jn ? "🗄 " : "🛋 ") + root.PPFurn.label(it) + " · " + (jn ? (it.against ? "against the wall · " : "free · ") + Math.round(it.w * 1000) + " × " + Math.round(it.d * 1000) + " mm" : it.rot + "°"), tipAt: [it.x, it.y, it.z + it.h], color: 0x2563eb });
        return;
      }
      if (tool === "room" || tool === "floor") {
        const z = tool === "room" ? O.room.z : O.floor.z, { p, s } = snapPlan(ev, z, st.a), fix = tool === "room" && fixedSize();
        if (!st.a && !fix) { show(s, { tip: tool === "room" ? "a room's corner" : "a floor's corner" }); return; }
        const a0 = fix ? p : st.a, p2 = fix ? [p[0] + O.room.w, p[1] + O.room.l, p[2]] : p;   // 2.647.0: a set size - the room at the pointer
        if (!fix) st.cur = p; const R = P().rectPts(a0, p2), w = Math.abs(p2[0] - a0[0]), d = Math.abs(p2[1] - a0[1]);
        const lines = loop3(R, z); if (tool === "room") { loop3(R, z + O.room.h).forEach((x) => lines.push(x)); R.forEach((q) => lines.push([[q[0], q[1], z], [q[0], q[1], z + O.room.h]])); }
        show(s, { from: fix ? null : st.a, lines, faces: [[[R[0][0], R[0][1], z], [R[1][0], R[1][1], z], [R[2][0], R[2][1], z]], [[R[0][0], R[0][1], z], [R[2][0], R[2][1], z], [R[3][0], R[3][1], z]]], tip: fmt(w) + " × " + fmt(d) });
        if (!fix) ctx.vcbValue((+w.toFixed(3)) + "," + (+d.toFixed(3))); return;
      }
      if (tool === "wall") {
        const from = st.pts && st.pts[st.pts.length - 1]; let { p, s } = snapPlan(ev, O.wall.z, from, true);
        const mg = !ev.shiftKey && endMagnet(p, O.wall.z);                                 // 2.690.0: shown pulled onto that end
        if (mg) { p = mg.p; s = Object.assign({}, s, { p, kind: "Endpoint", label: "⊕ " + mg.name + "'s " + mg.kind + " - joined" }); }
        if (!from) { show(s, { tip: mg ? "the wall's start · ⊕ joined to " + mg.name + "'s " + mg.kind : "the wall's start" }); return; }
        st.cur = p; const pts = st.pts.concat([p]), lines = [];
        for (let i = 0; i + 1 < pts.length; i++) { const a = pts[i], b = pts[i + 1]; lines.push([a, b], [[a[0], a[1], a[2] + O.wall.h], [b[0], b[1], b[2] + O.wall.h]]); }
        const closes = st.pts.length >= 3 && Math.hypot(p[0] - st.pts[0][0], p[1] - st.pts[0][1]) < 1e-6;
        show(s, { from, lines, tip: fmt(Math.hypot(p[0] - from[0], p[1] - from[1])) + (closes ? " · closes it: a room" : mg ? " · ⊕ joined to " + mg.name + "'s " + mg.kind : "") }); ctx.vcbValue(fmt(Math.hypot(p[0] - from[0], p[1] - from[1]))); return;
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
      if (O.room.autoRoof) P().addRoof(AR(), [R.id], roofOpts());   // 2.631.0: the auto roof
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
      const nj = P().addJoins(AR(), R);                                      // 2.690.0: its ends on other walls' ends = joined
      done(closed ? "room" : "wall", bf, { ak: "room", id: R.id }); if (nj) { ctx.status("▮ " + R.name + " ⊕ joined to " + nj + " wall end" + (nj > 1 ? "s" : "") + " - drag either and the other grows / shrinks with it"); return; } ctx.status((closed ? "⌂ the walls closed round " + R.name : "▮ " + R.name + " - doors and windows go in it too") + (of.moved ? " · " + of.moved + " run(s) " + fmt(O.wall.off) + " in from the floor's edge" : ""));
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
    /** 2.647.0 (Tim: "esc deselects all tools and changes to orbit mode in all views"): a wall run of 2+ points is kept, any
     *  other step dropped, nothing picked - true when there was something to drop (pptools then goes to 🔄 Orbit) */
    function escape(baseTool) {
      let did = false;
      if (owns(baseTool) && baseTool === "wall" && st.pts && st.pts.length >= 2) { finishWall(false); did = "kept"; }
      if (Object.keys(st).length) { st = {}; V.preview({}); did = did || true; }
      if (asel) { setSel(null, true); did = did || true; }
      if (AV()) AV().setHover(null);
      return did;
    }
    function key(e, baseTool) {
      const k = e.key;
      if (k === "Escape" && st.pull) { st.pull = null; ctx.status("⇔ push / pull ended"); return true; }   // 2.688.0
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
      // 2.688.0 (Tim: "ctrl +drag will snap to horizontal or vertical depending on which way it is dragged"): a Ctrl press waits -
      // let go without moving = Ctrl+click (added to / taken out of the picked, 2.648.0); dragged = what a plain press would
      // drag, held to horizontal or vertical (the way it goes, like Shift)
      if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && !st.ctrlReplay) {
        const h0 = AV() && AV().pick(ev);
        if (h0 && h0.tag.ak !== "cam" && nearerThanModel(ev, h0)) {
          st.drag = { mode: "ctrlwait", ev: copyEv(ev), x0: ev.clientX, y0: ev.clientY, moved: false };
          return true;
        }
      }
      // 2.688.0: an end piece double-clicked = push / pull armed - a drag on it moves the wall's end along the wall
      if (st.pull) {
        const hp = AV() && AV().pick(ev), jp = hp && nearerThanModel(ev, hp) ? branchAt(hp) : null;
        if (jp && jp.kind === "end" && jp.R.id === st.pull.room && jp.k === st.pull.k) {
          const R0 = P().room(AR(), jp.R.id), v0 = R0.pts[jp.k].slice(), oth = R0.pts[jp.k === 0 ? 1 : jp.k - 1];
          const zp = hp.point[2];                                         // the pointer followed at the height it pressed (the end's top / face)
          st.drag = { mode: "endpull", room: jp.R.id, k: jp.k, edge: jp.walls[0], out: jp.out, v0, other: oth, z: zp, start: planeAt(ev, zp), x0: ev.clientX, y0: ev.clientY, before: before(), base: JSON.stringify(AR()), moved: false };
          return true;
        }
        st.pull = null;
      }
      const rg = ringAt(ev);                                             // 2.633.0: a rotate ring - yaw / pitch / roll by dragging round it
      if (rg) {
        const r = V.canvas.getBoundingClientRect(), cs = V.screen(rg.c), cp = V.cam().position;
        const toV = [cp.x - rg.c[0], cp.y - rg.c[1], cp.z - rg.c[2]], facing = rg.axis[0] * toV[0] + rg.axis[1] * toV[1] + rg.axis[2] * toV[2] >= 0 ? 1 : -1;
        st.drag = { t: asel, mode: "spin", key: rg.key, cx: r.left + cs[0], cy: r.top + cs[1], a0: Math.atan2(ev.clientY - r.top - cs[1], ev.clientX - r.left - cs[0]), facing, x0: ev.clientX, y0: ev.clientY, before: before(), base: JSON.stringify(AR()), moved: false };
        const pa = through && asel && through.id === asel.id ? null : ringAngle(ev, rg.c, rg.axis); if (pa !== null) Object.assign(st.drag, { pc: rg.c, pn: rg.axis, pa0: pa });   // the ring seen open enough: follow it in its own plane (2.643.0: not through it - the view turns with it: round its middle on screen)
        return true;
      }
      const ax = axisAt(ev);                                             // 2.641.0: a move arrow - along that axis only
      if (ax) {
        const r = V.ray(ev), cl = G().linesClosest(ax.c, ax.dir, r.o, r.d), s0 = (cl.point[0] - ax.c[0]) * ax.dir[0] + (cl.point[1] - ax.c[1]) * ax.dir[1] + (cl.point[2] - ax.c[2]) * ax.dir[2];
        st.drag = { t: asel, mode: "axis", key: ax.key, dir: ax.dir, p0: ax.c.slice(), s0, x0: ev.clientX, y0: ev.clientY, before: before(), base: JSON.stringify(AR()), moved: false };
        if (through && through.id === asel.id) {                         // 2.643.0: seen through it the view moves with it - the drag follows the screen
          const ux = ax.sb[0] - ax.sa[0], uy = ax.sb[1] - ax.sa[1], L = Math.hypot(ux, uy) || 1;
          st.drag.scr = { ux: ux / L, uy: uy / L, ppm: L / ax.len };
        }
        return true;
      }
      const gp = gripAt(ev);
      if (gp) { st.drag = { t: asel, mode: "grip", key: gp.key, p: gp.p, n: gp.n, x0: ev.clientX, y0: ev.clientY, before: before(), base: JSON.stringify(AR()), moved: false }; return true; }
      const h = AV() && AV().pick(ev);
      if (!h || (h.tag.ak !== "cam" && !nearerThanModel(ev, h))) { if (asel) setSel(null); return false; }   // 2.632.0: a camera is always on top
      // 2.662.0 (Tim: "add a segment to the end of each wall so user can drag another wall from any side of the end of walls"):
      // a press on a corner / a wall's end piece (past the walls themselves) - a drag draws a new wall out of that side
      const jb = branchAt(h);
      if (jb) { st.drag = { mode: "branch", R: jb.R, j: jb, v: jb.v, dir: jb.dir, z: jb.R.z, x0: ev.clientX, y0: ev.clientY, before: before(), moved: false }; return true; }
      // a view straight down (Top) sees only the walls' tops - there a press moves the wall; the slopes are edited from the side
      const th = Math.abs(V.ray(ev).d[2]) > 0.85 ? null : topUnder(h);
      if (th) {                                                        // 2.624.0: a cut / a top edge: dragged up / down
        const sel = th.k >= 0 ? { ak: "wpt", room: th.room, edge: th.edge, k: th.k } : { ak: "wtop", room: th.room, edge: th.edge, k: th.seg };
        ctx.setSel({ f: [], e: [], k: [] }); setSel(sel);
        st.drag = { t: sel, mode: "top", p0: h.point, z0: h.point[2], x0: ev.clientX, y0: ev.clientY, before: before(), base: JSON.stringify(AR()), moved: false };
        return true;
      }
      let t = AV().resolve(h); if (!t) return false;
      if (root.PPSketchPlane && t.ak !== "cam" && h.n) root.PPSketchPlane.set(h.n, h.point, nameOf(t) + (Math.abs(h.n[2]) > 0.9 ? (h.n[2] > 0 ? " (top)" : " (underside)") : " (face)"));   // 2.663.0: the clicked face = the sketch plane
      if (ev.shiftKey && t.ak === "room") t = { ak: "room", id: t.id };                 // 2.639.0: Shift+click = the whole room (then a drag moves it)
      // 2.648.0 (Tim: "pick tool to select a single object, ctrl+click will add to the selection"): a click = that one thing;
      // Ctrl+click = added to what is picked (Ctrl+click a picked one = taken out); a press on one of several picked = a drag
      // moves them all (let go without moving: only that one stays picked)
      const ctrl = ev.ctrlKey || ev.metaKey, all = picked(), inAll = all.some((x) => sameTag(x, t));
      if (ctrl || (inAll && all.length > 1)) {
        let list = all;
        if (ctrl) list = inAll ? all.filter((x) => !sameTag(x, t)) : all.concat([t]);
        const prim = ctrl ? (inAll ? list[list.length - 1] || null : t) : t, rest = list.filter((x) => !sameTag(x, prim));
        if (!prim) { setSel(null); ctx.status("nothing picked"); return true; }
        setSel(prim, true); setMore(rest); props();
        const A0 = AR(), x0 = P().find(A0, prim.ak === "wall" ? "room" : prim.ak, prim.ak === "wall" ? prim.room : prim.id);
        const z0 = x0 && Number.isFinite(x0.z) ? x0.z : h.point[2], start = planeAt(ev, z0);
        if (start && rest.length && (!ctrl || !inAll)) st.drag = { many: [prim].concat(rest), single: ctrl ? null : t, z: z0, start, x0: ev.clientX, y0: ev.clientY, before: before(), base: JSON.stringify(A0), moved: false };
        ctx.status((rest.length + 1) + " picked · Ctrl+click adds (a picked one: takes it out) · drag moves them all · Delete erases them · Esc lets go");
        return true;
      }
      if (amore.length) setMore([]);
      ctx.setSel({ f: [], e: [], k: [] }); setSel(t);
      const A = AR(), x = P().find(A, t.ak, t.id);
      if (t.ak === "room" && t.part === "wall" && t.edge != null && x && x.closed) {      // 2.624.0: one wall of the room
        const start = planeAt(ev, x.z);
        // 2.639.0: a wall moves across its own line (the walls beside it stretch / shorten, the floor, ceiling, skirting and
        // cornice follow); Alt+click = free (any way on the floor)
        if (start) st.drag = { t, mode: "edge", z: x.z, start, free: !!ev.altKey, x0: ev.clientX, y0: ev.clientY, before: before(), base: JSON.stringify(A), moved: false };
        return true;
      }
      const z = t.ak === "room" ? x.z : t.ak === "light" || t.ak === "item" || t.ak === "cam" ? x.z : t.ak === "stair" ? x.z : t.ak === "slab" || t.ak === "pool" ? x.z : h.point[2];   // a driveway: where it was pressed
      const start = planeAt(ev, z);
      if (t.ak !== "roof" && start) st.drag = { t, z, start, x0: ev.clientX, y0: ev.clientY, before: before(), base: JSON.stringify(A), moved: false };
      if (t.ak === "op" && st.drag) { const I = P().opInfo(A, x); if (I) Object.assign(st.drag, { wp: h.point, wn: I.nl, along0: (h.point[0] - I.o[0]) * I.u[0] + (h.point[1] - I.o[1]) * I.u[1], at0: I.at, sill0: x.sill, room0: x.room, edge0: x.edge }); }   // 2.625.0: up / down too
      return true;
    }
    /** 2.688.0: a press's fields kept (a Ctrl press replayed as a plain one once it moves) */
    function copyEv(ev) {
      const o = { clientX: ev.clientX, clientY: ev.clientY, button: ev.button || 0, buttons: 1, shiftKey: !!ev.shiftKey, altKey: !!ev.altKey, ctrlKey: false, metaKey: false,
        target: ev.target, currentTarget: ev.currentTarget, pointerId: ev.pointerId, pointerType: ev.pointerType, detail: ev.detail, timeStamp: ev.timeStamp,
        preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {} };
      if (typeof ev.offsetX === "number") { o.offsetX = ev.offsetX; o.offsetY = ev.offsetY; }
      return o;
    }
    /** 2.688.0: the wall's end pushed / pulled along the wall (Tim: "if the user doubleclicks the edge segment then push/pull
     *  from that segment") - the end moves on the wall's own line, at least 10 cm of wall left */
    function dragEndPull(ev, D) {
      const cur = planeAt(ev, D.z); if (!cur || !D.start) return true;
      const M = ctx.model(); M.arch = P().clean(JSON.parse(D.base)); const R = P().room(M.arch, D.room); if (!R) return true;
      const L0 = Math.hypot(D.v0[0] - D.other[0], D.v0[1] - D.other[1]);
      let d = (cur[0] - D.start[0]) * D.out[0] + (cur[1] - D.start[1]) * D.out[1];
      d = Math.max(0.1 - L0, Math.round(d * 1000) / 1000);
      if (!ev.shiftKey) { const L1 = Math.round((L0 + d) * 100) / 100; d = L1 - L0; }      // 1 cm steps (Shift: free)
      R.pts[D.k] = [Math.round((D.v0[0] + D.out[0] * d) * 1e4) / 1e4, Math.round((D.v0[1] + D.out[1] * d) * 1e4) / 1e4];
      AV().rebuild(); AV().setSel(asel);
      const L = Math.hypot(R.pts[D.k][0] - D.other[0], R.pts[D.k][1] - D.other[1]);
      ctx.vcbValue(fmt(L)); ctx.status("⇔ " + R.name + "'s wall " + (D.edge + 1) + " " + (d >= 0 ? "pulled out" : "pushed in") + " " + fmt(Math.abs(d)) + " - now " + fmt(L) + " long · let go to keep it");
      return true;
    }
    /** 2.662.0: a pick on a corner / an end piece -> {R, v, walls, poly, dir (the side's way out; null: the top - any way)} | null */
    function branchAt(h) {
      if (!h || h.tag.ak !== "wall" || !P().jointAt) return null;
      const side = Math.abs(h.n[2]) < 0.5, pin = side ? [h.point[0] - h.n[0] * 0.01, h.point[1] - h.n[1] * 0.01] : [h.point[0], h.point[1]];
      const J = P().jointAt(AR(), pin, h.point[2]); if (!J || !J.only) return null;
      const L = Math.hypot(h.n[0], h.n[1]) || 1;
      return Object.assign({}, J, { dir: side ? [h.n[0] / L, h.n[1] / L] : null });
    }
    function branchFaces(J) { const z = J.R.z + J.R.h + 0.004, P0 = J.poly, out = []; for (let k = 1; k + 1 < P0.length; k++) out.push([[P0[0][0], P0[0][1], z], [P0[k][0], P0[k][1], z], [P0[k + 1][0], P0[k + 1][1], z]]); return out; }
    function dragBranch(ev, D) {
      const { p } = snapPlan(ev, D.z, [D.v[0], D.v[1], D.z]); let e;
      if (D.dir) { const L = Math.max(0, (p[0] - D.v[0]) * D.dir[0] + (p[1] - D.v[1]) * D.dir[1]); e = [D.v[0] + D.dir[0] * L, D.v[1] + D.dir[1] * L]; }
      else if (D.axisLock || ev.shiftKey) { const dx = p[0] - D.v[0], dy = p[1] - D.v[1]; e = Math.abs(dx) > Math.abs(dy) ? [p[0], D.v[1]] : [D.v[0], p[1]]; }   // 2.688.0: Ctrl / Shift - horizontal or vertical
      else e = [p[0], p[1]];
      D.end = e; const a = [D.v[0], D.v[1], D.z], b = [e[0], e[1], D.z], H = D.R.h, L = Math.hypot(e[0] - D.v[0], e[1] - D.v[1]);
      V.preview({ lines: [[a, b], [[a[0], a[1], D.z + H], [b[0], b[1], D.z + H]], [b, [b[0], b[1], D.z + H]]], faces: branchFaces(D.j), faceColor: 0xf59e2c, marker: { p: b, color: "#f59e2c" }, tip: "▮ a new wall " + fmt(L) + (D.dir ? "" : " · any way (from the top)") });
      ctx.vcbValue(fmt(L)); return true;
    }
    function finishBranch(D) {
      const L = D.end ? Math.hypot(D.end[0] - D.v[0], D.end[1] - D.v[1]) : 0;
      if (L < 0.05) { ctx.status("▮ drag out of a side of a corner / a wall's end to draw a new wall from it"); return; }
      const A = AR(), w0 = D.j.walls[0], R0 = D.R, R = P().addRoom(A, [[D.v[0], D.v[1]], [D.end[0], D.end[1]]], { closed: false, z: R0.z, h: R0.h, t: O.wall.t, wall: R0.wall });   // 2.691.0: the last-set thickness
      if (!R) return;
      if (R0.wt && R0.wt[w0] && root.PPWallType) root.PPWallType.assign(A, [{ R, i: 0 }], R0.wt[w0]);   // its wall type too
      P().addJoins(A, R);                                                     // 2.690.0: joined where it starts (and ends)
      done("wall", D.before, { ak: "room", id: R.id }); ctx.status("▮ " + R.name + " drawn out of " + R0.name + "'s " + (D.j.kind === "end" ? "wall end" : "corner") + " - " + fmt(L) + " · its ends drag out more walls the same way");
    }
    // 2.690.0: while anything is dragged, a wall joined to a moved one follows at the join (it grows / shrinks)
    function selectMove(ev) {
      const r = selectMove0(ev), D = st.drag;
      if (D && D.moved && D.base && AR().joins && AR().joins.length) {
        const B = P().clean(JSON.parse(D.base));
        if (P().applyJoins(AR(), B)) { AV().rebuild(); AV().setSel(asel); }
      }
      return r;
    }
    function selectMove0(ev) {
      const D = st.drag;
      if (!D) {
        const ax = axisAt(ev); if (AV() && AV().setAxisHot) AV().setAxisHot(ax ? ax.key : null);   // 2.641.0
        if (!ax && V.canvas.dataset.ppAxis) { V.canvas.style.cursor = ""; delete V.canvas.dataset.ppAxis; }
        if (ax) { V.canvas.style.cursor = "move"; V.canvas.dataset.ppAxis = "1"; ctx.status("📷 drag to move it along " + ax.key.toUpperCase() + (ax.key === "z" ? " (up / down)" : "") + " · 1 cm steps, Shift = free"); return true; }
        const h0 = AV() && AV().pick(ev), hj = h0 && nearerThanModel(ev, h0) ? branchAt(h0) : null;   // 2.662.0: over a corner / an end piece - it lights up
        if (hj) { if (AV().setHover) AV().setHover(null); V.preview({ faces: branchFaces(hj), faceColor: 0xf59e2c, tip: "⤴ drag a new wall out of this side" }); st.jhot = true; V.canvas.style.cursor = "crosshair"; ctx.status("▮ a corner / a wall's end: drag out of a side for a new wall (from its top: any way)"); return false; }
        if (st.jhot) { st.jhot = false; V.preview({}); V.canvas.style.cursor = ""; }
        const h = h0, near = h && nearerThanModel(ev, h), th = near ? topUnder(h) : null;
        AV() && AV().setHover(th ? (th.k >= 0 ? { ak: "wpt", room: th.room, edge: th.edge, k: th.k } : { ak: "wtop", room: th.room, edge: th.edge, k: th.seg }) : near ? AV().resolve(h) : null);   // 2.624.0: a wall's top shows what a press takes
        return false;
      }
      if (!(ev.buttons & 1)) { st.drag = null; V.preview({}); return false; }
      if (!D.moved && Math.hypot(ev.clientX - D.x0, ev.clientY - D.y0) < 4) return true;
      D.moved = true;
      if (D.mode === "ctrlwait") {                                       // 2.688.0: a Ctrl press dragged - the plain press, held to an axis
        st.drag = null; st.ctrlReplay = true;
        try { selectDown(D.ev); } finally { st.ctrlReplay = false; }
        if (!st.drag) return true;
        st.drag.axisLock = true; st.drag.moved = true;
        return selectMove(ev);
      }
      if (D.mode === "endpull") return dragEndPull(ev, D);                // 2.688.0
      if (D.mode === "branch") return dragBranch(ev, D);                  // 2.662.0
      if (D.many) {                                                     // 2.648.0: several picked - moved together (Shift: straight)
        const cur = planeAt(ev, D.z); if (!cur) return true;
        let d = [cur[0] - D.start[0], cur[1] - D.start[1]];
        if (ev.shiftKey || D.axisLock) { if (Math.abs(d[0]) > Math.abs(d[1])) d[1] = 0; else d[0] = 0; }   // 2.688.0: Ctrl+drag too
        const M = ctx.model(); M.arch = P().clean(JSON.parse(D.base)); P().moveMany(M.arch, D.many, d);
        AV().rebuild(); AV().setSel(asel); if (AV().setMore) AV().setMore(amore);
        ctx.status(D.many.length + " picked moved " + fmt(Math.hypot(d[0], d[1])));
        return true;
      }
      if (D.mode === "top") return dragTop(ev, D);
      if (D.mode === "grip") return dragGrip(ev, D);
      if (D.mode === "spin") return dragSpin(ev, D);
      if (D.mode === "axis") return dragAxis(ev, D);
      if (D.t && D.t.ak === "cam" && gizmo !== "move") { gizmo = "move"; AV().setGizmo(gizmo); }     // 2.641.0: a camera dragged = the move widget
      const cur = planeAt(ev, D.z); if (!cur && !D.wp) return true;     // 2.625.0: a door / window drags on its wall's face
      if (D.mode === "edge") return dragEdge(ev, D, cur);
      let d = cur ? [cur[0] - D.start[0], cur[1] - D.start[1]] : [0, 0];
      if (ev.shiftKey || D.axisLock) { if (Math.abs(d[0]) > Math.abs(d[1])) d[1] = 0; else d[0] = 0; }   // 2.688.0: Ctrl+drag too
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
      else if (t.ak === "slab" || t.ak === "pool") { x.pts = x.pts.map((p) => [p[0] + d[0], p[1] + d[1]]); }   // 2.657.0: + a pool
      else if (t.ak === "drive") { x.nodes.forEach((n) => { n.p = [n.p[0] + d[0], n.p[1] + d[1]]; }); }   // 2.659.0: a driveway
      else if (t.ak === "road") { x.nodes.forEach((n) => { n.p = [n.p[0] + d[0], n.p[1] + d[1]]; }); }   // 2.673.0: a road (⛏ Grade again in its panel)
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
      if (through && D.t.ak === "cam" && through.id === o.id) lookThrough(o, true);
      return true;
    }
    /** 2.641.0: a camera dragged by a move arrow - along that axis (1 cm steps, Shift free) */
    function dragAxis(ev, D) {
      let d;
      if (D.scr) d = ((ev.clientX - D.x0) * D.scr.ux + (ev.clientY - D.y0) * D.scr.uy) / D.scr.ppm;   // 2.643.0: through it - along the arrow on screen
      else { const r = V.ray(ev), cl = G().linesClosest(D.p0, D.dir, r.o, r.d); d = (cl.point[0] - D.p0[0]) * D.dir[0] + (cl.point[1] - D.p0[1]) * D.dir[1] + (cl.point[2] - D.p0[2]) * D.dir[2] - D.s0; }
      if (!Number.isFinite(d)) return true;
      d = ev.shiftKey ? Math.round(d * 1000) / 1000 : Math.round(d * 100) / 100;
      const M = ctx.model(); M.arch = P().clean(JSON.parse(D.base)); const o = P().find(M.arch, "cam", D.t.id); if (!o) return true;
      const k = { x: "x", y: "y", z: "z" }[D.key]; o[k] = Math.round((o[k] + d) * 1000) / 1000;
      ctx.status("📷 " + o.name + " · " + D.key.toUpperCase() + " " + (d >= 0 ? "+" : "−") + fmt(Math.abs(d)) + " (1 cm steps - Shift: free)");
      AV().rebuild(); AV().setSel(D.t);
      if (through && through.id === o.id) lookThrough(o, true);
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
      if (D.mode === "ctrlwait") {                                       // 2.688.0: not moved = the Ctrl+click (2.648.0)
        st.ctrlReplay = true; const e2 = Object.assign({}, D.ev, { ctrlKey: true });
        try { selectDown(e2); } finally { st.ctrlReplay = false; }
        st.drag = null; return true;
      }
      if (D.mode === "endpull") {
        if (D.moved) { ctx.commit("wall end", D.before); props(); }
        else ctx.status("⇔ push / pull armed - drag the wall's end along the wall (1 cm steps, Shift: free) · Esc or a click elsewhere ends it");
        return true;
      }
      if (D.mode === "branch") {
        if (D.moved) finishBranch(D);
        // 2.688.0 (Tim: "if user clicks on an end segment of a wall treat it as the whole wall"): a click on a wall's END piece
        // picks that wall (its panel has ▪ This end's width…); a corner is still its own piece (2.664.0)
        else if (D.j.kind === "end") { setSel({ ak: "room", id: D.R.id, part: "wall", edge: D.j.walls[0] }); ctx.status("▮ the whole wall picked · double-click its end to push / pull it · drag out of the end's side for a new wall"); }
        else { setSel({ ak: "joint", room: D.R.id, k: D.j.k }); ctx.status("▪ a corner picked - its width in the panel · drag out of a side for a new wall"); }
        return true;
      }   // 2.662.0 / 2.664.0: a click picks it
      if (D.many && !D.moved && D.single) { setMore([]); setSel(D.single); return true; }   // 2.648.0: a click on one of several = that one
      if (D.moved) { ctx.commit(D.mode === "top" ? "wall top" : D.mode === "grip" ? "resize" : D.mode === "spin" ? "turn" : "move", D.before); props(); }
      else if (D.t && D.t.ak === "cam" && D.mode !== "axis" && D.mode !== "spin") ctx.status("📷 " + ((P().find(AR(), "cam", D.t.id) || {}).name || "camera") + " · drag it or an arrow to move it · double-click = rotate rings" + (gizmo === "rotate" ? " (now: rotate - double-click again for the arrows)" : ""));
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
      if (D.free) {                                                                     // 2.639.0: Alt - free
        const v = [cur[0] - D.start[0], cur[1] - D.start[1]];
        if (!ev.shiftKey) { const g = 0.05; v[0] = Math.round(v[0] / g) * g; v[1] = Math.round(v[1] / g) * g; }
        const k = Math.hypot(v[0], v[1]) > 1e-6 ? P().openEnds(A, R.id, D.t.edge) : D.t.edge;   // 2.663.0: a split piece - new walls join it
        P().moveEdgeBy(A, R.id, k, v); asel = Object.assign({}, D.t, { edge: k });
        AV().rebuild(); AV().setSel(asel);
        ctx.status("▮ " + R.name + "'s wall moved freely " + fmt(Math.hypot(v[0], v[1])) + " (Alt) · 5 cm steps, Shift = free steps");
        return true;
      }
      const out = [e.u[1], -e.u[0]], tol = ev.shiftKey ? 0 : pxTol(cur), off = O.room.off || 0;
      const sn = P().snapEdge(A, R.id, D.t.edge, (cur[0] - D.start[0]) * out[0] + (cur[1] - D.start[1]) * out[1], tol, off);
      const k = Math.abs(sn.dist) > 1e-6 ? P().openEnds(A, R.id, D.t.edge) : D.t.edge;   // 2.663.0: a split piece moved - a new wall each side joins it to the room
      P().moveEdge(A, R.id, k, sn.dist); asel = Object.assign({}, D.t, { edge: k });
      AV().rebuild(); AV().setSel(asel);
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
      // 2.641.0 (Tim: "double click changes to 3d rotate widget"): on a camera / its arrows / its rings - move <-> rotate
      const hc = AV() && AV().pick(ev), onCam = hc && hc.tag.ak === "cam" ? hc.tag : asel && asel.ak === "cam" && (axisAt(ev) || ringAt(ev)) ? asel : null;
      if (onCam) {
        const same = asel && asel.ak === "cam" && asel.id === onCam.id;
        if (!same) setSel({ ak: "cam", id: onCam.id });
        gizmo = gizmo === "rotate" ? "move" : "rotate"; AV().setGizmo(gizmo);
        ctx.status(gizmo === "rotate" ? "📷 rotate - drag a ring: blue = turn (yaw), red = tilt (pitch), green = roll · double-click = the move arrows" : "📷 move - drag the camera, or an arrow (X / Y / Z) · double-click = the rotate rings");
        props(); return true;
      }
      const h = AV() && AV().pick(ev); if (!h || !nearerThanModel(ev, h) || h.tag.ak !== "wall") return false;
      // 2.688.0: a wall's END piece double-clicked = push / pull from it (not a split)
      const je = branchAt(h);
      if (je && je.kind === "end") {
        st.pull = { room: je.R.id, k: je.k };
        setSel({ ak: "room", id: je.R.id, part: "wall", edge: je.walls[0] });
        ctx.status("⇔ push / pull: drag the end of " + je.R.name + "'s wall " + (je.walls[0] + 1) + " along the wall to make it longer or shorter (1 cm steps, Shift: free) · Esc ends it");
        return true;
      }
      const tol = Math.max(0.12, pxTol(h.point) * 1.2), down = Math.abs(V.ray(ev).d[2]) > 0.85 || !!(AV().planOnNow && AV().planOnNow());   // from above / the floorplan (in 3D a wall's top = a cut, as before)
      // 2.663.0 (Tim: "select segments of the wall after a split(dbl click)"): seen from above / the floorplan, or on the wall's
      // face below its top - the wall split in two there (each piece a wall of its own: picked, dragged, taken out)
      const splitHere = () => {
        const t = AV().resolve(h); if (!t || t.part !== "wall" || t.edge == null) return false;
        const b = before(), A = AR(), k = P().splitWall(A, t.id, t.edge, h.point); if (k < 0) { ctx.status("✂ too near the wall's end to split it there"); return true; }
        const R = P().room(A, t.id); done("split", b, { ak: "room", id: t.id, part: "wall", edge: t.edge });
        ctx.status("✂ " + R.name + "'s wall " + (t.edge + 1) + " split in two - each piece is a wall: pick it, drag it out (new walls join it to the room), Delete takes it out · double-click again to split more");
        return true;
      };
      if (down) return splitHere();
      const th = P().topHit(AR(), [h.point[0] - h.n[0] * 0.02, h.point[1] - h.n[1] * 0.02], h.point[2], tol); if (!th) return splitHere();
      const b = before(), k = P().cutTop(AR(), th.room, th.edge, th.t); if (k < 0) return false;
      done("cut", b, { ak: "wpt", room: th.room, edge: th.edge, k });
      ctx.status("✂ a cut in " + th.R.name + "'s wall - drag it up / down (a slope), Delete takes it away");
      return true;
    }
    function eraseAt(ev) {
      const h = AV() && AV().pick(ev); if (!h || !nearerThanModel(ev, h)) return false;
      const t = AV().resolve(h); if (!t) return false;
      if (t.ak === "room" && t.part === "wall" && t.edge != null && !ev.shiftKey) { takeOut(t.id, t.edge); return true; }   // 2.660.0: one wall (Shift: the room)
      const b = before(); if (P().remove(AR(), t.ak, t.id)) { if (asel && asel.ak === t.ak && asel.id === t.id) asel = null; done("erase", b); ctx.status("⌫ erased the " + nameOf(t)); }
      return true;
    }
    function paintAt(ev, col, pickOnly) {
      const h = AV() && AV().pick(ev); if (!h || !nearerThanModel(ev, h)) return null;
      const A = AR(), tg = h.tag;
      let get, set, paintWhat = "";
      /* 2.651.0 (Tim: "wall_1 interior, wall_1 exterior"): ONE wall's inside / outside - Shift: every wall on that side
         (the room's insides / the building's outsides) */
      if (tg.ak === "wall") {
        const R = tg.room ? P().room(A, tg.room) : null, pin = [h.point[0] - h.n[0] * 0.03, h.point[1] - h.n[1] * 0.03];
        if (R) { let bi = 0, bd = Infinity; P().edgesOf(R).forEach((e) => { const d = P().segDist([h.point[0], h.point[1]], e.a, e.b).d; if (d < bd) { bd = d; bi = e.i; } });
          if (ev.shiftKey) { get = () => R.wall; set = (c) => { R.wall = c; R.wcol = {}; }; } else { get = () => P().wallCol(R, bi); set = (c) => { R.wcol = Object.assign({}, R.wcol || {}); R.wcol[bi] = c; }; }
          paintWhat = ev.shiftKey ? R.name + "'s walls (inside)" : R.name + "'s wall " + (bi + 1) + " (inside)"; }
        else { const w = P().wallOwner(A, pin, h.point[2]);
          if (ev.shiftKey || !w) { get = () => A.ext; set = (c) => { A.ext = c; A.rooms.forEach((Q) => { Q.wext = {}; }); }; paintWhat = "every outside wall"; }
          else { get = () => P().wallExt(A, w.R, w.i); set = (c) => { w.R.wext = Object.assign({}, w.R.wext || {}); w.R.wext[w.i] = c; }; paintWhat = w.R.name + "'s wall " + (w.i + 1) + " (outside)"; } }
      }
      else if (tg.ak === "room") { const R = P().room(A, tg.id); if (!R) return null; const k = { ceil: "ceilCol", skirt: "skirtCol", cornice: "cornCol" }[tg.part] || "floor"; get = () => R[k]; set = (c) => { R[k] = c; }; }   // 2.640.0: + skirting / cornice
      else { const x = P().find(A, tg.ak, tg.id); if (!x) return null; const k = tg.ak === "op" && tg.part === "glass" ? "glass" : tg.ak === "op" && (tg.part === "frame" || tg.part === "sill") ? "trimCol" : "col"; get = () => x[k]; set = (c) => { x[k] = c; }; }   // 2.640.0: a frame / sill keeps its own   // 2.651.0: + its glass
      if (pickOnly) return get();
      const b = before(); set(col); done("paint", b);
      ctx.status("🪣 " + (tg.ak === "wall" ? paintWhat + (ev.shiftKey ? "" : " · Shift+click: every wall on that side") : tg.ak === "op" && tg.part === "glass" ? "the glass" : tg.ak === "room" ? ({ ceil: "the ceiling", skirt: "the skirting", cornice: "the cornice" }[tg.part] || "the floor") : "the " + nameOf({ ak: tg.ak })) + " painted");
      return col;
    }
    /** 2.660.0: one wall out of its room (and the wall of the room beside on the same line - the two rooms open into each other) */
    function takeOut(id, i) {
      const b = before(), A = AR(), L = P().removeWall(A, id, i, true); if (!L) return false;
      if (asel && asel.ak === "room" && asel.part === "wall" && L.some((w) => w.R.id === asel.id && w.i === asel.edge)) asel = { ak: "room", id: asel.id };   // its panel: the room's
      done("erase", b, asel); const R = L[0].R;
      ctx.status("⌫ Wall " + (i + 1) + " taken out of " + R.name + (L.length > 1 ? " (and " + L.slice(1).map((w) => w.R.name + "'s wall " + (w.i + 1)).join(", ") + " on the same line)" : "") + " - the room's panel puts it back · Shift+Eraser = the whole room");
      return true;
    }
    function eraseSel() {
      if (!asel) return;
      if (amore.length) {                                               // 2.648.0: several picked - all of them, one undo step
        const b = before(), A = AR(), list = picked(); let n = 0;
        list.forEach((t) => {
          if (t.ak === "room" && t.part) { const R = P().room(A, t.id); if (!R) return; const key = { floor: "floorOn", ceil: "ceilOn", skirt: "skirtOn", cornice: "corniceOn", slab: "slab" }[t.part]; if (key) { R[key] = false; n++; } else if (t.part === "wall" && t.edge != null) { if (P().removeWall(A, R.id, t.edge, true)) n++; } return; }
          if (t.ak === "wpt" || t.ak === "wtop") return;
          if (P().remove(A, t.ak, t.id)) n++;
        });
        amore = []; asel = null; if (AV() && AV().setMore) AV().setMore([]);
        done("erase", b, null); ctx.status("⌫ erased " + n + " picked"); return;
      }
      const b = before(), t = asel;
      if (t.ak === "joint") { if (P().setJoint(AR(), t.room, t.k, { w: null, l: null })) { done("joint", b, t); ctx.status("▪ back to the wall's own size"); } return; }   // 2.664.0
      if (t.ak === "wpt" || t.ak === "wtop") {                          // 2.624.0: Delete on a cut / a top edge
        const ok = t.ak === "wpt" ? P().removeTopPoint(AR(), t.room, t.edge, t.k) : P().removeTopSeg(AR(), t.room, t.edge, t.k);
        if (ok) { asel = null; done("erase", b, null); ctx.status(t.ak === "wpt" ? "⌫ the cut is gone" : "⌫ that top edge is straight again"); }
        return;
      }
      if (t.ak === "room" && t.part) {                                  // 2.640.0: a part: off (a wall: hidden) - the room stays
        const R = P().room(AR(), t.id); if (!R) return;
        const key = { floor: "floorOn", ceil: "ceilOn", skirt: "skirtOn", cornice: "corniceOn", slab: "slab" }[t.part];
        if (key) { R[key] = false; done("erase", b, { ak: "room", id: R.id }); ctx.status("⌫ " + R.name + "'s " + ({ floor: "floor", ceil: "ceiling", skirt: "skirting", cornice: "cornice", slab: "floor slab" }[t.part]) + " off - its room's panel turns it on again"); return; }
        if (t.part === "wall" && t.edge != null) { takeOut(R.id, t.edge); return; }   // 2.660.0: taken out (it was hidden - 👁 still hides one)
      }
      if (P().remove(AR(), t.ak, t.id)) { asel = null; done("erase", b, null); ctx.status("⌫ erased the " + nameOf(t)); }
    }
    /* 2.629.0: 📷 a camera's view / pictures / 360° location */
    /** 👁 the view from a camera - its place, its way, its lens (2.631.0: and nothing of the camera itself in the way); the first
        orbit / pan / zoom leaves it (the lens as it was, the cameras shown again) */
    function lookThrough(c, quiet) {
      if (!c) return;
      if (ctx.leavePlan) ctx.leavePlan();                                 // 2.647.0: a camera's view ends the 📐 floorplan
      const d = root.PPCam.dir(c); if (V.isOrtho) V.ortho(false);
      const cam = V.cam();
      if (!through) through = { fov: cam.fov };
      through.id = c.id;
      cam.fov = c.fov || 60; cam.updateProjectionMatrix();
      if (AV() && AV().setThrough) AV().setThrough(c.id);              // 2.643.0: its widget drawn ahead of the eye
      cam.position.set(c.x, c.y, c.z); V.controls.target.set(c.x + d[0] * 2, c.y + d[1] * 2, c.z + d[2] * 2); V.controls.update();
      if (c.roll) cam.rotateZ(-(c.roll * Math.PI / 180));               // 2.633.0: its roll (right-handed about the way it looks)
      if (AV() && AV().camsShown) AV().camsShown(false);
      V.draw();
      if (!quiet) ctx.status("👁 the view from " + c.name + " - orbit / pan / zoom to leave it · ✥ Move / ⟳ Rotate in its panel: its widget in front of you");
      if (ctx.onThrough) ctx.onThrough(c.id);
    }
    function leaveThrough() {
      if (!through) return;
      const cam = V.cam(); cam.fov = through.fov; cam.updateProjectionMatrix(); through = null;
      if (AV() && AV().setThrough) AV().setThrough(null);
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
    function nameOf(t) { const x = t.id != null ? P().find(AR(), t.ak, t.id) : null; return { room: x ? x.name : "room", op: x ? (x.kind === "opening" ? "opening" : x.kind) : "door / window", light: "light", roof: "roof", stair: "stairs", slab: "floor", cam: x ? x.name : "camera", item: x && t.ak === "item" && root.PPFurn ? String(root.PPFurn.label(x) || "piece").toLowerCase() : "piece" }[t.ak] || t.ak; }
    const sameTag = (a, b) => !!(a && b && a.ak === b.ak && a.id === b.id && (a.part || null) === (b.part || null) && (a.edge == null ? null : a.edge) === (b.edge == null ? null : b.edge) && (a.room == null ? null : a.room) === (b.room == null ? null : b.room));
    const picked = () => (asel ? [asel] : []).concat(amore);
    function setMore(list) { amore = list || []; if (AV() && AV().setMore) AV().setMore(amore); }
    function setSel(t, quiet) {
      if (!t && amore.length) setMore([]);                             // nothing picked = none of the others either
      const same = !!(asel && t && asel.ak === t.ak && asel.id === t.id);
      if (!same) gizmo = "move";                                        // 2.641.0: another thing picked = the camera's widget back to move
      if (AV() && AV().setGizmo && AV().gizmo !== gizmo) AV().setGizmo(gizmo);
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
      const x = asel && A ? (asel.ak === "wpt" || asel.ak === "wtop" || asel.ak === "joint" ? P().room(A, asel.room) : P().find(A, asel.ak, asel.id)) : null;
      if (asel && !x) asel = null;
      const ED = ctx.edit ? ctx.edit() : null, edit = !tool && !x && ED && ED.wants();     // 2.625.0: a face / edges / a corner of the model
      if (!tool && !x && !edit && ctx.otherPanel && ctx.otherPanel()) return;   // 2.653.0: the ⛰ Terrain tool's own panel
      if (!tool && !x && !edit) { box.style.display = "none"; ctx.resized && ctx.resized(); return; }
      box.style.display = "block";
      const el = (tag, cls, txt) => { const e = root.document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
      // a narrow docker: the panel folds to a ⚙ tab over the view (it would cover it) - a click opens / closes it
      const tog = el("button", "ghost pptog", box.classList.contains("open") ? "✕" : "⚙ Settings"); tog.type = "button"; tog.title = "The settings (this docker is narrow - ⛶ maximize it for room)";
      tog.onclick = () => { box.classList.toggle("open"); props(); }; box.appendChild(tog);
      const head = (t) => box.appendChild(el("div", "pph", t));
      const lbl = (key, def) => ((AR() && AR().labels) || {})[key] || def;   // 2.667.0: a name given in the objects panel
      const row = (label, input, title) => { const r = el("label", "ppr"); r.appendChild(el("span", "", label)); r.appendChild(input); if (title) r.title = title; box.appendChild(r); return input; };
      const tIn = (label, val, on) => { const r = numIn(label, val, (v) => { const m = +tOf(v).toFixed(4); lastT(m); on(m); }, 0.01, 0.02, 2000, "m"); const i = r; if (i) { i.title = "metres - or type millimetres (200 = 0.2 m) · the next walls you draw are this thick too"; i.dataset.wallT = "1"; } return r; };   // 2.691.0
      const numIn = (label, val, on, step, min, max, unit) => { const i = el("input"); i.type = "number"; i.step = step || 0.01; if (min != null) i.min = min; if (max != null) i.max = max; i.value = +(+val).toFixed(3); i.onchange = () => { const v = parseFloat(i.value); if (Number.isFinite(v)) on(Math.min(max != null ? max : Infinity, Math.max(min != null ? min : -Infinity, v))); }; return row(label + (unit ? " (" + unit + ")" : ""), i); };
      const selIn = (label, val, opts, on) => { const s = el("select"); opts.forEach(([v, t]) => { const o = el("option", "", t); o.value = v; if (String(v) === String(val)) o.selected = true; s.appendChild(o); }); s.onchange = () => on(s.value); return row(label, s); };
      const colIn = (label, val, on) => { const i = el("input"); i.type = "color"; i.value = val; i.onchange = () => on(i.value); return row(label, i); };
      /* 2.651.0 (Tim: "material tools ... wall_1 interior, wall_1 exterior, windows, etc, and use reference images for the
         texture"): a material button - a colour, a built-in material or a picture (ppmatpick.js); a new picture joins A.tex */
      const PM = root.PPMatPick;
      const matName = (v) => (typeof v === "string" && v.startsWith("tex:") ? ((AR().tex || []).find((t) => t.id === v.slice(4)) || { name: "picture" }).name
        : typeof v === "string" && v.startsWith("mat:") && root.PPFurn ? ((root.PPFurn.materials().find((m) => "mat:" + m.key === v) || { label: v.slice(4) }).label) : String(v || ""));
      const matIn = (label, val, on) => {
        if (!PM) return colIn(label, colOk(val), on);
        const b = el("button", "ghost ppmatbtn"); b.type = "button"; b.appendChild(PM.swatch(val, 18, AR())); b.appendChild(el("span", "", " " + matName(val)));
        b.title = label + " - a colour, a material (brick, timber, tiles …) or a picture from the 🖼 Refs docker / the project / a file";
        b.onclick = () => PM.open(b, { A: AR(), value: val, title: label,
          onPick: (v, add) => { if (add) AR().tex = (AR().tex || []).concat([add]); on(v); },
          onTex: (id, q) => { const bf = before(), t = (AR().tex || []).find((x) => x.id === id); if (t) Object.assign(t, q); ctx.commit("material", bf); props(); } });
        return row(label, b);
      };
      const chkIn = (label, val, on) => { const i = el("input"); i.type = "checkbox"; i.checked = !!val; i.onchange = () => on(i.checked); return row(label, i); };
      const txtIn = (label, val, on) => { const i = el("input"); i.type = "text"; i.value = val; i.onchange = () => on(i.value.trim().slice(0, 60) || val); return row(label, i); };
      /* 2.666.0 (Tim: "can you add roof options, gable, skilion, hip etc"): the roof's type as pictures + its own settings -
         o = the tool's options or the picked roof, on(key) -> its setter */
      const roofFields = (o, on) => {
        const Q = P(), pick = el("div", "pproofs"); pick.setAttribute("role", "listbox"); pick.setAttribute("aria-label", "Roof type");
        Q.ROOFS.forEach((t) => { const b = el("button", t === o.type ? "on" : ""); b.type = "button"; b.dataset.roof = t; b.title = Q.ROOF_LABELS[t]; b.setAttribute("aria-selected", t === o.type ? "true" : "false");
          try { b.innerHTML = Q.roofIcon(t, 44); } catch (e) { /* no picture */ } b.appendChild(el("span", "", ROOF_SHORT[t] || t)); b.onclick = () => { if (t !== o.type) on("type")(t); }; pick.appendChild(b); });
        box.appendChild(pick);
        selIn("Type", o.type, ROOF_OPTS(), on("type"));
        const two = o.type === "gambrel" || o.type === "mansard";
        if (o.type !== "follow" && o.type !== "flat") numIn(two ? "Upper pitch" : "Pitch", o.pitch, on("pitch"), 1, 0, 75, "°");
        if (two) numIn("Lower pitch", o.pitch2 != null ? o.pitch2 : 60, on("pitch2"), 1, 5, 85, "°");
        if (Q.ROOF_K[o.type] != null) numIn(K_LABEL[o.type], o.k != null ? o.k : Q.ROOF_K[o.type], on("k"), 0.05, 0.05, 0.95, "0 - 1");
        if (o.type === "shed" || o.type === "saltbox") chkIn("Flip - the other side high", !!o.flip, on("flip"));
        numIn(o.type === "follow" ? "Eaves width" : "Overhang", o.over, on("over"), 0.05, 0, 5, "m");
        // 2.668.0 (Tim: "please add eaves and eave styles to sketcher like open eaves, boxed eaves,closed eaves, and facias and
        // gutters"): the eave as pictures (a section through it), the fascia + barge boards, gutters + downpipes
        if (o.type === "follow" || o.type === "flat") return;
        const ev = o.eave || "plain", ep = el("div", "ppeaves"); ep.setAttribute("aria-label", "Eaves");
        EAVE_OPTS.forEach(([t, name, tip]) => { const b = el("button", t === ev ? "on" : ""); b.type = "button"; b.dataset.eave = t; b.title = tip; b.innerHTML = EAVE_SVG[t]; b.appendChild(el("span", "", name)); b.onclick = () => { if (t !== ev) on("eave")(t); }; ep.appendChild(b); });
        box.appendChild(el("div", "pphint", "Eaves")); box.appendChild(ep);
        selIn("Eaves", ev, EAVE_OPTS.map(([t, name]) => [t, name]), on("eave"));
        chkIn("Fascia + barge boards", !!o.fascia, on("fascia"));
        if (o.fascia) numIn("Fascia height", o.fasciaH != null ? o.fasciaH : 0.2, on("fasciaH"), 0.01, 0.05, 0.6, "m");
        // 2.671.0 (Tim: "create an editor for gutter profile in the same way"): the gutter's profile - the built-in ones in the
        // select, every one (yours too) as pictures, ✎ = the profile editor (kind "gutter") like the skirting / cornice
        const GF = root.PPProfile, gNow = o.gutter || "none";
        const gOpts = [["none", "None"]].concat(GF ? GF.presets("gutter").map((p) => [p.id.replace("preset:gutter-", ""), p.name]) : [["quad", "Quad (box)"], ["half", "Half round"]]);
        if (gNow === "custom") { const own = GF && GF.byId(o.gutterP, ((AR() || {}).profiles || []).concat(PL ? PL.list : [])); gOpts.push(["custom", own ? own.name : "Your own profile"]); }
        selIn("Gutters", gNow, gOpts, on("gutter"));
        if (gNow === "none") return;
        const gid = gNow === "custom" ? o.gutterP : "preset:gutter-" + gNow;
        const setG = (id, pp) => on("gutterSet")(!id || id.startsWith("preset:gutter-") ? { gutter: id ? id.replace("preset:gutter-", "") : "quad", gutterP: "" } : { gutter: "custom", gutterP: id, pp });
        const edG = () => PD && PD.open({ kind: "gutter", id: gid, A: AR(), onSave: (pp) => setG(pp.id, pp) });
        if (PU && GF) { const r = el("div", "ppr ppprofrow"); r.appendChild(el("span", "", "Gutter profile")); r.appendChild(PU.dropdown({ kind: "gutter", value: gid, A: AR(), onPick: (id, pp) => setG(id, pp), onEdit: edG })); box.appendChild(r); }
        chkIn("Downpipes", o.downpipes !== false, on("downpipes"));
        if (PD) btns([["✎ Gutter profiles…", edG, "Draw your own gutter's section - lines and curves, like a skirting or cornice"]]);
      };
      const btns = (list) => { const r = el("div", "ppbtns"); list.forEach(([t, fn, tip]) => { const b = el("button", "ghost", t); b.type = "button"; if (tip) b.title = tip; b.onclick = fn; r.appendChild(b); }); box.appendChild(r); };
      const ch = (fn) => (v) => { const b = before(); fn(v); ctx.commit("edit", b); props(); };
      const kel = (val, on) => { const k = P().KELVIN.find((q) => q[1] === val); selIn("Colour", k ? k[1] : "custom", P().KELVIN.map((q) => [q[1], q[2]]).concat([["custom", "Another colour…"]]), (v) => { if (v !== "custom") on(v); else props(); }); colIn("", val, on); };
      const opt = (k) => (v) => { O[tool][k] = v; keepOpt(); props(); };
      /* 2.692.0 (Tim: "is it possible to add framing, wood/steel to australian standards? and flooring solutions like slab, pier,
         raised etc" + "just use the standards don't import anything"): a room's floor system + a door / window's lintel (ppstruct.js) */
      const SS = root.PPStruct, SH = () => P().structH;
      const sizeOpts = SS ? SS.SIZES.map(([D, B]) => [D + "x" + B, D + " × " + B + " mm"]) : [], gradeOpts = SS ? Object.keys(SS.GRADES).map((k) => [k, SS.GRADES[k].label]) : [];
      const sizeOf = (v) => { const [D, B] = String(v).split("x").map(Number); return { D, B }; };
      const verdict = (c, what) => { const d = el("div", "pphint", (c.ok ? "✔ " : "✗ ") + what + " - " + Math.round(c.util * 100) + "% of its limit (deflection " + c.long.toFixed(1) + " of " + c.lim.long.toFixed(1) + " mm" + (c.lim.bounce ? ", bounce " + c.bounce.toFixed(1) + " of " + c.lim.bounce + " mm" : "") + ")");
        d.dataset.ppcheck = c.ok ? "ok" : "no"; d.style.color = c.ok ? "" : "#e0573f"; box.appendChild(d); };
      const structShow = () => { const S0 = SS.cleanStruct(AR().struct); chkIn("🪵 Show framing (walls see-through)", S0.show, ch((v) => { AR().struct = Object.assign(SS.cleanStruct(AR().struct), { show: v }); })); };
      const GUIDE = "A guide check, not a certificate: beam sums from the grade's published strength + stiffness (simply supported; floor 1.5 kPa + a 1.8 kN point load, 1 kN bounce ≤ 2 mm; roof sheet 0.4 / tiles 0.9 kPa). Confirm the sizes against AS 1684 or your supplier's span tables; slabs and footings are your engineer's design (AS 2870).";
      function structRoom(R) {
        if (!SS) return;
        const fs = SS.clean(R.fs), set = (fn) => ch((v) => { const f2 = SS.clean(R.fs); fn(f2, v); R.fs = SS.clean(f2); });
        head("🏗 Floor system");
        selIn("Floor system", fs.type, SS.FLOORS, set((f, v) => { f.type = v; }));
        if (fs.type === "none") { box.appendChild(el("div", "pphint", "Pick a slab or a raised floor to build it under the room.")); return; }
        if (fs.type === "raised") {
          selIn("Joists", fs.joist.D + "x" + fs.joist.B, sizeOpts, set((f, v) => Object.assign(f.joist, sizeOf(v))));
          selIn("Joist grade", fs.joist.grade, gradeOpts, set((f, v) => { f.joist.grade = v; }));
          selIn("Joist spacing", String(fs.joist.at), [["0.3", "300 mm"], ["0.45", "450 mm"], ["0.6", "600 mm"]], set((f, v) => { f.joist.at = +v; }));
          selIn("Bearers", fs.bearer.D + "x" + fs.bearer.B, sizeOpts, set((f, v) => Object.assign(f.bearer, sizeOf(v))));
          selIn("Bearer pieces", String(fs.bearer.n), [["1", "1"], ["2", "2 nailed together"], ["3", "3 nailed together"]], set((f, v) => { f.bearer.n = +v; }));
          selIn("Bearer grade", fs.bearer.grade, gradeOpts, set((f, v) => { f.bearer.grade = v; }));
          numIn("Bearer spacing (the joists' span)", fs.bearer.at, set((f, v) => { f.bearer.at = v; }), 0.1, 0.6, 6, "m");
          selIn("Piers", fs.pier.kind, Object.keys(SS.PIERS).map((k) => [k, SS.PIERS[k].label]), set((f, v) => { f.pier.kind = v; f.pier.w = SS.PIERS[v].w; }));
          numIn("Pier spacing (the bearers' span)", fs.pier.at, set((f, v) => { f.pier.at = v; }), 0.1, 0.6, 5, "m");
          const C = SS.floorChecks(fs);
          verdict(C.joist, "Joists " + C.joist.size); verdict(C.bearer, "Bearers " + C.bearer.size);
          const best = (c) => (c.best ? SS.sizeName(c.best) : "none of the stock sizes - closer spacing");
          box.appendChild(el("div", "pphint", "Smallest that passes: joists " + best(C.joist) + ", bearers " + best(C.bearer) + "."));
          btns([["✔ Size them", ch(() => { const f2 = SS.clean(R.fs), C2 = SS.floorChecks(f2); ["joist", "bearer"].forEach((k) => { const b = C2[k].best; if (b) Object.assign(f2[k], { D: b.D, B: b.B, n: b.n }); }); R.fs = SS.clean(f2); })]]);
        } else {
          selIn("Site class", fs.site, SS.SITES.map((k) => [k, "Class " + k]), set((f, v) => { f.site = v; }));
          numIn(fs.type === "waffle" ? "Topping + pods: pod depth" : "Slab thickness", fs.type === "waffle" ? fs.podH : fs.slab, set((f, v) => { if (f.type === "waffle") f.podH = v; else f.slab = v; }), 0.005, 0.05, 0.6, "m");
          if (fs.type !== "suspended") { numIn("Edge beam width", fs.edgeW, set((f, v) => { f.edgeW = v; }), 0.01, 0.1, 1.5, "m"); if (fs.type !== "waffle") numIn("Edge beam depth", fs.edgeD, set((f, v) => { f.edgeD = v; }), 0.01, 0.1, 2, "m"); }
          if (fs.type === "waffle") { numIn("Rib width", fs.ribW, set((f, v) => { f.ribW = v; }), 0.01, 0.05, 0.5, "m"); numIn("Rib spacing", fs.ribAt, set((f, v) => { f.ribAt = v; }), 0.05, 0.6, 3, "m"); }
          if (fs.type === "raft") numIn("Internal beam spacing", fs.beamAt, set((f, v) => { f.beamAt = v; }), 0.1, 1, 8, "m");
          if (fs.type === "suspended") numIn("Pier spacing", fs.pier.at, set((f, v) => { f.pier.at = v; }), 0.1, 0.6, 5, "m");
        }
        const pl = SS.plan(AR(), R, SH());
        pl.members.forEach((m) => box.appendChild(el("div", "pphint", "• " + m.kind + ": " + m.size + " - " + m.count + (m.len ? ", " + m.len.toFixed(1) + " m" : ""))));
        pl.notes.forEach((t) => { const d = el("div", "pphint", "⚠ " + t); d.dataset.ppnote = "1"; box.appendChild(d); });
        box.appendChild(el("div", "pphint", GUIDE));
        structShow();
      }
      function structOp(op) {
        if (!SS) return;
        const L = SS.lintel(AR(), op, SH());
        if (!L) { box.appendChild(el("div", "pphint", "🪵 No lintel worked out - an inside wall (not carrying the roof here).")); return; }
        head("🪵 Lintel");
        selIn("Lintel", L.auto ? "auto" : L.m.D + "x" + L.m.B, [["auto", "Auto (the smallest that passes)"]].concat(sizeOpts), ch((v) => { op.lint = v === "auto" ? null : SS.cleanLint(Object.assign({}, L.m, sizeOf(v))); }));
        if (!L.auto) { selIn("Lintel pieces", String(L.m.n), [["1", "1"], ["2", "2 nailed together"], ["3", "3 nailed together"]], ch((v) => { op.lint = SS.cleanLint(Object.assign({}, L.m, { n: +v })); }));
          selIn("Lintel grade", L.m.grade, gradeOpts, ch((v) => { op.lint = SS.cleanLint(Object.assign({}, L.m, { grade: v })); })); }
        verdict(L.check, "Lintel " + L.size + " over " + fmt(L.span));
        const S0 = SS.cleanStruct(AR().struct);
        selIn("Roof covering", S0.roof, [["sheet", "Sheet metal"], ["tile", "Tiles"]], ch((v) => { AR().struct = Object.assign(SS.cleanStruct(AR().struct), { roof: v }); }));
        if (L.auto) selIn("Lintel grade (auto)", S0.grade, gradeOpts, ch((v) => { AR().struct = Object.assign(SS.cleanStruct(AR().struct), { grade: v }); }));
        box.appendChild(el("div", "pphint", "Roof load width " + fmt(L.rlw) + " (half the room's depth + the eave) + the wall above. " + GUIDE));
        structShow();
      }
      // 2.640.0: a profile as a picture dropdown (ppprofiledlg.js) - get / set the id on a thing found again by its id
      const PL = root.PPProfileLib, PU = root.PPProfileUI, PD = root.PPProfileDlg;
      const profRow = (label, kind, val, find, key, none) => {
        if (!PU || !root.PPProfile) return null;
        const r = el("div", "ppr ppprofrow"); r.appendChild(el("span", "", label));
        const use = (pp) => { const b = before(), A2 = AR(), o2 = find(A2); if (!o2) return; if (pp) PL.keep(A2, pp); o2[key] = pp ? pp.id : ""; ctx.commit("profile", b); props(); };
        const dd = PU.dropdown({ kind, value: val, A: AR(), none, onPick: (id, pp) => use(id ? pp : null),
          onEdit: () => PD && PD.open({ kind, id: val, A: AR(), onSave: (pp) => use(pp) }) });
        r.appendChild(dd); box.appendChild(r); return dd;
      };
      const colOk = (c) => (/^#[0-9a-f]{6}$/i.test(c || "") ? c : "#888888");      // a material (mat:...) shows as grey here
      const shownIn = (key) => { const A2 = AR(); chkIn("👁 Shown", !(A2.hide || []).includes(key), ch((v) => { const A3 = AR(); A3.hide = (A3.hide || []).filter((k) => k !== key); if (!v) A3.hide.push(key); })); };
      /** 2.640.0: what was clicked inside a room (in the view or the 🗂 outline) - its own panel; false = the room's */
      function partPanel(R, t) {
        const id = R.id, A = AR(), rm = (A2) => P().room(A2, id), room = () => btns([["⌂ " + R.name + "'s settings", () => setSel({ ak: "room", id }), "The whole room (Shift+click picks it in the view)"]]);
        const n = A.rooms.filter((Q) => Q.closed).indexOf(R) + 1;
        if (t.part === "wall" && t.edge != null) {
          const i = t.edge, e = P().edgesOf(R)[i]; if (!e) return false;
          head("▮ " + lbl("room:" + R.id + ":wall:" + i, "Wall " + (i + 1)) + " · " + R.name + " · " + (P().wallKind(AR(), R, i) === "int" ? "interior" : "exterior"));   // 2.660.0
          numIn("Length", e.L, ch((v) => { if (!P().setWallLength(AR(), id, i, v)) ctx.status("▮ that length would turn the room inside out"); }), 0.05, 0.1, 500, "m");
          const prof = P().profile(R, i), flat = prof.length === 2 && Math.abs(prof[0][1] - prof[1][1]) < 1e-6;
          if (flat) numIn("Height", prof[0][1], ch((v) => P().setWallHeight(AR(), id, i, v)), 0.05, 0.05, 50, "m");
          else { numIn("Start height", prof[0][1], ch((v) => P().moveTopPoint(AR(), id, i, 0, v)), 0.05, 0.05, 50, "m"); numIn("End height", prof[prof.length - 1][1], ch((v) => P().moveTopPoint(AR(), id, i, prof.length - 1, v)), 0.05, 0.05, 50, "m"); box.appendChild(el("div", "pphint", "Its top slopes (" + (prof.length - 2) + " cut" + (prof.length === 3 ? "" : "s") + ") - drag its top in the view to change the cuts")); }
          tIn("Thickness (all " + R.name + "'s walls)", R.t, ch((v) => P().setRoom(AR(), id, { t: v })));
          const WT = root.PPWallType;                                      // 2.661.0: its wall type (its layers = its thickness)
          if (WT) {
            const wt = (R.wt && R.wt[i]) || "";
            selIn("Wall type", wt, [["", "None (" + Math.round(R.t * 1000) + " mm)"]].concat(WT.list(AR()).map((T) => [T.id, T.name + " · " + Math.round(WT.total(T) * 1000) + " mm"])), ch((v) => { WT.assign(AR(), [{ R: rm(AR()), i }], v || null); }));
            btns([["🧱 Wall types…", () => { WT.toggle(true); if (wt) WT.pick(wt); }, "The wall types docker: their layers (brick, air gap, frame, insulation, plasterboard …) and thickness"]]);
          }
          if (R.closed) {
            matIn("Inside", P().wallCol(R, i), ch((v) => { const Q = rm(AR()); Q.wcol = Object.assign({}, Q.wcol || {}); Q.wcol[i] = v; }));
            matIn("Outside", P().wallExt(AR(), R, i), ch((v) => { const Q = rm(AR()); Q.wext = Object.assign({}, Q.wext || {}); Q.wext[i] = v; }));   // 2.651.0
            if (R.wcol && R.wcol[i]) btns([["↺ Same as the room's walls", ch(() => { const Q = rm(AR()); delete Q.wcol[i]; })]]);
          } else matIn("Colour", R.wall, ch((v) => { R.wall = v; }));
          // 2.660.0: interior / exterior (auto: a room on both sides = interior) + take this one wall out
          const auto = P().autoKind(AR(), R, i), kin = (R.wkind && R.wkind[i]) || "auto";
          selIn("Interior / exterior", kin, [["auto", "Auto (" + (auto === "int" ? "interior" : "exterior") + ")"], ["int", "Interior"], ["ext", "Exterior"]], ch((v) => { P().setWallKind(AR(), id, i, v); }));
          if (R.wkind && R.wkind[i] === "int") box.appendChild(el("div", "pphint", "Interior: its outside face takes its inside colour (unless it has its own Outside colour)."));
          shownIn("room:" + id + ":wall:" + i);
          const tw = P().twinWalls(AR(), R, i);
          btns([["🗑 Take this wall out", () => takeOut(id, i), "Just this wall - the floor and ceiling stay, the side open" + (tw.length ? " (" + tw.map((w) => w.R.name).join(", ") + "'s wall on the same line too)" : "") + " · Delete · Eraser"]]);
          // 2.688.0: a click on the wall's end piece picks the wall now - its end's own width / length (2.664.0) from here
          const ends = P().joints(R).filter((j) => j.kind === "end" && j.walls[0] === i);
          if (ends.length) btns(ends.map((j) => ["▪ " + (ends.length > 1 ? (j.k === i ? "Start" : "Far") + " end's width…" : "This end's width…"), () => setSel({ ak: "joint", room: id, k: j.k }), "The square piece at the wall's end - its own width / length (a pier) · double-click it on the model to push / pull the wall"]));
          const ops = A.ops.filter((o) => o.room === id && o.edge === i);
          if (ops.length) { box.appendChild(el("div", "pphint", "In this wall:")); btns(ops.map((o) => [(o.kind === "door" ? "🚪 " : o.kind === "window" ? "🪟 " : "▯ ") + (o.kind[0].toUpperCase() + o.kind.slice(1)) + " " + fmt(o.w) + " × " + fmt(o.h), () => setSel({ ak: "op", id: o.id })])); }
          room();
          box.appendChild(el("div", "pphint", "Drag it (Select) across its line - the walls beside it, the floor, ceiling, skirting and cornice follow. Alt+drag = free."));
          return true;
        }
        if (!R.closed) return false;
        if (t.part === "floor") {
          head("▦ Floor " + n + " · " + R.name + " · " + (+P().roomArea(R).toFixed(2)) + " m²");
          chkIn("On", R.floorOn, ch((v) => { rm(AR()).floorOn = v; }));
          matIn("Colour", R.floor, ch((v) => { rm(AR()).floor = v; }));
          numIn("Level", R.z, ch((v) => P().setRoom(AR(), id, { z: v })), 0.05, -100, 1000, "m");
          chkIn("Floor slab under the walls", !!R.slab, ch((v) => { rm(AR()).slab = v; }));
          shownIn("room:" + id + ":floor");
          box.appendChild(el("div", "pphint", "▦ Materials (in the bar) paints it with a material. Drag it (Select) to move the room."));
        } else if (t.part === "ceil") {
          head("⌓ Ceiling " + n + " · " + R.name);
          selIn("Ceiling", !R.ceilOn ? "none" : R.ceil === "follow" ? "follow" : "flat", [["none", "None"], ["flat", "Flat"], ["follow", "Follows the walls' slope"]], ch((v) => { const Q = rm(AR()); Q.ceilOn = v !== "none"; Q.ceil = v === "follow" ? "follow" : "flat"; }));
          matIn("Colour", R.ceilCol, ch((v) => { rm(AR()).ceilCol = v; }));
          numIn("Height (= the walls)", R.h, ch((v) => P().setRoom(AR(), id, { h: v })), 0.05, 0.1, 50, "m");
          shownIn("room:" + id + ":ceil");
          box.appendChild(el("div", "pphint", "⌂ Cut-away (in the bar) hides every ceiling and roof to look in from above."));
        } else if (t.part === "skirt") {
          head("▁ Skirting " + n + " · " + R.name);
          chkIn("On", !!R.skirtOn, ch((v) => { rm(AR()).skirtOn = v; }));
          profRow("Profile", "skirt", R.skirtP, rm, "skirtP");
          numIn("Height", R.skirtH, ch((v) => { rm(AR()).skirtH = v; }), 0.005, 0.02, 0.6, "m");
          matIn("Colour", R.skirtCol || R.trim, ch((v) => { rm(AR()).skirtCol = v; }));
          shownIn("room:" + id + ":skirt");
          btns([["✎ Profiles…", () => PD && PD.open({ kind: "skirt", id: R.skirtP, A: AR(), onSave: (pp) => { const b = before(), A2 = AR(); PL.keep(A2, pp); rm(A2).skirtP = pp.id; ctx.commit("profile", b); props(); } }), "Draw your own skirting profile"]]);
          box.appendChild(el("div", "pphint", "The profile is drawn to the height (its depth stays); it stops at doors and their frames."));
        } else if (t.part === "cornice") {
          head("▔ Cornice " + n + " · " + R.name);
          chkIn("On", !!R.corniceOn, ch((v) => { rm(AR()).corniceOn = v; }));
          profRow("Profile", "cornice", R.cornP, rm, "cornP");
          numIn("Size", R.corniceH, ch((v) => { rm(AR()).corniceH = v; }), 0.005, 0.02, 0.6, "m");
          matIn("Colour", R.cornCol || R.trim, ch((v) => { rm(AR()).cornCol = v; }));
          shownIn("room:" + id + ":cornice");
          btns([["✎ Profiles…", () => PD && PD.open({ kind: "cornice", id: R.cornP, A: AR(), onSave: (pp) => { const b = before(), A2 = AR(); PL.keep(A2, pp); rm(A2).cornP = pp.id; ctx.commit("profile", b); props(); } }), "Draw your own cornice profile"]]);
          if (!R.ceilOn) box.appendChild(el("div", "pphint", "The room has no ceiling - a cornice shows with one."));
          box.appendChild(el("div", "pphint", "The profile is scaled to the size (both ways)."));
        } else if (t.part === "slab") {
          head("▬ Floor slab " + n + " · " + R.name);
          chkIn("On", !!R.slab, ch((v) => { rm(AR()).slab = v; }));
          shownIn("room:" + id + ":slab");
          box.appendChild(el("div", "pphint", "20 cm under the walls' outside."));
        } else return false;
        room();
        return true;
      }
      if (edit) { ED.panel({ box, el, head, row, numIn, selIn, chkIn, btns, refresh: props }); ctx.resized && ctx.resized(); return; }
      if (tool && !(tool === "camera" && x && asel.ak === "cam")) {     // 2.629.0: a camera just placed shows ITS panel (its buttons)
        head({ room: "⌂ Room", wall: "▮ Wall", door: "🚪 Door", window: "🪟 Window", floor: "▦ Floor", ceiling: "⌓ Ceiling", roof: "△ Roof", light: "💡 Light", stairs: "▟ Stairs", furniture: "🛋 Furniture", camera: "📷 Camera" }[tool] + " - the next one");
        const o = O[tool];
        if (tool === "room" || tool === "wall") { numIn("Wall height", o.h, opt("h"), 0.05, 0.1, 50, "m"); tIn("Wall thickness", o.t, () => props()); numIn("Floor level", o.z, opt("z"), 0.05, -100, 1000, "m");
          numIn("Offset from floor edge", o.off || 0, opt("off"), 0.01, -5, 5, "m");      // 2.624.0
          if (tool === "room") { chkIn("Auto roof (the Roof tool's type)", !!o.autoRoof, opt("autoRoof")); chkIn("Auto floor (a slab under the walls)", !!o.autoFloor, opt("autoFloor")); }   // 2.631.0
          if (tool === "room") chkIn("Ceiling", o.ceilOn, opt("ceilOn"));
          if (tool === "room") { numIn("Width", o.w || 0, opt("w"), 0.05, 0, 500, "m"); numIn("Length", o.l || 0, opt("l"), 0.05, 0, 500, "m");   // 2.647.0
            box.appendChild(el("div", "pphint", fixedSize() ? "Width × Length set: one click puts the room there (its corner at the pointer). 0 = draw it with two clicks." : "Width and Length 0: draw the room with two corners - or set both for a room that size in one click.")); }
          box.appendChild(el("div", "pphint", "Drawn along a floor's (J) edge, the wall's outside face sits the offset in from it. Corners snap to floors' edges.")); }
        if (tool === "door") { selIn("Style", o.style, [["single", "Single"], ["double", "Double"], ["sliding", "Sliding glass"], ["glass", "Glass panel"], ["opening", "An opening (no door)"]], opt("style")); numIn("Width", o.w, opt("w"), 0.05, 0.3, 10, "m"); numIn("Height", o.h, opt("h"), 0.05, 0.5, 10, "m"); }
        if (tool === "window") { selIn("Style", o.style, [["single", "Single pane"], ["double", "Two panes"], ["slider", "Sliding"]], opt("style")); numIn("Width", o.w, opt("w"), 0.05, 0.2, 20, "m"); numIn("Height", o.h, opt("h"), 0.05, 0.2, 10, "m"); numIn("Elevation (height from floor)", o.sill, opt("sill"), 0.05, 0, 10, "m"); }
        if (tool === "floor") { numIn("Top at", o.z, opt("z"), 0.05, -100, 1000, "m"); numIn("Thickness", o.th, opt("th"), 0.01, 0.01, 5, "m"); }
        if (tool === "roof") { roofFields(o, (k) => (k === "gutterSet" ? (v) => { if (v.pp && PL) PL.keep(AR(), v.pp); o.gutter = v.gutter; o.gutterP = v.gutterP; keepOpt(); props(); } : opt(k)));
          btns([["△ Roof the whole storey", () => roofAll(), "One roof over every room on the ground floor (or the picked room's floor)"]]); }
        if (tool === "camera") {
          numIn("Eye height", o.eye, opt("eye"), 0.05, 0.1, 20, "m");
          const C0 = root.PPCam;                                         // 2.633.0: the lens presets, focal length, field of view
          if (C0) { selIn("Lens", C0.lensOf(C0.mmOf(o.fov)), C0.LENSES.map((l) => [l[0], l[1]]).concat([["custom", "Custom"]]), (v) => { const L = C0.LENSES.find((l) => l[0] === v); if (L) o.fov = C0.fovOf(L[2]); keepOpt(); props(); });
            numIn("Focal length", C0.mmOf(o.fov), (v) => { o.fov = C0.fovOf(v); keepOpt(); props(); }, 1, 4.4, 2000, "mm"); }
          numIn("Field of view", o.fov, opt("fov"), 1, 3, 140, "°");
        }
        if (tool === "furniture" && root.PPFurn) {                       // 2.628.0: the House builder's library + the project's 3D models
          const F = root.PPFurn, cats = F.categories().concat(root.PPJoinery ? ["Cupboards & shelving"] : [], ["People", "3D models"]);       // 2.630.0: + 🧍 People; 2.689.0: + 🗄
          if (!cats.includes(o.cat)) o.cat = cats[0];
          selIn("Category", o.cat, cats.map((c) => [c, c]), (v) => { o.cat = v; const first = F.pieces().find((p) => p.cat === v); if (first) o.type = first.type; keepOpt(); props(); });
          if (o.cat === "Cupboards & shelving" && root.PPJoinery) {           // 2.689.0: built-in robes, walk-in robes, shelving
            const JJ = root.PPJoinery, L = root.PPJoineryLib;
            if (o.type !== "joinery") o.type = "joinery";
            o.spec = JJ.clean(o.spec || JJ.PRESETS[0].spec);
            const grid = el("div", "ppfurn"); grid.id = "ppJnPick"; grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:3px;margin:4px 0";
            const all = L ? L.all() : JJ.PRESETS;
            all.forEach((t) => { const b = el("button", "ghost" + (t.spec.name === o.spec.name ? " on" : ""), (t.group === "Yours" ? "★ " : "") + t.name); b.type = "button"; b.dataset.tpl = t.id;
              const D = JJ.dims(t.spec); b.title = Math.round(D.w * 1000) + " × " + Math.round(D.d * 1000) + " × " + Math.round(D.h * 1000) + " mm · " + JJ.LAYOUTS[t.spec.layout];
              b.style.cssText = "font-size:11px;padding:2px 4px;text-align:left" + (t.spec.name === o.spec.name ? ";outline:1px solid var(--tiger,#f59e2c)" : "");
              b.onclick = () => { o.spec = JJ.clean(JSON.parse(JSON.stringify(t.spec))); keepOpt(); props(); ctx.status("🗄 " + t.name + " - click against a wall in a room to put it there"); }; grid.appendChild(b); });
            box.appendChild(grid);
            if (L && !L.loaded) L.load().then(() => { if (tool === "furniture" && O.furniture.cat === "Cupboards & shelving") props(); });
            const D = JJ.dims(o.spec);
            box.appendChild(el("div", "pphint", "🗄 " + o.spec.name + " · " + Math.round(D.w * 1000) + " × " + Math.round(D.d * 1000) + " × " + Math.round(D.h * 1000) + " mm · " + JJ.LAYOUTS[o.spec.layout]));
            btns([["🗄 Design / change…", () => { if (!root.PPJoineryDlg) return; root.PPJoineryDlg.open({ spec: o.spec, title: "🗄 Cupboards & shelving - the next one you put down", ok: "Use it", onOK: (sp) => { o.spec = sp; keepOpt(); props(); ctx.status("🗄 " + sp.name + " - click against a wall in a room to put it there"); } }); }, "Change its size, layout, bays, doors, handles, colours - and save it as your own template"]]);
            numIn("Turn (free)", o.rot, (v) => { o.rot = ((Math.round(v) % 360) + 360) % 360; keepOpt(); props(); }, 15, -360, 360, "°");
            box.appendChild(el("div", "pphint", "In a room it goes with its back against the nearest wall, facing in, flush into a corner; outside a room it stands free, turned as set."));
          } else if (o.cat === "People") {
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
      if (amore.length) {                                               // 2.648.0: several picked
        head("➤ " + (amore.length + 1) + " picked");
        const ul = el("div", "pphint", picked().map((t) => "• " + nameOf(t) + (t.part ? " (" + t.part + ")" : "")).join("\n")); ul.style.whiteSpace = "pre-line"; box.appendChild(ul);
        btns([["🗑 Delete them", eraseSel, "Erase every picked part (one undo)"], ["⊡ Zoom to them", () => { if (ctx.zoomPicked) ctx.zoomPicked(); }, "Fill the view with them"]]);
        box.appendChild(el("div", "pphint", "Ctrl+click adds another (a picked one: takes it out) · drag one of them: they all move · a click: only that one · Esc: nothing picked."));
        ctx.resized && ctx.resized(); return;
      }
      if (asel.ak === "joint") {                                         // 2.664.0 (Tim: "when user selects the square edge at the ends of the wall, allow user to set it's width")
        const R = x, J = P().joints(R).find((j) => j.k === asel.k); if (!J) { asel = null; props(); return; }
        const id = R.id, k = asel.k, E = P().edgesOf(R), names = J.walls.map((i) => "Wall " + (i + 1)).join(" + "), tMax = Math.max(...J.walls.map((i) => P().tw(R, i)));
        head("▪ " + (J.kind === "end" ? "End of " : "Corner of ") + names + " · " + R.name);
        numIn(J.kind === "end" ? "Width (across)" : "Width (a pier round the corner)", J.w || tMax, ch((v) => P().setJoint(AR(), id, k, { w: Math.abs(v - tMax) < 1e-6 && J.kind !== "end" ? null : v })), 0.01, 0.02, 5, "m");
        if (J.kind === "end") numIn("Length past the end", J.l, ch((v) => P().setJoint(AR(), id, k, { l: v })), 0.01, 0, 5, "m");
        if (R.jw && R.jw[k]) btns([["↺ As the wall", ch(() => P().setJoint(AR(), id, k, { w: null, l: null })), "Its width / length back to the wall's"]]);
        btns([["▮ " + names, () => setSel({ ak: "room", id, part: "wall", edge: J.walls[0] }), "The wall it ends"], ["⌂ " + R.name + "'s settings", () => setSel({ ak: "room", id }), "The whole room"]]);
        void E; box.appendChild(el("div", "pphint", "Wider than the wall it is a pier. Drag out of one of its sides (Select) for a new wall from it - from its top: any way."));
        ctx.resized && ctx.resized(); return;
      }
      if (asel.ak === "room" && asel.part && partPanel(x, asel)) { ctx.resized && ctx.resized(); return; }
      if (asel.ak === "room") {
        const R = x, rect = R.closed && R.pts.length === 4 && isRect(R);
        head((R.closed ? "⌂ " : "▮ ") + R.name + (R.closed ? " · " + (+P().roomArea(R).toFixed(2)) + " m²" : ""));
        txtIn("Name", R.name, ch((v) => { R.name = v; }));
        // 2.647.0 (Tim: "rooms will have width and length properties"): Width (along its first wall) and Length (across it) -
        // any closed room (a rectangle keeps its corner; another shape is stretched from its box's corner)
        const sz = R.closed ? P().roomSize(R) : null;
        if (sz) { numIn("Width", sz.w, ch((v) => { if (!P().resizeRoom(AR(), R.id, v, P().roomSize(P().room(AR(), R.id)).l)) ctx.status("⌂ that width does not fit"); }), 0.05, 0.3, 500, "m");
          numIn("Length", sz.l, ch((v) => { if (!P().resizeRoom(AR(), R.id, P().roomSize(P().room(AR(), R.id)).w, v)) ctx.status("⌂ that length does not fit"); }), 0.05, 0.3, 500, "m");
          if (!rect) box.appendChild(el("div", "pphint", "Not a rectangle: Width / Length stretch it from the corner of its box (its doors and windows keep their place along the walls).")); }
        numIn("Wall height", R.h, ch((v) => P().setRoom(AR(), R.id, { h: v })), 0.05, 0.1, 50, "m");
        tIn("Wall thickness", R.t, ch((v) => P().setRoom(AR(), R.id, { t: v })));
        numIn("Floor level", R.z, ch((v) => P().setRoom(AR(), R.id, { z: v })), 0.05, -100, 1000, "m");
        matIn(R.closed ? "Walls inside" : "Wall", R.wall, ch((v) => { R.wall = v; }));
        if (R.closed) { matIn("Floor", R.floor, ch((v) => { R.floor = v; })); matIn("Ceiling", R.ceilCol, ch((v) => { R.ceilCol = v; })); chkIn("Has a floor", R.floorOn, ch((v) => { R.floorOn = v; })); selIn("Ceiling", !R.ceilOn ? "none" : R.ceil === "follow" ? "follow" : "flat", [["none", "None"], ["flat", "Flat"], ["follow", "Follows the walls' slope"]], ch((v) => { R.ceilOn = v !== "none"; R.ceil = v === "follow" ? "follow" : "flat"; })); }   // 2.624.0
        if (R.closed) {                                                   // 2.631.0: the auto floor slab + the auto roof for this room
          chkIn("Floor slab under the walls", !!R.slab, ch((v) => { R.slab = v; }));
          structRoom(R);                                                  // 2.692.0: the floor system (piers, bearers, joists / slabs)
          // 2.639.0: skirting / trim at the floor, a cornice under the ceiling
          chkIn("Skirting", !!R.skirtOn, ch((v) => { R.skirtOn = v; })); if (R.skirtOn) { profRow("Skirting profile", "skirt", R.skirtP, (A2) => P().room(A2, R.id), "skirtP"); numIn("Skirting height", R.skirtH, ch((v) => { R.skirtH = v; }), 0.01, 0.02, 0.6, "m"); }
          chkIn("Cornice", !!R.corniceOn, ch((v) => { R.corniceOn = v; })); if (R.corniceOn) { profRow("Cornice profile", "cornice", R.cornP, (A2) => P().room(A2, R.id), "cornP"); numIn("Cornice size", R.corniceH, ch((v) => { R.corniceH = v; }), 0.01, 0.02, 0.6, "m"); }
          if (R.skirtOn || R.corniceOn) matIn("Skirting / cornice", R.skirtCol || R.trim, ch((v) => { R.trim = v; R.skirtCol = v; R.cornCol = v; }));   // 2.640.0: both (each part has its own)
          const own = AR().roofs.find((rf) => rf.rooms.includes(R.id));
          chkIn("Roof", !!own, ch((v) => { const A2 = AR(); if (v && !A2.roofs.some((rf) => rf.rooms.includes(R.id))) P().addRoof(A2, [R.id], roofOpts()); if (!v) A2.roofs.forEach((rf) => { rf.rooms = rf.rooms.filter((q) => q !== R.id); }), A2.roofs = A2.roofs.filter((rf) => rf.rooms.length); }));
        }
        if (R.gone && R.gone.length) btns([["↺ Put back " + (R.gone.length === 1 ? "wall " + (R.gone[0] + 1) : "its " + R.gone.length + " walls taken out"), ch(() => P().restoreWalls(AR(), R.id)), "The walls taken out of this room (Wall " + R.gone.map((k) => k + 1).join(", ") + ")"]]);   // 2.660.0
        matIn("Outside walls (all)", AR().ext, ch((v) => { const A2 = AR(); A2.ext = v; A2.rooms.forEach((Q) => { Q.wext = {}; }); }));   // 2.651.0: every wall's own outside too
        btns([["⟳ 90°", ch(() => P().rotateRoom(AR(), R.id, 90)), "Turn it a quarter round its middle"], ["⧉ Duplicate", () => dupRoom(R.id), "A copy beside it, sharing its wall"],
          ["△ Roof", () => { const b = before(); const rf = P().addRoof(AR(), [R.id], roofOpts()); done("roof", b, { ak: "roof", id: rf.id }); }, "A roof over this room"], ["🗑 Delete", eraseSel, "Delete (its doors, windows and lights too)"]]);
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
        if (op.kind !== "opening") matIn(op.kind === "door" ? "Door" : "Frame", op.col, ch((v) => { op.col = v; }));
        if (op.kind === "window" || op.style === "glass" || op.style === "sliding") matIn("Glass", op.glass || "#9ec5e8", ch((v) => { op.glass = v; }));   // 2.651.0
        if (op.kind === "door") chkIn("Handle on the other side", op.flip, ch((v) => { op.flip = v; }));
        if (op.kind !== "opening") {                                     // 2.640.0: its frame (architrave) + a window's sill, as profiles
          const findOp = (A2) => A2.ops.find((q) => q.id === op.id);
          profRow(op.kind === "door" ? "Door frame" : "Window frame", op.kind === "door" ? "doorframe" : "windowframe", op.frameP, findOp, "frameP", true);
          if (op.kind === "window") profRow("Window sill", "sill", op.sillP, findOp, "sillP", true);
          if (op.frameP || op.sillP) matIn(op.kind === "door" ? "Frame colour" : "Frame / sill colour", op.trimCol, ch((v) => { op.trimCol = v; }));
        }
        if (op.kind !== "opening") {                                     // 2.631.0: how far it is open, which way
          numIn("Open", op.open || 0, ch((v) => { op.open = Math.max(0, Math.min(100, Math.round(v))); }), 5, 0, 100, "%");
          const sliding = op.style === "sliding" || op.style === "slider";
          chkIn(sliding ? "The other pane slides" : op.kind === "door" ? "Opens outward" : "Opens inward", !!op.dir, ch((v) => { op.dir = v; }));
        }
        structOp(op);                                                     // 2.692.0: its lintel
        btns([["🗑 Delete", eraseSel]]);
        box.appendChild(el("div", "pphint", "Drag it (Select) along its wall, onto another wall" + (op.kind !== "door" ? ", or up / down (its elevation)" : "") + ". Drag a grip (the small squares on its sides, top" + (op.kind !== "door" ? " and bottom" : "") + ") to resize it."));
      } else if (asel.ak === "light") {
        const L = x, def = P().LIGHTS[L.type];
        head("💡 " + lbl("light:" + asel.id, def.label));
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
        head("△ " + lbl("roof:" + rf.id, "Roof") + " · " + rf.rooms.length + " room" + (rf.rooms.length > 1 ? "s" : ""));
        roofFields(rf, (k) => ch((v) => { if (k === "gutterSet") { if (v.pp && PL) PL.keep(AR(), v.pp); rf.gutter = v.gutter; rf.gutterP = v.gutterP; } else rf[k] = v; }));   // 2.671.0: + the gutter's profile
        numIn("Thickness", rf.th, ch((v) => { rf.th = v; }), 0.01, 0.02, 2, "m");
        selIn("Ridge", rf.ridge, [["auto", "Along the long side"], ["u", "Along the first wall"], ["v", "Across the first wall"]], ch((v) => { rf.ridge = v; }));
        matIn("Colour", rf.col, ch((v) => { rf.col = v; }));
        if (rf.fascia || (rf.eave && rf.eave !== "plain")) matIn("Fascia / soffit colour", rf.trimCol, ch((v) => { rf.trimCol = v; }));   // 2.668.0
        if (rf.gutter && rf.gutter !== "none") matIn("Gutter colour", rf.gutterCol, ch((v) => { rf.gutterCol = v; }));
        btns([["△ Over the whole storey", ch(() => { const R0 = P().room(AR(), rf.rooms[0]); rf.rooms = P().level(AR(), R0 ? R0.z : 0); }), "Every room on its floor under this roof"], ["🗑 Delete", eraseSel]]);
      } else if (asel.ak === "stair") {
        const s = x; head("▟ " + lbl("stair:" + s.id, "Stairs") + " · " + Math.max(2, Math.round(s.rise / 0.18)) + " steps");
        numIn("Width", s.w, ch((v) => { s.w = v; }), 0.05, 0.3, 10, "m"); numIn("Length", s.len, ch((v) => { s.len = v; }), 0.05, 0.3, 50, "m"); numIn("Height (up)", s.rise, ch((v) => { s.rise = v; }), 0.05, 0.1, 20, "m");
        numIn("Starts at", s.z, ch((v) => { s.z = v; }), 0.05, -100, 1000, "m"); matIn("Colour", s.col, ch((v) => { s.col = v; }));
        btns([["⟳ 90°", ch(() => { s.ang += 90; })], ["🗑 Delete", eraseSel]]);
      } else if (asel.ak === "cam" && root.PPCam) {                      // 2.629.0: 📷 a camera
        const c = x; head("📷 " + c.name);
        if (through && through.id === c.id) lookThrough(c, true);       // 2.631.0: looking through it - its new turn / tilt / lens / place shown
        txtIn("Name", c.name, ch((v) => { c.name = v; }));
        numIn("Eye height", Math.round((c.z - floorAt(AR(), [c.x, c.y])) * 1000) / 1000, ch((v) => { c.z = floorAt(AR(), [c.x, c.y]) + v; }), 0.05, 0.05, 50, "m");
        numIn("Turn (yaw)", c.yaw, ch((v) => { c.yaw = ((v % 360) + 360) % 360; }), 5, -720, 720, "°"); numIn("Tilt (pitch)", c.pitch, ch((v) => { c.pitch = Math.max(-89, Math.min(89, v)); }), 2, -89, 89, "°");
        numIn("Roll", c.roll || 0, ch((v) => { c.roll = Math.max(-180, Math.min(180, v)); }), 5, -180, 180, "°");      // 2.633.0
        const C0 = root.PPCam, mm = C0.mmOf(c.fov);
        selIn("Lens", C0.lensOf(mm), C0.LENSES.map((l) => [l[0], l[1]]).concat([["custom", "Custom"]]), ch((v) => { const L = C0.LENSES.find((l) => l[0] === v); if (L) c.fov = C0.fovOf(L[2]); }));
        numIn("Focal length", mm, ch((v) => { c.fov = C0.fovOf(v); }), 1, 4.4, 2000, "mm");
        numIn("Field of view", c.fov, ch((v) => { c.fov = Math.max(3, Math.min(140, v)); }), 1, 3, 140, "°");
        const sz = el("select"); [["1920x1080", "1920 × 1080"], ["1280x720", "1280 × 720"], ["1080x1920", "1080 × 1920 (upright)"], ["1024x1024", "1024 × 1024"]].forEach(([v, t]) => { const q = el("option", "", t); q.value = v; sz.appendChild(q); }); sz.value = O.camera.size || "1920x1080"; sz.onchange = () => { O.camera.size = sz.value; keepOpt(); }; row("Shot size", sz);
        btns([["✥ Move" + (gizmo === "move" ? " ✓" : ""), () => { gizmo = "move"; AV().setGizmo(gizmo); props(); }, "The move arrows (X / Y / Z) - or double-click the camera"], ["⟳ Rotate" + (gizmo === "rotate" ? " ✓" : ""), () => { gizmo = "rotate"; AV().setGizmo(gizmo); props(); }, "The rotate rings (turn / tilt / roll) - or double-click the camera"]]);
        btns([["👁 Look through", () => lookThrough(c)], ["📷 Shot + depth + normal", () => camShots(c)], ["📍 360° location", () => camLocation(c)], ["🗑 Delete", eraseSel]]);
        box.appendChild(el("div", "pphint", "📷 the shot (the photo look) + its depth and normal maps go to the Image assets; 📍 a 360° panorama from it becomes a Location (its @tag, the prompt's location)."));
      } else if (asel.ak === "item" && root.PPFurn) {                    // 2.628.0: a piece of furniture
        const it = x; head((it.type === "person" ? "🧍 " : it.type === "joinery" ? "🗄 " : "🛋 ") + root.PPFurn.label(it));
        if (it.type === "joinery" && root.PPJoinery) {                    // 2.689.0: a cupboard - its design, the dialog
          const JJ = root.PPJoinery, sp = it.spec, chs = (fn) => ch((v) => { fn(v); JJ.apply(it, it.spec); });
          box.appendChild(el("div", "pphint", JJ.LAYOUTS[sp.layout] + " · " + JJ.DOORS[sp.doors] + " · " + sp.runs.reduce((a, r) => a + r.bays.length, 0) + " bays"));
          numIn("Width", sp.w, chs((v) => { sp.w = v; }), 0.05, 0.3, 12, "m");
          numIn(sp.layout === "run" ? "Depth" : "Robe depth", sp.layout === "run" ? sp.d : sp.side, chs((v) => { if (sp.layout === "run") sp.d = v; else sp.side = v; }), 0.05, 0.15, 12, "m");
          numIn("Height", sp.h, chs((v) => { sp.h = v; }), 0.05, 0.3, 4, "m");
          if (sp.doors !== "none") chkIn("Doors in 3D", sp.showDoors, chs((v) => { sp.showDoors = v; }));
          btns([["✎ Design…", () => { if (!root.PPJoineryDlg) return; root.PPJoineryDlg.open({ spec: it.spec, title: "🗄 " + JJ.label(it), ok: "Apply", onOK: (s2) => { const b = before(); JJ.apply(it, s2); done("cupboard", b, { ak: "item", id: it.id }); } }); }, "Its bays, doors, handles, colours, sizes - and 💾 save it as a template"],
            ["↔ Fit the wall", ch(() => fitWall(it)), "As wide as the wall it stands against (a walk-in robe: as deep as the room too), against it"]]);
        }
        if (it.type === "joinery") { /* its own panel above */ } else if (it.type === "person") {                                       // 2.630.0: a person - name, pose, height
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
        numIn("Top at", s.z, ch((v) => { s.z = v; }), 0.05, -100, 1000, "m"); numIn("Thickness", s.th, ch((v) => { s.th = v; }), 0.01, 0.01, 5, "m"); matIn("Colour", s.col, ch((v) => { s.col = v; }));
        btns([["🗑 Delete", eraseSel]]);
      } else if (asel.ak === "pool" && root.PPSite) {                      // 2.657.0: 🏊 its own panel (ppsite.js)
        root.PPSite.panel({ head, numIn, selIn, chkIn, matIn, colIn, btns, ch, erase: eraseSel, hint: (t) => box.appendChild(el("div", "pphint", t)) }, x);
      } else if (asel.ak === "drive" && root.PPSite) {                     // 2.659.0: 🛣
        root.PPSite.panelDrive({ head, numIn, selIn, chkIn, matIn, colIn, btns, ch, erase: eraseSel, hint: (t) => box.appendChild(el("div", "pphint", t)) }, x);
      } else if (asel.ak === "road" && root.PPRoads) {                     // 2.673.0: 🛤
        root.PPRoads.panel({ head, numIn, selIn, chkIn, matIn, colIn, btns, ch, txtIn, erase: eraseSel, hint: (t) => box.appendChild(el("div", "pphint", t)) }, x, AR());
      }
      ctx.resized && ctx.resized();
    }
    function ROOF_OPTS() { return P().ROOFS.map((r) => [r, P().ROOF_LABELS[r] || r]); }   // 2.666.0: the names people use (Skillion ...)
    const EAVE_OPTS = [["plain", "Simple", "Simple - just the roof's overhang"], ["open", "Open", "Open eaves - the rafter tails show under the overhang"], ["boxed", "Boxed", "Boxed eaves - a flat soffit from the fascia back to the wall"], ["closed", "Closed", "Closed eaves - a lining fixed under the rafters, on the roof's slope"]];
    const EAVE_SVG = (() => {   // a section through the eave: the wall, the roof, (rafters / soffit / fascia)
      const wrap = (inner) => '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="32" viewBox="0 0 44 32"><rect x="26" y="14" width="8" height="18" fill="#d9d2c3" stroke="#2a2622" stroke-width=".6"/><path d="M4 16 L40 4 L40 7 L4 19 Z" fill="#c26b4a" stroke="#2a2622" stroke-width=".6"/>' + inner + "</svg>";
      return { plain: wrap(""), open: wrap('<path d="M6 19 L26 12.3 M12 17 L26 13.3 M18 15 L26 12.3" stroke="#9c7650" stroke-width="2"/>'),
        boxed: wrap('<rect x="4" y="16" width="2.4" height="7" fill="#f2efe8" stroke="#2a2622" stroke-width=".5"/><rect x="4" y="22" width="22" height="1.6" fill="#f2efe8" stroke="#2a2622" stroke-width=".5"/>'),
        closed: wrap('<rect x="4" y="16" width="2.4" height="6" fill="#f2efe8" stroke="#2a2622" stroke-width=".5"/><path d="M6.4 20.2 L26 13.7 L26 15.3 L6.4 21.8 Z" fill="#f2efe8" stroke="#2a2622" stroke-width=".5"/>') };
    })();
    const ROOF_SHORT = { gable: "Gable", hip: "Hip", shed: "Skillion", dutch: "Dutch gable", jerkin: "Clipped gable", gambrel: "Gambrel", mansard: "Mansard", saltbox: "Saltbox", pyramid: "Pyramid", butterfly: "Butterfly", flat: "Flat", follow: "Follow walls" };
    const K_LABEL = { dutch: "Hip part of the rise", jerkin: "Clipped part of the rise", gambrel: "Break - in from the walls", mansard: "Break - in from the walls", saltbox: "Ridge - from the front" };
    /** the Roof tool's options for a new roof (2.666.0: + its proportion, lower pitch, flip) */
    function roofOpts() { const r = O.roof; return { type: r.type, pitch: r.pitch, over: r.over, k: r.k != null && P().ROOF_K[r.type] != null ? r.k : null, pitch2: r.pitch2 != null ? r.pitch2 : 60, flip: !!r.flip,
      eave: r.eave || "boxed", fascia: r.fascia !== false, fasciaH: r.fasciaH != null ? r.fasciaH : 0.2, gutter: r.gutter || "quad", gutterP: r.gutterP || "", downpipes: r.downpipes !== false }; }   // 2.668.0: a new roof: boxed eaves, fascia, quad gutters
    function isRect(R) { const e = P().edgesOf(R); return e.length === 4 && e.every((a, i) => Math.abs(a.u[0] * e[(i + 1) % 4].u[0] + a.u[1] * e[(i + 1) % 4].u[1]) < 1e-6); }
    function dupRoom(id) {
      const A = AR(), R = P().room(A, id); if (!R) return;
      const e = P().edgesOf(R)[0], b = before(), C = P().duplicateRoom(A, id, [e.u[0] * e.L, e.u[1] * e.L]);
      done("duplicate", b, { ak: "room", id: C.id }); ctx.status("⧉ " + C.name + " beside it - sharing the wall");
    }
    function roofAll() {
      const A = AR(), R0 = asel && asel.ak === "room" ? P().room(A, asel.id) : null, ids = P().level(A, R0 ? R0.z : 0);
      if (!ids.length) { ctx.status("no rooms on that floor yet"); return; }
      const b = before(), rf = P().addRoof(A, ids, roofOpts()); st.roof = rf.id;
      done("roof", b, { ak: "roof", id: rf.id }); ctx.status("△ one roof over " + ids.length + " rooms");
    }
    function summary() {
      const A = ctx.model() && ctx.model().arch; if (!A || !P().has(A)) return "";
      const n = (k, w) => (k ? k + " " + w + (k > 1 ? (w === "stairs" ? "" : "s") : "") : "");
      const rooms = A.rooms.filter((R) => R.closed).length, walls = A.rooms.length - rooms;
      return [n(rooms, "room"), n(walls, "wall"), n(A.ops.filter((o) => o.kind === "door").length, "door"), n(A.ops.filter((o) => o.kind === "window").length, "window"), n(A.roofs.length, "roof"), n(A.lights.length, "light"), n(A.stairs.length, "stairs"), n(A.slabs.length, "floor")].filter(Boolean).join(" · ");
    }
    return { joineryAt: (p, z, spec, rot) => joineryAt(AR(), p, z || 0, spec, rot || 0), escape, picked, setMore, gizmo: () => gizmo, furnishRoom, lookThrough, leaveThrough, through: () => (through ? through.id : null), camShots, camLocation, lastCam: () => last, owns, use, down, move, up, dbl, vcb, key, selectDown, selectMove, selectUp, selectDbl, eraseAt, paintAt, sel: () => asel, setSel, props, summary, state: () => st, opts: O, roofAll, TOOLS, HINT, VCB };
  }
  root.PPArchTools = { create, TOOLS, HINT, VCB, OPT0 };
})(typeof window !== "undefined" ? window : globalThis);
