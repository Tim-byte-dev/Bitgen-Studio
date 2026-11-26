#!/usr/bin/env node
/* bitGen Studio — 2.976.0 in a REAL browser: 🦴 Rig it in the Sketcher.
 *   The real routes (GET /api/rig - not installed here; POST /api/rig for a model that is not there -> 404, for a model
 *   that is there -> 409 needs "unirig"); then 🦴 Rig ▾ lists the project's models (rigged ones left out), a pick with the
 *   add-on missing opens its Install / Cancel box (H3Addons.act stubbed), a pick with it "installed" (page.route) queues the
 *   job and says where the result goes.
 * Tim: "are we able to make a 3d model of a person animal and car from a photo... like daz studio does it with facegen?" -> "yes please" */
"use strict";
const path = require("path");
const fs = require("fs");
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
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let made = null;
  try {
    const st = await (await p.request.get(URL_ + "api/rig")).json();
    check("GET /api/rig: not installed here - what is missing listed", st.installed === false && st.missing.length === 5, st);
    const nf = await p.request.post(URL_ + "api/rig", { data: { name: "no_such_976.glb" } });
    check("POST /api/rig: a model that is not in models3d -> 404", nf.status() === 404);
    // a real model file in the project's models3d
    const G = require(path.join(__dirname, "..", "lib", "glbMerge.js"));
    const up = await p.request.post(URL_ + "api/tlcanvas/model?name=ui976_dog.glb", { data: G.merge([], { camera: { y: 1 } }), headers: { "Content-Type": "application/octet-stream" } });
    made = (await up.json()).name || "ui976_dog.glb";
    const r409 = await p.request.post(URL_ + "api/rig", { data: { name: made } });
    const j409 = await r409.json();
    check("POST /api/rig with the add-on missing -> 409, needs unirig (the page opens its Install box)", r409.status() === 409 && j409.needs === "unirig" && /Settings ▸ Add-ons/.test(j409.error), j409);

    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.H3Rig && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); localStorage.setItem("h3.dockmax.off", "1"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted, null, { timeout: 40000 });
    await ev(() => { window.__act = []; window.H3Addons = Object.assign(window.H3Addons || {}, { refresh: () => Promise.resolve(), act: (id, w) => { window.__act.push(id + ":" + w); return Promise.resolve(null); } }); });
    check("the Sketcher's bar: 🦴 Rig ▾", await p.locator("#ppRig").isVisible());
    await p.click("#ppRig");
    await p.waitForSelector(".ppmenu", { timeout: 5000 });
    const items = await ev(() => [...document.querySelectorAll(".ppmenu div")].map((d) => d.textContent));
    check("🦴 Rig ▾ lists the project's models (the head says what it does)", /Rig a 3D model/.test(items[0]) && items.includes(made) && !items.some((t) => /_rigged\.glb$/.test(t)), items);
    await p.locator(".ppmenu div", { hasText: made }).first().click();
    await p.waitForFunction(() => window.__act.length > 0, null, { timeout: 5000 }).catch(() => {});
    const a1 = await ev(() => ({ act: window.__act, msg: document.getElementById("ppMsg").textContent }));
    check("a pick with UniRig not installed: its add-on's Install / Cancel box, the message says so", a1.act.join() === "unirig:install" && /needs its add-on/.test(a1.msg), a1);
    let sent = null;
    await p.route(/\/api\/rig$/, (r) => { if (r.request().method() !== "POST") return r.continue(); sent = r.request().postDataJSON(); r.fulfill({ json: { job: { id: "j976" }, model: "ui976_dog_rigged.glb" } }); });
    const res = await ev((n) => H3Rig.rig(n), made);
    const msg = await p.textContent("#ppMsg");
    check("with it installed: POST /api/rig {name, skin} -> the job; the message says where the rigged model goes", sent && sent.name === made && sent.skin === true && res.model === "ui976_dog_rigged.glb" && /job list/.test(msg) && /ui976_dog_rigged\.glb/.test(msg), { sent, msg });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.message); }
  try { const d = path.join(__dirname, "..", "projects"); for (const pr of fs.readdirSync(d)) { const f = path.join(d, pr, "models3d", "ui976_dog.glb"); if (fs.existsSync(f)) fs.rmSync(f); } } catch (e) { /* fine */ }
  await b.close();
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
