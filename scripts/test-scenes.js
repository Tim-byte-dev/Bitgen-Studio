// bitGen Studio — lib/scenes.js: the Scene Board's state model, tested with
// no UI, no server and no ComfyUI (build order step 1).
// Run from repo root: node scripts/test-scenes.js
const fs = require("fs");
const os = require("os");
const path = require("path");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bgscenes-"));
process.env.H3_WORKSPACE = tmp;                 // before core is loaded
const core = require(path.join(__dirname, "..", "lib", "core"));
const S = require(path.join(__dirname, "..", "lib", "scenes"));
// A THROWAWAY project: these tests write a real .prj and Video assets, and
// doing that to the user's current project would clobber their own file.
const PROJ = "scenes-unit-tmp";
core.ensureProject(PROJ);
const chars = require(path.join(__dirname, "..", "lib", "characters"));
const sp = require(path.join(__dirname, "..", "lib", "screenplay"));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { console.log("PASS: " + name); pass++; }
  else { console.log("FAIL: " + name + (extra !== undefined ? " -> " + JSON.stringify(extra) : "")); fail++; }
}

// ---- deriving from the plan: THE PLAN IS THE TRUTH -----------------------
const plan = { prompt_prefix: ["subject_definitions:"], shots: [
  { id: "clip_01", prompt: ["[Shot 1] @jinx enters.", "", "@jinx (S1), quietly:", "<d>[English] Hello.</d>"], length: 158, seed: "123" },
  { id: "clip_02", prompt: ["@shahzaib turns."], length: 96, seed: "456" },
] };
let st = S.fromPlan(plan, null, new Date("2026-09-01T10:00:00Z"));
check("fromPlan makes one record per shot, numbered in story order",
      st.list.length === 2 && st.list[0].n === 1 && st.list[1].n === 2);
check("a fresh scene starts idle with the shot's own prompt/length/seed",
      st.list[0].status === "idle" && st.list[0].prompt[0] === "[Shot 1] @jinx enters."
      && st.list[1].length === 96 && st.list[1].seed === "456");

// render state survives a re-derive, keyed by shot id, not by position
st.list[0].status = "kept"; st.list[0].output = "scene1_intro.mp4"; st.list[0].upscaled = "scene1_intro_up.mp4";
st.list[0].chapter = "Intro";
const plan2 = { shots: [
  { id: "clip_00", prompt: ["[Shot 1] a new opening."] },   // inserted before
  plan.shots[0], plan.shots[1],
] };
const st2 = S.fromPlan(plan2, st);
check("an inserted shot renumbers the rest but keeps their state by id",
      st2.list.length === 3 && st2.list[1].id === "clip_01" && st2.list[1].n === 2
      && st2.list[1].status === "kept" && st2.list[1].output === "scene1_intro.mp4"
      && st2.list[1].upscaled === "scene1_intro_up.mp4" && st2.list[1].chapter === "Intro");
check("the new shot starts idle", st2.list[0].status === "idle" && st2.list[0].id === "clip_00");
const plan3 = { shots: [{ id: "clip_01", prompt: ["a REWRITTEN beat."] }] };
const st3 = S.fromPlan(plan3, st);
check("a shot whose prompt changed drops back to idle (the take is stale)…",
      st3.list[0].status === "idle" && st3.list[0].prompt[0] === "a REWRITTEN beat.");
check("…but keeps its last output for the preview, dropping the upscale",
      st3.list[0].output === "scene1_intro.mp4" && st3.list[0].upscaled === "");
check("a shot removed from the plan takes its record with it — the plan is the truth",
      !st3.list.some((r) => r.id === "clip_02"));
check("fromPlan never throws on junk", (() => {
  try { return S.fromPlan(null, null).list.length === 0 && S.fromPlan({ shots: "x" }, 7).list.length === 0; }
  catch { return false; } })());

// ---- naming: scene<n>_<chapter>, through THE slugger ---------------------
check("fileName is scene<n>_<chapter>", S.fileName(3, "Heist") === "scene3_Heist");
check("a blank chapter is just scene<n>", S.fileName(2, "") === "scene2");
check("a hostile chapter name cannot escape the folder",
      !/[\\/]/.test(S.fileName(1, "../../etc")) && S.fileName(1, "../../etc") === "scene1_....etc",
      S.fileName(1, "../../etc"));
