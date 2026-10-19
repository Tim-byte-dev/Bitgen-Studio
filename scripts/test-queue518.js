#!/usr/bin/env node
/* bitGen Studio — 2.518.0 units: ⏱ QUEUE PRESETS (lib/queuePresets.js, static/queuepresets.js, core.pump) and the
 * ENERGY COST (lib/power.js costOf / money / words, static/powerstats.js, Settings -> General).
 * Tim (verbatim): "add a dropdown on the main menubar for queue presets" / "add Energy cost to the settings dialog"
 * The live part runs applyPower against a stand-in nvidia-smi (one that refuses -pl like a non-admin user, one that
 * accepts it) and core's pump against a real Custom preset (a 2 s rest between two jobs). */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const QP = require("../lib/queuePresets.js"), PW = require("../lib/power.js"), H = require("../static/powerstats.js"), QS = require("../static/queuepresets.js");

/* ---- presets */
const ids = QP.PRESETS.map((p) => p.id);
check("six presets: Normal, Quiet (overnight), Eco, Cool-down between jobs, Max performance, Custom", JSON.stringify(ids) === JSON.stringify(["normal", "quiet", "eco", "cool", "max", "custom"]), ids);
const q = QP.resolve({ preset: "quiet" });
check("resolve: Quiet = 70 % power, 20 s rest, waits at 80 °C until 70 °C; unknown / none = Normal", q.power_pct === 70 && q.cooldown_s === 20 && q.pause_c === 80 && q.resume_c === 70
  && QP.resolve({ preset: "nope" }).id === "normal" && QP.resolve(null).id === "normal" && QP.resolve({}).power_pct === null, q);
const cu = QP.resolve({ preset: "custom", custom: { power_pct: 250, cooldown_s: -4, pause_c: 85, resume_c: 90 } });
check("Custom is clamped (power 30-110 %, rest >= 0) and its resume temperature kept under its pause one", cu.power_pct === 110 && cu.cooldown_s === 0 && cu.pause_c === 85 && cu.resume_c === 75, cu);
check("Custom with a blank power limit leaves the cards alone", QP.resolve({ preset: "custom", custom: { power_pct: "" } }).power_pct === null);

/* ---- gate */
const now = 1e9;
check("gate: Normal never waits", QP.gate(QP.resolve({}), { lastDone: now - 10 }, [{ index: 0, temp_c: 95 }], now) === null);
const g1 = QP.gate(q, { lastDone: now - 5000 }, [], now);
check("gate: the rest between jobs - 15 s left of 20 (asks again within 5 s)", g1 && g1.left_s === 15 && g1.wait === 5000 && /rest between jobs \(Quiet \(overnight\)\): 15 s left/.test(g1.why), g1);
check("gate: the rest is over = go", QP.gate(q, { lastDone: now - 21000 }, [{ index: 0, temp_c: 60 }], now) === null);
const g2 = QP.gate(q, {}, [{ index: 0, temp_c: 62 }, { index: 1, temp_c: 81 }], now);
check("gate: a GPU at 81 °C (pause 80) holds the job - the hottest named, the resume temperature said", g2 && g2.hot && /GPU 1 is 81 °C - waiting until it is 70 °C/.test(g2.why), g2);
check("gate: once holding, 75 °C still waits (until 70 °C - no flapping at the line); 70 °C = go",
  !!QP.gate(q, { hot: true, hotSince: now - 1000 }, [{ index: 0, temp_c: 75 }], now) && QP.gate(q, { hot: true, hotSince: now - 1000 }, [{ index: 0, temp_c: 70 }], now) === null);
check("gate: a heat hold gives up after 20 min (a stuck sensor never stops the queue for good)", QP.gate(q, { hot: true, hotSince: now - QP.MAX_HOLD_MS }, [{ index: 0, temp_c: 99 }], now) === null);
check("gate: no temperature known = no heat hold", QP.gate(q, {}, [{ index: 0, temp_c: null }], now) === null);

/* ---- power limits */
check("wattsFor: 70 % of a 450 W card = 315 W, kept inside its min / max; none = leave it", QP.wattsFor(70, { default_w: 450, min_w: 100, max_w: 600 }) === 315
  && QP.wattsFor(10, { default_w: 450, min_w: 100, max_w: 600 }) === 100 && QP.wattsFor(200, { default_w: 450, min_w: 100, max_w: 600 }) === 600 && QP.wattsFor(null, { default_w: 450 }) === null);
