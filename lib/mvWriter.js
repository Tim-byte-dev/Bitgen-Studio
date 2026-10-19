// bitGen Studio — THE WRITER'S RULES FOR THE NATIVE-AUDIO MUSIC VIDEO
// (2.294.0).
//
// Tim (verbatim): "can we teach the llm how to write scenes for the music
// video workflow. i have had 1 successful render but i had to edit the
// scene, it put in unknown characters and is using (s1) dialog instead of
// singing the song".
//
// Why it happened: on a MMH3_NativeAudio_MV board the writer was still
// handed the CHAIN's rules - screenplay.guide teaches "@tag (S1), ...:" +
// "<d>[English] ...</d>" dialogue, the board's prompt_prefix carries
// subject definitions and (S1) voice slots, and the words "music video"
// pulled in the MMH3_Music_Video addendum whose lip-sync syntax IS
// "(S1) ... sings, <d>[English] lyric</d>" (with its example). One native
// rule sat in the middle of all that and lost.
//
// On this style the SONG is the voice: NativeAudioLock locks the scene's
// song window into the clip, so a scene is one continuous shot of the cast
// singing (or with closed lips on an instrumental stretch) - no dialogue,
// no speaker IDs, no voice descriptions, no lyrics as speech. This file is
// the whole contract, used by every writer path on such a board:
//   guide()    - the system prompt that REPLACES screenplay.guide (and the
//                music_video addendum) for the writer, the thinking add and
//                the scene rewrite;
//   problems() - what a written scene got wrong, in words the correcting
//                retry hands back to the model;
//   repair()   - the deterministic fix when the retry still gets it wrong;
//   cleanPrompt() - the render-time safety net for scenes written before
//                this (or typed by hand): markup stripped, said in a note.
const STYLE = "MMH3_NativeAudio_MV";

const SING = "sings the exact supplied vocal audio with natural, precise lip "
  + "synchronization; mouth fully visible and unobstructed, facing the camera.";
const CLOSED = "lips remain fully closed for every frame.";

function isNative(style) { return String(style || "") === STYLE; }
/* 2.323.0 (Tim: "if screenplay then there won't be a song, but i would still
   like to render with the nativeaudio workflow"): a native board WITH a
   board song is a music video ("song" - the song is the voice); WITHOUT one
   it is a screenplay ("dialogue" - the characters speak their lines and the
   native-audio model voices them from their voice references). */
function modeOf(st) { return st && st.audio ? "song" : "dialogue"; }
const SAYS_RE = /@([A-Za-z][\w-]*)\s+(?:says|asks|replies|whispers|shouts|calls|answers|sings)\b[^:]*:\s*"/i;

function tagOf(c) { return String((c && (c.tag || c.name)) || "").replace(/^@/, ""); }

/** The allowed tags: cast (can be on camera), environments, reference pictures. */
function allowed(cast, envs, refTags) {
  return {
    cast: (cast || []).map(tagOf).filter(Boolean),
    places: (envs || []).map((e) => String((e && e.tag) || "")).filter(Boolean),
    pictures: (refTags || []).map((t) => String(t).replace(/^@/, "")).filter(Boolean),
  };
}

/** Name -> @tag lines, so the model never writes a bare name. */
function castLine(cast) {
  const cs = (cast || []).filter((c) => tagOf(c));
  if (!cs.length) return "";
  return "ADDRESS EVERY CAST MEMBER BY @TAG, never by name: "
    + cs.map((c) => `${c.name || tagOf(c)} = @${tagOf(c)}`).join(", ") + ".";
}

