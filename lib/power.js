// bitGen Studio — lib/power.js (2.517.0): POWER DRAW, CLOCK SPEEDS and THE ENERGY A JOB USED.
// Tim (verbatim): "Can we add powerdraw and clockspeed to the system stats. when a job is completed add total power
// consumed?"
//
//   GPUs   one long-running `nvidia-smi --query-gpu=index,power.draw,power.limit,clocks.gr,clocks.mem,clocks.max.gr
//          -lms 1000` (no process started every poll); each line integrated (watts x seconds) into the card's energy
//   CPU    its clock: Linux /proc/cpuinfo (the cores' current MHz, averaged); Windows the "% Processor Performance"
//          counter x the CPU's base speed (PowerShell, every 5 s); macOS / others os.cpus() (the nominal speed).
//          Its power: Linux RAPL (/sys/class/powercap/intel-rapl:0/energy_uj - the package; AMD Zen exposes it too)
//          when the file can be read - else not known (Windows has no API for it without a driver)
//   stats()        {gpus: [{index, power_w, power_limit_w, clock_mhz, mem_clock_mhz, max_clock_mhz}], cpu_mhz,
//                   cpu_power_w, energy: {gpu_wh, cpu_wh, since}} - /api/stats adds them
//   mark()         the energy counters now (core.js keeps it on the job when it starts)
//   since(mark)    {wh, gpu_wh, cpu_wh, cpu_measured, avg_w, peak_w, secs} - the energy used from that mark to now
//   parseLine / integrate / summary: pure (scripts/test-power517.js)
//   2.518.0: + each GPU's temperature (temperature.gpu, the 7th field - the queue presets pause on it, lib/queuePresets.js)
//            + the ENERGY COST (Settings -> General -> Energy cost: config.power {price_kwh, currency}): costOf / money,
//            the [power] line ends with what it cost
//   2.519.0: + the DAILY SUPPLY CHARGE (config.power.supply_day - the fixed part of the bill, per day): a job's cost
//            adds its share of it (supply_day x its seconds / 86400) - supplyOf / jobCost
//   2.520.0: PEAK / OFF-PEAK (Tim: "add peak and time and prices for peak and offpeak. anytime that is not peak will be
//            offpeak"): config.power.peak_price_kwh + peak_windows [{days: [0..6, 0 = Sunday], from "HH:MM", to "HH:MM"}]
//            (from > to = through midnight); price_kwh is then the off-peak price. Every reading is filed by the clock
//            when it was taken (isPeak) - the counters keep the peak share (gpuPJ / cpuPJ), a job's summary has wh_peak
//            and jobCost prices the two parts
"use strict";
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");

const IS_WIN = process.platform === "win32";
const num = (v) => { const x = parseFloat(String(v).trim()); return Number.isFinite(x) ? x : null; };

/** one nvidia-smi csv line -> {index, power_w, power_limit_w, clock_mhz, mem_clock_mhz, max_clock_mhz, temp_c} | null
 *  (temp_c is the 7th field since 2.518.0 - null when a line has six) */
function parseLine(line) {
  const p = String(line || "").split(",").map((s) => s.trim());
  if (p.length < 6 || !/^\d+$/.test(p[0])) return null;
  return { index: +p[0], power_w: num(p[1]), power_limit_w: num(p[2]), clock_mhz: num(p[3]), mem_clock_mhz: num(p[4]), max_clock_mhz: num(p[5]),
           temp_c: p.length > 6 ? num(p[6]) : null };
}
/** energy (J) added between two readings of one meter: the trapezoid of the two powers over the time between (a gap
 *  over 10 s - the meter stopped - counts the last power for 2 s only) */
