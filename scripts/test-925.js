#!/usr/bin/env node
// bitGen Studio 2.925.0 - bitGen Studio keeps itself and the 📱 app up to date from GitHub.
// Tim: "is there a way to make the phone app update from github? instead of contantly copying and pasting?" -> "B) PC auto-updates".
// Units: lib/autoUpdate.js with stand-in deps (no GitHub, no Gradle): the settings, never while something works, check ->
// update -> restart waiting, the app built only when its source changed (and never before the restart), errors, Later;
// lib/apkBuild.sourceHash (what counts as the app's source); the restart bar's status line (static/autoupdate.js); the
// wiring (routes, the page, the app's 30-minute look, "last" theme). The browser run: test-ui925-ui.js. Run: node scripts/test-925.js
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got).slice(0, 600)); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const AU = require("../lib/autoUpdate");
const AB = require("../lib/apkBuild");
const PAGE = require("../static/autoupdate.js");

/* ---- stand-ins */
function world(o) {
  const w = Object.assign({ t: 1e12, cfg: {}, jobs: new Map(), order: [], checks: 0, starts: 0, builds: [], check: { current: "2.925.0", latest: "2.925.0", newer: false }, upJob: null, upResult: { state: "done", from: "2.925.0", to: "2.926.0", restart: true }, apkJob: { state: "idle" }, apkResult: { state: "done" }, tools: { jdk: {}, sdk: {}, mobile: true }, hash: "aaaa" }, o || {});
  w.d = {
    now: () => w.t,
    sleep: async (ms) => { w.t += ms; if (w.upJob && w.upJob.state === "running") w.upJob = Object.assign({}, w.upResult); if (w.apkJob && w.apkJob.state === "running") w.apkJob = Object.assign({}, w.apkResult); },
    core: { getConfig: () => w.cfg, setConfig: (c) => { w.cfg = c; }, jobs: w.jobs, order: w.order },
    updater: { check: async () => { w.checks++; return w.check; }, start: () => { w.starts++; w.upJob = { state: "running" }; return { ok: true }; }, job: () => w.upJob },
    apk: { status: () => w.tools, sourceHash: () => w.hash, job: () => w.apkJob, build: (then, theme) => { w.builds.push(theme); w.apkJob = { state: "running", kind: "building the app" }; }, mobileVersion: () => "1.11.0" },
  };
  return w;
}

