/* bitGen Studio — THE WAY BACK: Ctrl+Alt+S opens Settings, the "bitGen Default" theme (2.636.0), window.H3SafeTheme.
 *
 * Tim (verbatim): "can you add ctrl+alt+s to open settings dialog, my settings button vanished. create a default theme that
 * i can revert to in case a theme malfunctions".
 *
 *   Ctrl+Alt+S        opens Settings from anywhere (while typing too) - even when a theme hid / blanked the ⚙ button
 *   Ctrl+Alt+Shift+T  bitGen Default at once: Dark, its own accent and colours, no element styles (🖌 edit theme - fonts,
 *                     colours, icons, changed words), UI size 100 % - the theme before is kept: Settings ▸ Themes ▸
 *                     ↶ The theme before brings it back
 *   ?theme=default    in the address (or #theme=default) - the same before the page paints, for a theme that leaves
 *                     nothing usable on screen
 *   Settings ▸ Themes the "bitGen Default" card (always first, cannot be deleted or overwritten - lib/themeStore.js) and
 *                     ⟲ bitGen Default / ↶ The theme before buttons
 * Loaded in <head> right after static/themes.js (so ?theme=default lands before the first paint). Kept in this browser:
 * h3.themeBackup = the theme before the last reset ({theme, accent, themeVars, themeName, themeStyles, scale}).
 * Pure (Node: scripts/test-safetheme636.js): KEYS, isOpenKey, isResetKey, wantsReset, DEFAULT_NAME. */
