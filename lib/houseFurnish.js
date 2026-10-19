/* bitGen Studio — lib/houseFurnish.js (2.529.0): 🪄 FURNISH A ROOM from a prompt (the House builder).
 * From the recommendations Tim asked to be worked through: "'furnish this room' from a prompt, with the LLM picking from
 * the furniture library".
 *   WHAT GOES IN   the LLM (when one is running) reads the room (its name, size, doors) + your words and picks pieces FROM
 *                  THE LIBRARY ONLY (types + counts) - wishList() turns its JSON into a clean list. No LLM / no usable
 *                  answer -> rules(): a set by the kind of room (from its name or your words: bedroom, kitchen, bathroom,
 *                  living, dining, office, laundry, garage) + any library piece your words name ("a piano", "plants")
 *   WHERE          place() - never the LLM (it is poor at coordinates): wall pieces with their back to a wall (beds,
 *                  sofas, wardrobes, cabinets …), the rest by what they belong to (bedsides beside the bed, the coffee table
 *                  in front of the sofa, chairs round the table, a rug under it, plants / lamps in corners, a ceiling light
 *                  in the middle); never in front of a door (1 m kept clear), never over furniture already there, all
 *                  inside the room. What does not fit is reported, not forced.
 * Pure (scripts/test-houseextras529.js): kindOf, rules, wishList, place.
 */
"use strict";
const G = require("../static/housegeo.js");

const KINDS = {
  bedroom: /bed ?room|bedroom|master|guest|nursery|kids?'? room|sleep/i, kitchen: /kitchen|kitchenette|pantry|cook/i,
  bathroom: /bath|ensuite|en-suite|shower|toilet|wc\b|powder/i, dining: /dining|dinner|meal/i, office: /office|study|work ?room|desk/i,
  laundry: /laundry|utility/i, garage: /garage|carport|car port/i, living: /living|lounge|family|sitting|tv room|rumpus|den\b|reading/i,
};
/** the kind of room from its name, then the words (pure) */
function kindOf(name, words) {
  for (const t of [String(name || ""), String(words || "")]) for (const k of Object.keys(KINDS)) if (KINDS[k].test(t)) return k;
  return "other";
}
const SETS = {
  living: [["sofa", 1], ["coffee_table", 1], ["rug", 1], ["tv_unit", 1], ["armchair", 1], ["floor_lamp", 1], ["plant", 1], ["ceiling_light", 1]],
  bedroom: [["bed_queen", 1], ["bedside", 2], ["wardrobe", 1], ["ceiling_light", 1], ["plant", 1]],
  kitchen: [["kitchen_base", 2], ["fridge", 1], ["stove", 1], ["sink", 1], ["island", 1], ["stool", 2], ["pendant", 1]],
  dining: [["dining_table", 1], ["chair", 6], ["pendant", 1], ["plant", 1]],
  bathroom: [["vanity", 1], ["toilet", 1], ["bathtub", 1], ["shower", 1], ["ceiling_light", 1]],
  office: [["desk", 1], ["office_chair", 1], ["bookshelf", 1], ["plant", 1], ["ceiling_light", 1]],
  laundry: [["washer", 2], ["sink", 1], ["ceiling_light", 1]],
  garage: [["car", 1], ["box", 2]],
  other: [["plant", 1], ["ceiling_light", 1]],
};
// words that ask for a library piece by name
const WORDS = [[/pianos?\b/i, "piano"], [/plants?|greenery/i, "plant"], [/\btv\b|television/i, "tv_unit"], [/desk/i, "desk"], [/book ?shel(f|ves)|books/i, "bookshelf"],
  [/arm ?chairs?|reading chair/i, "armchair"], [/fire ?place/i, "fireplace"], [/\brugs?\b|carpet/i, "rug"], [/floor lamps?|reading lamp|lamps?\b/i, "floor_lamp"], [/island/i, "island"],
  [/\bcars?\b/i, "car"], [/sofa|couch/i, "sofa"], [/l-shaped|corner sofa|sectional/i, "sofa_l"], [/king bed/i, "bed_king"], [/single bed|kids? bed/i, "bed_single"],
  [/double bed/i, "bed_double"], [/wardrobe|closet/i, "wardrobe"], [/dining table/i, "dining_table"], [/round table/i, "round_table"], [/bath ?tub|\bbath\b/i, "bathtub"],
  [/shower/i, "shower"], [/washer|washing machine/i, "washer"], [/stools?/i, "stool"], [/pendant|chandelier/i, "pendant"]];
