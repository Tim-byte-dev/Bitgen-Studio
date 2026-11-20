/* bitGen Studio — static/pan2gen.js (2.890.0): THE PROMPT DOCKER'S PAN 2 (window.H3Pan2Gen).
 *
 * Tim (verbatim): "can you add this to our video models https://huggingface.co/Comfy-Org/PAN2". A video style whose
 * architecture is PAN 2 is rendered by POST /api/pan2 (routes/pan2.js) instead of /api/generate - the page's Generate
 * dispatch asks style() first. The server has the LLM write PAN 2's structured caption from the words (a one-line
 * prompt comes back as noise), then queues the job.
 *   style()          the picked video style when it is a PAN 2 one (else null)
 *   first(list)      the picture that starts the video: the one typed "first frame", else the first picture (or none)
 *   form(text, o)    the FormData sent (o = {refs, seconds, width, height, seed, steps, styleId, sound, negative})
 *   submit(text)     -> the job id (or null): ComfyUI up, the form sent, the Queue shows the job. PAN 2's files missing =
 *                    the Download / Cancel box (H3NeedInstall "pan2"), then it goes on by itself.
 *   paint()          the "PAN 2" hint beside the video style select, only for a PAN 2 style
 */
(function (root) {
  "use strict";
  var doc = root.document;
  var $ = function (id) { return doc.getElementById(id); };
  function styles() { try { return typeof videoStyles !== "undefined" ? videoStyles : []; } catch (e) { return []; } }   // eslint-disable-line no-undef
  function style() {
    var sel = $("videoStyleSel"); if (!sel || !sel.value) return null;
    var st = styles().find(function (x) { return x.id === sel.value; });
    return st && st.arch === "pan2" ? st : null;
  }
  function first(list) {
    var pics = (list || []).filter(function (r) { return r && r.file; });
    return pics.find(function (r) { return r.role === "first frame"; }) || pics[0] || null;
  }
  function form(text, o) {
    var fd = new FormData(), f = first(o.refs);
    fd.append("prompt", String(text || ""));
    ["seconds", "width", "height", "seed", "steps", "negative"].forEach(function (k) { if (o[k] !== undefined && o[k] !== null && o[k] !== "") fd.append(k, String(o[k])); });
    if (o.styleId) fd.append("video_style_id", o.styleId);
    if (o.sound) fd.append("ref_audio", o.sound);
    if (f) fd.append("first", f.file, f.file.name || "first.png");
    return fd;
  }
  function val(id) { var e = $(id); return e ? e.value : ""; }
  function refsNow() { try { return typeof refs !== "undefined" ? refs : []; } catch (e) { return []; } }       // eslint-disable-line no-undef
  function soundNow() { try { return typeof refAuds !== "undefined" && refAuds.length ? refAuds[0] : ""; } catch (e) { return ""; } }   // eslint-disable-line no-undef
  function negNow() { try { return root.H3Neg && typeof root.H3Neg.get === "function" ? root.H3Neg.get() : ""; } catch (e) { return ""; } }
  function secondsNow() {
    var s = parseFloat(val("seconds"));
    if (!(s > 0)) { try { if (typeof root.framesFromSeconds === "function") s = (parseInt(root.framesFromSeconds(), 10) || 240) / 24; } catch (e) { /* no helper */ } }
    return s > 0 ? Math.min(20, s) : 10;
  }
  function log(t) { try { if (typeof root.logLine === "function") root.logLine("[pan2] " + t); } catch (e) { /* no console */ } }
  async function submit(text) {
    var st = style(); if (!st) return null;
    if (typeof root.ensureComfyReady === "function" && !(await root.ensureComfyReady({ need: true }))) return null;
    for (var tries = 0; tries < 2; tries++) {
      log("writing PAN 2's caption from your words (the LLM) - then it renders");
      var fd = form(text, { refs: refsNow(), seconds: secondsNow(), width: val("width"), height: val("height"), seed: val("seed"),
        steps: val("steps"), styleId: st.id, sound: soundNow(), negative: negNow() });
      var res = await fetch("/api/pan2", { method: "POST", body: fd });
      var j = await res.json().catch(function () { return {}; });
      if (res.ok) {
        (j.notes || []).forEach(log);
        if (typeof root.refreshJobs === "function") await root.refreshJobs();
        if (typeof root.selectJob === "function") root.selectJob(j.id);
        return j.id;
      }
      if (j.needs === "pan2" && tries === 0 && root.H3NeedInstall) {
        var ok = await root.H3NeedInstall.ensure("pan2", "PAN 2 renders in ComfyUI's own nodes - its model, text encoder and VAE.");
        if (ok) { log("installed - restart ComfyUI if it was running, then it renders"); continue; }
        return null;
      }
      root.alert(j.error || "PAN 2 could not start");
      return null;
    }
    return null;
  }
  function paint() {
    var sel = $("videoStyleSel"); if (!sel || !sel.parentNode) return;
    var tip = $("pan2Tip");
    if (!tip) {
      tip = doc.createElement("span"); tip.id = "pan2Tip"; tip.className = "muted";
      tip.style.cssText = "margin-left:6px;font-size:11px;cursor:help";
      tip.textContent = "ⓘ PAN 2";
      tip.title = "PAN 2: write what happens in plain words - the LLM turns them into PAN 2's own caption before it renders. "
        + "A picture in the reference dock (or F/L's first frame) starts the video. Up to 20 s at 24 fps; trained at 1248 x 704.";
      sel.parentNode.insertBefore(tip, sel.nextSibling);
      sel.addEventListener("change", function () { paint(); });
    }
    tip.hidden = !style();
  }
  root.H3Pan2Gen = { style: style, first: first, form: form, submit: submit, paint: paint };
  if (doc && doc.readyState !== "loading") setTimeout(paint, 0); else if (doc) doc.addEventListener("DOMContentLoaded", paint);
})(typeof window !== "undefined" ? window : globalThis);
