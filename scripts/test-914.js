#!/usr/bin/env node
// bitGen Studio 2.914.0 - Remote access ▾ (Off / Wi-Fi / a relay / Cloudflare) + the relay for its admins only + 🎙 Talk in the
// app (Tim: "can you make remote access a dropdown in settings-general, add an input for url to relay.php and a cloudflare
// option ... voice chat will be very useful especially if we can add keywords or phrases, like fix this photo or create a
// video or create a song about... or if i say find... it goes to websearch mode"). Run: node scripts/test-9131.js
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got).slice(0, 400)); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// Remote access ▾
const A = require("../lib/remoteAway");
check("the modes: none / relay / cloudflare", A.MODES.join() === "none,relay,cloudflare");
check("relay address: https kept, a folder gets relay.php, http only to this computer, nonsense refused, empty = bitGen's own",
  A.cleanRelayUrl("https://example.org/bgc/") === "https://example.org/bgc/relay.php" && A.cleanRelayUrl("https://example.org/x/relay.php?a=1") === "https://example.org/x/relay.php"
  && A.cleanRelayUrl("") === "" && (() => { try { A.cleanRelayUrl("http://example.org/relay.php"); return false; } catch (e) { return /https/.test(e.message); } })()
  && (() => { try { A.cleanRelayUrl("nope nope"); return false; } catch (e) { return true; } })());
const UI = require("../static/remoteaccessui.js");
check("the dropdown from the state: off / Wi-Fi / relay / Cloudflare", UI.modeOf(false, "relay") === "off" && UI.modeOf(true, "none") === "wifi" && UI.modeOf(true, "relay") === "relay" && UI.modeOf(true, "cloudflare") === "cloudflare");
check("its line: cloudflared to download / downloading / the address / the relay's refusal",
  /press Download/.test(UI.awayLine({ mode: "cloudflare", cloudflare: { installed: false } })) && /Downloading cloudflared… 50%/.test(UI.awayLine({ mode: "cloudflare", cloudflare: { job: { state: "running", got: 5, total: 10 } } }))
  && /https:\/\/a-b\.trycloudflare\.com/.test(UI.awayLine({ mode: "cloudflare", cloudflare: { installed: true, url: "https://a-b.trycloudflare.com" } }))
  && /The relay: only admins/.test(UI.awayLine({ mode: "relay", relay: { last_error: "only admins" } })) && UI.awayLine({ mode: "none" }) === "");
const html = src("static/index.html");
check("Settings ▸ General: Remote access ▾ with the 4 choices, the relay address + key, the Cloudflare box; the old checkbox kept (hidden)",
  /<select id="s_remote_mode"/.test(html) && ["off", "wifi", "relay", "cloudflare"].every((v) => html.includes('<option value="' + v + '"')) && /id="s_remote_relayurl"/.test(html)
  && /id="s_remote_relaykey" type="password"/.test(html) && /id="s_remote_cfbox"/.test(html) && /<input type="checkbox" id="s_remote_on" hidden>/.test(html) && /\/static\/remoteaccessui\.js/.test(html));
