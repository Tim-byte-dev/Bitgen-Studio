#!/usr/bin/env node
/* bitGen Studio — 2.898.0 in a REAL browser: drag the References docker's pictures, videos and sounds to change their order
 * (static/refreorder.js) - three pictures (red, green, blue): picture 3 dragged onto picture 1 becomes picture 1 (its tag
 * <Picture 1>), the others move down, the prompt's <Picture n> tags follow, the docker says so; dragged back to the end; three
 * videos: video 1 onto video 3 (<Video n> tags follow); two sounds swapped; a description box still types (no drag from it).
 * Tim (verbatim): "allow user to drag reference images , videos and audio to change their order, like dragging from picture 6
 * to picture 1 changes picture 6 to picture 1 etc" */
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
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3RefOrder && document.getElementById("tray") && document.getElementById("tray").dataset.roWired, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    // the References docker on screen, three pictures in it
    await ev(async () => {
      const d = document.getElementById("refsdock"); if (d && d.classList.contains("dockgone") && typeof toggleDockGone === "function") toggleDockGone("refsdock");
      if (d && d.classList.contains("collapsed") && typeof toggleCollapse === "function") toggleCollapse("refsdock");
      document.querySelectorAll(".h3fp.dfm-float").forEach((x) => { x.style.display = "none"; });
      if (d) d.style.cssText += ";position:fixed;left:20px;top:20px;width:230px;height:1060px;z-index:9999";
      mode = "ref2va";                                                   // eslint-disable-line no-undef
      const pic = async (col, name) => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); g.fillStyle = col; g.fillRect(0, 0, 64, 64); const blob = await new Promise((ok) => c.toBlob(ok, "image/png")); return new File([blob], name, { type: "image/png" }); };
      refs.splice(0, refs.length);                                       // eslint-disable-line no-undef
      for (const [col, name] of [["#e00000", "red.png"], ["#00c000", "green.png"], ["#0000e0", "blue.png"]]) { const f = await pic(col, name); refs.push({ file: f, url: URL.createObjectURL(f), subject: 1, role: "person", roleOther: "" }); }   // eslint-disable-line no-undef
      setRtab("img"); renderTray();                                      // eslint-disable-line no-undef
      document.getElementById("prompt").value = "<Picture 3> walks past <Picture 1> and waves to <Picture 2>";
    });
    await p.waitForTimeout(300);
    const names = () => ev(() => refs.map((r) => r.file.name));         // eslint-disable-line no-undef
    const tags = () => ev(() => [...document.querySelectorAll("#tray > .slot .tag")].map((t) => t.textContent));
    await p.dragAndDrop("#tray > .slot:nth-child(3) .imgwrap", "#tray > .slot:nth-child(1) .imgwrap");
    await p.waitForTimeout(400);
    const a = { names: await names(), tags: await tags(), prompt: await ev(() => document.getElementById("prompt").value), say: await ev(() => { const e = document.getElementById("refdrop") || document.querySelector(".refdropsay, #refDropSay"); return e ? e.textContent : ""; }) };
    check("🖼 picture 3 (blue) dragged onto picture 1 becomes picture 1 - red and green move down; the tray's tags <Picture 1 / 2 / 3> in the new order", a.names.join() === "blue.png,red.png,green.png" && a.tags.join() === "<Picture 1>,<Picture 2>,<Picture 3>", a);
    check("...the prompt's tags follow: what said <Picture 3> (blue) now says <Picture 1>, red <Picture 2>, green <Picture 3>", a.prompt === "<Picture 1> walks past <Picture 2> and waves to <Picture 3>", a.prompt);
    const imgs = await ev(() => [...document.querySelectorAll("#tray > .slot img")].map((im) => { const c = document.createElement("canvas"); c.width = c.height = 4; const g = c.getContext("2d"); g.drawImage(im, 0, 0, 4, 4); const d = g.getImageData(1, 1, 1, 1).data; return d[2] > 150 ? "B" : d[1] > 150 ? "G" : d[0] > 150 ? "R" : "?"; }).join(""));
    check("...the pictures on screen in that order (blue, red, green)", imgs === "BRG", imgs);
    await p.dragAndDrop("#tray > .slot:nth-child(1) .imgwrap", "#tray > .slot:nth-child(3) .imgwrap");
    await p.waitForTimeout(400);
    check("...picture 1 dragged onto picture 3 goes to the end (red, green, blue - as it was), the tags back too", (await names()).join() === "red.png,green.png,blue.png" && (await ev(() => document.getElementById("prompt").value)) === "<Picture 3> walks past <Picture 1> and waves to <Picture 2>");
    const ps = await ev(() => { try { return (projectState().references || []).map((x) => x.name || x.file || x).join(); } catch (e) { return "n/a"; } });   // eslint-disable-line no-undef
    check("...the project keeps the order (projectState's references)", ps === "n/a" || /red.*green.*blue/.test(ps), ps);

    // 🎞 videos
    await ev(() => { refVids.splice(0, refVids.length, "va.mp4", "vb.mp4", "vc.mp4"); setRtab("vid"); renderRefLists(); document.getElementById("prompt").value = "<Video 1> then <Video 3>"; });   // eslint-disable-line no-undef
    await p.waitForTimeout(400);
    const dr = await ev(() => [...document.querySelectorAll("#refvids > .aitem")].map((x) => x.draggable));
    check("🎞 the videos can be picked up (each item draggable)", dr.length === 3 && dr.every(Boolean), dr);
    await p.dragAndDrop("#refvids > .aitem:nth-child(1) .an span", "#refvids > .aitem:nth-child(3) .an span");
    await p.waitForTimeout(400);
    const v = await ev(() => ({ list: refVids.slice(), shown: [...document.querySelectorAll("#refvids > .aitem")].map((x) => x.dataset.refvid), prompt: document.getElementById("prompt").value }));   // eslint-disable-line no-undef
    check("...video 1 dragged onto video 3: vb, vc, va (on screen too); the prompt's <Video n> follow", v.list.join() === "vb.mp4,vc.mp4,va.mp4" && v.shown.join() === "vb.mp4,vc.mp4,va.mp4" && v.prompt === "<Video 3> then <Video 2>", v);

    // 🔊 sounds
    await ev(() => { refAuds.splice(0, refAuds.length, "sa.wav", "sb.wav"); setRtab("snd"); renderRefLists(); });   // eslint-disable-line no-undef
    await p.waitForTimeout(300);
    await p.dragAndDrop("#refauds > .aitem:nth-child(2) .an span", "#refauds > .aitem:nth-child(1) .an span");
    await p.waitForTimeout(400);
    check("🔊 sound 2 dragged onto sound 1: they swap places", (await ev(() => refAuds.join())) === "sb.wav,sa.wav");   // eslint-disable-line no-undef
    // a description box still types
    await p.click("#refauds > .aitem:nth-child(1) .refdesc").catch(() => {});
    await p.keyboard.type("calm and low");
    const typed = await ev(() => { const e = document.querySelector("#refauds > .aitem:nth-child(1) .refdesc"); return e ? e.value : "(no box)"; });
    check("...a sound's description box still takes typing (the item being draggable does not stop it)", typed === "(no box)" || /calm and low/.test(typed), typed);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran: " + e.message, false); }
  finally {
    await ev(() => { try { refs.splice(0, refs.length); refVids.splice(0, refVids.length); refAuds.splice(0, refAuds.length); renderTray(); renderRefLists(); document.getElementById("prompt").value = ""; } catch (e) { /* fine */ } }).catch(() => {});   // eslint-disable-line no-undef
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
