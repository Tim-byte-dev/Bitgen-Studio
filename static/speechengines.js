/* bitGen Studio — static/speechengines.js (2.594.0): Settings ▸ Audio's ENGINE PICKS - Ming-3.0 TTS and Bark 3.0 STT
 * (window.H3Speech).
 *
 * Tim (verbatim): "can you add https://nomorecoding.github.io/Ming-3.0-tts/ as an option for tts ... and add option to use
 * https://underdog.ai/bark as stt engine".
 *   Speech engine           OmniVoice (as before) | Ming-3.0 TTS - its panel (#s_ming: language, installed?, Install…)
 *                           shows instead of OmniVoice's; saved at once (tts.engine, tts.ming.language)
 *   Speech-to-text engine   faster-whisper | Bark 3.0 - its line (installed? / what stays on Whisper) and Install…;
 *                           saved at once (asr.engine)
 *   Install…                Settings ▸ Add-ons opens on that card and its Install starts (the add-on job + its log)
 * index.html's refreshTts / refreshAsr call paintTts(j) / paintAsr(j) with GET /api/tts / /api/asr. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var focused = function (el) { return el && document.activeElement === el; };
  function show(el, on) { if (el) el.style.display = on ? "" : "none"; }

  function paintTts(j) {
    if (!j) return;
    var sel = $("s_ttsengine"), m = j.ming || {};
    var eng = j.engine === "ming" ? "ming" : "omnivoice";
    if (sel && !focused(sel)) sel.value = eng;
    show($("s_ming"), eng === "ming");
    show($("s_omni"), eng !== "ming");
    if ($("s_minglang") && !focused($("s_minglang"))) $("s_minglang").value = m.language == null ? "English" : m.language;
    if ($("s_mingstatus")) $("s_mingstatus").textContent = m.installed ? "installed · " + (m.dir || "") : (m.note || "not installed") + " — Install Ming-3.0 TTS… (Settings ▸ Add-ons)";
    if ($("s_minginstall")) $("s_minginstall").textContent = m.installed ? "Reinstall Ming-3.0 TTS…" : "Install Ming-3.0 TTS…";
    if (eng === "ming" && $("s_ttsenginehint")) $("s_ttsenginehint").textContent = m.installed ? "ready" : "Ming-3.0 TTS is not installed";
  }
  function paintAsr(j) {
    if (!j) return;
    var sel = $("s_asrengine"), b = j.bark || {};
    var eng = j.engine === "bark" ? "bark" : "whisper";
    if (sel && !focused(sel)) sel.value = eng;
    show($("s_barkrow"), eng === "bark");
    var st = $("s_barkstatus");
    show(st, eng === "bark");
    if (st) st.textContent = (b.installed ? "Bark 3.0 installed · " + (b.dir || "") : "Bark 3.0 is not installed — Install Bark 3.0… (Settings ▸ Add-ons)")
      + ". Lyrics, captions, word times and other languages stay on faster-whisper" + (j.installed ? "." : " — install faster-whisper below for those.");
    if ($("s_barkinstall")) $("s_barkinstall").textContent = b.installed ? "Reinstall Bark 3.0…" : "Install Bark 3.0…";
  }

  /** Settings ▸ Add-ons on that card; its Install (the add-on's own confirm) */
  function installAddon(id) {
    try { if (typeof window.switchStab === "function") window.switchStab("addons"); else { var t = document.querySelector('#settings .stabs [data-stab="addons"]'); if (t) t.click(); } } catch (e) { /* fine */ }
    if (!window.H3Addons) return Promise.resolve(null);
    return Promise.resolve(window.H3Addons.refresh()).then(function () {
      var card = document.querySelector('#aoList .ao[data-addon="' + id + '"]');
      if (card) { card.scrollIntoView({ block: "center" }); card.style.outline = "2px solid var(--tiger,#f59e2c)"; setTimeout(function () { card.style.outline = ""; }, 2500); }
      return window.H3Addons.act(id, "install");
    });
  }

  function save(kind) {
    var fn = kind === "tts" ? window.saveTtsCfg : window.saveAsrCfg, re = kind === "tts" ? window.refreshTts : window.refreshAsr;
    return Promise.resolve(typeof fn === "function" ? fn() : null).then(function () { if (typeof re === "function") return re(true); });
  }
  function boot() {
    var te = $("s_ttsengine"), ae = $("s_asrengine");
    if (te && !te.dataset.h3) { te.dataset.h3 = "1"; te.disabled = false; te.addEventListener("change", function () { paintTts({ engine: te.value, ming: {} }); save("tts"); }); }
    if ($("s_minglang") && !$("s_minglang").dataset.h3) { $("s_minglang").dataset.h3 = "1"; $("s_minglang").addEventListener("change", function () { save("tts"); }); }
    if (ae && !ae.dataset.h3) { ae.dataset.h3 = "1"; ae.addEventListener("change", function () { paintAsr({ engine: ae.value, bark: {} }); save("asr"); }); }
    if ($("s_minginstall")) $("s_minginstall").onclick = function () { save("tts").then(function () { return installAddon("ming"); }); };
    if ($("s_barkinstall")) $("s_barkinstall").onclick = function () { save("asr").then(function () { return installAddon("bark"); }); };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  window.H3Speech = { paintTts: paintTts, paintAsr: paintAsr, installAddon: installAddon, boot: boot };
})();
