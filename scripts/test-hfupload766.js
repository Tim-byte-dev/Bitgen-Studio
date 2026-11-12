#!/usr/bin/env node
/* bitGen Studio — 2.766.0 LIVE: a model into YOUR private Hugging Face repo (lib/hfUpload.js) against a stand-in Hugging Face
 * (H3_HF_BASE): whoami, the private repo made, the Git LFS batch (one PUT, or parts + completion), verify, the commit; a file
 * Hugging Face has already is not sent again; a read-only token is refused in words. And the routes in remote mode
 * (routes/remoteModels.js): /api/comfymodels + /api/modelmgr/cards answer with runpod/pods/remote_models.json, ?local=1 does
 * not; the ticked pods; the transfers.
 * Tim (verbatim): "go with your suggestions and add a progress bar for each transfer to the pod" */
"use strict";
const http = require("http"), fs = require("fs"), os = require("os"), path = require("path"), crypto = require("crypto"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const T = fs.mkdtempSync(path.join(os.tmpdir(), "hfupload766-"));
process.env.H3_REMOTE_MODELS = path.join(T, "remote_models.json");
let CFG = { rgpu: { enabled: true, engine: { provider: "runpod", runpod: "pods" }, split: { where: "remote" } }, hf: { token: "hf_W" } };
const coreP = require.resolve("../lib/core");
const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, BASE: ROOT, STYLES_DIR: path.join(T, "styles") };
require.cache[coreP] = fake;
fs.mkdirSync(path.join(T, "styles"), { recursive: true });

