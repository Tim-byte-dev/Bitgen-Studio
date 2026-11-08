/* bitGen Studio — the Music docker's ENGRAVED SHEET MUSIC (2.731.0): window.MuScore.
 *
 * Tim (verbatim): "in our music docker, sheet music tab can we have real sheet music with the notes drawn on the staff
 * with it's clefs etc. and save as pdf?"  + "just use the standards don't import anything".
 *
 * The Sheet music tab draws the score - staves, clefs, key and time signatures, notes, beams, rests, ties, chord
 * symbols, section marks - with static/abcscore.js (the engraver, written here; no library), one white page per PDF
 * page. Where a score comes from: 🎼 Write / 📜 Transcribe (musicdock.js muShowAbc -> show), the Score list (the
 * project's .abc files - GET /api/scores, read with GET /outputs/:name) or 📂 Open .abc (a file on this computer).
 * 💾 Save PDF writes the PDF in the page (AbcScore.toPDF - the PDF standard's own fonts, nothing embedded) and posts it
 * to POST /api/pdf/save (the project's pdf folder, lib/pdfStore.js), downloading it too when "download too" is ticked.
 * ‹/› ABC text shows the notation behind the drawing; ⧉ Copy copies it.
 *   MuScore.show(text, name, how)   draw a score -> the render result (or null)
 *   MuScore.load(name)              a project score by name -> Promise<result>
 *   MuScore.refresh(select?)        the Score list -> Promise<files>
 *   MuScore.savePdf()               -> Promise<{name, size, pages} | null>
 *   MuScore.openView()              ⛶ Read: the pages full size in a dialog
 *   MuScore.state                   {text, name, title, result}
 */