(async () => {
  /* settings */
  AU._reset();
  let w = world();
  check("off until you tick it: auto false, every 6 hours, the app on", JSON.stringify(AU.settings(w.d)) === JSON.stringify({ auto: false, every_h: 6, app: true }), AU.settings(w.d));
  const s1 = AU.setSettings({ auto: true, every_h: 3, app: false }, w.d);
  check("...saved in config.update (with the old auto_check kept)", s1.auto && s1.every_h === 3 && s1.app === false && w.cfg.update.every_h === 3, w.cfg);
  w.cfg.update.auto_check = true; AU.setSettings({ every_h: 5 }, w.d);
  check("...only 1 / 3 / 6 / 12 / 24 hours; the startup check setting untouched", w.cfg.update.every_h === 3 && w.cfg.update.auto_check === true, w.cfg.update);

  /* off: nothing happens */
  AU._reset(); w = world();
  await AU.tick({}, w.d);
  check("switched off: no look at GitHub, no build", w.checks === 0 && w.builds.length === 0);

  /* never while something works */
  AU._reset(); w = world({ cfg: { update: { auto: true } } });
  w.jobs.set("j1", { status: "running", params: { mode: "t2v" } }); w.order.push("j1");
  let st = await AU.tick({}, w.d);
  check("a render running: it waits (no look), says so, and looks again in 5 minutes", w.checks === 0 && /a t2v is running/.test(st.busy) && st.next_check >= w.t + 5 * 60000 - 1, st);
  check("...busyNow() says what works right now (the restart bar waits for it)", /running/.test(AU.busyNow(w.d)));
  w.jobs.get("j1").status = "done";
  w.apkJob = { state: "running", kind: "building the app" };
  st = await AU.tick({ force: true }, w.d);
  check("an app build running counts too", w.checks === 0 && /building the app/.test(st.busy), st);

  /* the newest already: the app is looked at */
  AU._reset(); w = world({ cfg: { update: { auto: true }, apk: { built_id: "20261101000000", built_source: "aaaa", built_app: "1.10.0" } } });
  st = await AU.tick({}, w.d);
  check("due: asks GitHub once, the next look in every_h hours", w.checks === 1 && st.next_check === w.t + 6 * 3600000 && st.current === "2.925.0", st);
  check("...the newest: no update; the app's source unchanged -> no build", w.starts === 0 && w.builds.length === 0 && /up to date/.test(st.app.note), st.app);
  await AU.tick({}, w.d);
  check("...not due again before every_h hours", w.checks === 1);
  w.t += 6 * 3600000 + 1; await AU.tick({}, w.d);
  check("...due again after them", w.checks === 2);

  /* the source changed -> built with the last theme */
  w.hash = "bbbb"; st = await AU.tick({}, w.d);
  check("the app's source changed -> built again, with the theme of the last build (\"last\")", w.builds.length === 1 && w.builds[0] === "last" && st.app.state === "built" && /1\.11\.0/.test(st.app.note), st.app);
  w.apkResult = { state: "failed", error: "Gradle said no" }; w.hash = "cccc"; st = await AU.tick({}, w.d);
  check("...a failed build says why and tries again at the next look", st.app.state === "error" && /Gradle said no/.test(st.app.note), st.app);

  /* app not built before / no tools / app switched off */
  AU._reset(); w = world({ cfg: { update: { auto: true } }, hash: "x" });
  st = await AU.tick({}, w.d);
  check("never built on this PC: no build, the note says 🔨 Build it once", w.builds.length === 0 && /never built/.test(st.app.note), st.app);
  AU._reset(); w = world({ cfg: { update: { auto: true }, apk: { built_id: "1" } }, tools: { jdk: null, sdk: {}, mobile: true } });
  st = await AU.tick({}, w.d);
  check("the build tools gone: no build, says so", w.builds.length === 0 && /build tools/.test(st.app.note), st.app);
  AU._reset(); w = world({ cfg: { update: { auto: true, app: false }, apk: { built_id: "1", built_source: "old" } } });
  await AU.tick({}, w.d);
  check("☐ the app: never built by itself", w.builds.length === 0);
  check("an older build with no recorded source counts as changed", AU.appDue(world({ cfg: { apk: { built_id: "1" } } }).d).build === true);

  /* newer on GitHub -> update -> restart waiting -> no build before the restart */
  AU._reset(); w = world({ cfg: { update: { auto: true }, apk: { built_id: "1", built_source: "old" } }, check: { current: "2.925.0", latest: "2.926.0", newer: true } });
  st = await AU.tick({}, w.d);
  check("newer on GitHub: the update runs (the same ⤓ Update now)", w.starts === 1 && st.state === "restart" && st.restart && st.restart.from === "2.925.0" && st.restart.to === "2.926.0", st);
  check("...the app is NOT built before the restart (the running studio is the old code)", w.builds.length === 0);
  await AU.tick({ force: true }, w.d);
  check("...a restart waiting: no second update", w.starts === 1);
  st = AU.later(3600000, w.d);
  check("Later = not before an hour from now", st.later_until === w.t + 3600000);
  AU._reset(); w = world({ cfg: { update: { auto: true }, apk: { built_id: "1", built_source: "old" } }, check: { current: "2.925.0", latest: "2.926.0", newer: true }, upResult: { state: "done", from: "2.925.0", to: "2.926.0", restart: false } });
  st = await AU.tick({}, w.d);
  check("an update that needs no restart: the app is built straight after", w.starts === 1 && w.builds.length === 1 && !st.restart, st);

  /* errors */
  AU._reset(); w = world({ cfg: { update: { auto: true } }, check: { current: "2.925.0", latest: "", newer: false, error: "offline" } });
  st = await AU.tick({}, w.d);
  check("GitHub not answering: an error state, the next look still planned", st.state === "error" && /offline/.test(st.error) && st.next_check > w.t, st);
  AU._reset(); w = world({ cfg: { update: { auto: true } }, check: { current: "1", latest: "2", newer: true }, upResult: { state: "error", error: "merge conflict" } });
  st = await AU.tick({}, w.d);
  check("an update that stops: says why, no restart", st.state === "error" && /merge conflict/.test(st.error) && !st.restart, st);

  /* ⟳ Look now / the app only */
  AU._reset(); w = world({ cfg: { apk: { built_id: "1", built_source: "old" } } });
  await AU.tick({ force: true }, w.d);
  check("⟳ Look now asks GitHub even when switched off", w.checks === 1);
  AU._reset(); w = world({ cfg: { apk: { built_id: "1", built_source: "old" } } });
  await AU.tick({ appOnly: true }, w.d);
  check("app_only: no GitHub, the app built when changed", w.checks === 0 && w.builds.length === 1);

  /* sourceHash */
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg925-"));
  const put = (r, t) => { fs.mkdirSync(path.dirname(path.join(T, r)), { recursive: true }); fs.writeFileSync(path.join(T, r), t); };
  put("package.json", "{}"); put("www/app.js", "a"); put("www/index.html", "<p>"); put("android/app/src/main/java/A.java", "class A{}");
  const h0 = AB.sourceHash(T);
  check("sourceHash: 16 hex characters, the same twice", /^[0-9a-f]{16}$/.test(h0) && AB.sourceHash(T) === h0, h0);
  put("www/lib/build.js", "x"); put("www/lib/theme.js", "y"); put("www/vendor/v.js", "z"); put("node_modules/q/i.js", "n"); put("dist/bitGen.apk", "PK"); put("android/app/src/main/assets/public/index.html", "copy"); put("android/local.properties", "sdk.dir=/x"); put("android/app/build/out.txt", "o");
  check("...what a build writes itself does not count (build.js, theme.js, vendor, node_modules, dist, assets/public, local.properties, build/)", AB.sourceHash(T) === h0, AB.sourceHash(T));
  put("www/app.js", "b");
  check("...a changed app file does", AB.sourceHash(T) !== h0);
  const h1 = AB.sourceHash(T); put("android/app/src/main/java/B.java", "class B{}");
  check("...a new Android file does", AB.sourceHash(T) !== h1);
  check("...an empty folder: \"\"", AB.sourceHash(path.join(T, "none")) === "");
  check("the real app's source hashes", /^[0-9a-f]{16}$/.test(AB.sourceHash(path.join(ROOT, "mobile"))));

  /* the page's status line */
  check("status line: off", /^Off/.test(PAGE.line({}, { auto: false })));
  check("...a restart waiting", /2\.925\.0 → 2\.926\.0/.test(PAGE.line({ restart: { from: "2.925.0", to: "2.926.0" } }, { auto: true })));
  check("...the newest + next look + the app's note", /the newest \(2\.925\.0\).*next look.*📱 built/.test(PAGE.line({ last_check: 1e12, next_check: 1e12 + 3600000, current: "2.925.0", latest: "2.925.0", app: { note: "built the 📱 app" } }, { auto: true, app: true }, 1e12)), PAGE.line({ last_check: 1e12, next_check: 1e12 + 3600000, current: "2.925.0", latest: "2.925.0", app: { note: "built the 📱 app" } }, { auto: true, app: true }, 1e12));
  check("...an error", /✗ offline/.test(PAGE.line({ state: "error", error: "offline" }, { auto: true })));

  /* wiring */
  const R = src("routes/updater.js");
  check("routes: GET/POST /api/update/auto, /auto/check, /auto/later, /auto/e2e (H3_E2E only), the loop started", ["/api/update/auto\"", "/api/update/auto/check", "/api/update/auto/later", "/api/update/auto/e2e"].every((k) => R.includes(k)) && /H3_E2E !== "1"/.test(R) && /AU\.startLoop\(\)/.test(R));
  check("server.js untouched by this (the routes file mounts it)", !/autoUpdate/.test(src("misc/server.js")));
  check("the page loads static/autoupdate.js after updater.js", /updater\.js"><\/script>[^\n]*\n<script src="\/static\/autoupdate\.js">/.test(src("static/index.html")));
  const A = src("lib/apkBuild.js");
  check("a build records its source + time; \"last\" = the theme of the last build you pressed, kept by apk.theme", /built_source: sourceHash\(dir\)/.test(A) && /theme === "last"/.test(A) && /saveCfg\(\{ theme: sent \}\)/.test(A));
  const M = src("mobile/www/app.js");
  check("the app looks for a new build every 30 minutes while open; Later holds for that build", /30 \* 60000/.test(M) && /updInfo\.id === updLater/.test(M));
  check("the app is 1.11+", /^1\.(1[1-9]|[2-9]\d)\./.test(JSON.parse(src("mobile/package.json")).version));
  check("H3_NO_AUTOUPDATE=1 keeps the loop off", /H3_NO_AUTOUPDATE/.test(src("lib/autoUpdate.js")));

  fs.rmSync(T, { recursive: true, force: true });
  console.log("\n" + P + " passed, " + F + " failed");
  process.exit(F ? 1 : 0);
})();
