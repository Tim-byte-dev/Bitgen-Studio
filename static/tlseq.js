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
 * Pure (Node: scripts/test-tlseq571.js): eligible, rowsOf, arrange.
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
  const pure = { eligible, rowsOf, arrange };
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
  /* eslint-enable no-undef */
  function paintBtn() {
    const b = $("tlSeqBtn"); if (!b) return;
    b.classList.toggle("on", on()); b.setAttribute("aria-pressed", on() ? "true" : "false");
  }
  function bar() {
    if ($("tlSeqBtn")) return true;
    const rip = $("tlRipple"), anchor = rip ? rip.closest("label") || rip : null;
    if (!anchor || !anchor.parentNode) return false;
    const b = doc.createElement("button"); b.id = "tlSeqBtn"; b.type = "button"; b.className = "ghost"; b.textContent = "⛓ Sequential";
    b.title = "Auto arrange: the clips play one after the other with no gap, down the layers from the top (V1, the picture layers, the video layers) - and stay that way when you delete a clip, add or move a layer (click again: off)";
    b.onclick = () => toggle();
    anchor.parentNode.insertBefore(b, anchor.nextSibling);
    const css = doc.createElement("style"); css.id = "tlSeqCss";
    css.textContent = "#tlSeqBtn.on{border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c);background:rgba(245,158,44,.12)}";
    doc.head.appendChild(css);
    paintBtn();
    return true;
  }
  /** every save keeps it arranged while ⛓ is on */
  function wrapSave() {
    if (typeof root.tlSave !== "function" || root.tlSave.__seq) return false;
    const orig = root.tlSave;
    const w = function () { try { if (on()) apply(); } catch (e) { /* never stops a save */ } return orig.apply(this, arguments); };
    w.__seq = true;
    root.tlSave = w;
    return true;
  }
  function boot() { const a = bar(), b = wrapSave(); paintBtn(); if (!(a && b)) root.setTimeout(boot, 500); }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.setInterval(paintBtn, 1500);                       // a timeline loaded with tl.seqAuto shows it
  root.H3TlSeq = Object.assign({ apply, toggle, on }, pure);
})(typeof window !== "undefined" ? window : globalThis);
