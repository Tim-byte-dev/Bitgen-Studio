/* genqueue.js — MANY GENERATIONS, ONE AT A TIME (2.122.0, by instruction).
 *
 * Tim: "allow user to add multiple generations to queue. generate one after the
 * other in the queue. allow user to delete items in the queue. leave the
 * generate button enabled so user can add to the queue ... generate button will
 * generate different types".
 *
 * WHY THE QUEUE IS HERE AND NOT ON THE SERVER. A queued generation is not a job
 * yet — it is a PRESS OF GENERATE that has not happened. It carries the mode and
 * the prompt, and everything else it needs is read from the panels at the moment
 * it actually runs. Promoting it to a server job on `add` would mean snapshotting
 * every control in the app into a request that then cannot be edited, and it
 * would put two queues in the product: this one and ComfyUI's. So the queue is a
 * list of INTENTIONS in the page, and exactly one of them is a real job at a
 * time. That is also what keeps the old rule intact: these jobs each want a whole
 * GPU, so the next one starts when the previous has FINISHED, not when its POST
 * returned.
 *
 * EACH ITEM REMEMBERS ITS OWN MODE. That is the point of "generate button will
 * generate different types": queue an image, flip the dropdown to video, queue
 * that, and both run as what they were when you pressed the button — not as
 * whatever the dropdown happens to say ten minutes later.
 *
 * PURE, and tested without a browser. Every function takes the queue and returns
 * a fact about it or changes it; nothing here touches the DOM or the network, so
 * the ordering rules are pinned by scripts/test-genqueue.js rather than by
 * clicking. The runner glue lives in index.html.
 */
