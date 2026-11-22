// bitGen Studio — lib/apkBuild.js (2.911.0): BUILD THE 📱 bitGen APP HERE AND PUT IT ON THE PHONE OVER WI-FI.
//
// Tim: "can we compile the apk in bitgen, general tab remote - and install it to the phone automatically?" - his picks:
// the build tools from Android Studio when it is there, else bitGen downloads them ("Both"); onto the phone by
// WIRELESS DEBUGGING (one pairing code, then every install / update with no taps).
//   TOOLS     Java 21 (Android Studio's own JBR, JAVA_HOME, or bitGen's: tools/android/jdk - Eclipse Temurin from
//             api.adoptium.net) + the Android SDK (ANDROID_HOME / ANDROID_SDK_ROOT, Android Studio's folder, or bitGen's:
//             tools/android/sdk - Google's command-line tools, then sdkmanager: platform-tools, platforms;android-36,
//             build-tools;36.0.0, the licences accepted). Settings ▸ apk.jdk / apk.sdk override the search.
//   BUILD     mobile/ (this install's copy of the app): npm install -> scripts/vendor.js -> cap sync android ->
//             android/local.properties (sdk.dir) -> gradlew assembleDebug (the first build fetches Gradle + its libraries,
//             a few hundred MB) -> mobile/dist/bitGen.apk. A debug build - signed with this computer's own debug key, so
//             later builds from this computer update it in place.
//   PHONE     adb from the SDK's platform-tools: pair (the phone's Developer options ▸ Wireless debugging ▸ Pair device
//             with pairing code: its IP:port + 6-digit code) -> connect (found by mDNS, or the IP:port the Wireless
//             debugging screen shows) -> install -r -> the app started. The phone is remembered; the next install finds it
//             again by mDNS (its port changes whenever Wireless debugging is switched on).
//   One thing at a time (job()): {state, phase, log[], got/total, apk, error}.
// 2.912.0: each build carries an id (www/lib/build.js in the app, apk.built_id here) and a rising versionCode
// (-PbgVersionCode) so the app's ⬆ Update can install it over itself.
// Pure (scripts/test-911.js, test-912.js): javaMajor, parsePair, parseDevices, parseMdns, pickDevice, localProps, adoptiumUrl,
// latestCmdline, candidates, versionCode.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const IS_WIN = process.platform === "win32";
const APP_ID = "au.com.tigerart.bitgen";
const SDK_PKGS = ["platform-tools", "platforms;android-36", "build-tools;36.0.0"];
const CMDLINE_FALLBACK = "14742923";               // Google's build number when repository2-3.xml cannot be read
const SIZE = "about 1.5 - 2 GB (Java 21 ~200 MB, the Android SDK ~600 MB, Gradle and its libraries on the first build)";

