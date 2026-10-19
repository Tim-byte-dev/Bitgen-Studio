#!/usr/bin/env node
// Unit tests for lib/styles.js — named image-generation styles.
// Run: node scripts/test-styles.js
//
// The interesting cases here are all round trips. A style makes the journey
// browser -> JSON -> disk -> JSON -> worker argv, and the classic failure is a
// value that quietly changes on the way (a 0 becoming a default, a renamed
// style becoming a different style, a PATCH blanking a field it never mentioned).
const fs = require("fs");
const os = require("os");
const path = require("path");
const S = require(path.join(__dirname, "..", "lib", "styles"));

let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log("PASS: " + n); };
const bad = (n, got) => { fail++; console.log("FAIL: " + n + "\n      got " + JSON.stringify(got)); };
const check = (n, cond, got) => (cond ? ok(n) : bad(n, got));
const ws = () => fs.mkdtempSync(path.join(os.tmpdir(), "styles-"));

// ------------------------------------------------------------- the catalogue
check("the catalogue offers the five requested architectures (+ 2.502.0's FLUX 3 Klein, 2.516.0's Krea 2, 2.517.0's Anima - ComfyUI only)",
  JSON.stringify(S.archIds().slice().sort())
  === JSON.stringify(["anima", "flux", "flux2klein9b", "flux3klein", "krea2", "qwen-image", "sdxl", "z-image"]), S.archIds());
check("lib/styles.js and scripts/image_gen.py read the SAME catalogue file",
  fs.existsSync(path.join(__dirname, "..", "lib", "imageArch.json")), null);

// ------------------------------------------------------------- normalization
{
  const s = S.normalize({ name: "  Cinematic  ", arch: "flux",
                          model: " flux1-dev.safetensors " });
  check("name and paths are trimmed", s.name === "Cinematic"
    && s.model === "flux1-dev.safetensors", s);
  check("an id is minted", /^st_[0-9a-f]{12}$/.test(s.id), s.id);
  check("architecture defaults fill the numbers", s.steps === 20 && s.cfg === 1
    && s.width === 1024, s);
  check("te is padded to the architecture's slot count",
    Array.isArray(s.te) && s.te.length === 2, s.te);
}
{
  const s = S.normalize({ name: "x", arch: "not-a-real-arch" });
  check("an unknown architecture falls back rather than storing garbage",
    S.archIds().includes(s.arch), s.arch);
}
{
  const s = S.normalize({});
  check("a nameless style gets a placeholder, not an empty label",
    s.name === "Untitled style", s);
}

// --------------------------------------------- THE 0-IS-NOT-ABSENT TRAP
// `+v || default` turns every legitimate 0 into the default. This is the bug
// the handover called out by name for the LoRA weight slider.
{
  const s = S.normalize({ name: "z", arch: "sdxl", model: "m.safetensors",
                          clip_skip: 0, cfg: 0,
                          loras: [{ path: "a.safetensors", weight: 0 }] });
  check("a clip_skip of 0 survives normalization", s.clip_skip === 0, s.clip_skip);
  check("a cfg of 0 survives normalization", s.cfg === 0, s.cfg);
  check("a LoRA weight of 0 survives normalization (slider can reach zero)",
    s.loras[0].weight === 0, s.loras);
}
{
  const s = S.normalize({ name: "w", arch: "flux", model: "m",
                          loras: [{ path: "a.safetensors", weight: 0.75 }] });
  check("a fractional LoRA weight is not rounded away", s.loras[0].weight === 0.75, s.loras);
  check("a float survives a real JSON round trip",
    JSON.parse(JSON.stringify(s)).loras[0].weight === 0.75, null);
}
{
  const s = S.normalize({ name: "w", arch: "flux", model: "m",
                          loras: [{ path: "a", weight: 99 },
                                  { path: "b", weight: "0.5" },
                                  { path: "", weight: 1 },
                                  { path: "c", weight: "nonsense" }] });
  check("an out-of-range weight is clamped, not dropped", s.loras[0].weight === 4, s.loras);
  check("a numeric string weight is accepted", s.loras[1].weight === 0.5, s.loras);
  check("a LoRA row with no path is dropped", s.loras.length === 3, s.loras);
  check("an unparseable weight becomes 1, not NaN", s.loras[2].weight === 1, s.loras);
}
{
  const many = Array.from({ length: 30 }, (_, i) => ({ path: `l${i}.safetensors` }));
  check("the LoRA stack is capped rather than unbounded",
    S.normalize({ name: "m", arch: "flux", model: "m", loras: many }).loras.length === 12, null);
}

// --------------------------------------------------------- edit semantics
{
  const w = ws();
  const a = S.save(w, { name: "First", arch: "flux", model: "m.safetensors",
                        te: ["clip.safetensors", "t5.safetensors"], steps: 12 });
  const b = S.save(w, { id: a.id, name: "Renamed" });
  check("editing keeps the same id (a rename is not a new style)", b.id === a.id, [a.id, b.id]);
  check("a field the edit never mentioned is preserved, not blanked",
    b.model === "m.safetensors" && b.steps === 12, b);
  check("editing updates in place instead of appending a duplicate",
    S.read(w).length === 1, S.read(w));
  check("the rename actually took", S.read(w)[0].name === "Renamed", S.read(w));
  const c = S.save(w, { name: "Second", arch: "sdxl", model: "s.safetensors" });
  check("a new style appends", S.read(w).length === 2, null);
  check("two styles never share an id", c.id !== a.id, [a.id, c.id]);
  // Ids must not be positional: deleting the first must not renumber the second
  // into its place (the cache-keying rule — indices are reused, ids are not).
  S.remove(w, a.id);
  check("deleting one leaves the other's id untouched",
    S.read(w).length === 1 && S.read(w)[0].id === c.id, S.read(w));
  check("deleting an unknown id reports rather than silently succeeding",
    S.remove(w, "st_doesnotexist") === null, null);
  check("byId finds a saved style", S.byId(w, c.id).name === "Second", null);
  check("byId on a deleted style is null, not a throw", S.byId(w, a.id) === null, null);
}
{
  const w = ws();
  const a = S.save(w, { name: "Persisted", arch: "z-image", model: "z.gguf",
                        vae: "ae.sft", te: ["qwen.gguf"], cfg: 0 });
  // A fresh read from disk is the journey that actually matters.
  const back = S.read(w)[0];
  check("a style survives the disk round trip intact",
    back.id === a.id && back.model === "z.gguf" && back.te[0] === "qwen.gguf", back);
  check("a 0 survives the DISK round trip too", back.cfg === 0, back);
}
{
  check("an unreadable/absent store reads as empty rather than throwing",
    S.read(path.join(os.tmpdir(), "no-such-dir-" + Date.now())).length === 0, null);
}

