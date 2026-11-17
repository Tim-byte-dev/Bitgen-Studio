/* ext/slidesdock/slideio.js — 🎞 SLIDES (2.832.0): files in and out - window.H3SlideIO. Tim: "yes please go ahead wth part 2".
 *
 *   ⤒ Open PowerPoint   a .pptx -> POST /api/slides/import (lib/slidePptxIn.js) -> the deck (what was left out is said)
 *   ⤓ PDF ▾             Slides / Slides + speaker notes: each slide drawn on a canvas (slidedraw.js, 1920 px wide) into a PDF
 *                       with pdf-lib (MIT, static/vendor) - downloaded and kept in the slides folder (POST /api/slides/export/pdf)
 *   🖼 Picture ▾        From this computer… / From the Gallery… / From Assets… (a picker of the project's pictures)
 */
(function (root) {
  "use strict";
  const doc = root.document; if (!doc) return;
  const $ = (id) => doc.getElementById(id);
  const H = () => root.H3Slides, D = () => root.SlideDraw;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function loadScript(src, ready) {
    if (ready()) return Promise.resolve(ready());
    return new Promise((res, rej) => { const s = doc.createElement("script"); s.src = src; s.onload = () => (ready() ? res(ready()) : rej(new Error("could not load " + src))); s.onerror = () => rej(new Error("could not load " + src)); doc.head.appendChild(s); });
  }
  const download = (blob, name) => { const a = doc.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; doc.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000); };

  /* ---- ⤒ a PowerPoint file */
  async function importFile(file) {
    if (!file) return null;
    if (!/\.pptx$/i.test(file.name)) { H().msg(file.name + " is not a .pptx (an older .ppt? save it as .pptx first)", true); return null; }
    if (H().St.dirty && typeof root.appConfirm === "function" && !(await root.appConfirm(`"${H().St.name}" has changes that are not saved. Open ${file.name} instead?`, "Not saved"))) return null;
    H().msg("⤒ reading " + file.name + "…");
    try {
      const r = await fetch("/api/slides/import", { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: file });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error((j && j.error) || "HTTP " + r.status);
      H().load(j.deck, file.name.replace(/\.pptx$/i, ""));
      H().St.dirty = true;                                // not kept as a .bgk yet
      H().msg(`⤒ ${file.name}: ${j.deck.slides.length} slide(s)` + (j.notes && j.notes.length ? " - " + j.notes.join("; ") : "") + " - 💾 Save keeps it here");
      return j;
    } catch (e) { H().msg("✗ " + e.message, true); return null; }
  }

  /* ---- ⤓ PDF */
  async function pdf(withNotes) {
    const ed = H(); if (ed.St.edit) ed.endEdit();
    const deck = ed.deck(), name = (($("slFile") && $("slFile").value) || ed.St.name || "Presentation").trim();
    ed.msg("⤓ drawing the slides…");
    try {
      const PDFLib = await loadScript("/static/vendor/pdf-lib.min.js", () => root.PDFLib);
      const pdfDoc = await PDFLib.PDFDocument.create(), W = 1920, k = W / deck.w;
      pdfDoc.setTitle(name); pdfDoc.setCreator("bitGen Studio"); pdfDoc.setProducer("bitGen Studio");
      const pw = deck.w * 0.75, ph = deck.h * 0.75;                  // slide px -> pt (96 dpi)
      const images = await D().loadImages(deck);
      try { if (doc.fonts && doc.fonts.ready) await doc.fonts.ready; } catch (e) { /* fine */ }
      const slides = deck.slides.filter((s) => !s.hidden);
      for (let n = 0; n < slides.length; n++) {
        const s = slides[n], notesH = withNotes ? Math.round(deck.h * 0.55) : 0;
        const c = doc.createElement("canvas"); c.width = W; c.height = Math.round((deck.h + notesH) * k);
        const g = c.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height);
        D().draw(g, s, deck, k, images);
        if (withNotes) {                                   // the notes under the slide, drawn too (any language, no font files)
          g.save(); g.scale(k, k); const pad = 40, size = 20; g.fillStyle = "#222"; g.font = `${size}px 'Segoe UI', Arial, sans-serif`;
          g.fillText(`${n + 1} / ${slides.length}`, pad, deck.h + 34); g.fillStyle = "#555"; g.fillRect(pad, deck.h + 44, deck.w - pad * 2, 1);
          let y = deck.h + 44 + size * 1.6; g.fillStyle = "#111";
          for (const p of String(s.notes || "").split("\n")) for (const l of D().wrap(g, p, deck.w - pad * 2)) { if (y > deck.h + notesH - 10) break; g.fillText(l, pad, y); y += size * 1.35; }
          g.restore();
        }
        const jpg = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.92));
        const im = await pdfDoc.embedJpg(new Uint8Array(await jpg.arrayBuffer()));
        const page = pdfDoc.addPage([pw, ph + notesH * 0.75]);
        page.drawImage(im, { x: 0, y: 0, width: pw, height: ph + notesH * 0.75 });
        ed.msg(`⤓ page ${n + 1} of ${slides.length}…`);
      }
      const bytes = await pdfDoc.save(), blob = new Blob([bytes], { type: "application/pdf" }), file = name + (withNotes ? " - notes" : "") + ".pdf";
      let kept = null; try { const r = await fetch("/api/slides/export/pdf?name=" + encodeURIComponent(file.replace(/\.pdf$/, "")), { method: "POST", headers: { "Content-Type": "application/pdf" }, body: blob }); kept = r.ok ? await r.json() : null; } catch (e) { kept = null; }
      download(blob, file);
      ed.msg(`⤓ ${file} - ${slides.length} page(s)` + (kept ? ", kept in the slides folder" : ""));
      return { name: file, pages: slides.length, size: bytes.length, kept: kept && kept.name };
    } catch (e) { ed.msg("✗ " + e.message, true); return null; }
  }
  function pdfMenu(btn) {
    const r = btn.getBoundingClientRect();
    const m = menuAt(r.left, r.bottom + 2, `<div data-p="0">📄 Slides - a page each</div><div data-p="1">🗒 Slides + speaker notes</div>`);
    m.addEventListener("click", (e) => { const it = e.target.closest("[data-p]"); if (!it) return; m.remove(); pdf(it.dataset.p === "1"); });
  }
  function menuAt(x, y, html) {
    doc.querySelectorAll(".slmenu").forEach((m) => m.remove());
    const m = doc.createElement("div"); m.className = "slmenu"; m.innerHTML = html; m.style.left = Math.round(x) + "px"; m.style.top = Math.round(y) + "px";
    doc.body.appendChild(m);
    setTimeout(() => doc.addEventListener("pointerdown", function off(e) { if (!m.contains(e.target)) { m.remove(); doc.removeEventListener("pointerdown", off, true); } }, true), 0);
    return m;
  }

  /* ---- 🖼 pictures from the project */
  function picMenu(btn) {
    const r = btn.getBoundingClientRect();
    const m = menuAt(r.left, r.bottom + 2, `<div data-s="pc">💻 From this computer…</div><div data-s="gallery">🖼 From the Gallery…</div><div data-s="assets">📁 From Assets…</div>`);
    m.addEventListener("click", (e) => { const it = e.target.closest("[data-s]"); if (!it) return; m.remove(); if (it.dataset.s === "pc") $("slPicFile").click(); else pick(it.dataset.s); });
  }
  async function listOf(src) {
    if (src === "gallery") { const r = await fetch("/api/outputs?kind=images"); const j = await r.json(); return (Array.isArray(j) ? j : []).map((f) => ({ name: f.name, url: `/outputs/${encodeURIComponent(f.name)}` })); }
    const r = await fetch("/api/passets?scope=all"); const j = await r.json(); return ((j && j.images) || []).map((f) => ({ name: f.name, url: `/passets/images/${encodeURIComponent(f.name)}` }));
  }
  async function fromUrl(url, name) {
    const r = await fetch(url); if (!r.ok) throw new Error("could not fetch " + name);
    const b = await r.blob(); return new File([b], name, { type: b.type || "image/png" });
  }
  async function pick(src) {
    doc.querySelectorAll("#slPick").forEach((p) => p.remove());
    const box = doc.createElement("div"); box.id = "slPick";
    box.innerHTML = `<div class="hd2"><b>${src === "gallery" ? "🖼 The Gallery's pictures" : "📁 Assets - pictures"}</b><input type="text" id="slPickQ" placeholder="Search" style="margin-left:auto;width:180px"><button class="ghost" type="button" data-x>✕</button></div><div class="grid"><div style="color:var(--dim)">loading…</div></div>`;
    doc.body.appendChild(box);
    const close = () => box.remove();
    box.querySelector("[data-x]").onclick = close;
    box.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") close(); });
    let list = []; try { list = await listOf(src); } catch (e) { list = []; }
    const grid = box.querySelector(".grid");
    const paint = () => {
      const q = (box.querySelector("#slPickQ").value || "").toLowerCase(), its = list.filter((f) => !q || f.name.toLowerCase().includes(q)).slice(0, 300);
      grid.innerHTML = its.length ? its.map((f) => `<figure data-u="${esc(f.url)}" data-n="${esc(f.name)}" title="${esc(f.name)}"><img loading="lazy" alt="" src="${esc(f.url)}"><figcaption data-noi18n>${esc(f.name)}</figcaption></figure>`).join("") : `<div style="color:var(--dim)">${list.length ? "nothing matches" : src === "gallery" ? "no pictures in the Gallery yet" : "no pictures in Assets yet"}</div>`;
    };
    paint(); box.querySelector("#slPickQ").oninput = paint; box.querySelector("#slPickQ").focus();
    grid.addEventListener("click", async (e) => {
      const f = e.target.closest("figure"); if (!f) return;
      close();
      try { await H().addPictures([await fromUrl(f.dataset.u, f.dataset.n)]); } catch (er) { H().msg("✗ " + er.message, true); }
    });
    return box;
  }

  function wire() {
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
    on("slImport", "click", () => $("slPptxFile").click());
    on("slPptxFile", "change", (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; importFile(f); });
    on("slPdf", "click", (e) => pdfMenu(e.currentTarget));
    on("slPresent2", "click", () => root.H3SlideShow && root.H3SlideShow.presenter(H() ? H().St.cur : 0));
    const wrap = $("slStageWrap");
    if (wrap) wrap.addEventListener("drop", (e) => { const fs = e.dataTransfer && [...e.dataTransfer.files]; const p = fs && fs.find((f) => /\.pptx$/i.test(f.name)); if (p) { e.preventDefault(); e.stopImmediatePropagation(); importFile(p); } }, true);
  }
  root.H3SlideIO = { importFile, pdf, pick, picMenu, listOf };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", wire); else setTimeout(wire, 0);
})(window);
