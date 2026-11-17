#!/usr/bin/env node
/* bitGen Studio — 2.833.0 against the RUNNING app (+ a real browser): 🎞 SLIDES part 3, the ✨ AI. Tim: "yes, plese do part 3".
 *   A stand-in LLM (Settings ▸ LLM's endpoint for the run, put back after) and a stand-in picture job (the page's /api/genimage,
 *   /api/jobs and /outputs answered by the test):
 *   ✨ AI ▾ Make slides… "solar power", 3 slides, 🖼 pictures -> a new presentation: the title slide, the points as bullets, notes,
 *   the picture slide's box filled when its job is done; ✍ Rewrite this slide (Ctrl+Z takes it back); 🎤 Speaker notes from the
 *   slide; the outline as written after this slide (no LLM); the prompt docker "make a 2 slide presentation about bees" builds
 *   it; an ordinary message still goes to the chat LLM.
 *   H3_SHOTS=<dir> saves pictures. No Playwright = SKIP. */
"use strict";
const path = require("path"), fs = require("fs"), http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/", SHOTS = process.env.H3_SHOTS || "";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (method, u, body) => { const r = await fetch(new URL(u, URL_), { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined }); return r.json(); };
const asked = [];
const PLAN = { title: "Solar power", subtitle: "Light into electricity", slides: [
  { layout: "content", title: "How it works", points: ["Light hits the cell", "Electrons start to move", "A current flows"], notes: "Point at the panel on the roof." },
  { layout: "picture", title: "A panel up close", points: ["Silicon cells"], picture: "a solar panel on a roof in the sun" },
  { layout: "content", title: "Costs", points: ["Panels", "Installing"], notes: "" }] };
