// bitGen Studio — lib/cfTunnel.js (2.914.0): ☁ AWAY FROM THE WI-FI THROUGH A CLOUDFLARE QUICK TUNNEL - NOTHING TO SIGN UP FOR.
//
// Tim: "only tigerart admin will be able to use it this relay through tigerart, other users can use cloudflare or their own
// hosts. i don't want to get a ddns" -> "make remote access a dropdown ... add an input for url to relay.php and a cloudflare
// option. if checked can bitgen set up the cloudflare or does the user need to input something?" - bitGen sets it up:
// cloudflared (Cloudflare's own tunnel program, Apache-2.0) is downloaded once into tools/cloudflared/ (a Download / Cancel
// box first) and run as a QUICK tunnel: no account, no domain, no router change - Cloudflare hands out a random
// https://<words>.trycloudflare.com address. That address is new each time the tunnel starts (when bitGen Studio starts), so
// the app learns it on the Wi-Fi; Cloudflare calls quick tunnels a testing service with no uptime promise.
//   SAFETY: cloudflared does not talk to the studio directly - it talks to a small forwarder on 127.0.0.1 that marks every
//   request X-Bitgen-Via: tunnel (+ X-Forwarded-For), so lib/remoteGuard.js never takes it for this computer: the paired
//   app's key is needed for everything, connecting / pairing is refused, and only for 6 hours after the app was on the Wi-Fi.
//   The guard also treats any request carrying Cloudflare's own headers (cf-ray / cf-connecting-ip) the same way.
//   assetFor(platform, arch) / parseUrl(line) - pure;  status() / install() / start() / stop() / ensure(on)
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const core = require("./core");

const DL = "https://github.com/cloudflare/cloudflared/releases/latest/download/";
let proc = null, proxy = null, proxyPort = 0, want = false, restartT = null;
const st = { url: "", error: "", started: 0, log: [] };
const job = { state: "idle", got: 0, total: 0, error: "" };
const port = () => parseInt(process.env.H3_PORT, 10) || 8311;

/** the release file for this computer (pure) */
function assetFor(plat, arch) {
  if (plat === "win32") return "cloudflared-windows-" + (arch === "ia32" ? "386" : "amd64") + ".exe";
  if (plat === "darwin") return "cloudflared-darwin-" + (arch === "arm64" ? "arm64" : "amd64") + ".tgz";
  return "cloudflared-linux-" + (arch === "arm64" ? "arm64" : arch === "arm" ? "arm" : arch === "ia32" ? "386" : "amd64");
}
/** the quick tunnel's address in a line of cloudflared's output (pure) */
function parseUrl(line) { const m = /https:\/\/[a-z0-9][a-z0-9-]*\.trycloudflare\.com/i.exec(String(line || "")); return m ? m[0].toLowerCase() : ""; }
const dir = () => path.join(core.BASE, "tools", "cloudflared");
const binName = () => (process.platform === "win32" ? "cloudflared.exe" : "cloudflared");
function cfg() { const c = core.getConfig() || {}; return (c.remote && c.remote.cloudflare) || {}; }
function binPath() {
  const c = cfg();
  if (process.env.H3_E2E === "1" && c.test_bin && fs.existsSync(c.test_bin)) return c.test_bin;
  const own = path.join(dir(), binName());
  if (fs.existsSync(own)) return own;
  for (const d of String(process.env.PATH || "").split(path.delimiter)) { const f = path.join(d, binName()); if (d && fs.existsSync(f)) return f; }
  return "";
}
function status() {
  return { installed: !!binPath(), running: !!proc, url: st.url, error: st.error, started: st.started, job: Object.assign({}, job),
    asset: assetFor(process.platform, process.arch), proxy_port: proxyPort };
}

