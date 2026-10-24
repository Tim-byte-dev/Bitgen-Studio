#!/usr/bin/env node
/* bitGen Studio — 2.581.0 in a REAL browser:
 *  1 🔄 Sync's videos + animated pictures: a LoRA whose model_info has thumb.mp4 + a video / GIF / still example - the card
 *    and the ⓘ page draw the video (a looping muted <video>), the GIF is marked, the viewer opens the video as a video;
 *  2 the selected LoRAs' keywords: ✨ Enhance with a LoRA picked in the Model manager - the LLM is told its keywords, and
 *    a keyword the LLM left out is in the answer anyway; the prompt chat is told too;
 *  3 ✨ Generate in the 📐 SolidCraft docker: the local LLM (a stub) writes broken code, gets the error back, fixes it;
 *    the part comes into SolidCraft (0.17.0's real web build) as editable features whose volume is CadQuery's; ✎ the code
 *    edited to a revolve + ▶ Run again = the STEP inserted as one solid.
 * Tim: "yes, please build your suggestion, when syncing models with civitai dl it's animated thumbs and videos for the
 * models too. make the llm add the selected loras keywords to the prompt". Against the running app (H3_URL); part 3 needs
 * CAD generate's CadQuery (Settings ▸ Add-ons) and SolidCraft - else it is a NOTE. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.581.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const window_last_step = (j) => (j && j.result && j.result.step) || "";

/* the stub LLM: CadQuery asks get a broken answer first, then the fix; enhance gets a prompt without the keywords */
const seen = [];
const GOOD = "import cadquery as cq\nresult = (cq.Workplane('XY').box(60, 40, 6, centered=(True, True, False))\n          .faces('>Z').workplane().rect(44, 24, forConstruction=True).vertices().hole(4.5)\n          .faces('>Z').workplane().circle(10).extrude(12))\n";
function stubLlm() {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      let b = ""; req.on("data", (d) => { b += d; }); req.on("end", () => {
        let j = {}; try { j = JSON.parse(b); } catch { j = {}; }
        const msgs = j.messages || [], sys = (msgs.find((m) => m.role === "system") || {}).content || String((msgs[0] || {}).content || "");
        const last = String((msgs[msgs.length - 1] || {}).content || "");
        seen.push({ sys, last });
        let text = "ok";
        if (/You write CadQuery/.test(sys)) text = /That code failed/.test(last) ? "Fixed:\n```python\n" + GOOD + "```" : "```python\nimport cadquery as cq\nresult = cq.Workplane('XY').bxo(60, 40, 6)\n```";
        else if (/rewrite rough video-generation prompts/.test(sys)) text = "A dancer spins slowly under neon lights, lineart.";
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: text } }] }));
      });
    });
    s.listen(0, "127.0.0.1", () => ok(s));
  });
}

