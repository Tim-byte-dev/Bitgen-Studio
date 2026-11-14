#!/usr/bin/env node
/* bitGen Studio — 2.779.0 browser test: A POD THAT COULD NOT BE CREATED - THE REAL ERROR IN A DIALOG (static/poderr.js) on a
 * running studio (H3_URL, default :8311). The server's answer to POST /api/pods/create is RunPod's "busy" refusal (the browser
 * stands in for RunPod); the dialog shows the title, what to do, RunPod's words + HTTP status, what was asked for; 📋 Copy, OK.
 * Tim (verbatim): "when creating a pod, it asks me to create a template first...can you report the real error in a dialog so the
 * user can see that there is a problem. i suspect it is because the gpu i selected was busy"
 * No server / no Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.779.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const BUSY = "There are no longer any instances available with the requested specifications. Please refresh and try again.";
const PROBLEM = require("../lib/podCreateErr").explain({ said: BUSY, httpStatus: 500 }, { templateId: "runpod-torch-v280", template_name: "Runpod Pytorch 2.8.0", gpu: { id: "NVIDIA GeForce RTX 5090", count: 1, minCudaVersion: "12.8" }, cloud: "SECURE", disk: 50, mounts: { persistent: { size: 100 } } });

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.779.0 browser test did not run"); process.exit(0); }
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1400, height: 950 }, permissions: ["clipboard-read", "clipboard-write"] });
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.route("**/api/pods/create", (rt) => rt.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "RunPod answered HTTP 500: " + BUSY, problem: PROBLEM }) }));
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3PodErr, null, { timeout: 60000 });
    const shown = await p.evaluate(() => fetch("/api/pods/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then((r) => r.json()).then((r) => window.H3PodErr.show(r)));
    await p.waitForSelector("#podErrDlg[open]", { timeout: 5000 });
    const a = await p.evaluate(() => { const d = document.getElementById("podErrDlg"); return { kind: d.dataset.kind, h: d.querySelector("h2").textContent, hint: d.querySelector(".pehint").textContent,
      lab: [...d.querySelectorAll(".pek")].map((x) => x.textContent), said: d.querySelector(".pesaid").textContent, asked: d.querySelector(".peasked").textContent, focus: document.activeElement.id }; });
    check("the create's refusal opens the dialog: 'The GPU you picked is busy'", shown === true && a.kind === "busy" && a.h === "The GPU you picked is busy", a);
    check("…what to do (the GPU, the cloud, the CUDA named; nothing charged)", /no free NVIDIA GeForce RTX 5090 on Secure cloud right now with CUDA 12\.8/.test(a.hint) && /nothing was charged/.test(a.hint), a.hint);
    check("…RunPod's own words with its HTTP status", a.lab[0] === "RunPod said (HTTP 500):" && a.said === BUSY, a);
    check("…what was asked for", /TemplateRunpod Pytorch 2\.8\.0/.test(a.asked) && /GPUNVIDIA GeForce RTX 5090/.test(a.asked) && /CloudSecure/.test(a.asked) && /HostCUDA 12\.8 or newer only/.test(a.asked), a.asked);
    check("…OK focused", a.focus === "peOk", a.focus);
    await p.click("#peCopy"); await p.waitForTimeout(400);
    const clip = await p.evaluate(() => navigator.clipboard.readText().catch(() => ""));
    check("📋 Copy: the whole text (for a bug report)", /^The GPU you picked is busy/.test(clip) && /RunPod said \(HTTP 500\): There are no longer/.test(clip) && /Asked for:/.test(clip), clip);
    await p.click("#peOk"); await p.waitForTimeout(300);
    check("OK closes it", !(await p.$("#podErrDlg")));
    const none = await p.evaluate(() => window.H3PodErr.show({ error: "plain" }));
    check("an answer with no explanation opens nothing (the caller says its error)", none === false && !(await p.$("#podErrDlg")));
    check("no page errors", errs.length === 0, errs);
  } finally { await b.close(); }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