/* ---------------- pure */
/** `java -version` output -> the major version (8 for "1.8.0_x", 21 for "21.0.5") or 0 */
function javaMajor(text) {
  const m = /version "(\d+)(?:\.(\d+))?/.exec(String(text || ""));
  if (!m) return 0;
  return m[1] === "1" ? +(m[2] || 0) : +m[1];
}
/** `adb pair` output -> {ok, guid|error} */
function parsePair(text) {
  const t = String(text || "");
  if (/Successfully paired to/i.test(t)) return { ok: true, guid: ((/guid=([^\]\s]+)/.exec(t) || [])[1]) || "" };
  const e = /error:\s*(.+)/i.exec(t) || /Failed[^\n]*/i.exec(t);
  return { ok: false, error: e ? (e[1] || e[0]).trim() : (t.trim().split("\n").pop() || "the phone did not answer") };
}
/** `adb devices -l` -> [{serial, state, model, wifi}] */
function parseDevices(text) {
  return String(text || "").split(/\r?\n/).slice(1).map((l) => l.trim()).filter(Boolean).map((l) => {
    const p = l.split(/\s+/), serial = p[0], state = p[1] || "";
    const model = ((/model:(\S+)/.exec(l) || [])[1] || "").replace(/_/g, " ");
    return { serial, state, model, wifi: /:\d+$/.test(serial) || /_adb-tls-connect/.test(serial) };
  }).filter((d) => d.serial && d.serial !== "*");
}
/** `adb mdns services` -> [{name, type, address}] (the connect services carry the port to `adb connect`) */
function parseMdns(text) {
  return String(text || "").split(/\r?\n/).map((l) => l.trim()).filter((l) => /_adb-tls-(connect|pairing)\._tcp/.test(l)).map((l) => {
    const p = l.split(/\s+/);
    return { name: p[0], type: (/_adb-tls-(connect|pairing)/.exec(l) || [])[1] || "", address: p[p.length - 1] };
  }).filter((s) => /^[\d.]+:\d+$/.test(s.address));
}
/** the phone to install on: the one asked for, else the remembered phone's address / model, else the only one */
function pickDevice(devs, want, remembered) {
  const ok = (devs || []).filter((d) => d.state === "device");
  if (want) return ok.find((d) => d.serial === want) || null;
  const r = remembered || {};
  const byIp = r.ip ? ok.find((d) => d.serial.split(":")[0] === r.ip) : null;
  if (byIp) return byIp;
  const byModel = r.model ? ok.find((d) => d.model === r.model) : null;
  if (byModel) return byModel;
  return ok.length === 1 ? ok[0] : null;
}
/** the APK's versionCode: minutes since 2026-01-01 - every build higher than the last (fits Android's 2.1 billion for 4000 years) */
function versionCode(now) { return Math.max(1, Math.floor(((now || Date.now()) - Date.UTC(2026, 0, 1)) / 60000)); }
/** android/local.properties for an SDK folder (Java properties: \ and : escaped) */
function localProps(sdk) { return "sdk.dir=" + String(sdk).replace(/\\/g, "\\\\").replace(/:/g, "\\:") + "\n"; }
/** Eclipse Temurin 21 (JDK) for this computer */
function adoptiumUrl(plat, arch) {
  const o = { win32: "windows", darwin: "mac", linux: "linux" }[plat || process.platform] || "linux";
  const a = { x64: "x64", arm64: "aarch64" }[arch || process.arch] || "x64";
  return `https://api.adoptium.net/v3/binary/latest/21/ga/${o}/${a}/jdk/hotspot/normal/eclipse`;
}
/** Google's repository2-3.xml -> the newest command-line tools zip for this OS (or the fallback build) */
function latestCmdline(xml, plat) {
  const o = { win32: "win", darwin: "mac", linux: "linux" }[plat || process.platform] || "linux";
  let best = 0;
  const rx = new RegExp("commandlinetools-" + o + "-(\\d+)_latest\\.zip", "g");
  let m;
  while ((m = rx.exec(String(xml || "")))) best = Math.max(best, +m[1]);
  const n = best || +CMDLINE_FALLBACK;
  return `https://dl.google.com/android/repository/commandlinetools-${o}-${n}_latest.zip`;
}
/** where Java 21 and the SDK may be (in this order) */
function candidates(env, plat, home, base) {
  const e = env || {}, P = plat || process.platform, H = home || os.homedir(), B = base || "";
  const jdk = [], sdk = [];
  if (e.JAVA_HOME) jdk.push({ dir: e.JAVA_HOME, source: "JAVA_HOME" });
  if (P === "win32") {
    for (const pf of [e.ProgramFiles || "C:\\Program Files", e.LOCALAPPDATA ? path.win32.join(e.LOCALAPPDATA, "Programs") : ""].filter(Boolean))
      jdk.push({ dir: path.win32.join(pf, "Android", "Android Studio", "jbr"), source: "Android Studio" }, { dir: path.win32.join(pf, "Android Studio", "jbr"), source: "Android Studio" });
  } else if (P === "darwin") jdk.push({ dir: "/Applications/Android Studio.app/Contents/jbr/Contents/Home", source: "Android Studio" });
  else jdk.push({ dir: "/opt/android-studio/jbr", source: "Android Studio" }, { dir: path.join(H, "android-studio", "jbr"), source: "Android Studio" });
  if (B) jdk.push({ dir: path.join(B, "tools", "android", "jdk"), source: "bitGen" });
  for (const k of ["ANDROID_HOME", "ANDROID_SDK_ROOT"]) if (e[k]) sdk.push({ dir: e[k], source: k });
  if (P === "win32") { if (e.LOCALAPPDATA) sdk.push({ dir: path.win32.join(e.LOCALAPPDATA, "Android", "Sdk"), source: "Android Studio" }); }
  else if (P === "darwin") sdk.push({ dir: path.join(H, "Library", "Android", "sdk"), source: "Android Studio" });
  else sdk.push({ dir: path.join(H, "Android", "Sdk"), source: "Android Studio" });
  if (B) sdk.push({ dir: path.join(B, "tools", "android", "sdk"), source: "bitGen" });
  return { jdk, sdk };
}

