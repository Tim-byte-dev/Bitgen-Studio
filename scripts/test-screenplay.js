// bitGen Studio — lib/screenplay.js. The pipeline eats plan_json, not prose, so
// what matters is whether a model's reply is REJECTED when it is wrong.
// Run from repo root: node scripts/test-screenplay.js
const fs = require("fs");
const path = require("path");
const S = require(path.join(__dirname, "..", "lib", "screenplay"));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { console.log("PASS: " + name); pass++; }
  else { console.log("FAIL: " + name + (extra !== undefined ? " -> " + JSON.stringify(extra) : "")); fail++; }
}
const CAST = [{ name: "Jinx", tag: "jinx" }, { name: "Shahzaib", tag: "shahzaib" }];

// ---- the defaults come from Tim's own export, not from memory -------------
const STYLE = path.join(__dirname, "..", "comfy_workflows", "MM3_Characters.json");
const graph = JSON.parse(fs.readFileSync(STYLE, "utf8"));
const realPlan = JSON.parse(
  Object.values(graph).find((n) => n.class_type === S.PLAN_NODE).inputs.plan_json);
const first = realPlan.shots[0];
check("shot defaults are READ from the working export, so they cannot drift",
      S.DEFAULTS.continuation_mode === first.continuation_mode
      && S.DEFAULTS.context_length === first.context_length
      && S.DEFAULTS.source_reference === first.source_reference, S.DEFAULTS);
check("...and EVERY setting is defined, even those later shots leave out",
      Object.values(S.DEFAULTS).every((v) => v !== undefined), S.DEFAULTS);
check("a missing or broken export falls back instead of throwing",
      S.exportDefaults("/no/such/file.json").continuation_mode === "guide");

// ---- THE REAL PLAN MUST PASS ITS OWN VALIDATOR ---------------------------
// If Tim's working screenplay fails our rules, the rules are wrong.
const real = S.validate(realPlan, CAST);
check("the shipped, rendered screenplay passes validation",
      real.ok, real.errors);
/* It assigns shahzaib=(S1) and jinx=(S2) - the OPPOSITE of what cast order
   would guess. An auto-assigned slot is therefore never binding; only a slot
   recorded in a profile is. What is always enforced is consistency. */
check("...even though its slots are the opposite of cast order",
      S.validate(realPlan, [{ name: "Jinx", tag: "jinx" },
                            { name: "Shahzaib", tag: "shahzaib" }]).ok);
const swapped = JSON.parse(JSON.stringify(realPlan));
swapped.shots[1].prompt = swapped.shots[1].prompt.map(
  (l) => String(l).replace("@shahzaib (S1)", "@shahzaib (S2)"));
check("...but a character who changes slot part-way through IS caught",
      !S.validate(swapped, CAST).ok
      && S.validate(swapped, CAST).errors.some((e) => /must keep/.test(e)),
      S.validate(swapped, CAST).errors.slice(0, 2));
check("two characters sharing one slot is caught too",
      S.validate({ prompt_prefix: ["subject_definitions:"], shots: [{ id: "a", prompt: [
        "@jinx (S1), flatly:", "", "<d>[English] a</d>", "",
        "@shahzaib (S1), flatly:", "", "<d>[English] b</d>"] }] },
        [{ name: "Jinx", tag: "jinx" }, { name: "Shahzaib", tag: "shahzaib" }])
        .errors.some((e) => /sharing a slot/.test(e)));
check("...and its @tags are exactly the project's cast",
      real.tags.sort().join(",") === "jinx,shahzaib", real.tags);

// ---- the guide tells the model what it may say --------------------------
const g = S.guide(CAST);
check("the guide names the tags that exist, so nothing has to be invented",
      /@jinx/.test(g) && /@shahzaib/.test(g));
check("the guide states the defaults the export actually uses",
      g.includes(`"context_length": ${S.DEFAULTS.context_length}`), S.DEFAULTS.context_length);
check("the guide demands JSON only, and the dialogue and speaker forms",
      /ONE JSON object/.test(g) && /<d>\[English\]/.test(g) && /\(S1\)/.test(g));
check("with no cast it tells the model NOT to invent characters",
      /do not invent any/.test(S.guide([])));

// ---- the validator ------------------------------------------------------
const good = {
  prompt_prefix: ["subject_definitions:", "", "@jinx is defined by the reference sheet.",
                  "", "@shahzaib is defined by the reference sheet.", "",
                  "Maintain continuity between scenes."],
  shots: [
    { id: "clip_01", prompt: ["[Shot 1] @jinx holds up a bullet.", "",
                              "@jinx (S1), quietly:", "", "<d>[English] You get one shot.</d>",
                              "", "Hard cut."], length: 158, seed: "12" },
    { id: "clip_02", prompt: ["@shahzaib steps back.", "", "The alarm sounds."],
      length: 158, seed: "13", visual_context_source: "clip_01" },
  ],
};
check("a well-formed plan is accepted", S.validate(good, CAST).ok, S.validate(good, CAST).errors);

// the failure that matters most
const invented = JSON.parse(JSON.stringify(good));
invented.shots[1].prompt[0] = "@vi walks in behind @shahzaib.";
const iv = S.validate(invented, CAST);
check("an INVENTED character is an error, and the message says why it matters",
      !iv.ok && iv.errors.some((e) => /@vi has no character/.test(e) && /stranger/.test(e)),
      iv.errors);
const soloPlan = { prompt_prefix: ["subject_definitions:", "", "@jinx is defined by the sheet."],
                   shots: [good.shots[0]] };
check("...while a real character who never appears is only a warning",
      S.validate(soloPlan, CAST).ok
      && S.validate(soloPlan, CAST).warnings.some((w) => /Shahzaib never appears/.test(w)),
      S.validate(soloPlan, CAST).warnings);

const badDlg = JSON.parse(JSON.stringify(good));
badDlg.shots[0].prompt[4] = "You get one shot.";
check("a COLON-terminated speaker line whose next beat is not <d>...</d> is an error",
      !S.validate(badDlg, CAST).ok
      && S.validate(badDlg, CAST).errors.some((e) => /announces speech/.test(e)));

