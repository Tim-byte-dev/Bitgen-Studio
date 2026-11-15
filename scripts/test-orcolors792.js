#!/usr/bin/env node
/* bitGen Studio — 2.792.0 units: no OpenRouter dialog - 🧩 Model manager ▸ ☁ OpenRouter looks after your list; your models coloured
 * (free dark green, paid dark orange, dead dark red); a model OpenRouter no longer lists is marked dead, not taken off (lib/orModels.js
 * markDead), left out of the dropdowns (static/ormine.js, lib/remoteLlm.js) and refused for a render (lib/orRender.js). Pure + pins. */
"use strict";
const path = require("path"), fs = require("fs");
const ROOT = path.join(__dirname, "..");
const OM = require("../lib/orModels"), MO = require("../static/mmor.js"), MS = require("../lib/mmSources"), DLG = require("../static/ormodels.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

const d = OM.markDead([{ id: "a" }, { id: "b" }, { id: "c", dead: true, dead_at: 1 }, { id: "e", dead: true }], ["a", "e"], 99);
check("markDead: no longer listed = dead (kept, with when); still dead stays; listed again = alive; nothing removed", d.list.length === 4 && !d.list[0].dead && d.list[1].dead === true && d.list[1].dead_at === 99 && d.list[2].dead_at === 1 && !d.list[3].dead && d.dead.map((m) => m.id).join() === "b" && d.back.map((m) => m.id).join() === "e", d);
const O = src("lib/orModels.js");
check("view() marks instead of pruning; a dead entry keeps its old price / caps", /const p = markDead\(my\[type\], cat\.ids\);/.test(O) && /if \(!n \|\| m\.dead\) return m;/.test(O) && !/const p = prune\(my\[type\]/.test(O));
const R = src("lib/orRender.js");
check("a render with a dead model is refused with why; Runs on = OpenRouter skips dead ones", /if \(m\.dead\) return \{ error: `\$\{m\.name \|\| id\} is no longer on OpenRouter/.test(R) && /OM\.mine\(\)\[kind\]\.filter\(\(x\) => !x\.dead\)/.test(R));
check("dead ones are left out of the dropdowns (ormine) and the LLM lists (remoteLlm)", /return !m\.dead;/.test(src("static/ormine.js")) && /\.filter\(\(m\) => !m\.dead\)/.test(src("lib/remoteLlm.js")));

// the colours
check("the darker green / orange / red", MO.COLORS.free === "#1e7b34" && MO.COLORS.paid === "#b35900" && MO.COLORS.dead === "#a32020");
check("stateOf: yours free / paid / dead; not yours = none", MO.stateOf({ free: true }, {}) === "free" && MO.stateOf({ free: false }, {}) === "paid" && MO.stateOf({ free: true }, { dead: true }) === "dead" && MO.stateOf({ free: true }, null) === "");
const cf = MO.cardHtml({ id: "g/f", name: "F", free: true }, "free"), cp = MO.cardHtml({ id: "s/p", name: "P", price: "$0.04 / image" }, "paid"), cd = MO.cardHtml({ id: "v/x", name: "X" }, "dead"), cn = MO.cardHtml({ id: "n/n", name: "N" }, "");
check("the tab's cards: orfree / orpaid / ordead (✗ no longer on OpenRouter + 🗑), a model not yours plain with ＋", /class="mmorc mine orfree"/.test(cf) && /class="mmorc mine orpaid"/.test(cp) && /class="mmorc mine ordead"/.test(cd) && /no longer on OpenRouter/.test(cd) && /data-orrm="v\/x"/.test(cd) && /class="mmorc"/.test(cn) && /data-oradd="n\/n"/.test(cn));
const css = src("static/mmor.js");
check("the CSS: the tab's cards and the Models tab's (.mmcard.orfree …) framed + tinted; a legend", /\.mmorc\.orfree,\.mmcard\.orfree\{border-color:" \+ COLORS\.free/.test(css) && /\.mmcard\.ordead/.test(css) && /mmorleg/.test(css) && /dead\.map\(function \(m\) \{ return cardHtml\(m, "dead"\); \}\)/.test(css));
const oc = MS.orCard({ id: "a/b", name: "B", free: true }, "image"), od = MS.orCard({ id: "a/c", name: "C", dead: true }, "video");
check("the Models tab's OpenRouter cards carry their state (or_state) - modelmgr adds the class", oc.or_state === "free" && od.or_state === "dead" && od.dead === true && /No longer on OpenRouter/.test(od.description) && /\(c\.or && c\.or_state \? " or" \+ c\.or_state : ""\)/.test(src("static/modelmgr.js")));

// the dialog gone
const D = src("static/ormodels.js");
check("static/ormodels.js: no dialog any more - the pure helpers + the button opening 🧩 Model manager ▸ ☁ OpenRouter", !/orDlg|showModal|orAvail|orMine/.test(D.split("(The 2.786.0 description that follows is history.)")[1]) && /MM\.openTab\("openrouter"\)/.test(D) && typeof DLG.filterList === "function" && typeof DLG.sortList === "function" && /function openTab\(t\)/.test(src("static/modelmgr.js")));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
