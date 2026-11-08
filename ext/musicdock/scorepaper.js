/* bitGen Studio — the sheet music's PAPER (2.732.0): window.ScorePaper.
 *
 * Tim (verbatim): "allow user to choose background color/material tiling for the sheet music"
 *
 * The Sheet Music tab's 🎨 Paper row: the paper's colour, a MATERIAL repeated across the page (parchment, linen, laid,
 * recycled, watercolour, canvas, kraft - drawn here on a canvas, seamless, the same every time; or a picture from the
 * project / this computer), how big one repeat is, how strong the texture is, and the ink (auto = dark on light paper,
 * light on dark). The pages on screen and the saved PDF use the same tile (AbcScore.toSVG / toPDF's look: an SVG
 * pattern; in the PDF one JPEG as a tiling pattern - nothing decoded, nothing imported). Kept per viewer (localStorage).
 *   normalize(o) -> settings      inkFor(settings, avgHex) -> "#rrggbb"      luminance(hex) 0..1      (pure, Node-tested)
 *   load() / save(settings)       look(settings) -> Promise<{svg, pdf, avg, ink}>   (the browser: a canvas)
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(null);
  else root.ScorePaper = factory(root);
}(typeof window !== "undefined" ? window : this, function (root) {
  "use strict";
  const MATERIALS = [
    { id: "plain", label: "Plain" }, { id: "parchment", label: "Parchment" }, { id: "linen", label: "Linen" },
    { id: "laid", label: "Laid paper" }, { id: "recycled", label: "Recycled" }, { id: "watercolour", label: "Watercolour" },
    { id: "canvas", label: "Canvas" }, { id: "kraft", label: "Kraft" },
  ];
  const PRESETS = [
    { color: "#ffffff", label: "White" }, { color: "#fbf6e8", label: "Cream" }, { color: "#f3e6c8", label: "Antique" },
    { color: "#e8e4dc", label: "Stone" }, { color: "#dfe9f2", label: "Pale blue" }, { color: "#cdb084", label: "Kraft" },
    { color: "#22262f", label: "Night" },
  ];
  const INKS = { auto: "", black: "#141414", sepia: "#3b2817", navy: "#15294a", white: "#f5f0e4" };
  const DEFAULTS = { color: "#ffffff", material: "plain", size: 180, strength: 60, ink: "auto", pdf: true, picture: null };
  const KEY = "h3.muScorePaper";
  const TILE_PX = 512;

  const hex = (v) => (/^#[0-9a-f]{6}$/i.test(String(v || "").trim()) ? String(v).trim().toLowerCase() : null);
  function normalize(o) {
    const s = o && typeof o === "object" ? o : {};
    const out = Object.assign({}, DEFAULTS);
    out.color = hex(s.color) || DEFAULTS.color;
    out.material = s.material === "picture" || MATERIALS.some((m) => m.id === s.material) ? s.material : DEFAULTS.material;
    const z = +s.size; out.size = Number.isFinite(z) ? Math.max(40, Math.min(600, Math.round(z))) : DEFAULTS.size;
    const st = +s.strength; out.strength = Number.isFinite(st) ? Math.max(0, Math.min(100, Math.round(st))) : DEFAULTS.strength;
    out.ink = Object.prototype.hasOwnProperty.call(INKS, s.ink) ? s.ink : DEFAULTS.ink;
    out.pdf = s.pdf !== false;
    const pic = s.picture && typeof s.picture === "object" && typeof s.picture.src === "string" && /^(data:image\/|\/passets\/images\/)/.test(s.picture.src) ? s.picture : null;
    out.picture = pic ? { src: pic.src, name: String(pic.name || "picture").slice(0, 120) } : null;
    if (out.material === "picture" && !out.picture) out.material = "plain";
    return out;
  }
  function luminance(h) {
    const v = hex(h);
    if (!v) return 1;
    const n = parseInt(v.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => { x /= 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  /** the ink for this paper: the one picked, or auto = near-black on light paper, warm white on dark */
  function inkFor(settings, avg) {
    const s = normalize(settings);
    if (s.ink !== "auto") return INKS[s.ink];
    return luminance(avg || s.color) < 0.2 ? INKS.white : INKS.black;
  }
  function load() { try { return normalize(JSON.parse(root.localStorage.getItem(KEY) || "{}")); } catch (e) { return normalize({}); } }
  function save(s) { const n = normalize(s); try { root.localStorage.setItem(KEY, JSON.stringify(n)); } catch (e) { /* private window: this page only */ } return n; }

  // ── the materials, drawn on a canvas (the browser) ──
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  /** draw fn(x, y) at x, y and wherever it would cross an edge on the far side too - a seamless tile */
  function wrap(N, x, y, r, fn) {
    const xs = [x], ys = [y];
    if (x - r < 0) xs.push(x + N); if (x + r > N) xs.push(x - N);
    if (y - r < 0) ys.push(y + N); if (y + r > N) ys.push(y - N);
    for (const X of xs) for (const Y of ys) fn(X, Y);
  }
  const CACHE = {};
  function material(id) {
    if (CACHE[id]) return CACHE[id];
    const N = TILE_PX, c = root.document.createElement("canvas");
    c.width = c.height = N;
    const x = c.getContext("2d"), rnd = mulberry(id.length * 7919 + id.charCodeAt(0) * 131);
    const specks = (n, col, a, size) => { for (let i = 0; i < n; i++) { const px = rnd() * N, py = rnd() * N, w = (size || 1.5) * (0.5 + rnd()); x.fillStyle = `rgba(${col},${(a * (0.4 + rnd())).toFixed(3)})`; wrap(N, px, py, w, (X, Y) => x.fillRect(X, Y, w, w)); } };
    const blot = (n, col, a, r0, r1) => {
      for (let i = 0; i < n; i++) {
        const px = rnd() * N, py = rnd() * N, r = r0 + rnd() * (r1 - r0), al = a * (0.5 + rnd());
        wrap(N, px, py, r, (X, Y) => { const g = x.createRadialGradient(X, Y, 0, X, Y, r); g.addColorStop(0, `rgba(${col},${al.toFixed(3)})`); g.addColorStop(1, `rgba(${col},0)`); x.fillStyle = g; x.fillRect(X - r, Y - r, 2 * r, 2 * r); });
      }
    };
    const fibres = (n, cols, a, len) => {
      for (let i = 0; i < n; i++) {
        const px = rnd() * N, py = rnd() * N, L = len * (0.4 + rnd()), an = rnd() * Math.PI * 2, col = cols[Math.floor(rnd() * cols.length)];
        x.strokeStyle = `rgba(${col},${(a * (0.5 + rnd())).toFixed(3)})`; x.lineWidth = 0.6 + rnd() * 0.8;
        wrap(N, px, py, L, (X, Y) => { x.beginPath(); x.moveTo(X, Y); x.quadraticCurveTo(X + Math.cos(an + 0.6) * L * 0.6, Y + Math.sin(an + 0.6) * L * 0.6, X + Math.cos(an) * L, Y + Math.sin(an) * L); x.stroke(); });
      }
    };
    const lines = (step, horiz, a, w) => { for (let p = 0; p < N; p += step) { x.fillStyle = `rgba(0,0,0,${(a * (0.4 + rnd())).toFixed(3)})`; if (horiz) x.fillRect(0, p, N, w); else x.fillRect(p, 0, w, N); } };
    if (id === "parchment") { blot(46, "120,82,30", 0.11, 30, 150); blot(14, "255,252,235", 0.22, 40, 120); specks(2600, "70,45,20", 0.1, 1.4); fibres(120, ["110,80,40"], 0.12, 18); }
    else if (id === "linen") { lines(2, true, 0.07, 1); lines(2, false, 0.07, 1); blot(20, "0,0,0", 0.035, 40, 120); specks(1200, "0,0,0", 0.06, 1); }
    else if (id === "laid") { lines(4, true, 0.07, 1.2); for (let p = 0; p < N; p += 64) { x.fillStyle = "rgba(0,0,0,0.09)"; x.fillRect(p, 0, 1.6, N); } blot(16, "0,0,0", 0.03, 50, 140); specks(900, "0,0,0", 0.05, 1); }
    else if (id === "recycled") { specks(5200, "40,40,40", 0.09, 1.3); fibres(700, ["60,60,70", "40,70,140", "120,80,40", "150,40,40"], 0.28, 12); blot(18, "0,0,0", 0.04, 40, 120); }
    else if (id === "watercolour") { blot(34, "40,70,120", 0.08, 50, 170); blot(30, "120,60,40", 0.06, 40, 150); blot(22, "255,255,255", 0.2, 40, 120); specks(1500, "0,0,0", 0.06, 1.6); }
    else if (id === "canvas") {
      for (let yy = 0; yy < N; yy += 4) for (let xx = 0; xx < N; xx += 4) { const on = ((xx + yy) / 4) % 2 === 0; x.fillStyle = `rgba(0,0,0,${(on ? 0.06 : 0.12) * (0.6 + rnd() * 0.8)})`; x.fillRect(xx, yy + (on ? 0 : 2), on ? 4 : 2, 2); x.fillRect(xx + (on ? 0 : 2), yy, 2, on ? 2 : 4); }
      blot(20, "0,0,0", 0.03, 40, 120);
    } else if (id === "kraft") { fibres(2600, ["90,60,30", "60,40,20", "150,110,60"], 0.22, 10); specks(3000, "50,30,10", 0.1, 1.4); blot(20, "80,50,20", 0.05, 40, 130); }
    CACHE[id] = c;
    return c;
  }
  function loadImage(src) {
    return new Promise((res, rej) => { const im = new root.Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("the picture would not open")); im.src = src; });
  }
  function blobBytes(canvas, q) {
    return new Promise((res, rej) => canvas.toBlob((b) => (b ? b.arrayBuffer().then((ab) => res(new Uint8Array(ab)), rej) : rej(new Error("no JPEG"))), "image/jpeg", q || 0.88));
  }
  function b64(bytes) { let s = ""; for (let k = 0; k < bytes.length; k += 8192) s += String.fromCharCode.apply(null, bytes.subarray(k, k + 8192)); return root.btoa(s); }
  function avgOf(canvas) {
    const t = root.document.createElement("canvas"); t.width = t.height = 16;
    const x = t.getContext("2d"); x.drawImage(canvas, 0, 0, 16, 16);
    const d = x.getImageData(0, 0, 16, 16).data; const s = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) { s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; }
    return "#" + s.map((v) => Math.round(v / 256).toString(16).padStart(2, "0")).join("");
  }
  /** a picture from this computer, made small enough to keep (a JPEG data URL, at most 1024 px) */
  function shrink(file) {
    return new Promise((res, rej) => {
      const rd = new root.FileReader();
      rd.onload = () => loadImage(String(rd.result)).then((im) => {
        const k = Math.min(1, 1024 / Math.max(im.naturalWidth, im.naturalHeight));
        const c = root.document.createElement("canvas"); c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        res(c.toDataURL("image/jpeg", 0.85));
      }, rej);
      rd.onerror = () => rej(new Error("could not read " + file.name));
      rd.readAsDataURL(file);
    });
  }
  /** the look for AbcScore.toSVG / toPDF: {svg, pdf, avg, ink} (plain paper = a colour, no tile) */
  async function look(settings) {
    const s = normalize(settings);
    const k = s.strength / 100;
    if (s.material === "plain" || (k <= 0 && s.material !== "picture")) {
      const ink = inkFor(s, s.color);
      return { svg: { paper: { color: s.color }, ink }, pdf: { paper: { color: s.color }, ink }, avg: s.color, ink, settings: s };
    }
    let src, w = s.size, h = s.size;
    if (s.material === "picture") {
      const im = await loadImage(s.picture.src);
      const iw = im.naturalWidth || 1, ih = im.naturalHeight || 1, sc = Math.min(1, 1024 / Math.max(iw, ih));
      src = root.document.createElement("canvas"); src.width = Math.max(1, Math.round(iw * sc)); src.height = Math.max(1, Math.round(ih * sc));
      src.getContext("2d").drawImage(im, 0, 0, src.width, src.height);
      h = s.size * ih / iw;
    } else src = material(s.material);
    const c = root.document.createElement("canvas"); c.width = src.width; c.height = src.height;
    const x = c.getContext("2d");
    x.fillStyle = s.color; x.fillRect(0, 0, c.width, c.height);
    x.globalAlpha = s.material === "picture" ? Math.max(0.05, k) : k;
    x.drawImage(src, 0, 0);
    x.globalAlpha = 1;
    const jpeg = await blobBytes(c);
    const href = "data:image/jpeg;base64," + b64(jpeg);
    const avg = avgOf(c), ink = inkFor(s, avg);
    return { svg: { paper: { color: s.color, avg, tile: { href, w, h } }, ink }, pdf: { paper: { color: s.color, avg, tile: { jpeg, w, h } }, ink }, avg, ink, settings: s };
  }

  return { MATERIALS, PRESETS, INKS, DEFAULTS, KEY, normalize, luminance, inkFor, load, save, look, shrink, material };
}));
