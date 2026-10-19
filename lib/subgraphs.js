"use strict";
/**
 * subgraphs.js — FLATTEN A UI EXPORT BEFORE IT IS CONVERTED (2.126.0).
 *
 * Two things a modern ComfyUI canvas contains that an API prompt cannot:
 *
 *  1. SUBGRAPHS. A node whose `type` is a UUID is an INSTANCE of a definition
 *     in `definitions.subgraphs`. The definition holds its own nodes and links,
 *     and two virtual boundary ids: -10 is "the subgraph's inputs" and -20 is
 *     "its outputs". `/object_info` will never know that UUID — it is not a node
 *     pack, it is a fold in this one workflow — so graphToApi's "an unknown
 *     class fails by name" rule would reject the whole file. Correctly, by its
 *     own rules, and uselessly.
 *  2. SetNode / GetNode (KJNodes). A wire drawn by NAME instead of across the
 *     canvas. They are frontend-only: they execute nothing, and they are not in
 *     `/object_info` either.
 *
 * Both are the same kind of thing — a drawing convenience that stands between
 * the canvas and the graph that actually runs — so both are resolved here, in
 * ONE pass, and `lib/graphToApi.js` goes on seeing a plain flat workflow. That
 * is the whole reason this is a separate file rather than more branches inside
 * the converter: the converter's job is "widget values become named inputs",
 * and it does that job the same way whether or not the user folded their canvas.
 *
 * PURE, and a NO-OP when there is nothing to do: a workflow with no subgraphs
 * and no Set/Get comes back as the very same object, so every graph that worked
 * before this file existed takes exactly the path it took before.
 *
 * WHY THE IDS LOOK LIKE `12:5`. An inlined node needs an id that cannot collide
 * with a real one, and the instance's own id is the only prefix guaranteed to be
 * unique. This is also what ComfyUI's own subgraph export does, so a prompt from
 * here and a prompt from the canvas name the same node the same way — worth
 * something the first time Tim compares a rejection message against his screen.
 *
 * THE CASE THAT IS EASY TO GET WRONG: an exposed input with a VALUE TYPED ON
 * THE INSTANCE and no wire into it (the Prompt and Duration boxes on the
 * blueprint's scene nodes). The value lives on the instance; the widget that
 * wants it lives inside the definition. It is carried across as a synthetic
 * PrimitiveNode, because the converter ALREADY inlines a primitive's value into
 * every widget it feeds — reusing that path instead of teaching this file how to
 * write a widget value positionally, which is the one piece of arithmetic in
 * graphToApi worth never having a second copy of.
 */

/** ComfyUI's virtual boundary nodes inside a subgraph definition. */
const INPUT_NODE = -10;
const OUTPUT_NODE = -20;
/** A workflow folded inside itself would otherwise expand forever. */
const MAX_DEPTH = 20;

const SET_TYPES = new Set(["SetNode", "GetNode"]);

/** Links come in both shapes; everything below speaks the object one. */
function normLink(l) {
  if (Array.isArray(l)) {
    return { id: l[0], origin_id: l[1], origin_slot: l[2], target_id: l[3], target_slot: l[4], type: l[5] };
  }
  if (!l || typeof l !== "object") return null;
  return { id: l.id, origin_id: l.origin_id, origin_slot: l.origin_slot,
           target_id: l.target_id, target_slot: l.target_slot, type: l.type };
}

const clone = (x) => JSON.parse(JSON.stringify(x));

/** The definitions this workflow carries, by id. */
function subgraphDefs(ui) {
  const defs = new Map();
  const list = ui && ui.definitions && Array.isArray(ui.definitions.subgraphs)
    ? ui.definitions.subgraphs : [];
  for (const s of list) if (s && s.id) defs.set(String(s.id), s);
  return defs;
}

/** Does this workflow need flattening at all? */
function needsFlatten(ui) {
  if (!ui || !Array.isArray(ui.nodes)) return false;
  const defs = subgraphDefs(ui);
  for (const n of ui.nodes) {
    const t = String((n && n.type) || "");
    if (SET_TYPES.has(t)) return true;
    if (defs.has(t)) return true;
  }
  return false;
}

/**
 * Expand every subgraph instance, once. Returns true if anything was expanded,
 * so the caller can run it again for nests (a subgraph containing a subgraph —
 * the Longform blueprint's "H3 Simple Shot" holds "Merge Videos").
 */
