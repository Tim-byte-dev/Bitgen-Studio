#!/usr/bin/env node
/* bitGen Studio — 2.302.0: A SCENE'S "TRIM FIRST FRAME" CHECKBOX.
 * Run: node scripts/test-trimfirst.js
 *
 * Tim (verbatim): "please add a trim first frame checkbox to the left of the
 * first frame label in each scene. right now if i use the last frame from
 * the previous scene i am duplicating the frame so u can see the jump. i
 * want to make the merge seamless. when trim first frame is checked, add an
 * additional frame before render (to keep the same frame count) and remove
 * the first frame of the video from the raw and compressed versions".
 *   1. the board keeps the flag (scenes.safe) and a plan rewrite carries it
 *      by scene id (scenes.fromPlan);
 *   2. the card: a checkbox LEFT of the "First frame" label on every scene
 *      with a First slot (none on Ref's Last-only row), it posts the flag
 *      and never reaches the card;
 *   3. the render: one extra frame, the song window 1/24 s earlier, the
 *      worker told to drop 1 head frame - only for a scene that starts on
 *      a frame. The worker's trim itself (master + take, frame-exact) is
 *      proved against real ffmpeg in scripts/test-rawmaster.py; the whole
 *      path runs LIVE in the e2e. */
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

// ---- 1. the board ------------------------------------------------------------------
{
  const S = require(path.join(ROOT, "lib", "scenes"));
  const st = S.safe({ list: [{ n: 1, id: "c1", prompt: ["a"], trim_first: true },
                             { n: 2, id: "c2", prompt: ["b"], trim_first: "yes" }] });
  check("safe(): trim_first survives as true, anything else is dropped",
    st.list[0].trim_first === true && st.list[1].trim_first === undefined, st.list.map((r) => r.trim_first));
  const plan = { prompt_prefix: [], shots: [{ id: "c0", prompt: ["new"] }, { id: "c1", prompt: ["a"] }] };
  const re = S.fromPlan(plan, st);
  check("fromPlan(): the flag follows its scene by ID through a rewrite (scene 1 is now scene 2)",
    re.list[1].id === "c1" && re.list[1].trim_first === true && re.list[0].trim_first === undefined,
    re.list.map((r) => [r.id, r.trim_first]));
}

