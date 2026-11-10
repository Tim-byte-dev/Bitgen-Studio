# bitGen Studio — handover notes (v2.755.0, 2026-11-10 — CONTINUATION
# PACKAGE: flat zip + workflows zip + ext zips; npm ci; chmod +x
# scripts/*.sh scripts/*.py worker.py;
# pip install soundfile cairosvg pyaaf2 --break-system-packages; gate =
# bash scripts/e2e-stub-test.sh at ZERO failures (1863 legs — the 898 of
# 2.288 + segmap suite + LIVE from-segments (2.289) + refmap suite + five
# LIVE native-audio legs (2.290) − the four OBVPM legs + the OBVPM-removed
# leg + the scenetimeline suite + the LIVE timeline-flag leg (2.291) +
# the nativeaudio suite + three LIVE mode legs (2.292) + the autorender
# suite + five LIVE as-written legs (2.293) + the mvwriter suite + four
# LIVE music-video writer/render legs (2.294) + the scenecards suite +
# five LIVE scene-card legs (2.295) + the contmode suite + two LIVE Cont
# legs (2.296) + the sceneinsert suite + five LIVE insert/frames/timing
# legs (2.297) + the projectmedia suite + four LIVE media-scan legs
# (2.298) + the globalprompt suite + three LIVE legs (2.299) + the scenetype
# suite (2.299.2) + the clipstart suite (2.300.0) + the filmstrip suite
# (2.300.1) + the rawmaster py + app suites + four LIVE lossless-master
# legs (2.301.0) + the trimfirst suite + two LIVE trim legs (2.302.0) + the
# loadprecision suite + two LIVE load-precision legs (2.303.0) + the
# expertmode suite (2.304.0) + the cntypes suite + three LIVE ControlNet
# legs (2.305.0) + the typefix suite (2.306.0) + the redotake suite + the
# LIVE redo-name leg (2.307.0) + the jobfinish + fetchall suites (2.308.0)
# + the rendersettings + upscalestage suites + the LIVE ⚙ leg (2.312.0)
# + the tailframes + tailpngs suites + two LIVE tail-PNG legs (2.313.0)
# + the LIVE SeedVR2 tail leg (2.314.0)
# + the takeupscale suite + two LIVE take-upscale legs (2.315.0)
# + the cnbasic + cnstage suites + four LIVE ControlNet legs (2.316.0)
# + the LIVE second-model refusal leg (2.317.0)
# + the LIVE inline-settings ControlNet leg (2.318.0)
# + two LIVE final-image-only legs (2.320.0)
# + two LIVE second-model-prompt legs (2.321.0)
# + the facefix suites + four LIVE face-fix legs (2.322.0)
# + the scriptboard + nosong suites + four LIVE no-song / Scenes / film-writer legs
#   − the old no-song refusal leg (2.323.0)
# + the swap app + graph suites + six LIVE swap legs (2.324.0)
# + the refselect suite + two LIVE reference-selection legs (2.325.0)
# + the filedialog + fdlg-helper suites + four LIVE file-dialog legs (2.326.0)
# + the assetgroups suite + four LIVE asset-group / delete legs (2.327.0)
# + three LIVE mmh3_chr_swap style legs (2.328.0)
# + the swapdlg suite + four LIVE swap-dialog legs (2.329.0)
# + the vrswap suite + three LIVE load / VR legs (2.330.0)
# + the setup suite (2.331.0)
# + the aiedit suite + the browser editor test + nine LIVE /api/aiedit legs (2.332.0)
# + five LIVE control-layer legs (2.333.0)
# + swap-identity checks folded into the swap legs (2.334.0)
# + the swapprompt suite + two LIVE ✎ Write prompt legs (2.335.0)
# + one LIVE swap-quality leg (2.336.0)
# + the sceneedit suite + two LIVE ✎ First frame legs (2.337.0)
# + the ltx + ltxgraph suites + three LIVE LTX legs (2.338.0)
# + the rippleswap suite + four LIVE Ripple legs (2.339.0)
# + the refroles suite + two LIVE qwen2_1 legs (2.340.0)
# + the hfcli suite + one LIVE model-catalog leg (2.341.0)
# + the rippleflow + swapsettings suites + the LIVE ⚙ leg (2.342.0)
# + the rippleauto suite + two LIVE auto-render / reason legs (2.343.0)
# + the viggle + viggleswap suites + two LIVE Viggle legs (2.344.0)
# + the modelmatch suite (2.345.0)
# + the LAST leg: the queue's 🧹 Clear in a browser (2.346.0)
# + the swappreview suite (2.347.0)
# + the ffcands + blackcheck suites + LIVE candidates + LIVE black-take legs (2.348.0)
# + two LIVE Viggle safe-mode legs (2.350.0)
# + the viggle-native py + js suites + three LIVE Viggle (native) legs (2.351.0)
# + the native py + js suites (replacing viggle-native, Viggle scope) + two LIVE Viggle (native) legs
#   + the h3viggle py + js suites + five LIVE H3_Viggle legs (2.352.0)
# + the components suite + the LIVE start-check leg + the refslots suite + two LIVE reference-slot legs (2.353.0)
# + the refcontext suite + the LIVE reference-dock chat leg (2.354.0)
# + setup / components checks folded into their suites (2.355.0)
# + the scenelyrics suite (2.356.0)
# + the basicsize suite + the LIVE Basic Settings size leg (2.357.0)
# + the scenebridge suite + three LIVE bridge legs (2.358.0)
# + the saveas suite + the LIVE save-as leg (2.359.0)
# + the sfx suite + the LIVE SFX leg (2.360.0; 2.361.0 extends both)
# + the voicestyle suite (2.363.0) + the LIVE prompt-speech leg (2.364.0)
# + the truecfg suite + the LIVE true-cfg leg (2.366.0)
# + the screencap suite + the LIVE browser screencap leg under xvfb-run (2.367.0)
# + the LIVE Wan leg + the LIVE VR World leg + the wangraph / wan / vrworld py + js suites (2.368.0)
# + the LIVE chat-clear leg + the chattitle suite (2.370.0)
# + the freshproject suite + two LIVE fresh-new-project legs (2.371.0)
# + the projectsave suite + four LIVE save / save-as / open legs (2.372.0)
# + the karaoke suite + the LIVE song-lyrics leg + five LIVE karaoke legs (2.373.0)
# + the recyclebin-dlg suite + six LIVE recycle bin / reset legs (2.374.0)
# + the basicoverride suite + two LIVE Override-style board legs (2.375.0)
# + the basicsteps browser test (2.375.1) + the timeline nudge browser test (2.376.0)
# + the cliptransform suite + the timeline canvas browser test (2.377.0)
# + the projectreset + tempupload suites (2.378.0)
# + the keyframes suite + the keyframes browser test (2.379.0) + the h3keyframefit suite (2.379.1)
# + the h3fitup + karaokestyle + tlfill suites + the timeline 2.380 browser test (2.380.0)
# + the dockstatus suite + 3 docker_status HTTP legs + the docker status browser test (2.381.0)
# + the m3d suite + the 3D layers browser test (2.382.0) + the menu bar browser test (2.382.1) + the timeline marker browser test (2.383.0)
# + 2 job-metadata HTTP legs + the jobmeta suite + the render details browser test (2.384.0)
# + the pin resize browser test (2.384.1)
# + the Blender maths + the Blender bridge suite + the 3D tools browser test (2.385.0)
# + the statusbar / 3D toolbar browser test (2.386.0)
# + the Wan ATI graph + the path layers suite + the path layers browser test (2.387.0)
# + the Append / Prepend join + the frame-op suite + the frame-op browser test (2.388.0)
# + the Photoshop editor + floating prompt suite + the editor browser test + the floating prompt browser test (2.389.0)
# + the Segment Anything / Compose / PSD suite + its browser test (2.390.0)
# + the video docker info line / live mask browser test (2.391.0) + the PDF guide test (2.391.1)
# + the docker.cfg suite + its browser test (2.392.0)
# + the floating settings / bitGen editor suite + its browser test (2.393.0)
# + the + add tiles suite + its browser test (2.394.0)
# + the Append / Prepend fl2va + LLM suite (LIVE chat / Enhance) + its browser test (2.395.0)
# + the image editor colours / Paint Bucket suite + its browser test (2.396.0)
# + the image editor type / styles / filters suite + its browser test (2.397.0)
# + the dockable panels suite + its browser test (2.398.0)
# + the camera path suite (LIVE) + its worker suite (LIVE Wan) + its browser test (2.399.0)
# + the SeedVR2 / queue card suite (LIVE job on the stub) + its worker suite (LIVE) + its browser test (2.400.0)
# + the style card / ⏫ Enhance suite (LIVE) + its browser test (2.401.0)
# + the workflow media cleaner suite (2.401.1)
# + the core Math Expression migration suite (2.401.2)
# + the node swap suite + the live progress suite (LIVE Wan) (2.401.3)
# + the left docker inline browser test (2.401.4)
# + the ltxofficial suite + the LIVE official-template leg (2.401.5)
# + the ltx23 + blenderscene suites, the LTX 2.3 browser test, the LIVE Blender -> 3DREAL leg (2.402.0)
# + the frontend-parity suite (2.402.1)
# + the blendview suite + the .blend preview browser test (2.403.0)
# + the sceneplan + blendbuild suites, the LIVE scene-AI suite + its browser test (2.404.0)
# + the Daz bridge script suite + the Daz merge browser test (2.405.0)
# + the clip fx / mix / captions units + their LIVE compile suite + their browser test (2.406.0)
# + the colour / edit tools / export queue / exchange units + LIVE suite + browser test (2.407.0)
# + the transcript / scene cuts / karaoke words units + LIVE suite + browser test (2.408.0)
# + the Override-for-every-model + effects / adjustment units + LIVE suite + browser test (2.409.0)
# + the stage dockers / Space / markers / keys / In-Out / frame units + LIVE suite + browser test (2.410.0)
# + the text effect presets units + browser test, the shuttle / AV1 / 10-bit / graphics-card units + LIVE suite + browser test (2.411.0)
# + the Premiere smaller-jobs units + LIVE suite + browser test (2.412.0)
# + the Premiere partly-done units + LIVE suite + browser test (2.413.0)
# + the Premiere medium-jobs units + LIVE suite + browser test (2.414.0)
# + the Premiere medium-jobs 2 units + LIVE suite + browser test (2.415.0)
# + the Premiere bigger-rows units + LIVE suite + browser test (2.416.0)
# + the Premiere bigger-rows 2 units + LIVE suite + browser test (2.417.0)
# + the real-time playback units + LIVE suite + browser test (2.418.0)
# + the one-prompt-docker / negative prompt units + LIVE suite + browser test (2.419.0)
# + the AI-in-the-timeline units + LIVE suite + browser test, the GPU compositor units + browser test (2.420.0)
# + the pen / paths / vector masks units + browser test (2.421.0)
# + the smart objects / transforms units + browser test (2.422.0)
# + the selection / retouching units + browser test (2.423.0)
# + the PDF units + browser test (2.424.0)
# + the vector line units + browser test (2.425.0)
# + the type panel units + browser test (2.426.0)
# + the actions units + browser test (2.427.0)
# + the CorelDRAW drawing tool units + browser test (2.428.0)
# + the docker units + browser test (2.429.0)
# + the documents / palette units + browser test (2.430.0)
# + the editor / prompt docker units + browser test (2.431.0)
# + the themes / docker layout units + browser test (2.432.0)
# + the karaoke nudge units + browser test (2.433.0)
# + the gradient editor / layer comps / smart blend units + browser test (2.434.0)
# + the saved themes / PDF fonts units + browser test (2.435.0)
# + the project files (.bgi / .bgv / .bgp) units + browser test (2.436.0)
# + the generate fill in shape / mask + pattern library units + browser test (2.437.0)
# + the floating / named dockers + dialog places units + browser test (2.438.0)
# + the property bar units + browser test (2.439.0)
# + the rulers / guidelines / snapping units + browser test (2.440.0)
# + the CAD dimensions units + browser test (2.441.0)
# + the frames (PowerClip) units + browser test (2.442.0)
# + the edit theme mode units + browser test (2.443.0)
# + the prompt docker link + editor settings units + browser test (2.444.0)
# + the grids units + browser test (2.445.0)
# + the timeline rulers / guidelines units + browser test (2.446.0)
# + the artboards units + browser test (2.447.0)
# + the content-aware fill workspace units + browser test (2.448.0)
# + the per-character type units + browser test (2.449.0)
# + the warp grid / liquify extras units + browser test (2.450.0)
# + the quick prompts / Del / prompt link units + browser test (2.451.0)
# + the move tool handles units + browser test (2.452.0)
# + the frames 2 units + browser test (2.453.0)
# + the panel column docker units + browser test (2.454.0)
# + the theme edit + dialogs units + browser test (2.455.0)
# + the storyboard units + browser test (2.456.0)
# + the dimension group units + browser test (2.457.0)
# + the auto / floorplan / chain dimension units + browser test (2.458.0)
# + the product names check (2.459.0)
# + the 3D layer units + Blender test + browser test (2.460.0)
# + the timeline pose units + Daz live link + browser test (2.461.0)
# + the sketch layer units + browser test (2.462.0)
# + the sketch modify units + browser test (2.463.0)
# + the sketch CAD units + browser test (2.464.0)
# + the puppet pin + patch units + browser test (2.465.0)
# + the OpenType + round corner units + browser test (2.466.0)
# + the channel units + browser test (2.467.0)
# + the actions extra units + browser test (2.468.0)
# + the linked smart object + .atn units + browser tests (2.469.0)
# + the CAD toolbar + picking units + browser test (2.470.0)
# + the 3D body units (core + OpenCascade, layer + server + Blender) + browser test (2.471.0)
# + the Unreal bridge units + browser test (2.472.0)
# + the Feature Reference PDF test (2.473.0)
# + the selection box units + browser test (2.474.0)
# + the Unreal camera units + browser test (2.475.0)
# + the Unreal lights units + browser test (2.476.0)
# + the GitHub repository checks (2.477.0)
# + the dropdown search units + browser test (2.478.0)
# + the JPEG XL units + browser test (2.479.0)
# + the adjustments round A units + browser test (2.480.0)
# + the filters round B units + browser test (2.481.0)
# + the develop round C units + browser test (2.482.0)
# + the panels + measuring units + browser test (2.483.0)
# + the brush settings units + browser test (2.484.0)
# + the file types units + browser test (2.485.0)
# + the align + blend units + browser test (2.486.0)
# + the image modes units + browser test (2.487.0)
# + the select subject units + browser tests (2.488.0)
# + the graph editor units + browser test (2.489.0)
# + the parenting units + browser test (2.490.0)
# + the blend + matte units + browser test (2.491.0)
# + the shape layer units + browser test (2.492.0)
# + the text animator units + browser test (2.493.0)
# + the CAD workings units + browser test (2.494.0)
# + the colour blend modes + video parenting units + browser test (2.495.0)
# + the merge paths / freehand / text on a path / roving units + browser test (2.496.0)
# + the expression units + browser test (2.497.0)
# + the mask units + browser test (2.498.0)
# + the tracking units + browser test (2.499.0)
# + the time effects units + browser test (2.500.0)
# + the time remap units + browser test (2.501.0)
# + the FLUX 3 Klein units + edit image mode browser test (2.502.0)
# + the Long video units + browser test (2.503.0)
# + the DLSS 5 units + browser test (2.504.0)
# + the generator / distort units + browser test (2.505.0)
# + the particles / rays units + browser test (2.506.0)
# + the warp units + browser test (2.507.0)
# + the audio units + browser test (2.508.0)
# + the motion units + browser test (2.509.0)
# + the 3D units + browser test (2.510.0)
# + the data / feather units + browser test (2.511.0)
# + the Lottie units + browser test (2.512.0)
# + the UE project / frame units + browser test (2.513.0)
# + the theme layout / dockers units + browser test (2.514.0)
# + the scene tools units + browser test (2.515.0)
# + the keys / Krea 2 units + browser test (2.516.0)
# + the power / Anima units + browser test (2.517.0)
# + the queue / model manager / testing units + browser test (2.518.0)
# + the hardware / package units (2.519.0)
# + the LoRA / peak + usage / Remote GPU / packages units + browser test (2.520.0)
# + the fine-tune units + browser test (2.521.0)
# + the bug report units + browser test (2.522.0)
# + the loader swap units (2.523.0)
# + the house builder units + browser test (2.524.0)
# + the model relocation units (2.525.0)
# + the workspace units + browser test (2.526.0)
# + the style doctor units + browser test (2.527.0)
# + the people units + browser test (2.528.0)
# + the house extras units + browser test (2.529.0)
# + the palette units + browser test (2.530.0)
# + the anima units (2.531.0)
# + the self-ticking test list / title bar / walking camera units + browser test (2.532.0)
# + the dropdown-in-a-dialog browser test (2.533.0)
# + the test mode / coach / preview-follow units + browser test (2.534.0)
# + the flux3 units (2.535.0)
# + the veda units + render + browser test (2.536.0)
# + the model manager units + browser test (2.537.0)
# + the model folders units + browser test (2.538.0)
# + the reference units + browser test (2.539.0)
# + the realrefs units + browser test (2.540.0)
# (2.540.1: no new legs - unit-test fixes + the public repo)
# + the setup node-pack units (2.540.2)
# + the model-fit units (2.540.3)
# + the add-ons units + browser test (2.540.4)
# + the updater units + browser test (2.540.5)
# + the yue2 runner units (2.540.6)
# + the theme-edit page guard units + the handle-drag browser test (2.540.6)
# + the push-to-github.bat checks (2.540.6)
# + the yue2 attention units (2.540.7)
# (2.540.8: no new legs - test-repo.py checks the new workflow)
# (2.540.9: test-pushbat5406.js grew to 12)
# + the image ops units + browser test (2.541.0)
# + the Blender layer units + browser test (2.542.0)
# + the image ops by source units + browser test (2.543.0)
# + the theme hidden-in-Expert units + browser test (2.544.0)
# + the ▣ Docker units + browser test (2.545.0)
# + the scene + references units + browser test (2.546.0)
# + the picked layers + built-in styles units + browser test (2.547.0)
# + the references kept units + browser test (2.548.0)
# + the 2.549.0 units + browser test (▣ Docker, Krea 2, drops, Ctrl+G)
# + the 2.550.0 units + browser test (seamless fill, rig pick, transform, docker menu)
# + the 2.551.0 units + browser test (skew handles, the Krita-like fill)
# + the 2.552.0 units + browser test (the fill / Edit from the Krita plugin's code)
# + the 2.553.0 units + browser test (fill with the edit model; Edit keeps to the selection)
# + the 2.554.0 units + browser test (Generate fits the selection)
# + the 2.555.0 units + browser test (the Krita AI plugin's fill per model family)
# + the 2.556.0 units + browser test (⏳ Pending, references in every ✨ mode)
# + the 2.557.0 units + browser test (Settings ▸ Add-ons ▸ AI fill models)
# + the 2.558.0 units + browser test (▣ dockers in the floating band; side dockers dragged in)
# + the 2.559.0 units + browser test (folder filters remember their folder; Basic Settings in basic.cfg)
# + the 2.560.0 units + browser test (the ▣ docker docks by drop zones; Basic Settings / LLM tokens / the prompt docker go in it)
# + the 2.561.0 units + browser test (a ▣ docker dropped between two columns = a column of its own)
# + the 2.562.0 units + browser test (a resumed job comes back to its StoryBoard scene; nothing plays by itself)
# + the 2.563.0 units + browser test (pictures from other scenes; ✎ 🅰 Picture A; 🤖 Write)
# + the 2.564.0 units + browser test (🎙 voice chat)
# + the 2.565.0 units + browser test (the StoryBoard grid; 🎞 Write storyboard)
# (2.565.1: the GitHub CI fix - no new leg)
# + the 2.566.0 units + browser test (MOSS-Image)
# + the 2.567.0 units + browser test (theme editor alignment / spacing)
# + the 2.568.0 units + browser test (StoryBoard pictures by the LLM)
# + the 2.569.0 units + browser test (🔲 zones in the image editor)
# + the 2.570.0 units + browser test (🖊 pen tablet)
# + the 2.571.0 units + browser test (multi-select drag, ⛓ Sequential)
# + the 2.572.0 units + browser test (✨ Auto transition, 🔇 Video sound)
# + the 2.573.0 units + browser test (✂ cut duration, ⤓ Update ComfyUI, startup check, FastH3 Omni)
# + the 2.574.0 units + browser test (theme edit words, step n of total everywhere)
# + the 2.574.1 units + browser test (theme edit: This element only)
# + the 2.575.0 units + browser test (model manager files / stars / type / NSFW, To prompt, Civitai chip, layout restore)
# + the 2.576.0 units + browser test (sync by SHA-256, To model…, Ctrl+↓ thumbnail)
# + the 2.577.0 units + browser test (pose_sheets folder + the 🧍 Pose sheet dialog)
# + the 2.578.0 units + browser test (the 📐 SolidCraft docker)
# + the 2.579.0 units + browser test (sends, model delete, Settings ▸ Dockers)
# + the 2.580.0 units + browser test (📁 Model paths)
# + the 2.581.0 units + cad_worker test + browser test (Civitai videos, LoRA keywords, ✨ Generate)
# + the 2.582.0 units + browser test (Fibo 2.0)
# + the 2.583.0 units + two-studio test + browser test (Team ▸ render farm)
# + the 2.584.0 units + browser test (🔁 Compare LLMs)
# + the 2.585.0 units + ft_unsloth preference test + browser test (train on the 🔁 picks; LoRA keywords)
# + the 2.586.0 units + browser test (Add-ons ▸ LLM)
# + the 2.587.0 units (graph check, layouts) + browser test (import & check, 👁, layouts)
# + the 2.588.0 units (live + focus, RefMod library + SolarRenderer) + browser test
# + the 2.589.0 units (the Team render farm as an optional extension)
# + the 2.590.0 units (Unreal View, docker tabs) + browser test
# + the 2.591.0 units (the misc/ layout)
# 2.591.1: no new legs (test-misc591 18 checks)
# 2.591.2: no new legs (misc591 20, pushbat5406 15 checks)
# 2.591.3: no new legs (misc591 21 checks)
# + the 2.592.0 units (Nougan Nodes: app + graph) + browser test
# 2.592.1: no new legs (docs only)
# + the 2.593.0 units + browser test + the add-ons-off leg before the ControlNet legs
# + the 2.594.0 units (speech engines, Convert to 3D) + the API leg + browser test
# + the 2.595.0 units (WeVisOne-VL add-on) + browser test
# + the 2.596.0 units (llama.cpp engine update) + browser test
# + the 2.597.0 social media preset (real encodes)
# + the 2.598.0 units (seed toggle, model manager) + browser test
# + the 2.599.0 lock screen units + browser test
# + the 2.600.0 social Format units + LIVE leg + browser test
# 2.600.1: + the transcription-without-PyAV leg
# 2.601.0: + ▶ Play, reinstall + install status (units + browser), torchaudio without TorchCodec
# 2.601.0: + ▶ Play, reinstall + install status (units + browser), torchaudio without TorchCodec (2.601.1: + complex bfloat16)
# 2.601.0: + ▶ Play, reinstall + install status (units + browser), torchaudio without TorchCodec (2.601.1: + complex bfloat16)
# 2.602.0: + the Type tool's caret / frame / cursor (unit + browser)
# 2.602.0: + the Type tool's caret / frame / cursor (unit + browser)
# 2.603.0: + the layer range + timeline undo (unit + browser), ComfyUI restart at startup
# 2.603.0: + the layer range + timeline undo (unit + browser), ComfyUI restart at startup
# 2.604.0: + Save to Images / skew / Rasterize Text / no thick box (unit + browser)
# 2.604.0: + Save to Images / skew / Rasterize Text / no thick box (unit + browser)
# 2.605.0: + hover = the Move tool's frame, click to pick (unit + browser)
# 2.605.0: + hover = the Move tool's frame, click to pick (unit + browser)
# 2.606.0: + a click on a text picks + Move, double-click edits (unit; browser in ui602)
# 2.606.0: + a click on a text picks + Move, double-click edits (unit; browser in ui602)
# 2.607.0: + presets through shapes / 3D, presets in more text tools, every OS font (unit + browser)
# 2.607.0: + presets through shapes / 3D, presets in more text tools, every OS font (unit + browser)
# 2.608.0: + shapes filled with text, 16 warp presets, a warp grid on text / shapes (unit + browser)
# 2.608.0: + shapes filled with text, 16 warp presets, a warp grid on text / shapes (unit + browser)
# 2.609.0: + any floating docker docks in the image editor's panel column, kept (unit + browser)
# 2.609.0: + any floating docker docks in the image editor's panel column, kept (unit + browser)
# 2.610.0: + 🧬 Morph between two timeline layers (unit + browser)
# 2.610.0: + 🧬 Morph between two timeline layers (unit + browser)
# 2.611.0: + ▯ Frame - click a frame to select it, Del removes it (unit + browser)
# 2.611.0: + ▯ Frame - click a frame to select it, Del removes it (unit + browser)
# 2.612.0: + a cut clip stays one clip; ✂ to new layer (unit + browser)
# 2.612.0: + a cut clip stays one clip; ✂ to new layer (unit + browser)
# 2.613.0: + ▼ ranges with Ctrl while it plays, cut all / speed up, hover time, playback speed (unit + browser)
# 2.613.0: + ▼ ranges with Ctrl while it plays, cut all / speed up, hover time, playback speed (unit + browser)
# 2.614.0: + pick ▼ ranges, ✂ Cut cuts them; Ctrl taps while it plays always count (unit + browser)
# 2.614.0: + pick ▼ ranges, ✂ Cut cuts them; Ctrl taps while it plays always count (unit + browser)
# 2.615.0: + Basic Settings follow the style - misc/basic_settings.tmp (unit + browser)
# 2.615.0: + Basic Settings follow the style - misc/basic_settings.tmp (unit + browser)
# 2.616.0: + install_all.bat / .sh / .command - one file installs Git / Node.js, clones, starts (unit)
# 2.616.0: + install_all.bat / .sh / .command - one file installs Git / Node.js, clones, starts (unit)
# 2.617.0: + text effects from a zip (several in one) + its fonts (unit + browser)
# 2.617.0: + text effects from a zip (several in one) + its fonts (unit + browser)
# 2.618.0: + a Blender / 3D (Daz) / Unreal layer hidden or deleted closes its bridge (unit + browser)
# 2.618.0: + a Blender / 3D (Daz) / Unreal layer hidden or deleted closes its bridge (unit + browser)
# 2.619.0: + 📏 PushPull - 3D modelling in its own docker (unit + browser)
# 2.619.0: + 📏 PushPull - 3D modelling in its own docker (unit + browser)
# 2.620.0: + 📏 PushPull builds - rooms, shared walls, doors, windows, roofs, lights; full-window maximize, File menu (unit + browser)
# 2.620.0: + 📏 PushPull builds - rooms, shared walls, doors, windows, roofs, lights; full-window maximize, File menu (unit + browser)
# 2.621.0: + 🗣 speech & dialog in the SFX docker - emotion, voices, .wav / .mp3 with metadata (unit + browser)
# 2.621.0: + 🗣 speech & dialog in the SFX docker - emotion, voices, .wav / .mp3 with metadata (unit + browser)
# 2.622.0: + the installed ComfyUI found - its checkpoints + diffusion models in Basic Settings and the Model manager (unit + browser)
# 2.622.0: + the installed ComfyUI found - its checkpoints + diffusion models in Basic Settings and the Model manager (unit + browser)
# 2.623.0: + edit theme mode - every docker / panel / UI button and its words (browser)
# 2.623.0: + edit theme mode - every docker / panel / UI button and its words (browser)
# 2.624.0: + PushPull - theme colours, walls on a floor's edge, sloped wall tops, follow ceiling / roof, ⛶ / ⇲ Dock + ✕ (unit + browser)
# 2.624.0: + PushPull - theme colours, walls on a floor's edge, sloped wall tops, follow ceiling / roof, ⛶ / ⇲ Dock + ✕ (unit + browser)
# 2.625.0: + PushPull - faces extruded / twisted, edges moved / extruded / filleted / loops, corners moved, door + window grips, elevation (unit + browser)
# 2.625.0: + PushPull - faces extruded / twisted, edges moved / extruded / filleted / loops, corners moved, door + window grips, elevation (unit + browser)
# 2.626.0: + PushPull is the Sketcher - a real photo of the model with the prompt docker, Sketcher layers (unit + browser)
# 2.626.0: + PushPull is the Sketcher - a real photo of the model with the prompt docker, Sketcher layers (unit + browser)
# 2.627.0: + the Sketcher's real photo from a clean render + its depth map, the lead prompt (unit)
# 2.627.0: + the Sketcher's real photo from a clean render + its depth map, the lead prompt (unit)
# 2.628.0: + the Sketcher's furniture (the House builder's library) + the project's 3D models; maximized alone (unit + browser)
# 2.628.0: + the Sketcher's furniture (the House builder's library) + the project's 3D models; maximized alone (unit + browser)
# 2.629.0: + the Sketcher's materials, cameras (shots / depth / normal / 360° locations), Furnish (unit + browser)
# 2.629.0: + the Sketcher's materials, cameras (shots / depth / normal / 360° locations), Furnish (unit + browser)
# 2.630.0: + the House builder gone - people + its houses in the Sketcher, SolidCraft -> Sketcher (unit + browser; - 4 House legs)
# 2.630.0: + the House builder gone - people + its houses in the Sketcher, SolidCraft -> Sketcher (unit + browser; - 4 House legs)
# 2.631.0: + the Sketcher's cameras in View ▾, open doors / windows, auto roof + floor (unit + browser)
# 2.631.0: + the Sketcher's cameras in View ▾, open doors / windows, auto roof + floor (unit + browser)
# 2.632.0: + the Sketcher's cameras picked inside rooms / moved / turned, Esc deselects with a Build tool (browser)
# 2.632.0: + the Sketcher's cameras picked inside rooms / moved / turned, Esc deselects with a Build tool (browser)
# 2.633.0: + the Sketcher's rotate rings, roll, lens presets, focal length / field of view (unit + browser)
# 2.633.0: + the Sketcher's rotate rings, roll, lens presets, focal length / field of view (unit + browser)
# 2.634.0: + setup in colour + 'still working' (unit)
# 2.634.0: + setup in colour + 'still working' (unit)
# 2.635.0: + Assets Project | Global | All, folders = groups, Move to Global (unit + browser)
# 2.635.0: + Assets Project | Global | All, folders = groups, Move to Global (unit + browser)
# 2.636.0: + Ctrl+Alt+S Settings, the bitGen Default theme (unit + browser)
# 2.636.0: + Ctrl+Alt+S Settings, the bitGen Default theme (unit + browser)
# 2.637.0: + Shift+right-click leaves Artist mode (unit)
# 2.637.0: + Shift+right-click leaves Artist mode (unit)
# 2.638.0: + SolidCraft full window, the layout back on restore (unit + browser)
# 2.638.0: + SolidCraft full window, the layout back on restore (unit + browser)
# 2.639.0: + the Sketcher's outline docker, skirting / cornice, walls dragged, room groups (unit + browser)
# 2.639.0: + the Sketcher's outline docker, skirting / cornice, walls dragged, room groups (unit + browser; 2.639.1: docked view fix)
# 2.639.0: + the Sketcher's outline docker, skirting / cornice, walls dragged, room groups (unit + browser; 2.639.1: docked view fix; 2.639.2: no silent black view)
# 2.640.0: + the Sketcher's per-part properties + profiles (skirting, cornice, door / window frames, sills; the dialog) (unit + browser)
# 2.641.0: + the Sketcher's camera: no box, move arrows, double-click = rotate rings, another pick unpicks it (unit + browser)
# 2.642.0: + the credits: Settings ▸ About, the Guide's Credits section + cover (unit + browser)
# 2.643.0: + a camera moved / turned while looking through it (browser; units in camwidget641)
# 2.644.0: docs only - no new legs
# 2.645.0: + Ctrl+P brings the prompt docker to the front (unit + browser)
# 2.646.0: + Artist mode Alt+P / Alt+G / Ctrl+P (unit + browser)
# 2.647.0: + the Sketcher's floorplan, Esc = Orbit, room Width / Length (unit + browser)
# 2.648.0: + Shift + right-drag zoom, zoom to selection, the pointer; Sketcher Esc / Ctrl+click (unit + browser)
# 2.649.0: the floorplan in the theme's colours (units + browser in the 2.647 legs)
# 2.650.0: + the Sketcher's pick / hover highlight, 3D + floorplan (unit + browser)
# 2.651.0: + the Sketcher's material tools (unit + browser)
# 2.652.0: + the real photo's material board, ✨ Photo (unit + browser)
# 2.653.0: + the Sketcher's ⛰ terrain (unit + browser)
# 2.654.0: + 🩹 restore / fix a photo (unit + browser)
# 2.655.0: + 🩹 Ctrl / Shift+click start it (unit + browser)
# 2.656.0: + cut / fill pads; 2.657.0: + pools; 2.658.0: + maximize by place (each unit + browser)
# 2.659.0: + driveways; 2.660.0: + one wall out / interior-exterior; 2.661.0: + wall types; 2.662.0: + square wall ends / walls out of corners; 2.663.0: + wall split / sketch plane; 2.664.0: + the mannequin model; 2.665.0: + building plans to PDF; 2.666.0: + roof types; 2.667.0: + the objects panel; 2.668.0: + eaves / fascias / gutters (each unit + browser); 2.669.0: + exit / clear-comfy (unit); 2.670.0: + Bézier profiles (unit + browser); 2.671.0: + gutter profiles (unit + browser); 2.672.0: + MOSS stand-ins (unit); 2.673.0: + roads (unit + browser); 2.674.0: + one ComfyUI folder (unit); 2.675.0: + pins kept (unit + browser); 2.676.0: + preview restyle (unit + browser); 2.677.0: + its progress bar (unit + browser); 2.678.0: + P-H3 Image (unit py + js); 2.679.0: + restyle before / after (unit + browser); 2.680.0: + ⇄ previous settings (unit + browser); 2.681.0: + the kept look (browser); 2.682.0: + Shift+click in edit theme mode (browser); 2.683.0: + the ⇄ fix (browser); 2.684.0: + the look dropdown's size (browser); 2.685.0: + Override in Change style (unit + live route / browser); 2.686.0: + the line-art restyle (unit + live route / browser); 2.687.0: + the sketch plane not drawn (browser); 2.688.0: + the Sketcher bar / wall ends / Ctrl+drag / photo prompt (browser; unit test-scene688 in ci-units); 2.689.0: + cupboards & shelving (unit + browser); 2.690.0: + joined walls (unit + browser); 2.691.0: + butt joins / the last-set wall thickness (unit + browser); 2.692.0: + floor systems / lintels (unit + browser); 2.693.0: + wall framing (unit + browser); 2.694.0: + roof framing (unit + browser); 2.695.0: + roof coverings (unit + browser); 2.696.0: + the Sketcher's photo style (unit + browser); 2.697.0: + the P-H3 edit guider (py); 2.698.0: + edits at Basic Settings' Size (py + browser); 2.701.0: + the splash (unit + browser); 2.702.0: + SVG pictures (unit + browser); 2.703.0: + the zh-CN / ja guide + help (unit + browser)).
# After a gate also `rmdir mogrt/user` (2.417.0 - like textfx/user) before building.
# Straggler sweep from a NEUTRAL cwd by BRACKETED names, no plain target literals in the
# guard's own command string; WAIT for the RESULT line; port 8388 free;
# CHECK THE LOG'S mtime; SWEEP AND LAUNCH IN SEPARATE SHORT CALLS.)
# RESTORING FROM PROJECT KNOWLEDGE WORKS (2.289 session): the 202 docs were
# read back (small ones inline, big ones as local files) and unflattened;
# the untouched baseline gate went 898/0 before any edit - do that
# baseline FIRST, in its own tree, and build in a SECOND copy so an edit
# can never race the running gate. scripts/test-imagedom.js trips a
# content filter when a subagent re-types it (its XSS fixture string) -
# restore that one yourself. NEW docs written to project knowledge land
# under a claude/ prefix (the platform's rule for new names): 2.289's
# claude/lib__segBoard.js, claude/static__segmap.js and
# claude/scripts__test-segmap.js - strip the prefix when restoring
# (scripts__unflatten.py expects the bare a__b names).