function expandOnce(nodes, links, defs, warnings, expanded, seq) {
  let did = false;
  for (const inst of nodes.slice()) {
    const def = defs.get(String(inst.type || ""));
    if (!def) continue;
    did = true;
    const iid = String(inst.id);
    const prefix = iid + ":";
    const name = String(def.name || "subgraph");
    expanded.push({ node: iid, name });

    const inNodeId = Number((def.inputNode && def.inputNode.id) != null ? def.inputNode.id : INPUT_NODE);
    const outNodeId = Number((def.outputNode && def.outputNode.id) != null ? def.outputNode.id : OUTPUT_NODE);

    const instInputs = Array.isArray(inst.inputs) ? inst.inputs : [];
    const instOutputs = Array.isArray(inst.outputs) ? inst.outputs : [];

    /* What feeds each exposed input: a wire from the parent, a value typed on
       the instance, or nothing at all. */
    const widgetInputs = instInputs.filter((i) => i && i.widget);
    const wv = Array.isArray(inst.widgets_values) ? inst.widgets_values : [];
    const source = new Map();                    // input slot -> {id, slot}
    /* 2.401.5 (Comfy-Org's own LTX 2.5 templates): an instance whose inputs are NOT the definition's in the same
       order (it lists 11 of its 14, value_5 where the definition has noise_seed). Then the instance's
       widgets_values are the definition's widget-typed inputs in DEFINITION order, and a wire on the instance
       belongs to the definition input of the same NAME. Aligned instances (Tim's canvas) keep the old walk. */
    const defIns0 = Array.isArray(def.inputs) ? def.inputs : [];
    const aligned = instInputs.every((inp, i) => !inp || !defIns0[i] || String(defIns0[i].name) === String(inp.name));
    if (!aligned) {
      const WT = ["INT", "FLOAT", "STRING", "BOOLEAN", "COMBO"];
      let k = 0;
      defIns0.forEach((di, slot) => {
        const isW = WT.includes(String((di && di.type) || ""));
        const inp = instInputs.find((x) => x && String(x.name) === String(di && di.name));
        const lid = inp && inp.link;
        const l = lid !== null && lid !== undefined ? links.find((x) => String(x.id) === String(lid)) : null;
        if (l) source.set(slot, { id: String(l.origin_id), slot: Number(l.origin_slot) });
        else if (isW && k < wv.length) {
          const pid = prefix + "w" + (seq.n += 1);
          nodes.push({ id: pid, type: "PrimitiveNode", widgets_values: [wv[k]],
                       inputs: [], outputs: [{ name: "value", type: String((di && di.type) || "*"), links: [] }],
                       title: `${name} → ${di.name}` });
          source.set(slot, { id: pid, slot: 0 });
        }
        if (isW) k++;
      });
    }
    if (aligned) instInputs.forEach((inp, slot) => {
      const lid = inp && inp.link;
      if (lid !== null && lid !== undefined) {
        const l = links.find((x) => String(x.id) === String(lid));
        if (l) { source.set(slot, { id: String(l.origin_id), slot: Number(l.origin_slot) }); return; }
      }
      if (inp && inp.widget) {
        const wi = widgetInputs.indexOf(inp);
        if (wi >= 0 && wi < wv.length) {
          /* A value typed on the instance. It becomes a primitive so that the
             converter's existing inlining writes it into the inner widget. */
          const pid = prefix + "w" + (seq.n += 1);
          nodes.push({ id: pid, type: "PrimitiveNode", widgets_values: [wv[wi]],
                       inputs: [], outputs: [{ name: "value", type: String(inp.type || "*"), links: [] }],
                       title: `${name} → ${inp.name}` });
          source.set(slot, { id: pid, slot: 0 });
        }
      }
    });

    /* 2.338.0 (Tim's LTX 2.5 all-in-one canvas): a PROMOTED widget the
       instance lists no input for - the definition's inputs run past the
       instance's (its `sampler_name`), and its value is simply the next one
       in the instance's widgets_values, after the widget inputs it does
       list. Without this the inner KSamplerSelect lost its sampler_name and
       ComfyUI refused the prompt ("Required input is missing"). */
    const defInputs = Array.isArray(def.inputs) ? def.inputs : [];
    let extraW = widgetInputs.length;
    for (let slot = instInputs.length; aligned && slot < defInputs.length; slot++) {
      const di = defInputs[slot] || {};
      if (source.has(slot) || !["INT", "FLOAT", "STRING", "BOOLEAN", "COMBO"].includes(String(di.type || ""))) continue;
      if (extraW >= wv.length) break;
      const pid = prefix + "w" + (seq.n += 1);
      nodes.push({ id: pid, type: "PrimitiveNode", widgets_values: [wv[extraW++]],
                   inputs: [], outputs: [{ name: "value", type: String(di.type || "*"), links: [] }],
                   title: `${name} → ${di.name}` });
      source.set(slot, { id: pid, slot: 0 });
    }

    const innerLinks = (Array.isArray(def.links) ? def.links : []).map(normLink).filter(Boolean);

    /* What each exposed OUTPUT is, on the inside. Recorded before the inner
       links are emitted, because a link into -20 is a declaration, not a wire. */
    const innerOut = new Map();                  // output slot -> {id, slot}
    for (const L of innerLinks) {
      if (Number(L.target_id) !== outNodeId) continue;
      innerOut.set(Number(L.target_slot),
                   Number(L.origin_id) === inNodeId
                     ? (source.get(Number(L.origin_slot)) || null)      // straight through
                     : { id: prefix + L.origin_id, slot: Number(L.origin_slot) });
    }

    /* The inner nodes, renamed. */
    const dropped = new Set();                   // inner link ids that lead nowhere
    for (const L of innerLinks) {
      if (Number(L.target_id) === outNodeId) continue;
      if (Number(L.origin_id) === inNodeId && !source.has(Number(L.origin_slot))) dropped.add(String(L.id));
    }
    for (const inner of (Array.isArray(def.nodes) ? def.nodes : [])) {
      if (!inner || inner.id === undefined) continue;
      const n = clone(inner);
      n.id = prefix + inner.id;
      for (const i of (Array.isArray(n.inputs) ? n.inputs : [])) {
        if (i && i.link !== null && i.link !== undefined) {
          i.link = dropped.has(String(i.link)) ? null : prefix + i.link;
        }
      }
      /* The output link lists are rebuilt implicitly by the link table the
         converter reads; leaving stale ids on them would be a second, wrong
         answer to "what is connected", so they go. */
      for (const o of (Array.isArray(n.outputs) ? n.outputs : [])) if (o) o.links = [];
      nodes.push(n);
    }
    for (const L of innerLinks) {
      if (Number(L.target_id) === outNodeId) continue;
      if (dropped.has(String(L.id))) continue;
      const from = Number(L.origin_id) === inNodeId
        ? source.get(Number(L.origin_slot))
        : { id: prefix + L.origin_id, slot: Number(L.origin_slot) };
      if (!from) continue;
      links.push({ id: prefix + L.id, origin_id: from.id, origin_slot: from.slot,
                   target_id: prefix + L.target_id, target_slot: Number(L.target_slot), type: L.type });
    }

    /* The parent's wires OUT of the instance now come from inside it. */
    for (const L of links) {
      if (String(L.origin_id) !== iid) continue;
      const hit = innerOut.get(Number(L.origin_slot));
      if (hit) { L.origin_id = hit.id; L.origin_slot = hit.slot; continue; }
      const out = instOutputs[Number(L.origin_slot)];
      warnings.push(`subgraph "${name}" (node ${iid}): output "${(out && out.name) || L.origin_slot}" is not connected inside it`);
      L.origin_id = null;
    }
    unlink(nodes, links, (L) => L.origin_id === null || String(L.target_id) === iid);

    const at = nodes.findIndex((x) => String(x.id) === iid);
    if (at >= 0) nodes.splice(at, 1);
  }
  return did;
}