/* ---------------- live */
function base() { try { return require("./core").BASE; } catch { return path.join(__dirname, ".."); } }
function cfg() { try { return require("./core").getConfig() || {}; } catch { return {}; } }
function saveCfg(patch) { try { const core = require("./core"), c = core.getConfig() || {}; c.apk = Object.assign({}, c.apk || {}, patch); core.setConfig(c); } catch { /* fine */ } }
const exe = (n) => (IS_WIN ? n + ".exe" : n);
/** a JDK folder (or one level in - an unpacked jdk-21.x folder) -> {home, java} */
function jdkHome(dir) {
  if (!dir) return null;
  const tryHome = (h) => (fs.existsSync(path.join(h, "bin", exe("java"))) ? { home: h, java: path.join(h, "bin", exe("java")) } : null);
  let r = tryHome(dir); if (r) return r;
  try {
    for (const d of fs.readdirSync(dir)) {
      const h = path.join(dir, d), mac = path.join(h, "Contents", "Home");
      r = tryHome(mac) || tryHome(h); if (r) return r;
    }
  } catch { /* not there */ }
  return null;
}
const versionCache = new Map();
function javaVersion(java) {
  if (versionCache.has(java)) return versionCache.get(java);
  let v = 0;
  try { const r = spawnSync(java, ["-version"], { encoding: "utf8", timeout: 20000, windowsHide: true }); v = javaMajor(String(r.stderr || "") + String(r.stdout || "")); } catch { v = 0; }
  versionCache.set(java, v);
  return v;
}
function sdkInfo(dir) {
  if (!dir || !fs.existsSync(dir)) return null;
  const has = (p) => fs.existsSync(path.join(dir, p));
  if (!(has("platform-tools") || has("platforms") || has("cmdline-tools") || has("build-tools"))) return null;
  const adb = path.join(dir, "platform-tools", exe("adb"));
  const sdkm = ["latest"].concat((() => { try { return fs.readdirSync(path.join(dir, "cmdline-tools")); } catch { return []; } })())
    .map((v) => path.join(dir, "cmdline-tools", v, "bin", IS_WIN ? "sdkmanager.bat" : "sdkmanager")).find((p) => fs.existsSync(p)) || "";
  return { dir, adb: fs.existsSync(adb) ? adb : "", sdkmanager: sdkm, platform36: has(path.join("platforms", "android-36")) };
}
function findTools() {
  const c = cfg().apk || {}, cand = candidates(process.env, process.platform, os.homedir(), base());
  if (c.jdk) cand.jdk.unshift({ dir: c.jdk, source: "Settings" });
  if (c.sdk) cand.sdk.unshift({ dir: c.sdk, source: "Settings" });
  let jdk = null, oldJdk = null;
  for (const x of cand.jdk) {
    const h = jdkHome(x.dir); if (!h) continue;
    const v = javaVersion(h.java);
    if (v >= 21) { jdk = Object.assign({ source: x.source, version: v }, h); break; }
    if (!oldJdk) oldJdk = Object.assign({ source: x.source, version: v }, h);
  }
  let sdk = null;
  for (const x of cand.sdk) { const i = sdkInfo(x.dir); if (i) { sdk = Object.assign({ source: x.source }, i); break; } }
  return { jdk, oldJdk, sdk };
}
let SR = null;
function setupRun() { if (SR === null) { try { SR = require("./setupRun"); } catch { SR = false; } } return SR || null; }
function npmPath() { const X = require("./setupExec"), sr = setupRun(); return X.which("npm", sr ? sr.runtimeDirs() : []); }
function nodePath() { const X = require("./setupExec"), sr = setupRun(); return X.which("node", sr ? sr.runtimeDirs() : []) || process.execPath; }
function mobileDir() { return path.join(base(), "mobile"); }
function apkOut() { return path.join(mobileDir(), "dist", "bitGen.apk"); }
function mobileVersion() { try { return JSON.parse(fs.readFileSync(path.join(mobileDir(), "package.json"), "utf8")).version || ""; } catch { return ""; } }

