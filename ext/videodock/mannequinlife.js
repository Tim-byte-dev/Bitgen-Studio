/* bitGen Studio — ext/videodock/mannequinlife.js (2.929.0): ✨ MAKE LIFELIKE - the display mannequins made real on your PC.
 * Tim: "use these mannequins as included character sheet mannequins (create new ones that look similar)" -> "your mannequins
 * don't look human" -> "3D + your PC makes them real" -> "go next".
 * Beside 🧍 Mannequin… (Male / Female picked) ✨ Lifelike sends the 3D mannequin's front, side and back
 * (POST /api/charsheet/h3/mannequin-view) one at a time to an EDIT style (Qwen Image Edit, FLUX Kontext, P-H3 Edit … the
 * one Dress it uses, else the first) with a prompt that keeps the pose, the proportions and the camera and makes it a
 * photographed white-gloss fibreglass display mannequin: a smooth faceless head, sculpted body, black background. The front
 * goes into YOUR mannequins ("Lifelike male display mannequin") and opens as the start picture; the side and back stay in
 * the Gallery. (window.H3MannequinLife; prompt(sex, view) is pure - scripts/test-929.js)
 */
(function () {
  "use strict";
  var VIEWS = ["front", "side", "back"];
  var VIEW_WORDS = { front: "seen from the front", side: "seen from the side, in profile", back: "seen from behind" };
  /** the edit prompt for one view (pure) */
  function prompt(sex, view) {
    var body = sex === "female"
      ? "a slim, elegant female display mannequin with a smooth sculpted feminine figure"
      : "an athletic male display mannequin with a sculpted, clearly defined muscular body";
    return "Turn <Picture 1> into a photorealistic studio photograph of " + body + ", " + (VIEW_WORDS[view] || "") + ". "
      + "It is a glossy white fibreglass store mannequin: a smooth faceless egg-shaped head with no eyes, nose, mouth, ears or hair, "
      + "a seamless white clear-coat finish with soft studio softbox reflections, natural hands and feet. "
      + "Keep the pose, the body proportions, the arms, the camera angle and the framing exactly the same. Pure black background, "
      + "no clothes, no text, no stand.";
  }
  if (typeof document === "undefined") { if (typeof module !== "undefined" && module.exports) module.exports = { prompt: prompt, VIEWS: VIEWS }; return; }
  function $(id) { return document.getElementById(id); }
  function note(t) { var n = $("h3sPicNote"); if (n) n.textContent = t; }
  function jpost(u, b) { return fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); }); }
  function editStyle() {
    return fetch("/api/aiedit/engines").then(function (r) { return r.json(); }).then(function (j) {
      var ids = ((j && j.edit) || []).map(function (x) { return x.id; });
      var st = window.H3SheetDesign && window.H3SheetDesign.state ? window.H3SheetDesign.state() : {};
      return st.dressStyle && ids.indexOf(st.dressStyle) >= 0 ? st.dressStyle : ids[0] || "";
    });
  }
  function waitJob(id, label) {
    return new Promise(function (ok, bad) {
      var t = setInterval(function () {
        fetch("/api/jobs/" + encodeURIComponent(id)).then(function (r) { return r.json(); }).then(function (jj) {
          if (jj.status === "running" || jj.status === "queued") { note("✨ " + label + " - " + (jj.status === "queued" ? "waiting in the Queue" : "rendering" + (window.H3Steps ? window.H3Steps.tag(jj.progress) : "")) + "…"); return; }
          clearInterval(t);
          var outs = (jj.outputs && jj.outputs.length ? jj.outputs : jj.output ? [jj.output] : []).map(function (n) { return "/outputs/" + encodeURIComponent(String(n).split(/[\\/]/).pop()); });
          if (jj.status !== "done" || !outs.length) bad(new Error(jj.status === "done" ? "the picture came back empty" : "the render " + jj.status + (jj.error ? ": " + jj.error : "")));
          else ok(outs[0]);
        }).catch(function () { /* next poll */ });
      }, 1500);
    });
  }
  var busy = false;
  /** the three views, one after another -> the front into your mannequins */
  function make(sex) {
    if (busy) return Promise.resolve(null);
    if (sex !== "male" && sex !== "female") { note("pick 🧍 Male or Female first"); return Promise.resolve(null); }
    busy = true; paint();
    var out = {};
    return editStyle().then(function (style) {
      if (!style) throw new Error("✨ Lifelike needs an edit style (Qwen Image Edit, FLUX Kontext, P-H3 Edit…) - Settings ▸ Add-ons");
      var ready = window.H3PodRoute && window.H3PodRoute.ready ? Promise.resolve(window.H3PodRoute.ready("image", style)) : Promise.resolve(true);
      return ready.then(function (okc) {
        if (okc === false) throw new Error("ComfyUI is not running and could not be started - Settings ▸ ComfyUI");
        return VIEWS.reduce(function (p, view, i) {
          return p.then(function () {
            var label = view + " (" + (i + 1) + " of " + VIEWS.length + ")";
            note("✨ " + label + " - queuing…");
            return jpost("/api/charsheet/h3/mannequin-view", { sex: sex, view: view })
              .then(function (v) { return jpost("/api/genimage", { style_id: style, prompt: prompt(sex, view), images: [v.name], batch: 1 }); })
              .then(function (j) { if (!j.id) throw new Error("the picture could not be queued"); return waitJob(j.id, label); })
              .then(function (url) { out[view] = url; });
          });
        }, Promise.resolve());
      });
    }).then(function () {
      note("✨ keeping it in your mannequins…");
      return fetch(out.front).then(function (r) { return r.blob(); }).then(function (blob) {
        var fd = new FormData();
        fd.append("file", blob, "lifelike-" + sex + ".png");
        fd.append("name", "Lifelike " + sex + " display mannequin");
        return fetch("/api/charsheet/library/mannequins", { method: "POST", body: fd }).then(function (r) { return r.json(); })
          .then(function (it) { if (!it || !it.id) throw new Error("it could not be kept in your mannequins: " + ((it && it.error) || "no answer") + " (the views are in the Gallery)"); return it; });
      });
    }).then(function (it) {
      busy = false; paint();
      var D = window.H3SheetDesign, said = "✓ Lifelike " + sex + " mannequin made - in Your mannequins (the side and back are in the Gallery)";
      note(said);
      return Promise.resolve(D && D.loadLibrary ? D.loadLibrary() : null).then(function () {
        var sel = $("h3sMannequin");
        if (sel && it && it.id) { sel.value = "own:" + it.id; if (D && D.loadMannequin) return D.loadMannequin("own:" + it.id); }
      }).catch(function () { /* the start picture by hand */ }).then(function () { note(said); paint(); return { views: out, item: it }; });
    }).catch(function (e) { busy = false; paint(); note("✗ " + (e.message || e)); return null; });
  }
  function paint() {
    var b = $("h3sLife"), sel = $("h3sMannequin");
    if (!b || !sel) return;
    b.hidden = !(sel.value === "male" || sel.value === "female");
    b.disabled = busy;
    b.textContent = busy ? "✨ Making it lifelike…" : "✨ Lifelike";
  }
  function boot() {
    var sel = $("h3sMannequin");
    if (!sel) { setTimeout(boot, 1000); return; }
    if ($("h3sLife")) return;
    var b = document.createElement("button");
    b.type = "button"; b.className = "ghost gbtn"; b.id = "h3sLife"; b.hidden = true;
    b.title = "Make this display mannequin lifelike on your PC: an edit style redraws its front, side and back as a photographed glossy white store mannequin (faceless head, sculpted body) keeping the pose - the front goes into Your mannequins";
    b.textContent = "✨ Lifelike";
    sel.parentNode.insertBefore(b, sel.nextSibling);
    b.addEventListener("click", function () { make(sel.value); });
    sel.addEventListener("change", paint);
    paint();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  window.H3MannequinLife = { prompt: prompt, make: make, VIEWS: VIEWS };
})();
