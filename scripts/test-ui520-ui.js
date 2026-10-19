#!/usr/bin/env node
/* bitGen Studio — 2.520.0 in a REAL browser: the 🎓 LORA TRAINER docker (a job, its dataset, a training run end to
 * end with a stand-in ai-toolkit, the LoRA landing in ComfyUI's loras/trained), PEAK / OFF-PEAK prices in Settings, the
 * 📊 USAGE docker, Settings -> REMOTE GPU (against a stand-in ComfyUI) and Settings -> Models -> 🖥 This computer & package.
 * Tim (verbatim): "please build a lora floating docker for creating lora's like ai toolkit by ostris. keep our theme. add
 * peak and time and prices for peak and offpeak ... keep a detailed list of usage the the user can review . and go with
 * all 3 of your reccomendations + add a remote gpu tab in settings"
 * Against the running app (H3_URL, default :8311) in THIS folder. The stand-in ai-toolkit (ai-toolkit/run.py + a
 * venvs/aitoolkit python) is made only when there is none and removed afterwards; every setting it touches is put back. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os"), http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.520 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body, method) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined && !method ? {} : { method: method || "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })).json();
// a 16x16 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGUlEQVR4nGM8oaHBQApgIkn1qIZRDUNKAwCMLQE4ZidSiAAAAABJRU5ErkJggg==", "base64");
const JOB = "e2e_ui520";

(async () => {
  const cfg0 = await api("/api/config");
  const rg0 = await api("/api/remotegpu");
  const keep = { comfyDir: ((cfg0.engine || {}).comfy || {}).dir || "", power: cfg0.power || {} };
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg520ui-"));
  const F = require("./mmfixture518.js").make(T);
  await api("/api/config", { engine: { comfy: { dir: F.comfy } } });

  /* the stand-in ai-toolkit: prints tqdm lines, writes checkpoints + a sample like the real one */
  const AT = path.join(ROOT, "ai-toolkit"), VV = path.join(ROOT, "venvs", "aitoolkit");
  const madeAt = !fs.existsSync(AT), madeV = !fs.existsSync(VV);
  if (madeAt) {
    fs.mkdirSync(AT, { recursive: true });
    fs.writeFileSync(path.join(AT, "run.py"), [
      "import sys, os, time, re, base64",
      "cfg = open(sys.argv[1]).read()",
      "name = re.search(r'name: \"([^\"]+)\"', cfg).group(1)",
      "tf = re.search(r'training_folder: \"([^\"]+)\"', cfg).group(1)",
      "steps = int(re.search(r'\\n\\s+steps: (\\d+)', cfg).group(1))",
      "out = os.path.join(tf, name); os.makedirs(os.path.join(out, 'samples'), exist_ok=True)",
      "for i in range(0, 101, 25):",
      "    sys.stdout.write(f'\\r{name}:  {i}%|##  | {i*steps//100}/{steps} [00:0{i//25}<00:10, 1.0it/s, lr: 1.0e-04 loss: 3.{i}e-01]'); sys.stdout.flush(); time.sleep(0.4)",
      "print()",
      "open(os.path.join(out, name + '_000000050.safetensors'), 'wb').write(b'x')",
      "open(os.path.join(out, name + '.safetensors'), 'wb').write(b'lora')",
      `open(os.path.join(out, 'samples', '1730000000__000000050_0.png'), 'wb').write(base64.b64decode('${PNG.toString("base64")}'))`,
      "print('done training')", ""].join("\n"));
    fs.writeFileSync(path.join(AT, ".bitgen-installed"), "{}");
  }
  if (madeV) {
    const py = execSync(process.platform === "win32" ? "where python" : "command -v python3", { encoding: "utf8" }).split(/\r?\n/)[0].trim();
    const bin = path.join(VV, process.platform === "win32" ? "Scripts" : "bin");
    fs.mkdirSync(bin, { recursive: true });
    fs.symlinkSync(py, path.join(bin, process.platform === "win32" ? "python.exe" : "python"));
    fs.writeFileSync(path.join(VV, "pyvenv.cfg"), "home = " + path.dirname(py) + "\n");
  }

  // a stand-in ComfyUI for the Remote GPU tab
  const srv = http.createServer((q, s) => { if (q.url === "/system_stats") { s.setHeader("Content-Type", "application/json"); s.end(JSON.stringify({ system: { comfyui_version: "0.3.60" }, devices: [{ name: "cuda:0 RTX 4090", type: "cuda", vram_total: 25757220864 }] })); } else { s.statusCode = 404; s.end(); } });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const RURL = "http://127.0.0.1:" + srv.address().port;

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1900, height: 1150 }, acceptDownloads: true });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3LoraTrain && window.H3RemoteGpu && window.H3HwPanel && document.getElementById("ltBtn") && document.getElementById("usBody"), null, { timeout: 60000 });
    await p.waitForTimeout(1200);

    /* ---- 🎓 the LoRA trainer */
    await p.click("#ltBtn");
    await p.waitForFunction(() => document.querySelectorAll("#ltPre option").length > 0 && /ai-toolkit/.test(document.getElementById("ltAitk").textContent), null, { timeout: 30000 }).catch(() => {});
    const d0 = await ev(() => { const el = document.getElementById("sf-loratrain"); return { shown: !!el && !el.classList.contains("sf-hidden"), title: el ? el.textContent.slice(0, 40) : "", tabs: [...document.querySelectorAll(".ltd [data-ltab]")].map((x) => x.textContent), aitk: document.getElementById("ltAitk").textContent }; });
    check("statusbar 🎓 LoRA opens the LoRA trainer docker: Job / Dataset / Run & samples; ai-toolkit ✓ (the stand-in)", d0.shown && /^Job\|Dataset( \(\d+\))?\|Run & samples$/.test(d0.tabs.join("|")) && /ai-toolkit ✓/.test(d0.aitk), d0);
    await ev((n) => { window.askText = () => n; }, JOB);
    await p.click("#ltNew"); await p.waitForTimeout(1200);
    const j1 = await ev(() => ({ sel: document.getElementById("ltJob").value, pre: [...document.querySelectorAll("#ltPre option")].map((o) => o.value), form: ["ltTrig", "ltRank", "ltSteps", "ltLr", "ltRes", "ltPrompts"].every((i) => !!document.getElementById(i)) }));
    check("＋ New job: made and picked; the form has the base models (Z-Image Turbo first), trigger, rank, steps, LR, sizes, sample prompts", j1.sel === JOB && j1.pre[0] === "zimage_turbo" && j1.pre.includes("sdxl") && j1.form, j1);
    await p.click('.ltd [data-ltab="job"]'); await p.waitForTimeout(400);
    await p.selectOption("#ltPre", "sdxl"); await p.waitForTimeout(900);
    await p.fill("#ltTrig", "u5x"); await p.fill("#ltSteps", "100"); await p.fill("#ltSampEvery", "50");
    await p.click("#ltSaveBtn"); await p.waitForTimeout(900);
    const st1 = await api("/api/loratrain");
    const jj = (st1.jobs || []).find((x) => x.name === JOB) || {};
    check("Save keeps the job (preset SDXL, trigger u5x, 100 steps)", jj.settings && jj.settings.preset === "sdxl" && jj.settings.trigger === "u5x" && jj.settings.steps === 100, jj.settings);
    await p.click('.ltd [data-ltab="dataset"]'); await p.waitForTimeout(400);
    fs.writeFileSync(path.join(T, "a1.png"), PNG); fs.writeFileSync(path.join(T, "a2.png"), PNG);
    await p.setInputFiles("#ltFile", [path.join(T, "a1.png"), path.join(T, "a2.png")]);
    await p.waitForFunction(() => document.querySelectorAll("#ltDsGrid .lim").length >= 2, null, { timeout: 15000 }).catch(() => {});
    const n2 = await ev(() => document.querySelectorAll("#ltDsGrid .lim").length);
    check("Dataset: ＋ Pictures… uploads two pictures into the grid", n2 === 2, n2);
    await p.fill("#ltDsGrid .lim:first-child textarea[data-cap]", "a man smiling");
    await p.dispatchEvent("#ltDsGrid .lim:first-child textarea[data-cap]", "change"); await p.waitForTimeout(800);
    const ds = await api("/api/loratrain/dataset/" + JOB);
    const caps = (ds.images || ds || []).map ? (ds.images || ds).map((x) => x.caption) : [];
    check("a caption typed under a picture is saved (its .txt)", caps.includes("a man smiling"), ds);
    await p.click('.ltd [data-ltab="run"]'); await p.waitForTimeout(500);
    const canStart = await ev(() => { const s = document.getElementById("ltStart"); return s && !s.disabled; });
    check("Run & samples: ▶ Start training is enabled (ai-toolkit ready + pictures)", canStart);
    await p.click("#ltStart");
    await p.waitForFunction(() => !!document.getElementById("ltOpenMm"), null, { timeout: 90000 }).catch(() => {});
    const run = await ev(() => { const h = document.getElementById("ltP_run"); return { text: h.textContent, samples: h.querySelectorAll(".lsamp img").length, link: !!document.getElementById("ltOpenMm") }; });
    check("▶ Start: the queue runs it (step N / M, loss), then '✓ the LoRA is in ComfyUI' + 🧩 the Model manager link", /the LoRA is in ComfyUI/.test(run.text) && /done/.test(run.text) && run.link, run.text.slice(0, 500));
    check("…and the samples ai-toolkit wrote are shown", run.samples >= 1, run.samples);
    const tdir = path.join(F.comfy, "models", "loras", "trained");
    const card = (() => { try { return JSON.parse(fs.readFileSync(path.join(tdir, JOB + ".bitgen.json"), "utf8")); } catch { return null; } })();
    check("the LoRA landed in ComfyUI's loras/trained with its card (trigger u5x as the keyword) + its preview", fs.existsSync(path.join(tdir, JOB + ".safetensors")) && card && card.user.keywords[0] === "u5x" && fs.existsSync(path.join(tdir, JOB + ".preview.png")), fs.existsSync(tdir) ? fs.readdirSync(tdir) : "no trained/");
    const ds2 = await api("/api/loratrain/dataset/" + JOB);
    const caps2 = (ds2.images || ds2).map((x) => x.caption);
    check("the trigger word was put in front of every caption before training", caps2.length === 2 && caps2.every((c) => /^u5x\b/.test(c)) && caps2.includes("u5x, a man smiling"), caps2);
    const yml = await api("/api/loratrain/yaml/" + JOB);
    check("YAML…: the config it trained with (sd_trainer, trigger_word u5x, the SDXL model)", /type: "sd_trainer"/.test(yml.yaml || "") && /trigger_word: "u5x"/.test(yml.yaml || "") && /stable-diffusion-xl/.test(yml.yaml || ""), (yml.yaml || yml.error || "").slice(0, 300));
    const ex = await fetch(URL_ + "api/loratrain/export/" + JOB);
    const zb = Buffer.from(await ex.arrayBuffer());
    check("⤓ Export job: a zip (config.yaml + the dataset)", ex.status === 200 && zb.readUInt32LE(0) === 0x04034b50 && zb.includes(Buffer.from("config.yaml")), ex.status);

    /* ---- the usage log saw it */
    const u = await api("/api/usage");
    const ul = (u.jobs || []).find((x) => x.mode === "lora_train" && /LoRA e2e_ui520/.test(x.what));
    check("the usage log has the training job (mode, what, its time)", !!ul && ul.secs >= 1, (u.jobs || []).slice(0, 3));

    /* ---- Settings -> General: peak / off-peak */
    await api("/api/config", { power: Object.assign({}, keep.power, { peak_price_kwh: 0, peak_windows: [] }) });   // start with no peak times
    await p.click("#openSettings"); await p.waitForTimeout(700);
    await p.fill("#s_kwh", "0.25"); await p.waitForTimeout(600);
    await p.click("#s_peakadd"); await p.waitForTimeout(500);
    const row = await ev(() => { const r = document.querySelector("#s_peakwin .pkwin"); return r ? { days: [...r.querySelectorAll("input[data-day]")].map((c) => c.checked ? 1 : 0).join(""), from: r.querySelector('[data-k="from"]').value, to: r.querySelector('[data-k="to"]').value } : null; });
    check("＋ Peak times adds a row: Mon-Fri ticked (Sat, Sun not), 07:00 to 22:00", row && row.days === "1111100" && row.from === "07:00" && row.to === "22:00", row);
    await p.fill("#s_peakwin .pkwin [data-k='from']", "16:00"); await p.dispatchEvent("#s_peakwin .pkwin [data-k='from']", "change");
    await p.fill("#s_peak", "0.55"); await p.waitForTimeout(1000);
    const c2 = await api("/api/config");
    const pw = (c2.power || {}).peak_windows || [];
    check("they save themselves: peak 0.55/kWh from 16:00 to 22:00 Mon-Fri, off-peak 0.25 the rest", (c2.power || {}).peak_price_kwh === 0.55 && pw.length === 1 && pw[0].from === "16:00" && pw[0].to === "22:00" && pw[0].days.join() === "1,2,3,4,5" && c2.power.price_kwh === 0.25, c2.power);
    const msg = await ev(() => document.getElementById("s_kwhmsg").textContent);
    check("the note under it says so", /peak \$0\.55\/kWh in 1 time window\(s\), the rest off-peak/.test(msg), msg);
    const badge = await ev(() => { const el = H3Power.badge({ wh: 125, gpu_wh: 125, cpu_wh: 0, gpu_measured: true, avg_w: 300, secs: 1500, wh_peak: 100 }); return el ? el.title : ""; });
    check("a job's ⚡ card splits peak and off-peak", /peak/i.test(badge) && /off-peak/i.test(badge), badge);

    /* ---- 📊 Usage… */
    await p.click("#s_usage"); await p.waitForTimeout(1200);
    const us = await ev(() => { const el = document.getElementById("sf-usage"); return { shown: !!el && !el.classList.contains("sf-hidden"), cards: document.querySelectorAll("#usTot .ucard").length, settings: document.getElementById("settings").open, csv: document.getElementById("usCsv").getAttribute("href") || "" }; });
    check("📊 Usage… closes Settings and opens the usage docker: 5 totals cards, a CSV link", us.shown && !us.settings && us.cards === 5 && /\/api\/usage\/csv/.test(us.csv), us);
    await p.click('.usd [data-utab="jobs"]'); await p.waitForTimeout(500);
    const jt = await ev(() => document.querySelector(".usd table") ? document.querySelector(".usd table").textContent : "");
    check("Jobs: the training job is in the list", /LoRA e2e_ui520/.test(jt), jt.slice(0, 300));
    const csv = await (await fetch(URL_ + "api/usage/csv?kind=jobs")).text();
    check("CSV: a header + the job", /^finished,day,id,project,mode/.test(csv) && /lora_train/.test(csv), csv.slice(0, 200));

    /* ---- Settings -> Remote GPU */
    await p.click("#openSettings"); await p.waitForTimeout(600);
    await p.click('#settings .stabs [data-stab="rgpu"]'); await p.waitForTimeout(600);
    const rg = await ev(() => ({ modes: [...document.querySelectorAll('#stab-rgpu input[name="rgmode"]')].map((r) => r.value), now: (document.getElementById("rgNow") || {}).textContent || "" }));
    check("Settings -> Remote GPU: This computer / another machine's URL / RunPod / SSH tunnel", rg.modes.join() === "local,url,runpod,ssh", rg);
    await p.check('#stab-rgpu input[name="rgmode"][value="url"]'); await p.waitForTimeout(300);
    await p.fill("#rgUrl", RURL); await p.fill("#rgCost", "0.4");
    await p.click("#rgTest"); await p.waitForTimeout(1500);
    const tm = await ev(() => document.getElementById("rgMsg").textContent);
    check("✓ Test asks its ComfyUI: the card + version", /RTX 4090/.test(tm) && /0\.3\.60/.test(tm), tm);
    await p.click("#rgUse"); await p.waitForTimeout(1200);
    const c3 = await api("/api/config");
    check("Use it: the app's ComfyUI is that machine's (and it does not start its own)", c3.engine.comfy.url === RURL && c3.engine.comfy.autostart === false, c3.engine.comfy);
    await p.check('#stab-rgpu input[name="rgmode"][value="local"]'); await p.waitForTimeout(300);
    await p.click("#rgUse"); await p.waitForTimeout(1200);
    const c4 = await api("/api/config");
    check("Use this computer: back to this computer's ComfyUI URL", c4.engine.comfy.url === ((cfg0.engine || {}).comfy || {}).url && (c4.rgpu || {}).mode !== "url", c4.engine.comfy);

    /* ---- Settings -> Models: 🖥 This computer & package */
    await p.click('#settings .stabs [data-stab="models"]');
    await p.waitForFunction(() => document.querySelectorAll('#hwPanel input[name="hwpkg"]').length === 4, null, { timeout: 15000 }).catch(() => {});
    const hw = await ev(() => ({ text: document.getElementById("hwPanel").textContent, n: document.querySelectorAll('#hwPanel input[name="hwpkg"]').length, rows: document.querySelectorAll("#hwRows .hwrow").length, up: !!document.getElementById("hwUp") }));
    check("Settings -> Models: 🖥 This computer & package - the card, what is installed, the four packages, what each lets you use, ⬆ Upgrade", hw.n === 4 && hw.rows > 5 && hw.up && /installed:/.test(hw.text) && /for this computer:/.test(hw.text), hw.text.slice(0, 300));
    await p.check('#hwPanel input[name="hwpkg"][value="editor"]'); await p.waitForTimeout(300);
    const ed = await ev(() => ({ dis: document.getElementById("hwUp").disabled, rows: document.getElementById("hwRows").textContent }));
    check("picking Editor: no upgrade to it (it is the smallest)", ed.dis === true, ed);
    await p.click("#hwEdit"); await p.waitForTimeout(400);
    const ask = await ev(() => ({ shown: document.getElementById("hwAsk").style.display !== "none", gpus: document.querySelectorAll("#hwGpu option").length }));
    check("✎ Not right? opens the card / RAM / CPU form with the card list", ask.shown && ask.gpus > 10, ask);

    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the run did not throw", false, String(e && e.stack || e).slice(0, 600));
  } finally {
    await b.close().catch(() => {});
    srv.close();
    await api("/api/loratrain/job/" + JOB, undefined, "DELETE").catch(() => {});
    await api("/api/config", { engine: { comfy: { dir: keep.comfyDir } }, power: Object.assign({ price_kwh: 0, supply_day: 0, peak_price_kwh: 0, peak_windows: [] }, keep.power) }).catch(() => {});
    await api("/api/remotegpu/save", { url: rg0.url || "", cost_hr: rg0.cost_hr || 0 }).catch(() => {});
    if (rg0.mode && rg0.mode !== "local") await api("/api/remotegpu/use", { mode: rg0.mode }).catch(() => {});
    if (madeAt) fs.rmSync(AT, { recursive: true, force: true });
    if (madeV) fs.rmSync(VV, { recursive: true, force: true });
    fs.rmSync(T, { recursive: true, force: true });
  }
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
