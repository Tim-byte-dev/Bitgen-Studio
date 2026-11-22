/* bitGen Studio — static/needinstall.js (2.740.0): A PART THAT IS NOT INSTALLED YET - asked, then installed, in place
 * (window.H3NeedInstall).
 *
 * Tim (verbatim): "Create stopped at the split: demucs is not installed — press Install in the Stems dock , if a model
 * needs to be installed show the download/cancel msgbox and download the model instead of asking user to find install"
 *
 *   ensure(which, why) -> Promise<true = installed (now), false = not>   which = demucs | whisper (POST /api/audio/install
 *                 knows them) | h3sheet (2.870.0 - a Settings ▸ Add-ons add-on: /api/addons/h3sheet/install + /api/addons/job)
 *                 | h3long (2.872.0 - the same way) | longcat (2.918.0);
 *                 why = what it is needed for, said in the box. Installed already (GET its status) = true at
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
    // 2.870.0: an add-on (Settings ▸ Add-ons) - installed by /api/addons/<addon>/install, followed on /api/addons/job
    h3sheet: { name: "H3 Character Sheet Designer", desc: "Makes the character sheet: the designer's node pack in ComfyUI and the MiniMax H3 Image model that draws it.",
      hint: "about 28 GB: the node pack (under 1 MB) and MiniMax H3 Image (transformer + VAE) into ComfyUI's models, plus the MiniMax H3 text encoder if the video has not brought it yet; ComfyUI 0.45 or newer, restarted once afterwards",
      status: "/api/charsheet/h3", addon: "h3sheet" },
    // 2.872.0: H3 Long Video (Settings ▸ Add-ons ▸ H3 Long Video)
    h3long: { name: "H3 Long Video", desc: "Chains MiniMax H3 shots into one long video - each shot starts from the last frame of the one before.",
      hint: "about 21 GB: the H3-LongVideos node pack (from its own page), PlagueKind's and NVIDIA's VFX node packs, and MATLOWAI's fused turbo MiniMax H3 model, plus the MiniMax H3 text encoder and VAEs if you do not have them; ComfyUI restarted once afterwards",
      status: "/api/h3long", addon: "h3long" },
    // 2.890.0: PAN 2 (Settings ▸ Add-ons ▸ PAN 2)
    pan2: { name: "PAN 2", desc: "MBZUAI's world model: your words (or a first picture + words) become a video of up to 20 seconds.",
      hint: "about 38 GB: the int8 PAN 2 model, its Qwen3.5 9B text encoder and the Wan 2.2 VAE into ComfyUI's models; ComfyUI 0.46.0 or newer, restarted once afterwards",
      status: "/api/pan2", addon: "pan2" },
    // 2.918.0: LongCat Avatar 1.6 (Settings ▸ Add-ons ▸ LongCat Avatar 1.6)
    longcat: { name: "LongCat Avatar 1.6", desc: "Makes a person talk or sing to a sound: Meituan's LongCat-Video-Avatar in ComfyUI.",
      hint: "about 28 GB: the LongCat Avatar node pack, the int8 model (16 GB), its two LoRAs, Whisper large-v3 and Wan 2.1's text encoder + VAE (skipped when you have them) into ComfyUI; ComfyUI restarted once afterwards",
      status: "/api/longcat", addon: "longcat" },
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
  /** 2.870.0: an add-on part - its Settings ▸ Add-ons install, followed line by line; resolves {ok, error} */
  function installAddon(P, ui) {
    return root.fetch("/api/addons/" + encodeURIComponent(P.addon) + "/install", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.error || !j.ok) throw new Error(j.error || "the install could not be started");
        log("installing " + P.addon + " (Settings ▸ Add-ons)");
        var from = 0, lines = [];
        return new Promise(function (resolve) {
          (function tick() {
            if (ui.gone()) { resolve({ ok: false, error: "closed" }); return; }
            root.fetch("/api/addons/job?from=" + from).then(function (r) { return r.json(); }).then(function (jj) {
              if (Array.isArray(jj.lines)) { lines = lines.concat(jj.lines).slice(-40); from = jj.next || from; }
              var t = lastLine(lines), m = /(\d+) %$/.exec(t);
              ui.progress(m ? +m[1] : null, t);
              var st = jj.job && jj.job.state;
              if (st === "done") { resolve({ ok: true }); return; }
              if (st && st !== "running") { resolve({ ok: false, error: (jj.job.error || "the install failed") }); return; }
              setTimeout(tick, 1500);
            }).catch(function () { setTimeout(tick, 2500); });
          })();
        });
      });
  }
  function install(which, ui) {
    if (PARTS[which] && PARTS[which].addon) return installAddon(PARTS[which], ui);
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
