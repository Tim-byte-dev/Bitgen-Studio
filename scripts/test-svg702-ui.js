#!/usr/bin/env node
/* bitGen Studio — 2.702.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): an SVG put into
 * Assets is uploaded as the PNG drawn from it (sharp, its shape, the transparent background kept), the server keeps a PNG,
 * a broken SVG is refused like a bad file, picture pickers offer .svg. No server / no Playwright = SKIP.
 * Tim (verbatim): "can u add svg to the images i can upload to assets or references" */
"use strict";
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.702.0 browser test did not run"); process.exit(0); }
const ROOT = path.join(__dirname, "..");
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.702.0 browser test did not run"); process.exit(0); }
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1400, height: 900 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(URL0); await p.waitForFunction(() => window.BGSvg && typeof uploadAsset === "function", null, { timeout: 30000 });
    const logo = fs.readFileSync(path.join(ROOT, "static", "logo.svg"), "utf8");
    const r = await p.evaluate(async (logo) => {
      const look = async (blob) => { const bm = await createImageBitmap(blob), c = document.createElement("canvas"); c.width = bm.width; c.height = bm.height; const g = c.getContext("2d"); g.drawImage(bm, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data; let clear = 0, ink = 0; for (let i = 3; i < d.length; i += 4 * 97) { if (d[i] === 0) clear++; else if (d[i] > 200) ink++; } return { w: bm.width, h: bm.height, clear, ink }; };
      const up = await uploadAsset(new File([logo], "svgtest702.svg", { type: "image/svg+xml" }), true);
      const got = await fetch("/passets/images/" + encodeURIComponent(up.name)); const blob = await got.blob(); const sig = Array.from(new Uint8Array(await blob.slice(0, 4).arrayBuffer()));
      const icon = await BGSvg.toPng(new File(['<svg viewBox="0 0 20 10"><rect width="10" height="10" fill="#f80"/></svg>'], "half.svg"));
      const ic = await look(icon.blob);
      const bm = await createImageBitmap(icon.blob), c = document.createElement("canvas"); c.width = bm.width; c.height = bm.height; const g = c.getContext("2d"); g.drawImage(bm, 0, 0);
      const left = Array.from(g.getImageData(500, 500, 1, 1).data), right = Array.from(g.getImageData(1500, 500, 1, 1).data);
      const bad = await uploadAsset(new File(["<svg><g>"], "broken702.svg", { type: "image/svg+xml" }), true);
      const sniff = await BGSvg.isSvgBlob(new Blob(["<?xml version='1.0'?><svg xmlns='http://www.w3.org/2000/svg'/>"], { type: "" }));
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/png,image/jpeg"; BGSvg.widen(inp);
      const tile = AddTile.accept("images");
      return { up, sig, type: blob.type, look: await look(blob), ic, left, right, bad, sniff, accept: inp.accept, tile, stats: BGSvg.stats };
    }, logo);
    check("an SVG into Assets: stored as a PNG (svgtest702.png, kind images) - the server never sees the SVG", /^svgtest702.*\.png$/.test(r.up && r.up.name) && r.up.kind === "images" && r.sig.join() === "137,80,78,71", r.up);
    check("…drawn sharp at 2048 x 2048 (the logo is 1080 square), the background still transparent, the lines solid", r.look.w === 2048 && r.look.h === 2048 && r.look.clear > 1000 && r.look.ink > 100, r.look);
    check("a viewBox-only icon (20 x 10): 2048 x 1024, scaled not cropped (the left half orange, the right half clear)", r.ic.w === 2048 && r.ic.h === 1024 && r.left[0] === 255 && r.left[1] > 120 && r.left[3] === 255 && r.right[3] === 0, [r.ic, r.left, r.right]);
    check("a broken SVG is refused like a bad file (nothing uploaded, no page error)", r.bad === null);
    check("an untyped file that starts like an SVG is recognised", r.sniff === true);
    check("picture pickers offer .svg (and the \"+ add pictures\" tile)", /\.svg,image\/svg\+xml$/.test(r.accept) && /\.svg/.test(r.tile), [r.accept, r.tile]);
    const t = await p.evaluate(async (logo) => {
      const before = refs.length; document.querySelector('.modes button[data-mode="ref2va"]').click();
      const dt = new DataTransfer(); dt.items.add(new File([logo], "tray702.svg", { type: "image/svg+xml" })); filepick.files = dt.files; filepick.dispatchEvent(new Event("change"));
      for (let i = 0; i < 50 && refs.length === before; i++) await new Promise((r) => setTimeout(r, 100));
      const r = refs[refs.length - 1], bm = r ? await createImageBitmap(r.file) : null;
      const out = { added: refs.length - before, name: r && r.file.name, type: r && r.file.type, w: bm && bm.width, accept: filepick.accept };
      if (out.added) { refs.pop(); renderTray(); }
      return out;
    }, logo);
    check("the picture tray's \"+ add reference\": an SVG goes in as the PNG (tray702.png, 2048 wide) - the tray, its size and the render agree", t.added === 1 && t.name === "tray702.png" && t.type === "image/png" && t.w === 2048 && /\.svg/.test(t.accept), t);
    const upNames = [r.up && r.up.name].filter(Boolean);
    // the Open dialog (bitGen's own, Windows 11 style): Assets ▸ Image ▸ + add pictures, an .svg on disk picked
    const tag = "sv" + Date.now().toString(36), D = fs.mkdtempSync(path.join(require("os").tmpdir(), "svg702-"));
    fs.writeFileSync(path.join(D, tag + "_logo.svg"), logo); fs.writeFileSync(path.join(D, tag + "_note.txt"), "not a picture");
    const fdOn = await p.evaluate(() => !!(window.FileDialog && window.FileDialog.enabled && window.FileDialog.local));
    if (fdOn) {
      await p.evaluate(() => { localStorage.setItem("fdlg.view", "details"); document.querySelector('[data-apane="images"] > .addtile').click(); });
      await p.waitForSelector(".fdlg .fd-main", { state: "visible", timeout: 15000 });
      const filt = await p.evaluate(() => document.querySelector(".fdlg .fd-filter").selectedOptions[0].textContent);
      await p.evaluate(() => document.querySelector(".fdlg .fd-addr").dispatchEvent(new MouseEvent("click")));
      await p.fill(".fdlg .fd-addrin", D); await p.press(".fdlg .fd-addrin", "Enter");
      await p.waitForFunction((t) => { const r = document.querySelectorAll(".fdlg .fd-main [data-i]"); return r.length && [...r].every((x) => x.textContent.includes(t)); }, tag, { timeout: 15000 });
      const rows = await p.evaluate(() => [...document.querySelectorAll(".fdlg .fd-main [data-i]")].map((x) => x.textContent));
      await p.click('.fdlg .fd-main [data-i="0"]'); await p.click(".fdlg .fd-ok");
      await p.waitForFunction((t) => assets.images.some((a) => a.name.includes(t)), tag, { timeout: 30000 }).catch(() => {});
      const got = await p.evaluate((t) => assets.images.map((a) => a.name).filter((n) => n.includes(t)), tag);
      check("the Open dialog lists the .svg with the pictures (not the .txt) and it lands in Assets as a PNG", /\*\.svg/.test(filt) && rows.length === 1 && /_logo\.svg/.test(rows[0]) && got.length === 1 && /_logo\.png$/.test(got[0]), { filt, rows, got });
      upNames.push(...got);
    } else check("the Open dialog is on in the studio (a local page)", false, "FileDialog not local");
    fs.rmSync(D, { recursive: true, force: true });
    await p.evaluate(async (ns) => { try { await fetch("/api/passets/recycle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: ns.map((name) => ({ kind: "images", name })) }) }); } catch (e) {} }, upNames);   // tidy: the test's pictures go
    check("no page errors", errs.length === 0, errs);

  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
