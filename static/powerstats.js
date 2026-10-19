/* bitGen Studio — static/powerstats.js (2.517.0): ⚡ POWER DRAW + CLOCK SPEEDS in the System stats, ⚡ the energy a job
 * used on its card. window.H3Power.
 * Tim (verbatim): "Can we add powerdraw and clockspeed to the system stats. when a job is completed add total power
 * consumed?"
 *   System     each GPU's frame gets "Power 0-<limit> W" and "Clock 0-<max> MHz" graphs (its title adds the watts and
 *              the GHz); "CPU clock" (+ "CPU power" when the computer reports it); "⚡ since start" = the energy the
 *              GPUs (+ CPU) used since the app started - lib/power.js via /api/stats `power`
 *   Queue      a finished job shows "⚡ 125 Wh" (its tooltip: GPU / CPU, average and peak watts, how long)
 *   2.518.0    ENERGY COST (Tim: "add Energy cost to the settings dialog"): Settings -> General -> Energy cost
 *              (config.power {price_kwh, currency}) - the card says "⚡ 125 Wh · $0.04", its tooltip and "⚡ since start" too
 *   2.519.0    + the DAILY SUPPLY CHARGE (Tim: "add daily supply rate to the energy costs"): config.power.supply_day - a
 *              job's cost adds its share of it (its seconds / 86400), "⚡ since start" the share since the app started
 *   2.520.0    PEAK / OFF-PEAK (Tim: "add peak and time and prices for peak and offpeak. anytime that is not peak will be
 *              offpeak"): the peak price + peak times (days, from - to) in Settings; a job's peak share (energy.wh_peak)
 *              is priced at the peak rate, the rest at the off-peak one; "⚡ since start" the same
 * Pure (Node: scripts/test-power517.js, test-queue518.js, test-hw519.js, test-usage520.js): fmtWh, fmtMhz, badgeText, badgeTitle, costOf,
 * supplyOf, jobCost, money.
 */
