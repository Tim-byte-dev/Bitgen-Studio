#!/usr/bin/env node
/* bitGen Studio — 2.772.0: WHAT A POD IS DOING NOW, AND WHAT IT HAS DONE (lib/podActivity.js) - the verb each task is shown with,
 * the same task updated in place while its numbers move, a new task closing the one before, the installer's fixed steps, the
 * end of a run, the view the PODS docker shows (now / done newest first / the result), at most 60 a pod.
 * Tim (verbatim): "in the pod that is installing and being used show what is being done, then hide the completed tasks in a
 * dropdown so the pods details don't get too big. say what it is doing, downloading, loading, finding etc" */
"use strict";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const PA = require("../lib/podActivity");
const V = (t) => { const v = PA.verbOf(t); return v.verb + "|" + v.rest; };
check("verbOf: what is said -> Downloading / Installing / Loading / Finding / Sending / Starting / Restarting / Updating / Checking / Linking / Waiting / Preparing / Repairing",
  V("downloading krea2.safetensors on the pod - 45%") === "Downloading|krea2.safetensors on the pod - 45%"
  && V("installing node packs on the pod: was-ns") === "Installing|node packs on the pod: was-ns"
  && V("loading pod - waiting for its ComfyUI (3 min)") === "Loading|pod - waiting for its ComfyUI (3 min)"
  && V("looking for qwen.safetensors on the pod") === "Finding|looking for qwen.safetensors on the pod"
  && V("asking the pod what it has") === "Finding|asking the pod what it has"
  && V("sending lora.safetensors from this computer") === "Sending|lora.safetensors from this computer"
  && V("starting the stopped pod Krea") === "Starting|the stopped pod Krea"
  && V("restarting the pod's ComfyUI for the new node packs") === "Restarting|the pod's ComfyUI for the new node packs"
  && V("updating ComfyUI (git pull)") === "Updating|ComfyUI (git pull)"
  && V("checking the pod's model files") === "Checking|the pod's model files"
  && V("linked into the folders the pod's ComfyUI reads: a") === "Linking|linked into the folders the pod's ComfyUI reads: a"
  && V("waiting for the pod's Jupyter (it downloads the files)") === "Waiting|for the pod's Jupyter (it downloads the files)"
  && V("making its styles ready: Krea 2") === "Preparing|making its styles ready: Krea 2"
  && V("the pod's ComfyUI answers but lists no nodes - repairing it") === "Working|the pod's ComfyUI answers but lists no nodes - repairing it"
  && V("repairing ComfyUI") === "Repairing|ComfyUI",
  ["downloading krea2.safetensors on the pod - 45%", "loading pod - waiting for its ComfyUI (3 min)", "waiting for the pod's Jupyter (it downloads the files)", "making its styles ready: Krea 2"].map(V));
check("…past tense keeps the verb (found / downloaded / installed / started / loaded); an unknown line is Working ⚙",
  PA.verbOf("found what the pod has").verb === "Finding" && PA.verbOf("downloaded ComfyUI").verb === "Downloading" && PA.verbOf("installed what ComfyUI needs").verb === "Installing"
  && PA.verbOf("started ComfyUI").verb === "Starting" && PA.verbOf("ComfyUI loaded - in 40 s").verb === "Loading" && PA.verbOf("ready").icon === "⚙");
check("keyOf: the same task while its numbers move (45% -> 46%, its minutes), another file is another task",
  PA.keyOf("downloading a.safetensors on the pod - 45% (3 min)") === PA.keyOf("downloading a.safetensors on the pod - 46% (2 min)")
  && PA.keyOf("loading pod - waiting for its ComfyUI (1 min)") === PA.keyOf("loading pod - waiting for its ComfyUI (12 min)")
  && PA.keyOf("downloading a.safetensors on the pod - 45%") !== PA.keyOf("downloading b.safetensors on the pod - 45%"));

let t = 1000;
PA.clear("p1");
PA.note("p1", "asking the pod what it has", t += 1000);
PA.note("p1", "downloading a.safetensors on the pod - 10%", t += 2000);
PA.note("p1", "downloading a.safetensors on the pod - 60%", t += 5000);
let v = PA.view("p1", t + 1000);
check("a new note closes the one before (done, how long it took); the same task again updates in place (one Downloading line, 60%)",
  v.now.length === 1 && v.now[0].verb === "Downloading" && /60%/.test(v.now[0].text) && v.now[0].secs === 6 && v.done.length === 1 && v.done[0].verb === "Finding" && v.done[0].state === "done" && v.done[0].secs === 2, v);
PA.note("p1", "downloading b.safetensors on the pod - 5%", t += 1000);
PA.note("p1", "checking the pod's model files", t += 1000);
PA.finish("p1", true, "ready", t += 1000);
v = PA.view("p1", t);
check("finish: nothing running now; the done list newest first, the result first (✓ ready)", v.now.length === 0 && v.last.ok && v.last.text === "ready" && v.done[0].result && v.done.map((x) => x.verb).join() === "Working,Checking,Downloading,Downloading,Finding", v.done.map((x) => x.verb));
PA.note("p1", "updating ComfyUI (git pull)", t += 1000);
v = PA.view("p1", t);
check("…a new run on the same pod: running again, the last result cleared, the history kept", v.now.length === 1 && v.last === null && v.done.length === 5);
PA.finish("p1", false, "ComfyUI was not updated: git could not update it", t += 1000);
v = PA.view("p1", t);
check("a failed run: the task that was running is failed (✗), the reason is the last line", v.done[0].state === "failed" && /not updated/.test(v.done[0].text) && v.done[1].state === "failed" && v.done[1].verb === "Updating" && v.last.ok === false, v.done.slice(0, 2));
// the installer's steps (fixed keys)
PA.clear("p2");
PA.note("p2", "waiting for the pod to load", 1000);
PA.step("p2", "find", "finding what the pod has", "running", 2000);
PA.step("p2", "find", "found what the pod has - Python 3.11 · PyTorch 2.8.0", "done", 4000);
PA.step("p2", "download", "downloading ComfyUI - receiving objects 45%", "running", 5000);
PA.note("p2", "something said by someone else", 5500);
PA.step("p2", "download", "downloading ComfyUI - receiving objects 90%", "running", 6000);
PA.step("p2", "venv", "making ComfyUI's Python environment - already there", "skipped", 7000);
v = PA.view("p2", 8000);
check("steps: a step keeps its verb when it is done (found … = Finding), one line per step while it runs, a skipped step listed as skipped, a loose note closes but does not end a step",
  v.now.length === 1 && v.now[0].verb === "Downloading" && /90%/.test(v.now[0].text)
  && v.done.map((x) => x.verb + ":" + x.state).join() === "Creating:skipped,Working:done,Finding:done,Waiting:done", v);
for (let i = 0; i < 80; i++) PA.note("p3", "sending file" + i + ".bin from this computer", 1000 + i);
check("at most 60 tasks a pod (the oldest go)", PA.view("p3").done.length + PA.view("p3").now.length === 60 && PA.view("p3").now[0].text === "sending file79.bin from this computer");
check("all(): every pod with something to show", Object.keys(PA.all()).sort().join() === "p1,p2,p3");
check("nothing for a pod with no tasks; no pod id = nothing kept", PA.view("nobody") === null && PA.note("", "x") === null && PA.note("p4", "  ") === null);
console.log("\n" + pass + " passed, " + fail + " failed");
console.log("RESULT: " + (fail ? "FAIL" : "PASS"));
process.exit(fail ? 1 : 0);
