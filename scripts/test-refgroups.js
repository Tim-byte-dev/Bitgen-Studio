#!/usr/bin/env node
// lib/refGroups.js — one JSON file per reference group. node scripts/test-refgroups.js
//
// THE FORMAT IS THE FEATURE: projects/<p>/references/<group name>.json, each
// item recorded as filename + reference type (image | video | sound). The API
// keeps speaking {images, videos, audios}; conversion happens at this edge.
const fs = require("fs");
const os = require("os");
const path = require("path");
const R = require(path.join(__dirname, "..", "lib", "refGroups"));

let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log("PASS: " + n); };
const bad = (n, got) => { fail++; console.log("FAIL: " + n + "\n      got " + JSON.stringify(got)); };
const check = (n, cond, got) => (cond ? ok(n) : bad(n, got));
const fresh = () => fs.mkdtempSync(path.join(os.tmpdir(), "refgroups-"));

// ---- storage shape: exactly what Tim asked for ----
{
  const d = fresh();
  R.save(d, { name: "band shoot",
              images: [{ name: "a.png", subject: 2, role: "person", roleOther: "" }],
              videos: ["clip.mp4"], audios: ["song.wav"] });
  const p = path.join(d, "references", "band shoot.json");
  check("the group lives at references/<group name>.json", fs.existsSync(p), fs.readdirSync(d));
  const doc = JSON.parse(fs.readFileSync(p, "utf8"));
  check("every item is filename + reference type",
    doc.items.every((i) => i.file && ["image", "video", "sound"].includes(i.type)),
    doc.items);
  check("the three types are image, video and sound — Tim's words, not 'audios'",
    JSON.stringify(doc.items.map((i) => i.type)) === '["image","video","sound"]',
    doc.items.map((i) => i.type));
  check("an image keeps its subject and role, so storage does not lose a feature",
    doc.items[0].subject === 2 && doc.items[0].role === "person", doc.items[0]);
  // and the wire shape coming back is unchanged
  const g = R.read(d)[0];
  check("the API shape is untouched: images/videos/audios",
    g.images[0].name === "a.png" && g.videos[0] === "clip.mp4" && g.audios[0] === "song.wav", g);
}

// ---- overwrite, delete, list ----
{
  const d = fresh();
  R.save(d, { name: "g", images: [{ name: "one.png" }], videos: [], audios: [] });
  R.save(d, { name: "g", images: [{ name: "two.png" }], videos: [], audios: [] });
  check("saving the same name overwrites, not duplicates",
    R.read(d).length === 1 && R.read(d)[0].images[0].name === "two.png", R.read(d));
  R.save(d, { name: "b", images: [{ name: "x.png" }], videos: [], audios: [] });
  check("groups list sorted by name",
    R.read(d).map((g) => g.name).join(",") === "b,g", R.read(d).map((g) => g.name));
  check("delete removes exactly that group's file",
    R.remove(d, "g") === true && !fs.existsSync(path.join(d, "references", "g.json"))
    && fs.existsSync(path.join(d, "references", "b.json")), fs.readdirSync(path.join(d, "references")));
  check("deleting a group that is not there says so", R.remove(d, "g") === false, null);
}

// ---- names are filesystem-hostile input ----
{
  const d = fresh();
  const saved = R.save(d, { name: "  ../..\\evil: group?  ",
                            images: [{ name: "a.png" }], videos: [], audios: [] });
  const files = fs.readdirSync(path.join(d, "references"));
  /* What matters is TRAVERSAL, not the cosmetics of the substitute characters:
     no separators survive, the resolved path stays inside references/, and it
     is not a dot-file. Asserting the exact substitute string would pin an
     implementation detail. */
  const resolved = path.resolve(path.join(d, "references"), files[0]);
  check("a hostile name is sanitised into the references folder, never out of it",
    files.length === 1 && !/[\\/:?]/.test(files[0]) && !files[0].startsWith(".")
    && resolved.startsWith(path.resolve(path.join(d, "references")) + path.sep),
    files);
  check("byName goes through the same sanitiser, so save and load agree",
    R.byName(d, "  ../..\\evil: group?  ").images[0].name === "a.png", saved);
  let threw = null;
  try { R.save(d, { name: "   ", images: [{ name: "a.png" }] }); }
  catch (e) { threw = e.status; }
  check("an empty name is a 400, not a file called '.json'", threw === 400, threw);
  threw = null;
  try { R.save(d, { name: "empty", images: [], videos: [], audios: [] }); }
  catch (e) { threw = e.status; }
  check("an empty group is refused", threw === 400, threw);
  // a traversal FILENAME inside an item must be flattened too
  R.save(d, { name: "tricky", images: [{ name: "../../secret.png" }], videos: [], audios: [] });
  const doc = JSON.parse(fs.readFileSync(path.join(d, "references", "tricky.json"), "utf8"));
  check("item filenames are basenamed on the way in",
    doc.items[0].file === "secret.png", doc.items[0]);
}

// ---- migration from the single legacy file ----
{
  const d = fresh();
  fs.writeFileSync(path.join(d, "refgroups.json"), JSON.stringify({ groups: [
    { name: "old one", saved: 5,
      images: [{ name: "a.png", subject: 3, role: "person", roleOther: "" }],
      videos: ["v.mp4"], audios: ["s.wav"] },
    { name: "old two", images: [{ name: "b.png" }], videos: [], audios: [] },
  ] }));
  const groups = R.read(d);
  check("legacy groups come back intact on first read",
    groups.length === 2 && groups.find((g) => g.name === "old one").images[0].subject === 3,
    groups);
  check("...each as its own file under references/",
    fs.existsSync(path.join(d, "references", "old one.json"))
    && fs.existsSync(path.join(d, "references", "old two.json")),
    fs.readdirSync(path.join(d, "references")));
  check("the legacy file is renamed, NOT deleted — a migration that destroys "
      + "its input cannot be re-run after a bug in it is found",
    !fs.existsSync(path.join(d, "refgroups.json"))
    && fs.existsSync(path.join(d, "refgroups.json.migrated")), fs.readdirSync(d));
  // a per-group file must never be rolled back by a re-run
  R.save(d, { name: "old one", images: [{ name: "newer.png" }], videos: [], audios: [] });
  fs.writeFileSync(path.join(d, "refgroups.json"), JSON.stringify({ groups: [
    { name: "old one", images: [{ name: "a.png" }], videos: [], audios: [] }] }));
  const after = R.read(d).find((g) => g.name === "old one");
  check("an existing per-group file wins over a re-appearing legacy file",
    after.images[0].name === "newer.png", after);
}

// ---- robustness ----
{
  const d = fresh();
  check("reading a project with no references folder is an empty list, not a throw",
    Array.isArray(R.read(d)) && R.read(d).length === 0, null);
  fs.mkdirSync(path.join(d, "references"), { recursive: true });
  fs.writeFileSync(path.join(d, "references", "broken.json"), "{ not json");
  R.save(d, { name: "fine", images: [{ name: "a.png" }], videos: [], audios: [] });
  check("one corrupt group does not hide the rest",
    R.read(d).length === 1 && R.read(d)[0].name === "fine", R.read(d));
  const doc = { name: "odd", items: [{ file: "x.bin", type: "hologram" }] };
  fs.writeFileSync(path.join(d, "references", "odd.json"), JSON.stringify(doc));
  const g = R.read(d).find((x) => x.name === "odd");
  check("an unknown reference type is skipped, never guessed into another list",
    g.images.length === 0 && g.videos.length === 0 && g.audios.length === 0, g);
}

console.log("=======================");
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
