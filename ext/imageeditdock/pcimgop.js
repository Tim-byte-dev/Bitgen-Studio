/* pcimgop.js — THE PROMPT DOCKER'S ▾ GENERATE / EDIT / REFINE / FILL / REPLACE BACKGROUND / REMOVE (2.541.0),
 * window.PCImgOp (and window.H3ImgOp once installed).
 *
 * Tim (verbatim): "add a dropdown to the prompt top menubar- Generate,edit,refine,fill,replace background,remove. when in
 * refine mode add a slider on the top menubar for percentage of refine , change the generate button text to match the
 * dropdown.these settings should work like the krita ai plugin. only show the dropdown when in image mode."
 *
 *   The prompt docker's menu bar (#pmBar), only while its Generate mode is 🖼 Image:
 *     ▾ what Generate does   ✨ Generate            a new picture from the prompt (the usual way - with the editor open it
 *                                                   lands on the canvas as a layer; with the ✨ AI panel showing it renders
 *                                                   into the selection, else the whole picture, as before)
 *                            ✏ Edit                 the edit model follows the instruction (the selection, else the whole
 *                                                   picture) - in 🟧 Blender mode the Blender scene is rendered first and
 *                                                   edited (pc3d.js)
 *                            🔁 Refine              the selection (else the whole picture) redrawn at the strength below
 *                            🪣 Fill                 the selection filled from the prompt (100 %) - a selection is needed
 *                            🖼 Replace background   the selection is KEPT, everything else is made new
 *                            🧽 Remove               what is selected is taken out, the surroundings continue
 *     Refine only: a slider 5 - 95 % (= the ✨ AI panel's strength, the two follow each other)
 *     🟧 Blender            a chip while the selected layer is a Blender / Daz 3D layer (Blender mode): Edit and Refine
 *                            work from the scene rendered by Blender, not from the canvas
 *   The Generate button reads the choice ("🔁 Refine 40%"), the ✨ AI panel's tabs follow it and it follows them. The
 *   results come into the ✨ AI panel (click one to compare, its ✔ or ✔ Apply keeps it as a layer) - Krita AI's way.
 *   pcpromptlink.js does the running (H3TakeGenerate); this file is the dropdown, its state and the label.
 *
 * 2.543.0 (Tim: "if the image editor docker is minimized or closed, use the reference images for the edit,replace
 * background functions, delete fill and remove from the prompt docker dropdown, if image editor docker is open use image
 * editor layer as reference image if user selects multiple layers use those layers as reference images for the operations
 * add the fill and remove functions back to the list. remove the tabs for generate,refine,edit,background and compose from
 * image editor docker. Add compose to the prompt docker dropdown"): + 🧩 Compose; Fill and Remove are listed only while
 * the editor is on screen (the op picked comes back when it opens again); a chip says what the button will use - 🖼 N
 * reference(s) (the editor closed), ▦ <layer> / ▦ N layers (open), 🟧 Blender (a Blender / 3D layer).
 * Pure (Node: scripts/test-imgop541.js, test-imgop543.js): OPS, opOf, modeFor, opForMode, labelFor, shown, available,
 * sourceText.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const OPS = [
    { id: "generate", icon: "✨", label: "Generate", mode: "generate", tip: "A new picture from the prompt (with the ✨ AI panel showing: into the selection, else the whole picture)" },
    { id: "edit", icon: "✏", label: "Edit", mode: "edit", tip: "Follow an instruction with the edit model - \"make her jacket red\" (the selection, else the whole picture; in Blender mode the Blender scene)" },
    { id: "refine", icon: "🔁", label: "Refine", mode: "refine", tip: "Redraw the selection (else the whole picture) at the strength on the slider - keeps the shapes, changes the detail" },
    { id: "fill", icon: "🪣", label: "Fill", mode: "generate", needSel: true, needEditor: true, tip: "Fill the selection from the prompt (100 %) - select the area first" },
    { id: "background", icon: "🖼", label: "Replace background", mode: "background", needSel: true, tip: "Keep what is selected, make everything else new from the prompt" },
    { id: "remove", icon: "🧽", label: "Remove", mode: "remove", needSel: true, needEditor: true, tip: "Take out what is selected and continue the surroundings (the prompt is optional)" },
    { id: "compose", icon: "🧩", label: "Compose", mode: "compose", tip: "Make one picture from several: the layers picked in the image editor (Ctrl-click), or the References docker's pictures when the editor is closed - \"put the dog from picture 2 on the sofa in picture 1\"" },
  ];
  /** 2.543.0: Fill and Remove work on a selection in the image editor - only while it is on screen */
  const available = (id, editorOn) => !!editorOn || !opOf(id).needEditor;
  const opOf = (id) => OPS.find((o) => o.id === id) || OPS[0];
  /** the ✨ AI panel's mode for an op */
  const modeFor = (id) => opOf(id).mode;
  /** the op for a panel mode the user clicked (Generate keeps Fill when Fill was picked; Compose = no change -> null) */
  function opForMode(mode, cur) {
    if (mode === "generate") return cur === "fill" ? "fill" : "generate";
    if (!OPS.some((o) => o.id === mode)) return null;
    return mode;                                                   // 2.543.0: Compose is one of them now
  }
  /** 2.543.0: what the button works from - s = {op, editorOn, open, blender, refs, picks, layer, hasSel} -> the chip's words ("" = none) */
  function sourceText(s) {
    const o = s && s.op;
    if (!o || o === "generate") return "";
    if (s.blender && (o === "edit" || o === "refine")) return "";                    // the 🟧 Blender chip says it
    if (!s.editorOn) return s.refs ? `🖼 ${s.refs} reference${s.refs === 1 ? "" : "s"}` : "🖼 no references";
    if (!s.open) return "";
    if (o === "fill" || o === "remove") return s.hasSel ? "▭ the selection" : "";
    if ((o === "refine" || o === "background") && s.hasSel) return "▭ the selection";
    if (s.picks > 1) return `▦ ${Math.min(s.picks, 3)} layers`;
    return s.layer ? `▦ ${s.layer}` : "";
  }
  /** the Generate button's words: "🔁 Refine 40%", "✏ Edit · 🟧 Blender" */
  function labelFor(id, strength, blender) {
    const o = opOf(id);
    if (o.id === "refine") return `${o.icon} ${o.label} ${Math.round(+strength || 50)}%` + (blender ? " · 🟧" : "");
    if (o.id === "edit" && blender) return `${o.icon} ${o.label} · 🟧 Blender`;
    return `${o.icon} ${o.label}`;
  }
  /** the dropdown is there only while the prompt docker makes pictures */
  const shown = (genMode) => genMode === "image";

  /* ================================ the page ================================ */
  function install(E) {
    const { S, doc, store } = E;
    const $ = (id) => doc.getElementById(id);
    const bar = $("pmBar");
    if (!bar || $("pmImgOp")) return;
    if (!$("pmImgOpCss")) {
      const st = doc.createElement("style"); st.id = "pmImgOpCss";
      st.textContent = "#pmImgOp{display:inline-flex;align-items:center;gap:6px}#pmImgOp[hidden]{display:none}"
        + "#pmOpSel{max-width:190px;border-color:var(--tiger,#f59e2c)}#pmRefWrap{display:inline-flex;align-items:center;gap:4px;font-size:.75rem}"
        + "#pmRefWrap[hidden],#pmBlendChip[hidden]{display:none}#pmRefine{width:110px}#pmRefineV{min-width:2.6em;color:var(--tiger,#f59e2c)}"
        + "#pmBlendChip{font-size:.66rem;color:#f5792c;border:1px solid #f5792c;border-radius:8px;padding:0 6px;white-space:nowrap}"
        + "#pmSrcChip{font-size:.66rem;color:var(--dim,#aaa);border:1px solid var(--line,#444);border-radius:8px;padding:0 6px;white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis}#pmSrcChip[hidden]{display:none}";
      doc.head.appendChild(st);
    }
    const box = doc.createElement("span"); box.id = "pmImgOp";
    box.innerHTML = `<select id="pmOpSel" title="What the Generate button does with the picture in the image editor (Krita AI's way)" aria-label="Image operation">`
      + OPS.map((o) => `<option value="${o.id}" title="${o.tip.replace(/"/g, "&quot;")}">${o.icon} ${o.label}</option>`).join("") + `</select>`
      + `<span id="pmRefWrap" title="How much Refine changes (5 % = a touch, 95 % = nearly new)"><span>strength</span><input type="range" id="pmRefine" min="5" max="95" step="5"><span id="pmRefineV"></span></span>`
      + `<span id="pmBlendChip" title="Blender mode: the selected layer is a Blender / Daz 3D layer - Edit and Refine render its scene with Blender first and work from that picture">🟧 Blender</span>`
      + `<span id="pmSrcChip" title="What the button works from: the References docker's pictures (the image editor closed), the selected layer / the layers picked with Ctrl-click (open), or the selection"></span>`;
    bar.insertBefore(box, bar.firstChild);
    let op = opOf(store.get("imgop", "generate")).id, quiet = false;
    const genMode = () => { const g = $("genModeSel"); return g ? g.value : "image"; };
    const blender = () => !!(S.w && ((E.layer3d && E.layer3d.isCurrent && E.layer3d.isCurrent()) || (E.blendLayer && E.blendLayer.isCurrent())));   // 2.542.0: + a Blender layer
    const strength = () => S.strength || 50;
    const editorOn = () => (typeof root.ieOnScreen === "function" ? !!root.ieOnScreen() : true);     // 2.543.0
    const srcState = () => {
      let refs = 0; try { refs = root.H3Refs ? root.H3Refs.images().length : 0; } catch (e) { refs = 0; }
      const pk = E.picked ? E.picked().filter((L) => L && !L.control) : [], L = pk.length === 1 ? pk[0] : S.w ? E.layer() : null;
      return { op, editorOn: editorOn(), open: !!S.w, blender: blender(), refs, picks: pk.length, layer: L ? L.name : "", hasSel: !!(E.hasSel && E.hasSel()) };
    };
    let lastSrc = "";
    function paint() {
      box.hidden = !shown(genMode());
      const on = editorOn();
      // 2.543.0: Fill / Remove only with the editor on screen - the op picked comes back when it opens again
      for (const o of $("pmOpSel").options) { const ok = available(o.value, on); o.hidden = !ok; o.disabled = !ok; }
      if (!available(op, on)) { store.set("imgop.was", op); op = "generate"; store.set("imgop", op); }
      else if (on && op === "generate" && store.get("imgop.was", null)) { const w = store.get("imgop.was", null); store.set("imgop.was", null); if (OPS.some((x) => x.id === w)) { op = w; store.set("imgop", op); if (E.setAiMode && S.aiMode !== modeFor(op)) { quiet = true; try { E.setAiMode(modeFor(op)); } finally { quiet = false; } } } }
      $("pmOpSel").value = op;
      const src = sourceText(srcState()); lastSrc = src;
      $("pmSrcChip").textContent = src; $("pmSrcChip").hidden = !src;
      $("pmRefWrap").hidden = op !== "refine";
      $("pmRefine").value = strength(); $("pmRefineV").textContent = strength() + "%";
      $("pmBlendChip").hidden = !(blender() && (op === "edit" || op === "refine"));
      if (typeof root.paintGoLabel === "function") { try { root.paintGoLabel(); } catch (e) { /* the page's */ } }
    }
    /** pick an op: the ✨ AI panel follows (its tab), the button's words follow */
    function set(id, fromPanel) {
      op = opOf(id).id; store.set("imgop", op); store.set("imgop.was", null);
      if (!fromPanel && E.setAiMode && S.aiMode !== modeFor(op)) { quiet = true; try { E.setAiMode(modeFor(op)); } finally { quiet = false; } }
      paint();
      if (root.H3TestEvent) { try { root.H3TestEvent("imgop", op); } catch (e) { /* the 🧪 list */ } }
      return op;
    }
    /** the ✨ AI panel's tab was clicked -> the dropdown follows (pcpromptlink.js calls this from E.onAiMode) */
    function fromMode(m) { if (quiet) return; const o = opForMode(m, op); if (o && o !== op) set(o, true); else paint(); }
    $("pmOpSel").addEventListener("change", (e) => set(e.target.value));
    $("pmRefine").addEventListener("input", (e) => { if (E.setStrength) E.setStrength(e.target.value); paint(); });
    const ks = $("kxStrength"); if (ks) ks.addEventListener("input", () => paint());          // the panel's slider -> ours
    const g = $("genModeSel"); if (g) g.addEventListener("change", paint);
    // the selected layer decides Blender mode (the chip + the label)
    const prevHist = E.ui && E.ui.history;
    if (E.ui) E.ui.history = function () { const r = prevHist ? prevHist.apply(this, arguments) : undefined; try { paint(); } catch (er) { /* fine */ } return r; };
    // the page sets the mode in code too (sel.value = …; sel.onchange() - no change event): a light look twice a second
    root.setInterval(() => {
      const chipOff = !(blender() && (op === "edit" || op === "refine"));
      if ($("pmBlendChip").hidden !== chipOff || box.hidden !== !shown(genMode()) || sourceText(srcState()) !== lastSrc || available(op, editorOn()) === false
          || [...$("pmOpSel").options].some((o) => o.hidden === available(o.value, editorOn()))) paint();
    }, 500);
    if (op !== "generate" && E.setAiMode && S.aiMode !== modeFor(op)) { quiet = true; try { E.setAiMode(modeFor(op)); } finally { quiet = false; } }
    paint();
    E.imgOp = { get: () => op, set, fromMode, strength, blender, paint, label: () => labelFor(op, strength(), blender()), opOf, editorOn, source: () => sourceText(srcState()) };
    root.H3ImgOp = E.imgOp;
  }

  const PCImgOp = { OPS, opOf, modeFor, opForMode, labelFor, shown, available, sourceText, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCImgOp;
  else root.PCImgOp = PCImgOp;
})(typeof window !== "undefined" ? window : globalThis);