/** ⬇ cloudflared into tools/cloudflared (about 40 MB) - runs in the background, status().job says how far */
function install() {
  if (job.state === "running") return status();
  Object.assign(job, { state: "running", got: 0, total: 0, error: "" });
  (async () => {
    const asset = assetFor(process.platform, process.arch);
    fs.mkdirSync(dir(), { recursive: true });
    const tmp = path.join(dir(), asset + ".part");
    const res = await fetch(DL + asset, { redirect: "follow" });
    if (!res.ok || !res.body) throw new Error("GitHub answered " + res.status + " for " + asset);
    job.total = +res.headers.get("content-length") || 0;
    const out = fs.createWriteStream(tmp);
    for await (const chunk of res.body) { job.got += chunk.length; if (!out.write(chunk)) await new Promise((r) => out.once("drain", r)); }
    await new Promise((r, j) => out.end((e) => (e ? j(e) : r())));
    const target = path.join(dir(), binName());
    if (asset.endsWith(".tgz")) {
      require("child_process").execFileSync("tar", ["-xzf", tmp, "-C", dir()]);
      fs.unlinkSync(tmp);
    } else fs.renameSync(tmp, target);
    try { fs.chmodSync(target, 0o755); } catch { /* Windows */ }
    job.state = "done";
    if (want) start();
  })().catch((e) => { job.state = "error"; job.error = String(e.message || e); });
  return status();
}

/** the forwarder cloudflared talks to: marks every request as from the tunnel, then hands it to the studio (streamed) */
function ensureProxy() {
  if (proxy) return Promise.resolve(proxyPort);
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      const h = Object.assign({}, req.headers);
      delete h["x-bitgen-via"];
      h["x-bitgen-via"] = "tunnel";
      h["x-forwarded-for"] = String(h["cf-connecting-ip"] || "tunnel").split(",")[0].trim() || "tunnel";
      const p = http.request({ host: "127.0.0.1", port: port(), method: req.method, path: req.url, headers: h }, (r) => { res.writeHead(r.statusCode || 502, r.headers); r.pipe(res); });
      p.on("error", () => { if (!res.headersSent) res.writeHead(502, { "content-type": "application/json" }); res.end('{"error":"bitGen Studio did not answer"}'); });
      req.pipe(p);
    });
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => { proxy = srv; proxyPort = srv.address().port; if (srv.unref) srv.unref(); resolve(proxyPort); });
  });
}
function start() {
  want = true;
  if (proc) return status();
  const bin = binPath();
  if (!bin) { st.error = "cloudflared is not downloaded yet"; return status(); }
  ensureProxy().then((pp) => {
    if (proc || !want) return;
    st.url = ""; st.error = ""; st.started = Date.now(); st.log = [];
    const ch = require("child_process").spawn(bin, ["tunnel", "--no-autoupdate", "--url", "http://127.0.0.1:" + pp], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    proc = ch;
    const read = (b) => String(b).split(/\r?\n/).forEach((l) => {
      if (!l.trim()) return;
      st.log.push(l.slice(0, 300)); if (st.log.length > 40) st.log.shift();
      const u = parseUrl(l); if (u) st.url = u;
    });
    ch.stdout.on("data", read); ch.stderr.on("data", read);
    ch.on("error", (e) => { st.error = String(e.message || e); });
    ch.on("exit", (code) => {
      if (proc === ch) proc = null;
      st.url = "";
      if (want) { st.error = st.error || ("cloudflared stopped (" + code + ") - starting it again in 30 s"); restartT = setTimeout(start, 30000); if (restartT.unref) restartT.unref(); }
    });
  }, (e) => { st.error = "the tunnel's forwarder could not start: " + e.message; });
  return status();
}
function stop() {
  want = false;
  if (restartT) clearTimeout(restartT);
  if (proc) { try { proc.kill(); } catch { /* gone */ } proc = null; }
  st.url = "";
  return status();
}
/** on = Cloudflare picked and Remote access on */
function ensure(on) { return on ? start() : stop(); }
process.on("exit", () => { if (proc) try { proc.kill(); } catch { /* gone */ } });
module.exports = { assetFor, parseUrl, status, install, start, stop, ensure, ensureProxy, DL };
