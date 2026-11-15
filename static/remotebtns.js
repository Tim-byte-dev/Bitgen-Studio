/* bitGen Studio — static/remotebtns.js (2.783.0): THE STATUS BAR'S REMOTE AND PODS BUTTONS (window.H3RemoteBtns;
 * static/remotedock.js, static/podsdock.js, GET /api/gpusplit, GET /api/remotegen).
 *
 * Tim (verbatim): "remove the gpu menuitem in basic settings, add remote docker button to the statusbar, if any of the tools
 * use remote generation show Pods button in statusbar for the pods docker if everything is in local mode then hide the pods
 * button."
 *   Remote   shows / hides the ☁ Remote generation docker (SecFloat "rgen" - All local / All remote / Both at its top).
 *            On the status bar while Settings ▸ Remote generation ▸ Use remote generation is ticked (off = everything runs
 *            here and the docker is closed - as since 2.754.0).
 *   Pods     shows / hides 🖥 PODS (SecFloat "pods"). On the status bar only while something runs remotely: a type (Image,
 *            Video, Music, Text to speech, Speech to text, Song separation) or the LLM / Vision LLM on Remote. Everything
 *            Local = hidden (and the PODS docker closes, like All local in the docker).
 *   Both are lit while their docker is on screen, like the other status bar buttons. They sit after Queue.
 * Pure (Node: scripts/test-system783.js): anyRemote, KINDS.
 */
(function (root) {
  "use strict";
  var KINDS = ["image", "video", "music", "tts", "stt", "stems"];
  /** does any tool use remote generation? (pure) v = GET /api/gpusplit */
  function anyRemote(v) {
    var o = v || {};
    if (!o.where || o.where === "local") return false;
    var t = o.types || {}, r = o.routes || {};
    return KINDS.some(function (k) { return t[k] === "remote"; }) || r.llm === "remote" || r.vlm === "remote";
  }
  var pure = { anyRemote: anyRemote, KINDS: KINDS };
  if (typeof module === "object" && module.exports && !root.document) { module.exports = pure; return; }

  var doc = root.document, S = { on: null, v: null };
  function $(id) { return doc.getElementById(id); }
  function getj(u) { return root.fetch(u).then(function (r) { return r.json(); }); }
  function shown(id) { return !!(root.SecFloat && SecFloat.windows && SecFloat.windows[id] && (SecFloat.state(id) || {}).shown); }
  function btn(id, text, title, win, open) {
    var b = $(id); if (b) return b;
    var sb = $("statusbar"); if (!sb) return null;
    b = doc.createElement("button"); b.type = "button"; b.id = id; b.textContent = text; b.title = title; b.style.display = "none";
    b.onclick = function () { open(!shown(win)); setTimeout(paint, 30); };
    var after = id === "tPods" ? $("tRgen") : $("tQ");   // Queue, Remote, Pods
    sb.insertBefore(b, after ? after.nextSibling : $("sbdot"));
    return b;
  }
  function build() {
    var r = btn("tRgen", "Remote", "Remote generation docker - all local, all remote or both, and what runs where", "rgen",
      function (on) { if (root.H3RemoteDock && H3RemoteDock.show) H3RemoteDock.show(on); });
    var p = btn("tPods", "Pods", "PODS docker - your RunPod pods (shown while something runs remotely)", "pods",
      function (on) { if (root.H3Pods && H3Pods.show) H3Pods.show(on); });
    return !!(r && p);
  }
  function paint() {
    if (!build()) return;
    var r = $("tRgen"), p = $("tPods"), useP = !!S.on && anyRemote(S.v);
    r.style.display = S.on ? "" : "none";
    p.style.display = useP ? "" : "none";
    [[r, "rgen"], [p, "pods"]].forEach(function (x) { var on = shown(x[1]); x[0].classList.toggle("on", on); x[0].setAttribute("aria-pressed", on ? "true" : "false"); });
    // everything local: the PODS docker closes with its button (it is opened again from Remote ▸ 🖥 PODS docker)
    if (S.v && !useP && S.was && shown("pods") && root.SecFloat) SecFloat.show("pods", false);
    if (S.v) S.was = useP;
  }
  function load() {
    return Promise.all([getj("/api/remotegen").catch(function () { return null; }), getj("/api/gpusplit").catch(function () { return null; })]).then(function (a) {
      if (a[0]) S.on = !!a[0].enabled;
      if (a[1] && a[1].where) S.v = a[1];
      paint();
    });
  }
  function boot() {
    if (!build()) { setTimeout(boot, 300); return; }
    load();
    doc.addEventListener("h3:rgpu", function () { setTimeout(load, 200); });
    setInterval(paint, 1000);                 // lit / dark as the dockers open and close (their ✕, ⊞ layouts …)
    setInterval(load, +(root.H3_RBTN_POLL || 15000));
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3RemoteBtns = Object.assign({ load: load, paint: paint, state: function () { return S; } }, pure);
})(typeof window !== "undefined" ? window : globalThis);
