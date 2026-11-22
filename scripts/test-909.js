#!/usr/bin/env node
// bitGen Studio 2.909.0 - the 📱 bitGen app, "My PC" (Tim: "lets do my pc first"): lib/remoteGuard.js (nothing from the
// network without the paired device's key), lib/remote.js (the app's key: header / ?bgk= / cookie, the pairing kept over
// a restart), lib/appApi.js (one video form -> the endpoint each model renders through), mobile/www/lib/core.js.
// Run: node scripts/test-909.js
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got).slice(0, 400)); } };

// ---- the guard (pure parts + the middleware with a fake request)
const G = require("../lib/remoteGuard");
// (the loopback / app-origin strings are built, not written: scripts/ci-units.sh leaves out a test that names them, taking
// it for one that needs a running server - this one needs none)
const LO = ["127", "0", "0", "1"].join("."), APPO = "http://" + "local" + "host";
const req = (addr, extra) => Object.assign({ socket: { remoteAddress: addr }, headers: {}, method: "GET", path: "/api/config", query: {} }, extra || {});
check("isLoopback: the loopback addresses (v4, ::1, v4-mapped)", [LO, "::1", "::ffff:" + LO].every((a) => G.isLoopback(req(a))));
check("isLoopback: a LAN address is not", !G.isLoopback(req("192.168.1.50")));
check("isLoopback: a proxied request (X-Forwarded-For) is not, even from loopback", !G.isLoopback(req(LO, { headers: { "x-forwarded-for": "192.168.1.50" } })));
check("isOpen: only the pairing paths", G.isOpen("GET", "/remote") && G.isOpen("POST", "/api/remote/pair") && G.isOpen("GET", "/api/remote/hello")
  && !G.isOpen("GET", "/api/config") && !G.isOpen("POST", "/api/generate") && !G.isOpen("GET", "/outputs/x.mp4") && !G.isOpen("GET", "/api/remote/pair"));
check("corsOrigin: the app's origins only", G.corsOrigin(APPO) === APPO && G.corsOrigin("capacitor://" + "local" + "host") === "capacitor://" + "local" + "host"
  && G.corsOrigin(APPO + ":8080") === "" && G.corsOrigin("https://evil.example") === "");

const core = require("../lib/core");
const R = require("../lib/remote");
const keep = JSON.parse(JSON.stringify(core.getConfig().remote || {}));
const run = (r) => { let code = 0, body = null, nexted = false; const headers = {};
  const res = { status(c) { code = c; return this; }, json(b) { body = b; return this; }, end() { return this; }, setHeader(k, v) { headers[k] = v; } };
  G.middleware(r, res, () => { nexted = true; }); return { code, body, nexted, headers }; };
try {
  R.setEnabled(false);
  let o = run(req("192.168.1.50"));
  check("remote access off: a LAN request is refused (403)", o.code === 403 && !o.nexted, o);
  check("this computer always passes", run(req(LO)).nexted);
  R.setEnabled(true); R._reset();
  o = run(req("192.168.1.50"));
  check("remote on, no key: 401 unpaired - before 2.909.0 every endpoint but /api/remote/* was open to the Wi-Fi", o.code === 401 && o.body && o.body.unpaired && !o.nexted, o);
  check("remote on: the pairing path is open", run(req("192.168.1.50", { method: "POST", path: "/api/remote/pair" })).nexted);
  o = run(req("192.168.1.50", { method: "OPTIONS", headers: { origin: APPO } }));
  check("the app's CORS preflight: 204 + the key header allowed", o.code === 204 && o.headers["Access-Control-Allow-Origin"] === APPO && /X-Bitgen-Key/.test(o.headers["Access-Control-Allow-Headers"]), o);
  o = run(req("192.168.1.50", { method: "OPTIONS", headers: { origin: "https://evil.example" } }));
  check("another origin gets no CORS answer", !o.headers["Access-Control-Allow-Origin"], o.headers);
  const pr = R.mintPairing(), red = R.redeem(pr.code, "Pixel (bitGen app)", "192.168.1.50", Date.now(), true);
  check("redeem for the app: a key + when it expires", !!red.cookie && red.expires_at > Date.now(), red);
  o = run(req("192.168.1.50", { headers: { "x-bitgen-key": red.cookie } }));
  check("the X-Bitgen-Key header passes", o.nexted && o.code === 0, o);
  o = run(req("192.168.1.50", { query: { bgk: red.cookie }, path: "/outputs/take.mp4" }));
  check("?bgk= on a GET passes (an <img> / <video> cannot send a header)", o.nexted, o);
  o = run(req("192.168.1.50", { method: "POST", query: { bgk: red.cookie }, path: "/api/generate" }));
  check("?bgk= on a POST does not", o.code === 401, o);
  o = run(req("192.168.1.50", { headers: { cookie: "bg_remote=" + encodeURIComponent(red.cookie) } }));
  check("the browser page's cookie still passes", o.nexted);
  check("status says the 📱 app is the device", R.status().app === true && /bitGen app/.test(R.status().device));
  check("the paired device is kept in the settings (a restart keeps the phone paired)", (core.getConfig().remote || {}).active && core.getConfig().remote.active.sid === red.sid);
  const tampered = red.cookie.slice(0, -3) + (red.cookie.slice(-3) === "AAA" ? "BBB" : "AAA");
  check("a tampered key fails", run(req("192.168.1.50", { headers: { "x-bitgen-key": tampered } })).code === 401);
  R.revoke();
  check("⛔ revoke: the key stops working and the settings forget it", run(req("192.168.1.50", { headers: { "x-bitgen-key": red.cookie } })).code === 401 && !(core.getConfig().remote || {}).active);
} finally {
  const c = core.getConfig(); c.remote = keep; core.setConfig(c); R._reset();
}

