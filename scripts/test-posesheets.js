// bitGen Studio — lib/poseSheets.js: the B&W line-drawing pose templates the
// character sheet anchors to (2.207.0, Tim: "make the character sheet
// reference black and white line drawings ... for humans, horses, dogs,
// cats, mice etc"). Run from repo root: node scripts/test-posesheets.js
const fs = require("fs");
const path = require("path");
const PS = require(path.join(__dirname, "..", "lib", "poseSheets"));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { console.log("PASS: " + name); pass++; }
  else { console.log("FAIL: " + name + (extra !== undefined ? " -> " + JSON.stringify(extra) : "")); fail++; }
}

// ---- the shipped assets exist and are real PNGs --------------------------
const WANT = ["human", "horse", "dog", "cat", "mouse", "quadruped"];
check("all six templates ship in static/pose-sheets/",
      WANT.every((id) => PS.file(id)), WANT.map((id) => [id, !!PS.file(id)]));
check("each template is a real PNG (magic bytes), not a placeholder",
      WANT.every((id) => {
        const b = fs.readFileSync(PS.file(id));
        return b.length > 2000 && b[0] === 0x89 && b[1] === 0x50;
      }));
check("list() reports exactly the templates on disk, registry order",
      JSON.stringify(PS.list().map((s) => s.id)) === JSON.stringify(WANT),
      PS.list().map((s) => s.id));
check("an unknown id and a traversal path both come back null",
      PS.file("gerbil") === null && PS.file("../../etc/passwd") === null);

// ---- guess: the kind is authoritative, species words refine --------------
check("person is ALWAYS the human template — a 'cat lady' is a person",
      PS.guess("person", "cat lady who loves her cat") === "human");
check("an animal is NEVER the human template — a mare owned by a woman is a horse",
      PS.guess("animal", "a chestnut mare owned by a woman") === "horse");
check("species words map: dog / cat / mouse / horse",
      PS.guess("animal", "my dog rex") === "dog"
      && PS.guess("animal", "a tabby kitten") === "cat"
      && PS.guess("animal", "a field mouse") === "mouse"
      && PS.guess("animal", "a shetland pony") === "horse");
check("an unrecognized animal falls back to the generic quadruped",
      PS.guess("animal", "an axolotl") === "quadruped");
check("vehicles and objects get NO template — poses are meaningless for a car",
      PS.guess("vehicle", "a red pickup truck") === null
      && PS.guess("object", "a brass lamp") === null);
check("no kind: species words still match, silence stays null",
      PS.guess("", "a grey wolf") === "dog" && PS.guess("", "") === null);

// ---- pick: auto / none / explicit ---------------------------------------
check("pick('') guesses; the result carries id, name and an existing file",
      (() => { const p = PS.pick("", "animal", "a chestnut mare");
               return p && p.id === "horse" && p.name === "Horse"
                 && fs.existsSync(p.file); })());
check("pick('none') switches the template off regardless of the text",
      PS.pick("none", "animal", "a chestnut mare") === null);
check("an explicit id wins over the guess",
      (() => { const p = PS.pick("cat", "animal", "a chestnut mare");
               return p && p.id === "cat"; })());
check("an explicit unknown id degrades to null rather than throwing",
      PS.pick("gerbil", "vehicle", "") === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
