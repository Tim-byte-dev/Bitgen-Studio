#!/usr/bin/env node
/* bitGen Studio — 2.300.1: THE SCENE FILMSTRIP SCROLLS WITH ARROWS, NOT A
 * SCROLLBAR. Run: node scripts/test-filmstrip.js
 *
 * Tim (verbatim): "for the filmstrips in the scenes, remove the scrollbar,
 * add left arrow on the left and right arrow on the right to scroll through
 * the filmstrip, scrollbars make the ui look cheap".
 *   1. the strip's scrollbar is hidden (scrollbar-width:none + the webkit
 *      rule), ◀ sits before it and ▶ after it, labelled;
 *   2. ◀ is dimmed at the start, ▶ at the end, both hidden when it all fits;
 *   3. ▶ / ◀ page by 80% of the visible width and never reach the card
 *      (whose click selects + repaints);
 *   4. the position survives the board's repaint (the 4-second poll used
 *      to throw it back to the start), and a restore that cannot land yet
 *      (frames without widths) is never saved as the user's position.
 * jsdom has no layout, so the strip's widths and scroll are modelled on
 * the element prototype (clientWidth 300, 40 frames x 100px). The same
 * behaviour was checked live in Chromium (arrows, wheel, repaint, poll). */
"use strict";
const path = require("path");
const { execFileSync } = require("child_process");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const ROOT = path.join(__dirname, "..");
const J = (x) => JSON.stringify(x);

