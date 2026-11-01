#!/usr/bin/env node
/* bitGen Studio — 2.636.0 (pure + wiring): Ctrl+Alt+S OPENS SETTINGS; THE BUILT-IN "bitGen Default" THEME TO GO BACK TO
 * (Ctrl+Alt+Shift+T, ?theme=default, Settings ▸ Themes). static/safetheme.js, lib/themeStore.js, static/themes.js.
 * Tim: "can you add ctrl+alt+s to open settings dialog, my settings button vanished. create a default theme that i can
 * revert to in case a theme malfunctions" */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const R0 = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (p) => fs.readFileSync(path.join(R0, p), "utf8");
const ST = require(path.join(R0, "static", "safetheme.js"));
const k = (o) => Object.assign({ ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, key: "", code: "" }, o);

check("Ctrl+Alt+S opens Settings (key or code); not with Shift / Meta / without Alt", ST.isOpenKey(k({ ctrlKey: true, altKey: true, key: "s", code: "KeyS" })) && ST.isOpenKey(k({ ctrlKey: true, altKey: true, key: "S", code: "KeyS" }))
  && !ST.isOpenKey(k({ ctrlKey: true, altKey: true, shiftKey: true, key: "S", code: "KeyS" })) && !ST.isOpenKey(k({ ctrlKey: true, key: "s", code: "KeyS" })) && !ST.isOpenKey(k({ ctrlKey: true, altKey: true, metaKey: true, key: "s", code: "KeyS" })));
check("…an AltGr layout's own letter on S (ś) is left alone", !ST.isOpenKey(k({ ctrlKey: true, altKey: true, key: "ś", code: "KeyS" })));
check("Ctrl+Alt+Shift+T = bitGen Default", ST.isResetKey(k({ ctrlKey: true, altKey: true, shiftKey: true, key: "T", code: "KeyT" })) && !ST.isResetKey(k({ ctrlKey: true, altKey: true, key: "t", code: "KeyT" })));
check("?theme=default / #theme=default / ?safe-theme in the address - not other themes", ST.wantsReset("?theme=default", "") && ST.wantsReset("?a=1&theme=default", "") && ST.wantsReset("", "#theme=default") && ST.wantsReset("?safe-theme", "") && !ST.wantsReset("?theme=dark", "") && !ST.wantsReset("", ""));

/* the reset / restore against a fake browser */
const store = {}, root = globalThis;
root.localStorage = { getItem: (x) => (x in store ? store[x] : null), setItem: (x, v) => { store[x] = String(v); }, removeItem: (x) => { delete store[x]; } };
let chosen = null, styles = null, scale = null;
root.H3Theme = { choose: (t, a, v, n) => { chosen = { t, a, v, n }; }, current: () => ({ theme: store["h3.theme"] || "dark", accent: store["h3.accent"] || "", vars: JSON.parse(store["h3.themeVars"] || "{}"), name: store["h3.themeName"] || "" }) };
root.H3ThemeEdit = { setStyles: (m) => { styles = m; } };
root.applyUiScale = (v) => { scale = v; };
Object.assign(store, { "h3.theme": "slate", "h3.accent": "#ff0000", "h3.themeVars": '{"panel":"#000000"}', "h3.themeName": "Broken", "h3.themeStyles": '{"#openSettings":{"color":"#000000"}}', "h3.scale": "150" });
const was = ST.reset({ quiet: true });
check("reset: Dark, no accent, no own colours, no element styles, UI size 100 %, named bitGen Default", chosen && chosen.t === "dark" && chosen.a === "" && Object.keys(chosen.v).length === 0 && chosen.n === "bitGen Default"
  && styles && Object.keys(styles).length === 0 && scale === 100 && !store["h3.themeStyles"] && !store["h3.accent"] && store["h3.themeName"] === "bitGen Default", { chosen, styles, scale, store });
const bk = JSON.parse(store["h3.themeBackup"] || "{}");
check("…the theme before is kept (h3.themeBackup)", was.theme === "slate" && bk.theme === "slate" && bk.themeName === "Broken" && /openSettings/.test(bk.themeStyles) && bk.scale === "150" && ST.hasBackup());
ST.reset({ quiet: true });
check("a second reset does not lose it (the default is not backed up over it)", JSON.parse(store["h3.themeBackup"]).themeName === "Broken");
ST.restore();
check("↶ The theme before: all of it back (the styles too); ↶ again = the default", store["h3.theme"] === "slate" && store["h3.accent"] === "#ff0000" && store["h3.themeName"] === "Broken" && styles && styles["#openSettings"] && scale === 150 && JSON.parse(store["h3.themeBackup"]).themeName === "bitGen Default");

/* the store */
const TS = require(path.join(R0, "lib", "themeStore.js"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "st636_")); TS.setBase(tmp);
TS.save("Mine", { base: "light", vars: { panel: "#ffffff" } });
const L = TS.list();
check("themes/: the built-in bitGen Default is always first (Dark's colours, no styles, 100 %), then the saved ones", L[0].name === "bitGen Default" && L[0].builtin && L[0].base === "dark" && L[0].scale === 100 && Object.keys(L[0].styles).length === 0 && L[0].vars.tiger === "#f59e2c" && L[1].name === "Mine", L.map((t) => t.name));
let e1 = "", e2 = ""; try { TS.save("bitGen Default", { vars: { ink: "#000000" } }); } catch (e) { e1 = e.message; } try { TS.remove("BITGEN DEFAULT"); } catch (e) { e2 = e.message; }
check("…it cannot be overwritten or deleted (any case); read() gives it", /built in/.test(e1) && /built in/.test(e2) && TS.read("bitgen default").builtin && !fs.existsSync(path.join(tmp, "themes", "bitGen Default.json")), { e1, e2 });
fs.rmSync(tmp, { recursive: true, force: true });

/* the wiring */
const IX = read("static/index.html"), TH = read("static/themes.js"), SC = JSON.parse(read("docs/shortcuts.json")), SF = read("static/safetheme.js");
check("index.html loads static/safetheme.js in <head> right after themes.js (?theme=default before the first paint)", /<script src="\/static\/themes\.js"><\/script>[^\n]*\n<script src="\/static\/safetheme\.js"><\/script>/.test(IX) && IX.indexOf("/static/safetheme.js") < IX.indexOf("</head>"));
check("Settings ▸ Themes: ⟲ bitGen Default + ↶ The theme before (shown when there is one) + the keys", /id="s_thdefault"/.test(IX) && /id="s_thbefore"/.test(IX) && /Ctrl\+Alt\+S opens Settings/.test(IX));
check("the saved themes: the built-in card has no ✕ and puts the default on through H3SafeTheme.reset", /t\.builtin \? "" :/.test(TH) && /H3SafeTheme \? root\.H3SafeTheme\.reset\(\)/.test(TH));
const rows = [].concat(...SC.groups.map((g) => g.rows)).map((r) => r[0]);
check("the shortcuts list: Ctrl+Alt+S and Ctrl+Alt+Shift+T", rows.includes("Ctrl+Alt+S") && rows.includes("Ctrl+Alt+Shift+T"));
check("the keys are caught first (capture) and work while typing; window.openSettings for the other docks", /addEventListener\("keydown", onKey, true\)/.test(SF) && /root\.openSettings = openSettings/.test(SF));

console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
