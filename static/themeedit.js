/* bitGen Studio — EDIT THEME MODE: STYLE ANY ELEMENT ON SCREEN (2.443.0), window.H3ThemeEdit.
 *
 * Tim (verbatim): "Add each element to themes to be styled - each button's can be edited including icons, icon position,
 * icon size, icon fill, text size, font, text shadow, button shadow." - and, asked how: "use number 1 , but go into edit
 * theme mode when the style a button button is toggled so user can style any element including buttons interactively.
 * when it is toggled again app will go into live mode. the edit theme mode will interact with the visible elements on
 * screen".
 *
 *   🖌 (the top bar, next to ⚙ - and Settings ▸ Themes ▸ 🖌 Edit theme mode) toggles EDIT THEME MODE: the element under
 *   the pointer is outlined, a click picks it (the app does not get that click) and the Style panel opens next to it:
 *     Apply to    this element (#id) / all like it (tag.classes) / all like it in this panel (#panel tag.classes) /
 *                 every <tag> - with how many match now
 *     Text        font, size, weight, colour, text shadow (x, y, blur, colour)
 *     Box         background, border colour, corner radius, button shadow (x, y, blur, spread, colour, inset)
 *     Icon        a new icon (text / emoji, or a picture - png / svg / jpeg / webp / gif up to 60 KB), its position
 *                 (left / right / top / bottom / icon only / hidden), size, fill (an emoji is tinted too)
 *   ⬆ picks the element around it; ↺ clears the rule; the panel's title bar drags it. 🖌 again (or Esc) = LIVE mode:
 *   the styles stay, clicks work again. Nothing is changed in the app's own files - each rule is a CSS rule made here.
 *
 *   KEPT       in this browser (h3.themeStyles) and put on the page before it paints (this file loads in <head>);
 *              💾 Save theme writes them into themes/<name>.json (`styles`, cleaned by lib/themeStore.js with
 *              cleanStyles below); a saved theme / an imported .json brings its own. Settings ▸ Themes lists the
 *              rules (✕ each, ↺ Clear element styles).
 *   ICONS      a button's leading icon (the symbols / emoji before its words: "💾 Save" -> 💾 + "Save") is wrapped as
 *              <span class="h3ic"> + <span class="h3lb"> on the elements an icon rule matches (watched: a button the
 *              app re-writes is wrapped again; its textContent stays what it was), so CSS can move / size / tint /
 *              replace it.
 *
 *   DIALOGS    (2.455.0 - Tim: "dialogs don't get edited in theme edit mode - when i try to select an icon and the dialogs
 *              open they are non functional and editable- they should work properly") - every dialog, popup menu and
 *              the file dialog (the Style panel's own "a picture as the icon" opens it) WORK NORMALLY while the mode is
 *              on: no outline over them, their clicks / keys reach them, they are never picked (DIALOG_SEL).
 *
 *   2.514.0 (Tim: "when in edit mode allow user to hide the element and to change the text. allow user to resize
 *   elements height x width. add handles to the selected element so the user can resize interactively. when user
 *   exits [edit mode] offer msgbox to save theme, save theme as, reset theme. when working on theme use theme
 *   name.tmp" - and, asked, "Resize + move"):
 *     Layout     ☐ hide (gone in live mode; in edit mode it shows faint and dashed so it can be picked again), its
 *                text (a plain-text element's words replaced - its icon kept), width / height (px; empty = its own),
 *                moved x / y (px, `translate` - the layout around it does not shift)
 *                2.544.0 (Tim: "in theme edit mode, add a checkbox for visibility in expert mode to the properties
 *                dialog. this will change the visibility of the element in expert mode but not in basic mode"): ☐ hidden
 *                in Expert mode (xhide) - gone while Settings ▸ Expert mode is on (html.expert), shown in Basic mode;
 *                in edit mode (Expert on) faint with a blue dashed outline so it can be picked again
 *     HANDLES    the picked element has 8 handles: drag one = its width / height (the left / top ones keep the
 *                opposite edge where it is); drag the element itself = move it (a click without moving still picks)
 *     LEAVING    🖌 / Esc with changes since edit mode began: a box - 💾 Save theme (themes/<name>.json), Save theme
 *                as…, ↺ Reset theme (back to how it was when edit mode began), Not now (leave with the changes
 *                showing, unsaved - the .tmp keeps them), Cancel (stay in edit mode)
 *     WORKING    every change is written to themes/<name>.tmp while edit mode is on (lib/themeStore saveTmp); the
 *                save / reset removes it; a .tmp left by a crash is offered back the next time edit mode begins
 *
 *   2.515.0 (Tim: "when user presses ctrl+shift+alt+e go into edit mode, ctrl+s saves the theme and exits edit mode -
 *   this is so users can edit dialogs like the settings dialog"):
 *     Ctrl+Shift+Alt+E  edit theme mode WITH THE DIALOGS: an open dialog (Settings, the image editor's boxes, a popup
 *                       menu …) stays open and its parts are picked / styled / resized like the rest (the Style panel,
 *                       the outline and the handles go inside the dialog so they work over it). Again = leave (the
 *                       leaving box when there are changes). Esc in this mode never closes the dialog.
 *     Ctrl+S            while edit mode is on (either way in): 💾 save the theme (themes/<name>.json; a theme with no
 *                       name yet asks for one) and leave edit mode - the app's own Ctrl+S does not run
 *     The file dialog the Style panel opens (🖼 a picture as the icon) still works as a dialog.
 *
 *   2.567.0 (Tim: "in theme editor add alignment options for text" / "add padding and margins for selected objects and
 *   text, and rounded corners for objects"):
 *     Text ▸ Align   ⇤ ↔ ⇥ ☰ (left / centre / right / justified) and ⤒ ↕ ⤓ (top / middle / bottom) - text-align and
 *                    align-content; a flex box / grid / button is marked data-h3al (applyAlign: alignKind) and gets
 *                    justify-content / align-items for its own direction (a button is made a flex box only for top /
 *                    bottom - its words sit in the middle otherwise)
 *     Text ▸ Padding / Margin   the words' own space (T R B L; plain-text elements - the words are wrapped in .h3lb)
 *     Box ▸ Corners  each corner's radius (↖ ↗ ↘ ↙ - over Radius); Box ▸ Padding / Margin (T R B L); = copies the
 *                    first value to all four. Padding / margins are never put on the page itself (html / body)
 * Pure (Node: scripts/test-themeedit.js; lib/themeStore.js uses cleanStyles): cleanSel, cleanRule, cleanStyles,
 * cssStr, compile, splitIcon, selectorsFor, ICON_POS, DYNAMIC, DIALOG_SEL, resizeBy.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const ICON_POS = ["left", "right", "top", "bottom", "only", "hide"];
  const ALIGN = ["left", "center", "right", "justify"], VALIGN = ["top", "middle", "bottom"];   // 2.567.0
  const SIDES = ["t", "r", "b", "l"], CORNERS = ["tl", "tr", "br", "bl"];
  /** 2.455.0: what theme edit mode leaves alone - dialogs (<dialog>, any *dlg box: the editor's, the file dialog,
   *  Liquify …, role=dialog except the floating dockers), popup menus */
  const DIALOG_SEL = 'dialog[open], [class*="dlg"], [role="dialog"]:not(.h3fp), [role="alertdialog"], .kxmenu, .h3fp-menu, .fd-menu, .m3dmenu, .agmenu, [role="menu"], [role="listbox"]';
  const DYNAMIC = new Set(["on", "off", "hover", "active", "sel", "pick", "drop-in", "drop-top", "drop-bottom", "chg", "open", "focus", "disabled", "busy", "lit", "h3icon", "collapsed", "dockgone", "dragging", "thedit-hi"]);
  const MAX_RULES = 300, MAX_IMG = 60000;
  const isHex = (c) => typeof c === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(c);
  const num = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n * 10) / 10)) : null; };
  /** a selector this module will write: one compound chain, no braces / at-rules / comments / lists */
  function cleanSel(s) {
    const t = String(s == null ? "" : s).trim();
    if (!t || t.length > 200) return "";
    if (/[{}<>;@\\/,`]|\/\*|\*\//.test(t)) return "";
    if (!/^[A-Za-z0-9_\-#.:>+~ \[\]="'()*]+$/.test(t)) return "";
    if ((t.match(/\[/g) || []).length !== (t.match(/\]/g) || []).length || (t.match(/\(/g) || []).length !== (t.match(/\)/g) || []).length) return "";
    if ((t.match(/"/g) || []).length % 2 || (t.match(/'/g) || []).length % 2) return "";
    return t.replace(/\s+/g, " ");
  }
  const cleanFont = (f) => { const t = String(f == null ? "" : f).trim(); return t && t.length <= 80 && /^[A-Za-z0-9 ,'"\-]+$/.test(t) && (t.match(/"/g) || []).length % 2 === 0 && (t.match(/'/g) || []).length % 2 === 0 ? t : ""; };
  const cleanImg = (u) => (typeof u === "string" && u.length <= MAX_IMG && /^data:image\/(?:png|svg\+xml|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(u) ? u : "");
  function cleanShadow(o, box) {
    if (!o || typeof o !== "object" || o.on === false) return null;
    const r = { x: num(o.x, -50, 50) || 0, y: num(o.y, -50, 50) || 0, b: num(o.b, 0, 100) || 0, c: isHex(o.c) ? o.c.toLowerCase() : "#000000" };
    if (box) { r.s = num(o.s, -50, 50) || 0; if (o.inset) r.inset = true; }
    return r;
  }
  /** a rule's settings, every value checked (anything else dropped) */
  function cleanRule(r) {
    const o = r && typeof r === "object" ? r : {}, out = {};
    const f = cleanFont(o.font); if (f) out.font = f;
    const sz = num(o.size, 6, 96); if (sz != null && o.size !== "" && o.size != null) out.size = sz;
    const w = num(o.weight, 100, 900); if (w != null && o.weight !== "" && o.weight != null) out.weight = Math.round(w / 100) * 100;
    for (const k of ["color", "border"]) if (isHex(o[k])) out[k] = o[k].toLowerCase();
    if (isHex(o.bg)) out.bg = o.bg.toLowerCase(); else if (o.bg === "transparent") out.bg = "transparent";
    const rd = num(o.radius, 0, 200); if (rd != null && o.radius !== "" && o.radius != null) out.radius = rd;
    const ts = cleanShadow(o.tshadow, false); if (ts) out.tshadow = ts;
    const bs = cleanShadow(o.bshadow, true); if (bs) out.bshadow = bs;
    if (o.icon && typeof o.icon === "object") {
      const i = o.icon, ic = {};
      const txt = typeof i.text === "string" ? Array.from(i.text.replace(/[\r\n\t]/g, "")).slice(0, 8).join("") : "";
      if (txt) ic.text = txt;
      const img = cleanImg(i.img); if (img) ic.img = img;
      if (ICON_POS.includes(i.pos)) ic.pos = i.pos;
      const isz = num(i.size, 6, 96); if (isz != null && i.size !== "" && i.size != null) ic.size = isz;
      if (isHex(i.fill)) ic.fill = i.fill.toLowerCase();
      if (Object.keys(ic).length) out.icon = ic;
    }
    // 2.514.0: layout - hide, its words, its size, moved
    if (o.hide === true) out.hide = true;
    if (o.xhide === true) out.xhide = true;                         // 2.544.0: hidden only in Expert mode
    if (typeof o.text === "string") { const t = o.text.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 200); if (t.trim()) out.text = t; }
    for (const k of ["w", "h"]) { const v = num(o[k], 4, 4000); if (v != null && o[k] !== "" && o[k] != null) out[k] = Math.round(v); }
    for (const k of ["dx", "dy"]) { const v = num(o[k], -4000, 4000); if (v != null && o[k] !== "" && o[k] != null && Math.round(v) !== 0) out[k] = Math.round(v); }
    // 2.567.0: text alignment, padding / margins (the element's and its words'), rounded corners one by one
    if (ALIGN.includes(o.align)) out.align = o.align;
    if (VALIGN.includes(o.valign)) out.valign = o.valign;
    for (const [k, lo, hi] of [["pad", 0, 400], ["mar", -400, 400], ["tpad", 0, 200], ["tmar", -200, 200]]) { const v = cleanSides(o[k], SIDES, lo, hi); if (v) out[k] = v; }
    const cn = cleanSides(o.corners, CORNERS, 0, 200); if (cn) out.corners = cn;
    return out;
  }
  /** 2.567.0: {t, r, b, l} (or {tl, tr, br, bl}) -> the sides given, whole px within lo..hi; none = null */
  function cleanSides(o, keys, lo, hi) {
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    const out = {};
    for (const k of keys) { if (o[k] === "" || o[k] == null) continue; const v = num(o[k], lo, hi); if (v != null) out[k] = Math.round(v); }
    return Object.keys(out).length ? out : null;
  }
  /** 2.567.0: how an element lines its contents up - its display / flex-direction / tag -> the kind its alignment CSS
   *  is written for: row / rowr / col / colr (flex), grid, btn / btnb (a button made a flex box so its words can sit at
   *  the top / bottom - only when a vertical alignment asks for it; it stays one while it does), "" (text-align and
   *  align-content are enough) */
  function alignKind(display, dir, tag, needV, was) {
    const d = String(display || ""), f = String(dir || "");
    if ((was === "btn" || was === "btnb") && needV) return was;
    if (/flex/.test(d)) return (/column/.test(f) ? "col" : "row") + (/reverse/.test(f) ? "r" : "");
    if (/grid/.test(d)) return "grid";
    if (needV && /^button$/i.test(String(tag || ""))) return /^inline/.test(d) ? "btn" : "btnb";
    return "";
  }
  /** 2.514.0: a handle dragged by (mx, my) from a box {w, h} moved {dx, dy} -> the new {w, h, dx, dy}; dir = n s e w ne nw se sw;
   *  the left / top handles keep the opposite edge where it was (min 4 px) */
  function resizeBy(dir, box, mx, my) {
    const o = { w: box.w, h: box.h, dx: box.dx || 0, dy: box.dy || 0 };
    if (/e/.test(dir)) o.w = Math.max(4, Math.round(box.w + mx));
    if (/w/.test(dir)) { o.w = Math.max(4, Math.round(box.w - mx)); o.dx = Math.round((box.dx || 0) + (box.w - o.w)); }
    if (/s/.test(dir)) o.h = Math.max(4, Math.round(box.h + my));
    if (/n/.test(dir)) { o.h = Math.max(4, Math.round(box.h - my)); o.dy = Math.round((box.dy || 0) + (box.h - o.h)); }
    return o;
  }
  /** {selector: rule} -> only the good ones (at most 300) */
  /** 2.540.6: the page itself (html / body / :root / *) - colours are fine, but never sized, moved or hidden.
   *  Tim: "when i try to edit the theme by dragging the handles the entire ui gets dragged to the left" */
  const isRootSel = (s) => /(?:^|[\s>+~])(?:html|body|:root|\*)(?:[.#:\[][^\s>+~]*)?$/i.test(String(s || "").trim());
  const LAYOUT_KEYS = ["w", "h", "dx", "dy", "hide", "xhide", "pad", "mar"];   // 2.567.0: + padding / margins
  function forSel(sel, r) { if (isRootSel(sel)) for (const k of LAYOUT_KEYS) delete r[k]; return r; }
  function cleanStyles(m) {
    const out = {}; if (!m || typeof m !== "object" || Array.isArray(m)) return out;
    let n = 0;
    for (const k of Object.keys(m)) {
      if (n >= MAX_RULES) break;
      const s = cleanSel(k); if (!s) continue;
      const r = forSel(s, cleanRule(m[k])); if (!Object.keys(r).length) continue;
      out[s] = r; n++;
    }
    return out;
  }
  /** a CSS string literal that can hold anything: every character but letters, digits and spaces escaped */
  function cssStr(t) {
    let o = '"';
    for (const ch of Array.from(String(t == null ? "" : t))) o += /[A-Za-z0-9 ]/.test(ch) ? ch : "\\" + ch.codePointAt(0).toString(16) + " ";
    return o + '"';
  }
  const shadowCss = (s, box) => `${box && s.inset ? "inset " : ""}${s.x}px ${s.y}px ${s.b}px ${box ? (s.s || 0) + "px " : ""}${s.c}`;
  const SIDE_CSS = { t: "top", r: "right", b: "bottom", l: "left" }, CORNER_CSS = { tl: "top-left", tr: "top-right", br: "bottom-right", bl: "bottom-left" };
  /** 2.567.0: the alignment for flex boxes / grids / buttons (data-h3al, set on the page by applyAlign - alignKind) -
   *  the attribute twice so it wins over an icon rule's centring */
  function alignCss(sel, H, V) {
    const fs = { left: "flex-start", center: "center", right: "flex-end", justify: "space-between" }, fsR = { left: "flex-end", center: "center", right: "flex-start", justify: "space-between" };
    const ai = { left: "flex-start", center: "center", right: "flex-end", justify: "stretch" }, gi = { left: "start", center: "center", right: "end", justify: "stretch" };
    const vf = { top: "flex-start", middle: "center", bottom: "flex-end" }, vfR = { top: "flex-end", middle: "center", bottom: "flex-start" };
    const row = [H && `justify-content:${fs[H]}`, V && `align-items:${vf[V]}`];
    const kinds = {
      row, rowr: [H && `justify-content:${fsR[H]}`, V && `align-items:${vf[V]}`],
      col: [H && `align-items:${ai[H]}`, V && `justify-content:${vf[V]}`], colr: [H && `align-items:${ai[H]}`, V && `justify-content:${vfR[V]}`],
      grid: [H && `justify-items:${gi[H]}`],
      btn: V ? ["display:inline-flex", ...row] : [], btnb: V ? ["display:flex", ...row] : [],
    };
    const out = [];
    for (const k of Object.keys(kinds)) { const d = kinds[k].filter(Boolean); if (d.length) out.push(`${sel}[data-h3al][data-h3al="${k}"]:not(#thEditPanel *){${d.map((x) => x + " !important").join(";")}}`); }
    return out;
  }
  /** the rules -> one stylesheet (each rule kept off the Style panel itself) */
  function compile(styles) {
    const S = cleanStyles(styles), out = [];
    for (const sel of Object.keys(S)) {
      const r = S[sel], at = `${sel}:not(#thEditPanel *)`, d = [];
      if (r.font) d.push(`font-family:${r.font}`);
      if (r.size != null) d.push(`font-size:${r.size}px`);
      if (r.weight != null) d.push(`font-weight:${r.weight}`);
      if (r.color) d.push(`color:${r.color}`);
      if (r.bg) d.push(`background:${r.bg}`);
      if (r.border) d.push(`border-color:${r.border}`);
      if (r.radius != null) d.push(`border-radius:${r.radius}px`);
      if (r.tshadow) d.push(`text-shadow:${shadowCss(r.tshadow, false)}`);
      if (r.bshadow) d.push(`box-shadow:${shadowCss(r.bshadow, true)}`);
      if (r.w != null) d.push(`width:${r.w}px`, `min-width:${r.w}px`, `max-width:${r.w}px`, "flex-grow:0", "flex-shrink:0", "box-sizing:border-box");   // 2.514.0
      if (r.h != null) d.push(`height:${r.h}px`, `min-height:${r.h}px`, `max-height:${r.h}px`, "box-sizing:border-box");
      if (r.dx || r.dy) d.push(`translate:${r.dx || 0}px ${r.dy || 0}px`);
      // 2.567.0: rounded corners one by one (over Radius), padding / margins, text alignment
      if (r.corners) for (const k of CORNERS) if (r.corners[k] != null) d.push(`border-${CORNER_CSS[k]}-radius:${r.corners[k]}px`);
      if (r.pad) for (const k of SIDES) if (r.pad[k] != null) d.push(`padding-${SIDE_CSS[k]}:${r.pad[k]}px`);
      if (r.mar) for (const k of SIDES) if (r.mar[k] != null) d.push(`margin-${SIDE_CSS[k]}:${r.mar[k]}px`);
      if (r.align) d.push(`text-align:${r.align}`);
      if (r.valign) d.push(`align-content:${{ top: "start", middle: "center", bottom: "end" }[r.valign]}`);
      if (d.length) out.push(`${at}{${d.map((x) => x + " !important").join(";")}}`);
      if (r.align || r.valign) out.push(...alignCss(sel, r.align, r.valign));
      if (r.tpad || r.tmar) {                                         // 2.567.0: the words' own space (plain-text elements: .h3lb)
        const t = ["display:inline-block"];
        if (r.tpad) for (const k of SIDES) if (r.tpad[k] != null) t.push(`padding-${SIDE_CSS[k]}:${r.tpad[k]}px`);
        if (r.tmar) for (const k of SIDES) if (r.tmar[k] != null) t.push(`margin-${SIDE_CSS[k]}:${r.tmar[k]}px`);
        out.push(`${at} > .h3lb{${t.map((x) => x + " !important").join(";")}}`);
      }
      if (r.hide) {                                                   // gone in live mode, faint in edit mode (so it can be picked)
        out.push(`body:not(.h3-thedit) ${at}{display:none !important}`);
        out.push(`body.h3-thedit ${at}{opacity:.35 !important;outline:1px dashed #ff3cac !important}`);
      }
      if (r.xhide && !r.hide) {                                       // 2.544.0: gone in Expert mode only (html.expert), Basic shows it
        out.push(`html.expert body:not(.h3-thedit) ${at}{display:none !important}`);
        out.push(`html.expert body.h3-thedit ${at}{opacity:.35 !important;outline:1px dashed #2680eb !important}`);
      }
      const ic = r.icon; if (!ic) continue;
      const dir = { left: "row", right: "row-reverse", top: "column", bottom: "column-reverse" }[ic.pos] || "row";
      out.push(`${at}.h3icon{display:inline-flex !important;align-items:center !important;justify-content:center !important;gap:.35em !important;flex-direction:${dir} !important}`);
      const icd = [];
      if (ic.pos === "hide") icd.push("display:none");
      if (ic.size != null) icd.push(`font-size:${ic.size}px`, "line-height:1");
      if (ic.fill) icd.push("color:transparent", `text-shadow:0 0 0 ${ic.fill}`);
      if (ic.text || ic.img) icd.push("font-size:0", "line-height:0");
      if (icd.length) out.push(`${at} > .h3ic{${icd.map((x) => x + " !important").join(";")}}`);
      if (ic.pos === "only") out.push(`${at} > .h3lb{display:none !important}`);
      const px = ic.size != null ? ic.size : 16;
      if (ic.img) {
        const u = `url("${ic.img}")`;
        out.push(`${at} > .h3ic::after{content:"";display:inline-block;width:${px}px;height:${px}px;vertical-align:middle;`
          + (ic.fill ? `background:${ic.fill};-webkit-mask:${u} center/contain no-repeat;mask:${u} center/contain no-repeat}` : `background:${u} center/contain no-repeat}`));
      } else if (ic.text) {
        out.push(`${at} > .h3ic::after{content:${cssStr(ic.text)};font-size:${px}px;line-height:1${ic.fill ? `;color:transparent;text-shadow:0 0 0 ${ic.fill}` : ""}}`);
      }
    }
    return out.join("\n");
  }
  /** a button's words -> its leading icon (symbols / emoji before the first letter or digit), the space after it, the rest */
  function splitIcon(text) {
    const t = String(text == null ? "" : text);
    const m = /^(\s*)([^\p{L}\p{N}\s]+)(\s*)([\s\S]*)$/u.exec(t);
    if (!m || !m[4] && !m[2]) return { lead: "", icon: "", gap: "", label: t };
    return { lead: m[1], icon: m[2], gap: m[3], label: m[4] };
  }
  const IDENT = /^[A-Za-z][A-Za-z0-9_-]*$/;
  /** the ways to aim a rule at an element: [{sel, label}] most narrow first. d = {tag, id, classes, panelId} */
  function selectorsFor(d) {
    const tag = String(d && d.tag || "div").toLowerCase().replace(/[^a-z0-9-]/g, "") || "div";
    const cls = ((d && d.classes) || []).filter((c) => IDENT.test(c) && !DYNAMIC.has(c) && !/^h3/.test(c)).slice(0, 4);
    const like = tag + cls.map((c) => "." + c).join("");
    const out = [];
    if (d && d.id && IDENT.test(d.id)) out.push({ sel: "#" + d.id, label: "This element (#" + d.id + ")" });
    if (d && d.panelId && IDENT.test(d.panelId) && d.panelId !== d.id) out.push({ sel: "#" + d.panelId + " " + like, label: `All like it in #${d.panelId} (${like})` });
    if (cls.length) out.push({ sel: like, label: `All like it (${like})` });
    out.push({ sel: tag, label: `Every <${tag}>` });
    const seen = new Set(); return out.filter((o) => (seen.has(o.sel) ? false : (seen.add(o.sel), true)));
  }

  /* ================================ the page ================================ */
  const get = (k, d) => { try { const v = root.localStorage.getItem("h3." + k); return v == null ? d : v; } catch (e) { return d; } };
  const put = (k, v) => { try { if (v == null || v === "") root.localStorage.removeItem("h3." + k); else root.localStorage.setItem("h3." + k, v); } catch (e) { /* private */ } };
  let styles = {};
  try { styles = cleanStyles(JSON.parse(get("themeStyles", "{}"))); } catch (e) { styles = {}; }
  let afterSet = null;                                   // 2.514.0: edit mode's working copy (themes/<name>.tmp)
  const doc = root.document || null;
  function sheet() {
    if (!doc) return null;
    let st = doc.getElementById("h3ThemeStyles");
    if (!st) { const h = doc.head || doc.documentElement; if (!h || !h.appendChild) return null; st = doc.createElement("style"); st.id = "h3ThemeStyles"; h.appendChild(st); }
    return st;
  }
  function applyCss() { const st = sheet(); if (st) st.textContent = compile(styles); }
  /* ---- icons: wrap the leading icon of what an icon rule aims at */
  const iconSels = () => Object.keys(styles).filter((s) => styles[s].icon || styles[s].text || styles[s].tpad || styles[s].tmar);   // 2.514.0: + a new text; 2.567.0: + the words' padding / margins
  const alignSels = () => Object.keys(styles).filter((s) => styles[s].align || styles[s].valign);       // 2.567.0
  function wrap(el, text) {
    if (!el || el.closest("#thEditPanel")) return;
    const kids = el.querySelector(":scope > .h3ic");
    if (el.classList.contains("h3icon") && kids) {                     // already wrapped: its words as the rules say now
      const lb = el.querySelector(":scope > .h3lb"), want = text != null ? text : splitIcon(el.dataset.h3orig || "").label;
      if (lb && lb.textContent !== want) lb.textContent = want;
      return;
    }
    if (el.children.length && !(el.children.length && [...el.children].every((c) => c.classList.contains("h3ic") || c.classList.contains("h3lb")))) return;   // only plain-text buttons
    const txt = el.textContent, sp = splitIcon(txt);
    el.dataset.h3orig = txt;
    el.textContent = "";
    const a = doc.createElement("span"); a.className = "h3ic"; a.textContent = sp.icon;
    const b = doc.createElement("span"); b.className = "h3lb"; b.textContent = text != null ? text : sp.label;
    if (sp.lead) el.appendChild(doc.createTextNode(sp.lead));
    el.appendChild(a); if (sp.gap) el.appendChild(doc.createTextNode(sp.gap)); el.appendChild(b);
    el.classList.add("h3icon");
  }
  function unwrap(el) { const t = el.dataset.h3orig; el.classList.remove("h3icon"); delete el.dataset.h3orig; if (t != null && el.querySelector(":scope > .h3ic")) el.textContent = t; }
  let wrapping = false;
  function applyIcons() {
    if (!doc || !doc.body) return;
    wrapping = true;
    try {
      const sels = iconSels(), hit = new Map();
      for (const s of sels) { let list = []; try { list = doc.querySelectorAll(s); } catch (e) { list = []; } for (const el of list) { if (!hit.has(el) || styles[s].text) hit.set(el, styles[s].text != null ? styles[s].text : hit.get(el)); } }
      for (const [el, text] of hit) wrap(el, text);
      for (const el of doc.querySelectorAll(".h3icon")) if (!hit.has(el)) unwrap(el);
      applyAlign();
    } finally { wrapping = false; }
  }
  /** 2.567.0: mark what an alignment rule aims at with how it lines its contents up (data-h3al - alignKind) */
  function applyAlign() {
    const hit = new Map();
    for (const s of alignSels()) { let list = []; try { list = doc.querySelectorAll(s); } catch (e) { list = []; } for (const el of list) if (!el.closest("#thEditPanel")) hit.set(el, hit.get(el) || !!styles[s].valign); }
    for (const el of doc.querySelectorAll("[data-h3al]")) if (!hit.has(el)) delete el.dataset.h3al;
    for (const [el, needV] of hit) {
      let cs = null; try { cs = root.getComputedStyle(el); } catch (e) { cs = null; }
      const k = alignKind(cs && cs.display, cs && cs.flexDirection, el.tagName, needV, el.dataset.h3al);
      if (k) { if (el.dataset.h3al !== k) el.dataset.h3al = k; } else if (el.dataset.h3al != null) delete el.dataset.h3al;
    }
  }
  let iconTimer = 0;
  const iconsSoon = () => { if (iconTimer) return; iconTimer = root.setTimeout(() => { iconTimer = 0; applyIcons(); }, 60); };
  function setStyles(m, quiet) {
    styles = cleanStyles(m);
    put("themeStyles", Object.keys(styles).length ? JSON.stringify(styles) : "");
    applyCss(); applyIcons(); paintList();
    if (afterSet) try { afterSet(); } catch (e) { /* the working copy is best effort */ }
    if (!quiet) try { root.dispatchEvent(new root.CustomEvent("h3themestyles", { detail: { rules: Object.keys(styles).length } })); } catch (e) { /* old */ }
    return styles;
  }
  function setRule(sel, rule) {
    const s = cleanSel(sel); if (!s) return null;
    const next = Object.assign({}, styles), r = forSel(s, cleanRule(rule));
    if (Object.keys(r).length) next[s] = r; else delete next[s];
    setStyles(next);
    return styles[s] || null;
  }
  try { applyCss(); } catch (e) { /* a document without a head yet (a test harness) */ }

  /* ---- EDIT THEME MODE */
  let on = false, picked = null, hi = null, panel = null, scope = "", dlgs = false;   // 2.515.0: dlgs = Ctrl+Shift+Alt+E (the dialogs are edited too)
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ours = (el) => !!(el && el.closest && (el.closest("#thEditPanel, #thEditHi, #thEditBtn, #s_thedit, #thEditHandles, #thExitBox")
    || (dlgs ? (panel && el.closest(".fdlg")) : el.closest(DIALOG_SEL))));   // 2.455.0: + dialogs / menus work as usual; 2.515.0: not with Ctrl+Shift+Alt+E (the panel's file dialog still works)
  /** 2.515.0: the topmost open MODAL dialog (what is not inside it cannot be clicked) */
  const topModal = () => { let m = null; try { m = [...doc.querySelectorAll("dialog[open]")].filter((d) => d.matches(":modal")).pop() || null; } catch (e) { m = null; } return m; };
  function hostOf(el) { const d = el && el.closest ? el.closest("dialog[open]") : null; return d || doc.body; }
  function ensureUi() {
    if (!doc.getElementById("thEditCss")) {
      const st = doc.createElement("style"); st.id = "thEditCss";
      st.textContent = "#thEditHi{position:fixed;z-index:2147483600;pointer-events:none;border:2px dashed #ff3cac;background:rgba(255,60,172,.08);border-radius:3px;display:none}"
        + "body.h3-thedit, body.h3-thedit *{cursor:crosshair}"
        + "#thEditPanel{position:fixed;z-index:2147483601;width:300px;max-height:80vh;overflow:auto;background:#1d1a15;color:#e8e2d6;border:1px solid #f59e2c;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.5);font:12px system-ui,sans-serif;cursor:default}"
        + "#thEditPanel *{cursor:default;box-sizing:border-box}#thEditPanel .th{display:flex;align-items:center;gap:6px;padding:6px 8px;background:#26221b;border-bottom:1px solid #3a342a;cursor:move;border-radius:8px 8px 0 0}"
        + "#thEditPanel .th b{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#thEditPanel .bd{padding:6px 8px;display:flex;flex-direction:column;gap:5px}"
        + "#thEditPanel .rw{display:flex;align-items:center;gap:5px;flex-wrap:wrap}#thEditPanel .rw>span:first-child{width:62px;color:#9a917f}#thEditPanel input[type=number]{width:52px}"
        + "#thEditPanel select,#thEditPanel input{background:#14120f;color:#e8e2d6;border:1px solid #3a342a;border-radius:4px;padding:2px 4px;font:inherit}#thEditPanel input[type=color]{width:30px;height:22px;padding:0}"
        + "#thEditPanel button{background:#26221b;color:#e8e2d6;border:1px solid #3a342a;border-radius:4px;padding:2px 7px;font:inherit}#thEditPanel button:hover{border-color:#f59e2c}"
        + "#thEditPanel input,#thEditPanel select{width:auto !important;min-width:0 !important;margin:0 !important;flex:none !important;height:auto}#thEditPanel input[type=number]{width:52px !important}"
        + "#thEditPanel input[type=color]{width:30px !important;height:22px !important}#thEditPanel #teScope,#thEditPanel #teFont{flex:1 1 0 !important}#thEditPanel input[type=checkbox]{width:auto !important}"
        + "#thEditPanel label{display:inline-flex;align-items:center;gap:2px;margin:0;font-size:12px;color:inherit;text-transform:none;letter-spacing:0;font-weight:400}"
        + "#thEditPanel input.sd{width:42px !important}#thEditPanel .seg{display:inline-flex;border:1px solid #3a342a;border-radius:4px;overflow:hidden}#thEditPanel .seg label{padding:1px 6px;min-width:22px;justify-content:center;border-left:1px solid #3a342a;cursor:pointer}#thEditPanel .seg label:first-child{border-left:0}#thEditPanel .seg label *{cursor:pointer}#thEditPanel .seg input{display:none}#thEditPanel .seg label:hover{background:#2e2920}#thEditPanel .seg label:has(input:checked){background:#f59e2c;color:#1d1a15}"
        + "#thEditPanel button.eq{padding:2px 5px}#thEditPanel input:disabled,#thEditPanel button:disabled{opacity:.45}"
        + "#thEditPanel h5{margin:4px 0 0;font-size:11px;color:#f59e2c;text-transform:uppercase;letter-spacing:.05em}#thEditPanel .hint{color:#9a917f}"
        + "#thEditHandles{position:fixed;left:0;top:0;width:0;height:0;z-index:2147483602;pointer-events:none}#thEditHandles .teh{position:fixed;width:9px;height:9px;margin:-5px 0 0 -5px;background:#fff;border:1.5px solid #ff3cac;border-radius:2px;pointer-events:auto;box-sizing:border-box}"
        + "#thEditHandles .teh[data-dir=n],#thEditHandles .teh[data-dir=s]{cursor:ns-resize}#thEditHandles .teh[data-dir=e],#thEditHandles .teh[data-dir=w]{cursor:ew-resize}#thEditHandles .teh[data-dir=ne],#thEditHandles .teh[data-dir=sw]{cursor:nesw-resize}#thEditHandles .teh[data-dir=nw],#thEditHandles .teh[data-dir=se]{cursor:nwse-resize}"
        + "body.h3-thedit.h3-thmove, body.h3-thedit.h3-thmove *{cursor:move !important}"
        + "#thExitBox{position:fixed;inset:0;z-index:2147483605;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);font:13px system-ui,sans-serif}#thExitBox *{cursor:default}"
        + "#thExitBox .tx{background:#1d1a15;color:#e8e2d6;border:1px solid #f59e2c;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.6);padding:14px 16px;width:min(440px,92vw)}#thExitBox h4{margin:0 0 6px;font-size:14px}#thExitBox p{margin:0 0 10px;color:#9a917f}"
        + "#thExitBox .rw{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px}#thExitBox button{background:#26221b;color:#e8e2d6;border:1px solid #3a342a;border-radius:5px;padding:5px 10px;font:inherit;cursor:pointer}#thExitBox button:hover{border-color:#f59e2c}#thExitBox button.pri{background:#f59e2c;color:#1d1a15;border-color:#f59e2c}#thExitBox input{background:#14120f;color:#e8e2d6;border:1px solid #3a342a;border-radius:4px;padding:4px 6px;font:inherit;flex:1}"
        + "#thEditBtn.on,#s_thedit.on{border-color:var(--tiger,#f59e2c) !important;color:var(--tiger,#f59e2c) !important;box-shadow:0 0 0 1px var(--tiger,#f59e2c) inset}";
      doc.head.appendChild(st);
    }
    if (!hi) { hi = doc.createElement("div"); hi.id = "thEditHi"; }
    if (!hdl) {
      hdl = doc.createElement("div"); hdl.id = "thEditHandles";
      for (const d of ["nw", "n", "ne", "e", "se", "s", "sw", "w"]) { const x = doc.createElement("div"); x.className = "teh"; x.dataset.dir = d; x.title = "Drag to size it"; hdl.appendChild(x); x.addEventListener("pointerdown", (e) => startResize(e, d)); }
    }
  }
  let hdl = null;
  function placeHi(el) {
    if (!hi) return;
    if (!el) { hi.style.display = "none"; if (hdl) hdl.style.display = "none"; return; }
    const h = hostOf(el); if (hi.parentNode !== h) h.appendChild(hi);
    const r = el.getBoundingClientRect();
    Object.assign(hi.style, { display: "block", left: r.left - 2 + "px", top: r.top - 2 + "px", width: r.width + 4 + "px", height: r.height + 4 + "px" });
    if (hdl && picked === el) {                       // 2.514.0: the picked element's 8 handles
      if (hdl.parentNode !== h) h.appendChild(hdl);
      hdl.style.display = "block";
      const P = { n: [r.left + r.width / 2, r.top], s: [r.left + r.width / 2, r.bottom], e: [r.right, r.top + r.height / 2], w: [r.left, r.top + r.height / 2],
        ne: [r.right, r.top], nw: [r.left, r.top], se: [r.right, r.bottom], sw: [r.left, r.bottom] };
      for (const x of hdl.children) { const p = P[x.dataset.dir]; x.style.left = p[0] + "px"; x.style.top = p[1] + "px"; }
    } else if (hdl && !picked) hdl.style.display = "none";
  }
  /** 2.514.0: the panel's size / move fields follow a drag */
  function syncLayout() {
    if (!panel) return; const r = styles[scope] || {}, q = (id) => panel.querySelector("#" + id);
    const set = (id, v) => { const x = q(id); if (x && doc.activeElement !== x) x.value = v == null ? "" : v; };
    set("teW", r.w); set("teH", r.h); set("teDx", r.dx || ""); set("teDy", r.dy || "");
  }
  function startResize(e, dir) {
    if (!picked || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const r0 = picked.getBoundingClientRect(), rule0 = ruleNow(), x0 = e.clientX, y0 = e.clientY;
    const box = { w: rule0.w != null ? rule0.w : Math.round(r0.width), h: rule0.h != null ? rule0.h : Math.round(r0.height), dx: rule0.dx || 0, dy: rule0.dy || 0 };
    swallowClick = false; let sized = false;
    const mv = (m) => {
      m.preventDefault(); sized = true;
      const o = resizeBy(dir, box, m.clientX - x0, m.clientY - y0), nx = Object.assign({}, rule0);
      if (/[ew]/.test(dir)) nx.w = o.w; if (/[ns]/.test(dir)) nx.h = o.h; nx.dx = o.dx; nx.dy = o.dy;
      setRule(scope, nx); placeHi(picked); syncLayout();
    };
    // 2.540.6: the click after a drag lands on what the press and the release share (often <html>) - it is not a pick
    const up = () => { root.removeEventListener("pointermove", mv, true); root.removeEventListener("pointerup", up, true); if (sized) swallowClick = true; sizing = null; unscroll(); };
    // 2.540.6: block() (registered first) stops a release that is not over the handle - it ends the drag through sizing,
    // so the size no longer follows the mouse after the button is let go
    sizing = up; try { e.target.setPointerCapture(e.pointerId); } catch (err) { /* old */ }
    root.addEventListener("pointermove", mv, true); root.addEventListener("pointerup", up, true);
  }
  /** 2.540.6: a drag never leaves the page scrolled sideways (the app is a fixed layout - nothing of it should scroll) */
  function unscroll() { for (const el of [doc.documentElement, doc.body]) if (el && (el.scrollLeft || el.scrollTop)) { el.scrollLeft = 0; el.scrollTop = 0; } }
  let moving = null, swallowClick = false, sizing = null;
  /** 2.514.0: press on the picked element and drag = move it (translate); a click without moving still picks */
  function startMove(e) {
    const rule0 = ruleNow(), x0 = e.clientX, y0 = e.clientY;
    moving = { moved: false };
    swallowClick = false;
    const mv = (m) => {
      const dx = m.clientX - x0, dy = m.clientY - y0;
      if (!moving.moved && Math.hypot(dx, dy) < 4) return;
      moving.moved = true; doc.body.classList.add("h3-thmove");
      setRule(scope, Object.assign({}, rule0, { dx: (rule0.dx || 0) + Math.round(dx), dy: (rule0.dy || 0) + Math.round(dy) })); placeHi(picked); syncLayout();
    };
    const up = () => { root.removeEventListener("pointermove", mv, true); root.removeEventListener("pointerup", up, true); doc.body.classList.remove("h3-thmove"); if (moving && moving.moved) swallowClick = true; moving = null; unscroll(); };
    moving.up = up;                                     // block() ends it too (it stops the pointerup before this listener)
    root.addEventListener("pointermove", mv, true); root.addEventListener("pointerup", up, true);
  }
  const descOf = (el) => {
    const panelEl = el.parentElement ? el.parentElement.closest("[id]") : null;
    return { tag: el.tagName, id: el.id, classes: [...el.classList], panelId: panelEl && panelEl !== doc.body && panelEl !== doc.documentElement ? panelEl.id : "" };
  };
  const nameOf = (el) => { const t = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 24); return `<${el.tagName.toLowerCase()}>${el.id ? " #" + el.id : ""}${t ? " “" + t + "”" : ""}`; };
  function count(sel) { try { return doc.querySelectorAll(sel).length; } catch (e) { return 0; } }
  function fonts() {
    const base = ["inherit", "system-ui", "Arial", "Helvetica", "Segoe UI", "Verdana", "Tahoma", "Trebuchet MS", "Georgia", "Times New Roman", "Courier New", "Consolas", "Impact", "monospace", "serif", "sans-serif"];
    return base;
  }
  function pick(el) {
    picked = el; ensureUi();
    const opts = selectorsFor(descOf(el));
    if (!scope || !opts.some((o) => o.sel === scope)) scope = (opts.find((o) => o.sel === "#" + el.id) || opts[Math.min(1, opts.length - 1)] || opts[0]).sel;
    renderPanel(opts);
    placeHi(el);
  }
  function ruleNow() { return Object.assign({}, styles[scope] || {}); }
  function renderPanel(opts) {
    const el = picked; if (!el) return;
    const host = hostOf(el);
    if (!panel) {
      panel = doc.createElement("div"); panel.id = "thEditPanel"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Style element");
      for (const t of ["keydown", "keyup", "keypress"]) panel.addEventListener(t, (e) => { if (e.key === "Escape" && t === "keydown") { e.preventDefault(); e.stopPropagation(); closePanel(); return; } e.stopPropagation(); });   // 2.515.0: preventDefault - a dialog it sits in stays open
    }
    if (panel.parentNode !== host) host.appendChild(panel);
    const r = ruleNow(), ic = r.icon || {}, ts = r.tshadow, bs = r.bshadow;
    const plain = el.classList.contains("h3icon") || !el.children.length;          // 2.514.0: words can be changed on plain-text elements
    const n = (id, v, lo, hi2, step, t) => `<input type="number" id="${id}" value="${v == null ? "" : v}" min="${lo}" max="${hi2}" step="${step || 1}" title="${esc(t || "")}">`;
    const col = (id, v, t) => `<input type="color" id="${id}" value="${isHex(v) && v.length === 7 ? v : "#000000"}" title="${esc(t || "")}"><label title="use it"><input type="checkbox" id="${id}On"${v ? " checked" : ""}>✓</label>`;
    // 2.567.0: a row of radio buttons (– = none) and four side / corner boxes (= copies the first to all four)
    const seg = (name, v, opts2) => `<span class="seg" id="${name}"><label title="none (its own)"><input type="radio" name="${name}" value=""${v ? "" : " checked"}>–</label>${opts2.map(([val, ic2, t]) => `<label title="${esc(t)}"><input type="radio" name="${name}" value="${val}"${v === val ? " checked" : ""}>${ic2}</label>`).join("")}</span>`;
    const SIDE_PH = { t: "T", r: "R", b: "B", l: "L", tl: "↖", tr: "↗", br: "↘", bl: "↙" }, SIDE_T = { t: "top", r: "right", b: "bottom", l: "left", tl: "top left", tr: "top right", br: "bottom right", bl: "bottom left" };
    const offT = (id) => /^teT(Pad|Mar)$/.test(id) && !plain;
    const sides = (id, v, keys, lo, hi2, t) => keys.map((k) => `<input type="number" class="sd" id="${id}_${k}" value="${v && v[k] != null ? v[k] : ""}" min="${lo}" max="${hi2}" step="1" placeholder="${SIDE_PH[k]}" title="${esc(t)} - ${SIDE_T[k]}"${offT(id) ? " disabled" : ""}>`).join("")
      + `<button class="eq" data-eq="${id}" title="The first value on all four"${offT(id) ? " disabled" : ""}>=</button>`;
    panel.innerHTML = `<div class="th" id="teHead"><b title="${esc(nameOf(el))}">🖌 ${esc(nameOf(el))}</b><button id="teUp" title="The element around it">⬆</button><button id="teClose" title="Close the panel (edit theme mode stays on)">✕</button></div>
      <div class="bd">
        <div class="rw"><span>Apply to</span><select id="teScope" style="flex:1;min-width:0">${opts.map((o) => `<option value="${esc(o.sel)}"${o.sel === scope ? " selected" : ""}>${esc(o.label)} · ${count(o.sel)}</option>`).join("")}</select></div>
        <h5>Text</h5>
        <div class="rw"><span>Font</span><select id="teFont">${fonts().map((f) => `<option${(r.font || "inherit") === f ? " selected" : ""}>${esc(f)}</option>`).join("")}${r.font && !fonts().includes(r.font) ? `<option selected>${esc(r.font)}</option>` : ""}</select></div>
        <div class="rw"><span>Size</span>${n("teSize", r.size, 6, 96, 1, "text size (px)")}px <span style="width:auto">Weight</span><select id="teWeight"><option value="">-</option>${[300, 400, 500, 600, 700, 800, 900].map((w) => `<option${r.weight === w ? " selected" : ""}>${w}</option>`).join("")}</select></div>
        <div class="rw"><span>Colour</span>${col("teColor", r.color, "text colour")}</div>
        <div class="rw"><span>Align</span>${seg("teAl", r.align, [["left", "⇤", "left"], ["center", "↔", "centre"], ["right", "⇥", "right"], ["justify", "☰", "justified (both edges - text over more than one line)"]])} ${seg("teVa", r.valign, [["top", "⤒", "top"], ["middle", "↕", "middle"], ["bottom", "⤓", "bottom"]])}</div>
        <div class="rw"><span>Padding</span>${sides("teTPad", r.tpad, SIDES, 0, 200, plain ? "space inside, around its words" : "only for plain-text elements - use the Box's padding")}</div>
        <div class="rw"><span>Margin</span>${sides("teTMar", r.tmar, SIDES, -200, 200, plain ? "space outside its words (between the icon and the words …)" : "only for plain-text elements - use the Box's margin")}</div>
        <div class="rw"><span>Shadow</span><label><input type="checkbox" id="teTsOn"${ts ? " checked" : ""}>on</label>${n("teTsX", ts ? ts.x : 1, -50, 50, 1, "x")}${n("teTsY", ts ? ts.y : 1, -50, 50, 1, "y")}${n("teTsB", ts ? ts.b : 2, 0, 100, 1, "blur")}<input type="color" id="teTsC" value="${ts ? ts.c : "#000000"}"></div>
        <h5>Box</h5>
        <div class="rw"><span>Fill</span>${col("teBg", r.bg === "transparent" ? "" : r.bg, "background")}</div>
        <div class="rw"><span>Border</span>${col("teBorder", r.border, "border colour")} <span style="width:auto">Radius</span>${n("teRadius", r.radius, 0, 200, 1, "corner radius (px)")}</div>
        <div class="rw"><span>Corners</span>${sides("teCr", r.corners, CORNERS, 0, 200, "rounded corners one by one (px) - over Radius; empty = Radius")}</div>
        <div class="rw"><span>Padding</span>${sides("tePad", r.pad, SIDES, 0, 400, "space inside its edge (px)")}</div>
        <div class="rw"><span>Margin</span>${sides("teMar", r.mar, SIDES, -400, 400, "space outside its edge (px)")}</div>
        <div class="rw"><span>Shadow</span><label><input type="checkbox" id="teBsOn"${bs ? " checked" : ""}>on</label><label><input type="checkbox" id="teBsIn"${bs && bs.inset ? " checked" : ""}>inset</label></div>
        <div class="rw"><span></span>${n("teBsX", bs ? bs.x : 0, -50, 50, 1, "x")}${n("teBsY", bs ? bs.y : 2, -50, 50, 1, "y")}${n("teBsB", bs ? bs.b : 6, 0, 100, 1, "blur")}${n("teBsS", bs ? bs.s : 0, -50, 50, 1, "spread")}<input type="color" id="teBsC" value="${bs ? bs.c : "#000000"}"></div>
        <h5>Icon</h5>
        <div class="rw"><span>Icon</span><input type="text" id="teIcText" value="${esc(ic.text || "")}" placeholder="its own" style="width:60px" title="a new icon: an emoji / a symbol (empty = the element's own)"><button id="teIcImgB" title="A picture as the icon (png / svg / jpeg / webp / gif, 60 KB at most)">🖼</button>${ic.img ? `<button id="teIcImgX" title="No picture">✕🖼</button>` : ""}<input type="file" id="teIcImg" accept="image/png,image/svg+xml,image/jpeg,image/webp,image/gif" hidden></div>
        <div class="rw"><span>Position</span><select id="teIcPos"><option value="">-</option>${ICON_POS.map((p) => `<option value="${p}"${ic.pos === p ? " selected" : ""}>${{ left: "left", right: "right", top: "above", bottom: "below", only: "icon only", hide: "hidden" }[p]}</option>`).join("")}</select> <span style="width:auto">Size</span>${n("teIcSize", ic.size, 6, 96, 1, "icon size (px)")}</div>
        <div class="rw"><span>Fill</span>${col("teIcFill", ic.fill, "the icon's colour (an emoji is tinted)")}</div>
        <h5>Layout</h5>
        <div class="rw"><span>Hide</span><label title="Gone in live mode (faint and dashed in edit mode, so you can pick it again)"><input type="checkbox" id="teHide"${r.hide ? " checked" : ""}>hidden</label>
          <label title="Gone while Expert mode is on (Settings ▸ General), shown in Basic mode - in edit mode it shows faint with a blue dashed outline"><input type="checkbox" id="teXHide"${r.xhide ? " checked" : ""}>hidden in Expert mode</label></div>
        <div class="rw"><span>Text</span><input type="text" id="teText" value="${esc(r.text || "")}" placeholder="${esc(plain ? (splitIcon(el.dataset.h3orig != null ? el.dataset.h3orig : el.textContent).label || "").slice(0, 40) : "only for plain-text elements")}" style="flex:1"${plain ? "" : " disabled"} title="Its words (its icon stays) - empty = its own"></div>
        <div class="rw"><span>Size</span>W ${n("teW", r.w, 4, 4000, 1, "width (px) - empty = its own")} H ${n("teH", r.h, 4, 4000, 1, "height (px) - empty = its own")}<span class="hint" style="width:auto">px · or drag a handle</span></div>
        <div class="rw"><span>Move</span>X ${n("teDx", r.dx || "", -4000, 4000, 1, "moved right (px)")} Y ${n("teDy", r.dy || "", -4000, 4000, 1, "moved down (px)")}<button id="teLayRst" title="Its own size and place again">↺</button></div>
        <div class="rw" style="margin-top:4px"><button id="teClear" title="Remove this rule">↺ Clear</button><span class="hint" id="teMsg" style="width:auto;flex:1"></span></div>
      </div>`;
    const $ = (id) => panel.querySelector("#" + id);
    const read = () => {
      const o = {};
      const f = $("teFont").value; if (f && f !== "inherit") o.font = f;
      if ($("teSize").value !== "") o.size = +$("teSize").value;
      if ($("teWeight").value) o.weight = +$("teWeight").value;
      if ($("teColorOn").checked) o.color = $("teColor").value;
      if ($("teBgOn").checked) o.bg = $("teBg").value;
      if ($("teBorderOn").checked) o.border = $("teBorder").value;
      if ($("teRadius").value !== "") o.radius = +$("teRadius").value;
      if ($("teTsOn").checked) o.tshadow = { x: +$("teTsX").value, y: +$("teTsY").value, b: +$("teTsB").value, c: $("teTsC").value };
      if ($("teBsOn").checked) o.bshadow = { x: +$("teBsX").value, y: +$("teBsY").value, b: +$("teBsB").value, s: +$("teBsS").value, c: $("teBsC").value, inset: $("teBsIn").checked };
      const icn = {}, cur = (styles[scope] || {}).icon || {};
      if ($("teIcText").value) icn.text = $("teIcText").value;
      if (cur.img) icn.img = cur.img;
      if ($("teIcPos").value) icn.pos = $("teIcPos").value;
      if ($("teIcSize").value !== "") icn.size = +$("teIcSize").value;
      if ($("teIcFillOn").checked) icn.fill = $("teIcFill").value;
      if (Object.keys(icn).length) o.icon = icn;
      if ($("teHide").checked) o.hide = true;                                    // 2.514.0: layout
      if ($("teXHide") && $("teXHide").checked) o.xhide = true;                   // 2.544.0: Expert mode only
      if ($("teText").value) o.text = $("teText").value;
      for (const [id, k] of [["teW", "w"], ["teH", "h"], ["teDx", "dx"], ["teDy", "dy"]]) if ($(id).value !== "") o[k] = +$(id).value;
      const radio = (n2) => { const x = panel.querySelector(`input[name=${n2}]:checked`); return x ? x.value : ""; };   // 2.567.0
      if (radio("teAl")) o.align = radio("teAl");
      if (radio("teVa")) o.valign = radio("teVa");
      for (const [id, k, keys] of [["tePad", "pad", SIDES], ["teMar", "mar", SIDES], ["teTPad", "tpad", SIDES], ["teTMar", "tmar", SIDES], ["teCr", "corners", CORNERS]]) {
        const v = {}; for (const s2 of keys) { const x = $(id + "_" + s2); if (x && !x.disabled && x.value !== "") v[s2] = +x.value; }
        if (Object.keys(v).length) o[k] = v;
      }
      return o;
    };
    const commit = () => { setRule(scope, read()); $("teMsg").textContent = `${count(scope)} element(s)`; placeHi(picked); };
    $("teText").addEventListener("keydown", (e) => e.stopPropagation());
    panel.querySelectorAll("input,select").forEach((x) => {
      if (x.id === "teScope" || x.id === "teIcImg") return;
      x.addEventListener(x.type === "checkbox" || x.type === "radio" || x.tagName === "SELECT" ? "change" : "input", () => {
        // a colour changed = use it
        if (x.type === "color" && $(x.id + "On")) $(x.id + "On").checked = true;
        if (/^teTs[XYBC]$/.test(x.id)) $("teTsOn").checked = true;
        if (/^teBs[XYBSC]$/.test(x.id)) $("teBsOn").checked = true;
        commit();
      });
    });
    $("teScope").onchange = () => { scope = $("teScope").value; renderPanel(opts); };
    panel.querySelectorAll("button[data-eq]").forEach((b) => { b.onclick = () => {                    // 2.567.0: = the first value on all four
      const xs = [...panel.querySelectorAll(`input[id^="${b.dataset.eq}_"]`)], v = (xs.find((x) => x.value !== "") || {}).value;
      if (v == null) return; xs.forEach((x) => { x.value = v; }); commit();
    }; });
    $("teUp").onclick = () => { const p = picked.parentElement; if (p && p !== doc.body && p !== doc.documentElement) { scope = ""; pick(p); } };
    $("teClose").onclick = () => closePanel();
    $("teClear").onclick = () => { setRule(scope, {}); renderPanel(opts); };
    $("teLayRst").onclick = () => { const r0 = ruleNow(); delete r0.w; delete r0.h; delete r0.dx; delete r0.dy; setRule(scope, r0); renderPanel(opts); placeHi(picked); };
    $("teIcImgB").onclick = () => $("teIcImg").click();
    if ($("teIcImgX")) $("teIcImgX").onclick = () => { const r0 = ruleNow(); if (r0.icon) delete r0.icon.img; setRule(scope, r0); renderPanel(opts); };
    $("teIcImg").onchange = () => {
      const f = $("teIcImg").files && $("teIcImg").files[0]; if (!f) return;
      if (f.size > MAX_IMG * 0.74) { $("teMsg").textContent = "that picture is too big (45 KB at most)"; return; }
      const rd = new root.FileReader();
      rd.onload = () => { const r0 = read(); r0.icon = Object.assign({}, r0.icon || {}, { img: String(rd.result) }); if (!setRule(scope, r0) || !(styles[scope].icon || {}).img) $("teMsg").textContent = "not a picture this can use"; renderPanel(opts); };
      rd.readAsDataURL(f);
    };
    // the title bar drags the panel
    $("teHead").onpointerdown = (e) => {
      if (e.target.closest("button")) return;
      const r0 = panel.getBoundingClientRect(), dx = e.clientX - r0.left, dy = e.clientY - r0.top;
      const mv = (ev) => { panel.style.left = Math.max(0, Math.min(root.innerWidth - 60, ev.clientX - dx)) + "px"; panel.style.top = Math.max(0, Math.min(root.innerHeight - 30, ev.clientY - dy)) + "px"; panel.dataset.moved = "1"; };
      const upf = () => { root.removeEventListener("pointermove", mv, true); root.removeEventListener("pointerup", upf, true); };
      root.addEventListener("pointermove", mv, true); root.addEventListener("pointerup", upf, true);
      e.preventDefault();
    };
    if (!panel.dataset.moved) {             // next to the element, on screen
      const er = el.getBoundingClientRect(), W = 300, H = Math.min(panel.scrollHeight || 420, root.innerHeight * 0.8);
      let x = er.right + 12; if (x + W > root.innerWidth - 8) x = Math.max(8, er.left - W - 12);
      let y = Math.max(8, Math.min(er.top, root.innerHeight - H - 8));
      panel.style.left = x + "px"; panel.style.top = y + "px";
    }
    $("teMsg").textContent = `${count(scope)} element(s)`;
  }
  function closePanel() { if (panel) { panel.remove(); panel = null; } picked = null; placeHi(null); }
  const isPage = (el) => !el || el === doc.documentElement || el === doc.body;   // 2.540.6: the page itself is never picked
  const over = (e) => { if (!on || ours(e.target) || isPage(e.target)) { if (on && !picked) placeHi(null); return; } if (!picked) placeHi(e.target); };
  const block = (e) => {
    if (!on || ours(e.target)) return;
    e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    if (e.type === "pointerdown") swallowClick = false;                                         // 2.540.6: a new press - the last drag's click is history
    if (e.type === "pointerup" && sizing) { sizing(); return; }                                   // 2.540.6
    if (e.type === "pointerup" && moving && moving.up) { moving.up(); return; }
    if (e.type === "pointerdown" && e.button === 0 && picked && picked.contains(e.target)) { startMove(e); return; }   // 2.514.0
    if (e.type === "click") { if (swallowClick) { swallowClick = false; return; } if (isPage(e.target)) return; scope = ""; if (panel) panel.dataset.moved = ""; pick(e.target); }
  };
  // 2.455.0: Esc anywhere but in the Style panel (it handles its own) or a dialog / menu (theirs) - the 🖌 button focused too
  const keys = (e) => {
    const t = e.target;
    if (!on || e.key !== "Escape" || (t && t.closest && (t.closest("#thEditPanel") || t.closest("#thExitBox") || (!dlgs && t.closest(DIALOG_SEL))))) return;
    e.preventDefault(); e.stopPropagation(); if (picked) closePanel(); else toggle(false);
  };
  /** 2.515.0: Ctrl+Shift+Alt+E - edit theme mode with the dialogs (always listened for) */
  const hotkey = (e) => {
    // Ctrl+S while edit mode is on: this listener is the first one on the page (theme edit loads in <head>)
    if (on && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === "s" || e.key === "S" || e.code === "KeyS")) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); saveAndLeave(); return; }
    if (!(e.ctrlKey && e.shiftKey && e.altKey) || e.metaKey || String(e.code || "") !== "KeyE" && String(e.key || "").toLowerCase() !== "e") return;
    e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    if (doc.getElementById("thExitBox")) return;
    toggle(!on, { dialogs: true });
  };
  /** 2.515.0: Ctrl+S in edit mode - save the theme and leave (a theme with no name: the box asks for one) */
  function saveAndLeave() {
    if (doc.getElementById("thExitBox")) return;
    if (!changedSince()) { toggle(false, { force: true }); return; }
    const b = exitBox(), n = sesName;
    if (n === "Untitled") { const r = b.querySelector("#thxAsRow"); if (r) r.style.display = ""; const i = b.querySelector("#thxName"); if (i) i.focus(); return; }
    b.querySelector("#thxSave").click();
  }
  const EVTS = ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick", "contextmenu", "auxclick"];
  /* ---- 2.514.0: the session - a working copy (themes/<name>.tmp), and the box when leaving */
  let entry = null, sesName = "", tmpT = 0;
  const themeName = () => { try { return (root.H3Theme && root.H3Theme.current().name) || "Untitled"; } catch (e) { return "Untitled"; } };
  const snap = (n) => (root.H3Theme && root.H3Theme.snapshot ? root.H3Theme.snapshot(n) : { name: n, styles });
  const jpost = (u, b) => root.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then((r) => r.json().then((j) => { if (!r.ok) throw new Error(j.error || r.status); return j; }));
  const changedSince = () => entry != null && JSON.stringify(styles) !== entry;
  function tmpSoon() {
    if (!on || typeof root.fetch !== "function") return;
    clearTimeout(tmpT); tmpT = root.setTimeout(() => { jpost("/api/themes/tmp", { name: sesName, theme: snap(sesName) }).catch(() => {}); }, 500);
  }
  const tmpGone = (n) => { clearTimeout(tmpT); return typeof root.fetch === "function" ? jpost("/api/themes/tmp/delete", { name: n || sesName }).catch(() => {}) : Promise.resolve(); };
  function box(html, wire) {
    let b = doc.getElementById("thExitBox"); if (b) b.remove();
    b = doc.createElement("div"); b.id = "thExitBox"; b.setAttribute("role", "alertdialog");
    b.innerHTML = `<div class="tx">${html}</div>`;
    for (const t of ["keydown", "keyup", "keypress"]) b.addEventListener(t, (e) => { e.stopPropagation(); if (t === "keydown" && e.key === "Escape") { e.preventDefault(); b.remove(); } });
    (topModal() || doc.body).appendChild(b); wire(b);                 // 2.515.0: over an open modal dialog it goes inside it
    const f = b.querySelector("button.pri") || b.querySelector("button"); if (f) f.focus();
    return b;
  }
  /** leaving edit mode with changes: Save theme / Save theme as… / Reset theme / Cancel */
  function exitBox() {
    const n = sesName;
    return box(`<h4>🖌 Leave edit theme mode</h4><p>The theme has changes you made in edit mode (kept so far in themes/${esc(n)}.tmp).</p>
      <div class="rw"><button class="pri" id="thxSave" title="themes/${esc(n)}.json">💾 Save theme “${esc(n)}”</button><button id="thxAs">Save theme as…</button><button id="thxReset" title="Back to how it was when edit mode began">↺ Reset theme</button><button id="thxLater" title="Leave edit mode with the changes showing, not saved yet (themes/${esc(n)}.tmp keeps them)">Not now</button><button id="thxCancel" title="Stay in edit mode">Cancel</button></div>
      <div class="rw" id="thxAsRow" style="display:none"><input type="text" id="thxName" value="${esc(n === "Untitled" ? "" : n)}" placeholder="the theme's name"><button class="pri" id="thxAsGo">Save</button></div><div class="rw"><span id="thxMsg" style="color:#9a917f"></span></div>`, (b) => {
      const q = (id) => b.querySelector("#" + id), msg = (t) => { q("thxMsg").textContent = t; };
      const leave = () => { b.remove(); toggle(false, { force: true }); };
      const saveTo = (name) => {
        if (!root.H3Theme || !root.H3Theme.saveAs) { msg("themes are not loaded"); return; }
        msg("saving…");
        root.H3Theme.saveAs(name).then((j) => { if (!j) { msg("could not save - see Settings ▸ Themes"); return; } const old = sesName; entry = JSON.stringify(styles); return tmpGone(old).then(() => { if (old !== j.name) tmpGone(j.name); leave(); }); });
      };
      q("thxSave").onclick = () => (n === "Untitled" ? (q("thxAsRow").style.display = "", q("thxName").focus()) : saveTo(n));
      q("thxAs").onclick = () => { q("thxAsRow").style.display = ""; q("thxName").focus(); q("thxName").select(); };
      q("thxAsGo").onclick = () => { const v = q("thxName").value.trim(); if (!v) { msg("give the theme a name"); return; } saveTo(v); };
      q("thxName").onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") q("thxAsGo").click(); };
      q("thxReset").onclick = () => { setStyles(JSON.parse(entry || "{}")); tmpGone().then(leave); };
      q("thxCancel").onclick = () => b.remove();
      q("thxLater").onclick = () => leave();   // end() writes the .tmp with the last change
    });
  }
  function begin() {
    entry = JSON.stringify(styles); sesName = themeName();
    afterSet = tmpSoon;
    if (typeof root.fetch !== "function") return;
    root.fetch("/api/themes/tmp/" + encodeURIComponent(sesName)).then((r) => (r.ok ? r.json() : null)).then((t) => {
      if (!t || !t.styles || JSON.stringify(cleanStyles(t.styles)) === entry || !on) return;
      box(`<h4>🖌 Unsaved theme changes</h4><p>themes/${esc(sesName)}.tmp holds changes from an edit that was not saved (${esc(String(t.saved || "").slice(0, 16).replace("T", " "))}).</p>
        <div class="rw"><button class="pri" id="thrYes">Bring them back</button><button id="thrNo">Throw them away</button></div>`, (b) => {
        b.querySelector("#thrYes").onclick = () => { b.remove(); setStyles(t.styles); };
        b.querySelector("#thrNo").onclick = () => { b.remove(); tmpGone(); };
      });
    }).catch(() => {});
  }
  function end() {
    afterSet = null; clearTimeout(tmpT);
    if (!changedSince()) tmpGone();
    else if (typeof root.fetch === "function") jpost("/api/themes/tmp", { name: sesName, theme: snap(sesName) }).catch(() => {});   // the last change too (not left in the wait)
    entry = null;
  }
  function toggle(want, opts) {
    const next = want == null ? !on : !!want;
    if (next === on) return on;
    if (!next && !(opts && opts.force) && changedSince()) { exitBox(); return on; }   // 2.514.0: Save / Save as / Reset / Cancel
    on = next; ensureUi();
    dlgs = on && !!(opts && opts.dialogs);                                             // 2.515.0
    doc.body.classList.toggle("h3-theditdlg", dlgs);
    if (on) begin(); else end();
    doc.body.classList.toggle("h3-thedit", on);
    for (const t of EVTS) { if (on) root.addEventListener(t, block, true); else root.removeEventListener(t, block, true); }
    if (on) { root.addEventListener("pointerover", over, true); root.addEventListener("keydown", keys, true); }
    else { root.removeEventListener("pointerover", over, true); root.removeEventListener("keydown", keys, true); closePanel(); if (hi) hi.remove(); if (hdl) hdl.remove(); }
    for (const b of [doc.getElementById("thEditBtn"), doc.getElementById("s_thedit")]) if (b) { b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }
    if (on && !dlgs) { const s = doc.getElementById("settings"); if (s && s.open && s.close) s.close(); }   // 2.515.0: Ctrl+Shift+Alt+E keeps it open to edit
    try { root.dispatchEvent(new root.CustomEvent("h3themeedit", { detail: { on } })); } catch (e) { /* old */ }
    return on;
  }

  /* ---- Settings ▸ Themes: the toggle and the rules */
  function paintList() {
    const box = doc && doc.getElementById("s_thstyles"); if (!box) return;
    const ks = Object.keys(styles);
    box.innerHTML = ks.length ? ks.map((s) => `<span class="thrule"><code>${esc(s)}</code> <span class="hint">${esc(Object.keys(styles[s]).join(", "))}</span> <button type="button" class="ghost" data-thrule-x="${esc(s)}" title="Remove this rule">✕</button></span>`).join("")
      : `<span class="hint">No element styles yet - 🖌 Edit theme mode, then click anything on screen.</span>`;
    box.querySelectorAll("[data-thrule-x]").forEach((b) => { b.onclick = () => setRule(b.dataset.thruleX, {}); });
  }
  function start() {
    if (!doc || !doc.body) return;
    // the top bar: 🖌 next to ⚙
    const gear = doc.getElementById("openSettings");
    if (gear && !doc.getElementById("thEditBtn")) {
      const b = doc.createElement("button"); b.className = "ghost"; b.id = "thEditBtn"; b.type = "button"; b.textContent = "🖌";
      b.title = "Edit theme mode: click anything on screen to style it (font, size, colours, shadows, its icon) - click 🖌 again for live mode. Ctrl+Shift+Alt+E = the same with the dialogs too (Settings …); Ctrl+S saves the theme and leaves";
      b.setAttribute("aria-pressed", "false"); b.onclick = (e) => { e.stopPropagation(); toggle(); };
      gear.insertAdjacentElement("afterend", b);
    }
    // Settings ▸ Themes: a section of its own
    const tab = doc.getElementById("stab-themes");
    if (tab && !doc.getElementById("s_thstyles")) {
      const lab = doc.createElement("label"); lab.className = "f"; lab.style.marginTop = "14px"; lab.innerHTML = 'Element styles <span class="hint">(kept with the theme)</span>';
      const row = doc.createElement("div"); row.className = "rowbtns"; row.style.marginTop = "4px";
      row.innerHTML = `<button class="ghost" id="s_thedit" type="button" aria-pressed="false" title="Click anything on screen to style it - 🖌 in the top bar does the same">🖌 Edit theme mode</button><button class="ghost" id="s_thstylesclear" type="button" title="Remove every element style">↺ Clear element styles</button>`;
      const list = doc.createElement("div"); list.id = "s_thstyles"; list.className = "thstyles"; list.style.cssText = "display:flex;flex-direction:column;gap:2px;margin-top:4px;max-height:160px;overflow:auto";
      const anchor = doc.getElementById("s_thmsg");
      if (anchor && anchor.parentNode === tab) { anchor.after(lab, row, list); } else tab.append(lab, row, list);
      doc.getElementById("s_thedit").onclick = (e) => { e.stopPropagation(); toggle(); };
      doc.getElementById("s_thstylesclear").onclick = () => setStyles({});
    }
    paintList();
    applyIcons();
    try { new root.MutationObserver(() => { if (!wrapping && (iconSels().length || alignSels().length)) iconsSoon(); }).observe(doc.body, { childList: true, subtree: true, characterData: true }); } catch (e) { /* old */ }
  }
  if (doc) { if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start(); }
  if (root.addEventListener) root.addEventListener("keydown", hotkey, true);          // 2.515.0: Ctrl+Shift+Alt+E

  const H3ThemeEdit = { ICON_POS, ALIGN, VALIGN, alignKind, alignCss, cleanSides, DYNAMIC, DIALOG_SEL, cleanSel, cleanRule, cleanStyles, isRootSel, cssStr, compile, splitIcon, selectorsFor, resizeBy, changed: changedSince, session: () => sesName,
    styles: () => JSON.parse(JSON.stringify(styles)), setStyles, setRule, toggle, isOn: () => on, dialogs: () => dlgs, saveAndLeave, pick: (el) => { if (!on) toggle(true); scope = ""; pick(el); }, scope: () => scope, applyIcons, start };
  if (typeof module !== "undefined" && module.exports) module.exports = H3ThemeEdit;
  else root.H3ThemeEdit = H3ThemeEdit;
})(typeof window !== "undefined" ? window : globalThis);
