#!/usr/bin/env node
// lib/timelines.js — named timelines in the project folder (2.107.0).
const fs = require("fs"), os = require("os"), path = require("path");
const T = require(path.join(__dirname, "..", "lib", "timelines"));
let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log("PASS: " + n); };
const bad = (n, got) => { fail++; console.log("FAIL: " + n + "\n      got " + JSON.stringify(got)); };
const check = (n, cond, got) => (cond ? ok(n) : bad(n, got));
const d = fs.mkdtempSync(path.join(os.tmpdir(), "tl-"));
check("safe(): empty -> main; spaces/dots/dashes ok; traversal and slashes refused",
  T.safe("") === "main" && T.safe("alt cut v2.1") === "alt cut v2.1"
  && (() => { try { T.safe("../x"); return false; } catch { return true; } })() && (() => { try { T.safe("a/b"); return false; } catch { return true; } })(), null);
check("write() lands in timelines/<name>.json and list() reports clips + name", (T.write(d, "main", { video: [{}, {}], audio: [{}], images: [] }), fs.existsSync(path.join(d, "timelines", "main.json")) && T.list(d)[0].clips === 3), T.list(d));
check("read() of a missing name is null, never a throw", T.read(d, "nope") === null, null);
const legacy = { prompt: "p", tl: { video: [{ name: "old" }], audio: [], images: [] } };
const at = T.attach(d, { prompt: "q", tl: legacy.tl, timeline: "legacy" });
check("attach(): a legacy inline tl is migrated to a file named after data.timeline and returned as data.tl",
  fs.existsSync(path.join(d, "timelines", "legacy.json")) && at.tl.video[0].name === "old" && at.timeline === "legacy" && at.timelines.length === 2, at.timelines);
const at2 = T.attach(d, { timeline: "ghost" });
check("attach(): an active name with no file yields an EMPTY timeline shape (video/audio/images/vlayers)",
  at2.tl && at2.tl.video.length === 0 && Array.isArray(at2.tl.vlayers), at2.tl);
const ps = T.persist(d, { timeline: "cut2", tl: { video: [{ name: "n" }], audio: [], images: [] }, other: 1 });
check("persist(): writes the file, keeps only the name in the .prj data", fs.existsSync(path.join(d, "timelines", "cut2.json")) && ps.timeline === "cut2" && !("tl" in ps) && ps.other === 1, ps);
check("remove(): true once, false after", T.remove(d, "cut2") === true && T.remove(d, "cut2") === false, null);
console.log("=======================");
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
