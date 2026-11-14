#!/usr/bin/env node
/* bitGen Studio — 2.782.2: ⏹ STOP AND ↻ RESTART AT THE END OF A TRANSFER'S BAR (lib/podTransfers.js stop / restart, static/podxfer.js;
 * lib/podSend.js uploads + the pod's downloads, lib/podModels.js stopUpload / stopDownload + the download job's stop file,
 * lib/podLlm.js ↻). Tim (verbatim): "when transferring a model to the pod add a stop and restart download button icon only at the
 * end of the progressbar" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
(async () => {
  const PT = require("../lib/podTransfers"), X = require("../static/podxfer.js");
  let stops = 0, restarts = 0;
  const a = PT.begin({ pod: "p1", name: "krea2.safetensors", how: "download", from: "civitai.red", size: 100, stop: async () => { stops++; }, restart: () => { restarts++; } });
  PT.step(a, 40, 100);
  let v = PT.list().find((x) => x.id === a);
  check("a transfer that says how to stop / start again: can_stop + can_restart in the list", v.can_stop && v.can_restart && v.pct === 40, v);
  const b = PT.begin({ pod: "p1", name: "other.safetensors", how: "download", size: 10 });
  check("…one that does not: neither (no buttons)", !PT.list().find((x) => x.id === b).can_stop && !PT.list().find((x) => x.id === b).can_restart);
  check("⏹: its own stop runs, the row says stopped, no stop button after", (await PT.stop(a)).state === "stopped" && stops === 1 && PT.list().find((x) => x.id === a).state === "stopped" && !PT.list().find((x) => x.id === a).can_stop && PT.stopped(a));
  check("↻: started again from the beginning (the old row goes; its own restart runs)", (await PT.restart(a)).ok && !PT.list().some((x) => x.id === a) && (await new Promise((ok) => setTimeout(ok, 20)), restarts === 1));
  let er = ""; try { await PT.stop(b); } catch (e) { er = e.status + " " + e.message; }
  check("…⏹ on one with no stop: refused (409)", /^409/.test(er), er);
  const html = X.rowHtml({ id: "x1", name: "B.safetensors", how: "upload", state: "running", size: 229e6, done: 17e6, pct: 7, can_stop: true, can_restart: true });
  check("the page: ⏹ and ↻ as icon buttons at the END of the bar (after it, in its line)", /<div class="pxLine"><div class="pxBar"[^]*<\/div><button type="button" class="pxIb" data-pxstop="x1"[^>]*>⏹<\/button><button type="button" class="pxIb" data-pxre="x1"[^>]*>↻<\/button><\/div>/.test(html), html);
  check("…a stopped one says so (↻ starts it again)", /stopped - ↻ starts it again/.test(X.rowText({ state: "stopped", size: 100, done: 40, can_restart: true })));
  const PM = rd("lib/podModels.js"), PS = rd("lib/podSend.js"), RM = rd("routes/remoteModels.js");
  check("the pod's download job stops after the piece it is on when bitgen_stop_<name> is there (cleared when a download starts)",
    /if os\.path\.exists\(os\.path\.join\(os\.getcwd\(\), 'bitgen_stop_' \+ f\['name'\]\)\): raise Exception\('stopped by you'\)/.test(PM) && /os\.remove\(os\.path\.join\(os\.getcwd\(\), 'bitgen_stop_' \+ f\['name'\]\)\)/.test(PM) && /async function stopDownload\(id, port, name\)/.test(PM));
  check("an upload from this computer stops after the part it is sending (the part file on the pod deleted)", /if \(job\.stop\) \{/.test(PM) && /method: "DELETE"/.test(PM) && /function stopUpload\(id\)/.test(PM));
  check("podSend: uploads and the pod's downloads register ⏹ / ↻ (↻ = the same send / download again); a stopped download is not sent from this computer instead",
    /stop: async \(\) => \{ PM\.stopUpload\(id\)/.test(PS) && /restart: \(\) => sendOne\(id, port, local, cat, say/.test(PS) && /stop: \(\) => PM\.stopDownload\(id, port, o\.name\), restart: \(\) => pullWait\(id, port, o, say\)/.test(PS) && /throw new Error\("you stopped the download of "/.test(PS));
  check("routes: POST /api/pods/transfers/:id/stop | /restart", /\/api\/pods\/transfers\/:id\/stop/.test(RM) && /\/api\/pods\/transfers\/:id\/restart/.test(RM));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
