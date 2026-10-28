/* bitGen Studio — ext/timelinedock/tlmorph.js (2.610.0): 🧬 MORPH - one character turning into another between two
 * layers, made by the video model. window.TlMorph.
 *
 * Tim (verbatim): "is it possible to add a morph to timeline - for example we put a video or image of a monkey an the
 * timeline and a picture of a human on a different position of the timeline and morph from monkey to human in a
 * cinematic way that looks realistic" -> "lets automate the morph - add a morph tab to the properties docker,
 * properties will be, character 1, character 2 , layer 1, layer 2 where the layers will be where the 2 clips are then
 * automatically write the prompt and take the first and last images from the layers, create the movie and insert the
 * clip on a morph layer between the 2 layers starting at the end of layer 1 and start layer 2 at the end of the morph".
 *
 *   🧬 Morph (a tab beside Properties in the timeline's layers panel):
 *     Character 1 / Character 2   what turns into what ("a monkey" -> "a man")
 *     Layer 1 / Layer 2           where the two clips are: layer 1's LAST clip (its last frame = the morph's first
 *                                 frame), layer 2's first clip after it (its first frame = the morph's last frame) -
 *                                 a video's frame at its out / in point, a picture as it is - each drawn as the canvas
 *                                 shows it (its place, size, turn) on the timeline's frame
 *     Length                      the morph's seconds (1 - 10)
 *     The prompt                  written by itself from the two characters (+ your extra words); ✎ edit it, ↺ rewrite
 *     🧬 Make the morph           the video style picked in the toolbar renders FIRST + LAST frame -> video (MiniMax H3
 *                                 fl2va, Wan FLF2V, LTX first / last frame); when it is done:
 *                                   - a new "🧬 Morph" layer BETWEEN the two layers, the clip starting at the end of
 *                                     layer 1's clip (its sound off unless "keep its sound")
 *                                   - layer 2's clip (and the ones after it on that layer) moved to start at the end of
 *                                     the morph
 *                                 one ↶ undo step (tlrange.js); the morph file is in the assets too
 *   Kept with the project: tl.morph {c1, c2, l1, l2, secs, extra, prompt, own (the prompt was edited), sound}.
 * Pure (Node: scripts/test-morph610.js): lastClip, nextClip, writePrompt, NEG, plan, layerSlot, kindOfLk, isUsable.
 */
