/* pcdocnotes.js — COMMENTS AND FOOTNOTES IN DOCUMENT TEXT (2.815.0), window.PCDocNotes.
 *
 * Tim (verbatim): "i would actually like to keep comments, footnotes and mail merge - after we get this right" then
 * "lets go with next, we will do all the releases before i start testing" - the WORD PLAN's step 4 (part 1).
 *
 *   COMMENTS   select words (or put the caret in a word) and 💬 New Comment (Ctrl+Alt+M): the words are marked
 *              (span data-cid, light yellow) and the comment kept with the story (head frame's doc.comments
 *              [{id, author, text, date, done}]). 💬 Comments opens the list beside the editor: each comment with
 *              its words, who and when; click = those words selected; ✎ Edit, ✓ Resolve (the mark goes pale), 🗑
 *              Delete (the words stay). View ▸ Show Comments turns the marks off in the drawn pages (and the PDF).
 *   FOOTNOTES  ¹ Footnote (Ctrl+Alt+F) puts a numbered mark at the caret (sup data-fn) and asks for the note; the
 *              notes are numbered in story order and drawn at the foot of the frame that shows their mark (the
 *              frame's room shrinks to fit them - pcdoctext flowStory). Double-click a mark = edit its note;
 *              deleting the mark deletes the note.
 *   .DOCX      both go out to Word as real comments / footnotes and come back in (pcdocx.js, lib/docxFiles.js).
 *
 * Pure (Node + jsdom: scripts/test-docnotes815.js): newId, clean, wrapRange.
 */