// ---- 2. the card -------------------------------------------------------------------
{
  const probe = `
const { JSDOM } = require("jsdom");
const fs = require("fs");
const dom = new JSDOM("<body>" + fs.readFileSync("ext/videodock/dock.html", "utf8") + "</body>",
  { url: "http://x/", runScripts: "outside-only", pretendToBeVisual: true });
const w = dom.window;
const posts = [];
const board = { chapters: [], pending: [], plan: { shots: [] }, style: "MMH3_NativeAudio_MV", audio: "",
  list: [{ n: 1, id: "c1", prompt: ["a"], status: "idle", anchor: "reference" },
         { n: 2, id: "c2", prompt: ["b"], status: "idle", anchor: "first", trim_first: true },
         { n: 3, id: "c3", prompt: ["c"], status: "idle", anchor: "continue" }] };
w.fetch = (u, o) => {
  u = String(u); const bare = u.split("?")[0];
  const ok = (b) => Promise.resolve({ ok: true, json: () => Promise.resolve(b) });
  if (o && o.method === "POST") {
    posts.push([bare, JSON.parse(o.body || "{}")]);
    const m = /^\\/api\\/scenes\\/(\\d+)\\/trim-first$/.exec(bare);
    if (m) { const r = board.list.find((x) => x.n === +m[1]); r.trim_first = JSON.parse(o.body).on || undefined;
             return ok({ ok: true, n: r.n, trim_first: !!r.trim_first }); }
  }
  if (bare === "/api/scenes") return ok(JSON.parse(JSON.stringify(board)));
  if (bare === "/api/pmedia") return ok({ sound: [], images: [] });
  return ok({ ok: true, characters: [], environments: [], refs: {}, movies: [] });
};
global.window = w; global.document = w.document; global.fetch = w.fetch;
global.FormData = w.FormData; global.CustomEvent = w.CustomEvent;
w.eval(fs.readFileSync("static/pmedia.js", "utf8"));
const src = fs.readFileSync("ext/videodock/characters.js", "utf8");
const ids = new Set(); src.replace(/el\\("([\\w-]+)"\\)/g, (m, id) => ids.add(id));
for (const id of ids) if (!w.document.getElementById(id)) {
  const e = w.document.createElement(/Sel$|Select$/.test(id) ? "select" : "input");
  e.id = id; e.style.display = "none"; w.document.body.appendChild(e);
}
w.eval(src);
const q = (s) => w.document.querySelector(s);
const qa = (s) => [...w.document.querySelectorAll(s)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const out = {};
  w.document.dispatchEvent(new w.CustomEvent("vd:scenes-changed"));
  await wait(300);
  out.boxes = qa("[data-sctrim]").map((b) => [b.dataset.sctrim, b.checked]);
  const slot = q('[data-scfl="3"][data-slot="first"]');
  const kids = [...slot.children];
  out.order = kids.map((k) => k.matches("[data-sctrim]") ? "box" : /First frame/.test(k.textContent) ? "label" : k.tagName);
  out.lastHas = !!q('[data-scfl="3"][data-slot="last"] [data-sctrim]');
  out.label = q('[data-sctrim="3"]').getAttribute("aria-label");
  const sel0 = qa(".sccard").filter((c) => /background:#20242c/.test(c.getAttribute("style"))).length;
  q('[data-sctrim="3"]').click();
  await wait(200);
  out.posts = posts.filter((p) => /trim-first/.test(p[0]));
  out.checkedAfter = q('[data-sctrim="3"]').checked;
  out.selected = qa(".sccard").filter((c) => /background:#20242c/.test(c.getAttribute("style"))).length - sel0;
  out.note = q("#scNotes").textContent;
  q('[data-sctrim="2"]').click();
  await wait(200);
  out.posts2 = posts.filter((p) => /trim-first/.test(p[0])).slice(1);
  console.log("@@TF " + JSON.stringify(out));
  process.exit(0);
})();`;
  let d = null;
  try {
    const o = execFileSync(process.execPath, ["-e", probe], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
    const line = o.split("\n").find((l) => l.startsWith("@@TF "));
    d = line ? JSON.parse(line.slice(5)) : { raw: o.slice(-800) };
  } catch (e) { d = { error: String(e.message).slice(0, 800) }; }
  check("a checkbox on every scene with a First slot (First, Cont) - not on Ref's Last-only row; scene 2's is ticked",
    d && JSON.stringify(d.boxes) === '[["2",true],["3",false]]', d && d.boxes);
  check("it sits to the LEFT of the \"First frame\" label, and only in the First slot",
    d && d.order && d.order.indexOf("box") === 0 && d.order.indexOf("label") === 1 && d.lastHas === false, d && [d.order, d.lastHas]);
  check("it is labelled for screen readers", d && d.label === "Trim the first frame of scene 3", d && d.label);
  check("ticking it posts {on:true} for that scene, stays ticked, says so, and never selects the card",
    d && JSON.stringify(d.posts) === '[["/api/scenes/3/trim-first",{"on":true}]]' && d.checkedAfter === true
    && d.selected === 0 && /first frame is trimmed on the next render/.test(d.note), d);
  check("unticking posts {on:false}", d && JSON.stringify(d.posts2) === '[["/api/scenes/2/trim-first",{"on":false}]]', d && d.posts2);
}

// ---- 3. the render -------------------------------------------------------------------
{
  const RC = read("routes", "characters.js"), W = read("misc/worker.py");
  check("the render: only a scene that STARTS on a frame (First / Cont / Trans) and not an upscale",
    RC.includes('const trimHead = r.trim_first === true && !upscale\n    && ["first", "continue", "transition", "last"].includes(String(r.anchor || ""));'));
  check("...renders ONE more frame, starts its song window 1/24 s earlier, and tells the worker to drop 1 head frame",
    /if \(trimHead\) \{\s*frames \+= 1;/.test(RC)
    && RC.includes("audioWin = { start: (audioWin.start || 0) - back,")
    && RC.includes("trim_head: trimHead ? 1 : 0,"));
  check("the worker trims the take (and its master) right after the final join",
    W.includes('_trim_head(final, master_join if master_join.exists() else None,\n                       int(params["trim_head"]), fmt)'));
  check("the route: POST /api/scenes/:n/trim-first {on}",
    RC.includes('app.post("/api/scenes/:n/trim-first"') && RC.includes("r.trim_first = b.on === true ? true : undefined;"));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
