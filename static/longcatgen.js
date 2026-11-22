/* bitGen Studio — static/longcatgen.js (2.918.0): THE PROMPT DOCKER'S LONGCAT AVATAR 1.6 (window.H3LongCatGen).
 *
 * Tim (verbatim): "https://meigen-ai.github.io/LongCat-Video-Avatar-1.6-Page/, can you add this". A video style whose
 * architecture is LongCat Avatar ("longcat_avatar") is rendered by POST /api/longcat (routes/longcat.js) instead of
 * /api/generate - the page's Generate dispatch asks style() first. The References docker's first sound is the speech (the
 * video is as long as it), its first picture (the one typed "first frame" first) the person; no picture = the person
 * from the prompt alone.
 *   style()          the picked video style when it is a LongCat Avatar one (else null)
 *   first(list)      the person's picture: the one typed "first frame", else the first picture (or none)
 *   form(text, o)    the FormData sent (o = {refs, width, height, seed, styleId, sound})
 *   submit(text)     -> the job id (or null): ComfyUI up, the form sent, the Queue shows the job. The pack / files missing =
 *                    the Download / Cancel box (H3NeedInstall "longcat"), then it goes on by itself; no sound = said.
 *   paint()          the "ⓘ LongCat" hint beside the video style select, only for a LongCat style
 */
(function (root) {
  "use strict";
  var doc = root.document;
  var $ = function (id) { return doc.getElementById(id); };
  function styles() { try { return typeof videoStyles !== "undefined" ? videoStyles : []; } catch (e) { return []; } }   // eslint-disable-line no-undef
  function style() {
    var sel = $("videoStyleSel"); if (!sel || !sel.value) return null;
    var st = styles().find(function (x) { return x.id === sel.value; });
    return st && st.arch === "longcat_avatar" ? st : null;
  }
  function first(list) {
    var pics = (list || []).filter(function (r) { return r && r.file; });
    return pics.find(function (r) { return r.role === "first frame"; }) || pics[0] || null;
  }
  function form(text, o) {
    var fd = new FormData(), f = first(o.refs);
    fd.append("prompt", String(text || ""));
    ["width", "height", "seed"].forEach(function (k) { if (o[k] !== undefined && o[k] !== null && o[k] !== "") fd.append(k, String(o[k])); });
    if (o.styleId) fd.append("video_style_id", o.styleId);
    if (o.sound) fd.append("ref_audio", o.sound);
    if (f) fd.append("first", f.file, f.file.name || "person.png");
    return fd;
  }
  function val(id) { var e = $(id); return e ? e.value : ""; }
  function refsNow() { try { return typeof refs !== "undefined" ? refs : []; } catch (e) { return []; } }       // eslint-disable-line no-undef
  function soundNow() { try { return typeof refAuds !== "undefined" && refAuds.length ? refAuds[0] : ""; } catch (e) { return ""; } }   // eslint-disable-line no-undef
  function log(t) { try { if (typeof root.logLine === "function") root.logLine("[longcat] " + t); } catch (e) { /* no console */ } }
  async function submit(text) {
    var st = style(); if (!st) return null;
    if (!soundNow()) { root.alert("LongCat Avatar makes the person talk or sing to a sound - put the speech (or a song's vocals) in the References docker first. The video is as long as the sound."); return null; }
    if (typeof root.ensureComfyReady === "function" && !(await root.ensureComfyReady({ need: true }))) return null;
    for (var tries = 0; tries < 2; tries++) {
      var fd = form(text, { refs: refsNow(), width: val("width"), height: val("height"), seed: val("seed"), styleId: st.id, sound: soundNow() });
      if (root.H3Basic && root.H3Basic.json) fd.append("basic", root.H3Basic.json());
      var res = await fetch("/api/longcat", { method: "POST", body: fd });
      var j = await res.json().catch(function () { return {}; });
      if (res.ok) {
        (j.notes || []).forEach(log);
        if (typeof root.refreshJobs === "function") await root.refreshJobs();
        if (typeof root.selectJob === "function") root.selectJob(j.id);
        return j.id;
      }
      if (j.needs === "longcat" && tries === 0 && root.H3NeedInstall) {
        var ok = await root.H3NeedInstall.ensure("longcat", "LongCat Avatar 1.6 renders in ComfyUI with the LongCat Avatar node pack - its model, two LoRAs, Whisper and the Wan 2.1 text encoder + VAE.");
        if (ok) { log("installed - restart ComfyUI once so it loads the LongCat Avatar nodes, then it renders"); continue; }
        return null;
      }
      root.alert(j.error || "LongCat Avatar could not start");
      return null;
    }
    return null;
  }
  function paint() {
    var sel = $("videoStyleSel"); if (!sel || !sel.parentNode) return;
    var tip = $("longcatTip");
    if (!tip) {
      tip = doc.createElement("span"); tip.id = "longcatTip"; tip.className = "muted";
      tip.style.cssText = "margin-left:6px;font-size:11px;cursor:help";
      tip.textContent = "ⓘ LongCat";
      tip.title = "LongCat Avatar 1.6 makes a person talk or sing to a sound: the References docker's first sound is the speech (clean speech works best - "
        + "a song's vocals from the Stems docker's ✂ Separate), its first picture the person (none = from the prompt). The video is as long as the sound, "
        + "25 fps, 480p (720p when Basic Settings' size is 720 or more). Describe the person, how they move and where they are.";
      sel.parentNode.insertBefore(tip, sel.nextSibling);
      sel.addEventListener("change", paint);
    }
    tip.hidden = !style();
  }
  root.H3LongCatGen = { style: style, first: first, form: form, submit: submit, paint: paint };
  if (doc && doc.readyState !== "loading") setTimeout(paint, 0); else if (doc) doc.addEventListener("DOMContentLoaded", paint);
})(typeof window !== "undefined" ? window : globalThis);
