#!/usr/bin/env node
/* bitGen Studio — THE NATIVE REFERENCE MAP (2.290.0). Run: node scripts/test-refmap.js
 *
 * Tim (verbatim): "can we add 9 images and 3 audio files to the
 * mmh3_native audio_mv workflow, and modify the custom node to accept the
 * 9 reference images and 3 audio files, so we can use the characters and
 * character sheets, locations, props, vehicles etc. in the video docker
 * for music videos".
 *
 * The references land on MiniMaxH3ReferenceToVideo (a CORE node, 9/3/3
 * limits) - the NativeAudioLock node only locks the song into the latent
 * and never sees a reference, so the workflow grew the loaders and the
 * APP learned to fill and number them. The LIVE render through the stub is
 * an e2e leg (the server already runs there); these legs hold the pieces. */
"use strict";
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const RM = require("../lib/refMap");

// ---- 1. lib/refMap.compose ------------------------------------------------
{
  const img = (t, kind, label) => ({ file: `/x/${t}.png`, tag: t, kind, label });
  const m = RM.compose(
    [{ file: "/tmp/f.png", name: "continuation frame (clip_01)", kind: "frame",
       label: "the end of clip_01 - keep its framing" },
     img("vera", "sheet", "Vera"), img("red_car", "sheet", "Red Car"),
     img("rooftop", "location", "Rooftop"), img("mic_stand", "reference", "mic.png")],
    [{ file: "/s/song.wav", kind: "song", label: "0s + 8s of song.wav" },
     { file: "/c/vera.wav", tag: "vera_voice", kind: "voice", label: "Vera" }]);
  check("the frame is <Picture 1>, then the sheets, locations and props in order; the song is <Audio 1>",
    m.files.join(",") === "/tmp/f.png,/x/vera.png,/x/red_car.png,/x/rooftop.png,/x/mic_stand.png"
    && m.audios.join(",") === "/s/song.wav,/c/vera.wav", m);
  check("the header says what every number IS (tag, kind, label)",
    m.header[0] === "References, in the order they are connected:"
    && m.header[1] === "<Picture 1> is continuation frame (the end of clip_01 - keep its framing)."
    && m.header[2] === "<Picture 2> is @vera - character sheet (Vera)."
    && m.header[3] === "<Picture 3> is @red_car - character sheet (Red Car)."
    && m.header[4] === "<Picture 4> is @rooftop - location view (Rooftop)."
    && m.header[5] === "<Picture 5> is @mic_stand - reference picture (mic.png)."
    && m.header[6] === "<Audio 1> is the song segment (0s + 8s of song.wav)."
    // 2.363.0: a voice is a timbre whose words are never said
    && m.header[7] === "<Audio 2> is @vera_voice - the voice timbre of Vera: copy only its pitch, accent, texture and emotional colour, never the words heard in it.", m.header);
  const p = m.prompt("[Shot 2] @vera drives the @red_car onto the @rooftop; @nobody watches. mail@vera.com");
  check("the prompt: header, blank line, then the body with each @tag turned into ITS number; an unknown tag and an e-mail stay as written",
    p.startsWith(m.header.join("\n") + "\n\n")
    && p.endsWith("[Shot 2] <Picture 2> drives the <Picture 3> onto the <Picture 4>; @nobody watches. mail@vera.com"), p);
  check("tags are case-insensitive and the FIRST slot of a tag wins",
    RM.compose([img("vera", "sheet"), img("vera", "clothing")], []).rewrite("@Vera") === "<Picture 1>");
  const many = RM.compose(Array.from({ length: 12 }, (_, i) => img("p" + i, "sheet")),
    Array.from({ length: 5 }, (_, i) => ({ file: `/a/${i}.wav`, tag: "a" + i, kind: "voice" })));
  check("capped at the node's 9 pictures and 3 audios - the rest reported as dropped, never numbered",
    many.files.length === 9 && many.audios.length === 3
    && many.dropped.images.length === 3 && many.dropped.audios.length === 2
    && many.rewrite("@p10 and @a4") === "@p10 and @a4" && many.rewrite("@p8") === "<Picture 9>", many.dropped);
  const e = RM.compose([], [{ file: "/s/x.wav", kind: "song", entry: "/s/x.wav" }]);
  check("an entry override rides the audio list; no pictures = no picture lines",
    e.audios[0] === "/s/x.wav" && e.header.length === 2 && e.prompt("a").endsWith("\n\na"), e.header);
  check("nothing at all = the prompt untouched", RM.compose([], []).prompt("x") === "x");
}