// ---- the speaker lines models ACTUALLY write (2.187.0) ---------------------
// Tim: "the llm is not formatting the scenes properly, all the llm's i have
// are doing the same thing" — four verbatim error shapes from his board, all
// repaired by normalize, none an error any more.
{
  const p = { prompt_prefix: ["subject_definitions:", "", "@jinx is defined."],
    shots: [{ id: "clip_04", prompt: [
      "[Shot 4] @jinx grips the rail.", "",
      "@jinx (S1), her breath hitching as the gate slams shut.", "",
      "@shahzaib (S2), a low, vibrating snort of derision.", "",
      "@jinx (S1), her voice a high, desperate whisper: <d>[English] Get back!</d>", "",
      "@shahzaib (S2), his voice a deep, vibrating growl: \"Not this time.\"", "",
      "@jinx (S1), steadying herself, calls out:",
    ] }] };
  const CAST2 = [{ name: "Jinx", tag: "jinx", slot: "S1", images: ["a.png"], voices: [] },
                 { name: "Shahzaib", tag: "shahzaib", slot: "S2", images: ["a.png"], voices: [] }];
  const n = S.normalize(p, {});
  const lines = n.shots[0].prompt;
  const v = S.validate(n, CAST2);
  check("a (Sn) VOCALIZATION beat — no colon, nothing spoken — is legal and untouched",
        v.ok && lines.includes("@jinx (S1), her breath hitching as the gate slams shut.")
             && lines.includes("@shahzaib (S2), a low, vibrating snort of derision."),
        v.errors);
  const wAt = lines.indexOf("@jinx (S1), her voice a high, desperate whisper:");
  check("a <d> glued onto the speaker line is SPLIT into the two-beat form",
        wAt >= 0 && lines[wAt + 1] === "<d>[English] Get back!</d>", lines);
  const gAt = lines.indexOf("@shahzaib (S2), his voice a deep, vibrating growl:");
  check("quoted, unwrapped speech after the colon is WRAPPED as <d>[Lang] ...</d>, quotes shed",
        gAt >= 0 && lines[gAt + 1] === "<d>[English] Not this time.</d>", lines);
  check("a colon announcing speech that never comes is STRIPPED to a description",
        lines[lines.length - 1] === "@jinx (S1), steadying herself, calls out", lines);
  const g = S.guide(CAST2);
  check("the guide teaches the colon-is-a-promise rule and the vocalization beat",
        /ENDING WITH A COLON/.test(g) && /snort/.test(g)
        && /NEVER put the <d>/.test(g), null);
}
const badWrap = JSON.parse(JSON.stringify(good));
badWrap.shots[0].prompt[4] = "<d>You get one shot.</d>";     // no [Language]
check("dialogue without the [Language] tag is an error",
      !S.validate(badWrap, CAST).ok);
check("a prompt_prefix not starting with subject_definitions: is an error",
      !S.validate({ ...good, prompt_prefix: ["once upon a time"] }, CAST).ok);
check("duplicate shot ids are an error",
      !S.validate({ ...good, shots: [good.shots[0], good.shots[0]] }, CAST).ok);
const badCtx = JSON.parse(JSON.stringify(good));
badCtx.shots[1].visual_context_source = "clip_99";
check("a visual_context_source that is not an earlier shot is an error",
      !S.validate(badCtx, CAST).ok
      && S.validate(badCtx, CAST).errors.some((e) => /clip_99/.test(e)));
const noBlank = { ...good, shots: [{ id: "a", prompt: ["one beat.", "two beats."] }] };
check("beats run together with no blank line is a warning, not a rejection",
      S.validate(noBlank, CAST).ok
      && S.validate(noBlank, CAST).warnings.some((w) => /blank lines/.test(w)));
check("a numeric seed is warned about (JSON loses big-integer precision)",
      S.validate({ ...good, shots: [{ ...good.shots[0], seed: 7758178457739749924 }] }, CAST)
        .warnings.some((w) => /STRING of digits/.test(w)));
check("junk is rejected without throwing",
      !S.validate(null, CAST).ok && !S.validate({}, CAST).ok
      && !S.validate({ prompt_prefix: [], shots: "no" }, CAST).ok);

// ---- subject definitions and voice slots (2.137.0) -----------------------
// Both are FACTS about the cast, generated from the profiles rather than left
// to the model, which would otherwise re-describe a character differently in
// every scene.
const RICH = [
  { name: "Jinx", tag: "jinx", age: "19", height: "165cm", weight: "52kg",
    pronouns: "she", notes: "vivid blue hair, pale skin", wardrobe: "a cropped jacket and goggles",
    voices: ["v.wav"], slot: "S1" },
  { name: "Shahzaib", tag: "shahzaib", age: "34", pronouns: "he", slot: "S2" },
];
const def = S.subjectDefinition(RICH[0]);
check("a subject definition names the tag and points at the reference sheet",
      /^@jinx is the character defined by the provided character reference sheet\./.test(def), def);
check("...carries the profile's age, height and weight",
      /age 19, height 165cm, weight 52kg/.test(def), def);
check("...uses the character's pronouns throughout",
      /Preserve her facial identity/.test(def) && /Her wardrobe remains a cropped jacket/.test(def)
      && !/\btheir\b/.test(def), def);
check("...and ends with the do-not-redesign clause the export uses",
      /Do not redesign her face, hairstyle, body or clothing\.$/.test(def), def);
check("a character with no wardrobe recorded still defers to the reference",
      /His wardrobe remains the one defined by the reference/.test(S.subjectDefinition(RICH[1])));
check("no stray double spaces or dangling punctuation from empty fields",
      !/ {2}/.test(S.subjectDefinition(RICH[1])) && !/\.\./.test(S.subjectDefinition(RICH[1])),
      S.subjectDefinition(RICH[1]));

const slotted = S.assignSlots([{ name: "A", tag: "a", slot: "S2" }, { name: "B", tag: "b" },
                               { name: "C", tag: "c" }]);
