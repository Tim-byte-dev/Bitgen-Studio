#!/usr/bin/env node
/* bitGen Studio — 2.736.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): the SHEET MUSIC
 * TAB'S LAYOUT. Tim (verbatim): "in sheet music docker make the buttons a normal size button not full docker width. fix the
 * layout , the media buttons are not right and remake the rayout to match bitgen . it looks cheap"
 *   - no full-width .go bars: Write / Transcribe / Save PDF are normal .ghost buttons (Write and Save PDF outlined as the
 *     main actions), every button in the tab narrow in a wide docker;
 *   - two toolbars (make a score; this score) with thin dividers, the audio file picked through a button that shows its
 *     name (no browser "Choose File");
 *   - the transport is the score viewer's header: five buttons with DRAWN icons (svg, no emoji), all one row and one
 *     size, ▶ -> ⏸ (data-icon) while it plays, the time in the mono face; ⛶ Read has the same five and a normal Save PDF.
 * No server / no Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.736.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NAME = "E2E-Layout736_20261109-140000.abc";
const ABC = "X:1\nT:Layout\nM:4/4\nL:1/4\nQ:1/4=120\nK:C\nV:1 name=Vocal\nC D E F|G A B c|]\n";

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.736.0 browser test did not run"); process.exit(0); }
  const where = await fetch(URL0 + "api/outputs/where").then((r) => r.json()).catch(() => null);
  const out = where && where.dir;
  if (!out || !fs.existsSync(out)) { console.log("SKIP: the studio's output folder is not on this machine"); process.exit(0); }
  fs.writeFileSync(path.join(out, NAME), ABC);
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  try {
    const p = await b.newPage({ viewport: { width: 1310, height: 1000 } });
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.MuScore && document.getElementById("muPlayBar"), null, { timeout: 30000 });
    // the docker wide: the side columns folded, maximised (a full-width bar would be ~1300 px here)
    await ev(() => {
      [["no-left", "tL"], ["no-refs", "tRefs"], ["no-assets", "tAssets"], ["no-right", "tR"], ["no-queue", "tQ"]].forEach(([c, id]) => {
        if (!document.getElementById("app").classList.contains(c) && document.getElementById(id)) document.getElementById(id).click();
      });
      document.querySelector('button[data-max="musicdock"]').click();
      document.querySelector('button[data-mutab="sheet"]').click();
    });
    await sleep(900);
    await ev(() => MuScore.refresh());
    await p.waitForFunction((n) => [...document.querySelectorAll("#muScoreList option")].some((o) => o.value === n), NAME, { timeout: 15000 });
    await p.selectOption("#muScoreList", NAME);
    await p.waitForFunction(() => MuScore.player() && !document.querySelector("#muPlayBar [data-act]").disabled, null, { timeout: 15000 });

    const L = await ev(() => {
      const pane = document.getElementById("muPaneSheet"), r = (el) => el.getBoundingClientRect();
      const btns = [...pane.querySelectorAll("button, label.ghost")].filter((x) => x.offsetParent);
      return {
        paneW: Math.round(r(pane).width),
        go: pane.querySelectorAll(".go").length,
        widest: Math.max(...btns.map((x) => Math.round(r(x).width))),
        wide: btns.filter((x) => r(x).width > 220).map((x) => x.id || x.textContent.trim()),
        pri: [...pane.querySelectorAll(".muPri")].map((x) => x.id).sort(),
        ghost: ["goSheetCreate", "goSheetWrite", "muScorePdf"].every((id) => document.getElementById(id).classList.contains("ghost")),
        makeRow: ["muCreateSrc", "goSheetCreate", "goSheetWrite"].map((id) => { const q = r(document.getElementById(id)); return Math.round(q.top + q.height / 2); }),
        seps: pane.querySelectorAll(".muSep").length,
        fileShown: getComputedStyle(document.getElementById("muSheetRef")).display,
      };
    });
    check("no full-width .go bars in the tab; every button narrow in a wide docker (" + L.paneW + " px)", L.go === 0 && L.paneW > 1000 && L.widest < 220 && !L.wide.length, L);
    // 2.739.0: the make bar is Song · ✨ Create · Write from lyrics (Create took over Audio file… + Transcribe)
    check("Create / Write / Save PDF are normal .ghost buttons; ✨ Create and Save PDF outlined as the main actions", L.ghost && L.pri.join() === "goSheetCreate,muScorePdf", L);
    check("make a score: Song · ✨ Create · Write from lyrics on one row; thin dividers between the groups", Math.max(...L.makeRow) - Math.min(...L.makeRow) <= 2 && L.seps >= 4, L);
    check("a song from this computer is picked through the Song list (the browser's file box hidden)", L.fileShown === "none", L);

    const T = await ev(() => {
      const bar = document.getElementById("muPlayBar"), view = bar.closest(".muViewer"), bs = [...bar.querySelectorAll("button[data-act]")];
      const r = (el) => el.getBoundingClientRect();
      return {
        inViewer: !!view && view.contains(document.getElementById("muScore")) && r(bar).bottom <= r(document.getElementById("muScore")).top + 1,
        acts: bs.map((x) => x.getAttribute("data-act")), svg: bs.every((x) => x.querySelector("svg") && !x.textContent.trim()),
        mids: bs.map((x) => Math.round(r(x).top + r(x).height / 2)), hs: bs.map((x) => Math.round(r(x).height)), ws: bs.map((x) => Math.round(r(x).width)),
        icon: document.getElementById("muPlayToggle").dataset.icon, mono: /mono/i.test(getComputedStyle(document.getElementById("muPlayTime")).fontFamily),
      };
    });
    check("the transport is the score viewer's header, above the score", T.inViewer, T);
    check("five buttons ⏮ ⏪ ▶ ⏩ ⏭ with drawn icons (svg, no emoji text), one row, one height, compact",
      T.acts.join() === "start,back,toggle,fwd,end" && T.svg && Math.max(...T.mids) - Math.min(...T.mids) <= 1 && new Set(T.hs).size === 1 && Math.max(...T.ws) < 60, T);
    check("the time in the mono face; ▶ at rest", T.mono && T.icon === "play", T);
    await ev(() => document.getElementById("muPlayToggle").click());
    await sleep(500);
    const on = await ev(() => ({ icon: document.getElementById("muPlayToggle").dataset.icon, label: document.getElementById("muPlayToggle").getAttribute("aria-label"), svg: !!document.querySelector("#muPlayToggle svg"), color: getComputedStyle(document.getElementById("muPlayToggle")).color }));
    await ev(() => document.getElementById("muPlayToggle").click());
    await sleep(200);
    const off = await ev(() => document.getElementById("muPlayToggle").dataset.icon);
    check("▶ -> ⏸ while it plays (drawn, labelled Pause, lit), back to ▶", on.icon === "pause" && on.label === "Pause" && on.svg && off === "play", { on, off });

    await ev(() => MuScore.openView());
    await sleep(400);
    const V = await ev(() => {
      const bs = [...document.querySelectorAll("#muSvPlay button[data-act]")], pdf = document.getElementById("muSvPdf");
      return { acts: bs.map((x) => x.getAttribute("data-act")).join(), svg: bs.every((x) => x.querySelector("svg") && !x.textContent.trim()),
        pdfGo: pdf.classList.contains("go"), pdfPri: pdf.classList.contains("muPri"), pdfW: Math.round(pdf.getBoundingClientRect().width) };
    });
    await ev(() => document.getElementById("muScoreView").close());
    check("⛶ Read: the same five drawn buttons; Save PDF a normal outlined button", V.acts === "start,back,toggle,fwd,end" && V.svg && !V.pdfGo && V.pdfPri && V.pdfW < 160, V);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close();
    try { fs.unlinkSync(path.join(out, NAME)); } catch { /* gone */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
