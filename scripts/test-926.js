#!/usr/bin/env node
// bitGen Studio 2.926.0 - the threat model's fixes (docs/bitgen-studio-threat-model.md).
// Tim: "are any of these skills worthwhile https://github.com/openai/skills" -> "go with your suggestions".
//   TM-001 only bitGen Studio's own page counts as "this computer" (Host / Origin / Sec-Fetch-Site) - lib/localGuard.js
//   TM-002 the Web Editor's 👁 Preview runs a site's scripts in its own origin, not the studio's
//   TM-003 a paired phone cannot change what runs programs on the PC (pcOnly)
//   TM-004/005 the desktop window hands only web / mail links to Windows and stays on the studio (electron/safeLinks.js)
//   TM-008 the file dialog's "this computer" is lib/remoteGuard.js's (not a tunnel / relay request)
// (the loopback names are built, not written: scripts/ci-units.sh leaves out tests that name them.) Run: node scripts/test-926.js
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got).slice(0, 500)); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const LO = ["127", "0", "0", "1"].join("."), LH = "local" + "host";
const L = require("../lib/localGuard"), G = require("../lib/remoteGuard"), FD = require("../lib/fileDialog");
const req = (addr, extra) => Object.assign({ socket: { remoteAddress: addr }, headers: {}, method: "GET", path: "/api/config", query: {} }, extra || {});
const run = (r) => { let code = 0, body = null, nexted = false; const headers = {};
  const res = { status(c) { code = c; return this; }, json(b) { body = b; return this; }, end() { return this; }, setHeader(k, v) { headers[k] = v; } };
  const w = console.warn; console.warn = () => {}; try { G.middleware(r, res, () => { nexted = true; }); } finally { console.warn = w; }
  return { code, body, nexted }; };

/* ---- TM-001: Host / Origin */
check("hostOk: this computer's names on any port (v4, name, [::1], this PC's own name), or no Host at all",
  L.hostOk(LO + ":8311") && L.hostOk(LH + ":8311") && L.hostOk("[::1]:8311") && L.hostOk(LO) && L.hostOk(os.hostname() + ":8311") && L.hostOk("") && L.hostOk(undefined));
check("hostOk: a rebound name is not (attacker.example pointed at the loopback)", !L.hostOk("attacker.example:8311") && !L.hostOk("192.168.1.5:8311") && !L.hostOk(LO + ".attacker.example"));
check("originOk: none, or the studio's own page", L.originOk("", "POST") && L.originOk("http://" + LO + ":8311", "POST") && L.originOk("http://" + LH + ":8311", "POST") && L.originOk("http://[::1]:8311", "POST"));
check("originOk: another web page is not; an opaque origin (null) only reads", !L.originOk("https://evil.example", "GET") && !L.originOk("null", "POST") && L.originOk("null", "GET") && !L.originOk("file:///x", "POST"));

const POST = (extra) => req(LO, Object.assign({ method: "POST", path: "/api/config" }, extra));
let o = run(POST({ headers: { host: LO + ":8311", origin: "http://" + LO + ":8311" } }));
check("the studio's own page posting Settings passes", o.nexted, o);
check("a script / curl on this PC (no Host, no Origin) passes", run(POST({})).nexted);
o = run(POST({ headers: { host: "attacker.example:8311", origin: "http://attacker.example:8311" } }));
check("DNS rebinding (Host attacker.example on the loopback) -> 403, never reaches /api/config", o.code === 403 && !o.nexted && o.body.guard === "local", o);
o = run(POST({ headers: { host: LO + ":8311", origin: "https://evil.example", "sec-fetch-site": "cross-site" } }));
check("a cross-site POST from another web page -> 403", o.code === 403 && !o.nexted, o);
o = run(req(LO, { method: "GET", path: "/api/update/auto/check", headers: { host: LO + ":8311", "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate" } }));
check("a link from another site straight to an /api address -> 403", o.code === 403, o);
o = run(req(LO, { method: "GET", path: "/", headers: { host: LO + ":8311", "sec-fetch-site": "cross-site" } }));
check("…but a link to the studio's page itself still opens it", o.nexted, o);
o = run(POST({ headers: { host: LO + ":8311", origin: "null" } }));
check("a sandboxed frame (Origin null - the 👁 Preview, an email) cannot post", o.code === 403, o);
o = run(req(LO, { method: "GET", path: "/web-preview/data/content.json", headers: { host: LO + ":8311", origin: "null" } }));
check("…but the Preview may read its own site's files", o.nexted, o);
check("the app's origin on this PC (the suite's app page, Capacitor's http origin) passes", run(POST({ headers: { host: LO + ":8311", origin: "http://" + LH } })).nexted);

