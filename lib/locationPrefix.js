// bitGen Studio — THE LOCATIONS IN THE GLOBAL PROMPT (2.299.0).
//
// Tim (verbatim): "add location tag to global prompt if location is set".
//
// The board's global (shared) prompt - plan.prompt_prefix, the 💾/👥
// textarea at the top of the scene board - named the cast (subject
// definitions, voice slots) and the reference pictures, but never the
// locations: a scene set at @pier only knew the place if its own line said
// so, and the writer never saw the location's tag in the standing notes.
//
// A location is SET when it has its picture (a 360 pano, or its extracted
// view). Every set location gets one line in a "location_definitions:"
// paragraph of the global prompt. The block is OURS: it is rebuilt whole
// on every location change (saved, pano set, removed), so a renamed or
// removed location never leaves a stale @tag behind (validate() would
// refuse a plan naming a tag that no longer exists). Everything else in
// the prompt - the user's own edits included - is left exactly as it is.
//   lines(envs)          -> the block's lines ([] when no location is set)
//   apply(prefix, envs)  -> the prefix with the block rebuilt in place
//                           (new block: after the voice assignments, else
//                           after the subject definitions, else on top)
//   sync(project, deps)  -> (a saved, non-empty prompt only - an empty one
//                           is built whole by screenplay.buildPrefix, which
//                           takes lines() as opts.locations) writes it to
//                           the board through the SAME
//                           normalize -> validate -> fromPlan gate as
//                           POST /api/scenes/prefix; {changed, note|error}
"use strict";

const HEAD = "location_definitions:";

/** A location is set when it has its picture. */
function isSet(e) { return !!(e && e.tag && (e.pano || e.view)); }

function line(e) {
  const scope = String(e.scenes || "all").trim();
  return `@${e.tag} is the location "${e.name}" defined by the provided 360° `
    + "view picture - keep its layout, surfaces, props and light the same in "
    + "every scene set there"
    + (scope && scope !== "all" ? ` (scenes ${scope})` : "") + ".";
}

function lines(envs) {
  const set = (envs || []).filter(isSet);
  if (!set.length) return [];
  return [HEAD].concat(set.map(line));
}

/** Split into paragraphs (runs of non-blank lines). */
function paragraphs(prefix) {
  const out = [];
  let cur = null;
  for (const l of (prefix || []).map(String)) {
    if (!l.trim()) { cur = null; continue; }
    if (!cur) { cur = []; out.push(cur); }
    cur.push(l);
  }
  return out;
}

function join(paras) {
  const out = [];
  for (const p of paras) { if (out.length) out.push(""); out.push(...p); }
  return out;
}

/** The prefix with the location block rebuilt (added, refreshed or removed). */
function apply(prefix, envs) {
  const block = lines(envs);
  const paras = paragraphs(prefix);
  const at = paras.findIndex((p) => p[0].trim() === HEAD);
  if (at >= 0) {
    if (block.length) paras.splice(at, 1, block); else paras.splice(at, 1);
    return join(paras);
  }
  if (!block.length) return (prefix || []).map(String);
  let pos = paras.findIndex((p) => /^voice_assignments:/.test(p[0].trim()));
  if (pos >= 0) pos += 1;
  else {
    const sd = paras.findIndex((p) => p[0].trim() === "subject_definitions:");
    if (sd >= 0) {
      pos = sd + 1;
      while (pos < paras.length && /^@/.test(paras[pos][0].trim())) pos++;
    } else pos = 0;
  }
  paras.splice(pos, 0, block);
  return join(paras);
}

const same = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);

/** Rebuild the board's location block. deps = {scenes, screenplay, chars,
 *  envs, chapterRefs} (the route's own modules - one gate, never a copy). */
function sync(project, deps) {
  const { scenes, screenplay, chars, envs, chapterRefs } = deps;
  const st = scenes.load(project);
  const before = ((st.plan || {}).prompt_prefix) || [];
  // an EMPTY global prompt stays empty: it is built whole (cast + these
  // locations, screenplay.buildPrefix) the first time it is needed, so a
  // location set first never freezes a prompt that lacks the cast
  if (!before.some((l) => String(l).trim())) return { changed: false };
  const after = apply(before, envs.list(project));
  if (same(before, after)) return { changed: false };
  const plan = { ...(st.plan || { shots: [] }), prompt_prefix: after };
  if ((plan.shots || []).length) {
    const norm = screenplay.normalize(plan, scenes.chainOverrides(project));
    const v = screenplay.validate(norm, chars.cast(project), envs.list(project),
                                  chapterRefs.tags(project));
    if (!v.ok) return { changed: false, error: "the global prompt keeps its old "
      + "locations - the new ones would break the plan: " + (v.errors || []).join("; ") };
    scenes.save(scenes.fromPlan(norm, st), project);
  } else scenes.save({ ...st, plan }, project);
  const n = lines(envs.list(project)).length - 1;
  return { changed: true, note: n > 0
    ? `the global prompt names ${n} location(s) by @tag`
    : "the global prompt no longer names a location" };
}

module.exports = { HEAD, isSet, line, lines, apply, sync };
