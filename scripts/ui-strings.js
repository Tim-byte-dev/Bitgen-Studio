#!/usr/bin/env node
/* bitGen Studio — scripts/ui-strings.js (2.705.0): EVERY WORD OF THE MAIN WINDOW, collected from the running app for the UI
 * translations (static/uilang.js). It opens the studio in a browser (English), opens the surfaces the main window has
 * (Settings and each of its tabs, the menus, Basic Settings, the dockers' menus), and lists each text / title / placeholder /
 * aria-label the translation layer would look up - split the same way (H3UiLang.split), what it skips left out
 * (H3UiLang.SKIP) - with up to 3 places it was seen, for the translators. 2.707.0: every docker too - each one's tabs,
 * tools, modes and menus picked in turn.
 *   H3_URL=http://127.0.0.1:8311/ node scripts/ui-strings.js [out.json]     (default static/i18n/ui/strings.json)
 * Then: node scripts/i18n-ui.js status <lang> lists what a dictionary lacks; the translators fill it (docs/i18n/TRANSLATING.md).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
const OUT = process.argv.slice(2).find((a) => !a.startsWith("--")) || path.join(ROOT, "static", "i18n", "ui", "strings.json");
/** 2.707.0: what is not a word to translate - readouts (sizes, levels, times, dates, counts), colour codes, and anything a
 * pattern the code makes already covers (static/i18n/ui/dynamic.json: "{0} - click = foreground, …") */
