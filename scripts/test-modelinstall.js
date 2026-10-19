#!/usr/bin/env node
// Unit tests for lib/modelInstall.js — making a model visible to a different
// ComfyUI loader. Run: node scripts/test-modelinstall.js
//
// THE FAILURE THIS ANSWERS: ComfyUI resolves a combo value inside the search
// paths registered for THAT folder type. A FLUX diffusion model sitting in
// models/Checkpoint is a checkpoint as far as UNETLoader is concerned, so it
// cannot be selected however correct the file is. Tim had been copying files by
// hand to work around it.
const fs = require("fs");
const os = require("os");
const path = require("path");
const M = require(path.join(__dirname, "..", "lib", "modelInstall"));

let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log("PASS: " + n); };
const bad = (n, got) => { fail++; console.log("FAIL: " + n + "\n      got " + JSON.stringify(got)); };
const check = (n, cond, got) => (cond ? ok(n) : bad(n, got));
const mk = (p) => { fs.mkdirSync(p, { recursive: true }); return p; };
const fresh = () => fs.mkdtempSync(path.join(os.tmpdir(), "modelinstall-"));

// ---- the exact shape of Tim's machine ----
{
  const root = fresh();
  const ck = mk(path.join(root, "models", "Checkpoint", "flux_klein_9B"));
  fs.writeFileSync(path.join(ck, "aisha.safetensors"), "WEIGHTS");
  // his yaml maps diffusion_models to a folder that was never created, so the
  // line searches nothing and ComfyUI has no unet path on that drive at all
  const dmDir = path.join(root, "models", "diffusion_models");
  const r = M.install({
    name: "flux_klein_9B/aisha.safetensors",
    fromRoots: [{ dir: path.join(root, "models", "Checkpoint"), exists: true }],
    toRoots: [{ dir: dmDir, exists: false }],
  });
  check("a checkpoint-filed model is installed for the unet loader",
    r.ok && r.how === "link", r);
  check("the yaml's declared-but-missing folder is created",
    r.created_dir === true && fs.existsSync(dmDir), r);
  // THE POINT: the style's saved value does not change, it starts working
  check("the subfolder is preserved, so the saved name still resolves",
    fs.existsSync(path.join(dmDir, "flux_klein_9B", "aisha.safetensors")),
    fs.readdirSync(dmDir));
  check("the name it reports is the name the workflow will ask for",
    r.name === "flux_klein_9B/aisha.safetensors", r.name);
  const a = fs.statSync(path.join(ck, "aisha.safetensors"));
  const b = fs.statSync(path.join(dmDir, "flux_klein_9B", "aisha.safetensors"));
  check("one set of bytes under two names — a 20 GB model is not duplicated",
    !a.ino || !b.ino || (a.ino === b.ino && a.dev === b.dev), { a: a.ino, b: b.ino });
  check("the original is untouched",
    fs.readFileSync(path.join(ck, "aisha.safetensors"), "utf8") === "WEIGHTS", null);
  // doing it twice must not pile up copies
  const again = M.install({
    name: "flux_klein_9B/aisha.safetensors",
    fromRoots: [{ dir: path.join(root, "models", "Checkpoint"), exists: true }],
    toRoots: [{ dir: dmDir, exists: true }],
  });
  check("installing again reports exists rather than failing or duplicating",
    again.ok && again.how === "exists", again);
}

// ---- an existing root is preferred over one that must be created ----
{
  const root = fresh();
  const from = mk(path.join(root, "ck"));
  fs.writeFileSync(path.join(from, "m.safetensors"), "W");
  const live = mk(path.join(root, "dm_real"));
  const t = M.pickTarget([{ dir: path.join(root, "dm_ghost"), exists: false },
                          { dir: live, exists: true }]);
  check("an existing search folder wins over one that would be created",
    t.dir === live && t.created === false, t);
  check("no target at all is answered honestly rather than guessed",
    M.pickTarget([{ dir: "/nowhere/at/all/deep", exists: false }]) === null
    && M.pickTarget([]) === null, null);
}

// ---- refusals ----
{
  const root = fresh();
  const from = mk(path.join(root, "ck"));
  const to = mk(path.join(root, "dm"));
  fs.writeFileSync(path.join(from, "m.safetensors"), "MINE");
  fs.writeFileSync(path.join(to, "m.safetensors"), "SOMETHING ELSE");
  const r = M.install({ name: "m.safetensors",
                        fromRoots: [{ dir: from, exists: true }],
                        toRoots: [{ dir: to, exists: true }] });
  // Unlike an asset import, the NAME is load-bearing here — it is what the
  // workflow asks ComfyUI for — so uniquifying would defeat the operation.
  check("a name clash is refused rather than uniquified",
    !r.ok && r.code === "clash", r);
  check("the existing file is left alone",
    fs.readFileSync(path.join(to, "m.safetensors"), "utf8") === "SOMETHING ELSE", null);

  const miss = M.install({ name: "ghost.safetensors",
                           fromRoots: [{ dir: from, exists: true }],
                           toRoots: [{ dir: to, exists: true }] });
  check("a file that is not there is refused with a reason",
    !miss.ok && miss.code === "missing", miss);
  const nt = M.install({ name: "m.safetensors",
                         fromRoots: [{ dir: from, exists: true }], toRoots: [] });
  check("no destination folder is its own reason",
    !nt.ok && nt.code === "no-target", nt);
  const esc = M.install({ name: "../../../etc/passwd",
                          fromRoots: [{ dir: from, exists: true }],
                          toRoots: [{ dir: to, exists: true }] });
  check("a traversal name is refused, not resolved", !esc.ok && esc.code === "bad-name", esc);
  check("a backslash name is accepted and normalised",
    M.install({ name: "sub\\m.safetensors",
                fromRoots: [{ dir: from, exists: true }],
                toRoots: [{ dir: to, exists: true }] }).code === "missing",
    "it should look for sub/m.safetensors, not treat the whole thing as one name");
}

// ---- never throws ----
{
  for (const [n, arg] of [["nothing", undefined], ["null", null], ["{}", {}],
                          ["a number for a name", { name: 7 }],
                          ["junk roots", { name: "a.safetensors", fromRoots: [null, 3] }]]) {
    let threw = null, r = null;
    try { r = M.install(arg); } catch (e) { threw = e.message; }
    check("never throws on " + n, threw === null && r && r.ok === false, threw || r);
  }
}

console.log("=======================");
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
