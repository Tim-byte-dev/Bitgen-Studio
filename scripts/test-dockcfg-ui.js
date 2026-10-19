#!/usr/bin/env node
/* bitGen Studio — 2.392.0 DOCKER CONFIGS (docker.cfg) in a REAL browser.
 * Tim (verbatim): "add a button to the right hand side of the main menubar - docker configs / create a file, docker.cfg
 * / this file will house docker sizes when open with other dockers ... when only they are opened again together, load
 * the default sizes from cfg file. if a new docker is opened, look to see if their is a configuration for the 4 dockers
 * together while they are open. / i would like to maintain a consistant ui. not one that has mostly cut off ...
 * people will likely use different resolutions".
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. The configs it saves are
 * removed at the end.
 *   1. ⊞ Docker configs sits at the right end of the menu bar; its panel names the dockers open now;
 *   2. 💾 Save writes the set's sizes to docker.cfg; the set closed and opened again = the saved sizes come back;
 *   3. a 4th docker opened = that set's own layout (none yet: left as it is; saved: loaded); closing it = the 3 again;
 *   4. a smaller window: the saved heights are scaled to the column - nothing cut off;
 *   5. "Load automatically" off = no loading; a saved row's Load opens those dockers; ✕ forgets it. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the docker configs browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const K3 = "chatdock+musicdock+timelinedock", K4 = "chatdock+musicdock+stemsdock+timelinedock";

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  try {
    for (const k of [K3, K4]) { try { await api("/api/docker-cfg/delete", { key: k }); } catch { /* none */ } }
    await api("/api/docker-cfg/settings", { auto: true });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3_PROJECT_READY && window.DockCfg && window.DockCfg.started, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    const ev = (f, a) => p.evaluate(f, a);
    // the set: Timeline, Music, Chat open - every other column docker hidden (the prompt too)
    const setOnly = (ids) => ev((ids) => {
      for (const [btn, id] of Object.entries(window.H3GoneDocks)) {
        const el = document.getElementById(id); if (!el) continue;
        const want = ids.includes(id), gone = el.classList.contains("dockgone");
        if (want === gone) toggleDockGone(id, btn);
        if (want && el.classList.contains("collapsed")) toggleCollapse(id);
      }
    }, ids);
    const H = () => ev(() => { const g = (id) => Math.round(document.getElementById(id).getBoundingClientRect().height); return { tl: g("timelinedock"), mu: g("musicdock"), ch: g("chatdock"), st: g("stemsdock"), col: document.getElementById("maincol").clientHeight, key: window.DockCfg.openKey() }; });
    await setOnly(["timelinedock", "musicdock", "chatdock"]);
    await p.waitForTimeout(500);

    // 1
    const g1 = await ev(() => { const b = document.getElementById("dockCfgBtn"), m = document.getElementById("menubar"); const r = b.getBoundingClientRect(), mr = m.getBoundingClientRect(); return { right: Math.round(mr.right - r.right), left: Math.round(r.left), mid: Math.round(mr.width / 2), text: b.textContent, aria: b.getAttribute("aria-label"), tip: b.title }; });
    check("⊞ Docker configs is on the menu bar's right end, icon only (2.394.0: ⊞ - named by its tooltip / aria-label)", g1.right >= 0 && g1.right < 30 && g1.left > g1.mid && g1.text.trim() === "⊞" && g1.aria === "Docker configs" && /^Docker configs/.test(g1.tip), g1);
    await p.click("#dockCfgBtn"); await p.waitForTimeout(200);
    const head = await ev(() => document.querySelector("#dockCfgPanel .dchead").textContent);
    check("...its panel names the dockers open now (Chat + Music + Timeline) and says nothing is saved for them", /Chat \+ Music \+ Timeline/.test(head) && /no layout saved/.test(head), head);

    // 2
    await ev(() => { setVar("th", 300); setVar("mh", 220); setVar("ch2", 160); reflowSoon(); });
    await p.waitForTimeout(500);
    const s0 = await H();
    await p.click("#dockCfgSave"); await p.waitForTimeout(500);
    const file = await api("/api/docker-cfg");
    const v = ((file.configs || {})[K3] || { variants: [] }).variants[0] || {};
    check("💾 Save: docker.cfg holds the set (key " + K3 + ") with every docker's height as shown, the window size and the column height",
      v.docks && v.docks.timelinedock && Math.abs(v.docks.timelinedock.height - s0.tl) <= 2 && Math.abs(v.docks.musicdock.height - s0.mu) <= 2
      && Math.abs(v.docks.chatdock.height - s0.ch) <= 2 && v.window.w === 1700 && v.col.h > 300 && v.docks.ldock && v.docks.ldock.width > 0, { v: v.docks && [v.docks.timelinedock, v.docks.musicdock, v.docks.chatdock], s0 });
    await ev(() => { setVar("th", 180); setVar("mh", 300); setVar("ch2", 260); reflowSoon(); });
    await p.waitForTimeout(400);
    await setOnly(["timelinedock", "chatdock"]); await p.waitForTimeout(500);
    await setOnly(["timelinedock", "musicdock", "chatdock"]); await p.waitForTimeout(700);
    const s1 = await H();
    check("the set closed and opened together again: the saved sizes come back",
      s1.key === K3 && Math.abs(s1.tl - s0.tl) <= 3 && Math.abs(s1.mu - s0.mu) <= 3 && Math.abs(s1.ch - s0.ch) <= 3, { s0, s1 });

    // 3
    await setOnly(["timelinedock", "musicdock", "chatdock", "stemsdock"]); await p.waitForTimeout(700);
    const s2 = await H();
    check("a 4th docker (Stems) opened: no layout for those 4 yet - nothing loaded, the column still fits", s2.key === K4 && s2.st > 30 && s2.tl + s2.mu + s2.ch + s2.st <= s2.col + 4, s2);
    await ev(() => { setVar("th", 200); setVar("mh", 150); setVar("ch2", 150); setVar("sth", 180); reflowSoon(); });
    await p.waitForTimeout(400);
    const s3 = await H();
    await ev(() => window.DockCfg.save()); await p.waitForTimeout(500);
    await setOnly(["timelinedock", "musicdock", "chatdock"]); await p.waitForTimeout(700);
    const s4 = await H();
    await setOnly(["timelinedock", "musicdock", "chatdock", "stemsdock"]); await p.waitForTimeout(700);
    const s5 = await H();
    check("...saved for the 4: closing Stems loads the 3's layout, opening it again loads the 4's",
      Math.abs(s4.tl - s0.tl) <= 3 && Math.abs(s4.mu - s0.mu) <= 3 && Math.abs(s5.st - s3.st) <= 3 && Math.abs(s5.tl - s3.tl) <= 3 && Math.abs(s5.mu - s3.mu) <= 3, { s0, s3, s4, s5 });

    // 4
    await setOnly(["timelinedock", "musicdock", "chatdock"]); await p.waitForTimeout(500);
    await p.setViewportSize({ width: 1500, height: 760 }); await p.waitForTimeout(400);
    await setOnly(["timelinedock", "chatdock"]); await p.waitForTimeout(400);
    await setOnly(["timelinedock", "musicdock", "chatdock"]); await p.waitForTimeout(800);
    const s6 = await H();
    const k = s6.col / v.col.h, r0 = s0.mu / s0.ch, r6 = s6.mu / s6.ch;
    check("a smaller window (760 px high): the saved heights scaled to this column (the same proportions) - every docker in view, none cut off",
      Math.abs(r6 - r0) / r0 < 0.1 && Math.abs(s6.mu - s0.mu * k) <= 12 && s6.tl + s6.mu + s6.ch <= s6.col + 4 && s6.mu > 60 && s6.ch > 60, { s0, s6, k });
    const panelTxt = await ev(() => { window.DockCfg.paint(); return document.querySelector("#dockCfgPanel .dchead").textContent; });
    check("...the panel says the layout was saved at 1700×1050 and is fitted to this window", /saved for these at 1700×1050/.test(panelTxt) && /fitted/.test(panelTxt), panelTxt);
    await p.setViewportSize({ width: 1700, height: 1050 }); await p.waitForTimeout(400);

    // 5
    if (!(await ev(() => document.getElementById("dockCfgPanel").style.display !== "none"))) await p.click("#dockCfgBtn");
    await ev(() => window.DockCfg.paint());
    await p.uncheck("#dockCfgAuto"); await p.waitForTimeout(400);
    await ev(() => { setVar("mh", 280); reflowSoon(); });
    await setOnly(["timelinedock", "chatdock"]); await p.waitForTimeout(400);
    await setOnly(["timelinedock", "musicdock", "chatdock"]); await p.waitForTimeout(700);
    const s7 = await H();
    check("\"Load saved layouts automatically\" off: opening the set again leaves the sizes as they are (Music stays 280)", Math.abs(s7.mu - 280) <= 4 && (await api("/api/docker-cfg")).auto === false, s7);
    await p.check("#dockCfgAuto"); await p.waitForTimeout(300);
    await setOnly(["timelinedock"]); await p.waitForTimeout(400);
    await ev(() => window.DockCfg.paint());
    await p.click(`#dockCfgPanel [data-dcapply="${K3}"]`); await p.waitForTimeout(800);
    const s8 = await H();
    check("a saved row's Load: those three dockers open again with the saved sizes", s8.key === K3 && Math.abs(s8.mu - s0.mu) <= 3, s8);
    await ev(() => window.DockCfg.paint());
    await p.click(`#dockCfgPanel [data-dcdel="${K4}"]`); await p.waitForTimeout(400);
    const f2 = await api("/api/docker-cfg");
    check("✕ forgets that layout (docker.cfg without the 4-docker set)", !f2.configs[K4] && !!f2.configs[K3], Object.keys(f2.configs));
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 900));
  } finally {
    for (const k of [K3, K4]) { try { await api("/api/docker-cfg/delete", { key: k }); } catch { /* fine */ } }
    try { await api("/api/docker-cfg/settings", { auto: true }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