function integrate(prev, cur) {
  if (!prev || prev.w == null || cur.w == null) return 0;
  const dt = Math.max(0, (cur.t - prev.t) / 1000);
  if (dt > 10) return prev.w * 2;
  return (prev.w + cur.w) / 2 * dt;
}
/** the energy between two marks -> what a job is told */
function summary(a, b, peak) {
  if (!a || !b) return null;
  const gj = Math.max(0, b.gpu_j - a.gpu_j), cj = b.cpu_known && a.cpu_known ? Math.max(0, b.cpu_j - a.cpu_j) : 0;
  const pj = Math.max(0, (b.gpu_pj || 0) - (a.gpu_pj || 0)) + (b.cpu_known && a.cpu_known ? Math.max(0, (b.cpu_pj || 0) - (a.cpu_pj || 0)) : 0);
  const secs = Math.max(0, (b.t - a.t) / 1000), j = gj + cj;
  if (!b.gpu_known && !b.cpu_known) return null;
  const r = (x) => Math.round(x * 1000) / 1000;
  return { wh: r(j / 3600), gpu_wh: r(gj / 3600), cpu_wh: r(cj / 3600), cpu_measured: !!(b.cpu_known && a.cpu_known), gpu_measured: !!b.gpu_known,
           avg_w: secs > 0 ? Math.round(j / secs) : 0, peak_w: peak != null ? Math.round(peak) : null, secs: Math.round(secs),
           wh_peak: r(Math.min(pj, j) / 3600), wh_offpeak: r(Math.max(0, j - pj) / 3600) };
}
/** "HH:MM" -> minutes of the day | null */
function hm(t) { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || "").trim()); if (!m) return null; const v = +m[1] * 60 + +m[2]; return v >= 0 && v <= 1440 ? v : null; }
/** the peak times, cleaned: [{days: [0-6], from, to}] (a window with no days = every day) */
function cleanWindows(w) {
  return (Array.isArray(w) ? w : []).map((x) => ({
    days: [...new Set((Array.isArray(x && x.days) ? x.days : [0, 1, 2, 3, 4, 5, 6]).map(Number).filter((d) => d >= 0 && d <= 6))].sort(),
    from: hm(x && x.from) != null ? String(x.from).trim().padStart(5, "0") : null, to: hm(x && x.to) != null ? String(x.to).trim().padStart(5, "0") : null,
  })).filter((x) => x.from && x.to && x.from !== x.to && x.days.length).slice(0, 12);
}
/** is this moment peak? (pure: date = a Date, windows = cleanWindows) - anything that is not peak is off-peak */
function isPeak(date, windows) {
  const d = date instanceof Date ? date : new Date(date);
  const day = d.getDay(), m = d.getHours() * 60 + d.getMinutes();
  for (const w of windows || []) {
    const a = hm(w.from), b = hm(w.to);
    if (a == null || b == null) continue;
    if (a < b) { if (w.days.includes(day) && m >= a && m < b) return true; }
    else {                                                       // through midnight: from on its day, to on the next
      if (w.days.includes(day) && m >= a) return true;
      if (w.days.includes((day + 6) % 7) && m < b) return true;
    }
  }
  return false;
}

/* ---------------- the meters (live) */
let winCache = { at: 0, w: [] };
function peakNow(t) {
  if (Date.now() - winCache.at > 10000) {
    winCache.at = Date.now();
    try { const p = priceOf(require("./core").getConfig()); winCache.w = p.peak_price_kwh > 0 ? p.peak_windows : []; } catch { winCache.w = []; }
  }
  return winCache.w.length ? isPeak(new Date(t), winCache.w) : false;
}
const S = { gpuPJ: 0, cpuPJ: 0, gpus: new Map(), gpuJ: 0, gpuKnown: false, cpuJ: 0, cpuKnown: false, cpuW: null, cpuMhz: null, since: Date.now(), smi: null, smiDead: false, peak: new Map(), started: false };
function startSmi() {
  if (S.smi || S.smiDead) return;
  let p;
  try {
    p = spawn("nvidia-smi", ["--query-gpu=index,power.draw,power.limit,clocks.gr,clocks.mem,clocks.max.gr,temperature.gpu", "--format=csv,noheader,nounits", "-lms", "1000"], { windowsHide: true });
  } catch { S.smiDead = true; return; }
  S.smi = p;
  let buf = "";
  p.stdout.on("data", (d) => {
    buf += d; let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const g = parseLine(buf.slice(0, i)); buf = buf.slice(i + 1);
      if (!g) continue;
      const now = Date.now(), prev = S.gpus.get(g.index), cur = Object.assign({ t: now, w: g.power_w }, g);
      if (prev) { const j = integrate(prev, cur); S.gpuJ += j; if (peakNow(now)) S.gpuPJ += j; }
      if (g.power_w != null) { S.gpuKnown = true; for (const [k, v] of S.peak) if (v < g.power_w + gpuOthers(g.index)) S.peak.set(k, g.power_w + gpuOthers(g.index)); }
      S.gpus.set(g.index, cur);
    }
  });
  p.on("error", () => { S.smi = null; S.smiDead = true; });
  p.on("close", () => { S.smi = null; if (!S.smiDead) setTimeout(startSmi, 30000).unref(); });
}
function gpuOthers(index) { let w = 0; for (const [k, v] of S.gpus) if (k !== index && v.power_w != null) w += v.power_w; return w + (S.cpuW || 0); }