check("picking Cloudflare: a Download / Cancel box before cloudflared is fetched", /root\.confirm\("⬇ Download cloudflared/.test(src("static/remoteaccessui.js")));

// ☁ Cloudflare
const T = require("../lib/cfTunnel");
check("cloudflared for this computer: Windows exe / Mac tgz / Linux", T.assetFor("win32", "x64") === "cloudflared-windows-amd64.exe" && T.assetFor("darwin", "arm64") === "cloudflared-darwin-arm64.tgz"
  && T.assetFor("linux", "x64") === "cloudflared-linux-amd64" && T.assetFor("linux", "arm64") === "cloudflared-linux-arm64" && /^https:\/\/github\.com\/cloudflare\/cloudflared\/releases\/latest\/download\/$/.test(T.DL));
check("the quick tunnel's address read from its output", T.parseUrl("2026-11-22T03:00:00Z INF |  https://brave-red-kite-sea.trycloudflare.com                    |") === "https://brave-red-kite-sea.trycloudflare.com" && T.parseUrl("INF Starting tunnel") === "");
const ct = src("lib/cfTunnel.js");
check("cloudflared talks to a forwarder that marks everything X-Bitgen-Via: tunnel (never straight to the studio)", /h\["x-bitgen-via"\] = "tunnel"/.test(ct) && /"--url", "http:\/\/127\.0\.0\.1:" \+ pp/.test(ct) && /delete h\["x-bitgen-via"\]/.test(ct));
const G = require("../lib/remoteGuard");
const rq = (h, a) => ({ headers: h || {}, socket: { remoteAddress: a || ["127", "0", "0", "1"].join(".") } });
check("guard: a tunnelled request is NEVER this computer (its header, or Cloudflare's own headers)", !G.isLoopback(rq({ "x-bitgen-via": "tunnel" })) && !G.isLoopback(rq({ "cf-ray": "8a1" }))
  && !G.isLoopback(rq({ "cf-connecting-ip": "1.2.3.4" })) && G.isLoopback(rq({})) && G.viaOf(rq({ "cf-ray": "x" })) === "tunnel" && G.viaOf(rq({ "x-bitgen-via": "relay" })) === "relay" && G.viaOf(rq({ "x-bitgen-via": "bogus" })) === "");
const gs = src("lib/remoteGuard.js");
check("guard: through a tunnel only hello is open (no pairing / Wi-Fi asking / QR download); 6 hours after the Wi-Fi", /via && !\(req\.method === "GET" && req\.path === "\/api\/remote\/hello"\)/.test(gs) && /via === "tunnel"[\s\S]{0,300}AWAY_MS[\s\S]{0,200}away: true/.test(gs));
const rl = src("routes/lanPair.js");
check("routes: /api/remote/away + cloudflare/install are this PC's only", /\/api\/remote\/away", local/.test(rl) && /app\.post\("\/api\/remote\/away", local/.test(rl) && /cloudflare\/install", local/.test(rl));
check("the app is told the tunnel (pairing, /api/app/info) - {mode: tunnel, url}", /mode: "tunnel", url: s\.url/.test(src("lib/remoteAway.js")) && /RA\.forApp\(\)/.test(src("routes/appApi.js")) && /remoteAway"\)[^\n]*forApp|A\.forApp\(\)/.test(src("routes/remote.js")));

// the relay: its own admins, or its key
const rp = src("community/lib/relay.php"), re = src("community/relay.php");
check("relay.php: registering needs an admin of its Community server (the sign-in token) or the relay key (key.txt)", /function relay_may_register/.test(rp) && /is_admin\(\$me\)/.test(rp) && /key\.txt/.test(rp) && /hash_equals\(\$want, \$key\)/.test(rp)
  && /relay_may_register\(/.test(re) && /This relay is private/.test(rp));
const rk = src("lib/relayLink.js");
check("bitGen Studio registers with its 💬 Community sign-in + the relay key; a refusal waits 5 minutes", /require\("\.\/community"\)\.token\(\)/.test(rk) && /key: r\.key/.test(rk) && /e\.register\) next = 5 \* 60 \* 1000/.test(rk)
  && typeof require("../lib/community").token === "function" && require("../lib/secrets").PATHS.includes("remote.relay.key"));

// 🎙 the app's voice
const V = require("../lib/appVoice");
const c = (t, p) => V.classify(t, p);
check("find … / find out about … / search for … / look up … -> the web", c("find cheapest flights to china").kind === "find" && c("find cheapest flights to china").text === "cheapest flights to china"
  && c("Find out about the Galaxy Z Fold 8").text === "the Galaxy Z Fold 8" && c("search for ramen near me").kind === "find" && c("look up the weather in Perth").text === "the weather in Perth");
check("make / create a video of … -> video; a picture / photo / drawing of … -> picture; a song about … -> song",
  c("please create a video of a tiger walking in snow").kind === "video" && c("please create a video of a tiger walking in snow").text === "a tiger walking in snow"
  && c("Hey bitGen, draw a picture of a red kite").kind === "image" && c("Hey bitGen, draw a picture of a red kite").text === "a red kite"
  && c("make me a song about neon rain").kind === "song" && c("make me a song about neon rain").text === "neon rain");
check("fix this photo / colourise this old photo -> fix photo (+ colour)", c("Fix this photo").kind === "fix_photo" && !c("Fix this photo").colour && c("colourise this old photo please").colour && c("colourise this old photo please").text === "");
check("anything else -> a chat; your own phrases first", c("how are you today").kind === "chat" && c("show me cats", ["show me = picture"]).kind === "image" && c("show me cats", ["show me = picture"]).text === "cats"
  && JSON.stringify(V.parsePhrases("make it pop = fix photo\nbad line\nnews = find\nx = nonsense")) === '[{"phrase":"make it pop","kind":"fix_photo"},{"phrase":"news","kind":"find"}]');
const av = src("lib/appVoice.js"), rv = src("routes/appVoice.js");
check("find goes to the web tools (lib/llmAgent, web on) with the sources; chat keeps the conversation", /llmAgent"\)\.run\(core, [\s\S]{0,300}web: true/.test(av) && /sources/.test(av) && /hist/.test(av));
check("POST /api/app/voice: the PC's own speech to text; a test phrase only in the e2e gate; mounted in routes/index.js", /\/api\/app\/voice/.test(rv) && /asr"\)\.transcribeFile/.test(rv) && /H3_E2E === "1" && b\.test_heard/.test(rv) && /require\("\.\/appVoice"\)\.mount\(app\)/.test(src("routes/index.js")));
const app = src("mobile/www/app.js"), ahtml = src("mobile/www/index.html");
check("the app: 🎙 Talk tab, 🎙 Speak the prompt, My own phrases, 🔊 read aloud", /data-v="talk"/.test(ahtml) && /id="talkBtn"/.test(ahtml) && /id="micBtn"/.test(ahtml) && /id="phrases"/.test(ahtml) && /id="talkSpeak"/.test(ahtml)
  && /function onHeard/.test(app) && /function makeIt/.test(app) && /function fixPhoto/.test(app) && /speechSynthesis/.test(app));
check("the app: the Cloudflare tunnel when away (the PC's own address, the key header)", /function tunnel\(\)/.test(app) && /lanFetch\(path, opts, S\.relay\.url\)/.test(app) && /BG\.media\(S\.relay\.url, name, S\.key\)/.test(app));
check("the app may record (RECORD_AUDIO)", /android\.permission\.RECORD_AUDIO/.test(src("mobile/android/app/src/main/AndroidManifest.xml")));

// 2.914.1 - Tim: "add just 1 button to connect to the phone in settings-general. it incorrectly says it's connected. app should
// connect to bitgen-studio automatically when wifi is the same. Add a separate tab in settings for skills" + the Windows build log
const gr = src("mobile/android/app/build.gradle");
check("build.gradle: versionCode / versionName are assignments (\"versionCode (x).toString()\" called .toString() on the setter's null - \"Value is null\")",
  /versionCode = Integer\.parseInt\(String\.valueOf\(project\.findProperty\("bgVersionCode"\) \?: "1"\)\)/.test(gr) && /versionName = String\.valueOf\(project\.findProperty\("bgVersionName"\) \?: "1\.0"\)/.test(gr) && !/^\s*versionCode \(/m.test(gr));
check("Settings ▸ General: ONE button 📱 Connect the phone (the old two hidden, Let the app connect gone)", /<button id="s_remote_connect"/.test(html) && /id="s_remote_link" type="button" hidden/.test(html)
  && /id="s_remote_off" type="button" hidden/.test(html) && !/id="lp_window"/.test(src("static/lanpairui.js")) && /function connect\(\)/.test(src("static/lanpairui.js")));
const ru = src("static/remoteui.js");
check("the state line: connected only when heard from in the last 90 s, else paired + last seen", /idle < 90/.test(ru) && /is paired, not connected - last seen/.test(ru));
check("the app: a heartbeat every 30 s; not connected = looks again every 15 s (and on coming back, and when the PC forgot it)", /api\("\/api\/remote\/me"/.test(app) && /findT = setTimeout/.test(app) && /!S\.key && P\.LanInfo\) \{ findAndConnect\(\)/.test(app) && /if \(P\.LanInfo\) setTimeout\(findAndConnect, 500\)/.test(app));
check("Settings ▸ Skills: its own tab (moved out of General)", /<button data-stab="skills">Skills<\/button>/.test(html) && /<div class="stab" id="stab-skills">\s*<div id="s_skills"><\/div>/.test(html)
  && html.indexOf('id="s_skills"') > html.indexOf('id="stab-skills"'));

// 2.915.0 - Tim: "when the allow or deny button is pressed ... hide the notification. show it over the dialog ... after it generates show
// the picture it generated, create a side swipe gallery ... swipe up or down returns to the homepage. ... recognize when the
// conversation is ended and the app should reply to make it more fluid like an assistant"
const lpu = src("static/lanpairui.js");
check("the bar: a popover, put inside the open modal dialog, hidden at once on ✔ / ✕", /setAttribute\("popover", "manual"\)/.test(lpu) && /d\.matches\(":modal"\)/.test(lpu) && /lp_allow"\)\.onclick = function \(\) \{ hideBar\(\);/.test(lpu) && /lp_deny"\)\.onclick = function \(\) \{ hideBar\(\);/.test(lpu));
check("the viewer: swipe left / right (next / previous), up / down = back to Create; ‹ ›; the list kept", /function step\(d\)/.test(app) && /closeView\(true\)/.test(app) && /id="vPrev"/.test(ahtml) && /view\(g\.dataset\.n, names\)/.test(app));
check("after Generate: the job followed, what it made opened with that kind's Gallery", /function watchJob\(id\)/.test(app) && /if \(j\.id\) watchJob\(j\.id\)/.test(app));
check("a song: a random visualisation (5 kinds) on a canvas - the music's own levels when it can, else drawn to a beat", /\["bars", "wave", "rings", "particles", "spiral"\]/.test(app) && /createMediaElementSource/.test(app) && /crossOrigin = "anonymous"/.test(app));
check("a conversation: the end of speech heard (1.2 s quiet), nothing said = no send, it answers out loud and listens again; bye ends it", /quiet >= 1200/.test(app) && /function turn\(\)/.test(app) && /goOn === "talk"/.test(app) && /id="talkEnd"/.test(ahtml)
  && V.classify("okay goodbye").kind === "bye" && V.classify("thanks, that's all").kind === "bye" && V.classify("stop the music video").kind === "chat");
check("the phone says the answers: the TextToSpeech plugin (Android's voices), else speechSynthesis", /P\.TextToSpeech\.speak/.test(app) && !!JSON.parse(src("mobile/package.json")).dependencies["@capacitor-community/text-to-speech"]);

console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
