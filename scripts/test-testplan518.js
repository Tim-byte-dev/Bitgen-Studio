#!/usr/bin/env node
/* bitGen Studio — 2.518.0 units: 🧪 THE TESTING DOCKER's checklist + THE LOG TO UPLOAD (lib/testPlan.js + .json,
 * static/testdock.js, routes/testPlan.js).
 * Tim (verbatim): "Add a log that i can upload so i don't have to write down the tests - add a button general tab in
 * settings to do testing. create a floating docker with tests requires and add a check mark to them as they are
 * completed. then let me save the file and give it to you." */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const TP = require("../lib/testPlan.js"), TD = require("../static/testdock.js");

const plan = TP.plan(), items = TP.flatten(plan);
const pkg = JSON.parse(read("package.json"));
check("the plan is this version's (testPlan.json version = package.json) and newest release first", plan.version === pkg.version && plan.groups[0].id === "g" + pkg.version.split(".")[1]   /* 2.519.0: the newest release's group first */, [plan.version, pkg.version]);
const ids = items.map((i) => i.id);
check("every item has a unique id, a title and is auto (a known kind) or manual", new Set(ids).size === ids.length && items.every((i) => i.title && (i.manual === true || (i.auto && ["job", "job_log", "job_energy", "gpu_power", "gpu_temp", "cpu_clock", "price", "cards", "civitai_key", "comfy", "event"].includes(i.auto.kind)))), ids);
check("it covers this release (queue presets, the model manager, Civitai, energy cost) and 2.514-2.517's hardware tests (Anima, Krea 2 x4, power)",
  ["qp_menu", "qp_rest", "mm_open", "mm_hover", "mm_override", "mm_newstyle", "cv_key", "cv_lora", "cv_ckpt", "ec_set", "ec_job", "pw_gpu", "an_aes", "an_base", "k2_turbo", "k2_raw", "k2_tgguf", "k2_rgguf", "te_keys", "cam3d"].every((x) => ids.includes(x)));
const it = (id) => items.find((i) => i.id === id);
const ctx = {
  jobs: [
    { id: "j1", status: "done", mode: "image", style: "Anima", log: ["[power] 5.8 Wh (GPU 5.0 Wh + CPU 0.8 Wh) - avg 350 W over 60 s - cost $0.00 at $0.35/kWh"], energy: { wh: 5.8 } },
    { id: "j2", status: "failed", mode: "image", style: "Krea 2 Turbo", log: ["Traceback", "ValueError: unet missing"] },
    { id: "j3", status: "done", mode: "image", style: "SDXL", override: true, log: ["[queue] waited 20 s - rest between jobs (Quiet (overnight))"] },
    { id: "j4", status: "done", mode: "t2va", style: "MiniMax H3 SS", log: [] },
  ],
  stats: { gpus: [{ index: 0, power_w: 300, clock_mhz: 2500, temp_c: 66 }], cpu_mhz: 4200 },
  price: { price_kwh: 0.35, currency: "AUD" }, cards: 7, civitai_ok: true, civitai_user: "tim", comfy: true,
  events: [{ event: "civitai_download", data: { cat: "loras", what: "a.safetensors" }, at: 1 }, { event: "style_from_model", data: { what: "My Pony" }, at: 2 }],
};
const ev = (id) => TP.evaluate(it(id), ctx);
check("auto: a finished job of that style ticks it (Anima yes; Anima base no; Krea 2 Turbo FAILED = not ticked)", ev("an_aes").state === "pass" && /job j1/.test(ev("an_aes").how) && ev("an_base").state === "" && ev("k2_turbo").state === "");
check("auto: log lines - the queue's rest ([queue] waited), the cost on the [power] line", ev("qp_rest").state === "pass" && /j3/.test(ev("qp_rest").how) && ev("ec_job").state === "pass");
check("auto: the override job, energy, nvidia-smi / temperature / CPU clock, the price, the cards, the key, ComfyUI",
  ev("mm_override").state === "pass" && ev("pw_job").state === "pass" && ev("pw_gpu").state === "pass" && ev("pw_temp").state === "pass" && ev("pw_cpu").state === "pass"
  && ev("ec_set").state === "pass" && ev("mm_open").state === "pass" && ev("cv_key").state === "pass" && /tim/.test(ev("cv_key").how) && ev("comfy").state === "pass" && ev("anyvid").state === "pass");
