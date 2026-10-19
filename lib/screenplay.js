// bitGen Studio — teaching the LLM to write for the MM3_Characters pipeline.
//
// The workflow does not take a screenplay. It takes MiniMaxH3ChainPlan's
// `plan_json`, which has its own grammar, and a model that writes beautiful
// prose in the wrong shape produces nothing at all. So this file does three
// things:
//
//   1. GUIDE      - the rules, written out for the model, with the defaults
//                   READ FROM Tim's own working export rather than retyped, so
//                   they cannot drift away from the file that actually renders.
//   2. validate() - checks what came back BEFORE it reaches ComfyUI. The
//                   failure that matters most: a model that invents @characters
//                   nobody has a reference sheet for. Those render as strangers,
//                   which looks exactly like the character-drift bug and is not.
//   3. writePlan()- puts an accepted plan into the graph.
//
// The grammar, from the export:
//   plan_json = { prompt_prefix: [line, ...], shots: [shot, ...] }
//   prompt_prefix starts "subject_definitions:", then one @tag paragraph per
//   character, then global direction (continuity, camera, environment, audio).
//   A shot's `prompt` is a LIST OF LINES with "" between every beat.
//   Dialogue is:  @tag (S1), <manner>:      then      <d>[English] line</d>
const fs = require("fs");
const path = require("path");

const PLAN_NODE = "MiniMaxH3ChainPlan";
const FPS = 24;

/** Shot settings taken from the shipped export, so ours match what renders. */
function exportDefaults(file) {
  const fallback = { steps: 25, length: 158, continuation_mode: "guide",
                     context_length: 22, audio_context_length: 22,
                     video_blend_frames: 0, source_reference: "off",
                     generated_continuity: "on" };
  try {
    const g = JSON.parse(fs.readFileSync(file, "utf8"));
    const node = Object.values(g).find((n) => n && n.class_type === PLAN_NODE);
    const plan = JSON.parse(node.inputs.plan_json);
    // Merge across ALL shots, first definition wins, then fill from `fallback`.
    // Reading only the last shot looked tidier and was wrong: later shots omit
    // the settings they inherit, so half the defaults came back undefined and
    // vanished when the plan was serialised.
    const out = { ...fallback };
    for (const key of Object.keys(fallback)) {
      const hit = (plan.shots || []).find((s) => s && s[key] !== undefined);
      if (hit) out[key] = hit[key];
    }
    return out;
  } catch { return fallback; }
}

const DEFAULTS = exportDefaults(
  path.join(__dirname, "..", "comfy_workflows", "MM3_Characters.json"));

/**
 * What the model is told. `characters` are the real cast, so the @tags it is
 * allowed to use are named explicitly rather than left to invention.
 */
function guide(characters = [], environments = []) {
  const cast = assignSlots(characters);
  const tags = cast.map((c) => "@" + (c.tag || c.name)).join(", ");
  const slots = cast.map((c) => `@${c.tag || c.name} = (${c.slot})`).join(", ");
  // 2.226.0: characters with an extracted identity mod (2.225.0) — the
  // writer is told the renderer owns their look, so scenes reference them
  // by @tag and never redescribe what the mod anchors
  const modded = cast.filter((c) => c.refmod)
    .map((c) => "@" + (c.tag || c.name) + " (mod " + c.refmod + ")");
  // 2.142.0: locations with a 360 reference. The model is told which tags
  // exist and which scenes they cover, so it writes the SAME location wording
  // for every scene in a range — the reference image does the visual half of
  // continuity, the wording does the rest.
  const envLines = (environments || []).filter((e) => e && e.name).map((e) =>
    `- @${e.tag}: a real referenced location (scenes ${e.scenes || "all"}); `
    + "keep its wording identical in every shot set there").join("\n");
  return [
    ...(envLines ? ["ENVIRONMENTS with visual references on the chain:",
                    envLines, ""] : []),
    "You are writing for a MiniMax H3 chained-video pipeline, NOT for a reader.",
    "Reply with ONE JSON object and nothing else - no prose, no code fence.",
    "",
    "SHAPE:",
    '{ "prompt_prefix": [string, ...], "shots": [shot, ...] }',
    "",
    "prompt_prefix is the standing direction, one array element per line, with",
    'an empty string "" between paragraphs. It MUST begin with the line',
    '"subject_definitions:" followed by one paragraph per character that says',
    "the character is defined by the provided reference sheet and that their",
    "face, hair, body and wardrobe must not be redesigned. After the character",
    "paragraphs, give standing direction: continuity between scenes, camera",
    "language, grounded character animation, the environment, the atmosphere,",
    "dialogue synchronisation, ambient audio, and that the story escalates.",
    "",
    "A shot is:",
    '{ "id": "clip_01", "prompt": [line, ...], "length": ' + DEFAULTS.length + ",",
    '  "steps": ' + DEFAULTS.steps + ', "seed": "<digits as a STRING>",',
    '  "continuation_mode": "' + DEFAULTS.continuation_mode + '",',
    '  "context_length": ' + DEFAULTS.context_length + ', "audio_context_length": '
      + DEFAULTS.audio_context_length + ",",
    '  "video_blend_frames": ' + DEFAULTS.video_blend_frames
      + ', "source_reference": "' + DEFAULTS.source_reference + '",',
    '  "generated_continuity": "' + DEFAULTS.generated_continuity + '",',
    '  "visual_context_source": "<id of the previous shot, omit on the first>" }',
    "",
    "PROMPT RULES, and these are what the pipeline actually depends on:",
    "1. `prompt` is a LIST OF LINES with an empty string \"\" between EVERY beat.",
    "   One action, one camera move or one line of dialogue per beat.",
    '2. Open the first shot with "[Shot 1] " as a PREFIX on its first action',
    '   line — "[Shot 1] @jinx kicks the door in." — NEVER "[Shot 1]" alone:',
    "   a marker with no action renders an empty scene.",
    "2b. WRITE ONE CONTINUOUS STORY, not twelve fragments: a beginning that",
    "   establishes, a middle that escalates, an ending that lands. Every shot",
    "   PICKS UP where the previous one left off — same place unless the story",
    "   moves, same wardrobe, same light; name the location with the same words",
    "   every time it appears. When the action continues in the same place, set",
    '   "visual_context_source" to the previous shot\'s id so the pipeline',
    "   carries the picture over. A viewer who missed nothing must never ask",
    "   how the characters got here.",
    "3. Refer to a character ONLY by their @tag. The tags that exist are: "
      + (tags || "(no characters yet - do not invent any)") + ".",
    "   NEVER invent a tag. A tag with no reference sheet renders as a stranger.",
    "   Do not invent characters, only use characters that exist. That covers",
    "   EVERYONE who acts, speaks or is described - no new named people, no",
    "   unnamed extras, guards, waiters or passers-by. If the story needs a",
    "   presence beyond the cast, it stays off-screen: a voice from another",
    "   room, a shadow, a knock - never a person in frame.",
    ...(modded.length ? [
    "   These characters carry an extracted IDENTITY MOD, so the renderer",
    "   already knows their exact look: " + modded.join(", ") + ". Reference",
    "   them by @tag in every scene where they appear or their identity is",
    "   needed; keep their wording identical between scenes and NEVER",
    "   redescribe their face, hair or body - the mod owns those."] : []),
    "   Three kinds of tag exist and only the FIRST can act or speak:",
    "   characters (listed above), environments (locations), and",
    "   reference PICTURES (listed under REFERENCE IMAGES when present) -",
    "   a picture tag steers appearance inside a prompt line, nothing more.",
    "4. Dialogue is two beats. First the speaker line, ENDING WITH A COLON:",
    '     "@tag (S1), quietly and seriously:"',
    "   then, as the NEXT line, the spoken words wrapped exactly:",
    '     "<d>[English] You get one shot.</d>"',
    "   NEVER put the <d>...</d> on the speaker line itself, and never leave",
    "   the words after the colon unwrapped or in quotation marks.",
    "   A non-verbal sound — a snort, a gasp, a hitched breath — is a plain",
    '   beat with NO colon and no <d> line: "@tag (S1), a low snort of',
    '   derision." The colon is a promise that spoken words follow.',
    "   The speaker slots are ASSIGNED, not yours to choose: "
      + (slots || "(no cast yet)") + ".",
    "   Use each character's own slot every time they speak. A character whose",
    "   slot moves between scenes swaps voices.",
    "5. Do NOT write prompt_prefix character paragraphs yourself - the subject",
    "   definitions and voice assignments are generated from the character",
    "   profiles and will be supplied. Write the shots.",
    "6. Describe what the CAMERA sees. No inner thoughts, no novelistic prose.",
    "6b. WRITE LIKE A SHOOTING SCRIPT — dense, concrete, specific (2.168.0):",
    "   - ACTION in short, active, present-tense sentences, one movement each.",
    "     Hands DO things: a character does not \"prepare\" — they unclasp the",
    "     case, lift the lid, set each instrument down in a row.",
    "   - PROPS are named things, never categories: not \"a car\" but \"a",
    "     mud-spattered 1940s staff car, one headlamp cracked\"; not \"papers\"",
    "     but \"a carbon-copied typed report, corners soft from handling\".",
    "   - LOCATIONS get an establishing beat with period, weather, light and",
    "     one telling detail: \"a corrugated-iron workshop at dawn, frost on",
    "     the window rims, a single work lamp burning over the bench\" — and",
    "     the SAME wording every time the story returns there.",
    "   - Prefer sensory specifics the camera and microphone can capture:",
    "     textures, reflections, steam, dust in the light, the sound a thing",
    "     makes when it is set down.",
    "   - Ban vague words: somehow, beautiful, nice, very, suddenly. If a",
    "     detail cannot be photographed, cut it.",
    "7. length is in frames at " + FPS + " fps, so " + DEFAULTS.length
      + " frames is about " + (DEFAULTS.length / FPS).toFixed(1) + "s. "
      + "Valid lengths are 5..3592 with length % 17 == 5 (141, 158, 243, "
      + "362, ...); other values are snapped to the nearest valid one. "
      + "EVERY scene shares ONE duration (the app's default) - do not vary "
      + "length per scene; any length you write is replaced by the default.",
    "7b. context_length and audio_context_length must be 0 or one of 1, 5,",
    "   22, 39, 56, ... 243 (17k+5, capped at 243); any other value is",
    "   snapped to the nearest valid one. When unsure, keep the defaults.",
    "8. Every shot after the first sets visual_context_source to the id of the",
    "   one before, so the pipeline carries state forward. source_reference is",
    "   an on/off/inherit SWITCH, never a shot id - continuity between shots",
    "   goes in visual_context_source ONLY.",
    "9. End a shot on a clean beat - a cut, a door closing, a look.",
    "10. A prompt line may steer identity to one specific sheet with",
    "    <Picture N> (e.g. \"@joan's outfit as in <Picture 2>\"). Pictures are",
    "    numbered in cast order - each character's sheets in their listed",
    "    order, then the environment views.",
  ].join("\n");
}

