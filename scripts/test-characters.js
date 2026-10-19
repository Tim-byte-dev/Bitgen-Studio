// bitGen Studio — lib/characters.js: the profile store on disk, and the
// reference chain MM3_Characters_tmp.json is built from.
// Run from repo root: node scripts/test-characters.js
const fs = require("fs");
const os = require("os");
const path = require("path");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bgchars-"));
process.env.H3_WORKSPACE = tmp;                 // before core is loaded
const core = require(path.join(__dirname, "..", "lib", "core"));
const C = require(path.join(__dirname, "..", "lib", "characters"));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { console.log("PASS: " + name); pass++; }
  else { console.log("FAIL: " + name + (extra !== undefined ? " -> " + JSON.stringify(extra) : "")); fail++; }
}
const PROJ = core.getProject();

// ---- the folder layout Tim asked for -------------------------------------
const prof = C.writeProfile({ name: "Jinx", age: "19", height: "165cm",
                              weight: "52kg", notes: "manic, blue hair" });
// 2.216.0 (by instruction): the folder is the character's unique ID —
// projects/<p>/characters/<id>/ — and the profile file inside keeps the name
check("a profile lands at projects/<project>/characters/<ID>/<name>.profile",
      (() => { const prof = C.readProfile("Jinx");
               return prof && prof.id && /^c[a-z0-9]+$/.test(prof.id)
                   && C.profilePath("Jinx").endsWith(
                        path.join("characters", prof.id, "Jinx.profile"))
                   && fs.existsSync(C.profilePath("Jinx")); })(),
      C.profilePath("Jinx"));
check("the id is minted once and survives every save",
      (() => { const a = C.readProfile("Jinx").id;
               C.writeProfile(C.readProfile("Jinx"));
               return C.readProfile("Jinx").id === a; })());
check("the profile is JSON the LLM can read without a parser of ours",
      (() => { const j = JSON.parse(fs.readFileSync(C.profilePath("Jinx"), "utf8"));
               return j.age === "19" && j.height === "165cm" && j.weight === "52kg"; })());
check("reading it back gives the same character",
      (C.readProfile("Jinx") || {}).notes === "manic, blue hair");
check("a name that would escape the folder is made safe",
      C.slug("../../etc/passwd") === "....etcpasswd", C.slug("../../etc/passwd"));
check("an unnamed character is refused rather than written to a blank folder",
      (() => { try { C.writeProfile({ name: "  " }); return false; } catch { return true; } })());

// ---- assets go in the character's own folder -----------------------------
const src = path.join(tmp, "sheet.png");
// a REAL tiny PNG (2.168.0): the stitch feeds every sheet to ffmpeg, so a
// fake-bytes fixture would poison the composite for the whole suite
require("child_process").spawnSync("ffmpeg", ["-y", "-loglevel", "error",
  "-f", "lavfi", "-i", "color=c=red:s=32x48:d=1", "-frames:v", "1", src]);
const added = C.addAsset("Jinx", src, "sheet.png");
check("a character sheet is copied into the character's folder and recorded",
      added.kind === "images"
      && fs.existsSync(path.join(C.charDir("Jinx"), "sheet.png"))
      && C.readProfile("Jinx").images.includes("sheet.png"), added);
const vsrc = path.join(tmp, "voice.wav");
fs.writeFileSync(vsrc, "notreallyawav");
C.addAsset("Jinx", vsrc, "voice.wav");
check("a voice clip is filed as a voice, not an image",
      C.readProfile("Jinx").voices.includes("voice.wav"));
check("the kind comes from the extension, so a picture cannot become a voice",
      (() => { try { C.addAsset("Jinx", src, "notes.txt"); return false; }
               catch (e) { return /not a character sheet or a voice/.test(e.message); } })());
check("adding the same file twice does not list it twice",
      (C.addAsset("Jinx", src, "sheet.png"),
       C.readProfile("Jinx").images.filter((x) => x === "sheet.png").length === 1));

C.writeProfile({ name: "Shahzaib", age: "34", notes: "quiet" });
C.addAsset("Shahzaib", src, "shz.png");
check("list() returns every character in the project, sorted",
      C.list().map((c) => c.name).join(",") === "Jinx,Shahzaib", C.list().map((c) => c.name));