(async () => {
  const cfg0 = await api("/api/config");
  const keepDir = ((cfg0.engine || {}).comfy || {}).dir || "", keepLlm = cfg0.llm || {};
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg581ui-"));
  const FX = require("./mmfixture518.js"), F = FX.make(T);
  // a LoRA whose library entry came from a sync with videos
  FX.safetensors(path.join(F.models, "loras", "e2e581_motion.safetensors"), null, ["lora_unet_x.lora_down.weight"]);
  const INFO = path.join(ROOT, "model_info", "loras", "e2e581_motion");
  fs.mkdirSync(INFO, { recursive: true });
  const st0 = fs.statSync(path.join(F.models, "loras", "e2e581_motion.safetensors")).size;
  for (const f of ["thumb.mp4", "ex1.mp4"]) fs.writeFileSync(path.join(INFO, f), Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypmp42"), Buffer.alloc(64)]));
  fs.writeFileSync(path.join(INFO, "ex2.gif"), Buffer.from("GIF89a\x01\x00\x01\x00\x00\x00\x00;", "latin1"));
  fs.writeFileSync(path.join(INFO, "ex3.png"), Buffer.from("89504e470d0a1a0a0000000d4948445200000002000000020802000000fdd49a730000001649444154789c63f8cfc0f09f818181e1ff7f0606000037f005fd8a5a6fb10000000049454e44ae426082", "hex"));
  fs.writeFileSync(path.join(INFO, "info.json"), JSON.stringify({ v: 1, media_v: 2, file: "e2e581_motion.safetensors", size: st0, cat: "loras", status: "found", match: "hash", fetched_at: Date.now(), thumb: "thumb.mp4",
    civitai: { id: 5810, modelId: 581, name: "v1", baseModel: "Wan Video 14B t2v", trainedWords: ["e2e581dance"], model: { name: "E2E Motion", type: "LORA" } },
    examples: [{ file: "ex1.mp4", media: "video", meta: { prompt: "a dancing robot" } }, { file: "ex2.gif", media: "animated", meta: {} }, { file: "ex3.png", media: "image", meta: {} }] }));
  const KEY = "loras|e2e581_motion.safetensors", LINE = "loras|anime_lineart.safetensors";
  const llm = await stubLlm();
  let weSC = false, weCG = false;
  await api("/api/config", { engine: { comfy: { dir: F.comfy } }, llm: { external_url: "http://127.0.0.1:" + llm.address().port + "/v1/chat/completions", external_model: "stub" } });
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 2000, height: 1250 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3ModelMgr && window.H3LoraSel, null, { timeout: 90000 });
    await p.waitForTimeout(2000);
    /* 1 videos + animated pictures */
    await api("/api/modelmgr/cards?refresh=1");
    await ev(() => { document.getElementById("mmBtn").click(); });
    await ev(() => { const t = document.querySelector('.mmgr [data-mmtab="loras"]'); if (t) t.click(); });
    await p.waitForFunction((k) => document.querySelector('.mmcard[data-key="' + k + '"]'), KEY, { timeout: 30000 });
    const card = await ev((k) => { const c = document.querySelector('.mmcard[data-key="' + k + '"] .th'); const v = c.querySelector("video.mmvid"); return { v: !!v, src: v && v.getAttribute("src"), muted: v && v.muted, loop: v && v.loop, auto: v && v.autoplay, bg: c.style.backgroundImage }; }, KEY);
    check("a card whose thumbnail is a video: a looping, muted, autoplaying <video> (no background picture)", card.v && /\/api\/modelmgr\/thumb\?key=/.test(card.src) && card.muted && card.loop && card.auto && !card.bg, card);
    const thumb = await fetch(URL_ + "api/modelmgr/thumb?key=" + encodeURIComponent(KEY));
    check("...the thumbnail is served as a video (video/mp4)", thumb.status === 200 && /video\/mp4/.test(thumb.headers.get("content-type") || ""), thumb.headers.get("content-type"));
    await ev((k) => window.H3ModelMgr.openInfo(k), KEY);
    await p.waitForFunction(() => document.querySelector(".mminfo .exg [data-mmex]"), null, { timeout: 20000 });
    const info = await ev(() => ({ hero: !!document.querySelector(".mminfo .hero video.mmvid"), ex: [...document.querySelectorAll(".mminfo .exg [data-mmex]")].map((d) => d.dataset.media + (d.querySelector("video") ? ":video" : "") + (d.querySelector(".mmanim") ? ":GIF" : "") + (d.style.backgroundImage ? ":bg" : "")),
      head: (([...document.querySelectorAll(".mminfo b")].find((x) => /Civitai's examples/.test(x.textContent)) || {}).textContent) || "" }));
    check("ⓘ page: the hero is the video; the examples: the video plays in its box, the GIF is marked GIF, the still is a picture",
      info.hero && info.ex.join() === "video:video,animated:GIF:bg,image:bg" && /Civitai's examples/.test(info.head), info);
    await ev(() => { const o = window.lbOpen; window.__lb = null; window.lbOpen = function (items, n) { window.__lb = { items: items, n: n }; }; window.__lbKeep = o; document.querySelector('.mminfo .exg [data-mmex="0"]').click(); });
    const lb = await ev(() => { const r = window.__lb; window.lbOpen = window.__lbKeep; return r; });
    check("...a click on the video example opens the viewer with it as a VIDEO", lb && lb.items[0].kind === "video" && lb.items[1].kind === "image", lb);
    await ev(() => window.H3ModelMgr.closeInfo());

    /* 2 the selected LoRAs' keywords */
    await ev((k) => { const s = window.H3ModelMgr.state(); if (!s.sel.loras.some((l) => l.key === k)) window.H3ModelMgr.pick(k); }, LINE);
    const paths = await ev(() => window.H3LoraSel.paths());
    check("H3LoraSel: the LoRA picked in the Model manager is a selected LoRA", paths.some((x) => /anime_lineart/.test(x)), paths);
    seen.length = 0;
    await ev(() => { document.getElementById("prompt").value = "a dancer at night"; return enhancePrompt(); });
    await p.waitForFunction(() => document.getElementById("enhancedText") && document.getElementById("enhancedText").value, null, { timeout: 30000 });
    const enh = await ev(() => document.getElementById("enhancedText").value);
    const eSys = (seen.find((x) => /rewrite rough video-generation prompts/.test(x.sys)) || {}).sys || "";
    check("✨ Enhance: the LLM is told the LoRA and its keywords (exactly as written)", /LoRAs IN USE/.test(eSys) && /- Anime Lineart[^:\n]*: lineart, monochrome/.test(eSys), eSys.slice(-400));
    check("...the keyword the LLM left out (monochrome) is in the enhanced prompt anyway, the one it wrote is not doubled", /monochrome/.test(enh) && (enh.match(/lineart/gi) || []).length === 1, enh);
    seen.length = 0;
    const ch = await api("/api/chat", { text: "write me a prompt for a dancer", context: { gen_mode: "image", loras: paths } });
    check("the prompt chat: the LLM is told the selected LoRAs' keywords too", !ch.error && seen.some((x) => /LoRAs IN USE/.test(x.sys) && /lineart, monochrome/.test(x.sys)), ch.error || seen.map((x) => x.sys.slice(-200)));
    await ev((k) => { const s = window.H3ModelMgr.state(); if (s.sel.loras.some((l) => l.key === k)) window.H3ModelMgr.pick(k); }, LINE);
    await ev(() => { try { window.SecFloat.show("modelmgr", false); } catch (e) { /* fine */ } });

    /* 3 ✨ Generate in SolidCraft - SolidCraft from its release zip when it is not installed (removed after, as
       test-ui578-ui does); CadQuery: CAD generate's venv, or CADGEN_VENV (a venv with cadquery) linked in for the test */
    let sc = await api("/api/solidcraft/status");
    if (!sc.installed) {
      const zip = [process.env.SC_ZIP, "/home/claude/sc017/solidcraft-web-0.17.0.zip"].find((z) => z && fs.existsSync(z));
      if (zip) {
        await fetch(URL_ + "api/solidcraft/install-zip", { method: "POST", headers: { "Content-Type": "application/zip" }, body: fs.readFileSync(zip) });
        for (let i = 0; i < 120; i++) { const j = await api("/api/addons/job"); if (!j.job || j.job.state !== "running") break; await sleep(500); }
        sc = await api("/api/solidcraft/status"); weSC = sc.installed;
        if (weSC) { await p.reload({ waitUntil: "domcontentloaded" }); await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3SolidCraftDock, null, { timeout: 90000 }); }
      }
    }
    let cg = await api("/api/cadgen/status");
    const CGD = path.join(ROOT, "cadgen");
    if (!cg.runner && process.env.CADGEN_VENV && fs.existsSync(process.env.CADGEN_VENV)) {
      fs.mkdirSync(CGD, { recursive: true });
      if (!fs.existsSync(path.join(CGD, ".venv"))) { fs.symlinkSync(process.env.CADGEN_VENV, path.join(CGD, ".venv")); weCG = true; }
      fs.writeFileSync(path.join(CGD, "runner.ok"), "e2e");
      cg = await api("/api/cadgen/status");
    }
    if (!cg.runner || !sc.installed) console.log("NOTE: " + (!cg.runner ? "CAD generate (CadQuery) is not installed" : "SolidCraft is not installed") + " here - ✨ Generate was not run");
    else {
      await ev(() => { const d = document.getElementById("solidcraftdock"); if (d.classList.contains("dockgone") && window.toggleDockGone) window.toggleDockGone("solidcraftdock"); if (d.classList.contains("collapsed") && window.toggleCollapse) window.toggleCollapse("solidcraftdock"); d.scrollIntoView(); });
      await p.waitForFunction(() => window.H3SolidCraft && window.H3SolidCraft.api() && window.H3SCGen && document.getElementById("scGen"), null, { timeout: 150000 });
      await p.waitForTimeout(2500);
      await ev(() => document.getElementById("scGen").click());
      await p.waitForFunction(() => document.getElementById("scGenBox").style.display === "flex" && document.getElementById("scgState").textContent && !document.getElementById("scgGo").disabled, null, { timeout: 15000 });
      const ui = await ev(() => ({ first: document.getElementById("scBar").firstElementChild.id, eng: [...document.querySelectorAll("#scgEngine option")].map((o) => o.value + (o.disabled ? "-" : "")), st: document.getElementById("scgState").textContent }));
      check("✨ Generate: first in the bar; the panel with the engines (cadrille greyed while not installed) and what is installed", ui.first === "scGen" && ui.eng.join() === "auto,cadrille-,llm" && /CadQuery/.test(ui.st), ui);
      seen.length = 0;
      await ev(() => { document.getElementById("scgPrompt").value = "a 60 x 40 x 6 mm mounting plate with four 4.5 mm holes and a 20 mm boss"; document.getElementById("scgEngine").value = "llm"; window.H3SCGen.generate(); });
      await p.waitForFunction(() => /editable features|one solid|did not|refused|✨ [^b].*error/i.test(document.getElementById("scgMsg").textContent) && !window.H3SCGen.state.busy, null, { timeout: 240000 });
      const g1 = await ev(() => ({ msg: document.getElementById("scgMsg").textContent, code: document.getElementById("scgCode").value, log: document.getElementById("scgLog").textContent, last: window.H3SCGen.state.last }));
      const expect = 60 * 40 * 6 - 4 * Math.PI * 2.25 * 2.25 * 6 + Math.PI * 100 * 12;
      check("the local LLM's broken code ran, failed (bxo), went back to it with the error, the fix ran", seen.filter((x) => /You write CadQuery/.test(x.sys)).length === 2 && /bxo/.test(seen[1].last + JSON.stringify(seen)) && /That code failed/.test(seen[1].last) && /circle\(10\)/.test(g1.code), { n: seen.length, log: g1.log.slice(-400) });
      const vol = await ev(() => window.H3SolidCraft.exec("inspect.measure", {}).then((m) => m.total.volume_mm3));
      const tl = await ev(() => window.H3SolidCraft.exec("timeline.inspect", { feature: "AI Extrude 1" }).then((r) => r.type || JSON.stringify(r).slice(0, 80), (e) => "ERR " + e.message));
      check("...the part is in SolidCraft as editable features (AI Extrude 1 in its timeline) with CadQuery's volume (" + Math.round(expect) + " mm³)",
        /editable features/.test(g1.msg) && Math.abs(vol - expect) / expect < 0.005 && !/^ERR/.test(tl), { msg: g1.msg, vol, tl });
      const prj = (await api("/api/projects")).current || "default";
      const nm = g1.last && g1.last.name;
      check("...its STEP + OBJ in the project's solidcraft folder, the code in solidcraft/ai/", nm && fs.existsSync(path.join(ROOT, "projects", prj, "solidcraft", nm + ".step")) && fs.existsSync(path.join(ROOT, "projects", prj, "solidcraft", nm + ".obj")) && fs.existsSync(path.join(ROOT, "projects", prj, "solidcraft", "ai", nm + ".py")), nm);
      // ✎ the code -> a revolve -> ▶ Run again: one solid
      await ev(() => { document.getElementById("scgCode").value = "import cadquery as cq\nresult = cq.Workplane('XZ').moveTo(10, 0).lineTo(20, 0).lineTo(20, 30).lineTo(10, 30).close().revolve(360, (0, 0, 0), (0, 1, 0))\n"; window.H3SCGen.runCode(); });
      await p.waitForFunction(() => /one solid|editable features|refused|error|into SolidCraft:/i.test(document.getElementById("scgMsg").textContent) && !window.H3SCGen.state.busy && window.H3SCGen.state.last && window.H3SCGen.state.last.engine === "code", null, { timeout: 180000 })
        .catch(async (e) => { console.log("NOTE: scgMsg = " + await ev(() => document.getElementById("scgMsg").textContent + " | busy " + window.H3SCGen.state.busy + " | " + JSON.stringify((window.H3SCGen.state.last || {}).engine))); throw e; });
      const g2 = await ev(() => document.getElementById("scgMsg").textContent);
      const vol2 = await ev(() => window.H3SolidCraft.exec("inspect.measure", {}).then((m) => m.total.volume_mm3));
      const ring = Math.PI * (20 * 20 - 10 * 10) * 30;
      check("✎ edited to a revolve + ▶ Run again: SolidCraft gets the STEP as one solid (it says why), the right volume", /one solid/.test(g2) && /revolve/.test(g2) && Math.abs(vol2 - ring) / ring < 0.01, { g2, vol2, ring });
      // FOUND with this: SolidCraft lists its file storage only when it starts - a file the page writes later went
      // nowhere ("no such file in this browser", 📁 Designs ▸ open and 📂 Open from the computer too); now dropped on it
      const op = await ev(async (stepName) => {
        const blob = await (await fetch("/api/solidcraft/file/" + encodeURIComponent(stepName))).blob();
        await window.H3SolidCraft.openFile("e2e581_" + Date.now() + ".step", blob);
        const m = await window.H3SolidCraft.exec("inspect.measure", {});
        const d = await window.H3SolidCraft.exec("document.inspect", {});
        return { vol: m.total.volume_mm3, name: d.name, path: d.path };
      }, window_last_step(await ev(() => window.H3SCGen.state.last)));
      check("📂 a STEP the page has just written opens in SolidCraft (a new design - dropped on it when its storage does not know the file yet)", Math.abs(op.vol - ring) / ring < 0.01 && /e2e581_/.test(op.name + op.path), op);
      for (const n of [nm, nm && nm + "_2"].filter(Boolean)) for (const e of [".step", ".obj"]) fs.rmSync(path.join(ROOT, "projects", prj, "solidcraft", n + e), { force: true });
    }
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    await b.close();
    try { await api("/api/config", { engine: { comfy: { dir: keepDir } }, llm: { external_url: keepLlm.external_url || "", external_model: keepLlm.external_model || "" } }); } catch (e) { /* fine */ }
    llm.close();
    if (weCG) { try { fs.unlinkSync(path.join(ROOT, "cadgen", ".venv")); fs.rmSync(path.join(ROOT, "cadgen"), { recursive: true, force: true }); } catch (e) { /* fine */ } }
    if (weSC && !process.env.SC_KEEP) { try { await api("/api/addons/solidcraft/remove", {}); for (let i = 0; i < 40; i++) { const j = await api("/api/addons/job"); if (!j.job || j.job.state !== "running") break; await sleep(300); } } catch (e) { /* fine */ } }
    fs.rmSync(INFO, { recursive: true, force: true }); fs.rmSync(T, { recursive: true, force: true });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
