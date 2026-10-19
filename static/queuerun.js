/* QUEUE RUN CARD (2.400.0, Tim: "in the queue docker merge the running card
   with the running cards details and progress card").

   The queue docker used to show a running render TWICE: the generation
   queue's RUNNING row (status + ⏸ ▲ ▼ ✕ + the summary) and, further down,
   the job's own row (id · mode · size + "chunk i/n · step s of t · m:ss" +
   the prompt again). They are now one card: the RUNNING row grows the job's
   id line, a progress bar and the step/time line, clicking it selects the
   job (console, preview), and the job list skips that job.

   Pure helpers (pct / runText / idLine / mergedJobId) are testable in node;
   paint() fills the card's .gqjob area in the browser. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.QueueRun = api;
})(typeof self !== "undefined" ? self : this, function () {
  /** 0..100 for a job's progress ({step,total,chunk:{i,n}}), or null while loading. */
  function pct(pr) {
    if (!pr || !pr.total) return null;
    const step = Math.max(0, Math.min(+pr.step || 0, +pr.total));
    const n = pr.chunk && pr.chunk.n > 1 ? +pr.chunk.n : 1;
    const i = n > 1 ? Math.max(1, Math.min(+pr.chunk.i || 1, n)) : 1;
    return Math.round(((i - 1) + step / pr.total) / n * 100);
  }
  /** "chunk i/n · step s of t · m:ss" - the same words the job row used (2.384.0). */
  function runText(pr, status) {
    if (status === "queued") return "waiting for the GPU";
    if (!pr) return "starting";
    const t = Math.max(0, Math.round(pr.elapsed || 0)), mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, "0");
    const ch = pr.chunk && pr.chunk.n > 1 ? `chunk ${pr.chunk.i}/${pr.chunk.n} · ` : "";
    return (pr.total ? `${ch}step ${pr.step} of ${pr.total}` : `${ch}loading`) + ` · ${mm}:${ss}`;
  }
  /** "id · mode · w×h" */
  function idLine(job) {
    if (!job) return "";
    const p = job.params || {};
    const size = p.width && p.height ? ` · ${p.width}×${p.height}` : "";
    return `${job.id}${p.mode ? ` · ${p.mode}` : ""}${size}`;
  }
  /** The job id the queue's RUNNING row stands for (null when none). */
  function mergedJobId(items, RUNNING) {
    const it = (items || []).find((x) => x && x.status === RUNNING && x.jobId);
    return it ? it.jobId : null;
  }
  /** Fill a running card's job area. `job` may be null (submitted, not yet listed). */
  function paint(card, job, selected) {
    if (!card) return;
    let box = card.querySelector(".gqjob");
    if (!box) {
      box = document.createElement("div");
      box.className = "gqjob";
      box.innerHTML = `<div class="gqid"></div><div class="gqbar"><i></i></div><div class="gqrun"></div>`;
      const text = card.querySelector(".gqtext");
      card.insertBefore(box, text ? text.nextSibling : null);
    }
    const p = job ? pct(job.progress) : null;
    box.querySelector(".gqid").textContent = job ? idLine(job) : "starting…";
    const bar = box.querySelector(".gqbar");
    bar.classList.toggle("busy", p == null);
    bar.firstElementChild.style.width = (p == null ? 0 : p) + "%";
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuenow", String(p == null ? 0 : p));
    box.querySelector(".gqrun").textContent = job ? runText(job.progress, job.status) + (p != null ? ` · ${p}%` : "") : "";
    card.classList.toggle("sel", !!(job && selected === job.id));
    if (job) {
      card.dataset.job = job.id;
      card.title = "Click to follow this render (console + preview)";
      // the prompt the worker got (enhanced / with notes) is the tooltip of the summary
      const text = card.querySelector(".gqtext");
      if (text && job.params && job.params.prompt) text.title = job.params.prompt;
    }
  }
  return { pct, runText, idLine, mergedJobId, paint };
});