const probe = `
const { JSDOM } = require("jsdom");
const fs = require("fs");
const dom = new JSDOM("<body>" + fs.readFileSync("ext/videodock/dock.html", "utf8") + "</body>",
  { url: "http://x/", runScripts: "outside-only", pretendToBeVisual: true });
const w = dom.window;
// ---- a layout model for the strips: 300px visible, one 100px frame each
const SL = new WeakMap();
let clampWidths = true;              // true = the frames have their widths
Object.defineProperty(w.HTMLElement.prototype, "clientWidth", { configurable: true,
  get() { return this.classList && this.classList.contains("scstrip") ? 300 : 0; } });
Object.defineProperty(w.HTMLElement.prototype, "scrollWidth", { configurable: true,
  get() { return this.classList && this.classList.contains("scstrip")
    ? (clampWidths ? this.querySelectorAll("img").length * 100 : 300) : 0; } });
Object.defineProperty(w.HTMLElement.prototype, "scrollLeft", { configurable: true,
  get() { return SL.get(this) || 0; },
  set(v) {
    const max = Math.max(0, this.scrollWidth - this.clientWidth);
    const nv = Math.max(0, Math.min(max, +v || 0));
    if (nv === (SL.get(this) || 0)) return;
    SL.set(this, nv);
    this.dispatchEvent(new w.Event("scroll"));
  } });
w.HTMLElement.prototype.scrollBy = function (o) { this.scrollLeft = this.scrollLeft + ((o && o.left) || 0); };
const board = { chapters: [], pending: [], plan: { shots: [] }, style: "MMH3_NativeAudio_MV", audio: "",
  list: [{ n: 1, id: "c1", prompt: ["a"], status: "rendered", output: "s1.mp4", length: 480, anchor: "reference" },
         { n: 2, id: "c2", prompt: ["b"], status: "idle", anchor: "first" },
         { n: 3, id: "c3", prompt: ["c"], status: "rendered", output: "s3.mp4", length: 24, anchor: "first" }] };
w.fetch = (u, o) => {
  u = String(u); const bare = u.split("?")[0];
  const ok = (b) => Promise.resolve({ ok: true, json: () => Promise.resolve(b) });
  if (bare === "/api/scenes") return ok(JSON.parse(JSON.stringify(board)));
  if (bare === "/api/frames") {
    const n = /s3\\.mp4/.test(u) ? 2 : 40;          // scene 3's short take fits
    return ok({ key: "k" + n, frames: Array.from({ length: n }, (_, i) => ({ file: "f" + i + ".png", t: i / 2 })) });
  }
  if (bare === "/api/pmedia") return ok({ sound: [], images: [] });
  return ok({ ok: true, characters: [], environments: [], refs: {}, movies: [] });
};
global.window = w; global.document = w.document; global.fetch = w.fetch;
global.FormData = w.FormData; global.CustomEvent = w.CustomEvent;
w.eval(fs.readFileSync("static/pmedia.js", "utf8"));
const src = fs.readFileSync("ext/videodock/characters.js", "utf8");
const ids = new Set(); src.replace(/el\\("([\\w-]+)"\\)/g, (m, id) => ids.add(id));
for (const id of ids) if (!w.document.getElementById(id)) {
  const e = w.document.createElement(/Sel$|Select$/.test(id) ? "select" : "input");
  e.id = id; e.style.display = "none"; w.document.body.appendChild(e);
}
w.eval(src);
const q = (s) => w.document.querySelector(s);
const qa = (s) => [...w.document.querySelectorAll(s)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (n) => q('[data-scstrip="' + n + '"]');
const nav = (n) => qa('[data-scstripnav="' + n + '"]').map((b) => ({ dir: b.dataset.dir, dis: b.disabled,
  vis: b.style.visibility, text: b.textContent, label: b.getAttribute("aria-label") }));
(async () => {
  const out = {};
  w.document.dispatchEvent(new w.CustomEvent("vd:scenes-changed"));
  await wait(300);
  const css = (q("#scStripCss") || {}).textContent || "";
  out.css = css;
  const row = q('[data-scstriprow="1"]');
  out.order = row ? [...row.children].map((c) => c.dataset.scstripnav ? "nav" + c.dataset.dir : c.classList.contains("scstrip") ? "strip" : c.tagName) : null;
  out.imgs = strip(1).querySelectorAll("img").length;
  out.nav0 = nav(1);
  out.fits = nav(3);
  const sel0 = qa(".sccard").filter((c) => /background:#20242c/.test(c.getAttribute("style"))).length;
  q('[data-scstripnav="1"][data-dir="1"]').click();
  await wait(50);
  out.afterRight = { left: strip(1).scrollLeft, nav: nav(1).map((x) => x.dis),
    selected: qa(".sccard").filter((c) => /background:#20242c/.test(c.getAttribute("style"))).length - sel0 };
  for (let i = 0; i < 20; i++) q('[data-scstripnav="1"][data-dir="1"]').click();
  await wait(50);
  out.atEnd = { left: strip(1).scrollLeft, nav: nav(1).map((x) => x.dis) };
  q('[data-scstripnav="1"][data-dir="-1"]').click();
  await wait(50);
  out.afterLeft = strip(1).scrollLeft;
  // the board repaints (the poll): the position comes back
  w.document.dispatchEvent(new w.CustomEvent("vd:scenes-changed"));
  await wait(300);
  out.afterRepaint = { left: strip(1).scrollLeft, fresh: !!strip(1) };
  // a repaint whose frames have no widths yet: the clamped scroll is NOT saved
  clampWidths = false;
  w.document.dispatchEvent(new w.CustomEvent("vd:scenes-changed"));
  await wait(300);
  const clamped = strip(1).scrollLeft;
  clampWidths = true;
  qa('[data-scstrip="1"] img').forEach((im) => im.dispatchEvent(new w.Event("load")));   // widths land
  await wait(50);
  out.lateWidths = { clamped, left: strip(1).scrollLeft };
  console.log("@@FS " + JSON.stringify(out));
  process.exit(0);
})();`;
let d = null;
try {
  const o = execFileSync(process.execPath, ["-e", probe], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
  const line = o.split("\n").find((l) => l.startsWith("@@FS "));
  d = line ? JSON.parse(line.slice(5)) : { raw: o.slice(-800) };
} catch (e) { d = { error: String(e.message).slice(0, 800) }; }

check("the strip's scrollbar is hidden (scrollbar-width:none and the webkit scrollbar rule)",
  d && /\.scstrip\{scrollbar-width:none/.test(d.css) && /\.scstrip::-webkit-scrollbar\{display:none/.test(d.css), d && d.css);
check("◀ sits on the LEFT of the strip and ▶ on the RIGHT, labelled for screen readers",
  d && J(d.order) === '["nav-1","strip","nav1"]' && d.nav0 && d.nav0[0].text === "◀" && d.nav0[1].text === "▶"
  && d.nav0[0].label === "Scroll scene 1's frames left" && d.nav0[1].label === "Scroll scene 1's frames right", d && [d.order, d.nav0]);
check("at the start ◀ is dimmed and ▶ is live (40 frames, 300px visible)",
  d && d.imgs === 40 && d.nav0[0].dis === true && d.nav0[1].dis === false, d && d.nav0);
check("a take whose frames all fit shows no arrows", d && d.fits && d.fits.every((x) => x.vis === "hidden" && x.dis), d && d.fits);
check("▶ pages by 80% of the visible width, both arrows live, and the card is NOT selected by it",
  d && d.afterRight && d.afterRight.left === 240 && J(d.afterRight.nav) === "[false,false]" && d.afterRight.selected === 0, d && d.afterRight);
check("at the end ▶ is dimmed; ◀ pages back",
  d && d.atEnd.left === 3700 && J(d.atEnd.nav) === "[false,true]" && d.afterLeft === 3460, d && [d.atEnd, d.afterLeft]);
check("the position SURVIVES the board's repaint (it used to jump back to the start)",
  d && d.afterRepaint && d.afterRepaint.fresh && d.afterRepaint.left === 3460, d && d.afterRepaint);
check("a restore that cannot land yet is never saved - it lands when the frames get their widths",
  d && d.lateWidths && d.lateWidths.clamped === 0 && d.lateWidths.left === 3460, d && d.lateWidths);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