/** The writer's system prompt for a native-audio music-video board. */
function guide(cast, envs, refTags, mode) {
  if (mode === "dialogue") return dialogueGuide(cast, envs, refTags);
  const a = allowed(cast, envs, refTags);
  const lead = a.cast[0] || "singer";
  const tags = a.cast.length ? a.cast.map((t) => "@" + t).join(", ")
    : "(no cast yet - do not invent any)";
  return [
    "You are writing the scenes of a MUSIC VIDEO for the MiniMax H3",
    "native-audio pipeline, NOT for a reader. Reply with ONE JSON object and",
    "nothing else - no prose, no code fence.",
    "",
    "SHAPE:",
    '{ "shots": [ { "id": "clip_01", "prompt": [line, ...],',
    '    "visual_context_source": "<id of the shot it continues, or omit>" } ] }',
    "",
    "HOW THIS PIPELINE WORKS - it decides everything below:",
    "- Each scene is ONE continuous clip. The app locks THIS scene's stretch",
    "  of the real song into the clip (the song's own vocal, timing and",
    "  melody). The SONG IS THE VOICE: the performer mouths the real song.",
    "- So a scene is written as PICTURE ONLY: who is on camera, where, what",
    "  they do, how the camera moves, and whether they sing.",
    "",
    "RULES:",
    "1. NO DIALOGUE, EVER. Never write <d>...</d>, never write speaker IDs",
    "   such as (S1) or (S2), never quote words as speech, never describe",
    "   a voice (\"a smoky alto vocalist\") - the song supplies the voice.",
    "   Never write the lyrics as spoken words.",
    "2. SINGING: in a sung scene the performer's line is exactly:",
    `     "@${lead} ${SING}"`,
    "   EVERY SCENE SINGS. Write the closed-lips line instead ONLY when WHAT IS",
    "   SUNG IN EACH SCENE (below) marks the scene instrumental, or the user's",
    "   brief explicitly says that part of the song has no vocal:",
    `     "@${lead}'s ${CLOSED}"`,
    "   Never decide on your own that a scene is instrumental (a guitar, a",
    "   quiet mood or an intro-like picture is NOT a reason): a closed mouth",
    "   on a sung stretch renders with NO lip sync.",
    "3. CAST ONLY. The ONLY people who exist are: " + tags + ".",
    "   Refer to them ONLY by @tag, spelled exactly. NEVER invent a tag",
    "   (@drummer, @singer, @band ...) - an unknown tag renders as a stranger",
    "   and the scene fails. NO other people in frame: no band members,",
    "   dancers, crowds, fans or passers-by unless they are in the cast list.",
    ...(a.places.length ? [
    "4. PLACES: these locations have reference pictures - use their tags and",
    "   the SAME wording every time: " + a.places.map((t) => "@" + t).join(", ") + "."]
      : ["4. PLACES: describe each location concretely (period, weather,",
         "   light, one telling detail) and use the SAME words every time the",
         "   video returns there."]),
    ...(a.pictures.length ? [
    "5. REFERENCE PICTURES you may name inside a line (props, outfits,",
    "   styles): " + a.pictures.map((t) => "@" + t).join(", ") + ". No other picture tags exist."]
      : ["5. There are no reference-picture tags - do not invent any."]),
    "6. PROMPT LINES - a LIST of short lines with an empty string \"\" between",
    "   beats, in this order:",
    '   a. "[Shot N] " + the establishing beat: place, light, time of day;',
    "   b. the action and ONE continuous camera move (no cuts inside a scene);",
    "   c. the singing line (rule 2) or the closed-lips line;",
    '   d. "Maintain <palette, lighting, time of day, wardrobe>.";',
    '   e. "No <what must not happen: extra people, costume change, text,',
    '      cuts>."',
    "7. CONTINUITY: set visual_context_source to the previous shot's id",
    "   whenever this scene carries on from it; the user's anchor radio then",
    "   decides whether it starts on that shot's frame (First - or Cont,",
    "   which also keeps the cast from their sheets), travels to the new",
    "   place (Trans) or re-establishes it (Ref). Omit it only for a",
    "   hard cut. Keep wardrobe, hair and light consistent between scenes.",
    "8. Never write <Picture n>, <Audio n>, <Subject n>, subject definitions",
    "   or voice assignments - the app numbers the references itself.",
    "9. Do not write length, seed or any other field - the song sets the",
    "   length of every scene.",
    "10. Describe what the CAMERA sees, like a shooting script: short,",
    "   active, present tense, concrete props and light. No inner thoughts.",
    "",
    "EXAMPLE of one sung scene (the shape, not the story):",
    JSON.stringify({ shots: [{ id: "clip_02", visual_context_source: "clip_01", prompt: [
      "[Shot 2] A rain-soaked rooftop at night, neon signs bleeding red and blue across the puddles.",
      "",
      `@${lead} walks slowly toward the lens along the parapet as the camera pulls back at the same pace.`,
      "",
      `@${lead} ${SING}`,
      "",
      "Maintain the red and blue neon palette, night, the wardrobe from the reference sheet.",
      "No other people, no costume change, no on-screen text, no cuts."] }] }),
  ].join("\n");
}

