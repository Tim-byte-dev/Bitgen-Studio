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
 * Pure (Node: scripts/test-imgop541.js): OPS, opOf, modeFor, opForMode, labelFor, shown.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const OPS = [
    { id: "generate", icon: "✨", label: "Generate", mode: "generate", tip: "A new picture from the prompt (with the ✨ AI panel showing: into the selection, else the whole picture)" },
    { id: "edit", icon: "✏", label: "Edit", mode: "edit", tip: "Follow an instruction with the edit model - \"make her jacket red\" (the selection, else the whole picture; in Blender mode the Blender scene)" },
    { id: "refine", icon: "🔁", label: "Refine", mode: "refine", tip: "Redraw the selection (else the whole picture) at the strength on the slider - keeps the shapes, changes the detail" },
    { id: "fill", icon: "🪣", label: "Fill", mode: "generate", needSel: true, tip: "Fill the selection from the prompt (100 %) - select the area first" },
    { id: "background", icon: "🖼", label: "Replace background", mode: "background", needSel: true, tip: "Keep what is selected, make everything else new from the prompt" },
    { id: "remove", icon: "🧽", label: "Remove", mode: "remove", needSel: true, tip: "Take out what is selected and continue the surroundings (the prompt is optional)" },
  ];
  const opOf = (id) => OPS.find((o) => o.id === id) || OPS[0];
  /** the ✨ AI panel's mode for an op */
  const modeFor = (id) => opOf(id).mode;
  /** the op for a panel mode the user clicked (Generate keeps Fill when Fill was picked; Compose = no change -> null) */
  function opForMode(mode, cur) {
    if (mode === "generate") return cur === "fill" ? "fill" : "generate";
    if (mode === "compose" || !OPS.some((o) => o.id === mode)) return null;
    return mode;
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
        + "#pmBlendChip{font-size:.66rem;color:#f5792c;border:1px solid #f5792c;border-radius:8px;padding:0 6px;white-space:nowrap}";
      doc.head.appendChild(st);
    }
    const box = doc.createElement("span"); box.id = "pmImgOp";
    box.innerHTML = `<select id="pmOpSel" title="What the Generate button does with the picture in the image editor (Krita AI's way)" aria-label="Image operation">`
      + OPS.map((o) => `<option value="${o.id}" title="${o.tip.replace(/"/g, "&quot;")}">${o.icon} ${o.label}</option>`).join("") + `</select>`
      + `<span id="pmRefWrap" title="How much Refine changes (5 % = a touch, 95 % = nearly new)"><span>strength</span><input type="range" id="pmRefine" min="5" max="95" step="5"><span id="pmRefineV"></span></span>`
      + `<span id="pmBlendChip" title="Blender mode: the selected layer is a Blender / Daz 3D layer - Edit and Refine render its scene with Blender first and work from that picture">🟧 Blender</span>`;
    bar.insertBefore(box, bar.firstChild);
    let op = opOf(store.get("imgop", "generate")).id, quiet = false;
    const genMode = () => { const g = $("genModeSel"); return g ? g.value : "image"; };
    const blender = () => !!(S.w && E.layer3d && E.layer3d.isCurrent && E.layer3d.isCurrent());
    const strength = () => S.strength || 50;
    function paint() {
      box.hidden = !shown(genMode());
      $("pmOpSel").value = op;
      $("pmRefWrap").hidden = op !== "refine";
      $("pmRefine").value = strength(); $("pmRefineV").textContent = strength() + "%";
      $("pmBlendChip").hidden = !(blender() && (op === "edit" || op === "refine"));
      if (typeof root.paintGoLabel === "function") { try { root.paintGoLabel(); } catch (e) { /* the page's */ } }
    }
    /** pick an op: the ✨ AI panel follows (its tab), the button's words follow */
    function set(id, fromPanel) {
      op = opOf(id).id; store.set("imgop", op);
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
      if ($("pmBlendChip").hidden !== chipOff || box.hidden !== !shown(genMode())) paint();
    }, 500);
    if (op !== "generate" && E.setAiMode && S.aiMode !== modeFor(op)) { quiet = true; try { E.setAiMode(modeFor(op)); } finally { quiet = false; } }
    paint();
    E.imgOp = { get: () => op, set, fromMode, strength, blender, paint, label: () => labelFor(op, strength(), blender()), opOf };
    root.H3ImgOp = E.imgOp;
  }

  const PCImgOp = { OPS, opOf, modeFor, opForMode, labelFor, shown, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCImgOp;
  else root.PCImgOp = PCImgOp;
})(typeof window !== "undefined" ? window : globalThis);