let J = { state: "idle", log: [] };
function job() { return J; }
function begin(kind) {
  if (J.state === "running") { const e = new Error("bitGen is already " + J.kind + " - wait for it, or ■ Stop it"); e.status = 409; throw e; }
  J = { state: "running", kind, phase: "", log: [], started: Date.now(), got: 0, total: 0, procs: [] };
  return J;
}
function log(line, err) { const l = (err ? "! " : "") + String(line); J.log.push(l); if (J.log.length > 600) J.log.splice(0, J.log.length - 600); }
function finish(err, extra) {
  J.procs = [];
  if (err) { J.state = "failed"; J.error = String(err.message || err); log(J.error, true); }
  else { J.state = "done"; J.error = ""; }
  J.finished = Date.now();
  Object.assign(J, extra || {});
}
/** run with an optional stdin text; every line into the job's log -> {code, out} */
function run(cmd, args, o) {
  const opt = o || {};
  return new Promise((resolve) => {
    let out = "", child;
    log("> " + [path.basename(cmd)].concat(args || []).join(" "));
    // through a shell (a .bat / .cmd on Windows - Node refuses them without one): the shell does not quote, so a path with a
    // space (C:\Program Files\nodejs\npm.cmd) is quoted here
    const shell = !!opt.shell || (IS_WIN && /\.(bat|cmd)$/i.test(cmd));
    const q = (a) => (shell && /[\s&()^]/.test(String(a)) && !/^".*"$/.test(String(a)) ? '"' + a + '"' : String(a));
    try {
      child = spawn(q(cmd), (args || []).map(q), { cwd: opt.cwd, env: opt.env || process.env, windowsHide: true, shell,
        stdio: [opt.input != null ? "pipe" : "ignore", "pipe", "pipe"] });
    } catch (e) { log(e.message, true); return resolve({ code: -1, out: e.message }); }
    J.procs = (J.procs || []).concat([child]);
    let timer = opt.timeout ? setTimeout(() => { log(path.basename(cmd) + " took too long - stopped", true); try { require("./setupExec").killTree(child); } catch { /* gone */ } }, opt.timeout) : null;
    const feed = () => { let buf = ""; return (d) => { const s = String(d); out += s; buf += s; const parts = buf.split(/\r?\n|\r/); buf = parts.pop(); for (const l of parts) if (l.trim()) log(l); }; };
    child.stdout.on("data", feed()); child.stderr.on("data", feed());
    if (opt.input != null) { try { child.stdin.write(opt.input); child.stdin.end(); } catch { /* closed */ } }
    child.on("error", (e) => { log(e.message, true); });
    child.on("close", (code) => { if (timer) clearTimeout(timer); resolve({ code: code == null ? -1 : code, out }); });
  });
}
function toolEnv(t) {
  const e = Object.assign({}, process.env);
  const key = Object.keys(e).find((k) => k.toUpperCase() === "PATH") || "PATH";
  const extra = [];
  if (t.jdk) { e.JAVA_HOME = t.jdk.home; extra.push(path.join(t.jdk.home, "bin")); }
  if (t.sdk) { e.ANDROID_HOME = t.sdk.dir; e.ANDROID_SDK_ROOT = t.sdk.dir; extra.push(path.join(t.sdk.dir, "platform-tools")); }
  const sr = setupRun(); if (sr) extra.push(...sr.runtimeDirs().filter((d) => fs.existsSync(d)));
  e[key] = extra.concat([e[key] || ""]).join(path.delimiter);
  return e;
}