(function (root) {
  "use strict";

  /** Not-yet-started, started, and the three ways an item can be over. */
  const WAITING = "waiting";
  const RUNNING = "running";
  const OVER = ["done", "failed", "cancelled"];

  let seq = 0;
  function newId() {
    seq += 1;
    return "q" + Date.now().toString(36) + "_" + seq.toString(36);
  }

  function create() { return { items: [], seq: 0 }; }

  /**
   * One queued generation.
   * @param mode  the Generate dropdown's value AT THE MOMENT OF THE PRESS
   * @param text  the prompt segment (empty is legitimate: a wired graph and a
   *              speech job do not read the prompt box the same way)
   */
  function item(mode, text, extra) {
    return Object.assign({
      id: newId(),
      mode: String(mode || "video"),
      text: String(text == null ? "" : text),
      status: WAITING,
      jobId: null,
      error: "",
      added: Date.now(),
    }, extra || {});
  }

  /** Append one or more items. Returns the items that were added. */
  function add(q, items) {
    const list = Array.isArray(items) ? items : [items];
    for (const it of list) if (it && it.id) q.items.push(it);
    return list;
  }

  /**
   * Turn one press into the items it means. `/br/` still splits a prompt into
   * several generations — that behaviour predates the queue and is now simply
   * how one press can add several rows instead of running a hidden loop.
   * A mode that does not read the prompt box yields exactly ONE item, however
   * many seams the box happens to contain.
   */
  const PROMPTLESS = ["graph"];
  function expand(mode, text, split) {
    const m = String(mode || "video");
    if (PROMPTLESS.includes(m)) return [item(m, "")];
    const parts = typeof split === "function" ? split(text) : [String(text || "").trim()].filter(Boolean);
    if (!parts.length) return [];
    return parts.map((p) => item(m, p));
  }

  /**
   * Delete a queued generation. A RUNNING item is refused: it is a real job on a
   * real GPU, and making ✕ silently mean "cancel a render" is how somebody loses
   * four minutes of work to a mis-click. Abort is the deliberate door for that,
   * and it asks first.
   */
  function remove(q, id) {
    const i = q.items.findIndex((x) => x.id === id);
    if (i < 0) return false;
    if (q.items[i].status === RUNNING) return false;
    q.items.splice(i, 1);
    return true;
  }

  /** Drop every item that has not started. Used by "Stop all". */
  function clearWaiting(q) {
    const before = q.items.length;
    q.items = q.items.filter((x) => x.status !== WAITING);
    return before - q.items.length;
  }

  /** Drop everything that is over, so the list stays the list of what is left. */
  function clearFinished(q) {
    const before = q.items.length;
    q.items = q.items.filter((x) => !OVER.includes(x.status));
    return before - q.items.length;
  }

  /** Move an item one place up or down. Only among the WAITING ones. */
  function move(q, id, dir) {
    const i = q.items.findIndex((x) => x.id === id);
    if (i < 0 || q.items[i].status !== WAITING) return false;
    const j = i + (dir < 0 ? -1 : 1);
    if (j < 0 || j >= q.items.length) return false;
    if (q.items[j].status !== WAITING) return false;     // never jump the running job
    const t = q.items[i]; q.items[i] = q.items[j]; q.items[j] = t;
    return true;
  }

  const running = (q) => q.items.find((x) => x.status === RUNNING) || null;
  const nextWaiting = (q) => q.items.find((x) => x.status === WAITING) || null;
  const waiting = (q) => q.items.filter((x) => x.status === WAITING);

  /** Put an item back at the front of the waiting run. Used by Retry. */
  function requeue(q, id) {
    const i = q.items.findIndex((x) => x.id === id);
    if (i < 0) return false;
    const it = q.items[i];
    q.items.splice(i, 1);
    it.status = WAITING; it.jobId = null; it.error = "";
    const first = q.items.findIndex((x) => x.status === WAITING);
    q.items.splice(first < 0 ? q.items.length : first, 0, it);
    return true;
  }

  function counts(q) {
    const c = { waiting: 0, running: 0, done: 0, failed: 0, cancelled: 0 };
    for (const x of q.items) if (x.status in c) c[x.status] += 1;
    return c;
  }

  /** What the Generate button should say. */
  function goLabel(q, mode, busy) {
    if (String(mode) === "chat") return "Send";
    const n = waiting(q).length + (busy || running(q) ? 1 : 0);
    return n > 1 ? `Generate (${n})` : "Generate";
  }

  const MODE_NAMES = { video: "Video", image: "Image", audio: "Music", speech: "Speech",
                       graph: "Graph", chat: "Chat" };
  /**
   * The queue row's summary: what it is, then what it says.
   *
   * 2.122.1, by instruction: NOT CUT BY DEFAULT. It used to stop at 70
   * characters, which was already too short once the status and four buttons
   * had taken their share of the row — and a queue of six variations on one
   * prompt is exactly the case where the tail is the only thing that tells the
   * rows apart. The row gives it the DOCK'S FULL WIDTH now and the CSS decides
   * how many lines that is worth, so the cut belongs there and not here.
   *
   * `max` is still available for callers that genuinely need one line, such as
   * the console lines Abort writes.
   */
  function label(it, max) {
    const name = MODE_NAMES[it.mode] || it.mode;
    const t = String(it.text || "").replace(/\s+/g, " ").trim();
    if (!t) return name;
    const cut = Number(max) > 0 && t.length > Number(max) ? t.slice(0, Number(max) - 1) + "…" : t;
    return `${name} · ${cut}`;
  }

  /**
   * THE QUEUE SURVIVES A RELOAD (2.125.0). What is written down, and what is
   * deliberately not:
   *
   * ONLY THE WAITING ITEMS. A RUNNING item is no longer an intention — it was
   * promoted to a real job on the server, and that job keeps rendering while the
   * page is gone. Writing it down here would give one render two owners: this
   * list and jobs.info, whose Pending tab already offers Resume for exactly this
   * case. Restoring it as WAITING would be worse still — it would start a second
   * render of something already on the GPU.
   *
   * FINISHED ITEMS ARE NOT WRITTEN EITHER. They are history, and the job list
   * underneath is where history lives.
   *
   * The row is stored as {mode, text, added} and nothing else: an item reads
   * every other setting from the panels AT THE MOMENT IT RUNS, so a snapshot of
   * the controls is precisely what this queue has always refused to take.
   */
  function serialize(q) {
    return waiting(q).map((x) => ({ mode: x.mode, text: x.text, added: x.added }));
  }

  /**
   * Put a serialized queue back. Accepts the array or the JSON string it was
   * stored as; anything unreadable restores nothing rather than throwing, since
   * this runs during boot and a corrupt key must not cost the user the app.
   * Fresh ids are minted so a restored row can never collide with a live one.
   * Returns how many were restored.
   */
  function restore(q, raw) {
    let list = raw;
    if (typeof list === "string") { try { list = JSON.parse(list); } catch { return 0; } }
    if (!Array.isArray(list)) return 0;
    let n = 0;
    for (const x of list) {
      if (!x || typeof x !== "object") continue;
      if (x.status && x.status !== WAITING) continue;   // never resurrect a render
      const it = item(x.mode, x.text);
      if (Number(x.added) > 0) it.added = Number(x.added);
      q.items.push(it);
      n += 1;
    }
    return n;
  }

  const API = { WAITING, RUNNING, OVER, PROMPTLESS, MODE_NAMES,
                create, item, add, expand, remove, clearWaiting, clearFinished,
                move, running, nextWaiting, waiting, requeue, counts, goLabel, label,
                serialize, restore };
  root.GENQUEUE = API;
  if (typeof module === "object" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
