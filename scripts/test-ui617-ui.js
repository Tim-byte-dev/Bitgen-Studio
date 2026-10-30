#!/usr/bin/env node
/* bitGen Studio — 2.617.0 in a REAL browser: TEXT EFFECTS FROM A ZIP (several in one), its fonts too.
 * Tim: "can we install text preset effects from a zip, multiple effects can be in a single zip".
 *   a pack zip (two PSD text effects in a folder, a bitGen preset .json, a font, a preview, macOS's __MACOSX copies, a
 *   broken PSD) through the timeline text's Presets ▾ ＋ Import: the three effects in "Your imports" (the first picked), the
 *   font in <install>/fonts, the broken PSD named, the junk left out; a zip + a PSD picked together; the image editor's
 *   picker offers the same.
 * Against the running app (H3_URL, default the e2e server on :8311 - run from its folder). No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.617.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_tfxzip_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: body === "DELETE" ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: body === "DELETE" ? undefined : JSON.stringify(body) })).json();

// two small text effect PSDs (ag-psd): a smart-object word, a side copy, a coloured face
const A = require(path.join(ROOT, "static", "vendor", "ag-psd.js"));
const G = "20953ddb-9391-11ec-b4f1-c15674f50bc4";
const tq = (x0, y0, x1, y1) => [x0, y0, x1, y0, x1, y1, x0, y1];
const sl = (name, t, extra) => Object.assign({ name, placedLayer: { id: G, placed: G, type: "raster", transform: t, width: 200, height: 100 } }, extra || {});
const inner = A.writePsdBuffer({ width: 200, height: 100, children: [{ name: "word", text: { text: "Hi", style: { font: { name: "Foo-Regular" }, fontSize: 40, fillColor: { r: 0, g: 128, b: 255 } } } }] }, { invalidateTextLayers: false });
const psd = (face) => A.writePsdBuffer({ width: 400, height: 300, linkedFiles: [{ id: G, name: "word.psb", data: inner }], children: [
  { name: "bg" }, sl("copy 1", tq(98, 104, 302, 204), { effects: { solidFill: [{ enabled: true, color: { r: 40, g: 80, b: 200 }, opacity: 1 }] } }),
  sl("Your text here", tq(100, 100, 300, 200), { effects: { solidFill: [{ enabled: true, color: face, opacity: 1 }] } })] });
const T = fs.mkdtempSync(path.join(os.tmpdir(), "tfxzip_")), src = path.join(T, "src");
fs.mkdirSync(path.join(src, "Mega Pack", "PSD"), { recursive: true }); fs.mkdirSync(path.join(src, "__MACOSX", "Mega Pack", "PSD"), { recursive: true });
fs.writeFileSync(path.join(src, "Mega Pack", "PSD", "lava-flow-text-effect.psd"), psd({ r: 255, g: 80, b: 0 }));
fs.writeFileSync(path.join(src, "Mega Pack", "PSD", "ice-cold-text-effect.psd"), psd({ r: 120, g: 220, b: 255 }));
fs.writeFileSync(path.join(src, "Mega Pack", "PSD", "broken.psd"), "this is not a psd");
fs.writeFileSync(path.join(src, "__MACOSX", "Mega Pack", "PSD", "._lava-flow-text-effect.psd"), "resource fork");
fs.writeFileSync(path.join(src, "Mega Pack", "preview.jpg"), "jpg");
fs.writeFileSync(path.join(src, "Mega Pack", "readme.txt"), "thanks");
const gold = JSON.parse(fs.readFileSync(path.join(ROOT, "textfx", "arena-gold-3d.json"), "utf8")); gold.name = "Shared Gold"; delete gold.id;
fs.writeFileSync(path.join(src, "Mega Pack", "shared-gold.json"), JSON.stringify(gold));
const FONT = ["/usr/share/fonts/truetype/crosextra/Caladea-Regular.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"].find((f) => fs.existsSync(f));
if (FONT) { fs.mkdirSync(path.join(src, "Mega Pack", "Fonts")); fs.copyFileSync(FONT, path.join(src, "Mega Pack", "Fonts", path.basename(FONT))); }
const ZIP = path.join(T, "mega-pack.zip"), ZIP2 = path.join(T, "single.zip"), LONE = path.join(T, "neon-glow-text-effect.psd");
execFileSync("python3", ["-c", `import zipfile,os,sys
src,out=sys.argv[1],sys.argv[2]
z=zipfile.ZipFile(out,"w",zipfile.ZIP_DEFLATED)
for d,_,fs in os.walk(src):
  for f in fs:
    p=os.path.join(d,f); z.write(p,os.path.relpath(p,src),compress_type=zipfile.ZIP_STORED if f.endswith(".jpg") else zipfile.ZIP_DEFLATED)
z.close()`, src, ZIP]);
fs.writeFileSync(LONE, psd({ r: 255, g: 0, b: 255 }));
execFileSync("python3", ["-c", "import zipfile,sys\nz=zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_DEFLATED)\nz.writestr('mint-text-effect.psd', open(sys.argv[2],'rb').read())\nz.close()", ZIP2, LONE]);

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 2200, height: 1300 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  const before = new Set(((await api("/api/textfx/presets")).presets || []).map((x) => x.id));
  const fontDir = path.join(ROOT, "fonts"), fontsBefore = fs.existsSync(fontDir) ? new Set(fs.readdirSync(fontDir)) : new Set();
  const local = /127\.0\.0\.1|localhost/.test(URL_);
  try {
    await api("/api/projects/new", { name: P });
    await api("/api/projects/load", { name: P });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3TextFx && window.TlCanvas && window.H3Fonts && H3TextFx.list().length >= 12, null, { timeout: 60000 });
    await p.waitForTimeout(500);
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 900);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; tlSave(); renderTimeline();
      TlCanvas.addText({ x: TlCanvas.state.W / 2, y: TlCanvas.state.H / 2 });
      window.__c = tl.images[0].clips[0];
      TlCanvas.select(__c, TlCanvas.layerOf(__c)); TlCanvas.paintProps();
    });
    await p.waitForSelector("#tlpFxRow .tfx-file", { state: "attached" });
    const ui = await ev(() => { const f = document.querySelector("#tlpFxRow .tfx-file"); const o = [...document.querySelectorAll("#tlpFxRow .tfx-sel option")].pop(); return { accept: f.accept, multiple: f.multiple, last: o.textContent }; });
    check("Presets ▾ ＋ Import PSD text effects or a zip… - .psd / .psb / .zip, several at once", ui.accept === ".psd,.psb,.zip" && ui.multiple && ui.last === "＋ Import PSD text effects or a zip…", ui);

    await p.setInputFiles("#tlpFxRow .tfx-file", ZIP);
    await p.waitForFunction(() => /text effects? added|No text effects added/.test(document.getElementById("sblog").textContent), null, { timeout: 60000 });
    const msg = await ev(() => document.getElementById("sblog").textContent);
    const now = ((await api("/api/textfx/presets")).presets || []).filter((x) => !before.has(x.id));
    const names = now.map((x) => x.name).sort();
    const picked = await ev(() => window.__c.text.fx);
    check("a pack zip: its two PSD text effects (in a folder) + the bitGen preset .json go in as yours - 3 added, the first picked; the broken PSD named; previews / readme / __MACOSX copies left out",
      now.length === 3 && JSON.stringify(names) === JSON.stringify(["Ice Cold", "Lava Flow", "Shared Gold"]) && /＋ 3 text effects added/.test(msg) && /not added: broken\.psd/.test(msg) && now.some((x) => x.id === picked), { names, msg, picked });
    const og = await ev(() => [...document.querySelectorAll("#tlpFxRow .tfx-sel optgroup")].map((g) => g.label + ":" + g.children.length));
    check("…listed under 'Your imports' in the dropdown", og.some((x) => /^Your imports:3$/.test(x)), og);
    if (FONT && local) {
      const added = fs.existsSync(fontDir) ? fs.readdirSync(fontDir).filter((f) => !fontsBefore.has(f)) : [];
      const fam = await ev(() => H3Fonts.families());
      check("…the font it carries is in the studio's font folder (<install>/fonts), the font lists know it, the line says so",
        added.includes(path.basename(FONT)) && /font\(s\) added/.test(msg) && fam.length > 0, { added, msg: msg.slice(0, 300) });
    }
    const draws = await ev(() => new Promise((res) => { const im = new Image(); im.onload = () => { const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 150 && d[i + 2] < 80 || (d[i] < 170 && d[i + 1] > 180 && d[i + 2] > 220) || (d[i] > 200 && d[i + 1] > 150 && d[i + 2] < 90)) n++; res(n); };
      setTimeout(() => { TlCanvas.draw(); im.src = TlCanvas.snapshot(); }, 800); }));
    check("…the picked effect draws on the text", draws > 500, draws);

    /* a zip + a PSD picked together */
    await ev(() => TlCanvas.paintProps());
    await p.waitForSelector("#tlpFxRow .tfx-file", { state: "attached" });
    await ev(() => { document.getElementById("sblog").textContent = ""; });
    await p.setInputFiles("#tlpFxRow .tfx-file", [ZIP2, LONE]);
    await p.waitForFunction(() => /text effects? added/.test(document.getElementById("sblog").textContent), null, { timeout: 60000 });
    const msg2 = await ev(() => document.getElementById("sblog").textContent);
    const now2 = ((await api("/api/textfx/presets")).presets || []).filter((x) => !before.has(x.id)).map((x) => x.name);
    check("a zip and a PSD picked together: both effects go in (Mint from the zip, Neon Glow on its own)", /＋ 2 text effects added/.test(msg2) && now2.includes("Mint") && now2.includes("Neon Glow") && now2.length === 5, { msg2, now2 });

    /* the image editor's Type tool offers the same */
    const ie = await ev(() => { const box = H3TextFx.picker({ current: "" }); document.body.appendChild(box); const r = { accept: box.querySelector(".tfx-file").accept, many: typeof box.importMany === "function" }; box.remove(); return r; });
    check("every text tool's preset picker (the image editor's too - the same H3TextFx.picker) takes zips", ie.accept === ".psd,.psb,.zip" && ie.many, ie);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e.stack || e)); }
  finally {
    await b.close();
    try { for (const x of ((await api("/api/textfx/presets")).presets || [])) if (!before.has(x.id)) await api("/api/textfx/presets/" + encodeURIComponent(x.id), "DELETE"); } catch { /* fine */ }
    if (local && fs.existsSync(fontDir)) { for (const f of fs.readdirSync(fontDir)) if (!fontsBefore.has(f)) fs.rmSync(path.join(fontDir, f), { force: true }); }
    try { await api("/api/projects/delete", { name: P }); } catch { /* fine */ }
    fs.rmSync(T, { recursive: true, force: true });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
