#!/usr/bin/env node
/* bitGen Studio — 2.887.0 in a REAL browser: 🧰 files and commands for the LLM. Settings ▸ General ▸ 🧰 (the folder, a bad folder
 * refused with why, the time limit, 📜 Log), the prompt docker's 🧰 toggle (kept, chatPost sends context.files), and the yes / no
 * box: a change shown as a diff (red out, green in) - ✔ Yes / ✔ Yes to all / ✕ No posted to /api/agent/answer; a command shown
 * with its folder and time limit (no "yes to all" for commands); No is the focused button.
 * The plan Tim went with: "abilities like claude code gives" - 2.887.0 file tools + commands with approvals. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os");
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
  const WORK = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ui887-")));
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let sent = null; const answers = []; let fakeAsks = [];
  try {
    await p.route("**/api/chat", async (route) => { const r = route.request(); try { sent = JSON.parse(r.postData() || "{}"); } catch { sent = { raw: r.postData() }; }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ session: "s", reply: "Done.", web: { steps: [], sources: [], warnings: [], changes: [], commands: [] } }) }); });
    await p.route("**/api/agent/asks", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ asks: fakeAsks }) }));
    await p.route("**/api/agent/answer", async (route) => { answers.push(JSON.parse(route.request().postData() || "{}")); fakeAsks = fakeAsks.filter((a) => a.id !== answers[answers.length - 1].id); await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }); });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3AgentTools && window.H3AgentSet && document.getElementById("ptFiles"), null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    // the server's checks
    const badDrive = await ev(async () => { const r = await fetch("/api/agent/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folder: "/" }) }); return { st: r.status, j: await r.json() }; });
    check("a whole drive is refused as the LLM's folder, with why", badDrive.st === 400 && /whole drive/.test(badDrive.j.error), badDrive);
    const saved = await ev(async (w) => (await (await fetch("/api/agent/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folder: w, timeout: 45 }) })).json()), WORK);
    check("a folder of your own is saved with the time limit", saved.folder === WORK && saved.timeout === 45 && saved.exists, saved);
    const unknown = await ev(async () => (await (await fetch("/api/agent/log")).json()));
    check("📜 the log route answers (a list)", Array.isArray(unknown.entries), unknown);
    // Settings ▸ General ▸ 🧰
    await ev(() => { document.getElementById("openSettings").click(); });
    await p.waitForTimeout(500);
    await ev(() => { const t = [...document.querySelectorAll("#settingsDlg .tabs button, [data-stab]")].find((x) => /General/.test(x.textContent)); if (t) t.click(); });
    await p.waitForSelector("#s_agFolder", { state: "attached" });
    await ev(() => window.H3AgentSet.fill()); await p.waitForTimeout(500);
    const st = await ev(() => ({ folder: document.getElementById("s_agFolder").value, t: document.getElementById("s_agTimeout").value, status: document.getElementById("s_agStatus").textContent, pick: !!document.getElementById("s_agPick"), help: /never a whole drive/.test(document.getElementById("s_agent").textContent) }));
    check("Settings ▸ General ▸ 🧰: the folder, the time limit, ✓ the line, 📁 Pick…, the safety words", st.folder === "" + st.folder && st.folder.length > 0 && st.t === "45" && /✓ the LLM works in this folder/.test(st.status) && st.pick && st.help, st);
    await ev(() => document.getElementById("s_agLogBtn").click()); await p.waitForTimeout(400);
    const lg = await ev(() => ({ shown: document.getElementById("s_agLog").style.display !== "none", text: document.getElementById("s_agLog").textContent }));
    check("📜 Log opens the list (nothing yet for a new folder's project, or its entries)", lg.shown && lg.text.length > 0, lg);
    await ev(() => { const d = document.querySelector("dialog[open]"); if (d) d.close(); });
    // the prompt docker's 🧰
    await ev(() => window.H3AgentTools.set(false)); await ev(() => window.H3AgentTools.load());
    await ev(() => document.getElementById("ptFiles").click()); await p.waitForTimeout(400);
    const on = await ev(() => ({ on: window.H3AgentTools.on(), pressed: document.getElementById("ptFiles").getAttribute("aria-pressed"), folder: window.H3AgentTools.folder() }));
    await ev(() => { const d = document.querySelector("dialog[open]"); if (d) d.close(); });
    check("🧰 with a folder picked turns on at once (kept, pressed)", on.on && on.pressed === "true" && on.folder === WORK, on);
    await ev(async () => { await window.chatPost("make hello say hi", ""); });
    check("chatPost sends context.files = true while 🧰 is on", sent && sent.context && sent.context.files === true, sent && sent.context);
    // the yes / no box (the turn's asks stood in for - the real ones come from the tool loop)
    await ev(() => { window.chatBusyNow = () => true; });
    fakeAsks = [{ id: "a1", kind: "write", path: "src/app.js", folder: "/w", isNew: false, added: 1, removed: 1, rows: [{ t: "@", s: "line 2" }, { t: " ", s: "function hello() {" }, { t: "-", s: "  return 'hi';" }, { t: "+", s: "  return 'hello';" }], more: false }];
    await p.waitForSelector("#agentAskDlg[open]", { timeout: 5000 });
    const box = await ev(() => { const d = document.getElementById("agentAskDlg"); const spans = [...d.querySelectorAll("#agAskBody span")]; return { title: document.getElementById("agAskTitle").textContent, info: document.getElementById("agAskInfo").textContent, red: spans.some((s) => /^- +return 'hi'/.test(s.textContent) && /255, 138, 128|ff8a80/i.test(s.getAttribute("style"))), green: spans.some((s) => /^\+ +return 'hello'/.test(s.textContent) && /9be59b/i.test(s.getAttribute("style"))), all: getComputedStyle(document.getElementById("agAskAll")).display !== "none", focused: document.activeElement && document.activeElement.id }; });
    check("a change: 'wants to change a file', the path + folder + counts + backed up, red line out / green line in, Yes to all offered, ✕ No focused", /change a file/.test(box.title) && /src\/app\.js in \/w - \+1 \/ −1 lines · the old file is backed up/.test(box.info) && box.red && box.green && box.all && box.focused === "agAskNo", box);
    await ev(() => document.getElementById("agAskAll").click()); await p.waitForTimeout(300);
    check("✔ Yes to all changes posts {id, ok: true, all: true} and closes the box", answers[0] && answers[0].id === "a1" && answers[0].ok === true && answers[0].all === true && !(await ev(() => document.getElementById("agentAskDlg").open)), answers);
    fakeAsks = [{ id: "a2", kind: "exec", command: "npm test", folder: "/w", timeout: 45 }];
    await p.waitForSelector("#agentAskDlg[open]", { timeout: 5000 });
    const cbox = await ev(() => ({ title: document.getElementById("agAskTitle").textContent, body: document.getElementById("agAskBody").textContent, info: document.getElementById("agAskInfo").textContent, all: getComputedStyle(document.getElementById("agAskAll")).display, yes: document.getElementById("agAskYes").textContent }));
    check("a command: 'wants to run a command', the command, its folder and time limit, no 'yes to all', ▶ Yes, run it", /run a command/.test(cbox.title) && cbox.body === "npm test" && /in \/w - stopped after 45 s/.test(cbox.info) && cbox.all === "none" && /Yes, run it/.test(cbox.yes), cbox);
    await p.keyboard.press("Escape"); await p.waitForTimeout(400);
    check("Esc = ✕ No (posts ok: false)", answers[1] && answers[1].id === "a2" && answers[1].ok === false, answers);
    await ev(() => { window.chatBusyNow = () => false; window.H3AgentTools.set(false); });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran: " + e.message, false); }
  finally { await b.close(); try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* left */ } }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