const store = {}, seen = []; let mode = "basic", role = "write", made = 0;
const srv = http.createServer(async (q, s) => {
  const chunks = []; for await (const c of q) chunks.push(c); const b = Buffer.concat(chunks);
  seen.push(q.method + " " + q.url.replace(/\?.*$/, ""));
  const P = "http://127.0.0.1:" + srv.address().port, send = (c, j, h) => { s.writeHead(c, Object.assign({ "Content-Type": "application/json" }, h || {})); s.end(JSON.stringify(j)); };
  if (q.url.startsWith("/hf/")) {
    const u = q.url.slice(3);
    if (u === "/api/whoami-v2") return q.headers.authorization === "Bearer hf_W" ? send(200, { name: "tim", auth: { accessToken: { role } } }) : send(401, { error: "bad" });
    if (u === "/api/repos/create") { const j = JSON.parse(b); made++; return j.private === true && j.name === "bitgen-models" && j.type === "model" ? (made > 1 ? send(409, { error: "exists" }) : send(200, { url: "x" })) : send(400, {}); }
    if (u === "/tim/bitgen-models.git/info/lfs/objects/batch") {
      const j = JSON.parse(b), o = j.objects[0];
      if (store[o.oid]) return send(200, { objects: [{ oid: o.oid, size: o.size }] });
      if (mode === "basic") return send(200, { objects: [{ oid: o.oid, size: o.size, actions: { upload: { href: P + "/s3/put/" + o.oid, header: { "X-Amz": "sig" } }, verify: { href: P + "/hf/verify", header: { Authorization: "Bearer v" } } } }] });
      return send(200, { objects: [{ oid: o.oid, size: o.size, actions: { upload: { href: P + "/hf/complete/" + o.oid, header: { chunk_size: "4000", "00001": P + "/s3/part/1", "00002": P + "/s3/part/2", "00003": P + "/s3/part/3" } } } }] });
    }
    if (u === "/verify") return send(200, {});
    if (u.startsWith("/complete/")) { const j = JSON.parse(b), oid = u.split("/").pop(); store[oid] = Buffer.concat(j.parts.sort((x, y) => x.partNumber - y.partNumber).map((p) => PARTS[p.etag])); return send(200, {}); }
    if (u === "/api/models/tim/bitgen-models/commit/main") { const lines = String(b).trim().split("\n").map((l) => JSON.parse(l)); COMMITS.push(lines); return send(200, { commitOid: "c1" }); }
    return send(404, {});
  }
  if (q.url.startsWith("/s3/put/")) { if (!q.headers["content-length"] || q.headers["transfer-encoding"]) return send(411, {}); store[q.url.split("/").pop()] = b; s.writeHead(200); return s.end(); }
  if (q.url.startsWith("/s3/part/")) { const tag = '"' + crypto.createHash("md5").update(b).digest("hex") + '"'; PARTS[tag] = b; s.writeHead(200, { ETag: tag }); return s.end(); }
  send(404, {});
});
const PARTS = {}, COMMITS = [];
srv.listen(0, "127.0.0.1", async () => {
  const P = srv.address().port;
  process.env.H3_HF_BASE = "http://127.0.0.1:" + P + "/hf";
  const HU = require("../lib/hfUpload");
  try {
    const f1 = path.join(T, "a.safetensors"), d1 = crypto.randomBytes(9000); fs.writeFileSync(f1, d1);
    const sha1 = crypto.createHash("sha256").update(d1).digest("hex"), prog = [];
    const r1 = await HU.upload(f1, { token: "hf_W", folder: "checkpoints/Merges", name: "a.safetensors", onProgress: (n) => prog.push(n) });
    check("one PUT: the whole file with its length (no chunked body), to the address the LFS batch gave, with its header; verified",
      store[sha1] && store[sha1].equals(d1) && seen.includes("PUT /s3/put/" + sha1) && seen.includes("POST /hf/verify") && prog[prog.length - 1] === 9000, { seen, prog });
    check("…the private repo made (<you>/bitgen-models, private), then the commit adds checkpoints/Merges/a.safetensors (sha256 oid + size)",
      made === 1 && COMMITS[0][1].key === "lfsFile" && COMMITS[0][1].value.path === "checkpoints/Merges/a.safetensors" && COMMITS[0][1].value.oid === sha1 && COMMITS[0][1].value.size === 9000, COMMITS);
    check("…its link: <hf>/tim/bitgen-models/resolve/main/<path>; sent = its bytes", r1.url === process.env.H3_HF_BASE + "/tim/bitgen-models/resolve/main/checkpoints/Merges/a.safetensors" && r1.sent === 9000 && r1.sha256 === sha1 && r1.repo === "tim/bitgen-models", r1);
    mode = "multi"; seen.length = 0;
    const f2 = path.join(T, "b.safetensors"), d2 = crypto.randomBytes(10500); fs.writeFileSync(f2, d2);
    const sha2 = crypto.createHash("sha256").update(d2).digest("hex"), prog2 = [];
    await HU.upload(f2, { token: "hf_W", folder: "loras", name: "b.safetensors", onProgress: (n) => prog2.push(n) });
    check("parts: each part the size asked (4000 · 4000 · 2500), then the completion with every ETag in order - the file whole; progress per part; the repo already there (409) is fine",
      store[sha2] && store[sha2].equals(d2) && seen.filter((x) => /^PUT \/s3\/part\//.test(x)).length === 3 && prog2.join() === "4000,8000,10500" && made === 2, { seen, prog2 });
    seen.length = 0;
    const r3 = await HU.upload(f1, { token: "hf_W", folder: "checkpoints", name: "again.safetensors", sha256: sha1 });
    check("a file Hugging Face has already (by its SHA-256): nothing sent, only the commit under the new name", r3.sent === 0 && !seen.some((x) => /s3/.test(x)) && COMMITS[COMMITS.length - 1][1].value.path === "checkpoints/again.safetensors", seen);
    role = "read"; let e = null; try { await HU.upload(f1, { token: "hf_W", folder: "loras" }); } catch (x) { e = x; }
    check("a read-only token: refused in words (make one with write access, Settings ▸ Models)", e && e.code === "read_token" && /can only read - make one with write access/.test(e.message));
    role = "write"; e = null; try { await HU.upload(f1, { token: "", folder: "loras" }); } catch (x) { e = x; }
    let e2 = null; try { await HU.upload(f1, { token: "hf_BAD", folder: "loras" }); } catch (x) { e2 = x; }
    check("…no token / a token Hugging Face refuses: said", e && e.code === "no_token" && e2 && e2.code === "bad_token");

    /* ---- the routes in remote mode */
    const express = require("express"), app = express(); app.use(express.json());
    require("../routes/remoteModels").mount(app);
    app.get("/api/comfymodels", (req, res) => res.json({ local: true }));
    app.get("/api/modelmgr/cards", (req, res) => res.json({ local: true }));
    const RM = require("../lib/remoteModels");
    RM.save([]); RM.add({ label: "Krea raw", group: "Krea", folder: "diffusion_models", name: "krea2_raw_fp8_scaled.safetensors", url: "https://huggingface.co/Comfy-Org/Krea-2/resolve/main/x.safetensors" });
    const s2 = app.listen(0, "127.0.0.1");
    await new Promise((r) => s2.once("listening", r));
    const B = "http://127.0.0.1:" + s2.address().port, gj = async (u, o) => (await fetch(B + u, o)).json();
    const cm = await gj("/api/comfymodels"), cml = await gj("/api/comfymodels?local=1");
    check("remote mode: /api/comfymodels = the remote list (Basic Settings' Override combos + LoRA rows); ?local=1 = this computer's", cm.remote && cm.categories.diffusion_models.files[0].name === "krea2_raw_fp8_scaled.safetensors" && cml.local === true, cm);
    const cards = await gj("/api/modelmgr/cards"), cl = await gj("/api/modelmgr/cards?local=1");
    check("…/api/modelmgr/cards = remote cards (remote_list, rm: keys, families for the filters); ?local=1 = this computer's", cards.remote_list && cards.models[0].key.startsWith("rm:") && cards.models[0].title === "Krea raw" && cards.families.length > 3 && cl.local === true, cards.models && cards.models[0]);
    CFG.rgpu.enabled = false;
    const lc = await gj("/api/comfymodels");
    check("…local mode: this computer's lists as before", lc.local === true);
    CFG.rgpu.enabled = true;
    const sel = await gj("/api/pods/selected", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pods: [{ id: "podA", name: "A" }] }) });
    check("POST /api/pods/selected keeps the ticked pods; GET reads them", sel.selected[0].id === "podA" && (await gj("/api/pods/selected")).selected.length === 1 && CFG.rgpu.pod_selected[0].name === "A");
    const PT = require("../lib/podTransfers"); const x = PT.begin({ pod: "podA", name: "a", how: "download", size: 10 }); PT.step(x, 5);
    const tr = await gj("/api/pods/transfers");
    check("GET /api/pods/transfers: each transfer with its %", tr.transfers.some((t) => t.id === x && t.pct === 50));
    const lk = await gj("/api/remotemodels/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: "https://x.io/l.safetensors", folder: "loras", label: "L" }) });
    const all = await gj("/api/remotemodels");
    check("POST /api/remotemodels/link + GET /api/remotemodels (pods_mode, the list, the ticked pods)", lk.entry.name === "l.safetensors" && all.pods_mode === true && all.models.length === 2 && all.selected.length === 1, all);
    const del = await gj("/api/remotemodels/" + lk.entry.id, { method: "DELETE" });
    check("DELETE /api/remotemodels/:id", del.ok === true && RM.load().length === 1);
    s2.close();
  } catch (e) { check("no error", false, String(e && e.stack)); }
  srv.close(); fs.rmSync(T, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
});
