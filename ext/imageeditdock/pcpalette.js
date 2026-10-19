/* pcpalette.js — CORELDRAW'S COLOUR PALETTE on the right of the image editor, the ⊠ TRANSPARENT colour and AUTO-FILL
 * of closed curves / shapes (2.430.0), window.PCPalette.
 *
 * Tim (verbatim): "add a transparent color to the color pallet. when a shape is drawn autofill it when it is closed" -
 * and with the plan: "create a pallet docker like coreldraw on the right side of the image-edit docker the autofill
 * color will be the last color selected".
 *
 *   THE PALETTE      a strip of colour chips down the right edge (Window ▸ Color Palette shows / hides it; ▾ picks the
 *                    palette: Default, Greys, Your swatches, Document colours), ⊠ (no colour) first, ▲ ▼ / the wheel
 *                    scroll it.
 *   A CLICK          CorelDRAW's way on a vector object (a curve, a shape, a live F6 shape, a shape layer) or type:
 *                    left-click = its FILL, right-click = its OUTLINE (⊠ = none) - every picked one (Ctrl-click in Layers)
 *                    or the active one, one undo step. On anything else: left = the foreground colour (⊠ = transparent:
 *                    a brush paints transparency, the bucket / Fill clear), right = the background colour.
 *   AUTO-FILL        a curve closed with any of the curve tools, a new F6 shape, a Pen / Shape tool shape is filled with
 *                    the colour picked LAST (the palette, a swatch, the colour pickers, the eyedropper); ⊠ last = not
 *                    filled. The curve tools' property bar: ▨ Auto-fill (on by default).
 *
 * Pure (Node: scripts/test-pspalette.js): DEFAULT (the chips), GREYS, autoFillOf (the last colour -> {fill, fillOn}),
 * isVector, docColours (the colours a document's shapes / type use).
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const hex2 = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  const rgbHex = (r, g, b) => "#" + hex2(r) + hex2(g) + hex2(b);
  function hsl(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return rgbHex(f(0) * 255, f(8) * 255, f(4) * 255);
  }
  /** black, the greys, white */
  const GREYS = ["#000000", "#1a1a1a", "#333333", "#4d4d4d", "#666666", "#808080", "#999999", "#b3b3b3", "#cccccc", "#e6e6e6", "#ffffff"];
  /** CorelDRAW-like default: black ... white, then 12 hues in 4 tones (deep, full, light, pale) */
  const DEFAULT = (() => {
    const out = ["#000000", "#333333", "#666666", "#999999", "#cccccc", "#ffffff"];
    const HUES = [0, 20, 40, 55, 75, 120, 160, 185, 205, 230, 270, 310];
    for (const [s, l] of [[100, 50], [100, 32], [90, 70], [80, 88]]) for (const h of HUES) out.push(hsl(h, s, l));
    out.push("#8b4513", "#a0522d", "#d2b48c", "#f5deb3");      // browns
    return out;
  })();
  const NONE = "none";
  /** the last colour picked -> what a new closed curve / shape gets */
  function autoFillOf(last, on, bg) {
    const c = typeof last === "string" && /^#[0-9a-f]{6}$/i.test(last) ? last.toLowerCase() : null;
    if (last === NONE) return { fill: bg || "#ffffff", fillOn: false };
    return { fill: c || bg || "#ffffff", fillOn: on !== false };
  }
  /** a layer the palette colours CorelDRAW's way (fill / outline) */
  const isVector = (L) => !!(L && ((L.type === "shape" && L.shape) || (L.type === "text" && L.text)));
  /** the colours a document uses in its shapes / type (fills, outlines, text) - the Document palette */
  function docColours(layers) {
    const seen = new Set(), out = [];
    const add = (c) => { if (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)) { const k = c.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(k); } } };
    for (const L of layers || []) {
      if (L.type === "shape" && L.shape) { if (L.shape.fillOn !== false) add(L.shape.fill); if (L.shape.strokeOn) add(L.shape.stroke); if (L.shape.fillGrad) { add(L.shape.fillGrad.c1); add(L.shape.fillGrad.c2); } }
      if (L.type === "text" && L.text) add(L.text.color);
      if (L.fill && L.fill.color) add(L.fill.color);
    }
    return out;
  }

  /* ================================ the page ================================ */
  function install(E) {
    const { S, D, doc, kx, $, say, store } = E;
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    if (!doc.getElementById("pcpaletteCss")) {
      const st = doc.createElement("style"); st.id = "pcpaletteCss";
      st.textContent = ".kx .pcpal{flex:none;width:24px;display:flex;flex-direction:column;align-items:center;gap:2px;padding:3px 0;border-left:1px solid var(--pc-line);background:var(--pc-panel);min-height:0}"
        + ".kx.pal-off .pcpal{display:none}.kx.narrow .pcpal{position:relative;z-index:21}"
        + ".kx .pcpal button{width:18px;min-width:0;min-height:0;padding:0;border:1px solid var(--pc-line);border-radius:2px;background:none;color:var(--pc-dim);font-size:9px;line-height:12px;cursor:pointer}"
        + ".kx .pcpal .pm{height:14px}.kx .pcpal .ar{height:12px}.kx .pcpal button:hover{color:var(--pc-accent);border-color:var(--pc-accent)}"
        + ".kx .pcpal .ch{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:2px;scrollbar-width:none}.kx .pcpal .ch::-webkit-scrollbar{display:none}"
        + ".kx .pcpal .c{flex:none;width:18px;height:16px;border:1px solid rgba(0,0,0,.6);box-shadow:0 0 0 1px rgba(255,255,255,.08);border-radius:2px;cursor:pointer;padding:0}"
        + ".kx .pcpal .c.none,.kx .pcsw.none{background:linear-gradient(to top right,transparent calc(50% - 1px),#e02020 calc(50% - 1px),#e02020 calc(50% + 1px),transparent calc(50% + 1px)),#fff!important}"
        + ".kx .pcpal .c.last{outline:2px solid var(--pc-accent);outline-offset:0}"
        + ".kx .pcpal .c:hover{transform:scale(1.25);position:relative;z-index:2}";
      doc.head.appendChild(st);
    }
    let which = store.get("pal.which", "default");
    const strip = doc.createElement("div"); strip.className = "pcpal"; strip.id = "pcPalette"; strip.setAttribute("role", "toolbar"); strip.setAttribute("aria-label", "Color palette");
    strip.innerHTML = '<button type="button" class="pm" id="pcPalMenu" title="The palette: Default, Greys, Your swatches, Document colours">▾</button><button type="button" class="ar" id="pcPalUp" title="Scroll up">▲</button><div class="ch" id="pcPalChips"></div><button type="button" class="ar" id="pcPalDn" title="Scroll down">▼</button>';
    kx.querySelector(".kxmain").appendChild(strip);
    if (store.get("pal.off", false)) kx.classList.add("pal-off");
    const chips = $("pcPalChips");

    function colours() {
      if (which === "greys") return GREYS;
      if (which === "mine") return store.get("swatches", []).filter((c) => /^#[0-9a-f]{6}$/i.test(c));
      if (which === "document") return docColours(S.layers);
      return DEFAULT;
    }
    function paint() {
      const last = String(S.lastColor || "").toLowerCase();
      chips.innerHTML = `<button type="button" class="c none${last === NONE ? " last" : ""}" data-c="none" title="⊠ No colour - click: no fill / a transparent foreground · right-click: no outline"></button>`
        + colours().map((c) => `<button type="button" class="c${c.toLowerCase() === last ? " last" : ""}" data-c="${esc(c)}" style="background:${esc(c)}" title="${esc(c)} - click: fill (the foreground colour) · right-click: outline (the background colour)"></button>`).join("");
    }
    /** the picked vector layers (Ctrl-click in Layers) or the active one */
    function targets() {
      const picks = E.picked ? E.picked().filter(isVector) : [];
      if (picks.length) return picks;
      const L = E.layer(); return isVector(L) ? [L] : [];
    }
    function colourVector(Ls, c, outline) {
      const before = E.snapStruct();
      for (const L of Ls) {
        if (L.type === "text") { if (outline) continue; if (c !== NONE) L.text.color = c; }
        else if (outline) {
          if (c === NONE) L.shape.strokeOn = false;
          else { L.shape.stroke = c; L.shape.strokeOn = true; if (!(L.shape.strokeW > 0)) L.shape.strokeW = Math.max(1, S.vlW || 1); }
        } else if (c === NONE) L.shape.fillOn = false;
        else { L.shape.fill = c; L.shape.fillOn = true; delete L.shape.fillGrad; }
        D.rasterize(L);
      }
      E.push({ t: "struct", before, after: E.snapStruct(), label: outline ? "outline colour" : "fill colour" });
      E.refresh(); E.renderLayersPanel(); E.renderOptions();
      if (E.ui.dockers) E.ui.dockers();
    }
    function pick(c, outline) {
      const Ls = targets();
      if (Ls.length && S.w) {
        colourVector(Ls, c, outline);
        if (!outline) { S.lastColor = c; store.set("lastColor", c); }
        say(`${outline ? "outline" : "fill"}: ${c === NONE ? "none" : c} (${Ls.length} object${Ls.length > 1 ? "s" : ""})`);
      } else if (outline) { if (c === NONE) return say("⊠ right-click = no outline - on a vector object (the background colour can not be transparent)"); E.setBg(c); }
      else if (c === NONE) { E.setFgNone(); say("⊠ the foreground is transparent: a brush paints transparency, the bucket / Fill clear - new curves are not filled"); }
      else E.setFg(c);
      paint();
    }
    chips.addEventListener("click", (e) => { const b = e.target.closest(".c"); if (b) pick(b.dataset.c, false); });
    chips.addEventListener("contextmenu", (e) => { const b = e.target.closest(".c"); if (!b) return; e.preventDefault(); pick(b.dataset.c, true); });
    $("pcPalUp").onclick = () => { chips.scrollTop -= 80; };
    $("pcPalDn").onclick = () => { chips.scrollTop += 80; };
    $("pcPalMenu").onclick = () => {
      const r = $("pcPalMenu").getBoundingClientRect(), kr = kx.getBoundingClientRect();
      E.ui.menuAt(["pal.default", "pal.greys", "pal.mine", "pal.document", E.ui.sep, "pal.hide"], Math.max(0, r.left - kr.left - 170), r.bottom - kr.top, 0);
    };
    const prevColor = E.ui.color;
    E.ui.color = function () { const r = prevColor ? prevColor.apply(this, arguments) : undefined; paint(); return r; };

    /* the Swatches panel gets ⊠ too */
    const sw = $("pcSwatches");
    function swNone() {
      if (!sw || sw.querySelector(".pcsw.none")) return;
      const grid = sw.querySelector("div"); if (!grid) return;
      const b = doc.createElement("button"); b.className = "ghost pcsw none"; b.type = "button"; b.dataset.c = NONE;
      b.title = "⊠ Transparent - click = the foreground is transparent (a brush paints transparency); on a vector object: no fill";
      b.style.cssText = "width:18px;height:18px;min-height:0;padding:0";
      b.onclick = () => pick(NONE, false);
      grid.insertBefore(b, grid.firstChild);
    }
    if (sw && typeof root.MutationObserver === "function") new root.MutationObserver(swNone).observe(sw, { childList: true });
    swNone();

    /* the autofill colour: the last one picked */
    E.autoFill = (always) => autoFillOf(S.lastColor, always ? true : S.vlFillOn, S.bg);   // always = a Pen / Shape tool shape (no ▨ toggle)
    E.fillColor = () => (S.lastColor && S.lastColor !== NONE ? S.lastColor : null);

    /* ---------------- commands ---------------- */
    const C = E.ui.addCmd;
    const setWhich = (w) => { which = w; store.set("pal.which", w); kx.classList.remove("pal-off"); store.set("pal.off", false); paint(); };
    C("pal.default", "Palette: Default", "", () => setWhich("default"), { checked: () => which === "default" });
    C("pal.greys", "Palette: Greys", "", () => setWhich("greys"), { checked: () => which === "greys" });
    C("pal.mine", "Palette: Your Swatches", "", () => setWhich("mine"), { checked: () => which === "mine" });
    C("pal.document", "Palette: Document Colours", "", () => setWhich("document"), { checked: () => which === "document" });
    C("pal.hide", "Palette: Hide", "", () => { kx.classList.add("pal-off"); store.set("pal.off", true); });
    C("win.palette", "Color Palette", "", () => { const off = !kx.classList.contains("pal-off"); kx.classList.toggle("pal-off", off); store.set("pal.off", off); if (!off) paint(); }, { checked: () => !kx.classList.contains("pal-off") }, ["Window", "win.pcSwatches"]);
    const prevLayers = E.ui.layers;
    if (prevLayers) E.ui.layers = function () { const r = prevLayers.apply(this, arguments); if (which === "document") paint(); return r; };
    paint();
    E.palette = { paint, pick, colours, which: () => which };
  }

  const PCPalette = { DEFAULT, GREYS, NONE, hsl, autoFillOf, isVector, docColours, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCPalette;
  else root.PCPalette = PCPalette;
})(typeof window !== "undefined" ? window : globalThis);
