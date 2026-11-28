#!/usr/bin/env node
/* bitGen Studio — 3.11.1 in a REAL browser: a figure in a library's Animals folder (our made-up DOLL, loaded by a .duf there that
 * does not say "figure") is in the DAZ Library's 🧍 Figures tab and builds into the Sketcher's scene.
 * Tim: "in sketcher daz doesn't find other libraries. i have daz horse 3 in D:\daz3d\Content\Animals and it is not showing up" */
"use strict";
const path = require("path");
const fs = require("fs");
const os = require("os");
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
  const t981 = fs.readFileSync(path.join(__dirname, "test-981.js"), "utf8");
  const { makeDoll } = new Function("require", "path", "fs", t981.slice(t981.indexOf("const pt = "), t981.indexOf("(async () => {")) + "; return { makeDoll };")(require, path, fs);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ui31101_")), lib = path.join(tmp, "Content"); makeDoll(lib);
  const duf = JSON.parse(fs.readFileSync(path.join(lib, "People/Doll/Doll.duf"), "utf8")); delete duf.asset_info;
  fs.mkdirSync(path.join(lib, "Animals", "Doll Horse"), { recursive: true }); fs.writeFileSync(path.join(lib, "Animals", "Doll Horse", "Doll Horse.duf"), JSON.stringify(duf));
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), p = await b.newPage({ viewport: { width: 2100, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const made = [];
  try {
    await p.request.post(URL_ + "api/dazlib/roots", { data: { roots: [lib] } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.(daztools\.|ppdocks|pparch)/.test(k)).forEach((k) => localStorage.removeItem(k)); });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3DazTools && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); localStorage.setItem("h3.dockmax.off", "1"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.V, null, { timeout: 40000 });
    await p.click("#ppDazLib"); await p.waitForSelector("#dzGrid .dzit", { timeout: 15000 });
    await p.click('#dzTabs [data-kind="figure"]');
    await p.waitForFunction(() => [...document.querySelectorAll("#dzGrid .dzit span")].some((s) => s.textContent === "Doll Horse"), null, { timeout: 10000 });
    const names = await ev(() => [...document.querySelectorAll("#dzGrid .dzit span")].map((s) => s.textContent));
    check("🧍 Figures lists the figure in the Animals folder (beside the one in People)", names.includes("Doll Horse") && names.includes("Doll"), names);
    await p.locator("#dzGrid .dzit", { hasText: "Doll Horse" }).first().click();
    await p.waitForFunction(() => H3DazScene.list().length === 1 && !H3DazTools.state.busy, null, { timeout: 60000 });
    const c = await ev(() => ({ rel: H3DazTools.cur().fig.rel, bones: H3DazScene.rig(H3DazScene.list()[0]).bones.size }));
    check("…a click builds it into the scene, rigged", c.rel === "Animals/Doll Horse/Doll Horse.duf" && c.bones > 3, c);
    made.push(...(await ev(() => H3DazTools.state.scene.chars.map((x) => x.last).filter(Boolean))));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran without throwing", false, String(e && e.stack || e)); }
  try {
    await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.(daztools\.|ppdocks|pparch)/.test(k)).forEach((k) => localStorage.removeItem(k)); });
    await p.request.post(URL_ + "api/dazlib/roots", { data: { roots: [] } });
    for (const m of made) await p.request.delete(URL_ + "api/tlcanvas/model/" + encodeURIComponent(m)).catch(() => {});
  } catch (e) { /* fine */ }
  await b.close(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exitCode = fail ? 1 : 0;
})();
