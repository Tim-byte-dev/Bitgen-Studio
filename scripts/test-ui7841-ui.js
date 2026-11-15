#!/usr/bin/env node
/* bitGen Studio — 2.784.1 browser test: the Queue docker's Pending tab shows only queued + running generation cards, the
 * finished / failed / cancelled ones are on Done (Tim: "only show queued items in the current queue all done items in queue go
 * to the done tab"). Needs a running studio (H3_URL, default :8311 - H3_E2E=1). Stand-in cards only (nothing is rendered).
 */
"use strict";
let chromium; try { ({ chromium } = require("playwright")); } catch { chromium = null; }
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.784.1 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.784.1 browser test did not run"); process.exit(0); }
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => typeof GQ !== "undefined" && typeof paintQueue === "function" && document.getElementById("qtabDone"), null, { timeout: 30000 });
    await sleep(1500);
    const saved = await ev(() => { const keep = JSON.stringify(GQ.items); queuePaused = true;   // nothing starts while the stand-ins are there
      GQ.items = [{ id: "w1", status: GENQUEUE.WAITING, mode: "image", prompt: "a waiting one" }, { id: "d1", status: "done", mode: "image", prompt: "a finished one" },
        { id: "f1", status: "failed", mode: "video", prompt: "a failed one" }, { id: "w2", status: GENQUEUE.WAITING, mode: "video", prompt: "another waiting" }, { id: "c1", status: "cancelled", mode: "image", prompt: "a cancelled one" }];
      return keep; });
    const cards = () => ev(() => [...document.querySelectorAll("#genq .gq")].map((e) => e.className.replace("gq ", "")));
    await p.click("#qtabPending"); await sleep(600);
    let c = await cards();
    check("Pending: only the queued cards (no done / failed / cancelled)", c.length === 2 && c.every((x) => x === "waiting" || x === "run" || x === "queued" || /wait/.test(x)), c);
    check("…the Pending tab counts the queued cards", /Pending \(\d+\)/.test(await ev(() => document.getElementById("qtabPending").textContent)) && !(await ev(() => /Nothing waiting/.test(document.getElementById("jobs").textContent))));
    await p.click("#qtabDone"); await sleep(600);
    c = await cards();
    check("Done: the finished, failed and cancelled cards (with ↻ Regenerate)", c.sort().join() === "cancelled,done,failed" && (await ev(() => document.querySelectorAll("#genq .gq .gqbtn[title^='Regenerate']").length)) === 3, c);
    await ev((k) => { GQ.items = JSON.parse(k); queuePaused = false; paintQueue(); }, saved);
    await p.click("#qtabPending"); await sleep(300);
    check("no page errors", errs.length === 0, errs);
  } finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
