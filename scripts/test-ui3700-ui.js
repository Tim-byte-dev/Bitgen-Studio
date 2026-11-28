#!/usr/bin/env node
/* bitGen Studio — 3.7.0 in a REAL browser: 💎 FINE DETAIL (Direct3D-V3) in the Sketcher - the button, the dialog (picture picker,
 * the rough model list, detail / steps / faces / Low memory kept), not installed -> the add-on's own Download box, installed ->
 * a rough model made first (POST /api/mesh3d, Hunyuan3D) then POST /api/d3v3 with it, the job waited, the result brought
 * into the model; an existing rough model -> no Hunyuan3D run. The jobs are mocked (no Direct3D-V3 here); GET /api/d3v3 is real.
 * The rest: scripts/test-3700.js, scripts/test-d3v3-3700.py. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 3.7.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_d3v3ui_" + process.pid, PIC = "zz_d3v3ui_" + process.pid + ".png", MOD = "zz_d3v3ui_vase_" + process.pid + ".glb";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64");

(async () => {
  try { const r = await fetch(URL_); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL_); process.exit(0); }
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: PN }); await api("/api/projects/load", { name: PN });
    const up = await (await fetch(URL_ + "api/dazlib/photo?name=" + encodeURIComponent(PIC), { method: "POST", headers: { "Content-Type": "image/png" }, body: PNG })).json();
    const mod = await (await fetch(URL_ + "api/tlcanvas/model?name=" + encodeURIComponent(MOD), { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: Buffer.from("glTF") })).json();
    check("a picture and a rough model in the project", up && up.name && mod && (mod.name || mod.ok), { up, mod });
    const real = await api("/api/d3v3");
    check("GET /api/d3v3 (the real one): not installed here, what is missing", real.installed === false && Array.isArray(real.missing) && real.missing.length > 0, real);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.H3Detail && window.H3PicPick && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); (localStorage.setItem("h3.dockmax.off", "1"), H3PushPullFrame.toggleMaxed(true)); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.A, null, { timeout: 40000 });
    // never a real install, never a real import: both recorded
    await ev(() => { window.__acts = []; window.__imports = []; if (!window.H3Addons) window.H3Addons = {}; H3Addons.act = (id, a) => { __acts.push(id + ":" + a); }; H3Addons.refresh = async () => {}; H3PushPull.importModel = async (n) => { __imports.push(n); }; });

    check("💎 Fine detail is on the Sketcher's bar", await ev(() => { const x = document.getElementById("ppDetail"); return !!x && x.offsetParent !== null; }));
    await p.click("#ppDetail"); await p.waitForSelector("#ppdDlg[open]", { timeout: 4000 });
    await p.waitForFunction((m) => [...document.querySelectorAll("#ppdRough option")].some((o) => o.value === m), MOD, { timeout: 8000 });
    const dl = await ev(() => ({ tabs: document.querySelectorAll("#ppdPick .ppp-tabs button").length, rough0: document.getElementById("ppdRough").options[0].textContent, res: document.getElementById("ppdRes").value, faces: document.getElementById("ppdFaces").value, bring: document.getElementById("ppdBring").checked }));
    check("the dialog: the picture picker, ✨ make the rough model first (first in the list) + the project's models, detail 1024, 500 000 faces, bring it in", dl.tabs === 5 && /Make it from the picture first/.test(dl.rough0) && dl.res === "1024" && dl.faces === "500000" && dl.bring, dl);
    await p.click("#ppdGo");
    check("▶ with no picture: it asks for one", /pick the picture first/.test(await ev(() => document.getElementById("ppdMsg").textContent)));
    await p.click('#ppdDlg [data-src="assets"]');
    await p.waitForSelector('#ppdDlg .ppp-t[title="' + up.name + '"]', { timeout: 8000 });
    await p.click('#ppdDlg .ppp-t[title="' + up.name + '"]');

    /* ---- not installed (the real GET): the add-on's own Download box, no Hunyuan3D run for nothing */
    let mesh3dCalls = 0; await p.route("**/api/mesh3d", (r) => { mesh3dCalls++; return r.fulfill({ status: 500, contentType: "application/json", body: '{"error":"should not run"}' }); });
    await p.click("#ppdGo");
    await p.waitForFunction(() => window.__acts.length > 0, null, { timeout: 8000 });
    check("not installed: the add-on's Download / Cancel box (H3Addons.act d3v3 install), nothing run", (await ev(() => __acts.join())) === "d3v3:install" && mesh3dCalls === 0 && /needs its add-on/.test(await ev(() => document.getElementById("ppdMsg").textContent)), { acts: await ev(() => __acts), mesh3dCalls });
    await p.unroute("**/api/mesh3d");

    /* ---- installed (mocked): the rough model made first, then Direct3D-V3, then brought in */
    const seen = { mesh3d: null, d3v3: null }; let polls = 0;
    await p.route("**/api/d3v3", (r) => {
      if (r.request().method() === "GET") return r.fulfill({ status: 200, contentType: "application/json", body: '{"installed":true,"missing":[]}' });
      seen.d3v3 = JSON.parse(r.request().postData() || "{}");
      return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ job: { id: "dj1" }, model: "x_detail.glb" }) });
    });
    await p.route("**/api/mesh3d", (r) => { seen.mesh3d = JSON.parse(r.request().postData() || "{}"); return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "mj1", model: "x_rough.glb" }) }); });
    await p.route(/\/api\/jobs\/(mj1|dj1)$/, (r) => {
      const id = r.request().url().split("/").pop(); polls++;
      const body = id === "mj1" ? { status: "done", output: "x_rough.glb" } : (polls < 4 ? { status: "running", progress: { step: 3, total: 15 } } : { status: "done", output: "x_detail.glb" });
      return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await ev(() => { document.getElementById("ppdRes").value = "1536"; document.getElementById("ppdRes").dispatchEvent(new Event("change")); document.getElementById("ppdLow").checked = true; document.getElementById("ppdLow").dispatchEvent(new Event("change")); document.getElementById("ppdRough").value = ""; });
    const got = await ev(() => H3Detail.run());
    check("the chain: Hunyuan3D first (the picture, engine hunyuan, <name>_rough)", seen.mesh3d && seen.mesh3d.name === up.name && seen.mesh3d.where === "images" && seen.mesh3d.engine === "hunyuan" && /_rough$/.test(seen.mesh3d.model_name), seen.mesh3d);
    check("…then POST /api/d3v3 with that rough model, 1536, Low memory, 500 000 faces, the picture", seen.d3v3 && seen.d3v3.model === "x_rough.glb" && seen.d3v3.resolution === 1536 && seen.d3v3.low === true && seen.d3v3.faces === 500000 && seen.d3v3.picture === up.name, seen.d3v3);
    check("…the job waited, the result brought into the model", got === "x_detail.glb" && (await ev(() => __imports.join())) === "x_detail.glb" && /brought into this model/.test(await ev(() => document.getElementById("ppdMsg").textContent)), { got, imports: await ev(() => __imports) });
    check("detail / Low memory kept for next time", (await ev(() => [localStorage.getItem("h3.detail.res"), localStorage.getItem("h3.detail.low")].join())) === "1536,1");

    /* ---- an existing rough model: no Hunyuan3D */
    seen.mesh3d = null; seen.d3v3 = null; polls = 10;
    await ev((m) => { document.getElementById("ppdRough").value = m; }, MOD);
    await ev(() => H3Detail.run());
    check("a rough model picked: straight to Direct3D-V3 with it (no Hunyuan3D run)", seen.mesh3d === null && seen.d3v3 && seen.d3v3.model === MOD, seen);
    await p.click("#ppdX");
    check("✕ closes it", await ev(() => !document.getElementById("ppdDlg").open));
    check("no page errors", !errs.length, errs);
  } catch (e) { check("the run finished: " + (e.message || e), false); }
  finally {
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); await fetch(URL_ + "api/projects/" + encodeURIComponent(PN), { method: "DELETE" }); } catch (e) { /* fine */ }
  }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
