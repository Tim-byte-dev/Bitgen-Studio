/* bitGen Studio — ext/solidcraftdock/scgen.js (2.581.0): ✨ GENERATE - a part from a description or a picture, into
 * SolidCraft as its own editable features (window.H3SCGen).
 * Tim: "are there any models that we can use to generate sketches and models for solidcraft?" -> "yes, please build your
 * suggestion": cadrille (text / picture -> CadQuery) with the local LLM as the fallback.
 *   the panel (✨ Generate in the bar): the description, a picture (optional), the engine (Auto / cadrille / the local
 *   LLM), into a new design or the open one -> POST /api/cadgen/generate (lib/cadGen.js runs cad_worker.py), the job
 *   polled; its answer = the part's STEP + SolidCraft commands (sketch.create / sketch.line / … / solid.extrude /
 *   solid.fillet) - replayed through the command API, then checked: the volume SolidCraft measures must be the one
 *   CadQuery made (VOL_TOL). A step that cannot be rebuilt, or a rebuild that does not match = back to the checkpoint
 *   and the STEP inserted as one solid. ✎ The code: edit it and ▶ Run it again.
 * Pure (scripts/test-cadgen581.js): resolve(params, results), volumeOk(got, want), curvesOf(result). */
(function (root) {
  "use strict";
  var VOL_TOL = 0.01;
  /** a command answer -> the ids of the curves it made (pure) */
  function curvesOf(r) { return (r && ((r.created && r.created.curves) || r.curves)) || []; }
  /** {"$curves": [keys]} anywhere in a command's params -> those commands' curve ids (pure) */
  function resolve(v, results) {
    if (Array.isArray(v)) return v.map(function (x) { return resolve(x, results); });
    if (v && typeof v === "object") {
      if (Array.isArray(v.$curves)) return v.$curves.reduce(function (a, k) { return a.concat(curvesOf((results || {})[k])); }, []);
      var o = {}; Object.keys(v).forEach(function (k) { o[k] = resolve(v[k], results); }); return o;
    }
    return v;
  }
  /** SolidCraft's volume is CadQuery's (within 1 %) (pure) */
  function volumeOk(got, want) { var g = +got, w = +want; return w > 0 && g > 0 && Math.abs(g - w) / w <= VOL_TOL; }
  if (typeof module !== "undefined" && module.exports) { module.exports = { resolve: resolve, volumeOk: volumeOk, curvesOf: curvesOf, VOL_TOL: VOL_TOL }; return; }

  var doc = root.document;
  function $(id) { return doc.getElementById(id); }
  var B = function () { return root.H3SolidCraft; };
  var D = function () { return root.H3SolidCraftDock; };
  var G = { open: false, picture: null, pictureUrl: "", job: null, poll: null, status: null, last: null, busy: false };
  function msg(t, err) { var m = $("scgMsg"); if (m) { m.textContent = t || ""; m.style.color = err ? "#e5534b" : ""; } var d = $("scMsg"); if (d && t) { d.textContent = t; d.style.color = err ? "#e5534b" : ""; } }
  function jget(u) { return fetch(u).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); }); }
  function jpost(u, b) { return fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); }); }
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  function build() {
    if ($("scGenBox")) return;
    var bar = $("scBar"), body = $("scBody"); if (!bar || !body) return;
    var btn = doc.createElement("button");
    btn.className = "ghost gbtn"; btn.id = "scGen"; btn.type = "button"; btn.textContent = "✨ Generate";
    btn.title = "A part from a description or a picture - into SolidCraft as editable sketches, extrudes, holes and fillets (cadrille or the local LLM writes it; Settings ▸ Add-ons ▸ CAD generate)";
    bar.insertBefore(btn, bar.firstChild);
    var box = doc.createElement("div");
    box.id = "scGenBox"; box.style.cssText = "display:none;border:1px solid var(--line,#444);border-radius:8px;padding:8px;display:none;flex-direction:column;gap:6px;font-size:11.5px";
    box.innerHTML = '<div style="display:flex;gap:8px;align-items:flex-start">'
      + '<textarea id="scgPrompt" rows="3" style="flex:1;min-width:200px;resize:vertical" placeholder="Describe the part - e.g. a 60 x 40 x 6 mm mounting plate with four 4.5 mm holes 8 mm from the edges, rounded corners and a 20 mm boss in the middle" aria-label="Describe the part"></textarea>'
      + '<div id="scgPic" style="width:72px;height:72px;border:1px dashed var(--line,#555);border-radius:6px;background:#111 center/contain no-repeat;display:flex;align-items:center;justify-content:center;text-align:center;font-size:10px;color:var(--dim,#999);cursor:pointer" title="A picture of the part (optional) - click to pick one">🖼<br>picture</div>'
      + '<input type="file" id="scgPicFile" accept=".png,.jpg,.jpeg,.webp" class="hidden" style="display:none"></div>'
      + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
      + '<label style="display:inline-flex;gap:4px;align-items:center" title="Who writes the part: Auto = cadrille when it is installed, else the local LLM">Engine <select id="scgEngine" aria-label="Engine"><option value="auto">Auto</option><option value="cadrille">cadrille</option><option value="llm">the local LLM</option></select></label>'
      + '<label style="display:inline-flex;gap:4px;align-items:center" title="Off: a new design (the open one stays as it is). On: added to the open design"><input type="checkbox" id="scgInto"> into the open design</label>'
      + '<button class="ghost gbtn" id="scgPicX" type="button" style="display:none" title="No picture">✕ picture</button>'
      + '<button class="gbtn" id="scgGo" type="button">✨ Generate</button>'
      + '<span id="scgMsg" class="hint" role="status" style="flex:1;min-width:140px"></span></div>'
      + '<div id="scgState" class="hint" style="font-size:10.5px"></div>'
      + '<details id="scgCodeBox"><summary>✎ The code (CadQuery) - edit it and ▶ Run again</summary>'
      + '<textarea id="scgCode" rows="10" spellcheck="false" style="width:100%;font-family:var(--mono,monospace);font-size:11px" aria-label="The part\'s code"></textarea>'
      + '<div style="display:flex;gap:6px;align-items:center"><button class="ghost gbtn" id="scgRun" type="button" title="Run this code and put the part into SolidCraft">▶ Run again</button><span class="hint" id="scgRes"></span></div>'
      + '<pre id="scgLog" style="max-height:120px;overflow:auto;font-size:10.5px;white-space:pre-wrap;margin:4px 0 0"></pre></details>';
    body.insertBefore(box, $("scProg") || body.children[1] || null);
    btn.onclick = toggle;
    $("scgGo").onclick = function () { generate(); };
    $("scgRun").onclick = function () { runCode(); };
    $("scgPic").onclick = function () { $("scgPicFile").click(); };
    $("scgPicFile").onchange = function () { var f = this.files && this.files[0]; if (f) setPicture(f); this.value = ""; };
    $("scgPicX").onclick = function () { setPicture(null); };
    $("scgPrompt").onkeydown = function (e) { e.stopPropagation(); if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); generate(); } };
    $("scgCode").onkeydown = function (e) { e.stopPropagation(); };
    box.addEventListener("dragover", function (e) { e.preventDefault(); });
    box.addEventListener("drop", function (e) { var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f && /^image\//.test(f.type)) { e.preventDefault(); setPicture(f); } });
  }
  function toggle(force) {
    G.open = typeof force === "boolean" ? force : !G.open;
    var box = $("scGenBox"); if (box) box.style.display = G.open ? "flex" : "none";
    var b = $("scGen"); if (b) b.classList.toggle("on", G.open);
    if (G.open) { refreshStatus(); setTimeout(function () { try { $("scgPrompt").focus(); } catch (e) { /* fine */ } }, 30); }
  }
  function setPicture(f) {
    G.picture = f || null;
    if (G.pictureUrl) { try { URL.revokeObjectURL(G.pictureUrl); } catch (e) { /* fine */ } G.pictureUrl = ""; }
    var p = $("scgPic");
    if (f) { G.pictureUrl = URL.createObjectURL(f); p.style.backgroundImage = 'url("' + G.pictureUrl + '")'; p.innerHTML = ""; p.title = f.name + " - click to pick another"; }
    else { p.style.backgroundImage = ""; p.innerHTML = "🖼<br>picture"; p.title = "A picture of the part (optional) - click to pick one"; }
    $("scgPicX").style.display = f ? "" : "none";
  }
  function refreshStatus() {
    return jget("/api/cadgen/status").then(function (s) {
      G.status = s;
      var sel = $("scgEngine");
      if (sel) { var o = sel.querySelector('option[value="cadrille"]'); if (o) { o.disabled = !s.cadrille; o.textContent = "cadrille" + (s.cadrille ? "" : " (not installed)"); } }
      $("scgState").textContent = s.runner ? "Engines: " + s.note + (s.cadrille ? " · cadrille's weights are CC BY-NC 4.0 (non-commercial); a picture works best as a clean render or drawing of the part" : "") : "CAD generate is not installed - Settings ▸ Add-ons ▸ CAD generate (CadQuery runs the part's code; tick cadrille for text / picture → CAD)";
      $("scgGo").disabled = !s.runner;
      return s;
    }).catch(function (e) { $("scgState").textContent = "status: " + e.message; });
  }

  function lockUi(on) { G.busy = on; ["scgGo", "scgRun"].forEach(function (id) { var b = $(id); if (b) b.disabled = on; }); }
  function generate() {
    if (G.busy) return Promise.resolve(null);
    var prompt = $("scgPrompt").value.trim();
    if (!prompt && !G.picture) { msg("describe the part, or give a picture", true); return Promise.resolve(null); }
    lockUi(true); msg("✨ starting…");
    var up = G.picture ? fetch("/api/cadgen/picture", { method: "POST", headers: { "Content-Type": G.picture.type || "image/png" }, body: G.picture }).then(function (r) { return r.json(); }) : Promise.resolve({});
    return up.then(function (p) {
      if (p.error) throw new Error(p.error);
      return jpost("/api/cadgen/generate", { prompt: prompt, engine: $("scgEngine").value, picture: p.picture || undefined });
    }).then(follow).catch(function (e) { lockUi(false); msg("✨ " + e.message, true); return null; });
  }
  function runCode() {
    if (G.busy) return Promise.resolve(null);
    var code = $("scgCode").value;
    if (!code.trim()) { msg("no code to run", true); return Promise.resolve(null); }
    lockUi(true); msg("▶ running the code…");
    return jpost("/api/cadgen/run", { code: code, name: (G.last && G.last.name) || "part" }).then(follow).catch(function (e) { lockUi(false); msg("▶ " + e.message, true); return null; });
  }
  /** poll the job; when it is done, the part into SolidCraft */
  function follow(start) {
    G.job = start.id;
    return new Promise(function (done) {
      var tick = function () {
        jget("/api/cadgen/job?id=" + encodeURIComponent(start.id)).then(function (j) {
          $("scgLog").textContent = (j.lines || []).join("\n");
          if (j.code) { $("scgCode").value = j.code; }
          if (j.state === "running") { msg("✨ " + (j.engine === "llm" ? "the local LLM" : j.engine) + ": " + j.stage + "…"); G.poll = setTimeout(tick, 900); return; }
          G.last = j;
          if (j.state !== "done") { lockUi(false); msg("✨ " + (j.error || "it did not work"), true); $("scgCodeBox").open = !!j.code; done(j); return; }
          insert(j).then(function (r) { lockUi(false); done(Object.assign({}, j, { inserted: r })); }, function (e) { lockUi(false); msg("✨ into SolidCraft: " + e.message, true); done(j); });
        }).catch(function (e) { lockUi(false); msg("✨ " + e.message, true); done(null); });
      };
      tick();
    });
  }

  /** the commands through SolidCraft's API (stops at the first that fails) -> {ok, done, error, at} */
  function replay(exec, commands, onStep) {
    var results = {}, i = 0;
    var next = function () {
      if (i >= commands.length) return Promise.resolve({ ok: true, done: i });
      var c = commands[i];
      return exec(c.id, resolve(c.params || {}, results)).then(function (r) {
        if (c.key) results[c.key] = r;
        i++; if (onStep) onStep(i, commands.length);
        return next();
      }, function (e) { return { ok: false, done: i, at: c.id, error: String((e && e.message) || e) }; });
    };
    return next();
  }
  function totalVolume(m) { return m && m.total && m.total.volume_mm3 != null ? +m.total.volume_mm3 : (m && m.bodies ? m.bodies.reduce(function (s, b) { return s + (+b.volume_mm3 || 0); }, 0) : 0); }
  function insert(j) {
    var sc = B(); if (!sc || !sc.api()) throw new Error("SolidCraft is still starting - open the 📐 docker, then ▶ Run again");
    var r = j.result || {}, exec = sc.exec, into = $("scgInto") && $("scgInto").checked;
    var name = j.name, before = 0;
    var p = into ? Promise.resolve() : exec("file.new", { name: name }).then(function () { try { if (D() && D().state) D().state.link = null; } catch (e) { /* fine */ } });
    return p.then(function () { return exec("inspect.measure", {}).then(totalVolume, function () { return 0; }); }).then(function (v0) {
      before = v0 || 0;
      return exec("edit.checkpoint", {});
    }).then(function (cp) {
      var checkpoint = cp && cp.checkpoint;
      var asStep = function (why) {
        var back = checkpoint != null ? exec("edit.restore_checkpoint", { checkpoint: checkpoint }).catch(function () { return null; }) : Promise.resolve();
        return back.then(function () { return fetch("/api/solidcraft/file/" + encodeURIComponent(r.step)); }).then(function (res) { if (!res.ok) throw new Error("the part's STEP is not in the project"); return res.blob(); })
          .then(function (b) { return sc.insertFile(r.step, b); })      // its path, else dropped on SolidCraft (scbridge.js)
          .then(function () { msg("✨ " + name + " is in SolidCraft as one solid (" + why + ") - the STEP and the code are in the project"); $("scgRes").textContent = "one solid: " + why; return { mode: "step", why: why }; });
      };
      if (!r.editable || !(r.commands || []).length) return asStep(r.reason || "not rebuilt as features");
      msg("✨ building " + name + " in SolidCraft (" + r.features + " features)…");
      return replay(exec, r.commands, function (k, n) { msg("✨ building " + name + " in SolidCraft… " + k + " / " + n); }).then(function (rr) {
        if (!rr.ok) return asStep(rr.at + " was refused: " + rr.error);
        return exec("inspect.measure", {}).then(function (m) {
          var got = totalVolume(m) - (into ? before : 0);
          if (!volumeOk(got, r.volume)) return asStep("the rebuild measured " + Math.round(got) + " mm³, CadQuery " + Math.round(r.volume) + " mm³");
          try { exec("view.apply", { view: "iso" }).catch(function () { /* fine */ }); } catch (e) { /* fine */ }
          msg("✨ " + name + " is in SolidCraft: " + r.features + " editable features (" + Math.round(got) + " mm³) - change any sketch or extrude in its timeline");
          $("scgRes").textContent = r.features + " features, " + Math.round(got) + " mm³";
          return { mode: "features", features: r.features, volume: got };
        });
      });
    });
  }

  function boot() {
    if (!$("scBar") || !root.H3SolidCraft) return false;
    build();
    return true;
  }
  root.H3SCGen = { state: G, toggle: toggle, generate: generate, runCode: runCode, insert: insert, replay: replay, resolve: resolve, volumeOk: volumeOk, setPicture: setPicture, refreshStatus: refreshStatus };
  if (!boot()) { var n = 0, t = setInterval(function () { if (boot() || ++n > 120) clearInterval(t); }, 500); }
})(typeof window !== "undefined" ? window : globalThis);