/** 2.323.0: the screenplay contract for a native board with NO song. */
function dialogueGuide(cast, envs, refTags) {
  const a = allowed(cast, envs, refTags);
  const lead = a.cast[0] || "hero";
  const other = a.cast[1] || lead;
  const tags = a.cast.length ? a.cast.map((t) => "@" + t).join(", ")
    : "(no cast yet - do not invent any)";
  return [
    "You are writing the scenes of a FILM for the MiniMax H3 native-audio",
    "pipeline, NOT for a reader. Reply with ONE JSON object and nothing else -",
    "no prose, no code fence.",
    "",
    "SHAPE:",
    '{ "shots": [ { "id": "clip_01", "seconds": 8, "prompt": [line, ...],',
    '    "visual_context_source": "<id of the shot it continues, or omit>" } ] }',
    "",
    "HOW THIS PIPELINE WORKS - it decides everything below:",
    "- Each scene is ONE continuous clip of 3 to 15 seconds (\"seconds\").",
    "  The model makes the SOUND itself: the characters speak their lines in",
    "  their OWN voices (the app hands the model each character's voice),",
    "  plus footsteps, rain, traffic - whatever the scene describes.",
    "",
    "RULES:",
    // 2.363.0 (Tim: "make the character speak with expression and emotion using the reference audio but not
    // saying the words in the reference audio"): every line carries its emotion; voices are timbre only
    ...require("./voiceStyle").writerRule(lead, other),
    "2. SOUND: say the sound that matters in plain words (\"rain drums on",
    "   the tin roof\", \"distant sirens\"). No music unless the story needs it.",
    "3. CAST ONLY. The ONLY people who exist are: " + tags + ".",
    "   Refer to them ONLY by @tag, spelled exactly. NEVER invent a tag -",
    "   an unknown tag renders as a stranger. No extras unless the brief asks.",
    ...(a.places.length ? [
    "4. PLACES: these locations have reference pictures - use their tags and",
    "   the SAME wording every time: " + a.places.map((t) => "@" + t).join(", ") + "."]
      : ["4. PLACES: describe each location concretely (period, weather,",
         "   light, one telling detail) and use the SAME words every time the",
         "   story returns there."]),
    ...(a.pictures.length ? [
    "5. REFERENCE PICTURES you may name inside a line (props, outfits,",
    "   styles): " + a.pictures.map((t) => "@" + t).join(", ") + ". No other picture tags exist."]
      : ["5. There are no reference-picture tags - do not invent any."]),
    "6. PROMPT LINES - a LIST of short lines with an empty string \"\" between",
    "   beats, in this order:",
    '   a. "[Shot N] " + the establishing beat: place, light, time of day;',
    "   b. the action and ONE continuous camera move (no cuts inside a scene);",
    "   c. the dialogue lines (rule 1) and the sound (rule 2);",
    '   d. "Maintain <palette, lighting, time of day, wardrobe>.";',
    '   e. "No <what must not happen: extra people, costume change, text,',
    '      cuts>."',
    "7. CONTINUITY: set visual_context_source to the previous shot's id",
    "   whenever this scene carries on from it; the user's anchor radio then",
    "   decides whether it starts on that shot's frame (First / Cont), travels",
    "   to a new place (Trans) or re-establishes it (Ref). Keep wardrobe, hair",
    "   and light consistent between scenes.",
    "8. Never write <Picture n>, <Audio n>, <Subject n>, subject definitions",
    "   or voice assignments - the app numbers the references and binds each",
    "   character to their voice itself.",
    "9. \"seconds\": how long the scene runs (3-15) - long enough for its lines.",
    "10. Describe what the CAMERA sees and HEARS, like a shooting script:",
    "   short, active, present tense. No inner thoughts.",
    "",
    "EXAMPLE of one scene (the shape, not the story):",
    JSON.stringify({ shots: [{ id: "clip_02", seconds: 8, visual_context_source: "clip_01", prompt: [
      "[Shot 2] A rain-soaked bus shelter at night, one flickering tube light, puddles on the kerb.",
      "",
      `@${lead} steps in out of the rain as the camera pushes in slowly from across the street.`,
      "",
      `@${lead} shakes the rain from her sleeves; her voice catches as she sees the ticket in his hand.`,
      `@${lead} says, quietly, voice catching: "You kept the ticket."`,
      `@${other} replies with a tired half-smile, warm and a little embarrassed: "I kept all of them."`,
      "Rain drums on the plastic roof; a bus hisses past.",
      "",
      "Maintain the cold blue night palette, the wardrobe from the reference sheet.",
      "No other people, no costume change, no on-screen text, no cuts."] }] }),
  ].join("\n");
}