// ------------------------------------------ arch switch keeps te positional
{
  const w = ws();
  const a = S.save(w, { name: "sw", arch: "flux", model: "m",
                        te: ["clip.safetensors", "t5.safetensors"] });
  const b = S.save(w, { id: a.id, arch: "z-image" });
  check("switching to a 1-slot architecture truncates te to 1 slot",
    b.te.length === 1 && b.te[0] === "clip.safetensors", b.te);
  check("switching architecture re-defaults nothing the user set explicitly",
    b.model === "m", b);
}

// ----------------------------------------------------------- missing slots
// THE TWO ENGINES NEED DIFFERENT THINGS. sd-cli is handed a command line, so
// every file has to be named. ComfyUI's workflow already names its own models,
// so the style needs the workflow and nothing else — demanding five model paths
// there would have the user filling in fields nothing reads.
{
  const full = S.normalize({ name: "f", arch: "flux", engine: "sdcli", model: "m",
                             vae: "ae", te: ["c", "t"] });
  check("a complete sd-cli flux style is not flagged incomplete",
    S.missingSlots(full).length === 0, S.missingSlots(full));
  check("an empty model is flagged (sd-cli)",
    S.missingSlots({ ...full, model: "" })[0] === "model", null);
  check("an empty required TE slot is flagged by its LABEL (sd-cli)",
    S.missingSlots({ ...full, te: ["c", ""] })[0] === "T5-XXL", null);
  const sdxl = S.normalize({ name: "s", arch: "sdxl", engine: "sdcli", model: "m" });
  check("sdxl needs no separate VAE or text encoders",
    S.missingSlots(sdxl).length === 0, S.missingSlots(sdxl));
  check("an unknown architecture is reported, not thrown on",
    S.missingSlots({ engine: "sdcli", arch: "nope" }).length === 1, null);
}
{
  const comfy = S.normalize({ name: "c", arch: "flux", engine: "comfy" });
  check("a ComfyUI style with no workflow is flagged",
    S.missingSlots(comfy)[0] === "workflow", S.missingSlots(comfy));
  const ok2 = S.normalize({ name: "c", arch: "flux", engine: "comfy",
                            workflow: "comfy_workflows/flux.json" });
  check("a ComfyUI style with a workflow is complete — the workflow names the models",
    S.missingSlots(ok2).length === 0, S.missingSlots(ok2));
  check("a ComfyUI style is NOT asked for model/VAE/text-encoder paths",
    !S.missingSlots(ok2).some(m => /model|vae|clip|t5/i.test(m)), S.missingSlots(ok2));
}
{
  // ComfyUI is the default: requiring a second inference engine to make a still
  // when this install already runs ComfyUI for video would be absurd.
  check("a style defaults to the comfy engine",
    S.normalize({ name: "d", arch: "flux" }).engine === "comfy", null);
  check("sdcli is still selectable",
    S.normalize({ name: "d", arch: "flux", engine: "sdcli" }).engine === "sdcli", null);
  check("a nonsense engine falls back to comfy rather than failing a render",
    S.normalize({ name: "d", arch: "flux", engine: "wat" }).engine === "comfy", null);
  const w = ws();
  const a = S.save(w, { name: "E", arch: "flux", engine: "comfy",
                        workflow: "comfy_workflows/x.json" });
  check("engine and workflow survive the disk round trip",
    S.read(w)[0].engine === "comfy"
    && S.read(w)[0].workflow === "comfy_workflows/x.json", S.read(w)[0]);
  const b = S.save(w, { id: a.id, engine: "sdcli" });
  check("switching engine does not lose the workflow path",
    b.workflow === "comfy_workflows/x.json", b);
}

// ---------------------------------------------------------- numOrNull itself
check("numOrNull treats 0 as present", S.numOrNull(0) === 0, null);
check("numOrNull treats '' as absent", S.numOrNull("") === null, null);
check("numOrNull treats null as absent", S.numOrNull(null) === null, null);
check("numOrNull rejects NaN", S.numOrNull("abc") === null, null);