check("the LLM briefing names the characters and their facts",
      /Jinx \(age 19, height 165cm, weight 52kg\)/.test(C.briefing())
      && /Shahzaib/.test(C.briefing()), C.briefing());
check("no characters means no briefing at all (not an empty heading)",
      C.briefing("no-such-project") === "");

// ---- the reference chain -------------------------------------------------
const STYLE = JSON.parse(fs.readFileSync(
  path.join(__dirname, "..", "comfy_workflows", "MM3_Characters.json"), "utf8"));
check("the shipped style really is chain-wired (the premise of buildChain)",
      C.chainNodes(STYLE).length === 4, C.chainNodes(STYLE));

const resolve = (c, file) => `${c.name}__${file}`;
const built = C.buildChain(STYLE, C.list(), resolve);
const g = built.graph;
check("the style's own demo characters are removed, not inherited",
      !Object.values(g).some((n) => JSON.stringify(n.inputs || {}).includes("shahzaib voice")
                                    && n.class_type === C.AUD_NODE));
const picks = Object.keys(g).filter((k) => (g[k] || {}).class_type === C.PIC_NODE);
const auds = Object.keys(g).filter((k) => (g[k] || {}).class_type === C.AUD_NODE);
check("one picture reference per character with a sheet", picks.length === 2, picks);
check("one audio reference per character with a voice", auds.length === 1, auds);
check("each reference carries the character's tag",
      picks.map((k) => g[k].inputs.tag).sort().join(",") === "jinx,shahzaib",
      picks.map((k) => g[k].inputs.tag));

// the chain: exactly one head, every other node points at the one before, and
// following `previous` from the tail must visit every reference exactly once.
const refs = picks.concat(auds);
const heads = refs.filter((k) => !g[k].inputs.previous);
check("the chain has exactly one head", heads.length === 1, heads);
const walk = [];
let at = built.tail;
while (at) { walk.push(at); const p = g[at].inputs.previous; at = p ? String(p[0]) : null; }
check("following `previous` from the tail visits every reference exactly once",
      walk.length === refs.length && new Set(walk).size === refs.length, walk);
check("the tail is wired into whatever consumes reference_schedule",
      Object.values(g).some((n) => Array.isArray((n.inputs || {}).reference_schedule)
        && String(n.inputs.reference_schedule[0]) === built.tail));
check("every loader the chain points at actually exists in the graph",
      refs.every((k) => {
        const src2 = g[k].inputs.image || g[k].inputs.audio;
        return Array.isArray(src2) && !!g[String(src2[0])];
      }));
check("the loaders carry the resolved upload names, not raw profile paths",
      Object.values(g).some((n) => n.class_type === "LoadImage"
        && String(n.inputs.image).startsWith("Jinx__")));
check("a character with no voice is REPORTED, never silently dropped",
      built.notes.some((n) => /Shahzaib: no voice clip/.test(n)), built.notes);

// ---- one PICTURE per character, every voice (2.168.0, by instruction) ----
// REVERSES 2.144.0's every-sheet rule after Tim's live finding: "2 separate
// images are being loaded as the same character twice which is not allowed".
// A second sheet no longer grows the chain — the sheets are STITCHED into
// one composite reference and the chain carries exactly ONE picture per
// character. Voices keep the 2.144.0 many-clips rule (the pack's complaint
// named pictures, not voices).
{ // the stitch needs files ffmpeg can actually read — two real tiny PNGs
  const { spawnSync } = require("child_process");
  const mk = (f, col) => spawnSync("ffmpeg", ["-y", "-loglevel", "error",
    "-f", "lavfi", "-i", `color=c=${col}:s=32x48:d=1`, "-frames:v", "1", f]);
  mk(path.join(tmp, "real1.png"), "red");
  mk(path.join(tmp, "real2.png"), "blue");
  C.addAsset("Jinx", path.join(tmp, "real2.png"), "sheet2.png");
}
C.addAsset("Jinx", vsrc, "voice2.wav");
const multi = C.buildChain(STYLE, C.list(PROJ), resolve, undefined, PROJ);
const mg = multi.graph;
const mpicks = Object.keys(mg).filter((k) => (mg[k] || {}).class_type === C.PIC_NODE);
const mauds = Object.keys(mg).filter((k) => (mg[k] || {}).class_type === C.AUD_NODE);
check("a second sheet does NOT add a second picture reference — one per character (2 picks, 2 voices)",
      mpicks.length === 2 && mauds.length === 2, { mpicks, mauds });
