/* pcviews.js — THE IMAGE EDITOR'S FOUR VIEWS ON ITS TOP STRIP: 📝 WP View · ✒ Vector View · 🖼 Image View · 🌐 Web View
 * (2.844.0), window.PCViews.
 *
 * Tim (verbatim): "when in image-editor add views to the top toolstrip - view (word layout), coredraw layout, photoshop
 * layout. don't use those titles tho, just call them WP View, Vector View and Image View, add web view".
 *
 *   One click on the top strip (or Window ▸ Workspace) lays the editor out for one kind of work. Nothing is taken away:
 *   every menu, tool and panel is still there (Window ▸ … brings any of them back); a view only picks what shows.
 *     📝 WP VIEW      a word processor: the pages one below another, fitted to the width; a ribbon - HOME (document,
 *                     styles, font, paragraph), INSERT (frames, table, picture, footnote, page numbers), LAYOUT (margins,
 *                     text wrap, figures, pages), MAILINGS, REVIEW, EXPORT; the tool column hidden (the ribbon has the
 *                     tools a writer needs); Paragraph + Layers; rulers; the WP tool.
 *     ✒ VECTOR VIEW   a drawing program: the tool column, the colour palette down the right, the dockers (Transform /
 *                     Shaping / Align / Object) + Properties + Layers, rulers, the pick (Move) tool.
 *     🖼 IMAGE VIEW   a photo editor: the tool column, Color + Properties + Layers, no palette, no dockers, one page.
 *     🌐 WEB VIEW     each page is a web page: the Pages panel, rulers, Align + Properties + Layers, and a WEB ribbon -
 *                     🌐 New Website (a 1440 x 900 px page called Home), ＋ Web Page (its name = its title in the site's
 *                     menu), 🌐 Build Website…, ⚡ Quick Preview, ⤓ .zip, a PREVIEW at 🖥 Desktop / ▭ Tablet / 📱 Phone
 *                     width inside the editor (the last build, scaled to fit), the content tools, 🗄 Database.
 *   The view last picked is kept (store ws.view) and lit on the strip; on a narrow editor the strip shows icons only.
 *
 * Pure (Node: scripts/test-844.js): VIEWS, planOf, toolFor, DEVICES, fitScale, WEB_PAGE, RIBBONS, specOf, cmdIds,
 * narrow.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  /** groups: the panel groups shown (pcpanels.js keys); tabs: brought to the front; tools / palette / rulers / pages:
   *  the tool column, the colour palette, the rulers, the Pages panel; pageMode: View ▸ Pages; ribbon: its tabs; tool */
  const VIEWS = [
    { id: "wp", icon: "📝", label: "WP View", title: "WP View - a word processor: the pages one below another, the writing ribbon (Home, Insert, Layout, Mailings, Review, Export), Paragraph and Layers",
      groups: { color: true, dock: false, props: false, layers: true }, tabs: ["pcPara", "pcLayers"], tools: false, palette: false, rulers: true, pages: false, pageMode: "column", ribbon: "wp", tool: "doctext" },
    { id: "vector", icon: "✒", label: "Vector View", title: "Vector View - drawing: the tools, the colour palette, the dockers (Transform, Shaping, Align, Object), Properties and Layers",
      groups: { color: false, dock: true, props: true, layers: true }, tabs: ["dkXf", "pcProps", "pcLayers"], tools: true, palette: true, rulers: true, pages: null, pageMode: "one", ribbon: null, tool: "move" },
    { id: "image", icon: "🖼", label: "Image View", title: "Image View - photo editing: the tools, Color, Properties and Layers",
      groups: { color: true, dock: false, props: true, layers: true }, tabs: ["pcColor", "pcProps", "pcLayers"], tools: true, palette: false, rulers: false, pages: null, pageMode: "one", ribbon: null, tool: null },
    { id: "web", icon: "🌐", label: "Web View", title: "Web View - each page is a web page: the Pages panel, the web ribbon (new site, web pages, build, preview at desktop / tablet / phone width), Align, Properties and Layers",
      groups: { color: false, dock: true, props: true, layers: true }, tabs: ["dkAlign", "pcProps", "pcLayers"], tools: true, palette: false, rulers: true, pages: true, pageMode: "one", ribbon: "web", tool: "move" },
  ];
  const planOf = (id) => VIEWS.find((v) => v.id === id) || null;
  /** the tool a view starts with: its own, else the one in use - unless that one belongs to the WP View alone */
  function toolFor(view, cur) {
    if (!view) return cur || null;
    if (view.tool) return view.tool;
    return cur === "doctext" ? "move" : (cur || null);
  }
  const DEVICES = [["desktop", "🖥", "Desktop", 1280, 800], ["tablet", "▭", "Tablet", 768, 1024], ["phone", "📱", "Phone", 390, 844]];
  /** the scale that fits a device's screen (dw x dh) into the room (aw x ah), never bigger than 1 */
  function fitScale(dw, dh, aw, ah) { if (!(dw > 0 && dh > 0 && aw > 0 && ah > 0)) return 1; return Math.min(1, aw / dw, ah / dh); }
  /** a web page: 1440 x 900 px (a page of 508 x 317.5 mm at 72 dpi) */
  const WEB_PAGE = { preset: "Custom", wmm: 508, hmm: 317.5, orient: "landscape", dpi: 72 };
  /** on a narrow editor the strip shows only the icons */
  const narrow = (w) => w > 0 && w < 1250;

  /* The ribbons as data: [kind, id, label, icon] - kind "cmd" = a menu command (E.ui.run), "tool" = a tool,
   * "fx" = a word-processor action (E.docText), "act" = one of this file's own actions */
  const RIBBONS = {
    wp: [
      { id: "home", label: "Home", groups: [
        { label: "Document", show: 3, items: [["cmd", "file.newtextdoc", "New Text Document", "📄"], ["cmd", "file.opendocx", "Open Word Document", "📂"], ["cmd", "file.tplnew", "New From Template", "🧾"], ["cmd", "layer.docedit", "Type in This WP Layer", "✎"], ["cmd", "layer.docai", "Write With the AI", "✨"]] },
        { label: "Styles", show: 4, items: [["fx", "style:normal", "Normal", "¶"], ["fx", "style:h1", "Heading 1", "H1"], ["fx", "style:h2", "Heading 2", "H2"], ["fx", "style:h3", "Heading 3", "H3"], ["fx", "style:title", "Title", "𝐓"], ["fx", "style:quote", "Quote", "❝"]] },
        { label: "Font", inline: true, items: [["fx", "bold", "Bold", "𝐁"], ["fx", "italic", "Italic", "𝐼"], ["fx", "underline", "Underline", "U̲"], ["fx", "strikeThrough", "Strikethrough", "S̶"], ["fx", "subscript", "Subscript", "x₂"], ["fx", "superscript", "Superscript", "x²"], ["fx", "removeFormat", "Clear Formatting", "⌫"]] },
        { label: "Paragraph", inline: true, items: [["fx", "insertUnorderedList", "Bullets", "•≡"], ["fx", "insertOrderedList", "Numbering", "1≡"], ["fx", "outdent", "Decrease Indent", "⇤"], ["fx", "indent", "Increase Indent", "⇥"],
          ["fx", "justifyLeft", "Align Left", "⯇≡"], ["fx", "justifyCenter", "Centre", "≡"], ["fx", "justifyRight", "Align Right", "≡⯈"], ["fx", "justifyFull", "Justify", "☰"]] },
      ] },
      { id: "insert", label: "Insert", groups: [
        { label: "Pages", show: 2, items: [["cmd", "page.add", "Add Page", "＋"], ["cmd", "flow.next", "Frame on the Next Page", "⤓"]] },
        { label: "Text", show: 3, items: [["cmd", "layer.newdocframe", "WP Layer", "📄"], ["tool", "type", "Text", "T"], ["cmd", "flow.here", "Add Frame Here", "⬚"]] },
        { label: "Tables", show: 1, items: [["cmd", "doc.table.insert", "Table", "▦"]] },
        { label: "Illustrations", show: 2, items: [["cmd", "file.place", "Picture", "🖼"], ["tool", "shape", "Shape", "◼"]] },
        { label: "Notes", show: 2, items: [["cmd", "doc.fn.new", "Footnote", "¹"], ["cmd", "doc.comment.new", "Comment", "💬"]] },
        { label: "Header & Footer", show: 2, items: [["cmd", "page.number", "Page Numbers", "#"], ["cmd", "page.master", "Master Page", "⌂"]] },
      ] },
      { id: "layout", label: "Layout", groups: [
        { label: "Page", show: 2, items: [["cmd", "layer.docmargins", "Margins", "📏"], ["act", "pagesetup", "Page Setup", "📐"]] },
        { label: "Arrange", show: 4, items: [["cmd", "figure.full", "Figure: Full Width", "▭"], ["cmd", "figure.left", "Figure Left", "◧"], ["cmd", "figure.right", "Figure Right", "◨"], ["cmd", "flow.wrap", "Text Wrap", "⧉"], ["cmd", "figure.bigger", "Figure Bigger", "＋"], ["cmd", "figure.smaller", "Figure Smaller", "－"]] },
        { label: "Pages", show: 4, items: [["cmd", "view.pages.column", "One Below Another", "▯"], ["cmd", "view.pages.one", "One Page", "▢"], ["cmd", "view.pages.two", "Two Pages", "▢▢"], ["cmd", "view.pages.many", "Many Pages", "▦"], ["cmd", "win.pages", "Pages Panel", "▤"]] },
      ] },
      { id: "mailings", label: "Mailings", groups: [
        { label: "Mail Merge", show: 4, items: [["cmd", "doc.merge.source", "Data Source", "📇"], ["cmd", "doc.merge.field", "Insert Merge Field", "«»"], ["cmd", "doc.merge.preview", "Preview Results", "👁"], ["cmd", "doc.merge.prev", "Previous Record", "◀"], ["cmd", "doc.merge.next", "Next Record", "▶"], ["cmd", "doc.merge.finish", "Finish & Merge", "🖨"]] },
        { label: "Templates", show: 2, items: [["cmd", "file.tplfill", "Fill This Template", "🧾"], ["cmd", "file.tplsave", "Save as Template", "💾"]] },
      ] },
      { id: "review", label: "Review", groups: [
        { label: "Comments", show: 3, items: [["cmd", "doc.comment.new", "New Comment", "💬"], ["cmd", "doc.comment.panel", "Comments", "🗨"], ["cmd", "view.showcomments", "Show Comments", "👁"]] },
        { label: "Footnotes", show: 2, items: [["cmd", "doc.fn.new", "Insert Footnote", "¹"], ["cmd", "doc.fn.edit", "Edit Footnote", "✎"]] },
        { label: "AI", show: 1, items: [["cmd", "layer.docai", "Write With the AI", "✨"]] },
      ] },
      { id: "export", label: "Export", groups: [
        { label: "Save As", show: 3, items: [["cmd", "file.exportdocx", "Word Document", "⤓"], ["cmd", "file.exportdtp", "PDF / AI / SVG", "⤓"], ["cmd", "file.print", "Print", "🖨"]] },
      ] },
    ],
    web: [
      { id: "web", label: "Web", groups: [
        { label: "Site", show: 3, items: [["act", "newsite", "New Website", "🌐"], ["act", "newpage", "Web Page", "＋"], ["cmd", "win.pages", "Pages Panel", "▤"]] },
        { label: "Build", show: 3, items: [["cmd", "file.website", "Build Website", "🌐"], ["act", "quick", "Quick Preview", "⚡"], ["act", "zip", "Download .zip", "⤓"]] },
        { label: "Preview", show: 3, items: [["act", "dev:desktop", "Desktop", "🖥"], ["act", "dev:tablet", "Tablet", "▭"], ["act", "dev:phone", "Phone", "📱"], ["act", "open", "Open in the Browser", "↗"]] },
        { label: "Content", show: 4, items: [["tool", "type", "Text", "T"], ["cmd", "layer.newdocframe", "Text Block", "📄"], ["cmd", "file.place", "Picture", "🖼"], ["tool", "shape", "Shape", "◼"], ["cmd", "layer.docai", "Write With the AI", "✨"]] },
        { label: "Arrange", show: 2, items: [["cmd", "dk.align", "Align", "⊟"], ["cmd", "dk.transform", "Transform", "⤧"]] },
        { label: "Data", show: 1, items: [["act", "db", "Database", "🗄"]] },
      ] },
    ],
  };
  /** a ribbon's tabs as CadBar's spec: make(kind, id, label, icon) -> an item (or null = left out) */
  function specOf(tabs, make) {
    return { tabs: (tabs || []).map((t) => ({ id: t.id, label: t.label, groups: t.groups.map((g) => ({ label: g.label, show: g.show, inline: g.inline, items: g.items.map((it) => make(it[0], it[1], it[2], it[3])).filter(Boolean) })) })) };
  }
  /** every menu command a ribbon uses */
  const cmdIds = (tabs) => { const out = new Set(); for (const t of tabs || []) for (const g of t.groups) for (const it of g.items) if (it[0] === "cmd") out.add(it[1]); return [...out]; };

  const pure = { VIEWS, planOf, toolFor, DEVICES, fitScale, WEB_PAGE, RIBBONS, specOf, cmdIds, narrow };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ================================ the page ================================ */
  function install(E) {
    const { S, doc, win, store } = E, say = E.say || (() => {});
    const kx = E.kx || (E.stage && E.stage.closest ? E.stage.closest(".kx") : null);
    if (!kx || !E.ui || !E.ui.addCmd || !E.ui.CMD) return;
    const CMD = E.ui.CMD, $ = (id) => doc.getElementById(id);
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const css = doc.createElement("style");
    css.textContent = ".pcmenu .pcviews{display:inline-flex;align-items:center;gap:0;margin-right:6px;padding-right:8px;border-right:1px solid var(--pc-line)}"
      + ".pcmenu .mr .pcviews button{border-radius:0;margin-left:-1px;white-space:nowrap}.pcmenu .mr .pcviews button:first-child{border-radius:5px 0 0 5px;margin-left:0}.pcmenu .mr .pcviews button:last-child{border-radius:0 5px 5px 0}"
      + ".pcmenu .mr .pcviews button.on{border-color:var(--pc-accent);color:var(--pc-accent);background:var(--pc-on,rgba(245,158,44,.12));position:relative;z-index:1}"
      + ".pcviews .vi{margin-right:4px}.kx.pcvw-narrow .pcviews .vl{display:none}.kx.pcvw-narrow .pcviews .vi{margin-right:0}"
      + ".pcwebpv{position:absolute;z-index:40;display:flex;flex-direction:column;background:rgba(10,10,12,.92);border:1px solid var(--pc-line);border-radius:6px;overflow:hidden}"
      + ".pcwebpv .wpbar{display:flex;align-items:center;gap:4px;padding:4px 6px;background:var(--pc-panel);border-bottom:1px solid var(--pc-line);font-size:11px;color:var(--pc-dim);flex:none}"
      + ".pcwebpv .wpbar button{font-size:11px}.pcwebpv .wpbar button.on{border-color:var(--pc-accent);color:var(--pc-accent)}.pcwebpv .wpbar .sp{flex:1}"
      + ".pcwebpv .wproom{flex:1;position:relative;overflow:hidden}.pcwebpv .wpdev{position:absolute;left:50%;top:10px;transform-origin:top center;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.6);border-radius:4px;overflow:hidden}"
      + ".pcwebpv iframe{border:0;width:100%;height:100%;display:block;background:#fff}.pcwebpv .wpmsg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:13px;text-align:center;padding:20px}";
    doc.head.appendChild(css);

    /* ---- what a command / a tool is doing now */
    const can = (id) => { const c = CMD.get(id); return !!c && (!c.enabled || !!c.enabled()); };
    const isOn = (id) => { const c = CMD.get(id); return !!(c && c.checked && c.checked()); };
    /** a checkable command made to be on / off (its own run switches it) */
    function setChecked(id, want) { const c = CMD.get(id); if (!c || !c.checked || want == null) return; if (!!c.checked() !== !!want) { try { c.run(); } catch (e) { /* fine */ } } }

    /* ---- the WP actions */
    const DT = () => E.docText || null;
    function fx(a) {
      const T = DT(); if (!T) return say("the word processor is not loaded");
      if (!(T.editing && T.editing())) { const L = E.layer && E.layer(); if (L && L.type === "doc" && T.wpMode) T.wpMode(L); else return say("click into a WP layer first (📄 WP Layer makes one)"); }
      if (a.startsWith("style:")) return T.setStyle ? T.setStyle(a.slice(6)) : T.exec("formatBlock", a.slice(6) === "normal" ? "p" : a.slice(6));
      if ((a === "indent" || a === "outdent") && T.indent) return T.indent(a === "indent" ? 1 : -1);
      T.exec(a);
    }

    /* ---- the web actions */
    const lastSite = () => { try { return JSON.parse(store.get("site.last", "{}")) || {}; } catch (e) { return {}; } };
    const siteName = () => lastSite().name || (S.name ? String(S.name).replace(/\.\w+$/, "") : "") || "My website";
    function newSite() {
      if (!E.pages || !E.pages.newDocument) return say("pages are not loaded");
      E.ui.dialog("🌐 New Website", `<div class="rw"><span>Name</span><input id="wvName" value="${esc(siteName())}" style="flex:1"></div>
        <div style="color:var(--pc-dim);margin-top:6px">A document whose pages are web pages, 1440 × 900 px each. The first page is Home; ＋ Web Page adds the next one (its name is its title in the site's menu). Then 🌐 Build Website.</div>`, (d) => {
        const n = d.querySelector("#wvName").value.trim() || "My website";
        E.pages.newDocument(WEB_PAGE, 1, n);
        if (E.pages.rename) E.pages.rename(0, "Home");
        store.set("site.last", JSON.stringify(Object.assign(lastSite(), { name: n, title: lastSite().title || n })));
        say(`🌐 "${n}" - its Home page is ready (1440 × 900 px); ＋ Web Page adds the next page`);
      }, { okLabel: "🌐 Make It" });
    }
    function newPage() {
      if (!S.w) return newSite();
      E.ui.dialog("＋ Web Page", `<div class="rw"><span>Page name</span><input id="wvPage" value="" placeholder="About, Products, Contact…" style="flex:1"></div>
        <div style="color:var(--pc-dim);margin-top:6px">The name is the page's title in the site's menu.</div>`, (d) => {
        const n = d.querySelector("#wvPage").value.trim();
        if (E.pages && E.pages.add) E.pages.add({ name: n || "" });
        if (n && E.pages && E.pages.rename && E.pages.cur) E.pages.rename(E.pages.cur(), n);
      }, { okLabel: "＋ Add", init: (d) => { const i = d.querySelector("#wvPage"); if (i) setTimeout(() => i.focus(), 0); } });
    }
    const previewUrl = () => "/sites-preview/" + encodeURIComponent(siteName()) + "/index.html";

    /* ---- the preview inside the editor: the last build at a device's width */
    let pv = null, dev = store.get("ws.dev", "desktop"), src = "";
    function placePv() {
      if (!pv) return;
      const st = E.stage.getBoundingClientRect(), k = kx.getBoundingClientRect();
      Object.assign(pv.style, { left: st.left - k.left + 6 + "px", top: st.top - k.top + 6 + "px", width: Math.max(200, st.width - 12) + "px", height: Math.max(160, st.height - 12) + "px" });
      const d = DEVICES.find((x) => x[0] === dev) || DEVICES[0], room = pv.querySelector(".wproom"), box = pv.querySelector(".wpdev");
      const s = fitScale(d[3], d[4], room.clientWidth - 20, room.clientHeight - 20);
      Object.assign(box.style, { width: d[3] + "px", height: d[4] + "px", transform: `translateX(-50%) scale(${s})` });
      pv.querySelector(".wpsize").textContent = `${d[2]} · ${d[3]} × ${d[4]} px${s < 1 ? ` · shown at ${Math.round(s * 100)} %` : ""}`;
      pv.querySelectorAll("[data-dev]").forEach((b) => b.classList.toggle("on", b.dataset.dev === dev));
    }
    function preview(device, url) {
      if (device) { dev = device; store.set("ws.dev", dev); }
      if (url) src = url;
      if (!src) src = previewUrl();
      if (!pv) {
        pv = doc.createElement("div"); pv.className = "pcwebpv"; pv.id = "pcWebPreview";
        pv.innerHTML = `<div class="wpbar">${DEVICES.map(([id, ic, n]) => `<button class="ghost" data-dev="${id}" title="${n}">${ic} ${n}</button>`).join("")}<span class="wpsize"></span><span class="sp"></span>`
          + `<button class="ghost" data-a="quick" title="Build again without the AI (quick) and show it">⚡ Rebuild</button><button class="ghost" data-a="ai" title="Build with the AI making each page responsive, then show it">✨ Build With the AI</button>`
          + `<button class="ghost" data-a="open" title="Open the preview in the browser">↗</button><button class="ghost" data-a="close" title="Close the preview">✕</button></div>`
          + `<div class="wproom"><div class="wpdev"><iframe sandbox="allow-same-origin" title="Website preview"></iframe></div><div class="wpmsg" style="display:none"></div></div>`;
        kx.appendChild(pv);
        pv.querySelectorAll("[data-dev]").forEach((b) => { b.onclick = () => preview(b.dataset.dev); });
        pv.querySelector('[data-a="close"]').onclick = closePv;
        pv.querySelector('[data-a="open"]').onclick = () => win.open(src, "_blank");
        pv.querySelector('[data-a="quick"]').onclick = () => quick(false);
        pv.querySelector('[data-a="ai"]').onclick = () => quick(true);
        win.addEventListener("resize", placePv);
      }
      pv.style.display = "";
      const fr = pv.querySelector("iframe"), want = src + (src.includes("?") ? "&" : "?") + "t=" + Date.now();
      fr.onload = () => { const m = pv.querySelector(".wpmsg"); let bad = false; try { const t = fr.contentDocument && fr.contentDocument.body && fr.contentDocument.body.textContent || ""; bad = /^\s*(not found|no such|.{0,40}not built)/i.test(t) && t.length < 200; } catch (e) { /* fine */ } m.style.display = bad ? "" : "none"; if (bad) m.textContent = "Nothing built yet - ⚡ Rebuild (quick) or ✨ Build With the AI"; };
      fr.src = want;
      placePv();
    }
    function closePv() { if (pv) pv.style.display = "none"; }
    async function quick(ai) {
      if (!E.site || !E.site.build) return say("the website builder is not loaded");
      if (!S.w) return say("make a website first - 🌐 New Website");
      const l = lastSite(), n = siteName();
      try {
        const r = await E.site.build({ name: n, title: l.title || n, stack: l.stack || "static", lang: l.lang || "en", ai: !!ai, open: false });
        preview(null, r.preview || previewUrl());
      } catch (e) { say("🌐 " + e.message); }
    }
    function database() { const b = $("tX_dbdock"); if (b) b.click(); else say("the 🗄 Database docker is not installed"); }

    function act(a) {
      if (a === "newsite") return newSite();
      if (a === "newpage") return newPage();
      if (a === "quick") return quick(false);
      if (a === "zip") { win.location.href = "/api/sites/zip?name=" + encodeURIComponent(siteName()); return; }
      if (a === "open") return win.open(previewUrl(), "_blank");
      if (a.startsWith("dev:")) return preview(a.slice(4), previewUrl());
      if (a === "db") return database();
      if (a === "pagesetup") return E.pages && E.pages.setupDialog ? E.pages.setupDialog() : say("pages are not loaded");
    }

    /* ---- the ribbon (static/cadbar.js), over the tool options */
    const make = (kind, id, label, icon) => {
      const key = "v_" + kind + "_" + id.replace(/[^\w]/g, "_");
      if (kind === "cmd") return { id: key, label, icon, run: () => E.ui.run(id), enabled: () => can(id), active: () => isOn(id), hidden: () => !CMD.get(id) };
      if (kind === "tool") return { id: key, label, icon, run: () => { if (!S.w) return say("open or make a document first"); E.setTool(id); }, active: () => S.tool === id, hidden: () => !(E.tools && E.tools[id]) && !(E.TOOLS || []).some((t) => (Array.isArray(t) ? t[0] : t && t.id) === id) };
      if (kind === "fx") return { id: key, label, icon, run: () => fx(id), enabled: () => !!(DT() && S.w) };
      if (kind === "act") return { id: key, label, icon, run: () => act(id), active: () => (id.startsWith("dev:") ? !!(pv && pv.style.display !== "none" && dev === id.slice(4)) : false) };
      return null;
    };
    let ribbon = null, ribbonFor = null;
    const bar = $("kxBar");
    function ensureRibbon(cb) {
      if (ribbon) return cb(ribbon);
      const go = () => {
        if (ribbon || !root.CadBar || !bar || !bar.parentNode) { if (ribbon) cb(ribbon); return; }
        ribbon = root.CadBar.create(bar.parentNode, { tabs: [] }, { store, key: "ws.ribbon" });
        ribbon.el.classList.add("pcribbon"); ribbon.el.id = "pcViewRibbon";
        // the writing buttons keep the caret where it is in the WP layer (no focus taken)
        ribbon.el.addEventListener("mousedown", (e) => { const b = e.target.closest && e.target.closest('.cbb[data-id^="v_fx_"]'); if (b) e.preventDefault(); });
        bar.parentNode.insertBefore(ribbon.el, bar);
        cb(ribbon);
      };
      if (root.CadBar) go(); else { const s = doc.createElement("script"); s.src = "/static/cadbar.js"; s.onload = go; doc.head.appendChild(s); }
    }
    function showRibbon(which) {
      if (!which) { if (ribbon) ribbon.el.style.display = "none"; ribbonFor = null; return; }
      ensureRibbon((r) => {
        if (ribbonFor !== which) { r.setSpec(specOf(RIBBONS[which], make)); ribbonFor = which; }
        r.el.style.display = ""; r.refresh();
      });
    }

    /* ---- the strip */
    const mr = kx.querySelector(".pcmenu .mr");
    const strip = doc.createElement("span"); strip.className = "pcviews"; strip.id = "pcViews"; strip.setAttribute("role", "group"); strip.setAttribute("aria-label", "Views");
    strip.innerHTML = VIEWS.map((v) => `<button type="button" class="ghost" data-view="${v.id}" title="${esc(v.title)}"><span class="vi">${v.icon}</span><span class="vl">${esc(v.label)}</span></button>`).join("");
    if (mr) mr.insertBefore(strip, mr.firstChild);
    let current = store.get("ws.view", null);
    const paint = () => strip.querySelectorAll("[data-view]").forEach((b) => { const on = b.dataset.view === current; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
    strip.addEventListener("click", (e) => { const b = e.target.closest("[data-view]"); if (b) apply(b.dataset.view); });

    /** lay the editor out for a view */
    function apply(id, quiet) {
      const v = planOf(id); if (!v) return false;
      if (E.panels) for (const [g, on] of Object.entries(v.groups)) { try { if (on) E.panels.open(g); else if (E.panels.visible(g)) E.panels.close(g, true); } catch (e) { /* that group is not here */ } }
      if (E.ui.showTab) for (const t of v.tabs) { if ($(t)) { try { E.ui.showTab(t); } catch (e) { /* fine */ } } }
      setChecked("win.tools", v.tools);
      setChecked("win.palette", v.palette);
      setChecked("view.rulers", v.rulers);
      if (v.pages != null && S.w) setChecked("win.pages", v.pages);
      if (E.pageView && E.pageView.setMode && E.pageView.mode() !== v.pageMode) E.pageView.setMode(v.pageMode, true);
      showRibbon(v.ribbon);
      if (v.id !== "web") closePv();
      const t = toolFor(v, S.tool);
      if (S.w && t && t !== S.tool && E.setTool) { try { E.setTool(t); } catch (e) { /* fine */ } }
      current = v.id; store.set("ws.view", current); paint();
      if (!quiet) say(`${v.icon} ${v.label}` + (v.id === "wp" ? " - the writing ribbon; 📄 WP Layer or New Text Document to start" : v.id === "web" ? " - each page is a web page; 🌐 New Website, ＋ Web Page, 🖥 ▭ 📱 preview" : v.id === "vector" ? " - the palette (left click = fill, right click = outline) and the dockers" : " - the tools, Color, Properties and Layers"));
      return true;
    }
    for (const v of VIEWS) E.ui.addCmd("ws." + v.id, v.icon + " " + v.label, "", () => apply(v.id), { checked: () => current === v.id });
    const W = E.ui.MENUS.find(([n]) => n === "Window");
    if (W) { const at = W[1].findIndex((x) => x && typeof x === "object" && x.label === "Arrange"); W[1].splice(at + 1, 0, { label: "Workspace", items: VIEWS.map((v) => "ws." + v.id) }); }   // after Arrange (or first)
    // the ribbon follows the work (a WP layer picked, a tool changed) - its lit buttons
    E.overlayHooks.push(() => { if (ribbon && ribbonFor && ribbon.el.style.display !== "none") ribbon.refresh(); });
    // a narrow editor: icons only
    const fitStrip = () => kx.classList.toggle("pcvw-narrow", narrow(kx.clientWidth));
    if (root.ResizeObserver) new root.ResizeObserver(() => { fitStrip(); if (pv && pv.style.display !== "none") placePv(); }).observe(kx); else win.addEventListener("resize", fitStrip);
    fitStrip();
    // the view kept: its ribbon back (the panels, palette and rulers keep themselves)
    if (planOf(current)) { paint(); showRibbon(planOf(current).ribbon); } else current = null;
    E.views = { apply, current: () => current, preview, closePreview: closePv, quick, ribbon: () => ribbon, VIEWS };
  }
  const PCViews = Object.assign({ install }, pure);
  if (root && root.document) root.PCViews = PCViews;
})(typeof window !== "undefined" ? window : globalThis);
