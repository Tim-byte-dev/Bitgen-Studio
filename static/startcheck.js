/* bitGen Studio — static/startcheck.js (2.573.0): THE UPDATE CHECK ON STARTUP (window.H3StartCheck).
 * Tim: "do an autocheck on startup for latest version of bitgen and comfyui".
 * A little after the app starts (so it never slows the start), one look at GitHub for both:
 *   bitGen Studio  POST /api/update/check        (lib/updater.js - the version on GitHub, the new commits)
 *   ComfyUI        POST /api/comfy/update/check  {fetch:false} (lib/comfyUpdate.js - the version files only, no git)
 * Something newer -> a ⬆ chip in the status bar (stays until updated; a click opens the right Settings tab) and, once
 * per new version, a small card: Open / Later / "Don't check on startup". Offline or switched off -> nothing at all.
 * The switch: Settings ▸ General ▸ ⟳ Updates ▸ "Check for updates on startup" (config.update.auto_check, on by default).
 * Replaces the old silent look in static/updater.js (it wrote to the console only). */
(function () {
  "use strict";
  var DELAY = 20000;
  var S = { bitgen: null, comfy: null, done: false };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function post(u, b) { return fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json(); }); }
  function seen(key, v) {
    try { if (v === undefined) return localStorage.getItem(key) || ""; localStorage.setItem(key, v); } catch (e) { /* private window */ }
    return "";
  }
  var CSS = "#sbUpd{cursor:pointer;color:var(--tiger,#f59e2c);margin-left:10px;white-space:nowrap}"
    + "#updCard{position:fixed;right:16px;bottom:34px;z-index:9999;max-width:360px;background:var(--panel,#1d1a16);color:var(--text,#ddd);"
    + "border:1px solid var(--tiger,#f59e2c);border-radius:8px;padding:10px 12px;font-size:12.5px;box-shadow:0 6px 24px rgba(0,0,0,.45)}"
    + "#updCard b{color:var(--tiger,#f59e2c)}#updCard ul{margin:6px 0;padding-left:18px}#updCard .row{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}";

  function lines() {
    var out = [];
    var b = S.bitgen, c = S.comfy;
    if (b && b.newer) out.push({ k: "bitgen", tab: "general", text: "bitGen Studio " + (b.latest || "update") + " (you have " + (b.current || "?") + ")", ver: b.latest || ("+" + b.behind) });
    if (c && c.newer) {
      var t = c.channel === "stable" ? c.latest : (c.master || c.latest);
      out.push({ k: "comfy", tab: "comfy", text: "ComfyUI " + (t || "update") + " (you have " + (c.current || "?") + ")", ver: t || "new" });
    }
    return out;
  }
  function openTab(tab) {
    var b = $("openSettings"); if (b) b.click();
    setTimeout(function () {
      var t = document.querySelector('[data-stab="' + tab + '"]'); if (t) t.click();
      if (tab === "comfy") { var e = document.querySelector('[data-ctab="engine"]'); if (e) e.click(); var s = $("cuSec"); if (s && s.scrollIntoView) s.scrollIntoView({ block: "center" }); }
      else { var u = $("upSec"); if (u && u.scrollIntoView) u.scrollIntoView({ block: "center" }); }
    }, 120);
  }
  function chip() {
    var L = lines(), el = $("sbUpd");
    if (!L.length) { if (el) el.remove(); return; }
    if (!el) {
      var host = $("sbcomfy"); if (!host || !host.parentNode) return;
      el = document.createElement("span"); el.id = "sbUpd";
      host.parentNode.insertBefore(el, host.nextSibling);
      el.onclick = function () { var l = lines(); openTab(l.length ? l[0].tab : "general"); };
    }
    el.textContent = "⬆ " + (L.length > 1 ? "Updates (2)" : L[0].k === "comfy" ? "ComfyUI update" : "bitGen update");
    el.title = L.map(function (x) { return x.text; }).join("\n") + "\nClick: Settings, where ⤓ Update installs it";
  }
  function card() {
    var L = lines().filter(function (x) { return seen("h3.update.seen." + x.k) !== x.ver; });
    if (!L.length || $("updCard")) return;
    var d = document.createElement("div"); d.id = "updCard"; d.setAttribute("role", "status");
    d.innerHTML = "<b>⬆ Updates available</b><ul>" + L.map(function (x) { return "<li>" + esc(x.text) + "</li>"; }).join("") + "</ul>"
      + '<div class="row"><button type="button" id="updOpen">Open Settings</button><button type="button" class="ghost" id="updLater">Later</button>'
      + '<button type="button" class="ghost" id="updOff" title="Turn the check on startup off (Settings ▸ General ▸ ⟳ Updates turns it on again)">Don\'t check on startup</button></div>';
    document.body.appendChild(d);
    var close = function () { L.forEach(function (x) { seen("h3.update.seen." + x.k, x.ver); }); d.remove(); };
    $("updOpen").onclick = function () { close(); openTab(L[0].tab); };
    $("updLater").onclick = close;
    $("updOff").onclick = function () { close(); setAuto(false); };
  }
  function setAuto(on) {
    return post("/api/update/settings", { auto_check: !!on }).then(function (r) { var b = $("upAuto"); if (b) b.checked = !!r.auto_check; return r; }).catch(function () { return null; });
  }
  function run(force) {
    return fetch("/api/update/settings").then(function (r) { return r.json(); }).catch(function () { return { auto_check: true }; }).then(function (st) {
      if (!force && st && st.auto_check === false) return null;
      return Promise.all([
        post("/api/update/check").catch(function () { return null; }),
        post("/api/comfy/update/check", { fetch: false }).catch(function () { return null; })
      ]).then(function (res) {
        S.bitgen = res[0]; S.comfy = res[1]; S.done = true;
        chip(); card();
        if (window.H3TestEvent) window.H3TestEvent("startup_update_check", lines().map(function (x) { return x.k; }).join(",") || "none");
        return S;
      });
    });
  }
  /** an update just finished - drop its line */
  function clear(k) { if (k === "comfy") S.comfy = null; else S.bitgen = null; chip(); }
  function boot() {
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    setTimeout(function () { run(false); }, DELAY);
  }
  window.H3StartCheck = { run: run, clear: clear, setAuto: setAuto, state: S, openTab: openTab };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
