#!/usr/bin/env node
/* bitGen Studio — ▶ AS WRITTEN (2.293.0).
 * Run: node scripts/test-autorender.js
 *
 * Tim (verbatim): "can we populate each scene as they are created so users
 * with 2 gpu's can start rendering while waiting for new scenes to be
 * created".
 *   1. lib/autoRender - live vs after from the two cards, the queue rule
 *      (blank / rendered / missing / already queued skipped, story order);
 *   2. the board switch survives the sanitizer and a plan rewrite;
 *   3. the writer wiring (seed write-back, staged blanks kept, queue per
 *      scene, one-card LLM hand-off, ComfyUI beside the writer);
 *   4. the video docker in jsdom: the switch mirrors the board and posts,
 *      the board refreshes WHILE the writer works, the music-video ask
 *      keeps a native-audio board.
 * The LIVE parallel render rides the e2e (a slowed writer, scene 1 seen
 * rendering before the writer returns). */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const AR = require("../lib/autoRender");
const SC = require("../lib/scenes");

// ---- 1. the library ---------------------------------------------------------
{
  const on = { auto_render: true };
  check("off unless the board switch is on",
    AR.mode({}, {}).mode === "off" && AR.mode({}, { auto_render: "yes" }).mode === "off");
  const live = AR.mode({ llm: { device: "cuda1" }, comfy: { gpu: "cuda0" } }, on);
  check("LLM and ComfyUI on different cards = LIVE (each scene renders as it is written), said by card",
    live.mode === "live" && /renders on cuda0/.test(live.note) && /writer runs on cuda1/.test(live.note), live);
  check("...the defaults (LLM cuda1, render cuda0) are two cards",
    AR.mode({}, on).mode === "live");
  check("...an LLM on the CPU never fights the render for VRAM",
    AR.mode({ llm: { device: "cpu" }, comfy: { gpu: "cuda0" } }, on).mode === "live");
  const after = AR.mode({ llm: { device: "cuda0" }, comfy: { gpu: "cuda0" } }, on);
  check("ONE card = AFTER (queued when the writer finishes) and the note says how to get LIVE",
    after.mode === "after" && /Settings → LLM → device/.test(after.note), after);

  const B = SC.safe({ pending: ["clip_09"], list: [
    { n: 1, id: "clip_01", prompt: ["@a sings"], status: "idle" },
    { n: 2, id: "clip_02", prompt: ["[Shot 2] (blank - awaiting the writer: song segment 2, 5s to 10s)"] },
    { n: 3, id: "clip_03", prompt: ["@a walks"], status: "rendered", output: "x.mp4" },
    { n: 4, id: "clip_04", prompt: ["@a runs"], status: "running", job: "j1" },
    { n: 5, id: "clip_05", prompt: ["@a stops"], status: "failed" },
    { n: 9, id: "clip_09", prompt: ["@a waits"] }] });
  const q = AR.queueWritten(B, [1, 2, 3, 4, 5, 7, 9]);
  const why = Object.fromEntries(q.skipped.map((x) => [x.n, x.why]));
  check("queueWritten: written idle/failed scenes queue BEHIND what is already queued, in story order",
    JSON.stringify(q.queued) === "[1,5]"
    && JSON.stringify(q.state.pending) === '["clip_09","clip_01","clip_05"]', q.state.pending);
  check("...a blank staged scene, a scene with a take for this text, one already rendering or queued, and a missing one are skipped by reason",
    why[2] === "blank" && why[3] === "already rendered" && why[4] === "already rendering or queued"
    && why[9] === "already rendering or queued" && why[7] === "no such scene", q.skipped);
}

// ---- 2. the switch survives --------------------------------------------------------
{
  const s = SC.safe({ auto_render: true, list: [{ n: 1, id: "c1", prompt: ["a"] }] });
  check("scenes.safe keeps auto_render (only a real true)",
    s.auto_render === true && SC.safe({ auto_render: 1 }).auto_render === undefined);
  check("fromPlan carries the switch through a writer save",
    SC.fromPlan({ shots: [{ id: "c1", prompt: ["b"] }] }, s).auto_render === true);
}

// ---- 3. the writer wiring -----------------------------------------------------------
{
  const RC = read("routes", "characters.js");
  check("the writer asks lib/autoRender which way to run and brings ComfyUI + the style's base up BESIDE it (never blocking a scene)",
    RC.includes("const ar = autoRender.mode(core.getConfig(), scenes.load(b.project));")
    && RC.includes("try { await comfy.ensure({ force: true }); }")
    && RC.includes("const eb = await ensureChainBase(scenes.load(b.project).style);")
    && RC.includes('if (arState === "ready") syncJobs(b.project);'));
  check("LIVE: each saved scene joins the queue the moment it lands",
    RC.includes("const q = autoRender.queueWritten(stW, [sceneBridge.contentN(stW, i) || i]);"));   // 2.358.0: bridges sit between
  check("the seed normalize drew is written back into the shot (a scene rendering from a partial save renders the final plan's seed)",
    RC.includes("shots[k].seed = ps.seed;"));
  check("staged BLANK scenes past the written ones stay on the board while the writer works",
    RC.includes(".filter((sh) => sh && segBoard.isBlank(sh.prompt));")
    && RC.includes("scenes.save(scenes.fromPlan(withStaged, st0), b.project);"));
  check("ONE card: the LLM is stopped and its card settled BEFORE the written scenes queue",
    RC.indexOf("core.stopLlama();", RC.indexOf('ar.mode === "after"'))
      < RC.indexOf("shots.map((_, k) => sceneBridge.contentN(stW, k + 1) || k + 1));")
    && RC.includes("await core.gpuSettle(ar.devices.llm);"));
  check("a ComfyUI that cannot come up takes OUR queued scenes back out and says so",
    RC.includes('arNotes.push("▶ as written stopped: " + why);')
    && RC.includes("pending: (st1.pending || []).filter((id) => !mine.has(id))"));
  check("the writer's answer reports it (rendering: {mode, queued}); POST /api/scenes/auto-render sets the switch",
    RC.includes("rendering: { mode: ar.mode, queued: arQueued } });")
    && RC.includes('app.post("/api/scenes/auto-render"'));
}

