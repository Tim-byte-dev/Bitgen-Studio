/* pcsite.js — 🌐 BUILD A WEBSITE FROM THE IMAGE EDITOR'S PAGES (2.843.0), window.PCSite.
 *
 * Tim (verbatim): "now everything is is place for an ai website builder, we can build the website in image editor and make it in
 * the language the user needs like php/mysql …" - his picks: static or PHP + MySQL per site, "AI makes it responsive".
 *   File ▸ 🌐 Build Website…: every page of the document is a web page (its name = the page's title in the menu); each page's
 *   visible layers become the site's elements - text layers (their words, size, colour, weight, alignment), WP layers (their
 *   rich text; their figures as <figure> pictures), every other layer as a picture (its pixels, cropped) - with their boxes on a
 *   1200 px wide design; a plain background layer = the page's colour. lib/siteBuild.js has the LLM write each page's
 *   responsive HTML + CSS (bitGen's own layout when it cannot), static or PHP + MySQL; 👁 the preview opens; ⤓ .zip.
 * Pure (Node: scripts/test-843.js): alphaBox, plainColour, figHtml.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  /** the box of the pixels with alpha in an RGBA array w x h (step 2) -> {x, y, w, h} | null */
  function alphaBox(d, w, h) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (d[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? null : { x: x0, y: y0, w: Math.min(w, x1 + 2) - x0, h: Math.min(h, y1 + 2) - y0 };
  }
  /** a background that is one colour (every sampled pixel the same, opaque) -> "#rrggbb" | null */
  function plainColour(d, w, h) {
    const at = (x, y) => { const i = (Math.min(h - 1, y) * w + Math.min(w - 1, x)) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };
    const pts = [[1, 1], [w - 2, 1], [1, h - 2], [w - 2, h - 2], [w >> 1, h >> 1], [w >> 2, h >> 2], [(3 * w) >> 2, (3 * h) >> 2]].map(([x, y]) => at(x, y));
    const f = pts[0]; if (f[3] < 250 || !pts.every((p) => Math.abs(p[0] - f[0]) + Math.abs(p[1] - f[1]) + Math.abs(p[2] - f[2]) < 6 && p[3] >= 250)) return null;
    return "#" + f.slice(0, 3).map((v) => v.toString(16).padStart(2, "0")).join("");
  }
  /** a WP layer's html with its figures' places -> <figure><img src><figcaption> (files by fig id; a place with none dropped) */
  function figHtml(html, files, document) {
    const d = document || root.document, box = d.createElement("div"); box.innerHTML = String(html || "");
    for (const p of [...box.querySelectorAll("p[data-fig]")]) {
      const f = files[p.getAttribute("data-fig")];
      if (!f) { if (p.textContent.trim()) { p.removeAttribute("data-fig"); p.removeAttribute("style"); } else p.remove(); continue; }
      const fig = d.createElement("figure"), img = d.createElement("img"); img.setAttribute("src", "assets/" + f); img.setAttribute("alt", p.textContent.trim());
      fig.appendChild(img); if (p.textContent.trim()) { const c = d.createElement("figcaption"); c.textContent = p.textContent.trim(); fig.appendChild(c); }
      p.parentNode.replaceChild(fig, p);
    }
    return box.innerHTML;
  }
  const pure = { alphaBox, plainColour, figHtml };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ================================ the page ================================ */
  function install(E) {
    const { S, D, doc, win, store } = E, say = E.say || (() => {});
    if (!E.ui || !E.ui.addCmd) return;
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const api = async (u, body) => { const r = await win.fetch(u, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}); const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status); return j; };
    const crop = (c, b, type) => { const o = E.newCanvas(b.w, b.h); o.getContext("2d").drawImage(c, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h); return o.toDataURL(type || "image/png").split(",")[1]; };
    /** this page's elements (S is the page in front - E.pages.eachPage swaps it) -> {w, h, bg, els, assets} */
    function pageSpec(pi) {
      const W = S.w, H = S.h, k = 1200 / W, sc = (b) => ({ x: Math.round(b.x * k), y: Math.round(b.y * k), w: Math.round(b.w * k), h: Math.round(b.h * k) });
      const all = S.layers, leaves = all.filter((L) => L.type !== "group" && L.visible !== false && (!D.shown || D.shown(all, L)));
      const els = [], assets = []; let bg = "#ffffff";
      const anchored = leaves.filter((L) => L.anchor && L.anchor.box && L.anchor.drawn);
      leaves.forEach((L, i) => {
        if (L.anchor && L.anchor.fig) return;                                      // in its WP layer's text
        if (L.type === "doc" && L.doc) {
          const files = {};
          for (const A of anchored.filter((x) => x.anchor.flow === (L.doc.flow && L.doc.flow.id))) { const n = `p${pi}-f${A.id}.png`; assets.push({ name: n, b64: crop(A.canvas, A.anchor.box) }); files[A.anchor.fig] = n; }
          els.push({ kind: "rich", html: figHtml(L.doc.html, files, doc), box: sc(L.doc) }); return;
        }
        const c = L.canvas; if (!c) return;
        let d = null; try { d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; } catch (e) { return; }
        if (i === 0 && L.type === "pixel") { const pc = plainColour(d, c.width, c.height); if (pc) { bg = pc; return; } }
        const b = alphaBox(d, c.width, c.height); if (!b || b.w < 2 || b.h < 2) return;
        if (L.cal) { els.push({ kind: "calendar", cal: L.cal, box: sc(b) }); return; }   // 2.846.0: 📅 a booking calendar (pccalendar.js)
        if (L.type === "text" && L.text && String(L.text.str || "").trim()) {
          const t = L.text;
          els.push({ kind: "text", text: String(t.str), size: Math.round((t.size || 16) * k), color: t.color || "#222222", bold: (t.weight || 400) >= 600 || !!t.bold, italic: !!t.italic, align: t.align || "left", font: t.font || "", box: sc(b) }); return;
        }
        const opaque = d[((b.y + (b.h >> 1)) * c.width + b.x + (b.w >> 1)) * 4 + 3] === 255 && b.w * b.h > 250000, n = `p${pi}-l${L.id}.${opaque ? "jpg" : "png"}`;
        assets.push({ name: n, b64: crop(c, b, opaque ? "image/jpeg" : "image/png") });
        els.push({ kind: "image", src: n, alt: L.name || "", box: sc(b) });
      });
      return { w: 1200, h: Math.round(H * k), bg, els, assets };
    }
    async function collect() {
      if (!S.w) throw new Error("open or make a document first");
      const pages = [], assets = [];
      const one = async (pg, i) => { const s = pageSpec(i); pages.push({ title: (pg && pg.name) || (i === 0 ? "Home" : "Page " + (i + 1)), w: s.w, h: s.h, bg: s.bg, els: s.els }); assets.push(...s.assets); };
      if (E.pages && E.pages.list().length && E.pages.eachPage) await E.pages.eachPage(one); else await one(null, 0);
      return { pages, assets };
    }
    async function build(o) {
      const a = o || {};
      say("🌐 gathering the pages…");
      const c = await collect();
      await api("/api/sites/save", { name: a.name, title: a.title, stack: a.stack, lang: a.lang, pages: c.pages, assets: c.assets });
      say(`🌐 building ${c.pages.length} page(s)` + (a.ai !== false ? " - ✨ the LLM writes each one" : "") + "…");
      const r = await api("/api/sites/build", { name: a.name, ai: a.ai !== false });
      store.set("site.last", JSON.stringify({ name: a.name, title: a.title, stack: a.stack, lang: a.lang, ai: a.ai !== false }));
      const by = r.pages.filter((p) => p.by === "ai").length;
      say(`🌐 "${a.name}" built - ${r.pages.length} page(s), ${by} by the AI${r.pages.length - by ? `, ${r.pages.length - by} laid out by bitGen` : ""} (${r.stack === "php" ? "PHP + MySQL" : "static"}) · 👁 the preview opened · ⤓ .zip from File ▸ 🌐 Build Website…`);
      if (a.open !== false && win.open) win.open(r.preview, "_blank");
      return r;
    }
    function dialog() {
      if (!S.w) return say("open or make a document first - each page of it becomes a web page");
      let last = {}; try { last = JSON.parse(store.get("site.last", "{}")) || {}; } catch (e) { /* none */ }
      const n = E.pages && E.pages.list().length ? E.pages.list().length : 1;
      E.ui.dialog("🌐 Build Website", `<div class="rw"><span>Name</span><input id="siteName" value="${esc(last.name || S.name || "My website")}" style="flex:1"></div>
        <div class="rw"><span>Site title</span><input id="siteTitle" value="${esc(last.title || last.name || "My website")}" style="flex:1"></div>
        <div class="rw"><span>Built with</span><select id="siteStack"><option value="static" ${last.stack !== "php" ? "selected" : ""}>Static HTML / CSS</option><option value="php" ${last.stack === "php" ? "selected" : ""}>PHP + MySQL</option></select><span>Language</span><input id="siteLang" value="${esc(last.lang || "en")}" style="width:60px"></div>
        <div class="rw"><label><input type="checkbox" id="siteAi" ${last.ai === false ? "" : "checked"}> ✨ The AI makes each page responsive (else bitGen lays it out)</label></div>
        <div style="color:var(--pc-dim);margin-top:6px">${n} page(s) → ${n} web page(s); each page's name is its title in the menu. Text layers stay text, WP layers keep their formatting and figures, everything else goes in as a picture.</div>
        <div class="rw" style="margin-top:6px"><button class="ghost" id="siteZip" type="button">⤓ .zip of the last build</button><button class="ghost" id="sitePrev" type="button">👁 Preview the last build</button></div>`, (dlg) => {
        const v = (id) => dlg.querySelector("#" + id).value.trim();
        build({ name: v("siteName"), title: v("siteTitle"), stack: v("siteStack"), lang: v("siteLang"), ai: dlg.querySelector("#siteAi").checked }).catch((e) => say("🌐 " + e.message));
      }, { okLabel: "🌐 Build", init: (dlg) => {
        const nm = () => dlg.querySelector("#siteName").value.trim();
        dlg.querySelector("#siteZip").onclick = () => { win.location.href = "/api/sites/zip?name=" + encodeURIComponent(nm()); };
        dlg.querySelector("#sitePrev").onclick = () => win.open("/sites-preview/" + encodeURIComponent(nm()) + "/index.html", "_blank");
      } });
    }
    E.ui.addCmd("file.website", "🌐 Build Website…", "", dialog, { enabled: () => !!S.w }, ["File", "file.tplsave"]);
    E.site = { collect, build, dialog, pageSpec };
  }
  const PCSite = Object.assign({ install }, pure);
  root.PCSite = PCSite;
})(typeof window !== "undefined" ? window : globalThis);
