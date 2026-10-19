/* bitGen Studio — consoledock's OWN wiring (2.237.0, Tim: "no logs to show.
   show all logs in console and make it copiable"). The Job view is core's
   log follower, untouched (#log). The 🖼 Vision view (#vlog) polls
   GET /api/captioner/logs every 2 s WHILE VISIBLE and shows every line the
   captioner and the vision llama-server said; ⧉ Copy copies whichever view
   is showing. All DOM/fetch work in deferred handlers (the TDZ rule); no
   core globals are needed at all. */
(function () {
  function $(id) { return document.getElementById(id); }

  var conTimer = null;

  function conShow(src) {
    var tabs = $("conSrc");
    if (!tabs) return;
    tabs.querySelectorAll("button[data-consrc]").forEach(function (b) {
      b.classList.toggle("on", b.dataset.consrc === src);
    });
    $("log") && $("log").classList.toggle("hidden", src !== "job");
    $("vlog") && $("vlog").classList.toggle("hidden", src !== "vision");
    if (src === "vision") conVisionStart(); else conVisionStop();
  }

  function conVisionPaint(d) {
    var v = $("vlog");
    if (!v) return;
    var lines = (d && d.lines) || [];
    var st = (d && d.status) || {};
    var head = st.loading ? "… loading vision model" + (st.model ? " (" + st.model + ")" : "")
      : st.ready ? "● vision model ready" + (st.model ? " (" + st.model + ")" : "")
      : st.last_error ? "✕ last error: " + st.last_error
      : "○ vision model not running";
    var stick = v.scrollHeight - v.scrollTop - v.clientHeight < 40;
    v.textContent = head + "\n" + (lines.length ? lines.join("\n")
      : "— no vision activity yet — attach a picture with 🖼 Describe on, or pick a model in the Vision dropdown —");
    if (stick) v.scrollTop = v.scrollHeight;   // follow the tail unless the user scrolled up
  }

  function conVisionTick() {
    fetch("/api/captioner/logs").then(function (r) { return r.json(); })
      .then(conVisionPaint)
      .catch(function () { var v = $("vlog"); if (v) v.textContent = "the log endpoint did not answer — is the app server running?"; });
  }
  function conVisionStart() {
    if (conTimer) return;
    conVisionTick();
    conTimer = setInterval(conVisionTick, 2000);
  }
  function conVisionStop() {
    if (conTimer) { clearInterval(conTimer); conTimer = null; }
  }

  var tabs = $("conSrc");
  tabs && tabs.querySelectorAll("button[data-consrc]").forEach(function (b) {
    b.onclick = function () { conShow(b.dataset.consrc); };
  });

  $("conCopy") && ($("conCopy").onclick = function () {
    var vis = $("vlog") && !$("vlog").classList.contains("hidden") ? $("vlog") : $("log");
    var t = (vis && (vis.innerText || vis.textContent)) || "";
    if (!t.trim()) return;
    navigator.clipboard.writeText(t).then(
      function () { $("conCopy").textContent = "✓ Copied"; setTimeout(function () { $("conCopy").textContent = "⧉ Copy log"; }, 1500); },
      function () { $("conCopy").textContent = "select + Ctrl-C"; setTimeout(function () { $("conCopy").textContent = "⧉ Copy log"; }, 2500); });
  });
})();
