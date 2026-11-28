#!/usr/bin/env node
/* bitGen Studio — 3.6.0: 📽 PROJECT A PICTURE ONTO ANY SKETCHER MODEL - the projector's maths (ppproject.js), the model keeping
 * its projections (pparch.js clean), the .glb carrying them as real textures (ppglb.js), ✨ Photo's materials board (ppreal.js)
 * and the wiring. The real clicks: scripts/test-ui3600-ui.js.
 * Tim chose "Picture onto any model" - "Both" (characters: their own UVs since 2.981; this is the Sketcher's models). */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);

const J = require(path.join(ROOT, "ext/pushpulldock/ppproject.js"));
globalThis.polygonClipping = require(path.join(ROOT, "static/vendor/polygon-clipping.umd.min.js"));
const P = require(path.join(ROOT, "ext/pushpulldock/pparch.js"));
const O = require(path.join(ROOT, "ext/pushpulldock/ppglb.js"));
const RL = require(path.join(ROOT, "ext/pushpulldock/ppreal.js"));

// a projector at (0, -10, 1.5) looking along +y (three.js: -z forward; turned -90° about x... built from a look-at)
function lookAt(pos, at) {   // a camera quaternion whose -z points at `at`, z up kept as "up" (y in camera space)
  const f = [at[0] - pos[0], at[1] - pos[1], at[2] - pos[2]], L = Math.hypot(...f); const z = f.map((x) => -x / L);   // camera +z = backwards
  let x = [0 * z[2] - 1 * z[1], 1 * z[0] - 0 * z[2], 0 * z[1] - 0 * z[0]]; const lx = Math.hypot(...x); x = x.map((v) => v / lx);   // up (0,0,1) × z
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  const m00 = x[0], m01 = y[0], m02 = z[0], m10 = x[1], m11 = y[1], m12 = z[1], m20 = x[2], m21 = y[2], m22 = z[2], tr = m00 + m11 + m22;
  let q;
  if (tr > 0) { const s = 0.5 / Math.sqrt(tr + 1); q = [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s]; }
  else if (m00 > m11 && m00 > m22) { const s = 2 * Math.sqrt(1 + m00 - m11 - m22); q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
  else if (m11 > m22) { const s = 2 * Math.sqrt(1 + m11 - m00 - m22); q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]; }
  else { const s = 2 * Math.sqrt(1 + m22 - m00 - m11); q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]; }
  return q;
}
const cam = { kind: "persp", pos: [0, -10, 1.5], quat: lookAt([0, -10, 1.5], [0, 0, 1.5]), fov: 40, aspect: 1.5, near: 0.05 };

// ---- the projector's maths
const c0 = J.toCam(cam, [0, 0, 1.5]);
check("toCam: the point looked at is straight ahead (-z, 10 m)", near(c0[0], 0, 1e-9) && near(c0[1], 0, 1e-9) && near(c0[2], -10, 1e-9), c0);
const up = J.toCam(cam, [0, 0, 2.5]), right = J.toCam(cam, [1, 0, 1.5]);
check("toCam: z up is the projector's y, +x (seen from -y) is its x", up[1] > 0.99 && right[0] > 0.99, { up, right });
const uv0 = J.uvOf(cam, [0, 0, 1.5]);
check("uvOf: the middle of the view = the middle of the picture", near(uv0[0], 0.5) && near(uv0[1], 0.5), uv0);
const ty = Math.tan(20 * Math.PI / 180), top = J.uvOf(cam, [0, 0, 1.5 + 10 * ty]), rgt = J.uvOf(cam, [10 * ty * 1.5, 0, 1.5]);
check("uvOf: the top edge of the frustum = v 1, the right edge = u 1 (v up as three.js reads pictures)", near(top[1], 1, 1e-9) && near(rgt[0], 1, 1e-9), { top, rgt });
check("uvOf: behind a perspective projector = null", J.uvOf(cam, [0, -20, 1.5]) === null);
const wide = J.fitCam(cam, 3), tall = J.fitCam(cam, 0.75);
check("fitCam: a wider picture keeps the view's width (a smaller vertical lens, its own aspect)", near(Math.tan(wide.fov * Math.PI / 360) * 3, Math.tan(20 * Math.PI / 180) * 1.5, 1e-9) && wide.aspect === 3, wide);
check("fitCam: a taller picture keeps the view's height", tall.fov === 40 && tall.aspect === 0.75, tall);
const oc = J.fitCam({ kind: "ortho", half: 2, aspect: 2, pos: [0, 0, 0], quat: [0, 0, 0, 1] }, 4);
check("fitCam ortho: a wider picture -> half the height", near(oc.half, 1) && oc.aspect === 4, oc);

