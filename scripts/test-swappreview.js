#!/usr/bin/env node
/* bitGen Studio — 2.347.0: the swap dialog's big preview shows what was made.
 * Run: node scripts/test-swappreview.js
 * Tim: "when user clicks on one of the generated pictures in swap character
 * dialog open it in the preview window. do the same with the generated video".
 *   1. a ✎ first-frame picture clicked -> over the big preview, "✕ back to
 *      the video" shown, the player paused;
 *   2. ✕ / Esc -> back to the video being swapped (Esc does not close the
 *      dialog while something is shown);
 *   3. a finished segment's row clicked -> it plays in the big preview (and
 *      becomes the Result, so 💾 / ↻ act on it); the box loop steps aside;
 *   4. touching the box (a segment chip) -> back to the source video. */
"use strict";
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 400) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const S = read("static", "swapdlg.js");
check("the markup: a picture layer + a back button inside the big preview", S.includes('<img class="swPrevImg" alt="" hidden><button type="button" class="swPrevBack" hidden'));
check("the box loop steps aside while a result plays there", S.includes("if (cur.view) return;                              // 2.347.0"));

(async () => {
  let JSDOM;
  try { ({ JSDOM } = require("jsdom")); } catch { console.log("(jsdom missing - the dialog checks are skipped)"); return done(); }
  const dom = new JSDOM('<!doctype html><body><button id="vdSwapDlg">⇄ Swap</button></body>', { runScripts: "outside-only", pretendToBeVisual: true, url: "http://127.0.0.1/" });
  const w = dom.window, d = w.document;
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  w.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  let paused = 0, played = 0;
  w.HTMLMediaElement.prototype.pause = function () { paused++; };
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.play = function () { played++; return Promise.resolve(); };
  const STATE = { video: "movie.mp4", picture: "p.png", text: "", max: 2, ceiling: 362, max_seconds: 15, best_seconds: 5, picture_url: "",
    engine: "ripple", engines: [], quality: "full",
    segments: [{ id: "g1", start: 0, dur: 2, frames: 48, ff: { status: "done", file: "_ripple_ff_g1.png", at: 1 } },
               { id: "g2", start: 2, dur: 2, frames: 48 }],
    results: [{ id: "r1", seg: "g1", start: 0, dur: 2, status: "done", engine: "ripple", where: "temp", file: "movie_swap_01.mp4", seed: 5 }],
    settings: {}, video_info: { width: 1920, height: 1080 }, render_size: { width: 1376, height: 768, auto: true }, loras: [] };
  w.fetch = async (url) => {
    const J = (x) => ({ ok: true, json: async () => x });
    if (url.startsWith("/api/swapdlg/info")) return J({ name: "movie.mp4", fps: 24, frames: 96, duration: 4, width: 1920, height: 1080 });
    if (url.startsWith("/api/frames")) return J({ key: "k", frames: [] });
    return J(STATE);
  };
  w.eval(S);
  const SD = w.SwapDialog;
  SD.install({ size: () => ({}), styleId: () => "", styleName: () => "", drag: () => null, refVideo: () => "", note: () => {},
               confirm: async () => true, llmFile: () => "", refreshAssets: () => {} });
  d.getElementById("vdSwapDlg").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 80));
  const dlg = d.querySelector("dialog.swdlg[open]");
  const q = (c) => dlg.querySelector("." + c);
  const prev = q("swPrev"), img = q("swPrevImg"), back = q("swPrevBack");
  const src0 = prev.getAttribute("src");
  check("the video being swapped is in the preview", /\/passets\/video\/movie\.mp4$/.test(src0), src0);

  // 1. a first frame
  const ffImg = dlg.querySelector(".swFFCard img");
  const p0 = paused;
  ffImg.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  check("2.348.0: a single click on the picture does NOT open it (single = select)", img.hidden && back.hidden);
  ffImg.dispatchEvent(new w.MouseEvent("dblclick", { bubbles: true }));
  check("a ✎ first frame DOUBLE-clicked -> shown over the big preview (its own picture), the player paused, the back button says what it is",
    !img.hidden && img.getAttribute("src") === ffImg.getAttribute("src") && paused > p0 && !back.hidden
    && /^✕ back to the video · first frame #1 at \S+$/.test(back.textContent), { src: img.getAttribute("src"), back: back.textContent });
  check("...the line says so", /🖼 first frame #1 .*in the preview - ✕ \(or Esc\) goes back to the video/.test(q("swMsg").textContent), q("swMsg").textContent);

  // 2. Esc = back (the dialog stays open)
  dlg.dispatchEvent(new w.Event("cancel", { cancelable: true }));
  check("Esc leaves the picture - the dialog stays open, the video is back", !!d.querySelector("dialog.swdlg[open]") && img.hidden && back.hidden
    && prev.getAttribute("src") === src0);

  // 3. a finished segment
  const nm = dlg.querySelector(".swTempL .swRow .nm");
  const pl0 = played;
  nm.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  check("2.348.0: a single click on a finished segment = it becomes the Result, the big preview stays on the video",
    prev.getAttribute("src") === src0 && back.hidden && q("swOut").getAttribute("src") === "/api/swapdlg/file/temp/movie_swap_01.mp4");
  nm.dispatchEvent(new w.MouseEvent("dblclick", { bubbles: true }));
  check("a finished segment's row DOUBLE-clicked -> it plays in the big preview", prev.getAttribute("src") === "/api/swapdlg/file/temp/movie_swap_01.mp4"
    && played > pl0 && !back.hidden && /movie_swap_01\.mp4/.test(back.textContent), { src: prev.getAttribute("src"), back: back.textContent });
  check("...and it is the Result too (💾 / ↻ act on it)", q("swOut").getAttribute("src") === "/api/swapdlg/file/temp/movie_swap_01.mp4"
    && !q("swSave").disabled && /movie_swap_01\.mp4/.test(q("swOutName").textContent));
  prev.currentTime = 1.5; prev.dispatchEvent(new w.Event("timeupdate"));
  check("...the box loop does not yank it back to the box", prev.getAttribute("src") === "/api/swapdlg/file/temp/movie_swap_01.mp4");
  back.click();
  check("✕ back to the video -> the source video again", prev.getAttribute("src") === src0 && back.hidden, prev.getAttribute("src"));

  // 4. the box
  nm.dispatchEvent(new w.MouseEvent("dblclick", { bubbles: true }));
  const chip = dlg.querySelector(".swChip");
  if (chip) chip.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  check("touching the box (a segment chip) -> back to the source video", !chip || (prev.getAttribute("src") === src0 && back.hidden), prev.getAttribute("src"));
  done();
})();
function done() {
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
