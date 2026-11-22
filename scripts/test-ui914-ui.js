#!/usr/bin/env node
/* bitGen Studio — 2.914.0 in a REAL browser (Tim: "can you make remote access a dropdown in settings-general, add an input for
 * url to relay.php and a cloudflare option ... voice chat will be very useful especially if we can add keywords or phrases,
 * like fix this photo or create a video or create a song about... or if i say find... it goes to websearch mode"):
 *   the relay (community/relay.php + a real Community server, php -S + SQLite): an admin's sign-in registers, a member's is
 *     refused, no sign-in is refused, the relay key (key.txt) registers, a wrong key is refused
 *   Remote access ▾ Cloudflare (a stand-in cloudflared printing a trycloudflare address): the studio shows the address; the
 *     app is told {mode: tunnel}; through the forwarder: no key = 401, connecting = 403, the PC-only routes = 403, hello ok,
 *     the key = 200, 7 h away = refused; a request with Cloudflare's own headers on 127.0.0.1 is not "this computer"
 *   the app away (its Wi-Fi gone): through the tunnel; 🎙 Talk ("make a video of …" -> Generate; "find …" -> the web;
 *     "show me …" with My own phrases -> a picture), 🎙 Speak the prompt (dictation) - Chromium's fake microphone, the PC's
 *     speech to text stood in by the test phrase (H3_E2E only)
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
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const post = (p, b, h) => fetch(URL_ + p, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, h || {}), body: JSON.stringify(b || {}) });
const get = (p) => fetch(URL_ + p).then((r) => r.json());
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  try { const r = await fetch(URL_ + "/"); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL_); process.exit(0); }
  if (!chromium) { console.log("SKIP: playwright is not installed here"); return; }
  try { execSync("php -v", { stdio: "ignore" }); } catch { console.log("SKIP: no php here"); return; }
  const was = await get("/api/remote/status");
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg914-")), priv = path.join(T, "priv");
  fs.mkdirSync(path.join(priv, "relay"), { recursive: true });
  const phpPort = 8490 + Math.floor(Math.random() * 20);
  const php = spawn("php", ["-S", "127.0.0.1:" + phpPort, "-t", path.join(__dirname, "..", "community")], { stdio: "ignore",
    env: Object.assign({}, process.env, { BITGEN_PRIVATE_DIR: priv, PHP_CLI_SERVER_WORKERS: "4", BGC_DSN: "sqlite:" + path.join(T, "c.db"), BGC_ADMINS: "boss", BGC_POW_BITS: "0", BGC_REGISTER_PER_HOUR: "200", BGC_MAIL_LOG: path.join(T, "mail.log") }) });
  const C = "http://127.0.0.1:" + phpPort;
  const b = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests"] });
  try {
    for (let i = 0; i < 30; i++) { try { if ((await fetch(C + "/relay.php?a=info")).ok) break; } catch { /* starting */ } await sleep(200); }
    // ---- the relay: its own admins, or its key
    const join = async (handle) => (await (await fetch(C + "/api.php?a=register", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle, password: "pw-" + handle + "-123", first_name: handle, last_name: "Test", email: handle + "@example.com" }) })).json()).token;
    const boss = await join("boss"), joe = await join("joe");
    const reg = async (body) => { const r = await fetch(C + "/relay.php?a=register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return { s: r.status, j: await r.json() }; };
    const rBoss = await reg({ token: boss }), rJoe = await reg({ token: joe }), rNone = await reg({});
    check("relay: the Community server's admin registers a PC", boss && rBoss.s === 200 && rBoss.j.id && rBoss.j.secret, rBoss);
    check("relay: a member who is not an admin is refused; no sign-in is refused", rJoe.s === 403 && /only for the admins/.test(rJoe.j.error) && rNone.s === 403 && /private/.test(rNone.j.error), [rJoe, rNone]);
    fs.writeFileSync(path.join(priv, "relay", "key.txt"), "own-relay-key-1\n");
    const rKey = await reg({ key: "own-relay-key-1" }), rBad = await reg({ key: "nope" });
    check("relay: your own relay.php's key registers; a wrong key does not", rKey.s === 200 && rKey.j.id && rBad.s === 403, [rKey.s, rBad.s]);

    // ---- Remote access ▾ Cloudflare (a stand-in cloudflared)
    await post("/api/remote/revoke", {});
    await post("/api/remote/enable", { on: true });
    await post("/api/remote/e2e-bound", { host: "0.0.0.0" });
    const cf = path.join(T, "cloudflared");
    fs.writeFileSync(cf, '#!/bin/sh\necho "2026-11-22T03:00:00Z INF |  https://brave-red-kite.trycloudflare.com                    |" 1>&2\nexec sleep 900\n'); fs.chmodSync(cf, 0o755);
    const e2 = await (await post("/api/remote/e2e-cloudflare", { bin: cf })).json();
    const PX = "http://127.0.0.1:" + e2.proxy_port;
    const studio = await b.newPage({ viewport: { width: 1500, height: 1000 } });
    const serr = []; studio.on("pageerror", (e) => serr.push(e.message));
    await studio.goto(URL_ + "/", { waitUntil: "domcontentloaded" });
    await studio.waitForFunction(() => window.H3RemoteAccessUi && document.getElementById("s_remote_mode"), null, { timeout: 60000 });
    await studio.evaluate(() => { document.getElementById("openSettings").click(); });
    await studio.waitForTimeout(600);
    await studio.evaluate(() => { const t = document.querySelector('[data-stab="general"]'); if (t) t.click(); });
    await studio.selectOption("#s_remote_mode", "cloudflare");
    await studio.waitForFunction(() => /brave-red-kite\.trycloudflare\.com/.test(document.getElementById("s_remote_awayline").textContent), null, { timeout: 20000 }).catch(() => {});
    const line = await studio.evaluate(() => ({ t: document.getElementById("s_remote_awayline").textContent, cf: !document.getElementById("s_remote_cfbox").hidden, rl: document.getElementById("s_remote_relaybox").hidden }));
    check("Remote access ▾ Cloudflare: bitGen runs the tunnel itself and shows its address (nothing typed)", /☁ Away from the Wi-Fi the app reaches this PC at https:\/\/brave-red-kite\.trycloudflare\.com/.test(line.t) && line.cf && line.rl, line);
    // the app pairs on the Wi-Fi -> told the tunnel
    await post("/api/remote/lanpair/window", {});
    const lp = await (await post("/api/remote/lanpair", { device: "Fold (bitGen app)" }, XFF)).json();
    check("the app, connecting on the Wi-Fi, is told the way in from outside: {mode: tunnel, url}", lp.state === "allowed" && lp.relay && lp.relay.mode === "tunnel" && lp.relay.url === "https://brave-red-kite.trycloudflare.com", lp);
    const KEY = lp.token;
    // through the forwarder (what Cloudflare reaches)
    const px = (p, o) => fetch(PX + p, o || {}).then(async (r) => ({ s: r.status, j: await r.json().catch(() => ({})) }));
    const noKey = await px("/api/jobs"), withKey = await px("/api/app/info", { headers: { "X-Bitgen-Key": KEY } });
    check("through the tunnel: no key = 401; the app's key = the PC", noKey.s === 401 && withKey.s === 200 && withKey.j.version, [noKey.s, withKey.s]);
    const pair = await px("/api/remote/lanpair", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }), hello = await px("/api/remote/hello");
    const local = await px("/api/apk/status", { headers: { "X-Bitgen-Key": KEY } });
    check("through the tunnel: connecting = 403, the PC's own settings = 403, only hello is open", pair.s === 403 && local.s === 403 && hello.s === 200, [pair.s, local.s, hello.s]);
    const cfHdr = await fetch(URL_ + "/api/jobs", { headers: { "cf-ray": "8a1b2c" } });
    check("a request on 127.0.0.1 with Cloudflare's own headers is not \"this computer\" (401 without the key)", cfHdr.status === 401, cfHdr.status);
    await post("/api/remote/e2e-relay", { lan_ago_ms: 7 * 3600 * 1000 });
    const away7 = await px("/api/app/info", { headers: { "X-Bitgen-Key": KEY } });
    check("through the tunnel 7 hours after the Wi-Fi: refused (away)", away7.s === 403 && away7.j.away === true, away7);
    await post("/api/remote/e2e-relay", { lan_ago_ms: 0 });

    // ---- the app away: through the tunnel; 🎙
    let lanUp = false;
    const ctx = await b.newContext({ viewport: { width: 412, height: 880 }, extraHTTPHeaders: XFF, permissions: ["microphone"] });
    await ctx.addInitScript((o) => {
      window.Capacitor = { Plugins: { LanInfo: { get: () => Promise.resolve({ wifi: false, ip: "", prefix: 0 }) } } };
      localStorage.setItem("bg.base", "http://10.9.8.42:8311"); localStorage.setItem("bg.key", o.key); localStorage.setItem("bg.pcName", "vm");
      localStorage.setItem("bg.lanAt", String(Date.now() - 60000)); localStorage.setItem("bg.relay", JSON.stringify({ mode: "tunnel", url: o.px }));
    }, { key: KEY, px: PX });
    await ctx.route(/^http:\/\/10\.9\.8\.\d+(:\d+)?\//, (rt) => (lanUp ? rt.continue() : rt.abort("addressunreachable")));
    // what Cloudflare would do: its address -> the forwarder on the PC
    await ctx.route(/^https:\/\/brave-red-kite\.trycloudflare\.com\//, async (rt) => {
      try { const r = await rt.fetch({ url: rt.request().url().replace("https://brave-red-kite.trycloudflare.com", PX) }); await rt.fulfill({ response: r }); }
      catch { await rt.abort("connectionfailed").catch(() => {}); }
    });
    await ctx.route("http://localhost/**", (rt) => {
      const u = new URL(rt.request().url());
      if (u.pathname === "/lib/build.js") return rt.fulfill({ status: 200, contentType: "text/javascript", body: 'window.BG_BUILD = {"id":"dev","version":"1.4.1"};' });
      const f = path.join(WWW, decodeURIComponent(u.pathname === "/" ? "/index.html" : u.pathname));
      if (!f.startsWith(WWW) || !fs.existsSync(f)) return rt.fulfill({ status: 404, body: "" });
      rt.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || "application/octet-stream", body: fs.readFileSync(f) });
    });
    const p = await ctx.newPage();
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto("http://localhost/index.html");
    await p.waitForFunction(() => /through Cloudflare/.test(document.getElementById("conn").textContent), null, { timeout: 30000 }).catch(() => {});
    check("the app away from the Wi-Fi: through the Cloudflare tunnel, the time left shown", /☁ vm through Cloudflare · 5 h 5\d min left/.test(await p.evaluate(() => document.getElementById("conn").textContent)),
      await p.evaluate(() => document.getElementById("conn").textContent));
    const talk = async (heard) => {
      await p.evaluate((h) => { window.BG_TEST_HEARD = h; }, heard);
      const wait = p.waitForResponse((r) => /\/api\/app\/voice$/.test(r.url()), { timeout: 60000 }).catch(() => null);
      await p.click("#talkBtn"); await p.waitForTimeout(900); await p.click("#talkBtn");
      const r = await wait; return r ? await r.json() : null;
    };
    await p.click('#tabs button[data-v="talk"]');
    const v1 = await talk("please make a video of a red kite over the sea");
    await p.waitForFunction(() => /Making a video: a red kite over the sea/.test(document.getElementById("talkLog").textContent), null, { timeout: 15000 }).catch(() => {});
    const t1 = await p.evaluate(() => ({ log: document.getElementById("talkLog").textContent, prompt: document.getElementById("prompt").value, kind: document.querySelector("#kindSeg button.on").dataset.kind }));
    check("🎙 \"make a video of …\" (through the tunnel): heard, the Create screen's prompt filled, video, Generate pressed", v1 && v1.intent === "video" && t1.prompt === "a red kite over the sea" && t1.kind === "video" && /Making a video/.test(t1.log), [v1, t1]);
    await p.waitForFunction(() => /On its way|ComfyUI|Sending|job/i.test(document.getElementById("goMsg").textContent), null, { timeout: 20000 }).catch(() => {});
    check("…and the render went to the PC", /On its way|Sending|ComfyUI/i.test(await p.evaluate(() => document.getElementById("goMsg").textContent)), await p.evaluate(() => document.getElementById("goMsg").textContent));
    await p.click('#tabs button[data-v="talk"]');
    const v2 = await talk("find cheapest flights to china");
    check("🎙 \"find …\" goes to the web search (the answer, or why not, in the conversation)", v2 && v2.intent === "find" && v2.text === "cheapest flights to china"
      && /find cheapest flights to china/.test(await p.evaluate(() => document.getElementById("talkLog").textContent)), v2);
    await p.fill("#phrases", "show me = picture"); await p.dispatchEvent("#phrases", "change");
    const v3 = await talk("show me a lighthouse in a storm");
    check("🎙 My own phrases: \"show me = picture\" -> a picture of the rest", v3 && v3.intent === "image" && v3.text === "a lighthouse in a storm", v3);
    await p.click('#tabs button[data-v="create"]');
    await p.fill("#prompt", "");
    await p.evaluate(() => { window.BG_TEST_HEARD = "a calm lake at dawn"; });
    const wd = p.waitForResponse((r) => /\/api\/app\/voice$/.test(r.url()), { timeout: 60000 }).catch(() => null);
    await p.click("#micBtn"); await p.waitForTimeout(800); await p.click("#micBtn");
    const d = await wd; const dj = d ? await d.json() : null;
    await p.waitForTimeout(400);
    check("🎙 Speak the prompt: the words into the prompt (dictation only, nothing made)", dj && dj.intent === "dictate" && (await p.inputValue("#prompt")) === "a calm lake at dawn", [dj, await p.inputValue("#prompt")]);
    check("no page errors (studio, app)", !serr.length && !errs.length, [serr, errs]);
    await ctx.close();
    await studio.selectOption("#s_remote_mode", "wifi");
    await studio.waitForTimeout(800);
    check("Remote access ▾ back to On this Wi-Fi: the tunnel stopped", !(await (await get("/api/remote/away")).cloudflare.running));
  } finally {
    await b.close();
    try { php.kill(); } catch { /* gone */ }
    await post("/api/remote/away", { mode: "none" });
    await post("/api/remote/e2e-cloudflare", { bin: "" });
    await post("/api/remote/revoke", {});
    await post("/api/remote/enable", { on: !!was.enabled });
    await post("/api/remote/e2e-bound", { host: was.bound || "127.0.0.1" });
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
