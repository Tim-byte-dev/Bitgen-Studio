/* bitGen Studio — static/housegeo.js (2.524.0): THE HOUSE MODEL AND ITS GEOMETRY (window.H3HouseGeo; UMD - lib/house.js
 * uses it for the .obj export, static/housebuilder.js for the 3D view and the location renders - ONE geometry for both).
 * Tim (verbatim): "i would like a floorplan/housebuilder floating docker that i can use as a location as well"
 *
 *   THE MODEL (house.json)  metres; the plan's x right, y DOWN (the screen's); 3D: X = x, Y = up, Z = y
 *     floors   [{id, name, height}]            the storeys, bottom up (each floor's elevation = the ones below + a 0.2 m slab)
 *     walls    [{id, floor, a:[x,y], b:[x,y], thick, mat, color}]
 *     openings [{id, wall, t, w, h, sill, kind}]   t = the opening's middle, metres from the wall's a; kind door | window |
 *                                                  slide (a glass door) | opening (a gap) | garage
 *     rooms    [{id, floor, name, poly:[[x,y]...], mat, color, ceiling}]
 *     items    [{id, floor, type, x, y, rot, w?, d?, h?, color?}]   the furniture (CATALOGUE); rot in degrees, clockwise
 *     stairs   [{id, floor, x, y, rot, w, len}]    a straight flight from its floor up to the next
 *     cameras  [{id, floor, name, x, y, z, yaw, pitch, fov}]   yaw like rot: 0 = facing +x, clockwise on the plan
 *     light    {hour, north, sun, lamps, ambient}
 *     refs     [{id, file, kind, desc}]   2.539.0 pictures from the References docker (kind wall|floor|furniture|light|other),
 *              kept as refs/<file> beside house.json; walls / rooms {tex: refId, texScale: m a tile}, items / lights {ref}
 *     lights   [{id, floor, x, y, z, intensity, color, reach}]   2.538.0 ◯ the plan's lights: z = metres over its floor,
 *                                                  reach = how far it lights (the plan's circle), intensity 0.1-5
 *   build(model, opts) -> {meshes: [{key, mat, color, pos, nrm, uv, idx}], lights, bounds}   (grouped by material)
 *   toObj(meshes) -> {obj, mtl}   area(poly), centroid, triangulate(poly, holes), wallPieces, describe(model, room)
 * Pure (Node: scripts/test-house524.js).
 */
