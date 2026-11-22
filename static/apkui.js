/* bitGen Studio — static/apkui.js (2.911.0): Settings ▸ General ▸ Remote ▸ 📱 THE bitGen APP - build it on this PC and put it
 * on the phone over Wi-Fi (H3ApkUi; the server side is lib/apkBuild.js, routes/apkBuild.js).
 *
 * Tim (verbatim): "can we compile the apk in bitgen, general tab remote - and install it to the phone automatically?" -
 * the build tools from Android Studio when it is there, else ⬇ downloaded by bitGen (a Download / Cancel box with the size);
 * onto the phone by Wireless debugging (pair once with the phone's 6-digit code, then 🔨 Build + install with no taps).
 * Pure (Node): toolsLine(status), phoneLine(status), pct(job). */
(function (root) {
  "use strict";
  function toolsLine(st) {
    var s = st || {}, bits = [];
    bits.push(s.jdk ? "✓ Java " + s.jdk.version + " (" + s.jdk.source + ")" : s.jdk_old ? "✗ Java " + s.jdk_old.version + " is too old - the app needs 21" : "✗ Java 21");
    bits.push(s.sdk ? "✓ Android SDK (" + s.sdk.source + ")" + (s.sdk.adb ? "" : " - no adb yet") : "✗ Android SDK");
    if (!s.npm) bits.push("✗ npm");
    if (s.mobile === false) bits.push("✗ the app's source (mobile/) - update bitGen Studio");
    return bits.join(" · ");
  }
  function ready(st) { var s = st || {}; return !!(s.jdk && s.sdk && s.sdk.adb); }
  function phoneLine(st) {
    var p = (st || {}).phone;
    if (!p || !p.ip) return "No phone paired yet.";
    return "📱 " + (p.model || "the phone") + " at " + p.ip + (p.installed ? " - last install " + new Date(p.installed).toLocaleString() : " - paired");
  }
  function pct(j) { return j && j.total ? Math.round(j.got / j.total * 100) : null; }
  var API = { toolsLine: toolsLine, phoneLine: phoneLine, pct: pct, ready: ready };
  if (typeof module !== "undefined" && module.exports && typeof document === "undefined") { module.exports = API; return; }

  var doc = root.document;
  function $(id) { return doc.getElementById(id); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var HTML = '<label class="f" style="margin-top:14px">📱 The bitGen app (Android)</label>'
    + '<p class="hint help" style="margin:2px 0 6px">Build the phone app on this PC and install it on your phone over Wi-Fi. It needs Java 21 and the Android SDK: bitGen uses the ones of Android Studio when it is installed, otherwise Get the build tools downloads them (about 1.5 - 2 GB) into the tools folder of bitGen.</p>'
    + '<div id="apk_tools" class="hint" style="margin:4px 0"></div>'
    + '<div class="scale" style="gap:8px;flex-wrap:wrap">'
    + '<button class="ghost" id="apk_get" type="button" title="Download what is missing: Java 21 (Eclipse Temurin) and/or the Android SDK from Google (command-line tools, platform-tools, Android 36, build-tools)">⬇ Get the build tools</button>'
    + '<button class="ghost" id="apk_build" type="button" title="npm install, cap sync, Gradle assembleDebug → mobile/dist/bitGen.apk (the first build downloads Gradle - several minutes)">🔨 Build the app</button>'
    + '<button class="ghost" id="apk_buildinst" type="button" title="Build it, then install it on the paired phone and start it">🔨 Build + install</button>'
    + '<button class="ghost" id="apk_inst" type="button" title="Install the last build on the paired phone (Wireless debugging on) and start it">⤓ Install on the phone</button>'
    + '<a class="ghost" id="apk_file" href="/api/apk/file" download style="text-decoration:none;padding:6px 10px;border:1px solid var(--line);border-radius:6px">⬇ APK file</a>'
    + '<button class="ghost" id="apk_qr" type="button" title="No Wireless debugging: a QR for the phone camera - the phone downloads the app from this PC over Wi-Fi and you tap Install (Remote access on)">📲 Install with a QR</button>'
    + '<button class="ghost" id="apk_reveal" type="button" title="Explorer with the APK selected - drag it onto the phone screen in Phone Link, or right-click ▸ Share ▸ Phone Link; on the phone tap it in Downloads">📂 Show the APK</button>'
    + '<button class="ghost" id="apk_stop" type="button" hidden>■ Stop</button></div>'
    + '<div id="apk_apk" class="hint" style="margin:4px 0"></div>'
    + '<div id="apk_qrbox" hidden style="margin:6px 0"><div id="apk_qrimg" style="padding:10px;background:#fff;border-radius:10px;width:max-content"></div>'
    + '<div id="apk_qrurl" class="hint" style="font-family:var(--mono);word-break:break-all;margin-top:4px"></div>'
    + '<p class="hint" style="margin:4px 0">Scan it with the phone camera, open the link, and tap Install when the download finishes (the first time Android asks to allow the browser to install apps). Samsung Auto Blocker must be off for this: Settings ▸ Security and privacy ▸ Auto Blocker. The link works for 15 minutes.</p></div>'
    + '<p class="hint help" style="margin:2px 0 6px">No Wireless debugging? Use 📲 Install with a QR, or 📂 Show the APK and send it with Phone Link. Once the app is on the phone, it offers ⬆ Update by itself when a newer build is on this PC.</p>'
    + '<details id="apk_phone" style="margin:6px 0"><summary class="hint" style="cursor:pointer">Pair the phone (Wireless debugging - once)</summary>'
    + '<ol class="hint" style="margin:6px 0 6px 18px;padding:0"><li>On the phone: Settings ▸ About phone ▸ Software information ▸ tap <b>Build number</b> 7 times (Developer options).</li>'
    + '<li>Settings ▸ <b>Developer options</b> ▸ <b>Wireless debugging</b> - on (the phone on the same Wi-Fi as this PC).</li>'
    + '<li>Tap <b>Pair device with pairing code</b> - type its IP address &amp; port and the 6-digit code here, then Pair.</li></ol>'
    + '<div class="scale" style="gap:6px;flex-wrap:wrap"><input id="apk_paddr" placeholder="192.168.1.23:37123" style="width:170px" autocomplete="off">'
    + '<input id="apk_pcode" placeholder="6-digit code" inputmode="numeric" style="width:110px" autocomplete="off"><button class="ghost" id="apk_pair" type="button">Pair</button></div>'
    + '<div class="scale" style="gap:6px;flex-wrap:wrap;margin-top:6px"><input id="apk_caddr" placeholder="IP address &amp; port of Wireless debugging" style="width:250px" autocomplete="off">'
    + '<button class="ghost" id="apk_conn" type="button" title="Only when Pair did not connect by itself: the IP address &amp; Port on the Wireless debugging screen (not the pairing one)">Connect</button></div></details>'
    + '<details id="apk_dirs" style="margin:6px 0"><summary class="hint" style="cursor:pointer">Java / Android SDK folders (optional - empty = find them)</summary>'
    + '<div class="scale" style="gap:6px;flex-wrap:wrap;margin-top:6px"><input id="apk_jdk" placeholder="Java 21 folder (has bin\\java)" style="width:260px" autocomplete="off">'
    + '<input id="apk_sdk" placeholder="Android SDK folder" style="width:260px" autocomplete="off"><button class="ghost" id="apk_dirsave" type="button">Save</button>'
    + '<button class="ghost" id="apk_forget" type="button" title="Forget the paired phone (pair it again to install)">Forget the phone</button></div></details>'
    + '<div id="apk_phoneline" class="hint" style="margin:4px 0"></div>'
    + '<div id="apk_phase" class="hint" style="margin:4px 0;color:var(--tiger)"></div>'
    + '<div id="apk_bar" style="height:4px;background:var(--panel-2);border-radius:2px;overflow:hidden;display:none"><i style="display:block;height:100%;width:0;background:var(--tiger)"></i></div>'
    + '<pre id="apk_log" style="display:none;max-height:180px;overflow:auto;font:11px/1.35 var(--mono);background:var(--panel-2);padding:6px;border-radius:6px;white-space:pre-wrap;margin:6px 0"></pre>';
  var last = null, timer = 0;
  function paint(st) {
    last = st;
    var j = st.job || {}, busy = j.state === "running", okTools = ready(st);
    $("apk_tools").textContent = toolsLine(st);
    $("apk_get").hidden = okTools && !busy;
    ["apk_build", "apk_buildinst"].forEach(function (id) { $(id).disabled = busy || !(st.jdk && st.sdk) || !st.mobile; });
    $("apk_inst").disabled = busy || !st.apk || !(st.sdk && st.sdk.adb);
    $("apk_buildinst").disabled = $("apk_buildinst").disabled || !(st.phone && st.phone.ip);
    $("apk_file").style.display = st.apk ? "" : "none";
    $("apk_qr").disabled = busy || !st.apk; $("apk_reveal").disabled = !st.apk;
    $("apk_get").disabled = busy;
    ["apk_pair", "apk_conn"].forEach(function (id) { $(id).disabled = busy || !(st.sdk && st.sdk.adb); });
    $("apk_stop").hidden = !busy;
    $("apk_apk").textContent = st.apk ? "Built: bitGen " + (st.apk.version || st.app_version || "") + " - " + Math.round(st.apk.size / 1048576 * 10) / 10 + " MB, " + new Date(st.apk.at).toLocaleString() : "Not built yet.";
    $("apk_phoneline").textContent = phoneLine(st);
    var fo = st.folders || {};
    if (doc.activeElement !== $("apk_jdk")) $("apk_jdk").value = fo.jdk || "";
    if (doc.activeElement !== $("apk_sdk")) $("apk_sdk").value = fo.sdk || "";
    var p = pct(j);
    $("apk_phase").textContent = busy ? "⏳ " + (j.kind || "") + (j.phase ? " - " + j.phase : "") + (p != null ? " " + p + "%" : "")
      : j.state === "failed" ? "✗ " + (j.kind || "") + ": " + (j.error || "") : j.state === "done" ? "✓ " + (j.kind || "") + " - done" : "";
    $("apk_phase").style.color = j.state === "failed" ? "var(--bad, #e5594f)" : j.state === "done" ? "var(--ok, #6cc070)" : "var(--tiger)";
    $("apk_bar").style.display = busy && p != null ? "" : "none"; $("apk_bar").firstChild.style.width = (p || 0) + "%";
    var lg = $("apk_log"), lines = j.log || [];
    lg.style.display = lines.length ? "" : "none";
    var atEnd = lg.scrollTop + lg.clientHeight >= lg.scrollHeight - 8;
    lg.textContent = lines.join("\n");
    if (atEnd) lg.scrollTop = lg.scrollHeight;
    try { if (root.H3TestEvent) root.H3TestEvent("apk_status", j.state + ":" + (j.phase || "")); } catch (e) { /* the 🧪 list */ }
    clearTimeout(timer);
    if (busy) timer = setTimeout(refresh, 1200);
  }
  function refresh() { return fetch("/api/apk/status").then(function (r) { return r.json(); }).then(paint).catch(function () { /* the next look */ }); }
  function post(url, body) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); })
      .then(paint).catch(function (e) { $("apk_phase").textContent = "✗ " + e.message; $("apk_phase").style.color = "var(--bad, #e5594f)"; });
  }
  /* 2.924.0 (Tim: "when building the app from bitgen can we use the theme colors currently selected for the app?"): the
     theme in use here - its colours with your accent and Customize changes (static/themes.js) - goes with the build
     (lib/apkTheme.js writes it into the app) */
  function themeNow() {
    var T = root.H3Theme; if (!T || !T.current || !T.varsFor) return null;
    try {
      var c = T.current(), v = T.varsFor(c.theme, c.accent, c.vars), vars = {}, th = (T.THEMES || {})[c.theme] || {};
      Object.keys(v).forEach(function (k) { if (k.indexOf("--th-") !== 0) vars[k.slice(2)] = v[k]; });
      return { name: c.name || th.name || c.theme, scheme: th.scheme || "dark", vars: vars };
    } catch (e) { return null; }
  }
  function confirmGet() {
    var s = last || {}, what = [!s.jdk ? "Java 21 (Eclipse Temurin, ~200 MB)" : "", !s.sdk ? "the Android SDK (Google's command-line tools, platform-tools, Android 36, build-tools - ~600 MB)" : (!s.sdk.adb ? "the Android SDK's platform-tools, Android 36, build-tools" : "")].filter(Boolean);
    var text = "⬇ Download " + (what.join(" and ") || "the build tools") + " into bitGen's tools folder?\n\nGoogle's Android SDK licences are accepted for you (as Android Studio's setup does). The first build then downloads Gradle and its libraries (a few hundred MB).";
    if (root.confirm(text)) post("/api/apk/tools");
  }
  function wire() {
    $("apk_get").onclick = confirmGet;
    $("apk_build").onclick = function () { post("/api/apk/build", { theme: themeNow() }); };
    $("apk_buildinst").onclick = function () { post("/api/apk/build", { install: true, theme: themeNow() }); };
    $("apk_inst").onclick = function () { post("/api/apk/install", {}); };
    $("apk_stop").onclick = function () { post("/api/apk/stop"); };
    $("apk_pair").onclick = function () { post("/api/apk/pair", { address: $("apk_paddr").value.trim(), code: $("apk_pcode").value.trim() }); };
    $("apk_conn").onclick = function () { post("/api/apk/connect", { address: $("apk_caddr").value.trim() }); };
    $("apk_dirsave").onclick = function () { post("/api/apk/paths", { jdk: $("apk_jdk").value, sdk: $("apk_sdk").value }); };
    $("apk_forget").onclick = function () { post("/api/apk/paths", { forget_phone: true }); };
    $("apk_qr").onclick = function () {
      fetch("/api/apk/qr", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); })
        .then(function (j) { $("apk_qrbox").hidden = false; $("apk_qrimg").innerHTML = j.qr || ""; $("apk_qrurl").textContent = j.url; try { if (root.H3TestEvent) root.H3TestEvent("apk_qr", j.url); } catch (e) { /* 🧪 */ } })
        .catch(function (e) { $("apk_qrbox").hidden = true; $("apk_phase").textContent = "✗ " + e.message; $("apk_phase").style.color = "var(--bad, #e5594f)"; });
    };
    $("apk_reveal").onclick = function () {
      fetch("/api/apk/reveal", { method: "POST" }).then(function (r) { return r.json(); }).then(function (j) {
        $("apk_phase").textContent = j.error ? "✗ " + j.error : "📂 " + j.file + " - drag it onto the phone screen in Phone Link (or right-click ▸ Share ▸ Phone Link); on the phone open Downloads and tap it";
        $("apk_phase").style.color = j.error ? "var(--bad, #e5594f)" : "var(--ok, #6cc070)";
      }).catch(function () { /* fine */ });
    };
  }
  function boot() {
    var after = $("s_remote_alts");
    if (!after) { setTimeout(boot, 800); return; }
    if ($("apk_box")) return;
    var box = doc.createElement("div"); box.id = "apk_box"; box.innerHTML = HTML;
    after.parentNode.insertBefore(box, after.nextSibling);
    wire(); refresh();
    var tab = $("stab-general");
    if (tab && root.MutationObserver) new root.MutationObserver(function () { if (tab.classList.contains("active")) refresh(); }).observe(tab, { attributes: true, attributeFilter: ["class"] });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3ApkUi = Object.assign(API, { refresh: refresh, paint: paint });
})(typeof window !== "undefined" ? window : globalThis);
