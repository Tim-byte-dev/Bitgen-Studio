#!/usr/bin/env node
/* bitGen Studio — 2.528.0 units: 🧍 CHARACTERS IN HOUSE SHOTS - static/housegeo.js (people: the mannequin per pose, its
 * colour, normalize), static/housebuilder.js seen() (who a camera sees: left / middle / right, near / far, not through a
 * wall, through a door), lib/house.js charRef (a character's picture into the Image assets for ✨ Make it real) and the
 * route, 🗑 ?assets=1 taking the character pictures too.
 * From the recommendations Tim asked to be worked through: "a character (pose + LoRA) placed in a House camera shot" */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const G = require("../static/housegeo.js"), HB = null;

/* ---- the mannequin */
const tops = {};
for (const pose of Object.keys(G.POSES)) { const P = G.personParts(pose, 1.75); tops[pose] = Math.max(...P.map((p) => p.z1)); }
check("four poses: standing / sitting / walking / waving", JSON.stringify(Object.keys(G.POSES)) === JSON.stringify(["stand", "sit", "walk", "wave"]));
check("standing = its height (1.75 m), sitting lower (~1.34 m), a raised hand above the head (waving)", Math.abs(tops.stand - 1.75) < 1e-9 && tops.sit < 1.4 && tops.sit > 1.25 && tops.wave > 1.9, tops);
check("…scaled to its height (a 1.2 m child)", Math.abs(Math.max(...G.personParts("stand", 1.2).map((p) => p.z1)) - 1.2) < 1e-9);
check("…every part is the mannequin material, the body first (it takes the colour)", G.personParts("walk", 1.75).every((p) => p.mat === "mannequin") && G.personParts("stand", 1.75)[0].s === "b");
const m = G.normalize({ name: "P" });
G.addRoom(m, 0, [[0, 0], [6, 0], [6, 5], [0, 5]], "Living"); G.addRoom(m, 0, [[6, 0], [9, 0], [9, 5], [6, 5]], "Bedroom");
m.people = [{ id: "a", x: 4, y: 1.5, rot: 180, pose: "sit", char: "c1", color: "#aa3322" }, { id: "b", x: 4, y: 3.5, pose: "nope", h: 9 }, { id: "c", x: 7.5, y: 2.5 }, { id: "d", x: 0.5, y: 2.5 }, { id: "e", x: 3, y: 2.5, char: "../x" }];
const n = G.normalize(m);
check("normalize: a bad pose -> standing, the height clamped (0.9 - 2.3 m), a bad character id dropped, faces down the plan by default",
  n.people[1].pose === "stand" && n.people[1].h === 2.3 && n.people[4].char === "" && n.people[2].rot === 90 && n.people[0].char === "c1", n.people);
check("normalize: a person's LoRA (no climbing out with ..) and its weight (-2 .. 2, 0.8 by default)", (() => { const z = G.normalize({ people: [{ lora: "chars/mira.safetensors", lw: 3 }, { lora: "../x" }] }).people; return z[0].lora === "chars/mira.safetensors" && z[0].lw === 2 && z[1].lora === "" && z[1].lw === 0.8; })());
const b = G.build(n, {});
check("build: the mannequins are meshes, a coloured one in its colour", b.meshes.some((g) => g.mat === "mannequin" && g.color === "#aa3322") && b.meshes.some((g) => g.mat === "mannequin" && g.color === G.MATERIALS.mannequin.color));
check("the .obj carries them", /mannequin/.test(G.toObj(b.meshes, "P").mtl));

/* ---- who a camera sees */
/* 2.630.0: seen() went with the House builder (static/housebuilder.js) */

/* ---- the character's picture: lib/house.js charRef (stand-in core + characters) */
const T = fs.mkdtempSync(path.join(os.tmpdir(), "pp528-")), PROJ = path.join(T, "projects", "p1"), CH = path.join(PROJ, "characters", "c1");
fs.mkdirSync(path.join(PROJ, "images"), { recursive: true }); fs.mkdirSync(CH, { recursive: true });
fs.writeFileSync(path.join(CH, "mira.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]));
const stub = (rel, exp) => { const p = require.resolve(rel); require.cache[p] = { id: p, filename: p, loaded: true, exports: exp }; };
stub("../lib/core.js", { BASE: T, getProject: () => "p1", projDir: () => PROJ, pDir: (k) => path.join(PROJ, k) });
stub("../lib/characters.js", { list: () => [{ id: "c1", name: "Mira Vale", images: ["mira.png"] }, { id: "c2", name: "No Pic", images: [] }], referenceImage: (c) => (c.images || [])[0] || null, charDir: () => CH, tagOf: (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, "_") });
const H = require("../lib/house.js");
const r = H.charRef("c1", "Beach House");
check("charRef: the character's picture into the Image assets as house-<house>-char-<tag>", r.name === "house-beach-house-char-mira_vale.png" && fs.existsSync(path.join(PROJ, "images", r.name)) && r.character === "Mira Vale", r);
check("…no picture yet / no such character = 404 with what to do", (() => { try { H.charRef("c2", "x"); return false; } catch (er) { return er.status === 404 && /no picture/.test(er.message); } })() && (() => { try { H.charRef("zz", "x"); return false; } catch (er) { return er.status === 404; } })());
H.save({ name: "Beach House" });
const shotPng = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]);
H.saveRender("Beach House", "shot", "Living", shotPng);   // -> house-beach-house-living-shot.png in renders/ + the Image assets
fs.writeFileSync(path.join(PROJ, "images", "house-beach-house-2-char-x.png"), "x");
H.remove("Beach House", true);
check("🗑 ?assets=1 takes its shots AND its character pictures - not another house's", !fs.existsSync(path.join(PROJ, "images", r.name)) && !fs.existsSync(path.join(PROJ, "images", "house-beach-house-living-shot.png")) && fs.existsSync(path.join(PROJ, "images", "house-beach-house-2-char-x.png")));

const express = require("express");
const app = express(); app.use(express.json()); require("../routes/house.js").mount(app);
const srv = app.listen(0, "127.0.0.1", async () => {
  const U = "http://127.0.0.1:" + srv.address().port;
  try {
    const x = await fetch(U + "/api/house/charref", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ char: "c1", house: "Loft" }) });
    const j = await x.json();
    check("POST /api/house/charref {char, house}", x.status === 200 && j.name === "house-loft-char-mira_vale.png", j);
    const y = await fetch(U + "/api/house/charref", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ char: "zz" }) });
    check("…unknown = 404", y.status === 404);
  } catch (er) { check("the route ran", false, String(er && er.stack || er)); }
  srv.close(); fs.rmSync(T, { recursive: true, force: true });
  const src = "";
  /* 2.630.0: the House builder is gone - this check went with it */
  /* 2.630.0: the House builder is gone - this check went with it */
  /* 2.630.0: the House builder is gone - this check went with it */
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
});