// ---- subject definitions and voice slots ---------------------------------
// The export writes each character as one paragraph under "subject_definitions:"
// - who they are, what to preserve, what not to redesign - and gives each a
// speaker slot (S1)/(S2) used consistently. Both are generated here from the
// profiles rather than left to the model, because both are FACTS about the cast
// and a model asked to invent them will quietly change them between scenes.

const PRONOUNS = {
  "he": ["he", "him", "his"], "he/him": ["he", "him", "his"],
  "she": ["she", "her", "her"], "she/her": ["she", "her", "her"],
  "they": ["they", "them", "their"], "they/them": ["they", "them", "their"],
};
function pro(c) { return PRONOUNS[String(c.pronouns || "they").toLowerCase()] || PRONOUNS.they; }

/**
 * Assign each character a speaker slot, keeping any already recorded.
 * The slot is what binds a voice to a character, so it must not move: the
 * profile's own `slot` wins, and only characters without one are given the
 * next free number, in cast order.
 */
function assignSlots(characters = []) {
  const used = new Set();
  for (const c of characters) {
    const m = /^S?(\d+)$/.exec(String(c.slot || ""));
    if (m) used.add(Number(m[1]));
  }
  let next = 1;
  return characters.map((c) => {
    const m = /^S?(\d+)$/.exec(String(c.slot || ""));
    if (m) return { ...c, slot: `S${m[1]}` };
    while (used.has(next)) next++;
    used.add(next);
    return { ...c, slot: `S${next}` };
  });
}

/** One character's paragraph, in the export's wording. */
function subjectDefinition(c) {
  const [, obj, poss] = pro(c);
  const tag = "@" + (c.tag || c.name);
  // TYPE-AWARE FACTS (2.166.0): the detailed sheet only matters if the
  // PREFIX says it — an animal leads with breed and color, a vehicle with
  // year/color/model, a person with the human measurements; identity
  // preservation is phrased per type (a sedan has no bone structure).
  const type = ["animal", "vehicle", "clothing"].includes(c.type) ? c.type : "person";
  const kind = c.subtype || type;   // "sports car", "dog" — the subtype IS the kind
  if (type === "vehicle") {
    const desc = [c.year, c.color, c.model].filter(Boolean).join(" ");
    const bits = [
      `${tag} is the ${kind} defined by the provided reference sheet`
        + (desc ? ` — a ${desc}` : "") + `.`,
      ` Preserve its exact body shape, paintwork, markings, trim and`
        + ` recognizable appearance; do not redesign or restyle it.`,
      c.notes ? ` Distinguishing features: ${c.notes.trim().replace(/\.?$/, "")}.` : "",
    ];
    return bits.join("").replace(/\s+/g, " ").trim();
  }
  if (type === "animal") {
    const desc = [c.color, c.breed || c.subtype].filter(Boolean).join(" ");
    const facts = [c.age && `age ${c.age}`, c.height && `height ${c.height}`,
                   c.weight && `weight ${c.weight}`].filter(Boolean).join(", ");
    const bits = [
      `${tag} is the ${kind} defined by the provided reference sheet`
        + (desc ? ` — a ${desc}` : "") + `.`,
      facts ? ` ${c.name} is ${facts}.` : "",
      ` Preserve ${poss} coat, markings, build and recognizable appearance`
        + ` exactly; do not redesign ${obj}.`,
      c.notes ? ` Distinguishing features: ${c.notes.trim().replace(/\.?$/, "")}.` : "",
    ];
    return bits.join("").replace(/\s+/g, " ").trim();
  }
  if (type === "clothing") {
    const desc = [c.color, c.subtype].filter(Boolean).join(" ");
    const bits = [
      `${tag} is the garment defined by the provided reference sheet`
        + (desc ? ` — a ${desc}` : "") + `.`,
      ` Preserve its exact cut, fabric, pattern, stitching and details;`
        + ` do not redesign or restyle it, on any wearer.`,
      c.notes ? ` Distinguishing features: ${c.notes.trim().replace(/\.?$/, "")}.` : "",
    ];
    return bits.join("").replace(/\s+/g, " ").trim();
  }
  const facts = [c.age && `age ${c.age}`, c.height && `height ${c.height}`,
                 c.weight && `weight ${c.weight}`].filter(Boolean).join(", ");
  const bits = [
    `${tag} is the character defined by the provided character reference sheet.`,
    facts ? ` ${c.name} is ${facts}.` : "",
    ` Preserve ${poss} facial identity, bone structure, hair, skin tone, body`
      + ` proportions and recognizable appearance exactly.`,
    c.notes ? ` Distinguishing features: ${c.notes.trim().replace(/\.?$/, "")}.` : "",
    c.wardrobe
      ? ` ${poss[0].toUpperCase()}${poss.slice(1)} wardrobe remains ${c.wardrobe.replace(/\.?$/, "")},`
        + ` as defined by the reference.`
      : ` ${poss[0].toUpperCase()}${poss.slice(1)} wardrobe remains the one defined by the reference.`,
    ` Do not redesign ${poss} face, hairstyle, body or clothing.`,
  ];
  return bits.join("").replace(/\s+/g, " ").trim();
}

