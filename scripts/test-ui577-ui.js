#!/usr/bin/env node
/* bitGen Studio — 2.577.0 in a REAL browser: the Character creator's 🧍 Pose sheet dialog - thumbnails of the
 * user's own pictures in <install>/pose_sheets/ (sub-folders too), ↻ Refresh after saving one, a click + ✔ Use
 * puts the pick on the button and in #chOptPose (what the sheet options send as `pose`), "No pose sheet" clears it,
 * and the pick is remembered over a reload. Tim: "can we add a folder to the app for pose_sheets ... in the character
 * editor/creator remove the pose dropdown and add a dialog with thumbnails of the pose sheets in the folder and use
 * the selected one for the poses". Against the running app (H3_URL). */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.577.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const D = path.join(ROOT, "pose_sheets"); fs.mkdirSync(path.join(D, "e2e577_animals"), { recursive: true });
  const PNG = fs.readFileSync(path.join(ROOT, "scripts", "fixtures", "sample-person.png"));
  const made = [path.join(D, "e2e577_front.png"), path.join(D, "e2e577_animals", "e2e577_horse.png")];
  fs.writeFileSync(made[0], PNG); fs.writeFileSync(made[1], fs.readFileSync(path.join(ROOT, "scripts", "fixtures", "sample-animal.png")));
  const late = path.join(D, "e2e577_late.png");
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1800, height: 1100 } });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PosePick && document.getElementById("chPoseBtn") && document.getElementById("chNewPic"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => { try { localStorage.removeItem("h3.poseSheet"); } catch (e) { /* fine */ } window.H3PosePick.set(""); });
    const form = await ev(() => ({ sel: !!document.querySelector("select#chOptPose"), hidden: (document.getElementById("chOptPose") || {}).type, btn: document.getElementById("chPoseName").textContent }));
    check("the creator: no pose dropdown - a 🧍 Pose sheet button (\"No pose sheet\") over the hidden #chOptPose", !form.sel && form.hidden === "hidden" && form.btn === "🧍 No pose sheet", form);
    await ev(() => document.getElementById("chNewPic").click());
    await p.waitForSelector("#chMaskDlg[open]", { timeout: 10000 });
    await p.click("#chPoseBtn");
    await p.waitForSelector('#chPoseDlg[open] [data-pd="e2e577_front.png"]', { timeout: 45000 });
    await p.waitForFunction(() => [...document.querySelectorAll("#pdGrid img")].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 45000 });
    const g = await ev(() => ({ ids: [...document.querySelectorAll("#pdGrid [data-pd]")].map((x) => x.getAttribute("data-pd")), imgs: document.querySelectorAll("#pdGrid img").length, dir: document.getElementById("pdDir").textContent, top: document.getElementById("chMaskDlg").open }));
    check("🧍 Pose sheet opens a dialog over the creator: \"No pose sheet\" + a THUMBNAIL of every picture in pose_sheets/ (sub-folders too) and the folder named",
      g.top && g.ids[0] === "" && g.ids.indexOf("e2e577_front.png") > 0 && g.ids.indexOf("e2e577_animals/e2e577_horse.png") > 0 && g.imgs >= 2 && /pose_sheets/.test(g.dir), g);
    fs.writeFileSync(late, PNG);
    await p.click("#pdRefresh");
    await p.waitForSelector('#pdGrid [data-pd="e2e577_late.png"]', { timeout: 45000 });
    check("↻ Refresh shows a pose sheet saved into the folder while the dialog is open", true);
    await p.fill("#pdQ", "e2e577 horse");
    const q = await ev(() => [...document.querySelectorAll("#pdGrid [data-pd]")].map((x) => x.getAttribute("data-pd")));
    check("the search narrows the thumbnails (No pose sheet stays)", JSON.stringify(q) === JSON.stringify(["", "e2e577_animals/e2e577_horse.png"]), q);
    await p.click('#pdGrid [data-pd="e2e577_animals/e2e577_horse.png"]');
    await p.click("#pdUse");
    await p.waitForFunction(() => !document.getElementById("chPoseDlg").open, null, { timeout: 5000 });
    const picked = await ev(() => ({ v: document.getElementById("chOptPose").value, name: document.getElementById("chPoseName").textContent, th: document.getElementById("chPoseThumb").style.backgroundImage, creator: document.getElementById("chMaskDlg").open }));
    check("a click + ✔ Use: the pick on the button (name + thumbnail) and in #chOptPose - what the sheet sends as pose; the creator stays open",
      picked.v === "e2e577_animals/e2e577_horse.png" && picked.name === "🧍 e2e577_horse" && /pose-sheets\/file\?id=e2e577_animals%2Fe2e577_horse\.png/.test(picked.th) && picked.creator, picked);
    const sent = await ev(() => fetch("/api/pose-sheets/file?id=" + encodeURIComponent(document.getElementById("chOptPose").value)).then((r) => r.status));
    check("...and the server serves that pick (the file sheetgen loads into slot 1)", sent === 200, sent);
    /* remembered over a reload */
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3PosePick && document.getElementById("chOptPose") && document.getElementById("chOptPose").value, null, { timeout: 90000 });
    const kept = await ev(() => document.getElementById("chOptPose").value);
    check("the pick is remembered after a restart", kept === "e2e577_animals/e2e577_horse.png", kept);
    /* No pose sheet (double click) */
    await ev(() => document.getElementById("chNewPic").click());
    await p.waitForSelector("#chMaskDlg[open]", { timeout: 10000 });
    await p.click("#chPoseBtn");
    await p.waitForSelector('#chPoseDlg[open] #pdGrid .pdTile.on[data-pd="e2e577_animals/e2e577_horse.png"]', { timeout: 45000 });
    await p.dblclick('#pdGrid [data-pd=""]');
    await p.waitForFunction(() => !document.getElementById("chPoseDlg").open, null, { timeout: 5000 });
    const none = await ev(() => ({ v: document.getElementById("chOptPose").value, name: document.getElementById("chPoseName").textContent }));
    check("the dialog opens on the current pick; a double click on \"No pose sheet\" clears it", none.v === "" && none.name === "🧍 No pose sheet", none);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); try { console.log("      state " + JSON.stringify(await ev(() => ({ open: (document.getElementById("chPoseDlg") || {}).open, grid: ((document.getElementById("pdGrid") || {}).innerHTML || "").replace(/<[^>]+>/g, " ").slice(0, 400) })))); } catch (e2) { /* fine */ } }
  finally {
    await b.close();
    for (const f of made.concat([late])) fs.rmSync(f, { force: true });
    fs.rmSync(path.join(D, "e2e577_animals"), { recursive: true, force: true });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