// a wall facing the projector (y = 0, normal -y) and its back
const wallF = [[-1, 0, 1], [1, 0, 1], [1, 0, 2]], wallB = [[-1, 0, 1], [1, 0, 2], [1, 0, 1]];
check("facing: a wall turned to the projector yes, its back no (one-sided), either side when two-sided",
  J.facing(cam, wallF, false) && !J.facing(cam, wallB, false) && J.facing(cam, wallB, true), [J.facing(cam, wallF), J.facing(cam, wallB)]);
check("facing: a floor seen edge-on (grazing) is not projected on", !J.facing(cam, [[-1, 0, 1.5], [1, 0, 1.5], [0, 1, 1.5]], true));

// clipping: a big quad wider than the view -> inside + outside add up, inside all within [0, 1]
const big = [[-20, 0, -5], [20, 0, -5], [20, 0, 8]];
const r = J.clipTri(cam, big), ai = r.inside.reduce((s, t) => s + J.area(t), 0), ao = r.outside.reduce((s, t) => s + J.area(t), 0);
check("clipTri: the pieces inside and outside the frustum add up to the triangle", near(ai + ao, J.area(big), 1e-6) && ai > 0 && ao > 0, { ai, ao, all: J.area(big) });
const inUV = r.inside.flat().map((p) => J.uvOf(cam, p));
check("clipTri: every inside corner lands inside the picture (no stretched edge)", inUV.every((q) => q[0] > -1e-9 && q[0] < 1 + 1e-9 && q[1] > -1e-9 && q[1] < 1 + 1e-9), inUV.slice(0, 4));
const allOut = J.clipTri(cam, [[50, 0, 0], [60, 0, 0], [55, 0, 5]]);
check("clipTri: a triangle off to the side stays whole outside", allOut.inside.length === 0 && near(allOut.outside.reduce((s, t) => s + J.area(t), 0), 25, 1e-9), allOut);

// subdivision: an oblique floor (big depth change) -> the per-vertex UVs follow the perspective
const floor = [[-3, -6, 0], [3, -6, 0], [0, 8, 0]];
const sp = J.splitTri(floor, [cam]);
const pieces = sp.hit[0];
let worst = 0; pieces.forEach((h) => { const m = [(h.p[0][0] + h.p[1][0] + h.p[2][0]) / 3, (h.p[0][1] + h.p[1][1] + h.p[2][1]) / 3, (h.p[0][2] + h.p[1][2] + h.p[2][2]) / 3]; const want = J.uvOf(cam, m), got = [(h.uv[0][0] + h.uv[1][0] + h.uv[2][0]) / 3, (h.uv[0][1] + h.uv[1][1] + h.uv[2][1]) / 3]; worst = Math.max(worst, Math.hypot(want[0] - got[0], want[1] - got[1])); });
check("splitTri: an oblique floor is cut small enough that the straight UVs stray < 0.4 % of the picture", pieces.length > 4 && worst < 0.004, { n: pieces.length, worst });
const sa = pieces.reduce((s, h) => s + J.area(h.p), 0) + sp.rest.reduce((s, t) => s + J.area(t), 0);
check("splitTri: the pieces still cover the floor exactly", near(sa, J.area(floor), 1e-6), { sa, all: J.area(floor) });
// two projectors over one wall: the later wins where they overlap
const cam2 = Object.assign({}, cam, { fov: 10 });
const two = J.splitTri([[-3, 0, 0], [3, 0, 0], [3, 0, 3]], [cam, cam2]);
const a1 = two.hit[0].reduce((s, h) => s + J.area(h.p), 0), a2 = two.hit[1].reduce((s, h) => s + J.area(h.p), 0);
check("splitTri: two projectors - each piece goes to one (the later, narrower one wins the middle)", a2 > 0 && a1 > 0 && near(a1 + a2 + two.rest.reduce((s, t) => s + J.area(t), 0), 9, 1e-6), { a1, a2 });

