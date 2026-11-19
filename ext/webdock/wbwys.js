/* bitGen Studio — ext/webdock/wbwys.js (2.866.0): the WYSIWYG tab's ◧ block toolbar + 📱 phone / tablet layout + the top bar's auto-hide
 * (Tim: "add a left toolbar to the wsiwyg tab icon only with gallery - sub types of gallery, calendar, booking sheets, product images,
 * category, hero banner, header, footer add a conver layout for phone and lablet button to top toolbar (top toolbar will have checkbox to
 * auto hide)").
 *   ◧ blocks   icon-only buttons left of the page: 🖼 gallery ▸ (pictures / video / audio / 3D), 📅 calendar (the booking widget),
 *              📋 booking sheet (a request form -> ✉ Messages), 🛍 product pictures, 🗂 category ▸ (the CRM's categories), 🦸 hero banner,
 *              ⎺ header, ⎽ footer. Each puts its markup at the cursor (header at the top, footer at the end), copies its skill's files into
 *              www (/api/web/skills/add) and adds the style sheet + script once. Blocks that are filled on the site (scripts are off here)
 *              show as dashed boxes with their name - only in the editor.
 *   📱 layout  the open page made for phones and tablets: the viewport line + <style id="bg-responsive"> (two columns under 1024 px, one
 *              under 640 px, pictures / tables fit, the page's own fixed widths and absolute places let go) - pressed again = updated;
 *              🖥 ▭ 📱 widths on the WYSIWYG bar show it.
 *   ⇡ auto-hide the Web editor's top bar folds to a thin strip until the pointer is on it (localStorage wb.autohide).
 * window.WbWys = {BLOCKS, responsive, place} - responsive() / place() are pure (Node). */
