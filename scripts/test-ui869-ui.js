#!/usr/bin/env node
/* bitGen Studio — 2.869.0 in a REAL browser: the timeline's 🕺 Mocap (RGB MoCap): the button on the timeline bar, the panel lists the
 * video clips (the one under the playhead first), ✂ Prepare cuts its used part into the project's mocap folder (the path shown), what is
 * exported there is listed and ⤓ To the timeline adds a 🕺 3D layer with that model. Against the running app (H3_URL). */
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
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const api = (u, body) => fetch(new URL(u, URL_), body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}).then((r) => r.json());
  const fs = require("fs"), os = require("os"), { execFileSync } = require("child_process");
  try {
    const vid = path.join(os.tmpdir(), "mocap869.mp4");
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=30:duration=3", "-pix_fmt", "yuv420p", vid]);
    const fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(vid)], { type: "video/mp4" }), "walk869.mp4");
    const up = await (await fetch(new URL("/api/passets", URL_), { method: "POST", body: fd })).json();
    const vname = up.name || up.file || "walk869.mp4";
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.TlMocap && document.getElementById("tlMocapBtn"), null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    await ev((n) => { const t = window.tl || tl; t.video = [{ name: n, src: "video", in: 0.5, out: 2, start: 0, dur: 3 }]; window.__m3d = []; window.TlM3D = Object.assign({}, window.TlM3D, { add: function () { window.__m3d.push([].slice.call(arguments)); } }); }, vname);
    await ev(() => document.getElementById("tlMocapBtn").click());
    await p.waitForSelector("#tlMocap:not([hidden])");
    await p.waitForFunction(() => /Windows only|installed/.test(document.getElementById("tlMocapInst").textContent), null, { timeout: 10000 });
    const v0 = await ev(() => ({ opts: [...document.querySelectorAll("#tlMocapClip option")].map((o) => o.textContent), inst: document.getElementById("tlMocapInst").textContent, open: document.getElementById("tlMocapOpen").disabled }));
    check("🕺 Mocap on the timeline bar opens the panel: the video clips (V1 · walk869…), not Windows here = said, ▶ Open disabled", v0.opts.length === 1 && /V1 · /.test(v0.opts[0]) && /Windows only/.test(v0.inst) && v0.open, v0);
    await ev(() => document.getElementById("tlMocapPrep").click());
    await p.waitForFunction(() => /✓|✗/.test(document.getElementById("tlMocapMsg").textContent), null, { timeout: 20000 });
    const v1 = await ev(() => ({ path: document.getElementById("tlMocapPath").value, msg: document.getElementById("tlMocapMsg").textContent, folder: document.getElementById("tlMocapFolder").textContent }));
    check("✂ Prepare: the clip's used part (0.5 -> 2 s) made in the project's mocap folder, its path shown", /mocap[\\/][^\\/]*_5-20[\\/][^\\/]*_5-20\.mp4$/.test(v1.path) && fs.existsSync(v1.path) && /✓ ready/.test(v1.msg), v1);
    fs.writeFileSync(path.join(path.dirname(v1.path), "walk.fbx"), "FBX");
    await ev(() => window.TlMocap.refresh());
    await p.waitForSelector("#tlMocapList [data-bring]", { timeout: 10000 });
    await ev(() => document.querySelector("#tlMocapList [data-bring]").click());
    await p.waitForFunction(() => window.__m3d.length > 0, null, { timeout: 10000 });
    const call = await ev(() => window.__m3d[0]);
    check("RGB MoCap's export listed; ⤓ To the timeline = a 3D layer of model mocap_<folder>_walk.fbx named 🕺 walk", call[0] === "model" && /^mocap_.*_5-20_walk\.fbx$/.test(call[1]) && call[4] === "🕺 walk", call);
    check("...the file is in models3d (listed for the 3D layers)", await ev((m) => fetch("/api/tlcanvas/models").then((r) => r.json()).then((j) => j.models.some((x) => x.name === m)), call[1]));
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
