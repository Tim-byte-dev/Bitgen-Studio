#!/usr/bin/env node
/* bitGen Studio — 2.981.0 in a REAL browser: 📷 a Daz body from a photo - BOTH ways through the real routes, the user picks
 * one per ▶ Try and keeps the better character. test-981's made-up DOLL (OUR OWN figure, here with a skin picture + UVs).
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
  const sc = posOf({ BodyWide: 0.9 }), d0 = doll(), T3 = []; for (const q of d0.p) { const vs = q.slice(2); T3.push(vs[0], vs[1], vs[2], vs[0], vs[2], vs[3]); }
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
  let before = null; const made = [], calls = { marks: 0, scan: 0, job: 0 };
  try {
    before = (await (await p.request.get(URL_ + "api/dazlib")).json());
    await p.request.post(URL_ + "api/dazlib/roots", { data: { roots: [lib] } });
    const up = await (await p.request.post(URL_ + "api/tlcanvas/model?name=ui981_scan.glb", { data: scanGlb, headers: { "Content-Type": "application/octet-stream" } })).json();
    const ph = await (await p.request.post(URL_ + "api/dazlib/photo?name=ui981_person.png", { data: fs.readFileSync(photo), headers: { "Content-Type": "image/png" } })).json();
    made.push(["images", ph.name]);
    await p.route("**/api/dazlib/body/marks", (r) => { calls.marks++; r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ points, w: 600, h: 1200 }) }); });
    await p.route("**/api/dazlib/body/scan", (r) => { calls.scan++; r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ job: "ui981job", model: up.name || "ui981_scan.glb" }) }); });
    await p.route("**/api/jobs/ui981job", (r) => { calls.job++; r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "ui981job", status: calls.job < 2 ? "running" : "done" }) }); });
    await p.route("**/api/models/check", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ checked: true, missing: [] }) }));
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.daztools\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3DazTools , null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); }); await p.waitForSelector("#ppDazLib", { state: "visible", timeout: 20000 }); await p.click("#ppDazLib");   // 3.2.0: the Sketcher's 📚 DAZ (no menu-bar button)
    await p.waitForSelector("#dzLib .dzit", { timeout: 15000 });
    await p.click("#dzGrid .dzit");
    await p.waitForSelector("#dzDials .dzdial", { timeout: 10000 });
    await p.click("#dzPhoto summary");
    await p.waitForSelector("#dzPhotoPick [data-src]", { timeout: 5000 }).catch(() => {});
    const s0 = await ev(() => ({ pick: !!document.querySelector("#dzPhotoPick select, #dzPhotoPick [data-src], #dzPhotoPick button"), routes: [...document.querySelectorAll("#dzRoute option")].map((o) => o.value), b: document.getElementById("dzBOpts").hidden }));
    check("🧭 Explorer ▸ 📷 Body from a photo: the picture picker, the two ways (A / B), B's options hidden while A is picked", s0.pick && s0.routes.join() === "A,B" && s0.b, s0);
    await ev((n) => { H3DazTools.state.photo = { name: n, where: "images" }; }, ph.name);
    // A
    await p.selectOption("#dzPaint", "body");
    const fitP = p.waitForResponse((r) => r.url().includes("/api/dazlib/body/fit"), { timeout: 60000 }), bA = p.waitForResponse((r) => r.url().includes("/api/dazlib/build"), { timeout: 120000 });
    await p.click("#dzTry");
    const fit = await (await fitP).json(), buildA = await (await bA).json();
    await p.waitForFunction(() => /Compare it|⚠/.test(document.getElementById("dzMsg").textContent), null, { timeout: 60000 });
    const byUrl = Object.fromEntries((fit.dials || []).map((d) => [decodeURIComponent(d.url.split("#").pop()), d.value]));
    check("A ▶ Try: the real fit finds the doll's dials from its points (each within 0.07), the error down", Object.keys(want).every((k) => Math.abs((byUrl[k] || 0) - want[k]) < 0.07) && fit.error.after < 0.03, { byUrl, err: fit.error });
    made.push(["models3d", buildA.model]);
    const iA = await ev(() => ({ info: H3DazTools.info(), msg: document.getElementById("dzMsg").textContent, c: H3DazTools.cur() }));
    check("A: a NEW character \"Doll · 📷 A\" in the explorer (the original kept), its dials set, built", iA.info.chars === 2 && iA.info.sel === "Doll · 📷 A" && Object.keys(iA.c.dials).length === 4 && iA.c.last === buildA.model && /A: \d+ dial/.test(iA.msg), iA);
    check("A: the photo painted into the doll's own textures (both materials) - its colour in the .glb", buildA.info.face && buildA.info.face.painted && buildA.info.face.materials.length === 2 && !buildA.info.warnings.some((w) => /paint/.test(w)), buildA.info);
    // B
    await p.click('#dzTree .dzc:not(.sel)');
    await p.selectOption("#dzRoute", "B");
    check("B picked: its options shown (3D engine, turn)", !(await ev(() => document.getElementById("dzBOpts").hidden)));
    const wrapP = p.waitForResponse((r) => r.url().includes("/api/dazlib/body/wrap"), { timeout: 60000 }), bB = p.waitForResponse((r) => r.url().includes("/api/dazlib/build") && r.request().postData().includes("custom\":[\""), { timeout: 120000 });
    await p.click("#dzTry");
    const wr = await (await wrapP).json(), buildB = await (await bB).json();
    await p.waitForFunction(() => /Compare it|⚠/.test(document.getElementById("dzMsg").textContent), null, { timeout: 60000 });
    made.push(["models3d", buildB.model], ["dazmorphs", wr.custom + ".json"]);
    check("B ▶ Try: the scan job followed (polled until done), the doll wrapped onto the wider scan - a morph of its own", calls.scan === 1 && calls.job >= 2 && wr.moved_vertices > 50 && wr.moved_mm > 1 && /Doll/.test(wr.custom), { wr, calls });
    const iB = await ev(() => ({ info: H3DazTools.info(), c: H3DazTools.cur(), names: H3DazTools.state.scene.chars.map((c) => c.name) }));
    check("B: a third character \"Doll · 📷 B\" - the morph on it, the scan's colours baked into its UVs", iB.names.join("|") === "Doll|Doll · 📷 A|Doll · 📷 B" && iB.c.custom.length === 1 && buildB.info.dials.some((d) => d.label === "📷 " + wr.custom) && buildB.info.face && buildB.info.face.painted && buildB.info.face.materials.length >= 1, { iB, info: buildB.info });
    const gB = G.parse(Buffer.from(await (await p.request.get(URL_ + "api/tlcanvas/model/" + encodeURIComponent(buildB.model))).body())).json;
    const acc = gB.accessors[gB.meshes[0].primitives[0].attributes.POSITION], acc0 = (await (await p.request.post(URL_ + "api/dazlib/build", { data: { root: lib, rel: "People/Doll/Doll.duf", name: "ui981_plain" } })).json());
    made.push(["models3d", acc0.model]);
    const g0 = G.parse(Buffer.from(await (await p.request.get(URL_ + "api/tlcanvas/model/" + encodeURIComponent(acc0.model))).body())).json, a0 = g0.accessors[g0.meshes[0].primitives[0].attributes.POSITION];
    check("B: the wrapped body is wider than the plain doll (the scan's shape)", (acc.max[0] - acc.min[0]) >= (a0.max[0] - a0.min[0]) - 1e-6 && (acc.max[2] - acc.min[2]) > (a0.max[2] - a0.min[2]) + 0.005, { b: [acc.min, acc.max], plain: [a0.min, a0.max] });
    // keep the better one
    await p.click('#dzTree .dzc[data-char="' + iA.c.id + '"] [data-del]');
    check("keep the better one: ✕ the other try - the original and B stay", (await ev(() => H3DazTools.state.scene.chars.map((c) => c.name).join("|"))) === "Doll|Doll · 📷 B");
    check("the Vision model asked once (for A); B paints from its scan (no ask)", calls.marks === 1, calls);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.message); }
  try { await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.daztools\./.test(k)).forEach((k) => localStorage.removeItem(k)); }); } catch (e) { /* fine */ }
  try { await p.request.post(URL_ + "api/dazlib/roots", { data: { roots: (before && before.roots && before.detected && before.roots.join() !== before.detected.join()) ? before.roots : [] } }); } catch (e) { /* fine */ }
  try { const d = path.join(ROOT, "projects"); for (const pr of fs.readdirSync(d)) for (const [k, n] of made.concat([["models3d", "ui981_scan.glb"]])) { const f = path.join(d, pr, k, String(n || "")); if (n && fs.existsSync(f) && fs.statSync(f).isFile()) fs.rmSync(f); } } catch (e) { /* fine */ }
  fs.rmSync(tmp, { recursive: true, force: true });
  await b.close();
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