(function (root) {
  "use strict";
  const doc = root.document;
  const $ = (id) => doc.getElementById(id);
  const S = { text: "", name: "", title: "", result: null, listed: false };
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function test(k, v) { try { if (root.H3TestEvent) root.H3TestEvent(k, v); } catch (e) { /* the 🧪 list */ } }
  function status(t) { const el = $("muSheetStatus"); if (el) el.textContent = t; }
  /** "Neon-Nights_20261108-233101_ab12.abc" -> "Neon-Nights" (a score with no T: is titled by its file) */
  function titleFrom(name) {
    return String(name || "").replace(/\.[^.]+$/, "").replace(/[_\s-]*\d{8}[-_]?\d{4,6}.*$/, "").replace(/_+/g, " ").trim();
  }
  function empty(msg) {
    const box = $("muScore");
    if (box) box.innerHTML = '<div class="muEmpty hint">' + esc(msg) + "</div>";
    ["muScorePdf", "muScoreBig"].forEach((id) => { const b = $(id); if (b) b.disabled = true; });
  }
  // ⛶ Read: the pages full size in a dialog (the docker is often a narrow column)
  const view = () => $("muScoreView");
  function makeView() {
    if (view()) return view();
    const d = doc.createElement("dialog");
    d.id = "muScoreView";
    d.setAttribute("aria-label", "Sheet music");
    d.style.cssText = "width:min(980px,96vw);max-height:94vh;padding:0;border:1px solid var(--line,#333);border-radius:8px;background:var(--bg2,#1b1e25);color:inherit";
    d.innerHTML = '<div style="display:flex;gap:8px;align-items:center;padding:8px 12px;border-bottom:1px solid var(--line,#333);position:sticky;top:0;background:inherit;z-index:1">'
      + '<b id="muSvTitle" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Sheet music</b>'
      + '<button class="go" id="muSvPdf" type="button" style="width:auto;flex:none" title="Save the pages as a PDF in the project\'s pdf folder">💾 Save PDF</button>'
      + '<button class="ghost gbtn" id="muSvClose" type="button" style="width:auto;flex:none" title="Close" aria-label="Close">✕</button></div>'
      + '<div id="muSvPages" style="overflow:auto;max-height:calc(94vh - 52px);padding:16px"></div>';
    doc.body.appendChild(d);
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
    return d;
  }
  function fillView() {
    const A = root.AbcScore, r = S.result, box = $("muSvPages");
    if (!A || !r || !box) return;
    $("muSvTitle").textContent = S.title + " - " + r.pages.length + " page" + (r.pages.length === 1 ? "" : "s");
    box.innerHTML = "";
    r.pages.forEach((pg, k) => {
      const p = doc.createElement("div");
      p.style.cssText = "background:#fff;margin:0 auto 16px;max-width:900px;box-shadow:0 2px 12px rgba(0,0,0,.5)";
      p.setAttribute("role", "img");
      p.setAttribute("aria-label", S.title + " - page " + (k + 1));
      p.innerHTML = A.toSVG(pg).replace("<svg ", '<svg style="display:block;width:100%;height:auto" ');
      box.appendChild(p);
    });
  }
  function openView() {
    if (!S.result || S.result.empty) { status("nothing to show yet - draw a score first"); return; }
    const d = makeView();
    fillView();
    if (!d.open) { try { d.showModal(); } catch (e) { d.setAttribute("open", ""); } }
    test("mu_score_view", String(S.result.pages.length));
  }

  function show(text, name, how) {
    const A = root.AbcScore;
    S.text = String(text == null ? "" : text); S.name = String(name || "");
    const pre = $("muAbc");
    if (pre) pre.textContent = S.text || "— empty score —";
    if (!A) { empty("The sheet music engraver did not load - reload the page."); return null; }
    let r;
    try { r = A.render(S.text, { title: titleFrom(S.name) }); } catch (e) {
      S.result = null;
      empty("Could not draw " + (S.name || "this score") + ": " + ((e && e.message) || e) + " - ‹/› ABC text shows the notation.");
      status("could not draw " + (S.name || "the score"));
      return null;
    }
    S.result = r; S.title = r.title || titleFrom(S.name) || "Sheet music";
    if (r.empty) {
      empty((S.name || "This score") + " has no notes to draw - ‹/› ABC text shows what it holds.");
      status((how || "") + (S.name || "the score") + " - no notes in it");
      return r;
    }
    const box = $("muScore");
    box.innerHTML = "";
    r.pages.forEach((pg, k) => {
      const d = doc.createElement("div");
      d.className = "muPaper";
      d.setAttribute("role", "img");
      d.setAttribute("aria-label", S.title + " - page " + (k + 1) + " of " + r.pages.length);
      d.innerHTML = A.toSVG(pg);
      box.appendChild(d);
    });
    box.scrollTop = 0;
    $("muScorePdf").disabled = false;
    if ($("muScoreBig")) $("muScoreBig").disabled = false;
    if (view() && view().open) fillView();
    const sum = r.pages.length + " page" + (r.pages.length === 1 ? "" : "s") + ", " + r.measures + " bar" + (r.measures === 1 ? "" : "s")
      + ", " + r.voices + (r.voices === 1 ? " staff" : " staves");
    status((how || "🎼 ") + (S.name || S.title) + " - " + sum + (r.warnings.length ? " (" + r.warnings.join("; ") + ")" : ""));
    const sel = $("muScoreList");
    if (sel && S.name && Array.prototype.some.call(sel.options, (o) => o.value === S.name)) sel.value = S.name;
    test("mu_score", (S.name || S.title) + " " + r.pages.length);
    return r;
  }

  function load(name) {
    if (!name) return Promise.resolve(null);
    status("reading " + name + "…");
    return root.fetch("/outputs/" + encodeURIComponent(name))
      .then((r) => { if (!r.ok) throw new Error(name + " is not in the project any more"); return r.text(); })
      .then((t) => show(t, name))
      .catch((e) => { status((e && e.message) || String(e)); return null; });
  }

  function refresh(select) {
    const sel = $("muScoreList");
    if (!sel) return Promise.resolve([]);
    return root.fetch("/api/scores").then((r) => r.json()).then((j) => {
      const files = (j && j.files) || [];
      const keep = select || sel.value;
      sel.innerHTML = "";
      const o0 = doc.createElement("option");
      o0.value = ""; o0.textContent = files.length ? "— pick a score (" + files.length + ") —" : "— no scores in the project yet —";
      sel.appendChild(o0);
      files.forEach((f) => {
        const o = doc.createElement("option");
        o.value = f.name;
        const d = new Date(f.mtime);
        o.textContent = f.name + (isNaN(d) ? "" : " · " + d.toISOString().slice(0, 16).replace("T", " "));
        sel.appendChild(o);
      });
      if (keep && files.some((f) => f.name === keep)) sel.value = keep;
      S.listed = true;
      return files;
    }).catch(() => []);
  }

  function download(name, bytes) {
    const u = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const a = doc.createElement("a");
    a.href = u; a.download = name; doc.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 30000);
  }
  function savePdf() {
    const A = root.AbcScore, r = S.result;
    if (!A || !r || r.empty) { status("nothing to save yet - draw a score first"); return Promise.resolve(null); }
    const btn = $("muScorePdf");
    btn.disabled = true;
    const was = btn.textContent;
    btn.textContent = "⏳ Writing…";
    const file = (S.title || titleFrom(S.name) || "sheet music").replace(/[^A-Za-z0-9 ._()-]+/g, "_").trim().slice(0, 70) + ".pdf";
    let bytes;
    try { bytes = A.toPDF(r.pages, { title: S.title, subject: "Sheet music" }); } catch (e) {
      status("could not write the PDF: " + ((e && e.message) || e)); btn.disabled = false; btn.textContent = was; return Promise.resolve(null);
    }
    return root.fetch("/api/pdf/save?name=" + encodeURIComponent(file), { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: bytes })
      .then((x) => x.json()).then((j) => {
        if (j.error) throw new Error(j.error);
        if ($("muScoreDl") && $("muScoreDl").checked) { try { download(j.name, bytes); } catch (e) { /* saved in the project anyway */ } }
        status("📄 " + j.name + " - " + r.pages.length + " page" + (r.pages.length === 1 ? "" : "s") + " - saved in the project's pdf folder");
        test("mu_score_pdf", j.name + " " + r.pages.length);
        S.last = { name: j.name, size: j.size, pages: r.pages.length, bytes: bytes.length };
        return S.last;
      })
      .catch((e) => { status("⚠ the PDF was not saved: " + ((e && e.message) || e)); return null; })
      .finally(() => { btn.disabled = false; btn.textContent = was; });
  }

  // the controls (the dock's html may arrive after this script: listeners on the document)
  doc.addEventListener("click", (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    if (t.closest("#muScorePdf") || t.closest("#muSvPdf")) { e.preventDefault(); savePdf(); return; }
    if (t.closest("#muScoreBig")) { e.preventDefault(); openView(); return; }
    if (t.closest("#muSvClose")) { e.preventDefault(); const d = view(); if (d) d.close(); return; }
    if (t.closest("#muScoreRefresh")) { e.preventDefault(); refresh(); return; }
    if (t.closest("#muAbcToggle")) {
      e.preventDefault();
      const pre = $("muAbc"), b = $("muAbcToggle");
      const on = pre.classList.toggle("hidden") === false;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      return;
    }
    const tab = t.closest('button[data-mutab="sheet"]');
    if (tab) first();
  });
  doc.addEventListener("change", (e) => {
    const t = e.target;
    if (!t) return;
    if (t.id === "muScoreList") { if (t.value) load(t.value); return; }
    if (t.id === "muAbcFile") {
      const f = t.files && t.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { show(String(rd.result || ""), f.name, "📂 "); t.value = ""; };
      rd.onerror = () => status("could not read " + f.name);
      rd.readAsText(f);
    }
  });
  /** the first time the tab opens: list the project's scores and draw the newest (when nothing is drawn yet) */
  function first() {
    if (S.listed) return;
    refresh().then((files) => { if (!S.text && files.length) load(files[0].name); });
  }
  function boot() { const p = $("muPaneSheet"); if (p && !p.classList.contains("hidden")) first(); }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", () => setTimeout(boot, 400)); else setTimeout(boot, 400);

  root.MuScore = { show, load, refresh, savePdf, openView, titleFrom, state: S };
}(typeof window !== "undefined" ? window : this));