// ---- 4. the video docker in jsdom -----------------------------------------------------
{
  const probe = `
const { JSDOM } = require("jsdom");
const fs = require("fs");
const dom = new JSDOM("<body>" + fs.readFileSync("ext/videodock/dock.html", "utf8") + "</body>",
  { url: "http://x/", runScripts: "outside-only", pretendToBeVisual: true });
const w = dom.window;
const posts = []; let gets = 0; let finishWriter;
const board = { chapters: [], pending: [], plan: { shots: [] }, auto_render: true,
  style: "MMH3_NativeAudio_MV", list: [] };
w.fetch = (u, o) => {
  u = String(u).split("?")[0];
  if (o && o.method === "POST") posts.push({ u, body: o.body });
  if (u === "/api/scenes") gets++;
  if (u === "/api/screenplay/intent") return Promise.resolve({ ok: true, json: () =>
    Promise.resolve({ wants: true, music_video: true }) });
  if (u === "/api/screenplay") return new Promise((res) => { finishWriter = () => res({ ok: true,
    json: () => Promise.resolve({ ok: true, plan: { shots: [] }, warnings: [],
      rendering: { mode: "live", queued: [1, 2] } }) }); });
  if (u === "/api/screenplay/apply") return Promise.resolve({ ok: true,
    json: () => Promise.resolve({ ok: true, scenes: 2 }) });
  const body = u === "/api/scenes" ? board : { ok: true, characters: [], environments: [], refs: {} };
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
};
global.window = w; global.document = w.document; global.fetch = w.fetch;
global.FormData = w.FormData; global.CustomEvent = w.CustomEvent;
const src = fs.readFileSync("ext/videodock/characters.js", "utf8");
// the docker's init also binds the CORE page's character dialog (index.html);
// stand in an element for every id it names that dock.html lacks, so init
// runs to the end (scInit) exactly as on the real page
const ids = new Set(); src.replace(/el\\("([\\w-]+)"\\)/g, (m, id) => ids.add(id));
for (const id of ids) if (!w.document.getElementById(id)) {
  const e = w.document.createElement(/Sel$|Select$/.test(id) ? "select" : "input");
  e.id = id; e.style.display = "none"; w.document.body.appendChild(e);
}
w.eval(src);
setTimeout(() => {
  w.document.dispatchEvent(new w.CustomEvent("vd:scenes-changed"));
  setTimeout(() => {
    const cb = w.document.getElementById("vdAutoRender");
    const checked = cb && cb.checked;
    cb.checked = false; cb.dispatchEvent(new w.Event("change"));
    const g0 = gets;
    const reply = w.bgScenes.maybeScreenplay("create the music video for this song");
    setTimeout(() => {
      const during = gets - g0;
      finishWriter();
      reply.then((msg) => {
        console.log("@@AR " + JSON.stringify({ checked, posts, during, msg }));
        process.exit(0);
      });
    }, 7000);
  }, 200);
}, 200);`;
  let d = null;
  try {
    const o = execFileSync(process.execPath, ["-e", probe], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
    const line = o.split("\n").find((l) => l.startsWith("@@AR "));
    d = line ? JSON.parse(line.slice(5)) : { raw: o.slice(-400) };
  } catch (e) { d = { error: String(e.message).slice(0, 400) }; }
  const P = (u) => (d && d.posts || []).filter((p) => p.u === u).map((p) => JSON.parse(p.body));
  check("jsdom: the ▶ as written box mirrors the board's switch",
    d && d.checked === true, d);
  check("jsdom: unticking it posts {on:false} to /api/scenes/auto-render",
    JSON.stringify(P("/api/scenes/auto-render")) === '[{"on":false}]', d && d.posts);
  check("jsdom: the board REFRESHES while the writer is still working (each scene shows as it lands)",
    d && d.during >= 2, d && d.during);
  check("jsdom: the music-video ask keeps a board already on MMH3_NativeAudio_MV (no switch to MMH3_Music_Video, no segment re-bind)",
    JSON.stringify(P("/api/scenes/style")) === '[{"name":"MMH3_NativeAudio_MV"}]'
    && !(d.posts || []).some((p) => p.u === "/api/stems/reassign"), d && d.posts);
  check("jsdom: the chat says the scenes were queued as they were written",
    d && /▶ as written: 2 scene\(s\) queued to render as they were written\./.test(d.msg || ""), d && d.msg);
  const DH = read("ext", "videodock", "dock.html");
  check("the menubar carries the switch with its two-GPU explanation",
    DH.includes('id="vdAutoRender"') && DH.includes("on one GPU they start when the writer finishes"));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
