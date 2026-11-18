/* pcwebai.js — 🌐 BUILD ME A WEBSITE (2.852.0), window.PCWebAi.
 * The AI website builder's one-ask release (HANDOVER ">>> NEXT: THE AI WEBSITE BUILDER": "build me a website for my bakery":
 * the LLM plans the pages + writes the words, generates the pictures, lays the pages out in the editor for the user to change,
 * then 🌐 Build).
 *   One box (Web View's ribbon 🌐 Build Me a Website, File ▸ 🌐 Build Me a Website…, ✨ Create With the AI ▸ 🌐 Website, and
 *   "build me a website for my bakery …" in the prompt docker): what the business is + its details; ☑ 🛒 Shop, 📅 Booking,
 *   ✉ Contact form (ticked from the words, change them), ☑ 🖼 Pictures (the prompt docker's image style), ☑ ✨ The AI makes each
 *   page responsive, ☑ ⚡ Build the site when the pictures are in.
 *   1 POST /api/siteai/plan (lib/siteAi.js) - pages, words, colours, contact details, products, booking services
 *   2 a new web document, one 1440 px page per planned page (Web View): a hero (heading, intro, call to action, its photo), the
 *     sections in a row (each with its photo), the Contact page's details, the Book page's 📅 booking calendar (its services and
 *     length from the plan), a footer - every part an editable layer
 *   3 the pictures, one job at a time (the page's, the sections', then each product's - those become the shop's pictures)
 *   4 🌐 Build: PHP + MySQL when it has a shop / booking / contact form (the admin area comes with them), the products put in
 *     the admin database with the site (admin-schema.sql); else static. The preview opens.
 * Pure (Node: scripts/test-852.js): pageLayout, textH, featuresOf, stackOf, prodFile.
 */
