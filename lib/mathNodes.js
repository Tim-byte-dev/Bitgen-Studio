/* bitGen Studio — CUSTOM MATH NODES -> ComfyUI's CORE Math Expression (2.401.2).
 *
 * Tim (verbatim): "comfy math nodes are no longer available, ltx2.5 workflow does not work, nodes not found -
 * Cloning into 'ComfyMath'... remote: Repository not found."
 *
 * Tim's LTX 2.5 all-in-one canvas did its number plumbing with two custom packs: ComfyMath (CM_IntToFloat,
 * CM_FloatToInt) - gone from GitHub - and pysssss' Custom-Scripts (MathExpression|pysssss, "a*b+1", "a*32").
 * ComfyUI has a CORE node for all of it: ComfyMathExpression (expression + values.a, values.b ... -> FLOAT, INT
 * (truncated), BOOL). migrate() rewrites those nodes in a UI export, in place - top level and every subgraph
 * definition - so the canvas needs neither pack:
 *
 *   CM_IntToFloat / CM_FloatToInt / CM_NumberTo* / CM_*ToNumber   -> "a"
 *   MathExpression|pysssss (a, b, c; INT then FLOAT)              -> its own expression
 *
 * Inputs a / b / c become values.a / values.b / values.c (same order, same links; a link's target slot follows its
 * input); outputs become FLOAT, INT, BOOL and every link LEAVING the node is re-pointed at the slot of the same
 * name (an INT that was slot 0 is slot 1 now). Both link shapes are handled: the top level's arrays
 * [id, from, from_slot, to, to_slot, type] and a definition's objects {id, origin_id, origin_slot, ...}.
 * Run by lib/ltxWorkflow.prepare on every conversion (a canvas Tim re-exports is fixed on the fly) and once on the
 * shipped copy (scripts/migrate_math.js). Truncation = ComfyMath's int(a) and pysssss' int(r). */
"use strict";

const CORE = "ComfyMathExpression";
const CORE_OUTS = [["FLOAT", "FLOAT"], ["INT", "INT"], ["BOOL", "BOOLEAN"]];
const SLOT_OF = { FLOAT: 0, INT: 1, BOOL: 2, BOOLEAN: 2 };
const VALUE_TYPE = "FLOAT,INT,BOOLEAN";

/** The expression a node becomes, or null when it is not one of the custom math nodes. */
function exprFor(n) {
  const t = String((n && n.type) || "");
  if (t === "MathExpression|pysssss") {
    const w = Array.isArray(n.widgets_values) ? n.widgets_values[0] : (n.widgets_values || {}).expression;
    return typeof w === "string" && w.trim() ? w : "a";
  }
  if (/^CM_(IntToFloat|FloatToInt|NumberToInt|NumberToFloat|IntToNumber|FloatToNumber|IntToBool|FloatToBool|BoolToInt)$/.test(t)) return "a";
  return null;
}

/** Rewrite one node list + its links. `links` is the array as stored; `shape` "array" | "object". */
function migrateList(nodes, links, shape, changed, where, only) {
  const byId = new Map(), tgt = new Map();
  for (const n of nodes || []) {
    const expr = exprFor(n);
    if (expr == null || (only && !only.has(String(n.type)))) continue;
    const was = String(n.type);
    // old output index -> new slot, by the output's name / type
    const remap = new Map();
    const outLinks = [[], [], []];
    (Array.isArray(n.outputs) ? n.outputs : []).forEach((o, i) => {
      const key = String((o && (o.type || o.name)) || "").toUpperCase();
      const slot = SLOT_OF[key] != null ? SLOT_OF[key] : SLOT_OF[String((o && o.name) || "").toUpperCase()];
      if (slot == null) return;
      remap.set(i, slot);
      for (const l of (o && o.links) || []) outLinks[slot].push(l);
    });
    n.type = CORE;
    n.properties = { ...(n.properties || {}), "Node name for S&R": CORE, cnr_id: "comfy-core" };
    delete n.properties.aux_id;
    delete n.properties.ver;                              // the pack's commit - meaningless on a core node
    n.widgets_values = [expr];
    n.inputs = (Array.isArray(n.inputs) ? n.inputs : []).filter((i) => i && /^[a-z]$/.test(String(i.name)))
      .map((i) => ({ label: String(i.name), localized_name: String(i.name), name: "values." + i.name, type: VALUE_TYPE,
        ...(i.shape != null ? { shape: i.shape } : {}), link: i.link == null ? null : i.link }));
    if (!n.inputs.length) n.inputs = [{ label: "a", localized_name: "a", name: "values.a", type: VALUE_TYPE, link: null }];
    n.outputs = CORE_OUTS.map(([name, type], s) => ({ localized_name: name, name, type, links: outLinks[s] }));
    byId.set(String(n.id), remap);
    tgt.set(String(n.id), new Map(n.inputs.map((i, k) => [String(i.link), k]).filter(([l]) => l !== "null")));
    changed.push({ where, id: n.id, from: was, expression: expr });
  }
  if (!byId.size) return;
  // the links LEAVING a migrated node move to the slot of the same name; the ones INTO it follow its inputs
  for (const l of links || []) {
    if (shape === "array" && Array.isArray(l)) {
      const r = byId.get(String(l[1]));
      if (r && r.has(Number(l[2]))) l[2] = r.get(Number(l[2]));
      const t = tgt.get(String(l[3]));
      if (t && t.has(String(l[0]))) l[4] = t.get(String(l[0]));
    } else if (l && typeof l === "object") {
      const r = byId.get(String(l.origin_id));
      if (r && r.has(Number(l.origin_slot))) l.origin_slot = r.get(Number(l.origin_slot));
      const t = tgt.get(String(l.target_id));
      if (t && t.has(String(l.id))) l.target_slot = t.get(String(l.id));
    }
  }
}

/** Migrate a UI export in place (`only`: a Set of the classes to convert - all of them when absent).
 *  Returns [{where, id, from, expression}] - empty when there was nothing to do. */
function migrate(ui, only) {
  const changed = [];
  if (!ui || typeof ui !== "object") return changed;
  if (Array.isArray(ui.nodes)) migrateList(ui.nodes, ui.links, "array", changed, "top", only);
  for (const d of ((ui.definitions || {}).subgraphs) || []) {
    if (d && Array.isArray(d.nodes)) migrateList(d.nodes, d.links, Array.isArray((d.links || [])[0]) ? "array" : "object", changed, String(d.name || d.id), only);
  }
  return changed;
}

/** The custom math classes a UI export still uses (none after migrate). */
function leftover(ui) {
  const out = new Set();
  const scan = (nodes) => { for (const n of nodes || []) if (exprFor(n) != null) out.add(String(n.type)); };
  scan(ui && ui.nodes);
  for (const d of ((ui && ui.definitions || {}).subgraphs) || []) scan(d && d.nodes);
  return [...out];
}

module.exports = { CORE, migrate, leftover, exprFor };
