/* bitGen Studio — static/remotetypes.js (2.776.0): EVERY TYPE OF WORK, LOCAL OR REMOTE, IN SECTIONS - the ☁ Remote generation
 * docker's options (#gpuRemoteOpts - static/gpusplit.js, static/remoteprep.js) laid out as themed sections
 * (window.H3RemoteTypes; lib/gpuSplit.js TYPES / onRemote, lib/podAudio.js).
 * Tim (verbatim): "add all the types to remote generation. Music - local/remote, tts-local/remote, stt-local/remote, separate
 * all of the choices into sections neatly justified with an editable(theme)border and bg color etc"
 *   ☁ Remote servers   RunPod / OpenRouter, Serverless / Pods (moved in as they are)
 *   🎨 Generation      Image · Video · Music      Local / Remote each (POST /api/gpusplit {per: true, kind: bool})
 *   🧠 Language models LLM · Vision LLM           their own rows (static/remoteprep.js), moved in
 *   🔊 Audio           Text to speech · Speech to text · Song separation   Local / Remote; Remote runs on the pod ticked for it
 *                      (🖥 PODS ▸ 🔊 Audio) - none ticked: the pod in use gets it (lib/podAudio.js autoTick); a line says which
 *   The old Both boxes are hidden - the rows replace them. Each section is a .rtSec with its heading .rtSecH; their look is
 *   the theme's: --rt-sec-bg, --rt-sec-border, --rt-sec-radius, --rt-sec-head (a theme sets them; edit theme mode styles any
 *   section like any other element). Rows are a grid - the names, Local and Remote line up in columns.
 * Pure (Node: scripts/test-remotetypes776.js): ROWS, rowsOf, noteOf.
 */