// ---- 2. the workflow: nine picture loaders, three audio loaders --------------
{
  const ui = JSON.parse(read("comfy_workflows", "MMH3_NativeAudio_MV.ui.json"));
  const byId = new Map(ui.nodes.map((n) => [n.id, n]));
  const r2v = ui.nodes.find((n) => n.type === "MiniMaxH3ReferenceToVideo");
  const linkOf = (id) => ui.links.find((l) => l[0] === id);
  const imgSlots = r2v.inputs.filter((i) => i.name.startsWith("ref_images."));
  const audSlots = r2v.inputs.filter((i) => i.name.startsWith("ref_audios."));
  check("MiniMaxH3ReferenceToVideo carries ref_image_0..8 and ref_audio_0..2, every one LINKED",
    imgSlots.map((i) => i.name).join() === Array.from({ length: 9 }, (_, i) => "ref_images.ref_image_" + i).join()
    && audSlots.map((i) => i.name).join() === "ref_audios.ref_audio_0,ref_audios.ref_audio_1,ref_audios.ref_audio_2"
    && imgSlots.concat(audSlots).every((i) => i.link != null), r2v.inputs.map((i) => [i.name, i.link]));
  const srcOf = (slot) => byId.get(linkOf(slot.link)[1]);
  check("each picture slot is fed by its OWN LoadImage; audio 0 by the song's TrimAudioDuration, audios 1-2 by their own LoadAudio",
    imgSlots.every((s) => srcOf(s).type === "LoadImage")
    && new Set(imgSlots.map((s) => srcOf(s).id)).size === 9
    && srcOf(audSlots[0]).type === "TrimAudioDuration"
    && srcOf(audSlots[1]).type === "LoadAudio" && srcOf(audSlots[2]).type === "LoadAudio");
  check("every link's destination slot is the index of the input that holds it (no shifted wiring)",
    ui.links.filter((l) => l[3] === r2v.id).every((l) => r2v.inputs[l[4]] && r2v.inputs[l[4]].link === l[0])
    && ui.last_node_id >= Math.max(...ui.nodes.map((n) => n.id))
    && ui.last_link_id >= Math.max(...ui.links.map((l) => l[0])));
  const song = byId.get(linkOf(byId.get(linkOf(audSlots[0].link)[1]).inputs
    .find((i) => i.name === "audio").link)[1]);
  const imgIds = imgSlots.map((s) => srcOf(s).id), audIds = [song.id, srcOf(audSlots[1]).id, srcOf(audSlots[2]).id];
  check("loader ids ASCEND in slot order (the worker fills loaders in id order): Picture 1 = the original loader, the song loader first among the audios",
    imgIds.every((v, i) => !i || v > imgIds[i - 1]) && audIds.every((v, i) => !i || v > audIds[i - 1]),
    { imgIds, audIds });
  check("the song still feeds the lock node (the lock needs no new inputs - it never sees a reference)",
    ui.nodes.filter((n) => n.type === "MiniMaxH3NativeAudioLock").length === 1
    && byId.get(linkOf(ui.nodes.find((n) => n.type === "MiniMaxH3NativeAudioLock").inputs
      .find((i) => i.name === "audio").link)[1]).type === "TrimAudioDuration");
  const types = {};
  ui.nodes.forEach((n) => { types[n.type] = { input: { required: {} }, output: [], output_name: [] }; });
  const out = require("../lib/graphToApi").convert(ui, types);
  const g = out.graph || {};
  const gr = Object.values(g).find((v) => v.class_type === "MiniMaxH3ReferenceToVideo") || { inputs: {} };
  check("the export CONVERTS with the 9 + 3 dotted keys linked to their loaders",
    Object.keys(gr.inputs).filter((k) => /^ref_images\.ref_image_\d$/.test(k)).length === 9
    && Object.keys(gr.inputs).filter((k) => /^ref_audios\.ref_audio_\d$/.test(k)).length === 3
    && !(out.unknown || []).length, Object.keys(gr.inputs));
  check("NOTICE.md says the export is now MODIFIED (nine picture + three audio loaders)",
    read("NOTICE.md").includes("2.290.0 modification"));
}

// ---- 3. the wiring ---------------------------------------------------------------
{
  const RC = read("routes", "characters.js");
  const W = read("worker.py");
  check("the board RENDERS a board convert style's own graph (no fall-through to the character chain); ref2va pinned to the converted base, fl2va to its twin (2.292.0)",
    RC.includes("board: true, follow: true,")
    && RC.includes('const convName = (CONVERT_STYLES[st.style] || {}).board ? st.style : "";')
    && RC.includes("if (!upExport && !convName) {")
    && RC.includes('fl2va: "comfy_workflows/" + convFl } };'));
  check("an install converted from the one-picture export RE-CONVERTS on its next ▶ (the base remembers its export's hash in <base>.src)",
    RC.includes("function baseIsCurrent(ch) {")
    && RC.includes('fs.writeFileSync(wfPath(ch.base) + ".src", uiHash(src) + "\\n");')
    && RC.includes("if (!ch.ui || baseIsCurrent(ch)) return { ok: true };"));
  check("queueScene hands the scene to lib/nativeAudio.plan (2.292.0: anchor -> mode; the plan composes the map); 2.323.0: no song = the no-song render (no_song), not a refusal",
    RC.includes("const p = nativeAudio.plan({")
    && RC.includes("song: songPath, window: audioWin, frame: contFrame, take: contTake,")
    && RC.includes("jobPrompt = p.prompt;")
    && RC.includes("queueMode = p.mode;")
    && !RC.includes("MMH3_NativeAudio_MV locks the board's SONG into every clip")
    && RC.includes('const noSong = !!(conv && convName === "MMH3_NativeAudio_MV" && !upExport && !songPath);')
    && RC.includes("...(noSong ? { no_song: true } : {}),")
    && RC.includes("prompt: jobPrompt,"));
  check("the board song rides as a PLAIN PATH (the 2.288 {file,name} object raised in the worker's Path(x))",
    RC.includes("refAudios.push(songPath);") && !RC.includes('refAudios.push({ file: songPath'));
  check("the worker clones an extra dotted slot only behind a real LOADER (never the song's TrimAudioDuration)",
    W.includes('if str(proto.get("class_type", "")) not in LOADER_KINDS:'));
  check("the writer is told the app numbers the references (address everything by @tag)",
    read("lib", "promptGuides.json").includes("REFERENCES UNDER THIS STYLE: a Ref render carries up to nine pictures"));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