const TAG_RE = /(^|[^\w@<])@([A-Za-z][\w-]*)/g;

function unknownTags(text, a) {
  const ok = new Set([...a.cast, ...a.places, ...a.pictures].map((t) => t.toLowerCase()));
  const out = [];
  String(text || "").replace(TAG_RE, (m, pre, t) => {
    if (!ok.has(t.toLowerCase()) && !out.includes(t)) out.push(t);
    return m;
  });
  return out;
}

/** What a written scene got wrong for this style ([] = nothing). */
function problems(shot, cast, envs, refTags, mode) {
  const text = ((shot && shot.prompt) || []).map(String).join("\n");
  const a = allowed(cast, envs, refTags);
  const out = [];
  const dlg = mode === "dialogue";
  if (/<\/?d>/i.test(text)) out.push(dlg ? "it writes dialogue markup <d>...</d> - write "
    + "@tag says: \"...\" instead" : "it writes dialogue markup <d>...</d> - "
    + "the song is the voice, so there is no dialogue at all");
  if (/\(S\d+\)/i.test(text)) out.push(dlg ? "it writes speaker IDs like (S1) - name the "
    + "speaker by @tag" : "it writes speaker IDs like (S1) - "
    + "there are no speakers, only the performer singing the song");
  const unk = unknownTags(text, a);
  if (unk.length) out.push("it uses tags that do not exist: "
    + unk.map((t) => "@" + t).join(", ") + " - the ONLY cast is "
    + (a.cast.map((t) => "@" + t).join(", ") || "none"));
  if (/<(Picture|Audio|Subject)\s*\d+>/i.test(text)) out.push("it writes "
    + "<Picture n>/<Audio n>/<Subject n> numbers - address everything by @tag");
  if (dlg) return out;
  if (!/lip\s*synchroni[sz]ation|lips? remain (fully |completely )?closed/i.test(text))
    out.push("it has no singing line - write \"@tag " + SING + "\" (or the "
      + "closed-lips line on an instrumental stretch)");
  return out;
}

