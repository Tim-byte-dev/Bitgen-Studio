/* bitGen Studio — static/tlseq.js (2.571.0): ⛓ SEQUENTIAL - the timeline's clips one after the other down its layers,
 * window.H3TlSeq.
 *
 * Tim (verbatim): "add a button to the timeline to auto arrange, arrange the 1 after the other so they play sequentially
 * without a gap, if user deletes a clip drag all the clips below it to rearrange the order so the clips stay sequential,
 * if user inserts a layer and adds a clip to that layer, rearrange the clips so they are sequential without a gap in
 * clips"
 *
 *   ⛓ Sequential (the timeline's bar)  ON = arranged now and kept arranged: the clips play one after the other with no
 *            gap, in the order of the layers from the top row down - V1's clips first (back to back), then each picture
 *            layer, then each video layer; on a layer with several clips, those in time order. After every change (a
 *            clip deleted, a layer added / moved, a clip dropped or trimmed) the ones below close up / make room -
 *            it runs on every save of the timeline (tlSave). OFF = nothing moves by itself. Kept with the timeline
 *            (tl.seqAuto).
 *   What takes part: media clips (videos, pictures) - not sound layers, not text, shapes, generators, the karaoke
 *   layer or a path layer's subject; a layer with none of those is skipped.
 *
 * 2.572.0 (Tim: "can we have an auto transition button with number of frames input in the timeline menubar. for music
 * videos it is important that the lipsync is timed well. add a mute all button to mute all video layers. i prefer to have
 * a full sound clip and the video lipsync match - the full soundclip prevents abrupt cuts in the song"):
 *   ✨ Auto transition [N] frames [type]  ON = at every cut between two video clips on different layers (V1 / V2+ - as a
 *            multi-drag or ⛓ Sequential lays them) the next clip comes in with the transition over N frames WITHOUT
 *            MOVING ANYTHING: every clip keeps its start (the lip sync with the song stays frame-exact); the clip before
 *            is held under it for those N frames (c.tail - its own frames past its out point when the file has them,
 *            else its last frame held; the compile renders it first - scripts/cliptail.py) and the next clip's layer
 *            gets the transition In (a dissolve by default; when the next clip's layer is UNDER the one before, the one
 *            before gets it Out instead, over its held frames). Kept on every save while on (after ⛓ Sequential's
 *            arranging); OFF takes away what it added. Clips on V1 itself keep V1's own join (that one overlaps).
 *   🔇 Video sound  mutes / unmutes V1 and every video layer at once - the song on its sound layer plays alone.
 * Pure (Node: scripts/test-tlseq571.js, scripts/test-autotr572.js): eligible, rowsOf, arrange, cuts, planTr.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  /** a clip that takes part: a picture / video file (not text, a shape, a generator) */
  const eligible = (c) => !!c && typeof c.name === "string" && !!c.name && !c.text && !c.shape && !c.gen && !c.karaoke;
  /** the rows in screen order (top first): V1, the picture layers, the video layers - [{lk, clips}] with something in them */
  function rowsOf(tl) {
    const t = tl || {}, out = [];
    if ((t.video || []).some(eligible)) out.push({ lk: "v1", clips: t.video });
    (t.images || []).forEach((L, i) => { if (L && !L.karaoke && (L.clips || []).some(eligible)) out.push({ lk: "i:" + i, clips: L.clips }); });
    (t.vlayers || []).forEach((L, i) => { if (L && !L.karaoke && !L.path && (L.clips || []).some(eligible)) out.push({ lk: "vl:" + i, clips: L.clips }); });
    return out;
  }
  /** one after the other from `from` (frames of fps): each row's clips in time order -> {moved, end} (mutates the starts) */
  function arrange(rows, lenOf, from, fps) {
    const f = fps || 24, snap = (v) => Math.round(v * f) / f;
    let t = snap(Math.max(0, +from || 0)), moved = 0;
    for (const r of rows || []) {
      const cs = (r.clips || []).filter(eligible).slice().sort((a, b) => (+a.start || 0) - (+b.start || 0));
      for (const c of cs) {
        const at = snap(t);
        if (Math.abs((+c.start || 0) - at) > 1e-6) { c.start = at; moved++; }
        t = at + Math.max(1 / f, +lenOf(c) || 0);
      }
    }
    return { moved, end: snap(t) };
  }
  /** 2.572.0: the cuts - one video clip ending where another starts on another layer (a frame and a half either way):
   *  [{a, b, la, lb, za, zb}] - za / zb = how high the layer draws (V1 = -1, V2 = 0 ...); lenOf = a clip's length */
  function cuts(tl, lenOf, fps) {
    const f = fps || 24, t = tl || {}, all = [];
    (t.video || []).forEach((c) => { if (eligible(c)) all.push({ c, L: t.v1 || null, z: -1, lk: "v1" }); });
    (t.vlayers || []).forEach((L, i) => { if (L && !L.karaoke && !L.path) (L.clips || []).forEach((c) => { if (eligible(c)) all.push({ c, L, z: i, lk: "vl:" + i }); }); });
    all.sort((x, y) => (+x.c.start || 0) - (+y.c.start || 0) || x.z - y.z);
    const out = [];
    for (const A of all) {
      const end = (+A.c.start || 0) + (+lenOf(A.c) || 0);
      const B = all.find((x) => x !== A && x.lk !== A.lk && Math.abs((+x.c.start || 0) - end) <= 1.5 / f);
      if (B && !out.some((p) => p.b === B.c)) out.push({ a: A.c, b: B.c, la: A.L, lb: B.L, za: A.z, zb: B.z });
    }
    return out;
  }
  /** what to set for those cuts: N frames of `type` -> [{clip, tail}] + [{layer, key, tr}] (the transition no longer than
   *  half of the clip it is on, 4 s at most) */
  function planTr(pairs, frames, type, fps, lenOf) {
    const f = fps || 24, want = Math.max(1, Math.min(96, Math.round(+frames || 12))) / f, tails = [], trs = [];
    for (const p of pairs || []) {
      const d = Math.max(1 / f, Math.min(4, want, (+lenOf(p.b) || 0) / 2, (+lenOf(p.a) || 0) > 0 ? 4 : 0));
      const dd = Math.round(d * f) / f;
      tails.push({ clip: p.a, tail: dd });
      if (p.zb > p.za) trs.push({ layer: p.lb, key: "transitionIn", tr: { type: type || "dissolve", dur: dd } });
      else trs.push({ layer: p.la, key: "transitionOut", tr: { type: type || "dissolve", dur: dd } });
    }
    return { tails, trs };
  }
  const pure = { eligible, rowsOf, arrange, cuts, planTr };
  if (typeof module !== "undefined" && module.exports && typeof document === "undefined") { module.exports = pure; return; }

  /* ================================ the page ================================ */
  const doc = root.document, $ = (id) => doc.getElementById(id);
  /* eslint-disable no-undef */
  const lenOf = (c) => (c.len != null && c.out == null ? imgLen(c) : effDur(c));
  const on = () => typeof tl !== "undefined" && !!(tl && tl.seqAuto);
  /** arrange the timeline now (no save) -> how many moved */
  function apply() {
    if (typeof tl === "undefined" || !tl) return 0;
    const r = arrange(rowsOf(tl), lenOf, 0, typeof TLFPS === "number" ? TLFPS : 24);
    return r.moved;
  }
  /** the button: on = arrange + keep arranged; off = leave */
  function toggle(want) {
    if (typeof tl === "undefined" || !tl) return false;
    tl.seqAuto = want == null ? !tl.seqAuto : !!want;
    const n = tl.seqAuto ? apply() : 0;
    paintBtn();
    tlSave(); renderTimeline();
    if (root.TlCanvas && TlCanvas.mark) TlCanvas.mark();
    const st = $("tlStatus") || $("status");
    if (st && tl.seqAuto) st.textContent = `⛓ sequential: ${n} clip(s) moved - the clips play one after the other down the layers`;
    return tl.seqAuto;
  }
  /* ---- 2.572.0: ✨ Auto transition + 🔇 Video sound */
  const AT = () => (tl.autoTr && typeof tl.autoTr === "object" ? tl.autoTr : (tl.autoTr = { on: false, frames: 12, type: "dissolve" }));
  const atOn = () => typeof tl !== "undefined" && !!(tl && tl.autoTr && tl.autoTr.on);
  /** take away what Auto transition added (its tails, the transitions it set) */
  function clearAuto() {
    const cl = [].concat(tl.video || [], ...((tl.vlayers || []).map((L) => L.clips || [])));
    for (const c of cl) if (c && c.autoTail) { delete c.tail; delete c.autoTail; }
    for (const L of [tl.v1].concat(tl.vlayers || [])) {
      if (!L) continue;
      for (const k of ["transitionIn", "transitionOut"]) if (L["auto_" + k]) { L[k] = { type: "none", dur: (L[k] && L[k].dur) || 0.5 }; delete L["auto_" + k]; }
    }
  }
  /** set them for every cut now -> how many cuts */
  function applyAuto() {
    if (typeof tl === "undefined" || !tl) return 0;
    clearAuto();
    const a = AT(), fps = typeof TLFPS === "number" ? TLFPS : 24;
    const pairs = cuts(tl, lenOf, fps), pl = planTr(pairs, a.frames, a.type, fps, lenOf);
    for (const t of pl.tails) { t.clip.tail = t.tail; t.clip.autoTail = true; }
    for (const t of pl.trs) {
      if (!t.layer) continue;
      const cur = t.layer[t.key];
      if (cur && cur.type && cur.type !== "none" && !t.layer["auto_" + t.key]) continue;      // one the user set stays
      t.layer[t.key] = Object.assign({}, t.tr); t.layer["auto_" + t.key] = true;
    }
    return pairs.length;
  }
  function autoToggle(want) {
    const a = AT();
    a.on = want == null ? !a.on : !!want;
    const n = a.on ? applyAuto() : (clearAuto(), 0);
    paintBtn(); tlSave(); renderTimeline();
    if (root.TlCanvas && TlCanvas.mark) TlCanvas.mark();
    const st = $("tlStatus") || $("status");
    if (st) st.textContent = a.on ? `✨ auto transition: ${n} cut(s) - ${a.frames} frame(s) of ${a.type}; every clip keeps its start (the lip sync stays)` : "✨ auto transition off - plain cuts again";
    return a.on;
  }
  const videoLayers = () => [tl.v1].concat(tl.vlayers || []).filter((L) => L && !L.karaoke);
  const allMuted = () => typeof tl !== "undefined" && !!tl && videoLayers().every((L) => !!L.muted);
  function muteAll(want) {
    const m = want == null ? !allMuted() : !!want;
    for (const L of videoLayers()) L.muted = m;
    paintBtn(); tlSave(); renderTimeline();
    const st = $("tlStatus") || $("status");
    if (st) st.textContent = m ? "🔇 every video layer muted - the song plays alone" : "🔊 the video layers' sound is back";
    return m;
  }
  /* eslint-enable no-undef */
  function paintBtn() {
    const b = $("tlSeqBtn"); if (!b) return;
    b.classList.toggle("on", on()); b.setAttribute("aria-pressed", on() ? "true" : "false");
    const t = $("tlAutoTr"), n = $("tlAutoTrN"), ty = $("tlAutoTrT"), m = $("tlMuteV");
    if (t && typeof tl !== "undefined" && tl) {
      t.classList.toggle("on", atOn()); t.setAttribute("aria-pressed", atOn() ? "true" : "false");
      const a = tl.autoTr || {};
      if (n && doc.activeElement !== n && a.frames) n.value = a.frames;
      if (ty && doc.activeElement !== ty && a.type) ty.value = a.type;
    }
    if (m && typeof tl !== "undefined" && tl) { const am = allMuted(); m.classList.toggle("on", am); m.textContent = am ? "🔇 Video sound" : "🔊 Video sound"; m.setAttribute("aria-pressed", am ? "true" : "false"); }
  }
  function bar() {
    if ($("tlSeqBtn")) return true;
    const rip = $("tlRipple"), anchor = rip ? rip.closest("label") || rip : null;
    if (!anchor || !anchor.parentNode) return false;
    const b = doc.createElement("button"); b.id = "tlSeqBtn"; b.type = "button"; b.className = "ghost"; b.textContent = "⛓ Sequential";
    b.title = "Auto arrange: the clips play one after the other with no gap, down the layers from the top (V1, the picture layers, the video layers) - and stay that way when you delete a clip, add or move a layer (click again: off)";
    b.onclick = () => toggle();
    anchor.parentNode.insertBefore(b, anchor.nextSibling);
    // 2.572.0: ✨ Auto transition [frames] [type] + 🔇 Video sound, right after it
    const box = doc.createElement("span"); box.id = "tlAutoTrBox";
    const TYPES = [["dissolve", "dissolve"], ["fade", "fade"], ["wipeleft", "wipe ←"], ["wiperight", "wipe →"], ["wipeup", "wipe ↑"], ["wipedown", "wipe ↓"], ["slideleft", "slide ←"], ["slideright", "slide →"], ["circleopen", "circle"], ["radial", "radial"], ["pixelize", "pixelize"], ["zoomin", "zoom in"]];
    box.innerHTML = `<button id="tlAutoTr" type="button" class="ghost" title="Auto transition: at every cut between two video clips the next one comes in over N frames - nothing moves, so the lip sync with the song stays frame-exact (the clip before is held under it for those frames). Kept while on; click again: plain cuts">✨ Auto transition</button>`
      + `<input id="tlAutoTrN" type="number" min="1" max="96" step="1" value="12" title="The transition's length in frames (24 a second)" aria-label="Auto transition frames"><span class="hint" style="font-size:.7rem">fr</span>`
      + `<select id="tlAutoTrT" title="The transition" aria-label="Auto transition type">${TYPES.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>`
      + `<button id="tlMuteV" type="button" class="ghost" title="Mute / unmute V1 and every video layer at once - the song on its sound layer plays alone, with no cuts in it">🔊 Video sound</button>`;
    b.after(box);
    const nIn = box.querySelector("#tlAutoTrN"), tIn = box.querySelector("#tlAutoTrT");
    box.querySelector("#tlAutoTr").onclick = () => autoToggle();
    box.querySelector("#tlMuteV").onclick = () => muteAll();
    nIn.addEventListener("keydown", (e) => e.stopPropagation());
    nIn.onchange = () => { const a = AT(); a.frames = Math.max(1, Math.min(96, Math.round(+nIn.value || 12))); nIn.value = a.frames; if (a.on) { applyAuto(); tlSave(); renderTimeline(); } else tlSave(); };   // eslint-disable-line no-undef
    tIn.onchange = () => { const a = AT(); a.type = tIn.value; if (a.on) { applyAuto(); tlSave(); renderTimeline(); } else tlSave(); };   // eslint-disable-line no-undef
    const css = doc.createElement("style"); css.id = "tlSeqCss";
    css.textContent = "#tlSeqBtn.on,#tlAutoTr.on,#tlMuteV.on{border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c);background:rgba(245,158,44,.12)}"
      + "#tlAutoTrBox{display:inline-flex;gap:3px;align-items:center}#tlAutoTrN{width:46px}#tlAutoTrT{max-width:92px}";
    doc.head.appendChild(css);
    paintBtn();
    return true;
  }
  /** every save keeps it arranged while ⛓ is on */
  function wrapSave() {
    if (typeof root.tlSave !== "function" || root.tlSave.__seq) return false;
    const orig = root.tlSave;
    const w = function () {
      try { if (on()) apply(); } catch (e) { /* never stops a save */ }
      try { if (atOn()) applyAuto(); } catch (e) { /* never stops a save */ }   // 2.572.0: after the arranging - the cuts as they now are
      return orig.apply(this, arguments);
    };
    w.__seq = true;
    root.tlSave = w;
    return true;
  }
  function boot() { const a = bar(), b = wrapSave(); paintBtn(); if (!(a && b)) root.setTimeout(boot, 500); }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.setInterval(paintBtn, 1500);                       // a timeline loaded with tl.seqAuto shows it
  root.H3TlSeq = Object.assign({ apply, toggle, on, applyAuto, clearAuto, autoToggle, atOn, muteAll, allMuted }, pure);
})(typeof window !== "undefined" ? window : globalThis);
