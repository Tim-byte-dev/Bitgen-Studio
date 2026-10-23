/* bitGen Studio — lib/comfyRestart.js (2.580.0): ⟳ Restart ComfyUI - the 📁 Model paths tab's button (ComfyUI reads
 * extra_model_paths.yaml only when it starts). Tim: "add restart comfy button in this tab".
 *   restart()  the ComfyUI bitGen Studio started: stopped, the port waited free, started again (its console streams into
 *              the app console as on every launch) -> {ok, restarted: true, ...start()}
 *              not running at all: started -> {ok, started: true}
 *              running but started by someone else: left alone -> {ok: false, external: true, reason} - bitGen Studio
 *              cannot stop a process it does not own (the same rule as relaunch-console)
 * The comfy functions are injectable (setDeps) so the unit test needs no ComfyUI. */
"use strict";

let deps = null;
function D() {
  if (deps) return deps;
  const comfy = require("./comfy");
  return {
    status: () => comfy.status(),
    stop: () => comfy.stop(),
    start: () => comfy.start(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
}
function setDeps(d) { deps = d; }

let busy = false;
async function restart() {
  if (busy) return { ok: false, busy: true, reason: "a restart is already under way" };
  busy = true;
  try {
    const d = D();
    const st = await d.status();
    if (st.reachable && !st.managed)
      return { ok: false, external: true,
               reason: "ComfyUI is running but was not started by bitGen Studio - close it yourself and press ⟳ again (bitGen Studio then starts it)" };
    let was = false;
    if (st.managed) {
      d.stop(); was = true;
      // the port has to be free before the new ComfyUI asks for it
      for (let i = 0; i < 30; i++) { const s = await d.status(); if (!s.reachable) break; await d.sleep(400); }
    }
    const r = await d.start();
    return { ok: true, restarted: was, started: !was, ...r };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  } finally { busy = false; }
}

module.exports = { restart, setDeps };
