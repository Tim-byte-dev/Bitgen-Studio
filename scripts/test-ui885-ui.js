#!/usr/bin/env node
/* bitGen Studio — 2.885.0 in a REAL browser: 🌐 web search for the LLM - Settings ▸ General's block (☐ Use Brave Search off by
 * default, the key saved encrypted and never shown back - only its last 4 letters, SearXNG, the safety words), the prompt docker's
 * 🌐 toggle (kept), a chat turn sending context.web, the activity route.
 * Tim (verbatim): "add brave but put in in settings-general tab with a checkbox , it will be off by default and user can select it
 * and enter an api key. can we have security filters in place so no malicious scripts can be run" */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let sent = null;
  try {
    await p.route("**/api/chat", async (route) => { const r = route.request(); try { sent = JSON.parse(r.postData() || "{}"); } catch { sent = { raw: r.postData() }; }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ session: "s", reply: "Sourdough is bread [1].\n\nSources:\n[1] Sourdough — https://en.wikipedia.org/wiki/Sourdough", web: { steps: [{ tool: "web_search", ok: true }], sources: [], warnings: [] } }) }); });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3WebSearchSet && window.H3WebTools, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(async () => { await fetch("/api/websearch/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ braveOn: false, braveKey: "", searxngUrl: "" }) }); });
    await ev(() => { document.getElementById("openSettings").click(); });
    await p.waitForTimeout(500);
    await ev(() => { const t = [...document.querySelectorAll("#settingsDlg .tabs button, [data-stab]")].find((x) => /General/.test(x.textContent)); if (t) t.click(); });
    await p.waitForSelector("#s_wsBrave", { state: "attached" });
    await p.waitForTimeout(600);
    const s0 = await ev(() => ({ on: document.getElementById("s_wsBrave").checked, keyType: document.getElementById("s_wsKey").type, status: document.getElementById("s_wsStatus").textContent, safety: document.getElementById("s_websearch").textContent }));
    check("Settings ▸ General ▸ 🌐 Web search: ☐ Use Brave Search OFF by default, the key a password field, 'searching with: Wikipedia', the safety words", !s0.on && s0.keyType === "password" && /searching with: Wikipedia/.test(s0.status) && /Nothing from the web is downloaded, installed or run/.test(s0.safety.replace(/\s+/g, " ")), s0);
    await ev(async () => { const k = document.getElementById("s_wsKey"); k.focus(); k.value = "BSAtestKEY9876"; k.dispatchEvent(new Event("input")); k.blur(); });
    await p.waitForTimeout(1600);
    const s1 = await ev(async () => ({ v: document.getElementById("s_wsKey").value, ph: document.getElementById("s_wsKey").placeholder, api: await (await fetch("/api/websearch/settings")).json(), cfg: JSON.stringify(await (await fetch("/api/config")).json()) }));
    check("the key typed: saved, the box emptied, '…9876' shown - the key itself never comes back (settings or /api/config); still not on", s1.v === "" && /…9876/.test(s1.ph) && s1.api.brave.hasKey && !s1.api.brave.on && s1.api.engine === "wikipedia" && !/BSAtestKEY/.test(JSON.stringify(s1.api)) && !/BSAtestKEY/.test(s1.cfg), { v: s1.v, ph: s1.ph, api: s1.api });
    await p.check("#s_wsBrave"); await p.waitForTimeout(700);
    const s2 = await ev(async () => ({ api: await (await fetch("/api/websearch/settings")).json(), status: document.getElementById("s_wsStatus").textContent }));
    check("ticked: searching with Brave Search", s2.api.engine === "brave" && /Brave Search/.test(s2.status), s2);
    await p.uncheck("#s_wsBrave"); await p.waitForTimeout(500);
    await ev(() => { const d = document.querySelector("dialog[open]"); if (d) d.close(); });
    // the prompt docker's 🌐
    await ev(() => { localStorage.setItem("h3.chat.web", "0"); });
    const t0 = await ev(() => ({ has: !!document.getElementById("ptWeb"), on: H3WebTools.on() }));
    await ev(() => document.getElementById("ptWeb").click());
    const t1 = await ev(() => ({ on: H3WebTools.on(), pressed: document.getElementById("ptWeb").getAttribute("aria-pressed"), kept: localStorage.getItem("h3.chat.web") }));
    check("the prompt docker's 🌐: off until pressed; pressed = on, kept", t0.has && !t0.on && t1.on && t1.pressed === "true" && t1.kept === "1", { t0, t1 });
    await ev(() => window.chatPost("what is sourdough?", "", null));
    check("a chat turn with 🌐 on sends context.web = true", sent && sent.context && sent.context.web === true, sent);
    await ev(() => document.getElementById("ptWeb").click());
    await ev(() => window.chatPost("hello", "", null));
    check("...off: no web flag", sent && sent.context && !sent.context.web, sent && sent.context);
    const act = await ev(async () => (await fetch("/api/websearch/activity")).json());
    check("GET /api/websearch/activity answers {busy, steps}", act && act.busy === false && Array.isArray(act.steps), act);
    const bad = await ev(async () => (await fetch("/api/websearch/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ searxngUrl: "ftp://x" }) })).status);
    check("a bad SearXNG address is refused (400)", bad === 400, bad);
    await ev(async () => { await fetch("/api/websearch/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ braveOn: false, braveKey: "", searxngUrl: "" }) }); });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran: " + e.message, false); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
