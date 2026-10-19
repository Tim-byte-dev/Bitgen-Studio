/* bitGen Studio — static/styledoctor.js (2.527.0): 🩺 THE STYLE DOCTOR, a floating docker (window.H3StyleDoctor).
 * From the recommendations Tim asked to be worked through: "one click makes a tiny test picture with every style and
 * shows a pass/fail table with the failing log line".
 *   🩺 (menu bar)  opens it. Every image style is listed (✓ by default; a chain style is skipped, an incomplete one fails
 *                  at once). ▶ Check renders each ticked style through Generate's own path (/api/genimage), ONE at a time:
 *                  Quick = 512 × 512, 4 steps (does it load and run?); Real = the style's own steps and size.
 *                  An edit style (it takes a picture) is given a small test picture.
 *   A ROW          ✓ works (its time + the test picture) / ✗ failed - the log line that matters and what to do
 *                  (lib/styleDoctor.explain) / – skipped / ■ stopped. ↻ checks that one again.
 *   ■ Stop         cancels the job running now and ends the run. ⤓ Report = the table as a .md file.
 *   The test pictures leave the gallery and the Image assets (they are not your work) unless "Keep the test pictures"
 *   is ticked. The last run is kept (projects/<p>/doctor/report.json) and shows when the docker opens again.
 * Pure (Node: scripts/test-styledoctor527.js): PROMPT, body(style, mode, ref), summary(rows), fmtSecs.
 */
