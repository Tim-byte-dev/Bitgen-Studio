#!/usr/bin/env node
/* bitGen Studio — 2.565.0 in a REAL browser: THE STORYBOARD GRID + 🎞 WRITE STORYBOARD (ext/videodock/sbgrid.js,
 * storyboard.js). Every scene a card like the Model manager's (its picture, "Scene n", its state, its text) in a grid with
 * an ➜ to the next scene; a click opens the scene's full card (every feature) under the grid; 🖼 on a card makes its
 * picture and (☑ Start on it) it becomes the scene's FIRST frame (a Ref scene turns First); ☰ List = the cards as before;
 * 🎞 Write storyboard = the LLM (a stand-in llama-server) writes the scenes, then each gets its picture.
 * Tim: "can u make the llm generate a storyboard instead of just scenes - i give it reference images and it creates
 * pictures for the storyboard that i can use as the starting reference image - we can change this image if needed. the
 * scene text will go into a card like our model manager - the thumbnails will be in a grid format with arrows pointing to
 * the next scene. keep all the other features in our storyboard scenes". Against the running app (its stub image model
 * "E2E Look"). No Playwright = SKIP. */
"use strict";
const path = require("path");
const http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.565.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const BASE = URL_.replace(/\/$/, "");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, b) => { const r = await fetch(BASE + u, b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined); return r.json(); };

