#!/usr/bin/env node
/* bitGen Studio — 2.763.1 units + LIVE: THIS COMPUTER'S CUSTOM NODES ON A POD (lib/podNodes.js) + a render that waits for its pod
 * says so on screen and fails loudly (lib/stylePods.js, lib/core.js). Stand-ins: RunPod's REST API, a pod's ComfyUI +
 * ComfyUI-Manager reboot + Jupyter (a kernel that runs bitGen's Python HERE), this computer's ComfyUI (/object_info).
 * Tim (verbatim): "i tried generating from a style, i did not get any popups, it says starting in queue but i don't know what
 * it;s doing" + "we may have to upload all of the nodes in comfy custom nodes to the pod and restart the pod when created" */
"use strict";
const http = require("http"), fs = require("fs"), os = require("os"), path = require("path"), crypto = require("crypto"), Module = require("module");
const { spawn, spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
process.env.H3_POD_GIT_FILE = "1";
const PN = require("../lib/podNodes");

/* ---------------- pure */
const FS = { "/n/A/.git/config": '[core]\n\tbare = false\n[remote "origin"]\n\turl = https://github.com/kijai/ComfyUI-KJNodes.git\n\tfetch = +refs/heads/*\n', "/n/A/.git/HEAD": "ref: refs/heads/main\n",
  "/n/A/.git/refs/heads/main": "a".repeat(40) + "\n", "/n/B/.git/config": '[remote "origin"]\n\turl = git@github.com:me/pack.git\n', "/n/B/.git/HEAD": "ref: refs/heads/dev\n",
  "/n/B/.git/packed-refs": "# pack\n" + "b".repeat(40) + " refs/heads/dev\n", "/n/C/.git": "gitdir: ../.wt/C\n", "/n/.wt/C/config": '[remote "origin"]\n\turl = https://u:tok@example.com/x.git\n', "/n/.wt/C/HEAD": "c".repeat(40) };
const R = (p) => (p in FS ? FS[p] : null);
const a = PN.gitOf("/n/A", R), b = PN.gitOf("/n/B", R), c = PN.gitOf("/n/C", R);
check("gitOf: origin + the commit HEAD names (a branch file, packed-refs, a detached HEAD, a .git file pointing elsewhere); no .git = null",
  a.url === "https://github.com/kijai/ComfyUI-KJNodes.git" && a.commit === "a".repeat(40) && b.commit === "b".repeat(40) && c.commit === "c".repeat(40) && PN.gitOf("/n/Z", R) === null, { a, b, c });
check("httpsOf: ssh -> https, user:token@ never sent, other schemes = none (upload instead)",
  PN.httpsOf(b.url) === "https://github.com/me/pack.git" && PN.httpsOf(c.url) === "https://example.com/x.git" && PN.httpsOf("ssh://git@gitlab.com/g/p.git") === "https://gitlab.com/g/p.git" && PN.httpsOf("/local/repo") === "");
check("keepFile: no .git / __pycache__ / node_modules / .venv, nothing over 50 MB", PN.keepFile("nodes/x.py", 10) && !PN.keepFile(".git/HEAD", 1) && !PN.keepFile("a/__pycache__/x.pyc", 1) && !PN.keepFile("big.safetensors", 60e6) && !PN.keepFile(".venv/x", 1));
check("folderOfModule: custom_nodes.<folder>.… -> the folder; a core node -> none", PN.folderOfModule("custom_nodes.ComfyUI-KJNodes.nodes") === "ComfyUI-KJNodes" && PN.folderOfModule("custom_nodes.websocket_image_save") === "websocket_image_save" && PN.folderOfModule("nodes") === "" && PN.folderOfModule("comfy_extras.nodes_mask") === "");
{ const code = PN.mirrorCode([{ folder: "A", git: "https://x/a.git", commit: "a".repeat(40) }, { folder: "B", zip: ".bitgen_nodes_B.zip" }], "/workspace/ComfyUI");
  const f = path.join(os.tmpdir(), "mc7631.py"); fs.writeFileSync(f, code);
  const r = spawnSync("python3", ["-c", "import ast,sys; ast.parse(open(sys.argv[1]).read()); print('ok')", f], { encoding: "utf8" });
  check("mirrorCode: valid Python - a pod folder there already is left alone, git clone + checkout the commit (else the newest, said), a zip unpacked into custom_nodes, requirements with the Python running main.py",
    /ok/.test(r.stdout) && /if os\.path\.exists\(dst\):/.test(code) && /'checkout', '-q', k\['commit'\]/.test(code) && /your commit was not found/.test(code) && /extractall\(cn\)/.test(code) && /'pip', 'install', '-q', '-r', req/.test(code), r.stderr); }
const CORE = rd("lib", "core.js"), SPs = rd("lib", "stylePods.js"), PPs = rd("lib", "podPrep.js"), ASK = rd("static", "stylepodask.js"), PSU = rd("static", "podsetup.js"), RT = rd("routes", "stylePods.js");
check("wiring: a pod that cannot be had FAILS the job with the reason (cancelled when you cancelled) - never rendered elsewhere; jobs carry pod_note while queued; the page shows it over the status bar",
  /j\.status = g\.cancelled \? "cancelled" : "failed";/.test(CORE) && /pod_note: job\.status === "queued" \? job\._podNote \|\| null : null/.test(CORE) && !/pod_job = \{ error/.test(CORE) && /id = "spaChip"/.test(ASK) && /"🖥 " \+ j\.pod_note/.test(ASK));
check("wiring: a pod bitGen creates (asked or made again) gets this computer's custom nodes once (rgpu.pod_nodes); a style's missing classes come from this computer's own folders first (podPrep localFolders); My pods ▸ ⬆ My custom nodes (POST /api/stylepods/nodes/:pod)",
  /nodesTodo\(made\.pod\.id, true\)/.test(SPs) && /movePod\(pod, id\); nodesTodo\(id, true\)/.test(SPs) && /require\("\.\/podNodes"\)\.mirror\(id, port/.test(SPs)
  && /localFolders: \(classes\) => require\("\.\/podNodes"\)\.foldersFor\(classes\)/.test(PPs) && /data-psnodes/.test(PSU) && /\/api\/stylepods\/nodes\//.test(PSU) && /app\.post\("\/api\/stylepods\/nodes\/:pod"/.test(RT));

/* ---------------- live: this computer's ComfyUI with four packs + a switched-off one */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "podnodes7631-"));
const LOCAL = path.join(TMP, "local", "ComfyUI"), CN = path.join(LOCAL, "custom_nodes");
fs.mkdirSync(CN, { recursive: true }); fs.writeFileSync(path.join(LOCAL, "main.py"), "");
const git = (cwd, ...a) => spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd, encoding: "utf8" });
// a git pack whose origin the pod can reach (a repo of its own here) at an OLDER commit than its newest
const ORIGIN = path.join(TMP, "origin-kj");
fs.mkdirSync(ORIGIN); fs.writeFileSync(path.join(ORIGIN, "__init__.py"), "V = 1\n"); fs.writeFileSync(path.join(ORIGIN, "requirements.txt"), "");
git(ORIGIN, "init", "-q"); git(ORIGIN, "add", "-A"); git(ORIGIN, "commit", "-qm", "one");
const C1 = git(ORIGIN, "rev-parse", "HEAD").stdout.trim();
git(TMP, "clone", "-q", ORIGIN, path.join(CN, "ComfyUI-KJNodes"));
git(path.join(CN, "ComfyUI-KJNodes"), "remote", "set-url", "origin", "file://" + ORIGIN);
fs.writeFileSync(path.join(ORIGIN, "__init__.py"), "V = 2\n"); git(ORIGIN, "commit", "-qam", "two");
// a git pack whose origin the pod cannot reach (a private one) -> uploaded instead
fs.mkdirSync(path.join(CN, "MyPrivatePack")); fs.writeFileSync(path.join(CN, "MyPrivatePack", "__init__.py"), "P = 1\n");
git(path.join(CN, "MyPrivatePack"), "init", "-q"); git(path.join(CN, "MyPrivatePack"), "add", "-A"); git(path.join(CN, "MyPrivatePack"), "commit", "-qm", "x");
git(path.join(CN, "MyPrivatePack"), "remote", "add", "origin", "file://" + path.join(TMP, "nowhere.git"));
// a plain folder (a zip someone unpacked) with a big file left out + a __pycache__
fs.mkdirSync(path.join(CN, "ZipPack", "__pycache__"), { recursive: true }); fs.writeFileSync(path.join(CN, "ZipPack", "__init__.py"), "Z = 1\n");
fs.writeFileSync(path.join(CN, "ZipPack", "__pycache__", "x.pyc"), "junk"); fs.writeFileSync(path.join(CN, "ZipPack", "big.bin"), Buffer.alloc(PN.MAX_FILE + 10));
fs.writeFileSync(path.join(CN, "websocket_image_save.py"), "S = 1\n");
fs.mkdirSync(path.join(CN, "OldPack.disabled")); fs.writeFileSync(path.join(CN, "OldPack.disabled", "__init__.py"), "");
fs.mkdirSync(path.join(CN, "ComfyUI-Manager")); fs.writeFileSync(path.join(CN, "ComfyUI-Manager", "__init__.py"), "");
const POD = path.join(TMP, "pod", "ComfyUI");
fs.mkdirSync(path.join(POD, "custom_nodes", "ComfyUI-Manager"), { recursive: true }); fs.mkdirSync(path.join(POD, "models"), { recursive: true });
let CFG = { rgpu: { runpod: { key: "rpa_T7631" }, enabled: true, engine: { provider: "runpod", runpod: "pods" }, split: { where: "remote" }, pod_jupyter: { pod7631: "jup7631" } }, engine: { comfy: { dir: LOCAL } } };
const coreP = require.resolve("../lib/core");
const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => CFG, setConfig: (x) => { CFG = x; }, STYLES_DIR: path.join(TMP, "styles"), BASE: ROOT, resolvePath: (p) => path.resolve(p) };
require.cache[coreP] = fake;
const PODS = [{ id: "pod7631", name: "Pod 7631", desiredStatus: "RUNNING", costPerHr: 0.44, gpu: { id: "NVIDIA GeForce RTX 4090", count: 1 } }];
const seen = [];
function wsSend(sock, obj) { const p = Buffer.from(JSON.stringify(obj)), h = p.length < 126 ? Buffer.from([0x81, p.length]) : Buffer.from([0x81, 126, p.length >> 8, p.length & 255]); sock.write(Buffer.concat([h, p])); }
function wsFrames(buf) {
  const out = []; let i = 0;
  while (i + 2 <= buf.length) {
    let len = buf[i + 1] & 127, off = i + 2;
    if (len === 126) { len = buf.readUInt16BE(off); off += 2; } else if (len === 127) { len = Number(buf.readBigUInt64BE(off)); off += 8; }
    const mask = buf.slice(off, off + 4); off += 4;
    if (off + len > buf.length) break;
    const d = Buffer.alloc(len); for (let k = 0; k < len; k++) d[k] = buf[off + k] ^ mask[k % 4];
    if ((buf[i] & 15) === 1) out.push(d.toString()); i = off + len;
  }
  return out;
}
const srv = http.createServer(async (q, s) => {
  let b = []; q.on("data", (d) => { b.push(d); }); await new Promise((r) => q.on("end", r)); b = Buffer.concat(b).toString();
  const send = (c, j) => { s.writeHead(c, { "Content-Type": "application/json" }); s.end(JSON.stringify(j)); };
  seen.push(q.method + " " + q.url);
  if (q.url === "/local/object_info") return send(200, { KSampler: { python_module: "nodes" }, PathchSageAttentionKJ: { python_module: "custom_nodes.ComfyUI-KJNodes" }, ZipThing: { python_module: "custom_nodes.ZipPack.nodes" } });
  const m = /^\/proxy\/(\w+)-(\d+)(\/.*)$/.exec(q.url);
  if (m) {
    const [, id, port, p] = m, pod = PODS.find((x) => x.id === id), dir = POD;
    if (!pod || pod.desiredStatus !== "RUNNING" || (pod.ready || 0) > Date.now()) return send(502, {});
    if (port === "8188") {
      if (p === "/system_stats") return send(200, { system: { argv: [path.join(dir, "main.py")] } });
      if (p === "/manager/queue/status") return send(200, { is_processing: false });
      if (p === "/manager/reboot") { seen.push("REBOOT"); pod.ready = Date.now() + 300; return send(200, {}); }
      return send(404, {});
    }
    if (port === "8888") {
      if (q.headers.authorization !== "token " + CFG.rgpu.pod_jupyter[id]) return send(403, {});
      if (p === "/api/status") return send(200, {});
      if (p === "/api/kernels" && q.method === "POST") return send(201, { id: "k" + id });
      const up = /^\/api\/contents\/(\.bitgen_[^?]+)$/.exec(p);
      if (up && q.method === "PUT") { const j = JSON.parse(b), f = path.join(dir, "..", decodeURIComponent(up[1])); if (j.chunk === 1 || j.chunk === undefined) fs.writeFileSync(f, Buffer.from(j.content, "base64")); else fs.appendFileSync(f, Buffer.from(j.content, "base64")); seen.push("UPLOAD " + decodeURIComponent(up[1])); return send(201, {}); }
      const st = /^\/api\/contents\/(\.bitgen_[\w]+\.json)/.exec(p);
      if (st) { const f = path.join(dir, "..", st[1]); return fs.existsSync(f) ? send(200, { content: fs.readFileSync(f, "utf8") }) : send(404, {}); }
    }
    return send(404, {});
  }
  if (q.headers.authorization !== "Bearer rpa_T7631") return send(401, {});
  if (q.method === "GET" && /^\/v2\/pods\?limit=1000/.test(q.url)) return send(200, { pods: PODS });
  send(404, {});
});
srv.on("upgrade", (q, sock) => {
  const m = /^\/proxy\/(\w+)-8888\/api\/kernels\/k\w+\/channels\?token=(.+)$/.exec(q.url);
  if (!m || decodeURIComponent(m[2]) !== CFG.rgpu.pod_jupyter[m[1]]) { sock.destroy(); return; }
  const dir = path.join(POD, "..");
  const acc = crypto.createHash("sha1").update(q.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
  sock.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + acc + "\r\n\r\n");
  let buf = Buffer.alloc(0);
  sock.on("data", (d) => {
    buf = Buffer.concat([buf, d]);
    for (const t of wsFrames(buf)) {
      buf = Buffer.alloc(0);
      const msg = JSON.parse(t); seen.push("KERNEL " + m[1]);
      // a kernel lives on: its background threads (downloads, node installs) finish before this stand-in's Python ends
      const py = spawn("python3", ["-u", "-c", msg.content.code + "\nimport threading\nfor _t in threading.enumerate():\n    if _t is not threading.main_thread(): _t.join()\n"], { cwd: dir });
      let out = "", sent = false;
      py.stdout.on("data", (x) => { out += x; if (!sent && /bitgen-(started|moved|made|folders|comfy|nodes-started|mirror-started|cn )/.test(out)) { sent = true;
        wsSend(sock, { msg_type: "stream", parent_header: { msg_id: msg.header.msg_id }, content: { name: "stdout", text: out } });
        wsSend(sock, { msg_type: "execute_reply", parent_header: { msg_id: msg.header.msg_id }, content: { status: "ok" } }); } });
      py.stderr.on("data", (x) => { seen.push("PYERR " + String(x).slice(0, 300)); });
    }
  });
  sock.on("error", () => {});
});

