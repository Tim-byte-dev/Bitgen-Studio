#!/usr/bin/env node
/* bitGen Studio — 2.533.0 in a REAL browser: A DROPDOWN'S SEARCH LIST INSIDE A DIALOG IS IN FRONT OF IT (static/selsearch.js).
 * Tim (verbatim): "the select lora dialog folder dropdown is opening behind the dialog"
 * A dialog opened with showModal() is in the browser's top layer (over any z-index) and makes the rest of the page inert;
 * the list used to go in <body> - drawn behind the dialog, not clickable. Now it goes in the list's own dialog and into the
 * top layer as a popover. (Found on the way: a playing <video>'s own "resize" event, caught by the list's capturing
 * listener, closed an open list at random - now only the window resizing / a scroll that moves the select closes it.) Checks: the Select a LoRA dialog's folder list, a list in Settings, a list outside a dialog.
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.533 dropdown-in-a-dialog test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  // where the open list is, and whether the point in the middle of its first row really is the list (= it is in front)
  const where = () => ev(() => {
    const box = document.querySelector(".selsearch"); if (!box) return null;
    const row = box.querySelector(".ssrow:not(.dis)") || box; const r = row.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    let pop = false; try { pop = box.matches(":popover-open"); } catch (e) { pop = false; }
    return { parent: box.parentElement && (box.parentElement.id || box.parentElement.tagName), front: !!(hit && box.contains(hit)), pop, rows: box.querySelectorAll(".ssrow").length };
  });
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.__selSearch && typeof cmBrowse === "function", null, { timeout: 60000 });
    await p.waitForTimeout(600);

    /* ---- the Select a LoRA dialog: its folder list */
    await ev(() => {
      cmBrowse(["loras"], "", () => {}, "Select a LoRA");
      const f = document.getElementById("cm_folder");          // enough folders for the search list (a test machine has few)
      for (let i = f.options.length; i < 12; i++) { const o = document.createElement("option"); o.value = "loras/e2e_folder_" + i; o.textContent = "loras/e2e_folder_" + i; f.appendChild(o); }
    });
    await p.waitForTimeout(200);
    check("the Select a LoRA dialog is open as a modal", await ev(() => document.getElementById("cmdlg").open && document.getElementById("cmdlg").matches(":modal") && document.getElementById("cm_title").textContent === "Select a LoRA"));
    // (a model rescan finishing now repaints the folder list without our extra folders: the search list for 2+ items here)
    const min0 = await ev(() => { const m = __selSearch.min; __selSearch.setMin(2); return m; });
    await p.click("#cm_folder"); await p.waitForTimeout(250);
    const w1 = await where();
    check("its folder list opens IN the dialog (not behind it in the page)", w1 && w1.parent === "cmdlg", w1);
    check("…in front: the middle of its first row is the list itself (it is a top-layer popover)", w1 && w1.front && w1.pop, w1);
    // pick a folder with the mouse
    const pick = await ev(() => { const rows = [...document.querySelectorAll(".selsearch .ssrow")]; const r = rows.find((x) => /e2e_folder_5/.test(x.textContent)) || rows[rows.length - 1]; window.__want533 = [...document.getElementById("cm_folder").options].find((o) => o.textContent === r.querySelector(".t").textContent.replace(/^✓ /, "")); window.__want533 = window.__want533 ? window.__want533.value : ""; const b = r.getBoundingClientRect(); return [b.left + 20, b.top + b.height / 2]; });
    await p.mouse.click(pick[0], pick[1]); await p.waitForTimeout(250);
    check("…a click picks the folder (the dialog stays open, the list closes)", await ev(() => document.getElementById("cm_folder").value === window.__want533 && window.__want533 !== "" && document.getElementById("cmdlg").open && !document.querySelector(".selsearch")));
    // typing searches
    await p.focus("#cm_folder"); await p.keyboard.press("e"); await p.waitForTimeout(250);
    await p.keyboard.type("2e_folder_1"); await p.waitForTimeout(200);
    const typed = await ev(() => [...document.querySelectorAll(".selsearch .ssrow .t")].map((x) => x.textContent));
    check("…a letter opens it searching (e2e_folder_1, _10, _11 - or the folders that are left after a rescan)", await ev(() => !!document.querySelector(".selsearch input")) && typed.every((t) => /e/i.test(t)), typed);
    await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    check("…Esc closed the list only", await ev(() => !document.querySelector(".selsearch") && document.getElementById("cmdlg").open));
    await ev((m) => __selSearch.setMin(m), min0);
    await ev(() => { document.getElementById("cmdlg").close(); document.querySelectorAll("#cm_folder option[value^='loras/e2e_folder_']").forEach((o) => o.remove()); });

    /* ---- a list in Settings (also a modal dialog) */
    await p.waitForTimeout(300);
    await ev(() => { if (typeof openSettings === "function") openSettings(); else document.getElementById("openSettings").click(); });
    await p.waitForFunction(() => document.getElementById("settings").open, null, { timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(500);
    const why = await ev(() => ({ open: document.getElementById("settings").open, modal: document.querySelectorAll("dialog[open]").length }));
    if (!why.open) { console.log("note: Settings did not open by its button here - opened as a modal directly", JSON.stringify(why)); await ev(() => document.getElementById("settings").showModal()); await p.waitForTimeout(300); }
    const sid = await ev(() => {
      const d = document.getElementById("settings"); if (!d.open) return null;
      let sel = [...d.querySelectorAll("select")].find((x) => x.options.length >= window.__selSearch.min && x.offsetParent && !x.disabled);
      if (!sel) {                                               // none on the tab it opened on: one of our own in it
        sel = document.createElement("select"); sel.id = "e2e_set533"; sel.dataset.e2e = "1";
        for (let i = 0; i < 12; i++) { const o = document.createElement("option"); o.value = "s" + i; o.textContent = "Setting " + i; sel.appendChild(o); }
        d.prepend(sel);
      }
      if (!sel.id) sel.id = "e2e_sel533"; return sel.id;
    });
    await p.waitForTimeout(300);
    if (sid) {
      await p.waitForTimeout(1500);                           // Settings fills itself for a moment after it opens (a scroll closes an open list)
      await p.click("#" + sid); await p.waitForTimeout(250);
      let w2 = await where();
      if (!w2) { await p.waitForTimeout(800); await p.click("#" + sid); await p.waitForTimeout(250); w2 = await where(); }
      check("a list in the Settings dialog opens in front of it too (#" + sid + ")", w2 && w2.parent === "settings" && w2.front, w2);
      await p.keyboard.press("Escape"); await p.waitForTimeout(150);
    } else check("a Settings list to try (one with enough items is shown)", false, "none found");
    await ev(() => { const x = document.getElementById("e2e_set533"); if (x) x.remove(); const d = document.getElementById("settings"); if (d.open) d.close(); });

    /* ---- outside a dialog: the page, as before */
    const out = await ev(() => {
      const s = document.createElement("select"); s.id = "e2e_free533"; s.style.cssText = "position:fixed;left:300px;top:300px;z-index:60";
      for (let i = 0; i < 12; i++) { const o = document.createElement("option"); o.value = "v" + i; o.textContent = "Item " + i; s.appendChild(o); }
      document.body.appendChild(s); return true;
    });
    await p.click("#e2e_free533"); await p.waitForTimeout(250);
    const w3 = await where();
    check("a list outside any dialog still opens in the page, in front", out && w3 && w3.parent === "BODY" && w3.front, w3);
    // 2.533.0: a playing video's own "resize" event, or the log scrolling by itself, no longer closes an open list
    const stays = await ev(async () => {
      const v = document.createElement("video"); document.body.appendChild(v);
      v.dispatchEvent(new Event("resize"));                    // what a <video> fires when its picture size is known
      const lg = document.getElementById("log"); if (lg) lg.dispatchEvent(new Event("scroll"));
      await new Promise((r) => setTimeout(r, 80));
      const a = !!document.querySelector(".selsearch"); v.remove();
      window.dispatchEvent(new Event("resize"));               // the window itself = closes, as before
      await new Promise((r) => setTimeout(r, 80));
      return [a, !!document.querySelector(".selsearch")];
    });
    check("…a video's own resize event or the log scrolling leaves it open; the window resizing closes it", stays[0] === true && stays[1] === false, stays);
    await p.click("#e2e_free533"); await p.waitForTimeout(250);
    await p.keyboard.press("Escape");
    await ev(() => document.getElementById("e2e_free533").remove());
    check("hostOf: the list's own dialog, else an open modal dialog, else <body>", await ev(() => { const h = window.__selSearch.hostOf; return h(document.getElementById("cm_folder")) === document.body; }));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("the run finished", false, String(e && e.stack || e)); }
  finally { try { await b.close(); } catch { /* fine */ } }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
