/* bitGen Studio — static/llmtab.js (2.596.0): Settings ▸ LLM - the llama.cpp ENGINE line, ⬇ Install / ⟳ Update with their
 * progress right here, and every button showing what it is doing (window.H3LlmTab).
 *
 * Tim (verbatim): "add update llama in llm tab in settings. when updating, loading saving, onlclick show the action is
 * being done".
 *   the engine line   "llama.cpp b10456 · the newest is b10601 - ⟳ Update available" / "up to date" / "not installed"
 *                     (GET /api/llm/engine?check=1 when the LLM tab opens; "checking…" meanwhile)
 *   ⬇ Install engine  (shown while it is not installed) / ⟳ Update llama.cpp (while it is): POST /api/llm/engine/<act>,
 *                     the job's lines in the small log under it, the button "⏳ Updating llama.cpp… 37 s" until done;
 *                     the Settings window stays open (the old Install closed it and jumped to the queue)
 *   ▶ Start server    "⏳ Starting…" then "⏳ Loading <model>…" until llama-server is ready (GET /api/llms), "✓ Model loaded"
 *   ■ Stop, ↻ Rescan, 🔎 Scan folder, and Settings' Save - "⏳ Stopping / Scanning / Saving…" then ✓ (static/busy.js)
 * Pure (Node): engineWords(e). */
