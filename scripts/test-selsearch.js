#!/usr/bin/env node
/* bitGen Studio — 2.478.0: SEARCH IN EVERY DROPDOWN LIST (static/selsearch.js, window.SelSearch).
 * Tim (verbatim): "add a search/filter input to the dropdown lists like the comfyui nodes".
 * The pure parts (match / rank / itemsOf / eligible) and the list in a jsdom page: opened by a press or a letter,
 * narrowed as you type, the arrows + Enter pick it ("input" + "change" sent), Esc closes it unchanged, lists filled
 * while open are redrawn, the setting (0 = never), data-nosearch, the Settings ▸ General block, index.html loads it. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const S = require(path.join(ROOT, "static", "selsearch.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };

// ---- match
check("match: an empty query keeps everything", S.match("", "Anything").score === 1);
check("match: the whole text > the start > a word start > anywhere > the letters in order",
  S.match("flux", "flux").score > S.match("flux", "flux.2 dev").score && S.match("flux", "flux.2 dev").score > S.match("flux", "My FLUX model").score
  && S.match("flux", "My FLUX model").score > S.match("lux", "flux.2").score && S.match("lux", "flux.2").score > S.match("fx2", "flux.2 dev").score);
check("match: the letters in order find 'FLUX.2 [dev]' from 'flx2'; the hits are the matched letters", (() => { const m = S.match("flx2", "FLUX.2 [dev]"); return m && JSON.stringify(m.hits) === JSON.stringify([[0, 2], [3, 4], [5, 6]]); })(), S.match("flx2", "FLUX.2 [dev]"));
check("match: no match = null (letters out of order too)", S.match("zz", "Gaussian Blur") === null && S.match("rulb", "Blur") === null);
check("match: camelCase and after-a-dash count as word starts", S.match("light", "hard-light").score > S.match("igh", "hard-light").score && S.match("Lora", "myLora").score > S.match("ora", "myLora").score);
check("match: several words must all match, the hits merged", (() => { const m = S.match("soft lig", "Soft Light"); return m && JSON.stringify(m.hits) === JSON.stringify([[0, 4], [5, 8]]) && S.match("soft dark", "Soft Light") === null; })(), S.match("soft lig", "Soft Light"));
// ---- rank
const items = ["Normal", "Multiply", "Screen", "Overlay", "Darken", "Lighten", "Hard Light", "Soft Light", "Difference", "Hue"].map((t, i) => ({ i, value: t.toLowerCase(), text: t, group: "", disabled: false }));
const r = S.rank(items, "lig");
check("rank: best first ('lig' -> Lighten, then the Lights), ties in the list's order", r.map((x) => x.text).join("|") === "Lighten|Hard Light|Soft Light", r.map((x) => x.text));
check("rank: an empty query = the whole list in its order", S.rank(items, " ").map((x) => x.i).join() === items.map((x) => x.i).join());
const gi = [{ i: 0, value: "a", text: "dev", group: "FLUX.2" }, { i: 1, value: "b", text: "base", group: "SDXL" }, { i: 2, value: "sdxl_turbo.safetensors", text: "Turbo", group: "" }];
check("rank: a group's name finds its items; the value finds an item whose label differs", S.rank(gi, "flux").map((x) => x.i).join() === "0" && S.rank(gi, "turbo.saf").map((x) => x.i).join() === "2");

// ---- the page (jsdom)
let JSDOM = null;
try { ({ JSDOM } = require("jsdom")); } catch (e) { /* none */ }
if (!JSDOM) { console.log("SKIP: jsdom is not installed - the page part did not run"); }
else {
  const dom = new JSDOM(`<!doctype html><body><div class="stab" id="stab-general"></div>
<select id="big">${["Normal", "Multiply", "Screen", "Overlay", "Darken", "Lighten", "Hard Light", "Soft Light", "Difference", "Hue"].map((t) => `<option value="${t.toLowerCase()}">${t}</option>`).join("")}<option value="x" disabled>Disabled one</option></select>
<select id="small"><option>A</option><option>B</option></select>
<select id="opt" data-nosearch>${Array.from({ length: 12 }, (_, i) => `<option>o${i}</option>`).join("")}</select>
<select id="grp"><optgroup label="FLUX.2"><option value="f1">dev</option><option value="f2">klein</option></optgroup><optgroup label="SDXL">${Array.from({ length: 8 }, (_, i) => `<option value="s${i}">model ${i}</option>`).join("")}</optgroup></select>
</body>`, { pretendToBeVisual: true, url: "http://localhost/" });
  const w = dom.window, d = w.document;
  w.HTMLElement.prototype.scrollIntoView = function () {};
  const api = S.install(d);
  const big = d.getElementById("big"), events = [];
  big.addEventListener("input", () => events.push("input:" + big.value));
  big.addEventListener("change", () => events.push("change:" + big.value));
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const md = (el) => { const e = new w.MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }); el.dispatchEvent(e); return e.defaultPrevented; };
  const key = (el, k, o) => { const e = new w.KeyboardEvent("keydown", Object.assign({ key: k, bubbles: true, cancelable: true }, o || {})); el.dispatchEvent(e); return e.defaultPrevented; };
  const typeIn = (s) => { const inp = d.querySelector(".selsearch input"); inp.value = s; inp.dispatchEvent(new w.Event("input", { bubbles: true })); return inp; };
  (async () => {
    check("eligible: 8+ items (the default), not a short list, not data-nosearch, not multiple / size > 1", S.eligible(big, 8) && !S.eligible(d.getElementById("small"), 8) && !S.eligible(d.getElementById("opt"), 8) && !S.eligible(big, 0) && S.eligible(d.getElementById("small"), 2));
    check("itemsOf: value, text, its group, disabled", JSON.stringify(S.itemsOf(d.getElementById("grp"))[0]) === JSON.stringify({ i: 0, value: "f1", text: "dev", group: "FLUX.2", disabled: false, title: "", hidden: false }) && S.itemsOf(big)[10].disabled);
    const prevented = md(big); await wait(10);
    const box = d.querySelector(".selsearch");
    check("a press on a long list opens the search list instead of the plain one (the box focused, every item, the current one lit + ✓)", prevented && box && d.activeElement === box.querySelector("input") && api.shown().length === 11 && api.lit() === 0 && box.querySelector(".ssrow.cur"), [prevented, !!box, api.shown().length, api.lit()]);
    typeIn("lig");
    check("typing narrows it, best first; the count; the letters lit", api.shown().join("|") === "Lighten|Hard Light|Soft Light" && d.querySelector(".selsearch .sscount").textContent === "3 of 11" && d.querySelector(".selsearch .ssrow b").textContent === "Lig", api.shown());
    const inp = d.querySelector(".selsearch input");
    key(inp, "ArrowDown");
    check("↓ lights the next match", api.lit() === 6, api.lit());
    key(inp, "Enter");
    check("Enter picks it: the list's value, 'input' + 'change' sent once, the search list gone, the focus back on the list", big.value === "hard light" && events.join() === "input:hard light,change:hard light" && !d.querySelector(".selsearch") && d.activeElement === big, [big.value, events]);
    events.length = 0;
    key(big, "d"); await wait(10);
    check("a letter on a closed list opens it searching for that letter", api.isOpen() && d.querySelector(".selsearch input").value === "d" && api.shown()[0] === "Darken", api.shown());
    key(d.querySelector(".selsearch input"), "Escape");
    check("Esc closes it and nothing changes", !api.isOpen() && big.value === "hard light" && !events.length);
    key(big, "F4"); await wait(10);
    typeIn("disab");
    key(d.querySelector(".selsearch input"), "Enter");
    check("a disabled item cannot be picked", big.value === "hard light" && !events.length);
    api.close();
    md(big); await wait(10);
    d.querySelector(".selsearch .ssrow[data-i='8']").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    check("a click on a row picks it", big.value === "difference" && events.join() === "input:difference,change:difference", events);
    md(big); await wait(10);
    const o = d.createElement("option"); o.value = "lum"; o.textContent = "Luminosity"; big.appendChild(o); await wait(20);
    check("a list filled while open is redrawn", api.shown().includes("Luminosity"), api.shown());
    d.body.dispatchEvent(new w.MouseEvent("pointerdown", { bubbles: true })); // jsdom has PointerEvent? MouseEvent is enough for the listener
    check("a press outside closes it", !api.isOpen());
    md(d.getElementById("grp")); await wait(10);
    check("groups: their names as headers when nothing is typed; a group's name finds its items", d.querySelectorAll(".selsearch .ssgrp").length === 2 && (typeIn("flux"), api.shown().join("|") === "dev|klein"), api.shown());
    api.close();
    check("short lists and data-nosearch keep the plain list", !md(d.getElementById("small")) && !md(d.getElementById("opt")));
    check("Settings ▸ General: 'Search in lists with N or more items' (8), kept in localStorage", d.getElementById("s_selsearch") && d.getElementById("s_selsearch").value === "8");
    const f = d.getElementById("s_selsearch"); f.value = "0"; f.dispatchEvent(new w.Event("change"));
    check("0 = never: the plain list again (the setting kept)", api.min === 0 && !md(big) && JSON.parse(w.localStorage.getItem(S.KEY)).min === 0);
    api.setMin(8);
    const html = fs.readFileSync(path.join(ROOT, "static", "index.html"), "utf8");
    check("index.html loads static/selsearch.js", /<script src="\/static\/selsearch\.js"><\/script>/.test(html));
    console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  })().catch((e) => { console.log("FAIL: " + e.stack); process.exit(1); });
}
if (!JSDOM) { console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }
