#!/usr/bin/env node
/* bitGen Studio — 2.722.0 in a REAL browser: Settings ▸ ComfyUI ▸ "Free it: when the model changes / before every generation".
 * Tim: "if render queue is using the same model don't unload vram until model is changed (will this keep adding to vram?"
 *   the dropdown right under "Free VRAM before a generation", "when the model changes" first and picked by default, its
 *   tooltip answers the question (one copy, reused, freed when needed, after out of memory anyway); Save writes
 *   engine.comfy.free_vram, opening Settings again shows it; put back after. The workers' side: test-vramkeep722.py.
 * Against the running app (H3_URL, default :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the VRAM setting browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const cfg0 = await api("/api/config");
  const was = ((cfg0.engine || {}).comfy || {}).free_vram;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const openComfy = async () => { await ev(() => { document.getElementById("settings").showModal(); document.querySelector('[data-stab="comfy"]').click(); }); await p.waitForTimeout(400); };
  try {
    await api("/api/config", { engine: { comfy: { free_vram: "change" } } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && document.getElementById("s_cfreewhen"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await openComfy();
    const ui = await ev(() => { const s = document.getElementById("s_cfreewhen"), c = document.getElementById("s_cfree"); const lab = s.closest("label");
      return { shown: s.offsetParent !== null, v: s.value, opts: [...s.options].map((o) => o.value + ":" + o.textContent), lab: lab.textContent.trim().split("\n")[0].trim(), tip: lab.title,
        after: !!(c.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING), chk: c.closest("label").textContent.trim() }; });
    check("Settings ▸ ComfyUI: 'Free VRAM before a generation' then 'Free it' - when the model changes (picked) / before every generation",
      ui.shown && ui.after && /^Free VRAM before a generation/.test(ui.chk) && ui.lab === "Free it" && ui.v === "change"
      && ui.opts.join("|") === "change:when the model changes|always:before every generation", ui);
    check("…its tooltip answers 'will this keep adding to VRAM?': one copy, reused, freed when needed, after out of memory anyway",
      /does not pile up/.test(ui.tip) && /holds one copy and reuses it/.test(ui.tip) && /out-of-memory error the next render frees the card anyway/.test(ui.tip), ui.tip);
    await ev(() => { document.getElementById("s_cfreewhen").value = "always"; });
    await p.click("#s_save"); await p.waitForTimeout(900);
    let c = await api("/api/config");
    check("Save: engine.comfy.free_vram = always (the switch stays on)", c.engine.comfy.free_vram === "always" && c.engine.comfy.free_before_gen !== false, c.engine.comfy);
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && document.getElementById("s_cfreewhen"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await openComfy();
    check("…opened again: 'before every generation'", (await ev(() => document.getElementById("s_cfreewhen").value)) === "always");
    await ev(() => { document.getElementById("s_cfreewhen").value = "change"; });
    await p.click("#s_save"); await p.waitForTimeout(900);
    c = await api("/api/config");
    check("…and back to 'when the model changes'", c.engine.comfy.free_vram === "change", c.engine.comfy.free_vram);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("the run finished", false, String(e && e.stack || e)); }
  finally {
    try { await api("/api/config", { engine: { comfy: { free_vram: was || "change" } } }); } catch { /* best effort */ }
    try { await b.close(); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