(function (root) {
  "use strict";
  function engineWords(e) {
    if (!e) return "llama.cpp: not checked yet";
    if (!e.installed) return "llama.cpp is not installed - ⬇ Install engine puts it in " + (e.dir || "the engine folder");
    var v = "llama.cpp " + (e.version || "(version unknown)");
    var L = e.latest || null;
    if (!L) return v;
    if (L.error) return v + " · could not check for a newer one (" + L.error + ")";
    if (e.update) return v + " · the newest is " + L.tag + " - ⟳ Update available";
    return v + " · up to date (the newest is " + L.tag + ")";
  }
  if (typeof module !== "undefined" && module.exports && typeof document === "undefined") { module.exports = { engineWords: engineWords }; return; }

  var $ = function (id) { return document.getElementById(id); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var J = function (r) { return r.json().catch(function () { return {}; }).then(function (x) { if (!r.ok) throw new Error(x.error || ("HTTP " + r.status)); return x; }); };
  var last = null;

  function paintEngine(e) {
    last = e;
    var line = $("s_llmengver"); if (line) { line.textContent = engineWords(e); line.style.color = e && e.update ? "var(--tiger,#f59e2c)" : ""; }
    var ins = $("s_llminstall"), up = $("s_llmupdate");
    if (ins && !(root.H3Busy && root.H3Busy.isBusy(ins))) ins.style.display = e && e.installed ? "none" : "";
    if (up && !(root.H3Busy && root.H3Busy.isBusy(up))) {
      up.style.display = e && e.installed ? "" : "none";
      up.style.borderColor = up.style.color = e && e.update ? "var(--tiger,#f59e2c)" : "";
    }
  }
  function refreshEngine(check) {
    var line = $("s_llmengver");
    if (line && check) line.textContent = "⏳ llama.cpp: checking the installed and the newest version…";
    return fetch("/api/llm/engine" + (check ? "?check=" + (check === "force" ? "force" : "1") : "")).then(J).then(function (e) {
      paintEngine(e);
      if (e.job && e.job.state === "running") follow(e.job.action);
      return e;
    }).catch(function (er) { if (line) line.textContent = "llama.cpp: " + er.message; });
  }

  /** follow the install / update job: its lines in the log box, the button's words */
  function watch(say) {
    var logBox = $("s_llmenglog"), from = 0;
    if (logBox) { logBox.style.display = ""; logBox.textContent = ""; }
    return (function poll() {
      return fetch("/api/llm/engine/job?from=" + from).then(J).then(function (r) {
        var j = r.job;
        if (!j) throw new Error("the job is gone - the app restarted?");
        if (j.lines.length && logBox) {
          logBox.textContent += (logBox.textContent ? "\n" : "") + j.lines.join("\n");
          logBox.scrollTop = logBox.scrollHeight;
          var dl = j.lines.slice().reverse().find(function (l) { return /download|expand|stopping|scanning|using b\d+|llama\.cpp b\d+/i.test(l); });
          if (dl && say) say((j.action === "update" ? "Updating llama.cpp" : "Installing llama.cpp") + " - " + dl.replace(/^\[\.\.\]\s*/, "").slice(0, 60));
        }
        from = j.n;
        if (j.state === "running") return sleep(1000).then(poll);
        if (j.state === "error") throw new Error(j.error || "the " + j.action + " failed - see the lines above");
        return j;
      });
    })();
  }
  function engineAct(act, btn, resume) {
    var b = btn || $(act === "update" ? "s_llmupdate" : "s_llminstall");
    if (!b || !root.H3Busy) return Promise.resolve(null);
    var words = act === "update" ? { doing: "Updating llama.cpp", done: "Updated" } : { doing: "Installing llama.cpp", done: "Installed" };
    return root.H3Busy.run(b, Object.assign({ status: "s_llmengver" }, words), function (say) {
      var go = resume ? Promise.resolve() : fetch("/api/llm/engine/" + act, { method: "POST" }).then(J);
      return go.then(function () { return watch(say); }).then(function (j) {
        return refreshEngine(true).then(function () {
          if (typeof root.refreshLlms === "function") { try { root.refreshLlms(); } catch (e) { /* fine */ } }
          var line = $("s_llmengver");
          if (line) line.textContent = "✓ " + (act === "update" ? (j.before && j.before === j.after ? "llama.cpp " + j.after + " was already the newest" : "llama.cpp updated" + (j.before ? " " + j.before + " -> " : " to ") + (j.after || "")) : "llama.cpp " + (j.after || "") + " installed") + " · " + engineWords(last).replace(/^llama\.cpp [^·]*·\s*/, "");
        });
      });
    }).catch(function () { /* shown on the line */ });
  }
  function follow(act) { var b = $(act === "update" ? "s_llmupdate" : "s_llminstall"); if (b && root.H3Busy && !root.H3Busy.isBusy(b)) engineAct(act, b, true); }

  /** ▶ Start server: the start, then the model loading until llama-server says ready */
  function startServer(btn) {
    return root.H3Busy.run(btn, { doing: "Starting the server", done: "Model loaded", status: "s_llmstatus2", hold: 1800 }, function (say) {
      var file = $("s_llmpick") ? $("s_llmpick").value : "";
      return Promise.resolve(typeof root.llmServer === "function" ? root.llmServer("start") : fetch("/api/llm/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file: file }) }))
        .then(function () {
          var t0 = Date.now();
          return (function poll() {
            return fetch("/api/llms").then(J).then(function (j) {
              if (!j.running) throw new Error((($("s_llmstatus2") || {}).textContent || "").replace(/^[⏳✓✗]\s*/, "") || "the server did not start");
              if (j.running.ready) return j;
              say("Loading " + String(j.running.file || file).replace(/\.gguf$/i, "").slice(0, 40));
              if (Date.now() - t0 > 10 * 60000) throw new Error("the model is still loading after 10 minutes - see the console");
              return sleep(1000).then(poll);
            });
          })();
        }).then(function (j) { if (typeof root.refreshLlms === "function") { try { root.refreshLlms(); } catch (e) { /* fine */ } } return j; });
    }).catch(function () { /* shown */ });
  }

  function boot() {
    if (!root.H3Busy || !$("s_llmupdate")) return false;
    var B = root.H3Busy;
    $("s_llminstall").onclick = function () { return engineAct("install", this); };
    $("s_llmupdate").onclick = function () {
      var msg = "Update llama.cpp to the newest build?\n\nThe LLM server and the vision model stop first (they start again when a model is next used). Your models and settings stay.";
      if (last && last.latest && last.latest.tag) msg = "Update llama.cpp " + (last.version || "") + " -> " + last.latest.tag + "?\n\n" + msg.split("\n\n")[1];
      if (!root.confirm(msg)) return null;
      return engineAct("update", this);
    };
    if ($("s_llmstart")) $("s_llmstart").onclick = function () { return startServer(this); };
    B.wrap("s_llmstop", { doing: "Stopping the server", done: "Stopped", status: "s_llmstatus2" });
    B.wrap("s_llmrescan", { doing: "Scanning the LLM folder", done: "Scanned" });
    B.wrap("s_visscan", { doing: "Scanning", done: "Scanned" });
    B.wrap("s_save", { doing: "Saving", done: "Saved" });
    var tab = document.querySelector('#settings .stabs [data-stab="llm"]');
    if (tab && !tab.dataset.h3eng) { tab.dataset.h3eng = "1"; tab.addEventListener("click", function () { refreshEngine(true); }); }
    var dlg = $("settings");
    if (dlg && !dlg.dataset.h3eng) {
      dlg.dataset.h3eng = "1";
      new MutationObserver(function () { if (dlg.open) { var t = document.querySelector('#settings .stabs [data-stab="llm"]'); if (t && t.classList.contains("active")) refreshEngine(true); } }).observe(dlg, { attributes: true, attributeFilter: ["open"] });
    }
    refreshEngine(false);
    return true;
  }
  // after index.html's own script has set its handlers (it runs after this file)
  var go = function () { setTimeout(function () { if (!boot()) setTimeout(boot, 1500); }, 0); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
  root.H3LlmTab = { refreshEngine: refreshEngine, engineAct: engineAct, startServer: startServer, engineWords: engineWords, boot: boot, state: function () { return last; } };
})(typeof window !== "undefined" ? window : globalThis);