(function (root) {
  "use strict";
  var ROWS = {
    gen: [["image", "Image", "Pictures, edits and upscales"], ["video", "Video", "Video, character swap, upscales"], ["music", "Music", "Songs (ComfyUI music styles - YuE2's own program stays on this computer)"]],
    audio: [["tts", "Text to speech", "OmniVoice - speech, your cloned voices, 🗣 Speech & dialog"], ["stt", "Speech to text", "faster-whisper - transcripts, lyric timing, a clone's words"], ["stems", "Song separation", "demucs - stems, the sheet music's song layers"]],
  };
  /** each row's state (pure): v = GET /api/gpusplit -> [{k, label, remote, note}] */
  function rowsOf(v, group) {
    var t = (v && v.types) || {};
    return (ROWS[group] || []).map(function (r) { return { k: r[0], label: r[1], tip: r[2], remote: t[r[0]] === "remote", note: noteOf(v, r[0]) }; });
  }
  /** the line under a row (pure) */
  function noteOf(v, k) {
    var o = v || {}, t = (o.types || {})[k], pods = !!(o.engine && o.engine.pods), au = o.audio || {};
    if (t !== "remote") return "";
    if (k === "tts" || k === "stt" || k === "stems") {
      if (!pods) return "✗ runs on a pod - pick RunPod ▸ Pods";
      return au[k] ? "on the pod " + au[k] : "✗ no pod has it yet - tick 🔊 Audio on a pod (🖥 PODS ▸ My pods)";
    }
    return o.remote ? "on " + o.remote.label : pods ? "on its style's pod" : "✗ no remote GPU set up";
  }
  var pure = { ROWS: ROWS, rowsOf: rowsOf, noteOf: noteOf };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var doc = root.document, S = { v: null };
  function $(id) { return doc.getElementById(id); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var CSS = ":root{--rt-sec-bg:var(--panel-2,rgba(255,255,255,.03));--rt-sec-border:var(--line,#3a342a);--rt-sec-radius:8px;--rt-sec-head:var(--tiger,#f59e2c)}"
    + ".rtSec{background:var(--rt-sec-bg);border:1px solid var(--rt-sec-border);border-radius:var(--rt-sec-radius);padding:8px 10px 9px;margin:8px 0}"
    + ".rtSecH{margin:0 0 6px;font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--rt-sec-head)}"
    + ".rtGrid{display:grid;grid-template-columns:minmax(110px,max-content) auto auto 1fr;gap:3px 14px;align-items:center}"
    + ".rtGrid .rtName{font-size:.78rem}.rtGrid label.chk{margin:0}.rtGrid .rtNote{grid-column:2 / -1;font-size:.68rem;margin:-2px 0 3px}"
    + ".rtSec #gpuEngine>div,.rtSec #gpuLlmWhere .rpRow{display:grid!important;grid-template-columns:minmax(110px,max-content) auto auto 1fr;gap:3px 14px;align-items:center}"
    + ".rtSec #gpuEngine>div>span:first-child,.rtSec #gpuLlmWhere .rpRow>span:first-child{min-width:0!important;font-size:.78rem;color:inherit}"
    + ".rtSec #gpuEngine{margin-top:0!important}.rtSec #gpuLlmWhere{margin-top:0!important}"
    + "#gpuRemoteOpts.rtOn #gpuBoxes{display:none!important}#gpuRemoteOpts.rtOn>h4{display:none}"
    + "#gpuRemoteOpts.gpuLocal .rtSec[data-rtsec=\"gen\"],#gpuRemoteOpts.gpuLocal .rtSec[data-rtsec=\"audio\"],#gpuRemoteOpts.gpuLocal .rtSec[data-rtsec=\"llm\"]{display:none}";
  function sec(id, head) {   // head = the heading's HTML (a literal - the translations read it from here)
    var s = doc.createElement("section"); s.className = "rtSec"; s.dataset.rtsec = id;
    s.innerHTML = head; s.setAttribute("aria-label", s.textContent.trim()); return s;
  }
  function grid(group) {
    var g = doc.createElement("div"); g.className = "rtGrid"; g.dataset.rtgrid = group; g.setAttribute("role", "group");
    ROWS[group].forEach(function (r) {
      g.insertAdjacentHTML("beforeend", '<span class="rtName" title="' + esc(r[2]) + '">' + esc(r[1]) + "</span>"
        + '<label class="chk" title="On this computer"><input type="radio" name="rt_' + r[0] + '" value="local"> Local</label>'
        + '<label class="chk" title="On the remote GPU / your pod"><input type="radio" name="rt_' + r[0] + '" value="remote"> Remote</label><span></span>'
        + '<span class="hint rtNote" id="rtNote_' + r[0] + '" aria-live="polite"></span>');
    });
    g.querySelectorAll("input[type=radio]").forEach(function (i) { i.onchange = function () { choose(i.name.slice(3), i.value === "remote"); }; });
    return g;
  }
  function choose(k, remote) {
    var b = { per: true }; b[k] = remote;
    root.fetch("/api/gpusplit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })
      .then(function (r) { return r.json(); }).then(function (v) { if (v && !v.error) { S.v = v; paint(); try { doc.dispatchEvent(new Event("h3:rgpu")); } catch (e) { /* fine */ } } });
  }
  function build() {
    var host = $("gpuRemoteOpts"), eng = $("gpuEngine"), llm = $("gpuLlmWhere");
    if (!host || !eng || !llm) return false;
    if (host.querySelector(".rtSec")) return true;
    if (!$("rtCss")) { var st = doc.createElement("style"); st.id = "rtCss"; st.textContent = CSS; doc.head.appendChild(st); }
    host.classList.add("rtOn");
    var s1 = sec("servers", '<h4 class="rtSecH">☁ Remote servers</h4>'), s2 = sec("gen", '<h4 class="rtSecH">🎨 Generation</h4>'),
      s3 = sec("llm", '<h4 class="rtSecH">🧠 Language models</h4>'), s4 = sec("audio", '<h4 class="rtSecH">🔊 Audio</h4>');
    var first = host.firstChild ? host.firstChild : null;
    host.insertBefore(s1, eng); s1.appendChild(eng);
    host.insertBefore(s2, s1.nextSibling); s2.appendChild(grid("gen"));
    var vs = $("rpSt_video"); if (vs) s2.appendChild(vs);   // the video / image style's line (static/remoteprep.js)
    host.insertBefore(s3, s2.nextSibling); s3.appendChild(llm);
    host.insertBefore(s4, s3.nextSibling); s4.appendChild(grid("audio"));
    void first;
    return true;
  }
  function paint() {
    if (!build() || !S.v) return;
    ["gen", "audio"].forEach(function (g) {
      rowsOf(S.v, g).forEach(function (r) {
        doc.querySelectorAll('input[name="rt_' + r.k + '"]').forEach(function (i) { i.checked = i.value === (r.remote ? "remote" : "local"); });
        var n = $("rtNote_" + r.k); if (n) { n.textContent = r.note; n.style.color = /^✗/.test(r.note) ? "var(--bad,#e66)" : ""; n.hidden = !r.note; }
      });
    });
  }
  function load() { return root.fetch("/api/gpusplit").then(function (r) { return r.json(); }).then(function (v) { if (v && !v.error) { S.v = v; paint(); } }).catch(function () { /* next time */ }); }
  function boot() {
    if (!build()) { setTimeout(boot, 400); return; }
    load();
    doc.addEventListener("h3:rgpu", function () { setTimeout(load, 300); });
    setInterval(function () { var h = $("gpuRemoteOpts"); if (h && h.offsetParent !== null) load(); }, +(root.H3_RT_POLL || 8000));
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3RemoteTypes = Object.assign({ load: load, paint: paint, state: function () { return S; } }, pure);
})(typeof window !== "undefined" ? window : globalThis);
