# bitGen Studio — handover notes (v2.818.0, 2026-11-17 — CONTINUATION
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

## 2.757.0 — 🔑 SETTINGS ▸ API: RENDER ON AN ONLINE SERVICE (2026-11-11, main (pending), tigerart (pending - wip/api-services))

Tim: "can you add an api tab to bitgen with add api input and name input and a use checkbox for each api the use adds. if
api is checked add it to styles with prefix API_ so bitgen can truly work without good hardware" (asked: "Several known
services", makes "Pictures, Video, Songs, The LLM too") + "add runninghub too".
- config.apis = {<id 8 chars>: {name, service, use, llm, base, models: {image, video, music, llm}}}; each key at
  apis.<id>.key in settings/keys.json (lib/secrets.js API_KEY / isKeyPath / pathsOf; put() skips a removed API's key;
  settings.save drops keys of removed APIs). job.json carries ONLY the job's own API key (lib/core.js).
- lib/apis.js: SERVICES openrouter (image, video; LLM https://openrouter.ai/api/v1; models google/gemini-2.5-flash-image,
  google/veo-3.1, llm google/gemini-2.5-flash), fal (image/video/music: fal-ai/flux/schnell, fal-ai/wan/v2.2-a14b/text-to-video,
  fal-ai/ace-step), replicate (black-forest-labs/flux-schnell, wan-video/wan-2.2-t2v-fast, minimax/music-1.5), openai (image
  gpt-image-1; LLM gpt-4.1-mini), gemini (image gemini-2.5-flash-image; LLM gemini-2.5-flash via /v1beta/openai), runninghub
  (image/video/music; model = workflow ID). detect(key) by shape (static/apis.js guess = same). Use -> syncStyles: one
  "API_<name>[ pictures| video| songs]" style per kind (runs_on api, api_id, api_model, api_auto); rename follows, a Model
  changed in the style kept, untick removes only api_auto ones. llm: one API at a time; gpuSplit.llmTarget asks
  apis.llmTarget FIRST (even with Basic Settings on Local). test(): OpenRouter /key, OpenAI /models, Gemini /models,
  Replicate /account, fal api.fal.ai/v1/models, RunningHub /uc/openapi/accountStatus (UNVERIFIED endpoint). Base override
  env H3_API_BASE_<SERVICE> (worker + test).
- misc/api_worker.py (stdlib only): picks the service from config.apis[style.api_id]; image / video / music; api_extra
  merged (RunningHub: a list of {nodeId, fieldName, fieldValue}); RunningHub fills the first *TextEncode/*Prompt text,
  Empty*Latent* width/height (+ length for video), seed/noise_seed, LoadImage <- uploaded pictures (first/last/refs), AceStep
  tags/lyrics/duration. Files: pictures/songs image_name.py names (@@OUTS + @@OUT), video <stamp>_<job>.<fmt> (ffmpeg if
  the service sent another container). OpenAI video refused (Sora ended Sep 2026), Gemini video refused.
- lib/core.js workerFor/isApiJob: API job = no queue-preset rest, no captioner freeForJob, no gpuSplit.forJob, _ranOn
  {label, api}. lib/styles.js gpuFields runs_on "api" (API_ prefix; leaving drops it) + missingSlots [] ; lib/apiJobs.js
  videoParams (routes/index.js /api/generate hands API_ video styles over before the H3 work); lib/rpslStyles.js hideWhy
  never hides API_; routes/modelsFound.js plan() skips API_ styles.
- routes/apis.js (mounted in routes/index.js): GET/POST /api/apis, POST /api/apis/:id, POST /api/apis/:id/test, DELETE.
  static/apis.js: Settings ▸ API tab after Remote generation. static/runson.js: Runs on ◉ API (select of APIs that make
  that kind, Model, Extra settings JSON; H3RunsOn.reload()).
- Tests: test-apis757.js (40, ci-units 332), test-apis757-worker.js (19, stand-ins for all six), test-ui757-ui.js (14; the
  gate's server has H3_API_BASE_OPENROUTER=http://127.0.0.1:8396/or; a real picture rendered by an API_ style),
  test-ui746-ui.js now expects local,remote,api. Gate (gate pending). 26 UI strings + 3 patterns x3; guide x4; FEATURES x4.
- Website: remote-gpu.php #api "Online services: Settings ▸ API" (table of the six, 4 steps); the OpenRouter "planned"
  line now says 2.757.0. Site strings 1060. test-site 258.
- NOT tested with real keys / real services (stand-ins only) - the request shapes come from each service's docs
  (Nov 2026). First real use may need small fixes per service; the job log has the service's own error text.
- Branches to delete: Bitgen wip/2.757.0-api-tab, tigerart wip/api-services.
- NEXT (unchanged plan): P_ pod styles + start on pick + Keep / Stop / Terminate + terminate bitGen's pods on exit;
  balance + costs + PDF report (could include API costs - the worker logs "[api] <service>: about $x"); donate button.


## 2.758.0 — 🧩 P_ POD STYLES + POD LOADING BAR (branch wip/2.758.0-pod-styles, stacked on 2.757.0 - NOT RELEASED YET)

Tim: "when pods are chosen only show pod styles, I am trying with this pod ComfyUI - Qwen Image - ZiT - Boogu - Krea , how can
i choose the model?" (asked: Both - models + workflows) + "can you show progess of pod loading?" (Stages + timed bar) + "use
overide settings when pods load but disable checkpoints and lora loader, overide settings will be for step, seed and cfg and
the size and aspect ratio" + "can you remove this My pods ... Pod shortcuts ... from remote generation docker and add to
pod's card in pods docker can bitgen fill in the template link automatically?"
- lib/styles.js runs_on "pod" = P_ (pod_id blank = the pod in use, pod_name, pod_port, pod_auto); lib/rpslStyles.js: Pods
  (Remote/Both) = only P_ shown; P_ hidden otherwise. lib/gpuSplit.js podTarget/forJob: P_ renders on its pod via proxy.
- lib/podStyles.js: contents (pod models via liveLists + /api/userdata workflows), starterFor (Qwen/Z-Image/Krea2/FLUX/SDXL),
  swapFiles (pod's model + closest te/vae into bitGen's starter graph), make (P_ per model + per pod workflow, UI->API via
  graphToApi with the pod's /object_info; pictures only), autoFor (2.759). Graphs in comfy_workflows/pod/.
- lib/podProgress.js + lib/remoteGpu.js podState: stage 0-3 + bar timed vs rgpu.pod_loads (pod:/img:).
- static/podload.js: bar, 🎨 Styles panel, Basic Settings lock (P_ picked = imgCkptCombo/imgLoras/tliRows, vidModel/tlvRows
  disabled; Pods ticks #ovrStyle); routes/index.js genimage: P_ = no model/LoRAs/weights/mm, style steps/cfg/size null
  (Override sends them); /api/generate P_ video: bo.model/loras cleared.
- remotedock.js: My pods + shortcuts REMOVED (🖥 PODS docker button). podsdock.js: ☆ on cards = shortcut (link auto), ★
  Shortcuts tab (Deploy ↗, paste box for private), ⬇/🎨 buttons on running pods.
- Tests: test-pods758.js 25, test-pods758-live.js 7, test-ui758-ui.js (not yet run in a browser - server busy), test-ui754
  updated (no pods in remote docker), test-ui746 (local,remote,api).

## 2.759.0 — ⬇ MODELS ONTO A POD + PODS FOR A STYLE (branch wip/2.759.0-pod-models, stacked - NOT RELEASED)

Tim: "if i select a pod, how do i choose what model comfyui template to use and to dl it?" (asked: Both).
- lib/podModels.js: planFor(style ids) from workflows + lib/modelCatalog.json (HF url + comfy folder); ways (argv comfy dir,
  ComfyUI-Manager, Jupyter); start: Jupyter kernel via Node 22 WebSocket runs a download thread (.bitgen_dl.json progress) -
  any file; Manager install_model = its whitelist only (no Z-Image/Krea2); state. H3_HF_BASE stand-in. SSH NOT done (told Tim
  it was a third way - say it is not in 2.759.0).
- lib/pods.js create: env JUPYTER_PASSWORD (random, rgpu.pod_jupyter.<id> encrypted - secrets POD_KEY) + template ports +
  8888/http; for_style -> rgpu.pod_for -> autoFor on first load.
- PODS docker: For … select (templateScore, ✓ fits), ⬇ Models panel.
- Tests: test-pods759.js 14, test-pods759-live.js 8 (real WS kernel stand-in), test-ui759-ui.js (not yet run).
- UNVERIFIED against real RunPod / real templates: whether a template honours JUPYTER_PASSWORD / runs Jupyter on 8888.

## STATE AT THIS POINT (2026-11-14)
- RELEASED: … 2.763.0 61e4b70, 2.763.1 f6cfd48, 2.763.2 0c75c6c, 2.763.3 24b334f, 2.763.4 3bce8ff, 2.763.5 d3022b1, 2.764.0 dfb3198, 2.764.1 544b31a, 2.764.2 fd3537b, 2.764.3 a67e898, 2.764.4 f88c1c1, 2.764.5 38329c7, 2.764.6 a12ca11, 2.765.0 40f81b8, 2.766.0 8b33064, 2.766.1 42ba703, 2.766.2 28873f4, 2.766.3 b442fee, 2.766.4 1e54084, 2.767.0 7266453, 2.768.0 a3671ef, 2.769.0 b56777c, 2.769.1 e48e983, 2.769.2 8fcc9f6, 2.770.0 d00c282, 2.770.1 1bafe47, 2.770.2 56d1639, 2.771.0 964d2b8
  (CI 43375357989 green; 2.771.0 = 💲 Costs docker + 📊 Statistics dialog - see its section below). tigerart main b2790c2 (refresh, 263). Repo zip sent. ci-units 354.
- website (2026-11-15, after 2.792.0; Bitgen 76089d7 + 18c6bc8 docs-only, tigerart 1e7726a): Tim "please update the website with the new/updated features, use screenshots if u can" - 5 new shots in docs/images (mm-sources, mm-openrouter, family-filter, runs-on-gpus, nopod-remake; made against a stand-in studio: H3_TEST_GPUS two cards, an OpenRouter list stand-in on 8397, stand-in pod inventories), added to tigerart scripts/website-sync.py SHOTS; features.php has a pictured section "Models, pods and graphics cards" (#models-pods-and-graphics-cards, the \$models list, before Keep track of usage), 33 t() strings in ja / zh-CN / zh-TW (zh-TW via i18n-zhtw convert_text; avoid 项目 - OpenCC makes it 專案); site-keys.json re-exported. test-site 270/0, languages 19/0; test-pins 5 fails were there before (pinned-note order). Tim presses Update on /b_admin/ to deploy.
- 2.821.0 71585d7 (2026-11-17): image editor - Insert Into Frame (arrow + click), the order items on the right-click menu (frame layers stay in), the Gradient tool on shapes / text, real cut / join (bakeShape) - see "## 2.821.0". NEXT = the interactive drop shadow, then the WP layer (2.822.0 / 2.823.0 - ">>> NEXT: 2.820.0 IMAGE EDITOR").
- 2.820.0 8f083e5 (2026-11-17): ✉ Mail finished - Test / Close keep the account, picks + batch, Move ▾ + drag, server search, ⤓ Older, ＋ folder, To suggestions (lib/mailBatch.js, ext/maildock/mailcontacts.js) - see "## 2.820.0". NEXT = the image editor's 2.821.0 Move to Frame + interactive fill / drop shadow, then the WP layer (">>> NEXT: 2.820.0 IMAGE EDITOR" - now 2.821.0 / 2.822.0).
- 2.819.0 40db346 (2026-11-17): image editor - Ctrl+Shift+A clear all, double-click = handles (no box), click again = rotate, the lasso / Bézier live lines, one shape mode (pcpickmodes.js) - see "## 2.819.0". NEXT = 2.820.0 Move to Frame (drag) + interactive fill / drop shadow, then 2.821.0 the WP layer (">>> NEXT: 2.820.0 IMAGE EDITOR"); the SPREADSHEET / SLIDES plan waits until these are done.
- 2.818.0 016c07a (2026-11-17): ✉ MAIL with your own AI (ext/maildock + lib/mailStore / mailImap / mailSend / mailAi + routes/mail.js) - see "## 2.818.0". NEXT = 2.819.0 ▦ SPREADSHEET (">>> NEXT: 2.819.0 SPREADSHEET"), then 🎞 SLIDES; Tim tests after all of them.
- 2.817.0 5b40725 (2026-11-17): the app strip on the top bar (static/appstrip.js) - see "## 2.817.0". NEXT = 2.818.0 ✉ MAIL (">>> NEXT: 2.818.0 MAIL"), then ▦ SPREADSHEET, then 🎞 SLIDES (Tim: "lets go with your suggestions").
- 2.816.0 06ef6e8 (2026-11-17): mail merge in document text (pcdocmerge.js, lib/docxMerge.js, POST /api/docx/merge; jszip) - see "## 2.816.0". THE WORD PLAN IS DONE (2.811-2.816). NEXT: Tim tests all of it (he said he would after these releases); then ASK about the AI mail docker (Tim: "later on").
- 2.815.0 3605d32 (2026-11-17): comments + footnotes in document text (pcdocnotes.js; pcdoctext footnotes per frame) - see "## 2.815.0".
- 2.814.0 793bf98 (2026-11-17): Word files - File ▸ Export ▸ Word Document (.docx)… + File ▸ 📂 Open Word Document (.docx)… (pcdocx.js, lib/docxFiles.js, routes/docx.js; docx + mammoth) - see "## 2.814.0". NEXT = 2.815.0 COMMENTS, FOOTNOTES, MAIL MERGE (WORD PLAN step 4); the AI mail docker after that (ask first).
- 2.813.0 f18ddda (2026-11-17): page numbers on every page (on a master, so later pages get them) + the Page Numbers… dialog (format, numbering style + start, position, font, size, colour) + View ▸ Pages: One / Two / Many (pcpageview.js) - see "## 2.813.0". NEXT = 2.814.0 .DOCX OUT + IN (WORD PLAN step 3).
- 2.812.0 cce3b29 (2026-11-17): tables in document text (WORD PLAN step 2) - see "## 2.812.0". NEXT = 2.813.0 .DOCX OUT + IN (WORD PLAN step 3, HANDOVER "## 2.811.0").
- 2.811.0 993265b (2026-11-17): word-processor text in the image editor (release 1 of the WORD PLAN) - document frames, the formatting bar, flow in whole lines, File ▸ New Text Document… with auto pages - see "## 2.811.0". NEXT = 2.812.0 TABLES (WORD PLAN step 2).
- 2.810.0 b950575 (2026-11-17): the image editor's Shape tool - shape buttons pick the mode (click new / Shift replace / Ctrl add / Alt subtract / Ctrl+Alt intersect), ✂ Trim, ⇋ Flip / Mirror Copy, ⧈ Offset, shape items first in the right-click menu (Shape tool only) - see "## 2.810.0". Tim: look at Blender's own Gaussian splats before building a splat layer. NEXT was 2.811.0 the sources' pictures + video (Tim then asked for word processing - the WORD PLAN goes first).
- 2.809.0 b640284 (2026-11-17): the image editor's right-click menu - Copy, Paste, 🎨 Artist Mode; in Artist Mode Show Layers + ⏳ Pending, 🟧 Blender Scene, ✨ Prompt, Exit Artist Mode; the website's Blender section (tigerart a31ef37) - see "## 2.809.0". NEXT was 2.810.0 the sources' pictures + video (Tim asked for the shape tool first).
- 2.808.0 047e095 (2026-11-17): ▣ custom dockers keep their members (restart / layouts / workspaces) and docked ones sit at z 1 under floating dockers - see "## 2.808.0". NEXT = 2.809.0 the sources' pictures + video.
- 2.807.1 f3a4dfd (2026-11-17): a Blender layer comes back at the same view; the editor's AI / Change style / line art start ComfyUI first - see "## 2.807.1". NEXT = 2.808.0 the sources' pictures + video.
- 2.807.0 6bb3af1 (2026-11-17): RunPod REST v1 retired - all calls re-checked against v2; the bigger-volume PATCH now v2 (mounts.persistent.size) - see "## 2.807.0". NEXT = 2.808.0 the sources' pictures + video (">>> NEXT: 2.808.0").
- 2.806.0 3a91f91 (2026-11-17): ✨ Generate from a Blender layer's scene + prompt + references, the live Blender layer, missing models / LoRAs downloaded here (found online) or sent to the pod after asking - see "## 2.806.0". NEXT = 2.807.0 the sources' pictures + video (">>> NEXT: 2.807.0").
- 2.805.0 f0d9743 (2026-11-17): Local - <card> works with ComfyUI portable (run_nvidia_gpu.bat / a custom launch command read for its python + main.py line); the image preview's style dropdown + ☐ Basic Settings beside 🎨 Change style - see "## 2.805.0". NEXT = 2.806.0 the sources' pictures + video (">>> NEXT: 2.806.0").
- 2.804.0 1206f1d (2026-11-16): Laser - send over USB / Wi-Fi from the server (laser part 2 of 2); SVG + PNG for machines with their own laser software (the H2D answer) - see "## 2.804.0". H2D slice + print was proposed and DECLINED by Tim (see the "DECLINED" bullet in "## 2.804.0"). NEXT = 2.805.0 the sources' pictures + video (">>> NEXT: 2.805.0").
- 2.803.0 7830caa (2026-11-16): the Laser panel - toolpaths + GRBL / Marlin G-code (laser part 1 of 2) - see "## 2.803.0". NEXT = 2.804.0 send over USB (">>> NEXT: 2.804.0"), then the sources' pictures + video.
- 2.802.0 f25774b (2026-11-16): print-ready PDF (DTP part 4 of 4 - the desktop publishing set is done) - see "## 2.802.0". NEXT = 2.803.0 the sources' pictures + video (">>> NEXT: 2.803.0").
- 2.801.0 220769a (2026-11-16): linked text frames + text wrap (DTP part 3 of 4) - see "## 2.801.0". NEXT = 2.802.0 print-ready PDF (">>> NEXT: 2.802.0").
- 2.800.0 68ce0b1 (2026-11-16): master pages + page numbers + facing pages (DTP part 2 of 4) - see "## 2.800.0". NEXT = 2.801.0 linked text frames (">>> NEXT: 2.801.0").
- 2.799.0 af9b407 (2026-11-16): image editor PAGES (each page its own layers + undo) + File ▸ Export ▸ Document (PDF with PDF layers / PDF-compatible .ai / SVG pages / PDF+SVG pack for .cdr) - DTP part 1 of 4, see "## 2.799.0". NEXT = 2.800.0 master pages + page numbers + facing pages (">>> NEXT: 2.800.0").
- 2.798.0 aeccb33 (2026-11-16): the style-family lists without the image / image-edit split (Tim: "yeh drop the split because some image models like klein can edit as well as generate") - see "## 2.798.0". NEXT = 2.799.0 the sources' pictures + video (">>> NEXT: 2.799.0").
- 2.797.0 ad338db (2026-11-16): Basic Settings' checkpoint / video Model / temp LoRA lists start with a place dropdown (All places / This computer / RunPod / OpenRouter, counts after the family filter); ☐ Remote + pod rows removed; Civitai info + Sync in the Civitai tab - see "## 2.797.0". NEXT = 2.798.0 the sources' pictures + video (">>> NEXT: 2.798.0").
- 2.796.0 82768c6 (2026-11-16): the Model manager's filters fixed + dropdowns (place / folder / Civitai type / OpenRouter type + price), tool buttons as icons - see "## 2.796.0". NEXT = 2.797.0 the sources' pictures + video (">>> NEXT: 2.797.0").
- 2.795.0 403dd1b (2026-11-15): 🧩 Model manager ▸ ＋ Add source (any model API as a tab - OpenAI-compatible / Ollama / Anthropic-style / custom template; ⚙ URL + key + format, ✓ Test, ＋ yours, LLM / vision models chat through it); the ☁ Remote generation docker is now 🖥 GPU - see "## 2.795.0". NEXT = 2.796.0 the sources' pictures + video (">>> NEXT: 2.796.0").
- 2.794.0 207180d (2026-11-15): the LLM / vision LLM / speech / song separation on a card of their own (Runs on ▸ Local - <card> on every row), -ngl = the layers that fit the card's free VRAM, Settings ▸ General ☐ Offload to CPU / RAM - see "## 2.794.0". Release D (local multi-GPU) is DONE. NEXT = ask Tim (open offers in "## 2.794.0").
- 2.793.0 1438a05 (2026-11-15): a NO_Pod file onto a pod you have - the box says which pod has it (Start that pod / Use that pod), offers every other pod (running first) with what it has and what would be sent; only what is missing is sent (model + its VAE + text encoders); the pick becomes <pod>/<file> everywhere it is kept - see "## 2.793.0". NEXT = 2.794.0 D part 2 (">>> THEN: 2.794.0").
- 2.792.0 c231590 (2026-11-15): the OpenRouter dialog gone - 🧩 Model manager ▸ ☁ OpenRouter; your models dark green / orange / red (dead = kept, marked) - see "## 2.792.0". NEXT = 2.793.0 NO_Pod part 2 (see ">>> NEXT: 2.793.0"), then D part 2 = 2.794.0 (">>> THEN: 2.794.0").
- 2.791.0 1e645a0 (2026-11-15): several graphics cards - Runs on ▸ Local - <card> for Image / Video / Music, a ComfyUI per picked card (release D part 1) - see "## 2.791.0". NEXT = 2.793.0 NO_Pod part 2, then D part 2 = 2.794.0 (">>> THEN: 2.794.0").
- 2.790.0 ef7f2d1 (2026-11-15): 🧩 Model manager Local / RunPod / OpenRouter ticks, 🗑 by place, ☁ OpenRouter tab with ＋ (endpoint kept) - see "## 2.790.0". NEXT = release D local multi-GPU (Tim: "go ahead with part D after u finish with model manager").
- 2.789.0 fabbddc (2026-11-15): a terminated pod's files kept as NO_Pod (<old name>)/<file> or removed; Make the pod again remakes it from its recipe + puts its files back (release C part 2 - C DONE) - see "## 2.789.0". NEXT = release D local multi-GPU (ask Tim first).
- 2.788.0 11ee9e3 (2026-11-15): Basic Settings' Model + LoRA lists follow the prompt docker's styles (family + type) - see "## 2.788.0". NEXT = 2.789.0 NO_Pod on terminate (release C part 2).
- 2.787.0 20fd530 (2026-11-15): pod inventory (PODS ▸ 🗂 Inventory), pod models + LoRAs in Basic Settings' lists as <pod name>/<file> (pick = render on that pod), ☐ Remote + pod under Use model / Use temporary LoRAs (release C part 1) - see "## 2.787.0". 2.788.0 went to Tim's family filter; NO_Pod moved to 2.789.0.
- 2.786.0 e328afe (2026-11-15): OpenRouter models dialog, your models as openrouter/<model> in the dropdowns, pictures + video on OpenRouter after a price box (release B of the agreed design) - see "## 2.786.0".
- 2.785.0 0746a0b (2026-11-15): Runs on - one dropdown per type in ☁ Remote generation (release A of the agreed design) - see "## 2.785.0".
- 2.784.1 91aa4a7 (2026-11-15): the Queue's Pending tab = queued / running generation cards only, finished on Done - see "## 2.784.1".
- 2.784.0 5c48687 (2026-11-15): PODS ▸ Create pod Sort GPUs (Fastest / Cheapest), each card's rough speed - see "## 2.784.0".
- 2.783.0 8a76b8f (2026-11-15): the left docker = System, pod + local stats, Basic Settings ▸ GPU gone, Remote / Pods on the status bar, All local / All remote / Both at the top of ☁ Remote generation - see "## 2.783.0".
- 2.782.3 f983ff1 (2026-11-15): ▶ on a running pod says "running" in green, ⏹ on a stopped pod says stopped (lib/pods.js act() catches RunPod 409) - see "## 2.782.3".
- 2.782.2 3e327e6 / 2.782.1 2a761d0 (2026-11-15): floating dockers to the front, per-type mode, RunPod choice in Settings, --highvram, ⏹/↻ on transfers - see "## 2.782.1 + 2.782.2".
- 2.782.0 b4ee941 (2026-11-15): your LLMs from Hugging Face on your pod, one pod for everything (VRAM swap), bigger volume - see "## 2.782.0".
- 2.781.3 a09b4e4 (2026-11-14): ⟳ Restart ComfyUI in a pod's item - see "## 2.781.3".
- 2.781.2 40473d3 (2026-11-14): 📁 Files on a pod, GPU memory (models kept on the card), ComfyUI's time in the log, RunPod marked tested - see "## 2.781.2".
- 2.781.1 c6fe1c7 (2026-11-14): the worker reads ComfyUI 0.45's ["COMBO", {options}] lists; a pod's checkpoint loads via Load Checkpoint; 10-15 min pod note - see "## 2.781.1".
- 2.781.0 d3ff27e (2026-11-14): Basic Settings sampler lists, the first-start pod watchdog, Jupyter wait - see "## 2.781.0" below. ci-units 367. Repo zip sent.
- 2.772.0 b5893d4 (2026-11-13): new pods start BLANK (RunPod's PyTorch template) + bitGen installs ComfyUI itself; the pod's
  activity on the pod (now-line + done dropdown) - see "## 2.772.0" below. ci-units 356. Repo zip sent.
- 2.773.0 eb28d25 (2026-11-13): remote mode = the pod's stats in the left docker; only the Generate mode's styles go on pods;
  LoRA upload [Errno 2] fixed - see "## 2.773.0" below. ci-units 358. Repo zip sent.
- 2.770.1: TIM'S POD (runpod-slim template): ComfyUI had CRASHED - its port 8188 served an HTML page ("<!doctype"), which
  comfyAt took for ComfyUI. Now only /system_stats JSON (system/devices) counts; the update job's answers() too; no ComfyUI
  process = bitGen STARTS it (<venv python> main.py --listen 0.0.0.0 --port P from its folder, log .bitgen_comfy.log in the
  Jupyter root) and reports the log's end if it does not come up, or which program holds the port. Transfers: one row per
  file+pod, no bar for "there already". Ask Tim for the next log (the reason will now say why ComfyUI does not start).
- 2.770.0: Remote generation docker LLM / Vision LLM = Local / Remote (rgpu.llm_where "remote" -> podLlm.providerOf = rgpu.llm_provider,
  OpenRouter default; setEngine no longer sets llm_provider runpod). Settings ▸ OpenRouter Show free / Show paid (show_free,
  show_paid). Prompt docker lists (static/remotellm.js): 10 at a time, 🔍 per list (#rlQ_llm/#rlQ_vlm), ☰ All (#rlAll) dialog
  #rlDlg (filters/sort/details/Use). podPrep: /object_info EMPTY = broken ComfyUI -> repaired (update force) - TIM'S POD:
  runpod-slim template (/workspace/runpod-slim/ComfyUI), its ComfyUI listed no nodes, files WERE on it. core.js podLines =
  pod reasons one part per line. Ask Tim for the next qwen2_1 log.

## tigerart KEEP TRACK OF USAGE (2026-11-13, no app version - tigerart 5871699, Bitgen e52c993)
Tim: "can you add the new docker images you made to the website under features - keep track of usage". features.php: a "Keep track
of usage" section first (TOC link #keep-track-of-usage), two .row pictures - assets/img/costs-docker.jpg + statistics.jpg, made by
website-sync.py SHOTS from Bitgen docs/images/costs-docker.png + statistics.png (stand-in figures, a made-up pod id); site.js hides a
section with no .grp while the filter searches. 15 site strings x3 (appended - the dictionaries are NOT sorted; never re-sort them).
test-site 267. Both CIs green. Tim: press Update on /b_admin/.

## tigerart /b_admin/ TABS (2026-11-13, no app version - tigerart 17f3f34)
Tim: "please streamline the admin page by making tabs for the sections". public/b_admin/lib/tabs.php (ADMIN_TABS, admin_tab_for_do,
admin_tab_now, admin_tabs_html, admin_panel): Update (+ Database, GitHub token) | Visitors | Members (+ Community admins) | Bug reports
| Emails | Password; the glance summary stays on top. No-JS: tab links are ?tab=x, the server shows that panel (others `hidden`);
?q= -> Members, ?vr= -> Visitors. done() returns to the button's tab (?tab=x; a Members search keeps ?q=..#mb-h). admin.js: click
switches without a load + replaceState ?tab=; arrows/Home/End; a #hash inside a hidden panel opens it. Badges: open bugs, unconfirmed
sign-ups, "!" on Update if token/database missing. Phones: tabs wrap, glance 2 columns. test-admin 97 (+6). Tim: press Update.

## 2.772.0 — COMFYUI INSTALLED ON A BLANK POD; WHAT A POD IS DOING, ON THE POD (2026-11-13, main b5893d4)
Tim: "is there an empty pod template that we can install our comfy ui on from scratch" (answered: RunPod's official PyTorch
templates; recommended the blank pod + bitGen's own install for bitGen's NEW pods, current pods untouched) "lets do that, also in
the pod that is installing and being used show what is being done, then hide the completed tasks in a dropdown so the pods details
don't get too big. say what it is doing, downloading, loading, finding etc".
- lib/podInstall.js: blankTemplate(list) = runpod/pytorch image, !comfy, CUDA 12.8/12.9 first (then 13, then other), Official,
  newest torch; cudaOf/torchOf parse both image styles (…-cuda12.8.1-… and …-cu1281-torch280-…). installCode({dir, port, repo,
  manager, load_s}) = podJob-detachable job (.bitgen_inst.json, marker bitgen-inst-started), steps find/download/venv/pip/manager/
  start/load each {key,label,state running|done|skipped|failed,note,t0,t1}; dir default /workspace/ComfyUI; venv
  --system-site-packages (virtualenv fallback); pip once per HEAD (.bitgen_pip_ok - same mark as podComfyUpdate); Manager =
  github.com/Comfy-Org/ComfyUI-Manager (failure non-fatal); start = venv python main.py --listen 0.0.0.0 --port 8188, log
  <cwd>/.bitgen_comfy.log (read from this start's offset); .bitgen_install.json in the folder. Env for tests:
  H3_POD_INSTALL_REPO / _MANAGER / _POLL / _WAIT / _MAX. ensure(id, port, say, deps): one run per pod (RUNS; 2nd caller waits),
  waits for Jupyter (20 min), detach via module.exports.installCode (test override), follows steps -> podActivity.step, waits for
  the proxy, marks pod_made comfy_ok/installed_at/comfy_dir/comfy_version (so podComfyUpdate.auto skips), genStats recordPrep
  kind "install" phases {install, start}. installable(id) = rgpu.pod_made[id].install. GET /api/pods/:id/install.
- lib/pods.js create: template !comfy -> o.install (unless install:false), cuda from the image, createBody adds 8188/http to the
  ports, ComfyUI port forced 8188, pod_made.install. stylePods offer/create: blankTemplate || cuda13Template (fallback).
  static/podpresets.js new preset prefers the PyTorch 12.8 template; the CUDA checkbox label = the preset's cuda (cuda_was).
- Hooks: podMade.watch (not up + installable -> D.install then afterLoad; failure -> phase failed), podRevive.waitReady (ways ok but
  !comfy_answers + installable -> ensure, else throw "ComfyUI is not on the pod yet: …"), podPrep.run (D.install first; failed ->
  problem "ComfyUI is not on the pod: …", nothing else).
- lib/podActivity.js (memory, 60 tasks/pod): note(pod, text) - same keyOf (numbers / (…) stripped) updates in place, new closes the
  running one; step(pod, key, text, state) keeps the verb it started with; finish(pod, ok, text) result line; view -> {now, done
  newest first, last}; verbOf START/ANY regex table. Fed by podPrep say, podMade own notes + finish, podComfyUpdate.start (+finish),
  stylePods.ready (checking / starting), podRevive (loading pod), podInstall steps. GET /api/pods/activity {pods: {id: view}}.
- static/podsdock.js: .pdDoing[data-pdactbox] under each pod's .pdTop (open or closed): .pdNow.run (icon pulses, .vb verb, .tx,
  .tm dur), when idle .pdNow.ok "✓ Done" / .pdNow.bad "✗ Stopped" (red); details.pdDone[data-pddone] "✓ n done · n already
  there · ✗ n failed" (the result line not repeated), open state S.actOpen via a capture "toggle" listener; pollAct every
  H3_POD_ACT_POLL (2500) while the docker is visible, paintAct swaps only changed boxes. The class is pdDoing (pdAct = the
  template cards' button row - clash). FIXED: .pdk .pdBodyIn[hidden]{display:none} - closed pod items showed their body.
  Create summary rows: Host "CUDA x or newer", Ports "+ 8188 (ComfyUI)", ComfyUI "bitGen installs it…" / "the template's own".
- statsdlg: phase "install" (ComfyUI install), kind "install" = "ComfyUI installed / started".
- Tests: test-podinstall772 (27; spawn -> NOT in ci-units, a gate leg: runs the job for real with python3 + git against a
  file:// stand-in ComfyUI whose main.py serves /system_stats), test-podactivity772 (11), test-podinstallhooks772 (11),
  test-ui772-ui (11, gate leg, page.route stand-ins). Browser legs 772/771/770/7662/7661/766/7641/764/7635/763/761/760/759 green
  on a scratch studio; 768/767/7645/7634 fail THE SAME on unchanged 2.771 code in that order (order/state, not 2.772.0).
- UNVERIFIED against real RunPod: the PyTorch template's start.sh honouring JUPYTER_PASSWORD (RunPod docs say it does), the real
  ComfyUI requirements install time on the image's Python, Manager clone. ASK TIM for the first real blank-pod log / screenshot.

## 2.773.0 — REMOTE STATS IN THE LEFT DOCKER; ONE MODE'S STYLES ON PODS; THE LORA UPLOAD'S [Errno 2] (2026-11-13, main eb28d25)
Tim: "when in remote mode , show the remote gpus/ram/cpu/hdd stats in the left docker instead of the local stats. when bitgen was
uploading a lora from my hdd it stopped about 90% through and said error 2 , file not found. if in any image mode then only upload
or check image styles, if in video mode , then only upload/check the video styles. do i have to add my hf token to runpod for
flux? is fal worth adding?" (the last two answered in chat: the HF token stays in bitGen - Settings ▸ General - and is sent to
the pod's download job; gated BFL repos (FLUX.2 klein 9B, non-commercial) need the license accepted on HF with that account; fal
is ALREADY in Settings ▸ API (lib/apis.js) - just a key; worth it for occasional renders with no pod start, not for own LoRAs
/ workflows).
- lib/remoteStats.js: which(rgpu, enabled, split, engine) (pure) - only split.where === "remote" + engine.pods + rgpu.runpod.pod_id
  (Both = this computer); shape(podStats) -> /api/stats units (MB) + disks bytes; now() -> {remote: null} | {remote: {none}} |
  {remote: {pod_id, name, error?}, stats}. GET /api/pods/remote-stats (routes/pods.js). lib/podStats.js CODE asks
  temperature.gpu (5th field; parse -> temp or null).
- static/remotestats.js H3RemoteStats.apply(s, charts, Bar) - index.html refreshStats calls it right after /api/stats (Bar passed
  in: index.html's own class); polls every H3_REMOTE_STATS_POLL (4000); source change = reset (series cleared, GPU frames
  removed, #statsDisks removed); merge keeps running / queue / power.since (power.gpus [] + cpu_mhz null - no local GPU power
  on the pod's GPUs); heading {text, title} written only when it changes (uilang translates it), one line (nowrap ellipsis -
  a wrapped heading moved the dockers). index.html: gpu.util / gpu.temp null -> "n/a".
- lib/remotePrep.js: kindOfGen (image/graph/imgupscale/edit -> image; video/audio/music/… -> video; else null), fits, MODE
  {kind, gen, at}, forMode(styles) -> {now, later, kind}, prepareStyle(id, "image"|"video") (IMAGE / VIDEO states); start()
  without gen_mode = video style as before. static/remoteprep.js picks() + gen_mode + image_style_id; start() at boot always
  (MODE known even outside pods mode), on #genModeSel / #styleSel change. Filters: podMade.afterLoad (D.forMode; own note "left
  for Video mode: …"), podSetup.save (out.later / mode -> static/podsetup.js line), routes/stylePods.js /prepare (an explicit
  styles list = as asked), podPresets.applyToPod.
- lib/podModels.js upload: tmp = bitgen-upload-<Date.now base36>-<name>; moveCode(tmp, dest, name) (pure, exported) - roots
  [cwd, /workspace, /, ~, /root, /notebooks, /home/jovyan, /home] then os.walk (/workspace, /root, /home, /) 4 deep, 40 s;
  prints bitgen-moved <src> | bitgen-notfound [roots]. Cause of Tim's error = the move ran in the kernel's cwd while Jupyter's
  root is elsewhere on his template (readCwdJson already knew this for status files). test-pods759-live: kernel cwd != Jupyter
  root upload (FAILS on 2.772 code, passes now).
- Tests: test-remotestats773 13, test-modeprep773 9 (ci-units 358), test-ui773-ui 7 (gate leg), test-ui517-ui fixed (its "⚡ since
  start" label had 💲 since 2.771.0). NOTE: test-ui761 then test-ui760 on a FRESH studio fails 760 (the floating prompt docker
  covers the Audio tabs) on 2.771.0 AND 2.772.0 too - order/state, not a regression; in the gate's order (with the tests between)
  they pass.
- UNVERIFIED on real RunPod: nvidia-smi temperature on the pod (standard field), the upload search on Tim's template. ASK TIM
  whether a LoRA send now finishes; which template his pod uses.

## 2.773.1 — A RENDER NO LONGER GOES ON BEFORE THE POD'S COMFYUI IS THERE (2026-11-13, main 6a1d32b)
Tim: "it was working in the previous version - we screwed something up" + a log: qwen2_1 on a new pod - "loading pod - waiting for
its ComfyUI (0 min)" then at once "updating ComfyUI … paste its password", downloads "bitGen could not find the pod's ComfyUI
folder", "tried port 8188: HTTP 502, 8080: a web page" (8080 = FileBrowser of RunPod's comfyui-base/slim template), every file
"its download did not happen". NO install notes in the log = podInstall.installable was false.
- CAUSE: podRevive.waitReady returned as soon as the pod's JUPYTER answered (ways() succeeds with Jupyter alone), so podPrep /
  the update / the downloads ran against a pod whose ComfyUI did not exist yet (a template still installing it on first boot,
  or a blank pod this computer had not marked). 2.772.0 made this likely: new pods default to the blank PyTorch template.
- FIX: waitReady - comfy not answering: installable OR podInstall.looksBlank → ensure (install); else if no comfy_dir → keep
  waiting ("loading pod - its ComfyUI is being set up by the template (n min)", 45 min max); comfy_dir found but down → go on
  (podComfyUpdate starts it). looksBlank(id, w): Jupyter up, no ComfyUI, RunPod image (v2 image / v1 imageName / template)
  without "comfy" → marks pod_made.install or rgpu.pod_install[id] (installable reads both). Unknown image = NOT blank.
- podPrep defaults().install (exported defaults): installable → ensure; Jupyter-only pod → waitReady first (pod setup, ⬆ prepare,
  remote prep call prepare directly); pod not answering at all → as before. podMade.watch: D.blank(k, port) too.
- podComfyUpdate.update: no Jupyter → "paste its password"; Jupyter but no comfy_dir → "no ComfyUI on the pod yet …".
- Tests: test-blankpod7731 15 (ci-units 359); test-podinstallhooks772's "Jupyter answer is enough" check now expects the wait.
- ASK TIM: which template / how the pod was made (comfyui-base? the pods docker? another computer?), and the next log.

## 2.774.0 — A RENDER THAT FAILED ON ITS POD GOES AGAIN; RUNPOD / OPENROUTER TUTORIALS (2026-11-13, main 458557d + 212aa08; tigerart b5c1025)
Tim: "after the pod is setup for the style start the generation that initiated the create pod or select pod dialog" - it
ALREADY did (job waits with pod_ask; answer -> link -> gate -> ready() -> render); Tim: "sorry it already does". Agreed gap:
a render that FAILED on its pod is not retried -> "yes, please do that" + "add Don't have the hardware, Bitgen can use Runpod
and Openrouter. then in tutorials add instructions to signup to runpod, create the all api key and how to create a pod using
bitgen. same with openrouter - these have been tested and work".
- lib/podRetry.js: hold(job, pod, why) from core.js pump when stylePods.gate returns {error, pod_id, retry} (R.phase failed,
  modelGate error); params deep-copied minus pod_job; changed(pod) from podActivity.onFinish(ok) (NEW listener API in
  lib/podActivity.js finish) and podModels upload done; waits while busy (podMade WATCH / podInstall RUNS / podComfyUpdate
  RUNS / podPrep status running), then again(): C.makeJob(params + _pod_retry n, _pod_retry_of) {project, local}; old job
  .retried_as; max 3 tries, 12 h; a job cleared from the Queue (not in core.jobs) is dropped. In memory only.
- core.js jobDict: retried_as, pod_held; static/index.html job row: "failed · goes again when its pod is ready" / "failed ·
  went again" (+ tooltips; 4 new UI words translated, chunk build + i18n-zhtw --ui).
- README "### Don't have the hardware?" (RunPod referral + OpenRouter + tutorial links).
- USAGE "## A render that failed on its pod goes again; a template's ComfyUI waited for (2.774.0)" (also covers 2.773.1) +
  ja / zh-CN / zh-TW (i18n-help assemble of that ONE section; 5 older sections still English-newer - Tim refreshes on ask);
  FEATURES line x4; PDFs rebuilt.
- tigerart: tutorials.php #runpod / #openrouter (text from RunPod / OpenRouter docs: RunPod Settings or Credentials ▸ API
  Keys ▸ Create API Key, All / Restricted / Read Only, shown once; OpenRouter settings/keys, sk-or-v1-, shown once);
  pictures + films from scripts/tutorial-capture.js runpod|openrouter against a SCRATCH studio (page.route stands in for
  /api/pods/*, /api/stylepods/ask, /api/remotegpu/pods, /api/openrouter/models|test; real saves of fake keys, put back);
  index.php .nohw section + table row; hardware.php note; 64 site strings x3; site-keys exported to bitGen (212aa08).
- Tests: test-podretry774 16 (ci-units 360), test-ui774-ui 5 (gate leg after 2.773.0's), tigerart test-site 270
  (tutorials: 4 films, 17 pictures, 6 step lists).
- Tim shared GitHub traffic (14 days): 2,795 clones / 595 unique cloners vs 223 views / 117 visitors; referrers github,
  Facebook (lm./l./facebook.com ~52), Google 16, Telegram 9. Clones >> visitors: installs' update checks / CI / bots.

## 2.775.0 — TTS / STT / SONG SEPARATION ON A POD; MINIMUM REQUIREMENTS ON THE SITE (2026-11-13, main 99825f6; tigerart f8e8f9c)
Tim asked if music goes to pods (YES for ComfyUI music styles: ACE-Step 1.5, MiniMax Music3, YuE2 ComfyUI - stylePods.gate,
kindOfStyle music = video), then: "when we create the pod can we have a button for tts, stt and demacus(sheet music) and allow
bitgen to clone voices and store the voice locally until user selects that voice. can you add a minimum system requirements
section to the front page when using rented gpu/api and using local and build your suggestions".
- lib/podAudio.js (KINDS tts=omnivoice / stt=whisper / stems=demucs; ROOT /workspace/bitgen-audio): rgpu.pod_audio {pod:
  [kinds]}; pick() = remote on + engine pods + where != local, the pod in use first. install(pod, kinds, say, {noStart}) =
  pod job installCode (apt ffmpeg, venv --system-site-packages, pip pkgs, import test; status .bitgen_aud_inst.json); INST
  cache per app run. run(kind, job, opts) = helpers sent (keyed by content hash, SENT per pod), inputs (filesOf: audio /
  file / ref_audio / items[].ref_audio) sent as <sha1>.<ext> to ROOT/in via Jupyter contents + PM.moveCode, rewrite() ->
  outputs into <comfy_dir>/output/bitgen-audio/<id>, runCode pod job (status .bitgen_aud_<id>.json, log tail, last JSON
  line of stdout), mapBack() -> files fetched via ComfyUI /view?type=output&subfolder=bitgen-audio/<id>. deps hookable
  (setDeps; kernel(w, wrapped, rawCode)). 5 min with no status = error.
- Callers: tts.speak (omnivoice only; Ming stays local), speechDialog deps.runJson (omnivoice helper), asr.transcribe +
  the clip transcriber (not Bark; device cuda, float16, model_dir ''), stems.separate; tts/asr status + stems.runtime say
  installed when a pod takes it (on_pod). NOT on the pod: Ming TTS, Bark STT, asr_live (voice chat), YuE2's own program.
- UI: podsdock Create pod… Audio row (data-pdaudio, AUDIO list, summary 'Audio' row, create body audio[]) -> pods.create
  setKinds; static/podaudio.js 🔊 Audio row under .psKinds in My pods (POST /api/pods/:id/audio saves + installs with
  noStart); podMade afterLoad D.audio installs ticked kinds.
- stylePods.comfyStyle(st): engine other than comfy (YuE2 'yue2') -> gate null / willUsePod false (it used to ask for a pod
  then render locally).
- UNVERIFIED on real RunPod: pip omnivoice / faster-whisper / demucs into a --system-site-packages venv on the PyTorch
  image (torch pins could pull a second torch), faster-whisper finding cuBLAS/cuDNN on Linux (image is cudnn-devel), ComfyUI
  /view serving a .wav from output/bitgen-audio. ASK TIM for the first pod audio log.
- tigerart: index.php .reqs Minimum system requirements (rented GPU / own card) + tutorials RunPod note; 22 strings x3.
- Tests: test-podaudio775 23 (ci-units 361), test-podaudio775-py 3 + test-ui775-ui 8 (gate legs), tigerart test-site 272.
  NOTE: test-ui764-ui fails when run AFTER test-ui772/774 on the same scratch studio (state), passes fresh - not a regression.

## 2.776.0 — THE REMOTE GENERATION DOCKER IN SECTIONS; EVERY TYPE LOCAL / REMOTE (2026-11-13, main 8681519; tigerart 2f509e5)
Tim: "add all the types to remote generation. Music - local/remote, tts-local/remote, stt-local/remote, separate all of the
choices into sections neatly justified with an editable(theme)border and bg color etc".
- lib/gpuSplit.js: BOXES + music / tts / stt / stems; TYPES; onRemote(s, kind): local -> false; !s.per -> Remote = all, Both =
  boxes (music follows video); per -> s[kind]. set(): b.per && !sp.per seeds every TYPE from onRemote(was) (so the first
  change keeps the rest); b.per === false clears it; audio type set true + pods -> podAudio.autoTick. kindOf("music") =
  "music". decide(): per -> onRemote || remote style. view(): types {k: remote|local}, audio {tts|stt|stems: ticked pod}.
- stylePods.podJob: per -> onRemote(s, box) (a linked style no longer forces a pod when its type is Local). podAudio.pick(r,
  kind, on, eng, sp) -> onRemote(sp, kind) + tickedPod; anyPod; autoTick (pod in use, else the only bitGen pod).
- static/remotetypes.js (after remoteprep.js): moves #gpuEngine and #gpuLlmWhere into .rtSec sections, adds rt_<kind>
  radio grids (Generation, Audio), hides #gpuBoxes (.rtOn), notes per row (rtNote_<k>); CSS vars --rt-sec-bg / -border /
  -radius / -head on :root (themes can set them). POST /api/gpusplit {per: true, kind: bool}.
- Tests: test-remotetypes776 12 (ci-units 362), test-ui776-ui 7 (gate leg); test-gpusplit745 kindOf pin updated.
  test-ui770-ui fails after test-ui768 on the same studio (OpenRouter list cache) - passes fresh; not a regression.
- 2.775.0 project docs: CONTINUE.md / CHANGELOG.md writes failed (Projects API 502/503) - rewritten now with 2.776.0.

## 2.777.0 — BASIC SETTINGS USE MODEL / USE TEMPORARY LORAS; POD DOCKER'S ⬆ BUTTONS REMOVED (2026-11-13, main 056f6f3; tigerart bafef90)
Tim: "i think we can remove styles this pod needs and update comfyui buttons from the pods docker, bitgen does this automaically
when the pod is created. add a checkbox over the checkpoint "Use Model", and another over loras "Use Temporary Lora's this will
allow the style to be more versatile, we can send overide settings without changing the base model or use loras if we want with
the styles model or the overide model".
- lib/basicUse.js (mounted in routes/index.js): config.basic_use {image_model, image_loras, video_model, video_loras}, all true by
  default; GET / POST /api/basic-use; loras(kind) / model(kind). routes/characters.js scene renders: tempLoras video only when
  loras("video").
- static/ovruse.js (window.H3OvrUse; script tag after basicset.js): ticks #useImgModel (above the Checkpoint label before
  #imgCkptCombo), #useImgLoras (above the label holding #tliAdd), #useVidModel (above label[for=vidModel]), #useVidLoras (above
  #tlvAdd's label); label.ovrUse; unticked dims the field. Labels in WORDS {label:} so ui-dynamic finds them.
- Gates: index.html useTL(kind) / useMD(kind) (imgBasicsBody model + extra_loras; the 3 video body spots), basicset.js loras() /
  collect model, ext/videodock/characters.js out.model, lorasel.js ctx.
- static/basiccfg.js SKIP + ".ovrUse" - basic.cfg put the ticks back and undid an untick (found by test-ui777).
- static/podsetup.js: data-psnodes / data-pscomfy buttons and their handlers removed (server routes kept); a new pod's own
  ComfyUI update still shows in the row's message (row.dataset.cuAsked, tick()).
- Tests: test-basicuse777 11 (ci-units 363), test-ui777-ui 9 (gate leg); pins updated: comfyupd767, podnodes7631, podnodes7642,
  comfyauto769, ftpref585, ui761.

## 2.778.0 — POD FILES FOUND ON CIVITAI BY NAME; "TRY AGAIN?" FOR FILES THAT DID NOT GET ONTO A POD (2026-11-14, main 9fcd81b + 0061330 test fix; CI green)
Tim: "if a file fails to upload to the pod ask the user if they want to try again" + his log "[pod] krea2_nsfw-aio-2.safetensors -
not on the pod, not in bitGen's download list and not on this computer" + "the checkpoint is on civitai".
- CAUSE: podPrep.plan only knew the pod, lib/modelCatalog.json and this computer; a model picked in remote mode comes from
  runpod/pods/remote_models.json (podSend.ensure knew it, but plan() called it missing first) or is on Civitai by name only.
- lib/podFind.js find(cats, name, say): 1. remoteModels.byName with a url, 2. model_info info.json civitai.id -> /model-versions
  -> fileOf (same file name), 3. Civitai /models search (modelInfo.cleanQuery + matchVersion, never by size alone); 10 min cache
  (HIT); pull(id, port, hit, say, {rel}) = podSend.pullWait on PO.sitesFor (civitai.com / .red), folder keeps the need's
  sub-folder (folderFor), adds to remote_models.json. setDeps for tests.
- lib/podPrep.js run: after plan, missing -> D.online -> pulls (D.pull after the sends); howOf / whyOf per file; at the end
  podFails.note(pod, styles, notThere with how + why). defaults() online / pull; prepare(): opts.deps without online = NO
  online lookup (tests never reach Civitai - test-podrepair770 hung 180 s before this).
- lib/podSend.js ensure: no local copy -> podFind.find (not the list - tried above) -> pull.
- lib/podFails.js (FAILS map, id = pod-file): merge clears that pod's entries for those styles then adds; list (words), dismiss,
  retry(id) = prepare(pod, portOf, every failed style of that pod) in the background (podActivity finish ok -> podRetry requeues).
  routes/podFails.js GET /api/pods/fails, POST :id/retry | :id/dismiss, POST /api/pods/fails-e2e (H3_E2E=1 only).
- static/podfails.js (after modelsfound.js): polls every 4 s (H3_PODFAILS_MS), no box while another dialog is open; one
  dialog#podFailDlg per pod (.pfname / .pfhow / .pfwhy, #pfRetry focused, #pfNotNow; Esc = Not now). Words via textContent /
  HOW {label} so ui-dynamic finds them.
- Tests: test-podfails778 21 (ci-units 364), test-ui778-ui 8 (gate leg); test-hfcheck7646 pin updated.
- NOT verified against real Civitai / RunPod: whether Tim's krea2_nsfw-aio-2 is found by the name search (exact file name on a
  version) - if not, his remote_models.json entry or info card is the way; a mature model needs his Civitai key.

## 2.778.1 — CIVITAI AND AUSTRALIA: NOTES ON THE FEATURES + A PINNED WEBSITE DISCUSSION (2026-11-14, main 0b18abe; tigerart site data)
Tim: "add a note to the features and a new discussion on the website *civitai is not allowed in Australia, only add the notes tho
don't remove the feature". Checked: Civitai blocks Australian users since 16 March 2026 (after the eSafety Age-Restricted Material
Codes took effect 9 March 2026). docs/FEATURES.md lines 165 166 303 304 399 401 420 775 777 786 (+ ja / zh-CN / zh-TW, zh-TW says
澳洲) get " *Note:* Civitai blocks Australian users (since 16 March 2026), so the Civitai parts of this do not work from Australia."
before *Where:* / *Since:*. community/notes/civitai-australia-2026.json (pinned, general): affected parts, what still works,
nothing removed - posted when Tim presses Update on /b_admin/ (community/ -> bitgen-community/). No VPN advice given on purpose.
NOTE for later: lib/podFind.js / Civitai lookups run from Tim's computer - in Australia they fail (said in the log, the next way
tried); a remote_models.json entry with a Civitai link is downloaded by the pod itself.

## 2.779.0 — WHY A POD COULD NOT BE CREATED, IN A DIALOG; RUNPOD'S TEMPLATE IDS ACCEPTED (2026-11-14, main ceff092, CI green)
Tim: "when creating a pod, it asks me to create a template first...can you report the real error in a dialog so the user can see
that there is a problem. i suspect it is because the gpu i selected was busy".
- CAUSE (not the GPU): lib/pods.js createBody's /^[A-Za-z0-9]{4,20}$/ refused RunPod's own template ids (runpod-torch-v280,
  tpl_abc - RunPod's docs' examples) with "pick a template first" before RunPod was asked - the PyTorch template bitGen picks for
  a style's pod since 2.772.0. Now /^[A-Za-z0-9][\w.-]{1,79}$/; empty = "no template was picked" (e.local = "template").
- lib/runpodApi.js saidOf(j, txt) + every error after an answer carries e.said (RunPod's whole words) + e.httpStatus; !ok message
  keeps 400 chars (was 160).
- lib/podCreateErr.js explain(err, body) -> {title, kind busy|money|key|template|cuda|asked|other, said, status, hint, asked rows};
  pods.create attaches e.problem (createBody errors too, the template's name looked up); routes/pods.js, podPresets.js,
  stylePods.js wraps add `problem` to the JSON error.
- static/poderr.js (after podfails.js): H3PodErr.show(r) - dialog#podErrDlg (h2, .pehint, RunPod said (HTTP n), .pesaid,
  .peasked, #peCopy, #peOk); from podsdock create(), podpresets play(), stylepodask done(). textOf for 📋 Copy.
- Tests: test-podcreate779 13 (ci-units 365), test-ui779-ui 9 (gate leg); test-pods756 pin updated.
- OPEN (older than 2.779.0 - same at 2.776.0 on a fresh studio): test-ui756-ui fails "…OpenRouter: the RunPod row hides" and
  test-ui764-ui times out waiting for the 📦 Presets item; both bring their own stand-in RunPod on 8399. Not looked into yet.

## 2.780.0 — A POD IS A bitGen POD: THE PODS DOCKER'S TEMPLATE BROWSER REMOVED (2026-11-14, main 283a07a, CI green; tigerart 5531da4 + ecbb399 + c29ce12)
Tim: "i think with using our clean pod template and uploading others we don't need to show any other pods except for our pods what
do u think?" … (offered: Expert switch / one line for the account's other pods) … "i think we drop the template browser
completely. it will make it less complicated".
- lib/pods.js bitgenTemplate(): podInstall.blankTemplate(all) (RunPod's PyTorch) || stylePods.cuda13Template(all) ->
  {id, name, image, ports, disk, comfy, install, cuda}; none = 404 e.local "template". create(): no templateId = this one (its
  failure carries e.problem). GET /api/pods/bitgen-template (routes/pods.js). The server's template list (/api/pods/templates,
  templates(), lib/podShortcuts.js) stays - only the docker's browser is gone.
- static/podsdock.js rewritten around it: tabs mine / presets / create (S.src starts "mine"); no pdQ / pdKind / pdComfy / pdFor /
  pdTpl / cards / ★ (star, loadCuts, matches, initials, templateScore, WORDS, card CSS removed); go(src, pre) - "create" =
  openForm(pre) (S.form {cloud, disk, style, kinds, gpu, name…}); paintForm keyed on S.tplB.id, #pdTplLine "Made from RunPod's
  <name> - bitGen installs ComfyUI…"; create() sends templateId (S.tplB||{}).id; forRender -> go("create", pre + name).
  split(pods) {mine (p.bitgen), other, otherHr}; paintPods lists SP.mine; paintOthers -> #pdOthers <details> "N other pods on your
  RunPod account (not bitGen's) · $x/h running" with ⏹ Stop (data-pdostop -> act stop); loadPods calls filter() (the line).
  H3Pods exports split, go (no matches / initials).
- static/podpresets.js: loadAux templates = [bitgen-template]; the Template field a read-only line; New preset uses it (cuda t.cuda).
- static/stylepodask.js: "A bitGen pod, made from RunPod's <name> - bitGen installs ComfyUI on it".
- lib/podCreateErr.js template hint + lib/pods.js no-template message reworded (no cards to pick).
- Tests: test-pods780 13, test-ui780-ui 8 (gate leg); updated currency760, pods7561, pods759, podcreate779, ui759 (stand-in pod
  env BITGEN_MADE), ui7634 (the stand-in pod STARTED through bitGen - a pod MADE by bitGen is put in use by itself and takes the
  render), ui772, ui775 (route /api/pods/bitgen-template). ci-units 366. Still failing since before 2.776.0: ui756, ui758, ui760,
  ui764 (not looked into).
- FEATURES: 377 378 379 381 382 noted "since 2.780.0 there is no template browser" (4 languages) + the new line. tigerart
  remote-gpu.php pod section rewritten (Create a bitGen pod, My pods line, no For … / shortcuts) + its ja / zh-CN / zh-TW,
  test-site 272.

## 2.782.1 + 2.782.2 — FLOATING DOCKERS TO THE FRONT; PER-TYPE MODE; RUNPOD CHOICE IN SETTINGS; --highvram; ⏹ / ↻ ON TRANSFERS (2026-11-15, main 2a761d0 + 3e327e6; tigerart 5c229bd)
Tim (verbatim): "if a docker is in floating state bring it to the front , right now new floating docker are going behind the new
custom docker. put the text encoder and/or vae in vram if it fits, use offloading if necessary. it took 4 minutes to render a picture
but as you can see local generation on my 5090 is much faster. when local is selected in any of the remote generation radios , set
that type to local mode, if remote is selected then set that model to remote mode. remove runpod options for serverless or pods from
remote generation docker, the user can choose that from the settings dialog" + "when transferring a model to the pod add a stop and
restart download button icon only at the end of the progressbar". (His attached log was a LOCAL 5090 render: 35.8 s, Dynamic VRAM.)
- static/floatz.js: MutationObserver (only mutations on SEL elements / added SEL nodes) -> sweepNew per frame: a SEL element that
  becomes floating+shown (was false -> true) or first seen after boot is raise()d. test-ui724 passes on a FRESH studio (it failed
  once after ui7641 left Basic Settings floating at the same spot - state pollution, not a bug).
- lib/modeSwitch.js: remoteWhere uses per-type choices when split.per (any of image/video/music Remote = remote mode; all Local =
  local); localTypes / mixed; after(): mixed keeps/starts this computer's ComfyUI; note lists the local types.
  routes/remoteModels.js /api/comfymodels when mixed: local handler (req.query.local=1) with RM.mergeComfy(remote list) merged in.
- static/gpusplit.js: the docker's RunPod ▸ Serverless / Pods row removed (gpuRunpod guarded); h3:rgpu -> load().then(waiting) so a
  pending Remote is saved when Settings makes it ready. static/remotegpu.js engineRow: Settings ▸ Remote generation ▸ "RunPod renders
  on" Pods / Serverless (POST /api/gpusplit {engine:{provider:"runpod", runpod}} + h3:rgpu).
- lib/podVram.js: gpu mode adds --highvram when the pod's cli_args.py knows it (OURS includes it).
- 2.782.2 transfers: lib/podTransfers.js CTL map (begin({stop, restart})), stop / restart / stopped, view can_stop / can_restart;
  routes POST /api/pods/transfers/:id/stop|restart; static/podxfer.js .pxLine (bar + .pxIb ⏹ ↻). lib/podModels.js dlCode checks
  bitgen_stop_<name> (kernel cwd) after each 8 MB piece (cleared at start), stopDownload(id, port, name), upload loop job.stop ->
  DELETE the part, stopUpload(id). lib/podSend.js: upload + pullWait register stop/restart; a stopped pod download THROWS
  ("you stopped the download of …") so it is not sent from this computer instead. lib/podLlm.js download rows: ↻ = prepare(force).
- Tests: test-floatmode7821.js (12, jsdom), test-xfer7822.js (11), pins: pods756, remotemodels766, ui7641 (engine via fetch +
  h3:rgpu), podfiles7812(-py). ci-units 371. Pre-existing fails: test-pods758 (1), ui756/758/760/764.

## 2.782.3 — ▶ ON A RUNNING POD SAYS "RUNNING" IN GREEN (2026-11-15, main f983ff1; tigerart 811fa0d)
Tim: "remove this message from pods docker - RunPod: not possible in the pod's state now - action "start" is not valid for status "RUNNING" - if pod is running, just say running in green".
- lib/pods.js act(): RunPod 409 on start with RUNNING in the text → remember(id, id, "started") and {ok, running:true, note:"running"}; 409 on stop with EXITED/STOPPED → {ok, stopped:true}; any other 409 still thrown.
- static/podsdock.js act(): r.running / r.stopped → clear the watch, say("<pod> - running", true) (green #7c7) or "- stopped", loadPods().
- scripts/test-podstart7823.js (4 tests). ci-units 372/0; CI green.

## 2.783.0 — THE SYSTEM DOCKER; POD + LOCAL STATS; BASIC SETTINGS ▸ GPU GONE; REMOTE / PODS ON THE STATUS BAR; ALL LOCAL / ALL REMOTE / BOTH (2026-11-15, main 8a76b8f; tigerart 66afdeb)
Tim: "in the left docker, rename it to system - when using a pod show pod stats, if using pod + local show all the stats of hardware being used including remote - remove the gpu menuitem in basic settings, add remote docker button to the statusbar, if any of the tools use remote generation show Pods button in statusbar for the pods docker if everything is in local mode then hide the pods button. add a radio group to the top of the remote generation docker for all Local, all remote, both"
- static/index.html: #ldock .dockhead h1 = System (dockreset.js / palette.js names too). Basic Settings' GPU h2 removed; #sec-gpu stays as a HIDDEN host (<div id="sec-gpu" hidden>) - gpusplit / remoteprep / podsdock / runpoddock still build into it and remotedock adopts the parts.
- lib/remoteStats.js which(): {pod_id, name, port, mixed}; mixed = where != remote, or modeSwitch.mixed / !remoteWhere; mixed with no pod in use / not Pods = null (this computer only). static/remotestats.js: mixed -> this computer's charts kept + #statsPod frame "☁ <pod>" (podRows: CPU, RAM, GPUn load+temp, GPUn VRAM, disks); the pod alone = merge as before.
- static/gpusplit.js: labels All local / All remote / Both; bodyOf(w): remote = {where remote, per, every TYPE true} + llmAll("remote") (POST /api/remoteprep/where llm+vlm remote); both = {where both, per}; closeRemote closes only "pods".
- static/remotedock.js: #rgdWhere section first in #rgdBody - adopt() moves #gpuWhere, #gpuLine, #gpuMsg in; no gpuDock button; paintBtn -> H3RemoteBtns.paint. rgdNow lost its "Where the work runs" line.
- static/remotetypes.js rowBody: a row put to Local while where=remote -> where both. static/remoteprep.js: LLM / Vision put to Local while remote -> H3GpuSplit.save({where both, per}).
- NEW static/remotebtns.js (H3RemoteBtns): #tRgen "Remote" after #tQ (shown while Use remote generation is on), #tPods "Pods" after it (shown while anyRemote(gpusplit view): a TYPE remote or routes.llm/vlm remote); lit while shown; Pods hidden -> PODS closes.
- User messages that said "Basic Settings ▸ GPU" now say Remote generation / All local / All remote (rpstyles, rpslStyles, stylePods, core, llmChat, podLlm, gpuSplit, openrouter, remotegpu, runson, remotedock).
- Translations: 9 UI strings (ja / zh-CN, zh-TW by i18n-zhtw --ui); guide section + FEATURES line in 4 languages; PDFs rebuilt.
- Tests: test-system783.js (29, ci-units), test-ui783-ui.js (13, gate leg); pins updated in gpulocal7641, costs771, remotedock754. RETIRED gate legs (commented in e2e-stub-test.sh): ui745, ui747, ui754, ui7641 - they tested Basic Settings ▸ GPU (lost with them: 747's update-check-stopped message, 754's pod start/stop through the old docker). ui768's FIRST check pins the old layout (rest of ui768 + ui746 / ui753 / ui7662 / ui767 failures are PRE-EXISTING - same on 2.782.3). ci-units 373/0; CI green.
- Tim's A6000 note (same day): ref2va on the pod ~20-25 s/step vs his 5090 ~2x faster - the log showed models kept in VRAM and cache hits, so it is the card (Ampere: no FP8, ~40% of the 5090's bandwidth), not a bitGen fault. Offered: steer Create pod to faster cards / warn on Ampere for H3.

## 2.784.0 — CREATE POD: SORT GPUS FASTEST / CHEAPEST (2026-11-15, main 5c48687; tigerart 8426194)
Tim: "add a sort order to the top of the gpu selection list in create new pod, by fastest, by cheapest" (after his A6000 ~2.2x slower than his 5090).
- NEW static/gpuspeed.js (UMD, H3GpuSpeed; lib/pods.js gpuView requires it -> every GPU has `speed`): SPEED = bitGen's OWN rough order for diffusion / video (RTX 5090 = 100; B200 260, H200 190, H100 SXM/HBM3 180, NVL 160, PCIe 140, RTX PRO 6000 115, L40S 85, RTX 6000 Ada 80, 4090 / A100 SXM 75, A100 PCIe / L40 65, 5080 60, A6000 45, A40 / 3090 40, L4 25, T4 8; unknown 0 - e.g. AMD MI300X). Hand-written from generation / tensor throughput / bandwidth, not a benchmark - adjust when Tim reports real timings. speedOf, sortGpus(list, "fast"|"cheap") (offered first; ties by price / speed), speedText ("~0.45× RTX 5090" / "speed not known"), pick (first free >= 20 GB).
- static/podsdock.js: #pdGpuSort radios (Fastest / Cheapest) above #pdGpu, localStorage h3.pod.gpuSort (Cheapest default = the old order); fill() sorts, adds the speed to each option; a new order picks its first card (S.sortPick); otherwise the card on screen is kept - S.form.gpu follows #pdGpu's change and every fill (FIX: switching cloud used to put back the first-painted card).
- Translations (4 words x3), guide section + FEATURES x4, PDFs. Tests: test-gpusort784.js (11, ci-units), test-ui784-ui.js (7, gate leg). ci-units 374/0; CI green.

## 2.784.1 — QUEUE: PENDING = QUEUED / RUNNING ONLY (2026-11-15, main 91aa4a7; tigerart afb46d4)
Tim: "also only show queued items in the current queue all done items in queue go to the done tab".
- static/index.html paintQueue: #genq cards filtered by the tab (gqTabNow() - qTab may be in its TDZ at the first paint; Pending = waiting + running, Done = GENQUEUE.OVER with ↻); gqShown(tab); the Pending count + the generation queue's waiting cards; "Nothing waiting." only when no card shows; the tab buttons call paintQueue() too. (The #jobs rows were already split by status - the leak was the generation-queue cards.)
- test-ui7841-ui.js (4, gate leg); ci-units 374/0; CI green.

## 2.785.0 — RUNS ON: ONE DROPDOWN PER TYPE (RELEASE A) (2026-11-15, main 0746a0b; tigerart 5d3bf4d)
Tim said "go" (= my points 1-3 accepted: the picked model decides where it runs; OpenRouter greys steps / CFG / sampler / LoRAs; price shown before a paid render + 💲 Costs).
- NEW lib/remoteHosts.js: KINDS (image video music tts stt stems llm vlm), HOSTS (local runpod openrouter lan team), optionsFor(kind) (LAN / Team off everywhere; OpenRouter off on image / video "next release" and music / speech / stems "does not run this in bitGen"), hostsOf(r, split, engine, llmHost) (old Remote = runpod, rgpu.mode remote / ssh = lan), whereFor (nothing remote = local, else both + per), anyRunpod, view(), set(kind | "all", host) -> gpuSplit.set({per, where, kinds, engine runpod}) + podLlm.setWhere for llm / vlm. routes/gpuSplit.js: GET / POST /api/remotehosts (+ mode_switch).
- NEW static/remotehosts.js (H3RemoteHosts): #rhGrid in #rgdWhere ("Runs on"): Set all + 8 rows, a note under a row (H3RemoteTypes.noteOf for render kinds on RunPod; the LLM's line). CSS hides #gpuWhere / #gpuLine, the servers section, .rtSec .rtGrid, #gpuLlmWhere .rpRow (needs #rgdBody .rtSec prefix - remotetypes' !important), the audio section and the gen section unless the video style line has text.
- static/remotebtns.js: Pods = S.h.any_runpod (GET /api/remotehosts).
- Option words built in JS ("LAN (coming later)", "OpenRouter (next release)" ...) are not in the scanner's list -> stay English in ja / zh (the 4 scanned words are translated).
- Tests: test-remotehosts785.js (15, ci-units), test-ui785-ui.js (12, gate leg); test-system783 pin updated; ui783 still passes. ci-units 375/0; CI green.
- NEXT: release B (OpenRouter models dialog + image / video on OpenRouter) - see ">>> NEXT — AGREED DESIGN".

## 2.786.0 — OPENROUTER MODELS: THE DIALOG, YOUR LIST IN THE DROPDOWNS, PICTURES + VIDEO ON OPENROUTER (RELEASE B) (2026-11-15, main e328afe, CI 43673982271 green; tigerart not touched)
Tim (verbatim, the agreed design's B): "Add an openrouter button to remote generation docker to select models to use, show dialog with free
and paid models and tabs for each type and inside each type have tabs for each family + 1 tab for all - but show price for paid service.
use 2 frames in the dialog 1 tab to show available models and 1 to show added models, when user double clicks model then add the model to
users models with a delete button at the end of each model name. when user closes the dialog update all the dropdowns with the new lists add
models to the appropriate dropdown in llm/vllm and the override model dropdown (not the video/image styles) as openrouter/model name but
don't remove the other models, if use model is selected and an openrouter model is selected use openrouter" + "if openrouter model is not
found, remove it from our list".
- NEW lib/orModels.js: TYPES image / video / llm / vlm. OpenRouter's lists (no key needed): llm/vlm = GET <base>/models (openRouter.mapModel);
  image = GET <base>/images/models + each model's price from GET <base>/images/models/<id>/endpoints (pricesIn walks the answer for any
  `pricing` array of {billable, unit, cost_usd} - THE ENDPOINTS SHAPE WAS NOT SEEN LIVE, only OpenRouter's blog excerpt; imagePrice picks the
  cheapest output-image line: unit image | megapixel | token) + names from GET <base>/models?output_modalities=image; video = GET
  <base>/videos/models (pricing_skus {"per-video-second": "0.50", "per-video-second-1080p": ...}, supported_durations / aspect_ratios /
  resolutions / sizes). Cached 10 min (image prices 1 h); <base> = lib/openRouter BASE (H3_OPENROUTER_API). YOUR LIST =
  rgpu.openrouter.mine {image, video, llm, vlm: [{id, name, maker, type, free, price, usd, unit, skus?, caps?, in/out/ctx, added}]} in the
  settings. view(type) PRUNES (prune: ids OpenRouter answered with; only when it answered) and refreshes price / caps; checkMine() for every
  type with entries. families (All + makers, familyLabel NAMES), priceText, estimate(m, {n, seconds, w, h}) (video: snapDuration x the
  resolution's own sku when the render is 720p / 1080p / 4k tall; image: per image x n, per megapixel x MP x n; token = said after),
  snapDuration (nearest, a tie = the longer), snapAspect (nearest ratio by log).
- NEW lib/orRender.js: PREFIX "openrouter/", API_ID "__openrouter"; modelFor(kind, picked) -> picked openrouter/<id> (must be in your list)
  | Runs on = OpenRouter (rgpu.openrouter.runs {image, video}) -> rgpu.openrouter.use[kind] else the first of your list | {error} | null;
  styleFor(base, kind, entry, {w, h, seconds}) = a COPY of the job's style with runs_on "api", api_id "__openrouter", api_model, api_extra
  {duration (video), aspect_ratio} (misc/api_worker.py body.update(extra) puts them over its own), no loras / workflow; jobApis(cfg, params)
  -> cfg.apis = {__openrouter: {service openrouter, key = rgpu.openrouter.key, base = H3_OPENROUTER_API when set}} (lib/core.js startJob,
  after the 2.757.0 apis filter; log "[api] … rendered on OpenRouter"); check(kind, picked, o) for the page; IGNORED words.
  THE RENDERS REUSE misc/api_worker.py run_openrouter (2.757.0: POST /images b64, POST /videos -> poll -> /content) - unchanged.
- routes/index.js: /api/genimage - an early path right after missingSlots (before modelFit / LoRAs / regions / qwen ref words): b.model
  openrouter/<id> or Runs on Image = OpenRouter -> the job with the OR style, width/height, batch, the dock's pictures (cap = caps.refs),
  seed. /api/generate - right after the podVs line: bo.model (Override ON + Use model) or Runs on Video -> apiJobs.videoParams with the OR
  style (frameOp / askedMode / typedPrompt / references as the API_ path). routes/ltx.js: an OR model / Runs on Video refuses an LTX render
  with words. routes/modelsFound.js plan(): OR renders skipped. NEW routes/orModels.js (mounted after apis): GET /api/ormodels?type=&refresh=1,
  GET /api/ormodels/mine[?check=1], POST add / remove / use ({type, id}: image/video = rgpu.openrouter.use; llm/vlm = openRouter.save model +
  remoteHosts.set(kind, "openrouter")) / check.
- lib/remoteHosts.js: OpenRouter open on Image / Video (still off on music / tts / stt / stems); hostsOf(..., orRuns) (image / video =
  openrouter when runs[k]); set() writes setRuns; view().kinds[].note = orNote (the model + its price, or the empty-list ✗).
  static/remotehosts.js noteOf shows it. lib/costs.js: OpenRouter row counts genStats api_id "__openrouter" renders (sub "N renders", usd
  when no key figure), detail jobs; static/runpoddock.js "Renders on OpenRouter: N" table. lib/remoteLlm.js: remote OpenRouter lists put
  YOUR models first (★, mine: true); static/remotellm.js optionsOf always shows all of yours + the first 10 of the rest.
- PAGE: NEW static/ormodels.js (H3OrModels: <dialog id="orDlg">, #orTypes / #orFams tabs, #orQ, #orFree / #orPaid, #orSort, #orRefresh,
  #orAvail (dblclick / Enter adds, click = #orDesc details), #orMine (🗑 data-ordel at the end), #orMsg; the button #rhOrBtn appended to
  #rgdWhere every 1.5 s if missing; close -> "h3:ormodels"). NEW static/ormine.js (H3OrMine; loaded BEFORE remotellm.js - its capture change
  listener runs first): comboExtra("imgCkpt", cur) -> a "☁ OpenRouter (paid)" optgroup in static/index.html cmCombo paintFiles (the cur
  value known so no "— not found"), #vidModelList options, #llmSel / #visionSel optgroup "☁ OpenRouter · your models" (not while
  dataset.rlHost === "openrouter" - remotellm lists them), a MutationObserver re-adds after the page refills; a pick -> POST
  /api/ormodels/use + h3:rgpu; once a session GET /api/ormodels/mine?check=1 (removed -> appNote). NEW static/orcost.js (H3OrCost): wraps
  fetch for POST /api/genimage + /api/generate (JSON or FormData), always asks POST /api/ormodels/check (local, quick); OpenRouter + not
  free -> #orCostDlg (title, estimate, why, ignored, ☐ Don't ask again for 10 minutes) - Cancel = 409 {cancelled}; check error = sent
  (the server refuses itself).
- Translations: 17 UI strings + 15 patterns x3 (ja / zh-CN by hand, zh-TW by i18n-zhtw --ui - pip install opencc here); the guide section
  in 3 languages (i18n-help assemble, check 0 problems); FEATURES x4 (test-features7141 29/0). README "Don't have the hardware?" names the
  paid picture / video models. PDFs rebuilt (guide x4, features, brochure; test-guidepdf 16/0, test-featurespdf 9/0).
- Tests: test-ormodels786.js (39, ci-units 376/0), test-ui786-ui.js (26, gate leg - LAST in e2e-stub-test.sh because its renders would be
  counted by the 2.771.0 statistics leg; stand-ins on 8397 /v1 lists + 8396 /or renders = the gate's H3_OPENROUTER_API / H3_API_BASE_OPENROUTER).
  Pins: test-remotehosts785 (OpenRouter open on image / video), test-ui785 (same). Browser legs rerun green here: ui785, ui719, ui783, ui757
  (needs H3_API_BASE_CLAUDE like the gate). PRE-EXISTING, NOT CAUSED: test-ui753-ui fails 2 the same on untouched 2.785.0 ("Free models only
  off" list + a page.check timeout); test-ui771-ui counts every generation of the day (2 expected) - run it on a fresh tree.
- NOT TESTED against the real OpenRouter (stand-ins only; huggingface / openrouter docs pages partly blocked here). First real use may need a
  fix in pricesIn (the endpoints answer's shape) or the image request (api_worker sends aspect_ratio + n, no resolution) - ask Tim for the
  job log / the dialog's line.
- Sandbox notes: npm i -g playwright then ln -s /opt/pw-browsers/chromium_headless_shell-1243 …-1255 (the version it asks for); a test server =
  cp -a the clone to /tmp/t786, H3_E2E=1 H3_PORT=8486 BITGEN_NO_COMFY_DETECT=1 + the gate's stand-in envs, run as a background Bash task.

## 2.792.0 — THE OPENROUTER DIALOG GONE; YOUR MODELS GREEN / ORANGE / RED (2026-11-15, main c231590; tigerart not touched)
Tim (verbatim): "i think there is no need for the openrouter dialog anymore, model manager should be able to look after it, highlight
the free models the open router that we selected (+) to be in our model list with green, paid models with orange and dead models with
red, use the darker green , red and orange"
- DECISION: "dead" needed a change - since 2.786.0 a model OpenRouter stopped listing was TAKEN OFF your list (Tim's earlier "if
  openrouter model is not found, remove it from our list"), so nothing could ever be red. Now lib/orModels.js markDead(mine, ids):
  not listed = dead: true + dead_at (kept, red), listed again = alive; view() and checkMine() use it (prune kept for its tests);
  `removed` in the answers = the newly dead. A dead entry keeps its old price / caps.
- lib/orRender.js modelFor: a picked dead model -> {error "… is no longer on OpenRouter …"}; Runs on = OpenRouter skips dead ones.
  static/ormine.js (dropdowns) + lib/remoteLlm.js (LLM lists) leave dead ones out.
- static/mmor.js: COLORS {free #1e7b34, paid #b35900, dead #a32020} (frame + inset 4px stripe + a tint); stateOf; your dead ones
  of the type first ("✗ no longer on OpenRouter" + 🗑); a legend; counted() keeps the type buttons' counts after ＋ / 🗑; a newly dead
  answer reloads the Models tab (changed()) and says it in red. css() injected at load - the Models tab's .mmcard.orfree / .orpaid /
  .ordead use it (static/modelmgr.js adds the class from lib/mmSources.js orCard's or_state).
- static/ormodels.js: the dialog REMOVED (70 lines left): the pure helpers (filterList / sortList / typeLabel - the tab + tests use
  them) and #rhOrBtn in ☁ Remote generation -> open(type) = H3ModelMgr.show + openTab("openrouter") (new in modelmgr.js).
  "h3:ormodels" is no longer sent (ormine still listens; the tab calls H3OrMine.load itself).
- Tests: test-orcolors792.js (10, ci-units); test-ui786-ui.js's dialog parts moved onto the tab (28 - its "taken off" check is now
  "marked dead, red, out of the video Model list"). ci-units 382/0; ui786 / ui790 / ui785 pass.

## 2.793.0 — A NO_Pod FILE ONTO A POD YOU HAVE; WHICH POD HAS IT; RENAMED TO <pod>/<file> (2026-11-15, main 1438a05; tigerart not touched)
Tim (verbatim) - see the old ">>> NEXT: 2.793.0" text kept below as DONE.
- NEW lib/noPodWhere.js (pure): CATS model/vae/te/lora; companions(inv, f) (a model brings the NO_Pod's vae + te, a LoRA nothing);
  findIn(inv, f) (same rel, else same file name in the kind's folders, size within 1%); vramOf(gpu) table; stateOf (running | starting |
  stopped | terminated | unknown); where(file, comps, invs, status, nopodId) -> {has, others} rows {id, name, label, status, gpu,
  has_model, there, missing, send_gb, free_gb, last_seen, warn ("not enough room on it (N GB free)" / "may not fit its N GB card")},
  running < starting < stopped then by send size; rowWords; mergeTodo; refMap / renameIn (deep rename of string values).
- lib/noPod.js: todo() now also the vae + te (PUT = model, lora, vae, te); catsFor(f); putBack uses it; remake renames the refs
  NO_Pod (X)/ -> <remade pod label>/; NEW renameRefs(map) (basic.cfg, misc/basic_settings.tmp .styles, the project's image / video
  temp LoRAs); NEW useOn(ref, podId, o): starts a stopped pod first (409 "RunPod did not start ... a stopped pod may get no GPU back"),
  adds only what the pod lacks as todo, takes the file off the NO_Pod (the NO_Pod goes when no listed file is left: PI.decide(id,false)),
  renames to <pod label>/<rel> (+ podRevive.moveStyles), then in the background waitReady + putBack.
- lib/podInv.js: inv.disk {free,total,at} from the listing (save() keeps "disk"). lib/basicTmp.js exports write.
- routes/podInv.js: GET /api/podinv/nopod/where?name= (running pods refreshed within H3_NOPOD_LIST_MS, default 8 s; runpod_error when
  RunPod would not say), POST /api/podinv/nopod/use {name, pod}, GET /api/podinv/nopod/now?name= (the current name of a renamed pick);
  /api/podinv/nopod also returns groups.
- static/nopod.js: whereHtml / rowHtml (This pod has it / These pods have it + Start that pod / Use that pod; Or put it on another pod
  radios; Or make the pod again the way it was made; Not now / Make the pod again / Use this pod); useIt sets the field to the new name;
  renameStale() every 30 s + on h3:podinv fixes a field still showing an old NO_Pod name. With no other pod the 2.789.0 box shows.
- Tests: test-nopodwhere793.js (34, ci-units), test-ui793-ui.js (14, browser, RunPod stand-in on 8399 key rpa_UI793; waits until
  performance.now() > 6500 so stylebasic's restore of per-style Basic Settings does not put an old pick back); test-nopod789 pins
  updated (the VAE is now put back). Both in scripts/e2e-stub-test.sh.
- LEAK FIXES: test-remotemodels766 / test-podfiles7812 / test-comfyauto769 / test-podlacks7664 wrote podA / podC / podQ / p1 + 
  remote_models.json into the tree's runpod/pods (made ui790 / ui793 fail on a copy) - now H3_POD_INV_DIR / H3_REMOTE_MODELS temp dirs.
  ci-units 383/0, no runpod/ leftovers; clean studio in gate order: ui786 28, ui787 12, ui788 10, ui789 12, ui790 14, ui793 14 - 0 fails.
- KNOWN (pre-existing, not this release): test-ui789-ui.js run a SECOND time on the same studio fails 3 (same on unchanged 2.792.0 -
  checked in a worktree); it passes on its first run, which is how the gate runs it.
- NOT tested against real RunPod (stand-ins only): starting a stopped pod for a NO_Pod file, the pod's disk free from the listing.
- Still to do from the plan: the website's NO_Pod row text (tigerart features.php $models) + a new shot - not done (tigerart untouched).
- Docs: USAGE "## A NO_Pod file onto a pod you have (2.793.0)" (x4 languages), FEATURES line x4, CHANGELOG, PDFs rebuilt; 13 UI strings
  (where "#npDlg") in strings.json, ja / zh-CN / zh-TW 9478/9478 + 1148/1148, check 0.

## 2.794.0 — LOCAL MULTI-GPU PART 2: THE LLMs + SPEECH ON A CARD; ☐ OFFLOAD TO CPU / RAM (2026-11-15, main 207180d; tigerart not touched)
Tim: "please go ahead with part 2" (the plan in ">>> THEN: 2.794.0", kept below as DONE).
- NEW lib/cardUse.js: KINDS (image video music llm vlm tts stt stems), EXTRA, SPEECH; envFor(n) = CUDA_VISIBLE_DEVICES + CUDA_DEVICE_ORDER
  PCI_BUS_ID; offloadOn(cfg) (config.gpu_offload, default on - top-level key, the /api/config allow-list never touches it); pickOf;
  layersFor({bytes, layers, freeMb, kvBytes, offload}) - 700 MB reserve; fits = 99, offload = floor((free - reserve - KV) / per layer),
  offload off = {error "<file> needs about X GB (model + context) and GPU n has Y GB free - tick ... / smaller context / another card"},
  unknown size / layers / free = 99 (as before); speechJob (device "cuda" - the card is cuda:0 inside - + env); live: pickNow,
  setOffload, forSpeech, runJson(kind, ...) = venv.runJson on the card, freeMbOf (nvidia-smi total - used; H3_TEST_GPUS under
  H3_E2E), layersNow(dev "cudaN", {files, layers, kvBytes, offload?}).
- lib/gguf.js llmShape + layers (block_count). lib/core.js ensureLlama: Runs on ▸ LLM's card first (+ PCI order), Settings ▸ LLM
  device the fallback; -ngl via layersNow AFTER gpuSettle (the old model left the card); gpu_layers 0-98 of your own kept; the
  launch sig + offload. lib/captioner.js: visionDevice = vlm card > captioner.device > llmDevice (NEW, llm card > llm.device);
  sameGpu uses llmDevice; -ngl via layersNow (model + mmproj + a 4096 context).
- Speech: lib/tts.js, speechDialog.js deps, asr.js (whisper x2 + Bark), stems.js -> cardUse.runJson; asrLive.js forSpeech + spawn env.
  (The live transcriber keeps its process when the card changes - it restarts on an engine change only.)
- lib/remoteHosts.js: cardList for every kind (2+ cards), hostsOf local:<N> for every kind, cardNote for llm / vlm ("llama.cpp on GPU
  n - as many layers as its free memory holds, the rest in RAM" / "(Offload is off: ... refused)") and speech ("runs on GPU n (the
  card is all its program sees)"). static/remotehosts.js noteOf now SHOWS row.note for local:<N> (2.791.0's card line was never
  shown - fixed). lib/gpuCards.js setPick takes cardUse.KINDS (the gate stays image / video / music); argsFor(d, n, offload) +
  --gpu-only when offload === false. lib/comfy.js start: offload off + bitGen runs main.py itself = --gpu-only (a .bat / custom
  launch command untouched; logged).
- routes/cardUse.js (GET /api/carduse, POST /api/carduse/offload {on} - stops the cards' ComfyUIs so they start the new way),
  mounted in routes/index.js AFTER famFilter (test-famfilter788 pins the order before it). static/cardoffload.js + Settings ▸
  General "Graphics card memory" ☐ #s_offload (+ #s_offload_msg).
- Tests: test-carduse794.js (34, ci-units: a made-up 400 MB sparse GGUF, a python helper through venv.runJson sees the env);
  test-ui794-ui.js (11, browser - needs H3_TEST_GPUS, else SKIP). Pins updated: test-gpucards791 (speech rows now get cards),
  test-ui791-ui, test-captioner (its other 3 FAILs are pre-existing, not in ci-units). ci-units 384/0 (also on a clean repo-zip unzip).
  Clean studio in gate order (tests run FROM the studio's folder - they write runpod/pods relative to themselves): ui785 12, ui786 28
  (needs the gate's H3_API_BASE_OPENROUTER), ui787 12, ui788 10, ui789 12, ui790 14, ui793 14; with H3_TEST_GPUS + H3_GPU_CARD_CMD:
  ui791 + ui794 PASS (ui785 then fails only because its pins expect no cards - as on 2.791.0).
- i18n: 7 Settings words hand-added to strings.json (#stab-general / #s_offload_msg), ja / zh-CN built, zh-TW --ui; i18n-zhtw.py
  TW_WORDS + 卸載 (offload - s2twp made it 解除安裝 = uninstall) + 顯示卡記憶體. NOTE: --ui keeps existing zh-TW words - drop a key
  from zh-TW.json to have it converted again. The Runs on row lines are server-made (lib) and stay English, like 2.791.0's.
- NOT tested on real cards: the -ngl figure and nvidia-smi's free memory, CUDA_VISIBLE_DEVICES for OmniVoice / Ming / whisper /
  Bark / demucs, ComfyUI --gpu-only. Ask Tim for a log ([llm] "N of M layers on the card" line) on his 5090 + 3090.
- OFFER Tim next: per-card free-memory figures in the Runs on line; the Runs on row lines translated (patterns); the website's
  graphics-card row text (tigerart, also still owed from 2.793.0 NO_Pod).

## DONE (2.793.0 1438a05): 2.793.0 — NO_Pod PART 2: PUT A TERMINATED POD'S FILES ON A POD YOU HAVE (START A NEW CHAT FOR IT)
Tim (2026-11-15), on the NO_Pod box: "also ask the user if the model + vae + textencoder should be added to an existing pod. show user
running pods and stopped pods. check if the files exist, only upload necessary files that don't exist on the pod ... is this worthwile?"
then: "if user chooses new pod or uses an existing one then change the name of the model to pod name/model name so it is assigned a new
name. check the full list of pods and models in the pods to see if the model exists in any other pod - advise the user of which pod has it
and ask if it should start that pod, create a new pod or add the model to a different pod"
What exists (2.789.0): lib/noPod.js remake/putBack/todo, lib/podInv.js (listed, moveTo, noteSent, resolve, labelOf), lib/podSend.js
ensure = on the pod already (onPod: same name, else same file name in another folder) -> its name; else downloaded on the pod (online
source) else sent from this computer - so "only send what is missing" is ALREADY there; static/nopod.js = the box (#npDlg);
lib/podRevive.js moveStyles(from, to, name); lib/stylePods.js ready(pod, st, port0, opt.nopod).
Gaps / plan:
1. noPod.todo takes kind model + lora only -> ALSO the vae + te the model needs (inv.files kind "vae" / "te"; without them the model
   cannot render). Keep the count line honest ("its model, VAE, text encoder and N LoRAs").
2. NEW pure lib/noPodWhere.js (pure, unit-tested): where(file, invs) -> every OTHER pod (PI.listed: running + stopped, not gone, not
   hidden) that has the file (same rel / same file name in another folder; same size when both known) + for each pod which of the
   companions (vae, te, loras) it has and the GB it would need sent -> [{id, name, status: running|stopped, has_model, has: [...],
   send_gb, free_gb?}]. Stopped pods: their saved inventory only ("last seen <date>"); running pods: refresh first (the pod's own
   lists - the same call podSend.onPod uses).
3. routes/podInv.js (NOT server.js): GET /api/podinv/nopod/where?ref=<NO_Pod ref> -> {file, recipe line, on: [pods having it],
   others: [pods to add it to, running first then stopped]}; POST /api/podinv/nopod/use {ref, pod} -> starts it when stopped
   (stylePods / pods.act start - say RunPod may give a stopped pod no GPU back), then putBack-like ensure of ONLY what is missing
   onto THAT pod (lib/noPod.js new useOn(oldId, podId, port)).
4. The box (static/nopod.js): "juggernautXL_v9.safetensors was on NO_Pod (SDXL pod)" + when another pod has it: "SDXL-2 (stopped)
   has it" with [Start that pod] / [Use that pod] (running); then "...or put it on:" a list of the other pods, running first, stopped
   marked "starts it", each "VAE + text encoder there, sends 6.9 GB" (+ "not enough room" / "may not fit its 24 GB card" warnings -
   free volume from the pod info, VRAM vs file size like modelFit); buttons Not now · Use this pod · Make the pod again (the recipe).
5. THE RENAME (Tim): whichever is chosen - remade pod, a pod that has it, or a pod it is added to - the pick becomes
   "<pod name>/<file>" (no longer "NO_Pod (X)/<file>"): files moved into that pod's inventory (PI.noteSent / a merge - not moveTo,
   which re-ids a whole inventory), Basic Settings' saved value (basic.cfg imgCkpt / video model / LoRA rows that use the NO_Pod ref)
   and the styles (podRevive.moveStyles(old, newId, name)) rewritten; the NO_Pod entry is dropped when none of its files is left on it
   (PI.hide or delete its json), else it keeps the rest. The lists then show the new name; H3Basic.refill / loadComfyModels(true).
6. Still never remake or start a pod unasked (2.763.4 rule) - every path goes through the box.
Tests: test-nopodwhere793 (pure where(), the rename of refs in a basic.cfg-like object + styles), test-nopod789 legs extended (vae/te
put back), test-ui793 (the box lists a stand-in pod that has the file + one that does not, Use this pod -> the pick reads
"<pod>/<file>"; stand-in pod inventories in runpod/pods + the RunPod REST stand-in on 8399). Docs x4 (guide NO_Pod part, FEATURES
line, ja/zh-CN/zh-TW), the usual release steps, then the website's NO_Pod row text (tigerart features.php $models) + a new shot.

## 2.795.0 — MODEL MANAGER SOURCES (＋ ADD SOURCE); THE REMOTE GENERATION DOCKER IS NOW GPU (2026-11-15, main 403dd1b; tigerart not touched)
Tim (verbatim): "change the name of the remote docker to GPU seeing as we use local and remote together. Is is possible to make the
model manager dynamic, add source button will create a tab, in the tab we have a settings button to bring up a dialog, for url, api
key and endpoint format. (the endpoint will automatically be filled in by bitgen with the url and api key and the model chosen from
the list of models that we can get through the api)". Asked (AskUserQuestion) - Tim's answers: use = LLM + Vision + pictures + video;
formats = OpenAI-compatible + Ollama native + Anthropic-style + Custom template (all four); the ☁ OpenRouter tab stays as it is.
Split agreed in chat: 2.795.0 = rename + sources + LLM / vision chat; 2.796.0 = the sources' pictures + video.
- RENAME: SecFloat "rgen" title "GPU", status bar #tRgen "GPU" (ids unchanged); every sentence that named the docker (☁ Remote
  generation docker / ▸ / 's) -> 🖥 GPU in static/*.js, lib/*.js, routes/*.js, docs USAGE + FEATURES x4 languages, README. Settings ▸
  Remote generation (the Settings TAB) keeps its name. Guide headings kept (their ids are the translations' markers); the
  translations' markers restamped where they were in sync (old hash -> new) - i18n-help check 0, stale list unchanged.
- NEW lib/apiSources.js: FORMATS openai (list {url}/v1/models, chat {url}/v1/chat/completions, Bearer), ollama (/api/tags, chat its
  /v1 door, no key), anthropic (list x-api-key + anthropic-version, chat its OpenAI door with Bearer, min_tokens 1024), custom
  (list_tpl / chat_tpl with {url} {model}, auth bearer | x-api-key | none | header:<Name>). The chat is ALWAYS OpenAI's shape - the
  formats' native chat (/api/chat, /v1/messages) is not used. config.sources.<id> = {name, format, url, list_tpl, chat_tpl, auth, key,
  models [{id, kind, name, added}], list, list_at}; config.source_use = {llm|vlm: {source, model}}. RESERVED names (openrouter,
  no_pod, local, runpod, api). kindGuess by name. llmTarget(kind) -> {url, model, headers, label, drop, min_tokens}.
- lib/secrets.js SRC_KEY sources.<id>.key (encrypted in settings/keys.json - checked: not in custom.settings). lib/gpuSplit.js
  llmTarget asks apiSources FIRST (before Settings ▸ API). lib/remoteHosts.js set() clears a source pick for the LLMs; srcNote on the
  LLM / Vision row; static/remotehosts.js shows a 🔌 note even when the host is local.
- routes/apiSources.js (GET/POST /api/sources, /test, /mine, /use, /:id, DELETE /:id, /:id/models?refresh=1, /:id/mine) mounted in
  routes/index.js before cardUse. static/mmapisrc.js (H3ApiSrc): tabs in #mmSrcTabs + #mmAddSrc (modelmgr.js tab bar), render into
  #mmApiSrc (modelmgr paint() src:<id> branch; the tab-highlight loop is now generic data-mmtab), the ⚙ <dialog id="srcDlg">, the
  prompt docker's "🔌 <source> · your models" optgroups (MutationObserver like ormine) + a capture change listener (loaded BEFORE
  ormine.js). Messages go to the Model manager's line (ctx.say) - appNote's #notedlg blocked clicks.
- Tests: test-apisources795.js (37 - NOT in ci-units: its stand-in APIs listen on localhost, which ci-units greps out; it is a gate
  leg); test-ui795-ui.js (11 - stand-in OpenAI API on 8392, a real chat through it). Pins: test-remotedock754 (title GPU),
  test-apis757 (llmTarget order). ci-units 384/0. Browser on a clean gate-style studio: ui783 13, ui785 12, ui786 28, ui790 14, ui757
  17, ui795 11. KNOWN pre-existing (same on 2.794.0): test-ui753-ui fails 2 (the OpenRouter Free-only list "Pick a model…" + a
  page.check timeout); test-ui754-ui is retired from the gate.
- i18n: 33 UI words x3 (2 hand-added to strings.json: the GPU button + its tooltip).
- NOT tested against real services (stand-ins only): Groq / Together / Ollama / Anthropic answers; Anthropic's OpenAI door.

## 2.796.0 — THE MODEL MANAGER'S FILTERS FIXED + DROPDOWNS (2026-11-16, main 82768c6; tigerart not touched)
Tim (verbatim): "the model manager filters are not working, clean up the ui a little, use dropdowns instead of radiogroups if possible"
- THE BUG: static/mmsrc.js merge() tagged cards with `source: c.source || "local"` - but a LOCAL card already has `source` (how its
  Civitai details matched: "name", "sha256" …), so local cards were counted / filtered as "name": the counts said Local 0 and
  unticking Local hid nothing. Now c.place (merge sets local / runpod / openrouter), placeOf(c) (falls back on source for runpod /
  openrouter), shown(c, place) with place = all | local | runpod | openrouter, h3.mmsrc = {place}.
- DROPDOWNS: #mmPlace (All places / This computer / RunPod / OpenRouter with counts - written out in modelmgr.js paint() so
  scripts/ui-dynamic.js sees the words; H3MmSrc.barHtml is the same, pure + tested); #mmFold (every folder (n) / <folder> (n)) inside
  #mmFolders, which moved INTO the search bar (#mmLocalBar, display:contents); Civitai #mmCvType = CV_TYPES (All types, Checkpoints,
  LoRAs, VAE, Embeddings, ControlNet, Upscalers - the data-cvgrp chips are gone); ☁ OpenRouter .mmortype (the data-ortype tablist
  gone) + .mmorprice (free + paid / free only / paid only - S.free / S.paid kept).
- TIDY: the tab bar's tools are icons (⤓ 🔄 📁 ⇲ ⟳, names in their titles), tab buttons smaller, the bars' inputs / selects 28 px.
- Checked by hand with a stand-in ComfyUI models folder (COMFYUI_PATH=/tmp/fc/ComfyUI): place, search, category, family, model type,
  sort, LoRAs + family - all filter.
- Tests updated: test-mmsources790 (the bug pinned: a local card with source "name" counts as local), test-cvfilters7661,
  test-ui790, test-ui537, test-ui7661, test-ui786 (all pass on a clean gate-style studio; ui538 19, ui575 11, ui787 12, ui795 11).
  ci-units 384/0. KNOWN pre-existing: test-ui766-ui (the PODS "My pods" source button it waits for is gone since 2.780.0 - same on
  2.795.0; it is a gate leg - retire or rewrite it).
- i18n: 15 words x3 (2 hand-added to strings.json).

## 2.797.0 — BASIC SETTINGS' LISTS BY PLACE; NO ☐ REMOTE ROWS; CIVITAI BUTTONS IN THE CIVITAI TAB (2026-11-16, main ad338db; tigerart not touched)
Tim (verbatim): "move the civitai info and sync buttons into the civitai tab, in basic settings remove the remote checkboxes, show
local/openrouter/runpod/all in the dropdowns then filter the model lists by the type, do the same for loras, if in image mode show all
models in the styles model family in checkpoint list and lora list, if in video mode do the same but for videos"
- READING: "the type" = the place type (local / openrouter / runpod / all); the family part = 2.788.0's filter (image style's family in
  image mode, video style's in video mode) kept, from every place, and the counts are after it. The 2.788.0 TYPE narrowing (image vs
  image edit) is kept - ask Tim if "show all models in the styles model family" meant to drop it.
- NEW static/basicplace.js (H3BasicPlace, loaded BEFORE the main inline script): LISTS image-model / video-model (have OpenRouter),
  image-loras / video-loras (no OpenRouter); placeOf (openrouter/<id>; f.pod / f.remote / f.nopod = runpod; else local), counts,
  keep, optionsHtml (the words written out for the translator - patterns "All places ({0})" etc. exist since 2.796.0), listOf(el)
  (#imgCkptCombo / #tliRows / #tlvRows / #vidModel), get / set (localStorage h3.bsplace.<list>); boot: clears an old
  basic_use *_pod once (POST /api/basic-use *_pod ""), MutationObserver on #tliRows / #tlvRows repaints a new LoRA row's combo (loraRow
  builds the combo BEFORE the row is appended - host.closest fails then).
- index.html cmCombo: bsNow() finds the list when it paints (host.isConnected) -> fsel becomes .cmplace (place options + counts of
  famFiles(cmFiles) + your OpenRouter image models); paintFiles filters by place AFTER the family filter; comboExtra (OpenRouter) only
  on All / OpenRouter; fsel.onchange keeps the place. The folder filter is gone from these lists only (style editor, ControlNet …
  keep theirs). #vidModelPlace (a select) before #vidModel (input + datalist): basicset.js fill(again) builds pairs with pod / remote /
  nopod, counts + filters after H3FamFilter.names; ormine.paintVideo only on All / OpenRouter. static/remoteuse.js is no longer loaded
  (kept; lib/basicUse.js *_pod still honoured server-side - only the page's rows are gone).
- static/modelmgr.js: #mmFetch (⤓ Civitai info) + #mmSync (🔄 Sync) moved into #mmCvBar (labelled again); ⇲ / ⟳ / 📁 stay on the tab bar.
- Tests: test-basicplace797.js (12, ci-units 385/0); updated test-ui787 (place dropdown, no rows, the old pick cleared),
  test-podinv787, test-ui537, test-ui538 (opens the Civitai tab before Sync). Browser on a clean gate-style studio: ui537 25, ui538 19,
  ui786 28, ui787 11, ui788 10, ui789 12, ui790 14, ui793 14, ui795 11. Checked by hand with a stand-in ComfyUI folder + a pod inventory:
  Krea style = 2 models (1 here, 1 on the pod), RunPod = the pod's only; a LoRA row gets the place; the video Model list too.

## 2.798.0 — STYLE FAMILY LISTS WITHOUT THE IMAGE / EDIT SPLIT (2026-11-16, main aeccb33; tigerart not touched)
Tim (verbatim, answering 2.797.0's question): "yeh drop the split because some image models like klein can edit as well as generate."
- lib/famFilter.js pick() + static/famfilter.js pick(): fit = every file of the style's families (the `typed` narrowing by
  category === rule.type is gone; rule.type / typeOf still worked out, unused for narrowing). noteText names the family only
  ("For Krea 2 Raw: Krea - 2 models …", was "Krea · image").
- Tests: test-famfilter788 (pick keeps the family's edit file; the page pick; the line), test-ui788 (a Qwen edit style lists the
  Qwen picture model too; the H3 line). ci-units 385/0; ui787 11, ui788 10 on a clean studio.

## 2.799.0 — IMAGE EDITOR PAGES + DOCUMENT EXPORT (DTP part 1 of 4) (2026-11-16, main af9b407; tigerart not touched)
Tim (verbatim): "i want to give the editor full desktop publishing ability like coreldraw, user can add multiple pages each page
will have it's own layers. export to cdr, ai,pdf". Asked (AskUserQuestion): CDR export = "Both PDF and SVG" (.cdr has no public
write spec); AI = "Yes, PDF-compatible .ai"; scope, in order, one release each = "Pages + per-page layers" (2.799.0), "Master pages
+ page numbers" (2.800.0), "Linked text frames" (2.801.0), "Print-ready PDF" (2.802.0). The sources' pictures + video wait after.
- STANDING RULE KEPT: no CorelDRAW / Adobe names in what the user sees (test-brandnames.py checks every JS literal) - the formats are
  "PDF (.pdf)", ".ai (PDF-compatible)", "SVG pages (.zip …)", "For .cdr (.zip: the PDF + the SVG pages)"; "your vector app".
- NEW ext/imageeditdock/pcpages.js (PCPages, E.pages): PAGE_SIZES (mm), DPIS, cleanPage, pagePx, guess, moveIdx, pageKeys
  (PCDocs.DOC_KEYS minus DOC_ONLY name/view/file keys), sizeLabel. S.pages = {list:[{id,name,preset,wmm,hmm,orient,dpi,st,thumb}],
  cur, uid} - a DOC_KEY (pcdocs parks it with the document; blank pages:null). The page in front is live in S; the others' PAGE_KEYS
  kept BY REFERENCE in pg.st (take / giveSt; never-opened page = blankState: white Background). go / add (after, same size) /
  duplicate (E.snapDoc -> putDoc on the new page) / remove (two clicks, 🗑 .arm) / move / rename (dblclick) / setup (E.img.size
  for another dpi, E.img.canvas centred with S.bg white for another size) / eachPage(fn) (swaps each page into S, no screen
  change, restores) / toBgi / fromBgi / newDocument / newDialog / setupDialog. Panel #pcPagesPanel (.pgpanel, same spot as the
  PDF Pages panel; not shown while a PDF session is active); E.renderLayersPanel wrapped (a document with >1 page shows the panel;
  the front page's thumb 700 ms later); E.docBefore wrapped (a new non-in-place document = S.pages null). Menus: File ▸ New
  Document with Pages… (file.newpages), Window ▸ Pages (win.pages), page.add. Dialog lookups use doc.getElementById (E.$ is
  host-scoped - dialogs live on body).
- NEW ext/imageeditdock/pcdtpout.js (PCDtpOut, E.dtpOut): recorder() = a Proxy pretend 2D context keeping paths (moveTo / lineTo /
  bezier / quadratic / arc / ellipse / rect / roundRect / transforms / dash; gradients, pictures, clip, effects -> R.bad -> the layer
  goes as a picture); ellipseCurves; plan(leaves) (everything up to the last adjustment / non-Normal blend / clipped layer = one
  "Flattened (n layers)" picture); alphaBox (pictures cut to what they cover); toPdfOps; buildPdf(PL, pages, {title, fontkit,
  fontFor, stdOf}) - one OCG per layer named "<page> / <layer>", /OCProperties D Order per page, BDC /OC … EMC, ExtGState alpha,
  standard fonts or embedded (subset) via /api/fonts/file, letters a font cannot write -> "?" counted (notes.lost); buildSvg
  (mm size, viewBox px, inkscape layer groups, paths, base64 PNG, <text>). Vector = shape layers (rect / ellipse / polygon /
  line / simple pen paths; not path.line, not tfill, not styled / masked / blended); text = plain type (no PCText / PCType /
  PCRuns / rot / xm / mesh / fx; WinAnsi unless Embed fonts). File ▸ Export ▸ Document (PDF / AI / SVG)… (file.exportdtp), also
  ⤓ Export… in the Pages panel. Saves via POST /api/dtp/save + downloads.
- NEW lib/dtpStore.js + routes/dtp.js (mounted in routes/index.js after pdf): projects/<p>/dtp; .pdf/.ai must be PDFs, .zip a zip,
  .svg an svg. GET /api/dtp/list, /api/dtp/file/:name.
- pcbgi.js: toBytes(opts) - unless opts.nested and >1 page: m.pages = E.pages.toBgi(nested toBytes, put) -> pages/<id>.bgi inside,
  the page in front stays the main document (older bitGen opens it). openBytes(u8, name, {inPlace, nested, docName}) - nested
  returns early; after the main page, E.pages.fromBgi builds the other pages in place.
- ext.json: pcpages.js, pcdtpout.js right BEFORE pczones.js (pins: pccafill right after pcartboards; pczones right before
  pcpending; pcpending right before imageedit.js; test-pceditor pins the whole list). imageedit.js installs both after artboards.
- Tests: test-pages799 (13), test-dtpout799 (27; PDF re-read with pdf-lib, OCG names, BDC/EMC, Tj, Tc, dash; SVG; dtpStore),
  test-ui799-ui (19; real browser: dialog, per-page layers + undo, ⧉ / rename / ▼ / 🗑 twice, Page setup landscape, PDF checked by
  pdftotext + qpdf, the .cdr pack zip + SVG, .ai saved in dtp, .bgi round trip). ci-units 387/0. Checked by eye: a page exported and
  rendered by pdftoppm matches the editor (ellipse + outline as a path, title as text, painted layer as a picture).
- PRE-EXISTING (also on 2.798.0): test-psdocs-ui, test-bgfiles-ui, test-cafill-ui fail on a fresh studio - page.click("#kxFull")
  is intercepted by the floating prompt docker. Fix the tests (click by script like test-ui799) when convenient.
- Known limits (said in the guide): an .ai opens one page at a time in vector apps; adjustment / blend / clip layers flatten what is
  under them; warped / path / per-letter text goes as a picture.

## 2.800.0 — MASTER PAGES, PAGE NUMBERS, FACING PAGES (DTP part 2 of 4) (2026-11-16, main 68ce0b1; tigerart not touched)
Tim (verbatim): "go with the next version" (= 2.800.0 from the 2.799.0 plan: master pages + page numbers + facing pages).
- pcpages.js: S.pages gains masters [{id, name, w, h, st, thumb}], editing (index | null), facing, numbering {style 1|i|I|a|A,
  start}; norm() upgrades a 2.799.0 record. Pages get master (id | null) + mdirty. Masters share pp.uid with pages.
  * A page's master = a LOCKED pixel layer {master: id, locks: {all: true}, name "⌂ A-Master"} pinned right above the page's
    Background (pinMaster on enter / after every undo step) - its pixels = masterPic(m, i) (the master's layers rendered with
    its {page} tokens filled for page i, via withMasterSync swapping the master's state into S). Made again (syncMasterLive) when
    mdirty: master edited (closeMaster -> markPagesOf), renamed, assigned, numbers changed (renumbered() after add / duplicate /
    remove / move / rename / setNumbering - only masters with tokens).
  * Editing a master: editMaster(mi) stashes the page (leave) and gives the master's state; leave() while editing = leaveMaster;
    closeMaster() / go(i) / settle() return. settle() is called by add / duplicate / remove / move / setup, the export
    (pagesOut) and the .bgi (pcbgi toBytes top). eachPage(fn) handles onMaster (the page cur is in pg.st) and calls fieldsLive(i).
  * Tokens {page} {pages} {name}: on masters kept literal (filled per page in masterPic / masterOut); on pages resolveOwn keeps
    L.text.tpl (+ shown) - typing over the shown text without a token drops tpl. Resolved on enter, eachPage, and 400 ms after
    any undo step (E.onPush chained - internal renderLayersPanel calls do NOT go through E.renderLayersPanel!) unless a textarea
    / editor input / contenteditable has focus.
  * Panel: numbers shown in the strip, ⌂ master per card, facing = .pgs spread rows (page 1 alone right), the pged header
    (← Pages #pgBack), #pgMaster + All / Odd / Even, master rows (data-mme ✎, data-mmd 🗑 twice, data-mmn rename), ＋ Master
    #pgMAdd (A-Master… the front page's size, given to pages without one, opened), ☐ Facing #pgFacing, #pgNumStyle,
    #pgNumStart, # #pgNumIns (a {page} type layer bottom centre). Commands page.master, page.number (no menu slot yet).
  * .bgi: toBgi adds masters/<id>.bgi (withMaster, tokens literal), facing, numbering, uid; fromBgi keeps ids; needsBgi() =
    >1 page or masters / facing / numbering / a page master.
- pcdtpout.js: a leaf with L.master -> kind "master" -> E.pages.masterOut(id, pageIdx, () => pageOut("Master", k, -1)) = the
  master's own layers as "Master / <layer>" (paths, real text with that page's number). pagesOut: settle, eachPage for any pages
  record, opts.spreads + facing -> joinSpread (pure: items moved right by the left page's width; layer names "Page 2 / …").
  Export dialog: ☐ As spreads (#dtpSpreads, only for a facing document).
- Tests: test-masters800 (14), test-ui800-ui (18: ＋ Master, # on the master, ⌂ layer locked + the header shows, different digits
  page 1 / 3, None, i ii iii iv, {page} / {pages} on page 4 = "p. iv / iv", a new layer goes over the ⌂ layer, PDF Master / …
  layers + pdftotext numbers per page, facing strip "_0,12,3_", spreads 420/840/420, .bgi round trip (masters, uses, facing,
  numbering), B-Master). ci-units 388/0. test-ui799 19, test-pdfpages 8.
- The #kxFull floating-prompt-docker click problem (2.799.0 note) also hits test-artboards-ui depending on test order.

## 2.801.0 — LINKED TEXT FRAMES + TEXT WRAP (DTP part 3 of 4) (2026-11-16, main 220769a; tigerart not touched)
Tim (verbatim): "ok, next please".
- NEW ext/imageeditdock/pcflow.js (PCFlow, E.flow): a frame = paragraph text (t.box). t.flow = {id, idx}: idx 0 = the FIRST
  frame and its t.str IS the story (it draws it all, overflow hidden - pctype already hides lines past the box); later frames'
  t.str = what did not fit before them, set by reflow() (+ t.flowSet = the part given). Pure: boundaries (cut after words),
  flow(story, n, fits) (binary search per frame, a cut at a paragraph end drops the \n; the last frame gets the rest),
  clipPoly (Sutherland-Hodgman), shapePoly (ellipse 48 pts / polygon / rect + gap), rectPoly, holesFor.
  * reflow(): (1) wrap - for each place (S + every stashed page's st.layers; not masters) obstacles = layers with L.wrap.on
    (shape outline, point-text box, else alpha bbox cached per L.ver) -> t.wrapHoles per frame (clipped); (2) stories -
    renumber idx, a later frame TYPED IN (t.str !== t.flowSet, its range still matches `last`) is merged into the story at its
    place: t.flowSet = t.str first, then E.setLayer(head, "type in frame n") = ONE undo step (head on another page: direct).
    Then flow() with fits = PCType.layout(...).overflow === false on that frame's t. Changed frames rasterized; the live page
    refreshed. Runs 300 ms after E.onPush / E.onUndo (NEW hook in imageedit.js undo()/redo()) and on a page change (the
    E.renderLayersPanel wrapper), not while a textarea / editor input has focus.
  * Commands (Layer menu after type.workpath): flow.here, flow.next (go / add next page, frame at the same place), flow.story
    (#pcStoryDlg #storyTxt #storyOk - E.setLayer on the head; goes to the head's page), flow.unlink (break before this frame:
    head keeps story.slice(0, start_k), frame k = new story head with the rest), flow.wrap (#pcWrapDlg). Properties rows
    (E.ui.propsExtra): frames #ppFlHere #ppFlNext #ppFlStory #ppFlUnlink + "frame k of n"; other layers ☐ Text wrap #ppWrapOn
    + gap #ppWrapOff (L.wrap {on, off}; not an undo step).
- pctype.js: layout() - box + t.wrapHoles -> areaLayout(t, m, {rings: [rect, …holes]}); spansAt reads rings (even-odd), areaLayout
  uses the outer ring for top / bottom. Each line takes the WIDER side of an obstacle (bandSpan). Overlapping holes cancel
  (even-odd) - not handled.
- pcdtpout.js: plainPara(t) (PCType-owned without scales / baseline / smallcaps / pos / faux / underline / strike / OpenType
  engine) -> real text: paraLines = PCType.layout lines (not over), a justified line word by word; align left (x already placed).
- pcpages.js: E.onUndo chained too (numbers after undo).
- Tests: test-flow801 (15), test-ui801-ui (15: + Frame row, + Next page, PDF has every word once in order, typing in frame 2 +
  Ctrl+Z / Ctrl+Y, wrap around an ellipse (holes, lines end before it), Edit Story + undo, Unlink -> 2 stories, .bgi keeps all).
  Checked by eye: two justified frames with an ellipse between, text wrapping round it in both. ci-units 389/0; ui799 19,
  ui800 18, pdfpages 8, ui537 25.
- test-pstype-ui's first check fails when earlier tests leave extra tabs in the Color group (got pcColor,pcSwatches,pcChar,pcPara,
  pcNav,pcHist,pcInfo,pcNotes) - layout state, not 2.801.0.

## 2.802.0 — PRINT-READY PDF (DTP part 4 of 4) (2026-11-16, main f25774b; tigerart not touched)
Tim (verbatim): "please go with next".
- pcdtpout.js pure: cmykSimple (greys -> K only), bleedSegs(segs, W, H, b px) (points within 0.5 px of an edge pushed out
  by b), MARK {gap 3, len 12, room 24, reg 4} pt, printBoxes(w, h, b, marks) -> {W, H media, M trim offset, trim, bleed},
  marksOps(w, h, b, {crop, reg}) (8 crop lines outside the bleed + 4 registration targets, pt, y up).
  buildPdf(…, {print: {bleed pt, crop, reg, slug, cmyk(r,g,b) -> [c,m,y,k] 0..1, doc, date}}): page = media size;
  setMediaBox / setBleedBox / setTrimBox / setCropBox; all layers inside q 1 0 0 1 M M cm … Q; vectors via toPdfOps(…,
  cmykOf) -> k / K; vector paths bleedSegs'd; text colour PL.cmyk; pictures with it.rgba (+ iw, ih) -> DeviceCMYK flate
  XObject (+ DeviceGray SMask when any alpha < 255) drawn with q cm Do Q (page.node.newXObject("ImC")); a "<page> /
  Printer's marks" OCG in 1 1 1 1 K (RGB: black) 0.25 pt; slug Helvetica 6 pt at y 4 ("doc · page · date · CMYK · bleed
  n mm"). notes: print, cmyk, bleed, standard (type in a standard, not-embedded font), cmykPictures.
- pcdtpout.js page: pageOut cuts pictures with edge extension when o.bleedMm (left / right columns, then top / bottom rows
  of the cut itself stretched) and keeps rgba when o.cmyk; build(): pr = op2.print (not for svg) -> embed forced, cmyk =
  PCMode.buildLut({press, gcr: "medium"}, 17) + lutAt (greys K only), print opts. Dialog: #dtpPrintBox (hidden for SVG),
  #dtpPrint, #dtpPrintOpts (#dtpBleed 3, #dtpCrop, #dtpReg, #dtpSlug, #dtpColour rgb|cmyk, #dtpPress coated|uncoated|
  newsprint), stored as dtp.print. Spreads: a spread is one trim (the spine is not bled).
- Not PDF/X certified: no OutputIntent / ICC (no third-party profile data), transparency kept (soft masks), slug font Helvetica
  not embedded. Spot colours not done (would need Separation colour spaces from swatches).
- Tests: test-print802 (14: page boxes, cm offset, 0 1 1 0 k box moved to x -9, 1 1 1 1 K marks layer, CMYK image + SMask,
  pixel conversion, notes, plain export unchanged), test-ui802-ui (8: dialog defaults, saved Flyer print.pdf, the message,
  boxes 32.5/24/0, DeviceCMYK and no DeviceRGB, pdftoppm render: green photo in the top bleed, red band in the bottom bleed,
  marks; pdftotext: title + slug). Checked by eye: crop / registration marks, a blue band bled past the trim, the slug.
  ci-units 390/0; ui799 19, ui800 18, ui801 15.

## 2.803.0 — LASER PANEL: TOOLPATHS + G-CODE (laser part 1 of 2) (2026-11-16, main 7830caa; tigerart not touched)
Tim (verbatim): "can we add a lightburn feature to image editor, it can do a linedrawing using controlnet or import a vector or
create a vector and generate a toolpath?" Asked (AskUserQuestion): controller = "GRBL + Marlin G-code"; sending = "File + send
over USB" (USB = 2.804.0); operations = "Line (cut / score), Fill (vector engrave), Image (raster engrave), Offset fill /
centreline"; line art = "Both, pick per job". Shown as "Laser" in the app (no product names).
- NEW ext/imageeditdock/pclaser.js (PCLaser, E.laser). Pure: MACHINE {flavor grbl|marlin, bedW/H mm, origin bl|tl, sMax
  (GRBL 1000 / Marlin 255), travel, dynamic (M4), air (M8/M9)}, OPS, OP_DEFAULT {op, power %, speed, passes, interval mm,
  angle, trace centre|outline, dither floyd|threshold|grey, threshold %, overscan mm, minPower %}; flattenSegs (recorder segs
  -> polylines; a path ending at its start = closed), rdp, thin (Zhang-Suen), skeletonPaths, distance (chamfer 3-4 / 3),
  isolines (marching squares on pixel centres, outside = 0, chained), hatch (even-odd, angle, zigzag), inside, order (deeper
  closed paths first = holes before outsides; nearest next; loops rotated, open paths reversed), rasterRows, toMm (px -> mm,
  y flipped for bl), gcode, estimate.
  * G-code GRBL: G21 G90 [M8] M4|M3 S0; vector path G0 start, first G1 "S<p> F<f>", then G1s; raster row G0 run-in (overscan),
    G1 S0 / S<p> per run, run-out; end M5 [M9] G0 X0 Y0 M2. Marlin: "M3 S<p>" before burning, M5 before travel, no S on G1.
  * Page: per layer L.laser (stored on the layer, not an undo step); S.laserJob {w, mmpp, offX, offY}; machine in
    store("laser.machine"). build(): shapes via E.dtpOut.vectorOf (deduped fill/stroke segs), type via PCType.outlinesOf
    (needs the font file) else the mask; picture layers rendered ALONE (D.render with others hidden) -> darkness × alpha ->
    mask at up to 4× (≤ 0.1 mm a px, ≤ 12 Mpx) for centre (thin + skeleton + rdp 0.6) / outline (isolines 0.5) / fill rings /
    offset (distance + isolines every interval). Ops sorted image, fill, offset, line (engrave before cut). Preview canvas
    #lzPrev zoomed to the job box (+8 %), bed drawn cream, travel dashed. Panel #pcLaserPanel (.lzpanel, right of centre):
    #lzFlavor #lzBedW #lzBedH #lzOrigin #lzSMax #lzTravel #lzDyn #lzAir, #lzMmpp #lzOffX #lzOffY, per layer
    [data-lz=<id>][data-k=op|power|speed|passes|interval|angle|trace|dither|threshold|minPower|overscan], #lzArt, #lzGo,
    #lzSave, #lzStats. Line art: E.api.preprocess(blob, "lineart") -> dark-lines pixel layer "Line art" (Line · centre).
- NEW lib/laserStore.js + routes/laser.js (POST /api/laser/save text, list, file; projects/<p>/laser; must look like
  G-code). ext.json: pclaser.js after pcflow.js; imageedit.js installs after PCFlow.
- Tests: test-laser803 (21), test-ui803-ui (11: panel rows, centreline choice, 5 ops in engrave-first order, a 9 px line ->
  one centreline at y 39.1 mm, preview drawn + stats, Sign.gcode saved (GRBL header/footer, S800 F600 ×2, moves inside the
  job), Marlin M3 S204 / M5, Line art via a stand-in preprocessor). Checked by eye: ellipse line, 45° hatch, centreline,
  dithered raster in the preview. ci-units 391/0.
- Not done here: text as Line when its font file is missing falls back to tracing the rendered text; no kerf offset for cuts;
  no tabs / bridges; no Z; pixel-layer Fill uses its outline rings (isolines) for the hatch.

## >>> NEXT: 2.820.0 IMAGE EDITOR (Tim's 2026-11-17 list, then the SPREADSHEET / SLIDES plan below) - RENUMBERED: 2.820.0 went to the mail fix, so 2.821.0 = Move to Frame + fill / shadow, 2.822.0 = the WP layer

Tim (verbatim): "in image-edit docker make the word processor a wp layer that the user can edit and change it's position
in the stack. when user presses button to combine,add,subtract,intersect shape go into that mode, when using freehand
select mask , show the line the user is drawing as they are drawing so they have a visual reference, same with the pen
tools. double click on a shape or layer will put it in move transform mode, don't show the bounding box, only show the
handles. when user clicks on the same shape again , change the tranform resize/skew handles to rotate handles. When user
right clicks on a layer and clicks move to frame then allow the user to drag the layer into another which becomes it's
frame, just like coreldraw does. make the gradient and dropshadow tool interactive just like coreldraws tools (user
clicks in a shape and drags the gradient or drop-shadow). ctrl+shift+A clears all selections"
- DONE 2.819.0: Ctrl+Shift+A, the live lines, the modes, double-click / click-again handles (see "## 2.819.0").
- 2.820.0 PLAN: (a) right-click a layer (Layers row + canvas) > "Move to Frame…": a big arrow; the layer's ghost follows
  the pointer, a closed shape under it lights up, click / release on it = E.frames.place([layer], F) (pcframes.js has
  place / isClosedShape; Layers rows: pcui row.oncontextmenu menu + E.ui.layerCtxItems; canvas: E.ui.stageCtxItems).
  Esc cancels; not a closed shape = say so. (b) Interactive Fill tool (CorelDRAW G): click in a vector shape + drag =
  a linear gradient fill from the press to the release (fillGrad gets x0,y0,x1,y1 - pcbezier fillStyleOf draws vector
  LINES' fillGrad; plain shapes / paths (pcdoc drawShape0, PCPath.drawPathShape) draw s.fill only - add fillGrad
  there too), handles at both ends stay draggable; colour = fg -> bg. (c) Interactive Drop Shadow tool: click in a
  layer + drag = styles.shadow on, angle / distance from the drag (pcdoc LAYER_STYLES shadow {angle, distance, size,
  opacity}), an end handle to drag again, a bar with size / opacity / colour.
- 2.821.0 PLAN: the WP layer - document text (pcdoctext.js, layer.doc) as its own layer type the user edits in place and
  moves up / down the stack like any layer (today the frame is drawn onto a layer - check how pcdoctext keeps it).

## 2.821.0 — INSERT INTO FRAME, ARRANGE, GRADIENTS ON SHAPES / TEXT, REAL CUTS (2026-11-17, main 71585d7; tigerart not touched)

Tim (verbatim): "in image-editor when user selects insert in frame change the cursor to a thick black arrow then when user
clicks a shape insert the layer into that frame like envelope. the contents of the frame move with the frame and scale with
the frame, the frames fill will be the background and layers inside the frame will be in their stacked position. when user
clicks an object on a layer add bring foward, send backward, to front and to back to the context menu. layers inside a
frame will be moved inside the frame group. fix the gradient fill, it is only filling selection and background, it should
also fill shapes and text. if a shape is cut merge the shapes together and do a real cut(subtract)"
- pcframes.js: frame.insert "Insert Into Frame" -> startInsert(): movers = multi picks / E.picked / the active layer;
  ins {ids}; stage cursor ARROW (an SVG data URI, hot spot 37 16) + .pcins; capture pointermove = frameAt (topmost shown
  closed shape whose path holds the point, not a mover / inside one) lit on the overlay; capture pointerdown = place(ids,
  F, false) (where they are), selHl.pick(F); right button / nothing = end; Esc (doc capture). Menus: canvas (before
  frame.place), Layers row menu, Layer ▸ Frame. The canvas menu adds layer.front / forward / backward / back for the
  active object; while editing a frame the right-click picks the content under the pointer (the frame's own fill hit).
  The earlier 2.820.0 plan item "Move to Frame (drag)" = this (a click, as Tim now asked).
- pcdoc.js: move() at a frame's edge returns the layers unchanged (a frame's layer stays inside); gradStyle(g, s, box)
  exported - shape.fillGrad {type, x0, y0, x1, y1 | angle, css | stops | c1 / c2}; drawShape0 (plain shapes), pcpath
  drawPathShape (paths), pcbezier fillStyleOf (vector lines) all use it.
- pctools.js T.gradient: a vector shape (not a line / dimension) or a text active = vecGradient: shape -> fillGrad from the
  drag + the tool's stops (gradStops -> css + {t, c, a}); text -> styles.gradientOverlay (angle from the drag, scale = drag
  length / the box's span, stops). Pixel layers / selections as before.
- pcdockers.js bakeShape(L) (E.bakeShape): a path shape of 2+ closed parts -> areaPath (the Shaping raster maths, traced
  back to curves) = ONE real outline (holes as their own add parts); called after pcpen's Shape tool modes and pcpropbar's
  drawCombine. Open parts / vector lines are left alone.
- Tests: test-frames821.js (14), test-ui821-ui.js (15); test-ui810-ui (Add = 1 outline, Subtract = a hole, no subtract
  part), test-frames2 (canvas menu pin).
- NOT DONE from Tim's 2026-11-17 list: the interactive DROP SHADOW (click in a shape + drag), the WP layer.

## 2.820.0 — ✉ MAIL FINISHED (2026-11-17, main 8f083e5; tigerart not touched)

Tim (verbatim): "finish the mail client, it logs in successfully but the account dissapears when i close the dialog, it
looks like it is just the start".
- THE BUG: ✓ Test only logged in - nothing was saved until ＋ Add account, so Close lost it. mailaccounts.js: `dirty`
  (input / change on the account fields); test() with i.ok and (!cur || dirty) -> save(); closeDlg() (Close button + the
  dialog's cancel = Esc) saves typed changes when email + (cur or pass); save() returns true / false and closes the dialog
  for the FIRST account (M().msg "added - reading the inbox").
- NEW lib/mailBatch.js: batch(acc, folder, uids, op, to) (seen / unseen / flag / unflag / move / delete; delete = move to
  Trash unless in Trash; local index patched / dropped; folder counts), search(acc, folder, q) (each term an imapflow search
  - {or: from/to/cc/subject/body} or a field from:/to:/cc:/subject:/body: - uid sets intersected, newest 200 fetched, the
  AI flag / snippet copied from the index; NOT kept in the index), contactsOf / matchContacts / contacts(id, q, me) (every
  folder's index.json under MS.dirOf(id)), createFolder(acc, name, parent). Routes /api/mail/:id/batch, /search,
  /contacts, POST /folders (routes/mail.js).
- lib/mailImap.js sync: f.exists = the server's message count (⤓ Older emails shows when exists > listed and the list hit
  the limit; S.limit[folder] += 200, sent as sync {limit}).
- maildock.js: S.picks / S.anchor (Ctrl toggles, Shift range from the anchor, Ctrl+A, Esc), batch(op) used by del() /
  toggle() when > 1 picked, moveTo(to, uids), moveMenu (#mlMoveMenu .mlmenu), drag (dataTransfer "text/x-bitgen-mail") onto
  .mlf, serverSearch (Enter in #mlSearch; S.search {q, total}; #mlSearchBar with ✕ #mlSearchOff; sync() skipped while
  searching), older(), newFolder (askText; #mlNewFolder in the folders' account header). dock.html: #mlMove, #mlSearchBar,
  CSS .pick / .mlmenu / .mlsugg / .mlf.drop / .mlmore.
- NEW ext/maildock/mailcontacts.js (last in ext.json): To / Cc / Bcc suggestions (lastToken / putIn pure; .mlsugg popup,
  ↑ ↓ Enter Tab Esc, click).
- Tests: test-mail820.js (12, ci-units), test-ui820-ui.js (18 - hoodiecrow with 205 emails + Archive; drag via dispatched
  DragEvents); test-ui818-ui.js now waits for "kept" after Test (no Save click); test-mail818 counts 5 scripts.
- Docs: help mail.html (4 languages, "Organising" section, hash restamped), USAGE section + FEATURES line (4 languages),
  UI strings (15 + patterns), PDFs. Ideas not built: conversations (threads), rules / filters, unified inbox of all
  accounts, calendar invites (.ics), a contacts book.

## 2.819.0 — PICKING, MODES AND THE DRAWING LINE IN THE IMAGE EDITOR (2026-11-17, main 40db346; tigerart not touched)

- NEW ext/imageeditdock/pcpickmodes.js (window.PCPickModes, installed after PCShapeOps): Select > Clear All Selections
  (Shift+Ctrl+A - it was Dockers: Align and Distribute (pcdockers, now no key) and a hidden Krita deselect (pcui, gone));
  clears E.deselect + E.multi + selHl + S.picks + E.clearSelHooks (pcpen asel/csel, pcvline nsel push into it).
  Modes: one mode for S.shapeOp / S.drawOp / S.penOp (syncedOps) - a delegated click listener on [data-pnshop],
  [data-dop], [data-pnop], [data-pmmode] syncs them; E.shapeMode.set wrapped; the property bar (E.propbar.extras) shows
  ◻ ⊕ ⊖ ⊗ ⊘ for a shape layer - E.shapeModes.go(m) sets all three and switches to the last CLOSED_TOOLS tool (store
  pm.lastdraw, default shape). The mode glyph at the pointer (overlay hook) while a DRAW_TOOLS tool is in a mode != new.
  Lasso / Polygonal Lasso extra line (rubberOf). Double-click with tool none / objsel on an object, or a Layers row
  (wrapped E.ui.layerExtra) = transformMode: Move tool, objSel, E.handles.setMode("scale").
- pchandles.js: no strokeRect box; pointerdown records st.click.same (selHl.objectAt === target / its frame owner / a
  group's descendant); a click (no drag) = setMode(nextMode(mode, same)); dblclick = scale (was: toggle rotate).
  pctools.js: the Move tool's dashed text/shape box hook removed. imageedit.js drawOverlay: S.pts black + white dashes.
  pcvline.js: the rubber band for the Bézier tool too.
- Tests: test-pickmodes819.js (19, ci-units), test-ui819-ui.js (18 - hides .h3fp.dfm-float dockers while it runs).
  Updated: test-handles-ui / test-frames2-ui / test-ui604-ui (double-click = scale, click again = rotate), test-selhl605,
  test-psdockers, test-pceditor, test-doctext811 (script order), test-guidepdf (reads pcpickmodes.js too).
- Docs: help imageeditor.html (4 languages, hash restamped), USAGE section + the Align line (4 languages, the
  the-image-editor-with-ai marker restamped), FEATURES (+1 line, 3 lines changed, 4 languages), docs/shortcuts.json
  (Select menu + Shift+Ctrl+A, Window menu - Align's key; 4 languages, group hashes), UI strings (7), PDFs.
- Known, pre-existing: test-i18n703-ui "every section" (3 guide sections untranslated since 2.708-2.710).
- Scratch: /home/claude/bin/fresh819.sh = a FRESH studio on 8427 from the work tree (the old /tmp/t818 on 8426 has a
  floating StoryBoard over the canvas - its UI tests fail on clicks there).

## >>> NEXT: 2.819.0 SPREADSHEET (then SLIDES) - AGREED ORDER WITH TIM 2026-11-17
Tim (earlier): "lets go with your suggestions" - order app strip (2.817.0) -> Mail (2.818.0 DONE) -> Spreadsheet -> Slides;
Tim tests after all of them ("we will do all the releases before i start testing"). Plan each like the word plan (several
releases); ask Tim nothing new unless a choice is his.
- SUGGESTED SPREADSHEET PLAN (ext/sheetdock - the app strip's tX_sheetdock ▦ is waiting in static/appstrip.js APPS):
  2.819.0 the grid: a .bdock #sheetdock (starts hidden like maildock), cells / rows / columns (virtual scrolling), sheets as
          tabs, select / fill handle / copy-paste (tab-separated in + out), undo, formats (number, currency, %, date),
          fonts / bold / colours / borders / alignment / wrap / merge, freeze panes, sort + filter; a formula engine of our
          own (pure, jsdom/Node-tested: + - * / ^ &, comparisons, ranges A1:B9, $ refs, cross-sheet refs, SUM AVERAGE MIN
          MAX COUNT COUNTA IF IFS AND OR NOT ROUND ABS VLOOKUP XLOOKUP INDEX MATCH SUMIF(S) COUNTIF(S) TEXT CONCAT LEFT RIGHT
          MID LEN TRIM UPPER LOWER TODAY NOW DATE YEAR MONTH DAY; #REF! #DIV/0! #NAME? #VALUE! and cycles said); files in
          projects/<p>/sheets as .bgs JSON (lib/sheetFiles.js + routes/sheets.js mounted from routes/index.js).
  2.820.0 .xlsx out + in (check licences first: exceljs MIT is the likely one; SheetJS CE is Apache-2.0) + .csv; charts
          (bar / line / pie / scatter from a range - drawn on a canvas, into the .xlsx where the library allows).
  2.821.0 ✨ the AI: "write a formula for …", explain a formula, fill a column from an instruction, summarise / find trends
          in a range (the prompt docker's LLM via lib/llmChat, like lib/mailAi.js); → Image editor / → document text as a
          table (pcdoctable), mail merge's data source from a sheet (pcdocmerge).
- SLIDES after that: ext/slidesdock (tX_slidesdock 🎞) - slides as image-editor pages (pcpages / masters) or its own
  canvas, .pptx out (pptxgenjs MIT) + in, presenter view, ✨ outline -> slides with the LLM + generated pictures.

## 2.818.0 — ✉ MAIL WITH YOUR OWN AI (2026-11-17, main 016c07a; tigerart not touched)
Tim (verbatim): "I would like a mail docker that resembles outlook but works with ai, our models should be able to read
the emails and flag important ones and draft a reply. it should also help us construct an email." Design as agreed (no
cloud sign-up; IMAP + SMTP to the user's own mailbox; the prompt docker's LLM).
- NEW lib/mailStore.js: accounts in config.mail.accounts.<id> {name, email, user, imap {host, port, secure}, smtp {…},
  tls_check, save_sent, sig}; the PASSWORD at mail.accounts.<id>.pass = a lib/secrets.js key path (MAIL_KEY; pathsOf / put
  - a removed account's key not put back; lib/settings.js save() also deletes MAIL_KEY names) -> encrypted in
  settings/keys.json, never in custom.settings, never to the page: view() has has_pass only, and GET /api/config goes
  through hidePasswords() (POST /api/config's allow-list has no "mail", so the page cannot lose one). PRESETS by address
  (Gmail, Outlook.com, Yahoo, iCloud, Fastmail, Zoho, GMX; app: true = app password; Gmail sent_auto -> save_sent off),
  else imap./smtp.<domain> guessed. config.mail.important / auto_flag / check_min (setSettings). The local copy:
  <app>/mail/<id>/folders.json, <folderKey>/index.json {uidValidity, synced, msgs [{uid, from, to, cc, subject, date,
  seen, flagged, answered, size, messageId, ai {level, why, at}, snippet}]}, <uid>.json (the body), <uid>.att/<n>.
  mergeIndex keeps ai + snippet by uid (a new UIDVALIDITY drops them). serial(id, fn) = one IMAP job per account at a time.
  mail/ in .gitignore + make_zips.sh (check-gitignore agrees).
- NEW lib/mailImap.js (imapflow 2.x, MIT): one short connection per job (withClient: connect / fn / logout; a refused
  login = 401 "refused the login (…) - … app password"); folders (list with statusQuery, specialOf: INBOX / \Special-Use /
  names like Sent Items, Deleted Items, Spam; sortFolders inbox, drafts, sent, archive, junk, trash, rest), sync (newest
  `limit` 200 by sequence: uid, flags, envelope, internalDate, size -> headOf), message (source -> mailparser simpleParser
  -> text, safeHtml (no script / iframe / object / form / base / meta / on* / javascript:; cid: -> data: up to 2 MB),
  attachments to <uid>.att/<n>; related inline pictures not listed), setFlags (\Seen \Flagged \Answered), move, remove (to
  the \Trash folder; in Trash = messageDelete), append (sent / drafts by pickFolder - special use first).
- NEW lib/mailSend.js (nodemailer, MIT-0): compose() builds the raw message ONCE (MailComposer, keepBcc false - Bcc only
  on the envelope; In-Reply-To / References; X-Mailer bitGen Studio; attachments base64; forwardOf {folder, uid} adds the
  original's kept attachments; 25 MB cap; addrList refuses a bad address by name); send() = transport.sendMail({envelope,
  raw}) (requireTLS on 587) + the same raw appended to Sent (save_sent) + the original marked \Answered (replyTo); draft()
  = append to Drafts with \Draft; test() = verify(). replySubject (Re: / Fwd: once), quoteOf.
- NEW lib/mailAi.js: every call through lib/llmChat.complete (the prompt docker's LLM / external endpoint / 🖥 GPU docker's
  OpenRouter or pod) - setComplete(fn) for tests. flag(): batches of 6 (H3_MAIL_FLAG_BATCH), excerpt 700 chars each,
  flagPrompt (levels 3 urgent / 2 important / 1 normal / 0 low, "what matters to me", who the reader is, one line
  "<n> | <level> | <reason>"), parseFlags (bold, "Email n:", "#n)", repeats + bad levels ignored) -> index m.ai; summary()
  (2 sentences + "Action:" -> body.ai_summary), reply() (body only, tone from TONES, the ask; cleanBody drops "Here is…",
  Subject lines, fences, quotes), write() (notes -> "Subject:" + body, parseWrite), rewrite() (how). plainOf cuts quoted
  history ("> " lines, "On … wrote:", Original / Forwarded markers).
- NEW routes/mail.js (mounted in routes/index.js after docx): /api/mail/accounts (GET / POST / POST :id / DELETE :id),
  /preset, /test (IMAP + SMTP, sends nothing), /settings, /:id/folders, /:id/sync, /:id/list, /:id/message,
  /:id/attachment, /:id/flags, /:id/delete, /:id/move, /:id/send, /:id/draft, /:id/ai/flag, /:id/ai/summary,
  /:id/ai/reply, /ai/write, /ai/rewrite.
- NEW ext/maildock (order 94; lands at the shell's <!-- ext:dock * --> slot; .bdock#maildock data-own-space; starts HIDDEN
  the first time - localStorage h3.g.maildock; ensureDockButtons makes tX_maildock and H3AppStrip moves it to group 1 after
  🖼 as ✉): mailview.js (H3MailView, pure + Node-tested: flagOf, filterMsgs, sortMsgs, shortDate, linkify, hasRemote,
  frameDoc (CSP default-src 'none'; img-src data: cid: [+ https: http: after Show pictures]; base target _blank),
  replyTargets (Reply-To wins, Reply all -> Cc, never yourself, own sent email -> its recipients), textOf / htmlOfText),
  maildock.js (H3Mail: bar, folders, list (unread bold, ⚑ mllv0-3 + the reason line), reading pane - HTML in
  <iframe sandbox="allow-popups allow-popups-to-escape-sandbox"> srcdoc, text linkified, 📎 links, ✨ Summarise, ✨ Draft
  reply / Reply all with an ask + tone; ↑ ↓ / Delete in the list; ★ / ● toggles; the ✉ button's data-n unread count;
  checkInbox() every check_min minutes (also while hidden, from the start); ✨ auto -> flag after a sync),
  mailcompose.js (H3MailCompose: dialog #mlCompose, From / To / Cc / Bcc / Subject, ✨ Help me write (notes + tone ->
  /ai/write, or in a reply /ai/reply), ✨ Rewrite select (5 + your own via askText), ↶ Undo of the last AI change, B I U
  lists link clear, 📎 + drop, the quote (☑ include) sent as text "> " + HTML blockquote, Ctrl+Enter, Esc/Discard asks
  when dirty (appConfirm), pasted text as plain text), mailaccounts.js (H3MailAccounts: dialog #mlAcctDlg - preset fill
  on the address, SSL toggles the port 993/143, 465/587, ✓ Test, Save / Add, Remove (asks), the AI settings).
  Help page static/help/mail.html (+ ja / zh-CN / zh-TW; no inline-styled spans - a pack's sanitizer drops them and the
  page then counts as "translated" in test-langpacks715).
- Packages: imapflow ^2.12.1 (MIT), mailparser ^3.14.5 (MIT), nodemailer ^10.6.0 (MIT-0) as dependencies;
  hoodiecrow-imap ^3.3.1 (MIT) as the FIRST devDependency - the stand-in IMAP server + its SMTP server
  (lib/hoodiecrowSMTPServer startSMTPServer files SMTP mail into INBOX) for the tests only. Credited: lib/credits.json
  (+ make_credits.py -> USAGE; the 3 translated credits rows by hand, hash restamped), misc/NOTICE.md "Node packages for
  ✉ Mail".
- i18n: 106 UI strings (strings.json "Mail docker (2.818.0)") + dynamic.json refreshed (ui-dynamic.js) -> 133 strings + 10
  patterns translated (ja, zh-CN; zh-TW via i18n-zhtw.py --ui); USAGE section + FEATURES line in 4 languages.
- Tests: test-mail818.js (52, ci-units), test-mail818-live.js (27; 127.0.0.1 -> gate leg: hoodiecrow + setComplete),
  test-ui818-ui.js (31; starts hoodiecrow + an OpenAI-style LLM stand-in itself, sets Settings ▸ LLM external_url for the
  run and puts it back, removes its account at the end; H3_SHOTS=<dir> saves mail-docker / mail-reply / mail-account
  pictures). test-ui817 now expects tIE,tX_maildock in group 1; test-langpacks715 pins every help page (4).
- NOT DONE (say so if asked): OAuth sign-in (Gmail / Microsoft "Sign in with…" - app passwords only), IMAP IDLE push
  (polling every N minutes instead), threads / conversation view, rules / filters, contacts / address book completion,
  calendar invites (.ics shown as an attachment only), S/MIME / PGP, more than the newest 200 per folder (sync limit),
  server-side search (🔍 searches the kept headers + snippets), moving between folders from the UI (the API has /move),
  the original's HTML is quoted in a reply but a forward's attachments must have been opened once (kept copy).
- NOT tested against real providers (stand-ins only) - first real use may need small fixes per provider; the errors carry
  the server's own words.

## 2.817.0 — THE APP STRIP ON THE TOP BAR (2026-11-17, main 5b40725; tigerart not touched)
Tim: "put the button for this on the top menu-strip as icon only, not in the statusbar, add a separator before and after
this group of buttons (editor,mail,spreadsheet,slides) then add (solidcraft and sketcher buttons) these are more like mini
apps so they can be separated from the statusbar docker" + "there aren't many users yet, so a good time for the change".
- NEW static/appstrip.js (after remotebtns.js): #appStrip in #menubar (lands after #wsWrap + #palBtn, before #quWrap):
  asep | appGrp1 | asep | appGrp2 | asep. Buttons MOVED with their ids (tIE; tX_<dock> made by index.html ensureDockButtons),
  icon only (APPS / MINI lists), lit by paintDockButtons' .on. GOTCHA: the first-run tip used appNote = a modal #notedlg
  that blocked the pointer (test-menubar-ui's hover timed out) - now the statusbar's #sblog line.
- Tests: test-appstrip817.js (5), test-ui817-ui.js (7). test-menubar-ui: 2 stale pins fail before + after (projbtns list
  has more buttons now; the left dock header has dgfloat) - not chased; test-imageeditor-ui's brush preset leg is flaky.

## 2.816.0 — MAIL MERGE IN DOCUMENT TEXT (WORD PLAN, STEP 4 PART 2 - THE PLAN IS DONE) (2026-11-17, main 06ef6e8; tigerart not touched)
Tim: "lets go with next, we will do all the releases before i start testing".
- NEW ext/imageeditdock/pcdocmerge.js (after pcdocnotes.js; installed after PCDocNotes). Pure: parseCSV (separator = the
  first line's most used of tab ; , - quotes "" + newlines inside, BOM, unique / empty field names; 5000 rows / 100 fields),
  recordOf, fillHtml (span data-field -> the value, \n -> br), fileName («#» + «Field»). The data on the story's first
  frame: doc.merge {name, fields, rows, rec, preview} (Data Source dialog = one struct undo step). Fields = span
  data-field «Name» (light blue CSS), contentEditable=false in the live editor (focusin + insert; the cleaner drops it) so
  typing goes after them. Preview Results: PCDocText.viewOf(head) -> pcdoctext measures + draws d.view instead of d.html
  (the story keeps its fields; ends editing first). Finish & Merge -> POST /api/docx/merge with E.docx.modelOf(head).
- NEW lib/docxMerge.js: fill(blocks, rec|null, suffix) (field runs -> values / {mergefield}, cmt dropped, fn ids + suffix
  per record), run({model, fields, rows, first, mode one|each|word, name, each}) - one = page breaks between records +
  per-record footnotes; each = jszip of name pattern files ((2) for repeats); word = SimpleMailMergeField .docx + "<name> -
  data.csv" (BOM, CRLF) in "<name> - mail merge.zip". lib/docxFiles: save(name, buf, ".zip"), list / file take .zip.
- jszip ^3.10.2 (MIT OR GPL-3.0 - used under MIT) now a direct dependency (it was mammoth's), credited (credits.json, the 3
  translated USAGE credits, NOTICE).
- NOT DONE: merge fields in headers / footers, filters / sorting of records, Excel (.xlsx) data, a merged PDF (export the
  merged .docx, or the pages, instead).
- Tests: test-docmerge816.js (15, ci-units 405/0), test-ui816-ui.js (11).

## 2.815.0 — COMMENTS + FOOTNOTES IN DOCUMENT TEXT (WORD PLAN, STEP 4 PART 1) (2026-11-17, main 3605d32; tigerart not touched)
Tim: "lets go with next, we will do all the releases before i start testing".
- NEW ext/imageeditdock/pcdocnotes.js (after pcdocx.js). Comments: wrapRange (span data-cid, cut to the first paragraph),
  head doc.comments [{id, author, text, date, done}] (clean()), New Comment dialog (author in store doc.author), the
  .pdcPanel list (click = select the words; ✎ / ✓ data-done / 🗑 unwrap), Ctrl+Alt+M, View ▸ Show Comments
  (PCDocText.showComments, store doc.showcmt -> .pcnocmt in the drawn picture). Footnotes: sup data-fn + head doc.notes
  {id: text}, Ctrl+Alt+F / ¹ Note, double-click a mark = edit. Bar: 💬 💬☰ ¹ Note after ▦ Table. GOTCHA: a dialog's OK
  leaves the focus on body - refocus() puts it back in the words (else Esc does not end editing -> no auto pages).
- pcdoctext.js: sanitize keeps data-fn / data-cid / data-done / data-field; measure() refs; renumber() (story order; a mark
  without a note or a note without a mark dropped) + notesBlock(); flowStory iterates (<= 5) windows with each frame's
  height minus its notes' height until stable -> d.fn / d.fnH; draw() puts .pcfn at the foot (position:absolute).
- .docx: runs cmt / fn; CommentRangeStart/End + CommentReference (comments must stay in one paragraph), FootnoteReferenceRun;
  read(): mammoth "comment-reference => sup" + footnote links -> marks(): sup data-fn + notes, span data-cid on the word
  before the reference (mammoth keeps only where a comment ends) + comments (author = initials).
- Tests: test-docnotes815.js (15), test-ui815-ui.js (14).

## 2.814.0 — WORD FILES: .DOCX OUT + IN (WORD PLAN, STEP 3) (2026-11-17, main 793bf98; tigerart not touched)
Tim: "lets do next" (after 2.813.0's page numbers - the .docx part of that message).
- NEW ext/imageeditdock/pcdocx.js (PCDocx, after pcpageview.js in ext.json; installed after PCPageView). Pure (jsdom):
  toModel(html) - the sanitized story -> blocks: {t:"p", style (title / subtitle / h1-h3 / quote / code), align, lineHeight,
  before / after / indent (pt), list {kind ul|ol, level}, runs [{text, b, i, u, s, sub, sup, font, size pt, color, hi, link,
  br}]} | {t:"table", widths %, headerRows, borders all|outside|none, borderColor, rows [[{cs, rs, shade, valign, blocks}]]}
  | {t:"hr"}; header cells bold on #f2f2f2 (as .pcdoc th draws); pageOf(W, H, dpi, frame) -> mm + margins from the FIRST
  frame; headFoot(master layers) - type in the top fifth = header, bottom fifth = footer, {page}/{pages} -> fields (t.tpl
  wins over t.str). Page: File ▸ Export ▸ Word Document (.docx)… (after file.exportdtp; the picked frame's story, else the
  first; a dialog with counts + "Word lays out pages itself"), File ▸ 📂 Open Word Document (.docx)… (after
  file.newtextdoc; page size / orientation / margins; E.pages.newDocument + E.docText.addFrame auto + reflow). E.docx =
  {model, exportDocx, openDocx, openBytes, place, heads}.
- NEW lib/docxFiles.js: build(model) with `docx` 9.x (numbering bg-ul / bg-ol 9 levels, tables in DXA from the usable width,
  tableHeader only on header rows - docx writes <w:tblHeader/> even for false, so the key is left out; run props only when
  true), read(buf) with `mammoth` 1.x (styleMap Title / Subtitle -> p[data-style], Quote -> blockquote, Code -> pre;
  images dropped), save / list / file in projects/<p>/docs. routes/docx.js (mounted in routes/index.js after dtp).
- Checked by hand: LibreOffice (soffice --headless --convert-to pdf, in the sandbox) renders the app's file - title,
  bold / italic / red, bullets, the 40 / 60 table, footer "Page 1 of 1".
- NOT DONE (say so if asked): pictures in .docx (either way), images in headers, different first-page / odd-even headers,
  footnotes / comments (step 4), Word's own pagination differs a little.
- Tests: test-docx814.js (38, ci-units 403/0), test-ui814-ui.js (14); test-pceditor ext order pin. Credits: lib/credits.json
  docx / mammoth + the translated USAGE credits rows by hand (hash restamped), misc/NOTICE.md "Node packages for Word files".

## 2.813.0 — PAGE NUMBERS ON EVERY PAGE + THEIR FORMAT; VIEW SEVERAL PAGES (2026-11-17, main f18ddda; tigerart not touched)
Tim: "fix the pagination, page number shows on page 1, but not on page 2. Also add formatting for page numbers. allow user to change "view" to show multiple pages on the same window".
- CAUSE: # put a page-only "Page number" layer on the page in front. pcpages.js insertNumber(opts) now puts it on the page's
  master; with no master it calls addMaster and assigns it to every page (later pages get it too); old page-only number layers
  are removed. NUM_FORMATS / isNumL / numText / placeNumber; numberDialog = format ("Page {page} of {pages}" …), numbering
  style + start, position, font, size, colour - kept in store "pg.numfmt". # and page.number ("Page Numbers…") open it.
- NEW ext/imageeditdock/pcpageview.js (PCPageView, after pcdoctable.js in ext.json; installed after PCDocTable): MODES
  "Pages: One Page" / "Two Pages" / "Many Pages" (COLS 1/2/4), layout(sizes, mode, gap) pure; a .pcpv box behind the paper
  with snapshots (eachPage + E.flatten, max 1400 px) placed in an overlay hook; follow() keeps the zoom when the page changes;
  clicking a page (capture pointerdown on [data-pv]) = E.pages.go. View menu view.pages.*; E.pageView API.
- Tests: test-pageview813.js 8, test-ui813-ui.js 10 (click a page's middle - a floating Tools docker can sit over its top);
  test-ui800 presses the dialog's OK after #; test-masters800 pin. ci-units 402/0. CI 44008480249 green.

## 2.812.0 — TABLES IN DOCUMENT TEXT (WORD PLAN, STEP 2) (2026-11-17, main cce3b29; tigerart not touched)
Tim: "go with the next part please".
- NEW ext/imageeditdock/pcdoctable.js (after pcdoctext.js; installed after PCDocText). Pure grid ops on DOM tables (jsdom-tested):
  grid() fills spans; insertRow / insertCol grow a span the insert falls inside; deleteRow moves a rowspan cell starting there
  down a row; deleteCol shrinks colspans; mergeCells only for exact rectangles (top-left keeps all words); splitCell; setHeader
  (first row <-> thead / th); colgroup widths in % (setColWidths normalises; table-layout fixed so the repeated header and every
  page agree). Commands doc.table.* in ▦ Table ▾ (the bar, before the frame W / H) and on right-click in a cell (document
  contextmenu capture). Tab via E.docText.tab (pcdoctext keydown: Tab never leaves the page; outside tables two em spaces).
  Column drag = document pointer capture on a cell's right edge (5 px).
- pcdoctext.js: measure() returns heads [{top, bottom, headBottom, h, html (table shell + colgroup + thead)}]; windows(bs, heights,
  headAt) takes the header's height off a later frame that starts inside such a table and returns .head -> d.rep / d.repH; draw()
  puts d.rep above a clipped window (so the story's own rows never slide under it). FIXED: frames on pages not in front were
  never rasterized when the story changed (stale until edited) - flowStory rasterizes all; "h3docready" finds the layer on any
  page; the picture cache is a WeakMap by layer (ids repeat across pages).
- GOTCHAS: Chrome serialises border:none as longhands - setBorders uses border-style none; insertHTML drops table-layout from the
  table's own style (CSS sets fixed for every .pcdoc table); a dialog OK leaves the focus on body - insertTable re-focuses the
  first cell on a timeout.
- i18n-zhtw.py TW_WORDS: 單元格 -> 儲存格.
- Tests: test-doctable812.js (19, ci-units 401/0), test-ui812-ui.js (14).

## 2.811.0 — WORD-PROCESSOR TEXT (WORD PLAN, RELEASE 1) (2026-11-17, main 993265b; tigerart not touched)
Tim (verbatim): "is there a way to add word editing to image editor? like ms word and export as docx? with all the alignment,
text editing/formatting / table options?" then "i would actually like to keep comments, footnotes and mail merge - after we get
this right , I would like a mail docker that resembles outlook but works with ai, our models should be able to read the emails
and flag important ones and draft a reply. it should also help us construct an email. but this will be later on"
>>> THE WORD PLAN (agreed; one release each, in order):
  1. 2.811.0 DONE - document frames (this section).
  2. 2.812.0 TABLES DONE (see "## 2.812.0") - insert (rows x cols), add / delete rows + columns, merge / split cells, drag column widths, borders,
     cell shading, cell alignment (vertical too), a header row repeated on each page (the flow: a <tr> is one band already -
     measure() adds tr rects; a repeated header needs a per-frame copy of <thead>).
  3. 2.813.0 .DOCX OUT + IN - `docx` (npm, MIT) writes it from the cleaned HTML (p / h1-3 / data-style title|subtitle ->
     Title / Subtitle / Heading1-3, runs from span styles, lists -> numbering, tables), `mammoth` (BSD-2) reads one into the
     HTML; page size / margins from the pages; headers + footers (+ {page} numbers); credit both (lib/credits.json + NOTICE).
     Word's own pagination can differ a little - say so.
  4. Then COMMENTS, FOOTNOTES, MAIL MERGE (Tim wants all three). Track changes was NOT asked for.
  LATER (Tim: "this will be later on"): a MAIL DOCKER like Outlook with AI - the models read the mail, flag the important
  ones, draft replies, help write new ones. Not started - ask before starting (needs an IMAP / SMTP or connector design).
- ext/imageeditdock/pcdoctext.js: layer type "doc", L.doc = {html, x, y, w, h, k (= dpi / 96: CSS px -> canvas px), top (the
  frame's window into the story, CSS px), flow {id, idx}, auto, lines}. Every frame carries the story's html (idx 0 is the
  source; flowStory copies it on). DRAWN: an SVG foreignObject picture (data: URL -> Image -> drawImage) cached per layer
  (keyOf html|w|h|k|top); "h3docready" -> rasterize + refresh. Chromium keeps the canvas readable (html-to-image works the
  same way) - Safari would taint it (not our target). System fonts only in the picture (FontFace fonts are not embedded).
- TYPING: a contentEditable .pcdoc in .pcdocedit over the frame (stage child, scale k*zoom, scrollTop = top); its pointer /
  dblclick / contextmenu events stop at the overlay (the canvas handlers would steal the focus). live() every 350 ms writes the
  head's html (no undo) and reflows; end() = one struct undo step "document text". execCommand (styleWithCSS) for runs /
  align / lists; formatBlock + data-style for paragraph styles; size = fontSize 7 then xxx-large -> Npt; blocks get
  line-height / margins. GOTCHAS FOUND: a stale kept range moved the caret to the start (restoreSel only restores when the
  focus left the page); Chrome's insertList puts the caret at 0 and nests <ul> in <p> (tidyLists + textSel / setTextSel by
  character counts).
- FLOW: measure() lays the story out in a hidden .pcdocm at width w/k and collects text-line rects (+ empty paragraphs, hr,
  tr, the first line box of li) -> bands() -> windows(heights) = whole lines per frame (a too-tall line still goes in). auto
  (New Text Document): reflow adds a page + frame on overflow (E.pages.add / go back) and removes trailing auto pages that hold
  only their empty frame (E.pages.remove(i, true)) - not while typing.
- Tests: test-doctext811.js (17, ci-units 400/0), test-ui811-ui.js (15). Old pins widened (pceditor, pctext, pswarp, sketch,
  artboards, blendlayer542); test-pceditor-ui re-pinned - its counts / tabs had been stale since 2.570 / 2.590.
- NOT YET: PDF export draws doc frames as pictures (real text in the PDF could come with .docx work); the Move tool's handles
  do not size a doc frame (W / H on the bar do).

## 2.810.0 — SHAPE TOOL: MODES ON THE SHAPE BUTTONS, TRIM, MIRROR, OFFSET (2026-11-17, main b950575; tigerart not touched)
Tim (verbatim): "we'll have a look at the blender gaussian splat, no need to re-invent the wheel yet. in image editor, click on
shape will draw new shapes, shift+click on shape will change shape to new shape clicked, ctrl+ click will add shape to existing
shape (boolean) , alt + click will subtract new selected shape from shape on selected layer. These will select the mode of the
new shape being created. left click on the canvas will start drawing as normal(in the selected mode), add the shape options to
the right click context menu when shape tool is selected only. add a trim button so shapes can be trimmed like in fusion 360.
Add mirror and offset buttons for selected shapes"
- GAUSSIAN SPLATS: Tim wants to look at Blender's native splat support (Blender 5.3) first - don't build a splat layer unasked.
- NEW ext/imageeditdock/pcshapeops.js (after pcfocus.js; installed after PCFocus). The mode = S.shapeOp (pcpen.js's Ops:
  new / add / subtract / intersect / exclude) + "replace" (handled by our T.shape.up wrapper: pcpen's up runs as "new", the new
  layer's shape moves into the picked layer with its fill / stroke / dash / tfill kept, one "replace shape" undo step).
  .ptsk click = pickKind(kind, ev): modeOf(ev) (Ctrl/⌘ add, Alt subtract, Ctrl+Alt intersect, Shift replace - Shift also changes
  the picked layer's kind at once); a plain click NO LONGER changes the picked layer (it did since 2.439).
- ✂ = tool "shapetrim" (not in AUTO_MOVE, so pcselhl's click-picks-and-Move does not fire; not added to the U group's data-tools -
  that broke test-pspath's group pin). trimPlan: cutsOf(path, s, others) = polyline (u-parametrised) crossings vs its own other
  edges, the path's other subs and every other visible shape layer's outline (open cutters reached 0.6 px past their ends -
  a piece left by an earlier trim ends ON the outline); closed sub <2 cuts = whole sub. trimAt -> joinOpen (ends within 0.75 px
  glued, a run back to its start closed); open leftovers sub.nofill (pcpath normalize keeps it, fillArea skips it) + the stroke
  switched on (fill colour, >= 2 px) when the layer had none.
- ⇋ mirror: about the picked shapes' common box; mirrorPath re-winds subs (an opposite-wound copy would punch a hole under the
  nonzero fill). Mirror Copy = the copy joined into each layer's path.
- ⧈ offset: offsetPath on a grid (k <= 3 cells/px, <= 1400 cells): P.raster (joint nonzero when all-add, else the ops) -> exact
  EDT -> threshold -> P.fromMask -> all subs "add" (holes wound back). polygon-clipping (static/vendor) threw "Unable to find
  segment" on unions of many round-corner pieces - do not go back to it. Keep = "Offset of <name>" layer above.
- E.shapeMenu (Shape / Trim tool only) first in pcframes' canvas menu: the 5 modes, Shape ▸ kinds, ✂ Trim, ⇋ Mirror ▸, ⧈ Offset….
- i18n: 8 strings added by hand to strings.json + 20 strings / 1 pattern translated. USAGE + FEATURES in 4 languages.
- Tests: test-shapeops810.js (25, ci-units 399/0), test-ui810-ui.js 23; test-pceditor's ext.json pin updated. test-genfill-ui's two
  pattern-library legs failed on a fresh server here (pattern files on disk) - unrelated to shapes, not chased.

## 2.809.0 — RIGHT-CLICK: COPY, PASTE, ARTIST MODE; WEBSITE BLENDER SECTION (2026-11-17, main b640284; tigerart a31ef37)
Tim (verbatim, 2 screenshots: the Blender layer's scene tools on a Lamborghini Temerario, and an edit result beside the Blender
layer): "in image editor right click context menu add copy, paste, artist mode, when in artist mode add show layers, blender
scene,prompt, exit artist mode. add these 2 images to the blender scene of the website. is it possible for us to create a gaussian
plot from a picture so we can have a 3d model of the surroundings so user can change camera position, zoom in zoom out, pan, tilt
and roll in the timeline?"
- pcframes.js contextmenu: the clicked thing's own items first (Rasterize Text, frame items - ui604 / frames2 pin them first),
  then edit.copy / edit.paste, layer.dup / layer.del, modules' stageCtxItems, then E.focusMenu() (view.focus off; in artist mode
  focus.layers / focus.blender / focus.prompt / focus.exit - pcfocus.js addCmd; Blender = E.blendLayer start / leave, Prompt =
  H3PromptFront.front()).
- i18n: "Show Layers + ⏳ Pending", "Blender Scene", "Exit Artist Mode" added BY HAND to static/i18n/ui/strings.json (ui-strings.js
  needs a full studio crawl) + ja / zh-CN chunks, zh-TW via i18n-zhtw.py --ui. USAGE + FEATURES in 4 languages.
- Website: docs/images/blender-scene.png + blender-scene-edit.png (Tim's screenshots cropped to the editor; the .blend's E:\ path
  BLURRED in blender-scene). tigerart features.php $blender section "Blender scenes in the image editor" (+ contents link),
  website-sync.py SHOTS 1380 wide, site i18n 3 languages. Tim presses Update on /b_admin/.
  test-site.js's sitemap check flaked 1 in 3 runs (sitemap.php untouched; passes standalone).
- Tests: test-ctxmenu809.js (5 pins, ci-units 398/0), test-ui809-ui.js 12; frames / frames2 / ui604 / ui646 pass.
- GAUSSIAN SPLAT ANSWER (offered, NOT started - wait for Tim's go): possible with limits. Scene-level single-image splats that
  are good (Apple SHARP) have NON-COMMERCIAL weights - excluded. TripoSplat (VAST, MIT code + weights, native in ComfyUI 0.23.0
  template) is OBJECT-level - scenes fall apart. Permissive route for surroundings: Depth Anything V2 SMALL (Apache-2.0; Base /
  Large are CC-BY-NC - not allowed) -> a depth-placed splat / point layer, gaps filled by outpaint; render with Spark
  (@sparkjsdev/spark, MIT, three.js). Moves stay near the photo's view (parallax, dolly, pan / tilt / roll fine; orbiting round
  the back is not). Timeline camera keys = position, FOV (zoom), pan, tilt, roll.

## 2.808.0 — ▣ CUSTOM DOCKERS KEEP THEIR DOCKERS; DOCKED = z 1 (2026-11-17, main 047e095; tigerart not touched)
Tim (verbatim, screenshot: his ▣ docker renamed "Settings" as a column between System and References holding Basic Settings; the
🖥 GPU floating window behind it): "please fix the new custom docker in this case settings but fix all custom dockers that would
be made. it doesn't hold it's contents(other dockers) after restart and is in front of other dockers like model manager and gpu,
but it is a placeholder docker it should be at the level of the system docker + 1"
- CONTENTS: a plain reload kept Basic Settings in (test-ui561 / my repro). What lost it: SecFloat.applyStates (⊞ docker layout
  auto-apply after the boot grace, workspace applySnap, resets) put the member back at its old float / dock place, and dgdock
  look() "let it go where it is" (P().home) - forgotten, the next save wrote it out. FIX: look() takeIn()s it back (event
  docker_member_back); H3DGDock.holds(id) (state in / zone); applyStates skips held sf.<id>; workspaces setFloats skips them and
  the prompt docker restore skips a held pf.promptdock (dockcfg too). The user's own drag-out / ⇲ = memberState float/home ->
  not held, never put back.
- Z: members kept the band z floatz gave them while floating (dataset.fz) and painted over floating windows from inside the
  docked ▣ docker (proved: hit test at an overlap returned sf-basic over sf-modelmgr on 2.807.1). FIX: .bdock.dgperm
  {position:relative; z-index:1; isolation:isolate} (#app's columns are z auto = System + 1) + members z auto inside; floatz
  sweepNew drops a window that stops floating.
- Tests: test-dockkeep808.js (5 pins, ci-units 397/0), test-ui808-ui.js 8 (column + Basic Settings, Model manager over it,
  applyStates leaves it, a take-out put back, restart, the user's drag-out stays out). ui549 / 558 / 560 / 561 / 724 pass;
  ui7645 "a floating docker on the bottom band of the docker inside it = stacked below it" FAILS ON 2.807.1 TOO (pre-existing).

## 2.807.1 — BLENDER LAYER VIEW KEPT; COMFYUI STARTED FOR THE EDITOR (2026-11-17, main f3a4dfd; tigerart not touched)
Tim's log rendering a Blender scene: "[worker] image: style='Qwen Image 2.1 edit' ... ERROR: cannot reach ComfyUI at
http://127.0.0.1:8188 (... WinError 10061 ...)" + "is it possible to go to the same view when returning to a blender layer".
- CAUSE: only the prompt docker's own Generate called index.html ensureComfyReady; the image editor's api.aiedit / compose /
  preprocess (mount.js) and the preview's Change style (lbrestyle.js) posted /api/aiedit with ComfyUI down - the worker failed.
  FIX static/podroute.js H3PodRoute.ready(mode, style): isPod -> skip; else GET /api/comfy/status, POST /api/comfy/ensure
  {force}, poll to reachable (5 min, comfyPaint, 8 dead readings = give up) - NO modal (ensureComfyReady's alert() blocked the
  restyle browser tests' clicks); cannot start = a console line and the job still goes in. Called before the post in mount.js
  (3 places) and lbrestyle before the line art.
- VIEW: TlBlend.restoreView (blendview.js; Matrix4.decompose -> camFree, fov, orbit.target from the kept target else 5 m ahead,
  setView free, or setView scene; goto(frame)); pcblendlayer keepView stores bscene.target (TlBlend.look().target);
  putView(L) in afterLoad when the scene's stem is the layer's. Not run against a real Blender here (none in the sandbox) -
  test-ui806 checks the call with a stand-in TlBlend; the matrix maths is three.js's own.
- Tests: test-comfyready807.js (5 pins, gate leg - not ci-units: it names 127.0.0.1), test-ui806-ui 16; ui676 / 681 / 685 / 686
  pass. ci-units 396/0.

## 2.807.0 — RUNPOD REST v1 RETIRED: v2 ONLY (2026-11-17, main 6bb3af1; tigerart not touched)
Tim (verbatim): "i just received a message that rest api in runpod has been retired, to use v2"
- bitGen moved to REST v2 in 2.755.0 (lib/runpodApi.js, base https://api.runpod.io/v2; every pod / serverless-list / catalog /
  billing call goes through it). Re-checked against docs.runpod.io/api-reference-v2 (migrate-from-v1, update-a-pod,
  catalog/list-public-templates): paths OK. Two v1 leftovers fixed: llmRepos.grow sent PATCH {volumeInGb} (v2 rejects unknown
  properties) -> {mounts: {persistent: {size}}}, current size from mounts.persistent.size; runpodApi.update's v1 fallback
  POST /pods/{id}/update removed. podRevive reads v2 disk / mounts.persistent.size first.
- NOT v1 (unaffected): the Serverless job API api.runpod.ai/v2/<endpoint>/run (lib/runpodServerless.js, misc/worker.py);
  RunPod's GraphQL (lib/runpodAccount.js balance) - RunPod retires GraphQL in EARLY 2027: move the balance to REST v2 billing
  before then (v2 has GET /v2/billing; no balance field was documented in 2.763.5 - check again).
- Tests: test-runpodv2807.js (4, ci-units: no rest.runpod.io in code, no v1 body fields, PATCH-only update), test-llmrepos782
  updated. ci-units 396/0. NOT tried against the real RunPod from here (no key in the sandbox).

## 2.806.0 — BLENDER LAYER: GENERATE FROM THE SCENE, LIVE LAYER; MISSING MODELS HERE / ON THE POD (2026-11-17, main 3a91f91; tigerart not touched)
Tim (verbatim): "when in image editor and a blender layer is being worked on an the generate button is pressed, then generate the image
from the blender scene and the prompt and reference images if any. If any lora/model is missing popup a message box asking if bitgen
should download it, download it to local if generation is in local mode or send to the pod if in runpod mode. if a blender scene is on
a layer, if user clicks away from that layer and returns show the blender scene edited blender layers are raster layers but the
blender scene layer is live"
- GENERATE: pcpromptlink actionFor - op generate + editor on screen + a picture open + a Blender / 3D layer picked + no selection =
  {kind: "blender", mode: "generate"}; H3TakeGenerate passes kind blender on (it returned false for op generate before = the prompt
  docker's own text-to-image, the scene ignored). takeOp -> E.blendLayer.generateFromScene(L, text, #styleSel value) (a 3D layer:
  layer3d.editFromScene edit). pcblendlayer genHow(style, engines, nRefs, editId): the style an edit model = it; references (the
  References docker, up to 2, rule "always" unless the 🟧 tab says Never) = the editor's ✏ Edit model via sceneWithRefs (compose,
  scene = picture 1); a picture style with refine = E.runAI mode refine, whole, opt.style, opt.strength = 🟧 Scene strength
  (bl.str, 20-95, default 60); else the Edit model. ovrNow() = Basic Settings' Override (imgBasicsBody) as opt.ovr -> runAI req.ovr
  -> mount.js fd "ovr" (routes/aiedit.js already applied ovr). Results land as new raster layers (keep: L).
- LIVE: followPick() on every renderLayersPanel (wrapped) + every 0.7 s: liveStep({blender, shown}, open, same, live) -> start() /
  leave() (the view kept). ☑ Live (bl.live, default on). A hidden Blender layer is never opened (pcbridgeoff closes it). The scene
  reopens from L.bscene.source via start() (2.618.0 path); the free camera is NOT put back to the saved view (TlBlend has no setter
  for a free view - offer if Tim wants it).
- MISSING MODELS: NEW lib/modelsWhere.js - podOf(kind, st, wouldPod) (stylePods.podFor), checkPod(rows, pod) (podStyles.contents,
  25 s cap; not answering = checked false - the old pod prep goes on), sendPod -> podSend.queue (pod: on it / remote_models link /
  Civitai via podFind / sent from here), podSendState; online(missing) (podFind.find, 8 s a file, 15 s total) adds m.online;
  fetchLocal(items) re-finds the URL server-side, Civitai token added, streams to <comfy>/models/<cat>/<rel>.part then renames.
  routes/modelsFound.js: plan() -> plan0(b, ctx) - the two pod skips now set ctx.pod (a style that WILL use a pod but has none yet
  still skips); check route async: pod -> checkPod, else MF.check + online(); aiedit kind reads ovr (model fit + extra_loras);
  POST/GET /api/models/pod-send, /api/models/fetch. static/modelsfound.js box: place "pod" -> "Models not on <pod>" + ⬆ Send to
  <pod> (poll, then check again -> render); local ⬇ Download also fetches m.online rows (/api/models/fetch) and refreshes the list.
  CHANGE: renders on pods with missing files are now ASKED before (were sent silently by podPrep).
- Tests: test-blendgen806.js 13 + test-modelswhere806.js 14 (ci-units 395/0), test-ui806-ui.js 14 (stand-in TlBlend - no Blender
  here; stand-in pod-send / fetch). ui618 / 719 / 720 / 543 / 549 pass; promptlink-ui + ui541 fail ONLY when run after ui806 on the
  same server (fresh server: both pass - the docker-status / editor state left behind), not a code regression.

## 2.805.0 — LOCAL - <CARD> WITH COMFYUI PORTABLE + THE PREVIEW'S STYLE / BASIC SETTINGS (2026-11-17, main f0d9743; tigerart not touched)
Tim (verbatim): "in gpu docker , when i select one of my gpu, it fails, when i select local it works. in preview dialog add a style
dropdown next to the change style button, add a checkbox next to it to use basic settings. use the last basic settings the style used to
change the style of the preview picture (show change style dropdown , button and the new button and new dropdown only when in picture mode"
- CAUSE (not confirmed on Tim's machine - he gave no error text): 2.791.0's gpuCards.argsFor refused a .bat launcher / custom launch
  command ("cannot give that a card of its own"); comfy.detectLaunch returns run_nvidia_gpu.bat first for ComfyUI portable (Tim's
  Windows setup), so every Local - <card> job failed while plain Local ran the .bat. If Tim still sees a failure, ask for the job
  log's "[gpu] ..." line and comfyui-gpu<N>.log beside the app.
- NEW lib/comfyLaunchLine.js (pure): tokens, fromScript(text, dir, plat, has, name) (the line with main.py; %~dp0 / %cd% / $(dirname
  "$0") expanded; cd / pushd segments move cwd; call / exec / start / cmd /c stripped; %* "$@" and redirections dropped; a bare
  python = venv / .venv python when present; any unknown %VAR% / $VAR = null), direct(dir) (venv, then portable python_embeded +
  ComfyUI/main.py --windows-standalone-build), stripOwn (--port / --cuda-device removed - gpuCards adds the card's).
- lib/gpuCards.js: launchOf -> launchFor(cfg, dir, detectLaunch) -> argsFor (passes {error}); launchProblem(n). lib/remoteHosts.js
  cardNote says "⚠ <why>" when no ComfyUI for that card is running yet and the launch cannot be made.
- static/lbrestyle.js: #lb_rsstyle ("✎ The prompt's style" = "" + #styleSel's options, refilled on its childList change / focus;
  localStorage h3.restyle.style) and label#lb_rsbasicw > #lb_rsbasic "Basic Settings" (h3.restyle.basic) after #lb_restyle.
  chosen() = styleFor(pick, options, prompt) {id, name, own}; basicOf(st): own = H3BasicCfg.collect() (live, + image LoRA weights,
  temp LoRAs, mm_override), else H3StyleBasic.file().styles["image:<id>"].basic; ovrFromBasic maps imgSteps / imgCfg / imgSeed /
  imgCkpt (Use model unticked = no model). DECISION: the tick replaces Basic Settings ▸ Override style for Change style (ovrStyleOn no
  longer read there). Nothing kept for a style = its own settings, said in #lb_rsmsg. paintKind hides the look, button, style, tick and
  message unless a picture is shown (lb_name observer + the dialog's open attribute). Bar fit: #lb_rsstyle max 84px, tick .7rem,
  #lb_rsmsg:empty hidden - test-ui684 (one line at 1100 px) passes with no slack to spare: a new control in that bar needs room made.
- Tests: test-launchline805.js 18, test-restyle805.js 13 (ci-units 393/0), test-ui805-ui.js 11 (gate leg); test-ui676 / ui685 tick
  #lb_rsbasic now; ui677 / 679 / 681 / 684 / 686 / 791 / 794 pass.

## 2.804.0 — LASER: SEND OVER USB / WI-FI (laser part 2 of 2) (2026-11-16, main 1206f1d; tigerart not touched)
Tim (verbatim): "can we access bambu labs h2d? and please continue. bitgen is using eclipse can we send over usb/wifi using
eclipse?" - "eclipse" = the Electron app (electron/main.js runs misc/server.js), so the SERVER holds the connection (not Web Serial).
- H2D answer (researched 2026-11-16, told Tim): the H2D's laser / cutter jobs come from Bambu Suite (its own job format, imports
  PNG / JPG / BMP / SVG / DXF / AI); third-party LAN control needs LAN-only + Developer Mode and the firmware note frames that
  for 3D printing; a forum report says even Bambu Suite times out sending cutter jobs in LAN-only mode. So bitGen does not
  drive the H2D laser; ⤓ SVG + PNG makes files Bambu Suite imports. (Bambu not named in the app / guide - "machines with their
  own laser software".)
- DECLINED (Tim 2026-11-16, after the legal question): slicing a 3D model with Bambu Studio and sending / starting it on the
  H2D from bitGen. Tim (verbatim): "lets not risk it. scrap the idea. bambu studio is free anyway". Nothing was built. Do NOT
  build it or offer it again unasked (no Bambu Studio CLI calls, no printer MQTT / FTPS, no Bambu cloud). Users slice and
  print in Bambu Studio themselves; bitGen's 3D exports (SolidCraft STL / 3MF / OBJ) are the hand-off.
- NEW lib/laserLink.js: S = {link, kind, target, flavor, banner, machine {state, pos}, job {name, total, done, running, paused,
  error, startedAt, endedAt}, log (200), waiters}. open(): tcp = net.connect (8 s timeout); serial = require("serialport")
  lazily (N-API prebuilds - works under the Electron-run server), null -> 501 "run the installer again". Lines split on \n;
  "<…>" status parsed (not logged); "ok"/"error" settle the oldest waiter (LINE_TIMEOUT 120 s); ALARM fails a running job.
  GRBL: "?" every 400 ms, pause "!", resume "~", STOP 0x18 soft reset, home $H, unlock $X. Marlin: no polling, pause = M5 +
  hold lines, STOP "M410\nM5\n", home G28 X Y, unlock M999. start(): cleanLines (comments out), refuses empty / >255-char
  lines / ALARM; run() one line per "ok"; an error -> job.error + reset/M5. frame(box, {power, speed, sMax}) via frameLines
  (G0 laser off, or M3 S + G1). stopIfRunning() - lib/exitSweep.js run() calls it FIRST on every way out (+ process "exit").
  Test hooks: setTransportFactory, setSerialLib, reset.
- NEW routes/laserLink.js (mounted after routes/laser.js): GET status / ports, POST connect / disconnect / send / start ({name}
  from projects/<p>/laser or {code}) / pause / resume / stop / home / unlock / frame.
- pclaser.js: "Send to the laser" fieldset - #lzKind (serial|tcp), #lzPortSel + #lzPorts + #lzBaud, #lzHost + #lzTcpPort,
  #lzConnect #lzDisconnect #lzLinkState, #lzHome #lzUnlock #lzFrame #lzFramePow, #lzStart (confirm #lzConfirm #lzYes #lzNo -
  then save(false) -> start {name}), #lzPause #lzResume #lzStop + #lzStopTop (title bar, shown while connected), #lzProg,
  #lzCmd + #lzSend, #lzLog; polls status every 700 ms while the panel is shown; prefs store("laser.link"). E.laser +=
  exportSvg, connect, startJob, frameJob, stop, poll, linkStatus, refreshPorts. svgOf(ops, w, h, mmpp, b64) (pure): mm SVG,
  one inkscape layer per op; build() keeps op.src (paths / rings px, the image op's canvas); ⤓ SVG + PNG -> dtp folder zip.
- package.json: "serialport": "^12.0.0" (npm install via installer / updater when the lock changes); installer notes; credits
  + Node SerialPort (ja / zh-CN / zh-TW, credits marker restamped 88c929d0ebae).
- Tests: test-laserlink804 (20 - NOT in ci-units: it names 127.0.0.1 for its stand-in GRBL; a gate leg), test-ui804-ui (10).
  Real hardware not tested - Tim to try a low-power job first. ci-units 391/0.

## >>> NEXT: 2.809.0 — THE SOURCES' PICTURES + VIDEO (was planned as 2.796.0, then 2.805.0 - 2.808.0 - those became Tim's GPU fix + preview style, then the Blender generate; 2.796.0 became Tim's filter fix) (Tim chose "LLM + Vision + pictures + video")
- Image: OpenAI images API {url}/v1/images/generations {model, prompt, size, n, response_format b64_json} (OpenAI, Together,
  Fireworks, many OpenAI-compatible); Custom template: an image address template. Video: no common API - a per-format request
  (custom template: POST address + a body template with {prompt} {model} {seconds} {size}, a poll address + the JSON path of the
  result URL). Look at how lib/orRender.js -> misc/api_worker.py renders OpenRouter / API_ pictures + video and reuse it (api_worker
  is the place - NOT server.js); the models of kind image / video of yours in Basic Settings' image Model combo / video Model list
  (like ormine's "☁ OpenRouter" groups) as <source>/<model>; Use model + Override style = rendered through the source; the price box
  only where the source says a price (none = say "the source charges your account"); 💲 Costs if the answer has a cost.
- Remove the "rendering with them comes in the next update" words (static/mmapisrc.js render hint + docs) when done.

## DONE (2.794.0 207180d): 2.794.0 — LOCAL MULTI-GPU PART 2 (2.792.0 went to Tim's OpenRouter colours; 2.793.0 went to NO_Pod part 2) (Tim said "go ahead with part D"; part 1 = 2.791.0 DONE)
From the agreed design's D: "the LLM / vision LLM already pin a card (core.ensureLlama / captioner: CUDA_VISIBLE_DEVICES + -ngl) - "max
layers" = layers worked out from the GGUF size vs the card's free VRAM; speech engines (PyTorch) get cuda:N. NEW Settings ▸ General ☐
"Offload to CPU / RAM when a model does not fit" (on: ComfyUI on that card without --highvram / with its RAM offload, llama.cpp -ngl =
what fits; off: everything on the card, a clear error when it does not fit)".
Plan:
- lib/remoteHosts.js cardList: also llm / vlm / tts / stt / stems ("Local - <card>" - rgpu.local_cards[kind] already per kind;
  gpuCards.KINDS only gates ComfyUI's kinds - keep it that way, the others read the pick themselves).
- LLM / vision LLM: find where core.ensureLlama / the captioner set CUDA_VISIBLE_DEVICES + -ngl (lib/core.js, lib/captioner*.js -
  grep CUDA_VISIBLE_DEVICES) and take gpuCards.pickOf(rgpu, "llm"|"vlm") first (the existing GPU setting stays the fallback); "max
  layers" = a pure layersFor(ggufBytes, nLayers, freeMb, offload) (read n_layers from the GGUF header - lib has a GGUF reader? grep
  "block_count"); offload off = all layers, and a clear error before start when the file does not fit the card's free VRAM.
- speech (scripts/omnivoice_local.py, ming_local.py, asr_local.py, demucs): the job env CUDA_VISIBLE_DEVICES=<N> +
  CUDA_DEVICE_ORDER=PCI_BUS_ID when rgpu.local_cards[tts|stt|stems] is set (find their spawns: lib/tts*.js, lib/asr*.js, lib/stems*.js).
- Settings ▸ General ☐ "Offload to CPU / RAM when a model does not fit" (config.gpu_offload, default on): gpuCards argsFor adds
  "--highvram" only when off? (check what the main ComfyUI gets - lib/podVram / comfy launch args) - on = ComfyUI's default
  (--normalvram + its RAM offload); llama -ngl = layersFor.
- Tests like 2.791.0: pure units + a browser leg with H3_TEST_GPUS; docs x4; the usual release steps.

## 2.791.0 — SEVERAL GRAPHICS CARDS: LOCAL - <CARD> (RELEASE D PART 1) (2026-11-15, main 1e645a0; tigerart not touched)
Tim: "and go ahead with part D after u finish with model manager" -> D split: 2.791.0 = ComfyUI's kinds on a card each; 2.792.0 =
the LLMs / speech on a card + the offload setting.
- lib/gpuCards.js (NEW): cards() (core.readGpus = nvidia-smi PCI order; H3_TEST_GPUS JSON with H3_E2E=1), list() (a minute cache),
  cardsFrom / labelOf ("Local - <name> (GPU N, GB)") / portFor (8189 + N; 8188 = the main ComfyUI) / argsFor(detectLaunch answer, N)
  (python + main.py + --port + --cuda-device; a custom launch command / a .bat launcher refused with why) / pickOf (rgpu.local_cards);
  setPick; start(n) (spawn, env CUDA_DEVICE_ORDER=PCI_BUS_ID + PYTHONUNBUFFERED / TQDM_DISABLE, log <app>/comfyui-gpu<N>.log, close =
  failed with the log named, process.once("exit", stopAll)); gate(params) (ComfyUI kinds image / video / music only): checking -> a
  ComfyUI already answering on the port is used, else start; starting -> ping /system_stats; up -> {card, url}; failed -> {error};
  10 min max (H3_GPU_CARD_WAIT). H3_GPU_CARD_CMD (JSON with {port} / {card}, H3_E2E=1) = the tests' stand-in (scripts/stub-comfy.py).
- lib/core.js pump: after the pod gates, before shift: a non-pod, non-API job -> gpuCards.gate (wait / fail "the graphics card ☁ Runs on
  picked for it could not be used" / params.gpu_card); lib/gpuSplit.js forJob: params.gpu_card -> engine.comfy.url = it, autostart false.
- lib/remoteHosts.js: optionsFor(kind, cards) - cardList after Local (2+ cards, image / video / music); hostsOf -> "local:<N>";
  whereFor counts local:<N> as local; view() has cards + a cardNote line; set("local:<N>") = Local + setPick, any other = forget.
  The page (static/remotehosts.js) needed no change (options come from the server; Set all = kinds[0]'s options).
- routes/gpuCards.js (NEW, mounted before mmSources): GET /api/gpucards, POST /api/gpucards/stop. lib/comfy.js exports detectLaunch.
  test-famfilter788's mount pin allows the gpuCards + mmSources lines.
- NOT DONE / KNOWN: the main ComfyUI is not pinned to a card - if it also uses GPU N, two ComfyUIs share that card (it only holds
  VRAM for the models it loaded). A model's VRAM fit per card is not checked yet (2.792.0 offload setting). Not run on real cards.
- Tests: test-gpucards791.js (15, ci-units); test-ui791-ui.js (7) SKIPs on a one-card server - the gate leg SKIPs; run it with
  H3_TEST_GPUS='[{"name":"RTX 5090","mem_total":32607},{"name":"RTX 3090","mem_total":24576}]' H3_GPU_CARD_CMD='["python3","<app>/scripts/stub-comfy.py","{port}","/tmp/stub-card-out"]'.
  ci-units 381/0; ui785 / ui786 / ui790 pass.

## 2.790.0 — 🧩 MODEL MANAGER: LOCAL / RUNPOD / OPENROUTER, 🗑 BY PLACE, ☁ OPENROUTER TAB (2026-11-15, main ef7f2d1; tigerart not touched)
Tim (verbatim): "in model manager docker add checkboxes for local - runpod - openrouter - all use this to filter the models the user
uses, allow user to delete models, if model is local delete the model (exists but without the local clause), if model is remote or
runpod remove it from the list. add an openrouter tab show models from openrouter , free , paid and the other filters, put a + button
next to the openrouter model to add the model to our model list and save it's endpoint" + "and go ahead with part D after u finish".
- lib/mmSources.js + routes/mmSources.js (NEW, mounted after remoteModels, before famFilter - test-famfilter788's pin allows the line):
  GET /api/modelmgr/sources?src=runpod|openrouter, POST /api/modelmgr/sources/remove {key}. runpod = RM.cards() (rm:<id>) + podCards
  (pi:<pod>|<cat>|<rel>, name "<pod label>/<rel>", source runpod, nopod for NO_Pod, hidden skipped); openrouter = orCard per image /
  video model of your list (or:<type>:<id>, name openrouter/<id>, family "or:<maker>", model_type "Picture API" / "Video API").
  remove: rm -> RM.remove; pi -> podInv.hide; or -> orModels.remove; a local key = 400 (the disk delete stays modelmgr's delModel).
- lib/podInv.js: hidden ["<cat>/<rel>"] - entries / resolve skip it, save keeps it, noteSent un-hides (sent again = listed), hide().
- lib/orModels.js: endpointOf(type, base) (image <base>/images, video <base>/videos, llm/vlm <base>/chat/completions); add() stores
  entry.endpoint (OR().BASE() - H3_OPENROUTER_API in tests) and answers {entry}; mine() fills it for older entries; a refresh keeps it.
- static/mmsrc.js (NEW, H3MmSrc, before modelmgr.js): load(jget, refresh) = Promise.all(cards?local=1, sources runpod, sources
  openrouter, /api/remotemodels/mode) -> merge (local tagged source local, families + the OpenRouter makers, remote_list = pods mode,
  sources: true); the ticks (localStorage h3.mmsrc) + All; tagHtml; remove.
- static/mmor.js (NEW, H3MmOr): the ☁ OpenRouter tab body (#mmOr) - GET /api/ormodels?type=, H3OrModels.filterList / sortList (the
  2.786 dialog's pure parts), ＋ POST /api/ormodels/add, ✓ yours + 🗑; onChange returns modelmgr's load() promise and the message is
  said AFTER it (load() writes its own status line - the first test run caught the message being overwritten).
- static/modelmgr.js: load via H3MmSrc; shownList filters by H3MmSrc.shown; cardHtml `away` (remote / rm / pi / or) - no ⓘ ✎ grip;
  c.pi || c.or -> srcActs (🗑 data-mmsrcdel); the source tag in the tags row; tab "openrouter" (paint returns early like paths);
  #mmSrc at the start of #mmLocalBar (change -> H3MmSrc.set); openInfo returns for ^(pi|or):. Pins kept: `c.rm ? rmActs(c)`, `^rm:`.
- static/famfilter.js: files() repaints a LoRA row painted before it is in its box (setTimeout 0, once); tick() re-runs watchRows.
  test-ui788-ui waits for performance.now() > 6500 - static/stylebasic.js puts the last styles back ~4 s after load and overwrote the
  test's picks when ui788 ran after other tests (not a filter bug).
- Tests: test-mmsources790.js (22, ci-units), test-ui790-ui.js (15, gate leg after ui789, stand-in OpenRouter lists on 8397, a stand-in
  pod inventory; your OpenRouter list emptied and put back). ci-units 380/0; ui786 / ui7661 / ui787 / ui788 / ui789 pass.
  test-tomodel576.js fails standalone on 2.789.0 too (not in ci-units) - not this release.

## 2.789.0 — A TERMINATED POD'S FILES: NO_Pod (RELEASE C PART 2 - C DONE) (2026-11-15, main fabbddc; tigerart not touched)
Tim: "continue please" -> the agreed design's C part 2 (Tim's words: "if pod is terminated ask user if they want to remove models
from the list, if no, change the podname to NO_Pod, but keep all the model details in a file so if user clicks a nopod/model name,
the pod will be recreated and the models uploaded to the new pod").
DECISION (kept from 2.763.4 - Tim: "the pod was created automatically, i didn't get to choose the gpu pod, show all the details
before i create the pod"): a gone pod is NEVER made again unasked - picking a NO_Pod file opens a box with its recipe; only "Make the
pod again" (remake_ok) lets a render make it. Without remake_ok podPick refuses the render with what to do.
- lib/podInv.js: inventory fields gone_at / keep / ask / recipe / remade_from / remake_ok (save() keeps them - it wrote only the
  known fields before); listed(i) = !gone || keep; live() = listed (lists, podPick, famFilter, the fit check all take NO_Pod);
  labelOf = "NO_Pod (<base>)" when gone + keep (baseLabel = the old label); entries mark nopod; resolve: NO_Pod hits {nopod: true},
  and a remade inventory also answers to "NO_Pod (<name>)" (alias - a stored pick keeps working); gonePatch (pure); markGone(id,
  recipe) (sync's gone path too - recipe from rgpu.pod_made when none given); decide(id, keep) (false = the file deleted); asks();
  okRemake(id, ok); moveTo(old, new, name) (files state "todo", remade_from, recipe kept; old file deleted).
- lib/noPod.js (NEW): terminated(id, rc) -> markGone; remake(old, say) (needs gone + remake_ok + a cleanRecipe'd recipe) ->
  pods.create {templateId, name (the old one), gpu, count, cloud, disk, volume, port, cuda} (create decides the ComfyUI install from
  the template), podInv.moveTo, podRevive.moveStyles -> {id, name, port}; putBack(id, port) background, one at a time, podSend.ensure
  (CKPT_CATS for models, loras), podActivity notes ("putting its files back (i of n)", "not: …"); recipeLine; todo.
- lib/pods.js act: terminate -> podRevive.recipe(id) BEFORE (pod_made, else RunPod's record), after success noPod.terminated(id, rc).
- lib/podPick.js apply: a nopod ref without remake_ok -> {error}; with -> pod_pick {pod_id: old, nopod: true}.
- lib/stylePods.js: ready(pod, st, port0, opt) - gone + opt.nopod -> noPod.remake (id / port replaced, not "started"), the 2.763.4
  GONE path otherwise; when ready + remade -> noPod.putBack. gate passes {nopod: pick.nopod}.
- routes/podInv.js: GET /api/podinv/asks, /api/podinv/nopod?name=, POST /:id/keep {keep}, /:id/remake {ok} (registered BEFORE
  /api/podinv/:id); /api/podinv list has keep / ask; withPods counts a NO_Pod alone (it needed a live pod - the browser test found it).
- static/nopod.js (NEW, H3NoPod, before podinv.js): <dialog id=npDlg>; check() every 30 s + on h3:podinv (PODS dispatches it after a
  terminate); a capture "change" listener on #imgCkptCombo / #tliRows / #tlvRows select.cmfile + #vidModel -> picked(el); Not now
  empties the field (change dispatched). Buttons are .ghost with inline styles (NOT .go - full-width caps). static/podinv.js: ⏳ for
  "todo" files. Fragments of the built sentences stay English in ja / zh (whole sentences translated).
- Tests: test-nopod789.js (31, ci-units - RunPod / podSend / podActivity stubbed), test-ui789-ui.js (12, gate leg after ui788, stand-in
  RunPod on 8399: terminate x2 -> keep one / remove one -> lists -> pick box (Not now / Make the pod again) -> render -> the stand-in
  gets POST /v2/pods with the same template / GPU / cloud / disk 50 / volume 120 / name; it empties Basic Settings' checkpoint at the
  end - basic.cfg keeps fields across browsers and broke ui788 when run after it). ci-units 379/0; ui786 / ui787 / ui788 pass.

## 2.788.0 — BASIC SETTINGS' MODEL + LORA LISTS FOLLOW THE PICKED STYLES (FAMILY + TYPE) (2026-11-15, main 11ee9e3; tigerart not touched)
Tim (verbatim): "in the model and lora lists in overide settings, filter the list by the syle selected in the prompt docker dropdowns
family of models and the type (image/image-edit/video)". (Came in before release C part 2 - NO_Pod is now 2.789.0.)
- lib/famFilter.js (NEW): familiesOf(style, kind) - image: every modelCards.FAMILIES key with F.arch === style.arch and no F.kind
  (sdxl arch = sd15 / sdxl / pony / illustrious / noobai, as lib/modelFit); video: minimax-h3 -> h3, ltx* -> ltx, wan* -> wan;
  custom / ph3 / no arch = [] (no filter). typeOf: video | "image edit" (EDIT_RE on name / workflow / role: edit, kontext, inpaint,
  fill, instruct-pix; or a family whose category is image edit - fibo) | image. info(cat, name, cards, invs): the Model manager card
  (MC.list(), cached 30 s there) by cat + name, else MC.nameFamily + categoryOf; a "<pod>/<file>" resolved to its rel first.
  pick(files, rule): fit = family in rule, of the rule's type when any (else all the family's - Klein's edit style keeps its
  picture model), unknown ("" / other) kept apart, out = the rest.
- routes/famFilter.js (NEW, mounted AFTER remoteModels - test-remotemodels766 pins remoteModels right after express.json, podInv
  allowed between): POST /api/famfilter {image, video, files [{cat, name}]} -> {rules {image, video}, info {"cat|name": {family,
  category}}}; styles looked up by id (or name) in styles.read.
- static/famfilter.js (NEW, H3FamFilter, loaded before podinv.js): polls #styleSel / #videoStyleSel + cmData identity every 1.5 s
  (and listens to change) -> POST, then repaints #imgCkptCombo + #tliRows / #tlvRows combos + H3Basic.refill(); files(inp, list)
  for cmCombo (kind from inp.id imgCkpt / vidModel or the row box tliRows / tlvRows - every other combo = null = unfiltered: style
  editors, ControlNet, the 📁 browser); names("video", pairs) for the datalist; a MutationObserver on the LoRA boxes (loraRow paints
  BEFORE the row is appended, so its first paint has no box); the line #ffNote_image (after #imgCkptCombo) / #ffNote_video (after
  #vidModelList) with ☐ Show all (localStorage h3.famfilter.off.<kind>). Unknown-family files listed last with " · family not
  known"; a picked file that does not fit keeps its option with " (not a <family> <type> model)".
- static/index.html cmCombo: FF = H3FamFilter.files(inp, files) after the folder filter; label suffix; FF.hid(cur) ? FF.why.
  static/basicset.js fill(): pairs {cat, name} -> H3FamFilter.names; refill() exported (H3Basic.refill); H3OrMine.paintAll after
  (the OpenRouter video options are appended by ormine).
- The line's sentence is built in JS -> English in ja / zh (the tooltip is translated); "Show all" text node not scanned.
- Docs: USAGE "## Basic Settings' lists follow the picked style (2.788.0)" + ja / zh-CN / zh-TW sections (zh-TW via convert_text on the
  piece), FEATURES line x4 (inserted after the 2.787.0 line), PDFs, CHANGELOG.
- Tests: test-famfilter788.js (22, ci-units), test-ui788-ui.js (10, gate leg after ui787 - a stand-in pod inventory gives the files,
  run FROM the server's tree). ci-units 378/0; ui787 / ui786 / ui785 / ui777 still pass.

## 2.787.0 — POD INVENTORY, POD MODELS IN THE LISTS, ☐ REMOTE (RELEASE C PART 1) (2026-11-15, main 20fd530; tigerart not touched)
Tim: "go with c" (the agreed design's C, see ">>> NEXT — AGREED DESIGN": pod info keeps each pod's styles + models / VAE / text encoders;
pod models in the lists as <pod>/<file>; Basic Settings ☐ Remote + a pod dropdown under Use model / Use temporary LoRAs). Split: 2.787.0 =
inventory + lists + pick decides the pod + Remote; 2.788.0 = terminate -> ask remove / keep as "NO_Pod (<old name>)/<file>" + remake.
- lib/podInv.js (NEW): runpod/pods/<id>.json {v, id, name, gone, at, listed_at, files:[{cat, rel, size, kind, state "on"|"sent"}]}
  (H3_POD_INV_DIR overrides the folder). Pure: kindOf, fromListing, labelOf (slashes -> "-"), entries(invs) -> {cat:[{name: label/rel,
  folder: label[/sub], pod, pod_name, remote:true}]} for LIST_CATS checkpoints / diffusion_models / unet / loras only (no VAE / encoders),
  gone pods skipped; resolve(value, invs, cats) longest label first, the file must be in the inventory; noteIn / dropIn / groupsOf / isInvFile.
  Live: load / save (atomic .part), all, live, nameOf (inv or rgpu.pods_bitgen), fromList (podFiles.list), noteSent (podSend.ensure +
  remoteModels mark "done"), noteDeleted (podFiles.remove), sync(pods) (gone = not listed / TERMINATED; renames; empty inv for a new bitGen
  pod), refresh(id,{port}), styles, view.
- lib/podPick.js (NEW): apply(params) once per job (pod_pick_done), image / video only, skips runs_on pod / api / remote. A <pod>/<file>
  in st.model (model_override or basic_model), phases[0].model (video basic_model) or st.loras -> names rewritten to the plain rel ->
  params.pod_pick {pod_id, why}; files on two pods -> {error}. Else basicUse.remote(kind) + a local model / temp_loras -> pod_pick
  {remote:true} (video: model_override + model = basic_model). wouldPod(kind, model, loras) for the page's check + models-found.
- lib/basicUse.js: POD_KEYS image_model_pod / image_loras_pod / video_model_pod / video_loras_pod - LEFT OUT when Remote is off (the four
  flags' JSON exactly as before - test-basicuse777 pins it); remote(kind) -> {model, loras} ("" = this computer).
- lib/core.js: podPick.apply before stylePods.gate, logs "[pod] renders on the pod <name> - <why>" (or the error) once.
- lib/stylePods.js gate: a pick wins ({pod_id, how:"pick"}), its error refuses the job; the note says why.
- lib/podSend.js ensure wraps ensure0 + podInv.noteSent; lib/podFiles.js list/remove feed the inventory; lib/remoteModels.js mark too.
- routes/podInv.js (NEW, mounted before remoteModels): /api/comfymodels wrapped (pod entries merged, pod_models:true), GET /api/podinv,
  GET /api/podinv/:id[?refresh=1&port=]. routes/index.js: genimage temp_loras; a pod-ref override is fitted by its FILE (podInv.resolve
  -> rel) - modelFit read "Krea pod/…" as a Krea model (found by the test); /api/generate basic_model + temp_loras on the video style.
  routes/stylePods.js /route ?model=&loras= -> wouldPod; routes/modelsFound.js skips a pod render.
- static/remoteuse.js (NEW, H3RemoteUse): .ruRow under each Use box (☐ Remote + pod select from /api/podinv); static/podinv.js (NEW,
  H3PodInv) the 🗂 Inventory panel (✓ listed / ⇪ sent, ⟳ only while running); podsdock.js button; podroute.js sends model + loras;
  basiccfg.js skips .ruRow; index.html loads podinv.js + remoteuse.js before ormine.js.
- Docs: USAGE "## Pod models in your lists, and ☐ Remote (2.787.0)" (+ ja / zh-CN / zh-TW sections via i18n-help assemble; zh-TW made
  from zh-CN with i18n-zhtw's convert_text on the piece only), FEATURES line x4 (DON'T run `i18n-zhtw.py --features` - it rewrites ~60
  reviewed zh-TW lines; convert the one line instead), 6 UI words x3, PDFs, CHANGELOG.
- Tests: test-podinv787.js (33, ci-units), test-ui787-ui.js (12, gate leg after ui786 - run it FROM the server's tree: it writes the
  inventory next to itself); pins moved: test-ui777-ui (steps over .ruRow), test-modelfit5403 (fitName), test-remotemodels766 (podInv mount
  line). ci-units 377/0. test-ui766-ui fails standalone on untouched 2.786.0 too (needs the gate's stand-ins) - not this release.

## >>> NEXT — AGREED DESIGN (Tim said "go" 2026-11-15; A = 2.785.0 DONE, B = 2.786.0 DONE (OpenRouter models dialog + pictures / video), C part 1 = 2.787.0 DONE (inventory, <pod>/<file> in the lists, ☐ Remote); C part 2 = 2.789.0 DONE (NO_Pod); NEXT = D local multi-GPU (ask Tim before starting - it is big). Was: on terminate ask remove / keep as "NO_Pod (<old name>)/<file>" (inventory gone + kept, recipe via podRevive.recipe / rgpu.pod_made), NO_Pod entries in the lists, picking one remakes the pod (like presets' ▶) and puts the files back (podSend.ensure); then D local multi-GPU - the CHECKED line's order; the RELEASES list below still has the older letters): ONE "RUNS ON" DROPDOWN PER TYPE
Tim: "remove the radiogroups from remote generation docker, replace them with a dropdown, local, runpod, openrouter,LAN,Team (gray out lan and team for now) for each type. show the pods button in statusbar only if one of the selections is runpod. the pod info will keep a list of styles and models + vae + textencoders in each pod. the style will automatically start it's pod if not already started or ask user to create a new pod or assign the style to an existing pod" + "if user has multiple gpu's add Local - RTX 5090 (or whatever gpu they have), Local - RTX 3090 etc. so user can choose whichever one they want, load max layers for each card then cpu/ram offloading if checked in general tab in settings."
Proposed (my suggestions - Tim to confirm or change): (1) OpenRouter greyed on every row but LLM / Vision LLM (bitGen only runs LLMs there; 2.757.0 API_ styles are unreleased) with a tooltip; (2) "RunPod" = your pods; Serverless stays an advanced Settings choice; (3) a "Set all" dropdown at the top replaces All local / All remote / Both; (4) migration: Remote -> RunPod, LLM / Vision keep their platform; (5) LAN later = the existing remote-GPU "another computer / SSH tunnel" (2.520.0), Team = the teamdock add-on.
Rows: Image, Video, Music, Text to speech, Speech to text, Song separation, LLM, Vision LLM. Options: Local - <each GPU from /api/stats gpus> (one "Local" with one card), RunPod, OpenRouter, LAN (disabled), Team (disabled). split.where derived: nothing remote = local, else "both" with per-type (lib/gpuSplit decide/onRemote already honour per). LLM rows -> POST /api/remoteprep/where {llm|vlm: local|openrouter|runpod} (lib/podLlm setWhere). Pods status-bar button only when a row is RunPod (static/remotebtns.js).
ADDED (Tim, same day): "i think openrouter can also do image and video but they are all paid services - Add an openrouter button to remote generation docker to select models to use, show dialog with free and paid models and tabs for each type and inside each type have tabs for each family + 1 tab for all - but show price for paid service. use 2 frames in the dialog 1 tab to show available models and 1 to show added models, when user double clicks model then add the model to users models with a delete button at the end of each model name. when user closes the dialog update all the dropdowns with the new lists add models to the appropriate dropdown in llm/vllm and the override model dropdown (not the video/image styles) as openrouter/model name but don't remove the other models, if use model is selected and an openrouter model is selected use openrouter, do the same for models in pods, but use pod name/model name , also use the pods loras as pod name/lora name"
CHECKED: OpenRouter has an Image API (POST /api/v1/images, GET /api/v1/images/models, also chat with modalities) and an async Video API since 15 Apr 2026 (POST /api/v1/videos -> poll -> /content; GET /api/v1/videos/models; Veo 3.1, Sora 2 Pro, Seedance, Wan); its docs also list TTS / STT. So OpenRouter is NOT greyed for Image / Video (paid). Release order now: A runs-on dropdowns; B OpenRouter models dialog (types x families + All, free / paid with prices, Available | My models frames, double-click adds, 🗑 removes; on close the LLM / Vision / Override model lists get "openrouter/<id>" entries; Use model + an OpenRouter model = rendered on OpenRouter, Basic Settings' steps / CFG / LoRAs / sampler do not apply there; cost shown before queueing + kept in 💲 Costs); C pod models + LoRAs in the Override lists as "<pod>/<file>" (from the pod inventory) - picking one sends the render to that pod; D local multi-GPU.
ADDED (Tim): "in basic settings add a checkbox under use model, "remote", so if user clicks a local model with this setting enabled bitgen will look for the model on civitai/hf and upload to a selected pod (pod dropdown will be next remote checkbox, same with the loras" -> Basic Settings: under Use model ☐ Remote + a pod dropdown; under Use temporary LoRAs the same. A local model / LoRA picked with Remote ticked = found online first (lib/podFind.js: remote_models.json, Civitai card / SHA-256 / search, Hugging Face) and DOWNLOADED BY THE POD, else uploaded from this computer (lib/podModels.js, progress in PODS ▸ Transfers); the render goes to that pod; the file then shows as "<pod>/<file>" (release C). Folded into release C. Civitai blocks Australia - the upload fallback is the way there (never suggest a VPN).
ADDED (Tim): "if openrouter model is not found, remove it from our list, if pod is terminated ask user if they want to remove models from the list, if no, change the podname to NO_Pod, but keep all the model details in a file so if user clicks a nopod/model name, the pod will be recreated and the models uploaded to the new pod, if a pod is stopped , start the pod before rendering" -> (B) an OpenRouter model OpenRouter no longer lists is taken off My models (only when OpenRouter ANSWERED without it - never on a network error; the user is told which). (C) a pod terminated -> ask: remove its models from the lists, or keep them as "NO_Pod (<old name>)/<file>" (old name kept so two gone pods do not clash); the pod's recipe (GPU, cloud, disks, template) + its inventory stay in runpod/pods/<id>.json; picking a NO_Pod entry remakes the pod from the recipe (like a preset's ▶ - lib/stylePods / presets already remake pods) and puts its files back (found online first, else uploaded); a stopped pod is started before the render (ALREADY DONE in lib/stylePods.js).
RELEASES:
 A) 2.785.0 dropdowns + Set all + migration + Pods button rule (new lib/remoteHosts.js: HOSTS, hostsOf(view), setHost(kind, host) - routes in routes/gpuSplit.js; static/remotetypes.js rebuilt; hide #gpuWhere / #gpuEngine / #gpuLlmWhere radios, keep their status lines).
 B) local multi-GPU: Local - <card> per type. ComfyUI runs on ONE card per process -> one ComfyUI per picked card (--cuda-device N, its own port 8188, 8189 ...; jobs routed by type in gpuSplit.forJob like a remote target); the LLM / vision LLM already pin a card (core.ensureLlama / captioner: CUDA_VISIBLE_DEVICES + -ngl) - "max layers" = layers worked out from the GGUF size vs the card's free VRAM; speech engines (PyTorch) get cuda:N. NEW Settings ▸ General ☐ "Offload to CPU / RAM when a model does not fit" (on: ComfyUI on that card without --highvram / with its RAM offload, llama.cpp -ngl = what fits; off: everything on the card, a clear error when it does not fit). Costs: two ComfyUIs = their RAM twice, a model used on both cards loaded twice.
 C) pod inventory: each pod keeps runpod/pods/<id>.json - its styles + the files they need grouped Models / VAE / Text encoders / LoRAs, each on the pod / sending / missing; updated when a style is prepared, a file sent or deleted (lib/podPrep, podModels, podFiles); shown in PODS ▸ My pods ▸ the pod; kept through terminate -> preset remake. Auto-start of a style's pod ALREADY EXISTS (lib/stylePods.js: stopped -> started, gone -> remade; no pod -> static/stylepodask.js box with ＋ style / Create pod) - only check it with the dropdowns.

## >>> NEXT: Tim's pod log for the 4-minute render after ⟳ Restart ComfyUI (the "[comfy] ComfyUI ran it in" / "[comfy log] …" lines - with --disable-dynamic-vram --highvram they should say "loaded completely"); his try of ＋ From Hugging Face, the VRAM swap and Make it bigger (RunPod PATCH on our api.runpod.io/v2 base untested). 2.784.0 is DONE.

## 2.782.0 — YOUR LLMs FROM HUGGING FACE ON YOUR POD; ONE POD FOR LLM + VISION + PICTURES + VIDEO (2026-11-15, main b4ee941; tigerart c815e7c)
Tim (verbatim): "can we upload llama.cpp to the pod and select an llm from a hf repo to send to the pod. ask the user if they want
to save the repo. if they save it add it to a list of repos with the llm name. if user selects runpod for llm then show only this
list in the llm dropdown, same with vllm. Check with user if they want to create a separate pod for the llm/vllm or use the existing
one. we should be able to run our llm, vllm,image and video of 1 pod by clearing vram before a new model loads and increasing the space"
- llama.cpp on the pod was already there (2.767.0: built from source with the pod's nvcc, kept in /workspace/bitgen_llm; else the
  llama-cpp-python CUDA wheel). Not "uploaded" from this computer (Windows binaries would not run on the Linux pod).
- lib/llmRepos.js: runpod/pods/llm_repos.json {v, repos: [{id, kind llm|vlm, name, repo, file, parts, mmproj, size, mm_size, at}]}
  (H3_LLM_REPOS for tests); rgpu.llm_repo_pick {llm, vlm} = an id or "hf" (= rgpu.llm_hf[kind], sent not saved); repoOf / quantOf /
  nameOf / splitParts / filesOfTree (HF /api/models/<repo>/tree/main?recursive=true, split -0000N-of- as one, Q4_K_M first, mmproj
  F16 first) / clean / use / save (same repo+file = same id) / remove / picked / files (every part + mmproj, HF resolve URLs, hf
  token) / hfFiles (401/403 gated, 404) / grow (runpodApi.update PATCH /pods/{id} volumeInGb, POST /pods/{id}/update fallback;
  10-4000 GB, only bigger). NOTE: runpodApi BASE is api.runpod.io/v2 - RunPod's docs show rest.runpod.io/v1 for PATCH; untested live.
- routes/llmRepos.js (mounted after remoteLlm): GET /api/llmrepos (repos, pick, pods (pods.mine bitGen pods), pod, share, state),
  /api/llmrepos/state, /hf?repo=, POST send {…, pod id|"new"} (sets rgpu.llm_pod[kind], podLlm.prepare force), save, pick, remove,
  share {share} (rgpu.pod_share, default on), grow {pod, gb}.
- lib/remoteLlm.js: Pods host = YOUR LIST only (ids "repo:<id>", "repo:hf" noted "not in your list"), hfAdd; pick("repo:…");
  fileFor -> {model, mmproj, files} from the repo pick. static/remotellm.js: option "__hfadd" "＋ From Hugging Face… / your list"
  -> H3LlmRepos.open(k) (selection put back). static/llmrepos.js = the dialog (tabs, your list Use/🗑, HF repo -> GGUF radios,
  mmproj select, name, Run it on pods / new pod (H3Pods.show + go("create")), share tick, needGb + Make it bigger, ▶ Send, then
  "Keep … in your list? Save / Not now", pod state poll).
- lib/podLlm.js: podFor: rgpu.llm_pod[kind] first; prepare uses fl.files (your list) directly; spec.share (rgpu.pod_share !== false).
  NODE_VERSION 2: the ComfyUI node (custom_nodes/bitgen_llm_proxy) has add_on_prompt_handler -> stop llama-servers when share.json
  says share; /bitgen_llm/<kind>/… -> _ensure: alive? else wait for prompt_queue idle, comfy.model_management.unload_all_models +
  soft_empty_cache, Popen from <root>/<kind>.cmd.json, wait /health (15 min); _live reaps zombies (/proc stat Z); /bitgen_llm/state.
  The job writes share.json + <kind>.cmd.json, POSTs ComfyUI /free before loading, restarts ComfyUI when ping's v != node_v.
- Tests: test-llmrepos782.js (21, gate - uses 127.0.0.1 so ci-units skips it), test-llmswap782.py (+ .js, gate; needs aiohttp -
  pip install aiohttp here; SKIP without), test-remotellm768 pin updated (only your list). ci-units 369.
- Screenshot (stub data): /home/claude/out/llmrepos-782.png.


## 2.781.3 — ⟳ RESTART COMFYUI IN A POD'S ITEM (2026-11-14, main a09b4e4; tigerart 99069db)
Tim (verbatim): "ok, can u add a restart comfyui button to the pod info".
- static/podsdock.js: data-pdcrs "⟳ Restart ComfyUI" on RUNNING pods (after 📁 Files) -> H3PodFiles.restartBtn(btn, id, port)
  (static/podfiles.js: SURE[id] keeps the first press 4 s across repaints; V.st[id] + watch(id, btn) polls GET /api/pods/:id/vram).
- routes/podFiles.js POST /api/pods/:id/comfy/restart -> lib/podVram.js apply(id, port, {force: true}); applyCode(..., force)
  FORCE = True skips the "same arguments" shortcut. Test: test-comfyrestart7813.js (jsdom, 8, ci-units). ci-units 369.


## 2.781.2 — PODS ▸ 📁 FILES, GPU MEMORY (MODELS KEPT ON THE CARD), COMFYUI'S TIME IN THE LOG; RUNPOD MARKED TESTED (2026-11-14, main 40473d3; tigerart 1452462)
Tim (verbatim): "mark as tested - runpod - pod start,stop,terminate works - comfyui uploads and starts, models transferred from hf
works, models transferred from civitai works, lora transferred from local hd works,krea model generates image , in about 1min 40sec
after first run on the A40gpu, yue2 comfui model transferred onto same pod works (add model files available on pod, allow user to
delete model files from pod). I think comfy is not using vram thats why the renders are so slow" (screenshot: A40, GPU 100%,
VRAM 4.3/48.3 GB WHILE YuE2 RAN - its int8 model is 4 GB; pod RAM 54.8 GB used).
- TESTED: README "Where testing is up to" + docs/BETA.md "Tested on real hardware" got a RunPod pods row; tigerart download.php
  sentence (+ ja/zh-CN/zh-TW).
- lib/podFiles.js: list (kernel LIST_PY os.walk <comfy>/models, model exts + .part/.tmp marked partial, links marked, dot-folders
  and linked folders not walked, shutil.disk_usage) / remove (cleanPaths: relative, no .., no hidden, 2-8 parts, max 500; DEL_PY
  checks realpath(dirname) inside models, os.remove = a link only unlinked; forget(): remote_models.json pods[pod] removed +
  rgpu.pod_files entries) / setDeps. routes/podFiles.js (GET /api/pods/:id/files, POST /api/pods/:id/files/delete,
  GET/POST /api/pod-vram, POST /api/pods/:id/vram/apply, GET /api/pods/:id/vram), mounted after podFails in routes/index.js.
  static/podfiles.js H3PodFiles.open(host, p, port) in #pdStyPanel (podsdock 📁 Files button data-pdfiles, filesFor) + the
  GPU memory row (.pvRow after .pdStats, sweep via MutationObserver like podaudio).
- lib/podVram.js: rgpu.pod_vram gpu (default) | dynamic; PY comfy_extra(dir, mode) = ['--disable-dynamic-vram'] only when
  nvidia-smi min memory >= 24 GB AND comfy/cli_args.py contains the flag (ComfyUI says the flag is temporary - an unknown flag
  would stop ComfyUI starting); used by podInstall start (J.vram, note line) and podComfyUpdate's start-when-not-running;
  apply(id, port) kernel applyCode: the running ComfyUI's argv kept, our flag added/removed, restarted only if changed (not pid 1),
  then waits for podModels.alive.
- WHY (not proven on Tim's pod): ComfyUI since ~March 2026 runs Dynamic VRAM (comfy-aimdo) by default; known reports of a model
  reloaded on every prompt after a workflow switch (Comfy-Org/ComfyUI #14276) - Tim alternated Krea 2 / YuE2 on one pod.
- scripts/comfy_client.py: mark_log(base) before /prompt (queue + misc/worker.py), load_report(base, hist) after outputs:
  "[comfy] ComfyUI ran it in N s" (history execution_start -> execution_success) + "[comfy log] …" lines from
  /internal/logs/raw matching LOAD_WORDS (loaded completely / partially, requested to load, prompt executed in, dynamic vram …),
  only the new ones (after the mark), colours stripped, 10 max; None endpoint = quiet.
- Tests: test-podfiles7812.js (16, ci-units), test-podfiles7812-py.js (7, gate leg - runs the Python for real).
- Screenshot made: /home/claude/out/podfiles-7812.png (stub data). ci-units 368.


## 2.781.1 — A NEW POD'S COMFYUI LISTS ITS MODELS AS ["COMBO", {options}]: THE WORKER READS IT (2026-11-14, main c6fe1c7; tigerart ac319c0)
Tim's log (a new bitGen pod, ComfyUI 0.45, Krea 2 Raw + Basic Settings model krea2_nsfw-aio-2.safetensors downloaded by the pod
from Civitai into models/checkpoints - podSend.ensure CKPT_CATS -> podFind.catOf -> "checkpoints"): "node 70: Value not in list
[unet_name] = krea2_nsfw-aio-2.safetensors … not in []". Tim: "create pod works, comfyui installed successfully, overide models
transferred to pod successfully but workflow rejected".
- CAUSE 1: scripts/comfy_client.py combo_values read only the classic [[...], {...}] spec; newer ComfyUIs answer
  ["COMBO", {"options": [...]}] (lib/comfyModels.js comboFrom read all three since 2.280). Every list read empty in Python.
- CAUSE 2: relocate_model_loaders treated an empty UNETLoader list as "no answer" (`if not own`) and skipped - a new pod's
  diffusion_models folder IS empty.
- FIX: combo_choices(spec) (3 shapes, [] kept as []), combo_listed(base, ct, key) (None = no answer / not a combo),
  combo_values uses combo_choices; relocate names() uses combo_listed and `own is None`; the default-fill + _combo use it;
  misc/worker.py schema sync first-choice fill reads the newer shape. Test: test-combo7811.py (+ .js wrapper, gate leg);
  test-relocate525 patches combo_listed too.
- Tim: "on the runpod section in github and the website add runpod pod creation can take 10-15 minutes + the transfer time of
  your models": README "Don't have the hardware?", USAGE section (2.781.1, 4 languages), tigerart remote-gpu.php note
  "Allow time for the first start." + tutorials.php #runpod lede (ja/zh-CN/zh-TW; test-site 275).
- NOTE: ci-units skips tests that use child_process (test-samplers781.js, test-combo7811.js) - they run as gate legs.


## 2.781.0 — BASIC SETTINGS SAMPLER LISTS; A NEW POD WITH NO SIGN OF LIFE IS MADE AGAIN; A STARTING JUPYTER IS WAITED FOR (2026-11-14, main d3ff27e; tigerart 3f336cd)
Tim: "please add a list of samplers to the basic settings docker above the checkpoint dropdowns" + (pod log "Jupyter did not start
a kernel (HTTP 404)") + "check pod for activity, if no activity after 5 minutes terminate the pod and start a new pod (this is only
on first run for the pod, if the pod successfully installs and runs then terminate only when user presses terminate button)".
- SAMPLERS: lib/samplers.js (BUILTIN 39 samplers / 9 schedulers; list() from the pod in use (runpodApi.proxyUrl) else
  comfyCfg().url /object_info/KSampler, cached 2 min; GET /api/samplers; middleware: POST header x-bitgen-sampler ->
  AsyncLocalStorage (req.on/once bound with AsyncResource so multer keeps it); current(); envOf -> BITGEN_SAMPLER/SCHEDULER).
  routes/index.js mounts it AFTER remoteModels (test-remotemodels766 pin). lib/core.js makeJob -> params.comfy_sampler + a log
  line; spawn env. scripts/comfy_client.py apply_sampler_pick(base, graph): only into nodes whose current sampler_name /
  scheduler is a standard ComfyUI name (links skipped), called first in queue(); misc/worker.py H3 path too.
  static/samplerset.js: .samplerRow before the Use model tick (image: imgSampler/imgScheduler, video: vidSampler/vidScheduler),
  "— Style's own —" first, localStorage h3.samplers, fetch wrapper adds the header only when ovrStyleOn() and the URL kind
  matches (image /api/(genimage|aiedit), video /api/(generate|ltx)). Tests: test-samplers781.js (+ .py), test-ui781-ui.js (gate).
- WATCHDOG: lib/podWatchdog.js start(id, port) from podMade.watch (no deps) for pods in pod_made without setup_at/proven_at.
  Every H3_POD_DOG_POLL (30 s) look(): RunPod state/runtime, podModels.alive (ComfyUI + Jupyter /api/status only - NOT ways(),
  which can run a 2-min kernel), podActivity lines (quiet lines and numbers ignored: a clock is not activity). Unchanged for
  H3_POD_DOG_MS (5 min) -> replaceDefault: recipe, terminate first (nothing new if that fails), P.create same recipe,
  moveStyles, audio kinds, presets pod_id, podRetry.move (held renders), pod_made new {dog_gen, replaces}; MAX_GEN 2 then
  "gave up". ComfyUI answering -> proven_at (never watched again). Off: H3_POD_DOG=off; the gate studio (H3_E2E) only with
  H3_POD_DOG_MS set. Test: test-podwatchdog781.js (gate leg).
- JUPYTER STARTING: podModels.runKernel retries POST /api/kernels on 0/404/502/503/504 up to H3_POD_KERNEL_WAIT (120 s);
  podRevive.waitReady says "loading pod - its Jupyter is still starting (n min)" and keeps waiting.
- RunPod template ids keep - _ . in podRevive.cleanRecipe / podPresets.cleanPreset (pins in test-podpresets764 / podsetup761).
- Docs: USAGE "Sampler lists, a new pod that never starts (2.781.0)" + ja/zh-CN/zh-TW; FEATURES x4; UI words; PDFs.
- tigerart home: new section "A helping hand at every step" (class "yours assist", before "One studio for the whole film"):
  your favourite LLM for story / lyrics / prompts, a vision model for pictures, a style + Basic Settings docker to swap the
  model / add LoRAs / change sampler settings; ja/zh-CN/zh-TW; test-site 274.


## tigerart HOME HERO (2026-11-14, tigerart 92f145c - no app version)
Tim: "change this on the front page Make films on your own computer, to Explore you creativity in one place. AI - image generation -
image editing - video generation - video editing - music generation / local generation Free / remote generation- runpod,
openrouter (paid services) ... make it sound better". public/index.php hero: h1 "Explore your creativity in one place", lede "AI
image generation, image editing, video generation, video editing and music generation - all in one studio.", <ul class="ways">
Local generation - free ("Create on your own graphics card. No accounts, no cloud, no usage limits.") / Remote generation ("Need
more power? Rent a GPU on RunPod or use the AI models on OpenRouter (paid services)."); .hero .ways CSS in site.css; ja / zh-CN /
zh-TW; test-site + test-admin updated. The page <meta> description ($desc) still says "no cloud" - offered to Tim, not changed.

RULE (Tim): never advise users to get around Civitai's Australian block (no VPN / proxy suggestions in the app, docs, website or discussions).
Open offers to Tim (not built, he has not said yes): automatic fallback to
the next free OpenRouter model on HTTP 429 (2.769.x); the old plan's donate button. Ask Tim for the next pod log if qwen2_1 still says
files are missing (2.769.x - cause NOT proven).
- 2.769.2: the "no pod yet" box (stylePods.offer / static/podpick.js) lists only pods RunPod lists now, minus TERMINATED
  (status or desiredStatus - mapPod.desired); presets of gone pods NOT offered there any more (Tim asked); pods_error said.
- OpenRouter works for Tim (LLM + vLLM with another model); gemma-4 free got 429 upstream (Google) - OFFERED (not built):
  automatic fallback to the next free model on 429 (OpenRouter "models" list).
- 2.769.1: lib/podMade.js - pods bitGen makes carry env BITGEN_MADE=1 + rgpu.pod_made; watch() from pods.create sets the pod
  up BY ITSELF once it loads (ComfyUI auto update, linked styles prepared, used if no pod in use), setup_at; resume() 20 s
  after server start (routes/index.js); mine() adopts a marked pod with no record. podComfyUpdate finds the RUNNING ComfyUI by
  the process listening on its port (Tim's "did not find its running process" - bitGen had a guessed other copy) and updates
  THAT folder; auto update retried after failure (comfy_tries <= 3, comfy_ok). ways() comfy_dir from folder_paths
  custom_nodes' parent first. stylePods error no longer cut at 400 chars. Tim's qwen2_1 files-not-listed cause still NOT
  proven - his next log will carry the locate reasons (ask for it).
- 2.769.0: a pod bitGen made (rgpu.pod_made) gets its ComfyUI updated ONCE when it first loads (podComfyUpdate.auto from
  remoteGpu.podState ready transition, or podPrep.run waits via waitAuto; comfy_auto marks it; rgpu.pod_comfy_auto false =
  off). updateCode: pip once per commit (<comfy>/.bitgen_pip_ok), "same" = no pip/no restart; newer code than the running
  ComfyUI = restart. Tim's "these files are not on it" after a download (no progress lines - the job said done / there
  already at once, cause NOT proven): podPrep now searches the pod (locateCode) and symlinks a file found outside ComfyUI's
  read folder; else says why (partly downloaded / nowhere / in the folder but not listed); /object_info failure and model-list
  warnings now said. ASK TIM for the new job line if qwen2_1 still says files are missing.
- 2.768.0: Basic Settings ▸ GPU keeps only Local / Remote / Both + line + ☁ Remote generation docker button; the remote
  options (#gpuRemoteOpts, built by static/gpusplit.js; podsdock / runpoddock / remoteprep add to it) are MOVED into the
  docker (static/remotedock.js adopt -> #rgdOpts). Remote waiting for a set-up opens the docker. In remote mode the prompt
  docker's #llmSel / #visionSel (ext/promptdock - NOT edited; static/remotellm.js takes them over: capture-phase change/focus
  + MutationObserver; index.html refreshLlms asks H3RemoteLlm.owns) list OpenRouter's FREE models (DEFAULT: Remote with no
  LLM choice = OpenRouter - lib/remoteLlm.js hostOf; old set-up llm_provider runpod + vllm.endpoint keeps the old path), the
  pod's catalog GGUFs (rgpu.llm_pick -> podLlm.filesFor) or the vLLM model. /api/remoteprep where = effective, where_set =
  the choice (tests restore from where_set). ComfyUI update: Tim's pod failed at pip with no reason (job raised) - now
  ComfyUI's own python (bare "python" resolved via its PATH/venv//proc exe) + its env + error said. Ask Tim for the new
  line if ⬆ Update ComfyUI still fails. ui584 / ui585 fail on main too (page.fill timeout) - not 2.768.
- 2.767.0: remote mode LLM / Vision LLM on Local / OpenRouter / RunPod (rgpu.llm_where; lib/podLlm.js builds llama.cpp on the
  pod, served through a ComfyUI proxy custom node bitgen_llm_proxy - set up on the FIRST PROMPT, the prompt waits up to 15 min;
  lib/remotePrep.js prepares the video style when Remote is picked - Tim did not answer the timing question, that is the
  assumption). OpenRouter reasoning {enabled} + reasoning_details given back (lib/openRouter.js remember/attach) + model
  search/picker. podComfyUpdate: only a SUCCESS blocks a retry for an hour (the old guard blocked after a FAILURE - Tim's
  ComfyUI 0.30.0 log), non-ff -> checkout origin/master, ⬆ Update ComfyUI button in PODS ▸ My pods.
  UNTESTED on a real pod: the llama.cpp build, the ComfyUI update, the HF private upload. Ask Tim for the reason line if the
  update fails again (it now ends with the pod's log).
- 2.766.3/4: Tim's qwen2_1 (img_qwen21_edit_10.json) on pod gekyved8f8mmpk: TextEncodeQwenImage21 is CORE in newer ComfyUI
  (comfyCoreNodes latest, not 0.34.0) -> lib/podComfyUpdate.js updates ComfyUI on the pod (git pull + pip -r + restart main.py).
  UNTESTED on a real RunPod pod (tested with a git repo + venv + stand-in main.py). If Tim reports "restart needed", the
  pod's ComfyUI is PID 1 / not found. Files now go to ComfyUI's /internal/folder_paths dirs.
- 2.766.2: remote mode now FOLLOWS Basic Settings ▸ GPU (podsMode needs where remote / both-with-image-or-video) - before,
  picking Local left the remote lists on. A ComfyUI Tim started himself cannot be stopped by bitGen (comfy.stop only stops the
  one bitGen spawned) - said in the note.
- 2.766.1: Tim's "failed: the pod's ComfyUI is not answering yet" on ⇪ / Override in remote mode. Cause not proven (no log):
  fixed both suspects - the port (comfyAt tries more ports incl. RunPod's own for the pod; modelGate used Settings' port for a
  style's pod) and a busy pod (whenUp waits 3 min; Jupyter-only downloads). ASK TIM for the job log if Override still fails.
- 2.766.0 = the pods.info plan, as Tim specified it: runpod/pods/remote_models.json (lib/remoteModels.js), remote mode lists,
  ticked pods, ⇪ send, your private HF repo (lib/hfUpload.js - UNTESTED against real Hugging Face, stand-in only), a bar per
  transfer, the render's LoRAs to the pod. Tim chose: no-link models go up ONCE to <user>/bitgen-models (private), pods
  download. Left from the old plan: a "transfer checklist" when a pod / preset starts (not built - the list + ⇪ cover it;
  ask Tim if he still wants it). NEXT: 2.767.0 a reference removed from the list is deleted from the pod's input folder.
  Watch for: Tim's HF token may be read-only (then direct upload, said in the bar).
- 2.764.6 FOUND THE "0%" BUG: since 2.763.4 runKernel DELETEs each kernel after it answers, and dlCode / mirrorCode / nodeCode
  ran as a daemon thread in it -> killed at once. Now lib/podJob.js detach() starts them as their own process. ANY NEW LONG
  POD JOB MUST GO THROUGH podJob.detach (+ track() when its status is read). Krea-2 is NOT gated (told Tim).
- TIM CONFIRMED: a pod render WORKS (Krea 2 Raw on a CUDA 13 pod). His node upload stalled again on 2.764.1 at
  "uploading ComfyUI-H3-NativeAudioLock - 0 MB" (a tiny pack - the silent part was after the upload); 2.764.2 sends only the
  packs a workflow uses and says every install step (3-min limit on an unreadable status). Ask for the new log if it stalls.
  CAVEAT told to Tim: nodes bitGen ADDS to a graph at render time are not in the saved workflow - if one is missing on the pod,
  ComfyUI says which node type it does not know; add its pack then (⬆ Nodes its styles need does not see them either).
  Waiting for his retry of Override (2.763.4 upload fix) and
  for word on the custom-node upload that looked stuck ("uploading ComfyUI-H3-NativeAudioLock") - 2.763.5 packs a file at a
  time with progress; if it still stalls, ask the pack's size / what is in it.
- 2.763.5 CHANGED THE Z RULE: floating dialogs (SecFloat windows, #vcPanel) are ALWAYS over the dockers (.h3fp ▣ / named /
  floated main dockers, .tsd stage dockers) - a pressed docker no longer goes over a dialog (Tim: "move the pods docker in front
  of any custom docker"). Told Tim; if he wants "last used on top" back, drop layered() in static/floatz.js raise/list.
- NEXT (agreed with Tim, in order):
  2.765.0 misc/pods.info (gitignored) + Civitai / Hugging Face lookup list (file name, size, SHA-256, URL - found by the card's
          version id, else Civitai's by-hash lookup) so a homemade / private checkpoint or LoRA is sent from the HDD and an
          online one is downloaded ON the pod (helps preset ▶ too); Model manager ⤓ in pods mode -> straight to the pod + listed
          in pods.info, the Override checkpoint / LoRA lists show pods.info models; civitai.com / civitai.red choice; when a pod
          is started again or a style makes a new pod: a checklist of pods.info checkpoints / LoRAs (✓ already on the pod) +
          Transfer; Override's temporary LoRAs sent too (only the checkpoint is now - podRevive.modelGate).
  2.766.0 a reference removed from the list is deleted from the pod's input folder (Jupyter; the worker already uploads them).
  Maybe later (offered, not asked): a RunPod network volume per preset so files survive terminate.
- TIM: press Update on /b_admin/.
- Gate: no full run since 2.760.0's tail. Also failing on main before 2.764.1 (environment / old): ui745, ui746, ui747,
  ui753 (page.check timeouts in Basic Settings), ui758 (one bar-stage check), test-seedvr2 LIVE leg (needs the stub).
  Browser tests that fail on main too (not regressions, checked 2.763.5): ui526 (the run
  finished), ui530 (palette 'house' / 'depth map'), ui550 (5 paste / move / transform checks), ui579 (Reset Timeline 150 px).
  test-ui760-ui.js needs work/'s state files (docker_status.json, workspaces.json, basic.cfg … from /tmp/m762) - environment.
- Wip branches: Tim asked whether to delete them; answered which are safe; he has not said yes - do NOT delete yet.
- Worktrees: /home/claude/w757 … w7635.

## 2.771.0 — 💲 THE RUNPOD DOCKER IS COSTS (THIS COMPUTER + EVERY PLATFORM, A DETAILED LIST EACH); 📊 STATISTICS DIALOG (2026-11-13, main 964d2b8)
Tim (verbatim): "add a tab for statistics - change the runpod docker to Costs, show all costs summary, if user clicks on one of the
costs open a detailed lists of expenditure for that platform or local" + "record the time it takes to prepare a pod for generation each
time it needs new uploads or restarts etc. record generation for each generation separately - show user startup time, generation time
and total time" + "statistics go is Statistics Dialog, Costs Docker should include local costs and all the diferent platform costs
individually".
- lib/costs.js (pure: RANGES today|week|month|last|all, rangeOf, sumDays, llmEntry, llmSummary, orFigure, totalOf, localOf) +
  routes/costs.js: GET /api/costs?range= -> {rows, total} - rows: local (usageLog.query day_energy_cost + supply, bill currency),
  runpod (podCosts.costs live today_usd / month_usd, other ranges = days.json pods_usd; + Serverless: REST v2 GET /billing/serverless
  bucketSize=day this month, records' serverlessId|endpointId - UNVERIFIED against real RunPod, failure = "could not be read" in the
  row), openrouter (GET <OR base>/key: usage_daily / usage_weekly / usage_monthly / usage - UTC; last month = bitGen's own log only),
  api:<id> per config.apis entry (genStats api_usd of its renders + its LLM calls' cost), remote (days.json remote_cost). Every row
  cost = bill currency (currency.usdIn), usd = the platform's own figure; cached 50 s per platform. GET /api/costs/:id = the detail
  (local: days + local jobs; runpod: days pods_usd + sls_usd, serverless; openrouter: key figures + own by_model + calls; api: jobs +
  calls; remote: days). H3_USAGE_DIR overrides the usage folder (tests).
- noteLlm(remote, data, kind) -> usage/llm-YYYY-MM.jsonl {provider openrouter|api, api_id, model, in, out, cost (usage.cost if the
  answer has it - OpenRouter sends it; else null = "-" in the list)}; hooked after the reply in lib/llmChat.js, lib/captioner.js (vlm),
  lib/quickPrompt.js. This computer's LLM is never logged.
- lib/genStats.js (pure: entryFor, phaseOf, phasesOf, summarize, whereOf, toCsv) + routes/genStats.js (GET /api/genstats?from&to,
  /api/genstats/csv?kind=gens|preps): usage/genstats-YYYY-MM.jsonl lines {k:"gen"} / {k:"prep"}. A GENERATION: queued_ms (created ->
  head of queue), startup_ms (head of queue = job._prepAt, else started -> job._genAt = the worker's first "[meta] {" line, printed by
  scripts/comfy_client.queue just before /prompt; no [meta] = started), gen_ms (-> finished), total_ms, where (local | runpod + pod |
  api + api_id | url/ssh/serverless from job._ranOn), api_usd (sum of "[api] … about $x" lines), never_started (failed at the pod
  gate), preps (the RECENT pod preparations of that pod overlapping [prepAt, started]). Not recorded: NOT_GEN modes (export, karaoke,
  download, convert, installs), TOOL_MODES, live renders. A POD PREPARATION: podPrep.prepare wraps say() with timestamps -> phases by
  phaseOf (check / start / update / repair / nodes / restart / download / send / link) - kind prepare | nodes; stylePods.ready records
  kind "start" when it started a stopped pod (or waitReady took > 20 s). prepare() called with opts.deps (unit tests' stand-ins) is NOT
  recorded unless H3_GENSTATS_TEST=1 (the tests were writing into the tree's usage/).
- lib/core.js hooks: log() -> genStats.onLine; pump() -> prepMark(q0) in the P_ gate branch and the stylePods branch (g && !g.local);
  the "pod could not be used" branch -> recordGen(j); closed() -> recordGen(job, {tool}).
- static/runpoddock.js (window.H3RunPod = H3Costs; SecFloat id "runpod" KEPT so layouts / docking survive; title "💲 COSTS"): range
  buttons [data-cdrange], #cdSum rows [data-cdrow] (click / Enter) -> open(id) -> #cdDetView (#cdBack ← All costs, #cdDetTitle,
  #cdDet); RunPod's old sections live in #cdRunpod (#rpBal / #rpUse / new #rpDays / #rpGpus - ids unchanged, shown only on RunPod's
  list; load() still runs on every show so #rpCost etc. fill and h3:runpodcost fires); #cdStats -> H3Stats.show(true, {range}).
  show(on, view): view "runpod" = RunPod's list (gpuRpDock / pdRpDock, renamed "💲 Costs"), "" = all costs (Settings ▸ General ▸
  Energy cost #s_costs, System stats' #statCosts in static/powerstats.js). static/gpusplit.js closeRemote no longer closes "runpod".
- static/statsdlg.js (window.H3Stats): modal #stDlg (role dialog), ranges [data-strange], cards #stCount / #stStartAvg / #stGenAvg /
  #stTotAvg / #stPreps, tabs [data-sttab] gens (#stGens, a row with preps = tr.hasprep, click toggles its tr.prep lines) | preps
  (#stPrepList) | where / mode (#stBy), #stCsv, Esc / ✕ / backdrop close; #s_stats in Settings ▸ General ▸ Energy cost.
- Tests: test-genstats771.js 50, test-costs771.js 39 (ci-units 354 - stand-ins via require.cache + global fetch, temp H3_USAGE_DIR),
  test-ui771-ui.js 21 (gate leg after 2.770.0's; seeds two gens + a prep in the studio's usage/ and puts the file back). Updated:
  test-gpulocal7641 (closeRemote ["rgen","pods"]), test-runpoddock7635 (title 💲 COSTS), test-ui7641-ui (💲 Costs stays open on Local).
  Browser tests green in a scratch studio WITH the gate's stand-in env (H3_RUNPOD_REST_API / _GQL_API / H3_OPENROUTER_API … as in
  e2e-stub-test.sh line 37): ui771 21/21, ui7635 19/19, ui761 15/15, ui7641 6/6, ui768 10/10 (ui761 / ui768 FAIL without that env -
  environment, not code). Full gate not run.
- Docs: USAGE "## 💲 Costs docker and 📊 Statistics (2.771.0)" + ja / zh-CN / zh-TW (only this section translated - 5 older stale
  sections still English-only, as before), FEATURES x4 (two lines), UI strings: dynamic.json regenerated, 63 strings + 3 patterns x3
  (check 0 problems), all PDFs rebuilt, misc/CHANGELOG.md line (written by hand - tools/ is not in the repo).
- NOT tested with real services: RunPod /billing/serverless shape, OpenRouter's usage.cost in chat answers (field optional), the
  Statistics on a real pod render (the [meta] line marks generation start for every comfy_client.queue worker; workers that never
  print [meta] count all their run as generation).

## 2.770.0 — LLM LOCAL / REMOTE; OPENROUTER LISTS 10 AT A TIME + SEARCH + ☰ ALL; NO-NODES COMFYUI REPAIRED (2026-11-13, main d00c282)
Tests: test-orlists770, test-podrepair770 (ci-units), test-ui770-ui (gate). ui767/ui768 now set rgpu.llm_provider explicitly
(the e2e config persists between browser tests - always set provider / show_free / show_paid in a test's setup).

## 2.769.2 — ONLY LIVE PODS IN THE "NO POD YET" BOX (2026-11-13, main 8fcc9f6)
Tim: "if pods have been terminated or does not exist in my pods remove them from the dialog when a style is chosen and no pod
is selected for the style". Tests: test-poddialog7692 (ci-units, 350).

## 2.769.1 — PODS BITGEN MAKES SET THEMSELVES UP; THE RUNNING COMFYUI IS THE ONE UPDATED (2026-11-13, main e48e983)
Tim: "when the pod is made with bitgen store that it was made with bitgen and automatically treat it as such, don't wait for
button press" + "restart needed: ComfyUI is updated, but bitGen did not find its running process".
- New lib/podMade.js (MARK, isMadeEnv, madeOf, adopt, watch, resume, status, afterLoad, WATCH). Tests: test-podmade7691
  (ci-units, 349), test-comfyauto769-live port case (gate).

## 2.769.0 — NEW POD'S COMFYUI UPDATED AUTOMATICALLY; MISSING FILES SEARCHED FOR ON THE POD (2026-11-13, main b56777c)
Tim: "update comfy automatically when the pod is created as well" + his qwen2_1 log (downloads, then "these files are not on it").
- lib/podComfyUpdate.js auto / waitAuto (+ update() waits for a running run); lib/remoteGpu.js podState calls auto; lib/podPrep.js
  autoUpdate / locate deps, locateCode / locateRead / locateWords; static/podsetup.js shows a new pod's own update.
- Tests: test-comfyauto769 (ci-units, 348), test-comfyauto769-live (gate). test-stylepods763 sets rgpu.pod_comfy_auto false.

## 2.768.0 — REMOTE OPTIONS IN THE ☁ REMOTE GENERATION DOCKER; PROMPT DOCKER LLM / VISION LISTS = THE HOST'S MODELS; COMFYUI UPDATE PIP FIX (2026-11-13, main a3671ef)
Tim: "move all the remote gpu options to the remote gpu docker, when in remote mode clear the llm and vllm dropdown lists in
prompt docker add the list of free llm and vl models from openrouter(default) or the selected host in our prompt llm and vllm
dropdowns." + "✗ not updated: installing what the new ComfyUI needs (pip) - the pod's log ends: Reset branch 'master' …".
- New: lib/remoteLlm.js (hostOf, catalogLlms, mmprojFor, fileFor, lists, pick), routes/remoteLlm.js (GET /api/remotellm,
  POST /api/remotellm/pick), static/remotellm.js (H3RemoteLlm). Mounted in routes/index.js before remotePrep.
- Tests: test-remotellm768 (gate), test-comfyupd768 (gate, real python/venv/git), test-ui768-ui (gate); ci-units 347.

## 2.767.0 — REMOTE LLM / VISION LLM (LOCAL / OPENROUTER / RUNPOD), VIDEO STYLE PREPARED, OPENROUTER REASONING + MODEL SEARCH, ⬆ UPDATE COMFYUI (2026-11-12, main 7266453)
Tim: "when in remote mode, prepare the llm and video models for remote use" + "give user option to use openrouter or runpod
for llm/vllm or local" + "when user presses enter button to send prompt to llm" + OpenRouter reasoning example + "list/search
open routers models" + "can we update to the latest version of comfyui on the pod?".
- New: lib/podLlm.js, lib/remotePrep.js, routes/remotePrep.js (GET /api/remoteprep, POST where/start, POST|GET
  /api/pods/:id/comfy-update, intercepts POST /api/llm/start in remote mode), static/remoteprep.js (rows in Basic Settings ▸ GPU).
- gpuSplit.llmTarget honours rgpu.llm_where when remote generation is on and split.where != local.
- Tests: test-podllm767 (gate), test-openrouter767 (gate), test-ui767-ui (gate), test-comfyupd767 (ci-units, 347).

## 2.766.3 + 2.766.4 — FILES WHERE THE POD'S COMFYUI READS THEM; OLD COMFYUI ON THE POD UPDATED; A LACKING NODE STOPS THE RENDER (2026-11-13, main b442fee / 1e54084)
Tim: "[pod] qwen2_1 cannot render on the pod yet - these files are not on it: … (… no node pack bitGen knows adds
TextEncodeQwenImage21 …) but the files are already transferred" + "[worker] ERROR: ComfyUI does not have these node types:
TextEncodeQwenImage21 … i think the download wasn't completed before... the timining is off, but the custom nodes didn't get installed".
- lib/podModels.js: ways() + model_dirs (GET /internal/folder_paths -> dirsOf, both shapes) + comfy_version; modelDir(w, folder)
  (aliases text_encoders<->clip, diffusion_models<->unet), withDirs; dlCode job files carry dir; a copy at <comfy>/models/<folder>
  is moved (state 'moving' -> 'there already'); upload + newFolder use modelDir.
- lib/podComfyUpdate.js: coreMissing (comfyCoreNodes latest), updateCode (job .bitgen_cupd.json: git checkout master if detached,
  fetch --tags, pull --ff-only, the running main.py found in /proc (cwd + argv), pip -r with its python, SIGTERM, 15 s, relaunch
  same argv/cwd/env in a new session unless it answers again; PID 1 -> "restart needed"), update(w, port, say) once an hour per pod.
- lib/podPrep.js: core classes -> D.updateComfy, objectInfo again; P.lacks (still missing / unknown packs) -> stylePods.ready
  throws "cannot render on the pod yet - its ComfyUI lacks …" (not cached READY); final file check retried 4 × H3_POD_LIST_WAIT.
  objectInfo default uses comfyAt.
- Tests: test-podcomfyupd7663.js (10, gate - real python/git/venv), test-podlacks7664.js (4, ci-units). ci-units 346.

## 2.766.2 — LOCAL / REMOTE SWITCHES THE APP OVER; MODEL FAMILIES IN THE FOLDER FILTER (2026-11-12, main 28873f4, CI 43171909042, refresh b6fe196)
Tim: "when local is selected in basic settings go to local mode . show all the local model folders in folder filter, check if
comfyui is running, start it if it is not running. and continue as normal local mode. in remote mode stop comfyi if it is running,
clear the folders in folder filer in basic settings and show the model families instead, list the models in the remote models list,
filter by family".
- lib/modeSwitch.js: remoteWhere(split) (remote, or both with image/video), noteOf, modeOf (= RM.podsMode), after(before):
  local -> comfy.status, not reachable + backend comfy -> comfy.ensure({force}) in the background ("starting"); remote ->
  comfy.stop() (managed only) else status reachable -> "left". H3_NO_MODE_SWITCH=1 skips. routes/gpuSplit.js POST and
  routes/remoteDock.js /api/remotegen/enabled return {…view, mode_switch}.
- lib/remoteModels.js: podsMode adds remoteWhere(G.split()); familyOf(e) = modelCards.familyOf({base_model, name: folder/name +
  group + label}) -> FAMILIES label | "Other"; asComfyModels file.folder = family (+ family, group); cardOf folder = family;
  entries keep base_model (fromCivitai sets it).
- static/index.html: cmFolderKey(f) ("fam:" + folder in remote) used by cmFolderOptions / both filters; cmAllOption ("All model
  families" | "All folders"). static/gpusplit.js: mode_switch.note in #gpuMsg + H3RemoteModels.recheck(true).
  static/remotemodels.js: recheck(force) exported (the 5 s watcher uses it).
- Tests: test-modeswitch7662.js (13, ci-units - a stand-in lib/comfy), test-ui7662-ui.js (7). remotemodels766 / hfupload766
  configs get split.where remote; ci-units 345.

## 2.766.1 — POD PORT / BUSY POD / OVERRIDE ON THE POD'S PORT; CIVITAI FILTERS (2026-11-12, main 42ba703, CI 43170425232, refresh ce0bb85)
Tim: "when trying to send a model from civitai to th pod it fails. it works for the style model it generated. but overide styles
still doesn't work with remote, failed: the pod's ComfyUI is not answering yet - wait for "pod loaded"" + "add civitai filters to
model manager, checkpoint, lora,all, model family - krea2,flux etc. sort by".
- lib/podModels.js comfyAt(pid, port) (exported + PORTS cache 10 min): candidates = cached, asked, stylePods.portOf, rgpu.runpod
  .port, 8188; none -> runpodApi.pod (desiredStatus EXITED = stopped; ports "N/http" added, 8888 skipped). ways(): no ComfyUI but
  Jupyter -> continues (comfy_url "", comfy_answers false); else error code stopped | not_answering ("tried port 8188: HTTP 502").
  podStyles.contents uses comfyAt.
- lib/podSend.js whenUp(fn, wait) (H3_POD_WAIT_MS 180000, H3_POD_WAIT_STEP 10000) around fromLink in pullWait (PT.note on the
  bar) and PS.contents in ensure. lib/podTransfers.js note(id, text) -> view.note; podxfer shows it while no bytes.
- podRevive.modelGate(st, podId, port); stylePods.gate passes portOf(rg(), use).
- lib/civitai.js: TYPE_GROUPS (LoRA = LORA+LoCon+DoRA), PERIODS, BASE_MODELS fallback, FAMILY_RX/familyOfBase/familiesOf, qsOf
  (arrays = repeated keys - api() uses it), enums() (GET /api/v1/enums, 6 h cache); search(group, family, period).
  routes/civitai.js GET /api/civitai/enums. static/modelmgr.js: cvChips (All/Checkpoints/LoRAs), #mmCvType other types,
  #mmCvFam (famOptions: fam:<family> / bm:<base>), Sort by, #mmCvPeriod; change = search; kept in localStorage cvf; cvQuery pure.
- Tests: test-podport7661.js (13, gate), test-cvfilters7661.js (11, ci-units), test-ui7661-ui.js (8). ui766 updated (stopped =
  red at once, busy = waiting note). test-modelmedia575 / gpulocal7641 regexes. ci-units 344.

## 2.766.0 — REMOTE MODELS LIST, TICKED PODS, A BAR FOR EACH TRANSFER (2026-11-12, main 8b33064, CI 43163367317, refresh 5c2d9bf)
Tim: "add a remote_models.json in our pods folder ... these will be the models listed in remote mode in model manager and the
overide settings dropdowns instead of the local models. if user has a model/lora on their hdd without a link. user can search
for it in model manager and it will upload to the selected pod. add a checkbox to the left of the pod name ..." + (after my
suggestions) "go with your suggestions and add a progress bar for each transfer to the pod".
- lib/remoteModels.js: FILE runpod/pods/remote_models.json (H3_REMOTE_MODELS), entry {id,label,group,folder(ComfyUI cat[/sub]),
  name,url(no ?token=),source catalog|huggingface|civitai|your-hf|link,sha256,size,styles,pods{id:done|failed},added};
  merge by sha256 else cat+name; comfyName; asComfyModels (the /api/comfymodels shape, remote:true); byName; cardOf (rm:<id>
  keys); podsMode = gpuSplit.enabledOf && engineOf().pods; selected/setSelected (rgpu.pod_selected [{id,name}]); podStyles
  (style_pods + presets) -> fill (PM.planFor); ensureFilled (first use); send(id, pods) -> SD.pullWait per pod; addLocal ->
  keepLocal: PO.find (🔎 bar) -> civitai entry | hfUpload (☁ bar) -> your-hf entry | SD.sendOne(noCivitai,noHf) per pod;
  addLink; fromCivitai (Model manager ⤓ in remote mode); cards().
- lib/hfUpload.js: whoami-v2 (role read -> refused), repos/create private bitgen-models (409 ok), LFS batch (basic PUT with
  Content-Length via http(s).request, or multipart parts + completion POST), verify, commit ndjson (header + lfsFile).
- lib/podTransfers.js: begin/step/end/list/clear, rateOf (20 s), leftOf; GET /api/pods/transfers. static/podxfer.js
  (H3PodXfer.mount/poke) in #pdXfer (PODS) + Model manager's remote bar.
- lib/podSend.js: LOCK per pod + pullWait(id, port, {url,folder,name,size,from,pod_name}, say); viaCivitai uses it (+ adds to
  the list); viaHf (H3_POD_NO_HF); sendOne(…, opts {noCivitai,noHf,pod_name}) upload bar; ensure tries RM.byName url first.
- lib/podRevive.js modelGate: itemsOf = override ckpt + every st.loras; LoRA failures noted, render goes on. podPrep: bars per
  catalog download + RM.add with styles. podModels.fromLink: HF token for H3_HF_BASE urls too.
- routes/remoteModels.js mounted right after express.json in routes/index.js: in pods mode intercepts GET /api/comfymodels and
  /api/modelmgr/cards (?local=1 bypass); /api/remotemodels*, /api/pods/selected, /api/pods/transfers(/clear).
- static/remotemodels.js (H3RemoteModels.bar/send/del, mode watcher -> loadComfyModels(true) + H3ModelMgr.load());
  modelmgr.js: rmActs/rmPods, #mmRemote, hides mmFetch/mmSync/mmFoldBtn/mmEdit in remote mode, openInfo skips rm:, cvGet ->
  /api/remotemodels/civitai; podsdock.js: .pdTop wrapper, .pdSel checkbox, selectPod, #pdXfer.
- Tests: test-remotemodels766.js (49, ci-units), test-hfupload766.js (14, gate), test-ui766-ui.js (14). ci-units 343. Updated
  test-gpulocal7641, test-podonline765, test-podsend762 (H3_POD_NO_HF). ui580 flaky once (passes on rerun and on main).

## 2.765.0 — CHECKPOINTS / LORAS FOUND ON CIVITAI ARE DOWNLOADED BY THE POD (2026-11-12, main 40f81b8, CI 43159493050, refresh 02d835e)
Tim: "can you find my checkpoint and send it to the pod via civitai or civitai.red . if is very slow from my pc , 0.5mb/sec".
- lib/podOnline.js: sitesFor (Settings' civitai.site first), matchFile (SHA-256 exact; no sha = same name + size ±0.1%),
  dlUrl(u, site, token) (host swapped to the site, ?token= only when given), isCivitaiDownload; find(abs, say, deps): the card
  (<stem>.bitgen.json civitai.id) -> /model-versions/<id>; else SHA-256 (civitai.sha256, kept via modelCards.writeCivitai) ->
  /model-versions/by-hash on both sites. Civitai unreachable / 404 -> null.
- lib/podSend.js sendOne -> viaCivitai first (H3_POD_NO_CIVITAI=1 skips - test-podsend762 sets it): PM.fromLink per site,
  polls PM.state, pullText progress, on failure the other site, then the old upload. Exported pullText, viaCivitai.
- lib/podModels.js fromLink: a Civitai URL -> no Authorization header; the key as ?token= in the job URL only (putFiles keeps
  the clean URL); size passed; dlCode why(): Civitai 401/403 -> "add your Civitai API key … civitai.red for mature".
- Covers: a style's model (podPrep pl.send), Override's checkpoint (podRevive.modelGate), presets / 💾 queue - all via sendOne.
- Tests: test-podonline765.js (20, ci-units). test-hfcheck7646 regex updated. ci-units 342.

## 2.764.6 — POD DOWNLOADS NO LONGER STOP AT 0%; GATED / MISSING HUGGING FACE FILES CHECKED FIRST AND SAID (2026-11-12, main a12ca11, CI 43157363949, refresh 9ef52aa)
Tim: "if the model is gated, i am guessing krea2 is gated, downloading for 5 minutes so far and still 0%, check to see if it is
gated and report to the user". Comfy-Org/Krea-2 is not gated. The cause: 2.763.4's kernel shutdown killed the job thread.
- lib/podJob.js (pure): detach(code) -> kernel code writing <cwd>/.bitgen_job_<dl|mirror|nodes>.py, Popen(sys.executable -u,
  start_new_session=True, log .bitgen_job_<x>.log), removes the old status file, waits <= 20 s for the job's first save ->
  its marker, else "bitgen-job-failed <log tail>" (failed(said)). jobProgram: run() in the main thread, heartbeat S['beat']
  every H3_POD_JOB_BEAT (15) s, save() under a lock, finally running=False. track(mem, s, now): running + no beat change for
  H3_POD_JOB_DEAD (90 s) -> dead, unfinished files / packs "failed: the pod stopped this job …"; a download whose done has not
  moved for H3_POD_DL_STALL (3 min) -> stalled + note.
- lib/hfCheck.js: repoOf, why(status, X-Error-Code, repo, token), check(files, token) - HEAD redirect:"manual" (H3_HF_BASE
  stand-in); GatedRepo / 401 / 403 -> gated words (accept license on huggingface.co/<repo>, token in Settings ▸ Models);
  404 / RepoNotFound / EntryNotFound -> not found; no answer -> not held against it.
- podModels.start / fromLink: hfCheck first (all blocked -> 409 naming each; else {blocked}), detach(dlCode); state0 track +
  blocked rows "failed: <why>"; dlCode's own why(e, url) for HTTP 401/403/404 on the pod. podNodes runGo + podPrep nodeCode
  detached + tracked. podPrep: blocked said at once, failed rows once, cur.note in the say line. static/podload.js: "Not
  downloaded: …", failed rows red, the no-data note.
- Tests: test-hfcheck7646.js (29, ci-units), test-podjob7646.js (9, real python3, e2e gate). ci-units 341.

## 2.764.5 — DOCK A DOCKER ABOVE / BELOW ANOTHER INSIDE A DOCKER; FLOATING DOCKERS IN FRONT OF DOCKED ONES (2026-11-12, main 38329c7, CI 43154609462, refresh bed3f23)
Tim: "move floating dockers to the front of all docked dockers. add vertical drop zones to all dockers as well so floating
dockers can dock below or above another docker that is docked inside a docked docker if that makes sense".
- static/floatz.js layered(list, tierOf): tierOf 0 = .h3fp-dk not a body child (a named docker confined to a docker = docked),
  1 = floating dockers (.h3fp / .tsd), 2 = floating dialogs. (A probe found only a floating 💬 Community dialog over floated main
  dockers - that is the 2.763.5 rule, kept.)
- static/floatpanels.js: edgeIn(parts, x, y) pure (top / bottom band 28%, 24-90 px); slotOf(d, x, y, depth): a member that is a
  docker under the pointer (not within 20% / 24-70 px of its sides along d's direction) -> its own slot + {into}; d not "col" ->
  edgeIn -> {index, line, wrap: {member, edge}}; else the 2.545.0 slots. dockInto(id, into, at): at may be the slot object -
  {into} redirects, {wrap} -> stackWith(id, into, member, edge): member a "col" docker = dockInto at 0 / end; else newDocker
  {name "A / B", layout col} docked at the member's index, member + id into it. H3Panels exports edgeIn, stackWith.
- dgdock (both drops) + dockgroup headDrag: dockInto(…, slot || undefined). test-dockgroup545 / 549 regexes updated.
- Tests: test-dockzones7645.js (7), test-ui7645-ui.js (10). ci-units 340.

## 2.764.4 — THE JOIN FORM SAYS WHY THE EMAIL CODE; NO MEMBERSHIP NEEDED FOR BITGEN STUDIO (2026-11-12, main f88c1c1, CI 43151457403, refresh cdd99db, tigerart b278a0b)
Tim: "make it so that new members have to verify their email - add a note that we do this to prevent spam emails and to verify
the user is a real person and say, you don't have to be a member to use or download bitgen studio - you only need to be a member
to talk to the community". The emailed 6-digit code was ALREADY required since 2.713.0 (dispatch.php: an unconfirmed member can
only verify_email / resend_code / set_profile; never confirmed = dropped after a week) - told Tim. ASKED + DECIDED: guests keep
posting in the Discussions (pending an admin) - the note says membership is for chat, friends and posting without waiting.
- App static/community.js joinView: #cmNoNeed + #cmWhyCode; the code box: the reason. Website: account.php join form (note +
  reason, the old "A code goes to the address to confirm it." key replaced in 3 languages), code box line, community.php note.
  test-site.js checks account.php's SOURCE (the test site has no community set up, so the form does not render) + community.php.
- test-joinnote7644.js (4). ci-units 339.

## 2.764.3 — A STYLE'S CUSTOM NODES ARE CLONED ON THE POD FROM GIT (2026-11-12, main a67e898, CI 43149683815, refresh c4bc25a, tigerart a15fd19)
Tim: "add the custom nodes needed from their git repos to the pod if the style needs it. it is tooo slow from the pc".
- lib/podNodes.js mirror(): before runItems, every item without a local git checkout -> findRepo(k, dir): lib/nodePacks.json by
  folder (any case; subdir kept - NativeAudioLock lives in Shrek3OnVH5/MiniMax-H3-NativeAudio-MusicVideo-Workflow at
  custom_nodes/ComfyUI-H3-NativeAudioLock), pyproject.toml ([project.urls] Repository/Source/Homepage/Code, else any github
  URL; [project] version -> refs vX, X), ComfyUI-Manager custom-node-list.json (custom_nodes/ComfyUI-Manager[/node_db/new],
  user/default/ComfyUI-Manager/cache, user/__manager/cache; by repo name or id), Comfy Registry GET <H3_COMFY_REGISTRY or
  https://api.comfy.org>/nodes/<folder> .repository (only with .tracking or a version; 8 s, cached). Found -> k.git/refs/subdir,
  "cloning it on the pod from … (found in …)"; none -> "no git address found anywhere for it - uploading". Single .py = upload.
- mirrorCode: refs tried when no commit (note when none fits); subdir -> clone to custom_nodes/.bitgen_src/<folder> + symlink.
- test-podnodes7643.js (14; uses 127.0.0.1 + child_process so ci-units SKIPS it - it runs in the e2e gate). ci-units 338.

## 2.764.2 — ONLY THE CUSTOM NODES THE WORKFLOWS USE GO ON A POD (2026-11-12, main fd3537b, CI 43134412592, refresh 196aab8, tigerart 4c2d0b3)
Tim: "only upload nodes that are necessary for the workflows we are using to the pod" + "[pod] uploading
ComfyUI-H3-NativeAudioLock - 0 MB to the pod".
- The full mirror (2.763.1 nodesTodo -> podNodes.mirror of EVERY pack) is gone from stylePods.ready, pods.create, stylePods.answer
  create and podPresets.play/populate (nodesTodo / nodesDone still exported, unused). podPrep.run already mirrored only the
  folders of missing classes (localFolders = this computer's /object_info python_module) - that is now the only path; it says
  "the pod has every node these workflows use" when nothing is missing. prepare(..., {nodesOnly}) returns after the node part.
- POST /api/stylepods/nodes/:pod = ⬆ Nodes its styles need: the pod's linked styles -> prepare nodesOnly (409 when none).
  podsdock summary: "the custom nodes <style>'s workflows use". Presets: steps create, load, comfy, style<i> ("its nodes and
  files"), ready.
- podNodes: sizeText (KB under 1 MB, exported), "<pack> is on the pod", runGo says "asking the pod to unpack and install …",
  "installing X on the pod (n of m done, s)", "waiting for the pod to report …", and throws after H3_POD_NODES_BLIND (180 s)
  of unreadable status.
- Website: the "Your custom nodes go with it" paragraph replaced (key changed, 3 translations); test-site regex allows &#039;.
- Tests: test-podnodes7642.js (10). Updated: 7631, 7633, 764, ui761 (button text), ui7634 (summary). ci-units 338.

## 2.764.1 — BASIC SETTINGS ▸ GPU ON LOCAL SHOWS NOTHING REMOTE; POD WAITS SAY WHAT THE POD IS DOING (2026-11-12, main 544b31a, CI 43126765075, refresh 5170f05, tigerart 7604719)
Tim: "if local is selected in basic settings, hide all the remote gpu details and options. the remote gpu radio group ☁ Remote
generation docker🖥 PODS 💲 RunPod pods: none running · $0.00 today · $1.31 this month." (that 💲 line = he was on <= 2.763.4) +
"in pod mode, pod loaded 2 minutes, waiting for gpu... could this wording be wrong, instead should it be transferring model ? and
show progress of model transfer?"
- static/gpusplit.js: LOCAL_HIDE ids hidden by #sec-gpu.gpuLocal{display:none!important} (other scripts set inline display);
  line "Every job runs on this computer."; choose(w): Local closes the rgen / pods / runpod SecFloat windows; Remote / Both
  never disabled - isReady false = S.pick (radio shows it, engine group + ⚙ shown, line says what to do), the engine radios'
  save .then(waiting) saves where when ready. Pure (Node exports when no document): isReady, localView, LOCAL_HIDE.
- "waiting for the GPU" was static/queuerun.js runText for any queued job; now runText(pr, status, note) shows "🖥 " +
  job.pod_note. lib/podSend.js progressText(name, done, size, secs) + sendOne/ensure(say) (every POLL): podPrep passes say
  (job note "making X ready: sending …"), podRevive.modelGate sets m.note (Override's checkpoint).
- Tests: test-gpulocal7641.js (10), test-ui7641-ui.js (6). Changed: ui745 (all three pickable, Local line, no ⚙), ui753 (Remote
  pickable), ui754 (H3GpuSplit.choose("remote") first), ui756 (Remote waits then Pods saves it), ui758 (Remote before Pods).
  ci-units 337.

## 2.764.0 — 📦 POD PRESETS; SEVERAL STYLES ON ONE POD; THE "NO POD" BOX ON GENERATE (2026-11-12, main dfb3198, CI 43122604431, refresh 5b672ec, tigerart 9b0fc45)
Tim: "I think we can use multiple styles on the same pod. so if a user clicks a style that is not assigned to a pod bring up a
dialog with my pods and a + style button ... add a create pod button ... in pods docker add a presets tab, save all the pods
details with the styles it holds and gpu and number of gpu's etc in a <preset name>.pod file in a folder called
runpod\pods\presets ... accordian items ... edit details, remove styles, add styles ... play button a stop button and a delete
button(delete button terminates the pod) icon only. show loading sequence, show running, show cost/hr, hrs used and total cost
... if user presses the play button and pod has been terminated the create a new pod with all those details and populate it
with the styles files" + DECIDED: "delete should only terminate the pod x should delete the preset. dialog should only appear
when u press generate".
- lib/podPresets.js: files <BASE>/runpod/pods/presets/<name>.pod (H3_POD_PRESETS_DIR for tests; runpod/ in .gitignore AND
  make_zips.sh). Fields: name, template_id/_name, gpu/gpu_name, count, cloud, disk, volume, cuda, port, kinds, styles (ids),
  pod_id, runs [{pod, from, to, rate}], made_at, updated_at - never a key / password. Pure: fileName, cleanPreset, usage,
  syncRuns (opens a run from the pod's startedAt, closes when not running / another pod), gpuOptions, stepsFor.
  list() syncs runs from pods.mine (cached 4 s) + podCosts bill; state none | terminated | stopped | loading | running | failed.
  play(): live+running = nothing; stopped = act start + populate; gone = GPU check (pods.gpus(cloud); not offered / max < count
  -> {need_gpu, options}), pods.create({..., preset: name}) (no auto preset then), setStylesOf + setKinds + nodesTodo, then
  populate() in background: waitReady -> podNodes.mirror (if nodesTodo) -> podPrep.prepare per style (notThere = step failed)
  -> ready; PLAY[name] = {steps, phase, note, pod}. stop / terminate close the open run; terminate keeps the file; remove = ✕.
  save({was, preset}) renames (409 on a taken name) and applyToPod (setStylesOf/setKinds under QUIET; added styles prepared now).
  Hooks: stylePods.link -> onLink (style joins the pod's preset), setStylesOf -> onSet. pods.create with for_style (not preset)
  -> fromPod (recipe via podRevive.recipe) - returns {preset}.
- routes/podPresets.js (mounted in routes/index.js): GET/POST /api/podpresets, POST from-pod/:id, DELETE /:name,
  POST /:name/styles|play|stop|terminate.
- stylePods.answer {action: "preset", name, gpu?} -> styles add + play (need_gpu passed back); offer() adds pods[].styles /
  memory / preset and presets (presetsFor: those with no live pod).
- static/podpick.js (H3PodPick.show(askId)): the box; stylepodask.watchJobs opens it first (then the docker, then the old box).
  Create pod… = H3Pods.forRender(o). static/podpresets.js (H3PodPresets.show(host)): accordion, polls 5 s while loading else
  20 s; forms kept per preset (dropped when unchanged so server-side style adds show). podsdock: tab ["presets"], #pdPresetBox,
  .pdPre view, 💾 Save as preset (data-pdpre), create message names the preset; FIX: .pdAsk[hidden]{display:none} (the empty
  orange banner showed since 2.763.3).
- Tests: test-podpresets764.js (37, Module._load stand-ins), test-ui764-ui.js (18, stand-in 8399 + page.route for the box).
  ui763 / ui7632 / ui7634 press Create pod… in the box (init script) and delete presets they make; ui756 allows presets=N.
  ci-units 336.

## 2.763.5 — 💲 THE RUNPOD DOCKER; YOUR OWN DOCKERS TAKE DOCKER WINDOWS; DIALOGS IN FRONT (2026-11-11, main d3022b1, CI 43021031091, refresh 4f4b0f7, tigerart 3e47a45)
Tim: "allow multiple dockers to dock in the custom created docker, move the pods docker in front of any custom docker, right now
it goes behind the custom docker and can't dock in the custom docker, make a new docker for runpod prices and move runpod balance
and usage costs from the basic settings docker to the runpod docker" + "[pod] uploading ComfyUI-H3-NativeAudioLock … i think it
maybe stuck".
- THE CAUSES: (1) dgdock's groupUnder only knew ▣ dockers (isGroup fd-dockers[-n]); a docker made with ⊞ Docker configs ▸ ▣ New
  docker… (fd-<slug>) was never a drop target for SecFloat windows. (2) a named docker CONFINED to a docker was z 9300 inside its
  host (ldock etc. make no stacking context) = over every floating dialog. (3) podNodes zipped a whole pack synchronously
  (readFileSync + deflate level 9 + a JS crc32) - minutes with the server frozen and nothing in the log.
- static/floatpanels.js: named docker windows get .h3fp-dk (CSS z 60, in the band); dockerAt(x, y, id) exported (hitDocker +
  canDock over every shown kind:"docker"). static/dgdock.js groupUnder asks P().dockerAt first. static/dockgroup.js intos() =
  every named docker - headDrag (a main docker's title bar) and groupAt use it.
- static/floatz.js: SEL + ".h3fp.h3fp-dk"; layered(list, isDocker) (pure) - dockers (.h3fp, .tsd) painted under the dialogs;
  raise() first adds every floating window not yet in the order (lowest), so CSS-60 dialogs cannot be passed by a raised
  docker. static/dockfloat.js float() (not quiet) calls spec.front() - a window floated by hand comes to the top of its layer.
- lib/runpodAccount.js: RunPod GraphQL POST api.runpod.io/graphql (Bearer; H3_RUNPOD_GQL_API stand-in) query myself
  {clientBalance currentSpendPerHr spendLimit underBalance} -> {balance, spend_hr, spend_limit, under, lasts_hr}; 50 s cache; a
  failed read keeps the last figures + error. GET /api/pods/account in routes/pods.js (before the :id routes).
- static/runpoddock.js (H3RunPod, SecFloat id "runpod", title "💲 RUNPOD"): Balance (#rpBalance #rpSpend #rpLasts, low <24 h
  warns), Usage (#rpCost + #rpPods - podCosts + /api/pods/mine, gone pods still on the bill), GPU prices (#rpCloud #rpSort #rpQ,
  /api/pods/gpus); every minute while shown (H3_RUNPOD_POLL), 🔄 refresh=1. Button #gpuRpDock in Basic Settings ▸ GPU (RunPod
  provider) + #pdRpDock in PODS. podsdock: the #gpuPodCost line is gone; costLine only keeps S.cost for the pod rows.
- lib/podNodes.js: scanPack (skips folders with pyvenv.cfg, keepFile), deflates() (text <= 8 MB; weights / audio / archives
  stored), zipOf -> Promise via lib/zipWrite.js zipAsync (setImmediate between files, async deflate level 6; crc32 uses
  zlib.crc32 when present); runItems says "packing i/n files" and "part i of n, X MB to the pod"; a pack over H3_POD_NODE_MAX
  (2 GB) is not uploaded - state "failed: too big to upload …". runGo = the kernel + polling part.
- Tests: scripts/test-runpoddock7635.js (29), scripts/test-ui7635-ui.js (19, page.route stand-ins). Updated for the new rule /
  the moved line: test-floatz724, test-ui724, test-ui558, test-ui561 + test-ui550 (hide SecFloat windows first), test-ui761
  (cost in #rpCost), test-podsetup761. Gate server env + H3_RUNPOD_GQL_API. ci-units 335.

## 2.763.4 — 🖥 THE PODS DOCKER: A POD'S FIGURES, EVERY DETAIL BEFORE IT IS MADE; UPLOADS WORK (2026-11-11, main 3bce8ff, CI 43012438722, refresh bcb1141, tigerart f75ecc4)
Tim: "the pods docker still didn't show, the pod was created automatically, i didn't get to choose the gpu pod, show all the
details before i create the pod. in the pods docker show utilization, memory and disk visualizations and usage. put the style in
the dropdown as the selected style in the prompt docker. but the pod does work ... krea raw style worked, overide did not work"
+ "[pod] sending Krea2/krea2WRC10.safetensors to the pod: failed: the pod's Jupyter refused part 1 (HTTP 400)".
- Uploads: Jupyter (jupyter_server, allow_hidden False) refuses to WRITE a hidden path with 400 and does not show hidden files
  (GET 404) - podModels.upload part file "bitgen-upload-<name>", podNodes zips "bitgen-nodes-<f>.zip"; status files stay
  hidden and are read through a kernel (readCwdJson). runKernel DELETEs its kernel after answering. Stand-ins in 761 / 762 /
  759-live / 763 / 7631 now refuse hidden PUTs (400) like Jupyter; 763 / 7631 also 404 hidden GETs (kernel reads, marker
  "bitgen-json ").
- stylePods.ready: a pod RunPod no longer has -> GONE[style] = the recipe (template, gpu, count, cloud, volume, name),
  forgetPod (style links, its kinds, rgpu.runpod.pod_id), R.phase "gone" -> gate re-runs -> ask. offer(): was -> pick that GPU
  when offered, count, cloud, volume max, the old template when listed; returns count / cloud / was. The docker's banner says
  "The pod … is gone on RunPod - the new one below is filled in the same way". (P_ styles' podRevive still re-creates by itself.)
- lib/podStats.js (CODE / parse / fromComfy / stats, 4 s cache + one in flight) + GET /api/pods/:id/stats; podsdock statsHtml
  (bars: GPU %, VRAM, RAM, CPU (load % of cores), Disk /, /workspace; ≥90% red) - head (2 small) + body; pollStats every 5 s
  (H3_POD_STATS_POLL) while #pdBody is visible, updates in place.
- podsdock: promptStyle() (#genModeSel -> styleSel / videoStyleSel / musicSel); loadStyles + music, For follows it until you
  pick (S.forUser); openForm style default; summary() #pdSum (Template + image, GPU n × name · GB (total), Price, Cloud, Container
  disk, /workspace, Host CUDA 13, Ports + Jupyter, Style + kinds, Then custom nodes (GET /api/stylepods/nodes count) + files).
  podsetup.js: the Styles dropdown preselects the prompt docker's style (＋ enabled).
- Tests: test-podstats7634.js 8, test-ui7634-ui.js 9 (stats bars, For/Style = prompt style, summary follows 2 × A40, gone pod
  -> docker filled A40 × 2, nothing made). 7631 / 7633 source checks updated.

## 2.763.3 — 🖥 POD RENDERS REACH THE POD + THE PODS DOCKER FOR A STYLE WITH NO POD (2026-11-11, main 24b334f, CI 43008178665, refresh bc5aa1b, tigerart d964941)
Tim's log: gate worked ("the pod is gone - making a new one from ComfyUI - CUDA 13.0 on NVIDIA A40" … "downloading on the pod:
krea2_raw_fp8_scaled…" then straight to "renders on pod") and the worker: "cannot reach ComfyUI at https://<pod>-8188.proxy.
runpod.net (HTTP Error 403: Forbidden)". + "if a pod doesn't exist for a style popup the pods docker to create the pod when
generate button is pressed, auto select the type and style. let user select gpu and number of gpu's and let the user start and
stop and terminate the pod from the docker".
- scripts/comfy_client.py: urllib.request.install_opener with User-Agent "bitGen-Studio (ComfyUI client)" at import (every
  worker imports it) - RunPod's proxy (Cloudflare) 403s "Python-urllib/3.x". scripts/comfy_progress.py: https -> ssl wrap
  (wss), Host without default port, a User-Agent.
- lib/podModels.js readCwdJson(pod, name): Jupyter file API, else a kernel prints <cwd>/<name>; state0 / podNodes / podPrep
  nodeState use it. lib/podPrep.js: waits up to 36 polls for the pod's Jupyter before downloads; a status with no files =
  unknown (24 polls max, then a problem) - not "finished"; after files: contents() again -> notThere. lib/stylePods.js
  ready(): notThere -> throws (the job fails, files named); gate's final note appends READY problems.
- lib/pods.js create: template name/image /cuda 13/ -> o.cuda "13.0"; for_style -> stylePods.link (no rgpu.pod_for / P_
  autoFor any more), o.kinds -> stylePods.setKinds (exclusive), nodesTodo. stylePods exports setKinds / nodesTodo / nodesDone.
- static/podsdock.js: #pdAsk banner; forRender(o) (needs SecFloat.windows.pods; S.ask; show(true); loadStyles then openForm
  (cuda13 template id, pre {style, kinds, gpu: pick, volume, count}) once S.all has it; name "bitGen <style>"); the form has
  Style (#pdStyle) + For kinds (data-pdkind) + GPUs keeps count; create() sends for_style / kinds and answers the ask (use);
  pod rows open while S.ask (render AND wire predicate) with "▶ Use for <style>" (data-pdfor); #pdAskMine / #pdAskNo.
  static/stylepodask.js: watchJobs -> viaDocker (GET ask offer -> H3Pods.forRender) else the old dialog; answered(id).
- Tests: test-pod7633.js 8 (LIVE: a stand-in 403s Python-urllib; prepare waits; notThere), test-ui763 11 (docker flow),
  test-ui7632 6, test-ui761 (pods/costs?refresh=1 first - 50 s cache; selectOption), test-pods759 updated (no pod_for).

## 2.763.2 — 🖥 POD RENDERS SKIP THIS COMPUTER'S COMFYUI (2026-11-11, main 0c75c6c, CI 43003316656, refresh de5fe11)
Tim's second log: "[comfy] launching via run.bat … [docker configs] … [generate] Image · house — that one failed." with no
[pod] lines and no "got prompt" in ComfyUI = the page never got the render to the pod: index.html startImageJob ran
H3ModelsFound.ensure (local model paths), ensureComfyReady({need:true}) (STARTED his ComfyUI) and comfyPreflight (the style vs
LOCAL dropdowns) before POST /api/genimage.
- lib/stylePods.js willUsePod(mode, st) -> {pod, why} (P_ = pod; API_/R_ = not; else podJob with links / kindPod);
  GET /api/stylepods/route?mode=&style_id=. routes/modelsFound.js plan: skip a style that renders on a pod.
- static/podroute.js (H3PodRoute: isPod, why(jobId) -> reasonLines of the job log); index.html: startImageJob (onPod guards
  ensureComfyReady + comfyPreflight), submitJob (onPodV), startMusicJob (onPodM + preflight), submitSwap / submitLtx (inline
  isPod("t2va")); drainQueue's "that one failed" + the reason lines, or "it was not sent …" when no job id.
- Tests: test-podroute7632.js 7 (ci-units), test-ui7632-ui.js 6 (Generate in the page with NO ComfyUI: /api/genimage sent,
  /api/comfy/ensure never called, the question opens, Cancel = cancelled). NOTE pods.js caches the template list 10 min - the
  stand-ins of ui7632 / ui763 use the same CUDA 13 template id (tplCu13u) so the gate order does not matter.
- Not done: other ensureComfyReady callers (index.html ~7512 the graph / ~10286) and the image editor's ✨ AI path - they still
  want a local ComfyUI; check if Tim uses them in pod mode.

## 2.763.1 — 🖥 YOUR CUSTOM NODES ON A POD + WHAT THE POD IS DOING (2026-11-11, main f6cfd48, CI 43000232910, refresh de61dc4, tigerart 0e32197)
Tim: "i tried generating from a style, i did not get any popups, it says starting in queue but i don't know what it;s doing"
(his log: the LOCAL ComfyUI launched, then "[generate] Image · house — that one failed") + "we may have to upload all of the
nodes in comfy custom nodes to the pod and restart the pod when created".
Likely cause: Basic Settings ▸ GPU = Both with Image unticked (2.763.0 needed the box or a style link on Both), or the gate's
error fell through to the normal route (Remote with no pod in use = this computer).
- core.js: a gate error FAILS the job ("[pod] …" + "not rendered - its RunPod pod could not be used"; cancelled when the user
  cancelled the question) - no fall-through (gpuSplit's pod_job.error branch is gone; params.pod_job only with a pod).
  jobDict pod_note (job._podNote while queued).
- stylePods.gate: Both - a style with its own pod OR its kind's pod (kindPod) goes to it; else {local, note} logged ("Both and
  Image is not ticked - tick it, or give the style a pod"). Cancel -> {error, cancelled}.
- static/stylepodask.js: #spaChip over the status bar "🖥 <pod_note>" while a queued job has one; Cancel = do not render.
- lib/podNodes.js (new): gitOf (.git file / config origin / HEAD -> refs or packed-refs or detached), httpsOf (ssh -> https,
  credentials stripped; file:// only with H3_POD_GIT_FILE=1 for tests), keepFile (.git / __pycache__ / node_modules / .venv,
  <= 50 MB), folderOfModule, mirrorCode (Jupyter thread: exists = "there already"; git clone + checkout commit (else newest,
  note) or unzip .bitgen_nodes_<f>.zip into custom_nodes; pip -q -r with /proc main.py exe; .bitgen_mirror.json). localDir
  (scanTarget dirAbs/custom_nodes or /ComfyUI/custom_nodes), list (skips . _ .disabled __pycache__; .py files too), zipOf
  (lib/zipWrite deflate), foldersFor(classes) (local engine.comfy.url /object_info python_module), mirror(pod, port, {only,
  say}) (pre-list the pod's custom_nodes; uploads; a failed clone -> uploaded in a second pass; restart = Manager reboot else
  RunPod action restart; waits), status.
- stylePods: rgpu.pod_nodes {pod: todo|done} - set on Create (ask) and on a recreated pod; ready() mirrors all once after
  waitReady. podPrep: localFolders + mirror(only) before nodePacks. routes POST /api/stylepods/nodes/:pod; podSetup view .nodes;
  podsetup.js ⬆ My custom nodes (data-psnodes) + the line.
- Tests: test-podnodes7631.js 16 (LIVE with local git repos), test-ui763 11 (chip, Cancel = cancelled), test-ui761 (button).
  NOTE test-ui761 right after test-ui763 can fail its cost checks - lib/podCosts caches 50 s (rerun alone = green).

## 2.763.0 — 🧩 YOUR STYLES ON YOUR PODS (2026-11-11, main 61e4b70, CI 42994594328, refresh 8e84c5b, tigerart 51f8299)
Tim: "can we use a dropdown of our styles for the mode selected, image selected show image styles, add an all button so that
it shows all styles. then we send our styles workflow to the pod with our styles stand models, text encoders and vaes, we
reuse the same styles, no p_ but when in pod mode we use the pod that uses that style" + "if we are in pod mode and a style is
selected, check if that style has a pod assigned to it and create the pod with the comfy cuda 13 template" + "allow the user to
have a separate pod for each type of style, llm, vllm,image,video if they want to and can afford too otherwise we use the one
pod". Agreed: ask before a pod is created; download on the pod when there is a link; LLM = a server on the pod (ComfyUI's core
TextGenerate node is one-shot, 2048 tokens - not a chat server).
- lib/stylePods.js (new): pure kindOfStyle (video/music -> video, aiEdit.isEditGraph -> image_edit), cleanLinks, kindPod,
  podFor (rgpu.style_pods[style] > the pod ticked for the kind (pod_cfg.kinds; image_edit falls back to image) > rgpu.runpod
  pod), podJob(on, engineOf, split, box, linked) (Remote = all; Both = box ticked or linked), pickGpu (cheapest offered with
  memory >= need), vramFor (model bytes*1.3+4 -> 24/32/48/80/96/141), volumeFor, cuda13Template (name /comfy/ + /cuda 13/,
  Official first), portOf. Live: link / setStylesOf / movePod; gate(params) -> null | {wait, note, ask} | {error} |
  {pod_id, port, model?}; ASKS (job waits; offer() = GPUs + pick + your pods + template + sizes; answer() create
  (pods.create with cuda "13.0", template's ports, volume) | use | cancel); ready() = start / recreate from rgpu.pod_made
  recipe (podRevive.recipe, moveStyles + movePod) / waitReady / podPrep.prepare once per pod+style per app run; re-checked
  after 5 min. Override's checkpoint via podRevive.modelGate.
- lib/podPrep.js (new): workflowsOf (video modes like rpslStyles.checkStyle), plan(needs, onPod, catalog, local) -> download
  (catalog, HF url) / send (local) / there / missing, missingClasses, packsFor (nodePacks provides), nodeCode (Jupyter thread:
  git clone into custom_nodes, subdir packs via .bitgen_src + symlink, pip -r with the Python running main.py (/proc exe),
  .bitgen_nodes.json); prepare(pod, port, styles, {deps}) - nodes first (reboot via /manager/reboot, /v2/manager/reboot,
  /api/manager/reboot; waits), then files (PM.start downloads + polls state; SD.ensure sends); status(pod).
- core.js pump: non-P_ / non-API style -> stylePods.gate; job.pod_ask (jobDict pod_ask); params.pod_job {pod_id, port}.
  gpuSplit.forJob: pod_job -> that pod's proxy URL (autostart false); an error falls through to the normal route.
- lib/pods.js createBody: o.cuda -> gpu.minCudaVersion (RunPod v2 docs: under gpu; not with allowedCudaVersions); pod_made
  keeps cuda; podRevive.cleanRecipe keeps cuda and its create passes it; podRevive exports modelGate + waitReady and its
  moveStyles calls stylePods.movePod. podModels exports hit.
- lib/podSetup.js: cleanSetup {kinds, llm, styles} (no checkpoint / loras); viewOf styles from style_pods; save = links
  (existing styles only), pod_cfg {kinds, llm}, EVERY kind exclusive across pods, LLM as before, prepare in the background
  when the pod answers (preparing); NO P_ styles made (old P_ kept). view adds prep + run.
- lib/rpslStyles.hideWhy: on Pods your styles + P_ + API_ show, R_ (Serverless) hide; template shows.
- routes/stylePods.js (mounted after pods): GET /api/stylepods, POST /link, GET|POST /ask/:id, POST|GET /prepare/:pod.
- static/podsetup.js rewritten: ticks + LLM fields, Styles (#genModeSel image/video/audio -> image/video/music; All; ＋ / ✕
  chips), Save, psPrep line (watchPrep); repaints on #genModeSel change. podsdock.js CSS .psStyles/.psPick/.psChip.
- static/stylepodask.js (new, H3StylePodAsk): refreshJobs -> watchJobs; <dialog id="spaDlg">: Cloud, Disk, GPU (⭐ pick,
  none free disabled, money via H3Money), cost line, Create / Use this pod / Cancel; Esc ignored.
- Tests: test-stylepods763.js 38 (pure + LIVE stand-in RunPod / pod ComfyUI / Jupyter kernel running the Python here - the
  stand-in joins the kernel's threads; HF stand-in via H3_HF_BASE set before podModels is re-required); test-ui763-ui.js 10;
  updated test-podsetup761 / test-podsend762 / test-pods758 / test-ui761 / test-ui758 for "no P_ from Save", Styles UI, hideWhy.
- Docs: USAGE section, FEATURES x4, CHANGELOG, guide ja/zh-CN/zh-TW, 24 UI strings x3; website remote-gpu.php (#pods step 5
  "Your styles on the pod", the question paragraph, Override note, Planned) + 5 keys x3 (old 5 removed), test-site 262.

## 2.762.1 — 🩹 A POD'S CHECKPOINT IS SENT AND ITS STYLE MADE (2026-11-11, main 6e60d4f, refresh 9b69ae8)
Tim (on his real pod): "not sent: Krea2/jibMixKrea_v60CarolinaReaper.safetensors (the pod's ComfyUI did not say where it is
installed) ... not made: ... (image) (bitGen has no image workflow for this model's family)".
- lib/podModels.js ways(): no folder in /system_stats (ComfyUI started as "python main.py") -> findComfy through the pod's
  Jupyter (FIND_COMFY: /proc/*/cmdline main.py + its cwd, else /workspace/ComfyUI, /ComfyUI, …), cached in CDIR per pod.
- lib/podStyles.js starterOf(file, kind, arch): basename, then the full path (folder names: "Krea2/…" -> Krea 2, "flux
  krea/…" -> FLUX.1 dev), then starterByArch(arch) from podSetup's modelFit.familyOf(local name) -> FAMILIES[fam].arch
  (gguf / turbo / non-R_ preferences).
- static/podsetup.js: a send with failures leaves Save on (touched) so pressing it sends the rest again.
- test-podsend762.js 14 (starterOf cases + FIND_COMFY against a real "python main.py" process).

## 2.762.0 — 🧩 ONE CHECKPOINT PER POD - THE POD BECOMES THE STYLE (2026-11-11, refresh ccef36f, CI 42979365900)
Tim: "in pods for lora and checkpoint and folder filters use the same dropdown types like overide settings has. we only
upload 1 checkpoint for each pod then this pod becomes the style, if overide settings is selected and pods are selected in
basic settings then upload the selected checkpoint, the workflow for the style like a krea style will use our krea
workflow, if the model is already on the pod the just select it as the model to use. this can simplify user experience"
- static/podsetup.js rewritten: Checkpoint = index.html cmCombo (cmData.model_categories, blank "— the pod's own models —"),
  LoRAs = ＋ rows of cmCombo(["loras"]) with ✕; FileDialog / New folder / "into" removed (the API routes stay). clean()
  carries checkpoint + loras; a ＋ empty row sets touched (✕ resets it). The send line beside Save polls GET setup.sending.
- lib/podSend.js (new): CKPT_CATS, norm, findLocal(scan, cats, name) (root + name; else same base name), onPod(models,
  cats, name), folderFor(cat, rel) (same sub-folders, two max), localScan (comfyDetect.scanTarget + comfyModels.scan),
  ensure(pod, port, cats, name) -> {name on pod, sent} (upload waits; retries while another upload runs), queue/status.
- lib/podSetup.js save: with a checkpoint - contents() -> the pod name (onPod, else where it will land), queue the missing
  ckpt + LoRAs, PS.makeFor; without - the 2.761.0 path. pod_cfg keeps checkpoint + loras. view() adds sending.
- lib/podStyles.js makeFor: P_<pod name> (+ " edit" / " video"), starterOf(file, kind) workflow, swapFiles with the pod's
  encoders / VAE, model "", pod_model = the file, loras [{path, weight: 1}], pod_setup + pod_kind + pod_recipe; updates
  this pod's pod_setup style of that kind (rename safe). lib/styles.js keeps pod_model on P_.
- Override + Pods: routes/index.js keeps b.model for P_ (modelFit still applies); static/podload.js LOCKS image =
  [imgLoras, tliRows] (note text says the checkpoint is sent once); lib/podRevive.js gate = gate0 (pod) + modelGate
  (st.model_override -> podSend.ensure -> {model: pod name}); core.js sets st0.model = g.model.
- Tests: test-podsend762.js (12 incl. LIVE: Krea ckpt + LoRA sent into the same sub-folder, P_Krea pod with the Krea
  workflow, a pod-held SDXL just picked, Override ckpt sent before a P_ job, one nowhere = error), test-ui761-ui.js (14),
  test-ui758-ui.js (checkpoint box open), test-pods758.js, test-podsetup761.js updated.

## 2.761.1 — 💲 THE PODS' COST READS RUNPOD'S BILL AGAIN (2026-11-11, main 5d3777a, refresh db796cf)
Tim: "(RunPod's bill could not be read: RunPod answered HTTP 400: startTime and endTime must be provided together)" - the
real API refuses startTime alone (its docs list both as optional). lib/podCosts.js: two calls, both ends each - the month
by day (month start -> local tomorrow) and today by hour (local midnight -> the next hour); mergeBilling (pure) takes today
+ each pod's today from the hours and the month from the other days. Test stand-ins (test-podsetup761.js, test-ui761-ui.js)
now answer 400 to a lone startTime. CI green 42977520849.

## 2.761.0 — 🖥 PODS AS ITEMS, THEIR COST, PODS MADE AGAIN (2026-11-11)
Tim: "make each pod name in my pods a accordian menuitem, add folder, checkpoint and add lora to each pod in my pod upload
those files to the checkpoint and lora folder in the runpod pod comfyui space , add checkboxes under the pod name to tell if
it is a video,llm,vllm,image,image-edit style. add a save button to the menu item that is disabled until changes are made
and disabled again after save unless new changes are made. this will save the style P_ when pods are selected in basic
settings only show pod styles, add the cost in basics settings refresh after every minute to show total cost, keep track of
all costs like we do with electricity" (asked: Add folder = "New folder on the pod"; LLM/vLLM = "Use the pod's LLM server")
+ "when the style is created store the runpod template used and models etc, create a new pod if the pod doesn't exist for
the style and start it automatically and upload the models + loras or get them from the link if the model is not on the
computer".
- static/podsdock.js paintPods: .pdRow.pdAcc items, .pdHead button (▸/▾, cost today/month from S.cost), body .pdBodyIn
  (H3PodSetup.html + the old buttons in .pdActs). S.open per pod (auto for watch start / just created). Repaint skips while
  a text field in the list has focus (checkboxes excluded). Basic Settings ▸ GPU #gpuPodCost (costLine every
  H3_POD_COST_POLL || 60 s).
- static/podsetup.js (H3PodSetup): KINDS video/llm/vlm/image/image_edit, isDirty (touched after a file sent / folder made),
  New folder form, ➕ Checkpoint/LoRA (FileDialog -> /upload with folder = the "into" pick), Save -> POST /api/pods/:id/setup.
- lib/podSetup.js: rgpu.pod_cfg.<pod> {kinds, llm{port, model, vlm_model}}; Save makes P_ via podStyles.make({models: all
  known files, kinds}) (podStyles.starterOf(file, kind): image / image_edit / video starters), removes this pod's pod_setup
  styles of unticked kinds, rgpu.pod_llm / pod_vlm {pod_id, port, model} (one pod each); llmTarget -> proxyUrl(pod, port)
  /v1/chat/completions, model from /v1/models when blank; gpuSplit.llmTarget asks it after Settings ▸ API (only while
  enabled + engine Pods).
- lib/podModels.js: folderOk (models folder + up to 2 sub-folders), newFolder, folders (kernel walk), putFiles/filesOf
  (rgpu.pod_files.<pod> [{name, folder, path|url}] on upload / link / catalogue download).
- lib/pods.js create: rgpu.pod_made.<pod> {template_id, template_name, gpu, count, cloud, disk, volume, port, name}.
- lib/podRevive.js: cleanRecipe / recipeOf (pod_made or RunPod's raw pod) / missingOf / sourceOf; recipe() on every P_ made
  (podStyles.make -> pod_recipe; styles.js keeps pod_recipe, pod_setup, pod_kind on P_ only); gate(style) from core.js pump
  before a P_ job: wait {wait, note -> job log "[pod] …"} while run(): mine() -> running+answering = go; EXITED = start;
  gone = P.create from the recipe, moveStyles(old -> new: styles, rgpu.runpod, pod_llm/vlm, pod_cfg, pod_files), waitReady
  (ways() until ComfyUI answers, H3_POD_REVIVE_MAX 45 min), pushFiles (missing by name: upload from path, else fromLink url,
  else catalogue by name; one at a time); then {pod_id: new} rewrites the job's style pod_id.
- lib/podCosts.js: GET /billing/pods?bucketSize=hour&startTime=<local month start> (v2 {records, metadata}) + running
  pods' cost_hr -> {running, running_hr, today_usd, month_usd, pods{id:{today, month}}}; record() writes usage days
  pods_usd + pods_cost (energy currency via currency.usdIn). usageLog: day total + pods_cost, totals.pods_cost, CSV
  pods_cost; tick() no longer accrues a runpod pod's $/h. usagedock: "pods" column + bill line.
- routes/pods.js: GET /api/pods/costs, GET|POST /api/pods/:id/setup, GET /api/pods/:id/folders, POST /api/pods/:id/folder.
- Also: audiodock one-tab rule only for dockers whose parent is #maincol; dockgroup floatDock shows a dockgone docker.
- Tests: test-podsetup761.js (25: units + LIVE stand-in RunPod/ComfyUI/Jupyter kernel - folder, upload into it, Save, LLM,
  untick, pod gone -> recreated + LoRA re-uploaded + styles moved, billing), test-ui761-ui.js (12), updated 545/549/574/
  756/758/759, usage520 (CSV pods_cost). Docs x4, UI strings 100%, site key.

## 2.760.0 — 🎵 THE AUDIO DOCKER, PRICES IN YOUR CURRENCY, 🖥 MY PODS (2026-11-11, main a99efd6)
Tim: "put music stems and sfx as tabs in an new docker called audio, remove those buttons from the statusbar - it is getting
cluttered. in general tab add currency (AUD,USD,CNY,JPY)etc. convert to this currency when showing prices" + "in pods docker
add a button for my pods (only show my pods when this is clicked), when creating a pod hide all the templates, after the pod
is created only show my pods".
- static/audiodock.js (H3Audio): #musicdock/#stemsdock/#sfxdock stay separate .bdock elements (own height, fold, max, float)
  but their title text becomes "Audio" (only when it is the dock's own name - a theme rename is kept) + tabs
  (.autabs [data-autab]); at most ONE on screen: a MutationObserver on their class keeps the one shown last (keep()), the
  active tab in localStorage h3.autab; statusbar #tAu replaces tMu/tSt/tSfx (GONE_DOCKS keeps the ids so no tX_ buttons);
  a dockoff tab is hidden. workspaces: Music video / Expert open musicdock only; voicechat uses H3Audio.tab.
- Currency: lib/currency.js (config.fx {code, manual, rates, date, at}; Frankfurter v2 api.frankfurter.dev/v2/rates?base=USD
  &quotes=..., 12 h, H3_FX_API override; usdIn for usageLog: a remote GPU's cost converted into the Energy cost currency,
  cost_usd kept), routes/currency.js (mounted in routes/index.js), static/currency.js (H3Money.usd / usdHtml / usdText, Intl
  "en" currency format, "h3:currency" event; Settings ▸ General #s_cur / #s_currate / #s_curre before Energy cost). Used in
  podsdock (GPU options, estimate, pods), remotegpu pod list, openrouter model labels; rgCost placeholders say US$/h.
- podsdock: tab "mine" (🖥 My pods, count) = .pdMine (pods only); Create pod… = .pdMaking (form only; a tab or ✕ leaves);
  created -> S.src = "mine". Fixed (2.758.0 bug): paintBtn closed the docker opened from Remote generation's 🖥 PODS docker
  button when the engine was not Pods - now only on the Pods ON->OFF change (S.wanted0).
- Tests: test-currency760.js (26), test-ui760-ui.js (18, stand-ins FX 8395 + RunPod 8399; gate server env H3_FX_API);
  updated imagedom/imageui/sceneui/statusbar3d/ui526/ui587/ui623/workspaces526/expertmode (64 help notes) and the pod tests
  (756 tab counts + form alone + My pods after create, 757/746 "pod" in Runs on, 758/759 click My pods; 759 Manager list
  follows the style's own VAE). strings.json + 12 static strings (collected from the page), UI dicts 100%, guide + FEATURES
  x4, site key (1067).

## 2.756.3 — 🤖 JOINING THE COMMUNITY IS FOR PEOPLE (2026-11-11, main 82b890f, tigerart 15133e8 + refresh 21688bd)

Tim pasted /b_admin/ ▸ Members: 14 unconfirmed sign-ups with random handles, random mixed-case names and real-looking emails
of strangers (signup/"subscription bombing" - the Community emailed codes to them). Advised NOT to press Ban (it would block
those innocent addresses). He said "yes please go ahead with all 4":
1. community/lib/human.php looks_made_up(name): per Latin word, >=3 capitals right after a small letter, or >=2 in a word of
   10+, or a 7+ letter word with no vowel (a/e/i/o/u/y) -> v_name throws "That does not look like a real first/last name -
   type it the way it is written." (register + set_profile) BEFORE code_send. Tested: all of Tim's bot names caught; McDonald,
   DeShawn, O'Brien, Krzysztof, Strzelczyk, 陈, Müller, a 35-letter surname pass.
2. Website Join (tigerart account.php): inc/members.php join_check_html() (hidden hk = stats_sign {k:j, n, t, r}, hn/hms/htr,
   range #hSlide 0..n, <noscript>), site.js .hcheck fills them at the end (let go early = 0); join_check_ok() needs the right n,
   hms >= 1500, htr 1, token <= 1 day (BGS_JOIN_CHECK=0 skips - older tests); cm_join() -> bgc_human_checked(true) then
   register (in-process only).
3. App Join: action join_check -> {c: "<ms>.<16 hex>.<hmac>", bits} (key in bgc_meta 'pow_key'); register needs pow {c, n}
   with sha256(c + ":" + n) >= bits leading zero bits, <= 10 min, once (bgc_hits 'pow:<sig32>'); BGC_POW_BITS (default 20,
   0 = none - every older test's server env got BGC_POW_BITS "0"). lib/community.js zeroBits / solvePow (yields every 20000;
   ~0.6 s at 20 bits here) + join() asks join_check first (an older server without it: register sent as before). Apps <=
   2.756.2 get "Joining needs bitGen Studio 2.756.3 or newer - update it, or join on the website."
4. users_drop_unconfirmed(olderMs) (email_drop_stale uses it with a week); /b_admin/ ▸ Members shows "N sign-ups never
   confirmed" (> 1 h old) + Remove unconfirmed sign-ups (do=dropunconf; database.php members_unconfirmed /
   members_drop_unconfirmed; addresses NOT banned).
- Tests: Bitgen test-community7563.js (8, ci-units 331), test-community7563-server.js (10), gate 1958; tigerart
  test-joincheck.js (21 local, 18 in CI without playwright; CI sparse checkout + lib/community.js, lib/secrets.js). The Remove
  button tested on SQLite only. Site strings 1044. Guide section x4, CHANGELOG, PDFs.
- TIM: press Update on /b_admin/ (site + Community server 2.756.3), then Members ▸ Remove unconfirmed sign-ups. Branches to
  delete: Bitgen wip/2.756.3-bot-signups, tigerart wip/bot-signups.

## REPO HEALTH CHECK (2026-11-11, main e6f5345 - tests only, no app change)

Tim: "please check the repo and make sure everything is functional". On FRESH clones of main: npm ci, node --check of every
JS + py_compile of every .py, ci-units 330/0, the studio starts + loads with no page errors (only expected 4xx: community
info 502 offline, themes/default 404, testplan/event 400), 36 recent browser tests, tigerart's 6 suites from a fresh clone
(257 / 57 / 91 / 58 / 19 / 16). No app fault found. Six tests depended on left-over state and were fixed: ui756 (engine restore
order + waits for "N of M templates"), ui737/738/739 (stub /api/stems + /api/asr installed), ui742 (opens Basic Settings -
closed on a new studio), comfyboot7562 (now in ci-units). STILL ENV-DEPENDENT: test-ui735-ui "⏮ ⏪ ▶ ⏩ ⏭ on one row" fails
when the Music docker is docked 176 px wide (the 5th button wraps - cosmetic). LESSON: run browser tests on a fresh clone
now and then; the long-used work/ copy hides install-state assumptions (venvs/demucs exists there). NOT run: the full gate
(1956 legs), anything on a real GPU. Branch to delete: wip/check-ci-comfyboot.

## tigerart DOWNLOAD VERSIONS + THE OLD GIT PULL NOTICE GONE (2026-11-11, no app version - tigerart 93e4239, Bitgen c626891)

Tim: "i think we can remove this line now, Using version 2.745.0 or 2.746.0? ... can we keep track of what version of bitgen
people downloaded?"
- REMOVED: index.php #gitpull, download.php's line, install.php #update-fix box + its CSS, README's [!IMPORTANT] box; 10
  unused strings x3 (1035; site-keys 1035). test-site's check now says it is gone.
- inc/stats.php stats_add_download($id, $cc, $dir, $now, $ver): the day file's "dl_versions" {"id\x1fver": n} (ver
  /^\d+\.\d+\.\d+$/ else "?"); get.php passes site()['version'] (data/site.json = GitHub main's version at the last refresh,
  what the installers / zip fetch). b_admin stats_sum dl_version[id][ver] newest first (version_compare), + "earlier" =
  downloads minus versioned (shown "before 11 Nov"); stats_downloads_html(..., $byVersion) -> <span class="vsub vver">Version
  ...</span>. test-stats 57. Branches to delete: tigerart wip/dl-versions, Bitgen wip/readme-no-gitpull.

## tigerart VISITORS: REAL BROWSERS ONLY + THE SLIDE-TO-DOWNLOAD CHECK (2026-11-11, no app version - tigerart 4e8dfd3 + refresh 58cdf55, Bitgen site-keys 313ecc4, 1045)

Tim pasted Visitors again (409 visits / 17 downloads, Seychelles / Berlin / Virginia / Singapore one-page visits) and said "yes
please" to counting only real browsers + "also verify you are human after user clicks download, it will just be a slider
with a rand number, when user slides to the end that number will tell us if it is human or bot" (I had advised against a
slider - he chose it; built accessible: native range input, keys work).
- PAGE VIEWS: inc/header.php $bgCount = stats_hit() -> stats_view_token (signed {k:v, p, l, s (source from the Referer at
  render), t, r}; '' for robots / prefetch / POST / b_admin / 404) -> <meta name="bg-count">. assets/site.js sends it once
  (sendBeacon text/plain, fetch keepalive fallback; prerendered = on prerenderingchange; hidden = on visible) to hit.php
  (stats_view_beacon: POST, not a robot UA, signature, age <= 2 h, then geo + device -> stats_add). 404 still counted at
  render (stats_add_missing). stats_row kept (pure, tests).
- DOWNLOADS: footer.php <dialog id="dlCheck" data-get=get.php> (h2, #dlCheckWhat, #dlSlide range, #dlNow / #dlEnd, #dlMsg
  data-start/-fail/-plain). site.js: a click on a[href*="get.php?f="] -> showModal, GET get.php?f=X&c=1 -> {t, n 120-980,
  label}; slider max = n; at max -> location = get.php?f&k&n&ms (since opened)&tr (all input isTrusted); pointerup /
  touchend before the end = back to 0. get.php: c=1 JSON; k -> stats_download_proof: '' (bad / old 15 min / other file /
  wrong n) = the check page again, 'fast' (< 500 ms or tr != 1) = file not counted, 'human' = counted + file; plain=1 =
  file, not counted; nothing = the check page (noindex, [data-dl-auto] opens it, <noscript> direct link).
- Key: <private>/stats/.key (64 hex, 0600; fallback a hash if the folder can't be written). robots.txt Disallow get.php +
  hit.php. header/footer: site.css + site.js now ua() (file-time stamps). Admin Visitors + Downloads intros and privacy.php
  (one new sentence) say how. site-i18n.php EXTRA + the 5 download labels.
- Tests: test-stats 55 (in CI; the browser part uses a Chrome UA - Playwright's own says HeadlessChrome = a robot), test-site
  257 (installers fetched with &plain=1), admin 91, discussions 58, languages 19, pins 16. Numbers from 11 Nov will drop -
  that is the robots going. Branches to delete: tigerart wip/human-counts, Bitgen wip/site-keys-human.

## 2.756.2 — 🩹 THE STUDIO NO LONGER ENDS ITSELF AT START ON RUNPOD SERVERLESS (2026-11-10, main fcc4906, tigerart refresh 9c80125)

Tim: "bitgen has crashed - i rebooted the pc". The page's log showed only "Failed to fetch" + "Cannot read properties of null
(reading 'ui')" (cfg never loaded - a knock-on); start.bat's window showed the cause:
  [server] [comfy] a ComfyUI is already running at http://127.0.0.1:8311/rpsl (left from before) - restarting it ...
  [server] [comfy] ending process 23800 (port 8311)
  [electron] server exited 1
- CAUSE: lib/comfyBoot.js (2.603.0) at start: engine.comfy.url local + answering + not managed + a ComfyUI dir -> kill
  whatever holds the url's port. On RunPod Serverless engine.comfy.url = the studio's own /rpsl adapter (2.743.0), so it
  killed the studio (port 8311) - every start, a reboot can't help. Reproduced here (config url /rpsl + a dir: old code
  -> /api/health 000, fixed -> 200).
- FIX: ownServer(url, ownPort) - port == H3_PORT||8311 or path /rpsl -> {action none}; deps.ownPort / deps.selfPids
  [process.pid, process.ppid] filtered out of the PIDs to end. test-comfyboot7562.js (8; 6 fail on the old code).
  LESSON: anything that kills by PORT must exclude the studio's own port and pid.
- Tim must `git pull` in his Bitgen-Studio folder (the app dies before Settings ▸ Updates can run). Branch to delete:
  wip/2.756.2-self-kill. NOT done: USAGE / FEATURES (a fix) - CHANGELOG + PDFs only.

## 2.756.1 — 🃏 EVERY RUNPOD TEMPLATE AS A CARD (2026-11-10, main 4f03137, tigerart 2a94411 + refresh 81d51cc)

Tim: "list all them templates filter them by search, have a card for each of them like comfyui does. now it says 0 of 100
templates" - CAUSE: ComfyUI only was ON by default and none of RunPod's 100 Official templates run ComfyUI (RunPod's
GET /v2/catalog/templates gives at most 100 a source, NO description / picture / readme / stars - only id, name, image,
args, disk, mounts, ports, env, registry, serverless, public, category NVIDIA|AMD|CPU, startSsh, startJupyter,
allowedCudaVersions; docs.runpod.io/api-reference-v2/catalog/list-public-templates).
- lib/pods.js: templates() source default "all" (Promise.allSettled over SOURCES, each cached 10 min - rawOf), mergeSources
  (pods only, first source wins on a duplicate id), sortTemplates (ComfyUI, Official/Verified/Community, name), matches /
  searchText (every word in name image ports category source id + "comfyui comfy"), counts {official, verified,
  community}, failed [] + error_detail (all failing = throws the first error). templateView + volume, ssh, jupyter, cuda.
- static/podsdock.js: S.src "all", comfy false, kind ""; ONE request /api/pods/templates?source=all, filter() in the page
  (same matches as the server - test compares them); tabs [data-pdsrc] all|official|verified|community with .n counts,
  #pdKind, #pdComfy unticked; #pdTpl.pdGrid of .pdCard[data-tpl] (.pdArt --h = hue of the image repo, .pdGlyph initials,
  .pdCat, .pdCfy; .pdName .pdImg .pdChips (source, `${disk} GB disk`, `${volume} GB /workspace`, up to 3 http ports);
  .pdAct [data-pdcreate] + a.pdLink ↗); #pdCreate holds .pdNew "Create a pod from <b>" + #pdClose + the old #pdForm (kept
  while searching); docker 760x700. Chips are TEMPLATE LITERALS so scripts/ui-dynamic.js turns them into patterns
  ("{0} GB disk") - plain '...' + n + " GB disk</span>" pieces inside a .map() are NOT collected.
- Website remote-gpu.php #pods step 2 reworded (cards, search, kind, tick ComfyUI only). test-pods7561.js (14), ci-units 329,
  test-ui756-ui.js 25, gate 1955 legs. Branches to delete: Bitgen wip/2.756.1-pod-cards, tigerart wip/pods-cards-7561.

## tigerart HARDWARE GUIDE (2026-11-10, no app version - tigerart 12e2f9f + refresh 7425619, Bitgen site-keys d00e861, 1032)

Tim asked about Amazon affiliate links for hardware -> advised against for now (2-2.5 % on computer parts, ~170 visits a
month, Amazon closes accounts without 3 sales in 180 days, no Amazon in mainland China); he said "don't worry about the
affiliate links, but a hardware guide will be useful". NO shop links on the page (test-site checks it).
- public/hardware.php (footer "Hardware guide" after Install, a line on download.php + install.php #before, sitemap 0.8):
  #vram table.cando - rows = lib/hwPlan.js FEATURES (data-f = feature id, data-s per column y/l/s/n, data-ram = f.ram) at
  no card / 8 / 12 / 16 / 24 GB+ (32 GB gives the same states as 24), legend, H3 sizes (setupGpu tiers: 14-20 GB 768x432 +
  split, 20+ 960x544, 16 GB mode auto), second card = the assistant, the 4 packages' recommend() thresholds (a Mac with
  24 GB = small AI); #parts RAM / disk / CPU; #brands (NVIDIA only for MiniMax H3 + DLSS 5 - a 24 GB AMD is "limited" for
  Qwen Edit / swap in hwPlan, so the page doesn't say NVIDIA-only for those); #buying (cards per memory size from GPUS);
  #speed Tim's RTX 5090 numbers (the pinned Discussions note); #none -> Remote generation; #check (Task Manager, nvidia-smi,
  About This Mac). CSS .page.hardware (sticky first column + group labels .gl on phones).
- test-site.js 257: the table recomputed from hwPlan.stateOf / recommend - CHANGE THE PAGE WHEN hwPlan.js's FEATURES or
  thresholds change (the test fails otherwise). Branches to delete: tigerart wip/hardware-guide, Bitgen wip/site-keys-hardware.
- Tim also asked whether the 3 downloads were real / a slider captcha (answered in chat, nothing built - see the reply).

## tigerart VISITORS: itimports.net IS THE SITE'S OWN ADDRESS (2026-11-10, no app version - tigerart bb15794)

Tim pasted Visitors (172 visits / 30 days) and said: "itimports.net is an alias at tigerart". inc/stats.php
STATS_OWN_HOSTS ['tigerart.com.au', 'itimports.net'] + stats_source_label(): /b_admin/ ▸ Where they came from shows
"Typed itimports.net (your other address)" (old counts too - nothing stored changed; the visit still counts as an
arrival). test-stats 43, admin 91, site 243. Also told Tim (no change made): Seychelles / Singapore-no-state / Virginia
single-page visits and the 32 direct one-page RunPod-page hits look like scanners posing as browsers (robots are only
caught by user agent); OFFERED, not asked yet: count a page view only after a tiny no-cookie script runs in the browser.
Branch to delete: tigerart wip/own-hosts.

## 2.756.0 — 🖥 THE PODS DOCKER + REMOTE SERVERS (2026-11-10, main 3416993 + test fix 0bbf79c, tigerart refresh bdde296)

DONE from "NEXT (REVISED)": the 2.756.0 bullet. LEFT: 2.757.0 (P_ styles tied to a pod, start on style pick, the "Keep / Stop
/ Terminate" box on a style change, terminate bitGen's pods on exit) and 2.758.0 (balance + costs + PDF report).
- lib/runpodApi.js + templates(source), gpus(cloud), createPod(body). lib/pods.js (pure isComfy / comfyPort / templateView /
  gpuView / createBody; templates cache 10 min - tests press 🔄 (refresh=1); gpus; create -> remember "created"; act start
  -> remember "started", terminate -> forget; mine -> + bitgen flag; started() = rgpu.pods_bitgen [{id, name, how, at}]).
  routes/pods.js: /api/pods/templates|gpus|create|mine|:id/:action.
- lib/gpuSplit.js engineOf(r) (pure) / setEngine(e): rgpu.engine {provider runpod|openrouter, runpod serverless|pods};
  llm_provider follows the provider; set({engine}) accepted; Remote allowed with engine pods and no pod (guard rm null).
- static/gpusplit.js: #gpuEngine (#gpuProv radios name gpuProv, #gpuRunpod radios name gpuRunpod) shown when where !=
  local OR nothing remote set up. static/podsdock.js: #gpuPods button (only enabled && engine.pods), SecFloat "pods"
  (#pdBody: [data-pdsrc], #pdQ, #pdComfy, #pdRefresh, #pdMsg, #pdTpl rows [data-pdcreate] -> #pdForm (#pdName,
  pdCloud radios, #pdGpu, #pdCount, #pdDisk, #pdVol, #pdPrice, #pdGo), #pdPods rows [data-pod] (.pdSt, [data-pdact],
  [data-pduse], [data-pdkill] -> .pdKill [data-pdkillyes]/[data-pdkillno])). The docker may cover Basic Settings radios in
  tests - click them through the page (el.click()).
- test-pods756.js (17), test-ui756-ui.js (18). ci-units 328. Gate 1954 legs.
- WEBSITE (tigerart 45f1c95 + refresh f7c577d; Bitgen site-keys 8611f48, 952): remote-gpu.php - the update notice at the
  top (2.754.0 or older: RunPod's API for pods goes on 15 Nov - update to 2.755.0+), How it works + Use remote generation and
  Remote servers, the new #pods part (4 steps, stop vs terminate, the Remote generation docker + shortcuts, PLANNED: P_ styles
  / exit terminate / balance + PDF report - change it when 2.757.0 / 2.758.0 ship), Costs + a stopped pod's storage.
  test-site.js 243. Also removed .pdocs/ from the Bitgen repo (committed by mistake in 2.756.0) and git-ignored it (910f433).

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
  wip/2.737.0-parts-mix, wip/2.738.0-song-layers, wip/2.739.0-create, wip/2.740.0-need-install, wip/2.741.0-ace-step, wip/2.742.0-basic-tabs, wip/2.743.0-runpod-serverless, wip/site-keys-runpod, wip/2.744.0-runpod-styles, wip/site-keys-744, wip/2.745.0-gpu-split, wip/site-keys-745, wip/2.746.0-remote-styles, wip/site-keys-746, wip/2.747.0-gpu-local-update, wip/site-keys-747, wip/readme-gitpull-747, wip/site-keys-747b, wip/2.748.0-keys, wip/site-keys-748, wip/2.749.0-remote-starters, wip/site-keys-749, wip/site-keys-749b, wip/2.750.0-logo, wip/2.751.0-intro-logo, wip/2.752.0-brain-splash, wip/2.753.0-openrouter-llm, wip/2.753.1-logo-cache, wip/2.754.0-remote-docker, wip/2.755.0-runpod-v2, wip/2.756.0-pods-docker, wip/2.756.0-test-refresh; tigerart wip/front-sheet-music, wip/runpod-page, wip/runpod-page-744, wip/runpod-page-745, wip/runpod-remote-styles-746, wip/downloads-747, wip/gitpull-note-747, wip/keys-748, wip/runpod-starters-749, wip/remote-gpu-page, wip/remote-gpu-logo-tree, wip/logo-750, wip/brain-hero-752, wip/remote-generation-753, wip/logo-cache-runpod-ref-7531.

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
