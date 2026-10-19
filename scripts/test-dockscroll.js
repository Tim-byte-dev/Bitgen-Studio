/* Headless checks for static/dockscroll.js — the overlay slider that replaces
 * native dock scrollbars. Only the pure geometry is covered here (the module
 * loads with no DOM present, which is itself the first assertion). Run:
 *     node scripts/test-dockscroll.js
 */
const assert = require("assert");
const DS = require("../static/dockscroll.js");

let pass = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok   " + name); }
  catch (e) { console.log("  FAIL " + name + " — " + e.message); process.exitCode = 1; }
}

console.log("dockscroll geometry");

t("module loads without a DOM", () => {
  assert.strictEqual(typeof DS.geom, "function");
  assert.strictEqual(typeof DS.scrollFor, "function");
  assert.strictEqual(typeof DS.jumpTo, "function");
});

t("no slider when the content fits the frame", () => {
  const g = DS.geom({ viewport: 400, content: 400, scrollTop: 0, track: 396 });
  assert.strictEqual(g.overflow, false);
  assert.strictEqual(g.size, 0);
});

t("no slider for sub-pixel overflow (rounding slop)", () => {
  assert.strictEqual(DS.geom({ viewport: 400, content: 400.6, track: 396 }).overflow, false);
});

t("slider appears as soon as jobs pass the frame", () => {
  const g = DS.geom({ viewport: 200, content: 800, scrollTop: 0, track: 200 });
  assert.strictEqual(g.overflow, true);
  assert.strictEqual(g.size, 50);          // 200 * (200/800)
  assert.strictEqual(g.top, 0);
  assert.strictEqual(g.maxTop, 150);
});

t("handle sits at the bottom when scrolled to the end", () => {
  const g = DS.geom({ viewport: 200, content: 800, scrollTop: 600, track: 200 });
  assert.strictEqual(g.top, g.maxTop);
});

t("handle tracks a mid scroll position proportionally", () => {
  const g = DS.geom({ viewport: 200, content: 800, scrollTop: 300, track: 200 });
  assert.strictEqual(g.top, 75);           // 150 * (300/600)
});

t("handle never shrinks below the grabbable minimum", () => {
  const g = DS.geom({ viewport: 120, content: 40000, scrollTop: 0, track: 120 });
  assert.strictEqual(g.size, DS.MIN_THUMB);
  assert.ok(g.maxTop > 0, "a floored handle must still have travel");
});

t("handle can never exceed the rail it lives in", () => {
  const g = DS.geom({ viewport: 100, content: 104, scrollTop: 0, track: 30 });
  assert.ok(g.size <= 30, "size " + g.size + " overflowed a 30px rail");
});

t("scrollTop is clamped into range before positioning", () => {
  const a = DS.geom({ viewport: 200, content: 800, scrollTop: -500, track: 200 });
  const b = DS.geom({ viewport: 200, content: 800, scrollTop: 99999, track: 200 });
  assert.strictEqual(a.top, 0);
  assert.strictEqual(b.top, b.maxTop);
});

t("a zero-height frame reports no overflow instead of dividing by zero", () => {
  const g = DS.geom({ viewport: 0, content: 900, scrollTop: 0, track: 0 });
  assert.strictEqual(g.overflow, false);
  assert.ok(Number.isFinite(g.top));
});

t("dragging the handle maps back onto scrollTop", () => {
  assert.strictEqual(DS.scrollFor({ thumbTop: 0, maxTop: 150, viewport: 200, content: 800 }), 0);
  assert.strictEqual(DS.scrollFor({ thumbTop: 75, maxTop: 150, viewport: 200, content: 800 }), 300);
  assert.strictEqual(DS.scrollFor({ thumbTop: 150, maxTop: 150, viewport: 200, content: 800 }), 600);
});

t("dragging past either end clamps rather than overscrolling", () => {
  assert.strictEqual(DS.scrollFor({ thumbTop: -400, maxTop: 150, viewport: 200, content: 800 }), 0);
  assert.strictEqual(DS.scrollFor({ thumbTop: 9999, maxTop: 150, viewport: 200, content: 800 }), 600);
});

t("geom -> scrollFor round-trips", () => {
  for (const sTop of [0, 37, 199, 412, 600]) {
    const g = DS.geom({ viewport: 200, content: 800, scrollTop: sTop, track: 200 });
    const back = DS.scrollFor({ thumbTop: g.top, maxTop: g.maxTop, viewport: 200, content: 800 });
    assert.ok(Math.abs(back - sTop) <= 4, `round trip ${sTop} -> ${back}`);
  }
});