const BEDS = ["bed_single", "bed_double", "bed_queen", "bed_king"];

/** the rules' list for a room: its kind's set (the bed sized to the room) + every piece the words name (pure) */
function rules(room, words) {
  const kind = kindOf(room && room.name, words), xs = (room.poly || []).map((p) => p[0]), ys = (room.poly || []).map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs), d = Math.max(...ys) - Math.min(...ys), A = w * d;
  let list = SETS[kind].map(([t, n]) => ({ type: t, count: n }));
  if (kind === "bedroom") { const bed = A < 9 ? "bed_single" : A < 12 ? "bed_double" : A > 18 ? "bed_king" : "bed_queen"; list.find((x) => x.type === "bed_queen").type = bed; }
  if (kind === "bathroom" && A < 6) list = list.filter((x) => x.type !== "bathtub");
  if (kind === "kitchen" && A < 10) list = list.filter((x) => x.type !== "island" && x.type !== "stool");
  if (kind === "dining" && A < 9) list.find((x) => x.type === "chair").count = 4;
  for (const [rx, t] of WORDS) if (rx.test(String(words || "")) && !list.some((x) => x.type === t)) {
    if (BEDS.includes(t)) list = list.filter((x) => !BEDS.includes(x.type));
    if (t === "sofa_l") list = list.filter((x) => x.type !== "sofa");
    list.push({ type: t, count: 1 });
  }
  return { kind, items: list };
}
/** the LLM's answer -> a clean list: library types only, counts 1..8, at most 24 pieces (pure) */
function wishList(text) {
  const s = String(text || ""), i = s.indexOf("{"), j = s.lastIndexOf("}");
  if (i < 0 || j < i) return null;
  let o = null; try { o = JSON.parse(s.slice(i, j + 1)); } catch { return null; }
  const arr = Array.isArray(o) ? o : Array.isArray(o && o.items) ? o.items : null;
  if (!arr) return null;
  const out = [];
  let total = 0;
  for (const x of arr) {
    const t = String((x && (x.type || x.item || x.name)) || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (!G.CATALOGUE[t]) continue;
    const n = Math.max(1, Math.min(8, Math.round(Number(x.count) || 1)));
    if (total + n > 24) break;
    total += n;
    const e = out.find((y) => y.type === t); if (e) e.count += n; else out.push({ type: t, count: n });
  }
  return out.length ? out : null;
}

/* ---------------- placing */
const WALL = new Set(["sofa", "sofa_l", "tv_unit", "bookshelf", "fireplace", "piano", "kitchen_base", "kitchen_wall", "sink", "stove", "fridge", "wardrobe",
  "desk", "bathtub", "shower", "toilet", "vanity", "washer", "car", "box", ...BEDS]);
const ORDER = ["car", "bed_king", "bed_queen", "bed_double", "bed_single", "sofa_l", "sofa", "kitchen_base", "fridge", "stove", "sink", "bathtub", "shower", "bedside",
  "wardrobe", "island", "dining_table", "round_table", "tv_unit", "piano", "fireplace", "desk", "vanity", "toilet", "washer", "bookshelf", "coffee_table", "rug",
  "armchair", "chair", "stool", "office_chair", "kitchen_wall", "box", "plant", "floor_lamp", "table_lamp", "pendant", "ceiling_light"];
function corners(it) {
  const a = it.rot * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  return [[-it.w / 2, -it.d / 2], [it.w / 2, -it.d / 2], [it.w / 2, it.d / 2], [-it.w / 2, it.d / 2]].map(([u, v]) => [it.x + u * ca - v * sa, it.y + u * sa + v * ca]);
}
function inRect(it, p, pad) {
  const a = -it.rot * Math.PI / 180, dx = p[0] - it.x, dy = p[1] - it.y;
  const u = dx * Math.cos(a) - dy * Math.sin(a), v = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(u) < it.w / 2 + (pad || 0) && Math.abs(v) < it.d / 2 + (pad || 0);
}
function samples(it) {
  const c = corners(it), out = c.slice();
  for (let i = 0; i < 4; i++) { const p = c[i], q = c[(i + 1) % 4]; for (let k = 1; k < 4; k++) out.push([p[0] + (q[0] - p[0]) * k / 4, p[1] + (q[1] - p[1]) * k / 4]); }
  out.push([it.x, it.y]);
  return out;
}
/** do two footprints overlap (rugs and ceiling lights overlap anything; lights hang above) */
function hits(a, b) {
  const soft = (t) => t === "rug" || t === "ceiling_light" || t === "pendant";
  if (soft(a.type) || soft(b.type)) return false;
  return samples(a).some((p) => inRect(b, p, -0.01)) || samples(b).some((p) => inRect(a, p, -0.01));
}
function frontOf(it) { const a = it.rot * Math.PI / 180; return [-Math.sin(a), Math.cos(a)]; }
/** place a list in a room -> {placed: [items], skipped: [types]} (pure). model: the house (its walls, doors, items) */
function place(model, room, list, opts) {
  const m = G.normalize(model), poly = room.poly, fl = room.floor || 0, o = opts || {};
  const area = Math.abs(G.area(poly)) || 1, sgn = G.area(poly) > 0 ? 1 : -1;
  const keep = (m.items || []).filter((it) => it.floor === fl && G.inside([it.x, it.y], poly)).map((it) => Object.assign({}, it));
  const placed = [], skipped = [];
  // the doors on this room's walls: 1 m kept clear on both sides
  const doors = [];
  for (const q of m.openings || []) {
    if (!/^(door|slide|opening|garage)$/.test(q.kind)) continue;
    const w = (m.walls || []).find((x) => x.id === q.wall); if (!w || w.floor !== fl) continue;
    const L = G.dist(w.a, w.b), c = [w.a[0] + (w.b[0] - w.a[0]) * q.t / L, w.a[1] + (w.b[1] - w.a[1]) * q.t / L];
    if (poly.some((p, i) => { const n = poly[(i + 1) % poly.length]; return segDist(c, p, n) < 0.2; })) doors.push({ c, r: Math.max(1, q.w / 2 + 0.5) });
  }
  const ok = (it) => {
    if (!corners(it).every((p) => G.inside(p, poly) || onEdge(p, poly))) return false;
    if (it.type !== "ceiling_light" && it.type !== "pendant" && it.type !== "rug" && doors.some((d) => samples(it).some((p) => G.dist(p, d.c) < d.r))) return false;
    return !keep.concat(placed).some((x) => hits(it, x));
  };
  const mk = (type, x, y, rot) => { const c = G.CATALOGUE[type]; return { id: G.newId("i"), floor: fl, type, x: r2(x), y: r2(y), rot: ((Math.round(rot) % 360) + 360) % 360, w: c.w, d: c.d, h: c.h, color: c.color || "" }; };
  const edges = poly.map((p, i) => { const q = poly[(i + 1) % poly.length], L = G.dist(p, q), u = [(q[0] - p[0]) / L, (q[1] - p[1]) / L]; return { p, q, L, u, n: [-u[1] * sgn, u[0] * sgn] }; })
    .sort((a, b) => b.L - a.L);
  const inset = 0.08;                                    // half a wall
  const onWall = (type, prefer) => {
    const c = G.CATALOGUE[type];
    for (const e of (prefer || edges)) {
      if (e.L < c.w + 0.1) continue;
      const rot = Math.atan2(-e.n[0], e.n[1]) * 180 / Math.PI;
      const steps = Math.floor((e.L - c.w) / 0.1);
      const order = []; for (let k = 0; k <= steps; k++) order.push(k);
      if (o.center !== false) order.sort((a, b) => Math.abs(a - steps / 2) - Math.abs(b - steps / 2));   // the middle of the wall first
      for (const k of order) {
        const t = c.w / 2 + 0.05 + k * 0.1, base = [e.p[0] + e.u[0] * t, e.p[1] + e.u[1] * t];
        const it = mk(type, base[0] + e.n[0] * (c.d / 2 + inset), base[1] + e.n[1] * (c.d / 2 + inset), rot);
        if (ok(it)) return it;
      }
    }
    return null;
  };
  const near = (type, ax, ay, rot) => { const it = mk(type, ax, ay, rot); return ok(it) ? it : null; };
  const centroid = G.centroid(poly);
  const queue = [];
  for (const x of list) for (let k = 0; k < x.count; k++) queue.push(x.type);
  queue.sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
  for (const type of queue) {
    const c = G.CATALOGUE[type]; if (!c) continue;
    let it = null;
    const bed = placed.find((x) => BEDS.includes(x.type)), sofa = placed.find((x) => x.type === "sofa" || x.type === "sofa_l"), table = placed.find((x) => /dining_table|round_table|island/.test(x.type));
    if (type === "bedside" && bed) {
      const a = bed.rot * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), back = frontOf(bed);
      for (const s of [-1, 1]) {
        const off = bed.w / 2 + c.w / 2 + 0.05, cx = bed.x + ux * off * s - back[0] * (bed.d / 2 - c.d / 2 - 0.02), cy = bed.y + uy * off * s - back[1] * (bed.d / 2 - c.d / 2 - 0.02);
        it = near(type, cx, cy, bed.rot); if (it) break;
      }
    } else if (type === "coffee_table" && sofa) {
      const f = frontOf(sofa), off = sofa.d / 2 + 0.45 + c.d / 2;
      it = near(type, sofa.x + f[0] * off, sofa.y + f[1] * off, sofa.rot);
    } else if (type === "rug") {
      const ct = placed.find((x) => x.type === "coffee_table") || table;
      it = ct ? mk(type, ct.x, ct.y, ct.rot) : mk(type, centroid[0], centroid[1], 0);
      if (!corners(it).every((p) => G.inside(p, poly))) it = null;
    } else if ((type === "chair" || type === "stool") && table) {
      // round the table: along its long sides, facing it
      const a = table.rot * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), f = frontOf(table);
      const n = placed.filter((x) => x.type === type).length, per = Math.max(1, Math.floor(table.w / 0.6));
      const side = n % 2 ? -1 : 1, slot = Math.floor(n / 2), along = (slot - (per - 1) / 2) * (table.w / per);
      const off = table.d / 2 + c.d / 2 + 0.05;
      it = near(type, table.x + ux * along + f[0] * off * side, table.y + uy * along + f[1] * off * side, side > 0 ? table.rot + 180 : table.rot);
    } else if (type === "armchair" && sofa) {
      const f = frontOf(sofa), a = sofa.rot * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), off = sofa.w / 2 + c.w / 2 + 0.35;
      for (const s of [1, -1]) { it = near(type, sofa.x + ux * off * s + f[0] * 0.9, sofa.y + uy * off * s + f[1] * 0.9, sofa.rot + 90 * -s * 0.5); if (it) break; }
    } else if (type === "office_chair") {
      const desk = placed.find((x) => x.type === "desk");
      if (desk) { const f = frontOf(desk); it = near(type, desk.x + f[0] * (desk.d / 2 + 0.25), desk.y + f[1] * (desk.d / 2 + 0.25), desk.rot + 180); }
    } else if (type === "tv_unit" && sofa) {
      // the wall the sofa faces
      const f = frontOf(sofa), facing = edges.slice().sort((a, b) => (a.n[0] * f[0] + a.n[1] * f[1]) - (b.n[0] * f[0] + b.n[1] * f[1]));
      it = onWall(type, facing);
    } else if (type === "ceiling_light" || type === "pendant") {
      it = mk(type, table && type === "pendant" ? table.x : centroid[0], table && type === "pendant" ? table.y : centroid[1], 0);
    } else if (type === "plant" || type === "floor_lamp" || type === "table_lamp" || type === "box") {
      for (const p of poly) {
        const dx = centroid[0] - p[0], dy = centroid[1] - p[1], L = Math.hypot(dx, dy) || 1, off = c.w / 2 + 0.2;
        it = near(type, p[0] + dx / L * off * 1.42, p[1] + dy / L * off * 1.42, 0); if (it) break;
      }
    } else if (type === "island" || type === "dining_table" || type === "round_table" || type === "coffee_table") {
      const longX = (Math.max(...poly.map((p) => p[0])) - Math.min(...poly.map((p) => p[0]))) >= (Math.max(...poly.map((p) => p[1])) - Math.min(...poly.map((p) => p[1])));
      it = near(type, centroid[0], centroid[1], longX ? 0 : 90) || near(type, centroid[0], centroid[1], longX ? 90 : 0);
    }
    if (!it && type === "bedside" && bed) { skipped.push(type); continue; }   // beside the bed or not at all
    if (!it && WALL.has(type)) it = onWall(type);
    if (!it && !WALL.has(type) && type !== "ceiling_light" && type !== "pendant") it = near(type, centroid[0], centroid[1], 0) || onWall(type);
    if (it) placed.push(it); else skipped.push(type);
    if (placed.length > 40) break;
  }
  void area;
  return { placed, skipped };
}
function r2(v) { return Math.round(v * 100) / 100; }
function segDist(p, a, b) { const L2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2; if (!L2) return G.dist(p, a); const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / L2)); return G.dist(p, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); }
function onEdge(p, poly) { return poly.some((a, i) => segDist(p, a, poly[(i + 1) % poly.length]) < 0.02); }

