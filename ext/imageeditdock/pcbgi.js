/* pcbgi.js — THE IMAGE EDITOR'S PROJECT FILE: .bgi (2.436.0), window.PCBgi.
 *
 * Tim (verbatim): "save image edit project as .bgi" (+ "bgi zip"). A .bgi keeps a document EXACTLY as it is open -
 * every layer with all it is (pixels, masks, the smart filter mask, text / shape / fill / adjustment settings, styles,
 * blend, clipping, groups, locks, labels), smart objects with their contents (layers inside, liquify fields), paths
 * and the work path, alpha channels, the selection and the layer comps - so it opens again ready to go on working.
 * Undo history is not kept (a fresh history, like Photoshop).
 *
 *   A ZIP (static/bgzip.js; any unzip opens it):
 *     doc.xml                 the document as XML (static/bgxml.js): <bitgen-image version w h name app saved>
 *                             <document>{w, h, name, active, layers: [layer…], paths, work, ptarget, channels, sel,
 *                             comps, compOn, compSel, compLast, smart: [source…], fields: [field…]}</document>
 *     preview.png             the picture as it looks (for a file browser / another app)
 *     layers/<id>.png  masks/<id>.png  fmasks/<id>.png          each layer's pixels / mask / filter mask
 *     smart/<sid>/source.png  smart/<sid>/layers|masks|fmasks/<id>.png   a smart object's contents
 *     fields/<fid>.f32        a liquify field (dx then dy, Float32, little-endian; DEFLATE)
 *     channels/<cid>.u8  sel.u8   alpha channels / the selection (one byte a pixel; DEFLATE)
 *     patterns/<name>.png     2.437.0: the library patterns it uses (added to the library where it opens, if missing)
 *   A layer: its own settings (every JSON-safe field it has - new kinds of setting go in without changing this file)
 *   + {id, png, cw, ch, mask: {on, density, feather, linked, png}, fmask: {on, png}}. Layer ids are made new when it
 *   opens (remap: parents, comps, the path target follow).
 *
 *   File ▸ Open Project (.bgi)… (also Open… / Ctrl+O and a .bgi dropped on the editor), Open Project from Project…,
 *   Save Project (.bgi) Alt+Ctrl+S (the name it was opened / saved as; the first time it asks), Save Project As…
 *   Saved in the project's bgi folder (routes/bgfiles.js) + a download when asked.
 *
 * Pure (Node: scripts/test-bgfiles.js): jsonSafe, settingsOf, remap, refsOf.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const VERSION = 1;
  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const NOT_SETTING = new Set(["id", "canvas", "mask", "fmask", "ver", "L", "maskProps"]);
  /** a value that JSON keeps exactly: numbers, strings, booleans, null, plain objects / arrays of them */
  function jsonSafe(v, depth) {
    if (v === null || typeof v === "string" || typeof v === "boolean") return true;
    if (typeof v === "number") return Number.isFinite(v);
    if (typeof v !== "object" || (depth || 0) > 40) return false;
    const p = Object.getPrototypeOf(v);
    if (Array.isArray(v)) return v.every((x) => jsonSafe(x, (depth || 0) + 1));
    if (p !== Object.prototype && p !== null) return false;
    return Object.keys(v).every((k) => v[k] === undefined || jsonSafe(v[k], (depth || 0) + 1));
  }
  /** a layer's (or a smart contents snapshot's) settings: every own field that JSON keeps, not the pixels */
  function settingsOf(L) {
    const o = {};
    for (const k of Object.keys(L || {})) {
      if (NOT_SETTING.has(k) || k[0] === "_" || typeof L[k] === "function" || L[k] === undefined) continue;
      if (jsonSafe(L[k])) o[k] = clone(L[k]);
    }
    return o;
  }
  /** after opening: the layers' new ids - parents, comps (keyed by layer id), the path target follow (in place) */
  function remap(m, map) {
    const to = (id) => (id != null && map.has(id) ? map.get(id) : null);
    for (const r of m.layers || []) r.parent = to(r.parent);
    const rekey = (c) => { if (!c || !c.layers) return c; const o = {}; for (const k of Object.keys(c.layers)) { const n = to(isNaN(+k) ? k : +k); if (n != null) o[n] = c.layers[k]; } c.layers = o; return c; };
    (m.comps || []).forEach(rekey); rekey(m.compLast);
    if (m.ptarget && m.ptarget.id != null) { const n = to(m.ptarget.id); m.ptarget = n != null ? Object.assign({}, m.ptarget, { id: n }) : null; }
    return m;
  }
  /** the smart sources and liquify fields a list of layer settings uses: {smart: Set, fields: Set} (adds to `into`) */
  function refsOf(layers, into) {
    const o = into || { smart: new Set(), fields: new Set() };
    for (const L of layers || []) {
      const sm = L && L.smart; if (!sm) continue;
      if (sm.src) o.smart.add(sm.src);
      for (const f of sm.filters || []) if (f && f.field) o.fields.add(f.field);
    }
    return o;
  }
  const stemOf = (n) => String(n || "").replace(/\.(bgi|png|jpe?g|webp|psd|pdf|bmp|gif|tiff?|jxl)$/i, "");

  /* ================================ the editor ================================ */
  function install(E) {
    const S = E.S, win = E.win || root, doc = E.doc || root.document, say = E.say;
    const D = win.PCDoc;
    if (!E.ui || !E.ui.addCmd) return;
    const kx = E.kx || doc.body;
    const newCanvas = (w, h) => { const c = doc.createElement("canvas"); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };
    const ctx = (c) => c.getContext("2d");
    function libs() {
      const need = [["BgXml", "/static/bgxml.js"], ["BgZip", "/static/bgzip.js"]].filter(([g]) => !win[g]);
      return Promise.all(need.map(([g, src]) => new Promise((ok, no) => {
        const s = doc.createElement("script"); s.src = src; s.onload = () => (win[g] ? ok() : no(new Error(src + " did not load"))); s.onerror = () => no(new Error("could not load " + src)); doc.head.appendChild(s);
      })));
    }
    const pngOf = (c) => new Promise((ok, no) => c.toBlob((b) => (b ? b.arrayBuffer().then((a) => ok(new Uint8Array(a)), no) : no(new Error("a layer could not be made a PNG"))), "image/png"));
    async function canvasOf(files, name, w, h) {
      const c = newCanvas(w, h), u8 = name && files.get(name);
      if (!u8 || !u8.length) return c;
      const bmp = await win.createImageBitmap(new win.Blob([u8], { type: "image/png" }), { premultiplyAlpha: "default", colorSpaceConversion: "none" });
      ctx(c).drawImage(bmp, 0, 0); if (bmp.close) bmp.close();
      return c;
    }
    const f32 = (a, b) => { const o = new Float32Array(a.length + b.length); o.set(a, 0); o.set(b, a.length); return new Uint8Array(o.buffer); };

    /* ---------------- write ---------------- */
    async function toBytes() {
      await libs();
      const X = win.BgXml, Z = win.BgZip, files = [], SM = E.smart || {};
      const STORE = SM.STORE || new Map(), FIELDS = SM.FIELDS || new Map();
      const put = (name, data, deflate) => { files.push({ name, data, deflate: !!deflate }); return name; };
      const putPng = async (name, c) => put(name, await pngOf(c));
      async function layerRec(set, id, canvas, mask, fmask, maskProps, dir) {
        const r = Object.assign(settingsOf(set), { id, cw: canvas ? canvas.width : 0, ch: canvas ? canvas.height : 0 });
        if (canvas) r.png = await putPng(`${dir}layers/${id}.png`, canvas);
        if (mask && mask.canvas) r.mask = Object.assign({ on: true, density: 1, feather: 0, linked: true }, maskProps || { on: mask.on, density: mask.density, feather: mask.feather, linked: mask.linked }, { png: await putPng(`${dir}masks/${id}.png`, mask.canvas) });
        if (fmask && fmask.canvas) r.fmask = { on: fmask.on !== false, png: await putPng(`${dir}fmasks/${id}.png`, fmask.canvas) };
        return r;
      }
      const chans = (list, dir) => (list || []).map((c, i) => Object.assign({ id: c.id, name: c.name, w: c.w, h: c.h, file: c.data ? put(`${dir}channels/${i + 1}.u8`, c.data, true) : null }, c.spot ? { spot: clone(c.spot) } : {}));   // 2.467.0: + a spot channel's ink
      const sel = (a, dir) => (a && a.some((v) => v) ? put(`${dir}sel.u8`, a, true) : null);
      const m = { w: S.w, h: S.h, name: S.name || "", active: S.active, layers: [], paths: clone(S.paths || []), work: clone(S.work || null), ptarget: clone(S.ptarget || null),
        channels: chans(S.channels, ""), sel: sel(S.sel, ""), guides: clone(S.guides || []), dimScale: clone(S.dimScale || null), marks: { samplers: clone(S.samplers || []), notes: clone(S.notes || []), counts: clone(S.counts || null), zones: clone(S.zones || []) }, fileInfo: clone(S.fileInfo || null), imgMode: S.imgMode || "rgb", imgModeOpt: clone(S.imgModeOpt || null), comps: clone(S.comps || []), compOn: S.compOn || null, compSel: S.compSel || null, compLast: clone(S.compLast || null), smart: [], fields: [] };
      for (const L of S.layers) m.layers.push(await layerRec(L, L.id, L.canvas, L.mask, L.fmask, null, ""));
      // the smart objects' contents (through smart objects inside smart objects) and the liquify fields they use
      const refs = refsOf(S.layers), done = new Set();
      for (let guard = 0; guard < 500; guard++) {
        const sid = [...refs.smart].find((x) => !done.has(x)); if (!sid) break;
        done.add(sid);
        const s0 = STORE.get(sid); if (!s0) continue;
        const dir = `smart/${String(sid).replace(/[^\w.-]+/g, "_")}/`;
        const rec = { id: sid, w: s0.w, h: s0.h, png: await putPng(dir + "source.png", s0.canvas), doc: null };
        if (s0.doc) {
          const d0 = s0.doc, inner = [];
          for (const x of d0.layers || []) {
            const snap = x.snap || {}, id = snap.L ? snap.L.id : inner.length + 1;
            inner.push(await layerRec(snap, id, x.canvas, x.mask ? { canvas: x.mask } : null, snap.fmask, snap.maskProps, dir));
          }
          refsOf(inner, refs);
          rec.doc = { w: d0.w, h: d0.h, active: d0.active || 0, layers: inner, paths: clone(d0.paths || []), work: clone(d0.work || null), ptarget: clone(d0.ptarget || null), channels: chans(d0.channels, dir), sel: sel(d0.sel, dir) };
        }
        m.smart.push(rec);
      }
      for (const fid of refs.fields) {
        const F = FIELDS.get(fid); if (!F || !F.dx) continue;
        const rest = settingsOf(F); delete rest.dx; delete rest.dy;
        m.fields.push(Object.assign(rest, { id: fid, w: F.w, h: F.h, file: put(`fields/${String(fid).replace(/[^\w.-]+/g, "_")}.f32`, f32(F.dx, F.dy), true) }));
      }
      // 2.437.0: the library patterns it uses go inside (a fill layer's pattern, a Pattern Overlay user:<name>)
      const PT = win.PCPattern;
      if (PT && PT.usesOf) {
        const used = new Set(); for (const L of S.layers) for (const n of PT.usesOf(L)) used.add(n);
        m.patterns = [];
        for (const n of used) { const c = PT.tile(n); if (c) m.patterns.push({ name: n, png: await putPng(`patterns/${String(n).replace(/[^\w .()&+-]+/g, "_")}.png`, c) }); }
      }
      try { put("preview.png", await pngOf(E.flatten())); } catch (e) { /* no preview */ }
      const app = (win.H3Version || (doc.querySelector('meta[name="h3-version"]') || {}).content || "");
      const xml = X.doc("bitgen-image", { version: VERSION, app, w: S.w, h: S.h, name: S.name || "", layers: S.layers.length, saved: new Date().toISOString() },
        ["\n  <document>", X.toXml(m, null, null, 2), "\n  </document>"]);
      files.unshift({ name: "doc.xml", data: xml, deflate: true });
      return { bytes: await Z.zipAsync(files), layers: S.layers.length, smart: m.smart.length };
    }
    async function save(name, download) {
      if (!S.w) { say("open a picture first"); return null; }
      try {
        const top = S.undo[S.undo.length - 1], live = E.docs ? E.docs.live() : null;
        const { bytes, layers, smart } = await toBytes();
        const nm = stemOf(name || S.bgiName || S.name || "picture") + ".bgi";
        const r = await win.fetch("/api/bgfile/bgi/save?name=" + encodeURIComponent(nm), { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: bytes });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "the save was refused");
        if (!E.docs || E.docs.live() === live) { S.bgiName = j.name; S.savedTop = top; if (E.docs && E.docs.paint) E.docs.paint(); }
        if (download) {
          const a = doc.createElement("a"); a.href = win.URL.createObjectURL(new win.Blob([bytes], { type: "application/zip" })); a.download = j.name;
          doc.body.appendChild(a); a.click(); setTimeout(() => { win.URL.revokeObjectURL(a.href); a.remove(); }, 4000);
        }
        say(`saved ${j.name} (${layers} layer(s)${smart ? `, ${smart} smart object(s)` : ""}, ${Math.max(1, Math.round(j.size / 1024))} KB) in the project's bgi folder${download ? " and downloaded" : ""}`);
        return j;
      } catch (e) { say("Save Project failed: " + e.message); return null; }
    }

    /* ---------------- read ---------------- */
    async function buildLayers(recs, files, w, h) {
      const map = new Map(), out = [];
      for (const r of recs || []) {
        const L = E.makeLayer(r.name || "Layer", w, h, r.type || "pixel");
        const set = Object.assign({}, r); for (const k of ["id", "png", "cw", "ch", "mask", "fmask"]) delete set[k];
        Object.assign(L, set);
        L.canvas = await canvasOf(files, r.png, r.cw || w, r.ch || h);
        if (r.mask) { const mk = E.newMask("#ffffff", w, h); mk.canvas = await canvasOf(files, r.mask.png, w, h); Object.assign(mk, { on: r.mask.on !== false, density: r.mask.density == null ? 1 : r.mask.density, feather: r.mask.feather || 0, linked: r.mask.linked !== false }); L.mask = mk; }
        if (r.fmask) L.fmask = { canvas: await canvasOf(files, r.fmask.png, w, h), on: r.fmask.on !== false, ver: 0 };
        L.ver = (L.ver || 0) + 1;
        map.set(r.id, L.id); out.push(L);
      }
      return { layers: out, map };
    }
    const bytesOf = (files, name) => (name && files.get(name)) || null;
    const chansOf = (files, list) => (list || []).map((c) => Object.assign({ id: c.id, name: c.name, w: c.w, h: c.h, data: bytesOf(files, c.file) ? Uint8Array.from(bytesOf(files, c.file)) : new Uint8Array((c.w || 1) * (c.h || 1)) }, c.spot ? { spot: { color: String(c.spot.color || "#000000"), solidity: +c.spot.solidity || 0 } } : {}));
    async function openBytes(u8, fileName) {
      await libs();
      const X = win.BgXml, Z = win.BgZip;
      const files = await Z.unzipAsync(u8 instanceof Uint8Array ? u8 : new Uint8Array(u8));
      const xmlB = files.get("doc.xml"); if (!xmlB) throw new Error("not a .bgi (no doc.xml inside)");
      const t = X.parse(Z.text(xmlB)), rootEl = X.child(t, "bitgen-image");
      if (!rootEl) throw new Error("not a .bgi (no <bitgen-image>)");
      if (+rootEl.attrs.version > VERSION) throw new Error(`written by a newer bitGen (file version ${rootEl.attrs.version})`);
      const m = X.fromXml(X.child(rootEl, "document") || rootEl);
      if (!m || !(m.w > 0) || !(m.h > 0) || !Array.isArray(m.layers)) throw new Error("the .bgi has no document");
      const SM = E.smart || {};
      // liquify fields + smart contents first: the smart layers draw from them
      for (const f of m.fields || []) {
        const b = bytesOf(files, f.file); if (!b || !SM.FIELDS) continue;
        const a = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), n = f.w * f.h;
        const rest = Object.assign({}, f); delete rest.id; delete rest.file;
        SM.FIELDS.set(f.id, Object.assign(rest, { dx: a.slice(0, n), dy: a.slice(n, 2 * n) }));
      }
      for (const s of m.smart || []) {
        if (!SM.STORE) break;
        const canvas = await canvasOf(files, s.png, s.w, s.h);
        let d0 = null;
        if (s.doc) {
          const b = await buildLayers(s.doc.layers, files, s.doc.w, s.doc.h);
          const inner = { layers: s.doc.layers, ptarget: s.doc.ptarget }; remap(inner, b.map);
          b.layers.forEach((L, i) => { L.parent = inner.layers[i].parent; });
          d0 = { w: s.doc.w, h: s.doc.h, active: s.doc.active || 0, sel: bytesOf(files, s.doc.sel) ? Uint8Array.from(bytesOf(files, s.doc.sel)) : null,
            layers: b.layers.map((L) => ({ snap: D.snapLayer(L), canvas: L.canvas, mask: L.mask ? L.mask.canvas : null })),
            paths: s.doc.paths || [], work: s.doc.work || null, ptarget: inner.ptarget || null, channels: chansOf(files, s.doc.channels) };
        }
        SM.STORE.set(s.id, { id: s.id, canvas, w: s.w, h: s.h, doc: d0 });
      }
      // 2.437.0: its patterns - used from the file, and added to the library when the library has none of that name
      const PT = win.PCPattern;
      if (PT && Array.isArray(m.patterns) && m.patterns.length) {
        let lib = []; try { lib = await PT.refresh(); } catch (e) { lib = []; }
        for (const p of m.patterns) {
          const b = bytesOf(files, p.png); if (!b) continue;
          const bmp = await win.createImageBitmap(new win.Blob([b], { type: "image/png" })), c = newCanvas(bmp.width, bmp.height); ctx(c).drawImage(bmp, 0, 0);
          if (!lib.some((x) => x.name === p.name) && E.patterns) { try { await E.patterns.define(p.name, c); } catch (e) { PT.adoptCanvas(p.name, c); } }
          else if (!PT.tile(p.name)) PT.adoptCanvas(p.name, c);
        }
      }
      const name = m.name || stemOf(fileName) + ".png";
      E.openDoc(m.w, m.h, name, null);
      const b = await buildLayers(m.layers, files, m.w, m.h);
      remap(m, b.map);
      b.layers.forEach((L, i) => { L.parent = m.layers[i].parent; });
      S.layers = b.layers.length ? b.layers : [E.makeLayer("Background", m.w, m.h)];
      S.active = Math.max(0, Math.min(m.active | 0, S.layers.length - 1));
      S.paths = m.paths || []; S.work = m.work || null; S.ptarget = m.ptarget || null;
      S.channels = chansOf(files, m.channels);
      S.guides = Array.isArray(m.guides) ? m.guides : [];                    // 2.440.0
      S.dimScale = m.dimScale && m.dimScale.k > 0 ? m.dimScale : null;        // 2.441.0
      const mk = m.marks || {}; S.samplers = Array.isArray(mk.samplers) ? mk.samplers : []; S.notes = Array.isArray(mk.notes) ? mk.notes : []; S.counts = mk.counts && Array.isArray(mk.counts.groups) ? mk.counts : null; S.zones = Array.isArray(mk.zones) ? mk.zones.filter((z) => z && Number.isFinite(z.x) && Number.isFinite(z.w)).slice(0, 8) : [];   // 2.569.0 (pczones.js)   // 2.483.0 (pcmeasure.js)
      S.fileInfo = m.fileInfo && typeof m.fileInfo === "object" ? m.fileInfo : null;   // 2.485.0 (pcfileplus.js)
      S.imgMode = /^(rgb|gray|bitmap|duotone|indexed|cmyk)$/.test(m.imgMode || "") ? m.imgMode : "rgb"; S.imgModeOpt = m.imgModeOpt && typeof m.imgModeOpt === "object" ? m.imgModeOpt : null;   // 2.487.0 (pcmode.js)
      S.comps = m.comps || []; S.compOn = m.compOn || null; S.compSel = m.compSel || null; S.compLast = m.compLast || null;
      const sb = bytesOf(files, m.sel);
      E.setSel(sb && sb.length === m.w * m.h ? Uint8Array.from(sb) : new Uint8Array(m.w * m.h), true);
      for (const L of S.layers) if (D && D.isLive(L)) { try { D.rasterize(L); } catch (e) { /* drawn on the next refresh */ } }
      S.undo = []; S.redo = []; S.savedTop = undefined; S.bgiName = stemOf(fileName) + ".bgi";
      E.snapHistorySource(); E.refresh(); E.renderLayersPanel(); if (E.ui.history) E.ui.history();
      if (E.comps && E.comps.paint) E.comps.paint();
      if (E.docs && E.docs.paint) E.docs.paint();
      say(`${S.bgiName}: ${S.layers.length} layer(s), ${m.w}×${m.h}` + ((m.smart || []).length ? ` · ${m.smart.length} smart object(s)` : "") + ((m.comps || []).length ? ` · ${m.comps.length} layer comp(s)` : ""));
      return { layers: S.layers.length, w: m.w, h: m.h, smart: (m.smart || []).length, comps: (m.comps || []).length };
    }
    async function openFile(f) {
      try { return await openBytes(new Uint8Array(await f.arrayBuffer()), f.name); } catch (e) { say(`${f.name}: could not open it as a .bgi - ${e.message}`); return null; }
    }
    async function openFromProject(name) {
      try {
        const r = await win.fetch("/api/bgfile/bgi/file/" + encodeURIComponent(name));
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "not found");
        return await openBytes(new Uint8Array(await r.arrayBuffer()), name);
      } catch (e) { say(`${name}: ${e.message}`); return null; }
    }

    /* ---------------- the UI ---------------- */
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const input = doc.createElement("input"); input.type = "file"; input.accept = ".bgi,application/zip"; input.style.display = "none"; input.id = "pcBgiFile";
    input.onchange = () => { const f = input.files && input.files[0]; input.value = ""; if (f) openFile(f); };
    kx.appendChild(input);
    // File ▸ Open… (Ctrl+O) takes a .bgi too
    const ief = doc.getElementById("ieFile");
    if (ief) {
      ief.accept = "image/*,.bgi";
      ief.addEventListener("change", (e) => {
        const f = ief.files && ief.files[0];
        if (f && /\.bgi$/i.test(f.name) && !ief.dataset.layer) { e.stopImmediatePropagation(); ief.value = ""; openFile(f); }
      }, true);
    }
    async function projectDialog() {
      let files = []; try { files = (await (await win.fetch("/api/bgfile/bgi/list")).json()).files || []; } catch { files = []; }
      E.ui.dialog("Open Project from Project", files.length
        ? `<select id="bgiList" size="${Math.min(10, Math.max(3, files.length))}" style="width:100%">${files.map((f, i) => `<option value="${esc(f.name)}"${i ? "" : " selected"}>${esc(f.name)} — ${Math.max(1, Math.round(f.size / 1024))} KB</option>`).join("")}</select>`
        : `<div style="color:var(--pc-dim)">No .bgi saved in this project yet - File ▸ Save Project (.bgi) keeps one here.</div>`,
      (d) => { const s = d.querySelector("#bgiList"); if (s && s.value) openFromProject(s.value); }, { okLabel: "Open" });
    }
    function saveDialog() {
      if (!S.w) return say("open a picture first");
      const nm = stemOf(S.bgiName || S.name || "picture");
      E.ui.dialog("Save Project (.bgi)", `<div class="kxrow"><span>Name</span><input type="text" id="bgiN" value="${esc(nm)}" style="flex:1"><span>.bgi</span></div>
        <div class="kxrow"><label><input type="checkbox" id="bgiDl"> also download it</label></div>
        <div class="kxrow" style="color:var(--pc-dim)">Kept in the project's bgi folder. Everything stays editable: layers, masks, text / shape / fill / adjustment layers, styles, smart objects and their filters, paths, channels, the selection and layer comps.</div>`,
      (d) => { save(d.querySelector("#bgiN").value.trim() || nm, d.querySelector("#bgiDl").checked); }, { okLabel: "💾 Save" });
      const n = doc.getElementById("bgiN"); if (n) n.addEventListener("keydown", (e) => e.stopPropagation());
    }
    const docOpen = () => !!S.w;
    E.ui.addCmd("file.openbgi", "Open Project (.bgi)…", "", () => input.click(), {}, ["File", "file.open"]);
    E.ui.addCmd("file.openbgiproj", "Open Project from Project…", "", () => projectDialog(), {}, ["File", "file.openbgi"]);
    E.ui.addCmd("file.savebgi", "Save Project (.bgi)", "Alt+Ctrl+S", () => (S.bgiName ? save(S.bgiName, false) : saveDialog()), { enabled: docOpen }, ["File", "file.save"]);
    E.ui.addCmd("file.savebgias", "Save Project As (.bgi)…", "", () => saveDialog(), { enabled: docOpen }, ["File", "file.savebgi"]);
    const stage = E.stage;
    if (stage) stage.addEventListener("drop", (e) => {
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f && /\.bgi$/i.test(f.name)) { e.preventDefault(); e.stopImmediatePropagation(); openFile(f); }
    }, true);
    E.bgi = { toBytes, save, openBytes, openFile, openFromProject, saveDialog, projectDialog };
  }

  const PCBgi = { VERSION, jsonSafe, settingsOf, remap, refsOf, stemOf, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCBgi;
  else root.PCBgi = PCBgi;
})(typeof window !== "undefined" ? window : globalThis);