(async () => {
  const PRJ = "zz-sbgrid565";
  let before = null;
  try { before = (await api("/api/projects/current")).name || null; } catch { before = null; }
  await api("/api/projects/new", { name: PRJ }); await api("/api/projects/load", { name: PRJ });
  await api("/api/characters", { name: "Mara" });                    // (the writer needs a cast - its @tags)
  await api("/api/scenes/add", { text: "Mara walks through the neon market at night, rain on the stalls" });
  await api("/api/scenes/add", { text: "Mara climbs the fire escape to the rooftop at dawn" });
  await api("/api/scenes/add", { text: "Mara looks over the waking city" });
  const styles = await api("/api/styles");
  const st = ((styles.styles || []).find((s) => /^E2E Look$/.test(s.name))) || null;
  // the stand-in llama-server for 🎞 Write storyboard (the screenplay writer's JSON plan, dressed like a real model)
  const PLAN = '{ "prompt_prefix": ["A quiet short film about a fox."],\n  "shots": [\n'
    + '    { "id": "clip_01", "prompt": ["[Shot 1] @mara watches a red fox trot through deep snow at dawn."], "length": 121, "seed": "7" },\n'
    + '    { "id": "clip_02", "prompt": ["[Shot 2] The fox stops at the frozen river and looks back."], "length": 121, "seed": "8" },\n  ],\n}';
  const llm = http.createServer((req, res) => { let b = ""; req.on("data", (d) => { b += d; }); req.on("end", () => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "<think>{ plan }</think>\nHere it is:\n```json\n" + PLAN + "\n```\n" } }] })); }); });
  await new Promise((r) => llm.listen(0, "127.0.0.1", r));
  const llm0 = ((await api("/api/config")) || {}).llm || {};
  await api("/api/config", { llm: { external_url: `http://127.0.0.1:${llm.address().port}/v1/chat/completions`, external_model: "stub" } });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3SbGrid && window.H3Story && window.H3Story.refresh, null, { timeout: 60000 });
    await ev(() => { try { localStorage.removeItem("sb.view"); } catch (e) { /* fine */ } window.H3SbGrid.setView("grid");
      const d = document.getElementById("videodock"); if (d.classList.contains("dockgone")) toggleDockGone("videodock", "tV"); if (d.classList.contains("collapsed")) toggleCollapse("videodock");
      const s = document.getElementById("scPick"); if (s && s.value) { s.value = ""; s.dispatchEvent(new Event("change")); } });
    await p.waitForFunction(() => document.querySelectorAll("#sbGrid .sbgcard").length >= 3, null, { timeout: 20000 });
    const g1 = await ev(() => ({ cards: [...document.querySelectorAll("#sbGrid .sbgcard")].map((c) => ({ n: c.dataset.sbg, nm: c.querySelector(".nm").textContent, tx: c.querySelector(".tx").textContent })),
      arrows: document.querySelectorAll("#sbGrid .sbgarr").length, listHidden: getComputedStyle(document.getElementById("scList")).display === "none", view: [...document.querySelectorAll("#sbViewBtns button.on")].map((x) => x.dataset.sbview) }));
    check("▦ the grid is the StoryBoard's view: a card per scene (\"Scene n\" + its text), an ➜ from each to the next, the list's cards hidden",
      g1.cards.length === 3 && g1.cards[0].nm === "Scene 1" && /neon market/.test(g1.cards[0].tx) && g1.arrows === 2 && g1.listHidden && g1.view.join() === "grid", g1);
    await p.click('#sbGrid .sbgcard[data-sbg="2"] .tx');
    await p.waitForTimeout(400);
    const d2 = await ev(() => ({ pick: document.getElementById("scPick").value, sel: document.querySelector("#sbGrid .sbgcard.sel") && document.querySelector("#sbGrid .sbgcard.sel").dataset.sbg,
      shown: [...document.querySelectorAll("#scList .sccard[data-sc]")].filter((c) => c.offsetParent !== null).map((c) => c.dataset.sc), head: document.getElementById("sbDetailHead").textContent,
      feats: !!document.querySelector('#scList .sccard[data-sc="2"] [data-scplay="2"]') && !!document.querySelector('#scList [data-scflpick="2"]') && !!document.querySelector('#scList details.scqe[data-qe="2"]') }));
    check("a click opens scene 2's FULL card under the grid (its ▶, its pictures, ✎ First frame - every feature), only that one", d2.pick === "2" && d2.sel === "2" && d2.shown.join() === "2" && /Scene 2/.test(d2.head) && d2.feats, d2);
    await p.click("#sbDetailHead button"); await p.waitForTimeout(300);
    check("...✕ closes it - back to the grid alone", await ev(() => document.getElementById("scPick").value === "" && getComputedStyle(document.getElementById("scList")).display === "none"));
    // 🖼 on card 1 -> its picture -> Start on it
    check("an image model to make the pictures with (the e2e's stub \"E2E Look\")", !!st);
    if (st) {
      await ev((id) => { const s = document.getElementById("sbStyle"); s.dispatchEvent(new Event("focus")); s.value = id; s.dispatchEvent(new Event("change")); const a = document.getElementById("sbAuto"); if (!a.checked) a.click(); }, st.id);
      await p.click('#sbGrid [data-sbgmake="1"]');
      await p.waitForFunction(() => /\/api\/storyboard\/1\/thumb/.test((document.querySelector('#sbGrid .sbgcard[data-sbg="1"] .th') || {}).style ? document.querySelector('#sbGrid .sbgcard[data-sbg="1"] .th').style.backgroundImage : ""), null, { timeout: 120000 }).catch(() => {});
      await p.waitForTimeout(1500);
      const r1 = ((await api("/api/scenes")).list || []).find((x) => x.n === 1) || {};
      const c1 = await ev(() => { const c = document.querySelector('#sbGrid .sbgcard[data-sbg="1"]'); return { bg: c.querySelector(".th").style.backgroundImage, first: !!c.querySelector("[data-sbgfirst]"), make: c.querySelector("[data-sbgmake]").textContent }; });
      check("🖼 on scene 1's card: its storyboard picture is the card's picture (↻ makes another; → First)", /storyboard\/1\/thumb/.test(c1.bg) && c1.first && /↻/.test(c1.make), c1);
      check("...☑ Start on it: the picture is scene 1's FIRST frame and the scene starts on it (Ref -> First)", !!(r1.fl_first && /storyboard/i.test(JSON.stringify(r1.fl_first))) && r1.anchor === "first", { fl: r1.fl_first, anchor: r1.anchor });
    }
    // ☰ List
    await p.click('#sbViewBtns [data-sbview="list"]'); await p.waitForTimeout(300);
    const l1 = await ev(() => ({ grid: getComputedStyle(document.getElementById("sbGrid")).display, cards: [...document.querySelectorAll("#scList .sccard[data-sc]")].filter((c) => c.offsetParent !== null).length, store: localStorage.getItem("sb.view") }));
    check("☰ List: the scene cards as before (all of them), the grid away; kept for next time", l1.grid === "none" && l1.cards === 3 && l1.store === "list", l1);
    await p.click('#sbViewBtns [data-sbview="grid"]'); await p.waitForTimeout(300);
    // 🎞 Write storyboard
    if (st) {
      const wrote = await ev(() => window.H3Story.write("a fox in the snow"));
      await p.waitForFunction(() => { const c = [...document.querySelectorAll("#sbGrid .sbgcard")]; return c.length >= 1 && c.length !== 3 && /fox/.test(c[0].textContent) && c.every((x) => /storyboard/.test(x.querySelector(".th").style.backgroundImage)); }, null, { timeout: 180000 }).catch(() => {});
      const w = await ev(() => [...document.querySelectorAll("#sbGrid .sbgcard")].map((c) => ({ n: c.dataset.sbg, tx: c.querySelector(".tx").textContent.slice(0, 40), pic: /storyboard/.test(c.querySelector(".th").style.backgroundImage) })));
      const sc = (await api("/api/scenes")).list || [];
      check("🎞 Write storyboard: the LLM wrote the scenes (the board's new scenes, in the grid) and every scene got its storyboard picture - its starting picture (First)",
        w.length >= 1 && w.length === sc.length && w.every((x) => x.pic) && /fox/i.test(w.map((x) => x.tx).join(" ")) && /Screenplay written/.test(wrote || "") && sc.every((r) => r.fl_first && r.anchor === "first"), { wrote, w, sc: sc.map((r) => [r.n, r.anchor, !!r.fl_first]) });
    }
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    await b.close();
    await api("/api/config", { llm: { external_url: llm0.external_url || "", external_model: llm0.external_model || "" } }).catch(() => {});
    llm.close();
    if (before && before !== PRJ) { try { await api("/api/projects/load", { name: before }); } catch { /* fine */ } }
    try { require("fs").rmSync(path.join(__dirname, "..", "projects", PRJ), { recursive: true, force: true }); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
