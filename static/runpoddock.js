/* bitGen Studio — static/runpoddock.js (2.763.5): THE 💲 RUNPOD DOCKER - your balance, what your pods cost, RunPod's GPU prices.
 * window.H3RunPod (+ require() in Node for the pure part).
 *
 * Tim (verbatim): "make a new docker for runpod prices and move runpod balance and usage costs from the basic settings
 * docker to the runpod docker"
 *
 *   A docker of its own (static/secfloat.js - it floats, docks beside / inside another docker, goes in a ▣ docker):
 *     Balance    what is on the RunPod account, what it spends now ($/h), how long the balance lasts at that, the spend
 *                limit (GET /api/pods/account - lib/runpodAccount.js, RunPod's GraphQL "myself")
 *     Usage      the pods running now and their $/h, today, this month, and each pod's today / month (GET /api/pods/costs -
 *                lib/podCosts.js, RunPod's own bill; 📊 Usage keeps it day by day) - this was Basic Settings ▸ GPU's
 *                💲 line (2.761.0), it lives here now
 *     GPU prices every GPU RunPod rents pods on, Secure or Community cloud: memory, $/h, how many are free now, the most
 *                one pod can have (GET /api/pods/gpus); search it, sort it by price / memory / name
 *   Opened by 💲 RunPod in Basic Settings ▸ GPU (where the 💲 line was) and in the PODS docker; asked again every minute
 *   while it shows, 🔄 at once. Prices in your currency (static/currency.js H3Money).
 * Pure (Node: scripts/test-runpoddock7635.js): availWord, lastsText, sortGpus, filterGpus, podRows.
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
  const api = { availWord, lastsText, sortGpus, filterGpus, podRows };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }

  /* ================================ the page ================================ */
  const doc = root.document;
  const $ = (id) => doc.getElementById(id);
  const S = { acct: null, cost: null, mine: [], gpus: {}, cloud: "SECURE", by: "price", q: "", g: null, timer: null, at: 0 };
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const getj = (u) => root.fetch(u).then((r) => r.json());
  const money = (v, sfx) => (root.H3Money ? root.H3Money.usdHtml(v, sfx) : esc("$" + (+v || 0).toFixed(2) + (sfx || "")));
  const gb = (n) => (n ? n + " GB" : "");
  const CSS = ".rpk{display:flex;flex-direction:column;gap:10px;padding:8px 10px;font-size:12.5px}"
    + ".rpk h4{margin:0 0 4px;font-size:12px;color:var(--dim,#9a917f);font-weight:600}"
    + ".rpk .rpBal{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}.rpk .rpBig{font-size:24px;font-weight:700;color:var(--text,#e8e2d6)}"
    + ".rpk .rpBal.low .rpBig{color:#e88}.rpk .rpKv{display:grid;grid-template-columns:auto 1fr;gap:2px 12px}.rpk .rpKv .k{color:var(--dim,#9a917f)}"
    + ".rpk table{width:100%;border-collapse:collapse}.rpk th,.rpk td{text-align:left;padding:3px 6px;border-bottom:1px solid var(--line,#3a342a);white-space:nowrap}"
    + ".rpk th{color:var(--dim,#9a917f);font-weight:600;position:sticky;top:0;background:var(--panel,#1c1915)}.rpk td.n,.rpk th.n{text-align:right}"
    + ".rpk tr.off td{opacity:.5}.rpk .rpGpus{max-height:360px;overflow:auto}.rpk .rpErr{color:#e88}.rpk .rpRow{display:flex;gap:6px;align-items:center;flex-wrap:wrap}"
    + ".rpk .rpAv{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;background:#777}.rpk .rpAv.HIGH{background:#5c5}.rpk .rpAv.MEDIUM{background:#cc5}.rpk .rpAv.LOW{background:#d84}.rpk .rpAv.NONE{background:#844}";

  function body() {
    const d = doc.createElement("div"); d.className = "rpk"; d.id = "rpBody";
    d.innerHTML = '<div class="rpRow"><span class="hint" id="rpAt" aria-live="polite" style="flex:1"></span><button type="button" class="ghost" id="rpRefresh" title="Ask RunPod again now">🔄</button></div>'
      + '<section aria-labelledby="rpH1"><h4 id="rpH1">Balance</h4><div id="rpBal"></div></section>'
      + '<section aria-labelledby="rpH2"><h4 id="rpH2">Usage</h4><div id="rpUse"></div></section>'
      + '<section aria-labelledby="rpH3"><h4 id="rpH3">GPU prices</h4>'
      + '<div class="rpRow"><select id="rpCloud" title="Secure cloud = RunPod\'s data centres; Community cloud = vetted hosts, cheaper" style="width:auto"><option value="SECURE">Secure cloud</option><option value="COMMUNITY">Community cloud</option></select>'
      + '<select id="rpSort" title="The order of the list" style="width:auto"><option value="price">Cheapest first</option><option value="memory">Most memory first</option><option value="name">By name</option></select>'
      + '<input type="search" id="rpQ" placeholder="Find a GPU - 4090, 48gb, H100" spellcheck="false" style="flex:1;min-width:120px"></div>'
      + '<div class="rpGpus" id="rpGpus"></div></section>';
    return d;
  }
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
  function paint() { paintBal(); paintUse(); paintGpus(); paintAt(); }

  function shown() { return !!(root.SecFloat && SecFloat.windows && SecFloat.windows.runpod && (SecFloat.state("runpod") || {}).shown); }
  /** the balance + the bill + the pods (refresh = past the 50 s the server keeps them) */
  function load(refresh) {
    const q = refresh ? "?refresh=1" : "";
    return Promise.all([
      // each part painted as it comes (a slow answer for one does not hold up the others)
      getj("/api/pods/account" + q).then((j) => { S.acct = j; paintBal(); }).catch(() => { S.acct = { balance: null, error: "bitGen could not be asked" }; paintBal(); }),
      Promise.all([getj("/api/pods/costs" + q).then((j) => { S.cost = j; }).catch(() => { /* offline */ }),
        getj("/api/pods/mine").then((j) => { S.mine = (j && j.pods) || []; }).catch(() => { /* no key yet */ })]).then(paintUse),
    ]).then(() => { S.at = Date.now(); paint(); root.dispatchEvent(new root.CustomEvent("h3:runpodcost", { detail: S.cost })); });
  }
  function loadGpus(refresh) {
    const c = S.cloud;
    if (S.gpus[c] && !refresh) { paintGpus(); return Promise.resolve(); }
    return getj("/api/pods/gpus?cloud=" + c).then((j) => { S.gpus[c] = j && j.error ? { error: j.error } : { gpus: (j && j.gpus) || [] }; paintGpus(); })
      .catch(() => { S.gpus[c] = { error: "RunPod could not be reached" }; paintGpus(); });
  }
  function onShow() { paint(); load(false); loadGpus(false); }
  function tick() { if (shown()) { load(false); } }
  function wire() {
    $("rpRefresh").onclick = () => { S.gpus = {}; load(true); loadGpus(true); };
    $("rpCloud").onchange = (e) => { S.cloud = e.target.value === "COMMUNITY" ? "COMMUNITY" : "SECURE"; loadGpus(false); };
    $("rpSort").onchange = (e) => { S.by = e.target.value; paintGpus(); };
    $("rpQ").oninput = (e) => { S.q = e.target.value; paintGpus(); };
  }
  /* ---- 💲 RunPod in Basic Settings ▸ GPU (where the 💲 line was), shown while Remote generation is RunPod */
  function wanted() { const g = S.g || {}; return !!(g.engine && g.engine.provider === "runpod" && (g.enabled || (g.engine && g.engine.pods))); }
  function btn() {
    const box = $("sec-gpu"); if (!box || !$("gpuWhere")) return null;
    let b = $("gpuRpDock");
    if (!b) {
      b = doc.createElement("button"); b.type = "button"; b.className = "ghost"; b.id = "gpuRpDock"; b.style.cssText = "margin:4px 0 0 6px;font-size:.72rem;display:none";
      b.title = "Show / hide the 💲 RunPod docker: your balance, what your pods cost, RunPod's GPU prices"; b.textContent = "💲 RunPod";
      b.onclick = () => show();
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
  function show(on) { if (!(root.SecFloat && SecFloat.windows && SecFloat.windows.runpod)) return false; const r = SecFloat.show("runpod", on); paintBtn(); return r; }

  function boot() {
    if (!(root.SecFloat && SecFloat.add && SecFloat.started)) { root.setTimeout(boot, 250); return; }
    if (!$("rpCss")) { const st = doc.createElement("style"); st.id = "rpCss"; st.textContent = CSS; doc.head.appendChild(st); }
    if (!$("rpBody")) { SecFloat.add({ id: "runpod", title: "💲 RUNPOD", w: 620, h: 640, body: body(), onShow }); wire(); }
    loadG();
    S.timer = root.setInterval(tick, +(root.H3_RUNPOD_POLL || 60000));
    root.setInterval(paintBtn, 1500);
    doc.addEventListener("h3:rgpu", loadG);
    doc.addEventListener("change", (e) => { if (e.target && /^(gpuProv|gpuRunpod|gpuWhere)$/.test(e.target.name || "")) root.setTimeout(loadG, 500); });
    root.addEventListener("h3:currency", () => { if ($("rpBody")) paint(); });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3RunPod = Object.assign({ show, load, state: () => S, shown }, api);
})(typeof window !== "undefined" ? window : globalThis);
