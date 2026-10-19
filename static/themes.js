/* bitGen Studio — THEMES (2.432.0), window.H3Theme.
 *
 * Tim (verbatim): "create a themes tab in the settings dialog - have a ui size slider to adjust the size of fonts and
 * the ui".
 *
 *   THEMES     Dark (bitGen's own), Darker (OLED black), Slate (cool blue-grey), Light, High contrast - each is the
 *              app's colour variables (--ink, --panel, --panel-2, --line, --text, --dim, --tiger (the accent),
 *              --tiger-deep, --ok, --bad, --ui-hover, --ui-canvas, --ui-on) set on <html>, each also as --th-<name>
 *              (the image editor re-maps --panel ... inside itself, so its bitGen theme reads --th-*) - it follows.
 *   ACCENT     any colour instead of the theme's own (the buttons, the lit tabs, the sliders); Reset = the theme's.
 *   UI SIZE    the slider in Settings ▸ Themes (and the left dock's corner - the two stay in step) scales every font
 *              and every panel (the root font size the layout is sized from) 60 - 175 %.
 *   Kept in this browser (h3.theme / h3.accent / h3.scale) and put on <html> before the page paints (this file is
 *   loaded in <head>), so a light theme never flashes dark.
 *
 *   CUSTOM + SAVED (2.435.0, Tim: "allow user to save/load themes (save themes to themes\theme name.json)"): every
 *              colour can be changed (Customize); 💾 Save theme writes themes/<name>.json in the install folder
 *              (routes/themes.js, lib/themeStore.js: the colours, the accent, the UI size, the theme it started from);
 *              the saved ones are cards of their own - a click loads one, ✕ deletes it; ⤓ Export / ⤒ Import a .json.
 *              The changed colours are kept in this browser (h3.themeVars) and on <html> before the page paints too.
 *
 *   ELEMENT STYLES (2.443.0, static/themeedit.js - 🖌 edit theme mode): a theme record keeps `styles` too
 *              ({selector: {font, size, weight, color, bg, border, radius, tshadow, bshadow, icon}}); saving / loading /
 *              export / import carry them.
 *
 * Pure (Node: scripts/test-themes.js): THEMES, ORDER, shade, varsFor, clampScale, effective, fromSaved, LABELS.
 */