(function (root) {
  "use strict";
  const RESP_CSS = `/* bitGen Studio: phone + tablet layout (📱 in the Web editor - pressed again it is written anew) */
img, video, iframe, canvas, svg { max-width: 100%; height: auto; }
table { max-width: 100%; }
@media (max-width: 1024px) {
  .bg-grid, .bg-products, .bg-blog-list, .bg-pics, [class*="grid"] { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  main, section, header, footer, .bg-wrap { padding-left: 16px; padding-right: 16px; box-sizing: border-box; }
  h1 { font-size: clamp(1.8rem, 5vw, 2.6rem); }
  [style*="width:"] { max-width: 100% !important; }
}
@media (max-width: 640px) {
  .bg-grid, .bg-products, .bg-blog-list, .bg-pics, [class*="grid"] { grid-template-columns: 1fr !important; }
  .bg-cols, .bg-contact, .bg-book-row, [class*="cols"], [class*="row"] { display: block !important; }
  .bg-cols > *, [class*="col-"] { width: auto !important; max-width: 100% !important; margin-bottom: 14px; }
  [style*="position: absolute"], [style*="position:absolute"] { position: static !important; transform: none !important; }
  [style*="width:"] { width: auto !important; }
  table { display: block; overflow-x: auto; }
  nav { display: flex; flex-wrap: wrap; gap: 8px; }
  body { font-size: 16px; } h1 { font-size: 1.8rem; } h2 { font-size: 1.4rem; }
}`;
  /** the page made for phones + tablets: the viewport line once, the bg-responsive style written anew */
  function responsive(text) {
    let t = String(text || "");
    if (!/<meta[^>]+name=["']viewport["']/i.test(t)) t = /<head[^>]*>/i.test(t) ? t.replace(/<head[^>]*>/i, (m) => m + '\n  <meta name="viewport" content="width=device-width, initial-scale=1">') : '<meta name="viewport" content="width=device-width, initial-scale=1">\n' + t;
    const block = `<style id="bg-responsive">\n${RESP_CSS}\n</style>`;
    if (/<style id="bg-responsive">[\s\S]*?<\/style>/i.test(t)) return t.replace(/<style id="bg-responsive">[\s\S]*?<\/style>/i, block);
    return /<\/head>/i.test(t) ? t.replace(/<\/head>/i, "  " + block + "\n</head>") : block + "\n" + t;
  }
  /** a block put in its place in the page's text: top = after <body…> (after an existing header no), end = before the scripts at </body> */
  function place(text, html, where) {
    const t = String(text || "");
    if (where === "top") { const m = /<body\b[^>]*>/i.exec(t); return m ? t.slice(0, m.index + m[0].length) + "\n" + html + t.slice(m.index + m[0].length) : html + "\n" + t; }
    if (where === "end") {
      const end = t.search(/<\/body>/i); if (end < 0) return t + "\n" + html;
      let at = end; const sc = /(\s*<script\b[^>]*>[\s\S]*?<\/script>)+\s*$/i.exec(t.slice(0, end)); if (sc) at = sc.index;
      return t.slice(0, at) + "\n" + html + t.slice(at);
    }
    return t;
  }
  const SHEET = `<form class="bg-contact-form bg-booking-sheet" data-bg-contact>
  <h2>Book a table</h2>
  <input type="hidden" name="subject" value="Booking request">
  <label>Your name <input name="name" required maxlength="120" autocomplete="name"></label>
  <label>Email <input name="email" type="email" required maxlength="200" autocomplete="email"></label>
  <label>Phone <input name="phone" maxlength="40" autocomplete="tel"></label>
  <label>Day <input name="day" type="date" required></label>
  <label>Time <input name="time" type="time" required></label>
  <label>How many people <input name="people" type="number" min="1" max="50" value="2"></label>
  <label>Anything we should know <textarea name="message" rows="3" maxlength="2000"></textarea></label>
  <div class="bg-hp" aria-hidden="true"><input name="website" tabindex="-1" autocomplete="off"></div>
  <button class="bg-btn" type="submit">Send the booking request</button>
  <div class="bg-contact-msg" role="status"></div>
</form>`;
  const HERO = `<section class="bg-hero">
  <div class="bg-wrap"><h1>A big, clear headline</h1><p class="bg-dim">One line that says what you do.</p><a class="bg-btn" href="contact.html">Get in touch</a></div>
</section>`;
  const HEADER = `<header class="bg-header">
  <div class="bg-wrap">
    <a class="bg-brand" href="index.html">My site</a>
    <button class="bg-menu-btn" type="button" aria-label="Menu" aria-expanded="false">☰</button>
    <nav class="bg-nav"><a href="index.html">Home</a><a href="shop.html">Shop</a><a href="blog.html">News</a><a href="contact.html">Contact</a></nav>
  </div>
</header>`;
  const FOOTER = `<footer class="bg-footer"><div class="bg-wrap">© My site · <a href="contact.html">Contact</a></div></footer>`;
  // id, icon, title, the skill whose files it needs, its markup (null = the skill's own snippet), where (cursor | top | end), sub menu
  const BLOCKS = [
    { id: "gallery", icon: "🖼", title: "Gallery", sub: [["gallery-pictures", "🖼", "Picture gallery"], ["gallery-video", "🎬", "Video gallery"], ["gallery-audio", "🎵", "Audio playlist"], ["gallery-3d", "🧊", "3D model gallery"]] },
    { id: "calendar", icon: "📅", title: "Calendar - visitors book a free time", skill: "booking", html: null },
    { id: "sheet", icon: "📋", title: "Booking sheet - a request form that lands in ✉ Messages", skill: "contact-map", html: SHEET },
    { id: "products", icon: "🛍", title: "Product pictures - the shop's products as pictures", skill: "categories", html: '<div data-bg-catalog data-view="pictures"></div>' },
    { id: "category", icon: "🗂", title: "Category - one category of the shop", skill: "categories", cats: true },
    { id: "hero", icon: "🦸", title: "Hero banner", skill: "layout", html: HERO },
    { id: "header", icon: "⎺", title: "Header with the menu (at the top)", skill: "layout", html: HEADER, where: "top" },
    { id: "footer", icon: "⎽", title: "Footer (at the end)", skill: "layout", html: FOOTER, where: "end" }];
  const PH_CSS = `[data-bg-catalog]:empty, [data-bg-book]:empty, [data-bg-blog]:empty, [data-bg-blog-latest]:empty, [data-bg-map]:empty, [data-bg-product]:empty, [data-bg-cart]:empty {
  display: flex; align-items: center; justify-content: center; min-height: 90px; margin: 8px 0; border: 2px dashed #8c96a8; border-radius: 10px; color: #6b7686; font: 13px system-ui, sans-serif; }
[data-bg-catalog]:empty::before { content: "🛍 the shop's products - filled on the site"; } [data-bg-catalog][data-view="pictures"]:empty::before { content: "🛍 the products' pictures - filled on the site"; }
[data-bg-catalog][data-category]:empty::before { content: "🗂 a category of the shop - filled on the site"; }
[data-bg-book]:empty::before { content: "📅 the booking calendar - filled on the site"; } [data-bg-blog]:empty::before, [data-bg-blog-latest]:empty::before { content: "📰 the news - filled on the site"; }
[data-bg-map]:empty::before { content: "📍 the map - shown on the site"; } [data-bg-product]:empty::before { content: "🏷 a product - filled on the site"; } [data-bg-cart]:empty::before { content: "🧾 the cart - filled on the site"; }`;
  const pure = { BLOCKS, responsive, place, RESP_CSS, PH_CSS };
  if (typeof module !== "undefined" && module.exports && typeof window === "undefined") { module.exports = pure; return; }

  const doc = root.document, $ = (id) => doc.getElementById(id), W = () => root.H3Web;
  const msg = (t, err) => { const m = $("wbMsg"); if (m) { m.textContent = t || ""; m.classList.toggle("err", !!err); } };
  const escA = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  async function api(u, body) {
    const r = await root.fetch(u, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
    const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status); return j;
  }
  const isHtml = (p) => /\.html?$/i.test(p || "") || /\.php$/i.test(p || "");
  /** put a block in: the skill's files into www, the markup at the cursor (or top / end), its style sheet + script once */
  async function add(skillId, html, where, label) {
    const st = W().state(); if (!st.path || !isHtml(st.path)) return msg("open a page first - the blocks go into the open page", true);
    let r; try { r = await api("/api/web/skills/add", { id: skillId }); } catch (e) { return msg("✗ " + e.message, true); }
    const markup = html || r.snippet, f = $("wbWys"), d = f && f.contentDocument, inWys = st.tab === "wys" && d && d.designMode === "on";
    let t;
    if (!where && inWys && d.getSelection().rangeCount && d.body.contains(d.getSelection().anchorNode)) {
      f.contentWindow.focus(); d.execCommand("insertHTML", false, markup); st.wysDirty = true; t = W().currentText();
    } else {
      t = W().currentText();
      if (where) t = place(t, markup, where);
      else { const c = $("wbCode"); t = W().addToPage(t, st.path, { snippet: markup }, st.tab === "code" && c ? c.selectionStart : null); }
    }
    t = W().addToPage(t, st.path, { head: r.head, scripts: r.scripts, snippet: "" }, 0);
    W().setText(t);
    msg(`${label} added to ${st.path}${r.copied.length ? ` - ${r.copied.length} file(s) into www` : ""} · 💾 Save to keep it`);
    if (root.H3TestEvent) { try { root.H3TestEvent("web_block", skillId); } catch (e) { /* the 🧪 list */ } }
  }
  function flyout(btn, items) {
    closeFly();
    const m = doc.createElement("div"); m.id = "wbBlkFly";
    m.innerHTML = items.length ? items.map((it, i) => `<button type="button" class="ghost" data-i="${i}">${it.icon || ""} ${escA(it.label)}</button>`).join("") : '<span style="font-size:11px;color:var(--dim);padding:4px">No categories yet - give products a category in 🗂 CRM ▸ 🛍 Products</span>';
    const r = btn.getBoundingClientRect(), host = $("webdock").getBoundingClientRect();
    m.style.left = (r.right - host.left + 4) + "px"; m.style.top = (r.top - host.top) + "px";
    $("webdock").appendChild(m);
    m.addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (!b) return; closeFly(); items[+b.dataset.i].go(); });
    setTimeout(() => doc.addEventListener("mousedown", outside), 0);
  }
  function outside(e) { const m = $("wbBlkFly"); if (m && !m.contains(e.target)) closeFly(); }
  function closeFly() { const m = $("wbBlkFly"); if (m) m.remove(); doc.removeEventListener("mousedown", outside); }
  async function click(b) {
    const B = BLOCKS.find((x) => x.id === b.dataset.blk); if (!B) return;
    if (B.sub) return flyout(b, B.sub.map(([id, icon, label]) => ({ icon, label, go: () => add(id, null, null, label) })));
    if (B.cats) {
      let cats = []; try { cats = Array.from(new Set((await api("/api/web/records?kind=products")).items.map((p) => p.category).filter(Boolean))).sort(); } catch (e) { /* none */ }
      return flyout(b, cats.map((c) => ({ icon: "🗂", label: c, go: () => add("categories", `<div data-bg-catalog data-category="${escA(c)}"></div>`, null, "🗂 " + c) })));
    }
    add(B.skill, B.html, B.where, B.icon + " " + B.title.split(" - ")[0]);
  }
  function makeResponsive() {
    const st = W().state(); if (!st.path || !isHtml(st.path)) return msg("open a page first - 📱 makes the open page fit phones and tablets", true);
    const t0 = W().currentText(), t = responsive(t0);
    if (t === t0) return msg("📱 the page already has the phone + tablet layout");
    W().setText(t); msg("📱 " + st.path + " fits phones and tablets now - try ▭ / 📱 on the WYSIWYG bar · 💾 Save to keep it");
  }
  function injectPh() {
    const f = $("wbWys"), d = f && f.contentDocument; if (!d || !d.head || d.getElementById("bg-wys-ph")) return;
    const s = d.createElement("style"); s.id = "bg-wys-ph"; s.textContent = PH_CSS; d.head.appendChild(s);
  }
  function build() {
    const pane = doc.querySelector('#webdock .wbpane[data-pane="wys"]'), f = $("wbWys"), top = $("wbSave") && $("wbSave").closest(".wbbar");
    if (!pane || !f || !top) return false; if ($("wbBlocks")) return true;
    // ◧ the block toolbar, left of the page
    const row = doc.createElement("div"); row.id = "wbWysRow"; f.parentNode.insertBefore(row, f);
    const bar = doc.createElement("div"); bar.id = "wbBlocks";
    bar.innerHTML = BLOCKS.map((B) => `<button type="button" class="ghost" data-blk="${B.id}" title="${escA(B.title)}${B.sub || B.cats ? " ▸" : ""}">${B.icon}</button>`).join("");
    row.appendChild(bar); row.appendChild(f);
    bar.addEventListener("click", (e) => { const b = e.target.closest("[data-blk]"); if (b) click(b); });
    f.addEventListener("load", injectPh);
    // 🖥 ▭ 📱 on the WYSIWYG bar
    const wb = $("wbWysBar");
    if (wb && !wb.querySelector("[data-wysw]")) {
      const sp = doc.createElement("span"); sp.className = "sep"; wb.appendChild(sp);
      [["100%", "🖥", "Desktop width"], ["820px", "▭", "Tablet width"], ["390px", "📱", "Phone width"]].forEach(([w, i, t]) => {
        const b = doc.createElement("button"); b.type = "button"; b.className = "ghost" + (w === "100%" ? " on" : ""); b.dataset.wysw = w; b.title = t; b.textContent = i; wb.appendChild(b);
        b.addEventListener("click", () => { f.style.width = w; f.style.flex = w === "100%" ? "" : "none"; wb.querySelectorAll("[data-wysw]").forEach((x) => x.classList.toggle("on", x === b)); });
      });
    }
    // 📱 + ⇡ auto-hide on the top bar
    top.id = top.id || "wbTopBar";
    const rb = doc.createElement("button"); rb.type = "button"; rb.className = "ghost"; rb.id = "wbResp"; rb.title = "Make the open page fit phones and tablets (the viewport + a phone / tablet style - pressed again it is written anew)"; rb.textContent = "📱 Phone + tablet";
    $("wbSave").parentNode.insertBefore(rb, $("wbSave").nextSibling); rb.addEventListener("click", makeResponsive);
    const ah = doc.createElement("label"); ah.id = "wbAutoHideL"; ah.title = "Fold the top bar to a thin strip until the pointer is on it"; ah.innerHTML = '<input type="checkbox" id="wbAutoHide"> ⇡ Auto-hide';
    top.appendChild(ah);
    const set = (on) => { $("webdock").classList.toggle("wbautohide", on); $("wbAutoHide").checked = on; try { root.localStorage.setItem("wb.autohide", on ? "1" : "0"); } catch (e) { /* fine */ } };
    $("wbAutoHide").addEventListener("change", (e) => { set(e.target.checked); e.target.blur(); });   // focus would hold it open
    let on = false; try { on = root.localStorage.getItem("wb.autohide") === "1"; } catch (e) { /* fine */ } set(on);
    injectPh();
    return true;
  }
  function start() { if (!build()) setTimeout(start, 400); }
  root.WbWys = Object.assign({ add, makeResponsive, closeFly }, pure);
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
