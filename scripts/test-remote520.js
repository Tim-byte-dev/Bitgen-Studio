#!/usr/bin/env node
/* bitGen Studio — 2.520.0 units: Settings -> REMOTE GPU (lib/remoteGpu.js, routes/remoteGpu.js, static/remotegpu.js).
 * Tim (verbatim): "add a remote gpu tab in settings in case users can use a remote machine or runpod headless etc."
 * test() runs against a stand-in ComfyUI (/system_stats); save / use run against a stand-in core (an in-memory config),
 * so the switch to a remote GPU and back to this computer is checked without touching custom.settings.
 * Not run here: RunPod's real API (it needs an account) and a real ssh tunnel. */
"use strict";
const fs = require("fs"), path = require("path"), http = require("http");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

// a stand-in core: the real one would load the app's settings
let CFG = { engine: { comfy: { url: "http://127.0.0.1:8188", autostart: true } } };
const corePath = require.resolve("../lib/core.js");
require.cache[corePath] = { id: corePath, filename: corePath, loaded: true, exports: { getConfig: () => JSON.parse(JSON.stringify(CFG)), setConfig: (c) => { CFG = JSON.parse(JSON.stringify(c)); } } };
const R = require("../lib/remoteGpu.js");

(async () => {
  /* ---- pure */
  check("MODES", R.MODES.join() === "local,url,runpod,ssh");
  check("cleanUrl: adds http://, drops the trailing /, refuses junk", R.cleanUrl("192.168.1.20:8188/") === "http://192.168.1.20:8188" && R.cleanUrl("https://x.example.com/comfy/") === "https://x.example.com/comfy" && R.cleanUrl("") === "" && R.cleanUrl("http://") === "");
  check("runpodUrl: the pod's proxy URL for a port", R.runpodUrl("abc123xyz", 8188) === "https://abc123xyz-8188.proxy.runpod.net" && R.runpodUrl("a/b?c", 0) === "https://abc-8188.proxy.runpod.net");
  const v1 = R.mapPod({ id: "p1", name: "comfy", desiredStatus: "RUNNING", costPerHr: 0.69, gpuCount: 1, machine: { gpuDisplayName: "RTX 4090" } }, 8188);
  const v2 = R.mapPod({ id: "p2", status: "exited", cost: 0.34, gpu: { displayName: "RTX A5000", count: 2 } }, 3000);
  check("mapPod: RunPod REST v1 fields (desiredStatus, costPerHr)", v1.status === "RUNNING" && v1.cost_hr === 0.69 && v1.gpu === "RTX 4090" && v1.url === "https://p1-8188.proxy.runpod.net", v1);
  check("mapPod: v2 fields (status, cost, gpu.count)", v2.status === "EXITED" && v2.cost_hr === 0.34 && v2.gpus === 2 && v2.name === "p2" && v2.url.endsWith("-3000.proxy.runpod.net"), v2);
  const a = R.sshArgs({ host: "gpu.example.com", user: "tim", port: 2222, key: "/home/tim/.ssh/id_ed25519", remote_port: 8188, local_port: 8189 });
  check("sshArgs: -N -L local:127.0.0.1:remote, port, key, user@host", a[0] === "-N" && a[2] === "8189:127.0.0.1:8188" && a.includes("-p") && a[a.indexOf("-p") + 1] === "2222" && a[a.indexOf("-i") + 1] === "/home/tim/.ssh/id_ed25519" && a[a.length - 1] === "tim@gpu.example.com", a);
  check("sshArgs: port 22 is the default (no -p); shell characters stripped from user/host", !R.sshArgs({ host: "h", port: 22 }).includes("-p") && R.sshArgs({ host: "h;rm -rf", user: "a b$" }).pop() === "ab@hrm-rf");
  check("describe: local / url / runpod / ssh", R.describe({}).label === "This computer" && R.describe({ mode: "url", url: "10.0.0.5:8188", cost_hr: 0.2 }).url === "http://10.0.0.5:8188"
    && R.describe({ mode: "runpod", runpod: { pod_id: "p1", pod_name: "comfy", cost_hr: 0.69 } }).label === "RunPod comfy" && R.describe({ mode: "ssh", ssh: { host: "h", user: "u", local_port: 9000 } }).url === "http://127.0.0.1:9000");

  /* ---- test() against a stand-in ComfyUI */
  const srv = http.createServer((q, s) => {
    if (q.url === "/system_stats") { s.setHeader("Content-Type", "application/json"); s.end(JSON.stringify({ system: { comfyui_version: "0.3.60", python_version: "3.12" }, devices: [{ name: "cuda:0 NVIDIA GeForce RTX 4090", type: "cuda", vram_total: 25757220864 }] })); }
    else { s.statusCode = 404; s.end("no"); }
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const port = srv.address().port;
  const t = await R.test("127.0.0.1:" + port);
  check("test(): a ComfyUI answers /system_stats -> its version and card (24 GB)", t.ok && t.comfyui === "0.3.60" && t.devices[0].vram_gb === 24 && t.url === "http://127.0.0.1:" + port, t);
  const t2 = await R.test("http://127.0.0.1:" + port + "/nope");
  check("test(): something else -> HTTP 404, is it ComfyUI?", !t2.ok && /404/.test(t2.error), t2);
  srv.close();
  const t3 = await R.test("http://127.0.0.1:" + port);
  check("test(): nothing there -> did not answer", !t3.ok && /did not answer/.test(t3.error), t3);
  check("test(): not a URL", (await R.test("")).error === "not a URL");

  /* ---- save + use (the stand-in config) */
  let err = "", v = R.save({ url: "192.168.1.20:8188/", cost_hr: 0.15 });
  check("save: the URL cleaned + the $/h kept, still local", v.mode === "local" && v.url === "http://192.168.1.20:8188" && v.cost_hr === 0.15 && CFG.engine.comfy.url === "http://127.0.0.1:8188", v);
  err = ""; try { await R.pods(""); } catch (e) { err = e.message; }
  check("pods() with no key: asks for the RunPod API key", /API key/.test(err), err);
  v = R.use("url");
  check("use(url): ComfyUI's URL points at it and the app does not start its own ComfyUI", v.mode === "url" && CFG.engine.comfy.url === "http://192.168.1.20:8188" && CFG.engine.comfy.autostart === false, CFG);
  check("…current() (what the usage log files on a job) = the remote, with its $/h", R.current().mode === "url" && R.current().cost_hr === 0.15);
  R.save({ runpod: { key: "rp_test", pod_id: "p1", pod_name: "comfy", cost_hr: 0.69, port: 8188 } });
  v = R.use("runpod");
  check("use(runpod) from another remote: the proxy URL; the local URL kept to go back to", CFG.engine.comfy.url === "https://p1-8188.proxy.runpod.net" && CFG.rgpu.prev.url === "http://127.0.0.1:8188" && CFG.rgpu.prev.autostart === true, CFG.rgpu);
  check("view: the key is there (to fill the field) + key_set", v.runpod.key === "rp_test" && v.runpod.key_set === true);
  v = R.use("local");
  check("use(local): this computer's ComfyUI URL + autostart back", v.mode === "local" && CFG.engine.comfy.url === "http://127.0.0.1:8188" && CFG.engine.comfy.autostart === true && !CFG.rgpu.prev, CFG);
  err = ""; try { R.use("ssh"); } catch (e) { err = e.message; }
  check("use(ssh) with no host: refused", /SSH host/.test(err), err);
  err = ""; try { R.use("evil"); } catch (e) { err = e.message; }
  check("use(unknown): refused", err === "unknown mode");
  err = ""; try { await R.podAction("p1", "delete"); } catch (e) { err = e.message; }
  check("podAction: only start or stop", err === "start or stop", err);
  check("tunnel(false) when none runs: stopped", R.tunnel(false).state === "stopped");

  /* ---- wiring */
  const IDX = read("routes", "index.js"), SRV = read("server.js"), HTML = read("static", "index.html"), RT = read("routes", "remoteGpu.js"), UI = read("static", "remotegpu.js");
  check("routes/index mounts remoteGpu (not server.js)", /require\("\.\/remoteGpu"\)/.test(IDX) && !/remoteGpu/.test(SRV));
  check("routes: view, save, use, test, pods, pod start/stop, tunnel", ["/api/remotegpu\"", "/api/remotegpu/save", "/api/remotegpu/use", "/api/remotegpu/test", "/api/remotegpu/pods", "/api/remotegpu/pod/:id/:action", "/api/remotegpu/tunnel"].every((u) => RT.includes(u)));
  check("Settings has the Remote GPU tab after ComfyUI, filled by static/remotegpu.js", /data-stab="rgpu">Remote GPU</.test(HTML) && /id="stab-rgpu"/.test(HTML) && /<script src="\/static\/remotegpu\.js/.test(HTML) && /stab-rgpu/.test(UI));
  check("it is config.rgpu (config.remote is the phone remote)", /\.rgpu\b/.test(read("lib", "remoteGpu.js")) && !/cfg\(\)\.remote\b/.test(read("lib", "remoteGpu.js")));

  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
