/* bitGen Studio — static/updater.js (2.540.5): ⟳ UPDATES in Settings ▸ General (window.H3Updater).
 * Tim: "add an update button to update bitgen from github". The section shows this version and how it was installed
 * (a git clone, or the full zip), 🔍 Check for updates (the version on GitHub + the new commits), ⤓ Update now (asks
 * first; the log streams in), then ⟳ Restart now (the desktop app) - in a browser: start the app again.
 * 2.573.0: the look on startup is static/startcheck.js (bitGen Studio AND ComfyUI, a status-bar chip + a card - the old
 * quiet() only wrote to the console); its switch is the "Check for updates on startup" box here.
 * API: lib/updater.js via routes/updater.js. Exports H3Updater {check, update, restart, state}. */
(function () {
  "use strict";
  var S = { info: null, chk: null, job: null, lines: [], next: 0, timer: null };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function j(r) { return r.json(); }
  function post(u) { return fetch(u, { method: "POST" }).then(j); }
  var CSS = "#upSec{border:1px solid var(--line,#3a352e);border-radius:6px;padding:8px 10px;margin:10px 0}"
    + "#upSec h4{margin:0 0 6px;font-size:13px}#upSec .kv{font-size:12px;color:var(--dim,#aaa);margin:2px 0}#upSec .kv b{color:var(--text,#ddd)}"
    + "#upSec .btns{display:flex;gap:6px;margin:6px 0;flex-wrap:wrap}#upSec .new{color:var(--tiger,#f59e2c)}"
    + "#upCommits{font:11px ui-monospace,monospace;max-height:140px;overflow:auto;margin:4px 0;padding-left:16px}"
    + "#upLog{max-height:220px;overflow:auto;font:11px ui-monospace,monospace;background:var(--bg,#151310);border:1px solid var(--line,#3a352e);border-radius:4px;padding:6px;white-space:pre-wrap;margin:6px 0 0}#upLog .e{color:#e88}";
  function boot() {
    var g = $("stab-general"); if (!g || $("upSec")) return;
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    var d = document.createElement("div"); d.id = "upSec";
    d.innerHTML = '<h4>⟳ Updates</h4><div class="kv" id="upInfo">…</div><div class="btns">'
      + '<button type="button" class="ghost" id="upCheck" title="Ask GitHub for the newest version">🔍 Check for updates</button>'
      + '<button type="button" id="upGo" disabled title="Download the newest version from GitHub and put it in place (your projects, settings and models are not touched)">⤓ Update now</button>'
      + '<button type="button" class="ghost" id="upRestart" hidden title="Close and open bitGen Studio again with the new version">⟳ Restart now</button></div>'
      + '<label class="kv" style="display:flex;gap:6px;align-items:center;cursor:pointer" title="A little after the app starts, look on GitHub for a newer bitGen Studio and a newer ComfyUI; a ⬆ in the status bar says so"><input type="checkbox" id="upAuto" checked> Check for updates on startup (bitGen Studio and ComfyUI)</label>'
      + '<div class="kv" id="upMsg"></div><ol id="upCommits" hidden></ol><div id="upJob"></div>';
    g.insertBefore(d, g.firstChild ? g.firstChild.nextSibling : null);
    $("upCheck").onclick = function () { check(); };
    $("upGo").onclick = function () { update(); };
    $("upRestart").onclick = function () { restart(); };
    fetch("/api/update/info").then(j).then(function (i) { S.info = i; paintInfo(); }).catch(function () { /* offline */ });
    fetch("/api/update/job").then(j).then(function (r) { if (r.job) { S.job = r.job; if (r.job.state === "running") follow(); else { S.lines = r.lines || []; S.next = r.next; paintJob(); } } }).catch(function () {});
    fetch("/api/update/settings").then(j).then(function (r) { $("upAuto").checked = r.auto_check !== false; }).catch(function () {});
    $("upAuto").onchange = function () {
      var on = this.checked;
      fetch("/api/update/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auto_check: on }) }).catch(function () {});
    };
  }
  function paintInfo() {
    var i = S.info; if (!i || !$("upInfo")) return;
    $("upInfo").innerHTML = "<b>bitGen Studio " + esc(i.version) + "</b> · " + (i.mode === "git" ? "a git clone" : "installed from a zip")
      + " of <b>" + esc(i.repo) + "</b> (" + esc(i.branch) + ")" + (i.mode === "git" && !i.git ? ' · <span class="new">git is not installed - the update needs it</span>' : "");
  }
  function check() {
    $("upMsg").textContent = "Asking GitHub…"; $("upCheck").disabled = true;
    return post("/api/update/check").then(function (c) {
      S.chk = c; $("upCheck").disabled = false;
      var m = c.error && !c.latest ? "✗ " + c.error
        : c.newer ? '<span class="new">⬆ ' + esc(c.latest || "a newer version") + " is on GitHub</span> (you have " + esc(c.current) + (c.behind ? ", " + c.behind + " new commit(s)" : "") + ")"
        : "✓ You have the newest version (" + esc(c.current) + ")";
      $("upMsg").innerHTML = m;
      $("upGo").disabled = !c.newer;
      var ol = $("upCommits"); ol.hidden = !(c.commits && c.commits.length);
      ol.innerHTML = (c.commits || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("");
      if (window.H3TestEvent) window.H3TestEvent("update_check", c.newer ? "newer" : "same");
      return c;
    }).catch(function (e) { $("upCheck").disabled = false; $("upMsg").textContent = "✗ " + e.message; });
  }
  function update() {
    var c = S.chk || {};
    if (!confirm("Update bitGen Studio " + (c.current || "") + " to " + (c.latest || "the newest version") + " from GitHub?\n\nYour projects, settings, styles, models and ComfyUI are not touched. "
      + (S.info && S.info.mode === "git" ? "App files you changed yourself are copied to backups\\ first." : "") + "\nRestart bitGen Studio afterwards.")) return Promise.resolve(null);
    S.lines = []; S.next = 0; $("upGo").disabled = true; $("upCheck").disabled = true;
    return post("/api/update/start").then(function (r) {
      if (r.error) { $("upMsg").textContent = "✗ " + r.error; $("upCheck").disabled = false; return r; }
      S.job = { state: "running" }; paintJob(); follow(); return r;
    });
  }
  function follow() {
    clearTimeout(S.timer);
    fetch("/api/update/job?from=" + S.next).then(j).then(function (r) {
      if (!r.job) return;
      S.lines = S.lines.concat(r.lines || []); S.next = r.next; S.job = r.job; paintJob();
      if (r.job.state === "running") S.timer = setTimeout(follow, 1200);
      else { $("upCheck").disabled = false; if (window.H3StartCheck && r.job.state === "done") window.H3StartCheck.clear("bitgen"); fetch("/api/update/info").then(j).then(function (i) { S.info = i; paintInfo(); }); }
    }).catch(function () { S.timer = setTimeout(follow, 3000); });
  }
  function paintJob() {
    var J = $("upJob"); if (!J || !S.job) return;
    var k = S.job, head = k.state === "running" ? "⏳ Updating…" : k.state === "done" ? (k.restart ? "✓ Updated " + esc(k.from) + " → " + esc(k.to) + " - restart bitGen Studio to finish" : "✓ Already the newest") : "✗ " + esc(k.error || "the update failed");
    J.innerHTML = '<div class="kv" id="upHead"><b>' + head + '</b></div><div id="upLog">' + S.lines.map(function (l) { return l.charAt(0) === "!" ? '<span class="e">' + esc(l.slice(2)) + "</span>" : esc(l); }).join("\n") + "</div>";
    var lg = $("upLog"); if (lg) lg.scrollTop = lg.scrollHeight;
    var rb = $("upRestart");
    if (rb) {
      rb.hidden = !(k.state === "done" && k.restart);
      if (!rb.hidden && !(window.h3shell && window.h3shell.relaunch)) { rb.disabled = true; rb.title = "In a browser: close the window running start.bat (or bitgen-studio.sh) and start it again"; rb.textContent = "Restart: close start.bat and start it again"; }
    }
  }
  function restart() {
    if (window.h3shell && window.h3shell.relaunch) return window.h3shell.relaunch();
    return null;
  }
  /* a quiet look a little after start - one toast per new version */
  function quiet() {
    var cfg = null;
    fetch("/api/config").then(j).then(function (c) { cfg = c; if (((c || {}).update || {}).auto_check === false) return null; return post("/api/update/check"); }).then(function (c) {
      if (!c || !c.newer || !c.latest) return;
      var seen = ""; try { seen = localStorage.getItem("h3.update.seen") || ""; } catch (e) { seen = ""; }
      if (seen === c.latest) return;
      try { localStorage.setItem("h3.update.seen", c.latest); } catch (e) { /* fine */ }
      S.chk = c; if ($("upGo")) $("upGo").disabled = false;
      var msg = "bitGen Studio " + c.latest + " is available (you have " + c.current + ") - Settings ▸ General ▸ ⟳ Updates";
      if (typeof window.toast === "function") window.toast(msg); else console.log(msg);
    }).catch(function () { /* offline: say nothing */ });
    void cfg;
  }
  window.H3Updater = { check: check, update: update, restart: restart, quiet: quiet, state: S };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
