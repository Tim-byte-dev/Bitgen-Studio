/* bitGen Studio — static/svgpic.js (2.702.0): SVG PICTURES INTO ASSETS AND REFERENCES, window.BGSvg.
 *
 * Tim (verbatim): "can u add svg to the images i can upload to assets or references".
 *
 * Nothing after the upload reads SVG: ComfyUI, ffmpeg, the timeline and the models all want pixels. So the page draws the
 * SVG into a PNG (it is a vector, so it is drawn at the size it is used, not scaled up from a small picture) and the PNG
 * is what is uploaded - the same way static/jxl.js sends a JPEG XL as a PNG.
 *   isSvgName(name)         ends in .svg
 *   looksSvg(text)          the start of the file is an <svg> (after an XML declaration / comments / a doctype)
 *   sizeOf(text)            -> {w, h} its own size: width / height (px, pt, mm, cm, in), else the viewBox, else 300 x 150
 *   target(w, h, o)         -> {w, h} the PNG's size: the long side at least o.min (2048), at most o.max (4096), same shape
 *   prepare(text, w, h)     the SVG with width / height set to w x h (and a viewBox from its own size when it has none),
 *                           so the browser draws it sharp at that size
 *   toPng(blob, o)          -> {blob (image/png, transparent background kept), width, height}       (the page)
 *   toPngFile(file, o)      -> a File "<name>.png"                                                    (the page)
 * In the page it also:
 *   fetch(url, {body: FormData})   an SVG file in any upload is sent as that PNG (Assets, References, everything)
 *   <input type=file accept="image/…">   also offers .svg files
 * The Open dialog (static/filedialog.js) turns a picked .svg into the PNG as it reads it, so a picker that never uploads
 * (Image Edit's Open, Place as Layer) gets the PNG too.
 */
