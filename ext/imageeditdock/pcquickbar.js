/* pcquickbar.js — THE IMAGE EDITOR'S ICON TOOLBAR + PRINT PREVIEW (2.849.0), window.PCQuickBar.
 * Tim (verbatim): "in image editor,below the file text menu add an icon menu with the tradtional shortcuts, new, save, save
 * as, print preview."
 * A row of icon buttons right under the menu bar (every view): 🗋 New · 📂 Open · 💾 Save · 💾… Save As · 🖨 Print ·
 * 🔍 Print Preview | ↶ Undo · ↷ Redo | ✂ Cut · ⧉ Copy · 📋 Paste | ✨ Create With the AI · 🪪 Character Sheet (2.930.0 - Tim:
 * "add an icon only button for character sheet in image-editor top icon only menubar": File ▸ 🪪 Character Sheet… opens the
 * Character Creator's sheet dialog - the StoryBoard's 🖼 NEW). Each runs its menu command (so
 * the menus, keys and the recorder agree), is greyed when the command can't run, and says its key in its tip.
 * Save / Save As = the project (.bgi - every page, layer and undo-able thing); File ▸ Save to Images stays in the menu.
 * File ▸ 🔍 Print Preview… (Ctrl+F2): every page drawn as it prints, at the page's size (mm), ◀ ▶, a zoom, 🖨 Print = every
 * page in one print job (each on its own sheet, the page's size, no margins).
 * Pure (Node: scripts/test-849.js): BUTTONS, paperOf, printHtml.
 */
