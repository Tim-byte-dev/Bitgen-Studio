/* graphwire.js — DRAG A LINE FROM AN INPUT TO A NODE VALUE (2.120.0).
 *
 * Tim: "create 2 lists, one with all the api inputs that can be changed and
 * the other to add input types ... then allow user to link the inputs to the
 * comfy nodes by dragging a line from the input to the node value."
 *
 * Two columns and an SVG on top of them. LEFT = the controls the user added
 * (toggle / dropdown / text / slider / spinner), each with a port on its right
 * edge. RIGHT = every changeable input of the loaded API workflow, each with a
 * port on its left edge. Press a port, drag, release on a row: that is a wire.
 * Click a wire to cut it.
 *
 * THE GEOMETRY IS A PURE FUNCTION AND IS TESTED WITHOUT A BROWSER. Everything
 * the wires' shape depends on lives in GRAPHWIRE.math — port(), path(),
 * within() — the same trick static/vr360.js uses to pin the GLSL from node.
 * The DOM half below is thin enough that if the maths is right, the picture is.
 *
 * NO MODEL LOGIC HERE. This file moves `targets` entries around inside the
 * binding object it was handed and calls back; what a control MEANS (its
 * range, its default, what value it sends) belongs to lib/comfyGraphs.js and
 * is normalized server-side on save. One control model, one file.
 *
 * Dependency-free. Attaches nothing globally except GRAPHWIRE.
 */
