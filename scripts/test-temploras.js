#!/usr/bin/env node
// lib/tempLoras.js — per-project temporary LoRAs (2.111.0).
const fs = require("fs"), os = require("os"), path = require("path");
const T = require(path.join(__dirname, "..", "lib", "tempLoras"));
let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log("PASS: " + n); };
const bad = (n, got) => { fail++; console.log("FAIL: " + n + "\n      got " + JSON.stringify(got)); };
const check = (n, cond, got) => (cond ? ok(n) : bad(n, got));
const d = fs.mkdtempSync(path.join(os.tmpdir(), "tl-"));
check("file names are image-loras-temp.json / video-loras-temp.json in the project folder",
  path.basename(T.file(d, "image")) === "image-loras-temp.json" && path.basename(T.file(d, "video")) === "video-loras-temp.json", null);
check("an unknown kind throws", (() => { try { T.file(d, "music"); return false; } catch { return true; } })(), null);
const n = T.normalize([{ path: "a.safetensors", weight: "0.7" }, { name: "b.safetensors" }, { path: "../evil", weight: 1 }, { path: "", weight: 1 }, { path: "c", weight: 99 }]);
check("normalize: path or name, weight coerced (default 1), clamped -4..4, traversal and empties dropped",
  n.length === 3 && n[0].weight === 0.7 && n[1].path === "b.safetensors" && n[1].weight === 1 && n[2].weight === 4, n);
check("read of a missing file is []", JSON.stringify(T.read(d, "image")) === "[]", null);
const w = T.write(d, "video", [{ path: "v.safetensors", weight: 0 }]);
check("write persists and returns the normalized list (weight 0 kept)", w[0].weight === 0 && JSON.parse(fs.readFileSync(T.file(d, "video"), "utf8"))[0].path === "v.safetensors", w);
const m = T.merge([{ path: "s.safetensors", weight: 1 }, { path: "a.safetensors", weight: 0.5 }], [{ path: "a.safetensors", weight: 0.9 }, { path: "t.safetensors", weight: 0.3 }]);
check("merge: temp LoRAs are appended after the style's; a same-path temp entry re-weights instead of doubling",
  m.length === 3 && m[1].weight === 0.9 && m[2].path === "t.safetensors" && m[0].path === "s.safetensors", m);
console.log("=======================");
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
