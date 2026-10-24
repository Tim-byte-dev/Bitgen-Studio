/* bitGen Studio — static/refmodmgr.js (2.588.0): 🧬 REFMODS in the 🎓 LoRA & fine-tune trainer docker (window.H3RefMods).
 * Tim (verbatim): "in the lora docker add an option for refmod - create remod\refmod name folder in root so all projects
 * can use it . store datasets and safetensors here. allow user to upload media and sort it into the appropriate
 * folder.use vision model for autocaption if user clicks autocaption button. allow user to choose refmod as character
 * reference or location or vehicle or object or prop or flora or animal."
 *   the docker's top: 🎓 Training | 🧬 RefMods - the RefMods side:
 *   RefMod ▾ / ＋ New / 🗑     every RefMod in <app>/refmod/<name>/ (outside the projects - every project uses them)
 *   Type                       🧑 Character reference · 🏞 Location · 🚗 Vehicle · 📦 Object · 🪄 Prop · 🌿 Flora · 🐾 Animal
 *   ＋ Media… / drop files     pictures -> images/, videos -> videos/, sounds -> audio/ (a picture.txt next to a picture is
 *                              its caption); each with its caption box (saved as you leave it) and ✕
 *   ✨ Autocaption             the vision model writes the empty captions (✨ all = every one again); a video's caption is
 *                              written from one of its frames; sounds keep the caption you type
 *   🧬 Extract RefMod          a queue job (ComfyUI + the ComfyUI-MiniMaxH3Mod pack): the pictures + frames of the videos
 *                              (up to 16) -> <mod>.safetensors, kept in the RefMod's folder
 *   ＠ Use in the prompt       puts @name in the prompt box - an H3 render (References / First-last frame) loads the mod
 * Pure (Node: scripts/test-refmodlib588.js): sortHint, countsText, tagFor.
 */
