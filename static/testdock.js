/* bitGen Studio — static/testdock.js (2.518.0): 🧪 THE TESTING DOCKER + THE LOG TO UPLOAD (window.H3TestDock).
 * Tim (verbatim): "Add a log that i can upload so i don't have to write down the tests - add a button general tab in
 * settings to do testing. create a floating docker with tests requires and add a check mark to them as they are
 * completed. then let me save the file and give it to you."
 *   Settings -> General -> 🧪 Testing…   shows it (a SecFloat docker: float it, dock it beside / inside another)
 *   THE LIST     lib/testPlan.json per release: ✓ ticks ITSELF for the auto ones as the app sees them work (a job of
 *                that style finished, nvidia-smi answered, a Civitai download landed in loras ...); the manual ones
 *                have ✓ / ✗ / – buttons; a note on any of them
 *   💾 Save log  downloads bitgen-test-log-<version>-<date>.txt (lib/testPlan.report - the computer, every item, how
 *                it was decided, the failed jobs' last log lines, the same as JSON) - give that file to Claude
 * Pure (Node: scripts/test-testplan518.js): icon, countText.
 */
(function (root) {
  "use strict";
  function icon(state) { return state === "pass" ? "✓" : state === "fail" ? "✗" : state === "skip" ? "–" : "·"; }
  function countText(st) { return st ? st.pass + " ✓ · " + st.fail + " ✗ · " + st.todo + " to do (of " + st.total + ")" : ""; }
  var pure = { icon: icon, countText: countText };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var CSS = ".tdock{display:flex;flex-direction:column;gap:6px;height:100%;min-height:0;font-size:.76rem}"
    + ".tdock .tdbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.tdock .tdsum{flex:1;color:var(--dim,#999)}.tdock .tdmsg{flex:none;color:var(--dim,#999)}"
    + ".tdock .tdlist{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:2px}"
    + ".tdock .tdg{font-weight:600;margin-top:6px;padding:2px 0;border-bottom:1px solid var(--line,#3a342a)}"
    + ".tdock .tdi{display:grid;grid-template-columns:18px 1fr auto;gap:2px 6px;padding:3px 2px;border-bottom:1px solid rgba(255,255,255,.04);align-items:start}"
    + ".tdock .tdi .ic{font-weight:700;text-align:center}.tdock .tdi.pass .ic{color:#7c7}.tdock .tdi.fail .ic{color:#e66}.tdock .tdi.skip .ic{color:var(--dim,#999)}"
    + ".tdock .tdi.pass .tt{color:var(--dim,#bbb)}.tdock .tdi .how{grid-column:2/4;color:var(--dim,#999);font-size:.68rem}"
    + ".tdock .tdi .auto{font-size:.6rem;border:1px solid var(--line,#444);border-radius:7px;padding:0 4px;color:var(--dim,#999);margin-left:4px}"
    + ".tdock .tdi .mk{display:flex;gap:2px}.tdock .tdi .mk button{padding:0 5px;font-size:.7rem}.tdock .tdi .mk button.on{border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c)}"
    + ".tdock .tdi .nt,.tdock .tdi .sg{grid-column:2/4;width:100%;font-size:.7rem;padding:1px 4px}.tdock .tdi .sg{border-style:dashed}"
    + ".tdock .tdi .auto.pend{border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c)}.tdock .tdmode{display:flex;gap:4px;align-items:center;white-space:nowrap}.tdock .tdoff{color:var(--tiger,#f59e2c)}"
    + ".tdock .tdi .steps{grid-column:2/4;color:var(--dim,#999);font-size:.68rem;margin:0;padding-left:16px}";
  var ST = null, timer = null;
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function post(u, b) { return fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json(); }); }
  function refresh() {
    return fetch("/api/testplan").then(function (r) { return r.json(); }).then(function (st) { ST = st; paint(); return st; }).catch(function () { return null; });
  }
  function paint() {
    var list = $("tdList"); if (!list || !ST) return;
    if (list.contains(document.activeElement) && document.activeElement.tagName === "INPUT") { $("tdSum").textContent = countText(ST); return; }
    $("tdSum").textContent = "v" + ST.version + " · " + countText(ST);
    root.H3TestMode = !!ST.mode;
    if ($("tdMode")) $("tdMode").checked = !!ST.mode;
    if ($("s_testmode")) $("s_testmode").checked = !!ST.mode;
    if (paint.m !== !!ST.mode) paint.m = !!ST.mode, $("tdMsg").innerHTML = ST.mode ? "🧪 Test mode is on: what the app sees working ticks itself and asks you to confirm it; tick the others ✓ / ✗ / –, add a note and a 💡 suggestion. Then 💾 Save log."
      : '<span class="tdoff">Test mode is off</span> - nothing ticks itself and nothing is suggested (your own ticks stay). Turn it on above or in Settings -> General.';
    var g = null, html = "";
    ST.rows.forEach(function (r) {
      if (r.group !== g) { g = r.group; html += '<div class="tdg">' + esc(r.group_title) + "</div>"; }
      html += '<div class="tdi ' + esc(r.state) + '" data-id="' + esc(r.id) + '"><span class="ic" aria-label="' + esc(r.state || "not done") + '">' + icon(r.state) + "</span>"
        + '<span class="tt">' + esc(r.title) + (r.auto || r.kept ? '<span class="auto' + (r.pending ? " pend" : "") + '" title="' + (r.pending ? "The app saw it work - ✓ / ✗ to confirm it (and say what to change)" : r.kept ? "Ticked itself when the app saw it work - kept" : "Ticks itself when the app sees it work (Test mode)") + '">auto' + (r.pending ? " ✓ - confirm?" : r.kept ? " ✓" : "") + "</span>" : "") + "</span>"
        + '<span class="mk"><button class="ghost' + (r.state === "pass" ? " on" : "") + '" data-st="pass" title="It works">✓</button><button class="ghost' + (r.state === "fail" ? " on" : "") + '" data-st="fail" title="It does not work - say what happened in the note">✗</button><button class="ghost' + (r.state === "skip" ? " on" : "") + '" data-st="skip" title="Not tested (no hardware / not used)">–</button>' + (r.state ? '<button class="ghost" data-retest="1" title="Test it again: forget its tick and what the app saw">↺</button>' : "") + '</span>'
        + (r.steps && r.steps.length ? '<ol class="steps">' + r.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>" : "")
        + (r.how ? '<span class="how">' + esc(r.how) + "</span>" : "")
        + '<input class="nt" placeholder="note (what happened, what you saw)" value="' + esc(r.note) + '" aria-label="Note">'
        + '<input class="sg" placeholder="💡 suggestion: what to change in this feature" value="' + esc(r.suggest || "") + '" aria-label="Suggestion">'
        + "</div>";
    });
    list.innerHTML = html;
  }
  function mark(id, state, note, suggest) { return post("/api/testplan/mark", { id: id, state: state, note: note, suggest: suggest }).then(function (r) { if (root.H3TestCoach) H3TestCoach.poll(); return refresh().then(function () { return r; }); }); }
  /** 2.534.0: 🧪 Test mode (the docker's box and Settings -> General's are the same switch) */
  function setMode(on) { return post("/api/testplan/mode", { on: !!on }).then(function (r) { root.H3TestMode = !!r.on; if (root.H3TestCoach) H3TestCoach.modeChanged(!!r.on); return refresh().then(function () { return r; }); }); }
  function saveLog() {
    var m = $("tdMsg"); m.textContent = "making the log…";
    return fetch("/api/testplan/report").then(function (r) {
      var cd = r.headers.get("Content-Disposition") || "", name = (/filename="([^"]+)"/.exec(cd) || [])[1] || "bitgen-test-log.txt";
      return r.blob().then(function (b) {
        var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
        m.textContent = "💾 " + name + " - upload it to Claude";
        return name;
      });
    }).catch(function (e) { m.textContent = "could not make the log: " + e.message; });
  }
  function build() {
    var body = document.createElement("div"); body.className = "tdock"; body.id = "tdBody";
    body.innerHTML = '<div class="tdbar"><label class="tdmode" title="Test mode: tests tick themselves, the app suggests what to test where you are and asks whether it worked"><input type="checkbox" id="tdMode"> 🧪 Test mode</label><span class="tdsum" id="tdSum">…</span><button class="ghost" id="tdSave" type="button" title="Download the test log (a .txt) to give Claude">💾 Save log</button>'
      + '<button class="ghost" id="tdRefresh" type="button" title="Check again">⟳</button><button class="ghost" id="tdClear" type="button" title="Forget every tick and note - start again">↺ Clear</button></div>'
      + '<div class="tdmsg" id="tdMsg" aria-live="polite">Auto items tick themselves as the app sees them work; tick the others ✓ / ✗ / – and add a note. Then 💾 Save log.</div>'
      + '<div class="tdlist" id="tdList"></div>';
    return body;
  }
  function show(on) { return window.SecFloat && SecFloat.show ? SecFloat.show("testdock", on) : false; }
  function start() {
    if (!window.SecFloat || !SecFloat.add || !SecFloat.started) { setTimeout(start, 150); return; }
    if ($("tdBody")) return;
    if (!$("tdCss")) { var st = document.createElement("style"); st.id = "tdCss"; st.textContent = CSS; document.head.appendChild(st); }
    var body = build();
    SecFloat.add({ id: "testdock", title: "Testing", w: 520, h: 640, body: body,
      onShow: function () { refresh(); clearInterval(timer); timer = setInterval(function () { var el = $("sf-testdock"); if (el && !el.classList.contains("sf-hidden")) refresh(); else clearInterval(timer); }, 5000); } });
    $("tdSave").onclick = saveLog;
    $("tdMode").onchange = function () { setMode($("tdMode").checked); };
    $("tdRefresh").onclick = refresh;
    $("tdClear").onclick = function () { var ok = typeof appConfirm === "function" ? appConfirm("Forget every tick and note in the test list?") : Promise.resolve(confirm("Forget every tick and note?")); Promise.resolve(ok).then(function (y) { if (y) post("/api/testplan/clear").then(refresh); }); };
    var list = $("tdList");
    list.addEventListener("click", function (e) {
      var rt = e.target.closest && e.target.closest("[data-retest]");
      if (rt) { post("/api/testplan/retest", { id: rt.closest(".tdi").dataset.id }).then(function () { if (root.H3TestCoach) H3TestCoach.poll(); return refresh(); }); return; }
      var b = e.target.closest && e.target.closest("[data-st]"); if (!b) return;
      var it = b.closest(".tdi"), id = it.dataset.id, cur = (ST.rows.find(function (r) { return r.id === id; }) || {});
      var st = b.dataset.st, note = it.querySelector(".nt").value, sg = it.querySelector(".sg") ? it.querySelector(".sg").value : undefined;
      mark(id, cur.state === st && /^you:/.test(cur.how || "") ? "" : st, note, sg);   // the same button again = take your mark off
    });
    list.addEventListener("change", function (e) {
      if (!e.target.classList.contains("nt") && !e.target.classList.contains("sg")) return;
      var it = e.target.closest(".tdi"), id = it.dataset.id, cur = (ST.rows.find(function (r) { return r.id === id; }) || {});
      mark(id, /^you:/.test(cur.how || "") ? cur.state : "", it.querySelector(".nt").value, it.querySelector(".sg").value);        // your ✓ / ✗ stays; an auto tick stays auto
    });
    list.addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Enter" && e.target.classList.contains("nt")) e.target.blur(); });
    var b = $("s_testing");
    if (b) b.onclick = function () { var d = $("settings"); if (d && d.open) d.close(); show(true); };
  }
  /* 2.532.0: what the page sees working ticks the list too (POST /api/testplan/event - lib/testPlan CLIENT_EVENTS); once per event a session */
  var told = {};
  root.H3TestEvent = function (name, what) {
    if (root.H3TestMode === false) return false;          // 2.534: out of test mode nothing is sent
    var key = name === "ie_action" ? name + "|" + String(what || "") : name;   // the editor: once per kind of step
    if (told[key]) return false; told[key] = 1;
    try { fetch("/api/testplan/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: name, what: String(what || "") }) }).then(function () { if (root.H3TestCoach) H3TestCoach.soon(); }).catch(function () {}); } catch (e) { /* offline */ }
    return true;
  };
  root.H3TestDock = Object.assign({ refresh: refresh, show: show, saveLog: saveLog, mark: mark, setMode: setMode, state: function () { return ST; } }, pure);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
