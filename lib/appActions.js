// lib/appActions.js — 2.888.0: 🎛 THE APP'S OWN ACTIONS AS TOOLS for the chat's LLM (the voice chat's catalogue, lib/voiceAgent.js
// ACTIONS - write / add to the prompt, the negative prompt, what Generate makes, the video mode, a style, a Basic Settings value,
// press Generate, make a picture, stop the running job, add / render a StoryBoard scene, show a docker).
// The page does them: a tool call waits here (lib/agentTools.js ask, kind "app") until the prompt docker's page
// (ext/promptdock/ptagent.js) runs it with H3Voice.act - the same code the 🎙 voice chat uses - and says what happened.
// app_state asks the page for what is on screen now (the prompt, the styles and their lists, Basic Settings, scenes, the job).
// Risk "app": refused while web words are in the turn (a page can never press Generate or change the prompt).
"use strict";
const VA = () => require("./voiceAgent");

const SKIP = new Set(["stop_listening"]);
// a tool call's own "name" is the TOOL's name - so an action's name parameter is "style" / "setting" for the model
const RENAME = { set_style: { name: "style" }, set_setting: { name: "setting" } };
const keyOf = (action, k) => (RENAME[action] && RENAME[action][k]) || k;
function argsOf(spec, action) {
  const a = {};
  for (const [k, t] of Object.entries(spec)) if (k !== "about") a[keyOf(action, k)] = Array.isArray(t) ? t.join(" | ") : t === "number" ? "a number" : "text";
  return a;
}
/** one tool per action: app_set_prompt, app_generate ... + app_state */
function build() {
  const T = {
    app_state: { risk: "app", about: "what the app shows now - the prompt, what Generate makes, the styles (and the ones there are), Basic Settings, the StoryBoard's scenes, the running job", args: {},
      async run(a, ctx) { const r = await page(ctx, { do: "state" }); return { state: r.state || {}, lines: VA().stateLines(r.state || {}) }; } },
  };
  for (const [name, spec] of Object.entries(VA().ACTIONS)) {
    if (SKIP.has(name)) continue;
    T["app_" + name] = { risk: "app", about: spec.about, args: argsOf(spec, name),
      async run(a, ctx) {
        const given = { do: name };
        for (const k of Object.keys(spec)) if (k !== "about") { const v = a[keyOf(name, k)] != null ? a[keyOf(name, k)] : a[k]; if (v != null) given[k] = v; }
        const act = VA().clean(given);
        if (!act) throw Object.assign(new Error(`${name} needs ${Object.entries(spec).filter(([k]) => k !== "about").map(([k, t]) => keyOf(name, k) + ": " + (Array.isArray(t) ? t.join("/") : t)).join("; ") || "nothing"}`), { status: 400 });
        const r = await page(ctx, act);
        (ctx.appDone = ctx.appDone || []).push(r.result || name);
        return { action: act, result: r.result || "done" };
      } };
  }
  return T;
}
/** ask the page to do it (ctx.app = agentTools.ask with kind "app"); the page answers {ok, result | why} */
async function page(ctx, action) {
  if (!ctx.app) throw new Error("the app's page is not there to do it");
  const r = await ctx.app({ kind: "app", action });
  if (!r || !r.ok) throw new Error(r && r.why ? r.why : "the app did not do it");
  return r;
}
const TOOLS = build();
module.exports = { TOOLS, build, argsOf, RENAME };
