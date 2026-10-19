#!/usr/bin/env node
/* bitGen Studio — 2.392.0: docker.cfg (lib/dockerCfg.js + static/dockcfg.js's pure parts + routes/dockerCfg.js).
 * Run: node scripts/test-dockcfg.js
 * Tim: "create a file, docker.cfg / this file will house docker sizes when open with other dockers ... people will
 * likely use different resolutions". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 600) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const C = require(path.join(ROOT, "lib", "dockerCfg"));
const D = require(path.join(ROOT, "static", "dockcfg.js"));
const throws = (f, re) => { try { f(); return false; } catch (e) { return re.test(e.message); } };
function send(port, method, u, body) {
  return new Promise((ok, no) => {
    const data = body == null ? null : Buffer.from(JSON.stringify(body));
    const r = http.request({ host: "127.0.0.1", port, path: u, method, headers: data ? { "Content-Type": "application/json", "Content-Length": data.length } : {} }, (res) => {
      let b = ""; res.on("data", (c) => { b += c; }); res.on("end", () => { let j = null; try { j = JSON.parse(b); } catch { j = null; } ok({ status: res.statusCode, j, b }); });
    });
    r.on("error", no); if (data) r.write(data); r.end();
  });
}

(async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "dockcfg392_"));
  let srv = null;
  try {
    check("keyOf: the open column dockers sorted, repeats / side docks / junk dropped", D.keyOf(["promptdock", "musicdock", "chatdock", "musicdock", "ldock", "x"]) === "chatdock+musicdock+promptdock" && D.keyOf([]) === "");
    check("namesOf: the dockers' names", D.namesOf("chatdock+musicdock+promptdock").join() === "Chat,Music,Prompt");
    const vs = [{ window: { w: 1920, h: 1080 } }, { window: { w: 1280, h: 720 } }, { window: { w: 2560, h: 1440 } }];
    const p1 = D.pick(vs, 1910, 1070), p2 = D.pick(vs, 1366, 768);
    check("pick: the same screen (within 40 px) = exact; another = the nearest size, not exact", p1.variant === vs[0] && p1.exact && p2.variant === vs[1] && !p2.exact && D.pick([], 1, 1) === null);
    const v = { window: { w: 2000, h: 1100 }, col: { h: 1000 }, docks: { musicdock: { height: 300, max_height: 200 }, chatdock: { height: 100 }, timelinedock: { height: 500 }, ldock: { width: 400 }, qdock: { width: 150 } } };
    const sc = D.scaled(v, "chatdock+musicdock", 500, 1000);
    check("scaled: the set's heights x column ratio (min 60, the 📌 max too), dockers outside the set left alone, side widths x window ratio (140..640)",
      sc.docks.musicdock.height === 150 && sc.docks.musicdock.max_height === 100 && sc.docks.chatdock.height === 60 && !sc.docks.timelinedock
      && sc.docks.ldock.width === 200 && sc.docks.qdock.width === 140 && sc.scale === 0.5, sc);
    check("...the same column / window = the sizes as saved", D.scaled(v, "musicdock", 1002, 2010).docks.musicdock.height === 300 && D.scaled(v, "musicdock", 1002, 2010).docks.ldock.width === 400);

    // the file
    check("no file = empty, auto on", JSON.stringify(C.load(base)) === '{"version":1,"auto":true,"configs":{}}');
    const snap = (w, h, mh) => ({ open: ["musicdock", "chatdock", "promptdock"], window: { w, h }, col: { h: h - 90 },
      docks: { musicdock: { state: "open", height: mh, width: 900, max_height: 0, maximized: false }, chatdock: { height: 200 }, ldock: { width: 300, hidden: false }, bogus: { height: 1 } },
      prompt: { floating: true, x: 600, y: 500, float_w: 700, float_h: 240, dock_to: "", dock_side: "" } });
    const s1 = C.save(base, snap(1920, 1080, 250));
    const f1 = JSON.parse(fs.readFileSync(path.join(base, "docker.cfg"), "utf8"));
    const v1 = f1.configs["chatdock+musicdock+promptdock"].variants[0];
    check("save: docker.cfg at the install root, the set's key, the docks clamped (junk dropped), the prompt's floating box, the window",
      s1.key === "chatdock+musicdock+promptdock" && v1.docks.musicdock.height === 250 && !v1.docks.bogus && v1.docks.ldock.width === 300 && v1.prompt.float_w === 700
      && v1.window.w === 1920 && v1.col.h === 990 && f1.auto === true, v1);
    C.save(base, snap(1925, 1075, 260));
    C.save(base, snap(1280, 720, 180));
    const vv = C.load(base).configs["chatdock+musicdock+promptdock"].variants;
    check("save again at the same screen = replaced; at another size = a second layout (newest first)", vv.length === 2 && vv[0].window.w === 1280 && vv[1].docks.musicdock.height === 260, vv.map((x) => x.window));
    for (let i = 0; i < 8; i++) C.save(base, snap(1000 + i * 100, 700, 200));
    check("at most 6 layouts a set (the newest kept)", C.load(base).configs["chatdock+musicdock+promptdock"].variants.length === C.MAX_VARIANTS);
    check("refused: nothing open", throws(() => C.save(base, { open: [], window: { w: 1, h: 1 } }), /no docker is open/));
    C.remove(base, "chatdock+musicdock+promptdock", 1700, 700);
    check("remove one window size's layout", C.load(base).configs["chatdock+musicdock+promptdock"].variants.length === 5);
    C.remove(base, "promptdock+musicdock+chatdock");
    check("remove the set (any order of its ids)", !C.load(base).configs["chatdock+musicdock+promptdock"] && throws(() => C.remove(base, "musicdock"), /no layout saved/));
    check("settings: auto off / on", C.settings(base, { auto: false }).auto === false && C.load(base).auto === false && C.settings(base, { auto: true }).auto === true);
    fs.writeFileSync(path.join(base, "docker.cfg"), "{ not json");
    check("a broken file reads as empty (and is written fresh on the next save)", Object.keys(C.load(base).configs).length === 0 && C.save(base, snap(800, 600, 100)).key);
    check("normalize: a key that is not sorted / not dockers is dropped", Object.keys(C.normalize({ configs: { "musicdock+chatdock": { variants: [{ window: { w: 900, h: 700 } }] }, "x+y": { variants: [] } } }).configs).length === 0);
    check("inject: window.H3_DOCK_CFG in the page head", /<head>\n<script>window\.H3_DOCK_CFG = \{"version":1/.test(C.inject("<html><head><title>x</title></head></html>", C.empty())));

    // the routes (the install root = a temp folder)
    const core = require(path.join(ROOT, "lib", "core"));
    const base0 = core.BASE;
    const express = require("express");
    const app = express(); app.use(express.json());
    Object.defineProperty(core, "BASE", { value: base, configurable: true, writable: true });
    require(path.join(ROOT, "routes", "dockerCfg.js")).mount(app);
    srv = app.listen(0, "127.0.0.1"); await new Promise((ok) => srv.once("listening", ok));
    const port = srv.address().port;
    const a1 = await send(port, "POST", "/api/docker-cfg/save", snap(1600, 900, 222));
    const a2 = await send(port, "GET", "/api/docker-cfg");
    const a3 = await send(port, "POST", "/api/docker-cfg/settings", { auto: false });
    const a4 = await send(port, "POST", "/api/docker-cfg/delete", { key: "chatdock+musicdock+promptdock", w: 1600, h: 900 });
    const a5 = await send(port, "POST", "/api/docker-cfg/save", { open: [] });
    check("the routes: save -> {key, cfg}, GET the file, settings, delete, a refusal in words",
      a1.status === 200 && a1.j.key === "chatdock+musicdock+promptdock" && a2.j.configs["chatdock+musicdock+promptdock"].variants.some((x) => x.docks.musicdock.height === 222)
      && a3.j.cfg.auto === false && a4.status === 200 && !(a4.j.cfg.configs["chatdock+musicdock+promptdock"] || { variants: [] }).variants.some((x) => x.window.w === 1600)
      && a5.status === 400 && /no docker is open/.test(a5.j.error), [a1.j && a1.j.key, a3.j, a5.j]);
    Object.defineProperty(core, "BASE", { value: base0, configurable: true, writable: true });

    const I = read("static", "index.html"), R = read("routes", "index.js"), RS = read("routes", "dockerStatus.js");
    check("the wiring: the page loads static/dockcfg.js, starts it after the docker_status boot, the route mounted in routes/index.js (not server.js), docker.cfg in the page head",
      /<script src="\/static\/dockcfg\.js"><\/script>/.test(I) && /window\.DockCfg\.start\(\)/.test(I) && /window\.H3GoneDocks = GONE_DOCKS/.test(I)
      && /require\("\.\/dockerCfg"\)\.mount\(app\)/.test(R) && !/dockerCfg|docker\.cfg/.test(read("server.js")) && /dc\.inject\(out, dc\.load\(core\.BASE\)\)/.test(RS));
  } catch (e) {
    check("the run finished", false, String(e && e.stack || e).slice(0, 900));
  } finally {
    if (srv) srv.close();
    fs.rmSync(base, { recursive: true, force: true });
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
