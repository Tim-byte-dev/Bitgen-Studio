// bitGen Studio — lib/remoteGpu.js (2.520.0): RENDER ON ANOTHER MACHINE - Settings -> Remote GPU.
// Tim (verbatim): "add a remote gpu tab in settings in case users can use a remote machine or runpod headless etc."
//
//   This computer  ComfyUI here (engine.comfy.url as it was, started with the app)
//   Remote URL     a ComfyUI anywhere the app can reach: another PC on the network, a VPN / Tailscale address, a cloud
//                  machine's proxy (http(s)://host:port)
//   RunPod         your API key (runpod.io -> Settings -> API Keys): your pods listed (GPU, $/hour, running or not),
//                  ▶ start / ⏹ stop, a pod's ComfyUI through RunPod's proxy https://<pod id>-<port>.proxy.runpod.net
//   SSH tunnel     ssh -N -L <local>:127.0.0.1:<remote> user@host (a headless box / a pod's SSH): the app keeps the
//                  tunnel open and talks to http://127.0.0.1:<local>
//   ✓ Test         <url>/system_stats - the machine's GPU, its VRAM, ComfyUI's version
//   Use it         engine.comfy.url = the remote, ComfyUI here not started (the old url / autostart kept in
//                  config.rgpu.prev (config.remote is the phone's) - This computer puts them back)
//   The workers already send pictures with /upload/image and fetch results with /view, so a remote ComfyUI renders
//   the same jobs. Its models must be on THAT machine. The power meters see this computer only: a remote job's cost is
//   its time x the $/hour you set (RunPod: the pod's own price) - lib/usageLog.js
// Pure (scripts/test-remote520.js): MODES, runpodUrl, mapPod, sshArgs, cleanUrl, describe.
"use strict";
const { spawn } = require("child_process");

const MODES = ["local", "url", "runpod", "ssh"];
const RUNPOD_API = "https://rest.runpod.io/v1";