/** The voice-assignment paragraph: which slot each character speaks in. */
function voiceAssignments(characters = []) {
  const withSlots = assignSlots(characters);
  if (!withSlots.length) return "";
  return "voice_assignments: "
    + withSlots.map((c) => `@${c.tag || c.name} speaks in (${c.slot})`
        + ((c.voices || []).length ? " using the provided voice reference (its timbre only - never its words)" : ""))
        .join(". ") + "."
    + " Only the character explicitly assigned a line speaks it, and each"
    + " character keeps the same slot in every scene.";
}

/** The standing direction the export carries after the character paragraphs. */
function standingDirection({ environment = "", atmosphere = "" } = {}) {
  return [
    "Maintain strict spatial, visual and audio continuity between scenes. Each new"
    + " scene must begin from the physical state, character positions, lighting,"
    + " environmental damage and emotional state the previous scene ended in.",
    "Use cinematic camera language: controlled handheld movement, slow push-ins,"
    + " dramatic close-ups, low angles, tracking shots and wide environmental reveals.",
    "Character animation must remain physically grounded with natural breathing, eye"
    + " movement, weight shifts, hand gestures, walking mechanics and expressive"
    + " facial acting.",
    environment ? `The environment is ${environment.replace(/\.?$/, "")}.` : "",
    atmosphere ? `The atmosphere is ${atmosphere.replace(/\.?$/, "")}.` : "",
    "Dialogue must be clearly synchronized with the speaking character's mouth.",
    "Audio should contain natural room ambience and cinematic sound effects that"
    + " match the environment.",
    "Generated dialogue must remain consistent with the established speaker identities.",
    "The story should continuously escalate rather than resetting between scenes.",
  ].filter(Boolean);
}

/**
 * The whole prompt_prefix, built from the cast: subject definitions, voice
 * assignments, then standing direction. This is what the model is GIVEN, not
 * what it is asked to write.
 */
/** Does a chat message ask for a screenplay? (2.230.0, Tim verbatim: "when
 *  i ask to create a sceenplay, or screenplay of, or make a screenplay,
 *  check the global prompt in video docker, if it is empty build the
 *  prompt, save the prompt and pass it to the llm rag"). His own spelling
 *  matches too — /scr?eenplay/ covers "sceenplay" — and "write a
 *  screenplay" rides along as the same intent. Mentioning the word inside
 *  other talk ("that screenplay was great") does NOT trigger: the ask
 *  needs create/make/write, or the "screenplay of <thing>" shape. */
function asksForScreenplay(text) {
  const t = String(text || "");
  if (!/\bscr?eenplay\b/i.test(t)) return false;
  return /\b(?:create|make|write)\b/i.test(t) || /\bscr?eenplay of\b/i.test(t);
}

/** 2.275.0 (Tim: "when i ask to create the music video change the video
 *  dockers workflow to the music video workflow ... the llm should send
 *  music videos scene prompts to video docker scenes"): a MUSIC VIDEO ask
 *  is a screenplay ask with a workflow attached — create/make/write + the
 *  words, or "music video of <thing>". Mentioning a music video in other
 *  talk does not trigger, same shape as asksForScreenplay. */
function asksForMusicVideo(text) {
  const t = String(text || "");
  if (!/\bmusic\s*video\b/i.test(t)) return false;
  return /\b(?:create|make|write)\b/i.test(t) || /\bmusic\s*video of\b/i.test(t);
}

function buildPrefix(characters = [], opts = {}) {
  const paras = ["subject_definitions:"];
  for (const c of assignSlots(characters)) paras.push(subjectDefinition(c));
  const va = voiceAssignments(characters);
  if (va) paras.push(va);
  // REFERENCE PICTURES RIDE THE SHARED PROMPT (2.191.0, Tim: "put the
  // reference picture name, type, description in the scene board (global
  // prompt)") — the routes hand chapterRefs.prefixParagraphs(project) in
  // here, cast-adjacent, so the board shows them and every render carries
  // them. buildPrefix stays project-agnostic; the caller owns the lookup.
  /* 2.299.0 (Tim: "add location tag to global prompt if location is
     set"): every location with its picture, by @tag - the caller hands
     lib/locationPrefix.lines(envs.list(project)) in (project-agnostic) */
  if (Array.isArray(opts.locations) && opts.locations.length)
    paras.push(opts.locations.join("\n"));
  if (Array.isArray(opts.refParagraphs)) paras.push(...opts.refParagraphs);
  paras.push(...standingDirection(opts));
  // one line per element (a multi-line paragraph splits), as the textarea
  // round-trips it
  return lines(paras).flatMap((l) => String(l).split("\n"));
}

/** Blank-line-separated paragraphs, as prompt_prefix and prompt want. */
function lines(paragraphs) {
  const out = [];
  for (const p of paragraphs) {
    if (out.length) out.push("");
    out.push(String(p));
  }
  return out;
}

const TAG_RE = /@([A-Za-z0-9_]+)/g;
const SPEAKER_RE = /^@([A-Za-z0-9_]+)\s*\(S(\d)\)/;
const DIALOGUE_RE = /^<d>\[[^\]]+\][\s\S]*<\/d>$/;

/**
 * Check a plan against the cast and the grammar. Returns {ok, errors, warnings}.
 * Errors are things ComfyUI will reject or render wrong; warnings are things
 * that will render but not as intended.
 */