/** Strip the chain's dialogue markup from prompt text (lines kept). */
function stripMarkup(lines) {
  const changes = new Set();
  const out = [];
  for (let l of (lines || []).map(String)) {
    const before = l;
    if (/^\s*<d>.*<\/d>\s*$/i.test(l)) { changes.add("dialogue <d> lines removed"); continue; }
    l = l.replace(/,?\s*<d>[\s\S]*?<\/d>/gi, () => { changes.add("dialogue <d> markup removed"); return ""; });
    l = l.replace(/<\/?d>/gi, () => { changes.add("dialogue <d> markup removed"); return ""; });
    l = l.replace(/\s*\(S\d+\)/gi, () => { changes.add("speaker IDs (S1) removed"); return ""; });
    l = l.replace(/\s*(?:\b(?:to|with|from|by|in|as|of)\s+)?<(Picture|Audio|Subject)\s*\d+>/gi, () => {
      changes.add("<Picture n>/<Audio n> numbers removed"); return ""; });
    if (l !== before) l = l.replace(/\s*[:,]\s*$/, ".").replace(/\s{2,}/g, " ").replace(/\.\.$/, ".");
    out.push(l);
  }
  // collapse the blank runs a removed line leaves
  const tidy = out.filter((l, i) => !(l.trim() === "" && (i === 0 || out[i - 1].trim() === "")));
  while (tidy.length && tidy[tidy.length - 1].trim() === "") tidy.pop();
  return { lines: tidy, changes: [...changes] };
}

/** The deterministic fix: markup out, unknown tags mapped (one cast member)
 *  or un-tagged (several), a singing line added when none. */
/** 2.323.0: the chain's dialogue markup -> spoken lines (dialogue mode):
 *  "(S1) <d>hi</d>" -> "@<cast[0]> says: \"hi\"". */
function speakMarkup(lines, castTags) {
  const changes = new Set();
  const out = (lines || []).map(String).map((l) => {
    const before = l;
    l = l.replace(/\(S(\d+)\)\s*(?:says|:)?\s*<d>([\s\S]*?)<\/d>/gi, (m, n, words) => {
      const who = castTags[parseInt(n, 10) - 1] || castTags[0] || "";
      changes.add("chain dialogue (S1) <d> -> @tag says: \"...\"");
      return who ? `@${who} says: "${words.trim()}"` : `"${words.trim()}"`;
    });
    l = l.replace(/<d>([\s\S]*?)<\/d>/gi, (m, words) => { changes.add("<d> markup -> quoted speech"); return `"${words.trim()}"`; });
    l = l.replace(/\s*\(S\d+\)/gi, () => { changes.add("speaker IDs (S1) removed"); return ""; });
    l = l.replace(/\s*(?:\b(?:to|with|from|by|in|as|of)\s+)?<(Picture|Audio|Subject)\s*\d+>/gi, () => {
      changes.add("<Picture n>/<Audio n> numbers removed"); return ""; });
    return l === before ? l : l.replace(/\s{2,}/g, " ");
  });
  return { lines: out, changes: [...changes] };
}

function repair(shot, cast, envs, refTags, mode) {
  const a = allowed(cast, envs, refTags);
  const s = { ...(shot || {}) };
  if (mode === "dialogue") {
    // 2.323.0: the scene's length comes from its "seconds" (3-15)
    const sec = Number(s.seconds);
    const changes0 = [];
    if (Number.isFinite(sec) && sec > 0) {
      s.length = Math.round(Math.max(3, Math.min(15, sec)) * 24) + 1;
      changes0.push(`length ${Math.max(3, Math.min(15, sec))}s`);
    }
    const sp = speakMarkup(s.prompt || [], a.cast);
    let lines = sp.lines;
    const changes = changes0.concat(sp.changes);
    const unk = unknownTags(lines.join("\n"), a);
    if (unk.length) {
      const bad = new Set(unk.map((t) => t.toLowerCase()));
      lines = lines.map((l) => l.replace(TAG_RE, (m, pre, t) => {
        if (!bad.has(t.toLowerCase())) return m;
        return a.cast.length === 1 ? pre + "@" + a.cast[0] : pre + t.replace(/[_-]/g, " ");
      }));
      changes.push(a.cast.length === 1
        ? `unknown ${unk.map((t) => "@" + t).join(", ")} -> @${a.cast[0]} (the only cast member)`
        : `unknown ${unk.map((t) => "@" + t).join(", ")} un-tagged (not in the cast)`);
    }
    s.prompt = lines;
    return { shot: s, changes };
  }
  const st = stripMarkup(s.prompt || []);
  const changes = st.changes.slice();
  let lines = st.lines;
  const unk = unknownTags(lines.join("\n"), a);
  if (unk.length) {
    const bad = new Set(unk.map((t) => t.toLowerCase()));
    lines = lines.map((l) => l.replace(TAG_RE, (m, pre, t) => {
      if (!bad.has(t.toLowerCase())) return m;
      return a.cast.length === 1 ? pre + "@" + a.cast[0] : pre + t.replace(/[_-]/g, " ");
    }));
    changes.push(a.cast.length === 1
      ? `unknown ${unk.map((t) => "@" + t).join(", ")} -> @${a.cast[0]} (the only cast member)`
      : `unknown ${unk.map((t) => "@" + t).join(", ")} un-tagged (not in the cast)`);
  }
  if (!/lip\s*synchroni[sz]ation|lips? remain (fully |completely )?closed/i.test(lines.join("\n"))) {
    const who = (lines.join(" ").match(/@([A-Za-z][\w-]*)/) || [])[1]
      || a.cast[0] || "";
    if (who) { lines = lines.concat(["", `@${who} ${SING}`]); changes.push("singing line added"); }
  }
  s.prompt = lines;
  return { shot: s, changes };
}

