// bitGen Studio — SETUP: llama.cpp for the assistant, on every OS (2.331.0).
//
// Windows keeps misc\\get-llama.ps1 (the CUDA build + its cudart pack, tested in
// the field). macOS and Linux take llama.cpp's own release zip for the
// platform - Metal on Apple Silicon, the Vulkan build on Linux (it runs on
// NVIDIA and AMD cards with the stock driver) - into <app>/llama-cpp, where
// lib/core.js looks for llama-server. The rolling bNNNN releases carry the
// binaries (the semver "latest" does not), so the newest release WITH a
// matching asset wins. pickAsset() is pure and tested.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const X = require("./setupExec");
const unzip = require("./unzip");

const API = () => (process.env.BITGEN_GH_API || "https://api.github.com").replace(/\/$/, "");

/** The release asset for this platform, best first. */
function pickAsset(assets, platform, arch) {
  const names = (assets || []).map((a) => a.name);
  const want = platform === "darwin"
    ? [arch === "arm64" ? /^llama-.*-bin-macos-arm64\.zip$/ : /^llama-.*-bin-macos-x64\.zip$/]
    : platform === "linux"
      ? [/^llama-.*-bin-ubuntu-vulkan-x64\.zip$/, /^llama-.*-bin-ubuntu-x64\.zip$/]
      : [];
  for (const re of want) {
    const n = names.find((x) => re.test(x));
    if (n) return (assets || []).find((a) => a.name === n);
  }
  return null;
}

/** Find the folder holding llama-server inside an extracted tree. */
function serverDir(root) {
  const exe = process.platform === "win32" ? "llama-server.exe" : "llama-server";
  const stack = [root];
  while (stack.length) {
    const d = stack.pop();
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    if (ents.some((e) => e.isFile() && e.name === exe)) return d;
    for (const e of ents) if (e.isDirectory()) stack.push(path.join(d, e.name));
  }
  return "";
}

/** Install llama.cpp into appRoot/llama-cpp. ctx = {log, env}. */
async function install(appRoot, ctx) {
  const log = ctx.log || (() => {});
  const dest = path.join(appRoot, "llama-cpp");
  const exe = path.join(dest, process.platform === "win32" ? "llama-server.exe" : "llama-server");
  if (fs.existsSync(exe)) { log("[ok] llama.cpp already installed", false); return { ok: true, skipped: true }; }
  if (process.platform === "win32") {
    const code = await X.run("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
      path.join(appRoot, "misc", "get-llama.ps1")], { log, env: ctx.env, cwd: appRoot });
    return code === 0 ? { ok: true } : { ok: false, error: `misc\\get-llama.ps1 exited ${code}` };
  }
  const r = await X.getJson(`${API()}/repos/ggml-org/llama.cpp/releases?per_page=15`, {});
  if (r.status !== 200 || !Array.isArray(r.json))
    return { ok: false, error: `GitHub did not list llama.cpp releases (${r.status || r.error}) - Settings -> LLM can install it later` };
  let asset = null, tag = "";
  for (const rel of r.json) { asset = pickAsset(rel.assets, process.platform, process.arch); if (asset) { tag = rel.tag_name; break; } }
  if (!asset) return { ok: false, error: `no llama.cpp build for ${process.platform}/${process.arch} in the recent releases` };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bgllama-"));
  const zip = path.join(tmp, asset.name);
  log(`[..] llama.cpp ${tag}: ${asset.name}`, false);
  const d = await X.download(asset.browser_download_url, zip, {});
  if (!d.ok) { fs.rmSync(tmp, { recursive: true, force: true }); return { ok: false, error: d.error }; }
  const out = path.join(tmp, "x");
  // the system unzip keeps the shared-library symlinks and exec bits a
  // Linux / macOS build relies on; lib/unzip is the fallback
  const uz = X.which("unzip");
  if (!uz || (await X.run(uz, ["-q", zip, "-d", out], { log })) !== 0) unzip.extract(zip, out);
  const sd = serverDir(out);
  if (!sd) { fs.rmSync(tmp, { recursive: true, force: true }); return { ok: false, error: `${asset.name} has no llama-server in it` }; }
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(sd, dest, { recursive: true });
  for (const f of fs.readdirSync(dest)) {
    const p = path.join(dest, f);
    try { if (fs.statSync(p).isFile() && !/\.(dylib|so|txt|md|json)$/i.test(f)) fs.chmodSync(p, 0o755); } catch { /* skip */ }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  log(`[ok] llama.cpp ${tag} -> ${dest}`, false);
  return { ok: true, tag };
}

module.exports = { pickAsset, serverDir, install };
