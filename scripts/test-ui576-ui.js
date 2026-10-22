#!/usr/bin/env node
/* bitGen Studio — 2.576.0 in a REAL browser: the viewer's 🧩 To model… (a gallery picture -> the picker preselects the
 * model it was made with -> copied into that model's files with its prompt, and made its thumbnail), Ctrl+↓ in the viewer
 * on one of a model's own pictures = its thumbnail at once, and the status bar's "reading n%" while the sync reads a file.
 * Tim: "in the viewer add a button to send music/video/image to modelinfo ... when user clicks on an image and presses
 * ctrl+ the down arrow to make this the primary thumbnail for the model". Against the running app (H3_URL). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.576.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, "latin1"), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); }
function png(text, rgb) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(8, 0); ihdr.writeUInt32BE(8, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(8 * 25); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const o = y * 25 + 1 + x * 3; raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2]; }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("tEXt", Buffer.from("prompt\0" + text, "latin1")), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

(async () => {
  const cfg0 = await api("/api/config");
  const keepDir = ((cfg0.engine || {}).comfy || {}).dir || "";
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg576ui-"));
  const FX = require("./mmfixture518.js"), F = FX.make(T);
  FX.safetensors(path.join(F.models, "checkpoints", "e2e576_model.safetensors"), { "modelspec.architecture": "stable-diffusion-xl-v1-base" }, ["conditioner.embedders.1.x"]);
  const KEY = "checkpoints|e2e576_model.safetensors";
  const prj = (await api("/api/projects")).current || "default";
  const OUT = path.join(ROOT, "projects", prj, "output"); fs.mkdirSync(OUT, { recursive: true });
  const G1 = png(JSON.stringify({ "3": { class_type: "KSampler", inputs: { seed: 576, steps: 20, cfg: 5, positive: ["6", 0] } }, "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "e2e576_model.safetensors" } }, "6": { class_type: "CLIPTextEncode", inputs: { text: "e2e576 a blue whale" } } }), [20, 60, 200]);
  fs.writeFileSync(path.join(OUT, "e2e576_whale.png"), G1);
  const LIB = path.join(ROOT, "model_info", "models", "e2e576_model");
  fs.rmSync(LIB, { recursive: true, force: true });
  await api("/api/config", { engine: { comfy: { dir: F.comfy } } });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3ToModel && document.getElementById("lb_tomodel"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    for (let k = 0; k < 3; k++) { try { await api("/api/modelmgr/cards?refresh=1"); break; } catch (e) { await p.waitForTimeout(2000); } }   // a cold first build can drop the socket
    /* 1 the viewer's 🧩 To model… */
    await ev(() => lbOpen([{ url: "/outputs/e2e576_whale.png", kind: "image", name: "e2e576_whale.png" }], 0));
    await p.click("#lb_tomodel");
    await p.waitForSelector('#tmList input[name=tmPick][value="checkpoints|e2e576_model.safetensors"]', { timeout: 15000 });
    const pk = await ev(() => { const r = document.querySelector("#tmList input[name=tmPick]:checked"); const first = document.querySelector("#tmList label"); return { checked: r && r.value, first: first && first.textContent, thumb: document.getElementById("tmThumb").checked, top: document.getElementById("tmDlg").open && document.getElementById("lb").open }; });
    check("🧩 To model…: a picker over the viewer, the model the picture was made with picked first (its metadata), \"thumbnail\" ticked (it has none)",
      pk.top && pk.checked === "checkpoints|e2e576_model.safetensors" && /made with it/.test(pk.first || "") && pk.thumb, pk);
    await p.click("#tmGo");
    await p.waitForFunction(() => /added to the model's files/.test((document.getElementById("h3UseMetaNote") || {}).textContent || ""), null, { timeout: 15000 });
    await p.waitForTimeout(400);
    const md = await api("/api/modelmgr/media?key=" + encodeURIComponent(KEY));
    const it = (md.items || [])[0] || {};
    const th = Buffer.from(await (await fetch(URL_ + "api/modelmgr/thumb?key=" + encodeURIComponent(KEY))).arrayBuffer());
    check("...copied into the model's files in model_info with its prompt / seed (from the gallery's file) and made its thumbnail",
      it.kind === "image" && (it.meta || {}).seed === 576 && /blue whale/.test((it.meta || {}).prompt || "") && fs.existsSync(path.join(LIB, "user", it.file || "x")) && md.thumb_of === it.id && th.equals(G1), md);
    /* 2 Ctrl+↓ on one of the model's own pictures */
    const G2 = png("{}", [200, 30, 30]);
    const fd = new FormData(); fd.append("key", KEY); fd.append("file", new Blob([G2], { type: "image/png" }), "red.png");
    const add2 = await (await fetch(URL_ + "api/modelmgr/media", { method: "POST", body: fd })).json();
    await ev((o) => lbOpen([{ url: "/api/modelmgr/media/file?key=" + encodeURIComponent(o.k) + "&id=" + encodeURIComponent(o.id), kind: "image", name: "red.png" }], 0), { k: KEY, id: add2.item.id });
    await p.waitForTimeout(300);
    await p.keyboard.press("Control+ArrowDown");
    await p.waitForFunction(() => /thumbnail is this picture now/.test((document.getElementById("h3UseMetaNote") || {}).textContent || ""), null, { timeout: 10000 });
    const th2 = Buffer.from(await (await fetch(URL_ + "api/modelmgr/thumb?key=" + encodeURIComponent(KEY))).arrayBuffer());
    check("Ctrl+↓ in the viewer on one of the model's own pictures: that picture is its thumbnail at once", th2.equals(G2));
    /* Ctrl+↓ on a gallery picture: the picker with the thumbnail box ticked */
    await ev(() => lbOpen([{ url: "/outputs/e2e576_whale.png", kind: "image", name: "e2e576_whale.png" }], 0));
    await p.waitForTimeout(300);
    await p.keyboard.press("Control+ArrowDown");
    await p.waitForSelector("#tmDlg[open]", { timeout: 8000 });
    const pk2 = await ev(() => document.getElementById("tmThumb").checked);
    await ev(() => document.getElementById("tmDlg").close());
    check("Ctrl+↓ on any other picture: the picker opens with \"Make it the model's thumbnail\" ticked", pk2 === true);
    await ev(() => document.getElementById("lb").close());
    /* 3 the status bar while a file is read */
    await p.route("**/api/modelmgr/fetch", (r) => { if (r.request().method() !== "GET") return r.continue(); r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ running: true, done: 3, total: 9, current: "big.safetensors", hashing: { file: "big.safetensors", got: 45, total: 100 } }) }); });
    await ev(() => H3CivitaiSync.watch());
    await p.waitForTimeout(400);
    const chip = await ev(() => (document.getElementById("sbCivitai") || {}).textContent || "");
    check("status bar: \"🔄 Civitai 3/9 · reading 45%\" while the sync reads a file's SHA-256", chip === "🔄 Civitai 3/9 · reading 45%", chip);
    await p.unroute("**/api/modelmgr/fetch");
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    await b.close();
    try { await api("/api/config", { engine: { comfy: { dir: keepDir } } }); } catch (e) { /* fine */ }
    try { fs.rmSync(LIB, { recursive: true, force: true }); fs.rmSync(path.join(OUT, "e2e576_whale.png"), { force: true }); fs.rmSync(T, { recursive: true, force: true }); } catch (e) { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
