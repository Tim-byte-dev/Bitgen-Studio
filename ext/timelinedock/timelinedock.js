/* bitGen Studio — timelinedock's OWN wiring (2.223.14). The timeline ENGINE
   (renderTimeline, tlSave, tlSwitch, the preview/playhead machinery) stays
   core by instruction — the video docker and the project save lean on it —
   so this file is exactly the docker's private controls: every tl* button,
   slider and dropdown binding, moved verbatim. Handlers call the core
   engine at click time through the page's global scope. */
(function () {
  function $(id) { return document.getElementById(id); }

$("tlSel") && ($("tlSel").onchange = () => tlSwitch($("tlSel").value).catch((e) => appNote(e.message, "Timeline")));

$("tlSaveBtn") && ($("tlSaveBtn").onclick = () => tlSaveNamed(tlName).catch((e) => appNote(e.message, "Timeline")));

$("tlSaveAs") && ($("tlSaveAs").onclick = async () => {
  const name = await askText("Save timeline as", "Name:", tlName);
  if (!name) return;
  tlSaveNamed(name).catch((e) => appNote(e.message, "Timeline"));
});

$("tlSetFirst") && ($("tlSetFirst").onclick = () => setMarker("ff"));

$("tlSetLast") && ($("tlSetLast").onclick = () => setMarker("lf"));

$("tlAddRef") && ($("tlAddRef").onclick = () => setMarker("ref"));

$("tlAddVideo").onclick = async () => {
  let files = [];
  try {
    const r = await fetch("/api/outputs");
    if (!r.ok) throw new Error("HTTP " + r.status);
    files = await r.json();
  } catch (e) { alert("Could not read the gallery: " + e.message); return; }
  if (!files.length) {
    let w = null;
    try { w = await (await fetch("/api/outputs/where")).json(); } catch {}
    alert("No videos in project '" + (w ? w.project : "?") + "'.\n"
          + (w ? w.dir + "\n\n" : "")
          + "If you rendered them under a different project, load that project first.");
    return;
  }
  const name = await askText("Add video", "Which video?", "",
    files.map((f) => f.name));
  const i = parseInt(name, 10) - 1;
  if (isNaN(i) || !files[i]) return;
  tl.video.push({ name: files[i].name, dur: files[i].duration || 5, in: 0, out: files[i].duration || 5, opacity: 1, start: tlVideoLen() });
  tlSave(); renderTimeline();
};

$("tlAddAudio").onclick = () => $("audiopick").click();

$("tlAddTrack").onclick = () => { tl.audio.push(mkLayer("A" + (tl.audio.length + 1))); tlSave(); renderTimeline(); };

$("tlAddImgTrack").onclick = () => { tl.images.push(mkLayer("I" + (tl.images.length + 1))); tlSave(); renderTimeline(); };

$("tlAddImage").onclick = () => $("imagepick").click();

$("tlZoom").oninput = () => {
  PXS = zoomToPXS(parseInt($("tlZoom").value, 10));
  store.set("tlzoom", $("tlZoom").value);
  renderTimeline();
};

$("tlClear").onclick = async () => {
  if (!(await appConfirm("Clear the whole timeline?"))) return;
  // vlayers MUST be reset too — it used to be dropped from the object entirely,
  // and the next vLayerClips() call then threw on undefined.flat(), leaving the
  // timeline dead until a page reload.
  tl = { video: [], v1: { name: "V1", ...LDEF }, vlayers: [], audio: [], images: [],
         markers: { ff: null, lf: null, refs: [] }, sel: null, selLayer: null };
  tlSave(); renderTimeline();
};

$("tlSelIn").onclick = () => {
  if (playhead === null) { alert("Click on the timeline first to set the playhead."); return; }
  setSel(playhead, tl.sel && tl.sel.b > playhead ? tl.sel.b : playhead + 1 / TLFPS);
};

$("tlSelOut").onclick = () => {
  if (playhead === null) { alert("Click on the timeline first to set the playhead."); return; }
  setSel(tl.sel && tl.sel.a < playhead ? tl.sel.a : Math.max(0, playhead - 1 / TLFPS), playhead);
};

$("tlSelClear").onclick = () => clearSel();

$("tlKeepSel").onclick = () => applySel("keep");

$("tlCutSel").onclick = () => applySel("cut");

$("tlTrimHead").onclick = () => applyTrim("head");

$("tlTrimTail").onclick = () => applyTrim("tail");

$("tlFrames").onclick = () => openFrames();

/* 2.414.0: THE COMPILE'S PAYLOAD for any timeline object (the open one, or a NESTED one being rendered - ext/timelinedock/
   nest.js) - it used to be built inline from the open timeline only. o = {nest: name (no deliverables, its own file),
   keepAudio, preview: id (2.418.0 ⚡ - its own file, no deliverables)}. Also fixed here: a V2+ clip's J / L (split) and a video's sound taken out (soundOut, src) now reach the
   compile (2.412.0 built them, the page never sent them). */
/* 2.491.0: a canvas layer's BLEND MODE and TRACK MATTE for the compile (ext/timelinedock/tlblend.js): its key ("vl:2",
   "i:0"), its blend, its matte {mode, by: the layer right above it} - and a layer used as a matte is only that
   (matteonly: the compile never draws it, even when it is hidden) */
function tlStackKeys(X) {
  return (X.vlayers || []).map((L, i) => ({ L, lk: "vl:" + i })).concat((X.images || []).map((L, j) => ({ L, lk: "i:" + j })));
}
function tlLayerKeys(X, L) {
  const st = tlStackKeys(X), k = st.findIndex((e) => e.L === L);
  if (k < 0) return {};
  const MODES = ["alpha", "alphainv", "luma", "lumainv"], below = st[k - 1], above = st[k + 1];
  const out = { lk: st[k].lk };
  if (L.blend && L.blend !== "normal") out.blend = L.blend;
  if (MODES.includes(L.matte) && above) out.matte = { mode: L.matte, by: above.lk };
  if (below && MODES.includes(below.L.matte)) out.matteonly = true;
  return out;
}
/* 2.495.0: a VIDEO-layer clip following a parent (⛓, ext/timelinedock/tlparent.js) reaches the compile as its WORLD
   position / scale / rotation (sampled each frame, thinned to what moves) - the canvas draws it the same */
function tlTfKf(c, kind) { return (c.parent || (window.TlExpr && TlExpr.moves && TlExpr.moves(c))) && window.TlParent && TlParent.worldKeys ? TlParent.worldKeys(c, kind || "vl") : { tf: c.tf, kf: c.kf }; }   // 2.497.0: + ƒx expressions
function tlIsMatte(X, L) { return !!tlLayerKeys(X, L).matteonly; }
window.TlLayerKeys = tlLayerKeys;
function exportBody(X, o) {
  o = o || {};
  const V1 = X.v1 || {};
  const anySolo = !!(V1.solo || (X.vlayers || []).some(L => L.solo) || (X.audio || []).some(L => L.solo) || (X.images || []).some(L => L.solo));
  const live = (L) => !!L && L.visible !== false && (!anySolo || L.solo);
  return {
      // 2.406.0: fx = 🎬 speed / reverse / ramp, 🎨 grade + LUT, 🎧 sound clean-up (ext/timelinedock/clipfx.js); dur lets
      // the route size a retimed clip that was never trimmed
      video: (X.video || []).map(c => ({ name: c.name, src: c.src || "output", in: c.in, out: c.out < (c.dur || 1e9) - 0.05 ? c.out : null, opacity: c.opacity ?? 1, start: c.start || 0,
                                  dur: c.dur, fx: c.fx || undefined, split: c.split || undefined,   // 2.407.0: J / L cut
                                  ak: tlAnyKeys(c),                                     // 2.516.0: ◇ keyed colour / effect settings
                                  soundOut: c.soundOut || undefined,   // 2.414.0: its sound taken out (🔗, 2.412)
                                  tail: c.tail > 0 ? c.tail : undefined })),   // 2.572.0: ✨ Auto transition - held under the next clip
      video_role: V1.role || "voice",                                   // 2.406.0: the mix (🎚 ducking)
      mix: X.mix || undefined,                                           // 2.406.0: ducking + loudness
      captions: X.captions && X.captions.visible !== false ? X.captions : undefined,   // 2.406.0: 💬 captions
      deliver: o.nest || o.preview ? undefined : (window.TlDeliver ? TlDeliver.forCompile() : undefined),   // 2.418.0: a ⚡ preview has none      // 2.407.0: the 📤 Export queue
      tc: X.tc || undefined,                                              // 2.407.0: the start timecode
      frame: X.frame && X.frame.w && X.frame.h ? { w: X.frame.w, h: X.frame.h } : undefined,   // 2.513.0: the timeline's frame size (tlsizebar.js)
      deliverRange: !o.nest && !o.preview && X.deliverRange === "io" ? "io" : undefined,          // 2.410.0: 📤 In / Out only -
      sel: !o.nest && !o.preview && X.deliverRange === "io" && X.sel ? { a: X.sel.a, b: X.sel.b } : undefined,   //   the ruler selection
      deliverHw: X.deliverHw === true ? true : undefined,                // 2.411.0: the graphics card's encoder
      video_muted: !!V1.muted || !live(V1),
      video_volume: live(V1) ? (V1.volume ?? 1) : 0,
      video_pan: V1.pan || undefined,                                    // 2.415.0: 🎚 the mixer's pan (lib/mixer.js)
      master: X.master || undefined,                                     // 2.415.0: 🎚 the master fader
      video_opacity: live(V1) ? (V1.opacity ?? 1) : 0,
      // V1 is the only sequential track, so its transition is a true xfade
      // between adjacent clips; the worker keeps the plain concat for a cut
      video_transition_in: trNorm(V1.transitionIn),
      video_transition_out: trNorm(V1.transitionOut),
      // hidden / un-soloed layers are dropped here rather than in the worker,
      // so what compiles is exactly what the preview just showed
      video_layers: (X.vlayers || []).filter(L => live(L) || tlIsMatte(X, L)).map(L => ({
        name: L.name, muted: !!L.muted, volume: L.volume ?? 1, opacity: L.opacity ?? 1, pan: L.pan || undefined,   // 2.415.0: 🎚
        transition_in: trNorm(L.transitionIn),
        transition_out: trNorm(L.transitionOut),
        // 2.379.0: the canvas's position / scale / rotation (tf, 2.377 - it never left the page before) and the
        // clip's ◆ keyframes (kf: opacity, position, scale, rotation - tweened in the compile)
        clips: clipsOf(L).map(c => ({ name: c.name, src: c.src || "output", in: c.in,
                             out: c.out < (c.dur || 1e9) - 0.05 ? c.out : null,
                             opacity: c.opacity ?? 1, start: c.start || 0, ...tlTfKf(c), mbake: c.mbake && c.masks && c.masks.length ? c.mbake : undefined, cut: c.cut && c.cut.use === true && c.cut.file ? { file: c.cut.file, from: c.cut.from, to: c.cut.to, use: true } : undefined, pin: window.TlTrack && TlTrack.workerPin ? TlTrack.workerPin(c) : undefined, tm: window.TlTime && TlTime.clean ? TlTime.clean(c.tm) || undefined : undefined, dbake: c.dbake && window.TlDist && TlDist.live(c) ? c.dbake : undefined, vbake: c.vbake && window.TlVBake && TlVBake.needs(c) ? c.vbake : undefined,   // 2.498.0: ✒ its mask video; 2.499.0: ▢ its corner pin   // 2.495.0: a clip following a parent: its world keys
                             dur: c.dur, fx: c.fx || undefined, ak: tlAnyKeys(c),   // 2.516.0: ◇ keyed colour / effect settings
                             split: c.split || undefined, soundOut: c.soundOut || undefined, tail: c.tail > 0 ? c.tail : undefined, ...tlLayerKeys(X, L) })),   // 2.572.0: tail = ✨ Auto transition   // 2.491.0: blend + matte   // 2.414.0: J / L + 🔗 on V2+ (2.412) reach the compile
        role: L.role || "voice",                                          // 2.406.0
      })),
      // audio/image tracks carry their layer's transitions, so they are sent
      // as objects rather than bare clip arrays. The route still accepts the
      // old array shape, so an older saved project compiles unchanged.
      audio: (X.audio || []).filter(L => live(L) && !L.muted).map(L => ({
        transition_in: trNorm(L.transitionIn),
        transition_out: trNorm(L.transitionOut),
        clips: clipsOf(L).map(c => ({
          name: c.name, start: c.start, in: c.in, kf: c.kf,                          // 2.379.0: ◆ volume keyframes
          volume: (L.volume ?? 1) * (c.volume ?? 1), pan: L.pan || undefined,         // 2.415.0: 🎚 the layer's fader x the clip's (as the canvas plays it), its pan
          src: c.src || undefined,                                                   // 2.414.0: a video's sound taken out plays from its file
          out: c.out < (c.dur || 1e9) - 0.05 ? c.out : null,
          dur: c.dur, fx: c.fx || undefined, role: c.role || L.role || "music" })) })),   // 2.406.0: 🎧 clean-up + its role
      images: (X.images || []).filter(L => live(L) || tlIsMatte(X, L)).map(L => ({
        transition_in: trNorm(L.transitionIn),
        transition_out: trNorm(L.transitionOut),
        // 2.379.0: tf + kf like the video layers; lopacity = the layer's own opacity (a keyframed opacity is
        // multiplied by it); text = a TEXT layer (its keyframed colour tints text_<id>_w.png)
        // 2.490.0: a NULL object is never compiled; a clip the page BAKED (a parented layer: video/tlb_<id>.webm,
        // ext/timelinedock/tlparent.js) goes as that file - the compile overlays it as it is
        clips: clipsOf(L).filter(c => !c.nul && !(c.shape && !c.bake)).map(c => ({   // 2.492.0: an unbaked shape never reaches the compile
          name: c.name, start: c.start, len: c.len,
          opacity: (c.opacity ?? 1) * (L.opacity ?? 1), lopacity: L.opacity ?? 1,
          ...tlTfKf(c, "img"), text: c.text ? { tid: c.tid } : undefined,   // 2.497.0: expressions -> sampled keys
          // 2.493.0: + a text layer with text animators
          bake: (c.parent || c.shape || (c.text && ((c.text.anim && c.text.anim.length) || (c.text.onpath && c.text.onpath.on !== false))) || (c.masks && c.masks.length) || (c.pin && c.pin.on !== false) || (c.tm && window.TlTime && TlTime.on(c)) || (c.gen && window.TlGen && TlGen.live(c)) || (c.dist && window.TlDist && TlDist.live(c)) || (window.TlVBake && TlVBake.needs(c))) && c.bake ? c.bake : undefined, ...tlLayerKeys(X, L) })) })),   // 2.491.0: blend + matte; 2.498.0: + masks (+ text on a path: a 2.496.0 gap)
      keep_original_audio: o.keepAudio != null ? !!o.keepAudio : ($("tlKeepA") ? $("tlKeepA").checked : true),
      nest: o.nest || undefined,                                           // 2.414.0: a nested sequence's render
      preview: o.preview || undefined,                                     // 2.418.0: ⚡ a render preview (lib/tlRender.js)
    };
}
/** 2.516.0: a clip's ◇ keyed colour / effect settings as the compile animates them (static/anykeys.js forCompile) */
function tlAnyKeys(c) { try { return window.H3AnyKeys && c && Array.isArray(c.kf) && c.kf.length ? H3AnyKeys.forCompile(c, window.H3Keyframes) || undefined : undefined; } catch (e) { return undefined; } }
window.TlExportBody = exportBody;

$("tlExport").onclick = async () => {
  if (!tl.video.length) { alert("Add at least one video clip."); return; }
  // 2.382.0: the text pictures and every 3D layer's bake (video/m3d_<id>.webm) are on disk before the compile reads them
  if (window.TlCanvas && typeof TlCanvas.beforeExport === "function") {
    try { await TlCanvas.beforeExport(); }
    catch (e) { alert("A 3D layer could not be baked: " + (e && e.message || e)); return; }
  }
  const res = await fetch("/api/export", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(exportBody(tl)),
  });
  const j = await res.json();
  if (!res.ok) { alert(j.error || "export failed"); return; }
  await refreshJobs();
  selectJob(j.id);
};

$("tliAdd") && ($("tliAdd").onclick = () => addTempLora("image", null));

$("tlvAdd") && ($("tlvAdd").onclick = () => addTempLora("video", null));

$("tlPlay") && ($("tlPlay").onclick = () => pvStart());

$("tlPause") && ($("tlPause").onclick = () => pvPause());

$("tlStop") && ($("tlStop").onclick = () => pvStop());

// 2.311.0: the rest of the transport (core engine: tlGoto / tlStep)
$("tlToStart") && ($("tlToStart").onclick = () => tlGotoStart());

$("tlToEnd") && ($("tlToEnd").onclick = () => tlGotoEnd());

$("tlStepBack") && ($("tlStepBack").onclick = (e) => tlStep(-1, !!(e && e.shiftKey)));

$("tlStepFwd") && ($("tlStepFwd").onclick = (e) => tlStep(1, !!(e && e.shiftKey)));


})();
