/* bitGen Studio — static/garmentspec.js (2.932.0): 👗 the Garment designer's pure rules, shared by the page and the server
 * (lib/garment.js requires it; static/garment.js uses window.H3GarmentSpec) - one copy of each rule.
 *
 * GarmentCode's design tree (lib/garment/schema.json, from its assets/design_params/default.yaml - MIT): every leaf is
 * {v, range, type} with type float | int | bool | select | select_null. bitGen's own presets (lib/garment/presets.json) are
 * a few changes by dotted path ("sleeve.length": 0.3).
 *   flat(tree)                 -> [{path, group, key, type, v, range}] in the tree's order
 *   value(leaf, x)             -> x checked against the leaf: numbers clamped to the range (int rounded), bools, a select's
 *                                 own choices (else the default); select_null also takes null
 *   build(tree, values)        -> a FULL design tree (a copy) with these values set - what the garment programs read
 *   valuesOf(tree)             -> {path: v} of every leaf
 *   changed(tree, values)      -> {path: v} only where it differs from the tree's default
 *   groups(values)             -> the groups that matter for this top / waistband / bottom (the dialog shows these)
 *   preset(presets, id)        -> {path: v} of a preset (unknown id -> {})
 *   bodyFor(base, want)        -> the mannequin's 26 measurements moved onto the user's height / bust / waist / hips (cm):
 *                                 lengths by height, each width by the circumference it belongs to
 *   label(path)                -> words for a parameter ("sleeve.cuff.cuff_len" -> "Cuff length")
 */
