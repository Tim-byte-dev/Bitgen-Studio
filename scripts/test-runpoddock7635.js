#!/usr/bin/env node
/* bitGen Studio — 2.763.5 units: the 💲 RunPod docker, docker windows going into any named docker, the floating dialogs over
 * the dockers, and custom nodes that upload without holding bitGen still.
 * Tim (verbatim): "allow multiple dockers to dock in the custom created docker, move the pods docker in front of any custom
 * docker, right now it goes behind the custom docker and can't dock in the custom docker, make a new docker for runpod prices
 * and move runpod balance and usage costs from the basic settings docker to the runpod docker" + "[pod] uploading
 * ComfyUI-H3-NativeAudioLock when using a krea style but i think it maybe stuck" */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

(async () => {
  /* ---- lib/runpodAccount.js */
  const RA = require("../lib/runpodAccount");
  check("QUERY asks RunPod's GraphQL for the balance, the spend now, the limit", /myself \{ clientBalance currentSpendPerHr spendLimit underBalance \}/.test(RA.QUERY));
  check("GQL: api.runpod.io/graphql unless H3_RUNPOD_GQL_API", (delete process.env.H3_RUNPOD_GQL_API, RA.GQL() === "https://api.runpod.io/graphql"));
  const a1 = RA.parseMyself({ data: { myself: { clientBalance: 435.85, currentSpendPerHr: 0.69, spendLimit: 80, underBalance: false } } });
  check("parseMyself: balance, $/h now, limit, how long it lasts", a1.balance === 435.85 && a1.spend_hr === 0.69 && a1.spend_limit === 80 && a1.under === false && a1.lasts_hr === 631.7, a1);
  let thrown = ""; try { RA.parseMyself({ errors: [{ message: "Unauthorized" }] }); } catch (e) { thrown = e.message; }
  check("parseMyself: RunPod's error words when it says no", /RunPod: Unauthorized/.test(thrown), thrown);
  check("lastsHours: nothing spending = null; 10 / 0.5 = 20 h", RA.lastsHours(10, 0) === null && RA.lastsHours(10, 0.5) === 20 && RA.lastsHours(null, 1) === null);
  let sent = null;
  const fake = (status, body) => async (url, o) => { sent = { url, o }; return { status, ok: status < 300, text: async () => JSON.stringify(body) }; };
  process.env.H3_RUNPOD_GQL_API = "http://stand.in/graphql";
  const a2 = await RA.account(true, { key: "k123", fetch: fake(200, { data: { myself: { clientBalance: 12.5, currentSpendPerHr: 1.25, spendLimit: 80 } } }) });
  check("account(): POST to the GraphQL address, Bearer key, the query", sent && sent.url === "http://stand.in/graphql" && sent.o.method === "POST" && sent.o.headers.Authorization === "Bearer k123" && JSON.parse(sent.o.body).query === RA.QUERY, sent && sent.o.headers);
  check("account(): the figures (lasts 10 h at 1.25 $/h)", a2.balance === 12.5 && a2.lasts_hr === 10 && !a2.error, a2);
  const a3 = await RA.account(true, { key: "k123", fetch: fake(401, {}) });
  check("account(): a refused key - the last figures stay, with why they are old", a3.balance === 12.5 && /refused the API key/.test(a3.error), a3);
  const a4 = await RA.account(true, { key: "" });
  check("account(): no key = asks for one", a4.balance === null && /API key first/.test(a4.error), a4);
  check("route: GET /api/pods/account in routes/pods.js (not server.js), before the :id routes", /app\.get\("\/api\/pods\/account", wrap\(\(req\) => require\("\.\.\/lib\/runpodAccount"\)\.account\(req\.query\.refresh === "1"\)\)\)/.test(rd("routes", "pods.js")) && !/runpodAccount/.test(rd("misc", "server.js")));

  /* ---- static/runpoddock.js (pure) */
  const RD = require("../static/runpoddock.js");
  const G = [{ id: "a", name: "RTX 4090", memory: 24, price: 0.69, offered: true, availability: "HIGH" }, { id: "b", name: "A40", memory: 48, price: 0.4, offered: true, availability: "LOW" },
    { id: "c", name: "H100 SXM", memory: 80, price: 2.99, offered: true }, { id: "d", name: "RTX 3090", memory: 24, price: 0.22, offered: false, availability: "NONE" }];
  check("sortGpus price: cheapest offered first, none free last", RD.sortGpus(G, "price").map((g) => g.id).join("") === "bacd", RD.sortGpus(G, "price").map((g) => g.id));
  check("sortGpus memory: most first; name: A-Z", RD.sortGpus(G, "memory")[0].id === "c" && RD.sortGpus(G, "name")[0].name === "A40");
  check("filterGpus: every word (\"rtx 24gb\" = the two 24 GB RTX)", RD.filterGpus(G, "rtx 24gb").map((g) => g.id).join("") === "ad" && RD.filterGpus(G, "").length === 4);
  check("availWord / lastsText", RD.availWord("low") === "few free" && RD.availWord("") === "not said" && RD.lastsText(0.4) === "less than an hour" && RD.lastsText(20) === "about 20 h" && RD.lastsText(96) === "about 4 days" && RD.lastsText(null) === "");
  const rows = RD.podRows([{ id: "p1", name: "one", status: "RUNNING", cost_hr: 0.69 }, { id: "p2", name: "two", status: "EXITED", cost_hr: 0.4 }], { pods: { p1: { today: 1, month: 5 }, p2: { today: 0, month: 9 }, p9: { today: 0, month: 3 } } });
  check("podRows: each pod with its $/h (running only), today, month; a terminated pod still on the bill", rows.length === 3 && rows[0].id === "p1" && rows[0].hr === 0.69 && rows[1].id === "p2" && rows[1].hr === 0 && rows[2].status === "GONE" && rows[2].month === 3, rows);
  const RDs = rd("static", "runpoddock.js");
  check("the docker: a SecFloat window 'runpod' (2.771.0: titled 💲 COSTS; floats, docks, goes in a ▣ docker), balance + usage + GPU prices, asked every minute",
    /SecFloat\.add\(\{ id: "runpod", title: "💲 COSTS"/.test(RDs) && /\/api\/pods\/account/.test(RDs) && /\/api\/pods\/costs/.test(RDs) && /\/api\/pods\/gpus\?cloud=/.test(RDs) && /H3_RUNPOD_POLL \|\| 60000/.test(RDs));
  check("💲 RunPod in Basic Settings ▸ GPU (#gpuRpDock) and in the PODS docker (#pdRpDock)", /b\.id = "gpuRpDock"/.test(RDs) && /id="pdRpDock"/.test(rd("static", "podsdock.js")));
  check("the 💲 line left Basic Settings (no #gpuPodCost made)", !/c\.id = "gpuPodCost"/.test(rd("static", "podsdock.js")));
  const ix = rd("static", "index.html");
  check("index.html loads runpoddock.js after podsdock.js", ix.indexOf("/static/runpoddock.js") > ix.indexOf("/static/podsdock.js") && ix.indexOf("/static/podsdock.js") > 0);

  /* ---- docking + the order */
  const Z = require("../static/floatz.js");
  check("floatz layered: the dockers under the floating dialogs, each layer in the order used", JSON.stringify(Z.layered(["c", "D", "b", "E"], (x) => /[A-Z]/.test(x))) === JSON.stringify(["D", "E", "c", "b"]));
  const FZ = rd("static", "floatz.js");
  check("floatz raise: the floating ones not raised yet join the order, then painted layered", /if \(!stack\.includes\(w\) && !ws\.includes\(w\) && floating\(w\)\) stack\.unshift\(w\)/.test(FZ) && /layered\(stack, tierOf\)\.forEach/.test(FZ) && Z.SEL.includes(".h3fp.h3fp-dk"));
  const FP = rd("static", "floatpanels.js");
  check("floatpanels: a named docker is .h3fp-dk, in the band (60, not 9300 when confined); dockerAt(x, y, id) for the others", /\+ "\.h3fp\.h3fp-dk\{z-index:60\}"/.test(FP) && /function dockerAt\(x, y, id\)/.test(FP) && /zoneMark: \(line\) => marker\(line\), dockerAt,/.test(FP));
  check("dgdock: Basic Settings / PODS / … go into the named docker under them (dockerAt), not only ▣ ones", /const did = P\(\)\.dockerAt \? P\(\)\.dockerAt\(x, y, id\) : null;/.test(rd("static", "dgdock.js")));
  check("dockgroup: a main docker's title bar dragged goes into any named docker too (intos)", /const intos = \(\) =>/.test(rd("static", "dockgroup.js")) && /for \(const r of intos\(\)\)/.test(rd("static", "dockgroup.js")));

  /* ---- custom nodes: packed a file at a time, progress, no venvs, a size cap */
  const PN = require("../lib/podNodes");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pn7635-")), pk = path.join(tmp, "MyPack");
  fs.mkdirSync(path.join(pk, "venv", "lib"), { recursive: true }); fs.writeFileSync(path.join(pk, "venv", "pyvenv.cfg"), "home=x"); fs.writeFileSync(path.join(pk, "venv", "lib", "big.py"), "x".repeat(1000));
  fs.mkdirSync(path.join(pk, "models")); fs.writeFileSync(path.join(pk, "models", "w.safetensors"), Buffer.alloc(300000, 7));
  fs.writeFileSync(path.join(pk, "__init__.py"), "NODE_CLASS_MAPPINGS = {}\n".repeat(50));
  const sc = PN.scanPack({ folder: "MyPack", local: pk });
  check("scanPack: no Python environment inside (pyvenv.cfg), the code + the weights, weights stored not deflated", sc.files.length === 2 && !sc.files.some((f) => /venv/.test(f.name)) && sc.files.find((f) => /safetensors/.test(f.name)).deflate === false && sc.files.find((f) => /__init__/.test(f.name)).deflate === true && sc.skipped === 1, sc.files.map((f) => [f.name, f.deflate]));
  const ticks = [];
  const zb = await PN.zipOf({ folder: "MyPack", local: pk }, (i, n) => ticks.push(i + "/" + n));
  const U = require("../lib/unzip"), ents = U.entries(zb).map((e) => e.name).sort();
  check("zipOf: a Promise, a file at a time (ticks), unpacks to MyPack/…", ticks.join(",") === "1/2,2/2" && JSON.stringify(ents) === JSON.stringify(["MyPack/__init__.py", "MyPack/models/w.safetensors"]), { ticks, ents });
  const back = U.read(zb, U.entries(zb).find((e) => e.name === "MyPack/__init__.py"));
  check("…the deflated file comes back as it was", back && back.toString() === "NODE_CLASS_MAPPINGS = {}\n".repeat(50));
  check("zipWrite: Node's own crc32 when there is one (same answer as the table)", require("../lib/zipWrite").crc32(Buffer.from("bitGen")) === 0x5cfa3b7f || require("../lib/zipWrite").crc32(Buffer.from("bitGen")) === (require("zlib").crc32 ? require("zlib").crc32(Buffer.from("bitGen")) >>> 0 : -1));
  const PNs = rd("lib", "podNodes.js");
  check("runItems: its size + packing i/n + part i of n in the log; over H3_POD_NODE_MAX (2 GB) = not uploaded, the reason given",
    /packing " \+ i \+ "\/" \+ n \+ " files"/.test(PNs) && /"part " \+ \(i \+ 1\) \+ " of " \+ n/.test(PNs) && /H3_POD_NODE_MAX \|\| 2 \* 1024 \* 1024 \* 1024/.test(PNs) && /too big to upload/.test(PNs));
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
