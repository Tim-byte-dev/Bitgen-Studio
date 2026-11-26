#!/usr/bin/env node
/* bitGen Studio — 2.978.0 in a REAL browser: the Sketcher's one picture picker + 💾 Daz characters.
 *   🧱 Picture → 3D scene: 🗂 Assets lists a project picture (made here, removed after); 📌 References lists the page's
 *   reference pictures (a stand-in `refs` entry); 📄 File… / 📁 Folder… pick pictures of this computer (setInputFiles); a
 *   picked file is POSTed as bytes, an Assets pick by name + where (page.route catches /api/picscene).
 *   📚 Daz library: 📷 use a photo -> the picker; 💾 Save / 📂 Load a character (the made-up library of test-977).
 * Tim: "the create 3d from picture does not load the picture. it should load from gallery,assets, references or from a folder
 * select and continue with the daz work" */
"use strict";
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execSync, execFileSync } = require("child_process");
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ui978_")), dir = path.join(tmp, "pics"); fs.mkdirSync(dir);
  for (const [n, c] of [["red.png", "red"], ["green.png", "green"]]) execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=" + c + ":s=96x64", "-frames:v", "1", path.join(dir, n)]);
  fs.writeFileSync(path.join(dir, "notes.txt"), "not a picture");
  const t977 = fs.readFileSync(path.join(__dirname, "test-977.js"), "utf8");
  const makeLib = new Function("require", "path", "fs", "zlib", "execFileSync", t977.slice(t977.indexOf("const pt = "), t977.indexOf("(async () => {")) + "; return makeLib;")(require, path, fs, require("zlib"), execFileSync);
  const lib = makeLib(path.join(tmp, "My Library"));
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let asset = "", before = null;
  try {
    const up = await (await p.request.post(URL_ + "api/dazlib/photo?name=ui978_asset.png", { data: fs.readFileSync(path.join(dir, "red.png")), headers: { "Content-Type": "image/png" } })).json();
    asset = up.name;
    check("POST /api/dazlib/photo: picture bytes -> the project's images (Assets)", /^ui978_asset(-\d+)?\.png$/.test(asset) && up.where === "images", up);
    before = await (await p.request.get(URL_ + "api/dazlib")).json();
    await p.request.post(URL_ + "api/dazlib/roots", { data: { roots: [lib.dir] } });
    const posted = [];
    await p.route(/\/api\/picscene(\?.*)?$/, (r) => { if (r.request().method() !== "POST") return r.fulfill({ json: { scenes: [] } }); const h = r.request().headers()["content-type"] || ""; posted.push(/json/.test(h) ? r.request().postDataJSON() : { bytes: (r.request().postDataBuffer() || Buffer.alloc(0)).length, url: r.request().url() }); r.fulfill({ status: 400, json: { error: "stopped by the test" } }); });
    await p.route(/\/api\/pano360$/, (r) => r.fulfill({ json: { ok: true, style_id: "st_ui978" } }));
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PicScene && window.H3PicPick && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); localStorage.setItem("h3.dockmax.off", "1"); H3PushPullFrame.toggleMaxed(true);
      H3ModelsFound.ensure = () => Promise.resolve(true); H3ModelsFound.box = () => Promise.resolve(true); });
    await p.waitForFunction(() => H3PushPull.state.booted, null, { timeout: 40000 });
    await ev(() => { document.getElementById("pscSound") && (document.getElementById("pscSound").checked = false); });
    await p.click("#ppScene");
    await p.waitForSelector("#pscDlg[open] #pscPicker [data-src]", { timeout: 8000 });
    check("🧱 the picker's tabs: Gallery, Assets, References, Folder, File", (await ev(() => [...document.querySelectorAll("#pscPicker [data-src]")].map((b) => b.dataset.src).join())) === "gallery,assets,refs,folder,file");
    await p.click('#pscPicker [data-src="assets"]');
    await p.waitForFunction((n) => [...document.querySelectorAll("#pscPicker .ppp-t")].some((t) => t.title === n), asset, { timeout: 8000 });
    await p.waitForFunction((n) => { const t = [...document.querySelectorAll("#pscPicker .ppp-t")].find((x) => x.title === n); if (t) t.scrollIntoView(); return t && t.querySelector("img").complete && t.querySelector("img").naturalWidth > 0; }, asset, { timeout: 8000 }).catch(() => {});
    const shown = await ev((n) => { const t = [...document.querySelectorAll("#pscPicker .ppp-t")].find((x) => x.title === n); return t && t.querySelector("img").naturalWidth; }, asset);
    check("🗂 Assets: the project picture listed with its thumbnail", shown === 96, shown);
    await ev((n) => { [...document.querySelectorAll("#pscPicker .ppp-t")].find((x) => x.title === n).click(); }, asset);
    await ev(() => { document.getElementById("pscSound").checked = false; document.getElementById("pscWorld").checked = false; });
    await p.click("#pscGo"); await p.waitForFunction(() => /⚠/.test(document.getElementById("pscMsg").textContent), null, { timeout: 8000 });
    check("an Assets pick -> POST {name, where: images}", posted.length === 1 && posted[0].name === asset && posted[0].where === "images", posted);
    await ev(() => { const x = { name: "ref_one.png", url: "data:image/png;base64," + "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" }; if (typeof refs !== "undefined" && Array.isArray(refs)) { refs.push(x); window.__refPushed = true; } else window.refs = [x]; });
    await p.click('#pscPicker [data-src="refs"]');
    await p.waitForFunction(() => document.querySelectorAll("#pscPicker .ppp-t").length >= 1, null, { timeout: 5000 });
    check("📌 References: the page's reference pictures", await ev(() => [...document.querySelectorAll("#pscPicker .ppp-t")].some((t) => t.title === "ref_one.png" || /reference_/.test(t.title))));
    await ev(() => { if (window.__refPushed) refs.pop(); });
    await p.setInputFiles('#pscPicker [data-ppp="folder"]', dir);
    await p.waitForFunction(() => document.querySelectorAll("#pscPicker .ppp-t").length === 2, null, { timeout: 8000 }).catch(() => {});
    const fl = await ev(() => [...document.querySelectorAll("#pscPicker .ppp-t")].map((t) => t.title).sort().join());
    check("📁 Folder…: the folder's pictures (the text file left out)", fl === "green.png,red.png", fl);
    await p.setInputFiles('#pscPicker [data-ppp="file"]', path.join(dir, "green.png"));
    await p.waitForFunction(() => document.querySelectorAll("#pscPicker .ppp-t.sel").length === 1, null, { timeout: 8000 }).catch(() => {});
    await p.click("#pscGo"); await p.waitForFunction((n) => true, null);
    await p.waitForTimeout(800);
    check("📄 File…: one picture, picked at once -> its bytes POSTed with its name", posted.length === 2 && posted[1].bytes > 50 && /name=green\.png/.test(posted[1].url), posted);
    await ev(() => document.getElementById("pscDlg").close());

    /* 📚 the face photo picker + 💾 a character */
    await p.click("#ppDazLib");
    await p.waitForSelector("#pdlDlg[open] .pdl-it", { timeout: 10000 });
    await p.click(".pdl-it");
    await p.check("#pdlFaceOn");
    await p.waitForSelector("#pdlFacePick [data-src]", { timeout: 5000 });
    check("📷 use a photo -> the same picker", (await ev(() => document.querySelectorAll("#pdlFacePick [data-src]").length)) === 5);
    await p.uncheck("#pdlFaceOn");
    await p.check("#pdlDrapeH"); await p.fill("#pdlName", "ui978 char");
    await p.click("#pdlSave");
    await p.waitForFunction(() => /💾/.test(document.getElementById("pdlMsg").textContent), null, { timeout: 5000 });
    await ev(() => { H3DazLib.state.fig = null; document.getElementById("pdlDrapeH").checked = false; });
    await p.waitForFunction(() => [...document.querySelectorAll("#pdlChars option")].some((o) => o.textContent === "ui978 char"), null, { timeout: 5000 });
    await p.selectOption("#pdlChars", "ui978 char");
    await p.waitForFunction(() => /loaded|⚠/.test(document.getElementById("pdlMsg").textContent), null, { timeout: 8000 }).catch(() => {});
    const ld = await ev(() => ({ msg: document.getElementById("pdlMsg").textContent, fig: H3DazLib.state.fig && H3DazLib.state.fig.rel, hair: document.getElementById("pdlDrapeH").checked }));
    check("💾 Save then 📂 Load: the figure and the physics come back", ld.fig === "People/Mini/Mini.duf" && ld.hair, ld);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.message); }
  try { await p.request.post(URL_ + "api/dazlib/roots", { data: { roots: (before && before.roots && before.detected && before.roots.join() !== before.detected.join()) ? before.roots : [] } }); } catch (e) { /* fine */ }
  try { const d = path.join(__dirname, "..", "projects"); for (const pr of fs.readdirSync(d)) { for (const f of [path.join(d, pr, "images", asset), path.join(d, pr, "dazchars", "ui978 char.json")]) if (asset && fs.existsSync(f)) fs.rmSync(f); } } catch (e) { /* fine */ }
  fs.rmSync(tmp, { recursive: true, force: true });
  await b.close();
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
