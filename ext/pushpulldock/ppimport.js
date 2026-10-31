/* bitGen Studio — ext/pushpulldock/ppimport.js (2.630.0): A HOUSE FROM THE (GONE) HOUSE BUILDER -> A SKETCHER MODEL
 * (window.PPImport). The House builder is deleted in 2.630.0; its saved houses (projects/<p>/houses/<slug>/house.json, still
 * served by routes/house.js) come into the Sketcher once: ☰ File ▸ 🏠 A house from the House builder…
 *   fromHouse(m) -> {model (the Sketcher's file: {v, f, e, g, n, arch}), notes: [what did not come]}   pure (Node: test-import630.js)
 *     the plan's y runs down -> the Sketcher's y up (y = -y; turns stay: the same picture seen from above)
 *     each floor's rooms -> rooms (their outline = the walls' centre line, the floor's height and elevation, the walls'
 *     thickness; floor / wall materials -> "mat:<key>"); walls on no room's edge -> free walls; doors / windows / glass
 *     doors / openings / garage doors -> openings on the nearest wall; furniture -> 🛋 items; people -> 🧍; cameras -> 📷;
 *     ◯ lights -> ceiling lights; stairs -> stairs. Not carried: 3D-model pieces (bring them in from ⤒ Import), the roof
 *     (Y △ Roof makes one), reference pictures on walls (paint ▦ Materials), the plan picture. */
(function (root) {
  "use strict";
  const HG = () => root.H3HouseGeo, P = () => root.PPArch;
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const fy = (p) => [r3(p[0]), r3(-p[1])];
  const near = (a, b) => Math.abs(a[0] - b[0]) < 0.02 && Math.abs(a[1] - b[1]) < 0.02;
  function fromHouse(house) {
    const G = HG(), m = G.normalize(house || {}), E = G.elevations(m), A = P().empty(), notes = [];
    const matOf = (k) => (G.MATERIALS[k] ? "mat:" + k : null);
    const thick = {}; m.walls.forEach((w) => { (thick[w.floor] = thick[w.floor] || []).push(w.thick || 0.15); });
    const tOf = (f) => { const L = thick[f] || [0.15]; return r3(L.reduce((a, b) => a + b, 0) / L.length); };
    const roomOf = {};
    m.rooms.forEach((r) => {
      const H = m.floors[r.floor].height, wall = m.walls.find((w) => w.floor === r.floor && r.poly.some((p) => near(p, w.a)));
      const R = P().addRoom(A, r.poly.map(fy), { z: r3(E[r.floor]), h: r3(H), t: tOf(r.floor), name: r.name || "Room" });
      if (!R) return;
      const fm = matOf(r.mat); if (fm) R.floor = fm;
      const wm = wall && matOf(wall.mat); if (wm) R.wall = wm;
      if (r.ceiling === false) R.ceilOn = false;
      roomOf[r.id] = R;
    });
    // walls on no room's edge: free walls
    const onRoom = (w) => m.rooms.some((r) => r.floor === w.floor && r.poly.some((p, i) => { const q = r.poly[(i + 1) % r.poly.length]; return (near(p, w.a) && near(q, w.b)) || (near(p, w.b) && near(q, w.a)); }));
    m.walls.forEach((w) => { if (onRoom(w)) return; P().addRoom(A, [fy(w.a), fy(w.b)], { closed: false, z: r3(E[w.floor]), h: r3(m.floors[w.floor].height), t: r3(w.thick || 0.15), name: "Wall" }); });
    // doors and windows: on the nearest wall
    const KIND = { door: ["door", "single"], window: ["window", "double"], slide: ["door", "sliding"], opening: ["opening", null], garage: ["door", "double"] };
    m.openings.forEach((q) => {
      const w = m.walls.find((x) => x.id === q.wall); if (!w) return;
      const L = G.dist(w.a, w.b), u = [(w.b[0] - w.a[0]) / L, (w.b[1] - w.a[1]) / L], c = fy([w.a[0] + u[0] * q.t, w.a[1] + u[1] * q.t]);
      const nw = P().nearestWall(A, c, 0.4, E[w.floor] + 0.5); if (!nw) { notes.push("a " + q.kind + " (no wall under it)"); return; }
      const [kind, style] = KIND[q.kind] || KIND.door, o = { room: nw.room, edge: nw.edge, at: r3(nw.at), h: q.h, sill: kind === "door" ? 0 : q.sill };
      if (style) o.style = style;
      const op = P().addOp(A, kind, q.w, o); if (!op) notes.push("a " + q.kind + " (it did not fit)");
    });
    // furniture, people, cameras, lights, stairs
    const F = root.PPFurn;
    m.items.forEach((it) => {
      if (it.type === "model") { notes.push("the 3D model " + (it.model || "") + " (⤒ Import brings it in)"); return; }
      const n = F && F.make(it.type, fy([it.x, it.y]), E[it.floor], it.rot || 0, it.color || ""); if (!n) return;
      if (it.w) n.w = it.w; if (it.d) n.d = it.d; if (it.h) n.h = it.h; n.id = A.n++; A.items.push(n);
    });
    (m.people || []).forEach((q) => { const n = F && F.make("person", fy([q.x, q.y]), E[q.floor], (q.rot || 90) - 90, q.color || "", q.pose); if (!n) return; n.h = q.h || 1.75; n.name = q.name || ""; n.id = A.n++; A.items.push(n); });
    (m.cameras || []).forEach((c) => { A.cams.push({ id: A.n++, name: c.name || "Camera", x: r3(c.x), y: r3(-c.y), z: r3(E[c.floor] + (c.z != null ? c.z : 1.6)), yaw: r3(((c.yaw || 0) % 360 + 360) % 360), pitch: r3(c.pitch || 0), fov: c.fov || 60 }); });
    (m.lights || []).forEach((L) => { const lt = P().addLight(A, "ceiling", [r3(L.x), r3(-L.y), r3(E[L.floor] + (L.z != null ? L.z : 2.4))], { col: L.color || "#ffcf9e", lm: Math.round(800 * (L.intensity || 1)) }); void lt; });
    (m.stairs || []).forEach((s) => { const H = m.floors[s.floor].height + (G.SLAB || 0.2); A.stairs.push({ id: A.n++, x: r3(s.x), y: r3(-s.y), z: r3(E[s.floor]), ang: r3(-(s.rot || 0)), w: s.w || 1, len: s.len || 3.6, rise: r3(H) }); });
    if (m.roof && m.roof.type && m.roof.type !== "none") notes.push("the roof (Y △ Roof makes one over the rooms)");
    const model = { v: [], f: [], e: [], g: [], n: 1, arch: P().clean(JSON.parse(JSON.stringify(A))) };
    return { model, notes, name: m.name || "house" };
  }
  const api = { fromHouse };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.PPImport = api;
})(typeof window !== "undefined" ? window : globalThis);
