/* bitGen Studio — static/needinstall.js (2.740.0): A PART THAT IS NOT INSTALLED YET - asked, then installed, in place
 * (window.H3NeedInstall).
 *
 * Tim (verbatim): "Create stopped at the split: demucs is not installed — press Install in the Stems dock , if a model
 * needs to be installed show the download/cancel msgbox and download the model instead of asking user to find install"
 *
 *   ensure(which, why) -> Promise<true = installed (now), false = not>   which = demucs | whisper (POST /api/audio/install
 *                 knows them); why = what it is needed for, said in the box. Installed already (GET its status) = true at
 *                 once - the box is never shown for nothing.
 *   THE MESSAGE BOX  the same as the models-not-found one (static/modelsfound.js): what is missing, what it does, its
 *                 size, where it goes. ⬇ Download queues the install (the job the Stems / Speech dockers' Install buttons
 *                 run) and shows its progress bar and last log line until it is done - then the caller goes on by itself.
 *                 Cancel (or Esc, or Enter - it has the focus: a 2 GB download is never one stray key away) = false; an
 *                 install already running keeps going in the Queue.
 *   status(which) -> Promise<bool>   is it installed */
(function (root) {
  "use strict";
  var doc = root.document;
  var PARTS = {
    demucs: { name: "Song separation (demucs)", desc: "Splits a song into its layers - vocals, drums, bass and the rest.",
      hint: "about 2.5 GB: PyTorch and Meta's demucs, installed once into venvs/demucs; its model (about 80 MB) comes with the first split",
      status: "/api/stems" },
    whisper: { name: "Speech to text (Whisper)", desc: "Hears the words that are sung or spoken.",
      hint: "about 2 GB: PyTorch and faster-whisper, installed once into venvs/whisper; its model comes with the first use",
      status: "/api/asr" },
  };
  var open = null;                                       // one box at a time: a second ask for the same part shares it
  function el(tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function log(t) { try { if (typeof root.logLine === "function") root.logLine("[install] " + t); } catch (e) { /* no console */ } }
  function css() {
    if (doc.getElementById("nicss")) return;
    var s = el("style"); s.id = "nicss";
    s.textContent = "dialog.nidlg{width:min(620px,94vw);max-height:86vh;padding:14px 16px;display:flex;flex-direction:column;gap:8px}"
      + "dialog.nidlg:not([open]){display:none}"
      + ".nidlg h2{margin:0;font-size:1rem}"
      + ".nidlg .niwhy{font-size:.8rem;margin:0}"
      + ".nidlg .nipart{padding:8px 10px;border:1px solid var(--line);border-radius:6px;display:flex;flex-direction:column;gap:3px}"
      + ".nidlg .niname{font-weight:600;font-size:.82rem}"
      + ".nidlg .nidoes,.nidlg .nisize{font-size:.74rem;opacity:.85}"
      + ".nidlg .nibar{height:6px;border-radius:3px;background:var(--line);overflow:hidden;display:none}"
      + ".nidlg .nibar i{display:block;height:100%;width:0;background:var(--tiger);transition:width .4s}"
      + ".nidlg .nibar.busy i{width:35%;animation:niSlide 1.4s ease-in-out infinite}"
      + "@keyframes niSlide{0%{margin-left:-35%}100%{margin-left:100%}}"
      + "@media (prefers-reduced-motion: reduce){.nidlg .nibar.busy i{animation:none;width:100%;opacity:.5}}"
      + ".nidlg .niline{font-family:var(--mono);font-size:.7rem;opacity:.8;min-height:1.2em;word-break:break-all}"
      + ".nidlg .nierr{font-size:.76rem;color:#e66}"
      + ".nidlg .rowbtns{display:flex;gap:6px;justify-content:flex-end}";
    doc.head.appendChild(s);
  }
  function status(which) {
    var P = PARTS[which];
    if (!P) return Promise.resolve(true);
    return root.fetch(P.status).then(function (r) { return r.json(); }).then(function (j) { return !!(j && j.installed); }).catch(function () { return true; });  // cannot tell = let the caller try
  }
  function lastLine(lines) {
    for (var i = lines.length - 1; i >= 0; i--) { var t = String(lines[i] || "").trim(); if (t) return t.length > 160 ? t.slice(0, 157) + "…" : t; }
    return "";
  }
  /** queue the install and follow its job; resolves {ok, error} */
  function install(which, ui) {
    return root.fetch("/api/audio/install", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ which: which }) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.error || !j.id) throw new Error(j.error || "the install could not be queued");
        log("installing " + which + " - job " + j.id);
        var from = 0, lines = [];
        return new Promise(function (resolve) {
          (function tick() {
            if (ui.gone()) { resolve({ ok: false, error: "closed", job: j.id }); return; }
            root.fetch("/api/jobs/" + encodeURIComponent(j.id) + "?log_from=" + from).then(function (r) { return r.json(); }).then(function (jj) {
              if (Array.isArray(jj.log)) { lines = lines.concat(jj.log).slice(-40); from = jj.log_next || from; }
              var pct = jj.progress && typeof jj.progress.pct === "number" ? jj.progress.pct : null;
              ui.progress(pct, jj.status === "queued" ? "waiting in the Queue…" : lastLine(lines));
              if (jj.status === "done") { resolve({ ok: true }); return; }
              if (jj.status && jj.status !== "running" && jj.status !== "queued") { resolve({ ok: false, error: (jj.status === "cancelled" ? "cancelled" : "the install failed") + (lastLine(lines) ? " - " + lastLine(lines) : " - see the console") }); return; }
              setTimeout(tick, 1500);
            }).catch(function () { setTimeout(tick, 2500); });
          })();
        });
      });
  }
  function ask(which, why) {
    var P = PARTS[which];
    css();
    return new Promise(function (resolve) {
      var d = el("dialog", "nidlg"); d.id = "niDlg"; d.setAttribute("aria-labelledby", "niTitle");
      d.dataset.which = which;
      // (the words are written with textContent, so the UI translations - scripts/ui-dynamic.js - collect them)
      var h = el("h2"); h.id = "niTitle"; h.textContent = "⬇ " + P.name + " is not installed yet";
      var w = el("p", "niwhy"); w.textContent = why || ("This needs " + P.name + ".");
      var part = el("div", "nipart"), nm = el("div", "niname"), ds = el("div", "nidoes"), sz = el("div", "nisize");
      nm.textContent = P.name; ds.textContent = P.desc; sz.textContent = "Download: " + P.hint + ".";
      part.appendChild(nm); part.appendChild(ds); part.appendChild(sz);
      var bar = el("div", "nibar"), fill = el("i"); bar.appendChild(fill);
      var line = el("div", "niline", ""), err = el("div", "nierr", "");
      var btns = el("div", "rowbtns");
      var no = el("button", "ghost"); no.type = "button"; no.id = "niCancel"; no.textContent = "Cancel";
      var go = el("button", "ghost muPri"); go.type = "button"; go.id = "niGo"; go.textContent = "⬇ Download";
      go.style.cssText = "border-color:var(--tiger);color:var(--tiger)";
      btns.appendChild(no); btns.appendChild(go);
      [h, w, part, bar, line, err, btns].forEach(function (x) { d.appendChild(x); });
      doc.body.appendChild(d);
      var done = false, closed = false;
      function finish(v) { if (done) return; done = true; closed = true; try { d.close(); } catch (e) { /* closed */ } d.remove(); open = null; resolve(v); }
      d.addEventListener("cancel", function (e) { e.preventDefault(); finish(false); });
      no.onclick = function () { if (go.disabled) log(P.name + " - the install keeps going in the Queue"); finish(false); };
      go.onclick = function () {
        go.disabled = true; go.textContent = "⏳ Downloading…"; err.textContent = "";
        bar.style.display = "block"; bar.classList.add("busy");
        no.textContent = "Close";
        no.title = "Close this box - the install keeps going in the Queue";
        install(which, {
          gone: function () { return closed; },
          progress: function (pct, text) {
            if (pct != null) { bar.classList.remove("busy"); fill.style.width = Math.max(2, Math.min(100, pct)) + "%"; }
            line.textContent = text || "";
          },
        }).then(function (r) {
          if (closed) return;
          if (r.ok) { bar.classList.remove("busy"); fill.style.width = "100%"; line.textContent = "✓ " + P.name + " installed"; test("ni_installed", which); setTimeout(function () { finish(true); }, 400); return; }
          go.disabled = false; go.textContent = "⬇ Try again"; no.textContent = "Cancel"; bar.classList.remove("busy");
          err.textContent = "✗ " + r.error;
        }).catch(function (e) {
          if (closed) return;
          go.disabled = false; go.textContent = "⬇ Try again"; no.textContent = "Cancel"; bar.classList.remove("busy");
          err.textContent = "✗ " + ((e && e.message) || e);
        });
      };
      try { d.showModal(); } catch (e) { d.setAttribute("open", ""); }
      no.focus();                                        // Enter = Cancel
      test("ni_ask", which);
    });
  }
  function test(k, v) { try { if (root.H3TestEvent) root.H3TestEvent(k, v); } catch (e) { /* the 🧪 list */ } }
  function ensure(which, why) {
    if (!PARTS[which]) return Promise.resolve(true);
    return status(which).then(function (ok) {
      if (ok) return true;
      if (open && open.which === which) return open.p;
      var p = ask(which, why);
      open = { which: which, p: p };
      return p;
    });
  }
  root.H3NeedInstall = { ensure: ensure, status: status, PARTS: PARTS };
})(typeof window !== "undefined" ? window : globalThis);
