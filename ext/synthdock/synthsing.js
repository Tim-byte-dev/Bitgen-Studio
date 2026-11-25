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
 * 2.967.0: ■ Stop (a running ▶ / ✂ / 🎓 - its processes ended, nothing added), Key "Auto" (Seed-VC / SoulX-Singer move the
 * song to where your clip sits), ⧉ Mix (the voice layer over its instrumental -> one file: a new layer, My samples and the
 * project's Sound assets), 🎧 (hear yourself while 🎙 recording a clip - with headphones).
 * H3SynthSing: refresh(), go(), separate(i), mix(), stop(), monitor(on), info() (tests)
 */
(function (root) {
  "use strict";
  var doc = root.document; if (!doc) return;
  var $ = function (id) { return doc.getElementById(id); };
  var LS = { get: function (k, d) { try { var v = root.localStorage.getItem("h3.synth.sing." + k); return v == null ? d : v; } catch (e) { return d; } },
             set: function (k, v) { try { root.localStorage.setItem("h3.synth.sing." + k, String(v)); } catch (e) { /* private */ } } };
  var G = { st: null, busy: null, rec: null, last: null, stopped: false, mon: false };
  var stopped = function () { var e = new Error("■ Stopped"); e.stopped = true; return e; };
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
    var k = $("sySingKey"), ao = k && k.querySelector("option[value=auto]");   // 2.967.0: RVC has no Auto key
    if (ao) { ao.disabled = model; if (model && k.value === "auto") k.value = "0"; }
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
      mr.h3stream = stream;
      var tick = root.setInterval(function () { b.textContent = "■ Stop " + mmss((Date.now() - t0) / 1000); }, 250);
      mr.ondataavailable = function (e) { if (e.data && e.data.size) parts.push(e.data); };
      mr.onstop = function () {
        root.clearInterval(tick); stream.getTracks().forEach(function (t) { t.stop(); });
        monOff(mr); G.rec = null; b.textContent = "🎙 Record"; b.classList.remove("on");
        var secs = (Date.now() - t0) / 1000; if (secs < 2) { say("🎙 Too short - record 15-30 seconds of you singing (or reading)", true); return; }
        var name = "my voice " + new Date().toISOString().slice(0, 16).replace("T", " ").replace(":", "-");
        say("🎙 Saving your voice…");
        upClips([new root.File([new root.Blob(parts, { type: mr.mimeType || "audio/webm" })], name + ".webm", { type: mr.mimeType || "audio/webm" })], name);
      };
      G.rec = mr; mr.start(250); b.classList.add("on"); monWire();
      say("🎙 Recording - sing (or read) for 15-30 seconds in your normal voice, then ■ Stop" + (G.mon ? " · 🎧 you hear yourself (headphones on, or the speakers feed back)" : ""));
    }).catch(function (e) { say("🎙 The microphone: " + (e.message || e), true); });
  }

  /** 2.967.0: 🎧 hear yourself while recording - the mic straight to the speakers (headphones: speakers feed back into it) */
  function monWire() {
    var r = G.rec; if (!r) return;
    if (G.mon && !r.h3mon) {
      try {
        var AC = root.AudioContext || root.webkitAudioContext, c = new AC({ latencyHint: "interactive" }), s = c.createMediaStreamSource(r.h3stream);
        s.connect(c.destination); r.h3mon = c; if (c.resume) c.resume();
      } catch (e) { say("🎧 " + (e.message || e), true); }
    } else if (!G.mon) monOff(r);
  }
  function monOff(r) { if (r && r.h3mon) { try { r.h3mon.close(); } catch (e) { /* closed */ } r.h3mon = null; } }
  function monitor(on) {
    G.mon = on == null ? !G.mon : !!on; LS.set("mon", G.mon ? "1" : "0");
    var b = $("sySingMon"); if (b) { b.classList.toggle("on", G.mon); b.setAttribute("aria-pressed", G.mon ? "true" : "false"); }
    monWire(); return G.mon;
  }

  /* ---------------- the jobs ---------------- */
  function follow(j, what) {
    var from = 0, t0 = Date.now(); G.jobId = j.id; G.lastLine = "";
    if (G.stopped) cancelJob(j.id);                                // ■ pressed while it was still being sent
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
          else if (r.job.state === "cancelled") reject(stopped());
          else root.setTimeout(tick, 1000);
        }).catch(function (e) { if (/no such job/.test(e.message)) reject(e); else root.setTimeout(tick, 2500); });
      })();
    });
  }
  function cancelJob(id) { return json("/api/sing/job/" + encodeURIComponent(id) + "/cancel", {}).catch(function (e) { say("■ " + e.message, true); }); }
  /** 2.967.0: ■ Stop - the running job ended on the server (its whole process tree); before a job exists it stops at the next step */
  function stop() {
    if (!G.busy || G.stopped) return Promise.resolve(false);
    G.stopped = true; say("■ Stopping…");
    var b = $("sySingStop"); if (b) b.disabled = true;
    return G.jobId && G.jobState !== "ended" ? cancelJob(G.jobId).then(function () { return true; }) : Promise.resolve(true);
  }
  /** a job that needs a part first: the Download / Cancel box, then once more */
  function startJob(url, body, why) {
    if (G.stopped) return Promise.reject(stopped());
    G.jobState = null;
    return json(url, body).catch(function (e) {
      if (!e.needs || !root.H3NeedInstall) throw e;
      return root.H3NeedInstall.ensure(e.needs, why).then(function (ok) { if (!ok) throw new Error("not installed - nothing done"); refresh(); return json(url, body); });
    });
  }
  /** layer i rendered dry -> a WAV in My samples -> its name */
  function toSample(i, tag) {
    var l = TL().tl().layers[i];
    return TL().renderDry(i).then(function (r) {
      if (G.stopped) throw stopped();
      return upWav(r, tag + " " + l.name.replace(/[^\w\- ]+/g, "").trim().slice(0, 40) + " " + stamp() + ".wav");
    });
  }
  function stamp() { return new Date().toTimeString().slice(0, 8).replace(/:/g, "-"); }
  /** a render -> a WAV in My samples -> its name there */
  function upWav(r, name) {
    var fd = new root.FormData(); fd.append("files", new root.File([root.H3SynthCore.wav(r.chans, r.sampleRate)], name, { type: "audio/wav" }), name);
    return root.fetch("/api/synth/samples", { method: "POST", body: fd }).then(function (x) { return x.json(); })
      .then(function (j) { var a = j && j.added && j.added[0]; if (!a) throw new Error((j && j.errors && j.errors[0]) || "the sound could not be saved"); return a.name; });
  }
  function lock(on, what) {
    G.busy = on ? what : null;
    if (on) G.stopped = false; else G.jobState = "ended";
    ["sySingGo", "sySingSep", "sySingTrain", "sySingEngine", "sySingMix"].forEach(function (id) { var b = $(id); if (b) b.disabled = !!on; });
    var g = $("sySingGo"); if (g) g.classList.toggle("busy", !!on);
    var s = $("sySingStop"); if (s) { s.hidden = !on; s.disabled = false; }
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
      .catch(function (e) { lock(false); if (e.stopped) say("■ Stopped - nothing split"); else say("✂ " + (e.message || e), true); return null; });
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
    var kv = $("sySingKey").value;
    var body = { engine: e.id, shift: kv === "auto" && e.ref !== "model" ? "auto" : (+kv || 0), quality: $("sySingQ").value || "good" };
    if (e.ref === "model") body.model = voice; else body.clip = voice;
    var why = "🎤 Sing it in my voice uses " + e.short + " to sing the vocal again in your voice.";
    var first = function () {                                     // not installed: ask before anything is rendered or separated
      if (e.installed) return Promise.resolve(true);
      return root.H3NeedInstall ? root.H3NeedInstall.ensure("sing_" + e.id, why) : Promise.resolve(false);
    };
    return first().then(function (ok) {
      if (!ok) { say("🎤 " + e.short + " is not installed - nothing done", true); return null; }
      var whole = l.role !== "vocals" && l.role !== "voice";
      var vocal = whole ? separate(i).then(function (r) { if (!r) throw G.stopped ? stopped() : new Error("the vocal could not be separated - see above"); return r.vocals; }) : Promise.resolve(i);
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
    }).catch(function (er) { lock(false); if (er.stopped) say("■ Stopped - nothing added"); else say("🎤 " + (er.message || er), true); return null; });
  }

  /* ---------------- ⧉ Mix: your voice over the song's instrumental -> one file ---------------- */
  /** the voice layer (the picked one, else the newest) + the instrumental ✂ made for it (the nearest one above it) */
  function mixPair() {
    var L = TL().tl().layers, i = TL().info().sel, v = -1, ins = -1, k;
    var ok = function (q, role) { return L[q] && L[q].role === role && L[q].clips.length; };
    if (ok(i, "voice")) v = i; else for (k = L.length - 1; k >= 0; k--) if (ok(k, "voice")) { v = k; break; }
    if (v < 0) return { why: "⧉ Mix needs a layer sung in your voice - pick the song and ▶ first" };
    for (k = v - 1; k >= 0 && ins < 0; k--) if (ok(k, "instrumental")) ins = k;
    for (k = v + 1; k < L.length && ins < 0; k++) if (ok(k, "instrumental")) ins = k;
    if (ins < 0) return { why: "⧉ Mix needs the song's instrumental - ✂ Separate vocals on the song first" };
    return { v: v, ins: ins };
  }
  /** 2.967.0: the two layers as you hear them (Vol, Pan, effects, lanes) -> one WAV: a new layer, My samples and the Sound
   *  assets; the two layers it came from are muted */
  function mix() {
    if (G.busy) return Promise.resolve(null);
    var t = TL(), m = mixPair();
    if (m.why) { say(m.why, true); return Promise.resolve(null); }
    try { room(1); } catch (e) { say("⧉ " + e.message, true); return Promise.resolve(null); }
    var L = t.tl().layers, song = L[m.ins].name.replace(/\s*·\s*instrumental$/, "").trim() || "song";
    var voice = ((L[m.v].name.split(" · ")[1] || "my voice").replace(/\s*\(.*$/, "").trim()) || "my voice";
    var label = song.slice(0, 16) + " · " + voice.slice(0, 10) + " (mix)", out = {};
    lock(true, "mix"); say("⧉ Mixing " + L[m.v].name + " over " + L[m.ins].name + "…");
    return t.renderMix([m.v, m.ins]).then(function (r) {
      if (G.stopped) throw stopped();
      out.render = r;
      return upWav(r, ("mix " + song.replace(/[^\w\- ]+/g, "").slice(0, 30) + " " + voice.replace(/[^\w\- ]+/g, "").slice(0, 20) + " " + stamp()).trim() + ".wav");
    }).then(function (name) {
      out.name = name;
      var fd = new root.FormData(), proj = song + " (" + voice + " mix)";
      fd.append("file", new root.File([root.H3SynthCore.wav(out.render.chans, out.render.sampleRate)], "mix.wav", { type: "audio/wav" }), "mix.wav");
      fd.append("to", "sound"); fd.append("name", proj);
      return root.fetch("/api/synth/to-project", { method: "POST", body: fd }).then(function (x) { return x.json(); })
        .then(function (j) { out.sound = j && j.ok ? j.name : null; out.soundErr = j && j.error; }, function (e) { out.soundErr = e.message; });
    }).then(function () {
      return t.addNewLayer("my:" + out.name, label, 0);
    }).then(function () {
      var ni = newest(); t.patchLayer(m.v, { mute: true }); t.patchLayer(m.ins, { mute: true }); t.select(ni);
      lock(false);
      say("⧉ Mixed: " + t.tl().layers[ni].name + (out.sound ? " - also " + out.sound + " in the Sound assets" : " (the Sound assets: " + (out.soundErr || "not added") + ")") + " · the two layers it came from are muted");
      G.last = { kind: "mix", layer: ni, from: [m.v, m.ins], name: out.name, sound: out.sound || null }; return G.last;
    }).catch(function (e) { lock(false); if (e.stopped) say("■ Stopped - nothing mixed"); else say("⧉ " + (e.message || e), true); return null; });
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
        .catch(function (e) { lock(false); if (e.stopped) say("■ Stopped - Applio keeps what it saved so far: 🎓 Train the same name again to carry on from there"); else say("🎓 " + (e.message || e), true); });
    };
  }

  /* ---------------- wiring ---------------- */
  function boot() {
    var row = $("sySing"); if (!row || row.dataset.on) return; row.dataset.on = "1";
    var hold = function (e) { e.stopPropagation(); };              // the synth's own keys (notes, Space) stay out of these boxes
    row.addEventListener("keydown", hold);
    var key = $("sySingKey"), k = "";
    k = "<option value=\"auto\" title=\"Seed-VC and SoulX-Singer move the song to where the clip of your voice sits (not RVC)\">Auto</option>";
    for (var s = -12; s <= 12; s++) k += "<option value=\"" + s + "\"" + (s === 0 ? " selected" : "") + ">" + (s > 0 ? "+" + s : s === 0 ? "±0" : s) + "</option>";
    key.innerHTML = k; key.value = LS.get("key", "0"); $("sySingQ").value = LS.get("q", "good");
    $("sySingEngine").onchange = function () { LS.set("engine", this.value); voices(); };
    $("sySingVoice").onchange = function () { LS.set(eng(engine()).ref === "model" ? "model" : "clip", this.value); };
    $("sySingVoice").addEventListener("mousedown", function () { if (!G.busy) refresh(); });
    key.onchange = function () { LS.set("key", this.value); };
    $("sySingQ").onchange = function () { LS.set("q", this.value); };
    $("sySingGo").onclick = function () { go(); };
    $("sySingSep").onclick = function () { separate(); };
    $("sySingStop").onclick = function () { stop(); };
    $("sySingMix").onclick = function () { mix(); };
    $("sySingMon").onclick = function () { monitor(); };
    monitor(LS.get("mon", "0") === "1");
    $("sySingRec").onclick = record;
    $("sySingAdd").onclick = function () { $("sySingFile").click(); };
    $("sySingFile").onchange = function () { var f = this; if (f.files.length) upClips(f.files).then(function () { f.value = ""; }); };
    $("sySingTrain").onclick = trainBox;
    refresh();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.setTimeout(boot, 1500);                                     // the docker's markup arrives with the extension
  root.H3SynthSing = { refresh: refresh, go: go, separate: separate, mix: mix, stop: stop, monitor: monitor, boot: boot, record: record, upClips: upClips,
    info: function () { return { busy: G.busy, engines: G.st ? G.st.engines.map(function (e) { return e.id + ":" + (e.installed ? 1 : 0); }) : [], engine: engine(), voice: $("sySingVoice") ? $("sySingVoice").value : "",
                                 key: $("sySingKey") ? ($("sySingKey").value === "auto" ? "auto" : +$("sySingKey").value) : 0, stopped: G.stopped, mon: G.mon,
                                 monitoring: !!(G.rec && G.rec.h3mon), monState: G.rec && G.rec.h3mon ? G.rec.h3mon.state : null, msg: $("sySingMsg") ? $("sySingMsg").textContent : "", last: G.last, recording: !!G.rec, job: G.jobId || null }; } };
})(typeof window !== "undefined" ? window : globalThis);
