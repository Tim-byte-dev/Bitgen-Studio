#!/usr/bin/env node
/* RECYCLE BIN (2.223.15) unit + shape tests.
   Part A: lib/recycleBin.js against a real temp project — bin creation,
   clash uniquify, the move really moving.
   Part B: source pins — the delete route branches on ui.confirm_delete, the
   clear route ALWAYS recycles, the page has the checkbox / one delete path /
   selection + Del key / 🗑 Clear, and default.settings ships the flag OFF.
   Run from repo root: node scripts/test-recyclebin.js */
const fs = require("fs");
const path = require("path");
const assert = require("assert");

process.chdir(path.join(__dirname, ".."));
const core = require("../lib/core");
const rb = require("../lib/recycleBin");

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name, extra === undefined ? "" : JSON.stringify(extra)); }
}

// ---- Part A: the lib, against a throwaway project folder ------------------
{
  const proj = "__rbtest__";
  const pdir = core.projDir(proj);
  fs.rmSync(pdir, { recursive: true, force: true });
  fs.mkdirSync(pdir, { recursive: true });
  try {
    const bin = rb.binDir(proj);
    check("binDir creates projects/<name>/recycle_bin on first use",
      bin === path.join(pdir, "recycle_bin") && fs.existsSync(bin), bin);
    check("uniquify leaves a free name alone and steps a taken one",
      rb.uniquify(bin, "a.mp4") === "a.mp4"
      && (fs.writeFileSync(path.join(bin, "a.mp4"), "x"),
          rb.uniquify(bin, "a.mp4") === "a-1.mp4"), null);
    const src = path.join(pdir, "take.mp4");
    fs.writeFileSync(src, "clip-bytes");
    const moved = rb.recycle(src, proj);
    check("recycle MOVES the file (gone from source, present in the bin, bytes intact)",
      !fs.existsSync(src) && moved.to === bin
      && fs.readFileSync(path.join(bin, moved.name), "utf8") === "clip-bytes", moved);
    fs.writeFileSync(src, "second-take");
    const again = rb.recycle(src, proj);
    check("a name clash in the bin uniquifies — the older recycled file survives",
      again.name === "take-1.mp4"
      && fs.readFileSync(path.join(bin, "take.mp4"), "utf8") === "clip-bytes"
      && fs.readFileSync(path.join(bin, "take-1.mp4"), "utf8") === "second-take", again);
  } finally {
    fs.rmSync(pdir, { recursive: true, force: true });
  }
}

// ---- Part B: the wiring, pinned at the source -----------------------------
{
  const R = fs.readFileSync("routes/index.js", "utf8");
  check("the delete route branches on ui.confirm_delete — checked deletes, unchecked recycles",
    /\(core\.getConfig\(\)\.ui \|\| \{\}\)\.confirm_delete/.test(R)
    && /recycleBin\.recycle\(hit\.path\)/.test(R)
    && /recycled: true/.test(R), null);
  check("the clear route ALWAYS recycles (no unlink anywhere in it) and never eats the bin",
    /app\.post\("\/api\/outputs\/clear"/.test(R)
    && !/\/api\/outputs\/clear[\s\S]{0,800}unlinkSync/.test(R)
    && /the bin\s*\n?\s*\/\/ itself is a subfolder/.test(R.replace(/\r/g, "")) || /bin\s+itself is a subfolder/.test(R), null);

  const H = fs.readFileSync("static/index.html", "utf8");
  check("Settings → General has the Confirm-delete checkbox, painted from cfg and saved on change",
    /id="s_confirmdel"/.test(H)
    && /\$\("s_confirmdel"\)\.checked = !!\(\(cfg\.ui \|\| \{\}\)\.confirm_delete\)/.test(H)
    && /body: JSON\.stringify\(\{ ui: \{ confirm_delete: on \} \}\)/.test(H), null);
  check("ONE delete path: every gallery ✕ rides galleryDelete, no per-tile confirm remains",
    (H.match(/galleryDelete\(f\.name\)/g) || []).length === 3
    && !/appConfirm\(`Delete \$\{f\.name\}\?`\)/.test(H), null);
  check("click selects a thumbnail; Del deletes the selection — never while typing or in a dialog",
    /t\.classList\.add\("sel"\)/.test(H)
    && /e\.key !== "Delete"/.test(H)
    && /a\.isContentEditable/.test(H)
    && /document\.querySelector\("dialog\[open\]"\)/.test(H), null);
  check("🗑 Clear sits in the gallery dockhead and posts /api/outputs/clear",
    /id="gClear"/.test(H) && /fetch\("\/api\/outputs\/clear", \{ method: "POST" \}\)/.test(H), null);

  const D = JSON.parse(fs.readFileSync(require("path").join(__dirname, "..", "misc", "default.settings"), "utf8"));
  check("default.settings ships confirm_delete OFF — deletes are recoverable out of the box",
    D.ui && D.ui.confirm_delete === false, D.ui && D.ui.confirm_delete);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
