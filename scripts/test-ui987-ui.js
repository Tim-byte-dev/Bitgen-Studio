#!/usr/bin/env node
/* bitGen Studio — 2.987.0 in a REAL browser: ✨ Photo from the Sketcher with the prompt docker's reference pictures and / or
 * its prompt (the four cases); the image preview's 🌐 Panorama 3D - look round, zoom, 👓 VR side by side / top-bottom, a
 * stereo picture read per eye, Esc back. Tim: "when rendering from sketcher use the reference images and prompt in prompt
 * docker if there are any, if no prompt use reference images, if no reference image but has a prompt use prompt, if no prompt
 * and no reference images then render the scene only. in image preview dialog add a button to view panorama 3d and controls
 * to move around the panorama. and allow user to watch vr sbs or top bottom." */
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
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), p = await b.newPage({ viewport: { width: 1800, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3LbPano && document.getElementById("tX_pushpulldock") && document.getElementById("lb_pano"), null, { timeout: 60000 });

    // ---- ✨ Photo: the four cases (the edit model answered by a stand-in; what is SENT is checked)
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); localStorage.setItem("h3.dockmax.off", "1"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.V, null, { timeout: 40000 });
    await p.waitForTimeout(1200); await ev(() => H3PushPull.newModel()); await p.waitForFunction(() => !H3PushPull.state.M.f.length && !(H3PushPull.state.M.arch && (H3PushPull.state.M.arch.tex || []).length), null, { timeout: 10000 });
    await ev(() => { const G = PPGeo, S = H3PushPull.state, before = H3PushPull.snapshot(); const F = G.addFace(S.M, [[0, 0, 0], [2, 0, 0], [2, 2, 0], [0, 2, 0]]); G.pushPull(S.M, F.id, 1.5); H3PushPull.commit("t", before); });
    await p.route("**/api/aiedit/engines", (rt) => rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ edit: [{ id: "ed1", name: "Stand-in edit" }], defaults: { edit: "ed1" } }) }));
    let sent = null;
    await p.route("**/api/aiedit", (rt) => { sent = (rt.request().postDataBuffer() || Buffer.alloc(0)).toString("latin1"); rt.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "stub" }) }); });
    const field = (name) => { const m = new RegExp('name="' + name + '"\\r\\n\\r\\n([\\s\\S]*?)\\r\\n--').exec(sent || ""); return m ? m[1] : null; };
    const shoot = async (prompt, withRef) => {
      sent = null;
      await ev(async (o) => {
        document.getElementById("prompt").value = o.prompt;
        refs.length = 0;   // the page's own top-level `refs`
        if (o.withRef) { const c = document.createElement("canvas"); c.width = 64; c.height = 64; const g = c.getContext("2d"); g.fillStyle = "#c33"; g.fillRect(0, 0, 64, 64); const blob = await new Promise((ok) => c.toBlob(ok, "image/png")); const f = new File([blob], "brick.png", { type: "image/png" }); refs.push({ file: f, url: URL.createObjectURL(f), subject: 1, role: "location", roleOther: "" }); }
      }, { prompt, withRef });
      await ev(() => { document.getElementById("ppMsg").textContent = ""; });
      await p.click("#ppReal"); for (let i = 0; i < 100 && sent == null; i++) await p.waitForTimeout(100);
      await p.waitForFunction(() => /stub/.test(document.getElementById("ppMsg").textContent), null, { timeout: 20000 }).catch(() => {});
      return { ref1: /name="ref1"/.test(sent || ""), prompt: field("prompt") || "", msg: await ev(() => document.getElementById("ppMsg").textContent) };
    };
    const A = await shoot("a red brick cottage at dusk", true);
    check("prompt + a reference: picture 3 = the reference itself (2.991.0 - one reference is sent whole), the prompt's words AND the reference line sent", A.ref1 && /a red brick cottage at dusk/.test(A.prompt) && /\{img3\} is the reference picture/.test(A.prompt), A);
    const B = await shoot("", true);
    check("no prompt + a reference: the reference used (board + its line), no words of the user", B.ref1 && /\{img3\} is the reference picture/.test(B.prompt) && !/cottage/.test(B.prompt), B);
    const C = await shoot("a red brick cottage at dusk", false);
    check("a prompt, no reference: the prompt used, no board", !C.ref1 && /cottage/.test(C.prompt) && !/Reference/.test(C.prompt), C);
    const D = await shoot("", false);
    check("neither: the scene only (the render + its depth, the lead's words)", !D.ref1 && !/Reference|cottage/.test(D.prompt) && /depth map/.test(D.prompt), D);
    await ev(() => { refs.length = 0; document.getElementById("prompt").value = ""; H3PushPullFrame.toggleMaxed(false); });
    await p.unroute("**/api/aiedit"); await p.unroute("**/api/aiedit/engines");

    // ---- 🌐 Panorama 3D in the image preview
    const pano = await ev(() => { const c = document.createElement("canvas"); c.width = 1024; c.height = 512; const g = c.getContext("2d"); const gr = g.createLinearGradient(0, 0, 1024, 0); ["#f00", "#ff0", "#0f0", "#0ff", "#00f", "#f0f", "#f00"].forEach((col, i) => gr.addColorStop(i / 6, col)); g.fillStyle = gr; g.fillRect(0, 0, 1024, 512); g.fillStyle = "#fff"; g.fillRect(0, 0, 1024, 40); return c.toDataURL("image/png"); });
    const sbs = await ev(() => { const c = document.createElement("canvas"); c.width = 2048; c.height = 512; const g = c.getContext("2d"); g.fillStyle = "#f00"; g.fillRect(0, 0, 1024, 512); g.fillStyle = "#00f"; g.fillRect(1024, 0, 1024, 512); return c.toDataURL("image/png"); });
    await ev((u) => lbOpen([{ url: u[0], kind: "image", name: "pano.png" }, { url: u[1], kind: "image", name: "stereo_sbs.png" }], 0), [pano, sbs]);
    await p.waitForTimeout(300);
    check("🌐 Panorama 3D is on the preview's bar for a picture", await ev(() => { const b = document.getElementById("lb_pano"); return !!b && getComputedStyle(b).display !== "none" && b.closest(".lbbar") !== null; }));
    await p.click("#lb_pano"); await p.waitForFunction(() => H3LbPano.state().on && H3LbPano.state().url, null, { timeout: 15000 }); await p.waitForTimeout(200);
    const st0 = await ev(() => H3LbPano.state());
    check("on: the picture round you (2:1 = mono 360°), over the picture, the view drawn", st0.layout === "mono" && st0.size.join() === "1024,512" && await ev(() => { const v = document.getElementById("lb_panoview"); return getComputedStyle(v).display === "block" && v.querySelector("canvas").width > 100; }), st0);
    const px = () => ev(async () => { await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const c = H3LbPano.canvas(), t = document.createElement("canvas"); t.width = c.width; t.height = c.height; const g = t.getContext("2d"); g.drawImage(c, 0, 0); const d = g.getImageData(c.width / 2 | 0, c.height / 2 | 0, 1, 1).data; return [d[0], d[1], d[2]]; });
    const c0 = await px();
    const cv = await ev(() => { const r = H3LbPano.canvas().getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await p.mouse.move(cv.x, cv.y); await p.mouse.down(); await p.mouse.move(cv.x - 300, cv.y, { steps: 6 }); await p.mouse.up();
    const st1 = await ev(() => H3LbPano.state()), c1 = await px();
    check("drag to look round: the view turns (the colour ahead changes)", Math.abs(st1.look.yaw - st0.look.yaw) > 20 && c1.join() !== c0.join(), { st0: st0.look, st1: st1.look, c0, c1 });
    await p.keyboard.press("ArrowLeft"); const k1 = await ev(() => H3LbPano.state().look.yaw);
    check("← turns 5° (the arrows turn - they do not page the preview)", Math.abs(((st1.look.yaw - k1) + 360) % 360 - 5) < 0.01 && (await ev(() => lb.i)) === 0, [st1.look.yaw, k1]);
    await p.click("#lb_panoin"); const f1 = await ev(() => H3LbPano.state().look.fov);
    check("＋ zooms in (a narrower view)", f1 < st1.look.fov, [st1.look.fov, f1]);
    await p.click("#lb_panohome");
    check("⟲ straight ahead", JSON.stringify(await ev(() => H3LbPano.state().look)) === '{"yaw":0,"pitch":0,"fov":75}');
    await p.selectOption("#lb_panomode", "sbs"); await p.waitForTimeout(150);
    const sb = await ev(() => { const c = H3LbPano.canvas(), t = document.createElement("canvas"); t.width = c.width; t.height = c.height; const g = t.getContext("2d"); g.drawImage(c, 0, 0); const at = (x) => [...g.getImageData(x, c.height / 2 | 0, 1, 1).data].slice(0, 3).join(); return { l: at(c.width / 4 | 0), r: at(c.width * 3 / 4 | 0), mid: at(c.width / 2 | 0) }; });
    const same = (a, b2) => a.split(",").every((v, i) => Math.abs(+v - +b2.split(",")[i]) <= 3);
    check("👓 VR side by side: a left-eye view and a right-eye view, the same picture ahead in each half", same(sb.l, sb.r) && sb.l !== "0,0,0" && (await ev(() => H3LbPano.state().mode)) === "sbs", sb);
    await p.selectOption("#lb_panomode", "tb"); await p.waitForTimeout(150);
    const tb = await ev(() => { const c = H3LbPano.canvas(), t = document.createElement("canvas"); t.width = c.width; t.height = c.height; const g = t.getContext("2d"); g.drawImage(c, 0, 0); const at = (y) => [...g.getImageData(c.width / 2 | 0, y, 1, 1).data].slice(0, 3).join(); return { t: at(c.height / 4 | 0), b: at(c.height * 3 / 4 | 0) }; });
    check("👓 VR top / bottom: the left eye over the right", same(tb.t, tb.b) && tb.t !== "0,0,0", tb);
    // a STEREO side-by-side panorama: each eye its own half (red left, blue right)
    await p.keyboard.press("Escape"); await p.waitForTimeout(100);
    check("Esc: back to the picture (the preview stays open)", !(await ev(() => H3LbPano.state().on)) && (await ev(() => document.getElementById("lb").open)));
    await p.click("#lb_nx"); await p.waitForTimeout(200); await p.click("#lb_pano"); await p.waitForFunction(() => H3LbPano.state().on && /stereo|2048/.test(JSON.stringify(H3LbPano.state().size)), null, { timeout: 15000 }); await p.waitForTimeout(200);
    await p.selectOption("#lb_panomode", "sbs"); await p.waitForTimeout(150);
    const st2 = await ev(() => H3LbPano.state());
    const eyes = await ev(() => { const c = H3LbPano.canvas(), t = document.createElement("canvas"); t.width = c.width; t.height = c.height; const g = t.getContext("2d"); g.drawImage(c, 0, 0); const at = (x) => [...g.getImageData(x, c.height / 2 | 0, 1, 1).data].slice(0, 3); return { l: at(c.width / 4 | 0), r: at(c.width * 3 / 4 | 0) }; });
    check("a 4:1 picture = a STEREO side-by-side panorama (auto): the left eye sees its left half (red), the right eye its right half (blue)", st2.layout === "sbs" && eyes.l[0] > 200 && eyes.l[2] < 60 && eyes.r[2] > 200 && eyes.r[0] < 60, { st2, eyes });
    await p.selectOption("#lb_panomode", "normal"); await p.selectOption("#lb_panopic", "mono"); await p.waitForTimeout(100);
    check("Picture: Mono 360° overrides the auto choice (kept)", (await ev(() => H3LbPano.state().layout)) === "mono" && (await ev(() => localStorage.getItem("h3.lbpano.pic"))) === "mono");
    await ev(() => { H3LbPano.setPic("auto"); H3LbPano.setMode("normal"); document.getElementById("lb").close(); });
    check("closing the preview closes the panorama", !(await ev(() => H3LbPano.state().on)));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran without throwing", false, String(e && e.stack || e)); }
  await b.close();
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exitCode = fail ? 1 : 0;
})();
