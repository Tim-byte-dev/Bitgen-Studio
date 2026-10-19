#!/usr/bin/env node
/* bitGen Studio — 2.340.0: the reference dock's First / Last frame types and
 * Qwen Image 2.1 reading the dock (the qwen2_1 style, up to 10 pictures).
 * Run: node scripts/test-refroles.js
 * Tim: "add options for first frame and last frame in reference image docker
 * type dropdown. if first frame is selected use fl2va, if first frame not
 * selected use ref2va or reference. allow qwen 2.1 to use reference docker
 * images as it's reference images. add a style , qwen2_1 , should be able to
 * use up to 10 images".
 *   1. static/refroles.js: plan (ref2va -> fl2va on a First frame, the 9 cap),
 *      ltxOrder, isFrame, roles;
 *   2. lib/qwenRefs: <Picture n> -> <imageN>, the roles line, Qwen detection;
 *   3. the qwen2_1 workflow (10 slots, all optional) + scripts/comfy_image:
 *      no picture = every slot bypassed (text-to-image), 10 pictures fill 10;
 *   4. the wiring: the page (the Type options, the tray cap 10 / subjects 9,
 *      submitJob / submitLtx / the image job), routes/index.js (the slot cap,
 *      refs_optional, the Qwen prompt), the starter style. */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 400) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const RR = require(path.join(ROOT, "static", "refroles.js"));
const Q = require(path.join(ROOT, "lib", "qwenRefs"));
const S = require(path.join(ROOT, "lib", "styles"));

// ---- 1. the dock's types
const ref = (n, role) => ({ id: n, role: role || "person", roleOther: "" });
const A = ref("a"), F = ref("f", "first frame"), L = ref("l", "last frame"), B = ref("b", "clothing");
let p = RR.plan("ref2va", [A, F, B, L]);
check("a picture typed First frame -> fl2va, the First then the Last frame (the others said, not sent)",
  p.mode === "fl2va" && p.refs.map((r) => r.id).join() === "f,l" && /2 other picture\(s\) are not used by fl2va/.test(p.note), p);
p = RR.plan("ref2va", [F]);
check("a First frame alone -> fl2va from it", p.mode === "fl2va" && p.refs.map((r) => r.id).join() === "f" && !/other/.test(p.note));
p = RR.plan("ref2va", [A, L, B]);
check("no First frame -> References (ref2va); a lone Last frame rides as a reference, said",
  p.mode === "ref2va" && p.refs.length === 3 && /a Last frame needs a First frame too/.test(p.note));
p = RR.plan("ref2va", Array.from({ length: 10 }, (_x, i) => ref("r" + i)));
check("References sends at most 9 pictures (H3), the tray holds 10 (for qwen2_1)", p.refs.length === 9 && /the first 9 are sent/.test(p.note));
check("the other modes are untouched", RR.plan("fl2va", [A, B]).mode === "fl2va" && RR.plan("swap", [A]).refs.length === 1 && RR.plan("t2va", []).note === "");
check("LTX order: the First frame first, the Last frame last, the others between",
  RR.ltxOrder([L, A, F, B]).map((r) => r.id).join() === "f,a,b,l" && RR.ltxOrder([A, B]).map((r) => r.id).join() === "a,b");
check("isFrame / roles (other -> its words)", RR.isFrame(F) && RR.isFrame(L) && !RR.isFrame(A)
  && RR.roles([A, F, { role: "other", roleOther: "horse" }]).join() === "person,first frame,horse");

// ---- 2. Qwen's words
let q = Q.prompt("<subject 1> is in <Picture 1>\n<subject 1> clothing is in <Picture 2>\n\nShe walks.", 2, ["person", "clothing"]);
check("the dock's mapping lines in Qwen's words: <Picture n> -> <imageN>, <subject n> -> subject n (no extra line then)",
  q.prompt === "subject 1 is in <image1>\nsubject 1 clothing is in <image2>\n\nShe walks." && /<imageN>/.test(q.note), q);
q = Q.prompt("a woman in a red coat on the pier", 3, ["person", "clothing", "environment"]);
check("a prompt naming no picture gets one line saying what each is, from its Type",
  q.prompt === "<image1> is the person, <image2> is the clothing, <image3> is the location / background.\na woman in a red coat on the pier", q.prompt);
check("a prompt already in <imageN> is left alone; no pictures = no line", Q.prompt("put <image2> on <image1>", 2, []).prompt === "put <image2> on <image1>"
  && Q.prompt("a cat", 0, []).prompt === "a cat");
check("Qwen 2.1 detected by its encoder (TextEncodeQwenImage21)", Q.isQwen21Style({ workflow: "comfy_workflows/img_qwen21_edit_10.json" }, ROOT)
  && Q.isQwen21Style({ workflow: "comfy_workflows/img_qwen21_edit.json" }, ROOT) && !Q.isQwen21Style({ workflow: "comfy_workflows/img_qwen_edit_2511.json" }, ROOT));

