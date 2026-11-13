/* bitGen Studio — static/statsdlg.js (2.771.0): THE 📊 STATISTICS DIALOG - how long each generation took to start and to
 * render, and every time a pod was made ready for one. window.H3Stats (+ require() in Node for the pure part).
 * Tim (verbatim): "add a tab for statistics … record the time it takes to prepare a pod for generation each time it needs new
 * uploads or restarts etc. record generation for each generation separately - show user startup time, generation time and
 * total time" + "statistics go is Statistics Dialog"
 *
 *   Opened by 📊 Statistics in the 💲 Costs docker (static/runpoddock.js) and Settings ▸ General ▸ Energy cost.
 *   RANGE        Today / 7 days / This month / Last month / Everything (the Costs docker's range when opened from it)
 *   TOTALS       generations (done / failed), average startup, average generation, average total, pod preparations and
 *                their time
 *   GENERATIONS  one row each: finished, mode, what, where (this computer / RunPod pod / an API / a remote GPU), status,
 *                waited in the queue, STARTUP, GENERATION, TOTAL; a row with pod preparations opens their phases
 *   POD PREPARATIONS  one row each: when, the pod, start / prepare / node packs, how long, the phases (checking, starting,
 *                ComfyUI update / repair, node packs, restart, downloads, sending, linking), the styles, problems
 *   BY PLACE / BY MODE  count and the three averages
 *   ⤓ CSV        the generations or the preparations (GET /api/genstats/csv - lib/genStats.toCsv)
 *   Esc / ✕ closes it.
 * Pure (Node: scripts/test-genstats771.js): rangeOf, PHASES, phaseText, whereText.
 */