const lim = QP.parseLimits("0, 450.00, 100.00, 600.00\n1, [N/A], [N/A], [N/A]\njunk");
check("parseLimits: nvidia-smi's default / min / max limits per card", lim.length === 2 && lim[0].default_w === 450 && lim[0].max_w === 600 && lim[1].default_w === null, lim);
const w = QP.warningsFor(q, [{ index: 0, temp_c: 86, power_w: 300, power_limit_w: 450, clock_mhz: 1500, max_clock_mhz: 2800 }, { index: 1, temp_c: 50 }]);
check("warnings: hot, and probably throttling (hot, busy, its clock well under its top)", w.length === 2 && /GPU 0 is 86 °C/.test(w[0]) && /GPU 0 is probably throttling \(1500 of 2800 MHz at 86 °C\)/.test(w[1]), w);
check("the menu bar's badge: ⏸ holding, ⚠ a warning, nothing otherwise", QS.badgeOf({ holding: { why: "x" } }) === "⏸" && QS.badgeOf({ warnings: ["a"] }) === "⚠" && QS.badgeOf({ warnings: [] }) === "" && QS.badgeOf(null) === "");

/* ---- energy cost */
check("costOf: 125 Wh at $0.35/kWh = 0.04; tiny jobs keep 4 places; no price = null", PW.costOf(125, 0.35) === 0.04 && PW.costOf(10, 0.3) === 0.003 && PW.costOf(100, 0) === null && PW.costOf(-1, 1) === null);
check("money: $ for AUD / USD, € £ ¥ ฿, a code otherwise", PW.money(0.04, "AUD") === "$0.04" && PW.money(1.2, "EUR") === "€1.20" && PW.money(0.5, "THB") === "฿0.50" && PW.money(0.04, "CHF") === "0.04 CHF" && PW.money(null) === "");
check("priceOf: config.power -> {price_kwh, currency}; junk = 0 / AUD", JSON.stringify(PW.priceOf({ power: { price_kwh: "0.35", currency: "usd" } })) === JSON.stringify({ price_kwh: 0.35, supply_day: 0, currency: "USD" })   // 2.519.0: + supply_day
  && PW.priceOf({}).price_kwh === 0 && PW.priceOf({ power: { price_kwh: -3, currency: "dollars" } }).currency === "AUD");
const e = { wh: 125, gpu_wh: 120, cpu_wh: 5, cpu_measured: true, gpu_measured: true, avg_w: 300, peak_w: 352, secs: 1500 };
check("the [power] line ends with what it cost; without a price it does not", / - cost \$0\.04 at \$0\.35\/kWh$/.test(PW.words(e, { price_kwh: 0.35, currency: "AUD" })) && !/cost/.test(PW.words(e)) && !/cost/.test(PW.words(e, { price_kwh: 0 })), PW.words(e, { price_kwh: 0.35, currency: "AUD" }));
check("the page: the same formula (costOf / money side by side), the card '⚡ 125 Wh · $0.04', its tooltip says the cost",
  H.costOf(125, 0.35) === PW.costOf(125, 0.35) && H.money(0.003, "AUD") === PW.money(0.003, "AUD") && H.badgeText(e, { price_kwh: 0.35, currency: "AUD" }) === "⚡ 125 Wh · $0.04"
  && H.badgeText(e) === "⚡ 125 Wh" && /Cost: \$0\.04 at \$0\.35 per kWh/.test(H.badgeTitle(e, { price_kwh: 0.35, currency: "AUD" })));
check("parseLine reads the 7th field (temperature.gpu); six fields = temp_c null", PW.parseLine("0, 300, 450, 2500, 10000, 2800, 71").temp_c === 71 && PW.parseLine("0, 300, 450, 2500, 10000, 2800").temp_c === null);

