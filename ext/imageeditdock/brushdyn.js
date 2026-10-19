/* brushdyn.js — BRUSH SETTINGS, BRUSH PRESETS, .ABR BRUSHES (2.484.0): the image editor's gap, round E.
 * window.IEBrushDyn.
 *
 * Tim (verbatim): "close the photoshop gap."
 *
 *   The 🖌 Brush tab (Properties group; Window ▸ Brush Settings, F5 is taken by the curve tools so none):
 *     Brushes        the presets (the 20 built in + yours + .abr ones) - click = use it; ⤒ Import .abr… (sampled
 *                    brushes from a brush file), 💾 New Brush Preset… (the current one with its settings, kept in
 *                    brushes/<name>.json in the install folder), 🗑 delete yours, ↺ reset a built-in one
 *     Brush Tip      angle, roundness, flip X / Y, hardness, spacing (and the size from the options bar)
 *     Shape Dynamics size jitter (+ minimum, control off / pen pressure / fade over N steps), angle jitter (control
 *                    off / the stroke's direction / pen pressure), roundness jitter (+ minimum), flip jitter
 *     Scattering     scatter (% of the size, both axes or across the stroke), count, count jitter
 *     Texture        noise / canvas / paper / any pattern of the pattern library - scale, depth, invert, multiply or
 *                    subtract
 *     Dual Brush     a second tip cuts into the first (size, scatter, count)
 *     Color Dynamics foreground / background jitter, hue, saturation, brightness jitter, purity - per tip or per
 *                    stroke
 *     Transfer       opacity jitter, flow jitter (control off / pen pressure)
 *     Smoothing      0-100 % - the brush follows the pointer on a string
 *   Each preset keeps its own settings (built-in ones in this editor's settings, yours with the preset).
 * The brush engine (brushes.js) hands a dab here when the preset has settings that need it (active(p)).
 * Pure (Node: scripts/test-brushdyn.js): DYN_DEFAULT, active, dynAt, jitterColor, textureValue, parseAbr, toB64.
 */