(function (root) {
  "use strict";
  var PROMPT = "a red apple on a wooden table by a window, soft daylight, simple photo";
  /** the /api/genimage body for one style (pure) */
  function body(st, mode, ref) {
    var b = { prompt: PROMPT, style_id: st.id, seed: 1234567, batch: 1 };
    if (mode !== "real") { b.width = 512; b.height = 512; b.steps = 4; }
    if (st.slots > 0 && ref) b.images = [ref];
    return b;
  }
  function summary(rows) { var c = { ok: 0, fail: 0, skip: 0, stopped: 0 }; (rows || []).forEach(function (r) { if (c[r.status] != null) c[r.status]++; }); return c; }
  function fmtSecs(s) { if (s == null) return ""; return s < 60 ? (Math.round(s * 10) / 10) + " s" : Math.floor(s / 60) + " m " + Math.round(s % 60) + " s"; }
  var pure = { PROMPT: PROMPT, body: body, summary: summary, fmtSecs: fmtSecs };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var CSS = ".sdd{display:flex;flex-direction:column;height:100%;min-height:0;gap:6px;font-size:.74rem}.sdd .sdbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap}"
    + ".sdd .sdlist{flex:1;min-height:0;overflow:auto;border:1px solid var(--line,#3a342a);border-radius:6px}.sdd table{width:100%;border-collapse:collapse}"
    + ".sdd td,.sdd th{padding:4px 6px;border-bottom:1px solid var(--line,#3a342a);vertical-align:top;text-align:left}.sdd th{position:sticky;top:0;background:var(--panel,#1b1814);font-weight:600;color:var(--dim,#999);font-size:.66rem;text-transform:uppercase}"
    + ".sdd .ok{color:#7c7}.sdd .fail{color:#e66}.sdd .skip,.sdd .stopped{color:var(--dim,#999)}.sdd .run{color:var(--tiger,#f59e2c)}.sdd .why{font-family:var(--mono,monospace);font-size:.66rem;word-break:break-word}"
    + ".sdd .adv{color:var(--text,#ddd);font-size:.7rem;margin-top:2px}.sdd img{width:48px;height:48px;object-fit:cover;border-radius:4px;display:block}.sdd .nm{font-weight:600}.sdd .ar{color:var(--dim,#999);font-size:.64rem}"
    + ".sdd .sum{font-weight:600}.sdd .note{color:var(--dim,#999);font-size:.68rem}.sdd #sdMode{width:auto;max-width:300px}";
  var S = { styles: [], rows: {}, picked: {}, running: false, stop: false, job: "", mode: "quick", keep: false, ref: "", at: "" };
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function jget(u) { return fetch(u, { cache: "no-store" }).then(function (r) { return r.json(); }); }
  function jpost(u, b) { return fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json().then(function (j) { if (!r.ok && !j.error) j.error = "HTTP " + r.status; return j; }); }); }
  function wait(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  function say(t) { var m = $("sdMsg"); if (m) m.textContent = t || ""; }

  function rowsList() { return S.styles.map(function (st) { return S.rows[st.id]; }).filter(Boolean); }
  function paint() {
    var host = $("sdRows"); if (!host) return;
    host.innerHTML = S.styles.map(function (st) {
      var r = S.rows[st.id] || {}, cls = r.status || "", res = r.status === "ok" ? "✓ works" : r.status === "fail" ? "✗ failed" : r.status === "skip" ? "– skipped" : r.status === "stopped" ? "■ stopped" : r.status === "run" ? "⏵ checking…" : r.status === "wait" ? "⏳ waiting" : "";
      var why = r.status === "fail" || r.status === "skip" ? '<div class="why">' + esc(r.line) + "</div>" + (r.advice ? '<div class="adv">→ ' + esc(r.advice) + "</div>" : "") : r.status === "run" ? '<div class="note">' + esc(r.line || "") + "</div>" : "";
      return "<tr data-id=\"" + esc(st.id) + "\"><td><input type=\"checkbox\" data-pick=\"" + esc(st.id) + "\"" + (S.picked[st.id] !== false ? " checked" : "") + (S.running ? " disabled" : "") + "></td>"
        + "<td><div class=\"nm\">" + esc(st.name) + "</div><div class=\"ar\">" + esc([st.arch, st.slots ? "edit (" + st.slots + " picture" + (st.slots > 1 ? "s" : "") + ")" : ""].filter(Boolean).join(" · ")) + "</div></td>"
        + "<td class=\"" + cls + "\">" + res + (r.secs != null && r.status === "ok" ? "<div class=\"ar\">" + fmtSecs(r.secs) + "</div>" : "") + "</td>"
        + "<td>" + why + "</td>"
        + "<td>" + (r.thumb ? '<img alt="" src="/api/doctor/thumb/' + encodeURIComponent(r.thumb) + "?t=" + encodeURIComponent(r.at || "") + '">' : "") + "</td>"
        + "<td>" + (S.running ? "" : '<button type="button" class="ghost" data-one="' + esc(st.id) + '" title="Check this style again">↻</button>') + "</td></tr>";
    }).join("");
    host.querySelectorAll("[data-pick]").forEach(function (c) { c.onchange = function () { S.picked[c.dataset.pick] = c.checked; }; });
    host.querySelectorAll("[data-one]").forEach(function (b) { b.onclick = function () { run([b.dataset.one]); }; });
    var c = summary(rowsList());
    $("sdSum").innerHTML = S.styles.length ? '<span class="ok">' + c.ok + " work</span> · <span class=\"fail\">" + c.fail + " failed</span> · " + c.skip + " skipped" + (S.at ? ' <span class="note">(' + esc(S.at) + ")</span>" : "") : "";
    $("sdGo").disabled = S.running; $("sdStop").disabled = !S.running;
  }
  function load() {
    return Promise.all([jget("/api/doctor/styles"), jget("/api/doctor/report")]).then(function (a) {
      S.styles = Array.isArray(a[0]) ? a[0] : [];
      var rep = a[1] || {};
      if (!S.running) { S.rows = {}; (rep.rows || []).forEach(function (r) { S.rows[r.id] = r; }); S.at = rep.at ? new Date(rep.at).toLocaleString() : ""; }
      paint();
      say(S.styles.length ? S.styles.length + " image styles" : "no image styles yet - Settings -> Image");
    }).catch(function (e) { say("could not list the styles: " + e.message); });
  }
  function keep() { return jpost("/api/doctor/report", { mode: S.mode, rows: rowsList().filter(function (r) { return r.status !== "run" && r.status !== "wait"; }) }).catch(function () { /* offline */ }); }

  /** one style: queue it, wait for it, read why */
  function check(st) {
    var row = S.rows[st.id] = { id: st.id, name: st.name, status: "run", line: "queued", at: String(Date.now()) };
    paint();
    if (st.skip) { S.rows[st.id] = { id: st.id, name: st.name, status: "skip", line: st.skip }; return Promise.resolve(); }
    if (st.missing && st.missing.length) { var ex = { kind: "slots", line: "the style is missing: " + st.missing.join(", "), advice: "Open it in Settings -> Image and fill those in." }; S.rows[st.id] = Object.assign({ id: st.id, name: st.name, status: "fail" }, ex); return Promise.resolve(); }
    var t0 = Date.now();
    return jpost("/api/genimage", body(st, S.mode, S.ref)).then(function (j) {
      if (j.error || !j.id) { S.rows[st.id] = { id: st.id, name: st.name, status: "fail", kind: "refused", line: j.error || "not queued", advice: "Generate refused this style before rendering - the message says why." }; return; }
      S.job = j.id; row.job = j.id;
      var poll = function () {
        if (S.stop) return jpost("/api/jobs/" + encodeURIComponent(j.id) + "/cancel", {}).then(function () { S.rows[st.id] = { id: st.id, name: st.name, status: "stopped", job: j.id }; });
        return jget("/api/jobs/" + encodeURIComponent(j.id)).then(function (d) {
          if (d.status === "queued" || d.status === "running") {
            row.line = d.status === "queued" ? "waiting for the queue" : (d.progress && d.progress.pct != null ? Math.round(d.progress.pct) + " %" : "rendering") + " · " + fmtSecs((Date.now() - t0) / 1000);
            paint(); return wait(1500).then(poll);
          }
          var secs = d.finished && d.started ? d.finished - d.started : (Date.now() - t0) / 1000;
          if (d.status === "done") {
            var r = { id: st.id, name: st.name, status: "ok", secs: secs, job: j.id, at: String(Date.now()) };
            S.rows[st.id] = r;
            if (S.keep) return;
            return jpost("/api/doctor/collect", { job: j.id, style: st.id }).then(function (c) { if (c.thumb) r.thumb = c.thumb; });
          }
          if (d.status === "cancelled") { S.rows[st.id] = { id: st.id, name: st.name, status: "stopped", job: j.id }; return; }
          return jget("/api/doctor/explain/" + encodeURIComponent(j.id)).then(function (x) {
            S.rows[st.id] = { id: st.id, name: st.name, status: "fail", secs: secs, job: j.id, kind: x.kind, line: x.line || d.status, advice: x.advice || "" };
          });
        });
      };
      return poll();
    }).catch(function (e) { S.rows[st.id] = { id: st.id, name: st.name, status: "fail", kind: "error", line: String(e && e.message || e), advice: "" }; });
  }
  function run(ids) {
    if (S.running) return Promise.resolve(false);
    var list = S.styles.filter(function (s) { return ids ? ids.indexOf(s.id) >= 0 : S.picked[s.id] !== false; });
    if (!list.length) { say("tick at least one style"); return Promise.resolve(false); }
    S.running = true; S.stop = false; S.mode = $("sdMode").value; S.keep = $("sdKeep").checked; S.at = "";
    list.forEach(function (s) { S.rows[s.id] = { id: s.id, name: s.name, status: "wait" }; });
    paint();
    var needRef = list.some(function (s) { return s.slots > 0; });
    var start = jget("/api/comfy/status").then(function (c) { if (c && c.reachable === false) say("⚠ ComfyUI is not running - start it, or every style fails with 'cannot reach ComfyUI'"); }).catch(function () { /* fine */ })
      .then(function () { return needRef ? jpost("/api/doctor/ref").then(function (r) { S.ref = r.name || ""; }) : null; });
    var i = 0;
    var next = function () {
      if (S.stop || i >= list.length) return null;
      var st = list[i++];
      say("checking " + i + " of " + list.length + ": " + st.name);
      return check(st).then(function () { paint(); return keep(); }).then(next);
    };
    return start.then(next).then(function () {
      list.forEach(function (s) { var r = S.rows[s.id]; if (r && (r.status === "wait" || r.status === "run")) S.rows[s.id] = { id: s.id, name: s.name, status: "stopped" }; });
      S.running = false; S.job = "";
      var c = summary(list.map(function (s) { return S.rows[s.id]; }));
      say((S.stop ? "■ stopped - " : "done - ") + c.ok + " work, " + c.fail + " failed" + (c.skip ? ", " + c.skip + " skipped" : ""));
      S.at = new Date().toLocaleString();
      paint();
      if (needRef) jpost("/api/doctor/ref/remove").catch(function () { /* fine */ });
      return keep().then(function () { return true; });
    });
  }
  function build() {
    var b = document.createElement("div"); b.className = "sdd"; b.id = "sdBody";
    b.innerHTML = '<div class="sdbar"><select id="sdMode" title="Quick: 512 × 512, 4 steps - does each style load and run? Real: the style\'s own steps and size">'
      + '<option value="quick">Quick check (512 × 512, 4 steps)</option><option value="real">Real render (the style\'s own steps + size)</option></select>'
      + '<label class="note" title="Unticked, the test pictures leave the gallery and the Image assets - each row keeps its own"><input type="checkbox" id="sdKeep"> Keep the test pictures</label>'
      + '<button type="button" id="sdGo">▶ Check</button><button type="button" class="ghost" id="sdStop" disabled title="Cancel the render running now and end the run">■ Stop</button>'
      + '<button type="button" class="ghost" id="sdAll" title="Tick every style">☑ All</button><button type="button" class="ghost" id="sdNone" title="Untick every style">☐ None</button>'
      + '<button type="button" class="ghost" id="sdClear" title="Forget the last run and its test pictures">🗑</button>'
      + '<a class="ghost" id="sdMd" href="/api/doctor/report.md" download style="text-decoration:none;padding:3px 8px;border:1px solid var(--line,#444);border-radius:5px;color:inherit" title="The last run as a .md file">⤓ Report</a></div>'
      + '<div class="sdbar"><span id="sdSum" class="sum"></span></div>'
      + '<div class="sdlist"><table><thead><tr><th></th><th>Style</th><th>Result</th><th>Why / what to do</th><th></th><th></th></tr></thead><tbody id="sdRows"></tbody></table></div>'
      + '<div class="note" id="sdMsg" aria-live="polite"></div>';
    return b;
  }
  function start() {
    if (!root.SecFloat || !SecFloat.add || !SecFloat.started || !$("menubar")) { setTimeout(start, 200); return; }
    if ($("sdBody")) return;
    if (!$("sdCss")) { var st = document.createElement("style"); st.id = "sdCss"; st.textContent = CSS; document.head.appendChild(st); }
    var body0 = build();
    var btn = document.createElement("button"); btn.type = "button"; btn.className = "ghost"; btn.id = "sdBtn"; btn.textContent = "🩺";
    btn.title = "Style doctor - render a tiny test picture with every image style and see which work, and why the others fail";
    var anchor = $("resetModels"); if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(btn, anchor.nextSibling); else $("menubar").appendChild(btn);
    SecFloat.add({ id: "doctor", title: "🩺 Style doctor", w: 860, h: 640, body: body0, button: btn, onShow: load });
    // already shown at start (a layout put it back): fill it as onShow would
    setTimeout(function () { if (SecFloat.state("doctor").shown) load(); }, 300);
    $("sdGo").onclick = function () { run(); };
    $("sdStop").onclick = function () { S.stop = true; say("stopping…"); };
    $("sdClear").onclick = function () { if (S.running) return; fetch("/api/doctor/report", { method: "DELETE" }).then(function () { S.rows = {}; S.at = ""; paint(); say("cleared"); }); };
    $("sdAll").onclick = function () { S.styles.forEach(function (s) { S.picked[s.id] = true; }); paint(); };
    $("sdNone").onclick = function () { S.styles.forEach(function (s) { S.picked[s.id] = false; }); paint(); };
  }
  root.H3StyleDoctor = Object.assign({ run: run, load: load, state: function () { return S; } }, pure);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
