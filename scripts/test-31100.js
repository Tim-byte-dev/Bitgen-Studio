#!/usr/bin/env node
/* bitGen Studio — 3.11.0: ✍ CONTINUE in the Edit Booth's piano roll - the Anticipatory Music Transformer writes the next bars of a
 * note clip (lib/amtNotes.js, lib/amtAddon.js, routes/amt.js, misc/amt_worker.py + amt_run.py, ext/synthdock/synthroll.js) -
 * pure + the wiring. The worker / runner: scripts/test-amt-31100.py; the piano roll in a real browser: scripts/test-ui31100-ui.js.
 * Tim: "okay let go with 1" (the Anticipatory Music Transformer for ✍ Continue - step 2 of "our own Magenta") */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const AN = require(path.join(ROOT, "lib/amtNotes.js"));
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);

(async () => {
  /* ---------------- the notes in and out */
  const notes = [{ m: 60, t: 0, d: 0.5, v: 0.8 }, { m: 64, t: 0.5, d: 0.5, v: 0.6 }, { m: 67, t: 1.0, d: 0.7, v: 1 }];
  const p = AN.plan(notes, { bpm: 120, bars: 2 });
  check("plan: it writes from where the music stops (1.7 s) up to the next beat (2.0 s), 2 bars of 4 at 120 BPM (4 s)", near(p.from, 2) && near(p.to, 6) && near(p.start, 2) && near(p.end, 6) && p.offset === 0 && p.bars === 2, p);
  check("…the notes the model reads: pitch, time, length (10 ms steps)", JSON.stringify(p.notes) === JSON.stringify([{ m: 60, t: 0, d: 0.5 }, { m: 64, t: 0.5, d: 0.5 }, { m: 67, t: 1, d: 0.7 }]), p.notes);
  const long = Array.from({ length: 200 }, (_, i) => ({ m: 60 + (i % 12), t: i * 0.5, d: 0.4, v: 0.7 }));
  const pl = AN.plan(long, { bpm: 120, bars: 4, window: 60 });
  check("a long clip: only its last 60 s are read, moved to 0 (the model knows 100 s at most)", near(pl.from, 100) && near(pl.offset, 40) && near(pl.start, 60) && near(pl.end, 68) && pl.notes.length === 120 && pl.notes[0].t === 0, { from: pl.from, offset: pl.offset, n: pl.notes.length, first: pl.notes[0] });
  check("an empty clip: it writes from 0", (() => { const e = AN.plan([], { bpm: 90, bars: 1 }); return e.from === 0 && near(e.to, 4 * 60 / 90) && !e.notes.length; })());
  check("bars held to 1 - 8, BPM to 20 - 300, bad notes dropped, a note longer than 10 s cut to the model's limit", AN.plan(notes, { bars: 99 }).bars === 8 && AN.plan(notes, { bars: 0 }).bars === 1 && AN.plan([{ m: "x" }, { m: 60, t: 0, d: 30 }], { bpm: 1 }).notes[0].d === 9.99 && AN.plan([], { bpm: 1 }).bpm === 20);
  const gen = [{ m: 62, t: 2.0, d: 0.5 }, { m: 70, t: 5.9, d: 0.5 }, { m: 50, t: 1.0, d: 0.3 }, { m: 72, t: 6.5, d: 0.2 }, { m: 200, t: 3, d: 1 }];
  const b = AN.back(gen, p, { v: 0.8 });
  check("back: the model's notes in [from, to) only, cut at the end, the clip's velocity", b.length === 2 && b[0].m === 62 && near(b[0].t, 2) && b[0].v === 0.8 && b[1].m === 70 && near(b[1].d, 0.1, 1e-9), b);
  check("…drum hits (instrument 128, when one instrument is off) left out - their pitch is a drum", AN.back([{ m: 36, t: 2.5, d: 0.1, instr: 128 }, { m: 60, t: 2.5, d: 0.1, instr: 33 }], p, {}).map((n) => n.m).join() === "60");
  check("…a long clip's notes put back where they belong (+ the offset)", (() => { const x = AN.back([{ m: 60, t: 61, d: 1 }], pl, {}); return x.length === 1 && near(x[0].t, 101) && x[0].v === 0.75; })());
  check("velOf: the clip's mean velocity (the model writes none)", AN.velOf(notes) === 0.8 && AN.velOf([]) === 0.75);
  check("the instruments it can be told the notes are: General MIDI programs, Piano first", AN.INSTR[0].id === 0 && AN.INSTR.length === 10 && AN.INSTR.every((i) => i.id >= 0 && i.id < 128));

  /* ---------------- the add-on */
  const A = require(path.join(ROOT, "lib/amtAddon.js"));
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "amt-")), P = A.paths(base);
  check("not installed: its Python, the code, its packages, a model", A.missing(base).length === 4 && !A.ready(base) && /not installed/.test(A.status(base).note) && /Apache-2\.0/.test(A.status(base).note));
  check("the Download box ticks: small + medium by default, large not (3 GB; trained on commercial records' transcriptions too - said)", JSON.stringify(A.status(base).items.map((i) => [i.id, i.dflt])) === '[["small",true],["medium",true],["large",false]]' && /commercial records/.test(A.status(base).items[2].for));
  const SA = require(path.join(ROOT, "lib/speechAddons.js")), realOk = SA.pythonOk; SA.pythonOk = async () => ({ ver: "3.12" });
  const calls = [];
  const run = async (exe, args, o) => {
    calls.push(path.basename(exe) + " " + args.join(" ") + (o && o.env && o.env.HF_TOKEN ? " [token]" : ""));
    if (args[0] === "-m" && args[1] === "venv") { fs.mkdirSync(path.dirname(P.python), { recursive: true }); fs.writeFileSync(P.python, "#!"); return 0; }
    return 0;
  };
  const fetchRepo = async (_u, dest) => { fs.mkdirSync(path.join(dest, "anticipation"), { recursive: true }); fs.writeFileSync(path.join(dest, "anticipation", "sample.py"), "x"); return { ok: true }; };
  let r;
  try { r = await A.install({ base, run, python: "/usr/bin/python3", gpu: { cuda: false, torch: [] }, uv: "uv", log: () => {}, fetchRepo, hfToken: "hf_x", picks: ["small"] }); } finally { SA.pythonOk = realOk; }
  const txt = calls.join("\n");
  check("install (no NVIDIA card here): its venv, torch 2.8 from the CPU wheels, transformers 4.x (not its 4.29 pin), mido; only the ticked model", r && r.ok && /torch==2\.8\.0 --index-url https:\/\/download\.pytorch\.org\/whl\/cpu/.test(txt) && /transformers>=4\.44,<5/.test(txt) && /mido/.test(txt) && /music-small-800k.*\[token\]/.test(txt) && !/music-medium/.test(txt), { r, txt: txt.slice(0, 700) });
  check("…ready with the small one", A.ready(base) && A.haveModels(base).small && !A.haveModels(base).medium && /ready - small/.test(A.status(base).note));
  process.env.BITGEN_ADDON_BASE = base;
  const j1 = A.jobParams({ notes, bpm: 120, bars: 2, model: "small", instr: 33, top_p: 2, seed: "5" });
  check("a job: mode amt, the small model's repo, the plan's notes / start / end, bass, top_p held to 1, the seed, one instrument by default", j1.params && j1.params.mode === "amt" && j1.params.model === "stanford-crfm/music-small-800k" && j1.params.notes.length === 3 && near(j1.params.start, 2) && near(j1.params.end, 6)
    && j1.params.instr === 33 && j1.params.top_p === 1 && j1.params.seed === 5 && j1.params.only === true && j1.params.amt.python === P.python && j1.params.plan.to === 6 && j1.params.vel === 0.8, j1);
  check("…the medium model not here -> 409 with what is missing (its Download box)", (() => { const j = A.jobParams({ notes, model: "medium" }); return j.status === 409 && j.missing[0].id === "w_medium"; })());
  check("…an unknown instrument -> piano; no seed -> a random one", A.jobParams({ notes, instr: 7 }).params.instr === 0 && Number.isInteger(A.jobParams({ notes }).params.seed));
  delete process.env.BITGEN_ADDON_BASE;

  /* ---------------- the wiring */
  const core = read("lib/core.js"), idx = read("routes/index.js"), rt = read("routes/amt.js"), wk = read("misc/amt_worker.py"), rn = read("misc/amt_run.py"), roll = read("ext/synthdock/synthroll.js"), html = read("ext/synthdock/dock.html");
  check("mode amt -> misc/amt_worker.py, a tool mode (its result is the notes, no file); the route from routes/index.js (server.js untouched)", /amt: "amt_worker\.py"/.test(core) && /"lora_merge",\s+"amt"\]/.test(core) && /require\("\.\/amt"\)\.mount\(app\)/.test(idx) && !/amt/i.test(read("misc/server.js")));
  check("Settings ▸ Add-ons lists it, the ticks passed to its install", (() => { const a = require(path.join(ROOT, "lib/addons.js")).LIST.find((x) => x.id === "amt"); return !!a && /picks/.test(a.install.toString()) && a.links().length === 4; })());
  check("the route: 409 needs amt; the notes from the job's folder (amt/notes.json) put back in the clip's time; 202 while it waits", /needs: jp\.status === 409 \? "amt"/.test(rt) && /path\.join\(job\.dir, "amt", "notes\.json"\)/.test(rt) && /AN\.back\(j\.notes, pl, \{ v: job\.params\.vel \}\)/.test(rt) && /status\(202\)/.test(rt));
  check("the worker: the runner in the add-on's Python, offline, the code on PYTHONPATH; the runner: generate() with its progress, one instrument kept", /HF_HUB_OFFLINE="1"/.test(wk) && /PYTHONPATH=str\(src\)/.test(wk) && /S\.generate\(model, start_time=start, end_time=end, inputs=inputs, top_p=/.test(rn) && /S\.instr_logits = one_instrument/.test(rn) && /S\.tqdm = Progress/.test(rn) && /local_files_only=True/.test(rn));
  check("the piano roll: ✍ Continue opens a row - bars, model, instrument, creativity, one instrument, ✨ Write / 🎲 Again / ↶ Take back; 409 opens the add-on's Download box",
    /id="syRollCont"/.test(roll) && /id="syContBars"/.test(roll) && /id="syContModel"/.test(roll) && /id="syContInstr"/.test(roll) && /id="syContTop"/.test(roll) && /id="syContOnly"/.test(roll) && /id="syContGo"/.test(roll) && /id="syContAgain"/.test(roll) && /id="syContBack"/.test(roll) && /A\.act\("amt", "install"\)/.test(roll));
  check("…the clip grows to the bars written; the row hides properly (its bar is display:flex)", /c\.len = Math\.max\(c\.len, res\.to\)/.test(roll) && /\.syrollcont\[hidden\] \{ display: none; \}/.test(html));
  console.log("\n" + pass + " passed, " + fail + " failed");
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: threw " + (e && e.stack || e)); console.log("RESULT: 1 failed"); process.exit(1); });