check("a slot already recorded is KEPT, and the rest fill the gaps around it",
      slotted.map((c) => c.tag + "=" + c.slot).join(" ") === "a=S2 b=S1 c=S3", slotted);
check("assigning slots twice is stable (the same cast gets the same voices)",
      JSON.stringify(S.assignSlots(slotted)) === JSON.stringify(slotted));
const va = S.voiceAssignments(RICH);
check("voice assignments name each character's slot",
      /@jinx speaks in \(S1\)/.test(va) && /@shahzaib speaks in \(S2\)/.test(va), va);
check("...and say a voice reference is in play only where one exists",
      /\(S1\) using the provided voice reference/.test(va)
      && !/\(S2\) using the provided voice reference/.test(va), va);
check("...and state that only the assigned character speaks a line",
      /Only the character explicitly assigned a line speaks it/.test(va));

const pfx = S.buildPrefix(RICH, { environment: "an abandoned facility", atmosphere: "tense" });
check("buildPrefix opens with subject_definitions: as the grammar requires",
      pfx[0] === "subject_definitions:");
check("...has a blank line between every paragraph",
      pfx.filter((l) => l === "").length === (pfx.filter((l) => l !== "").length - 1), pfx.length);
check("...contains a paragraph per character, then the voice assignments",
      pfx.some((l) => /^@jinx is the character/.test(l))
      && pfx.some((l) => /^@shahzaib is the character/.test(l))
      && pfx.some((l) => /^voice_assignments:/.test(l)));
check("...and the standing direction, with the environment and atmosphere woven in",
      pfx.some((l) => /The environment is an abandoned facility\./.test(l))
      && pfx.some((l) => /The atmosphere is tense\./.test(l))
      && pfx.some((l) => /continuously escalate/.test(l)), pfx.slice(-4));
check("a prefix built from the cast passes the validator it will be checked by",
      S.validate({ prompt_prefix: pfx,
                   shots: [{ id: "clip_01", prompt: ["@jinx waits.", "", "@shahzaib enters."] }] },
                 RICH).ok);

// the slot rule is enforced, not merely stated
const wrongSlot = { prompt_prefix: ["subject_definitions:"],
  shots: [{ id: "a", prompt: ["@shahzaib (S1), flatly:", "", "<d>[English] no.</d>"] }] };
check("a character speaking in someone else's slot is an ERROR",
      !S.validate(wrongSlot, RICH).ok
      && S.validate(wrongSlot, RICH).errors.some((e) => /assigned \(S2\)/.test(e)),
      S.validate(wrongSlot, RICH).errors);
const rightSlot = JSON.parse(JSON.stringify(wrongSlot));
rightSlot.shots[0].prompt[0] = "@shahzaib (S2), flatly:";
check("...and the right slot is accepted", S.validate(rightSlot, RICH).ok,
      S.validate(rightSlot, RICH).errors);
check("the guide tells the model the slots rather than letting it choose",
      /@jinx = \(S1\)/.test(S.guide(RICH)) && /ASSIGNED, not yours to choose/.test(S.guide(RICH)));
check("the guide tells the model NOT to write the character paragraphs itself",
      /Do NOT write prompt_prefix character paragraphs/.test(S.guide(RICH)));

// ---- normalize and write ------------------------------------------------
const n = S.normalize({ prompt_prefix: ["subject_definitions:"],
                        shots: [{ prompt: ["a."] }, { prompt: ["b."] }] });
check("normalize fills the ids, the settings and the chain between shots",
      n.shots[0].id === "clip_01" && n.shots[1].visual_context_source === "clip_01"
      && n.shots[0].continuation_mode === S.DEFAULTS.continuation_mode, n.shots);
check("the FIRST shot never continues from anything",
      !("visual_context_source" in n.shots[0]));
check("a missing seed is filled, and every seed is a string of digits",
      n.shots.every((s) => typeof s.seed === "string" && /^\d{19}$/.test(s.seed)), n.shots.map(s => s.seed));
// 2.296.0: de-flaked - a TRUE random seed ends in 0000 one time in 10,000
// (the gate hit it once); a ROUNDED one ends in zeros every time, so over
// 40 fresh seeds at most one may, and none may repeat
const many = S.normalize({ prompt_prefix: ["subject_definitions:"],
  shots: Array.from({ length: 40 }, (_, i) => ({ prompt: ["s" + i + "."] })) }).shots.map((s) => s.seed);
check("a generated seed is NOT rounded (Math.random()*9e18 loses the low digits)",
      many.filter((x) => /0{4}$/.test(x)).length <= 1 && new Set(many).size === many.length
      && n.shots[0].seed !== n.shots[1].seed, many.slice(0, 6));

const w = S.writePlan(graph, good);
check("writePlan puts the plan into the ChainPlan node as JSON text",
      w.wrote === 1
      && JSON.parse(Object.values(w.graph).find((x) => x.class_type === S.PLAN_NODE)
           .inputs.plan_json).shots.length === 2);
check("writePlan does not mutate the graph it was handed",
      JSON.parse(Object.values(graph).find((x) => x.class_type === S.PLAN_NODE)
        .inputs.plan_json).shots.length === realPlan.shots.length);
check("a workflow with no plan node is reported, not silently skipped",
      S.writePlan({ "1": { class_type: "X", inputs: {} } }, good).notes
        .some((x) => /nowhere to put a screenplay/.test(x)));
