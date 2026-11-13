/* bitGen Studio — static/runpoddock.js (2.763.5; 2.771.0 THE 💲 COSTS DOCKER): what everything costs - this computer and every
 * platform on its own - and RunPod's balance, its pods' bill and its GPU prices.
 * window.H3RunPod (+ require() in Node for the pure part).
 *
 * Tim (verbatim, 2.763.5): "make a new docker for runpod prices and move runpod balance and usage costs from the basic settings
 * docker to the runpod docker"
 * Tim (verbatim, 2.771.0): "change the runpod docker to Costs, show all costs summary, if user clicks on one of the costs open a
 * detailed lists of expenditure for that platform or local" + "Costs Docker should include local costs and all the diferent
 * platform costs individually" + "add a tab for statistics … statistics go is Statistics Dialog"
 *
 *   A docker of its own (static/secfloat.js id "runpod" - it floats, docks beside / inside another docker, goes in a ▣ docker):
 *   ALL COSTS  Today / 7 days / This month / Last month / Everything: one row each - 🖥 This computer (electricity + the supply
 *              charge), ☁ RunPod (pods + Serverless), 🧠 OpenRouter, 🔑 each Settings ▸ API service, 🌐 a remote GPU with a
 *              $/hour - and the total (GET /api/costs - lib/costs.js). A row clicked = its detailed list (GET /api/costs/:id):
 *                This computer   day by day (kWh, energy, supply) and every job it ran (minutes, kWh, cost)
 *                RunPod          Balance, Usage (each pod today / this month), By day, Serverless, GPU prices (below)
 *                OpenRouter      its own figures for the key (today / this week / this month / since it was made, the limit
 *                                left) + bitGen's calls by model and one by one (tokens, the cost OpenRouter reported)
 *                an API service  its renders (when, what, how long, the price the service gave) + its LLM calls
 *                Remote GPU      day by day (hours, cost)
 *              ← All costs goes back. 📊 Statistics opens the Statistics dialog (static/statsdlg.js).
 *   RunPod's parts (2.763.5):
 *     Balance    what is on the RunPod account, what it spends now ($/h), how long the balance lasts at that, the spend
 *                limit (GET /api/pods/account - lib/runpodAccount.js, RunPod's GraphQL "myself")
 *     Usage      the pods running now and their $/h, today, this month, and each pod's today / month (GET /api/pods/costs -
 *                lib/podCosts.js, RunPod's own bill)
 *     GPU prices every GPU RunPod rents pods on, Secure or Community cloud: memory, $/h, how many are free now, the most
 *                one pod can have (GET /api/pods/gpus); search it, sort it by price / memory / name
 *   Opened by 💲 Costs in the ☁ Remote generation docker and the PODS docker (straight to RunPod's list), Settings ▸ General ▸
 *   Energy cost and the System stats' 💲 (all costs); asked again every minute while it shows, 🔄 at once. US-dollar prices in
 *   your currency (static/currency.js H3Money); this computer's in the energy bill's currency.
 * Pure (Node: scripts/test-runpoddock7635.js, scripts/test-costs771.js): availWord, lastsText, sortGpus, filterGpus, podRows,
 *   RANGE_NAMES, durText, kwhText.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const AVAIL = { HIGH: "plenty free", MEDIUM: "some free", LOW: "few free", NONE: "none free" };
  /** RunPod's availability word -> what it means to a person */
  function availWord(a) { return AVAIL[String(a || "").toUpperCase()] || "not said"; }
  /** hours the balance lasts -> words ("" = nothing is spending) */
  function lastsText(h) {
    if (h == null || !isFinite(+h)) return "";
    h = +h;
    if (h < 1) return "less than an hour";
    if (h < 48) return "about " + Math.round(h) + " h";
    return "about " + Math.round(h / 24) + " days";
  }
  /** GPUs in the order asked: price (cheapest first, none free last), memory (most first), name */
  function sortGpus(list, by) {
    const l = (list || []).slice();
    const name = (a, b) => String(a.name).localeCompare(String(b.name));
    if (by === "memory") return l.sort((a, b) => (b.memory - a.memory) || (a.price - b.price) || name(a, b));
    if (by === "name") return l.sort(name);
    return l.sort((a, b) => ((b.offered ? 1 : 0) - (a.offered ? 1 : 0)) || (a.price - b.price) || name(a, b));
  }
  /** GPUs whose name / id / memory match every word typed */
  function filterGpus(list, q) {
    const words = String(q || "").toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return (list || []).slice();
    return (list || []).filter((g) => { const t = (g.name + " " + g.id + " " + g.memory + "gb").toLowerCase(); return words.every((w) => t.includes(w)); });
  }
  /** the usage table: every pod RunPod has, with what it cost today / this month (pods in the bill but gone too) */
  function podRows(mine, cost) {
    const by = (cost && cost.pods) || {}, seen = {}, out = [];
    for (const p of mine || []) {
      seen[p.id] = true;
      const c = by[p.id] || { today: 0, month: 0 };
      out.push({ id: p.id, name: p.name || p.id, status: String(p.status || ""), hr: /RUNNING|STARTING|PROVISIONING/.test(p.status) ? +p.cost_hr || 0 : 0, today: +c.today || 0, month: +c.month || 0 });
    }
    for (const id of Object.keys(by)) if (id && !seen[id] && (by[id].month || by[id].today)) out.push({ id, name: id, status: "GONE", hr: 0, today: +by[id].today || 0, month: +by[id].month || 0 });
    return out.sort((a, b) => (b.hr - a.hr) || (b.month - a.month));
  }
  /* 2.771.0 */
  const RANGE_NAMES = [["today", "Today"], ["week", "7 days"], ["month", "This month"], ["last", "Last month"], ["all", "Everything"]];
  /** milliseconds -> "850 ms" / "42 s" / "3 min 5 s" / "1 h 12 min" */
  function durText(ms) {
    const v = Math.max(0, Math.round(+ms || 0));
    if (v < 1000) return v + " ms";
    const s = Math.round(v / 1000);
    if (s < 60) return s + " s";
    const m = Math.floor(s / 60);
    if (m < 60) return m + " min" + (s % 60 ? " " + (s % 60) + " s" : "");
    return Math.floor(m / 60) + " h" + (m % 60 ? " " + (m % 60) + " min" : "");
  }
  /** watt-hours -> kWh words */
  function kwhText(wh) { const k = (+wh || 0) / 1000; return (k >= 10 ? k.toFixed(1) : k >= 0.1 ? k.toFixed(2) : k.toFixed(3)) + " kWh"; }
  const api = { availWord, lastsText, sortGpus, filterGpus, podRows, RANGE_NAMES, durText, kwhText };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }

  /* ================================ the page ================================ */
  const doc = root.document;
  const $ = (id) => doc.getElementById(id);
  const S = { acct: null, cost: null, mine: [], gpus: {}, cloud: "SECURE", by: "price", q: "", g: null, timer: null, at: 0,
    range: "month", sum: null, view: "", det: null };
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const getj = (u) => root.fetch(u).then((r) => r.json());
  const money = (v, sfx) => (root.H3Money ? root.H3Money.usdHtml(v, sfx) : esc("$" + (+v || 0).toFixed(2) + (sfx || "")));
  /** an amount in the energy bill's currency (this computer, the totals) */
  const bill = (v, cur) => (v == null ? "" : esc(root.H3Power && H3Power.money ? H3Power.money(+v || 0, cur) : (+v || 0).toFixed(2) + " " + (cur || "")));
  const gb = (n) => (n ? n + " GB" : "");
  const when = (t) => (t ? new Date(t).toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
  const CSS = ".rpk{display:flex;flex-direction:column;gap:10px;padding:8px 10px;font-size:12.5px}"
    + ".rpk h4{margin:0 0 4px;font-size:12px;color:var(--dim,#9a917f);font-weight:600}"
    + ".rpk .rpBal{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}.rpk .rpBig{font-size:24px;font-weight:700;color:var(--text,#e8e2d6)}"
    + ".rpk .rpBal.low .rpBig{color:#e88}.rpk .rpKv{display:grid;grid-template-columns:auto 1fr;gap:2px 12px}.rpk .rpKv .k{color:var(--dim,#9a917f)}"
    + ".rpk table{width:100%;border-collapse:collapse}.rpk th,.rpk td{text-align:left;padding:3px 6px;border-bottom:1px solid var(--line,#3a342a);white-space:nowrap}"
    + ".rpk th{color:var(--dim,#9a917f);font-weight:600;position:sticky;top:0;background:var(--panel,#1c1915)}.rpk td.n,.rpk th.n{text-align:right}"
    + ".rpk tr.off td{opacity:.5}.rpk .rpGpus{max-height:360px;overflow:auto}.rpk .rpErr{color:#e88}.rpk .rpRow{display:flex;gap:6px;align-items:center;flex-wrap:wrap}"
    + ".rpk .rpAv{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;background:#777}.rpk .rpAv.HIGH{background:#5c5}.rpk .rpAv.MEDIUM{background:#cc5}.rpk .rpAv.LOW{background:#d84}.rpk .rpAv.NONE{background:#844}"
    // 2.771.0: all costs + the detailed lists
    + ".rpk .cdRanges button.on{border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c)}"
    + ".rpk #cdSum tbody tr{cursor:pointer}.rpk #cdSum tbody tr:hover td,.rpk #cdSum tbody tr:focus td{background:rgba(245,158,44,.10)}.rpk #cdSum td.ic{width:22px;text-align:center}"
    + ".rpk #cdSum td .sub{display:block;color:var(--dim,#9a917f);font-size:11px;white-space:normal}.rpk #cdSum tfoot td{font-weight:700;border-bottom:0}.rpk #cdSum td.cdGo{color:var(--dim,#9a917f);width:14px}"
    + ".rpk .cdList{max-height:340px;overflow:auto}.rpk .cdHead{display:flex;gap:8px;align-items:center}.rpk .cdHead h4{margin:0;font-size:14px;color:var(--text,#e8e2d6)}"
    + ".rpk tr.failed td{color:#e88}.rpk tr.cancelled td{color:var(--dim,#9a917f)}";

  function body() {
    const d = doc.createElement("div"); d.className = "rpk"; d.id = "rpBody";
    d.innerHTML = '<div class="rpRow"><span class="rpRow cdRanges" role="group" aria-label="Which days">' + RANGE_NAMES.map((r) => '<button type="button" class="ghost" data-cdrange="' + r[0] + '">' + r[1] + "</button>").join("") + "</span>"
      + '<button type="button" class="ghost" id="cdStats" title="📊 Statistics: how long each generation took to start and to render, and each pod preparation" style="margin-left:auto">📊 Statistics</button>'
      + '<button type="button" class="ghost" id="rpRefresh" title="Ask again now">🔄</button></div>'
      + '<div class="rpRow"><span class="hint" id="rpAt" aria-live="polite" style="flex:1"></span></div>'
      // ---- all costs
      + '<section id="cdSumView" aria-labelledby="cdH1"><h4 id="cdH1">All costs</h4><div id="cdSumBox"></div>'
      + '<div class="hint">Click a row for its detailed list. US-dollar prices show in your currency (Settings ▸ General ▸ Currency); the total is in your energy bill\'s currency (Settings ▸ General ▸ Energy cost).</div></section>'
      // ---- one platform's list
      + '<section id="cdDetView" hidden><div class="cdHead"><button type="button" class="ghost" id="cdBack" title="Back to all costs">← All costs</button><h4 id="cdDetTitle"></h4></div>'
      + '<div id="cdDet" style="margin-top:8px"></div>'
      + '<div id="cdRunpod" hidden>'
      + '<section aria-labelledby="rpH1"><h4 id="rpH1">Balance</h4><div id="rpBal"></div></section>'
      + '<section aria-labelledby="rpH2"><h4 id="rpH2">Usage</h4><div id="rpUse"></div></section>'
      + '<section aria-labelledby="rpH4"><h4 id="rpH4">By day</h4><div id="rpDays"></div></section>'
      + '<section aria-labelledby="rpH3"><h4 id="rpH3">GPU prices</h4>'
      + '<div class="rpRow"><select id="rpCloud" title="Secure cloud = RunPod\'s data centres; Community cloud = vetted hosts, cheaper" style="width:auto"><option value="SECURE">Secure cloud</option><option value="COMMUNITY">Community cloud</option></select>'
      + '<select id="rpSort" title="The order of the list" style="width:auto"><option value="price">Cheapest first</option><option value="memory">Most memory first</option><option value="name">By name</option></select>'
      + '<input type="search" id="rpQ" placeholder="Find a GPU - 4090, 48gb, H100" spellcheck="false" style="flex:1;min-width:120px"></div>'
      + '<div class="rpGpus" id="rpGpus"></div></section></div></section>';
    return d;
  }
  /* ---------------- all costs */
  function paintSum() {
    const el = $("cdSumBox"); if (!el) return;
    doc.querySelectorAll(".rpk [data-cdrange]").forEach((b) => { const on = b.dataset.cdrange === S.range; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
    const s = S.sum;
    if (!s) { el.innerHTML = '<span class="hint">adding up…</span>'; return; }
    if (s.error) { el.innerHTML = '<span class="rpErr">' + esc(s.error) + "</span>"; return; }
    el.innerHTML = '<table id="cdSum"><thead><tr><th></th><th>Where</th><th class="n">Cost</th><th></th></tr></thead><tbody>'
      + s.rows.map((r) => '<tr data-cdrow="' + esc(r.id) + '" tabindex="0" title="Its detailed list"><td class="ic">' + esc(r.icon) + "</td><td><b>" + esc(r.name) + '</b><span class="sub">' + esc(r.sub || "")
        + (r.note ? " - " + esc(r.note) : "") + (r.error ? ' <span class="rpErr">' + esc(r.error) + "</span>" : "") + '</span></td><td class="n">' + (r.usd != null ? money(r.usd) : bill(r.cost, r.currency || s.currency)) + '</td><td class="cdGo" aria-hidden="true">›</td></tr>').join("")
      + '</tbody><tfoot><tr><td></td><td>Total</td><td class="n" id="cdTotal">' + bill(s.total, s.currency) + "</td><td></td></tr></tfoot></table>";
  }
  function loadSum(refresh) {
    return getj("/api/costs?range=" + S.range + (refresh ? "&refresh=1" : "")).then((j) => { S.sum = j && j.rows ? j : { error: (j && j.error) || "the costs could not be added up" }; paintSum(); })
      .catch(() => { S.sum = { error: "bitGen could not be asked" }; paintSum(); });
  }
  /* ---------------- one platform's list */
  const TITLES = { local: "🖥 This computer", runpod: "☁ RunPod", openrouter: "🧠 OpenRouter", remote: "🌐 Remote GPU" };
  function titleOf(id) { if (TITLES[id]) return TITLES[id]; const r = ((S.sum && S.sum.rows) || []).find((x) => x.id === id); return r ? r.icon + " " + r.name : id; }
  function tbl(id, head, rows) { return rows.length ? '<div class="cdList"><table id="' + id + '"><thead><tr>' + head.map((h) => '<th' + (h[1] ? ' class="n"' : "") + ">" + esc(h[0]) + "</th>").join("") + "</tr></thead><tbody>" + rows.join("") + "</tbody></table></div>" : '<span class="hint">nothing in these days</span>'; }
  function callsHtml(own, calls) {
    return "<h4>By model</h4>" + tbl("cdModels", [["Model"], ["Calls", 1], ["Tokens in", 1], ["Tokens out", 1], ["Cost", 1]],
      own.by_model.map((m) => "<tr><td>" + esc(m.model) + '</td><td class="n">' + m.count + '</td><td class="n">' + m.in + '</td><td class="n">' + m.out + '</td><td class="n">' + money(m.cost) + "</td></tr>"))
      + '<h4 style="margin-top:8px">Each call</h4>' + tbl("cdCalls", [["When"], ["Model"], ["For"], ["Tokens in", 1], ["Tokens out", 1], ["Cost", 1]],
        calls.map((c) => "<tr><td>" + esc(when(c.t)) + "</td><td>" + esc(c.model) + "</td><td>" + esc(c.kind === "vlm" ? "vision" : "LLM") + '</td><td class="n">' + c.in + '</td><td class="n">' + c.out + '</td><td class="n">' + (c.cost != null ? money(c.cost) : "-") + "</td></tr>"))
      + (own.count > own.priced ? '<div class="hint">"-" = the service did not say what that call cost (a free model, or one that reports no price).</div>' : "");
  }
  function paintDet() {
    const el = $("cdDet"), id = S.view; if (!el || !id) return;
    $("cdDetTitle").textContent = titleOf(id) + " - " + (RANGE_NAMES.find((r) => r[0] === S.range) || ["", ""])[1].toLowerCase();
    $("cdRunpod").hidden = id !== "runpod";
    const d = S.det;
    if (!d || d.id !== id) { el.innerHTML = '<span class="hint">reading…</span>'; return; }
    if (d.error) { el.innerHTML = '<span class="rpErr">' + esc(d.error) + "</span>"; return; }
    const cur = d.currency;
    if (id === "local") {
      el.innerHTML = '<div class="rpKv" id="cdLocalTot"><span class="k">Energy</span><span><b>' + bill(d.energy, cur) + "</b> · " + esc(kwhText(d.wh)) + '</span><span class="k">Supply charge</span><span><b>' + bill(d.supply, cur)
        + '</b></span><span class="k">Together</span><span><b>' + bill(d.cost, cur) + "</b></span></div>"
        + '<h4 style="margin-top:8px">By day</h4>' + tbl("cdLocalDays", [["Day"], ["kWh", 1], ["Jobs", 1], ["App hours", 1], ["Energy", 1], ["Supply", 1], ["Total", 1]],
          d.days.slice().reverse().map((x) => "<tr><td>" + esc(x.day) + '</td><td class="n">' + esc(kwhText(x.wh).replace(" kWh", "")) + '</td><td class="n">' + (x.jobs || 0) + '</td><td class="n">' + ((x.secs || 0) / 3600).toFixed(1) + '</td><td class="n">' + bill(x.energy, cur) + '</td><td class="n">' + bill(x.supply, cur) + '</td><td class="n"><b>' + bill(x.total, cur) + "</b></td></tr>"))
        + '<h4 style="margin-top:8px">Jobs on this computer</h4>' + tbl("cdLocalJobs", [["Finished"], ["Mode"], ["What"], ["Status"], ["Minutes", 1], ["kWh", 1], ["Cost", 1]],
          d.jobs.map((j) => '<tr class="' + esc(j.status) + '"><td>' + esc(when(j.t)) + "</td><td>" + esc(j.mode) + "</td><td>" + esc(j.what) + "</td><td>" + esc(j.status) + '</td><td class="n">' + ((j.secs || 0) / 60).toFixed(1) + '</td><td class="n">' + (j.wh != null ? esc(kwhText(j.wh).replace(" kWh", "")) : "-") + '</td><td class="n">' + (j.cost != null ? bill(j.cost, cur) : "") + "</td></tr>"))
        + '<div class="hint">This computer\'s meters while the app ran (the graphics cards + the CPU where it can be read) at the prices in Settings ▸ General ▸ Energy cost - 📊 Usage there has the same days.</div>';
    } else if (id === "runpod") {
      el.innerHTML = "";
      const dl = $("rpDays");
      if (dl) dl.innerHTML = tbl("cdRpDays", [["Day"], ["Pods", 1], ["Serverless", 1], ["Together", 1]],
        (d.days || []).map((x) => "<tr><td>" + esc(x.day) + '</td><td class="n">' + money(x.pods_usd) + '</td><td class="n">' + (x.sls_usd ? money(x.sls_usd) : "-") + '</td><td class="n"><b>' + money(x.pods_usd + x.sls_usd) + "</b></td></tr>"))
        + (d.serverless && d.serverless.error ? '<div class="rpErr">' + esc(d.serverless.error) + "</div>" : d.serverless ? '<div class="hint">Serverless endpoints this month: ' + money(d.serverless.month_usd) + "</div>" : "")
        + '<div class="hint">The days bitGen kept of RunPod\'s bill (asked while bitGen runs). runpod.io ▸ Billing has every invoice.</div>';
    } else if (id === "openrouter") {
      const k = d.key;
      el.innerHTML = (k && k.error ? '<div class="rpErr">' + esc(k.error) + "</div>" : k ? '<div class="rpKv" id="cdOrKey"><span class="k">Today (UTC)</span><span><b>' + money(k.usage_daily) + '</b></span><span class="k">This week (UTC)</span><span><b>' + money(k.usage_weekly)
        + '</b></span><span class="k">This month (UTC)</span><span><b>' + money(k.usage_monthly) + '</b></span><span class="k">Since the key was made</span><span><b>' + money(k.usage) + "</b></span>"
        + (k.limit != null ? '<span class="k">Limit left</span><span>' + money(k.limit_remaining) + " of " + money(k.limit) + "</span>" : "") + (k.is_free_tier ? '<span class="k">Account</span><span>free tier (no credits bought)</span>' : "") + "</div>"
        + '<div class="hint">OpenRouter\'s own figures for the API key in Settings ▸ Remote generation - every use of that key, from bitGen or not.</div>' : '<span class="hint">No OpenRouter API key in Settings ▸ Remote generation - only bitGen\'s own record below.</span>')
        + '<h4 style="margin-top:8px">bitGen\'s calls: ' + d.own.count + " · " + money(d.own.cost) + "</h4>" + callsHtml(d.own, d.calls);
    } else if (/^api:/.test(id)) {
      el.innerHTML = "<h4>Renders</h4>" + tbl("cdApiJobs", [["Finished"], ["Mode"], ["What"], ["Status"], ["Took", 1], ["Price", 1]],
        d.jobs.map((j) => '<tr class="' + esc(j.status) + '"><td>' + esc(when(j.t)) + "</td><td>" + esc(j.mode) + "</td><td>" + esc(j.what) + "</td><td>" + esc(j.status) + '</td><td class="n">' + esc(durText(j.total_ms)) + '</td><td class="n">' + (j.usd != null ? money(j.usd) : "-") + "</td></tr>"))
        + '<div class="hint">"-" = the service gave no price for that render - its own site\'s billing page has it.</div>'
        + (d.own.count ? '<h4 style="margin-top:8px">LLM calls: ' + d.own.count + " · " + money(d.own.cost) + "</h4>" + callsHtml(d.own, d.calls) : "");
    } else if (id === "remote") {
      el.innerHTML = tbl("cdRemoteDays", [["Day"], ["Hours", 1], ["Cost", 1]], d.days.map((x) => "<tr><td>" + esc(x.day) + '</td><td class="n">' + ((x.secs || 0) / 3600).toFixed(1) + '</td><td class="n">' + bill(x.cost, cur) + "</td></tr>"))
        + '<div class="hint">The time bitGen used the remote GPU at the $/hour set in Settings ▸ Remote generation.</div>';
    }
  }
  function loadDet(refresh) {
    const id = S.view; if (!id) return Promise.resolve();
    return getj("/api/costs/" + encodeURIComponent(id) + "?range=" + S.range + (refresh ? "&refresh=1" : "")).then((j) => { if (S.view !== id) return; S.det = Object.assign({ id }, j || {}); paintDet(); })
      .catch(() => { S.det = { id, error: "bitGen could not be asked" }; paintDet(); });
  }
  /** a platform's list ("" = all costs) */
  function open(id) {
    S.view = String(id || ""); S.det = null;
    $("cdSumView").hidden = !!S.view; $("cdDetView").hidden = !S.view;
    if (S.view) { paintDet(); loadDet(false); if (S.view === "runpod") { paintRp(); load(false); loadGpus(false); } }
    else { paintSum(); }
    if (S.view && $("cdBack")) { try { $("cdBack").focus({ preventScroll: true }); } catch (e) { /* fine */ } }
  }
  /* ---------------- RunPod's parts (2.763.5) */
  function paintBal() {
    const el = $("rpBal"); if (!el) return;
    const a = S.acct;
    if (!a) { el.innerHTML = '<span class="hint">asking RunPod…</span>'; return; }
    if (a.balance == null) { el.innerHTML = '<span class="rpErr">' + esc(a.error || "no balance yet") + "</span>"; return; }
    const low = a.under || (a.lasts_hr != null && a.lasts_hr < 24);
    el.innerHTML = '<div class="rpBal' + (low ? " low" : "") + '"><span class="rpBig" id="rpBalance">' + money(a.balance) + "</span>"
      + '<span>spending <b id="rpSpend">' + money(a.spend_hr, "/h") + "</b> now"
      + (a.lasts_hr != null ? ' · lasts <b id="rpLasts">' + esc(lastsText(a.lasts_hr)) + "</b> at that" : "") + "</span></div>"
      + (a.spend_limit != null ? '<div class="hint">Spend limit ' + money(a.spend_limit, "/h") + " (RunPod ▸ Settings)</div>" : "")
      + (low ? '<div class="rpErr">The balance is running low - add credit on runpod.io ▸ Billing, or pods stop when it runs out.</div>' : "")
      + (a.error ? '<div class="rpErr">' + esc(a.error) + "</div>" : "");
  }
  function paintUse() {
    const el = $("rpUse"); if (!el) return;
    const c = S.cost;
    if (!c) { el.innerHTML = '<span class="hint">asking RunPod…</span>'; return; }
    const rows = podRows(S.mine, c);
    el.innerHTML = '<div class="rpKv" id="rpCost"><span class="k">Running now</span><span>' + (c.running ? "<b>" + c.running + "</b> pod" + (c.running > 1 ? "s" : "") + " · <b>" + money(c.running_hr, "/h") + "</b>" : "none") + "</span>"
      + '<span class="k">Today</span><span><b>' + money(c.today_usd) + "</b></span>"
      + '<span class="k">This month</span><span><b>' + money(c.month_usd) + "</b></span></div>"
      + (rows.length ? '<table id="rpPods"><thead><tr><th>Pod</th><th>State</th><th class="n">Per hour</th><th class="n">Today</th><th class="n">This month</th></tr></thead><tbody>'
        + rows.map((r) => '<tr data-rppod="' + esc(r.id) + '"><td>' + esc(r.name) + "</td><td>" + esc(r.status === "GONE" ? "terminated" : r.status.toLowerCase()) + '</td><td class="n">' + (r.hr ? money(r.hr, "/h") : "-") + '</td><td class="n">' + money(r.today) + '</td><td class="n">' + money(r.month) + "</td></tr>").join("")
        + "</tbody></table>" : "")
      + (c.error ? '<div class="rpErr">' + esc(c.error) + "</div>" : "")
      + '<div class="hint">RunPod\'s own bill (GPU, CPU and disk), checked every minute; 📊 Usage (Settings ▸ General ▸ Energy cost) keeps it day by day beside the electricity. A stopped pod still pays for its disk until it is terminated.</div>';
  }
  function paintGpus() {
    const el = $("rpGpus"); if (!el) return;
    const g = S.gpus[S.cloud];
    if (!g) { el.innerHTML = '<span class="hint">asking RunPod for its GPUs…</span>'; return; }
    if (g.error) { el.innerHTML = '<span class="rpErr">' + esc(g.error) + "</span>"; return; }
    const list = sortGpus(filterGpus(g.gpus, S.q), S.by);
    el.innerHTML = list.length ? '<table><thead><tr><th>GPU</th><th class="n">Memory</th><th class="n">Per hour</th><th>Free now</th><th class="n">Most a pod</th></tr></thead><tbody>'
      + list.map((x) => '<tr data-rpgpu="' + esc(x.id) + '"' + (x.offered ? "" : ' class="off"') + "><td>" + esc(x.name) + '</td><td class="n">' + esc(gb(x.memory)) + '</td><td class="n">' + money(x.price, "/h") + '</td><td><span class="rpAv ' + esc(String(x.availability || "").toUpperCase()) + '"></span>' + esc(availWord(x.availability)) + '</td><td class="n">' + (x.max || 1) + "×</td></tr>").join("")
      + "</tbody></table>" : '<span class="hint">no GPU matches "' + esc(S.q) + '"</span>';
  }
  function paintAt() { const el = $("rpAt"); if (el) el.textContent = S.at ? "Checked " + new Date(S.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " - again every minute while this shows" : ""; }
  function paintRp() { paintBal(); paintUse(); paintGpus(); }
  function paint() { paintSum(); paintRp(); paintDet(); paintAt(); }

  function shown() { return !!(root.SecFloat && SecFloat.windows && SecFloat.windows.runpod && (SecFloat.state("runpod") || {}).shown); }
  /** the balance + the bill + the pods (refresh = past the 50 s the server keeps them) */
  function load(refresh) {
    const q = refresh ? "?refresh=1" : "";
    return Promise.all([
      // each part painted as it comes (a slow answer for one does not hold up the others)
      getj("/api/pods/account" + q).then((j) => { S.acct = j; paintBal(); }).catch(() => { S.acct = { balance: null, error: "bitGen could not be asked" }; paintBal(); }),
      Promise.all([getj("/api/pods/costs" + q).then((j) => { S.cost = j; }).catch(() => { /* offline */ }),
        getj("/api/pods/mine").then((j) => { S.mine = (j && j.pods) || []; }).catch(() => { /* no key yet */ })]).then(paintUse),
    ]).then(() => { S.at = Date.now(); paintAt(); root.dispatchEvent(new root.CustomEvent("h3:runpodcost", { detail: S.cost })); });
  }
  function loadGpus(refresh) {
    const c = S.cloud;
    if (S.gpus[c] && !refresh) { paintGpus(); return Promise.resolve(); }
    return getj("/api/pods/gpus?cloud=" + c).then((j) => { S.gpus[c] = j && j.error ? { error: j.error } : { gpus: (j && j.gpus) || [] }; paintGpus(); })
      .catch(() => { S.gpus[c] = { error: "RunPod could not be reached" }; paintGpus(); });
  }
  /** everything the docker shows now */
  function loadAll(refresh) {
    const jobs = [loadSum(refresh).then(() => { S.at = Date.now(); paintAt(); })];
    if (S.view) jobs.push(loadDet(refresh));
    jobs.push(load(refresh));   // RunPod's parts, as before 2.771.0 (others read them through h3:runpodcost; no key = an answer at once)
    if (S.view === "runpod") jobs.push(loadGpus(refresh));
    return Promise.all(jobs);
  }
  function onShow() { paint(); loadAll(false); }
  function tick() { if (shown()) loadAll(false); }
  function wire() {
    $("rpRefresh").onclick = () => { S.gpus = {}; loadAll(true); };
    $("rpCloud").onchange = (e) => { S.cloud = e.target.value === "COMMUNITY" ? "COMMUNITY" : "SECURE"; loadGpus(false); };
    $("rpSort").onchange = (e) => { S.by = e.target.value; paintGpus(); };
    $("rpQ").oninput = (e) => { S.q = e.target.value; paintGpus(); };
    doc.querySelectorAll(".rpk [data-cdrange]").forEach((b) => { b.onclick = () => { S.range = b.dataset.cdrange; S.sum = null; S.det = null; paintSum(); paintDet(); loadSum(false); if (S.view) loadDet(false); }; });
    $("cdBack").onclick = () => open("");
    $("cdStats").onclick = () => { if (root.H3Stats && H3Stats.show) H3Stats.show(true, { range: S.range }); };
    $("cdSumBox").addEventListener("click", (e) => { const tr = e.target.closest && e.target.closest("tr[data-cdrow]"); if (tr) open(tr.dataset.cdrow); });
    $("cdSumBox").addEventListener("keydown", (e) => { const tr = e.target.closest && e.target.closest("tr[data-cdrow]"); if (tr && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); open(tr.dataset.cdrow); } });
  }
  /* ---- 💲 Costs in the ☁ Remote generation docker (where the 💲 line was), shown while Remote generation is RunPod - opens
   *      RunPod's list */
  function wanted() { const g = S.g || {}; return !!(g.engine && g.engine.provider === "runpod" && (g.enabled || (g.engine && g.engine.pods))); }
  function btn() {
    const box = $("sec-gpu"); if (!box || !$("gpuWhere")) return null;
    let b = $("gpuRpDock");
    if (!b) {
      b = doc.createElement("button"); b.type = "button"; b.className = "ghost"; b.id = "gpuRpDock"; b.style.cssText = "margin:4px 0 0 6px;font-size:.72rem;display:none";
      b.title = "Show / hide the 💲 Costs docker on RunPod's list: your balance, what your pods cost, RunPod's GPU prices (← All costs: this computer and every platform)"; b.textContent = "💲 Costs";
      b.onclick = () => show(undefined, "runpod");
      const pods = $("gpuPods"), host = $("gpuOptBtns") || box;   // 2.768.0: with the remote options (the ☁ Remote generation docker)
      if (pods && pods.parentNode === host) pods.after(b); else host.appendChild(b);
    }
    return b;
  }
  function paintBtn() {
    const b = btn(); if (!b) return;
    const on = shown();
    b.style.display = wanted() ? "" : "none";
    b.setAttribute("aria-pressed", on ? "true" : "false"); b.classList.toggle("on", on);
  }
  function loadG() { return getj("/api/gpusplit").then((g) => { if (g && g.where) { S.g = g; paintBtn(); } }).catch(() => { /* offline */ }); }
  /** show / hide (on undefined = toggle); view = a platform's list to open ("runpod", "local" …), "" = all costs */
  function show(on, view) {
    if (!(root.SecFloat && SecFloat.windows && SecFloat.windows.runpod)) return false;
    if (view != null && $("cdSumView")) { if (on === undefined && shown() && S.view === view) on = false; else { on = true; open(view); } }
    const r = SecFloat.show("runpod", on); paintBtn(); return r;
  }
  /** 2.771.0: 💲 Costs beside 📊 Usage in Settings ▸ General ▸ Energy cost */
  function settingsBtn() {
    const u = $("s_usage"); if (!u || $("s_costs")) return;
    const b = doc.createElement("button"); b.type = "button"; b.className = u.className || "ghost"; b.id = "s_costs"; b.textContent = "💲 Costs…";
    b.title = "The 💲 Costs docker: this computer's electricity and every platform's costs, each with its detailed list";
    b.style.marginLeft = "6px";
    b.onclick = () => { const d = $("settings"); if (d && d.open) d.close(); show(true, ""); };
    u.after(b);
  }

  function boot() {
    if (!(root.SecFloat && SecFloat.add && SecFloat.started)) { root.setTimeout(boot, 250); return; }
    if (!$("rpCss")) { const st = doc.createElement("style"); st.id = "rpCss"; st.textContent = CSS; doc.head.appendChild(st); }
    if (!$("rpBody")) { SecFloat.add({ id: "runpod", title: "💲 COSTS", w: 640, h: 660, body: body(), onShow }); wire(); open(""); }
    loadG(); settingsBtn();
    S.timer = root.setInterval(tick, +(root.H3_RUNPOD_POLL || 60000));
    root.setInterval(() => { paintBtn(); settingsBtn(); }, 1500);
    doc.addEventListener("h3:rgpu", loadG);
    doc.addEventListener("change", (e) => { if (e.target && /^(gpuProv|gpuRunpod|gpuWhere)$/.test(e.target.name || "")) root.setTimeout(loadG, 500); });
    root.addEventListener("h3:currency", () => { if ($("rpBody")) paint(); });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3RunPod = Object.assign({ show, load, open, loadAll, state: () => S, shown }, api);
  root.H3Costs = root.H3RunPod;   // 2.771.0: the docker's new name
})(typeof window !== "undefined" ? window : globalThis);
