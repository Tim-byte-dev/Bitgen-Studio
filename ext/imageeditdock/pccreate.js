/* pccreate.js — ✨ CREATE WITH THE AI (2.849.0), window.PCCreate.
 * Tim (verbatim): "make the llm help me create the documents and stories and flyers and brochures and business cards and
 * website and invoices please"
 * One box (File ▸ ✨ Create With the AI…, the quick bar's ✨, "make a flyer for …" in the prompt docker): pick what - 📄 Document,
 * 📖 Story, 📰 Flyer, 📑 Brochure (tri-fold), 💳 Business card, 🌐 Website, 🧾 Invoice - say what it is for:
 *   Document / Story -> a new A4 text document, the LLM writes it into its WP layer (pcdocai.js: tables, charts, pictures)
 *   Invoice / Quote / Receipt -> the 🧾 template filled by the LLM (pcdoctpl.js aiMake)
 *   Flyer / Brochure / Business card / Website -> POST /api/create/plan (lib/createAi.js: the words, colours, picture ideas),
 *     then bitGen lays them out on real pages as EDITABLE layers (shapes + paragraph text + pictures): flyer A4 portrait;
 *     brochure A4 landscape, 2 pages (outside: flap | back | cover, inside: 3 panels) with fold guides; business card
 *     front + back at 300 dpi in the size picked (2.876.0: CARD_SIZES - paper by country or PVC CR80 / 79 / 90 / 100); website 1440 × 900 web pages (Web View, then 🌐 Build Website).
 *     Pictures (ticked): made one at a time with the prompt docker's image style, each put in its box when ready.
 * Pure (Node: scripts/test-849.js): textH, flyerLayout, brochureLayout, cardLayout, webLayout, kindOf, KINDS.
 */
