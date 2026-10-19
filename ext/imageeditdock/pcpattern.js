/* pcpattern.js — THE PATTERN LIBRARY (2.437.0), window.PCPattern.
 *
 * Tim (verbatim): "continue with the photoshop gap closure" - the gap list's "Pattern library" (docs/PHOTOSHOP-GAP.md).
 *   THE LIBRARY   patterns/<name>.png in the install folder (lib/patternStore.js, routes/patterns.js) - every project
 *                 and document uses the same ones; copy .png files into it to share them.
 *   DEFINE        Edit ▸ Define Pattern… - the selection's box of the picture as it looks (or the whole picture) -> a
 *                 name -> the library.
 *   THE PANEL     Edit ▸ Pattern Library… - the patterns as tiles: ▦ = a new Pattern fill layer with it, ✕ = delete;
 *                 ⤒ Import PNG… adds a picture file; ＋ Define Pattern….
 *   USE           Layer ▸ New Fill Layer ▸ Pattern… (a live fill layer: the pattern, its scale, an offset - Properties
 *                 changes them); Edit ▸ Fill… ▸ Contents: Pattern (into the selection / the layer, mode + opacity);
 *                 Layer Style ▸ Pattern Overlay lists them as user:<name> beside the built-in ten. A .bgi keeps the
 *                 patterns it uses inside, and adds them to the library where it is opened.
 *
 *   scaled(name, scale%)   the tile at its scale (a canvas) - null while it loads (the layers using it are drawn again
 *                          when it is in: pcdoc.js drawFill, pcstyles.js patternFill call this)
 *   names()                the library's names (as last listed)
 * Pure (Node: scripts/test-genfill.js): usesOf(layer) - the library patterns a layer uses; scaleOf.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const scaleOf = (s) => { const v = Number(s); return Number.isFinite(v) && v > 0 ? Math.max(1, Math.min(1000, v)) : 100; };
  /** the library patterns a layer's settings use (a pattern fill, a Pattern Overlay style user:<name>) */
  function usesOf(L) {
    const o = [];
    if (L && L.fill && L.fill.kind === "pattern" && L.fill.pattern) o.push(String(L.fill.pattern));
    const po = L && L.styles && L.styles.patternOverlay;
    if (po && /^user:/.test(po.pattern || "")) o.push(po.pattern.slice(5));
    return o;
  }

  /* ================================ the tiles ================================ */
  const TILES = new Map();          // name -> {canvas | null, loading, ver}
  const SCALED = new Map();         // name|scale -> canvas
  let LIB = [];                     // [{name, w, h, size, mtime}]
  const waiting = new Set();        // functions to call when a tile comes in
  function doc() { return root.document; }
  function load(name, ver) {
    const old = TILES.get(name);                      // a reload keeps the tile it has until the new one is in
    const rec = { canvas: old && old.canvas ? old.canvas : null, loading: true, ver: ver || 0 };
    TILES.set(name, rec);
    const im = new root.Image();
    im.onload = () => {
      const c = doc().createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext("2d").drawImage(im, 0, 0);
      rec.canvas = c; rec.loading = false;
      for (const k of [...SCALED.keys()]) if (k.startsWith(name + "|")) SCALED.delete(k);
      for (const f of [...waiting]) { try { f(name); } catch (e) { /* fine */ } }
    };
    im.onerror = () => { rec.loading = false; };
    im.src = "/api/patterns/file/" + encodeURIComponent(name) + "?v=" + (ver || 0);
    return rec;
  }
  function tile(name) {
    if (!name) return null;
    const r = TILES.get(name) || load(name, (LIB.find((p) => p.name === name) || {}).mtime);
    return r.canvas;
  }
  function scaled(name, scale) {
    const t = tile(name); if (!t) return null;
    const s = scaleOf(scale), key = name + "|" + s;
    if (s === 100) return t;
    if (SCALED.has(key)) return SCALED.get(key);
    const c = doc().createElement("canvas"); c.width = Math.max(1, Math.round(t.width * s / 100)); c.height = Math.max(1, Math.round(t.height * s / 100));
    const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(t, 0, 0, c.width, c.height);
    SCALED.set(key, c); return c;
  }
  /** put a tile in directly (a .bgi's own pattern, a just-defined one) */
  function adoptCanvas(name, c) { TILES.set(name, { canvas: c, loading: false, ver: Date.now() }); for (const k of [...SCALED.keys()]) if (k.startsWith(name + "|")) SCALED.delete(k); for (const f of [...waiting]) { try { f(name); } catch (e) { /* fine */ } } }
  async function refresh() {
    try { LIB = (await (await root.fetch("/api/patterns")).json()).patterns || []; } catch (e) { LIB = LIB || []; }
    for (const p of LIB) { const r = TILES.get(p.name); if (r && r.ver !== p.mtime && !r.loading) load(p.name, p.mtime); }
    // the Pattern Overlay style's list: the built-in ten + user:<name>
    const F = root.PCStyles && root.PCStyles.FIELDS && root.PCStyles.FIELDS.patternOverlay;
    if (F && F[0] && Array.isArray(F[0][3])) { const opts = F[0][3]; for (let i = opts.length - 1; i >= 0; i--) if (/^user:/.test(opts[i])) opts.splice(i, 1); for (const p of LIB) opts.push("user:" + p.name); }
    return LIB;
  }
  const names = () => LIB.map((p) => p.name);

  /* ================================ the editor ================================ */
  function install(E) {
    const S = E.S, D = E.D || root.PCDoc, say = E.say, d0 = E.doc || doc();
    if (!E.ui || !E.ui.addCmd) return;
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const newCanvas = (w, h) => { const c = d0.createElement("canvas"); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };
    const blobOf = (c) => new Promise((r) => c.toBlob(r, "image/png"));
    // a tile came in: the layers that use it are drawn again
    waiting.add((name) => {
      if (!S.w) return;
      let n = 0;
      for (const L of S.layers) if (usesOf(L).includes(name)) { if (D.isLive(L)) D.rasterize(L); L.ver = (L.ver || 0) + 1; n++; }
      if (n) { E.refresh(); if (E.ui.props) E.ui.props(); }
    });
    async function saveCanvas(name, c) {
      const r = await root.fetch("/api/patterns/save?name=" + encodeURIComponent(name), { method: "POST", headers: { "Content-Type": "image/png" }, body: await blobOf(c) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || "the pattern was refused");
      adoptCanvas(j.name, c); await refresh(); paintPanel();
      return j;
    }
    /** the part to make a pattern of: the selection's box of the picture as it looks (else all of it) */
    function sourceCanvas() {
      const flat = E.flatten(); let b = { x: 0, y: 0, w: S.w, h: S.h };
      if (E.hasSel() && E.P && E.P.bbox) { const bb = E.P.bbox(S.sel, S.w, S.h); if (bb) b = bb; }
      const c = newCanvas(b.w, b.h); c.getContext("2d").drawImage(flat, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
      return c;
    }
    function defineDialog() {
      if (!S.w) return say("open a picture first");
      const c = sourceCanvas();
      if (c.width > 4096 || c.height > 4096) return say(`a pattern is at most 4096 × 4096 - select a smaller part (this is ${c.width} × ${c.height})`);
      const k = Math.min(1, 96 / Math.max(c.width, c.height));
      E.ui.dialog("Define Pattern", `<div class="kxrow"><canvas id="dpPrev" width="${Math.max(1, Math.round(c.width * k))}" height="${Math.max(1, Math.round(c.height * k))}" style="border:1px solid var(--pc-line);background:repeating-conic-gradient(#888 0 25%,#bbb 0 50%) 0 0/12px 12px"></canvas>
        <span style="color:var(--pc-dim)">${c.width} × ${c.height} px - ${E.hasSel() ? "the selection's box" : "the whole picture"}, as it looks</span></div>
        <div class="kxrow"><span>Name</span><input type="text" id="dpN" value="${esc(String(S.name || "Pattern").replace(/\.[a-z0-9]+$/i, "") + " " + (LIB.length + 1))}" style="flex:1"></div>
        <div class="kxrow" style="color:var(--pc-dim)">Kept in the pattern library (patterns/&lt;name&gt;.png in the install folder) - for Pattern fill layers, Edit ▸ Fill and the Pattern Overlay style.</div>`,
      (dl) => { const n = dl.querySelector("#dpN").value.trim(); if (!n) return say("give the pattern a name"); saveCanvas(n, c).then((j) => say(`pattern "${j.name}" (${j.w} × ${j.h}) added to the library`), (e) => say("Define Pattern: " + e.message)); }, { okLabel: "＋ Define" });
      const pv = d0.getElementById("dpPrev"); if (pv) pv.getContext("2d").drawImage(c, 0, 0, pv.width, pv.height);
      const n = d0.getElementById("dpN"); if (n) n.addEventListener("keydown", (e) => e.stopPropagation());
    }
    function newPatternFill(name) {
      if (!S.w) return say("open a picture first");
      const nm = name || names()[0]; if (!nm) return say("the pattern library is empty - Edit ▸ Define Pattern… first");
      const L = E.newFill("solid"); if (!L) return null;
      E.setLayer(L, "pattern fill", (x) => { x.name = "Pattern Fill"; x.fill = { kind: "pattern", pattern: nm, scale: 100, ox: 0, oy: 0 }; });
      tile(nm); if (E.ui.props) E.ui.props();
      return L;
    }
    function fillWith(name, opacity, blend) {
      if (!S.w) return say("open a picture first");
      const t = scaled(name, 100); if (!t) { say("the pattern is still loading - try again in a moment"); tile(name); return false; }
      const pat = t.getContext("2d").createPattern(t, "repeat");
      return E.fillSelection(pat, opacity == null ? 1 : opacity, blend || "normal");
    }
    async function remove(name) {
      try { const r = await root.fetch("/api/patterns/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }); await r.json(); }
      catch (e) { return say("delete: " + e.message); }
      TILES.delete(name); await refresh(); paintPanel(); say(`pattern "${name}" deleted from the library`);
    }
    /* ---- the Pattern Library dialog ---- */
    let panel = null;
    function paintPanel() {
      if (!panel || !panel.isConnected) return;
      const grid = panel.querySelector("#plGrid"); if (!grid) return;
      grid.innerHTML = LIB.length ? LIB.map((p) => `<div class="pltile" data-n="${esc(p.name)}" title="${esc(p.name)} - ${p.w} × ${p.h}"><img alt="" src="/api/patterns/file/${encodeURIComponent(p.name)}?v=${p.mtime}"><span>${esc(p.name)}</span>
          <button type="button" class="ghost plfill" title="A new Pattern fill layer with it">▦</button><button type="button" class="ghost pldel" title="Delete it from the library">✕</button></div>`).join("")
        : `<div style="color:var(--pc-dim)">The library is empty - ＋ Define Pattern… makes one from the picture, ⤒ Import PNG… adds a picture file.</div>`;
      grid.querySelectorAll(".pltile").forEach((el) => {
        const n = el.dataset.n;
        el.querySelector(".plfill").onclick = () => newPatternFill(n);
        el.querySelector(".pldel").onclick = () => remove(n);
      });
    }
    async function libraryDialog() {
      await refresh();
      E.ui.dialog("Pattern Library", `<style>.plgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px;max-height:52vh;overflow:auto}
        .pltile{position:relative;border:1px solid var(--pc-line);border-radius:6px;padding:4px;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px}
        .pltile img{width:80px;height:80px;object-fit:cover;image-rendering:auto;background:repeating-conic-gradient(#888 0 25%,#bbb 0 50%) 0 0/12px 12px}
        .pltile span{max-width:86px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pltile .plfill{position:absolute;left:4px;top:4px}.pltile .pldel{position:absolute;right:4px;top:4px}</style>
        <div class="kxrow"><button type="button" class="ghost" id="plDefine">＋ Define Pattern…</button><button type="button" class="ghost" id="plImport">⤒ Import PNG…</button>
        <span style="color:var(--pc-dim)">patterns/ in the install folder</span></div><div class="plgrid" id="plGrid"></div>
        <input type="file" id="plFile" accept="image/png,image/*" style="display:none">`, () => {}, { okLabel: "Done" });
      panel = d0.getElementById("plGrid") ? d0.getElementById("plGrid").closest(".kxdlg") || d0.getElementById("plGrid").parentNode : null;
      paintPanel();
      d0.getElementById("plDefine").onclick = () => defineDialog();
      d0.getElementById("plImport").onclick = () => d0.getElementById("plFile").click();
      d0.getElementById("plFile").onchange = async (e) => {
        const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
        try {
          const bmp = await root.createImageBitmap(f), c = newCanvas(bmp.width, bmp.height); c.getContext("2d").drawImage(bmp, 0, 0);
          const j = await saveCanvas(f.name.replace(/\.[^.]+$/, ""), c); say(`pattern "${j.name}" imported (${j.w} × ${j.h})`);
        } catch (er) { say("Import: " + er.message); }
      };
    }
    const docOpen = () => !!S.w;
    E.ui.addCmd("edit.defpattern", "Define Pattern…", "", () => defineDialog(), { enabled: docOpen }, ["Edit", "edit.stroke"]);
    E.ui.addCmd("edit.patterns", "Pattern Library…", "", () => libraryDialog(), {}, ["Edit", "edit.defpattern"]);
    E.ui.addCmd("fill.pattern", "Pattern…", "", () => { refresh().then(() => newPatternFill()); }, { enabled: docOpen });
    const Lm = (E.ui.MENUS.find(([n]) => n === "Layer") || [])[1] || [];
    const nf = Lm.find((x) => x && x.label === "New Fill Layer"); if (nf && !nf.items.includes("fill.pattern")) nf.items.push("fill.pattern");
    refresh();
    E.patterns = { refresh, names, list: () => LIB.slice(), tile, scaled, define: saveCanvas, defineDialog, libraryDialog, newPatternFill, fillWith, remove, adoptCanvas, usesOf };
  }

  const PCPattern = { scaleOf, usesOf, tile, scaled, names, refresh, adoptCanvas, install, TILES };
  if (typeof module !== "undefined" && module.exports) module.exports = PCPattern;
  else root.PCPattern = PCPattern;
})(typeof window !== "undefined" ? window : globalThis);