const READOUT = /^[\d\s.,:/%x×+\-–—()~≈<>]*(GB|MB|KB|TB|B|dB|px|s|ms|fps|MP|frames?|f|k|K|Hz|kHz|°|bit)?[\d\s.,:/%()]*$/;
function junk(s, pats) {
  if (READOUT.test(s) || /^\d{1,2}\/\d{1,2}\/\d{2,4},? /.test(s) || /^#?[0-9a-f]{6}$/i.test(s) || /^[\d.]+\s*\/\s*[\d.]+\s*GB$/i.test(s)) return true;
  // made by a pattern from a NUMBER / colour code ("3 failed", "00ff00 - click = …") - the pattern translates it; a pattern
  // filled with words ("Add character") keeps its own entry (a whole translation reads better)
  for (const c of pats || []) { if (s.indexOf(c.frag) < 0) continue; const m = c.re.exec(s); if (m && m.slice(1).every((v) => /^[\s\d.,:/%x×#+\-]*([0-9a-f]{6})?[\s\d.,:/%x×+\-]*$/i.test(v) && /\d/.test(v))) return true; }
  return false;
}
function patsNow() {
  const U = require(path.join(ROOT, "static", "uilang.js"));
  let d = null; try { d = JSON.parse(fs.readFileSync(path.join(ROOT, "static", "i18n", "ui", "dynamic.json"), "utf8")); } catch (e) { /* none yet */ }
  const o = {}; for (const x of (d && d.patterns) || []) o[x.p] = x.p; return U.compile(o);
}
function write(all, out) {
  const pats = patsNow();
  // what an earlier collection found stays (a word one run did not happen to show - an update notice - keeps its translation)
  if (!process.argv.includes("--fresh")) { try { for (const x of JSON.parse(fs.readFileSync(out, "utf8")).strings) if (!all[x.s]) all[x.s] = { kinds: x.kinds, where: x.where }; } catch (e) { /* first collection */ } }
  const list = Object.keys(all).sort().filter((s) => !junk(s, pats)).map((s) => ({ s, kinds: all[s].kinds, where: all[s].where }));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ made: new Date().toISOString().slice(0, 10), count: list.length, strings: list }, null, 1) + "\n");
  console.log(`ui-strings: ${list.length} strings (${list.reduce((n, x) => n + x.s.length, 0)} characters; ${Object.keys(all).length - list.length} readouts / pattern-made left out) -> ${out}`);
}
module.exports = { junk, READOUT };
const COLLECT = () => {
  const out = {}, SKIP = H3UiLang.SKIP, A = H3UiLang.ATTRS;
  const where = (el) => { if (!el) return ""; const id = el.id ? "#" + el.id : ""; const host = el.closest("[id]"); const c = (el.className && typeof el.className === "string") ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
    return el.tagName.toLowerCase() + id + c + (host && host !== el ? " in #" + host.id : ""); };
  const add = (raw, kind, el) => {
    if (!raw || !/[A-Za-z]{2}/.test(raw)) return;
    const core = H3UiLang.split(raw).core.trim();
    if (!core || core.length > 2000 || !/[A-Za-z]{2}/.test(core)) return;
    if (/^[\w.-]+\.(png|jpe?g|json|js|mp4|wav|safetensors|gguf)$/i.test(core) || /^https?:/.test(core)) return;
    const e = out[core] || (out[core] = { kinds: [], where: [] });
    if (!e.kinds.includes(kind)) e.kinds.push(kind);
    const w = where(el); if (w && e.where.length < 3 && !e.where.includes(w)) e.where.push(w);
  };
  const w = document.createTreeWalker(document.body, 5, null); let n;
  while ((n = w.nextNode())) {
    if (n.nodeType === 3) { const p = n.parentElement; if (p && !p.closest(SKIP)) add(n.nodeValue, "text", p); }
    else if (!n.closest(H3UiLang.SKIP_ATTR)) for (const a of A) { const v = n.getAttribute(a); if (v) add(v, a, n); }
  }
  return out;
};
if (require.main === module && process.argv.includes("--clean")) {            // the file again, cleaned (no browser)
  const j = JSON.parse(fs.readFileSync(OUT, "utf8")), all = {}; for (const x of j.strings) all[x.s] = { kinds: x.kinds, where: x.where };
  write(all, OUT); process.exit(0);
}
if (require.main === module) (async () => {
  const { chromium } = require("playwright");
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1600, height: 1000 }, locale: "en-US" });
  await p.goto(URL0); await p.waitForFunction(() => window.H3UiLang && document.getElementById("menubar"), null, { timeout: 30000 });
  await p.waitForTimeout(3000);
  const all = {};
  const merge = (o) => { for (const [k, v] of Object.entries(o)) { const e = all[k] || (all[k] = { kinds: [], where: [] }); v.kinds.forEach((x) => { if (!e.kinds.includes(x)) e.kinds.push(x); }); v.where.forEach((x) => { if (e.where.length < 3 && !e.where.includes(x)) e.where.push(x); }); } };
  merge(await p.evaluate(COLLECT));
  // Settings: every tab
  const tabs = await p.evaluate(async () => { const b = document.getElementById("openSettings"); if (b) b.click(); await new Promise((r) => setTimeout(r, 800)); return [...document.querySelectorAll("[data-stab], .stab, #settingsDlg [role=tab]")].length; });
  for (let i = 0; i < tabs; i++) { await p.evaluate(async (i) => { const t = [...document.querySelectorAll("[data-stab], .stab, #settingsDlg [role=tab]")][i]; if (t) t.click(); await new Promise((r) => setTimeout(r, 300)); }, i); merge(await p.evaluate(COLLECT)); }
  await p.keyboard.press("Escape");
  // the menu bar's menus + the dockers' ☰ menus
  const menus = await p.evaluate(() => [...document.querySelectorAll("#menubar button, .bhead button, .dmenu button, [aria-haspopup]")].length);
  for (let i = 0; i < Math.min(menus, 120); i++) {
    await p.evaluate(async (i) => { const m = [...document.querySelectorAll("#menubar button, .bhead button, .dmenu button, [aria-haspopup]")][i]; if (!m || m.closest(H3UiLang.SKIP) || /✕|close|delete|remove|reset|clear|🗑/i.test((m.title || "") + m.textContent)) return; try { m.click(); } catch (e) { /* fine */ } await new Promise((r) => setTimeout(r, 150)); }, i).catch(() => {});
    merge(await p.evaluate(COLLECT).catch(() => ({})));
    await p.keyboard.press("Escape").catch(() => {});
  }
  // 2.707.0 (Tim: "ok, i guess we can do the dockers next"): the dockers - the Sketcher / SolidCraft opened, and inside every
  // docker each tab, tool, mode and menu clicked in turn (what each shows is built when it is picked)
  for (const t of ["tX_pushpulldock", "tX_solidcraftdock"]) { await p.evaluate((t) => { const b = document.getElementById(t); if (b && !b.classList.contains("sc-absent")) b.click(); }, t).catch(() => {}); await p.waitForTimeout(1500); }
  merge(await p.evaluate(COLLECT).catch(() => ({})));
  const PICK = "[data-tab], [data-tool], .ietool, [data-menu], [data-mode], .cbtab, [data-t3view], [data-t3mode], [data-cstab], [data-ectab], [data-sbview], .chTab, .sc-tool, [role=tab], .pctabs button";
  for (const dock of ["imageeditdock", "timelinedock", "pushpulldock", "solidcraftdock", "videodock", "promptdock", "musicdock", "sfxdock", "stemsdock", "previewdock", "chatdock", "comfydock", "consoledock"]) {
    const n = await p.evaluate(([d, sel]) => { const el = document.getElementById(d); return el ? el.querySelectorAll(sel).length : 0; }, [dock, PICK]);
    for (let i = 0; i < Math.min(n, 160); i++) {
      await p.evaluate(async ([d, sel, i]) => { const el = [...document.getElementById(d).querySelectorAll(sel)][i]; if (!el || /✕|close|delete|remove|clear|reset/i.test(el.textContent + " " + (el.title || ""))) return;
        try { el.click(); } catch (e) { /* next */ } await new Promise((r) => setTimeout(r, 120)); }, [dock, PICK, i]).catch(() => {});
      merge(await p.evaluate(COLLECT).catch(() => ({})));
      await p.keyboard.press("Escape").catch(() => {});
    }
    console.log(`ui-strings: ${dock} - ${n} tabs / tools / menus opened, ${Object.keys(all).length} strings so far`);
  }
  await b.close();
  write(all, OUT);
})();