check("the chapter goes through chars.slug — one slugger, not two",
      S.fileName(4, 'My Scene: Part 2') === "scene4_" + chars.slug('My Scene: Part 2').replace(/\s+/g, "_"),
      S.fileName(4, 'My Scene: Part 2'));

// ---- persistence: the .prj file, only the `scenes` key -------------------
fs.writeFileSync(core.prjPath(PROJ),
  JSON.stringify({ description: "keep me", timeline: { keep: true } }, null, 2));
S.save(st, PROJ);
const prj = JSON.parse(fs.readFileSync(core.prjPath(PROJ), "utf8"));
check("save writes the board into the project file", Array.isArray(prj.scenes.list)
      && prj.scenes.list.length === 2);
check("save does not clobber the other keys in the .prj",
      prj.description === "keep me" && prj.timeline && prj.timeline.keep === true);
const back = S.load(PROJ);
check("load reads back what save wrote, statuses intact",
      back.list[0].status === "kept" && back.list[0].chapter === "Intro");
check("load on a project with no board is an empty board, never a throw",
      (() => { try { const b = S.load("no-such-project-xyz"); return b.list.length === 0 && b.chapters.length === 0; } catch { return false; } })());
check("safe() scrubs junk statuses and keeps order",
      S.safe({ list: [{ id: "a", status: "exploded" }] }).list[0].status === "idle");

// ---- chapters ------------------------------------------------------------
let cs = S.addChapter(S.blank(), "  Act One  ");
check("addChapter slugs and records the chapter", cs.chapter === "Act One"
      && cs.state.chapters.includes("Act One"));
cs = S.addChapter(cs.state, "Act One");
check("adding the same chapter twice keeps one", cs.state.chapters.length === 1);
check("an empty chapter name is refused, not recorded",
      S.addChapter(S.blank(), "   ").chapter === null);
let sc = S.setChapter(back, 2, "Act One");
check("setChapter tags the scene and registers the chapter",
      S.at(sc.state, 2).chapter === "Act One" && sc.state.chapters.includes("Act One"));

// ---- transitions ---------------------------------------------------------
let t = S.starting(back, 2, "job123");
check("starting marks running and attaches the job id",
      S.at(t.state, 2).status === "running" && S.at(t.state, 2).job === "job123");
t = S.rendered(t.state, 2, "scene2_Act_One.mp4");
check("rendered records the output and clears the job",
      S.at(t.state, 2).status === "rendered" && S.at(t.state, 2).output === "scene2_Act_One.mp4"
      && S.at(t.state, 2).job === "");
let k = S.keep(t.state, 2);
check("keep marks the take", k.changed === true && S.at(k.state, 2).status === "kept");
k = S.keep(k.state, 2);
check("keep is IDEMPOTENT — the second press reports no change, so the caller "
      + "cannot upscale twice", k.changed === false && S.at(k.state, 2).status === "kept");
check("keeping a scene with nothing rendered is refused",
      S.keep(S.fromPlan(plan, null), 1).changed === false
      && !!S.keep(S.fromPlan(plan, null), 1).error);
check("keeping a scene that does not exist says so",
      S.keep(back, 99).error === "no such scene");
let r = S.redo(k.state, 2);
check("redo drops back to idle but the last take stays for the preview",
      S.at(r.state, 2).status === "idle" && S.at(r.state, 2).output === "scene2_Act_One.mp4");
check("redo clears the upscale — a redone scene has not been upscaled",
      S.at(r.state, 2).upscaled === "");
check("redo twice is a no-op", S.redo(r.state, 2).changed === false);
// a render finishing on a KEPT scene must not un-keep it
let kk = S.rendered(k.state, 2, "scene2_Act_One.mp4");
check("a repeat 'rendered' on a kept scene does not un-keep it",
      S.at(kk.state, 2).status === "kept");