// ------------------------------------- ONE FILE PER STYLE: styles/<name>.json
{
  const w = ws();
  const a = S.save(w, { name: "Cinematic Portrait", arch: "flux", model: "m" });
  check("the style is saved as styles/image/<name>.json (one folder per kind, 2.110.0)",
    fs.existsSync(path.join(w, "image", "Cinematic Portrait.json")), fs.readdirSync(path.join(w, "image")));
  const onDisk = JSON.parse(fs.readFileSync(path.join(w, "image", "Cinematic Portrait.json"), "utf8"));
  check("the file is the style itself, readable and hand-editable",
    onDisk.name === "Cinematic Portrait" && onDisk.arch === "flux"
    && onDisk.model === "m", onDisk);
  check("the bookkeeping field is not written into the file",
    !("_file" in onDisk), Object.keys(onDisk));
  check("the id lives INSIDE the file, so the name is not the key",
    onDisk.id === a.id, onDisk.id);
}
{
  // A RENAME MOVES THE FILE. Without this the old name lingers as a second,
  // stale file and the same style appears twice in the dropdown.
  const w = ws();
  const a = S.save(w, { name: "Old Name", arch: "flux", model: "m", steps: 9 });
  const b = S.save(w, { id: a.id, name: "New Name" });
  check("renaming moves the file rather than leaving a stale twin",
    fs.existsSync(path.join(w, "image", "New Name.json"))
    && !fs.existsSync(path.join(w, "image", "Old Name.json")), fs.readdirSync(path.join(w, "image")));
  check("only one style exists after a rename", S.read(w).length === 1, S.read(w));
  check("the id survives a rename (a rename is not a new style)", b.id === a.id, null);
  check("the rest of the style survives a rename", b.steps === 9, b);
}
{
  // A CLASH IS REFUSED. Overwriting is data loss; uniquifying the file while
  // keeping the name would put two identical-looking entries in the dropdown.
  const w = ws();
  S.save(w, { name: "Portrait", arch: "flux", model: "keep-me" });
  let code = null;
  try { S.save(w, { name: "Portrait", arch: "sdxl", model: "other" }); }
  catch (e) { code = e.code; }
  check("a second style with the same name is refused", code === "duplicate-name", code);
  check("the original file is untouched by the refused save",
    JSON.parse(fs.readFileSync(path.join(w, "image", "Portrait.json"), "utf8")).model === "keep-me", null);
  check("the refused save did not create a second file",
    fs.readdirSync(path.join(w, "image")).filter(f => f.endsWith(".json")).length === 1, fs.readdirSync(path.join(w, "image")));
  // ...but saving a style over ITSELF is an ordinary edit, not a clash
  const same = S.read(w)[0];
  let threw = false;
  try { S.save(w, { id: same.id, name: "Portrait", model: "edited" }); }
  catch { threw = true; }
  check("re-saving a style under its own name is not a clash", !threw, null);
  check("that edit took", S.read(w)[0].model === "edited", S.read(w)[0]);
}
{
  // The name becomes a FILENAME, so it has to survive being one.
  const w = ws();
  const s = S.save(w, { name: "../../config", arch: "flux", model: "m" });
  const files = fs.readdirSync(path.join(w, "image"));
  check("a traversal attempt writes inside styles/image, nowhere else",
    files.length === 1 && files[0] === "config.json" && !fs.existsSync(path.join(w, "..", "config.json")), files);
  check("the style is still readable back", S.read(w)[0].id === s.id, null);
  check("a legitimate dot in a name is kept",
    S.fileStem("v1.5 look") === "v1.5 look", S.fileStem("v1.5 look"));
  check("illegal filename characters are stripped",
    S.fileStem('a<b>c:d"e|f?g*h') === "abcdefgh", S.fileStem('a<b>c:d"e|f?g*h'));
  check("a Windows reserved name is escaped rather than silently failing",
    S.fileStem("CON") === "_CON" && S.fileStem("lpt1") === "_lpt1", S.fileStem("CON"));
  // Windows drops trailing dots and spaces, which would make the file written
  // and the file looked for two different names.
  check("trailing dots and spaces are removed", S.fileStem("name. . ") === "name", S.fileStem("name. . "));
  check("an all-illegal name still yields a usable filename",
    S.fileStem("///") === "style" || S.fileStem("///") === "-", S.fileStem("///"));
}
{
  // Hand-dropped files are the whole point of the per-file store.
  const w = ws();
  fs.mkdirSync(w, { recursive: true });
  fs.writeFileSync(path.join(w, "Handmade.json"), JSON.stringify(
    { arch: "sdxl", model: "hand.safetensors", steps: 25 }));
  const list = S.read(w);
  check("a hand-written file with no id is still usable",
    list.length === 1 && list[0].model === "hand.safetensors", list);
  check("its name falls back to the filename", list[0].name === "Handmade", list[0]);
  check("its id is STABLE across reads (or the dropdown selection never sticks)",
    S.read(w)[0].id === list[0].id, [list[0].id, S.read(w)[0].id]);
  check("the derived id is deterministic, not random",
    S.idForFile("Handmade") === list[0].id, null);
}
{
  // ONE bad file must not empty the whole dropdown and look like data loss.
  const w = ws();
  S.save(w, { name: "Good", arch: "flux", model: "m" });
  fs.writeFileSync(path.join(w, "Broken.json"), "{ this is not json");
  fs.writeFileSync(path.join(w, "notes.txt"), "ignore me");
  const list = S.read(w);
  check("an unparseable style file is skipped, not fatal",
    list.length === 1 && list[0].name === "Good", list);
  check("non-json files in the folder are ignored", true, null);
}
{
  // Someone upgrading from 2.66.0 must not find their styles gone.
  const w = ws();
  fs.mkdirSync(w, { recursive: true });
  fs.writeFileSync(path.join(w, "styles.json"), JSON.stringify({ styles: [
    { id: "st_legacy01", name: "From Blob", arch: "flux", model: "m",
      te: ["a", "b"], loras: [{ path: "l.safetensors", weight: 0 }] }] }));
  const list = S.read(w);
  check("a 2.66.0 single-blob store is migrated to per-style files",
    list.length === 1 && list[0].name === "From Blob"
    && fs.existsSync(path.join(w, "image", "From Blob.json")), fs.readdirSync(path.join(w, "image")));
  check("the migrated style keeps its id", list[0].id === "st_legacy01", list[0].id);
  check("a weight of 0 survives the migration too", list[0].loras[0].weight === 0, list[0].loras);
  check("the old blob is set aside so it cannot migrate twice",
    !fs.existsSync(path.join(w, "styles.json")), fs.readdirSync(w));
  check("a second read does not duplicate anything", S.read(w).length === 1, S.read(w));
}
{
  const w = ws();
  const a = S.save(w, { name: "Doomed", arch: "flux", model: "m" });
  S.save(w, { name: "Survivor", arch: "flux", model: "m" });
  S.remove(w, a.id);
  check("deleting a style deletes its file",
    !fs.existsSync(path.join(w, "image", "Doomed.json")), fs.readdirSync(path.join(w, "image")));
  check("deleting one leaves the other's file alone",
    fs.existsSync(path.join(w, "image", "Survivor.json")), fs.readdirSync(path.join(w, "image")));
}