(function (root) {
  "use strict";
  const THEMES = {
    dark: { name: "Dark", scheme: "dark", ink: "#14120f", panel: "#1d1a15", "panel-2": "#26221b", line: "#3a342a", text: "#e8e2d6", dim: "#9a917f", tiger: "#f59e2c", "tiger-deep": "#c4761a", ok: "#7fb069", bad: "#d1553f", "ui-hover": "#2f2a21", "ui-canvas": "#0f0d0b", "ui-on": "#4a3414" },
    darker: { name: "Darker (OLED)", scheme: "dark", ink: "#000000", panel: "#0c0b09", "panel-2": "#16140f", line: "#2a261f", text: "#ece6da", dim: "#8f8775", tiger: "#f59e2c", "tiger-deep": "#c4761a", ok: "#7fb069", bad: "#e0573f", "ui-hover": "#1d1a14", "ui-canvas": "#000000", "ui-on": "#3a2810" },
    slate: { name: "Slate", scheme: "dark", ink: "#11151a", panel: "#181d24", "panel-2": "#202732", line: "#313b49", text: "#e3e8ef", dim: "#8c97a8", tiger: "#4aa3ff", "tiger-deep": "#2b7fd6", ok: "#6fbf73", bad: "#e06060", "ui-hover": "#252e3a", "ui-canvas": "#0c0f13", "ui-on": "#1e3a5c" },
    light: { name: "Light", scheme: "light", ink: "#f3f1ec", panel: "#ffffff", "panel-2": "#ebe7de", line: "#cfc8b8", text: "#26221b", dim: "#6f6756", tiger: "#d97a06", "tiger-deep": "#a85d03", ok: "#3c8a2e", bad: "#c0392b", "ui-hover": "#e4dfd3", "ui-canvas": "#d6d2c8", "ui-on": "#f8dcb4" },
    contrast: { name: "High contrast", scheme: "dark", ink: "#000000", panel: "#000000", "panel-2": "#141414", line: "#ffffff", text: "#ffffff", dim: "#e6e6e6", tiger: "#ffd400", "tiger-deep": "#d1ad00", ok: "#3dff7a", bad: "#ff5c5c", "ui-hover": "#262626", "ui-canvas": "#000000", "ui-on": "#4d4000" },
  };
  const ORDER = ["dark", "darker", "slate", "light", "contrast"];
  const VARS = ["ink", "panel", "panel-2", "line", "text", "dim", "tiger", "tiger-deep", "ok", "bad", "ui-hover", "ui-canvas", "ui-on"];
  const isHex = (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);
  /** a colour made darker (k < 0) or lighter (k > 0), -1 .. 1 */
  function shade(hex, k) {
    if (!isHex(hex)) return hex;
    const n = parseInt(hex.slice(1), 16), ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const out = ch.map((v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k));
    return "#" + out.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
  }
  const LABELS = { ink: "Background", panel: "Panels", "panel-2": "Panels (raised)", line: "Lines", text: "Text", dim: "Dim text", ok: "OK / green", bad: "Error / red", "ui-hover": "Hover", "ui-canvas": "Canvas", "ui-on": "Selected" };
  /** the colours in effect: the theme's, then the user's own changes (overrides), then the accent */
  function effective(id, accent, overrides) {
    const t = THEMES[id] || THEMES.dark, o = {};
    for (const k of VARS) o[k] = overrides && isHex(overrides[k]) ? overrides[k].toLowerCase() : t[k];
    if (isHex(accent)) { o.tiger = accent.toLowerCase(); o["tiger-deep"] = shade(accent, -0.22); }
    return o;
  }
  /** a saved theme record (themes/<name>.json) -> {theme, accent, vars, scale, name} for the page */
  function fromSaved(rec) {
    const r0 = rec && typeof rec === "object" ? rec : {};
    const theme = THEMES[r0.base] ? r0.base : "dark", vars = {};
    for (const k of VARS) if (r0.vars && isHex(r0.vars[k]) && r0.vars[k].toLowerCase() !== THEMES[theme][k]) vars[k] = r0.vars[k].toLowerCase();
    return { theme, accent: isHex(r0.accent) ? r0.accent.toLowerCase() : "", vars, scale: clampScale(r0.scale), name: String(r0.name || "") };
  }
  /** the CSS variables for a theme (+ an accent of the user's own, + the user's own colours) */
  function varsFor(id, accent, overrides) {
    const e = effective(id, "", overrides), o = {};
    for (const k of VARS) o["--" + k] = e[k];
    if (isHex(accent)) { o["--tiger"] = accent.toLowerCase(); o["--tiger-deep"] = shade(accent, -0.22); }
    // the same under --th-* - the image editor maps the app's names onto its own inside .kx, so it reads these
    for (const k of VARS) o["--th-" + k] = o["--" + k];
    return o;
  }
  const clampScale = (v) => Math.min(175, Math.max(60, parseInt(v, 10) || 100));

  /* ================================ the page ================================ */
  const get = (k, d) => { try { const v = root.localStorage.getItem("h3." + k); return v == null ? d : v; } catch (e) { return d; } };
  const set = (k, v) => { try { if (v == null || v === "") root.localStorage.removeItem("h3." + k); else root.localStorage.setItem("h3." + k, v); } catch (e) { /* private */ } };
  const ovr = () => { try { const o = JSON.parse(get("themeVars", "{}")); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; } };
  function apply(id, accent, overrides) {
    const doc = root.document; if (!doc) return;
    const el = doc.documentElement, t = THEMES[id] ? id : "dark", v = varsFor(t, accent, overrides === undefined ? ovr() : overrides);
    for (const k of Object.keys(v)) el.style.setProperty(k, v[k]);
    el.style.colorScheme = THEMES[t].scheme;
    el.dataset.theme = t;
  }
  const current = () => ({ theme: THEMES[get("theme", "dark")] ? get("theme", "dark") : "dark", accent: get("accent", ""), vars: ovr(), name: get("themeName", "") });
  /** a theme / an accent chosen: kept, applied, the controls painted */
  function choose(theme, accent, vars, name) {
    if (theme != null) { set("theme", THEMES[theme] ? theme : "dark"); if (vars === undefined) { set("themeVars", ""); set("themeName", ""); } }
    if (vars !== undefined) set("themeVars", vars && Object.keys(vars).length ? JSON.stringify(vars) : "");
    if (name !== undefined) set("themeName", name || "");
    if (accent !== undefined) set("accent", isHex(accent) ? accent.toLowerCase() : "");
    const c = current(); apply(c.theme, c.accent, c.vars); paint();
    try { root.dispatchEvent(new root.CustomEvent("h3theme", { detail: c })); } catch (e) { /* old */ }
    return c;
  }
  function paint() {
    const doc = root.document, box = doc && doc.getElementById("s_themes"); if (!box) return;
    const c = current();
    box.querySelectorAll("[data-theme-id]").forEach((b) => { const on = b.dataset.themeId === c.theme; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
    const a = doc.getElementById("s_accent"); if (a) a.value = c.accent || THEMES[c.theme].tiger;
    const r = doc.getElementById("s_accentv"); if (r) r.textContent = c.accent ? c.accent : "the theme's own";
    // 2.435.0: Customize - each colour as it is now; the saved themes' cards
    const cu = doc.getElementById("s_thcustom");
    if (cu) {
      const e = effective(c.theme, "", c.vars);
      cu.querySelectorAll("input[data-tv]").forEach((x) => { x.value = e[x.dataset.tv]; x.closest("label").classList.toggle("chg", !!c.vars[x.dataset.tv]); });
    }
    const nm = doc.getElementById("s_thname"); if (nm && !nm.matches(":focus")) nm.value = c.name || "";
    paintSaved();
  }
  /* ---------------- saved themes (themes/<name>.json) ---------------- */
  let saved = [];
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  function paintSaved() {
    const doc = root.document, box = doc && doc.getElementById("s_thsaved"); if (!box) return;
    const c = current();
    box.innerHTML = saved.length ? saved.map((t) => { const e = effective(t.base, t.accent, t.vars);
      return `<span class="thsaved${t.name === c.name ? " on" : ""}"><button type="button" class="ghost thcard" data-th-load="${esc(t.name)}" title="Load ${esc(t.name)} (themes/${esc(t.file || t.name + ".json")})" style="background:${e.panel};color:${e.text};border-color:${e.line}">`
        + `<span class="thsw" style="background:${e.ink}"></span><span class="thsw" style="background:${e["panel-2"]}"></span><span class="thsw" style="background:${e.tiger}"></span><span class="thn">${esc(t.name)}</span></button>`
        + `<button type="button" class="ghost thx" data-th-del="${esc(t.name)}" title="Delete themes/${esc(t.name)}.json" aria-label="Delete ${esc(t.name)}">✕</button></span>`; }).join("")
      : `<span class="hint">No saved themes yet - change the colours, give it a name, 💾 Save theme.</span>`;
    box.querySelectorAll("[data-th-load]").forEach((b) => { b.onclick = () => load(b.dataset.thLoad); });
    box.querySelectorAll("[data-th-del]").forEach((b) => { b.onclick = () => remove(b.dataset.thDel); });
  }
  const say = (t) => { const m = root.document && root.document.getElementById("s_thmsg"); if (m) m.textContent = t || ""; };
  function refresh() {
    if (typeof root.fetch !== "function") return Promise.resolve([]);
    return root.fetch("/api/themes").then((r) => r.json()).then((j) => { saved = (j && j.themes) || []; paintSaved(); return saved; }).catch(() => []);
  }
  /** the theme as it is now -> a record to keep */
  function snapshot(name) {
    const c = current(), e = effective(c.theme, c.accent, c.vars);
    let scale = 100; try { scale = clampScale(root.localStorage.getItem("h3.scale") || 100); } catch (er) { scale = 100; }
    const styles = root.H3ThemeEdit ? root.H3ThemeEdit.styles() : {};      // 2.443.0: the element styles (static/themeedit.js)
    return { name, base: c.theme, vars: e, accent: c.accent, scale, scheme: THEMES[c.theme].scheme, styles };
  }
  function saveAs(name) {
    const n = String(name || "").trim(); if (!n) { say("give the theme a name first"); return Promise.resolve(null); }
    return root.fetch("/api/themes/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: n, theme: snapshot(n) }) })
      .then((r) => r.json().then((j) => { if (!r.ok) throw new Error(j.error || "refused"); return j; }))
      .then((j) => { set("themeName", j.name); say(`saved as themes/${j.file}`); return refresh().then(() => j); })
      .catch((e) => { say("could not save: " + e.message); return null; });
  }
  function useRecord(rec) {
    const f = fromSaved(rec);
    if (root.H3ThemeEdit) root.H3ThemeEdit.setStyles(rec && rec.styles ? rec.styles : {});   // 2.443.0: a theme brings its element styles
    choose(f.theme, f.accent, f.vars, f.name);
    if (typeof root.applyUiScale === "function") root.applyUiScale(f.scale); else set("scale", String(f.scale));
    return f;
  }
  function load(name) {
    const t = saved.find((x) => x.name === name);
    if (t) { useRecord(t); say(`${name} loaded`); return Promise.resolve(t); }
    return root.fetch("/api/themes/" + encodeURIComponent(name)).then((r) => r.json()).then((j) => { if (j && j.vars) { useRecord(j); say(`${name} loaded`); } return j; });
  }
  function remove(name) {
    return root.fetch("/api/themes/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) })
      .then((r) => r.json()).then(() => { if (current().name === name) set("themeName", ""); say(`themes/${name}.json deleted`); return refresh(); });
  }
  function exportNow() {
    const doc = root.document, c = current(), n = (doc.getElementById("s_thname") || {}).value || c.name || "my theme";
    const blob = new root.Blob([JSON.stringify(snapshot(n.trim()), null, 2)], { type: "application/json" });
    const a = doc.createElement("a"); a.href = root.URL.createObjectURL(blob); a.download = n.trim().replace(/[^A-Za-z0-9 ._()&+-]+/g, "_") + ".json"; doc.body.appendChild(a); a.click();
    setTimeout(() => { root.URL.revokeObjectURL(a.href); a.remove(); }, 3000);
  }
  function importFile(file) {
    return file.text().then((txt) => { const rec = JSON.parse(txt); if (!rec || !rec.vars) throw new Error("not a bitGen theme (.json with vars)"); const f = useRecord(rec); say(`${f.name || file.name} imported - 💾 Save theme keeps it in themes/`); return f; })
      .catch((e) => { say("could not import: " + e.message); return null; });
  }
  function start() {
    const doc = root.document, box = doc && doc.getElementById("s_themes"); if (!box || box.dataset.ready) return;
    box.dataset.ready = "1";
    box.innerHTML = ORDER.map((id) => { const t = THEMES[id];
      return `<button type="button" class="ghost thcard" data-theme-id="${id}" title="${t.name}" style="background:${t.panel};color:${t.text};border-color:${t.line}">`
        + `<span class="thsw" style="background:${t.ink}"></span><span class="thsw" style="background:${t["panel-2"]}"></span><span class="thsw" style="background:${t.tiger}"></span>`
        + `<span class="thn">${t.name}</span></button>`; }).join("");
    box.querySelectorAll("[data-theme-id]").forEach((b) => { b.onclick = () => choose(b.dataset.themeId); });
    const a = doc.getElementById("s_accent"); if (a) a.oninput = () => choose(null, a.value);
    const ar = doc.getElementById("s_accentreset"); if (ar) ar.onclick = () => choose(null, "");
    // 2.435.0: Customize + saved themes
    const cu = doc.getElementById("s_thcustom");
    if (cu) {
      cu.innerHTML = VARS.filter((k) => k !== "tiger" && k !== "tiger-deep").map((k) => `<label class="thc" title="--${k}"><input type="color" data-tv="${k}"> ${LABELS[k] || k}</label>`).join("");
      cu.querySelectorAll("input[data-tv]").forEach((x) => { x.oninput = () => { const v = Object.assign({}, current().vars); v[x.dataset.tv] = x.value.toLowerCase(); choose(null, undefined, v); }; });
    }
    const rs = doc.getElementById("s_threset"); if (rs) rs.onclick = () => choose(null, undefined, {}, "");
    const sv = doc.getElementById("s_thsave"); if (sv) sv.onclick = () => saveAs((doc.getElementById("s_thname") || {}).value);
    const nm = doc.getElementById("s_thname"); if (nm) nm.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); saveAs(nm.value); } };
    const ex = doc.getElementById("s_thexport"); if (ex) ex.onclick = exportNow;
    const im = doc.getElementById("s_thimport"), fi = doc.getElementById("s_thfile");
    if (im && fi) { im.onclick = () => fi.click(); fi.onchange = () => { const f = fi.files && fi.files[0]; fi.value = ""; if (f) importFile(f); }; }
    paint(); refresh();
  }
  // before the page paints: the kept theme
  try { const c = current(); apply(c.theme, c.accent, c.vars); } catch (e) { /* no DOM (Node) */ }
  if (root.document) { if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", start); else start(); }

  const H3Theme = { THEMES, ORDER, VARS, LABELS, shade, varsFor, clampScale, effective, fromSaved, apply, choose, current, start, refresh, saveAs, load, remove, importFile, snapshot, saved: () => saved };
  if (typeof module !== "undefined" && module.exports) module.exports = H3Theme;
  else root.H3Theme = H3Theme;
})(typeof window !== "undefined" ? window : globalThis);
