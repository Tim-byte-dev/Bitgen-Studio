#!/usr/bin/env node
/* bitGen Studio — 2.537.0 in a REAL browser: THE 🧩 MODEL MANAGER WITH 400+ MODELS.
 *   pages (auto = as many as fit, a resize refits; 24 a page; ‹ › and numbers), folder tabs (checkpoints/SDXL -> "SDXL"),
 *   ⇲ Edit: a card corner sizes every card (the columns refill), the hover card stays when the pointer moves onto it and a
 *   click on it opens the INFO PAGE (the model_info library's thumb + example pictures + their prompts, Use this prompt,
 *   ✓ Use this model, ‹ Back), a card click selects, 📌 This project lists what its jobs used, ⤓ Civitai info is there.
 * Against the running app (H3_URL, default :8311): ComfyUI's folder points at a fake one (scripts/mmfixture518.js + 50
 * tiny files in folders); a model_info entry is written for one; the project's jobs.info gets one entry - all put back. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.537 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const cfg0 = await api("/api/config");
  const keepDir = ((cfg0.engine || {}).comfy || {}).dir || "";
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg537ui-"));
  const FX = require("./mmfixture518.js"), F = FX.make(T);
  const SDXL = (i) => "e2e537_sdxl_" + String(i).padStart(2, "0") + ".safetensors";
  for (let i = 0; i < 30; i++) FX.safetensors(path.join(F.models, "checkpoints", "SDXL", SDXL(i)), { "modelspec.architecture": "stable-diffusion-xl-v1-base" }, ["conditioner.embedders.1.x", "first_stage_model.decoder.conv_in.weight"]);
  for (let i = 0; i < 12; i++) FX.safetensors(path.join(F.models, "checkpoints", "Pony", "e2e537_pony_" + i + ".safetensors"), { "modelspec.architecture": "stable-diffusion-xl-v1-base" }, ["conditioner.embedders.1.x"]);
  for (let i = 0; i < 5; i++) FX.safetensors(path.join(F.models, "loras", "SDXL", "e2e537_lora_" + i + ".safetensors"), { ss_base_model_version: "sdxl_base_v1-0" }, ["lora_unet_input_blocks_1.alpha"]);
  // the shared model_info library: one entry for e2e537_sdxl_03 (as lib/modelInfo.fetchOne writes it)
  const size03 = fs.statSync(path.join(F.models, "checkpoints", "SDXL", SDXL(3))).size;
  const MID = path.join(ROOT, "model_info", "models", "e2e537_sdxl_03");
  fs.mkdirSync(MID, { recursive: true });
  fs.writeFileSync(path.join(MID, "thumb.png"), FX.PNG); fs.writeFileSync(path.join(MID, "ex1.png"), FX.PNG); fs.writeFileSync(path.join(MID, "ex2.png"), FX.PNG);
  fs.writeFileSync(path.join(MID, "info.json"), JSON.stringify({ v: 1, file: SDXL(3), size: size03, cat: "checkpoints", status: "found", match: "file", query: "e2e537 sdxl", fetched_at: Date.now(), thumb: "thumb.png",
    url: "https://civitai.com/models/5370?modelVersionId=5371",
    civitai: { id: 5371, modelId: 5370, name: "v3", baseModel: "SDXL 1.0", trainedWords: ["e2e537word"], publishedAt: "2026-05-06T00:00:00Z", stats: { thumbsUpCount: 8, thumbsDownCount: 2 }, images: [],
      model: { name: "E2E 537 Juggler", type: "Checkpoint", description: "<p>The e2e model's description.</p>", stats: {} } },
    examples: [{ file: "ex1.png", url: "u1", meta: { prompt: "e2e537 a lighthouse at dusk", negative: "blurry", cfg: 5, steps: 28, sampler: "DPM++ 2M", seed: 537 } }, { file: "ex2.png", url: "u2", meta: { prompt: "" } }] }, null, 2));
  // this project's jobs used e2e537_sdxl_07 + e2e537_lora_2
  const prj = (await api("/api/projects")).current || "default";
  const JI = path.join(ROOT, "projects", prj, "jobs.info");
  const ji0 = fs.existsSync(JI) ? fs.readFileSync(JI, "utf8") : null;
  const list0 = ji0 ? (() => { try { return JSON.parse(ji0); } catch { return []; } })() : [];
  fs.mkdirSync(path.dirname(JI), { recursive: true });
  fs.writeFileSync(JI, JSON.stringify(list0.concat([{ id: "e2e537job", state: "done", status: "done", mode: "image", meta: { models: ["SDXL/" + SDXL(7)], loras: ["e2e537_lora_2.safetensors"] } }]), null, 2));
  await api("/api/config", { engine: { comfy: { dir: F.comfy } } });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const st = () => ev(() => { const S = H3ModelMgr.state(); return { tab: S.tab, page: S.page, per: S.per, cardW: S.cardW, folder: S.folder, info: S.info, n: document.querySelectorAll("#mmGrid .mmcard").length,
    pager: (document.getElementById("mmPager") || {}).textContent || "", sel: S.sel.model }; });
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3ModelMgr && window.SecFloat && SecFloat.started && document.getElementById("mmBtn"), null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => { try { localStorage.removeItem("h3mm.sel.v1"); } catch (e) { /* fine */ } const S = H3ModelMgr.state(); S.tab = "models"; S.per = "auto"; S.cardW = 138; S.folder = ""; S.page = 0; S.sel = { model: null, loras: [] }; });
    await p.click("#mmBtn");
    await ev(() => SecFloat.float("modelmgr", 300, 80, 760, 640));
    await ev(() => H3ModelMgr.load(true));
    await p.waitForFunction(() => document.querySelectorAll("#mmGrid .mmcard").length >= 4, null, { timeout: 20000 });
    await p.waitForTimeout(600);
    const total = await ev(() => H3ModelMgr.state().data.models.length);

    /* ---- pages */
    const a = await st();
    check(`a page holds what FITS the docker (auto: ${a.n} of ${total}), the pager says which and how many`, a.per === "auto" && a.n < total && a.n >= 4 && new RegExp("1-" + a.n + " of " + total).test(a.pager), a);
    const fits = await ev(() => { const g = document.getElementById("mmGrid"), last = [...g.querySelectorAll(".mmcard")].pop(); return last.getBoundingClientRect().bottom <= g.getBoundingClientRect().bottom + 2; });
    check("…the page's last card is inside the docker (no scrolling to see a page)", fits);
    await ev(() => SecFloat.float("modelmgr", 200, 60, 1300, 900)); await p.waitForTimeout(700);
    const a2 = await st();
    check("a bigger docker: more cards a page (the ResizeObserver refits it)", a2.n > a.n, [a.n, a2.n]);
    await p.selectOption("#mmPer", "24"); await p.waitForTimeout(300);
    const a3 = await st();
    check("24 a page: 24 cards, pages = ceil(total / 24)", a3.n === 24 && a3.per === "24" && new RegExp("1-24 of " + total).test(a3.pager) && await ev((t) => document.querySelectorAll("#mmPager [data-mmpg]").length >= Math.min(7, Math.ceil(t / 24)), total), a3);
    const first1 = await ev(() => document.querySelector("#mmGrid .mmcard").dataset.key);
    await p.click("#mmPager button:last-of-type"); await p.waitForTimeout(250);
    const a4 = await st(), first2 = await ev(() => document.querySelector("#mmGrid .mmcard").dataset.key);
    check("› the next page: other cards, 25-…", a4.page === 1 && first2 !== first1 && new RegExp("25-" + Math.min(48, total) + " of " + total).test(a4.pager), [a4, first1, first2]);

    /* ---- folder tabs */
    const tabs = await ev(() => [...document.querySelectorAll("#mmFolders [data-mmfold]")].map((x) => x.textContent));
    check("folder tabs: All + the folders INSIDE checkpoints by their own names (Pony 12, SDXL 30) - not 'checkpoints/SDXL'", tabs[0].startsWith("All") && tabs.includes("Pony12") && tabs.includes("SDXL30") && !tabs.some((t) => /checkpoints/i.test(t)), tabs);
    await p.click('#mmFolders [data-mmfold="sdxl"]'); await p.waitForTimeout(250);
    const f1 = await ev(() => ({ keys: [...document.querySelectorAll("#mmGrid .mmcard")].map((c) => c.dataset.key), pager: document.getElementById("mmPager").textContent }));
    check("SDXL: only checkpoints/SDXL/… cards (30), page 1 again", f1.keys.length === 24 && f1.keys.every((k) => /^checkpoints\|SDXL\//.test(k)) && /1-24 of 30/.test(f1.pager), f1);
    await p.click('[data-mmtab="loras"]'); await p.waitForTimeout(250);
    const lt = await ev(() => [...document.querySelectorAll("#mmFolders [data-mmfold]")].map((x) => x.textContent));
    check("…the LoRAs tab has its own folder tabs (sdxl / SDXL as ONE tab, 6 = the fixture's 1 + these 5)", lt.some((t) => /^sdxl6$/i.test(t)) && !lt.some((t) => /Pony/.test(t)), lt);
    await p.click('[data-mmtab="models"]'); await p.waitForTimeout(250);

    /* ---- ⇲ edit mode: card size */
    await p.selectOption("#mmPer", "auto"); await p.waitForTimeout(300);
    await p.click("#mmEdit"); await p.waitForTimeout(200);
    const e0 = await ev(() => ({ edit: document.getElementById("mmGrid").classList.contains("edit"), grip: getComputedStyle(document.querySelector("#mmGrid .mmcard .grip")).display, slider: document.getElementById("mmSizeBox").style.display !== "none",
      cols: getComputedStyle(document.getElementById("mmGrid")).gridTemplateColumns.split(" ").length, w: document.querySelector("#mmGrid .mmcard").getBoundingClientRect().width }));
    check("⇲ Edit: every card shows a corner grip + a size slider", e0.edit && e0.grip === "block" && e0.slider, e0);
    const g = await ev(() => { const r = document.querySelector("#mmGrid .mmcard .grip").getBoundingClientRect(); return [r.left + 7, r.top + 7]; });
    await p.mouse.move(g[0], g[1]); await p.mouse.down(); await p.mouse.move(g[0] + 120, g[1] + 40, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(400);
    const e1 = await ev(() => ({ cardW: H3ModelMgr.state().cardW, cols: getComputedStyle(document.getElementById("mmGrid")).gridTemplateColumns.split(" ").length, w: document.querySelector("#mmGrid .mmcard").getBoundingClientRect().width,
      saved: JSON.parse(localStorage.getItem("h3mm.sel.v1") || "{}").cardW }));
    check("…dragging a corner 120 px: bigger cards, fewer columns (they refill the width), kept for next time", e1.cardW > 138 + 60 && e1.cols < e0.cols && e1.w > e0.w && e1.saved === e1.cardW, [e0, e1]);
    await ev(() => H3ModelMgr.setCardW(138)); await p.click("#mmEdit"); await p.waitForTimeout(200);

    /* ---- a card click selects; the hover card -> the info page */
    await p.click('#mmFolders [data-mmfold="sdxl"]'); await p.selectOption("#mmPer", "48"); await p.waitForTimeout(300);
    const k03 = "checkpoints|SDXL/" + SDXL(3);
    const card03 = `#mmGrid .mmcard[data-key="${k03}"]`;
    const badge = await ev((s) => ((document.querySelector(s) || {}).querySelector ? (document.querySelector(s).querySelector(".nfo") || {}).textContent : null), card03);
    check("the model_info library's entry shows on its card (ⓘ 2 examples) with its thumbnail; its Civitai title", /ⓘ 2/.test(badge || "") && await ev((s) => !!document.querySelector(s + " .th").style.backgroundImage && /E2E 537 Juggler/.test(document.querySelector(s).textContent), card03), badge);
    await p.click(card03 + " .nm"); await p.waitForTimeout(250);
    check("a card click selects it as THE model", (await st()).sel === k03);
    await p.hover(card03 + " .th"); await p.waitForTimeout(250);
    const hv = await ev(() => { const h = document.getElementById("mmHover"); const r = h.getBoundingClientRect(); return { on: h.classList.contains("on"), text: h.textContent, x: r.left + 20, y: r.top + 20 }; });
    check("hovering it: the description card says 'click for the full details + 2 example pictures'", hv.on && /click for the full details \+ 2 example pictures/.test(hv.text), hv);
    await p.mouse.move(hv.x, hv.y, { steps: 6 }); await p.waitForTimeout(450);
    check("…moving the pointer onto the description card keeps it open", await ev(() => document.getElementById("mmHover").classList.contains("on")));
    await p.mouse.click(hv.x, hv.y); await p.waitForTimeout(700);
    const inf = await ev(() => ({ info: H3ModelMgr.state().info, back: !!document.getElementById("mmBack"), text: (document.querySelector("#mmGrid .mminfo") || {}).textContent || "", ex: document.querySelectorAll("#mmGrid .exg [data-mmex]").length,
      hover: document.getElementById("mmHover").classList.contains("on"), pager: document.getElementById("mmPager").style.display }));
    check("…a click on it opens the INFO PAGE: the details, the trigger word, the description, 2 example pictures, the library folder", inf.info && inf.back && inf.ex === 2 && /SDXL 1\.0/.test(inf.text) && /e2e537word/.test(inf.text) && /The e2e model's description/.test(inf.text)
      && /model_info\/models\/e2e537_sdxl_03/.test(inf.text) && /matched by file name/.test(inf.text) && !inf.hover && inf.pager === "none", inf);
    check("…the example's prompt + settings under the pictures", /e2e537 a lighthouse at dusk/.test(inf.text) && /cfg 5 · 28 steps · DPM\+\+ 2M · seed 537/.test(inf.text), inf.text.slice(0, 600));
    await p.click("#mmIPrompt"); await p.waitForTimeout(200);
    check("Use this prompt -> the prompt box", await ev(() => document.getElementById("prompt").value === "e2e537 a lighthouse at dusk"));
    const exImg = await ev(async (k) => { const r = await fetch("/api/modelmgr/example?key=" + encodeURIComponent(k) + "&n=1"); return [r.status, r.headers.get("content-type")]; }, k03);
    check("the example pictures + the thumbnail come from model_info (GET /api/modelmgr/example, /thumb)", exImg[0] === 200 && /image\/png/.test(exImg[1]) && (await ev(async (k) => (await fetch("/api/modelmgr/thumb?key=" + encodeURIComponent(k))).status, k03)) === 200, exImg);
    check("…its ✓ button reads 'In use' (the card click selected it)", /In use/.test(await ev(() => document.getElementById("mmIUse").textContent)));
    await p.click("#mmBack"); await p.waitForTimeout(300);
    check("‹ Back: the cards again, the same folder and page", await ev(() => !H3ModelMgr.state().info && document.querySelectorAll("#mmGrid .mmcard").length > 0 && H3ModelMgr.state().folder === "sdxl"));
    // the ⓘ button and I key open it too
    await p.focus(card03); await p.keyboard.press("i"); await p.waitForTimeout(400);
    check("I on a focused card opens its info page; Esc goes back", await ev(() => !!H3ModelMgr.state().info));
    await p.keyboard.press("Escape"); await p.waitForTimeout(300);
    check("…Esc closed it", await ev(() => !H3ModelMgr.state().info));

    /* ---- 📌 This project */
    await p.click('[data-mmtab="used"]'); await p.waitForTimeout(900);
    const used = await ev(() => [...document.querySelectorAll("#mmGrid .mmcard")].map((c) => c.dataset.key));
    check("📌 This project: the model + the LoRA its jobs used (from jobs.info)", used.length === 2 && used.includes("checkpoints|SDXL/" + SDXL(7)) && used.includes("loras|SDXL/e2e537_lora_2.safetensors"), used);

    /* ---- ⤓ Civitai info */
    check("⤓ Civitai info is on the tab bar (Shift = fetch again); GET /api/modelmgr/fetch answers the queue", await ev(() => /Civitai info/.test(document.getElementById("mmFetch").textContent)) && typeof (await api("/api/modelmgr/fetch")).running === "boolean");
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("the run finished", false, String(e && e.stack || e)); }
  finally {
    try { await b.close(); } catch { /* fine */ }
    await api("/api/config", { engine: { comfy: { dir: keepDir } } }).catch(() => {});
    try { if (ji0 === null) fs.rmSync(JI, { force: true }); else fs.writeFileSync(JI, ji0); } catch { /* fine */ }
    fs.rmSync(MID, { recursive: true, force: true });
    fs.rmSync(T, { recursive: true, force: true });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
