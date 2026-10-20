/* pcpromptlink.js — THE IMAGE EDITOR'S ✨ EDIT / GENERATE RUN FROM THE PROMPT DOCKER (2.444.0), window.PCPromptLink.
 *
 * Tim (verbatim): "when image edit docker is open and the edit tab is clicked, change the dropdown in the prompt docker
 * to qwen2.1 edit, change the generate button to edit, remove the edit button and model dropdown from the edit tab.
 * use the prompt docker for the edits.( when the generate tab is clicked use the selected layer and generate from the
 * prompt docker into the selection of the selected layer (blend with the current selected layer like how krita ai does
 * it)." - asked, the Generate tab's own button goes too ("Prompt docker only").
 *
 *   LINKED      the editor on screen, a picture open, the ✨ AI panel showing, its mode Edit or Generate, the prompt
 *               docker in 🖼 Image (the editor puts it there - 2.431.0): the prompt docker's button reads ✏ Edit /
 *               ✨ Generate and RUNS the editor's AI with the prompt docker's prompt (index.html runGenerate asks
 *               window.H3TakeGenerate first; goLabel asks window.H3GoLabel). The panel's own ✨ button, its prompt box
 *               and (Edit) its model row are hidden; a line says where to type.
 *   EDIT        the prompt docker's image style is set to "Qwen Image 2.1 edit" (the one it was is put back when the Edit
 *               tab is left, unless it was changed meanwhile) - that style is the edit model.
 *   GENERATE    into the SELECTION of the selected layer (no selection = the whole picture); the results come in as
 *               always (click one to compare) and ✔ Apply BLENDS the shown one into that layer - its feathered
 *               selection painted onto the layer's pixels, one undo step (a text / shape / group layer: a new layer).
 *   Not linked (another tab or mode, the editor closed) = the prompt docker as before (2.431.0: a picture onto the canvas
 *   as a new layer).
 *   2.451.0 (Tim, again: it did not happen for him) - the link needed the prompt docker ALREADY in 🖼 Image and a picture
 *   open. Now CLICKING the Edit / Generate tab puts the prompt docker into 🖼 Image itself (the mode it was in comes back
 *   when another tab is clicked, unless it was changed meanwhile), and no picture is needed for the switch.
 *
 * 2.541.0 (Tim: "add a dropdown to the prompt top menubar- Generate,edit,refine,fill,replace background,remove ... work
 * like the krita ai plugin" + "if image editor is in blender mode and the user clicks edit use the blender scene to render
 * the picture from the prompt"): the prompt docker's ▾ dropdown (pcimgop.js) says what its button does. ✨ Generate keeps
 * the rules above; Edit / Refine / Fill / Replace background / Remove always work on the editor's picture - the ✨ AI panel
 * need not be showing (it is shown for the results); the editor closed = it opens; no picture = it says so. A Blender /
 * Daz 3D layer selected (🟧 Blender mode): Edit and Refine render its scene with Blender first (pc3d.js editFromScene).
 * Pure (Node: scripts/test-promptlink.js, test-imgop541.js): LINKED_MODES, linkedNow, goLabelFor, pickEditStyle, actionFor.
 */
