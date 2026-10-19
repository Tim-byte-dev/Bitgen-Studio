#!/usr/bin/env node
/* bitGen Studio — 2.410.0 in a REAL browser against the REAL app: 🎤 Karaoke and 🧰 Tools & Properties as dockers that
 * dock left / right of the preview canvas (◧ ◨ and a titlebar drag), the word list following the preview (lit row,
 * the time button moves the preview, ⤓ sets a time from it, 👁 the draft over the canvas - never in a snapshot), Space
 * pausing / playing the preview unless typing, the timeline keys (V B N Y U, I / O, Ctrl+K, ↑ ↓, Home / End, M,
 * Shift+M / Alt+M, Ctrl+Shift+E), markers on the ruler (drag, double-click edit), 📤 Range + 🖼 Export frame.
 * Tim: "make the kareoke and tools dialog into floating dockers, it will dock next to the preview canvas, either left or
 * right. this will make it easier to edit the words and timing while previewing. make spacebar pause the preview
 * playback unless typing... continue with the next stages of the premier gap closure".
 * What speech-to-text "heard" is answered by the test (page.route). Run against the running app (H3_URL, default
 * :8311). No Playwright = SKIP (exit 0). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.410 browser test did not run"); console.log("\nRESULT: 0 failed"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_prem5ui_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const T = fs.mkdtempSync(path.join(os.tmpdir(), "prem5ui_"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
ff(["-f", "lavfi", "-i", "color=c=0x404040:s=320x180:d=6:r=25", "-f", "lavfi", "-i", "sine=frequency=330:duration=6",
    "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40", "-deadline", "realtime", "-c:a", "libopus", "-shortest", path.join(T, "ui5.webm")]);
const HEARD = [["one", 0.5, 0], ["two", 1.2, 0], ["three", 2.0, 1], ["four", 2.8, 1], ["five", 3.6, 1]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 2560, height: 1400 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: P });
    await api("/api/projects/load", { name: P });
    const pdir = path.join(ROOT, "projects", P);
    fs.mkdirSync(path.join(pdir, "sound"), { recursive: true });
    ff(["-f", "lavfi", "-i", "sine=frequency=440:duration=5", path.join(pdir, "sound", "song5.wav")]);
    { const fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(path.join(T, "ui5.webm"))]), "ui5.webm"); await fetch(URL_ + "api/passets", { method: "POST", body: fd }); }
    await p.route("**/api/karaoke/words**", (route) => {
      if (route.request().method() === "POST") return route.continue();
      const words = HEARD.map(([w, t, ln]) => ({ text: w, line: ln, start: t, end: t + 0.4 }));
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, how: "heard", lyrics: false, fixed: false, words, text: "one two\nthree four five" }) });
    });
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlKaraokeGen && window.TlKeys && window.TlMarks && window.TlFloat && window.H3Space && window.TlDeliver && window.TlEdit, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 900);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      document.documentElement.style.setProperty("--tlsh", "560px");
      tl.video = [{ name: "ui5.webm", src: "video", in: 0, out: 6, dur: 6, start: 0, opacity: 1 }];
      tl.vlayers = []; tl.images = []; tl.audio = [mkLayer("A1", [{ name: "song5.wav", start: 1, in: 0, out: 5, dur: 5, volume: 1 }])];
      tl.sel = null; tl.seqMarkers = []; tl.selLayer = "v1";
      PXS = 60; tlSave(); renderTimeline(); TlFloat.show(false); TlCanvas.go(0);
    });
    await p.waitForTimeout(600);
    const key = async (k) => { await p.keyboard.press(k); await p.waitForTimeout(200); };   // the page takes the key before the next evaluate
    const box = (sel) => ev((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, sel);

    /* ---- 1. 🧰 Tools & Properties: dock left / right, float again */
    await ev(() => { TlFloat.show(true); TlFloat.place(1500, 200); });
    const cv0 = await box("#tlCanvasCol");
    await p.click('#tlFloat .tsd-side[data-side="L"]');
    await p.waitForTimeout(250);
    const d1 = await ev(() => ({ par: document.getElementById("tlFloat").parentElement.id, order: [...document.getElementById("tlStage").children].map((x) => x.id),
      side: TlFloat.side(), tools: document.getElementById("tlTools").parentElement.id }));
    const cv1 = await box("#tlCanvasCol"), tf1 = await box("#tlFloat");
    check("🧰 ◧: Tools & Properties docks LEFT of the preview canvas (its column before the canvas), the canvas narrower beside it",
      d1.par === "tlDockL" && d1.order.indexOf("tlDockL") < d1.order.indexOf("tlCanvasCol") && d1.side === "L" && d1.tools === "tlFloat"
      && tf1.x + tf1.w <= cv1.x + 1 && cv1.w < cv0.w - 150 && Math.abs(tf1.y - cv1.y) < 6, { d1, cv0, cv1, tf1 });
    // drag its titlebar to the canvas's RIGHT edge
    const tt = await box("#tlFloatTitle"), cvA = await box("#tlCanvasCol");
    await p.mouse.move(tt.x + 50, tt.y + 15); await p.mouse.down();
    await p.mouse.move(tt.x + 300, tt.y + 60, { steps: 6 });
    await p.mouse.move(cvA.x + cvA.w - 30, cvA.y + 120, { steps: 10 });
    const lit = await ev(() => { const d = document.getElementById("tsdDrop"); return d ? { show: d.style.display, side: d.dataset.side } : null; });
    await p.mouse.up();
    await p.waitForTimeout(250);
    const d2 = await ev(() => ({ par: document.getElementById("tlFloat").parentElement.id, side: TlFloat.side(), left: document.getElementById("tlDockL").classList.contains("none"),
      stored: localStorage.getItem("h3.tlf.side") }));
    check("...dragged out it floats; over the canvas's right edge that side lights up; let go = docked RIGHT (the left column gone), remembered",
      lit && lit.show === "flex" && lit.side === "R" && d2.par === "tlDockR" && d2.side === "R" && d2.left && d2.stored === "R", { lit, d2 });
    await p.click('#tlFloat .tsd-side[data-side="R"]');
    const d3 = await ev(() => ({ pos: getComputedStyle(document.getElementById("tlFloat")).position, par: document.getElementById("tlFloat").parentElement.tagName, side: TlFloat.side() }));
    check("...◨ again: floats over the app again", d3.pos === "fixed" && d3.par === "BODY" && d3.side === "", d3);
    await ev(() => TlFloat.show(false));

    /* ---- 2. 🎤 Karaoke: a docker, the first time on the right; the words follow the preview */
    await p.click("#tlKaraokeGen");
    await p.waitForFunction(() => TlKaraokeGen.shown() && /one two/.test(document.getElementById("kgLyrics").value), null, { timeout: 15000 });
    const k1 = await ev(() => ({ par: document.getElementById("kgDlg").parentElement.id, dlg: document.getElementById("kgDlg").tagName, modal: !!document.querySelector("dialog:modal") }));
    const kb = await box("#kgDlg"), cvk = await box("#tlCanvasCol");
    check("🎤 opens as a DOCKER right of the canvas (the first time), not a modal dialog - the canvas stays usable beside it",
      k1.par === "tlDockR" && k1.dlg === "DIV" && !k1.modal && kb.x >= cvk.x + cvk.w - 1 && cvk.w > 400 && kb.h > 300, { k1, kb, cvk });
    await p.click("#kgTabWords");
    await p.waitForFunction(() => document.querySelectorAll("#kgWords .kg-w").length === 5, null, { timeout: 15000 });
    await ev(() => TlCanvas.go(1 + 1.3));                    // the song starts at 1 s on A1: 2.3 s = 1.3 s into it = "two"
    await p.waitForTimeout(300);
    const f1 = await ev(() => ({ now: TlKaraokeGen.nowRow(), lit: [...document.querySelectorAll("#kgWords .kg-w.now")].map((r) => r.dataset.i) }));
    check("⏱ the word at the preview's position is lit (the song's own seconds: its clip starts at 1 s)", f1.now === 1 && f1.lit.join() === "1", f1);
    await p.click('#kgWords [data-go="2"]');
    await p.waitForTimeout(200);
    const g1 = await ev(() => ({ t: TlCanvas.state.t, ph: playhead, now: TlKaraokeGen.nowRow() }));
    check("...a word's time button puts the preview there (three: 2.0 s in the song = 3.0 s on the timeline)", Math.abs(g1.t - 3) < 0.02 && Math.abs(g1.ph - 3) < 0.02 && g1.now === 2, g1);
    await ev(() => TlCanvas.go(1 + 2.95));
    await p.click('#kgWords [data-i="3"] [data-set="start"]');
    const s1 = await ev(() => ({ w: TlKaraokeGen.words()[3], inp: document.querySelector('#kgWords [data-i="3"] input[data-k="start"]').value, t: document.querySelector('#kgWords [data-i="3"] .t').textContent }));
    check("...⤓ sets a word's start to where the preview is (2.95 s in the song), the box and its time button follow", s1.w.start === 2.95 && s1.inp === "2.95" && s1.t === "0:02.95", s1);
    // 👁 the draft: over the canvas, never in the picture
    const orange = () => ev(() => {
      const c = document.getElementById("tlCanvas"), g = c.getContext("2d"), d = g.getImageData(0, 0, c.width, c.height).data; let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 120 && d[i + 1] < 185 && d[i + 2] < 90) n++;
      return n;
    });
    await ev(() => { document.getElementById("kgDraft").checked = true; document.getElementById("kgDraft").dispatchEvent(new Event("change")); TlCanvas.go(1 + 3.0); TlCanvas.draw(); });
    const on = await orange();
    await ev(() => { document.getElementById("kgDraft").checked = false; document.getElementById("kgDraft").dispatchEvent(new Event("change")); TlCanvas.draw(); });
    const off = await orange();
    await ev(() => { document.getElementById("kgDraft").checked = true; document.getElementById("kgDraft").dispatchEvent(new Event("change")); });
    const snapOrange = await ev(() => new Promise((res) => {
      const im = new Image(); im.onload = () => { const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.drawImage(im, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 120 && d[i + 1] < 185 && d[i + 2] < 90) n++; res(n); };
      im.src = TlCanvas.snapshot();
    }));
    check("👁 the corrected words drawn over the canvas (the sung ones lit) while it is on; off = gone; a snapshot / the movie never has it",
      on > 40 && off === 0 && snapOrange === 0, { on, off, snapOrange });

    /* ---- 3. Space */
    const gal = await box("#gallerydock") || await box("#queuedock") || { x: 5, y: 5, w: 10, h: 10 };
    await ev(() => { TlCanvas.go(0.5); TlCanvas.play(); document.getElementById("kgTabWords").focus(); });
    await p.mouse.move(kb.x + kb.w / 2, kb.y + 60);
    await p.keyboard.press("Space");
    await p.waitForTimeout(150);
    const sp1 = await ev(() => ({ playing: TlCanvas.state.playing, words: !document.getElementById("kgWords").hidden, focus: document.activeElement.id }));
    check("Space with the pointer over the karaoke docker and a button focused: the preview PAUSES (the button is not pressed)", !sp1.playing && sp1.words && sp1.focus === "kgTabWords", sp1);
    await ev(() => { TlCanvas.play(); const i = document.querySelector('#kgWords [data-i="0"] input[data-k="text"]'); i.focus(); i.setSelectionRange(3, 3); });
    await p.keyboard.press("Space");
    await p.waitForTimeout(150);
    const sp2 = await ev(() => ({ playing: TlCanvas.state.playing, v: document.querySelector('#kgWords [data-i="0"] input[data-k="text"]').value }));
    check("...typing in a word box: Space types a space, the preview keeps playing", sp2.playing && sp2.v === "one ", sp2);
    await ev(() => { document.activeElement.blur(); });
    await p.mouse.move(gal.x + gal.w / 2, gal.y + Math.min(200, gal.h / 2));
    await p.keyboard.press("Space");
    await p.waitForTimeout(150);
    const sp3 = await ev(() => TlCanvas.state.playing);
    const sc = await box("#tlscroll");
    // a point on the layers that nothing floats over (the prompt docker floats over the middle of a fresh layout)
    const lp = await ev(() => { const r = document.getElementById("tlscroll").getBoundingClientRect();
      for (let y = r.top + 30; y < r.bottom - 5; y += 8) for (let x = r.left + 200; x < r.right - 20; x += 60) {
        const e = document.elementFromPoint(x, y); if (e && e.closest("#tlscroll") && !e.closest(".clip, #playhead, .tlmk")) return { x, y }; }
      return { x: r.left + 300, y: r.top + 40 }; });
    await p.mouse.move(lp.x, lp.y);
    await p.keyboard.press("Space");
    await p.waitForTimeout(150);
    const sp4 = await ev(() => TlCanvas.state.playing);
    await p.keyboard.press("Space");
    await p.waitForTimeout(150);
    const sp5 = await ev(() => TlCanvas.state.playing);
    check("...pointer elsewhere in the app: Space pauses it there too; over the timeline's layers Space plays it, again pauses", !sp3 && sp4 && !sp5, { sp3, sp4, sp5 });
    const cw = await box("#tlCanvasWrap");
    await p.mouse.move(cw.x + cw.w / 2, cw.y + cw.h / 2);
    await p.keyboard.press("Space");
    await p.waitForTimeout(200);
    const sp6 = await ev(() => TlCanvas.state.playing);
    await p.keyboard.press("Space");
    await p.waitForTimeout(150);
    const sp7 = await ev(() => TlCanvas.state.playing);
    check("...over the canvas a tap plays (the canvas's own Space: hold = the hand) and pauses at once while it plays", sp6 && !sp7, { sp6, sp7 });

    /* ---- 4. the timeline keys (pointer over the layers) */
    await p.mouse.move(lp.x, lp.y);
    const modes = [];
    for (const k of ["b", "n", "y", "u", "v"]) { await key(k); modes.push(await ev(() => TlEdit.mode())); }
    check("V B N Y U over the layers = the edit tools (ripple, roll, slip, slide, select)", modes.join() === "ripple,roll,slip,slide,select", modes);
    await key("b");
    await p.mouse.move(cw.x + cw.w / 2, cw.y + cw.h / 2);
    await key("v");
    const cvKey = await ev(() => ({ mode: TlEdit.mode(), tool: TlCanvas.state.tool }));
    check("...over the canvas V is the canvas's Move tool - the edit tool is left as it was", cvKey.mode === "ripple" && cvKey.tool === "move", cvKey);
    await p.mouse.move(lp.x, lp.y);
    await key("v");
    await ev(() => TlCanvas.go(2)); await key("i");
    await ev(() => TlCanvas.go(4)); await key("o");
    const io = await ev(() => tl.sel);
    check("I / O: the ruler selection's In at 2 s, Out at 4 s", io && Math.abs(io.a - 2) < 0.05 && Math.abs(io.b - 4) < 0.05, io);
    await ev(() => TlCanvas.go(2.5)); await key("m");
    await ev(() => TlCanvas.go(5)); await key("m");
    const mk1 = await ev(() => ({ L: TlMarks.list().map((m) => m.t), flags: document.querySelectorAll("#tlinner .tlruler .tlmk").length, lines: document.querySelectorAll("#tlinner .tlmk-line").length }));
    check("M: markers at the position marker (2.5 s, 5 s), flags on the ruler + lines down the layers", mk1.L.join() === "2.5,5" && mk1.flags === 2 && mk1.lines === 2, mk1);
    await key("Home"); const h0 = await ev(() => TlCanvas.state.t);
    await key("Shift+M"); const n1 = await ev(() => TlCanvas.state.t);
    await key("Shift+M"); const n2 = await ev(() => TlCanvas.state.t);
    await key("Alt+m"); const p1 = await ev(() => TlCanvas.state.t);
    await key("End"); const e0 = await ev(() => TlCanvas.state.t);
    check("Home = 0, Shift+M next marker (2.5, 5), Alt+M previous (2.5), End = the timeline's end (6 s)", h0 === 0 && n1 === 2.5 && n2 === 5 && p1 === 2.5 && Math.abs(e0 - 6) < 1e-6, [h0, n1, n2, p1, e0]);
    await key("Home");
    const eps = [];
    for (let i = 0; i < 2; i++) { await key("ArrowDown"); eps.push(await ev(() => TlCanvas.state.t)); }
    await key("ArrowUp"); eps.push(await ev(() => TlCanvas.state.t));
    check("↓ / ↑: the next / previous edit point (the song's start 1 s, the ends at 6 s, back to 1 s)", eps.join() === "1,6,1", eps);
    await ev(() => { TlCanvas.go(3); tl.selLayer = "v1"; try { TlCanvas.select(null); } catch (e) { /* none */ }
      window.__kd = []; document.addEventListener("keydown", (e) => window.__kd.push(e.key + (e.ctrlKey ? "+c" : "") + (e.defaultPrevented ? "!" : "") + "@" + document.activeElement.tagName + "#" + document.activeElement.id + ":" + TlKeys.onLayers()), true); });
    await p.waitForTimeout(300);                              // the selection's repaint settles first
    await key("Control+k");
    await p.waitForFunction(() => tl.video.length === 2, null, { timeout: 4000 }).catch(() => {});
    const sp = await ev(() => tl.video.map((c) => [c.start, c.in, c.out]));
    const spWhy = await ev(() => ({ sb: document.getElementById("sblog").textContent, sel: typeof tlSelClip !== "undefined" && tlSelClip ? tlSelClip.name : null, lk: tl.selLayer, ph: playhead, on: TlKeys.onLayers(), act: document.activeElement.tagName + "#" + document.activeElement.id, kd: window.__kd }));
    check("Ctrl+K: V1's clip split at the position marker (0-3 + 3-6, the right one's source moved on)", JSON.stringify(sp) === "[[0,0,3],[3,3,6]]", { sp, spWhy });
    // a marker's flag: drag it 1 s, double-click to name + colour it
    await ev(() => renderTimeline());
    // 2.412.0: a floating docker left over the ruler by an earlier test (the gate's layout) would take the clicks - the
    // panels that cover the flag's row are set aside for this step
    const hid = await ev(() => { const f = document.querySelector("#tlinner .tlruler .tlmk"), r = f.getBoundingClientRect(), y = r.y + 4, out = [];
      for (let x = r.x - 40; x < r.x + 160; x += 10) { const e = document.elementFromPoint(x, y); const pnl = e && e.closest(".pf-float, .df-float, .dfm-float, .bdock.pf-free");
        if (pnl && pnl.style.visibility !== "hidden") { pnl.dataset.p5hid = "1"; pnl.style.visibility = "hidden"; out.push(pnl.id || pnl.className); } }
      return out; });
    const fl = await box("#tlinner .tlruler .tlmk");
    await p.mouse.move(fl.x + fl.w / 2, fl.y + 4); await p.mouse.down(); await p.mouse.move(fl.x + fl.w / 2 + 60, fl.y + 4, { steps: 6 }); await p.mouse.up();
    const mv = await ev(() => TlMarks.list().map((m) => m.t));
    const fl2 = await box("#tlinner .tlruler .tlmk");
    await p.waitForTimeout(250);                              // 2.411.0: the drag's repaint settles first (a loaded gate machine)
    await p.mouse.dblclick(fl2.x + fl2.w / 2, fl2.y + 4);
    if (!(await p.waitForSelector(".tlmk-pop", { timeout: 4000 }).catch(() => null))) {   // the two clicks too far apart under load: once more
      const fl3 = await box("#tlinner .tlruler .tlmk");
      await p.mouse.dblclick(fl3.x + fl3.w / 2, fl3.y + 4);
      await p.waitForSelector(".tlmk-pop");
    }
    await p.fill("#tlmkName", "Chorus");
    await p.click('.tlmk-pop [data-c="red"]');
    await p.click("#tlmkOk");
    const ed = await ev(() => TlMarks.list()[0]);
    check("a marker's flag: dragged 1 s later (2.5 -> 3.5); double-click = name + colour", mv.join() === "3.5,5" && ed.name === "Chorus" && ed.color === "red" && ed.t === 3.5, { mv, ed });
    await ev(() => TlCanvas.go(5)); await p.mouse.move(lp.x, lp.y); await key("m");
    const mm = await ev(() => ({ pop: !!document.querySelector(".tlmk-pop"), n: TlMarks.list().length, focus: document.activeElement.id }));
    await key("Escape");
    check("M on a marker opens its editor instead of a second one (Premiere's M M); Esc closes it", mm.pop && mm.n === 2 && mm.focus === "tlmkName"
      && await ev(() => !document.querySelector(".tlmk-pop")), mm);
    await ev(() => document.querySelectorAll("[data-p5hid]").forEach((e) => { e.style.visibility = ""; delete e.dataset.p5hid; }));

    /* ---- 5. 📤 Range + 🖼 Export frame (+ Ctrl+Shift+E) */
    await p.click("#tlDeliverBtn");
    await p.waitForSelector('input[name="tdlRange"]');
    await p.check('input[name="tdlRange"][value="io"]');
    const rg = await ev(() => ({ r: tl.deliverRange, io: document.getElementById("tdlIo").textContent }));
    check("📤 Range: In / Out only (the ruler selection 2.00 – 4.00 s) kept on the timeline", rg.r === "io" && /2\.00 – 4\.00 s/.test(rg.io), rg);
    await ev(() => TlCanvas.go(3.2));
    await p.click("#tdlStill");
    await p.waitForFunction(() => [...document.querySelectorAll("#tdlFiles a")].some((a) => /_frame_\d\dh\d\dm\d\ds\d\d\.png/.test(a.textContent)), null, { timeout: 15000 }).catch(() => {});
    const files = fs.readdirSync(pdir).filter((f) => /_frame_.*\.png$/.test(f));
    const W = await ev(() => [TlCanvas.state.W, TlCanvas.state.H]);
    const dim = files[0] ? JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "json", path.join(pdir, files[0])], { encoding: "utf8" })).streams[0] : {};
    check("🖼 Export frame: the picture at the position marker saved as <project>_frame_00h00m03s05.png (the canvas's size), listed under Delivered",
      files.length === 1 && /_frame_00h00m03s05\.png$/.test(files[0]) && dim.width === W[0] && dim.height === W[1], { files, dim, W });
    await ev(() => { document.querySelector("#tlDeliverDlg .fx-x").click(); TlCanvas.go(1); });
    await p.mouse.move(cw.x + cw.w / 2, cw.y + cw.h / 2);
    await key("Control+Shift+E");
    let n = 0; for (let i = 0; i < 40 && n < 2; i++) { await sleep(250); n = fs.readdirSync(pdir).filter((f) => /_frame_.*\.png$/.test(f)).length; }
    check("Ctrl+Shift+E (over the canvas too): another frame (at 1 s)", n === 2 && fs.existsSync(path.join(pdir, P + "_frame_00h00m01s00.png")), fs.readdirSync(pdir).filter((f) => /png$/.test(f)));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + String(e.stack || e).split("\n").slice(0, 3).join(" ")); if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT }).catch(() => {}); }
  finally {
    try { await ev(() => { TlKaraokeGen.close(); TlFloat.show(false); tl.video = []; tl.audio = []; tl.seqMarkers = []; tl.sel = null; tlSave(); }); } catch { /* closed */ }
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
    try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ }
    console.log(`\n${pass} passed, ${fail} failed`);
    console.log("RESULT: " + fail + " failed");
    process.exit(fail ? 1 : 0);
  }
})();
