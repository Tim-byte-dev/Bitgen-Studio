#!/usr/bin/env node
/* bitGen Studio — 2.575.0 in a REAL browser: the model manager's own files of a model (＋ Add a PNG with a ComfyUI graph in
 * it -> its prompt / seed / cfg / steps read; a click opens the viewer; ✎→ fills the prompt + Basic Settings; 🖼 makes it
 * the thumbnail), the editor's star rating (3.5 by a click on the 4th star's left half), Model type and 🔞 NSFW + the
 * NSFW filter, ✎→ on a gallery picture, the Civitai sync in the status bar, and a docker hidden inside a ▣ docker staying
 * hidden and in there over a reload. Against the running app (H3_URL). No Playwright = SKIP. */
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.575.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, "latin1"), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); }
function png(text) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(8, 0); ihdr.writeUInt32BE(8, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(8 * (1 + 8 * 3)); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const o = y * 25 + 1 + x * 3; raw[o] = 200; raw[o + 1] = 80; raw[o + 2] = 30; }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("tEXt", Buffer.from("prompt\0" + text, "latin1")), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const GRAPH = JSON.stringify({ "3": { class_type: "KSampler", inputs: { seed: 4242, steps: 26, cfg: 6.5, sampler_name: "euler", positive: ["6", 0], negative: ["7", 0] } },
  "6": { class_type: "CLIPTextEncode", inputs: { text: "e2e575 a red fox in the snow" } }, "7": { class_type: "CLIPTextEncode", inputs: { text: "blurry" } } });