const CLOSED_RE = /lips?\s+(?:remain|stay|are|kept|keep)\s+(?:fully |completely |firmly |tightly )?(?:closed|shut|sealed)/i;
const SING_RE = /lip\s*synchroni[sz]ation/i;
const WORDS_RE = /^\s*The words sung in this clip:/i;

/** Render-time safety net: the prompt text a native render sends -
 *  the chain's markup stripped and, when the scene never says it sings
 *  (or keeps its lips closed), the singing line added for its first @tag.
 *  2.356.0 (Tim: "@jesse_paul's lips remain fully closed for every frame ... no words for lip sync, so my vid
 *  doesn't have lip sync"): lyr = lib/sceneLyrics.forWindow() - with the song's timed transcript the
 *  WINDOW decides: words in it -> a closed-lips line becomes the singing line and the words are written
 *  in ("The words sung in this clip: ..."); no words -> a singing line becomes the closed-lips line.
 *  Without a transcript a closed-lips line stays and the change list says it renders without lip sync. */
function cleanPrompt(text, mode, castTags, lyr) {
  if (mode === "dialogue") {                 // 2.323.0: speech stays, markup -> spoken lines
    const sp = speakMarkup(String(text || "").split("\n"), castTags || []);
    return { text: sp.lines.join("\n"), changes: sp.changes };
  }
  const st = stripMarkup(String(text || "").split("\n"));
  let lines = st.lines;
  const changes = st.changes.slice();
  const firstTag = () => (lines.join(" ").match(/@([A-Za-z][\w-]*)/) || [])[1] || (castTags || [])[0] || "";
  const tagIn = (l) => (String(l).match(/@([A-Za-z][\w-]*)/) || [])[1] || firstTag();
  const L = lyr || {};
  if (L.known && L.words) {
    // a sung stretch: every closed-lips line sings, and the words ride along for the lips
    let swapped = false;
    lines = lines.map((l) => (CLOSED_RE.test(l) && !SING_RE.test(l) ? (swapped = true, `@${tagIn(l)} ${SING}`) : l));
    if (swapped) changes.push("closed lips -> singing (this stretch of the song has words)");
    if (!SING_RE.test(lines.join("\n")) && firstTag()) { lines = lines.concat(["", `@${firstTag()} ${SING}`]); changes.push("singing line added"); }
    lines = lines.filter((l) => !WORDS_RE.test(l));
    const at = lines.findIndex((l) => SING_RE.test(l));
    // 2.377.1 (Tim: "is the video rendering the kareoke on the main video as well? i am getting a bluish bar at the
    // bottom of the video"): quoted words in a video prompt can make the model PAINT them - a subtitle strip at the
    // bottom of the frame. The words are for the lips; the line now says they are heard, never shown.
    lines.splice(at + 1, 0, `The words sung in this clip: "${String(L.words).replace(/"/g, "'").slice(0, 400)}" `
      + "(heard in the song only, for the lip sync - never shown on screen: no subtitles, no captions, no lyrics text, "
      + "no text bar at the bottom of the picture).");
    changes.push("the sung words added for the lip sync");
    return { text: lines.join("\n"), changes };
  }
  if (L.known && !L.words) {
    // an instrumental stretch: nobody sings
    let swapped = false;
    lines = lines.filter((l) => !WORDS_RE.test(l))
      .map((l) => (SING_RE.test(l) && !CLOSED_RE.test(l) ? (swapped = true, `@${tagIn(l)}'s ${CLOSED}`) : l));
    if (swapped) changes.push("singing -> closed lips (no words in this stretch of the song)");
    return { text: lines.join("\n"), changes };
  }
  if (!SING_RE.test(lines.join("\n")) && !CLOSED_RE.test(lines.join("\n"))) {
    const who = firstTag();
    if (who) { lines = lines.concat(["", `@${who} ${SING}`]); changes.push("singing line added"); }
  } else if (CLOSED_RE.test(lines.join("\n")) && !SING_RE.test(lines.join("\n"))) {
    changes.push("NOTE: the scene keeps its lips closed - it renders WITHOUT lip sync (the song has no timed "
      + "transcript to check this stretch against: transcribe its lyrics, or write the singing line)");
  }
  return { text: lines.join("\n"), changes };
}

