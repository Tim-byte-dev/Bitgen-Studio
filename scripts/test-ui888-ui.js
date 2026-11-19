#!/usr/bin/env node
/* bitGen Studio — 2.888.0 in a REAL browser: 🎛 app actions + skills for the chat. Settings ▸ General ▸ 🎛 Skills (the built-in
 * ones listed, ＋ New skill saved as yours, ✎ on a built-in = your own copy, 🗑 asked then deleted), the prompt docker's 🎛 (kept,
 * chatPost sends context.app + the app's state), and the page doing an app ask from the tool loop (H3Voice.act - the prompt
 * written, the answer posted with what happened; a state ask answered with the state; the 🧰 yes / no box never opens for them).
 * The plan Tim went with: "abilities like claude code gives" - 2.888.0 app actions + skills. */
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
  let sent = null; const answers = []; let fakeAsks = [];
  try {
    await p.route("**/api/chat", async (route) => { try { sent = JSON.parse(route.request().postData() || "{}"); } catch { sent = {}; }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ session: "s", reply: "Done.", web: { steps: [], sources: [], warnings: [], app: [] } }) }); });
    await p.route("**/api/agent/asks", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ asks: fakeAsks }) }));
    await p.route("**/api/agent/answer", async (route) => { const a = JSON.parse(route.request().postData() || "{}"); answers.push(a); fakeAsks = fakeAsks.filter((x) => x.id !== a.id); await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }); });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3AppTools && window.H3SkillsSet && window.H3Voice && document.getElementById("ptApp"), null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    // Settings ▸ General ▸ 🎛 Skills
    await ev(async () => { for (const n of ["ui888-skill", "music-video"]) await fetch("/api/skills/" + n, { method: "DELETE" }); });
    await ev(() => { document.getElementById("openSettings").click(); });
    await p.waitForTimeout(500);
    await ev(() => { const t = [...document.querySelectorAll("#settingsDlg .tabs button, [data-stab]")].find((x) => /General/.test(x.textContent)); if (t) t.click(); });
    await p.waitForSelector("#s_skList", { state: "attached" });
    await ev(() => window.H3SkillsSet.fill()); await p.waitForTimeout(500);
    const l1 = await ev(() => [...document.querySelectorAll("#s_skList .skrow")].map((r) => r.textContent.replace(/\s+/g, " ").trim()));
    check("🎛 Skills lists the four built-in skills", ["make-a-picture", "music-video", "storyboard-from-story", "write-video-prompt"].every((n) => l1.some((t) => t.startsWith(n) && /built in/.test(t))), l1);
    await ev(() => document.getElementById("s_skNew").click());
    await p.waitForSelector("#skillDlg[open]");
    await ev(() => { document.getElementById("skName").value = "UI888 Skill"; document.getElementById("skDesc").value = "a test skill for the browser test"; document.getElementById("skBody").value = "Say hello first."; document.getElementById("skSave").click(); });
    await p.waitForTimeout(700);
    const l2 = await ev(async () => ({ rows: [...document.querySelectorAll("#s_skList .skrow")].map((r) => r.dataset.sk + " " + (r.querySelector("[data-skdel]") ? "del" : "")), api: await (await fetch("/api/skills/ui888-skill")).json(), open: document.getElementById("skillDlg").open }));
    check("＋ New skill: saved as yours (name made a slug), listed with 🗑, the box closed", l2.rows.includes("ui888-skill del") && l2.api.source === "yours" && l2.api.body === "Say hello first." && !l2.open, l2);
    await ev(() => document.querySelector('[data-skedit="music-video"]').click());
    await p.waitForSelector("#skillDlg[open]");
    const copy = await ev(() => ({ title: document.getElementById("skTitle").textContent, body: document.getElementById("skBody").value.length }));
    await ev(() => { document.getElementById("skBody").value += "\nAlso: ask about the song's tempo."; document.getElementById("skSave").click(); });
    await p.waitForTimeout(700);
    const l3 = await ev(async () => ({ api: await (await fetch("/api/skills/music-video")).json(), row: (document.querySelector('[data-sk="music-video"]') || {}).textContent }));
    check("✎ on a built-in = your own copy, used instead of it", /own copy/.test(copy.title) && copy.body > 200 && l3.api.source === "yours" && /tempo/.test(l3.api.body) && /used instead of the built-in/.test(l3.row || ""), { copy, l3 });
    await ev(() => document.querySelector('[data-skdel="ui888-skill"]').click());
    await p.waitForSelector("#notedlg[open]"); await ev(() => document.getElementById("note_ok").click()); await p.waitForTimeout(600);
    const gone = await ev(async () => (await fetch("/api/skills/ui888-skill")).status);
    check("🗑 asks, then deletes yours", gone === 404, gone);
    await ev(async () => { await fetch("/api/skills/music-video", { method: "DELETE" }); const d = document.querySelector("dialog[open]"); if (d) d.close(); });
    // the prompt docker's 🎛
    await ev(() => { window.H3AppTools.set(false); window.H3AgentTools && window.H3AgentTools.set(false); document.getElementById("prompt").value = "old words"; });
    await ev(() => document.getElementById("ptApp").click()); await p.waitForTimeout(300);
    await ev(() => { const d = document.querySelector("dialog[open]"); if (d) d.close(); });
    const on = await ev(() => ({ on: window.H3AppTools.on(), pressed: document.getElementById("ptApp").getAttribute("aria-pressed") }));
    await ev(async () => { await window.chatPost("make a fox picture", ""); });
    check("🎛 on (kept, pressed); chatPost sends context.app and the app's state (the prompt, the styles)", on.on && on.pressed === "true" && sent && sent.context && sent.context.app === true && sent.context.app_state && sent.context.app_state.prompt === "old words" && Array.isArray(sent.context.app_state.image_styles), { on, ctx: sent && sent.context && { app: sent.context.app, st: sent.context.app_state && sent.context.app_state.prompt } });
    // the page does the tool loop's app asks
    await ev(() => { window.chatBusyNow = () => true; });
    fakeAsks = [{ id: "g1", kind: "app", action: { do: "set_prompt", text: "a red fox in snow" } }];
    await p.waitForFunction(() => document.getElementById("prompt").value === "a red fox in snow", null, { timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(400);
    check("an app ask is done on the page (H3Voice.act) and answered with what happened; no yes / no box", (await ev(() => document.getElementById("prompt").value)) === "a red fox in snow" && answers[0] && answers[0].id === "g1" && answers[0].ok === true && /prompt written/.test(answers[0].result) && !(await ev(() => !!(document.getElementById("agentAskDlg") || {}).open)), answers);
    fakeAsks = [{ id: "g2", kind: "app", action: { do: "state" } }, { id: "g3", kind: "app", action: { do: "set_style", kind: "image", name: "zzz-no-such-style" } }];
    await p.waitForTimeout(1600);
    const a2 = answers.find((a) => a.id === "g2"), a3 = answers.find((a) => a.id === "g3");
    check("a state ask is answered with the state; an action the page can't do says why", a2 && a2.ok && a2.state && a2.state.prompt === "a red fox in snow" && a3 && a3.ok === false && /no "zzz-no-such-style" here/.test(a3.why), { a2: a2 && { ok: a2.ok, p: a2.state && a2.state.prompt }, a3 });
    await ev(() => { window.chatBusyNow = () => false; window.H3AppTools.set(false); });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran: " + e.message, false); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
