# Contributing to bitGen Studio

## Pushing (maintainer)

`misc\push-to-github.bat` (Windows): double-click it to commit what changed in this folder and push it to `origin` /
`main`, or drag a `bitgen-studio-v<version>-repo.zip` onto it to replace the repo files with that release first. It
never force-pushes and never commits the private release notes.

## Helping test the beta

bitGen Studio is a **beta and still in testing**, so the most useful help right now is using it and telling us what
happens. **Bug reports and improvements are welcome.**

- **Found a bug?** Open an issue with the **Bug report** template and attach the app's 🐞 bug report zip
  (Ctrl+Alt+Shift+B). [docs/BETA.md](../docs/BETA.md#reporting-a-problem) says what to include.
- **The areas that need testing most** are the image editor, the timeline, CAD and the house builder (built and passing
  the automated tests, but little real-world use yet), and the Unreal and Daz bridges (experimental).
- **Have an idea?** Use the **Feature request** template.
- **Want to fix something?** Pull requests are welcome; the rest of this page explains how the code and tests work.

## Running it from the repository

```
git clone <this repo> bitgen-studio
cd bitgen-studio
start.bat                 # Windows  (misc/bitgen-studio.sh on Linux / macOS)
```

The first start installs the Node packages and the Python environment. ComfyUI, the node packs and the models come
from Settings ▸ ComfyUI and the setup wizard. Development needs Node.js 18+, Python 3.10+, Git and ffmpeg. The unit tests need Node.js 22.22+ (or 24.15+): their
DOM library, jsdom, does not run on older versions.

## How the code is laid out

- `misc/server.js` stays minimal: **every endpoint lives in `routes/<area>.js`**, mounted from `routes/index.js`, and the work
  lives in `lib/<area>.js`. If no helper fits, make a new one rather than growing `server.js`.
- Each **docker is an extension** in `ext/<id>/` (`ext.json` lists its scripts in load order). The image editor is
  `ext/imageeditdock/` (`imageedit.js` is the core; `pc*.js` are its modules, installed in order). The timeline is
  `ext/timelinedock/`.
- Modules shared by several dockers live in `static/`, for example `static/cadbar.js`, `static/body3d.js`,
  `static/unreal.js` and `static/uerig.js`. Third-party browser libraries go in `static/vendor/` with their licence files
  beside them, and are never loaded from the internet.
- Python workers (`misc/*_worker.py`) drive ComfyUI over its API. The bridges are `blender/`, `daz/` and `ue/`.
- Each module starts with a header comment: what it is for, the user's request it answers, and its API. Keep these up
  to date, and keep the pure parts (maths, parsing, planning) testable in Node.

## Tests

```
bash scripts/ci-units.sh            # the quick unit subset (what GitHub Actions runs)
node scripts/test-<area>.js         # one area's unit test
bash scripts/e2e-stub-test.sh       # everything: unit + real-browser tests against stub servers (an hour or more)
```

Browser tests need Playwright with Chromium (`npm i -g playwright && npx playwright install chromium`). They
skip themselves without it. Every feature ships with a unit test (`scripts/test-<area>.js`) and, if it has a UI, a
browser test (`scripts/test-<area>-ui.js`), and both are added to `scripts/e2e-stub-test.sh`.

## Documentation

When you add a feature, update `docs/USAGE.md` (the user guide and the Guide PDF), the help pages in `static/help/`, and
`docs/FEATURES.md` (the Feature Reference PDF: one bullet per feature). Rebuild the PDFs with
`python3 scripts/make_guide_pdf.py` and `python3 scripts/make_features_pdf.py`. In anything the user sees, name
features generically rather than after other companies' products: `scripts/test-brandnames.py` checks this.

## Pull requests

Keep a pull request to one feature or fix. Include its tests, and say how you checked it.