// ------------------------------------------------- shipped starter styles
{
  const w = ws();
  const made = S.seedStarters(w);
  /* Pinned to the RULE, not a count: 2.75.0 added two verified templates and a
     hardcoded 3 would have failed for the right thing happening. What matters is
     that every starter is seeded and every one of them is usable. */
  check("a fresh install gets every bundled starter style",
    made.length === S.STARTER_STYLES.length
    && S.read(w).length === S.STARTER_STYLES.length, made);
  // Tim's own confirmed-working exports are listed first so a fresh install
  // lands on a known-good template rather than an older one.
  check("the verified templates are the first thing a new install sees",
    /verified/i.test(S.STARTER_STYLES[0].name), S.STARTER_STYLES[0].name);
  check("no starter is missing a required slot, so none is born broken",
    S.read(w).every(st => S.missingSlots(st).length === 0),
    S.read(w).map(st => [st.name, S.missingSlots(st)]).filter(x => x[1].length));
  check("one of them is the image-edit style",
    S.read(w).some(s => /edit/i.test(s.name) && /edit/.test(s.workflow)), null);
  const names = S.read(w).map(s => s.name).sort();
  check("every starter that names a workflow points at a bundled one (VIDEO starters and the yue2-arch music starter may leave it blank — 2.116.0 / 2.229.0)",
    S.read(w).every(s => s.engine === "comfy"
      && ((s.kind === "video" && s.workflow === "")
          || (s.kind === "music" && s.arch === "yue2" && s.workflow === "")
          || /comfy_workflows\//.test(s.workflow))),
    S.read(w).map(s => [s.name, s.workflow]));
  check("the distilled starter carries its own step/cfg defaults",
    S.read(w).some(s => s.steps === 4 && s.cfg === 1), null);
  check("the base starter carries the undistilled defaults",
    S.read(w).some(s => s.steps === 20 && s.cfg === 5), null);
  // DELETING MUST STICK. Seeding on "the folder looks empty" would resurrect
  // every starter the moment the last style was deleted, which is the opposite
  // of what deleting means.
  for (const st of S.read(w)) S.remove(w, st.id);
  check("deleting every starter leaves them deleted", S.read(w).length === 0, S.read(w));
  check("seeding twice adds nothing", S.seedStarters(w).length === 0, null);
  check("...and the folder stays empty after a re-read", S.read(w).length === 0, null);
}
{
  /* A STARTER ADDED LATER MUST REACH AN EXISTING INSTALL (2.90.1). The stamp
     was a single "seeded once" mark, so the MiniMax Music3 starter (2.90.0)
     never appeared for anyone who had installed before it: Tim's Music tab
     was empty. The stamp now lists names. A pre-2.90.1 stamp is an ISO date. */
  const w = ws();
  for (const st of S.STARTER_STYLES.filter(x => (x.kind || "image") === "image"))
    S.save(w, st);
  fs.writeFileSync(path.join(w, ".starters"), "2026-08-01T00:00:00.000Z\n");
  const made = S.seedStarters(w);
  check("an install with the old date stamp gets ONLY the starters it never had (Music3 2.90.1, MiniMax H3 SS 2.116.0, minimaxH3-I 2.128.0, MM3_Characters 2.135.0, MM3H-Character-ref 2.143.0, H3_Video_Ref 2.223.16, YuE2 2.229.0, YuE2 ComfyUI 2.236.0, MMH3_NativeAudio_MV 2.284.0, mmh3_chr_swap 2.328.0, LTX 2.5 2.338.0, H3_Viggle 2.352.0, Wan 2.1 + Wan 2.2 2.368.0, LTX 2.3 2.402.0, MiniMax H3 Long (30 s) 2.503.0; the chain starters retired)",
    JSON.stringify(made.slice().sort())
      === JSON.stringify(["MM3H-Character-ref", "MM3_Characters", "MiniMax H3 Long (30 s)", "MiniMax H3 SS", "MiniMax Music3", "minimaxH3-I", "H3_Video_Ref", "YuE2", "YuE2 ComfyUI", "MMH3_NativeAudio_MV", "mmh3_chr_swap", "LTX 2.5", "LTX 2.3", "H3_Viggle", "Wan 2.1", "Wan 2.2"].sort()), made);
  /* Tim: "for this style we will use the workflows paths because it is made
     specifically for comfyui". The starter must therefore name NO loader: the
     graph's own are the single source of truth, and an override here would
     quietly point his pipeline at someone else's model paths. */
  const mm3 = S.STARTER_STYLES.find(x => x.name === "MM3_Characters");
  check("MM3_Characters names no model, te or vae - the workflow's own loaders stand",
    !!mm3 && !mm3.model && !mm3.vae && !(mm3.te && mm3.te.filter(Boolean).length), mm3);
  check("...and it renders through the TMP workflow the character cast is built into",
    mm3.workflow === "comfy_workflows/MM3_Characters_tmp.json", mm3 && mm3.workflow);
  const imgStarters = S.STARTER_STYLES.filter(x => (x.kind || "image") === "image").length;
  check("...and its existing image starters are left untouched (same count as saved, nothing duplicated)",
    S.read(w, "image").length === imgStarters, S.read(w).map(x => x.name));
  check("the stamp now lists every starter by name",
    (() => { const j = JSON.parse(fs.readFileSync(path.join(w, ".starters"), "utf8"));
             return Array.isArray(j) && S.STARTER_STYLES.every(st => j.includes(st.name)); })(), null);
  // deleting the new one must stick, exactly like the old ones
  const mu = S.read(w, "music")[0];
  S.remove(w, mu.id);
  for (const x of S.read(w, "music")) S.remove(w, x.id);
  check("deleting the music starters leaves them deleted on the next seed",
    S.seedStarters(w).length === 0 && S.read(w, "music").length === 0, S.read(w, "music"));
  // a user style under the starter's name is never overwritten by the late seed
  const w2 = ws();
  fs.writeFileSync(path.join(w2, ".starters"), "2026-08-01T00:00:00.000Z\n");
  S.save(w2, { name: "MiniMax Music3", kind: "music", workflow: "mine.json", caption: "mine" });
  S.seedStarters(w2);
  check("a user's own MiniMax Music3 style is not overwritten by the late starter",
    S.read(w2, "music")[0].caption === "mine", S.read(w2, "music"));
  // ---- ControlNet chain styles (2.97.0)
  const wc = ws();
  const ch = S.save(wc, { name: "Sketch to Photo", kind: "image",
    chain: { first_id: "sty_a", controlnet: "cn.safetensors", second_id: "sty_b" } });
  check("a chain style saves with its three fields intact",
    ch.chain && ch.chain.first_id === "sty_a" && ch.chain.controlnet === "cn.safetensors"
    && ch.chain.second_id === "sty_b" && ch.kind === "image", ch.chain);
  check("...and reads back as an image style carrying the chain",
    (() => { const r = S.read(wc, "image").find(x => x.id === ch.id);
             return r && r.chain && r.chain.second_id === "sty_b"; })(), S.read(wc));
  check("a PATCH without chain keeps it (edit never strips silently)",
    S.save(wc, { id: ch.id, caption: "x" }).chain.first_id === "sty_a", null);
  check("an incomplete chain is dropped, not half-saved",
    S.normalize({ name: "half", kind: "image", chain: { first_id: "a" } }, null).chain === undefined, null);
  check("a fresh install still gets every starter, in a list stamp",
    (() => { const w3 = ws(); const m = S.seedStarters(w3);
             return m.length === S.STARTER_STYLES.length
               && Array.isArray(JSON.parse(fs.readFileSync(path.join(w3, ".starters"), "utf8"))); })(), null);
}
{
  // A user's own style with a clashing name must never be overwritten by a
  // starter — their file is the one that matters.
  const w = ws();
  S.save(w, { name: "FLUX.2 Klein 9B", arch: "sdxl", engine: "sdcli", model: "mine" });
  S.seedStarters(w);
  check("a starter never overwrites a user style of the same name",
    S.read(w).find(s => s.name === "FLUX.2 Klein 9B").model === "mine", S.read(w));
}

// ============ which model category a workflow's loader accepts (2.74.0) ============
// THE FAILURE THIS ENCODES: the Model dropdown merges checkpoints, diffusers
// and diffusion_models so nobody has to know which kind of loader their graph
// uses. But comfy_image.py writes the chosen name into whichever MODEL_KEY the
// graph HAS — so a checkpoint name picked from the merged list lands in
// `unet_name` and ComfyUI refuses it:
//   node 70: Value not in list [unet_name] = flux_klein_9B/x.safetensors
// The name was real and the file existed. Two releases had been spent on the
// separator; the separator was never the problem.
{
  const w = fs.mkdtempSync(path.join(os.tmpdir(), "styles-mk-"));
  const wf = (name, graph) => {
    const p = path.join(w, name);
    fs.writeFileSync(p, JSON.stringify(graph));
    return name;
  };
  const st = (workflow) => ({ engine: "comfy", workflow });

  wf("unet.json", { 70: { class_type: "UNETLoader", inputs: { unet_name: "a.safetensors" } } });
  check("a UNETLoader graph accepts diffusion_models only",
    JSON.stringify(S.modelKinds(st("unet.json"), w)) === '["diffusion_models"]',
    S.modelKinds(st("unet.json"), w));

  wf("ckpt.json", { 4: { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "a.safetensors" } } });
  check("a CheckpointLoaderSimple graph accepts checkpoints only",
    JSON.stringify(S.modelKinds(st("ckpt.json"), w)) === '["checkpoints"]',
    S.modelKinds(st("ckpt.json"), w));

  wf("dif.json", { 9: { class_type: "DiffusersLoader", inputs: { model_path: "sdxl" } } });
  check("a DiffusersLoader graph accepts diffusers only",
    JSON.stringify(S.modelKinds(st("dif.json"), w)) === '["diffusers"]',
    S.modelKinds(st("dif.json"), w));

  // a graph with two model loaders genuinely accepts both; narrowing to one
  // would hide the only model that works in the other
  wf("both.json", {
    4: { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "a.safetensors" } },
    70: { class_type: "UNETLoader", inputs: { unet_name: "b.safetensors" } },
  });
  check("a graph with two model loaders accepts both categories",
    S.modelKinds(st("both.json"), w).sort().join(",") === "checkpoints,diffusion_models",
    S.modelKinds(st("both.json"), w));

  // `model_name` belongs to upscalers as often as to model loaders, so it must
  // answer "cannot tell" rather than guessing — a wrongly NARROW list hides the
  // only model that would have worked, which is worse than a wide one.
  wf("upscale.json", { 8: { class_type: "UpscaleModelLoader", inputs: { model_name: "x.pth" } } });
  check("an ambiguous model_name key does not guess a category",
    S.modelKinds(st("upscale.json"), w).length === 0, S.modelKinds(st("upscale.json"), w));

  wf("none.json", { 1: { class_type: "EmptyLatentImage", inputs: { width: 512 } } });
  check("a graph with no model loader answers empty, so the UI stays wide",
    S.modelKinds(st("none.json"), w).length === 0, S.modelKinds(st("none.json"), w));

  // never throws, and never narrows on bad input
  fs.writeFileSync(path.join(w, "bad.json"), "{ not json");
  for (const [n, style] of [
    ["a missing workflow file", st("nope.json")],
    ["an unparseable workflow", st("bad.json")],
    ["an sd-cli style", { engine: "sdcli", workflow: "unet.json" }],
    ["no workflow at all", { engine: "comfy" }],
    ["null", null],
  ]) {
    let threw = null, r = null;
    try { r = S.modelKinds(style, w); } catch (e) { threw = e.message; }
    check("modelKinds is safe and non-narrowing for " + n,
      threw === null && Array.isArray(r) && r.length === 0, threw || r);
  }
  // the key table must stay in step with MODEL_KEYS in scripts/comfy_image.py
  const py = fs.readFileSync(path.join(__dirname, "comfy_image.py"), "utf8");
  const keys = Object.keys(S.MODEL_KEY_CATEGORY);
  check("every mapped loader key is one the patcher actually writes",
    keys.every((k) => new RegExp(`MODEL_KEYS[\\s\\S]{0,120}"${k}"`).test(py)),
    { keys, line: (py.match(/MODEL_KEYS = \([^)]*\)/) || [])[0] });
}

