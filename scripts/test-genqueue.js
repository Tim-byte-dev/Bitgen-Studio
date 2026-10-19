#!/usr/bin/env node
"use strict";
/* scripts/test-genqueue.js — the generation QUEUE (2.122.0).
 *
 * static/genqueue.js is the model behind "add several generations, run them one
 * after the other, delete the ones you changed your mind about". The ordering
 * rules are the whole feature, so they are pinned here rather than by clicking:
 * a running item is never deleted by ✕, never jumped in the order, and Retry
 * puts its item back at the FRONT of what is waiting rather than the end.
 */
const assert = require("assert");
const fs = require("fs");
const PAGE = require("../lib/extensions").pageHtml(require("path").join(__dirname, ".."));

const path = require("path");
const Q = require("../static/genqueue.js");

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; }
  catch (e) { fail++; console.log(`  FAIL ${name}: ${e.message}`); }
};
const split = (s) => String(s || "").split(/(?:^|\s)\/br\/(?=\s|$)/i).map((x) => x.trim()).filter(Boolean);

/* ------------------------------------------------------------ adding ----- */
t("a fresh queue is empty", () => {
  const q = Q.create();
  assert.deepStrictEqual(q.items, []);
  assert.strictEqual(Q.nextWaiting(q), null);
  assert.strictEqual(Q.running(q), null);
});
t("ids are unique even within the same millisecond", () => {
  const ids = new Set();
  for (let i = 0; i < 200; i++) ids.add(Q.item("video", "x").id);
  assert.strictEqual(ids.size, 200);
});
t("an item starts waiting, with no job behind it yet", () => {
  const it = Q.item("image", "a cat");
  assert.strictEqual(it.status, Q.WAITING);
  assert.strictEqual(it.jobId, null);
});
t("PRESSING GENERATE AGAIN ADDS, it does not replace", () => {
  const q = Q.create();
  Q.add(q, Q.item("video", "one"));
  Q.add(q, Q.item("image", "two"));
  assert.strictEqual(q.items.length, 2);
});
t("EACH ITEM KEEPS THE MODE IT WAS ADDED WITH", () => {
  const q = Q.create();
  Q.add(q, Q.expand("image", "a cat", split));
  Q.add(q, Q.expand("video", "a dog", split));
  assert.deepStrictEqual(q.items.map((x) => x.mode), ["image", "video"]);
});
t("/br/ still turns one press into several items", () => {
  const items = Q.expand("video", "one /br/ two /br/ three", split);
  assert.strictEqual(items.length, 3);
  assert.deepStrictEqual(items.map((x) => x.text), ["one", "two", "three"]);
});
t("...and a URL containing /br/ is not a seam", () => {
  const items = Q.expand("video", "see https://x.com/br/thing", split);
  assert.strictEqual(items.length, 1);
});
t("an empty prompt adds nothing rather than a blank job", () =>
  assert.deepStrictEqual(Q.expand("video", "   ", split), []));
t("A PROMPTLESS MODE ADDS EXACTLY ONE ITEM, however many seams are in the box", () => {
  const items = Q.expand("graph", "one /br/ two /br/ three", split);
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].text, "");
});
t("expand with no splitter still works on a plain prompt", () =>
  assert.strictEqual(Q.expand("video", "hello").length, 1));

/* ----------------------------------------------------------- deleting ---- */
const q3 = () => {
  const q = Q.create();
  Q.add(q, [Q.item("video", "a"), Q.item("image", "b"), Q.item("video", "c")]);
  return q;
};
t("a waiting item deletes", () => {
  const q = q3();
  assert.strictEqual(Q.remove(q, q.items[1].id), true);
  assert.deepStrictEqual(q.items.map((x) => x.text), ["a", "c"]);
});
t("deleting something that is not there is false, not a throw", () =>
  assert.strictEqual(Q.remove(q3(), "nope"), false));
t("A RUNNING ITEM IS NOT DELETED BY ✕ — that is what Abort is for", () => {
  const q = q3();
  q.items[0].status = Q.RUNNING;
  assert.strictEqual(Q.remove(q, q.items[0].id), false);
  assert.strictEqual(q.items.length, 3);
});
t("clearWaiting drops the queue but leaves the running job alone", () => {
  const q = q3();
  q.items[0].status = Q.RUNNING;
  assert.strictEqual(Q.clearWaiting(q), 2);
  assert.strictEqual(q.items.length, 1);
  assert.strictEqual(q.items[0].status, Q.RUNNING);
});
t("clearFinished removes only the finished ones", () => {
  const q = q3();
  q.items[0].status = "done"; q.items[1].status = "failed"; q.items[2].status = "cancelled";
  assert.strictEqual(Q.clearFinished(q), 3);
  assert.strictEqual(q.items.length, 0);
});

