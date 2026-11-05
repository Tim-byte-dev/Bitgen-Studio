// bitGen Studio — lib/modelSettings.js (2.680.0): THE PROMPT DOCKER'S ⇄ - the current and the previous settings of each
// model type (image / video style), kept in <app>/model_settings.tmp.
//
// Tim (verbatim): "add a toggle button next to each model type dropdown in prompt docker so user can toggle between current
// settings for the model type and previous settings - if the settings have overide checked use overide settings including
// any temporary loras, save the settings in a file model_settings.tmp ."
// A setting = {style, name, ovr, fields {id: value}, loras [{path, weight}], at} - fields + loras only when Override
// style was on (Basic Settings' values then rode the render). static/modelswap.js takes them and puts them back.
//   read()            -> {image: {cur, prev}, video: {cur, prev}}   (a missing / bad file = empty)
// 2.683.0: style "" (no style - the dropdown's "— none —" / "— template —") is kept; no style string = none.
//   write(o)          the file (cleaned)                            clean(o) -> the same shape, bounded
"use strict";
const fs = require("fs");
const path = require("path");

const KINDS = ["image", "video"];
const file = () => path.join(require("./core").BASE, "model_settings.tmp");
const str = (v, n) => (typeof v === "string" ? v.slice(0, n || 300) : "");
function cleanOne(s) {
  if (!s || typeof s !== "object" || typeof s.style !== "string") return null;   // 2.683.0: "" = "— none —" / "— template —" is a setting too
  const fields = {};
  if (s.fields && typeof s.fields === "object") Object.keys(s.fields).slice(0, 200).forEach((k) => {
    const v = s.fields[k]; if (!/^[A-Za-z][\w-]{0,60}$/.test(k)) return;
    if (typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))) fields[k] = v; else if (typeof v === "string") fields[k] = v.slice(0, 2000);
  });
  const loras = (Array.isArray(s.loras) ? s.loras : []).slice(0, 20).map((l) => ({ path: str(l && l.path, 400), weight: Number.isFinite(+(l && l.weight)) ? +l.weight : 1 })).filter((l) => l.path);
  return { style: str(s.style, 200), name: str(s.name, 200), ovr: !!s.ovr, fields: s.ovr ? fields : {}, loras: s.ovr ? loras : [], at: Number.isFinite(+s.at) ? +s.at : 0 };
}
function clean(o) {
  const out = {};
  KINDS.forEach((k) => { const e = (o && o[k]) || {}; out[k] = { cur: cleanOne(e.cur), prev: cleanOne(e.prev) }; });
  return out;
}
function read() { try { return clean(JSON.parse(fs.readFileSync(file(), "utf8"))); } catch { return clean({}); } }
function write(o) { const c = clean(o); fs.writeFileSync(file(), JSON.stringify(c, null, 1)); return c; }

module.exports = { KINDS, file, clean, cleanOne, read, write };
