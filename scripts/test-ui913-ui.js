#!/usr/bin/env node
/* bitGen Studio — 2.913.0 in a REAL browser (Tim: "if my phone is on the same wifi connection as the desktop, add a button to
 * connect from bitgen studio in app ... connect automaticlly when i start the app. this link will auto connect when on wifi and
 * stay connected for 6 hours if wifi connection is lost but phone has internet connection elsewhere" -> "Relay via
 * tigerart.com.au"). The relay is the real community/relay.php under php -S; the phone's Wi-Fi is 10.9.8.x (LanInfo stand-in),
 * the PC answers at 10.9.8.42 (the studio, rerouted), every other address is nobody.
 *   📶 the app opens unpaired -> finds the PC by itself -> the studio's bar "wants to connect" -> ✔ Allow -> connected, with
 *      the relay's id + key; Settings says the app is on this Wi-Fi
 *   ☁ the Wi-Fi gone (10.9.8.42 unreachable): the Gallery comes through the relay (sealed), a picture opens (Range part, blob)
 *   6 hours: the PC last saw the app on the Wi-Fi 7 hours ago -> refused, the app says so
 *   📱 Let the app connect: forgotten, Find again -> let in with no question, the window closed after it
 * Against the running app (H3_URL) in the e2e gate (H3_E2E=1). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync, spawn } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = (process.env.H3_URL || "http://127.0.0.1:8311/").replace(/\/$/, "");
const WWW = path.join(__dirname, "..", "mobile", "www");
const XFF = { "x-forwarded-for": "10.9.8.7" };
const PC = "10.9.8.42:" + new URL(URL_).port;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const post = (p, b, h) => fetch(URL_ + p, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, h || {}), body: JSON.stringify(b || {}) });
const get = (p) => fetch(URL_ + p).then((r) => r.json());
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  try { const r = await fetch(URL_ + "/"); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL_); process.exit(0); }
  if (!chromium) { console.log("SKIP: playwright is not installed here"); return; }
  try { execSync("php -v", { stdio: "ignore" }); } catch { console.log("SKIP: no php here (the relay)"); return; }
  const lint = execSync("php -l " + path.join(__dirname, "..", "community", "relay.php") + " && php -l " + path.join(__dirname, "..", "community", "lib", "relay.php"), { encoding: "utf8" });
  check("relay.php + lib/relay.php: PHP syntax", (lint.match(/No syntax errors/g) || []).length === 2, lint);
  const was = await get("/api/remote/status");
  const priv = fs.mkdtempSync(path.join(os.tmpdir(), "bg913-"));
  const phpPort = 8470 + Math.floor(Math.random() * 20);
  const php = spawn("php", ["-S", "127.0.0.1:" + phpPort, "-t", path.join(__dirname, "..", "community")], { env: Object.assign({}, process.env, { BITGEN_PRIVATE_DIR: priv, PHP_CLI_SERVER_WORKERS: "6" }), stdio: "ignore" });
  const RELAY = "http://127.0.0.1:" + phpPort + "/relay.php";
  const b = await chromium.launch({ args: ["--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests"] });
  try {
    for (let i = 0; i < 30; i++) { try { if ((await fetch(RELAY + "?a=info")).ok) break; } catch { /* starting */ } await sleep(200); }
    await post("/api/remote/revoke", {});
    await post("/api/remote/enable", { on: true });
    await post("/api/remote/e2e-bound", { host: "0.0.0.0" });
    // 2.914.0: the relay lets in only its admins or whoever has its key - this one's key
    fs.mkdirSync(path.join(priv, "relay"), { recursive: true }); fs.writeFileSync(path.join(priv, "relay", "key.txt"), "e2e-relay-key\n");
    await post("/api/remote/away", { mode: "relay", relay_url: RELAY, relay_key: "e2e-relay-key" });
    // a picture in the Gallery to fetch later
    let outs = await get("/api/outputs?kind=images");
    if (!Array.isArray(outs) || !outs.length) {
      const info = await get("/api/app/info");
      const st = (info.image_styles || [])[0];
      if (st) { const j = await (await post("/api/genimage", { prompt: "a red kite over the sea", style_id: st.id, batch: 1 })).json();
        for (let i = 0; i < 60 && j.id; i++) { const jj = await get("/api/jobs/" + j.id); if (/done|failed|error|cancel/.test(jj.status)) break; await sleep(1000); } }
      outs = await get("/api/outputs?kind=images");
    }
    const pic = Array.isArray(outs) && outs[0] ? outs[0].name : "";

    // the studio
    const studio = await b.newPage({ viewport: { width: 1500, height: 1000 } });
    const serr = []; studio.on("pageerror", (e) => serr.push(e.message));
    await studio.goto(URL_ + "/", { waitUntil: "domcontentloaded" });
    await studio.waitForFunction(() => window.H3LanPairUi && document.getElementById("lp_box"), null, { timeout: 60000 });

    // the phone: unpaired, on 10.9.8.x
    let lanUp = true;
    const ctx = await b.newContext({ viewport: { width: 412, height: 880 }, extraHTTPHeaders: XFF });
    await ctx.addInitScript(() => { window.Capacitor = { Plugins: { LanInfo: { get: () => Promise.resolve({ wifi: true, ip: "10.9.8.7", prefix: 24 }) } } }; });
    const asked = new Set();
    await ctx.route(/^http:\/\/10\.9\.8\.\d+(:\d+)?\//, (rt) => {
      const u = new URL(rt.request().url());
      asked.add(u.hostname);
      if (u.host === PC && lanUp) return rt.continue({ url: rt.request().url().replace("//" + PC, "//" + new URL(URL_).host) });
      return rt.abort("addressunreachable");
    });
    await ctx.route("http://localhost/**", (rt) => {
      const u = new URL(rt.request().url());
      if (u.pathname === "/lib/build.js") return rt.fulfill({ status: 200, contentType: "text/javascript", body: 'window.BG_BUILD = {"id":"dev","version":"1.3.0"};' });
      const f = path.join(WWW, decodeURIComponent(u.pathname === "/" ? "/index.html" : u.pathname));
      if (!f.startsWith(WWW) || !fs.existsSync(f)) return rt.fulfill({ status: 404, body: "" });
      rt.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || "application/octet-stream", body: fs.readFileSync(f) });
    });
    const p = await ctx.newPage();
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto("http://localhost/index.html");
    await p.waitForFunction(() => /press Allow on the PC/.test(document.getElementById("findMsg").textContent), null, { timeout: 30000 }).catch(() => {});
    check("📶 unpaired, the app looks on its Wi-Fi by itself and finds bitGen Studio (10.9.8.42)", /Found bitGen Studio on \S+ - press Allow on the PC/.test(await p.evaluate(() => document.getElementById("findMsg").textContent)) && asked.size > 20,
      [await p.evaluate(() => document.getElementById("findMsg").textContent), asked.size]);
    await studio.waitForFunction(() => { const x = document.getElementById("lp_bar"); return x && !x.hidden; }, null, { timeout: 10000 }).catch(() => {});
    const barText = await studio.evaluate(() => (document.getElementById("lp_bartext") || {}).textContent || "");
    check("the studio: a bar \"📱 <phone> (its address) wants to connect\" with ✔ Allow / ✕ Deny", /📱 Android phone \(bitGen app\) \(\S+\) wants to connect to bitGen Studio/.test(barText), barText);
    await studio.click("#lp_allow");
    await p.waitForFunction(() => !document.getElementById("v-create").hidden, null, { timeout: 20000 }).catch(() => {});
    const st1 = await p.evaluate(() => ({ conn: document.getElementById("conn").textContent, relay: JSON.parse(localStorage.getItem("bg.relay") || "null"), key: !!localStorage.getItem("bg.key"), name: localStorage.getItem("bg.pcName") }));
    check("✔ Allow -> the app is connected over the Wi-Fi, with the relay's id + its key and the PC's name", /● 10\.9\.8\.42/.test(st1.conn) && st1.key && st1.relay && /relay\.php$/.test(st1.relay.url) && st1.relay.id && st1.relay.key && st1.name, st1);
    const lp = await get("/api/remote/lanpair");
    check("…the studio: the bar gone, the app connected, ☁ on this Wi-Fi now", !lp.pending.length && lp.remote.app && lp.relay.registered && lp.relay.app_home, lp);

    // ☁ away from the Wi-Fi
    lanUp = false;
    await post("/api/remote/relay", { on: true });                  // as after a request: the long poll at once
    await p.click('#tabs button[data-v="gallery"]');
    await p.click('#galSeg button[data-g="images"]').catch(() => {});
    await p.waitForFunction(() => /through the relay/.test(document.getElementById("conn").textContent) && (document.querySelectorAll("#gal .g").length > 0 || /Nothing here yet/.test(document.getElementById("gal").textContent)), null, { timeout: 60000 }).catch(() => {});
    const g = await p.evaluate(() => ({ conn: document.getElementById("conn").textContent, tiles: document.querySelectorAll("#gal .g").length, msg: (document.querySelector("#gal .msg") || {}).textContent || "" }));
    check("☁ the Wi-Fi gone: the Gallery comes through the relay, the time left shown", /☁ \S+ through the relay · 5 h 5\d min left|☁ \S+ through the relay · 6 h 0 min left/.test(g.conn) && (g.tiles > 0 || (!pic && !g.msg)), g);
    const pcs = fs.readdirSync(priv + "/relay").filter((d) => !d.startsWith("_") && d !== "key.txt");
    const appKey = await p.evaluate(() => localStorage.getItem("bg.key"));
    const clear = [];
    for (const d of pcs) for (const sub of ["q", "a"]) for (const f of fs.readdirSync(priv + "/relay/" + d + "/" + sub)) {
      const t = fs.readFileSync(priv + "/relay/" + d + "/" + sub + "/" + f, "latin1");
      if (/x-bitgen-key|\/api\/|\/outputs\//.test(t) || t.includes(appKey)) clear.push(sub + "/" + f);
    }
    check("…the relay holds sealed boxes only: one PC registered, no path, header or key readable there", pcs.length === 1 && !clear.length && !fs.readFileSync(priv + "/relay/" + pcs[0] + "/pc.json", "utf8").includes(appKey), [pcs, clear]);
    if (pic) {
      await p.evaluate((n) => { const t = [...document.querySelectorAll("#gal .g")].find((x) => x.dataset.n === n) || document.querySelector("#gal .g"); t.click(); }, pic);
      await p.waitForFunction(() => { const i = document.querySelector("#vBody img"); return i && i.src.startsWith("blob:") && i.naturalWidth > 0; }, null, { timeout: 60000 }).catch(() => {});
      const v = await p.evaluate(() => { const i = document.querySelector("#vBody img"); return i ? { src: i.src.slice(0, 5), w: i.naturalWidth } : { body: document.getElementById("vBody").textContent }; });
      check("…a picture opens: fetched through the relay in Range parts (a blob)", v.src === "blob:" && v.w > 0, v);
      await p.click("#vClose");
    } else console.log("SKIP (picture): no picture in the Gallery");
    const rs = await get("/api/remote/lanpair");
    check("the studio: answered through the relay; Settings says how long the app can stay away", rs.relay.answered > 0 && /☁ The app can reach this PC through the relay for 5 h 5\d min more|6 h 0 min more/.test(await studio.evaluate(() => { H3LanPairUi.refresh(); return new Promise((r) => setTimeout(() => r(document.getElementById("lp_relayline").textContent), 600)); })), rs.relay);

    // the 6 hours
    await post("/api/remote/e2e-relay", { lan_ago_ms: 7 * 3600 * 1000 });
    await p.click('#galSeg button[data-g="video"]').catch(() => {});
    await p.waitForFunction(() => /more than 6 hours/.test(document.getElementById("conn").textContent + document.getElementById("gal").textContent), null, { timeout: 60000 }).catch(() => {});
    check("6 hours: the PC last saw the app on the Wi-Fi 7 hours ago -> refused, and the app says so",
      /more than 6 hours|6 hours/.test(await p.evaluate(() => document.getElementById("conn").textContent + " " + document.getElementById("gal").textContent)));

    // back home, 📱 Let the app connect (no question)
    lanUp = true;
    await p.click('#tabs button[data-v="settings"]');
    p.once("dialog", (d) => d.accept());
    await p.click("#forget");
    await p.waitForFunction(() => !document.getElementById("v-connect").hidden, null, { timeout: 5000 }).catch(() => {});
    await studio.evaluate(() => { document.getElementById("openSettings").click(); });
    await studio.waitForTimeout(600);
    await studio.evaluate(() => { const t = document.querySelector('[data-stab="general"]'); if (t) t.click(); });
    await studio.click("#s_remote_connect");
    await studio.waitForFunction(() => /Waiting for the app/.test(document.getElementById("lp_state").textContent), null, { timeout: 5000 }).catch(() => {});
    check("📱 Let the app connect: the studio waits for the app (5 minutes)", /📱 Waiting for the app - open it on the phone \(5 min left\)/.test(await studio.evaluate(() => document.getElementById("lp_state").textContent)));
    await p.click("#findBtn");
    await p.waitForFunction(() => !document.getElementById("v-create").hidden, null, { timeout: 30000 }).catch(() => {});
    const lp2 = await get("/api/remote/lanpair");
    check("…Find my PC on Wi-Fi: let in at once (no bar), the window closed after it", /● 10\.9\.8\.42/.test(await p.evaluate(() => document.getElementById("conn").textContent)) && !lp2.window_open && !lp2.pending.length, lp2);
    check("no page errors (studio, app)", !serr.length && !errs.length, [serr, errs]);
    await ctx.close();
  } finally {
    await b.close();
    try { php.kill(); } catch { /* gone */ }
    await post("/api/remote/revoke", {});
    await post("/api/remote/away", { mode: "none", relay_url: "", relay_key: "" });
    await post("/api/remote/enable", { on: !!was.enabled });
    await post("/api/remote/e2e-bound", { host: was.bound || "127.0.0.1" });
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
