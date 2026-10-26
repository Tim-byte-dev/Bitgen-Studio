/* bitGen Studio — static/installbtn.js (2.601.0): INSTALL / DOWNLOAD BUTTONS SAY WHAT IS HAPPENING (window.H3Install).
 *
 * Tim (verbatim): "if an addon/package/model has been installed change the button to reinstall", then
 * "when installing an addon - let the user know the status next to the button and disable the button when
 * download/install starts. do this with all buttons so user knows whats happening."
 *
 *   label(text, installed)   "⬇ Install sd-cli (…)" -> "⟳ Reinstall sd-cli (…)"; "⤓ Download" -> "⟳ Download again";
 *                            not installed = the text as it is
 *   set(btn, installed, o)   the button's Install label (kept the first time) or its Reinstall one; the tooltip says what
 *                            a reinstall does; data-installed="1|0", class h3re (green). o: {install, reinstall, title}
 *   start(btn, text)         the button is DISABLED (aria-busy) and a status chip right beside it says "⏳ text 12 s"
 *   step(btn, text)          the chip's words (a log line, "43 %", "file 2 of 5")
 *   end(btn, ok, text)       the button comes back; the chip says "✓ text" / "✗ text" (it stays - the last word)
 *   job(btn, id, o)          follows an app job (GET /api/jobs/<id>): start, then its progress or last log line every
 *                            1.5 s, then end (done / failed / cancelled); o = {doing, done, after(job)} -> a Promise
 *   poll(btn, fn, o)         the same for anything else: fn() -> Promise {running, text, ok, error}
 *   busy(btn)                it is running
 * window.H3Reinstall = the same object (label / set). Pure (Node): label(text, installed), lastLine(lines), secs(ms). */
