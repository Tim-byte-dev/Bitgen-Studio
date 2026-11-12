/* bitGen Studio — lib/hfUpload.js (2.766.0): A MODEL OF THIS COMPUTER INTO YOUR OWN PRIVATE HUGGING FACE REPO, once - then
 * every pod downloads it from there in a minute or two (a link in runpod/pods/remote_models.json) instead of this computer
 * sending it to each pod.
 *
 * Tim (verbatim): "go with your suggestions" - the suggestion: "upload a no-link model ONCE to a private repo on your own
 * Hugging Face account ... any pod - including one you make next month - downloads it in a minute or two"
 *
 *   The token: Settings ▸ Models' Hugging Face token (config.hf.token) - it must be allowed to WRITE (a "read" token is
 *   refused with what to do). The repo: <your user>/bitgen-models, made PRIVATE when it is not there yet. The file goes to
 *   <folder>/<name> in it (checkpoints/SDXL/x.safetensors) through Hugging Face's Git LFS upload: the batch asks for the
 *   file by its SHA-256 (a file Hugging Face already has is not sent again), then one PUT or the parts it asks for (each
 *   tried 3 times), its completion, then a commit adding the file. Progress -> onProgress(bytes sent).
 *   -> {url: https://huggingface.co/<user>/bitgen-models/resolve/main/<path>, repo, path, sent: bytes (0 = it was there)}
 *   H3_HF_BASE = the tests' stand-in Hugging Face.
 * Pure (scripts/test-remotemodels766.js): repoPath, partsOf, ndjson.
 */
"use strict";
const fs = require("fs");
const REPO = "bitgen-models";
const HF = () => (process.env.H3_HF_BASE || "https://huggingface.co").replace(/\/+$/, "");
const LFS = "application/vnd.git-lfs+json";

/** where a file goes in the repo (pure): "checkpoints/SDXL" + "x.safetensors" -> "checkpoints/SDXL/x.safetensors" */
function repoPath(folder, name) {
  const parts = String(folder || "").replace(/\\/g, "/").split("/").filter((p) => p && /^[\w.+ -]{1,64}$/.test(p) && !/^\.+$/.test(p));
  const n = String(name || "").replace(/[^\w.+ -]+/g, "_");
  return parts.concat([n]).join("/");
}
/** the part addresses of a multipart upload, in order (pure): header {chunk_size, "00001": url, …} -> [{n, url}] */
function partsOf(header) { return Object.keys(header || {}).filter((k) => /^\d+$/.test(k)).sort((a, b) => +a - +b).map((k) => ({ n: +k, url: header[k] })); }
/** Hugging Face's commit body (pure) */
function ndjson(path, oid, size, summary) {
  return [{ key: "header", value: { summary: summary || "bitGen Studio: add " + path, description: "" } },
    { key: "lfsFile", value: { path, algo: "sha256", oid, size } }].map((x) => JSON.stringify(x)).join("\n") + "\n";
}

async function call(url, o) {
  const r = await fetch(url, Object.assign({ signal: AbortSignal.timeout((o && o.ms) || 60000) }, o || {}));
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { j = null; }
  return { status: r.status, j, t, headers: r.headers };
}
/** one PUT of a whole file with its length (S3 refuses a chunked one) - streamed, counting */
function putFile(url, abs, size, headers, onBytes) {
  return new Promise((ok, no) => {
    const u = new URL(url), mod = u.protocol === "https:" ? require("https") : require("http");
    const h = Object.assign({}, headers || {}, { "Content-Length": size });
    const q = mod.request(u, { method: "PUT", headers: h }, (res) => { let b = ""; res.on("data", (d) => { b += d; }); res.on("end", () => (res.statusCode < 300 ? ok(res.statusCode) : no(new Error("Hugging Face's storage refused the file (HTTP " + res.statusCode + ") " + b.slice(0, 160))))); });
    q.on("error", no);
    let sent = 0;
    const rs = fs.createReadStream(abs, { highWaterMark: 4 << 20 });
    rs.on("data", (d) => { sent += d.length; if (onBytes) onBytes(sent); });
    rs.on("error", no);
    rs.pipe(q);
  });
}
function readPart(fd, off, len) { const b = Buffer.alloc(len); fs.readSync(fd, b, 0, len, off); return b; }