// ---- THE 5.9-SECOND STOMP + the pack's own fallback (2.178.0, Tim: ------
// "it only renders a 5 second scene even when i set the duration to 15")
{
  const wg = { "9": { class_type: S.PLAN_NODE,
                      inputs: { plan_json: "{}", default_duration_seconds: 5 } } };
  const p = { shots: [{ id: "c1", prompt: ["a"] }, { id: "c2", prompt: ["b"] }] };
  const out = S.writePlan(wg, p, { length: 360 });
  const pj = JSON.parse(out.graph["9"].inputs.plan_json);
  check("writePlan HONOURS the chain override — 15s + the 2.223.5 ladder (scene N gets +(N−1)s, snapped UP)",
        (() => { const up = (n) => Math.min(3592, Math.max(S.snapLength(n), 5 + 17 * Math.ceil((Math.min(3592, n) - 5) / 17)));
                 return pj.shots[0].length === 362
                     && pj.shots.slice(1).every((s, k) => s.length === up(362 + (k + 1) * 24)); })(),
        pj.shots.map((s) => s.length));
  check("an override-less writePlan still answers the export default (+ the ladder on continuing scenes)",
        (() => { const q = JSON.parse(S.writePlan(wg, p).graph["9"].inputs.plan_json).shots;
                 const up = (n) => Math.min(3592, Math.max(S.snapLength(n), 5 + 17 * Math.ceil((Math.min(3592, n) - 5) / 17)));
                 return q[0].length === S.DEFAULTS.length
                     && q[1].length === up(S.DEFAULTS.length + 24); })());
  check("the ChainPlan default_duration_seconds widget follows the plan's uniform length, noted",
        out.graph["9"].inputs.default_duration_seconds === Math.round(362 / 24 * 100) / 100
        && out.notes.some((x) => /default_duration_seconds 5 -> 15.08/.test(x)), out.notes);
  const bare = S.writePlan({ "9": { class_type: S.PLAN_NODE,
                                    inputs: { plan_json: "{}" } } }, p, { length: 360 });
  check("a ChainPlan WITHOUT the widget is left alone — never invent a widget",
        !("default_duration_seconds" in bare.graph["9"].inputs) && bare.notes.length === 0);
  const linked = S.writePlan({ "9": { class_type: S.PLAN_NODE,
      inputs: { plan_json: "{}", default_duration_seconds: ["7", 0] } } }, p, { length: 360 });
  check("a LINKED duration widget is never overwritten — wires are the export's truth",
        Array.isArray(linked.graph["9"].inputs.default_duration_seconds));
}

// ---- parsing what a model actually sends back ---------------------------
check("a reply wrapped in a code fence is still parsed",
      (S.parseReply('```json\n{"shots":[1]}\n```') || {}).shots.length === 1);
check("a reply with chatter around the JSON is still parsed",
      (S.parseReply('Sure! {"shots":[1,2]} Hope that helps.') || {}).shots.length === 2);
check("a reply with no JSON at all returns null rather than throwing",
      S.parseReply("I cannot do that") === null && S.parseReply("") === null);


// ---- parseReply against what local models REALLY send (2.142.3) ----------
// The 2.137-era parser took "first { to last }" in one JSON.parse — real
// llama-server replies wear think-blocks with braces inside, fences, prose,
// trailing commas, and token-budget truncation.
{
  const P = S.parseReply, W = S.parseProblem;
  const plan = '{"prompt_prefix":["subject_definitions:"],"shots":[{"id":"clip_01","prompt":["[Shot 1] x"],"length":39}]}';
  check("plain JSON parses", P(plan) && P(plan).shots.length === 1);
  check("json fences are stripped", P("```json\n" + plan + "\n```") !== null);
  check("any-language fences are stripped", P("```javascript\n" + plan + "\n```") !== null);
  check("prose around the object is ignored",
        P("Here is your plan:\n" + plan + "\nEnjoy!") !== null);
  check("a think block CONTAINING BRACES does not poison the extraction",
        (() => { const p = P("<think>the shape is { \"shots\": [...] } I think</think>\n" + plan);
                 return p && Array.isArray(p.shots) && p.shots[0].id === "clip_01"; })());
  check("an UNCLOSED think block truncates the reply (same rule as the chat)",
        P("<think>still reasoning about " + plan) === null);
  check("trailing commas from small models are salvaged",
        (() => { const p = P('{"prompt_prefix":["a",],"shots":[{"id":"c1","prompt":["x",],"length":39,},]}');
                 return p && p.shots.length === 1; })());
  check("when several objects appear, the one WITH shots wins",
        (() => { const p = P('{"note":"ignore me"} then ' + plan);
                 return p && Array.isArray(p.shots); })());
  check("a reply cut off mid-JSON returns null…",
        P(plan.slice(0, plan.length - 20)) === null);
  check("…and parseProblem says it was cut off (points at the token budget)",
        /cut off/.test(W(plan.slice(0, plan.length - 20)) || ""), W(plan.slice(0, 40)));
  check("no JSON at all is reported as such",
        /no JSON object/.test(W("I cannot write that.") || ""));
  check("braces inside STRINGS do not fool the balance scanner",
        (() => { const s = '{"prompt_prefix":["a { b } c"],"shots":[{"id":"c1","prompt":["say \\"{ hi }\\""],"length":39}]}';
                 const p = P(s); return p && p.shots[0].prompt[0].indexOf("{ hi }") >= 0; })());
}


// ---- normalize repairs beat spacing (2.142.4) ----------------------------
{
  const n1 = S.normalize({ shots: [{ id: "c1",
    prompt: ["[Shot 1] a.", "b happens.", "@jinx (S1), softly:", "<d>[English] hi</d>", "c."] }] });
  check("normalize inserts the blank lines the model forgot",
        JSON.stringify(n1.shots[0].prompt) ===
        JSON.stringify(["[Shot 1] a.", "", "b happens.", "", "@jinx (S1), softly:",
                        "<d>[English] hi</d>", "", "c."]));
  check("a speaker line and its <d> dialogue stay GLUED — one beat, one voice",
        n1.shots[0].prompt.indexOf("<d>[English] hi</d>")
          === n1.shots[0].prompt.indexOf("@jinx (S1), softly:") + 1);
  const spacedIn = ["[Shot 1] a.", "", "b."];
  check("an already-spaced prompt passes through unchanged",
        JSON.stringify(S.normalize({ shots: [{ id: "c1", prompt: spacedIn }] }).shots[0].prompt)
          === JSON.stringify(spacedIn));
  check("runs of blanks collapse to one, and trailing blanks are dropped",
        JSON.stringify(S.normalize({ shots: [{ id: "c1", prompt: ["a.", "", "", "b.", ""] }] })
          .shots[0].prompt) === JSON.stringify(["a.", "", "b."]));
  check("the repaired plan validates with NO blank-line warnings",
        S.validate(S.normalize({ prompt_prefix: ["subject_definitions:"], shots: [{ id: "c1",
          prompt: ["[Shot 1] a.", "b.", "c."], length: 39 }] }),
          [{ name: "Jinx", tag: "jinx" }]).warnings
          .filter((w) => /blank lines/.test(w)).length === 0);
}