t("clicking the rail centres the handle on the pointer", () => {
  // click halfway down a 200px rail => handle centred => ~halfway scrolled
  const s = DS.jumpTo({ clickY: 100, viewport: 200, content: 800, scrollTop: 0, track: 200 });
  assert.ok(Math.abs(s - 300) <= 6, "expected ~300, got " + s);
});

t("clicking the very bottom of the rail goes to the end", () => {
  assert.strictEqual(
    DS.jumpTo({ clickY: 200, viewport: 200, content: 800, scrollTop: 0, track: 200 }), 600);
});

t("clicking a rail with nothing to scroll is a no-op", () => {
  assert.strictEqual(
    DS.jumpTo({ clickY: 50, viewport: 300, content: 300, scrollTop: 0, track: 300 }), 0);
});

t("a floored handle still reaches the last job", () => {
  // 400 queued jobs in a short frame: handle is at MIN_THUMB, but dragging it
  // to maxTop must still land on the final scroll position, not short of it.
  const g = DS.geom({ viewport: 130, content: 26000, scrollTop: 0, track: 126 });
  const end = DS.scrollFor({ thumbTop: g.maxTop, maxTop: g.maxTop, viewport: 130, content: 26000 });
  assert.strictEqual(end, 26000 - 130);
});

console.log(`dockscroll: ${pass} checks passed`);

/* ---------------------------------------------------------------------------
 * DOM plumbing. There is no browser in CI, so we stand up a shim with just
 * enough surface for attach()/render() and drive it. This catches the class of
 * bug the maths tests cannot: rail never created, rail parented to the wrong
 * element, rail left visible on a collapsed dock, drag not reaching scrollTop.
 * ------------------------------------------------------------------------ */
function fakeDom() {
  const listeners = [];
  function mk(tag) {
    const el = {
      tagName: tag, className: "", style: {}, children: [], parentNode: null,
      clientHeight: 0, clientWidth: 0, scrollHeight: 0, scrollTop: 0,
      offsetTop: 0, offsetLeft: 0, nodeType: 1, _pos: "static", _handlers: {},
      firstElementChild: null,
      appendChild(c) {
        if (c.parentNode) c.parentNode.removeChild(c);
        c.parentNode = el; el.children.push(c);
        el.firstElementChild = el.children[0]; return c;
      },
      removeChild(c) {
        el.children = el.children.filter(x => x !== c); c.parentNode = null;
        el.firstElementChild = el.children[0] || null; return c;
      },
      addEventListener(k, fn) { (el._handlers[k] = el._handlers[k] || []).push(fn); },
      fire(k, ev) { (el._handlers[k] || []).forEach(fn => fn(ev || {})); },
      getBoundingClientRect: () => ({ top: 0, left: 0 }),
      setPointerCapture() {}, releasePointerCapture() {},
      querySelectorAll: () => [],
      get parentElement() { return el.parentNode; },
      classList: {
        add(c) { if (!el.className.split(" ").includes(c)) el.className = (el.className + " " + c).trim(); },
        remove(c) { el.className = el.className.split(" ").filter(x => x && x !== c).join(" "); },
        contains(c) { return el.className.split(" ").includes(c); },
        toggle(c, on) { on ? el.classList.add(c) : el.classList.remove(c); }
      }
    };
    return el;
  }
  const body = mk("body");
  global.document = {
    readyState: "complete", body, head: mk("head"), documentElement: mk("html"),
    createElement: mk, getElementById: () => null, querySelectorAll: () => [],
    addEventListener() {}
  };
  global.getComputedStyle = n => ({ position: n._pos || "static" });
  global.requestAnimationFrame = fn => { listeners.push(fn); return 1; };
  global.window = { addEventListener() {} };
  return { mk, body };
}

const { mk, body } = fakeDom();
delete require.cache[require.resolve("../static/dockscroll.js")];
const DOM = require("../static/dockscroll.js");

/** dock (position:relative) > scroller, sized like a real queue frame. */
function makeDock(viewport, content) {
  const dock = mk("div"); dock._pos = "relative"; body.appendChild(dock);
  const sc = mk("div");
  sc.clientHeight = viewport; sc.clientWidth = 260; sc.scrollHeight = content;
  sc.offsetTop = 40; sc.offsetLeft = 0;
  dock.appendChild(sc);
  return { dock, sc };
}

console.log("dockscroll DOM plumbing");

t("attach creates one rail inside the positioned dock, not the body", () => {
  const { dock, sc } = makeDock(200, 800);
  DOM.attach(sc);
  const rails = dock.children.filter(c => c.className.includes("dsc-rail"));
  assert.strictEqual(rails.length, 1, "expected exactly one rail in the dock");
  assert.strictEqual(body.children.filter(c => c.className.includes("dsc-rail")).length, 0);
  assert.ok(sc.classList.contains("dsc-on"), "scroller must be flagged for scrollbar hiding");
});