function cleanUrl(u) {
  let s = String(u || "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) { if (/^[a-z]+:/i.test(s) && !/^[^:/]+:\d/.test(s)) return ""; s = "http://" + s; }
  if (/^https?:\/\/\/*$/i.test(s)) return "";
  try { const x = new URL(s); return x.origin + x.pathname.replace(/\/+$/, ""); } catch { return ""; }
}
const runpodUrl = (id, port) => `https://${String(id || "").replace(/[^a-z0-9]/gi, "")}-${+port || 8188}.proxy.runpod.net`;
/** a RunPod pod (REST v1 or v2 fields) -> {id, name, status, gpu, gpus, cost_hr, url} */
function mapPod(p, port) {
  const g = p.gpu || p.machine || {};
  return { id: p.id, name: p.name || p.id, status: String(p.desiredStatus || p.status || "").toUpperCase(),
    gpu: g.displayName || g.gpuDisplayName || g.id || (p.gpuTypeId || "") || "", gpus: +(p.gpuCount || g.count || 1),
    cost_hr: +(p.costPerHr || p.adjustedCostPerHr || p.cost || 0), url: runpodUrl(p.id, port) };
}
/** ssh's arguments for the tunnel (pure) */
function sshArgs(o) {
  const a = ["-N", "-L", `${+o.local_port || 8189}:127.0.0.1:${+o.remote_port || 8188}`, "-o", "ExitOnForwardFailure=yes", "-o", "ServerAliveInterval=30", "-o", "StrictHostKeyChecking=accept-new"];
  if (+o.port && +o.port !== 22) a.push("-p", String(+o.port));
  if (o.key) a.push("-i", String(o.key));
  a.push(`${o.user ? String(o.user).replace(/[^A-Za-z0-9._-]/g, "") + "@" : ""}${String(o.host || "").replace(/[^A-Za-z0-9.:_-]/g, "")}`);
  return a;
}
/** the label + url + $/hour of a remote config (pure) */
function describe(r) {
  const c = r || {};
  if (c.mode === "url") return { mode: "url", label: "Remote ComfyUI " + (cleanUrl(c.url) || "?"), url: cleanUrl(c.url), cost_hr: +c.cost_hr || 0 };
  if (c.mode === "runpod") { const rp = c.runpod || {}; return { mode: "runpod", label: "RunPod " + (rp.pod_name || rp.pod_id || "?"), url: rp.pod_id ? runpodUrl(rp.pod_id, rp.port) : "", cost_hr: +rp.cost_hr || 0 }; }
  if (c.mode === "ssh") { const s = c.ssh || {}; return { mode: "ssh", label: "SSH " + (s.user ? s.user + "@" : "") + (s.host || "?"), url: `http://127.0.0.1:${+s.local_port || 8189}`, cost_hr: +c.cost_hr || 0 }; }
  return { mode: "local", label: "This computer", url: "", cost_hr: 0 };
}

/* ---------------- live */
function core() { return require("./core"); }
function cfg() { const c = core().getConfig(); c.rgpu = c.rgpu && typeof c.rgpu === "object" ? c.rgpu : { mode: "local" }; return c; }
function current() { return describe(cfg().rgpu); }
async function test(url) {
  const u = cleanUrl(url);
  if (!u) return { ok: false, error: "not a URL" };
  try {
    const r = await fetch(u + "/system_stats", { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return { ok: false, error: `HTTP ${r.status} from ${u}/system_stats - is it ComfyUI?` };
    const j = await r.json();
    const dev = ((j && j.devices) || []).map((d) => ({ name: d.name, vram_gb: d.vram_total ? Math.round(d.vram_total / 1073741824 * 10) / 10 : null, type: d.type }));
    return { ok: true, url: u, devices: dev, comfyui: (j.system || {}).comfyui_version || "", python: (j.system || {}).python_version || "" };
  } catch (e) { return { ok: false, error: `${u} did not answer (${String(e.message || e).slice(0, 120)})` }; }
}
async function runpod(method, p, key, body) {
  if (!key) { const e = new Error("a RunPod API key first (runpod.io -> Settings -> API Keys)"); e.status = 400; throw e; }
  const r = await fetch(RUNPOD_API + p, { method, headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
  const txt = await r.text();
  let j = null; try { j = JSON.parse(txt); } catch { j = null; }
  if (r.status === 401 || r.status === 403) { const e = new Error("RunPod refused the API key"); e.status = 401; throw e; }
  if (!r.ok) { const e = new Error(`RunPod answered HTTP ${r.status}${txt ? ": " + txt.slice(0, 160) : ""}`); e.status = 502; throw e; }
  return j;
}
async function pods(key, port) {
  const k = key || ((cfg().rgpu.runpod || {}).key) || "";
  const j = await runpod("GET", "/pods", k);
  return (Array.isArray(j) ? j : (j && (j.pods || j.data)) || []).map((p) => mapPod(p, port));
}
async function podAction(id, action) {
  const k = ((cfg().rgpu.runpod || {}).key) || "";
  if (!["start", "stop"].includes(action)) { const e = new Error("start or stop"); e.status = 400; throw e; }
  await runpod("POST", `/pods/${encodeURIComponent(id)}/${action}`, k);
  return { ok: true };
}
const TUN = { proc: null, state: "stopped", log: [], args: null };
function tunnel(start) {
  if (!start) { if (TUN.proc) { try { TUN.proc.kill(); } catch { /* gone */ } } TUN.proc = null; TUN.state = "stopped"; return tunnelState(); }
  if (TUN.proc) return tunnelState();
  const s = cfg().rgpu.ssh || {};
  if (!s.host) { const e = new Error("the SSH host first"); e.status = 400; throw e; }
  TUN.args = sshArgs(s); TUN.log = []; TUN.state = "starting";
  let p;
  try { p = spawn("ssh", TUN.args, { windowsHide: true }); } catch (e) { TUN.state = "error"; TUN.log.push(String(e.message || e)); return tunnelState(); }
  TUN.proc = p;
  const keep = (d) => { for (const l of String(d).split(/\r?\n/)) if (l.trim()) { TUN.log.push(l.slice(0, 300)); if (TUN.log.length > 40) TUN.log.shift(); } };
  p.stdout.on("data", keep); p.stderr.on("data", keep);
  p.on("error", (e) => { TUN.state = "error"; keep(e.message); TUN.proc = null; });
  p.on("close", (code) => { if (TUN.proc === p) { TUN.proc = null; TUN.state = code === 0 ? "stopped" : "error"; keep(`ssh exited ${code}`); } });
  setTimeout(() => { if (TUN.proc === p && TUN.state === "starting") TUN.state = "running"; }, 2500).unref();
  return tunnelState();
}
function tunnelState() { return { state: TUN.state, log: TUN.log.slice(-12), cmd: TUN.args ? "ssh " + TUN.args.join(" ") : "" }; }
/** save the tab's fields (no switch) */
function save(b) {
  const c = cfg(), r = Object.assign({}, c.rgpu);
  if (b.url !== undefined) r.url = cleanUrl(b.url);
  if (b.cost_hr !== undefined) r.cost_hr = Math.max(0, Math.min(1000, +b.cost_hr || 0));
  if (b.runpod) r.runpod = Object.assign({}, r.runpod || {}, { key: String(b.runpod.key != null ? b.runpod.key : (r.runpod || {}).key || "").trim(),
    pod_id: String(b.runpod.pod_id != null ? b.runpod.pod_id : (r.runpod || {}).pod_id || ""), pod_name: String(b.runpod.pod_name != null ? b.runpod.pod_name : (r.runpod || {}).pod_name || ""),
    cost_hr: +(b.runpod.cost_hr != null ? b.runpod.cost_hr : (r.runpod || {}).cost_hr || 0), port: +(b.runpod.port || (r.runpod || {}).port || 8188) });
  if (b.ssh) r.ssh = Object.assign({}, r.ssh || {}, { host: String(b.ssh.host || "").trim(), user: String(b.ssh.user || "").trim(), port: +b.ssh.port || 22,
    key: String(b.ssh.key || "").trim(), remote_port: +b.ssh.remote_port || 8188, local_port: +b.ssh.local_port || 8189 });
  c.rgpu = r; core().setConfig(c);
  return view();
}
/** switch: local puts the old ComfyUI url / autostart back; a remote mode points engine.comfy.url at it */
function use(mode) {
  if (!MODES.includes(mode)) { const e = new Error("unknown mode"); e.status = 400; throw e; }
  const c = cfg(), r = c.rgpu;
  c.engine = c.engine || {}; c.engine.comfy = c.engine.comfy || {};
  if (mode === "local") {
    if (r.prev) { c.engine.comfy.url = r.prev.url || "http://127.0.0.1:8188"; c.engine.comfy.autostart = r.prev.autostart !== false; }
    r.mode = "local"; delete r.prev;
    if (TUN.proc) tunnel(false);
  } else {
    const d = describe(Object.assign({}, r, { mode }));
    if (!d.url) { const e = new Error(mode === "runpod" ? "pick a pod first" : mode === "ssh" ? "the SSH host first" : "the remote URL first"); e.status = 400; throw e; }
    if (!r.prev || r.mode === "local" || !r.mode) r.prev = { url: c.engine.comfy.url || "http://127.0.0.1:8188", autostart: c.engine.comfy.autostart !== false };
    r.mode = mode; c.engine.comfy.url = d.url; c.engine.comfy.autostart = false;
    if (mode === "ssh") tunnel(true);
  }
  c.rgpu = r; core().setConfig(c);
  return view();
}
function view() {
  const r = cfg().rgpu;
  const rp = Object.assign({}, r.runpod || {}); if (rp.key) rp.key_set = true;
  return { mode: r.mode || "local", current: describe(r), url: r.url || "", cost_hr: r.cost_hr || 0, runpod: rp, ssh: r.ssh || {}, tunnel: tunnelState(),
           comfy_url: ((cfg().engine || {}).comfy || {}).url || "", modes: MODES };
}

module.exports = { MODES, RUNPOD_API, cleanUrl, runpodUrl, mapPod, sshArgs, describe, current, test, pods, podAction, tunnel, tunnelState, save, use, view };