/** The recalled chat rides the writer for its STORY - an earlier chain
 *  plan in it would teach (S1)/<d> by example, so on a native board its
 *  dialogue markup and speaker IDs are taken out first. */
function storyOnly(text, mode) {
  if (mode === "dialogue") return String(text || "");       // 2.323.0: the lines ARE the story
  return String(text || "")
    .replace(/<d>[\s\S]*?<\/d>/gi, "")
    .replace(/\s*\(S\d+\)/gi, "");
}

/* 2.299.0 (Tim: "llm should read global prompt before generating scenes
   for videos or music videos"): the board's global prompt rides the
   music-video writer too - it used to be left out whole (2.294.0), because
   the chain's version carries (S1) voice slots and dialogue rules. Now the
   writer READS it, first: the subject definitions, the locations, the
   reference pictures and the user's own notes stay; the voice-slot
   paragraph, the dialogue lines and any <d>/(S1) markup are taken out -
   on this board the song is the only voice. "" when the prompt is empty. */
function globalNote(prefix, mode) {
  const keep = [];
  let skipPara = false;
  for (const raw of (prefix || []).map(String)) {
    if (!raw.trim()) { skipPara = false; keep.push(""); continue; }
    if (/^\s*voice_assignments:/i.test(raw)) { skipPara = true; continue; }
    if (skipPara) continue;
    if (mode !== "dialogue" && /\bdialogue\b|speaker identit/i.test(raw)) continue;
    keep.push(storyOnly(raw));
  }
  const text = keep.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return "";
  return "\n\nTHE GLOBAL PROMPT - READ IT BEFORE YOU WRITE (the user's standing "
    + "direction for EVERY scene: keep its characters' looks, its locations "
    + "(@tags), its reference pictures and its notes; " + (mode === "dialogue"
      ? "its voice slots do not apply - the app binds each character to their own voice):\n"
      : "its voice slots and dialogue do not apply here - the song is the only voice):\n")
    + text.slice(0, 4000);
}

/** The guide the writer gets for this board (its mode from the board song). */
function guideFor(st, cast, envs, refTags) { return guide(cast, envs, refTags, modeOf(st)); }

module.exports = { guideFor, globalNote, storyOnly, STYLE, SING, CLOSED, CLOSED_RE, SING_RE, isNative, allowed, castLine, guide,
                   problems, repair, cleanPrompt, stripMarkup,
                   modeOf, dialogueGuide, speakMarkup, SAYS_RE };   // 2.323.0