## DELIVERY RULE (2.341.0, Tim: "please put system files in a zip, i can't
## download exe, command or sh" + "only give me the setup zip if we need to
## add to setup"): the installers go out ZIPPED - bitgen-studio-installers-
## v<X>.zip holding the .exe, the -linux.sh and the -macos.command (zip -X
## keeps the exec bits), never bare - and ONLY in a release that changes
## setup: installer/*, electron/installer*.html|js, electron/main.js's setup
## IPC, lib/setup*.js, lib/modelCatalog.json, lib/nodePacks.json,
## lib/hfCli.js, scripts/setup-cli.js, scripts/build-installers.sh, the
## bootstraps. Other releases: full + flat (+ ext / workflows zips when they
## changed) + repo zip only. 2.342.0 (Tim: "package the workflows with the
## full zip"): comfy_workflows/ is in the full zip; no separate workflows zip.

## HANDOVER SPLIT (2.295.0): the project knowledge hit its size limit (the
## single HANDOVER.md was ~1 MB). Releases 2.275.0 and older now live in
## HANDOVER-ARCHIVE.md - it ships in the full and flat zips but is NOT
## uploaded to project knowledge. This file keeps the header, the standing
## rules and 2.276.0 onward. Keep future entries here; move the oldest
## sections to the archive when this file passes ~150 KB.
## (2.331.0: 2.276.0-2.305.0 moved to the archive; 2.334.0/2.335.0: 2.306.0-2.325.1 too -
##  this file keeps 2.326.0 on - project knowledge is at its 2 MB cap.)
## (2.538.0, Tim: "fix the handover": 2.326.0-2.528.0 moved to the archive too - this file keeps the
##  header, the standing rules and the LAST 10 RELEASES; move the oldest out when a new one goes in.)
## PUBLIC REPO (2.540.1, Tim: "build a clean public version" - the first GitHub upload): the repo zip leaves out
## HANDOVER*.md, CONTINUATION-NOTES-*, WORKING-VERSIONS.md, FOLDER-STRUCTURE.md, unflatten.ps1 / scripts/unflatten.py,
## _gitignore, g_kf.cmd / t_kf.cmd, CONTINUE.md and docs/*-GAP.md (PUBLIC_DROP in the build's extzips.py; they stay in
## the full + flat zips). README / docs/BETA.md / CONTRIBUTING.md carry the beta note and Tim's testing status: tested
## on real hardware = model manager, image generation (every built-in style), video, music; NOT yet tested enough =
## the editors (image editor, timeline, CAD) and the house builder; experimental = the Unreal + Daz bridges. Update
## that table when Tim reports more testing. Screenshots: docs/images/{overview,model-manager,image-styles,timeline,
## music,image-editor,house-builder}.png (placeholder art, scratchpad shot scripts /tmp/s1-s7.js).


## KNOWLEDGE NOTE (2.346.0): project knowledge sits at its ~2M-token cap. These
## files are NOT in knowledge - restore them from the flat zip when needed:
## scripts/test-imagedom.js, test-sheetstyles.js, test-uilayout.js,
## test-sceneui.js, test-patcher.py, test-yue2.js, test-imageui.js,
## test-styles.js, test-screenplay.js; 2.351.0 also dropped test-scriptboard,
## test-scenecards, test-imageedit, test-contmode, test-filmstrip, test-sceneinsert,
## test-clipstart, test-scenetype, test-trimfirst, test-redotake, test-tailframes
## (knowledge cap). 2.350/2.351 wrote stub-comfy.py + worker.py + core.js under
## claude/ (claude/scripts__stub-comfy.py, claude/worker.py, claude/lib__core.js). Big docs (e2e-stub-test.sh,
## static/index.html, routes/index.js) need project_delete then project_write.
## 2.352.0: scripts/e2e-stub-test.sh (669 KB, a third of the cap) is NO LONGER in knowledge - restore
## it from the flat zip (scripts__e2e-stub-test.sh). Its space holds the native engine
## (claude/scripts__native__*.py) and the H3_Viggle files.
TESTED 2.470.0 (2026-10-16): GATE for 2.457.0 - 2.469.0 + the 2.470.0 code (sandbox): 1401 passed, 8 failed - fixed and rerun green in this release: aiedit / pceditor ext pins, test-bgfiles pin, the brand names in the 2.469 text (test-brandnames), 2.417 template-list race, 2.421 / 2.428 tests hold the new Move-after-drawing, 2.440 rulers + 2.457 dimension parts (pcselhl leaves those presses alone), camera (flaky, green on rerun), PDF guide (the sandbox's old PDFs). Release units 10/10 files green, UI: selhl 19/19, guides 12/12, dimgroup 19/19, pspath 33/33, psdraw 20/20, premiere12 green, campath 12/12, atn 4/4, PDF 16/16.
TESTED 2.471.0 (2026-10-16): units body3d 26/26 (OpenCascade on the vendored WebAssembly), pcbody 17/17 (incl. the REAL Blender 4.0 engine: extrude + chamfer, revolve + split), cadbar 15/15, pceditor 41/41, aiedit 81/81, blender 28/28, premiere5 49/49, textfx 35/35, brandnames 5/5; UI body 22/22 (OpenCascade in Chromium, the Blender engine, → Timeline + the live link), selhl 19/19; PDF 16/16.
TESTED 2.472.0 (2026-10-16): units unreal 24/24 (lib/unreal.js against scripts/ue-stub.js: stills, renders -> mp4 + VP9 alpha webm; the plugin's Python parses, every command), pceditor 41/41, aiedit 81/81, blender 28/28, premiere5 49/49, textfx 35/35, pcbody 17/17, cadbar 15/15, brandnames 5/5; UI unreal 8/8 (the stand-in editor), body 22/22, selhl 19/19; PDF 16/16. NOT run inside a real Unreal Editor (none here) - the plugin is written from the 5.8 Python API.
TESTED 2.473.0 (2026-10-16): Feature Reference PDF 9/9 (576 features, 10 areas, 85 sub-areas; every name found in the PDF's text), cadbar 15/15, Guide PDF 16/16.
TESTED 2.474.0 (2026-10-16): units multisel 9/9, cadbar 15/15, pceditor 41/41, aiedit 81/81, handles 9/9, featurespdf 9/9; UI multisel 14/14, selhl 19/19, pceditor-ui 33/33 (its tab list fixed - stale since 2.471), psdraw 20/20, dimgroup 19/19, pspath 33/33; also green in the sandbox before the release: dimauto 12, genfill 20, panels 20, pcfill 18, psbezier 35, pspdf 17, secfloat 16, sketchcad 14, sketchmod 10, sketch 14, guides 12, handles-ui 10; PDF 16/16.
TESTED 2.475.0 (2026-10-16): units uecam 13/13, unreal 24/24, pceditor 41/41, aiedit 81/81, cadbar 15/15, featurespdf 9/9, brandnames 5/5; UI uecam 16/16 (the stand-in editor: orbit / pan / roll / look / wheel, presets, exposure, FOV, click to focus, viewport both ways, the timeline lens), unreal 8/8, pceditor-ui 33/33, multisel 14/14; PDF 16/16. The plugin 1.1.0 was not run in a real Unreal Editor.
TESTED 2.476.0 (2026-10-16): units uelights 11/11, uecam 13/13, unreal 24/24, pceditor 41/41, aiedit 81/81, featurespdf 9/9, brandnames 5/5; UI uelights 14/14 (the stand-in editor: presets, lights, volumetric, the light tool, fog, keep, delete + undo, the timeline's Lights & Fog), uecam 16/16, unreal 8/8, pceditor-ui 33/33; PDF 16/16. The plugin 1.2.0 was not run in a real Unreal Editor.
TESTED 2.477.0 (2026-10-16): units repo 16/16, featurespdf 9/9, brandnames 5/5, pceditor 41/41; ci-units.sh in a clean checkout of the repository; PDF 16/16. The repository: bitgen-studio-v2.477.0-beta-github.zip (tag v2.477.0-beta).
TESTED 2.478.0 (2026-10-16): units selsearch 26/26, repo 16/16, featurespdf 9/9, brandnames 5/5, pceditor 41/41; UI selsearch 12/12 (blend list narrowed + picked, a letter opens it, Esc keeps the editor's tool, outside press, File > New's presets, the setting), pceditor-ui 33/33; PDF 16/16.
TESTED 2.479.0 (2026-10-16): units jxl 16/16, iegen 11/11, repo 16/16, featurespdf 9/9, brandnames 5/5, pceditor 41/41, filedialog 63/63, addtile 18/18; ci-units 128/128 (sandbox); UI jxl 9/9 (canvas -> lossless .jxl exact, img / bitmap / data URL, upload as PNG, editor open, Export As JPEG XL saved as .jxl + shown), selsearch 12/12, pceditor-ui 33/33; PDF 16/16.
TESTED 2.480.0 (2026-10-16): units filters2 19/19, pceditor 41/41, aiedit 81/81, pspath 42/42, repo 16/16, featurespdf 9/9, brandnames 5/5; UI filters2 8/8 (menus, Selective Color dialog + layer, Replace Color eyedropper, Color Lookup look + library .cube, Match Color from a layer, Apply Image), pceditor-ui 33/33, jxl 9/9; PDF 16/16.
TESTED 2.481.0 (2026-10-16): units filters3 42/42, filters2 19/19, pceditor 41/41, aiedit 81/81, repo 16/16, featurespdf 9/9, brandnames 5/5; UI filters3 8/8 (twelve submenus, Iris Blur click-placed, Custom 5x5 + Ctrl+F, Lighting preview/cancel, Displace maps, a smart filter), filters2 8/8, pceditor-ui 33/33; PDF 16/16.
TESTED 2.482.0 (2026-10-16): units filters5 28/28, filters3 42/42, filters2 19/19, pceditor 41/41, aiedit 81/81, repo 16/16, featurespdf 9/9, brandnames 5/5; UI filters5 9/9 (menu, Alt+Shift+Ctrl+A, tabs, preset, exposure, Auto, saved preset, OK one step, Lens Correction transparent + cancel), filters3 8/8, pceditor-ui 33/33; PDF 16/16.
TESTED 2.483.0 (2026-10-16): units measure 14/14, filters5 28/28, pceditor 41/41, aiedit 81/81, psdocs 21/21, bgfiles 31/31, channels, dims 10/10, guides 13/13, genfill 19/19, repo 16/16, featurespdf 9/9, brandnames 5/5; UI measure 14/14 (tool groups, Navigator, Histogram, Info, samplers, ruler + straighten, note, count, perspective crop + undo, Similar, Focus Area, matting), pceditor-ui 33/33, filters5 9/9, bgfiles-ui 26/26; PDF 16/16.
TESTED 2.484.0 (2026-10-16): units brushdyn 14/14, measure 14/14, filters2 19/19, pceditor 41/41, aiedit 81/81, repo 16/16, featurespdf 9/9, brandnames 5/5; UI brushdyn 8/8 (tab, roundness, scattering, colour dynamics, kept + reset, new preset in brushes/, an .abr brush paints its shape), pceditor-ui 33/33, filters2 8/8, measure 14/14; PDF 16/16.
TESTED (2026-10-16): its units + browser test and the editor's other browser tests green in the sandbox and again in the release tree (test-fileplus 28, test-fileplus-ui 12, test-jxl 16, test-jxl-ui 9, test-pceditor-ui 33, test-brushdyn-ui 8, test-measure-ui 14, test-brushdyn / test-pceditor / test-aiedit / test-psdocs / test-repo / test-guidepdf); the full gate runs on 2.461.0.
TESTED (2026-10-16): its units + browser test and the editor's other browser tests green in the sandbox and again in the release tree (test-merge 22, test-merge-ui 8, test-fileplus 28, test-fileplus-ui 12, test-pceditor-ui 33, test-measure-ui 14, test-pceditor / test-aiedit / test-jxl / test-repo / test-guidepdf); the full gate runs on 2.461.0.
TESTED (2026-10-16): its units + browser test and the editor's other browser tests green in the sandbox and again in the release tree (test-mode 23, test-mode-ui 13, test-merge 22, test-merge-ui 8, test-fileplus 28, test-fileplus-ui 12, test-pceditor-ui 33, test-measure-ui 14, test-psdocs-ui 32, test-pceditor / test-aiedit / test-psdocs / test-repo / test-guidepdf); the full gate runs on 2.461.0.
TESTED (2026-10-16): its units + browser tests and the editor's other browser tests green in the sandbox and again in the release tree (test-subject 13, test-subject-ui 8, test-pdfpages-ui 8, test-pspdf 21, test-pspdf-ui 17, test-mode-ui 13, test-pceditor-ui 33, test-psdocs-ui 32, test-mode / test-fileplus / test-pceditor / test-aiedit / test-psdocs / test-repo / test-guidepdf); the full gate runs on 2.461.0.
TESTED (2026-10-16): its units + browser test (with compile parity) and the timeline's other browser tests green in the sandbox and again in the release tree (test-aegraph 15, test-aegraph-ui 15, test-keyframes 24, test-keyframes-ui 16, test-tlcanvas-ui 20, test-clipfx-ui 23, test-cliptransform / test-blender / test-premiere5 / test-textfx / test-repo / test-guidepdf); the full gate runs on 2.461.0.
TESTED (2026-10-17): its units + browser test (with compile parity) and the timeline's other browser tests green in the sandbox and again in the release tree (test-parent 12, test-parent-ui 11, test-aegraph 15, test-aegraph-ui 15, test-keyframes 24, test-keyframes-ui 16, test-tlcanvas-ui 20, test-cliptransform / test-blender / test-premiere5 / test-textfx / test-repo / test-guidepdf); the full gate runs on 2.461.0.
TESTED (2026-10-17): its units (the graph run in ffmpeg) + browser test (compile parity) and the timeline's other compile tests green in the sandbox and again in the release tree (test-blend 11, test-blend-ui 9, test-parent-ui 11, test-aegraph-ui 15, test-keyframes-ui 16, test-tlcanvas-ui 20, test-clipfx-ui 23, test-premiere11-live 15 (adjustment layers + masks compiled), test-parent / test-aegraph / test-keyframes / test-blender / test-premiere5 / test-textfx / test-repo / test-guidepdf); the full gate runs on 2.461.0.
TESTED (2026-10-17): its units + browser test (compile parity) and the timeline's other browser tests green in the sandbox and again in the release tree (test-shape 17, test-shape-ui 9, test-parent-ui 11, test-blend-ui 9, test-aegraph-ui 15, test-tlcanvas-ui 20, test-parent / test-blend / test-aegraph / test-keyframes / test-blender / test-premiere5 / test-textfx / test-repo / test-guidepdf); the full gate runs on 2.461.0.
TESTED (2026-10-17): its units + browser test (compile parity) and the timeline's other browser tests green in the sandbox and again in the release tree (test-textanim 10, test-textanim-ui 8, test-shape-ui 9, test-parent-ui 11, test-blend-ui 9, test-keyframes-ui 16, test-tlcanvas-ui 20, test-textfx-ui 12, test-shape / test-parent / test-blend / test-aegraph / test-keyframes / test-blender / test-premiere5 / test-textfx / test-repo / test-guidepdf); the full gate runs on 2.461.0.
## 2.538.0 (Tim: "fix the handover, remove the docs__usage and docs__reference - if the ext zips are in the full zip
## then remove the ext zips"): docs/USAGE.md + docs/REFERENCE.md are NOT in knowledge any more (restore them from the
## full zip); this file keeps only the last 10 releases (the rest is in HANDOVER-ARCHIVE.md). Each release sends Tim
## ONLY the newest full zip + the 3 bridges + the 2 PDFs - no flat, repo or ext zips (the full zip's ext/ is identical
## to the ext zips), no older versions - until he asks for them again.
## 2.539.0 (Tim: "there is still a 716k handover-archive file in full.zip, we can remove the docs folder"): the FULL zip
## has no HANDOVER-ARCHIVE.md and of docs/ only USAGE.md + shortcuts.json (the in-app Help / Ctrl+K reads them -
## lib/helpDocs.js). The PDFs go to Tim separately; the archive, the gap docs, REFERENCE / FEATURES / INSTALL and the
## pictures stay in work/ (and the flat + repo zips in dist). The build template drops them ($SP/build4370.py _DROP).

## HANDOVER AT 2.723.0 (2026-11-08)

DELIVERY (Tim, after 2.643.0): every release is committed and pushed to GitHub main (CI checked) + the repo zip sent for Tim's
archive; no full / flat / ext zips (CONTINUE.md DELIVERY). 2.671.0 - 2.723.0 are pushed (CI checked). The session cloned the repo
into work/, tested in a copy (/tmp/.../t665, H3_E2E=1 H3_PORT=8465 node misc/server.js - run it as a BACKGROUND Bash task: a nohup'd server is stopped between turns), pushed from work/ after
mcp add_repo (push). Docs edited by hand (USAGE / FEATURES / help pushpull.html / misc/CHANGELOG.md line / e2e legs), PDFs
rebuilt with scripts/make_guide_pdf.py, make_ad_pdf.py, make_features_pdf.py; repo zip = `git archive --prefix=bitgen-studio/
-o bitgen-studio-v<X>-repo.zip HEAD`. Nothing is half-done. The full gate was not run (ci-units 283/283 + the Sketcher's
browser tests ui640 / 653 / 657 / 659 / 665 / 667 / 668 / 671 / 673 green at 2.673.0; ci-units 295/295 at 2.690.0, 296/296 + the 37 PPArch browser tests at 2.691.0, 297/297 + 39 at 2.692.0, 298/298 + 40 at 2.693.0, 299/299 + 41 at 2.694.0, 300/300 + 43 at 2.695.0, 301/301 + 44 at 2.696.0, 303/303 at 2.702.0, 304/304 at 2.703.0). test-featurespdf.py is green again since 2.714.1 (it compares
a name as the PDF draws it - G.drawable drops emoji). ci-units 310/310 at 2.714.1, 311/311 at 2.715.0, 312/312 at 2.716.0, 313/313 at 2.717.0, 313/313 at 2.718.0 (+ test-ui718-ui), 314/314 at 2.719.0 (+ test-ui719-ui 19/19), 314/314 at 2.719.1 (test-ui719-ui 24/24), 315/315 at 2.720.0 (test-ui720-ui 11/11). Browser tests ALSO failing at 2.718.0 (not caused since): test-negprompt-ui, test-paths-ui, test-timeline380-ui, test-ui626-ui, test-ui521-ui, test-ui579-ui; test-ui580-ui flaky (mtime race). test-imagedom.js fails 4 checks BEFORE 2.719.0 too (inline script TypeError reading contains - not caused since). Browser tests failing BEFORE 2.715.0 too (checked
against 2.714.1, not caused since): test-i18n703-ui (3 guide sections untranslated since 2.708-2.710), test-uilang706-ui (the
dockers tab's "… px high"), test-ui530-ui (house palette), test-ui601-ui (timeout), test-ui642-ui (credits name).
GITHUB SETTINGS: the git proxy refuses repository-settings writes (description, topics - HTTP 403).
PUSHING: add the repo with push access first (mcp__claude-code-remote__add_repo owner Tim-byte-dev repo Bitgen-Studio access push).

## tigerart VISITORS (2026-11-08, no app version - tigerart a9adb5a, Bitgen site-keys 744)

Tim: "can we have stats in admin for number of visitors where they are from etc? no tracking just so we can learn our
demographic, we don't store ip addresses just the country and state they are visiting from" + "and no names or identities".
- public/inc/stats.php (header.php calls stats_hit(basename(SCRIPT_NAME), lang())): <private>/stats/YYYY-MM-DD.json
  (Australia/Sydney day) {"v":1,"rows":{"page\x1fCC\x1fstate\x1fsource\x1fdevice\x1flang":[visits,views]}}, flock'd.
  visit = referrer not this host (Host may carry a port). source = named sites (Google, Facebook, Reddit, X...) or the
  bare host; an IP-literal host = "other"; never paths/queries. Skips: non-GET, Sec-Purpose/Purpose prefetch, robots
  (stats_is_robot regex), /b_admin. BITGEN_NO_STATS=1 turns it off; BITGEN_PRIVATE_DIR as b_admin's private_dir() (same
  rule - test-stats compares the two function bodies).
- public/inc/geoip.php: GeoMmdb - own MaxMind DB reader (24/28/32-bit records, IPv4-in-IPv6 start node, pointers, maps,
  arrays...). Verified = Python maxminddb on 3,506 addresses of the real DB-IP file (npm package dbip-city-lite was the
  copy used here; db-ip.com itself is not reachable from the sandbox). geo_lookup -> country iso_code + subdivisions[0]
  .names.en. DB file <private>/geo/dbip-city-lite.mmdb (BITGEN_GEO_DB overrides).
- public/b_admin/lib/stats.php: stats_sum(days) (source "this site" not listed), STATS_RANGES 7/30/90/365, stats_list_html
  (share bars = inline SVG rects - the admin CSP forbids style attributes), stats_chart_svg, geo_status, geo_update
  (curl https://download.db-ip.com/free/dbip-city-lite-YYYY-MM.mmdb.gz, this month then last; BGA_GEO_URL for tests;
  gunzip, validate 1.1.1.1 has a country, rename). STATS_READY = inc/stats.php present (before the first Update the
  section says press Update). Admin action do=geoget. DB-IP attribution link (CC BY 4.0 requires it).
- privacy.php: a new first paragraph (counts, no cookie, no address, DB-IP) and the cookies paragraph without "No tracking
  and no analytics." (translations split from the old ones).
- scripts/test-stats.js 34 (in CI), scripts/fixtures/geo-test.mmdb (made with Python mmdb-writer: AU NSW 1.1.1.0/24, AU WA
  49.255/16, GB England 81.2.69/24, CA Quebec 2001:4860::/32, JP no state 203.0.113/24).
- TIM'S STEPS: press Update, then /b_admin/ ▸ Visitors ▸ Get the country database (about 60 MB download; monthly
  updates - press "Get the newest" now and then). Branches to delete: tigerart wip/visitors, Bitgen wip/site-keys-visitors.

## tigerart BYLINE (2026-11-08, no app version - tigerart b44c400, Bitgen site-keys 743)

Tim: "do u think we should add a tigerart banner above the bitgen menubar?" - advised against a banner (space, split brand,
the credit is already in the footer / splash / About); he chose option 1: header.php brand = <span class="bn">bitGen
Studio<small class="by">by Tiger Art</small></span> (stacked, no extra width, header stays 65 px; ja Tiger Art 制作,
zh 出品). test-site 212. Branches to delete: tigerart wip/byline, Bitgen wip/site-keys-byline.

## NEXT (REVISED 2026-11-10, after 2.755.0) — THE PODS DOCKER + POD STYLES + EXIT

Tim (verbatim): "can we get the list of public pods from runpod in a docker called PODS(like model manager), button and docker
only visible when runpod pods are selected as the generation engine? the user can choose/create a pod, and when the user
selects the style the pod starts, if user changes the style give the user the option to stop/terminate the pod. when bigen
exits terminate all pods" -> asked which pods on exit: "Only pods bitGen started" (created or started in that run; never
the ones made on RunPod's site). Also answered: a stopped pod still pays for its volume disk; terminate = no charge + files
gone; bitGen has no Terminate yet.
- Public templates: GET https://api.runpod.io/v2/catalog/templates?source=official|verified|community (Bearer key; at most
  100 per source, no search / pages yet) -> {templates: [{id, name, image, disk, mounts, ports ["8188/http"...], env,
  category NVIDIA|AMD|CPU, public, serverless, startSsh, startJupyter, allowedCudaVersions}]}. No description / creator /
  popularity - filter client-side (name / image / a ComfyUI port 8188 or 3000; "ComfyUI only" on by default; skip
  serverless:true).
- 2.756.0: Basic Settings ▸ GPU = Remote ▸ RunPod | OpenRouter; RunPod ▸ Serverless | Pods (the "generation engine"). The
  PODS docker (SecFloat, like the 🧩 Model manager) + its button ONLY when Remote + RunPod + Pods: tabs Official / Verified /
  Community (+ search, ComfyUI only), My pods (start / stop / TERMINATE with a confirm that says files are deleted), Create a
  pod from a template: GPU list with live prices (GET /v2/catalog/gpus?include=AVAILABILITY&product=POD&cloud=...), cloud
  Secure / Community, container disk, /workspace size -> POST /v2/pods (see the plan below for the body); every pod bitGen
  creates or starts is remembered (rgpu.pods_bitgen, with when) for the exit rule.
- 2.757.0: P_ styles tied to a pod (the earlier plan); picking a P_ style starts its pod (loading pod... pod loaded in the
  docker + the job log); picking another style: a box "<pod> is still running - Keep it / Stop it / Terminate it"; on exit
  (electron/main.js before-quit -> the server, e.g. POST /api/remotegpu/exit, waiting a few seconds) TERMINATE the pods in
  rgpu.pods_bitgen that are not terminated yet; say in the guide that a crash / no internet leaves them running.
- 2.758.0: balance + costs + PDF report (unchanged - see below).

## NEXT — TIM'S POD PLAN (asked 2026-11-10; 2.755.0 done, then 2.756.0 / 2.757.0 / 2.758.0)

Tim (verbatim): "if user selects has remote checked and remote selected in basic settings show the remote servers, runpod and
openrouter, if user selects runpod show serverless or pods radio group. if pods show the pods as a style in the prompts docker
for pods use P_ prefix. can we create the pods using bitgen?" -> answers: P_ = "A style tied to a pod"; create pods: "replace
in bitgen and deploy, add start and stop button to the remote generation docker when pods are selected, show time used and
cost - show loading pod, pod loaded, stopping pod. give user option to keep pod open and start another pod or stop pod before
starting another pod. show their runpod balance, and approx. cost for each generation + start cost and idle cost, keep
date+time so a detailed report can be given to the user for their total cost than can be saved as a pdf and should match
runpods stats"; OpenRouter under Remote: no preference -> LLM only until OR_ styles exist.
- 2.756.0: Basic Settings ▸ GPU (static/gpusplit.js): Remote ▸ radios RunPod | OpenRouter; RunPod ▸ radios Serverless | Pods
  (map to rgpu.mode serverless | runpod and rgpu.llm_provider). P_ STYLES = a style tied to a pod: lib/styles.js gpuFields
  runs_on "pod" + pod (id) [+ port], name prefix P_ on save (like R_), static/runson.js a third choice "A pod" with a pod
  picker (/api/remotegpu/pods); lib/rpslStyles.js / static/rpstyles.js: Remote+Pods = only P_ styles, Remote+Serverless =
  R_; lib/gpuSplit.js decide(): a pod style -> target {url: runpodApi.proxyUrl(pod, port), mode "runpod", label "RunPod pod
  <name>", cost_hr} and, if the pod is not RUNNING, START it (runpodApi.action start) and wait for podState().ready before the
  job's ComfyUI calls (core.js forJob runs as the job starts - a wait there, with the job log saying "loading pod").
- 2.757.0: CREATE PODS in bitGen (replace Deploy ↗): POST https://api.runpod.io/v2/pods {name, templateId, gpu: {id, count},
  cloud: SECURE|COMMUNITY, disk (container GB), mounts: {persistent: {size, path: "/workspace"}} (or network: [{volumeId,
  path}])} -> 201 Pod {id, status PROVISIONING -> STARTING -> RUNNING, cost}. GPU list + prices: GET /v2/catalog/gpus
  (?include=AVAILABILITY&product=POD&cloud=SECURE|COMMUNITY) -> {gpus: [{id, name, memory, price: {secure, community},
  availability, maxCount}]}. Terminate = POST /v2/pods/{id}/action {action: "terminate"} (204). Starting a pod while another
  runs: ask "keep it running" / "stop it first". Each pod: time used + cost.
- 2.758.0: COSTS: balance = RunPod GraphQL (REST v2 has none): POST https://api.runpod.io/graphql (Bearer key) {query:
  "query { myself { clientBalance currentSpendPerHr spendLimit } }"} - GraphQL retires "early 2027" (separate plan). RunPod's
  own billing: GET /v2/billing/pods?startTime&endTime&bucketSize=hour|day&podId -> {records: [{startTime, endTime, podId,
  totalAmount, gpuAmount, cpuAmount, diskAmount}], metadata: {totals}} - put next to bitGen's own log so they can be
  compared. bitGen's log: every start / ready / stop / job (start, end, pod, $/h) with date+time (a JSONL in the
  workspace, like lib/usageLog.js) -> per-generation cost (job time x $/h), start cost (start -> ready), idle cost (running,
  no job); a report page + Save as PDF (Electron webContents.printToPDF via ipc; the browser: print).

## 2.755.0 — ☁ RUNPOD REST API v2 + POD STATES (2026-11-10, main 3c293aa, tigerart refresh 9cbea90)

RunPod retires REST v1 (rest.runpod.io/v1) on 15 Nov 2026 (docs: api-reference-v2/migrate-from-v1; GraphQL retires early
2027 separately). Tim's first pod ask: "show loading pod, pod loaded, stopping pod".
- lib/runpodApi.js = EVERY REST call: BASE() https://api.runpod.io/v2 (H3_RUNPOD_REST_API), call() (401/403 "refused" + "needs
  access to pods (an All key)" on 403, 404, 409 "not possible in the pod's state now"), listAll (pagination.nextCursor /
  hasNextPage, limit=1000), pods, pod (GET /pods/{id} - runtime.uptime only when RUNNING), action (POST /pods/{id}/action
  {action}), endpointImage (GET /serverless list, field image), mapPod (v2: status, gpu.id "NVIDIA GeForce RTX 4090" -> "RTX
  4090", gpu.count, cost, startedAt; v1 fields still read), statusWord, proxyUrl (H3_RUNPOD_PROXY pattern
  "http://127.0.0.1:8399/proxy/{id}-{port}" for the tests). Serverless JOBS (api.runpod.ai/v2/<ep>/run) unchanged.