(function (root) {
  "use strict";

  /* ------------------------------------------------------------- geometry */
  /**
   * The centre of a port, in the wiring surface's own coordinates.
   * @param {{left:number,top:number,width:number,height:number}} r  the row's box
   * @param {{left:number,top:number}} host  the surface's box
   * @param {"left"|"right"} side  which edge the port sits on
   */
  function port(r, host, side) {
    if (!r || !host) return null;
    return {
      x: (side === "left" ? r.left : r.left + r.width) - host.left,
      y: r.top + r.height / 2 - host.top,
    };
  }

  /**
   * A cubic bezier from a to b. The handles reach HORIZONTALLY by a third of
   * the gap (min 24px) so a wire leaves a port sideways and arrives sideways,
   * which is what makes a bundle of them readable instead of a fan of chords.
   */
  function path(a, b) {
    if (!a || !b) return "";
    const dx = Math.max(24, Math.abs(b.x - a.x) / 3);
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  }

  /** Is (x,y) inside this box? Used to decide what a drop landed on. */
  function within(box, x, y) {
    return !!box && x >= box.left && x <= box.left + box.width
      && y >= box.top && y <= box.top + box.height;
  }

  /** The row a drop landed on, or null. Boxes are {key, left, top, width, height}. */
  function dropTarget(boxes, x, y) {
    for (const b of (boxes || [])) if (within(b, x, y)) return b.key;
    return null;
  }

  /** Every wire in a binding, as {control, node, input} — the draw list. */
  function wires(binding) {
    const out = [];
    for (const c of (((binding || {}).controls) || [])) {
      for (const t of (c.targets || [])) {
        if (t && t.node && t.input) out.push({ control: c.id, node: String(t.node), input: String(t.input) });
      }
    }
    return out;
  }

  /** Add a wire. Returns true when something changed (a repeat is not a change). */
  function link(binding, controlId, node, input) {
    const c = (((binding || {}).controls) || []).find((x) => x.id === controlId);
    if (!c || !node || !input) return false;
    c.targets = c.targets || [];
    if (c.targets.some((t) => String(t.node) === String(node) && String(t.input) === String(input))) return false;
    c.targets.push({ node: String(node), input: String(input) });
    return true;
  }

  /** Cut a wire. */
  function unlink(binding, controlId, node, input) {
    const c = (((binding || {}).controls) || []).find((x) => x.id === controlId);
    if (!c || !Array.isArray(c.targets)) return false;
    const before = c.targets.length;
    c.targets = c.targets.filter((t) => !(String(t.node) === String(node) && String(t.input) === String(input)));
    return c.targets.length !== before;
  }

  /** Which inputs already have a wire — the right column greys them. */
  function wiredInputs(binding) {
    return new Set(wires(binding).map((w) => w.node + "." + w.input));
  }

  /**
   * The control type a node input SUGGESTS, so "＋ from this input" makes a
   * sensible widget straight away instead of a text box the user has to fix.
   * A combo of known values is a dropdown; a boolean is a toggle; a bounded
   * number is a slider and an unbounded one a spinner (a slider from 0 to
   * 2^31 is not a control, it is a joke).
   */
  function suggest(input) {
    const i = input || {};
    const v = i.value;
    const name = String(i.input || "").toLowerCase();
    if (typeof v === "boolean") return "toggle";
    if (typeof v === "number") {
      if (name.includes("seed")) return "spinner";
      const looksBounded = name.includes("steps") || name.includes("cfg")
        || name.includes("denoise") || name.includes("strength")
        || name.includes("weight") || name.includes("scale");
      return looksBounded ? "slider" : "spinner";
    }
    if (typeof v === "string") {
      if (name.includes("text") || name.includes("prompt")) return "text";
      return v.length > 60 ? "text" : "dropdown";
    }
    return "text";
  }

  /** A starting shape for a control made from one input. */
  function controlFor(input, id) {
    const type = suggest(input);
    const c = { id, type, label: String((input || {}).input || "input"),
                targets: [{ node: String((input || {}).node), input: String((input || {}).input) }] };
    const v = (input || {}).value;
    if (type === "toggle") { c.on = true; c.off = false; c.default = !!v; }
    else if (type === "slider") {
      const n = Number(v) || 0;
      c.min = 0; c.max = n > 0 ? Math.max(1, Math.ceil(n * 2)) : 10;
      c.step = Number.isInteger(n) ? 1 : 0.05; c.default = n;
    } else if (type === "spinner") { c.min = 0; c.max = 4294967295; c.step = 1; c.default = Number(v) || 0; }
    else if (type === "dropdown") { c.options = v === undefined || v === null || v === "" ? [] : [String(v)]; c.default = String(v ?? ""); }
    else { c.default = v === undefined || v === null ? "" : String(v); }
    return c;
  }

  const math = { port, path, within, dropTarget, wires, link, unlink, wiredInputs, suggest, controlFor };

  /* ------------------------------------------------------------------ DOM */
  /**
   * Attach the wiring surface. `opts`:
   *   host      the element the SVG overlays (position:relative)
   *   binding   the binding object (mutated in place)
   *   onChange  called after any wire is added or cut
   *   rowFor(key) -> the element for a control ("c:<id>") or input ("i:<n>.<k>")
   * Returns { redraw, destroy } — or null when there is no DOM (node tests).
   */
  function attach(opts) {
    const o = opts || {};
    const host = o.host;
    if (!host || typeof document === "undefined") return null;
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "gwsvg");
    svg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible";
    host.appendChild(svg);

    let dragging = null;                       // { control, x, y } while a wire is being drawn
    const el = (key) => (o.rowFor ? o.rowFor(key) : null);
    const boxOf = (key) => { const e = el(key); return e ? e.getBoundingClientRect() : null; };

    function redraw() {
      const hb = host.getBoundingClientRect();
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      for (const w of math.wires(o.binding)) {
        const a = port(boxOf("c:" + w.control), hb, "right");
        const b = port(boxOf("i:" + w.node + "." + w.input), hb, "left");
        if (!a || !b) continue;
        const p = document.createElementNS(NS, "path");
        p.setAttribute("d", math.path(a, b));
        p.setAttribute("class", "gwwire");
        p.style.pointerEvents = "stroke";
        p.style.cursor = "pointer";
        p.addEventListener("click", () => {
          if (math.unlink(o.binding, w.control, w.node, w.input)) { redraw(); if (o.onChange) o.onChange("cut", w); }
        });
        const title = document.createElementNS(NS, "title");
        title.textContent = `${w.node}.${w.input} \u2014 click to disconnect`;
        p.appendChild(title);
        svg.appendChild(p);
      }
      if (dragging) {
        const a = port(boxOf("c:" + dragging.control), hb, "right");
        if (a) {
          const p = document.createElementNS(NS, "path");
          p.setAttribute("d", math.path(a, { x: dragging.x - hb.left, y: dragging.y - hb.top }));
          p.setAttribute("class", "gwwire gwdrag");
          svg.appendChild(p);
        }
      }
    }

    function onMove(ev) {
      if (!dragging) return;
      dragging.x = ev.clientX; dragging.y = ev.clientY;
      redraw();
    }
    function onUp(ev) {
      if (!dragging) return;
      const control = dragging.control;
      dragging = null;
      // The drop is resolved from the DOM rather than from a hover class, so a
      // release over a scrolled-out row simply misses instead of wiring the
      // wrong one.
      let hit = null;
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      for (let n = under; n && n !== host; n = n.parentElement) {
        if (n.dataset && n.dataset.gwinput) { hit = n.dataset.gwinput; break; }
      }
      redraw();
      if (!hit) return;
      const dot = hit.indexOf(".");
      const node = hit.slice(0, dot); const input = hit.slice(dot + 1);
      if (math.link(o.binding, control, node, input)) { redraw(); if (o.onChange) o.onChange("link", { control, node, input }); }
    }
    function start(controlId, ev) {
      dragging = { control: controlId, x: ev.clientX, y: ev.clientY };
      ev.preventDefault();
      redraw();
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(redraw) : null;
    if (ro) ro.observe(host);
    host.addEventListener("scroll", redraw, true);

    return {
      redraw, start,
      destroy() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        host.removeEventListener("scroll", redraw, true);
        if (ro) ro.disconnect();
        if (svg.parentNode) svg.parentNode.removeChild(svg);
      },
    };
  }

  const API = { math, attach, ...math };
  root.GRAPHWIRE = API;
  if (typeof module === "object" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