// ---- produce order -------------------------------------------------------
let pstate = S.fromPlan(plan, null);
pstate = S.rendered(S.starting(pstate, 1, "j1").state, 1, "s1.mp4").state;
pstate = S.rendered(S.starting(pstate, 2, "j2").state, 2, "s2.mp4").state;
pstate = S.keep(pstate, 2).state;      // keep out of order
pstate = S.keep(pstate, 1).state;
S.at(pstate, 1).upscaled = "s1_up.mp4";
const outs = S.keptOutputs(pstate);
check("keptOutputs is the kept scenes IN STORY ORDER, preferring the upscale",
      outs.length === 2 && outs[0].name === "s1_up.mp4" && outs[1].name === "s2.mp4", outs);
check("a rendered-but-not-kept scene is not produced",
      S.keptOutputs(S.rendered(S.starting(S.fromPlan(plan, null), 1, "j").state, 1, "x.mp4").state).length === 0);

// ---- the intent matcher (build order step 4) — both directions -----------
const YES = ["create a screenplay", "Create a screenplay about two thieves",
             "make a screenplay of the heist", "please write a screenplay for my cast",
             "screenplay of a rainy chase", "Screenplay for the finale",
             "generate the screenplay", "draft a screenplay where jinx wins"];
const NO = ["what is a screenplay?", "what is a screenplay",
            "how are screenplays structured?", "explain screenplay formatting",
            "tell me about screenplay structure", "is a screenplay the same as a script?",
            "can you create a screenplay?",       // a question stays a question
            "we watched a movie with a great screenplay",
            "the screenplay of Chinatown is famous",
            "make the video longer", ""];
for (const y of YES) check(`asks for one: "${y}"`, sp.wantsScreenplay(y) === true);
for (const n of NO) check(`asks ABOUT one / unrelated: "${n}"`, sp.wantsScreenplay(n) === false);

// ---- the plan rides with the board (2.139.0) -----------------------------
// The tmp graph is rebuilt from the base style on every cast change, so the
// graph cannot be the screenplay's home; the board is.
let pl = S.fromPlan(plan, null);
check("fromPlan stores the plan it derived from",
      pl.plan && pl.plan.shots.length === 2);
S.save(pl, PROJ);
check("the plan survives save/load with the board",
      (S.load(PROJ).plan || {}).shots.length === 2);
check("a junk re-derive keeps the previous plan rather than dropping it",
      (S.fromPlan(null, pl).plan || {}).shots.length === 2);
check("safe() drops a plan with no shots", S.safe({ plan: { shots: "x" } }).plan === null);

// ---- recordRender: the take lands in Video assets under the scene's name -
const vdir = path.join(core.projDir(PROJ), "video");
fs.mkdirSync(vdir, { recursive: true });
const take = path.join(tmp, "job-out.mp4");
fs.writeFileSync(take, "notreallyanmp4");
let rr0 = S.setChapter(S.fromPlan(plan, null), 1, "Intro").state;
let rr = S.recordRender(rr0, 1, take, PROJ);
check("recordRender links the take as scene<n>_<chapter><ext> in Video assets",
      rr.name === "scene1_Intro.mp4" && fs.existsSync(path.join(vdir, "scene1_Intro.mp4")),
      rr.name);
check("…and the scene is now rendered with that name as its output",
      S.at(rr.state, 1).status === "rendered" && S.at(rr.state, 1).output === "scene1_Intro.mp4");
const rr2 = S.recordRender(rr.state, 1, take, PROJ);
check("a redo's second take is uniquified, never an overwrite",
      rr2.name !== rr.name && fs.existsSync(path.join(vdir, rr2.name)), rr2.name);
check("recordRender on a missing source never throws and changes nothing",
      (() => { try { const x = S.recordRender(rr.state, 1, path.join(tmp, "gone.mp4"), PROJ);
                     return x.name === null && x.changed === false; } catch { return false; } })());

// ---- the upscale queue (2.140.0) -----------------------------------------
let up0 = S.rendered(S.starting(S.fromPlan(plan, null), 1, "j1").state, 1, "s1.mp4").state;
up0 = S.keep(up0, 1).state;
let u = S.upscaling(up0, 1, "uj1");
check("upscaling remembers the job and leaves the status alone (kept stays kept)",
      u.changed === true && S.at(u.state, 1).upjob === "uj1"
      && S.at(u.state, 1).status === "kept");
