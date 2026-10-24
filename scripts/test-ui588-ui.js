#!/usr/bin/env node
/* bitGen Studio — 2.588.0 in a REAL browser, against the running app (H3_URL) + a stub ComfyUI started here:
 *   the image editor's ⚡ LIVE mode - on, the ⚡ Live docker, a render through the real /api/aiedit (live=1: one render,
 *   its steps, not in the queue docker), a change renders again, ▣ on canvas, ✔ Apply as layer, off;
 *   ⬚ FOCUS mode - only the canvas, full window; Ctrl+P the colour palette (a chip = the foreground colour), Ctrl+B the
 *   brushes (a preset, the size), Esc closes a popup, Ctrl+Esc back to normal;
 *   🎓 ▸ 🧬 RefMods - ＋ New, the type, ＋ Media… sorted into images / videos / audio, a caption, ＠ into the prompt,
 *   🧬 Extract (a queue job through the stub) -> the mod kept in refmod/<name>/;
 *   Add-ons ▸ SolarRenderer and Graphs ▸ ☀ SolarRenderer.
 * Tim: "add live generation mode like krita has.add https://enderfga.cn/SolarRenderer/. in the lora docker add an option
 * for refmod ... when in the image edit tab add a button in the menubar, this will make the canvas full screen and
 * frameless ... ctrl+p will show a color pallet, ctrl+b will show brush types and size. ctrl+esc will go back to normal
 * mode". Settings put back, what it made removed. No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync, spawn, spawnSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.588.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const APP = process.env.H3_APP_DIR || path.join(__dirname, "..");
const CPORT = 8397;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = async (p, b) => (await fetch(URL_ + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) })).json();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-ui588-"));
const RM = "UI588 Bike";
const ff = (args) => spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args]).status === 0;
const PNG = path.join(tmp, "bike_front.png"), PNG2 = path.join(tmp, "bike_side.png"), TXT = path.join(tmp, "bike_front.txt"), MP4 = path.join(tmp, "bike_ride.mp4"), WAV = path.join(tmp, "bike_bell.wav");
const haveFf = ff(["-f", "lavfi", "-i", "color=c=red:s=64x64", "-frames:v", "1", PNG]) && ff(["-f", "lavfi", "-i", "color=c=blue:s=64x64", "-frames:v", "1", PNG2])
  && ff(["-f", "lavfi", "-i", "testsrc=size=160x120:rate=10", "-t", "2", "-pix_fmt", "yuv420p", MP4]) && ff(["-f", "lavfi", "-i", "sine=frequency=440:duration=1", WAV]);
fs.writeFileSync(TXT, "a red bike, front view");

(async () => {
  const cfg0 = await (await fetch(URL_ + "api/config")).json();
  const eng0 = JSON.parse(JSON.stringify(cfg0.engine || {}));
  const comfyDir = path.join(tmp, "ComfyUI");
  fs.mkdirSync(path.join(comfyDir, "models", "refmods"), { recursive: true });
  const stub = spawn("python3", [path.join(__dirname, "stub-comfy.py"), String(CPORT), path.join(tmp, "comfy-out")], { stdio: "ignore" });
  for (let i = 0; i < 40; i++) { try { if ((await fetch(`http://127.0.0.1:${CPORT}/system_stats`)).ok) break; } catch { /* not yet */ } await sleep(250); }
  await post("api/config", { engine: { backend: "comfy", comfy: Object.assign({}, eng0.comfy || {}, { url: `http://127.0.0.1:${CPORT}`, dir: comfyDir }) } });
  try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.live && window.H3RefMods, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 512; c.height = 384; const g = c.getContext("2d"); g.fillStyle = "#3060c0"; g.fillRect(0, 0, 512, 384); g.fillStyle = "#e03020"; g.fillRect(200, 150, 100, 80); window.imageEditorInstance.load(c.toDataURL("image/png"), "ui588"); setTimeout(ok, 800); }));
    await p.waitForFunction(() => { const E = window.imageEditorInstance.E; return E.S.engines && (E.S.engines.inpaint || []).length && document.querySelectorAll("#ieStyle option").length > 1; }, null, { timeout: 20000 });

    /* ---------------- ⚡ live */
    const bar = await ev(() => { const L = document.getElementById("kxLive"), F = document.getElementById("kxFocus"), full = document.getElementById("kxFull"), M = document.getElementById("pcMenus");
      const r = F && F.getBoundingClientRect();
      return { live: !!L && L.parentNode === full.parentNode, focus: !!F && M.nextElementSibling === F && /Artist mode/.test(F.textContent) && r.width > 40, order: L ? [...full.parentNode.children].indexOf(L) < [...full.parentNode.children].indexOf(full) : false }; });
    check("the menu bar: ⚡ (live) beside ⛶; 🎨 Artist mode (2.590.0) labelled, right after the menus", bar.live && bar.focus && bar.order, bar);
    const seen = [];
    await p.route("**/api/aiedit", async (r) => { const d = r.request().postData() || ""; seen.push({ live: /name="live"\r\n\r\n1/.test(d), steps: (/name="live_steps"\r\n\r\n(\d+)/.exec(d) || [])[1], id: (/name="live_id"\r\n\r\n([A-Za-z0-9]+)/.exec(d) || [])[1], mode: (/name="mode"\r\n\r\n(\w+)/.exec(d) || [])[1], whole: /name="whole"\r\n\r\n1/.test(d) }); r.continue(); });
    const on1 = await ev(() => {
      document.getElementById("iePrompt").value = "a red bike on a blue wall";
      document.getElementById("kxLive").click();
      const box = document.getElementById("pcLive"); const sel = document.getElementById("plStyle");
      const fl = [...sel.options].find((o) => /FLUX\.2 9B \(verified\)/.test(o.textContent)); if (fl) { sel.value = fl.value; sel.onchange({ target: sel }); }
      const st = document.getElementById("plSteps"); st.value = "4"; st.onchange({ target: st });
      return { shown: !box.classList.contains("off"), inKx: window.imageEditorInstance.E.kx.contains(box), btn: document.getElementById("kxLive").classList.contains("on"), opts: sel.options.length, picked: !!fl }; });
    check("⚡ on: the ⚡ Live docker inside the editor, the button lit, the styles listed", on1.shown && on1.inKx && on1.btn && on1.opts > 1 && on1.picked, on1);
    await p.waitForFunction(() => window.imageEditorInstance.E.live.state().renders >= 1, null, { timeout: 60000 });
    const r1 = await ev(async () => { const L = window.imageEditorInstance.E.live.state(); const j = await (await fetch("/api/jobs")).json();
      return { renders: L.renders, shown: !!document.querySelector("#plView canvas"), dot: document.getElementById("plDot").className, stat: document.getElementById("plStat").textContent, inList: j.some((x) => x.params && x.params.live), w: L.result && L.result.width }; });
    check("a live render through the real /api/aiedit: refine of the whole picture, live=1 with its steps and this tab's id; the result in the docker; not in the queue docker",
      r1.renders >= 1 && r1.shown && /ok/.test(r1.dot) && r1.w === 512 && !r1.inList && seen.length >= 1 && seen[0].live && seen[0].steps === "4" && seen[0].mode === "refine" && seen[0].whole && !!seen[0].id, { r1, seen });
    // a change -> rendered again
    await ev(() => { const E = window.imageEditorInstance.E; const L = E.makeLayer("dab"); const g = L.canvas.getContext("2d"); g.fillStyle = "#ffee00"; g.fillRect(20, 20, 60, 60); E.addLayer(L, "dab", false); E.refresh(); E.renderLayersPanel(); });
    await p.waitForFunction(() => window.imageEditorInstance.E.live.state().renders >= 2, null, { timeout: 60000 });
    check("a change on the canvas (a new layer) renders again by itself", seen.length >= 2, seen.length);
    const oc = await ev(() => { document.getElementById("plOn").click(); const E = window.imageEditorInstance.E; const a = !!(E.S.preview && E.S.preview.__live); document.getElementById("plOn").click(); return { a, b: !E.S.preview }; });
    check("▣ on canvas: the result over the picture (the preview), off again", oc.a && oc.b, oc);
    const ap = await ev(() => { const E = window.imageEditorInstance.E, n0 = E.S.layers.length; document.getElementById("plApply").click(); const top = E.S.layers[E.S.active]; return { n: E.S.layers.length - n0, name: top && top.name }; });
    check("✔ Apply as layer: a new layer \"⚡ Live: <prompt>\"", ap.n === 1 && /^⚡ Live: a red bike/.test(ap.name), ap);
    await ev(() => document.getElementById("plClose").click());
    check("✕ = live off (the docker hidden, the button dark)", await ev(() => document.getElementById("pcLive").classList.contains("off") && !document.getElementById("kxLive").classList.contains("on") && !window.imageEditorInstance.E.live.on()));
    await p.unroute("**/api/aiedit");

    /* ---------------- ⬚ focus */
    await ev(() => document.getElementById("kxFocus").click());
    await p.waitForTimeout(400);
    const fo = await ev(() => {
      const vis = (id) => { const e = document.getElementById(id); return !!e && !!(e.offsetWidth || e.offsetHeight) && getComputedStyle(e).display !== "none"; };
      const st = document.getElementById("ieStage").getBoundingClientRect();
      const at = document.elementFromPoint(innerWidth / 2, innerHeight - 6), top = document.elementFromPoint(innerWidth / 2, 6);
      return { cls: document.body.classList.contains("ie-focus"), menu: vis("pcMenu"), tools: vis("kxTools"), panels: vis("pcPanels"), bar: vis("kxBar"), stage: vis("ieStage"),
        w: Math.round(st.width), h: Math.round(st.height), W: innerWidth, H: innerHeight, bottomIn: !!at && !!at.closest("#ieStage"), topIn: !!top && !!top.closest("#ieStage") };
    });
    check("⬚ focus: only the canvas - no menus, tools, property bar or panels; the stage fills the window (bitGen's bars covered)",
      fo.cls && !fo.menu && !fo.tools && !fo.panels && !fo.bar && fo.stage && fo.w >= fo.W - 4 && fo.h >= fo.H - 4 && fo.bottomIn && fo.topIn, fo);
    await p.mouse.move(700, 450);
    await p.keyboard.press("Control+p");
    await p.waitForTimeout(200);
    const pal = await ev(() => { const el = document.getElementById("pcFocusPal"); const r = el && el.getBoundingClientRect(); return { open: !!el, chips: el ? el.querySelectorAll("[data-c]").length : 0, sv: !!(el && el.querySelector(".fsv")), x: r && r.x, y: r && r.y, w: r && r.width }; });
    check("Ctrl+P: the colour palette at the pointer (a saturation / brightness square, the hue strip, the palette's chips)", pal.open && pal.chips >= 8 && pal.sv && Math.abs(pal.x + pal.w / 2 - 700) < 30, pal);
    const chip = await ev(() => { const c = [...document.querySelectorAll("#pcFocusPal [data-c]")].find((x) => x.dataset.c.toLowerCase() !== window.imageEditorInstance.E.S.fg.toLowerCase()); const r = c.getBoundingClientRect(); return { c: c.dataset.c, x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await p.mouse.click(chip.x, chip.y);
    const sv = await p.locator("#pcFocusPal .fsv").boundingBox();
    await p.mouse.click(sv.x + sv.width - 3, sv.y + 3);
    const fg = await ev((c) => ({ fg: window.imageEditorInstance.E.S.fg, chip: c }), chip.c);
    check("a chip = the foreground colour; a click in the square picks a bright saturated colour", /^#[0-9a-f]{6}$/i.test(fg.fg) && fg.fg.toLowerCase() !== "#000000", fg);
    await p.keyboard.press("Control+p");
    check("Ctrl+P again closes it", await ev(() => !document.getElementById("pcFocusPal")));
    await p.keyboard.press("Control+b");
    await p.waitForTimeout(200);
    const br = await ev(() => { const el = document.getElementById("pcFocusBr"); return { open: !!el, n: el ? el.querySelectorAll("[data-p]").length : 0, size: !!(el && el.querySelector('[data-a="size"]')) }; });
    check("Ctrl+B: the brushes (every preset) + size / opacity / flow", br.open && br.n >= 20 && br.size, br);
    await p.click('#pcFocusBr [data-p="ink"]');
    await ev(() => { const s = document.querySelector('#pcFocusBr [data-a="size"]'); s.value = "77"; s.dispatchEvent(new Event("input", { bubbles: true })); });
    const bs = await ev(() => ({ preset: window.imageEditorInstance.E.S.preset, size: window.imageEditorInstance.E.S.size, tool: window.imageEditorInstance.E.S.tool, label: document.querySelector('#pcFocusBr [data-v="size"]').textContent }));
    check("a preset = paint with it; the size slider = the brush size", bs.preset === "ink" && Math.round(bs.size) === 77 && bs.tool === "paint" && bs.label === "77 px", bs);
    await p.keyboard.press("Escape");
    check("Esc closes the popup (focus mode stays)", await ev(() => !document.getElementById("pcFocusBr") && document.body.classList.contains("ie-focus")));
    await p.keyboard.press("Control+Escape");
    await p.waitForTimeout(300);
    const back = await ev(() => ({ cls: document.body.classList.contains("ie-focus"), menu: !!document.getElementById("pcMenu").offsetWidth, tools: !!document.getElementById("kxTools").offsetWidth, hidden: document.querySelectorAll(".pcfocus-hide,.pcfocus-chain").length }));
    check("Ctrl+Esc: back to normal - the menus and tools again, nothing left marked", !back.cls && back.menu && back.tools && back.hidden === 0, back);

    /* ---------------- 🧬 RefMods */
    await ev(async () => { H3LoraTrain.show(true); await H3LoraTrain.load(); });
    await p.waitForSelector("#rmModeBtn", { timeout: 10000 });
    await ev(() => { window.__ask0 = window.H3Panels && H3Panels.ask; window.H3Panels = window.H3Panels || {}; H3Panels.ask = () => Promise.resolve("UI588 Bike"); window.__conf0 = window.appConfirm; window.appConfirm = () => Promise.resolve(true); document.getElementById("rmModeBtn").click(); });
    await p.waitForTimeout(500);
    const md = await ev(() => ({ on: document.getElementById("ltBody").classList.contains("rm-on"), rm: !!document.getElementById("rmBody").offsetWidth, jobsHidden: !document.getElementById("ltJob").offsetWidth, types: document.querySelectorAll("#rmTypes [data-rmtype]").length }));
    check("🎓 docker ▸ 🧬 RefMods: its own side (the training jobs hidden), the seven types", md.on && md.rm && md.jobsHidden && md.types === 7, md);
    await ev(() => document.getElementById("rmNew").click());
    await p.waitForFunction((n) => document.getElementById("rmSel").value === n, RM, { timeout: 8000 });
    await p.click('#rmTypes [data-rmtype="vehicle"]');
    await p.waitForFunction(() => { const b = document.querySelector('#rmTypes [data-rmtype="vehicle"]'); return b && b.classList.contains("on"); }, null, { timeout: 5000 });
    if (haveFf) {
      await p.setInputFiles("#rmFile", [PNG, PNG2, TXT, MP4, WAV]);
      await p.waitForFunction(() => /sorted/.test(document.getElementById("rmMsg").textContent), null, { timeout: 15000 });
      const up = await ev(() => ({ msg: document.getElementById("rmMsg").textContent, i: document.querySelectorAll("#rmGimages .lim").length, v: document.querySelectorAll("#rmGvideos .lim video").length, a: document.querySelectorAll("#rmGaudio .lim audio").length,
        cap: (document.querySelector('#rmGimages .lim[data-file="bike_front.png"] textarea') || {}).value, folder: document.getElementById("rmFolder").textContent }));
      check("＋ Media…: 2 pictures -> images, the video -> videos, the sound -> audio; bike_front.txt = its caption; the folder refmod/<name>/ and its @tag",
        up.i === 2 && up.v === 1 && up.a === 1 && up.cap === "a red bike, front view" && /2 → images, 1 → videos, 1 → audio/.test(up.msg) && /refmod\/UI588 Bike\/ · @ui588_bike/.test(up.folder), up);
      const onDisk = ["images/bike_front.png", "images/bike_front.txt", "videos/bike_ride.mp4", "audio/bike_bell.wav", "meta.json"].every((f) => fs.existsSync(path.join(APP, "refmod", RM, f)));
      check("on disk: <app>/refmod/UI588 Bike/ images · videos · audio + meta.json (every project uses it)", onDisk && JSON.parse(fs.readFileSync(path.join(APP, "refmod", RM, "meta.json"), "utf8")).type === "vehicle");
      await p.fill('#rmGaudio .lim textarea', "a bicycle bell ringing twice");
      await ev(() => document.querySelector("#rmGaudio .lim textarea").dispatchEvent(new Event("change", { bubbles: true })));
      for (let i = 0; i < 40 && !fs.existsSync(path.join(APP, "refmod", RM, "audio", "bike_bell.txt")); i++) await sleep(150);
      check("a caption typed is kept (<file>.txt)", (() => { try { return fs.readFileSync(path.join(APP, "refmod", RM, "audio", "bike_bell.txt"), "utf8") === "a bicycle bell ringing twice"; } catch { return false; } })());
      await ev(() => { const pr = document.getElementById("prompt"); if (pr) { window.__p0 = pr.value; pr.value = "riding down the street"; } document.getElementById("rmUse").click(); });
      check("＠ Use in the prompt: @ui588_bike goes into the prompt box", await ev(() => { const pr = document.getElementById("prompt"); return !pr || /riding down the street @ui588_bike$/.test(pr.value); }));
      await ev(() => { const pr = document.getElementById("prompt"); if (pr && window.__p0 != null) pr.value = window.__p0; });
      // 🧬 Extract - the stub runs the graph; the "pack" saves the mod (made here, as the node would)
      const route = await p.route("**/api/refmodlib/*/adopt", async (r) => { fs.writeFileSync(path.join(comfyDir, "models", "refmods", "bitgen_vehicle_ui588_bike.safetensors"), Buffer.alloc(4096, 7)); r.continue(); });
      await ev(() => document.getElementById("rmExtract").click());
      try { await p.waitForFunction(() => /✓ refmod\/UI588 Bike\/bitgen_vehicle_ui588_bike\.safetensors/.test(document.getElementById("rmMsg").textContent), null, { timeout: 60000 }); }
      catch (e) { console.log("DEBUG", await ev(() => ({ msg: document.getElementById("rmMsg").textContent, stat: document.getElementById("rmStat").textContent, job: H3RefMods.state().job }))); throw e; }
      await p.waitForFunction(() => /^✓ /.test(document.getElementById("rmStat").textContent) && /✓$/.test(document.getElementById("rmSel").selectedOptions[0].textContent), null, { timeout: 10000 }).catch(() => {});
      const ex = await ev(() => ({ stat: document.getElementById("rmStat").textContent, opt: document.getElementById("rmSel").selectedOptions[0].textContent }));
      check("🧬 Extract: a queue job (the pack's Extract node) -> the mod copied into refmod/UI588 Bike/ - its state shown, ✓ in the list",
        fs.existsSync(path.join(APP, "refmod", RM, "bitgen_vehicle_ui588_bike.safetensors")) && /✓ bitgen_vehicle_ui588_bike\.safetensors \(4 KB\)/.test(ex.stat) && /✓$/.test(ex.opt), ex);
      const tg = await post("api/refmodlib/tags", { prompt: "@ui588_bike rides by" });
      check("a prompt with @ui588_bike: the mod is used, the @ taken out", tg.used && tg.used[0] && tg.used[0].mod === "bitgen_vehicle_ui588_bike" && tg.prompt === "ui588 bike rides by", tg);
    } else console.log("SKIP: no ffmpeg here - the RefMod media part did not run");
    await ev(() => document.querySelector('[data-ltmode="train"]').click());
    check("🎓 Training: back to the jobs", await ev(() => !document.getElementById("ltBody").classList.contains("rm-on") && !!document.getElementById("ltJob").offsetWidth));

    /* ---------------- SolarRenderer */
    await ev(() => window.H3Addons.open());
    await p.waitForSelector('#stab-addons [data-addon="solar"]', { timeout: 45000 });
    const sa = await ev(() => document.querySelector('#stab-addons [data-addon="solar"]').textContent);
    check("Add-ons ▸ SolarRenderer: what it is for, what it needs (MiniMax H3, the licence's territories), the LoRAs to tick", /SolarRenderer/.test(sa) && /structure video/i.test(sa) && /Community License/.test(sa) && /four-step/i.test(sa), sa.slice(0, 400));
    await ev(() => { document.querySelector('#settings .stabs [data-stab="comfy"]').click(); document.querySelector('[data-ctab="graphs"]').click(); });
    await p.waitForSelector("#gcSolar", { timeout: 10000 });
    await p.waitForFunction(() => /Add-ons ▸ SolarRenderer/.test(document.getElementById("gcSolarHint").textContent), null, { timeout: 8000 });
    check("Graphs ▸ ☀ SolarRenderer: not installed = where to get it (no workflows to import yet)", await ev(() => document.getElementById("gcSolarSel").hidden && document.getElementById("gcSolarGo").hidden));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    try { await ev(() => { if (window.__conf0) window.appConfirm = window.__conf0; }); } catch { /* closed */ }
    try { await fetch(URL_ + "api/refmodlib/" + encodeURIComponent(RM), { method: "DELETE" }); } catch { /* fine */ }
    try { await post("api/config", { engine: eng0 }); } catch { /* fine */ }
    await b.close();
    stub.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
