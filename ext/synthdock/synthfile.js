/* bitGen Studio — ext/synthdock/synthfile.js (2.956.0): 🎹 THE SYNTH TAB's .sfx FILES - their shape and their dialogs
 * (window.H3SynthFile). The files live in the project (lib/synthFiles.js, routes/synth.js /api/synth/files).
 *   kinds    "tl"   the timeline - <your name>.sfx: the whole tab (the timeline, the loop, the patch, the pads, the sheet)
 *            "loop" a looper take - _loop_<random name>.sfx: the loop as it was + its sound (a WAV in 📂 My samples)
 *            "key"  a keyboard take - _key_<random name>.sfx: the sheet music, the patch + its sound
 *   pure     randomName(prefix, rnd) ("_loop_amber-fox-42"), pack(kind, parts), check(j) -> kind | null, KIND_NAME
 *   dialogs  nameDialog({title, value, note}) -> Promise<name | null>; confirm({title, text, yes}) -> Promise<bool>;
 *            loadDialog(files, {kind}) -> Promise<name | null> (every kind listed - any file loads anywhere; the tabs filter)
 */
(function (root) {
  "use strict";
  var ADJ = ["amber", "blue", "bright", "calm", "copper", "crisp", "dusty", "electric", "golden", "hollow", "jade", "lunar", "misty", "neon", "quiet", "rapid", "silver", "solar", "velvet", "wild"];
  var NOUN = ["bass", "beat", "comet", "drum", "echo", "fox", "groove", "harbor", "lantern", "meadow", "moon", "orbit", "pulse", "river", "signal", "spark", "storm", "tide", "wave", "wolf"];
  var KIND_NAME = { tl: "🎞 Timeline", loop: "🥁 Loop take", key: "🎹 Keyboard take" };
  function randomName(prefix, rnd) {
    rnd = rnd || Math.random;
    return (prefix || "") + ADJ[Math.floor(rnd() * ADJ.length)] + "-" + NOUN[Math.floor(rnd() * NOUN.length)] + "-" + (10 + Math.floor(rnd() * 90));
  }
  function pack(kind, parts) { var o = { format: "bitgen-synth", v: 1, kind: kind }; Object.keys(parts || {}).forEach(function (k) { if (parts[k] !== undefined) o[k] = parts[k]; }); return o; }
  function check(j) { return j && j.format === "bitgen-synth" && (j.kind === "tl" || j.kind === "loop" || j.kind === "key") ? j.kind : null; }
  var pure = { randomName: randomName, pack: pack, check: check, KIND_NAME: KIND_NAME, ADJ: ADJ, NOUN: NOUN };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var doc = root.document;
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  /** a modal box over the Synth tab (it works when the tab fills the window too); Esc / ✕ = cancel */
  function modal(html, wire) {
    return new Promise(function (done) {
      var old = doc.getElementById("syDlg"); if (old) old.remove();
      var back = doc.createElement("div"); back.id = "syDlg"; back.className = "sydlgback";
      back.innerHTML = '<div class="sydlg" role="dialog" aria-modal="true">' + html + "</div>";
      var host = doc.getElementById("synthdock") || doc.body; host.appendChild(back);
      var box = back.firstChild, finish = function (v) { back.remove(); done(v); };
      box.addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Escape") finish(null); });
      back.addEventListener("pointerdown", function (e) { if (e.target === back) finish(null); });
      wire(box, finish);
    });
  }
  function nameDialog(o) {
    o = o || {};
    return modal('<h3>' + esc(o.title || "Name") + '</h3><input id="syDlgName" maxlength="80" spellcheck="false" placeholder="a name">'
      + (o.note ? '<p class="note">' + esc(o.note) + "</p>" : "") + '<p class="bad" id="syDlgBad"></p>'
      + '<div class="row"><button type="button" class="sydk" data-ok>💾 Save</button><button type="button" class="sydk" data-no>Cancel</button></div>', function (box, finish) {
      var inp = box.querySelector("input"); inp.value = (o.value || "").replace(/\.sfx$/i, ""); inp.focus(); inp.select();
      var go = function () {
        var v = inp.value.replace(/[^\w\- .()]+/g, "").trim();
        if (!v) { box.querySelector("#syDlgBad").textContent = "Give it a name (letters, numbers, spaces, - _ . ( ))"; return; }
        finish(v + ".sfx");
      };
      box.querySelector("[data-ok]").onclick = go; box.querySelector("[data-no]").onclick = function () { finish(null); };
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
    });
  }
  function confirm(o) {
    return modal('<h3>' + esc(o.title || "Sure?") + '</h3><p>' + esc(o.text || "") + '</p><div class="row"><button type="button" class="sydk" data-ok>' + esc(o.yes || "Yes")
      + '</button><button type="button" class="sydk" data-no>Cancel</button></div>', function (box, finish) {
      box.querySelector("[data-ok]").onclick = function () { finish(true); }; box.querySelector("[data-no]").onclick = function () { finish(false); };
      box.querySelector("[data-ok]").focus();
    }).then(function (v) { return !!v; });
  }
  function loadDialog(files, o) {
    o = o || {}; var kind = o.kind || "all";
    var when = function (t) { var d = new Date(t * 1000); return d.toLocaleDateString() + " " + d.toTimeString().slice(0, 5); };
    return modal('<h3>🗂 Load a synth file</h3><div class="tabs">' + ["all", "tl", "loop", "key"].map(function (k) { return '<button type="button" class="sydk" data-k="' + k + '">' + (k === "all" ? "All" : KIND_NAME[k]) + "</button>"; }).join("")
      + '</div><div class="list" id="syDlgList"></div><p class="note">Any file loads here: a 🎞 timeline file brings back the whole tab, a 🥁 loop take the looper (and its take), a 🎹 keyboard take the sheet music and its patch (and its take) - → 🎞 then puts a take on the timeline.</p>'
      + '<div class="row"><button type="button" class="sydk" data-no>Cancel</button></div>', function (box, finish) {
      var paint = function () {
        box.querySelectorAll("[data-k]").forEach(function (b) { b.classList.toggle("on", b.dataset.k === kind); });
        var fs = files.filter(function (f) { return kind === "all" || f.kind === kind; });
        box.querySelector("#syDlgList").innerHTML = fs.length ? fs.map(function (f) {
          return '<button type="button" class="item" data-n="' + esc(f.name) + '"><span>' + (KIND_NAME[f.kind] || "").split(" ")[0] + "</span><b>" + esc(f.name.replace(/\.sfx$/i, "")) + "</b><i>" + when(f.mtime) + "</i></button>"; }).join("")
          : '<p class="note">No ' + (kind === "all" ? "" : KIND_NAME[kind] + " ") + "files in this project yet.</p>";
      };
      box.addEventListener("click", function (e) {
        var k = e.target.closest("[data-k]"); if (k) { kind = k.dataset.k; paint(); return; }
        var it = e.target.closest("[data-n]"); if (it) finish(it.dataset.n);
      });
      box.querySelector("[data-no]").onclick = function () { finish(null); };
      paint(); var f = box.querySelector(".item") || box.querySelector("[data-no]"); f.focus();
    });
  }
  root.H3SynthFile = Object.assign({ nameDialog: nameDialog, confirm: confirm, loadDialog: loadDialog }, pure);
})(typeof window !== "undefined" ? window : globalThis);
