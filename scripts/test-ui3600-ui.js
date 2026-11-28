#!/usr/bin/env node
/* bitGen Studio — 3.6.0 in a REAL browser: 📽 PROJECT A PICTURE ONTO A SKETCHER MODEL - the 📽 button's popup, a picture picked
 * from Assets, ▶ from the front view: the front walls show the picture (pixels), undo / redo, saved and opened again, the .glb
 * carries it as a texture, 🗑 takes it off. The maths: scripts/test-3600.js. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 3.6.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_proj3600_" + process.pid, PIC = "zz_proj3600_" + process.pid + ".png";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
// a 64 × 64 red / blue checker PNG (zlib + crc by hand) - colours no wall of the model has
function checkerPng() {
  const zlib = require("zlib"), W = 64, H = 64, raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; for (let x = 0; x < W; x++) { const on = ((x >> 3) + (y >> 3)) % 2 === 0, o = y * (W * 3 + 1) + 1 + x * 3; raw[o] = on ? 235 : 20; raw[o + 1] = 20; raw[o + 2] = on ? 20 : 235; } }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

(async () => {
  try { const r = await fetch(URL_); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL_); process.exit(0); }
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  // the colour under a world point (the view drawn now)
  const px = async (w) => { await p.waitForTimeout(250); return ev((w) => { const V = H3PushPull.state.V; V.R.render(V.scene, V.cam()); const c = V.canvas, k = c.width / c.getBoundingClientRect().width, t = document.createElement("canvas"); t.width = c.width; t.height = c.height; const g = t.getContext("2d"); g.drawImage(c, 0, 0); const s = V.screen(w); const d = g.getImageData(Math.round(s[0] * k), Math.round(s[1] * k), 1, 1).data; return [d[0], d[1], d[2]]; }, w); };
  const checker = (c) => (c[0] > c[1] + 40 && c[0] > c[2] + 30) || (c[2] > c[1] + 40 && c[2] > c[0] + 30);   // red or blue (lit or shaded) - the picture
  const shot = async (n) => { if (process.env.H3_SHOT) await p.screenshot({ path: path.join(process.env.H3_SHOT, n + ".png") }); };
  try {
    await api("/api/projects/new", { name: PN }); await api("/api/projects/load", { name: PN });
    const up = await (await fetch(URL_ + "api/dazlib/photo?name=" + encodeURIComponent(PIC), { method: "POST", headers: { "Content-Type": "image/png" }, body: checkerPng() })).json();
    check("the checker picture saved in the project's images", up && up.name, up);
    const picName = up.name;
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.PPProject && window.H3PicPick && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); (localStorage.setItem("h3.dockmax.off", "1"), H3PushPullFrame.toggleMaxed(true)); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.A && H3PushPull.state.T, null, { timeout: 40000 });
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(), A = S.M.arch = PPArch.empty(); PPArch.addRoom(A, [[0, 0], [5, 0], [5, 4], [0, 4]], { name: "Kitchen" }); PPArch.addRoom(A, [[5, 0], [9, 0], [9, 4], [5, 4]], { name: "Bed" });
      H3PushPull.commit("rooms", b0); S.V.view("front"); S.V.extents(); S.T.use("select"); });
    await p.waitForTimeout(600);
    const W = [2.5, -0.12, 1.4], W2 = [7, -0.12, 1.4], BACK = [2.5, 4.12, 1.4];   // the front of each room (y = 0), the back wall
    const before = await px(W);
    check("before: the front wall is not the picture's colours", !checker(before), before);

    /* ---- 📽 -> the popup -> Assets -> the picture -> ▶ */
    check("the 📽 button is on the Sketcher's bar", await ev(() => !!document.getElementById("ppProj") && document.getElementById("ppProj").offsetParent !== null));
    await p.click("#ppProj"); await p.waitForSelector("#ppProjPop", { timeout: 3000 });
    check("📽 opens the popup with the picture picker (Gallery / Assets / References / Folder / File)", await ev(() => document.querySelectorAll("#ppProjPop .ppp-tabs button").length === 5 && /no pictures projected yet/.test(document.getElementById("ppjList").textContent)));
    await p.click('#ppProjPop [data-src="assets"]');
    await p.waitForSelector('#ppProjPop .ppp-t[title="' + picName + '"]', { timeout: 8000 });
    await p.click('#ppProjPop .ppp-t[title="' + picName + '"]');
    await p.click("#ppjGo");
    await p.waitForFunction(() => /part/.test((document.getElementById("ppjSay") || {}).textContent || "") || /⚠/.test((document.getElementById("ppjSay") || {}).textContent || ""), null, { timeout: 15000 });
    const st = await ev(() => { const A = H3PushPull.state.M.arch, pr = (A.proj || [])[0]; return { n: (A.proj || []).length, pr, say: document.getElementById("ppjSay").textContent, rows: document.querySelectorAll("#ppjList .ppj-row").length, meshes: PPProject.state().group ? PPProject.state().group.children.length : 0 }; });
    const ids = await ev(() => H3PushPull.state.M.arch.rooms.map((R) => R.id));
    check("▶ throws it from the view: one projection on the model, listed in the popup", st.n === 1 && st.pr.src === "/passets/images/" + picName && st.rows === 1 && st.meshes === 1 && st.pr.cam.kind === "persp", st);
    check("…onto what the view sees: both rooms' front walls (each wall its own), never a back wall", st.pr.parts.includes("wall:" + ids[0] + ":0") && st.pr.parts.includes("wall:" + ids[1] + ":0") && !st.pr.parts.some((k) => /^wall:\d+:2$/.test(k)), { parts: st.pr.parts, ids });
    await p.waitForTimeout(800);   // the texture loads
    const after = await px(W), after2 = await px(W2);
    await shot("ui3600_projected");
    check("the front walls show the picture (red / blue) in the view", checker(after) && checker(after2), { after, after2 });
    await ev(() => H3PushPull.state.V.view("back"));
    const behind = await px(BACK);
    check("from the back: the back wall keeps its own colour (it faced away from the projector)", !checker(behind), behind);
    await ev(() => H3PushPull.state.V.view("front")); await ev(() => H3PushPull.state.V.extents());

    /* ---- undo / redo */
    await ev(() => H3PushPull.undo());
    check("↶ undo takes it off (no overlay)", await ev(() => (H3PushPull.state.M.arch.proj || []).length === 0 && PPProject.state().group.children.length === 0));
    await ev(() => H3PushPull.redo());
    check("↷ redo puts it back", await ev(() => H3PushPull.state.M.arch.proj.length === 1 && PPProject.state().group.children.length === 1));

    /* ---- kept with the model: saved, opened again */
    const nm = await ev(async () => { const j = await H3PushPull.save(true); await H3PushPull.newModel(); await new Promise((r) => setTimeout(r, 400)); await H3PushPull.open(j.name); await new Promise((r) => setTimeout(r, 600)); return j.name; });
    const re = await ev(() => { const A = H3PushPull.state.M.arch; return { n: (A.proj || []).length, parts: A.proj && A.proj[0] && A.proj[0].parts.length, meshes: PPProject.state().group.children.length }; });
    check("saved and opened again: the projection comes back with the model (" + nm + ")", re.n === 1 && re.parts > 0 && re.meshes === 1, re);

    /* ---- the .glb: the picture inside as a texture */
    const g = await ev(async () => {
      const bytes = await H3PushPull.glbOut(H3PushPull.meshes(), false), dv = new DataView(bytes.buffer, bytes.byteOffset), jl = dv.getUint32(12, true), j = JSON.parse(new TextDecoder().decode(bytes.slice(20, 20 + jl)));
      const prims = j.meshes[0].primitives, tp = prims.filter((x) => x.attributes.TEXCOORD_0 != null);
      return { images: (j.images || []).length, mime: j.images && j.images[0].mimeType, textured: tp.length, plain: prims.length - tp.length, tex: tp[0] && j.materials[tp[0].material].pbrMetallicRoughness.baseColorTexture };
    });
    check("⤓ .glb: the projected picture inside (an image, a textured primitive with TEXCOORD_0) and the rest of the model plain",
      g.images === 1 && g.mime === "image/png" && g.textured === 1 && g.plain >= 1 && g.tex && g.tex.index === 0, g);
    const saved = await ev(() => H3PushPull.toProject("glb"));
    const L = await api("/api/tlcanvas/models");
    check("⤓ into the project's 3D models (the way to Blender / Unreal / the timeline) works with it", (L.models || []).some((x) => x.name === saved), { saved });

    /* ---- the popup's list: hide, 🗑 */
    await p.evaluate(() => { PPProject.close(); }); await p.click("#ppProj"); await p.waitForSelector("#ppProjPop .ppj-row");
    await p.click("#ppProjPop .ppj-row input[type=checkbox]");
    check("☐ in the list hides it (kept on the model, no overlay)", await ev(() => H3PushPull.state.M.arch.proj.length === 1 && H3PushPull.state.M.arch.proj[0].on === false && PPProject.state().group.children.length === 0));
    await p.click('#ppProjPop .ppj-row [data-a="del"]');
    check("🗑 takes it off the model", await ev(() => H3PushPull.state.M.arch.proj.length === 0 && document.querySelectorAll("#ppjList .ppj-row").length === 0));
    await p.click("#ppjX");
    check("✕ closes the popup", await ev(() => !document.getElementById("ppProjPop")));

    /* ---- only what is picked */
    await ev(() => { const S = H3PushPull.state; S.T.arch.setSel({ ak: "room", id: S.M.arch.rooms[1].id, part: "wall", edge: 0 }); });
    const only2 = await ev(async (pic) => { const r = await PPProject.project(H3PushPull, { src: "/passets/images/" + pic, name: "only" }, true).catch((e) => ({ err: e.message })); const pr = H3PushPull.state.M.arch.proj; return { r, parts: pr[pr.length - 1] && pr[pr.length - 1].parts }; }, picName);
    check("◉ only what is picked: the picked wall alone", only2.parts && only2.parts.length === 1 && /^wall:\d+:0$/.test(only2.parts[0]), only2);
    await p.waitForTimeout(600);
    const k1 = await px(W), k2 = await px(W2);
    check("…so the Kitchen's front stays its own colour and the Bed's front shows the picture", !checker(k1) && checker(k2), { k1, k2 });

    check("no page errors", !errs.length, errs);
  } catch (e) { check("the run finished: " + (e.message || e), false); }
  finally {
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); await fetch(URL_ + "api/projects/" + encodeURIComponent(PN), { method: "DELETE" }); } catch (e) { /* fine */ }
  }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
