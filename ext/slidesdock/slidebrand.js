/* ext/slidesdock/slidebrand.js — 🎞 A THEME BUILT FROM BRAND COLOURS (2.835.0), window.H3SlideBrand.
 *
 * Tim: "add charts and tables on slides, or a theme built from brand colours".
 *   🎨 Theme ▾ ▸ 🎨 Brand theme…  a box: the brand's name, Background / Titles / Text / Accent 1 / Accent 2 (the accents colour
 *                 shapes, bullets, table headers and the chart series), the title and text fonts; 🖼 From a logo… takes the
 *                 colours out of a picture (light or dark background); a live preview slide (title, bullets, a table row, a
 *                 chart); ✔ Use in this presentation (one undo) / 💾 Save brand (kept for every project: <app>/brands/,
 *                 lib/slideBrands.js)
 *   🎨 Theme ▾ lists the saved brands under the built-in themes (click = use it, ✎ = change it, 🗑 = delete it).
 *   The deck keeps its brand (deck.theme "brand" + deck.brand - slidecore.cleanBrand), so it travels in the .bgk / the
 *   .pptx (the colours are written in) without the brand file.
 * Pure (Node: scripts/test-835.js): palette, brandFrom, hexOf.
 */
(function (root) {
  "use strict";
  const K = () => root.SlideCore || (typeof require === "function" ? require("./slidecore.js") : null);
  /* ================================ pure ================================ */
  const hexOf = (r, g, b) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  function hsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0; let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: (h * 60 + 360) % 360, s, l }; }
  /** a picture's main colours: rgba bytes (w*h*4) -> up to n colours [{hex, n (share 0..1), s, l}], most used first
   *  (k-means on the visible pixels; near-white / near-black / see-through kept apart so a logo's background does not win) */
  function palette(data, n) {
    const pts = []; for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 128) pts.push([data[i], data[i + 1], data[i + 2]]);
    if (!pts.length) return [];
    const k = Math.min(n || 6, pts.length);
    let cs = []; for (let j = 0; j < k; j++) cs.push(pts[Math.floor((j + 0.5) * pts.length / k)].slice());
    const as = new Int32Array(pts.length);
    for (let it = 0; it < 12; it++) {
      const sum = cs.map(() => [0, 0, 0, 0]);
      pts.forEach((p, i) => { let b = 0, bd = Infinity; cs.forEach((c, j) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; b = j; } }); as[i] = b; const s = sum[b]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; });
      cs = cs.map((c, j) => (sum[j][3] ? [sum[j][0] / sum[j][3], sum[j][1] / sum[j][3], sum[j][2] / sum[j][3]] : c));
    }
    const cnt = cs.map(() => 0); for (const a of as) cnt[a]++;
    return cs.map((c, j) => Object.assign({ hex: hexOf(c[0], c[1], c[2]), n: cnt[j] / pts.length }, hsl(c[0], c[1], c[2]))).filter((c) => c.n > 0).sort((a, b) => b.n - a.n);
  }
  /** colours (a palette) -> a brand {bg, title, text, accent, accent2}: the two most used colourful ones = the accents (a dark
   *  enough / light enough step of them so they read on the background), the background white / near-black, the titles
   *  the first accent darkened (light) or near-white (dark) */
  function brandFrom(cols, mode) {
    const dark = mode === "dark", list = (cols || []).filter((c) => c && c.hex);
    const vivid = list.filter((c) => c.s > 0.25 && c.l > 0.12 && c.l < 0.9).sort((a, b) => b.n * (0.5 + b.s) - a.n * (0.5 + a.s));
    const far = (a, b) => { const x = rgbOf(a), y = rgbOf(b); return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]) > 90; };
    const acc = vivid[0] ? vivid[0].hex : (list[0] && list[0].hex) || "#2f6fde";
    const acc2 = (vivid.find((c) => far(c.hex, acc)) || list.find((c) => far(c.hex, acc) && c.l > 0.1 && c.l < 0.92) || { hex: "#e8743b" }).hex;
    const mix = (h, t, k) => { const a = rgbOf(h), b = rgbOf(t); return hexOf(a[0] * (1 - k) + b[0] * k, a[1] * (1 - k) + b[1] * k, a[2] * (1 - k) + b[2] * k); };
    const fit = (h) => { const c = hsl(...rgbOf(h)); return dark ? (c.l < 0.45 ? mix(h, "#ffffff", 0.35) : h) : (c.l > 0.6 ? mix(h, "#000000", 0.3) : h); };
    const bg = dark ? "#14161b" : "#ffffff";
    return { bg, title: dark ? "#f4f5f7" : mix(fit(acc), "#000000", 0.45), text: dark ? "#cfd3d9" : "#33373d", accent: fit(acc), accent2: fit(acc2) };
  }
  const pure = { palette, brandFrom, hexOf, hsl };
  if (typeof module !== "undefined" && module.exports) module.exports = pure;

  /* ================================ the page ================================ */
  const doc = root.document; if (!doc) return;
  const H = () => root.H3Slides;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let brands = [];
  async function load() { try { const r = await fetch("/api/slides/brands"); const j = await r.json(); brands = (j && j.brands) || []; } catch (e) { brands = []; } return brands; }
  async function save(b) { const r = await fetch("/api/slides/brands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "HTTP " + r.status); await load(); return j.brand; }
  async function remove(name) { await fetch("/api/slides/brands?name=" + encodeURIComponent(name), { method: "DELETE" }); await load(); }
  function use(b) {
    const c = K().cleanBrand(b); if (!c) return H().msg("✗ that brand is missing a colour", true), null;
    const ed = H(); ed.step(); const d = ed.deck(); d.theme = "brand"; d.brand = c; ed.changed(); ed.msg("🎨 " + c.name + " - Ctrl+Z goes back");
    return c;
  }
  const sw = (b) => `<span class="sw" style="background:${b.bg};border-left:6px solid ${b.accent};box-shadow:inset -6px 0 0 ${b.accent2}"></span>`;
  /** the Theme ▾ menu (slidesdock.js themeMenu) gets the saved brands + 🎨 Brand theme… */
  async function extend(m) {
    const d = H().deck(), cur = d.theme === "brand" && d.brand ? d.brand : null;
    const paint = () => {
      m.querySelectorAll("[data-bx]").forEach((x) => x.remove());
      let html = `<hr data-bx>`;
      if (cur && !brands.some((b) => b.name === cur.name)) html += `<div data-bx data-b="__cur" class="on">${sw(cur)} ${esc(cur.name)} <span style="color:var(--dim)">(this presentation's)</span></div>`;
      html += brands.map((b, i) => `<div data-bx data-b="${i}"${cur && cur.name === b.name ? ' class="on"' : ""}>${sw(b)} <span data-noi18n>${esc(b.name)}</span> <span style="color:var(--dim);font-family:'${esc(b.font)}'">${esc(b.font)}</span><span style="margin-left:auto;display:flex;gap:6px"><span data-be="${i}" title="Change this brand">✎</span><span data-bd="${i}" title="Delete this brand">🗑</span></span></div>`).join("");
      html += `<div data-bx data-bnew>🎨 Brand theme…</div>`;
      m.insertAdjacentHTML("beforeend", html);
    };
    paint(); await load(); if (m.isConnected) paint();
    m.addEventListener("click", async (e) => {
      const be = e.target.closest("[data-be]"), bd = e.target.closest("[data-bd]"), b = e.target.closest("[data-b]"), nw = e.target.closest("[data-bnew]");
      if (!be && !bd && !b && !nw) return;
      e.stopPropagation(); m.remove();
      if (be) return dialog(brands[+be.dataset.be]);
      if (bd) { const x = brands[+bd.dataset.bd]; if (x && (typeof root.appConfirm !== "function" || await root.appConfirm(`Delete the brand "${x.name}"? (presentations using it keep their colours)`, "Delete brand"))) { await remove(x.name); H().msg("🗑 " + x.name + " deleted"); } return; }
      if (nw) return dialog(cur || null);
      if (b.dataset.b === "__cur") return use(cur);
      use(brands[+b.dataset.b]);
    }, true);
  }
  /** the brand box (b = a brand to change, else the current look) */
  function dialog(b) {
    doc.querySelectorAll("#slBrandBox").forEach((x) => x.remove());
    const T = K().theme(H().deck()), start = K().cleanBrand(b) || { name: "", bg: T.bg, title: T.title, text: T.text, accent: T.accent, accent2: T.accent2 || "#e8743b", font: T.font, titleFont: T.titleFont };
    const box = doc.createElement("div"); box.id = "slBrandBox";
    const COLS = [["bg", "Background"], ["title", "Titles"], ["text", "Text"], ["accent", "Accent 1"], ["accent2", "Accent 2"]];
    box.innerHTML = `<div class="hd2"><b>🎨 Brand theme</b><button class="ghost" type="button" data-x style="margin-left:auto">✕</button></div>
      <div class="bd">
        <div class="row"><label>Name <input type="text" id="sbName" value="${esc(start.name)}" placeholder="e.g. Tiger Art" style="width:200px"></label>
          <button class="ghost" type="button" id="sbLogo" title="Take the colours out of a logo or any picture">🖼 From a logo…</button><input type="file" id="sbLogoFile" accept="image/*" hidden>
          <label><input type="radio" name="sbMode" value="light" checked> Light background</label><label><input type="radio" name="sbMode" value="dark"> Dark</label></div>
        <div class="row" id="sbLogoRow" hidden><span class="dim">The logo's colours (click one for Accent 1, Shift+click for Accent 2):</span><span class="sws" id="sbSws"></span></div>
        <div class="row">${COLS.map(([k, n]) => `<label>${n} <input type="color" id="sb_${k}" value="${start[k]}"></label>`).join("")}</div>
        <div class="row"><label>Title font <input type="text" id="sbTFont" list="sbFonts" value="${esc(start.titleFont)}" style="width:150px"></label><label>Text font <input type="text" id="sbFont" list="sbFonts" value="${esc(start.font)}" style="width:150px"></label>
          <datalist id="sbFonts">${K().FONTS.map((f) => `<option value="${esc(f)}">`).join("")}</datalist></div>
        <div class="prev" id="sbPrev"></div>
        <div class="row"><span id="sbSay" class="dim"></span><span style="margin-left:auto"></span><button class="ghost" type="button" id="sbSave" title="Keep it for every project (the Theme ▾ list)">💾 Save brand</button><button type="button" id="sbUse">✔ Use in this presentation</button><button class="ghost" type="button" data-x>Cancel</button></div>
      </div>`;
    doc.body.appendChild(box);
    const q = (s) => box.querySelector(s), close = () => box.remove();
    box.querySelectorAll("[data-x]").forEach((x) => (x.onclick = close));
    box.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") close(); });
    const now = () => ({ name: q("#sbName").value.trim() || "Brand", bg: q("#sb_bg").value, title: q("#sb_title").value, text: q("#sb_text").value, accent: q("#sb_accent").value, accent2: q("#sb_accent2").value, font: q("#sbFont").value.trim(), titleFont: q("#sbTFont").value.trim() });
    function preview() {
      const deck = K().newDeck("plain", H().deck().w === 960 ? "4:3" : "16:9"); deck.theme = "brand"; deck.brand = K().cleanBrand(now());
      const s = K().newSlide("titleonly", deck), W = deck.w, Hh = deck.h;
      s.items[0].text = (q("#sbName").value.trim() || "Your brand") + " - the look";
      s.items.push({ id: "t", type: "text", x: Math.round(W * 0.06), y: Math.round(Hh * 0.28), w: Math.round(W * 0.4), h: Math.round(Hh * 0.3), text: "Bullets in the accent\nText in the text colour\nTitles in the title colour", st: { bullets: true, size: 26 } });
      s.items.push(Object.assign(K().newTable(deck, 3, 3), { x: Math.round(W * 0.06), y: Math.round(Hh * 0.62), w: Math.round(W * 0.4), h: Math.round(Hh * 0.3), rows: [["Plan", "Q1", "Q2"], ["Sales", "12", "19"], ["Costs", "8", "11"]] }));
      s.items.push(Object.assign(K().newChart(deck, "column"), { x: Math.round(W * 0.52), y: Math.round(Hh * 0.26), w: Math.round(W * 0.42), h: Math.round(Hh * 0.66) }));
      s.items.push({ id: "sh", type: "shape", shape: "round", x: Math.round(W * 0.52), y: Math.round(Hh * 0.06), w: Math.round(W * 0.06), h: Math.round(Hh * 0.08), text: "" });
      const el = H().renderSlide(s, deck, "show"), pv = q("#sbPrev"); pv.innerHTML = ""; pv.appendChild(el);
      const k = pv.clientWidth / deck.w; el.style.transform = `scale(${k})`;
    }
    box.addEventListener("input", (e) => { if (e.target.closest("input")) preview(); });
    box.addEventListener("change", (e) => { if (e.target.name === "sbMode" && lastCols) apply(brandFrom(lastCols, e.target.value)); });
    let lastCols = null;
    const apply = (c) => { for (const k of ["bg", "title", "text", "accent", "accent2"]) if (c[k]) q("#sb_" + k).value = c[k]; preview(); };
    q("#sbLogo").onclick = () => q("#sbLogoFile").click();
    q("#sbLogoFile").onchange = async (e) => {
      const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
      try {
        const bmp = await createImageBitmap(f), k = Math.min(1, 96 / Math.max(bmp.width, bmp.height)), c = doc.createElement("canvas"); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
        const g = c.getContext("2d"); g.drawImage(bmp, 0, 0, c.width, c.height);
        lastCols = palette(g.getImageData(0, 0, c.width, c.height).data, 7);
        const mode = (box.querySelector("[name=sbMode]:checked") || {}).value || "light";
        apply(brandFrom(lastCols, mode));
        q("#sbSws").innerHTML = lastCols.map((x, i) => `<span data-sw="${i}" title="${x.hex} - ${Math.round(x.n * 100)} %" style="background:${x.hex}"></span>`).join("");
        q("#sbLogoRow").hidden = false;
        if (!q("#sbName").value.trim()) q("#sbName").value = f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 48);
        q("#sbSay").textContent = `the colours of ${f.name} - change any of them`;
      } catch (er) { q("#sbSay").textContent = "✗ could not read that picture"; }
    };
    q("#sbSws").addEventListener("click", (e) => { const s = e.target.closest("[data-sw]"); if (!s || !lastCols) return; q(e.shiftKey ? "#sb_accent2" : "#sb_accent").value = lastCols[+s.dataset.sw].hex; preview(); });
    q("#sbUse").onclick = () => { if (use(now())) close(); };
    q("#sbSave").onclick = async () => {
      if (!q("#sbName").value.trim()) { q("#sbSay").textContent = "give the brand a name first"; q("#sbName").focus(); return; }
      try { const s = await save(now()); q("#sbSay").textContent = `💾 "${s.name}" saved - it is in 🎨 Theme ▾ for every project`; } catch (er) { q("#sbSay").textContent = "✗ " + er.message; }
    };
    setTimeout(preview, 0);
    q("#sbName").focus();
    return box;
  }
  root.H3SlideBrand = Object.assign({ extend, dialog, use, load, save, remove, list: () => brands }, pure);
})(typeof window !== "undefined" ? window : globalThis);
