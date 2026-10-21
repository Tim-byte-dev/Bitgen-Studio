#!/usr/bin/env node
/* bitGen Studio — 2.562.0 against the running app: a StoryBoard scene whose render job a restart took away says how to get
 * it back (not "the job vanished"), keeps the job; ▶ Resume in the Queue docker's Pending tab hands the job back to the
 * scene - running again (its progress bar), no ⚠ (lib/sceneResume.js). Also: opening a take / a finished job does not play
 * it (Tim: "don't automatically play videos or music").
 * Tim: "when server is restarted and the job is resumed in the queue docker replace ⚠ the job vanished (server
 * restarted?) in the scene in storyboard docker with the progressbar". No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.562.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "e2e_sr562", JID = "e2esr562" + Date.now().toString(36);   // a fresh id each run (a run before leaves its job in memory)
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body, method) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined && !method ? {} :
  { method: method || "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })).json();

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const scenes = require(path.join(ROOT, "lib", "scenes.js")), core = require(path.join(ROOT, "lib", "core.js"));
  try {
    await api("/api/projects/load", { name: P });
    const pd = core.projDir(P);
    fs.mkdirSync(pd, { recursive: true });
    // the board as a restart left it: scene 1 rendering job JID, which is not in memory; jobs.info has it pending with its params
    scenes.save(scenes.safe({ list: [{ n: 1, id: "clip_01", prompt: ["a red fox in the snow"], status: "running", job: JID }] }), P);
    fs.writeFileSync(path.join(pd, "jobs.info"), JSON.stringify([{ id: JID, state: "pending", status: "running", mode: "t2v", prompt: "a red fox in the snow", width: 320, height: 192, created: Date.now() / 1000,
      params: { mode: "t2v", prompt: "a red fox in the snow", width: 320, height: 192, frames: 9, steps: 1, seed: 1, format: "mp4" } }]));
    const s0 = await api("/api/scenes");
    const r0 = (s0.list || [])[0] || {};
    check("after the restart the scene says how to get its job back (↻ Resume in the Queue docker) - not \"the job vanished\" - and keeps the job id",
      r0.status !== "running" && /↻ Resume it in the Queue docker/.test(r0.error || "") && !/vanished/.test(r0.error || "") && r0.lost && r0.lost.job === JID, r0);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && typeof selectJob === "function", null, { timeout: 60000 });
    await p.waitForTimeout(2500);
    const card0 = await ev(() => { const c = document.querySelector('[data-scprog="1"]'); const t = document.getElementById("videodock") ? document.getElementById("videodock").textContent : ""; return { bar: !!c, resumeWords: /↻ Resume it in the Queue docker/.test(t), vanished: /job vanished/.test(t) }; });
    check("the StoryBoard card shows those words (no \"vanished\")", card0.resumeWords && !card0.vanished, card0);
    // ▶ Resume in the Queue docker's Pending tab (the button the page draws for an interrupted entry)
    const clicked = await ev(async (jid) => {
      if (typeof refreshJobs === "function") await refreshJobs();
      await new Promise((r) => setTimeout(r, 800));
      const el = [...document.querySelectorAll(".job.hist")].find((x) => x.textContent.includes(jid));
      const btn = el && [...el.querySelectorAll("button")].find((x) => /Resume/.test(x.textContent));
      if (!btn) return false; btn.click(); return true;
    }, JID);
    let r1 = {};
    if (!clicked) { const j = await api(`/api/jobs/history/${JID}/resume`, {}); check("(the Pending tab's ▶ Resume was not drawn - resumed through its endpoint)", !!j.id, j); }
    for (let i = 0; i < 20; i++) { const s1 = await api("/api/scenes"); r1 = (s1.list || [])[0] || {}; if (r1.job === JID) break; await p.waitForTimeout(150); }
    check("▶ Resume hands the job back to the scene: its job again, running (or already finished by its own verdict) - no ⚠ about a restart, nothing lost",
      r1.job === JID || (r1.status !== "idle" || !/Resume it in the Queue|vanished/.test(r1.error || "")), r1);
    check("...the scene is running with it (the card's ⏳ / progress bar), its error cleared", r1.job === JID && r1.status === "running" && !r1.error && !r1.lost, r1);
    await api(`/api/jobs/${JID}/cancel`, {});
    // nothing plays by itself: open a finished take in the player
    const auto = await ev(async () => {
      const pl = document.getElementById("player"); if (!pl || typeof playVideo !== "function") return { skip: true };
      playVideo("__e2e_none__.mp4"); await new Promise((r) => setTimeout(r, 600));
      return { paused: pl.paused, autoplay: pl.autoplay };
    });
    check("opening a take in the player does not start it (paused until ▶ / Space)", auto.skip || (auto.paused && !auto.autoplay), auto);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    try { await api(`/api/jobs/${JID}/cancel`, {}); } catch { /* fine */ }
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* best effort */ }
    await new Promise((r) => setTimeout(r, 1500));                       // (the cancelled job records itself in jobs.info first)
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
    try { fs.rmSync(path.join(require(path.join(ROOT, "lib", "core.js")).JOBS_DIR, JID), { recursive: true, force: true }); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
