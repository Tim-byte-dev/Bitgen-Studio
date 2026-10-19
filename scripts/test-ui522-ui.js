#!/usr/bin/env node
/* bitGen Studio — 2.522.0 in a REAL browser: 🐞 THE BUG REPORT docker - Ctrl+Alt+Shift+B (a screenshot first, then the
 * docker), marks on the screenshot, the recorded steps (never what was typed), page errors + failed requests, 👁 what is
 * included (the secrets hidden), 💾 Save -> the .zip downloaded and read back, the list (⤓ / 🗑), Settings' 🐞 button.
 * Tim (verbatim): "can you add a bug report floating docker - ctrl+alt+shift+b opens it. this will be where a user can
 * document bugs and send to the repo. i will upload the bug report file to you"
 * Against the running app (H3_URL, default :8311). In a browser there is no Electron capture - the test gives the page one
 * (window.h3shell.capture.shot = a real screenshot of the page through playwright). It sets a Civitai key to see it hidden
 * and puts it (and the energy price it types) back; the reports it made are deleted. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.522 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body, method) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined && !method ? {} : { method: method || "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })).json();
const SECRET = "e2e-civitai-secret-522xyz";
const TYPED = "my-private-words-522";

(async () => {
  const cfg0 = await api("/api/config");
  const civ0 = Object.assign({ token: "" }, cfg0.civitai || {}), pow0 = Object.assign({ price_kwh: 0, supply_day: 0, peak_price_kwh: 0, peak_windows: [] }, cfg0.power || {});
  const before = new Set((await api("/api/bugreport")).map((r) => r.id));
  await api("/api/config", { civitai: Object.assign({}, civ0, { token: SECRET }) });
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg522ui-"));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 }, acceptDownloads: true });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  await p.exposeFunction("__shot", async () => (await p.screenshot()).toString("base64"));
  await p.addInitScript(() => { window.h3shell = Object.assign(window.h3shell || {}, { capture: { shot: async () => { const s = atob(await window.__shot()); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; } } }); });
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3BugReport && document.getElementById("brBody"), null, { timeout: 60000 });
    await p.waitForTimeout(1200);

    /* ---- what the recorder sees */
    await p.click("#ltBtn"); await p.waitForTimeout(800);
    await p.click("#openSettings"); await p.waitForTimeout(500);
    await p.fill("#s_kwh", "0.31"); await p.dispatchEvent("#s_kwh", "change");
    await p.click('#settings .stabs [data-stab="models"]'); await p.waitForTimeout(300);
    await p.keyboard.press("Escape"); await p.waitForTimeout(300);
    await ev((t) => { const i = document.createElement("input"); i.id = "e2eTyped"; document.body.appendChild(i); i.focus(); }, TYPED);
    await p.keyboard.type(TYPED); await p.keyboard.press("Tab");   // leaving the box fires its change
    await ev(() => { setTimeout(() => { throw new Error("e2e boom 522"); }, 0); });
    await ev(() => fetch("/api/e2e-nope-522").catch(() => {}));
    await p.waitForTimeout(400);
    const steps = await ev(() => H3BugReport.steps().map((s) => s.what));
    check("the recorder: clicks with their docker / the menu bar, 'edited' for a text box, the Settings tab, a shortcut key",
      steps.some((s) => /click "🎓 LoRA" \(#ltBtn\)/.test(s)) && steps.some((s) => /click .*#openSettings.* in the menu bar/.test(s)) && steps.some((s) => /edited .*#s_kwh in Settings -> General/.test(s)) && steps.some((s) => /key Escape/.test(s)), steps);
    check("…only what a person did (the app's own scripted clicks are not steps); NEVER what was typed (a box only says 'edited #id')", !JSON.stringify(steps).includes(TYPED) && steps.filter((s) => /edited #e2eTyped/.test(s)).length === 1 && !steps.some((s) => /in Basic Settings|in rdock/.test(s)), steps);
    const er = await ev(() => ({ e: H3BugReport.errors(), f: H3BugReport.failed() }));
    check("page errors and failed requests are kept (method, path, status)", er.e.some((x) => /e2e boom 522/.test(x)) && er.f.some((x) => /GET \/api\/e2e-nope-522 -> 404/.test(x)), er);

    /* ---- Ctrl+Alt+Shift+B */
    await p.keyboard.press("Control+Alt+Shift+KeyB");
    await p.waitForFunction(() => { const s = SecFloat.state("bugreport"); return s && s.shown && H3BugReport.state().img; }, null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(400);
    const o = await ev(() => ({ shown: SecFloat.state("bugreport").shown, img: !!H3BugReport.state().img, w: document.getElementById("brCanvas").width, focus: document.activeElement && document.activeElement.id, area: document.getElementById("brArea").value, sev: [...document.querySelectorAll("#brSev option")].map((x) => x.value) }));
    check("Ctrl+Alt+Shift+B (while a text box had focus): the window's screenshot first (1700 px), then the docker - the title box focused",
      o.shown && o.img && o.w === 1700 && o.focus === "brTitle", o);
    check("severity: crash / broken / wrong / looks / idea; Where = the docker used last", o.sev.join() === "crash,broken,wrong,looks,idea" && /Settings|LoRA/.test(o.area), o);
    const shot0 = await ev(() => document.getElementById("brCanvas").toDataURL());
    const cv = await p.$("#brCanvas"), bb = await cv.boundingBox();
    await p.click('#brBody .tool[data-tool="box"]');
    await p.mouse.move(bb.x + 30, bb.y + 20); await p.mouse.down(); await p.mouse.move(bb.x + 160, bb.y + 90, { steps: 4 }); await p.mouse.up();
    await p.click('#brBody .tool[data-tool="pen"]');
    await p.mouse.move(bb.x + 200, bb.y + 40); await p.mouse.down(); await p.mouse.move(bb.x + 260, bb.y + 70, { steps: 6 }); await p.mouse.up();
    const mk = await ev(() => ({ n: H3BugReport.state().marks.length, info: document.getElementById("brShotInfo").textContent, changed: document.getElementById("brCanvas").toDataURL() }));
    check("✏ / ▭ marks drawn in red on the screenshot (2 marks), the info line says so", mk.n === 2 && /2 mark\(s\)/.test(mk.info) && mk.changed !== shot0, mk.info);
    await p.click("#brUndo");
    check("↶ Undo takes the last mark off", (await ev(() => H3BugReport.state().marks.length)) === 1);

    await p.fill("#brTitle", "E2E 522 - the queue stops");
    await p.fill("#brWhat", "Pressed Start and nothing happened.");
    await p.selectOption("#brSev", "crash");
    await p.click("#brUseRec"); await p.waitForTimeout(200);
    const st = await ev(() => document.getElementById("brSteps").value);
    check("⤵ Use the recorded steps: numbered lines in Steps to reproduce", /^1\. click "🎓 LoRA"/m.test(st) && /edited .*#s_kwh/.test(st) && !st.includes(TYPED), st.slice(0, 400));
    await p.click("#brPeek");
    await p.waitForFunction(() => /System/.test(document.getElementById("brPeekBox").textContent) && /logs\/app\.txt/.test(document.getElementById("brPeekBox").textContent), null, { timeout: 15000 }).catch(() => {});
    const pk = await ev(() => document.getElementById("brPeekBox").textContent);
    check("👁 What is included: the system, logs/app.txt (the app console), the steps, the settings - the Civitai key shown as •••", /bitGen Studio/.test(pk) && /logs\/app\.txt - \d+ lines/.test(pk) && /•••/.test(pk) && !pk.includes(SECRET), pk.slice(0, 300));

    /* ---- 💾 save -> the .zip */
    const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 30000 }), p.click("#brSave")]);
    const zf = path.join(T, dl.suggestedFilename());
    await dl.saveAs(zf);
    const msg = await ev(() => document.getElementById("brMsg").textContent);
    let names = [], md = "", rj = "", png = false;
    try {
      const UZ = require("../lib/unzip.js"), buf = fs.readFileSync(zf);
      const ent = UZ.entries(buf); names = ent.map((e) => e.name);
      const get = (n) => { const e = ent.find((x) => x.name.endsWith(n)); return e ? UZ.read(buf, e) : null; };
      md = String(get("/report.md") || ""); rj = String(get("/report.json") || ""); const s = get("/screenshot.png"); png = !!s && s.slice(0, 4).toString("hex") === "89504e47";
    } catch (e) { names = ["unzip: " + e.message]; }
    check("💾 Save: bitgen-bug-<date>-<title>.zip downloads at once ('the file to send')", /^bitgen-bug-\d{8}-\d{6}-e2e-522-the-queue-stops\.zip$/.test(dl.suggestedFilename()) && /the file to send/.test(msg), [dl.suggestedFilename(), msg]);
    check("…it holds report.md, report.json, screenshot.png (a PNG, with the mark), logs/app.txt", names.some((n) => /report\.md$/.test(n)) && names.some((n) => /report\.json$/.test(n)) && png && names.some((n) => /logs\/app\.txt$/.test(n)), names);
    check("report.md: the title, 💥 Crash, what happened, the recorded steps, the page error, the failed request, the system",
      /# 🐞 E2E 522 - the queue stops/.test(md) && /💥 Crash/.test(md) && /Pressed Start and nothing happened\./.test(md) && /Recorded steps/.test(md) && /e2e boom 522/.test(md) && /\/api\/e2e-nope-522 -> 404/.test(md) && /## System/.test(md), md.slice(0, 600));
    check("nothing secret or typed in the file (the Civitai key, the typed words)", !rj.includes(SECRET) && !md.includes(SECRET) && !rj.includes(TYPED) && !md.includes(TYPED) && /•••/.test(rj));

    /* ---- the list, ⤓ again, 🗑 */
    await p.waitForFunction(() => document.querySelectorAll("#brList .bi").length > 0, null, { timeout: 10000 }).catch(() => {});
    const li = await ev(() => [...document.querySelectorAll("#brList .bi")].map((x) => ({ id: x.dataset.id, t: x.textContent, img: !!x.querySelector("img"), href: (x.querySelector("a") || {}).href || "" })));
    const mine = li.find((x) => /e2e-522/.test(x.id));
    check("Earlier reports: it is listed with its screenshot and a ⤓ link to the .zip", mine && mine.img && /\/api\/bugreport\/zip\//.test(mine.href), li.slice(0, 2));
    const z2 = await fetch(URL_ + "api/bugreport/zip/" + encodeURIComponent(mine ? mine.id : "x"));
    check("⤓ downloads the same .zip again", z2.status === 200 && Buffer.from(await z2.arrayBuffer()).readUInt32LE(0) === 0x04034b50);
    p.once("dialog", (d) => d.accept());
    await ev(() => { window.appConfirm = () => Promise.resolve(true); });
    await p.click(`#brList .bi[data-id="${mine.id}"] [data-del]`); await p.waitForTimeout(800);
    check("🗑 deletes it", !(await api("/api/bugreport")).some((r) => r.id === mine.id));

    /* ---- again = hide; Settings' button opens it */
    await p.keyboard.press("Control+Alt+Shift+KeyB"); await p.waitForTimeout(400);
    const hid = await ev(() => SecFloat.state("bugreport").shown);
    await p.click("#openSettings"); await p.waitForTimeout(400);
    await p.click('#settings .stabs [data-stab="general"]'); await p.waitForTimeout(300);
    await p.click("#s_bug"); await p.waitForTimeout(900);
    const re = await ev(() => ({ shown: SecFloat.state("bugreport").shown, settings: document.getElementById("settings").open }));
    check("Ctrl+Alt+Shift+B again hides it; Settings -> General -> 🐞 Report a bug… closes Settings and opens it", hid === false && re.shown && !re.settings, { hid, re });
    const draft = await ev(() => { try { return localStorage.getItem("bitgen.bugDraft"); } catch (e) { return "x"; } });
    check("the draft is cleared once the report is saved", draft === null, draft);
    check("no page errors (but the one the test threw)", errs.filter((m) => !/e2e boom 522/.test(m)).length === 0, errs);
  } catch (e) {
    check("the run did not throw", false, String(e && e.stack || e).slice(0, 700));
  } finally {
    await b.close().catch(() => {});
    await api("/api/config", { civitai: civ0, power: pow0 }).catch(() => {});
    for (const r of await api("/api/bugreport").catch(() => [])) if (!before.has(r.id) && /e2e-522/.test(r.id)) await api("/api/bugreport/" + encodeURIComponent(r.id), undefined, "DELETE").catch(() => {});
    fs.rmSync(T, { recursive: true, force: true });
  }
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