(function (root) {
  "use strict";
  var SLAB = 0.2;
  var REF_KINDS = ["wall", "floor", "furniture", "light", "other"];   // 2.539.0: a reference picture kept with the house
  /* ---------------- materials (colour, look; tex = the docker's procedural texture) */
  var MATERIALS = {
    plaster: { label: "Plaster", color: "#ece6dc", rough: 0.9, tex: "plaster" },
    paint: { label: "Paint", color: "#d9d4ca", rough: 0.85 },
    brick: { label: "Brick", color: "#a4573f", rough: 0.95, tex: "brick" },
    stone: { label: "Stone", color: "#9b968c", rough: 0.95, tex: "stone" },
    concrete: { label: "Concrete", color: "#a8a49d", rough: 0.95, tex: "concrete" },
    oak: { label: "Oak floor", color: "#b98a5a", rough: 0.6, tex: "planks" },
    walnut: { label: "Walnut floor", color: "#6e4a32", rough: 0.55, tex: "planks" },
    tile: { label: "Tiles", color: "#dcdcd6", rough: 0.35, tex: "tiles" },
    tile_dark: { label: "Dark tiles", color: "#4a4a4c", rough: 0.35, tex: "tiles" },
    marble: { label: "Marble", color: "#eeeae4", rough: 0.2, tex: "marble" },
    carpet: { label: "Carpet", color: "#8a8378", rough: 1, tex: "carpet" },
    grass: { label: "Grass", color: "#5f8a3c", rough: 1, tex: "carpet" },
    wood: { label: "Wood", color: "#a07650", rough: 0.6, tex: "grain" },
    wood_dark: { label: "Dark wood", color: "#5a3d2a", rough: 0.55, tex: "grain" },
    fabric: { label: "Fabric", color: "#6f7480", rough: 1, tex: "carpet" },
    leather: { label: "Leather", color: "#5b3a26", rough: 0.5 },
    linen: { label: "Linen", color: "#f1ede6", rough: 1 },
    metal: { label: "Metal", color: "#8d9096", rough: 0.4, metal: 0.8 },
    chrome: { label: "Chrome", color: "#d7d9dc", rough: 0.15, metal: 1 },
    black: { label: "Black", color: "#202022", rough: 0.4 },
    screen: { label: "Screen", color: "#0d0f12", rough: 0.1 },
    ceramic: { label: "Ceramic", color: "#f6f6f4", rough: 0.15 },
    glass: { label: "Glass", color: "#bcd6e6", rough: 0.05, opacity: 0.25 },
    frame: { label: "Trim", color: "#f2f0ec", rough: 0.5 },
    plant: { label: "Leaves", color: "#3f7a3a", rough: 0.9 },
    soil: { label: "Soil", color: "#4a3626", rough: 1 },
    light: { label: "Light", color: "#fff3d6", rough: 1, emissive: 1 },
    ceiling: { label: "Ceiling", color: "#f4f2ee", rough: 0.95 },
    rubber: { label: "Rubber", color: "#1c1c1c", rough: 0.9 },
    paint_car: { label: "Car paint", color: "#2b4b7a", rough: 0.3, metal: 0.5 },
    mannequin: { label: "Mannequin", color: "#b9bdc3", rough: 0.55 },
    roof_tiles: { label: "Roof tiles", color: "#8a4b36", rough: 0.85, tex: "tiles" },
    roof_metal: { label: "Metal roof (Colorbond)", color: "#4f5a63", rough: 0.4, metal: 0.6, tex: "planks" },
    roof_slate: { label: "Slate", color: "#4a4d52", rough: 0.75, tex: "stone" },
  };
  /* ---------------- the furniture: parts in the item's frame (x across its width, y its depth - the FRONT is +y, z up);
     b = box {x, y, z0, z1, w, d}, c = cylinder {x, y, z0, z1, r}; top:true = z measured down from the ceiling */
  function B(x, y, z0, z1, w, d, mat, o) { return Object.assign({ s: "b", x: x, y: y, z0: z0, z1: z1, w: w, d: d, mat: mat }, o || {}); }
  function C(x, y, z0, z1, r, mat, o) { return Object.assign({ s: "c", x: x, y: y, z0: z0, z1: z1, r: r, mat: mat }, o || {}); }
  /* 2.528.0: 🧍 PEOPLE - a grey mannequin where a character stands / sits / walks / waves (Make it real puts the character
     in its place). Its frame is an item's (front = +y), scaled to its height; rot = the way it FACES, like a camera's yaw */
  /* 2.529.0: THE ROOF over the top floor (its walls' outline, the overhang round it): flat (a slab + a parapet), gable
     (the ridge along the long side), hip (four slopes) */
  var ROOFS = { none: "No roof", flat: "Flat", gable: "Gable", hip: "Hip" };
  function roofParts(bb, base, roof) {      // bb = [x0, z0, x1, z1] (plan), base = the top floor's ceiling height -> triangles
    var o = roof.overhang, x0 = bb[0] - o, z0 = bb[1] - o, x1 = bb[2] + o, z1 = bb[3] + o, T = [];
    if (roof.kind === "flat") return { flat: [x0, z0, x1, z1] };
    var alongX = (x1 - x0) >= (z1 - z0), half = (alongX ? z1 - z0 : x1 - x0) / 2, rise = half * Math.tan(roof.pitch * Math.PI / 180), top = base + rise;
    var P = function (u, v, y) { return alongX ? [u, y, v] : [v, y, u]; };          // u along the ridge, v across
    var u0 = alongX ? x0 : z0, u1 = alongX ? x1 : z1, v0 = alongX ? z0 : x0, v1 = alongX ? z1 : x1, vm = (v0 + v1) / 2;
    var r0 = roof.kind === "hip" ? u0 + half : u0, r1 = roof.kind === "hip" ? u1 - half : u1;
    if (r1 < r0) { r0 = r1 = (u0 + u1) / 2; }
    T.push([P(u0, v0, base), P(u1, v0, base), P(r1, vm, top), P(r0, vm, top)]);         // the two long slopes
    T.push([P(u1, v1, base), P(u0, v1, base), P(r0, vm, top), P(r1, vm, top)]);
    if (roof.kind === "hip") { T.push([P(u0, v1, base), P(u0, v0, base), P(r0, vm, top), P(r0, vm, top)]); T.push([P(u1, v0, base), P(u1, v1, base), P(r1, vm, top), P(r1, vm, top)]); }
    var gables = roof.kind === "gable" ? [[P(u0, v1, base), P(u0, v0, base), P(u0, vm, top)], [P(u1, v0, base), P(u1, v1, base), P(u1, vm, top)]] : [];
    return { slopes: T, gables: gables, top: top };
  }
  function normalOf(a, b, c) { var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; var n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx], L = Math.hypot(n[0], n[1], n[2]) || 1; return [n[0] / L, n[1] / L, n[2] / L]; }
  var POSES = { stand: "standing", sit: "sitting", walk: "walking", wave: "waving" };
  function personParts(pose, H) {
    var k = H / 1.75, M = "mannequin", up = pose === "sit" ? -0.41 * k : 0, P = [];
    var leg = function (x, yo, z0, z1) { P.push(C(x, yo, z0, z1, 0.065 * k, M)); };
    if (pose === "sit") { [-1, 1].forEach(function (sx) { P.push(B(sx * 0.09 * k, 0.2 * k, 0.37 * k, 0.5 * k, 0.13 * k, 0.46 * k, M)); leg(sx * 0.09 * k, 0.4 * k, 0, 0.45 * k); }); }
    else if (pose === "walk") { leg(-0.09 * k, 0.13 * k, 0, 0.88 * k); leg(0.09 * k, -0.13 * k, 0, 0.88 * k); }
    else { leg(-0.09 * k, 0, 0, 0.88 * k); leg(0.09 * k, 0, 0, 0.88 * k); }
    P.unshift(B(0, 0, 0.86 * k + up, 1.32 * k + up, 0.34 * k, 0.2 * k, M));                         // the body first (its colour)
    P.push(B(0, 0, 1.28 * k + up, 1.44 * k + up, 0.44 * k, 0.22 * k, M));                          // shoulders
    P.push(C(0, 0, 1.44 * k + up, 1.52 * k + up, 0.05 * k, M));                                   // neck
    P.push(C(0, 0, 1.52 * k + up, 1.75 * k + up, 0.1 * k, M));                                    // head
    var arm = function (x, yo, z0, z1) { P.push(C(x, yo, z0 + up, z1 + up, 0.045 * k, M)); };
    if (pose === "walk") { arm(-0.25 * k, -0.1 * k, 0.82 * k, 1.42 * k); arm(0.25 * k, 0.1 * k, 0.82 * k, 1.42 * k); }
    else if (pose === "wave") { arm(-0.25 * k, 0, 0.8 * k, 1.42 * k); arm(0.27 * k, 0, 1.38 * k, 1.96 * k); }
    else if (pose === "sit") { arm(-0.25 * k, 0.08 * k, 0.86 * k, 1.42 * k); arm(0.25 * k, 0.08 * k, 0.86 * k, 1.42 * k); }
    else { arm(-0.25 * k, 0, 0.8 * k, 1.42 * k); arm(0.25 * k, 0, 0.8 * k, 1.42 * k); }
    return P;
  }
  function legs(w, d, h, r, mat) { var x = w / 2 - r * 1.6, y = d / 2 - r * 1.6; return [C(-x, -y, 0, h, r, mat), C(x, -y, 0, h, r, mat), C(-x, y, 0, h, r, mat), C(x, y, 0, h, r, mat)]; }
  function bed(w, d) { return [B(0, 0, 0, 0.3, w, d, "wood"), B(0, 0.03, 0.3, 0.52, w - 0.06, d - 0.08, "linen"), B(0, -d / 2 + 0.04, 0, 1.05, w, 0.08, "wood_dark"),
    B(-w / 4 + 0.02, -d / 2 + 0.3, 0.52, 0.64, w / 2 - 0.14, 0.38, "linen"), B(w / 4 - 0.02, -d / 2 + 0.3, 0.52, 0.64, w / 2 - 0.14, 0.38, "linen"), B(0, d / 4, 0.52, 0.56, w - 0.04, d / 2, "fabric")]; }
  function sofa(w, d, mat) { return [B(0, 0.05, 0.08, 0.42, w - 0.36, d - 0.1, mat), B(0, -d / 2 + 0.11, 0.08, 0.86, w, 0.22, mat), B(-w / 2 + 0.09, 0, 0.08, 0.62, 0.18, d, mat), B(w / 2 - 0.09, 0, 0.08, 0.62, 0.18, d, mat)]
    .concat(legs(w, d, 0.08, 0.025, "black")); }
  function table(w, d, h, mat) { return [B(0, 0, h - 0.04, h, w, d, mat)].concat(legs(w, d, h - 0.04, 0.03, mat)); }
  function chair(mat) { return [B(0, 0, 0.42, 0.46, 0.44, 0.44, mat), B(0, -0.2, 0.46, 0.9, 0.44, 0.04, mat)].concat(legs(0.44, 0.44, 0.42, 0.018, mat)); }
  var CATALOGUE = {
    // living
    sofa: { label: "Sofa (3 seats)", cat: "Living", w: 2.1, d: 0.92, h: 0.86, color: "#6f7480", parts: function (w, d) { return sofa(w, d, "fabric"); } },
    sofa_l: { label: "Corner sofa", cat: "Living", w: 2.6, d: 1.7, h: 0.86, color: "#8a8378", parts: function (w, d) { return sofa(w, 0.92, "fabric").map(function (p) { return Object.assign({}, p, { y: p.y - d / 2 + 0.46 }); }).concat([B(w / 2 - 0.46, 0.46, 0.08, 0.42, 0.92, d - 0.92, "fabric")]); } },
    armchair: { label: "Armchair", cat: "Living", w: 0.85, d: 0.85, h: 0.86, color: "#5b3a26", parts: function (w, d) { return sofa(w, d, "leather"); } },
    coffee_table: { label: "Coffee table", cat: "Living", w: 1.1, d: 0.6, h: 0.42, parts: function (w, d, h) { return table(w, d, h, "wood"); } },
    tv_unit: { label: "TV + unit", cat: "Living", w: 1.8, d: 0.42, h: 1.3, parts: function (w, d) { return [B(0, 0, 0, 0.5, w, d, "wood_dark"), B(0, 0, 0.5, 0.56, 0.3, 0.2, "black"), B(0, 0, 0.56, 1.3, Math.min(1.45, w - 0.2), 0.05, "screen")]; } },
    bookshelf: { label: "Bookshelf", cat: "Living", w: 0.9, d: 0.32, h: 1.9, parts: function (w, d, h) { var p = [B(-w / 2 + 0.02, 0, 0, h, 0.04, d, "wood"), B(w / 2 - 0.02, 0, 0, h, 0.04, d, "wood"), B(0, -d / 2 + 0.01, 0, h, w, 0.02, "wood")]; for (var i = 0; i <= 5; i++) p.push(B(0, 0, i * (h - 0.03) / 5, i * (h - 0.03) / 5 + 0.03, w, d, "wood")); for (var j = 0; j < 5; j++) p.push(B(-0.1 + (j % 2) * 0.12, 0.02, j * (h - 0.03) / 5 + 0.03, j * (h - 0.03) / 5 + 0.27, w * 0.55, d * 0.7, j % 2 ? "fabric" : "leather")); return p; } },
    rug: { label: "Rug", cat: "Living", w: 2.0, d: 1.4, h: 0.01, color: "#9a6d5c", parts: function (w, d) { return [B(0, 0, 0, 0.012, w, d, "carpet")]; } },
    fireplace: { label: "Fireplace", cat: "Living", w: 1.5, d: 0.4, h: 1.15, parts: function (w, d, h) { return [B(0, 0, 0, h, w, d, "stone"), B(0, 0.05, 0.12, 0.72, w * 0.5, d - 0.08, "black"), B(0, 0.1, 0.12, 0.3, w * 0.3, 0.1, "light")]; } },
    piano: { label: "Piano", cat: "Living", w: 1.5, d: 0.6, h: 1.25, parts: function (w, d, h) { return [B(0, -0.1, 0, h, w, d - 0.2, "black"), B(0, 0.18, 0.72, 0.78, w - 0.1, 0.24, "black"), B(0, 0.22, 0.78, 0.8, w - 0.2, 0.16, "ceramic")]; } },
    plant: { label: "Plant", cat: "Living", w: 0.5, d: 0.5, h: 1.3, parts: function (w, d, h) { var r = w / 2; return [C(0, 0, 0, 0.4, r * 0.7, "ceramic"), C(0, 0, 0.38, 0.42, r * 0.66, "soil"), C(0, 0, 0.42, h * 0.7, r, "plant"), C(0, 0, h * 0.7, h, r * 0.7, "plant")]; } },
    // dining + kitchen
    dining_table: { label: "Dining table", cat: "Dining", w: 1.8, d: 0.9, h: 0.75, parts: function (w, d, h) { return table(w, d, h, "wood"); } },
    round_table: { label: "Round table", cat: "Dining", w: 1.1, d: 1.1, h: 0.75, parts: function (w, d, h) { return [C(0, 0, h - 0.04, h, w / 2, "wood"), C(0, 0, 0.03, h - 0.04, 0.05, "wood"), C(0, 0, 0, 0.03, w / 4, "wood")]; } },
    chair: { label: "Chair", cat: "Dining", w: 0.45, d: 0.48, h: 0.9, parts: function () { return chair("wood"); } },
    stool: { label: "Bar stool", cat: "Dining", w: 0.4, d: 0.4, h: 0.75, parts: function (w, d, h) { return [C(0, 0, h - 0.05, h, w / 2, "leather"), C(0, 0, 0.02, h - 0.05, 0.03, "chrome"), C(0, 0, 0, 0.02, w / 2 - 0.02, "chrome")]; } },
    kitchen_base: { label: "Kitchen bench", cat: "Kitchen", w: 1.8, d: 0.62, h: 0.92, parts: function (w, d, h) { return [B(0, -0.01, 0.1, h - 0.04, w, d - 0.04, "frame"), B(0, -0.02, 0, 0.1, w, d - 0.08, "black"), B(0, 0, h - 0.04, h, w + 0.02, d, "marble")]; } },
    kitchen_wall: { label: "Wall cupboards", cat: "Kitchen", w: 1.8, d: 0.35, h: 0.7, parts: function (w, d, h) { return [B(0, 0, 1.45, 1.45 + h, w, d, "frame")]; } },
    island: { label: "Kitchen island", cat: "Kitchen", w: 2.0, d: 0.95, h: 0.92, parts: function (w, d, h) { return [B(0, 0, 0, h - 0.04, w - 0.1, d - 0.2, "wood_dark"), B(0, 0, h - 0.04, h, w, d, "marble")]; } },
    sink: { label: "Sink bench", cat: "Kitchen", w: 0.9, d: 0.62, h: 0.92, parts: function (w, d, h) { return [B(0, -0.01, 0, h - 0.04, w, d - 0.04, "frame"), B(0, 0, h - 0.04, h, w + 0.02, d, "marble"), B(0, 0.03, h - 0.035, h + 0.002, w * 0.6, d * 0.6, "chrome"), C(0, -d / 2 + 0.08, h, h + 0.3, 0.02, "chrome")]; } },
    stove: { label: "Cooktop + oven", cat: "Kitchen", w: 0.6, d: 0.62, h: 0.92, parts: function (w, d, h) { return [B(0, -0.01, 0, h - 0.04, w, d - 0.04, "metal"), B(0, 0, h - 0.04, h, w, d, "black"), B(0, d / 2 - 0.02, 0.15, 0.7, w - 0.08, 0.02, "screen")]; } },
    fridge: { label: "Fridge", cat: "Kitchen", w: 0.75, d: 0.7, h: 1.85, parts: function (w, d, h) { return [B(0, 0, 0, h, w, d, "metal"), B(w / 2 - 0.06, d / 2 + 0.01, 0.9, 1.6, 0.03, 0.03, "chrome")]; } },
    // bedroom
    bed_single: { label: "Single bed", cat: "Bedroom", w: 0.95, d: 2.05, h: 1.05, parts: function (w, d) { return bed(w, d); } },
    bed_double: { label: "Double bed", cat: "Bedroom", w: 1.4, d: 2.05, h: 1.05, parts: function (w, d) { return bed(w, d); } },
    bed_queen: { label: "Queen bed", cat: "Bedroom", w: 1.6, d: 2.1, h: 1.05, parts: function (w, d) { return bed(w, d); } },
    bed_king: { label: "King bed", cat: "Bedroom", w: 1.9, d: 2.1, h: 1.05, parts: function (w, d) { return bed(w, d); } },
    bedside: { label: "Bedside table", cat: "Bedroom", w: 0.45, d: 0.4, h: 0.5, parts: function (w, d, h) { return [B(0, 0, 0.05, h, w, d, "wood"), B(0, d / 2, 0.3, 0.32, w * 0.4, 0.02, "chrome")]; } },
    wardrobe: { label: "Wardrobe", cat: "Bedroom", w: 1.2, d: 0.6, h: 2.1, parts: function (w, d, h) { return [B(0, 0, 0, h, w, d, "wood"), B(0, d / 2 + 0.005, 0.05, h - 0.05, 0.01, 0.01, "black")]; } },
    desk: { label: "Desk", cat: "Bedroom", w: 1.4, d: 0.7, h: 0.75, parts: function (w, d, h) { return table(w, d, h, "wood").concat([B(w / 2 - 0.25, 0, 0.1, h - 0.04, 0.42, d - 0.06, "wood")]); } },
    office_chair: { label: "Office chair", cat: "Bedroom", w: 0.6, d: 0.6, h: 1.05, parts: function () { return [C(0, 0, 0, 0.06, 0.3, "black"), C(0, 0, 0.06, 0.44, 0.03, "chrome"), B(0, 0, 0.44, 0.52, 0.5, 0.5, "fabric"), B(0, -0.24, 0.55, 1.05, 0.46, 0.06, "fabric")]; } },
    // bathroom
    bathtub: { label: "Bath", cat: "Bathroom", w: 1.7, d: 0.75, h: 0.56, parts: function (w, d, h) { return [B(0, 0, 0, h, w, d, "ceramic"), B(0, 0, h - 0.08, h - 0.02, w - 0.16, d - 0.16, "glass")]; } },
    shower: { label: "Shower", cat: "Bathroom", w: 0.9, d: 0.9, h: 2.0, parts: function (w, d, h) { return [B(0, 0, 0, 0.05, w, d, "ceramic"), B(0, d / 2 - 0.01, 0.05, h, w, 0.02, "glass"), B(w / 2 - 0.01, 0, 0.05, h, 0.02, d, "glass"), C(-w / 2 + 0.12, -d / 2 + 0.12, 1.9, 1.95, 0.1, "chrome")]; } },
    toilet: { label: "Toilet", cat: "Bathroom", w: 0.4, d: 0.68, h: 0.8, parts: function (w, d) { return [B(0, -d / 2 + 0.1, 0.35, 0.8, w, 0.2, "ceramic"), C(0, 0.06, 0, 0.4, 0.19, "ceramic"), C(0, 0.06, 0.4, 0.43, 0.2, "ceramic")]; } },
    vanity: { label: "Basin vanity", cat: "Bathroom", w: 0.8, d: 0.46, h: 0.86, parts: function (w, d, h) { return [B(0, 0, 0.15, h - 0.04, w, d, "wood"), B(0, 0, h - 0.04, h, w + 0.02, d + 0.02, "marble"), C(0, 0.02, h, h + 0.12, 0.18, "ceramic"), B(0, -d / 2 + 0.01, h + 0.3, h + 1.0, w * 0.9, 0.02, "glass")]; } },
    washer: { label: "Washing machine", cat: "Bathroom", w: 0.6, d: 0.6, h: 0.85, parts: function (w, d, h) { return [B(0, 0, 0, h, w, d, "ceramic"), C(0, d / 2, 0.25, 0.27, 0.18, "black", { face: true })]; } },
    // lights
    ceiling_light: { label: "Ceiling light", cat: "Lights", w: 0.45, d: 0.45, h: 0.12, light: { z: -0.15, top: true, intensity: 1 }, parts: function (w, d, h) { return [C(0, 0, -h, 0, w / 2, "light", { top: true })]; } },
    pendant: { label: "Pendant light", cat: "Lights", w: 0.4, d: 0.4, h: 0.9, light: { z: -0.8, top: true, intensity: 0.9 }, parts: function (w, d, h) { return [C(0, 0, -h, -h + 0.25, w / 2, "black", { top: true }), C(0, 0, -h - 0.01, -h + 0.02, w / 2 - 0.03, "light", { top: true }), C(0, 0, -h + 0.25, 0, 0.006, "black", { top: true })]; } },
    floor_lamp: { label: "Floor lamp", cat: "Lights", w: 0.4, d: 0.4, h: 1.65, light: { z: 1.45, intensity: 0.7 }, parts: function (w, d, h) { return [C(0, 0, 0, 0.03, 0.16, "metal"), C(0, 0, 0.03, h - 0.3, 0.014, "metal"), C(0, 0, h - 0.32, h, w / 2, "linen")]; } },
    table_lamp: { label: "Table lamp", cat: "Lights", w: 0.3, d: 0.3, h: 0.55, z: 0.5, light: { z: 0.9, intensity: 0.45 }, parts: function (w, d, h) { return [C(0, 0, 0.5, 0.82, 0.07, "ceramic"), C(0, 0, 0.82, 1.05, w / 2, "linen")]; } },
    // outside / garage
    car: { label: "Car", cat: "Outside", w: 1.85, d: 4.5, h: 1.45, parts: function (w, d) { return [B(0, 0, 0.3, 0.85, w, d, "paint_car"), B(0, -0.2, 0.85, 1.42, w - 0.2, d * 0.5, "glass"), B(0, -0.2, 1.4, 1.45, w - 0.24, d * 0.48, "paint_car"),
      C(-w / 2 + 0.12, -d / 2 + 0.8, 0, 0.66, 0.33, "rubber", { axis: "x", len: 0.24 }), C(w / 2 - 0.12, -d / 2 + 0.8, 0, 0.66, 0.33, "rubber", { axis: "x", len: 0.24 }),
      C(-w / 2 + 0.12, d / 2 - 0.8, 0, 0.66, 0.33, "rubber", { axis: "x", len: 0.24 }), C(w / 2 - 0.12, d / 2 - 0.8, 0, 0.66, 0.33, "rubber", { axis: "x", len: 0.24 })]; } },
    box: { label: "Box / block", cat: "Outside", w: 1, d: 1, h: 1, parts: function (w, d, h) { return [B(0, 0, 0, h, w, d, "concrete")]; } },
    // 2.579.0: a 3D model sent in (the 📐 SolidCraft docker's "Send to House builder") - its mesh (MODELS[item.model]),
    // a box of its size until that is loaded; never in the furniture list or the ✨ furnisher (hidden)
    model: { label: "3D model", cat: "Imported", hidden: true, w: 1, d: 1, h: 1, color: "#b4bcc8", parts: function (w, d, h) { return [B(0, 0, 0, h, w, d, "paint")]; } },
  };
  /* 2.579.0: the 3D models items use: name -> {pos, nrm (triangles, metres: x right, y back, z up, centred on x / y,
     standing on z 0), size: [w, d, h]} - loadModel(name, objText) from an OBJ in millimetres with Z up (SolidCraft's) */
  var MODELS = {};
  function loadModel(name, text) {
    var V = [], N = [], pos = [], nrm = [];
    String(text || "").split(/\r?\n/).forEach(function (l) {
      var t = l.trim().split(/\s+/);
      if (t[0] === "v") V.push([+t[1] / 1000, +t[2] / 1000, +t[3] / 1000]);
      else if (t[0] === "vn") N.push([+t[1], +t[2], +t[3]]);
      else if (t[0] === "f" && t.length >= 4) {
        var ix = t.slice(1).map(function (q) { var a = q.split("/"); var vi = parseInt(a[0], 10), ni = parseInt(a[2], 10); return [vi < 0 ? V.length + vi : vi - 1, ni ? (ni < 0 ? N.length + ni : ni - 1) : -1]; });
        for (var k = 1; k + 1 < ix.length; k++) {
          var tri = [ix[0], ix[k], ix[k + 1]], P = tri.map(function (q) { return V[q[0]]; });
          if (P.some(function (p) { return !p; })) continue;
          var fn = normalOf(P[0], P[1], P[2]);
          tri.forEach(function (q, j) { pos.push(P[j][0], P[j][1], P[j][2]); var n = q[1] >= 0 && N[q[1]] ? N[q[1]] : fn; nrm.push(n[0], n[1], n[2]); });
        }
      }
    });
    if (!pos.length) return null;
    var mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (var i = 0; i < pos.length; i += 3) for (var j = 0; j < 3; j++) { mn[j] = Math.min(mn[j], pos[i + j]); mx[j] = Math.max(mx[j], pos[i + j]); }
    var cx = (mn[0] + mx[0]) / 2, cy = (mn[1] + mx[1]) / 2;
    for (var q = 0; q < pos.length; q += 3) { pos[q] -= cx; pos[q + 1] -= cy; pos[q + 2] -= mn[2]; }
    var m = { pos: pos, nrm: nrm, size: [Math.max(1e-4, mx[0] - mn[0]), Math.max(1e-4, mx[1] - mn[1]), Math.max(1e-4, mx[2] - mn[2])] };
    MODELS[String(name)] = m;
    return m;
  }
  var OPENINGS = {
    door: { label: "Door", w: 0.9, h: 2.1, sill: 0 }, window: { label: "Window", w: 1.2, h: 1.2, sill: 0.9 },
    slide: { label: "Glass sliding door", w: 2.4, h: 2.1, sill: 0 }, opening: { label: "Opening (no door)", w: 1.2, h: 2.1, sill: 0 },
    garage: { label: "Garage door", w: 2.6, h: 2.2, sill: 0 },
  };

  /* ---------------- small maths */
  function num(v, d, lo, hi) { var x = Number(v); if (!isFinite(x)) x = d; if (lo != null && x < lo) x = lo; if (hi != null && x > hi) x = hi; return x; }
  function r3(x) { return Math.round(x * 1000) / 1000; }
  function pt(p) { return [r3(num(p && p[0], 0, -500, 500)), r3(num(p && p[1], 0, -500, 500))]; }
  function dist(a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]); }
  function area(poly) { var s = 0; for (var i = 0; i < poly.length; i++) { var a = poly[i], b = poly[(i + 1) % poly.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
  function centroid(poly) {
    var A = area(poly), cx = 0, cy = 0;
    if (Math.abs(A) < 1e-9) { poly.forEach(function (p) { cx += p[0]; cy += p[1]; }); return [cx / (poly.length || 1), cy / (poly.length || 1)]; }
    for (var i = 0; i < poly.length; i++) { var a = poly[i], b = poly[(i + 1) % poly.length], f = a[0] * b[1] - b[0] * a[1]; cx += (a[0] + b[0]) * f; cy += (a[1] + b[1]) * f; }
    return [cx / (6 * A), cy / (6 * A)];
  }
  function inside(p, poly) { var c = false; for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) { var a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  /** ear clipping with holes (holes bridged to the outline) -> triangles as index triples into the merged point list */
  function triangulate(outer, holes) {
    var P = outer.slice();
    if (area(P) < 0) P.reverse();                                   // counter-clockwise (in x, y)
    (holes || []).slice().sort(function (h1, h2) { return Math.max.apply(null, h2.map(function (q) { return q[0]; })) - Math.max.apply(null, h1.map(function (q) { return q[0]; })); }).forEach(function (h0) {
      var H = h0.slice(); if (area(H) > 0) H.reverse();              // holes clockwise
      var hi = 0; H.forEach(function (q, i) { if (q[0] > H[hi][0]) hi = i; });
      var hp = H[hi], best = -1, bd = Infinity;
      P.forEach(function (q, i) { if (q[0] >= hp[0] - 1e-9) { var d = dist(q, hp); if (d < bd && visible(P, hp, q)) { bd = d; best = i; } } });
      if (best < 0) P.forEach(function (q, i) { var d = dist(q, hp); if (d < bd) { bd = d; best = i; } });
      var ring = H.slice(hi).concat(H.slice(0, hi)); ring.push(H[hi]);
      P = P.slice(0, best + 1).concat(ring, [P[best]], P.slice(best + 1));
    });
    var idx = P.map(function (_, i) { return i; }), tris = [], guard = 0;
    while (idx.length > 3 && guard++ < 10000) {
      var cut = false;
      for (var k = 0; k < idx.length; k++) {
        var i0 = idx[(k + idx.length - 1) % idx.length], i1 = idx[k], i2 = idx[(k + 1) % idx.length];
        var a = P[i0], b = P[i1], c = P[i2];
        if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) <= 1e-12) continue;   // reflex / flat
        var ok = true;
        for (var m = 0; m < idx.length && ok; m++) { var q = P[idx[m]]; if (idx[m] === i0 || idx[m] === i1 || idx[m] === i2) continue; if ((q[0] === a[0] && q[1] === a[1]) || (q[0] === b[0] && q[1] === b[1]) || (q[0] === c[0] && q[1] === c[1])) continue; if (inTri(q, a, b, c)) ok = false; }
        if (!ok) continue;
        tris.push([i0, i1, i2]); idx.splice(k, 1); cut = true; break;
      }
      if (!cut) { idx.splice(0, 1); }                                // degenerate leftovers
    }
    if (idx.length === 3) tris.push(idx.slice());
    return { points: P, tris: tris };
  }
  function inTri(p, a, b, c) {
    var d1 = (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]), d2 = (p[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (p[1] - c[1]), d3 = (p[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (p[1] - a[1]);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  }
  function visible(P, a, b) {
    for (var i = 0; i < P.length; i++) { var c = P[i], d = P[(i + 1) % P.length]; if (c === b || d === b) continue; if (segX(a, b, c, d)) return false; }
    return true;
  }
  function segX(a, b, c, d) { var o = function (p, q, r) { return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); }; return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; }

  /* ---------------- the model, cleaned */
  var nid = 0;
  function id(p) { nid++; return (p || "x") + Date.now().toString(36).slice(-4) + nid.toString(36); }
  function normalize(m) {
    var o = m || {};
    var floors = (Array.isArray(o.floors) && o.floors.length ? o.floors : [{ name: "Ground floor" }]).slice(0, 8).map(function (f, i) { return { id: String(f.id || "f" + (i + 1)), name: String(f.name || (i ? "Floor " + (i + 1) : "Ground floor")).slice(0, 40), height: r3(num(f.height, 2.7, 2, 6)) }; });
    var nf = floors.length;
    var fl = function (v) { return Math.round(num(v, 0, 0, nf - 1)); };
    // 2.539.0: pictures from the References docker, kept with the house (lib/house.js refs/<file>) - a wall's / a floor's
    // texture, the look of a piece of furniture / a light (✨ Make it real paints them in)
    var refs = (o.refs || []).slice(0, 100).filter(function (q) { return q && /^[A-Za-z0-9._-]{1,80}$/.test(String(q.file || "")) && !/^\./.test(String(q.file)); }).map(function (q) {
      return { id: /^[A-Za-z0-9_-]{1,40}$/.test(String(q.id || "")) ? String(q.id) : id("x"), file: String(q.file), kind: REF_KINDS.indexOf(q.kind) >= 0 ? q.kind : "other", desc: String(q.desc || "").replace(/\s+/g, " ").trim().slice(0, 200) }; });
    var refIds = {}; refs.forEach(function (q) { refIds[q.id] = q; });
    var texOf = function (x) { return x && x.tex && refIds[x.tex] ? { tex: String(x.tex), texScale: r3(num(x.texScale, 1, 0.1, 10)) } : {}; };
    var lookOf = function (x) { return x && x.ref && refIds[x.ref] ? { ref: String(x.ref) } : {}; };
    var walls = (o.walls || []).slice(0, 3000).filter(function (w) { return w && w.a && w.b && dist(pt(w.a), pt(w.b)) > 0.05; }).map(function (w) { return Object.assign({ id: String(w.id || id("w")), floor: fl(w.floor), a: pt(w.a), b: pt(w.b), thick: r3(num(w.thick, 0.15, 0.05, 0.6)), mat: MATERIALS[w.mat] ? w.mat : "plaster", color: col(w.color, MATERIALS[MATERIALS[w.mat] ? w.mat : "plaster"].color) }, texOf(w)); });
    var wids = {}; walls.forEach(function (w) { wids[w.id] = w; });
    var openings = (o.openings || []).slice(0, 2000).filter(function (q) { return q && wids[q.wall]; }).map(function (q) {
      var k = OPENINGS[q.kind] ? q.kind : "door", d = OPENINGS[k], w = wids[q.wall], L = dist(w.a, w.b), H = floors[w.floor].height;
      var ww = r3(num(q.w, d.w, 0.3, Math.max(0.3, L - 0.1))), hh = r3(num(q.h, d.h, 0.3, H)), sill = r3(num(q.sill, d.sill, 0, Math.max(0, H - hh)));
      return { id: String(q.id || id("o")), wall: q.wall, kind: k, t: r3(num(q.t, L / 2, ww / 2, Math.max(ww / 2, L - ww / 2))), w: ww, h: hh, sill: sill };
    });
    var rooms = (o.rooms || []).slice(0, 500).filter(function (r) { return r && Array.isArray(r.poly) && r.poly.length >= 3; }).map(function (r) { var mat = MATERIALS[r.mat] ? r.mat : "oak"; return Object.assign({ id: String(r.id || id("r")), floor: fl(r.floor), name: String(r.name || "Room").slice(0, 40), poly: r.poly.slice(0, 64).map(pt), mat: mat, color: col(r.color, MATERIALS[mat].color), ceiling: r.ceiling !== false }, texOf(r)); });
    var items = (o.items || []).slice(0, 3000).filter(function (it) { return it && CATALOGUE[it.type] && (it.type !== "model" || modelName(it.model)); }).map(function (it) { var c = CATALOGUE[it.type]; return Object.assign({ id: String(it.id || id("i")), floor: fl(it.floor), type: it.type, x: r3(num(it.x, 0, -500, 500)), y: r3(num(it.y, 0, -500, 500)), rot: r3(((num(it.rot, 0) % 360) + 360) % 360), w: r3(num(it.w, c.w, 0.05, 20)), d: r3(num(it.d, c.d, 0.05, 20)), h: r3(num(it.h, c.h, 0.01, 6)), color: col(it.color, c.color || "") }, it.type === "model" ? { model: modelName(it.model) } : {}, lookOf(it)); });
    var stairs = (o.stairs || []).slice(0, 50).map(function (s) { return { id: String(s.id || id("s")), floor: fl(s.floor), x: r3(num(s.x, 0)), y: r3(num(s.y, 0)), rot: r3(((num(s.rot, 0) % 360) + 360) % 360), w: r3(num(s.w, 1, 0.6, 3)), len: r3(num(s.len, 3.6, 1.5, 8)) }; });
    var people = (o.people || []).slice(0, 60).map(function (q) { return { id: String(q.id || id("p")), floor: fl(q.floor), x: r3(num(q.x, 0)), y: r3(num(q.y, 0)), rot: r3(((num(q.rot, 90) % 360) + 360) % 360),
      pose: POSES[q.pose] ? q.pose : "stand", h: r3(num(q.h, 1.75, 0.9, 2.3)), char: /^[A-Za-z0-9_-]{1,40}$/.test(String(q.char || "")) ? String(q.char) : "", name: String(q.name || "").slice(0, 40), color: col(q.color, ""),
      lora: typeof q.lora === "string" && q.lora.trim() && q.lora.indexOf("..") < 0 ? q.lora.trim().slice(0, 300) : "", lw: r3(num(q.lw, 0.8, -2, 2)) }; });
    var rf = o.roof || {}, rmat = MATERIALS[rf.mat] && /^roof_|^concrete$/.test(rf.mat) ? rf.mat : "roof_tiles";
    var roof = { kind: ROOFS[rf.kind] ? rf.kind : "none", pitch: r3(num(rf.pitch, 25, 5, 60)), overhang: r3(num(rf.overhang, 0.4, 0, 1.5)), mat: rmat, color: col(rf.color, MATERIALS[rmat].color) };
    var tr = o.trace && typeof o.trace === "object" && /^trace\.(png|jpe?g|webp)$/.test(String(o.trace.file || "")) ? o.trace : null;
    var trace = tr ? { file: tr.file, x: r3(num(tr.x, 0, -500, 500)), y: r3(num(tr.y, 0, -500, 500)), mpp: Math.max(0.0005, Math.min(1, num(tr.mpp, 0.02))), opacity: r3(num(tr.opacity, 0.5, 0.05, 1)), floor: fl(tr.floor) } : null;
    var cameras = (o.cameras || []).slice(0, 100).map(function (c, i) { return { id: String(c.id || id("c")), floor: fl(c.floor), name: String(c.name || "Camera " + (i + 1)).slice(0, 40), x: r3(num(c.x, 0)), y: r3(num(c.y, 0)), z: r3(num(c.z, 1.6, 0.1, 40)), yaw: r3(((num(c.yaw, 0) % 360) + 360) % 360), pitch: r3(num(c.pitch, 0, -80, 80)), fov: r3(num(c.fov, 70, 20, 120)) }; });
    // 2.538.0: ◯ lights placed on the plan (Tim: "add a circle to the toolbar in home builder, this will show location for lights")
    var lights = (o.lights || []).slice(0, 200).map(function (q, i) { var fq = fl(q.floor); return Object.assign({ id: String(q.id || id("l")), floor: fq, name: String(q.name || "Light " + (i + 1)).slice(0, 40), x: r3(num(q.x, 0, -500, 500)), y: r3(num(q.y, 0, -500, 500)),
      z: r3(num(q.z, Math.max(0.3, floors[fq].height - 0.3), 0.05, Math.max(0.1, floors[fq].height + 3))), intensity: r3(num(q.intensity, 1, 0.1, 5)), color: col(q.color, "#ffd9a0"), reach: r3(num(q.reach, 4, 0.5, 30)) }, lookOf(q)); });
    var L = o.light || {};
    return { v: 1, name: String(o.name || "My house").slice(0, 60), floors: floors, walls: walls, openings: openings, rooms: rooms, items: items, stairs: stairs, cameras: cameras, people: people, lights: lights, refs: refs, roof: roof, trace: trace,
      light: { hour: r3(num(L.hour, 14, 0, 24)), north: r3(num(L.north, 0, -360, 360)), sun: L.sun !== false, lamps: !!L.lamps, ambient: r3(num(L.ambient, 0.55, 0, 2)) } };
  }
  /** a 3D model item's file: a plain name in the project's 3D models (models3d) or "" (pure) */
  function modelName(n) { var s2 = String(n == null ? "" : n); return /^[\w .()+,&'-]{1,120}\.(obj)$/i.test(s2) && s2.indexOf("..") < 0 ? s2 : ""; }
  function col(c, d) { var s = String(c || ""); return /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : d; }
  /* 2.532.0: how high a walking camera goes (Tim: "shift button raises cameras elevation to maximum 3m over the roof,
     alt button drops camera elevation to min. ground floor floor") -> {min, max, top} absolute (the ground floor = 0) */
  function heightRange(m) {
    var E = elevations(m), tf = m.floors.length - 1, base = E[tf] + m.floors[tf].height, top = base;
    var rw = (m.walls || []).filter(function (w) { return w.floor === tf; });
    if (m.roof && m.roof.kind && m.roof.kind !== "none" && rw.length) {
      if (m.roof.kind === "flat") top = base + 0.55;
      else {
        var xs = [], zs = []; rw.forEach(function (w) { xs.push(w.a[0], w.b[0]); zs.push(w.a[1], w.b[1]); });
        var o = m.roof.overhang || 0, wx = Math.max.apply(null, xs) - Math.min.apply(null, xs) + 2 * o, wz = Math.max.apply(null, zs) - Math.min.apply(null, zs) + 2 * o;
        top = base + Math.min(wx, wz) / 2 * Math.tan((m.roof.pitch || 25) * Math.PI / 180);
      }
    }
    return { min: 0.15, max: r3(top + 3), top: r3(top) };
  }
  /** 2.532.0: an absolute eye height -> {floor, z} on the highest floor it is over */
  function camAt(m, abs) {
    var E = elevations(m), f = 0;
    for (var i = 0; i < E.length; i++) if (abs >= E[i] + 0.1) f = i;
    return { floor: f, z: Math.max(0.1, abs - E[f]) };
  }
  function elevations(m) { var e = [], z = 0; (m.floors || []).forEach(function (f) { e.push(r3(z)); z += f.height + SLAB; }); return e; }

  /* ---------------- walls around openings */
  /** the solid pieces of a wall: [{s0, s1, z0, z1}] along it (metres from a), its openings cut out */
  function wallPieces(L, H, ops) {
    var o = (ops || []).map(function (q) { return { a: Math.max(0, q.t - q.w / 2), b: Math.min(L, q.t + q.w / 2), z0: q.sill, z1: Math.min(H, q.sill + q.h) }; }).filter(function (q) { return q.b - q.a > 0.01; }).sort(function (p, q) { return p.a - q.a; });
    var out = [], s = 0;
    o.forEach(function (q) {
      if (q.a > s + 0.001) out.push({ s0: s, s1: q.a, z0: 0, z1: H });
      var a = Math.max(q.a, s);
      if (q.b > a) {
        if (q.z0 > 0.001) out.push({ s0: a, s1: q.b, z0: 0, z1: q.z0 });
        if (q.z1 < H - 0.001) out.push({ s0: a, s1: q.b, z0: q.z1, z1: H });
      }
      s = Math.max(s, q.b);
    });
    if (s < L - 0.001) out.push({ s0: s, s1: L, z0: 0, z1: H });
    return out;
  }

  /* ---------------- mesh building (grouped by material + colour) */
  function Acc() { this.g = {}; }
  /** 2.539.0: tex = {file, scale} - a reference picture on it (its own mesh: the 3D view maps the picture, scale m a tile) */
  Acc.prototype.get = function (mat, color, tex) {
    var c = color || (MATERIALS[mat] || MATERIALS.paint).color, k = mat + "|" + c + (tex ? "|" + tex.file + "@" + tex.scale : "");
    return this.g[k] || (this.g[k] = tex ? { key: k, mat: mat, color: c, tex: tex.file, texScale: tex.scale, pos: [], nrm: [], uv: [], idx: [] } : { key: k, mat: mat, color: c, pos: [], nrm: [], uv: [], idx: [] });
  };
  Acc.prototype.quad = function (mesh, p0, p1, p2, p3, n, uvs) {
    var b = mesh.pos.length / 3;
    [p0, p1, p2, p3].forEach(function (p, i) { mesh.pos.push(p[0], p[1], p[2]); mesh.nrm.push(n[0], n[1], n[2]); mesh.uv.push(uvs[i][0], uvs[i][1]); });
    mesh.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  /** an oriented box: centre (cx, cz) on the plan, half sizes hu (along angle a) / hv, from y0 to y1 */
  Acc.prototype.box = function (mesh, cx, cz, a, hu, hv, y0, y1) {
    var cu = Math.cos(a), su = Math.sin(a);
    var P = function (u, v, y) { return [cx + u * cu - v * su, y, cz + u * su + v * cu]; };
    var U = [cu, 0, su], V = [-su, 0, cu], W = 2 * hu, D = 2 * hv, Hh = y1 - y0;
    var neg = function (n) { return [-n[0], -n[1], -n[2]]; };
    // +v / -v faces (the long sides), +u / -u (the ends), top, bottom
    this.quad(mesh, P(-hu, hv, y0), P(hu, hv, y0), P(hu, hv, y1), P(-hu, hv, y1), V, [[0, y0], [W, y0], [W, y1], [0, y1]]);
    this.quad(mesh, P(hu, -hv, y0), P(-hu, -hv, y0), P(-hu, -hv, y1), P(hu, -hv, y1), neg(V), [[0, y0], [W, y0], [W, y1], [0, y1]]);
    this.quad(mesh, P(hu, hv, y0), P(hu, -hv, y0), P(hu, -hv, y1), P(hu, hv, y1), U, [[0, y0], [D, y0], [D, y1], [0, y1]]);
    this.quad(mesh, P(-hu, -hv, y0), P(-hu, hv, y0), P(-hu, hv, y1), P(-hu, -hv, y1), neg(U), [[0, y0], [D, y0], [D, y1], [0, y1]]);
    this.quad(mesh, P(-hu, hv, y1), P(hu, hv, y1), P(hu, -hv, y1), P(-hu, -hv, y1), [0, 1, 0], [[0, 0], [W, 0], [W, D], [0, D]]);
    if (Hh > 0) this.quad(mesh, P(-hu, -hv, y0), P(hu, -hv, y0), P(hu, hv, y0), P(-hu, hv, y0), [0, -1, 0], [[0, 0], [W, 0], [W, D], [0, D]]);
  };
  /** a cylinder (16 sides) standing up, or lying along its item's x (axis "x") */
  Acc.prototype.cyl = function (mesh, cx, cz, a, r, y0, y1, o) {
    var n = 16, ca = Math.cos(a), sa = Math.sin(a), self = this;
    if (o && o.axis === "x") {                                        // a wheel: its axis across the item, centre at y0..y1 middle
      var len = o.len || 0.2, cy = (y0 + y1) / 2, rr = (y1 - y0) / 2;
      for (var i = 0; i < n; i++) {
        var t0 = i / n * Math.PI * 2, t1 = (i + 1) / n * Math.PI * 2;
        var p = function (s, t) { var v = Math.cos(t) * rr; return [cx + s * ca - v * sa, cy + Math.sin(t) * rr, cz + s * sa + v * ca]; };
        var nm = [-Math.cos((t0 + t1) / 2) * sa, Math.sin((t0 + t1) / 2), Math.cos((t0 + t1) / 2) * ca];
        self.quad(mesh, p(-len / 2, t0), p(len / 2, t0), p(len / 2, t1), p(-len / 2, t1), nm, [[0, 0], [len, 0], [len, rr], [0, rr]]);
      }
      return;
    }
    for (var k = 0; k < n; k++) {
      var a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2, x0 = cx + Math.cos(a0) * r, z0 = cz + Math.sin(a0) * r, x1 = cx + Math.cos(a1) * r, z1 = cz + Math.sin(a1) * r, am = (a0 + a1) / 2;
      var arc = r * Math.PI * 2 / n;
      self.quad(mesh, [x1, y0, z1], [x0, y0, z0], [x0, y1, z0], [x1, y1, z1], [Math.cos(am), 0, Math.sin(am)], [[k * arc + arc, y0], [k * arc, y0], [k * arc, y1], [k * arc + arc, y1]]);
      var b = mesh.pos.length / 3;                                     // top cap triangle (+ bottom)
      mesh.pos.push(cx, y1, cz, x1, y1, z1, x0, y1, z0); mesh.nrm.push(0, 1, 0, 0, 1, 0, 0, 1, 0); mesh.uv.push(cx, cz, x1, z1, x0, z0); mesh.idx.push(b, b + 1, b + 2);
      if (y0 > 0.001) { b = mesh.pos.length / 3; mesh.pos.push(cx, y0, cz, x0, y0, z0, x1, y0, z1); mesh.nrm.push(0, -1, 0, 0, -1, 0, 0, -1, 0); mesh.uv.push(cx, cz, x0, z0, x1, z1); mesh.idx.push(b, b + 1, b + 2); }
    }
  };
  /** a flat polygon (with holes) at height y, facing up (or down) */
  Acc.prototype.slab = function (mesh, poly, holes, y, down) {
    var t = triangulate(poly, holes), b = mesh.pos.length / 3;
    t.points.forEach(function (p) { mesh.pos.push(p[0], y, p[1]); mesh.nrm.push(0, down ? -1 : 1, 0); mesh.uv.push(p[0], p[1]); });
    // the points run counter-clockwise in (x, y) = clockwise seen from +Y with Z = y -> the order that faces +Y is reversed
    t.tris.forEach(function (tr) { if (down) mesh.idx.push(b + tr[0], b + tr[1], b + tr[2]); else mesh.idx.push(b + tr[0], b + tr[2], b + tr[1]); });
  };

  /** everything as meshes: opts {upTo: the top floor shown (default all), ceilings, hideAbove} */
  function build(model, opts) {
    var m = model && model.v ? model : normalize(model), o = opts || {}, acc = new Acc(), lights = [];
    var refById = {}; (m.refs || []).forEach(function (q) { refById[q.id] = q; });
    var texFor = function (x) { var q = x && x.tex ? refById[x.tex] : null; return q ? { file: q.file, scale: x.texScale || 1 } : null; };   // 2.539.0
    var E = elevations(m), top = o.upTo == null ? m.floors.length - 1 : Math.min(o.upTo, m.floors.length - 1);
    var show = function (f) { return f <= top; };
    var ends = {};
    m.walls.forEach(function (w) { [w.a, w.b].forEach(function (p) { var k = w.floor + ":" + Math.round(p[0] * 100) + ":" + Math.round(p[1] * 100); ends[k] = (ends[k] || 0) + 1; }); });
    var joined = function (f, p) { return (ends[f + ":" + Math.round(p[0] * 100) + ":" + Math.round(p[1] * 100)] || 0) > 1; };
    var byWall = {}; m.openings.forEach(function (q) { (byWall[q.wall] = byWall[q.wall] || []).push(q); });
    m.walls.forEach(function (w) {
      if (!show(w.floor)) return;
      var H = m.floors[w.floor].height, y = E[w.floor], L = dist(w.a, w.b), ang = Math.atan2(w.b[1] - w.a[1], w.b[0] - w.a[0]);
      var ea = joined(w.floor, w.a) ? w.thick / 2 : 0, eb = joined(w.floor, w.b) ? w.thick / 2 : 0;
      var ux = Math.cos(ang), uy = Math.sin(ang), mesh = acc.get(w.mat, w.color, texFor(w));
      wallPieces(L, H, byWall[w.id]).forEach(function (pc) {
        var s0 = pc.s0 === 0 ? -ea : pc.s0, s1 = Math.abs(pc.s1 - L) < 1e-6 ? L + eb : pc.s1, mid = (s0 + s1) / 2;
        acc.box(mesh, w.a[0] + ux * mid, w.a[1] + uy * mid, ang, (s1 - s0) / 2, w.thick / 2, y + pc.z0, y + pc.z1);
      });
      (byWall[w.id] || []).forEach(function (q) {                       // what fills the opening
        var cx = w.a[0] + ux * q.t, cz = w.a[1] + uy * q.t, y0 = y + q.sill, y1 = y + q.sill + q.h;
        if (q.kind === "door") acc.box(acc.get("wood", "#d8cdbd"), cx, cz, ang, q.w / 2 - 0.01, 0.02, y0, y1 - 0.005);
        else if (q.kind === "garage") acc.box(acc.get("metal", "#c9c6c0"), cx, cz, ang, q.w / 2 - 0.01, 0.03, y0, y1 - 0.005);
        else if (q.kind === "window" || q.kind === "slide") {
          var fr = acc.get("frame");
          acc.box(acc.get("glass"), cx, cz, ang, q.w / 2 - 0.03, 0.012, y0 + 0.03, y1 - 0.03);
          acc.box(fr, cx, cz, ang, q.w / 2, w.thick / 2 + 0.01, y0, y0 + 0.04);
          acc.box(fr, cx, cz, ang, q.w / 2, w.thick / 2 + 0.005, y1 - 0.04, y1);
          acc.box(fr, cx - ux * (q.w / 2 - 0.02), cz - uy * (q.w / 2 - 0.02), ang, 0.02, w.thick / 2 + 0.005, y0, y1);
          acc.box(fr, cx + ux * (q.w / 2 - 0.02), cz + uy * (q.w / 2 - 0.02), ang, 0.02, w.thick / 2 + 0.005, y0, y1);
          if (q.kind === "slide") acc.box(fr, cx, cz, ang, 0.02, 0.03, y0, y1);
        }
      });
    });
    // stair holes in the floor above
    var holesOn = {};
    m.stairs.forEach(function (s) { if (s.floor + 1 < m.floors.length) (holesOn[s.floor + 1] = holesOn[s.floor + 1] || []).push(rectOf(s.x, s.y, s.rot, s.w, s.len)); });
    m.rooms.forEach(function (r) {
      if (!show(r.floor)) return;
      var y = E[r.floor], holes = (holesOn[r.floor] || []).filter(function (h) { return h.every(function (p) { return inside(p, r.poly); }); });
      acc.slab(acc.get(r.mat, r.color, texFor(r)), r.poly, holes, y + 0.002, false);
      if (r.floor > 0) acc.slab(acc.get("ceiling"), r.poly, holes, y - 0.01, true);         // the slab's underside, below
      if (r.ceiling && (o.ceilings || r.floor < top)) acc.slab(acc.get("ceiling"), r.poly, (holesOn[r.floor + 1] || []).filter(function (h) { return h.every(function (p) { return inside(p, r.poly); }); }), y + m.floors[r.floor].height, true);   // the stairwell stays open
    });
    m.stairs.forEach(function (s) {
      if (!show(s.floor)) return;
      var y = E[s.floor], rise = (E[s.floor + 1] != null ? E[s.floor + 1] : y + m.floors[s.floor].height) - y, n = Math.max(3, Math.round(rise / 0.18)), tread = s.len / n, a = s.rot * Math.PI / 180;
      var mesh = acc.get("wood"), ca = Math.cos(a), sa = Math.sin(a);
      for (var i = 0; i < n; i++) { var along = -s.len / 2 + tread * (i + 0.5); acc.box(mesh, s.x + ca * along, s.y + sa * along, a, tread / 2, s.w / 2, y, y + rise * (i + 1) / n); }
    });
    m.items.forEach(function (it) {
      if (!show(it.floor)) return;
      var c = CATALOGUE[it.type], y = E[it.floor], H = m.floors[it.floor].height, a = it.rot * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
      // 2.579.0: a 3D model's own mesh, sized to the item (plan x / y, height up); a box of its size while it loads
      var md = it.type === "model" ? MODELS[it.model] : null;
      if (md) {
        var mesh0 = acc.get("paint", it.color || c.color), b0 = mesh0.pos.length / 3, kx = it.w / md.size[0], ky = it.d / md.size[1], kz = it.h / md.size[2];
        for (var vi = 0; vi < md.pos.length; vi += 3) {
          var lx = md.pos[vi] * kx, ly = md.pos[vi + 1] * ky, lz = md.pos[vi + 2] * kz, nx = md.nrm[vi], ny = md.nrm[vi + 1], nz = md.nrm[vi + 2];
          mesh0.pos.push(it.x + lx * ca - ly * sa, y + lz, it.y + lx * sa + ly * ca);
          mesh0.nrm.push(nx * ca - ny * sa, nz, nx * sa + ny * ca); mesh0.uv.push(lx, lz);
        }
        // plan (x, y, up) -> world (x, up, y) mirrors - the triangles turn the other way round to face out
        for (var ti = 0; ti < md.pos.length / 3; ti += 3) mesh0.idx.push(b0 + ti, b0 + ti + 2, b0 + ti + 1);
        return;
      }
      var parts = c.parts(it.w, it.d, it.h), main = parts[0] && parts[0].mat;
      parts.forEach(function (p) {
        var wx = it.x + p.x * ca - p.y * sa, wz = it.y + p.x * sa + p.y * ca;
        var base = p.top ? y + H : y, z0 = base + p.z0, z1 = base + p.z1;
        // the item's colour paints its main material (its first part's) - never a light, glass or a screen
        var color = it.color && p.mat === main && !/^(light|glass|screen)$/.test(p.mat) ? it.color : null;
        var mesh = acc.get(p.mat, color);
        if (p.s === "b") acc.box(mesh, wx, wz, a, p.w / 2, p.d / 2, z0, z1);
        else acc.cyl(mesh, wx, wz, a, p.r, z0, z1, p);
      });
      if (c.light) lights.push({ x: it.x, y: c.light.top ? y + H + c.light.z : y + c.light.z, z: it.y, intensity: c.light.intensity, kind: it.type, floor: it.floor });
    });
    // 2.538.0: the ◯ lights placed on the plan (placed = always lit; reach = how far)
    (m.lights || []).forEach(function (q) { if (show(q.floor)) lights.push({ x: q.x, y: E[q.floor] + q.z, z: q.y, intensity: q.intensity, kind: "light", floor: q.floor, color: q.color, reach: q.reach, placed: true, id: q.id }); });
    // 2.529.0: the roof (o.roof false = left off, the 3D view's choice) - over the TOP floor, only when it is shown
    var tf = m.floors.length - 1, rw = m.walls.filter(function (w) { return w.floor === tf; });
    if (m.roof && m.roof.kind !== "none" && o.roof !== false && show(tf) && rw.length) {
      var xs = [], zs = []; rw.forEach(function (w) { xs.push(w.a[0], w.b[0]); zs.push(w.a[1], w.b[1]); });
      var bb = [Math.min.apply(null, xs), Math.min.apply(null, zs), Math.max.apply(null, xs), Math.max.apply(null, zs)];
      var base = E[tf] + m.floors[tf].height, rp = roofParts(bb, base, m.roof), rmesh = acc.get(m.roof.mat, m.roof.color);
      if (rp.flat) {
        var f = rp.flat, cxr = (f[0] + f[2]) / 2, czr = (f[1] + f[3]) / 2, hx = (f[2] - f[0]) / 2, hz = (f[3] - f[1]) / 2;
        acc.box(rmesh, cxr, czr, 0, hx, hz, base, base + 0.18);
        [[cxr, f[1] + 0.06, hx, 0.06], [cxr, f[3] - 0.06, hx, 0.06]].forEach(function (b2) { acc.box(rmesh, b2[0], b2[1], 0, b2[2], b2[3], base + 0.18, base + 0.55); });
        [[f[0] + 0.06, czr, 0.06, hz], [f[2] - 0.06, czr, 0.06, hz]].forEach(function (b2) { acc.box(rmesh, b2[0], b2[1], 0, b2[2], b2[3], base + 0.18, base + 0.55); });
      } else {
        rp.slopes.forEach(function (q) { var n = normalOf(q[0], q[1], q[2]); if (n[1] < 0) n = [-n[0], -n[1], -n[2]]; acc.quad(rmesh, q[0], q[1], q[2], q[3], n, [[q[0][0], q[0][2]], [q[1][0], q[1][2]], [q[2][0], q[2][2]], [q[3][0], q[3][2]]]); });
        var gmesh = acc.get(rw[0].mat, rw[0].color);
        rp.gables.forEach(function (t) { var n = normalOf(t[0], t[1], t[2]); acc.quad(gmesh, t[0], t[1], t[2], t[2], n, [[0, 0], [1, 0], [0.5, 1], [0.5, 1]]); });
      }
    }
    (m.people || []).forEach(function (q) {
      if (!show(q.floor)) return;
      var y = E[q.floor], a = (q.rot - 90) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
      personParts(q.pose, q.h).forEach(function (p) {
        var wx = q.x + p.x * ca - p.y * sa, wz = q.y + p.x * sa + p.y * ca, mesh = acc.get(p.mat, q.color || null);
        if (p.s === "b") acc.box(mesh, wx, wz, a, p.w / 2, p.d / 2, y + p.z0, y + p.z1);
        else acc.cyl(mesh, wx, wz, a, p.r, y + p.z0, y + p.z1, p);
      });
    });
    var meshes = Object.keys(acc.g).map(function (k) { return acc.g[k]; }).filter(function (g) { return g.idx.length; });
    var bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    meshes.forEach(function (g) { for (var i = 0; i < g.pos.length; i += 3) { for (var j = 0; j < 3; j++) { bb[j] = Math.min(bb[j], g.pos[i + j]); bb[j + 3] = Math.max(bb[j + 3], g.pos[i + j]); } } });
    if (!meshes.length) bb = [0, 0, 0, 0, 0, 0];
    return { meshes: meshes, lights: lights, bounds: bb, elevations: E };
  }
  /** a rotated rectangle's corners (the stairs' footprint) */
  function rectOf(x, y, rot, w, len) {
    var a = rot * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), hl = len / 2, hw = w / 2;
    return [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(function (p) { return [r3(x + p[0] * ca - p[1] * sa), r3(y + p[0] * sa + p[1] * ca)]; });
  }
  /** an item's footprint on the plan (for drawing + picking) */
  function itemRect(it) { return rectOf(it.x, it.y, it.rot, it.d, it.w).map(function (p) { return p; }); }

  /* ---------------- words */
  var CNAMES = [["white", "#f4f4f2"], ["warm white", "#ece6dc"], ["cream", "#efe3c8"], ["beige", "#d8c3a0"], ["light grey", "#c8c8c8"], ["grey", "#8a8a8a"], ["charcoal", "#3a3a3c"], ["black", "#151515"],
    ["navy", "#24345c"], ["blue", "#3d6db5"], ["sky blue", "#9cc7e6"], ["teal", "#2f7f7c"], ["sage green", "#9caf88"], ["green", "#4f8a3c"], ["olive", "#7a7a3c"], ["mustard", "#d4a93c"],
    ["terracotta", "#c06a45"], ["red", "#b8352e"], ["burgundy", "#6e2230"], ["pink", "#e2a5b4"], ["lavender", "#b8a8d8"], ["brown", "#6e4a32"], ["tan", "#b98a5a"]];
  var FLOORWORD = { tile: "tiled", tile_dark: "dark tiled", carpet: "carpeted", oak: "oak", walnut: "walnut", marble: "marble", concrete: "polished concrete", stone: "stone", grass: "grass", wood: "timber", wood_dark: "dark timber" };
  function colourName(hex) {
    var h = String(hex || ""); if (!/^#[0-9a-f]{6}$/i.test(h)) return "";
    var v = [1, 3, 5].map(function (i) { return parseInt(h.substr(i, 2), 16); }), best = "", bd = Infinity;
    CNAMES.forEach(function (c) { var w = [1, 3, 5].map(function (i) { return parseInt(c[1].substr(i, 2), 16); }); var d = Math.pow(v[0] - w[0], 2) + Math.pow(v[1] - w[1], 2) + Math.pow(v[2] - w[2], 2); if (d < bd) { bd = d; best = c[0]; } });
    return best;
  }
  function roomOf(m, floor, p) { return (m.rooms || []).find(function (r) { return r.floor === floor && inside(p, r.poly); }) || null; }
  /** a prompt-ready description of a room (or the house) - the ✨ Make it real prompt and the location's notes */
  function describe(model, roomId) {
    var m = model && model.v ? model : normalize(model);
    var r = roomId ? m.rooms.find(function (x) { return x.id === roomId; }) : null;
    if (!r) { var nr = m.rooms.length; return m.name + ": " + m.floors.length + " floor" + (m.floors.length > 1 ? "s" : "") + ", " + nr + " room" + (nr === 1 ? "" : "s") + (nr ? " (" + m.rooms.map(function (x) { return x.name; }).join(", ") + ")" : ""); }
    var A = Math.abs(area(r.poly)), xs = r.poly.map(function (p) { return p[0]; }), ys = r.poly.map(function (p) { return p[1]; });
    var walls = m.walls.filter(function (w) { return w.floor === r.floor && (onEdge(w.a, r.poly) && onEdge(w.b, r.poly)); });
    var wm = walls[0], items = m.items.filter(function (it) { return it.floor === r.floor && inside([it.x, it.y], r.poly); });
    var ops = m.openings.filter(function (q) { return walls.some(function (w) { return w.id === q.wall; }); });
    var cnt = {}; items.forEach(function (it) { var l = CATALOGUE[it.type].label.toLowerCase(); cnt[l] = (cnt[l] || 0) + 1; });
    var ocnt = {}; ops.forEach(function (q) { var l = OPENINGS[q.kind].label.toLowerCase(); ocnt[l] = (ocnt[l] || 0) + 1; });
    var list = function (o) { return Object.keys(o).map(function (k) { return (o[k] > 1 ? o[k] + " " + k.replace(/(?:ch|sh|s|x)$/, "$&e") + "s" : (/^[aeiou]/.test(k) ? "an " : "a ") + k); }); };
    var parts = [(/^room \d+$/i.test(r.name) ? "room" : r.name.toLowerCase()) + " (" + Math.round(A) + " m², " + (Math.max.apply(null, xs) - Math.min.apply(null, xs)).toFixed(1) + " × " + (Math.max.apply(null, ys) - Math.min.apply(null, ys)).toFixed(1) + " m, " + m.floors[r.floor].height.toFixed(1) + " m ceiling)",
      (colourName(r.color) ? colourName(r.color) + " " : "") + (FLOORWORD[r.mat] || MATERIALS[r.mat].label.toLowerCase().replace(/ floor$/, "")) + " floor"];
    if (wm) parts.push((colourName(wm.color) ? colourName(wm.color) + " " : "") + MATERIALS[wm.mat].label.toLowerCase() + " walls");
    var things = list(cnt).concat(list(ocnt));
    return parts.join(", ") + (things.length ? ", with " + things.join(", ") : "");
  }
  function onEdge(p, poly) {
    for (var i = 0; i < poly.length; i++) { var a = poly[i], b = poly[(i + 1) % poly.length], L = dist(a, b); if (L < 1e-9) continue; var t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (L * L); if (t < -0.01 || t > 1.01) continue; var q = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]; if (dist(p, q) < 0.05) return true; }
    return false;
  }

  /* ---------------- editing helpers (the docker) */
  /** the parts of segment [a, b] NOT covered by the collinear walls on that floor (so rooms that share a wall share ONE wall) */
  function uncovered(m, floor, a, b) {
    var L = dist(a, b); if (L < 1e-6) return [];
    var ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, cov = [];
    (m.walls || []).forEach(function (w) {
      if (w.floor !== floor) return;
      var on = function (p) { return Math.abs((p[0] - a[0]) * uy - (p[1] - a[1]) * ux) < 0.02; };
      if (!on(w.a) || !on(w.b)) return;
      var t0 = (w.a[0] - a[0]) * ux + (w.a[1] - a[1]) * uy, t1 = (w.b[0] - a[0]) * ux + (w.b[1] - a[1]) * uy;
      cov.push([Math.min(t0, t1), Math.max(t0, t1)]);
    });
    cov.sort(function (p, q) { return p[0] - q[0]; });
    var out = [], s = 0;
    cov.forEach(function (c) { if (c[1] <= s + 1e-6) return; if (c[0] > s + 0.02) out.push([s, Math.min(c[0], L)]); s = Math.max(s, c[1]); });
    if (s < L - 0.02) out.push([s, L]);
    return out.filter(function (p) { return p[1] - p[0] > 0.05; }).map(function (p) { return [[r3(a[0] + ux * p[0]), r3(a[1] + uy * p[0])], [r3(a[0] + ux * p[1]), r3(a[1] + uy * p[1])]]; });
  }
  /** a room (rectangle or polygon) + the walls it needs -> the model changed in place; returns the room */
  function addRoom(m, floor, poly, name, thick) {
    var r = { id: id("r"), floor: floor, name: name || "Room", poly: poly.map(pt), mat: "oak", color: MATERIALS.oak.color, ceiling: true };
    m.rooms.push(r);
    for (var i = 0; i < poly.length; i++) uncovered(m, floor, pt(poly[i]), pt(poly[(i + 1) % poly.length])).forEach(function (s) { m.walls.push({ id: id("w"), floor: floor, a: s[0], b: s[1], thick: thick || 0.15, mat: "plaster", color: MATERIALS.plaster.color }); });
    return r;
  }
  /** the nearest wall to a point (within maxD metres) -> {wall, t (along, metres), d} */
  function nearestWall(m, floor, p, maxD) {
    var best = null;
    (m.walls || []).forEach(function (w) {
      if (w.floor !== floor) return;
      var L = dist(w.a, w.b), ux = (w.b[0] - w.a[0]) / L, uy = (w.b[1] - w.a[1]) / L;
      var t = Math.max(0, Math.min(L, (p[0] - w.a[0]) * ux + (p[1] - w.a[1]) * uy));
      var d = dist(p, [w.a[0] + ux * t, w.a[1] + uy * t]);
      if (d <= (maxD == null ? 0.4 : maxD) && (!best || d < best.d)) best = { wall: w, t: t, d: d };
    });
    return best;
  }
  /** the sun from the hour + the north offset: {az (deg, plan, clockwise from +x), el (deg), color, intensity, sky, night} */
  function sun(light) {
    var L = light || {}, h = num(L.hour, 14, 0, 24);
    var day = (h - 6) / 12;                                          // 0 = 06:00 sunrise, 1 = 18:00 sunset
    var el = day <= 0 || day >= 1 ? -10 : Math.sin(day * Math.PI) * 62;
    // the plan's north = up (-y, 270°) turned by L.north; east = north + 90°. Southern hemisphere (Australia): the sun
    // rises in the east, stands in the NORTH at noon and sets in the west -> az = east - 180° x the day
    var az = 360 + num(L.north, 0) - 180 * Math.max(0, Math.min(1, day));
    var night = el <= 0, low = !night && el < 18;
    return { az: ((az % 360) + 360) % 360, el: el, night: night, color: night ? "#4a5a80" : low ? "#ffb070" : "#fff6e8", intensity: night ? 0 : low ? 1.4 : 2.6, sky: night ? "#0d1220" : low ? "#e8a878" : "#a9c9ec", ground: night ? "#05060a" : "#6b6255" };
  }

  /* ---------------- .obj / .mtl */
  function toObj(meshes, name) {
    var o = ["# " + (name || "house") + " - bitGen Studio house builder (metres, Y up)", "mtllib house.mtl"], mtl = ["# bitGen Studio house builder"], v = 1, seen = {};
    (meshes || []).forEach(function (g, gi) {
      var mn = (g.mat + "_" + g.color.replace("#", "")).replace(/[^A-Za-z0-9_]/g, "_");
      if (!seen[mn]) {
        seen[mn] = 1;
        var M = MATERIALS[g.mat] || {}, c = [1, 3, 5].map(function (i) { return (parseInt(g.color.substr(i, 2), 16) / 255).toFixed(4); });
        mtl.push("newmtl " + mn, "Kd " + c.join(" "), "Ka 0 0 0", "Ks " + (M.rough != null ? (1 - M.rough) * 0.3 : 0.1).toFixed(3) + " " + (M.rough != null ? (1 - M.rough) * 0.3 : 0.1).toFixed(3) + " " + (M.rough != null ? (1 - M.rough) * 0.3 : 0.1).toFixed(3),
          "d " + (M.opacity != null ? M.opacity : 1), M.emissive ? "Ke " + c.join(" ") : "Ke 0 0 0", "illum 2", "");
      }
      o.push("o " + mn + "_" + gi, "usemtl " + mn);
      for (var i = 0; i < g.pos.length; i += 3) o.push("v " + r3(g.pos[i]) + " " + r3(g.pos[i + 1]) + " " + r3(g.pos[i + 2]));
      for (var j = 0; j < g.uv.length; j += 2) o.push("vt " + r3(g.uv[j]) + " " + r3(g.uv[j + 1]));
      for (var k = 0; k < g.nrm.length; k += 3) o.push("vn " + r3(g.nrm[k]) + " " + r3(g.nrm[k + 1]) + " " + r3(g.nrm[k + 2]));
      for (var t = 0; t < g.idx.length; t += 3) { var a = g.idx[t] + v, b = g.idx[t + 1] + v, c2 = g.idx[t + 2] + v; o.push("f " + a + "/" + a + "/" + a + " " + b + "/" + b + "/" + b + " " + c2 + "/" + c2 + "/" + c2); }
      v += g.pos.length / 3;
    });
    return { obj: o.join("\n") + "\n", mtl: mtl.join("\n") + "\n" };
  }
  /** a starter house: a living room + kitchen, a bedroom, a bathroom (the ＋ Example button) */
  function example() {
    var m = normalize({ name: "Example house" });
    addRoom(m, 0, [[0, 0], [6, 0], [6, 4.5], [0, 4.5]], "Living room");
    addRoom(m, 0, [[6, 0], [9.5, 0], [9.5, 4.5], [6, 4.5]], "Kitchen");
    addRoom(m, 0, [[0, 4.5], [4, 4.5], [4, 8], [0, 8]], "Bedroom");
    addRoom(m, 0, [[4, 4.5], [6.5, 4.5], [6.5, 8], [4, 8]], "Bathroom");
    var W = function (a, b) { return m.walls.find(function (w) { return (dist(w.a, a) < 0.01 && dist(w.b, b) < 0.01) || (dist(w.a, b) < 0.01 && dist(w.b, a) < 0.01); }); };
    var put = function (w, t, kind) { if (w) m.openings.push({ id: id("o"), wall: w.id, t: t, kind: kind }); };
    put(W([0, 0], [6, 0]), 3, "window"); put(W([0, 0], [6, 0]), 5, "door"); put(W([6, 0], [9.5, 0]), 1.8, "window");
    put(W([0, 4.5], [6, 4.5]) || W([0, 4.5], [4, 4.5]), 2, "door"); put(W([4, 4.5], [6, 4.5]) || W([0, 4.5], [6, 4.5]), 5, "door");
    put(W([6, 0], [6, 4.5]), 2.6, "opening"); put(W([0, 4.5], [0, 8]), 1.8, "window"); put(W([0, 0], [0, 4.5]), 2.2, "slide");
    m.rooms[1].mat = "tile"; m.rooms[1].color = MATERIALS.tile.color; m.rooms[3].mat = "tile"; m.rooms[3].color = MATERIALS.tile.color; m.rooms[2].mat = "carpet"; m.rooms[2].color = MATERIALS.carpet.color;
    var I = function (type, x, y, rot) { m.items.push({ id: id("i"), floor: 0, type: type, x: x, y: y, rot: rot || 0, w: CATALOGUE[type].w, d: CATALOGUE[type].d, h: CATALOGUE[type].h, color: CATALOGUE[type].color || "" }); };
    I("sofa", 2.6, 3.6, 180); I("coffee_table", 2.6, 2.6); I("tv_unit", 2.6, 0.35); I("rug", 2.6, 2.7); I("plant", 0.5, 0.5); I("floor_lamp", 4.6, 3.9); I("ceiling_light", 2.6, 2.3);
    I("kitchen_base", 7.75, 0.4); I("stove", 9.1, 0.4); I("fridge", 6.5, 0.45); I("island", 7.8, 2.6); I("stool", 7.4, 3.3, 180); I("stool", 8.2, 3.3, 180); I("pendant", 7.8, 2.6);
    I("bed_queen", 2, 6.9, 180); I("bedside", 0.9, 7.7, 180); I("bedside", 3.1, 7.7, 180); I("wardrobe", 3.6, 5.6, 270); I("ceiling_light", 2, 6.2);
    I("bathtub", 5.25, 7.55, 180); I("toilet", 6.1, 5.4, 270); I("vanity", 4.5, 4.85); I("ceiling_light", 5.25, 6.2);
    m.cameras.push({ id: id("c"), floor: 0, name: "Living room", x: 4.8, y: 1.2, z: 1.6, yaw: 150, pitch: -5, fov: 70 });
    return normalize(m);
  }

  var api = { MODELS: MODELS, loadModel: loadModel, modelName: modelName, REF_KINDS: REF_KINDS, ROOFS: ROOFS, roofParts: roofParts, POSES: POSES, personParts: personParts, SLAB: SLAB, MATERIALS: MATERIALS, CATALOGUE: CATALOGUE, OPENINGS: OPENINGS, normalize: normalize, elevations: elevations, heightRange: heightRange, camAt: camAt, area: area, centroid: centroid, inside: inside, triangulate: triangulate,
    wallPieces: wallPieces, build: build, rectOf: rectOf, itemRect: itemRect, describe: describe, colourName: colourName, roomOf: roomOf, uncovered: uncovered, addRoom: addRoom, nearestWall: nearestWall,
    sun: sun, toObj: toObj, example: example, dist: dist, newId: id };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.H3HouseGeo = api;
})(typeof window !== "undefined" ? window : globalThis);
