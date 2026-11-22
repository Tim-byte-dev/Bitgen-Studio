// bitGen Studio — lib/apkTheme.js (2.924.0): THE STUDIO'S THEME COLOURS IN THE 📱 bitGen APP YOU BUILD.
//
// Tim: "when building the app from bitgen can we use the theme colors currently selected for the app?"
//
// The studio's theme lives in its page (static/themes.js - the built-in themes, an accent of your own, your Customize
// colours; kept in the browser), so Settings ▸ General ▸ 📱 The bitGen App's 🔨 Build sends the colours in use with the build
// (static/apkui.js) and lib/apkBuild.js writes them into the app as www/lib/theme.js (made per build, not in git) before
// Capacitor copies the app into the Android project. The app loads it in <head>: its colours set before the first paint,
// the phone's status / navigation bar icons dark on a light theme (mobile/www/app.js, Capacitor's SystemBars).
//
// The studio names a colour by its job, the app by its own names - the map (studio -> app):
//   ink (the background) -> --bg, panel -> --panel, panel-2 -> --panel-2, line -> --line, text -> --ink, dim -> --dim,
//   tiger (the accent) -> --tiger + --accent, ok -> --ok, bad -> --bad;  made from them: --on-tiger (black or white,
//   whichever reads on the accent), --accent-dim (the accent over the panel, your talk bubbles), --banner (the ⬆ Update bar)
//   clean(theme) -> {name, scheme, vars} | null   appVars(theme) -> {"--bg": …}   script(theme) -> the file's text
//   write(mobileDir, theme) -> {file, name, scheme} | {file, name: null} (no theme = the app's own look)    pure but write
"use strict";
const fs = require("fs");
const path = require("path");

const KEYS = ["ink", "panel", "panel-2", "line", "text", "dim", "tiger", "tiger-deep", "ok", "bad"];
const MAP = { ink: "--bg", panel: "--panel", "panel-2": "--panel-2", line: "--line", text: "--ink", dim: "--dim", tiger: "--tiger", ok: "--ok", bad: "--bad" };
const isHex = (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c.trim());
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (a) => "#" + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
/** a over b, f of a (pure) */
function mix(a, b, f) { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v * f + y[i] * (1 - f))); }
/** WCAG relative luminance (pure) */
function lum(h) { return rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0); }
function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
/** the text colour that reads on c: the app's dark brown or white, whichever has more contrast (pure) */
function onColor(c) { return contrast(c, "#1a1206") >= contrast(c, "#ffffff") ? "#1a1206" : "#ffffff"; }

/** what the studio page sent -> {name, scheme, vars} | null (nothing usable = the app's own look) (pure) */
function clean(t) {
  if (!t || typeof t !== "object") return null;
  const src = t.vars && typeof t.vars === "object" ? t.vars : {}, vars = {};
  for (const k of KEYS) { const v = src[k] != null ? src[k] : src["--" + k]; if (isHex(v)) vars[k] = String(v).trim().toLowerCase(); }
  for (const k of Object.keys(MAP)) if (!vars[k]) return null;            // every colour the app needs, or none at all
  const scheme = t.scheme === "light" ? "light" : t.scheme === "dark" ? "dark" : (lum(vars.ink) > 0.4 ? "light" : "dark");
  const name = String(t.name || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 60) || "your theme";
  return { name, scheme, vars };
}
/** the app's CSS variables (pure) */
function appVars(t) {
  const c = clean(t); if (!c) return null;
  const v = c.vars, o = {};
  for (const k of Object.keys(MAP)) o[MAP[k]] = v[k];
  o["--accent"] = v.tiger;
  o["--on-tiger"] = onColor(v.tiger);
  o["--accent-dim"] = mix(v.tiger, v.panel, 0.22);
  o["--banner"] = mix(v.tiger, v.panel, 0.14);
  return o;
}
/** www/lib/theme.js's text (pure) */
function script(t) {
  const c = clean(t);
  if (!c) return "/* bitGen app - the app's own look (no studio theme was sent with this build) - made per build, not in git */\nwindow.BG_THEME = null;\n";
  const css = appVars(c);
  return "/* bitGen app - bitGen Studio's theme \"" + c.name.replace(/\*\//g, "") + "\" (lib/apkTheme.js, made by 🔨 Build - not in git) */\n"
    + "window.BG_THEME = " + JSON.stringify({ name: c.name, scheme: c.scheme, css }) + ";\n"
    + "(function (t) { var s = document.documentElement.style; for (var k in t.css) s.setProperty(k, t.css[k]); s.colorScheme = t.scheme;\n"
    + "  var m = document.querySelector('meta[name=\"color-scheme\"]'); if (m) m.setAttribute(\"content\", t.scheme); })(window.BG_THEME);\n";
}
/** write mobile/www/lib/theme.js for this build */
function write(mobileDir, t) {
  const f = path.join(mobileDir, "www", "lib", "theme.js");
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, script(t));
  const c = clean(t);
  return c ? { file: f, name: c.name, scheme: c.scheme, accent: c.vars.tiger } : { file: f, name: null };
}

module.exports = { KEYS, MAP, clean, appVars, script, write, onColor, mix, contrast };
