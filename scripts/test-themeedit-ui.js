#!/usr/bin/env node
/* bitGen Studio — 2.443.0 in a REAL browser: 🖌 EDIT THEME MODE (static/themeedit.js). Tim: "go into edit theme mode when
 * the style a button button is toggled so user can style any element including buttons interactively. when it is
 * toggled again app will go into live mode. the edit theme mode will interact with the visible elements on screen" -
 * "each button's can be edited including icons, icon position, icon size, icon fill, text size, font, text shadow,
 * button shadow".
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. SHOTS=<dir> keeps pictures. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the edit theme mode browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const SHOTS = process.env.SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 950 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  const shot = async (n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + ".png") }); };
  const tname = "zzte" + process.pid;
  const setv = (id, v) => ev(([id, v]) => { const x = document.getElementById(id); x.value = v; x.dispatchEvent(new Event(x.tagName === "SELECT" ? "change" : "input", { bubbles: true })); }, [id, v]);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3ThemeEdit && document.getElementById("thEditBtn"), null, { timeout: 60000 });
    await ev(() => window.H3ThemeEdit.setStyles({}));
    await p.waitForTimeout(500);
    const place = await ev(() => document.getElementById("openSettings").nextElementSibling.id);
    check("🖌 sits in the top bar next to ⚙", place === "thEditBtn", place);

    /* 1 edit theme mode: a click on ⚙ picks it (Settings does NOT open), the Style panel opens next to it */
    await p.click("#thEditBtn"); await p.waitForTimeout(200);
    await p.hover("#openSettings"); await p.waitForTimeout(100);
    const hov = await ev(() => { const h = document.getElementById("thEditHi"), r = document.getElementById("openSettings").getBoundingClientRect(), hr = h.getBoundingClientRect(); return { shown: h.style.display === "block", near: Math.abs(hr.left - r.left) < 6 && Math.abs(hr.width - r.width) < 8 }; });
    await p.click("#openSettings"); await p.waitForTimeout(300);
    const e1 = await ev(() => ({ on: window.H3ThemeEdit.isOn(), body: document.body.classList.contains("h3-thedit"), btn: document.getElementById("thEditBtn").classList.contains("on"), settings: document.getElementById("settings").open,
      panel: !!document.getElementById("thEditPanel"), title: (document.querySelector("#thEditPanel .th b") || {}).textContent, scope: document.getElementById("teScope") && document.getElementById("teScope").value }));
    check("🖌 = EDIT THEME MODE: the element under the pointer is outlined; a click on ⚙ picks it - Settings does not open - and the Style panel shows it (Apply to: this element)",
      hov.shown && hov.near && e1.on && e1.body && e1.btn && !e1.settings && e1.panel && /openSettings/.test(e1.title || "") && e1.scope === "#openSettings", { hov, e1 });
    await shot("1-picked");

    /* 2 text size, colour, text shadow, button shadow - live on the element */
    await setv("teSize", "22"); await setv("teColor", "#ff0000"); await setv("teTsX", "2"); await setv("teBsB", "9"); await p.waitForTimeout(150);
    const cs = await ev(() => { const c = getComputedStyle(document.getElementById("openSettings")); return { fs: c.fontSize, col: c.color, ts: c.textShadow, bs: c.boxShadow }; });
    check("...text size 22, colour red, a text shadow, a button shadow: on ⚙ at once", cs.fs === "22px" && cs.col === "rgb(255, 0, 0)" && cs.ts !== "none" && /9px/.test(cs.bs), cs);

    /* 3 the icon: a new one, on the right, its size and fill - the button's words stay what they were */
    await setv("teIcText", "★"); await setv("teIcPos", "right"); await setv("teIcSize", "18"); await setv("teIcFill", "#00ff00"); await p.waitForTimeout(250);
    const ic = await ev(() => { const el = document.getElementById("openSettings"), s = el.querySelector(".h3ic"), a = s && getComputedStyle(s, "::after"); return { wrapped: el.classList.contains("h3icon") && !!s, txt: el.textContent, dir: getComputedStyle(el).flexDirection, after: a && a.content, size: a && a.fontSize, shadow: a && a.textShadow }; });
    check("...the icon: replaced by ★, to the right, 18 px, filled green; ⚙'s textContent unchanged", ic.wrapped && ic.txt === "⚙" && ic.dir === "row-reverse" && /★/.test(ic.after || "") && ic.size === "18px" && /0, 255, 0/.test(ic.shadow || ""), ic);
    await shot("2-styled");

    /* 4 all like it: a ghost button in the top bar, the rule for every button.ghost */
    const other = await ev(() => { const b2 = [...document.querySelectorAll("button.ghost")].find((x) => x.id !== "openSettings" && x.id !== "thEditBtn" && x.offsetParent && x.getBoundingClientRect().top < 40); b2.id = b2.id || "zzTeOther"; return b2.id; });
    await p.click("#" + other); await p.waitForTimeout(250);
    const opts = await ev(() => [...document.getElementById("teScope").options].map((o) => o.value));
    await setv("teScope", "button.ghost"); await p.waitForTimeout(150);
    await setv("teWeight", "800"); await setv("teRadius", "12"); await p.waitForTimeout(200);
    const all = await ev(() => { const bs = [...document.querySelectorAll("button.ghost")].filter((x) => !x.closest("#thEditPanel")); return { n: bs.length, heavy: bs.filter((x) => getComputedStyle(x).fontWeight === "800").length, r: getComputedStyle(bs[0]).borderTopLeftRadius }; });
    check("Apply to ▸ all like it (button.ghost): every ghost button bolder with round corners (the choices: this one, in its panel, all like it, every button)", opts.includes("button.ghost") && opts.includes("button") && all.n > 3 && all.heavy === all.n && all.r === "12px", { opts, all });

    /* 5 a dialog on top WORKS (2.455.0 - Tim: dialogs are not edited in theme edit mode, they work): its button's click
     *   reaches it and nothing is picked; Esc closes the panel / ends the mode as before */
    await ev(() => window.H3ThemeEdit.toggle(false, { force: true }));   // 2.514.0: no leaving box here
    await ev(() => { const d = document.createElement("dialog"); d.id = "zzTeDlg"; d.innerHTML = '<p>test</p><button id="zzTeDb" type="button">✓ OK</button>'; document.body.appendChild(d); d.querySelector("#zzTeDb").onclick = () => { window.__zzOk = (window.__zzOk || 0) + 1; }; d.showModal(); });
    await ev(() => window.H3ThemeEdit.toggle(true)); await p.click("#zzTeDb"); await p.waitForTimeout(250);
    const dl = await ev(() => ({ clicked: window.__zzOk || 0, panel: !!document.getElementById("thEditPanel"), open: document.getElementById("zzTeDlg").open, on: window.H3ThemeEdit.isOn() }));
    check("in a modal dialog with the mode on: its button WORKS (its own click ran), it is not picked (no Style panel), the mode stays on", dl.clicked === 1 && !dl.panel && dl.open && dl.on, dl);
    await ev(() => document.getElementById("zzTeDlg").close());
    await p.click("#openSettings").catch(() => {}); await p.waitForTimeout(200);
    const pk = await ev(() => !!document.getElementById("thEditPanel"));
    await p.keyboard.press("Escape"); await p.waitForTimeout(100);
    const esc1 = await ev(() => ({ panel: !!document.getElementById("thEditPanel"), on: window.H3ThemeEdit.isOn() }));
    await p.keyboard.press("Escape"); await p.waitForTimeout(100);
    await p.click("#thxLater").catch(() => {}); await p.waitForTimeout(150);   // 2.514.0: changes made -> the leaving box: Not now (keep them showing)
    const esc2 = await ev(() => window.H3ThemeEdit.isOn());
    check("Esc closes the panel, Esc again = live mode", pk && !esc1.panel && esc1.on && !esc2, { pk, esc1, esc2 });
    await ev(() => document.getElementById("zzTeDlg").remove());

    /* 6 live mode: clicks work again; the styles stay */
    await p.click("#openSettings");
    await p.waitForFunction(() => document.getElementById("settings").open, null, { timeout: 8000 }).catch(() => {});
    const live = await ev(() => ({ settings: document.getElementById("settings").open, fs: getComputedStyle(document.getElementById("openSettings")).fontSize }));
    check("LIVE mode: ⚙ opens Settings again; the styles stay", live.settings && live.fs === "22px", live);

    /* 7 Settings ▸ Themes: the rules listed; 💾 Save theme keeps them in themes/<name>.json; ↺ Clear; loading brings them back */
    await ev(() => { if (typeof switchStab === "function") switchStab("themes"); });
    await p.waitForTimeout(200);
    const rules = await ev(() => [...document.querySelectorAll("#s_thstyles code")].map((c) => c.textContent));
    await p.fill("#s_thname", tname); await p.click("#s_thsave"); await p.waitForTimeout(700);
    const file = path.join(ROOT, "themes", tname + ".json");
    let rec = null; try { rec = JSON.parse(fs.readFileSync(file, "utf8")); } catch { rec = null; }
    if (!rec) { try { rec = await (await fetch(URL_ + "api/themes/" + tname)).json(); } catch { rec = null; } }
    check("Settings ▸ Themes lists the element rules; 💾 Save theme writes them into themes/<name>.json (styles)", rules.includes("#openSettings") && rules.includes("button.ghost") && rec && rec.styles && rec.styles["#openSettings"] && rec.styles["#openSettings"].icon.text === "★", { rules, rec: rec && rec.styles });
    await p.click("#s_thstylesclear"); await p.waitForTimeout(200);
    const cleared = await ev(() => ({ n: Object.keys(window.H3ThemeEdit.styles()).length, fs: getComputedStyle(document.getElementById("openSettings")).fontSize, wrapped: !!document.querySelector("#openSettings .h3ic"), txt: document.getElementById("openSettings").textContent }));
    await p.click(`[data-th-load="${tname}"]`); await p.waitForTimeout(400);
    const loaded = await ev(() => ({ n: Object.keys(window.H3ThemeEdit.styles()).length, fs: getComputedStyle(document.getElementById("openSettings")).fontSize }));
    check("↺ Clear element styles: none (⚙ as it was, unwrapped); loading the saved theme brings them back", cleared.n === 0 && cleared.fs !== "22px" && !cleared.wrapped && cleared.txt === "⚙" && loaded.n === 2 && loaded.fs === "22px", { cleared, loaded });
    await ev(() => document.getElementById("settings").close());

    /* 8 kept in this browser: after a reload, on before the app runs */
    await p.reload({ waitUntil: "domcontentloaded" });
    const early = await ev(() => ({ sheet: !!document.getElementById("h3ThemeStyles") && /#openSettings/.test(document.getElementById("h3ThemeStyles").textContent) }));
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && document.getElementById("thEditBtn"), null, { timeout: 60000 });
    await p.waitForTimeout(400);
    const after = await ev(() => ({ fs: getComputedStyle(document.getElementById("openSettings")).fontSize, wrapped: !!document.querySelector("#openSettings .h3ic") }));
    check("a reload: the element styles are on the page from <head> (before the app paints), the icon wrapped again", early.sheet && after.fs === "22px" && after.wrapped, { early, after });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally {
    try { await ev(() => { window.H3ThemeEdit.toggle(false); window.H3ThemeEdit.setStyles({}); }); } catch { /* closed */ }
    try { await fetch(URL_ + "api/themes/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: tname }) }); } catch { /* gone */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
