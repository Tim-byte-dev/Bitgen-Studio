#!/usr/bin/env node
/* bitGen Studio — 2.520.0 units: PEAK / OFF-PEAK PRICING (lib/power.js isPeak / cleanWindows / jobCost / words / priceOf,
 * static/powerstats.js priceFrom / jobCost) and the 📊 USAGE LOG (lib/usageLog.js, routes/usage.js, static/usagedock.js).
 * Tim (verbatim): "add peak and time and prices for peak and offpeak.anytime that is not peak will be offpeak. keep a
 * detailed list of usage the the user can review" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const PW = require("../lib/power.js"), H = require("../static/powerstats.js"), U = require("../lib/usageLog.js"), UD = require("../static/usagedock.js");

/* ---- the peak windows */
const W = PW.cleanWindows([{ days: [1, 2, 3, 4, 5], from: "7:00", to: "09:00" }, { days: [1, 2, 3, 4, 5], from: "17:00", to: "21:00" },
  { days: [6], from: "22:00", to: "02:00" }, { from: "10:00", to: "10:00" }, { days: [], from: "1:00", to: "2:00" }, { days: [9], from: "x", to: "2:00" }]);
check("cleanWindows: times padded, empty / same-time / bad windows dropped", W.length === 3 && W[0].from === "07:00" && W[0].to === "09:00" && W[2].days.join() === "6", W);
check("cleanWindows: a window with no days given = every day", PW.cleanWindows([{ from: "16:00", to: "20:00" }])[0].days.length === 7);
check("hm", PW.hm("7:05") === 425 && PW.hm("24:00") === 1440 && PW.hm("25:00") === null && PW.hm("x") === null);
const at = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi);   // 2026-10-19 is a Monday
check("isPeak: Monday 07:30 and 18:00 peak; 09:00 (the end) off-peak; 12:00 off-peak",
  PW.isPeak(at(2026, 10, 19, 7, 30), W) && PW.isPeak(at(2026, 10, 19, 18, 0), W) && !PW.isPeak(at(2026, 10, 19, 9, 0), W) && !PW.isPeak(at(2026, 10, 19, 12, 0), W));
check("isPeak: the weekend is off-peak (no window that day)", !PW.isPeak(at(2026, 10, 18, 18, 0), W));
check("isPeak: through midnight - Saturday 23:00 and Sunday 01:30 peak, Sunday 02:00 and Saturday 21:59 off-peak",
  PW.isPeak(at(2026, 10, 24, 23, 0), W) && PW.isPeak(at(2026, 10, 25, 1, 30), W) && !PW.isPeak(at(2026, 10, 25, 2, 0), W) && !PW.isPeak(at(2026, 10, 24, 21, 59), W));
check("isPeak: no windows = always off-peak", !PW.isPeak(new Date(), []) && !PW.isPeak(new Date(), undefined));

/* ---- the price */
const P = PW.priceOf({ power: { price_kwh: 0.25, supply_day: 1.1, currency: "aud", peak_price_kwh: 0.5, peak_windows: [{ days: [1], from: "17:00", to: "21:00" }] } });
check("priceOf: off-peak price + peak price + its windows", P.price_kwh === 0.25 && P.peak_price_kwh === 0.5 && P.peak_windows.length === 1 && P.currency === "AUD" && P.supply_day === 1.1, P);
check("priceOf: a peak price without times (or times without a price) is no peak pricing", !("peak_price_kwh" in PW.priceOf({ power: { price_kwh: 0.25, peak_price_kwh: 0.5 } }))
  && !("peak_windows" in PW.priceOf({ power: { price_kwh: 0.25, peak_windows: [{ days: [1], from: "17:00", to: "21:00" }] } })));

