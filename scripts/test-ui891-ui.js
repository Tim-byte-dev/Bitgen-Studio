#!/usr/bin/env node
/* bitGen Studio — 2.891.0 in a REAL browser. ⊞ Docker layout ▸ 💾 Save layout says it saved (the message stays, ✓ Saved) and
 * keeps EVERY docker - the column's (the extensions' too), the floating windows with their status; dockers changed afterwards
 * come back as saved on ↺ Load it again (a minimized one minimized, a hidden one hidden, a maximized floating window maximized).
 * PAN 2: { } JSON writes the caption into the prompt box, Generate with plain words formats them first and sends the JSON.
 * ?safe-layout=1: the page's storage backed up + cleared, the page reloads clean and says where the backup is. Against the
 * running app (H3_URL). */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.DockCfg && DockCfg.started && window.SecFloat && SecFloat.windows && SecFloat.windows.basic, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await p.mouse.click(5, 600);                                   // the user's first press ends the boot's settling
    // ---- the layout to save: Music minimized, the timeline open, Basic Settings floating + maximized, an extension docker hidden
    const before = await ev(async () => {
      const col = (id) => document.getElementById(id);
      if (!col("musicdock").classList.contains("collapsed")) toggleCollapse("musicdock");
      if (col("timelinedock").classList.contains("dockgone")) toggleDockGone("timelinedock", "tT");
      if (col("timelinedock").classList.contains("collapsed")) toggleCollapse("timelinedock");
      SecFloat.show("basic", true); await new Promise((r) => setTimeout(r, 300)); SecFloat.maximize("basic", true);
      const ext = [...document.querySelectorAll("#maincol > .bdock[id]")].map((e) => e.id).find((id) => !DockCfg.BOTTOM.includes(id));
      return { ext, extHidden: ext ? col(ext).classList.contains("dockgone") : null };
    });
    await p.waitForTimeout(400);
    await ev(() => document.getElementById("dockCfgBtn").click());
    await p.waitForTimeout(300);
    await ev(() => document.getElementById("dockCfgSave").click());
    await p.waitForTimeout(1500);
    const saved = await ev(() => ({ msg: (document.getElementById("dockCfgMsg") || {}).textContent || "", btn: (document.getElementById("dockCfgSave") || {}).textContent || "",
      cfg: DockCfg.state(), key: DockCfg.openKey() }));
    check("💾 Save layout: the message STAYS (it was wiped by the panel's repaint) and the button says ✓ Saved", /💾 saved: /.test(saved.msg) && /dockers, \d+ floating windows/.test(saved.msg) && /✓ Saved/.test(saved.btn), saved.msg + " | " + saved.btn);
    const v = (((saved.cfg.configs || {})[saved.key] || {}).variants || [])[0] || {};
    check("...docker.cfg keeps every docker (an extension's too) with its status, Basic Settings maximized with its place", v.all && v.all.docks.musicdock.status === "minimized"
      && v.all.docks.timelinedock.status !== "minimized" && (!before.ext || !!v.all.docks[before.ext]) && v.all.floats.basic.status === "maximized" && v.all.floats.basic.w > 0, v.all);
    // ---- change everything, then Load it again
    await ev(async () => {
      if (document.getElementById("musicdock").classList.contains("collapsed")) toggleCollapse("musicdock");
      SecFloat.maximize("basic", false); SecFloat.show("basic", false);
      toggleCollapse("timelinedock");
    });
    await p.waitForTimeout(500);
    const changed = await ev(() => ({ music: DockCfg.statusOf(document.getElementById("musicdock").className), tl: DockCfg.statusOf(document.getElementById("timelinedock").className), basic: !!SecFloat.state("basic").shown }));
    const tlSaved = v.all.docks.timelinedock.status;
    // the saved row's Load (the set open now is another one - its own row is what the user picks)
    await ev((k) => { DockCfg.paint(); const b = document.querySelector('[data-dcapply="' + k + '"]'); if (b) b.click(); else DockCfg.openSet(k); }, saved.key);
    await p.waitForTimeout(1500);
    const after = await ev(() => ({ music: DockCfg.statusOf(document.getElementById("musicdock").className), tl: DockCfg.statusOf(document.getElementById("timelinedock").className),
      basic: !!SecFloat.state("basic").shown, basicMax: document.querySelector("#sf-basic, .sf-max") ? !!SecFloat.windows.basic.el.classList.contains("sf-max") : null }));
    check("↺ Load it again: Music back to minimized, the timeline open again, Basic Settings shown and maximized again",
      changed.music === "normal" && changed.basic === false && after.music === "minimized" && after.tl === tlSaved && after.basic === true && after.basicMax === true, { changed, after, tlSaved });
    await ev(() => { SecFloat.maximize("basic", false); SecFloat.show("basic", false); });
    // ---- PAN 2: { } JSON
    const cap = JSON.stringify({ video_style: "x", lighting: "y", perspective_view: "z", subjects_lifecycle: [], init_frame_visual_description: "a",
      events: [{ event_index: 0, time_range_sec: "0 to 10", event_description: "e", camera_motion: [{ time_range_sec: "0 to 10", camera_motion: ["static"] }], contained_actions: [] }],
      quality: { video_quality: "q", text_logos_overlays: null, artifacts: null } });
    const capSent = [], genSent = [];
    await p.route("**/api/pan2/caption", (route) => { capSent.push(route.request().postDataBuffer().toString("latin1")); route.fulfill({ json: { caption: cap, how: "llm", notes: ["the LLM wrote PAN 2's caption"], pretty: JSON.stringify(JSON.parse(cap), null, 2), seconds: 10 } }); });
    await p.route("**/api/pan2", (route) => { if (route.request().method() !== "POST") return route.continue(); genSent.push(route.request().postDataBuffer().toString("latin1")); route.fulfill({ json: { id: "fake891", status: "queued", notes: [] } }); });
    await p.route("**/api/jobs/fake891", (route) => route.fulfill({ json: { id: "fake891", status: "done", outputs: [] } }));
    await p.route("**/api/comfy/ensure", (route) => route.fulfill({ json: { ok: true, reachable: true } }));
    await p.route("**/api/comfy/status", (route) => route.fulfill({ json: { reachable: true } }));
    await ev(() => { const s = document.getElementById("videoStyleSel"); s.value = videoStyles.find((x) => x.arch === "pan2").id; s.dispatchEvent(new Event("change")); refs.length = 0; document.getElementById("prompt").value = "a red kite over a hill"; document.getElementById("seconds").value = "10"; });
    const fb = await ev(() => { const b = document.getElementById("pan2Fmt"); return b ? { hidden: b.hidden, text: b.textContent } : null; });
    check("PAN 2: the { } JSON button sits with the style select", fb && fb.hidden === false && /\{ \} JSON/.test(fb.text), fb);
    await ev(() => document.getElementById("pan2Fmt").click());
    await p.waitForTimeout(800);
    const box = await ev(() => document.getElementById("prompt").value);
    check("...{ } JSON sent the words (pretty asked) and put PAN 2's JSON caption, indented, in the prompt box", capSent.length === 1 && /a red kite over a hill/.test(capSent[0]) && /name="pretty"\r\n\r\n1/.test(capSent[0])
      && /^\{\n  "video_style": "x"/.test(box), { box: box.slice(0, 80), n: capSent.length });
    await ev(() => { document.getElementById("prompt").value = "a dog runs"; });
    await ev(() => generateFrom("video", "a dog runs"));
    await p.waitForTimeout(1000);
    const field = (body, k) => { const m = body.match(new RegExp(`name="${k}"\\r\\n\\r\\n([\\s\\S]*?)\\r\\n--`)); return m ? m[1] : null; };
    check("...Generate with plain words formats them first (the box shows the JSON) and sends the JSON to /api/pan2",
      capSent.length === 2 && genSent.length === 1 && /^\{/.test(String(field(genSent[0], "prompt")).trim()) && /"events"/.test(field(genSent[0], "prompt")) && /^\{/.test(await ev(() => document.getElementById("prompt").value)),
      { caps: capSent.length, gens: genSent.length, p: genSent[0] && field(genSent[0], "prompt").slice(0, 60) });
    // ---- ?safe-layout=1
    await ev(() => { localStorage.setItem("h3.g.timelinedock", "1"); localStorage.setItem("h3test891", "x"); localStorage.setItem("bg.helpLang", "ja"); });   // (the language is kept - the reloaded page may be in Japanese)
    await p.goto(URL_.replace(/\/?$/, "/") + "?safe-layout=1", { waitUntil: "commit" }).catch(() => null);   // the page stops itself and reloads clean
    await p.waitForFunction(() => /layout-reset|^\/$/.test(location.search + location.pathname) && typeof dsReady !== "undefined" && dsReady, null, { timeout: 60000 }).catch(() => null);
    await p.waitForTimeout(3500);
    const sr = await ev(() => ({ url: location.href, test: localStorage.getItem("h3test891"), g: localStorage.getItem("h3.g.timelinedock"), lang: localStorage.getItem("bg.helpLang"),
      note: (document.querySelector("#notedlg[open], dialog[open]") || {}).textContent || "" }));
    check("?safe-layout=1: the storage backed up then cleared (the language kept), the page reloaded clean and said where the backup is",
      sr.test === null && sr.g !== "1" && sr.lang === "ja" && !/safe-layout/.test(sr.url) && /backups[\\/]layout-auto-/.test(sr.note), sr);
    check("no page errors", errs.filter((e) => !/ResizeObserver/.test(e)).length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
