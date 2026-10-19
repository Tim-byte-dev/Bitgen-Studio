#!/usr/bin/env node
/* bitGen Studio — 2.394.0 in a REAL browser: the "+ add" placeholder tiles open bitGen's Windows 11 style Open dialog,
 * Ctrl-click / Shift-click / Ctrl+A pick several, and the files land in Assets and the references.
 * Tim (verbatim): "add a + video placeholder to reference docker video and sound tab and assets dockers image sound and
 * video tabs to add a video , picture or sound, user will be able to select multiple files with ctrl or shift like in
 * the windows 11 file docker . make the docker configs button icon only"
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright / ffmpeg = SKIP. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the + add tiles browser test did not run"); process.exit(0); }
try { execSync("ffmpeg -version", { stdio: "ignore" }); } catch { console.log("SKIP: no ffmpeg - the + add tiles browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};

// the files to pick: 4 videos, 2 sounds, 3 pictures (a unique prefix: the e2e project keeps them)
const tag = "at" + Date.now().toString(36);
const D = fs.mkdtempSync(path.join(os.tmpdir(), "addtile-"));
for (const sub of ["vid", "snd", "img"]) fs.mkdirSync(path.join(D, sub));
const ff = (args) => execSync("ffmpeg -v error -y " + args, { stdio: "ignore" });
for (let i = 1; i <= 4; i++) ff(`-f lavfi -i color=c=0x${(i * 40).toString(16)}2010:s=160x90:d=1 -pix_fmt yuv420p "${path.join(D, "vid", `${tag}_v${i}.mp4`)}"`);
for (let i = 1; i <= 2; i++) ff(`-f lavfi -i sine=frequency=${300 * i}:duration=1 "${path.join(D, "snd", `${tag}_s${i}.wav`)}"`);
for (let i = 1; i <= 3; i++) ff(`-f lavfi -i color=c=0x30${(i * 50).toString(16)}20:s=64x64 -frames:v 1 "${path.join(D, "img", `${tag}_p${i}.png`)}"`);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 950 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  /* the Open dialog: go to `dir`, then run the clicks [{i, mod}], then Open */
  const dlgOpen = () => p.waitForSelector(".fdlg .fd-main", { state: "visible", timeout: 15000 });
  async function goTo(dir) {
    await ev(() => document.querySelector(".fdlg .fd-addr").dispatchEvent(new MouseEvent("click")));   // its empty part (a crumb would navigate)
    await p.fill(".fdlg .fd-addrin", dir);
    await p.press(".fdlg .fd-addrin", "Enter");
    await p.waitForFunction((d) => { const r = document.querySelectorAll(".fdlg .fd-main [data-i]"); return r.length && [...r].every((x) => x.textContent.includes(d)); }, tag, { timeout: 15000 });
  }
  const row = (i) => `.fdlg .fd-main [data-i="${i}"]`;
  const selCount = () => ev(() => document.querySelectorAll(".fdlg .fd-main [data-i].sel").length);
  const selNames = () => ev(() => [...document.querySelectorAll(".fdlg .fd-main [data-i].sel")].map((x) => x.textContent.match(/at[a-z0-9]+_[a-z0-9]+\.(mp4|wav|png)/)[0]));
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3_PROJECT_READY && window.AddTile && window.FileDialog, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => { localStorage.setItem("fdlg.view", "details"); refVids.length = 0; refAuds.length = 0; refVidOps = {}; renderRefLists(); refreshAssets(); });
    await p.waitForTimeout(500);

    // the tiles are there
    const t0 = await ev(() => ({ rv: (document.querySelector("#refvids .addtile") || {}).textContent, ra: (document.querySelector("#refauds .addtile") || {}).textContent,
      as: ["images", "video", "sound"].map((k) => { const o = document.querySelector(`[data-apane="${k}"]`), t = o.querySelector(":scope > .addtile"), it = o.querySelector(":scope > .dpane-items");
        return t ? t.textContent + "|" + (t.compareDocumentPosition(it) & Node.DOCUMENT_POSITION_FOLLOWING ? "above" : "below") : null; }),
      btn: document.getElementById("dockCfgBtn").textContent.trim(), btnW: Math.round(document.getElementById("dockCfgBtn").getBoundingClientRect().width) }));
    check("the tiles: References Video '+ add videos', Sound '+ add sounds'; Assets Image / Video / Sound each above its list",
      t0.rv === "+add videos" && t0.ra === "+add sounds" && t0.as.join() === "+add pictures|above,+add videos|above,+add sounds|above", t0);
    check("the Docker configs button is the icon only (⊞, narrow)", t0.btn === "⊞" && t0.btnW < 45, t0);

    // References ▸ Video: Click, Shift-click (a range), Ctrl-click (one out)
    await ev(() => { setRtab("vid"); document.querySelector("#refvids .addtile").click(); });
    await dlgOpen();
    const multi = await ev(() => document.querySelector(".fdlg .fd-filter").selectedOptions[0].textContent);
    await goTo(path.join(D, "vid"));
    const rows = await ev(() => document.querySelectorAll(".fdlg .fd-main [data-i]").length);
    check("+ add video opens bitGen's Open dialog, filtered to videos (only the videos listed)", rows === 4 && /mp4/i.test(multi), { rows, multi });
    await p.click(row(0));
    await p.click(row(2), { modifiers: ["Shift"] });
    const r1 = await selNames();
    await p.click(row(1), { modifiers: ["Control"] });
    const r2 = await selNames();
    check("Shift-click picks the range (3), Ctrl-click takes one out again (2) - like Windows 11", r1.length === 3 && r2.join() === `${tag}_v1.mp4,${tag}_v3.mp4`, { r1, r2 });
    await p.click(".fdlg .fd-ok");
    await p.waitForFunction((t) => refVids.filter((n) => n.startsWith(t)).length === 2, tag, { timeout: 30000 });
    await p.waitForTimeout(400);
    const v1 = await ev((t) => ({ refs: refVids.slice(), assets: assets.video.map((a) => a.name).filter((n) => n.startsWith(t)), tile: (document.querySelector("#refvids .addtile") || {}).textContent,
      say: document.getElementById("refdrop").textContent, tab: document.querySelector("#reftabs button.active").dataset.rtab }), tag);
    check("...both are reference videos AND in Assets ▸ Video; the tile now says one is left", v1.refs.join() === `${tag}_v1.mp4,${tag}_v3.mp4` && v1.assets.length === 2 && v1.tile === "+add video" && v1.tab === "vid", v1);
    check("...the line above the tabs says what happened", /Added 2 of 2 files to the references/.test(v1.say), v1.say);

    // again, two more: only one fits; the tile goes
    await ev(() => document.querySelector("#refvids .addtile").click());
    await dlgOpen(); await goTo(path.join(D, "vid"));
    await p.click(row(1)); await p.click(row(3), { modifiers: ["Control"] });
    await p.click(".fdlg .fd-ok");
    await p.waitForFunction(() => refVids.length === 3 && /Added 1 of 2/.test(document.getElementById("refdrop").textContent), null, { timeout: 30000 });
    const v2 = await ev((t) => ({ n: refVids.length, tile: !!document.querySelector("#refvids .addtile"), say: document.getElementById("refdrop").textContent, inAssets: assets.video.filter((a) => a.name.startsWith(t)).length }), tag);
    check("two more with one place left: one becomes a reference, the other stays in Assets, it says so; full = no tile",
      v2.n === 3 && !v2.tile && /the model takes 3 reference video clips/i.test(v2.say) && /the rest are in Assets/.test(v2.say) && v2.inAssets === 4, v2);

    // References ▸ Sound from the keyboard, Ctrl+A
    await ev(() => { setRtab("snd"); document.querySelector("#refauds .addtile").focus(); });
    await p.keyboard.press("Enter");
    await dlgOpen(); await goTo(path.join(D, "snd"));
    await p.click(row(0)); await p.keyboard.press("Control+a");
    check("+ add sound from the keyboard (Enter); Ctrl+A picks every sound", (await selCount()) === 2);
    await p.click(".fdlg .fd-ok");
    await p.waitForFunction((t) => refAuds.filter((n) => n.startsWith(t)).length === 2, tag, { timeout: 30000 });
    const s1 = await ev((t) => ({ refs: refAuds.slice(), tile: (document.querySelector("#refauds .addtile") || {}).textContent, assets: assets.sound.filter((a) => a.name.startsWith(t)).length }), tag);
    check("...both are reference sounds and in Assets ▸ Sound; one place left", s1.refs.length === 2 && s1.assets === 2 && s1.tile === "+add sound", s1);

    // Assets ▸ Image: Ctrl-click two
    await ev(() => { setAtab("sound"); document.querySelector('[data-apane="images"] > .addtile').click(); });
    await dlgOpen(); await goTo(path.join(D, "img"));
    await p.click(row(0)); await p.click(row(2), { modifiers: ["Control"] });
    check("Assets + add pictures: Ctrl-click two", (await selNames()).join() === `${tag}_p1.png,${tag}_p3.png`);
    await p.click(".fdlg .fd-ok");
    await p.waitForFunction((t) => assets.images.filter((a) => a.name.startsWith(t)).length === 2, tag, { timeout: 30000 });
    await p.waitForTimeout(300);
    const i1 = await ev((t) => ({ tab: document.querySelector("#assettabs button.active").dataset.atab, shown: [...document.querySelectorAll('[data-apane="images"] .dpane-items [data-agname]')].map((e) => e.dataset.agname).filter((n) => n.startsWith(t)).sort(),
      tile: !!document.querySelector('[data-apane="images"] > .addtile') }), tag);
    check("...both in Assets ▸ Image (that tab shown), the tile still above the list", i1.tab === "images" && i1.shown.join() === `${tag}_p1.png,${tag}_p3.png` && i1.tile, i1);

    // Assets ▸ Video: Cancel = nothing
    const before = await ev(() => assets.video.length);
    await ev(() => document.querySelector('[data-apane="video"] > .addtile').click());
    await dlgOpen(); await p.click(".fdlg .fd-cancel"); await p.waitForTimeout(500);
    check("Cancel adds nothing", (await ev(() => assets.video.length)) === before && !(await p.$(".fdlg .fd-main:visible")));

    // the tiles survive a group repaint
    await ev(() => window.AssetGroups && window.AssetGroups.repaint()); await p.waitForTimeout(200);
    check("the Assets tiles survive a list repaint (AssetGroups)", (await ev(() => document.querySelectorAll("#assetsdock .dpane > .addtile").length)) === 3);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 900));
  } finally {
    try { await ev(() => { refVids.length = 0; refAuds.length = 0; refVidOps = {}; renderRefLists(); }); } catch { /* fine */ }
    await b.close();
    try { fs.rmSync(D, { recursive: true, force: true }); } catch { /* fine */ }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
