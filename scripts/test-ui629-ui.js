#!/usr/bin/env node
/* bitGen Studio — 2.629.0 in a REAL browser: THE SKETCHER GETS THE HOUSE BUILDER'S MATERIALS, 📷 CAMERAS (SHOT + DEPTH + NORMAL
 * MAPS, 📍 360° LOCATIONS) AND 🪄 FURNISH; THE FURNITURE IS EXPORTED.
 * Tim: "add the furniture pack and asset pack from homebuilder to sketcher and delete homeluilder ext and docker ..." (asked:
 * the asset pack = the project's 3D models + its materials; its cameras / locations / Furnish / people / floors move too)
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.629.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_cam629_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-3);

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: PN });
    await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.PPCam && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await p.waitForTimeout(600);
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); if (d.classList.contains("collapsed")) toggleCollapse("pushpulldock"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.A, null, { timeout: 40000 });
    await p.waitForTimeout(400);
    const scr = (w) => ev((w) => { const V = H3PushPull.state.V, s = V.screen(w), r = V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, w);
    const click = async (w) => { const [x, y] = await scr(w); await p.mouse.move(x, y, { steps: 3 }); await p.mouse.click(x, y); await p.waitForTimeout(200); };
    const AR = () => ev(() => JSON.parse(JSON.stringify(H3PushPull.state.M.arch || {})));
    const msg = () => ev(() => document.getElementById("ppMsg").textContent);

    /* ▦ Materials */
    await ev(() => { const S = H3PushPull.state; const M = PPGeo.newModel(); const F = PPGeo.addFace(M, PPGeo.rectPts([0, 0, 0], [2, 1, 0], [0, 0, 1])); PPGeo.pushPull(M, F.id, 1); M.arch = PPArch.empty(); PPArch.addRoom(M.arch, [[4, 0], [8, 0], [8, 4], [4, 4]]); S.M = M; S.V.setModel(M); S.V.view("iso"); S.V.extents(); });
    await p.waitForTimeout(300);
    await p.click("#ppMatBtn"); await p.waitForTimeout(200);
    const items = await ev(() => [...document.querySelectorAll(".ppmenu div")].map((d) => d.textContent));
    await ev(() => { const x = [...document.querySelectorAll(".ppmenu div")].find((d) => /Brick/.test(d.textContent)); x.click(); });
    await p.waitForTimeout(150);
    const col = await ev(() => H3PushPull.state.color);
    check("▦ Materials ▾: the House builder's materials (Brick, Stone, Oak floor, Tiles, Marble, Carpet …) - Brick = the paint", items.some((t) => /Brick/.test(t)) && items.some((t) => /Oak floor/.test(t)) && items.some((t) => /Marble/.test(t)) && col === "mat:brick", { items: items.slice(0, 8), col });
    await click([1, 0, 0.5]);
    const fm = await ev(() => { const S = H3PushPull.state, F = S.M.f.find((F) => F.mat === "mat:brick"); let tex = false; S.V.scene.traverse((o) => { if (o.isMesh && o.material && o.material.map && o.geometry.attributes.uv && o.parent && o.parent.parent === S.V.scene) tex = true; }); return { has: !!F, tex }; });
    check("…a face painted Brick: textured (metre UVs)", fm.has && fm.tex, fm);
    await ev(() => { const x = H3PushPull.state; x.T.use("paint"); });
    await click([6, 0, 1.2]);
    const wc = await ev(() => H3PushPull.state.M.arch.rooms[0].wall + "|" + H3PushPull.state.M.arch.ext);
    check("…a wall painted with it too (the building keeps \"mat:brick\")", /mat:brick/.test(wc), wc);
    const kept = await ev(() => { const j = PPGeo.toJson(H3PushPull.state.M), m = PPGeo.fromJson(JSON.parse(JSON.stringify(j))); return { f: m.f.some((F) => F.mat === "mat:brick"), a: /mat:brick/.test(JSON.stringify(m.arch)) }; });
    check("…kept when saved and opened again", kept.f && kept.a, kept);

    /* 📷 a camera: two clicks */
    await ev(() => { const S = H3PushPull.state; S.V.view("top"); S.V.extents(); });
    await p.keyboard.press("z"); await p.waitForTimeout(150);
    await click([5, 2, 0]); await click([7.5, 2, 0]);
    let A = await AR();
    const c = A.cams && A.cams[0];
    check("📷 Camera (Z): click where it stands, click where it looks - 1.6 m up, looking +x (0°)", c && near(c.x, 5, 0.1) && near(c.y, 2, 0.1) && near(c.z, 1.6) && (c.yaw < 3 || c.yaw > 357), A.cams);
    const pn = await ev(() => document.getElementById("ppProps").textContent);
    check("…picked: its panel - Name, Eye height, Turn, Tilt, Lens, 👁 Look through, 📷 Shot + depth + normal, 📍 360° location", /📷 Camera 1/.test(pn) && /Tilt/.test(pn) && /Look through/.test(pn) && /Shot \+ depth \+ normal/.test(pn) && /360° location/.test(pn), pn.slice(0, 300));
    await ev(() => [...document.querySelectorAll("#ppProps button")].find((x) => /Look through/.test(x.textContent)).click());
    const lt = await ev(() => { const k = H3PushPull.state.V.cam().position; return [k.x, k.y, k.z]; });
    check("👁 Look through: the view stands at the camera", near(lt[0], 5, 0.1) && near(lt[1], 2, 0.1) && near(lt[2], 1.6, 0.1), lt);
    const shots = await ev(async () => { const S = H3PushPull.state, c = S.M.arch.cams[0]; return S.T.arch.camShots(c); });
    const assets = JSON.stringify(await api("/api/passets"));
    check("📷 Shot + depth + normal: three pictures in the project's Image assets", shots && /_shot\.png$/.test(shots.shot) && /_depth\.png$/.test(shots.depth) && /_normal\.png$/.test(shots.normal) && [shots.shot, shots.depth, shots.normal].every((n) => assets.includes(n)), { shots });
    // the 360°: a red block east (+x, ahead), a blue one north (+y, to the left)
    const pano = await ev(async () => {
      const S = H3PushPull.state, M = S.M;
      const red = PPGeo.addFace(M, PPGeo.rectPts([9, 1.5, 0], [10, 2.5, 0], [0, 0, 1]), { mat: "#ff0000" }); PPGeo.pushPull(M, red.id, 3);
      const blue = PPGeo.addFace(M, PPGeo.rectPts([4.5, 7, 0], [5.5, 8, 0], [0, 0, 1]), { mat: "#0000ff" }); PPGeo.pushPull(M, blue.id, 3);
      S.M.arch.rooms = []; S.V.setModel(M); S.A.rebuild();
      const c = S.M.arch.cams[0], cv = S.V.pano([c.x, c.y, c.z], c.yaw, 1024), g = cv.getContext("2d");
      const px = (u) => { const d = g.getImageData(Math.round(u * 1024), 256, 1, 1).data; return [d[0], d[1], d[2]]; };
      return { w: cv.width, h: cv.height, mid: px(0.5), left: px(0.25), right: px(0.75) };
    });
    const redish = (c) => c[0] > 80 && c[1] < 40 && c[2] < 40, blueish = (c) => c[2] > 120 && c[0] < 90;
    check("the 360° panorama: 2:1, the camera's way in the middle (the red block east), north to the left (the blue block)", pano.w === 1024 && pano.h === 512 && redish(pano.mid) && blueish(pano.left) && !blueish(pano.right), pano);
    const loc = await ev(async () => { const S = H3PushPull.state; return S.T.arch.camLocation(S.M.arch.cams[0]); });
    const envs = JSON.stringify(await api("/api/environments"));
    check("📍 360° location: a Location made from it (its name / @tag), listed with the others", loc && loc.name && envs.includes(loc.name), { loc: loc && { name: loc.name, tag: loc.tag }, m: await msg() });

    /* 🪄 Furnish */
    await ev(() => { const S = H3PushPull.state; S.M.arch.rooms = []; PPArch.addRoom(S.M.arch, [[0, -6], [5, -6], [5, -2], [0, -2]], { name: "Living room" }); S.V.setModel(S.M); S.A.rebuild(); S.T.use("select"); S.T.arch.setSel({ ak: "room", id: S.M.arch.rooms[0].id }); });
    await p.waitForTimeout(200);
    const hasF = await ev(() => !!document.getElementById("ppFurnWords"));
    const fj = await ev(async () => { const S = H3PushPull.state; document.getElementById("ppFurnWords").value = "a sofa and a coffee table"; return S.T.arch.furnishRoom(S.M.arch.rooms[0], "a sofa and a coffee table"); });
    A = await AR();
    const inRoom = (A.items || []).every((it) => it.x > -0.1 && it.x < 5.1 && it.y > -6.1 && it.y < -1.9);
    check("🪄 Furnish (the room's panel): the House builder's furnisher fills the room - its pieces inside it", hasF && fj && !fj.error && (A.items || []).length >= 2 && inRoom, { n: (A.items || []).length, by: fj && fj.by, kind: fj && fj.kind, items: (A.items || []).map((x) => [x.type, x.x, x.y]) });
    /* the furniture exported */
    const ex = await ev(() => { const S = H3PushPull.state; return S.A.exportMeshes().reduce((n, m) => n + m.idx.length / 3, 0); });
    const ex0 = await ev(() => { const S = H3PushPull.state, keep = S.M.arch.items; S.M.arch.items = []; S.A.rebuild(); const n = S.A.exportMeshes().reduce((n, m) => n + m.idx.length / 3, 0); S.M.arch.items = keep; S.A.rebuild(); return n; });
    check("⤓ .glb / .obj: the furniture goes with the building now", ex > ex0 + 50, { with: ex, without: ex0 });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e.stack || e)); }
  finally {
    try { await ev(() => { if (H3PushPullFrame.maxed()) H3PushPullFrame.toggleMaxed(false); }); } catch { /* fine */ }
    await b.close();
    try { await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
