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
  // a stand-in LLM (the chat turn of a conversation)
  const llmPort = 8420 + Math.floor(Math.random() * 20);
  const llm = spawn("python3", [path.join(__dirname, "stub-llm.py"), String(llmPort), path.join(T, "llm")], { stdio: "ignore" });
  const cfg0 = await get("/api/config");
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
    const ctx = await b.newContext({ viewport: { width: 412, height: 880 }, extraHTTPHeaders: XFF, permissions: ["microphone"], hasTouch: true });
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
      // 2.915.0: a conversation - the first tap starts it (listening), a tap while it listens sends what was said
      if (!/I'm done/.test(await p.textContent("#talkBtn"))) { await p.click("#talkBtn"); await p.waitForFunction(() => /I'm done/.test(document.getElementById("talkBtn").textContent), null, { timeout: 10000 }).catch(() => {}); }
      await p.waitForTimeout(700); await p.click("#talkBtn");
      const r = await wait; return r ? await r.json() : null;
    };
    const swipe = (x0, y0, x1, y1) => p.evaluate((a) => {
      const v = document.getElementById("viewer"), T = (x, y) => new Touch({ identifier: 1, target: v, clientX: x, clientY: y });
      v.dispatchEvent(new TouchEvent("touchstart", { touches: [T(a[0], a[1])], changedTouches: [T(a[0], a[1])], bubbles: true }));
      v.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [T(a[2], a[3])], bubbles: true }));
    }, [x0, y0, x1, y1]);
    await p.click('#tabs button[data-v="talk"]');
    await p.uncheck("#talkSpeak");                                                   // headless: nothing to say it with
    const v1 = await talk("please make a video of a red kite over the sea");
    await p.waitForFunction(() => /Making a video: a red kite over the sea/.test(document.getElementById("talkLog").textContent), null, { timeout: 15000 }).catch(() => {});
    const t1 = await p.evaluate(() => ({ log: document.getElementById("talkLog").textContent, prompt: document.getElementById("prompt").value, kind: document.querySelector("#kindSeg button.on").dataset.kind }));
    check("🎙 \"make a video of …\" (through the tunnel): heard, the Create screen's prompt filled, video, Generate pressed", v1 && v1.intent === "video" && t1.prompt === "a red kite over the sea" && t1.kind === "video" && /Making a video/.test(t1.log), [v1, t1]);
    await p.waitForFunction(() => /On its way|ComfyUI|Sending|job/i.test(document.getElementById("goMsg").textContent), null, { timeout: 20000 }).catch(() => {});
    check("…and the render went to the PC", /On its way|Sending|ComfyUI/i.test(await p.evaluate(() => document.getElementById("goMsg").textContent)), await p.evaluate(() => document.getElementById("goMsg").textContent));
    check("…a made thing ends the conversation (\"🎙 Talk\" again, no ✕ End)", await p.evaluate(() => /🎙 Talk/.test(document.getElementById("talkBtn").textContent) && document.getElementById("talkEnd").hidden));
    // 2.915.0: the result opens by itself; swipe through that kind's Gallery; swipe up = back to Create
    await p.waitForFunction(() => !document.getElementById("viewer").hidden && document.querySelector("#vBody video"), null, { timeout: 150000 }).catch(() => {});
    const vw = await p.evaluate(() => ({ open: !document.getElementById("viewer").hidden, name: document.getElementById("vName").textContent, vid: !!document.querySelector("#vBody video"), pos: document.getElementById("vPos").textContent }));
    check("after Generate the video it made opens by itself, with the Gallery's videos to swipe", vw.open && /\.(mp4|webm|mov)$/.test(vw.name) && vw.vid && /swipe/.test(vw.pos), vw);
    const many = /^1 \/ (\d+)/.exec(vw.pos);
    if (many && +many[1] > 1) {
      await swipe(330, 400, 80, 410);
      await p.waitForTimeout(300);
      check("swipe left: the next one", /^2 \//.test(await p.textContent("#vPos")) && (await p.textContent("#vName")) !== vw.name, await p.textContent("#vPos"));
      await swipe(80, 400, 330, 410);
      await p.waitForTimeout(300);
      check("swipe right: back to the first", (await p.textContent("#vName")) === vw.name);
    } else console.log("SKIP (swipe sideways): one video in the Gallery");
    await swipe(200, 650, 210, 250);
    await p.waitForTimeout(300);
    check("swipe up: back to the Create screen", await p.evaluate(() => document.getElementById("viewer").hidden && !document.getElementById("v-create").hidden));
    await p.click('#tabs button[data-v="talk"]');
    const v2 = await talk("find cheapest flights to china");
    check("🎙 \"find …\" goes to the web search (the answer, or why not, in the conversation)", v2 && v2.intent === "find" && v2.text === "cheapest flights to china"
      && /find cheapest flights to china/.test(await p.evaluate(() => document.getElementById("talkLog").textContent)), v2);
    if (!(v2 && v2.error)) {
      await p.waitForFunction(() => /I'm done/.test(document.getElementById("talkBtn").textContent), null, { timeout: 20000 }).catch(() => {});
      check("…an answer, then it listens again by itself (a conversation)", /I'm done/.test(await p.textContent("#talkBtn")) && !(await p.isHidden("#talkEnd")));
    } else console.log("SKIP (listens again after find): " + v2.error);
    // a chat turn (the stand-in LLM): the answer, then it listens again - a conversation
    await post("/api/config", { llm: { external_url: "http://127.0.0.1:" + llmPort + "/v1/chat/completions" } });
    if (/I'm done/.test(await p.textContent("#talkBtn"))) { await p.click("#talkEnd"); await p.waitForTimeout(300); }
    const vc = await talk("how are you today");
    await p.waitForFunction(() => /I'm done/.test(document.getElementById("talkBtn").textContent), null, { timeout: 30000 }).catch(() => {});
    check("💬 a chat: the PC's LLM answers, then the app listens again by itself (a conversation)", vc && vc.intent === "chat" && vc.reply && /I'm done/.test(await p.textContent("#talkBtn")) && !(await p.isHidden("#talkEnd")), vc);
    await p.fill("#phrases", "show me = picture"); await p.dispatchEvent("#phrases", "change");
    const v3 = await talk("show me a lighthouse in a storm");
    check("🎙 My own phrases: \"show me = picture\" -> a picture of the rest", v3 && v3.intent === "image" && v3.text === "a lighthouse in a storm", v3);
    await p.waitForTimeout(1500); await p.keyboard.press("Escape");             // the picture may have opened
    await p.click('#tabs button[data-v="talk"]');
    const v4 = await talk("okay goodbye");
    await p.waitForFunction(() => /talk to you later/.test(document.getElementById("talkLog").textContent) && document.getElementById("talkEnd").hidden, null, { timeout: 15000 }).catch(() => {});
    check("🎙 \"goodbye\": the conversation ends with a goodbye (no LLM needed)", v4 && v4.intent === "bye" && /talk to you later/.test(await p.textContent("#talkLog")) && /🎙 Talk/.test(await p.textContent("#talkBtn")), v4);
    // 🎵 a song in the viewer: a random visualisation (a stand-in song in a stand-in Gallery)
    const wav = (() => { const n = 22050, d = Buffer.alloc(44 + n * 2); d.write("RIFF", 0); d.writeUInt32LE(36 + n * 2, 4); d.write("WAVEfmt ", 8); d.writeUInt32LE(16, 16); d.writeUInt16LE(1, 20); d.writeUInt16LE(1, 22);
      d.writeUInt32LE(22050, 24); d.writeUInt32LE(44100, 28); d.writeUInt16LE(2, 32); d.writeUInt16LE(16, 34); d.write("data", 36); d.writeUInt32LE(n * 2, 40);
      for (let i = 0; i < n; i++) d.writeInt16LE(Math.round(9000 * Math.sin(i / 8)), 44 + i * 2); return d; })();
    await p.route(/\/api\/outputs\?kind=audio/, (rt) => rt.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "http://localhost" }, body: JSON.stringify([{ name: "song_a.wav" }, { name: "song_b.wav" }]) }));
    await p.route(/\/outputs\/song_[ab]\.wav/, (rt) => rt.fulfill({ status: 200, contentType: "audio/wav", headers: { "Access-Control-Allow-Origin": "http://localhost" }, body: wav }));
    await p.click('#tabs button[data-v="gallery"]');
    await p.click('#galSeg button[data-g="audio"]');
    await p.waitForSelector("#gal .g", { timeout: 15000 }).catch(() => {});
    await p.click("#gal .g");
    await p.waitForTimeout(1500);
    const vz = await p.evaluate(() => { const c = document.querySelector("#vBody canvas.viz"); if (!c) return null; const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let lit = 0; for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] > 60) lit++; return { lit, audio: !!document.querySelector("#vBody audio"), pos: document.getElementById("vPos").textContent }; });
    check("🎵 a song in the viewer: a moving visualisation + the player, the songs to swipe", vz && vz.lit > 20 && vz.audio && /1 \/ 2/.test(vz.pos), vz);
    await p.keyboard.press("ArrowUp");
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
    // 2.915.0: the "wants to connect" bar shows ABOVE the open Settings dialog and goes at once on ✔ Allow
    await studio.evaluate(() => { if (!document.getElementById("settings").open) document.getElementById("openSettings").click(); });
    await post("/api/remote/lanpair", { device: "Another phone (bitGen app)" }, XFF);
    await studio.waitForFunction(() => { const x = document.getElementById("lp_bar"); return x && x.style.display !== "none" && x.matches(":popover-open"); }, null, { timeout: 10000 }).catch(() => {});
    const top = await studio.evaluate(() => { const x = document.getElementById("lp_bar"), r = x.getBoundingClientRect(), at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { pop: x.matches(":popover-open"), onTop: !!(at && x.contains(at)), dlg: document.getElementById("settings").open }; });
    check("the bar: a popover above the open Settings dialog", top.pop && top.onTop && top.dlg, top);
    await studio.click("#lp_deny");
    check("…✕ Deny hides it at once", await studio.evaluate(() => { const x = document.getElementById("lp_bar"); return x.style.display === "none" && !x.matches(":popover-open"); }));
    // 2.914.1: the state line is honest; Skills has its own tab
    const f1 = await studio.evaluate(() => [bgRemoteUI.fmt({ enabled: true, lan: "x", connected: true, device: "Fold (bitGen app)", app: true, idle_seconds: 7200 }),
      bgRemoteUI.fmt({ enabled: true, lan: "x", connected: true, device: "Fold (bitGen app)", app: true, idle_seconds: 20 })]);
    check("the state line: an app not heard from for 2 h is \"paired, not connected\"; one heard from 20 s ago is connected", /📱 Fold is paired, not connected - last seen 2 h ago/.test(f1[0]) && /📱 Fold is connected \(the bitGen app\)/.test(f1[1]), f1);
    check("Settings ▸ General has ONE connect button", await studio.evaluate(() => !!document.getElementById("s_remote_connect") && document.getElementById("s_remote_link").hidden && document.getElementById("s_remote_off").hidden && !document.getElementById("lp_window")));
    await studio.click('[data-stab="skills"]');
    await studio.waitForTimeout(300);
    check("Settings ▸ Skills: its own tab with the skills", await studio.evaluate(() => { const b = document.getElementById("s_skNew"); return !!b && b.offsetParent !== null && document.getElementById("stab-skills").classList.contains("active"); }));
    await studio.click('[data-stab="general"]');
    await studio.selectOption("#s_remote_mode", "wifi");
    await studio.waitForTimeout(800);
    check("Remote access ▾ back to On this Wi-Fi: the tunnel stopped", !(await (await get("/api/remote/away")).cloudflare.running));
  } finally {
    await b.close();
    try { php.kill(); } catch { /* gone */ }
    try { llm.kill(); } catch { /* gone */ }
    await post("/api/config", { llm: { external_url: ((cfg0.llm || {}).external_url) || "" } });
    await post("/api/remote/away", { mode: "none" });
    await post("/api/remote/e2e-cloudflare", { bin: "" });
    await post("/api/remote/revoke", {});
    await post("/api/remote/enable", { on: !!was.enabled });
    await post("/api/remote/e2e-bound", { host: was.bound || "127.0.0.1" });
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
