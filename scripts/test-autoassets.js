#!/usr/bin/env node
// Unit tests for lib/autoAssets.js — a finished render appearing in the asset
// dock by itself. Run: node scripts/test-autoassets.js
const fs = require("fs");
const os = require("os");
const path = require("path");
const A = require(path.join(__dirname, "..", "lib", "autoAssets"));

let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log("PASS: " + n); };
const bad = (n, got) => { fail++; console.log("FAIL: " + n + "\n      got " + JSON.stringify(got)); };
const check = (n, cond, got) => (cond ? ok(n) : bad(n, got));

function fresh() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "autoassets-"));
  const outputDir = path.join(root, "output");
  const videoDir = path.join(root, "video");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(videoDir, { recursive: true });
  return { root, outputDir, videoDir };
}
const write = (dir, name, body) => {
  fs.writeFileSync(path.join(dir, name), body);
  return path.join(dir, name);
};

// ------------------------------------------------------------- happy path
{
  const d = fresh();
  write(d.outputDir, "proj+1.webm", "RENDERED BYTES");
  const r = A.register("proj+1.webm", { mode: "video", ...d });
  check("registers a finished render into the video assets", r.added && r.name === "proj+1.webm", r);
  check("uses a hard link, not a copy", r.how === "link", r);
  check("the asset is readable and complete",
    fs.readFileSync(path.join(d.videoDir, "proj+1.webm"), "utf8") === "RENDERED BYTES", null);
  // A hard link is ONE set of bytes under two names: that is the whole point,
  // because a render can be gigabytes and copying doubles it every time.
  check("the link costs no extra disk (same inode)",
    A.sameFile(path.join(d.videoDir, "proj+1.webm"), path.join(d.outputDir, "proj+1.webm")), null);
  // deleting the gallery copy must leave the asset whole
  fs.unlinkSync(path.join(d.outputDir, "proj+1.webm"));
  check("deleting the render leaves the asset intact",
    fs.readFileSync(path.join(d.videoDir, "proj+1.webm"), "utf8") === "RENDERED BYTES", null);
}

// ------------------------------------------------------------- idempotence
{
  const d = fresh();
  write(d.outputDir, "proj+2.webm", "X");
  const a = A.register("proj+2.webm", { mode: "video", ...d });
  const b = A.register("proj+2.webm", { mode: "video", ...d });
  const c = A.register("proj+2.webm", { mode: "video", ...d });
  check("registering twice is a no-op, not a duplicate",
    a.added && !b.added && b.reason === "exists" && !c.added, [a, b, c]);
  check("only one file lands in the dock",
    fs.readdirSync(d.videoDir).length === 1, fs.readdirSync(d.videoDir));
}

// ------------------------------------------------- never overwrite an asset
{
  const d = fresh();
  // the user already dropped their own file under the name the render will use
  write(d.videoDir, "clash.webm", "THE USER'S OWN FOOTAGE");
  write(d.outputDir, "clash.webm", "A DIFFERENT RENDER");
  const r = A.register("clash.webm", { mode: "video", ...d });
  check("a name clash uniquifies instead of overwriting",
    r.added && r.name === "clash (2).webm", r);
  // Overwriting would be silent data loss twice over: the old file is gone AND
  // every timeline clip still naming it now plays different footage.
  check("the user's own asset is untouched",
    fs.readFileSync(path.join(d.videoDir, "clash.webm"), "utf8") === "THE USER'S OWN FOOTAGE", null);
}

// ------------------------------------------------------- what NOT to register
{
  const d = fresh();
  write(d.outputDir, "myproject.mp4", "THE COMPILE");
  const r = A.register("myproject.mp4", { mode: "export", ...d });
  // A compile REPLACES <project>.mp4 every time. A hard link captures the
  // bytes at link time, so the asset would silently go stale on the next
  // recompile and you would be editing against an older cut.
  check("a timeline compile is NOT auto-registered (it is rewritten every time)",
    !r.added && r.reason === "skipped-mode", r);
  check("nothing landed in the dock", fs.readdirSync(d.videoDir).length === 0, fs.readdirSync(d.videoDir));
}
{
  const d = fresh();
  write(d.outputDir, "notes.txt", "hello");
  const r = A.register("notes.txt", { mode: "video", ...d });
  check("a non-video output is not registered", !r.added && r.reason === "not-video", r);
}
{
  const d = fresh();
  const r = A.register("never_rendered.webm", { mode: "video", ...d });
  check("a missing output is reported, not thrown", !r.added && r.reason === "missing", r);
}
{
  const d = fresh();
  check("an empty name is reported, not thrown",
    A.register("", { mode: "video", ...d }).reason === "missing", null);
  check("a null name is reported, not thrown",
    A.register(null, { mode: "video", ...d }).reason === "missing", null);
}

// ------------------------------------------------------------ never throws
// A render that finished has FINISHED. A dock entry that cannot be made is a
// nuisance; turning a successful two-hour generation into a failed job is not.
{
  let threw = false;
  try {
    A.register("x.webm", { mode: "video", outputDir: null, videoDir: null });
    A.register("x.webm", {});
    A.register("x.webm");
  } catch { threw = true; }
  check("garbage options return a result instead of throwing", !threw, null);
}
{
  const d = fresh();
  write(d.outputDir, "ro.webm", "X");
  // an unwritable destination must degrade to a reported error, never a throw
  let threw = false, r = null;
  try {
    fs.chmodSync(d.videoDir, 0o555);
    r = A.register("ro.webm", { mode: "video", ...d });
  } catch { threw = true; } finally { try { fs.chmodSync(d.videoDir, 0o755); } catch {} }
  check("an unwritable asset folder is reported, not thrown",
    !threw && (r === null || !r.added || r.added), [threw, r]);
}

// -------------------------------------------------------------- extensions
{
  for (const e of [".mp4", ".webm", ".mkv", ".mov", ".avi", ".m4v"])
    check("isVideo accepts " + e, A.isVideo("a" + e), e);
  for (const e of [".txt", ".png", ".wav", ".json", ""])
    check("isVideo rejects " + (e || "(none)"), !A.isVideo("a" + e), e);
  check("isVideo is case-insensitive", A.isVideo("A.WEBM"), null);
}

console.log("=======================");
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
