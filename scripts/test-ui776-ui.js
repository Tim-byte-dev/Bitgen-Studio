#!/usr/bin/env node
/* bitGen Studio — 2.776.0 browser test: THE ☁ REMOTE GENERATION DOCKER IN SECTIONS (static/remotetypes.js) on a running studio
 * (H3_URL, default :8311): Remote servers / Generation (Image, Video, Music) / Language models / Audio (Text to speech, Speech
 * to text, Song separation), each type Local or Remote in aligned columns, a choice saved (POST /api/gpusplit per), the old Both
 * boxes hidden, the sections' look from the theme's variables. Settings put back afterwards.
 * Tim (verbatim): "add all the types to remote generation. Music - local/remote, tts-local/remote, stt-local/remote, separate
 * all of the choices into sections neatly justified with an editable(theme)border and bg color etc"
 * No server / no Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.776.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (u, b) => (await fetch(URL0 + u, b === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })).json();

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.776.0 browser test did not run"); process.exit(0); }
  const g0 = await api("api/gpusplit"), en0 = await api("api/remotegen");
  const b = await chromium.launch();
  try {
    await api("api/remotegen/enabled", { on: true });
    await api("api/gpusplit", { engine: { provider: "runpod", runpod: "pods" } });
    await api("api/gpusplit", { where: "remote", per: false });
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3RemoteTypes && window.H3RemoteDock && window.SecFloat && SecFloat.started, null, { timeout: 60000 });
    await ev(() => { H3RemoteDock.show(true); SecFloat.float("rgen", 300, 40, 520, 880); });
    await p.waitForFunction(() => document.querySelectorAll("#gpuRemoteOpts .rtSec").length === 4 && document.querySelector('input[name="rt_music"]:checked'), null, { timeout: 20000 });
    const a = await ev(() => ({ secs: [...document.querySelectorAll("#gpuRemoteOpts .rtSec")].map((s) => s.querySelector(".rtSecH").textContent),
      gen: [...document.querySelectorAll('[data-rtgrid="gen"] .rtName')].map((x) => x.textContent), au: [...document.querySelectorAll('[data-rtgrid="audio"] .rtName')].map((x) => x.textContent),
      llm: !!document.querySelector('.rtSec[data-rtsec="llm"] #gpuLlmWhere'), eng: !!document.querySelector('.rtSec[data-rtsec="servers"] #gpuEngine'),
      boxes: getComputedStyle(document.getElementById("gpuBoxes")).display, checked: [...document.querySelectorAll('[data-rtgrid] input:checked')].map((i) => i.name + "=" + i.value),
      cols: [...document.querySelectorAll('[data-rtgrid] input[value="remote"]')].map((i) => Math.round(i.getBoundingClientRect().left)) }));
    check("four sections in order: ☁ Remote servers, 🎨 Generation, 🧠 Language models, 🔊 Audio - the servers and LLM rows moved in",
      JSON.stringify(a.secs) === JSON.stringify(["☁ Remote servers", "🎨 Generation", "🧠 Language models", "🔊 Audio"]) && a.llm && a.eng, a);
    check("…Generation: Image, Video, Music; Audio: Text to speech, Speech to text, Song separation - on Remote (no per yet) every one Remote",
      a.gen.join() === "Image,Video,Music" && a.au.join() === "Text to speech,Speech to text,Song separation" && a.checked.length === 6 && a.checked.every((x) => /=remote$/.test(x)), a);
    check("…neatly justified: every row's Remote in one column; the old Both boxes hidden", new Set(a.cols).size === 1 && a.boxes === "none", a);
    await p.click('input[name="rt_music"][value="local"]'); await sleep(900);
    const sp = await api("api/gpusplit");
    check("Music ▸ Local: saved at once (per) - songs on this computer, the other types still remote", sp.per === true && sp.types.music === "local" && sp.types.video === "remote" && sp.types.tts === "remote", sp.types);
    const n = await ev(() => ({ music: document.getElementById("rtNote_music").hidden, tts: document.getElementById("rtNote_tts").textContent }));
    check("…the lines: Local has none; Text to speech on Remote says which pod has it (or that none has yet)", n.music === true && /pod/.test(n.tts), n);
    const look = await ev(() => { const s = document.querySelector(".rtSec"), r = getComputedStyle(document.documentElement), c0 = getComputedStyle(s).backgroundColor;
      document.documentElement.style.setProperty("--rt-sec-bg", "rgb(10, 80, 30)"); document.documentElement.style.setProperty("--rt-sec-border", "rgb(200, 20, 20)");
      const c1 = getComputedStyle(s).backgroundColor, b1 = getComputedStyle(s).borderTopColor; return { has: !!r.getPropertyValue("--rt-sec-bg").trim(), c0, c1, b1, radius: getComputedStyle(s).borderTopLeftRadius }; });
    check("the sections' border and background are the theme's (--rt-sec-bg / --rt-sec-border - a theme sets them)", look.has && look.c1 === "rgb(10, 80, 30)" && look.b1 === "rgb(200, 20, 20)" && look.radius === "8px", look);
    check("no page errors", errs.length === 0, errs);
  } finally {
    await b.close();
    await api("api/gpusplit", { per: false, where: g0.where || "local", engine: g0.engine }).catch(() => 0);
    await api("api/remotegen/enabled", { on: !!en0.enabled }).catch(() => 0);
  }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
