#!/usr/bin/env node
/* bitGen Studio — 2.574.1 units: theme edit's new words stay on ONE element (static/themeedit.js textFor / oneSel / pick).
 * Tim: "in theme editor when i try to change the docker heading a second time, everything goes haywire" / "and all the
 * dockers take the same name". */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const { JSDOM } = require("jsdom");
const head = (id, t) => `<div id="${id}" class="bdock"><div class="bhead" data-collapse="${id}"><button class="pinbtn">📌</button>▾ ${t}<button>⛶</button></div><div>body <b>x</b></div></div>`;
const dom = new JSDOM(`<!doctype html><html><head></head><body><div id="maincol">${head("videodock", "StoryBoard")}${head("musicdock", "Music")}${head("sfxdock", "SFX")}</div><button class="b">Go</button><button class="b">Stop</button></body></html>`, { runScripts: "outside-only", pretendToBeVisual: true });
const w = dom.window, d = w.document;
w.eval(fs.readFileSync(path.join(ROOT, "static", "themeedit.js"), "utf8"));
const TE = w.H3ThemeEdit;
const title = (id) => [...d.querySelector("#" + id + " > .bhead").childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join("").replace(/[▾▸]/g, "").trim();
TE.setStyles({ "div.bhead": { text: "Same" } }, true);
check("a text rule that finds every docker's title bar renames none of them (a wide rule never rewrites a heading)", ["videodock", "musicdock", "sfxdock"].every((id) => title(id) !== "Same"), ["videodock", "musicdock", "sfxdock"].map(title));
TE.setStyles({ "div": { text: "Every" }, "button": { text: "Btn" } }, true);
check("a bare-tag text rule (div / button) rewrites nothing", title("videodock") === "StoryBoard" && [...d.querySelectorAll("button.b")].map((b) => b.textContent).join() === "Go,Stop" && !d.querySelector(".h3words"));
TE.setStyles({ "#musicdock div.bhead": { text: "Songs" } }, true);
check("a rule that finds one title bar renames just it", title("musicdock") === "Songs" && title("videodock") === "StoryBoard" && title("sfxdock") === "SFX");
TE.setStyles({ "button.b": { text: "Both" } }, true);
check("plain-text buttons through All like it keep working as before (2.514.0)", [...d.querySelectorAll("button.b")].every((b) => /Both/.test(b.textContent)));
TE.setStyles({}, true);
const S = fs.readFileSync(path.join(ROOT, "static", "themeedit.js"), "utf8");
check("the panel: a new pick starts with its own Apply to; the words go under the element's own selector (oneSel) when Apply to finds more; ⟶ no > (cleanSel refuses it)",
  /if \(el !== picked\) scope = "";/.test(S) && /if \(one && one !== scope && \(count\(scope\) > 1 \|\| BARE_TAG\.test\(scope\)\)\)/.test(S) && /\$\{esc\(textNow\(el, r\)\)\}/.test(S)
  && !/" > "/.test(S.slice(S.indexOf("function oneSel"), S.indexOf("function ownWords"))));
check("Apply to: This element only is offered first on every pick (optsFor - #id, else oneSel) and is the default",
  /function optsFor\(el\)/.test(S) && /label: "This element only \(" \+ one \+ "\)"/.test(S) && /scope = opts\[0\]\.sel;/.test(S) && /const opts = optsFor\(el\);/.test(S));
check("storyboard.js leaves a themed title alone", /if \(h && !h\.classList\.contains\("h3words"\)\)/.test(fs.readFileSync(path.join(ROOT, "ext", "videodock", "storyboard.js"), "utf8")));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