(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports && typeof window === "undefined";
  const DEF = { min: 2048, max: 4096 };
  const isSvgName = (n) => /\.svgz?$/i.test(String(n || "").split(/[?#]/)[0]);
  function looksSvg(t) {
    let s = String(t || "").replace(/^\uFEFF/, "");
    for (let i = 0; i < 20; i++) {                                     // skip <?xml ?>, <!-- -->, <!DOCTYPE>, white space
      s = s.replace(/^\s+/, "");
      const m = /^<\?[\s\S]*?\?>|^<!--[\s\S]*?-->|^<!DOCTYPE[^>[]*(\[[\s\S]*?\])?\s*>/i.exec(s);
      if (!m) break;
      s = s.slice(m[0].length);
    }
    return /^<(?:[A-Za-z_][\w.-]*:)?svg[\s>/]/.test(s);
  }
  const UNIT = { px: 1, "": 1, pt: 96 / 72, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, in: 96 };
  /** "120", "120px", "3in" -> px; "100%" / "auto" / missing -> null */
  function len(v) {
    const m = /^\s*([0-9]*\.?[0-9]+(?:e[+-]?\d+)?)\s*(px|pt|pc|mm|cm|in)?\s*$/i.exec(String(v == null ? "" : v));
    if (!m) return null;
    const n = parseFloat(m[1]) * UNIT[(m[2] || "").toLowerCase()];
    return n > 0 && isFinite(n) ? n : null;
  }
  /** the root <svg ...> tag's text (or "") */
  function rootTag(t) {
    const m = /<(?:[A-Za-z_][\w.-]*:)?svg\b[^>]*>/.exec(String(t || ""));
    return m ? { tag: m[0], at: m.index } : null;
  }
  const attr = (tag, name) => { const m = new RegExp("\\s" + name + "\\s*=\\s*(\"([^\"]*)\"|'([^']*)')", "i").exec(tag); return m ? (m[2] != null ? m[2] : m[3]) : null; };
  function viewBox(tag) {
    const v = attr(tag, "viewBox"); if (v == null) return null;
    const n = v.trim().split(/[\s,]+/).map(Number);
    return n.length === 4 && n.every(isFinite) && n[2] > 0 && n[3] > 0 ? n : null;
  }
  /** an SVG's own size in px */
  function sizeOf(t) {
    const r = rootTag(t); if (!r) return { w: 300, h: 150 };
    const w = len(attr(r.tag, "width")), h = len(attr(r.tag, "height")), vb = viewBox(r.tag);
    if (w && h) return { w, h };
    if (vb) {
      if (w) return { w, h: w * vb[3] / vb[2] };
      if (h) return { w: h * vb[2] / vb[3], h };
      return { w: vb[2], h: vb[3] };
    }
    return { w: w || 300, h: h || 150 };
  }
  /** the PNG's size: the long side between o.min and o.max, the SVG's shape */
  function target(w, h, o) {
    const x = Object.assign({}, DEF, o || {});
    w = +w > 0 ? +w : 300; h = +h > 0 ? +h : 150;
    const long = Math.max(w, h), want = Math.min(x.max, Math.max(x.min, long)), k = want / long;
    return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
  }
  /** the SVG drawn at w x h: width / height replaced, a viewBox added from its own size when it has none */
  function prepare(t, w, h) {
    t = String(t || "");
    const r = rootTag(t); if (!r) return t;
    const own = sizeOf(t);
    let tag = r.tag.replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*')/gi, "");
    const add = ` width="${w}" height="${h}"` + (viewBox(r.tag) ? "" : ` viewBox="0 0 ${+own.w.toFixed(4)} ${+own.h.toFixed(4)}"`)
      + (/\sxmlns\s*=/.test(tag) ? "" : ' xmlns="http://www.w3.org/2000/svg"');
    tag = tag.replace(/^(<(?:[A-Za-z_][\w.-]*:)?svg)\b/, "$1" + add);
    return t.slice(0, r.at) + tag + t.slice(r.at + r.tag.length);
  }
  const pngName = (n) => String(n || "picture.svg").replace(/\.svgz?$/i, "") + ".png";
  const pure = { DEF, isSvgName, looksSvg, len, sizeOf, target, prepare, pngName };

  /* ---------------------------------------------------------------- the page */
  function install(win) {
    if (win.__bgSvg) return win.__bgSvg;
    const doc = win.document;
    const stats = { drawn: 0, uploads: 0 };
    const textOf = async (b) => {
      if (/\.svgz$/i.test(b.name || "") && win.DecompressionStream) return new win.Response(b.stream().pipeThrough(new win.DecompressionStream("gzip"))).text();
      return b.text();
    };
    async function isSvgBlob(b) {
      if (!b || !win.Blob || !(b instanceof win.Blob)) return false;
      if (/image\/svg\+xml/i.test(b.type || "") || isSvgName(b.name)) return true;
      if (b.type && !/octet-stream|text\/(plain|xml)|application\/xml/i.test(b.type)) return false;
      try { return looksSvg(await b.slice(0, 2048).text()); } catch (e) { return false; }
    }
    const done = new WeakMap();                                         // an SVG blob -> Promise<{blob, width, height}>
    function toPng(b, o) {
      if (!o && done.has(b)) return done.get(b);
      const p = (async () => {
        const text = await textOf(b);
        if (!looksSvg(text)) throw new Error((b.name || "That file") + " is not an SVG picture");
        const own = sizeOf(text), sz = target(own.w, own.h, o);
        const src = win.URL.createObjectURL(new win.Blob([prepare(text, sz.w, sz.h)], { type: "image/svg+xml" }));
        try {
          const img = new win.Image(); img.decoding = "async";
          await new Promise((ok, no) => { img.onload = ok; img.onerror = () => no(new Error((b.name || "The SVG") + " could not be drawn (a broken SVG, or one that needs files beside it)")); img.src = src; });
          const c = doc.createElement("canvas"); c.width = sz.w; c.height = sz.h;
          c.getContext("2d").drawImage(img, 0, 0, sz.w, sz.h);
          const png = await new Promise((ok, no) => c.toBlob((x) => (x ? ok(x) : no(new Error("the SVG could not be made a PNG"))), "image/png"));
          stats.drawn++;
          return { blob: png, width: sz.w, height: sz.h };
        } finally { win.URL.revokeObjectURL(src); }
      })();
      if (!o) { done.set(b, p); p.catch(() => done.delete(b)); }
      return p;
    }
    async function toPngFile(f, o) {
      const r = await toPng(f, o);
      return new win.File([r.blob], pngName(f.name), { type: "image/png", lastModified: f.lastModified || Date.now() });
    }
    // file pickers that take pictures also offer .svg
    const widen = (inp) => {
      try {
        const a = inp.getAttribute("accept");
        if (inp.type === "file" && a && !/\.svg\b|image\/svg/i.test(a) && /image\/|\.png|\.jpe?g|\.webp/i.test(a)) inp.setAttribute("accept", a + ",.svg,image/svg+xml");
      } catch (e) { /* fine */ }
    };
    ["click", "showPicker"].forEach((k) => {
      const o = win.HTMLInputElement.prototype[k];
      if (typeof o === "function" && !o.__svg) { const f = function () { widen(this); return o.apply(this, arguments); }; f.__svg = true; win.HTMLInputElement.prototype[k] = f; }
    });
    doc.addEventListener("click", (e) => { const t = e.target; if (t && t.tagName === "INPUT") widen(t); else if (t && t.tagName === "LABEL" && t.control) widen(t.control); }, true);
    // uploads: an SVG goes as a PNG; a form with a "keepsvg" field sends it as it is
    const of = typeof win.fetch === "function" ? win.fetch.bind(win) : null;
    if (of) win.fetch = async function (input, init) {
      const body = init && init.body;
      if (body && win.FormData && body instanceof win.FormData && !body.has("keepsvg")) {
        let changed = false; const fd = new win.FormData();
        for (const [k, v] of body.entries()) {
          if (v && win.Blob && v instanceof win.Blob && (await isSvgBlob(v))) {
            let f;
            try { f = await toPngFile(v); }
            catch (e) {                            // a broken SVG: nothing is sent; the caller reads the reason like a server refusal
              return new win.Response(JSON.stringify({ error: (e && e.message) || "the SVG could not be drawn" }), { status: 400, headers: { "Content-Type": "application/json" } });
            }
            fd.append(k, f, f.name); changed = true; stats.uploads++;
          } else if (v && win.File && v instanceof win.File) fd.append(k, v, v.name);
          else fd.append(k, v);
        }
        if (changed) init = Object.assign({}, init, { body: fd });
      }
      return of(input, init);
    };
    const api = Object.assign({}, pure, { stats, isSvgBlob, toPng, toPngFile, widen });
    win.__bgSvg = api; win.BGSvg = api;
    return api;
  }

  const BGSvg = Object.assign({ install }, pure);
  if (isNode) module.exports = BGSvg;
  else { root.BGSvg = BGSvg; install(root); }
})(typeof window !== "undefined" ? window : globalThis);