// keys
check("triKey: the same triangle in a float32 buffer and as numbers, either winding = one key",
  J.triKey([0.1, 0.2, 0.3], [1, 2, 3], [4, 5, 6.7]) === J.triKey([4, 5, Math.fround(6.7)], [Math.fround(0.1), Math.fround(0.2), Math.fround(0.3)], [1, 2, 3]));
check("partKey: a room's wall sides, outside walls, a floor / ceiling, a door, a roof, the ground",
  J.partKey({ ak: "wall", room: 3 }) === "wall:3" && J.partKey({ ak: "wall", room: null }) === "wall:x" && J.partKey({ ak: "room", id: 3, part: "floor" }) === "room:3:floor"
  && J.partKey({ ak: "op", id: 7, part: "frame" }) === "op:7" && J.partKey({ ak: "roof", id: 2 }) === "roof:2" && J.partKey({ ak: "terrain" }) === "terrain" && J.partKey({ ak: "x!" }) === null);
check("selKeys: a picked wall = that wall; a picked room = its walls + floor + ceiling", JSON.stringify(J.selKeys({ ak: "room", id: 3, part: "wall", edge: 1 })) === '["wall:3:1"]'
  && J.selKeys({ ak: "room", id: 3, part: null }).join() === "wall:3,room:3:floor,room:3:ceil,room:3");

// each wall its own key, found as a click finds it (the building tags a room's walls together, the outside walls as one)
{
  const Ar = P.clean({ rooms: [{ id: 3, pts: [[0, 0], [4, 0], [4, 3], [0, 3]] }, { id: 4, pts: [[4, 0], [8, 0], [8, 3], [4, 3]] }] });
  const front = J.wallKey(P, Ar, { ak: "wall", room: null }, [2, -0.06, 1.2], [0, -1, 0]), inBack = J.wallKey(P, Ar, { ak: "wall", room: 3 }, [2, 2.94, 1.2], [0, -1, 0]);
  const top = J.wallKey(P, Ar, { ak: "wall", room: 4, edge: 2, part: "top" }, [6, 3, 2.7], [0, 0, 1]), right = J.wallKey(P, Ar, { ak: "wall", room: null }, [8.06, 1.5, 1.2], [1, 0, 0]);
  check("wallKey: an outside face -> its own room's wall; an inside face -> the nearest edge of its room; a wall top keeps its edge",
    front === "wall:3:0" && inBack === "wall:3:2" && top === "wall:4:2" && right === "wall:4:1", { front, inBack, top, right });
  check("wallKey: not a wall = partKey; no building = the coarse key", J.wallKey(P, Ar, { ak: "roof", id: 2 }, [0, 0, 0], [0, 0, 1]) === "roof:2" && J.wallKey(null, null, { ak: "wall", room: 3 }, [0, 0, 0], [0, 1, 0]) === "wall:3");
  check("takes: a room's 'wall:3' takes each of its walls, a wall only itself", J.takes(new Set(["wall:3"]), "wall:3:2") && J.takes(new Set(["wall:3:0"]), "wall:3:0") && !J.takes(new Set(["wall:3:0"]), "wall:3:2") && !J.takes(new Set(["wall:3"]), "wall:4:0"));
}