check("upscaling an unrendered scene is refused",
      !!S.upscaling(S.fromPlan(plan, null), 1, "x").error);
check("upscaling a scene that is still rendering is refused",
      !!S.upscaling(S.starting(S.fromPlan(plan, null), 1, "j").state, 1, "x").error);
const utake = path.join(tmp, "up-out.mp4");
fs.writeFileSync(utake, "notreallyanupscale");
let ru0 = S.setChapter(u.state, 1, "Intro").state;
let ru = S.recordUpscale(ru0, 1, utake, PROJ);
check("recordUpscale files the take as scene<n>_<chapter>_upscaled beside the base",
      ru.name === "scene1_Intro_upscaled.mp4"
      && fs.existsSync(path.join(vdir, "scene1_Intro_upscaled.mp4")), ru.name);
check("…recording it clears the queue slot and does not touch the status",
      S.at(ru.state, 1).upjob === "" && S.at(ru.state, 1).status === "kept"
      && S.at(ru.state, 1).upscaled === "scene1_Intro_upscaled.mp4");
check("Produce prefers the upscaled take",
      S.keptOutputs(ru.state)[0].name === "scene1_Intro_upscaled.mp4",
      S.keptOutputs(ru.state));
let uf = S.upscaleFailed(u.state, 1);
check("a failed upscale forgets the job and keeps everything else",
      uf.changed === true && S.at(uf.state, 1).upjob === ""
      && S.at(uf.state, 1).status === "kept" && S.at(uf.state, 1).output === "s1.mp4");
check("redo clears a queued upscale along with the upscale itself",
      S.at(S.redo(u.state, 1).state, 1).upjob === "");

// ---- a failed render explains itself (2.142.5) ---------------------------
let fl = S.starting(S.fromPlan(plan, null), 1, "j1").state;
fl = S.failed(fl, 1, "ComfyUI: node 5108 missing input").state;
check("failed() lands back on idle WITH the reason on the record",
      S.at(fl, 1).status === "idle" && S.at(fl, 1).job === ""
      && /node 5108/.test(S.at(fl, 1).error));
check("the next starting() clears the old failure",
      S.at(S.starting(fl, 1, "j2").state, 1).error === "");
check("a kept scene that fails an upscale stays kept",
      (() => { let k2 = S.keep(S.rendered(S.starting(S.fromPlan(plan, null), 1, "j").state,
               1, "x.mp4").state, 1).state;
               return S.at(S.failed(k2, 1, "boom").state, 1).status === "kept"; })());

// ---- the failure reason is the WORKER'S verdict, never the exit shrug ----
const rl = S.reasonFromLog;
check("reasonFromLog picks the [worker] verdict over the exit line",
      /not reachable/.test(rl(["[worker] ComfyUI is not reachable at x. Start it first.",
                               "[bitgen-studio] worker exited with code 2."]))
      && !/exited with code/.test(rl(["[worker] boom", "[x] worker exited with code 2."])));
check("a ComfyUI rejection carries the per-node culprit lines",
      /node 5108 .*input 'vae'/.test(rl([
        "[comfy] rejected: validation",
        "[comfy]   node 5108 (MiniMaxH3ReferenceToVideo) input 'vae': Required input is missing",
        "[worker] ComfyUI rejected the workflow - the node errors above name the exact inputs.",
        "[srv] worker exited with code 2."])));
check("an empty or shrug-only log still yields a usable sentence",
      rl([]).length > 0 && rl(["[srv] worker exited with code 2."]).length > 0);
// 2.143.1: an EXECUTION error's card names the node ComfyUI blamed. The
// worker now says a "[comfy] node ..." culprit line AND a verdict naming the
// same node; the card must carry the culprit and not say the node twice.
const execLog = [
  "[comfy] {\"raw\": \"json dump of the event\"}",
  "[comfy]   exception_message: expected 16 channels",
  "[comfy] node 42 (VAEDecode): RuntimeError: expected 16 channels",
  "[worker] ComfyUI execution error in node 42 (VAEDecode): RuntimeError: expected 16 channels",
  "[srv] worker exited with code 2."];
