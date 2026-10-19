#!/usr/bin/env node
/* bitGen Studio — THE MUSIC-VIDEO WRITER RULES (2.294.0).
 * Run: node scripts/test-mvwriter.js
 *
 * Tim (verbatim): "can we teach the llm how to write scenes for the music
 * video workflow. i have had 1 successful render but i had to edit the
 * scene, it put in unknown characters and is using (s1) dialog instead of
 * singing the song".
 *   1. lib/mvWriter.guide - the native contract: the song is the voice, the
 *      real cast tags only, the singing line, no chain dialogue rules; its
 *      own example passes its own checks;
 *   2. problems() names each habit Tim saw; repair() fixes them; the
 *      render-time cleanPrompt;
 *   3. the wiring: every writer path on a native board (screenplay
 *      iterative + whole-plan, the thinking add, the rewrite, the guide
 *      route, the render). The LIVE writer + render ride the e2e. */
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
const M = require("../lib/mvWriter");

const cast = [{ name: "Vera", tag: "vera" }];
const cast2 = [{ name: "Vera", tag: "vera" }, { name: "Max", tag: "max" }];
const envs = [{ name: "Rooftop", tag: "rooftop" }];

// ---- 1. the guide -------------------------------------------------------------
{
  const g = M.guide(cast2, envs, ["typo"]);
  check("the guide says the SONG is the voice and bans dialogue markup, speaker IDs, voice descriptions and lyrics as speech",
    g.includes("The SONG IS THE VOICE") && g.includes("NO DIALOGUE, EVER")
    && g.includes("never write speaker IDs") && g.includes("never describe")
    && g.includes("Never write the lyrics as spoken words"));
  check("it lists the REAL cast tags, the location and picture tags, and forbids invented people",
    g.includes("The ONLY people who exist are: @vera, @max.") && g.includes("@rooftop")
    && g.includes("@typo") && g.includes("NEVER invent a tag") && g.includes("NO other people in frame"));
  check("it gives the exact singing line and the closed-lips line with the lead's tag",
    g.includes(`"@vera ${M.SING}"`) && g.includes(`"@vera's ${M.CLOSED}"`));
  check("none of the chain's dialogue teaching rides it (no '(S1), quietly', no subject_definitions to write)",
    !g.includes("(S1), quietly") && !g.includes('MUST begin with the line') && !g.includes("<d>[English] You get one shot."));
  const ex = JSON.parse(g.slice(g.indexOf('{"shots"')));
  check("its own EXAMPLE passes its own checks (no problems)",
    M.problems(ex.shots[0], cast2, envs, ["typo"]).length === 0,
    M.problems(ex.shots[0], cast2, envs, ["typo"]));
  check("castLine maps each name to its @tag (the briefing lists names)",
    M.castLine(cast2) === "ADDRESS EVERY CAST MEMBER BY @TAG, never by name: Vera = @vera, Max = @max.");
}