check("Jinx's ONE picture loader points at the stitched composite, not a raw sheet",
      String((mg.char_img_0 || { inputs: {} }).inputs.image).includes(C.COMPOSITE),
      (mg.char_img_0 || {}).inputs);
check("no tag ever registers twice — one picture reference per tag",
      mpicks.filter((k) => mg[k].inputs.tag === "jinx").length === 1
      && mauds.every((k) => mg[k].inputs.tag === "jinx_voice"), null);
check("loader insertion order matches the per-character walk (worker slot alignment)",
      (() => { const ks = Object.keys(mg)
                 .filter((k) => /^char_(img|aud)_/.test(k));
               return ks.join(",") ===
                 "char_img_0,char_aud_0,char_aud_0_1,char_img_1"; })(),
      Object.keys(mg).filter((k) => /^char_(img|aud)_/.test(k)).join(","));
const mrefs = mpicks.concat(mauds);
const mwalk = [];
let mat = multi.tail;
while (mat) { mwalk.push(mat); const p = mg[mat].inputs.previous; mat = p ? String(p[0]) : null; }
check("the grown chain still has every reference exactly once, tail wired",
      mwalk.length === mrefs.length && new Set(mwalk).size === mrefs.length
      && Object.values(mg).some((n) => Array.isArray((n.inputs || {}).reference_schedule)
           && String(n.inputs.reference_schedule[0]) === multi.tail), mwalk);

// ---- stable tags (2.145.0, from Tim's live node error) --------------------
// "Reference tag must be a stable tag such as 'hero_face' or '@hero-face'" —
// the pack validates the widget, so a space or punctuation in a tag is a
// render that dies at execution. tagOf is the ONE spelling of that rule.
check("tagOf: spaces and punctuation become underscores, lowercased",
      C.tagOf("Joan Smith") === "joan_smith" && C.tagOf("O'Brien!") === "o_brien"
      && C.tagOf("  Café  #7 ") === "caf_7", [C.tagOf("Joan Smith"), C.tagOf("O'Brien!"), C.tagOf("  Café  #7 ")]);
check("tagOf: an empty name still yields an addressable tag",
      C.tagOf("") === "ref" && C.tagOf("   ") === "ref");
check("every voice reference tag is <tag>_voice — never a space (the pack refuses it)",
      mauds.every((k) => /^[a-z0-9_-]+_voice$/.test(mg[k].inputs.tag)),
      mauds.map((k) => mg[k].inputs.tag));
check("no chain reference anywhere carries an unstable tag",
      C.chainNodes(mg).every((k) => /^@?[A-Za-z0-9_-]+$/.test(mg[k].inputs.tag)),
      C.chainNodes(mg).map((k) => mg[k].inputs.tag));

const none = C.buildChain(STYLE, [], resolve);
check("no characters: the schedule input is removed rather than left dangling",
      !Object.values(none.graph).some((n) => "reference_schedule" in (n.inputs || {}))
      && none.notes.some((n) => /no reference schedule/.test(n)), none.notes);
check("no characters: no reference nodes are left behind",
      C.chainNodes(none.graph).length === 0);
check("buildChain never mutates the style it was handed",
      C.chainNodes(STYLE).length === 4);

