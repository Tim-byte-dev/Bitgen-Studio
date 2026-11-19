/* bitGen Studio — static/h3longgen.js (2.872.0): THE PROMPT DOCKER'S H3 LONG VIDEO (window.H3LongGen).
 *
 * Tim (verbatim): "this workflow is for 40 second h3 video. can we add this one and remove the 30sec one". A video style
 * whose architecture is H3 Long Video ("H3 Long Video (40 s)") is rendered by POST /api/h3long (routes/h3LongVideo.js)
 * instead of /api/generate - the page's Generate dispatch asks style() first.
 *   style()          the picked video style when it is an H3 Long Video one (else null)
 *   form(text, o)    the FormData sent (pure enough to test: o = {refs, seconds, width, height, seed, steps, upscale2k})
 *   submit(text)     -> the job id (or null): ComfyUI up, the form sent, the Queue shows the job. Missing parts = the
 *                    Download / Cancel box (H3NeedInstall "h3long"), then it goes on by itself.
 *   paint()          shows the "2K" tick beside the video style select only for an H3 Long Video style
 * The prompt: the FIRST paragraph is the scene + style (repeated on every shot), every later paragraph one shot (a blank
 * line between them). One block of text is shared out over the shots by the server. A paragraph starting "Characters:"
 * is the character memory ("Name: <Picture 1>, she, 26, …" - one per line) and is taken out of the prompt.
 * Pictures: the one typed First frame (else the first picture) starts the first shot; the next four are references.
 */
(function (root) {
  "use strict";
  var doc = root.document;
  var $ = function (id) { return doc.getElementById(id); };
  var K2K = "h3long.2k";
  function store(k, v) { try { if (v === undefined) return root.localStorage.getItem(k); root.localStorage.setItem(k, v); } catch (e) { /* private mode */ } return null; }
  function styles() { try { return typeof videoStyles !== "undefined" ? videoStyles : []; } catch (e) { return []; } }   // eslint-disable-line no-undef
  function style() {
    var sel = $("videoStyleSel"); if (!sel || !sel.value) return null;
    var st = styles().find(function (x) { return x.id === sel.value; });
    return st && st.arch === "h3-long" ? st : null;
  }
  /** "Characters:" paragraph -> memory; the rest -> the prompt */
  function split(text) {
    var paras = String(text || "").replace(/\r/g, "").split(/\n\s*\n+/);
    var mem = [], rest = [];
    paras.forEach(function (p) {
      var m = p.match(/^\s*characters\s*:\s*([\s\S]*)$/i);
      if (m) mem.push(m[1].trim()); else if (p.trim()) rest.push(p.trim());
    });
    return { prompt: rest.join("\n\n"), memory: mem.join("\n") };
  }
  function order(list) {
    var pics = (list || []).filter(function (r) { return r && r.file; });
    var i = pics.findIndex(function (r) { return r.role === "first frame"; });
    if (i < 0) i = 0;
    var first = pics[i] || null;
    return { first: first, refs: pics.filter(function (r, k) { return k !== i && r.role !== "last frame"; }).slice(0, 4) };
  }
  function form(text, o) {
    var p = split(text), fd = new FormData(), op = order(o.refs);
    fd.append("prompt", p.prompt);
    if (p.memory) fd.append("memory", p.memory);
    ["seconds", "width", "height", "seed", "steps"].forEach(function (k) { if (o[k] !== undefined && o[k] !== null && o[k] !== "") fd.append(k, String(o[k])); });
    fd.append("upscale2k", o.upscale2k ? "1" : "0");
    if (o.styleId) fd.append("video_style_id", o.styleId);
    if (op.first) fd.append("first", op.first.file, op.first.file.name || "first.png");
    op.refs.forEach(function (r) { fd.append("refs", r.file, r.file.name || "ref.png"); });
    return fd;
  }
  function val(id) { var e = $(id); return e ? e.value : ""; }
  function refsNow() { try { return typeof refs !== "undefined" ? refs : []; } catch (e) { return []; } }   // eslint-disable-line no-undef
  function log(t) { try { if (typeof root.logLine === "function") root.logLine("[h3long] " + t); } catch (e) { /* no console */ } }
  async function submit(text) {
    var st = style(); if (!st) return null;
    if (typeof root.ensureComfyReady === "function" && !(await root.ensureComfyReady({ need: true }))) return null;
    for (var tries = 0; tries < 2; tries++) {
      var fd = form(text, { refs: refsNow(), seconds: val("seconds"), width: val("width"), height: val("height"), seed: val("seed"),
        steps: val("steps"), upscale2k: store(K2K) === "1", styleId: st.id });
      var res = await fetch("/api/h3long", { method: "POST", body: fd });
      var j = await res.json().catch(function () { return {}; });
      if (res.ok) {
        (j.notes || []).forEach(log);
        if (typeof root.refreshJobs === "function") await root.refreshJobs();
        if (typeof root.selectJob === "function") root.selectJob(j.id);
        return j.id;
      }
      if (j.needs === "h3long" && tries === 0 && root.H3NeedInstall) {
        var ok = await root.H3NeedInstall.ensure("h3long", "H3 Long Video chains MiniMax H3 shots in ComfyUI - its node packs and the fused turbo model.");
        if (ok) { log("installed - restart ComfyUI if it was running, then it renders"); continue; }
        return null;
      }
      root.alert(j.error || "H3 Long Video could not start");
      return null;
    }
    return null;
  }
  function paint() {
    var sel = $("videoStyleSel"); if (!sel || !sel.parentNode) return;
    var box = $("h3l2kBox");
    if (!box) {
      box = doc.createElement("label"); box.id = "h3l2kBox"; box.style.cssText = "display:inline-flex;gap:4px;align-items:center;margin-left:6px";
      box.title = "H3 Long Video: also save a 2K copy (NVIDIA RTX Video Super Resolution x2 - an RTX card). The 2K file is the job's video.";
      var cb = doc.createElement("input"); cb.type = "checkbox"; cb.id = "h3l2k"; cb.checked = store(K2K) === "1";
      cb.addEventListener("change", function () { store(K2K, cb.checked ? "1" : "0"); });
      box.appendChild(cb); box.appendChild(doc.createTextNode(" 2K"));
      sel.parentNode.insertBefore(box, sel.nextSibling);
      sel.addEventListener("change", function () { paint(); });
    }
    box.hidden = !style();
  }
  root.H3LongGen = { style: style, form: form, split: split, order: order, submit: submit, paint: paint };
  if (doc && doc.readyState !== "loading") setTimeout(paint, 0); else if (doc) doc.addEventListener("DOMContentLoaded", paint);
})(typeof window !== "undefined" ? window : globalThis);
