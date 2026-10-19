#!/usr/bin/env node
/* bitGen Studio — 2.526.0 in a REAL browser: THE WORKSPACE dropdown in the menu bar - Basic / Image editing / Video
 * editing / Music video / Expert each show their dockers and hide the buttons they do not need (never disable them),
 * set the Generate mode, keep your own changes (a side dock hidden, 🏠 House open) when you leave and come back, ↺ puts
 * one back to its default, Expert gives back the layout you started with, and a reload opens in the same workspace.
 * Tim (verbatim): "lets add a workspace dropdown to the main menubar - image editing, video editing, music video,basic,
 * expert. to make it easier to navigate the app"
 * Against the running app (H3_URL, default :8311). It ends in the workspace it started in, with the layout it started
 * with, and forgets every workspace it saved. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.526 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const SHOTS = process.env.H3_SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const rec0 = await api("/api/workspaces");
  await api("/api/workspaces/reset", { id: "all" });
  await api("/api/workspaces/switch", { to: "expert" });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const shot = async (n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n) }); };
  const ready = async () => { await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Workspace && document.getElementById("wsSel") && document.getElementById("hbBtn"), null, { timeout: 60000 }); await p.waitForTimeout(1200); };
  const pick = async (id) => { await p.selectOption("#wsSel", id); await p.waitForFunction((w) => H3Workspace.current() === w && document.getElementById("wsMsg") && document.getElementById("wsMsg").classList.contains("on"), id, { timeout: 15000 }); await p.waitForTimeout(700); };
  const state = () => ev(() => {
    const vis = (id) => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== "none" && e.offsetParent !== null; };
    const docks = {}; H3Workspace.BOTTOM.forEach((k) => { const e = document.getElementById(k); docks[k] = !e ? "-" : e.classList.contains("dockgone") ? "gone" : e.classList.contains("collapsed") ? "collapsed" : "open"; });
    const side = {}; H3Workspace.SIDE.forEach((k) => { side[k] = !document.getElementById("app").classList.contains(H3Workspace.SIDE_CLS[k]); });
    return { docks, side, btn: Object.fromEntries(["tT", "tSt", "tCF", "tIE", "tMu", "tPv", "tP", "tQ", "ltBtn", "hbBtn", "projReset", "openSettings", "wsSel"].map((i) => [i, vis(i)])),
      gm: (document.getElementById("genModeSel") || {}).value, maxed: [...document.querySelectorAll(".bdock.maxed")].map((e) => e.id), house: SecFloat.state("house").shown, ws: document.body.getAttribute("data-workspace") };
  });
  let gm0 = "";
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await ready();
    const s0 = await state(); gm0 = s0.gm;
    const opts = await ev(() => [...document.querySelectorAll("#wsSel option")].map((o) => o.textContent.trim()));
    check("the Workspace dropdown is in the menu bar with the five workspaces; Expert to begin with (nothing changed)",
      await ev(() => !!document.querySelector("#menubar #wsWrap #wsSel")) && opts.length === 5 && /Basic/.test(opts[0]) && /Image editing/.test(opts[1]) && /Video editing/.test(opts[2]) && /Music video/.test(opts[3]) && /Expert/.test(opts[4]) && s0.ws === "expert", opts);
    // Expert as Tim had it: 🏠 House open - it must come back with Expert
    await p.click("#hbBtn"); await p.waitForTimeout(500);
    const exp0 = await state();

    await pick("basic");
    let s = await state();
    check("Basic: the preview + the prompt; timeline, image editor, music hidden; the assets dock hidden", s.docks.previewdock === "open" && s.docks.promptdock === "open" && s.docks.timelinedock === "gone" && s.docks.imageeditdock === "gone" && s.docks.musicdock === "gone" && s.side.assets === false, s);
    check("…its buttons: Timeline, Stems, ComfyUI, 🎓 LoRA, 🏠 House, ↺ Reset project hidden - Prompt, Queue, ⚙, the dropdown stay", !s.btn.tT && !s.btn.tSt && !s.btn.tCF && !s.btn.ltBtn && !s.btn.hbBtn && !s.btn.projReset && s.btn.tP && s.btn.tQ && s.btn.openSettings && s.btn.wsSel, s.btn);
    check("…the floating 🏠 House closed (Expert keeps it)", s.house === false);
    check("…hidden, never disabled: the buttons are still there to reach", await ev(() => ["tT", "hbBtn"].every((i) => document.getElementById(i) && !document.getElementById(i).disabled)));
    await shot("ui526-basic.png");

    await pick("image");
    s = await state();
    check("Image editing: the image editor (maximized) + the prompt; preview and timeline hidden; Generate -> 🖼 Image", s.docks.imageeditdock === "open" && s.maxed.includes("imageeditdock") && s.docks.previewdock === "gone" && s.docks.timelinedock === "gone" && s.gm === "image", s);
    check("…its buttons: Editor shown, Timeline / Preview / Music hidden", s.btn.tIE && !s.btn.tT && !s.btn.tPv && !s.btn.tMu, s.btn);
    await shot("ui526-image.png");

    await pick("video");
    s = await state();
    check("Video editing: preview, timeline, storyboard, SFX, prompt; no image editor or music; Generate -> 🎬 Video", ["previewdock", "timelinedock", "videodock", "sfxdock", "promptdock"].every((k) => s.docks[k] === "open") && s.docks.imageeditdock === "gone" && s.docks.musicdock === "gone" && s.gm === "video" && s.maxed.length === 0, s);
    // your own change: hide the References dock
    await p.click("#tRefs"); await p.waitForTimeout(500);
    check("…a change of your own (References hidden)", (await state()).side.refs === false);

    await pick("musicvideo");
    s = await state();
    check("Music video: + music and stems, the timeline, the storyboard, the preview", ["previewdock", "timelinedock", "videodock", "musicdock", "stemsdock", "promptdock"].every((k) => s.docks[k] === "open") && s.docks.imageeditdock === "gone" && s.side.refs === true && s.btn.tMu && s.btn.tSt, s);
    await shot("ui526-musicvideo.png");

    await pick("video");
    s = await state();
    const toast = await ev(() => document.getElementById("wsMsg").textContent);
    check("back to Video editing: as you left it (References still hidden) - not the default", s.side.refs === false && s.docks.timelinedock === "open" && !/default/.test(toast), { side: s.side, toast });

    await p.click("#wsReset");
    await p.waitForFunction(() => /back to its default/.test(document.getElementById("wsMsg").textContent), null, { timeout: 10000 }); await p.waitForTimeout(700);
    check("↺ puts Video editing back to its default (References shown again)", (await state()).side.refs === true);

    await p.reload({ waitUntil: "domcontentloaded" }); await ready();
    s = await state();
    check("a reload opens in the same workspace, its buttons still hidden", s.ws === "video" && (await ev(() => document.getElementById("wsSel").value)) === "video" && !s.btn.tIE && s.docks.timelinedock === "open", s);

    await pick("expert");
    s = await state();
    check("Expert: every button back, and the layout you started with (the same dockers, 🏠 House open again)",
      Object.values(s.btn).every(Boolean) && JSON.stringify(s.docks) === JSON.stringify(exp0.docks) && JSON.stringify(s.side) === JSON.stringify(exp0.side) && s.house === true, { now: s, was: exp0 });
    await p.click("#hbBtn"); await p.waitForTimeout(300);   // House closed again as before the test
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("the run finished", false, String(e && e.stack || e)); }
  finally {
    try { if (gm0) await ev((g) => { const s = document.getElementById("genModeSel"); if (s && s.value !== g) { s.value = g; s.dispatchEvent(new Event("change", { bubbles: true })); } }, gm0); await p.waitForTimeout(500); } catch { /* fine */ }
    try { await b.close(); } catch { /* fine */ }
    await new Promise((ok) => setTimeout(ok, 1500));   // the page's last snapshot (sendBeacon on unload) lands first
    await api("/api/workspaces/reset", { id: "all" });
    await api("/api/workspaces/switch", { to: rec0.current || "expert" });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