/* ---- a job's cost */
const c = PW.jobCost(125, 3600, P, 100);
check("jobCost with peak: 100 Wh at 0.50 + 25 Wh at 0.25 + 1 h of the supply", c.peak === 0.05 && Math.abs(c.offpeak - 0.0063) < 1e-9 && c.energy === 0.06 && c.wh_peak === 100 && c.supply === 0.05 && c.total === 0.11, c);
check("jobCost: peak Wh above the job's Wh is capped", PW.jobCost(50, 0, P, 80).wh_peak === 50 && PW.jobCost(50, 0, P, 80).offpeak === 0);
const c0 = PW.jobCost(125, 3600, { price_kwh: 0.25, supply_day: 1.1 }, 100);
check("jobCost without peak pricing: one price for every Wh (no peak fields)", c0.peak === undefined && c0.energy === PW.costOf(125, 0.25), c0);
const e = { wh: 125, gpu_wh: 118, cpu_wh: 7, cpu_measured: true, avg_w: 310, peak_w: 352, secs: 3600, wh_peak: 100 };
const wds = PW.words(e, P);
check("words: the log line splits peak and off-peak (and the supply share)", /cost \$0\.11 \(peak 100 Wh \$0\.05 at \$0\.50\/kWh \+ off-peak 25 Wh \$0\.0063 at \$0\.25\/kWh \+ \$0\.05 of the \$1\.10\/day supply charge\)/.test(wds), wds);
check("…which is what the checklist's auto item looks for", new RegExp(JSON.parse(read("lib", "testPlan.json")).groups.find((g) => g.id === "g520").items.find((i) => i.id === "pk_job").auto.re, "i").test("[power] " + wds));
check("words without peak pricing: unchanged (2.519)", !/peak [\d.]+ k?Wh/.test(PW.words(Object.assign({}, e, { wh_peak: undefined }), P)) && / - cost \$0\.03 at \$0\.25\/kWh$/.test(PW.words(e, { price_kwh: 0.25 })), PW.words(e, { price_kwh: 0.25 }));

/* ---- the page's copy of the maths */
const PF = H.priceFrom({ price_kwh: "0.25", supply_day: "1.1", peak_price_kwh: "0.5", peak_windows: [{ days: [1], from: "17:00", to: "21:00" }, { days: [], from: "1:00", to: "2:00" }] });
check("powerstats.priceFrom: the Settings fields -> the same price shape (windows with no days dropped)", PF.price_kwh === 0.25 && PF.peak_price_kwh === 0.5 && PF.peak_windows.length === 1, PF);
const hc = H.jobCost(125, 3600, PF, 100);
check("powerstats.jobCost = power.jobCost (the card and the log agree)", hc.total === c.total && hc.peak === c.peak && hc.offpeak === c.offpeak && hc.energy === c.energy, [hc, c]);

/* ---- the usage log */
const t0 = new Date(2026, 9, 19, 18, 0).getTime() / 1000;
const job = { id: "j1", project: "default", status: "done", started: t0 - 600, finished: t0, params: { mode: "image", style_name: "Portrait", prompt: "a  cat\non a mat" }, energy: e };
const en = U.entryFor(job, P, null);
check("entryFor: day, mode, what, prompt one line, 600 s, energy incl. peak Wh, cost split", en.day === "2026-10-19" && en.mode === "image" && en.what === "Portrait" && en.prompt === "a cat on a mat"
  && en.secs === 600 && en.energy.wh === 125 && en.energy.wh_peak === 100 && en.cost.total === c.total && en.cost.peak === 0.05 && !en.remote, en);
