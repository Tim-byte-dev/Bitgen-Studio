#!/usr/bin/env node
/* bitGen Studio — 2.747.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311).
 * Tim (verbatim): "the image and video styles are not showing, make local default, minimize the gpu menu item in basic
 * settings, put gpu menu item above overide checkbox ... previous version would not let me update inapp" ("failed to fetch")
 *   - Basic Settings ▸ GPU: the first thing in Basic Settings (above Override style), closed, "GPU · Local" in its header;
 *     opened it stays open after a reload; Local is the first choice;
 *   - Remote with no remote (R_) style: the image list's last line says so and how to fix it; Local lists them all again;
 *   - Settings ▸ General ▸ Updates: a check the studio stops answering says "bitGen Studio stopped answering", not just
 *     the browser's "Failed to fetch".
 * Put back afterwards. No server / no Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.747.0 browser test did not run"); process.exit(0); }
const fs = require("fs");
const SDIR = path.join(__dirname, "..", "styles", "image"), PARK = fs.mkdtempSync(path.join(require("os").tmpdir(), "ui747-")), parked = [];
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b) => fetch(URL0 + p.replace(/^\//, ""), b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined).then((r) => r.json());

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.747.0 browser test did not run"); process.exit(0); }
  const v0 = await api("/api/remotegpu"), g0 = await api("/api/gpusplit"), c0 = await api("/api/config");
  await api("/api/gpusplit", { where: "local" });
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
    const p = await ctx.newPage();
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    const ready = async () => { await p.waitForFunction(() => window.H3GpuSplit && H3GpuSplit.state().v && window.H3RpStyles && H3RpStyles.state().map && document.getElementById("styleSel").options.length > 1, null, { timeout: 30000 }); await sleep(700); };
    await p.goto(URL0); await ready();
    const sec = () => ev(() => {
      const h = document.querySelector('h2.sec.drop[data-sec="gpu"]'), body = document.getElementById("sec-gpu"), basic = document.getElementById("sec-basic"), ovr = document.getElementById("ovrStyle");
      return { inBasic: basic.contains(h), first: basic.firstElementChild === h || [...basic.children].find((e) => e.tagName !== "SCRIPT") === h, above: !!(h.compareDocumentPosition(ovr) & Node.DOCUMENT_POSITION_FOLLOWING),
        closed: body.classList.contains("closed") && getComputedStyle(body).display === "none", head: h.textContent.replace(/\s+/g, " ").trim(),
        radios: [...document.querySelectorAll('input[name="gpuWhere"]')].map((i) => i.value + (i.checked ? "*" : "")) };
    });
    let s = await sec();
    check("Basic Settings ▸ GPU: the first thing in Basic Settings, above Override style; closed; its header says \"GPU · Local\"", s.inBasic && s.first && s.above && s.closed && s.head === "▾GPU · Local", s);
    check("…Local is the first choice and the one picked", s.radios.join() === "local*,remote,both", s.radios);
    await p.click('h2.sec.drop[data-sec="gpu"]'); await sleep(200);
    await p.reload(); await ready();
    s = await sec();
    check("opened, it stays open after a reload (remembered like the other sections)", !s.closed, s);

    // Remote with no remote styles (2.749.0: the ready-made R_ starters moved out of the styles folder for this part, put back after)
    for (const f of fs.readdirSync(SDIR).filter((f) => /^R_.*\.json$/.test(f))) { fs.renameSync(path.join(SDIR, f), path.join(PARK, f)); parked.push(f); }
    await api("/api/remotegpu/save", { runpod: { key: "rpa_UI747" }, serverless: { endpoint: "epui747", comfy: "0.34.0", show_all: false } });
    await api("/api/remotegpu/use", { mode: "serverless" });          // Remote GPU's Use it -> Basic Settings ▸ GPU Remote
    await p.reload(); await ready();
    const note = () => ev(() => { const s = document.getElementById("styleSel"); const n = [...s.options].find((o) => o.dataset.rpsl === "note"); return { note: n ? n.textContent : "", shown: [...s.options].filter((o) => o.value && !o.hidden && o.dataset.rpsl !== "note").length }; });
    let n = await note();
    s = await sec();
    check("Remote with no remote (R_) style: the image list's last line says so and how to fix it; the header says Remote",
      n.shown === 0 && n.note === "☁ No remote styles: Basic Settings ▸ GPU is on Remote - set it to Local, or a style's Runs on to Remote GPU" && s.head === "▾GPU · Remote", { n, head: s.head });
    await p.check('input[name="gpuWhere"][value="local"]'); await sleep(1400);
    n = await note();
    check("…Local: every style for this computer listed again, no note; header Local", n.shown > 3 && !n.note && (await sec()).head === "▾GPU · Local", n);
    await p.click('h2.sec.drop[data-sec="gpu"]'); await sleep(150);
    check("…closed again by its header", (await sec()).closed);

    // Updates: the studio stops answering the check
    await p.route("**/api/update/check", (r) => r.abort("connectionreset"));
    await ev(() => { document.getElementById("openSettings").onclick(); document.querySelector('#settings .stabs [data-stab="general"]').click(); });
    await sleep(300);
    await ev(() => document.getElementById("upCheck").click());
    await p.waitForFunction(() => /^✗/.test(document.getElementById("upMsg").textContent), null, { timeout: 8000 }).catch(() => {});
    const um = await ev(() => document.getElementById("upMsg").textContent);
    check("Settings ▸ General ▸ Updates: a check the studio stops answering says \"bitGen Studio stopped answering … Try again\"", /^✗ bitGen Studio stopped answering \(.+\) - is it still running\? Try again in a moment$/.test(um), um);
    await p.unroute("**/api/update/check");
    check("no page errors", errs.length === 0, errs);
    await ctx.close();
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    for (const f of parked) { try { fs.renameSync(path.join(PARK, f), path.join(SDIR, f)); } catch { /* next */ } }
    await b.close();
    await api("/api/remotegpu/use", { mode: "local" }).catch(() => {});
    await api("/api/remotegpu/save", { runpod: { key: (v0.runpod || {}).key || "" }, serverless: Object.assign({ endpoint: "", cost_hr: 0, comfy: "0.34.0", show_all: false }, v0.serverless || {}) }).catch(() => {});
    await api("/api/gpusplit", { where: "local", llm: !!g0.llm, vlm: !!g0.vlm, image: !!g0.image, video: !!g0.video }).catch(() => {});
    if ((c0.engine || {}).comfy) await api("/api/config", { engine: { comfy: { url: c0.engine.comfy.url, autostart: c0.engine.comfy.autostart } } }).catch(() => {});
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
