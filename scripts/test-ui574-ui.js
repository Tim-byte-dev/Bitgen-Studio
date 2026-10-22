#!/usr/bin/env node
/* bitGen Studio — 2.574.0 in a REAL browser: theme edit mode renames a docker (its title bar picked: Text open with its
 * title, aimed at THAT docker; "Music Video" typed -> "▾ Music Video", the 📌 / ⛶ buttons kept; a collapse keeps it;
 * ↺ Clear brings "StoryBoard" back) and "step n of total" (H3Steps.watch on a stubbed running job; awaitJob tells the
 * page every poll - h3:jobtick).
 * Tim: "in theme edit mode, allow me to change the headings of dockers and all selected text. show step number of steps
 * for all generations(image,music,video) in all places that show it". Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.574.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3ThemeEdit && window.H3Steps && document.querySelector("#videodock > .bhead"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    const own = () => ev(() => [...document.querySelector("#videodock > .bhead").childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join("").trim());
    const t0 = await own();
    await ev(() => { window.H3ThemeEdit.setStyles({}, true); window.H3ThemeEdit.pick(document.querySelector("#videodock > .bhead")); });
    await p.waitForSelector("#thEditPanel #teText", { timeout: 10000 });
    const pn = await ev(() => { const t = document.getElementById("teText"); return { dis: t.disabled, ph: t.placeholder, scope: window.H3ThemeEdit.scope(), sel: document.getElementById("teScope").value }; });
    check("theme edit: the StoryBoard's title bar picked - Text open with its title, aimed at THIS docker (#videodock div.bhead)",
      !pn.dis && /StoryBoard/.test(pn.ph) && pn.scope === "#videodock div.bhead", { pn, t0 });
    await ev(() => { const t = document.getElementById("teText"); t.value = "Music Video"; t.dispatchEvent(new Event("input", { bubbles: true })); });
    await p.waitForTimeout(300);
    const h1 = await ev(() => { const h = document.querySelector("#videodock > .bhead"); return { own: [...h.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join("").trim(), pin: !!h.querySelector(".pinbtn"), btns: h.querySelectorAll("button").length,
      other: [...document.querySelector("#musicdock > .bhead").childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join("").trim() }; });
    check("typed \"Music Video\": the title bar says ▾ Music Video, its 📌 and buttons kept; the Music docker's title untouched",
      /^[▾▸] Music Video$/.test(h1.own) && h1.pin && h1.btns >= 2 && /Music/.test(h1.other) && !/Video/.test(h1.other), h1);
    await ev(() => window.H3ThemeEdit.toggle(false, { force: true }));
    await ev(() => document.querySelector("#videodock > .bhead").click());
    await p.waitForTimeout(400);
    const c1 = await own();
    await ev(() => document.querySelector("#videodock > .bhead").click());
    await p.waitForTimeout(400);
    const c2 = await own();
    check("live mode: a collapse and an open keep the new title (▸ Music Video, ▾ Music Video)", c1 === "▸ Music Video" && c2 === "▾ Music Video", [c1, c2]);
    await ev(() => window.H3ThemeEdit.setStyles({}, true));
    await p.waitForTimeout(300);
    const c3 = await own();
    check("the rule cleared: StoryBoard is back", /^[▾▸] StoryBoard$/.test(c3), c3);

    /* steps */
    let n = 0;
    await p.route("**/api/jobs/zz574", (r) => { n++; r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(n < 4 ? { id: "zz574", status: "running", progress: { step: n + 2, total: 8 } } : { id: "zz574", status: "done", progress: null }) }); });
    const st = await ev(() => new Promise((ok) => {
      const el = document.createElement("div"); el.id = "zzStep"; el.textContent = "✨ image…"; document.body.appendChild(el);
      const seen = []; document.addEventListener("h3:jobtick", (e) => { if (e.detail && e.detail.id === "zz574") seen.push(e.detail.progress && e.detail.progress.step); });
      const texts = []; const mo = new MutationObserver(() => texts.push(el.textContent)); mo.observe(el, { childList: true, characterData: true, subtree: true });
      window.H3Steps.watch(el, "zz574", { base: "✨ image", first: 0, every: 300 });
      awaitJob("zz574").then((s) => setTimeout(() => ok({ s, seen, texts, last: el.textContent }), 600));
    }));
    check("H3Steps.watch writes \"✨ image · step n of 8\" while the job runs and stops when it ends; awaitJob tells the page every poll (h3:jobtick)",
      st.s === "done" && st.texts.some((t) => /^✨ image · step \d of 8$/.test(t)) && st.seen.length >= 1, st);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    try { await ev(() => window.H3ThemeEdit && window.H3ThemeEdit.setStyles({}, true)); } catch (e) { /* closed */ }
    // the edit mode this test began left its working copy (themes/<name>.tmp) - the next edit mode would offer it back
    try { await ev(() => Promise.all(["Untitled", (window.H3ThemeEdit && window.H3ThemeEdit.session && window.H3ThemeEdit.session()) || ""].filter(Boolean).map((n) => fetch("/api/themes/tmp/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: n }) })))); } catch (e) { /* fine */ }
    await b.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
