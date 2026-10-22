/* bitGen Studio — static/usemeta.js (2.575.0): "✎→ To prompt" - a picture / video / song's prompt WITH its seed, cfg and
 * steps into the prompt box and Basic Settings (window.H3UseMeta).
 * Tim: "add a button for the prompt from metadata to send to prompt - this will use the seed, cfg and steps of the
 * image/video/music (do this for gallery,assets and reference too)".
 *   get({src, name})      GET /api/media-meta - a project file (src output = the gallery, images | video | sound = Assets)
 *   fromBlob(blob, name)  POST /api/media-meta - a References picture (it lives in the page as a blob)
 *   apply(meta, kind)     the prompt -> #prompt (a "Negative:" part / meta.negative -> the negative prompt);
 *                         image: #imgSteps #imgCfg; video: #steps #cfg; audio: the Music docker's lyrics + seed;
 *                         the seed -> #seed (every kind but audio). Each field gets input + change, so the page
 *                         keeps it (Basic Settings' own listeners) -> what was set, in words
 *   kindOf(name, meta)    image | video | audio (the file's extension, else meta.mode)
 *   button(getMeta, kind) a small "✎→" button that fetches (getMeta() -> Promise<{meta}>), applies, and says what it did
 *   send(src, name)       get + apply in one (the tiles' buttons)
 * Pure: kindOf, plan(meta, kind) - the field -> value list apply() writes (scripts/test-modelmedia575.js). */
