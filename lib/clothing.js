"use strict";
/**
 * CLOTHING (2.224.0, by instruction): "add a tab to the create character and
 * edit character tabs for clothing, this will accept images of clothing or
 * character sheet with the character wearing the clothing - type, color, etc.
 * user can enter multiple types of clothing" — and the selection rule, Tim
 * verbatim: "only when the scenes chapter mentions the clothing type, but
 * carry over the clothing type from the previous scene unless instructed by
 * the prompt."
 *
 * That rule is STATEFUL across the board, so it lives here as a pure
 * resolver over the PLAN (THE PLAN IS THE TRUTH — nothing is stored per
 * scene; editing a scene's prompt re-resolves every scene after it):
 *
 *   scene n mentions an entry's type  -> that entry rides scene n, and the
 *                                        mentioned set REPLACES the carried
 *                                        set from scene n forward (the
 *                                        mention IS the instruction)
 *   scene n mentions nothing          -> scene n inherits scene n-1's set
 *                                        unchanged (continuity — the
 *                                        character stays dressed)
 *   scene 1 with no mention           -> no clothing references
 *
 * Matching is per CHARACTER (each cast member's prompts are matched against
 * their OWN entries — two characters may both own a "jacket"), whole-word,
 * case-insensitive, and multi-word types match as a phrase ("leather
 * jacket"). The storage half — the dataset folder, the profile manifest —
 * lives in lib/characters.js; this file never touches the filesystem.
 */

/** The type as a stable tag fragment (the pack's tag rules: letters,
 *  digits, _ and - only — worker._patch_workflow enforces the same). */
function slugType(t) {
  return String(t || "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "clothing";
}

/** Does `text` mention `type` as a whole word / phrase? Case-insensitive;
 *  internal whitespace in the type matches any run of whitespace, so
 *  "leather  jacket" in a prompt still hits a "leather jacket" entry. */
function mentions(text, type) {
  const t = String(type || "").trim();
  if (!t) return false;
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp("(^|[^A-Za-z0-9])" + esc + "([^A-Za-z0-9]|$)", "i")
    .test(String(text || ""));
}

/** The searchable text of one shot — its prompt lines joined. */
function shotText(shot) {
  const p = (shot || {}).prompt;
  return (Array.isArray(p) ? p : [p]).filter(Boolean).join("\n");
}

/**
 * Resolve ONE character's active clothing across the whole board.
 * `shots` = plan.shots in order; `entries` = the character's clothing
 * manifest [{file, type, ...}]. Returns an array the same length as
 * `shots`: active entries per shot (possibly []).
 */
function resolveActive(shots, entries) {
  const es = (entries || []).filter((e) => e && e.file && e.type);
  let carried = [];
  return (shots || []).map((s) => {
    const text = shotText(s);
    const named = es.filter((e) => mentions(text, e.type));
    if (named.length) carried = named;      // the mention IS the instruction
    return carried.slice();
  });
}

/**
 * The QUEUE view: everything active at scene `sceneN` (1-based board
 * number = plan.shots index + 1), across the whole cast. Returns
 * [{char, tag, type, file, entry}] in cast order, entries in manifest
 * order — a deterministic walk both the chain builder and the upload
 * list can spell identically. `tagOf(name)` is passed in so this file
 * needs no require on lib/characters (which requires nothing back —
 * but the tag rule lives there and must not be duplicated).
 */
function forScene(plan, sceneN, cast, tagOf) {
  const shots = (plan || {}).shots || [];
  const i = (parseInt(sceneN, 10) || 0) - 1;
  if (i < 0 || i >= shots.length) return [];
  const out = [];
  for (const c of (cast || [])) {
    const entries = (c && c.clothing) || [];
    if (!entries.length) continue;
    const active = resolveActive(shots, entries)[i] || [];
    for (const e of active)
      out.push({ char: c.name, tag: tagOf(c.tag || c.name) + "_" + slugType(e.type),
                 type: e.type, file: e.file, entry: e });
  }
  return out;
}

module.exports = { slugType, mentions, shotText, resolveActive, forScene };