// ---- PICTURE NUMBERS NEVER SHIFT (2.204.0, by instruction) ----------------
// "when the character is assigned an image like joan picture c1, don't
// change it when new characters are added, only change it when it is edited
// and saved" — cast order (and so Picture N) is persisted per profile.
{
  const P2 = "orderproj";
  // a NAMED project resolves under the app's projects/, not the tmp
  // workspace — clean before AND after so runs never see each other
  fs.rmSync(core.projDir(P2), { recursive: true, force: true });
  C.writeProfile({ name: "Joan" }, P2);
  C.writeProfile({ name: "Zed" }, P2);
  let l = C.list(P2);
  check("migration freezes the existing order once (Joan=1, Zed=2, written to disk)",
        l[0].name === "Joan" && l[0].order === 1 && l[1].order === 2
        && JSON.parse(fs.readFileSync(C.profilePath("Joan", P2), "utf8")).order === 1, l);
  C.writeProfile({ name: "Adam" }, P2);
  l = C.list(P2);
  check("a NEW character APPENDS (Adam=3, last) — Joan and Zed keep their Picture numbers",
        l.map((c) => c.name + c.order).join(",") === "Joan1,Zed2,Adam3", l.map((c) => c.name + c.order));
  const joan = C.readProfile("Joan", P2);
  C.writeProfile({ ...joan, notes: "edited" }, P2);
  l = C.list(P2);
  check("editing and saving a character KEEPS its number (Joan still first)",
        l[0].name === "Joan" && l[0].order === 1 && l[0].notes === "edited", l[0]);
  C.remove("Zed", P2);
  C.writeProfile({ name: "Bea" }, P2);
  l = C.list(P2);
  check("after a removal the next newcomer still takes max+1 — no renumbering of survivors",
        l.map((c) => c.name + c.order).join(",") === "Joan1,Adam3,Bea4", l.map((c) => c.name + c.order));
  fs.rmSync(core.projDir(P2), { recursive: true, force: true });
}

// ---- 2.216.0: slug-folder MIGRATION, the 🎭 cast, and chapter memory ------
{
  // a pre-2.216 character: slug-named folder, no id in the profile
  const root = C.charsRoot();
  const oldDir = path.join(root, "Legacy Len");
  fs.mkdirSync(oldDir, { recursive: true });
  fs.writeFileSync(path.join(oldDir, "Legacy Len.profile"),
    JSON.stringify({ name: "Legacy Len", age: "40" }), "utf8");
  const lp = C.readProfile("Legacy Len");
  check("an old slug folder is ADOPTED: id assigned, folder renamed to it, facts kept",
        lp && lp.id && lp.age === "40"
        && !fs.existsSync(oldDir)
        && fs.existsSync(path.join(root, lp.id, "Legacy Len.profile")),
        lp && lp.id);
  // the 🎭 selection: only chosen actors ride cast(); nobody chosen = everyone
  const all = C.list();
  check("with no selection the cast is everyone",
        C.cast().length === all.length);
  C.setActive([lp.id]);
  check("the selection narrows the cast to the chosen actors",
        C.cast().length === 1 && C.cast()[0].name === "Legacy Len");
  C.setActive(["ghost-id-000"]);
  check("a selection of ghosts means everyone — the chain never goes empty by accident",
        C.cast().length === all.length);
  C.setActive([]);
  // chapter memory: <chapter>.history files in the character folder
  check("a chapter writes into the character folder as <chapter>.history",
        C.writeHistory("Legacy Len", "The Long Night", "Len held the gate alone.")
        && fs.existsSync(path.join(root, lp.id, "The Long Night.history")));
  C.writeHistory("Legacy Len", "Dawn", "Len buried his sword.");
  const mem = C.readHistories("Legacy Len");
  check("the memory reads back newest-first with chapter headers",
        /\[Dawn\]/.test(mem) && /\[The Long Night\]/.test(mem)
        && mem.indexOf("[Dawn]") < mem.indexOf("[The Long Night]"), mem);
  check("the memory is hard-capped — the 26B lesson enforced at the source",
        C.readHistories("Legacy Len", undefined, 30).length
          <= 30 + "[The Long Night]\n".length);
  check("persona, backstory and the memory ride the briefing for the writer",
        (() => { C.writeProfile({ ...C.readProfile("Legacy Len"),
                                  persona: "stoic gatekeeper",
                                  backstory: "last of the wall guard" });
                 const b = C.briefing();
                 return /persona: stoic gatekeeper/.test(b)
                     && /backstory: last of the wall guard/.test(b)
                     && /what has happened to them so far/.test(b)
                     && /Len held the gate alone/.test(b); })());
  C.remove("Legacy Len");
}

check("remove() deletes the whole character folder",
      C.remove("Jinx") && !fs.existsSync(C.charDir("Jinx")) && C.list().length === 1);

fs.rmSync(tmp, { recursive: true, force: true });
console.log("==============================");
console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);