function validate(plan, characters = [], environments = [], refTags = []) {
  const errors = [], warnings = [];
  const known = new Set(characters.map((c) => String(c.tag || c.name).toLowerCase()));
  // 2.142.0: environment tags are legitimate references — a location on the
  // chain may be named in any shot — but a location never SPEAKS: a speaker
  // line addressed to one is an error, not a new voice.
  const envTags = new Set((environments || [])
    .map((e) => String((e || {}).tag || (e || {}).name || "").toLowerCase())
    .filter(Boolean));
  for (const et of envTags) known.add(et);
  // 2.194.0 (Tim: "can we tell the llm automatically which are character
  // references and the other types of references, so it doesn't get
  // confused?"): reference-picture tags are the THIRD kind — legal in any
  // prompt line (they steer appearance, and 2.183.0's own brief invites
  // "@jinx posed as @horse_pose", which this function used to REFUSE as an
  // unknown character), but a picture can never act or speak: a speaker
  // line addressed to one is an error with its own explanation.
  const picTags = new Set((refTags || [])
    .map((t) => String(t || "").toLowerCase()).filter(Boolean));
  for (const pt of picTags) known.add(pt);
  // Only slots RECORDED in a profile are binding. An auto-assigned slot is our
  // guess at an ordering, and Tim's own film assigns them the other way round -
  // enforcing a guess would have rejected the file that actually rendered.
  // Where nothing is recorded, the rule is internal CONSISTENCY instead, which
  // is the property that actually matters: one voice per character throughout.
  const slotOf = new Map(characters
    .filter((c) => /^S?\d+$/.test(String(c.slot || "")))
    .map((c) => [String(c.tag || c.name).toLowerCase(),
                 "S" + String(c.slot).replace(/^S/, "")]));
  const slotsSeen = new Map();
  if (!plan || typeof plan !== "object") return { ok: false, errors: ["not an object"], warnings };
  const prefix = plan.prompt_prefix, shots = plan.shots;
  if (!Array.isArray(prefix) || !prefix.length) errors.push("prompt_prefix must be a non-empty array of lines");
  else if (String(prefix[0]).trim() !== "subject_definitions:")
    errors.push('prompt_prefix must begin with "subject_definitions:"');
  if (!Array.isArray(shots) || !shots.length) {
    errors.push("shots must be a non-empty array");
    return { ok: false, errors, warnings };
  }
  // every @tag anywhere must be a character that exists
  const seenTags = new Set();
  const scan = (arr) => {
    for (const l of (arr || [])) {
      let m;
      TAG_RE.lastIndex = 0;
      while ((m = TAG_RE.exec(String(l)))) seenTags.add(m[1].toLowerCase());
    }
  };
  scan(prefix);
  const ids = [];
  shots.forEach((s, i) => {
    const where = `shot ${i + 1}${s && s.id ? ` (${s.id})` : ""}`;
    if (!s || typeof s !== "object") { errors.push(`${where}: not an object`); return; }
    if (!s.id) errors.push(`${where}: needs an id`);
    else if (ids.includes(s.id)) errors.push(`${where}: duplicate id`);
    if (s.id) ids.push(s.id);
    if (!Array.isArray(s.prompt) || !s.prompt.length) {
      errors.push(`${where}: prompt must be an array of lines`);
    } else {
      scan(s.prompt);
      const solid = s.prompt.filter((l) => String(l).trim());
      // a shot whose every line is a bare "[Shot N]" marker (or empty) would
      // render NOTHING for its full length — refuse it by name rather than
      // let twelve empty scenes burn the render queue
      if (solid.length && solid.every((l) =>
            /^\[Shot \d+\]\s*$/i.test(String(l).trim())))
        errors.push(`${where}: the prompt is only a "[Shot N]" marker — there `
          + "is no action, camera or dialogue to render; the marker is a "
          + "prefix on the first action line, never the whole shot");
      if (solid.length > 1 && !s.prompt.some((l) => String(l) === ""))
        warnings.push(`${where}: no blank lines between beats - the pipeline reads each beat separately`);
      s.prompt.forEach((l, j) => {
        const t = String(l).trim();
        if (!t) return;
        if (SPEAKER_RE.test(t)) {
          const sm = SPEAKER_RE.exec(t);
          const who = sm[1].toLowerCase();
          if (!slotsSeen.has(who)) slotsSeen.set(who, new Set());
          if (envTags.has(who)) errors.push(
            `${where}: @${who} is an environment — a location cannot speak`);
          else if (picTags.has(who)) errors.push(
            `${where}: @${who} is a reference PICTURE — it cannot act or `
            + "speak; use it only inside a prompt line to steer appearance");
          slotsSeen.get(who).add(`S${sm[2]}`);
          const want = slotOf.get(who);
          if (want && `S${sm[2]}` !== want)
            errors.push(`${where}: @${sm[1]} speaks in (S${sm[2]}) but is assigned `
              + `(${want}) - a character whose slot moves swaps voices mid-film`);
          // Only a line that ENDS WITH A COLON announces speech; a (Sn)
          // line without one is a vocalization beat — a snort, a hitched
          // breath — with nothing spoken, and every model writes them
          // (2.187.0). normalize repairs glued/unwrapped/orphaned colons,
          // so this is the backstop for plans that skipped the gate.
          const next = String(s.prompt.slice(j + 1).find((x) => String(x).trim()) || "").trim();
          if (/:$/.test(t) && !DIALOGUE_RE.test(next))
            errors.push(`${where}: "${t.slice(0, 40)}" announces speech (it ends with a colon) but the next beat is not <d>[Language] ...</d>`);
        } else if (/^<d>/.test(t) && !DIALOGUE_RE.test(t)) {
          errors.push(`${where}: malformed dialogue line "${t.slice(0, 50)}"`);
        }
      });
    }
    if (s.length !== undefined && (!Number.isFinite(s.length) || s.length < 24 || s.length > 600))
      warnings.push(`${where}: length ${s.length} frames is outside the usual 24-600`);
    if (s.seed !== undefined && typeof s.seed !== "string")
      warnings.push(`${where}: seed should be a STRING of digits (a large number loses precision as JSON)`);
    if (i > 0 && !s.visual_context_source)
      warnings.push(`${where}: no visual_context_source, so it will not continue from the shot before`);
    // 2.196.0: EARLIER shots only — the old `ids.includes` clause made any
    // existing id legal, forward references included, and ChainPlan died
    // on what validate had blessed. normalize repairs these; backstop here.
    if (s.visual_context_source
        && !shots.slice(0, i).some((p) => p && p.id === s.visual_context_source))
      errors.push(`${where}: visual_context_source "${s.visual_context_source}" is not an earlier shot`);
  });
  // One voice per character, and no two characters sharing one.
  const owner = new Map();
  for (const [who, set] of slotsSeen) {
    if (set.size > 1)
      errors.push(`@${who} speaks in ${[...set].join(" and ")} - a character must keep `
                + `ONE slot throughout or their voice changes mid-film`);
    for (const sl of set) {
      if (owner.has(sl) && owner.get(sl) !== who)
        errors.push(`(${sl}) is used by both @${owner.get(sl)} and @${who} - two `
                  + `characters sharing a slot speak with the same voice`);
      else owner.set(sl, who);
    }
  }
  // THE ONE THAT MATTERS: invented characters
  for (const t of seenTags) {
    if (!known.has(t))
      errors.push(`@${t} has no character in this project - it would render as a `
                + `stranger. Add the character (with a reference sheet) or drop the tag.`);
  }
  for (const c of characters) {
    const tag = String(c.tag || c.name).toLowerCase();
    if (!seenTags.has(tag)) warnings.push(`${c.name} never appears in the screenplay`);
  }
  return { ok: errors.length === 0, errors, warnings, tags: [...seenTags], ids };
}

/* 2.281.0 (Tim: "i think the llm is getting confused, it is not adding
 * the right characters"): DETERMINISTIC tag repair, run before the model
 * repair round when a plan's only sin is invented @tags. A small local
 * model copies template tags verbatim; asking it to fix its own copy
 * often just re-copies. The unambiguous cases need no model at all:
 * with exactly ONE cast member every invented tag IS that member (the
 * music-video singer case) — map them; with several, the invented tag
 * names nobody — strip the token, keep the sentence. Every change is
 * returned in words for the chat. Known tags (cast + environments +
 * chapter references + each cast voice alias) are never touched. */