(function (root) {
  "use strict";
  const DEFAULT_NAME = "bitGen Default";
  const KEYS = ["theme", "accent", "themeVars", "themeName", "themeStyles", "scale"];
  /** Ctrl+Alt+S (not Shift / Meta; an AltGr layout's own character on S is left alone) */
  function isOpenKey(e) {
    if (!e || !e.ctrlKey || !e.altKey || e.shiftKey || e.metaKey) return false;
    const k = String(e.key || "");
    return e.code === "KeyS" ? (k.length !== 1 || k.toLowerCase() === "s") : k.toLowerCase() === "s";
  }
  /** Ctrl+Alt+Shift+T */
  function isResetKey(e) {
    if (!e || !e.ctrlKey || !e.altKey || !e.shiftKey || e.metaKey) return false;
    const k = String(e.key || "");
    return e.code === "KeyT" || k.toLowerCase() === "t";
  }
  /** ?theme=default / #theme=default (also safe-theme / safetheme) */
  function wantsReset(search, hash) {
    const s = String(search || "") + "&" + String(hash || "").replace(/^#/, "");
    return /(^|[?&#])(theme=default|safe-?theme(=1)?)(&|$)/i.test(s);
  }

  const ls = () => { try { return root.localStorage; } catch (e) { return null; } };
  const get = (k) => { const s = ls(); try { return s ? s.getItem("h3." + k) : null; } catch (e) { return null; } };
  const put = (k, v) => { const s = ls(); try { if (!s) return; if (v == null || v === "") s.removeItem("h3." + k); else s.setItem("h3." + k, v); } catch (e) { /* private */ } };
  function backup() { const o = {}; for (const k of KEYS) o[k] = get(k); return o; }
  const hasBackup = () => !!get("themeBackup");
  function note(t) {
    try { if (typeof root.logLine === "function") root.logLine("[theme] " + t); } catch (e) { /* fine */ }
    const m = root.document && root.document.getElementById("s_thmsg"); if (m) m.textContent = t;
    paintButtons();
  }
  /** everything about the look back to bitGen's own; the theme before is kept (h3.themeBackup) */
  function reset(opts) {
    const o = opts || {};
    const was = backup();
    if (KEYS.some((k) => was[k] != null && !(k === "themeName" && was[k] === DEFAULT_NAME))) put("themeBackup", JSON.stringify(was));
    for (const k of KEYS) put(k, "");
    try { if (root.H3ThemeEdit && root.H3ThemeEdit.setStyles) root.H3ThemeEdit.setStyles({}); } catch (e) { /* cleared in storage anyway */ }
    try { if (root.H3Theme) root.H3Theme.choose("dark", "", {}, DEFAULT_NAME); } catch (e) { /* applied on the next start */ }
    put("themeName", DEFAULT_NAME);
    try { if (typeof root.applyUiScale === "function") root.applyUiScale(100); else if (root.document) root.document.documentElement.style.fontSize = "14px"; } catch (e) { /* fine */ }
    if (!o.quiet) note("bitGen Default theme - the one before is kept (Settings ▸ Themes ▸ ↶ The theme before)");
    return was;
  }
  /** the theme before the last reset, back */
  function restore() {
    let b = null; try { b = JSON.parse(get("themeBackup") || "null"); } catch (e) { b = null; }
    if (!b) { note("no theme to go back to"); return null; }
    const now = backup();
    for (const k of KEYS) put(k, b[k]);
    put("themeBackup", JSON.stringify(now));                                   // ↶ again = back to the default
    try { if (root.H3ThemeEdit && root.H3ThemeEdit.setStyles) { let st = {}; try { st = JSON.parse(b.themeStyles || "{}"); } catch (e) { st = {}; } root.H3ThemeEdit.setStyles(st); } } catch (e) { /* fine */ }
    try { if (root.H3Theme) { const c = root.H3Theme.current(); root.H3Theme.choose(c.theme, c.accent, c.vars, c.name); } } catch (e) { /* fine */ }
    try { if (typeof root.applyUiScale === "function") root.applyUiScale(parseInt(b.scale, 10) || 100); } catch (e) { /* fine */ }
    note("the theme before is back" + (b.themeName ? " (" + b.themeName + ")" : ""));
    return b;
  }
  /** Settings, from anywhere */
  function openSettings() {
    const doc = root.document; if (!doc) return false;
    const dlg = doc.getElementById("settings");
    if (dlg && dlg.open) { try { dlg.focus(); } catch (e) { /* fine */ } return true; }
    const b = doc.getElementById("openSettings");
    if (b && typeof b.onclick === "function") { b.onclick(); return true; }
    if (b) { b.click(); return true; }
    if (dlg && dlg.showModal) { dlg.showModal(); return true; }
    return false;
  }
  function paintButtons() {
    const doc = root.document; if (!doc) return;
    const u = doc.getElementById("s_thbefore"); if (u) u.style.display = hasBackup() ? "" : "none";
  }
  function onKey(e) {
    if (isOpenKey(e)) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); openSettings(); return; }
    if (isResetKey(e)) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); reset(); }
  }
  function start() {
    const doc = root.document; if (!doc) return;
    if (!root.openSettings) root.openSettings = openSettings;                 // addons.js / dockreset.js / team.js look for it
    const d = doc.getElementById("s_thdefault"); if (d && !d.dataset.wired) { d.dataset.wired = "1"; d.onclick = () => reset(); }
    const u = doc.getElementById("s_thbefore"); if (u && !u.dataset.wired) { u.dataset.wired = "1"; u.onclick = () => restore(); }
    paintButtons();
    const gear = doc.getElementById("openSettings");
    if (gear && !/Ctrl\+Alt\+S/.test(gear.title)) gear.title = (gear.title || "Settings") + " (Ctrl+Alt+S)";
  }

  if (root.document) {
    // a theme that left nothing usable: ?theme=default, before the first paint (themes.js already put the kept one on)
    try { if (wantsReset(root.location && root.location.search, root.location && root.location.hash)) reset({ quiet: true }); } catch (e) { /* fine */ }
    root.addEventListener("keydown", onKey, true);
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", start); else start();
    // themeedit.js may load after this file: clear its styles again once everything is there
    root.addEventListener("load", () => { try { if (wantsReset(root.location.search, root.location.hash) && root.H3ThemeEdit) root.H3ThemeEdit.setStyles({}); } catch (e) { /* fine */ } });
  }
  const api = { DEFAULT_NAME, KEYS, isOpenKey, isResetKey, wantsReset, reset, restore, openSettings, hasBackup };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.H3SafeTheme = api;
})(typeof window !== "undefined" ? window : globalThis);
