/* pcaifill.js — GENERATE / EDIT IN THE IMAGE EDITOR THE KRITA AI WAY (2.834.0), window.PCAiFill (E.aiFill once installed).
 *
 * Tim (verbatim): "when in image-edit mode and a selection has been made and prompt docker is in generate mode then
 * generate the image inside of the selection, if no selection is made generate the image to the full canvas size, in
 * edit mode use inpaint or out paint or fill like krita ai does".
 *
 *   ✨ GENERATE (the prompt docker's ▾ on Generate, the image editor on screen with a picture open)
 *     a selection     -> rendered INTO the selection with the prompt docker's style (runAI: Krita's fill kinds - a
 *                        selection across the whole width / height or over empty canvas = expand, else add / fill),
 *                        a new layer. Before 2.834.0 this only happened while the ✨ AI panel was showing.
 *     no selection    -> the prompt docker's own Generate at the CANVAS's shape (window.H3ImageSize - index.html asks it
 *                        before /api/genimage; ~the editor's megapixels, 16-px steps) and the picture comes in as a new
 *                        layer covering the whole canvas (takeGenerated - mount.js H3OnGenerated asks it first).
 *   ✏ EDIT - a second dropdown beside the ▾ (#pmEdFill, Krita's fill modes):
 *     Auto            a selection across the whole width / height or over empty canvas = Outpaint, another selection =
 *                     Inpaint; no selection: empty (transparent) canvas round the picture = Outpaint it, else the layer
 *                     is edited as before
 *     Inpaint         the edit model follows the instruction inside the selection - what is there is kept and changed
 *     Fill            the selection is replaced from the prompt (Krita's Fill: painted green, the edit model fills the
 *                     green so it belongs in the picture)
 *     Outpaint        the picture continued into the selection / the empty canvas (Krita's Expand: the border carried
 *                     out, painted green, filled) - make room first with Image ▸ Canvas Size
 *   All of them go through the edit model the prompt docker has (it sees the picture round the selection) and come in as
 *   a new layer (⏳ Pending first when it is on).
 * Pure (Node: scripts/test-834.js): EDIT_MODES, geometry, editPlan, holeMask, canvasSize, sizeKey.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const EDIT_MODES = [
    { id: "auto", label: "Auto", tip: "Krita's way: a selection across the whole picture or over empty canvas = Outpaint, another selection = Inpaint; no selection = outpaint the empty canvas, else edit the layer" },
    { id: "inpaint", label: "Inpaint", tip: "Change what is in the selection the way the instruction says - what is there is kept and changed" },
    { id: "fill", label: "Fill", tip: "Replace the selection from the prompt so it belongs in the picture - select the area first" },
    { id: "outpaint", label: "Outpaint", tip: "Continue the picture into the selection or the empty canvas round it (make room with Image ▸ Canvas Size)" },
  ];
  const modeOf = (id) => (EDIT_MODES.some((m) => m.id === id) ? id : "auto");
  /** the selection's box + what lies under it: sel (0..255, w*h) or null; alpha (0..255, w*h) of the picture as seen or null */
  function geometry(sel, alpha, w, h) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1, holeInSel = false, holes = false, solid = false;
    for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
      const a = alpha ? alpha[i] : 255;
      if (a < 250) holes = true; else solid = true;
      if (sel && sel[i]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (a < 250) holeInSel = true; }
    }
    const box = x1 >= 0 ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } : null;
    return { hasSel: !!box, box, spans: !!box && (box.w >= w || box.h >= h), holeInSel, holes: holes && solid, empty: !solid };
  }
  /** what an Edit does: mode (auto | inpaint | fill | outpaint) + geometry -> {how: inpaint | fill | outpaint | outpaintEmpty | layer | say, msg?} */
  function editPlan(mode, g) {
    const m = modeOf(mode), s = g || {};
    if (s.empty) return { how: "say", msg: "the picture is empty - ✨ Generate makes one first" };
    if (m === "auto") return s.hasSel ? { how: s.spans || s.holeInSel ? "outpaint" : "inpaint" } : { how: s.holes ? "outpaintEmpty" : "layer" };
    if (m === "inpaint") return { how: s.hasSel ? "inpaint" : "layer" };
    if (m === "fill") return s.hasSel ? { how: "fill" } : { how: "say", msg: "Fill: select the area to fill first (or Select All)" };
    if (s.hasSel) return { how: "outpaint" };
    return s.holes ? { how: "outpaintEmpty" } : { how: "say", msg: "Outpaint: make room first (Image ▸ Canvas Size) or select where the picture should go on" };
  }
  /** the empty (transparent) part of the picture, grown `grow` px into the picture so the new part blends -> 0 / 255 mask */
  function holeMask(alpha, w, h, grow) {
    const r = Math.max(0, Math.round(grow || 0)), m = new Uint8Array(w * h), BIG = 1e9;
    for (let i = 0; i < m.length; i++) if (alpha[i] < 250) m[i] = 255;
    if (!r) return m;
    const pass = (len, n, at) => {                       // a 1-D dilation by r of each line (distance to the nearest hole)
      const near = new Int32Array(n);
      for (let l = 0; l < len; l++) {
        let last = -BIG;
        for (let k = 0; k < n; k++) { if (m[at(l, k)]) last = k; near[k] = k - last; }
        last = BIG;
        for (let k = n - 1; k >= 0; k--) { if (m[at(l, k)]) last = k; if (Math.min(near[k], last - k) <= r) near[k] = -1; }
        for (let k = 0; k < n; k++) if (near[k] === -1) m[at(l, k)] = 255;
      }
    };
    pass(h, w, (y, x) => y * w + x);
    pass(w, h, (x, y) => y * w + x);
    return m;
  }
  /** the render size for a picture of the canvas's shape: about `mp` megapixels, 16-px steps (256 .. 2048 a side) */
  function canvasSize(w, h, mp) {
    const a = (w || 1) / (h || 1), area = Math.max(0.25, Math.min(4, +mp || 1)) * 1048576, r16 = (v) => Math.max(256, Math.min(2048, Math.round(v / 16) * 16));
    return { width: r16(Math.sqrt(area * a)), height: r16(Math.sqrt(area / a)) };
  }
  const sizeKey = (w, h) => `${Math.round(w)}x${Math.round(h)}`;
  const pure = { EDIT_MODES, modeOf, geometry, editPlan, holeMask, canvasSize, sizeKey };

  /* ================================ the page ================================ */
  function install(E) {
    const { S, doc, store, say } = E;
    const $ = (id) => doc.getElementById(id);
    const editorOn = () => (typeof root.ieOnScreen === "function" ? !!root.ieOnScreen() : true);
    const genMode = () => { const g = $("genModeSel"); return g ? g.value : "image"; };
    const op = () => (E.imgOp ? E.imgOp.get() : "generate");
    const hasSel = () => !!(E.hasSel && E.hasSel());
    let edMode = modeOf(store.get("imgop.edfill", "auto"));

    /* ---- the Edit fill-mode dropdown beside the prompt docker's ▾ */
    function ui() {
      const opSel = $("pmOpSel"); if (!opSel || $("pmEdFill")) return;
      const s = doc.createElement("select"); s.id = "pmEdFill"; s.setAttribute("aria-label", "How Edit works on the selection");
      s.title = "How ✏ Edit works with a selection (Krita AI's fill modes)";
      s.style.cssText = "max-width:120px";
      s.innerHTML = EDIT_MODES.map((m) => `<option value="${m.id}" title="${m.tip.replace(/"/g, "&quot;")}">${m.label}</option>`).join("");
      s.value = edMode;
      s.addEventListener("change", () => { edMode = modeOf(s.value); store.set("imgop.edfill", edMode); });
      opSel.insertAdjacentElement("afterend", s);
      paint();
    }
    function paint() { const s = $("pmEdFill"); if (s) { s.hidden = !(op() === "edit" && editorOn() && genMode() === "image"); s.value = edMode; } }
    ui(); root.setInterval(() => { ui(); paint(); }, 500);

    /* ---- what the picture looks like */
    function alphaNow() {
      let c; try { c = E.flatten(); } catch (e) { return null; }
      if (!c) return null;
      let d; try { d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; } catch (e) { return null; }
      const a = new Uint8Array(c.width * c.height); for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
      return a;
    }
    const geo = () => geometry(hasSel() ? S.sel : null, alphaNow(), S.w, S.h);

    /** ✏ Edit from the prompt docker: true = done here; false = the old way (pcpromptlink: the layer / the selection edit) */
    function edit(prompt, editStyle, label) {
      if (!S.w) return false;
      if (E.flattenCache) E.flattenCache();
      const g = geo(), p = editPlan(edMode, g);
      if (p.how === "say") { say(p.msg); return true; }
      if (p.how === "layer" || p.how === "inpaint") return false;
      if (!editStyle) { say("✏ Edit needs an edit model in the prompt docker's image style (Qwen Image Edit, FLUX.2 Klein …)"); return true; }
      const common = { mode: "generate", prompt, style: editStyle, editStyle, forceEdit: true, into: false, whole: false, direct: true, keep: E.layer() };
      if (p.how === "fill") { E.runAI(Object.assign(common, { fillKind: "fill", label: label || "🪣 fill" })); return true; }
      if (p.how === "outpaint") { E.runAI(Object.assign(common, { fillKind: "expand", label: label || "↔ outpaint" })); return true; }
      // the empty canvas round the picture (no selection): it is the selection, grown into the picture to blend
      const a = alphaNow(); if (!a) return false;
      const grow = Math.max(8, Math.round(Math.min(S.w, S.h) / 64));
      E.runAI(Object.assign(common, { sel: holeMask(a, S.w, S.h, grow), fillKind: "expand", label: label || "↔ outpaint" }));
      return true;
    }

    /* ---- ✨ Generate with no selection: the canvas's shape, the picture over the whole canvas */
    const want = new Map();                                      // "WxH" -> when it was asked for
    root.H3ImageSize = () => {
      if (!editorOn() || !S.w || genMode() !== "image" || hasSel()) return null;
      if (op() !== "generate" || (E.imgOp && E.imgOp.blender && E.imgOp.blender())) return null;
      const wh = canvasSize(S.w, S.h, S.res || 1);
      want.set(sizeKey(wh.width, wh.height), Date.now());
      return wh;
    };
    /** a generated picture made at the canvas's shape -> a new layer covering the canvas (true = taken) */
    function takeGenerated(img, label) {
      if (!S.w || !img) return false;
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, now = Date.now();
      // the size asked for, or (a style that rounds sizes its own way) the canvas's shape within 2 % after such an ask
      const exact = want.get(sizeKey(iw, ih)), recent = [...want.values()].some((t) => now - t < 2 * 3600 * 1000);
      if (!((exact && now - exact < 6 * 3600 * 1000) || (recent && Math.abs(iw / ih - S.w / S.h) <= 0.02 * (S.w / S.h)))) return false;
      const L = E.makeLayer(label || "✨ generated"); L.canvas.getContext("2d").imageSmoothingQuality = "high";
      L.canvas.getContext("2d").drawImage(img, 0, 0, S.w, S.h);
      E.addLayer(L, "generated", false); E.refresh(); E.renderLayersPanel();
      return true;
    }
    E.aiFill = { edit, takeGenerated, mode: () => edMode, setMode: (m) => { edMode = modeOf(m); store.set("imgop.edfill", edMode); paint(); }, geo, paint };
  }

  const PCAiFill = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = PCAiFill;
  else root.PCAiFill = PCAiFill;
})(typeof window !== "undefined" ? window : globalThis);
