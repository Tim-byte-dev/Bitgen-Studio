#!/usr/bin/env node
/* bitGen Studio — the SHEET MUSIC screenshots for the guide and the website (tigerart's website-sync.py copies
 * docs/images/<name>.png -> assets/img/<name>.jpg). Against a running studio (H3_URL, or H3_PORT - default 8311):
 *   docs/images/sheet-music.png       the Music docker's 🎼 Sheet Music tab (maximised; its toolbars, the transport and
 *                                      the score): "Night Drive" - the song in
 *                                      docs/images/music.png - on parchment, the words ticked, playing in the chorus (the
 *                                      sung note and syllable lit, the bar marked);
 *   docs/images/sheet-music-read.png  ⛶ Read: the same score full size.
 * The demo score is written to the studio's output folder and removed afterwards. Needs Playwright.
 *   node scripts/capture-sheet-shots.js [outDir]  (default docs/images) */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.error("capture-sheet-shots: Playwright is not installed"); process.exit(1); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
const OUT = path.resolve(process.argv[2] || path.join(__dirname, "..", "docs", "images"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NAME = "Night Drive.abc";
// the song of docs/images/music.png: verse + chorus, the vocal line with chords over it, the piano under it
const ABC = `X:1
T:Night Drive
C:bitGen Studio
M:4/4
L:1/8
Q:1/4=98
V: Vocal clef=treble name="Vocal" snm="Voc."
V: Piano clef=bass name="Piano" snm="Pno."
K:Am
% verse
V: Vocal
"Am" z2 A,C E2 E2 | "F" F2 E2 C4 | "C" z2 CD E2 E2 | "G" D2 C2 B,4 |
"Am" z2 A,C E2 G2 | "F" A2 G2 E2 C2 | "C" z C C D E2 E2 | "G" D2 B,6 |
V: Piano
[A,,E,A,]4 [A,,E,A,]4 | [F,,C,F,]4 [F,,C,F,]4 | [C,G,C]4 [C,G,C]4 | [G,,D,G,]4 [G,,D,G,]4 |
[A,,E,A,]4 [A,,E,A,]4 | [F,,C,F,]4 [F,,C,F,]4 | [C,G,C]4 [C,G,C]4 | [G,,D,G,]8 |
% chorus
V: Vocal
"F" c4 c2 A2 | "G" B2 G2 B4- | "Am" B2 c c B A A2 | "Em" G2 E G A4 |
"F" c2 c2 (d c A2) | "C" G2 E2 G2 c2 | "G" B2 B2 B2 A2 | "E" ^G2 A2 B4 | "Am" A8 |]
V: Piano
[F,,C,F,]4 [F,,C,F,]4 | [G,,D,G,]4 [G,,D,G,]4 | [A,,E,A,]4 [A,,E,A,]4 | [E,,B,,E,]4 [E,,B,,E,]4 |
[F,,C,F,]4 [F,,C,F,]4 | [C,G,C]4 [C,G,C]4 | [G,,D,G,]4 [G,,D,G,]4 | [E,,^G,,B,,]8 | [A,,E,A,]8 |]
`;
const LYRICS = `[intro]
(synth arpeggio, soft kick)

[verse]
Headlights paint the empty road
City hum fades out below
Radio glow on the dashboard line
We've got nowhere, we've got time

[chorus]
Drive, drive into the blue
Every mile I'm closer to you
Neon moon and the ocean air
Take the long way, we'll get there

[outro]
(fade on the arpeggio)`;

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.error("capture-sheet-shots: no studio at " + URL0); process.exit(1); }
  const where = await fetch(URL0 + "api/outputs/where").then((r) => r.json()).catch(() => null);
  const out = where && where.dir;
  if (!out || !fs.existsSync(out)) { console.error("capture-sheet-shots: the studio's output folder is not on this machine"); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(out, NAME), ABC);
  const b = await chromium.launch();
  let bad = 0;
  try {
    const p = await b.newPage({ viewport: { width: 1310, height: 1000 } });
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.MuScore && window.ScorePaper && document.getElementById("muScoreWords"), null, { timeout: 30000 });
    await ev((t) => {
      document.getElementById("muLyrics").value = t;
      const ti = document.getElementById("muTitle"); if (ti) ti.value = "Night Drive";
    }, LYRICS);
    // the Music docker on its own: the side columns folded (their menu-bar toggles), the docker maximised, the floating
    // windows out of the way
    await ev(() => {
      [["no-left", "tL"], ["no-refs", "tRefs"], ["no-assets", "tAssets"], ["no-right", "tR"], ["no-queue", "tQ"]].forEach(([c, b]) => {
        if (!document.getElementById("app").classList.contains(c) && document.getElementById(b)) document.getElementById(b).click();
      });
      document.querySelectorAll(".dgwin, .floatwin, [data-floating]").forEach((w) => { w.style.display = "none"; });
    });
    await ev(() => document.querySelector('button[data-max="musicdock"]').click());
    // and over the whole window for the picture (the test studio's other dockers and floating windows stay underneath)
    await ev(() => {
      const st = document.createElement("style");
      st.textContent = "#musicdock{position:fixed!important;inset:0!important;z-index:2147483000!important;height:100vh!important;max-height:none!important;"
        + "display:flex!important;flex-direction:column!important;background:var(--panel,#1c1915)}#musicdock>.bbody{flex:1 1 auto!important;min-height:0!important;overflow:auto!important;max-height:none!important;height:auto!important;padding-bottom:420px!important}";   // room to scroll the toolbars to the top (cropped away)
      document.head.appendChild(st);
    });
    await ev(() => document.querySelector('button[data-mutab="sheet"]').click());
    await sleep(900);
    await ev(() => MuScore.refresh());
    await p.waitForFunction((n) => [...document.querySelectorAll("#muScoreList option")].some((o) => o.value === n), NAME, { timeout: 15000 });
    await p.selectOption("#muScoreList", NAME);
    await p.waitForFunction(() => MuScore.player(), null, { timeout: 15000 });
    if (!(await ev(() => document.getElementById("muScoreWords").checked))) await ev(() => MuScore.words(true));
    await p.waitForFunction(() => document.querySelectorAll("#muScore text[data-w]").length > 20 && MuScore.player(), null, { timeout: 15000 });
    await ev(() => MuScore.setPaper(Object.assign({}, ScorePaper.DEFAULTS, { material: "parchment", pdf: true })));
    await sleep(600);
    // playing in the chorus: "clo-" of "closer" (bar 12), the bar marked
    const at = await ev(() => { const T = MuScore.state.result.timing; const w = T.words.find((x) => /^clo/i.test(x.s)); return w ? ScorePlayer.secAt(T, w.t0 + 30) : 20; });
    await ev((s) => MuScore.player().seek(s), at);
    await sleep(300);
    const lit = await ev(() => [...document.querySelectorAll("#muScore text.abcOn")].map((x) => x.textContent));
    if (!lit.length) { bad++; console.error("capture-sheet-shots: no word lit"); }
    // from the Score row down: the transport, then the score to the chorus line that is lit
    await ev(() => {
      const body = document.querySelector("#musicdock > .bbody"), row = document.getElementById("muSheetMake");
      body.scrollTop += row.getBoundingClientRect().top - body.getBoundingClientRect().top - 12;
      const box = document.getElementById("muScore"); if (box) box.scrollTop = 0;
    });
    await sleep(200);
    // the two toolbars, the transport and the score - to the viewer's bottom edge
    const clip = await ev(() => {
      const t = document.getElementById("muSheetMake").getBoundingClientRect(), v = document.querySelector("#muPaneSheet .muViewer").getBoundingClientRect();
      const y = Math.max(0, Math.round(t.top - 3));
      return { x: 0, y, width: innerWidth, height: Math.min(innerHeight, Math.round(v.bottom + 10)) - y };
    });
    await p.screenshot({ path: path.join(OUT, "sheet-music.png"), clip });
    console.log("sheet-music.png  lit: " + lit.join(" "));
    await ev(() => MuScore.openView());
    await sleep(700);
    await ev((s) => MuScore.player().seek(s), at);
    await sleep(300);
    await ev(() => { if (document.activeElement) document.activeElement.blur(); });
    await p.screenshot({ path: path.join(OUT, "sheet-music-read.png"), clip: await ev(() => {
      const r = document.getElementById("muScoreView").getBoundingClientRect();
      return { x: Math.max(0, r.left), y: Math.max(0, r.top), width: Math.min(r.width, innerWidth), height: Math.min(r.height, innerHeight - Math.max(0, r.top)) };
    }) });
    await ev(() => document.getElementById("muScoreView").close());
    console.log("sheet-music-read.png");
  } catch (e) {
    bad++; console.error("capture-sheet-shots: " + (e && e.stack || e));
  } finally {
    await b.close();
    try { fs.unlinkSync(path.join(out, NAME)); } catch { /* gone */ }
  }
  process.exit(bad ? 1 : 0);
})();