// ---- 3. the workflow + the patcher
const W10 = JSON.parse(read("comfy_workflows", "img_qwen21_edit_10.json"));
const enc = Object.values(W10).find((n) => n && n.class_type === "TextEncodeQwenImage21");
check("img_qwen21_edit_10.json: ten LoadImage slots into images.image_1..10",
  Object.values(W10).filter((n) => n && n.class_type === "LoadImage").length === 10
  && Array.from({ length: 10 }, (_x, i) => `images.image_${i + 1}`).every((k) => Array.isArray(enc.inputs[k])));
const py = spawnSync("python3", ["-c", `
import json, sys
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, "scripts"))})
import comfy_image as C
g0 = {k: v for k, v in json.load(open(${JSON.stringify(path.join(ROOT, "comfy_workflows", "img_qwen21_edit_10.json"))})).items() if not k.startswith("_")}
r = C.roles(g0)
g, rep = C.apply_images(json.loads(json.dumps(g0)), [], r)
enc = [n for n in g.values() if n["class_type"] == "TextEncodeQwenImage21"][0]
none = [k for k in enc["inputs"] if k.startswith("images.")]
g, rep = C.apply_images(json.loads(json.dumps(g0)), ["p%d.png" % i for i in range(1, 11)], r)
filled = sorted(x[1] for x in rep if x[2] == "slot")
try:
    C.apply_images(json.loads(json.dumps(g0)), ["p%d.png" % i for i in range(1, 12)], r); over = "no"
except C.PatchError as e:
    over = str(e)
e2 = {k: v for k, v in json.load(open(${JSON.stringify(path.join(ROOT, "comfy_workflows", "img_qwen_edit_2511.json"))})).items() if not k.startswith("_")}
print(json.dumps({"slots": len(r["image_slots"]), "optional": C.slots_optional(g0, r["image_slots"]), "none": none,
                  "filled": len(filled), "over": over, "e2511": C.slots_optional(e2, C.roles(e2)["image_slots"])}))
`], { encoding: "utf8" });
let o = {};
try { o = JSON.parse(py.stdout); } catch { /* reported */ }
check("comfy_image: the 10 slots are optional (they feed images.image_N only) - no picture = all bypassed = text-to-image",
  o.slots === 10 && o.optional === true && Array.isArray(o.none) && o.none.length === 0, o.slots ? o : py.stderr.slice(-400));
check("...10 pictures fill 10 slots; 11 are refused in words; an edit graph with a REQUIRED image slot is not optional",
  o.filled === 10 && /10 reference-image slot\(s\) but 11 images/.test(o.over) && o.e2511 === false, o);

// ---- 4. the wiring
const IH = read("static", "index.html"), RI = read("routes", "index.js");
check("the page loads static/refroles.js", IH.includes('<script src="/static/refroles.js"></script>'));
check("the Type dropdown: first frame + last frame", IH.includes('<option value="first frame"') && IH.includes('<option value="last frame"'));
check("the tray holds 10 in References; subjects stay 1..9", IH.includes("const CAP = { ref2va: 10, fl2va: 2, t2va: 0, swap: 1 };")
  && IH.includes("const SUBJECTS_MAX = 9;") && !/CAP\.ref2va/.test(IH));
check("the mapping lines skip frame pictures, and vanish when the render is fl2va",
  IH.includes('if (window.RefRoles && RefRoles.plan(mode, refs).mode === "fl2va") return "";') && IH.includes("if (window.RefRoles && RefRoles.isFrame(r)) return \"\";"));
check("Generate (video): RefRoles.plan decides the mode + the pictures", IH.includes("const rp = window.RefRoles ? RefRoles.plan(mode, refs)")
  && IH.includes('fd.append("mode", rp.mode);') && IH.includes('(fop ? fop.refs : rp.refs).forEach(r => fd.append("references", r.file, r.file.name));'));   // 2.388.0: Append / Prepend send their one picture
check("LTX: the pictures in RefRoles.ltxOrder", IH.includes("(window.RefRoles ? RefRoles.ltxOrder(refs) : refs).slice(0, 3)"));
check("Generate Image: the Types ride (image_roles); qwen2_1 renders with an empty dock (refs_optional)",
  IH.includes("body.image_roles = RefRoles.roles(refs.slice(0, names.length));") && IH.includes("styleRefsOptional = j.refs_optional || {};")
  && IH.includes("if ((slots > 0 && !styleRefsOptional[id]) || optionalRefs) {"));
check("/api/genimage: up to the style's slots (was a flat 3, max 10); Qwen 2.1 gets its <imageN> prompt; the list says refs_optional",
  RI.includes("p.images = b.images.slice(0, Math.max(3, Math.min(qwenRefs.MAX_IMAGES, styles.imageSlots(styled, core.BASE))))")
  && RI.includes("if (qwenRefs.isQwen21Style(styled, core.BASE)) {") && RI.includes("refs_optional: Object.fromEntries("));
const st = S.normalize(S.STARTER_STYLES.find((x) => x.name === "qwen2_1"));
check("the starter style qwen2_1: Qwen Image 2.1 with 10 slots, pictures optional", st.workflow === "comfy_workflows/img_qwen21_edit_10.json"
  && st.refs_optional === true && S.imageSlots(st, ROOT) === 10 && st.kind === "image");

console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