(function (root) {
  "use strict";
  var NEG = "cut, scene change, cross-fade, dissolve, two subjects, split screen, duplicate, flicker, morphing artifacts, blurry, distorted face, extra limbs, text, watermark";
  /** a clip a morph can start / end on: a video or a picture (no text, shape, 3D, adjustment, null) */
  function isUsable(c) { return !!(c && c.name && !c.text && !c.shape && !c.m3d && !c.adjust && !c.nul && !c.gen); }
  /** the clip that ends last on a layer - len(c) = its length on the timeline */
  function lastClip(clips, len) {
    var best = null, be = -Infinity;
    (clips || []).forEach(function (c) { if (!isUsable(c)) return; var e = (+c.start || 0) + len(c); if (e > be + 1e-6) { be = e; best = c; } });
    return best;
  }
  /** layer 2's clip: the first usable one starting at / after t0 (a little before counts), not `skip`; else its first */
  function nextClip(clips, t0, skip) {
    var us = (clips || []).filter(function (c) { return isUsable(c) && c !== skip; }).sort(function (a, b) { return (+a.start || 0) - (+b.start || 0); });
    for (var i = 0; i < us.length; i++) if ((+us[i].start || 0) >= t0 - 0.25) return us[i];
    return skip ? null : us[0] || null;
  }
  var clean = function (s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); };
  /** the prompt, written from the two characters (+ extra words) */
  function writePrompt(c1, c2, extra) {
    var a = clean(c1) || "the first character", b = clean(c2) || "the second character", x = clean(extra);
    return a.charAt(0).toUpperCase() + a.slice(1) + " slowly and seamlessly transforms into " + b + " in one continuous, uninterrupted shot. "
      + "The face, skin, hair and body gradually reshape - the features, proportions and texture changing smoothly from " + a + " to " + b
      + " - keeping the same pose, position and camera framing. Cinematic lighting, photorealistic, highly detailed, smooth realistic transformation, film look."
      + (x ? " " + x : "");
  }
  /** where things go: end1 = the end of layer 1's clip, start2 = layer 2's clip start, dur = the morph's length ->
   *  {start (the morph clip), start2 (layer 2's clip), shift (what layer 2's clip and the ones after it move by)} */
  function plan(end1, start2, dur) {
    var s = Math.max(0, +end1 || 0), d = Math.max(0.1, +dur || 0);
    return { start: s, start2: s + d, shift: s + d - (+start2 || 0) };
  }
  /** "v1" / "vl:3" / "i:2" -> "v1" | "vl" | "img" */
  function kindOfLk(lk) { return lk === "v1" ? "v1" : /^vl:\d+$/.test(lk || "") ? "vl" : /^i:\d+$/.test(lk || "") ? "img" : null; }
  /** the index in tl.vlayers the morph layer goes to, BETWEEN layer 1 and layer 2 (video layers draw in order, later =
   *  on top; V1 is under all of them, picture layers over all of them); n = how many video layers there are */
  function layerSlot(lk1, lk2, n) {
    var idx = function (lk) { var m = /^vl:(\d+)$/.exec(lk || ""); return m ? +m[1] : null; };
    var a = idx(lk1), b = idx(lk2), k1 = kindOfLk(lk1), k2 = kindOfLk(lk2);
    if (a != null && b != null) return Math.min(a, b) + 1;                      // two video layers: right above the lower one
    if (a != null) return k2 === "v1" ? a : a + 1;                              // V1 under it / pictures over it
    if (b != null) return k1 === "v1" ? b : b + 1;
    return k1 === "img" || k2 === "img" ? n : 0;                                 // V1 + V1: just above V1; pictures: the top
  }
  var pure = { NEG: NEG, isUsable: isUsable, lastClip: lastClip, nextClip: nextClip, writePrompt: writePrompt, plan: plan, kindOfLk: kindOfLk, layerSlot: layerSlot };
  if (typeof module !== "undefined" && module.exports && typeof document === "undefined") { module.exports = pure; return; }
  root.TlMorph = Object.assign({ ready: false }, pure);

  /* ================================ the page ================================ */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ready() { try { return !!(window.TlCanvas && TlCanvas.box && window.H3TlAi && typeof tl === "object" && tl && $("tlProps") && typeof mkLayer === "function"); } catch (e) { return false; } }
  function boot() { if (ready()) install(); else setTimeout(boot, 400); }
  boot();

  function install() {
    if (root.TlMorph.ready) return;
    var C = window.TlCanvas, A = window.H3TlAi;
    var busy = false;
    var tev = function (k, v) { if (root.H3TestEvent) { try { root.H3TestEvent(k, v); } catch (e) { /* the 🧪 list */ } } };
    function M() { if (!tl.morph || typeof tl.morph !== "object") tl.morph = { c1: "", c2: "", l1: "", l2: "", secs: 3, extra: "", prompt: "", own: false, sound: false }; return tl.morph; }
    function keep() { if (typeof tlSave === "function") tlSave(); }
    function say(t) { var m = $("tlmMsg"); if (m) m.textContent = t; if (t && typeof logLine === "function") logLine("[🧬] " + t); }
    var lenOf = function (lk) { var k = kindOfLk(lk); return function (c) { return C.clipLen ? C.clipLen(c, k === "img" ? "img" : k) : A.len(c); }; };
    function clipsOf(lk) {
      if (lk === "v1") return tl.video || [];
      var m = /^(vl|i):(\d+)$/.exec(lk || ""); if (!m) return [];
      var L = (m[1] === "vl" ? tl.vlayers : tl.images)[+m[2]]; return (L && L.clips) || [];
    }
    /** every layer that has a usable clip: [{lk, name}] (V1, the video layers, the picture layers) */
    function layers() {
      var out = [];
      if ((tl.video || []).some(isUsable)) out.push({ lk: "v1", name: "V1" });
      (tl.vlayers || []).forEach(function (L, i) { if ((L.clips || []).some(isUsable)) out.push({ lk: "vl:" + i, name: L.name || "V" + (i + 2) }); });
      (tl.images || []).forEach(function (L, i) { if ((L.clips || []).some(isUsable)) out.push({ lk: "i:" + i, name: L.name || "I" + (i + 1) }); });
      return out;
    }
    /** the two clips the morph joins: {c1, c2, end1} | {error} */
    function pick(o) {
      var m = o || M();
      if (!m.l1 || !m.l2) return { error: "pick layer 1 (the clip it starts from) and layer 2 (the clip it ends on)" };
      var c1 = lastClip(clipsOf(m.l1), lenOf(m.l1)); if (!c1) return { error: "layer 1 has no video or picture clip" };
      var end1 = (+c1.start || 0) + lenOf(m.l1)(c1);
      var c2 = nextClip(clipsOf(m.l2), m.l1 === m.l2 ? end1 : (+c1.start || 0), m.l1 === m.l2 ? c1 : null);
      if (!c2 && m.l1 !== m.l2) c2 = nextClip(clipsOf(m.l2), -1e9, null);
      if (!c2) return { error: m.l1 === m.l2 ? "layer 2 is layer 1 and has no clip after its last one" : "layer 2 has no video or picture clip" };
      if (c2 === c1) return { error: "layer 1 and layer 2 point at the same clip" };
      return { c1: c1, c2: c2, end1: end1 };
    }
    var isVid = function (c) { return !!(c && (c.src || c.dur != null || /\.(mp4|webm|mov|mkv|m4v|avi)$/i.test(c.name || ""))); };
    function loadImg(url) { return new Promise(function (ok, no) { var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { no(new Error("could not read " + url)); }; im.src = url; }); }
    /** the clip's picture at its out (end) / in (start) point - a video frame by the server, a picture as it is */
    function rawFrame(c, end) {
      if (isVid(c)) {
        var t = end ? Math.max(0, (c.out != null ? +c.out : +c.dur || 0) - 0.05) : (+c.in || 0);
        return fetch("/api/tlai/frame", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: c.name, t: t }) })
          .then(function (r) { return r.json().then(function (x) { if (!r.ok || x.ok === false) throw new Error(x.error || "no frame"); return x; }); })
          .then(function (x) { return loadImg(x.url); });
      }
      return loadImg("/passets/images/" + encodeURIComponent(c.name));
    }
    /** the frame as the canvas shows the clip at time t (its place / size / turn on the timeline's frame), W x H PNG */
    function frameAsShown(c, lk, t, end, W, H) {
      return rawFrame(c, end).then(function (im) {
        var cv = document.createElement("canvas"); cv.width = W; cv.height = H;
        var g = cv.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
        var S = C.state, kx = W / Math.max(1, S.W || W), ky = H / Math.max(1, S.H || H), b = null;
        try { b = C.box(c, kindOfLk(lk) === "img" ? "img" : kindOfLk(lk), t); } catch (e) { b = null; }
        if (!b || !(b.w > 0) || !(b.h > 0)) {                                    // not known yet: fit the frame
          var k = Math.min(W / im.naturalWidth, H / im.naturalHeight);
          b = { cx: (S.W || W) / 2, cy: (S.H || H) / 2, w: im.naturalWidth * k / kx, h: im.naturalHeight * k / ky, rot: 0 };
        }
        g.save(); g.translate(b.cx * kx, b.cy * ky); g.rotate((+b.rot || 0) * Math.PI / 180); g.imageSmoothingQuality = "high";
        g.drawImage(im, -b.w * kx / 2, -b.h * ky / 2, b.w * kx, b.h * ky); g.restore();
        return new Promise(function (ok) { cv.toBlob(ok, "image/png"); });
      });
    }
    /** the render: first + last frame -> a video (the toolbar's video style) -> {name, src, dur} */
    function render(first, last, secs, prompt) {
      var S = C.state, sz = A.size(S.W || 1280, S.H || 720, 1280);
      var ltx = typeof curLtxStyle === "function" ? curLtxStyle() : null;
      var neg = (window.H3Neg ? H3Neg.get() : "") || "";
      var fd = new FormData(), url;
      fd.append("prompt", prompt);
      fd.append("negative", neg ? neg + ", " + NEG : NEG);
      if ($("videoStyleSel") && $("videoStyleSel").value) fd.append("video_style_id", $("videoStyleSel").value);
      fd.append("width", String(sz.w)); fd.append("height", String(sz.h)); fd.append("seed", "-1");
      if (ltx) { url = "/api/ltx"; fd.append("seconds", String(Math.max(1, Math.min(10, Math.ceil(secs))))); fd.append("ltx_mode", "auto"); }
      else { url = "/api/generate"; fd.append("mode", "fl2va"); fd.append("frames", String(A.frames(secs, 24))); fd.append("format", "mp4"); if ($("cfg")) fd.append("cfg", $("cfg").value); }
      fd.append("references", first, "morph_first.png");
      fd.append("references", last, "morph_last.png");
      return fetch(url, { method: "POST", body: fd }).then(function (r) { return r.json().then(function (x) { if (!r.ok) throw new Error(x.error || "the render was refused"); return x; }); })
        .then(function (x) {
          if (typeof refreshJobs === "function") refreshJobs();
          if (typeof awaitJob !== "function") throw new Error("the page's job poll is missing - reload");
          if (window.H3Steps && $("tlmMsg")) window.H3Steps.watch($("tlmMsg"), x.id);
          tev("tl_morph_job", x.id);
          return awaitJob(x.id).then(function (st) {
            if (st !== "done") throw new Error("the render " + st + " - see the job log");
            return fetch("/api/jobs/" + encodeURIComponent(x.id)).then(function (r) { return r.json(); });
          });
        })
        .then(function (g) {
          var out = (g.outputs && g.outputs[0]) || g.output || "";
          if (!out) throw new Error("the render made no file");
          return fetch("/api/tlai/probe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: String(out).split(/[\\/]/).pop() }) })
            .then(function (r) { return r.json().then(function (x) { if (!r.ok || x.ok === false) throw new Error(x.error || "the morph file could not be read"); return x; }); });
        });
    }
    /** the morph in place: its layer between the two, layer 2's clip (and the ones after it) after it - one undo step */
    function place(o, p, m) {
      var arr2 = clipsOf(m.l2);
      if (arr2.indexOf(o.c2) < 0) throw new Error("layer 2's clip moved while it rendered - the morph is in the assets (" + p.name + ")");
      var c1Arr = clipsOf(m.l1); if (c1Arr.indexOf(o.c1) < 0) throw new Error("layer 1's clip moved while it rendered - the morph is in the assets (" + p.name + ")");
      var end1 = (+o.c1.start || 0) + lenOf(m.l1)(o.c1), dur = Math.max(0.1, +p.dur || m.secs || 3), P = plan(end1, o.c2.start, dur);
      var s0 = +o.c2.start || 0;
      // layer 2: its clip and every clip after it move together (what was before it stays)
      if (Math.abs(P.shift) > 1e-6) arr2.forEach(function (c) { if (c !== o.c1 && (+c.start || 0) >= s0 - 1e-6) c.start = Math.round(Math.max(0, (+c.start || 0) + P.shift) * 1000) / 1000; });
      var mc = { name: p.name, src: p.src, in: 0, out: p.dur, dur: p.dur, start: Math.round(P.start * 1000) / 1000, opacity: 1, tf: { x: 0, y: 0, scale: 1, rot: 0 }, morph: { c1: m.c1, c2: m.c2 } };
      var L = mkLayer("🧬 Morph", [mc]); if (!m.sound) L.muted = true;
      var at = layerSlot(m.l1, m.l2, tl.vlayers.length);
      tl.vlayers.splice(Math.max(0, Math.min(tl.vlayers.length, at)), 0, L);
      // the layer keys after it moved up one: keep layer 1 / layer 2 pointing at their layers
      var bump = function (lk) { var q = /^vl:(\d+)$/.exec(lk || ""); return q && +q[1] >= at ? "vl:" + (+q[1] + 1) : lk; };
      m.l1 = bump(m.l1); m.l2 = bump(m.l2);
      keep();
      if (typeof renderTimeline === "function") renderTimeline();
      try { C.select(mc, { lk: "vl:" + tl.vlayers.indexOf(L) }); C.mark(); if (C.paintLayers) C.paintLayers(); } catch (e) { /* fine */ }
      if (typeof refreshAssets === "function") refreshAssets();
      return { clip: mc, layer: L, plan: P };
    }
    function make() {
      if (busy) { say("a morph is rendering - one at a time"); return Promise.resolve(null); }
      var m = M(); read();
      if (!clean(m.c1) || !clean(m.c2)) { say("write character 1 and character 2 (what turns into what)"); return Promise.resolve(null); }
      var o = pick(m); if (o.error) { say(o.error); return Promise.resolve(null); }
      var prompt = m.own && clean(m.prompt) ? clean(m.prompt) : writePrompt(m.c1, m.c2, m.extra);
      var S = C.state, sz = A.size(S.W || 1280, S.H || 720, 1280), secs = Math.max(1, Math.min(10, +m.secs || 3));
      busy = true; paintBusy();
      say("🧬 reading the last frame of " + o.c1.name + " and the first frame of " + o.c2.name + "…");
      var t1 = Math.max(+o.c1.start || 0, o.end1 - 0.05), t2 = +o.c2.start || 0;
      return Promise.all([frameAsShown(o.c1, m.l1, t1, true, sz.w, sz.h), frameAsShown(o.c2, m.l2, t2, false, sz.w, sz.h)])
        .then(function (fr) {
          if (!fr[0] || !fr[1]) throw new Error("the two frames could not be made");
          say("🧬 rendering " + clean(m.c1) + " → " + clean(m.c2) + " (" + secs + " s)…");
          return render(fr[0], fr[1], secs, prompt);
        })
        .then(function (p) {
          var r = place(o, p, m);
          say("🧬 done: " + clean(m.c1) + " → " + clean(m.c2) + " on " + r.layer.name + " from " + r.plan.start.toFixed(2) + " s (" + p.dur.toFixed(2) + " s); layer 2 now starts at " + r.plan.start2.toFixed(2) + " s · ↶ undoes it");
          tev("tl_morph_done", p.name);
          paint();
          return r;
        })
        .catch(function (e) { say("✗ " + (e && e.message || e)); tev("tl_morph_fail", String(e && e.message || e)); return null; })
        .then(function (r) { busy = false; paintBusy(); return r; });
    }

    /* ---- the tab: Properties | 🧬 Morph above the Properties panel */
    if (!$("tlmCss")) {
      var st = document.createElement("style"); st.id = "tlmCss";
      st.textContent = "#tlpTabs{display:flex;flex:none;border-top:1px solid var(--line);background:#120f0c}#tlpTabs button{flex:1;border:0;background:none;color:var(--dim);padding:4px 6px;font-size:.72rem;cursor:pointer;border-bottom:2px solid transparent}"
        + "#tlpTabs button.on{color:var(--tiger,#f59e2c);border-bottom-color:var(--tiger,#f59e2c)}#tlMorph{display:none;flex:0 1 auto;min-height:0;overflow:auto;padding:6px 8px;font-size:.72rem;border-top:1px solid var(--line)}"
        + "#tlMorph.on{display:block}#tlMorph label{display:block;margin:5px 0 2px;color:var(--dim)}#tlMorph input,#tlMorph select,#tlMorph textarea{width:100%;font-size:.72rem;padding:2px 4px;min-width:0;box-sizing:border-box}"
        + "#tlMorph textarea{min-height:76px;resize:vertical;font-family:var(--body)}#tlMorph .tlm-row{display:flex;gap:6px;align-items:center}#tlMorph .tlm-row>*{flex:1}#tlMorph .tlm-use{color:var(--dim);font-size:.66rem;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
        + "#tlMorph #tlmGo{width:100%;margin-top:8px;padding:5px;font-weight:600}#tlMorph #tlmMsg{margin-top:6px;color:var(--dim);font-size:.68rem;min-height:14px}#tlProps.tlm-off{display:none}";
      document.head.appendChild(st);
    }
    var props = $("tlProps"), tabs = document.createElement("div"); tabs.id = "tlpTabs"; tabs.setAttribute("role", "tablist");
    tabs.innerHTML = '<button type="button" data-tlt="props" class="on" role="tab">Properties</button><button type="button" data-tlt="morph" role="tab" title="Morph one character into another between two layers (the video model)">🧬 Morph</button>';
    props.parentNode.insertBefore(tabs, props);
    var pane = document.createElement("div"); pane.id = "tlMorph"; pane.setAttribute("role", "tabpanel");
    props.parentNode.insertBefore(pane, props.nextSibling);
    var KEY = "h3.tl.ptab";
    function showTab(t) {
      var mo = t === "morph";
      tabs.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b.dataset.tlt === t); });
      props.classList.toggle("tlm-off", mo); pane.classList.toggle("on", mo);
      try { localStorage.setItem(KEY, t); } catch (e) { /* private */ }
      if (mo) paint();
    }
    tabs.addEventListener("click", function (e) { var b = e.target.closest("button[data-tlt]"); if (b) showTab(b.dataset.tlt); });
    function paintBusy() { var b = $("tlmGo"); if (b) { b.disabled = busy; b.textContent = busy ? "🧬 rendering the morph…" : "🧬 Make the morph"; } }
    function useLine(lk, end) {
      var cs = clipsOf(lk); if (!cs.length) return "";
      var o = pick(M());
      var c = end ? o.c1 : o.c2; if (!c) return o.error ? "⚠ " + o.error : "";
      var s = +c.start || 0, e = s + lenOf(lk)(c);
      return (end ? "ends with " : "starts with ") + c.name + " (" + s.toFixed(2) + "–" + e.toFixed(2) + " s) - its " + (end ? "last" : "first") + " frame";
    }
    function paint() {
      if (!pane.classList.contains("on")) return;
      var m = M(), ls = layers();
      var opt = function (cur) { return '<option value="">(pick a layer)</option>' + ls.map(function (l) { return '<option value="' + esc(l.lk) + '"' + (l.lk === cur ? " selected" : "") + ">" + esc(l.name) + "</option>"; }).join(""); };
      var foc = document.activeElement && pane.contains(document.activeElement) ? document.activeElement.id : null;
      var auto = writePrompt(m.c1, m.c2, m.extra);
      pane.innerHTML = '<div class="tlp-t">🧬 Morph</div>'
        + '<label for="tlmC1">Character 1 (it starts as)</label><input type="text" id="tlmC1" placeholder="a monkey" value="' + esc(m.c1) + '">'
        + '<label for="tlmC2">Character 2 (it turns into)</label><input type="text" id="tlmC2" placeholder="a man" value="' + esc(m.c2) + '">'
        + '<label for="tlmL1">Layer 1 (the clip it starts from)</label><select id="tlmL1">' + opt(m.l1) + '</select><div class="tlm-use" id="tlmU1">' + esc(m.l1 ? useLine(m.l1, true) : "") + "</div>"
        + '<label for="tlmL2">Layer 2 (the clip it ends on)</label><select id="tlmL2">' + opt(m.l2) + '</select><div class="tlm-use" id="tlmU2">' + esc(m.l2 && m.l1 ? useLine(m.l2, false) : "") + "</div>"
        + '<div class="tlm-row"><div><label for="tlmSecs">Length (s)</label><input type="number" id="tlmSecs" min="1" max="10" step="0.5" value="' + (+m.secs || 3) + '"></div>'
        + '<div><label title="The morph\'s own sound (the video model makes one) - off = silent"><input type="checkbox" id="tlmSound"' + (m.sound ? " checked" : "") + ' style="width:auto"> keep its sound</label></div></div>'
        + '<label for="tlmExtra">Extra words (optional - the look, the light, the mood)</label><input type="text" id="tlmExtra" placeholder="e.g. golden hour, slow motion" value="' + esc(m.extra) + '">'
        + '<label for="tlmPrompt">The prompt ' + (m.own ? "(✎ yours)" : "(written for you)") + '</label><textarea id="tlmPrompt">' + esc(m.own && m.prompt ? m.prompt : auto) + "</textarea>"
        + '<div class="tlm-row"><button type="button" class="ghost" id="tlmRe" title="Write the prompt again from the characters"' + (m.own ? "" : " disabled") + ">↺ write it for me</button></div>"
        + '<button type="button" id="tlmGo"></button><div id="tlmMsg"></div>'
        + '<div class="tlm-use" style="white-space:normal">Renders with the video style picked in the toolbar (first + last frame). The morph goes on a new 🧬 Morph layer between the two; layer 2 moves to start when it ends. ↶ undoes it.</div>';
      paintBusy();
      var on = function (id, ev, fn) { var el = $(id); if (el) { el.addEventListener(ev, fn); el.addEventListener("keydown", function (e) { e.stopPropagation(); }); } };
      on("tlmC1", "input", function () { read(); refreshAuto(); });
      on("tlmC2", "input", function () { read(); refreshAuto(); });
      on("tlmExtra", "input", function () { read(); refreshAuto(); });
      on("tlmL1", "change", function () { read(); paint(); });
      on("tlmL2", "change", function () { read(); paint(); });
      on("tlmSecs", "change", read); on("tlmSound", "change", read);
      on("tlmPrompt", "input", function () { var mm = M(); mm.prompt = $("tlmPrompt").value; mm.own = true; keep(); var r = $("tlmRe"); if (r) r.disabled = false; });
      on("tlmRe", "click", function () { var mm = M(); mm.own = false; mm.prompt = ""; keep(); paint(); });
      on("tlmGo", "click", function () { make(); });
      if (foc && $(foc)) { try { $(foc).focus(); } catch (e) { /* fine */ } }
    }
    function refreshAuto() { var m = M(), p = $("tlmPrompt"); if (p && !m.own) p.value = writePrompt(m.c1, m.c2, m.extra); }
    function read() {
      var m = M(), v = function (id) { var el = $(id); return el ? el.value : null; };
      if (v("tlmC1") != null) m.c1 = v("tlmC1"); if (v("tlmC2") != null) m.c2 = v("tlmC2");
      if (v("tlmL1") != null) m.l1 = v("tlmL1"); if (v("tlmL2") != null) m.l2 = v("tlmL2");
      if (v("tlmExtra") != null) m.extra = v("tlmExtra");
      if (v("tlmSecs") != null) m.secs = Math.max(1, Math.min(10, +v("tlmSecs") || 3));
      if ($("tlmSound")) m.sound = $("tlmSound").checked;
      keep();
    }
    // the layer lists follow the timeline (a clip added / moved, a layer renamed) while the tab is open
    if (typeof window.renderTimeline === "function" && !window.renderTimeline.__tlm) {
      var base = window.renderTimeline;
      window.renderTimeline = function () { var r = base.apply(this, arguments); if (pane.classList.contains("on") && !(document.activeElement && pane.contains(document.activeElement) && /INPUT|TEXTAREA/.test(document.activeElement.tagName))) { try { paint(); } catch (e) { /* fine */ } } return r; };
      window.renderTimeline.__tlm = true;
    }
    var was = null; try { was = localStorage.getItem(KEY); } catch (e) { /* private */ }
    if (was === "morph") showTab("morph");
    Object.assign(root.TlMorph, { ready: true, make: make, pick: pick, layers: layers, show: showTab, paint: paint, frameAsShown: frameAsShown });
  }
})(typeof window !== "undefined" ? window : globalThis);