/* ------------------------------------------------------------ ordering --- */
t("an item moves up and down", () => {
  const q = q3();
  assert.strictEqual(Q.move(q, q.items[2].id, -1), true);
  assert.deepStrictEqual(q.items.map((x) => x.text), ["a", "c", "b"]);
  assert.strictEqual(Q.move(q, q.items[0].id, 1), true);
  assert.deepStrictEqual(q.items.map((x) => x.text), ["c", "a", "b"]);
});
t("moving off either end is refused", () => {
  const q = q3();
  assert.strictEqual(Q.move(q, q.items[0].id, -1), false);
  assert.strictEqual(Q.move(q, q.items[2].id, 1), false);
});
t("NOTHING JUMPS THE RUNNING JOB", () => {
  const q = q3();
  q.items[0].status = Q.RUNNING;
  assert.strictEqual(Q.move(q, q.items[1].id, -1), false, "a waiting item swapped with the running one");
  assert.strictEqual(Q.move(q, q.items[0].id, 1), false, "the running item was moved");
});
t("the next item to run is the first WAITING one", () => {
  const q = q3();
  q.items[0].status = "done";
  assert.strictEqual(Q.nextWaiting(q).text, "b");
});
t("running() finds the one in flight", () => {
  const q = q3();
  q.items[1].status = Q.RUNNING;
  assert.strictEqual(Q.running(q).text, "b");
});

/* -------------------------------------------------------------- retry ---- */
t("RETRY PUTS THE ITEM BACK AT THE FRONT OF THE WAITING RUN", () => {
  const q = q3();
  q.items[0].status = "failed";
  assert.strictEqual(Q.requeue(q, q.items[0].id), true);
  assert.deepStrictEqual(q.items.map((x) => x.text), ["a", "b", "c"]);
  assert.strictEqual(q.items[0].status, Q.WAITING);
});
t("...even when finished items sit in front of it", () => {
  const q = q3();
  q.items[0].status = "done"; q.items[1].status = "done"; q.items[2].status = "cancelled";
  Q.requeue(q, q.items[2].id);
  assert.deepStrictEqual(q.items.map((x) => x.text), ["a", "b", "c"]);
  assert.strictEqual(q.items[2].status, Q.WAITING);
});
t("...and a retried item forgets the job it failed as", () => {
  const q = q3();
  q.items[0].status = "failed"; q.items[0].jobId = "abc"; q.items[0].error = "boom";
  Q.requeue(q, q.items[0].id);
  assert.strictEqual(q.items[0].jobId, null);
  assert.strictEqual(q.items[0].error, "");
});
t("retrying something that is not there is false", () =>
  assert.strictEqual(Q.requeue(q3(), "nope"), false));

/* -------------------------------------------------------------- labels --- */
t("counts report each state", () => {
  const q = q3();
  q.items[0].status = Q.RUNNING; q.items[1].status = "failed";
  assert.deepStrictEqual(Q.counts(q), { waiting: 1, running: 1, done: 0, failed: 1, cancelled: 0 });
});
t("the button says Generate with nothing queued", () =>
  assert.strictEqual(Q.goLabel(Q.create(), "video", false), "Generate"));
t("...and counts what is left when there is a queue", () => {
  const q = q3();
  q.items[0].status = Q.RUNNING;
  assert.strictEqual(Q.goLabel(q, "video", false), "Generate (3)");
});
t("...and one item alone does not get a count", () => {
  const q = Q.create();
  Q.add(q, Q.item("video", "a"));
  assert.strictEqual(Q.goLabel(q, "video", false), "Generate");
});
t("...and chat mode still says Send (2.107.0, by instruction)", () =>
  assert.strictEqual(Q.goLabel(q3(), "chat", false), "Send"));
t("a row's label names the type, then the prompt", () =>
  assert.strictEqual(Q.label(Q.item("image", "a cat  on\na mat")), "Image · a cat on a mat"));
t("THE SUMMARY IS NOT CUT — the row gives it the dock's full width", () => {
  /* 2.122.1, by instruction. It stopped at 70 characters, which was already too
     little once the status and four buttons had taken their share of the row.
     Where a long prompt stops is now the CSS's business (a three-line clamp on
     a full-width line), so this must stay uncut. */
  const l = Q.label(Q.item("video", "x".repeat(300)));
  assert.ok(l.includes("x".repeat(300)), "the summary was truncated");
  assert.ok(!l.includes("…"));
});
t("...but a caller that needs one line can still ask for one", () => {
  const l = Q.label(Q.item("video", "x".repeat(300)), 70);
  assert.ok(l.length < 90, l.length);
  assert.ok(l.endsWith("…"));
});
t("a cap shorter than the text is honoured exactly once", () =>
  assert.strictEqual(Q.label(Q.item("video", "abcdefghij"), 5), "Video · abcd…"));
