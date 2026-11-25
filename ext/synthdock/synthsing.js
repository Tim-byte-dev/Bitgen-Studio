/* bitGen Studio — ext/synthdock/synthsing.js (2.965.0): 🎤 SING IT IN MY VOICE - the tool row above the Synth tab's timeline
 * (window.H3SynthSing).
 *
 * Tim (verbatim): "lets get all of them and add them to a dropdown, we will put a tool row in the synth tab of audio docker
 * above the timeline. give it a go button (green triangle inside a circle pointing right). add another button to separate the
 * vocal from the instrumental in the same toolbar, separate the layer into 2 additional layers,1 layer is the original track,
 * 1 layer is the vocal and 1 layer the instrumental . these buttons will work on the selected layer."
 *
 *   Model ▾    Seed-VC / SoulX-Singer SVC / RVC (Applio) - not installed = the Download / Cancel box on ▶ (needinstall.js)
 *   Voice ▾    your clips (Seed-VC, SoulX-Singer: one 10-30 s clip) or your trained models (RVC); 🎙 Record (the mic - sing
 *              or read for 15-30 s), 📂 a file, 🎓 Train (RVC: a model from the clips you tick - about 10 minutes is best)
 *   Key ▾      -12 .. +12 semitones (the song a little high or low for you); Quality ▾ fast / good / best
 *   ▶ (green)  the PICKED layer sung in your voice: a vocals layer is converted straight away; a whole song is ✂ separated
 *              first. The new layer "… · <voice> (Seed-VC)" goes under it from 0:00; the vocal it came from is muted.
 *   ✂ Separate vocals   the PICKED layer -> two more layers, its vocal and its instrumental (demucs); the original stays (muted -
 *              unmute it to hear the whole song again).
 * Both render the layer DRY (H3SynthTL.renderDry - its clips, fades and keyframes; no effects), put it in My samples, and the
 * server does the rest (routes/singVoice.js -> lib/singVoice.js), followed here line by line.
 * H3SynthSing: refresh(), go(), separate(i), info() (tests)
 */