/** Delete links matching `pred`, and null the inputs that pointed at them. */
function unlink(nodes, links, pred) {
  const dead = new Set();
  for (let i = links.length - 1; i >= 0; i--) {
    if (pred(links[i])) { dead.add(String(links[i].id)); links.splice(i, 1); }
  }
  if (!dead.size) return;
  for (const n of nodes) {
    for (const i of (Array.isArray(n.inputs) ? n.inputs : [])) {
      if (i && i.link !== null && i.link !== undefined && dead.has(String(i.link))) i.link = null;
    }
  }
}

/**
 * Turn every Get by name back into a wire from the matching Set.
 *
 * A Set whose name nothing gets is simply dropped; a Get with no Set is a
 * WARNING and its consumer is left unplugged, because the alternative — quietly
 * removing the consumer — is how a render comes back missing a LoRA with
 * nothing in the log to say so.
 */
function resolveSetGet(nodes, links, warnings, resolved) {
  const sets = new Map();                        // name -> {id, slot}
  const setById = new Map();                     // SetNode id -> {id, slot} (its passthrough output)
  const gets = new Map();                        // node id -> name
  const nameOf = (n) => String((Array.isArray(n.widgets_values) ? n.widgets_values[0] : "") || "");
  for (const n of nodes) {
    const t = String(n.type || "");
    if (t === "SetNode") {
      const inp = (Array.isArray(n.inputs) ? n.inputs : [])[0];
      const l = inp && inp.link != null ? links.find((x) => String(x.id) === String(inp.link)) : null;
      if (l) { sets.set(nameOf(n), { id: String(l.origin_id), slot: Number(l.origin_slot) }); setById.set(String(n.id), sets.get(nameOf(n))); }
      else warnings.push(`SetNode "${nameOf(n)}" (node ${n.id}) has nothing plugged into it`);
    } else if (t === "GetNode") {
      gets.set(String(n.id), nameOf(n));
    }
  }
  if (!sets.size && !gets.size) return false;

  /** A Set fed by a Get is legal and does happen; follow it. */
  const trace = (hit, hops = 0) => {
    if (!hit || hops > MAX_DEPTH) return null;
    const name = gets.get(String(hit.id));
    if (name === undefined) return hit;
    const next = sets.get(name);
    if (!next) return null;
    return trace(next, hops + 1);
  };

  const missing = new Set();
  for (const L of links) {
    // 2.338.0: KJ's SetNode also passes its value straight through its own
    // output (Tim's LTX canvas wires "Set_length" -> Math Expression that way)
    const thru = setById.get(String(L.origin_id));
    if (thru) { const hit = trace(thru); if (hit) { L.origin_id = hit.id; L.origin_slot = hit.slot; } else L.origin_id = null; continue; }
    const name = gets.get(String(L.origin_id));
    if (name === undefined) continue;
    const hit = trace(sets.get(name));
    if (hit) { L.origin_id = hit.id; L.origin_slot = hit.slot; resolved.push(name); }
    else { L.origin_id = null; if (!missing.has(name)) { missing.add(name); warnings.push(`GetNode "${name}" has no matching SetNode — its consumer is left unplugged`); } }
  }
  const virtual = new Set([...gets.keys()]);
  for (const n of nodes) if (String(n.type || "") === "SetNode") virtual.add(String(n.id));
  unlink(nodes, links, (L) => L.origin_id === null || virtual.has(String(L.target_id)));
  for (let i = nodes.length - 1; i >= 0; i--) if (virtual.has(String(nodes[i].id))) nodes.splice(i, 1);
  return true;
}

