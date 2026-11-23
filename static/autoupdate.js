/* bitGen Studio — static/autoupdate.js (2.925.0): ⟳ UPDATING BY ITSELF + THE 📱 APP BUILT AGAIN (window.H3AutoUpdate).
 * Tim: "is there a way to make the phone app update from github? instead of contantly copying and pasting?" -> "B) PC
 * auto-updates". The server does the work (lib/autoUpdate.js, every few hours: GitHub -> ⤓ the update -> the app built again
 * when its source changed); this page adds its switches to Settings ▸ General ▸ ⟳ Updates and the RESTART BAR: when an update
 * needs a restart, the desktop app restarts itself after a 60 s countdown while nothing is running (⟳ Restart now / Later =
 * an hour); in a browser the bar asks you to start bitGen Studio again (start.bat). After the restart the app is built.
 * Pure (Node): line(state, settings, now) - the status line. */
(function (root) {
  "use strict";
  function when(t, now) {
    if (!t) return "";
    var d = new Date(t), n = new Date(now || Date.now()), hm = ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
    return d.toDateString() === n.toDateString() ? hm : d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " " + hm;
  }
  /** the status line under the switches (pure) */
  function line(st, set, now) {
    var s = st || {}, g = set || {}, bits = [];
    if (!g.auto) return "Off - ⤓ Update now by hand, and 🔨 Build the app yourself.";
    if (s.restart) bits.push("✓ updated " + s.restart.from + " → " + s.restart.to + " - restarting finishes it");
    else if (s.state === "updating") bits.push("⏳ " + (s.note || "updating"));
    else if (s.state === "error") bits.push("✗ " + (s.error || "it stopped") + " - again at the next look");
    else if (s.busy) bits.push("⏸ " + s.note);
    else if (s.last_check) bits.push("looked " + when(s.last_check, now) + (s.current ? " - " + (s.latest && s.latest !== s.current ? s.latest + " on GitHub" : "the newest (" + s.current + ")") : ""));
    else bits.push("the first look is a minute or two after bitGen Studio starts");
    if (s.next_check && !s.restart) bits.push("next look " + when(s.next_check, now));
    if (g.app && s.app && s.app.note) bits.push("📱 " + s.app.note);
    return bits.join(" · ");
  }
  var API = { line: line, when: when };
  if (typeof module !== "undefined" && module.exports && typeof document === "undefined") { module.exports = API; return; }

  var doc = root.document, S = { set: null, st: null, count: 0, timer: null, tick: null };
  function $(id) { return doc.getElementById(id); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function jpost(u, b) { return fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json(); }); }
  var desktop = function () { return !!(root.h3shell && root.h3shell.relaunch); };

  /* ---- the switches in ⟳ Updates (made by static/updater.js) */
  function rows() {
    var sec = $("upSec"); if (!sec || $("auBox")) return !!$("auBox");
    var d = doc.createElement("div"); d.id = "auBox";
    d.style.cssText = "border-top:1px solid var(--line,#3a352e);margin-top:8px;padding-top:6px";
    d.innerHTML = '<label class="kv" style="display:flex;gap:6px;align-items:center;cursor:pointer" title="bitGen Studio looks on GitHub every few hours and, when there is a newer version, updates itself (your projects, settings, styles and models are never touched) - then restarts when nothing is running">'
      + '<input type="checkbox" id="auOn"> <b>Update bitGen Studio from GitHub by itself</b>, every <select id="auEvery"><option value="1">hour</option><option value="3">3 hours</option><option value="6">6 hours</option><option value="12">12 hours</option><option value="24">day</option></select></label>'
      + '<label class="kv" style="display:flex;gap:6px;align-items:center;cursor:pointer;margin-left:20px" title="When the update changed the 📱 bitGen app, bitGen builds it again (Settings ▸ General ▸ 📱 The bitGen App - built here once before, the build tools here) with the theme of your last build; the phone\'s ⬆ Update then finds it">'
      + '<input type="checkbox" id="auApp"> then build the 📱 app again when it changed - the phone\'s ⬆ Update installs it</label>'
      + '<div class="kv" id="auLine" style="margin-left:20px"></div>'
      + '<div class="btns" style="margin-left:20px"><button type="button" class="ghost" id="auNow" title="Look on GitHub now (and update, and build the app, when there is something new)">⟳ Look now</button></div>';
    sec.appendChild(d);
    $("auOn").onchange = function () { save({ auto: this.checked }); };
    $("auEvery").onchange = function () { save({ every_h: +this.value }); };
    $("auApp").onchange = function () { save({ app: this.checked }); };
    $("auNow").onclick = function () { $("auLine").textContent = "Asking GitHub…"; jpost("/api/update/auto/check", {}).then(take).then(function () { setTimeout(poll, 2500); }).catch(function () {}); };
    return true;
  }
  function save(b) { return jpost("/api/update/auto", b).then(take).catch(function () { /* offline */ }); }
  function take(r) {
    if (!r || !r.settings) return r;
    S.set = r.settings; S.st = r.state;
    if ($("auOn")) { $("auOn").checked = !!S.set.auto; $("auEvery").value = String(S.set.every_h); $("auApp").checked = !!S.set.app; $("auApp").disabled = !S.set.auto; $("auEvery").disabled = !S.set.auto; }
    if ($("auLine")) $("auLine").textContent = line(S.st, S.set);
    bar();
    return r;
  }
  function poll() { return fetch("/api/update/auto").then(function (r) { return r.json(); }).then(take).catch(function () { /* restarting / offline */ }); }

  /* ---- the restart bar */
  function bar() {
    var st = S.st || {}, b = $("auBar");
    var show = !!st.restart && Date.now() >= (st.later_until || 0);
    if (!show) { if (b) b.remove(); clearInterval(S.tick); S.tick = null; return; }
    if (!b) {
      b = doc.createElement("div"); b.id = "auBar"; b.setAttribute("role", "status");
      b.style.cssText = "position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:99990;background:var(--panel,#1d1a15);color:var(--text,#e8e2d6);border:1px solid var(--tiger,#f59e2c);border-radius:8px;padding:8px 12px;display:flex;gap:10px;align-items:center;box-shadow:0 6px 24px rgba(0,0,0,.45);font-size:13px;max-width:92vw";
      b.innerHTML = '<span id="auBarText"></span><button type="button" id="auBarGo">⟳ Restart now</button><button type="button" class="ghost" id="auBarLater" title="Ask again in an hour">Later</button>';
      doc.body.appendChild(b);
      $("auBarGo").onclick = function () { restart(); };
      $("auBarLater").onclick = function () { jpost("/api/update/auto/later", {}).then(take); };
      S.count = 60;
    }
    var head = "⟳ bitGen Studio was updated " + esc(st.restart.from) + " → " + esc(st.restart.to) + " from GitHub - ";
    if (!desktop()) {
      $("auBarText").innerHTML = head + "close the window running start.bat (or bitgen-studio.sh) and start it again to finish; then the 📱 app is built.";
      $("auBarGo").hidden = true; clearInterval(S.tick); S.tick = null; return;
    }
    if (st.busy) { $("auBarText").innerHTML = head + "restarting when " + esc(st.busy.replace(/^waiting - /, "")) + " finishes."; S.count = 60; return; }
    $("auBarText").innerHTML = head + "restarting in <b id=\"auBarN\">" + S.count + "</b> s to finish (then the 📱 app is built).";
    if (!S.tick) S.tick = setInterval(function () {
      if (!$("auBar")) { clearInterval(S.tick); S.tick = null; return; }
      S.count--; if ($("auBarN")) $("auBarN").textContent = String(Math.max(0, S.count));
      if (S.count <= 0) { clearInterval(S.tick); S.tick = null; restart(); }
    }, 1000);
  }
  function restart() {
    var b = $("auBarText"); if (b) b.textContent = "⟳ Restarting bitGen Studio…";
    if (root.H3Updater && root.H3Updater.restart) return root.H3Updater.restart();
    if (desktop()) return root.h3shell.relaunch();
    return null;
  }

  function start() {
    var n = 0, t = setInterval(function () { if (rows() || ++n > 120) clearInterval(t); if ($("auBox")) poll(); }, 1000);
    poll();
    S.timer = setInterval(poll, 60000);
  }
  root.H3AutoUpdate = { line: line, poll: poll, state: S, restart: restart };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