(function (root) {
  "use strict";
  var ICON = "(?:[\\u2B07\\u2913\\u2699\\u21BB\\u27F3\\u2713\\u2714]\\uFE0F?\\s*)?";
  var INST = new RegExp("^\\s*" + ICON + "(?:Re-?install|Install)(?:\\s*/\\s*(?:repair|update))?\\b\\s*", "i");
  var DOWN = new RegExp("^\\s*" + ICON + "(?:Re-?download|Download)(?:\\s+again)?\\b\\s*", "i");
  function label(text, installed) {
    var t = String(text == null ? "" : text);
    if (!installed) return t;
    if (INST.test(t)) { var r = t.replace(INST, ""); return "⟳ Reinstall" + (r ? " " + r : ""); }
    if (DOWN.test(t)) { var d = t.replace(DOWN, ""); return "⟳ Download again" + (d ? " " + d : ""); }
    return "⟳ " + t.replace(new RegExp("^\\s*" + ICON), "");
  }
  /** the last log line worth showing (no blank lines, no bare progress bars), short */
  function lastLine(lines) {
    var a = Array.isArray(lines) ? lines : [];
    for (var i = a.length - 1; i >= 0; i--) {
      var l = String(a[i] || "").replace(/\x1b\[[0-9;]*m/g, "").replace(/^\[[^\]]{1,24}\]\s*/, "").trim();
      if (l && !/^[\s|█▏▎▍▌▋▊▉#=\-.>]+$/.test(l)) return l.length > 90 ? l.slice(0, 87) + "…" : l;
    }
    return "";
  }
  function secs(ms) { var s = Math.floor(Math.max(0, ms) / 1000); return s < 2 ? "" : s < 60 ? s + " s" : Math.floor(s / 60) + " min " + (s % 60) + " s"; }
  if (typeof module !== "undefined" && module.exports && typeof document === "undefined") { module.exports = { label: label, lastLine: lastLine, secs: secs }; return; }

  var TIP = "Installed - press to install it again over the top (repairs a broken or half-finished install)";
  function css() {
    if (document.getElementById("h3instCss")) return;
    var s = document.createElement("style"); s.id = "h3instCss";
    s.textContent = "button.h3re{border-color:var(--ok,#4c4) !important;color:var(--ok,#7c7) !important}"
      + ".h3inst{display:inline-flex;align-items:center;gap:5px;margin:0 6px;font-size:.78rem;opacity:.9;vertical-align:middle;max-width:46ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
      + ".h3inst.run::before{content:'';width:.75em;height:.75em;flex:none;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:h3instspin .8s linear infinite}"
      + ".h3inst.run{color:var(--tiger,#f59e2c)}.h3inst.ok{color:var(--ok,#4c4)}.h3inst.bad{color:var(--bad,#e55)}"
      + "button[aria-busy=true]{cursor:progress !important;opacity:.7}"
      + "@keyframes h3instspin{to{transform:rotate(360deg)}}";
    (document.head || document.documentElement).appendChild(s);
  }
  function set(btn, installed, o) {
    if (!btn) return btn;
    o = o || {};
    css();
    if (btn.dataset.h3Install == null) { btn.dataset.h3Install = btn.textContent; btn.dataset.h3InstallTip = btn.title || ""; }
    if (o.install) btn.dataset.h3Install = o.install;
    var base = btn.dataset.h3Install;
    btn.textContent = installed ? (o.reinstall || label(base, true)) : base;
    btn.title = installed ? (o.title || TIP) : btn.dataset.h3InstallTip;
    btn.classList.toggle("h3re", !!installed);
    btn.setAttribute("data-installed", installed ? "1" : "0");
    return btn;
  }

  var T = typeof WeakMap === "function" ? new WeakMap() : null;   // btn -> {t0, words, tick, timer}
  function st(btn) { var s = T && T.get(btn); if (!s) { s = {}; if (T) T.set(btn, s); } return s; }
  /** the status chip right after the button (made once) */
  function chip(btn) {
    css();
    var n = btn.nextElementSibling;
    if (n && n.classList && n.classList.contains("h3inst")) return n;
    var c = document.createElement("span");
    c.className = "h3inst"; c.setAttribute("role", "status"); c.setAttribute("aria-live", "polite");
    if (btn.id) c.id = btn.id + "_inst";
    btn.insertAdjacentElement("afterend", c);
    return c;
  }
  function paint(btn) {
    var s = st(btn), c = chip(btn), t = secs(Date.now() - s.t0);
    c.textContent = (s.words || "Working") + (t ? " · " + t : "");
    c.title = c.textContent;
  }
  function busy(btn) { return !!(btn && btn.dataset.h3inst === "1"); }
  function start(btn, text) {
    if (!btn) return btn;
    var s = st(btn);
    clearInterval(s.tick); clearTimeout(s.timer);
    s.t0 = Date.now(); s.words = String(text || "Working…");
    btn.dataset.h3inst = "1"; btn.disabled = true; btn.setAttribute("aria-busy", "true");
    var c = chip(btn); c.classList.remove("ok", "bad"); c.classList.add("run");
    paint(btn);
    s.tick = setInterval(function () { if (busy(btn)) paint(btn); }, 1000);
    return btn;
  }
  function step(btn, text) { if (!btn || !busy(btn)) return; if (text) st(btn).words = String(text); paint(btn); }
  function end(btn, ok, text) {
    if (!btn) return btn;
    var s = st(btn);
    clearInterval(s.tick); clearTimeout(s.timer);
    btn.dataset.h3inst = "0"; btn.disabled = false; btn.setAttribute("aria-busy", "false");
    var c = chip(btn); c.classList.remove("run"); c.classList.add(ok ? "ok" : "bad");
    c.textContent = (ok ? "✓ " : "✗ ") + String(text || (ok ? "Done" : "Failed"));
    c.title = c.textContent;
    return btn;
  }
  function poll(btn, fn, o) {
    o = o || {};
    start(btn, o.doing || "Installing…");
    var s = st(btn), every = o.every || 1500;
    return new Promise(function (res) {
      var finish = function (ok, text, r) {
        end(btn, ok, text);
        try { if (typeof o.after === "function") o.after(r, ok); } catch (e) { /* the status stays */ }
        res({ ok: ok, result: r });
      };
      (function loop() {
        Promise.resolve().then(fn).then(function (r) {
          r = r || {};
          if (r.running) { step(btn, r.text || o.doing); s.timer = setTimeout(loop, every); return; }
          if (r.ok) finish(true, r.text || o.done || "Installed", r);
          else finish(false, r.error || r.text || "Failed - see the console", r);
        }, function (e) {
          if ((s.miss = (s.miss || 0) + 1) > 5) finish(false, "lost touch with the app: " + (e && e.message || e));
          else s.timer = setTimeout(loop, every * 2);
        });
      })();
    });
  }
  /** an app job (the queue): its progress, else its last log line */
  function job(btn, id, o) {
    o = o || {};
    var from = 0, lines = [];
    return poll(btn, function () {
      return fetch("/api/jobs/" + encodeURIComponent(id) + "?log_from=" + from).then(function (r) {
        if (r.status === 404) return { error: "the job is gone" };
        return r.json();
      }).then(function (j) {
        if (j.error) return j;
        if (Array.isArray(j.log)) { lines = lines.concat(j.log).slice(-40); from = j.log_next || from; }
        var pr = j.progress && typeof j.progress.pct === "number" ? Math.round(j.progress.pct) + " %" : "";
        var last = lastLine(lines);
        var words = (o.doing || "Installing…") + (pr ? " " + pr : "") + (last ? " - " + last : "");
        if (j.status === "queued") return { running: true, text: (o.doing || "Installing…") + " - waiting in the Queue" };
        if (j.status === "running") return { running: true, text: words };
        if (j.status === "done") return { ok: true, text: o.done || "Installed", job: j };
        if (j.status === "cancelled") return { ok: false, error: "cancelled", job: j };
        return { ok: false, error: "failed" + (last ? " - " + last : " - see the console"), job: j };
      });
    }, o);
  }
  var api = { label: label, set: set, start: start, step: step, end: end, poll: poll, job: job, busy: busy, chip: chip, lastLine: lastLine, TIP: TIP };
  root.H3Install = api;
  root.H3Reinstall = api;
})(typeof window !== "undefined" ? window : globalThis);