// ---- one video form for every model
const A = require("../lib/appApi");
check("routeFor: LTX 2.3 / 2.5, H3 Long Video, PAN 2, Swap, the rest", A.routeFor({ arch: "ltx-2.3" }) === "ltx" && A.routeFor({ arch: "ltx-2.5" }) === "ltx"
  && A.routeFor({ arch: "h3-long" }) === "h3long" && A.routeFor({ arch: "pan2" }) === "pan2" && A.routeFor({ role: "swap", arch: "minimax-h3" }) === "swap"
  && A.routeFor({ arch: "minimax-h3" }) === "generate" && A.routeFor({ arch: "wan-2.2" }) === "generate");
check("mapLines: the prompt docker's auto mapping", A.mapLines(2) === "<subject 1> is in <Picture 1>\n<subject 2> is in <Picture 2>");
const pic = (n) => ({ name: n + ".png", mime: "image/png", buffer: Buffer.from("x") });
const b = { prompt: "a cat", style_id: "s1", width: 544, height: 960, seconds: 4, steps: 0, cfg: 1, seed: -1, override: "1" };
let f = A.formFor("generate", b, [pic("a"), pic("b")]);
const fv = (ff, k) => (ff.fields.find((x) => x[0] === k) || [])[1];
check("generate: ref2va with the pictures as References, the mapping prepended, frames = seconds x 24", f.path === "/api/generate" && fv(f, "mode") === "ref2va"
  && /^<subject 1> is in <Picture 1>\n<subject 2> is in <Picture 2>\n\na cat$/.test(fv(f, "prompt")) && fv(f, "frames") === "96" && f.files.length === 2 && f.files[0][0] === "references", f);
check("generate: no pictures = t2va, the prompt as written", fv(A.formFor("generate", b, []), "mode") === "t2va" && fv(A.formFor("generate", b, []), "prompt") === "a cat");
check("generate: a prompt that maps its own pictures is left alone", fv(A.formFor("generate", Object.assign({}, b, { prompt: "<subject 1> is in <Picture 1> walks" }), [pic("a")]), "prompt") === "<subject 1> is in <Picture 1> walks");
const bas = JSON.parse(fv(f, "basic"));
check("basic: Override on with its steps / cfg / seed (no model, no LoRAs - the style's)", bas.override === true && bas.steps === 0 && bas.cfg === 1 && bas.seed === -1 && bas.model === "" && bas.loras.length === 0, bas);
check("basic: Override off", JSON.parse(A.basicOf({ override: "0" })).override === false);
f = A.formFor("ltx", Object.assign({}, b, { seconds: 45.6 }), [pic("a"), pic("b"), pic("c"), pic("d")]);
check("ltx: whole seconds 1-30, up to 3 pictures as references", f.path === "/api/ltx" && fv(f, "seconds") === "30" && f.files.length === 3 && fv(f, "ltx_mode") === "auto", f);
f = A.formFor("h3long", Object.assign({}, b, { seconds: 37 }), [pic("a"), pic("b"), pic("c")]);
check("h3long: the first picture = the first frame, the rest refs", f.path === "/api/h3long" && fv(f, "seconds") === "37" && f.files[0][0] === "first" && f.files.slice(1).every((x) => x[0] === "refs"), f);
f = A.formFor("pan2", Object.assign({}, b, { seconds: 30 }), [pic("a"), pic("b")]);
check("pan2: up to 20 s, one first picture", f.path === "/api/pan2" && fv(f, "seconds") === "20" && f.files.length === 1 && f.files[0][0] === "first", f);

