// bitGen Studio — lib/autoUpdate.js (2.925.0): bitGen Studio KEEPS ITSELF AND THE 📱 APP UP TO DATE FROM GITHUB.
//
// Tim: "is there a way to make the phone app update from github? instead of contantly copying and pasting?" -> he picked
// "B) PC auto-updates": bitGen Studio checks GitHub, pulls the new version, rebuilds the app, and the phone updates from the
// PC like now (⬆ Update). No signing-key change, the app and the studio always match; the PC has to be on.
//
// Settings ▸ General ▸ ⟳ Updates (static/autoupdate.js):
//   ☐ Update bitGen Studio from GitHub by itself, every 1 / 3 / 6 / 12 / 24 hours   (config.update.auto, update.every_h)
//   ☑ then build the 📱 app again when its source changed                              (config.update.app, on)
// A tick (every 5 minutes; the first 90 s after the start) does what is due, one thing at a time:
//   1. never while something works - a render / song / picture queued or running, an update or an app build running
//      (it waits and looks again in 5 minutes);
//   2. due: lib/updater.check() -> newer: lib/updater.start() (the same ⤓ Update now - your changed files backed up, your
//      projects / settings / models untouched) -> a restart is needed: the page restarts the desktop app when nothing is
//      running, after a 60 s countdown you can stop (Later = an hour) - in a browser it asks you to start it again;
//   3. the studio is current (no restart waiting) + the app's source (lib/apkBuild.sourceHash) differs from the last build's
//      + the app was built here before + the build tools are here -> lib/apkBuild.build("", "last") - the theme of your
//      last build. The phone's ⬆ Update then finds it (Android still asks you to tap Install - only debugging installs
//      without a tap).
//   settings() / setSettings(b) / state() / tick(o) / later(ms) / startLoop()   deps injectable (scripts/test-925.js)
"use strict";

const EVERY = [1, 3, 6, 12, 24];
const TICK_MS = 5 * 60000, FIRST_MS = 90000, WAIT_MS = 5 * 60000;
const S = { state: "idle", note: "", last_check: 0, next_check: 0, latest: "", current: "", error: "", restart: null, later_until: 0, app: { state: "idle", note: "", at: 0 }, busy: "" };

function deps(d) {
  const o = d || {};
  return {
    core: o.core || require("./core"),
    updater: o.updater || require("./updater"),
    apk: o.apk || require("./apkBuild"),
    now: o.now || Date.now,
    sleep: o.sleep || ((ms) => new Promise((r) => setTimeout(r, ms))),
  };
}
function settings(d) {
  const u = ((deps(d).core.getConfig() || {}).update) || {};
  const every = EVERY.includes(+u.every_h) ? +u.every_h : 6;
  return { auto: u.auto === true, every_h: every, app: u.app !== false };
}
function setSettings(b, d) {
  const D = deps(d), c = D.core.getConfig() || {}, x = b || {};
  const u = Object.assign({}, c.update || {});
  if (x.auto !== undefined) u.auto = x.auto === true;
  if (x.every_h !== undefined && EVERY.includes(+x.every_h)) u.every_h = +x.every_h;
  if (x.app !== undefined) u.app = x.app !== false;
  c.update = u; D.core.setConfig(c);
  if (x.auto === true) S.next_check = 0;                      // switched on: look at the next tick
  return settings(d);
}
function state() { return JSON.parse(JSON.stringify(S)); }
/** what is working right now (the restart bar's countdown waits for it) - "" = nothing */
function busyNow(d) { try { return busy(deps(d)); } catch { return ""; } }

/** what is working now ("" = nothing): a generation queued / running, an update, an app build */
function busy(D) {
  try {
    for (const id of D.core.order || []) { const j = D.core.jobs.get(id); if (j && (j.status === "running" || j.status === "queued")) return "a " + ((j.params && j.params.mode) || "render") + " is " + j.status; }
  } catch { /* no queue */ }
  const u = D.updater.job && D.updater.job(); if (u && u.state === "running") return "an update is running";
  const a = D.apk.job && D.apk.job(); if (a && a.state === "running") return "bitGen is " + (a.kind || "building the app");
  return "";
}

/** should the app be built again? -> {build: bool, why} (the tools here, built here before, the source changed) */
function appDue(D) {
  const c = (D.core.getConfig() || {}).apk || {};
  if (!c.built_id) return { build: false, why: "the app was never built on this PC - 🔨 Build it once (Settings ▸ General ▸ 📱)" };
  const st = D.apk.status();
  if (!st.jdk || !st.sdk) return { build: false, why: "the build tools are not here any more - ⬇ Get the build tools" };
  if (st.mobile === false) return { build: false, why: "the app's source (mobile/) is not in this install" };
  const now = D.apk.sourceHash();
  if (!now) return { build: false, why: "the app's source could not be read" };
  if (c.built_source && c.built_source === now) return { build: false, why: "the app on this PC is up to date (" + (c.built_app || "?") + ")" };
  return { build: true, why: c.built_source ? "the app's source changed since the last build" : "the last build did not record its source" };
}