(function (root) {
  "use strict";
  function countsText(c) { var m = c || {}; return (m.images || 0) + " picture(s) · " + (m.videos || 0) + " video(s) · " + (m.audio || 0) + " sound(s)"; }
  function tagFor(name) { return "@" + String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }
  /** where an upload goes (the server decides - this is the hint shown before) */
  function sortHint(name, type) {
    var e = (String(name || "").match(/\.[^.]+$/) || [""])[0].toLowerCase(), t = String(type || "");
    if (/^\.(png|jpe?g|webp|bmp)$/.test(e) || (/^image\//.test(t) && !/gif/.test(t))) return "images";
    if (/^\.(mp4|mov|webm|mkv|avi|m4v|gif)$/.test(e) || /^video\//.test(t) || /gif/.test(t)) return "videos";
    if (/^\.(wav|mp3|flac|ogg|m4a|aac|opus)$/.test(e) || /^audio\//.test(t)) return "audio";
    if (e === ".txt") return "caption";
    return null;
  }
  var api = { countsText: countsText, tagFor: tagFor, sortHint: sortHint };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  var doc = root.document;
  function $(id) { return doc.getElementById(id); }
  var E = encodeURIComponent;
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  function jget(u) { return fetch(u).then(function (r) { return r.json(); }); }
  function jsend(m, u, b) { return fetch(u, { method: m, headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined }).then(function (r) { return r.json(); }); }
  var S = { types: [], items: [], cur: null, info: null, mode: "train", job: null, timer: null };
  var CSS = ".ltd .ltmode{display:flex;gap:4px;border-bottom:1px solid var(--line,#3a342a);padding-bottom:5px}.ltd .ltmode button.on{border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c)}"
    + ".ltd.rm-on>:not(.ltmode):not(#rmBody){display:none!important}#rmBody{display:none;flex-direction:column;gap:6px;flex:1;min-height:0}.ltd.rm-on #rmBody{display:flex}"
    + "#rmBody .rmscroll{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:8px}#rmBody .rmsec h5{margin:4px 0;color:var(--tiger,#f59e2c);font-size:.72rem;text-transform:uppercase;letter-spacing:.06em}"
    + "#rmBody .lim video,#rmBody .lim .rmau{width:100%;aspect-ratio:16/10;object-fit:cover;background:#111}#rmBody .lim .rmau{display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px;font-size:1.6rem}"
    + "#rmBody .lim .rmau audio{width:94%}#rmBody .lim .rmfn{font-size:.62rem;color:var(--dim,#999);padding:2px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
    + "#rmBody .rmtypes{display:flex;gap:3px;flex-wrap:wrap}#rmBody .rmtypes button.on{border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c)}#rmBody .rmdrop{border:1px dashed var(--line,#555);border-radius:7px;padding:8px;text-align:center}"
    + "#rmBody.drag .rmdrop{border-color:var(--tiger,#f59e2c);background:rgba(245,158,44,.08)}";

  function say(t, cls) { var m = $("rmMsg"); if (m) { m.textContent = t || ""; m.className = "lnote" + (cls ? " " + cls : ""); } }
  function build(body) {
    var bar = doc.createElement("div"); bar.className = "lbar ltmode";
    bar.innerHTML = '<button type="button" class="ghost on" data-ltmode="train" title="LoRAs, checkpoint fine-tunes, LLM / vision fine-tunes">🎓 Training</button>'
      + '<button type="button" class="ghost" data-ltmode="refmod" id="rmModeBtn" title="RefMods - MiniMax H3 reference mods (no training): characters, locations, vehicles, objects, props, flora, animals - kept in the app\'s refmod folder for every project">🧬 RefMods</button>';
    body.insertBefore(bar, body.firstChild);
    var rm = doc.createElement("div"); rm.id = "rmBody";
    rm.innerHTML = '<div class="lbar"><label for="rmSel">RefMod</label><select id="rmSel" aria-label="RefMod"></select><button type="button" class="ghost" id="rmNew">＋ New RefMod</button>'
      + '<button type="button" class="ghost" id="rmDel" title="Delete this RefMod - its folder (dataset + mod)">🗑</button><span class="lnote" id="rmFolder" style="margin-left:auto"></span></div>'
      + '<div class="lbar"><span class="lnote">Type</span><span class="rmtypes" id="rmTypes"></span></div>'
      + '<div class="lbar"><label for="rmDesc" class="lnote">Describe it</label><input id="rmDesc" type="text" maxlength="300" style="flex:1;min-width:200px" placeholder="what it is - goes into the mod\'s description (a red 1967 fastback, scratched paint …)"></div>'
      + '<div class="lnote" id="rmMsg" aria-live="polite"></div>'
      + '<div class="rmscroll" id="rmScroll"><div class="rmdrop"><button type="button" id="rmAdd">＋ Media…</button><input type="file" id="rmFile" accept="image/*,video/*,audio/*,.gif,.txt" multiple hidden>'
      + ' <span class="lnote">or drop pictures, videos and sounds here - each goes into its folder (images / videos / audio); a picture.txt beside a picture is its caption</span>'
      + '<div class="lbar" style="justify-content:center;margin-top:5px"><button type="button" class="ghost" id="rmCap" title="The vision model writes a caption for every picture / video without one (a video: from one of its frames)">✨ Autocaption</button>'
      + '<button type="button" class="ghost" id="rmCapAll" title="Write every caption again">✨ all</button><span class="lnote" id="rmInfo"></span></div></div>'
      + '<div class="rmsec"><h5 id="rmHimages">🖼 Images</h5><div class="lgrid" id="rmGimages"></div></div>'
      + '<div class="rmsec"><h5 id="rmHvideos">🎞 Videos</h5><div class="lgrid" id="rmGvideos"></div></div>'
      + '<div class="rmsec"><h5 id="rmHaudio">🔊 Audio</h5><div class="lgrid" id="rmGaudio"></div></div></div>'
      + '<div class="lbar" style="border-top:1px solid var(--line,#3a342a);padding-top:6px"><button type="button" id="rmExtract" title="A queue job: ComfyUI\'s RefMod node (ComfyUI-MiniMaxH3Mod) encodes the pictures + frames of the videos (up to 16) into a small .safetensors - no training">🧬 Extract RefMod</button>'
      + '<button type="button" class="ghost" id="rmUse" title="Put @name in the prompt box - a MiniMax H3 render (References / First-last frame) loads the mod">＠ Use in the prompt</button>'
      + '<span class="lnote" id="rmStat" style="flex:1"></span></div>';
    body.appendChild(rm);
    bar.addEventListener("click", function (e) { var b = e.target.closest("[data-ltmode]"); if (b) setMode(b.dataset.ltmode); });
  }
  function setMode(m) {
    S.mode = m === "refmod" ? "refmod" : "train";
    var body = $("ltBody"); if (!body) return;
    body.classList.toggle("rm-on", S.mode === "refmod");
    body.querySelectorAll("[data-ltmode]").forEach(function (b) { b.classList.toggle("on", b.dataset.ltmode === S.mode); });
    try { localStorage.setItem("h3.lt.mode", S.mode); } catch (e) { /* private */ }
    if (S.mode === "refmod") load();
  }

  function load(pick) {
    return jget("/api/refmodlib").then(function (j) {
      if (j.error) { say(j.error, "lbad"); return; }
      S.types = j.types || []; S.items = j.items || []; S.comfy = j.comfy || {};
      if (pick) S.cur = pick;
      if (!S.items.some(function (x) { return x.name === S.cur; })) S.cur = S.items.length ? S.items[0].name : null;
      paintSel();
      return S.cur ? loadOne() : paintOne(null);
    });
  }
  function loadOne() {
    return jget("/api/refmodlib/" + E(S.cur)).then(function (i) { if (i.error) { say(i.error, "lbad"); return; } S.info = i; paintOne(i); });
  }
  function paintSel() {
    var sel = $("rmSel");
    sel.innerHTML = S.items.length ? S.items.map(function (x) { var t = S.types.find(function (y) { return y.id === x.type; }) || {}; return '<option value="' + esc(x.name) + '">' + esc((t.icon || "") + " " + x.name + (x.has_mod ? " ✓" : "")) + "</option>"; }).join("") : '<option value="">- none yet: ＋ New RefMod -</option>';
    sel.value = S.cur || "";
  }
  function paintOne(i) {
    var dis = !i;
    ["rmDel", "rmDesc", "rmAdd", "rmCap", "rmCapAll", "rmExtract", "rmUse"].forEach(function (id) { $(id).disabled = dis; });
    $("rmTypes").innerHTML = S.types.map(function (t) { return '<button type="button" class="ghost' + (i && i.type === t.id ? " on" : "") + '" data-rmtype="' + esc(t.id) + '" title="' + esc(t.words) + '"' + (dis ? " disabled" : "") + ">" + esc(t.icon + " " + t.label) + "</button>"; }).join("");
    $("rmFolder").textContent = i ? i.folder.replace(/\\/g, "/") + "/ · " + i.tag : "<app>/refmod/<name>/ - every project uses it";
    $("rmDesc").value = i ? i.description || "" : "";
    ["images", "videos", "audio"].forEach(function (k) {
      var list = i ? i.media[k] : [];
      $("rmH" + k).textContent = { images: "🖼 Images", videos: "🎞 Videos", audio: "🔊 Audio" }[k] + " (" + list.length + ")";
      $("rmG" + k).innerHTML = list.length ? list.map(function (x) {
        var url = "/api/refmodlib/" + E(i.name) + "/file/" + k + "/" + E(x.file);
        var media = k === "images" ? '<img src="' + url + '" alt="" loading="lazy">' : k === "videos" ? (/\.gif$/i.test(x.file) ? '<img src="' + url + '" alt="">' : '<video src="' + url + '#t=0.5" preload="metadata" muted controls></video>') : '<div class="rmau">🔊<audio src="' + url + '" preload="none" controls></audio></div>';
        return '<div class="lim" data-kind="' + k + '" data-file="' + esc(x.file) + '">' + media + '<button type="button" class="ghost lx" data-rmx title="Remove it">✕</button>'
          + '<div class="rmfn">' + esc(x.file) + "</div>"
          + '<textarea data-rmcap placeholder="' + (k === "audio" ? "what it is (the vision model cannot hear - type it)" : "caption - what is in it") + '">' + esc(x.caption) + "</textarea></div>";
      }).join("") : '<div class="lnote">' + (k === "images" ? "No pictures yet - 4 to 16 clear, varied pictures (angles, light) make a good mod." : k === "videos" ? "No videos - a video gives frames to the mod (spread over its length)." : "No sounds - kept with the dataset (the RefMod node takes pictures).") + "</div>";
    });
    $("rmInfo").textContent = i ? countsText(i.counts) + (i.uncaptioned ? " · " + i.uncaptioned + " without a caption" : " · all captioned") : "";
    $("rmStat").textContent = i ? (i.has_mod ? "✓ " + i.mod + ".safetensors (" + Math.round(i.mod_size / 1024) + " KB) in its folder - " + i.tag + " in a prompt uses it" : "no mod yet - 🧬 Extract it (ComfyUI + ComfyUI-MiniMaxH3Mod)") : "";
  }

  function upload(files) {
    if (!S.cur || !files || !files.length) return;
    var fd = new FormData(), n = 0;
    [].slice.call(files).forEach(function (f) { if (sortHint(f.name, f.type)) { fd.append("files", f, f.name); n++; } });
    if (!n) { say("none of those are pictures, videos or sounds", "lbad"); return; }
    say("uploading " + n + " file(s)…");
    fetch("/api/refmodlib/" + E(S.cur) + "/upload", { method: "POST", body: fd }).then(function (r) { return r.json(); }).then(function (r) {
      if (r.error) { say(r.error, "lbad"); return; }
      var by = { images: 0, videos: 0, audio: 0 }; r.added.forEach(function (a) { by[a.kind]++; });
      say("＋ sorted: " + by.images + " → images, " + by.videos + " → videos, " + by.audio + " → audio" + (r.captioned ? " · " + r.captioned + " caption(s) from .txt" : "") + (r.refused.length ? " · not media: " + r.refused.join(", ") : ""), r.refused.length ? "lwarn" : "lok");
      S.info = r.info; paintOne(r.info); load(S.cur);
    });
  }
  function autoCap(all) {
    if (!S.cur) return;
    jsend("POST", "/api/refmodlib/" + E(S.cur) + "/autocaption", { overwrite: !!all }).then(function (r) {
      if (r.error) { say(r.error, "lbad"); return; }
      if (!r.total) { say(r.skipped ? "nothing for the vision model - the sounds need a typed caption" : "every picture and video has a caption (✨ all writes them again)", "lok"); return; }
      (function poll() {
        jget("/api/refmodlib/captioning").then(function (c) {
          say("✨ captioning " + c.done + " / " + c.total + (c.error ? " · " + c.error : ""), c.error ? "lwarn" : "");
          if (c.busy) setTimeout(poll, 1500); else { say("✨ captions written (" + c.done + ")" + (c.skipped ? " - " + c.skipped + " sound(s): type theirs" : "") + (c.error ? " - " + c.error : ""), c.error ? "lwarn" : "lok"); loadOne(); }
        });
      })();
    });
  }
  function extract() {
    if (!S.cur) return;
    var name = S.cur;
    jsend("POST", "/api/refmodlib/" + E(name) + "/extract").then(function (r) {
      if (r.error) { say(r.error, "lbad"); return; }
      S.job = r.job;
      $("rmStat").textContent = "🧬 extracting " + r.mod + " from " + r.pictures + " picture(s)…" + (r.notes && r.notes.length ? " (" + r.notes.join(" · ") + ")" : "");
      if (typeof root.refreshJobs === "function") root.refreshJobs();
      (function follow() {
        jget("/api/jobs/" + E(r.job)).then(function (j) {
          if (j.status === "queued" || j.status === "running") { $("rmStat").textContent = "🧬 " + j.status + (root.H3Steps && j.progress ? " " + root.H3Steps.text(j.progress) : "") + "…"; S.timer = setTimeout(follow, 2500); return; }
          if (j.status !== "done") { $("rmStat").textContent = "✗ the extraction " + (j.status || "stopped") + " - see the job log (the queue)"; return; }
          jsend("POST", "/api/refmodlib/" + E(name) + "/adopt").then(function (a) {
            if (a.error) { $("rmStat").textContent = "✗ " + a.error; return; }
            say("✓ " + a.file + " (" + Math.round(a.size / 1024) + " KB) - " + tagFor(name) + " in a prompt uses it", "lok");
            $("rmStat").textContent = "✓ " + a.mod + ".safetensors (" + Math.round(a.size / 1024) + " KB) in its folder - " + tagFor(name) + " in a prompt uses it";
            load(name);
          });
        });
      })();
    });
  }
  function useInPrompt() {
    if (!S.info) return;
    var p = $("prompt"), tag = S.info.tag;
    if (!p) { say("the prompt box is not open - type " + tag + " in your prompt", "lwarn"); return; }
    if (p.value.indexOf(tag) < 0) { p.value = (p.value.trim() ? p.value.replace(/\s+$/, "") + " " : "") + tag; p.dispatchEvent(new Event("input", { bubbles: true })); }
    say(tag + " is in the prompt - a MiniMax H3 render (References / First-last frame) loads " + S.info.mod + (S.info.has_mod ? "" : " (🧬 Extract it first)"), S.info.has_mod ? "lok" : "lwarn");
  }

  function wire() {
    $("rmSel").onchange = function (e) { S.cur = e.target.value || null; loadOne(); };
    $("rmNew").onclick = function () {
      var ask = root.H3Panels && H3Panels.ask ? H3Panels.ask("New RefMod", "A name for it (it becomes @name in prompts) - then pick its type and add media:", "my_refmod") : Promise.resolve(root.prompt ? root.prompt("A name:", "my_refmod") : "");
      Promise.resolve(ask).then(function (n) {
        if (!n) return;
        var t = (S.info && S.info.type) || "character";
        jsend("POST", "/api/refmodlib", { name: n, type: t }).then(function (r) { if (r.error) { say(r.error, "lbad"); return; } say("＋ " + r.name + " - pick its type, then ＋ Media…", "lok"); load(r.name); });
      });
    };
    $("rmDel").onclick = function () {
      if (!S.cur) return;
      var c = root.appConfirm ? root.appConfirm("Delete the RefMod " + S.cur + " - its folder, dataset and mod?") : Promise.resolve(root.confirm("Delete " + S.cur + "?"));
      Promise.resolve(c).then(function (ok) { if (ok) jsend("DELETE", "/api/refmodlib/" + E(S.cur)).then(function (r) { say(r.error || "🗑 " + r.removed + " deleted", r.error ? "lbad" : ""); S.cur = null; load(); }); });
    };
    $("rmTypes").onclick = function (e) {
      var b = e.target.closest("[data-rmtype]"); if (!b || !S.cur) return;
      jsend("PATCH", "/api/refmodlib/" + E(S.cur), { type: b.dataset.rmtype }).then(function (r) { if (r.error) say(r.error, "lbad"); else { S.info = r; paintOne(r); load(S.cur); } });
    };
    $("rmDesc").onchange = function (e) { if (S.cur) jsend("PATCH", "/api/refmodlib/" + E(S.cur), { description: e.target.value }).then(function (r) { if (r.error) say(r.error, "lbad"); }); };
    $("rmDesc").addEventListener("keydown", function (e) { e.stopPropagation(); });
    $("rmAdd").onclick = function () { if (S.cur) $("rmFile").click(); };
    $("rmFile").onchange = function (e) { upload(e.target.files); e.target.value = ""; };
    $("rmCap").onclick = function () { autoCap(false); };
    $("rmCapAll").onclick = function () { autoCap(true); };
    $("rmExtract").onclick = extract;
    $("rmUse").onclick = useInPrompt;
    var sc = $("rmScroll"), rb = $("rmBody");
    sc.addEventListener("change", function (e) {
      if (!e.target.hasAttribute("data-rmcap")) return;
      var box = e.target.closest(".lim");
      jsend("POST", "/api/refmodlib/" + E(S.cur) + "/caption", { kind: box.dataset.kind, file: box.dataset.file, caption: e.target.value }).then(function (r) { if (r.error) say(r.error, "lbad"); });
    });
    sc.addEventListener("keydown", function (e) { e.stopPropagation(); });
    sc.addEventListener("click", function (e) {
      if (!e.target.hasAttribute("data-rmx")) return;
      var box = e.target.closest(".lim");
      jsend("DELETE", "/api/refmodlib/" + E(S.cur) + "/file/" + box.dataset.kind + "/" + E(box.dataset.file)).then(function () { loadOne(); });
    });
    rb.addEventListener("dragover", function (e) { if (S.cur && e.dataTransfer && [].slice.call(e.dataTransfer.types || []).indexOf("Files") >= 0) { e.preventDefault(); rb.classList.add("drag"); } });
    rb.addEventListener("dragleave", function (e) { if (e.target === rb) rb.classList.remove("drag"); });
    rb.addEventListener("drop", function (e) { rb.classList.remove("drag"); if (!S.cur || !e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); upload(e.dataTransfer.files); });
  }
  function start() {
    var body = $("ltBody");
    if (!body) { setTimeout(start, 200); return; }
    if ($("rmBody")) return;
    if (!$("rmCss")) { var st = doc.createElement("style"); st.id = "rmCss"; st.textContent = CSS; doc.head.appendChild(st); }
    build(body); wire();
    var m = "train"; try { m = localStorage.getItem("h3.lt.mode") || "train"; } catch (e) { m = "train"; }
    if (m === "refmod") setMode("refmod");
  }
  root.H3RefMods = Object.assign({ load: load, setMode: setMode, state: function () { return S; }, upload: upload, extract: extract }, api);
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