function llmServer() {
  return http.createServer((req, res) => {
    let body = ""; req.on("data", (c) => { body += c; });
    req.on("end", () => {
      let j = {}; try { j = JSON.parse(body); } catch (e) { /* empty */ }
      const all = (j.messages || []).map((m) => m.content).join("\n"); asked.push(all);
      let text = "an ordinary chat answer from the stand-in";
      if (/You write presentations/.test(all)) text = "```json\n" + JSON.stringify(/bees/i.test(all) ? { title: "Bees", subtitle: "", slides: [{ layout: "content", title: "Why bees", points: ["Pollen"] }, { layout: "content", title: "The hive", points: ["Comb"] }] } : PLAN) + "\n```";
      else if (/You improve one slide/.test(all)) text = /speaker notes/.test(all) ? JSON.stringify({ title: "x", points: ["y"], notes: "Say how the cell turns light into a current." }) : JSON.stringify({ title: "How a solar cell works", points: ["Sunlight frees electrons", "They flow as a current"], notes: "Point at the panel on the roof." });
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: text } }] }));
    });
  }).listen(0, "127.0.0.1");
}
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const llm = llmServer(); await new Promise((r) => llm.on("listening", r));
  const cfg0 = await api("GET", "api/config"), llm0 = { external_url: (cfg0.llm || {}).external_url || "", external_model: (cfg0.llm || {}).external_model || "local" };
  await api("POST", "api/config", { llm: { external_url: `http://127.0.0.1:${llm.address().port}/v1/chat/completions`, external_model: "stand-in" } });
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, x) => p.evaluate(f, x);
  const shot = async (n) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, n + ".png") }); } };
  const deck = () => ev(() => JSON.parse(JSON.stringify(window.H3Slides.deck())));
  const lastReply = () => ev(() => { const L = [...document.querySelectorAll("#chatlog .cm")]; return (L[L.length - 1] || {}).textContent || ""; });
  const words = (s, role) => ((s.items.find((i) => i.role === role) || {}).text || "");
  const menu = async (label) => { await ev(() => document.getElementById("slAiBtn").click()); await p.waitForTimeout(150); await ev((l) => [...document.querySelectorAll(".slmenu [data-a]")].find((d) => d.textContent.includes(l)).click(), label); };
  const jobs = [];
  const PNG = fs.readFileSync(path.join(__dirname, "..", "static/favicon.png"));
  await p.route("**/api/genimage", async (r) => { jobs.push(JSON.parse(r.request().postData() || "{}")); await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "t833job", status: "queued" }) }); });
  await p.route("**/api/jobs/t833job", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "t833job", status: "done", outputs: ["t833.png"] }) }));
  await p.route("**/outputs/t833.png", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { slidesdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Slides && window.H3SlideAI && document.getElementById("slAiBtn") && document.getElementById("tX_slidesdock"), null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => { const d = document.getElementById("slidesdock"); if (d.classList.contains("dockgone")) document.getElementById("tX_slidesdock").click(); if (d.classList.contains("collapsed")) toggleCollapse("slidesdock"); });
    await p.waitForTimeout(400);
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { if (d.style.display !== "none") d.style.display = "none"; }); const d = document.getElementById("slidesdock"); d.style.cssText += ";position:fixed;left:10px;top:60px;width:1380px;height:820px;z-index:9999"; });
    await ev(() => { const s = document.getElementById("styleSel"); if (s && !s.value) { const o = document.createElement("option"); o.value = "t833style"; o.textContent = "t833"; s.appendChild(o); s.value = "t833style"; } window.H3Slides.load(window.SlideCore.newDeck("forest"), "Test833"); });
    await p.waitForTimeout(300);

    // ✨ Make slides…
    await menu("Make slides");
    await p.waitForSelector("#slAiBox");
    check("✨ AI ▾ Make slides… opens the box: about / a text / a file / count / pictures / new or after / as written", await ev(() => ["slAiAsk", "slAiText", "slAiFile", "slAiCount", "slAiPics", "slAiAsIs", "slAiGo"].every((id) => document.getElementById(id)) && document.querySelectorAll("[name=slAiMode]").length === 2));
    await p.fill("#slAiAsk", "solar power for a school talk"); await p.fill("#slAiCount", "3"); await p.check("#slAiPics");
    await shot("1-box");
    await p.click("#slAiGo");
    await p.waitForFunction(() => !document.getElementById("slAiBox") && window.H3Slides.deck().slides.length === 4, null, { timeout: 20000 });
    const d1 = await deck();
    check("a new presentation: the title slide (title + subtitle), then the LLM's slides; the theme kept; named after it",
      d1.slides[0].layout === "title" && words(d1.slides[0], "title") === "Solar power" && words(d1.slides[0], "sub") === "Light into electricity" && d1.theme === "forest" && (await ev(() => window.H3Slides.St.name)) === "Solar power", d1.slides.map((s) => s.layout));
    check("…the points as the body's bulleted lines; the speaker notes; the picture slide has its picture box",
      words(d1.slides[1], "body") === "Light hits the cell\nElectrons start to move\nA current flows" && d1.slides[1].notes === "Point at the panel on the roof." && d1.slides[2].layout === "picture" && d1.slides[2].items.some((i) => i.role === "pic"), d1.slides[1]);
    check("the LLM was asked for 3 slides with picture slides (the topic in the words)", asked.some((a) => /Make 3 slides/.test(a) && /picture slides/.test(a) && /solar power/.test(a)));
    await p.waitForFunction(() => { const H = window.H3Slides, pic = H.deck().slides[2].items.find((i) => i.role === "pic"); return pic && H.mediaUrl(pic.src); }, null, { timeout: 20000 });
    const job = jobs[0] || {};
    check("the picture: /api/genimage with the prompt docker's image style, the plan's picture words, the box's shape at ~1 MP -> put in its box",
      jobs.length === 1 && job.prompt === "a solar panel on a roof in the sun" && job.style_id === (await ev(() => document.getElementById("styleSel").value)) && job.batch === 1 && job.width % 16 === 0 && job.width > job.height, job);
    await p.waitForTimeout(300);
    await shot("2-made");

    // ✍ rewrite this slide, Ctrl+Z
    await ev(() => window.H3Slides.go(1));
    await menu("Rewrite this slide");
    await p.waitForFunction(() => /rewritten/.test(document.getElementById("slMsg").textContent), null, { timeout: 15000 });
    const s2 = (await deck()).slides[1];
    check("✍ Rewrite this slide: the new title and points in its boxes", words(s2, "title") === "How a solar cell works" && words(s2, "body") === "Sunlight frees electrons\nThey flow as a current", s2.items.map((i) => i.text));
    await ev(() => window.H3Slides.undo());
    check("…Ctrl+Z (undo) takes it back", words((await deck()).slides[1], "title") === "How it works");
    await menu("Speaker notes");
    await p.waitForFunction(() => /speaker notes written/.test(document.getElementById("slMsg").textContent), null, { timeout: 15000 });
    const s3 = (await deck()).slides[1];
    check("🎤 Speaker notes from the slide: the notes written (shown below the slide), the words kept",
      s3.notes === "Say how the cell turns light into a current." && (await ev(() => document.getElementById("slNotes").value)) === s3.notes && words(s3, "title") === "How it works" && asked.some((a) => /speaker notes/.test(a) && /Light hits the cell/.test(a)), s3);

    // the outline as written, after this slide (no LLM)
    const n0 = asked.length;
    await menu("Make slides"); await p.waitForSelector("#slAiBox");
    await p.fill("#slAiText", "# Next steps\nGet a quote\n- Ask two installers\n> mention the rebate\nBook it"); await p.check("#slAiAsIs"); await p.check("[name=slAiMode][value=after]");
    await p.click("#slAiGo");
    await p.waitForFunction(() => !document.getElementById("slAiBox") && window.H3Slides.deck().slides.length === 7, null, { timeout: 15000 });
    const d4 = await deck();
    check("the outline as written, after this slide: a section slide for its title, a slide a heading, - points, > notes; no LLM asked",
      asked.length === n0 && d4.slides[2].layout === "section" && words(d4.slides[2], "title") === "Next steps" && words(d4.slides[3], "title") === "Get a quote" && words(d4.slides[3], "body") === "Ask two installers" && d4.slides[3].notes === "mention the rebate" && words(d4.slides[4], "title") === "Book it" && words(d4.slides[5], "title") === "A panel up close", d4.slides.map((s) => s.items.map((i) => i.text).join("|")));

    // the prompt docker
    await ev(() => { window.H3Slides.St.dirty = false; });
    await ev((t) => chatSend(t), "make a 2 slide presentation about bees");
    await p.waitForFunction(() => /slides? made in Slides/.test(([...document.querySelectorAll("#chatlog .cm")].pop() || {}).textContent || ""), null, { timeout: 20000 });
    const d5 = await deck();
    check("the prompt docker: 'make a 2 slide presentation about bees' -> a new presentation in Slides, and the reply says so",
      d5.slides.length === 3 && words(d5.slides[0], "title") === "Bees" && words(d5.slides[1], "title") === "Why bees" && /"Bees" - 3 slides made in Slides/.test(await lastReply()) && asked.some((a) => /Make 2 slides/.test(a) && /request: bees/.test(a)), await lastReply());
    const n1 = asked.length;
    await ev((t) => chatSend(t), "what is a good lens for portraits?");
    await p.waitForFunction(() => /ordinary chat answer/.test(([...document.querySelectorAll("#chatlog .cm")].pop() || {}).textContent || ""), null, { timeout: 20000 });
    check("an ordinary message still goes to the chat LLM", asked.length > n1 && (await deck()).slides.length === 3);
    await shot("3-chat");
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally {
    try { await api("POST", "api/config", { llm: llm0 }); } catch (e) { /* fine */ }
    try { await ev(() => { localStorage.removeItem("h3.slides.draft"); const s = document.getElementById("styleSel"), o = s && s.querySelector('option[value="t833style"]'); if (o) o.remove(); }); } catch (e) { /* fine */ }
    await b.close(); llm.close();
    console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