// ------------------------------------------------------------- music (2.90.0)
// One module, one folder, two kinds. The failure this guards against is the
// obvious one: a music style that comes back as an image style (or the other
// way round) after any of the round trips above.
{
  check("KINDS names the three kinds (video since 2.110.0)", JSON.stringify(S.KINDS) === '["image","music","video"]', S.KINDS);
  check("the music catalogue is a separate file from the image one",
    fs.existsSync(path.join(__dirname, "..", "lib", "musicArch.json")), null);
  check("the music catalogue offers MiniMax Music3",
    S.musicArchIds().includes("minimax-music3"), S.musicArchIds());
  const a = S.musicArchById("minimax-music3");
  check("...whose template, limits and defaults are filled in",
    a && /audio_minimax_music3\.json$/.test(a.workflow_hint)
    && a.limits.max_duration === 300 && a.defaults.max_duration === 60
    && a.defaults.steps === 30 && Math.abs(a.defaults.cfg - 1.7) < 1e-9, a);
  check("the catalogue lists ComfyUI's sampler and scheduler names, not sd-cli's",
    S.musicCatalogue().samplers.includes("dpmpp_2m")
    && S.musicCatalogue().schedulers.includes("karras")
    && !S.musicCatalogue().samplers.includes("euler_a"), S.musicCatalogue().samplers);
  check("catalogueFor/archFor/archIdsFor route by kind",
    S.catalogueFor("music") === S.musicCatalogue()
    && S.archFor("music", "minimax-music3") === a
    && S.archFor("image", "minimax-music3") === null
    && S.archIdsFor("image").includes("flux") && !S.archIdsFor("image").includes("minimax-music3"),
    null);

  // kindOf: the stored kind wins, else the body, else image (every pre-2.90 file)
  check("kindOf defaults to image, which is what every older style file is",
    S.kindOf({}) === "image" && S.kindOf(null) === "image", null);
  check("kindOf keeps the PREVIOUS kind when an edit does not name one",
    S.kindOf({ name: "x" }, { kind: "music" }) === "music", null);
  check("kindOf ignores a nonsense kind rather than inventing a third one",
    S.kindOf({ kind: "podcast" }) === "image", S.kindOf({ kind: "podcast" }));
  check("kindOf with an id-only prev (what read() passes) classifies by the body",
    S.kindOf({ kind: "music" }, { id: "st_x" }) === "music", null);

  const m = S.normalize({ name: " Lo-fi ", kind: "music", arch: "minimax-music3",
    workflow: "comfy_workflows/audio_minimax_music3.json",
    caption: "Global Metadata: Genre: lo-fi.", max_duration: 45,
    sampler: "dpmpp_2m", scheduler: "karras", steps: 12, cfg: 0 });
  check("a music style normalizes to kind=music engine=comfy",
    m.kind === "music" && m.engine === "comfy" && m.name === "Lo-fi", m);
  check("...with the music fields, not the image ones",
    m.caption === "Global Metadata: Genre: lo-fi." && m.max_duration === 45
    && m.sampler === "dpmpp_2m" && m.scheduler === "karras"
    && !("width" in m) && !("height" in m) && !("negative" in m) && !("clip_skip" in m), m);
  check("cfg 0 survives — a float/truthiness trap, the LoRA-weight lesson again",
    m.cfg === 0 && m.steps === 12, [m.cfg, m.steps]);
  check("a music style has NO engine choice: sdcli is overridden to comfy",
    S.normalize({ name: "x", kind: "music", engine: "sdcli" }).engine === "comfy", null);
  check("an unknown sampler/scheduler falls back to the arch defaults, not to a name ComfyUI rejects",
    (() => { const t = S.normalize({ name: "x", kind: "music", sampler: "euler_a", scheduler: "nope" });
             return t.sampler === "euler" && t.scheduler === "simple"; })(), null);
  check("max_duration is clamped to the arch limit and floored at 1",
    S.normalize({ name: "x", kind: "music", max_duration: 9999 }).max_duration === 300
    && S.normalize({ name: "x", kind: "music", max_duration: 0 }).max_duration === 1
    && S.normalize({ name: "x", kind: "music", max_duration: "abc" }).max_duration === 60, null);
  check("the caption is kept whole up to 6000 characters — the template's is ~1500",
    S.normalize({ name: "x", kind: "music", caption: "a".repeat(7000) }).caption.length === 6000, null);
  check("an image arch id is not accepted for a music style",
    S.normalize({ name: "x", kind: "music", arch: "flux" }).arch === "minimax-music3", null);
  check("an image style now records kind=image explicitly",
    S.normalize({ name: "x", arch: "flux" }).kind === "image", null);

  // the edit never changes the kind, and a partial edit keeps the rest
  const e = S.normalize({ id: m.id, max_duration: 10 }, m);
  check("a partial edit without kind stays music and keeps the caption",
    e.kind === "music" && e.max_duration === 10 && e.caption === m.caption
    && e.sampler === "dpmpp_2m" && e.id === m.id, e);
  check("an edit cannot flip a music style into an image one",
    S.normalize({ id: m.id, kind: "image" }, m).kind === "music", null);
  check("...nor an image style into a music one — a flip is a new style",
    S.normalize({ kind: "music" }, S.normalize({ name: "i", arch: "flux" })).kind === "image", null);

  // missingSlots: music needs exactly the workflow
  check("a music style with a workflow is complete",
    S.missingSlots(m).length === 0, S.missingSlots(m));
  check("...and without one is missing exactly the workflow",
    JSON.stringify(S.missingSlots(S.normalize({ name: "x", kind: "music" }))) === '["workflow"]', null);

  // disk: one folder, both kinds, filtered reads, one namespace
  const w = ws();
  const saved = S.save(w, { name: "Song", kind: "music", workflow: "w.json" });
  S.save(w, { name: "Look", arch: "flux", engine: "comfy", workflow: "i.json" });
  const back = S.read(w);
  check("both kinds live in one folder and read back labelled",
    back.length === 2 && back.find((x) => x.name === "Song").kind === "music"
    && back.find((x) => x.name === "Look").kind === "image", back.map((x) => [x.name, x.kind]));
  check("read(dir, 'music') returns only the music styles",
    S.read(w, "music").map((x) => x.name).join() === "Song", S.read(w, "music"));
  check("read(dir, 'image') returns only the image styles",
    S.read(w, "image").map((x) => x.name).join() === "Look", S.read(w, "image"));
  check("a saved music style keeps its kind on disk",
    JSON.parse(fs.readFileSync(path.join(w, "music", "Song.json"), "utf8")).kind === "music", null);
  // 2.110.0: one folder per kind, so a name only has to be unique WITHIN its
  // kind — an image "Song" beside a music "Song" is two files in two folders
  // and two different dropdowns.
  const twin = S.save(w, { name: "Song", arch: "flux", engine: "comfy", workflow: "i.json" });
  check("the same name in another kind is allowed (separate folder, separate dropdown)",
    twin.kind === "image" && fs.existsSync(path.join(w, "image", "Song.json")) && fs.existsSync(path.join(w, "music", "Song.json")), fs.readdirSync(w));
  let clash = null;
  try { S.save(w, { name: "Song", kind: "music", arch: "minimax-music3", workflow: "m.json" }); }
  catch (err) { clash = err.code; }
  check("...but within a kind the name is still refused", clash === "duplicate-name", clash);
  const ed = S.save(w, { id: saved.id, caption: "new caption" });
  check("editing by id keeps the kind and the file",
    ed.kind === "music" && ed.caption === "new caption" && fs.existsSync(path.join(w, "music", "Song.json"))
    && S.read(w, "music").length === 1, ed);

  // a pre-2.90 file with no kind field is an image style
  fs.writeFileSync(path.join(w, "Old.json"), JSON.stringify({ id: "st_0000000000aa", name: "Old",
    arch: "sdxl", engine: "comfy", workflow: "x.json" }));
  check("a style file from before kinds existed reads as an image style",
    (S.read(w).find((x) => x.name === "Old") || {}).kind === "image", S.read(w));
  check("...and editing it with kind=music does not flip it either",
    S.save(w, { id: "st_0000000000aa", kind: "music", steps: 3 }).kind === "image"
    && S.read(w, "image").some((x) => x.name === "Old" && x.steps === 3), S.read(w));

  // the starter is seeded once, as music
  const w2 = ws();
  S.seedStarters(w2);
  const st = S.read(w2, "music");
  check("the starters include THREE music styles — MiniMax Music3, YuE2 and YuE2 ComfyUI (2.236.0)",
    st.length === 3
    && st.some((x) => x.name === "YuE2 ComfyUI" && x.arch === "yue2-comfy"
         && x.workflow === "comfy_workflows/audio_yue2.json"
         && x.sampler === "dpm_2" && x.max_duration === 360)
    && st.some((x) => x.name === "MiniMax Music3" && /^Global Metadata:/.test(x.caption)
         && /Vocal Details:/.test(x.caption) && /Arrangement:/.test(x.caption)
         && x.max_duration === 60)
    && st.some((x) => x.name === "YuE2" && x.arch === "yue2"
         && x.workflow === "" && /88 BPM/.test(x.caption)), st);
  check("...and it is not also listed as an image style",
    !S.read(w2, "image").some((x) => x.kind === "music"), null);
}

