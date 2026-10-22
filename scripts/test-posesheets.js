// bitGen Studio — 2.577.0 units: the pose sheets are the user's own pictures in <install>/pose_sheets/
// (lib/poseSheets.js), the Character creator picks one in a thumbnail dialog (ext/videodock/posepick.js) instead of
// the old dropdown, and sheetgen uses the pick (routes/characters.js). The six built-in templates are gone.
// Tim: "delete the pose sheets, they are crap. can we add a folder to the app for pose_sheets. i will save pose
// sheets to that folder. in the character editor/creator remove the pose dropdown and add a dialog with thumbnails
// of the pose sheets in the folder and use the selected one for the poses". Run: node scripts/test-posesheets.js
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const PS = require(path.join(ROOT, "lib", "poseSheets"));
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { console.log("PASS: " + name); pass++; }
  else { console.log("FAIL: " + name + (extra !== undefined ? " -> " + JSON.stringify(extra).slice(0, 600) : "")); fail++; }
}

const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg577ps-"));
try {
  PS.setBase(T);
  const D = path.join(T, "pose_sheets");
  check("dir(): <install>/pose_sheets, made on first use", PS.dir() === D && fs.existsSync(D));
  check("an empty folder: no pose sheets", PS.list().length === 0);
  const png = fs.readFileSync(path.join(ROOT, "scripts", "fixtures", "sample-person.png"));
  fs.writeFileSync(path.join(D, "Turnaround 10.png"), png);
  fs.writeFileSync(path.join(D, "Turnaround 2.jpg"), png);
  fs.writeFileSync(path.join(D, "notes.txt"), "not a picture");
  fs.writeFileSync(path.join(D, ".hidden.png"), png);
  fs.mkdirSync(path.join(D, "animals"));
  fs.writeFileSync(path.join(D, "animals", "horse.webp"), png);
  const L = PS.list();
  check("list(): every picture (png / jpg / webp), sub-folders as folder/name, not other files or hidden ones; numbers sort naturally",
    JSON.stringify(L.map((x) => x.id)) === JSON.stringify(["Turnaround 2.jpg", "Turnaround 10.png", "animals/horse.webp"])
    && L[2].folder === "animals" && L[2].name === "horse" && L[0].size === png.length && L[0].mtime > 0, L);
  check("file(): a picture inside the folder -> its path",
    PS.file("Turnaround 10.png") === path.join(D, "Turnaround 10.png") && PS.file("animals/horse.webp") === path.join(D, "animals", "horse.webp") && PS.file("animals\\horse.webp") === path.join(D, "animals", "horse.webp"));
  check("file(): traversal, absolute paths, non-pictures, missing files and \"none\" -> null",
    PS.file("../x.png") === null && PS.file("animals/../../x.png") === null && PS.file("/etc/passwd.png") === null && PS.file("C:/x.png") === null
    && PS.file("notes.txt") === null && PS.file("gone.png") === null && PS.file("none") === null && PS.file("") === null && PS.file(null) === null);
  const pk = PS.pick("animals/horse.webp");
  check("pick(id): {id, name, file}; \"\" / \"none\" / unknown -> null (no guessing - the user picks)",
    pk && pk.id === "animals/horse.webp" && pk.name === "horse" && pk.file === path.join(D, "animals", "horse.webp")
    && PS.pick("") === null && PS.pick("none") === null && PS.pick("human") === null, pk);
} finally { PS.setBase(null); fs.rmSync(T, { recursive: true, force: true }); }

check("the built-in templates are gone (static/pose-sheets/, scripts/make_pose_sheets.py)",
  !fs.existsSync(path.join(ROOT, "static", "pose-sheets")) && !fs.existsSync(path.join(ROOT, "scripts", "make_pose_sheets.py")));

const PP = require(path.join(ROOT, "ext", "videodock", "posepick.js"));
check("posepick label(): the button names the pick", PP.label("") === "🧍 No pose sheet" && PP.label("animals/horse front.png") === "🧍 horse front");
check("posepick filter(): every search word in the folder / name",
  PP.filter([{ id: "animals/horse.png" }, { id: "human/turn.png" }], "ANI hor").map((x) => x.id).join() === "animals/horse.png" && PP.filter([{ id: "a.png" }], "").length === 1);

const RS = rd("routes", "poseSheets.js"), IX = rd("routes", "index.js"), RC = rd("routes", "characters.js");
check("routes/poseSheets.js: GET /api/pose-sheets, /file, POST /open - mounted from routes/index.js (not server.js)",
  /app\.get\("\/api\/pose-sheets"/.test(RS) && /app\.get\("\/api\/pose-sheets\/file"/.test(RS) && /app\.post\("\/api\/pose-sheets\/open"/.test(RS)
  && /require\("\.\/poseSheets"\)\.mount\(app\)/.test(IX) && !/poseSheets/.test(rd("server.js")));
check("sheetgen: the creator's pick (b.pose) is the pose sheet; the prompt names no fixed panels",
  /const pose = poseSheets\.pick\(b\.pose\);/.test(RC) && /The first picture is a pose sheet/.test(RC) && !/line-drawing pose template/.test(RC));
const DH = rd("ext", "videodock", "dock.html"), EJ = JSON.parse(rd("ext", "videodock", "ext.json"));
check("the creator: no pose dropdown - the 🧍 Pose sheet button + hidden #chOptPose; posepick.js loads after characters.js",
  !/<select id="chOptPose"/.test(DH) && /<input type="hidden" id="chOptPose"/.test(DH) && /id="chPoseBtn"/.test(DH)
  && EJ.scripts.indexOf("posepick.js") === EJ.scripts.indexOf("characters.js") + 1);
const PJ = rd("ext", "videodock", "posepick.js");
check("the dialog: thumbnails of /api/pose-sheets, No pose sheet, 📂 Open folder, ↻ Refresh, ✔ Use / double click; the pick remembered",
  /\/api\/pose-sheets\/file\?id=/.test(PJ) && /No pose sheet/.test(PJ) && /\/api\/pose-sheets\/open/.test(PJ) && /pdRefresh/.test(PJ) && /ondblclick/.test(PJ) && /h3\.poseSheet/.test(PJ));
const GI = rd(".gitignore"), MZ = rd("scripts", "make_zips.sh");
check("pose_sheets/ is the user's (never in a commit or a release zip)", /^pose_sheets\/$/m.test(GI) && /! -path "\.\/pose_sheets\/\*"/.test(MZ));

console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