(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  const DYN_DEFAULT = () => ({
    tip: { angle: 0, roundness: 100, flipX: false, flipY: false },
    shape: { on: false, sizeJitter: 0, minDiameter: 0, sizeControl: "off", fadeSteps: 25, angleJitter: 0, angleControl: "off", roundJitter: 0, minRound: 25, flipXJitter: false, flipYJitter: false },
    scatter: { on: false, amount: 0, both: false, count: 1, countJitter: 0 },
    texture: { on: false, pattern: "noise", scale: 100, depth: 60, invert: false, mode: "multiply" },
    dual: { on: false, tip: "chalk", size: 40, scatter: 50, count: 2 },
    color: { on: false, fgbg: 0, hue: 0, sat: 0, bright: 0, purity: 0, perTip: true },
    transfer: { on: false, opacityJitter: 0, flowJitter: 0, control: "off" },
  });
  /** does this preset need the dynamics drawer? */
  function active(p) {
    const d = p && p.dyn; if (!d) return false;
    const t = d.tip || {};
    return !!((t.angle || 0) !== 0 || (t.roundness != null && t.roundness !== 100) || t.flipX || t.flipY
      || (d.shape && d.shape.on) || (d.scatter && d.scatter.on) || (d.texture && d.texture.on) || (d.dual && d.dual.on) || (d.color && d.color.on) || (d.transfer && d.transfer.on));
  }
  /** one dab's dynamics: n = the dab's number in the stroke, dir = the stroke's direction (rad), pressure 0..1 */
  function dynAt(dyn, rnd, n, dir, pressure) {
    const d = Object.assign(DYN_DEFAULT(), dyn || {}), t = d.tip, sh = d.shape, sc = d.scatter, tr = d.transfer;
    const pr = pressure == null ? 1 : clamp01(pressure);
    let size = 1, angle = (t.angle || 0) * Math.PI / 180, round = (t.roundness == null ? 100 : t.roundness) / 100, flipX = !!t.flipX, flipY = !!t.flipY, alpha = 1, flow = 1, count = 1;
    if (sh.on) {
      const min = (sh.minDiameter || 0) / 100;
      let ctl = 1; if (sh.sizeControl === "pressure") ctl = pr; else if (sh.sizeControl === "fade") ctl = Math.max(0, 1 - n / Math.max(1, sh.fadeSteps || 25));
      size = min + (1 - min) * ctl;
      if (sh.sizeJitter) size *= 1 - (sh.sizeJitter / 100) * rnd() * (1 - min);
      size = Math.max(min, size);
      if (sh.angleControl === "direction") angle += dir || 0; else if (sh.angleControl === "pressure") angle += pr * Math.PI * 2;
      if (sh.angleJitter) angle += (rnd() - 0.5) * 2 * Math.PI * (sh.angleJitter / 100);
      if (sh.roundJitter) { const mr = (sh.minRound || 0) / 100; round = Math.max(mr, round * (1 - (sh.roundJitter / 100) * rnd())); }
      if (sh.flipXJitter && rnd() < 0.5) flipX = !flipX;
      if (sh.flipYJitter && rnd() < 0.5) flipY = !flipY;
    }
    const offsets = [];
    if (sc.on) {
      count = Math.max(1, Math.round((sc.count || 1) * (1 - (sc.countJitter || 0) / 100 * rnd())));
      const amt = (sc.amount || 0) / 100;
      for (let k = 0; k < count; k++) {
        const across = (rnd() - 0.5) * 2 * amt, along = sc.both ? (rnd() - 0.5) * 2 * amt : 0;
        // across the stroke (perpendicular to its direction), and along it too when "both axes"
        offsets.push([-Math.sin(dir || 0) * across + Math.cos(dir || 0) * along, Math.cos(dir || 0) * across + Math.sin(dir || 0) * along]);
      }
    } else offsets.push([0, 0]);
    if (tr.on) {
      const base = tr.control === "pressure" ? pr : 1;
      alpha = base * (1 - (tr.opacityJitter || 0) / 100 * rnd());
      flow = 1 - (tr.flowJitter || 0) / 100 * rnd();
    }
    return { size: Math.max(0.02, size), angle, round: Math.max(0.01, Math.min(1, round)), flipX, flipY, offsets, count: offsets.length, alpha, flow };
  }
  const hex2 = (h) => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(h || "")); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0]; };
  const toHex = (c) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  function rgb2hsv(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h / 6, mx ? d / mx : 0, mx]; }
  function hsv2rgb(h, s, v) { const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s); const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6]; return [r * 255, g * 255, b * 255]; }
  /** Color Dynamics: a colour between the foreground and the background, its hue / saturation / brightness jittered */
  function jitterColor(fg, bg, cd, rnd) {
    const a = hex2(fg), b = hex2(bg), t = (cd.fgbg || 0) / 100 * rnd();
    let c = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    let [h, s, v] = rgb2hsv(...c);
    if (cd.hue) h = ((h + (rnd() - 0.5) * (cd.hue / 100)) % 1 + 1) % 1;
    if (cd.sat) s = clamp01(s + (rnd() - 0.5) * 2 * (cd.sat / 100));
    if (cd.bright) v = clamp01(v + (rnd() - 0.5) * 2 * (cd.bright / 100));
    if (cd.purity) s = clamp01(s + cd.purity / 100);
    c = hsv2rgb(h, s, v);
    return toHex(c);
  }
  /** a built-in texture's value (0..1) at a picture point (scale %) */
  function textureValue(kind, x, y, scale) {
    const k = Math.max(0.1, (scale || 100) / 100), X = x / k, Y = y / k;
    const hash = (a, b) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    if (kind === "canvas") { const u = X / 3, v = Y / 3; return 0.55 + 0.45 * Math.abs(Math.sin(u * Math.PI) * Math.sin(v * Math.PI)) * ((Math.floor(u) + Math.floor(v)) % 2 ? 1 : 0.7); }
    if (kind === "paper") { const a = hash(Math.floor(X / 2), Math.floor(Y / 6)), b = hash(Math.floor(X / 5), Math.floor(Y / 2)); return 0.5 + 0.5 * (a * 0.6 + b * 0.4); }
    return hash(Math.floor(X), Math.floor(Y));                                            // noise
  }
  /** base64 of bytes (for brushes/<name>.json) */
  function toB64(u8) {
    if (typeof Buffer !== "undefined" && !root.document) return Buffer.from(u8).toString("base64");
    let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return root.btoa(s);
  }

  /* ---------------- .abr brush files (sampled brushes: versions 1, 2, 6, 7, 10) ---------------- */
  function parseAbr(buf) {
    const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf), dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    let o = 0;
    const i16 = () => { const v = dv.getInt16(o); o += 2; return v; }, u16 = () => { const v = dv.getUint16(o); o += 2; return v; }, i32 = () => { const v = dv.getInt32(o); o += 4; return v; }, u8 = () => u[o++];
    const ustr = () => { const n = i32(); let s = ""; for (let k = 0; k < n; k++) { const c = u16(); if (c) s += String.fromCharCode(c); } return s; };
    function pixels(w, h, depth, comp) {
      const bpp = depth >> 3, out = new Uint8Array(w * h);
      if (!comp) { for (let p = 0; p < w * h; p++) { out[p] = u[o]; o += bpp; } return out; }
      const counts = []; for (let r = 0; r < h; r++) counts.push(u16());
      for (let r = 0; r < h; r++) {
        const end = o + counts[r], row = new Uint8Array(w * bpp); let x = 0;
        while (o < end && x < row.length) { const n = (u[o] << 24) >> 24; o++; if (n >= 0) { for (let k = 0; k <= n && x < row.length; k++) row[x++] = u[o++]; } else if (n !== -128) { const v = u[o++]; for (let k = 0; k <= -n && x < row.length; k++) row[x++] = v; } }
        o = end;
        for (let k = 0; k < w; k++) out[r * w + k] = row[k * bpp];
      }
      return out;
    }
    const version = i16(), out = [];
    if (version === 1 || version === 2) {
      const count = i16();
      for (let b = 0; b < count; b++) {
        const type = i16(), size = i32(), next = o + size;
        if (type === 2) {
          i32(); const spacing = i16(); let name = ""; if (version === 2) name = ustr();
          u8(); i16(); i16(); i16(); i16();                                                  // antialias + short bounds
          const top = i32(), left = i32(), bottom = i32(), right = i32(), depth = i16(), comp = u8();
          const w = right - left, h = bottom - top;
          if (w > 0 && h > 0 && w * h < 64e6) out.push({ name: name || "Brush " + (out.length + 1), w, h, spacing, data: pixels(w, h, depth, comp) });
        }
        o = next;
      }
      return out;
    }
    if (version >= 6) {
      const sub = i16();
      while (o + 12 <= u.length) {
        const sig = String.fromCharCode(u[o], u[o + 1], u[o + 2], u[o + 3]), key = String.fromCharCode(u[o + 4], u[o + 5], u[o + 6], u[o + 7]); o += 8;
        const len = i32(), start = o, end = o + len;
        if (sig !== "8BIM") break;
        if (key === "samp") {
          while (o < end - 4) {
            const bsize = i32(), bstart = o, bend = bstart + bsize;
            o += sub === 1 ? 47 : 301;
            const top = i32(), left = i32(), bottom = i32(), right = i32(), depth = i16(), comp = u8(), w = right - left, h = bottom - top;
            if (w > 0 && h > 0 && w * h < 64e6) out.push({ name: "Brush " + (out.length + 1), w, h, spacing: 25, data: pixels(w, h, depth, comp) });
            o = bend % 4 ? bend + 4 - (bend % 4) : bend;
          }
        }
        o = end;
        if (o <= start) break;
      }
      return out;
    }
    throw new Error("not a brush file (.abr) this reads (version " + version + ")");
  }

  /* ---------------- the dab ---------------- */
  const B = () => root.IEBrushes;
  let getBg = () => "#ffffff", patternTile = () => null;
  function tex(doc, kind, scale) {
    const key = kind + "|" + scale;
    tex.cache = tex.cache || new Map();
    if (tex.cache.has(key)) return tex.cache.get(key);
    if (/^pattern:/.test(kind)) { const t = patternTile(kind.slice(8)); if (t) tex.cache.set(key, t); return t; }
    return null;
  }
  function dab(st, x, y, pressure, dir) {
    const p = st.p, Bx = B(), doc = st.doc, d = Object.assign(DYN_DEFAULT(), p.dyn || {}), g = st.bg;
    const at = Bx.atPressure(p, st.size, st.flow, pressure);
    st.nDab = (st.nDab || 0) + 1;
    const dy = dynAt(d, st.rnd, st.nDab, dir || 0, pressure == null ? 1 : pressure);
    if (d.color.on && (!d.color.perTip ? !st.dynColor : true)) st.dynColor = jitterColor(st.color, getBg(), d.color, st.rnd);
    const color = d.color.on ? st.dynColor : st.color;
    const s = Math.max(1, at.size * dy.size), r = s / 2;
    const tip = Bx.tipCanvas(doc, p, s, color);
    for (const [ox, oy] of dy.offsets) {
      const cx = x + ox * at.size, cy = y + oy * at.size;
      st.grow(cx, cy, r + 2);
      let img = tip;
      const needTemp = d.texture.on || d.dual.on;
      if (needTemp) {
        const n = tip.width, t = doc.createElement("canvas"); t.width = n; t.height = n; const tg = t.getContext("2d"); tg.drawImage(tip, 0, 0);
        if (d.dual.on) {                                                                    // the second tip cuts in
          const m = doc.createElement("canvas"); m.width = n; m.height = n; const mg = m.getContext("2d"), dp = Bx.byId(d.dual.tip) || Bx.PRESETS[0], ds = Math.max(1, d.dual.size * at.size / 100);
          const dt = Bx.tipCanvas(doc, dp, ds, "#000000");
          for (let k = 0; k < Math.max(1, d.dual.count | 0); k++) { const a = st.rnd() * Math.PI * 2, rr = st.rnd() * n / 2 * (d.dual.scatter / 100); mg.drawImage(dt, n / 2 + Math.cos(a) * rr - ds / 2, n / 2 + Math.sin(a) * rr - ds / 2); }
          tg.globalCompositeOperation = "destination-in"; tg.drawImage(m, 0, 0); tg.globalCompositeOperation = "source-over";
        }
        if (d.texture.on) {                                                                 // the texture, fixed to the picture
          const id = tg.getImageData(0, 0, n, n), px = id.data, x0 = cx - n / 2, y0 = cy - n / 2, depth = d.texture.depth / 100, tile = tex(doc, d.texture.pattern, d.texture.scale);
          for (let yy = 0; yy < n; yy++) for (let xx = 0; xx < n; xx++) {
            const i = (yy * n + xx) * 4; if (!px[i + 3]) continue;
            let tv = tile ? tile.at(x0 + xx, y0 + yy) : textureValue(d.texture.pattern, x0 + xx, y0 + yy, d.texture.scale);
            if (d.texture.invert) tv = 1 - tv;
            const k = d.texture.mode === "subtract" ? clamp01(1 - depth * (1 - tv) * 1.6) : 1 - depth * (1 - tv);
            px[i + 3] = Math.round(px[i + 3] * clamp01(k));
          }
          tg.putImageData(id, 0, 0);
        }
        img = t;
      }
      g.save();
      g.globalAlpha = Math.max(0.003, at.flow * dy.alpha * dy.flow);
      g.translate(cx, cy); g.rotate(dy.angle); g.scale(dy.flipX ? -1 : 1, (dy.flipY ? -1 : 1) * dy.round);
      g.drawImage(img, -img.width / 2, -img.height / 2);
      g.restore();
    }
  }

  /* ---------------- the page: the 🖌 Brush tab ---------------- */
  function install(E) {
    const Bx = B(); if (!Bx) return;
    const { S, store } = E, doc = E.doc || root.document, win = doc.defaultView || root, kx = E.kx;
    const $ = (id) => doc.getElementById(id), say = (t) => (E.say ? E.say(t) : null);
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    getBg = () => S.bg || "#ffffff";
    // a pattern of the pattern library as a texture (loaded once)
    const tiles = new Map();
    patternTile = (name) => {
      if (tiles.has(name)) return tiles.get(name) || null;
      tiles.set(name, null);
      const im = new win.Image();
      im.onload = () => { const c = doc.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height;
        tiles.set(name, { at: (x, y) => { const X = ((Math.floor(x) % W) + W) % W, Y = ((Math.floor(y) % H) + H) % H, i = (Y * W + X) * 4; return (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255; } }); if (tex.cache) tex.cache.clear(); };
      im.src = "/api/patterns/file/" + encodeURIComponent(name);
      return null;
    };
    // the built-in presets as they came (↺ reset), the saved changes to them
    const ORIG = new Map(Bx.PRESETS.map((p) => [p.id, JSON.parse(JSON.stringify(p))]));
    const KEYS = ["hardness", "spacing", "smoothing", "dyn"];
    const applySaved = (p) => { const o = store.get("brush.set." + p.id, null); if (o) { for (const k of KEYS) if (k in o) p[k] = JSON.parse(JSON.stringify(o[k])); p.v = (p.v || 0) + 1; } };
    Bx.PRESETS.forEach(applySaved);
    const isUser = (p) => /^user:/.test(p.id);
    // yours (brushes/<name>.json)
    async function loadUser() {
      try {
        const j = await (await win.fetch("/api/brushes")).json();
        for (const it of j.brushes || []) { const p = it.preset; if (!p || !p.id) continue; const k = Bx.PRESETS.findIndex((x) => x.id === p.id); if (k >= 0) Bx.PRESETS[k] = p; else Bx.PRESETS.push(p); }
        paint();
      } catch (e) { /* the server may not have it */ }
    }
    const saveUser = async (p) => { const r = await (await win.fetch("/api/brushes/save", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ name: p.name, preset: p }) })).json(); if (r.error) throw new Error(r.error); return r; };
    let saveT = 0;
    function changed(p) {
      p.v = (p.v || 0) + 1;
      if (isUser(p)) { win.clearTimeout(saveT); saveT = win.setTimeout(() => saveUser(p).catch((e) => say("could not keep the brush: " + e.message)), 600); }
      else { const o = {}; for (const k of KEYS) if (k in p) o[k] = p[k]; store.set("brush.set." + p.id, o); }
    }
    // the tab
    const ctl = kx && kx.querySelector('.pcgrp .pctabs [data-tab="pcAdjs"]');
    if (ctl && !$("pcBrush")) {
      const b = doc.createElement("button"); b.type = "button"; b.dataset.tab = "pcBrush"; b.dataset.grp = "props"; b.textContent = "🖌 Brush"; b.onclick = () => E.ui.showTab("pcBrush"); ctl.after(b);
      const body = doc.createElement("div"); body.className = "pcbody"; body.dataset.body = "pcBrush"; body.id = "pcBrush"; ctl.parentElement.parentElement.appendChild(body);
      const css = doc.createElement("style");
      css.textContent = "#pcBrush{padding:6px 8px;font-size:11px}#pcBrush .bs{border-top:1px solid var(--pc-line,#333);padding:4px 0}#pcBrush .bs>label.h{display:flex;gap:6px;align-items:center;font-weight:600;margin:2px 0}"
        + "#pcBrush .r{display:flex;gap:4px;align-items:center;margin:2px 0}#pcBrush .r>span:first-child{min-width:92px;color:var(--pc-dim)}#pcBrush .r input[type=range]{flex:1;min-width:60px}#pcBrush .r input[type=number]{width:52px}"
        + "#pcBrush .bl{display:flex;flex-wrap:wrap;gap:3px;max-height:140px;overflow:auto;margin:4px 0}#pcBrush .bl button{padding:2px 5px;font-size:11px}#pcBrush .bl button.on{outline:2px solid var(--tiger,#f59e2c)}";
      doc.head.appendChild(css);
      const prev = E.ui.showTab; E.ui.showTab = function (id) { const r = prev.apply(this, arguments); if (id === "pcBrush") paint(); return r; };
    }
    const cur = () => Bx.byId(S.preset);
    const R = (label, path, min, max, step, val) => `<div class="r"><span>${label}</span><input type="range" data-k="${path}" min="${min}" max="${max}" step="${step || 1}" value="${val}"><input type="number" data-k="${path}" min="${min}" max="${max}" step="${step || 1}" value="${val}"></div>`;
    const SELR = (label, path, opts, val) => `<div class="r"><span>${label}</span><select data-k="${path}">${opts.map(([v, n]) => `<option value="${v}"${v === val ? " selected" : ""}>${n}</option>`).join("")}</select></div>`;
    const CHKR = (label, path, val) => `<label style="margin-right:8px"><input type="checkbox" data-k="${path}"${val ? " checked" : ""}> ${label}</label>`;
    function paint() {
      const box = $("pcBrush"); if (!box || !box.classList.contains("on")) return;
      const p = cur(); if (!p) return;
      const d = p.dyn = Object.assign(DYN_DEFAULT(), p.dyn || {});
      for (const k of Object.keys(DYN_DEFAULT())) d[k] = Object.assign(DYN_DEFAULT()[k], d[k] || {});
      const sec = (key, title, inner) => `<div class="bs"><label class="h"><input type="checkbox" data-k="dyn.${key}.on"${d[key].on ? " checked" : ""}> ${title}</label>${d[key].on ? inner : ""}</div>`;
      const pats = (root.PCPattern && root.PCPattern.names ? root.PCPattern.names() : []);
      box.innerHTML = `<div class="r" style="justify-content:space-between"><b>${esc(p.icon || "")} ${esc(p.name)}</b><span>${isUser(p) ? "yours" : ORIG.has(p.id) ? "built in" : ""}</span></div>
        <div class="bl">${Bx.PRESETS.map((q) => `<button type="button" class="ghost${q.id === p.id ? " on" : ""}" data-pid="${esc(q.id)}" title="${esc(q.name)}">${esc(q.icon || "•")} ${esc(q.name)}</button>`).join("")}</div>
        <div class="r"><button type="button" class="ghost" id="bdAbr" title="Sampled brushes from a brush file (.abr)">⤒ Import .abr…</button><button type="button" class="ghost" id="bdNew">💾 New Brush Preset…</button>${isUser(p) ? '<button type="button" class="ghost" id="bdDel">🗑 Delete</button>' : '<button type="button" class="ghost" id="bdReset" title="Back to how it came">↺ Reset</button>'}</div>
        <div class="bs"><label class="h">Brush Tip Shape</label>${R("Angle (°)", "dyn.tip.angle", -180, 180, 1, d.tip.angle)}${R("Roundness (%)", "dyn.tip.roundness", 1, 100, 1, d.tip.roundness)}
          ${R("Hardness (%)", "hardness", 0, 100, 1, Math.round((p.hardness == null ? 1 : p.hardness) * 100))}${R("Spacing (%)", "spacing", 1, 500, 1, Math.round((p.spacing || 0.1) * 100))}<div class="r"><span></span>${CHKR("Flip X", "dyn.tip.flipX", d.tip.flipX)}${CHKR("Flip Y", "dyn.tip.flipY", d.tip.flipY)}</div></div>`
        + sec("shape", "Shape Dynamics", R("Size jitter (%)", "dyn.shape.sizeJitter", 0, 100, 1, d.shape.sizeJitter) + R("Minimum diameter (%)", "dyn.shape.minDiameter", 0, 100, 1, d.shape.minDiameter)
          + SELR("Size control", "dyn.shape.sizeControl", [["off", "Off"], ["pressure", "Pen pressure"], ["fade", "Fade"]], d.shape.sizeControl) + R("Fade steps", "dyn.shape.fadeSteps", 1, 999, 1, d.shape.fadeSteps)
          + R("Angle jitter (%)", "dyn.shape.angleJitter", 0, 100, 1, d.shape.angleJitter) + SELR("Angle control", "dyn.shape.angleControl", [["off", "Off"], ["direction", "Direction"], ["pressure", "Pen pressure"]], d.shape.angleControl)
          + R("Roundness jitter (%)", "dyn.shape.roundJitter", 0, 100, 1, d.shape.roundJitter) + R("Minimum roundness (%)", "dyn.shape.minRound", 1, 100, 1, d.shape.minRound)
          + `<div class="r"><span></span>${CHKR("Flip X jitter", "dyn.shape.flipXJitter", d.shape.flipXJitter)}${CHKR("Flip Y jitter", "dyn.shape.flipYJitter", d.shape.flipYJitter)}</div>`)
        + sec("scatter", "Scattering", R("Scatter (%)", "dyn.scatter.amount", 0, 1000, 1, d.scatter.amount) + `<div class="r"><span></span>${CHKR("Both axes", "dyn.scatter.both", d.scatter.both)}</div>` + R("Count", "dyn.scatter.count", 1, 16, 1, d.scatter.count) + R("Count jitter (%)", "dyn.scatter.countJitter", 0, 100, 1, d.scatter.countJitter))
        + sec("texture", "Texture", SELR("Texture", "dyn.texture.pattern", [["noise", "Noise"], ["canvas", "Canvas"], ["paper", "Paper"], ...pats.map((n) => ["pattern:" + n, "Pattern: " + n])], d.texture.pattern)
          + R("Scale (%)", "dyn.texture.scale", 10, 1000, 1, d.texture.scale) + R("Depth (%)", "dyn.texture.depth", 0, 100, 1, d.texture.depth) + SELR("Mode", "dyn.texture.mode", [["multiply", "Multiply"], ["subtract", "Subtract"]], d.texture.mode) + `<div class="r"><span></span>${CHKR("Invert", "dyn.texture.invert", d.texture.invert)}</div>`)
        + sec("dual", "Dual Brush", SELR("Second tip", "dyn.dual.tip", Bx.PRESETS.filter((q) => q.engine === "paint").map((q) => [q.id, q.name]), d.dual.tip) + R("Size (% of the brush)", "dyn.dual.size", 5, 200, 1, d.dual.size) + R("Scatter (%)", "dyn.dual.scatter", 0, 100, 1, d.dual.scatter) + R("Count", "dyn.dual.count", 1, 16, 1, d.dual.count))
        + sec("color", "Color Dynamics", R("Foreground / background jitter (%)", "dyn.color.fgbg", 0, 100, 1, d.color.fgbg) + R("Hue jitter (%)", "dyn.color.hue", 0, 100, 1, d.color.hue) + R("Saturation jitter (%)", "dyn.color.sat", 0, 100, 1, d.color.sat)
          + R("Brightness jitter (%)", "dyn.color.bright", 0, 100, 1, d.color.bright) + R("Purity (%)", "dyn.color.purity", -100, 100, 1, d.color.purity) + `<div class="r"><span></span>${CHKR("Apply per tip", "dyn.color.perTip", d.color.perTip)}</div>`)
        + sec("transfer", "Transfer", R("Opacity jitter (%)", "dyn.transfer.opacityJitter", 0, 100, 1, d.transfer.opacityJitter) + R("Flow jitter (%)", "dyn.transfer.flowJitter", 0, 100, 1, d.transfer.flowJitter) + SELR("Control", "dyn.transfer.control", [["off", "Off"], ["pressure", "Pen pressure"]], d.transfer.control))
        + `<div class="bs">${R("Smoothing (%)", "smoothing", 0, 95, 1, Math.round((p.smoothing || 0) * 100))}</div>`;
      const set = (path, raw, el) => {
        const ks = path.split("."), last = ks.pop(); let o = p; for (const k of ks) o = o[k];
        let v = el.type === "checkbox" ? el.checked : el.tagName === "SELECT" ? el.value : +raw;
        if (path === "hardness") v = v / 100; if (path === "spacing") v = Math.max(0.01, v / 100); if (path === "smoothing") v = v / 100;
        o[last] = v; changed(p);
        if (el.type === "checkbox" && /\.on$/.test(path)) paint();
        else box.querySelectorAll(`[data-k="${path}"]`).forEach((x) => { if (x !== el && x.type !== "checkbox") x.value = raw; });
      };
      box.querySelectorAll("[data-k]").forEach((el) => { el.oninput = el.onchange = () => set(el.dataset.k, el.value, el); });
      box.querySelectorAll("[data-pid]").forEach((b) => { b.onclick = () => { E.choosePreset ? E.choosePreset(b.dataset.pid) : null; S.preset = b.dataset.pid; E.renderOptions(); paint(); }; });
      $("bdNew").onclick = async () => {
        const nm = (win.prompt("Name of the new brush preset", p.name + " copy") || "").trim().slice(0, 60); if (!nm) return;
        const q = JSON.parse(JSON.stringify(p)); q.id = "user:" + nm; q.name = nm; q.icon = q.icon || "🖌"; q.size = S.size || q.size; q.opacity = S.opacity == null ? q.opacity : S.opacity; q.flow = S.flow == null ? q.flow : S.flow; q.v = 1;
        if (p.sample) q.sample = { w: p.sample.w, h: p.sample.h, data: typeof p.sample.data === "string" ? p.sample.data : toB64(Bx.sampleData(p.sample)) };
        try { await saveUser(q); const k = Bx.PRESETS.findIndex((x) => x.id === q.id); if (k >= 0) Bx.PRESETS[k] = q; else Bx.PRESETS.push(q); S.preset = q.id; store.set("preset", q.id); E.renderOptions(); paint(); say(`brush preset "${nm}" kept`); }
        catch (e) { say("could not keep it: " + e.message); }
      };
      const del = $("bdDel"); if (del) del.onclick = async () => { try { await win.fetch("/api/brushes/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: p.name }) }); } catch (e) { /* gone anyway */ } const k = Bx.PRESETS.indexOf(p); if (k >= 0) Bx.PRESETS.splice(k, 1); S.preset = "basic"; E.renderOptions(); paint(); };
      const rs = $("bdReset"); if (rs) rs.onclick = () => { const o = ORIG.get(p.id); if (!o) return; for (const k of KEYS) { if (k in o) p[k] = JSON.parse(JSON.stringify(o[k])); else delete p[k]; } p.v = (p.v || 0) + 1; store.set("brush.set." + p.id, null); paint(); };
      $("bdAbr").onclick = () => {
        const inp = doc.createElement("input"); inp.type = "file"; inp.accept = ".abr";
        inp.onchange = async () => {
          const f = inp.files && inp.files[0]; if (!f) return;
          let list = []; try { list = parseAbr(new Uint8Array(await f.arrayBuffer())); } catch (e) { return say("not a brush file this reads: " + e.message); }
          if (!list.length) return say("no sampled brushes in that file");
          const stem = f.name.replace(/\.abr$/i, "").replace(/[^A-Za-z0-9 ._()-]+/g, "_").slice(0, 40);
          let n = 0;
          for (const [k, it] of list.slice(0, 200).entries()) {
            const nm = list.length > 1 ? `${stem} ${k + 1}` : stem;
            const q = { id: "user:" + nm, name: nm, icon: "❖", engine: "paint", tip: "sampled", size: Math.min(300, Math.max(it.w, it.h)), opacity: 1, flow: 1, hardness: 1, spacing: Math.max(0.01, (it.spacing || 25) / 100), pressure: { size: true, flow: false }, sample: { w: it.w, h: it.h, data: toB64(it.data) }, v: 1 };
            try { await saveUser(q); const j = Bx.PRESETS.findIndex((x) => x.id === q.id); if (j >= 0) Bx.PRESETS[j] = q; else Bx.PRESETS.push(q); n++; } catch (e) { say("could not keep " + nm + ": " + e.message); }
          }
          paint(); say(`${n} brush${n === 1 ? "" : "es"} from ${f.name}`);
        };
        inp.style.display = "none"; doc.body.appendChild(inp); inp.addEventListener("change", () => setTimeout(() => inp.remove(), 0)); inp.click();
      };
    }
    loadUser();
    if (E.ui && E.ui.addCmd) E.ui.addCmd("win.pcBrush", "Brush Settings", "", () => E.ui.showTab("pcBrush"), {}, ["Window", "win.pcAdjs"]);
    E.brushDyn = { paint, loadUser, parseAbr, ORIG };
  }

  const api = { DYN_DEFAULT, active, dynAt, jitterColor, textureValue, parseAbr, toB64, dab, install, rgb2hsv, hsv2rgb };
  if (isNode) module.exports = api;
  else root.IEBrushDyn = api;
})(typeof window !== "undefined" ? window : globalThis);