check("an execution error's card names the blamed node and exception",
      /node 42 \(VAEDecode\): RuntimeError: expected 16 channels/.test(rl(execLog)));
check("...and does not name the same node twice (verdict deduped)",
      (rl(execLog).match(/node 42/g) || []).length === 1);
check("...a verdict about a DIFFERENT matter still rides beside the culprits",
      /node 42/.test(rl([
        "[comfy] node 42 (VAEDecode): RuntimeError: boom",
        "[worker] something else entirely failed"]))
      && /something else entirely/.test(rl([
        "[comfy] node 42 (VAEDecode): RuntimeError: boom",
        "[worker] something else entirely failed"])));

// ---- the render queue (2.149.0, "add a render selected button") -----------
// Pure model: ids not numbers, no doubles, survives plan edits, drains in
// order, drops entries whose shots were deleted.
{
  const base = S.safe({ list: [
    { n: 1, id: "clip_01", status: "idle" },
    { n: 2, id: "clip_02", status: "idle", job: "live1" },
    { n: 3, id: "clip_03", status: "idle" }] });
  const q = S.queueRenders(base, [1, 2, 3, 3, 7]);
  check("queueRenders: picked scenes queue by ID, in order",
        JSON.stringify(q.state.pending) === '["clip_01","clip_03"]', q.state.pending);
  check("queueRenders: a scene already RENDERING is skipped, not doubled",
        q.queued.indexOf("clip_02") === -1);
  check("queueRenders: a repeat tick and an unknown scene are reported, not queued",
        q.queued.length === 2 && q.errors.length === 1 && /no scene 7/.test(q.errors[0]),
        { queued: q.queued, errors: q.errors });
  const q2 = S.queueRenders(q.state, [1]);
  check("queueRenders: re-queuing an already-queued scene changes nothing",
        q2.queued.length === 0 && q2.state.pending.length === 2, q2.state.pending);
  let sh = S.shiftPending(q.state);
  check("shiftPending: drains in order and says which scene runs next",
        sh.n === 1 && JSON.stringify(sh.state.pending) === '["clip_03"]',
        { n: sh.n, left: sh.state.pending });
  sh = S.shiftPending(sh.state);
  check("shiftPending: the last entry drains to an empty queue",
        sh.n === 3 && sh.state.pending.length === 0);
  check("shiftPending: an empty queue answers null, not a crash",
        S.shiftPending(sh.state).n === null);
  // an edit that DELETES a queued shot drops its entry; the rest survive
  const planned = S.fromPlan({ shots: [{ id: "clip_01", prompt: ["a"] },
                                       { id: "clip_03", prompt: ["c"] }] }, q.state);
  check("fromPlan: the render queue survives a plan edit, minus deleted shots",
        JSON.stringify(planned.pending) === '["clip_01","clip_03"]', planned.pending);
  const planned2 = S.fromPlan({ shots: [{ id: "clip_03", prompt: ["c"] }] }, q.state);
  check("fromPlan: a queued entry for a deleted shot is dropped",
        JSON.stringify(planned2.pending) === '["clip_03"]', planned2.pending);
  check("safe: pending round-trips through disk coercion, deduped",
        JSON.stringify(S.safe({ pending: ["x", "x", "y", ""] }).pending) === '["x","y"]',
        S.safe({ pending: ["x", "x", "y", ""] }).pending);
}

// ---- the preflight card itemizes (2.153.0) --------------------------------
// Tim's card: "H3 preflight error: 2 error(s), 2 warning(s), 3 scene(s)." —
// a count is not a reason. The worker says the itemized lines as
// "[comfy]   <detail>" continuations; the card carries up to two of them.
check("reasonFromLog: the preflight's ITEMIZED lines ride the card, not just the count",
      (function () {
        const why = S.reasonFromLog([
          "[comfy] node 17 (MiniMaxH3ChainLoopStart): ValueError: H3 preflight error: 2 error(s), 2 warning(s), 3 scene(s).",
          "[comfy]   error: clip_02 length 40 is invalid",
          "[comfy]   error: unknown reference tag 'hero_face'",
          "[comfy]   warning: clip_03 has no dialogue",
          "[worker] ComfyUI execution error in node 17 (MiniMaxH3ChainLoopStart): ValueError: H3 preflight error: 2 error(s), 2 warning(s), 3 scene(s)."]);
        return /clip_02 length 40 is invalid/.test(why)
            && /unknown reference tag 'hero_face'/.test(why)
            && !/clip_03 has no dialogue/.test(why);   // two details, not the flood
      })());
