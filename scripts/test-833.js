#!/usr/bin/env node
/* bitGen Studio — 2.833.0 units: 🎞 SLIDES part 3, the ✨ AI. Tim: "yes, plese do part 3".
 *   lib/slideAi.js with a stand-in LLM: planDeck (the answer in a ``` fence, thinking, a trailing comma; layouts checked, at most
 *   the count, no pictures unless asked), outlinePlan (no LLM), rewriteSlide (better / shorter / fix / notes keeps the words);
 *   ext/slidesdock/slideai.js pure parts: wants() (the prompt docker's words), buildSlides() with slidecore, picSize, picPrompt;
 *   the wiring (routes, the button, the script, the chat route first). */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const A = require(path.join(ROOT, "lib/slideAi.js")), K = require(path.join(ROOT, "ext/slidesdock/slidecore.js")), SA = require(path.join(ROOT, "ext/slidesdock/slideai.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
(async () => {
  // ---- lib/slideAi.js
  let seen = null, answer = "";
  A.setComplete(async (o) => { seen = o; return { ok: true, text: answer }; });
  answer = "<think>a plan</think>Here it is:\n```json\n" + JSON.stringify({ title: "Bees", subtitle: "Small and busy", slides: [
    { layout: "content", title: "Why bees matter", points: ["- They pollinate crops", "2026 was a good year", "3. Honey"], notes: "Start with a question." },
    { layout: "picture", title: "Inside the hive", points: ["Comb"], picture: "a honeycomb close up" },
    { layout: "two", title: "Workers and drones", points: ["Work", "Fly", "Guard", "Mate"] },
    { layout: "weird", title: "Odd", points: ["x"] }, { title: "", points: [] },
    { layout: "section", title: "Part two" }, { layout: "content", title: "Extra" }] }).replace(/\]\}$/, "],}") + "\n```";
  const r1 = await A.planDeck({ ask: "bees", count: 5, pictures: true });
  const p = r1.plan, s0 = p.slides[0];
  check("planDeck: the answer found in thinking + a ``` fence + a trailing comma; the title and subtitle", p.title === "Bees" && p.subtitle === "Small and busy", p);
  check("planDeck: points keep their numbers ('2026 was a good year'), only bullet marks taken off; the notes", JSON.stringify(s0.points) === '["They pollinate crops","2026 was a good year","Honey"]' && s0.notes === "Start with a question.", s0);
  check("planDeck: a picture slide keeps its picture words; two columns split into points / points2; an unknown layout = content; an empty slide dropped; at most count (5)",
    p.slides[1].layout === "picture" && p.slides[1].picture === "a honeycomb close up" && p.slides[2].layout === "two" && p.slides[2].points.length === 2 && p.slides[2].points2.length === 2 && p.slides[3].layout === "content" && p.slides.length === 4 && p.slides[3].title === "Odd", p.slides);
  check("planDeck: the LLM is asked as system + user (the count and 'picture slides' in the words)", seen.messages[0].role === "system" && /Make 5 slides/.test(seen.messages[1].content) && /picture slides/.test(seen.messages[1].content) && /bees/.test(seen.messages[1].content));
  const r2 = await A.planDeck({ ask: "bees", count: 8, pictures: false });
  check("planDeck without pictures: no picture words, a picture slide turned into content", r2.plan.slides.every((s) => !s.picture && s.layout !== "picture") && /No picture slides/.test(seen.messages[1].content), r2.plan.slides);
  let e1 = null; try { await A.planDeck({}); } catch (e) { e1 = e; }
  answer = "sorry, I cannot"; let e2 = null; try { await A.planDeck({ ask: "x" }); } catch (e) { e2 = e; }
  A.setComplete(async () => ({ ok: false, error: "no model" })); let e3 = null; try { await A.planDeck({ ask: "x" }); } catch (e) { e3 = e; }
  check("planDeck: nothing asked = 400; not a plan = 502; the LLM not answering = 502 with its error", e1 && e1.status === 400 && e2 && e2.status === 502 && e3 && e3.status === 502 && /no model/.test(e3.message), [e1 && e1.message, e2 && e2.message, e3 && e3.message]);
  A.setComplete(async (o) => { seen = o; return { ok: true, text: answer }; });

  const o = A.outlinePlan("# Solar power\nHow it works\n- Light hits the cell\n- Electrons move\n> point at the diagram\n## Costs\n1. Panels\n2. Install\nThe end");
  check("outlinePlan: '# ' first = the deck's title; a line / ## = a slide's title; - and 1. = points; > = notes; no LLM",
    o.title === "Solar power" && o.slides.length === 3 && o.slides[0].title === "How it works" && JSON.stringify(o.slides[0].points) === '["Light hits the cell","Electrons move"]' && o.slides[0].notes === "point at the diagram" && o.slides[1].title === "Costs" && o.slides[1].points.length === 2 && o.slides[2].title === "The end" && o.slides[2].layout === "titleonly", o);
  const o2 = A.outlinePlan("Talk title\nFirst\n- a\nSecond\n- b");
  check("outlinePlan: no '# ' - a first line with no points becomes the deck's title", o2.title === "Talk title" && o2.slides.length === 2, o2);

  answer = JSON.stringify({ title: "Bees matter", points: ["Pollinate", "Make honey"], notes: "New notes." });
  const w1 = await A.rewriteSlide({ title: "bees", points: ["they polinate", "honey"], notes: "old", how: "better" });
  check("rewriteSlide better: the new title, points and notes", w1.title === "Bees matter" && w1.points.length === 2 && w1.notes === "New notes.", w1);
  const w2 = await A.rewriteSlide({ title: "bees", points: ["they polinate", "honey"], notes: "old", how: "notes" });
  check("rewriteSlide notes: the title and points kept exactly, only the notes written; the 'notes' instruction sent", w2.title === "bees" && JSON.stringify(w2.points) === '["they polinate","honey"]' && w2.notes === "New notes." && /speaker notes/.test(seen.messages[1].content), w2);
  await A.rewriteSlide({ title: "x", points: ["y"], how: "fix" });
  check("rewriteSlide fix: temperature 0, 'only fix spelling'", seen.temperature === 0 && /Only fix spelling/.test(seen.messages[1].content));
  answer = JSON.stringify({ title: "", points: [] });
  const w3 = await A.rewriteSlide({ title: "keep", points: ["p"], notes: "n", how: "better" });
  check("rewriteSlide: an empty answer keeps the slide's words", w3.title === "keep" && w3.points[0] === "p" && w3.notes === "n", w3);
  let e4 = null; try { await A.rewriteSlide({ how: "better" }); } catch (e) { e4 = e; }
  check("rewriteSlide: a slide with no words = 400", e4 && e4.status === 400);

  // ---- slideai.js pure
  const W = SA.wants;
  const a1 = W("make slides about bees"), a2 = W("Create a 6 slide presentation on solar power with pictures please"), a3 = W("make a presentation from the text below\n# Plan\n- one"), a4 = W("build me a deck about our Q3 sales, no pictures"), a5 = W("make ten slides about the moon");
  check("wants: 'make slides about bees' -> about bees, 8 slides, no pictures", a1 && a1.ask === "bees" && a1.count === 8 && !a1.pictures && !a1.text, a1);
  check("wants: 'Create a 6 slide presentation on solar power with pictures' -> 6, pictures, 'solar power'", a2 && a2.count === 6 && a2.pictures && a2.ask === "solar power", a2);
  check("wants: the lines after the first = the text to make them from ('from the text below' is not the topic)", a3 && a3.ask === "" && /# Plan/.test(a3.text), a3);
  check("wants: 'no pictures' = none; 'ten slides' = 10", a4 && !a4.pictures && /Q3 sales/.test(a4.ask) && a5 && a5.count === 10 && a5.ask === "the moon", [a4, a5]);
  check("wants: not for the slides - an ordinary chat, a spreadsheet's words, 'what is a slide'", !W("what is a good slide rule") && !W("tell me about bees") && !W("make a formula for the sheet column total") && !W("received a payment of 50"));
  const deck = K.newDeck("night");
  const b = SA.buildSlides(p, K, deck, { asNew: true, pictures: true });
  const tw = b.slides[0].items, pic = b.slides[2].items.find((i) => i.role === "pic");
  check("buildSlides: a title slide first (title + subtitle), then the plan's slides with slidecore's layouts",
    b.slides.length === 5 && b.slides[0].layout === "title" && tw.find((i) => i.role === "title").text === "Bees" && tw.find((i) => i.role === "sub").text === "Small and busy" && b.slides[1].layout === "content" && b.slides[2].layout === "picture" && b.slides[3].layout === "two", b.slides.map((s) => s.layout));
  check("buildSlides: points = the body's lines (bullets), two columns, notes; a picture job for the picture box",
    b.slides[1].items.find((i) => i.role === "body").text === "They pollinate crops\n2026 was a good year\nHoney" && b.slides[3].items.find((i) => i.role === "body2").text.split("\n").length === 2 && b.slides[1].notes === "Start with a question." && b.jobs.length === 1 && b.jobs[0].item === pic.id && b.jobs[0].slide === b.slides[2].id && b.jobs[0].prompt === "a honeycomb close up", b.jobs);
  const b2 = SA.buildSlides(p, K, deck, { asNew: false, pictures: false });
  check("buildSlides after a slide, no pictures: the title as a section slide; the picture slide a content slide; no jobs", b2.slides[0].layout === "section" && b2.slides[2].layout === "content" && !b2.jobs.length, b2.slides.map((s) => s.layout));
  const sw = SA.slideWords(b.slides[3]);
  check("slideWords: the title box + both columns' points; slideWords of a slide with only text boxes (the first = the title)", sw.title === "Workers and drones" && sw.points.length === 4 && sw.bodies.length === 2 && SA.slideWords({ items: [{ type: "text", text: "A" }, { type: "text", text: "b\nc" }] }).points.length === 2, sw);
  const ps = SA.picSize(744, 490);
  check("picSize: about one megapixel, the box's shape, on a 16-px grid", ps.width % 16 === 0 && ps.height % 16 === 0 && Math.abs(ps.width / ps.height - 744 / 490) < 0.05 && ps.width * ps.height > 900000 && ps.width * ps.height < 1200000, ps);
  check("picPrompt: the slide's title and points, the deck's title, no words in the picture", /Inside the hive: Comb \(Bees\)\. .*no text/.test(SA.picPrompt(b.slides[2], "Bees")), SA.picPrompt(b.slides[2], "Bees"));
  const clean = K.clean(Object.assign({}, deck, { slides: b.slides }));
  check("the built slides survive slidecore.clean (the shape the server keeps): texts, notes, the empty picture box", clean.slides.length === 5 && clean.slides[1].items.find((i) => i.role === "body").text.startsWith("They") && clean.slides[1].notes === "Start with a question." && clean.slides[2].items.some((i) => i.type === "image" && i.role === "pic"), clean.slides.map((s) => s.items.length));

  // ---- the wiring
  const rs = read("routes/slides.js"), ej = JSON.parse(read("ext/slidesdock/ext.json")), html = read("ext/slidesdock/dock.html"), js = read("ext/slidesdock/slideai.js");
  check("routes: POST /api/slides/ai/plan, /ai/outline, /ai/rewrite (lib/slideAi.js) - in routes/slides.js, not server.js", /\/api\/slides\/ai\/plan/.test(rs) && /\/api\/slides\/ai\/outline/.test(rs) && /\/api\/slides\/ai\/rewrite/.test(rs) && /lib\/slideAi/.test(rs) && !/slideAi/.test(read("misc/server.js")));
  check("the extension: slideai.js after slideio.js; the ✨ AI ▾ button", ej.scripts.indexOf("slideai.js") === ej.scripts.indexOf("slideio.js") + 1 && /id="slAiBtn"/.test(html) && /✨ AI ▾/.test(html) && /#slAiBox/.test(html));
  check("the prompt docker route goes FIRST in H3ChatRoutes; pictures from #styleSel through /api/genimage and /api/jobs", /H3ChatRoutes = \[maybe\]\.concat/.test(js) && /\$\("styleSel"\)/.test(js) && /\/api\/genimage/.test(js) && /\/api\/jobs\//.test(js));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + (e.stack || e)); console.log(`\nRESULT: ${pass} passed, ${fail + 1} failed`); process.exit(1); });
