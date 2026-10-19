/* bitGen Studio — static/jxl.js (2.479.0): JPEG XL (.jxl) PICTURES EVERYWHERE, window.BGJxl.
 *
 * Tim (verbatim): "add jxl file support".
 *
 * The codecs (static/vendor/jxl/, loaded on first use): jxl-oxide (the decoder, exact - MIT) and libjxl's encoder
 * (@jsquash/jxl - Apache-2.0 / BSD-3). This file is the one way in, for the page and for Node (lib/jxl.js):
 *   isJxl(bytes)            the signature: a bare codestream (FF 0A) or the container (00 00 00 0C 'JXL ' …)
 *   isJxlName(name)         ends in .jxl
 *   toPng(bytes)            -> {png: Uint8Array, width, height, animated} (sRGB; the first frame of an animation)
 *   encode({data, width, height}, {quality 1-100 (90), lossless (false), effort 1-9 (7)}) -> Uint8Array .jxl
 * In the page it also makes the browser treat .jxl like any picture it knows (the browser itself cannot show them):
 *   <img> / new Image()     a .jxl blob / file URL or a data:image/jxl URL is shown (decoded, then a PNG behind it)
 *   createImageBitmap(blob) a .jxl blob is decoded first
 *   canvas.toBlob(cb, "image/jxl", q)   writes JPEG XL (q = 1 -> lossless; else quality q * 100)
 *   a File named *.jxl with no type   says "image/jxl" (so "is this a picture?" checks pass)
 *   <input type=file accept="image/…"> also offers .jxl files
 *   fetch(url, {body: FormData})        a .jxl file in an upload is sent as a PNG (every tool, ComfyUI and ffmpeg
 *                           read it) - except to the project's pictures (/api/passets, where .jxl is kept) or when
 *                           the form has a "keepjxl" field
 * Pictures the server sends (project files, outputs, thumbnails) come as PNG to an <img> (routes/jxl.js).
 */
