"use strict";
/**
 * bitGen Studio — engine autostart (2.205.0, by instruction: "add option in
 * comfui tab to start on startup. add an option in llm tab to start on
 * startup - start with the llm in the dropdown under prompt").
 *
 * plan(cfg) is PURE and unit-tested: it answers what should start, and with
 * what. The routes call run() once at mount with the real starters injected;
 * failures are logged, never fatal — a machine that cannot start ComfyUI
 * must still boot the studio.
 */
function plan(cfg) {
  const c = cfg || {};
  const comfy = !!(((c.engine || {}).comfy || {}).autostart);
  const llm = (c.llm || {}).autostart
    ? String((c.llm || {}).last_file || "").trim() || "default"
    : null;
  return { comfy, llm };
}

async function run(cfg, starters, log) {
  const p = plan(cfg);
  const say = log || console.log;
  if (p.comfy) {
    say("[autostart] ComfyUI (Settings → ComfyUI → start on startup)");
    try { await starters.comfy(); }
    catch (e) { say("[autostart] ComfyUI failed: " + (e && e.message || e)); }
  }
  if (p.llm) {
    say(`[autostart] llama-server (${p.llm === "default"
      ? "first model" : p.llm} — Settings → LLM → start on startup)`);
    try { await starters.llm(p.llm === "default" ? undefined : p.llm); }
    catch (e) { say("[autostart] llama-server failed: " + (e && e.message || e)); }
  }
  return p;
}

module.exports = { plan, run };
