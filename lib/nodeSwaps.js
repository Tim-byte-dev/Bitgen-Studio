/* bitGen Studio — A CUSTOM NODE THE APP DOES NOT INSTALL -> ONE IT DOES (2.401.3).
 *
 * Tim's run (verbatim): "ComfyUI does not have these node types, which the LTX 2.5 workflow needs: FinalFrameSelector
 * (install the missing custom nodes)".
 *
 * Tim's LTX 2.5 canvas picks the last frame of a clip with ComfyUI-MediaMixer's FinalFrameSelector - a pack the
 * studio never installed (lib/nodePacks.json) and a single node's worth of work. KJNodes (installed, the canvas uses
 * it anyway) does the same with GetImageRangeFromBatch: start_index -1 = count back from the end, num_frames 1 = the
 * last frame (its own docs). So:
 *
 *   FinalFrameSelector (MediaMixer)  images -> IMAGE     =>  GetImageRangeFromBatch(images, start_index -1, num_frames 1)
 *   FirstFrameSelector (MediaMixer)  images -> IMAGE     =>  GetImageRangeFromBatch(images, start_index 0,  num_frames 1)
 *
 * The input `images` stays slot 0 and IMAGE stays output 0 (a MASK output is added after it), so no link moves.
 * swap(ui, only?) rewrites a UI export in place - top level + every subgraph definition - like lib/mathNodes.migrate;
 * lib/ltxWorkflow.prepare runs it on every LTX conversion, lib/graphToApi for a ComfyUI without MediaMixer. */
"use strict";

const TABLE = {
  FinalFrameSelector: { type: "GetImageRangeFromBatch", widgets: [-1, 1], pack: "comfyui-kjnodes" },
  FirstFrameSelector: { type: "GetImageRangeFromBatch", widgets: [0, 1], pack: "comfyui-kjnodes" },
};

function swapList(nodes, changed, where, only) {
  for (const n of nodes || []) {
    const t = String((n && n.type) || "");
    const to = TABLE[t];
    if (!to || (only && !only.has(t))) continue;
    const img = (Array.isArray(n.inputs) ? n.inputs : []).find((i) => i && (i.name === "images" || i.type === "IMAGE"));
    const out0 = (Array.isArray(n.outputs) ? n.outputs : [])[0] || {};
    n.type = to.type;
    n.properties = { ...(n.properties || {}), "Node name for S&R": to.type, cnr_id: to.pack };
    delete n.properties.ver;
    delete n.properties.aux_id;
    n.inputs = [{ localized_name: "images", name: "images", shape: 7, type: "IMAGE", link: img && img.link != null ? img.link : null },
                { localized_name: "masks", name: "masks", shape: 7, type: "MASK", link: null }];
    n.outputs = [{ localized_name: "IMAGE", name: "IMAGE", type: "IMAGE", links: out0.links || [] },
                 { localized_name: "MASK", name: "MASK", type: "MASK", links: [] }];
    n.widgets_values = to.widgets.slice();
    changed.push({ where, id: n.id, from: t, to: to.type });
  }
}

/** Swap in place; [{where, id, from, to}]. */
function swap(ui, only) {
  const changed = [];
  if (!ui || typeof ui !== "object") return changed;
  if (Array.isArray(ui.nodes)) swapList(ui.nodes, changed, "top", only);
  for (const d of ((ui.definitions || {}).subgraphs) || []) if (d) swapList(d.nodes, changed, String(d.name || d.id), only);
  return changed;
}

/** The swappable classes a UI export still uses. */
function leftover(ui) {
  const out = new Set();
  const scan = (ns) => { for (const n of ns || []) if (n && TABLE[String(n.type)]) out.add(String(n.type)); };
  scan(ui && ui.nodes);
  for (const d of ((ui && ui.definitions) || {}).subgraphs || []) scan(d && d.nodes);
  return [...out];
}

module.exports = { TABLE, swap, leftover };
