#!/usr/bin/env node
/* bitGen Studio — 2.921.0 in a REAL browser: the 📱 app's 🎙 Talk - a question for the LLM, 🌐 Web, 🧑‍💼 Assistant / 🤝 Friend.
 * Tim: "in the android app when user speaks check keywords, find , search, what is? etc. Let's have a chat, what's? will question
 * the llm. add a web button so it searches the internet. act as a personal assistant or just have a chat as a friend . speak
 * back to me".
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
  const was = await get("/api/remote/status"), cfg0 = await get("/api/config");
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg921-")), LOG = path.join(T, "llm");
  const llmPort = 8440 + Math.floor(Math.random() * 20);
  const llm = spawn("python3", [path.join(__dirname, "stub-llm.py"), String(llmPort), LOG], { stdio: "ignore" });
  await sleep(600);
  /** the system message of the LLM's newest request */
  const lastSys = () => {
    const f = fs.existsSync(LOG) ? fs.readdirSync(LOG).filter((x) => /^llm_request_\d+\.json$/.test(x)).sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]) : [];
    if (!f.length) return { n: 0, sys: "" };
    const j = JSON.parse(fs.readFileSync(path.join(LOG, f[f.length - 1]), "utf8"));
    return { n: f.length, sys: ((j.messages || [])[0] || {}).content || "" };
  };
  const b = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
    "--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests"] });
  try {
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
      localStorage.setItem("bg.talkSpeak", "0");                                     // headless: nothing to say it with (speak() is checked below)
    }, { key: KEY, port: new URL(URL_).port });
    await ctx.route(/^http:\/\/10\.9\.8\.\d+(:\d+)?\//, (rt) => { const u = new URL(rt.request().url()); return u.host === PC ? rt.continue({ url: rt.request().url().replace("//" + PC, "//" + new URL(URL_).host) }) : rt.abort("addressunreachable"); });
    await ctx.route("http://localhost/**", (rt) => {
      const u = new URL(rt.request().url());
      if (u.pathname === "/lib/build.js") return rt.fulfill({ status: 200, contentType: "text/javascript", body: 'window.BG_BUILD = {"id":"dev","version":"1.9.0"};' });
      const f = path.join(WWW, decodeURIComponent(u.pathname === "/" ? "/index.html" : u.pathname));
      if (!f.startsWith(WWW) || !fs.existsSync(f)) return rt.fulfill({ status: 404, body: "" });
      rt.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || "application/octet-stream", body: fs.readFileSync(f) });
    });
    const p = await ctx.newPage();
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const sent = []; p.on("request", (r) => { if (/\/api\/app\/voice$/.test(r.url())) sent.push(r.postData() || ""); });
    await p.goto("http://localhost/index.html");
    await p.waitForFunction(() => /● 10\.9\.8\.42/.test(document.getElementById("conn").textContent), null, { timeout: 30000 }).catch(() => {});
    await p.click('#tabs button[data-v="talk"]');
    const ui = await p.evaluate(() => ({ seg: [...document.querySelectorAll("#personaSeg button")].map((x) => x.textContent + (x.classList.contains("on") ? "*" : "")), web: document.getElementById("talkWeb").getAttribute("aria-pressed") }));
    check("the Talk screen: 🧑‍💼 Assistant (picked) | 🤝 Friend and 🌐 Web (off)", ui.seg.join("|") === "🧑‍💼 Assistant*|🤝 Friend" && ui.web === "false", ui);
    const talk = async (heard) => {
      await p.evaluate((h) => { window.BG_TEST_HEARD = h; }, heard);
      const wait = p.waitForResponse((r) => /\/api\/app\/voice$/.test(r.url()), { timeout: 60000 }).catch(() => null);
      if (!/I'm done/.test(await p.textContent("#talkBtn"))) { await p.click("#talkBtn"); await p.waitForFunction(() => /I'm done/.test(document.getElementById("talkBtn").textContent), null, { timeout: 10000 }).catch(() => {}); }
      await p.waitForTimeout(700); await p.click("#talkBtn");
      const r = await wait; const j = r ? await r.json() : null;
      await p.waitForFunction(() => /I'm done/.test(document.getElementById("talkBtn").textContent) || document.getElementById("talkEnd").hidden, null, { timeout: 30000 }).catch(() => {});
      return j;
    };
    const end = async () => { await p.evaluate(() => { const e = document.getElementById("talkEnd"); if (!e.hidden) e.click(); }); await p.waitForTimeout(300); };
    // the phone's voice: speak() is what reads the answer - counted while 🔊 is on
    await p.evaluate(() => { window.__said = []; window.speechSynthesis.speak = (u) => { window.__said.push(u.text); setTimeout(() => u.onend && u.onend(), 10); }; });
    await p.check("#talkSpeak");

    const q1 = await talk("what is the capital of France");
    const s1 = lastSys();
    check("🎙 \"what is the capital of France\": a question for the PC's LLM (🌐 off = no web), as the assistant", q1 && q1.intent === "ask" && q1.persona === "assistant" && q1.web === false && q1.reply
      && /personal assistant/.test(s1.sys) && /answer it directly/.test(s1.sys) && !/You can search the web/.test(s1.sys), { q1, sys: s1.sys.slice(0, 300) });
    check("...the form carried web=0 and persona=assistant", /name="web"\r\n\r\n0/.test(sent[0] || "") && /name="persona"\r\n\r\nassistant/.test(sent[0] || ""));
    await p.waitForTimeout(400);
    const said1 = await p.evaluate(() => window.__said.slice());
    check("...the answer is SAID out loud, and it listens again (a conversation)", said1.length >= 1 && said1[0].length > 0 && /I'm done/.test(await p.textContent("#talkBtn")), said1);
    await end();

    await p.click("#talkWeb");
    const w = await p.evaluate(() => ({ a: document.getElementById("talkWeb").getAttribute("aria-pressed"), k: localStorage.getItem("bg.talkWeb"), m: document.getElementById("talkMsg").textContent }));
    check("🌐 Web on: pressed, kept on the phone, said what it does", w.a === "true" && w.k === "1" && /search the internet/.test(w.m), w);
    const q2 = await talk("what's the weather in Perth tomorrow");
    const s2 = lastSys();
    check("🎙 \"what's the weather in Perth tomorrow\" with 🌐 on: the web tools (the LLM told it may search)", q2 && q2.intent === "ask" && q2.web === true && /You can search the web/.test(s2.sys) && /web_search/.test(s2.sys), { q2, sys: s2.sys.slice(-400) });
    await end();

    const f1 = await talk("let's have a chat");
    const s3 = lastSys();
    const seg = await p.evaluate(() => ({ on: document.querySelector("#personaSeg button.on").dataset.p, k: localStorage.getItem("bg.persona"), log: document.getElementById("talkLog").textContent }));
    check("🎙 \"let's have a chat\": 🤝 the friend - the buttons move, it is kept, a friendly hello", f1 && f1.intent === "persona" && f1.persona === "friend" && seg.on === "friend" && seg.k === "friend" && /🤝/.test(seg.log) && /as a friend/.test(s3.sys), { f1, seg: seg.on });
    const f2 = await talk("I had a long day at work");
    check("...the next turn goes as the friend (persona=friend sent)", f2 && f2.intent === "chat" && f2.persona === "friend" && /as a friend/.test(lastSys().sys) && /name="persona"\r\n\r\nfriend/.test(sent[sent.length - 1] || ""), f2);
    await end();
    await p.click('#personaSeg button[data-p="assistant"]');
    check("a tap on 🧑‍💼 Assistant switches back (kept)", await p.evaluate(() => localStorage.getItem("bg.persona") === "assistant" && document.querySelector("#personaSeg button.on").dataset.p === "assistant"));
    const f3 = await talk("find cheapest flights to china");
    check("\"find …\" still searches the web", f3 && f3.intent === "find" && f3.web === true, f3);
    await end();
    check("no page errors", errs.length === 0, errs);
    await ctx.close();
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally {
    await b.close();
    try { llm.kill(); } catch { /* gone */ }
    try { await post("/api/config", { llm: { external_url: ((cfg0.llm || {}).external_url) || "" } }); } catch { /* fine */ }
    try { await post("/api/remote/revoke", {}); await post("/api/remote/enable", { on: !!was.enabled }); await post("/api/remote/e2e-bound", { host: was.bound || "127.0.0.1" }); } catch { /* fine */ }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
