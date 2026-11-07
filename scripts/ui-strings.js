#!/usr/bin/env node
/* bitGen Studio — scripts/ui-strings.js (2.705.0): EVERY WORD OF THE MAIN WINDOW, collected from the running app for the UI
 * translations (static/uilang.js). It opens the studio in a browser (English), opens the surfaces the main window has
 * (Settings and each of its tabs, the menus, Basic Settings, the dockers' menus), and lists each text / title / placeholder /
 * aria-label the translation layer would look up - split the same way (H3UiLang.split), the editors' dockers left out
 * (H3UiLang.SKIP) - with up to 3 places it was seen, for the translators.
 *   H3_URL=http://127.0.0.1:8311/ node scripts/ui-strings.js [out.json]     (default static/i18n/ui/strings.json)
 * Then: node scripts/i18n-ui.js status <lang> lists what a dictionary lacks; the translators fill it (docs/i18n/TRANSLATING.md).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const ROOT = path.join(__dirname, "..");
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
const OUT = process.argv[2] || path.join(ROOT, "static", "i18n", "ui", "strings.json");
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
(async () => {
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
  await b.close();
  const list = Object.keys(all).sort().map((s) => ({ s, kinds: all[s].kinds, where: all[s].where }));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ made: new Date().toISOString().slice(0, 10), count: list.length, strings: list }, null, 1) + "\n");
  console.log(`ui-strings: ${list.length} strings (${list.reduce((n, x) => n + x.s.length, 0)} characters) -> ${OUT}`);
})();
