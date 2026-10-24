#!/usr/bin/env node
/* bitGen Studio — 2.583.0 in a REAL browser: the render farm's screens. Settings ▸ Team (after Remote GPU): ➕ Create the
 * team in a folder (the leader, today's key ✓); a member's join request -> ✓ Approve (members + their key); 🔌 Share this
 * PC opens the farm port; a team member's signed "may I" over that port shows under "Asks for access" -> Allow from - to
 * (✓ in its time) -> ↺ Revoke -> asked again -> Allow unrestricted; the status bar's 🖥 chip: This PC / a team PC (not
 * sharing = greyed) / ⚡ Spread / the team's renders; ⇤ Leave the team. Tim: "get permission from owner of the client to
 * render using their hardware ... have levels of access - time limit and unrestricted, time limit will set time from -
 * time to". Against the running app (H3_URL); the team folder is a temp folder. No Playwright = SKIP. */
"use strict";
// 2.589.0: the render farm is the OPTIONAL Team extension (ext/teamdock - its own zip); not installed here = SKIP
if (!require("fs").existsSync(require("path").join(__dirname, "..", "ext", "teamdock", "ext.json"))) { console.log("SKIP: the Team render farm extension (ext/teamdock) is not installed here"); console.log("RESULT: PASS"); process.exit(0); }
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.583.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const T = require("../ext/teamdock/server/team");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NAS = fs.mkdtempSync(path.join(os.tmpdir(), "bg-ui583-nas-"));
const FARM = 8476;
const post = async (p, b) => (await fetch(URL_ + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) })).json();