(function (root) {
  "use strict";
  function pad(n) { return String(n).padStart(2, "0"); }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  /** a named range -> {from, to} (same as 📊 Usage and 💲 Costs) */
  function rangeOf(name, now) {
    var d = now ? new Date(now) : new Date();
    if (name === "today") return { from: ymd(d), to: ymd(d) };
    if (name === "week") { var a = new Date(d); a.setDate(a.getDate() - 6); return { from: ymd(a), to: ymd(d) }; }
    if (name === "month") return { from: d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-01", to: ymd(d) };
    if (name === "last") { var f = new Date(d.getFullYear(), d.getMonth() - 1, 1), t = new Date(d.getFullYear(), d.getMonth(), 0); return { from: ymd(f), to: ymd(t) }; }
    return { from: "", to: "" };
  }
  var PHASES = [["check", "checking"], ["start", "starting the pod"], ["update", "ComfyUI update"], ["repair", "ComfyUI repair"], ["nodes", "node packs"],
    ["restart", "ComfyUI restart"], ["download", "downloads"], ["send", "sending files"], ["link", "finding / linking files"]];
  function durText(ms) {
    var v = Math.max(0, Math.round(+ms || 0));
    if (v < 1000) return v + " ms";
    var s = Math.round(v / 1000);
    if (s < 60) return s + " s";
    var m = Math.floor(s / 60);
    if (m < 60) return m + " min" + (s % 60 ? " " + (s % 60) + " s" : "");
    return Math.floor(m / 60) + " h" + (m % 60 ? " " + (m % 60) + " min" : "");
  }
  /** a preparation's phases -> "downloads 4 min · node packs 52 s" (longest first; under a second left out) */
  function phaseText(ph) {
    return PHASES.map(function (p) { return [p[1], +((ph || {})[p[0]]) || 0]; }).filter(function (x) { return x[1] >= 1000; })
      .sort(function (a, b) { return b[1] - a[1]; }).map(function (x) { return x[0] + " " + durText(x[1]); }).join(" · ");
  }
  function whereText(g) {
    if (!g) return "";
    if (g.where === "local") return "this computer";
    if (g.where === "runpod") return g.pod ? "pod " + g.pod : "RunPod pod";
    return g.label || g.where;
  }
  var pure = { rangeOf: rangeOf, PHASES: PHASES, phaseText: phaseText, whereText: whereText, durText: durText };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var doc = root.document, S = { range: "month", tab: "gens", data: null, open: {} };
  function $(id) { return doc.getElementById(id); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function when(t) { return t ? new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""; }
  var CSS = "#stDlg[hidden]{display:none!important}#stDlg{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center}"
    + "#stDlg .in{background:var(--panel,#1b1814);color:var(--text,#eee);border:1px solid var(--line,#3a342a);border-radius:10px;width:min(1100px,96vw);height:min(760px,92vh);display:flex;flex-direction:column;gap:8px;padding:10px 12px;font-size:.78rem}"
    + "#stDlg .bar{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center}#stDlg .bar button.on{border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c)}"
    + "#stDlg .tot{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}"
    + "#stDlg .card{border:1px solid var(--line,#3a342a);border-radius:7px;padding:6px 8px}#stDlg .card b{display:block;font-size:1rem}#stDlg .card span{color:var(--dim,#999);font-size:.68rem}"
    + "#stDlg .wrap{flex:1;min-height:0;overflow:auto;border:1px solid var(--line,#3a342a);border-radius:6px}"
    + "#stDlg table{width:100%;border-collapse:collapse}#stDlg th,#stDlg td{padding:3px 6px;border-bottom:1px solid rgba(255,255,255,.05);text-align:right;white-space:nowrap}"
    + "#stDlg th{position:sticky;top:0;background:var(--panel,#1b1814);color:var(--dim,#999);font-weight:600}#stDlg td.l,#stDlg th.l{text-align:left}"
    + "#stDlg tr.failed td{color:#e88}#stDlg tr.cancelled td{color:var(--dim,#999)}#stDlg tr.hasprep{cursor:pointer}#stDlg tr.prep td{color:var(--dim,#999);font-size:.72rem;text-align:left;white-space:normal}"
    + "#stDlg td.k{font-weight:700;color:var(--tiger,#f59e2c)}#stDlg .note{color:var(--dim,#999);font-size:.7rem}#stDlg .x{margin-left:auto}";
  function qs() { var r = rangeOf(S.range); return "from=" + encodeURIComponent(r.from) + "&to=" + encodeURIComponent(r.to); }
  function load() {
    return root.fetch("/api/genstats?" + qs()).then(function (r) { return r.json(); }).then(function (d) { S.data = d && d.totals ? d : { error: (d && d.error) || "no statistics" }; paint(); })
      .catch(function () { S.data = { error: "bitGen could not be asked" }; paint(); });
  }
  function card(a, b, c, id) { return '<div class="card"' + (id ? ' id="' + id + '"' : "") + "><span>" + esc(a) + "</span><b>" + esc(b) + "</b><span>" + esc(c) + "</span></div>"; }
  function paint() {
    if (!$("stDlg")) return;
    doc.querySelectorAll("#stDlg [data-strange]").forEach(function (b) { var on = b.dataset.strange === S.range; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
    doc.querySelectorAll("#stDlg [data-sttab]").forEach(function (b) { var on = b.dataset.sttab === S.tab; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
    var d = S.data, w = $("stWrap");
    $("stCsv").href = "/api/genstats/csv?kind=" + (S.tab === "preps" ? "preps" : "gens") + "&" + qs();
    if (!d) { $("stTot").innerHTML = ""; w.innerHTML = '<div class="note" style="padding:8px">reading…</div>'; return; }
    if (d.error) { $("stTot").innerHTML = ""; w.innerHTML = '<div class="note" style="padding:8px">' + esc(d.error) + "</div>"; return; }
    var t = d.totals;
    $("stTot").innerHTML = card("Generations", t.count, t.done + " done · " + t.failed + " failed", "stCount")
      + card("Average startup", durText(t.startup_avg), "to ComfyUI being handed the work", "stStartAvg")
      + card("Average generation", durText(t.gen_avg), "the render itself", "stGenAvg")
      + card("Average total", durText(t.total_avg), "startup + generation", "stTotAvg")
      + card("All together", durText(t.total_ms), "startup " + durText(t.startup_ms) + " · generation " + durText(t.gen_ms))
      + card("Pod preparations", t.preps, t.preps ? durText(t.prep_ms) + " in all · " + durText(t.prep_avg) + " each" : "none in these days", "stPreps");
    if (S.tab === "gens") {
      w.innerHTML = d.gens.length ? '<table id="stGens"><thead><tr><th class="l">Finished</th><th class="l">Mode</th><th class="l">What</th><th class="l">Where</th><th class="l">Status</th><th title="Waiting behind other jobs">Queued</th><th>Startup</th><th>Generation</th><th>Total</th></tr></thead><tbody>'
        + d.gens.map(function (g) {
          var np = (g.preps || []).length, row = '<tr class="' + esc(g.status) + (np ? " hasprep" : "") + '" data-stgen="' + esc(g.id) + '" title="' + esc((g.prompt || "") + (np ? "\n" + np + " pod preparation" + (np > 1 ? "s" : "") + " while it waited - click" : "")) + '">'
            + '<td class="l">' + esc(when(g.t)) + '</td><td class="l">' + esc(g.mode) + '</td><td class="l">' + esc(g.what || (g.prompt || "").slice(0, 40)) + '</td><td class="l">' + esc(whereText(g)) + (np ? " ⚙" + np : "") + '</td><td class="l">' + esc(g.never_started ? g.status + " (before it ran)" : g.status)
            + "</td><td>" + (g.queued_ms ? durText(g.queued_ms) : "") + '</td><td class="k">' + durText(g.startup_ms) + '</td><td class="k">' + durText(g.gen_ms) + '</td><td class="k">' + durText(g.total_ms) + "</td></tr>";
          if (np && S.open[g.id]) row += g.preps.map(function (p) { return '<tr class="prep"><td></td><td colspan="8">⚙ ' + esc(p.kind === "start" ? "pod started" : "pod made ready") + " " + esc(durText(p.ms)) + (phaseText(p.phases) ? ": " + esc(phaseText(p.phases)) : "") + "</td></tr>"; }).join("");
          return row;
        }).join("") + "</tbody></table>" : '<div class="note" style="padding:8px">No generations in these days yet - each render is added when it finishes.</div>';
    } else if (S.tab === "preps") {
      w.innerHTML = d.preps.length ? '<table id="stPrepList"><thead><tr><th class="l">When</th><th class="l">Pod</th><th class="l">What</th><th>Took</th><th class="l">Phases</th><th class="l">Styles</th><th class="l">Problems</th></tr></thead><tbody>'
        + d.preps.map(function (p) {
          return '<tr><td class="l">' + esc(when(p.at)) + '</td><td class="l">' + esc(p.pod) + '</td><td class="l">' + esc(p.kind === "start" ? "started the pod" : p.kind === "nodes" ? "node packs" : "made styles ready") + '</td><td class="k">' + durText(p.ms) + '</td><td class="l" style="white-space:normal">' + esc(phaseText(p.phases) || "checks only")
            + '</td><td class="l" style="white-space:normal">' + esc((p.styles || []).join(", ")) + '</td><td class="l" style="white-space:normal" title="' + esc((p.problems || []).join("\n")) + '">' + ((p.problems || []).length ? esc((p.problems || []).length + " - " + String(p.problems[0]).slice(0, 80)) : "") + "</td></tr>";
        }).join("") + "</tbody></table>" : '<div class="note" style="padding:8px">No pod preparations in these days - a pod is made ready when a style first renders on it, or needs files, node packs or a restart.</div>';
    } else {
      var rows = S.tab === "where" ? t.by_where : t.by_mode;
      w.innerHTML = rows.length ? '<table id="stBy"><thead><tr><th class="l">' + (S.tab === "where" ? "Where" : "Mode") + "</th><th>Generations</th><th>Average startup</th><th>Average generation</th><th>Average total</th><th>All together</th></tr></thead><tbody>"
        + rows.map(function (r) { return '<tr><td class="l">' + esc(r.label) + "</td><td>" + r.count + '</td><td class="k">' + durText(r.startup_avg) + '</td><td class="k">' + durText(r.gen_avg) + '</td><td class="k">' + durText(r.total_avg) + "</td><td>" + durText(r.total_ms) + "</td></tr>"; }).join("")
        + "</tbody></table>" : '<div class="note" style="padding:8px">Nothing in these days yet.</div>';
    }
  }
  function build() {
    if (!$("stCss")) { var st = doc.createElement("style"); st.id = "stCss"; st.textContent = CSS; doc.head.appendChild(st); }
    var d = doc.createElement("div"); d.id = "stDlg"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-labelledby", "stDlgT"); d.hidden = true;
    d.innerHTML = '<div class="in"><div class="bar"><b id="stDlgT">📊 Statistics</b><span class="note">how long each generation took to start and to render, and each pod preparation</span>'
      + '<button type="button" class="ghost x" id="stClose" title="Close (Esc)" aria-label="Close">✕</button></div>'
      + '<div class="bar" role="group" aria-label="Which days">' + [["today", "Today"], ["week", "7 days"], ["month", "This month"], ["last", "Last month"], ["all", "Everything"]].map(function (r) { return '<button type="button" class="ghost" data-strange="' + r[0] + '">' + r[1] + "</button>"; }).join("")
      + '<button type="button" class="ghost" id="stRefresh" title="Read again" style="margin-left:auto">⟳</button></div>'
      + '<div class="tot" id="stTot"></div>'
      + '<div class="bar" role="group" aria-label="What to list">' + [["gens", "Generations"], ["preps", "Pod preparations"], ["where", "By place"], ["mode", "By mode"]].map(function (r) { return '<button type="button" class="ghost" data-sttab="' + r[0] + '">' + r[1] + "</button>"; }).join("")
      + '<a id="stCsv" class="ghost" download style="margin-left:auto;text-decoration:none;padding:3px 8px;border:1px solid var(--line,#444);border-radius:5px;color:inherit">⤓ CSV</a></div>'
      + '<div class="wrap" id="stWrap"></div>'
      + '<div class="note">Startup = from the head of the queue to ComfyUI being handed the work (a pod started or made ready - files, node packs, a ComfyUI update or restart - then the workflow built); generation = ComfyUI\'s render to the finished file (an online service: its whole run); queued = the time spent behind other jobs. Kept on this computer only (usage/).</div></div>';
    doc.body.appendChild(d);
    d.addEventListener("click", function (e) { if (e.target === d) show(false); });
    d.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); show(false); } });
    $("stClose").onclick = function () { show(false); };
    $("stRefresh").onclick = load;
    d.querySelectorAll("[data-strange]").forEach(function (b) { b.onclick = function () { S.range = b.dataset.strange; S.data = null; paint(); load(); }; });
    d.querySelectorAll("[data-sttab]").forEach(function (b) { b.onclick = function () { S.tab = b.dataset.sttab; paint(); }; });
    $("stWrap").addEventListener("click", function (e) { var tr = e.target.closest && e.target.closest("tr.hasprep"); if (tr) { S.open[tr.dataset.stgen] = !S.open[tr.dataset.stgen]; paint(); } });
    return d;
  }
  /** show / hide; o.range = the days to show (the Costs docker's) */
  function show(on, o) {
    var d = $("stDlg") || build();
    var vis = on == null ? d.hidden : !!on;
    if (vis) { if (o && o.range && rangeOf(o.range)) S.range = o.range; d.hidden = false; S.data = null; paint(); load(); try { $("stClose").focus({ preventScroll: true }); } catch (e) { /* fine */ } }
    else d.hidden = true;
    return vis;
  }
  /** Settings ▸ General ▸ Energy cost: 📊 Statistics beside 📊 Usage / 💲 Costs */
  function settingsBtn() {
    var u = $("s_costs") || $("s_usage"); if (!u || $("s_stats")) return;
    var b = doc.createElement("button"); b.type = "button"; b.className = u.className || "ghost"; b.id = "s_stats"; b.textContent = "📊 Statistics…"; b.style.marginLeft = "6px";
    b.title = "How long each generation took to start and to render, and each pod preparation";
    b.onclick = function () { var s = $("settings"); if (s && s.open) s.close(); show(true); };
    u.after(b);
  }
  function start() { settingsBtn(); root.setInterval(settingsBtn, 1500); }
  root.H3Stats = Object.assign({ show: show, load: load, state: function () { return S; } }, pure);
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