// ---- the model keeps them (pparch.js clean -> ppproject.js clean)
const good = { id: "p1", name: "Mural", src: "/passets/images/mural 1.png", cam, parts: ["wall:3", "f:12", "terrain", "bad key", "wall:3", "wall:3:1"], view: { p: [0, -10, 1.5], t: [0, 0, 1.5], ortho: false } };
const A = P.clean({ rooms: [{ id: 3, pts: [[0, 0], [4, 0], [4, 3], [0, 3]] }], proj: [good,
  { id: "p2", src: "http://evil/x.png", cam }, { id: "p3", src: "/passets/images/../../secret.png", cam }, { id: "p4", src: "/outputs/take.png", cam: { kind: "persp", pos: [0, 0], quat: [0, 0, 0, 1], fov: 40, aspect: 1 } },
  { id: "P5!", src: "/outputs/take.png", cam }, { id: "p6", src: "/outputs/take 2.png", cam, on: false, parts: ["room:3:ceil"] }] });
check("pparch.clean keeps the projections - only a project image / the gallery, a good id and camera; parts deduped and checked",
  A.proj.length === 2 && A.proj[0].id === "p1" && JSON.stringify(A.proj[0].parts) === '["wall:3","f:12","terrain","wall:3:1"]' && A.proj[1].id === "p6" && A.proj[1].on === false, A.proj);
check("clean: the camera's quaternion normalised, the view kept", near(Math.hypot(...A.proj[0].cam.quat), 1, 1e-9) && A.proj[0].view && A.proj[0].view.p[1] === -10, A.proj[0]);
check("an empty building has no projections", JSON.stringify(P.clean({}).proj) === "[]");
check("clean: at most 24 (the newest kept)", J.clean(Array.from({ length: 30 }, (x, i) => ({ id: "p" + i, src: "/outputs/a.png", cam }))).map((p) => p.id)[0] === "p6");
check("okSrc / urlOf: the gallery and project images, the file name encoded for the page", J.okSrc("/outputs/a b.png") && !J.okSrc("/outputs/../x.png") && !J.okSrc("file:///c/x.png")
  && J.urlOf("/passets/images/a b#1.png") === "/passets/images/a%20b%231.png" && J.urlOf("data:image/png;base64,AA") === "data:image/png;base64,AA");
check("freshId: the next free p<n>", J.freshId([{ id: "p1" }, { id: "p2" }]) === "p3" && J.freshId([]) === "p1");

// ---- the export: covered triangles split into a textured mesh, the rest kept
const quad = { color: "#cccccc", pos: [-20, 0, -5, 20, 0, -5, 20, 0, 8, -20, 0, 8], nrm: [0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0], idx: [0, 1, 2, 0, 2, 3] };
const glass = { color: "#9ec5e8", alpha: 0.3, pos: [0, 0, 0, 1, 0, 0, 1, 0, 1], nrm: [0, -1, 0, 0, -1, 0, 0, -1, 0], idx: [0, 1, 2] };
const t1 = [[-20, 0, -5], [20, 0, -5], [20, 0, 8]], t2 = [[-20, 0, -5], [20, 0, 8], [-20, 0, 8]];
const cover = new Map([[J.triKey(...t1), [0]], [J.triKey(...t2), [0]]]);
const projs = [{ id: "p1", name: "Mural", src: "/passets/images/mural.png", cam }];
const out = J.split([quad, glass], cover, projs), tex = out.find((g) => g.src), plain = out.find((g) => g.color === "#cccccc");
const areaOf = (g) => { let s = 0; for (let i = 0; i < g.idx.length; i += 3) { const p = (k) => [g.pos[g.idx[i + k] * 3], g.pos[g.idx[i + k] * 3 + 1], g.pos[g.idx[i + k] * 3 + 2]]; s += J.area([p(0), p(1), p(2)]); } return s; };
check("split: a textured mesh for the projection + the wall's rest kept + the glass untouched", tex && plain && out.includes(glass) && tex.uv.length === tex.pos.length / 3 * 2, out.map((g) => ({ c: g.color, n: g.idx.length, src: g.src })));
check("split: the pieces add up to the wall", near(areaOf(tex) + areaOf(plain), 40 * 13, 1e-4), { tex: areaOf(tex), plain: areaOf(plain) });
check("split: the textured pieces' UVs are inside the picture (glTF's v: down)", tex.uv.every((x) => x > -1e-6 && x < 1 + 1e-6));
const iMid = (() => { for (let i = 0; i < tex.pos.length / 3; i++) if (near(tex.pos[i * 3], 0, 1e-9) && near(tex.pos[i * 3 + 2], 1.5, 1e-9)) return i; return -1; })();
const projArea = 4 * Math.pow(10 * Math.tan(20 * Math.PI / 180), 2) * 1.5;
check("split: the textured area is the projector's frame on the wall (the frustum at 10 m)", near(areaOf(tex), projArea, 1e-3), { got: areaOf(tex), want: projArea, iMid });
check("split: nothing covered = the list as it was", J.split([quad], new Map(), projs)[0] === quad);

