#!/usr/bin/env node
/* bitGen Studio — 2.999.0: ✨ Photo's angle fix - a face reference stays out of step 1 when the camera sees the face from
 * far off its angle. Tim: "when the angle is too different from the reference picture i get very bad picture" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const R = require(path.join(ROOT, "ext/pushpulldock/ppreal.js"));
// a head facing +y (Z up): the eyes in front of the head bone and a little up, the neck under it
const H = [0, 0, 1.6], L = [-0.032, 0.09, 1.66], Rr = [0.032, 0.09, 1.66], N = [0, 0, 1.5];
const at = (deg, d) => { const a = deg * Math.PI / 180; return [Math.sin(a) * (d || 3), Math.cos(a) * (d || 3), 1.66]; };
const A = (c) => R.faceAngle(H, L, Rr, N, c);
check("faceAngle: straight on = 0, from the side = 90, from behind = 180 (whichever eye is called left)", Math.abs(A(at(0))) < 1 && Math.abs(A(at(90)) - 90) < 3 && Math.abs(A(at(180)) - 180) < 1 && Math.abs(R.faceAngle(H, Rr, L, N, at(0))) < 1, [A(at(0)), A(at(90)), A(at(180))]);
check("…a three-quarter view = 45, from above = the tilt counts too; missing bones = null", Math.abs(A(at(45)) - 45) < 3 && A([0, 0.5, 4]) > 60 && R.faceAngle(H, L, null, N, at(0)) === null);
const ref = (role, i) => ({ src: "r" + i, role, cap: "Reference " + i });
const face = ref("person", 1), cloth = ref("clothing", 2), hair = ref("hair", 3), obj = ref("object", 4), noRole = ref("", 5);
const near = R.refsForAngle([face, cloth, hair, obj, noRole], 25), far = R.refsForAngle([face, cloth, hair, obj, noRole], 70), none = R.refsForAngle([face], null);
check("refsForAngle: within " + R.FACE_LIMIT + "° all kept; past it the FACE references (person, hair, no Type = person) out, clothing / objects kept; no character = all kept",
  near.keep.length === 5 && !near.out.length && far.keep.join() === [cloth, obj].join() && far.out.join() === [face, hair, noRole].join() && none.keep.length === 1);
const p = R.plan("", false, [face, cloth]); p.faceAngle = 72; p.faceOut = [face];
const u = R.refUse(p, [face, cloth]);
check("refUse: the one left out is SAID (the angle, straight-on limit, the render's own head kept)", /^Reference 1 \(person\) → left out: the camera sees the face at 72° \(more than 40° from straight on\) - the render's own head is kept$/.test(u[0]) && /the model's look/.test(u[1]), u);
// 👤 Make this person (ppdaztools)
const DT = require(path.join(ROOT, "ext/pushpulldock/ppdaztools.js"));
const g9 = DT.pickG9([{ kind: "figure", name: "Genesis 9 Anatomical Elements", rel: "a" }, { kind: "figure", name: "Genesis 9 Eyebrows", rel: "b" }, { kind: "figure", name: "Genesis 9", rel: "People/Genesis 9/Genesis 9.duf" }, { kind: "figure", name: "Genesis 8 Female", rel: "g8" }, { kind: "character", name: "Genesis 9 Someone", rel: "c" }]);
check("pickG9: the plainest Genesis 9 FIGURE (not its anatomy / eyebrows add-ons, not a Genesis 8, not a character); none = null", g9 && g9.rel === "People/Genesis 9/Genesis 9.duf" && DT.pickG9([{ kind: "figure", name: "Genesis 8", rel: "x" }]) === null);
const pr1 = DT.personRefs([{ url: "c", role: "clothing" }, { url: "f", role: "face" }, { url: "p", role: "person" }, { url: "v", role: "person", file: { type: "video/mp4" } }]), pr2 = DT.personRefs([{ url: "f", role: "face" }]), pr3 = DT.personRefs([{ url: "o", role: "other", roleOther: "Body" }]);
check("personRefs: the body = a person / body picture before a clothing one, the face = a face close-up; a face alone = the body photo too (no separate head); videos skipped",
  pr1.body.url === "p" && pr1.face.url === "f" && pr2.body.url === "f" && pr2.face === null && pr3.body.url === "o" && DT.personRefs([]).body === null);
const cr = R.refsForAngle([{ src: "blob:1", name: "me.png", role: "person" }, { src: "blob:2", name: "coat.png", role: "clothing" }], 10, [{ url: "", name: "me.png" }]);
check("refsForAngle + carried: a picture the 👤 character was made from (by name or url) leaves step 1 at any angle", cr.carriedOut.length === 1 && cr.keep.length === 1 && cr.keep[0].name === "coat.png");
const DS = src("ext/pushpulldock/ppdaztools.js");
check("makePerson: opens the DAZ tools, finds Genesis 9 (/api/dazlib/scan), runs 📷 (A, or B with Shift) with the 🙂 face close-up, checks it was BUILT, remembers fromRefs (no data: urls)",
  /async function makePerson\(route\)/.test(DS) && /if \(!st\.on\) toggle\(true\);/.test(DS) && /q=" \+ encodeURIComponent\("Genesis 9"\)/.test(DS) && /await tryIt\(route === "B" \? "B" : "A"\)/.test(DS) && /if \(!c\.last\) throw/.test(DS) && /\^data:/.test(DS) && /const route = ev\.shiftKey \? "B" : "A"/.test(DS));
const PR = src("ext/pushpulldock/ppreal.js");
check("capture: the nearest visible DAZ character's head / eye / neck bones vs the camera (V.cam()) -> refsForAngle -> step 1's board", /p\.faceAngle = headAngle\(V\);/.test(PR) && /used\.refs = fa\.keep;/.test(PR) && /V\.cam && V\.cam\(\)/.test(PR) && /f\(\/\^head\$\/i\)/.test(PR));
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