srv.listen(0, "127.0.0.1", async () => {
  const P = srv.address().port;
  process.env.H3_RUNPOD_PROXY = "http://127.0.0.1:" + P + "/proxy/{id}-{port}";
  process.env.H3_RUNPOD_REST_API = "http://127.0.0.1:" + P + "/v2";
  process.env.H3_POD_REVIVE_POLL = "150"; process.env.H3_POD_CHUNK = "100000";
  CFG.engine.comfy.url = "http://127.0.0.1:" + P + "/local";
  try {
    const L = PN.list();
    check("list: this computer's packs - git ones with their (https) origin + commit, a plain folder and a single .py to upload, .disabled left out",
      L.map((k) => k.folder).join() === "ComfyUI-KJNodes,ComfyUI-Manager,MyPrivatePack,ZipPack,websocket_image_save.py" && L[0].git === "file://" + ORIGIN && L[0].commit === C1 && L[3].git === "" && L[4].file, L);
    const fl = await PN.foldersFor(["PathchSageAttentionKJ", "ZipThing", "KSampler", "Nope"]);
    check("foldersFor: this computer's ComfyUI says which folder a class comes from; core / unknown ones are left for bitGen's pack list", fl.folders.join() === "ComfyUI-KJNodes,ZipPack" && fl.rest.join() === "KSampler,Nope", fl);
    const r = await PN.mirror("pod7631", 8188, {});
    const on = (...p) => path.join(POD, "custom_nodes", ...p);
    check("mirror (all): the git pack CLONED on the pod at your commit (not the newest)", fs.existsSync(on("ComfyUI-KJNodes", "__init__.py")) && /V = 1/.test(fs.readFileSync(on("ComfyUI-KJNodes", "__init__.py"), "utf8")), { r, seen: seen.filter((x) => /PYERR/.test(x)) });
    check("…the pack the pod could not clone (private) uploaded from here instead; the plain folder uploaded without __pycache__ / the big file; the single .py too",
      fs.existsSync(on("MyPrivatePack", "__init__.py")) && fs.existsSync(on("ZipPack", "__init__.py")) && !fs.existsSync(on("ZipPack", "__pycache__")) && !fs.existsSync(on("ZipPack", "big.bin")) && fs.existsSync(on("websocket_image_save.py"))
      && seen.some((x) => /UPLOAD \.bitgen_nodes_MyPrivatePack\.zip/.test(x)) && !seen.some((x) => /UPLOAD \.bitgen_nodes_ComfyUI-KJNodes/.test(x)), { r, up: seen.filter((x) => /UPLOAD/.test(x)) });
    check("…ComfyUI-Manager the pod has already: left alone; the .disabled one never sent; ComfyUI restarted through ComfyUI-Manager and waited for",
      r.there.join() === "ComfyUI-Manager" && !fs.existsSync(on("OldPack.disabled")) && r.done.length === 4 && !r.failed.length && r.restarted && seen.includes("REBOOT"), r);
    check("…its state for My pods: done, what it did", PN.status("pod7631").running === false && /4 put on the pod, 1 there already/.test(PN.status("pod7631").note), PN.status("pod7631"));
    seen.length = 0;
    const r2 = await PN.mirror("pod7631", 8188, { only: ["ComfyUI-KJNodes"] });
    check("again (only one folder): there already - nothing cloned or uploaded, no restart", r2.there.join() === "ComfyUI-KJNodes" && !r2.done.length && !r2.restarted && !seen.some((x) => /UPLOAD|REBOOT/.test(x)), r2);
    // the gate: Both + Image not ticked + no pod for the style = this computer, said; a pod of its kind = the pod
    const SP = require("../lib/stylePods");
    CFG.rgpu.split = { where: "both" };
    const st = { id: "s7631", name: "Krea test", kind: "image", engine: "comfy" };
    const g1 = SP.gate({ mode: "image", style: st });
    check("Both, Image not ticked, no pod for the style: rendered on this computer - and the log says why and how to change it", g1 && g1.local && /Basic Settings ▸ GPU is Both and Image is not ticked/.test(g1.note), g1);
    CFG.rgpu.pod_cfg = { pod7631: { kinds: ["image"] } };
    const g2 = SP.gate({ mode: "image", style: st });
    check("Both with a pod ticked for Image: the style goes to that pod (no Image box needed)", g2 && (g2.wait || g2.pod_id) && !g2.local, g2);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  srv.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
});
