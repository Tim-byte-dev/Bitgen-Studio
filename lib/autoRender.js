// bitGen Studio — RENDER SCENES AS THE WRITER WRITES THEM (2.293.0).
//
// Tim (verbatim): "can we populate each scene as they are created so users
// with 2 gpu's can start rendering while waiting for new scenes to be
// created".
//
// The iterative writer (2.186.0) already SAVES each scene to the board the
// moment it exists. What was missing: nothing rendered it until the whole
// screenplay was done, and the page did not show it until then either.
// With the board's "▶ as written" switch on (auto_render, saved with the
// board), every scene the writer finishes joins the board's render queue
// (scenes.pending - the 2.149.0 queue syncJobs advances one scene at a
// time), so:
//   - the queue stays SERIAL and in story order: scene 2 launches only when
//     scene 1's take has landed, so a First/Trans/Ref scene that follows
//     scene 1 finds its frame / its tail video at launch - exactly as
//     "render selected" behaves;
//   - a blank staged scene (lib/segBoard placeholder) never renders.
//
// WHICH CARD (the whole point is two GPUs): the chat LLM runs on
// llm.device (default cuda1), ComfyUI renders on comfy.gpu (default cuda0).
//   different cards (or the LLM on cpu) -> "live": each scene is queued the
//       moment it is written - the render card works while the LLM card
//       writes the next scene;
//   the SAME card -> "after": a 30 GB video model and the LLM cannot share
//       one card, so the written scenes are queued when the writer
//       finishes, after the LLM is stopped to hand its VRAM to the render
//       (the chat reloads it on its next message).
const scenes = require("./scenes");
const segBoard = require("./segBoard");

function devices(cfg) {
  const c = cfg || {};
  return { llm: String((c.llm && c.llm.device) || "cuda1"),
           render: String((c.comfy && c.comfy.gpu) || "cuda0") };
}

/** How the writer should render: {mode: "off"|"live"|"after", note}. */
function mode(cfg, st) {
  if (!st || st.auto_render !== true) return { mode: "off", note: "" };
  const d = devices(cfg);
  if (d.llm === "cpu" || d.llm !== d.render)
    return { mode: "live", devices: d, note: `▶ as written: each scene renders `
      + `on ${d.render} as soon as it is written (the writer runs on ${d.llm})` };
  return { mode: "after", devices: d, note: `▶ as written: the writer and the `
    + `render share ${d.render}, so the written scenes render when the writer `
    + "finishes (the LLM is stopped first to free the card). Put the LLM on "
    + "your second GPU (Settings → LLM → device) to render while it writes" };
}

/** Queue the written scenes `ns` (scene numbers) behind whatever is
 *  queued. Skips a missing or blank scene, one already rendering or queued,
 *  and one that already has a take for this exact prompt (rendered/kept -
 *  fromPlan keeps that status only when the text did not change). Returns
 *  {state, queued: [n...], skipped: [{n, why}...]}. */
function queueWritten(st, ns) {
  const s = scenes.safe(st);
  const ok = [], skipped = [];
  for (const n of ns || []) {
    const r = scenes.at(s, n);
    if (!r) { skipped.push({ n, why: "no such scene" }); continue; }
    if (segBoard.isBlank(r.prompt) || !(r.prompt || []).some((l) => String(l).trim())) {
      skipped.push({ n, why: "blank" }); continue;
    }
    if (["rendered", "kept"].includes(r.status)) {
      skipped.push({ n, why: "already rendered" }); continue;
    }
    ok.push(r.n);
  }
  const q = scenes.queueRenders(s, ok);
  const queued = q.queued.map((id) => (q.state.list.find((r) => r.id === id) || {}).n)
    .filter((n) => n != null);
  for (const n of ok) if (!queued.includes(n))
    skipped.push({ n, why: "already rendering or queued" });
  return { state: q.state, queued, skipped };
}

module.exports = { devices, mode, queueWritten };
