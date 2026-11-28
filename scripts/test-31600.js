#!/usr/bin/env node
/* bitGen Studio — 3.16.0: 🕳 Text Tunnel in the image editor (ext/imageeditdock/pctunnel.js) - the pure part: the presets,
 * settings made safe, the perspective (rings, the hole, the vanishing point), the walls turned from the top one, the rings of a
 * circle, a moved tunnel's box, a drag's box; and the wiring (ext.json, imageedit.js, the commands).
 * Tim: "can we add these text effects to image editor as a preset, we draw a shape like a square or circle and it creates this
 * 3d text effect?" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);
const T = require(path.join(ROOT, "ext/imageeditdock/pctunnel.js"));

// ---- presets + clean
check("seven presets: square, circle, corridor, deep fade, off-centre, two-colour rings, tower", T.PRESETS.map((p) => p.id).join() === "square,circle,corridor,deep,offset,rings,tower");
const c0 = T.clean({ text: "  HELLO\nWORLD ", rows: 99, hole: 0, fade: -5, vx: 500, weight: 123, color: "red", font: "Bad'<font>", shape: "blob", face: "x" });
check("clean: one line of words, rows 2-40, hole 3-85 %, fade 0-100, the vanishing point ±90, a real weight / colour / font / shape / face",
  c0.text === "HELLO WORLD" && c0.rows === 40 && c0.hole === 3 && c0.fade === 0 && c0.vx === 90 && c0.weight === 900 && c0.color === "#ffffff" && c0.font === "Badfont" && c0.shape === "rect" && c0.face === "in", c0);
check("clean: nothing given = DESIGN, 8 rows, white Arial Black", (() => { const d = T.clean(); return d.text === "DESIGN" && d.rows === 8 && d.color === "#ffffff" && d.font === "Arial Black"; })());
const pr = T.presetOf("circle", { text: "LOOP", color: "#00ff00", font: "Impact", shape: "rect" });
check("a preset keeps the words, the colour and the font, and sets its own look (⚪ circle: rings, words round = as many as fit)", pr.text === "LOOP" && pr.color === "#00ff00" && pr.font === "Impact" && pr.shape === "ellipse" && pr.per === 0 && pr.preset === "circle", pr);
check("🗼 tower: the letters face out; 🎯 rings: two colours; 🌀 deep: 16 rows that fade", T.presetOf("tower").face === "out" && T.presetOf("rings").alt && T.presetOf("deep").rows === 16 && T.presetOf("deep").fade === 80);

// ---- perspective
const D = 5;
check("sOf: the outer edge 1, the hole 1/D, true perspective (half-way in = 2 / (D + 1))", T.sOf(0, D) === 1 && near(T.sOf(1, D), 1 / D) && near(T.sOf(0.5, D), 2 / (D + 1)));
check("uOfS is sOf turned round", [0, 0.1, 0.37, 0.8, 1].every((u) => near(T.uOfS(T.sOf(u, D), D), u)));
const box = { x: 100, y: 50, w: 400, h: 400 }, p = T.clean({ hole: 20 });
const g = T.geom(box, p);
check("the hole: 20 % of the box, in its middle", near(g.inner.hx, 40) && near(g.inner.cx, 300) && near(g.inner.cy, 250) && near(g.outer.hx, 200), g.inner);
check("the rows crowd toward the hole (each ring's step smaller than the last)", (() => { const st = []; for (let i = 0; i < 8; i++) st.push(T.ringAt(box, p, i / 8).hy - T.ringAt(box, p, (i + 1) / 8).hy); return st.every((d, i) => !i || d < st[i - 1]); })());
const po = T.clean({ hole: 20, vx: 50, vy: -50 }), go = T.geom(box, po);
check("Hole at +50 / -50: the hole moves right and up, half the room there is - and stays inside the box", near(go.inner.cx, 300 + 0.5 * 200 * 0.8) && near(go.inner.cy, 250 - 0.5 * 200 * 0.8)
  && go.inner.cx + go.inner.hx < box.x + box.w && go.inner.cy - go.inner.hy > box.y, go.inner);
check("…even at ±90 the hole stays in the box", (() => { const q = T.geom(box, T.clean({ hole: 40, vx: 90, vy: 90 })).inner; return q.cx + q.hx <= box.x + box.w && q.cy + q.hy <= box.y + box.h; })());
check("the four corner lines run from the box's corners to the hole's", g.corners.length === 4 && near(g.corners[0][0][0], 100) && near(g.corners[0][0][1], 50) && near(g.corners[0][1][0], 260) && near(g.corners[2][1][1], 290), g.corners);

// ---- walls = the top wall turned
const rect = { x: 0, y: 0, w: 600, h: 300 }, pv = T.clean({ hole: 25, vx: 40, vy: 20, shade: 100 });
const W = [0, 1, 2, 3].map((k) => T.wallFrame(rect, pv, k));
check("the top / bottom walls run along the width, the sides along the height", W[0].a === 300 && W[0].b === 150 && W[1].a === 150 && W[1].b === 300 && W[2].a === 300 && W[3].a === 150);
check("each wall is the top one turned 90° more", W.every((f, k) => near(f.turn, k * Math.PI / 2)));
// the hole's middle, put back from each wall's frame into the picture, is the same point
const back = (f) => { const c = Math.cos(f.turn), s = Math.sin(f.turn); return [f.ox * c - f.oy * s, f.ox * s + f.oy * c]; };
check("…and each sees the vanishing point at the same place in the picture", W.every((f) => near(back(f)[0], back(W[0])[0], 1e-9) && near(back(f)[1], back(W[0])[1], 1e-9)), W.map(back));
check("Shade: the top wall lit, the sides darker, the floor darkest", W[0].shade === 0 && W[1].shade > 0 && W[2].shade > W[1].shade && W[3].shade === W[1].shade);
// ---- rows / rings
const rr = T.rowsOf(T.clean({ rows: 4, fade: 100, alt: true, color: "#111111", color2: "#222222" }));
check("rows: 4 even slices of the depth; every other one the 2nd colour; Fade 100 = nearly gone at the hole", rr.length === 4 && rr[1].u0 === 0.25 && rr[0].color === "#111111" && rr[1].color === "#222222" && rr[0].alpha > rr[3].alpha && rr[3].alpha < 0.2, rr);
const rings = T.ringsOf({ x: 0, y: 0, w: 400, h: 400 }, T.clean({ shape: "ellipse", rows: 6, hole: 20 }));
check("circle: 6 rings from the edge (r 200) to the hole (r 40), thinner and thinner", rings.length === 6 && near(rings[0].r0, 200) && near(rings[5].r1, 40) && rings.every((r, i) => !i || (r.r0 - r.r1) < (rings[i - 1].r0 - rings[i - 1].r1)));
// ---- moved / a drag
check("a tunnel moved 50 right and scaled ×2: its box follows", JSON.stringify(T.refit({ x: 10, y: 10, w: 100, h: 100 }, { x: 10, y: 10, w: 100, h: 100 }, { x: 60, y: 10, w: 200, h: 200 })) === JSON.stringify({ x: 60, y: 10, w: 200, h: 200 }));
check("…moved 30 left past the picture's edge (its left side cut off): moved, not shrunk", JSON.stringify(T.refit({ x: 20, y: 20, w: 360, h: 360 }, { x: 20, y: 20, w: 360, h: 360 }, { x: 0, y: 30, w: 350, h: 360 }, 400, 400)) === JSON.stringify({ x: -10, y: 30, w: 360, h: 360 }));
check("a drag: corner to corner; Shift = square; Alt = from the middle out", JSON.stringify(T.dragBox(50, 40, 10, 100, false, false)) === JSON.stringify({ x: 10, y: 40, w: 40, h: 60 })
  && T.dragBox(0, 0, 30, 80, true, false).w === 80 && JSON.stringify(T.dragBox(100, 100, 130, 120, false, true)) === JSON.stringify({ x: 70, y: 80, w: 60, h: 40 }));

// ---- wiring
const EJ = JSON.parse(fs.readFileSync(path.join(ROOT, "ext/imageeditdock/ext.json"), "utf8")).scripts.join();
const IE = fs.readFileSync(path.join(ROOT, "ext/imageeditdock/imageedit.js"), "utf8"), SRC = fs.readFileSync(path.join(ROOT, "ext/imageeditdock/pctunnel.js"), "utf8");
check("pctunnel.js loads before the editor, which installs it", EJ.indexOf("pctunnel.js") > -1 && EJ.indexOf("pctunnel.js") < EJ.indexOf("imageedit.js") && /win\.PCTunnel\.install\(E\)/.test(IE));
check("Layer ▸ 🕳 Text Tunnel Tool + 🕳 Text Tunnel From Shape; the tool is E.tools.tunnel; settings kept on the layer (L.tunnel) and undone with it",
  /addCmd\("layer\.tunneltool"/.test(SRC) && /addCmd\("layer\.tunnelshape"/.test(SRC) && /E\.tools\.tunnel = \{/.test(SRC) && /L\.tunnel = \{ box, p/.test(SRC) && /E\.onUndo = function/.test(SRC));
console.log("\n" + pass + " passed, " + fail + " failed");
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