t("a cap longer than the text changes nothing", () =>
  assert.strictEqual(Q.label(Q.item("video", "abc"), 70), "Video · abc"));
t("whitespace is still collapsed, so a pasted prompt is one readable line", () =>
  assert.strictEqual(Q.label(Q.item("image", "a cat  on\na mat")), "Image · a cat on a mat"));
t("a promptless item still says what it is", () =>
  assert.strictEqual(Q.label(Q.item("graph", "")), "Graph"));

/* ------------------------------------------------------- the shipped page */
const HTML = PAGE;
const anchor = (name, re) => t(name, () => assert.ok(re.test(HTML), `index.html is missing ${re}`));
anchor("the page loads genqueue.js", /\/static\/genqueue\.js/);
anchor("the queue dock has its own pending-generations list", /id="genq"/);
anchor("the abort button exists", /id="abortBtn"/);
t("...and the abort dialog offers all three answers", () => {
  for (const id of ["ab_one", "ab_retry", "ab_all", "ab_cancel"])
    assert.ok(new RegExp(`id="${id}"`).test(HTML), `the abort dialog has no ${id}`);
});
t("ENTER IN THE PROMPT SENDS TO CHAT, it no longer generates", () => {
  const m = HTML.match(/\$\("prompt"\)\.addEventListener\("keydown"[\s\S]{0,900}?\n  \}\);/);
  assert.ok(m, "the prompt keydown handler was not found");
  assert.ok(/chatSend\(/.test(m[0]), "Enter does not send to chat");
  assert.ok(!/runGenerate\(/.test(m[0]), "Enter still starts a generation");
});
t("THE GENERATE BUTTON IS NEVER DISABLED WHILE RUNNING", () => {
  /* The whole point: you can keep adding while one renders. submitJob's own
     disable/re-enable pair went with it. */
  assert.ok(!/\$\("go"\)\.disabled = true/.test(HTML),
    "something still disables Generate — the user cannot add to the queue while one runs");
});
t("the runner drains the queue rather than looping over prompt parts", () => {
  assert.ok(/GENQUEUE\.nextWaiting/.test(HTML), "nothing reads the next waiting item");
  assert.ok(/GENQUEUE\.expand/.test(HTML), "Generate does not add to the queue");
});
t("aborting a render goes through the server's cancel, not a page-local flag", () =>
  assert.ok(/\/cancel/.test(HTML)));
t("genqueue.js holds no DOM or network code", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "static", "genqueue.js"), "utf8");
  for (const word of ["document.", "fetch(", "window.addEventListener"])
    assert.ok(!src.includes(word), `genqueue.js touches ${word} — the model must stay pure`);
});

