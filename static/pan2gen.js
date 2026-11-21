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
 *   paint()          the "PAN 2" hint + the { } JSON button beside the video style select, only for a PAN 2 style
 *   isJson(text)     the prompt is already a PAN 2 JSON caption (an object with events)
 *   format(text)     2.891.0 (Tim: "pan 2 is meant to submit the prompt in json format, can we format the prompt
 *                    automatically"): POST /api/pan2/caption - the LLM writes PAN 2's JSON caption from the words (and the
 *                    first picture) and it is PUT IN THE PROMPT BOX, indented, to read or edit -> the JSON | null. Generate
 *                    does this by itself when the prompt is not JSON yet, then sends the JSON.
 *   follow()         2.902.0: the prompt box follows the style - leaving PAN 2 puts your words back in place of the JSON
 *   captionWords(t)  a caption as plain words
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
  function isJson(text) {
    var t = String(text || "").trim(); if (t.charAt(0) !== "{") return false;
    try { var o = JSON.parse(t); if (o && typeof o.refined_prompt === "string") o = JSON.parse(o.refined_prompt); return !!(o && Array.isArray(o.events)); } catch (e) { return false; }
  }
  var formatting = false;
  async function format(text) {
    var words = String(text == null ? (val("prompt") || "") : text);
    if (!words.trim()) { root.alert("write what happens in the video first - PAN 2's JSON is written from it"); return null; }
    if (isJson(words)) return words;
    if (formatting) return null;
    formatting = true;
    var btn = $("pan2Fmt"); if (btn) { btn.disabled = true; btn.textContent = "{ } …"; }
    log("writing PAN 2's JSON caption from your words (the LLM) - it goes into the prompt box");
    try {
      var fd = new FormData(), f = first(refsNow());
      fd.append("prompt", words); fd.append("seconds", String(secondsNow())); fd.append("pretty", "1");
      if (f) fd.append("first", f.file, f.file.name || "first.png");
      var res = await fetch("/api/pan2/caption", { method: "POST", body: fd });
      var j = await res.json().catch(function () { return {}; });
      if (!res.ok || !j.caption) { root.alert(j.error || "PAN 2's caption could not be written"); return null; }
      (j.notes || []).forEach(log);
      var out = j.pretty || j.caption, box = $("prompt");
      remember(out, words);                                       // 2.902.0: your words, put back when you leave PAN 2
      if (box) { box.value = out; try { box.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) { /* old browser */ } }
      if (j.how === "wrapped") log("no LLM wrote it - bitGen's simple one-event caption is in the prompt box (start an LLM for a better one)");
      return out;
    } catch (e) { root.alert("PAN 2's caption could not be written: " + (e && e.message || e)); return null; }
    finally { formatting = false; if (btn) { btn.disabled = false; btn.textContent = "{ } JSON"; } }
  }
  function log(t) { try { if (typeof root.logLine === "function") root.logLine("[pan2] " + t); } catch (e) { /* no console */ } }
  async function submit(text) {
    var st = style(); if (!st) return null;
    if (typeof root.ensureComfyReady === "function" && !(await root.ensureComfyReady({ need: true }))) return null;
    // 2.891.0: the prompt goes as PAN 2's JSON - written into the prompt box first when it is plain words
    if (!isJson(text)) { text = await format(text); if (!text) return null; }
    for (var tries = 0; tries < 2; tries++) {
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
  /* 2.902.0 (Tim: "new videos are getting old video prompts mixed with the new prompt" - "it happened after a render with
     pan 2. maybe it is loading the json prompt as well?"): the JSON caption written into the prompt box stayed there after
     a PAN 2 render, and the next video for another style sent it along with the new words. Now the words the caption was
     written from are kept with it, and the box follows the style: leaving PAN 2 (another video style, or the Image / Music
     mode) puts YOUR WORDS back in place of the JSON (a caption with no words kept becomes its own words); going back to
     PAN 2 with the words unchanged puts the same JSON back (no new LLM call). The server takes a caption out of any other
     model's prompt too (lib/pan2.js stripCaption). */
  var KEY = "h3.pan2.words";
  function remember(caption, words) { try { root.localStorage.setItem(KEY, JSON.stringify({ caption: String(caption), words: String(words) })); } catch (e) { /* private mode */ } }
  function recalled() { try { return JSON.parse(root.localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function capOf(text) { try { var o = JSON.parse(String(text || "").trim()); if (o && typeof o.refined_prompt === "string") o = JSON.parse(o.refined_prompt); return o && Array.isArray(o.events) ? o : null; } catch (e) { return null; } }
  /** a caption as plain words (as lib/pan2.js captionWords): the look, the first frame, each event in order */
  function captionWords(text) {
    var c = capOf(text); if (!c) return "";
    return [c.video_style, c.init_frame_visual_description].concat((c.events || []).map(function (e) { return e && e.event_description; }))
      .filter(function (x) { return typeof x === "string" && x.trim(); }).map(function (x) { return x.trim().replace(/\s+/g, " "); }).join(" ");
  }
  function modeNow() { var m = $("genModeSel"); return m ? m.value : "video"; }
  function setBox(box, text, why) {
    box.value = text;
    try { box.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) { /* old browser */ }
    log(why);
  }
  var wasPan = null;
  /** the prompt box follows the style: called on every video style / mode change */
  function follow() {
    var box = $("prompt"); if (!box) return;
    var pan = !!style() && modeNow() === "video";
    if (wasPan === null) { wasPan = pan; if (pan) return; }
    var t = box.value, r = recalled();
    if (!pan && isJson(t)) {
      if (r && r.caption.trim() === t.trim() && r.words.trim()) setBox(box, r.words, "PAN 2's JSON caption taken out of the prompt box - your words are back (it is for PAN 2 only; going back to PAN 2 puts it back)");
      else { var w = captionWords(t); if (w) setBox(box, w, "PAN 2's JSON caption turned back into plain words in the prompt box (it is for PAN 2 only)"); }
    } else if (pan && !wasPan && r && t.trim() && t.trim() === r.words.trim() && isJson(r.caption)) {
      setBox(box, r.caption, "PAN 2: the JSON caption written from these words is back in the prompt box");
    }
    wasPan = pan;
  }
  function paint() {
    var sel = $("videoStyleSel"); if (!sel || !sel.parentNode) return;
    var tip = $("pan2Tip");
    if (!tip) {
      tip = doc.createElement("span"); tip.id = "pan2Tip"; tip.className = "muted";
      tip.style.cssText = "margin-left:6px;font-size:11px;cursor:help";
      tip.textContent = "ⓘ PAN 2";
      tip.title = "PAN 2 takes its prompt as JSON: write what happens in plain words and { } JSON (or Generate) has the LLM write PAN 2's JSON caption into the prompt box. "
        + "A picture in the reference dock (or F/L's first frame) starts the video. Up to 20 s at 24 fps; trained at 1248 x 704.";
      sel.parentNode.insertBefore(tip, sel.nextSibling);
      sel.addEventListener("change", function () { paint(); follow(); });
      var gm = $("genModeSel"); if (gm) gm.addEventListener("change", follow);
      follow();
    }
    var fb = $("pan2Fmt");
    if (!fb) {
      fb = doc.createElement("button"); fb.type = "button"; fb.id = "pan2Fmt"; fb.className = "ghost";
      fb.style.cssText = "margin-left:4px;padding:0 6px;font-size:11px";
      fb.textContent = "{ } JSON";
      fb.title = "Format the prompt as PAN 2's JSON caption: the LLM writes it from your words (and the first picture) into the prompt box, to read or edit. Generate does this by itself when the prompt is not JSON yet.";
      fb.addEventListener("click", function () { format(); });
      tip.parentNode.insertBefore(fb, tip.nextSibling);
    }
    tip.hidden = !style(); fb.hidden = !style();
  }
  root.H3Pan2Gen = { style: style, first: first, form: form, submit: submit, paint: paint, isJson: isJson, format: format, follow: follow, captionWords: captionWords };
  if (doc && doc.readyState !== "loading") setTimeout(paint, 0); else if (doc) doc.addEventListener("DOMContentLoaded", paint);
})(typeof window !== "undefined" ? window : globalThis);