(function (root) {
  "use strict";
  function kindOf(name, meta) {
    var n = String(name || "");
    if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(n)) return "image";
    if (/\.(mp4|webm|mov|mkv|m4v)$/i.test(n)) return "video";
    if (/\.(wav|mp3|flac|ogg|opus|m4a|aac)$/i.test(n)) return "audio";
    var m = String((meta && meta.mode) || "");
    return /image|still|pic/i.test(m) ? "image" : /audio|music|song/i.test(m) ? "audio" : m ? "video" : "image";
  }
  var ok = function (v) { return v != null && v !== "" && isFinite(+v); };
  /** meta + kind -> [[id, value], …] in the order apply() sets them (pure) */
  function plan(meta, kind) {
    var m = meta || {}, out = [];
    if (kind === "audio") {
      if (m.prompt) out.push(["muLyrics", m.prompt], ["prompt", m.prompt]);
      if (ok(m.seed) && +m.seed >= 0) out.push(["muSeed", String(Math.floor(+m.seed))]);
      return out;
    }
    if (m.prompt) out.push(["prompt", m.prompt]);
    if (ok(m.seed)) out.push(["seed", String(Math.floor(+m.seed))]);
    if (kind === "image") { if (ok(m.steps)) out.push(["imgSteps", String(+m.steps)]); if (ok(m.cfg)) out.push(["imgCfg", String(+m.cfg)]); }
    else { if (ok(m.steps)) out.push(["steps", String(+m.steps)]); if (ok(m.cfg)) out.push(["cfg", String(+m.cfg)]); }
    return out;
  }
  function el(id) { return root.document ? root.document.getElementById(id) : null; }
  function apply(meta, kind) {
    var m = meta || {}, k = kind || "image", done = [];
    plan(m, k).forEach(function (p) {
      var x = el(p[0]); if (!x) return;
      var v = p[1];
      if (p[0] === "prompt" && root.H3Neg && typeof root.H3Neg.take === "function") { try { v = root.H3Neg.take(v); } catch (e) { /* the words as they are */ } }
      x.value = v;
      x.dispatchEvent(new Event("input", { bubbles: true })); x.dispatchEvent(new Event("change", { bubbles: true }));
      done.push(p[0]);
    });
    if (m.negative && root.H3Neg && typeof root.H3Neg.set === "function") { try { root.H3Neg.set(m.negative, "from the file's metadata"); done.push("negative"); } catch (e) { /* fine */ } }
    if (typeof root.refreshPlanReadout === "function") { try { root.refreshPlanReadout(); } catch (e) { /* fine */ } }
    var words = [];
    if (done.indexOf("prompt") >= 0 || done.indexOf("muLyrics") >= 0) words.push(k === "audio" ? "the lyrics" : "the prompt");
    if (done.indexOf("seed") >= 0 || done.indexOf("muSeed") >= 0) words.push("seed " + m.seed);
    if (done.indexOf("imgSteps") >= 0 || done.indexOf("steps") >= 0) words.push(m.steps + " steps");
    if (done.indexOf("imgCfg") >= 0 || done.indexOf("cfg") >= 0) words.push("cfg " + m.cfg);
    if (done.indexOf("negative") >= 0) words.push("the negative prompt");
    if (root.H3TestEvent) try { root.H3TestEvent("use_meta", done.join(",")); } catch (e) { /* fine */ }
    return words.length ? words.join(", ") + " → " + (k === "image" ? "the prompt box + Basic Settings ▸ Image" : k === "audio" ? "the Music docker" : "the prompt box + Basic Settings") : "";
  }
  function get(o) {
    return fetch("/api/media-meta?src=" + encodeURIComponent((o && o.src) || "output") + "&name=" + encodeURIComponent((o && o.name) || ""))
      .then(function (r) { return r.json(); });
  }
  function fromBlob(blob, name) {
    var fd = new FormData(); fd.append("file", blob, name || "picture.png");
    return fetch("/api/media-meta", { method: "POST", body: fd }).then(function (r) { return r.json(); });
  }
  /* a small note at the bottom for 4 s (there is no page-wide toast) */
  function say(t) {
    var d = root.document; if (!d || !d.body) return;
    var n = d.getElementById("h3UseMetaNote");
    if (!n) { n = d.createElement("div"); n.id = "h3UseMetaNote"; n.setAttribute("role", "status");
      n.style.cssText = "position:fixed;left:50%;bottom:30px;transform:translateX(-50%);z-index:10000;max-width:70vw;background:var(--panel,#1d1a16);color:var(--text,#ddd);border:1px solid var(--tiger,#f59e2c);border-radius:6px;padding:6px 12px;font-size:12.5px;box-shadow:0 4px 18px rgba(0,0,0,.45);pointer-events:none";
      d.body.appendChild(n); }
    n.textContent = t; n.style.display = "";
    clearTimeout(say.t); say.t = setTimeout(function () { n.style.display = "none"; }, 4000);
  }
  function run(p, kind, name) {
    return p.then(function (j) {
      if (!j || j.error || !j.meta) { say((j && j.error) || "no prompt or settings found"); return null; }
      var k = kind || kindOf(name || j.name, j.meta), w = apply(j.meta, k);
      say(w ? "✎→ " + w : "nothing to use in " + (name || "that file"));
      return j;
    }).catch(function (e) { say("✎→ " + e.message); return null; });
  }
  function send(src, name, kind) { return run(get({ src: src, name: name }), kind, name); }
  function sendBlob(blob, name, kind) { return run(fromBlob(blob, name), kind, name); }
  function button(onClick, title) {
    var b = root.document.createElement("button"); b.type = "button"; b.className = "ghost h3usemeta"; b.textContent = "✎→";
    b.title = title || "To prompt - this file's prompt with its seed, cfg and steps (from how it was made)";
    b.setAttribute("aria-label", "Send its prompt, seed, cfg and steps to the prompt");
    b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); onClick(e); });
    return b;
  }
  var API = { say: say, kindOf: kindOf, plan: plan, apply: apply, get: get, fromBlob: fromBlob, send: send, sendBlob: sendBlob, button: button };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (root && root.document) {
    root.H3UseMeta = API;
    try {
      var st = root.document.createElement("style"); st.id = "h3UseMetaCss";
      st.textContent = ".h3usemeta{padding:0 4px !important;font-size:11px !important;line-height:16px;min-width:0;flex:none;cursor:pointer}"
        + ".imgwrap{position:relative}.imgwrap>.h3usemeta{position:absolute;left:2px;bottom:2px;opacity:.85;background:rgba(20,18,15,.75)}.imgwrap>.h3usemeta:hover{opacity:1}"
        + ".mmmedia .h3usemeta{position:absolute;left:2px;bottom:2px;background:rgba(20,18,15,.8)}";
      (root.document.head || root.document.documentElement).appendChild(st);
    } catch (e) { /* no styles - the buttons still work */ }
  }
})(typeof window !== "undefined" ? window : null);