(function (root) {
  "use strict";
  var TYPES = { float: 1, int: 1, bool: 1, select: 1, select_null: 1 };
  function isLeaf(n) { return !!(n && typeof n === "object" && "v" in n && TYPES[n.type]); }
  function flat(tree) {
    var out = [];
    (function walk(n, pre) {
      Object.keys(n || {}).forEach(function (k) {
        var x = n[k], p = pre ? pre + "." + k : k;
        if (isLeaf(x)) out.push({ path: p, group: p.split(".")[0], key: k, type: x.type, v: x.v, range: x.range });
        else if (x && typeof x === "object" && !Array.isArray(x)) walk(x, p);
      });
    })(tree, "");
    return out;
  }
  function leafAt(tree, path) {
    var n = tree, parts = String(path).split(".");
    for (var i = 0; i < parts.length; i++) { if (!n || typeof n !== "object") return null; n = n[parts[i]]; }
    return isLeaf(n) ? n : null;
  }
  function value(leaf, x) {
    if (!leaf) return undefined;
    var r = Array.isArray(leaf.range) ? leaf.range : [];
    if (leaf.type === "float" || leaf.type === "int") {
      var n = typeof x === "string" ? parseFloat(x) : x;
      if (typeof n !== "number" || !isFinite(n)) return leaf.v;
      var lo = Math.min(r[0], r[1]), hi = Math.max(r[0], r[1]);
      if (isFinite(lo)) n = Math.max(lo, n);
      if (isFinite(hi)) n = Math.min(hi, n);
      return leaf.type === "int" ? Math.round(n) : Math.round(n * 10000) / 10000;
    }
    if (leaf.type === "bool") return x === true || x === "true" || x === 1 || x === "1";
    if (leaf.type === "select_null" && (x === null || x === "" || x === "none" || x === "null")) return null;
    for (var i = 0; i < r.length; i++) if (r[i] !== null && String(r[i]) === String(x)) return r[i];
    return leaf.v;
  }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function build(tree, values) {
    var t = copy(tree || {});
    Object.keys(values || {}).forEach(function (p) {
      var leaf = leafAt(t, p);
      if (leaf) leaf.v = value(leaf, values[p]);
    });
    return t;
  }
  function valuesOf(tree) { var o = {}; flat(tree).forEach(function (f) { o[f.path] = f.v; }); return o; }
  function changed(tree, values) {
    var o = {};
    Object.keys(values || {}).forEach(function (p) {
      var leaf = leafAt(tree, p);
      if (!leaf) return;
      var v = value(leaf, values[p]);
      if (v !== leaf.v) o[p] = v;
    });
    return o;
  }
  var BOTTOM_GROUPS = {
    SkirtCircle: ["flare-skirt"], AsymmSkirtCircle: ["flare-skirt"], SkirtManyPanels: ["flare-skirt"],
    GodetSkirt: ["godet-skirt"], Pants: ["pants"], Skirt2: ["skirt"], PencilSkirt: ["pencil-skirt"], SkirtLevels: ["levels-skirt"]
  };
  var BASE_GROUP = { Skirt2: "skirt", PencilSkirt: "pencil-skirt", SkirtCircle: "flare-skirt", AsymmSkirtCircle: "flare-skirt" };
  function groups(values) {
    var v = values || {}, g = ["meta"];
    if (v["meta.upper"]) g.push("shirt", "collar", "sleeve", "left");
    if (v["meta.wb"]) g.push("waistband");
    var b = v["meta.bottom"];
    (BOTTOM_GROUPS[b] || []).forEach(function (x) { g.push(x); });
    if (b === "GodetSkirt" && BASE_GROUP[v["godet-skirt.base"]]) g.push(BASE_GROUP[v["godet-skirt.base"]]);
    if (b === "SkirtLevels") [v["levels-skirt.base"], v["levels-skirt.level"]].forEach(function (x) { if (BASE_GROUP[x]) g.push(BASE_GROUP[x]); });
    return g.filter(function (x, i) { return g.indexOf(x) === i; });
  }
  function preset(presets, id) {
    var list = (presets && presets.presets) || presets || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return copy(list[i].set || {});
    return {};
  }
  // which measurements follow what, when the user types their own height / bust / waist / hips
  var FOLLOW = {
    height: ["arm_length", "armscye_depth", "bust_line", "crotch_hip_diff", "head_l", "hips_line", "neck_w", "shoulder_w",
      "vert_bust_line", "waist_line", "waist_over_bust_line"],
    bust: ["underbust", "back_width", "bust_points"],
    waist: ["waist_back_width"],
    hips: ["hip_back_width", "bum_points", "leg_circ"]
  };
  var LIMITS = { height: [120, 220], bust: [60, 160], waist: [45, 160], hips: [60, 170] };
  function bodyFor(base, want) {
    var b = copy(base || {}), w = want || {};
    Object.keys(FOLLOW).forEach(function (k) {
      var n = parseFloat(w[k]);
      if (!isFinite(n) || !isFinite(b[k]) || !b[k]) return;
      n = Math.max(LIMITS[k][0], Math.min(LIMITS[k][1], n));
      var f = n / b[k];
      FOLLOW[k].forEach(function (d) { if (isFinite(b[d])) b[d] = Math.round(b[d] * f * 1000) / 1000; });
      b[k] = n;
    });
    return b;
  }
  var WORDS = { f_collar: "Front neckline", b_collar: "Back neckline", fc_depth: "Front neckline depth", bc_depth: "Back neckline depth",
    fc_angle: "Front neckline angle", bc_angle: "Back neckline angle", wb: "Waistband", upper: "Top", bottom: "Bottom",
    cuff_len: "Cuff length", n_panels: "Panels", suns: "Fullness (circles)", num_levels: "Tiers", level_ruffle: "Tier gathering",
    base_length_frac: "First tier length", insert_w: "Insert width", insert_depth: "Insert depth", num_inserts: "Inserts",
    cuts_distance: "Distance between cuts", connecting_width: "Armhole width", end_width: "Hem width", enable_asym: "Different left side",
    opening_dir_mix: "Opening direction", smoothing_coeff: "Smoothing", top_ruffle: "Gathering at the top", skirt_fraction: "Flared part",
    hood_depth: "Hood depth", hood_length: "Hood length", lapel_standing: "Standing lapel", strapless: "Strapless", sleeveless: "Sleeveless",
    armhole_shape: "Armhole shape", sleeve_angle: "Sleeve angle", standing_shoulder: "Standing shoulder", standing_shoulder_len: "Standing shoulder length",
    connect_ruffle: "Gathering at the armhole", low_angle: "Hem angle", style_side_cut: "Side cut-out", bottom_cut: "Hem cut", front_length: "Front length",
    f_flip_curve: "Flip the front curve", b_flip_curve: "Flip the back curve", panel_curve: "Panel curve" };
  function label(path) {
    var parts = String(path).split("."), k = parts[parts.length - 1];
    var w = WORDS[k] || (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, " ");
    if (parts[0] === "left" && k !== "enable_asym") w += " (left)";
    return w;
  }
  // words for GarmentCode's choices (an option named after a brand / logo is not offered: hidden(v))
  var OPTIONS = { FittedShirt: "Fitted top", Shirt: "Loose top", StraightWB: "Straight waistband", FittedWB: "Fitted waistband",
    SkirtCircle: "Circle skirt", AsymmSkirtCircle: "High-low circle skirt", GodetSkirt: "Godet skirt", Pants: "Trousers",
    Skirt2: "Straight skirt", SkirtManyPanels: "Panelled (gored) skirt", PencilSkirt: "Pencil skirt", SkirtLevels: "Tiered skirt",
    CircleNeckHalf: "Round", CurvyNeckHalf: "Curvy", VNeckHalf: "V", SquareNeckHalf: "Square", TrapezoidNeckHalf: "Trapezoid",
    CircleArcNeckHalf: "Arc", Bezier2NeckHalf: "Curve", Turtle: "Turtleneck", SimpleLapel: "Lapel", Hood2Panels: "Hood",
    ArmholeSquare: "Square", ArmholeAngle: "Angled", ArmholeCurve: "Curved", CuffBand: "Band", CuffSkirt: "Flared",
    CuffBandSkirt: "Band + flare", Sun: "Sun" };
  function optionLabel(v) { return v === null || v === undefined ? "None" : OPTIONS[v] || String(v); }
  function hidden(v) { return typeof v === "string" && /_logo$/i.test(v); }
  var GROUPS = { meta: "Garment", shirt: "Top", collar: "Neckline and collar", sleeve: "Sleeves", left: "Left side (asymmetric)",
    waistband: "Waistband", skirt: "Skirt", "flare-skirt": "Flared skirt", "godet-skirt": "Godet skirt", "pencil-skirt": "Pencil skirt",
    "levels-skirt": "Tiered skirt", pants: "Trousers" };
  var api = { optionLabel: optionLabel, hidden: hidden, GROUPS: GROUPS, flat: flat, leafAt: leafAt, value: value, build: build, valuesOf: valuesOf, changed: changed, groups: groups,
    preset: preset, bodyFor: bodyFor, label: label, FOLLOW: FOLLOW, LIMITS: LIMITS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.H3GarmentSpec = api;
})(typeof window !== "undefined" ? window : null);
