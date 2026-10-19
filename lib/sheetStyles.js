// bitGen Studio — which image styles can render a character sheet, and what
// LoRAs each will ACTUALLY load. 2.206.0 (Tim: "i am still getting hybrid
// horses, i have a feeling a lora or loras are being loaded when they should
// not be, only load loras when their are loras in the style").
//
// THE HYBRID-HORSE MECHANISM: the sheet generator auto-picked the first
// reference-capable image style ALPHABETICALLY (styles.read sorts by name)
// and the dialog never said which one, let alone what rode inside it. The
// LoRA patcher itself is faithful — a style with no LoRAs gets every slot
// bypassed — but a style that DOES carry LoRAs (saved for people renders in
// Settings -> Image) silently rendered every sheet, and a character LoRA on
// a horse is exactly a hybrid horse. This helper is the one place that
// decides sheet eligibility and reports a style's live LoRA list, so the
// route, the dialog's dropdown, and the tests all agree on both.
const styles = require("./styles");
const imageRefs = require("./imageRefs");

/** The LoRAs a style will actually load: entries with a non-empty path —
 *  the same filter scripts/comfy_image.py applies (comfy_lora_name), so what
 *  this reports is what the patcher wires. A missing weight defaults to 1,
 *  as the patcher's apply_loras does. */
function lorasOf(style) {
  return (Array.isArray((style || {}).loras) ? style.loras : [])
    .filter((l) => l && String(l.path || "").trim())
    .map((l) => ({
      path: String(l.path).trim(),
      weight: (l.weight === undefined || l.weight === null || l.weight === "")
        ? 1 : Number(l.weight),
    }));
}

/** resolve() for one style with n reference pictures (default ONE — a plain
 *  sheet has exactly one; a posed sheet sends the template plus the photo).
 *  null when resolution itself fails — treated as "cannot". */
function probe(style, baseDir, n) {
  try { return imageRefs.resolve(styles.applyLoraWeights(style, null), n || 1, baseDir); }
  catch { return null; }
}

/** Every image style that can render a sheet, in styles.read order (A→Z).
 *  Eligible means the workflow that would RENDER has somewhere to put the
 *  picture: a Klein t2i that SWAPS to its edit sibling (`swapped`), or a
 *  style whose own workflow already carries LoadImage slots. A slotless
 *  graph is excluded outright — the 2.199.0 lesson ("any workflow at all"
 *  matched a plain t2i and the reference was ignored). Each row carries the
 *  live LoRA count and names so the dropdown can SAY what will load. */
function list(stylesDir, baseDir) {
  const out = [];
  for (const st of styles.read(stylesDir, "image") || []) {
    const full = styles.byId(stylesDir, String(st.id));
    if (!full) continue;
    const r = probe(full, baseDir);
    if (!r || !r.workflow || !(r.swapped || (r.slots | 0) > 0)) continue;
    const ls = lorasOf(full);
    out.push({
      id: full.id, name: full.name, swapped: !!r.swapped, slots: r.slots | 0,
      loras: ls.length,
      lora_names: ls.map((l) => l.path.split(/[\\/]/).pop()),
    });
  }
  return out;
}

/** The style ONE sheet render uses.
 *  An explicit id is Tim's truth and is used as given — exactly the
 *  pre-2.206.0 contract for b.style_id. With no id, the first style whose
 *  t2i swaps to its edit sibling wins — byte-for-byte the old auto-pick —
 *  falling back to the first eligible row. Returns
 *  { style, styled, rw, loras } or null when nothing can render a sheet;
 *  `styled` is what the job carries, `loras` is lorasOf(styled) so the
 *  response can report exactly what the patcher will wire. */
function pick(stylesDir, baseDir, styleId) {
  let style = styleId ? styles.byId(stylesDir, String(styleId)) : null;
  if (!style) {
    const rows = list(stylesDir, baseDir);
    const first = rows.find((r) => r.swapped) || rows[0];
    if (first) style = styles.byId(stylesDir, String(first.id));
  }
  if (!style) return null;
  const styled = styles.applyLoraWeights(style, null);
  return { style, styled, rw: probe(styled, baseDir), loras: lorasOf(styled) };
}

module.exports = { lorasOf, probe, list, pick };