/** what is here now (the Settings box paints it) */
function status() {
  const t = findTools(), apk = apkOut();
  let built = null;
  try { const st = fs.statSync(apk); built = { path: apk, size: st.size, at: st.mtimeMs, version: (cfg().apk || {}).built_version || "" }; } catch { built = null; }
  return {
    jdk: t.jdk ? { path: t.jdk.home, version: t.jdk.version, source: t.jdk.source } : null,
    jdk_old: !t.jdk && t.oldJdk ? { path: t.oldJdk.home, version: t.oldJdk.version, source: t.oldJdk.source } : null,
    sdk: t.sdk ? { path: t.sdk.dir, source: t.sdk.source, adb: !!t.sdk.adb, sdkmanager: !!t.sdk.sdkmanager, platform36: t.sdk.platform36 } : null,
    npm: !!npmPath(), mobile: fs.existsSync(path.join(mobileDir(), "capacitor.config.json")), app_version: mobileVersion(),
    apk: built, phone: (cfg().apk || {}).phone || null, download: SIZE, folders: { jdk: (cfg().apk || {}).jdk || "", sdk: (cfg().apk || {}).sdk || "" },
    job: { state: J.state, kind: J.kind || "", phase: J.phase || "", got: J.got || 0, total: J.total || 0, error: J.error || "", log: J.log.slice(-200), devices: J.devices || null },
  };
}

/* ---- ⬇ the build tools bitGen gets for itself (only what is missing) */
async function fetchTo(url, file, what) {
  const X = require("./setupExec");
  J.phase = "downloading " + what; J.got = 0; J.total = 0;
  log("⬇ " + what + " - " + url);
  const r = await X.download(url, file, { onProgress: (p) => { J.got = p.got; J.total = p.total; } });
  if (!r.ok) throw new Error(what + " could not be downloaded (" + (r.error || "HTTP " + r.status) + ")");
  return file;
}
function unpack(file, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const r = spawnSync("tar", ["-xf", file, "-C", dest], { stdio: "ignore", timeout: 20 * 60000, windowsHide: true });
  if (r.status !== 0) {
    if (/\.zip$/i.test(file) && !IS_WIN) {
      const u = spawnSync("unzip", ["-q", "-o", file, "-d", dest], { stdio: "ignore", timeout: 20 * 60000 });
      if (u.status === 0) return;
    }
    throw new Error(path.basename(file) + " could not be unpacked (tar)");
  }
}
async function getTools() {
  begin("getting the build tools");
  try {
    const own = path.join(base(), "tools", "android"), dl = path.join(own, "downloads");
    fs.mkdirSync(dl, { recursive: true });
    let t = findTools();
    if (!t.jdk) {
      const file = path.join(dl, IS_WIN ? "temurin21.zip" : "temurin21.tar.gz");
      await fetchTo(adoptiumUrl(), file, "Java 21 (Eclipse Temurin)");
      J.phase = "unpacking Java"; fs.rmSync(path.join(own, "jdk"), { recursive: true, force: true });
      unpack(file, path.join(own, "jdk")); fs.rmSync(file, { force: true });
      versionCache.clear(); t = findTools();
      if (!t.jdk) throw new Error("Java 21 was downloaded but its java could not be run");
      log("✓ Java " + t.jdk.version + " in " + t.jdk.home);
    } else log("✓ Java " + t.jdk.version + " (" + t.jdk.source + ") - " + t.jdk.home);
    let sdkDir = t.sdk ? t.sdk.dir : path.join(own, "sdk");
    if (!t.sdk || !t.sdk.sdkmanager) {
      J.phase = "finding Google's command-line tools";
      let xml = "";
      try { const r = await require("./setupExec").getJson("https://dl.google.com/android/repository/repository2-3.xml"); xml = r.body || ""; } catch { xml = ""; }
      const file = path.join(dl, "cmdline-tools.zip");
      await fetchTo(latestCmdline(xml), file, "the Android command-line tools");
      J.phase = "unpacking the command-line tools";
      const tmp = path.join(dl, "cmdline-unpack"); fs.rmSync(tmp, { recursive: true, force: true });
      unpack(file, tmp);
      const latest = path.join(sdkDir, "cmdline-tools", "latest");
      fs.rmSync(latest, { recursive: true, force: true }); fs.mkdirSync(path.dirname(latest), { recursive: true });
      fs.renameSync(path.join(tmp, "cmdline-tools"), latest);
      fs.rmSync(tmp, { recursive: true, force: true }); fs.rmSync(file, { force: true });
      saveCfg({ sdk: sdkDir });
      t = findTools();
    } else log("✓ the Android SDK (" + t.sdk.source + ") - " + t.sdk.dir);
    if (!t.sdk || !t.sdk.sdkmanager) throw new Error("the Android command-line tools are not where they should be in " + sdkDir);
    if (!t.sdk.adb || !t.sdk.platform36) {
      const env = toolEnv(t);
      J.phase = "accepting the Android SDK licences";
      await run(t.sdk.sdkmanager, ["--sdk_root=" + t.sdk.dir, "--licenses"], { env, input: "y\n".repeat(40), timeout: 10 * 60000 });
      J.phase = "installing platform-tools, Android 36, build-tools";
      const r = await run(t.sdk.sdkmanager, ["--sdk_root=" + t.sdk.dir].concat(SDK_PKGS), { env, input: "y\n".repeat(10), timeout: 40 * 60000 });
      if (r.code !== 0) throw new Error("sdkmanager could not install " + SDK_PKGS.join(", ") + " (see the log)");
      t = findTools();
    }
    log("✓ ready: Java " + t.jdk.version + ", the SDK in " + t.sdk.dir + (t.sdk.adb ? ", adb" : ""));
    finish(null);
  } catch (e) { finish(e); }
  return J;
}