t("the queue row puts its controls on their own line, above the summary", () => {
  assert.ok(/class="gqtop"/.test(HTML), "there is no control line");
  assert.ok(/<div class="gqtop">[\s\S]*?<\/div><div class="gqtext">/.test(HTML),
    "the summary does not come after the controls");
});
t("...and the summary spans the dock rather than sharing a flex line", () => {
  const css = (/#genq \.gqtext \{[^}]*\}/.exec(HTML) || [""])[0];
  assert.ok(/width:\s*100%/.test(css), `the summary is not full width: ${css}`);
  assert.ok(!/flex:\s*1/.test(css), `the summary still shares a row: ${css}`);
});
t("...with the whole prompt on the tooltip, so the clamp loses nothing", () =>
  assert.ok(/text\.title = GENQUEUE\.label\(it\)/.test(HTML)));
t("the console lines still ask for one line", () =>
  assert.ok(/GENQUEUE\.label\(it, 70\)/.test(HTML), "a log line could now be 300 characters"));

/* ------------------------------------- the queue survives a reload (2.125.0) */
t("serialize writes down the waiting rows, in order", () => {
  const q = Q.create();
  Q.add(q, [Q.item("video", "one"), Q.item("image", "two")]);
  const raw = Q.serialize(q);
  assert.strictEqual(raw.length, 2);
  assert.deepStrictEqual(raw.map((x) => x.mode), ["video", "image"]);
  assert.deepStrictEqual(raw.map((x) => x.text), ["one", "two"]);
});
t("a RUNNING item is never written down — its render already has an owner", () => {
  const q = Q.create();
  const a = Q.item("video", "rendering now");
  Q.add(q, [a, Q.item("video", "next")]);
  a.status = Q.RUNNING;
  const raw = Q.serialize(q);
  assert.strictEqual(raw.length, 1);
  assert.strictEqual(raw[0].text, "next");
});
t("finished rows are not written down either", () => {
  const q = Q.create();
  const a = Q.item("video", "done one");
  const b = Q.item("video", "failed one");
  Q.add(q, [a, b, Q.item("video", "still waiting")]);
  a.status = "done"; b.status = "failed";
  assert.deepStrictEqual(Q.serialize(q).map((x) => x.text), ["still waiting"]);
});
t("no control values are snapshotted into a stored row", () => {
  const q = Q.create();
  Q.add(q, Q.item("image", "a cat", { jobId: "j1", error: "boom" }));
  assert.deepStrictEqual(Object.keys(Q.serialize(q)[0]).sort(), ["added", "mode", "text"]);
});
t("restore puts the rows back as WAITING", () => {
  const q = Q.create();
  const n = Q.restore(q, [{ mode: "image", text: "a", added: 5 }, { mode: "video", text: "b" }]);
  assert.strictEqual(n, 2);
  assert.strictEqual(q.items.length, 2);
  assert.ok(q.items.every((x) => x.status === Q.WAITING));
  assert.deepStrictEqual(q.items.map((x) => x.mode), ["image", "video"]);
  assert.strictEqual(q.items[0].added, 5);
});
t("a stored row keeps its mode, so a restored image does not run as video", () => {
  const q = Q.create();
  Q.add(q, [Q.item("image", "a"), Q.item("audio", "b")]);
  const q2 = Q.create();
  Q.restore(q2, JSON.parse(JSON.stringify(Q.serialize(q))));
  assert.deepStrictEqual(q2.items.map((x) => x.mode), ["image", "audio"]);
});
t("restore accepts the JSON string it was stored as", () => {
  const q = Q.create();
  assert.strictEqual(Q.restore(q, JSON.stringify([{ mode: "video", text: "x" }])), 1);
  assert.strictEqual(q.items[0].text, "x");
});
t("a corrupt or absent key restores nothing and never throws", () => {
  for (const junk of ["", "not json", "{}", null, undefined, 7, {}]) {
    const q = Q.create();
    assert.strictEqual(Q.restore(q, junk), 0, `${JSON.stringify(junk)} restored something`);
    assert.deepStrictEqual(q.items, []);
  }
});
t("restore refuses to resurrect a row that was RUNNING", () => {
  const q = Q.create();
  assert.strictEqual(Q.restore(q, [{ mode: "video", text: "on the gpu", status: "running" },
                                   { mode: "video", text: "ok" }]), 1);
  assert.strictEqual(q.items[0].text, "ok");
});
t("restored rows get fresh ids, so they cannot collide with a live one", () => {
  const q = Q.create();
  Q.add(q, Q.item("video", "live"));
  const live = q.items[0].id;
  Q.restore(q, [{ id: live, mode: "video", text: "restored" }]);
  assert.strictEqual(q.items.length, 2);
  assert.notStrictEqual(q.items[1].id, live);
});
t("a round trip through serialize/restore is stable", () => {
  const q = Q.create();
  Q.add(q, Q.expand("video", "one /br/ two", split));
  const q2 = Q.create();
  Q.restore(q2, Q.serialize(q));
  assert.deepStrictEqual(Q.serialize(q2), Q.serialize(q));
});

/* the glue: written from the ONE function every mutation already ends with */
t("the page persists the queue from paintQueue and nowhere else", () => {
  assert.ok(/function paintQueue\(\) \{\s*\n\s*paintGoLabel\(\);\s*\n\s*saveQueue\(\);/.test(HTML),
    "saveQueue() is not called at the top of paintQueue");
  const calls = (HTML.match(/\bsaveQueue\(\)/g) || []).length;
  assert.strictEqual(calls, 2, `saveQueue is called ${calls} times (definition + paintQueue)`);
});
t("...and restores it before the first paint", () =>
  assert.ok(/restoreQueue\(\);\s*\/\/[^\n]*\n\s*paintQueue\(\);/.test(HTML),
    "the queue is painted before it is restored"));
t("a restored queue does not start the GPU by itself", () => {
  const boot = (/restoreQueue\(\);[\s\S]{0,200}/.exec(HTML) || [""])[0];
  assert.ok(!/drainQueue\(\)/.test(boot),
    "opening the app would start rendering something nobody pressed Generate for");
});

console.log(`test-genqueue: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
