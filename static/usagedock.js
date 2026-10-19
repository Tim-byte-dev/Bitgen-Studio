/* bitGen Studio — static/usagedock.js (2.520.0): 📊 ENERGY USAGE, a floating docker (window.H3Usage).
 * Tim (verbatim): "keep a detailed list of usage the the user can review"
 *   Settings -> General -> Energy cost -> 📊 Usage… (or a click on "⚡ since start" in the System stats) shows it
 *   RANGE    today / 7 days / this month / last month / everything / from - to
 *   TOTALS   the bill for the range (all the energy while the app ran + the daily supply charge for each day + the
 *            remote GPU), kWh peak / off-peak, the jobs' share and cost, the app's hours
 *   DAYS     one row a day: kWh (peak / off-peak), the jobs' kWh, hours, energy cost, supply, remote, total
 *   JOBS     every finished job: when, mode, what, status, minutes, kWh (peak), its cost (energy + its supply share),
 *            the remote GPU and its cost, the prompt on hover
 *   ⤓ CSV    the days or the jobs for a spreadsheet (lib/usageLog.toCsv)
 * Pure (Node: scripts/test-usage520.js): rangeOf, kwh, hours.
 */
(function (root) {
  "use strict";
  function pad(n) { return String(n).padStart(2, "0"); }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  /** a named range -> {from, to} (dates as YYYY-MM-DD; "" = open) */
  function rangeOf(name, now) {
    var d = now ? new Date(now) : new Date();
    if (name === "today") return { from: ymd(d), to: ymd(d) };
    if (name === "week") { var a = new Date(d); a.setDate(a.getDate() - 6); return { from: ymd(a), to: ymd(d) }; }
    if (name === "month") return { from: d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-01", to: ymd(d) };
    if (name === "last") { var f = new Date(d.getFullYear(), d.getMonth() - 1, 1), t = new Date(d.getFullYear(), d.getMonth(), 0); return { from: ymd(f), to: ymd(t) }; }
    return { from: "", to: "" };
  }
  function kwh(wh) { var k = (+wh || 0) / 1000; return k >= 10 ? k.toFixed(1) : k >= 0.1 ? k.toFixed(2) : k.toFixed(3); }
  function hours(s) { var h = (+s || 0) / 3600; return h >= 10 ? h.toFixed(0) : h.toFixed(1); }
  var pure = { rangeOf: rangeOf, kwh: kwh, hours: hours };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var CSS = ".usd{display:flex;flex-direction:column;gap:6px;height:100%;min-height:0;font-size:.76rem}"
    + ".usd .ubar{display:flex;gap:4px;align-items:center;flex-wrap:wrap}.usd .ubar button.on{border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c)}"
    + ".usd .utot{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px}"
    + ".usd .ucard{border:1px solid var(--line,#3a342a);border-radius:7px;padding:6px 8px;background:var(--panel,#1b1814)}.usd .ucard b{display:block;font-size:1rem;color:var(--text,#eee)}.usd .ucard span{color:var(--dim,#999);font-size:.68rem}"
    + ".usd .uwrap{flex:1;min-height:0;overflow:auto;border:1px solid var(--line,#3a342a);border-radius:6px}"
    + ".usd table{border-collapse:collapse;width:100%}.usd th,.usd td{padding:3px 6px;border-bottom:1px solid rgba(255,255,255,.05);text-align:right;white-space:nowrap}"
    + ".usd th{position:sticky;top:0;background:var(--panel,#1b1814);color:var(--dim,#999);font-weight:600}.usd td.l,.usd th.l{text-align:left}"
    + ".usd tr.failed td{color:#e88}.usd tr.cancelled td{color:var(--dim,#999)}.usd .unote{color:var(--dim,#999);font-size:.7rem}";
  var S = { range: "month", from: "", to: "", tab: "days", data: null };
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function money(c, cur) { return root.H3Power && H3Power.money ? (c == null ? "" : H3Power.money(c, cur)) : (c == null ? "" : c.toFixed(2)); }
  function qs() { var r = S.range === "custom" ? { from: $("usFrom").value, to: $("usTo").value } : rangeOf(S.range); return "from=" + encodeURIComponent(r.from || "") + "&to=" + encodeURIComponent(r.to || ""); }
  function load() {
    return fetch("/api/usage?" + qs()).then(function (r) { return r.json(); }).then(function (d) { if (!d || !d.totals || !Array.isArray(d.days)) return d; S.data = d; paint(); return d; }).catch(function () { /* offline */ });
  }
  function paint() {
    var d = S.data; if (!d || !$("usBody")) return;
    document.querySelectorAll(".usd [data-urange]").forEach(function (b) { b.classList.toggle("on", b.dataset.urange === S.range); });
    document.querySelectorAll(".usd [data-utab]").forEach(function (b) { b.classList.toggle("on", b.dataset.utab === S.tab); });
    var t = d.totals, cur = t.currency;
    $("usTot").innerHTML = [
      ["Bill for the range", money(t.bill, cur), "energy " + money(t.day_energy_cost, cur) + " + supply " + money(t.supply, cur) + (t.remote_cost ? " + remote " + money(t.remote_cost, cur) : "")],
      ["Energy while the app ran", kwh(t.day_wh) + " kWh", "peak " + kwh(t.day_wh_peak) + " · off-peak " + kwh(t.day_wh - t.day_wh_peak)],
      ["Jobs", t.jobs, hours(t.job_secs) + " h of work"],
      ["The jobs' energy", kwh(t.job_wh) + " kWh", "cost " + money(t.job_cost, cur) + " (with their supply share)"],
      ["Days", t.days, "the app ran on these days"],
    ].map(function (c) { return '<div class="ucard"><span>' + esc(c[0]) + "</span><b>" + esc(c[1]) + "</b><span>" + esc(c[2]) + "</span></div>"; }).join("");
    var w = $("usWrap");
    if (S.tab === "days") {
      w.innerHTML = d.days.length ? "<table><thead><tr><th class=\"l\">Day</th><th>kWh</th><th>peak</th><th>off-peak</th><th>jobs</th><th>jobs kWh</th><th>app h</th><th>energy</th><th>supply</th><th>remote</th><th>total</th></tr></thead><tbody>"
        + d.days.slice().reverse().map(function (x) {
          return "<tr><td class=\"l\">" + esc(x.day) + "</td><td>" + kwh(x.wh) + "</td><td>" + kwh(x.wh_peak) + "</td><td>" + kwh(x.wh - x.wh_peak) + "</td><td>" + x.jobs + "</td><td>" + kwh(x.wh_jobs) + "</td><td>" + hours(x.secs)
            + "</td><td>" + money(x.cost_energy, cur) + "</td><td>" + money(x.supply, cur) + "</td><td>" + (x.remote_cost ? money(x.remote_cost, cur) : "") + "</td><td><b>" + money(x.total, cur) + "</b></td></tr>";
        }).join("") + "</tbody></table>" : '<div class="unote" style="padding:8px">Nothing for this range yet - the app adds the day every 5 minutes while it runs.</div>';
    } else {
      w.innerHTML = d.jobs.length ? "<table><thead><tr><th class=\"l\">Finished</th><th class=\"l\">Mode</th><th class=\"l\">What</th><th class=\"l\">Status</th><th>min</th><th>kWh</th><th>peak kWh</th><th>avg W</th><th>cost</th><th class=\"l\">remote</th></tr></thead><tbody>"
        + d.jobs.map(function (j) {
          var e = j.energy || {}, c = j.cost || {};
          var tip = (j.prompt || "") + (c.total != null ? "\nenergy " + money(c.energy, c.currency) + (c.peak != null ? " (peak " + money(c.peak, c.currency) + ", off-peak " + money(c.offpeak, c.currency) + ")" : "") + (c.supply != null ? " + supply share " + money(c.supply, c.currency) : "") : "");
          return '<tr class="' + esc(j.status) + '" title="' + esc(tip) + '"><td class="l">' + esc(new Date(j.t).toLocaleString()) + '</td><td class="l">' + esc(j.mode) + '</td><td class="l">' + esc(j.what || (j.prompt || "").slice(0, 40)) + '</td><td class="l">' + esc(j.status)
            + "</td><td>" + (j.secs / 60).toFixed(1) + "</td><td>" + (e.wh != null ? kwh(e.wh) : "-") + "</td><td>" + (e.wh_peak != null ? kwh(e.wh_peak) : "") + "</td><td>" + (e.avg_w || "")
            + "</td><td><b>" + (c.total != null ? money(c.total, c.currency) : "") + '</b></td><td class="l">' + esc(j.remote ? j.remote.label + (j.remote.cost ? " " + money(j.remote.cost, "USD") : "") : "") + "</td></tr>";
        }).join("") + "</tbody></table>" : '<div class="unote" style="padding:8px">No finished jobs in this range.</div>';
    }
    $("usCsv").href = "/api/usage/csv?kind=" + S.tab + "&" + qs();
  }
  function build() {
    var b = document.createElement("div"); b.className = "usd"; b.id = "usBody";
    b.innerHTML = '<div class="ubar">' + [["today", "Today"], ["week", "7 days"], ["month", "This month"], ["last", "Last month"], ["all", "Everything"], ["custom", "From - to"]].map(function (r) {
        return '<button type="button" class="ghost" data-urange="' + r[0] + '">' + r[1] + "</button>"; }).join("")
      + '<input type="date" id="usFrom" aria-label="From" style="display:none"><input type="date" id="usTo" aria-label="To" style="display:none">'
      + '<button type="button" class="ghost" id="usRefresh" title="Read again" style="margin-left:auto">⟳</button></div>'
      + '<div class="utot" id="usTot"></div>'
      + '<div class="ubar"><button type="button" class="ghost" data-utab="days">Days</button><button type="button" class="ghost" data-utab="jobs">Jobs</button>'
      + '<a id="usCsv" class="ghost" download style="margin-left:auto;text-decoration:none;padding:3px 8px;border:1px solid var(--line,#444);border-radius:5px;color:inherit">⤓ CSV</a></div>'
      + '<div class="uwrap" id="usWrap"></div>'
      + '<div class="unote">The energy is what this computer\'s meters read (the graphics cards + the CPU where it can be read) - while the app runs, other programs using them are counted too. Prices: Settings ▸ General ▸ Energy cost; a job keeps the prices of the moment it ended.</div>';
    return b;
  }
  function show(on) { return window.SecFloat && SecFloat.show ? SecFloat.show("usage", on) : false; }
  function start() {
    if (!window.SecFloat || !SecFloat.add || !SecFloat.started) { setTimeout(start, 150); return; }
    if ($("usBody")) return;
    if (!$("usCss")) { var st = document.createElement("style"); st.id = "usCss"; st.textContent = CSS; document.head.appendChild(st); }
    SecFloat.add({ id: "usage", title: "Energy usage", w: 820, h: 560, body: build(), onShow: function () { load(); } });
    document.querySelectorAll(".usd [data-urange]").forEach(function (b) { b.onclick = function () { S.range = b.dataset.urange; var c = S.range === "custom"; $("usFrom").style.display = $("usTo").style.display = c ? "" : "none"; load(); }; });
    document.querySelectorAll(".usd [data-utab]").forEach(function (b) { b.onclick = function () { S.tab = b.dataset.utab; paint(); }; });
    $("usFrom").onchange = $("usTo").onchange = load; $("usRefresh").onclick = load;
    var bt = $("s_usage"); if (bt) bt.onclick = function () { var d = $("settings"); if (d && d.open) d.close(); show(true); };
    // a click on "⚡ since start" (System stats) opens it too
    document.addEventListener("click", function (e) { var el = e.target.closest && e.target.closest("#statEnergy"); if (el) show(true); });
  }
  root.H3Usage = Object.assign({ load: load, show: show, state: function () { return S; } }, pure);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