// ---- bare [Shot N] markers (2.142.5) -------------------------------------
{
  const g = S.normalize({ shots: [{ id: "c1", prompt: ["[Shot 1]", "", "@j runs."] }] });
  check("a bare [Shot N] line glues to the next action — the marker is a prefix",
        g.shots[0].prompt[0] === "[Shot 1] @j runs.");
  const v = S.validate({ prompt_prefix: ["subject_definitions:"],
    shots: [{ id: "c1", prompt: ["[Shot 1]"], length: 39 }] }, [{ name: "J", tag: "j" }]);
  check("a shot that is ONLY a marker is refused by name — an empty scene burns the queue",
        v.ok === false && v.errors.some((e) => /only a "\[Shot N\]" marker/.test(e)));
}

// ---- chain settings overrides (2.150.0, "allow user to change all the
// workflow settings") — normalize's second argument, fed from config.chain.
{
  const ov = { steps: "30", length: "", context_length: 44,
               continuation_mode: "hold", bogus_key: "x" };
  const n = S.normalize({ shots: [{ prompt: ["a"] }, { prompt: ["b"], steps: 9 }] }, ov);
  check("overrides fill what a shot does not say (steps 30; ctx 44 SNAPS to 39 — "
        + "2.189.0: a user's 44 dies at ChainPlan exactly like a model's)",
        n.shots[0].steps === 30 && n.shots[0].context_length === 39
        && n.shots[0].continuation_mode === "hold",
        n.shots[0]);
  check("a shot's OWN value beats the override (the plan stays the truth)",
        n.shots[1].steps === 9);
  check("an empty override means the export's default, and unknown keys are dropped",
        n.shots[0].length === S.DEFAULTS.length && !("bogus_key" in n.shots[0]),
        { length: n.shots[0].length });
  check("no overrides at all is exactly the old behavior",
        S.normalize({ shots: [{ prompt: ["a"] }] }).shots[0].steps === S.DEFAULTS.steps);
  check("the guide teaches <Picture N> steering with the chain's own numbering",
        /<Picture N>/.test(S.guide(CAST)) && /numbered in cast order/.test(S.guide(CAST)));
}

// ---- the [Language] repair (2.155.0, supergemma4's exact miss) -------------
// The card read: '"@joan (S1), softly and with a smile:" is a speaker line
// but the next beat is not <d>[Language] ...</d>' + 'malformed dialogue
// line "<d>Just you and me, old friend.</d>"'. Both errors are ONE missing
// tag — a spelling, not a creative choice — so normalize inserts it and the
// plan Tim pasted must now validate.
{
  const cast2 = [{ name: "Joan", tag: "joan", slot: "S1",
                   images: ["s.png"], voices: ["v.wav"] }];
  const tn = S.normalize({ prompt_prefix: ["subject_definitions:"], shots: [
    { prompt: ["[Shot 1] @joan enters."] },
    { prompt: ["[Shot 2] @joan sits.", "",
               "@joan (S1), softly and with a smile:",
               "<d>Just you and me, old friend.</d>"] }] });
  check("an untagged <d> line gains [English] when the plan has no other language",
        tn.shots[1].prompt.some((l) => l === "<d>[English] Just you and me, old friend.</d>"),
        tn.shots[1].prompt);
  const tv = S.validate(tn, cast2, []);
  check("Tim's exact failing pair VALIDATES after the repair (both errors were one tag)",
        tv.ok === true, tv.errors);
  const tn2 = S.normalize({ shots: [
    { prompt: ["@joan (S1):", "<d>[Spanish] Hola.</d>", "",
               "@joan (S1):", "<d>Otra vez.</d>"] }] });
  check("the inserted tag is the plan's own dominant language, not always English",
        tn2.shots[0].prompt.some((l) => l === "<d>[Spanish] Otra vez.</d>"),
        tn2.shots[0].prompt);
  check("a correctly tagged line passes through untouched",
        tn2.shots[0].prompt.some((l) => l === "<d>[Spanish] Hola.</d>"));
  check("a <d> line that never closes is NOT rewritten (that is a different error)",
        S.normalize({ shots: [{ prompt: ["<d>half a line"] }] })
          .shots[0].prompt[0] === "<d>half a line");
}