- lib/remoteGpu.js: pods/podAction via runpodApi (old runpod() removed), podState(id) -> {status, word ("loading pod" /
  "pod loaded" when its ComfyUI /system_stats answers), uptime, cost_hr, ready}; GET /api/remotegpu/pod/:id.
  lib/runpodImage.js detect via endpointImage.
- static/remotedock.js: S.watch[id] = "start"|"stop", polled (H3_POD_POLL, 4 s) only after RunPod accepts the action;
  setSt() writes each state as its own textContent (the UI scanner then makes patterns: "pod loaded · running {0} min · ≈
  ${1}" etc.). Gate server env: H3_RUNPOD_REST_API=http://127.0.0.1:8399/v2 + H3_RUNPOD_PROXY. test-runpodv2755.js (15),
  ui754 17. ci-units 327. Gate 1952 legs.

## NEXT — OPENROUTER PICTURES + VIDEO (Tim chose, 2026-11-10; the LLM + rename DONE in 2.753.0; the version numbers below are now 2.755.0 / 2.756.0). ALSO OFFERED, NOT ASKED YET: a style per pod + auto start / stop of a pod + "✓ Check this pod" (its /object_info vs the styles) - Tim asked how pods work and then asked for the docker instead

Tim: "lets add openrouter to remote gpu, maybe change remote gpu to remote generation?" -> picked "LLM, pictures + video"
and the rename in "App + website". Before that: "forget about opencode then . i don't want to install more software"
(OpenCode's free models only work inside its own client - dropped). OpenRouter has NO referral/affiliate program (only a
startup credits program that needs a partner referral) - Tim asked; the RunPod referral link + donate button are still on
the 15 Nov reminder.
- 2.753.0: RENAME the user-facing "Remote GPU" -> "Remote generation" (Settings tab label, every "Settings ▸ Remote GPU"
  string in lib/ routes/ static/ - grep -c found ~50 -, USAGE/FEATURES/README, translations ja/zh-CN/zh-TW, the website's
  menu + public/remote-gpu.php title; keep internal ids rgpu / remoteGpu.js / the page's URL working). + OPENROUTER FOR
  THE LLM: the key in settings/keys.json (lib/secrets.js, like RunPod's), rgpu.openrouter {model, vlm_model}, a provider
  choice for the LLM (RunPod vLLM | OpenRouter) in the tab's 🧠 section; lib/gpuSplit.js llmTarget() returns
  {url: "https://openrouter.ai/api/v1/chat/completions", model, headers: {Authorization: "Bearer <key>", "HTTP-Referer":
  "https://tigerart.com.au", "X-OpenRouter-Title": "bitGen Studio"}, label: "OpenRouter <model>"}; llmRoute remote when
  the provider is set up; vllm_ready -> llm_ready in view() (static/gpusplit.js enables the LLM boxes); the model list from
  GET https://openrouter.ai/api/v1/models (pricing.prompt === "0" && pricing.completion === "0" = free, ":free" ids;
  architecture.input_modalities includes "image" = usable as the vision LLM). lib/llmChat.js's error text names "the RunPod
  vLLM endpoint" - use remote.label. Free tier: 50 requests/day, 20/min (1000/day after a $10 top-up) - say so in the tab.
  Stand-in server for tests (like H3_RUNPOD_SLS_API): an env var for the OpenRouter base.
- 2.754.0: OR_ PICTURE STYLES - a ComfyUI-shaped adapter like /rpsl (lib/runpodServerless.js) at e.g. /orgen: take the
  worker's /prompt graph, pull the positive prompt / size / seed / LoadImage inputs, POST https://openrouter.ai/api/v1/images
  {model, prompt, aspect_ratio|size, seed, n, input_references: [data URLs]} -> data[].b64_json, write them as the save
  node's files and answer /history + /view the way ComfyUI does; usage.cost -> 📊 Usage. A style's Runs on gets a third
  choice (OpenRouter + model id, name prefix OR_). Models: GET /api/v1/images/models (or /api/v1/models?output_modalities=image).
  Paid only (Seedream 4.5 ~$0.05/image).
- 2.755.0: OR_ VIDEO STYLES - POST /api/v1/videos {model, prompt, frame_images (first/last frame = img2video),
  input_references} -> job id; poll GET /api/v1/videos/{id} (pending/in_progress/completed/failed); GET .../content. Veo 3.1
  $0.50/s ($0.75 at 1080p); Hailuo 3, Wan 2.7, Seedance 2.0. Docs: openrouter.ai/docs/guides/overview/multimodal/{image,video}-generation.

## 2.754.0 — ☁ USE REMOTE GENERATION + THE REMOTE GENERATION DOCKER + POD SHORTCUTS (2026-11-10, main e5d9974, tigerart refresh 7c1bc2d)

Tim: "can you make a remote generation floating docker, add the toggle for it under the basic settings gpu menu item not in
the statusbar. add a checkbox in the settings- remote geneation tab, to use remote generation, if checked show the gpu menu
item in basic settings if unchecked hide the gpu menu item ... no point confusing people . i would like to add public pods to
my account is it possible to have a shortcut to them?" (Before: he asked how bitGen knows his pods - the API key; that a
Restricted Serverless key can't list pods - use an "All" key, bitGen keeps ONE RunPod key; how to deploy a pod.)
- lib/gpuSplit.js enabledOf(r) (pure): rgpu.enabled if boolean, else on when mode != local / split != local / a vLLM
  endpoint / OpenRouter key+model. enabled(), setEnabled(true|false|null - null deletes = never chosen). OFF: split Local +
  ComfyUI here (R().use local), llmRoute local, forJob returns the config here, set() refuses Remote/Both with "tick Use remote
  generation first" - UNLESS never chosen, then picking Remote/Both sets enabled true (keeps old flows + tests working).
- lib/podShortcuts.js: REF gbj9zxqh, EXPLORE https://www.runpod.io/console/explore, templateId (?template=, /explore/<id>,
  bare id), deployUrl https://runpod.io/console/deploy?template=<id>&ref=gbj9zxqh, pageUrl, list/change on
  rgpu.pod_shortcuts (MAX 20). RunPod's API only lists your OWN templates, so shortcuts are pasted links.
- routes/remoteDock.js: GET /api/remotegen {enabled, shortcuts, explore, max}, POST /api/remotegen/enabled {on}, POST
  /api/remotegen/shortcuts {add:{name,link}}|{remove:id}.
- static/remotedock.js (after openrouter.js): .rgEnRow #rgEnabled first in #stab-rgpu (class rgOff on the tab hides the
  rest via CSS); hides h2[data-sec=gpu] + #sec-gpu; #gpuDock button appended to #sec-gpu; SecFloat.add({id:"rgen"}) body
  #rgdBody: #rgdNow, #rgdPods + #rgdPodList (data-rgdpod start/stop, data-rgduse = save runpod pod + use runpod),
  #rgdCuts (.rgdDeploy, data-rgdcut), #rgdCutName/#rgdCutLink/#rgdCutAdd, #rgdExplore, #rgdSettings. NOTE Basic Settings is
  a SecFloat window ("basic") - tests must SecFloat.show("basic", true) before clicking inside #sec-gpu.