(function (root) {
  "use strict";
  const BUTTONS = [["file.new", "🗋", "New"], ["file.open", "📂", "Open"], ["file.savebgi", "💾", "Save"], ["file.savebgias", "💾…", "Save As"], ["file.print", "🖨", "Print"], ["file.printpreview", "🔍", "Print Preview"], "|",
    ["edit.undo", "↶", "Undo"], ["edit.redo", "↷", "Redo"], "|", ["edit.cut", "✂", "Cut"], ["edit.copy", "⧉", "Copy"], ["edit.paste", "📋", "Paste"], "|", ["file.createai", "✨", "Create With the AI"],
    ["file.charsheet", "🪪", "Character Sheet"],    // 2.930.0: the Character Creator's sheet (🧍 mannequins, ✨ Lifelike, ▶ Generate sheet)
    ["file.garment", "👗", "Garment Designer"]];    // 2.932.0: 👗 sewing patterns (static/garment.js - H3Garment)
  /** a page entry (pcpages) or the picture's px -> the paper in mm {w, h} (as printed: landscape = wide) */
  function paperOf(pg, wpx, hpx) {
    if (pg && pg.wmm > 0 && pg.hmm > 0) { const a = Math.min(pg.wmm, pg.hmm), b = Math.max(pg.wmm, pg.hmm), land = pg.orient === "landscape" || (pg.orient !== "portrait" && pg.wmm > pg.hmm); return land ? { w: b, h: a } : { w: a, h: b }; }
    const dpi = (pg && pg.dpi) || 96; return { w: Math.round(wpx / dpi * 25.4 * 10) / 10, h: Math.round(hpx / dpi * 25.4 * 10) / 10 };
  }
  /** the print job's page: every picture on its own sheet of that size, no margins */
  function printHtml(urls, paper, title) {
    const t = String(title || "Print").replace(/[<>&]/g, "");
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${t}</title><style>@page{size:${paper.w}mm ${paper.h}mm;margin:0}html,body{margin:0;padding:0}`
      + `.pg{width:${paper.w}mm;height:${paper.h}mm;page-break-after:always;break-after:page;display:flex;align-items:center;justify-content:center;overflow:hidden}.pg:last-child{page-break-after:auto;break-after:auto}`
      + `.pg img{width:100%;height:100%;object-fit:contain;display:block}</style></head><body>${urls.map((u) => `<div class="pg"><img src="${u}"></div>`).join("")}</body></html>`;
  }
  const pure = { BUTTONS, paperOf, printHtml };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  function install(E) {
    const { S, doc, win } = E, say = E.say || (() => {});
    if (!E.ui || !E.ui.CMD) return;
    const kx = E.kx || (E.stage && E.stage.closest ? E.stage.closest(".kx") : null), menu = kx && kx.querySelector(".pcmenu");
    if (!menu || kx.querySelector("#pcQuickBar")) return;
    const CMD = E.ui.CMD, esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    /* ---- 🔍 Print Preview */
    async function pagesNow() {
      const out = [];
      const one = async (pg) => { const f = E.flatten(), c = E.newCanvas(f.width, f.height); c.getContext("2d").drawImage(f, 0, 0); out.push({ url: c.toDataURL("image/png"), w: f.width, h: f.height, name: pg && pg.name ? pg.name : "" }); };
      if (E.pages && E.pages.eachPage && E.pages.count && E.pages.count() > 1) await E.pages.eachPage(one); else await one(E.pages && E.pages.current ? E.pages.current() : null);
      return out;
    }
    function paperNow(p0) { const pg = E.pages && E.pages.current ? E.pages.current() : null; return paperOf(pg, p0.w, p0.h); }
    function printAll(pages, paper) {
      const f = doc.createElement("iframe"); f.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0"; f.id = "pcPrintFrame";
      doc.body.appendChild(f);
      const w = f.contentWindow, d = w.document; d.open(); d.write(printHtml(pages.map((p) => p.url), paper, S.name || "Print")); d.close();
      const go = () => { try { w.focus(); w.print(); } catch (e) { say("🖨 " + e.message); } setTimeout(() => f.remove(), 60000); };
      const imgs = [...d.images]; let left = imgs.length; if (!left) go(); else imgs.forEach((im) => { if (im.complete) { if (--left === 0) go(); } else im.onload = im.onerror = () => { if (--left === 0) go(); }; });
      say(`🖨 ${pages.length} page(s) to the printer at ${paper.w} × ${paper.h} mm - pick the printer (or Save as PDF) in the system's box`);
    }
    async function preview() {
      if (!S.w) return say("open or make a document first");
      say("🔍 drawing the pages…");
      const pages = await pagesNow(); if (!pages.length) return;
      const paper = paperNow(pages[0]); let at = Math.max(0, Math.min(pages.length - 1, E.pages && E.pages.cur ? E.pages.cur() : 0)), zoom = "fit";
      E.ui.dialog("🔍 Print Preview", `<div class="pcpv-bar"><button type="button" class="ghost" id="pcpvPrev" title="Previous page (←)">◀</button><span id="pcpvAt"></span><button type="button" class="ghost" id="pcpvNext" title="Next page (→)">▶</button>
          <span class="sp"></span><select id="pcpvZoom"><option value="fit">Whole page</option><option value="width">Page width</option><option value="all">All pages</option></select><span style="color:var(--pc-dim)">${paper.w} × ${paper.h} mm</span></div>
        <div class="pcpv-room" id="pcpvRoom"></div>`, () => { printAll(pages, paper); return true; }, { okLabel: "🖨 Print", wide: true, init: (d) => {
        const room = d.querySelector("#pcpvRoom"), ratio = paper.w / paper.h;
        const paint = () => {
          const list = zoom === "all" ? pages.map((p, i) => i) : [at];
          room.className = "pcpv-room" + (zoom === "all" ? " all" : "") + (zoom === "width" ? " width" : "");
          room.innerHTML = list.map((i) => `<div class="pcpv-sheet" style="aspect-ratio:${ratio}" data-i="${i}"><img src="${pages[i].url}" alt="Page ${i + 1}"></div>`).join("");
          d.querySelector("#pcpvAt").textContent = zoom === "all" ? `${pages.length} page(s)` : `Page ${at + 1} of ${pages.length}${pages[at].name ? " · " + pages[at].name : ""}`;
          d.querySelector("#pcpvPrev").disabled = zoom === "all" || at <= 0; d.querySelector("#pcpvNext").disabled = zoom === "all" || at >= pages.length - 1;
        };
        d.querySelector("#pcpvPrev").onclick = () => { if (at > 0) { at--; paint(); } };
        d.querySelector("#pcpvNext").onclick = () => { if (at < pages.length - 1) { at++; paint(); } };
        d.querySelector("#pcpvZoom").onchange = (e) => { zoom = e.target.value; paint(); };
        room.addEventListener("click", (e) => { const s = e.target.closest(".pcpv-sheet"); if (s && zoom === "all") { at = +s.dataset.i; zoom = "fit"; d.querySelector("#pcpvZoom").value = "fit"; paint(); } });
        d.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") d.querySelector("#pcpvPrev").click(); else if (e.key === "ArrowRight") d.querySelector("#pcpvNext").click(); });
        paint();
      } });
    }
    E.ui.addCmd("file.printpreview", "🔍 Print Preview…", "Ctrl+F2", () => preview(), { enabled: () => !!S.w }, ["File", "file.print"]);
    // 2.930.0: 🪪 the character sheet dialog (ext/videodock - the StoryBoard's "🖼 NEW" opens it, empty, on its Sheet tab)
    E.ui.addCmd("file.charsheet", "🪪 Character Sheet…", "", () => {
      const b = doc.getElementById("chNewPic");
      if (!b) return say("🪪 the character sheet is part of the StoryBoard - turn it on in Settings ▸ Dockers");
      b.click();
    }, { enabled: () => !!doc.getElementById("chNewPic") }, ["File", "file.createai"]);
    // 2.932.0: 👗 the Garment designer (static/garment.js - a dialog of the app, not of the editor)
    E.ui.addCmd("file.garment", "👗 Garment Designer…", "", () => {
      if (!root.H3Garment) return say("👗 the Garment designer is not loaded");
      root.H3Garment.open({ from: "imageeditor" });
    }, { enabled: () => !!root.H3Garment }, ["File", "file.charsheet"]);
    /* ---- the bar */
    const bar = doc.createElement("div"); bar.className = "pcquick"; bar.id = "pcQuickBar"; bar.setAttribute("role", "toolbar"); bar.setAttribute("aria-label", "Quick commands");
    const keyOf = (id) => { const c = CMD.get(id); return c && c.key ? c.key : ""; };
    bar.innerHTML = BUTTONS.map((b) => (b === "|" ? '<span class="sep"></span>' : `<button type="button" class="ghost" data-qcmd="${b[0]}" aria-label="${esc(b[2])}" title="${esc(b[2] + (keyOf(b[0]) ? " (" + keyOf(b[0]) + ")" : ""))}">${b[1]}</button>`)).join("");
    menu.insertAdjacentElement("afterend", bar);
    bar.addEventListener("mousedown", (e) => { if (e.target.closest("[data-qcmd]")) e.preventDefault(); });   // the canvas / the WP layer keep their caret
    bar.addEventListener("click", (e) => { const b = e.target.closest("[data-qcmd]"); if (!b || b.disabled) return; const id = b.dataset.qcmd; if (!CMD.get(id)) return say(`${b.getAttribute("aria-label")} is not loaded`); E.ui.run(id); paint(); });
    function paint() {
      bar.querySelectorAll("[data-qcmd]").forEach((b) => { const c = CMD.get(b.dataset.qcmd); let on = !!c; try { if (c && c.enabled) on = !!c.enabled(); } catch (e) { on = true; } b.disabled = !on; });
    }
    const css = doc.createElement("style");
    css.textContent = ".kx .pcquick{display:flex;align-items:center;gap:1px;padding:2px 8px;background:var(--pc-panel);border-bottom:1px solid var(--pc-line);flex:none}"
      + ".kx .pcquick button{min-width:28px;height:26px;padding:0 5px;font-size:15px;line-height:1;border-radius:4px}.kx .pcquick button:disabled{opacity:.35}.kx .pcquick .sep{width:1px;height:18px;background:var(--pc-line);margin:0 5px}"
      + ".pcpv-bar{display:flex;align-items:center;gap:6px;margin-bottom:8px}.pcpv-bar .sp{flex:1}.pcpv-room{height:66vh;overflow:auto;background:#5b6068;padding:16px;display:flex;flex-direction:column;align-items:center;gap:16px;border-radius:6px}"
      + ".pcpv-sheet{background:#fff;box-shadow:0 4px 16px rgba(0,0,0,.45);height:100%;max-width:100%;flex:none}.pcpv-room.width .pcpv-sheet{height:auto;width:100%}.pcpv-room.all{flex-direction:row;flex-wrap:wrap;justify-content:center;align-content:flex-start}"
      + ".pcpv-room.all .pcpv-sheet{height:240px;cursor:zoom-in}.pcpv-sheet img{width:100%;height:100%;object-fit:contain;display:block}";
    doc.head.appendChild(css);
    paint(); win.setInterval(paint, 800);
    const prev = E.ui.onRunDone; E.ui.onRunDone = function () { if (prev) prev.apply(this, arguments); paint(); };
    E.quickBar = { el: bar, paint, preview, printAll, pagesNow };
  }
  const PCQuickBar = Object.assign({ install }, pure);
  if (root && root.document) root.PCQuickBar = PCQuickBar;
})(typeof window !== "undefined" ? window : globalThis);