/**
 * A UI export in, a flat UI export out.
 * @returns {{graph, warnings, expanded, resolved, changed}}
 */
function flatten(ui) {
  const warnings = [];
  const expanded = [];
  const resolved = [];
  if (!needsFlatten(ui)) return { graph: ui, warnings, expanded, resolved, changed: false };

  const nodes = ui.nodes.map(clone);
  const links = (Array.isArray(ui.links) ? ui.links : []).map(normLink).filter(Boolean);
  const defs = subgraphDefs(ui);
  const seq = { n: 0 };

  let depth = 0;
  while (expandOnce(nodes, links, defs, warnings, expanded, seq)) {
    if ((depth += 1) >= MAX_DEPTH) {
      warnings.push(`subgraphs are nested more than ${MAX_DEPTH} deep — the rest were left folded`);
      break;
    }
  }
  resolveSetGet(nodes, links, warnings, resolved);

  const graph = Object.assign({}, ui, { nodes, links });
  delete graph.definitions;                      // there is nothing folded any more
  return { graph, warnings, expanded, resolved, changed: true };
}

module.exports = { flatten, needsFlatten, subgraphDefs, resolveSetGet, normLink,
                   INPUT_NODE, OUTPUT_NODE, MAX_DEPTH, SET_TYPES };