(async () => {
  const cfg0 = await api("/api/config");
  const keepDir = ((cfg0.engine || {}).comfy || {}).dir || "";
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg575ui-"));
  const FX = require("./mmfixture518.js"), F = FX.make(T);
  FX.safetensors(path.join(F.models, "checkpoints", "e2e575_model.safetensors"), { "modelspec.architecture": "stable-diffusion-xl-v1-base" }, ["conditioner.embedders.1.x"]);
  const FOX = path.join(T, "fox575.png"); fs.writeFileSync(FOX, png(GRAPH));
  const prj = (await api("/api/projects")).current || "default";
  const OUT = path.join(ROOT, "projects", prj, "output"); fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "e2e575_gallery.png"), png(JSON.stringify({ "3": { class_type: "KSampler", inputs: { seed: 9191, steps: 12, cfg: 3, positive: ["6", 0] } }, "6": { class_type: "CLIPTextEncode", inputs: { text: "e2e575 gallery prompt" } } })));
  const LIB = path.join(ROOT, "model_info", "models", "e2e575_model");
  await api("/api/config", { engine: { comfy: { dir: F.comfy } } });
  const b = await chromium.launch();
  let p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = [];
  const hook = (pg) => pg.on("pageerror", (e) => errs.push(e.message));
  hook(p);
  const ev = (f, a) => p.evaluate(f, a);
  const KEY = "checkpoints|e2e575_model.safetensors";
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3ModelMgr && window.SecFloat && SecFloat.started && document.getElementById("mmBtn") && window.H3UseMeta, null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    await ev(() => { try { localStorage.removeItem("h3mm.sel.v1"); } catch (e) { /* fine */ } const S = H3ModelMgr.state(); S.tab = "models"; S.folder = ""; S.page = 0; S.nsfw = true; });
    await p.click("#mmBtn");
    await ev(() => SecFloat.float("modelmgr", 300, 60, 900, 760));
    await ev(() => H3ModelMgr.load(true));
    await p.waitForFunction((k) => !!document.querySelector('#mmGrid .mmcard[data-key="' + k + '"]'), KEY, { timeout: 20000 });

    /* 1 your files of the model */
    await ev((k) => H3ModelMgr.openInfo(k), KEY);
    await p.waitForSelector("#mmMAdd", { timeout: 10000 });
    await p.setInputFiles("#mmMFile", FOX);
    await p.waitForSelector("#mmMGrid [data-mmm]", { timeout: 15000 });
    const md = await api("/api/modelmgr/media?key=" + encodeURIComponent(KEY));
    const it = (md.items || [])[0] || {};
    check("＋ Add a picture: kept with the model (model_info/models/<stem>/user), its prompt / seed / cfg / steps read from its ComfyUI graph",
      it.kind === "image" && (it.meta || {}).seed === 4242 && (it.meta || {}).steps === 26 && (it.meta || {}).cfg === 6.5 && /red fox/.test((it.meta || {}).prompt || "") && fs.existsSync(path.join(LIB, "user", it.file || "x")), md);
    await p.click("#mmMGrid [data-mmm='0']", { position: { x: 20, y: 20 } });
    await p.waitForTimeout(600);
    const lb = await ev(() => ({ open: document.getElementById("lb").open, src: (document.querySelector("#lb img:not([hidden]), #lb img") || {}).src || "" }));
    check("a click on it opens the image viewer (the gallery's dialog) on that picture", lb.open && /\/api\/modelmgr\/media\/file\?key=/.test(lb.src), lb);
    await ev(() => document.getElementById("lb").close());
    // the style list paints Basic Settings ▸ Image (populateImageBasics) when it arrives - after that, not before
    await p.waitForFunction(() => typeof styleList !== "undefined" && styleList.length > 0, null, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(1500);
    await ev(() => { ["imgSteps", "imgCfg"].forEach((id) => { const x = document.getElementById(id); if (x) { x.value = x.min || 1; x.dispatchEvent(new Event("input")); } }); const s = document.getElementById("seed"); s.value = "-1"; });
    await p.click("#mmMGrid [data-mmmuse='0']");
    await p.waitForTimeout(400);
    const pr = await ev(() => ({ prompt: document.getElementById("prompt").value, seed: document.getElementById("seed").value, steps: document.getElementById("imgSteps").value, cfg: document.getElementById("imgCfg").value }));
    check("✎→ To prompt: its prompt, seed 4242, 26 steps, cfg 6.5 into the prompt box + Basic Settings ▸ Image", /red fox/.test(pr.prompt) && pr.seed === "4242" && pr.steps === "26" && +pr.cfg === 6.5, pr);
    await p.click("#mmMGrid [data-mmmthumb='0']");
    await p.waitForFunction((k) => { const c = (H3ModelMgr.state().data.models || []).find((x) => x.key === k); return c && c.thumb_v; }, KEY, { timeout: 10000 });
    const th = await (await fetch(URL_ + "api/modelmgr/thumb?key=" + encodeURIComponent(KEY))).arrayBuffer();
    check("🖼 as the thumbnail: the card's picture is now that file (its bytes)", Buffer.from(th).equals(fs.readFileSync(FOX)));

    /* 2 the editor: stars, model type, NSFW; the filter */
    await ev((k) => { H3ModelMgr.closeInfo(); }, KEY);
    await p.click('#mmGrid .mmcard[data-key="' + KEY + '"] [data-mmedit]');
    await p.waitForSelector("#mmForm .mmstars.edit");
    const st4 = await ev(() => { const s = document.querySelector('#mmForm [data-mmstar="4"]').getBoundingClientRect(); return [s.left + s.width * 0.25, s.top + s.height / 2]; });
    await p.mouse.click(st4[0], st4[1]);
    const rt = await ev(() => ({ v: document.getElementById("mmeRate").value, fills: [...document.querySelectorAll("#mmForm .mmstars .mfill")].map((x) => x.style.width).join(), txt: document.getElementById("mmeRateTxt").textContent }));
    check("the star editor: a click on the 4th star's left half = 3.5 - three and a half stars filled", rt.v === "3.5" && rt.fills === "100%,100%,100%,50%,0%" && /3\.5/.test(rt.txt), rt);
    await ev(() => { const t = document.getElementById("mmeType"); t.value = "Checkpoint"; document.getElementById("mmeNsfw").checked = true; });
    await p.click("#mmeSave");
    await p.waitForFunction((k) => { const c = (H3ModelMgr.state().data.models || []).find((x) => x.key === k); return c && c.nsfw && c.user_rating === 3.5; }, KEY, { timeout: 10000 });
    const card = await ev((k) => { const c = H3ModelMgr.state().data.models.find((x) => x.key === k); const el = document.querySelector('#mmGrid .mmcard[data-key="' + k + '"]'); return { type: c.model_type, nsfw: c.nsfw, badge: !!(el && el.querySelector(".nsfw")), stars: el ? el.querySelectorAll(".mmstars .mst").length : 0 }; }, KEY);
    check("saved: 3.5 stars on the card (five star glyphs), Model type Checkpoint, 🔞 on the card", card.type === "Checkpoint" && card.nsfw && card.badge && card.stars === 5, card);
    await ev(() => { const n = document.getElementById("mmNsfw"); n.checked = false; n.dispatchEvent(new Event("change")); });
    const hidden = await ev((k) => !document.querySelector('#mmGrid .mmcard[data-key="' + k + '"]'), KEY);
    await ev(() => { const n = document.getElementById("mmNsfw"); n.checked = true; n.dispatchEvent(new Event("change")); });
    const back = await ev((k) => !!document.querySelector('#mmGrid .mmcard[data-key="' + k + '"]'), KEY);
    check("the filter bar's 🔞 NSFW: unticked hides the NSFW card, ticked shows it", hidden && back);

    /* 3 ✎→ on a gallery picture */
    await ev(() => { document.getElementById("prompt").value = ""; const t = document.querySelector('.gtabs button[data-gtab="images"]'); if (t) t.click(); refreshGallery(); });
    await p.waitForSelector('#gallery .thumb[data-name="e2e575_gallery.png"] .h3usemeta', { timeout: 15000 });
    await ev(() => document.querySelector('#gallery .thumb[data-name="e2e575_gallery.png"] .h3usemeta').click());
    await p.waitForFunction(() => /gallery prompt/.test(document.getElementById("prompt").value), null, { timeout: 8000 });
    const g = await ev(() => ({ seed: document.getElementById("seed").value, steps: document.getElementById("imgSteps").value, note: (document.getElementById("h3UseMetaNote") || {}).textContent || "" }));
    check("the gallery's ✎→: the picture's prompt, seed 9191, 12 steps; a note says what was set", g.seed === "9191" && g.steps === "12" && /seed 9191/.test(g.note), g);

    /* 4 the Civitai sync in the status bar */
    let n = 0;
    await p.route("**/api/modelmgr/fetch", (r) => { if (r.request().method() !== "GET") return r.continue(); n++; r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(n < 3 ? { running: true, done: n * 5, total: 20, current: "e2e.safetensors" } : { running: false, done: 20, total: 20, found: 15, nomatch: 4, failed: 1 }) }); });
    await ev(() => H3CivitaiSync.watch());
    await p.waitForTimeout(300);
    const s1 = await ev(() => (document.getElementById("sbCivitai") || {}).textContent || "");
    await p.waitForFunction(() => /synced/.test((document.getElementById("sbCivitai") || {}).textContent || ""), null, { timeout: 12000 });
    const s2 = await ev(() => ({ t: document.getElementById("sbCivitai").textContent, vis: document.getElementById("sbCivitai").style.display !== "none" }));
    check("status bar: \"🔄 Civitai 5/20\" while it syncs, then \"✓ Civitai synced: 15 found · 4 no match · 1 failed\"", /^🔄 Civitai \d+\/20$/.test(s1) && s2.vis && s2.t === "✓ Civitai synced: 15 found · 4 no match · 1 failed", { s1, s2 });
    await p.unroute("**/api/modelmgr/fetch");

    /* 5 a docker hidden inside a ▣ docker stays hidden and in there over a restart */
    await ev(() => SecFloat.show && SecFloat.show("modelmgr", false));
    const put = await ev(() => {
      const P = window.H3Panels; if (!P || !P.get("bd.sfxdock")) return { err: "no bd.sfxdock" };
      const d = P.newDocker({ id: "fd-e2e575", name: "E2E 575" });
      P.dockInto("bd.sfxdock", "fd-e2e575");
      return { in: P.get("bd.sfxdock").docker };
    });
    await p.waitForTimeout(500);
    await ev(() => { const el = document.getElementById("sfxdock"); if (!el.classList.contains("dockgone")) toggleDockGone("sfxdock", "tSfx"); });
    await p.waitForTimeout(1200);
    p.close(); p = await b.newPage({ viewport: { width: 1800, height: 1100 } }); hook(p);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Panels && window.H3Panels.get("bd.sfxdock"), null, { timeout: 60000 });
    await p.waitForTimeout(3500);
    const after = await p.evaluate(() => ({ docker: (window.H3Panels.get("bd.sfxdock") || {}).docker, hidden: document.getElementById("sfxdock").classList.contains("dockgone") }));
    check("restart: the SFX docker is still in its ▣ docker and still hidden (it came back shown before)", put.in === "fd-e2e575" && after.docker === "fd-e2e575" && after.hidden, { put, after });
    await p.evaluate(() => { const el = document.getElementById("sfxdock"); if (el.classList.contains("dockgone")) toggleDockGone("sfxdock", "tSfx"); window.H3Panels.home("bd.sfxdock"); window.H3Panels.remove("fd-e2e575"); });
    await p.waitForTimeout(1200);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    await b.close();
    try { await api("/api/config", { engine: { comfy: { dir: keepDir } } }); } catch (e) { /* fine */ }
    try { fs.rmSync(LIB, { recursive: true, force: true }); fs.rmSync(path.join(OUT, "e2e575_gallery.png"), { force: true }); fs.rmSync(T, { recursive: true, force: true }); } catch (e) { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
