#!/usr/bin/env node
/* bitGen Studio — 2.927.0 in a REAL browser: 👂 "Hi <name>" - the 📱 app wakes on its name, the desktop names it.
 * Tim: "can we make the chat with the phone more realistic" -> "when the app is running it is listening for keywords like Hi
 * Gemma. the desktop app can give it a name in general settings".
 * 1. Settings ▸ General ▸ 🗣 The assistant: the name typed is saved (Nova), the listening switch;
 * 2. the app (paired on the "Wi-Fi", Chromium's fake microphone): 👂 lit = listening; "Hey Nova" (what was heard comes from
 *    BG_wakeTest - the PC honours test_heard only in its test mode) -> the Talk screen, a short reply, the conversation;
 *    ✕ End -> 👂 listening again; "Hi Nova, what is the capital of France" -> answered at once, the LLM told its name;
 *    something else -> nothing; 👂 tapped -> off (kept); the desktop's switch off -> no 👂.
 * Against the running app (H3_URL, default the e2e server on :8311): the app's own pages (mobile/www) in Chromium, paired on
 * the "Wi-Fi", Chromium's fake microphone; what was said comes from BG_TEST_HEARD (the PC honours it in its test mode only);
 * a stand-in LLM (scripts/stub-llm.py) records what it was told. No Playwright = SKIP. */
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
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const post = (p, b, h) => fetch(URL_ + p, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, h || {}), body: JSON.stringify(b || {}) });
const get = (p) => fetch(URL_ + p).then((r) => r.json());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  try { const r = await fetch(URL_ + "/"); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL_); process.exit(0); }
  if (!chromium) { console.log("SKIP: playwright is not installed here"); return; }
  const was = await get("/api/remote/status"), cfg0 = await get("/api/config"), as0 = await get("/api/app/assistant").catch(() => null);
  if (!as0 || !as0.name) { console.log("SKIP: this studio has no /api/app/assistant"); return; }
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg927-")), LOG = path.join(T, "llm");
  const llmPort = 8460 + Math.floor(Math.random() * 20);
  const llm = spawn("python3", [path.join(__dirname, "stub-llm.py"), String(llmPort), LOG], { stdio: "ignore" });
  await sleep(600);
  const lastSys = () => {
    const f = fs.existsSync(LOG) ? fs.readdirSync(LOG).filter((x) => /^llm_request_\d+\.json$/.test(x)).sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]) : [];
    if (!f.length) return { n: 0, sys: "" };
    const j = JSON.parse(fs.readFileSync(path.join(LOG, f[f.length - 1]), "utf8"));
    return { n: f.length, sys: ((j.messages || [])[0] || {}).content || "" };
  };
  const b = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
    "--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests"] });
  try {
    // ---- 1. the desktop names it
    const d = await b.newPage({ viewport: { width: 1500, height: 1000 } });
    const derrs = []; d.on("pageerror", (e) => derrs.push(e.message));
    await d.goto(URL_ + "/", { waitUntil: "domcontentloaded" });
    await d.waitForFunction(() => document.getElementById("asName") && document.getElementById("asName").value, null, { timeout: 60000 }).catch(() => {});
    const ui = await d.evaluate(() => ({ inGeneral: !!document.querySelector("#stab-general #as_box"), afterApp: !!(document.getElementById("apk_box") && document.getElementById("apk_box").nextElementSibling && document.getElementById("apk_box").nextElementSibling.id === "as_box"), name: document.getElementById("asName").value, wake: document.getElementById("asWake").checked, say: document.getElementById("asSay").textContent }));
    check("Settings ▸ General ▸ 🗣 The assistant, under 📱 The bitGen App: the name and \"The app listens for 'Hi …'\"", ui.inGeneral && ui.afterApp && ui.name === as0.name && ui.wake === as0.wake && ui.say === '"Hi ' + as0.name + '"', ui);
    await d.evaluate(() => { const i = document.getElementById("asName"); i.value = "Nova"; i.dispatchEvent(new Event("input")); });
    await d.evaluate(() => { const c = document.getElementById("asWake"); if (!c.checked) { c.checked = true; c.dispatchEvent(new Event("change")); } });
    let s = null; for (let i = 0; i < 20; i++) { s = await get("/api/app/assistant"); if (s.name === "Nova" && s.wake) break; await sleep(300); }
    check("typing \"Nova\" saves it on the PC (a moment after), listening on; the line says \"Hi Nova\"", s.name === "Nova" && s.wake === true && await d.evaluate(() => document.getElementById("asSay").textContent) === '"Hi Nova"', s);
    check("no page errors in the studio", derrs.length === 0, derrs);
    await d.close();

    // ---- 2. the app
    await post("/api/config", { llm: { external_url: "http://127.0.0.1:" + llmPort + "/v1/chat/completions" } });
    await post("/api/voice/stream/e2e", { on: false }).catch(() => {});
    await post("/api/remote/revoke", {});
    await post("/api/remote/enable", { on: true });
    await post("/api/remote/e2e-bound", { host: "0.0.0.0" });
    await post("/api/remote/away", { mode: "none" });
    await post("/api/remote/lanpair/window", {});
    const KEY = (await (await post("/api/remote/lanpair", { device: "Fold (bitGen app)" }, XFF)).json()).token;
    const ctx = await b.newContext({ viewport: { width: 412, height: 880 }, extraHTTPHeaders: XFF, permissions: ["microphone"] });
    await ctx.addInitScript((o) => {
      window.Capacitor = { Plugins: { LanInfo: { get: () => Promise.resolve({ wifi: true, ip: "10.9.8.7", prefix: 24 }) } } };
      localStorage.setItem("bg.base", "http://10.9.8.42:" + o.port); localStorage.setItem("bg.key", o.key); localStorage.setItem("bg.pcName", "vm"); localStorage.setItem("bg.lanAt", String(Date.now()));
      localStorage.setItem("bg.talkSpeak", "0");
    }, { key: KEY, port: new URL(URL_).port });
    await ctx.route(/^http:\/\/10\.9\.8\.\d+(:\d+)?\//, (rt) => { const u = new URL(rt.request().url()); return u.host === PC ? rt.continue({ url: rt.request().url().replace("//" + PC, "//" + new URL(URL_).host) }) : rt.abort("addressunreachable"); });
    await ctx.route("http://localhost/**", (rt) => {
      const u = new URL(rt.request().url());
      if (u.pathname === "/lib/build.js") return rt.fulfill({ status: 200, contentType: "text/javascript", body: 'window.BG_BUILD = {"id":"dev","version":"1.12.0"};' });
      const f = path.join(WWW, decodeURIComponent(u.pathname === "/" ? "/index.html" : u.pathname));
      if (!f.startsWith(WWW) || !fs.existsSync(f)) return rt.fulfill({ status: 404, body: "" });
      rt.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || "application/octet-stream", body: fs.readFileSync(f) });
    });
    const p = await ctx.newPage();
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const wakes = []; p.on("request", (r) => { if (/\/api\/app\/wake$/.test(r.url())) wakes.push(r.url()); });
    await p.goto("http://localhost/index.html");
    await p.waitForFunction(() => /● 10\.9\.8\.42/.test(document.getElementById("conn").textContent), null, { timeout: 30000 }).catch(() => {});
    await p.waitForFunction(() => document.getElementById("wakeBtn").getAttribute("aria-pressed") === "true", null, { timeout: 15000 }).catch(() => {});
    const w1 = await p.evaluate(() => { const x = document.getElementById("wakeBtn"); return { hidden: x.hidden, on: x.getAttribute("aria-pressed"), title: x.title }; });
    check("the app: 👂 in the top bar, lit - listening for \"Hi Nova\" while it is open", !w1.hidden && w1.on === "true" && /Hi Nova/.test(w1.title), w1);

    await p.evaluate(() => { window.__said = []; window.speechSynthesis.speak = (u) => { window.__said.push(u.text); setTimeout(() => u.onend && u.onend(), 10); }; });
    await p.evaluate(() => window.BG_wakeTest("Hey Nova"));
    await p.waitForFunction(() => !document.getElementById("v-talk").hidden && document.getElementById("talkLog").textContent.length > 0 && !document.getElementById("talkEnd").hidden, null, { timeout: 20000 }).catch(() => {});
    const t1 = await p.evaluate(() => ({ talk: !document.getElementById("v-talk").hidden, log: document.getElementById("talkLog").textContent, live: !document.getElementById("talkEnd").hidden, wake: document.getElementById("wakeBtn").getAttribute("aria-pressed") }));
    check("\"Hey Nova\" -> the Talk screen opens by itself, it answers (\"Yes?\" …) and the conversation is on; 👂 off while it talks", t1.talk && /Hey Nova/.test(t1.log) && /Yes\?|listening|What's up|Mm-hm/.test(t1.log) && t1.live && t1.wake === "false", t1);
    await p.evaluate(() => document.getElementById("talkEnd").click());
    await p.waitForFunction(() => document.getElementById("wakeBtn").getAttribute("aria-pressed") === "true", null, { timeout: 15000 }).catch(() => {});
    check("✕ End -> 👂 listening for its name again", await p.evaluate(() => document.getElementById("wakeBtn").getAttribute("aria-pressed")) === "true");

    const n0 = lastSys().n;
    await p.evaluate(() => window.BG_wakeTest("Hi Nova, what is the capital of France?"));
    await p.waitForFunction(() => /capital of France/.test(document.getElementById("talkLog").textContent) && document.querySelectorAll("#talkLog .pc, #talkLog [data-who=pc]").length >= 0, null, { timeout: 30000 }).catch(() => {});
    for (let i = 0; i < 40 && lastSys().n === n0; i++) await sleep(250);
    await sleep(800);
    const t2 = await p.evaluate(() => ({ log: document.getElementById("talkLog").textContent, live: !document.getElementById("talkEnd").hidden }));
    const s2 = lastSys();
    check("\"Hi Nova, what is the capital of France?\" -> answered at once by the PC's LLM, the conversation goes on", s2.n > n0 && /capital of France/.test(t2.log) && t2.live, { log: t2.log.slice(-300), n: s2.n });
    check("…the LLM is told its name (\"Your name is Nova\")", /Your name is Nova/.test(s2.sys), s2.sys.slice(0, 300));
    await p.evaluate(() => document.getElementById("talkEnd").click());
    await p.waitForFunction(() => document.getElementById("wakeBtn").getAttribute("aria-pressed") === "true", null, { timeout: 15000 }).catch(() => {});

    const logLen = await p.evaluate(() => document.getElementById("talkLog").textContent.length);
    await p.evaluate(() => window.BG_wakeTest("the weather is nice today"));
    await sleep(1500);
    check("something else heard -> nothing happens (still listening)", await p.evaluate((n) => document.getElementById("talkLog").textContent.length === n && document.getElementById("talkEnd").hidden && document.getElementById("wakeBtn").getAttribute("aria-pressed") === "true", logLen));
    check("every burst went to the PC's /api/app/wake (never the relay)", wakes.length >= 3 && wakes.every((u) => /10\.9\.8\.42/.test(u)), wakes.slice(0, 4));

    await p.evaluate(() => document.getElementById("wakeBtn").click());
    await sleep(300);
    check("👂 tapped -> not listening (kept on the phone)", await p.evaluate(() => document.getElementById("wakeBtn").getAttribute("aria-pressed") === "false" && localStorage.getItem("bg.wake") === "0"));
    await p.evaluate(() => document.getElementById("wakeBtn").click());
    await post("/api/app/assistant", { wake: false });
    await p.reload(); await p.waitForFunction(() => /● 10\.9\.8\.42/.test(document.getElementById("conn").textContent), null, { timeout: 30000 }).catch(() => {});
    await sleep(800);
    check("the desktop's switch off -> no 👂 on the app, not listening", await p.evaluate(() => document.getElementById("wakeBtn").hidden && document.getElementById("wakeBtn").getAttribute("aria-pressed") === "false"));
    check("no page errors in the app", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally {
    await b.close();
    try { llm.kill(); } catch { /* gone */ }
    try { await post("/api/app/assistant", { name: as0.name, wake: as0.wake }); } catch { /* fine */ }
    try { await post("/api/config", { llm: { external_url: ((cfg0.llm || {}).external_url) || "" } }); } catch { /* fine */ }
    try { await post("/api/remote/revoke", {}); await post("/api/remote/enable", { on: !!was.enabled }); await post("/api/remote/e2e-bound", { host: was.bound || "127.0.0.1" }); } catch { /* fine */ }
    fs.rmSync(T, { recursive: true, force: true });
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
