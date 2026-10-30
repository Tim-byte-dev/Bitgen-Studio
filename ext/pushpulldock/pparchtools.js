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
 * create(ctx) -> {owns(tool), use, down / move / up / dbl, vcb, key, selectDown / selectMove / selectUp, eraseAt, paintAt,
 *   sel(), setSel(), props(), summary()} - wired into pptools.js; ctx = the docker (ppdock.js) */
(function (root) {
  "use strict";
  const P = () => root.PPArch, G = () => root.PPGeo;
  const TOOLS = [["room", "⌂", "Room", "u"], ["wall", "▮", "Wall", "w"], ["door", "🚪", "Door", "d"], ["window", "🪟", "Window", "i"], ["floor", "▦", "Floor", "j"],
    ["ceiling", "⌓", "Ceiling", "k"], ["roof", "△", "Roof", "y"], ["light", "💡", "Light", "x"], ["stairs", "▟", "Stairs", "v"]];
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
  };
  const VCB = { room: "Width,Depth", wall: "Length", door: "Width,Height", window: "Width,Height", floor: "Width,Depth", roof: "Pitch°", light: "Lumens", stairs: "Length" };
  const OPT0 = { room: { h: 2.7, t: 0.15, z: 0, ceilOn: true }, wall: { h: 2.7, t: 0.15, z: 0 }, door: { style: "single", w: 0.9, h: 2.1 }, window: { style: "double", w: 1.2, h: 1.2, sill: 0.9 },
    floor: { z: 0, th: 0.2 }, roof: { type: "gable", pitch: 30, over: 0.4 }, light: { type: "downlight", col: "#ffcf9e", lm: 0 }, stairs: { w: 1, rise: 2.7 } };

  function create(ctx) {
    const V = ctx.V, v3 = () => G().v3;
    let tool = null, st = {}, asel = null;
    const O = JSON.parse(JSON.stringify(OPT0));
    try { const s = JSON.parse(root.localStorage.getItem("pp.archopt") || "{}"); Object.keys(O).forEach((k) => { if (s[k] && typeof s[k] === "object") Object.assign(O[k], s[k]); }); } catch (e) { /* fine */ }
    const keepOpt = () => { try { root.localStorage.setItem("pp.archopt", JSON.stringify(O)); } catch (e) { /* fine */ } };
    const AV = () => ctx.archView(), AR = () => P().of(ctx.model());
    const fmt = (m) => G().fmtLen(m);
    const owns = (n) => !!HINT[n];

    /* ---- the mouse on a level */
    function planeAt(ev, z) { const r = V.ray(ev); if (Math.abs(r.d[2]) < 1e-9) return null; const t = (z - r.o[2]) / r.d[2]; return t > 0 ? [r.o[0] + r.d[0] * t, r.o[1] + r.d[1] * t, z] : null; }
    function snapPlan(ev, z, from) {
      const s = V.snap(ev, { from: from ? [from[0], from[1], z] : null, plane: { n: [0, 0, 1], p: [0, 0, z] }, extra: P().snapPoints(AR(), z), group: ctx.group() });
      let p = [s.p[0], s.p[1], z];
      if ((s.kind === "On Face" || s.kind === "On Edge") && Math.abs(s.p[2] - z) > 1e-3) { const q = planeAt(ev, z); if (q) p = q; }
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
      if (tool === "stairs") {
        const { p } = snapPlan(ev, 0, st.a);
        if (!st.a) { st.a = p; return; }
        finishStairs(st.a, p); return;
      }
    }
    function move(ev) {
      const A = AR();
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
      const bf = before(), R = P().addRoom(AR(), P().rectPts(a, b), { z: O.room.z, h: O.room.h, t: O.room.t, ceilOn: O.room.ceilOn });
      st = {}; V.preview({});
      done("room", bf, { ak: "room", id: R.id });
      const shared = sharedWith(R);
      ctx.status("⌂ " + R.name + " " + fmt(w) + " × " + fmt(d) + (shared.length ? " - sharing a wall with " + shared.join(", ") : "") + " · drag it (Select), doors D, windows I");
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
      const bf = before(), R = P().addRoom(AR(), pts, { closed, z: O.wall.z, h: O.wall.h, t: O.wall.t });
      if (!R) { ctx.status("that wall is too small"); return; }
      done(closed ? "room" : "wall", bf, { ak: "room", id: R.id }); ctx.status(closed ? "⌂ the walls closed round " + R.name : "▮ " + R.name + " - doors and windows go in it too");
    }
    function stairOf(a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); if (L < 0.3) return null; return { id: 0, x: a[0], y: a[1], ang: Math.atan2(dy, dx) * 180 / Math.PI, w: O.stairs.w, len: L, rise: O.stairs.rise, z: 0, col: P().DEF.stair }; }
    function finishStairs(a, b) {
      const s = stairOf(a, b); if (!s) return;
      const bf = before(), A = AR(); s.id = A.n++; A.stairs.push(s); st = {}; V.preview({});
      done("stairs", bf, { ak: "stair", id: s.id }); ctx.status("▟ stairs " + fmt(s.len) + " long, " + fmt(s.rise) + " up");
    }
    function vcb(text) {
      const g = G().parseVcb(text), A = AR();
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
        return false;
      }
      if (asel && (k === "Delete" || k === "Backspace") && (baseTool === "select" || owns(baseTool))) { eraseSel(); return true; }
      if (asel && k === "Escape" && !owns(baseTool)) { setSel(null); return true; }
      return false;
    }

    /* ---- Select: pick + drag */
    function nearerThanModel(ev, h) {
      const mp = V.pick(ev, { group: ctx.group() }); if (!mp) return true;
      const r = V.ray(ev), d = Math.hypot(mp.point[0] - r.o[0], mp.point[1] - r.o[1], mp.point[2] - r.o[2]);
      return h.dist <= d + 1e-3;
    }
    function selectDown(ev) {
      const h = AV() && AV().pick(ev);
      if (!h || !nearerThanModel(ev, h)) { if (asel) setSel(null); return false; }
      const t = AV().resolve(h); if (!t) return false;
      ctx.setSel({ f: [], e: [], k: [] }); setSel(t);
      const A = AR(), x = P().find(A, t.ak, t.id);
      const z = t.ak === "room" ? x.z : t.ak === "light" ? x.z : t.ak === "stair" ? x.z : t.ak === "slab" ? x.z : h.point[2];
      const start = planeAt(ev, z);
      if (t.ak !== "roof" && start) st.drag = { t, z, start, x0: ev.clientX, y0: ev.clientY, before: before(), base: JSON.stringify(A), moved: false };
      return true;
    }
    function selectMove(ev) {
      const D = st.drag;
      if (!D) {
        const h = AV() && AV().pick(ev); AV() && AV().setHover(h && nearerThanModel(ev, h) ? AV().resolve(h) : null);
        return false;
      }
      if (!(ev.buttons & 1)) { st.drag = null; return false; }
      if (!D.moved && Math.hypot(ev.clientX - D.x0, ev.clientY - D.y0) < 4) return true;
      D.moved = true;
      const cur = planeAt(ev, D.z); if (!cur) return true;
      let d = [cur[0] - D.start[0], cur[1] - D.start[1]];
      if (ev.shiftKey) { if (Math.abs(d[0]) > Math.abs(d[1])) d[1] = 0; else d[0] = 0; }
      const M = ctx.model(); M.arch = P().clean(JSON.parse(D.base)); const A = M.arch, t = D.t, x = P().find(A, t.ak, t.id); if (!x) return true;
      if (t.ak === "room") {
        const s = P().snapMove(A, [t.id], d, pxTol(cur)); P().moveRooms(A, [t.id], s.d);
        const Q = s.hit && P().room(A, s.hit.room);
        ctx.status(Q ? "⌂ " + x.name + " shares a wall with " + Q.name + (s.hit.kind === "corner" ? " · corners in line" : "") : "⌂ " + x.name + " moved " + fmt(Math.hypot(s.d[0], s.d[1])));
      } else if (t.ak === "op") {
        const w = P().nearestWall(A, [cur[0], cur[1]], 1.0, null);
        if (w) { x.room = w.room; x.edge = w.edge; x.at = w.at; ctx.status((x.kind === "window" ? "🪟 " : "🚪 ") + w.R.name + " · " + fmt(Math.max(0, w.at - x.w / 2)) + " from the corner"); }
      } else if (t.ak === "light") {
        x.x += d[0]; x.y += d[1];
        const def = P().LIGHTS[x.type];
        if (def.mount === "ceil") { const sp = P().lightSpot(A, x.type, [x.x, x.y], null); x.z = sp.z; x.room = sp.room; }
        else if (def.mount === "floor") { const R = P().roomAt(A, [x.x, x.y], x.z); x.room = R ? R.id : null; }
        ctx.status("💡 moved " + fmt(Math.hypot(d[0], d[1])));
      } else if (t.ak === "stair") { x.x += d[0]; x.y += d[1]; }
      else if (t.ak === "slab") { x.pts = x.pts.map((p) => [p[0] + d[0], p[1] + d[1]]); }
      AV().rebuild();
      return true;
    }
    function selectUp() {
      const D = st.drag; if (!D) return false;
      st.drag = null;
      if (D.moved) { ctx.commit("move", D.before); props(); }
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
      const b = before(), t = asel; if (P().remove(AR(), t.ak, t.id)) { asel = null; done("erase", b, null); ctx.status("⌫ erased the " + nameOf(t)); }
    }
    function nameOf(t) { const x = t.id != null ? P().find(AR(), t.ak, t.id) : null; return { room: x ? x.name : "room", op: x ? (x.kind === "opening" ? "opening" : x.kind) : "door / window", light: "light", roof: "roof", stair: "stairs", slab: "floor" }[t.ak] || t.ak; }
    function setSel(t, quiet) {
      asel = t && t.ak ? { ak: t.ak, id: t.id } : null;
      if (AV()) AV().setSel(asel);
      if (!quiet) props();
      if (ctx.onSel) ctx.onSel();
    }

    /* ---- the panel: the tool's settings / what is picked */
    function props() {
      const box = root.document && root.document.getElementById("ppProps"); if (!box) return;
      box.innerHTML = "";
      const A = ctx.model() ? AR() : null;
      const x = asel && A ? P().find(A, asel.ak, asel.id) : null;
      if (asel && !x) asel = null;
      if (!tool && !x) { box.style.display = "none"; ctx.resized && ctx.resized(); return; }
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
      if (tool) {
        head({ room: "⌂ Room", wall: "▮ Wall", door: "🚪 Door", window: "🪟 Window", floor: "▦ Floor", ceiling: "⌓ Ceiling", roof: "△ Roof", light: "💡 Light", stairs: "▟ Stairs" }[tool] + " - the next one");
        const o = O[tool];
        if (tool === "room" || tool === "wall") { numIn("Wall height", o.h, opt("h"), 0.05, 0.1, 50, "m"); numIn("Wall thickness", o.t, opt("t"), 0.01, 0.02, 2, "m"); numIn("Floor level", o.z, opt("z"), 0.05, -100, 1000, "m"); if (tool === "room") chkIn("Ceiling", o.ceilOn, opt("ceilOn")); }
        if (tool === "door") { selIn("Style", o.style, [["single", "Single"], ["double", "Double"], ["sliding", "Sliding glass"], ["glass", "Glass panel"], ["opening", "An opening (no door)"]], opt("style")); numIn("Width", o.w, opt("w"), 0.05, 0.3, 10, "m"); numIn("Height", o.h, opt("h"), 0.05, 0.5, 10, "m"); }
        if (tool === "window") { selIn("Style", o.style, [["single", "Single pane"], ["double", "Two panes"], ["slider", "Sliding"]], opt("style")); numIn("Width", o.w, opt("w"), 0.05, 0.2, 20, "m"); numIn("Height", o.h, opt("h"), 0.05, 0.2, 10, "m"); numIn("Sill height", o.sill, opt("sill"), 0.05, 0, 10, "m"); }
        if (tool === "floor") { numIn("Top at", o.z, opt("z"), 0.05, -100, 1000, "m"); numIn("Thickness", o.th, opt("th"), 0.01, 0.01, 5, "m"); }
        if (tool === "roof") { selIn("Type", o.type, P().ROOFS.map((r) => [r, r[0].toUpperCase() + r.slice(1)]), opt("type")); numIn("Pitch", o.pitch, opt("pitch"), 1, 0, 75, "°"); numIn("Overhang", o.over, opt("over"), 0.05, 0, 5, "m");
          btns([["△ Roof the whole storey", () => roofAll(), "One roof over every room on the ground floor (or the picked room's floor)"]]); }
        if (tool === "light") { selIn("Type", o.type, Object.keys(P().LIGHTS).map((k) => [k, P().LIGHTS[k].label]), opt("type")); kel(o.col, opt("col")); numIn("Brightness (0 = usual)", o.lm, opt("lm"), 50, 0, 100000, "lm"); }
        if (tool === "stairs") { numIn("Width", o.w, opt("w"), 0.05, 0.3, 10, "m"); numIn("Height (up)", o.rise, opt("rise"), 0.05, 0.1, 20, "m"); }
        if (tool === "ceiling") box.appendChild(el("div", "pphint", "Click a room: its ceiling on / off. ⌂ Cut-away in the bar hides every ceiling and roof to look in from above."));
        ctx.resized && ctx.resized(); return;
      }
      // what is picked
      if (asel.ak === "room") {
        const R = x, rect = R.closed && R.pts.length === 4 && isRect(R);
        head((R.closed ? "⌂ " : "▮ ") + R.name + (R.closed ? " · " + (+P().roomArea(R).toFixed(2)) + " m²" : ""));
        txtIn("Name", R.name, ch((v) => { R.name = v; }));
        if (rect) { const e = P().edgesOf(R); numIn("Width", e[0].L, ch((v) => P().resizeRect(AR(), R.id, v, e[1].L)), 0.05, 0.3, 500, "m"); numIn("Depth", e[1].L, ch((v) => P().resizeRect(AR(), R.id, e[0].L, v)), 0.05, 0.3, 500, "m"); }
        numIn("Wall height", R.h, ch((v) => P().setRoom(AR(), R.id, { h: v })), 0.05, 0.1, 50, "m");
        numIn("Wall thickness", R.t, ch((v) => P().setRoom(AR(), R.id, { t: v })), 0.01, 0.02, 2, "m");
        numIn("Floor level", R.z, ch((v) => P().setRoom(AR(), R.id, { z: v })), 0.05, -100, 1000, "m");
        colIn(R.closed ? "Walls inside" : "Wall", R.wall, ch((v) => { R.wall = v; }));
        if (R.closed) { colIn("Floor", R.floor, ch((v) => { R.floor = v; })); colIn("Ceiling", R.ceilCol, ch((v) => { R.ceilCol = v; })); chkIn("Has a floor", R.floorOn, ch((v) => { R.floorOn = v; })); chkIn("Has a ceiling", R.ceilOn, ch((v) => { R.ceilOn = v; })); }
        colIn("Outside walls (all)", AR().ext, ch((v) => { AR().ext = v; }));
        btns([["⟳ 90°", ch(() => P().rotateRoom(AR(), R.id, 90)), "Turn it a quarter round its middle"], ["⧉ Duplicate", () => dupRoom(R.id), "A copy beside it, sharing its wall"],
          ["△ Roof", () => { const b = before(); const rf = P().addRoof(AR(), [R.id], { type: O.roof.type, pitch: O.roof.pitch, over: O.roof.over }); done("roof", b, { ak: "roof", id: rf.id }); }, "A roof over this room"], ["🗑 Delete", eraseSel, "Delete (its doors, windows and lights too)"]]);
        box.appendChild(el("div", "pphint", "Drag it (Select) - a wall near another room's wall snaps onto it and they share it. Shift keeps the drag straight."));
      } else if (asel.ak === "op") {
        const op = x, I = P().opInfo(AR(), op), R = P().room(AR(), op.room);
        head((op.kind === "door" ? "🚪 Door" : op.kind === "window" ? "🪟 Window" : "▯ Opening") + " · " + (R ? R.name : ""));
        selIn("Kind", op.kind, [["door", "Door"], ["window", "Window"], ["opening", "Opening"]], ch((v) => { const d = P().OPS[v]; op.kind = v; op.style = d.style; op.sill = d.sill; if (v === "window") { op.h = Math.min(op.h, d.h); op.col = P().DEF.frame; } else op.col = v === "door" ? P().DEF.door : P().DEF.frame; }));
        if (op.kind !== "opening") selIn("Style", op.style, P().STYLES[op.kind].map((s) => [s, s[0].toUpperCase() + s.slice(1)]), ch((v) => { op.style = v; }));
        numIn("Width", op.w, ch((v) => { op.w = v; }), 0.05, 0.2, 20, "m"); numIn("Height", op.h, ch((v) => { op.h = v; }), 0.05, 0.2, 20, "m");
        if (op.kind === "window") numIn("Sill height", op.sill, ch((v) => { op.sill = v; }), 0.05, 0, 20, "m");
        if (I) numIn("From the corner", Math.max(0, I.x0), ch((v) => { op.at = v + op.w / 2; }), 0.05, 0, 500, "m");
        if (op.kind !== "opening") colIn(op.kind === "door" ? "Door" : "Frame", op.col, ch((v) => { op.col = v; }));
        if (op.kind === "door") chkIn("Handle on the other side", op.flip, ch((v) => { op.flip = v; }));
        btns([["🗑 Delete", eraseSel]]);
        box.appendChild(el("div", "pphint", "Drag it (Select) along its wall, or onto another wall."));
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
        selIn("Type", rf.type, P().ROOFS.map((r) => [r, r[0].toUpperCase() + r.slice(1)]), ch((v) => { rf.type = v; }));
        numIn("Pitch", rf.pitch, ch((v) => { rf.pitch = v; }), 1, 0, 75, "°"); numIn("Overhang", rf.over, ch((v) => { rf.over = v; }), 0.05, 0, 5, "m"); numIn("Thickness", rf.th, ch((v) => { rf.th = v; }), 0.01, 0.02, 2, "m");
        selIn("Ridge", rf.ridge, [["auto", "Along the long side"], ["u", "Along the first wall"], ["v", "Across the first wall"]], ch((v) => { rf.ridge = v; }));
        colIn("Colour", rf.col, ch((v) => { rf.col = v; }));
        btns([["△ Over the whole storey", ch(() => { const R0 = P().room(AR(), rf.rooms[0]); rf.rooms = P().level(AR(), R0 ? R0.z : 0); }), "Every room on its floor under this roof"], ["🗑 Delete", eraseSel]]);
      } else if (asel.ak === "stair") {
        const s = x; head("▟ Stairs · " + Math.max(2, Math.round(s.rise / 0.18)) + " steps");
        numIn("Width", s.w, ch((v) => { s.w = v; }), 0.05, 0.3, 10, "m"); numIn("Length", s.len, ch((v) => { s.len = v; }), 0.05, 0.3, 50, "m"); numIn("Height (up)", s.rise, ch((v) => { s.rise = v; }), 0.05, 0.1, 20, "m");
        numIn("Starts at", s.z, ch((v) => { s.z = v; }), 0.05, -100, 1000, "m"); colIn("Colour", s.col, ch((v) => { s.col = v; }));
        btns([["⟳ 90°", ch(() => { s.ang += 90; })], ["🗑 Delete", eraseSel]]);
      } else if (asel.ak === "slab") {
        const s = x; head("▦ Floor · " + (+Math.abs(P().area2(s.pts)).toFixed(2)) + " m²");
        numIn("Top at", s.z, ch((v) => { s.z = v; }), 0.05, -100, 1000, "m"); numIn("Thickness", s.th, ch((v) => { s.th = v; }), 0.01, 0.01, 5, "m"); colIn("Colour", s.col, ch((v) => { s.col = v; }));
        btns([["🗑 Delete", eraseSel]]);
      }
      ctx.resized && ctx.resized();
    }
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
    return { owns, use, down, move, up, dbl, vcb, key, selectDown, selectMove, selectUp, eraseAt, paintAt, sel: () => asel, setSel, props, summary, state: () => st, opts: O, roofAll, TOOLS, HINT, VCB };
  }
  root.PPArchTools = { create, TOOLS, HINT, VCB, OPT0 };
})(typeof window !== "undefined" ? window : globalThis);
