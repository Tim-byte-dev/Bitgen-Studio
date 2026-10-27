/* bitGen Studio — lib/comfyBoot.js (2.603.0): A COMFYUI ALREADY RUNNING WHEN THE APP STARTS IS RESTARTED.
 *
 * Tim (verbatim): "check if comfyui is open onstart if it is then restart comfyui".
 * A ComfyUI that answers before bitGen Studio has started one was left by an earlier session (or started by hand): the
 * app cannot see its console, stop it or restart it, and it keeps the VRAM and its cached node outputs. At startup:
 *   - Settings ▸ ComfyUI ▸ "Restart a ComfyUI left running" off (engine.comfy.restart_on_start === false) = left alone
 *   - the address is not this computer (127.0.0.1 / localhost / ::1 / 0.0.0.0) = left alone (someone else's machine)
 *   - no ComfyUI folder and no launch command = left alone (bitGen Studio could not start its own after)
 *   - otherwise: whatever holds its port is ended (Windows: netstat -ano -> taskkill /T /F; else lsof / fuser), the
 *     port waited free (20 s), and ComfyUI started again by bitGen Studio (its console in the app console)
 * Runs once, before the autostart (routes/index.js), never fatal. Pure: isLocal(url), portOf(url),
 * pidsFromNetstat(text, port), pidsFromLsof(text); the side effects are injectable (run(cfg, deps)).
 */
"use strict";
const { spawnSync } = require("child_process");

function isLocal(url) {
  try { const h = new URL(String(url || "http://127.0.0.1:8188")).hostname.replace(/^\[|\]$/g, "").toLowerCase(); return ["127.0.0.1", "localhost", "::1", "0.0.0.0"].includes(h); }
  catch { return false; }
}
function portOf(url) {
  try { const u = new URL(String(url || "http://127.0.0.1:8188")); return +u.port || (u.protocol === "https:" ? 443 : 80); }
  catch { return 8188; }
}
/** netstat -ano (Windows): the PIDs LISTENING on the port */
function pidsFromNetstat(text, port) {
  const out = new Set();
  for (const ln of String(text || "").split(/\r?\n/)) {
    const p = ln.trim().split(/\s+/);
    if (p.length < 5 || !/^TCP/i.test(p[0]) || !/LISTEN/i.test(p[3])) continue;
    const m = /:(\d+)$/.exec(p[1]);
    if (m && +m[1] === +port && /^\d+$/.test(p[4]) && +p[4] > 0) out.add(+p[4]);
  }
  return [...out];
}
function pidsFromLsof(text) { return [...new Set(String(text || "").split(/\s+/).filter((x) => /^\d+$/.test(x)).map(Number).filter((n) => n > 0))]; }

function realDeps() {
  const comfy = () => require("./comfy");   // only when used (the tests hand their own)
  return {
    status: () => comfy().status(),
    start: () => comfy().start(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    pidsOn(port) {
      if (process.platform === "win32") {
        const r = spawnSync("netstat", ["-ano", "-p", "TCP"], { encoding: "utf8", windowsHide: true, timeout: 15000 });
        return pidsFromNetstat(r.stdout, port);
      }
      const r = spawnSync("lsof", ["-t", `-iTCP:${port}`, "-sTCP:LISTEN"], { encoding: "utf8", timeout: 15000 });
      if (!r.error) return pidsFromLsof(r.stdout);
      const f = spawnSync("fuser", [`${port}/tcp`], { encoding: "utf8", timeout: 15000 });
      return pidsFromLsof((f.stdout || "") + " " + (f.stderr || "").replace(/^[^:]*:/, ""));
    },
    kill(pid) {
      if (process.platform === "win32") return spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true, timeout: 15000 }).status === 0;
      try { process.kill(pid, "SIGTERM"); return true; } catch { return false; }
    },
  };
}

/** -> {action: "none" | "skipped" | "restarted" | "failed", reason?, pids?} */
async function run(cfg, deps, log) {
  const say = log || console.log;
  const d = Object.assign(realDeps(), deps || {});
  const c = ((cfg || {}).engine || {}).comfy || {};
  if (c.restart_on_start === false) return { action: "none", reason: "off in Settings" };
  const url = c.url || "http://127.0.0.1:8188";
  if (!isLocal(url)) return { action: "none", reason: "not on this computer" };
  let st;
  try { st = await d.status(); } catch (e) { return { action: "none", reason: String(e.message || e) }; }
  if (!st || !st.reachable) return { action: "none" };
  if (st.managed) return { action: "none", reason: "started by bitGen Studio" };
  if (!c.dir && !c.launch) {
    say(`[comfy] a ComfyUI is already running at ${url} - left as it is (no ComfyUI folder in Settings, so bitGen Studio could not start its own)`);
    return { action: "skipped", reason: "no ComfyUI folder" };
  }
  const port = portOf(url);
  say(`[comfy] a ComfyUI is already running at ${url} (left from before) - restarting it so bitGen Studio runs it`);
  const pids = d.pidsOn(port) || [];
  if (!pids.length) { say(`[comfy] could not find what holds port ${port} - left running`); return { action: "skipped", reason: "no process found", pids }; }
  for (const pid of pids) { say(`[comfy] ending process ${pid} (port ${port})`); d.kill(pid); }
  let free = false;
  for (let i = 0; i < 50; i++) { const s = await d.status(); if (!s.reachable) { free = true; break; } await d.sleep(400); }
  if (!free) { say(`[comfy] port ${port} is still answering after 20 s - left running`); return { action: "failed", reason: "still running", pids }; }
  try {
    await d.start();
    say("[comfy] restarted - its console is in the app console");
    return { action: "restarted", pids };
  } catch (e) {
    say("[comfy] the restart could not start ComfyUI: " + (e.message || e));
    return { action: "failed", reason: String(e.message || e), pids };
  }
}

module.exports = { run, isLocal, portOf, pidsFromNetstat, pidsFromLsof };