t("rail is laid out over the scroller it belongs to", () => {
  const { dock, sc } = makeDock(200, 800);
  DOM.attach(sc);
  const rail = dock.children.find(c => c.className.includes("dsc-rail"));
  assert.strictEqual(rail.style.top, "42px");              // offsetTop 40 + 2 inset
  assert.strictEqual(rail.style.height, "196px");          // clientHeight - 4
  assert.strictEqual(rail.style.left, (260 - DOM.RAIL_W - 2) + "px");
});

t("rail turns on only when the content overflows", () => {
  const a = makeDock(200, 200); DOM.attach(a.sc);
  const b = makeDock(200, 800); DOM.attach(b.sc);
  const railA = a.dock.children.find(c => c.className.includes("dsc-rail"));
  const railB = b.dock.children.find(c => c.className.includes("dsc-rail"));
  assert.ok(!railA.classList.contains("on"), "no overflow must leave the rail off");
  assert.ok(railB.classList.contains("on"), "overflow must switch the rail on");
});

t("growing the queue past the frame switches the rail on", () => {
  const { dock, sc } = makeDock(200, 180);
  DOM.attach(sc);
  const rail = dock.children.find(c => c.className.includes("dsc-rail"));
  assert.ok(!rail.classList.contains("on"));
  sc.scrollHeight = 1400;                 // more jobs arrive
  DOM.refresh(sc);
  assert.ok(rail.classList.contains("on"), "rail should appear once jobs overflow");
  assert.ok(parseInt(rail.children[0].style.height, 10) >= DOM.MIN_THUMB);
});

t("a collapsed dock hides its rail instead of drawing a sliver", () => {
  const { dock, sc } = makeDock(200, 800);
  DOM.attach(sc);
  const rail = dock.children.find(c => c.className.includes("dsc-rail"));
  assert.ok(rail.classList.contains("on"));
  sc.clientHeight = 0; sc.clientWidth = 0;      // dock toggled off
  DOM.refresh(sc);
  assert.ok(!rail.classList.contains("on"), "hidden dock must not show a rail");
});

t("dragging the handle scrolls the region", () => {
  const { dock, sc } = makeDock(200, 800);
  DOM.attach(sc);
  const rail = dock.children.find(c => c.className.includes("dsc-rail"));
  const thumb = rail.children[0];
  // the rail is inset 2px top and bottom, so its track is clientHeight - 4;
  // derive the expectation from that rather than assuming the full height.
  const g = DOM.geom({ viewport: 200, content: 800, scrollTop: 0, track: 200 - 4 });
  thumb.fire("pointerdown", { clientY: 0, preventDefault() {}, stopPropagation() {}, pointerId: 1 });
  thumb.fire("pointermove", { clientY: g.maxTop / 2, preventDefault() {}, pointerId: 1 });
  assert.strictEqual(sc.scrollTop, 300, "half the rail travel should be half the scroll");
  thumb.fire("pointermove", { clientY: 5000, preventDefault() {}, pointerId: 1 });
  assert.strictEqual(sc.scrollTop, 600, "dragging past the end must clamp");
  thumb.fire("pointerup", { pointerId: 1 });
  thumb.fire("pointermove", { clientY: 0, preventDefault() {}, pointerId: 1 });
  assert.strictEqual(sc.scrollTop, 600, "moves after pointerup must be ignored");
});

t("clicking the bare rail jumps, clicking the handle does not", () => {
  const { dock, sc } = makeDock(200, 800);
  DOM.attach(sc);
  const rail = dock.children.find(c => c.className.includes("dsc-rail"));
  const thumb = rail.children[0];
  rail.fire("pointerdown", { target: rail, clientY: 200, preventDefault() {} });
  assert.strictEqual(sc.scrollTop, 600);
  sc.scrollTop = 0; DOM.refresh(sc);
  rail.fire("pointerdown", { target: thumb, clientY: 200, preventDefault() {} });
  assert.strictEqual(sc.scrollTop, 0, "the handle must not double as a rail click");
});

t("attach is idempotent — no duplicate rails on re-scan", () => {
  const { dock, sc } = makeDock(200, 800);
  DOM.attach(sc); DOM.attach(sc); DOM.attach(sc);
  assert.strictEqual(dock.children.filter(c => c.className.includes("dsc-rail")).length, 1);
});

t("detach removes the rail and restores the native scrollbar", () => {
  const { dock, sc } = makeDock(200, 800);
  DOM.attach(sc);
  DOM.detach(sc);
  assert.strictEqual(dock.children.filter(c => c.className.includes("dsc-rail")).length, 0);
  assert.ok(!sc.classList.contains("dsc-on"));
});

console.log(`dockscroll: ${pass} checks passed`);