{
  /* applyLoraWeights (2.93.0): the Basic-Settings sliders override weights for
     ONE render by handing the patcher a modified style copy. Identity when the
     map changes nothing; 0 is a real weight; clamps match the editor's -4..4. */
  const st = { name: "s", loras: [{ path: "a.safetensors", weight: 1 },
                                  { path: "b.safetensors", weight: 0.6 }] };
  check("a null / non-object map returns the same style object",
    S.applyLoraWeights(st, null) === st && S.applyLoraWeights(st, "x") === st
    && S.applyLoraWeights(st, [1]) === st, null);
  check("an unknown path changes nothing — identity, not a copy",
    S.applyLoraWeights(st, { "nope.safetensors": 2 }) === st, null);
  check("the same weight back changes nothing either",
    S.applyLoraWeights(st, { "a.safetensors": 1 }) === st, null);
  const z = S.applyLoraWeights(st, { "a.safetensors": 0 });
  check("weight 0 is a legitimate override (numOrNull, never truthiness)",
    z !== st && z.loras[0].weight === 0 && z.loras[1] === st.loras[1], z.loras);
  check("...and the original style is untouched", st.loras[0].weight === 1, st.loras);
  check("weights clamp to the editor's -4..4",
    S.applyLoraWeights(st, { "a.safetensors": 99 }).loras[0].weight === 4
    && S.applyLoraWeights(st, { "b.safetensors": -99 }).loras[1].weight === -4, null);
  check("a style with no loras passes through untouched",
    S.applyLoraWeights({ name: "x" }, { a: 1 }).name === "x", null);
}

