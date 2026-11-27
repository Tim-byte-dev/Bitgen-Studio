#!/usr/bin/env node
/* bitGen Studio — 2.994.0 in a REAL browser: ⛰ Depth in the image preview's 🌐 Panorama 3D. Tim: "is this worth adding?
 * https://pager360.github.io/" -> "yes do it please, first time dl, add disclaimer that these models are for non-commercial use
 * only". The add-on's install and the PaGeR job are answered by stand-ins (page.route): the depth grid is OURS - a near wall
 * ahead (2 m) and 10 m everywhere else - so the bent sphere is checked by its radii. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
(async () => {
  if (!chromium) { console.log("FAIL: playwright is not installed here"); console.log("\nRESULT: 0 passed, 1 failed"); process.exit(1); }
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  // the stand-ins: not installed until ⬇ Download; the install job; the depth job and its files
  let installed = false, posted = null, installs = 0;
  const W = 512, H = 256, grid = new Float32Array(W * H).fill(10);
  for (let y = 96; y < 160; y++) for (let x = 224; x < 288; x++) grid[y * W + x] = 2;   // ahead: the picture's middle (u 0.5)
  const json = (rt, o, st) => rt.fulfill({ status: st || 200, contentType: "application/json", body: JSON.stringify(o) });
  await p.route("**/api/panodepth*", (rt) => {
    const r = rt.request();
    if (r.method() === "GET") return json(rt, { installed, note: "stand-in", missing: installed ? [] : [{ id: "weights" }], notice: "non-commercial" });
    posted = { url: r.url(), bytes: (r.postDataBuffer() || Buffer.alloc(0)).length };
    return installed ? json(rt, { job: { id: "ui994job" }, stem: "pano" }) : json(rt, { error: "not installed", needs: "pager" }, 409);
  });
  await p.route("**/api/addons/pager/install", (rt) => { installs++; installed = true; json(rt, { ok: true }); });
  await p.route("**/api/addons/job*", (rt) => json(rt, { lines: ["[ok] PaGeR installed"], next: 1, job: { state: "done" } }));
  await p.route("**/api/jobs/ui994job*", (rt) => json(rt, { status: "done", outputs: ["pano_360_TB.png", "pano_depth.png"], output: "pano_depth.png" }));
  await p.route("**/outputs/pano_depth.json", (rt) => json(rt, { format: "bitgen-panodepth", grid: [W, H], scene: "indoor", near: 2, median: 10, far: 10, stem: "pano" }));
  await p.route("**/outputs/pano_depth.f32", (rt) => rt.fulfill({ status: 200, contentType: "application/octet-stream", body: Buffer.from(grid.buffer) }));
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3LbPano && window.H3NeedInstall && document.getElementById("lb_pano"), null, { timeout: 60000 });
    const pano = await ev(() => { const c = document.createElement("canvas"); c.width = 1024; c.height = 512; const g = c.getContext("2d"); const gr = g.createLinearGradient(0, 0, 1024, 0); ["#f00", "#ff0", "#0f0", "#0ff", "#00f", "#f0f", "#f00"].forEach((col, i) => gr.addColorStop(i / 6, col)); g.fillStyle = gr; g.fillRect(0, 0, 1024, 512); return c.toDataURL("image/png"); });
    await ev((u) => lbOpen([{ url: u, kind: "image", name: "pano.png" }], 0), pano);
    await p.waitForTimeout(300); await p.click("#lb_pano"); await p.waitForFunction(() => H3LbPano.state().on && H3LbPano.state().url, null, { timeout: 15000 });
    const title = await p.getAttribute("#lb_panodepth", "title");
    check("⛰ Depth is in the panorama's controls and says the weights are NON-COMMERCIAL only", await p.locator("#lb_panodepth").isVisible() && /NON-COMMERCIAL use only/.test(title) && /PaGeR/.test(title), title);
    const r0 = await ev(() => [H3LbPano.radiusAt("left", 0), H3LbPano.radiusAt("left", 500)]);

    // ---- the first time: the download box, with the disclaimer
    await p.click("#lb_panodepth");
    await p.waitForSelector("#niDlg", { timeout: 10000 });
    const box = await ev(() => document.getElementById("niDlg").textContent);
    check("the first time: the download box (⬇ Download / Cancel) for ⛰ Panorama depth, saying NON-COMMERCIAL use only", /Panorama depth \(PaGeR\)/.test(box) && /NON-COMMERCIAL use only/.test(box) && /not for paid or commercial work/.test(box) && await p.locator("#niGo").isVisible() && await p.locator("#niCancel").isVisible(), box.slice(0, 400));
    await p.click("#niCancel"); await p.waitForTimeout(400);
    check("Cancel: nothing downloaded, no job, depth off, said why (with the disclaimer)", installs === 0 && !posted && !(await ev(() => H3LbPano.depthState().on)) && /not downloaded/.test(await ev(() => H3LbPano.depthState().msg)), await ev(() => H3LbPano.depthState()));
    await p.click("#lb_panodepth"); await p.waitForSelector("#niGo", { timeout: 10000 }); await p.click("#niGo");
    await p.waitForFunction(() => H3LbPano.depthState().on, null, { timeout: 30000 });
    check("⬇ Download: the add-on installed (Settings ▸ Add-ons' own install), then the panorama sent to PaGeR (its picture's bytes)", installs === 1 && posted && /\/api\/panodepth\?name=/.test(posted.url) && posted.bytes > 1000, { installs, posted });
    const st = await ev(() => H3LbPano.depthState());
    check("depth on: ⛰ lit, the message names the stereo 360 + the walk-in mesh and repeats the disclaimer", st.on && st.stem === "pano" && /pano_360_TB\.png/.test(st.msg) && /NON-COMMERCIAL use only/.test(st.msg) && (await p.getAttribute("#lb_panodepth", "aria-pressed")) === "true", st);
    // the sphere bent: every vertex at its depth; the wall ahead nearer than the rest
    const radii = await ev(() => { const out = { near: [], far: [] }; for (let i = 0; i < 6000; i += 7) { const r = H3LbPano.radiusAt("right", i); (r < 3 ? out.near : out.far).push(r); } return { near: out.near.length, far: out.far.length, nmin: Math.min(...out.near), fmax: Math.max(...out.far) }; });
    check("both eyes' spheres bent to the depth: radius 50 before, 2 m (the wall ahead) / 10 m (the rest) after", Math.abs(r0[0] - 50) < 0.01 && radii.near > 10 && radii.far > 100 && Math.abs(radii.nmin - 2) < 0.2 && Math.abs(radii.fmax - 10) < 0.01, { r0, radii });
    const ahead = await ev(() => { const s = H3LbPano.state(); return s.look; });
    const px = () => ev(async () => { await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const c = H3LbPano.canvas(), t = document.createElement("canvas"); t.width = c.width; t.height = c.height; const g = t.getContext("2d"); g.drawImage(c, 0, 0); return Array.from(g.getImageData(Math.floor(c.width * 0.3), Math.floor(c.height / 2), 1, 1).data.slice(0, 3)); });
    const before = await px();
    await p.keyboard.press("i"); await p.keyboard.press("Shift+I"); await p.keyboard.press("Shift+I");
    const pos = await ev(() => H3LbPano.depthState().pos);
    check("I steps forward (0.1 m, Shift 0.5 m) - toward where you look", Math.abs(Math.hypot(pos[0], pos[2]) - 1.1) < 0.01 && pos[2] < 0, { pos, ahead });
    const after = await px();
    check("…and the view changes as you step (the near wall grows - parallax)", before.join() !== after.join(), { before, after });
    for (let i = 0; i < 6; i++) await p.keyboard.press("Shift+J");
    const pos2 = await ev(() => H3LbPano.depthState().pos);
    check("J steps to the side; never more than 2 m from where the picture was taken", Math.hypot(pos2[0], pos2[2]) <= 2.0001 && pos2[0] < 0, pos2);
    await p.keyboard.press("Home");
    check("Home: back to the middle", (await ev(() => H3LbPano.depthState().pos)).every((x) => x === 0));
    await p.selectOption("#lb_panomode", "sbs"); await p.waitForTimeout(200);
    check("👓 VR side by side with depth = real stereo (both eyes see the bent place from ±32 mm)", (await ev(() => H3LbPano.state().mode)) === "sbs" && (await ev(() => H3LbPano.radiusAt("left", 3000))) < 49 && (await ev(() => H3LbPano.radiusAt("right", 3000))) < 49);
    await p.selectOption("#lb_panomode", "normal");
    // off and on again: the second time is from the cache (no new job)
    await p.click("#lb_panodepth");
    check("⛰ again = off: the spheres round again", !(await ev(() => H3LbPano.depthState().on)) && Math.abs((await ev(() => H3LbPano.radiusAt("left", 500))) - 50) < 0.01);
    posted = null; await p.click("#lb_panodepth"); await p.waitForFunction(() => H3LbPano.depthState().on, null, { timeout: 10000 });
    check("on again: from the depth already read (no second job, no download box)", posted === null && !(await ev(() => !!document.getElementById("niDlg"))));
    await ev(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press("Escape"); await p.waitForTimeout(300);
    check("Esc closes the panorama and the depth with it", !(await ev(() => H3LbPano.state().on)) && !(await ev(() => H3LbPano.depthState().on)));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran without throwing", false, String(e && e.stack || e)); }
  await b.close();
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exitCode = fail ? 1 : 0;
})();