// ---- the .glb: the picture inside, TEXCOORD_0, clamped
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
tex.img = { mime: "image/png", bytes: png, key: tex.src };
const g = O.glb(out, "proj test"), dv = new DataView(g.buffer), jl = dv.getUint32(12, true), json = JSON.parse(new TextDecoder().decode(g.slice(20, 20 + jl)));
const prim = json.meshes[0].primitives.find((p) => p.attributes.TEXCOORD_0 != null), mat = prim && json.materials[prim.material];
check(".glb: the projected mesh has TEXCOORD_0 and a material with the picture as its base colour texture",
  prim && mat && mat.pbrMetallicRoughness.baseColorTexture && mat.pbrMetallicRoughness.baseColorTexture.index === 0 && json.textures.length === 1 && json.images[0].mimeType === "image/png", { prim, mat });
const bv = json.bufferViews[json.images[0].bufferView], bin0 = 20 + jl + 8, bytes = g.slice(bin0 + bv.byteOffset, bin0 + bv.byteOffset + bv.byteLength);
check(".glb: the picture's bytes are in the binary chunk, the sampler clamps", bytes.length === png.length && bytes.every((b, i) => b === png[i]) && json.samplers[0].wrapS === 33071);
check(".glb: glass and the plain wall have no texture", json.meshes[0].primitives.filter((p) => p.attributes.TEXCOORD_0 == null).length === 2);
const g0 = O.glb([quad], "plain"), j0 = JSON.parse(new TextDecoder().decode(g0.slice(20, 20 + new DataView(g0.buffer).getUint32(12, true))));
check(".glb with no projection: no images / textures / samplers (as before)", !j0.images && !j0.textures && !j0.samplers);

// ---- ✨ Photo's materials board
const used = RL.usedPictures(A, []);
check("✨ Photo: a tile per projection shown (the hidden one left out)", used.tiles.length === 1 && used.tiles[0].src === "/passets/images/mural 1.png" && /projected/.test(used.tiles[0].where[0]), used.tiles);

// ---- the wiring
const dock = read("ext/pushpulldock/dock.html"), ext = JSON.parse(read("ext/pushpulldock/ext.json")), view = read("ext/pushpulldock/ppview.js"), dk = read("ext/pushpulldock/ppdock.js");
check("ext.json loads ppproject.js (after ppglb.js, before pparch.js)", ext.scripts.indexOf("ppproject.js") > ext.scripts.indexOf("ppglb.js") && ext.scripts.indexOf("ppproject.js") < ext.scripts.indexOf("pparch.js"));
check("dock.html: the 📽 button beside 🖼 Background", /id="ppBgBtn"[\s\S]{0,400}id="ppProj"/.test(dock));
check("ppview.js paints the projections after the building and lends its face meshes", /V\.after\(\)[^\n]*\n[^\n]*PPProject\.paint\(V\)/.test(view) && /faceMeshes: \(\) => faceMeshes/.test(view));
check("pparchview.js lends itself to the view (V.archView)", /V\.archView = A;/.test(read("ext/pushpulldock/pparchview.js")));
check("ppdock.js: every .glb goes through forGlb (project's models, Blender, Unreal, timeline, this computer)", /glbOut\(list, o && o\.lights\)/.test(dk) && /glbOut\(meshes\(\), true\)/.test(dk) && !/O\(\)\.glb\(meshes\(\)/.test(dk) && /PPProject\.pop\(e\.currentTarget, root\.H3PushPull\)/.test(dk));
check("server.js untouched by the feature", !/ppproject|PPProject/.test(read("misc/server.js")));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
