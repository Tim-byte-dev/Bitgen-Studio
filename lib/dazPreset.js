// bitGen Studio — lib/dazPreset.js (2.983.0): a Daz POSE or SHAPE preset read for a character in the Sketcher (DAZ Tools).
// Tim: "when the character is selected, other daz assets can be used on that character, like hair, clothes, genitals, shoes,
// poses etc". NOT A REPLACEMENT FOR DAZ STUDIO - light tasks.
//   parsePose(json) -> {pose {bone: {x, y, z}} (degrees - the bones' own channels, as 🕺 Pose uses), hips [x, y, z] | null, n}
//                      scene.animations [{url "name://@selection/lShldrBend:?rotation/z/value", keys [[t, v]]}] (the last
//                      key's value; "#bone" and "/bone" both; the figure's own (no bone) translation = the hips' move)
//   parseShape(json) -> [{url, value}]  scene.modifiers' values (a shape / character preset's dials)
"use strict";
const URL_RX = /@selection(?:[/#]([^:?/#]+))?:?\?(rotation|translation)\/([xyz])\/value/;
function lastKey(a) { const k = Array.isArray(a && a.keys) ? a.keys[a.keys.length - 1] : null; const v = Array.isArray(k) ? +k[1] : NaN; return isFinite(v) ? v : null; }
function parsePose(j) {
  const pose = {}, hips = [0, 0, 0]; let n = 0, moved = false;
  for (const a of ((j && j.scene) || {}).animations || []) {
    const m = URL_RX.exec(decodeURIComponent(String(a && a.url || ""))); if (!m) continue;
    const v = lastKey(a); if (v == null) continue;
    const bone = m[1] || "", kind = m[2], ax = m[3];
    if (kind === "rotation" && bone) { (pose[bone] = pose[bone] || { x: 0, y: 0, z: 0 })[ax] = v; n++; }
    else if (kind === "translation" && (!bone || /^hip$/i.test(bone))) { hips["xyz".indexOf(ax)] += v; moved = moved || !!v; }
  }
  return { pose, hips: moved ? hips : null, n };
}
function parseShape(j) {
  const out = [];
  for (const m of ((j && j.scene) || {}).modifiers || []) {
    const ch = m && m.channel, v = ch && (ch.current_value != null ? ch.current_value : ch.value);
    if (m && m.url && isFinite(+v)) out.push({ url: String(m.url), value: +v });
  }
  return out;
}
module.exports = { parsePose, parseShape, URL_RX };