// ---- H3-valid lengths (2.156.0, the pack's own words) ----------------------
// Tim's node, verbatim: "Shot 1 length must be an H3-valid frame length
// between 5 and 3592 with length % 17 == 5; got 360." — so the rule is
// VERIFIED, and every length is snapped to it instead of dying at preflight.
{
  check("snapLength: Tim's exact failure (15s -> 360) snaps to 362",
        S.snapLength(360) === 362, S.snapLength(360));
  check("snapLength: already-valid export lengths pass through untouched",
        S.snapLength(141) === 141 && S.snapLength(158) === 158
        && S.snapLength(22) === 22 && S.snapLength(39) === 39);
  check("snapLength: the bounds hold at both ends",
        S.snapLength(1) === 5 && S.snapLength(4) === 5
        && S.snapLength(3592) === 3592 && S.snapLength(99999) === 3592);
  check("snapLength: every answer satisfies the pack's rule",
        [0, 7, 100, 360, 1000, 3591, 5000].every((v) => {
          const l = S.snapLength(v); return l >= 5 && l <= 3592 && l % 17 === 5; }));
  check("snapLength: garbage answers the export default",
        S.snapLength("x") === S.DEFAULTS.length && S.snapLength(undefined) === S.DEFAULTS.length);
  // 2.171.0: per-shot lengths are IGNORED — one uniform duration for every
  // scene ("the workflow doesn't like scenes of different lengths")
  check("normalize REPLACES a model's per-shot length with the one default",
        S.normalize({ shots: [{ prompt: ["a"], length: 360 }] })
          .shots[0].length === S.DEFAULTS.length);
  check("normalize UNIFIES mixed lengths to ONE content duration (10s*24=240 -> 243; continuing scenes climb the ladder)",
        (() => { const n = S.normalize({ shots: [
                   { prompt: ["a"], length: 39 },
                   { prompt: ["b"], length: 500 }] }, { length: 240 });
                 const up = (n) => Math.min(3592, Math.max(S.snapLength(n), 5 + 17 * Math.ceil((Math.min(3592, n) - 5) / 17)));
                 return n.shots[0].length === 243
                     && n.shots[1].length === up(243 + 24); })());
  // ---- source_reference is an ENUM (2.173.0, the pack's verbatim refusal:
  // "Unknown H3 scene source reference override 'clip_01'; expected inherit
  // or one of ('off', 'on').") ------------------------------------------
  check("a shot-id in source_reference MIGRATES to visual_context_source and resets to the default",
        (() => { const n = S.normalize({ shots: [
                   { id: "clip_01", prompt: ["a"] },
                   { id: "clip_02", prompt: ["b"], source_reference: "clip_01" }] });
                 const s = n.shots[1];
                 return s.source_reference === S.DEFAULTS.source_reference
                     && s.visual_context_source === "clip_01"; })());
  check("valid enum values (on/inherit) pass through untouched",
        (() => { const n = S.normalize({ shots: [
                   { prompt: ["a"], source_reference: "inherit" },
                   { prompt: ["b"], source_reference: "on" }] });
                 return n.shots[0].source_reference === "inherit"
                     && n.shots[1].source_reference === "on"; })());
  check("junk that names NO earlier shot resets to the default without inventing continuity",
        (() => { const n = S.normalize({ shots: [
                   { id: "c1", prompt: ["a"], source_reference: "banana" }] });
                 return n.shots[0].source_reference === S.DEFAULTS.source_reference
                     && n.shots[0].visual_context_source === undefined; })());
  check("an existing visual_context_source is NOT overwritten by the migration",
        (() => { const n = S.normalize({ shots: [
                   { id: "c1", prompt: ["a"] }, { id: "c2", prompt: ["b"] },
                   { id: "c3", prompt: ["c"], source_reference: "c1",
                     visual_context_source: "c2" }] });
                 return n.shots[2].visual_context_source === "c2"
                     && n.shots[2].source_reference === S.DEFAULTS.source_reference; })());
  check("an invalid chain-tab override falls back to the default instead of poisoning every shot",
        (() => { const n = S.normalize({ shots: [{ prompt: ["a"] }] },
                                       { source_reference: "clip_01" });
                 return n.shots[0].source_reference === S.DEFAULTS.source_reference; })());
  check("a model-copied seed PLACEHOLDER is re-minted to real digits (the int() card)",
      (() => { const n=S.normalize({shots:[{prompt:["a"],seed:"<digits as a STRING>"}]});
               return /^\d+$/.test(n.shots[0].seed); })());
check("non-numeric steps fall back to the default; numeric strings coerce",
      (() => { const n=S.normalize({shots:[{prompt:["a"],steps:"<int>"},
                                           {prompt:["b"],steps:"30"}]});
               return n.shots[0].steps===S.DEFAULTS.steps && n.shots[1].steps===30; })());
// ---- context lengths on the pack's lattice (2.189.0, ChainPlan's card) ----
// "Shot 3: H3 scene context length must be 0 or one of (1, 5, 22, 39, 56,
// 73, 90, 107, 124, 141, 158, 175, 192, 209, 226, 243)." — a finite but
// invalid value (a model's 24, 100...) rode through the 2.185.0 Number
// coercion and died at node 9. Snapped to the nearest valid value now.
check("a finite-but-invalid context_length is SNAPPED to the pack's set (24 -> 22, 100 -> 107; continuing shots — shot 1's orphan window is zeroed by 2.223.3)",
      (() => { const n=S.normalize({shots:[{prompt:["z"]},
                                           {prompt:["a"],context_length:24},
                                           {prompt:["b"],context_length:100}]});
               return n.shots[0].context_length===0
                   && n.shots[1].context_length===22 && n.shots[2].context_length===107; })());
check("audio_context_length snaps too; 0, 1 and set members pass unchanged; huge clamps to 243 (continuing shots)",
      (() => { const n=S.normalize({shots:[{prompt:["z"]},
                                           {prompt:["a"],audio_context_length:20,
                                            context_length:0},
                                           {prompt:["b"],context_length:1,
                                            audio_context_length:999},
                                           {prompt:["c"],context_length:158}]});
               return n.shots[1].audio_context_length===22 && n.shots[1].context_length===0
                   && n.shots[2].context_length===1 && n.shots[2].audio_context_length===243
                   && n.shots[3].context_length===158; })());
check("garbage context_length still answers the export default, negative snaps to 0",
      (() => { const n=S.normalize({shots:[{prompt:["z"]},
                                           {prompt:["a"],context_length:"<int>"},
                                           {prompt:["b"],context_length:-9}]});
               n.shots.shift();
               return n.shots[0].context_length===S.DEFAULTS.context_length
                   && n.shots[1].context_length===0; })());
check("the guide teaches the context lattice (rule 7b)",
      /17k\+5, capped at 243/.test(S.guide([])));
// ---- the iterative writer's helpers (2.182.0, Tim's own design) --------
check("sceneCount reads the brief's scene count ('an 8 scene film' -> 8, none -> 0)",
      S.sceneCount("make me an 8 scene film about a heist") === 8
      && S.sceneCount("write 3 scenes") === 3 && S.sceneCount("a story") === 0
      && S.sceneCount("0 scenes") === 0);
check("sceneDigest keeps the NEWEST scenes under a tight budget and says what it dropped",
      (() => { const shots=[{id:"c1",prompt:["a".repeat(120)]},
                            {id:"c2",prompt:["the vault opens"]}];
               const d=S.sceneDigest(shots, 80);
               return /the vault opens/.test(d) && /omitted for space/.test(d)
                   && !/aaaa/.test(d); })());
check("sceneDigest flattens whitespace so one scene is one line",
      !/\n\n/.test(S.sceneDigest([{id:"c1",prompt:["x","","y"]}], 500)));
check("the guide teaches the switch: never a shot id, continuity goes in visual_context_source",
        /never a shot id/.test(S.guide([])));
  check("the guide teaches the rule so models write valid lengths first time",
        /length % 17 == 5/.test(S.guide([])));
}