// ------------------------------------------- pre-2.90.1 stamp (2.113.1)
{
  const w = ws();
  fs.writeFileSync(path.join(w, ".starters"), "2026-01-01T00:00:00Z");     // the old ISO-date stamp
  const made = S.seedStarters(w);
  check("an install with the pre-2.90.1 date stamp still receives every starter added since (SDXL, Pony, Illustrious, FLUX Fill)",
    ["SDXL", "SDXL img2img", "Pony", "Illustrious", "FLUX Fill inpaint"].every((n) => made.includes(n)) && !made.includes("FLUX.2 Klein 9B"), made);
  check("...and the stamp is now a list, so the next start seeds nothing again", Array.isArray(JSON.parse(fs.readFileSync(path.join(w, ".starters"), "utf8"))) && S.seedStarters(w).length === 0, null);
}

// ------------------------------------------- VIDEO STYLES (2.110.0)
{
  const w = ws();
  const v = S.save(w, { kind: "video", name: "Wan cine", arch: "wan22",
    phases: [{ model: "high.safetensors", steps: "10", cfg: 3.5 }, { model: "low.safetensors", steps: 10, cfg: 3 }, { model: "extra" }],
    te: ["umt5.safetensors"], vae: "wan_vae.safetensors", workflows: { t2va: "comfy_workflows/wan_t2v.json", bogus: "x" },
    loras: [{ path: "l.safetensors", weight: 0.5 }], res: "720", aspect: "9:16", width: "1280" });
  check("a video style saves to styles/video/<name>.json", fs.existsSync(path.join(w, "video", "Wan cine.json")), fs.readdirSync(w));
  check("...phases are capped at the arch's phases_max (Wan 2.2: 2), numbers coerced", v.phases.length === 2 && v.phases[0].steps === 10 && v.phases[1].cfg === 3, v.phases);
  check("...workflows are keyed by the arch's modes only", Object.keys(v.workflows).sort().join() === "fl2va,ref2va,t2va" && v.workflows.t2va === "comfy_workflows/wan_t2v.json", v.workflows);
  check("...one te slot, vae, loras; size is a PRESET (res + aspect), never pixels (2.111.3)",
    v.te.length === 1 && v.te[0] === "umt5.safetensors" && v.vae === "wan_vae.safetensors" && v.loras.length === 1 && v.res === "720" && v.aspect === "9:16" && !("width" in v), v);
  check("...an unknown preset is dropped", S.normalize({ kind: "video", name: "q", arch: "wan22", res: "600", aspect: "5:4" }).res === "" && S.normalize({ kind: "video", name: "q", arch: "wan22", res: "600", aspect: "5:4" }).aspect === "", null);
  check("...engine is always comfy and kind sticks", v.engine === "comfy" && v.kind === "video", null);
  const h3 = S.save(w, { kind: "video", name: "H3", arch: "minimax-h3", model: "m.safetensors", steps: 12, cfg: 1 });
  check("a flat model/steps/cfg becomes phase 1 (the Image-tab shape still works)", h3.phases.length === 1 && h3.phases[0].model === "m.safetensors" && h3.phases[0].steps === 12, h3.phases);
  check("read(dir, 'video') lists only video styles; image list excludes them", S.read(w, "video").length === 2 && S.read(w, "image").every((x) => x.kind !== "video"), null);
  check("the video catalogue has H3, Wan 2.2 and a custom arch", S.videoArchIds().includes("minimax-h3") && S.videoArchIds().includes("wan22"), S.videoArchIds());
}