(function (root) {
  "use strict";
  var doc = root.document; if (!doc) return;
  var $ = function (id) { return doc.getElementById(id); };
  var LS = { get: function (k, d) { try { var v = root.localStorage.getItem("h3.synth.sing." + k); return v == null ? d : v; } catch (e) { return d; } },
             set: function (k, v) { try { root.localStorage.setItem("h3.synth.sing." + k, String(v)); } catch (e) { /* private */ } } };
  var G = { st: null, busy: null, rec: null, last: null };
  var TL = function () { return root.H3SynthTL; };
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var mmss = function (s) { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); };
  function say(t, bad) { var m = $("sySingMsg"); if (m) { m.textContent = t || ""; m.classList.toggle("bad", !!bad); } }
  function bar(f) { var b = $("sySingBar"); if (!b) return; b.style.display = f == null ? "none" : "block"; if (f != null) b.firstChild.style.width = Math.round(Math.max(0.03, Math.min(1, f)) * 100) + "%"; }
  function json(url, body) {
    return root.fetch(url, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) { var e = new Error(j.error || "HTTP " + r.status); e.needs = j.needs; throw e; } return j; }); });
  }

  /* ---------------- the lists ---------------- */
  function engine() { var s = $("sySingEngine"); return s ? s.value : "seedvc"; }
  function eng(id) { return G.st && G.st.engines.filter(function (e) { return e.id === id; })[0]; }
  function refresh() {
    return json("/api/sing").then(function (j) { G.st = j; paint(); return j; }).catch(function (e) { say("🎤 " + e.message, true); return null; });
  }
  function paint() {
    var st = G.st; if (!st) return;
    var se = $("sySingEngine"), cur = se.value || LS.get("engine", "seedvc");
    se.innerHTML = st.engines.map(function (e) { return "<option value=\"" + e.id + "\">" + esc(e.label) + (e.installed ? "" : " - ⬇ not installed yet") + "</option>"; }).join("");
    se.value = st.engines.some(function (e) { return e.id === cur; }) ? cur : "seedvc";
    voices();
  }
  function voices() {
    var st = G.st, sv = $("sySingVoice"), e = eng(engine()); if (!st || !sv || !e) return;
    var model = e.ref === "model", want = sv.value || LS.get(model ? "model" : "clip", "");
    var list = model ? st.models.map(function (m) { return { v: m.name, t: "🎓 " + m.name + " (" + m.epochs + " epochs)" }; })
                     : st.clips.map(function (c) { return { v: c.name, t: "🎙 " + c.name.replace(/\.wav$/i, "") + (c.seconds ? " · " + mmss(c.seconds) : "") }; });
    sv.innerHTML = list.length ? list.map(function (o) { return "<option value=\"" + esc(o.v) + "\">" + esc(o.t) + "</option>"; }).join("")
      : "<option value=\"\">" + (model ? "no model of your voice yet - 🎓 Train one" : "no clip of your voice yet - 🎙 Record one") + "</option>";
    if (list.some(function (o) { return o.v === want; })) sv.value = want;
    $("sySingTrain").hidden = !model;
    $("sySingVoice").title = model ? "Your trained RVC voice models (🎓 Train makes one from your clips)" : "Your clips: the voice it sings in - 10-30 s of you singing (or talking) is plenty";
  }

  /* ---------------- 🎙 your voice: record / add ---------------- */
  function upClips(files, name) {
    var fd = new root.FormData(); Array.prototype.forEach.call(files, function (f) { fd.append("files", f, f.name); });
    if (name) fd.append("name", name);
    return root.fetch("/api/sing/clips", { method: "POST", body: fd }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.errors && j.errors.length) say("🎙 " + j.errors.join(" · "), true);
      return refresh().then(function () {
        var a = j.added && j.added[0];
        if (a && eng(engine()).ref === "clip") { $("sySingVoice").value = a.name; LS.set("clip", a.name); }
        if (a) say("🎙 " + a.name.replace(/\.wav$/i, "") + " (" + mmss(a.seconds) + ") is your voice now" + (a.seconds && a.seconds < 8 ? " - a little short: 15-30 s works better" : ""));
        return j;
      });
    });
  }
  function record() {
    if (G.rec) { G.rec.stop(); return; }
    var nav = root.navigator;
    if (!nav.mediaDevices || !nav.mediaDevices.getUserMedia || !root.MediaRecorder) { say("🎙 This window cannot record - 📂 add a recording of your voice instead", true); return; }
    nav.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }).then(function (stream) {
      var mr = new root.MediaRecorder(stream), parts = [], t0 = Date.now(), b = $("sySingRec");
      var tick = root.setInterval(function () { b.textContent = "■ Stop " + mmss((Date.now() - t0) / 1000); }, 250);
      mr.ondataavailable = function (e) { if (e.data && e.data.size) parts.push(e.data); };
      mr.onstop = function () {
        root.clearInterval(tick); stream.getTracks().forEach(function (t) { t.stop(); });
        G.rec = null; b.textContent = "🎙 Record"; b.classList.remove("on");
        var secs = (Date.now() - t0) / 1000; if (secs < 2) { say("🎙 Too short - record 15-30 seconds of you singing (or reading)", true); return; }
        var name = "my voice " + new Date().toISOString().slice(0, 16).replace("T", " ").replace(":", "-");
        say("🎙 Saving your voice…");
        upClips([new root.File([new root.Blob(parts, { type: mr.mimeType || "audio/webm" })], name + ".webm", { type: mr.mimeType || "audio/webm" })], name);
      };
      G.rec = mr; mr.start(250); b.classList.add("on");
      say("🎙 Recording - sing (or read) for 15-30 seconds in your normal voice, then ■ Stop");
    }).catch(function (e) { say("🎙 The microphone: " + (e.message || e), true); });
  }

  /* ---------------- the jobs ---------------- */
  function follow(j, what) {
    var from = 0, t0 = Date.now(); G.jobId = j.id; G.lastLine = "";
    return new Promise(function (resolve, reject) {
      (function tick() {
        json("/api/sing/job/" + encodeURIComponent(j.id) + "?from=" + from).then(function (r) {
          from = r.next; var last = (r.lines || []).filter(function (l) { return !/^\$ /.test(l); }).slice(-1)[0];
          if (last) G.lastLine = last;
          var el = Math.round((Date.now() - t0) / 1000);
          say(what + " · " + mmss(el) + (G.lastLine ? " · " + G.lastLine.slice(0, 110) : ""));
          bar(r.job.state === "running" ? Math.min(0.95, 0.05 + el / 240) : null);
          if (r.job.state === "done") resolve(r.job.result);
          else if (r.job.state === "error") reject(new Error(r.job.error || "it stopped"));
          else root.setTimeout(tick, 1000);
        }).catch(function (e) { if (/no such job/.test(e.message)) reject(e); else root.setTimeout(tick, 2500); });
      })();
    });
  }
  /** a job that needs a part first: the Download / Cancel box, then once more */
  function startJob(url, body, why) {
    return json(url, body).catch(function (e) {
      if (!e.needs || !root.H3NeedInstall) throw e;
      return root.H3NeedInstall.ensure(e.needs, why).then(function (ok) { if (!ok) throw new Error("not installed - nothing done"); refresh(); return json(url, body); });
    });
  }
  /** layer i rendered dry -> a WAV in My samples -> its name */
  function toSample(i, tag) {
    var l = TL().tl().layers[i];
    return TL().renderDry(i).then(function (r) {
      var C = root.H3SynthCore, name = tag + " " + l.name.replace(/[^\w\- ]+/g, "").trim().slice(0, 40) + " " + new Date().toTimeString().slice(0, 8).replace(/:/g, "-") + ".wav";
      var fd = new root.FormData(); fd.append("files", new root.File([C.wav(r.chans, r.sampleRate)], name, { type: "audio/wav" }), name);
      return root.fetch("/api/synth/samples", { method: "POST", body: fd }).then(function (x) { return x.json(); });
    }).then(function (j) { var a = j && j.added && j.added[0]; if (!a) throw new Error((j && j.errors && j.errors[0]) || "the layer could not be saved"); return a.name; });
  }
  function lock(on, what) {
    G.busy = on ? what : null;
    ["sySingGo", "sySingSep", "sySingTrain", "sySingEngine"].forEach(function (id) { var b = $(id); if (b) b.disabled = !!on; });
    var g = $("sySingGo"); if (g) g.classList.toggle("busy", !!on);
    if (!on) bar(null);
  }
  function selLayer() { var t = TL(); if (!t) return -1; var i = t.info().sel; return t.tl().layers[i] && t.tl().layers[i].clips.length ? i : -1; }
  function room(n) { var t = TL(), max = (root.H3SynthTLCore && root.H3SynthTLCore.MAXL) || 16; if (t.tl().layers.length + n > max) throw new Error("the timeline has " + max + " layers at most - remove one first"); }
  /** the new layer just made (addNewLayer picks it) */
  function newest() { return TL().info().sel; }

  /** ✂ Separate vocals: the picked layer -> + its vocal layer + its instrumental layer; the original kept (muted) */
  function separate(i) {
    if (G.busy) return Promise.resolve(null);
    i = i == null ? selLayer() : i;
    if (i < 0) { say("✂ Pick a layer with a song on it first (click its name)", true); return Promise.resolve(null); }
    var t = TL(), l = t.tl().layers[i], out = {};
    try { room(2); } catch (e) { say("✂ " + e.message, true); return Promise.resolve(null); }
    var SEPWHY = "✂ Separate vocals splits the song on the picked layer into its vocal and its instrumental.";
    lock(true, "separate");
    // 2.966.0: asked BEFORE anything is rendered (the Stems tab's job now) - installed = true at once, no box
    var need = root.H3NeedInstall ? root.H3NeedInstall.ensure("demucs", SEPWHY) : Promise.resolve(true);
    return need.then(function (ok) {
      if (!ok) throw new Error("Separate asks to download the song separation first - nothing split");
      say("✂ " + l.name + ": rendering the layer…");
      return toSample(i, "sep");
    })
      .then(function (sample) { return startJob("/api/sing/separate", { sample: sample }, SEPWHY); })
      .then(function (r) { return follow(r.job, "✂ Separating " + l.name); })
      .then(function (res) {
        return t.addNewLayer("my:" + res.vocals, l.name.slice(0, 22) + " · vocals", 0).then(function () { out.vocals = newest(); t.patchLayer(out.vocals, { role: "vocals" }); })
          .then(function () { return t.addNewLayer("my:" + res.instrumental, l.name.slice(0, 18) + " · instrumental", 0); })
          .then(function () { out.instrumental = newest(); t.patchLayer(out.instrumental, { role: "instrumental" }); t.patchLayer(i, { mute: true }); t.select(out.vocals); });
      })
      .then(function () { lock(false); say("✂ " + l.name + " -> its vocals and its instrumental on two new layers (the original is muted - unmute it to hear the whole song)"); G.last = { kind: "separate", from: i, vocals: out.vocals, instrumental: out.instrumental }; return out; })
      .catch(function (e) { lock(false); say("✂ " + (e.message || e), true); return null; });
  }

  /** ▶ the picked layer sung in your voice */
  function go() {
    if (G.busy) return Promise.resolve(null);
    var e = eng(engine()), i = selLayer(), t = TL();
    if (!e) { say("🎤 Pick a voice model", true); return Promise.resolve(null); }
    if (i < 0) { say("🎤 Pick the layer with the song (or its vocals) on it first - click its name", true); return Promise.resolve(null); }
    var voice = $("sySingVoice").value;
    if (!voice) { say(e.ref === "model" ? "🎓 Train a model of your voice first (🎓 Train, from clips of you)" : "🎙 Record (or 📂 add) a clip of your voice first - 15-30 seconds", true); return Promise.resolve(null); }
    var l = t.tl().layers[i];
    if (l.role === "instrumental") { say("🎤 That is the instrumental - pick the vocals layer (or the whole song)", true); return Promise.resolve(null); }
    var body = { engine: e.id, shift: +$("sySingKey").value || 0, quality: $("sySingQ").value || "good" };
    if (e.ref === "model") body.model = voice; else body.clip = voice;
    var why = "🎤 Sing it in my voice uses " + e.short + " to sing the vocal again in your voice.";
    var first = function () {                                     // not installed: ask before anything is rendered or separated
      if (e.installed) return Promise.resolve(true);
      return root.H3NeedInstall ? root.H3NeedInstall.ensure("sing_" + e.id, why) : Promise.resolve(false);
    };
    return first().then(function (ok) {
      if (!ok) { say("🎤 " + e.short + " is not installed - nothing done", true); return null; }
      var whole = l.role !== "vocals" && l.role !== "voice";
      var vocal = whole ? separate(i).then(function (r) { if (!r) throw new Error("the vocal could not be separated - see above"); return r.vocals; }) : Promise.resolve(i);
      return vocal.then(function (vi) {
        var vl = t.tl().layers[vi];
        try { room(1); } catch (er) { throw er; }
        lock(true, "convert");
        say("🎤 " + vl.name + ": rendering the vocal…");
        return toSample(vi, "dry").then(function (sample) { body.sample = sample; return startJob("/api/sing/convert", body, why); })
          .then(function (r) { return follow(r.job, "🎤 " + e.short + " is singing " + vl.name + " in your voice"); })
          .then(function (res) {
            return t.addNewLayer("my:" + res.name, vl.name.replace(/ · vocals$/, "").slice(0, 16) + " · " + String(res.voice).slice(0, 10) + " (" + e.short + ")", 0).then(function () {
              var ni = newest(); t.patchLayer(ni, { role: "voice" }); t.patchLayer(vi, { mute: true }); t.select(ni);
              lock(false); refresh();
              say("🎤 Done: " + t.tl().layers[ni].name + " - the vocal it came from is muted (unmute it to compare)" + (res.seconds ? " · " + mmss(res.seconds) : ""));
              G.last = { kind: "convert", from: vi, layer: ni, name: res.name, engine: e.id }; return G.last;
            });
          });
      });
    }).catch(function (er) { lock(false); if (/not installed - nothing done/.test(er.message)) say("🎤 " + er.message, true); else say("🎤 " + (er.message || er), true); return null; });
  }

  /* ---------------- 🎓 train an RVC model from your clips ---------------- */
  function trainBox() {
    var st = G.st, old = $("sySingTrainBox"); if (old) { old.remove(); return; }
    if (!st) return;
    var box = doc.createElement("div"); box.id = "sySingTrainBox"; box.className = "sysingbox";
    var total = 0;
    box.innerHTML = "<b>🎓 Train an RVC model of your voice</b><div class=\"hint\">Tick the clips of you (singing is best; talking works too). About 10 minutes together sounds most like you; it trains for a while (20-60 minutes on a big card).</div>" +
      (st.clips.length ? "<div class=\"clips\">" + st.clips.map(function (c) { total += c.seconds || 0; return "<label><input type=\"checkbox\" data-clip=\"" + esc(c.name) + "\" checked> " + esc(c.name.replace(/\.wav$/i, "")) + " · " + mmss(c.seconds) + "</label>"; }).join("") + "</div>" : "<div class=\"hint\">No clips yet - 🎙 Record some first.</div>") +
      "<div class=\"row\"><label>Name <input type=\"text\" id=\"sySingTName\" maxlength=\"40\" value=\"my_voice\"></label><label>Epochs <select id=\"sySingTEp\"><option>150</option><option selected>300</option><option>500</option></select></label></div>" +
      "<div class=\"row\"><span id=\"sySingTTot\" class=\"hint\"></span><button type=\"button\" class=\"sydk\" id=\"sySingTGo\">🎓 Train</button><button type=\"button\" class=\"sydk\" id=\"sySingTNo\">Cancel</button></div>";
    $("sySing").appendChild(box);
    var sum = function () { var s = 0; Array.prototype.forEach.call(box.querySelectorAll("[data-clip]:checked"), function (c) { var x = st.clips.filter(function (q) { return q.name === c.getAttribute("data-clip"); })[0]; s += (x && x.seconds) || 0; }); $("sySingTTot").textContent = mmss(s) + " of your voice" + (s < 120 ? " - more is better (10 min)" : ""); return s; };
    box.addEventListener("change", sum); sum();
    box.addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Escape") box.remove(); });
    $("sySingTNo").onclick = function () { box.remove(); };
    $("sySingTGo").onclick = function () {
      var clips = Array.prototype.map.call(box.querySelectorAll("[data-clip]:checked"), function (c) { return c.getAttribute("data-clip"); });
      var body = { name: $("sySingTName").value.trim(), clips: clips, epochs: +$("sySingTEp").value };
      box.remove(); lock(true, "train");
      startJob("/api/sing/train", body, "🎓 Training a model of your voice needs RVC (Applio).")
        .then(function (r) { return follow(r.job, "🎓 Training " + body.name); })
        .then(function (res) { lock(false); return refresh().then(function () { $("sySingVoice").value = res.model; LS.set("model", res.model); say("🎓 " + res.model + " is ready (" + res.epochs + " epochs) - pick a layer and ▶"); }); })
        .catch(function (e) { lock(false); say("🎓 " + (e.message || e), true); });
    };
  }

  /* ---------------- wiring ---------------- */
  function boot() {
    var row = $("sySing"); if (!row || row.dataset.on) return; row.dataset.on = "1";
    var stop = function (e) { e.stopPropagation(); };              // the synth's own keys (notes, Space) stay out of these boxes
    row.addEventListener("keydown", stop);
    var key = $("sySingKey"), k = "";
    for (var s = -12; s <= 12; s++) k += "<option value=\"" + s + "\"" + (s === 0 ? " selected" : "") + ">" + (s > 0 ? "+" + s : s === 0 ? "±0" : s) + "</option>";
    key.innerHTML = k; key.value = LS.get("key", "0"); $("sySingQ").value = LS.get("q", "good");
    $("sySingEngine").onchange = function () { LS.set("engine", this.value); voices(); };
    $("sySingVoice").onchange = function () { LS.set(eng(engine()).ref === "model" ? "model" : "clip", this.value); };
    $("sySingVoice").addEventListener("mousedown", function () { if (!G.busy) refresh(); });
    key.onchange = function () { LS.set("key", this.value); };
    $("sySingQ").onchange = function () { LS.set("q", this.value); };
    $("sySingGo").onclick = function () { go(); };
    $("sySingSep").onclick = function () { separate(); };
    $("sySingRec").onclick = record;
    $("sySingAdd").onclick = function () { $("sySingFile").click(); };
    $("sySingFile").onchange = function () { var f = this; if (f.files.length) upClips(f.files).then(function () { f.value = ""; }); };
    $("sySingTrain").onclick = trainBox;
    refresh();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.setTimeout(boot, 1500);                                     // the docker's markup arrives with the extension
  root.H3SynthSing = { refresh: refresh, go: go, separate: separate, boot: boot, record: record, upClips: upClips,
    info: function () { return { busy: G.busy, engines: G.st ? G.st.engines.map(function (e) { return e.id + ":" + (e.installed ? 1 : 0); }) : [], engine: engine(), voice: $("sySingVoice") ? $("sySingVoice").value : "",
                                 key: $("sySingKey") ? +$("sySingKey").value : 0, msg: $("sySingMsg") ? $("sySingMsg").textContent : "", last: G.last, recording: !!G.rec, job: G.jobId || null }; } };
})(typeof window !== "undefined" ? window : globalThis);