function repairTags(plan, characters, environments, refTags) {
  const known = new Set();
  for (const c of (characters || [])) {
    const t = String(c.tag || c.name || "").toLowerCase();
    if (t) { known.add(t); known.add(t + "_voice"); }
  }
  for (const e of (environments || []))
    if (e && e.tag) known.add(String(e.tag).toLowerCase());
  for (const t of (refTags || [])) known.add(String(t).toLowerCase());
  const sole = (characters || []).length === 1
    ? String(characters[0].tag || characters[0].name).toLowerCase() : null;
  const changes = [];
  const fix = (line) => String(line).replace(
    /(^|[^\w@])@([A-Za-z][\w-]*)/g,
    (m, pre, tag) => {
      const t = tag.toLowerCase();
      if (known.has(t)) return m;
      /* 2.283.0 (Tim's report: "@jesses_paul has no character" beside a
         real @jesse_paul — a one-letter model typo, and the (S1) slot
         conflict it dragged in): a NEAR-MISS of exactly one known tag
         (edit distance <= 2, voice aliases excluded as targets) MAPS to
         it before the sole/strip logic — a typo is not an invention. */
      const plain = [...known].filter((k) => !k.endsWith("_voice"));
      const dist = (a, b) => {
        if (Math.abs(a.length - b.length) > 2) return 3;
        const d = Array.from({ length: a.length + 1 },
          (_, i) => [i, ...Array(b.length).fill(0)]);
        for (let j = 1; j <= b.length; j++) d[0][j] = j;
        for (let i = 1; i <= a.length; i++)
          for (let j = 1; j <= b.length; j++)
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1,
              d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        return d[a.length][b.length];
      };
      const near = plain.filter((k) => dist(t, k) <= 2);
      if (near.length === 1) {
        changes.push(`@${tag} → @${near[0]}: a near-miss of the real tag `
          + "(model typo), mapped");
        return pre + "@" + near[0];
      }
      if (sole) {
        changes.push(`@${tag} → @${sole}: the model invented a tag; the `
          + "one cast member takes the role");
        return pre + "@" + sole;
      }
      changes.push(`@${tag} removed: no such character (real tags: `
        + [...known].filter((k) => !k.endsWith("_voice")).map((k) => "@" + k)
            .join(", ") + ")");
      return pre + tag;
    });
  const out = JSON.parse(JSON.stringify(plan || {}));
  for (const sh of (out.shots || [])) {
    if (Array.isArray(sh.prompt)) sh.prompt = sh.prompt.map(fix);
    else if (typeof sh.prompt === "string") sh.prompt = fix(sh.prompt);
  }
  return { plan: out, changes };
}

/** Fill in the shot settings the model was not asked to think about. */
/** The nearest H3-valid frame length: 5..3592 with length % 17 == 5 (the
 *  pack's own preflight rule, quoted verbatim in normalize below). Garbage
 *  answers the export default. */
function snapLength(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return DEFAULTS.length;
  const c = Math.max(5, Math.min(3592, v));
  return Math.max(5, Math.min(3592, 5 + 17 * Math.round((c - 5) / 17)));
}

/** The nearest H3-valid context length — the pack's own set, quoted
 *  verbatim from ChainPlan's error (2.189.0): 0 or one of (1, 5, 22, 39,
 *  56, 73, 90, 107, 124, 141, 158, 175, 192, 209, 226, 243) — {0, 1} plus
 *  the 17k+5 lattice capped at 243. Garbage answers the given default. */
const CONTEXT_SET = [0, 1, 5, 22, 39, 56, 73, 90, 107, 124, 141, 158, 175,
                     192, 209, 226, 243];
function snapContext(n, def) {
  const v = Number(n);
  if (!Number.isFinite(v)) return def;
  let best = CONTEXT_SET[0];
  for (const c of CONTEXT_SET)
    if (Math.abs(c - v) < Math.abs(best - v)) best = c;
  return best;
}

