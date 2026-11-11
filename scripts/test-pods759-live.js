#!/usr/bin/env node
/* bitGen Studio — 2.759.0 LIVE: ⬇ Models onto a stand-in pod (H3_RUNPOD_PROXY) - through its Jupyter (a real kernel stand-in:
 * the Python bitGen sends runs here with python3 and downloads from a stand-in Hugging Face, H3_HF_BASE) and through
 * ComfyUI-Manager (its own list only).
 * Tim (verbatim): "if i select a pod, how do i choose what model comfyui template to use and to dl it?" */
"use strict";
const http = require("http"), fs = require("fs"), os = require("os"), path = require("path"), crypto = require("crypto"), Module = require("module");
const { spawn } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WS = fs.mkdtempSync(path.join(os.tmpdir(), "pods759l-")), COMFY = path.join(WS, "workspace", "ComfyUI"), JROOT = path.join(WS, "jroot");
fs.mkdirSync(COMFY, { recursive: true }); fs.mkdirSync(JROOT, { recursive: true });
let CFG = { rgpu: { runpod: { port: 3000 } }, hf: { token: "hf_TEST759" } };
const coreP = require.resolve("../lib/core");
const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, STYLES_DIR: path.join(WS, "styles"), BASE: ROOT };
require.cache[coreP] = fake;