(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports && typeof window === "undefined";
  const SIG_BARE = [0xff, 0x0a], SIG_BOX = [0, 0, 0, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a];
  function isJxl(b) {
    if (!b) return false;
    const u = b instanceof Uint8Array ? b : new Uint8Array(b.buffer ? b.buffer.slice(b.byteOffset || 0, (b.byteOffset || 0) + b.byteLength) : b);
    if (u.length >= 2 && u[0] === SIG_BARE[0] && u[1] === SIG_BARE[1]) return true;
    if (u.length >= 12 && SIG_BOX.every((v, i) => u[i] === v)) return true;
    return false;
  }
  const isJxlName = (n) => /\.jxl$/i.test(String(n || "").split(/[?#]/)[0]);
  const DEFAULTS = { quality: 90, lossless: false, effort: 7 };
  /** our options -> the encoder's */
  function encOptions(o) {
    const x = Object.assign({}, DEFAULTS, o || {});
    const lossless = !!x.lossless || +x.quality >= 100;
    return { effort: Math.max(1, Math.min(9, Math.round(+x.effort || 7))), quality: lossless ? 100 : Math.max(1, Math.min(99, Math.round(+x.quality || 90))),
      progressive: false, epf: -1, lossyPalette: false, decodingSpeedTier: 0, photonNoiseIso: 0, lossyModular: false, lossless };
  }

  /* ---- the codecs (one load each) ---- */
  let decP = null, encP = null, base = "/static/vendor/jxl/";
  function setBase(b) { base = b; decP = encP = null; }
  async function bytesOf(u) {
    if (isNode) return require("fs").readFileSync(u);
    const r = await fetch(u); if (!r.ok) throw new Error("could not load " + u); return new Uint8Array(await r.arrayBuffer());
  }
  const urlOf = (f) => (isNode ? require("url").pathToFileURL(require("path").join(base, f)).href : base + f);
  function decoder() {
    if (!decP) decP = (async () => {
      const m = await import(urlOf("jxl_oxide_wasm.js"));
      const wasm = await bytesOf(isNode ? require("path").join(base, "jxl_oxide_wasm_bg.wasm") : base + "jxl_oxide_wasm_bg.wasm");
      m.initSync({ module: wasm });
      return m;
    })().catch((e) => { decP = null; throw e; });
    return decP;
  }
  function encoder() {
    if (!encP) encP = (async () => {
      const m = await import(urlOf("jxl_enc.js"));
      const wasm = await bytesOf(isNode ? require("path").join(base, "jxl_enc.wasm") : base + "jxl_enc.wasm");
      return m.default({ noInitialRun: true, wasmBinary: wasm });
    })().catch((e) => { encP = null; throw e; });
    return encP;
  }
  async function toPng(bytes) {
    const m = await decoder();
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (!isJxl(u8)) throw new Error("not a JPEG XL file");
    const im = new m.JxlImage();
    try {
      try { im.forceSrgb = true; } catch (e) { /* older */ }
      im.feedBytes(u8);
      if (!im.tryInit() || (!im.loaded && !im.numLoadedKeyframes)) throw new Error("the JPEG XL file is cut short or damaged");
      const r = im.render(0);
      try { return { png: r.encodeToPng(), width: im.width, height: im.height, animated: !!im.animated }; }
      finally { try { r.free(); } catch (e) { /* freed */ } }
    } finally { try { im.free(); } catch (e) { /* freed */ } }
  }
  async function encode(img, opts) {
    const m = await encoder();
    const w = img.width, h = img.height;
    if (!(w > 0 && h > 0)) throw new Error("nothing to write");
    const data = img.data instanceof Uint8ClampedArray ? img.data : new Uint8ClampedArray(img.data.buffer || img.data);
    const out = m.encode(data, w, h, encOptions(opts));
    if (!out) throw new Error("JPEG XL encoding failed");
    return new Uint8Array(out.buffer ? out.buffer.slice(out.byteOffset || 0, (out.byteOffset || 0) + out.byteLength) : out);
  }
  const pure = { isJxl, isJxlName, encOptions, DEFAULTS, toPng, encode, setBase };

  /* ---------------------------------------------------------------- the page */
  function install(win) {
    if (win.__bgJxl) return win.__bgJxl;
    const doc = win.document;
    const jxlUrls = new Map(), untyped = [];   // blob: URL -> its blob, for blobs that are (or may be) JPEG XL
    const pngOf = new WeakMap();            // a JPEG XL blob -> Promise<PNG blob>
    const stats = { decoded: 0, encoded: 0, uploads: 0 };
    const blobIsJxl = async (b) => {
      if (!b) return false;
      if (/image\/jxl/i.test(b.type || "") || isJxlName(b.name)) return true;
      if (b.type && !/octet-stream/i.test(b.type)) return false;
      try { return isJxl(new Uint8Array(await b.slice(0, 12).arrayBuffer())); } catch (e) { return false; }
    };
    const toPngBlob = (b) => {
      if (!pngOf.has(b)) pngOf.set(b, (async () => { const r = await toPng(new Uint8Array(await b.arrayBuffer())); stats.decoded++; return new win.Blob([r.png], { type: "image/png" }); })());
      return pngOf.get(b);
    };
    // a File named *.jxl that the system gave no type says image/jxl
    try {
      const d = Object.getOwnPropertyDescriptor(win.Blob.prototype, "type");
      if (d && d.get && !d.get.__jxl) {
        const g = function () { const t = d.get.call(this); return !t && win.File && this instanceof win.File && isJxlName(this.name) ? "image/jxl" : t; };
        g.__jxl = true;
        Object.defineProperty(win.Blob.prototype, "type", Object.assign({}, d, { get: g }));
      }
    } catch (e) { /* fine */ }
    // blob URLs of JPEG XL (or untyped) blobs are remembered
    // 2.519.0: only where the window has blob URLs (jsdom has none - unpatched there; every browser has them)
    const hasBlobUrls = !!(win.URL && typeof win.URL.createObjectURL === "function" && typeof win.URL.revokeObjectURL === "function");
    const cou = hasBlobUrls ? win.URL.createObjectURL.bind(win.URL) : () => { throw new Error("no blob URLs here"); };
    const rou = hasBlobUrls ? win.URL.revokeObjectURL.bind(win.URL) : () => {};
    if (hasBlobUrls) win.URL.createObjectURL = function (o) {
      const u = cou(o);
      if (o && win.Blob && o instanceof win.Blob) {
        if (/image\/jxl/i.test(o.type || "") || isJxlName(o.name)) jxlUrls.set(u, o);
        else if (!o.type || /octet-stream/i.test(o.type)) {                       // untyped: maybe - the last 64 kept
          jxlUrls.set(u, o); untyped.push(u);
          while (untyped.length > 64) { const old = untyped.shift(); if (jxlUrls.get(old) && !/image\/jxl/i.test(jxlUrls.get(old).type || "")) jxlUrls.delete(old); }
        }
      }
      return u;
    };
    if (hasBlobUrls) win.URL.revokeObjectURL = function (u) { jxlUrls.delete(u); return rou(u); };
    // <img>: a JPEG XL source is decoded and shown as a PNG
    const sd = Object.getOwnPropertyDescriptor(win.HTMLImageElement.prototype, "src");
    if (sd && sd.set) {
      Object.defineProperty(win.HTMLImageElement.prototype, "src", Object.assign({}, sd, {
        set(v) {
          const s = String(v == null ? "" : v), img = this;
          const blob = jxlUrls.get(s);
          const dataJxl = /^data:image\/jxl[;,]/i.test(s);
          if (!blob && !dataJxl) return sd.set.call(this, v);
          const ticket = (img.__jxlTicket = (img.__jxlTicket || 0) + 1);
          (async () => {
            let b = blob;
            if (dataJxl) b = await (await fetch(s)).blob();
            if (blob && !(await blobIsJxl(blob))) return s;                     // an untyped blob that is not JPEG XL
            const png = await toPngBlob(b);
            const pu = cou(png); img.__jxlUrl = pu; return pu;
          })().then((u) => { if (img.__jxlTicket === ticket) sd.set.call(img, u); },
            () => { if (img.__jxlTicket === ticket) sd.set.call(img, s); });          // the browser's own error then
        },
      }));
    }
    // createImageBitmap(a JPEG XL blob)
    if (win.createImageBitmap && !win.createImageBitmap.__jxl) {
      const cib = win.createImageBitmap.bind(win);
      const f = async function (src, ...rest) {
        if (src && win.Blob && src instanceof win.Blob && (await blobIsJxl(src))) return cib(await toPngBlob(src), ...rest);
        return cib(src, ...rest);
      };
      f.__jxl = true; win.createImageBitmap = f;
    }
    // canvas.toBlob(cb, "image/jxl", quality)
    const tb = win.HTMLCanvasElement.prototype.toBlob;
    if (tb && !tb.__jxl) {
      const f = function (cb, type, q) {
        if (!/^image\/jxl$/i.test(String(type || ""))) return tb.apply(this, arguments);
        const c = this;
        (async () => {
          const g = c.getContext("2d"), id = g.getImageData(0, 0, c.width, c.height);
          const lossless = q != null && +q >= 1;
          const out = await encode(id, { lossless, quality: q == null ? 90 : Math.round(+q * 100) });
          stats.encoded++;
          return new win.Blob([out], { type: "image/jxl" });
        })().then((b) => cb(b), () => cb(null));
      };
      f.__jxl = true; win.HTMLCanvasElement.prototype.toBlob = f;
    }
    // file pickers that take pictures also offer .jxl
    const widen = (inp) => {
      try {
        const a = inp.getAttribute("accept");
        if (inp.type === "file" && a && !/\.jxl\b|image\/jxl/i.test(a) && /image\/|\.png|\.jpe?g|\.webp/i.test(a)) inp.setAttribute("accept", a + ",.jxl,image/jxl");
      } catch (e) { /* fine */ }
    };
    ["click", "showPicker"].forEach((k) => {
      const o = win.HTMLInputElement.prototype[k];
      if (typeof o === "function" && !o.__jxl) { const f = function () { widen(this); return o.apply(this, arguments); }; f.__jxl = true; win.HTMLInputElement.prototype[k] = f; }
    });
    doc.addEventListener("click", (e) => { const t = e.target; if (t && t.tagName === "INPUT") widen(t); else if (t && t.tagName === "LABEL" && t.control) widen(t.control); }, true);
    // uploads: a .jxl file goes as a PNG (except into the project's pictures)
    const keepUrl = (u) => /\/api\/passets(?:[/?#]|$)/.test(u);
    const of = typeof win.fetch === "function" ? win.fetch.bind(win) : null;   // 2.519.0: a window without fetch stays so
    if (of) win.fetch = async function (input, init) {
      try {
        const body = init && init.body;
        const url = typeof input === "string" ? input : (input && input.url) || "";
        if (body && win.FormData && body instanceof win.FormData && !keepUrl(url) && !body.has("keepjxl")) {
          let changed = false; const fd = new win.FormData();
          for (const [k, v] of body.entries()) {
            if (v && win.Blob && v instanceof win.Blob && (await blobIsJxl(v))) {
              const png = await toPngBlob(v);
              fd.append(k, new win.File([png], String(v.name || "picture.jxl").replace(/\.jxl$/i, "") + ".png", { type: "image/png" }));
              changed = true; stats.uploads++;
            } else fd.append(k, v);
          }
          if (changed) init = Object.assign({}, init, { body: fd });
        }
      } catch (e) { /* send it as it was */ }
      return of(input, init);
    };
    const api = Object.assign({}, pure, {
      stats,
      decodeToCanvas: async (src) => {
        const b = src instanceof win.Blob ? src : new win.Blob([src]);
        const bmp = await win.createImageBitmap(await toPngBlob(b));
        const c = doc.createElement("canvas"); c.width = bmp.width; c.height = bmp.height; c.getContext("2d").drawImage(bmp, 0, 0); return c;
      },
      encodeCanvas: async (c, opts) => new win.Blob([await encode(c.getContext("2d").getImageData(0, 0, c.width, c.height), opts)], { type: "image/jxl" }),
    });
    win.__bgJxl = api; win.BGJxl = api;
    return api;
  }

  const BGJxl = Object.assign({ install }, pure);
  if (isNode) module.exports = BGJxl;
  else { root.BGJxl = BGJxl; install(root); }
})(typeof window !== "undefined" ? window : globalThis);
