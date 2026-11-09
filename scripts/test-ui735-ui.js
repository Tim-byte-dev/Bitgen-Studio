#!/usr/bin/env node
/* bitGen Studio — 2.735.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): the WORDS LIT
 * AS THEY ARE SUNG. Tim (verbatim): "can the words be highlighted as the song is sung?"
 *   - with "words" ticked, each syllable under the vocal staff is marked (data-w) and lights (.abcOn, orange) while it is
 *     sung - held through its tie and through the notes of its slur, dark in a rest, together with its note head;
 *   - while it plays the lit syllable is the one the clock is on; a click on a word plays from it; ⛶ Read lights too;
 *   - unticked: no words to light, the notes still light;
 *   - 2.735.1: the transport buttons stay on one row (▶ was a full-width .go bar).
 * No server / no Playwright = SKIP. The test's file is removed afterwards. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.735.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NAME = "E2E-Sung735_20261109-130000.abc";
// 120 a minute: a quarter = half a second
const ABC = `X:1
M:4/4
L:1/4
Q:1/4=120
V: Vocal clef=treble name="Vocal Melody" snm="Vocal"
V: Ins clef=bass name="Piano" snm="Pno."
K:C
V: Vocal
C D- D (E|F G) z A|c B A G|]
V: Ins
C,4|G,,4|C,4|]
`;
const LYRICS = "Hel-lo dear world, sing it to me now";

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.735.0 browser test did not run"); process.exit(0); }
  const where = await fetch(URL0 + "api/outputs/where").then((r) => r.json()).catch(() => null);
  const out = where && where.dir;
  if (!out || !fs.existsSync(out)) { console.log("SKIP: the studio's output folder is not on this machine"); process.exit(0); }
  fs.writeFileSync(path.join(out, NAME), ABC);
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  try {
    const ctx = await b.newContext({ viewport: { width: 1500, height: 950 } });
    const p = await ctx.newPage();
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.MuScore && window.ScorePlayer && document.getElementById("muScoreWords") && document.getElementById("muLyrics"), null, { timeout: 30000 });
    await ev(() => { try { localStorage.removeItem("h3.muScoreWords"); } catch (e) { /* */ } });
    await ev((t) => { document.getElementById("muLyrics").value = t; }, LYRICS);
    await ev(() => document.querySelector('button[data-mutab="sheet"]').click());
    await sleep(900);
    await ev(() => MuScore.refresh());
    await p.selectOption("#muScoreList", NAME);
    await p.waitForFunction((n) => document.getElementById("muSheetStatus").textContent.indexOf(n) >= 0 && MuScore.player(), NAME, { timeout: 15000 }).catch(() => {});
    await p.check("#muScoreWords");
    await p.waitForFunction(() => document.querySelectorAll("#muScore text[data-w]").length > 0 && MuScore.player(), null, { timeout: 10000 }).catch(() => {});
    await sleep(300);
    const lit = (sel) => ev((s) => [...document.querySelectorAll(s + " text.abcOn")].map((x) => x.textContent), sel || "#muScore");
    const w0 = await ev(() => ({ marked: [...document.querySelectorAll("#muScore text[data-w]")].map((x) => x.getAttribute("data-w") + ":" + x.textContent),
      words: (MuScore.state.result.timing.words || []).map((w) => w.s + "@" + w.t0 + "-" + w.t1), mode: MuScore.player().mode }));
    check("ticked: each syllable under the vocal staff is marked with its word id (the hyphen and the piano are not; 'now' has no note left)",
      w0.marked.join(" ") === "0:Hel 1:lo 2:dear 3:world, 4:sing 5:it 6:to 7:me", w0);
    check("…the words' times: lo held through its tie, dear through its slur over the barline", w0.words.slice(0, 4).join(" ") === "Hel@0-480 lo@480-1440 dear@1440-2880 world,@3360-3840", w0.words);

    // 2.735.1: the transport is one row (▶ is a .go button, and .go is full width everywhere else)
    const tr = await ev(() => { const bs = [...document.querySelectorAll("#muPlayBar button[data-act]")].map((x) => x.getBoundingClientRect());
      const bar = document.getElementById("muPlayBar").getBoundingClientRect();
      return { tops: bs.map((r) => Math.round(r.top + r.height / 2)), play: Math.round(bs[2].width), bar: Math.round(bar.width) }; });
    check("2.735.1: ⏮ ⏪ ▶ ⏩ ⏭ on one row, ▶ a button not a full-width bar", tr.tops.length === 5 && Math.max(...tr.tops) - Math.min(...tr.tops) <= 2 && tr.play < 90, tr);
    await ev(() => MuScore.player().seek(1.0));                        // tick 960: the tied-over D
    const a = await ev(() => ({ lit: [...document.querySelectorAll("#muScore text.abcOn")].map((x) => x.textContent), heads: document.querySelectorAll("#muScore path.abcOn").length,
      fill: (() => { const x = document.querySelector("#muScore text.abcOn"); return x ? getComputedStyle(x).fill : ""; })(),
      other: (() => { const x = document.querySelector("#muScore text[data-w]:not(.abcOn)"); return x ? getComputedStyle(x).fill : ""; })() }));
    check("on the tied-over note: 'lo' is lit (orange), the others not, its note head lit too", JSON.stringify(a.lit) === '["lo"]' && a.fill === "rgb(232, 116, 43)" && a.other !== a.fill && a.heads >= 1, a);
    await ev(() => MuScore.player().seek(2.2));                        // tick 2112: G, inside the slur, the next bar
    check("inside the slur, over the barline: 'dear' still lit", JSON.stringify(await lit()) === '["dear"]', await lit());
    await ev(() => MuScore.player().seek(3.2));                        // the rest
    check("in the rest: no word lit", (await lit()).length === 0, await lit());
    await ev(() => MuScore.player().seek(3.6));
    check("after the rest: 'world,'", JSON.stringify(await lit()) === '["world,"]', await lit());

    // ▶ for real: the lit syllable follows the clock
    await ev(() => MuScore.player().seek(4.0));
    await ev(() => document.querySelector('#muPlayBar [data-act="toggle"]').click());
    await sleep(1300);
    await ev(() => document.querySelector('#muPlayBar [data-act="toggle"]').click());
    await sleep(150);
    const pl = await ev(() => { const T = MuScore.state.result.timing, pos = MuScore.player().position();
      return { pos, lit: [...document.querySelectorAll("#muScore text.abcOn")].map((x) => +x.getAttribute("data-w")), want: ScorePlayer.wordsAt(T, ScorePlayer.tickAt(T, pos)) }; });
    check("▶ played on from 'sing': the lit syllable is the one the clock is on", pl.pos > 4.8 && pl.lit.length === 1 && JSON.stringify(pl.lit) === JSON.stringify(pl.want) && pl.lit[0] >= 5, pl);

    // a click on a word plays from it
    // (the test page has other panels over the inline dock at this size, as in the 2.731.0 test - so the click is sent to the word)
    await ev(() => [...document.querySelectorAll("#muScore text[data-w]")].find((t) => t.textContent === "world,").dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await sleep(200);
    const ck = await ev(() => ({ pos: MuScore.player().position(), lit: [...document.querySelectorAll("#muScore text.abcOn")].map((x) => x.textContent) }));
    check("a click on 'world,' jumps there (3.5 s) and lights it", Math.abs(ck.pos - 3.5) < 0.05 && JSON.stringify(ck.lit) === '["world,"]', ck);

    // ⛶ Read
    await ev(() => MuScore.openView());
    await sleep(300);
    await ev(() => MuScore.player().seek(0.1));
    check("⛶ Read lights the words too ('Hel')", JSON.stringify(await lit("#muSvPages")) === '["Hel"]', await lit("#muSvPages"));
    await ev(() => document.getElementById("muScoreView").close());

    // unticked
    await p.uncheck("#muScoreWords");
    await sleep(400);
    await ev(() => MuScore.player() && MuScore.player().seek(1.0));
    const u = await ev(() => ({ marked: document.querySelectorAll("#muScore text[data-w]").length, heads: document.querySelectorAll("#muScore path.abcOn").length }));
    check("unticked: no words to light, the notes still light", u.marked === 0 && u.heads >= 1, u);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close();
    try { fs.unlinkSync(path.join(out, NAME)); } catch { /* gone */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