function normalize(plan, overrides) {
  // CHAIN SETTINGS OVERRIDES (2.150.0, by instruction: "use the character
  // workflows inputs for settings... allow user to change all the workflow
  // settings"). Only keys the EXPORT defines are honoured — the tab cannot
  // invent a widget the workflow does not have — and only with a real value;
  // an empty string in the tab means "the export's own default". A stored
  // shot still wins: overrides fill what a shot does not say, exactly like
  // DEFAULTS, so re-normalizing an existing plan changes nothing.
  const ov = {};
  for (const k of Object.keys(DEFAULTS)) {
    const v = overrides && overrides[k];
    if (v === undefined || v === null || v === "") continue;
    ov[k] = typeof DEFAULTS[k] === "number" ? Number(v) : String(v);
    if (typeof DEFAULTS[k] === "number" && !Number.isFinite(ov[k])) delete ov[k];
  }
  // a chain-tab override for source_reference must be a real enum value too
  // (2.173.0) - typed junk falls back to the export default silently rather
  // than poisoning every shot with a value ChainPlan will refuse
  if (ov.source_reference !== undefined
      && !["off", "on", "inherit"].includes(String(ov.source_reference)))
    delete ov.source_reference;
  // A seed is built digit-wise: Math.random() * 9e18 exceeds Number.MAX_SAFE_
  // INTEGER, so String() of it comes back rounded ("...048400") - a seed that
  // is not the seed anyone thinks it is, and not reproducible from the log.
  const seed = () => String(1 + Math.floor(Math.random() * 9))
    + Array.from({ length: 18 }, () => Math.floor(Math.random() * 10)).join("");
  const idOf = (s, i) => (s && s.id) || `clip_${String(i + 1).padStart(2, "0")}`;
  // EVERY SHOT LENGTH IS SNAPPED TO THE PACK'S OWN RULE (2.156.0). The rule
  // is VERIFIED, not guessed — Tim's node said it verbatim: "Shot 1 length
  // must be an H3-valid frame length between 5 and 3592 with
  // length % 17 == 5; got 360." (MiniMaxH3ChainPlan, chain_nodes.py). Every
  // length in his exports obeys it (141, 158, 22, 39), so a duration typed
  // in seconds or invented by a model snaps to the nearest valid frame
  // count instead of dying at preflight.
  // THE PLAN'S OWN DIALOGUE LANGUAGE (2.155.0): when a <d> line is missing
  // its [Language] tag, the tag inserted is the language the REST of the
  // plan speaks — the most common [X] across every dialogue line — falling
  // back to English (the H3 demo convention) for a plan with none.
  const langCount = {};
  for (const sh of (plan.shots || [])) {
    for (const l of (Array.isArray(sh && sh.prompt) ? sh.prompt : [])) {
      const m = /<d>\s*\[([^\]]+)\]/.exec(String(l || ""));
      if (m) langCount[m[1].trim()] = (langCount[m[1].trim()] || 0) + 1;
    }
  }
  const lang = Object.keys(langCount)
    .sort((a, b) => langCount[b] - langCount[a])[0] || "English";
  // ONE DURATION FOR EVERY SCENE (2.171.0, by instruction: "remove the
  // duration from each scene type... use the default duration for all
  // scenes, the workflow doesn't like scenes of different lengths"). The
  // per-shot length a model, an old board, or an old client sends is
  // IGNORED here — every shot gets the chain default (or the export
  // default), snapped once. normalize is the single gate every plan passes
  // (writer, add, edit, load), so uniformity cannot be bypassed.
  const uniformLength = snapLength(
    ov.length !== undefined ? ov.length : DEFAULTS.length);
  const shots = (plan.shots || []).map((s, i) => {
    const out = { ...DEFAULTS, ...ov, ...s };
    out.id = idOf(s, i);
    out.length = uniformLength;
    /* THE CONTEXT WINDOW IS SPENT OUT OF THE FRAME BUDGET (2.223.3, Tim's
       field report, verbatim: "i think the workflow is using 1 second of
       the previous video and using it to start the next video, however i
       think it is adding the 1 second from the start of the first video to
       the end of the first video and cutting 1 second of each new video so
       each new video is 1 second less"). context_length is 22 frames ≈ the
       observed second. Two repairs, both matching the report exactly:
       - the FIRST scene has no predecessor, so a context window there has
         nothing to continue from — and came back as the scene's own first
         second looped onto its END. No source, no window: its context
         lengths become 0 unless the chain tab explicitly sets one.
       - every CONTINUING scene spends its window out of the budget and
         came back one window SHORT — so its requested length is
         compensated by its own context window (snapped back onto the
         pack's grid): the content that comes out is the duration asked
         for. The ChainPlan default_duration_seconds fallback follows
         shots[0] and is untouched.
       This encodes the pack semantics the field evidence shows; if a pack
       update changes them, this comment is where to look first. */
    if (i === 0 && out.source_reference !== "on" && out.source_reference !== "inherit") {
      // (a source VIDEO — source_reference on/inherit — is a real
      // predecessor, so the window stays; an explicit chain-tab value
      // stays too: the user said so globally)
      if (ov.context_length === undefined) out.context_length = 0;
      if (ov.audio_context_length === undefined) out.audio_context_length = 0;
    } else if (i > 0) {
      /* 2.223.5 — the 2.223.3 per-window compensation (+22f) was NOT
         enough on hardware; the shortfall COMPOUNDS with scene position.
         Tim (verbatim): "it is still cutting the next scene by 1 second,
         maybe a simple solution will be to add 2 second (24 frames) to
         scenes after the first scene, example, scene 1 = 15 seconds,
         scene 2 = +1 second, scene 3 = +2 seconds, etc." His example is
         the spec: scene N asks for the duration plus (N−1) seconds —
         24 frames per position — snapped UP onto the pack's grid
         (nearest-snap rounded scene 2's +24 down to +17, undershooting
         the ladder; the symptom is CUTTING, so overshoot is the safe
         side), clamped by the grid at 3592f (~scene 130 of a 15s
         movie). The context window stays as conditioning input; it no
         longer drives the arithmetic. */
      const want = uniformLength + i * 24;
      out.length = Math.min(3592, Math.max(snapLength(want),
        5 + 17 * Math.ceil((Math.min(3592, want) - 5) / 17)));
    }
    // SOURCE_REFERENCE IS AN ENUM, NOT A SHOT ID (2.173.0, the pack's own
    // words on Tim's preflight card, verbatim: "Unknown H3 scene source
    // reference override 'clip_01'; expected inherit or one of ('off',
    // 'on')." - chain_nodes.py line 10882). Models conflate it with
    // visual_context_source and write the previous shot's id there, and
    // the plan then dies at ChainPlan. An id that names an EARLIER shot
    // migrates to visual_context_source (that is what the model meant)
    // when none is set; anything not off/on/inherit becomes the default.
    // NUMBERS THAT AREN'T (2.185.0, Tim's card verbatim: "ValueError:
    // invalid literal for int() with base 10: '<digits as a STRING>'") — a
    // model copied the guide's seed PLACEHOLDER into the plan and ChainPlan
    // int()'d it. A seed that is not all digits is re-minted; the other
    // numeric per-shot fields fall back to their defaults when they do not
    // parse. Repairs, like everything else in normalize.
    if (out.seed !== undefined && !/^\d+$/.test(String(out.seed)))
      delete out.seed;   // the minting pass below writes a real one
    for (const nk of ["steps", "context_length", "audio_context_length",
                      "video_blend_frames"]) {
      if (out[nk] !== undefined && !Number.isFinite(Number(out[nk])))
        out[nk] = DEFAULTS[nk];
      else if (out[nk] !== undefined) out[nk] = Number(out[nk]);
    }
    // CONTEXT LENGTHS LIVE ON THE PACK'S OWN LATTICE (2.189.0, ChainPlan's
    // words on Tim's card, verbatim: "Shot 3: H3 scene context length must
    // be 0 or one of (1, 5, 22, 39, 56, 73, 90, 107, 124, 141, 158, 175,
    // 192, 209, 226, 243).") — {0, 1} plus 17k+5 capped at 243. The 2.185.0
    // repair coerced these to NUMBERS but a finite invalid one (a model's
    // 24, 100...) still rode through and died at node 9. Snapped to the
    // nearest valid value here, like snapLength — a repair, not an error.
    for (const ck of ["context_length", "audio_context_length"]) {
      if (out[ck] !== undefined) out[ck] = snapContext(out[ck], DEFAULTS[ck]);
    }
    if (out.source_reference !== undefined
        && !["off", "on", "inherit"].includes(String(out.source_reference))) {
      const sr = String(out.source_reference);
      if (!out.visual_context_source
          && (plan.shots || []).slice(0, i).some((p, j) => idOf(p, j) === sr))
        out.visual_context_source = sr;
      out.source_reference = DEFAULTS.source_reference;
    }
    // BEAT SPACING IS FIXED HERE, NOT WARNED ABOUT (2.142.4): the pipeline
    // reads each blank-separated beat separately, and models reliably forget
    // the blanks — twelve identical warnings taught nobody anything. A blank
    // line goes between any two solid lines EXCEPT a speaker line and the
    // <d> dialogue that answers it: that pair is ONE beat and must stay
    // glued, or the voice detaches from its speaker. Already-spaced prompts
    // pass through unchanged; runs of blanks collapse to one.
    const src = (Array.isArray(out.prompt) ? out.prompt : [out.prompt])
      .map((l) => String(l == null ? "" : l));
    // a "[Shot N]" MARKER ALONE ON ITS LINE is glued to the next solid line
    // first — the marker is a prefix on the opening action, never a beat of
    // its own (a beat that is only a marker renders nothing)
    for (let k = 0; k < src.length - 1; k++) {
      if (/^\[Shot \d+\]\s*$/i.test(src[k].trim())) {
        let nn = k + 1;
        while (nn < src.length && !src[nn].trim()) nn++;
        if (nn < src.length) {
          src[k] = src[k].trim() + " " + src[nn].trim();
          src.splice(k + 1, nn - k);
        }
      }
    }
    /* DIALOGUE LINES THE MODELS ACTUALLY WRITE ARE FIXED HERE TOO
       (2.283.0, Tim's music-video report: six shots refused as
       "malformed dialogue line" — every one a mechanical accident):
       d) a <d> line WRAPPED across array entries (the closing </d>
          landed on the next line) is JOINED — up to three continuations,
          matching how the models wrap long lyric lines;
       e) prose TRAILING after </d> on the same line ("...</d> His eyes
          close.") is SPLIT off into its own beat — the pack wants the
          dialogue line to stand alone (voice outside, lyric inside,
          nothing after). */
    for (let k = 0; k < src.length; k++) {
      const t = src[k].trim();
      if (!/^<d>/i.test(t) || /<\/d>/i.test(t)) continue;
      let joined = t, took = 0;
      for (let nn = k + 1; nn < src.length && took < 3; nn++) {
        if (!src[nn].trim()) continue;
        joined += " " + src[nn].trim(); took = nn - k;
        if (/<\/d>/i.test(src[nn])) break;
      }
      if (/<\/d>/i.test(joined)) src.splice(k, took + 1, joined);
    }
    for (let k = 0; k < src.length; k++) {
      const t = src[k].trim();
      const m = /^(<d>\[[^\]]+\][\s\S]*?<\/d>)\s*(\S[\s\S]*)$/i.exec(t);
      if (m) src.splice(k, 1, m[1], m[2].trim());
    }
    // SPEAKER LINES THE MODELS ACTUALLY WRITE ARE FIXED HERE, NOT REFUSED
    // (2.187.0, Tim: "the llm is not formatting the scenes properly, all the
    // llm's i have are doing the same thing"). Three misses, every model,
    // every time:
    //   a) the <d> glued onto the speaker line itself
    //      ("@joan (S1), a whisper: <d>[English] Johnny!</d>") — split into
    //      the two-beat form; the spacing pass below re-glues the pair.
    //   b) speech after the colon UNWRAPPED, usually quoted
    //      ("@johnny (S2), a growl: \"Not this time.\"") — the <d>[Lang]
    //      wrapper is a spelling, not a creative choice (the 2.155.0
    //      doctrine), so the trailing text becomes the <d> beat, quotes
    //      shed, the plan's own language inserted.
    //   c) a colon that announces speech which never comes — the colon is
    //      stripped so the line reads as the description it is.
    // A (Sn) line WITHOUT a trailing colon is not touched and no longer an
    // error: "@johnny (S2), a low, vibrating snort of derision." is a
    // vocalization beat — a real sound in a real voice with nothing spoken —
    // and refusing it burned every screenplay the models wrote.
    for (let k = 0; k < src.length; k++) {
      const t = src[k].trim();
      if (!SPEAKER_RE.test(t)) continue;
      const dAt = t.search(/<d>/i);
      if (dAt > 0) {                                   // (a) glued <d>
        // the head keeps its colon; the next solid line is now the <d>
        // beat, so pass (c) below leaves it alone
        src.splice(k, 1, t.slice(0, dAt).trim(), t.slice(dAt).trim());
        continue;
      }
      const cm = /^([^:]*\(S\d\)[^:]*):\s*(.*)$/.exec(t);
      if (!cm) continue;
      const trail = cm[2].trim();
      if (trail) {                                     // (b) unwrapped speech
        const said = trail.replace(/^["'“‘]+/, "")
                          .replace(/["'”’]+$/, "").trim();
        if (said) src.splice(k, 1, cm[1].trim() + ":", `<d>[${lang}] ${said}</d>`);
        else src[k] = cm[1].trim();  // a colon with only quotes after it
        continue;
      }
      if (!trail) {                                    // (c) colon, no speech
        let nn = k + 1;
        while (nn < src.length && !src[nn].trim()) nn++;
        if (nn >= src.length || !/^<d>/i.test(src[nn].trim()))
          src[k] = cm[1].trim();
      }
    }
    const spaced = [];
    // A DIALOGUE LINE WITHOUT ITS [Language] TAG IS FIXED HERE, NOT WARNED
    // ABOUT (2.155.0, supergemma4's miss — even the repair round could not
    // teach it): models reliably write "<d>Just you and me.</d>" and the
    // pipeline needs the tag to pick a TTS language. The tag is a spelling,
    // not a creative choice; the plan's own dominant language is inserted
    // (English when the plan has none) and validate never sees the miss.
    for (let k = 0; k < src.length; k++) {
      if (/^\s*<d>\s*(?!\[)/i.test(src[k]) && /<\/d>\s*$/i.test(src[k].trim()))
        src[k] = src[k].replace(/^(\s*<d>)\s*/i, `$1[${lang}] `);
    }
    for (const line of src) {
      const cur = line.trim();
      if (!cur) {
        if (spaced.length && spaced[spaced.length - 1] !== "") spaced.push("");
        continue;
      }
      const prev = spaced.length ? spaced[spaced.length - 1] : null;
      const glued = prev && SPEAKER_RE.test(prev.trim()) && /^<d>/i.test(cur);
      if (prev && prev !== "" && !glued) spaced.push("");
      spaced.push(line);
    }
    while (spaced.length && spaced[spaced.length - 1] === "") spaced.pop();
    out.prompt = spaced;
    out.seed = (out.seed === undefined || out.seed === null || out.seed === "")
      ? seed() : String(out.seed);
    // the id of the shot before, GENERATED if the model did not name it
    if (i > 0 && !out.visual_context_source)
      out.visual_context_source = idOf(plan.shots[i - 1], i - 1);
    if (i === 0) delete out.visual_context_source;
    return out;
  });
  // CONTINUITY POINTS BACKWARD (2.196.0, ChainPlan's card verbatim:
  // "visual_context_source for scene 2 must point to an earlier scene, got
  // 4"). A model that wires a shot to a LATER shot, to itself, or to an id
  // that does not exist killed the render at node 9 — and validate's old
  // check let it through (any EXISTING id counted as legal, forward
  // included). The repair is rule 8's own value: the shot before. The
  // first shot has nothing earlier, so its visual_context_source goes.
  for (let vi = 0; vi < shots.length; vi++) {
    const s = shots[vi];
    if (!s || s.visual_context_source === undefined) continue;
    if (vi === 0) { delete s.visual_context_source; continue; }
    const earlier = shots.slice(0, vi)
      .some((p) => p && p.id && p.id === s.visual_context_source);
    if (!earlier && shots[vi - 1] && shots[vi - 1].id)
      s.visual_context_source = shots[vi - 1].id;
  }
  return { prompt_prefix: plan.prompt_prefix || [], shots };
}

/** Put an accepted plan into every ChainPlan node. Returns a NEW graph. */
function writePlan(graph, plan, overrides) {
  const g = JSON.parse(JSON.stringify(graph));
  const ids = Object.keys(g).filter((k) => (g[k] || {}).class_type === PLAN_NODE);
  if (!ids.length) return { graph: g, wrote: 0,
    notes: [`this workflow has no ${PLAN_NODE}, so there is nowhere to put a screenplay`] };
  // THE 5.9-SECOND STOMP (2.178.0, Tim: "it only renders a 5 second scene
  // even when i set the duration to 15"). This normalize used to run with
  // NO overrides — harmless before 2.171.0 (a shot's own length survived),
  // but the uniform-length rule made an override-less normalize FORCE
  // every shot back to DEFAULTS.length (141f = 5.9s, the export's first
  // shot) AFTER the caller had already normalized to the chain default.
  // The caller's overrides now ride along, so the second normalize is the
  // idempotent no-op it was always meant to be.
  const norm = normalize(plan, overrides || {});
  const text = JSON.stringify(norm, null, 2);
  const notes = [];
  for (const id of ids) g[id].inputs.plan_json = text;
  // DUAL-WRITE THE PACK'S OWN FALLBACK (2.178.0): ChainPlan carries a
  // default_duration_seconds widget (verified in Tim's export, value 5).
  // Since 2.171.0 every scene shares ONE length, so the widget can say the
  // same number the plan says — and if a pack update ever ignores the old
  // per-shot `length` field, its own fallback still renders the right
  // duration. Only written where the EXPORT defines the widget (the
  // 2.150.0 doctrine: never invent a widget), never over a link.
  const secs = Math.round(((norm.shots || [{}])[0].length || DEFAULTS.length)
                          / FPS * 100) / 100;
  for (const id of ids) {
    const ins = g[id].inputs || {};
    if ("default_duration_seconds" in ins
        && !Array.isArray(ins.default_duration_seconds)
        && ins.default_duration_seconds !== secs) {
      notes.push(`ChainPlan default_duration_seconds ${ins.default_duration_seconds} `
        + `-> ${secs} (the plan's uniform scene length; the widget is the `
        + "pack's fallback if per-shot lengths are ever ignored)");
      ins.default_duration_seconds = secs;
    }
  }
  return { graph: g, wrote: ids.length, notes };
}

/**
 * Does a chat message ASK FOR a screenplay to be written? (Scene board step 4.)
 *
 * The chat box routes a match to POST /api/screenplay instead of an ordinary
 * chat turn, so this is kept deliberately NARROW: the cost of a false negative
 * is one extra click, the cost of a false positive is a generation the user
 * did not ask for. Someone asking *about* screenplays ("what is a screenplay?",
 * "how are screenplays structured?") must never trigger one — a question is a
 * question, and an interrogative opener is a question even without the mark.
 */
function wantsScreenplay(text) {
  const t = String(text || "").trim().toLowerCase();
  if (!t || !t.includes("screenplay")) return false;
  if (/\?\s*$/.test(t)) return false;
  if (/^(what|what's|whats|how|why|when|who|where|which|is|are|was|were|do|does|did|can|could|would|should|explain|describe|define|tell me about)\b/.test(t))
    return false;
  // "create a screenplay", "make me a screenplay about...", "write the screenplay"
  if (/\b(create|make|write|generate|draft|produce)\b[^.?!]{0,40}\bscreenplay\b/.test(t)) return true;
  // "screenplay of the heist", "screenplay for/about ..." as the request itself
  if (/^(a\s+)?screenplay\s+(of|for|about)\b/.test(t)) return true;
  return false;
}

/** "add a scene ..." / "new scene ..." from the chat box (2.162.0, by
 *  instruction). Questions stay chat; the remainder after the command is
 *  the scene's description (may be empty — the board's placeholder then).
 */
function wantsAddScene(text) {
  const t = String(text || "").trim();
  if (!t || /\?\s*$/.test(t)) return null;
  const m = /^(?:please\s+)?(?:add|create|make|insert)\s+(?:a\s+|another\s+)?(?:new\s+)?scene\b[:,]?\s*([\s\S]*)$/i.exec(t)
        || /^(?:please\s+)?new\s+scene\b[:,]?\s*([\s\S]*)$/i.exec(t);
  return m ? { description: m[1].trim() } : null;
}

/** "edit scene 2 make it more realistic" → which scene, what to do (2.162.0).
 *  "redo" is deliberately NOT here — on the board redo means re-render, and
 *  one word must not mean two things. A bare "edit scene 2" with no
 *  instruction still matches; the route asks what to change.
 */
function wantsEditScene(text) {
  const t = String(text || "").trim();
  if (!t || /\?\s*$/.test(t)) return null;
  const m = /^(?:please\s+)?(?:edit|change|rewrite|update|revise)\s+scene\s+(\d+)\b[:,.]?\s*([\s\S]*)$/i.exec(t);
  return m ? { n: parseInt(m[1], 10), instruction: m[2].trim() } : null;
}

/**
 * Pull the JSON plan out of whatever a local model actually sent back.
 *
 * Real llama-server replies arrive wearing all of: `<think>…</think>` blocks
 * (whose reasoning often CONTAINS braces, so "first { to last }" grabs
 * thought-junk), code fences of any language, prose around the object,
 * trailing commas from smaller models, and — when the token budget runs out —
 * an object cut off mid-way. So: strip thinking (a still-open block truncates
 * the reply, same rule as llmChat.stripThinking), drop fences, then scan for
 * BALANCED top-level objects with a string-aware brace counter and parse each
 * candidate (retrying once with trailing commas removed). The object with a
 * `shots` array wins; otherwise the first that parses at all.
 */
function _extract(text) {
  let s = String(text || "").replace(/<think>[\s\S]*?<\/think>/gi, "");
  const open = s.search(/<think>/i);
  if (open >= 0) s = s.slice(0, open);
  s = s.replace(/```[a-zA-Z0-9_-]*\n?/g, "").trim();
  const salvage = (t) => t.replace(/,\s*([}\]])/g, "$1");
  let sawBrace = false, sawUnbalanced = false, first = null;
  let i = s.indexOf("{");
  while (i >= 0) {
    sawBrace = true;
    let depth = 0, quote = false, escd = false, j = i, closed = -1;
    for (; j < s.length; j++) {
      const c = s[j];
      if (escd) { escd = false; continue; }
      if (quote) { if (c === "\\") escd = true; else if (c === '"') quote = false; continue; }
      if (c === '"') quote = true;
      else if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) { closed = j; break; } }
    }
    if (closed < 0) { sawUnbalanced = true; break; }   // ran off the end: truncated
    const chunk = s.slice(i, closed + 1);
    for (const cand of [chunk, salvage(chunk)]) {
      try {
        const o = JSON.parse(cand);
        if (o && Array.isArray(o.shots)) return { plan: o };
        if (!first) first = o;
        break;
      } catch { /* try the salvaged form, then move on */ }
    }
    i = s.indexOf("{", closed + 1);
  }
  if (first) return { plan: first };
  if (sawUnbalanced) return { plan: null, problem:
    "the reply was cut off in the middle of the JSON — the model ran out of "
    + "output tokens before finishing the plan" };
  if (sawBrace) return { plan: null, problem:
    "the reply contains braces but nothing in it parses as JSON" };
  return { plan: null, problem: "the reply contains no JSON object at all" };
}

/** How many scenes the brief asks for — "8 scenes", "3 scene film" (2.182.0,
 *  the iterative writer's switch). 0 when the brief names no count. */
function sceneCount(brief) {
  const m = /(\d{1,2})\s*[- ]?\s*scenes?\b/i.exec(String(brief || ""));
  const n = m ? parseInt(m[1], 10) : 0;
  return Number.isFinite(n) && n >= 1 && n <= 40 ? n : 0;
}

/** The story so far, flattened for the next scene's prompt (2.182.0, "read
 *  the previous scenes (rag)"). Newest scenes survive a tight budget first
 *  — continuation depends most on what JUST happened. Pure. */
function sceneDigest(shots, budgetChars) {
  const lines = (shots || []).map((sh, i) =>
    `Scene ${i + 1} (${(sh && sh.id) || "?"}): `
    + ((sh && sh.prompt) || []).join(" ").replace(/\s+/g, " ").trim());
  const out = [];
  let used = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (used + lines[i].length + 1 > (budgetChars || 6000)) break;
    out.unshift(lines[i]); used += lines[i].length + 1;
  }
  if (out.length < lines.length)
    out.unshift(`(${lines.length - out.length} earlier scene(s) omitted for space)`);
  return out.join("\n");
}

function parseReply(text) { return _extract(text).plan; }

/** Why parseReply returned null, in words a user can act on. */
function parseProblem(text) { return _extract(text).problem || null; }

module.exports = { repairTags, asksForScreenplay, asksForMusicVideo, guide, validate, normalize, writePlan, parseReply, sceneCount, sceneDigest, parseProblem, lines, wantsScreenplay, wantsAddScene, wantsEditScene,
                   snapLength,
                   assignSlots, subjectDefinition, voiceAssignments,
                   standingDirection, buildPrefix,
                   DEFAULTS, PLAN_NODE, FPS, exportDefaults };