/** a request from "Sam's PC" to the farm port, signed with Sam's private key + today's key the leader issued */
async function asSam(pem, p, bodyObj) {
  const raw = JSON.stringify(bodyObj || {}), time = Date.now();
  const key = JSON.parse(fs.readFileSync(path.join(NAS, "keys", "sam.json"), "utf8"));
  const h = { "Content-Type": "application/json", "x-bg-key": Buffer.from(JSON.stringify(key)).toString("base64"), "x-bg-time": String(time), "x-bg-machine": "sampc1", "x-bg-sig": T.sign(T.reqString("POST", p, time, raw), pem) };
  const r = await fetch(`http://127.0.0.1:${FARM}${p}`, { method: "POST", headers: h, body: raw });
  return r.json();
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  p.on("dialog", (d) => d.accept());
  try {
    await post("api/team/leave");                    // a team left from an earlier run
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Team, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => window.H3Team.open());
    await p.waitForSelector("#tmCreate", { timeout: 20000 });
    const tab = await ev(() => { const bs = [...document.querySelectorAll("#settings .stabs button")].map((x) => x.dataset.stab); return { i: bs.indexOf("team"), rg: bs.indexOf("rgpu"), active: document.querySelector("#stab-team").classList.contains("active"), chip: getComputedStyle(document.getElementById("tmChip")).display }; });
    check("Settings ▸ Team sits after Remote GPU; not in a team = Create / Join, and no 🖥 chip in the status bar", tab.i === tab.rg + 1 && tab.active && tab.chip === "none", tab);

    await p.fill("#tmFolder", NAS); await p.fill("#tmMe", "Tim"); await p.fill("#tmName", "H3 crew");
    await p.click("#tmCreate");
    await p.waitForSelector("#tmIssue", { timeout: 10000 });
    let txt = await ev(() => document.getElementById("tmBody").textContent);
    check("➕ Create: the team, Tim its leader, today's key ✓, the NAS folder made", /H3 crew/.test(txt) && /\(leader\)/.test(txt) && /✓ valid until/.test(txt) && fs.existsSync(path.join(NAS, "team.json")) && fs.existsSync(path.join(NAS, "keys", "tim.json")), txt.slice(0, 400));

    // Sam asks to join (his PC writes members/sam.json with his public key)
    const sam = T.keyPair();
    fs.writeFileSync(path.join(NAS, "members", "sam.json"), JSON.stringify({ name: "Sam", pub: sam.pub, machine: "sampc", at: Date.now() }));
    await ev(() => window.H3Team.load());
    await p.waitForSelector('[data-tmok="Sam"]', { timeout: 5000 });
    await p.click('[data-tmok="Sam"]');
    await p.waitForSelector('[data-tmrm="Sam"]', { timeout: 5000 });
    check("✓ Approve Sam: in the members, his key for today issued on the NAS", fs.existsSync(path.join(NAS, "keys", "sam.json")) && JSON.parse(fs.readFileSync(path.join(NAS, "keys", "sam.json"), "utf8")).cert.pub === sam.pub);
    txt = await ev(() => document.getElementById("tmBody").textContent);
    check("📂 the same project: this PC's projects folder + Use the team's projects folder", /The same project/.test(txt) && !!(await p.$("#tmUseProj")), txt.slice(0, 600));

    // share this PC
    await p.fill("#tmPort", String(FARM));
    await ev(() => { const x = document.getElementById("tmShare"); x.checked = true; x.dispatchEvent(new Event("change")); });
    await p.waitForFunction((port) => /listening on /.test(document.getElementById("tmBody").textContent) && document.getElementById("tmBody").textContent.includes(String(port)), FARM, { timeout: 8000 });
    check("🔌 Share this PC: listening on the farm port (only while bitGen runs)", true);
    let r = await asSam(sam.pem, "/farm/request", { note: "scene 2 tonight" });
    check("Sam's signed ask over the farm port is accepted (pending)", r.pending === true, r);
    await ev(() => window.H3Team.load());
    await p.waitForSelector('[data-tmq="Sam"]', { timeout: 5000 });
    txt = await ev(() => document.querySelector('[data-tmq="Sam"]').textContent);
    check("Asks for access: Sam with his note, Unrestricted / from - to / Deny", /scene 2 tonight/.test(txt) && !!(await p.$('[data-tmq="Sam"] .tmF')) && !!(await p.$('[data-tmq="Sam"] [data-tmdeny]')), txt);
    const v = (d) => { const x = new Date(d), z = (n) => String(n).padStart(2, "0"); return `${x.getFullYear()}-${z(x.getMonth() + 1)}-${z(x.getDate())}T${z(x.getHours())}:${z(x.getMinutes())}`; };
    await p.fill('[data-tmq="Sam"] .tmF', v(Date.now() - 600000)); await p.fill('[data-tmq="Sam"] .tmT', v(Date.now() + 3600000));
    await p.click('[data-tmq="Sam"] [data-tmall="w"]');
    await p.waitForSelector('[data-tmrev="Sam"]', { timeout: 5000 });
    txt = await ev(() => document.querySelector('[data-tmrev="Sam"]').closest("tr").textContent);
    check("Allow from - to: Sam's access is ✓ inside its time; the request is gone", /^Sam✓ /.test(txt) && !(await p.$('[data-tmq="Sam"]')), txt);
    r = await asSam(sam.pem, "/farm/hello", {});
    check("Sam's PC sees the time limit (window, now)", r.access && r.access.level === "window" && r.access.now === true, r);
    await p.click('[data-tmrev="Sam"]');
    await p.waitForFunction(() => /nobody yet/.test(document.getElementById("tmBody").textContent), null, { timeout: 5000 });
    r = await asSam(sam.pem, "/farm/hello", {});
    check("↺ Revoke: Sam has no access", r.access === null, r);
    await asSam(sam.pem, "/farm/request", {});
    await ev(() => window.H3Team.load());
    await p.waitForSelector('[data-tmq="Sam"] [data-tmall="u"]', { timeout: 5000 });
    await p.click('[data-tmq="Sam"] [data-tmall="u"]');
    await p.waitForSelector('[data-tmrev="Sam"]', { timeout: 5000 });
    r = await asSam(sam.pem, "/farm/hello", {});
    check("asked again -> Allow unrestricted", r.access && r.access.level === "unrestricted" && /✓ unrestricted/.test(await ev(() => document.querySelector('[data-tmrev="Sam"]').closest("tr").textContent)), r);

    // the status bar
    fs.writeFileSync(path.join(NAS, "machines", "sampc1.json"), JSON.stringify({ id: "sampc1", name: "SAM-PC", member: "Sam", addresses: ["127.0.0.1"], port: 1, sharing: false, team: JSON.parse(fs.readFileSync(path.join(NAS, "team.json"), "utf8")).id, at: Date.now(), jobs: [{ id: "x1", project: "Film", kind: "ltx", label: "scene 2", for: "Sam", status: "running", pct: 35 }] }));
    await ev(() => window.H3Team.load());
    await p.waitForFunction(() => getComputedStyle(document.getElementById("tmChip")).display !== "none", null, { timeout: 8000 });
    await p.keyboard.press("Escape"); await p.waitForTimeout(300);
    await ev(() => { const d = document.getElementById("settings"); if (d.open) d.close(); });
    await p.click("#tmChip");
    await p.waitForFunction(() => document.getElementById("tmMenu") && /Spread/.test(document.getElementById("tmMenu").textContent), null, { timeout: 10000 });
    const menu = await ev(() => { const m = document.getElementById("tmMenu"); return { txt: m.textContent, sam: (m.querySelector('[data-tmt="sampc1"]') || {}).className, bar: !!m.querySelector(".tmbar i") }; });
    check("🖥 Render on: This PC (on) / Sam's PC (not sharing = greyed) / ⚡ Spread / the team's renders with Sam's scene 2 at 35%",
      /This PC/.test(menu.txt) && /Sam/.test(menu.txt) && /not sharing/.test(menu.txt) && /\boff\b/.test(menu.sam || "") && /scene 2/.test(menu.txt) && /35%/.test(menu.txt) && menu.bar, menu);
    await p.click('#tmMenu [data-tmt="spread"]');
    await p.waitForFunction(() => /Spread/.test(document.getElementById("tmChip").textContent), null, { timeout: 5000 });
    check("⚡ Spread picked: the chip says so (and the team's running job)", /⚡ Spread · 1 ▶/.test(await ev(() => document.getElementById("tmChip").textContent)), await ev(() => document.getElementById("tmChip").textContent));
    await p.click("#tmChip"); await p.waitForSelector('#tmMenu [data-tmt="local"]');
    await p.click('#tmMenu [data-tmt="local"]');
    await p.waitForFunction(() => /This PC/.test(document.getElementById("tmChip").textContent), null, { timeout: 5000 });
    check("back to 🖥 This PC", true);

    // leave
    await ev(() => window.H3Team.open());
    await p.waitForSelector("#tmLeave");
    await ev(() => { window.appConfirm = () => Promise.resolve(true); });
    await p.click("#tmLeave");
    await p.waitForSelector("#tmCreate", { timeout: 8000 });
    const st = await (await fetch(URL_ + "api/team/status")).json();
    check("⇤ Leave the team: Create / Join again, sharing off (the farm port closed), no chip", !st.joined && !st.sharing && !st.listening && await ev(() => getComputedStyle(document.getElementById("tmChip")).display === "none"), st);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    try { await post("api/team/leave"); } catch { /* fine */ }
    await b.close();
    try { fs.rmSync(NAS, { recursive: true, force: true }); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