const RAPL = "/sys/class/powercap/intel-rapl:0/energy_uj", RAPL_MAX = "/sys/class/powercap/intel-rapl:0/max_energy_range_uj";
let rapl = null;
function readCpu() {
  // power (Linux RAPL)
  if (process.platform === "linux") {
    try {
      const uj = +fs.readFileSync(RAPL, "utf8"), t = Date.now();
      if (rapl) {
        let d = uj - rapl.uj;
        if (d < 0) { let max = 0; try { max = +fs.readFileSync(RAPL_MAX, "utf8"); } catch { max = 0; } d += max; }
        const dt = (t - rapl.t) / 1000;
        if (dt > 0 && d >= 0) { S.cpuJ += d / 1e6; if (peakNow(t)) S.cpuPJ += d / 1e6; S.cpuW = Math.round(d / 1e6 / dt * 10) / 10; S.cpuKnown = true; }
      }
      rapl = { uj, t };
    } catch { /* not readable (root only on many kernels) - CPU power unknown */ }
    try {
      const mhz = fs.readFileSync("/proc/cpuinfo", "utf8").split("\n").filter((l) => /^cpu MHz/.test(l)).map((l) => +l.split(":")[1]).filter((x) => x > 0);
      if (mhz.length) S.cpuMhz = Math.round(mhz.reduce((a, b) => a + b, 0) / mhz.length);
    } catch { S.cpuMhz = null; }
  } else if (!IS_WIN) {
    const c = os.cpus(); S.cpuMhz = c.length ? Math.round(c.reduce((a, x) => a + (x.speed || 0), 0) / c.length) : null;
  }
}
let winBusy = false, winAt = 0;
function readWinClock() {
  if (!IS_WIN || winBusy || Date.now() - winAt < 5000) return;
  winBusy = true; winAt = Date.now();
  let out = "";
  const ps = "$b=(Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty MaxClockSpeed);"
    + "$p=(Get-Counter '\\Processor Information(_Total)\\% Processor Performance' -ErrorAction SilentlyContinue).CounterSamples[0].CookedValue;"
    + "if($p){[math]::Round($b*$p/100)}else{$b}";
  try {
    const p = spawn("powershell", ["-NoProfile", "-Command", ps], { windowsHide: true });
    p.stdout.on("data", (d) => (out += d));
    p.on("close", () => { const v = parseInt(out.trim(), 10); if (v > 0) S.cpuMhz = v; winBusy = false; });
    p.on("error", () => { winBusy = false; });
    setTimeout(() => { try { p.kill(); } catch { /* gone */ } winBusy = false; }, 8000).unref();
  } catch { winBusy = false; }
}
function start() {
  if (S.started) return; S.started = true;
  startSmi();
  readCpu();
  const t = setInterval(() => { readCpu(); readWinClock(); }, 1000); t.unref();
}