check("reasonFromLog: without continuation lines the card reads as before",
      /VAEDecode.*boom/.test(S.reasonFromLog([
        "[comfy] node 42 (VAEDecode): RuntimeError: boom",
        "[worker] something else"])));

// ---- duration is part of the scene's identity (2.153.0) -------------------
{
  const p1 = { shots: [{ id: "clip_01", prompt: ["a"], length: 141 }] };
  let st = S.fromPlan(p1, null);
  st = S.rendered(st, 1, "take1.mp4").state;
  const stSame = S.fromPlan(p1, st);
  check("fromPlan: an unchanged duration keeps the render",
        stSame.list[0].status === "rendered", stSame.list[0]);
  const stDur = S.fromPlan({ shots: [{ id: "clip_01", prompt: ["a"], length: 241 }] }, st);
  check("fromPlan: a CHANGED duration is a new scene — back to idle, take preserved for preview",
        stDur.list[0].status === "idle" && stDur.list[0].output === "take1.mp4"
        && stDur.list[0].length === 241, stDur.list[0]);
  const legacy = { ...st, list: st.list.map((r) => { const c = { ...r }; delete c.length; return c; }) };
  const stLegacy = S.fromPlan(p1, legacy);
  check("fromPlan: a board saved before records had lengths does NOT reset on its first write",
        stLegacy.list[0].status === "rendered", stLegacy.list[0]);
}

