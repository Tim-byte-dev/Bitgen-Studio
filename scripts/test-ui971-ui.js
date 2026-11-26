#!/usr/bin/env node
/* bitGen Studio — 2.971.0 in a REAL browser: the image editor's Image ▸ 🌐 360 Panorama… (pcpano.js). A red-over-blue picture
 * open in the editor:
 *   the menu item; the box opens with the picture already on the canvas (FRONT, the middle), everything else pure green
 *   (pixels on the box's own canvas and on a full-size build); a drag moves it round (yaw), the wheel changes its size;
 *   🌐 Look round shows it ahead only when you turn to it; ▶ Make sends the green canvas + words (the server call caught),
 *   asks for the models first (H3ModelsFound.ensure with the 360 LoRA), and the answer opens as a NEW picture; ↔ seam sends
 *   seam=1 and turns the answer back round; 🥽 sends it to VR World as the world. Tim: "can we add this to image-editor to
 *   create 360 panaromic images for mmh3. https://github.com/nomadoor/ComfyUI-Panorama-Stickers?" */
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
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const near = (a, b, t) => a && b && a.every((v, i) => Math.abs(v - b[i]) <= (t || 40));
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const posts = [], vr = [];
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    // the server's job call and VR World's upload caught (no ComfyUI here, and VR World's world left alone)
    await p.route("**/api/pano360", async (r) => {
      if (r.request().method() !== "POST") return r.continue();
      const body = r.request().postDataBuffer() || Buffer.alloc(0), s = body.toString("latin1");
      const field = (n) => { const m = s.match(new RegExp('name="' + n + '"\\r\\n\\r\\n([^\\r]*)')); return m ? m[1] : null; };
      posts.push({ canvas: /name="canvas"; filename="pano360\.png"\r\nContent-Type: image\/png/.test(s), png: s.indexOf("\x89PNG") > 0, bytes: body.length, desc: field("desc"), size: field("size"), seed: field("seed"), seam: field("seam") });
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ jobs: [{ id: "ui971job" + posts.length, seed: 5 }], prompt: "x", width: 1408, height: 704 }) });
    });
    await p.route("**/api/vrworld/upload", async (r) => {
      const s = (r.request().postDataBuffer() || Buffer.alloc(0)).toString("latin1");
      vr.push({ slot: /name="slot"\r\n\r\nworld/.test(s), file: /name="file"; filename="ui971_beach_360\.png"/.test(s), png: s.indexOf("\x89PNG") > 0 });
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.pano && window.PCPano, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    // the picture: red top half, blue bottom half (so upside down / mirrored would show)
    await ev(() => {
      const E = window.imageEditorInstance.E, c = E.newCanvas(400, 300), g = c.getContext("2d");
      g.fillStyle = "#ff0000"; g.fillRect(0, 0, 400, 150); g.fillStyle = "#0000ff"; g.fillRect(0, 150, 400, 150);
      E.openImage(c, "ui971 beach.png");
    });
    await p.waitForTimeout(500);

    const menu = await ev(() => { const E = window.imageEditorInstance.E, m = E.ui.MENUS.find(([n]) => n === "Image"), c = E.ui.CMD.get("image.pano360"); return { inMenu: !!m && m[1].includes("image.pano360"), label: c && c.label }; });
    check("Image ▸ 🌐 360 Panorama… is a command in the Image menu", menu.inMenu && menu.label === "🌐 360 Panorama…", menu);

    await ev(() => window.imageEditorInstance.E.ui.run("image.pano360"));
    await p.waitForFunction(() => document.getElementById("pnDlg") && document.getElementById("pnDlg").open && document.querySelectorAll("#pnSize option").length === 2, null, { timeout: 10000 });
    await p.waitForTimeout(500);
    const opened = await ev(() => ({ pics: [...document.querySelectorAll("#pnPics .pp-pic span")].map((s) => s.textContent), sizes: [...document.querySelectorAll("#pnSize option")].map((o) => o.value).join(","),
      lic: document.querySelector(".ppdlg .pp-lic").textContent, seam: document.getElementById("pnSeam").disabled, vr: document.getElementById("pnVr").disabled, st: window.imageEditorInstance.E.pano.state.pics.map((q) => [q.yaw, q.pitch, q.fov]) }));
    check("the box opens with the open picture already on the canvas (FRONT: turn 0, tilt 0, a quarter of the way round), sizes 2048 / 1408 from the server",
      opened.pics.join() === "ui971 beach" && opened.sizes === "2048,1408" && JSON.stringify(opened.st) === "[[0,0,90]]", opened);
    check("the licence is said (non-commercial), ↔ seam and 🥽 VR off until there is a panorama", /non-commercial/.test(opened.lic) && /MIT/.test(opened.lic) && opened.seam && opened.vr, opened);

    const view = () => ev(() => { const c = document.getElementById("pnView"), g = c.getContext("2d"), at = (fx, fy) => Array.from(g.getImageData(Math.floor(c.width * fx), Math.floor(c.height * fy), 1, 1).data).slice(0, 3); return { w: c.width, h: c.height, mid: at(0.515, 0.45), low: at(0.515, 0.56), edge: at(0.04, 0.3), right: at(0.765, 0.45), cw: c.clientWidth, ch: c.clientHeight }; });
    const v1 = await view();
    check("the box's canvas is 2:1; the picture in the middle the right way up (red above blue), the rest pure green",
      Math.abs(v1.w / v1.h - 2) < 0.02 && near(v1.mid, [255, 0, 0]) && near(v1.low, [0, 0, 255]) && near(v1.edge, [0, 255, 0], 50), v1);
    const full = await ev(() => { const o = window.imageEditorInstance.E.pano.build(2048, 1024), px = (x, y) => Array.from(o.data.slice((y * o.w + x) * 4, (y * o.w + x) * 4 + 3)); return { w: o.w, h: o.h, mid: px(1024, 460), back: px(2, 512), pole: px(1024, 3) }; });
    check("the full-size canvas (what is sent): 2048 × 1024, the picture at FRONT, pure #00FF00 behind and at the poles",
      full.w === 2048 && full.h === 1024 && near(full.mid, [255, 0, 0], 2) && full.back.join() === "0,255,0" && full.pole.join() === "0,255,0", full);

    // drag it to the right (three-quarters across = 90° round) and make it smaller with the wheel
    const box = await p.locator("#pnView").boundingBox();
    await p.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45); await p.mouse.down();
    await p.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.47, { steps: 4 }); await p.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.5, { steps: 4 }); await p.mouse.up();
    await p.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.5); await p.mouse.wheel(0, 100); await p.mouse.wheel(0, -100); await p.mouse.wheel(0, -100);
    await p.waitForTimeout(300);
    const moved = await ev(() => ({ st: window.imageEditorInstance.E.pano.state.pics[0], yaw: document.getElementById("pnYaw").value, out: document.getElementById("pnYawV").textContent, fov: document.getElementById("pnFovV").textContent }));
    const v2 = await view();
    check("a drag moves the picture round to the RIGHT (turn ≈ 90°, the Turn slider follows), the wheel = its size (90 + 4 − 4 − 4 = 86°)",
      Math.abs(moved.st.yaw - 90) < 3 && Math.abs(moved.st.pitch) < 3 && Math.abs(+moved.yaw - 90) < 3 && /°$/.test(moved.out) && moved.st.fov === 86 && moved.fov === "86°", moved);
    check("...and the canvas shows it there now (green in the middle, red at three-quarters)", near(v2.mid, [0, 255, 0], 50) && near(v2.right, [255, 0, 0], 60), v2);

    // 🌐 look round
    await p.click("#pnM_look"); await p.waitForTimeout(400);
    const l1 = await view();
    await ev(() => { const st = window.imageEditorInstance.E.pano.state; st.look.yaw = 90; st.look.pitch = 0; window.imageEditorInstance.E.pano.setMode("look"); });
    await p.waitForTimeout(400);
    const l2 = await view();
    check("🌐 Look round: a 16:9 view from the middle - looking ahead it is green, turned 90° right the picture is there (red above blue)",
      Math.abs(l1.w / l1.h - 16 / 9) < 0.03 && near(l1.mid, [0, 255, 0], 50) && near(l2.mid, [255, 0, 0], 50) && near(l2.low, [0, 0, 255], 50), { l1, l2 });
    // drag in look mode turns the view
    const lb = await p.locator("#pnView").boundingBox();
    await p.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2); await p.mouse.down(); await p.mouse.move(lb.x + lb.width / 2 - 200, lb.y + lb.height / 2, { steps: 5 }); await p.mouse.up();
    const ly = await ev(() => window.imageEditorInstance.E.pano.state.look.yaw);
    check("...dragging turns the view (dragging left looks further right)", ly > 95, ly);
    await p.click("#pnM_place");

    // ▶ make (the models asked for first; the server call caught; the answer opens as a new picture)
    await ev(() => {
      window.__ui971 = { ensure: [], waits: [] };
      window.H3ModelsFound = Object.assign(window.H3ModelsFound || {}, { ensure: async (o) => { window.__ui971.ensure.push(o); return true; } });
      const E = window.imageEditorInstance.E;
      // the "rendered" panorama: left half orange, right half purple, 1408 × 704
      E.api.awaitResult = async (id) => { window.__ui971.waits.push(id); const c = document.createElement("canvas"); c.width = 1408; c.height = 704; const g = c.getContext("2d"); g.fillStyle = "#ff8000"; g.fillRect(0, 0, 704, 704); g.fillStyle = "#8000ff"; g.fillRect(704, 0, 704, 704); return c.toDataURL("image/png"); };
    });
    await p.fill("#pnDesc", "a quiet beach at sunset, palm trees behind");
    await p.selectOption("#pnSize", "1408"); await p.fill("#pnSeed", "77");
    await p.click("#pnGo");
    await p.waitForFunction(() => window.imageEditorInstance.E.pano.state.result && !window.imageEditorInstance.E.pano.state.busy, null, { timeout: 30000 });
    await p.waitForTimeout(500);
    const made = await ev(() => { const E = window.imageEditorInstance.E, S = E.S, f = E.flatten().getContext("2d"), at = (x, y) => Array.from(f.getImageData(x, y, 1, 1).data).slice(0, 3);
      return { ensure: window.__ui971.ensure, waits: window.__ui971.waits, name: S.name, w: S.w, h: S.h, left: at(10, 300), right: at(1390, 300), msg: document.getElementById("pnMsg").textContent, seam: document.getElementById("pnSeam").disabled, vr: document.getElementById("pnVr").disabled, mode: E.pano.state.mode }; });
    check("▶ Make asks for the models first: the Qwen Image 2.1 edit style + the 360 LoRA at 0.8 (Download / Cancel if missing)",
      made.ensure.length === 1 && made.ensure[0].kind === "image" && !!made.ensure[0].style_id && made.ensure[0].extra_loras[0].path === "qwen_image_2_1_360_panorama_outpaint_lora_v0_1.safetensors" && made.ensure[0].extra_loras[0].weight === 0.8, made.ensure);
    check("...sends the green canvas (a PNG) with the words, the size (1408) and the seed (77) to /api/pano360, no seam flag",
      posts.length === 1 && posts[0].canvas && posts[0].png && posts[0].bytes > 2000 && posts[0].desc === "a quiet beach at sunset, palm trees behind" && posts[0].size === "1408" && posts[0].seed === "77" && posts[0].seam === null, posts);
    check("...waits for that job and opens the panorama as a NEW picture (\"ui971 beach 360\", 1408 × 704); ↔ and 🥽 now on, the box shows the panorama",
      made.waits.join() === "ui971job1" && made.name === "ui971 beach 360.png" && made.w === 1408 && made.h === 704 && near(made.left, [255, 128, 0], 3) && !made.seam && !made.vr && made.mode === "result" && /new picture/.test(made.msg), made);

    // ↔ the seam pass
    await p.click("#pnSeam");
    await p.waitForFunction(() => window.__ui971.waits.length === 2 && !window.imageEditorInstance.E.pano.state.busy, null, { timeout: 30000 });
    await p.waitForTimeout(500);
    const sm = await ev(() => { const E = window.imageEditorInstance.E, S = E.S, f = E.flatten().getContext("2d"), at = (x, y) => Array.from(f.getImageData(x, y, 1, 1).data).slice(0, 3); return { name: S.name, w: S.w, left: at(10, 300), right: at(1390, 300), docs: (E.docs && E.docs.list ? E.docs.list().length : null), msg: document.getElementById("pnMsg").textContent }; });
    check("↔ Fix the seam: sent with seam=1 (the panorama turned half way round + a green strip), the answer turned back round (left / right swapped back) - another new picture",
      posts.length === 2 && posts[1].seam === "1" && posts[1].png && sm.name === "ui971 beach 360 (seam).png" && sm.w === 1408 && near(sm.left, [128, 0, 255], 3) && near(sm.right, [255, 128, 0], 3) && /first one is still open/.test(sm.msg), { posts, sm });

    // 🥽 VR World
    await ev(() => { window.__ui971.vrOpened = 0; window.VrWorld = Object.assign(window.VrWorld || {}, { open: () => { window.__ui971.vrOpened++; } }); });
    await p.click("#pnVr");
    await p.waitForFunction(() => /VR World's world/.test(document.getElementById("pnMsg").textContent), null, { timeout: 10000 }).catch(() => {});
    await p.waitForTimeout(300);
    const vro = await ev(() => ({ n: window.__ui971.vrOpened, open: document.getElementById("pnDlg").open }));
    check("🥽 Use in VR World: the panorama uploaded as VR World's world (slot=world, a PNG named …_360 so it reads as 360), then VR World opens and this box closes",
      vr.length === 1 && vr[0].slot && vr[0].file && vr[0].png && vro.n === 1 && !vro.open, { vr, vro });

    // the real server's answer (unstubbed GET)
    const info = await ev(async () => (await fetch("/api/pano360")).json());
    check("GET /api/pano360 (the real server): the style, the LoRA, the trigger, two sizes",
      info.ok && !!info.style_id && info.lora_weight === 0.8 && /Fill the green areas/.test(info.trigger) && info.sizes.length === 2, info);
    await ev(() => window.imageEditorInstance.E.pano.close());
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the run threw - " + (e && e.stack || e)); }
  await b.close();
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
