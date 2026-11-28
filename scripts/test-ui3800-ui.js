#!/usr/bin/env node
/* bitGen Studio — 3.8.0 in a REAL browser: a DAZ character dragged over the floor, turned by its yellow ring, a bone turned by
 * its rings (the slider follows), an asset (✥) slid on the character and kept over a reload; 👁 on every shape, shape group,
 * heading and DAZ character in the 🗂 Outline.
 * Tim: "allow user to move and pose the daz characters and assets. add an eye icon button to each object and object group
 * to turn visibility on/off". Our own made-up doll (test-981 / test-983) - no Daz content. */
"use strict";
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const grab = (file, a, b) => { const t = fs.readFileSync(path.join(__dirname, file), "utf8"); return t.slice(t.indexOf(a), t.indexOf(b)); };
  const { makeDoll } = new Function("require", "path", "fs", grab("test-981.js", "const pt = ", "(async () => {") + "; return { makeDoll };")(require, path, fs);
  const { dressDoll } = new Function("require", "path", "fs", grab("test-983.js", "/** the doll's wardrobe", "(async () => {") + "; return { dressDoll };")(require, path, fs);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ui3800_")), lib = path.join(tmp, "DollLib");
  makeDoll(lib); dressDoll(lib);
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), p = await b.newPage({ viewport: { width: 2100, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (/shader|webglprogram/i.test(m.text())) errs.push(m.text().slice(0, 300)); });
  const ev = (f, a) => p.evaluate(f, a);
  const tile = (name) => p.locator("#dzGrid .dzit", { hasText: name }).first();
  const kind = async (k, name) => { await p.click('#dzTabs [data-kind="' + k + '"]'); await p.waitForFunction((n) => [...document.querySelectorAll("#dzGrid .dzit span")].some((s) => s.textContent === n), name, { timeout: 10000 }); };
  const built = (n) => p.waitForFunction((k) => H3DazScene.list().length === k && !H3DazTools.state.busy, n, { timeout: 60000 });
  const scr = (pt) => ev((q) => { const V = H3PushPull.state.V, s = V.screen(q), r = V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, pt);
  const drag = async (a, z, steps) => { await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move(z[0], z[1], { steps: steps || 12 }); await p.mouse.up(); await p.waitForTimeout(120); };
  const row = (key) => p.locator('#ppOutline .orow[data-key="' + key + '"]');
  const tris = () => ev(() => H3PushPull.state.V.faceMeshes().reduce((a, m) => a + m.geometry.attributes.position.count / 3, 0));
  const boot = async () => {
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3DazTools && window.H3DazGizmo && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); localStorage.setItem("h3.dockmax.off", "1"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.V && H3PushPull.state.M && window.PPOutline, null, { timeout: 40000 });
  };
  const made = [];
  try {
    await p.request.post(URL_ + "api/dazlib/roots", { data: { roots: [lib] } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.(daztools\.|ppdocks|pparch)/.test(k)).forEach((k) => localStorage.removeItem(k)); localStorage.setItem("pp.outline", "1"); });
    await p.reload({ waitUntil: "domcontentloaded" });
    await boot();

    // ---- 👁 shapes: a box, a rectangle, a group (in a new model)
    await ev(() => H3PushPull.newModel()); await p.waitForFunction(() => H3PushPull.state.M && !H3PushPull.state.M.f.length, null, { timeout: 20000 });
    await ev(() => {
      const h = H3PushPull, G = PPGeo; const before = h.snapshot(), M = h.state.M;
      const f = G.addFace(M, G.rectPts([-8, -8, 0], [-6, -7, 0])); G.pushPull(M, f.id, 1);
      G.addFace(M, G.rectPts([-4, -8, 0], [-3, -7, 0]));
      const g = G.addFace(M, G.rectPts([-2, -8, 0], [-1, -7, 0])); G.group(M, { f: [g.id], e: [] }, "Shed");
      h.commit("shapes", before); PPOutline.paint();
    });
    const nF = await ev(() => H3PushPull.state.M.f.length);
    const t0 = await tris();
    const keys = await ev(() => [...document.querySelectorAll('#ppOutline .orow')].map((r) => r.dataset.key).filter((k) => /^(shape|geogroup|sec:shapes)/.test(k)));
    check("🗂 the Shapes heading and each shape row has an 👁", keys.includes("sec:shapes") && keys.length >= 4 && (await ev((ks) => ks.every((k) => document.querySelector('#ppOutline .orow[data-key="' + k + '"] .oeye')), keys)), keys);
    const solidKey = await ev(() => PPCons.shapes(H3PushPull.state.M).find((s) => s.kind === "solid").key), grpKey = await ev(() => PPCons.shapes(H3PushPull.state.M).find((s) => s.kind === "group").key);
    await row(solidKey).locator(".oeye").click(); await p.waitForTimeout(150);
    const t1 = await tris();
    check("👁 on the box: its 6 faces leave the view (12 triangles)", t0 - t1 === 12 && (await ev(() => H3PushPull.state.M.f.filter((F) => F.hid).length)) === 6, [t0, t1]);
    check("…its row dimmed with 🚫", await ev((k) => { const r = document.querySelector('#ppOutline .orow[data-key="' + k + '"]'); return r.classList.contains("dim") && r.querySelector(".oeye").textContent === "🚫"; }, solidKey));
    await row(grpKey).locator(".oeye").click(); await p.waitForTimeout(150);
    check("👁 on a group: hidden (its flag), its face gone from the view", (await tris()) === t1 - 2 && (await ev(() => H3PushPull.state.M.g.some((g) => g.hidden))));
    check("Ctrl+A leaves hidden shapes out", await ev(() => { const cv = H3PushPull.state.V.canvas; cv.focus(); cv.dispatchEvent(new KeyboardEvent("keydown", { key: "a", ctrlKey: true, bubbles: true })); const s = H3PushPull.state.sel, M = H3PushPull.state.M; return s.f.length === M.f.filter((F) => !F.hid && !M.g.some((g) => g.hidden && g.id === F.grp)).length && s.f.length > 0; }));
    await ev(() => H3PushPull.undo()); await p.waitForTimeout(150);
    check("↶ undo brings the group back (one step)", (await tris()) === t1);
    await row("sec:shapes").locator(".oeye").click(); await p.waitForTimeout(150);
    check("the Shapes heading's 👁 hides every shape (one still showed)", (await tris()) === 0, await tris());
    await row("sec:shapes").locator(".oeye").click(); await p.waitForTimeout(150);
    check("…and again shows them all", (await tris()) === t0, [await tris(), t0]);
    const saved = await ev(() => { const b = H3PushPull.snapshot(); const M = PPGeo.fromJson(JSON.parse(b)); return { n: M.f.length, hid: M.f.filter((F) => F.hid).length }; });
    check("hidden or not, the shapes are all still in the model (8 faces drawn)", saved.n === nF && nF >= 8 && saved.hid === 0, { saved, nF });

    // ---- a DAZ character, with a shirt
    await ev(() => H3PushPull.tool("select")); await ev(() => H3PushPull.state.V.view("iso"));
    await p.click("#ppDazLib"); await p.waitForSelector("#dzGrid .dzit", { timeout: 15000 });
    await tile("Doll").click(); await built(1);
    await kind("clothing", "Shirt"); await tile("Shirt").click();
    await p.waitForFunction(() => !H3DazTools.state.busy && document.querySelectorAll("#dzTree .dzpiece").length >= 2, null, { timeout: 60000 });
    const id = await ev(() => H3DazScene.list()[0]);
    await ev(() => { H3PushPull.state.V.extents(); PPOutline.paint(); });
    check("🗂 a DAZ characters heading: the doll and its pieces, each with 👁", await ev((i) => !!document.querySelector('#ppOutline .orow[data-key="daz:' + i + '"] .oeye') && !!document.querySelector('#ppOutline .orow[data-key="dazp:' + i + ':Shirt"] .oeye') && !!document.querySelector('#ppOutline .orow[data-key="sec:daz"] .oeye'), id));
    await row("daz:" + id).locator(".oeye").click(); await p.waitForTimeout(150);
    check("👁 on the character: it leaves the view, kept hidden, the explorer's 👁 follows", await ev((i) => !H3DazScene.rig(i).outer.visible && H3DazTools.cur().hidden === true && !document.getElementById("dzShow").checked, id));
    await row("daz:" + id).locator(".oeye").click(); await p.waitForTimeout(150);
    check("…again: back", await ev((i) => H3DazScene.rig(i).outer.visible && !H3DazTools.cur().hidden, id));
    await row("dazp:" + id + ":Shirt").locator(".oeye").click(); await p.waitForTimeout(150);
    const sh = await ev((i) => { const r = H3DazScene.rig(i); let v = null; r.root.traverse((o) => { if (o.userData && /^Shirt \(/.test(o.userData.name || "")) v = o.visible; }); return { v, kept: H3DazTools.cur().hidePieces }; }, id);
    check("👁 on a piece (the shirt): hidden in the view, kept with the character", sh.v === false && sh.kept.join() === "Shirt", sh);
    await row("dazp:" + id + ":Shirt").locator(".oeye").click(); await p.waitForTimeout(150);
    await row("daz:" + id).locator(".olab").click(); await p.waitForTimeout(100);
    check("a click on the character's row picks it (its box, the 🧍 row lit)", await ev((i) => H3DazScene.sel() === i && document.querySelector('#ppOutline .orow[data-key="daz:' + i + '"]').classList.contains("on"), id));

    // ---- move: drag the character over the floor
    const p0 = await ev((i) => Object.assign({}, H3DazScene.rig(i).place), id);
    const a0 = await scr([p0.x, p0.y, 1.1]), a1 = [a0[0] + 140, a0[1] + 30];
    const exp = await ev(([s, e]) => { const S = H3DazScene, g0 = S.ground({ clientX: s[0], clientY: s[1] }), g1 = S.ground({ clientX: e[0], clientY: e[1] }); return [g1[0] - g0[0], g1[1] - g0[1]]; }, [a0, a1]);
    const orbit0 = await ev(() => H3PushPull.state.V.cam().position.toArray());
    await drag(a0, a1);
    const p1 = await ev((i) => ({ r: Object.assign({}, H3DazScene.rig(i).place), c: H3DazTools.cur().place, px: +document.getElementById("dzPX").value }), id);
    check("a drag on the picked character moves it over the floor (with the pointer)", Math.abs(p1.r.x - p0.x - exp[0]) < 0.01 && Math.abs(p1.r.y - p0.y - exp[1]) < 0.01 && Math.hypot(exp[0], exp[1]) > 0.3, { p0, p1, exp });
    check("…kept with the character, the X box follows; the view did not orbit / the Sketcher did not draw", p1.c.x === p1.r.x && p1.px === p1.r.x && JSON.stringify(orbit0) === JSON.stringify(await ev(() => H3PushPull.state.V.cam().position.toArray())) && (await ev(() => H3PushPull.state.M.f.length)) === nF);

    // ---- turn: its yellow ring
    const ring = await ev(() => { const R = H3DazGizmo.rings(); return R.length === 1 && R[0].kind === "turn" ? R[0].pts : null; });
    check("the picked character has one ring at its feet (the turn)", !!ring && ring.every((q) => Math.abs(q[2] - 0.01) < 1e-9));
    const rot0 = p1.r.rot, r0 = await scr(ring[0]), r16 = await scr(ring[16]);
    await drag(r0, r16, 16);
    const rot1 = await ev((i) => H3DazScene.rig(i).place.rot, id);
    const dRot = ((rot1 - rot0) % 360 + 540) % 360 - 180;
    check("dragging the ring a quarter round turns it 90°", Math.abs(dRot - 90) < 3, { rot0, rot1, dRot });
    check("…kept (the ° box)", await ev((r) => H3DazTools.cur().place.rot === r && +document.getElementById("dzPR").value === r, rot1));

    // ---- pose: the rings round a bone
    await ev(() => { H3DazTools.tab("pose"); H3DazTools.pickBone("lShldr"); }); await p.waitForTimeout(100);
    const R3 = await ev(() => H3DazGizmo.rings().map((q) => ({ ax: q.ax, kind: q.kind, axis: q.axis, c: q.c, n: q.pts.length })));
    check("🕺 a bone picked: one ring per slider axis round it (X / Y / Z)", R3.length === 3 && R3.every((q) => q.kind === "bone") && R3.map((q) => q.ax).sort().join() === "x,y,z", R3);
    const dot = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
    check("…the three axes square to each other", Math.abs(dot(R3[0].axis, R3[1].axis)) < 0.02 && Math.abs(dot(R3[0].axis, R3[2].axis)) < 0.02 && Math.abs(dot(R3[1].axis, R3[2].axis)) < 0.02, R3.map((q) => q.axis));
    // the ring that faces the camera most and is not the twist (the forearm moves)
    const pick = await ev(() => {
      const r = H3DazScene.rig(H3DazTools.cur().id), T = r.T, b = r.bones.get("lShldr"), ch = r.bones.get("lForearm"), c = b.getWorldPosition(new T.Vector3()), f = ch.getWorldPosition(new T.Vector3()), along = f.clone().sub(c).normalize();
      const cam = H3PushPull.state.V.cam(), to = cam.position.clone().sub(c).normalize();
      let best = -1, bs = -1; H3DazGizmo.rings().forEach((q, i) => { const a = new T.Vector3(...q.axis); if (Math.abs(a.dot(along)) > 0.7) return; const s = Math.abs(a.dot(to)); if (s > bs) { bs = s; best = i; } });
      return { i: best, ax: H3DazGizmo.rings()[best].ax, pts: H3DazGizmo.rings()[best].pts, c: c.toArray(), f: f.toArray() };
    });
    const c2 = await scr(pick.c), f0 = await scr(pick.f), v0 = await ev((a) => +((H3DazTools.cur().pose.lShldr || {})[a]) || 0, pick.ax);
    const ang = (o, q) => Math.atan2(o[1] - q[1], q[0] - o[0]) * 180 / Math.PI;
    let from = await scr(pick.pts[0]), to = await scr(pick.pts[8]);
    await drag(from, to, 10);
    let v1 = await ev((a) => +((H3DazTools.cur().pose.lShldr || {})[a]) || 0, pick.ax);
    if (Math.abs(v1 - v0) < 1) { from = await scr(pick.pts[0]); to = await scr(pick.pts[40]); await drag(from, to, 10); v1 = await ev((a) => +((H3DazTools.cur().pose.lShldr || {})[a]) || 0, pick.ax); }
    const lim = await ev((a) => H3DazPose.axisRows(H3DazScene.rig(H3DazTools.cur().id).daz.bones.lShldr).find((x) => x.ax === a), pick.ax);
    check("dragging a ring turns the bone on that axis, inside its limits", Math.abs(v1 - v0) >= 1 && v1 >= lim.min && v1 <= lim.max, { v0, v1, lim, ax: pick.ax });
    const f1 = await ev(() => { const r = H3DazScene.rig(H3DazTools.cur().id), T = r.T; return r.bones.get("lForearm").getWorldPosition(new T.Vector3()).toArray(); });
    const f1s = await scr(f1), dPtr = ((ang(c2, to) - ang(c2, from)) % 360 + 540) % 360 - 180, dArm = ((ang(c2, f1s) - ang(c2, f0)) % 360 + 540) % 360 - 180;
    check("…the arm turns the way the pointer went round", Math.sign(dPtr) === Math.sign(dArm) && Math.abs(dArm) > 2, { dPtr, dArm });
    check("…the slider follows", await ev((a) => { const i = document.querySelector('#dzAxes input[data-ax="' + a + '"]'); return i && Math.abs(+i.value - (+H3DazTools.cur().pose.lShldr[a])) < 0.51; }, pick.ax));
    check("…🪞 Mirror: the other arm too", await ev((a) => { const P = H3DazTools.cur().pose; return !document.getElementById("dzMirror").checked || (P.rShldr && Math.abs(P.rShldr[a]) > 0.5); }, pick.ax));

    // ---- an asset (✥): slid on the character, kept over a reload
    await ev(() => H3DazTools.tab("shape"));
    await p.locator("#dzTree .dzpiece", { hasText: "Shirt" }).locator(".dzmv").click(); await p.waitForTimeout(150);
    check("✥ on the shirt: picked to move (lit), its green ring drawn", await ev(() => H3DazTools.state.asset && H3DazTools.state.asset.name === "Shirt" && H3DazGizmo.rings().length === 1 && H3DazGizmo.rings()[0].kind === "asset" && document.querySelector("#dzTree .dzmv.on")));
    const bx0 = await ev((i) => H3DazScene.pieceBox(i, "Shirt"), id);
    const mid = [(bx0.min[0] + bx0.max[0]) / 2, (bx0.min[1] + bx0.max[1]) / 2, (bx0.min[2] + bx0.max[2]) / 2];
    const s0 = await scr(mid), hp = await ev((s) => H3DazScene.hitPiece({ clientX: s[0], clientY: s[1] }, H3DazTools.cur().id), s0);
    check("…the pointer is on the shirt", hp && hp.piece === "Shirt", hp);
    const s1 = [s0[0] + 60, s0[1]];
    await drag(s0, s1);
    const bx1 = await ev((i) => H3DazScene.pieceBox(i, "Shirt"), id), mv = await ev(() => H3DazTools.cur().pieceMove);
    const dx = (bx1.min[0] + bx1.max[0]) / 2 - mid[0], dy = (bx1.min[1] + bx1.max[1]) / 2 - mid[1], dz = (bx1.min[2] + bx1.max[2]) / 2 - mid[2];
    check("a drag slides the shirt level over the character (not the character)", Math.hypot(dx, dy) > 0.05 && Math.abs(dz) < 0.01 && (await ev((q) => H3DazScene.rig(H3DazTools.cur().id).place.x === q, p1.r.x)), { dx, dy, dz });
    check("…kept with the character (pieceMove)", mv && mv.Shirt && Math.hypot(mv.Shirt.pos[0], mv.Shirt.pos[1]) > 0.05, mv);
    await p.reload({ waitUntil: "domcontentloaded" }); await boot();
    await p.waitForFunction(() => H3DazScene.list().length === 1, null, { timeout: 60000 }); await p.waitForTimeout(500);
    const bx2 = await ev(() => H3DazScene.pieceBox(H3DazScene.list()[0], "Shirt")), pl2 = await ev(() => H3DazScene.rig(H3DazScene.list()[0]).place);
    check("over a reload: the character where it was dragged and turned, the shirt where it was slid", Math.abs(pl2.x - p1.r.x) < 1e-6 && Math.abs(pl2.rot - rot1) < 1e-6 && bx2.min.every((v, i) => Math.abs(v - bx1.min[i]) < 0.005), { pl2, bx1, bx2 });
    await ev(() => H3DazTools.pickChar(H3DazScene.list()[0])); await ev(() => H3DazTools.tree());
    await p.locator("#dzTree .dzpiece", { hasText: "Shirt" }).locator(".dzmv0").click(); await p.waitForTimeout(150);
    const bx3 = await ev(() => H3DazScene.pieceBox(H3DazScene.list()[0], "Shirt"));
    check("⟲ puts the shirt back where it was worn", JSON.stringify(await ev(() => H3DazTools.cur().pieceMove)) === "{}" && Math.abs((bx3.min[0] + bx3.max[0]) / 2 - mid[0]) < 0.01 && Math.abs((bx3.min[1] + bx3.max[1]) / 2 - mid[1]) < 0.01, { bx3, mid });
    check("no page / shader errors", errs.length === 0, errs);
    made.push(...(await ev(() => H3DazTools.state.scene.chars.map((c) => c.last).filter(Boolean))));
  } catch (e) { check("ran without throwing", false, String(e && e.stack || e)); }
  try {
    await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.(daztools\.|ppdocks|pparch)/.test(k)).forEach((k) => localStorage.removeItem(k)); });
    await p.request.post(URL_ + "api/dazlib/roots", { data: { roots: [] } });
    for (const m of made) await p.request.delete(URL_ + "api/tlcanvas/model/" + encodeURIComponent(m)).catch(() => {});
  } catch (e) { /* fine */ }
  await b.close(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exitCode = fail ? 1 : 0;
})();
