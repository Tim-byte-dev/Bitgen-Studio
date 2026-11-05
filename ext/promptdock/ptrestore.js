/* bitGen Studio — ext/promptdock/ptrestore.js (2.654.0): 🩹 RESTORE / FIX A PHOTO - a button in the prompt docker's left
 * column (#ptools, after 🎤) (window.H3PtRestore / require()).
 *
 * Tim (verbatim): "please a a button to the shortcut buttons on the left of the prompt docker to restore/fix photo"
 *
 * A click sets the prompt docker up for the edit model and leaves the Generate button to the user (like the other buttons
 * in that column - nothing runs by itself):
 *   - Generate mode 🖼 Image, the ▾ operation ✏ Edit (ext/imageeditdock/pcimgop.js - window.H3ImgOp)
 *   - the restore instruction LEADS the prompt, once (what is typed after it stays - "her dress is dark green")
 *   - Shift+click: the same + colourise a black-and-white photo
 *   2.655.0 (Tim: "can u add ctrl click starts the job automatically, a click starts the colorize job automatically"):
 *   - Ctrl+click: the restore STARTS by itself (✏ Edit pressed for you) - Shift+click / Ctrl+Shift+click: the colourising
 *     restore starts by itself; a plain click still only sets it up. No photo to take = nothing starts (the note says why).
 *   - a note says which picture Edit will use: the image editor open = the selected layer (or the selection), closed =
 *     the 🖼 References docker's picture(s); none = how to give it one
 * Pure (Node: scripts/test-restore654.js, test-restore655.js): instruction(colour), withInstruction(text, colour), sourceNote(s),
 *   runNote(s, colour), clickAction(ev), canRun(s).
 * The clicks: scripts/test-ui654-ui.js. */