async function waitFor(get, D, maxMs) {
  const t0 = D.now();
  for (;;) { const j = get(); if (!j || j.state !== "running") return j; if (D.now() - t0 > maxMs) return j; await D.sleep(2000); }
}

let ticking = false;
/** one look - o.force: check GitHub now (🔍 / the e2e suite); o.appOnly: only the app; returns state() */
async function tick(o, d) {
  const opt = o || {}, D = deps(d), set = settings(d);
  if (ticking) return state();
  ticking = true;
  try {
    const b = busy(D);
    S.busy = b;
    if (b) { S.note = "waiting - " + b; S.next_check = Math.max(S.next_check, D.now() + WAIT_MS); return state(); }
    // 1. bitGen Studio itself
    if (!opt.appOnly && (set.auto || opt.force) && !S.restart && (opt.force || D.now() >= S.next_check)) {
      S.state = "checking"; S.note = "asking GitHub"; S.error = "";
      const c = await D.updater.check();
      S.last_check = D.now(); S.next_check = D.now() + set.every_h * 3600000;
      S.current = c.current || S.current; S.latest = c.latest || S.latest;
      if (c.error && !c.latest) { S.state = "error"; S.error = String(c.error); S.note = "GitHub did not answer - again at the next look"; return state(); }
      if (c.newer) {
        S.state = "updating"; S.note = "updating " + (c.current || "") + " -> " + (c.latest || "the newest");
        const r = D.updater.start();
        if (r && r.error) { S.state = "error"; S.error = String(r.error); S.note = "the update could not start"; return state(); }
        const j = await waitFor(() => D.updater.job(), D, 90 * 60000);
        if (!j || j.state !== "done") { S.state = "error"; S.error = (j && j.error) || "the update did not finish"; S.note = "the update stopped - your install is as it was"; return state(); }
        if (j.restart) { S.restart = { from: j.from, to: j.to, at: D.now() }; S.state = "restart"; S.note = "updated " + j.from + " -> " + j.to + " - a restart finishes it (then the app is built)"; return state(); }
        S.note = "updated " + j.from + " -> " + j.to;
      } else { S.state = "idle"; S.note = "the newest bitGen Studio (" + (c.current || "") + ")"; }
    }
    // 2. the 📱 app - only when the running studio IS the code on disk (no restart waiting)
    if ((set.app && (set.auto || opt.appOnly)) && !S.restart) {
      const due = appDue(D);
      S.app.note = due.why;
      if (due.build) {
        S.app.state = "building"; S.app.note = "building the 📱 app (" + due.why + ")";
        D.apk.build("", "last");
        const j = await waitFor(() => D.apk.job(), D, 90 * 60000);
        if (j && j.state === "done") { S.app.state = "built"; S.app.at = D.now(); S.app.note = "built the 📱 app " + (D.apk.mobileVersion ? D.apk.mobileVersion() : "") + " - the phone's ⬆ Update finds it"; }
        else { S.app.state = "error"; S.app.note = "the app build stopped: " + ((j && j.error) || "?") + " - again at the next look"; }
      } else if (S.app.state !== "built") S.app.state = "idle";
    }
    if (S.state === "checking") S.state = "idle";
    return state();
  } catch (e) {
    S.state = "error"; S.error = String((e && e.message) || e); return state();
  } finally { ticking = false; }
}
/** "Later" on the restart bar: not before ms from now */
function later(ms, d) { S.later_until = deps(d).now() + (ms || 3600000); return state(); }

let timer = null;
function startLoop() {
  if (timer || process.env.H3_NO_AUTOUPDATE === "1") return;
  setTimeout(() => { tick().catch(() => {}); timer = setInterval(() => { tick().catch(() => {}); }, TICK_MS); if (timer.unref) timer.unref(); }, FIRST_MS).unref?.();
}

module.exports = { EVERY, TICK_MS, settings, setSettings, state, busyNow, tick, later, appDue, busy, startLoop, _S: S, _reset: () => { Object.assign(S, { state: "idle", note: "", last_check: 0, next_check: 0, latest: "", current: "", error: "", restart: null, later_until: 0, app: { state: "idle", note: "", at: 0 }, busy: "" }); ticking = false; } };
