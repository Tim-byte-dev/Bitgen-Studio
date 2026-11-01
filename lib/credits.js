// bitGen Studio — lib/credits.js (2.642.0): THE CREDITS (lib/credits.json - the one place they are written).
// Tim (verbatim): "I would like the credits to say, Produced and Developed by Tim Paul , Programmer - Claude Opus5.5 in both the
// user guide and an about tab in settings and the rest of the details and credits to everyone whose work we used for
// inspiration or code".
// Read by routes/about.js (Settings ▸ About - static/about.js) and scripts/make_credits.py (the Credits section of
// docs/USAGE.md -> the Guide PDF and the in-app Help; the Guide's cover reads the credit lines too).
//   read()   {about, credits: [{role, join, name}] (role + join + name = the line), thanks, sections: [{title, items: [{name, by?, url?, what}]}], licence}
//   about()  read() + {version, name}
"use strict";
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "credits.json");
const str = (x, n) => (typeof x === "string" ? x.slice(0, n || 400) : "");
const url = (x) => (typeof x === "string" && /^https:\/\/[^\s"<>]+$/.test(x) ? x : "");
function read() {
  const o = JSON.parse(fs.readFileSync(FILE, "utf8"));
  return {
    about: str(o.about, 600),
    credits: (Array.isArray(o.credits) ? o.credits : []).map((c) => ({ role: str(c.role, 80), join: typeof c.join === "string" ? c.join.slice(0, 5) : " ", name: str(c.name, 80) })).filter((c) => c.role && c.name),
    thanks: str(o.thanks, 600),
    sections: (Array.isArray(o.sections) ? o.sections : []).map((s) => ({
      title: str(s.title, 80),
      items: (Array.isArray(s.items) ? s.items : []).map((i) => ({ name: str(i.name, 120), by: str(i.by, 120), url: url(i.url), what: str(i.what, 400) })).filter((i) => i.name),
    })).filter((s) => s.title && s.items.length),
    licence: str(o.licence, 600),
  };
}
function about() {
  let version = "";
  try { version = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")).version || ""; } catch { /* none */ }
  return Object.assign({ name: "bitGen Studio", version }, read());
}
module.exports = { read, about, FILE };