(function (root) {
  "use strict";
  const KEY = "restore this photo";                               // the instruction's start - found = already there
  const BASE = "Restore this photo: remove scratches, dust, spots, stains, creases and tears, reduce noise and grain, fix the faded"
    + " and colour-shifted colours and the contrast, sharpen soft and blurry detail. Keep the same people, faces, expressions,"
    + " clothes, pose, framing and composition - add nothing, remove nothing else.";
  const COLOUR = " Then colourise it with natural, true-to-life colours.";

  /** the instruction (colour: + colourise a black-and-white photo) */
  const instruction = (colour) => BASE + (colour ? COLOUR : "");
  /** the prompt with the instruction leading it - once; Shift again adds only the colourising */
  function withInstruction(text, colour) {
    const t = String(text == null ? "" : text);
    if (t.toLowerCase().indexOf(KEY) !== -1) {
      if (colour && t.indexOf(COLOUR.trim()) === -1) { const i = t.indexOf(BASE); return i !== -1 ? t.slice(0, i + BASE.length) + COLOUR + t.slice(i + BASE.length) : t; }
      return t;
    }
    const rest = t.replace(/^\s+/, "");
    return instruction(colour) + (rest ? " " + rest : " ");
  }
  /** 2.655.0: what a click means - {colour, run}: Ctrl (⌘) = run the restore, Shift = run the colourising restore, both =
      the colourising one, plain = only set it up */
  function clickAction(ev) {
    const e = ev || {}, ctl = !!(e.ctrlKey || e.metaKey), sh = !!e.shiftKey;
    return { colour: sh, run: ctl || sh };
  }
  /** 2.655.0: is there a picture ✏ Edit can take? (the image editor's layer / selection, or a References picture) */
  const canRun = (s) => !!(s && s.imgop && (s.open || s.refs > 0));
  /** 2.655.0: the note when it starts by itself (s as sourceNote's) */
  function runNote(s, colour) {
    s = s || {};
    const what = s.open ? (s.hasSel ? "the selection on " + (s.layer ? "“" + s.layer + "”" : "the picture") : s.picks > 1 ? "the " + Math.min(s.picks, 3) + " layers picked" : s.layer ? "the layer “" + s.layer + "”" : "the picture in the image editor")
      : s.refs === 1 ? "the picture in the 🖼 References docker" : "the " + s.refs + " pictures in the 🖼 References docker";
    return (colour ? "🎨 Restoring and colourising " : "🩹 Restoring ") + what + " - starting ✏ Edit…";
  }
  /** what the user is told after the click: s = {imgop (pcimgop installed), editorOn, open, refs, picks, layer, hasSel} */
  function sourceNote(s) {
    s = s || {};
    if (!s.imgop) return "🩹 The restore instruction is in the prompt - the image editor extension is needed for ✏ Edit (Settings ▸ Extensions).";
    if (!s.editorOn || !s.open) {
      if (!s.refs) return "🩹 Ready to restore - put the photo in the 🖼 References docker (or open it in the image editor), then press ✏ Edit.";
      return "🩹 Ready - ✏ Edit restores the " + (s.refs === 1 ? "picture" : s.refs + " pictures") + " in the 🖼 References docker" + (s.refs > 1 ? " (keep only the photo there for one restore)" : "") + ".";
    }
    if (s.hasSel) return "🩹 Ready - ✏ Edit restores the selection on " + (s.layer ? "“" + s.layer + "”" : "the picture") + ".";
    if (s.picks > 1) return "🩹 Ready - ✏ Edit works from the " + Math.min(s.picks, 3) + " layers picked (pick only the photo's layer for one restore).";
    return "🩹 Ready - ✏ Edit restores " + (s.layer ? "the layer “" + s.layer + "”" : "the picture") + " in the image editor.";
  }

  /* ---------------- the page */
  let noteT = 0;
  /** the note: a small bubble beside the 🩹 button (#ptRestoreNote - the prompt box's column is too narrow for words),
      gone after 12 s or a click on it */
  function say(text) {
    const doc = root.document, btn = doc.getElementById("ptRestore"); if (!btn) return;
    let n = doc.getElementById("ptRestoreNote");
    if (!n) {
      n = doc.createElement("div"); n.id = "ptRestoreNote"; n.setAttribute("role", "status");
      n.style.cssText = "position:fixed;z-index:2147483400;max-width:280px;font-size:12px;line-height:1.35;padding:6px 9px;border-radius:7px;"
        + "background:var(--panel,#1f1c17);color:var(--text,#eee);border:1px solid var(--tiger,#f59e2c);box-shadow:0 6px 18px #0008;cursor:pointer";
      n.title = "Click to close"; n.addEventListener("click", () => { n.hidden = true; });
      doc.body.appendChild(n);
    }
    n.textContent = text; n.hidden = false;
    const r = btn.getBoundingClientRect(), W = root.innerWidth || 1200, H = root.innerHeight || 800;
    const w = Math.min(280, n.offsetWidth || 280), h = n.offsetHeight || 60;
    let x = r.right + 8; if (x + w > W - 8) x = Math.max(8, r.left - w - 8);
    n.style.left = Math.round(x) + "px"; n.style.top = Math.round(Math.max(8, Math.min(H - h - 8, r.top + r.height / 2 - h / 2))) + "px";
    clearTimeout(noteT); noteT = setTimeout(() => { n.hidden = true; }, 12000);
  }
  const run = { n: 0 };
  function install() {
    const doc = root.document; if (!doc) return;
    const b = doc.getElementById("ptRestore"); if (!b || b.dataset.wired) return;
    b.dataset.wired = "1";
    b.addEventListener("click", (ev) => {
      const act = clickAction(ev), colour = act.colour;
      // 🖼 Image mode (the page's own onchange - Basic Settings and the button's words follow)
      const gm = doc.getElementById("genModeSel");
      if (gm && gm.value !== "image") { gm.value = "image"; if (typeof gm.onchange === "function") gm.onchange(); gm.dispatchEvent(new Event("change")); }
      const op = root.H3ImgOp || null;
      if (op && op.set) {
        op.set("edit");
        // the image editor's style guard (ieeditonly.js) swaps in an edit-capable style a moment later and, while the
        // style it found could not edit, can put the ▾ back on Generate - the click asked for Edit: twice more, then leave it
        [350, 1100].forEach((ms) => root.setTimeout(() => { try { if (op.get && op.get() !== "edit") op.set("edit"); } catch (e) { /* fine */ } }, ms));
      }
      const t = doc.getElementById("prompt");
      if (t) { t.value = withInstruction(t.value, colour); t.dispatchEvent(new Event("input", { bubbles: true })); t.focus(); try { t.setSelectionRange(t.value.length, t.value.length); } catch (e) { /* fine */ } }
      // which picture ✏ Edit will use
      let refs = 0; try { refs = root.H3Refs ? root.H3Refs.images().length : 0; } catch (e) { refs = 0; }
      let st = { imgop: !!op, editorOn: op && op.editorOn ? !!op.editorOn() : false, open: false, refs, picks: 0, layer: "", hasSel: false };
      try {                                                      // the ▾ chip's words (pcimgop.js sourceText) say what Edit takes
        const src = op && op.source ? String(op.source() || "") : "";
        st.open = st.editorOn && /^(▦|▭)/.test(src);
        if (st.open) { st.hasSel = /^▭/.test(src); const m = /^▦ (\d+) layers$/.exec(src); st.picks = m ? +m[1] : 1; st.layer = !m && /^▦ /.test(src) ? src.slice(2) : ""; }
      } catch (e) { /* the note stays general */ }
      let note = sourceNote(st);
      // 2.655.0: Ctrl / Shift - press ✏ Edit once the ▾ and the edit style have settled (the re-checks above end at 1.1 s)
      if (act.run && canRun(st)) {
        note = runNote(st, colour);
        const token = (run.n = (run.n || 0) + 1);
        root.setTimeout(() => {
          if (token !== run.n) return;                                // a newer click took over
          try { if (op.get && op.get() !== "edit") op.set("edit"); } catch (e) { /* fine */ }
          const go = doc.getElementById("go");
          if (!go || go.disabled) { say("🩹 Could not start - the Generate button is busy; press ✏ Edit when it is free."); return; }
          go.click();
          if (root.H3TestEvent) { try { root.H3TestEvent("pt_restore_run", colour ? "colour" : "1"); } catch (e) { /* the 🧪 list */ } }
        }, 1250);
      } else if (act.run) note = st.imgop ? "🩹 Not started - put the photo in the 🖼 References docker (or open it in the image editor), then click again." : note;
      b.dataset.note = note;
      say(note);
      if (root.H3TestEvent) { try { root.H3TestEvent("pt_restore", colour ? "colour" : "1"); } catch (e) { /* the 🧪 list */ } }
    });
  }

  const api = { KEY, BASE, COLOUR, instruction, withInstruction, sourceNote, runNote, clickAction, canRun, install };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.H3PtRestore = api;
  if (root.document) { if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", install); else install(); root.setTimeout && root.setTimeout(install, 1500); }
})(typeof window !== "undefined" ? window : globalThis);