check("auto: events - a Civitai download into loras ticks the LoRA item, not the checkpoint one; ✚ New style", ev("cv_lora").state === "pass" && ev("cv_ckpt").state === "" && ev("mm_newstyle").state === "pass" && /My Pony/.test(ev("mm_newstyle").how));
check("manual items never tick themselves", TP.evaluate(it("te_keys"), ctx).state === "" && TP.evaluate(it("qp_menu"), ctx).state === "");
const sum = TP.summarize(items, ctx, { te_keys: { state: "pass", note: "", at: 1 }, an_aes: { state: "fail", note: "the hands came out wrong", at: 2 }, cam3d: { state: "", note: "not tried yet" } });
const row = (id) => sum.rows.find((r) => r.id === id);
check("summarize: your mark wins (a ✗ on an auto-ticked item stays ✗, with what auto saw), a note alone keeps the auto state",
  row("te_keys").state === "pass" && row("an_aes").state === "fail" && /^you: fail \(auto: job j1/.test(row("an_aes").how) && row("an_aes").note === "the hands came out wrong" && row("cam3d").state === "" && row("cam3d").note === "not tried yet", row("an_aes"));
check("summarize: the counts add up", sum.pass + sum.fail + sum.skip + sum.todo === sum.total && sum.total === items.length && sum.fail === 1, [sum.pass, sum.fail, sum.skip, sum.todo, sum.total]);
const txt = TP.textReport(sum, { version: "2.518.0", os: "Windows_NT 10.0.26100", cpu: "Ryzen x16", ram: "64 GB", gpus: ["NVIDIA GeForce RTX 5090 · 32 GB"], comfy: "http://127.0.0.1:8188", smi: true },
  [{ id: "j2", mode: "image", style: "Krea 2 Turbo", log: ["Traceback", "ValueError: unet missing"] }], "2026-10-18 09:00");
check("the log: version, computer, GPUs, ComfyUI, the summary, every item ✓ / ✗ / · with how + your note, the failed jobs' last lines, then JSON",
  /^bitGen Studio — TEST LOG\nApp 2\.518\.0 · saved 2026-10-18 09:00/.test(txt) && /GPUs: NVIDIA GeForce RTX 5090/.test(txt) && /Summary: \d+ passed, 1 failed/.test(txt)
  && /✗ FAIL  Anima style renders/.test(txt) && /note: the hands came out wrong/.test(txt) && /✓ PASS  Ctrl\+Shift\+Alt\+E/.test(txt) && /· not done/.test(txt)
  && /-- job j2 · image · Krea 2 Turbo\n   Traceback\n   ValueError: unet missing/.test(txt) && /== JSON \(for Claude\)\n\{"version":"2\.518\.0"/.test(txt));
const js = JSON.parse(txt.split("== JSON (for Claude)\n")[1]);
check("…its JSON block parses (items with id / state / how / note, the failed jobs)", js.items.length === items.length && js.items.find((x) => x.id === "an_aes").state === "fail" && js.failed[0].id === "j2");
check("the docker's words: ✓ ✗ – ·, '3 ✓ · 1 ✗ · 5 to do (of 9)'", TD.icon("pass") === "✓" && TD.icon("fail") === "✗" && TD.icon("skip") === "–" && TD.icon("") === "·" && TD.countText({ pass: 3, fail: 1, todo: 5, total: 9 }) === "3 ✓ · 1 ✗ · 5 to do (of 9)");

/* ---- wiring */
const IDX = read("routes", "index.js"), HT = read("static", "index.html"), RT = read("routes", "testPlan.js"), TDS = read("static", "testdock.js"), MMR = read("routes", "modelMgr.js"), CVS = read("lib", "civitai.js");
const SRV = (() => { try { return read("misc/server.js"); } catch { return ""; } })();
check("routes: /api/testplan, /mark, /clear, /report (a download: Content-Disposition attachment) mounted from routes/index.js; server.js untouched",
  /require\("\.\/testPlan"\)\.mount\(app\)/.test(IDX) && /"\/api\/testplan"/.test(RT) && /"\/api\/testplan\/mark"/.test(RT) && /"\/api\/testplan\/clear"/.test(RT) && /Content-Disposition", `attachment; filename=/.test(RT) && !/testPlan|testdock/.test(SRV));
check("the app tells it what happened: ✚ New style, ✎ card edits, Civitai searches / downloads (with the folder) / look-ups",
  /event\("style_from_model"/.test(MMR) && /event\("card_edit"/.test(MMR) && /event\("civitai_search"/.test(CVS) && /event\("civitai_download", \{ cat: d\.cat/.test(CVS) && /event\("civitai_lookup"/.test(CVS));
check("Settings -> General has 🧩 Testing… (it closes Settings and shows the docker); testdock.js loaded; 💾 Save log downloads the report",
  /id="s_testing"/.test(HT) && /<script src="\/static\/testdock\.js"><\/script>/.test(HT) && /\$\("s_testing"\)/.test(TDS) && /d\.close\(\); show\(true\)/.test(TDS) && /fetch\("\/api\/testplan\/report"\)/.test(TDS) && /a\.download = name/.test(TDS));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