/* ---- live: applyPower against a stand-in nvidia-smi */
(async () => {
  if (process.platform !== "win32") {
    const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg518q-"));
    const mk = (allow) => fs.writeFileSync(path.join(T, "nvidia-smi"), `#!/usr/bin/env node
const a = process.argv.slice(2).join(" ");
if (/power.default_limit/.test(a)) { console.log("0, 450.00, 100.00, 600.00"); process.exit(0); }
if (/-pl/.test(a)) { ${allow ? 'console.log("Power limit for GPU 00000000:01:00.0 was set to " + process.argv[5] + ".00 W from 450.00 W."); process.exit(0);' : 'console.log("Changing power management limit is not supported... Insufficient Permissions"); process.exit(4);'} }
`, { mode: 0o755 });
    const PATH0 = process.env.PATH;
    process.env.PATH = T + path.delimiter + PATH0;
    mk(false);
    const r1 = await QP.applyPower(QP.resolve({ preset: "quiet" }));
    check("applyPower without rights: refused, and it says why (administrator / sudo) - the rest of the preset still works", r1 && !r1.ok && r1.gpus[0].watts === 315 && /administrator/.test(r1.note), r1);
    mk(true);
    const r2 = await QP.applyPower(QP.resolve({ preset: "eco" }));
    check("applyPower with rights: GPU 0 set to 270 W (60 % of 450), until the computer restarts", r2 && r2.ok && r2.gpus[0].watts === 270 && /GPU 0 270 W/.test(r2.note), r2);
    const r3 = await QP.applyPower(QP.resolve({ preset: "normal" }));
    check("Normal leaves the limit alone (no nvidia-smi call)", r3.ok && /left as it is/.test(r3.note), r3);
    process.env.PATH = PATH0;
    try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ }
  } else console.log("SKIP: the stand-in nvidia-smi is a POSIX script");

  /* ---- live: core's pump waits the Custom preset's rest between two jobs */
  const core = require("../lib/core.js");
  const cfg = core.getConfig(), keep = JSON.stringify(cfg.queue || null);
  cfg.queue = { preset: "custom", custom: { power_pct: null, cooldown_s: 2, pause_c: 0, resume_c: 0 } };
  QP._S.lastDone = 0; QP._S.holding = null;
  QP.finished(Date.now());                                   // a job just ended
  const t0 = Date.now(); let t1 = 0;
  while (!t1 && Date.now() - t0 < 6000) { const g = QP.check(); if (!g) t1 = Date.now(); else await new Promise((ok) => setTimeout(ok, 100)); }
  check("check(): with a 2 s rest the next job may start after ~2 s, not before", t1 && t1 - t0 >= 1800 && t1 - t0 < 4000, t1 - t0);
  const note = QP.takeNote();
  check("the job that starts after a hold logs [queue] waited N s - why", /^\[queue\] waited [12] s - rest between jobs \(Custom\)$/.test(note), note);
  cfg.queue = JSON.parse(keep); if (cfg.queue === null) delete cfg.queue;

  /* ---- wiring */
  const CORE = read("lib", "core.js"), IDX = read("routes", "index.js"), HT = read("static", "index.html"), RT = read("routes", "queuePresets.js");
  const SRV = (() => { try { return read("server.js"); } catch { return ""; } })();
  check("core.pump asks the preset first (ffmpeg-only jobs never wait), re-pumps on a timer; a job's end starts the rest",
    /require\("\.\/queuePresets"\)\.check\(\)/.test(CORE) && /pumpTimer = setTimeout\(\(\) => \{ pumpTimer = null; pump\(\); \}, g\.wait\)/.test(CORE) && /\["export", "karaoke"(, "install_aitoolkit")?(, "install_unsloth")?\]\.includes\(\(queue\[0\]\.params \|\| \{\}\)\.mode\)/.test(CORE)
    && /require\("\.\/queuePresets"\)\.finished\(\)/.test(CORE) && /require\("\.\/queuePresets"\)\.takeNote\(\)/.test(CORE));
  check("routes: /api/queuepresets GET / POST mounted from routes/index.js; /api/config keeps power, civitai, queue; server.js untouched",
    /app\.get\("\/api\/queuepresets"/.test(RT) && /app\.post\("\/api\/queuepresets"/.test(RT) && /require\("\.\/queuePresets"\)\.mount\(app\)/.test(IDX)
    && /"captioner", "power", "civitai", "queue"(, "setup")?\]/.test(IDX) && !/queuePresets|modelMgr|civitai|testPlan/.test(SRV));
  check("the page: queuepresets.js loaded; Settings -> General has Energy cost (price + currency) and the [power] line passes the price",
    /<script src="\/static\/queuepresets\.js"><\/script>/.test(HT) && /id="s_kwh"/.test(HT) && /id="s_kwhcur"/.test(HT) && /pw\.words\(e, pw\.priceOf\(config\)\)/.test(CORE));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
