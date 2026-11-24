#!/usr/bin/env node
/* bitGen Studio — 2.939.0 units: 🚓 POLICE CHASE's SETTINGS (city, suburbs, forest, countryside), modern lighting, the three
 * views. Tim: "i would like this old arcade style but with modern graphics and lighting. can we also have mazes with forests,
 * surburban housing, rural settings etc?  have a view swap, press v once it does the overview, v again does a drone follow
 * view, v again does a driving view?" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const C = require("../ext/chasedock/chasecore.js"), H = require("../ext/chasedock/chasetheme.js");
check("four settings: City, Suburbs, Forest, Countryside - each with its own sky, fog and light", H.ORDER.join() === "city,suburbs,forest,country"
  && H.ORDER.every((k) => H.THEMES[k].sky.length === 2 && H.THEMES[k].hemi.length === 3 && H.THEMES[k].moon.length === 2));
check("Auto: a new setting each level, round and round; a chosen one stays", [1, 2, 3, 4, 5].map((l) => H.pick("auto", l)).join() === "city,suburbs,forest,country,city" && H.pick("forest", 3) === "forest");
const m = C.makeMaze(5, 21, 17), count = (p) => p.reduce((o, i) => (o[i.type] = (o[i.type] || 0) + 1, o), {});
const onRoad = (p, types) => p.filter((i) => types.includes(i.type)).some((i) => C.open(m, Math.round(i.x), Math.round(i.y)));
const sub = H.plan("suburbs", m, 5), fo = H.plan("forest", m, 5), co = H.plan("country", m, 5), ci = H.plan("city", m, 5);
const cs = count(sub), cf = count(fo), cc = count(co);
check("suburbs: houses facing a road, garden trees, hedges round the edge, street lamps", cs.house > 30 && cs.tree > 20 && cs.hedge > 40 && cs.lamp > 5
  && sub.filter((i) => i.type === "house").every((h) => { const d = C.DIRS[h.rot]; return C.open(m, h.x + d[0], h.y + d[1]) || ![0, 1, 2, 3].some((k) => C.open(m, h.x + C.DIRS[k][0], h.y + C.DIRS[k][1])); }), cs);
check("forest: pines and trees on every block, rocks, bushes, fireflies; no lamps", cf.pine > 100 && cf.tree > 20 && cf.rock > 5 && cf.firefly > 5 && !cf.lamp, cf);
check("countryside: fields, hay bales, barns, silos, fences round the edge", cc.field > 20 && cc.hay > 10 && cc.barn > 2 && cc.silo >= 1 && cc.fence > 40, cc);
check("city: street lamps only (its buildings are the city's own)", Object.keys(count(ci)).join() === "lamp");
check("nothing is put on a road (lamps stand at the kerb)", !onRoad(sub, ["house", "tree", "hedge", "bush"]) && !onRoad(fo, ["pine", "tree", "rock", "bush"]) && !onRoad(co, ["barn", "silo", "fence", "field", "hay"]));
check("the same seed = the same place; another seed = another", JSON.stringify(H.plan("forest", m, 5)) === JSON.stringify(fo) && JSON.stringify(H.plan("forest", m, 6)) !== JSON.stringify(fo));
const JS = src("ext/chasedock/chasedock.js"), DH = src("ext/chasedock/dock.html"), TH = src("ext/chasedock/chasetheme.js");
check("modern lighting: filmic tone mapping, soft shadows from the moon / low sun fitted to the maze, glows on headlights, light bars, lamps, fireflies",
  /ACESFilmicToneMapping/.test(JS) && /PCFSoftShadowMap/.test(JS) && /sun\.castShadow = true/.test(JS) && /sc\.left = -half/.test(JS) && /function addGlows/.test(JS) && /redGlow/.test(JS)
  && /AdditiveBlending/.test(TH) && /firefly/.test(TH) && /ground\.receiveShadow = true/.test(JS));
check("...the setting's sky and light on every new city; lighter while a render runs (no shadows)", /lightTheme\(theme, m\)/.test(JS) && /V\.scene\.background = skyTexture/.test(JS) && /G\.V\.sun\.castShadow = !light/.test(JS));
check("V cycles overview -> drone -> driving (C too; the old \"chase\" = the drone); the keys follow the car in both following views",
  /var CAMS = \["city", "drone", "drive"\]/.test(JS) && /e\.code === "KeyV" \|\| e\.code === "KeyC"/.test(JS) && /chase: "drone"/.test(JS) && /G\.cam !== "city" \? s\.player\.face/.test(JS)
  && /G\.cam === "drone"/.test(JS) && /G\.cam === "drive"/.test(JS) && /V view/.test(DH));
check("🗺 the setting: Auto / City / Suburbs / Forest / Countryside (kept), the city rebuilt at once", /id="pcTheme"/.test(DH) && ["auto", "city", "suburbs", "forest", "country"].every((v) => DH.includes('value="' + v + '"'))
  && /LS\.set\("theme", id\); G\.mazeOf = null/.test(JS) && /"chasetheme\.js"/.test(src("ext/chasedock/ext.json")));
check("server.js untouched", !/chase/i.test(src("misc/server.js")));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