(function (root) {
  "use strict";
  const LINKED_MODES = ["edit", "generate"];
  /** linked now? s = {onScreen, open, aiShown, mode, genMode} - 2.451.0: a picture need not be open yet (the button
   *  still reads Edit / Generate; Edit with nothing open says so, Generate makes a new picture the usual way) */
  function linkedNow(s) {
    return !!(s && s.onScreen && s.aiShown && LINKED_MODES.includes(s.mode) && (s.genMode == null || s.genMode === "image"));
  }
  /** the prompt docker's button while linked (null = its own label) */
  const goLabelFor = (s) => (linkedNow(s) ? (s.mode === "edit" ? "✏ Edit" : "✨ Generate") : null);
  /** 2.541.0: what the prompt docker's button does now. s = {onScreen, open, aiShown, mode, genMode, op, blender, hasSel}
   *  -> null (the prompt docker's own Generate) | {kind: "run", op, mode, whole, into} | {kind: "blender", op, mode} |
   *  {kind: "open", op} (the editor is closed) | {kind: "say", op, msg} */
  function actionFor(s) {
    if (!s || s.genMode !== "image") return null;
    const op = s.op || (s.aiShown && LINKED_MODES.includes(s.mode) ? s.mode : "generate");
    if (op === "generate") return linkedNow(s) && s.mode === "generate" ? { kind: "run", op, mode: "generate", whole: true, into: true } : null;
    if (!["edit", "refine", "fill", "background", "remove", "compose"].includes(op)) return null;
    // 2.543.0: the editor minimized / closed -> the References docker's pictures (Fill / Remove need the editor)
    if (!s.onScreen) {
      if (op === "fill" || op === "remove") return { kind: "say", op, msg: "Fill and Remove work on a selection in the image editor - open it (▦ Image editor)" };
      if (!s.refs) return { kind: "say", op, msg: "put a picture in the References docker first (or open the image editor and a picture)" };
      return { kind: "refs", op, mode: op === "refine" ? "refine" : op === "compose" || s.refs > 1 ? "compose" : "edit", bg: op === "background" };
    }
    if (!s.open) return { kind: "say", op, msg: op === "edit" ? "open a picture to edit first (File ▸ Open, or drop one on the editor)" : `open a picture first - ${op} works on the picture in the image editor` };
    if (s.blender && (op === "edit" || op === "refine")) return { kind: "blender", op, mode: op };
    if (op === "compose") return { kind: "compose", op, mode: "compose" };
    if (op === "fill" || op === "remove") return s.hasSel ? { kind: "run", op, mode: op === "fill" ? "generate" : "remove", whole: false, into: op === "fill" } : { kind: "say", op, msg: op === "fill" ? "select the area to fill first (or Select All)" : "select what to remove first" };
    // 2.543.0: Edit / Refine / Replace background work from the selected LAYER (several picked = all of them); a
    // selection keeps Refine / Replace background on the picture's selection as before
    if (op === "refine") return s.hasSel ? { kind: "run", op, mode: "refine", whole: true, into: false } : { kind: "layer", op, mode: "refine" };
    if (op === "background") return s.hasSel ? { kind: "run", op, mode: "background", whole: false, into: false } : s.picks > 1 ? { kind: "compose", op, mode: "compose", bg: true } : { kind: "layer", op, mode: "edit", bg: true };
    return s.picks > 1 ? { kind: "compose", op, mode: "compose" } : { kind: "layer", op, mode: "edit" };
  }
  /** 2.543.0: Replace background as an instruction for the edit model (no selection to keep) */
  function bgPrompt(t) {
    const x = String(t || "").trim().replace(/[.\s]+$/, "");
    return x ? `Replace the background with ${x}. Keep the main subject exactly as it is - its shape, pose, colours and lighting.` : "";
  }
  /** the "Qwen Image 2.1 edit" option among [{value, text}] (any Qwen edit, then any edit, by name) - its value or "" */
  function pickEditStyle(opts) {
    const list = Array.isArray(opts) ? opts : [];
    const by = (re) => (list.find((o) => re.test(String(o.text || ""))) || {}).value;
    return by(/qwen[\s-]*image[\s-]*2\.1[\s-]*edit/i) || by(/qwen.*2\.1.*edit/i) || by(/qwen.*edit/i) || by(/\bedit\b/i) || "";
  }

  function install(E) {
    const { S, doc, say, store } = E;
    const $ = (id) => doc.getElementById(id);
    if (!$("kxAi") || !$("kxModes")) return;
    if (!$("pcPlinkCss")) {
      const st = doc.createElement("style"); st.id = "pcPlinkCss";
      st.textContent = "#kxAi.pd-linked #kxRun,#kxAi.pd-linked #iePrompt,#kxAi.pd-linked.pd-edit #kxRowEdit{display:none!important}"
        + "#kxAi #kxModes{display:none!important}"                         // 2.543.0: the prompt docker's ▾ chooses (Tim: "remove the tabs")
        + "#kxAi .kxpdnote{display:none;color:var(--pc-dim);font-size:11px;padding:4px 6px;border:1px dashed var(--pc-line);border-radius:5px;margin:4px 0}"
        + "#kxAi.pd-linked .kxpdnote{display:block}#kxAi .kxpdnote b{color:var(--pc-accent)}";
      doc.head.appendChild(st);
    }
    const note = doc.createElement("div"); note.className = "kxpdnote"; note.id = "kxPdNote";
    $("kxModes").after(note);
    const styleSel = () => doc.getElementById("styleSel");
    const genMode = () => { const g = doc.getElementById("genModeSel"); return g ? g.value : "image"; };
    const onScreen = () => (typeof root.ieOnScreen === "function" ? root.ieOnScreen() : true);
    const state = () => ({ onScreen: onScreen(), open: !!S.w, aiShown: !!($("kxAi") && $("kxAi").classList.contains("on")), mode: S.aiMode, genMode: genMode(),
                           op: E.imgOp ? E.imgOp.get() : null, blender: !!(E.imgOp && E.imgOp.blender()), hasSel: !!(E.hasSel && E.hasSel()),   // 2.541.0
                           picks: picksNow().length, refs: refsNow().length });                                                                       // 2.543.0
    const picksNow = () => (E.picked ? E.picked().filter((L) => L && !L.control) : []);
    const refsNow = () => { try { return root.H3Refs ? root.H3Refs.images() : []; } catch (e) { return []; } };
    // 2.541.0: linked = the panel's own ✨ button / prompt box give way to the prompt docker's (any op but a plain Generate)
    const linked = () => { const s = state(); return linkedNow(s) || (s.onScreen && s.genMode === "image" && !!s.op && s.op !== "generate"); };

    /* ---- the prompt docker's style: Qwen Image 2.1 edit while on the Edit tab */
    function toEditStyle() {
      const sel = styleSel(); if (!sel) return;
      const want = pickEditStyle([...sel.options].map((o) => ({ value: o.value, text: o.textContent })));
      if (!want || sel.value === want) return;
      store.set("pl.styleWas", sel.value); store.set("pl.styleSet", want);
      sel.value = want; if (typeof sel.onchange === "function") sel.onchange();
    }
    function fromEditStyle() {
      const sel = styleSel(), was = store.get("pl.styleWas", null), set = store.get("pl.styleSet", null);
      store.set("pl.styleWas", null); store.set("pl.styleSet", null);
      if (!sel || was == null || sel.value !== set) return;          // changed meanwhile: left as the user put it
      if ([...sel.options].some((o) => o.value === was)) { sel.value = was; if (typeof sel.onchange === "function") sel.onchange(); }
    }
    function paint() {
      const box = $("kxAi"), on = linked();
      box.classList.toggle("pd-linked", on);
      box.classList.toggle("pd-edit", on && S.aiMode === "edit");
      const op = E.imgOp ? E.imgOp.get() : null;
      note.innerHTML = S.aiMode === "edit"
        ? "✏ Type the instruction in the <b>prompt docker</b> and press its <b>Edit</b> - \"make her jacket red\", \"turn it into a watercolor\" (the selection, else the whole picture; the model: its image style, Qwen Image 2.1 edit)."
        : op && op !== "generate" && E.imgOp ? `${E.imgOp.label().replace(/&/g, "&amp;").replace(/</g, "&lt;")}: type in the <b>prompt docker</b> and press its button - the results come in below, ✔ keeps one as a layer.`   // 2.541.0
        : "✨ Type in the <b>prompt docker</b> and press its <b>Generate</b> - it renders into the selection of the selected layer (else the whole picture) and ✔ Apply blends it into that layer.";
      if (typeof root.paintGoLabel === "function") { try { root.paintGoLabel(); } catch (e) { /* the page's */ } }
    }
    /* 2.451.0: a click on the Edit / Generate tab puts the prompt docker into 🖼 Image (the old mode back on another tab) */
    function toImageMode() {
      const g = doc.getElementById("genModeSel"); if (!g || g.value === "image") return;
      store.set("pl.gmWas", g.value); g.value = "image";
      if (typeof g.onchange === "function") { try { g.onchange(); } catch (e) { /* the page's */ } } else g.dispatchEvent(new root.Event("change"));
      store.set("pl.gmSet", "image");
    }
    function fromImageMode() {
      const g = doc.getElementById("genModeSel"), was = store.get("pl.gmWas", null);
      store.set("pl.gmWas", null); store.set("pl.gmSet", null);
      if (!g || !was || g.value !== "image") return;
      g.value = was; if (typeof g.onchange === "function") { try { g.onchange(); } catch (e) { /* the page's */ } } else g.dispatchEvent(new root.Event("change"));
    }
    $("kxModes").addEventListener("click", (ev) => {
      const b = ev.target && ev.target.closest ? ev.target.closest("[data-mode]") : null; if (!b || !onScreen()) return;
      if (LINKED_MODES.includes(b.dataset.mode)) toImageMode(); else fromImageMode();
    }, true);
    let lastMode = null, inTake = false;
    E.onAiMode = (m) => {
      if (m === "edit" && onScreen()) toEditStyle();
      else if (lastMode === "edit") fromEditStyle();
      lastMode = m;
      if (E.imgOp && !inTake) E.imgOp.fromMode(m);                          // 2.541.0: the prompt docker's ▾ follows the tab (not the mode a run picks)
      paint();
    };
    /* ---- the page asks these (index.html goLabel / runGenerate) */
    root.H3GoLabel = () => {
      const s = state();
      if (E.imgOp && s.genMode === "image" && s.op && s.op !== "generate") return E.imgOp.label();   // 2.541.0
      return goLabelFor(s);
    };
    /** 2.541.0: open the editor docker (shown, not collapsed) */
    function openDock() {
      const d = doc.getElementById("imageeditdock"); if (!d) return false;
      if (d.classList.contains("dockgone") && typeof root.toggleDockGone === "function") root.toggleDockGone("imageeditdock", "tIE");
      else if (d.classList.contains("collapsed") && typeof root.toggleCollapse === "function") root.toggleCollapse("imageeditdock");
      return onScreen();
    }
    root.H3TakeGenerate = (gm, text) => {
      const act = actionFor(Object.assign(state(), { genMode: gm }));
      if (act && act.op !== "generate") return takeOp(act, text);
      if (!linked() || gm !== "image") return false;
      if (S.busy) { say("still working on the last one"); return true; }
      if (!S.w) {                                                           // 2.451.0: nothing open yet
        if (S.aiMode === "edit") { say("open a picture to edit first (File ▸ Open, or drop one on the editor)"); return true; }
        return false;                                                       // Generate: a new picture, the usual way (2.431.0 puts it in the editor)
      }
      // 2.451.0: a project's saved settings may have put another style back meanwhile - the edit model first
      if (S.aiMode === "edit" && styleSel() && !(S.engines && (S.engines.edit || []).some((x) => x.id === styleSel().value))) toEditStyle();
      const sel = styleSel();
      const editStyle = S.aiMode === "edit" && sel && S.engines && (S.engines.edit || []).some((x) => x.id === sel.value) ? sel.value : "";
      if (E.flattenCache) E.flattenCache();
      // 2.549.0 (Tim: "when in image-edit mode a generated image is becoming the canvas instead of a new layer"): a
      // Generate is a NEW LAYER - with no selection the prompt docker's own Generate runs (the style picked there -
      // Krea 2 … - not the editor's inpaint style) and the picture lands as a new layer (mount.js H3OnGenerated); with a
      // selection the editor fills it, as a new layer; it no longer blends into the selected layer
      if (S.aiMode === "generate" && !(E.hasSel && E.hasSel())) return false;
      // 2.550.0: ...with the prompt docker's style when it can fill (any style with its own graph now - Krea 2 …): a
      // seamless fill (lib/inpaintLatent.js), not the editor's inpaint style
      const fillStyle = sel && S.engines && (S.engines.inpaint || []).some((x) => x.id === sel.value) ? sel.value : "";
      if (S.aiMode === "generate") E.runAI({ prompt: text, editStyle, style: fillStyle, into: false, whole: false, direct: true, keep: E.layer(), label: "✨ generate" });
      else E.runAI({ prompt: text, editStyle, into: false, whole: true });
      return true;
    };
    /** 2.541.0: Edit / Refine / Fill / Replace background / Remove from the prompt docker's ▾ */
    /** 2.543.0: the edit model now - the prompt docker's style when it can edit, else the ✨ AI panel's Edit model */
    function editStyleNow() {
      const sel = styleSel();
      if (sel && S.engines && (S.engines.edit || []).some((x) => x.id === sel.value)) return sel.value;
      return ($("ieEditStyle") || {}).value || "";
    }
    const tellSay = (m) => { say(m); try { if (typeof root.logLine === "function") root.logLine("[image] " + m); } catch (e) { /* fine */ } };
    function takeOp(act, text) {
      if (act.kind === "say") { tellSay(act.msg); return true; }
      if (act.kind === "refs") { runRefs(act, text); return true; }                   // 2.543.0: the editor closed
      if (S.busy) { say("still working on the last one"); return true; }
      if ((act.mode === "edit" || act.mode === "compose") && styleSel() && !(S.engines && (S.engines.edit || []).some((x) => x.id === styleSel().value))) toEditStyle();
      const sel = styleSel();
      const editStyle = (act.mode === "edit" || act.mode === "compose") && sel && S.engines && (S.engines.edit || []).some((x) => x.id === sel.value) ? sel.value : "";
      if (E.ui && E.ui.showTab) { try { E.ui.showTab("kxAi"); } catch (e) { /* the results show there */ } }
      if (S.aiMode !== act.mode && E.setAiMode) { inTake = true; try { E.setAiMode(act.mode); } finally { inTake = false; } }
      if (act.kind === "blender") {                                         // 🟧 Blender mode: the scene, rendered, is the picture
        if (E.blendLayer && E.blendLayer.isCurrent()) { E.blendLayer.editFromScene(E.layer(), text, act.mode, editStyle); return true; }   // 2.542.0: a Blender layer
        if (!E.layer3d || !E.layer3d.editFromScene) { say("the 3D layer tools are not loaded (reload the page)"); return true; }
        E.layer3d.editFromScene(E.layer(), text, act.mode, editStyle);
        return true;
      }
      const prompt = act.bg ? bgPrompt(text) : text;
      if (act.bg && !prompt) { say("say what the new background is (\"a beach at sunset\")"); return true; }
      if (act.kind === "compose") {                                      // 2.543.0: the layers picked (else the selected one)
        const picks = picksNow(), layers = picks.length ? picks.slice(0, 3) : [E.layer()].filter(Boolean);
        if (picks.length > 3) say("the first 3 picked layers are used (the edit models take three pictures)");
        if ($("ieEditStyle") && editStyle && [...$("ieEditStyle").options].some((o) => o.value === editStyle)) $("ieEditStyle").value = editStyle;
        E.runCompose({ prompt, layers, direct: true, keep: E.layer() });
        return true;
      }
      if (act.kind === "layer") {                                        // 2.543.0: the selected layer is the picture
        const pk = picksNow(), L = pk.length === 1 ? pk[0] : E.layer();
        let c = L && E.layerPicture ? E.layerPicture(L) : null;
        if (c && !hasPixels(c)) c = null;                                 // an empty layer (a new paint layer): the picture as seen instead
        if (!c && E.flattenCache) E.flattenCache();
        E.runAI({ prompt, editStyle, source: c, whole: true, into: false, direct: true, keep: L, label: `${act.op === "refine" ? "🔁" : act.bg ? "🖼" : "✏"} ${c ? L.name : "picture"} ${act.op === "background" ? "new background" : act.op}` });
        return true;
      }
      if (E.flattenCache) E.flattenCache();
      if (act.op === "generate") { E.runAI({ prompt, editStyle, into: false, whole: act.whole, direct: true, keep: E.layer(), label: "✨ generate" }); return true; }   // 2.549.0: a new layer
      E.runAI({ prompt, editStyle, into: act.into && store.get("pl.blend", true) !== false, whole: act.whole });
      return true;
    }
    /** a picture with anything in it (a quick look at a small copy) */
    function hasPixels(c) {
      const t = doc.createElement("canvas"); t.width = 48; t.height = 48; const g = t.getContext("2d"); g.drawImage(c, 0, 0, 48, 48);
      const d = g.getImageData(0, 0, 48, 48).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) return true; return false;
    }
    /** 2.543.0: the editor minimized / closed - the References docker's pictures (up to 3) go to the edit model;
     *  Refine redraws picture 1 at the slider's strength; the results land in the gallery like any picture */
    async function runRefs(act, text) {
      const api = E.api, refs = refsNow().slice(0, 3), t = String(text || "").trim();
      if (!api || !api.aiedit) { say("the AI is not connected (reload the page)"); return; }
      if (!refs.length) { tellSay("put a picture in the References docker first"); return; }
      const prompt = act.bg ? bgPrompt(t) : t;
      if (!prompt && act.mode !== "refine") { tellSay(act.bg ? "say what the new background is (\"a beach at sunset\")" : "type in the prompt docker what to make of the reference picture(s)"); return; }
      try {
        const blobs = await Promise.all(refs.map((r) => (r.file ? Promise.resolve(r.file) : root.fetch(r.url).then((x) => x.blob()))));
        const bmp = await root.createImageBitmap(blobs[0]);
        const fit = E.P.fitSize(bmp.width, bmp.height, (S.res || 1) * 1048576, 16);
        const crop = E.newCanvas(fit.w, fit.h), cg = crop.getContext("2d"); cg.imageSmoothingQuality = "high"; cg.drawImage(bmp, 0, 0, fit.w, fit.h);
        const blobOf = (c) => new Promise((r) => c.toBlob(r, "image/png"));
        if (root.H3TestEvent) { try { root.H3TestEvent("imgop_refs", act.op); } catch (e) { /* the 🧪 list */ } }
        let r = null;
        if (act.mode === "compose") {
          const editStyle = editStyleNow();
          r = await api.compose({ pics: [await blobOf(crop)].concat(blobs.slice(1)), names: refs.map((x, i) => String(x.desc || x.name || `Picture ${i + 1}`).slice(0, 60)), prompt, style_id: editStyle, count: S.count || 1, width: fit.w, height: fit.h }, tellSay);
        } else if (act.mode === "edit") {
          r = await api.aiedit({ mode: "edit", prompt, style_id: editStyleNow(), count: S.count || 1, strength: 100, width: fit.w, height: fit.h, crop: await blobOf(crop) }, tellSay);
        } else {                                                            // refine: the whole of picture 1
          const none = E.newCanvas(fit.w, fit.h);                          // a clear mask = everything selected; the hole picture = all clear
          r = await api.aiedit({ mode: "refine", prompt: prompt || (api.mainPrompt ? api.mainPrompt() : ""), style_id: ($("ieStyle") || {}).value || "", count: S.count || 1, strength: S.strength || 50,
                                 width: fit.w, height: fit.h, crop: await blobOf(crop), mask: await blobOf(none), rgba: await blobOf(none) }, tellSay);
        }
        if (r && r.jobs) tellSay(`${r.jobs.length} render(s) queued from the References docker's picture${refs.length > 1 && act.mode === "compose" ? "s" : " 1"} - the results land in the gallery`);
      } catch (e) { tellSay(`${act.op} failed: ${e.message || e}`); }
    }
    // the panel's tab shown / hidden, the editor opened / closed, the prompt docker's mode: the label follows
    try {
      const mo = new root.MutationObserver(() => paint());
      mo.observe($("kxAi"), { attributes: true, attributeFilter: ["class"] });
      const dock = doc.getElementById("imageeditdock"); if (dock) mo.observe(dock, { attributes: true, attributeFilter: ["class"] });
    } catch (e) { /* old */ }
    const gm = doc.getElementById("genModeSel"); if (gm) gm.addEventListener("change", paint);
    E.onAiMode(S.aiMode);
    // 2.451.0: the project's saved prompt-docker settings load AFTER this (they would put the old style back)
    root.setTimeout(() => { if (S.aiMode === "edit" && linked()) toEditStyle(); paint(); }, 4000);
    E.promptLink = { linked, state, paint, toEditStyle, fromEditStyle, toImageMode, fromImageMode, openDock, takeOp };
  }

  const PCPromptLink = { LINKED_MODES, linkedNow, goLabelFor, pickEditStyle, actionFor, bgPrompt, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCPromptLink;
  else root.PCPromptLink = PCPromptLink;
})(typeof window !== "undefined" ? window : globalThis);