// ---- chat intents: add / edit a scene (2.162.0, by instruction) ------------
{
  check("'add a scene where joan opens the vault' is an ADD with its description",
        JSON.stringify(S.wantsAddScene("add a scene where joan opens the vault"))
          === '{"description":"where joan opens the vault"}');
  check("'new scene' alone is an ADD with an empty description (the placeholder)",
        JSON.stringify(S.wantsAddScene("new scene")) === '{"description":""}'
        && JSON.stringify(S.wantsAddScene("Add another scene: the chase begins"))
          === '{"description":"the chase begins"}');
  check("a QUESTION about scenes is chat, not an add",
        S.wantsAddScene("can you add a scene?") === null
        && S.wantsAddScene("how do I add a scene") === null);
  check("'edit scene 2 make it more realistic' is an EDIT with n and instruction",
        JSON.stringify(S.wantsEditScene("edit scene 2 make it more realistic"))
          === '{"n":2,"instruction":"make it more realistic"}'
        && S.wantsEditScene("Change scene 3: joan smiles").n === 3);
  check("'redo scene 2' is NOT an edit — on the board redo means re-render",
        S.wantsEditScene("redo scene 2") === null);
  check("a bare 'edit scene 2' still matches, with an empty instruction (the route asks)",
        JSON.stringify(S.wantsEditScene("edit scene 2")) === '{"n":2,"instruction":""}');
  check("edit outranks add outranks screenplay — the words do not collide",
        S.wantsEditScene("edit scene 1 add more tension") !== null
        && S.wantsAddScene("edit scene 1 add more tension") === null
        && !S.wantsScreenplay("add a scene about the heist"));
}

// ---- type-aware subject definitions (2.166.0, by instruction) --------------
{
  const veh = { name: "Kitt", tag: "kitt", type: "vehicle", subtype: "sports car",
                color: "black", model: "Trans Am", year: "1982",
                notes: "red scanner light", images: ["a.png"], voices: [] };
  const ani = { name: "Rex", tag: "rex", type: "animal", subtype: "dog",
                breed: "German Shepherd", color: "sable", age: "4",
                pronouns: "he", images: ["a.png"], voices: [] };
  const pv = S.buildPrefix([veh]).join("\n");
  check("a VEHICLE's definition leads with year/color/model and drops the human anatomy",
        /the sports car defined by the provided reference sheet — a 1982 black Trans Am/.test(pv)
        && /body shape, paintwork/.test(pv) && !/bone structure|wardrobe/.test(pv), pv.slice(0, 200));
  const pa = S.buildPrefix([ani]).join("\n");
  check("an ANIMAL's definition speaks breed, color and coat — no wardrobe",
        /the dog defined by the provided reference sheet — a sable German Shepherd/.test(pa)
        && /coat, markings/.test(pa) && !/wardrobe/.test(pa), pa.slice(0, 200));
  check("a PERSON (and any profile without a type) reads exactly as before",
        /bone structure/.test(S.buildPrefix([{ name: "Joan", tag: "joan",
          age: "30", pronouns: "she", images: ["a.png"], voices: [] }]).join("\n")));
}

// ---- the shooting-script style section + clothing (2.168.0) ----------------
{
  const g = S.guide([]);
  check("the guide teaches DENSE CONCRETE writing — named props, active action, era-and-light locations",
        /WRITE LIKE A SHOOTING SCRIPT/.test(g)
        && /named things, never categories/.test(g)
        && /period, weather, light/.test(g)
        && /Ban vague words/.test(g), null);
  const cl = { name: "Jacket", tag: "jacket", type: "clothing",
               subtype: "leather jacket", color: "black",
               notes: "brass zips", images: ["a.png"], voices: [] };
  const pc = S.buildPrefix([cl]).join("\n");
  check("a CLOTHING subject reads as a garment — cut/fabric preserved, no anatomy",
        /the garment defined by the provided reference sheet — a black leather jacket/.test(pc)
        && /cut, fabric, pattern/.test(pc) && !/bone structure|coat, markings/.test(pc),
        pc.slice(0, 200));
}

// ---- reference pictures ride the shared prompt (2.191.0, by instruction) ---
// "put the reference picture name, type, description in the scene board
// (global prompt)" — buildPrefix appends the caller's refParagraphs after
// the voice assignments, before the standing direction.
{
  const cast = [{ name: "Jinx", tag: "jinx", pronouns: "she",
                  images: ["a.png"], voices: [] }];
  const rp = ['Reference picture "picture_1" (@picture_1, pose): a rearing horse.'];
  const p = S.buildPrefix(cast, { refParagraphs: rp });
  const j = p.join("\n");
  check("buildPrefix carries the reference paragraphs (name, type, description)",
        j.includes(rp[0]), j.slice(0, 300));
  check("...placed after the cast, before the standing direction",
        j.indexOf(rp[0]) > j.indexOf("subject_definitions:")
        && j.indexOf(rp[0]) < j.indexOf("Maintain strict spatial"));
  check("...and an absent refParagraphs changes nothing",
        !S.buildPrefix(cast, {}).join("\n").includes("Reference picture"));
}

