#!/usr/bin/env node
/* bitGen Studio — 2.534.0 in a REAL browser:
 *   🧪 TEST MODE - off: nothing is kept or ticked, no box; Settings -> General -> 🧪 Test mode on: in the image editor a
 *      "Try next" box suggests Gaussian Blur first; applying the blur makes the app ask "Did it work?" with a 💡
 *      suggestions box; ✓ saves it (the suggestion in the row and the log's SUGGESTIONS) and the next image editor
 *      test is suggested; Later moves on; ✓ Tried it on a manual one asks too (✗ + what happened); in Settings the box
 *      is in front of the dialog; the docker's own box turns it off and the box goes;
 *   ✨ THE PREVIEW FOLLOWS - a render landing in the list the preview was opened from joins its strip, the picture on
 *      screen stays, "✨ 1 new" jumps to it.
 * Against the running app (H3_URL, default :8311). The marks it makes and Test mode are put back afterwards. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.534 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const SHOTS = process.env.H3_SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const IE = ["ie_blur", "ie_paint", "ie_erase", "ie_select", "ie_move", "ie_layer", "ie_transform", "ie_mask", "ie_sharpen", "ie_ai"];
const forget = async (ids) => { for (const id of ids) await api("/api/testplan/retest", { id }); };   // ↺ its mark + the events that ticked it

(async () => {
  const st0 = await api("/api/testplan"), mode0 = !!st0.mode;
  const keep = {}; for (const r of st0.rows) if (IE.includes(r.id) || r.id === "tm_on") keep[r.id] = { state: /^you:/.test(r.how || "") ? r.state : "", note: r.note, suggest: r.suggest };
  await api("/api/testplan/mode", { on: false });
  await forget(IE);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const box = () => ev(() => { const x = document.getElementById("tcBox"); if (!x) return null; const r = x.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + 12); return { cls: x.className, text: x.textContent, parent: x.parentElement.id || x.parentElement.tagName, front: !!(hit && x.contains(hit)) }; });
  const waitBox = (re, ms) => p.waitForFunction((s) => { const x = document.getElementById("tcBox"); return x && new RegExp(s).test(x.textContent); }, re, { timeout: ms || 15000 }).then(() => true).catch(() => false);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3TestCoach && window.imageEditorInstance && window.imageEditorInstance.E, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    // a picture to work on
    await ev(() => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 320; c.height = 200; const g = c.getContext("2d"); g.fillStyle = "#3a6"; g.fillRect(0, 0, 320, 200); g.fillStyle = "#fff"; g.fillRect(100, 60, 120, 80); const im = new Image(); im.onload = () => { window.imageEditorInstance.E.openImage(im, "e2e534.png"); ok(); }; im.src = c.toDataURL(); }));
    await p.waitForTimeout(500);

    /* ---- OFF */
    check("Test mode OFF: an event is not kept ({off})", (await api("/api/testplan/event", { event: "palette_run", what: "e2e534" })).off === true);
    await ev(() => window.imageEditorInstance.E.applyFilter("gaussian", { radius: 2 }));
    await p.waitForTimeout(1500);
    const s1 = await api("/api/testplan");
    check("…the blur used while off ticks nothing, the list is not evaluated, no box", !s1.mode && (s1.rows.find((r) => r.id === "ie_blur") || {}).state === "" && s1.rows.every((r) => !r.auto_state || r.kept) && !(await box()), (s1.rows.find((r) => r.id === "ie_blur") || {}));
    check("…the Settings checkbox shows it off", await ev(() => document.getElementById("s_testmode") && !document.getElementById("s_testmode").checked));

    /* ---- Settings -> General -> 🧪 Test mode */
    await ev(() => document.getElementById("openSettings").click());
    await p.waitForFunction(() => document.getElementById("settings").open, null, { timeout: 8000 }).catch(() => {});
    await ev(() => { const t = document.querySelector('#settings .stabs [data-stab="general"]'); if (t) t.click(); });
    await p.waitForTimeout(400);
    await p.click("#s_testmode"); await p.waitForTimeout(800);
    check("☑ Settings -> General -> 🧪 Test mode: on (the server says so)", (await api("/api/testplan")).mode === true);
    await ev(() => document.getElementById("settings").close()); await p.waitForTimeout(300);

    /* ---- in the image editor: Try next -> blur first */
    const gotNext = await waitBox("Try next.*Image editor[^]*Gaussian Blur", 15000);
    const b1 = await box();
    check("🖼 in the image editor: '🧪 Try next · Image editor' suggests Gaussian Blur first (Tim's example), in front", gotNext && b1 && /next/.test(b1.cls) && b1.front, b1);
    await ev(() => window.imageEditorInstance.E.applyFilter("gaussian", { radius: 3 }));
    const asked = await waitBox("Did it work\\?[^]*Gaussian Blur", 15000);
    const b2 = await box();
    check("…apply the blur: the app asks 'Did it work?' (seen: ie_action Gaussian Blur) with 'what happened' + '💡 Suggestions to change this feature'", asked && /confirm/.test(b2.cls) && /seen: ie_action: Gaussian Blur/.test(b2.text) && await ev(() => !!document.querySelector("#tcBox .tcnote") && /Suggestions to change this feature/.test(document.querySelector("#tcBox .tcsug").placeholder)), b2);
    await p.fill("#tcBox .tcsug", "e2e534: remember the last radius");
    await p.click('#tcBox [data-a="pass"]');
    const nextPaint = await waitBox("Try next[^]*Brush", 12000);
    const s2 = await api("/api/testplan"), rb = s2.rows.find((r) => r.id === "ie_blur");
    check("✓ It worked: saved as yours with the suggestion", rb.state === "pass" && /^you: pass/.test(rb.how) && rb.suggest === "e2e534: remember the last radius" && !rb.pending, rb);
    check("…and the NEXT image editor test is suggested (🖌 Brush), '✓ Saved' shown", nextPaint && /Saved - it works/.test((await box()).text), await box());
    await p.click('#tcBox [data-a="later"]'); await p.waitForTimeout(300);
    check("Later: the one after (Eraser)", /Eraser/.test((await box()).text), await box());
    await p.click('#tcBox [data-a="done"]'); await p.waitForTimeout(300);
    check("✓ Tried it: the 'Did it work?' box for it (manual), the note box has the focus", /Did it work\?[^]*Eraser/.test((await box()).text) && await ev(() => document.activeElement && document.activeElement.classList.contains("tcnote")));
    await p.keyboard.type("e2e534: it left a halo");
    await p.fill("#tcBox .tcsug", "e2e534: a softer edge option");
    await p.click('#tcBox [data-a="fail"]'); await p.waitForTimeout(800);
    const re = (await api("/api/testplan")).rows.find((r) => r.id === "ie_erase");
    check("✗ It didn't: a ✗ with what happened + the suggestion", re.state === "fail" && re.note === "e2e534: it left a halo" && re.suggest === "e2e534: a softer edge option", re);
    const keysOk = await ev(() => { const t = document.querySelector("#tcBox"); return !!t; });
    check("…the box is still there with the next test", keysOk && /Try next/.test((await box()).text));

    /* ---- in Settings: in front of the dialog */
    await forget(["tm_on"]);
    await ev(() => document.getElementById("openSettings").click());
    await p.waitForFunction(() => document.getElementById("settings").open, null, { timeout: 8000 }).catch(() => {});
    const inSet = await waitBox("Try next.*Settings", 8000);
    const b3 = await box();
    check("⚙ Settings open: the box suggests a Settings test, inside the dialog and in front of it", inSet && b3.parent === "settings" && b3.front, b3);
    await ev(() => document.getElementById("settings").close()); await p.waitForTimeout(400);

    /* ---- the log */
    const rep = await (await fetch(URL_ + "api/testplan/report")).text();
    check("💾 the log: SUGGESTIONS first with both, test mode ON", /== SUGGESTIONS[^]*remember the last radius[^]*a softer edge option/.test(rep) && rep.indexOf("== SUGGESTIONS") < rep.indexOf("== 2.534.0") && /test mode ON/.test(rep));

    /* ---- off from the docker */
    await ev(() => { SecFloat.show("testdock", true); return H3TestDock.refresh(); }); await p.waitForTimeout(500);
    check("the 🧪 docker: its Test mode box is ticked, rows have a 💡 suggestion field (ie_blur's filled)", await ev(() => document.getElementById("tdMode").checked && document.querySelector('#tdList [data-id="ie_blur"] .sg').value === "e2e534: remember the last radius"));
    await p.click("#tdMode"); await p.waitForTimeout(900);
    check("…unticked: Test mode OFF, the box is gone, the docker says it is off", !(await api("/api/testplan")).mode && !(await box()) && /Test mode is off/.test(await ev(() => document.getElementById("tdMsg").textContent)));
    await ev(() => SecFloat.show("testdock", false));

    /* ---- ✨ the preview follows its list */
    await ev(() => {
      const g = document.createElement("div"); g.id = "e2e534g"; g.setAttribute("data-lb-group", ""); g.style.cssText = "position:fixed;left:10px;top:200px;z-index:60;display:flex;gap:4px";
      ["human", "cat"].forEach((n) => { const t = document.createElement("div"); t.className = "thumb"; t.dataset.lbUrl = "/static/pose-sheets/" + n + ".png"; t.dataset.lbKind = "image"; t.dataset.lbName = n + ".png"; t.style.cssText = "width:60px;height:60px;background:#444"; t.textContent = n; g.appendChild(t); });
      document.body.appendChild(g);
    });
    await p.click('#e2e534g [data-lb-name="cat.png"]'); await p.waitForTimeout(500);
    check("the preview opens on cat.png (2 of 2)", await ev(() => document.getElementById("lb").open && document.getElementById("lb_name").textContent === "cat.png" && document.getElementById("lb_pos").textContent === "2 / 2"));
    await ev(() => { const t = document.createElement("div"); t.className = "thumb"; t.dataset.lbUrl = "/static/pose-sheets/dog.png"; t.dataset.lbKind = "image"; t.dataset.lbName = "dog.png"; t.textContent = "dog"; document.getElementById("e2e534g").prepend(t); });
    await p.waitForTimeout(500);
    const lbs = await ev(() => ({ n: lb.items.length, name: document.getElementById("lb_name").textContent, pos: document.getElementById("lb_pos").textContent, film: document.querySelectorAll("#lb_film .f").length, chip: (document.getElementById("lb_newc") || {}).textContent, vis: document.getElementById("lb_newc") && document.getElementById("lb_newc").style.display !== "none" }));
    check("✨ a new render in that list while the preview is open: it joins (3 in the strip), the picture on screen stays (cat.png, 3 / 3), '✨ 1 new'", lbs.n === 3 && lbs.name === "cat.png" && lbs.pos === "3 / 3" && lbs.film === 3 && lbs.vis && lbs.chip === "✨ 1 new", lbs);
    await p.click("#lb_newc"); await p.waitForTimeout(300);
    check("…the chip shows the new one and goes", await ev(() => document.getElementById("lb_name").textContent === "dog.png" && document.getElementById("lb_pos").textContent === "1 / 3" && document.getElementById("lb_newc").style.display === "none"));
    await ev(() => { document.getElementById("lb").close(); document.getElementById("e2e534g").remove(); });
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, "ui534.png") });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("the run finished", false, String(e && e.stack || e)); }
  finally {
    try { await b.close(); } catch { /* fine */ }
    await forget(Object.keys(keep).concat(IE.filter((x) => !keep[x])));
    for (const [id, k] of Object.entries(keep)) if (k.state || k.note || k.suggest) await api("/api/testplan/mark", { id, state: k.state, note: k.note, suggest: k.suggest });
    await api("/api/testplan/mode", { on: mode0 });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
