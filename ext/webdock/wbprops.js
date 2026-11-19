/* bitGen Studio — ext/webdock/wbprops.js (2.867.0): 🎛 the element properties docker (Tim: "a docker for element properties (css styles,
 * include raidius for each corner, shadows, opacity, bacground, background gradient etc.)").
 *   pick       a click on the ✎ WYSIWYG page picks that element (a dashed outline, never saved); ⬆ its parent; Esc lets go.
 *   the docker a column between the page and the files (◂ / ▸ folds it, localStorage wb.props): the tag, id and classes; Size (width,
 *              height, max width), Spacing (margin, padding), Corners (top-left, top-right, bottom-right, bottom-left - 🔗 all four together),
 *              Border (width, style, colour), Background (colour, picture, ☐ gradient: linear / radial, angle, two colours + where they
 *              stop), Shadow (x, y, blur, spread, colour, see-through, inset) + text shadow, Opacity, Text (colour, size, weight, line height,
 *              letter spacing, align, font) and Display. Every change goes into the element's style="" at once (one page change,
 *              💾 Save keeps it); ✕ Clear styles takes its own styles off.
 * window.WbProps = {pick, apply, …} - the pure helpers (colours, shadows, gradients) work in Node (tests). */
(function (root) {
  "use strict";
  const hex2 = (n) => Math.max(0, Math.min(255, Math.round(+n || 0))).toString(16).padStart(2, "0");
  /** "rgb(1, 2, 3)" / "rgba(1,2,3,.5)" / "#abc" -> {hex "#rrggbb", a 0-1} */
  function color(s) {
    s = String(s || "").trim();
    let m = /^#([0-9a-f]{3})$/i.exec(s); if (m) return { hex: "#" + m[1].split("").map((c) => c + c).join("").toLowerCase(), a: 1 };
    m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s); if (m) return { hex: "#" + m[1].toLowerCase(), a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
    m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(s);
    if (m) { let a = m[4] == null ? 1 : /%$/.test(m[4]) ? parseFloat(m[4]) / 100 : +m[4]; return { hex: "#" + hex2(m[1]) + hex2(m[2]) + hex2(m[3]), a }; }
    if (s === "transparent") return { hex: "#000000", a: 0 };
    return { hex: "#000000", a: 1 };
  }
  /** {hex, a} -> "#rrggbb" or "rgba(r, g, b, a)" */
  function rgba(hex, a) {
    const h = color(hex).hex, A = a == null ? 1 : Math.max(0, Math.min(1, +a));
    if (A >= 1) return h;
    return `rgba(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)}, ${Math.round(A * 100) / 100})`;
  }
  /** the first box-shadow of a computed value -> {x, y, blur, spread, hex, a, inset} (null = none) */
  function shadow(s) {
    s = String(s || "").trim(); if (!s || s === "none") return null;
    const first = s.split(/,(?![^(]*\))/)[0].trim(), col = /(rgba?\([^)]*\)|#[0-9a-f]{3,8})/i.exec(first), c = color(col ? col[1] : "#000");
    const nums = first.replace(col ? col[1] : "", "").replace("inset", "").trim().split(/\s+/).filter(Boolean).map((x) => parseFloat(x) || 0);
    return { x: nums[0] || 0, y: nums[1] || 0, blur: nums[2] || 0, spread: nums[3] || 0, hex: c.hex, a: c.a, inset: /\binset\b/.test(first) };
  }
  const px = (n) => (Math.round((+n || 0) * 10) / 10) + "px";
  function shadowCss(o) { return !o ? "none" : `${o.inset ? "inset " : ""}${px(o.x)} ${px(o.y)} ${px(o.blur)} ${px(o.spread)} ${rgba(o.hex, o.a)}`; }
  function textShadowCss(o) { return !o ? "none" : `${px(o.x)} ${px(o.y)} ${px(o.blur)} ${rgba(o.hex, o.a)}`; }
  /** a gradient -> CSS: {type linear|radial, angle, c1, a1, s1 %, c2, a2, s2 %} */
  function gradientCss(g) {
    const stops = `${rgba(g.c1, g.a1)} ${Math.round(+g.s1 || 0)}%, ${rgba(g.c2, g.a2)} ${Math.round(g.s2 == null ? 100 : +g.s2)}%`;
    return g.type === "radial" ? `radial-gradient(circle, ${stops})` : `linear-gradient(${Math.round(+g.angle || 0)}deg, ${stops})`;
  }
  /** a background-image value -> the gradient (or null): linear-gradient(90deg, c1 0%, c2 100%) / radial-gradient(…) */
  function gradient(s) {
    const m = /^(linear|radial)-gradient\((.*)\)$/i.exec(String(s || "").trim()); if (!m) return null;
    const parts = m[2].split(/,(?![^(]*\))/).map((x) => x.trim());
    let angle = 180; if (/^-?[\d.]+deg$/.test(parts[0])) angle = parseFloat(parts.shift()); else if (/^to /.test(parts[0])) { angle = { "to top": 0, "to right": 90, "to bottom": 180, "to left": 270 }[parts.shift()] || 180; } else if (m[1] === "radial" && !/^(rgb|#)/i.test(parts[0])) parts.shift();
    const stop = (p, d) => { const c = /(rgba?\([^)]*\)|#[0-9a-f]{3,8})/i.exec(p), q = /([\d.]+)%/.exec(p.replace(c ? c[1] : "", "")); const C = color(c ? c[1] : "#000"); return { hex: C.hex, a: C.a, s: q ? +q[1] : d }; };
    const a = stop(parts[0] || "", 0), b = stop(parts[parts.length - 1] || "", 100);
    return { type: m[1].toLowerCase(), angle, c1: a.hex, a1: a.a, s1: a.s, c2: b.hex, a2: b.a, s2: b.s };
  }
  const pure = { color, rgba, shadow, shadowCss, textShadowCss, gradient, gradientCss };
  if (typeof module !== "undefined" && module.exports && typeof window === "undefined") { module.exports = pure; return; }

  /* ---------------- the page */
  const doc = root.document, $ = (id) => doc.getElementById(id), W = () => root.H3Web;
  let el = null, painting = false;
  const frame = () => $("wbWys"), fdoc = () => { const f = frame(); return f && f.contentDocument; };
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.round(n * 10) / 10 : ""; };
  const F = (id) => $("wbP_" + id);
  const SEC = (t, body) => `<details open><summary>${t}</summary><div class="wbpg">${body}</div></details>`;
  const IN = (id, label, type, extra) => `<label><span>${label}</span><input id="wbP_${id}" type="${type || "text"}" ${extra || ""}></label>`;
  const SEL = (id, label, opts) => `<label><span>${label}</span><select id="wbP_${id}">${opts.map((o) => `<option value="${o}">${o || "-"}</option>`).join("")}</select></label>`;
  function html() {
    return `<div class="wbbar" id="wbPropsHead"><b>🎛 Properties</b><button class="ghost" type="button" id="wbPropsUp" title="Pick the parent element">⬆</button><button class="ghost" type="button" id="wbPropsClear" title="Take this element's own styles off">✕ Clear styles</button><button class="ghost" type="button" id="wbPropsFold" title="Fold the properties">▸</button></div>
<div id="wbPropsWhat">Click something on the ✎ WYSIWYG page to style it.</div>
<div id="wbPropsBody">
${SEC("Element", IN("id", "id") + IN("cls", "Classes"))}
${SEC("Size", IN("width", "Width", "text", 'placeholder="auto, 300px, 50%"') + IN("height", "Height", "text", 'placeholder="auto"') + IN("maxw", "Max width", "text", 'placeholder="none"') + SEL("display", "Display", ["", "block", "inline-block", "flex", "grid", "none"]))}
${SEC("Spacing", IN("margin", "Margin", "text", 'placeholder="0 auto, 10px 20px"') + IN("padding", "Padding", "text", 'placeholder="16px"'))}
${SEC("Corners", '<label><span>🔗 All four</span><input id="wbP_rlink" type="checkbox" checked></label>' + IN("rtl", "↖ Top left", "number", 'min="0" step="1"') + IN("rtr", "↗ Top right", "number", 'min="0" step="1"') + IN("rbr", "↘ Bottom right", "number", 'min="0" step="1"') + IN("rbl", "↙ Bottom left", "number", 'min="0" step="1"'))}
${SEC("Border", IN("bw", "Width", "number", 'min="0" step="1"') + SEL("bs", "Style", ["none", "solid", "dashed", "dotted", "double"]) + IN("bc", "Colour", "color"))}
${SEC("Background", IN("bg", "Colour", "color") + IN("bga", "See-through", "range", 'min="0" max="1" step="0.05"') + IN("bgimg", "Picture", "text", 'placeholder="images/photo.jpg"')
  + '<label><span>Gradient</span><input id="wbP_grad" type="checkbox"></label>' + SEL("gtype", "Kind", ["linear", "radial"]) + IN("gang", "Angle", "range", 'min="0" max="360" step="5"')
  + IN("gc1", "From", "color") + IN("gs1", "From at %", "range", 'min="0" max="100" step="1"') + IN("gc2", "To", "color") + IN("gs2", "To at %", "range", 'min="0" max="100" step="1"'))}
${SEC("Shadow", '<label><span>Shadow</span><input id="wbP_sh" type="checkbox"></label>' + IN("shx", "Across", "number", 'step="1"') + IN("shy", "Down", "number", 'step="1"') + IN("shb", "Blur", "number", 'min="0" step="1"') + IN("shs", "Spread", "number", 'step="1"') + IN("shc", "Colour", "color") + IN("sha", "See-through", "range", 'min="0" max="1" step="0.05"') + '<label><span>Inset</span><input id="wbP_shi" type="checkbox"></label>'
  + '<label><span>Text shadow</span><input id="wbP_tsh" type="checkbox"></label>')}
${SEC("Opacity", IN("op", "Opacity", "range", 'min="0" max="1" step="0.05"'))}
${SEC("Text", IN("tc", "Colour", "color") + IN("fs", "Size", "number", 'min="1" step="1"') + SEL("fw", "Weight", ["", "300", "400", "500", "600", "700", "800"]) + IN("lh", "Line height", "text", 'placeholder="1.5"') + IN("ls", "Letter spacing", "number", 'step="0.5"') + SEL("ta", "Align", ["", "left", "center", "right", "justify"]) + IN("ff", "Font", "text", 'placeholder="Georgia, serif"'))}
</div>`;
  }
  /** the element's values into the fields */
  function paint() {
    const what = $("wbPropsWhat"), body = $("wbPropsBody"); if (!what) return;
    if (!el || !el.isConnected) { el = null; what.textContent = "Click something on the ✎ WYSIWYG page to style it."; body.classList.add("off"); return; }
    painting = true; body.classList.remove("off");
    const cs = el.ownerDocument.defaultView.getComputedStyle(el), st = el.style;
    what.textContent = "<" + el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : "") + ">";
    F("id").value = el.id || ""; F("cls").value = (el.getAttribute("class") || "");
    F("width").value = st.width; F("height").value = st.height; F("maxw").value = st.maxWidth; F("display").value = st.display || "";
    F("margin").value = st.margin; F("padding").value = st.padding;
    F("rtl").value = num(cs.borderTopLeftRadius); F("rtr").value = num(cs.borderTopRightRadius); F("rbr").value = num(cs.borderBottomRightRadius); F("rbl").value = num(cs.borderBottomLeftRadius);
    F("rlink").checked = F("rtl").value === F("rtr").value && F("rtr").value === F("rbr").value && F("rbr").value === F("rbl").value;
    F("bw").value = num(cs.borderTopWidth); F("bs").value = cs.borderTopStyle || "none"; F("bc").value = color(cs.borderTopColor).hex;
    const bgc = color(cs.backgroundColor); F("bg").value = bgc.hex; F("bga").value = bgc.a;
    const g = gradient(cs.backgroundImage); F("grad").checked = !!g;
    const gg = g || { type: "linear", angle: 135, c1: "#4f7cff", s1: 0, c2: "#a855f7", s2: 100 };
    F("gtype").value = gg.type; F("gang").value = gg.angle; F("gc1").value = gg.c1; F("gs1").value = gg.s1; F("gc2").value = gg.c2; F("gs2").value = gg.s2;
    const bim = /url\(["']?([^"')]+)["']?\)/.exec(st.backgroundImage || ""); F("bgimg").value = bim ? bim[1] : "";
    const sh = shadow(cs.boxShadow), s0 = sh || { x: 0, y: 6, blur: 18, spread: 0, hex: "#000000", a: 0.25, inset: false };
    F("sh").checked = !!sh; F("shx").value = s0.x; F("shy").value = s0.y; F("shb").value = s0.blur; F("shs").value = s0.spread; F("shc").value = s0.hex; F("sha").value = s0.a; F("shi").checked = s0.inset;
    F("tsh").checked = cs.textShadow && cs.textShadow !== "none";
    F("op").value = cs.opacity;
    F("tc").value = color(cs.color).hex; F("fs").value = num(cs.fontSize); F("fw").value = st.fontWeight || ""; F("lh").value = st.lineHeight; F("ls").value = st.letterSpacing ? num(st.letterSpacing) : ""; F("ta").value = st.textAlign || ""; F("ff").value = st.fontFamily;
    painting = false;
  }
  const set = (p, v) => { if (v === "" || v == null) el.style.removeProperty(p); else el.style.setProperty(p, v); };
  /** one field changed -> the element's style="" (only that part) */
  function apply(id) {
    if (!el || painting) return;
    const v = (k) => F(k).value, n = (k) => (v(k) === "" ? "" : v(k) + "px");
    switch (id) {
      case "id": if (v("id").trim()) el.id = v("id").trim().replace(/\s+/g, "-"); else el.removeAttribute("id"); break;
      case "cls": if (v("cls").trim()) el.setAttribute("class", v("cls").trim()); else el.removeAttribute("class"); break;
      case "width": set("width", v("width")); break; case "height": set("height", v("height")); break; case "maxw": set("max-width", v("maxw")); break; case "display": set("display", v("display")); break;
      case "margin": set("margin", v("margin")); break; case "padding": set("padding", v("padding")); break;
      case "rtl": case "rtr": case "rbr": case "rbl": case "rlink": {
        if (F("rlink").checked) { const x = id === "rlink" ? v("rtl") : v(id); ["rtl", "rtr", "rbr", "rbl"].forEach((k) => { F(k).value = x; }); }
        set("border-top-left-radius", n("rtl")); set("border-top-right-radius", n("rtr")); set("border-bottom-right-radius", n("rbr")); set("border-bottom-left-radius", n("rbl")); break;
      }
      case "bw": case "bs": case "bc": set("border", `${v("bw") || 0}px ${v("bs")} ${v("bc")}`); break;
      case "bg": case "bga": set("background-color", rgba(v("bg"), v("bga"))); break;
      case "bgimg": case "grad": case "gtype": case "gang": case "gc1": case "gs1": case "gc2": case "gs2": {
        const layers = [];
        if (F("grad").checked) layers.push(gradientCss({ type: v("gtype"), angle: v("gang"), c1: v("gc1"), s1: v("gs1"), c2: v("gc2"), s2: v("gs2") }));
        if (v("bgimg").trim()) layers.push(`url("${v("bgimg").trim().replace(/["\\]/g, "")}")`);
        set("background-image", layers.join(", "));
        if (v("bgimg").trim()) { el.style.backgroundSize = el.style.backgroundSize || "cover"; el.style.backgroundPosition = el.style.backgroundPosition || "center"; }
        break;
      }
      case "sh": case "shx": case "shy": case "shb": case "shs": case "shc": case "sha": case "shi": case "tsh": {
        const o = { x: v("shx"), y: v("shy"), blur: v("shb"), spread: v("shs"), hex: v("shc"), a: v("sha"), inset: F("shi").checked };
        set("box-shadow", F("sh").checked ? shadowCss(o) : ""); set("text-shadow", F("tsh").checked ? textShadowCss(Object.assign({}, o, { blur: Math.max(1, +o.blur / 3), y: Math.max(1, +o.y / 3), x: +o.x / 3 })) : "");
        break;
      }
      case "op": set("opacity", +v("op") >= 1 ? "" : v("op")); break;
      case "tc": set("color", v("tc")); break; case "fs": set("font-size", n("fs")); break; case "fw": set("font-weight", v("fw")); break;
      case "lh": set("line-height", v("lh")); break; case "ls": set("letter-spacing", n("ls")); break; case "ta": set("text-align", v("ta")); break; case "ff": set("font-family", v("ff")); break;
    }
    if (!el.getAttribute("style")) el.removeAttribute("style");
    W().markWys(); $("wbPropsWhat").classList.add("changed");
  }
  /** pick an element of the WYSIWYG page */
  function pick(e2) {
    const d = fdoc(); if (!d) return;
    d.querySelectorAll("[data-bg-picked]").forEach((x) => x.removeAttribute("data-bg-picked"));
    el = e2 && e2 !== d.body && e2 !== d.documentElement && e2.nodeType === 1 ? e2 : null;
    if (el) el.setAttribute("data-bg-picked", "");
    $("wbPropsWhat").classList.remove("changed"); paint();
    if (el) fold(true);
  }
  function hook() {
    const d = fdoc(); if (!d || d.__wbProps) return; d.__wbProps = true;
    const s = d.createElement("style"); s.textContent = "[data-bg-picked] { outline: 2px dashed #ff7a1a !important; outline-offset: 2px; }"; (d.head || d.documentElement).appendChild(s);
    d.addEventListener("click", (e) => pick(e.target));
    d.addEventListener("keydown", (e) => { if (e.key === "Escape") pick(null); });
    el = null; paint();
  }
  function fold(open) { const p = $("wbProps"); if (!p) return; p.classList.toggle("shut", !open); $("wbPropsFold").textContent = open ? "▸" : "◂"; try { root.localStorage.setItem("wb.props", open ? "1" : "0"); } catch (e) { /* fine */ } }
  function build() {
    const files = $("wbFiles"), f = frame(); if (!files || !f) return false; if ($("wbProps")) return true;
    const p = doc.createElement("div"); p.id = "wbProps"; p.innerHTML = html(); files.parentNode.insertBefore(p, files);
    p.addEventListener("input", (e) => { const id = (e.target.id || "").replace(/^wbP_/, ""); if (id) apply(id); });
    p.addEventListener("change", (e) => { const id = (e.target.id || "").replace(/^wbP_/, ""); if (id && (e.target.type === "checkbox" || e.target.tagName === "SELECT")) apply(id); });
    p.addEventListener("keydown", (e) => e.stopPropagation());
    $("wbPropsUp").addEventListener("click", () => { if (el && el.parentElement) pick(el.parentElement); });
    $("wbPropsClear").addEventListener("click", () => { if (!el) return; el.removeAttribute("style"); W().markWys(); paint(); });
    $("wbPropsFold").addEventListener("click", () => fold(p.classList.contains("shut")));
    f.addEventListener("load", hook); hook();
    // shown on the WYSIWYG tab only
    const show = () => { const st = W() && W().state(); p.style.display = st && st.tab === "wys" ? "" : "none"; };
    new root.MutationObserver(show).observe($("webdock"), { attributes: true, subtree: true, attributeFilter: ["class"] }); show();
    let open = "1"; try { open = root.localStorage.getItem("wb.props") || "1"; } catch (e) { /* fine */ } fold(open === "1");
    return true;
  }
  function start() { if (!build()) setTimeout(start, 400); }
  root.WbProps = Object.assign({ pick, apply, paint, fold, picked: () => el }, pure);
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
