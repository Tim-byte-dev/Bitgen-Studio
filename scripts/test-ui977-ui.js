#!/usr/bin/env node
/* bitGen Studio — 2.977.0 in a REAL browser: 📚 the Daz library in the Sketcher (a made-up library of OUR OWN tiny figure,
 * shirt and hair - test-977.js's makeLib - set as the library folder through POST /api/dazlib/roots, put back after).
 *   The dialog says it is not a replacement for Daz Studio; the folders; the kinds with thumbnails; the encrypted one counted;
 *   pick the figure -> its dials; a dial dragged; the shirt + hair worn; 💨 clothing + hair physics; 🧍 Build -> a .glb in the
 *   project's 3D models with 3 pieces; ⤒ Open in the Sketcher brings it in as a group.
 * Tim: "just for bitgen to point to the daz library, and can we build our own dforce..." -> "build steps 1-4" */
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
  // the made-up library (test-977's own builder, loaded without running its checks)
  const t977 = fs.readFileSync(path.join(__dirname, "test-977.js"), "utf8");
  const code = t977.slice(t977.indexOf("const pt = "), t977.indexOf("(async () => {"));
  const makeLib = new Function("require", "path", "fs", "zlib", "execFileSync", code + "; return makeLib;")(require, path, fs, require("zlib"), require("child_process").execFileSync);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ui977_")), lib = makeLib(path.join(tmp, "My Library"));
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let before = null, made = "";
  try {
    before = (await (await p.request.get(URL_ + "api/dazlib")).json());
    await p.request.post(URL_ + "api/dazlib/roots", { data: { roots: [lib.dir] } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.H3DazLib && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); localStorage.setItem("h3.dockmax.off", "1"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.V, null, { timeout: 40000 });
    await ev(() => { H3PushPull.newModel && H3PushPull.newModel(); });
    await p.click("#ppDazLib");
    await p.waitForSelector("#pdlDlg[open] .pdl-it", { timeout: 10000 });
    const d0 = await ev(() => ({ note: document.querySelector("#pdlDlg .pdl-note").textContent, roots: document.getElementById("pdlRoots").textContent, items: [...document.querySelectorAll(".pdl-it span")].map((x) => x.textContent), img: document.querySelector(".pdl-it img").naturalWidth, enc: document.getElementById("pdlEnc").textContent }));
    check("📚 opens: the words - not a replacement for Daz Studio, a very powerful character creator - at the top", /not a replacement for Daz Studio/.test(d0.note) && /very powerful character creator/.test(d0.note), d0.note);
    check("the library folder shown; 🧍 Figures lists our figure with its thumbnail; the encrypted item counted, skipped", d0.roots.includes("My Library") && d0.items.join() === "Mini" && d0.img > 0 && /1 encrypted/.test(d0.enc), d0);
    await p.click(".pdl-it");
    await p.waitForSelector("#pdlDials input[type=range]", { timeout: 5000 });
    await ev(() => { const r = document.querySelector("#pdlDials input[type=range]"); r.value = "0.5"; r.dispatchEvent(new Event("input")); });
    check("the figure picked -> its shape dial (Tall) as a slider; dragged to 0.5", await ev(() => document.querySelector("#pdlDials .pdl-dial span").textContent === "Tall" && document.querySelector("#pdlDials output").textContent === "0.50"));
    await p.click('[data-kind="clothing"]'); await p.waitForSelector(".pdl-it", { timeout: 5000 }); await p.click(".pdl-it");
    await p.click('[data-kind="hair"]'); await p.waitForFunction(() => [...document.querySelectorAll(".pdl-it span")].some((s) => s.textContent === "Hair"), null, { timeout: 5000 }); await p.click(".pdl-it");
    check("👕 the shirt and 💇 the hair worn", (await p.textContent("#pdlWear")) === "Shirt, Hair");
    await p.check("#pdlDrapeC"); await p.check("#pdlDrapeH"); await p.fill("#pdlFrames", "8"); await p.fill("#pdlName", "ui977_mini");
    const bp = p.waitForResponse((r) => r.url().includes("/api/dazlib/build"), { timeout: 60000 });
    await p.click("#pdlBuild");
    const resp = await (await bp).json();
    made = resp.model || "";
    await p.waitForFunction(() => /✔|⚠/.test(document.getElementById("pdlMsg").textContent), null, { timeout: 20000 });
    check("🧍 Build: <name>_daz.glb in the 3D models - the body, its eyes, the shirt, the hair; draped; one skeleton", /^ui977_mini_daz(_\d+)?\.glb$/.test(made) && resp.info.pieces.length === 4 && resp.info.pieces.find((x) => x.kind === "clothing").draped_mm > 0 && resp.info.bones >= 4 && /✔/.test(await p.textContent("#pdlMsg")), resp);
    const g0 = await ev(() => H3PushPull.state.M.g.length);
    await p.click("#pdlOpen");
    await p.waitForFunction(() => !document.getElementById("pdlDlg").open, null, { timeout: 15000 }).catch(() => {});
    const im = await ev(() => ({ groups: H3PushPull.state.M.g.length, name: (H3PushPull.state.M.g[H3PushPull.state.M.g.length - 1] || {}).name }));
    check("⤒ Open in the Sketcher: the character comes in as a group", im.groups === g0 + 1 && /^ui977_mini_daz/.test(im.name), im);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.message); }
  try { await p.request.post(URL_ + "api/dazlib/roots", { data: { roots: (before && before.roots && before.detected && before.roots.join() !== before.detected.join()) ? before.roots : [] } }); } catch (e) { /* fine */ }
  try { const d = path.join(__dirname, "..", "projects"); for (const pr of fs.readdirSync(d)) { const f = path.join(d, pr, "models3d", made); if (made && fs.existsSync(f)) fs.rmSync(f); } } catch (e) { /* fine */ }
  fs.rmSync(tmp, { recursive: true, force: true });
  await b.close();
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