fs.rmSync(core.projDir(PROJ), { recursive: true, force: true });
/* ---- 2.223.2: the Video docker's Seconds IS the scene duration ---- */
{
  const S = require("../lib/scenes");
  const CS = path.join(__dirname, "..", "custom.settings");
  const before = fs.existsSync(CS) ? fs.readFileSync(CS) : null;
  const proj = "zz-secs-test";
  const pdir = core.projDir(proj);
  fs.mkdirSync(pdir, { recursive: true });
  const prj = core.prjPath(proj);
  const prevPrj = fs.existsSync(prj) ? fs.readFileSync(prj) : null;
  try {
    const cfg = core.getConfig();
    const hadLen = cfg.chain && cfg.chain.length;
    if (cfg.chain) delete cfg.chain.length;
    fs.writeFileSync(prj, JSON.stringify({ gen: { seconds: "15" } }));
    let ov = S.chainOverrides(proj);
    check("docker Seconds 15 becomes the uniform scene length (360 frames before the grid snap)",
      ov.length === 360, ov);
    const screenplay = require("../lib/screenplay");
    const norm = screenplay.normalize({ shots: [{ id: "clip_01", prompt: ["<v> a test"] }] }, ov);
    check("normalize snaps it onto the pack's 17k+5 grid at ~15s (362 frames)",
      norm.shots[0].length === 362, norm.shots[0].length);
    // 2.223.3, Tim's field report: the context window is SPENT out of the
    // frame budget, so continuing scenes carry it on top and the first
    // scene's orphan window is zeroed (no predecessor to continue from)
    const multi = screenplay.normalize({ shots: [
      { id: "clip_01", prompt: ["<v> a"] },
      { id: "scene_02", prompt: ["<v> b"] }] }, ov);
    check("2.223.5: scene N climbs Tim's ladder — +(N−1)s, snapped UP, window kept as conditioning",
      (() => { const up = (n) => Math.min(3592, Math.max(screenplay.snapLength(n),
                 5 + 17 * Math.ceil((Math.min(3592, n) - 5) / 17)));
               return multi.shots[1].length === up(362 + 24)
                   && multi.shots[1].length >= 362 + 24
                   && multi.shots[1].context_length === 22; })(),
      multi.shots.map((x) => x.length));
    check("2.223.3: the FIRST scene's orphan context window is zeroed — no more looped first second",
      multi.shots[0].context_length === 0 && multi.shots[0].audio_context_length === 0
      && multi.shots[0].length === 362, multi.shots[0]);
    cfg.chain = { ...(cfg.chain || {}), length: 141 };
    ov = S.chainOverrides(proj);
    check("an explicit Basic Settings chain Length still wins over the docker",
      String(ov.length) === "141", ov);
    delete cfg.chain.length;
    if (hadLen) cfg.chain.length = hadLen;
    fs.rmSync(prj, { force: true });
    ov = S.chainOverrides(proj);
    check("no saved project state means the export default applies (no override)",
      ov.length === undefined, ov);
  } finally {
    prevPrj === null ? fs.rmSync(prj, { force: true }) : fs.writeFileSync(prj, prevPrj);
    fs.rmSync(pdir, { recursive: true, force: true });
    before === null ? fs.rmSync(CS, { force: true }) : fs.writeFileSync(CS, before);
  }
  const R = fs.readFileSync(path.join(__dirname, "..", "routes", "characters.js"), "utf8");
  check("every normalize/writePlan site in the routes reads chainOverrides — none reads raw config",
    !R.includes("core.getConfig().chain || {}")
    // 15 normalize/writePlan sites + the 2.223.16 H3_Video_Ref site
    // (queueRefScene reads the SAME knob the chain does — the docker's
    // Seconds); the 2.223.13 extend site left with queueExtend (2.227.0);
    // 2.281.0 added the deterministic tag repair's normalize +
    // re-validate pair in /api/screenplay (repairTags -> normalize ->
    // validate, both on chainOverrides like every other site)
    // + 2.297.0: the scene insert's normalize
    && (R.match(/scenes\.chainOverrides\(/g) || []).length === 18, null);
}

// ---- THE EXTEND REMOVAL (2.227.0, Tim verbatim: "remove the extend
// workflow, this workflow needs a node that corrupts the other h3 nodes")
// + what H3_Video_Ref still rides from lib/extendVideo ----------------------
{
  const S = require("../lib/scenes");
  check("the extend flag is GONE from the board state (blank and safe alike)",
    !("extend" in S.blank()) && !("extend" in S.safe({ extend: true })), null);
  // H3_VIDEO_REF (2.223.16): the board's style pick persists the same way
  check("the style pick persists with the board and survives a plan rewrite",
    S.blank().style === "" && S.safe({ style: "H3_Video_Ref" }).style === "H3_Video_Ref"
    && S.fromPlan({ shots: [{ id: "clip_01", prompt: ["x"] }] },
                  S.safe({ style: "H3_Video_Ref", list: [] })).style === "H3_Video_Ref", null);
  const EV = require("../lib/extendVideo");
  check("snapExtendFrames IS the pack's math: snap UP onto 17k+5, floor 5, cap 3592",
    EV.snapExtendFrames(5) === 124 && EV.snapExtendFrames(10) === 243
    && EV.snapExtendFrames(0.1) === 5 && EV.snapExtendFrames(1000) === 3592
    && EV.snapExtendFrames(-1) === null && EV.snapExtendFrames("x") === null,
    [EV.snapExtendFrames(5), EV.snapExtendFrames(10)]);
  check("extendFrames reads the SAME knobs as the chain (explicit length, else default) — ladder-free",
    EV.extendFrames("p", { length: 360 }, 141) === 362
    && EV.extendFrames("p", {}, 141) === 141
    && EV.extendFrames("p", null, 141) === 141, null);
  check("priorTake still answers scene n-1's take (the ref2va video-reference carry) and refuses in words",
    /no previous take/.test(EV.priorTake({ list: [] }, 1, "p").error || "")
    && /render it first/.test(EV.priorTake({ list: [
        { n: 1, output: "" }, { n: 2 }] }, 2, "p").error || ""), null);
  check("the extend workflow, its synthetic style and the checkbox endpoint are GONE",
    !fs.existsSync(path.join(__dirname, "..", "comfy_workflows", "h3_video_extend.json"))
    && EV.EXTEND_WF === undefined && EV.extendStyle === undefined
    && !fs.readFileSync(path.join(__dirname, "..", "routes", "characters.js"), "utf8")
         .includes('app.post("/api/scenes/extend"'), null);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