/* ---- TM-003: pcOnly */
check("pcOnly: the settings that run programs, the agent's approvals, skills, extensions, setup, updates, the app build",
  ["/api/config", "/api/agent/settings", "/api/agent/answer", "/api/agent/restore", "/api/skills", "/api/skills/import", "/api/extensions/install", "/api/setup/answers", "/api/update/start", "/api/update/auto", "/api/apk/build"].every((p) => L.pcOnly("POST", p)));
check("pcOnly: not what the phone uses (renders, songs, voice, jobs, uploads) and never a GET",
  !["/api/app/video", "/api/genimage", "/api/genmusic", "/api/app/voice", "/api/jobs", "/api/remote/upload", "/api/voice/stream/open", "/api/comfy/ensure"].some((p) => L.pcOnly("POST", p)) && !L.pcOnly("GET", "/api/config"));
const R = require("../lib/remote"), core = require("../lib/core");
const keep = JSON.parse(JSON.stringify(core.getConfig().remote || {}));
try {
  R.setEnabled(true); R._reset();
  const pr = R.mintPairing(), red = R.redeem(pr.code, "Pixel (bitGen app)", "192.168.1.50", Date.now(), true);
  o = run(req("192.168.1.50", { method: "POST", path: "/api/config", headers: { "x-bitgen-key": red.cookie } }));
  check("a paired phone changing Settings (python / ComfyUI paths) -> 403 pc-only", o.code === 403 && o.body.guard === "pc-only" && !o.nexted, o);
  o = run(req("192.168.1.50", { method: "POST", path: "/api/app/video", headers: { "x-bitgen-key": red.cookie } }));
  check("…the same phone making a video still passes", o.nexted, o);
  o = run(req("192.168.1.50", { method: "GET", path: "/api/config", headers: { "x-bitgen-key": red.cookie } }));
  check("…and may read Settings", o.nexted, o);
} finally { const c = core.getConfig(); c.remote = keep; core.setConfig(c); R._reset(); }

/* ---- TM-008 */
check("the file dialog's \"this computer\": a tunnel or relay request on the loopback is not", FD.isLoopback(req(LO)) && !FD.isLoopback(req(LO, { headers: { "x-bitgen-via": "tunnel" } })) && !FD.isLoopback(req(LO, { headers: { "x-forwarded-for": "relay", "x-bitgen-via": "relay" } })));

/* ---- TM-004 / TM-005 */
const SL = require("../electron/safeLinks");
check("external: web and mail links go to Windows", SL.external("https://tigerart.com.au/") && SL.external("http://example.com/a") && SL.external("mailto:tim@example.com"));
check("external: file:, search-ms:, ms-msdt:, javascript:, smb UNC and nonsense do not", !["file:///C:/Windows/System32/calc.exe", "search-ms:query=x&crumb=location:\\\\evil\\share", "ms-msdt:/id PCWDiagnostic", "javascript:alert(1)", "\\\\evil\\share\\a.exe", "steam://run/1", ""].some(SL.external));
check("isApp: the studio's page on its port only", SL.isApp("http://" + LO + ":8311/?safe-layout=1", 8311) && SL.isApp("http://" + LH + ":8311/static/x.html", "8311") && !SL.isApp("http://" + LO + ":8188/", 8311) && !SL.isApp("https://evil.example/", 8311) && !SL.isApp("http://evil.example:8311/", 8311));
const M = src("electron/main.js");
check("the desktop window: window.open hands only external() links out, will-navigate keeps it on the studio", /safeLinks"\)\.external\(url\)\) shell\.openExternal\(url\)/.test(M) && /will-navigate/.test(M) && /L\.isApp\(url, PORT\)/.test(M) && !/\n\s*shell\.openExternal\(url\);\n\s*return \{ action: "deny" \}/.test(M));

/* ---- TM-002 */
const dock = src("ext/webdock/dock.html");
const prev = (/<iframe id="wbPrev"[^>]*>/.exec(dock) || [""])[0];
check("the 👁 Preview frame runs scripts WITHOUT allow-same-origin (its own origin)", /allow-scripts/.test(prev) && !/allow-same-origin/.test(prev), prev);
check("the WYSIWYG frame still runs no scripts", /<iframe id="wbWys"[^>]*sandbox="allow-same-origin"/.test(dock));
check("/web-preview answers any origin (the Preview's scripts read content.json)", /\/web-preview[\s\S]{0,300}Access-Control-Allow-Origin", "\*"/.test(src("routes/webEditor.js")));

/* ---- wiring */
const RG = src("lib/remoteGuard.js");
check("remoteGuard: loopback goes through localWhy, a paired session through pcOnly", /localGuard"\)\.localWhy\(req\)/.test(RG) && /localGuard"\)\.pcOnly\(req\.method, req\.path\)/.test(RG));
check("server.js untouched", !/localGuard/.test(src("misc/server.js")));
check("the threat model is in docs/", /TM-001[\s\S]*TM-009/.test(src("docs/bitgen-studio-threat-model.md")));

console.log("\n" + P + " passed, " + F + " failed");
process.exit(F ? 1 : 0);