const BLOB = crypto.randomBytes(300000);
const seen = [];
let manager = true, managerQueue = [], managerDone = 0;
// a minimal WebSocket server (RFC 6455 text frames) for the Jupyter kernel channel
function wsSend(sock, obj) {
  const p = Buffer.from(JSON.stringify(obj)), h = p.length < 126 ? Buffer.from([0x81, p.length]) : p.length < 65536 ? Buffer.from([0x81, 126, p.length >> 8, p.length & 255]) : null;
  sock.write(Buffer.concat([h, p]));
}
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
  let b = ""; q.on("data", (d) => { b += d; }); await new Promise((r) => q.on("end", r));
  const send = (c, j) => { s.writeHead(c, { "Content-Type": "application/json" }); s.end(JSON.stringify(j)); };
  seen.push(q.method + " " + q.url + " " + (q.headers.authorization || ""));
  if (q.url.startsWith("/hf/")) { s.writeHead(200, { "Content-Length": BLOB.length }); return s.end(BLOB); }
  const m = /^\/proxy\/(\w+)-(\d+)(\/.*)$/.exec(q.url); if (!m) return send(404, {});
  const [_, id, port, p] = m;
  if (id !== "pod759") return send(404, {});
  if (port === "3000") {
    if (p === "/system_stats") return send(200, { system: { argv: [path.join(COMFY, "main.py"), "--listen"] } });
    if (!manager) return send(404, {});
    if (p === "/manager/queue/status") return send(200, { total_count: managerQueue.length, done_count: managerDone, in_progress_count: 0, is_processing: managerDone < managerQueue.length });
    if (p.startsWith("/externalmodel/getlist")) return send(200, { models: [{ name: "Qwen VAE", filename: "qwen_image_vae.safetensors", save_path: "default", type: "vae", base: "Qwen-Image", url: "https://huggingface.co/x/y/resolve/main/qwen_image_vae.safetensors" }] });
    if (p === "/manager/queue/install_model" && q.method === "POST") { managerQueue.push(JSON.parse(b)); return send(200, {}); }
    if (p === "/manager/queue/start") return send(200, {});
    return send(404, {});
  }
  if (port === "8888") {
    if (q.headers.authorization !== "token jupw759") return send(403, {});
    if (p === "/api/status") return send(200, { started: "now" });
    if (p === "/api/kernels" && q.method === "POST") return send(201, { id: "k1" });
    if (/^\/api\/contents\/\./.test(p) && q.method === "PUT") return send(400, { message: "Cannot create file or directory (hidden)" });   // 2.763.4: as Jupyter does
      const up = /^\/api\/contents\/(bitgen-upload-[^?]+)$/.exec(p);
    if (up && q.method === "PUT") {   // Jupyter's chunked upload: chunk 1 starts the file, -1 is the last
      const j = JSON.parse(b), f = path.join(JROOT, decodeURIComponent(up[1])); seen.push("CHUNK " + j.chunk);
      if (j.chunk === 1 || j.chunk === undefined) fs.writeFileSync(f, Buffer.from(j.content, "base64")); else fs.appendFileSync(f, Buffer.from(j.content, "base64"));
      return send(j.chunk === -1 || j.chunk === undefined ? 200 : 201, { name: up[1] });
    }
    const c = /^\/api\/contents\/\.bitgen_dl\.json/.exec(p);
    if (c) { const f = path.join(JROOT, ".bitgen_dl.json"); return fs.existsSync(f) ? send(200, { content: fs.readFileSync(f, "utf8") }) : send(404, {}); }
  }
  send(404, {});
});
srv.on("upgrade", (q, sock) => {
  const m = /^\/proxy\/pod759-8888\/api\/kernels\/k1\/channels\?token=jupw759$/.exec(q.url);
  if (!m) { sock.destroy(); return; }
  const acc = crypto.createHash("sha1").update(q.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
  sock.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + acc + "\r\n\r\n");
  let buf = Buffer.alloc(0);
  sock.on("data", (d) => {
    buf = Buffer.concat([buf, d]);
    for (const t of wsFrames(buf)) {
      buf = Buffer.alloc(0);
      const msg = JSON.parse(t); seen.push("KERNEL " + msg.header.msg_type);
      // the kernel: run the Python here, in the Jupyter root, kept alive for its download thread
      const code = msg.content.code + "\nimport time\nfor _ in range(200):\n    if 'S' not in globals() or not S['running']: break\n    time.sleep(0.1)\n";
      const py = spawn("python3", ["-c", code], { cwd: JROOT });
      let out = "", sent = false;
      py.stdout.on("data", (x) => { out += x; if (!sent && /bitgen-(started|moved)/.test(out)) { sent = true;
        wsSend(sock, { msg_type: "stream", parent_header: { msg_id: msg.header.msg_id }, content: { name: "stdout", text: out } });
        wsSend(sock, { msg_type: "execute_reply", parent_header: { msg_id: msg.header.msg_id }, content: { status: "ok" } }); } });
      py.stderr.on("data", (x) => { seen.push("PYERR " + String(x).slice(0, 200)); });
    }
  });
  sock.on("error", () => {});
});
srv.listen(0, "127.0.0.1", async () => {
  const P = srv.address().port;
  process.env.H3_RUNPOD_PROXY = "http://127.0.0.1:" + P + "/proxy/{id}-{port}";
  process.env.H3_HF_BASE = "http://127.0.0.1:" + P + "/hf";
  const PM = require("../lib/podModels");
  const files = [{ name: "qwen_image_vae.safetensors", folder: "vae", url: PM.HF + "/Comfy-Org/x/resolve/main/vae/qwen_image_vae.safetensors", size: BLOB.length },
    { name: "z_image_turbo_bf16.safetensors", folder: "diffusion_models", url: PM.HF + "/Comfy-Org/z/resolve/main/z_image_turbo_bf16.safetensors", size: BLOB.length }];
  try {
    let w = await PM.ways("pod759", 3000);
    check("ways: the pod's ComfyUI folder (from its argv), ComfyUI-Manager there, no Jupyter password yet", w.comfy_dir === COMFY && w.manager && !w.jupyter && !w.jupyter_saved, w);
    let err = null; try { await PM.start("pod759", { files: [files[1]], port: 3000 }); } catch (e) { err = e; }
    check("ComfyUI-Manager: a file not in ITS list (Z-Image) - refused in words, pointing at the Jupyter password", err && err.status === 409 && /only fetch models in its own list - none of these are \(z_image_turbo_bf16\.safetensors\)/.test(err.message), err && err.message);
    const r1 = await PM.start("pod759", { files, port: 3000 });
    check("…one in its list (the Qwen VAE): queued with Manager's own entry, the queue started; the other named", r1.way === "manager" && r1.started === 1 && r1.not.join() === "z_image_turbo_bf16.safetensors"
      && managerQueue.length === 1 && managerQueue[0].filename === "qwen_image_vae.safetensors" && seen.some((x) => /manager\/queue\/start/.test(x)), r1);
    managerDone = 1;
    let st = await PM.state("pod759", 3000);
    check("…its state: done once Manager's queue says so", st.way === "manager" && !st.running && st.files[0].state === "done", st);
    // the Jupyter way
    manager = false;
    const r2 = await PM.start("pod759", { files, port: 3000, jupyter_password: "jupw759" });
    check("Jupyter: the password pasted is kept (encrypted per pod) and used; the downloads start in a kernel", r2.way === "jupyter" && r2.started === 2 && r2.kept === false && CFG.rgpu.pod_jupyter.pod759 === "jupw759" && seen.includes("KERNEL execute_request"), r2);
    for (let i = 0; i < 60; i++) { st = await PM.state("pod759", 3000); if (st.files.length && !st.running) break; await sleep(250); }
    const got = ["vae/qwen_image_vae.safetensors", "diffusion_models/z_image_turbo_bf16.safetensors"].map((f) => { const p = path.join(COMFY, "models", f); return fs.existsSync(p) && fs.readFileSync(p).equals(BLOB); });
    check("…every file lands in <ComfyUI>/models/<folder>, whole (no .part left), its progress done; the Hugging Face token went as a header",
      got.every(Boolean) && st.files.every((f) => f.state === "done" && f.done === BLOB.length) && !fs.readdirSync(path.join(COMFY, "models", "vae")).some((f) => /\.part$/.test(f))
      && seen.some((x) => /^GET \/hf\/.* Bearer hf_TEST759$/.test(x)), { got, st, seen: seen.filter((x) => /hf|PYERR/.test(x)) });
    const r3 = await PM.start("pod759", { files: [files[0]], port: 3000 });
    for (let i = 0; i < 40; i++) { st = await PM.state("pod759", 3000); if (st.files.length && !st.running) break; await sleep(250); }
    check("…again: a file already there is skipped ('there already')", r3.way === "jupyter" && st.files[0].state === "there already", st);
    // from a link (Tim: "add mounting the model in the pod from the hdd or link?")
    const r4 = await PM.fromLink("pod759", { url: "http://127.0.0.1:" + P + "/hf/civitai-like/my_lora.safetensors?type=Model", folder: "loras", port: 3000 });
    for (let i = 0; i < 40; i++) { st = await PM.state("pod759", 3000); if (st.files.length && !st.running) break; await sleep(250); }
    const lora = path.join(COMFY, "models", "loras", "my_lora.safetensors");
    check("from a link: any web address, saved under the link's file name in models/<the folder picked>", r4.name === "my_lora.safetensors" && fs.existsSync(lora) && fs.readFileSync(lora).equals(BLOB), { r4, st });
    let e2 = null; try { await PM.fromLink("pod759", { url: "ftp://x", folder: "loras", port: 3000 }); } catch (e) { e2 = e; }
    let e3 = null; try { await PM.fromLink("pod759", { url: "https://x.y/z", folder: "../etc", port: 3000 }); } catch (e) { e3 = e; }
    check("…not a web address, or a folder that is not a ComfyUI model folder: refused", e2 && e2.status === 400 && e3 && e3.status === 400 && /folder/.test(e3.message));
    // from this computer's disk, in parts
    process.env.H3_POD_CHUNK = "100000";
    const SRC = path.join(WS, "my_trained_lora.safetensors"); fs.writeFileSync(SRC, BLOB);
    const r5 = await PM.upload("pod759", { path: SRC, folder: "loras", port: 3000 });
    for (let i = 0; i < 60; i++) { st = await PM.state("pod759", 3000); const u = st.files.find((f) => /from this computer/.test(f.name)); if (u && u.state !== "uploading") break; await sleep(250); }
    const upf = path.join(COMFY, "models", "loras", "my_trained_lora.safetensors"), u = st.files.find((f) => /from this computer/.test(f.name));
    check("from this computer: the file sent to the pod's Jupyter in parts (3 here: 1, 2, -1), then moved into models/loras whole; its bar done",
      r5.way === "upload" && fs.existsSync(upf) && fs.readFileSync(upf).equals(BLOB) && seen.filter((x) => /^CHUNK/.test(x)).join() === "CHUNK 1,CHUNK 2,CHUNK -1" && u && u.state === "done" && u.done === BLOB.length, { r5, u, chunks: seen.filter((x) => /^CHUNK/.test(x)) });
    err = null; try { await PM.start("pod759", { files: [{ name: "x.safetensors", folder: "vae", url: "https://evil.example/x" }], port: 3000 }); } catch (e) { err = e; }
    check("only bitGen's download host (Hugging Face) is fetched - another address is not passed to the pod", err && err.status === 400, err && err.message);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  srv.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
});