const enr = U.entryFor(Object.assign({}, job, { params: { mode: "lora_train", lora: { name: "me" } } }), P, { mode: "runpod", label: "RunPod pod1", cost_hr: 0.6 });
check("entryFor on a remote GPU: the label + its time x $/h (600 s at $0.60/h = $0.10)", enr.remote && enr.remote.label === "RunPod pod1" && enr.remote.cost === 0.1 && enr.what === "LoRA me", enr);
check("entryFor: a job with no meter still has its time (+ its supply share)", (() => { const x = U.entryFor({ id: "j2", started: t0 - 3600, finished: t0, params: { mode: "export" } }, { supply_day: 2.4 }, null); return x.energy === null && x.cost && x.cost.supply === 0.1; })());
let d1 = U.dayAdd(null, { wh: 100, wh_peak: 100, secs: 300 }, P);
d1 = U.dayAdd(d1, { wh: 100, wh_peak: 0, secs: 300, remote_secs: 300, remote_cost: 0.05 }, P);
check("dayAdd: Wh, peak Wh, time, energy cost (peak 0.05 + off-peak 0.025), remote", d1.wh === 200 && d1.wh_peak === 100 && d1.secs === 600 && Math.abs(d1.cost_energy - 0.075) < 1e-9 && d1.remote_cost === 0.05, d1);
const sm = U.summarize([en, enr], { "2026-10-19": d1, "2026-10-18": U.dayAdd(null, { wh: 50, secs: 60 }, P) }, P);
check("summarize: two days (oldest first), jobs newest first, the bill = energy + supply per day + remote", sm.days.length === 2 && sm.days[0].day === "2026-10-18" && sm.days[1].jobs === 2
  && sm.totals.jobs === 2 && sm.totals.supply === 2.2 && Math.abs(sm.totals.bill - (sm.totals.day_energy_cost + 2.2 + 0.05)) < 1e-6, sm.totals);
check("inRange", U.inRange("2026-10-19", "2026-10-01", "2026-10-31") && !U.inRange("2026-09-30", "2026-10-01", "") && U.inRange("2020-01-01", "", ""));
const csvJ = U.toCsv("jobs", sm.jobs), csvD = U.toCsv("days", sm.days);
check("toCsv jobs: a header + a row a job, prompts with commas quoted", csvJ.split("\n")[0].startsWith("finished,day,id,project,mode") && csvJ.trim().split("\n").length === 3 && U.toCsv("jobs", [Object.assign({}, en, { prompt: 'a, "b"' })]).includes('"a, ""b"""'), csvJ.slice(0, 300));
check("toCsv days: kWh, peak / off-peak kWh, supply, total", csvD.split("\n")[0] === "day,kwh,peak_kwh,offpeak_kwh,jobs_kwh,jobs,app_hours,energy_cost,supply_charge,remote_hours,remote_cost,total" && /^2026-10-19,0\.2,0\.1,0\.1,/m.test(csvD), csvD);

/* ---- the docker */
const now = new Date(2026, 9, 18, 12, 0);
check("rangeOf: today / 7 days / this month / last month / all", UD.rangeOf("today", now).from === "2026-10-18" && UD.rangeOf("week", now).from === "2026-10-12" && UD.rangeOf("month", now).from === "2026-10-01"
  && UD.rangeOf("last", now).from === "2026-09-01" && UD.rangeOf("last", now).to === "2026-09-30" && UD.rangeOf("all", now).from === "");
check("kwh + hours", UD.kwh(125) === "0.13" && UD.kwh(50) === "0.050" && UD.kwh(1250) === "1.25" && UD.kwh(12500) === "12.5" && UD.hours(5400) === "1.5" && UD.hours(36000 * 2) === "20");

/* ---- wiring */
const CORE = read("lib", "core.js"), IDX = read("routes", "index.js"), SRV = read("server.js"), HTML = read("static", "index.html"), PS = read("static", "powerstats.js");
check("core files every finished job in the usage log", /require\("\.\/usageLog"\)\.recordJob\(job\)/.test(CORE));
check("routes/index mounts usage (not server.js)", /require\("\.\/usage"\)/.test(IDX) && !/usageLog|routes\/usage/.test(SRV));
check("Settings -> Energy cost: peak price, ＋ Peak times, 📊 Usage…, the windows editor", ["s_peak", "s_peakadd", "s_usage", "s_peakwin"].every((i) => HTML.includes('id="' + i + '"')) && /s_peakwin/.test(PS));
check("the page loads static/usagedock.js; the ⚡ statusbar figure opens it", /<script src="\/static\/usagedock\.js/.test(HTML) && /#statEnergy/.test(read("static", "usagedock.js")));
const IGN = fs.existsSync(path.join(ROOT, "_gitignore")) ? read("_gitignore") : "usage/";
check("usage/ is not shipped (ignored)", /^\/?usage\/?$/m.test(IGN));

console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
