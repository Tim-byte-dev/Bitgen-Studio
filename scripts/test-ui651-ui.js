#!/usr/bin/env node
/* bitGen Studio — 2.651.0 in a REAL browser: THE SKETCHER'S MATERIAL TOOLS - a wall's inside and outside, the glass, a picture
 * (a reference / a file) as a texture, the paint bucket on ONE wall side, the 🖼 background (a backdrop / a 360° sky).
 * Tim (verbatim): "can we add material tools to sketcher, so wall_1 interior, wall_1 exterior, windows, etc, and use reference
 * images for the texture, background etc." Against the running app (H3_URL). No Playwright = SKIP. H3_SHOT=<dir>: pictures. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.651.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_mat651_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
// a 64 × 64 red / white checker PNG (no libraries: zlib + crc by hand)
function checkerPng() {
  const zlib = require("zlib"), W = 64, H = 64, raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; for (let x = 0; x < W; x++) { const on = ((x >> 4) + (y >> 4)) % 2 === 0, o = y * (W * 3 + 1) + 1 + x * 3; raw[o] = 230; raw[o + 1] = on ? 30 : 230; raw[o + 2] = on ? 30 : 230; } }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const scr = (w) => ev((w) => { const V = H3PushPull.state.V, s = V.screen(w), r = V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, w);
  const px = async (w) => { await p.waitForTimeout(200); return ev((w) => { const V = H3PushPull.state.V; V.R.render(V.scene, V.cam()); const c = V.canvas, k = c.width / c.getBoundingClientRect().width, t = document.createElement("canvas"); t.width = c.width; t.height = c.height; const g = t.getContext("2d"); g.drawImage(c, 0, 0); const s = Array.isArray(w) && w.length === 3 ? V.screen(w) : w.s; const d = g.getImageData(Math.round(s[0] * k), Math.round(s[1] * k), 1, 1).data; return [d[0], d[1], d[2]]; }, w); };
  const rowBtn = (label) => ev((l) => { const r = [...document.querySelectorAll("#ppProps .ppr")].find((x) => x.querySelector("span") && x.querySelector("span").textContent === l); const b = r && r.querySelector("button.ppmatbtn"); if (!b) return null; const q = b.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; }, label);
  const shot = async (n) => { if (process.env.H3_SHOT) await p.screenshot({ path: path.join(process.env.H3_SHOT, n + ".png") }); };
  try {
    await api("/api/projects/new", { name: PN }); await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.PPMatPick && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.A && H3PushPull.state.T, null, { timeout: 40000 });
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(), A = S.M.arch = PPArch.empty(); const K = PPArch.addRoom(A, [[0, 0], [5, 0], [5, 4], [0, 4]], { name: "Kitchen" }); PPArch.addRoom(A, [[5, 0], [9, 0], [9, 4], [5, 4]], { name: "Bed" });
      PPArch.addOp(A, "window", 1.2, { room: K.id, edge: 0, at: 1.5 }); H3PushPull.commit("rooms", b0); S.V.view("iso"); S.V.extents(); S.T.use("select"); });
    await p.waitForTimeout(500);

    /* ---- a wall's panel: Inside + Outside, each its own material */
    await ev(() => { const S = H3PushPull.state; S.T.arch.setSel({ ak: "room", id: S.M.arch.rooms[0].id, part: "wall", edge: 0 }); S.T.arch.props(); }); await p.waitForTimeout(200);
    const ins = await rowBtn("Inside"), out = await rowBtn("Outside");
    check("a wall's panel: Inside and Outside material buttons", !!ins && !!out, { ins, out });
    const outside0 = await px([3.8, -0.08, 0.6]), other0 = await px([9.08, 2, 0.6]);
    await p.mouse.click(out[0], out[1]); await p.waitForSelector("#ppMatPick", { timeout: 3000 });
    const nMats = await ev(() => document.querySelectorAll("#ppMatPick .g .it").length);
    await ev(() => { const b = [...document.querySelectorAll("#ppMatPick .g .it")].find((x) => /Brick/i.test(x.title)) || document.querySelector("#ppMatPick .g .it"); b.click(); }); await p.waitForTimeout(300);
    const wext = await ev(() => H3PushPull.state.M.arch.rooms[0].wext);
    check("the picker (colour, materials) - a material for wall 1's OUTSIDE only", nMats >= 5 && /^mat:/.test(wext[0]) && Object.keys(wext).length === 1, { nMats, wext });
    const outside1 = await px([3.8, -0.08, 0.6]), other1 = await px([9.08, 2, 0.6]);
    const d3 = (a, c) => Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]);
    check("…its outside face changed, another outside wall did not", d3(outside0, outside1) > 12 && d3(other0, other1) < 4, { outside0, outside1, other0, other1 });

    /* ---- a picture from a file as wall 1's inside */
    await ev(() => { const S = H3PushPull.state; S.T.arch.setSel({ ak: "room", id: S.M.arch.rooms[0].id, part: "wall", edge: 2 }); S.T.arch.props(); }); await p.waitForTimeout(200);
    const ins2 = await rowBtn("Inside"); await p.mouse.click(ins2[0], ins2[1]); await p.waitForSelector("#ppMatPick");
    await p.setInputFiles('#ppMatPick input[type=file]', { name: "checker.png", mimeType: "image/png", buffer: checkerPng() });
    await p.waitForFunction(() => (H3PushPull.state.M.arch.tex || []).length === 1 && /^tex:/.test(H3PushPull.state.M.arch.rooms[0].wcol[2] || ""), null, { timeout: 15000 });
    const tx = await ev(() => H3PushPull.state.M.arch.tex[0]);
    check("From a file: the picture saved in the project's images and used as wall 3's inside (a texture)", /^\/passets\/images\//.test(tx.src) && tx.size === 1 && /^#[0-9a-f]{6}$/.test(tx.avg), tx);
    const served = await ev(async (u) => (await fetch(u.replace(/^\/passets\/images\/(.*)$/, (m, n) => "/passets/images/" + encodeURIComponent(n)))).status, tx.src);
    check("…the project serves it", served === 200, served);
    await p.waitForTimeout(800);
    const mapped = await ev(() => H3PushPull.state.A && H3PushPull.state.V.scene.getObjectByName("pp-arch").children.some((m) => m.material && m.material.map && m.material.map.image && m.material.map.image.width === 64));
    check("…the 3D wall wears it (a texture map loaded)", mapped);
    // its size
    await ev(() => { const S = H3PushPull.state; S.T.arch.setSel({ ak: "room", id: S.M.arch.rooms[0].id, part: "wall", edge: 2 }); S.T.arch.props(); });
    const ins3 = await rowBtn("Inside"); await p.mouse.click(ins3[0], ins3[1]); await p.waitForSelector("#ppMatPick");
    await ev(() => { const i = [...document.querySelectorAll("#ppMatPick input[type=number]")][0]; i.value = "2.5"; i.dispatchEvent(new Event("change")); }); await p.waitForTimeout(200);
    check("…Size 2.5 m: one copy every 2.5 m (the texture repeats less)", await ev(() => { const t = H3PushPull.state.M.arch.tex[0], m = PPFurn.texOf(H3PushPull.state.V.T, t.id); return t.size === 2.5 && Math.abs(m.repeat.x - 0.4) < 1e-6; }));
    await ev(() => PPMatPick.close());

    /* ---- the window's glass */
    await ev(() => { const S = H3PushPull.state; S.T.arch.setSel({ ak: "op", id: S.M.arch.ops[0].id }); S.T.arch.props(); }); await p.waitForTimeout(200);
    const gl = await rowBtn("Glass"); await p.mouse.click(gl[0], gl[1]); await p.waitForSelector("#ppMatPick");
    await ev(() => { const i = document.querySelector("#ppMatPick input[type=color]"); i.value = "#22aa55"; const b = [...document.querySelectorAll("#ppMatPick button")].find((x) => /Use this colour/.test(x.textContent)); b.click(); }); await p.waitForTimeout(250);
    check("a window's panel: Glass - its own colour", await ev(() => H3PushPull.state.M.arch.ops[0].glass === "#22aa55"));

    /* ---- the paint bucket: ONE wall's outside; Shift: every outside wall */
    await ev(() => { H3PushPull.state.T.arch.setSel(null); H3PushPull.tool("paint"); });
    await ev(() => { const s = H3PushPull.state; s.color = "#3355dd"; });
    await ev(() => { H3PushPull.setColor ? H3PushPull.setColor("#3355dd") : null; });
    let [x, y] = await scr([9.08, 2, 0.6]); await p.mouse.click(x, y); await p.waitForTimeout(250);
    const pb = await ev(() => ({ bed: H3PushPull.state.M.arch.rooms[1].wext, ext: H3PushPull.state.M.arch.ext, msg: document.getElementById("ppMsg").textContent }));
    check("🪣 Paint on an outside wall: that ONE wall's outside (Bed's wall 2), the others kept", pb.bed[1] === "#3355dd" && Object.keys(pb.bed).length === 1 && pb.ext !== "#3355dd" && /wall 2 \(outside\)/.test(pb.msg), pb);
    await p.keyboard.down("Shift"); await p.mouse.click(x, y); await p.keyboard.up("Shift"); await p.waitForTimeout(250);
    check("…Shift+click: every outside wall (each wall's own outside cleared)", await ev(() => { const A = H3PushPull.state.M.arch; return A.ext === "#3355dd" && A.rooms.every((R) => !Object.keys(R.wext || {}).length); }));
    await ev(() => H3PushPull.tool("select"));
    await shot("mat651-walls");

    /* ---- the background: a backdrop, a 360° sky, none */
    await p.click("#ppBgBtn"); await p.waitForSelector("#ppBgPop");
    await ev(() => { const s = document.getElementById("ppBgKind"); s.value = "backdrop"; s.dispatchEvent(new Event("change")); }); await p.waitForSelector("#ppMatPick");
    await ev(() => { const b = [...document.querySelectorAll("#ppMatPick .g .it")].find((x) => x.title === "checker"); b.click(); }); await p.waitForTimeout(800);
    const bd = await ev(() => { const S = H3PushPull.state, bg = S.V.scene.background; return { bg: S.M.arch.bg, tex: !!(bg && bg.isTexture), map: bg && bg.mapping, rep: bg && [bg.repeat.x, bg.repeat.y] }; });
    check("🖼 Background ▸ Backdrop ▸ a picture: behind the model (a texture background, cover-fitted)", bd.bg && bd.bg.kind === "backdrop" && bd.tex && bd.map === 300 && bd.rep && (bd.rep[0] < 1 || bd.rep[1] < 1), bd);
    const sky = await px({ s: [20, 20] });
    check("…the empty view shows the picture (red / white, not the dark theme)", sky[0] > 180, sky);
    await shot("mat651-backdrop");
    await ev(() => { const s = document.getElementById("ppBgKind"); s.value = "sky"; s.dispatchEvent(new Event("change")); }); await p.waitForTimeout(600);
    const sk = await ev(() => { const S = H3PushPull.state, bg = S.V.scene.background; return { kind: S.M.arch.bg.kind, map: bg && bg.mapping, rot: S.V.scene.backgroundRotation.x }; });
    check("…360° sky: the same picture as an equirectangular panorama round the scene (its horizon on the ground: Z up)", sk.kind === "sky" && sk.map === 303 && Math.abs(sk.rot - Math.PI / 2) < 1e-6, sk);
    await p.keyboard.press("Control+z"); await p.waitForTimeout(300);
    check("…one undo: the backdrop again", await ev(() => H3PushPull.state.M.arch.bg && H3PushPull.state.M.arch.bg.kind === "backdrop" && H3PushPull.state.V.scene.background.mapping === 300));
    await ev(() => { if (!document.getElementById("ppBgPop")) document.getElementById("ppBgBtn").click(); const s = document.getElementById("ppBgKind"); s.value = ""; s.dispatchEvent(new Event("change")); }); await p.waitForTimeout(300);
    check("…None: the theme's background back", await ev(() => !H3PushPull.state.M.arch.bg && !H3PushPull.state.V.scene.background));

    /* ---- kept with the model */
    const saved = await ev(() => { const j = JSON.parse(H3PushPull.snapshot()), A = PPArch.clean(j.arch); return { tex: A.tex.length, wcol: A.rooms[0].wcol[2], glass: A.ops[0].glass }; });
    check("saved with the model: the pictures, the wall's picture, the glass", saved.tex === 1 && /^tex:p1$/.test(saved.wcol) && saved.glass === "#22aa55", saved);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e.stack || e)); }
  finally {
    try { await ev(() => { PPMatPick.close(); H3PushPullFrame.toggleMaxed(false); }); } catch { /* fine */ }
    try { await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
