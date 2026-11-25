/* bitGen Studio — ext/synthdock/synthknob.js (2.953.0): 🎹 THE SYNTH STATION's KNOBS and SWITCHES (window.H3SynthKnob).
 * A knob: a dark dial with a glowing ring in its panel's colour - drag up / down (Shift = fine), the mouse wheel, the arrow
 * keys (PgUp / PgDn bigger steps, Home / End), double-click = back to the default. role="slider" with its value in words.
 * A switch (a choice - a wave, the filter type): a lit pill; click = the next, right-click = the one before.
 *   knob({label, color, get() -> 0..1, set(n), text() -> words, def (0..1), steps (0 = smooth, n = n positions), bipolar, size})
 *   pick({label, color, values, get() -> value, set(value)})
 *   -> {el, draw()}
 */
(function (root) {
  "use strict";
  var doc = root.document;
  var A0 = Math.PI * 0.75, SWEEP = Math.PI * 1.5;
  function knob(o) {
    var size = o.size || 42, el = doc.createElement("div"), cv = doc.createElement("canvas"), lab = doc.createElement("div"), val = doc.createElement("div");
    el.className = "sykn"; el.tabIndex = 0; el.setAttribute("role", "slider"); el.setAttribute("aria-label", o.label);
    el.setAttribute("aria-valuemin", "0"); el.setAttribute("aria-valuemax", "100");
    el.title = o.label + " - drag up / down (Shift = fine), the wheel or the arrow keys; double-click = the default";
    var dpr = Math.min(3, root.devicePixelRatio || 1);
    cv.width = size * dpr; cv.height = size * dpr; cv.style.width = size + "px"; cv.style.height = size + "px";
    lab.className = "sykl"; lab.textContent = o.label; val.className = "sykv";
    el.appendChild(cv); el.appendChild(lab); el.appendChild(val);
    var steps = o.steps || 0, col = o.color || "#38e1ff";
    function q(n) { n = n < 0 ? 0 : n > 1 ? 1 : n; return steps > 1 ? Math.round(n * (steps - 1)) / (steps - 1) : n; }
    function draw() {
      var n = o.get(), x = cv.getContext("2d"), r = size / 2, c = r;
      if (!x) return;
      x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, size, size);
      // the dial
      var gr = x.createRadialGradient(c - r * 0.25, c - r * 0.3, r * 0.1, c, c, r * 0.72);
      gr.addColorStop(0, "#3a3f4a"); gr.addColorStop(1, "#14161b");
      x.beginPath(); x.arc(c, c, r * 0.62, 0, Math.PI * 2); x.fillStyle = gr; x.fill();
      x.lineWidth = 1; x.strokeStyle = "#05060a"; x.stroke();
      // the track and the lit part
      x.lineCap = "round"; x.lineWidth = Math.max(2.5, size * 0.08);
      x.beginPath(); x.arc(c, c, r * 0.84, A0, A0 + SWEEP); x.strokeStyle = "#23262e"; x.stroke();
      var from = o.bipolar ? A0 + SWEEP / 2 : A0, to = A0 + SWEEP * n;
      if (Math.abs(to - from) > 0.01) {
        x.save(); x.shadowColor = col; x.shadowBlur = 9;
        x.beginPath(); x.arc(c, c, r * 0.84, Math.min(from, to), Math.max(from, to)); x.strokeStyle = col; x.stroke(); x.restore();
      }
      // the pointer
      x.lineWidth = Math.max(1.6, size * 0.05);
      x.beginPath(); x.moveTo(c + Math.cos(to) * r * 0.2, c + Math.sin(to) * r * 0.2); x.lineTo(c + Math.cos(to) * r * 0.55, c + Math.sin(to) * r * 0.55);
      x.strokeStyle = "#eef3ff"; x.stroke();
      var t = o.text ? o.text() : Math.round(n * 100) + "%";
      val.textContent = t; el.setAttribute("aria-valuenow", String(Math.round(n * 100))); el.setAttribute("aria-valuetext", t);
    }
    function put(n) { n = q(n); if (n !== o.get()) { o.set(n); } draw(); }
    var drag = null;
    el.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      e.preventDefault(); el.focus();
      drag = { y: e.clientY, n: o.get() }; el.classList.add("on");
      try { el.setPointerCapture(e.pointerId); } catch (er) { /* fine */ }
    });
    el.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var k = e.shiftKey ? 0.0012 : 0.006;
      put(drag.n + (drag.y - e.clientY) * k);
    });
    function up(e) { if (!drag) return; drag = null; el.classList.remove("on"); try { el.releasePointerCapture(e.pointerId); } catch (er) { /* fine */ } }
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", function (e) { e.preventDefault(); var st = steps > 1 ? 1 / (steps - 1) : (e.shiftKey ? 0.005 : 0.03); put(o.get() + (e.deltaY < 0 ? st : -st)); }, { passive: false });
    el.addEventListener("dblclick", function () { put(o.def == null ? 0.5 : o.def); });
    el.addEventListener("keydown", function (e) {
      var st = steps > 1 ? 1 / (steps - 1) : 0.01, k = e.key, n = o.get();
      if (k === "ArrowUp" || k === "ArrowRight") n += st; else if (k === "ArrowDown" || k === "ArrowLeft") n -= st;
      else if (k === "PageUp") n += Math.max(st, 0.1); else if (k === "PageDown") n -= Math.max(st, 0.1);
      else if (k === "Home") n = 0; else if (k === "End") n = 1; else return;
      e.preventDefault(); e.stopPropagation(); put(n);
    });
    draw();
    return { el: el, draw: draw };
  }
  function pick(o) {
    var el = doc.createElement("div"), b = doc.createElement("button"), lab = doc.createElement("div");
    el.className = "sykn sypick"; b.type = "button"; b.className = "sypill"; lab.className = "sykl"; lab.textContent = o.label;
    b.style.setProperty("--c", o.color || "#38e1ff");
    b.title = o.label + " - click for the next, right-click for the one before";
    el.appendChild(b); el.appendChild(lab);
    function draw() { var v = o.get(); b.textContent = String(v).replace(/^sawtooth$/, "saw").toUpperCase(); b.setAttribute("aria-label", o.label + ": " + v); }
    function step(d) { var i = o.values.indexOf(o.get()); o.set(o.values[(i + d + o.values.length) % o.values.length]); draw(); }
    b.addEventListener("click", function () { step(1); });
    b.addEventListener("contextmenu", function (e) { e.preventDefault(); step(-1); });
    draw();
    return { el: el, draw: draw };
  }
  root.H3SynthKnob = { knob: knob, pick: pick };
})(typeof window !== "undefined" ? window : globalThis);