(function (root) {
  "use strict";
  function textH(str, size, w, leading) {
    const cpl = Math.max(4, Math.floor(w / (size * 0.52))), lines = String(str || "").split("\n").reduce((n, ln) => n + Math.max(1, Math.ceil(ln.length / cpl)), 0);
    return Math.ceil(lines * size * (leading || 1.3));
  }
  const T = (str, x, y, w, size, o) => (str ? Object.assign({ t: "text", str: String(str), x: Math.round(x), y: Math.round(y), w: Math.round(w), h: textH(str, size, w, 1.3) + Math.round(size * 0.3), size: Math.round(size), weight: 400, color: "#1f2933", align: "left" }, o || {}) : null);
  const R = (x, y, w, h, fill, o) => Object.assign({ t: "rect", x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), fill, radius: 0 }, o || {});
  const P = (x, y, w, h, prompt, fill) => ({ t: "picture", x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), prompt: prompt || "", fill });
  function col(items, x, y, w, gap) { const els = []; let yy = y; for (const [s, size, o] of items) { const e = T(s, x, yy, w, size, o); if (!e) continue; els.push(e); yy = e.y + e.h + gap; } return { els, y: yy }; }
  /** one planned page on a W px wide web page (pure) -> {h, els, cal: {x, y} | null} - els: rect / text / picture (a box with
   *  its photo idea); the page is as tall as its content */
  function pageLayout(plan, pg, i, W) {
    const c = plan.palette, m = Math.round(W * 0.07), cw = W - 2 * m, els = [];
    const heroH = Math.round(W * 0.39), picW = Math.round(cw * 0.44), txtW = cw - picW - Math.round(W * 0.04);
    els.push(R(0, 0, W, heroH, c.accent));
    const hero = col([[pg.heading || plan.title, W * 0.037, { weight: 800, color: c.accentInk }], [pg.intro || (i === 0 ? plan.tagline : ""), W * 0.0155, { color: c.accentInk }],
      [pg.cta ? "→ " + pg.cta : "", W * 0.015, { weight: 700, color: c.accentInk }]], m, Math.round(heroH * 0.2), pg.picture ? txtW : cw * 0.75, Math.round(W * 0.014));
    els.push(...hero.els);
    if (pg.picture) els.push(P(W - m - picW, Math.round(heroH * 0.12), picW, Math.round(heroH * 0.76), pg.picture, c.bg));
    let y = heroH + Math.round(W * 0.05), cal = null;
    const secs = pg.sections || [];
    if (secs.length) {
      const n = secs.length, gap = Math.round(W * 0.03), sw = Math.round((cw - gap * (n - 1)) / n);
      let bottom = y;
      secs.forEach((s, k) => {
        const x = m + k * (sw + gap); let yy = y;
        if (s.picture) { const ph = Math.round(sw * 0.62); els.push(P(x, yy, sw, ph, s.picture, c.accent)); yy += ph + Math.round(W * 0.014); }
        const st = col([[s.heading, W * 0.017, { weight: 700, color: c.accent }], [s.text, W * 0.0115, { color: c.ink }]], x, yy, sw, Math.round(W * 0.008));
        els.push(...st.els); bottom = Math.max(bottom, st.y);
      });
      y = bottom + Math.round(W * 0.04);
    }
    if (pg.kind === "booking") { const ch = Math.round(W * 0.42); cal = { x: Math.round(W / 2), y: Math.round(y + ch / 2) }; y += ch + Math.round(W * 0.04); }
    if (pg.kind === "contact") {
      const k = plan.contact || {}, lines = [k.phone && "☎  " + k.phone, k.email && "✉  " + k.email, k.address && "⌂  " + k.address, k.hours && "🕘  " + k.hours].filter(Boolean);
      if (lines.length) { const st = col([["Contact details", W * 0.017, { weight: 700, color: c.accent }], [lines.join("\n"), W * 0.013, { color: c.ink }]], m, y, cw * 0.5, Math.round(W * 0.01)); els.push(...st.els); y = st.y + Math.round(W * 0.03); }
      y += Math.round(W * 0.24);              // room for the contact form the site adds under the page's words
    }
    const foot = [plan.title, plan.contact && plan.contact.phone, plan.contact && plan.contact.email].filter(Boolean).join("  ·  ");
    const fh = Math.round(W * 0.05);
    els.push(R(0, y, W, fh, c.ink === "#ffffff" ? "#111111" : "#1f2933"));
    const ft = T(foot, m, y + Math.round(fh * 0.3), cw, W * 0.011, { color: "#ffffff" }); if (ft) els.push(ft);
    const h = y + fh;
    els.unshift(R(0, 0, W, h, c.bg));
    return { h, els, cal };
  }
  /** what the build needs (pure): php when it sells, takes bookings or has a contact form */
  const stackOf = (f) => (f && (f.shop || f.booking || f.contact) ? "php" : "static");
  /** the ticks' first state from the words (pure) */
  function featuresOf(text) {
    const s = String(text || "");
    return { shop: /\b(shop|store|sell|selling|order online|online orders?|e-?commerce|cart|checkout)\b/i.test(s) || /\border\b[^.!?]{0,40}\bonline\b|\bonline\b[^.!?]{0,20}\border/i.test(s), booking: /\b(book|booking|bookings|appointments?|reservations?|reserve|classes|sessions?)\b/i.test(s), contact: !/\bno contact\b/i.test(s) };
  }
  /** a product's picture file (pure) */
  const prodFile = (name, i) => "prod-" + (String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "item-" + (i + 1)) + ".png";
  /** "build me a website for my bakery" (pure) */
  const isAsk = (t) => /\b(build|make|create|design|set ?up|need|want)\b[^.?!]{0,40}\b(web ?site|web page|site|online shop|online store)\b/i.test(String(t || ""));
  const pure = { textH, pageLayout, stackOf, featuresOf, prodFile, isAsk };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ================================ the page ================================ */
  function install(E) {
    const { S, D, doc, win, store } = E, say = E.say || (() => {});
    if (!E.ui || !E.ui.addCmd || !E.pages) return;
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
    const api = async (u, body) => { const r = await win.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status); return j; };
    const sleep = (ms) => new Promise((r) => win.setTimeout(r, ms));
    let busy = false, stop = false;
    function place(e) {
      if (e.t === "rect" || e.t === "picture") {
        const L = E.makeLayer(e.t === "picture" ? "🖼 " + (e.prompt || "Picture").slice(0, 26) : "Shape", S.w, S.h, "shape");
        L.shape = Object.assign({}, D.SHAPE_DEFAULT, { kind: "rect", x: e.x, y: e.y, w: e.w, h: e.h, radius: e.radius || 0, fill: e.fill || "#cccccc", fillOn: true, strokeOn: false });
        if (e.t === "picture") L.opacity = 0.35;
        D.rasterize(L); E.addLayer(L, "🌐 website", false); return L;
      }
      if (e.t === "text") {
        const L = E.makeLayer(e.str.split("\n")[0].slice(0, 30) || "Text", S.w, S.h, "text");
        L.text = Object.assign({}, D.TEXT_DEFAULT, { str: e.str, font: "Arial", size: e.size, weight: e.weight, color: e.color, align: e.align, leading: 1.3, x: e.x, y: e.y, box: { w: e.w, h: e.h } });
        D.rasterize(L); E.addLayer(L, "🌐 website", false); return L;
      }
      return null;
    }
    /** a photo for the website (the prompt docker's image style) -> its /outputs/ URL */
    async function picture(prompt, w, h) {
      const st = doc.getElementById("styleSel"); const style = st ? st.value : ""; if (!style) throw new Error("no image style in the prompt docker");
      const a = w / h, area = 1048576, r16 = (v) => Math.max(256, Math.min(2048, Math.round(v / 16) * 16));
      const job = await api("/api/genimage", { prompt: prompt + ". A professional photograph for a website, natural light, no text, no words, no letters, no logos.", style_id: style, batch: 1, width: r16(Math.sqrt(area * a)), height: r16(Math.sqrt(area / a)) });
      for (;;) {
        if (stop) throw new Error("stopped");
        await sleep(1500);
        const jr = await win.fetch("/api/jobs/" + encodeURIComponent(job.id)), j = await jr.json();
        if (j.status === "done") { const n = (j.outputs && j.outputs[0]) || j.output; return n ? "/outputs/" + String(n).split("/").map(encodeURIComponent).join("/") : null; }
        if (j.status === "failed" || j.status === "cancelled" || !jr.ok) throw new Error("the picture's job " + (j.status || "went away"));
      }
    }
    const loadImg = (url) => new Promise((ok, no) => { const im = new win.Image(); im.onload = () => ok(im); im.onerror = () => no(new Error("the picture did not load")); im.src = url; });
    function putPicture(img, e) {
      const L = E.makeLayer("🖼 " + (e.prompt || "Picture").slice(0, 28), S.w, S.h), g = L.canvas.getContext("2d");
      const k = Math.max(e.w / img.naturalWidth, e.h / img.naturalHeight), w = img.naturalWidth * k, h = img.naturalHeight * k;
      g.save(); g.beginPath(); g.rect(e.x, e.y, e.w, e.h); g.clip(); g.drawImage(img, e.x + (e.w - w) / 2, e.y + (e.h - h) / 2, w, h); g.restore();
      E.addLayer(L, "🌐 picture", false); return L;
    }
    async function b64Of(url) {
      const b = await (await win.fetch(url)).blob();
      return await new Promise((ok, no) => { const r = new win.FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => no(new Error("the picture did not read")); r.readAsDataURL(b); });
    }
    function bar(t) { say(t); try { if (typeof root.logLine === "function") root.logLine("[website] " + t); } catch (e) { /* fine */ } }

    /** the whole run: {ask, name, shop, booking, contact, pictures, ai, build} -> the line said */
    async function build(o) {
      const a = o || {}, ask = String(a.ask || "").trim();
      if (!ask) throw new Error("say what the website is for - the business, what it sells or offers, its details");
      if (busy) throw new Error("still building the last website");
      busy = true; stop = false;
      try {
        bar("🌐 the LLM is planning the website…");
        const { plan } = await api("/api/siteai/plan", { ask, shop: !!a.shop, booking: !!a.booking, contact: !!a.contact });
        const W = 1440, lays = plan.pages.map((pg, i) => pageLayout(plan, pg, i, W)), H = Math.max(900, ...lays.map((l) => l.h));
        for (const l of lays) l.els[0].h = H;          // each page's colour fills the whole (equally tall) page
        if (E.views && E.views.apply) E.views.apply("web");
        const name = String(a.name || plan.title || "Website").slice(0, 60);
        E.pages.newDocument({ preset: "Custom", wmm: W * 25.4 / 72, hmm: H * 25.4 / 72, orient: H > W ? "portrait" : "landscape", dpi: 72 }, plan.pages.length, name);
        plan.pages.forEach((pg, i) => { if (E.pages.rename) E.pages.rename(i, pg.title); });
        const boxes = [];
        for (let i = 0; i < plan.pages.length; i++) {
          if (E.pages.count() > 1) E.pages.go(i);
          for (const e of lays[i].els) { const L = place(e); if (e.t === "picture" && e.prompt) boxes.push({ i, e, L }); }
          if (lays[i].cal && E.calendar && plan.booking) {
            try {
              const L = await E.calendar.create(lays[i].cal.x, lays[i].cal.y, { mode: "booking", name: plan.booking.name, kind: "appointments" });
              const H3 = root.H3SiteCal;
              if (L && L.cal && H3) { L.cal = H3.clean(Object.assign({}, L.cal, { slot: plan.booking.minutes, services: plan.booking.services })); E.calendar.render(L, false); }
            } catch (err) { bar("📅 the booking calendar was not made: " + err.message); }
          }
        }
        if (E.pages.count() > 1) E.pages.go(0);
        E.refresh(); E.renderLayersPanel();
        bar(`🌐 "${plan.title}" - ${plan.pages.length} page(s) laid out (${plan.pages.map((p) => p.title).join(", ")})${plan.products.length ? `, ${plan.products.length} product(s) for the shop` : ""}`);
        // the pictures, one job at a time
        let made = 0; const assets = [], products = plan.products.map((p, i) => Object.assign({}, p, { image: "" }));
        const total = (a.pictures ? boxes.length + products.filter((p) => p.picture).length : 0);
        if (a.pictures && total) {
          for (const b of boxes) {
            if (stop) break;
            bar(`🌐 picture ${made + 1} of ${total}: ${b.e.prompt.slice(0, 60)}…`);
            try {
              const url = await picture(b.e.prompt, b.e.w, b.e.h); if (!url) continue;
              const img = await loadImg(url), back = E.pages.count() > 1 ? E.pages.cur() : 0;
              if (E.pages.count() > 1) E.pages.go(b.i);
              const at = S.layers.indexOf(b.L); if (at >= 0) S.layers.splice(at, 1);
              putPicture(img, b.e); made++;
              if (E.pages.count() > 1) E.pages.go(back);
              E.refresh(); E.renderLayersPanel();
            } catch (err) { if (stop) break; bar("🌐 a picture was not made: " + err.message); }
          }
          for (let k = 0; k < products.length && !stop; k++) {
            const p = products[k]; if (!p.picture) continue;
            bar(`🌐 picture ${made + 1} of ${total}: 🛒 ${p.name}…`);
            try { const url = await picture(p.picture, 800, 800); if (!url) continue; const f = prodFile(p.name, k); assets.push({ name: f, b64: await b64Of(url) }); p.image = f; made++; }
            catch (err) { if (stop) break; bar("🌐 a product's picture was not made: " + err.message); }
          }
        }
        const f = plan.features, stack = stackOf(f);
        const site = { name, title: plan.title, stack, lang: (doc.documentElement.lang || "en").slice(0, 5), ai: a.ai !== false, admin: !!(f.shop || f.booking), shop: !!f.shop, open: true };
        E.webAi.last = { plan, site, products, assets };
        try { store.set("site.last", JSON.stringify(Object.assign(JSON.parse(store.get("site.last", "{}")) || {}, { name, title: plan.title, stack, admin: site.admin, shop: site.shop }))); } catch (e) { /* kept as it was */ }
        if (stop) return `🌐 stopped - ${made} picture(s) made; the pages are there to change, then 🌐 Build Website`;
        if (a.build === false || !E.site || !E.site.build) return `🌐 "${plan.title}" is laid out (${plan.pages.length} pages${made ? `, ${made} picture(s)` : ""}) - change anything, then 🌐 Build Website${f.shop ? " (tick 🛒 Shop)" : ""}`;
        bar(`🌐 building "${plan.title}" (${stack === "php" ? "PHP + MySQL" : "static"}${f.shop ? " + 🛒 shop" : ""}${f.booking ? " + 📅 booking" : ""})…`);
        await E.site.build(Object.assign({}, site, { seed: f.shop && products.length ? { products } : undefined, assets }));
        return `🌐 "${plan.title}" is built - ${plan.pages.length} page(s)${made ? `, ${made} picture(s)` : ""}${f.shop ? `, the shop with ${products.length} product(s)` : ""}${f.booking ? ", a booking calendar" : ""} · change any page and 🌐 Build Website again`;
      } finally { busy = false; }
    }
    function dialog(ask0) {
      const ask = ask0 || "", ft = featuresOf(ask), pics = store.get("webai.pics", true) !== false, ai = store.get("webai.ai", true) !== false, bld = store.get("webai.build", true) !== false;
      E.ui.dialog("🌐 Build Me a Website", `<div class="kxrow"><textarea id="pwaAsk" rows="6" style="flex:1" placeholder="What the business is and what the site should do - its name, what it sells or offers, prices, opening hours, phone / email / address. e.g. A website for Rosie's Bakery in Fremantle: sourdough, pastries and celebration cakes, order cakes online, open 7am-3pm Tue-Sun, 0412 345 678">${esc(ask)}</textarea></div>
        <div class="kxrow" style="flex-wrap:wrap;gap:4px 14px"><label><input type="checkbox" id="pwaShop"${ft.shop ? " checked" : ""}> 🛒 Shop (products, cart, checkout)</label><label><input type="checkbox" id="pwaBook"${ft.booking ? " checked" : ""}> 📅 Booking calendar</label><label><input type="checkbox" id="pwaContact"${ft.contact ? " checked" : ""}> ✉ Contact form</label></div>
        <div class="kxrow" style="flex-wrap:wrap;gap:4px 14px"><label><input type="checkbox" id="pwaPics"${pics ? " checked" : ""}> 🖼 Pictures - the prompt docker's image style</label><label><input type="checkbox" id="pwaAi"${ai ? " checked" : ""}> ✨ The AI makes each page responsive</label><label><input type="checkbox" id="pwaBuild"${bld ? " checked" : ""}> ⚡ Build the site when the pictures are in</label></div>
        <div style="color:var(--pc-dim);margin-top:6px">The prompt docker's LLM plans the pages, words and colours (and the shop's products / the booking services); bitGen lays every page out as layers you can change, makes the pictures one at a time and builds the site - PHP + MySQL when it sells, takes bookings or has a contact form (with its 🔐 admin area), else plain HTML.</div>`, (d) => {
        const v = (id) => d.querySelector("#" + id);
        store.set("webai.pics", v("pwaPics").checked); store.set("webai.ai", v("pwaAi").checked); store.set("webai.build", v("pwaBuild").checked);
        build({ ask: v("pwaAsk").value, shop: v("pwaShop").checked, booking: v("pwaBook").checked, contact: v("pwaContact").checked, pictures: v("pwaPics").checked, ai: v("pwaAi").checked, build: v("pwaBuild").checked })
          .then((m) => bar(m)).catch((e) => bar("🌐 " + e.message));
        return true;
      }, { okLabel: "🌐 Build it", wide: true, init: (d) => {
        const t = d.querySelector("#pwaAsk");
        t.addEventListener("input", () => { const f = featuresOf(t.value); if (!d.querySelector("#pwaShop").dataset.touched) d.querySelector("#pwaShop").checked = f.shop; if (!d.querySelector("#pwaBook").dataset.touched) d.querySelector("#pwaBook").checked = f.booking; });
        ["pwaShop", "pwaBook"].forEach((id) => d.querySelector("#" + id).addEventListener("change", (e) => { e.target.dataset.touched = "1"; }));
        win.setTimeout(() => t.focus(), 0);
      } });
    }
    E.ui.addCmd("file.webai", "🌐 Build Me a Website…", "", () => dialog(), {}, ["File", "file.createai"]);
    E.ui.addCmd("web.stopai", "■ Stop the Website Builder", "", () => { stop = true; bar("🌐 stopping after this picture…"); }, { enabled: () => busy }, ["File", "file.webai"]);
    // the prompt docker: "build me a website for my bakery …" opens the box with the words (nothing runs unasked)
    async function route(text) {
      if (!isAsk(text)) return null;
      const dock = doc.getElementById("imageeditdock"); if (dock && (dock.classList.contains("dockgone") || dock.classList.contains("collapsed"))) return null;
      dialog(String(text)); return "🌐 the Build Me a Website box is open with your words - tick what the site needs and press 🌐 Build it";
    }
    root.H3ChatRoutes = [route].concat(root.H3ChatRoutes || []);
    E.webAi = { dialog, build, picture, stop: () => { stop = true; }, busy: () => busy, last: null };
  }
  const PCWebAi = Object.assign({ install }, pure);
  if (root && root.document) root.PCWebAi = PCWebAi;
})(typeof window !== "undefined" ? window : globalThis);