/** the LLM's pick for a room (or null): {items} */
async function askLLM(room, words, complete) {
  const lc = complete || ((msg) => require("./llmChat").complete(require("./core"), msg));
  const xs = room.poly.map((p) => p[0]), ys = room.poly.map((p) => p[1]);
  const size = `${(Math.max(...xs) - Math.min(...xs)).toFixed(1)} × ${(Math.max(...ys) - Math.min(...ys)).toFixed(1)} m`;
  const cat = Object.keys(G.CATALOGUE).map((k) => `${k}: ${G.CATALOGUE[k].label} (${G.CATALOGUE[k].w} × ${G.CATALOGUE[k].d} m)`).join("\n");
  const msgs = [{ role: "system", content: "You furnish rooms in a floor plan. Pick furniture ONLY from the library below (use its type names exactly). "
      + "Choose what a real room of this kind and size would have, plus what the request asks for; not too much for the floor space. Reply with ONLY JSON: "
      + '{"items":[{"type":"<library type>","count":<1-8>}]} - no coordinates, no other text.\n\nLIBRARY\n' + cat },
    { role: "user", content: `Room: "${room.name}", ${size}, ${Math.round(Math.abs(G.area(room.poly)))} m².\nRequest: ${String(words || "furnish it").slice(0, 500)}` }];
  try {
    const r = await lc({ messages: msgs, temperature: 0.3, max_tokens: 600 });
    return r && r.ok ? wishList(r.text) : null;
  } catch { return null; }
}
/** 🪄 furnish: {model, room (id), prompt, llm (default true)} -> {by: "llm"|"rules", kind, items (the new ones), skipped, wanted} */
async function furnish(b, complete) {
  const x = b && typeof b === "object" ? b : {};
  const m = G.normalize(x.model || {}), room = m.rooms.find((r) => r.id === x.room);
  if (!room) { const e = new Error("pick a room first"); e.status = 400; throw e; }
  let wanted = null, by = "rules";
  if (x.llm !== false) { wanted = await askLLM(room, x.prompt, complete); if (wanted) by = "llm"; }
  const rr = rules(room, x.prompt);
  if (!wanted) wanted = rr.items;
  const out = place(m, room, wanted);
  try { require("./testPlan").event("house_furnish", { what: `${room.name || room.id}: ${out.placed.length} pieces (${by})` }); } catch { /* the 🧪 checklist */ }
  return { by, kind: rr.kind, wanted, items: out.placed, skipped: out.skipped };
}

module.exports = { KINDS, SETS, kindOf, rules, wishList, place, furnish, askLLM };