// ---- reference pictures are the THIRD tag kind (2.194.0, Tim's question) ---
// "can we tell the llm automatically which are character references and the
// other types of references, so it doesn't get confused?" — and validate
// itself was confused: it refused "@jinx posed as @horse_pose", the exact
// steering the 2.183.0 brief invites.
{
  const CAST3 = [{ name: "Jinx", tag: "jinx", slot: "S1", images: ["a.png"], voices: [] }];
  const mk = (line) => S.normalize({ prompt_prefix: ["subject_definitions:", "", "@jinx is defined."],
    shots: [{ id: "clip_01", prompt: [line] }] }, {});
  const steer = mk("[Shot 1] @jinx posed as @horse_pose.");
  check("a reference tag in a prompt line VALIDATES when refTags are passed (the 2.183.0 invitation)",
        S.validate(steer, CAST3, [], ["horse_pose"]).ok,
        S.validate(steer, CAST3, [], ["horse_pose"]).errors);
  check("...and is still refused as an unknown character when they are not (old callers unchanged)",
        !S.validate(steer, CAST3, []).ok);
  const talk = mk("@horse_pose (S2), gravely: say something");
  const vt = S.validate(talk, CAST3, [], ["horse_pose"]);
  check("a reference tag as a SPEAKER is refused with the picture explanation",
        !vt.ok && vt.errors.some((e) => /reference PICTURE — it cannot act or speak/.test(e)),
        vt.errors);
  check("the guide teaches the three tag kinds (only characters act or speak)",
        /Three kinds of tag exist and only the FIRST can act or speak/.test(S.guide(CAST3)));
}

// ---- continuity points backward (2.196.0, ChainPlan's card verbatim) ------
// "visual_context_source for scene 2 must point to an earlier scene, got 4"
{
  const p = { prompt_prefix: ["subject_definitions:", "", "@jinx is defined."],
    shots: [
      { id: "clip_01", prompt: ["a"], visual_context_source: "clip_03" },
      { id: "clip_02", prompt: ["b"], visual_context_source: "clip_04" },
      { id: "clip_03", prompt: ["c"], visual_context_source: "clip_03" },
      { id: "clip_04", prompt: ["d"], visual_context_source: "clip_02" },
      { id: "clip_05", prompt: ["e"], visual_context_source: "nope_99" },
    ] };
  const n = S.normalize(p, {});
  const v = (i) => n.shots[i].visual_context_source;
  check("a FORWARD visual_context_source snaps to the shot before (Tim's scene 2 -> 4)",
        v(1) === "clip_01" && v(2) === "clip_02", n.shots.map((s) => v && s.visual_context_source));
  check("...a self-reference and an unknown id snap the same way",
        n.shots[2].visual_context_source === "clip_02"
        && v(4) === "clip_04", null);
  check("...a legal backward reference is untouched",
        v(3) === "clip_02", v(3));
  check("...and the FIRST shot loses its visual_context_source (nothing is earlier)",
        v(0) === undefined, v(0));
  const CASTV = [{ name: "Jinx", tag: "jinx", slot: "S1", images: ["a.png"], voices: [] }];
  const raw = { prompt_prefix: ["subject_definitions:", "", "@jinx is defined."],
    shots: [{ id: "clip_01", prompt: ["[Shot 1] @jinx waits."] },
            { id: "clip_02", prompt: ["[Shot 2] @jinx turns."],
              visual_context_source: "clip_04" },
            { id: "clip_04", prompt: ["[Shot 3] @jinx runs."] }] };
  const vr = S.validate(raw, CASTV);
  check("validate (backstop) now refuses a forward reference — the old any-id clause is gone",
        !vr.ok && vr.errors.some((e) => /not an earlier shot/.test(e)), vr.errors);
}

console.log("==============================");

// ---- 2.226.0 (Tim verbatim): "Do not invent characters, only use
// characters that exist" — in the guide for every cast shape; plus the
// identity-mod awareness block when a character carries one.
{
  const g1 = S.guide([{ name: "Jinx", tag: "jinx", refmod: "bitgen_jinx" },
                       { name: "Rex", tag: "rex" }]);
  const g0 = S.guide([{ name: "Rex", tag: "rex" }]);
  check("the no-invented-characters rule is in the guide, verbatim and broad (extras included)",
        g1.includes("Do not invent characters, only use characters that exist")
        && /no new named people, no/.test(g1) && /unnamed extras/.test(g1)
        && g0.includes("Do not invent characters, only use characters that exist"));
  check("a modded character is announced with their mod and the never-redescribe rule",
        g1.includes("IDENTITY MOD") && g1.includes("@jinx (mod bitgen_jinx)")
        && /the mod owns those/.test(g1));
  check("a cast without mods gets no mod block (no phantom feature talk)",
        !g0.includes("IDENTITY MOD"));
}


// ---- 2.230.0 (Tim verbatim): "when i ask to create a sceenplay, or
// screenplay of, or make a screenplay, check the global prompt in video
// docker, if it is empty build the prompt, save the prompt and pass it to
// the llm rag" ------------------------------------------------------------
{
  check("the detector matches Tim's three phrasings (his spelling included) and write-a-screenplay",
        S.asksForScreenplay("create a screenplay about pirates")
        && S.asksForScreenplay("make a screenplay")
        && S.asksForScreenplay("a screenplay of the heist, please")
        && S.asksForScreenplay("write me a sceenplay"));
  check("mere mentions never trigger — the ask needs create/make/write or the of-shape",
        !S.asksForScreenplay("that screenplay was great")
        && !S.asksForScreenplay("screenplays are hard")
        && !S.asksForScreenplay("make dinner") && !S.asksForScreenplay(""));
  const RI = fs.readFileSync(path.join(__dirname, "..", "routes", "index.js"), "utf8");
  check("the chat route checks the board's global prompt on a screenplay ask, builds it via buildPrefix WHEN EMPTY, and SAVES it in the shots-less shape",
        RI.includes("screenplayLib.asksForScreenplay(text)")
        && RI.includes("screenplayLib.buildPrefix(charsLib.list(b.project)")
        && RI.includes("refParagraphs: chapterRefsLib.prefixParagraphs(b.project)")
        && RI.includes('plan: { ...(stB.plan || { shots: [] }), prompt_prefix: pfx }'));
  check("the prompt rides the chat's system context (the recall-built stack is the llm rag), existing content untouched",
        RI.includes("THE BOARD'S GLOBAL PROMPT")
        && RI.includes("pfx.some((l) => String(l).trim())"));
}

console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);