/** the meters now */
function stats() {
  start();
  const gpus = [...S.gpus.values()].sort((a, b) => a.index - b.index).map((g) => ({ index: g.index, power_w: g.power_w, power_limit_w: g.power_limit_w, clock_mhz: g.clock_mhz, mem_clock_mhz: g.mem_clock_mhz, max_clock_mhz: g.max_clock_mhz, temp_c: g.temp_c == null ? null : g.temp_c }));
  return { gpus, cpu_mhz: S.cpuMhz, cpu_power_w: S.cpuKnown ? S.cpuW : null,
    energy: { gpu_wh: Math.round(S.gpuJ / 3.6) / 1000, cpu_wh: S.cpuKnown ? Math.round(S.cpuJ / 3.6) / 1000 : null, since: S.since,
              peak_wh: Math.round((S.gpuPJ + (S.cpuKnown ? S.cpuPJ : 0)) / 3.6) / 1000, peak_now: peakNow(Date.now()) } };
}
let markSeq = 0;
/** the counters now (a job's start) */
function mark() {
  start();
  const id = ++markSeq;
  S.peak.set(id, 0);
  return { id, t: Date.now(), gpu_j: S.gpuJ, cpu_j: S.cpuJ, gpu_pj: S.gpuPJ, cpu_pj: S.cpuPJ, gpu_known: S.gpuKnown, cpu_known: S.cpuKnown };
}
/** from a mark to now (a job's end) */
function since(m) {
  if (!m || typeof m !== "object") return null;
  const now = { t: Date.now(), gpu_j: S.gpuJ, cpu_j: S.cpuJ, gpu_pj: S.gpuPJ, cpu_pj: S.cpuPJ, gpu_known: S.gpuKnown, cpu_known: S.cpuKnown };
  const peak = S.peak.get(m.id); S.peak.delete(m.id);
  return summary(m, now, peak || null);
}
/** the energy cost: wh at price (per kWh) -> money (2 decimals; under 1 cent keeps 4) | null when no price is set */
function costOf(wh, price) {
  const p = +price, w = +wh;
  if (!(p > 0) || !Number.isFinite(w) || w < 0) return null;
  const c = (w / 1000) * p;
  return c >= 0.01 ? Math.round(c * 100) / 100 : Math.round(c * 10000) / 10000;
}
const SYMBOLS = { AUD: "$", USD: "$", NZD: "$", CAD: "$", SGD: "$", HKD: "$", EUR: "€", GBP: "£", JPY: "¥", CNY: "¥", INR: "₹", THB: "฿", KRW: "₩" };
/** "$0.04" / "€1.20" / "0.04 CHF" */
function money(c, currency) {
  if (c == null) return "";
  const cur = String(currency || "AUD").toUpperCase().slice(0, 3), sym = SYMBOLS[cur];
  const t = c >= 0.01 ? c.toFixed(2) : c.toFixed(4);
  return sym ? sym + t : t + " " + cur;
}
/** the share of the daily supply charge for `secs` seconds -> money | null (no charge set) */
function supplyOf(secs, perDay) {
  const d = +perDay, t = +secs;
  if (!(d > 0) || !Number.isFinite(t) || t < 0) return null;
  const c = d * t / 86400;
  return c >= 0.01 ? Math.round(c * 100) / 100 : Math.round(c * 10000) / 10000;
}
/** what a stretch of time cost: energy (wh at the kWh price) + its share of the daily supply -> {energy, supply, total} | null */
function jobCost(wh, secs, price, peakWh) {
  const pr = price || {};
  const rnd = (c) => (c >= 0.01 ? Math.round(c * 100) / 100 : Math.round(c * 10000) / 10000);
  const tou = pr.peak_price_kwh > 0 && Array.isArray(pr.peak_windows) && pr.peak_windows.length && peakWh != null;
  let en = null, pk = null, off = null;
  if (tou) {
    const pw = Math.max(0, Math.min(+wh || 0, +peakWh || 0)), ow = Math.max(0, (+wh || 0) - pw);
    pk = rnd((pw / 1000) * pr.peak_price_kwh); off = rnd((ow / 1000) * (pr.price_kwh || 0));
    en = rnd((pw / 1000) * pr.peak_price_kwh + (ow / 1000) * (pr.price_kwh || 0));
  } else if (pr.price_kwh > 0) en = costOf(wh, pr.price_kwh);
  const su = pr.supply_day > 0 ? supplyOf(secs, pr.supply_day) : null;
  if (en == null && su == null) return null;
  const out = { energy: en, supply: su, total: rnd((en || 0) + (su || 0)) };
  if (tou) Object.assign(out, { peak: pk, offpeak: off, wh_peak: Math.round(Math.min(+wh || 0, +peakWh || 0) * 1000) / 1000 });
  return out;
}
/** the price set in Settings (config.power) -> {price_kwh, supply_day, currency} */
function priceOf(cfg) {
  const p = (cfg && cfg.power) || {};
  const v = +p.price_kwh, d = +p.supply_day, pk = +p.peak_price_kwh;
  const out = { price_kwh: v > 0 ? Math.min(100, v) : 0, supply_day: d > 0 ? Math.min(1000, d) : 0,
           currency: /^[A-Za-z]{3}$/.test(String(p.currency || "")) ? String(p.currency).toUpperCase() : "AUD" };
  // 2.520.0: peak / off-peak (only when a peak price AND peak times are set)
  const w = cleanWindows(p.peak_windows);
  if (pk > 0 && w.length) { out.peak_price_kwh = Math.min(100, pk); out.peak_windows = w; }
  return out;
}
/** words for the job's log / its card: "0.125 kWh (GPU 118 Wh + CPU 7 Wh) - avg 310 W, peak 352 W over 24 min" */
function words(e, price) {
  if (!e) return "";
  const wh = (x) => (x >= 1000 ? (x / 1000).toFixed(2) + " kWh" : x >= 10 ? Math.round(x) + " Wh" : x.toFixed(1) + " Wh");
  const parts = e.cpu_measured ? ` (GPU ${wh(e.gpu_wh)} + CPU ${wh(e.cpu_wh)})` : e.gpu_measured ? " (GPU - the CPU is not measured here)" : " (CPU)";
  const dur = e.secs >= 90 ? Math.round(e.secs / 60) + " min" : e.secs + " s";
  const pr = price || {}, jc = jobCost(e.wh, e.secs, pr, e.wh_peak);
  let tail = "";
  if (jc && jc.peak != null) tail = ` - cost ${money(jc.total, pr.currency)} (peak ${wh(jc.wh_peak)} ${money(jc.peak, pr.currency)} at ${money(pr.peak_price_kwh, pr.currency)}/kWh`
    + ` + off-peak ${wh(Math.max(0, e.wh - jc.wh_peak))} ${money(jc.offpeak, pr.currency)} at ${money(pr.price_kwh, pr.currency)}/kWh`
    + (jc.supply != null ? ` + ${money(jc.supply, pr.currency)} of the ${money(pr.supply_day, pr.currency)}/day supply charge` : "") + ")";
  else if (jc && jc.supply == null) tail = ` - cost ${money(jc.energy, pr.currency)} at ${money(pr.price_kwh, pr.currency)}/kWh`;
  else if (jc) tail = ` - cost ${money(jc.total, pr.currency)} (` + (jc.energy != null ? `${money(jc.energy, pr.currency)} at ${money(pr.price_kwh, pr.currency)}/kWh + ` : "")
    + `${money(jc.supply, pr.currency)} of the ${money(pr.supply_day, pr.currency)}/day supply charge)`;
  return `${wh(e.wh)}${parts} - avg ${e.avg_w} W${e.peak_w ? ", peak " + e.peak_w + " W" : ""} over ${dur}` + tail;
}

module.exports = { parseLine, integrate, summary, words, costOf, supplyOf, jobCost, money, priceOf, hm, cleanWindows, isPeak, stats, mark, since, start, _S: S };
