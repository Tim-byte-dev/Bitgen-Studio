/* bitGen Studio — lib/famFilter.js (2.788.0): BASIC SETTINGS' OVERRIDE LISTS SHOW WHAT FITS THE PICKED STYLE.
 * Tim (verbatim): "in the model and lora lists in overide settings, filter the list by the syle selected in the prompt
 * docker dropdowns family of models and the type (image/image-edit/video)"
 *
 *   rule(style, kind) -> {kind, style, arch, families, labels, type}
 *       the families whose files load in that style's workflow (an image style: every family with its architecture,
 *       lib/modelCards.FAMILIES; a video style: MiniMax H3 / LTX / Wan) and the type - "video", "image edit" (an edit /
 *       Kontext / inpaint / fill style, or a family that only edits) or "image". families [] = nothing to filter by.
 *   typeOf(style, kind) -> "video" | "image edit" | "image"
 *   info(cat, name, cards, invs) -> {family, category} - the 🧩 Model manager's card for the file (your edit > Civitai >
 *       its header > its name), else its name; a pod's "<pod name>/<file>" is judged by the file (lib/podInv.resolve)
 *   pick(files, rule) -> {fit, unknown, out}  (pure) files [{name, family, category}]:
 *       fit     the family is one of the rule's; of those, the ones of the rule's type when there are any (FLUX.2 Klein's
 *               edit style keeps its picture models - its family has no edit file)
 *       unknown no family to judge by ("" / other) - kept, listed after the fitting ones
 *       out     another family, or the family's other type
 * Pure parts: scripts/test-famfilter788.js. Route: routes/famFilter.js. Page: static/famfilter.js.
 */
"use strict";
const MC = require("./modelCards");

const VIDEO_FAMILY = [[/^minimax-h3/, "h3"], [/^ltx/, "ltx"], [/^wan/, "wan"], [/hunyuan/, "hunyuan"], [/^pan2$/, "pan2"]];
const EDIT_RE = /edit|kontext|inpaint|(^|[^a-z])fill([^a-z]|$)|instruct-?pix/i;
const norm = (s) => String(s || "").replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
const unknownFam = (f) => !f || f === "other";

function familiesOf(style, kind) {
  const arch = String((style && style.arch) || "");
  if (!arch) return [];
  if (kind === "video") { const m = VIDEO_FAMILY.find(([re]) => re.test(arch)); return m ? [m[1]] : []; }
  return Object.keys(MC.FAMILIES).filter((k) => { const F = MC.FAMILIES[k]; return F.arch === arch && !F.kind; });
}
function typeOf(style, kind) {
  if (kind === "video") return "video";
  const s = style || {}, words = [s.name, s.workflow, s.role].filter(Boolean).join(" ");
  if (EDIT_RE.test(words)) return "image edit";
  const fams = familiesOf(s, kind);
  if (fams.length && fams.every((k) => MC.FAMILIES[k].category === "image edit")) return "image edit";
  return "image";
}
function rule(style, kind) {
  const k = kind === "video" ? "video" : "image", families = familiesOf(style, k);
  return { kind: k, style: (style && style.name) || "", id: (style && style.id) || "", arch: String((style && style.arch) || ""),
    families, labels: families.map((f) => MC.FAMILIES[f].label), type: typeOf(style, k) };
}

/** a file's family + type: its card, else its name (pure when cards / invs are given) */
function info(cat, name, cards, invs) {
  let n = String(name || "");
  try { const PI = require("./podInv"); const ref = PI.resolve(n, invs || [], null); if (ref) n = ref.rel; } catch { /* no pods */ }
  const want = norm(n), c = (cards || []).find((x) => x && (!cat || !x.cat || x.cat === cat || (cat !== "loras" && x.cat !== "loras"))
    && (norm(x.name) === want || norm(x.name).endsWith("/" + want) || want.endsWith("/" + norm(x.name))));
  if (c && c.family) return { family: c.family, category: c.category || MC.categoryOf(c.family, { name: n }) };
  const fam = MC.nameFamily(n) || "";
  return { family: fam, category: fam ? MC.categoryOf(fam, { name: n }) : "" };
}

function pick(files, r) {
  const L = files || [], fams = (r && r.families) || [];
  if (!fams.length) return { fit: L.slice(), unknown: [], out: [] };
  const fam = [], unknown = [], out = [];
  for (const f of L) (unknownFam(f.family) ? unknown : fams.includes(f.family) ? fam : out).push(f);
  // 2.798.0 (Tim: "drop the split because some image models like klein can edit as well as generate"): every file of the family -
  // picture and edit models alike (rule.type is still worked out, no longer used to narrow)
  return { fit: fam, unknown, out };
}

/** live: the cards of this computer's models + LoRAs (the Model manager's scan, cached there) */
function cards() {
  try { const d = MC.list(); return ((d && d.models) || []).concat((d && d.loras) || []); } catch { return []; }
}
function invs() { try { return require("./podInv").live(); } catch { return []; } }

module.exports = { familiesOf, typeOf, rule, info, pick, cards, invs, EDIT_RE };
