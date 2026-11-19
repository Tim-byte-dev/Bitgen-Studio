/* ext/promptdock/ptapp.js — 2.888.0: 🎛 APP ACTIONS + SKILLS FOR THE CHAT (window.H3AppTools).
 * The prompt docker's 🎛 turns them on / off (localStorage h3.chat.app). static/index.html chatPost then sends context.app and
 * the app's state (H3Voice.state - the prompt, styles and their lists, Basic Settings, scenes, the job); the server's tool loop
 * (lib/llmAgent.js + lib/appActions.js) asks THIS page to do each action: while a chat turn runs, GET /api/agent/asks is polled
 * and an ask of kind "app" is done here with H3Voice.act (the same code as the 🎙 voice chat) or H3Voice.state, and answered
 * with what happened (POST /api/agent/answer {id, ok, result | state | why}). Skills: Settings ▸ General ▸ 🎛 Skills. */
(function (root) {
  "use strict";
  const doc = root.document, $ = (id) => doc.getElementById(id);
  if (!doc) return;
  const KEY = "h3.chat.app";
  const on = () => { try { return root.localStorage.getItem(KEY) === "1"; } catch (e) { return false; } };
  const post = (u, body) => root.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => ({}));
  function paint() {
    const b = $("ptApp"); if (!b) return;
    const v = on(); b.classList.toggle("on", v); b.setAttribute("aria-pressed", v ? "true" : "false");
    b.style.outline = v ? "2px solid var(--tiger, #f5a623)" : "";
  }
  function set(v) { try { root.localStorage.setItem(KEY, v ? "1" : "0"); } catch (e) { /* fine */ } paint(); }
  /** one ask from the server: do it here, say what happened */
  async function run(a) {
    const act = a.action || {};
    if (!root.H3Voice || typeof root.H3Voice.act !== "function") return post("/api/agent/answer", { id: a.id, ok: false, why: "the app's actions are not loaded on this page" });
    if (act.do === "state") {
      let st = {}; try { st = root.H3Voice.state(); } catch (e) { st = {}; }
      return post("/api/agent/answer", { id: a.id, ok: true, state: st });
    }
    try {
      const did = await root.H3Voice.act(act);
      return post("/api/agent/answer", { id: a.id, ok: true, result: did || act.do.replace(/_/g, " ") + " - done" });
    } catch (e) { return post("/api/agent/answer", { id: a.id, ok: false, why: String((e && e.message) || e).slice(0, 300) }); }
  }
  const done = new Set();
  let polling = false;
  async function tick() {
    const busy = typeof root.chatBusyNow === "function" && root.chatBusyNow();
    if (!on() || !busy || polling) return;
    polling = true;
    try {
      const j = await (await root.fetch("/api/agent/asks")).json();
      for (const a of (j.asks || []).filter((x) => x.kind === "app" && !done.has(x.id))) { done.add(a.id); await run(a); }
    } catch (e) { /* the next tick */ } finally { polling = false; }
  }
  function wire() {
    const b = $("ptApp"); if (!b || b.dataset.wired) return; b.dataset.wired = "1";
    b.addEventListener("click", () => { set(!on()); if (typeof root.appNote === "function") root.appNote(on() ? "🎛 app actions on - the chat's LLM can write the prompt, pick styles and settings, press Generate, work the StoryBoard and use your skills (never while web pages are in its answer)" : "🎛 app actions off"); });
    root.setInterval(tick, 500);
    paint();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", wire); else wire();
  setTimeout(wire, 1500);
  root.H3AppTools = { on, set, tick, run };
})(typeof window !== "undefined" ? window : globalThis);