/* ---- 🔨 build */
async function build(then, theme) {
  begin("building the app");
  try {
    const t = findTools();
    if (!t.jdk) throw new Error(t.oldJdk ? "Java " + t.oldJdk.version + " found (" + t.oldJdk.home + ") - the app needs Java 21: ⬇ Get the build tools" : "Java 21 is not here - ⬇ Get the build tools (or install Android Studio)");
    if (!t.sdk) throw new Error("the Android SDK is not here - ⬇ Get the build tools (or install Android Studio)");
    const dir = mobileDir();
    if (!fs.existsSync(path.join(dir, "capacitor.config.json"))) throw new Error("the app's source (mobile/) is not in this install - update bitGen Studio");
    const env = toolEnv(t), npm = npmPath(), node = nodePath();
    if (!npm) throw new Error("npm was not found - it comes with Node.js (bitGen's runtime/node or a Node install)");
    const nodeEnv = node === process.execPath && process.versions.electron ? Object.assign({}, env, { ELECTRON_RUN_AS_NODE: "1" }) : env;
    J.phase = "npm install (the app's packages)";
    let r = await run(npm, ["install", "--no-audit", "--no-fund"], { cwd: dir, env, shell: IS_WIN, timeout: 20 * 60000 });
    if (r.code !== 0) throw new Error("npm install did not finish (see the log)");
    J.phase = "copying the app into the Android project";
    // 2.912.0: this build's id - in the app (www/lib/build.js) and on this PC (apk.built_id), for the app's ⬆ Update check
    let studio = ""; try { studio = require("../package.json").version; } catch { studio = ""; }
    // 2.924.0 (Tim: "when building the app from bitgen can we use the theme colors currently selected for the app?"): the
    // studio's theme in use (sent by the page) -> www/lib/theme.js (lib/apkTheme.js)
    const th = require("./apkTheme").write(dir, theme);
    log(th.name ? "🎨 the app's colours: bitGen Studio's theme \"" + th.name + "\" (" + th.scheme + ", accent " + th.accent + ")" : "🎨 the app's colours: its own look (no studio theme was sent)");
    const buildId = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
    r = await run(node, [path.join(dir, "scripts", "vendor.js")], { cwd: dir, env: Object.assign({}, nodeEnv, { BG_BUILD_ID: buildId, BG_STUDIO_VERSION: studio }), timeout: 120000 });
    if (r.code !== 0) throw new Error("the app's files could not be prepared (scripts/vendor.js)");
    const cap = path.join(dir, "node_modules", "@capacitor", "cli", "bin", "capacitor");
    r = await run(node, [cap, "sync", "android"], { cwd: dir, env: nodeEnv, timeout: 10 * 60000 });
    if (r.code !== 0) throw new Error("cap sync android did not finish (see the log)");
    const adir = path.join(dir, "android");
    fs.writeFileSync(path.join(adir, "local.properties"), localProps(t.sdk.dir));
    J.phase = "Gradle: building the APK (the first build downloads Gradle and its libraries - several minutes)";
    // the e2e gate (H3_E2E=1 only) points Gradle at a stand-in that makes the APK file - the real one needs Google's servers
    const fakeGw = process.env.H3_E2E === "1" ? ((cfg().apk || {}).test_gradlew || process.env.H3_APK_GRADLEW || "") : "";
    const gw = fakeGw || (IS_WIN ? path.join(adir, "gradlew.bat") : path.join(adir, "gradlew"));
    // 2.912.0: versionCode always higher (Android installs an update only over a lower one), versionName = mobile/package.json
    const gArgs = ["assembleDebug", "--no-daemon", "--console=plain", "-PbgVersionCode=" + versionCode(), "-PbgVersionName=" + (mobileVersion() || "1.0")];
    r = IS_WIN || fakeGw ? await run(gw, gArgs, { cwd: adir, env, shell: IS_WIN, timeout: 60 * 60000 })
      : await run("sh", [gw].concat(gArgs), { cwd: adir, env, timeout: 60 * 60000 });
    const made = path.join(adir, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
    if (r.code !== 0 || !fs.existsSync(made)) throw new Error("Gradle did not make the APK (see the log - the lines above BUILD FAILED say why)");
    fs.mkdirSync(path.dirname(apkOut()), { recursive: true });
    fs.copyFileSync(made, apkOut());
    saveCfg({ built_version: mobileVersion() + " (bitGen Studio " + studio + ")", built_id: buildId, built_app: mobileVersion() });
    log("✓ the app: " + apkOut() + " (" + Math.round(fs.statSync(apkOut()).size / 1048576 * 10) / 10 + " MB)");
    finish(null, { apk: apkOut() });
  } catch (e) { finish(e); return J; }
  if (then === "install") return install({ chained: true });
  return J;
}

/* ---- 📱 the phone (adb over Wi-Fi) */
function adbPath() { const t = findTools(); return t.sdk && t.sdk.adb ? t.sdk.adb : ""; }
async function adb(args, opt) {
  const a = adbPath();
  if (!a) { const e = new Error("adb is not here (the SDK's platform-tools) - ⬇ Get the build tools first"); e.status = 409; throw e; }
  return run(a, args, Object.assign({ timeout: 60000 }, opt || {}));
}
async function devices() { const r = await adb(["devices", "-l"]); return parseDevices(r.out); }
/** the remembered phone again: its Wireless debugging port changes each time - found by mDNS */
async function reconnect(remembered) {
  const r = await adb(["mdns", "services"]);
  const conn = parseMdns(r.out).filter((s) => s.type === "connect");
  const mine = (remembered && remembered.ip ? conn.filter((s) => s.address.split(":")[0] === remembered.ip) : conn)[0];
  if (!mine) return null;
  const c = await adb(["connect", mine.address]);
  return /connected to|already connected/i.test(c.out) ? mine.address : null;
}
async function pair(address, code) {
  begin("pairing the phone");
  try {
    const a = String(address || "").trim(), c = String(code || "").trim();
    if (!/^[\d.]+:\d{2,5}$/.test(a)) throw new Error("the pairing address looks like 192.168.1.23:37123 - the phone shows it under Wireless debugging ▸ Pair device with pairing code");
    if (!/^\d{6}$/.test(c)) throw new Error("the pairing code is the 6 digits the phone shows");
    J.phase = "pairing with " + a;
    const r = await adb(["pair", a, c], { timeout: 45000 });
    const p = parsePair(r.out);
    if (!p.ok) throw new Error("the phone did not pair: " + p.error + " (the code changes each time the pairing screen opens)");
    log("✓ paired");
    const ip = a.split(":")[0];
    saveCfg({ phone: { ip, paired: Date.now(), model: "" } });
    J.phase = "connecting (finding the phone's Wireless debugging port)";
    let addr = null;
    for (let i = 0; i < 6 && !addr; i++) { addr = await reconnect({ ip }); if (!addr) await new Promise((ok) => setTimeout(ok, 1500)); }
    const devs = await devices();
    const d = pickDevice(devs, "", { ip });
    if (d) { saveCfg({ phone: { ip, paired: Date.now(), model: d.model } }); log("✓ connected: " + (d.model || d.serial)); }
    else log("paired - now type the IP address & port from the phone's Wireless debugging screen into Connect (the mDNS search did not find it)");
    finish(null, { devices: devs });
  } catch (e) { finish(e); }
  return J;
}
async function connect(address) {
  begin("connecting the phone");
  try {
    const a = String(address || "").trim();
    if (!/^[\d.]+:\d{2,5}$/.test(a)) throw new Error("the address looks like 192.168.1.23:41234 - the IP address & Port on the phone's Wireless debugging screen");
    const r = await adb(["connect", a]);
    if (!/connected to|already connected/i.test(r.out)) throw new Error("could not connect to " + a + ": " + (r.out.trim().split("\n").pop() || "no answer") + " - pair it first, the phone on the same Wi-Fi");
    const devs = await devices(), d = pickDevice(devs, a, null);
    saveCfg({ phone: Object.assign({}, (cfg().apk || {}).phone || {}, { ip: a.split(":")[0], model: d ? d.model : "" }) });
    log("✓ connected: " + (d ? d.model || d.serial : a));
    finish(null, { devices: devs });
  } catch (e) { finish(e); }
  return J;
}
async function install(o) {
  const opt = o || {};
  if (opt.chained) { J.state = "running"; J.kind = "installing the app"; J.error = ""; }
  else begin("installing the app");
  try {
    if (!fs.existsSync(apkOut())) throw new Error("there is no APK yet - 🔨 Build the app first");
    J.phase = "finding the phone";
    const remembered = (cfg().apk || {}).phone || null;
    let devs = await devices(), d = pickDevice(devs, opt.serial || "", remembered);
    if (!d && remembered) { await reconnect(remembered); devs = await devices(); d = pickDevice(devs, opt.serial || "", remembered); }
    if (!d) {
      const n = devs.filter((x) => x.state === "device").length;
      throw new Error(n > 1 ? "more than one phone is connected - pick one" : remembered
        ? "the phone was not found - switch Wireless debugging on (Settings ▸ Developer options), the phone on the same Wi-Fi, then Install again"
        : "no phone is connected - pair it first (Wireless debugging ▸ Pair device with pairing code)");
    }
    J.phase = "installing on " + (d.model || d.serial);
    const r = await adb(["-s", d.serial, "install", "-r", apkOut()], { timeout: 10 * 60000 });
    if (!/Success/.test(r.out)) {
      const why = (/Failure \[([^\]]+)\]/.exec(r.out) || [])[1] || r.out.trim().split("\n").pop();
      throw new Error("the phone refused it: " + why + (/UPDATE_INCOMPATIBLE|SIGNATURE/i.test(why) ? " - the bitGen app on the phone was signed elsewhere: uninstall it on the phone once, then Install again" : ""));
    }
    await adb(["-s", d.serial, "shell", "monkey", "-p", APP_ID, "-c", "android.intent.category.LAUNCHER", "1"], { timeout: 30000 });
    saveCfg({ phone: Object.assign({}, remembered || {}, { ip: d.serial.split(":")[0], model: d.model, installed: Date.now() }) });
    log("✓ installed and started on " + (d.model || d.serial));
    finish(null, { devices: devs });
  } catch (e) { finish(e); }
  return J;
}
/** Settings: the Java / SDK folders to use ("" = search), forget the phone; the e2e gate's Gradle stand-in (H3_E2E only) */
function setPaths(o) {
  const a = o || {}, patch = {};
  for (const k of ["jdk", "sdk"]) if (typeof a[k] === "string") patch[k] = a[k].trim().slice(0, 500);
  if (a.forget_phone) patch.phone = null;
  if (process.env.H3_E2E === "1" && typeof a.test_gradlew === "string") patch.test_gradlew = a.test_gradlew;
  saveCfg(patch); versionCache.clear();
  return status();
}
function stop() {
  for (const c of J.procs || []) { try { require("./setupExec").killTree(c); } catch { /* gone */ } }
  if (J.state === "running") finish(new Error("stopped"));
  return J;
}
module.exports = { APP_ID, SDK_PKGS, SIZE, versionCode, javaMajor, parsePair, parseDevices, parseMdns, pickDevice, localProps, adoptiumUrl, latestCmdline, candidates,
  findTools, status, job, getTools, build, pair, connect, install, devices, stop, setPaths, apkOut, mobileDir };
