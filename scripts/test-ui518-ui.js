#!/usr/bin/env node
/* bitGen Studio — 2.518.0 in a REAL browser: ⏱ QUEUE PRESETS on the menu bar, 🧩 THE MODEL + LoRA MANAGER docker
 * (cards, the description card on hover, select a model + LoRAs, Override the style, ✚ New style, ✎ edit, the Civitai
 * tab), Settings -> General (Civitai key, Energy cost, 🧪 Testing) and the 🧪 Testing docker's 💾 Save log.
 * Tim (verbatim): "add a dropdown on the main menubar for queue presets. create a model and lora manager floating docker
 * with checkbox to overide styles setting and a button to create new style from the model i select ... add Energy cost
 * to the settings dialog ... add a button general tab in settings to do testing. create a floating docker with tests
 * requires and add a check mark to them as they are completed. then let me save the file and give it to you."
 * Against the running app (H3_URL, default :8311). It points ComfyUI's folder at a fake one (scripts/mmfixture518.js)
 * for the run and puts every setting it touched back at the end. */
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.518 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const cfg0 = await api("/api/config");
  // 2.534.0: the test list ticks itself only in 🧪 Test mode - on for this run, put back after
  const mode0 = !!(await api("/api/testplan")).mode;
  await api("/api/testplan/mode", { on: true });
  const keep = { comfyDir: ((cfg0.engine || {}).comfy || {}).dir || "", civitai: cfg0.civitai || {}, power: cfg0.power || {}, queue: cfg0.queue || {} };
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg518ui-"));
  const F = require("./mmfixture518.js").make(T);
  await api("/api/config", { engine: { comfy: { dir: F.comfy } } });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1900, height: 1150 }, acceptDownloads: true });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let madeStyle = null;
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3ModelMgr && window.H3QueuePresets && window.H3TestDock && document.querySelectorAll("#quSel option").length >= 6 && document.getElementById("mmBtn"), null, { timeout: 60000 });
    await p.waitForTimeout(1500);

    /* ⏱ queue presets */
    const qp = await ev(() => ({ opts: [...document.querySelectorAll("#quSel option")].map((o) => o.textContent), inBar: !!document.querySelector("#menubar #quWrap"), val: document.getElementById("quSel").value }));
    check("menu bar: ⏱ queue preset dropdown - Normal, Quiet (overnight), Eco, Cool-down between jobs, Max performance, Custom", qp.inBar && qp.opts.join("|") === "Normal|Quiet (overnight)|Eco|Cool-down between jobs|Max performance|Custom", qp);
    await p.selectOption("#quSel", "quiet");
    await p.waitForTimeout(1200);
    const st1 = await api("/api/queuepresets");
    await p.click("#quInfo"); await p.waitForTimeout(300);
    const pan = await ev(() => ({ on: document.getElementById("quPanel").classList.contains("on"), text: document.getElementById("quPanel").textContent }));
    check("picking Quiet saves it (custom.settings) and ⓘ says what it does + whether the power limit was set (or why not)",
      st1.preset.id === "quiet" && pan.on && /70 % of each card's default/.test(pan.text) && /20 s/.test(pan.text) && /80 °C until 70 °C/.test(pan.text) && /(✓ power limit set|✗ )/.test(pan.text), { preset: st1.preset.id, pan });
    await p.selectOption("#quSel", "custom"); await p.waitForTimeout(800);
    const hasCustom = await ev(() => !!document.getElementById("quPct") && !!document.getElementById("quApply"));
    await p.fill("#quCool", "7"); await p.click("#quApply"); await p.waitForTimeout(800);
    const st2 = await api("/api/queuepresets");
    check("Custom: its four numbers in ⓘ - Apply keeps them (a 7 s rest)", hasCustom && st2.preset.id === "custom" && st2.preset.cooldown_s === 7, st2.preset);
    await p.selectOption("#quSel", "normal"); await p.waitForTimeout(800);
    await p.mouse.click(900, 600);

    /* 🧩 the model manager */
    await p.click("#mmBtn");
    await p.waitForFunction(() => document.querySelectorAll("#mmGrid .mmcard").length >= 5, null, { timeout: 20000 });
    const g1 = await ev(() => {
      const el = document.getElementById("sf-modelmgr");
      const cards = [...document.querySelectorAll("#mmGrid .mmcard")].map((c) => ({ key: c.dataset.key, text: c.textContent, th: !!(c.querySelector(".th").style.backgroundImage) }));
      return { shown: el && !el.classList.contains("sf-hidden"), floating: el.classList.contains("df-float"), cards };
    });
    const pony = g1.cards.find((c) => /ponyDiffusion/.test(c.key)), jug = g1.cards.find((c) => /juggernaut/.test(c.key)), wanC = g1.cards.find((c) => /wan2/.test(c.key));
    check("🧩 Models opens the floating docker: a card per model (5) with the type + category (Pony · image, Wan · video), a thumbnail where there is a preview",
      g1.shown && g1.cards.length === 5 && pony && /Pony/.test(pony.text) && /image/.test(pony.text) && wanC && /Wan/.test(wanC.text) && /video/.test(wanC.text) && jug.th && !pony.th, g1);
    // hover: the description card beside it; leaving closes it
    const ponySel = `#mmGrid .mmcard[data-key="${pony.key}"]`;
    await p.hover(ponySel); await p.waitForTimeout(250);
    const hv = await ev((sel) => { const h = document.getElementById("mmHover"), c = document.querySelector(sel).getBoundingClientRect(), r = h.getBoundingClientRect(); return { on: h.classList.contains("on"), text: h.textContent, beside: r.left >= c.right || r.right <= c.left || r.top >= c.bottom }; }, ponySel);
    await p.mouse.move(5, 1100); await p.waitForTimeout(500);       // 2.537: it waits 260 ms (the pointer may be going onto it)
    const hv2 = await ev(() => document.getElementById("mmHover").classList.contains("on"));
    check("hover: the description card shows beside the card (CFG, Steps, VAE, Text encoder, the file) and closes when the pointer leaves", hv.on && hv.beside && /CFG/.test(hv.text) && /Steps/.test(hv.text) && /VAE/.test(hv.text) && /Text encoder/.test(hv.text) && /ponyDiffusionV6XL\.safetensors/.test(hv.text) && !hv2, { hv, hv2 });
    // filter + type
    await p.selectOption("#mmCat", "video"); await p.waitForTimeout(200);
    const nVid = await ev(() => document.querySelectorAll("#mmGrid .mmcard").length);
    await p.selectOption("#mmCat", ""); await p.fill("#mmQ", "pony"); await p.waitForTimeout(200);
    const nQ = await ev(() => document.querySelectorAll("#mmGrid .mmcard").length);
    await p.fill("#mmQ", ""); await p.waitForTimeout(150);
    check("filters: category video = 1 card, search 'pony' = 1 card", nVid === 1 && nQ === 1, { nVid, nQ });
    // select the model, then LoRAs
    await p.click(ponySel); await p.waitForTimeout(150);
    await p.click('.mmgr [data-mmtab="loras"]'); await p.waitForTimeout(300);
    const lo = await ev(() => [...document.querySelectorAll("#mmGrid .mmcard")].map((c) => ({ key: c.dataset.key, text: c.textContent, kw: [...c.querySelectorAll(".kwc")].map((k) => k.textContent) })));
    const lin = lo.find((c) => /anime_lineart/.test(c.key));
    check("LoRAs tab: 2 cards; a Civitai-known one says Illustrious, ★ 4.5, 2026-03-14 and its keywords", lo.length === 2 && lin && /Illustrious/.test(lin.text) && /4\.5/.test(lin.text) && /★★★★★/.test(lin.text) && /2026-03-14/.test(lin.text) && lin.kw.join(",") === "lineart,monochrome", lo);
    await ev(() => { const t = document.getElementById("prompt"); if (t) t.value = "a fox"; });
    await p.click(`#mmGrid .mmcard[data-key="${lin.key}"] .kwc`); await p.waitForTimeout(150);
    const pr = await ev(() => (document.getElementById("prompt") || {}).value);
    check("a keyword chip clicked goes into the prompt", pr === "a fox, lineart", pr);
    await p.click(`#mmGrid .mmcard[data-key="${lin.key}"] .th`); await p.waitForTimeout(150);
    const sel = await ev(() => ({ text: document.getElementById("mmSel").textContent, chips: document.querySelectorAll("#mmSel .mmchip[data-i]").length, selCard: !!document.querySelector("#mmGrid .mmcard.sel") }));
    check("selection: the model + the LoRA (with its weight) in the strip; the LoRA card lit", /ponyDiffusionV6XL/.test(sel.text) && /Anime Lineart/.test(sel.text) && sel.chips === 1 && sel.selCard, sel);
    // ☐ Override the style
    const before = await ev(() => ({ ovr: (document.getElementById("ovrStyle") || {}).checked, ck: (document.getElementById("imgCkpt") || {}).value, loras: typeof tempLoras === "function" ? tempLoras("image") : null }));
    await p.check("#mmOverride"); await p.waitForTimeout(700);
    const on = await ev(() => ({ ovr: document.getElementById("ovrStyle").checked, ck: document.getElementById("imgCkpt").value, loras: tempLoras("image"), mm: H3ModelMgr.overriding() }));
    check("☑ Override the style: Basic Settings' Override style on, the checkpoint override = the model, the LoRA a temporary LoRA (0.00-weight slider kept at 1)",
      on.ovr && on.ck === "ponyDiffusionV6XL.safetensors" && on.loras.some((l) => l.path === "anime_lineart.safetensors" && l.weight === 1) && on.mm, { before, on });
    const body = await ev(() => imgBasicsBody({}));
    check("…and an image render sends them (model, extra_loras, mm_override)", body.model === "ponyDiffusionV6XL.safetensors" && (body.extra_loras || []).some((l) => l.path === "anime_lineart.safetensors") && body.mm_override === true, body);
    await p.uncheck("#mmOverride"); await p.waitForTimeout(700);
    const off = await ev(() => ({ ovr: document.getElementById("ovrStyle").checked, ck: document.getElementById("imgCkpt").value, loras: tempLoras("image"), mm: H3ModelMgr.overriding() }));
    check("☐ unticked: everything put back (Override style, the checkpoint override, the temporary LoRAs as they were)",
      off.ovr === before.ovr && off.ck === (before.ck || "") && !off.loras.some((l) => l.path === "anime_lineart.safetensors") && !off.mm, { before, off });
    // ✚ New style
    await p.click('.mmgr [data-mmtab="models"]'); await p.waitForTimeout(200);
    await p.click("#mmNewStyle"); await p.waitForTimeout(200);
    const nm = "E2E 518 Pony " + Date.now().toString(36);
    await p.fill("#mmfName", nm);
    const tplOpts = await ev(() => [...document.querySelectorAll("#mmfTpl option")].map((o) => o.textContent));
    await p.click("#mmfGo"); await p.waitForTimeout(1500);
    const msg = await ev(() => document.getElementById("mmMsg").textContent);
    const sts = await api("/api/styles?kind=image");
    madeStyle = (sts.styles || []).find((s) => s.name === nm) || null;
    check("✚ New style from it: the form (name, which style to copy - automatic or any image style), the style made from Pony with this model + the LoRA",
      tplOpts.length > 3 && /^automatic \(Pony\)$/.test(tplOpts[0]) && madeStyle && madeStyle.model === "ponyDiffusionV6XL.safetensors" && madeStyle.loras.some((l) => l.path === "anime_lineart.safetensors" && Math.abs(l.weight - 1) < 1e-9)
      && madeStyle.workflow === "comfy_workflows/img_sdxl_t2i.json" && /made from "Pony"/.test(msg), { msg, madeStyle, tplOpts: tplOpts.slice(0, 3) });
    const inDrop = await ev((n) => [...document.querySelectorAll("#styleSel option")].some((o) => o.textContent.includes(n)), nm);
    check("…and the prompt docker's Style dropdown has it", inDrop);
    // ✎ edit a card
    await p.hover(ponySel);
    await p.click(`${ponySel} [data-mmedit]`); await p.waitForTimeout(200);
    await p.fill("#mmeCfg", "6.5"); await p.fill("#mmeSteps", "26"); await p.fill("#mmeKw", "score_9, score_8_up");
    await p.click("#mmeSave"); await p.waitForTimeout(1500);
    const cards2 = await api("/api/modelmgr/cards");
    const pc = cards2.models.find((c) => /ponyDiffusion/.test(c.key));
    check("✎ edit: cfg 6.5 / steps 26 / keywords saved beside the model (<stem>.bitgen.json) and read back", pc.cfg === 6.5 && pc.steps === 26 && pc.keywords.join("|") === "score_9|score_8_up" && fs.existsSync(path.join(F.models, "checkpoints", "ponyDiffusionV6XL.bitgen.json")), pc);
    // Civitai tab - no network needed: it must say what happened, not break
    await p.click('.mmgr [data-mmtab="civitai"]'); await p.waitForTimeout(200);
    await p.fill("#mmCvQ", "lineart"); await p.click("#mmCvGo");
    await p.waitForFunction(() => !/asking Civitai/.test(document.getElementById("mmGrid").textContent), null, { timeout: 70000 });
    const cv = await ev(() => ({ bar: getComputedStyle(document.getElementById("mmCvBar")).display !== "none", grid: document.getElementById("mmGrid").textContent.slice(0, 300), n: document.querySelectorAll("#mmGrid .mmcard").length }));
    check("Civitai tab: search box, type, sort, base model; a search answers with cards or says why (offline / key) - never breaks", cv.bar && (cv.n > 0 || /Civitai|reach|key|HTTP|nothing/i.test(cv.grid)), cv);

    /* Settings -> General */
    await p.click("#openSettings"); await p.waitForTimeout(600);
    const gen = await ev(() => ({ cv: !!document.getElementById("s_cvtok"), site: [...document.querySelectorAll("#s_cvsite option")].map((o) => o.value), kwh: !!document.getElementById("s_kwh"), test: !!document.getElementById("s_testing") }));
    check("Settings -> General: Civitai (key, civitai.red / civitai.com, mature), Energy cost (price + currency), 🧪 Testing…", gen.cv && gen.site.join(",") === "civitai.red,civitai.com" && gen.kwh && gen.test, gen);
    await p.fill("#s_cvtok", "e2e-test-key-518"); await p.waitForTimeout(900);
    await p.fill("#s_kwh", "0.35"); await p.selectOption("#s_kwhcur", "AUD"); await p.waitForTimeout(900);
    const cfg1 = await api("/api/config");
    check("they save themselves (custom.settings): the Civitai key, 0.35 AUD per kWh", (cfg1.civitai || {}).token === "e2e-test-key-518" && (cfg1.power || {}).price_kwh === 0.35 && (cfg1.power || {}).currency === "AUD", { civitai: cfg1.civitai, power: cfg1.power });
    const badge = await ev(() => { const el = H3Power.badge({ wh: 125, gpu_wh: 125, cpu_wh: 0, gpu_measured: true, avg_w: 300, secs: 1500 }); return el ? { t: el.textContent, title: el.title } : null; });
    check("a finished job's ⚡ card now says its cost: '⚡ 125 Wh · $0.04'", badge && badge.t === "⚡ 125 Wh · $0.04" && /Cost: \$0\.04 at \$0\.35 per kWh/.test(badge.title), badge);

    /* 🧪 Testing */
    await p.click("#s_testing"); await p.waitForTimeout(1500);
    const td = await ev(() => { const el = document.getElementById("sf-testdock"); return { shown: el && !el.classList.contains("sf-hidden"), settingsOpen: document.getElementById("settings").open, rows: document.querySelectorAll("#tdList .tdi").length, sum: document.getElementById("tdSum").textContent,
      newstyle: (document.querySelector('#tdList .tdi[data-id="mm_newstyle"]') || {}).className, edit: (document.querySelector('#tdList .tdi[data-id="mm_edit"]') || {}).className, ec: (document.querySelector('#tdList .tdi[data-id="ec_set"]') || {}).className }; });
    check("🧪 Testing… closes Settings and shows the Testing docker: every test, ✓ already on what this run did (✚ New style, ✎ card edit, the energy price)",
      td.shown && !td.settingsOpen && td.rows >= 30 && /pass/.test(td.newstyle || "") && /pass/.test(td.edit || "") && /pass/.test(td.ec || "") && /✓ · \d+ ✗ · \d+ to do/.test(td.sum), td);
    await p.click('#tdList .tdi[data-id="te_keys"] [data-st="pass"]'); await p.waitForTimeout(800);
    await p.fill('#tdList .tdi[data-id="cam3d"] .nt', "e2e note: not tried"); await p.press('#tdList .tdi[data-id="cam3d"] .nt', "Enter"); await p.waitForTimeout(900);
    const st3 = await api("/api/testplan");
    const r = (id) => st3.rows.find((x) => x.id === id);
    check("a manual ✓ ticks it; a note is kept", r("te_keys").state === "pass" && /^you: pass/.test(r("te_keys").how) && r("cam3d").note === "e2e note: not tried", [r("te_keys"), r("cam3d")]);
    const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 20000 }), p.click("#tdSave")]);
    const fp = await dl.path(); const txt = fs.readFileSync(fp, "utf8");
    check("💾 Save log downloads bitgen-test-log-<version>-<date>.txt: the computer, every item with ✓ / · and how, your note, the JSON",
      /^bitgen-test-log-2\.\d+\.\d+-\d{4}-\d\d-\d\d-\d\d-\d\d\.txt$/.test(dl.suggestedFilename()) && /^bitGen Studio — TEST LOG/.test(txt) && /✓ PASS  Ctrl\+Shift\+Alt\+E/.test(txt) && /note: e2e note: not tried/.test(txt)
      && /✓ PASS  ✚ New style/.test(txt) && /== JSON \(for Claude\)/.test(txt) && /Computer: /.test(txt), { name: dl.suggestedFilename(), head: txt.slice(0, 400) });
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 900));
  } finally {
    await api("/api/testplan/mode", { on: mode0 }).catch(() => {});
    try { if (madeStyle) await fetch(URL_ + "api/styles/" + madeStyle.id, { method: "DELETE" }); } catch { /* fine */ }
    try { await api("/api/testplan/mark", { id: "te_keys", state: "" }); await api("/api/testplan/mark", { id: "cam3d", state: "", note: "" }); } catch { /* fine */ }
    try { await api("/api/queuepresets", { id: keep.queue.preset || "normal" }); } catch { /* fine */ }
    try { await api("/api/config", { engine: { comfy: { dir: keep.comfyDir } }, civitai: Object.assign({ token: "", site: "civitai.red", mature: false }, keep.civitai), power: Object.assign({ price_kwh: 0, currency: "AUD" }, keep.power) }); } catch { /* fine */ }
    try { await p.evaluate(() => { try { localStorage.removeItem("h3mm.sel.v1"); } catch (e) { /* fine */ } }); } catch { /* closed */ }
    await b.close();
    try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