- lib/remoteGpu.js runpod(): base = H3_RUNPOD_REST_API || RUNPOD_API (the gate's stand-in on 8399 now covers pods too).
- Tests: the older remote browser tests (520, 743, 745-748, 753, 7531) POST /api/remotegen/enabled {on:true} before the
  browser and {on:null} after. test-remotedock754.js (15), test-ui754-ui.js (16). ci-units skips tests that mention
  127.0.0.1 / spawn( - use neutral hosts in unit tests (openrouter753 + remotedock754 now run there: 326). Gate 1951 legs.

## 2.753.1 — 🦋 OLD ORANGE-BORDERED LOGO GONE (CACHES) + bitGen'S RUNPOD REFERRAL LINK (2026-11-10, main 9136237, tigerart 7c0684f + refresh f1a31d2)

Tim: "replace all the logos with the orange border with the new logo" + "the old orange border logo is also in the
video" + "add this link to the top of the runpod section in app (open externally) and on the website
https://runpod.io?ref=gbj9zxqh". (The old logo = the butterfly in a dark rounded square with an orange border - pre-2.750.0.)
- Checked: NO image file in either repo is the old logo, and no video contains it (brain film, intro, tutorials). What
  showed it was CACHES: (1) Windows' icon cache for the shortcut (installer\bitgen.ico) -> lib/iconRefresh.js (LOGO
  "2.750.0", marker settings/icon-cache.txt, Windows only, ie4uinit.exe -show detached + hidden) called from
  electron/main.js before createSplash() in a try - BUMP LOGO when bitgen.ico changes; (2) browsers' 30-day cache of the
  website's logo.png / neural.mp4 (.htaccess Expires) -> tigerart inc/site.php ua($path) = u() + "?v=" filemtime, used for
  EVERY assets/img + assets/media address (header/footer/favicon, hero film/poster/logo, screenshots, remotegpu.png,
  tutorials) + b_admin's logo. test-site.js strips ?v= from fetched pages (a fetch wrapper) after one check that they are
  there. docs/BRAND.md "When the logo changes".
- RunPod referral: static/remotegpu.js RUNPOD_REF + refLine at the top of the RunPod pod + RunPod Serverless sections
  ("Make a RunPod account ↗", target _blank -> Electron's setWindowOpenHandler -> shell.openExternal; tiger colour).
  Website: inc/site.php RUNPOD_REF + runpod_ref() (p.reflink, rel "noopener sponsored") at the top of runpod.php's header
  (replaces the plain runpod.io button) and under remote-gpu.php's "RunPod: tested" heading; RunPod's sign-up step links it.
  The 15 Nov reminder's referral half is DONE - the donate button is still to do.
- UI strings: added by hand to static/i18n/ui/strings.json (the scanner misses strings built in a var): "Make a RunPod
  account ↗" (the arrow is part of the key - uilang split keeps it) + the referral sentence. test-logo7531.js (6),
  test-ui7531-ui.js (4) + gate legs (1949). Site 936 strings, test-site.js 242.

## 2.753.0 — 🧠 THE LLM ON OPENROUTER; "REMOTE GPU" IS NOW "REMOTE GENERATION" (2026-11-10, main 9ac22b1, tigerart e671991 + refresh f081ffd)

Tim: "lets add openrouter to remote gpu, maybe change remote gpu to remote generation?" (picked "LLM, pictures + video",
rename "App + website").
- lib/openRouter.js: BASE (H3_OPENROUTER_API or https://openrouter.ai/api/v1), headers (Bearer + HTTP-Referer
  https://tigerart.com.au + X-OpenRouter-Title bitGen Studio), priceOf (per token -> $/M), mapModel (text-output only; free
  = ":free" or prompt+completion "0"; vision = input_modalities has "image"; old "modality" string read), listView (free
  first), pickVision (vlm_model, else the LLM when it takes pictures; no list = the LLM), models() 10-min cache, save,
  target(kind) -> {url .../chat/completions, model, headers, label "OpenRouter <model>"}, test (GET /key is_free_tier + the
  model in the list). rgpu.openrouter {key, model, vlm_model, free_only}; rgpu.llm_provider runpod|openrouter (unset =
  openrouter when only it is set up). Key in lib/secrets.js PATHS ("rgpu.openrouter.key").
- routes/openRouter.js: GET/POST /api/openrouter, GET /api/openrouter/models?free=1&vision=1&refresh=1, POST /api/openrouter/test.
- lib/gpuSplit.js llmReady() (provider-aware) feeds llmRoute + view().vllm_ready (name kept for the page) + llm_provider,
  llm_label; llmTarget -> OR.target when the provider is openrouter. lib/llmChat.js error text names "RunPod vLLM or OpenRouter".
- static/openrouter.js (loaded after remotegpu.js): turns #rgVllm's head into "🧠 LLM" + radios #rgLlmProv; RunPod's rows get
  .rgVrp (hidden for OpenRouter); #rgOr: #rgOrKey, #rgOrFree, #rgOrModel + 🔄 #rgOrRefresh + #rgOrTest, #rgOrVlm + #rgOrVtest,
  #rgOrMsg ("N models · M free"), help list. static/gpusplit.js: Both enabled with a remote GPU OR a ready remote LLM;
  Image / Video boxes disabled without a remote GPU; the line names OpenRouter / RunPod vLLM.
- RENAME: tab "Remote generation" (data-stab stays rgpu); every "Settings ▸ Remote GPU" / "Settings -> Remote GPU" in lib /
  routes / static (also lib/testPlan.json titles) -> Remote generation. Style "Runs on: Remote GPU" KEPT (it is a GPU).
  Guide: the English + ja/zh-CN/zh-TW menu paths renamed together and the 7 sections' markers RESTAMPED with
  lib/helpI18n enHashes (only sections fresh before) - reuse this trick for mechanical renames. FEATURES x4, README.
  UI dict x3 100% (9034): new static strings were ADDED BY HAND to static/i18n/ui/strings.json (made 2026-11-07; do NOT
  regenerate it with scripts/ui-strings.js on a used test studio - it collects test file names; reverted).
- tigerart: menu + page "Remote generation" (address remote-gpu.php), the menu paths on install / runpod / remote-gpu
  renamed with their translation keys (リモート生成 / 远程生成 / 遠端生成), new #openrouter section (4 steps, limits,
  privacy, pictures + video "Planned"); 15 strings x3, 3 unused removed (934). test-site.js 239.
- test-openrouter753.js (17), test-ui753-ui.js (13 - a stand-in OpenRouter on 8397; the gate's server now gets
  H3_OPENROUTER_API=http://127.0.0.1:8397/v1; a real /api/enhance goes through it). Gate 1947 legs.

## 2.752.0 — 🧠 THE SPLASH IS ALWAYS THE BRAIN FILM, UPSCALED, WITH THE LOGO TOP LEFT (2026-11-10, main b37b3bc, tigerart 81b5047 + refresh 6c00ff2)

Tim: "only use the brain video for the splash screen and the tigerart video, maybe just add the logo to the top left" +
"are you able to upscale the video and make the text more sharp?"
- static/splash.html: always splash-neural.webm (no random pick, #film / #neural gone; static/splash.webm DELETED - the
  orange logo film lives on only as docs/images/bitgen-studio-intro.mp4 / -splash.mp4, misc/intro/render.js no longer writes
  a webm); <img id="mark" src="icon.png"> left 2.6% top 4% width 9% (min 48 px), pointer-events none, fades in at 0.3 s;
  still() fallback keeps it. electron/main.js shows the splash when static/splash-neural.jpg exists.
- misc/brand/upscale_brain.py: Real-ESRGAN realesr-general-x4v3 (BSD-3, weights from its GitHub release into
  misc/brand/.cache - git-ignored) read from the .pth WITHOUT torch (a pickle Unpickler + numpy), the SRVGGNetCompact graph
  built with the onnx package and run with onnxruntime on the CPU (~7.2 s/frame on 2 cores, 360 frames ~44 min); x4 -> 1920
  wide, the 2176-high result trimmed to 1080. --finish <master.mkv> re-encodes only: static/splash-neural.webm VP9 crf 34
  1920x1080 (6.5 MB), docs/images/bitgen-neural.mp4 H.264 crf 23 preset slow 1280x720 (3.9 MB - the website shows ~560 px).
  The source's own misspelt labels ("Ediing") are in the clip itself - the upscaler can't fix those.
- tigerart: index.php hero = ONE video (neural.mp4, autoplay, poster neural.jpg) + <img class="mark"> (assets/img/logo.png,
  11% wide, top left); site.js no pickHero (calm = poster only); intro.mp4 + intro-poster.jpg removed; website-sync.py film()
  -> brain() copies docs/images/bitgen-neural.mp4 to assets/media/neural.mp4; test-site.js hero checks rewritten (238).
- USAGE section (+ ja/zh-CN/zh-TW), FEATURES 2.726.0 line in all four, PDFs. test-brain752.js (7) + test-ui752-ui.js (8)
  + gate legs (1945); test-splash701 / ui701 / ui726 / ui727 / neural726 / logo751 follow.

## 2.751.0 — 🦋 THE OFFICIAL bitGen LOGO EVERYWHERE (2026-11-10, main 98f111d, tigerart refresh 62dbcf7)

Tim: "make the new logo the official bitgen logo, we use it for everything that uses a logo". RULE FROM NOW ON: any new
thing that shows a logo uses the official one - docs/BRAND.md says which file (master docs/images/logo-512.png).
- misc/brand/make_logo.py (Pillow + numpy): docs/images/logo-source.jpg (Tim's original picture, now in the repo) + the
  tree (the drawing's geometry) -> key out -> logo-512.png, logo.png 256, static/icon.png 512, static/favicon.png 64,
  installer/bitgen.ico 16-256, the 1920x1080 banner. Reproduces 2.750.0's files exactly (the drawing is rounded to 8-bit
  before keying, as first made). The SVGs' tree is NOT regenerated by it (mapped once in 2.750.0).
- misc/intro/intro.html: + RING (circle cx 540 cy 539 r 666 = the official ring in the SVG's units, stroke #7fb3d8 w 7,
  drawn from the top 1.0-4.6 s), the butterfly fill #eef3f7 (was cream); the logo box 720 -> 520 px at top 36% (splash
  34.5%, the name / tag / credits a little lower) so the ring clears the name. Re-rendered (node misc/intro/render.js
  [--splash], ~25 s + ~60 s here): docs/images/bitgen-studio-intro.mp4 (the website's intro.mp4 + intro-poster.jpg via the
  refresh), docs/images/bitgen-studio-splash.mp4, static/splash.webm. The Neural splash (Tim's LTX clip, splash-neural.*)
  is not a logo - unchanged; the website's neural.mp4 likewise.
- docs/BRAND.md (what it is, the files, how to make them, the colours). test-logo751.js (10) + gate leg (1943 legs).

## 2.750.0 — 🦋 THE NEW LOGO: BUTTERFLY + TWO TIGERS + A TREE WHOSE BRANCHES ARE THE ANTENNAE (2026-11-10, main b0a1355, tigerart 8cd4ddf + e285c80 + refresh 36632f5)

Tim: "can u add a couple of strokes to the butterfly to maake it look like antennae and a tree (keep the tribal style)" ->
(asked) "the tree is the antannae, 2 tigers facing each other , a butterfly and a tree all in one" -> "remove the logo from
the remote gpu link and replace all the logos with the new one".
- The drawing: scratchpad logo2/draw.py (also sent to Tim as remote-gpu-logo-draw.py): tapered cubic strokes (pointed,
  swelling - the wings' tribal look), drawn 4x on Tim's JPEG: a trunk up the gap between the tigers' chins (x 293, y
  418->306; the gap is only ~16 px at y 330-360), two pointed roots, two branches sweeping up/out (= the antennae) with
  outward hooks, one pointed twig each; white (228,236,242) with the wings' blue glow (blur 9 + 3). Then the navy keyed out:
  alpha = clamp((max(R,G,B) - 62) / 118), colour unpremultiplied from (10,27,53); squared, transparent.
- Replaced: docs/images/logo.png (256; README; the website's header/footer/favicon/admin via website-sync.py), static/icon.png
  (512; Electron window + taskbar), static/favicon.png (64), installer/bitgen.ico (16-256; the Windows shortcut),
  docs/images/bitgen-logo-1920x1080.png (the logo on a navy radial; the website's og.jpg via the refresh).
- static/logo.svg + logo-mark.svg: the tree as 9 <path id="tree_N"> (fill #e5e5e5) - the drawing's polygons mapped with
  svg = (17 + (x-69)*2.305, 246 + (y-178)*2.305) (the wings' bboxes: raster 69-517 x 178-429, svg 17-1050 x 246-824);
  logo-mark viewBox 7 236 1054 600 -> 7 200 1054 636 (the antennae tips; the title bar mask, contain).
- NOT redone: the website's intro film (assets/media/intro.mp4, misc/intro/render.js from logo.svg) still shows the old
  wings - re-render if Tim wants.
- Website: Remote GPU menu link is a plain word again (nav_icon(), .navico and remotegpu-96.png removed); the page's
  own logo (remotegpu.png) stays.

## WEBSITE — REMOTE GPU MENU ITEM + PAGE (2026-11-10, tigerart 4ee06d4 + refresh aa1fce9, Bitgen site-keys 4fa696c)

Tim: "can you add a remote gpu menu item to the website, use this image for the logo but make the background transparent,
on the remote gpu page add runpod and all of the information you just gave me. we confirmed that runpod will work from
bitgen with sdxl". (Before it, Tim asked "is it possible to generate runpod endpoints for all our styles automatically" -
answered: yes via RunPod's REST API, but per-style endpoints don't fit (only 6 stock model sets); proposed step 1 = one
button making the 6 stock-image endpoints + wiring the R_ starters, step 2 = one shared endpoint + a network volume filled
by a short-lived pod from Hugging Face + one worker image with node packs. NOT BUILT - waiting for Tim's pick.)
- public/remote-gpu.php (toc what, kinds, runpod, ready, all, limits); "Endpoints for all your styles" says "Planned - not
  in the studio yet". Corrected on the page vs my chat answer: MiniMax H3 = 20 GB card or more (16 GB in 16 GB mode), not
  48 GB.
- Logo: Tim's JPEG (navy disc, ring, white wings) -> alpha = clamp((max(R,G,B) - 62) / 118), colour unpremultiplied from
  navy (10,27,53); assets/img/remotegpu.png (320) + remotegpu-96.png (menu, 20 px). The site is dark-only (both looks).
- inc/site.php nav() + 'remote-gpu.php' after Tutorials; nav_icon($file); header.php prints it. site.css: .navico,
  .rgpu-logo; Menu button <= 1040 px (was 860); compact menu 1041-1680; 日本語 folded <= 1200, tighter 1201-1900;
  .top .brand / .nav > a / .nav > .langf flex-shrink 0 (they used to shrink and overlap: "Remote GPUCommunity", the brand
  over "Features"). test-site's header check now also catches overlapping words. 922 site strings.

## 2.749.0 — ☁ READY-MADE REMOTE STYLES FOR RUNPOD'S STOCK IMAGES; THE LOG SAYS WHERE A JOB RENDERED (2026-11-10, main 0e442c6 + site-keys fe41565, tigerart 9e83a2c + refresh 16f38ca)

Tim's log (Pony, url=…/rpsl, RunPod's worker log with the same seed on an RTX PRO 6000 MIG 1g.24gb = it DID render on
RunPod): "it is still not using runpod ... please add the remote styles - but actually looks like it ran on runpod".
The misleading lines: "[comfy] VRAM kept ..." (this computer's ComfyUI logic asked of /rpsl) and "[power] ... 125 W" (this
computer's card while it waited). Tim's endpoint ohkr3evlck2bxn = runpod/worker-comfyui:5.10.0-sdxl.
- STARTER_STYLES (lib/styles.js, seeded once by name): R_SDXL, R_SDXL img2img (sdxl), R_FLUX.1 schnell (flux1-schnell),
  R_FLUX.1 dev (flux1-dev), R_FLUX.1 dev fp8 (flux1-dev-fp8), R_SD3 Medium (sd3), R_Z-Image Turbo (z-image-turbo, the NF2
  workflow + model z_image_turbo_bf16 - same arch: qwen_3_4b lumina2 + ae). runs_on remote, endpoint "" (the tab's),
  runpod_image (lib/styles.js RUNPOD_IMAGES; gpuFields keeps it for remote styles only). Files = RunPod's Dockerfile
  (/home/claude/runpod-workers/worker-comfyui Dockerfile MODEL_TYPE blocks). New workflows (core nodes, inputs checked in
  ComfyUI's nodes.py / nodes_flux.py / nodes_sd3.py): img_flux1_t2i.json (UNETLoader + DualCLIPLoader clip_l +
  t5xxl_fp8_e4m3fn type flux + VAELoader ae + FluxGuidance 3.5 + ConditioningZeroOut negative + EmptySD3LatentImage +
  KSampler euler/simple cfg 1), img_flux1_ckpt_t2i.json (CheckpointLoaderSimple flux1-dev-fp8), img_sd3_t2i.json
  (CheckpointLoaderSimple sd3_medium_incl_clips_t5xxlfp8, dpmpp_2m sgm_uniform cfg 4.5). NOT rendered on RunPod for real
  except SDXL (Tim's endpoint is the sdxl image).
- A name clash is refused (409): SDXL -> R_SDXL can't be saved while the starter exists (tests moved to Pony).
- lib/runpodImage.js: parse(imageName) ("runpod/worker-comfyui:5.10.0-<img>" -> img; none/base -> base; other -> own);
  detect() = GET ${H3_RUNPOD_REST_API||https://rest.runpod.io/v1}/endpoints/<id>?includeTemplate=true, Authorization:
  Bearer <key> -> template.imageName (RunPod docs api-reference/endpoints/GET/endpoints/endpointId); set(); kept in
  rgpu.serverless {image, image_name, image_ep} - known() only for image_ep === endpoint. Routes GET/POST
  /api/remotegpu/serverless/image (routes/runpodServerless.js). rpslStyles.settings().image; hideWhy: remote style, Remote
  / Both, sls, no own endpoint, not show_all, st.runpod_image, set.image in RUNPOD_IMAGES and different -> hidden "made for
  RunPod's <x> worker image - your endpoint runs the <y> one". settings() where default now "local" (2.747 rule).
  static/remotegpu.js #rgSlsImage (+ base / own / not known) + #rgSlsDetect "🔍 Ask RunPod" + #rgSlsImgMsg; loadImage()
  on paint asks RunPod once per endpoint per page when key + endpoint and no image.
- Log: lib/gpuSplit.js ranOn(jobCfg, gpu) -> job._ranOn (core.js at start); lib/power.js remoteWords -> "[power] rendered on
  <label> - about $x for N s at $y/h; this computer while it waited: <words>" ($ plain - the Remote GPU price is in $/h).
  scripts/comfy_client.py clear_before_gen: "/rpsl" in base -> "[comfy] RunPod Serverless: the endpoint's worker loads the
  models itself - no VRAM to keep or free on this computer", False.
- e2e server line + the test studio: H3_RUNPOD_REST_API=http://127.0.0.1:8399/v1 (never the real RunPod from tests).
- zh-TW: scripts/i18n-zhtw.py TW_WORDS + 網路儲存捲/網路捲 -> 網路磁碟區 (UI dict fixed, v recomputed).
- Website runpod.php #styles: a .note.good about the ready-made styles (878 site strings).
- Tests: test-remotestarters749.js (17), test-ui749-ui.js (6, serves the REST stand-in on 8399); updated test-ui744 (skips
  styles whose R_ name is taken, compares with .hide), test-ui745 (Pony; hidden counted by id), test-ui746 (Pony), test-ui747
  (parks the R_ starter files while checking the empty list), test-rpslstyles744 (split remote), test-vramkeep722 (15
  workers - red since 2.733). Gate 1942 legs.

## 2.748.0 — 🔑 API KEYS IN settings/keys.json, EACH ENCRYPTED (2026-11-10, main 85d4fcd + site-keys b442fdf, tigerart 8efb0c1 + refresh 8273814)

Tim: "save the users api keys in a file in a folder called settings, maybe encrypt the keys and decrptt them when using
the app. so user doesn't need to add them with new updates".
- lib/secrets.js: PATHS hf.token, civitai.token, engine.runpod.api_key, rgpu.runpod.key, remote.key (+ community.token);
  pick / strip / put; AES-256-GCM "v1:<b64 iv12|tag16|ct>" per key; settings/keys.json + settings/keys.master (32 random
  bytes hex, 0600; dir 0700); store(base) ONE per folder (STORES map - two instances would drop each other's keys);
  read() caches; update(names, map) touches only those names; keys.json without keys.master -> renamed .unreadable.
- lib/settings.js load/save/reset take `secrets`: load moves keys found in custom.settings (+ .bak scrubbed) into the
  store, puts them back decrypted into the config; save writes deepDiff(strip(config)); reset keeps them. lib/core.js
  keyStore passed to all three; settingsPaths keys + keys_saved (names). lib/community.js token in the store (old
  community.json token moved). Settings ▸ General #s_setinfo + "keys: <file> (encrypted: names)". .gitignore /settings/.
- misc/default.settings: + engine.comfy.restart_on_start, engine.comfy.vram16, projects_dir (test-settings was red).
- Website install.php: Uninstalling ▸ keep the settings folder for the API keys.
- Tests: test-keys748.js (19), test-ui748-ui.js (7); test-community710 reads the token from the store. Note: test-ui744
  once failed "can render N of M" right after test-ui743 - not again in 4 runs (timing).

## 2.747.0 — 🖥 GPU LOCAL BY DEFAULT, THE GPU SECTION FIRST + CLOSED, A QUICK UPDATE CHECK; /b_admin/ DOWNLOADS (2026-11-10, main 3b36397 + site-keys a1e5f80, tigerart 09e9f17 + refresh f48a398)

Tim: "the image and video styles are not showing, make local default, minimize the gpu menu item in basic settings, put
gpu menu item above overide checkbox ... previous version would not let me update inapp. add download info in b_admin
next to the country list". AskUserQuestion on the update: "failed to fetch". (Tim then updated with git pull - his
D:\Bitgen-Studio is a git clone.)
- WHY THE STYLES WERE GONE: Remote GPU's Use it sets Basic Settings ▸ GPU = Remote (remoteGpu.use without keepSplit), and
  2.746.0's Remote lists only R_ styles; Tim had none. lib/gpuSplit.js split(): nothing saved = "local" (no longer from
  rgpu.mode). defaultLocal(): once per install (flag rgpu.local_default_747), called from routes/gpuSplit.js mount() at
  start - Remote / Both -> Local + R.use("local", keepSplit) (ComfyUI's address back), the remote kept; a config with no
  rgpu gets {mode: local, flag} so it never switches later. Use it still sets Remote (unchanged).
- static/index.html: the GPU h2 + #sec-gpu moved to the top of #sec-basic (above the Override style label); header has
  <span id="gpuNow">; boot restore `toggleSec("gpu", store.get("s.gpu", "1") === "1")` = closed by default.
  static/gpusplit.js: radios Local · Remote · Both; paint() sets #gpuNow "· Local|Remote|Both".
- static/rpstyles.js: Remote with nothing shown -> note "☁ No remote styles: Basic Settings ▸ GPU is on Remote - set it
  to Local, or a style's Runs on to Remote GPU".
- THE UPDATE ("Failed to fetch" = the browser's fetch TypeError, shown by static/updater.js check()'s catch): POST
  /api/update/check ran `git fetch` (timeout 10 min) inside the request; Node 22's server.requestTimeout is 300 s, so
  on a slow line / a few releases behind (~13 MB of PDFs per release) the socket was closed. Reproduced the update path
  on Linux (2.745 clone -> 2.746 fine), the fix is the timing: lib/updater.js check() = `ls-remote origin
  refs/heads/<b>` (LS_MS 30 s) + rev-parse HEAD; GitHub's sha here (cat-file -e) -> rev-list/log against it without a
  fetch; else fetch --quiet (CHECK_FETCH_MS 60 s) then count against the sha (or FETCH_HEAD); a fetch that fails/times
  out with a known sha -> behind 1, more: true, newer (Update now downloads it). updateGit's fetch: --progress,
  UPDATE_FETCH_MS 1 h. static/updater.js said(): "Failed to fetch" -> "bitGen Studio stopped answering (...) - is it
  still running? Try again in a moment"; Update now's POST got a catch; ", new commits waiting" when more.
- Website (tigerart): public/get.php?f=windows|linux|macos|zip|master -> stats_download_hit (inc/stats.php: robots /
  prefetch / non-GET not counted; geo_lookup country only; day file key "downloads" {"id\x1fCC": n}, 400 pairs max)
  then 302 to inc/downloads.php dl_dest (assets/get/<file>, GITHUB_ZIP, site.json masterPack). dl_href() used by
  download.php (3 buttons + zip), install.php zip, footer Download (zip), languages.php master pack (inc/site.php
  require_once downloads.php at its end). /b_admin/ lib/stats.php stats_sum: downloads / dl_country / dl_n;
  stats_downloads_html (labels STATS_DL_LABELS) right after the Countries list; vnums "Downloads" -> #downloads.
  privacy.php + 1 sentence (867 site strings). Tests: test-stats 41 (+3), test-site 228, test-languages 19.
- Tests: test-gpulocal747.js (12), test-ui747-ui.js (8); test-ui745 (radio order, opens the section), test-ui746 (opens
  it), test-gpusplit745 (header regex). Gate 1938 legs. KNOWN, not from this: test-ui520 fails 2 caption legs when run
  right after test-ui742 on the same server (same on unchanged 2.746) - alone it passes 28/0.
- FOLLOW-UP (Tim: "add a note to github and our website - if anyone using versions (the previous 2) please go to the
  bitgen folder and give instructions to do git pull"): README.md top - a [!IMPORTANT] box (2.745.0 / 2.746.0: close,
  a terminal in the Bitgen-Studio folder - Windows address bar `cmd`, macOS / Linux `cd ~/Bitgen-Studio` - `git pull`,
  start again; git stash / stash pop; zip installs = the new zip) (main 4d78493). Website: install.php #update-fix (a
  .note.bad box with the steps, scroll-margin in site.css), home page #gitpull + download.php Updating = a line linking
  to it (877 site strings; test-site 229) (tigerart 4954926 + refresh ef23e27, site-keys 6594c67). Take these down when
  few people are still on 2.745 / 2.746.

## 2.746.0 — 🏷 REMOTE STYLES: EACH STYLE RUNS ON THIS COMPUTER OR THE REMOTE GPU (2026-11-09, main 0751914 + site-keys 12ac2b1, tigerart 015c9ce + refresh 892a3fe)

Tim: "when radio is selected for local show local styles, remote show remote styles (create remote styles), both , show
all styles". AskUserQuestion: Both = "The style decides"; creating = "A Runs on setting per style, add text input in
styles for endpoints if remote style is selected, prefix remote style names with R_ add this on save if it is not there".
- lib/styles.js gpuFields (wraps normalize; old one = normalize0): runs_on "local"|"remote" (default local), endpoint
  (cleaned to [A-Za-z0-9_-], kept only for remote); remote = name "R_"+name once; remote -> local takes the R_ off (a
  local style NAMED R_x keeps it). The rename moves the file (R_SDXL.json) and back. Starter seeding is by name: R_SDXL
  doesn't reseed SDXL (the "missing built-in styles" prompt may list SDXL - fine).
- static/runson.js (window.H3RunsOn build/paint/read): #s_<p>runson after the name's .grid3/.grid2 row (p = st image,
  mu music, vs video), radios name=s_<p>runson local "This computer" / remote "Remote GPU", #s_<p>ep (shown only for
  remote). index.html paintStyleForm / paintMusicForm / vsPaintForm call paint; readStyleForm / readMusicForm /
  vsReadForm spread read().
- Lists: lib/rpslStyles.js hideWhy(st, chk, set): Local hides remote styles; Remote hides local styles, and a remote
  style a serverless endpoint can't render (unless show_all); Both = all but a remote style the endpoint can't render.
  all() returns each style's hide + template.hide. static/rpstyles.js shows the server's hide; notes "🖥 N remote styles
  hidden: Basic Settings ▸ GPU is on Local" / "☁ N styles hidden: ... GPU is on Remote - ...". FIX: a list repaint (a
  style saved) now asks the server again (again(), 250 ms) - a style just saved as remote stayed listed on Local.
- Routing: lib/gpuSplit.js decide(kind, style, split, remote, sls) - Local here; Remote there; Both: a styled job
  follows the style's runs_on, an unstyled job the boxes; a remote style with its own endpoint (+ RunPod key) goes to
  sls.base + "/ep/<endpoint>" whatever the remote GPU in use; no remote + no endpoint = here, with why. forJob uses it
  (styleOf: video_style_id || style_id), log "[gpu] this image job (R_SDXL - a remote style) renders on ...".
- Adapter: routes/runpodServerless.js one Router(mergeParams) mounted at "/rpsl/ep/:ep" BEFORE "/rpsl";
  lib/runpodServerless.js prompt(b, ep) keeps j.ep for /status + /cancel; stats(ep).
- static/gpusplit.js line: Both "R_ styles: X · other styles: this computer · no style - Image: ..."; Remote "Remote
  styles (R_) only · ..."; Local "Styles for this computer only · ...". remotegpu.js counts remote styles only.
- Website runpod.php #split + 2 paragraphs, trouble row "A style is missing from the list" (9 rows). 866 site strings.
- Tests: test-remotestyles746.js (21), test-ui746-ui.js (9); test-ui744 makes every image+video style remote first (and
  back); test-ui745 makes SDXL remote for its job. Gate 1936 legs.

## 2.745.0 — 🖥 BASIC SETTINGS ▸ GPU: REMOTE / LOCAL / BOTH (2026-11-09, main 9f30d9a + site-keys 4fe9c9c, tigerart 735635d + refresh b0e22ee)

Tim: "add a accordian menu item to basic settings - GPU - add checkboxes remote,local, both - if both, add checkboxes -
llm,vllm,image,video". AskUserQuestion: vllm = the VISION LLM; ticked = runs on the REMOTE GPU; the LLMs' remote = a
RunPod vLLM endpoint. (Tim's own test that turn: his SDXL rendered through /rpsl on his serverless endpoint
ohkr3evlck2bxn in 0.7 min - 2.744.0's Save fix works.)
- lib/gpuSplit.js: rgpu.split {where remote|local|both, llm, vlm, image, video}; rgpu.remote_mode (remoteGpu.use sets it;
  use() without {keepSplit} sets split.where: Use it = remote, This computer = local); set(): Remote = R.use(remote_mode,
  keepSplit), Local / Both = R.use("local", keepSplit) (+ ssh tunnel opened for Both); forJob(config, params) called in
  core.js pump() when job.json is written: Both + ticked kind -> engine.comfy.url = remote's, autostart false, a "[gpu]"
  log line, job._gpu (usageLog.recordJob prefers it). kindOf: IMAGE_MODES image/imgupscale/graph/mesh3d; HERE_MODES
  export/karaoke/bridge/viggle_native/flowhmr/lora_train/install_*/ft_*/lora_merge (null); everything else video
  (songs/music included - "Video + songs").
- LLMs: rgpu.vllm {endpoint, model, vlm_endpoint, vlm_model}; llmTarget(kind) -> {url .../v2/<ep>/openai/v1/chat/completions,
  model (given, else GET /openai/v1/models data[0].id, cached), headers Bearer runpod.key} or null; used by llmChat.complete
  (extraHeaders), quickPrompt.chat, captioner.describe (skips ensure() and the unload). testVllm: /health + model.
  RunPod's vLLM worker = github.com/runpod-workers/worker-vllm (MIT), image runpod/worker-v1-vllm, MODEL_NAME env; the
  console's "Deploy LLM API". NOT tried for real (no account here).
- routes/gpuSplit.js: GET/POST /api/gpusplit, POST /api/gpusplit/vllm, POST /api/gpusplit/vllm/test.
- static/gpusplit.js: #sec-gpu inside #sec-basic (h2.sec.drop data-sec="gpu", small like ControlNet / Face fix), radios
  name=gpuWhere (Tim said checkboxes - a one-of choice, so radios), #gpu_llm/vlm/image/video (Both only; LLMs disabled +
  shown unticked without vllm_ready), #gpuLine, #gpuSetup (opens Settings ▸ Remote GPU). Fires/listens "h3:rgpu".
  remotegpu.js: #rgVllm block (#rgVkey, #rgVep, #rgVmodel, #rgVvep, #rgVvmodel, ✓ Test x2, #rgVmsg); rgKey/rgSlsKey/rgVkey
  mirror; save() always posts rgKey.
- rpslStyles.settings().kinds + rpstyles KIND map: with Both only the kinds sent to the serverless endpoint are filtered.
- FIX: static/basiccfg.js SKIP += "#sec-gpu" - basic.cfg / per-style memory replayed the gpu_* boxes (change events)
  and re-routed renders on every load (it is what broke test-ui745 at first).
- Website runpod.php: + #split "Only some work on RunPod" (toc 11). 862 site strings.
- Tests: test-gpusplit745.js (21), test-ui745-ui.js (13). test-captioner (3 FAILED) / test-frameopllm (2 failed LIVE legs)
  fail the same WITHOUT these changes (they need a stub LLM server) - not from 2.745.0.

## 2.744.0 — ☁ RUNPOD SERVERLESS: ONLY THE STYLES IT CAN RENDER; SAVE KEEPS THE REMOTE GPU (2026-11-09, main bd59ab8 + site-keys b6a4736, tigerart f93926a + refresh c854b16)

Tim: "if user is using runpod only show the styles that will work with runpod" + a log of his SDXL test that ran
LOCALLY ("engine=comfy url=http://127.0.0.1:8188", "not in (list of length 416)" = his own ComfyUI).
- THE BUG: Settings ▸ Save (#s_save, index.html ~5538) posts engine.comfy.url from #s_curl (the ComfyUI tab) - after
  Use it that box still held the local address, so Save put the remote GPU back on this computer (pods / URL too).
  FIX: lib/remoteGpu.js guardComfy(incoming, config), called in POST /api/config before the merge: rgpu.mode != local
  -> url / autostart dropped; a NEW url there becomes rgpu.prev.url (This computer restores it). remotegpu.js use()
  also sets #s_curl to the url in use.
- lib/comfyCoreNodes.json (scripts/make-comfy-core-nodes.py <ComfyUI checkout> v0.34.0=0.34.0 origin/master=latest):
  core node class names - nodes.py + comfy_extras NODE_CLASS_MAPPINGS keys + io.Schema node_id; 634 / 687 (2026-11-08).
  Matches a git-grep check on every class the studio's workflows use. Regenerate when RunPod's worker moves on.
- lib/rpslStyles.js: checkStyle - image/music: style.workflow; video: style.workflow, else the modes with their OWN
  workflows[m] (only those count - the swap style's ref2va), else all modes via engine.comfy.workflows[m] ||
  comfy_workflows/<m>.json; ok = any mode. NOT ok: engine != comfy, chain, UI export (no /object_info to convert),
  missing file, ARCH_NEEDS_INFO ltx-2.3/ltx-2.5 (ltx_worker oconvert with object_info) + wan21/wan22 (wan_graph.pick_models
  from object_info lists). settings(): rgpu.serverless.comfy "0.34.0"|"latest", show_all. all() -> GET
  /api/remotegpu/serverless/styles {on, filter, comfy, show_all, versions, styles{id:{ok,why,kind,name,modes}}, template}.
  This install: 34 of 62 (hidden: Fibo 2, GGUF, PH3, Qwen 2.1, FastH3 Omni, Viggle, swap, MM3H-Character-ref,
  NativeAudio MV, LTX, Wan, YuE2 ...).
- static/rpstyles.js (after basictabs.js): #styleSel, #videoStyleSel ("" = the template), #musicSel (musicdock) -
  option.hidden+disabled, data-rpsl-why (title), a disabled data-rpsl="note" last line; a hidden pick -> first shown +
  change event; MutationObserver IGNORES its own note option (it looped for ever - the page never loaded); an
  unknown id re-asks (5 s). document "h3:rgpu" (remotegpu.js save/use) = re-ask. ieeditonly.js (the image editor's
  edit-only list) now marks data-ie-hide and keeps data-rpsl-why options hidden; rpstyles keeps data-ie-hide hidden.
- remotegpu.js serverless part: #rgSlsComfy, #rgSlsAll, #rgSlsStyles (N of M + <details> of the others).
- Website: runpod.php "While RunPod Serverless is in use ..." + trouble row "The render ran on my own computer"; 859
  site strings; site-keys 859.
- Tests: test-rpslstyles744.js (19), test-ui744-ui.js (12); test-flux3 regex for ieeditonly updated. NOTE: leave the test
  studio on "local" - a debug curl that left it on serverless made test-ieeditonly-ui fail (the filter hid styles).

## tigerart: RENDER ON RUNPOD PAGE (2026-11-09, no app version - tigerart 06b01d7 + Bitgen site-keys a7b20c0)

Tim: "create a runpod page on the website and explain all steps to get runpod running and it's limitations, ie can't
use local models, models will have to be on runpod server"
- public/runpod.php (class "page install runpod" - Install's styles): 10 sections - know (the limits; .note.bad "Your own
  models are not used"), which (Serverless vs pod), account, models (network volume, a PyTorch pod, wget into
  /workspace/models, own files via file browser / S3 API, terminate), endpoint (Deploy from a Docker image,
  runpod/worker-comfyui:5.10.0-base, settings table, the ID after /v2/), connect, test (5.10.0-sdxl ships
  sd_xl_base_1.0.safetensors = the SDXL starter's workflow), styles (checked against ComfyUI v0.34.0 node by node:
  OK = ref2va/fl2va/h3_scene, ACE-Step, MiniMax Music3, SDXL/FLUX 2-3 Klein/Kontext/Fill/Krea 2/Qwen Edit 2511/Anima/
  Moss; newer ComfyUI = YuE2, Fibo 2, Qwen Image 2.1, PH3, FastH3 Omni; node packs = GGUF, swap, LTX Ripple/canvas,
  Viggle, character creator, native-audio music video), pod, trouble (7 rows).
- Linked: inc/footer.php ("Render on RunPod" after For ComfyUI users), install.php #remote (a Serverless bullet + link),
  sitemap.php (0.8). 105 new strings in inc/i18n ja / zh-CN / zh-TW (zh-TW from zh-CN with Bitgen's
  scripts/i18n-zhtw.py --json on JUST the new keys, then 網路卷/捲 -> 網路磁碟區 by hand - OpenCC turns 卷上 into 捲上).
  php scripts/site-i18n.php check = 856/856 x3; export -> Bitgen docs/i18n/site-keys.json (856).
- scripts/test-site.js: runpod.php in PAGES + the sitemap list + 5 checks (228 pass). Live after Tim's Update.

## 2.743.0 — ☁ RUNPOD SERVERLESS (2026-11-09, main 0c1b059, tigerart refresh f2b640d)

Tim: "can we try using a runpod serverless gpu?"
- THE IDEA: a ComfyUI-shaped ADAPTER on the app's own server at /rpsl (routes/runpodServerless.js, lib/runpodServerless.js).
  Remote GPU mode "serverless" sets engine.comfy.url = http://127.0.0.1:<H3_PORT|8311>/rpsl (autostart off) - every worker
  (scripts/comfy_client.py: preflight /system_stats, upload_image, queue, wait /history, download /view, free_memory /free)
  renders through it unchanged. /object_info and /ws answer 404: comfy_client already goes on without them (object_info()
  -> None, missing_classes -> [], no ws = heartbeat). routes: early(app) mounts express.json({limit 64mb}) on /rpsl +
  express.raw multipart on /rpsl/upload BEFORE the global express.json (100 kB); mount(app) beside remoteGpu.
- THE ENDPOINT: RunPod's worker-comfyui 5.x (AGPL - only called over HTTP; read from its handler.py, cloned at
  /home/claude/runpod-workers/worker-comfyui, v5.10.0, ComfyUI 0.34.0). POST https://api.runpod.ai/v2/<ep>/run
  {input:{workflow, images:[{name, image base64}]}} (10 MB max), GET /status/<job> (IN_QUEUE, IN_PROGRESS, COMPLETED,
  FAILED, CANCELLED, TIMED_OUT; output {images:[{filename, type base64|s3_url, data}], errors} or {error, details}),
  POST /cancel/<job>, GET /health {jobs, workers}. Results kept 30 min at RunPod - collected at once. Base URL override
  for tests: env H3_RUNPOD_SLS_API (the gate starts the studio with http://127.0.0.1:8399/v2).
- The worker returns ONLY node outputs under "images" (not temp) - so adapt(graph) before sending: VHS_VideoCombine
  (save_output true, not linked from another node) -> SaveVideo (same id; format/codec "auto" like ref2va.json) fed by a
  new CreateVideo {images, fps: frame_rate, audio?}; SaveAudio / SaveAudioMP3 / SaveAudioOpus / SaveAudioAdvanced /
  PreviewAudio -> EmptyImage 16x16 batch 1800 + CreateVideo fps 1 + audio -> SaveVideo "h3audio-<ext>-<prefix>"
  (SaveVideo cuts the sound at frames/fps); collect() takes the sound out with ffmpeg (-vn, mp3/flac/wav/opus/ogg) as
  <prefix>_00001_.<ext>. Results land in workspace/runpod_sls/out/<pid>/ and the history files each under the save node
  whose filename_prefix it starts with (savers/nodeFor; else "runpod"). Uploaded files (workspace/runpod_sls/in) that a
  workflow string names go in input.images. Over 10 MB -> /prompt answers ComfyUI's 400 {error:{message}} before sending.
  sweep() drops files / jobs older than a day.
- lib/remoteGpu.js: MODES + "serverless", slsUrl(), describe/save/use (needs the RunPod key + endpoint), view().serverless.
  lib/modelsFound.js: rgpu.mode ssh | serverless = remote (the model check is skipped - also fixes the SSH tunnel case).
  static/remotegpu.js: radio "RunPod Serverless" (the pod one is now labelled "RunPod pod"), #rgSlsKey (saves runpod.key),
  #rgEndpoint, #rgSlsCost, #rgSlsHelp, ✓ Test -> POST /api/remotegpu/serverless/test (health line).
- CHECKED BY HAND through the real workers with a stand-in RunPod (scratchpad rpfake.js): an image style, an ACE-Step
  song (-> mp3 in Sound assets), a MiniMax H3 t2va video (with engine.comfy.workflows -> e2e_api.json: the shipped
  comfy_workflows/t2va.json is a UI export, which worker.py refuses on ANY backend - not a serverless issue).
  NOT run against real RunPod (needs Tim's account + an endpoint). Tim needs: a network volume with models/, an
  endpoint from runpod/worker-comfyui:<5.x>-base, or his own image with the custom nodes (MiniMax H3 nodes, VHS ...).
- ALSO FIXED 2.742.0: static/basictabs.js owner = "" until the first trusted click (after a reload the tab lit at boot
  claimed the project's settings, and a later app switch made clicking back skip the restore); the restore is skipped
  only when the clicked tab was already the active one (prevActive).
- Tests: test-rpsl743.js (37 - comfy_client run as a worker against a stand-in RunPod + the routes on an express app),
  test-ui743-ui.js (8), test-remote520 / test-ui520-ui MODES updated. ci-units 323/0. Gate 1930 legs.

## 2.742.0 — 🗂 EVERY BASIC SETTINGS TAB KEEPS ITS OWN SETTINGS (2026-11-09, main 8b8b938, tigerart refresh 0e28e5a)

Tim: "when the tab is changed save the settings of the tab before it is changed and revert when tab is changed back"
-> (interrupting my first reading, the ⚙ Settings dialog) "i mean the basic settings docker".
- static/basictabs.js -> window.H3BasicTabs {modes(), snapshot(), forget(), owner(), FIELDS}; script tag after
  basicset.js. The mode strip .modes: a CAPTURE click listener saves the leaving tab's FIELDS (format, resSel, arSel,
  width, height, seconds, segSec, steps, cfg, seed (the hidden #seed - seedctl's setter repaints 🎲/📌), vidModel,
  swapStart, swapDur) to localStorage h3.basicTabs {modes:{mode:{id:value}}}; a BUBBLE listener puts the opened tab's
  back (that order: Format first - socialfmt sets the aspect; width/height only for "custom"; selects only to values
  they hold) firing change / input so updateWH, stepsLabel, store vsteps/vcfg, the plan line follow.
  e.isTrusted ONLY: project open (13096), auto ref2va/fl2va (11308, 15252), swap (13388) change nothing. `owner` = the
  tab the user last opened - the showing settings are saved under it, never under a mode the app picked.
- Standard / Character chain: #bsTabChain's onclick repaints from cfg.chain (chainCfgPaint) - basictabs keeps the typed
  values (capture on #bsTabStd while #chset shows) and puts them back after that repaint; #chCfgSave clears them.
- Not per tab (on purpose): the style card (#bsStyleCard - saves into the style), Temporary LoRAs (a project file),
  Override style. The image / graph sets were already separate fields.
- Tests: test-ui742-ui.js (12, REAL clicks - p.click after an elementFromPoint check). ci-units 323/0. Gate 1928 legs.

## 2.741.0 — 🎶 ACE-STEP 1.5 + EVERY SOUND SETTING ON SETTINGS ▸ AUDIO (2026-11-09, main 9639e14, tigerart refresh a211d60)

Tim: "do u think it would be good to add ace step?" -> yes (plan: 1 the music style, 2 Repaint / Cover, 3 tempo / key
into Create). Tim: "yes please we can also add an audio tab to general settings, ace step can use loras , i am not sure
about the other" -> AskUserQuestion answer "All on the Audio tab". THIS RELEASE = step 1 + the Audio tab. Steps 2 and 3
are NOT asked for yet - offer them.
- comfy_workflows/audio_ace_step_1_5.json: ComfyUI's template Comfy-Org/workflow_templates
  templates/audio_ace_step_1_5_split.json in API form, input names checked against ComfyUI's source
  (comfy_extras/nodes_ace.py etc.). Nodes: 104 UNETLoader acestep_v1.5_turbo, 105 DualCLIPLoader qwen_0.6b_ace15 +
  qwen_1.7b_ace15 type "ace", 106 VAELoader ace_1.5_vae, 94 TextEncodeAceStepAudio1.5 (tags, lyrics, seed, bpm,
  duration, timesignature '2'|'3'|'4'|'6', language (51), keyscale (34), generate_audio_codes, cfg_scale, temperature,
  top_p, top_k, min_p), 47 ConditioningZeroOut, 98 EmptyAceStep1.5LatentAudio, 78 ModelSamplingAuraFlow shift 3,
  3 KSampler 8 steps cfg 1 euler/simple, 18 VAEDecodeAudio, 107 SaveAudioAdvanced ("format": "mp3" + "format.quality":
  "V0" - a dynamic combo).
- scripts/comfy_image.py patch: ACE block (class TextEncodeAceStepAudio1.5 / TextEncodeAceStepAudio): tags = caption,
  duration (encoder + latent), bpm / keyscale / timesignature (style.timesig) / language - link-guarded, blank = the
  template's. apply_loras(..., model_only=(kind == "music")) -> build_loras uses LoraLoaderModelOnly (chain 104 -> 108 ->
  109 -> 78); image styles keep LoraLoader.
- lib/musicArch.json: arch "ace-step-1.5" APPENDED LAST (archIdsFor(kind)[0] is the fallback arch) - te 2 slots
  (clip_name1/clip_name2), defaults, limits max_duration 600, loras: true, meta {bpm, keyscales, timesigs, languages}.
  lib/styles.js musicMeta(a, pick) validates bpm / keyscale / timesig / language against arch.meta; starter
  "ACE-Step 1.5" (before MiniMax). lib/modelCatalog.json: 4 group-music entries, repo
  Comfy-Org/ace_step_1.5_ComfyUI_files (≈9.3 GB) - the ModelsFound download box fetches them.
- static/index.html: no Music settings tab; #stab-audio = nav.ausubnav (data-auto jump buttons) + section#stab-music
  (h3#auMusicH) + h3#auSpeechH + h3#auAsrH. Form: #s_muace (s_mubpm, s_mukey, s_mutime "Beats a bar", s_mulang) and
  #s_mulorasec (#s_muloras rows via loraRow, #s_muloraadd) - paintMuAce(arch, s) shows them only when arch.meta /
  arch.loras (MiniMax / YuE: neither - not known to take LoRAs). Texts "Settings → Audio ▸ Music styles" (also
  musicdock.js, dock.html, music_worker.py).
- NOT run for real here (no GPU / no models): structurally verified against ComfyUI's source.
- Tests: test-acestep741.py (17), test-ui741-ui.js (11); test-styles 190, test-imageui 326. UI 8966/8966, 1058/1058.
  ci-units 323/0. Gate 1927 legs.

## 2.740.0 — ⬇ MISSING PARTS: DOWNLOAD / CANCEL, INSTALLED IN PLACE (2026-11-09, main db28b9d, tigerart refresh 779ce7d)

Tim: "Create stopped at the split: demucs is not installed — press Install in the Stems dock , if a model needs to be
installed show the download/cancel msgbox and download the model instead of asking user to find install"
- static/needinstall.js -> window.H3NeedInstall {ensure(which, why), status(which), PARTS}; script tag after
  modelsfound.js in static/index.html. PARTS demucs (GET /api/stems) + whisper (GET /api/asr): name / desc / hint (props
  the ui-dynamic scanner reads). ensure: installed -> true; else dialog#niDlg[data-which] (.nidlg, h2, .niwhy, .nipart,
  .nibar (pct or .busy slide), .niline (last log line), .nierr, #niCancel focused, #niGo ⬇ Download). Download ->
  POST /api/audio/install {which} -> poll /api/jobs/<id>?log_from=n every 1.5 s -> done: close, resolve true; fail: ✗ +
  "⬇ Try again"; Close while running = resolve false, the job keeps going. A second ensure for the same part shares the
  open box. The words are textContent writes; the "why" lines are fixed sentences (no song names) so they translate.
  NOTE: uilang ignores patterns whose fixed words are tiny ("It {0}") - write full sentences.
- Callers: sheetcreate.js (demucs before the split -> throw "the song separation is not installed…"; whisper before
  the ASR when #muLyrics is empty -> words skipped "speech to text is not installed"), muscore.js separate() -> ensure ->
  splitNow(song, btn), stemsdock.js stGo (ensure, then re-runs its own onclick with dataset.niOk).
- ModelsFound (2.719.0) already asks for ComfyUI model files on /api/genmusic, so Create's 3rd step is covered.
- Tests: test-ui740-ui.js (8; routes answer /api/stems, /api/asr, /api/audio/install, /api/jobs/e2einst_*). UI
  8949/8949, 1058/1058. ci-units 323/0.

## 2.739.0 — ✨ CREATE (2026-11-09, main f168107, tigerart refresh 3a57a32)

Tim: "add a button - Create - this will use the audio file + lyrics from song or loaded file or transcribed file, split
the stems show the different waveforms and create the sheet music - i think this will make it less complicated"
- ext/musicdock/sheetcreate.js (window.SheetCreate {create, fill, upload, busy}; ext.json scripts + sheetcreate.js):
  #muCreateSrc = S.songs ("src/name", "· split" when 4 layers) + "__file" (📂 -> #muSheetRef.click() -> upload via
  POST /api/stems/upload -> refresh -> "sound/<name>"); default = baseOf(#muTitle) match, else the newest. fill() on
  document "h3:muscores" (MuScore.refresh fires it). create(): split (skip if layers.drums) -> previewLayers -> lyrics
  (#muLyrics, else POST /api/asr/transcribe {name: layers.vocals, mode: "lyrics"} -> into #muLyrics + input event) ->
  fetch the song as a File -> window.MuVariantJob({variant: "abc", refFile, done, fail}) -> linkSong(abc, song), tick
  words, refresh(abc) + load(abc). #muCreateSteps .muStep[data-step][data-state doing|done|skip|fail].
- musicdock.js muVariantJob: fail() hooks (opts.fail) at every non-done exit; window.MuVariantJob.
- muscore.js: previewLayers(song) (S.preview; lanes without a player, toggles disabled, no split bar), linkSong(score,
  song) -> songMapSave, exports baseOf / keyOf / urlOf, refresh() dispatches h3:muscores; show() clears S.preview.
- dock.html make bar: Song select · ✨ Create (.muPri) | 🎼 Write from lyrics · status. Audio file… + Transcribe REMOVED
  (musicdock.js's goSheetTranscribe handler is guarded, harmless). test-yue2 now checks goSheetCreate.
- Tests: test-ui739-ui.js (10; page.route answers separate / asr / genmusic / jobs; the test adds a placeholder
  #musicSel option and stubs ensureComfyReady; a scripted select is no user gesture, so the test counts the file-box
  click). test-ui736 make-bar centres. UI 8937/8937, 1054/1054. ci-units 323/0.

## 2.738.0 — 🎚 THE REAL SONG IN ITS LAYERS, AS WAVEFORMS (2026-11-09, main 3c4cccd, tigerart refresh da3afd0)

Tim: "when playing in sheet music play the actual song in it's separated layers, show the layers as waveforms. right now
it sounds like a 1980's watch" (he heard the synth: Write / Transcribe / Open .abc scores have no audio beside them).
- scripts/stems_local.py job.layers 4 -> no --two-stems -> {vocals, drums, bass, other} (<stem>_<k>.wav); lib/stems.js
  separate(name, {layers: 4}); POST /api/stems/separate {file, layers: 4}. Two-stem default unchanged (Stems docker).
- lib/scores.js: layersFor(audio) (4, else vocals+instrumental, else null), songs() (output/final/sound audio minus
  LAYER_SUFFIX names, newest first, {name, src, mtime, size, layers?}); GET /api/scores {files, songs}.
- muscore.js: S.songs; #muPlaySound = "synth" + "song:<src>/<name>" options (· 4 layers / · 2 layers); songChoice(score):
  localStorage h3.muScoreSong[score] ("synth" or "src/name") > audio beside > baseOf() title match (timestamp
  _YYYYMMDD-HHMMSS… stripped, letters+digits lowercased) > synth. curSong(); laneList(song); playMake: layers -> tracks
  (urlOf sound), plain -> audioUrl (urlOf src: output/final -> /outputs/, sound -> /passets/sound/). layersBuild() #muLayers
  lanes (.muLane[data-lane] > .muMix[data-track] + .muWave[data-key] canvas/.muPlayed/.muHead; Song lane = span), the
  ✂ #muStemSep "Split into layers" bar when not 4; drawWave (peaks cached in WAVES, LAYER_COL, canvas.dataset.peaks);
  lanesPaint() in paint(); laneSeek -> seek(audioT - sync); mixToggle data-track (Shift solo) greys .muLane.off. mixBuild()
  only for the synth (staff toggles). Sound change saves the pick + resets trackOff.
- scoreplayer.js synth: soft piano strike (decaying partials, gainFor(midi), ring 0.9+140/hz s) through busOf(): lowpass
  3.2 kHz -> dry + delay 85 ms fb .22 -> compressor; bus reset on destroy.
- capture-sheet-shots.js: demoLayers() renders Night Drive (vocals = vocal staff with vibrato, other = piano, bass = the
  chords' lowest note -12 on beats 1+3, drums = kick/snare/hats) to Night Drive.wav + 4 layers; viewport 1310x1180.
- Tests: test-ui738-ui.js (14). test-ui733 + test-ui737 updated (Sound lists songs; song toggles on lanes; split = 4).
  UI strings 8930/8930, patterns 1053/1053. ci-units 323/0.

## 2.737.0 — 🎼 PARTS AND THE MIX (2026-11-09, main fcb5b26 + 33521ab, tigerart refresh 7a3c025)

Tim: "in sheet music , can we separate the instruments and have sheet music for each instrument and another for vocals?
and have toggle buttons to play each instrument and vocals?"
- abcscore.js (version 2.737.0): render opts.parts [i…] -> S = S0 with those voices only (layout as a smaller score);
  partOf maps back: timing notes/sound v = the score's index (vIdx). result.parts [{i, name, snm, vocal}] (vocal = the first
  matching vocal|voice|sing|vox|lead|lyric, only marked if it matches when >1 staff) and result.shown. Words only when the
  part holds the vocal staff (vocal = partOf.indexOf(vocalAll), -1 = none). opts.partName drawn TB 12 at x = ml on the
  composer's line, only for a real part; a one-staff part skips the staff label (names=false).
- scoreplayer.js: o.isMuted(v) checked in schedule(); api.remix() (synth: seek(pos) = hush + restrike); eng.struck /
  api.struck() per staff; o.tracks [{key, url, on}] - N <audio>, the first leads, follow() keeps the rest within 60 ms
  (on every frame and hard on play/seek); api.setTrack(key, on) = el.muted; api.tracks() [{key, on, t, paused}].
- lib/scores.js stemsFor(audio): <stem>_vocals / _instrumental (+ any AUDIO ext) in pDir("sound") -> list() stems;
  played from /passets/sound/<name>. demucs is TWO-stem (--two-stems=vocals): only Vocals / Instruments for a real song.
- muscore.js: S.part (-1 full), S.mute {v: true}, S.trackOff {vocals|instrumental}; reset when the score changes
  (S.partOf = name + text length). show(): render with parts + partName; for a part a second full render gives
  r.timing.sound (all staves play). partsBuild() #muParts tabs (data-part, data-vocal, aria-selected); setPart(i) keeps
  position + playing. mixBuild() #muPlayMix: song + stems -> Vocals / Instruments (data-track); song without stems ->
  #muStemSep ✂ Separate vocals (POST /api/stems/separate {file: song}, then refresh + playMake(at)); notes -> a .muMix
  per staff (data-staff; Shift = solo / all back). PDF name + Read title carry " - <part>".
- dynamic.json regenerated (node scripts/ui-dynamic.js, needs global typescript): it caught up 2.73x words, so 26
  strings + 9 patterns had to be translated too (CI test-uilang706 / test-langpacks715 want every pattern, 99 %+ words).
  Now 8924/8924, 1049/1049. LESSON: after ui-dynamic.js, run i18n-ui.js status for each language before pushing.
- Tests: test-parts737.js (17), test-ui737-ui.js (18 - page.route answers /api/stems/separate; fake WAV stems in
  projects/default/sound). Gate +2. USAGE + 3, FEATURES line 362 x4, CHANGELOG, PDFs, docs/images retaken.

## 2.736.0 — 🎼 THE SHEET MUSIC TAB REMADE TO MATCH bitGen (2026-11-09, main bce8e36, tigerart refresh f223827)

Tim: "in sheet music docker make the buttons a normal size button not full docker width. fix the layout , the media
buttons are not right and remake the rayout to match bitgen . it looks cheap"
- dock.html #muPaneSheet: no .go anywhere (.go = width 100% + margin-top 11 px app-wide - never use it in a toolbar).
  .muTb toolbars (#muSheetMake: Write (.muPri) | 🎵 Audio file… = label#muSheetRefL.ghost over a hidden #muSheetRef, name in
  #muSheetRefName | Transcribe | #muSheetStatus .muMeta; #muScoreBar: .muGrp groups [Score select ↻ Open] | [Read, Save PDF
  (.muPri), download too] | [words, Paper, ABC text, Copy]), .muSep dividers, .muIn inline labels. .muViewer = #muPlayBar
  (.muTrans header: 5 .ghost [data-act] buttons with inline svg icons, .muTime mono, #muPlayBarNo, Sound, Sync (s), follow)
  + #muScore. muscore.js MuScore.ICONS {start, back, play, pause, fwd, end}; the toggle sets data-icon + innerHTML (orange
  when pause); ⛶ Read builds the same (#muSvPlay.muTrans) and Save PDF as .ghost.muPri.
- UI strings: +6 (The song as sheet music, the help's second part, Write from lyrics, the audio file title, Make a score,
  The score), -5 old. test-ui736-ui.js (11). test-ui731 now measures "#muSvPages svg"; test-ui733 reads ▶/⏸ from
  data-icon. Gate +1. USAGE + 3, CHANGELOG, PDFs.

## 2.735.1 + the website's sheet music row (2026-11-09, main f8e1d36 / site-keys 3ad2e5e, tigerart 444bc54)

Tim: "can you add the music/sheet music images to the front page".
- 2.735.1: #muPlayToggle was a full-width .go (fixed; superseded by 2.736.0). scripts/capture-sheet-shots.js [outDir]:
  against a running studio (H3_PORT 8311), writes "Night Drive.abc" (verse + chorus, Vocal + Piano, Am F C G, the
  music.png lyrics; melody fitted to the app's syllables: Ra-dio, E-ve-ry) to outputs, folds the side columns
  (tL/tRefs/tAssets/tR/tQ), maximises + pins #musicdock over the window (capture-only CSS, bbody padding-bottom for scroll
  room), parchment, words on, seeks to "clo-" -> docs/images/sheet-music.png (crop: #muSheetMake to the viewer's edge) and
  sheet-music-read.png (the dialog). Start the studio WITHOUT a stray docker.cfg / panel_layout.cfg (test layouts).
- tigerart: index.php row 6 'sheet-music' "Read it as sheet music" after music; website-sync.py SHOTS "sheet-music": 1310;
  6 site strings x3 (751); test-site six rows (214). Bitgen docs/i18n/site-keys.json 751.

## 2.735.0 — ✨ THE WORDS LIT AS THEY ARE SUNG (2026-11-09, main eaa1b08, tigerart refresh 609cd9d)

Tim: "can the words be highlighted as the song is sung?"
- static/abcscore.js (version 2.735.0): the grouping marks each sung slot pc.slot; after the notes' ids the timing block
  builds timing.words [{id, t0, t1, s}] (only with lyrics) walking pcs[vocal] bar by bar: rest/barRest -> close; pc.syl
  -> a new word (pc.wid = id); a first piece that is a slot with no syllable -> close; else (tie, slur note, piece over
  the barline) extend t1. lyrQ / the lyric text op carry w; toSVG writes data-w on <text> (hyphens unmarked).
  Spacing: the last column of a bar needs HEAD_W/2 + lyr/2 + 0.35 sp before the barline; inf.lead = max(0, lyr0/2 -
  HEAD_W/2 - 1.0 + 0.35 - acc0) sp before the first column (added to inf.fixed and the start x) - fixes words of two
  bars touching ("world,sing", gap 0.2 -> 3.5 pt).
- scoreplayer.js: wordsAt(T, tick) (like activeAt over T.words). muscore.js: relight() also indexes text[data-w] into
  PB.wels; paint() toggles .abcOn on wordsAt (PB.wlit); a click on #muScore / #muSvPages text[data-w] seeks to its t0
  (H3TestEvent mu_score_wseek). dock.html: .abcPage text.abcOn {fill #e8742b, bold}, text[data-w] cursor pointer.
- Tests: test-sungwords735.js (21), test-ui735-ui.js (11; the test page has other panels over the inline dock, so the
  word click is a dispatched MouseEvent like 2.731's element.click()). Gate +2. USAGE + ja / zh-CN / zh-TW, FEATURES line
  361 x4, CHANGELOG, PDFs. No UI strings.

## 2.734.0 — 🗣 WORDS UNDER THE SHEET MUSIC (2026-11-09)

Tim: "can we add a checkbox in the sheetmusic tab to add the words, add the lyrics of the song that is being worked on
in the lyrics input".
- static/abcscore.js: syllables(word) - vowel groups (y not first), silent final e (not -le after a consonant), silent
  -ed (not after t/d) / -es (not after s x z g c, ch/sh) only after a vowel, a doubled consonant or a known cluster (lk rk
  sk nk nc mp rn rm rl lm wn sh ch ng ss); cuts: none = hiatus, 1 consonant V-CV, -le, ch/sh/th/ph/wh/gh pair, ck/ng/ght
  stay left, 3+ consonants before an onset pair (mon-ster) else before the last, 2 = VC-CV; -ing forced (walk-ing,
  run-ning; not after th); CJK = per character; punctuation to the ends. lyricsSections(text): "[tag]" (line start) ->
  sections {name, key = letters only lowercase}, typed hyphens split words. render opts.lyrics: vocal voice = first whose
  name/snm/id matches vocal|voice|sing|vox|lead|lyric else 0; sung notes = first piece of a note event, not all heads
  tieIn, not inside a slur; score groups by % section; tagged both sides -> each score section takes the next unused
  lyric section of the same key, else that key's last one (chorus again), else the next unused; untagged = flat.
  pc.syl -> spacing: c.lyr (text width + 0.6 sp for a hyphen), each column needs half its own + half the next's + 0.7
  sp; drawn after ties at max(4 sp, box.bottom) + 13 (Times-Roman 10, anchor middle at the head's centre), "-" between a
  word's syllables when there is room (at the system end after it). result.words {syllables, used, placed, notes,
  voice, sections}.
- muscore.js: #muScoreWords ("words", localStorage h3.muScoreWords, restored in boot before the first draw); show()
  renders with #muLyrics' text when ticked and adds "· words: P of N sung notes under <voice> (k syllables more than the
  notes)" / "the Song tab's lyrics are empty" to the status; change -> redraw(); #muLyrics input -> redraw after 700 ms
  (not while playing). MuScore.words(on?).
- Tests: test-words734.js (18), test-ui734-ui.js (10). Gate +2. 2 UI strings, USAGE + 3, FEATURES line 360 x4,
  CHANGELOG, PDFs.

## 2.733.0 — ⏫ ENHANCE ON A PICTURE + ▶ THE SHEET MUSIC PLAYS, ITS NOTES LIT (2026-11-09)

Tim: "if we select an image thumbnail and press the enhance buton can we upscale the image" + "in sheet music tab add
media buttons play/pause, rewind,rewind to start,foward , foward to end buttons for the songs sheet music and highlight
the notes as the song is played". He also said he deleted all the wip/ branches (origin still listed wip/2.703.0-i18n and
wip/2.704.0-zhtw after a prune - mention it if he asks).
- PICTURE UPSCALE. static/selvideo.js: pickedImg {name, from gallery|asset|ref, url}, lastKind; capture clicks on
  #gallery .thumb (image name + data-lb-kind image), #tray .imgwrap[data-lb-kind=image] (a blob url - refs[] File), and
  [data-apane=images] .aitem; SelVideo.getImage() / kind() / pickImage(); ring (.svpick, svkey "img:from/name"); event
  h3:selmedia {kind, video, image}; the observer also watches #tray. index.html: paintEnhanceBtn names the picture when
  kind()==="image"; $("enhanceBtn").onclick opens ImgUpscalePanel for a picture (closes SeedVR2's) else SeedVR2Panel.
  static/imgupscalepanel.js (#iuPanel: iuSize x2|x3|x4|1080|1440|2160, iuMethod seedvr2|model|lanczos, iuModel - SeedVR2
  files from /api/comfymodels diffusion_models or upscale_models, iuColor, iuDenoise; a ref picture -> POST
  /api/imgupscale/upload (raw bytes) once -> {name token, from "upload"}). lib/imgUpscale.js (imgupscale.json per project;
  resolve: gallery = output/, project, final/, images/; asset = images/ first; upload = <tempDir>/imgupscale/; sniff
  PNG/JPEG/WebP/BMP; target via seedvr2.target, MAX_SIDE 8192; jobParams mode "imgupscale", output_name
  <stem>_upscaled_<w>x<h>.png). routes/imgupscale.js mounted in routes/index.js. lib/core.js WORKER_FOR imgupscale.
  misc/imgupscale_worker.py (uses seedvr2_worker as W for probe/listed/_comfy; SV.pick_model / pick_vae; size_verdict
  "source" = fail; a few px off (SeedVR2 pads to 16) -> ffmpeg lanczos to exact). scripts/imgupscale_graph.py reuses
  tailpngs.graph_seedvr2 (Tim's utility_seedvr2_7b_int8_upscale_image_api.json) + tailpngs.graph (image_upscale_model.json).
  stub-comfy: render_img_upscale (LoadImage + SeedVR2Conditioning or ImageUpscaleWithModel; pads to 16;
  STUB_SEEDVR2_KEEP_SIZE), picture uploads kept in _inputs, UpscaleModelLoader + ImageUpscaleWithModel schemas.
- SHEET MUSIC PLAYER. abcscore.js render().timing = {total, qpm (Q beat-aware; 120 default, tempoGiven), tpq 480,
  seconds, barStarts[], bars[i] = {page, x0, x1, y0, y1, t0, t1} (system places, shifted with the page spread), notes[]
  sorted by (t0, voice) with id = index = the SVG head's data-n, sound[] {v, midi, t0, t1} (a tie extends, not re-struck)}.
  ext/musicdock/scoreplayer.js (UMD; ext.json order musicdock, scorepaper, scoreplayer, muscore): pure secPerTick / tickAt
  / secAt / barAt / activeAt / prevBar (this bar's start, or the previous one within 0.5 s) / nextBar / fmt / midiHz;
  create({timing, audioUrl, offset, onFrame, onError}) -> song engine (<audio>, pos = currentTime - offset) or synth
  (AudioContext, triangle + sine octave, a 1.2 s look-ahead scheduler every 100 ms); toggle/back/forward/toStart/toEnd/
  seek/setOffset/destroy; a rAF loop calls onFrame while playing. lib/scores.js list() adds `audio` (same stem, .wav .mp3
  .flac .ogg .opus .m4a .aac). dock.html #muPlayBar (data-act start|back|toggle|fwd|end, #muPlayTime, #muPlayBarNo,
  #muPlaySound song|synth, #muPlaySync (localStorage "h3.muScoreSync" per score name), #muPlayFollow), CSS .abcOn /
  .abcBar; ⛶ Read header #muSvPlay + #muSvTime. muscore.js: playSetup after show(), relight() after every redraw
  (indexes data-n, inserts a rect.abcBar per page svg before its first path), paint(sec, tick) lights / bands / follows,
  a click on path[data-n] seeks, MuScore.player() / playAct(act). Score list marks 🎵 for scores with a song.
- Tests: test-imgupscale733.py (16), test-player733.js (18), test-ui733-ui.js (18; Chromium needs
  --autoplay-policy=no-user-gesture-required). test-stylecard.js ({0,1200}) and test-stylecard-ui.js (the new Enhance
  wording) updated. 33 UI strings (the panel's and ⛶ Read's added by hand - built lazily, the collector misses them).
  USAGE 2 sections + 3 translations (each translated section needs its own <!-- en: … --> marker line - a missing one
  is silently dropped by assemble), FEATURES lines 263 + 359 in all four, CHANGELOG, PDFs, gate +3. A stray
  play-view.png was committed by mistake and removed in ce28d74 (same release).
- Not checked here: SeedVR2 / an upscale model on Tim's GPU (the stub only), the song playback timing against a real
  YuE2 song (the Sync control is there for an intro).

## 2.732.0 — 🎨 PAPER FOR THE SHEET MUSIC: COLOUR, A TILED MATERIAL OR A PICTURE, THE INK (2026-11-09)

Tim: "allow user to choose background color/material tiling for the sheet music".
- ext/musicdock/scorepaper.js (window.ScorePaper, UMD; loaded before muscore.js in ext.json): normalize (colour #hex,
  material plain|parchment|linen|laid|recycled|watercolour|canvas|kraft|picture, size 40-600 pt, strength 0-100, ink
  auto|black|sepia|navy|white, pdf bool, picture {src: /passets/images/<n> | data:image/…, name}), luminance, inkFor (auto:
  luminance < 0.2 -> INKS.white #f5f0e4 else #141414), load/save (localStorage "h3.muScorePaper"), material(id) = a 512 px
  seamless canvas (mulberry seed, wrap() draws across edges), look(settings) -> {svg: {paper: {color, avg, tile: {href, w,
  h}}, ink}, pdf: {… tile: {jpeg Uint8Array, w, h}}, avg, ink} - the tile = colour + material at strength, ONE canvas.toBlob
  JPEG (q 0.88); picture tiles keep their aspect (h = size * ih/iw); shrink(file) -> a 1024 px JPEG data URL.
- static/abcscore.js (version 2.732.0): toSVG(page, {look, id}) - rect in the paper colour (#ffffff default - note the
  2.731 tests now expect "#ffffff"), <pattern id="abcp<id>"> with the tile image, paths/text in the ink, op.g words =
  soft(ink, avg, g). toPDF(pages, meta, look): colour -> "q r g b rg 0 0 W H re f Q"; JPEG -> XObject (jpegInfo reads the
  SOF: DeviceRGB / DeviceGray / DeviceCMYK+Decode) + PatternType 1 (BBox/XStep/YStep = tile pt, Matrix ty = page H so it
  starts at the top like the SVG), every page "/Pattern cs /P1 scn ... re f"; the ink "r g b rg r g b RG"; binary written
  as latin1 chars (bin()) so xref offsets stay byte-exact. Not a JPEG = ignored (colour only).
- muscore.js: S.look/S.paper, svgOf(pg, k, "m"|"v"), repaint() redraws SVGs only (layout kept), setPaper(o) (saves,
  look(), repaint, status "🎨 paper: …", test event mu_score_paper), paperBuild() at boot (lists: Materials optgroup, Pictures
  optgroup with "file:" + project images "pic:<name>"), swatches, ink options; Save PDF passes look.pdf unless "in the PDF
  too" is off. dock.html #muPaperBtn, #muPaperRow (#muPaperColor, #muPaperSwatches, #muPaperMat, #muPaperSize(+V),
  #muPaperStrength(+V), #muPaperInk, #muPaperPdf, #muPaperReset, #muPaperFile).
- Tests: test-paper732.js (23; tiny RGB + grey JPEG fixtures inline as base64; pdftoppm has no -ppm flag - ppm is its
  default), test-ui732-ui.js (10). 39 UI strings, USAGE + 3, FEATURES line 357 x4, CHANGELOG, PDFs, gate +2.
- Same day, the website (tigerart a53653e, no app version; Bitgen docs/i18n/site-keys.json 745 in 2.732.0): Tim pasted
  Visitors - US/Oregon 9 + Unknown 9 from "itimports.net." landing on the 404 page (54% of page views) = a robot posing as
  a browser (referrer spam), and "Iowa 0". inc/stats.php: stats_update() shared; stats_hit('404.php') ->
  stats_add_missing(stats_missing_path(REQUEST_URI)) - the path only (no query; /^\/[A-Za-z0-9/._~%-]{0,79}$/ else
  "(other)"; 300 a day) into the day file's "missing" map - not a visit / page view / country / source; robots not at all.
  stats_source rtrims the host's trailing dot. b_admin/lib/stats.php: old 404.php rows -> missing["(before this was kept)"]
  (out of every total), stats_missing_html "Not found" list, stats_states_html (states by visits; a state with page views
  only says "N page views"). privacy.php one new sentence (+ ja/zh-CN/zh-TW in inc/i18n). test-stats 39 / admin 91 / site 214.

## 2.731.0 — 🎼 REAL SHEET MUSIC IN THE MUSIC DOCKER: ENGRAVED ON THE STAFF, SAVED AS A PDF (2026-11-09)

Tim: "in our music docker, sheet music tab can we have real sheet music with the notes drawn on the staff with it's
clefs etc. and save as pdf?" (+ standing: "just use the standards don't import anything").
- static/abcscore.js (UMD: window.AbcScore / require) = OUR OWN engraver, no library, no music font: parse(text) ->
  score; render(textOrScore, {title, sp=5.0 pt, A4 margins}) -> {pages:[{w,h,ops}], title, voices, measures, systems,
  warnings, empty}; toSVG(page); toPDF(pages, {title, subject}) -> Uint8Array (PDF 1.4 by hand: catalog, pages, 6 of the
  standard 14 fonts H/HB/HO/TB/TR/TI with WinAnsiEncoding, uncompressed content streams, y flipped, xref; pdfStr maps
  WinAnsi, ♯ -> #, ♭ -> b, CJK -> ?). Ops: {t:"p", d:[["M",x,y],["L"..],["C"..],["Z"]], fill, stroke, w, eo, cap} |
  {t:"t", x, y, s, f, z, a:"m"|"e", g}. Text widths from Helvetica's AFM table x a per-font factor.
- Reader: YuE2 dialect (V: Vocal/Ins name= snm= clef=, % comments = sections, Z<n> = n bar rests, "Cmaj7" chords, L:1/16)
  + ABC 2.1 basics ([chords], (p:q:r tuplets, > < broken, - ties, ( ) slurs, |: :| :: || |] [| bars, [1 |2 endings,
  inline [K:][M:][L:][V:], K: modes + explicit accidentals + clef=, M:C C| none, Q:"text" 1/4=n, T: x2 = subtitle, C:).
  Ticks: WHOLE = 1920. Accidentals propagate by LETTER across octaves within the bar (barAcc reset when a bar CLOSES -
  the bug was resetting it on open, after the first note had set it); tied unmarked continuation keeps its pitch. Skipped:
  grace notes {..}, decorations, w: lyrics, & overlays, a mid-voice clef change (first clef kept), 2nd+ tunes (warning).
- Engraver: written values split greedily into tied pieces (VALUES incl. dots / double dots); tuplets keep their written
  value; shown accidentals per staff position per bar (tied-over notes none); stems by the furthest note; beams per beat
  (6/8 dotted quarter, 2/2 half; tuplet = one group; a source space breaks), slope clamped +-1 sp, stems reach the middle
  line, secondary beams + stubs; columns shared by all voices (spring 0.9 + 1.9 sqrt(d/quarter)); line breaks by DP
  (fill^2 cost, +0.15 if not at a section / every 4 bars); justify all but a short last system; vertical staff spacing
  from each staff's bbox; full pages spread (<=40 pt per gap); page numbers n / N when >1 page. Glyphs (G/F/C clefs,
  sharp/flat/natural/x/bb, quarter/eighth.. rests, flags, ties as filled crescents) hand-made in staff-space units -
  checked by screenshots.
- UI: ext/musicdock/muscore.js (window.MuScore {show, load, refresh, savePdf, openView, titleFrom, state}; listeners on
  the document), dock.html Sheet pane: #muScoreBar (#muScoreList, #muScoreRefresh, #muAbcOpen/#muAbcFile, #muScoreBig ⛶ Read,
  #muScorePdf 💾 Save PDF + #muScoreDl, #muAbcToggle, #muAbcCopy), #muScore (white .muPaper SVG pages), #muAbc hidden;
  dialog #muScoreView (#muSvPdf, #muSvClose). The tab's first open lists scores + draws the newest. musicdock.js muShowAbc
  -> MuScore.refresh(name).then(show). Title = T: or the file stem minus its timestamp. Save PDF -> POST /api/pdf/save
  (projects/<p>/pdf, same name = replaced) + Blob download.
- lib/scores.js list() (.abc in output, project root, final - newest first, max 500) + routes/scores.js GET /api/scores,
  mounted in routes/index.js. index.html loads /static/abcscore.js after flowhmrpanel.js; ext.json scripts + muscore.js.
- Tests: test-abcscore731.js (45 units incl. qpdf/pdfinfo/pdftoppm/pdftotext, 600 seeded scrambled scores, 160-bar speed),
  test-ui731-ui.js (16; clicks via element.click() - a leftover floating StoryBoard panel can cover the button on this
  box). Gate +2 (after the 2.690.0 block). 18 UI strings (added by hand to strings.json - the full ui-strings.js run here
  collects this machine's test junk, do NOT commit its output), ja/zh-CN chunks + i18n-zhtw --ui. USAGE section + ja /
  zh-CN / zh-TW, FEATURES line 356 in all four, CHANGELOG line, PDFs.
- Pre-existing, unchanged: test-yue2.js 3 fails, test-imagedom.js 4 fails (same on 2.730.0); test-i18n703-ui "every
  section" fails because 3 guide sections (RTX VFX 2.708, 16 GB mode 2.708, Community 2.710) have no zh-CN/ja/zh-TW
  translation and 2 are stale.

## 2.730.0 — 🕺 MOTION FROM A REFERENCE VIDEO: FLOWHMR (NON-COMMERCIAL) AS AN ADD-ON (2026-11-09)

Tim: "and one more for today https://flowhmr.github.io/ . we can add a reference video for motion?" - asked (it gives 3D
motion, not video; gated + non-commercial pieces; cu118; Viggle already does direct motion transfer) he chose: "add it to
addons with a disclaimer that it is for non commercial use only".
- FlowHMR (github.com/flowhmr/flowhmr @ 87ebb48, code Apache-2.0; HF fafsaf1/flowhmr-0.46B flowhmr_latest = base + GRPO
  physics): video -> SMPL-H .npz + .fbx (fbxsdkpy, py3.10 only). Pipeline: YOLOX -> VGGT-Omega (camera; skipped with
  --static_camera) -> SAM 3D Body features -> FlowHMR. Needs: SMPL-H neutral (MANO registration, non-commercial) at
  assets/body_models/smplh/neutral/model.npz; GATED facebook/VGGT-Omega (vggt_omega_1b_512.pt) + facebook/sam-3d-body-dinov3
  (snapshot); public yolox_l.pth (YOLOX release) + smpl_neutral_J_regressor.pt (GVHMR raw). Authors: py3.10 + torch 2.5.1
  cu118 (cannot drive sm_120) - we install torch 2.10.0 + torchvision 0.25.0 from the card's CUDA index (UNTESTED by them).
  ~30 GB VRAM with VGGT every frame; we default to every 10. PHC+ / Isaac Gym = training only, not fetched.
- lib/flowhmrAddon.js (paths under <app>/flowhmr/{FlowHMR,.venv}; BITGEN_ADDON_BASE for tests; missing(); status();
  reqLines(); installFlowhmr(ctx) - notice first, py 3.10-3.12, fetchRepo code + 3 submodules one by one, makeVenv /
  installTorch / hfGet from lib/speechAddons.js (now exported), YOLOX -e --no-deps, FBX SDK tried (fbx.ok marker), gated
  refusals collected -> {ok:false, missing} "almost ready", LINKS (MANO, 2 gated pages, GitHub)); lib/addons.js entry
  "FlowHMR motion capture (non-commercial use only)" with links.
- lib/flowhmr.js (jobParams refuses until missing() is empty; params.flowhmr = the install's paths), routes/flowhmr.js
  (GET /api/flowhmr/status, POST /api/flowhmr), lib/core.js WORKER_FOR flowhmr, misc/flowhmr_worker.py (copies the video
  as <stem>_cam<N>|_still.<ext> for FlowHMR's per-name cache, runs run_v2m_demo_generation.py in its folder with
  FLOWHMR_ATTENTION_BACKEND=query_batched, copies output/<stem>/flowhmr_latest.{fbx,npz} -> models3d/<video>_motion.*, link
  in the output folder, @@MODEL3D + @@OUT the .fbx; OOM hint), static/flowhmrpanel.js (FlowHmrPanel; notice always),
  ext/previewdock/flowhmr.js (#pvFlowhmr "🕺 Motion"; every bar door closes the others).
- Tests: test-flowhmr730.py (18: the install with a stand-in pip/git/HF, jobParams, LIVE worker with a stand-in
  run_v2m_demo_generation.py), test-ui730-ui.js (7). 13 UI strings translated. USAGE section + 3 (a blockquote notice),
  FEATURES line after RelayVSR in all four, PDFs.
- Not checked here: the real install / a real capture (Tim's GPU, his gated access, his SMPL-H file).

## 2.729.0 — NITROFUSION2 IMAGE STYLES: Z-IMAGE-TURBO IN ONE OR TWO STEPS (2026-11-09)

Tim: "can u add this please https://chendaryen.github.io/NitroFusion2.github.io/"
- NitroFusion2 (Dar-Yen Chen, Yi-Zhe Song; github.com/ChenDarYen/NitroFusion2 + HF ChenDY/NitroFusion2, both Apache-2.0;
  arXiv 2611.05648, released 2026-11-03) = Z-Image-Turbo distilled to 1-2 steps (adversarial loss on the MMDiT text stream).
  The authors' ComfyUI workflows (subgraphs) use only core nodes: UNETLoader nf2-bf16 (12.3 GB), CLIPLoader qwen_3_4b
  type lumina2 (Comfy-Org/z_image_turbo split_files/text_encoders, 7.49 GB), VAELoader ae.safetensors (= catalog flux_ae),
  ModelSamplingAuraFlow shift 3 (1 step) / 6 (2 steps), EmptySD3LatentImage 1024, ConditioningZeroOut negative, KSampler
  euler simple cfg 1. 2 steps: KSamplerAdvanced 0->1 on (nf2-dedistill-lora 0.5 -> shift 6), 1->2 on (shift 6) alone
  (their LoRA-at-0.0 node dropped). GGUF: UnetLoaderGGUF nf2-Q4_K_M (5.07 GB; tiers Q2_K_4XS 2.04 GB .. Q8_0 7.22 GB,
  BF16/F16 12.3 GB); I kept ComfyUI's CLIPLoader (their GGUF one uses CLIPLoaderGGUF Qwen3-4B-Q8_0.gguf).
- Files: comfy_workflows/img_nf2_t2i.json, img_nf2_2step_t2i.json (the de-distill LoRA node titled "(fixed)" so
  comfy_image.lora_chain never uses it as a slot), img_nf2_gguf_t2i.json; lib/styles.js starters "NitroFusion2",
  "NitroFusion2 2-step" (steps 2 - a user steps override would break the split schedule), "NitroFusion2 GGUF" (arch
  z-image); lib/modelCatalog.json group "nf2" ids nf2_bf16 / nf2_dedistill / nf2_q4 / nf2_q8 / nf2_te (+ flux_ae);
  lib/nf2Addon.js + lib/addons.js entry (ComfyUI-GGUF only for a GGUF pick; Remove keeps the encoder + VAE);
  lib/modelCards.js z-image family template NitroFusion2 / gguf NitroFusion2 GGUF, nf2-* + "nitrofusion" -> z-image;
  stub-comfy CLIPLoader types + lumina2.
- Tests: test-nf2729.py (18, patcher + node + LIVE image_worker on the stub), test-ui729-ui.js (4). 26 UI strings
  translated (ja / zh-CN / zh-TW). USAGE section + 3, FEATURES line after MOSS-Image in all four, PDFs.
- Not checked here: a real render (Tim's GPU). PedroMarinhoDev/NitroFusion2-ComfyUI has int8 / W6A8 / W4A8 repacks -
  not wired (pick one as the style's Model; a ConvRot int8 loads in UNETLoader).

## 2.728.0 — AN EXACT 1920 × 1080; RelayVSR VIDEO UPSCALING x2 / x4 IN COMFYUI'S OWN NODES (2026-11-09)

Tim: "SeedVR2 ⏫ 20261108-233101_fb2dc998b908.mp4 - how can i make it upscale to 1080p (1920x1080)?" then "yes please add
a 1920x1080 automatic preset and add https://github.com/kopperx/RelayVSR".
- 1920x1080 FRAME: lib/seedvr2.js SIZES + FRAMES {"1920x1080": [1920, 1080]}; target() -> {width 1920, height 1080, mult =
  max ratio (cover), fit "crop", cover}; jobParams passes fit; the worker's multiplier is already the cover ratio, then
  SV.crop_to(got, want) -> SV.mux_args(..., crop) adds -vf crop=1920:1080 (centre). Name _seedvr2_1080p. Panels:
  seedvr2panel option, ext/videodock/dock.html vdSetUpRes option. lib/renderSettings.js UPSCALE_RES + resShort ("1920x1080"
  -> "1080" for upscaleDims / rtxvfx.scaleFromSettings / dlss5.modeFromSettings) + resLabel for the notes.
- RelayVSR = ComfyUI CORE (PR #17511 by kijai, 2026-11-05, commit 2f89433; master only - not v0.44.0; needs comfy-kitchen
  0.2.41 window_attention). Nodes: RelayVSRConditioning(model, images) -> (positive, latent); VSRDecode(vae, samples,
  images, detail 0..1). 1 step cfg 1, NO negative -> BasicGuider + RandomNoise + KSamplerSelect euler + BasicScheduler
  simple 1 + SamplerCustomAdvanced. Every 15th frame + the last go through the model. Factor = the files: Comfy-Org/RelayVSR
  diffusion_models/relayvsr_x2_lightx2v_int8_convrot (5.16 GB, LightX2V, trained on H3 clips) + vae/relayvsr_flash_vae_x2_fp32;
  x4 = relayvsr_x4_int8_convrot + relayvsr_flash_vae_x4_fp32 (VAE sizes not shown on HF - ~140 MB guessed). Apache-2.0.
  The kopperx repo itself is Linux-only (Triton) - NOT used: nothing imported, no venv.
- Files: scripts/relayvsr_graph.py (MODELS, REQUIRED, pick, keyframes, build, fit_vf), misc/relayvsr_worker.py (imports
  seedvr2_worker as W: prepare_source (new, shared), probe, listed, first_video), lib/relayvsr.js (plan: auto = smallest
  pair reaching the size; native; refusals in words; queueTake / onTake), routes/relayvsr.js (+ routes/index mount),
  lib/core.js WORKER_FOR relayvsr, static/relayvsrpanel.js (RelayVsrPanel), ext/previewdock/relayvsr.js (#pvRelayvsr
  🔁 RelayVSR; the other doors close it), ⚙ Upscaler "relayvsr" (dock.html + rendersettings.js + renderSettings notes +
  routes/characters.js branches), lib/relayvsrAddon.js + lib/addons.js entry (x2 ticked), lib/modelCatalog.json group
  "upscale" ids relayvsr_x2 / relayvsr_vae_x2 / relayvsr_x4 / relayvsr_vae_x4.
- stub-comfy.py: RELAYVSR_SCHEMAS + render_relayvsr (factor from the VAE name, wiring checked); STUB_RELAYVSR_ABSENT,
  STUB_RELAYVSR_KEEP_SIZE.
- Tests: test-relayvsr728.py (31, unit + JS + LIVE stub), test-ui728-ui.js (11, real browser vs H3_URL), test-rendersettings
  (the ⚙ list). UI strings: 12 added to strings.json + ja / zh-CN (zh-TW via i18n-zhtw.py --ui). USAGE section + 3
  translations, FEATURES line 266 in all four, PDFs.
- Not checked here: a real GPU run (the nodes need ComfyUI master on Tim's box).

## 2.727.0 — THE BRAIN COMES ALIVE IN THE SPLASH; AN UPSCALE NEVER HANDS BACK ITS SOURCE (2026-11-08)

Tim: "can u check this video and upload it to the website and intergrate in our bitgen-studio repo if it is good enough"
(20261108-233101_fb2dc998b908_seedvr2_1080p.mp4: his LTX clip of the brain picture - lightning, a white flash ~10.5 s,
the big glowing bitGen Studio title; 15 s, music). Good enough - but it was 960x544, not 1080p.
- CAUSE (found in ComfyUI's source, PR #15637 2026-08-30 "add VideoTrim and VideoCrop nodes"): LoadVideo now returns
  ui=preview_input_video -> {"images": [{filename, subfolder, "type": "input"}], "animated": [true]} under ITS node id
  in /history outputs - ahead of SaveVideo (node "1" runs first). comfy_client.output_videos took every .mp4 item ->
  seedvr2_worker first_video = the SOURCE; muxed (crf 14 slow, 256k AAC - the file's x264 SEI proved it was our mux)
  and named by the size ASKED (min(exp_w, exp_h)). Same trap in rtxvfx / dlss5 / ltx / viggle / graph / worker.py.
- FIX scripts/comfy_client.py is_input_echo(it) (type == "input"); output_images / output_videos / output_audio skip
  it; every hand-rolled first_video (seedvr2, rtxvfx, dlss5, ltx, viggle) and graph_worker's picker call it;
  worker.py's ranked video pick skips type input inline (_cc may be None there).
- scripts/seedvr2_graph.py size_verdict(sw, sh, exp_w, exp_h, got_w, got_h) -> ok (within max(4 px, 2%)) / source
  (exactly the source size: the worker FAILS in words, no file) / off (warned "[worker] WARNING: ...") / unknown;
  the file is named _seedvr2_<min(real w, h)>p.
- scripts/stub-comfy.py: render() wraps _render() and puts LoadVideo's input echo FIRST in outputs, as ComfyUI does
  (STUB_NO_INPUT_ECHO=1 = an old ComfyUI); STUB_SEEDVR2_KEEP_SIZE=1 = a ComfyUI that hands back the source's size.
  The OLD worker against the new stub fails test-seedvr2.py (reproduced).
- SPLASH static/splash.html: #neural plays static/splash-neural.webm (Tim's clip, VP9 crf 36, 960x544, 15 s, silent,
  1.9 MB), poster splash-neural.jpg, the credits over it, closes on "ended"; v "error" -> still(): body.still shows the
  picture for 8 s as before. #film unchanged.
- SITE (tigerart): public/assets/media/neural.mp4 (H.264 crf 26, faststart, no sound, 1.85 MB); the hero's
  img.neural -> <video class="neural" muted playsinline preload="none" poster=neural.jpg role=img aria-label hidden>;
  site.js plays it when the brain is picked (not for reduced motion: the poster), no loop (it ends on the title),
  the intro film = .hero video:not(.neural). test-site 214.
- Guide section "The brain comes alive; upscales that came back as the source (2.727.0)" + ja / zh-CN / zh-TW.
- Tests: test-inputecho727.py (12: unit + LIVE stub), test-ui727-ui.js (6: the splash film), test-ui726-ui.js (the
  picture now from a copy without the webm). Gate + 2. Re-run the upscale for a true 1080p of Tim's clip.

## 2.726.0 — THE NEURAL BLUE THEME AND THE bitGen BRAIN PICTURE AS A STARTING IMAGE (2026-11-08)

Tim: "use this as one of the starting images and change the theme to match" (his answers: the website's home page, the app's
start-up splash, the Facebook page, a sample in the image tools; "Add a blue theme" - orange stays the default). He sent a
second, better picture mid-way ("use this image instead" - the brain with blue + gold sparks to the four labels).
- APP: static/themes.js THEMES.neural "Neural blue" (ORDER dark, darker, slate, NEURAL, light, contrast): ink #020a17,
  panel #06132a, panel-2 #0c1d38, line #1c3e62, text #e4eefa, dim #87a2bf, tiger #52baff, tiger-deep #2b8fd6, ok
  #5fd3a0, bad #ff6b7a, ui-hover #10284a, ui-canvas #010610, ui-on #133e6b (sampled from the picture). Name translated.
- SPLASH static/splash.html: pick = #film / #neural or Math.random() < .5; neural = <img id="pic" src="splash-neural.jpg">
  (1920x1080: Tim's 1024 square on its own edge colours, blurred + vignette - scratch script neural/wide.py) 8 s, push-in
  scale 1.06, #cred (Timothy Nolan Paul / Claude Opus 5.5); the film: <video id="v"> gets src only when picked.
- SAMPLE lib/samples.js seed(d, PROJECTS_DIR, name): copies misc/samples/bitgen-neural.jpg into <first project>/images only
  when ensureProject (lib/core.js) just CREATED the dir AND no other project exists (fresh install). "Image styles'
  examples" was MY suggested option - the app has no example-picture slot for styles; this sample is how it was done.
- SITE (tigerart 4ab4527): hero <img class="neural" hidden> in .film; site.js picks film / picture at random (#film /
  #picture; Neural blue = always the picture); footer .looks Colours switch (localStorage bitgen.look), header inline
  script sets html[data-look=neural] before the stylesheet; site.css :root[data-look="neural"] + new vars (--on-tiger,
  --tiger-hi, --tiger-rgb, --top-bg, --hero-glow); privacy line. 742 strings. test-site 211.
- FACEBOOK (files only, not in a repo): cover 1640x624 (center-safe for mobile), square post 1080 with "Free download ·
  tigerart.com.au", profile 720 (the logo in a glowing blue ring) - made with Playwright from an HTML page (scratch).
- Tests: test-neural726.js 14 (ci-units), test-ui726-ui.js 12; test-themes / -ui, test-splash701 / test-ui701-ui updated.
  ci-units 319/319. Main 0390005, CI green; tigerart refreshed 56b28ef.

## 2.725.1 — ▶ ON A SONG IN THE GALLERY OPENS IT IN THE PREVIEW, PLAYING, WITH ITS VISUALIZATION (2026-11-08)

Tim: "it's not working, i clicked play on a song in the gallery and nothing".
- CAUSE: the Gallery's Audio tab tiles (index.html paintAudioTiles) carry their OWN <audio controls>; ▶ there plays in
  the list - the preview never opened (2.725.0 only hooked the dialog's player). FIX static/lbaudio.js fromTile: a
  capturing "play" listener on the document - an <audio> not in #lb, inside [data-lb-url][data-lb-kind="audio"], is
  paused and the preview opens on that tile's list (lbItemsFrom + lbOpen) with autoplay from the same second
  (S.startAt -> currentTime on loadedmetadata).
- test-ui725-ui.js 16 (+3, the REAL Gallery: wavs written to /api/outputs/where's dir, Audio tab, a real click on the
  tile player's ▶ - FAILS on 2.725.0, reproduced); test-lbaudio725.js 16. USAGE line + translations (section re-stamped),
  CHANGELOG, PDFs. ci-units 318/318. Main ceab900, CI green; tigerart refreshed.

## 2.725.0 — A SONG IN THE PREVIEW: A RANDOM VISUALIZATION WHEN IT PLAYS, NEXT / PREV PLAY THE NEXT / PREVIOUS SONG OF ITS DOCKER (2026-11-08)

Tim: "when user starts to play an audio show a random visualization, next button will play the next audio in the docker
the file was clicked in our preview dialog where we show pictures when a picture is clicked not the preview docker with
the button in statusbar".
- NEW static/lbaudio.js (H3LbAudio; pure VIZ, CALM, pick, nextAudio): mount(a) from index.html lbShow's audio branch -
  .lbaud.lbviz fills the stage, canvas.lbcv behind, the player + 🎲 (#lb_viz) in .lbarow; on "play": one AudioContext,
  createMediaElementSource per element (WeakMap) -> AnalyserNode (fft 2048) -> destination; a look at random (never the
  last; reduced motion = bars / mirror / wave); rAF while playing; pause = .paused (dimmed, still). go(d) from lbGo:
  current item kind audio -> nextAudio (skip non-audio, wrap) + autoplay flag -> lbShow -> mount plays it. On a
  picture / video lbGo pages as before (nothing autoplays). The `lb` state is read as a global lexical (like lbfollow.js).
- GOTCHA: ext/previewdock/audioviz.js (2.106.0) wraps HTMLMediaElement.play + a capturing "play" listener and takes
  EVERY <audio> into the Preview docker's visualizer - an element can have ONE MediaElementSource, so ours failed
  (InvalidStateError) until mount() sets a.dataset.noviz = "1" (audioviz skips data-noviz). The lightbox's sound is no
  longer painted in the Preview docker - Tim asked for the dialog, not the docker.
- 🎲 title "Another visualization" in ja / zh-CN / zh-TW (ui-dynamic.js re-run: only that string new).
- Tests: test-lbaudio725.js (15, ci-units), test-ui725-ui.js (13 - needs --autoplay-policy=no-user-gesture-required;
  blob WAV tones). Pre-existing on the old code too: test-yue2.js (the x287 segment lengths), test-jobmeta-ui 1 fail,
  test-ui681-ui 1 fail. ci-units 318/318. Main 30b8b18, CI green; tigerart refreshed.

## 2.724.1 — MODELS NOT FOUND: A MODEL THE DOWNLOAD LIST SAVES UNDER ANOTHER NAME COMES WITH ⬇ DOWNLOAD (2026-11-08)

Tim's box: "yue2_convrot_int8.safetensors goes in models/checkpoints (the style) - Not in bitGen's download list -
download it yourself (Civitai, Hugging Face) into models/checkpoints".
- CAUSE: lib/modelsFound.js sourceOf matched base(m.file) only; catalogue entries with "as" (lib/setupModels.js saves
  m.as || basename(m.file)) were never found by the name the workflows load: yue2 (checkpoints/yue2_3b_int8_convrot ->
  yue2_convrot_int8), h3_latent_up, cn_sdxl_* (diffusion_pytorch_model.safetensors -> xinsir-*-sdxl), cn_flux_inpaint,
  klein4b_outpaint. FIX: savedAs(m) = base(m.as || m.file); a download's own name that differs from "as" matches nothing.
- Audit of the local styles: everything resolves except two FLUX.2 9B fp8 names + MyStudio (sandbox styles, not shipped).
- test-modelsfound7241.js (10, ci-units). ci-units 317/317. CHANGELOG + PDFs. Main 7bca645, CI green; tigerart refreshed.

## 2.724.0 — THE FLOATING DOCKER YOU USED LAST IS ON TOP: ONE ORDER FOR EVERY FLOATING DIALOG, ABOVE THE REST OF THE APP (2026-11-08)

Tim: "the community dialog is going behind the custom dialog, give floating dialogs the highest z-index's".
- CAUSE: three orders that did not know of each other - the named dockers made with ⊞ Docker configs ▸ ▣ New docker…
  (H3Panels.newDocker, floating over the app = a child of <body>) kept floatpanels' .h3fp 9300 (over EVERYTHING, so 💬
  Community at 47/49 always went behind them); the ▣ dockers + floated main dockers (dockgroup dg-app 45 / dg-front 48);
  SecFloat's windows (Community, Basic Settings, LLM tokens 47 / 49 on front()).
- NEW static/floatz.js (window.H3FloatZ; pure part in Node): BAND 60-199 (above the docked app, the status bar 50, the
  image editor's full screen 46, the old voice chat 50; below the corner player 200, ⊞ Docker configs' panel 300, the
  400 panels, menus 9400, drop zones, message boxes). SEL = .h3fp.dg-app, body > .h3fp, .secfloat.df-float,
  .tsd:not(.docked), #vcPanel (floating = position fixed). raise(t) = the dialog holding t (and those it floats in) to
  the top of ONE order: z = 61 + its place, the last used highest; capture pointerdown + focusin on the document;
  drop(w) = out of the order + its z cleared (a zoned docker is position: relative); list(), top(). Loaded before
  dockcfg.js (test-secfloat checks dockcfg -> comment -> dockfloat -> secfloat stay adjacent).
- Wiring: secfloat CSS 60 + front() = H3FloatZ.raise (show / press / float); dockgroup Z {60, 61} + its pointerdown and
  toggle (shown) raise; floatpanels CSS body>.h3fp{z-index:60} (confined named dockers + the image editor's panels keep
  9300 inside their host), float() raises (not while restoring), show() raises, zoneInto drops; stagedock .tsd 60;
  voicechat #vcPanel 60. The prompt docker is NOT in it (44 + its own Ctrl+P lift, promptfront.js 9500).
- Behaviour change worth knowing: a named "main docker" (⊞ New docker) is no longer over a ⛶ maximized docker (9000) -
  every floating dialog sits in the band, like the ▣ dockers always did.
- Tests: test-floatz724.js (14, ci-units: band, zFor, order, SEL, the CSS levels, the wiring); test-ui724-ui.js (14, real
  mouse: Community vs a ▣ docker and vs a ⊞ named docker - press / reopen swaps them at the overlap; Basic Settings joins;
  z between the status bar and ⊞ Docker configs; docked = out of the order). test-dockgroup558 + test-ui558-ui expect the
  new band. Proven: on the old code the named docker sat at 9300. ci-units 316/316. Docker UI tests green: ui558, ui545,
  community711, paneldock (9/10 - 1 flaky run, 3/3 old), psdockers, dockstatus, dockinline, ui645, ui719, ui549 (20/20 in
  isolation and after each predecessor; 4 failed once inside a long same-server run). Pre-existing on the old code too:
  test-dockfloat-ui 4 fails, test-dockcfg-ui 3 fails.
- USAGE section + FEATURES line (+ ja / zh-CN / zh-TW), CHANGELOG (one line by hand - make_changelog.py over these notes
  rewrites every 2.7xx title, don't), the PDFs. Main cd97fad, CI green; tigerart refreshed (2933c86).

## tigerart INSTALL PAGE (2026-11-08, no app version - tigerart abd83b5 + 1397027, Bitgen site-keys 737 = 967743d)

Tim: "make a page for installing, don't just link to github - i think it will be good information to have on the website".
- tigerart public/install.php (h1 "Install bitGen Studio", $seo "How to install bitGen Studio - free local AI studio with
  ComfyUI for Windows, Linux and macOS"): 10 sections with a .toc - before you start (the same requirement rows as
  download.php + driver / SSD / time / HF token), run the installer (.os grid: Windows / Linux / macOS, what install_all.*
  does, how to open it later), the setup window's 7 pages (electron/installer.html: hardware, package (lib/hwPlan.js labels,
  table.editions - NOT table.packs, that class is the language-pack table), ComfyUI, also set up, installing, models, ready),
  the models (token, hf CLI / built-in, Skip, ⤓ Model catalog, the check before render, the 5 MiniMax H3 files in a
  .scroll box), already have ComfyUI, Remote GPU, by hand (prereqs, clone, setup-cli, switches), updating, uninstalling
  (no Windows shortcuts with install_all - start.bat; Linux .desktop, macOS ~/Applications app), 9 problems (Free it
  "before every generation" = the 2.722.0 setting).
- download.php: the "install guide" link + a new "Every step in more detail" line -> install.php; guide.php "Installing" ->
  install.php; footer "Install"; SITEMAP_PAGES install.php 0.8. CSS .page.install / .os (phones: editions stacked, long
  code wraps, scrollWidth = 390 checked).
- 128 strings x3 (737; the download line's key changed - the old translation moved over, rel dropped on {2}). The
  dictionaries are NOT sorted - new keys are appended (don't sort them, the diff explodes).
- test-site.js 201 (+9: the page, its TOC ids, the content, and it is compared with bitGen's hwPlan.js / installer.html /
  INSTALL.md / index.html / the files - CI's sparse checkout of Bitgen now also takes docs/INSTALL.md, lib/hwPlan.js,
  electron/installer.html, static/index.html, misc/reset-layout.bat, scripts/setup-cli.js). When the installer changes,
  update install.php too.
- Live: Tim presses Update on /b_admin/.
- Branches Tim still has to delete (the proxy refuses deletes) - as of 2026-11-09 he deleted all the others: Bitgen
  wip/2.703.0-i18n, wip/2.704.0-zhtw, wip/2.733.0-image-upscale-playback, wip/2.734.0-sheet-words,
  wip/2.735.0-sung-words, wip/2.735.1-sheet-shots, wip/site-keys-sheet-music, wip/2.736.0-sheet-layout,
  wip/2.737.0-parts-mix, wip/2.738.0-song-layers, wip/2.739.0-create, wip/2.740.0-need-install, wip/2.741.0-ace-step, wip/2.742.0-basic-tabs, wip/2.743.0-runpod-serverless, wip/site-keys-runpod, wip/2.744.0-runpod-styles, wip/site-keys-744, wip/2.745.0-gpu-split, wip/site-keys-745, wip/2.746.0-remote-styles, wip/site-keys-746, wip/2.747.0-gpu-local-update, wip/site-keys-747, wip/readme-gitpull-747, wip/site-keys-747b, wip/2.748.0-keys, wip/site-keys-748, wip/2.749.0-remote-starters, wip/site-keys-749, wip/site-keys-749b, wip/2.750.0-logo, wip/2.751.0-intro-logo, wip/2.752.0-brain-splash, wip/2.753.0-openrouter-llm, wip/2.753.1-logo-cache, wip/2.754.0-remote-docker, wip/2.755.0-runpod-v2; tigerart wip/front-sheet-music, wip/runpod-page, wip/runpod-page-744, wip/runpod-page-745, wip/runpod-remote-styles-746, wip/downloads-747, wip/gitpull-note-747, wip/keys-748, wip/runpod-starters-749, wip/remote-gpu-page, wip/remote-gpu-logo-tree, wip/logo-750, wip/brain-hero-752, wip/remote-generation-753, wip/logo-cache-runpod-ref-7531.

## tigerart SEO (2026-11-08, no app version - tigerart 9b663e8 + Bitgen site-keys 609)

Tim: "how can i raise tigerart/bitgen in google for comfyui/editing software/local ai" -> "yes please" (advice given in
chat: Search Console + sitemap, links from r/comfyui / r/StableDiffusion / Civitai / Discords / awesome-comfyui /
AlternativeTo, the tutorial films on YouTube, the tester's post, maybe a bitGen domain later).
- inc/header.php: $seo (the <title>; h1 stays $title), $noindex, $ld (true = site_ld); canonical = path + kept params
  (t, c, p>1) + ?lang; hreflang x 4 + x-default; og:url / og:site_name / twitter card. inc/site.php site_ld():
  SoftwareApplication + WebSite (no ratings - never invent them). discussions.php: noindex on forms, topic description
  = first post, DiscussionForumPosting JSON-LD.
- robots.txt (static, names https://tigerart.com.au/sitemap.xml), sitemap.php (+ .htaccess RewriteRule sitemap.xml;
  php -S ignores .htaccess - tests hit sitemap.php), comfyui.php (footer "For ComfyUI users").
- 32 strings x3 (609). test-site.js 182. Next for Tim: verify the domain in Google Search Console and submit the sitemap.

## 2.723.0 — /b_admin/ MEMBERS: SUSPEND (DAYS), MAKE ADMIN, LIVE SEARCH (2026-11-08)

Tim: "add 2 buttons next to ban, suspend (input number of days) and make admin. add a search bar to users, filter the
search results after 3 characters". (Also asked: how to make himself admin -> /b_admin/ Community admins box, or now the
Make admin button; and docking the Community chat into dockers / ▣ dockers - it ALREADY worked: verified by real mouse
drags incl. reload + a permanent ▣ docker; no change made.)
- Bitgen community/ (BGC 2.723.0, schema 6): bgc_users.suspended_until (in BGC_USER_V2); auth.php user_suspended(_msg);
  auth_user drops a suspended member's tokens; act_login 403 "suspended until <date> UTC"; act_admin.php
  user_set_suspended / act_admin_suspend {handle, days 1-3650, 0 lifts, not yourself}; admin_user.suspended_until.
  test-community723-server.js (18).
- tigerart (main 2 commits): b_admin index.php row actions in <div class="acts"> (Ban, days box + Suspend / Lift
  suspension, Make admin / Remove admin -> db.json admins, member must exist); done() keeps ?q=; lib/database.php
  member_suspend / member_exists / db_has_suspend; admin.js live search (>= 3 chars, fetch ?q=, swap #mbList, debounce
  250 ms); admin.css; site i18n + "You cannot suspend yourself." (578). test-admin.js 91 locally (browser part SKIPs in CI
  - no playwright there); ADMIN_SHOT=<png> pictures the Members card. Tim must press Update THEN Create database (the
  new column) before Suspend works - the page says so if not.

## 2.722.0 — FREE VRAM ONLY WHEN THE MODEL CHANGES (2026-11-08)

Tim: "if render queue is using the same model don't unload vram until model is changed (will this keep adding to vram?"
(answered: no - ComfyUI keeps one copy and reuses it, frees working memory after each run, evicts when it needs room).
- scripts/comfy_client.py: free_mode (off | change default | always; env BITGEN_FREE_VRAM overrides - e2e-stub-test.sh
  starts the server with BITGEN_FREE_VRAM=always because its legs count /free per job), models_of(graph),
  note_loaded/loaded_models/forget_loaded (a JSON per ComfyUI url in the temp dir; BITGEN_COMFY_LOADED for tests),
  clear_before_gen(base, cfg, say, graph) keeps the card when models_of(graph) == the last queued graph's. queue() notes,
  wait() forgets on OOM / ComfyUI gone, a /free forgets. All 13 workers pass their graph; worker.py notes its own
  /prompt + the tail upscale, forgets in `except ComfyOOM`.
- Settings ▸ ComfyUI: #s_cfree label now "Free VRAM before a generation", + #s_cfreewhen (change / always) saved as
  engine.comfy.free_vram (core.js + misc/default.settings default "change").
- static/i18n/ui/strings.json: only the 7 new words were appended (a full scripts/ui-strings.js run here collected 135
  junk strings - file names, readouts - from this sandbox's state; reverted).
- Tests: test-vramkeep722.py (22), test-ui722-ui.js (6). test-settings has a pre-existing failure (5 DEFAULT_CONFIG
  keys not in default.settings: restart_on_start, vram16.*, projects_dir) - not caused here.

## 2.721.0 — PINNED DISCUSSIONS + bitGen Studio's OWN DISCUSSIONS (2026-11-08)

Tim: "can you add a discussion to the website with that info and pin it please" (the speed results: his RTX 5090 -
Qwen Image 2.1 edit 16 s, Turbo8 11 s, H3 Fast Omni 540p 15 s clip 1:48 / 10 s clip 1:12 - and the tester's RTX 3090
blind benchmark image). The live discussions are in the hosting's MySQL (no access from here) and had no pin, so:
- community/ (Bitgen repo, BGC 2.721.0, schema 5): bgc_topics.pinned/.official, bgc_posts.official (db_migrate_forum
  ALTERs older DBs; BGC_FORUM_V5 kept on ONE line - tigerart test-admin counts tables with /^\s+'bgc_\w+' => \[/m).
  act_forum.php: ORDER BY pinned DESC; admin_forum_pin; official author {official, name "bitGen Studio"}; guest names
  containing "bitgen" refused; forum_notes_sync() from act_forum_list: community/notes/*.json (key, rev, category,
  pinned, title, lines) posted once (bgc_meta note:<key> = "tid:rev", notes_sig), rev bump updates, admin-removed stays
  removed. BGC_NOTES_DIR; a BGC_DSN server (every test) posts none without it. notes/README.md, API.md.
- THE NOTE: community/notes/speed-results-2026-11.json (General, pinned; English + 繁體中文). rev 2 (eef6983): + Tim's larger-picture 5090 runs (Qwen edit 39->33 s, Turbo8 17->15 s; ~1 s/step, Turbo8 2.2x), the old 'untick Free VRAM' tip now points at 2.722.0's default. It appears on the live site
  the first time anyone opens Discussions after Tim presses Update on /b_admin/. To change its text: edit it, raise "rev".
- tigerart aaacc8d: discussions.php 📌 Pinned tag in the list, a pinbar + admin Pin/Unpin (do=pin|unpin) on a topic;
  members.php author_html official = "bitGen Studio" + team tag; site.css .tag.pin/.tag.team/.pinbar; 7 new strings
  x3 (577). scripts/test-pins.js (16) in tigerart CI (test.yml). Bitgen: test-community721-server.js (23, e2e);
  test-community716-server + test-langpacks716 accept newer version / schema. docs/i18n/site-keys.json re-exported.

## 2.720.0 — A RENDER THAT STOPS ON A MISSING MODEL ASKS TO DOWNLOAD IT (2026-11-08)

Tim: "if worker exits with code 1 , check for models if models are not found ask if user wants to dl models".
- lib/core.js closed(): failed branch -> require("./modelsFound").afterFail(job, log) (try/catch). jobDict.models_missing.
- lib/modelsFound.js: namesFromLog (ComfyUI's two wordings; KEY_CAT), jobNeeds(job) (log names + params.style/workflow or
  params.video_style + workflowFor(mode); Wan/LTX 2.3 = style names), afterFail (skips remote / farm jobs; on-disk names
  are not missing). POST /api/models/check {job_id} re-checks a job.
- static/modelsfound.js watchJobs(list) - called from refreshJobs (index.html, every 5 s): jobs failed since page load
  (finished > load - 30 s) with models_missing ask once (asked{}), one box at a time; box(r, {job_id}, {job}) - job lead,
  "(ComfyUI refused it)" label, after download logs "press ↻ Retry". No auto-retry.
- scripts/stub-comfy.py STUB_CHECK_LORAS=1 = refuses a LoRA not in its loras folder (ComfyUI's shape). test-ui720-ui.js
  part 5 runs the real failure end to end (spawns the stub, sets + restores engine.comfy).
- Tim asked (mid-turn) how his 5090's 11 s for Qwen Image Turbo8 compares with the tester's 3090: the tester's Qwen seconds
  are NOT in these notes (only "25 steps vs my Turbo 8"); answered with estimates and asked for his post / numbers.

## 2.719.1 — THE CHECK COVERS EVERY RENDER (2026-11-08)

Tim's log: the image editor's ✨ AI from the References docker (pcpromptlink.js runRefs -> mount.js api.aiedit -> POST
/api/aiedit) rendered Qwen Image 2.1 edit Turbo8 without the Turbo8 LoRA - 2.719.0 only checked the prompt docker's Generate.
- static/modelsfound.js WRAPS window.fetch: POST /api/genimage | genmusic | generate | aiedit | aiedit/compose -> reqFrom(kind,
  body) (JSON or FormData) -> ensure() -> the real fetch, or 409 {error "Not rendered - ...", models_missing} on Cancel.
  okAt: a request checked OK in the last 10 s is not checked again. Header "X-Models-Check: skip" = no check (styledoctor.js).
  Internal calls use realFetch (captured before the wrap). jsdom (no Response) = not wrapped.
- routes/modelsFound.js kind "aiedit": style_id (or edit_style_id when fill_edit=1); Edit/Compose = style.workflow, else
  style.inpaint_workflow (none = only the style's own names).
- A test that renders through the stub with a ComfyUI folder set must put the style's model files there (test-ui592-ui.js
  does it with /api/models/check). Not covered: renders started server-side (scene / auto renders), /api/swap, /api/ltx.

## 2.719.0 — MODELS NOT FOUND, CHECKED BEFORE A RENDER (2026-11-08)

Tim: "check if models are in a model path before render - create a list of found models so it can be a quick check save the
list as /misc/models_found.json. if models are not found bring up a msgbox to download/cancel model names not found".
- lib/modelsFound.js: list = misc/models_found.json (BITGEN_MODELS_FOUND env overrides the path - tests), made by
  comfyModels.scan over comfyDetect.scanTarget (folders, works before ComfyUI starts); rebuilt when absent / comfy dir
  changed / 🧩 ⟳ (GET /api/models/found?refresh=1) / once when a check misses. needs(graph, style, kind, {auto, model,
  extra_loras}) = CORE loader classes only (LOADERS table) + the style's overrides as comfy_image.py (image/music) and
  worker.py apply_video_style (video) apply them; workflow LoRA nodes never checked (filled/bypassed by the workers).
  Matching is lenient (name, or file name in any folder) so a false "missing" cannot block a render that would work.
- routes/modelsFound.js: POST /api/models/check {kind, style_id | video_style_id, mode, model, basic, extra_loras} ->
  {checked, why, missing [{name, cat, folder, from, source}]}. Skips: remote ComfyUI, no folder, sd-cli, LTX, missing style.
  routes/setup.js /api/setup/download falls back to cfg.hf.token.
- static/modelsfound.js H3ModelsFound.ensure(req) - called in startImageJob / submitJob / startMusicJob BEFORE
  ensureComfyReady. Not wired (yet): Swap, LTX (/api/ltx), Graph mode, scene/storyboard renders, the Style doctor.
  A failed check request = render anyway. UI words in static/i18n/ui/*.json (ui-dynamic.js regenerated dynamic.json).
- misc/models_found.json in .gitignore + make_zips.sh. Tests: test-modelsfound719.js (33, CI), test-ui719-ui.js (19).

## 2.718.0 + tigerart TUTORIALS (2026-11-08)

Tim: "can we add a Tutorials to the website - show how to add a new model to bitgen and a new workflow, use images and a video".
- Bitgen 2.718.0 (bf86774): 🧩 ⟳ in the Model manager also calls loadComfyModels(true) (/api/comfymodels?refresh=1), so a
  new style made from a new card no longer shows "— not found" (test-ui718-ui.js, in e2e-stub-test.sh). scripts/stub-comfy.py
  TUTORIAL MODE: STUB_FULL_INFO=1 serves tutorial_schemas() (CheckpointLoaderSimple, CLIPTextEncode, EmptyLatentImage,
  VAEDecode, SaveImage, PreviewImage, LoadImage) in /object_info and per class, and drops the "stub-unet" stand-in names.
- tigerart abd2250 (+ refresh 7a5ec07 = 2.718.0): public/tutorials.php (menu after Guide; #model 6 steps + folder table,
  #workflow 5 steps; $pic / $film helpers; English-captioned silent films said on the page), media in
  public/assets/img/tut/ (9 step pictures + 2 posters) and public/assets/media/tut-model.mp4 / tut-workflow.mp4 (~0.8 / 1.1 MB).
  48 new strings in zh-CN / zh-TW / ja (570 each). site.css: tutorial styles; header: 1221-1520 px tighter menu for every
  language; html[lang=ja] folds at 861-1140 px and is tighter to 1520 px. test-site.js: the page x 4 languages, films /
  posters / pictures, header-fit check at 11 widths x 4 languages (156 local).
- REMAKING THE MEDIA (after a UI change): run the studio (H3_E2E=1 H3_PORT=8311 node misc/server.js as a background task),
  then in tigerart: `BITGEN_DIR=../Bitgen-Studio H3_URL=http://127.0.0.1:8311/ node scripts/tutorial-capture.js [model|workflow]`.
  It starts stub-comfy on a free port with STUB_FULL_INFO=1 and a fake models folder (real safetensors headers from
  mmfixture518.js; abstract Pillow colour-field thumbnails - no AI pictures), points the engine at it, records 1600x900 ->
  ffmpeg H.264 1280x720 crf 26 veryfast, crops the step pictures, takes posters at POSTER_AT {model 22 s, workflow 38 s}, then
  restores the config and deletes the style / graph it made. The overlay (pointer, caption, click ring) moves into an open
  <dialog> via window.tutHost. Not GPU-rendered: nothing generates in the films.

## 2.717.0 — ⚡ FASTER FIRST FRAMES + THE TESTER'S ACCELERATOR FINDINGS

Tim: "can we add the faster 8 step turbo model and fix the problems he talked about" - a Taiwanese tester's blind bench on
one RTX 3090 (post: Veda ✅ full-size / long / dialogue 41-65 %; ❌ Veda on fights/transformations 22 % + softer; ❌
Spectrum 20-step lip-sync 2x but faces blur; ❌ KJ head-chunk + sage 17 %; "Bitgen's Qwen-Image still 25 steps vs my
Turbo 8"). Asked the route (Qwen Image 2.1 AND the Turbo8 LoRA are Qwen Research License = NON-COMMERCIAL): Tim picked
"Both, commercial-safe default".
- ✎ First frame (routes/sceneedit.js editEngines / ready2511 - exported): blank style = Auto = Qwen Image Edit 2511 +
  Lightning 4 steps (Apache 2.0) when qwen_edit + qwen_lightning are present (setupModels.present + setupRun.modelPaths;
  20 GB, full package), else Qwen Image 2.1 edit; > 3 pictures -> Qwen 2.1 with a non-commercial note; 2511 slots via
  aiEdit.composePlan (graph -> workspace/qedit/scene-<id>-<n>.json); prompt retagged for 2511 (refWords.retag "<image2>"
  -> "Picture 2"); q.style_id stored only for a real pick (older scenes keep their stored Qwen 2.1 id). Docker
  ext/videodock/qedit.js: "Auto - <default name>" first.
- Starter "Qwen Image 2.1 edit Turbo8" (img_qwen21_edit.json, 8 steps, cfg 1, turbo8_lora_step2500.safetensors @1 - the
  LoRA is built in front by comfy_image.build_loras); catalog qwen21_turbo8 (chriswritescode/Turbo8-LoRA-Qwen-Image-2.1,
  comfy/loras, ~1.36 GB). Licence words on qwen21 / qwen21_turbo8 / qwen_lightning "for". NOT done: the card's
  ModelSamplingFlux (max_shift 0.6935, base 0.5) - not in our graph.
- misc/worker.py: VEDA_ACTION regex + is_big_motion(prompt) (EN whole words + 中文 + 日本語) -> Veda skipped for that shot
  unless accel.veda_action == "keep" (styles.normVideoAccel stores only keep; #s_vsvedaaction); Long + Veda -> chain
  [chunkff] -> veda (no h3lowvram, no kitchen attn); SPECTRUM_DETAIL {warmup_steps 2, tail_actual_steps 3} on "on" when
  _graph_steps(g) >= 12 (names from the node's README); apply_video_accel(g, accel, prompt=params["prompt"]) (swap
  worker passes none). Sage stays out of Long video (unchanged).
- Tests: test-turbo717.js (11, CI), test-turbo717.py (15), test-veda536.py/-ui, test-sceneedit, test-sheetstyles updated.
  Not GPU-verified: Turbo8 quality without ModelSamplingFlux, the Spectrum tail on faces, Veda + Long memory at 30 s.

## 2.716.0 — 🌏 COMMUNITY LANGUAGE PACKS (share / approve / install) + tigerart.com.au/languages.php

Tim: "lets do number 2, this way we don't have to create all the packs at once - if we could have a master pack so users
can translate the strings and upload to tigerart for the community it would be ideal".
- community/lib/act_packs.php, BGC_SCHEMA 4 (bgc_packs: code, native, name, version, app, user_id, status
  pending|live|refused, note, review_note, counts JSON {ui, patterns, files, coverage}, zip MEDIUMTEXT base64, size, sha,
  downloads). pack_list ('opt': live; + mine; admins + pending), pack_get ('opt'; downloads++ unless own), pack_upload
  (verified; admin = live at once; 5 MB zip, 10/day; pack_inspect reads the central directory itself - no ZipArchive -,
  pack.json id/native rules = the app's, ui.json counted; coverage from the app kept as ints only), pack_delete (own /
  admin), admin_pack_moderate (approve -> live + the same user's older live pack of that code deleted; refuse -> note,
  zip NULL). api.php: 7 MB body for bug_report AND pack_upload. info: packs: true. API.md.
- App: lib/community.js packs() (list/get signed out OK, a 401 drops the token and retries signed out; upload/delete
  need the member). routes/langPacks.js /api/langpacks/community (+ installed marks), /community/install {id, replace},
  /:id/share {note} (LP.shareZip: an installed pack's own files; built in = exportZip), /community/delete.
  static/langpacks.js: "Shared by the community" (#s_lpcm rows [data-cm], [data-cminstall]), ⇪ Share ([data-lpshare] ->
  #s_lpnote + #s_lpsend in #s_lpask), Your shared packs (#s_lpmine, [data-cmdelete]).
- lib/langPacks.js: core required lazily (website-sync builds the master from a bare checkout: node -e with
  LP.setBase(<bitgen>, <bitgen>/.no-langpacks); LP.masterZip(new Date(2026,0,1)) - fixed date, so the file only changes
  with the English); docs/i18n/site-keys.json = the website's 522 words (tigerart `php scripts/site-i18n.php export
  <bitgen>`) -> the master pack's site.json. A pack without site.json reports no website coverage.
- tigerart: public/languages.php (list + ?get=<id> zip, steps + master pack link from site.json masterPack, multipart
  upload, Your shared packs, admins' Waiting for you: download / approve / refuse + note), footer + community.php links,
  CSS (.btn.small, table.packs, .modpack). website-sync.py: packs() (feature-list languages from docs/i18n/*/pack.json) +
  master_pack() -> assets/get/bitGen-language-pack-master.zip. 81 new site words (522). scripts/test-languages.js (19) in
  test.yml; test-site visits languages.php. The website itself still uses its own inc/i18n/<lang>.json - adopting an
  approved pack's site.json as a new website language is NOT built (it would need its tags checked against the English).
- Tests: test-langpacks716.js (13, CI), test-community716-server.js (30), test-langpacks716-ui.js (10, browser, php).

## 2.715.0 — 🌏 LANGUAGE PACKS (every language besides English is a pack) + THE MASTER PACK

Tim: "is it too late to make the languages into language packs,so we can add a new language easily later?"
- lib/langPacks.js: built in = docs/i18n/<id>/pack.json (format 1: id, name, native, region, browser [tags, longest match
  wins], keepAll, order, version, authors, words {stale, missing, english, lang}, files {ui, help} -> the older paths
  static/i18n/ui/<id>.json + static/help/<id>/); installed = <install>/langpacks/<id>/ (pack.json ui.json USAGE.md
  shortcuts.json FEATURES.md site.json help/<topic>.html; langpacks/ in .gitignore + make_zips.sh). An installed pack with
  a built-in id replaces it until removed. list/get/isLang/files/client/coverage/check/install/remove/exportZip/masterZip/
  sanitizeHelp (allow-list tags, id="" only). Zip read capped (8 MB zip, 8 MB/file, 32 MB total, 500 files, inflate
  maxOutputLength), "../" refused, {0} mismatches dropped with a note. lib/zipWrite.js deflate entries; unzip.read(…, max).
- lib/helpI18n.js: LANGS (getter) / isLang / fileOf from the packs; a part word for word the English = not translated.
  static/helplang.js: list from /api/langpacks (localStorage bg.langPacks), setPacks/onPacks/refresh/packs, fromSystem
  by browser tags, picker options as text. static/uilang.js: /api/langpacks/<id>/ui.json, "" = untranslated, keep-all CSS
  per keepAll pack. scripts/i18n-ui.js LANGS from the built-in packs. PDFs: make_guide_pdf.py / cjkfont.py still list the
  three built-in languages by hand (a new built-in language needs them only for a Guide PDF).
- Settings ▸ Languages (static/langpacks.js; a click LISTENER, because index.html sets every tab's onclick after load):
  rows [data-lp] with coverage, Use, ⤓ Export for translating, ✕ Remove; ⤒ Install a pack (#s_lpfile -> check -> ask
  #s_lpyes/#s_lpno if installed); ⤓ Master pack (#s_lpmaster). Words written as .textContent = "…" / label: "…" so
  scripts/ui-dynamic.js finds them (run it, then translate only what is new - it found only this file's words).
- Tests: test-langpacks715.js (38, CI), test-langpacks715-ui.js (16, browser).

## 2.714.1 — 🌏 THE FEATURE LIST IN 简体中文 / 繁體中文 / 日本語 + THE WEBSITE'S LANGUAGE DROPDOWN

Tim: "can you add the language dropdown to the website?" / "please translate the feature list too, it is the core
information".
- docs/i18n/zh-CN/FEATURES.md + ja/FEATURES.md: all 957 features (10 translator agents, 5 parts each language, joined
  aligned on blank lines), the English's shape LINE FOR LINE (headings, one bullet per feature, *Where:* / *Since:* +
  versions kept; on-screen names often left English). zh-TW/FEATURES.md = `python3 scripts/i18n-zhtw.py --features`.
  `--json <src> <dst>` converts any {"strings"} dictionary (the website's). A FEATURES.md change in English later: the
  translations must keep the same lines - translate the new bullets and insert them at the same place (website-sync
  shows a group in English while its items do not line up). scripts/test-features7141.py (29) in the e2e run.
- tigerart (separate repo): inc/i18n.php lang() (?lang= -> "lang" cookie 1 year -> Accept-Language -> en), t($en, $args)
  from inc/i18n/<lang>.json {"strings"}, t_msg() for the Community server's messages (whole, or by {n} pattern, parts
  translated too), lang_select() in the menu (#langSel; site.js keeps the address), <html lang>, hreflang. Every page
  through t() (b_admin stays English); server labels (categories, BGC_BUG_SEV, BGC_BUG_STATUS) translated at output.
  441 strings; zh-CN + ja by agents (the app's own words), zh-TW converted + 「」 quotes. scripts/site-i18n.php keys |
  check | missing <lang> <bitgen>/community (the PHP tokenizer: every t() literal, $field labels, ApiError / rl_check /
  v_text / v_name strings, the three label consts, the default rules; EXTRA for ternary-built messages) - check fails on
  a missing string or different {n} / tags. website-sync.py writes data/features.<lang>.json (site.json featureLangs);
  features.php reads it. CSS: the menu nowrap + tighter at 861-1220 px (GitHub as its icon). test-site 135, test-
  discussions 58 (a real cookie jar now), test-admin 77.
  A NEW PAGE STRING: wrap it in t(), run `php scripts/site-i18n.php missing ja <bitgen>/community`, translate the
  missing ones into zh-CN.json + ja.json, then `python3 <bitgen>/scripts/i18n-zhtw.py --json public/inc/i18n/zh-CN.json
  public/inc/i18n/zh-TW.json` (that re-converts ALL zh-TW, then swap “” for 「」) and `php scripts/site-i18n.php check`.

## 2.714.0 — 🐞 BUG REPORTS TO THE COMMUNITY + THE BUG LIST TIM HANDS OVER

Tim: "can we also add the bug report discussion to the website and have the app allow the user to send the bug report
to the db if they are registered. if not registered bug report will be sent as anon. compile the list of bugs so i can
give it to you".
- community/: BGC_SCHEMA 3 - bgc_bugs (topic_id, user_id, anon, title, severity, area, app_version, happened, expected,
  steps, details MEDIUMTEXT JSON, shot MEDIUMTEXT base64 + shot_type, source app|web, status, created/updated).
  lib/act_bugs.php: bug_report ('opt' token; a confirmed member = live, none = anonymous "Anonymous"/guest_name, pending;
  members 10/h, anonymous 5/h per IP; title 3-120, words 5000 each, details 2 MB, shot 4 MB PNG/JPEG by magic bytes);
  the topic + its first post (bug_public_text) in category "bugs"; bug_shot, admin_bug_status (open, working, fixed,
  duplicate, notabug, wontfix), bug_export_rows(open|all) (worst severity first, replies), bug_counts. http.php
  bgc_read_body($max) - 7 MB (BGC_MAX_BUG_BODY) for bug_report only, 16 KB for the rest. act_forum: 'bugs' => 'Bug
  reports' (forum_new refuses it), list/topic carry bug {status, …}, details only for admins, refusing an anonymous bug
  deletes its bgc_bugs row. MariaDB took 1.2 MB details + a 2.5 MB shot.
- App: static/bugreport.js 📤 Save and send (#brSend; the canvas as JPEG ≤1920 wide), 💾 Save as a file (#brSave), ☐
  Send anonymously (#brAnon), who line (#brWho via /api/bugreport/who), Earlier reports 📤 (data-send) / ✓ sent
  (.bsent). lib/bugReport.js payload(id, shot) (logs fitLogs 1.2 MB newest kept, homeless: home -> ~, a saved PNG > 3 MB
  stays home with a note), markSent -> report.json "sent". lib/community.js whoSends / sendBug (90 s timeout; member only
  with profile.verified; anon on request). routes/bugReport.js /who, /send/:id. 18 new UI words (zh-CN/ja by hand, zh-TW
  by script); the docker's messages are written with textContent so the scanner sees them.
- tigerart: discussions.php ?bug (the form; guests anonymous unless named), ?shot=<bug id> (admins), bug box on a bug's
  discussion (status picker, screenshot, details: system, steps, errors, logs tail 300), status tags in the list
  (.tline); b_admin Bug reports (counts, newest 30, ?export=open|all -> bitgen-bugs-<date>.zip via ZipArchive, .md if
  none). README.
- Tests: test-community714-server.js (34), test-bugreport714.js (20), test-bugreport714-ui.js (12); 710 server test
  reads the version from boot.php; 713 server test accepts schema 2+. tigerart: test-discussions 55, test-admin 77 (80
  MySQL; the table count read from community/lib/db.php).
- TIM: /b_admin/ ▸ Update ▸ Create database (13 tables). When bugs come in: Bug reports ▸ Download the bug list -> give
  Claude the zip.

## 2.713.0 — 💬 NAMES + CONFIRMED EMAIL, EMAIL BANS, THE DISCUSSIONS (tigerart.com.au)

Tim: "let users enter first name, last name and email - and verify email so if we ban a user they can't just change
their username. they don't have to sign up to the community if they don't want to, add a discussions page on tigerart
for registered users to talk and allow guest access too". His picks: guests READ AND POST (a guest's post waits for an
admin), real names ONLY admins, ONE account for the app and the website.
- community/ (Bitgen-Studio): BGC_SCHEMA 2 - bgc_users + first_name, last_name, email, email_key (unique; reduced:
  lower-case, no +tag, Gmail without dots), email_verified, code_hash/expires/tries (BGC_USER_V2; db_migrate_users
  ALTERs an old DB, CREATE UNIQUE INDEX tolerates "exists"); bgc_banned_emails; bgc_topics + bgc_posts. lib/email.php
  (v_email, email_key, code_send - register's own limit covers its first code; resend 4/h/account 10/h/IP; 6 digits,
  15 min, 5 tries; stale unconfirmed accounts dropped after 7 days), lib/mail.php (mail() with -f; BGC_MAIL_LOG file),
  settings mail_from / site_url (db.json mail_from too). register needs first_name/last_name/email (an older client gets
  "update bitGen"); verify_email / resend_code / set_profile; profile in login / me / register. lib/dispatch.php: actions
  table [fn, token true|false|'opt', admin, unverifiedOk]; unconfirmed -> 403 + need: verify|profile (ApiError->extra);
  bgc_call() for in-process callers. lib/boot.php loads everything (api.php is thin). act_admin: user_set_banned (bans the
  address), admin_user (real names). lib/act_forum.php: forum_list / forum_topic / forum_new / forum_reply / forum_delete,
  admin_forum_pending / admin_forum_moderate; guests 4 posts/h per IP, members 6 topics + 40 posts/h; banned authors
  hidden; deleted accounts "(left)". MariaDB checked (old schema-1 DB upgraded, utf8mb4 text).
- App: lib/community.js join() needs + passes the names/email; ACTIONS + verify_email, resend_code, set_profile,
  admin_user. static/community.js: Join fieldset "New here? Also", verifyView (#cmCode #cmVerify, Send a new code, Wrong
  address?), profileView (#cmPFirst/#cmPLast/#cmPEmail #cmPSave), ⋯ Discussions link (#cmForum -> <server origin>/
  discussions.php, target _blank -> Electron opens the browser) + Your details; S.profile (an old server without profile
  = treated as confirmed). 31 new UI strings added to strings.json by hand + zh-CN/ja chunk build + i18n-zhtw --ui.
- tigerart repo: public/inc/members.php (session "bgs", cm() -> bgc_call, flash, text_html, form_stamp + trap field),
  account.php, discussions.php (?t ?new ?mod ?ban; admins see real names), NAV + Discussions, header Sign in / name,
  community.php + privacy.php text; b_admin Members (find, Ban/Unban via user_set_banned), Emails (mail_from, test email),
  Discussions waiting count, 12 tables. Tests: test-discussions.js (42, in its CI), test-admin.js 70/73, test-site 81.
- Tests (Bitgen): test-community713-server.js (63), test-community713-ui.js (12, e2e); 710 server/ui + 710 unit updated
  (joining needs name/email + code; the ui test opens the panel only if closed - it is remembered open).
- LIVE STEPS FOR TIM: /b_admin/ ▸ Update (site + Community 2.713.0) ▸ Create database (12 tables) ▸ Emails ▸ Send a test
  email (DKIM in Plesk if it lands in spam). Any account made before must add name + email on next sign-in.

## 2.712.2 — PLESK (Tim: "it is using plesk")

The hosting is Plesk, not cPanel: site folder httpdocs, private folder /var/www/vhosts/tigerart.com.au/bitgen-private
(the admin page's default, dirname of DOCUMENT_ROOT; open_basedir {WEBSPACEROOT} allows it; if mkdir fails the page
says to make the folder in the File Manager). DB server may carry :port (Plesk Connection Info shows localhost:3306):
b_admin database.php db_name_rule('host') + db_dsn split it; community settings.php too (test-community7121 12,
test-admin 58 SQLite / 61 MySQL). Messages + tigerart README name Plesk menus; free SSL = Plesk SSL/TLS Certificates ▸
Let's Encrypt + Hosting Settings 301 to https. .htaccess needs PHP/requests through Apache (Plesk default nginx proxy +
Apache); nothing secret depends on it (secrets are outside httpdocs, lib/*.php show nothing on their own).

## 2.712.1 — THE WEBSITE MOVES TO ITS OWN PRIVATE REPO (tigerart) + /b_admin/ + ENCRYPTED DB PASSWORD

Tim: "should i make a tigerart repo for the website so the website and bitgen can be separate and make it private",
then "git repo is tigerart, mysql db is timpaul_bitgen , create an admin page in tigerart.com.au/b_admin/ . the admin
page will have an update button, create database button, i will enter the db password into a text field, the password
will be encrypted then saved in a txt file. to be used for the db".
- Repo Tim-byte-dev/tigerart (PRIVATE; attach with add_repo push; clone to /home/claude/tigerart). public/ = what goes
  in public_html; scripts/website-sync.py [bitgen dir] (BITGEN_DIR, ../Bitgen-Studio, ./bitgen); test-site.js;
  test-admin.js (php -S + scripts/gh-stub.php GitHub stand-in; SQLite via BGC_DSN, or real MySQL with
  MYSQL_TEST_USER/PASS/DB - 59 legs); .github/workflows/test.yml (site + admin SQLite + admin MySQL on the runner's
  MySQL) and refresh.yml (daily 19:41 UTC + dispatch via `gh api -X POST .../actions/workflows/refresh.yml/dispatches
  -f ref=main` - gh's GraphQL is blocked here): sync from the public Bitgen-Studio, commit if changed (site.json's
  "built" date kept when nothing else changed). The intro poster differs per ffmpeg version - do not commit a local
  re-sync of it.
- public/b_admin/ (index.php + lib/core.php, auth.php, database.php, update.php; admin.css, admin.js; .htaccess denies
  lib/ + *.json/txt/key...): first visit = setup (DB name/user/host/password must CONNECT - that proves ownership - +
  an admin password >= 10); sign in (5 wrong per IP / 25 total per 15 min; 2 h idle; session cookie path /b_admin/,
  Secure, HttpOnly, SameSite=Strict); CSRF token on every POST, PRG (303); CSP, no-store, noindex, DENY framing; the
  real address over http -> https (127.0.0.1 may use http). Secrets in /home/<user>/bitgen-private/ (dirname of
  DOCUMENT_ROOT; BITGEN_PRIVATE_DIR overrides), 0700 / 0600: secret.key (32 bytes b64), db-pass.txt + github-token.txt
  ("bgx1:" b64(nonce24 + sodium secretbox) / "bgx2:" b64(iv12 + tag16 + AES-256-GCM)), db.json (host/name/user/
  admins), admin.json (password_hash), deploy.json (each deployed file's git blob hash), fails.json.
  Update = GitHub REST: commits/main -> git/trees/<sha>?recursive=1 -> git/blobs/<sha> (Accept vnd.github.raw) only
  where the local git hash differs; each blob's hash checked; temp file + rename; files dropped from the repo removed
  only if an earlier Update put them there. Sources: tigerart public/ -> public_html (token, skips bitgen-community/),
  Bitgen-Studio community/ -> public_html/bitgen-community/ (no token, never config.php). Create database = requires
  bitgen-community/lib/db.php and runs db_schema (tries CREATE DATABASE if missing; cPanel users usually cannot).
  Token = fine-grained, Only tigerart, Contents read-only; checked with GET /repos/Tim-byte-dev/tigerart before saving.
- Bitgen-Studio 2.712.1: community/lib/settings.php - no config.php -> bgc_private_settings() (db.json + db-pass.txt
  via bgc_secret_open; wrong key / damaged = ApiError 500 in words); config.php wins; BGC_DSN overrides. README section.
  website/, website-sync.py, test-website712.js removed; test-community7121.js (11, e2e).
- Checked for real: Apache 2.4 + mod_php 8.3 + MariaDB 10.11 over https (the .htaccess rules: inc/ data/ lib/
  README 403, installers as attachment, http -> https; the whole setup / token / Update / Create database flow; the
  Community api reading the encrypted password). Tim has not uploaded it yet. NEXT on his side: back up the old site,
  upload tigerart-site-2.712.1.zip, /b_admin/ setup, token, Update, Create database.

## 2.712.0 — 🌐 THE tigerart.com.au WEBSITE (bitGen STUDIO THE ONLY PRODUCT)

Tim: "can you create the full tigerart.com.au website and only use bitgen as the only product"; picks: a PHP site for his
hosting, every page + GitHub links, downloads free (the one-file installers on the site, the source on GitHub).
- website/ (NOT part of the app): index (intro film BESIDE the headline - never over it; it pauses at 8.7 s, before the
  fade - a pause, not a seek, so it needs no byte ranges), features (all features from data/site.json + filter; [hidden]
  is display:none !important - .feat's display:grid beat it once), download (.pick buttons -> assets/get/install_all.*),
  guide, community (member count from /bitgen-community/api.php?a=info, cached 5 min in the temp dir), about (credits
  incl. "by"), privacy, 404; inc/site.php (GITHUB*, NAV, u() = links from the pages' folder, h(), site()),
  inc/header.php / footer.php; assets/site.css (tokens: carbon #16120e, kiln #211b15, seam #3a3128, bone #eee4d3,
  ash #a3967f, tiger #f59e2c, ember #c4761a, signal #8fbf6f; Big Shoulders Display 500/800 + Atkinson Hyperlegible,
  self-hosted OFL woff2 from @fontsource); .htaccess (https, inc/ data/ README denied, installers as attachment).
- scripts/website-sync.py: screenshots -> assets/img/*.jpg, intro.mp4 + poster (8.5 s), installers, data/site.json
  (version, features from docs/FEATURES.md, credits, PDFs as GitHub raw links). Needs Pillow + ffmpeg. RUN IT EACH
  RELEASE that changes the version (test-website712 checks site.json's version = package.json's).
- website/README.md: cPanel upload (back up public_html first; keep bitgen-community/, .well-known/, cgi-bin/).
- Test: test-website712.js (70: every page + every local link 200, installers byte for byte, filter / phone menu /
  film hold / reduced motion in Playwright; SKIP without php). In e2e only (spawn - not ci-units).

## 2.711.0 — 💬 COMMUNITY IS A FLOATING DOCKER

Tim: "make it a floating docker too".
- static/community.js: the panel body goes into SecFloat.add({id: "community", title: "💬 bitGen Community", w 380,
  h 540, minW 280, minH 220, button: #tCm, firstX: right side}) - the same docker system as Basic Settings / Help /
  Bug report (static/secfloat.js -> static/dockfloat.js): floats, every edge sizes it, docks beside / below / inside a
  docker as a tab, ▁ ⛶ ✕. Without SecFloat (a bare page) the old fixed bottom-right panel is the fallback (.cmfixed).
  isOpen() = SecFloat.state("community").shown (polling 4 s / 20 s follows it).
- lib/dockerStatus.js FLOATS + "community" (its place / size / shown kept in docker_status.json floats.community);
  test-secfloat / test-negprompt pins updated.
- Test: test-community711-ui.js (7, e2e). USAGE / FEATURES updated.

## 2.710.1 — 💬 Community: friend requests show "✓ Accept" / "✕ Decline" in words (were bare ✓ / ✕)

## 2.710.0 — 💬 THE bitGen COMMUNITY (CHAT, FRIENDS, HELP ROOM) + ITS PHP SERVER

Tim: "i would like to make bitgen a community, can we add a little chat to bitgen like fb - if a user adds a user id to
bitgen they join the community and can add other users as friends, first they ask, then if approved they become
friends. this should enable people to get help". His picks: the server on his Tiger Art hosting (PHP + MariaDB) and a
public Help room as well as friends' chats.
- community/ (server, built by a sub-agent from community/API.md - THE CONTRACT): api.php (the one endpoint), lib/
  (http, settings, db - PDO MySQL + SQLite, tables bgc_* created on first use - validate, ratelimit, auth, users,
  messages, act_account / act_friends / act_chat / act_admin), .htaccess (only api.php reachable), config.sample.php
  (config.php + *.db gitignored), README.md (cPanel install, register first THEN add your handle to admins).
  Env overrides for tests: BGC_DSN, BGC_ADMINS, BGC_REGISTER_PER_HOUR. Only ever run on SQLite here - the first
  MariaDB run is Tim's https://tigerart.com.au/bitgen-community/api.php?a=info.
  Interpretations: delete_account wrong password = 403; "help" is a reserved handle; banned = 404 to others; GET only
  for info; admin_delete clears its reports; passwords sha384-prehashed before password_hash.
- App side: lib/community.js (community.json in the install folder holds url / handle / display / token - token never
  to the page; https only except this computer; ACTIONS whitelist; 401 -> signed out), routes/community.js (GET
  /api/community, /url, /join, /signout, /leave, /call/:action) mounted from routes/index.js.
- static/community.js: 💬 Community button added to #statusbar after #tQ (at run time), a fixed bottom-right panel:
  Join / Sign in, Help room, Friends (find, + Add friend, accept / decline, waiting, remove, block), a tab per friend,
  ⚑ report (inline reason box - no browser dialogs), admin 🗑 + ⋯ Reports (delete, ban), ⋯ sign out / leave / server
  address. Polls every 4 s open / 20 s closed; badge = unread + requests. People's words are textContent AND
  data-noi18n (never translated by static/uilang.js).
- New words translated (zh-CN / ja by hand, zh-TW converted; TW_WORDS 遮蔽 -> 封鎖).
- Tests: test-community710-server.js (151, e2e - SKIP without php), test-community710.js (16, ci-units),
  test-community710-ui.js (16, e2e: the panel against the real PHP server). ci-units 309/309.

## 2.709.0 — THEME IMPORT KEEPS THE OLD THEME, SAVES THE NEW ONE, ↶ REVERT

Tim: "can u add an import button to themes,save the current theme as themename_old.json and save the imported theme
automatically when imported add a revert button as well to revert to the old theme if pressed" (⤒ Import already
existed since 2.435.0 - it now does the rest).
- static/themes.js importFile: snapshot of the theme in use saved as themes/<name>_old.json (a built-in, never-saved
  theme: its own name, e.g. Slate_old), the imported record used (useRecord) and saved at once as themes/<its name>.json
  (a name the store refuses - the built-in "bitGen Default" - retried as "<name> (imported)"); h3.themeRevert =
  {file, name}; ↶ Revert (#s_threvert, hidden until an import) loads the _old record back under its original name and
  hides again. oldNameOf / revert exported. A second import overwrites <name>_old (the theme in use at that moment).
- Tests: test-themeimport709-ui.js (8, e2e). docs/USAGE (Saved themes paragraph - its zh/ja guide sections now show
  as changed until a refresh), FEATURES; new words translated.

## 2.708.0 — 16 GB MODE FOR MINIMAX H3 + THE RTX VFX UPSCALER

Tim sent DENO's "MiniMax H3 R2V Turbo 8+2" export ("this workflow is meant to work with 16gb vram - minimax") and an RTX
2-pass upscale export; his picks: "16 GB mode for my H3 renders" + "Add the RTX upscale". Licence: the exports are DENO's
(GPL-3.0) - NOT copied into the MIT repo; only their verified class / widget names are used in our own code.
- 16 GB mode: scripts/h3_16gb.py (pure apply(g, opt) -> (g, notes)) on any native H3 render (MiniMaxH3ReferenceToVideo /
  ImageToVideo -> SamplerCustomAdvanced -> BasicGuider): DenoTextEncoderUnload between conditioning and both guiders;
  pass 1 = base model (the graph's ComfySwitchNode turbo switch bypassed via on_false, style LoRAs kept) -> [kitchen
  attention] -> Acc 8-step LoRA -> MiniMaxH3SigmaShift 12/3, scheduler steps 8, euler; pass 2 = LTXVSeparateAVLatent ->
  MinimaxH3LatentUpscaler3D (scale by multiplier, align 32; other widgets by schema sync) + audio SetLatentNoiseMask
  (SolidMask 0) -> LTXVConcatAVLatent; BasicScheduler 8 -> SplitSigmas 6 [1]; base -> DMD LoRA -> 2K refiner LoRA ->
  sigma shift -> BlockSparseAttention sol-attn; VRAM_Debug before the decodes. Each part only when /object_info has the
  node and the LoRA list has the file (by basename, any subfolder) - else a note. Skips FastH3 graphs; with the ⚙
  upscale stage keeps only unload + pass 1; scale 1 = no pass 2; RunPod never. cfg -> 1 with pass 1 turbo.
- misc/worker.py: _vram16_cfg / _gpu_vram_gb (GiB from /system_stats) / _vram16_opts; applied after FastH3, before the
  upscale stage. engine.comfy.vram16 {mode auto|on|off (default auto = card <= 16.5 GiB), scale 1.5, turbo true}.
- lib/vram16.js (cfg, status, add-on install/remove), Settings ▸ Add-ons ▸ 16 GB mode (lib/addons.js), routes/vram16.js
  GET /api/vram16, Settings ▸ ComfyUI ▸ 16 GB mode (index.html markup + static/vram16.js fill/read/refresh), catalog
  h3_acc8 / h3_dmd_ref / h3_refiner2k (+ the existing h3_latent_up), lib/comfy.js repos h3latentup (LBH nodes) + deno.
- RTX VFX (built by a sub-agent on the DLSS 5 template): misc/rtxvfx_worker.py + scripts/rtxvfx_graph.py (VHS_LoadVideo
  skip/cap per chunk -> DenoRTXVFXVideoFinisher -> VHS_VideoCombine; the WORKER chunks (frames per batch, default 48,
  0 = one run) and joins with ffmpeg concat -c copy, sound laid back), lib/rtxvfx.js, routes/rtxvfx.js,
  static/rtxvfxpanel.js, ext/previewdock/rtxvfx.js, the ⚙ Upscaler option "rtxvfx", stub-comfy DENO stand-in.
  NOT VERIFIED on a real ComfyUI: frame counts per chunk and the -c copy join; option lists come from /object_info.
- static/uilang.js fill(): a captured value with an icon ("✗ Lasso") is translated by its words. New UI words translated
  (zh-CN / ja by hand, zh-TW via i18n-zhtw.py --ui).
- Tests: test-vram16708.py (30, e2e), test-vram16708.js (9, ci-units), test-vram16708-ui.js (7), test-rtxvfx708.js (26,
  e2e - spawns the stub); test-expertmode help count 63; ci-units 308/308.

## 2.707.0 — 🌏 EVERY DOCKER IN 简体中文 / 繁體中文 / 日本語 (IMAGE EDITOR, TIMELINE, SKETCHER, SOLIDCRAFT, …)

Tim: "ok, i guess we can do the dockers next".
- static/uilang.js SKIP no longer holds #imageeditdock / #timelinedock / #pushpulldock / #solidcraftdock.
- scripts/ui-dynamic.js: scope ALL (static/*.js minus uilang/helplang, every ext/<docker>/*.js, all index.html scripts;
  --settings = the 2.706 scope). Adds the editors' data words: label-like properties (label / name / title / tip / hint / desc
  / caption / placeholder / text / tooltip / help) with plain-word values, ["id", "Label"] pairs, any template / string holding
  HTML tags (tooltips inside .map() templates); title= / placeholder= attributes inside innerHTML; tag / code fragments
  dropped. .push() counts when the array is .join()ed into a write in the same function. dynamic.json: 5073 strings, 992
  patterns, src = repo-relative file:line.
- scripts/ui-strings.js: opens the Sketcher / SolidCraft and clicks every docker's [data-tab] / [data-tool] / .ietool /
  [data-menu] / [data-mode] / .cbtab / … (up to 160 per docker); junk() drops readouts (sizes, dB, dates, colour codes) and
  strings a pattern makes from a NUMBER (word-filled ones keep their entry); keeps what earlier collections found (--fresh
  starts over; --clean re-filters without a browser; playwright now loaded lazily). strings.json 5312.
- Dictionaries 8533/8533 strings + 992/992 patterns in all three, check 0. New words: 12 chunks x zh-CN / ja translator
  agents (brief scratch c707/tr/BRIEF-707.md) + reviewers (zh-CN ~110 fixes, ja ~140) ; zh-TW = i18n-zhtw.py --ui then 6 Taiwan
  reviewers (~1,000 fixes). Docker names kept as the dictionary had them (zh: 草图建模 / 故事板; ja: English). zh-TW video
  frames = 影格 / 關鍵影格 everywhere now (app + zh-TW guide + help; 首幀 / 尾幀 / 幀數 / 幀率 stay) - TW_WORDS has them.
- i18n-ui.js PH: "[..]" placeholder only without spaces ("[ and ]" in "Brush size ([ and ])" is words).
- Guides: lib/helpI18n.js EDITORS = /(?!)/, UI_EDITOR_PAGES = [] - every section names buttons as the app shows them;
  trName() also turns a ▸ menu path when every part is a dictionary word. PDFs rebuilt.
- ext/videodock/storyboard.js rename(): also finds "Video" already translated (H3UiLang.state().dict.Video).
- Text-dependent logic audited in ext/*: only harmless write-if-changed compares. NOT translated: words drawn on canvases
  (timeline ruler / clip labels, image-editor on-canvas readouts) - fillText also draws users' own text layers.
- Tests: test-uilang707.js (11, ci-units), test-uilang707-ui.js (12: the four dockers per language, a tool still works with
  its options translated, 2,000 updates in ~0.15 s, back to English); 705 / 706 tests updated (editors no longer skipped).
  A full zh-CN sweep clicking every docker tab / tool / menu left 0 English sentences.

## 2.706.0 — 🌏 THE SETTINGS DIALOG IN 简体中文 / 繁體中文 / 日本語, LIVE STATUS LINES TOO

Tim: "do the settings dialog next, the other dockers can go into the next edit".
- scripts/ui-dynamic.js (new; needs the global npm `typescript` as a JS parser - a dev tool, not shipped): reads the CODE for
  every place it writes words (textContent / innerText / title / placeholder / innerHTML =, setAttribute(title|placeholder|
  aria-label), and .push() inside a function that writes into Settings). forms() expands template literals, +, ternaries, ||;
  pieces() splits innerHTML at tags, keeps holes through split() (token "Zq9hole"), drops CSS / code / file names. Scope = the
  Settings files (FILES: about, addons, comfyupdate, dockreset, hwpanel, llmtab, remotegpu, settings3d, speechengines, updater,
  layouts, stylecard) + index.html code writing into an id inside <dialog id="settings"> (365 ids). Output
  static/i18n/ui/dynamic.json: 183 strings + 125 patterns ({n} = a value the code fills in).
- static/uilang.js: compile(patterns) -> regexes (hole = ((?:(?! · )[^\n])+?) - never spans " · " or a line), tried after the exact
  lookup; fill() translates a captured value when it is itself a dictionary word; trAll() falls back to line by line ("\n")
  and " · " piece by piece. #log added to SKIP.
- scripts/i18n-ui.js: strings() = strings.json + dynamic.json; patterns with HOLES check; save() prunes both.
- Dictionaries 3382/3382 strings + 125/125 patterns in zh-CN / zh-TW / ja, check 0 problems (agents + reviewers as 2.705).
- strings.json recollected (Settings tabs all opened; core limit 2000 chars; text-box placeholders) - about 3,288 entries.
- NEXT (Tim's plan): the other dockers / editors - image editor, timeline, Sketcher, CAD: drop them from SKIP, recollect,
  extend ui-dynamic FILES/scope, translate, shrink helpI18n EDITORS + UI_EDITOR_PAGES.
- Tests: test-uilang706.js (10, ci-units), test-uilang706-ui.js (9: every tab in each language, ~1,300 pieces, live token /
  package / dockers statuses, back to English). Gate + 2.

## 2.705.0 — 🌏 THE APP ITSELF IN 简体中文 / 繁體中文 / 日本語 (THE MAIN WINDOW FIRST)

Tim: "is it possible to add a language dropdown to the left of docker layout and change the language of the ui on change?" -
his answers: "Translate and update guides", one setting with the guide, "Main window first".
- static/uilang.js (H3UiLang, after helplang.js): no code rewrite - text nodes + title / placeholder / aria-label swapped from
  static/i18n/ui/<lang>.json by exact lookup of split(s).core (icons, ":" "…", balanced brackets handled); ORIG / LAST WeakMaps
  so the app's own later writes are re-translated and back-to-English restores; MutationObserver on documentElement; SKIP =
  #imageeditdock #timelinedock #pushpulldock #solidcraftdock, the guide text, code / pre / kbd / textarea (SKIP_ATTR lets
  textarea placeholders through), [data-noi18n]; CSS keep-all for CJK short labels (button, label, select, .bhead, .wslab,
  tabs, headings), nowrap for #sbjobs/#sbllm/#sbcomfy…; dictionary cached in localStorage bg.uiDict.<lang>. The dropdown
  #uiLangSel = H3HelpLang.picker inside #dockCfgWrap before ⊞. Default = H3HelpLang.get() (the system's language).
- Text-dependent logic fixed: #sbcomfy dataset.state (running / starting / down) drives start-on-click; s_hfstatus dataset.checked.
  ~70 other textContent comparisons only compare with what they are about to write (harmless churn, no loops seen).
- strings: scripts/ui-strings.js (Playwright on a running copy; opens Settings tabs + menus) -> static/i18n/ui/strings.json
  (3,272 after dropping readouts / dates / machine paths). scripts/i18n-ui.js build|status|check (save() prunes keys no longer
  collected; a bare "The"/"A" may be ""). Dictionaries made by 16 translator agents (8 pieces x zh-CN / ja, brief in scratchpad
  ui/BRIEF-UI.md - now summarised in docs/i18n/TRANSLATING.md) + reviewers (zh-CN 234 fixes, ja ~656, zh-TW from zh-CN via
  i18n-zhtw.py --ui then Taiwan review 350 fixes and +50 TW_WORDS). BUILD FROM A DIR WITH ONLY NEW PIECES (old pieces would
  overwrite reviewed words).
- Guides: lib/helpI18n.js uiDict / uiNames / uiNamesHtml - **X**（gloss） -> **translation** when X is in the UI dictionary, at
  read time, except EDITORS sections (regex on the English title) and UI_EDITOR_PAGES (the 3 ❔ pages); ~375 names per language.
  PDFs: make_guide_pdf.py --lang reads `node scripts/i18n-help.js render <lang>`.
- NEXT (Tim's plan): the editors' UI - remove them from SKIP, recollect, translate the new strings, shrink EDITORS.
- Tests: test-uilang705.js (14, ci-units), test-uilang705-ui.js (9); ci-units 305/305. Gate + 2 (1869).

## 2.704.0 — 🌏 TRADITIONAL CHINESE (TAIWAN / HONG KONG) TOO

Tim: "can you add a traditional chinese version as well?" (after a Taiwanese page posted a Traditional Chinese infographic of the
README). zh-TW was NOT translated from English: scripts/i18n-zhtw.py converts the reviewed zh-CN with OpenCC s2twp (pip install
opencc; KEEP regex leaves code, tags, links, markers) + TW_WORDS; a Taiwan-editor review then made ~3,900 fixes (those terms are
now in TW_WORDS; table 列 = row / 欄 = column, 應用程式 vs 套用, 專案 vs 項目, 連線 vs 連接 need reading). The script refuses to
overwrite docs/i18n/zh-TW without --force - to refresh, convert only the stale sections (convert_text) and `assemble`.
LANGS zh-CN, zh-TW, ja; helplang 繁體中文 (zh-TW/HK/MO/Hant default to it); cjkfont TC; --lang zh-TW PDF; check finds Simplified chars
in zh-TW (the picker labels 简体中文 / 繁體中文 ignored). The languages section of USAGE (+ its 3 translations, hash 71defce43e4e)
updated. Tests: test-i18n703 25, test-i18n703-ui 11; ci-units 304/304. GitHub: delete the wip/2.703.0-i18n branch (the proxy
refuses branch deletes; wip/2.704.0-zhtw was never pushed after its first commit - delete it too if it shows).

## 2.703.0 — 🌏 THE GUIDE + HELP IN SIMPLIFIED CHINESE (MAINLAND) AND JAPANESE

Tim: "is it possible to translate help and the user guide into chinese and japanese as additional help files?" - his answers:
instructions translated (the "- 2.x:" bullets ARE the instructions, so the whole guide), "sorry it should be simplified chinese
for mainland china", refresh when he asks (not every release), PDFs too.
- FILES: docs/i18n/<lang>/USAGE.md (after every "## " heading `<!-- en: <id> <hash> -->`; _top after the "# " title),
  docs/i18n/<lang>/shortcuts.json ({lang, groups: [{en: hash, title, rows}]}), static/help/<lang>/<topic>.html (first line the
  marker). <hash> = sha256[:12] of the English it came from (sections: title + helpDocs md; pages: the file; groups: JSON).
- lib/helpI18n.js: LANGS zh-CN / ja, hash, rawSections (ids = helpDocs slug), enHashes, withMarkers, load(base, lang) (sections
  in English order: translated {lang, stale, enTitle} or the English one {lang en}; groups likewise), page(base, topic, lang),
  report(). routes/help.js: GET /api/help?lang=, GET /api/help/page?topic=&lang= (never server.js).
- static/helplang.js (H3HelpLang, before palette.js in index.html): get (localStorage bg.helpLang, else navigator: zh / zh-CN /
  zh-SG / zh-Hans -> zh-CN, zh-TW/HK -> en, ja -> ja), set, onChange, say (stale / missing / english notes), picker(). palette.js:
  /api/help?lang, select.hlplang in .hlpbar, note(sec) [data-hlpnote stale|missing] + [data-hlpen] -> showEnglish, relang();
  help.js: the picker in the title bar, /api/help/page, [data-hpnote] stale (button = the English page) / missing.
- REFRESH (when Tim asks): `node scripts/i18n-help.js status <lang>`; `prep <lang> <dir>` (only stale / missing; --all = all;
  --size 40000) gives guide-NN.en.md (+ help-<t>.en.html, shortcuts.en.json); translators write guide-NN.<lang>.partK.md,
  help-<t>.<lang>.partK.html, shortcuts.<lang>.json; `assemble <lang> <dir>` merges by marker (English order) + joins lines
  broken between CJK characters; `check <lang>` (markers, code, links, pictures, tables, headings, tags, ids, keys, untranslated,
  Traditional chars in zh-CN, CJK line breaks) must say 0 problems. The brief + glossary the translators used:
  docs/i18n/TRANSLATING.md (UI names stay English, glossed once).
  THE GIANT SECTION: "floating-dockers-named-dockers-dialogs-in-the-middle-2-438-0" holds every "- 2.5xx-2.70x" bullet (140 KB) -
  any new bullet there makes the whole section stale; put new release text in its OWN "## … (2.x.0)" section instead.
- PDFs: scripts/cjkfont.py cjk_ttf(lang, weight, text, dir) (Noto Sans CJK SC / JP from the .ttc, subset, CFF -> glyf);
  make_guide_pdf.py --lang zh-CN|ja -> docs/bitGen-Studio-Guide-<lang>.pdf (WORDS per language, wordWrap CJK, fb() wraps chars
  only DejaVu has). Needs fonts-noto-cjk on the build machine.
- How it was made: 40 translator agents (20 per language, ~40 KB pieces), then one reviewer per language (zh: ~157 term /
  punctuation fixes; ja: ~1900 lines - joins, full-width punctuation, terms, "Settings ▸" kept English), then the CJK line join.
  No meaning errors found by either reviewer. NOT read by a human native speaker yet.
- Tests: + test-i18n703.js (22, ci-units), test-i18n703-ui.js (10). Gate + 2 (1867). The wip/2.703.0-i18n branch on GitHub can be
  deleted (the proxy refuses branch deletes). PRE-EXISTING: test-palette530 fails (expects a House builder section, gone since 2.630).

## 2.702.1 — CREDITS: TEXT EFFECTS AND FONTS

Tim: "add https://www.facebook.com/dandyson.godspower  - Dandyson EEbu (Baridakara) to the list of credits for the Text
Effects/Fonts" - there was no such section, so lib/credits.json gained "Text effects and fonts" (after 3D models, 11 sections)
with {name "Dandyson EEbu (Baridakara)" (Tim's spelling), url his Facebook page, what "text effects and fonts"}. USAGE.md's
Credits regenerated (make_credits.py), PDFs rebuilt; test-credits642 pins 11 sections + the credit. No new legs.

## 2.702.0 — 🖼 SVG PICTURES INTO ASSETS + REFERENCES; THE LOGO AT 1920 X 1080

Tim: "can u add svg to the images i can upload to assets or references. and give me a 1920x1080 image of the logo please"
- NEW static/svgpic.js (window.BGSvg, loaded right after jxl.js in index.html): pure isSvgName / looksSvg (skips <?xml, comments,
  doctype, BOM) / len (px pt pc mm cm in) / sizeOf (width+height, else viewBox, else 300 x 150) / target (long side 2048..4096, the
  shape kept) / prepare (width/height = the PNG's, a viewBox from its own size when it has none, xmlns added) / pngName. Page:
  isSvgBlob (type, name or sniffed), toPng (Image of the prepared SVG -> canvas -> PNG, transparent kept; cached per blob),
  toPngFile, widen (picture inputs' accept + ".svg,image/svg+xml"), and a fetch wrapper: ANY FormData upload sends an SVG as the PNG
  (a broken SVG -> a fake 400 {error} Response, nothing sent; a "keepsvg" field opts out). Nothing server-side changed: PKINDS has
  no .svg - the server only ever stores pixels (ComfyUI / ffmpeg / the models can't read SVG).
- static/filedialog.js: FAMILY image + ".svg"; pickInto reads a picked .svg in as the PNG (BGSvg.toPngFile) unless the input has
  data-keep-svg - so Image Edit's Open / Place as Layer get it too. static/addtile.js: DRAWN {".svg", ".svgz": images} in kindOf /
  accept (EXTS still = PKINDS - test-addtile pins that). index.html's tray filepick (+ add reference) converts before refs.push (the
  2.699.0 first-picture size then reads the PNG).
- docs/images/bitgen-logo-1920x1080.png: the mark (logo.svg viewBox 7 236 1054 600 at 1480 x 842) centred on the intro's dark
  radial background; a transparent version went to Tim only (scratchpad logo/make.js).
- Tests: + test-svg702.js (13, ci-units), test-svg702-ui.js (9: Assets upload -> PNG 2048 transparent, a viewBox-only icon scaled
  not cropped, broken refused, untyped sniffed, accept widened, the tray, the real Open dialog with an .svg on disk -> Assets PNG;
  tidies via /api/passets/recycle). jxl-ui 9, addtile-ui 14 green. Gate + 2 (1865).

## 2.701.0 — 🎬 THE START-UP SPLASH (15 S, THE CREDITS) + THE LOGO IN THE SETUP

Tim: "can u make a splash screen with the video, but add produced and developed by Timothy Nolan Paul, programmed by claude opus 5.5
15seconds, and add the logo to the setup"
- misc/intro/intro.html #splash: DUR 15, body.splash (everything moved up), .cred #cr1 "Produced and developed by" + "Timothy
  Nolan Paul", #cr2 "Programmed by" + "Claude Opus 5.5" (9.0 / 9.8 s), the logo breathing after 8 s, the fade at 14.3 s.
  misc/intro/render.js rewritten (the 2.700.0 one wrote to its cwd): --splash -> docs/images/bitgen-studio-splash.mp4 (H.264) +
  static/splash.webm (VP9 crf 34, 0.7 MB - the app's copy); `node misc/intro/render.js [--splash] 2.2,5.9` = test frames.
- static/splash.html: <video src="splash.webm" autoplay muted> full window (cover), ended / error / mousedown / keydown ->
  window.close(), "click or press any key to skip" after 1.5 s, the page draggable.
- electron/main.js: createSplash() (frameless, on top, 62 % of the screen width <= 1280, 16:9, static/icon.png) before
  startServer() in the no-setup branch; splashDone / winReady / maybeShowMain - the main window's ready-to-show no longer shows it
  directly; 16.5 s safety; BITGEN_NO_SPLASH=1 or a missing splash.html / .webm = no splash. The setup branch has no splash.
- electron/installer.html: .mark (every page header) + #tbar .logo = static/icon.png as a background picture (a CSS mask does NOT
  load over file:// - the setup window is loadFile'd).
- Tests: + test-splash701.js (6, ci-units), test-ui701-ui.js (5, file:// - no server). Gate + 2 (1863). NOT run inside a real
  Electron here (no display) - Tim to see it start. The credits in Settings ▸ About (lib/credits.json "Tim Paul") are unchanged.

## 2.700.1 — 🦋 THE LOGO SHOWN WHOLE

Tim: "the banner logo is cropped" - the title bar mark masked logo.svg at 170% of a 22 px square (the wing tips cut). NEW
static/logo-mark.svg = the logo with viewBox "7 236 1054 600" (its outline 17,245.7 1034 x 579.7 + 10 px); .tblogo 37 x 21 px,
mask contain. The app icon re-rendered with the mark at 0.97 scale + 8 % padding (the tips had touched the rim): static/icon.png,
favicon.png, installer/bitgen.ico, docs/images/logo.png. No tests changed.

## 2.700.0 — 🦋 THE BITGEN STUDIO LOGO + A 10 S INTRO FILM

Tim: "use this as bitgen-studio logo, are you able to make a 10sec intro video? the logo is 2 tigers in front of a tree, the tigers
are for coorporation against all odds, the tree is for growth, the butterfly(from the 2 tigers and tree) is for change into
something beautiful - i designed it myself for tigerart but will use it here" (his tiger_logo_white.svg, 1080 x 1080, 22 paths,
#e5e5e5).
- static/logo.svg (his file as is); static/icon.png (512: the mark on a warm dark rounded square, 1/64 tiger-orange rim - Electron
  window + taskbar icon, installer/bootstrap.sh's .desktop); installer/bitgen.ico (16 - 256, ImageMagick convert); static/favicon.png
  (64; <link rel="icon"> in index.html); the title bar's .tbicon ▦ -> <i class="tblogo"> (22 px, CSS mask of logo.svg filled with
  var(--tiger) - follows the theme); README: docs/images/logo.png (256) centred above the title. Icon sources: rendered in
  Chromium (scratchpad icons.js - the logo at 1.12 scale in the square).
- THE INTRO: docs/images/bitgen-studio-intro.mp4 (10.0 s, 1920 x 1080, 30 fps, H.264 crf 18, silent, 1.1 MB). Source misc/intro/
  (intro.html: draw(t) - the 22 paths split into halves by bbox centre, stroke-drawn in #f59e2c from the middle outward 0.6 - 4.4 s,
  filled #f2ede4 3.8 - 5.6 s, glow pulse 5.3 s, two wing beats (scaleX of both halves about x 540) 5.4 - 8 s, "bitGen Studio"
  (Inter Display 300 / bitGen 500 orange) 6.6 s + "TOGETHER · GROW · TRANSFORM" 7.4 s, dust, fade in / out; render.js: Playwright
  JPEG q92 frames piped to ffmpeg; `node misc/intro/render.js 2.2,5.9` = test frames). NOT played anywhere in the app yet (offered:
  a start-up splash, a Settings ▸ About play button, music / sound).
- The credits (lib/credits.json) are NOT changed - test-credits642 pins Tim's two credit lines exactly; a logo credit only if he
  asks. test-ui642-ui fails on the test copy's old package.json version + its stale "9 groups" (10 since before 2.698) - pre-existing.

## 2.699.0 — 📐 OVERRIDE STYLE OFF = THE FIRST PICTURE'S OWN SIZE

Tim: "if override is not checked use the first reference image size"
- static/index.html: H3BasicImageSize() = ovrStyleOn() ? imgWhFromUi() : null.
- ext/imageeditdock/pcpromptlink.js runRefs: no Basic Settings size -> picture 1's own size (16 px steps, capped at 4096 on the
  long side - a 12 MP phone photo would otherwise go to the GPU whole) and exact ALWAYS (the graph's megapixel scalers keep it -
  before 2.698.0 they rescaled to the graph's own MP; the old S.res fitSize is gone from this path).
- Tests: test-editsize698.py + a 2.699.0 check (6), test-ui698-ui.js (7: Override off -> 1008 x 496 from 1000 x 500, exact; the
  test no longer picks the prompt docker's style - a remembered edit style broke test-promptlink-ui after it). On a FRESH test copy
  promptlink-ui 10 -> ui698 7 -> promptlink-ui 10 -> ui549 -> ui556 green. TEST SERVER NOTE: a test copy's saved state drifts
  (styles, basic settings, the last edit style) - start a fresh copy (tar work -> /tmp/.../t699, node_modules linked) when an
  image-editor / prompt-docker test fails unexpectedly. No new gate legs.

## 2.698.0 — 📐 EDITS OF A REFERENCES PICTURE AT BASIC SETTINGS' SIZE

Tim: "when we edit an image it always uses the ref-image resolution can we change this to use our resolution using basic settings
docker?"
- static/index.html: window.H3BasicImageSize = () => imgWhFromUi() ({width, height} from #imgRes + #imgAr, 16-aligned; null =
  "Style's own"); #imgRes's title says edits follow it. NOT gated on Override style (the edit graphs have no style size to keep).
- ext/imageeditdock/pcpromptlink.js runRefs (the editor closed - the References docker's picture 1; Edit / Refine; Compose
  unchanged): want = H3BasicImageSize() -> the crop canvas = want (cover: scale to fill, the middle kept) + exact; else the old
  fitSize at S.res MP. mount.js api.aiedit appends exact=1; routes/aiedit.js p.exact_size = true.
- scripts/comfy_image.py patch(): exact_size + width / height -> the report "size WxH: Basic Settings' Size" and every
  ImageScaleToTotalPixels (megapixels not a link) set to W*H / (1024*1024) (ComfyUI's megapixel), resolution_steps 16 -> the
  graph keeps that size (P-H3's 4 MP step, Qwen's 1 MP).
- NOT changed: edits INSIDE the image editor (selection / whole canvas - pasted back over it), the preview's 🎨 Change style, the
  Sketcher's ✨ Photo (its own view shape).
- Tests: + scripts/test-editsize698.py (5; py - gate leg), test-ui698-ui.js (5; puts styleSel back - a left edit style made
  test-ui549 time out). promptlink-ui 10, ui549 20, ui556 green; ui541 / ui543 fail the same on the old code (sandbox). Gate + 2
  (1861).

## 2.697.0 — 🩹 P-H3 IMAGE EDIT FIXED (THE GUIDER WAS BYPASSED)

Tim: "p-h3 downloaded but doesn't work..." + his log: "node 14: Return type mismatch between linked nodes [guider] guider,
received_type(CONDITIONING) mismatch input_type(GUIDER)" (style P-H3 Image Edit, img_ph3_edit.json, 1 picture, slots 52-58
bypassed).
- CAUSE: scripts/comfy_image.py bypass_image_slot(graph, load) bypassed EVERY node in _downstream(load) that has a `conditioning`
  link (meant for ReferenceLatent chains). P-H3's graph: LoadImage 52 -> PH3ImageConditioning 9 (images.image_2) -> BasicGuider
  10 (conditioning) -> SamplerCustomAdvanced 14 (guider): node 10 was bypassed, 14.guider got ['9', 0] (CONDITIONING).
  h3_character_creator.json lost its two BasicGuiders the same way.
- FIX: a node is bypassed only when it takes the slot's branch through an input OTHER than `conditioning` (a ReferenceLatent's
  `latent`); one reached only through its conditioning serves the whole graph. Every other shipped workflow's apply_images output
  is byte-identical to before (53 runs compared: only img_ph3_edit + h3_character_creator differ).
- Tests: + scripts/test-ph3edit697.py (5; py - a gate leg, not ci-units). comfyimage 259, imagegen 93, ph3678 py 11 / js 10,
  anima531, cnstage, facefix, loaderswap523, nougan592, regions569, relocate525, restyle685 / 686 green. Gate + 1 (1859).
- NOT run on a real ComfyUI here - Tim to try P-H3 Image Edit again.
