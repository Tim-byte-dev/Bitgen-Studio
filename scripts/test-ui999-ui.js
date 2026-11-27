#!/usr/bin/env node
/* bitGen Studio — 2.999.0 in a REAL browser: 👤 MAKE THIS PERSON - the References dock's pictures -> a Genesis 9 character
 * (here test-981's made-up doll, answered as "Genesis 9" by a stubbed library search) through the real fit + build routes;
 * ✨ Photo then leaves that reference out of step 1. Was based on test-ui981: test-981's made-up DOLL (OUR OWN figure, here with a skin picture + UVs).
 * Stubbed (not runnable here): the Vision model's answer (/api/dazlib/body/marks - the doll's own points at known dials,
 * drawn into a 600x1200 "photo") and the 3D engine's job (/api/dazlib/body/scan + /api/jobs/<id> - the scan .glb, a wider
 * doll with its own blue texture, is uploaded first). Real: /fit, /wrap, /build (paint photo / scan), the explorer.
 * Tim: "add both, user can try both and keep the better one" + "try the one they choose" */
"use strict";
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/", ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const t981 = fs.readFileSync(path.join(__dirname, "test-981.js"), "utf8");
  const { makeDoll, doll } = new Function("require", "path", "fs", t981.slice(t981.indexOf("const pt = "), t981.indexOf("(async () => {")) + "; return { makeDoll, doll };")(require, path, fs);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ui981_")), lib = path.join(tmp, "DollLib"), skin = path.join(tmp, "skin.png"), photo = path.join(tmp, "person.png"), stex = path.join(tmp, "scan.png");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0xc09070:s=256x256", "-frames:v", "1", skin]);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x30c040:s=600x1200", "-frames:v", "1", photo]);   // the "person": green
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x2040e0:s=64x64", "-frames:v", "1", stex]);          // the scan's colour: blue
  makeDoll(lib, { tex: skin });
  // the doll's points at known dials (in this process: the library code with the doll as its library)
  const core = require(path.join(ROOT, "lib/core")), D = require(path.join(ROOT, "lib/dazLib")), DM = require(path.join(ROOT, "lib/dazMuscle")), BF = require(path.join(ROOT, "lib/dazBodyFit")), G = require(path.join(ROOT, "lib/glbMerge"));
  const realCfg = core.getConfig; core.getConfig = () => ({ daz_library: { roots: [lib] } });
  const duf = path.join(lib, "People/Doll/Doll.duf"), fig = D.figureData(D.sceneNodes(duf).fig, duf), ix = DM.index(fig.file);
  const posOf = (set) => { const sol = DM.solve(fig.file, set, { index: ix }), V = fig.geo.vertices.values, P = new Float64Array(V.length * 3); V.forEach((q, i) => { P[i * 3] = q[0]; P[i * 3 + 1] = q[1]; P[i * 3 + 2] = q[2]; }); for (const m of sol.shape) for (const d of m.deltas) { P[d[0] * 3] += d[1] * m.w; P[d[0] * 3 + 1] += d[2] * m.w; P[d[0] * 3 + 2] += d[3] * m.w; } return P; };
  const want = { BodyWide: 0.6, LegsLength: 0.4, ArmsLength: 0.3, CTRLHeight: 0.5 }, mk = BF.marks(fig, posOf({}), 1), tp = BF.measure(mk.sets, posOf(want));
  const points = Object.fromEntries(Object.entries(tp).map(([k, q]) => [k, [(300 + q[0] * 2.8) / 600 * 1000, (1160 - q[1] * 2.8) / 1200 * 1000]]));
  // the scan: the doll wider (BodyWide 0.9), in metres x 1.7, with UVs + a blue picture
  const sc = posOf({ BodyWide: 0.9, FaceNose: 1 }) /* 3.0.0: + a nose - the head scan differs from the head */, d0 = doll(), T3 = []; for (const q of d0.p) { const vs = q.slice(2); T3.push(vs[0], vs[1], vs[2], vs[0], vs[2], vs[3]); }
  const pos = Float32Array.from(sc, (x) => x * 0.017), idx = Uint32Array.from(T3), uv = new Float32Array(pos.length / 3 * 2).fill(0.5), png = fs.readFileSync(stex);
  const pad = (b) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]), parts = [pad(Buffer.from(pos.buffer)), pad(Buffer.from(idx.buffer)), pad(Buffer.from(uv.buffer)), pad(png)];
  let off = 0; const views = parts.map((b, i) => { const v = { buffer: 0, byteOffset: off, byteLength: [pos.byteLength, idx.byteLength, uv.byteLength, png.length][i] }; off += b.length; return v; });
  const mm = (a) => { const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < a.length; i++) { mn[i % 3] = Math.min(mn[i % 3], a[i]); mx[i % 3] = Math.max(mx[i % 3], a[i]); } return { min: mn, max: mx }; };
  const scanGlb = G.glb({ asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 2 }, indices: 1, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }], textures: [{ source: 0 }], images: [{ bufferView: 3, mimeType: "image/png" }],
    accessors: [Object.assign({ bufferView: 0, componentType: 5126, count: pos.length / 3, type: "VEC3" }, mm(pos)), { bufferView: 1, componentType: 5125, count: idx.length, type: "SCALAR" }, { bufferView: 2, componentType: 5126, count: uv.length / 2, type: "VEC2" }],
    bufferViews: views, buffers: [{ byteLength: off }] }, Buffer.concat(parts));
  core.getConfig = realCfg;
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), p = await b.newPage({ viewport: { width: 2400, height: 1150 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let before = null; const made = [], calls = { marks: 0, scan: [], build: null };
  try {
    before = (await (await p.request.get(URL_ + "api/dazlib")).json());
    await p.request.post(URL_ + "api/dazlib/roots", { data: { roots: [lib] } });
    await p.route("**/api/dazlib/body/marks", (r) => { calls.marks++; r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ points, w: 600, h: 1200 }) }); });
    // the library search for Genesis 9: the doll's own entry, named Genesis 9 (+ an add-on that must NOT be picked)
    await p.route(/\/api\/dazlib\/scan\?kind=figure&q=Genesis%209/, async (r) => {
      calls.scan.push(r.request().url());
      const real = await (await p.request.get(URL_ + "api/dazlib/scan?kind=figure&q=Doll&limit=50")).json(), doll = (real.items || []).find((it) => /Doll\.duf$/.test(it.rel));
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [Object.assign({}, doll, { name: "Genesis 9 Anatomical Elements", rel: "People/Doll/nope.duf" }), Object.assign({}, doll, { name: "Genesis 9" })], roots: [lib], encrypted: 0 }) });
    });
    // the face landmarks the Vision model would give (none runs here) - added to the build's own request
    await p.route("**/api/dazlib/build", (r) => { let b0 = {}; try { b0 = JSON.parse(r.request().postData() || "{}"); } catch (e) { b0 = {}; }
      if (b0.face) b0.face.landmarks = { left_eye: [430, 300], right_eye: [570, 300], mouth: [500, 420], chin: [500, 500] }; calls.build = b0; r.continue({ postData: JSON.stringify(b0) }); });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.daztools\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3DazTools && document.getElementById("refPerson"), null, { timeout: 60000 });
    const btn = await ev(() => { const b2 = document.getElementById("refPerson"); return { inRefs: !!b2.closest("#refsdock"), title: b2.title }; });
    check("👤 in the References dock's bar (the DAZ tools' own button), its tooltip says what it does (Shift = scan + wrap)", btn.inRefs && /Genesis 9 character in the Sketcher/.test(btn.title) && /Shift\+click: scan \+ wrap/.test(btn.title), btn);
    // no picture yet -> said
    await ev(() => { refs.length = 0; });
    await p.click("#refPerson"); await p.waitForTimeout(400);
    check("no picture in the References dock: said (put a picture of the person first)", /put a picture of the person in the References dock first/.test(await ev(() => document.getElementById("refPerson").title)));
    // the person (Type person) + a face close-up (Type face)
    const dataUrl = "data:image/png;base64," + fs.readFileSync(photo).toString("base64");
    await ev((u) => { refs.length = 0; refs.push({ url: u, role: "person", name: "ui999_person.png" }); refs.push({ url: u, role: "face", name: "ui999_face.png" }); }, dataUrl);
    const bP = p.waitForResponse((r) => r.url().includes("/api/dazlib/build"), { timeout: 180000 });
    await p.click("#refPerson");
    const build = await (await bP).json(); made.push(["models3d", build.model]);
    await p.waitForFunction(() => /👤 .* - made from|⚠/.test((document.getElementById("dzMsg") || {}).textContent || ""), null, { timeout: 120000 });
    if (process.env.DBG) console.log(JSON.stringify(await ev(() => H3DazTools.state.scene.chars.map((c) => ({ n: c.name, last: c.last, inScene: c.inScene, from: c.fromRefs })))));
    const st = await ev(() => ({ msg: document.getElementById("dzMsg").textContent, info: H3DazTools.info(), c: H3DazTools.cur(), carried: H3DazTools.carried(), on: H3DazTools.state.on, head: document.getElementById("dzHead").value, photo: H3DazTools.state.photo }));
    check("👤 click: the DAZ tools opened, the plainest Genesis 9 picked (not the add-on), a new character made from it and BUILT through the real routes",
      st.on && calls.scan.length === 1 && st.info.chars === 2 && /^Genesis 9 · 📷 A/.test(st.info.sel) && st.c.last === build.model && /👤 .* - made from the References dock's pictures/.test(st.msg), st);
    check("…the body from the person picture (the real fit moved the dials), the head from the FACE close-up (sent to the build as its 🙂 face)", Object.keys(st.c.dials).length >= 3 && st.c.face && /ui999_face/.test(st.c.face.picture) && calls.build && /ui999_face/.test(calls.build.face.picture) && calls.marks >= 1, { dials: st.c.dials, face: st.c.face, marks: calls.marks });
    check("…the character remembers its pictures (fromRefs); the 📷 panel's own choices put back (head, picked photo)", st.carried.length === 2 && st.carried.map((x) => x.name).join() === "ui999_person.png,ui999_face.png" && st.carried.every((x) => x.url === "") && st.head === "photo" && !st.photo, { carried: st.carried, head: st.head, photo: st.photo });
    // ✨ Photo: the references the 👤 character carries stay out of step 1
    const ra = await ev(() => { const R = H3SketcherReal, t = R.refTiles(refs), f = R.refsForAngle(R.plan("", false, t).subject, 10, H3DazTools.carried()), p0 = R.plan("", false, t); p0.carriedOut = f.carriedOut; p0.faceOut = []; return { keep: f.keep.length, out: f.carriedOut.length, use: R.refUse(p0, t) }; });
    check("✨ Photo: both pictures left out of step 1 (the character carries that face), said so", ra.keep === 0 && ra.out === 2 && ra.use.every((u) => /the 👤 character in the scene was made from it/.test(u)), ra);
    // 3.0.0: 🙂 a REAL 3D head - the doll's scan (its whole body, wider: a "bust" - the head band found above the shoulders)
    const up = await (await p.request.post(URL_ + "api/tlcanvas/model?name=ui999_headscan.glb", { data: scanGlb, headers: { "Content-Type": "application/octet-stream" } })).json();
    made.push(["models3d", up.name || "ui999_headscan.glb"]);
    const hw = await (await p.request.post(URL_ + "api/dazlib/head/wrap", { data: { root: lib, rel: "People/Doll/Doll.duf", dials: [], scan: up.name || "ui999_headscan.glb", name: "ui999 head" } })).json();
    const mf = (() => { try { const d = path.join(ROOT, "projects"); for (const pr of fs.readdirSync(d)) { const f = path.join(d, pr, "dazmorphs", hw.custom + ".json"); if (fs.existsSync(f)) return f; } } catch (e) { /* none */ } return null; })();
    const morph = mf ? JSON.parse(fs.readFileSync(mf, "utf8")) : null; if (mf) made.push(["dazmorphs", hw.custom + ".json"]);
    check("3.0.0 POST /api/dazlib/head/wrap on the doll: its head found from its bones, the scan's head band put on it, ONLY the head (and its neck) moved - a custom morph (head: true)",
      hw.custom && hw.head_vertices > 0 && hw.moved_vertices > 0 && hw.moved_vertices < hw.vertices / 3 && morph && morph.head === true && morph.deltas.length === hw.moved_vertices && hw.align.s > 0, { hw, n: morph && morph.deltas.length });
    const bad = await (await p.request.post(URL_ + "api/dazlib/head/wrap", { data: { root: lib, rel: "People/Doll/Doll.duf", scan: "nope.glb" } }));
    check("…a scan that is not there: 404, said", bad.status() === 404 && /not in the project's 3D models/.test((await bad.json()).error));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.message); }
  try { await ev(() => { refs.length = 0; Object.keys(localStorage).filter((k) => /^h3\.daztools\./.test(k)).forEach((k) => localStorage.removeItem(k)); }); } catch (e) { /* fine */ }
  try { await p.request.post(URL_ + "api/dazlib/roots", { data: { roots: (before && before.roots && before.detected && before.roots.join() !== before.detected.join()) ? before.roots : [] } }); } catch (e) { /* fine */ }
  try { const d = path.join(ROOT, "projects"); for (const pr of fs.readdirSync(d)) for (const [k, n] of made) { const f = path.join(d, pr, k, String(n || "")); if (n && fs.existsSync(f) && fs.statSync(f).isFile()) fs.unlinkSync(f); } } catch (e) { /* fine */ }
  try { const d = path.join(ROOT, "projects"); for (const pr of fs.readdirSync(d)) { const im = path.join(d, pr, "images"); for (const f of fs.existsSync(im) ? fs.readdirSync(im) : []) if (/^ui999_/.test(f)) fs.unlinkSync(path.join(im, f)); } } catch (e) { /* fine */ }
  fs.rmSync(tmp, { recursive: true, force: true });
  await b.close();
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