(function (root) {
  "use strict";
  const newId = (p) => p + Date.now().toString(36).slice(-5) + Math.floor(Math.random() * 1296).toString(36);
  const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  /** a comment list checked (ids, plain text, at most 500) */
  function clean(list) {
    return (Array.isArray(list) ? list : []).filter((c) => c && /^[\w-]{1,24}$/.test(c.id || "")).slice(0, 500)
      .map((c) => ({ id: c.id, author: String(c.author || "").slice(0, 60), text: String(c.text || "").slice(0, 4000), date: String(c.date || "").slice(0, 25), done: !!c.done }));
  }
  /** the range's words wrapped in a comment mark; a range across paragraphs is cut to the first one -> the span */
  function wrapRange(range, id, document) {
    const d = document || root.document;
    const blockOf = (n) => { let e = n.nodeType === 1 ? n : n.parentElement; while (e && !/^(P|H1|H2|H3|H4|LI|TD|TH|BLOCKQUOTE|PRE)$/.test(e.tagName)) e = e.parentElement; return e; };
    const b = blockOf(range.startContainer);
    if (b && !b.contains(range.endContainer)) range.setEnd(b, b.childNodes.length);
    const span = d.createElement("span"); span.setAttribute("data-cid", id);
    span.appendChild(range.extractContents());
    range.insertNode(span);
    return span;
  }

  function install(E) {
    const { S, doc, win } = E;
    if (!E.docText || !E.ui || !E.ui.addCmd || !doc) return;
    const X = E.docText, say = E.say || (() => {}), store = E.store;
    const ed = () => X.ed();
    const editingL = () => (X.editing ? X.editing() : null);
    const headOf = (L) => (L && X.storyOf ? X.storyOf(L)[0] : L);
    const author = () => (store && store.get("doc.author", "")) || "You";
    const stamp = () => { const d = new Date(), z = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`; };
    function caretRange() { const s = doc.getSelection(); return s && s.rangeCount && ed() && ed().contains(s.anchorNode) ? s.getRangeAt(0) : null; }
    const changed = () => { X.keepSel(); X.live(); paintPanel(); };
    // a dialog's OK leaves the focus on the page - back into the words, where the caret was
    const refocus = () => setTimeout(() => { const e0 = ed(); if (!e0) return; try { e0.focus({ preventScroll: true }); } catch (e) { e0.focus(); } X.restoreSel(); }, 0);

    /* ---------------- comments ---------------- */
    function newComment() {
      const L = editingL(); if (!L || !X.restoreSel()) return say("click into the document text and select the words to comment on");
      let r = caretRange(); if (!r) return say("click into the document text first");
      if (r.collapsed) { const s = doc.getSelection(); try { s.modify("move", "backward", "word"); s.modify("extend", "forward", "word"); r = s.getRangeAt(0); } catch (e) { /* no modify */ } }
      if (r.collapsed || !r.toString().trim()) return say("select the words the comment is about");
      const keep = r.cloneRange();
      E.ui.dialog("New Comment", `<div class="kxrow"><span>Author</span><input id="pdcA" value="${esc(author())}" style="width:200px"></div>
        <div class="kxrow" style="color:var(--pc-dim)">On: “${esc(keep.toString().slice(0, 120))}”</div>
        <textarea id="pdcT" rows="5" style="width:100%" placeholder="Your comment"></textarea>`, (dlg) => {
        const text = dlg.querySelector("#pdcT").value.trim(), a = dlg.querySelector("#pdcA").value.trim() || "You";
        if (!text) return say("no comment written - nothing added");
        if (store) store.set("doc.author", a);
        const id = newId("c"), head = headOf(L).doc;
        const span = wrapRange(keep, id, doc);
        head.comments = clean(head.comments).concat([{ id, author: a, text, date: stamp(), done: false }]);
        const s = doc.getSelection(); s.removeAllRanges(); const rr = doc.createRange(); rr.selectNodeContents(span); s.addRange(rr);
        changed(); openPanel(true); refocus();
        say("💬 comment added");
      }, { okLabel: "💬 Add" });
      setTimeout(() => { const t = doc.getElementById("pdcT"); if (t) t.focus(); }, 30);
    }
    function findComment(id) { const L = editingL(); const head = L && headOf(L).doc; return head ? { head, c: clean(head.comments).find((x) => x.id === id) } : null; }
    function setComments(head, fn) { head.comments = clean(fn(clean(head.comments))); changed(); }
    function editComment(id) {
      const f = findComment(id); if (!f || !f.c) return;
      E.ui.dialog("Edit Comment", `<textarea id="pdcT" rows="5" style="width:100%">${esc(f.c.text)}</textarea>`, (dlg) => {
        const t = dlg.querySelector("#pdcT").value.trim(); setComments(f.head, (l) => l.map((x) => (x.id === id ? Object.assign(x, { text: t || x.text }) : x)));
      }, { okLabel: "Save" });
    }
    function resolveComment(id) {
      const f = findComment(id); if (!f || !f.c) return;
      const done = !f.c.done;
      for (const sp of ed().querySelectorAll(`span[data-cid="${id}"]`)) { if (done) sp.setAttribute("data-done", "1"); else sp.removeAttribute("data-done"); }
      setComments(f.head, (l) => l.map((x) => (x.id === id ? Object.assign(x, { done }) : x)));
    }
    function deleteComment(id) {
      const f = findComment(id); if (!f) return;
      for (const sp of [...ed().querySelectorAll(`span[data-cid="${id}"]`)]) { while (sp.firstChild) sp.parentNode.insertBefore(sp.firstChild, sp); sp.remove(); }
      setComments(f.head, (l) => l.filter((x) => x.id !== id));
    }
    function showComment(id) {
      const sp = ed() && ed().querySelector(`span[data-cid="${id}"]`); if (!sp) return;
      const s = doc.getSelection(), r = doc.createRange(); r.selectNodeContents(sp); s.removeAllRanges(); s.addRange(r); X.keepSel();
      try { sp.scrollIntoView({ block: "nearest" }); } catch (e) { /* jsdom */ }
    }
    /* the panel beside the editor */
    let panel = null;
    function closePanel() { if (panel) { panel.remove(); panel = null; } }
    function openPanel(force) {
      if (panel && !force) { closePanel(); return; }
      if (!panel) {
        panel = doc.createElement("div"); panel.className = "pdcPanel";
        panel.style.cssText = "position:absolute;right:8px;top:48px;width:270px;max-height:70%;overflow:auto;z-index:30;background:var(--pc-panel,#222);color:var(--pc-text,#ddd);border:1px solid var(--pc-line,#444);border-radius:6px;padding:6px;font-size:12px;box-shadow:0 4px 16px rgba(0,0,0,.4)";
        (E.kx || E.stage || doc.body).appendChild(panel);
        panel.addEventListener("mousedown", (e) => { if (e.target.closest("button,.pdcItem")) e.preventDefault(); });
        panel.addEventListener("click", (e) => {
          const b = e.target.closest("[data-act]"), it = e.target.closest(".pdcItem");
          // 2.851.0 (Tim: "the comments panel won't close"): ✕ is not in a comment - it threw on .pdcItem before it was read
          if (b) { const a = b.dataset.act; if (a === "close") { closePanel(); return; } const row = b.closest(".pdcItem"), id = row ? row.dataset.cid : ""; if (!id) return; if (a === "edit") editComment(id); else if (a === "done") resolveComment(id); else if (a === "del") deleteComment(id); return; }
          if (it) showComment(it.dataset.cid);
        });
      }
      paintPanel();
    }
    function paintPanel() {
      if (!panel) return;
      const L = editingL() || (S.layers[S.active] && S.layers[S.active].type === "doc" ? S.layers[S.active] : null);
      const head = L ? headOf(L).doc : null, list = head ? clean(head.comments) : [];
      const words = (id) => { const box = doc.createElement("div"); box.innerHTML = head ? head.html : ""; const sp = box.querySelector(`span[data-cid="${id}"]`); return sp ? sp.textContent : ""; };
      panel.innerHTML = `<div style="display:flex;align-items:center;margin-bottom:4px"><b style="flex:1">💬 Comments (${list.length})</b><button class="ghost" data-act="close" title="Close">✕</button></div>`
        + (list.length ? list.map((c) => `<div class="pdcItem" data-cid="${c.id}" style="border:1px solid var(--pc-line,#444);border-radius:4px;padding:4px;margin:4px 0;cursor:pointer;${c.done ? "opacity:.55" : ""}">
          <div style="color:var(--pc-dim,#999)">${esc(c.author)} · ${esc(c.date)}${c.done ? " · ✓ resolved" : ""}</div>
          <div style="font-style:italic;color:var(--pc-dim,#999)">“${esc(words(c.id).slice(0, 80))}”</div><div style="white-space:pre-wrap">${esc(c.text)}</div>
          <div style="text-align:right"><button class="ghost" data-act="edit" title="Edit">✎</button><button class="ghost" data-act="done" title="${c.done ? "Reopen" : "Resolve"}">✓</button><button class="ghost" data-act="del" title="Delete the comment (the words stay)">🗑</button></div></div>`).join("")
          : `<div style="color:var(--pc-dim,#999)">No comments yet - select words in the document text and press 💬.</div>`);
    }

    /* ---------------- footnotes ---------------- */
    function noteDialog(head, id, isNew) {
      const notes = head.notes || {};
      E.ui.dialog(isNew ? "New Footnote" : "Edit Footnote", `<textarea id="pdfT" rows="4" style="width:100%" placeholder="The footnote">${esc(notes[id] || "")}</textarea>`, (dlg) => {
        const t = dlg.querySelector("#pdfT").value.trim();
        if (!t && isNew) { const m = ed() && ed().querySelector(`sup[data-fn="${id}"]`); if (m) m.remove(); X.live(); refocus(); return say("no footnote written - the mark taken out"); }
        head.notes = Object.assign({}, head.notes || {}, { [id]: t });
        X.live(); X.keepSel(); refocus(); say(isNew ? "¹ footnote added" : "footnote changed");
      }, { okLabel: isNew ? "Add" : "Save" });
      setTimeout(() => { const t = doc.getElementById("pdfT"); if (t) t.focus(); }, 30);
    }
    function newFootnote() {
      const L = editingL(); if (!L || !X.restoreSel()) return say("click into the document text where the footnote mark goes");
      const r = caretRange(); if (!r) return say("click into the document text first");
      r.collapse(false);
      const id = newId("f"), m = doc.createElement("sup"); m.setAttribute("data-fn", id);
      const n = ed().querySelectorAll("sup[data-fn]").length + 1; m.textContent = String(n);
      r.insertNode(m); r.setStartAfter(m); r.collapse(true);
      const s = doc.getSelection(); s.removeAllRanges(); s.addRange(r);
      const head = headOf(L).doc; head.notes = Object.assign({}, head.notes || {}, { [id]: "" });
      // the marks numbered in story order now (the live page too)
      [...ed().querySelectorAll("sup[data-fn]")].forEach((x, i) => { x.textContent = String(i + 1); });
      X.keepSel(); noteDialog(head, id, true);
    }
    function markAtCaret() {
      const r = caretRange(); if (!r) return null;
      const n = r.startContainer, el = n.nodeType === 1 ? n : n.parentElement;
      return (el && el.closest && el.closest("sup[data-fn]")) || (n.nodeType === 3 && r.startOffset === 0 && n.previousSibling && n.previousSibling.matches && n.previousSibling.matches("sup[data-fn]") ? n.previousSibling : null);
    }
    function editFootnote(m) { const L = editingL(); m = m || markAtCaret(); if (!L || !m) return say("put the caret on a footnote mark"); noteDialog(headOf(L).doc, m.getAttribute("data-fn"), false); }
    doc.addEventListener("dblclick", (e) => { const e0 = ed(); const m = e.target && e.target.closest ? e.target.closest("sup[data-fn]") : null; if (e0 && m && e0.contains(m)) { e.preventDefault(); e.stopPropagation(); editFootnote(m); } }, true);

    /* ---------------- commands, keys, the bar ---------------- */
    const C = E.ui.addCmd;
    C("doc.comment.new", "💬 New Comment", "", newComment);
    C("doc.comment.panel", "💬 Comments", "", () => openPanel(false), { checked: () => !!panel });
    C("doc.fn.new", "¹ Insert Footnote", "", newFootnote);
    C("doc.fn.edit", "Edit Footnote…", "", () => editFootnote());
    C("view.showcomments", "Show Comments", "", () => {
      PCDocText().showComments = PCDocText().showComments === false; if (store) store.set("doc.showcmt", PCDocText().showComments);
      for (const L of S.layers) if (L.type === "doc") E.D.rasterize(L); E.refresh(); say(PCDocText().showComments ? "comment marks shown" : "comment marks hidden (the drawn pages and the PDF)");
    }, { checked: () => PCDocText().showComments !== false }, ["View", null]);
    function PCDocText() { return win.PCDocText || { }; }
    if (store && store.get("doc.showcmt", true) === false && win.PCDocText) win.PCDocText.showComments = false;
    doc.addEventListener("keydown", (e) => {
      const e0 = ed(); if (!e0 || !e0.contains(e.target) || !e.ctrlKey || !e.altKey || e.shiftKey) return;
      const k = (e.key || "").toLowerCase();
      if (k === "m") { e.preventDefault(); e.stopPropagation(); newComment(); } else if (k === "f") { e.preventDefault(); e.stopPropagation(); newFootnote(); }
    }, true);
    const T = E.tools.doctext, ob = T.options, bb = T.bindOptions;
    T.options = function () {
      const h = ob.call(this);
      const btns = '<button class="ghost" id="pdnCmt" title="New comment on the selected words (Ctrl+Alt+M)">💬</button><button class="ghost" id="pdnCmtList" title="The comments list">💬☰</button><button class="ghost" id="pdnFn" title="Insert a footnote at the caret (Ctrl+Alt+F); double-click a mark to edit its note">¹ Note</button>';
      return h.indexOf('id="pttMenu"') >= 0 ? h.replace(/(<button class="ghost" id="pttMenu"[^>]*>[^<]*<\/button>)/, "$1" + btns) : h + btns;
    };
    T.bindOptions = function (o) {
      bb.call(this, o);
      for (const [id, fn] of [["pdnCmt", newComment], ["pdnCmtList", () => openPanel(false)], ["pdnFn", newFootnote]]) { const b = o.querySelector("#" + id); if (b) { b.onmousedown = (e) => e.preventDefault(); b.onclick = () => fn(); } }
    };
    // the panel follows the frame being edited
    win.addEventListener("h3docready", () => { if (panel) paintPanel(); });
    E.docNotes = { newComment, editComment, resolveComment, deleteComment, openPanel, closePanel, newFootnote, editFootnote, panel: () => panel, clean };
  }

  const PCDocNotes = { newId, clean, wrapRange, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCDocNotes;
  if (root && root.document) root.PCDocNotes = PCDocNotes;
})(typeof window !== "undefined" ? window : globalThis);
