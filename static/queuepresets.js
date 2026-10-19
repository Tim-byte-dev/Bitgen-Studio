/* bitGen Studio — static/queuepresets.js (2.518.0): ⏱ QUEUE PRESETS on the menu bar (window.H3QueuePresets).
 * Tim (verbatim): "add a dropdown on the main menubar for queue presets"
 *   ⏱ [Normal ▾]   Normal / Quiet (overnight) / Eco / Cool-down between jobs / Max performance / Custom
 *                  (lib/queuePresets.js: a GPU power limit, a rest between jobs, wait while a GPU is hot)
 *   ⓘ              what the preset does, the power-limit result, a hold ("rest between jobs: 12 s left"), warnings
 *                  ("GPU 0 is 86 °C", "probably throttling"); Custom's four numbers live there too
 *   the badge      ⏸ while the queue is holding a job, ⚠ with a warning
 * Pure (Node: scripts/test-queue518.js): badgeOf.
 */
(function (root) {
  "use strict";
  function badgeOf(st) {
    if (!st) return "";
    if (st.holding) return "⏸";
    if ((st.warnings || []).length) return "⚠";
    return "";
  }
  var pure = { badgeOf: badgeOf };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var CSS = "#quWrap{position:relative;display:inline-flex;align-items:center;gap:4px;font-size:.76rem}"
    + "#quWrap select{font-size:.74rem;padding:2px 4px;max-width:190px}"
    + "#quBadge{min-width:1em;color:var(--tiger,#f59e2c)}"
    + "#quPanel{position:absolute;left:0;top:calc(100% + 4px);z-index:300;width:360px;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:10px;box-shadow:0 10px 30px rgba(0,0,0,.5);font-size:.74rem;display:none}"
    + "#quPanel.on{display:block}#quPanel .qul{color:var(--dim);margin:4px 0}#quPanel .quw{color:#e6a23c}#quPanel .quh{color:var(--tiger,#f59e2c)}"
    + "#quPanel .qugrid{display:grid;grid-template-columns:1fr 80px;gap:4px 8px;align-items:center;margin-top:6px}#quPanel .qugrid input{width:100%}";
  var ST = null, timer = null;
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function get() { return fetch("/api/queuepresets").then(function (r) { return r.json(); }); }
  function post(b) { return fetch("/api/queuepresets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(function (r) { return r.json(); }); }

  function paint() {
    var st = ST; if (!st || !$("quSel")) return;
    var sel = $("quSel");
    if (!sel.options.length) sel.innerHTML = st.presets.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.label) + "</option>"; }).join("");
    if (document.activeElement !== sel) sel.value = st.preset.id;
    var hint = (st.presets.find(function (p) { return p.id === st.preset.id; }) || {}).hint || "";
    sel.title = "Queue preset - " + hint;
    $("quBadge").textContent = badgeOf(st);
    $("quBadge").title = st.holding ? st.holding.why : (st.warnings || []).join("\n");
    var p = st.preset, c = st.custom || {};
    var html = "<b>" + esc(p.label) + "</b><div class='qul'>" + esc(hint) + "</div>"
      + "<div class='qul'>Power limit: " + (p.power_pct == null ? "left as it is" : p.power_pct + " % of each card's default") + " · rest between jobs: " + (p.cooldown_s ? p.cooldown_s + " s" : "none")
      + " · " + (p.pause_c ? "waits at " + p.pause_c + " °C until " + p.resume_c + " °C" : "never waits for heat") + "</div>";
    if (st.holding) html += "<div class='quh' id='quHold'>⏸ " + esc(st.holding.why) + "</div>";
    (st.warnings || []).forEach(function (w) { html += "<div class='quw'>⚠ " + esc(w) + "</div>"; });
    if (st.power && st.power.note) html += "<div class='qul' id='quPower'>" + (st.power.ok ? "✓ " : "✗ ") + esc(st.power.note) + "</div>";
    if (p.id === "custom") {
      html += "<div class='qugrid'><label for='quPct'>Power limit (% of default, blank = leave)</label><input id='quPct' type='number' min='30' max='110' value='" + (c.power_pct == null ? "" : esc(c.power_pct)) + "'>"
        + "<label for='quCool'>Rest between jobs (s)</label><input id='quCool' type='number' min='0' max='3600' value='" + esc(c.cooldown_s || 0) + "'>"
        + "<label for='quPause'>Wait while a GPU is (°C, 0 = never)</label><input id='quPause' type='number' min='0' max='100' value='" + esc(c.pause_c || 0) + "'>"
        + "<label for='quResume'>... until it is (°C)</label><input id='quResume' type='number' min='0' max='100' value='" + esc(c.resume_c || 0) + "'></div>"
        + "<div style='margin-top:6px'><button class='ghost' id='quApply' type='button'>Apply</button></div>";
    }
    html += "<div class='qul'>A power limit needs the app run as administrator (Windows) / with sudo (Linux) and lasts until the computer restarts. Picking Normal puts the cards' default back.</div>";
    var panel = $("quPanel"); if (panel.classList.contains("on") && panel.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;
    panel.innerHTML = html;
    if ($("quApply")) $("quApply").onclick = function () {
      var v = function (id) { var x = $(id).value; return x === "" ? null : +x; };
      choose("custom", { power_pct: v("quPct"), cooldown_s: v("quCool") || 0, pause_c: v("quPause") || 0, resume_c: v("quResume") || 0 });
    };
  }
  function refresh() { return get().then(function (st) { ST = st; paint(); return st; }).catch(function () { return null; }); }
  function choose(id, custom) {
    return post({ id: id, custom: custom }).then(function (j) {
      if (j && j.status) { ST = j.status; if (j.power) ST.power = j.power; }
      paint();
      if (typeof logLine === "function") try { logLine("[queue] preset: " + ((ST && ST.preset.label) || id) + (j && j.power && j.power.note ? " - " + j.power.note : "")); } catch (e) { /* fine */ }
      return j;
    });
  }
  function start() {
    var bar = $("menubar");
    if (!bar) { setTimeout(start, 200); return; }
    if ($("quWrap")) return;
    if (!$("quCss")) { var st = document.createElement("style"); st.id = "quCss"; st.textContent = CSS; document.head.appendChild(st); }
    var wrap = document.createElement("span"); wrap.id = "quWrap";
    wrap.innerHTML = '<span title="Queue preset">⏱</span><select id="quSel" aria-label="Queue preset"></select><span id="quBadge" aria-live="polite"></span>'
      + '<button class="ghost" id="quInfo" type="button" title="What the queue preset does, a job it is holding, warnings, Custom" aria-haspopup="true">ⓘ</button><div id="quPanel" role="dialog" aria-label="Queue preset"></div>';
    var pb = bar.querySelector(".projbtns");
    if (pb && pb.nextSibling) bar.insertBefore(wrap, pb.nextSibling); else bar.appendChild(wrap);
    $("quSel").onchange = function (e) { choose(e.target.value); if (e.target.value === "custom") $("quPanel").classList.add("on"); };
    $("quInfo").onclick = function (e) { e.stopPropagation(); $("quPanel").classList.toggle("on"); paint(); };
    document.addEventListener("pointerdown", function (e) { if (!wrap.contains(e.target)) $("quPanel").classList.remove("on"); });
    refresh();
    timer = setInterval(refresh, 4000);
  }
  root.H3QueuePresets = Object.assign({ refresh: refresh, choose: choose, state: function () { return ST; } }, pure);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
