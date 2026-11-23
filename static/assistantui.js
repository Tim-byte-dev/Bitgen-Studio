/* bitGen Studio — static/assistantui.js (2.927.0): Settings ▸ General ▸ 🗣 THE ASSISTANT'S NAME (window.H3AssistantUi).
 * Tim: "when the app is running it is listening for keywords like Hi Gemma. the desktop app can give it a name in general
 * settings". The name the 📱 app wakes on ("Hi Gemma") and answers to (lib/wakeWord.js, /api/app/assistant), under the
 * 📱 The bitGen App box. Saved as you type (a moment after); the app reads it the next time it connects. */
(function (root) {
  "use strict";
  var doc = root.document;
  function $(id) { return doc.getElementById(id); }
  function post(b) { return fetch("/api/app/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(function (r) { return r.json(); }); }
  function paint(s) {
    if (!s || !$("asName")) return;
    if (doc.activeElement !== $("asName")) $("asName").value = s.name;
    $("asWake").checked = !!s.wake;
    $("asSay").textContent = "\"Hi " + s.name + "\"";
  }
  var t = null;
  function boot() {
    var after = $("apk_box") || $("s_remote_alts");
    if (!after) { setTimeout(boot, 800); return; }
    if ($("as_box")) return;
    var d = doc.createElement("div"); d.id = "as_box";
    d.style.cssText = "border-top:1px solid var(--line,#3a352e);margin-top:8px;padding-top:6px";
    d.innerHTML = '<div class="kv"><b>🗣 The assistant</b> - the 📱 app\'s name for itself</div>'
      + '<label class="kv" style="display:flex;gap:6px;align-items:center">Name <input id="asName" type="text" maxlength="30" style="width:12em" title="What you call it - the app wakes on &quot;Hi &lt;name&gt;&quot; and answers as it"></label>'
      + '<label class="kv" style="display:flex;gap:6px;align-items:center;cursor:pointer" title="While the bitGen app is open on the phone it listens for its name: each short burst of speech goes to this PC\'s speech to text (on your Wi-Fi or the Cloudflare tunnel - never through the relay); nothing is kept. Off: tap 🎙 Talk.">'
      + '<input type="checkbox" id="asWake"> The app listens for <b id="asSay">"Hi Gemma"</b> while it is open, then talks with you</label>'
      + '<div class="kv" id="asMsg" style="opacity:.75">Say "Hi …, what\'s the time in Sydney?" and the question is answered straight away.</div>';
    after.parentNode.insertBefore(d, after.nextSibling);
    $("asName").oninput = function () {
      var v = this.value; clearTimeout(t);
      t = setTimeout(function () { if (v.trim()) post({ name: v }).then(paint).catch(function () {}); }, 600);
    };
    $("asWake").onchange = function () { post({ wake: this.checked }).then(paint).catch(function () {}); };
    fetch("/api/app/assistant").then(function (r) { return r.json(); }).then(paint).catch(function () {});
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3AssistantUi = { paint: paint };
})(typeof window !== "undefined" ? window : globalThis);
