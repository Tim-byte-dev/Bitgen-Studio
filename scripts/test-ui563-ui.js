#!/usr/bin/env node
/* bitGen Studio — 2.563.0 in a REAL browser: StoryBoard scene 2 takes scene 1's pictures - ＋📁's 🎬 Scenes tab adds scene
 * 1's reference picture to scene 2's own pictures; the ✎ accordion's 🅰 Picture A takes scene 1's First frame; Start from
 * 🅰 Picture A; 🤖 Write answers (the LLM's instruction, or why it could not); ✎ Make first frame queues the edit with
 * <image1> = Picture A, its style, composition and poses kept (ext/videodock/qedit.js + characters.js, routes/sceneedit.js).
 * Tim: "in the scene frame in storyboard, allow user to add reference images to each scene, include images from previous
 * scenes. maybe we can use a reference image as the start frame but keep location the same ...". Against the running app
 * (H3_URL). No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.563.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const BASE = URL_.replace(/\/$/, "");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, b) => { const r = await fetch(BASE + u, b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined); return r.json(); };
const upload = async (u, field, file, extra) => {
  const fd = new FormData(); for (const [k, v] of Object.entries(extra || {})) fd.append(k, v);
  fd.append(field, new Blob([fs.readFileSync(file)], { type: "image/png" }), path.basename(file));
  return (await fetch(BASE + u, { method: "POST", body: fd })).json();
};

(async () => {
  const PRJ = "zz-picturea563";
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pa563-"));
  const door = path.join(tmp, "red_door.png"), first = path.join(tmp, "street.png");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=0xaa2222:s=96x64", "-frames:v", "1", door]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=s=160x90", "-frames:v", "1", first]);
  await api("/api/projects/new", { name: PRJ }); await api("/api/projects/load", { name: PRJ });
  await api("/api/scenes/add", { text: "Mara stands at the red door in the rain" });
  await api("/api/scenes/add", { text: "Mara steps inside the warm cafe" });
  const u1 = await upload("/api/scenes/1/refs", "images", door);
  const u2 = await upload("/api/scenes/1/fl/upload", "image", first, { slot: "first" });
  check("scene 1 holds a reference picture and a First frame (the fixture)", u1.ok && u2.ok, { u1, u2 });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  await p.addInitScript(() => { try { localStorage.setItem("sb.view", "list"); } catch (e) { /* fine */ } });   // 2.565.0: these steps use the List view's cards (the grid is the default)
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let job = null;
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.ScQedit, null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("videodock"); if (d.classList.contains("dockgone")) toggleDockGone("videodock", "tV"); if (d.classList.contains("collapsed")) toggleCollapse("videodock"); });
    await p.waitForFunction(() => document.querySelectorAll("#scList .sccard[data-sc]").length >= 2, null, { timeout: 20000 });
    await p.waitForTimeout(600);
    // 1 ＋📁 on scene 2 -> 🎬 Scenes -> scene 1's reference picture
    await p.click('[data-scflpick="2"][data-slot="ref"]');
    await p.waitForSelector('#scFlPick img[data-flrel*="red_door"]', { timeout: 10000 });
    const tabs = await ev(() => ({ tabs: [...document.querySelectorAll("#scFlPick [data-fltab]")].map((x) => x.textContent), head: [...document.querySelectorAll("#scFlPick [data-flgroup]")].map((x) => x.textContent) }));
    check("＋📁 opens on 🎬 Scenes: every other scene's pictures under its number (scene 1: its First frame, its reference picture); 🎞 Clips is there for the reference pictures too",
      tabs.tabs.join("|") === "🎬 Scenes|🎞 Clips|📁 Project|⤒ File" && tabs.head.join() === "Scene 1", tabs);
    await p.click('#scFlPick img[data-flrel*="red_door"]');
    await p.waitForFunction(() => !document.getElementById("scFlPick"), null, { timeout: 8000 });
    const s2 = (((await api("/api/scenes")).list || []).find((x) => x.n === 2)) || {};
    check("...picked = one of scene 2's own pictures, saying where it came from", (s2.refs || []).length === 1 && /^scene 1 · /.test(s2.refs[0].label) && /red door|red_door/.test(s2.refs[0].label), s2.refs);
    // 2 ✎ on scene 2: 🅰 Picture A <- scene 1's First frame
    await ev(() => { const d = document.querySelector('details.scqe[data-qe="2"]'); d.open = true; d.dispatchEvent(new Event("toggle")); });
    await p.waitForTimeout(400);
    await p.click('[data-qepick="2"][data-slot="qe_pica"]');
    await p.waitForSelector('#scFlPick img[data-flrel*="fl_first"]', { timeout: 10000 });
    const head = await ev(() => document.querySelector("#scFlPick span").textContent);
    await p.click('#scFlPick img[data-flrel*="fl_first"]');
    await p.waitForFunction(() => !document.getElementById("scFlPick"), null, { timeout: 8000 });
    await p.waitForTimeout(600);
    const q2 = ((((await api("/api/scenes")).list || []).find((x) => x.n === 2)) || {}).qedit || {};
    const row = await ev(() => { const d = document.querySelector('details.scqe[data-qe="2"]'); return { open: d.open, thumb: !!d.querySelector('img[src*="qe_pica"]'), opts: [...d.querySelector("[data-qebase]").options].map((o) => o.value), write: !!d.querySelector("[data-qewrite]"), sum: d.querySelector("summary").textContent }; });
    check("🅰 Picture A: the picker says what it is for and takes scene 1's First frame; the accordion shows it",
      /choose PICTURE A/.test(head) && q2.pica && q2.pica.file === "qe_pica.png" && /^scene 1 · First frame/.test(q2.pica.label) && row.thumb, { head, q2, row });
    check("...Start from offers 🅰 Picture A; 🤖 Write is there; the title names no model (the edit style picked is)", row.opts.join() === "auto,picture,location,continue,first" && row.write && !/Qwen/.test(row.sum), row);
    // 3 Start from = Picture A, 🤖 Write
    await ev(() => { const s = document.querySelector('[data-qebase="2"]'); s.value = "picture"; s.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(300);
    const w = await api("/api/scenes/2/qedit/write", { base: "picture" });
    check("🤖 Write answers: the LLM's instruction starting from <image1> - or, with no LLM running, why not (in words)",
      (w.ok && /<image1>/.test(w.prompt) && /^Picture A/.test(w.roles[0])) || /the LLM did not answer/.test(w.error || ""), w);
    // 4 ✎ Make first frame (the built-in wording when the LLM is not there)
    if (!w.ok) await api("/api/scenes/2/qedit", { prompt: "" });
    const run = await api("/api/scenes/2/qedit/run", { base: "picture", prompt: w.ok ? w.prompt : "" });
    job = run.job || null;
    check("✎ Make first frame: the edit job is queued with <image1> = Picture A (scene 1's First frame), its style, composition, framing and poses kept; no location named = Picture A's own place",
      !!run.job && run.base === "picture" && /^Picture A: scene 1 · First frame/.test(run.roles[0])
      && (w.ok ? /<image1>/.test(run.prompt) : /^This scene starts from <image1> \(Picture A\): its style, composition, camera framing and the people's poses/.test(run.prompt) && /Keep the place in <image1> as it is/.test(run.prompt)), run);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    if (job) try { await api(`/api/jobs/${job}/cancel`, {}); } catch { /* fine */ }
    await b.close();
    await new Promise((r) => setTimeout(r, 1200));
    try { await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", PRJ), { recursive: true, force: true }); } catch { /* fine */ }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