async function upload(abs, o) {
  const opt = o || {}, base = HF(), tk = String(opt.token || "");
  const say = (n) => { if (opt.onProgress) try { opt.onProgress(n); } catch { /* fine */ } };
  if (!tk) { const e = new Error("no Hugging Face token - add one that can write (huggingface.co/settings/tokens) in Settings ▸ Models"); e.status = 409; e.code = "no_token"; throw e; }
  const A = { Authorization: "Bearer " + tk };
  const who = await call(base + "/api/whoami-v2", { headers: A });
  if (who.status === 401) { const e = new Error("Hugging Face did not accept your token (Settings ▸ Models)"); e.status = 409; e.code = "bad_token"; throw e; }
  if (who.status !== 200 || !who.j || !who.j.name) { const e = new Error("Hugging Face could not be reached (HTTP " + who.status + ")"); e.status = 502; throw e; }
  const role = String((((who.j.auth || {}).accessToken) || {}).role || "");
  if (role === "read") { const e = new Error("your Hugging Face token can only read - make one with write access (huggingface.co/settings/tokens) and put it in Settings ▸ Models"); e.status = 409; e.code = "read_token"; throw e; }
  const repoName = opt.repoName || REPO, repo = who.j.name + "/" + repoName;
  const mk = await call(base + "/api/repos/create", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, A), body: JSON.stringify({ type: "model", name: repoName, private: true }) });
  if (mk.status !== 200 && mk.status !== 201 && mk.status !== 409) { const e = new Error("Hugging Face did not make the repo " + repo + " (HTTP " + mk.status + ")"); e.status = 502; throw e; }
  const size = fs.statSync(abs).size;
  const oid = String(opt.sha256 || "").toLowerCase() || await require("./civitai").sha256(abs);
  const path = repoPath(opt.folder, opt.name || require("path").basename(abs));
  const b = await call(base + "/" + repo + ".git/info/lfs/objects/batch", { method: "POST", headers: Object.assign({ "Content-Type": LFS, Accept: LFS }, A),
    body: JSON.stringify({ operation: "upload", transfers: ["basic", "multipart"], hash_algo: "sha256", ref: { name: "main" }, objects: [{ oid, size }] }) });
  const obj = b.j && b.j.objects && b.j.objects[0];
  if (b.status !== 200 || !obj) { const e = new Error("Hugging Face did not take the upload (HTTP " + b.status + ")"); e.status = 502; throw e; }
  if (obj.error) { const e = new Error("Hugging Face: " + (obj.error.message || "refused")); e.status = 502; throw e; }
  let sent = 0;
  const up = obj.actions && obj.actions.upload;
  if (up) {
    const h = up.header || {}, parts = partsOf(h);
    if (h.chunk_size && parts.length) {
      const chunk = +h.chunk_size, fd = fs.openSync(abs, "r"), done = [];
      try {
        for (const p of parts) {
          const off = (p.n - 1) * chunk, len = Math.min(chunk, size - off);
          if (len <= 0) break;
          let etag = "", last = null;
          for (let tries = 0; tries < 3 && !etag; tries++) {
            try {
              const r = await fetch(p.url, { method: "PUT", body: readPart(fd, off, len), signal: AbortSignal.timeout(+(process.env.H3_HF_PART_MS || 3600000)) });
              await r.arrayBuffer();
              if (r.status >= 300) throw new Error("HTTP " + r.status);
              etag = r.headers.get("etag") || "";
              if (!etag) throw new Error("no ETag");
            } catch (e) { last = e; }
          }
          if (!etag) { const e = new Error("part " + p.n + " of " + parts.length + " did not go up (" + ((last && last.message) || "") + ")"); e.status = 502; throw e; }
          done.push({ partNumber: p.n, etag }); sent += len; say(sent);
        }
      } finally { try { fs.closeSync(fd); } catch { /* fine */ } }
      const fin = await call(up.href, { method: "POST", headers: { "Content-Type": LFS, Accept: LFS }, body: JSON.stringify({ oid, parts: done }) });
      if (fin.status >= 300) { const e = new Error("Hugging Face did not finish the upload (HTTP " + fin.status + ")"); e.status = 502; throw e; }
    } else {
      const hh = Object.assign({}, h); delete hh.chunk_size;
      await putFile(up.href, abs, size, hh, (n) => { sent = n; say(n); });
    }
    const v = obj.actions.verify;
    if (v) {
      const r = await call(v.href, { method: "POST", headers: Object.assign({ "Content-Type": LFS, Accept: LFS }, v.header || {}), body: JSON.stringify({ oid, size }) });
      if (r.status >= 300) { const e = new Error("Hugging Face could not check the file (HTTP " + r.status + ")"); e.status = 502; throw e; }
    }
  } else say(size);   // Hugging Face has this file already
  const c = await call(base + "/api/models/" + repo + "/commit/main", { method: "POST", headers: Object.assign({ "Content-Type": "application/x-ndjson" }, A), body: ndjson(path, oid, size) });
  if (c.status >= 300) { const e = new Error("Hugging Face did not add the file to " + repo + " (HTTP " + c.status + ": " + String((c.j && (c.j.error || c.j.message)) || c.t).slice(0, 160) + ")"); e.status = 502; throw e; }
  return { url: base + "/" + repo + "/resolve/main/" + path.split("/").map(encodeURIComponent).join("/"), repo, path, sent, sha256: oid, size };
}
module.exports = { REPO, repoPath, partsOf, ndjson, upload };
