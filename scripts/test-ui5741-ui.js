#!/usr/bin/env node
/* bitGen Studio — 2.574.1 in a REAL browser: renaming a docker in theme edit mode a second time (and through a wide
 * "Apply to") renames only THAT docker.
 * Tim: "in theme editor when i try to change the docker heading a second time, everything goes haywire" / "and all the
 * dockers take the same name". The panel kept the "Apply to" of the element picked before (Every <div> / All like it),
 * so the words went to every docker - and every div with words of its own. Now the words are kept under the picked
 * element's own selector, a wide or bare-tag text rule never rewrites a heading, and an old theme with one heals.
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.574.1 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const titles = () => ev(() => Object.fromEntries([...document.querySelectorAll("#maincol > .bdock > .bhead, .bdock > .bhead")].map((h) => [h.parentElement.id,
    [...h.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join("").replace(/[▾▸]/g, "").trim()])));
  const type = (t) => ev((t) => { const x = document.getElementById("teText"); x.value = t; x.dispatchEvent(new Event("input", { bubbles: true })); }, t);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3ThemeEdit && document.querySelector("#videodock > .bhead"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => window.H3ThemeEdit.setStyles({}, true));
    const t0 = await titles();
    // the first rename
    await ev(() => window.H3ThemeEdit.pick(document.querySelector("#videodock > .bhead")));
    await p.waitForSelector("#thEditPanel #teText");
    await type("Music Video"); await p.waitForTimeout(300);
    // the second: picked again, "Apply to" widened to All like it (div.bhead) and then Every <div>, a new name typed
    await ev(() => { const s = document.getElementById("teScope"); s.value = [...s.options].find((o) => o.value === "div.bhead").value; s.dispatchEvent(new Event("change")); });
    await type("Clips"); await p.waitForTimeout(300);
    const t1 = await titles(), r1 = await ev(() => window.H3ThemeEdit.styles()), msg = await ev(() => document.getElementById("teMsg").textContent);
    const others = Object.keys(t0).filter((k) => k !== "videodock");
    check("renamed a second time with \"Apply to\" = All like it (div.bhead): ONLY the StoryBoard says Clips, every other docker keeps its title; the words kept under its own selector",
      t1.videodock === "Clips" && others.length > 3 && others.every((k) => t1[k] === t0[k]) && !(r1["div.bhead"] || {}).text && Object.entries(r1).some(([k, v]) => v.text === "Clips" && k !== "div.bhead") && /this one only/.test(msg), { t1, r1, msg });
    await ev(() => { const s = document.getElementById("teScope"); s.value = "div"; s.dispatchEvent(new Event("change")); });
    await type("Scenes"); await p.waitForTimeout(300);
    const t2 = await titles(), r2 = await ev(() => window.H3ThemeEdit.styles());
    const bad = await ev(() => [...document.querySelectorAll(".h3words")].map((x) => x.parentElement && x.parentElement.id || x.tagName).length);
    check("...and through Every <div>: still only the StoryBoard (Scenes), no other element rewritten, no text on the bare tag",
      t2.videodock === "Scenes" && others.every((k) => t2[k] === t0[k]) && !(r2.div || {}).text && bad === 1, { t2, r2, bad });
    const pv = await ev(() => { window.H3ThemeEdit.pick(document.querySelector("#videodock > .bhead")); return document.getElementById("teText").value; });
    const first = await ev(() => { const o = document.getElementById("teScope").options[0]; return { v: o.value, t: o.textContent }; });
    check("picked again: the Text box shows its own words (Scenes); Apply to starts at \"This element only\" (this docker's title bar)",
      pv === "Scenes" && (await ev(() => window.H3ThemeEdit.scope())) === "#videodock div.bhead" && first.v === "#videodock div.bhead" && /^This element only/.test(first.t), { pv, first });
    // an element with no id of its own: This element only finds just it
    const lone = await ev(() => { const b = document.querySelector("#musicdock > .bhead"); window.H3ThemeEdit.pick(b); const o = document.getElementById("teScope").options[0]; let n = -1; try { n = document.querySelectorAll(o.value).length; } catch (e) { n = -2; } return { t: o.textContent, n, hit: document.querySelector(o.value) === b }; });
    check("...every pick offers This element only first, and it finds exactly that element", /^This element only/.test(lone.t) && lone.n === 1 && lone.hit, lone);
    await ev(() => window.H3ThemeEdit.toggle(false, { force: true }));

    // an old theme that renamed every docker heals: the titles come back
    await ev(() => window.H3ThemeEdit.setStyles({ "div.bhead": { text: "Same" }, "div": { text: "Every" } }, true));
    await p.waitForTimeout(400);
    const t3 = await titles();
    check("an old theme with a text rule on div.bhead / div: no docker takes the name (a wide rule never rewrites a heading)", Object.keys(t0).every((k) => t3[k] === t0[k]), { t0, t3 });
    await ev(() => window.H3ThemeEdit.setStyles({}, true));
    await p.waitForTimeout(300);
    const t4 = await titles();
    check("cleared: every title as it was", Object.keys(t0).every((k) => t4[k] === t0[k]), t4);
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
