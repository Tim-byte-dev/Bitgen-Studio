/* bitGen Studio — static/comfyupdate.js (2.573.0): ⟳ COMFYUI UPDATES in Settings ▸ ComfyUI ▸ Engine (window.H3ComfyUpdate).
 * Tim: "add update comfyui button to comfyui tab in settings. do an autocheck on startup for latest version of bitgen
 * and comfyui". Under ▶ Start / ■ Stop: this ComfyUI's version and kind of install, the channel (Newest = master, what
 * the portable build's update_comfyui.bat does; Stable = the newest release), 🔍 Check, ⤓ Update ComfyUI (asks
 * first; the log streams in; a ComfyUI bitGen Studio started is stopped and started again).
 * API: lib/comfyUpdate.js via routes/comfyUpdate.js. The startup look is static/startcheck.js. */
(function () {
  "use strict";
  var S = { info: null, chk: null, job: null, lines: [], next: 0, timer: null };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function j(r) { return r.json(); }
  function post(u, b) { return fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(j); }
  var CSS = "#cuSec{border:1px solid var(--line,#3a352e);border-radius:6px;padding:8px 10px;margin:12px 0 6px}"
    + "#cuSec h4{margin:0 0 6px;font-size:13px}#cuSec .kv{font-size:12px;color:var(--dim,#aaa);margin:2px 0}#cuSec .kv b{color:var(--text,#ddd)}"
    + "#cuSec .btns{display:flex;gap:6px;margin:6px 0;flex-wrap:wrap;align-items:center}#cuSec .new{color:var(--tiger,#f59e2c)}"
    + "#cuSec select{font-size:12px;padding:1px 4px;width:auto}#cuSec label.kv{display:inline-flex;gap:6px;align-items:center;margin:0}"
    + "#cuLog{max-height:220px;overflow:auto;font:11px ui-monospace,monospace;background:var(--bg,#151310);border:1px solid var(--line,#3a352e);border-radius:4px;padding:6px;white-space:pre-wrap;margin:6px 0 0}#cuLog .e{color:#e88}";
  function boot() {
    var host = $("s_cstatus"); if (!host || $("cuSec")) return;
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    var d = document.createElement("div"); d.id = "cuSec";
    d.innerHTML = '<h4>⟳ ComfyUI updates</h4><div class="kv" id="cuInfo">…</div><div class="btns">'
      + '<label class="kv" title="Newest = ComfyUI\'s master (what the portable build\'s update_comfyui.bat does - new models arrive here first). Stable = the newest release only.">Channel '
      + '<select id="cuChannel"><option value="latest">Newest (master)</option><option value="stable">Stable releases</option></select></label>'
      + '<button type="button" class="ghost" id="cuCheck" title="Ask GitHub for the newest ComfyUI">🔍 Check</button>'
      + '<button type="button" id="cuGo" title="Update this ComfyUI (a ComfyUI bitGen Studio started is stopped first and started again after; your models, workflows and node packs stay)">⤓ Update ComfyUI</button></div>'
      + '<div class="kv" id="cuMsg"></div><div id="cuJob"></div>';
    host.parentNode.insertBefore(d, host.nextSibling);
    $("cuCheck").onclick = function () { check(); };
    $("cuGo").onclick = function () { update(); };
    $("cuChannel").onchange = function () {
      post("/api/comfy/update/channel", { channel: this.value }).then(function () { S.chk = null; $("cuMsg").textContent = ""; }).catch(function () {});
    };
    info();
    // the folder may be set (or changed) after start - read it again whenever the ComfyUI tab opens
    var tb = document.querySelector('[data-stab="comfy"]');
    if (tb) tb.addEventListener("click", function () { info(); });
    fetch("/api/comfy/update/job").then(j).then(function (r) { if (r.job) { S.job = r.job; if (r.job.state === "running") follow(); else { S.lines = r.lines || []; S.next = r.next; paintJob(); } } }).catch(function () {});
  }
  function info() {
    return fetch("/api/comfy/update/info").then(j).then(function (i) { S.info = i; paintInfo(); return i; }).catch(function () { return null; });
  }
  function paintInfo() {
    var i = S.info; if (!i || !$("cuInfo")) return;
    if ($("cuChannel") && i.channel) $("cuChannel").value = i.channel;
    $("cuInfo").innerHTML = !i.ok ? '<span class="new">' + esc(i.error) + "</span>"
      : "<b>ComfyUI " + esc(i.version || "(version unknown)") + "</b> · " + (i.mode === "portable" ? "the portable build (its own updater)"
        : i.mode === "git" ? "a git clone" : "not a git clone - update it with ComfyUI-Manager") + " · " + esc(i.root);
    $("cuGo").disabled = !i.ok || i.mode === "other" || (S.job && S.job.state === "running");
  }
  function check() {
    $("cuMsg").textContent = "Asking GitHub…"; $("cuCheck").disabled = true;
    return post("/api/comfy/update/check", { channel: $("cuChannel").value }).then(function (c) {
      S.chk = c; $("cuCheck").disabled = false;
      var tgt = c.channel === "stable" ? c.latest : (c.master || c.latest);
      $("cuMsg").innerHTML = c.error && !tgt ? "✗ " + esc(c.error)
        : c.newer ? '<span class="new">⬆ ' + (tgt && tgt !== c.current ? "ComfyUI " + esc(tgt) : "newer ComfyUI") + " is out</span> (you have " + esc(c.current || "?")
          + (c.behind ? ", " + c.behind + " new commit(s) on master" : "") + ")" + (c.latest && c.channel !== "stable" ? " · newest release " + esc(c.latest) : "")
        : "✓ ComfyUI " + esc(c.current) + " is the newest " + (c.channel === "stable" ? "release" : "on master") + (c.error ? " (" + esc(c.error) + ")" : "");
      if (window.H3TestEvent) window.H3TestEvent("comfy_update_check", c.newer ? "newer" : "same");
      return c;
    }).catch(function (e) { $("cuCheck").disabled = false; $("cuMsg").textContent = "✗ " + e.message; });
  }
  function update() {
    var i = S.info || {}, ch = $("cuChannel").value;
    var ask = "Update ComfyUI " + (i.version || "") + " to the " + (ch === "stable" ? "newest release" : "newest version (master)") + "?\n\n"
      + "A ComfyUI bitGen Studio started is stopped first and started again after. Your models, workflows, outputs and node packs are not touched"
      + (i.mode === "git" ? "; ComfyUI files you changed yourself are put aside with git stash" : "") + ".";
    var c = window.appConfirm ? window.appConfirm(ask) : Promise.resolve(window.confirm(ask));
    return Promise.resolve(c).then(function (ok) {
      if (!ok) return null;
      S.lines = []; S.next = 0; $("cuGo").disabled = true; $("cuCheck").disabled = true;
      return post("/api/comfy/update/start", { channel: ch }).then(function (r) {
        if (r.error) { $("cuMsg").textContent = "✗ " + r.error; $("cuCheck").disabled = false; paintInfo(); return r; }
        S.job = { state: "running" }; paintJob(); follow(); return r;
      });
    });
  }
  function follow() {
    clearTimeout(S.timer);
    fetch("/api/comfy/update/job?from=" + S.next).then(j).then(function (r) {
      if (!r.job) return;
      S.lines = S.lines.concat(r.lines || []); S.next = r.next; S.job = r.job; paintJob();
      if (r.job.state === "running") S.timer = setTimeout(follow, 1200);
      else { $("cuCheck").disabled = false; info(); if (window.H3StartCheck) window.H3StartCheck.clear("comfy"); }
    }).catch(function () { S.timer = setTimeout(follow, 3000); });
  }
  function paintJob() {
    var J = $("cuJob"); if (!J || !S.job) return;
    var k = S.job, head = k.state === "running" ? "⏳ Updating ComfyUI…"
      : k.state === "done" ? "✓ ComfyUI " + (k.to && k.to !== k.from ? esc(k.from) + " → " + esc(k.to) : "is up to date") + (k.restarted ? " - starting again" : "")
      : "✗ " + esc(k.error || "the update failed");
    J.innerHTML = '<div class="kv"><b>' + head + '</b></div><div id="cuLog">' + S.lines.map(function (l) { return l.charAt(0) === "!" ? '<span class="e">' + esc(l.slice(2)) + "</span>" : esc(l); }).join("\n") + "</div>";
    var lg = $("cuLog"); if (lg) lg.scrollTop = lg.scrollHeight;
  }
  window.H3ComfyUpdate = { check: check, update: update, info: info, state: S };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
