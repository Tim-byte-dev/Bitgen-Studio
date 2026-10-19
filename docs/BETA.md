# bitGen Studio — the public beta (since 2.477.0)

Thank you for trying bitGen Studio. This page says what to expect from the beta and how to tell us what went wrong.

## What "beta" means here

**bitGen Studio is still in testing.** Expect rough edges, and please tell us about them. **Bug reports and
improvements are welcome**: an issue, a pull request, or just an idea.

- **Built and covered by tests, lightly travelled.** Every feature in the [Feature Reference](bitGen-Studio-Features.pdf)
  is built and covered by the automated suite: more than 1,500 unit and real-browser tests
  (`bash scripts/e2e-stub-test.sh`), run against stand-in ComfyUI, LLM and Unreal servers. Real hardware, real models
  and real projects will still find things the tests do not.
- **Your projects are yours.** Everything lives in `projects/<name>/` on your disk. Keep a copy of anything that matters
  before you update, because a beta can change a file format. Every change so far has been backwards compatible.
- **Updates**: download a newer release or `git pull`, then run `start.bat` / `bitgen-studio.sh` again. Your `custom.settings`,
  projects, models and styles are never in the repository, so an update does not touch them.

## Tested on real hardware

The developer has used these end to end on a real GPU with real models, and they work:

| Area | What was tested |
|---|---|
| **🧩 Model manager** | The model and LoRA cards, search and filters, Civitai downloads into each type's folder, a new style from a model |
| **🖼️ Image generation** | Every built-in image style |
| **🎬 Video generation** | Rendering video through ComfyUI |
| **🎵 Music** | Song generation |

## Built, but not yet tested enough

These are built and pass the automated tests, but they have **not yet had enough use with real projects**. Reports
here help the most:

| Area | What to try |
|---|---|
| **🖌️ The image editor** | Layers, masks, selections, painting, type, paths, filters, PSD / PDF / .bgi files, ✨ AI generate / fill / edit |
| **🎞️ The timeline** | Cutting and trimming, keyframes, effects and grading, masks and tracking, captions, exports (FCP7 XML, FCPXML, AAF) |
| **📐 CAD** | Sketches with constraints, DXF / SVG, parametric 3D bodies (OpenCascade in the browser, or Blender) |
| **🏠 The house builder** | Plans, furniture, the 3D view, camera shots and 360° locations, ✨ Make it real |
| **🧊 Blender layers and the Blender bridge** | 3D layers, the add-on, renders made real with the reference docker's pictures |

## Experimental: please report what you see

| Area | Why it is experimental |
|---|---|
| **Unreal Engine 5.8 bridge** (`ue/bitGenBridge`, plugin 1.3.0) | It was written from Unreal 5.8's Python API and tested against a stand-in server, **not inside a real Unreal Editor**. Stills, MRQ renders, MetaHumans, the camera (lens, f-stop, exposure) and the lights and fog may need fixes for your project. If a command fails, send us the `[bitGen Bridge]` lines from Unreal's Output Log. |
| **Daz Studio live link** | Its script was written from Daz's scripting documentation and has had little real use. |
| **Transparent Unreal renders** | These need *Enable alpha channel support in post processing* in your Unreal project. Some projects give inverted alpha; Settings ▸ 3D ▸ "alpha is inverted" fixes that. |
| **macOS** | The studio runs, but MiniMax H3 video needs NVIDIA CUDA. |

## Reporting a problem

Open an issue with the **Bug report** template. The quickest way to gather everything is the app's own **🐞 bug
report** (press **Ctrl+Alt+Shift+B**, or Settings ▸ General ▸ 🐞 Report a bug…). It takes a screenshot, collects the
logs, your system details and settings (every key and token hidden) and the steps you took, and saves them as one
`bitgen-<id>.zip`. Attach that file to the issue.

Whether you use it or not, these help us most:

1. **The version** (the `"version"` line in `package.json`, or the release you downloaded) and your OS / GPU.
2. **What you did, what you expected, what happened**: a screenshot or a short screen recording is ideal (the app can record its own window).
3. **The Console docker's last lines** (or `logs/`), and for the Unreal bridge, Unreal's Output Log.
4. **Leave out** your `custom.settings` (it has your folders and tokens) and any private pictures.

Ideas and wishes are welcome too: use the **Feature request** template.
