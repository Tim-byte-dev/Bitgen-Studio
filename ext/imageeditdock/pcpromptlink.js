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
 * Pure (Node: scripts/test-promptlink.js): LINKED_MODES, linkedNow, goLabelFor, pickEditStyle.
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
        + "#kxAi .kxpdnote{display:none;color:var(--pc-dim);font-size:11px;padding:4px 6px;border:1px dashed var(--pc-line);border-radius:5px;margin:4px 0}"
        + "#kxAi.pd-linked .kxpdnote{display:block}#kxAi .kxpdnote b{color:var(--pc-accent)}";
      doc.head.appendChild(st);
    }
    const note = doc.createElement("div"); note.className = "kxpdnote"; note.id = "kxPdNote";
    $("kxModes").after(note);
    const styleSel = () => doc.getElementById("styleSel");
    const genMode = () => { const g = doc.getElementById("genModeSel"); return g ? g.value : "image"; };
    const onScreen = () => (typeof root.ieOnScreen === "function" ? root.ieOnScreen() : true);
    const state = () => ({ onScreen: onScreen(), open: !!S.w, aiShown: !!($("kxAi") && $("kxAi").classList.contains("on")), mode: S.aiMode, genMode: genMode() });
    const linked = () => linkedNow(state());

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
      note.innerHTML = S.aiMode === "edit"
        ? "✏ Type the instruction in the <b>prompt docker</b> and press its <b>Edit</b> - \"make her jacket red\", \"turn it into a watercolor\" (the selection, else the whole picture; the model: its image style, Qwen Image 2.1 edit)."
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
    let lastMode = null;
    E.onAiMode = (m) => {
      if (m === "edit" && onScreen()) toEditStyle();
      else if (lastMode === "edit") fromEditStyle();
      lastMode = m;
      paint();
    };
    /* ---- the page asks these (index.html goLabel / runGenerate) */
    root.H3GoLabel = () => goLabelFor(state());
    root.H3TakeGenerate = (gm, text) => {
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
      E.runAI({ prompt: text, editStyle, into: S.aiMode === "generate" && store.get("pl.blend", true) !== false, whole: true });
      return true;
    };
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
    E.promptLink = { linked, state, paint, toEditStyle, fromEditStyle, toImageMode, fromImageMode };
  }

  const PCPromptLink = { LINKED_MODES, linkedNow, goLabelFor, pickEditStyle, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCPromptLink;
  else root.PCPromptLink = PCPromptLink;
})(typeof window !== "undefined" ? window : globalThis);
