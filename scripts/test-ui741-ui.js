#!/usr/bin/env node
/* bitGen Studio — 2.741.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): ACE-STEP 1.5 +
 * THE AUDIO TAB. Tim (verbatim): "yes please we can also add an audio tab to general settings, ace step can use loras ,
 * i am not sure about the other" -> "All on the Audio tab".
 *   - Settings has no Music tab: the Audio tab holds the music styles (its first section), then speech, then speech to
 *     text, with a jump bar to each;
 *   - the ACE-Step 1.5 starter style is there (and in the Music docker's style list); its model is "ACE-Step 1.5 Turbo";
 *     its form shows BPM / key / beats a bar / language (the encoder's own choices) and LoRAs (＋ LoRA - ComfyUI's
 *     loras folder, a strength slider) - saved and painted back from what the server kept;
 *   - a MiniMax style shows neither (not known to take them).
 * The test's edits to the starter are put back afterwards. No server / no Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.741.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.741.0 browser test did not run"); process.exit(0); }
  const before = await fetch(URL0 + "api/styles?kind=music").then((r) => r.json()).catch(() => ({}));
  const ace0 = (before.styles || []).find((s) => s.name === "ACE-Step 1.5");
  if (!ace0) { fail++; console.log("FAIL: the ACE-Step 1.5 starter style is not in this studio"); console.log(`\n${pass} passed, ${fail} failed`); process.exit(1); }
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => document.getElementById("s_mulist") && document.getElementById("s_mulist").options.length > 1, null, { timeout: 30000 });
    await ev(() => { document.getElementById("openSettings").onclick(); });
    await sleep(400);
    const tabs = await ev(() => [...document.querySelectorAll("#settings .stabs button")].map((x) => x.dataset.stab));
    check("Settings: no Music tab any more; Audio is there", !tabs.includes("music") && tabs.includes("audio"), tabs);
    await ev(() => document.querySelector('#settings .stabs [data-stab="audio"]').click());
    await sleep(300);
    const A = await ev(() => {
      const pane = document.getElementById("stab-audio"), mu = document.getElementById("stab-music");
      const heads = [...pane.querySelectorAll("h3")].map((h) => h.id || h.textContent.trim().slice(0, 20));
      return { active: pane.classList.contains("active"), inside: pane.contains(mu), shown: !!mu.offsetParent, nav: [...pane.querySelectorAll(".ausubnav button")].map((x) => x.textContent),
        order: heads.indexOf("auMusicH") < heads.indexOf("auSpeechH") && heads.indexOf("auSpeechH") < heads.indexOf("auAsrH"), heads };
    });
    check("the Audio tab: the music styles first, then speech, then speech to text - a jump bar to each", A.active && A.inside && A.shown && A.order
      && A.nav.join("|") === "🎶 Music styles|🗣 Speech|📝 Speech to text", A);
    await ev(() => document.querySelector('#stab-audio .ausubnav [data-auto="auAsrH"]').click());
    await sleep(900);
    const jumped = await ev(() => { const h = document.getElementById("auAsrH").getBoundingClientRect(), box = document.querySelector("#settings .stab.active").getBoundingClientRect(); return { top: Math.round(h.top - box.top), inView: h.top >= box.top - 2 && h.top < box.bottom }; });
    check("…📝 Speech to text jumps to its section", jumped.inView, jumped);

    // the ACE-Step starter
    await ev((id) => { const l = document.getElementById("s_mulist"); l.value = id; l.dispatchEvent(new Event("change")); }, ace0.id);
    await sleep(500);
    const f1 = await ev(() => ({ name: document.getElementById("s_muname").value, arch: document.getElementById("s_muarch").selectedOptions[0].textContent,
      wf: document.getElementById("s_muwf").value, steps: document.getElementById("s_musteps").value, cfg: document.getElementById("s_mucfg").value,
      ace: !document.getElementById("s_muace").classList.contains("hidden") && !!document.getElementById("s_muace").offsetParent,
      lora: !document.getElementById("s_mulorasec").classList.contains("hidden"),
      keys: document.getElementById("s_mukey").options.length, beats: [...document.getElementById("s_mutime").options].map((o) => o.value), langs: document.getElementById("s_mulang").options.length,
      note: document.getElementById("s_munote").textContent, te: document.querySelectorAll("#s_mute input[type=text]").length }));
    check("the ACE-Step 1.5 starter: ACE-Step 1.5 Turbo, its workflow, 8 steps, cfg 1, two text encoder slots", f1.name === "ACE-Step 1.5" && f1.arch === "ACE-Step 1.5 Turbo"
      && /audio_ace_step_1_5\.json$/.test(f1.wf) && f1.steps === "8" && f1.cfg === "1" && f1.te === 2 && /LoRAs/.test(f1.note), f1);
    check("…BPM / key / beats a bar / language shown, with the encoder's own choices (34 keys, 2 3 4 6, 51 languages) + auto", f1.ace && f1.keys === 35
      && f1.beats.join() === ",2,3,4,6" && f1.langs === 52, f1);
    check("…and its LoRAs section", f1.lora, f1);
    await ev(() => {
      document.getElementById("s_mubpm").value = "98";
      document.getElementById("s_mukey").value = "A minor";
      document.getElementById("s_mutime").value = "3";
      document.getElementById("s_mulang").value = "ja";
      document.getElementById("s_muloraadd").click();
      const row = [...document.querySelectorAll("#s_muloras .lorarow")].pop(), [t, g] = row.querySelectorAll("input");
      t.value = "ace\\chiptune_v1.safetensors"; t.dispatchEvent(new Event("input", { bubbles: true }));
      g.value = "0.75"; g.dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("s_musave").click();
    });
    await p.waitForFunction(() => /saved/.test(document.getElementById("s_mustatus").textContent), null, { timeout: 8000 }).catch(() => {});
    const saved = await fetch(URL0 + "api/styles?kind=music").then((r) => r.json()).then((j) => (j.styles || []).find((s) => s.id === ace0.id));
    check("💾 Save: the server keeps the LoRA (path + strength) and the song's settings", saved && saved.loras.length === 1 && saved.loras[0].path === "ace\\chiptune_v1.safetensors"
      && saved.loras[0].weight === 0.75 && saved.bpm === 98 && saved.keyscale === "A minor" && saved.timesig === "3" && saved.language === "ja", saved);
    const f2 = await ev(() => ({ bpm: document.getElementById("s_mubpm").value, key: document.getElementById("s_mukey").value, lang: document.getElementById("s_mulang").value,
      rows: [...document.querySelectorAll("#s_muloras .lorarow")].map((r) => { const [t, g] = r.querySelectorAll("input"); return t.value + "@" + g.value; }) }));
    check("…and paints them back from what it stored", f2.bpm === "98" && f2.key === "A minor" && f2.lang === "ja" && f2.rows.join() === "ace\\chiptune_v1.safetensors@0.75", f2);

    // MiniMax: neither
    const mm = (before.styles || []).find((s) => s.name === "MiniMax Music3");
    await ev((id) => { const l = document.getElementById("s_mulist"); l.value = id; l.dispatchEvent(new Event("change")); }, mm.id);
    await sleep(400);
    const f3 = await ev(() => ({ arch: document.getElementById("s_muarch").value, ace: document.getElementById("s_muace").classList.contains("hidden"), lora: document.getElementById("s_mulorasec").classList.contains("hidden") }));
    check("a MiniMax Music3 style: no song settings, no LoRAs (not known to take them)", f3.arch === "minimax-music3" && f3.ace && f3.lora, f3);
    const dockList = await ev(() => [...document.getElementById("musicSel").options].map((o) => o.textContent));
    check("the Music docker's style list has ACE-Step 1.5", dockList.some((t) => /^ACE-Step 1\.5/.test(t)), dockList);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close();
    // the starter as it was
    await fetch(URL0 + "api/styles", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ace0.id, kind: "music", loras: ace0.loras || [], bpm: ace0.bpm, keyscale: ace0.keyscale || "", timesig: ace0.timesig || "", language: ace0.language || "" }) }).catch(() => {});
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