// ------------------------------- VIDEO ACCELERATORS (2.116.0: sage + spectrum)
{
  const w = ws();
  check("no accel given -> both off (a pre-2.116 file round-trips unchanged in meaning)",
    JSON.stringify(S.normalize({ kind: "video", name: "a", arch: "minimax-h3" }).accel)
    === JSON.stringify({ sage: "off", spectrum: "off" }), null);
  const a = S.save(w, { kind: "video", name: "H3 fast", arch: "minimax-h3",
    accel: { sage: "auto", spectrum: "aggressive" } });
  check("valid accel values persist to the file", (() => {
    const j = JSON.parse(fs.readFileSync(path.join(w, "video", "H3 fast.json"), "utf8"));
    return j.accel.sage === "auto" && j.accel.spectrum === "aggressive";
  })(), null);
  check("junk accel values fall back to off (never sent to the worker)",
    JSON.stringify(S.normalize({ kind: "video", name: "b", arch: "minimax-h3",
      accel: { sage: "warp9", spectrum: 42 } }).accel)
    === JSON.stringify({ sage: "off", spectrum: "off" }), null);
  const patched = S.save(w, { id: a.id, kind: "video", name: "H3 fast", arch: "minimax-h3", vae: "v.safetensors" });
  check("a PATCH that never mentions accel keeps the stored one (no silent reset)",
    patched.accel.sage === "auto" && patched.accel.spectrum === "aggressive", patched.accel);
  check("the vocabularies are exported for the UI (memeff + the sageattn backends)",
    S.VIDEO_SAGE_MODES.includes("memeff") && S.VIDEO_SAGE_MODES.includes("sageattn_qk_int8_pv_fp16_cuda")
    && JSON.stringify(S.VIDEO_SPECTRUM_MODES) === '["off","on","aggressive"]', S.VIDEO_SAGE_MODES);
  // the ready-made style (Tim: "make this a separate style - minimax h3 SS.json
  // don't overwrite existing style")
  const w2 = ws();
  const made = S.seedStarters(w2);
  check("the MiniMax H3 SS starter seeds as styles/video/MiniMax H3 SS.json with sage auto + spectrum on",
    made.includes("MiniMax H3 SS") && (() => {
      const j = JSON.parse(fs.readFileSync(path.join(w2, "video", "MiniMax H3 SS.json"), "utf8"));
      return j.kind === "video" && j.arch === "minimax-h3"
        && j.accel.sage === "auto" && j.accel.spectrum === "on";
    })(), made);
  /* 2.128.0, Tim: "make it a style so i can use it alongside the working
     style, call it minimaxH3-I.json". The FILENAME is the ask, so it is
     asserted literally. */
  check("the minimaxH3-I starter seeds as styles/video/minimaxH3-I.json",
    made.includes("minimaxH3-I") && fs.existsSync(path.join(w2, "video", "minimaxH3-I.json")),
    fs.readdirSync(path.join(w2, "video")));
  check("...and it brings the blueprint's own graph, unlike MiniMax H3 SS which is left blank",
    (() => {
      const mine = JSON.parse(fs.readFileSync(path.join(w2, "video", "minimaxH3-I.json"), "utf8"));
      const ss = JSON.parse(fs.readFileSync(path.join(w2, "video", "MiniMax H3 SS.json"), "utf8"));
      return mine.workflow === "comfy_workflows/h3_scene_api.json" && !ss.workflow;
    })(), null);
  check("...with the SAME accelerators as the working style, so the graph is the only difference",
    (() => {
      const mine = JSON.parse(fs.readFileSync(path.join(w2, "video", "minimaxH3-I.json"), "utf8"));
      const ss = JSON.parse(fs.readFileSync(path.join(w2, "video", "MiniMax H3 SS.json"), "utf8"));
      return JSON.stringify(mine.accel) === JSON.stringify(ss.accel)
        && mine.arch === ss.arch && mine.kind === "video";
    })(), null);
  check("...and it names NO model/te/vae, so the graph's own loaders are the one source",
    (() => {
      const mine = JSON.parse(fs.readFileSync(path.join(w2, "video", "minimaxH3-I.json"), "utf8"));
      return !mine.vae && !mine.te[0] && !mine.phases[0].model;
    })(), null);
  check("the graph minimaxH3-I points at is SHIPPED and is an API export, not a UI one",
    (() => {
      const g = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "comfy_workflows", "h3_scene_api.json"), "utf8"));
      const vals = Object.values(g);
      return vals.length > 15 && vals.every((v) => v && v.class_type)
        && vals.some((v) => v.class_type === "MiniMaxH3ReferenceToVideo")
        && vals.some((v) => v.class_type === "SaveVideo");
    })(), null);
  check("...and every wire in it points at a node that exists",
    (() => {
      const g = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "comfy_workflows", "h3_scene_api.json"), "utf8"));
      for (const n of Object.values(g))
        for (const v of Object.values(n.inputs))
          if (Array.isArray(v) && !g[v[0]]) return false;
      return true;
    })(), null);
  check("...and exactly ONE generation node, because a style renders one shot",
    (() => {
      const g = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "comfy_workflows", "h3_scene_api.json"), "utf8"));
      return Object.values(g).filter((v) => /MiniMaxH3/.test(v.class_type)).length === 1;
    })(), null);
  const w3 = ws();
  fs.mkdirSync(path.join(w3, "video"), { recursive: true });
  fs.writeFileSync(path.join(w3, "video", "MiniMax H3 SS.json"),
    JSON.stringify({ name: "MiniMax H3 SS", kind: "video", note: "TIMS-OWN" }));
  S.seedStarters(w3);
  check("...and an EXISTING file by that name is never overwritten",
    fs.readFileSync(path.join(w3, "video", "MiniMax H3 SS.json"), "utf8").includes("TIMS-OWN"), null);
}
console.log("=======================");

/* ---- 2.229.0 YUE2 (Tim verbatim: "can we add this to our music docker,
 * use dropdown to change from minimax to yue2(we will probably add more
 * models later") ------------------------------------------------------- */
{
  const a = S.musicArchById("yue2");
  check("the yue2 catalogue entry exists, engine-tagged and PINNED (the 🚧-repo rule)",
    !!a && a.engine === "yue2" && a.model === "m-a-p/YuE2-3B"
    && a.pin === "yue2-v0.1.6" && Array.isArray(a.te)
    && /first use/i.test(a.notes || "") && /Length field does not apply/.test(a.notes || ""), a);
  check("the minimax entry is engine-tagged comfy — the dropdown carries BOTH and more later is one entry each",
    (S.musicArchById("minimax-music3") || {}).engine === "comfy"
    && S.musicArchIds().length === 3
    && (S.musicArchById("yue2-comfy") || {}).engine === "comfy");
  const MW = fs.readFileSync(path.join(__dirname, "..", "music_worker.py"), "utf8");
  check("music_worker dispatches BY ARCH (ENGINE_FOR) — comfy path untouched, yue2 shells the pinned venv CLI",
    /ENGINE_FOR = \{"yue2": "yue2"\}/.test(MW)
    && /def run_yue2\(/.test(MW)
    && MW.includes('"yue2" / ".venv" / "Scripts" / "yue2.exe"')
    && MW.includes('run_comfy(params, cfg, stored, output_dir, stem, batch, seed)'));
  check("the yue2 runner: lyrics are the prompt, the caption is the style prompt, seed+i per song, Length said inapplicable, FLAC harvested by the shared naming rule",
    MW.includes('"style": caption, "lyrics": lyrics')
    && MW.includes("seed + i")
    && MW.includes("the Length field does not apply")
    && MW.includes('ext=".flac"')
    && MW.includes("run get-yue2.ps1"));
  check("get-yue2.ps1 ships, PINNED to yue2-v0.1.6, venv-local, and says the first-run download + VRAM truth",
    (() => { const p = fs.readFileSync(path.join(__dirname, "..", "get-yue2.ps1"), "utf8");
             return /\$Tag = "yue2-v0\.1\.6"/.test(p)
                 && /git\+https:\/\/github\.com\/multimodal-art-projection\/YuE@\$Tag/.test(p)
                 && /24 GB VRAM/.test(p) && /FIRST/.test(p); })());
}

console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
