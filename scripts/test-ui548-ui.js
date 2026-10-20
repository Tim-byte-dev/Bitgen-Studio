#!/usr/bin/env node
/* bitGen Studio — 2.548.0 in a REAL browser: the reference docker KEPT (static/refkeep.js, routes/refKeep.js, lib/refKeep.js,
 * lib/projectRefs.store), its pictures kept through a mode change, the storyboard's shared prompt kept as it is typed
 * (ext/videodock/characters.js), the scene / chapter references through Save, close and reload.
 * Tim: "keep the references in the reference docker on close and on project save. they clear right now. and the
 * references in storyboard general prompt and the references in scenes".
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.548.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_refs548_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const J = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const prj = () => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "projects", P, P + ".prj"), "utf8")); } catch { return {}; } };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const open = async () => {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3RefKeep && H3RefKeep.state().ready, null, { timeout: 60000 });
    await p.waitForTimeout(800);
  };
  const waitPrj = async (ok) => { for (let i = 0; i < 40; i++) { const d = prj(); if (ok(d)) return d; await p.waitForTimeout(250); } return prj(); };
  try {
    await J("/api/projects/load", { name: P });
    // the storyboard: two scenes, a chapter reference (the shared prompt's @hat) and a scene picture
    let fd = new FormData(); fd.append("image", new Blob([PNG], { type: "image/png" }), "hat.png"); fd.append("chapter", ""); fd.append("label", "hat"); fd.append("type", "object"); fd.append("description", "a red hat");
    await fetch(URL_ + "api/scenes/refs", { method: "POST", body: fd });
    const mk = await J("/api/scenes", { plan: { prompt_prefix: ["subject_definitions:", "the @hat is red"], shots: [{ id: "clip_01", prompt: ["a woman walks"], length: 97 }, { id: "clip_02", prompt: ["she turns"], length: 97 }] } });
    if (!mk.ok) throw new Error("the board was not made: " + JSON.stringify(mk).slice(0, 300));
    fd = new FormData(); fd.append("images", new Blob([PNG], { type: "image/png" }), "prop.png");
    await fetch(URL_ + "api/scenes/1/refs", { method: "POST", body: fd });
    await open();

    /* 1 ten pictures (two pasted ones both "image.png"), no 💾 */
    await ev(async () => { for (let i = 0; i < 10; i++) { const c = document.createElement("canvas"); c.width = 16 + i; c.height = 16; c.getContext("2d").fillRect(0, 0, 4, 4); const bl = await new Promise((r) => c.toBlob(r, "image/png"));
      const f = new File([bl], i < 2 ? "image.png" : `p${i}.png`, { type: "image/png" }); refs.push({ file: f, url: URL.createObjectURL(f), subject: 1, role: "person", roleOther: "", desc: i === 3 ? "a red car" : "" }); } renderTray(); });
    let d = await waitPrj((x) => x.references && x.references.images && x.references.images.length === 10);
    const im = (d.references || {}).images || [];
    check("ten pictures in the reference docker are KEPT in the project within seconds - no 💾 needed (all ten: a save used to keep 9)", im.length === 10 && im.every((x) => fs.existsSync(path.join(ROOT, "projects", P, "reference", "images", x.file))), im.map((x) => x.file));
    check("...the two pasted \"image.png\" pictures keep their own names (image.png, image_2.png) and their own bytes; a description rides along",
      im[0].file === "image.png" && im[1].file === "image_2.png" && im[3].desc === "a red car"
      && Buffer.compare(fs.readFileSync(path.join(ROOT, "projects", P, "reference", "images", "image.png")), fs.readFileSync(path.join(ROOT, "projects", P, "reference", "images", "image_2.png"))) !== 0, im.slice(0, 4));

    /* 2 a mode that takes fewer pictures no longer throws the rest away */
    await ev(() => document.querySelector('.modes button[data-mode="fl2va"]').click()); await p.waitForTimeout(200);
    const fl = await ev(() => ({ n: refs.length, dim: document.querySelectorAll("#tray .slot.unused").length, plan: RefRoles.plan("fl2va", refs).refs.length }));
    await ev(() => document.querySelector('.modes button[data-mode="t2va"]').click()); await p.waitForTimeout(200);
    const tx = await ev(() => ({ n: refs.length, hint: document.getElementById("tray").textContent }));
    await ev(() => document.querySelector('.modes button[data-mode="ref2va"]').click()); await p.waitForTimeout(200);
    const back = await ev(() => refs.length);
    check("F/L keeps all ten (8 shown faded - F/L sends the first 2), Text keeps them (\"10 pictures kept\"), back to Ref = all ten (they were thrown away)",
      fl.n === 10 && fl.dim === 8 && fl.plan === 2 && tx.n === 10 && /10 pictures kept/.test(tx.hint) && back === 10, { fl, tx, back });

    /* 3 close (a reload, no 💾) -> they come back */
    await open();
    const r1 = await ev(() => ({ n: refs.length, names: refs.map((r) => r.file.name).slice(0, 3), desc: refs[3] && refs[3].desc }));
    check("closed and opened again WITHOUT 💾 Save: the ten pictures are back (with the description)", r1.n === 10 && r1.names[1] === "image_2.png" && r1.desc === "a red car", r1);
    await ev(() => { refs.splice(9, 1); renderTray(); });
    d = await waitPrj((x) => x.references && x.references.images.length === 9);
    check("one taken out: the project follows (9)", (d.references || {}).images.length === 9);

    /* 4 💾 Save with more than nine */
    await ev(async () => { const c = document.createElement("canvas"); c.width = 40; c.height = 40; const bl = await new Promise((r) => c.toBlob(r, "image/png")); const f = new File([bl], "late.png", { type: "image/png" }); refs.push({ file: f, url: URL.createObjectURL(f), subject: 1, role: "person", roleOther: "", desc: "" }); });
    const sv = await ev(async () => { const j = await projSave(document.getElementById("projname").textContent); return j ? (j.references || {}).images.length : -1; });
    check("💾 Save with 10 pictures: saved, all 10 (a 10th upload refused the whole save - \"too many files\")", sv === 10, sv);

    /* 5 the storyboard's shared prompt: kept as it is typed */
    await p.waitForFunction(() => document.getElementById("scPrefix") && /@hat/.test(document.getElementById("scPrefix").value), null, { timeout: 20000 });
    await p.click("#scPrefix"); await p.keyboard.press("End"); await p.keyboard.type("\nthe @hat sits on her head");
    await p.click("#prompt"); await p.waitForTimeout(2500);
    let pre = (((prj().scenes || {}).plan || {}).prompt_prefix || []).join("\n");
    check("the shared prompt typed into (no 💾) and left: KEPT on the server, the @hat line too", /the @hat sits on her head/.test(pre), pre);
    await p.waitForTimeout(3500);                              // a board poll: the box keeps it
    check("...a board repaint does not put the old text back", /sits on her head/.test(await ev(() => document.getElementById("scPrefix").value)));
    await p.click("#scPrefix"); await p.keyboard.press("End"); await p.keyboard.type("\nlast line before closing");
    await open();
    pre = (((prj().scenes || {}).plan || {}).prompt_prefix || []).join("\n");
    check("typed and the app closed at once: the last line is kept (on close)", /last line before closing/.test(pre) && /last line before closing/.test(await ev(() => document.getElementById("scPrefix").value)), pre);

    /* 6 the scene and chapter references through Save, close, reload */
    await ev(async () => { await projSave(document.getElementById("projname").textContent); });
    await open();
    const sc = await J("/api/scenes"), cr = await J("/api/scenes/refs");
    const ui = await ev(() => ({ scImgs: document.querySelectorAll("[data-screfs] img").length, chap: document.querySelectorAll("[data-refdel]").length, refs: refs.length }));
    check("the scene's picture and the chapter reference (@hat) are there after 💾 Save and a close (on the server and on the board); the dock still has its 10",
      ((sc.list || [])[0] || {}).refs && sc.list[0].refs[0].file === "prop.png" && (cr.refs || {})[""] && cr.refs[""][0].tag === "hat" && ui.scImgs >= 1 && ui.chap >= 1 && ui.refs === 10, { s: (sc.list || [])[0], cr: cr.refs, ui });

    /* 7 a page left on another project never writes into this one */
    const r409 = await fetch(URL_ + "api/projects/refs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project: "some other project", references: { images: [] } }) });
    check("a page showing another project: refused (409), nothing written", r409.status === 409 && prj().references.images.length === 10, r409.status);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    try { await J("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