(function (root) {
  "use strict";
  function fmtWh(x) { x = +x || 0; return x >= 1000 ? (x / 1000).toFixed(2) + " kWh" : x >= 10 ? Math.round(x) + " Wh" : x.toFixed(1) + " Wh"; }
  function fmtMhz(m) { if (m == null || !(+m > 0)) return "n/a"; return +m >= 1000 ? (m / 1000).toFixed(2) + " GHz" : Math.round(m) + " MHz"; }
  /* the same rules as lib/power.js costOf / money (one formula, tested side by side) */
  function costOf(wh, price) { var p = +price, w = +wh; if (!(p > 0) || !isFinite(w) || w < 0) return null; var c = (w / 1000) * p; return c >= 0.01 ? Math.round(c * 100) / 100 : Math.round(c * 10000) / 10000; }
  var SYM = { AUD: "$", USD: "$", NZD: "$", CAD: "$", SGD: "$", HKD: "$", EUR: "€", GBP: "£", JPY: "¥", CNY: "¥", INR: "₹", THB: "฿", KRW: "₩" };
  function money(c, cur) { if (c == null) return ""; cur = String(cur || "AUD").toUpperCase().slice(0, 3); var t = c >= 0.01 ? c.toFixed(2) : c.toFixed(4); return SYM[cur] ? SYM[cur] + t : t + " " + cur; }
  function round$(c) { return c >= 0.01 ? Math.round(c * 100) / 100 : Math.round(c * 10000) / 10000; }
  function supplyOf(secs, perDay) { var d = +perDay, t = +secs; if (!(d > 0) || !isFinite(t) || t < 0) return null; return round$(d * t / 86400); }
  /* the same sums as lib/power.js jobCost (peakWh = the energy used in peak time, null = not known) */
  function jobCost(wh, secs, pr, peakWh) {
    pr = pr || {};
    var tou = pr.peak_price_kwh > 0 && pr.peak_windows && pr.peak_windows.length && peakWh != null;
    var en = null, pk = null, off = null, pw = 0;
    if (tou) {
      pw = Math.max(0, Math.min(+wh || 0, +peakWh || 0)); var ow = Math.max(0, (+wh || 0) - pw);
      pk = round$((pw / 1000) * pr.peak_price_kwh); off = round$((ow / 1000) * (pr.price_kwh || 0));
      en = round$((pw / 1000) * pr.peak_price_kwh + (ow / 1000) * (pr.price_kwh || 0));
    } else if (pr.price_kwh > 0) en = costOf(wh, pr.price_kwh);
    var su = pr.supply_day > 0 ? supplyOf(secs, pr.supply_day) : null;
    if (en == null && su == null) return null;
    var out = { energy: en, supply: su, total: round$((en || 0) + (su || 0)) };
    if (tou) { out.peak = pk; out.offpeak = off; out.wh_peak = Math.round(pw * 1000) / 1000; }
    return out;
  }
  function costLines(c, pr, wh) {
    if (!c) return "";
    return "\nCost: " + money(c.total, pr.currency)
      + (c.peak != null ? "\n  peak " + fmtWh(c.wh_peak) + " " + money(c.peak, pr.currency) + " at " + money(pr.peak_price_kwh, pr.currency) + " per kWh"
        + "\n  off-peak " + fmtWh(Math.max(0, (+wh || 0) - c.wh_peak)) + " " + money(c.offpeak, pr.currency) + " at " + money(pr.price_kwh, pr.currency) + " per kWh"
        : c.energy != null ? "\n  energy " + money(c.energy, pr.currency) + " at " + money(pr.price_kwh, pr.currency) + " per kWh" : "")
      + (c.supply != null ? "\n  supply " + money(c.supply, pr.currency) + " (its share of the " + money(pr.supply_day, pr.currency) + " daily supply charge)" : "");
  }
  function badgeText(e, pr) {
    if (!e || e.wh == null) return "";
    var c = jobCost(e.wh, e.secs, pr, e.wh_peak);
    return "⚡ " + fmtWh(e.wh) + (c ? " · " + money(c.total, pr.currency) : "");
  }
  function badgeTitle(e, pr) {
    if (!e) return "";
    var dur = e.secs >= 90 ? Math.round(e.secs / 60) + " min" : (e.secs || 0) + " s";
    var c = jobCost(e.wh, e.secs, pr, e.wh_peak);
    return "Energy used: " + fmtWh(e.wh) + (e.cpu_measured ? " (GPU " + fmtWh(e.gpu_wh) + " + CPU " + fmtWh(e.cpu_wh) + ")" : e.gpu_measured ? " (the GPUs - the CPU is not measured on this computer)" : "")
      + "\nAverage " + (e.avg_w || 0) + " W" + (e.peak_w ? ", peak " + e.peak_w + " W" : "") + " over " + dur
      + (c && c.supply == null && c.peak == null ? "\nCost: " + money(c.energy, pr.currency) + " at " + money(pr.price_kwh, pr.currency) + " per kWh" : costLines(c, pr, e.wh));
  }
  var pure = { fmtWh: fmtWh, fmtMhz: fmtMhz, badgeText: badgeText, badgeTitle: badgeTitle, costOf: costOf, supplyOf: supplyOf, jobCost: jobCost, money: money, priceFrom: priceFrom };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var CPU = null, ENERGY = null;
  /** called by index.html's refreshStats after its own charts (Spark / Bar are the page's) */
  function paint(s, charts) {
    var P = s && s.power; if (!P || typeof Spark === "undefined") return;
    var box = document.getElementById("stats"); if (!box) return;
    (P.gpus || []).forEach(function (g) {
      var c = charts.gpus[g.index] || charts.gpus[0]; if (!c) return;
      if (!c.power && g.power_w != null) {
        c.power = new Spark("Power  0-" + Math.round(g.power_limit_w || 450) + " W", { color: "#e6c84a", fill: "rgba(230,200,74,.16)", lo: 0, hi: Math.max(50, g.power_limit_w || 450) });
        c.clock = new Spark("Clock  0-" + Math.round(g.max_clock_mhz || 3000) + " MHz", { color: "#9b7be6", fill: "rgba(155,123,230,.16)", lo: 0, hi: Math.max(500, g.max_clock_mhz || 3000) });
        var frame = c.vram && c.vram.el && c.vram.el.parentNode;
        if (frame) { frame.appendChild(c.power.el); frame.appendChild(c.clock.el); }
      }
      if (c.power && g.power_w != null) c.power.push(g.power_w, null, Math.round(g.power_w) + " W");
      if (c.clock && g.clock_mhz != null) c.clock.push(g.clock_mhz, null, fmtMhz(g.clock_mhz) + (g.mem_clock_mhz ? " · mem " + fmtMhz(g.mem_clock_mhz) : ""));
      if (c.head && g.power_w != null) c.head.textContent += " · " + Math.round(g.power_w) + " W · " + fmtMhz(g.clock_mhz);
    });
    if (!CPU) {
      CPU = { clock: new Spark("CPU clock", { color: "#9b7be6", fill: "rgba(155,123,230,.16)", lo: 0, hi: 6000 }), power: null };
      var ref = charts.cpuTemp && charts.cpuTemp.el; if (ref && ref.nextSibling) box.insertBefore(CPU.clock.el, ref.nextSibling); else box.appendChild(CPU.clock.el);
    }
    if (P.cpu_mhz) CPU.clock.push(P.cpu_mhz, null, fmtMhz(P.cpu_mhz)); else CPU.clock.value.textContent = "n/a";
    if (P.cpu_power_w != null) {
      if (!CPU.power) { CPU.power = new Spark("CPU power", { color: "#e6c84a", fill: "rgba(230,200,74,.16)", lo: 0, hi: 250 }); CPU.clock.el.after(CPU.power.el); }
      CPU.power.push(P.cpu_power_w, null, Math.round(P.cpu_power_w) + " W");
    }
    if (!ENERGY) { ENERGY = document.createElement("div"); ENERGY.className = "stat"; ENERGY.id = "statEnergy"; ENERGY.innerHTML = '<div class="row"><span>⚡ since start</span><b></b></div>'; box.appendChild(ENERGY); }
    var E = P.energy || {}, tot = (+E.gpu_wh || 0) + (+E.cpu_wh || 0), pr = price();
    var secs = E.since ? Math.max(0, (Date.now() - E.since) / 1000) : 0, c = jobCost(tot, secs, pr, E.peak_wh);
    ENERGY.querySelector("b").textContent = fmtWh(tot) + (c ? " · " + money(c.total, pr.currency) : "");
    ENERGY.title = "Energy used since the app started: GPUs " + fmtWh(E.gpu_wh || 0) + (E.cpu_wh != null ? ", CPU " + fmtWh(E.cpu_wh) : " (the CPU is not measured on this computer)")
      + costLines(c, pr, tot) + (pr.peak_price_kwh ? "\nNow: " + (E.peak_now ? "PEAK" : "off-peak") : "");
  }
  /* Settings -> General -> Energy cost: config.power {price_kwh, currency} */
  var PRICE = { price_kwh: 0, supply_day: 0, currency: "AUD" };
  function priceFrom(p) {
    p = p || {}; var v = +p.price_kwh, d = +p.supply_day, pk = +p.peak_price_kwh;
    var out = { price_kwh: v > 0 ? v : 0, supply_day: d > 0 ? d : 0, currency: p.currency || "AUD" };
    var w = (p.peak_windows || []).filter(function (x) { return x && x.from && x.to && x.from !== x.to && (x.days || []).length; });
    if (pk > 0 && w.length) { out.peak_price_kwh = pk; out.peak_windows = w; }
    return out;
  }
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  /** the peak times editor: one row per window - the days (Mon first), from, to, ✕ */
  function winRow(w) {
    var row = document.createElement("div"); row.className = "pkwin";
    row.style.cssText = "display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-top:4px";
    var days = (w && w.days) || [1, 2, 3, 4, 5];
    [1, 2, 3, 4, 5, 6, 0].forEach(function (d) {
      var l = document.createElement("label"); l.style.cssText = "display:inline-flex;gap:2px;align-items:center;font-size:.72rem";
      l.innerHTML = '<input type="checkbox" data-day="' + d + '"' + (days.indexOf(d) >= 0 ? " checked" : "") + ">" + DAYS[d];
      row.appendChild(l);
    });
    row.insertAdjacentHTML("beforeend", '<input type="time" data-k="from" value="' + ((w && w.from) || "07:00") + '" aria-label="Peak from" style="flex:none;width:auto">'
      + '<span class="hint">to</span><input type="time" data-k="to" value="' + ((w && w.to) || "22:00") + '" aria-label="Peak to" style="flex:none;width:auto">'
      + '<button type="button" class="ghost" data-k="x" title="Remove these peak times">✕</button>');
    return row;
  }
  function readWins(box) {
    return [].slice.call(box.querySelectorAll(".pkwin")).map(function (r) {
      return { days: [].slice.call(r.querySelectorAll("input[data-day]:checked")).map(function (c) { return +c.dataset.day; }),
               from: r.querySelector('[data-k="from"]').value, to: r.querySelector('[data-k="to"]').value };
    }).filter(function (x) { return x.days.length && x.from && x.to && x.from !== x.to; });
  }
  function price() {
    try { if (typeof cfg !== "undefined" && cfg && cfg.power) PRICE = priceFrom(cfg.power); } catch (e) { /* fine */ }
    return PRICE;
  }
  function priceSettings() {
    var k = document.getElementById("s_kwh"), cur = document.getElementById("s_kwhcur"), msg = document.getElementById("s_kwhmsg"), sd = document.getElementById("s_supply");
    var pkp = document.getElementById("s_peak"), pkw = document.getElementById("s_peakwin"), pka = document.getElementById("s_peakadd");
    if (!k || k._h3) return; k._h3 = true;
    var fill = function () {
      fetch("/api/config").then(function (r) { return r.json(); }).then(function (c) {
        var p = (c && c.power) || {};
        if (document.activeElement !== k) k.value = +p.price_kwh > 0 ? p.price_kwh : "";
        if (sd && document.activeElement !== sd) sd.value = +p.supply_day > 0 ? p.supply_day : "";
        if (pkp && document.activeElement !== pkp) pkp.value = +p.peak_price_kwh > 0 ? p.peak_price_kwh : "";
        if (pkw && !pkw.contains(document.activeElement)) { pkw.innerHTML = ""; (p.peak_windows || []).forEach(function (w) { pkw.appendChild(winRow(w)); }); }
        cur.value = p.currency || "AUD";
        PRICE = priceFrom(p);
      }).catch(function () { /* offline */ });
    };
    var t = null;
    var save = function () {
      var v = parseFloat(k.value), d = sd ? parseFloat(sd.value) : 0;
      var pv = pkp ? parseFloat(pkp.value) : 0;
      var b = { power: { price_kwh: v > 0 ? Math.min(100, v) : 0, supply_day: d > 0 ? Math.min(1000, d) : 0, currency: cur.value,
        peak_price_kwh: pv > 0 ? Math.min(100, pv) : 0, peak_windows: pkw ? readWins(pkw) : [] } };
      PRICE = priceFrom(b.power);
      try { if (typeof cfg !== "undefined" && cfg) cfg.power = b.power; } catch (e) { /* fine */ }
      fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })
        .then(function () { msg.textContent = (b.power.price_kwh > 0 ? "saved - 1 kWh = " + money(b.power.price_kwh, b.power.currency) : "saved - energy only")
          + (b.power.supply_day > 0 ? " + " + money(b.power.supply_day, b.power.currency) + " a day (" + money(round$(b.power.supply_day / 24), b.power.currency) + " an hour)" : "")
          + (b.power.peak_price_kwh > 0 ? (b.power.peak_windows.length ? " · peak " + money(b.power.peak_price_kwh, b.power.currency) + "/kWh in " + b.power.peak_windows.length + " time window(s), the rest off-peak" : " · add the peak times") : ""); }).catch(function () { msg.textContent = "could not save"; });
    };
    k.addEventListener("input", function () { clearTimeout(t); t = setTimeout(save, 400); });
    if (sd) sd.addEventListener("input", function () { clearTimeout(t); t = setTimeout(save, 400); });
    cur.addEventListener("change", save);
    if (pkp) pkp.addEventListener("input", function () { clearTimeout(t); t = setTimeout(save, 400); });
    if (pkw) { pkw.addEventListener("change", save); pkw.addEventListener("click", function (e) { if (e.target.dataset && e.target.dataset.k === "x") { e.target.closest(".pkwin").remove(); save(); } }); }
    if (pka) pka.onclick = function () { pkw.appendChild(winRow(null)); save(); };
    var os = document.getElementById("openSettings"); if (os) os.addEventListener("click", function () { setTimeout(fill, 60); });
    fill();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", priceSettings); else setTimeout(priceSettings, 0);
  /** a finished job's card: ⚡ its energy (+ its cost) */
  function badge(e) {
    var pr = price(), t = badgeText(e, pr); if (!t) return null;
    var b = document.createElement("span"); b.className = "jenergy"; b.textContent = t; b.title = badgeTitle(e, pr);
    b.style.cssText = "font-size:.66rem;color:var(--dim);margin-left:6px;white-space:nowrap";
    return b;
  }
  root.H3Power = Object.assign({ paint: paint, badge: badge, price: price }, pure);
})(typeof window !== "undefined" ? window : globalThis);