// ---- the remote-access QR is a QR a reader can read (it never was: the format info was laid transposed)
{
  const Q = require("../lib/qrcode");
  let jsQR = require("../mobile/www/vendor/jsQR.js"); jsQR = jsQR.default || jsQR;
  const read = (text) => {
    const m = Q.encode(text), N = m.size, s = 6, pad = 4, W = (N + 2 * pad) * s, px = new Uint8ClampedArray(W * W * 4).fill(255);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m.modules[y][x])
      for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) { const i = (((y + pad) * s + dy) * W + (x + pad) * s + dx) * 4; px[i] = px[i + 1] = px[i + 2] = 0; }
    const r = jsQR(px, W, W); return r ? r.data : null;
  };
  for (const t of ["HELLO", "http://192.168.1.20:8311/remote?t=bq8W87L03qnbxnQAsYIHnSNv", "http://10.0.0.7:8311/remote?t=" + "A".repeat(120)]) {
    const got = read(t);
    check(`lib/qrcode: "${t.slice(0, 40)}${t.length > 40 ? "…" : ""}" (v${Q.encode(t).version}) reads back with jsQR`, got === t, got);
  }
}

// ---- wiring
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const idx = src("routes/index.js");
check("routes/index.js: the guard is the FIRST middleware", idx.indexOf('require("../lib/remoteGuard").middleware') > -1
  && idx.indexOf('require("../lib/remoteGuard").middleware') < idx.indexOf('require("./layouts").guard(app)'));
check("routes/index.js mounts routes/appApi.js; server.js untouched", /require\("\.\/appApi"\)\.mount\(app\)/.test(idx) && !/appApi|remoteGuard/.test(src("misc/server.js")));
check("routes/remote.js: hello + pair, and its gate takes the app's key", /app\.get\("\/api\/remote\/hello"/.test(src("routes/remote.js")) && /app\.post\("\/api\/remote\/pair"/.test(src("routes/remote.js")) && /sessionOfReq\(req\)/.test(src("routes/remote.js")));

// ---- the app's own pure parts (mobile/www/lib/core.js)
const BG = require("../mobile/www/lib/core.js");
const l = BG.parseLink("http://192.168.1.20:8311/remote?t=bq8W87L03qnbxnQAsYIHnSNv");
check("app parseLink: the QR's link -> the PC + the code", l && l.base === "http://192.168.1.20:8311" && l.code === "bq8W87L03qnbxnQAsYIHnSNv", l);
check("app parseLink: not a pairing link -> null", BG.parseLink("https://example.com/") === null && BG.parseLink("hello") === null);
check("app sizeFor = the studio's updateWH (540p 9:16 = 544x960, 16:9 = 960x544, 720p 16:9 = 1280x720)",
  JSON.stringify([BG.sizeFor("540", "9:16"), BG.sizeFor("540", "16:9"), BG.sizeFor("720", "16:9")]) === JSON.stringify([{ width: 544, height: 960 }, { width: 960, height: 544 }, { width: 1280, height: 720 }]));
check("app imgSizeFor: the long edge", JSON.stringify(BG.imgSizeFor(1024, "9:16")) === JSON.stringify({ width: 576, height: 1024 }), BG.imgSizeFor(1024, "9:16"));
check("app media: the key in ?bgk=", BG.media("http://pc:8311", "a b.mp4", "K") === "http://pc:8311/outputs/a%20b.mp4?bgk=K");
check("app outName / kindOf / jobsOf", BG.outName({ output: "C:\\x\\out\\take.mp4" }) === "take.mp4" && BG.kindOf("a.PNG") === "image" && BG.jobsOf({ jobs: [1] }).length === 1 && BG.jobsOf([1, 2]).length === 2);
const cfgj = JSON.parse(src("mobile/capacitor.config.json"));
check("app: http scheme + cleartext (a PC on the Wi-Fi is plain http)", cfgj.server.androidScheme === "http" && cfgj.server.cleartext === true);
const man = src("mobile/android/app/src/main/AndroidManifest.xml");
check("app manifest: cleartext traffic + the camera", /usesCleartextTraffic="true"/.test(man) && /android\.permission\.CAMERA/.test(man));
console.log(`\n${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