// ---- 2. problems / repair / cleanPrompt -----------------------------------------------
{
  const tim = { id: "clip_01", prompt: [
    "[Shot 1] Neon rain over the overpass.", "",
    "@vera (S1), a smoky female alt-rock vocalist, sings directly to camera:",
    "<d>[English] I burned the map you drew for me.</d>", "",
    "@drummer pounds the kit behind her."] };
  const pr = M.problems(tim, cast, envs, []);
  check("problems() names the three habits Tim saw - <d> dialogue, (S1) speaker IDs, the invented @drummer - and the missing singing line",
    pr.some((x) => /<d>/.test(x)) && pr.some((x) => /\(S1\)/.test(x))
    && pr.some((x) => /@drummer/.test(x) && /ONLY cast is @vera/.test(x))
    && pr.some((x) => /no singing line/.test(x)), pr);
  const r1 = M.repair(tim, cast, envs, []);
  const t1 = r1.shot.prompt.join("\n");
  check("repair() with ONE cast member: markup out, @drummer -> @vera, the singing line added, nothing left to complain about",
    !/<\/?d>|\(S1\)|@drummer/.test(t1) && t1.includes("@vera " + M.SING)
    && M.problems(r1.shot, cast, envs, []).length === 0, { t1, ch: r1.changes });
  const r2 = M.repair(tim, cast2, envs, []);
  check("...with SEVERAL cast members the invented tag is un-tagged (never guessed onto a real person)",
    r2.shot.prompt.join("\n").includes("drummer pounds") && !r2.shot.prompt.join("\n").includes("@drummer")
    && r2.changes.some((c) => /un-tagged/.test(c)), r2);
  check("...a clean native scene is left exactly as written",
    JSON.stringify(M.repair({ prompt: ["[Shot 3] Dusk.", "", "@vera " + M.SING] }, cast, envs, []).shot.prompt)
      === JSON.stringify(["[Shot 3] Dusk.", "", "@vera " + M.SING]));
  check("a closed-lips (instrumental) scene counts as a singing decision - no problem",
    M.problems({ prompt: ["[Shot 4] Outro.", "", "@vera's " + M.CLOSED] }, cast, envs, []).length === 0);
  check("<Picture n>/<Audio n> are named as problems and stripped with their preposition",
    M.problems({ prompt: ["@vera moves to <Audio 1>.", "@vera " + M.SING] }, cast, envs, [])
      .some((x) => /<Picture n>/.test(x))
    && M.stripMarkup(["Her lips move to <Audio 1>."]).lines[0] === "Her lips move.");
  const cl = M.cleanPrompt("@vera (S1), sings to camera:\n<d>[English] la la</d>\nMaintain night.");
  check("cleanPrompt (render time): dialogue and (S1) out, the singing line in, each change named",
    !/<\/?d>|\(S1\)|la la/.test(cl.text) && cl.text.includes("@vera " + M.SING)
    && cl.changes.includes("speaker IDs (S1) removed") && cl.changes.includes("singing line added"), cl);
  check("storyOnly: the recalled chat keeps its story, loses an old plan's (S1) and <d>",
    M.storyOnly('User: a heist. "@jinx (S1), low:", "<d>[English] Go.</d>" at the pier')
      === 'User: a heist. "@jinx, low:", "" at the pier');
  check("...a clean native prompt comes back untouched with no changes",
    M.cleanPrompt("@vera walks.\n@vera " + M.SING).changes.length === 0);
}

// ---- 3. the wiring --------------------------------------------------------------------
{
  const RC = read("routes", "characters.js");
  check("screenplay: a native board gets mvWriter.guide (not screenplay.guide), no board prefix, and the music_video addendum filtered out",
    RC.includes("const native = mvWriter.isNative(scenes.load(b.project).style);")
    // 2.323.0: the board's mode (song / dialogue) rides every writer call
    && RC.includes("? mvWriter.guide(cast, envs.list(b.project), chapterRefs.tags(b.project), wMode)")
    && RC.includes('.filter((a) => a.id !== "music_video")')
    && RC.includes('? "\\n\\n" + mvWriter.castLine(cast) + "\\nPut your work in `shots`."'));
  check("screenplay (iterative): the problems ride ONE correcting retry, then the deterministic repair, said in the notes",
    RC.includes('if (pr.length && attempt === 0) { why = "native"; nativeProbs = pr; continue; }')
    && RC.includes("That scene breaks the music-video rules: ${nativeProbs.join(\"; \")}.")
    && RC.includes('for (const f of nativeFixes) notes.push("repaired " + f);'));
  check("screenplay (whole-plan path): every shot repaired on a native board",
    RC.includes("if (native && Array.isArray(plan.shots)) plan.shots = plan.shots.map((sh, k) => {"));
  check("the thinking add and the scene rewrite use the native rules (and repair) on a native board",
    RC.includes("const nativeAdd = mvWriter.isNative(st.style);")
    && RC.includes("const nativeRw = mvWriter.isNative(st.style);")
    && RC.includes('rwNotes.push("repaired for the music video: " + rp.changes.join(", "));'));
  check("the guide route shows the guide the writer ACTUALLY gets for the board",
    RC.includes("res.json({ guide: mvWriter.isNative(scenes.load(req.query.project).style)"));
  check("render time: a native scene's prompt is cleaned before the reference map, said in a note",
    // 2.356.0: + the window's lyrics (lib/sceneLyrics)
    RC.includes('const cl = mvWriter.cleanPrompt(jobPrompt, noSong ? "dialogue" : "song", cast.map((c) => chars.tagOf(c.tag || c.name)), lyr);')
    && RC.indexOf("const cl = mvWriter.cleanPrompt(jobPrompt);") < RC.indexOf("const p = nativeAudio.plan({"));
  check("the recalled chat rides a native writer through storyOnly",
    RC.includes("+ (native ? mvWriter.storyOnly(convo, wMode) : convo) : \"\") },"));
  check("the song-shape brief line no longer says 'lip-syncing that segment's lyric' on a native board",
    RC.includes("each ONE continuous clip of the performer singing that stretch"));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
