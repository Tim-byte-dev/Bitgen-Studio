#!/usr/bin/env node
/* bitGen Studio — 2.456.0 in a REAL browser: THE STORYBOARD (ext/videodock/storyboard.js + routes/storyboard.js).
 * Tim: "convert video docker into floating docker - change it's name to StoryBoard - Add Thumbnails to each scene
 * generated with the selected image model, ... use the character sheet and location images added reference images as
 * reference images ... use storyboard image as the first or last image". Against the running app (H3_URL, default
 * :8311) with its stub image model (the "E2E Look" sd-cli style, made by the e2e run - else the first image style).
 * No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the storyboard browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const BASE = URL_.replace(/\/$/, "");
const SHOTS = process.env.SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};
const api = async (u, b) => { const r = await fetch(BASE + u, b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined); return r.json(); };

(async () => {
  const PRJ = "zz-storyboard";
  let before = null;
  try { before = (await api("/api/projects/current")).name || null; } catch { before = null; }
  await api("/api/projects/new", { name: PRJ }); await api("/api/projects/load", { name: PRJ });
  await api("/api/scenes/add", { text: "Mara walks through the neon market at night, rain on the stalls" });
  await api("/api/scenes/add", { text: "Mara climbs the fire escape to the rooftop at dawn" });
  const styles = await api("/api/styles");
  const st = ((styles.styles || []).find((s) => /^E2E Look$/.test(s.name)) || (styles.styles || []).find((s) => s.kind !== "music" && !s.chain && (s.engine === "sdcli"))) || null;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const shot = async (n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + ".png") }); };
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Story && window.H3Story.refresh && document.getElementById("sbBar"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("videodock"); if (d.classList.contains("dockgone")) toggleDockGone("videodock", "tV"); if (d.classList.contains("collapsed")) toggleCollapse("videodock"); if (window.bgScenes) window.bgScenes.refresh(); });
    await p.waitForFunction(() => document.querySelectorAll("#scList .sccard[data-sc]").length >= 2, null, { timeout: 20000 });
    await p.waitForTimeout(500);
    /* 1 the name, the float button, the bar, a thumbnail box on each scene */
    const s1 = await ev(() => ({ head: document.querySelector("#videodock > .bhead").textContent, tv: document.getElementById("tV").textContent, fl: !!document.getElementById("sbFloatBtn"),
      bar: ["sbStyle", "sbSheets", "sbLocs", "sbRefs", "sbAll"].every((id) => document.getElementById(id)), thumbs: document.querySelectorAll("#scList .sccard .sbthumb").length }));
    await shot("1-board");
    check("the video docker is the STORYBOARD (its header, the status bar button), ⇱ floats it; the bar: image model, ☑ Character sheets / Locations / Reference images, 🖼 All missing; a thumbnail box on every scene",
      /StoryBoard/.test(s1.head) && s1.tv === "StoryBoard" && s1.fl && s1.bar && s1.thumbs >= 2, s1);

    /* 2 🖼 make on scene 1 with the stub image model: the picture comes back as its thumbnail */
    check("an image model to make the pictures with (the e2e's stub \"E2E Look\" sd-cli style)", !!st, (styles.styles || []).map((s) => s.name));
    if (st) {
      await ev((id) => { const s = document.getElementById("sbStyle"); s.dispatchEvent(new Event("focus")); s.value = id; s.dispatchEvent(new Event("change")); }, st.id);
      const planReq = p.waitForRequest((r) => /\/api\/storyboard\/1\/plan$/.test(r.url()), { timeout: 15000 }).catch(() => null);
      await p.click('[data-sbgen="1"]');
      const pr = await planReq;
      await p.waitForFunction(() => !!document.querySelector('#scList .sbthumb[data-sbthumb="1"] img'), null, { timeout: 120000 }).catch(() => {});
      const s2 = await ev(() => ({ img: !!document.querySelector('#scList .sbthumb[data-sbthumb="1"] img'), ok: (() => { const i = document.querySelector('#scList .sbthumb[data-sbthumb="1"] img'); return !!i && i.naturalWidth > 0; })(), msg: document.getElementById("sbMsg").textContent }));
      const srv = await api("/api/storyboard");
      await shot("2-made");
      check("🖼 make on scene 1: the plan asked (with the ☑ choices), the ordinary image job made the picture, it is scene 1's thumbnail (kept in projects/<p>/storyboard/)",
        !!pr && /"sheets":true/.test(pr.postData() || "") && s2.img && s2.ok && (srv.items || []).some((x) => x.n === 1 && /^storyboard\//.test(x.rel)), { s2, items: srv.items, plan: pr && pr.postData() });

      /* 3 → First: the scene's first frame is its storyboard picture */
      await p.click('[data-sbfirst="1"]'); await p.waitForTimeout(800);
      const sc = await api("/api/scenes"), r1 = (sc.list || []).find((x) => x.n === 1) || {};
      check("→ First: scene 1's FIRST frame slot holds its storyboard picture", !!(r1.fl_first && /storyboard/i.test(JSON.stringify(r1.fl_first))), r1.fl_first);
      await p.click('[data-sblast="1"]'); await p.waitForTimeout(800);
      const r1b = ((await api("/api/scenes")).list || []).find((x) => x.n === 1) || {};
      check("→ Last: the LAST frame slot too", !!(r1b.fl_last && /storyboard/i.test(JSON.stringify(r1b.fl_last))), r1b.fl_last);
    }

    /* 4 floating */
    await p.click("#sbFloatBtn"); await p.waitForTimeout(500);
    const f4 = await ev(() => { const w = document.querySelector('.h3fp[data-fp="sb.dock"]'), r = w && w.getBoundingClientRect(); return { state: window.H3Panels.get("sb.dock").state, win: !!w && r.width > 300 && r.height > 200, title: w && w.querySelector(".h3fp-n").textContent, list: !!(w && w.querySelector("#scList")) }; });
    await shot("4-floating");
    check("⇱: the StoryBoard floats - a window of its own titled StoryBoard with the scenes in it", f4.state === "float" && f4.win && f4.title === "StoryBoard" && f4.list, f4);
    await ev(() => document.querySelector('.h3fp[data-fp="sb.dock"] .h3fp-home').click()); await p.waitForTimeout(400);
    const h4 = await ev(() => ({ state: window.H3Panels.get("sb.dock").state, inCol: !!document.querySelector("#maincol #videodock") || !!document.getElementById("videodock").closest(".dock, #maincol, main") }));
    check("⇲ puts it back where it was", h4.state === "home" && h4.inCol, h4);

    /* 5 ✕ removes the picture */
    if (st) {
      await p.click('[data-sbdel="1"]'); await p.waitForTimeout(600);
      const gone = !(await ev(() => !!document.querySelector('#scList .sbthumb[data-sbthumb="1"] img'))) && !((await api("/api/storyboard")).items || []).some((x) => x.n === 1);
      check("✕ removes scene 1's storyboard picture", gone);
    }
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally {
    try { await ev(() => { const r = window.H3Panels && window.H3Panels.get("sb.dock"); if (r && r.state !== "home") window.H3Panels.home("sb.dock"); }); } catch { /* closed */ }
    await b.close();
    if (before && before !== PRJ) { try { await api("/api/projects/load", { name: before }); } catch { /* fine */ } }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