(function (root) {
  "use strict";
  const KINDS = [["document", "📄", "Document"], ["story", "📖", "Story"], ["flyer", "📰", "Flyer"], ["brochure", "📑", "Brochure"], ["card", "💳", "Business card"], ["letterhead", "✉", "Letterhead"], ["poster", "🪧", "Poster"], ["website", "🌐", "Website"], ["invoice", "🧾", "Invoice / quote"]];
  // 2.875.0: these four ask for the business's details first (pcbizinfo.js - the Business details dialog)
  const BIZ_KINDS = ["card", "letterhead", "flyer", "poster"];
  /* 2.876.0 Tim (verbatim): "in the business card dialog add dropdown for size, cardboard or pvc those are common sizes".
   * The common trimmed sizes, landscape (w x h mm). Paper / card stock by country; PVC = the ISO 7810 / CR plastic card sizes,
   * printed with rounded corners (3.18 mm, the credit card's). The first is the default (Australia, where Tim is). */
  const CARD_SIZES = [
    { id: "au", group: "paper", label: "Australia / NZ", wmm: 90, hmm: 55 },
    { id: "us", group: "paper", label: "US / Canada (3.5 × 2 in)", wmm: 88.9, hmm: 50.8 },
    { id: "eu", group: "paper", label: "UK / Europe", wmm: 85, hmm: 55 },
    { id: "jp", group: "paper", label: "Japan", wmm: 91, hmm: 55 },
    { id: "cn", group: "paper", label: "China / Hong Kong / Singapore", wmm: 90, hmm: 54 },
    { id: "ee", group: "paper", label: "Eastern Europe / South America", wmm: 90, hmm: 50 },
    { id: "square", group: "paper", label: "Square", wmm: 63.5, hmm: 63.5 },
    { id: "mini", group: "paper", label: "Mini (slim)", wmm: 70, hmm: 32 },
    { id: "cr80", group: "pvc", label: "CR80 - credit card size", wmm: 85.6, hmm: 54, radius: 3.18 },
    { id: "cr79", group: "pvc", label: "CR79 - a little smaller", wmm: 83.9, hmm: 51, radius: 3.18 },
    { id: "cr90", group: "pvc", label: "CR90 - a little bigger", wmm: 92, hmm: 60, radius: 3.18 },
    { id: "cr100", group: "pvc", label: "CR100 - oversize", wmm: 98.5, hmm: 67, radius: 3.18 }];
  const CARD_GROUPS = { paper: "Cardboard / paper", pvc: "PVC (plastic)" };
  /** a card size id -> the size (an unknown id = the first) */
  const cardSize = (id) => CARD_SIZES.find((c) => c.id === id) || CARD_SIZES[0];
  /** "85.6 × 54 mm" */
  const mmLabel = (c) => `${+c.wmm.toFixed(1)} × ${+c.hmm.toFixed(1)} mm`;
  /** a card size id -> {spec (the page at 300 dpi), radius (the corners in px at 300 dpi; 0 = square), size} */
  function cardSpec(id) {
    const c = cardSize(id);
    return { size: c, radius: c.radius ? Math.round((c.radius / 25.4) * 300) : 0, spec: { preset: "Custom", wmm: c.wmm, hmm: c.hmm, orient: c.wmm >= c.hmm ? "landscape" : "portrait", dpi: 300 } };
  }
  const L0 = (x, y, w, h, align) => ({ t: "logo", x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), align: align || "center" });
  /** a paragraph's height: characters per line from the box width (average glyph = 0.52 em), at its leading */
  function textH(str, size, w, leading) {
    const cpl = Math.max(4, Math.floor(w / (size * 0.52))), lines = String(str || "").split("\n").reduce((n, ln) => n + Math.max(1, Math.ceil(ln.length / cpl)), 0);
    return Math.ceil(lines * size * (leading || 1.25));
  }
  const T = (str, x, y, w, size, o) => (str ? Object.assign({ t: "text", str, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: textH(str, size, w, 1.25) + Math.round(size * 0.3), size: Math.round(size), weight: 400, color: "#1f2933", align: "left" }, o || {}) : null);
  const R = (x, y, w, h, fill, o) => Object.assign({ t: "rect", x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), fill, radius: 0 }, o || {});
  const P = (x, y, w, h, prompt, fill) => ({ t: "picture", x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), prompt: prompt || "", fill });
  const bullets = (a) => (a || []).map((b) => "•  " + b).join("\n");
  /** a column of texts, each under the one before: [[str, size, opts]] from y, gap -> {els, y} */
  function stack(items, x, y, w, gap) {
    const els = []; let yy = y;
    for (const [str, size, o] of items) { const e = T(str, x, yy, w, size, o); if (!e) continue; els.push(e); yy = e.y + e.h + gap; }
    return { els, y: yy };
  }
  /** a flyer on a W × H page (A4 portrait) */
  function flyerLayout(p, W, H) {
    const c = p.palette, m = W * 0.07, cw = W - 2 * m, els = [R(0, 0, W, H, c.bg)];
    els.push(R(0, 0, W, H * 0.06, c.accent));
    const lw = p.hasLogo ? W * 0.2 : 0;
    if (lw) els.push(L0(W - m - lw, H * 0.08, lw, lw * 0.6, "right"));
    const top = stack([[p.headline, W * 0.075, { weight: 800, color: c.ink }], [p.subheadline, W * 0.032, { color: c.accent, weight: 600 }]], m, H * 0.09, cw - (lw ? lw + W * 0.03 : 0), W * 0.02);
    els.push(...top.els);
    const ph = H * 0.3; els.push(P(m, top.y, cw, ph, p.picture, c.accent));
    const mid = stack([[p.body, W * 0.026, { color: c.ink }], [bullets(p.bullets), W * 0.026, { color: c.ink, weight: 600 }]], m, top.y + ph + W * 0.035, cw, W * 0.025);
    els.push(...mid.els);
    if (p.cta) { const bh = W * 0.1, by = Math.max(mid.y, H * 0.78); els.push(R(m, by, cw, bh, c.accent, { radius: bh * 0.2 })); els.push(Object.assign(T(p.cta, m, by + bh * 0.22, cw, W * 0.045, { weight: 800, color: c.accentInk, align: "center" }), { h: Math.round(bh * 0.7) })); }
    const foot = stack([[p.contact, W * 0.024, { color: c.ink, align: "center", weight: 600 }], [p.footer, W * 0.017, { color: c.ink, align: "center" }]], m, H * 0.89, cw, W * 0.01);
    els.push(...foot.els);
    if (!p.back) return [els];
    // 2.875.0: the back of a two-sided flyer (the Business details dialog's "back")
    const bk = [R(0, 0, W, H, c.bg), R(0, H - H * 0.06, W, H * 0.06, c.accent)];
    if (p.hasLogo) bk.push(L0(W / 2 - W * 0.15, H * 0.06, W * 0.3, W * 0.18));
    bk.push(...stack([[p.back.heading, W * 0.06, { weight: 800, color: c.accent, align: "center" }], [p.back.text, W * 0.028, { color: c.ink, align: "center" }],
      [bullets(p.services), W * 0.027, { color: c.ink, weight: 600 }]], m, H * (p.hasLogo ? 0.22 : 0.1), cw, W * 0.03).els);
    bk.push(...stack([[p.contact, W * 0.026, { color: c.ink, align: "center", weight: 700 }]], m, H * 0.84, cw, 0).els);
    return [els, bk];
  }
  /** 2.875.0: a letterhead (A4): the logo + company at the head, the contact line + the services at the foot; the letter goes
   *  between (a WP frame - pccreate make) -> [els] + .body {x, y, w, h} */
  function letterheadLayout(p, W, H) {
    const c = p.palette, m = W * 0.08, cw = W - 2 * m, els = [R(0, 0, W, H, "#ffffff")];
    const lh = H * 0.07, lw = p.hasLogo ? lh * 1.8 : 0;
    if (lw) els.push(L0(m, H * 0.04, lw, lh, "left"));
    const tx = m + (lw ? lw + W * 0.03 : 0), head = stack([[p.company, W * 0.04, { weight: 800, color: c.accent }], [p.tagline, W * 0.018, { color: c.ink }]], tx, H * 0.045, W - m - tx, W * 0.006);
    els.push(...head.els);
    const hb = Math.max(H * 0.04 + lh, head.y) + H * 0.012;
    els.push(R(m, hb, cw, Math.max(2, H * 0.003), c.accent));
    const fy = H * 0.9;
    els.push(R(m, fy, cw, Math.max(2, H * 0.002), c.accent));
    els.push(...stack([[p.contact, W * 0.016, { color: c.ink, align: "center", weight: 600 }], [p.footer, W * 0.014, { color: c.ink, align: "center" }]], m, fy + H * 0.01, cw, W * 0.004).els);
    const out = [els];
    out.body = { x: Math.round(m), y: Math.round(hb + H * 0.04), w: Math.round(cw), h: Math.round(fy - hb - H * 0.07) };
    return out;
  }
  /** 2.875.0: a poster (A3 portrait): the logo, a big headline, the picture, the points, the call to action, the contact */
  function posterLayout(p, W, H) {
    const c = p.palette, m = W * 0.06, cw = W - 2 * m, els = [R(0, 0, W, H, c.bg), R(0, 0, W, H * 0.03, c.accent)];
    const lw = p.hasLogo ? W * 0.22 : 0;
    if (lw) els.push(L0(W - m - lw, H * 0.045, lw, lw * 0.55, "right"));
    const top = stack([[p.headline, W * 0.09, { weight: 900, color: c.ink }], [p.subheadline, W * 0.036, { color: c.accent, weight: 700 }]], m, H * 0.05, cw - (lw ? lw + W * 0.03 : 0), W * 0.02);
    els.push(...top.els);
    const ph = H * 0.36; els.push(P(m, top.y + W * 0.01, cw, ph, p.picture, c.accent));
    const mid = stack([[p.body, W * 0.028, { color: c.ink }], [bullets(p.bullets), W * 0.03, { color: c.ink, weight: 700 }]], m, top.y + ph + W * 0.05, cw, W * 0.025);
    els.push(...mid.els);
    if (p.cta) { const bh = W * 0.11, by = Math.max(mid.y, H * 0.8); els.push(R(m, by, cw, bh, c.accent, { radius: bh * 0.25 })); els.push(Object.assign(T(p.cta, m, by + bh * 0.2, cw, W * 0.05, { weight: 900, color: c.accentInk, align: "center" }), { h: Math.round(bh * 0.7) })); }
    els.push(...stack([[p.contact, W * 0.026, { color: c.ink, align: "center", weight: 700 }], [p.footer, W * 0.018, { color: c.ink, align: "center" }]], m, H * 0.92, cw, W * 0.01).els);
    return [els];
  }
  /** a tri-fold brochure: two A4 landscape pages - outside (inside flap | back | cover), inside (3 panels) */
  function brochureLayout(p, W, H) {
    const c = p.palette, pw = W / 3, m = pw * 0.09, cw = pw - 2 * m, pics = p.pictures || [];
    const panel = (x, pn, pic) => {
      const els = []; const head = stack([[pn.heading, pw * 0.07, { weight: 800, color: c.accent }]], x + m, H * 0.08, cw, pw * 0.03);
      els.push(...head.els); let y = head.y;
      if (pic !== undefined) { els.push(P(x + m, y, cw, H * 0.28, pic, c.accent)); y += H * 0.28 + pw * 0.04; }
      els.push(...stack([[pn.body, pw * 0.042, { color: c.ink }], [bullets(pn.bullets), pw * 0.04, { color: c.ink, weight: 600 }]], x + m, y, cw, pw * 0.03).els);
      return els;
    };
    const guides = (els) => { for (const k of [1, 2]) els.push(R(pw * k - 1, 0, 2, H, "#cfd4da", { name: "fold" })); return els; };
    const outside = [R(0, 0, W, H, c.bg)];
    outside.push(...panel(0, p.panels[3] || {}));
    outside.push(...stack([[p.back.heading, pw * 0.07, { weight: 800, color: c.accent }], [p.back.body, pw * 0.042, { color: c.ink }], [p.contact, pw * 0.045, { color: c.ink, weight: 700 }]], pw + m, H * 0.08, cw, pw * 0.04).els);
    outside.push(R(2 * pw, 0, pw, H, c.accent));
    outside.push(...stack([[p.title, pw * 0.11, { weight: 800, color: c.accentInk, align: "center" }], [p.tagline, pw * 0.05, { color: c.accentInk, align: "center" }]], 2 * pw + m, H * 0.1, cw, pw * 0.04).els);
    outside.push(P(2 * pw + m, H * 0.52, cw, H * 0.38, pics[0], c.bg));
    const inside = [R(0, 0, W, H, c.bg)];
    for (let k = 0; k < 3; k++) inside.push(...panel(k * pw, p.panels[k] || {}, k === 1 && pics[1] !== undefined ? pics[1] : k === 2 && pics[2] !== undefined ? pics[2] : undefined));
    return [guides(outside), guides(inside)];
  }
  /** a business card: front + back (its size picked - CARD_SIZES; p.radius = a PVC card's rounded corners in px) */
  function cardLayout(p, W, H) {
    const c = p.palette, m = W * 0.07, cw = W - 2 * m, rd = p.radius > 0 ? { radius: p.radius } : null;
    // 2.876.0: a PVC card's corners are round - the background and the foot band follow them (the band's top stays square)
    const front = [R(0, 0, W, H, c.bg, rd), R(0, H * 0.82, W, H * 0.18, c.accent, rd)];
    if (rd) front.push(R(0, H * 0.82, W, H * 0.09, c.accent));
    const lw = p.hasLogo ? H * 0.42 : 0;                    // 2.875.0: the logo top right of the front, big on the back
    if (lw) front.push(L0(W - m - lw, H * 0.1, lw, H * 0.3, "right"));
    front.push(...stack([[p.name, H * 0.13, { weight: 800, color: c.ink }], [p.role, H * 0.07, { color: c.accent, weight: 600 }]], m, H * 0.12, cw - (lw ? lw + m * 0.5 : 0), H * 0.03).els);
    front.push(...stack([[[p.phone, p.email, p.web].filter(Boolean).join("\n"), H * 0.065, { color: c.ink }], [p.address, H * 0.055, { color: c.ink }]], m, H * 0.45, cw, H * 0.02).els);
    const back = [R(0, 0, W, H, c.accent, rd)];
    if (lw) back.push(L0(W / 2 - H * 0.35, H * 0.08, H * 0.7, H * 0.3));
    const bw = p.back || {}, sv = (p.services || []).slice(0, 4).join("  ·  ");
    back.push(...stack([[p.company || p.name, H * 0.13, { weight: 800, color: c.accentInk, align: "center" }], [bw.heading || p.tagline, H * 0.07, { color: c.accentInk, align: "center", weight: 600 }],
      [bw.text || sv, H * 0.055, { color: c.accentInk, align: "center" }]], m, H * (lw ? 0.44 : 0.3), cw, H * 0.03).els);
    return [front, back];
  }
  /** one web page (W × H) of a website plan */
  function webLayout(site, pg, i, W, H) {
    const c = site.palette, m = W * 0.08, cw = W - 2 * m, els = [R(0, 0, W, H, c.bg)];
    const heroH = H * 0.42; els.push(R(0, 0, W, heroH, c.accent));
    els.push(...stack([[pg.heading || site.title, W * 0.042, { weight: 800, color: c.accentInk }], [pg.intro || (i === 0 ? site.tagline : ""), W * 0.017, { color: c.accentInk }]], m, heroH * 0.25, cw * 0.7, W * 0.012).els);
    const secs = pg.sections || [], n = Math.max(1, secs.length), gap = W * 0.03, sw = (cw - gap * (n - 1)) / n;
    secs.forEach((s, k) => els.push(...stack([[s.heading, W * 0.019, { weight: 700, color: c.accent }], [s.text, W * 0.0125, { color: c.ink }]], m + k * (sw + gap), heroH + H * 0.08, sw, W * 0.008).els));
    if (site.contact && (i === site.pages.length - 1 || /contact/i.test(pg.title))) els.push(T(site.contact, m, H * 0.86, cw, W * 0.013, { color: c.ink, weight: 600 }));
    return els;
  }
  /** "make a flyer for my bakery" -> flyer | brochure | card | null (the prompt docker) */
  function kindOf(text) {
    const s = String(text || "");
    if (!/\b(make|create|design|write|draft|do|generate|need|want)\b/i.test(s)) return null;
    if (/\bbusiness ?cards?\b/i.test(s)) return "card";
    if (/\bletter ?-?heads?\b/i.test(s)) return "letterhead";              // 2.875.0
    if (/\bposters?\b/i.test(s)) return "poster";                          // 2.875.0 (was a flyer)
    if (/\b(brochure|pamphlet|tri-?fold)\b/i.test(s)) return "brochure";
    if (/\b(flyer|flier|leaflet)\b/i.test(s)) return "flyer";
    return null;
  }
  const pure = { KINDS, BIZ_KINDS, CARD_SIZES, CARD_GROUPS, cardSize, cardSpec, mmLabel, textH, flyerLayout, brochureLayout, cardLayout, webLayout, letterheadLayout, posterLayout, kindOf };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ================================ the page ================================ */
  function install(E) {
    const { S, D, doc, win, store } = E, say = E.say || (() => {});
    if (!E.ui || !E.ui.addCmd || !E.pages) return;
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const api = async (u, body) => { const r = await win.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status); return j; };
    /** an element -> a layer on the current page (shapes, paragraph text, a picture box) */
    let logoImg = null;                                     // 2.875.0: the business's logo while a layout is laid
    function place(e) {
      if (e.t === "logo") {
        if (!logoImg) return null;
        const L = E.makeLayer("Logo", S.w, S.h), g = L.canvas.getContext("2d");
        const k = Math.min(e.w / logoImg.naturalWidth, e.h / logoImg.naturalHeight), w = logoImg.naturalWidth * k, h = logoImg.naturalHeight * k;
        const x = e.align === "left" ? e.x : e.align === "right" ? e.x + e.w - w : e.x + (e.w - w) / 2;
        g.imageSmoothingQuality = "high"; g.drawImage(logoImg, x, e.y + (e.h - h) / 2, w, h);
        E.addLayer(L, "✨ create", false); return L;
      }
      if (e.t === "rect" || (e.t === "picture" && !e.url)) {
        const L = E.makeLayer(e.t === "picture" ? "🖼 Picture" : e.name === "fold" ? "Fold line" : "Shape", S.w, S.h, "shape");
        L.shape = Object.assign({}, D.SHAPE_DEFAULT, { kind: "rect", x: e.x, y: e.y, w: e.w, h: e.h, radius: e.radius || 0, fill: e.fill || "#cccccc", fillOn: true, strokeOn: false });
        if (e.t === "picture") L.opacity = 0.35;
        D.rasterize(L); E.addLayer(L, "✨ create", false); return L;
      }
      if (e.t === "text") {
        const L = E.makeLayer(e.str.split("\n")[0].slice(0, 30) || "Text", S.w, S.h, "text");
        L.text = Object.assign({}, D.TEXT_DEFAULT, { str: e.str, font: "Arial", size: e.size, weight: e.weight, color: e.color, align: e.align, leading: 1.25, x: e.x, y: e.y, box: { w: e.w, h: e.h } });
        D.rasterize(L); E.addLayer(L, "✨ create", false); return L;
      }
      return null;
    }
    /** a picture into its box (cover) as a layer named after its idea */
    function putPicture(img, e) {
      const L = E.makeLayer("🖼 " + (e.prompt || "Picture").slice(0, 28), S.w, S.h), g = L.canvas.getContext("2d");
      const k = Math.max(e.w / img.naturalWidth, e.h / img.naturalHeight), w = img.naturalWidth * k, h = img.naturalHeight * k;
      g.save(); g.beginPath(); g.rect(e.x, e.y, e.w, e.h); g.clip(); g.drawImage(img, e.x + (e.w - w) / 2, e.y + (e.h - h) / 2, w, h); g.restore();
      E.addLayer(L, "✨ picture", false); return L;
    }
    const loadImg = (url) => new Promise((ok, no) => { const im = new win.Image(); im.onload = () => ok(im); im.onerror = () => no(new Error("the picture did not load")); im.src = url; });
    /** pages of elements -> the open document; pictures afterwards, one job at a time (page by page) */
    async function lay(pages, pictures, logo) {
      logoImg = logo || null;
      const boxes = [];
      for (let i = 0; i < pages.length; i++) {
        if (E.pages.count() > 1) E.pages.go(i);
        for (const e of pages[i]) { if (!e) continue; const L = place(e); if (e.t === "picture" && e.prompt) boxes.push({ i, e, L }); }
      }
      if (E.pages.count() > 1) E.pages.go(0);
      E.refresh(); E.renderLayersPanel();
      if (!pictures || !boxes.length) return 0;
      if (!E.docAi || !E.docAi.picture) { say("✨ pictures need the WP layer's AI (pcdocai.js)"); return 0; }
      let n = 0;
      for (const b of boxes) {
        say(`✨ picture ${n + 1} of ${boxes.length}: ${b.e.prompt.slice(0, 60)}…`);
        try {
          const url = await E.docAi.picture(b.e.prompt, b.e.w, b.e.h); if (!url) continue;
          const img = await loadImg(url), back = E.pages.count() > 1 ? E.pages.cur() : 0;
          if (E.pages.count() > 1) E.pages.go(b.i);
          const at = S.layers.indexOf(b.L); if (at >= 0) S.layers.splice(at, 1);   // the placeholder makes way
          putPicture(img, b.e); n++;
          if (E.pages.count() > 1) E.pages.go(back);
          E.refresh(); E.renderLayersPanel();
        } catch (err) { say("✨ a picture was not made: " + err.message); }
      }
      return n;
    }
    const SPECS = { flyer: [{ preset: "A4", wmm: 210, hmm: 297, orient: "portrait", dpi: 150 }, 1], brochure: [{ preset: "A4", wmm: 210, hmm: 297, orient: "landscape", dpi: 150 }, 2],
      card: [{ preset: "Custom", wmm: 90, hmm: 55, orient: "landscape", dpi: 300 }, 2],
      letterhead: [{ preset: "A4", wmm: 210, hmm: 297, orient: "portrait", dpi: 150 }, 1], poster: [{ preset: "A3", wmm: 297, hmm: 420, orient: "portrait", dpi: 150 }, 1] };
    /** make one: {kind, ask, pictures, words, docKind, invoiceKind} -> the line said */
    async function make(o) {
      const a = o || {}, kind = a.kind, ask = String(a.ask || "").trim();
      if (!ask && !(a.business && BIZ_KINDS.includes(kind))) throw new Error("say what it is for");
      if (kind === "invoice") return E.docTpl ? E.docTpl.aiMake(ask, a.invoiceKind || "invoice", true) : "🧾 the templates are not loaded";
      if (kind === "document" || kind === "story") {
        if (!E.docText || !E.docAi) throw new Error("the WP layer is not loaded");
        E.pages.newDocument({ preset: "A4", wmm: 210, hmm: 297, orient: "portrait", dpi: 150 }, 1, kind === "story" ? "Story" : "Document");
        const m = Math.round(25 / 25.4 * 150), L = E.docText.addFrame(m, m, S.w - 2 * m, S.h - 2 * m, { auto: true, k: 150 / 96 }, false);
        E.setActive(S.layers.indexOf(L));
        const r = await E.docAi.write({ ask, kind: kind === "story" ? "story" : a.docKind || "document", words: a.words || (kind === "story" ? 1500 : 800), pictures: !!a.pictures, tables: kind !== "story", charts: kind !== "story" });
        return `✨ ${kind === "story" ? "📖 the story" : "📄 the document"} "${(r && r.title) || ask.slice(0, 40)}" is written - edit it in its WP layer; File ▸ Export for Word / PDF`;
      }
      // 2.852.0: a website = 🌐 Build Me a Website (the whole site: pages, pictures, shop, booking, the build)
      if (kind === "website" && E.webAi) { E.webAi.dialog(ask); return "🌐 the Build Me a Website box is open with your words"; }
      say(`✨ the LLM is writing the ${kind === "card" ? "business card" : kind}…`);
      // 2.875.0: the business details (the Business details dialog / your last saved ones) ride with the ask; their logo is laid in
      const biz = a.business || null;
      const { plan } = await api("/api/create/plan", { kind, ask: ask || (biz && (biz.front || biz.company)) || "", business: biz || undefined });
      let logo = null;
      if (biz && biz.logo_url) { try { logo = await loadImg(biz.logo_url); } catch (e) { say("✨ the logo did not load - laid out without it"); } }
      plan.hasLogo = !!logo;
      if (kind === "website") {
        if (E.views && E.views.apply) E.views.apply("web");
        E.pages.newDocument({ preset: "Custom", wmm: 508, hmm: 317.5, orient: "landscape", dpi: 72 }, plan.pages.length, plan.title || "Website");
        plan.pages.forEach((pg, i) => { if (E.pages.rename) E.pages.rename(i, pg.title); });
        const pages = plan.pages.map((pg, i) => webLayout(plan, pg, i, S.w, S.h));
        try { store.set("site.last", JSON.stringify(Object.assign(JSON.parse(store.get("site.last", "{}")) || {}, { name: plan.title || "Website", title: plan.title || "Website" }))); } catch (e) { /* kept as it was */ }
        await lay(pages, false);
        return `✨ 🌐 "${plan.title}" - ${plan.pages.length} web pages (${plan.pages.map((p) => p.title).join(", ")}) as layers to change; 🌐 Build Website makes the site`;
      }
      let [spec, n0] = SPECS[kind]; const n = kind === "flyer" && plan.back ? 2 : n0;
      // 2.876.0: a card is the size picked in the Business details box (kept with the details), paper or PVC
      const cs = kind === "card" ? cardSpec(a.cardSize || (biz && biz.card_size) || "") : null;
      if (cs) { spec = cs.spec; plan.radius = cs.radius; }
      const NAMES = { card: plan.name || plan.company || "Business card", letterhead: (plan.company || "Letterhead") + " letterhead", poster: plan.headline || "Poster", flyer: plan.headline || "Flyer", brochure: plan.title || "Brochure" };
      E.pages.newDocument(spec, n, NAMES[kind]);
      if (kind === "flyer" && n === 2 && E.pages.rename) { E.pages.rename(0, "Front"); E.pages.rename(1, "Back"); }
      if (kind === "brochure" && E.pages.rename) { E.pages.rename(0, "Outside"); E.pages.rename(1, "Inside"); }
      if (kind === "card" && E.pages.rename) { E.pages.rename(0, "Front"); E.pages.rename(1, "Back"); }
      const LAY = { flyer: flyerLayout, brochure: brochureLayout, card: cardLayout, letterhead: letterheadLayout, poster: posterLayout };
      const pages = LAY[kind](plan, S.w, S.h);
      const pics = await lay(pages, !!a.pictures, logo);
      // 2.875.0: the letter itself goes in a WP frame between the letterhead's head and foot
      if (kind === "letterhead" && pages.body && E.docText && E.docText.addFrame) { try { E.docText.addFrame(pages.body.x, pages.body.y, pages.body.w, pages.body.h, { k: 150 / 96 }, false); E.refresh(); E.renderLayersPanel(); } catch (e) { /* the letterhead stands */ } }
      const WORDS = { card: `💳 the business card (front + back, ${cs ? mmLabel(cs.size) + (cs.size.group === "pvc" ? " PVC " + cs.size.id.toUpperCase() : "") : ""})`, flyer: n === 2 ? "📰 the flyer (front + back)" : "📰 the flyer", brochure: "📑 the tri-fold brochure (outside + inside)", letterhead: "✉ the letterhead (type the letter in its frame)", poster: "🪧 the poster" };
      return `✨ ${WORDS[kind]} is laid out as layers to change${logo ? " with your logo" : ""}${pics ? `, ${pics} picture(s) made` : ""} - File ▸ Export ▸ Document or 🖨 Print${kind === "card" ? " · 📇 File ▸ Business Card Sheet… for a sheet of them to print and cut" : ""}`;
    }
    /* ---- the box */
    function dialog(kind0, ask0) {
      const k0 = kind0 || store.get("create.kind", "flyer");
      const cards = KINDS.map(([id, ic, label]) => `<label class="pccr-k"><input type="radio" name="pccrKind" value="${id}"${id === k0 ? " checked" : ""}><span>${ic}</span>${esc(label)}</label>`).join("");
      E.ui.dialog("✨ Create With the AI", `<div class="pccr-ks">${cards}</div>
        <div class="kxrow"><textarea id="pccrAsk" rows="5" style="flex:1" placeholder="What is it for? The business, the offer, prices, dates, names, phone / email / web… e.g. A flyer for Rosie's Bakery's Saturday market stall: sourdough $8, croissants $4, 7am-12pm, 0412 345 678">${esc(ask0 || "")}</textarea></div>
        <div class="kxrow pccr-o" data-for="document"><span>Kind</span><select id="pccrDoc">${["document", "article", "report", "letter", "essay", "summary"].map((x) => `<option>${x}</option>`).join("")}</select><span>About</span><input type="number" id="pccrWords" value="800" min="150" max="6000" style="width:80px"><span>words</span></div>
        <div class="kxrow pccr-o" data-for="story"><span>About</span><input type="number" id="pccrSWords" value="1500" min="300" max="6000" style="width:80px"><span>words</span></div>
        <div class="kxrow pccr-o" data-for="invoice"><span>Make</span><select id="pccrInv"><option value="invoice">🧾 Invoice</option><option value="quote">📝 Quote</option><option value="receipt">🧾 Receipt</option></select></div>
        <div class="kxrow pccr-o" data-for="document story flyer brochure poster"><label><input type="checkbox" id="pccrPics"${store.get("create.pics", false) ? " checked" : ""}> 🖼 Pictures - made with the prompt docker's image style</label></div>
        <div class="pccr-o" data-for="website" style="color:var(--pc-dim)">3-5 web pages (1440 × 900) in 🌐 Web View - change them, then 🌐 Build Website.</div>
        <div class="pccr-o" data-for="card" style="color:var(--pc-dim)">Front + back at 300 dpi - pick the size (cardboard or PVC) in the next box.</div>
        <div class="pccr-o" data-for="brochure" style="color:var(--pc-dim)">A4 landscape tri-fold: page 1 = the outside (flap, back, cover), page 2 = the inside; fold lines as layers.</div>
        <div style="color:var(--pc-dim);margin-top:6px">The prompt docker's LLM writes it; bitGen lays it out as layers you can change.</div>`, (d) => {
        const kind = (d.querySelector('[name="pccrKind"]:checked') || {}).value || "flyer", v = (id) => d.querySelector("#" + id);
        store.set("create.kind", kind); store.set("create.pics", v("pccrPics").checked);
        make({ kind, ask: v("pccrAsk").value, pictures: v("pccrPics").checked, docKind: v("pccrDoc").value, words: kind === "story" ? +v("pccrSWords").value : +v("pccrWords").value, invoiceKind: v("pccrInv").value })
          .then((m) => say(m)).catch((e) => say("✨ " + e.message));
      }, { okLabel: "✨ Create", wide: true, init: (d) => {
        const show = () => { const k = (d.querySelector('[name="pccrKind"]:checked') || {}).value; d.querySelectorAll(".pccr-o").forEach((x) => { x.style.display = x.dataset.for.split(" ").includes(k) ? "" : "none"; }); };
        d.querySelectorAll('[name="pccrKind"]').forEach((r) => r.addEventListener("change", show)); show();
        // 2.875.0 (Tim: "when user clicks image-edit ai template business card, letterhead,flyer,poster the get user details"): a
        // click on one of those four opens the Business details dialog (pcbizinfo.js) with what is typed here
        d.querySelectorAll('[name="pccrKind"]').forEach((r) => r.addEventListener("click", () => {
          if (!BIZ_KINDS.includes(r.value) || !E.bizInfo) return;
          store.set("create.kind", r.value);
          const ask = (d.querySelector("#pccrAsk") || {}).value || "", pics = !!(d.querySelector("#pccrPics") || {}).checked;
          d.remove();
          E.bizInfo.dialog(r.value, { ask, pictures: pics });
        }));
        setTimeout(() => { const t = d.querySelector("#pccrAsk"); if (t) t.focus(); }, 0);
      } });
    }
    const css = doc.createElement("style");
    css.textContent = ".pccr-ks{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px}.pccr-k{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 4px;border:1px solid var(--pc-line);border-radius:8px;cursor:pointer;font-size:11px;text-align:center}"
      + ".pccr-k span{font-size:22px}.pccr-k input{position:absolute;opacity:0;pointer-events:none}.pccr-k:has(input:checked){border-color:var(--pc-accent);color:var(--pc-accent);background:var(--pc-on,rgba(245,158,44,.12))}";
    doc.head.appendChild(css);
    E.ui.addCmd("file.createai", "✨ Create With the AI…", "", () => dialog(), {}, ["File", "file.new"]);
    // the prompt docker: "make a flyer / brochure / business card for …" (documents, invoices, slides: their own routes)
    async function route(text) {
      const k = kindOf(text); if (!k) return null;
      const dock = doc.getElementById("imageeditdock"); if (dock && (dock.classList.contains("dockgone") || dock.classList.contains("collapsed"))) return null;
      // 2.875.0: your last saved business details ride along (the dialog is for a click; a typed ask uses what you kept)
      const business = BIZ_KINDS.includes(k) && E.bizInfo ? await E.bizInfo.last().catch(() => null) : null;
      return make({ kind: k, ask: String(text), pictures: store.get("create.pics", false), business });
    }
    root.H3ChatRoutes = [route].concat(root.H3ChatRoutes || []);
    E.create = { dialog, make, lay };
  }
  const PCCreate = Object.assign({ install }, pure);
  if (root && root.document) root.PCCreate = PCCreate;
})(typeof window !== "undefined" ? window : globalThis);
