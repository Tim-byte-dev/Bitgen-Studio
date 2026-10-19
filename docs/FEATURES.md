# bitGen Studio — Feature Reference

bitGen Studio is a local, offline AI video and image studio: no accounts, no cloud, nothing leaves your computer. It drives ComfyUI and local models (MiniMax H3, LTX 2.5 / 2.3, Wan 2.1 / 2.2, FLUX, SDXL, Qwen Image and more) with a local LLM that writes prompts and screenplays, and puts everything around them in one window: a scene board for films and music videos, a full timeline editor, a layered image editor with vector, CAD and AI tools, parametric 3D bodies, and bridges to Blender, Daz Studio and Unreal Engine 5.8. This reference lists every feature so far, grouped by area.

## The workspace

The window, its dockers, the look of the app, projects and the files they hold.

### The window and the menu bar

- **Dockers in one window** — the left dock (system stats and settings), References, Assets, the centre dockers (Preview, Timeline, StoryBoard, Music, Stems, SFX, Image editor, ComfyUI, Prompt, Prompt chat, Console), the Queue and the Gallery. *Where:* the main window
- **The menu bar** — New project, open, save, screenshot, record, recycle bin, reset project, settings and eject every loaded model, in one row that stays put whichever docks are shown. *Where:* the row under the title bar. *Since:* 2.382.1
- **Search in dropdown lists** — every list with 8 or more items opens with a search box: type to narrow it (word starts, then the letters in order), arrows and Enter to pick, a letter opens it searching. *Where:* every dropdown list; Settings > General > Dropdown lists. *Since:* 2.478.0
- **Statusbar docker buttons** — every docker has a button that is lit while it is on screen (open or collapsed); a click hides it, another shows it again. *Where:* the statusbar. *Since:* 2.386.0
- **System stats** — live readings of the computer, with a frame and graphs (temperature, VRAM) for each graphics card. *Where:* the left dock
- **Power draw and clock speeds** — each graphics card's watts (to its limit) and clocks, the CPU's clock (and power where the computer reports it), the energy since start. *Where:* the System stats. *Since:* 2.517.0
- **The energy a job used** — Wh / kWh (graphics cards + CPU where it can be read), average and peak watts, on the job's log, its card and the project's job list. *Where:* the Queue's Done tab. *Since:* 2.517.0
- **Eject models** — unloads every loaded model to free the graphics card. *Where:* the menu bar
- **Frameless app window** — the studio opens as its own window with a custom title bar instead of a browser tab; the browser still works. *Where:* the desktop app. *Since:* 2.45.0
- **The Console** — the live log of ComfyUI, the workers and every job. *Where:* the Console docker
- **The ComfyUI docker** — ComfyUI's own interface framed inside the studio, with reload and open-in-a-browser buttons. *Where:* the ComfyUI docker. *Since:* 2.120.0
- **Tooltips everywhere, Expert mode** — every button has a tooltip; Expert mode hides the help paragraphs once you know your way around. *Where:* Settings > General
- **Space pauses anywhere** — Space pauses the canvas, the live preview or a video in the Preview docker, unless you are typing. *Where:* anywhere. *Since:* 2.410.0
- **Media viewer** — click any thumbnail to open it full-window: slide through the list, zoom at the pointer, pan, play videos and sounds, open the original. *Where:* the Gallery, Assets and References. *Since:* 2.80.0
- **Render details in the viewer** — the preview dialog shows a picture's or clip's seed, CFG, steps, sampler, model, LoRAs, size, render time and prompt. *Where:* the preview dialog

### Dockers and layout

- **Collapse and maximize** — every docker collapses to its header or is maximized; the others stay open at their own height, Esc restores. *Where:* each docker's header
- **Pins** — a pin keeps a dock's height (or a side dock's width) as it is now; it can be made smaller but not taller. *Where:* the first button in each dock's header. *Since:* 2.381.0
- **The remembered layout** — every dock's state, height, width, pin and maximize are kept in docker_status.json and loaded before anything paints. *Where:* the install folder. *Since:* 2.381.0
- **Docker configs** — save a layout for each set of dockers you open together (sizes, which are on screen, the side docks and the floating panels), up to six screen sizes per set, loaded automatically. *Where:* the Docker layout button at the right of the menu bar. *Since:* 2.392.0
- **Floating prompt docker** — the prompt docker floats as its own window; drag, resize, collapse, or dock it above, below or beside another docker. *Where:* key P. *Since:* 2.389.0
- **Floating Basic Settings and LLM tokens** — both are dockers of their own: float them, dock them as a tab in another docker, beside or inside a column, or in the left docker's list. *Where:* keys S and L. *Since:* 2.393.0
- **Named dockers** — make an empty floating docker with your own name and dock floating panels into it as tabs; it can float over the whole app or stay confined to one docker. *Where:* Docker layout > New docker. *Since:* 2.438.0
- **Dialogs in the middle** — dialogs and message boxes open in the middle of the screen, or where you last moved them. *Where:* dialog_layout.cfg. *Since:* 2.438.0
- **Panel layout file** — where every floating panel is, its size, name and tabs are kept in panel_layout.cfg. *Where:* the install folder. *Since:* 2.438.0
- **The StoryBoard floats** — the video docker can become a window of its own, dock as a tab in a named docker, or go back under the timeline. *Where:* the StoryBoard header. *Since:* 2.456.0

### Themes and the look

- **Themes** — Dark, Darker (OLED black), Slate, Light and High contrast change the whole app, image editor included. *Where:* Settings > Themes. *Since:* 2.432.0
- **Accent colour** — any colour for the buttons, lit tabs and sliders. *Where:* Settings > Themes. *Since:* 2.432.0
- **UI size** — one slider scales every font and panel together, 60 to 175 %. *Where:* Settings > Themes. *Since:* 2.432.0
- **Customize colours** — a colour for each part of the theme (background, panels, lines, text, OK, error, hover, canvas, selected). *Where:* Settings > Themes > Customize. *Since:* 2.435.0
- **Saved themes** — save a theme as a .json in the themes folder, load it from its card, export and import it. *Where:* Settings > Themes. *Since:* 2.435.0
- **Edit theme mode** — click any element on screen to pick it and change its font, size, colours, shadows, corner radius or icon, for this element, all like it, or its whole kind. *Where:* the brush button in the top bar. *Since:* 2.443.0
- **Dialogs keep working in edit theme mode** — dialogs and popup menus take clicks and keys as usual while the mode is on. *Where:* edit theme mode. *Since:* 2.455.0
- **Editor themes** — the image editor follows the app theme, or its own Pro, Studio or Classic look. *Where:* the image editor's Window > Theme. *Since:* 2.393.0

### Projects and saving

- **Projects** — everything lives in its own project folder: outputs, video, images, sound, characters and scenes. *Where:* the menu bar's New, Open and Save
- **Save keeps everything** — the song and scenes, prompt, chat, characters, environments, references, assets, gallery, timeline and each docker's fields. *Where:* the menu bar's Save. *Since:* 2.372.0
- **Save as** — copies the whole project under a new name and opens the copy; an existing name is refused. *Where:* the menu bar. *Since:* 2.372.0
- **New project starts fresh** — the project you leave is saved first, then every docker starts empty. *Where:* the menu bar's New. *Since:* 2.371.0
- **Recycle bin** — deleted files go to the project's recycle bin; restore them, delete them for good or empty the bin. *Where:* the menu bar. *Since:* 2.374.0
- **Reset project** — empties the project and makes it again with the same name, stopping its renders and clearing its finished jobs. *Where:* the menu bar. *Since:* 2.374.0
- **Whole-project file (.bgp)** — the whole project as one XML file, self-contained with its media or as a small manifest, streamed so gigabytes are fine; opening one makes a new project. *Where:* the package button in the menu bar. *Since:* 2.436.0
- **Movie bundles** — New, Save and Load whole movies on the StoryBoard (cast, chapters, scenes and renders). *Where:* the StoryBoard's menu bar. *Since:* 2.151.0

### Assets, references, gallery and queue

- **Assets dock** — the project's images, videos and sounds; drop files on it to import them. *Where:* the Assets dock
- **Asset groups** — sort files into groups that live in the dock only; an asset can sit in several groups and the files never move. *Where:* the Assets dock
- **Select and delete assets** — tick, Ctrl-click or Shift-click tiles; delete moves them to the recycle bin, never a hard delete. *Where:* the Assets dock
- **Add tiles** — dashed add tiles open the file dialog to add pictures, videos or sounds, several at once. *Where:* References and Assets. *Since:* 2.394.0
- **References dock** — pictures, videos and sounds that ride the next generation; drag them in from the Assets or the Gallery. *Where:* the References dock
- **Gallery** — every render, with tabs for images, videos and audio; drag from it onto references, the timeline or a scene. *Where:* the Gallery
- **The queue** — one job at a time on the graphics card; pause, reorder, abort and retry, every job with its log. *Where:* the Queue. *Since:* 2.122.0
- **Pending and Done tabs** — queued, running and interrupted jobs apart from finished ones, saved with the project; resume an interrupted job. *Where:* the Queue. *Since:* 2.113.0
- **One running card** — the running render shows as one card with its prompt, mode, size, progress bar and chunk / step / time. *Where:* the Queue. *Since:* 2.400.0
- **Clear finished jobs** — removes every done, failed and cancelled job from the list without deleting files. *Where:* the Queue header
- **Abort dialog** — stop this render, retry it at the front of the queue, or stop everything. *Where:* the Abort button
- **Seeds to reuse** — every finished job's details, with a button to put its seed back in Basic Settings. *Where:* the Queue's info button. *Since:* 2.384.0
- **Live ComfyUI progress** — every video job shows which node is running and "step n of total". *Where:* the Queue, scene cards and the Generate button

### The file dialog and Save as

- **bitGen's own file dialog** — Quick access, the app and project folders, every drive with its free space, an address bar, search with wildcards, details or large icons, new folder and rename; the same on Windows, macOS and Linux. *Where:* every folder button and Choose file
- **Save as from the gallery** — every gallery tile has a save-as icon that opens the file dialog in Save As mode. *Where:* the Gallery tiles
- **Quick save** — Save in the preview dialog copies the file to the last save-as folder without a dialog, never overwriting. *Where:* the preview dialog

### Capture and remote use

- **Screenshot** — saves the app window or the whole screen to the gallery. *Where:* the menu bar (Alt+Shift+S)
- **Screen recording** — records the app or the screen as an H.264 mp4, with computer sound, microphone and a countdown. *Where:* the menu bar (Alt+Shift+R)
- **Use it from your phone** — a QR-code remote link: the phone takes photos and video, sends audio and talks to the model; everything lands in the project. *Where:* Settings > General. *Since:* 2.132.0
- **Audio visualiser** — any sound that plays fills the preview with a live visualisation (spectrum, wave, rings, particles, spectrogram). *Where:* the Preview. *Since:* 2.106.0
- **360-degree player** — a look-around view of any equirectangular video: drag to look, wheel to zoom. *Where:* the player's 360 button. *Since:* 2.119.0

### Settings, models and setup

- **The installer** — one installer per system sets up Node.js, Python, ComfyUI, the node packs and the models, tuned for your graphics card. *Where:* the setup files. *Since:* 2.331.0
- **The public beta repository** — the source with a README, the changelog of every release, contributing and security guides, issue templates and automatic tests on every push (scripts/ci-units.sh); docs/BETA.md says what is experimental and how to report a problem. *Where:* the GitHub repository, docs/BETA.md, CHANGELOG.md. *Since:* 2.477.0
- **Model catalog** — downloads the models each feature needs (video, image editing, upscaling, 3D models, Viggle and more), with a Hugging Face token and the Hugging Face CLI for big files. *Where:* Settings > Models > Model catalog
- **Node packs** — installs the ComfyUI custom node packs; a missing one is named with its pack when a job starts. *Where:* Setup > Node packs
- **Local LLM** — pick a model, start and stop its server, and rescan the folder; the running model is picked on start. *Where:* Settings > LLM. *Since:* 2.43.0
- **LLM tokens** — a live estimate of the prompt's tokens and a reply-budget slider. *Where:* the LLM tokens docker (L). *Since:* 2.148.0
- **Free VRAM before every generation** — avoids most out-of-memory failures when mixing images, music and video. *Where:* Settings > ComfyUI
- **Video accelerators** — Sage attention, Spectrum and Comfy Kitchen speed-ups per video style, with one-click installs. *Where:* Settings > ComfyUI and the video style. *Since:* 2.116.0
- **Wire any ComfyUI graph** — load a workflow, convert it to an API prompt, add your own toggles, dropdowns, sliders and text boxes and wire them to its values. *Where:* Settings > ComfyUI > Graphs. *Since:* 2.120.0
- **Graph mode** — run a wired graph from Generate with the controls you made; its load nodes fill themselves from the reference dock. *Where:* Basic Settings > Graph. *Since:* 2.120.0
- **Workflow conversion** — a UI workflow is turned into an API prompt (subgraphs and Set / Get nodes unfolded), now with ComfyUI's own frontend. *Where:* Settings > ComfyUI > Graphs. *Since:* 2.402.1
- **Model file matching** — model files a workflow names are matched to the ones your ComfyUI has, and the job log says so. *Where:* every job. *Since:* 2.345.0
- **Settings > 3D** — the engine for parametric 3D bodies and the Unreal Engine bridge settings. *Where:* Settings > 3D. *Since:* 2.471.0

## Generating video

From a single prompt to a whole film: the prompt docker, the video models, references, characters and the StoryBoard.

### The prompt docker and Generate

- **One Generate button** — the dropdown under it says what it makes: video, image, music, speech, a wired graph or a chat reply. *Where:* the prompt docker
- **Generate modes** — Ref (reference pictures), F/L (first / last frame), Text, and Swap. *Where:* Basic Settings
- **Several jobs from one prompt** — /br/ on its own line splits the prompt into jobs that run one after another. *Where:* the prompt box
- **Enter improves the prompt** — Enter sends the prompt to the local LLM, which rewrites it. *Where:* the prompt box
- **One prompt docker for every tool** — the image editor's AI, the timeline's Fill, path layers, AI scenes, the 3D look, characters, environments and VR worlds all take their words from the prompt docker. *Where:* key P. *Since:* 2.419.0
- **Negative prompt docker** — what the picture must not have, sent with every generation; its status says whether the chosen model uses it, and the LLM's "Negative:" lines land there. *Where:* key 2, or Negative in the statusbar. *Since:* 2.419.0
- **Quick prompts** — save a prompt by its first line and pick it again from a list. *Where:* the prompt docker's menu bar. *Since:* 2.451.0
- **Generate progress** — the running job's step count above the button and a progress bar under it. *Where:* the Generate button
- **Clear the prompt** — empties the prompt box only. *Where:* the prompt docker's title bar. *Since:* 2.117.0
- **Dictation** — Speak records from the microphone and adds the words to the prompt. *Where:* the prompt docker. *Since:* 2.87.0

### The prompt chat and the local LLM

- **Prompt chat** — talk through an idea with the local LLM; prompts in its replies become blocks you can render straight away. *Where:* the Prompt chat docker. *Since:* 2.85.0
- **Save, load and clear chats** — a chat is saved as "subject - date" and listed newest first; clear wipes the window and the model's memory. *Where:* the Prompt chat. *Since:* 2.370.0
- **The LLM sees your references** — pictures in tray order with a one-line description from the local vision model, the videos and the sounds, so it writes prompts with the right tags. *Where:* the prompt chat. *Since:* 2.354.0
- **Model-specific prompting** — with an LTX or Wan style picked the LLM writes for that model. *Where:* the prompt chat. *Since:* 2.419.0
- **Speech prompts shaped for MiniMax H3** — spoken lines are put into H3's dialogue syntax with the language and the voice timbre; stray instructions are tidied away. *Where:* every prompt render
- **Read replies aloud** — speaks each answer with the chosen voice. *Where:* the prompt chat. *Since:* 2.87.0
- **Longform shot lists** — asked for something longer than one clip, the LLM writes a numbered shot list that chains. *Where:* the prompt chat. *Since:* 2.126.0
- **360 and stereo VR prompting** — the LLM is taught equirectangular and side-by-side stereo prompt rules when you ask for them. *Where:* the prompt chat. *Since:* 2.118.0

### Basic Settings and video styles

- **Basic Settings** — mode, resolution, aspect, seconds, steps, CFG, seed, format, LoRAs, ControlNet and face fix. *Where:* key S
- **Seeds** — -1 for a random seed, a number for that seed, a dice for random again, a button for the last seed used. *Where:* Basic Settings. *Since:* 2.384.0
- **Temporary LoRAs** — extra LoRAs added on top of the style's for the next renders. *Where:* Basic Settings. *Since:* 2.111.0
- **Video style card** — the picked video style with its model per phase, steps, CFG, encoder, VAE, LoRAs and negative; change a model there and it is saved into the style. *Where:* the top of Basic Settings. *Since:* 2.401.0
- **Override style** — Basic Settings decide steps, CFG, seed, model and extra LoRAs for every video model (MiniMax H3, Wan, LTX). *Where:* Basic Settings. *Since:* 2.409.0
- **Video styles** — a saved model set and workflow per mode, with phases for models that sample in stages; duplicate one to keep variants. *Where:* Settings > Video. *Since:* 2.110.0

### MiniMax H3

- **Three ways to render** — reference pictures (up to nine), first / last frame, or text alone, with native sound. *Where:* Basic Settings modes
- **Long clips joined seamlessly** — a clip longer than one run is split and joined. *Where:* Seconds
- **Long video: one run up to 30 s** — low-VRAM attention and chunked feed-forward let a MiniMax H3 clip of up to 30 seconds render in ONE generation instead of joined 15-second pieces. *Where:* the video docker's ⚙ (Long video), or the MiniMax H3 Long (30 s) video style. *Since:* 2.503.0
- **More ComfyUI packs one click away** — install or update KJNodes, Yusu H3 Unified and RH DLSS 5. *Where:* Settings > ComfyUI > Video accelerators. *Since:* 2.503.0
- **Veda sparse attention** — an optional MiniMax H3 accelerator in a video style (On / Quality): about 2-3x faster than stock attention at its trained sizes, with a one-click install and its predictor in the model catalog. *Where:* Settings > Video styles; Settings > ComfyUI > Video accelerators. *Since:* 2.536.0
- **The model manager for hundreds of models** — pages that fit the docker, folder tabs (SDXL, Pony …), a 📌 This project tab, resizable cards, an info page per model with its example pictures and prompts, and Civitai details + thumbnails + examples for every model kept in one shared model_info folder. *Where:* 🧩 Models. *Since:* 2.537.0
- **Civitai into each type's folder** — ⤓ on any Civitai card downloads into the folder you picked once for that type (SDXL LoRAs, Pony models, Wan LoRAs …); Shift+click changes it; 📁 lists them (model_folders.json); 🔄 Sync fetches Civitai's details for every model on the computer. *Where:* 🧩 Models. *Since:* 2.538.0
- **Reference descriptions** — a short description under every reference picture, video and sound, kept with the project and groups, used in the mapping lines, the prompt chat and ✨ Enhance; wall / floor / furniture / light picture types. *Where:* References docker. *Since:* 2.539.0
- **References in the house builder** — drop a wall / floor picture on a wall or room (its texture in 3D, shots and panoramas, Tile size), a furniture / light picture on a piece (✨ Make it real paints it in). *Where:* 🏠 House. *Since:* 2.539.0
- **References in the image editor** — a dropped reference becomes a layer; ✨ Edit can take a reference as Picture 2. *Where:* 🖼 Image editor. *Since:* 2.539.0
- **Renders made real with references** — each Blender / Unreal object is matched to a reference picture, by its name or by hand. The first frame is made real with those pictures by an edit model, then LTX 2.3 3DREAL animates it along the render. *Where:* 🟧 Timeline Blender scene / UNREAL ▸ Render to Real, 🖼 image editor 3D and Unreal layers. *Since:* 2.540.0
- **Add-ons** — Settings ▸ Add-ons lists the optional engines (YuE2 music, Viggle native): what each is for, needs and size, and whether it is installed; ⤓ Install / ⟳ Reinstall / 🗑 Remove with the log in the tab. *Where:* Settings ▸ Add-ons. *Since:* 2.540.4
- **Update from GitHub** — Settings ▸ General ▸ ⟳ Updates: check GitHub for a newer version (the new commits listed), ⤓ Update now (a git clone moves to GitHub's branch with your changed files backed up; a zip install gets the changed files), npm / pip when their lists changed, ⟳ Restart now; a quiet check after start. *Where:* Settings ▸ General. *Since:* 2.540.5
- **House builder lights** — ◯ place a light, drag its reach; move, size, colour and brightness; lit in 3D, shots and panoramas. *Where:* 🏠 House. *Since:* 2.538.0
- **Maximize beside the side dockers** — ⛶ fills the room between the open Gallery / Queue / References / Assets / left docker. *Since:* 2.538.0
- **Picture types** — mark a reference picture as person, face, clothing, first frame or last frame; a first frame switches the render to first / last frame. *Where:* the References dock. *Since:* 2.340.0
- **True CFG** — CFG above 1 adds a negative pass that strengthens only what your prompt adds. *Where:* Basic Settings. *Since:* 2.366.0
- **H3 size** — choose how sizes between H3's 32-pixel steps are handled: round down, or render larger and crop back exactly. *Where:* the StoryBoard settings. *Since:* 2.380.0
- **Speech with emotion in a character's voice** — each line carries its emotion and is spoken in the character's cloned voice; long voice clips are trimmed to an 8-second sample. *Where:* the StoryBoard and the prompt
- **Other languages** — a language tag in the quotes speaks the line in that language. *Where:* the prompt
- **H3_Viggle style** — a motion video drives the movement and a picture says who performs it. *Where:* the video style list. *Since:* 2.352.0

### LTX 2.5 and LTX 2.3

- **LTX 2.5 modes** — text, image, first / last frame, first / middle / last, lip sync, first / last lip sync, audio to video and video to video (style transfer); Auto picks by what the reference dock holds. *Where:* the LTX mode dropdown
- **Transition LoRA** — switched on automatically for the modes that travel between pictures. *Where:* the Transition dropdown
- **Official templates** — text, image and first / last frame run on ComfyUI's own templates with only built-in nodes. *Where:* LTX 2.5 styles. *Since:* 2.401.5
- **LTX on the StoryBoard** — each scene's card decides the mode, with or without the board's song. *Where:* the StoryBoard Workflow
- **LTX 2.3 modes** — text, image, first / last frame and 3D render to real. *Where:* the LTX 2.3 style. *Since:* 2.402.0
- **3D render to real (3DREAL)** — a render from Blender, a game or any CG clip becomes photoreal with the same layout and camera move; strong v2, strong or light variants. *Where:* LTX 2.3 with a reference video. *Since:* 2.402.0

### Wan 2.1 and Wan 2.2

- **Wan modes** — text, image to video, first and last frame, and a character reference (VACE). *Where:* the Wan styles
- **Graph built for you** — bitGen builds the Wan graph from ComfyUI's own nodes and picks the right model files by name. *Where:* Wan styles
- **24 fps output** — Wan's 16 fps is motion-interpolated to 24 fps to join your other clips; the reference dock's first sound is laid under it. *Where:* Wan renders

### References

- **Reference videos and sounds** — up to three of each ride a reference render; missing slots are added to the workflow when needed. *Where:* References > Video and Sound. *Since:* 2.353.0
- **Choose the frames of a reference video** — a looping preview, a zoomable filmstrip and a selection box; Apply cuts exactly those frames. *Where:* References > Video
- **Append / Prepend** — render a new part that starts on the video's last frame (or ends on its first) and joins it, always as first / last frame. *Where:* the video's Use dropdown. *Since:* 2.388.0
- **Timeline capture** — the playhead's frame from any layer becomes a first frame, last frame or reference. *Where:* the timeline's capture buttons. *Since:* 2.117.0
- **Qwen Image 2.1 reads the dock** — pictures are sent in order and named in the prompt from their types. *Where:* image generation. *Since:* 2.340.0

### Characters, locations and environments

- **Characters** — a name, details, a character sheet (front / side / back) and a voice clip; its @tag brings the sheet and voice into prompts. *Where:* the StoryBoard > Characters
- **A character from one picture** — upload a photo or render and a reference sheet is generated. *Where:* the new-from-picture button
- **Actors** — choose who is in the current scene. *Where:* the Actors button
- **Clothing and identity models** — clothing entries follow the character; each keeps a dataset folder for identity models. *Where:* the character
- **360-degree environments** — locations as panoramas with a camera and a scene range, projected to a flat view for continuity. *Where:* the StoryBoard > Environments. *Since:* 2.142.0

### The StoryBoard (scene board) and films

- **Create screenplay** — describe a story and the LLM writes the scenes, with the characters speaking their lines. *Where:* the prompt docker
- **Scene count** — type how many scenes, or let the project, your request or the LLM decide. *Where:* the StoryBoard
- **How each scene follows** — Ref (a new shot), First (exactly on a frame of the take before), Cont (that frame with the cast sheets), Trans (from that frame to the new location). *Where:* each scene card
- **Render a scene or the selected ones** — rendering continues in the background while you edit. *Where:* the scene's play button, Render selected
- **Filmstrip** — click a frame of a take to make it the next scene's first frame. *Where:* under each take
- **The take bar** — watch, keep, redo, swap the character, or upscale a take. *Where:* under the board
- **Make a first frame** — Qwen Image 2.1 makes a scene's opening picture from the characters, a location and props. *Where:* the scene's First / Last slots. *Since:* 2.337.0
- **Compile** — joins the rendered takes into one film in scene order. *Where:* the StoryBoard's menu bar
- **The Scenes dropdown** — the board in a dropdown, with a scene picker showing each scene's state. *Where:* the StoryBoard. *Since:* 2.391.1
- **Scene progress** — "rendering step n of total" with a bar and time on each card. *Where:* the scene card. *Since:* 2.391.1
- **Render settings** — size, steps, LoRAs, accelerators, the upscaler and the tail frames. *Where:* the StoryBoard's settings button
- **Scene seeds** — random for each scene or one seed for all; each card has its own seed box. *Where:* the StoryBoard settings. *Since:* 2.384.0
- **Render size** — the StoryBoard setting, else Basic Settings, else the app default; the job notes say which. *Where:* the StoryBoard
- **StoryBoard pictures** — a picture per scene from its prompt with any image model, using character sheets, locations and references; use it as the first or last frame. *Where:* the StoryBoard bar. *Since:* 2.456.0
- **Make all missing pictures** — renders every scene picture that is not there yet. *Where:* the StoryBoard bar. *Since:* 2.456.0
- **The info line** — the StoryBoard's latest message, in full on hover. *Where:* the bottom of the StoryBoard. *Since:* 2.391.0
- **Motion slot** — with H3_Viggle, each scene takes a motion video. *Where:* the scene card. *Since:* 2.352.0

### Music videos and lip sync

- **Load a song** — its waveform opens auto-segmented; one scene per segment. *Where:* the StoryBoard's Audio
- **Create music video** — the writer uses the song's segments as scenes and makes the characters sing. *Where:* the prompt docker
- **Lip sync per scene** — every scene lip-syncs its own window of the song. *Where:* the music-video board
- **The transcript decides** — a timed transcript of the song says which scenes are sung and puts the words in the prompt. *Where:* the music-video board. *Since:* 2.356.0
- **Scenes at their song time** — each take lands on the timeline at the time its part of the song starts. *Where:* Timeline settings
- **Bridge scenes** — short transitions between song segments, rendered by the model or drawn as standard transitions. *Where:* the song strip's Transition option

### Character swap

- **Swap a character in footage** — a new person in existing footage; the performance, camera, background and sound stay. *Where:* Basic Settings > Swap
- **Swap a take** — swap the character of a rendered scene into its next take. *Where:* the take bar
- **The Swap dialog** — for whole movies: load a video of any length, auto-segment it, swap each piece, keep and compile. *Where:* the StoryBoard's Swap button
- **Swap quality** — Full, Best or Fast. *Where:* the Swap dialog. *Since:* 2.336.0
- **Write prompt** — the vision model and LLM write a swap prompt from the picture and the video. *Where:* the Swap dialog. *Since:* 2.335.0
- **LTX Ripple engine** — a first frame with the new character carried through the clip. *Where:* the Swap dialog's Engine. *Since:* 2.339.0
- **Viggle engines** — Viggle-Animate through ComfyUI, or bitGen's own native engine that keeps the model loaded between segments. *Where:* the Swap dialog's Engine. *Since:* 2.344.0
- **Several first frames** — make up to four first frames per segment and pick one. *Where:* the Swap dialog. *Since:* 2.348.0
- **Safe mode** — a black take is rendered again with everything that can blacken it switched off. *Where:* the Swap dialog's settings. *Since:* 2.350.0
- **VR swap** — swaps a person in 360 or 180-degree footage through a virtual camera; stereo eyes rebuilt from depth. *Where:* the Swap dialog's VR line

### VR

- **VR World** — a performer inside a 360 or 180-degree picture: aim the camera, add the performer's pictures, sound and prompt, render with VR metadata. *Where:* the StoryBoard's VR World button
- **Lock the background** — outside the performer both eyes show the picture itself. *Where:* VR World

### Upscaling and enhancing

- **SeedVR2 upscaling** — upscale a video to 720p-4K or by a factor, with colour match, temporal split and denoise. *Where:* the preview bar. *Since:* 2.400.0
- **DLSS 5 enhance, upscale and frame generation** — NVIDIA DLSS 5 neural rendering on a video (default / natural / cinematic), upscaling to 1x DLAA, 1.5x-3x or 1K-8K, and optional frame generation up to 6x the frame rate; RTX only. *Where:* the preview bar's ⚡ DLSS 5, and the video docker's ⚙ Upscaler on the board. *Since:* 2.504.0
- **Enhance the selected video** — opens the upscaler for the last video you clicked. *Where:* the prompt docker. *Since:* 2.401.0
- **Upscale on the board** — a take you like sent through the StoryBoard's upscaler, or SeedVR2 at the upscale resolution; optionally every render. *Where:* the StoryBoard settings

### Sound effects (the SFX dock)

- **Add sounds and videos** — audio files and the sound of video files, kept as 48 kHz WAV. *Where:* the SFX dock
- **Cut sounds** — select on the waveform, set a fixed duration box, keep or delete the selection with click-free fades, undo. *Where:* the SFX dock
- **To the gallery and assets** — every cut is copied to the gallery; send it to the Sound assets. *Where:* the SFX dock

## Images

Still pictures from text and references, ControlNet guidance, face fixing and AI edits.

### Image generation

- **Image styles** — FLUX.2 Klein, SDXL, Pony, Illustrious, Z-Image, Qwen Image and more, each a saved workflow, model set and LoRA stack. *Where:* Settings > Image. *Since:* 2.66.0
- **ComfyUI starts for you** — Generate Image launches ComfyUI when it is not running. *Where:* Generate. *Since:* 2.73.0
- **Model dropdowns from ComfyUI** — model, VAE, encoder and LoRA fields list what ComfyUI can actually load. *Where:* Settings > Image. *Since:* 2.71.0
- **Several at once** — up to eight pictures per press. *Where:* Generate
- **Image editing styles** — edit a picture from up to three references (FLUX.2 Klein edit) or more with Qwen Image 2.1 edit. *Where:* Generate with the image mode. *Since:* 2.69.0
- **FLUX 3 Image Klein** — Black Forest Labs' 5.6B open model as three styles: distilled (fast), base (cfg 3.5) and edit (up to 4 reference pictures); the text styles switch to the edit graph when the reference dock has pictures. *Where:* the image style dropdown, Settings > Setup for the models. *Since:* 2.502.0
- **Krea 2** — Krea's 12B open image model as four styles: Turbo (8 steps) and Raw (52 steps, a negative prompt), each as safetensors or GGUF. *Where:* the image styles. *Since:* 2.516.0
- **Anima** — CircleStone Labs' 2B anime / illustration model as two styles (Aesthetic v1.1, Base v1.0; 30 steps, cfg 4). *Where:* the image styles. *Since:* 2.517.0
- **Queue presets** — Normal / Quiet (overnight) / Eco / Cool-down / Max performance / Custom: a GPU power limit, a rest between jobs, waits while a card is hot, throttling warnings. *Where:* the menu bar's ⏱. *Since:* 2.518.0
- **Model manager** — your models + LoRAs as cards (thumbnail, rating, release date, type, category, keywords; the description card on hover), select a model + LoRAs, override the style with them, ✚ a new style from one, ✎ edit a card, 🔍 look it up on Civitai. *Where:* 🧩 Models in the statusbar. *Since:* 2.518.0
- **Civitai downloads** — search civitai.red / civitai.com and download straight into the right ComfyUI folder with its card. *Where:* the Model manager's Civitai tab; the key in Settings ▸ General. *Since:* 2.518.0
- **Energy cost** — the price per kWh: every job's ⚡ card, its [power] line and the energy since start show the cost. *Where:* Settings ▸ General. *Since:* 2.518.0
- **Testing docker** — the tests a version needs, ticked as they are done (many by themselves), notes, 💾 a log to upload. *Where:* Settings ▸ General ▸ 🧪 Testing. *Since:* 2.518.0
- **Setup asks for your hardware** — graphics card (from a list), RAM and CPU when setup cannot find them; "Not right?" changes them. *Where:* setup's first page. *Since:* 2.519.0
- **Packages** — Editor (no AI) / + small AI / + mid-size AI / Everything, picked for your card; what you'll be able to use (✓ ~ ✗, add later) and the download before you install. *Where:* setup's Your package page; setup-cli --packages. *Since:* 2.519.0
- **Daily supply charge** — the fixed daily charge on the bill: a job's cost adds its share for the time it ran. *Where:* Settings ▸ General ▸ Energy cost. *Since:* 2.519.0
- **LoRA trainer** — train a LoRA from your pictures with ai-toolkit (Ostris): nine base models (Z-Image Turbo, FLUX, Qwen-Image, SDXL, SD 1.5, Chroma, Wan 2.1…), trigger word, rank, steps, dataset with captions (or the assistant's), editable YAML, live steps / loss / samples; the LoRA lands in ComfyUI's loras/trained with its card; export the job as a zip. *Where:* statusbar 🎓 LoRA. *Since:* 2.520.0
- **Peak / off-peak prices** — a peak price and peak time windows (days + times, through midnight too); every other minute is off-peak; jobs split peak and off-peak energy. *Where:* Settings ▸ General ▸ Energy cost. *Since:* 2.520.0
- **Usage log** — every job's energy, peak share, cost and remote GPU, day by day; ranges, totals, CSV. *Where:* Settings ▸ General ▸ 📊 Usage…, or click the ⚡ statusbar figure. *Since:* 2.520.0
- **Remote GPU** — use another machine's ComfyUI, a RunPod pod (list / start / stop, its proxy) or an SSH tunnel; ✓ Test; Use it / Use this computer. *Where:* Settings ▸ Remote GPU. *Since:* 2.520.0
- **This computer & package** — your hardware, the package installed, what each package lets you use; ✎ Not right?; ⬆ Upgrade to a bigger package without setup. *Where:* Settings ▸ Models. *Since:* 2.520.0
- **Grouped downloads** — a checkbox per model group, with its file count and size. *Where:* setup's models page; Settings ▸ Models ▸ Model downloads. *Since:* 2.520.0
- **Checkpoint fine-tune** — every weight of a picture model (Lumina 2, Flex.1, FLUX.2 klein, SDXL) with ai-toolkit, parameter swapping for less VRAM; joined into one .safetensors in diffusion_models/trained. *Where:* 🎓 LoRA ▸ Type. *Since:* 2.521.0
- **LLM fine-tune** — the assistant on your own chats with Unsloth (Qwen3.5 0.8B-9B, Gemma 4, Qwen3.8 27B; LoRA / QLoRA / full); typed or imported (JSONL / JSON / CSV) examples; a .gguf in the LLM folder. *Where:* 🎓 LoRA ▸ Type. *Since:* 2.521.0
- **Vision fine-tune** — the vision model on pictures + answers (Qwen3.5 / Gemma 4 vision); the .gguf + mmproj in the vision folder. *Where:* 🎓 LoRA ▸ Type. *Since:* 2.521.0
- **Bake a LoRA** — a finished LoRA merged into its base model as a new checkpoint (ComfyUI), any card. *Where:* 🎓 LoRA ▸ Run & samples. *Since:* 2.521.0
- **FLUX.2 klein LoRAs** — the FLUX.2 klein base 4B as a LoRA base model. *Where:* 🎓 LoRA ▸ Base model. *Since:* 2.521.0
- **Bug report** — Ctrl+Alt+Shift+B: a screenshot of the window (✏ / ▭ marks), title, severity, where, what happened / expected, steps (⤵ the recorded clicks and keys - never what was typed), with the logs, system + settings (secrets hidden), page errors and failed requests; 💾 saves one .zip to send; earlier reports ⤓ / 🗑. *Where:* anywhere (Ctrl+Alt+Shift+B); Settings ▸ General ▸ 🐞 Report a bug…. *Since:* 2.522.0
- **The loader follows the model file** — a style's .safetensors or .gguf model gets the matching ComfyUI loader (Load Diffusion Model / the GGUF loader) automatically - a GGUF style renders a .safetensors fine-tune and the other way round. *Where:* every picture style. *Since:* 2.523.0
- **🏠 House builder** — draw a floor plan in metres (rooms, walls, doors, windows, sliding doors, garage doors, stairs between floors), furnish it from a 38-piece library, set floor / wall materials and the sun by the hour, see it in 3D, then use it as a location: 📍 a 360° panorama -> a Location, 📷 shots with depth + normal maps -> Image assets, ✨ Make it real (the shot -> a photoreal picture through an edit style), ⤓ .obj for Blender / Unreal. *Where:* 🏠 House on the statusbar. *Since:* 2.524.0
- **A model is found in whichever ComfyUI folder holds it** — a style's diffusion model sitting in models/checkpoints (or another subfolder) is loaded through Load Checkpoint / the name ComfyUI lists, instead of failing "Value not in list"; a model in no folder gets a message saying where to put it. *Where:* every picture, video and music job. *Since:* 2.525.0
- **Workspaces** — a Workspace dropdown in the menu bar: Basic, Image editing, Video editing, Music video, Expert. Each shows the dockers that work needs, hides the buttons it doesn't (nothing disabled) and remembers your own changes; ↺ resets one. *Where:* the menu bar. *Since:* 2.526.0
- **🩺 Style doctor** — one click makes a small test picture with every image style (Quick: 512 × 512, 4 steps; or Real) and shows a pass / fail table: the failing log line and what to do (a model ComfyUI does not list and which folder it belongs in, a missing node pack, ComfyUI not running, out of VRAM, a damaged file, a mismatched text encoder). ■ Stop, ↻ one again, ⤓ the report as .md. *Where:* 🩺 in the menu bar. *Since:* 2.527.0
- **🧍 Characters in House shots** — a Person tool in the House builder: a mannequin with a pose, height, facing, the project character it stands for and an optional LoRA; it is in the 3D view, shots, depth / normal maps and 360°s, and ✨ Make it real swaps it for the character - their picture goes with the shot and the prompt names who is where. *Where:* 🏠 House -> 🧍. *Since:* 2.528.0
- **House builder extras** — a roof (flat / gable / hip), a floor-plan picture to trace over (with a two-point scale), 🪄 furnish a room from a prompt (the LLM picks from the library, the pieces are placed against the walls clear of the doors), ⤓ .glb export, and 🎬 every camera -> StoryBoard scenes with their shots as first frames + a shot list. *Where:* 🏠 House. *Since:* 2.529.0
- **🔍 Find anything (Ctrl+K)** — a command palette over every docker, floating window, menu / statusbar button, Settings field, workspace, Generate mode, style, guide section and shortcut key; Enter shows / opens / runs it, and the guide opens in a 📖 Help window. *Where:* Ctrl+K or 🔍 in the menu bar. *Since:* 2.530.0
- **Every model file found where ComfyUI lists it** — text encoders, VAEs, LoRAs and ControlNets in another subfolder are used under ComfyUI's name; a file in no folder at all is named with the model catalog entry that downloads it. *Where:* every job; the 🩺 Style doctor. *Since:* 2.531.0
- **Tests that tick themselves** — anything on the 🧪 test list the app sees working is ticked and kept (auto ✓), even after a restart. *Where:* Settings -> General -> 🧪 Testing. *Since:* 2.532.0
- **▁ ⛶ ✕ docker title bars** — minimize a floating docker to its title bar, maximize it to the whole window and back, close it. *Where:* every floating docker. *Since:* 2.532.0
- **⬚ Select, turn and size in the House builder** — handles on the selected piece, box and Shift+click selection, group move / turn / delete. *Where:* 🏠 House. *Since:* 2.532.0
- **📷 Walk a camera through the house** — drag it on the plan with the 3D view looking through it; arrows turn and tilt it, Shift / Alt raise and lower it. *Where:* 🏠 House. *Since:* 2.532.0
- **🧪 Test mode** — suggests the next test where you are (the image editor: blur, brush, eraser …), asks 'Did it work?' with a suggestions box when the app sees a test work, keeps your answers and suggestions in the log; off = nothing ticks or pops up. *Where:* Settings -> General; the 🧪 Testing docker. *Since:* 2.534.0
- **New renders join the open preview** — a picture that finishes while the preview is open joins its strip; ✨ N new jumps to it. *Where:* the picture / video preview. *Since:* 2.534.0
- **Edit image mode shows only edit styles** — with the image editor open, the image style dropdown lists only styles that can edit a picture, and puts your choice back when it closes. *Where:* the prompt docker. *Since:* 2.502.0

### ControlNet and face fix

- **ControlNet** — renders a first picture, turns it into a control image (lineart, depth, pose) and renders the final with a second model. *Where:* Basic Settings
- **ControlNet chain styles** — a two-stage style saved by name. *Where:* Settings > ControlNet. *Since:* 2.97.0
- **Face fix** — re-draws each face of the final picture. *Where:* Basic Settings

### Pictures onto the image editor

- **Generated pictures onto the canvas** — with the image editor open, Generate makes pictures and each lands as a new layer on the document in front. *Where:* the prompt docker. *Since:* 2.431.0
- **3D models from pictures** — every picture in the Gallery and Assets can become a 3D model (Hunyuan3D 2.1 or TRELLIS.2). *Where:* the 3D button on each picture. *Since:* 2.404.0

## Music, voices and sound

Songs, stems, voices and the words in them.

### Music

- **Songs from lyrics and a style** — MiniMax Music3 or YuE2, with up to four songs per press. *Where:* the Music docker. *Since:* 2.90.0
- **Music styles** — a reusable caption (genre, BPM, key, mood, voice) with its workflow and settings. *Where:* Settings > Music
- **Covers and sheet music** — made in the Music docker. *Where:* the Music docker
- **Songs from the chat** — the chat writes lyrics that fit the chosen music style and sends them to the Music docker. *Where:* the prompt chat. *Since:* 2.92.0
- **Lyrics files** — every song keeps its lyrics as a text file in the project. *Where:* the project's lyrics folder

### Stems

- **Split a song** — vocals, drums, bass and other. *Where:* the Stems docker

### Voices and speech

- **Voice cloning** — clone a voice from a short clip or a waveform region. *Where:* the Voice / Stems docker
- **Text to speech** — speak a line in a cloned voice; OpenAudio or OmniVoice (600+ languages, voice design). *Where:* Settings > Audio. *Since:* 2.102.0
- **Speech from the prompt** — Generate with the speech mode. *Where:* the Generate dropdown

### Transcription and lyrics

- **Speech to text** — transcribe speech or extract timed lyrics from any sound or video, saved as .txt, .srt and .lrc. *Where:* the asset tray. *Since:* 2.38.0
- **Local transcription** — faster-whisper runs on this computer and each file is transcribed once. *Where:* Settings > Audio

### Karaoke

- **Karaoke overlays** — a transparent lyrics video with a bouncing ball and a line that changes colour as it is sung. *Where:* the StoryBoard's Karaoke button. *Since:* 2.373.0
- **Karaoke for any song** — pick a sound clip or asset, the whole song or the ruler selection. *Where:* the timeline's Karaoke button. *Since:* 2.380.0
- **Karaoke style** — font, colours, outline, shadow, background band and the ball. *Where:* the StoryBoard and Timeline settings
- **Edit lyrics** — correct the words speech-to-text heard, or paste the real lyrics. *Where:* the Karaoke docker. *Since:* 2.408.0
- **Words and timing** — every word with its start and end, playable and correctable; corrections are kept for the song. *Where:* the Karaoke docker. *Since:* 2.408.0
- **Word nudges** — move a word, or it and every word after it, earlier or later by a small or larger nudge. *Where:* Words and timing. *Since:* 2.433.0
- **The line under the marker** — the line being sung is lit and the word being sung brighter. *Where:* Words and timing. *Since:* 2.433.0
- **Karaoke docker** — docks beside the preview canvas so the song plays while you correct it; show the corrected words on the canvas. *Where:* the timeline. *Since:* 2.410.0

## The timeline

A full video editor: a preview canvas with layers, editing tools, colour, sound, captions, AI and 3D.

### The preview canvas

- **Preview canvas** — the canvas with a toolbar on the left and a Layers panel on the right. *Where:* the timeline docker. *Since:* 2.377.0
- **Drop to add** — drop videos, pictures or sounds on the canvas; each lands on a new layer at the position marker. *Where:* the preview canvas
- **Move tool** — select, move, scale by a corner and rotate by the top handle; Shift for 15-degree steps or one axis. *Where:* key V
- **Text tool** — click to add a text layer with font, size, colour, bold, italic, outline, shadow and alignment. *Where:* key T
- **Hand and Zoom** — pan, zoom and fit the picture. *Where:* keys H, Z
- **Fill a selection** — draw a box or paint a mask, then generate a picture or video that blends into it. *Where:* keys M and B, and Fill in the Layers panel. *Since:* 2.380.0
- **Play with sound** — every layer plays together with sound; loop the ruler selection. *Where:* under the canvas
- **Compile matches the canvas** — moved, scaled and rotated layers and text are compiled exactly where the canvas shows them. *Where:* Compile
- **Hover highlight** — with the Move tool the clip under the pointer is outlined in blue, the picked one in orange. *Where:* the preview canvas. *Since:* 2.470.0

### Layers, clips and the position marker

- **Layers** — V1 as the base picture plus video, picture, sound, text, 3D and Karaoke layers. *Where:* the timeline
- **Layer colours** — each layer has its own colour; the selected one is outlined. *Where:* the timeline. *Since:* 2.383.0
- **Rename layers** — double-click a name, press F2, or use the Name box. *Where:* the Layers list and tracks. *Since:* 2.382.1
- **Drag the marker** — move around at will; double-click a time to jump there and play. *Where:* the ruler. *Since:* 2.383.0
- **Ruler selection** — select a stretch, keep or cut it, trim the head or tail of a clip. *Where:* the ruler
- **Nudge clips** — arrow keys move a clip by frames, Shift by a second. *Where:* Timeline settings. *Since:* 2.376.0
- **Named timelines** — a project holds several timelines; switch, save and save as. *Where:* the timeline toolbar. *Since:* 2.107.0
- **Transitions** — 59 transitions, drawn as their shape on entry and exit. *Where:* each layer. *Since:* 2.415.0

### Keyframes

- **Keyframes** — position, scale, rotation, opacity and text colour, tweened on the canvas and in the compile. *Where:* the Key button in the Layers panel. *Since:* 2.379.0
- **Eases** — linear, ease in, ease out, ease in and out, or hold. *Where:* the keyframe menu
- **Graph Editor** — value and speed graphs with draggable keyframes and Bézier handles; Easy Ease, linear and hold in a click. *Where:* the 📈 Graph button in the Properties. *Since:* 2.489.0
- **Motion blur, Posterize Time, Echo** — blur a layer's movement (shutter angle, samples), hold it at a lower frame rate, or trail copies of it behind it. *Where:* ⏱ Time in a layer's Properties. *Since:* 2.500.0
- **Time remapping on a curve** — choose which source second shows at each moment of a video clip: forward, backwards, frozen, faster or slower, with keys on a curve, ◇ Key and ❄ Freeze at the playhead. *Where:* ⏱ Time remap in a video clip's 🎬 Speed. *Since:* 2.501.0
- **Generator layers: Fractal Noise and Gradient Ramp** — a click of the 🌫 tool makes animated fractal noise over the frame, a drag a linear or radial ramp; every setting keyable. *Where:* the 🌫 tool on the timeline canvas, 🌫 Generator in the layer's Properties. *Since:* 2.505.0
- **Turbulent displace and displacement maps** — push any layer's pixels with moving noise or with another layer's picture; the compile matches, video layers included. *Where:* 〰 Distort in a layer's Properties. *Since:* 2.505.0
- **Particles** — a Shift+click of the 🌫 tool makes a particle emitter (point, line or box) with speed, direction, spread, gravity, wind and five particle shapes; every setting keyable, and the same picture every time it is drawn. *Where:* the 🌫 tool on the timeline canvas, 🌫 Generator (Particles) in the layer's Properties. *Since:* 2.506.0
- **Light rays** — the bright parts of any layer streak away from a point, past its edges; video layers are baked whole by the page for the compile. *Where:* ☀ Light rays in a layer's Properties. *Since:* 2.506.0
- **Puppet pins** — pin a layer and drag the pins to bend it like a puppet; the other pins hold, and the pins can be keyed so the layer moves over time. *Where:* the 📌 Puppet tool (Shift+W) on the timeline canvas, 📌 Warp in the layer's Properties. *Since:* 2.507.0
- **Mesh warp** — a grid of up to 8 × 8 points over a layer, dragged to bend the picture along smooth curves; keyable, and the compile matches, video layers included. *Where:* ⌗ Mesh warp in 📌 Warp in a layer's Properties. *Since:* 2.507.0
- **Audio → keys** — key any property (opacity, scale, position, turn, generator numbers) to a sound's loudness, bass, mids or treble, from a quiet value to a loud one, thinned to the keys that matter. *Where:* ♪ Audio → keys in a layer's Properties. *Since:* 2.508.0
- **Audio waveform and spectrum layers** — layers that draw the sound: its wave around the playhead (wave, line, bars) or its frequencies (bars, line, circle); every setting keyable; one clip or all sound. *Where:* Alt+click / Alt+Shift+click with the 🌫 tool on the timeline canvas. *Since:* 2.508.0
- **audio() in expressions** — the mix's loudness, bass, mids or treble (0..1) at any moment, for expressions on any property. *Where:* ƒx on a property, its presets. *Since:* 2.508.0
- **Motion sketch** — press and move on the canvas while the timeline plays: the layer follows the pointer and the path becomes position keys, thinned to the ones that matter. *Where:* the ✍ tool (Shift+K) on the timeline canvas, 〰 Motion in a layer's Properties. *Since:* 2.509.0
- **The wiggler** — random movement added to any property as keys (how often, how far, smooth or jagged, position x / y apart, a seed), riding on the move already there. *Where:* ≈ Wiggler in 〰 Motion in a layer's Properties. *Since:* 2.509.0
- **The smoother** — a property's keys averaged and thinned within a tolerance: fewer keys, the same shape. *Where:* ⌇ Smoother in 〰 Motion in a layer's Properties. *Since:* 2.509.0
- **2D layers in 3D** — any layer becomes a card with depth and an x / y turn, seen in perspective by a keyable 3D camera (position, aim, zoom) with an orbit / dolly / track tool. *Where:* 🧊 3D in a layer's Properties, the 🧊 tool (Shift+O). *Since:* 2.510.0
- **Depth of field and light shadows for 3D cards** — cards blur by their distance from the focus, and a light throws the cards' shapes as shadows onto the cards behind them. *Where:* 🎥 3D camera in a 3D layer's Properties. *Since:* 2.510.0
- **Variable mask feather** — each mask point can have its own feather (Shift+drag it with the Mask Pen); the edge glides between them, animated paths too. *Where:* ✒ Mask Pen on the timeline canvas, ✒ Masks in the Properties. *Since:* 2.511.0
- **Data-driven animation** — import CSV or JSON as data sets with a current row; {{set.column}} in texts, data() in expressions, and a column keyed onto any property a row at a time. *Where:* 📋 Data & fields in a layer's Properties. *Since:* 2.511.0
- **Exposed template fields** — label a layer's colour, opacity, position, scale or turn as a field; edit every field in one list, and templates offer them when dropped in. *Where:* 📋 Template fields in a layer's Properties, 🧩 Templates. *Since:* 2.511.0
- **Lottie (JSON) export** — the picture and text layers as a Lottie animation for the web and apps: moves, scales, turns and fades as real animated layers with their eases, effect layers as frames; checked against lottie-web. *Where:* 📤 Export → ⤓ Lottie (JSON). *Since:* 2.512.0
- **Load UE project** — pick an Unreal project's folder and bitGen puts the bitGen Bridge plugin in (or updates it), switches on the plugins it needs and restarts Unreal with the project. *Where:* 🎮 in the menu bar. *Since:* 2.513.0
- **The timeline's frame size** — width × height, size presets (4K to vertical and square) and a kept aspect ratio for the canvas and the compile; V1 is fitted inside and centred. *Where:* the bar at the top of the Timeline docker. *Since:* 2.513.0
- **Cut out a subject through a shot** — click the subject (or box it) and it is followed through the clip (SAM 2, the AI matte or built in), refine edge, a see-through video layer. *Where:* 🧍 Cut out in a video clip's Properties. *Since:* 2.515.0
- **Content-aware fill for video** — take a cut-out subject or masked area out of every frame, filled from the frames round it (+ a reference frame). *Where:* 🩹 Remove in a video clip's Properties. *Since:* 2.515.0
- **3D camera tracker** — solve the camera and the scene's points, pick points and place a layer flat, standing or facing the camera; the 3D camera follows the solve (with roll). *Where:* 📷 3D camera track in a video clip's Properties. *Since:* 2.515.0
- **Keyframes on any setting** — a ◇ beside every colour, effect, mask, text and time setting keys it at the playhead (then changing it keys it); the Graph Editor shows them and the compile matches. *Where:* ◇ in a clip's Properties and the 🎨 Colour dialog. *Since:* 2.516.0
- **Edit theme mode: resize, move, hide, rename** — drag handles to resize an element, drag it to move it, hide it or change its text; every change is kept in themes/<name>.tmp, and leaving edit mode offers Save theme, Save theme as…, Reset theme, Not now or Cancel. *Where:* 🖌 in the top bar. *Since:* 2.514.0
- **Theme edit mode for dialogs** — Ctrl+Shift+Alt+E styles an open dialog (Settings …) too; Ctrl+S saves the theme and leaves. *Where:* anywhere. *Since:* 2.515.0
- **Folding dockers** — the side dockers fold to a thin title strip; the image editor's docker groups fold to their tabs and close with ✕; View ▸ Dockers shows or hides each one. *Where:* ▾ in a docker's title bar; the image editor's View menu. *Since:* 2.514.0
- **Motion tracking** — follow a point, two points (scale and rotation), four corners or a flat surface (planar) through a clip to a fraction of a pixel, then apply it to a layer's position or pin a layer into it. *Where:* 🎯 Track in a video clip's Properties. *Since:* 2.499.0
- **Corner pin** — draw a layer into four corners, tracked or dragged by hand; the compile matches the canvas. *Where:* ▢ Corner pin in a layer's Properties. *Since:* 2.499.0
- **Bézier masks** — several masks per layer drawn with a pen (corners and curves), with add, subtract, intersect and difference, feather, expansion, opacity, invert and an animated path; pictures, text, shapes and video. *Where:* the ✒ Mask Pen (Shift+M) and ✒ Masks in a layer's Properties. *Since:* 2.498.0
- **Expressions** — a small formula on a layer property (position, scale, rotation, opacity, anchor, shape and text animator numbers): wiggle, loops, delays, ranges, random, links to other layers; checked as you type; the compile follows it. *Where:* ƒx Expressions in a layer's Properties. *Since:* 2.497.0
- **Roving keyframes** — a position key's time follows the motion path for an even speed between its neighbours. *Where:* Rove in the Graph Editor. *Since:* 2.496.0
- **Easy Ease** — ease a keyframe in and out, or one side only. *Where:* the Properties, F9 (Shift+F9 in, Ctrl+Shift+F9 out). *Since:* 2.489.0
- **Anchor point** — what position places and scale and rotation turn about; keyframable; the layer stays put when you move it. *Where:* ⊕ Anchor in the Properties. *Since:* 2.489.0
- **Curved motion paths** — the position path drawn on the canvas with Bézier handles to bend it; Smooth path in one click. *Where:* the canvas, ↝ Smooth path. *Since:* 2.489.0
- **Parenting** — a picture, text, null or (since 2.495.0) video layer follows another layer's position, rotation and scale; it stays put when the parent is chosen or cleared, and the compile follows it. *Where:* ⛓ Parent in the Properties. *Since:* 2.490.0
- **Null objects** — empty control layers to key and parent others to; never compiled. *Where:* ＋ Null in the Properties. *Since:* 2.490.0
- **Blend modes** — Multiply, Screen, Overlay, Darken, Lighten, Color Dodge and Burn, Hard and Soft Light, Difference, Exclusion, Add and (since 2.495.0) Hue, Saturation, Color and Luminosity per layer, on the canvas and in the compile. *Where:* ◐ Blend in the Properties. *Since:* 2.491.0
- **Track mattes** — show a layer only where the layer above it is (alpha or luma, or inverted); video inside text and the like. *Where:* ▣ Matte in the Properties. *Since:* 2.491.0
- **Shape layers** — rectangles, ellipses, stars and polygons drawn with the Shape tool, with a colour or gradient fill and a stroke. *Where:* ◆ in the canvas toolbar (Q). *Since:* 2.492.0
- **Shape operators** — Trim Paths, Repeater, Offset Paths, Pucker & Bloat, Twist, Zig Zag, Wiggle Paths and Round Corners, every number keyable. *Where:* a shape layer's Properties. *Since:* 2.492.0
- **Freehand shapes** — draw a closed shape or an open line by hand, smoothed; Alt adds it to the picked shape layer as another path. *Where:* the ✎ Freehand tool (Shift+Q). *Since:* 2.496.0
- **Merge Paths** — several paths in one shape layer combined by add, subtract, intersect or exclude, holes included; the operators after it work on the merged outline. *Where:* ⧉ Paths and ⊕ Merge Paths in a shape layer's Properties. *Since:* 2.496.0
- **Text animators** — move, turn, scale, fade, space out, blur or recolour the letters, words or lines a range selects; Typewriter, Fade up, Pop in, Slide in, Wave and Blur in presets; every number keyable. *Where:* ✨ Text Animators in a text layer's Properties. *Since:* 2.493.0
- **Text on a path** — the letters run along an arc, circle, wave or a shape layer's outline, turned to it; the start is keyable. *Where:* 〰 On a path in a text layer's Properties. *Since:* 2.496.0
- **Edit a keyframe** — click a diamond on a clip for its opacity, volume, place, scale, rotation, colour and ease. *Where:* the timeline
- **Drag and delete keyframes** — drag along the clip; right-click, Alt-click or Delete removes one. *Where:* the timeline. *Since:* 2.385.0
- **Volume keyframes** — on sound clips too. *Where:* sound clips
- **Effect keyframes** — blur, sharpen, glow, vignette, grain and crop move from key to key. *Where:* a clip's Effects. *Since:* 2.412.0

### Edit tools and keys

- **Ripple, Roll, Slip and Slide** — trim and move everything after, move a cut, show other frames, or slide between neighbours. *Where:* keys V, B, N, Y, U. *Since:* 2.407.0
- **Split** — split at the position marker. *Where:* Ctrl+K. *Since:* 2.410.0
- **Track targets** — split every targeted layer at once. *Where:* the target in each layer header. *Since:* 2.412.0
- **J / K / L shuttle** — play backwards or forwards at 2x, 4x, 8x; step a frame. *Where:* the timeline docker. *Since:* 2.411.0
- **Edit points and ends** — previous or next edit point, the start or the end. *Where:* arrow keys, Home, End. *Since:* 2.410.0
- **Edits on reversed and ramped clips** — the edit tools and split are frame-exact on retimed clips. *Where:* the timeline. *Since:* 2.413.0

### Markers and timecode

- **Markers** — named, coloured flags with comments; next and previous marker. *Where:* key M. *Since:* 2.410.0
- **Marker ranges and clip markers** — markers with a length, and markers that stay on a clip's frame. *Where:* the marker editor, Ctrl+Shift+M. *Since:* 2.412.0
- **Timecode** — HH:MM:SS:FF with a start and frame rate; drop-frame at 29.97 and 59.94. *Where:* beside the position. *Since:* 2.407.0

### Speed

- **Speed** — 10 to 1000 %, with the clip's length following. *Where:* a clip's Speed fold. *Since:* 2.406.0
- **Reverse and ramps** — play backwards or ramp the speed along the clip. *Where:* a clip's Speed fold. *Since:* 2.406.0
- **Slowed frames** — repeat, blend or optical flow. *Where:* a clip's Speed fold. *Since:* 2.406.0
- **Reversed sound on the canvas** — a reversed or ramped clip's sound is rendered once and heard in step. *Where:* the canvas. *Since:* 2.417.0

### Colour

- **Looks and sliders** — teal and orange, warm film, cool night and more; exposure, contrast, saturation, temperature, tint and hue. *Where:* a clip's Colour fold. *Since:* 2.406.0
- **LUTs** — import any 3D .cube LUT and blend it. *Where:* a clip's Colour fold. *Since:* 2.406.0
- **Colour wheels and curves** — lift, gamma and gain wheels; master and RGB curves. *Where:* the Colour dialog. *Since:* 2.407.0
- **HSL secondaries** — up to six hue ranges shifted, saturated or lightened. *Where:* the Colour dialog. *Since:* 2.407.0
- **Hue curves** — hue vs hue and hue vs saturation. *Where:* the Colour dialog. *Since:* 2.412.0
- **Scopes** — waveform, RGB parade, vectorscope and histogram. *Where:* the Colour dialog. *Since:* 2.407.0
- **Colour match** — set a clip's curves to match another clip. *Where:* the Colour dialog. *Since:* 2.415.0
- **What you see is what you get** — the grade is baked into one table the canvas and compile share. *Where:* the canvas
- **HDR clips tone-mapped** — a phone's HDR video is tone-mapped into the movie. *Where:* the compile. *Since:* 2.417.0

### Effects and adjustment layers

- **Effects** — blur, sharpen, glow, vignette, grain, crop, green / blue screen key and stabilise. *Where:* a clip's Effects. *Since:* 2.409.0
- **Distort effects** — lens, mirror and warp (wave, twirl). *Where:* a clip's Effects. *Since:* 2.415.0
- **Stabilise modes** — smooth or locked, with a steady preview. *Where:* a clip's Effects. *Since:* 2.413.0
- **Adjustment layers** — colour and effects that work on everything under them. *Where:* the timeline toolbar. *Since:* 2.409.0

### Masks and tracking

- **Masks (power windows)** — an ellipse or box with feather and invert limits the grade and effects. *Where:* the Colour panel. *Since:* 2.416.0
- **Tracking** — the mask follows the thing to the clip's end. *Where:* the Colour panel. *Since:* 2.416.0

### Sound and mixing

- **Clean-up** — voice clarity, denoise and gain, with a before / after preview. *Where:* a clip's Sound fold. *Since:* 2.406.0
- **EQ, multiband and reverb** — on any clip's sound. *Where:* a clip's Sound fold. *Since:* 2.412.0
- **J / L cuts** — a clip's sound starts early or runs on late. *Where:* a clip's Sound fold. *Since:* 2.407.0
- **Linked sound** — a video's sound as its own linked clip; unlink or bring it back. *Where:* a clip's Properties. *Since:* 2.412.0
- **Mix dialog** — voice, music and sfx roles, ducking and loudness to a target. *Where:* the timeline's Mix button. *Since:* 2.406.0
- **Track mixer** — a fader, pan, mute, solo and live level meter per track and for the master. *Where:* the timeline menu bar. *Since:* 2.415.0
- **Waveforms** — every sound clip shows its waveform. *Where:* sound layers. *Since:* 2.64.0

### Captions and transcripts

- **Captions from speech** — everything that speaks is transcribed locally and placed where each clip sits. *Where:* the timeline's Captions button. *Since:* 2.406.0
- **Edit and style captions** — times, words, font, size, colour, outline or box, position. *Where:* the Captions dialog. *Since:* 2.406.0
- **Burn in or .srt** — burned into the movie and / or an .srt beside it. *Where:* the Captions dialog. *Since:* 2.406.0
- **Edit by transcript** — choose words, cut them or keep only them; remove pauses and filler words. *Where:* the timeline's Transcript button. *Since:* 2.408.0
- **Transcript scope** — this clip, its layer or the whole sequence. *Where:* the Transcript dialog. *Since:* 2.414.0
- **Scene cuts** — split a clip where its shots change, or drop markers there. *Where:* the Transcript dialog. *Since:* 2.408.0

### Multi-camera, nesting and proxies

- **Multi-camera** — sync angles by sound and cut live with keys 1 to 9; flatten into ordinary clips. *Where:* the timeline. *Since:* 2.416.0
- **Nested sequences** — another timeline compiled into one clip, re-rendered when it changes. *Where:* the timeline menu bar. *Since:* 2.414.0
- **Proxies** — small copies of heavy footage for playback; the movie uses the originals. *Where:* the timeline. *Since:* 2.416.0

### Playback

- **Render bar** — shows which stretches play live, may drop frames, are too heavy, or are rendered. *Where:* under the ruler. *Since:* 2.418.0
- **Render previews** — compile once and play the exact movie at full speed over rendered stretches. *Where:* the Render button. *Since:* 2.418.0
- **Late-frame counter and playback resolution** — full, half or quarter size while playing. *Where:* beside play. *Since:* 2.418.0
- **GPU compositor** — layers composited on the graphics card while playing. *Where:* the GPU switch. *Since:* 2.420.0

### AI in the timeline

- **New take** — render a clip again in its own slot and switch between takes. *Where:* the AI menu. *Since:* 2.420.0
- **Extend** — more seconds continuing from a clip's last frame. *Where:* the AI menu. *Since:* 2.420.0
- **B-roll** — fill an empty stretch of V1, or a cutaway over a range. *Where:* the AI menu. *Since:* 2.420.0
- **Cut to the beat** — find a song's beats, then drop markers or cut a clip on them. *Where:* the AI menu. *Since:* 2.420.0

### Path layers

- **Path layers** — draw a path and a subject (animal, person, vehicle) follows it, with size and pace. *Where:* the timeline bar's Path layer button. *Since:* 2.387.0
- **In place or along the path** — a green-screen clip moved by keyframes, or Wan ATI making it travel itself. *Where:* the path layer's panel. *Since:* 2.387.0
- **Cut out** — an AI matte or a chroma key; every path layer is see-through. *Where:* the path layer's panel. *Since:* 2.387.0

### The camera path

- **Camera panel** — presets, pan, tilt, roll, height, dolly and lens keys, with camera, top and side views. *Where:* the timeline bar's Camera. *Since:* 2.399.0
- **The camera tool** — drag on the canvas to pan, tilt, roll, change height and dolly. *Where:* Shift+C. *Since:* 2.399.0
- **Use in Generate** — each video model is told the move it can follow. *Where:* the Camera panel. *Since:* 2.399.0
- **Exact path guide** — a picture with depth flown along the path as a guide video. *Where:* the Camera panel. *Since:* 2.399.0

### 3D layers on the timeline

- **3D text and models** — extruded 3D text or FBX, OBJ, GLB and glTF models, moved and keyframed like any layer. *Where:* the 3D button under T. *Since:* 2.382.0
- **3D widgets** — move, rotate and scale in 3D with G, R and S. *Where:* the Move tool. *Since:* 2.385.0
- **Materials and lights** — material presets or your own, studio lights and your own point, spot, sun, ambient and sky lights. *Where:* the 3D layer's Properties. *Since:* 2.385.0
- **The 3D toolbar** — widget, snap, views, spin, reset, material, lights, key and bake. *Where:* along the top of the canvas. *Since:* 2.386.0
- **Baked for the compile** — a 3D layer is baked into a see-through video automatically. *Where:* Compile
- **Render with Blender** — a 3D layer rendered by Blender for the compile. *Where:* the 3D layer's Properties. *Since:* 2.385.0

### Rulers, guidelines and grids

- **Rulers and guidelines** — rulers in picture pixels; drag guidelines out, move them or type their place. *Where:* the timeline menu bar. *Since:* 2.446.0
- **Snapping** — moved layers snap to guidelines, the picture's edges and centre, and the grid. *Where:* the preview canvas. *Since:* 2.446.0
- **Grid** — a grid over the preview canvas with its own settings. *Where:* the timeline menu bar. *Since:* 2.445.0
- **Grids and Guides settings** — spacing, major lines, lines or dots, colours and snap distance. *Where:* Timeline settings. *Since:* 2.445.0

### Text and templates

- **Text effect presets** — layered 3D text looks drawn live as you type; import your own from a PSD. *Where:* a text layer's Properties. *Since:* 2.411.0
- **Motion graphics templates** — lower third, title card, end card and corner tag, or save your own. *Where:* the timeline menu bar. *Since:* 2.417.0

### Tools and the CAD toolbar on the timeline

- **Tools and Properties docker** — the canvas tools and the selected layer's settings in a docker of their own, docked beside the canvas or floating. *Where:* key 1. *Since:* 2.385.0
- **The timeline's CAD toolbar** — a ribbon over the preview row with Create, 3D, Sketch, Solid and Unreal tabs (see CAD and 3D). *Where:* the timeline. *Since:* 2.470.0
- **Timeline settings** — nudge, song time, karaoke style and grids. *Where:* the settings button at the right of the timeline menu bar. *Since:* 2.376.0

## The image editor

A layered picture editor with selections, retouching, smart objects, type, vector drawing, dimensions, CAD sketches and AI, all running on this computer.

### Layout, documents and panels

- **Menu bar, options bar and tool column** — File, Edit, Image, Layer, Select, Filter, View, Window and Help, each item with its usual shortcut; the options bar shows the current tool's settings. *Where:* the Image editor docker. *Since:* 2.389.0
- **Tool groups** — tools with more in their group cycle with Shift and their key, or open with a right-click or long-press. *Where:* the tool column
- **Command palette** — type part of a command and press Enter. *Where:* Ctrl+K
- **Keyboard shortcuts list** — every key in one list. *Where:* Help > Keyboard Shortcuts
- **Full screen** — the editor fills the space between bitGen's own bars; its status line moves into bitGen's status bar. *Where:* F or the full-screen button. *Since:* 2.393.0
- **Show or hide panels** — Tab hides every panel, Shift+Tab only the panel groups. *Where:* the image editor
- **Documents** — every New or Open is its own document with its own layers, undo, selection, paths, channels and zoom. *Where:* the image editor. *Since:* 2.430.0
- **Tabs and floating windows** — the first document docks as a tab, the next ones float in their own windows; drag between the two. *Where:* the document tabs. *Since:* 2.430.0
- **Close and arrange documents** — Close and Close All ask about unsaved changes; tile, cascade, consolidate to tabs, next and previous document. *Where:* File and Window > Arrange. *Since:* 2.430.0
- **Panel groups** — Color and Swatches; Properties, Adjustments, AI and Control; Layers, Paths, Channels, History, Actions and Comps; plus the Character, Paragraph, Sketch, 3D, Body and Unreal tabs. *Where:* the right column
- **Floating panel groups** — every tab group floats with its float button and docks back into the column. *Where:* each group's tabs. *Since:* 2.438.0
- **The column is a docker** — drop a floating group above or below another (an orange line shows where); the column's width drags from 200 to 640 px. *Where:* the right column. *Since:* 2.454.0
- **Named dockers in the editor** — dock floating groups as tabs in a docker you name. *Where:* Window > New Docker. *Since:* 2.438.0
- **The property bar** — X, Y, W and H of the picked layer with a proportion lock; rectangle corner radii; a vector shape's outline width and line style. *Where:* under the options bar. *Since:* 2.439.0
- **History** — the last 80 steps; click one to go back or forward to it. *Where:* the History panel
- **Editor settings** — AI results, context, feather, megapixels, what Apply does, the look, rulers, panels and the options bar. *Where:* the settings button, or Edit > Preferences (Ctrl+,). *Since:* 2.444.0

### Layers

- **Pixel, fill, text and shape layers** — solid colour or gradient fills, editable text and shapes. *Where:* the Layers panel
- **Adjustment layers** — 16 kinds (Brightness/Contrast, Levels, Curves, Exposure, Vibrance, Hue/Saturation, Color Balance, Black & White, Photo Filter, Channel Mixer, Color Lookup, Gradient Map, Selective Color, Invert, Posterize, Threshold), live in Properties. *Where:* the Adjustments panel
- **Groups** — Ctrl+G groups, Shift+Ctrl+G ungroups; Pass Through lets a group's adjustments reach the layers under it. *Where:* the Layers panel
- **Layer masks** — paint on the mask, Alt-click to view it, Shift-click to disable it, Ctrl-click to load it as a selection; density, feather, invert, apply. *Where:* the Layers panel
- **Clipping** — a layer shows only where the layer below has pixels. *Where:* Alt+Ctrl+G
- **Fill opacity, locks and labels** — fill opacity dims pixels but not styles; lock transparency, pixels, position or all; colour labels from the right-click menu. *Where:* the Layers panel
- **Arrange and merge** — move layers up and down, Merge Down, Merge Visible, Flatten Image, Rasterize. *Where:* the Layer menu
- **Layer comps** — keep the layers' visibility, position and appearance, switch between comps, update one, or go back to the last document state. *Where:* Window > Layer Comps. *Since:* 2.434.0
- **Delete a layer** — Del deletes the current layer (or clears a selection); Shift+Del always deletes the layer. *Where:* the image editor. *Since:* 2.451.0
- **No tool** — Esc puts the tools down (nothing picked); a click picks an object, Shift or Ctrl adds it. *Where:* the image editor, Esc. *Since:* 2.474.0
- **The selection box** — with no tool, drag a dashed box: left to right picks the layers wholly inside it, right to left the ones it touches; Shift adds. *Where:* the canvas with no tool. *Since:* 2.474.0
- **Several layers at once** — Shift-click picks every layer between two, Ctrl-click adds or takes one away; the Move tool moves them together and Del deletes them all. *Where:* the Layers panel. *Since:* 2.474.0

### Selections

- **Marquee, lasso and magic wand** — Shift adds, Alt subtracts, Shift+Alt intersects; feather softens the next selection. *Where:* M, L, W
- **The Select menu** — All, Deselect, Reselect, Inverse, Color Range, Modify (Border, Smooth, Expand, Contract, Feather), load a layer's transparency or mask. *Where:* the Select menu
- **Quick Mask** — the selection shown in red; paint to add, erase to remove. *Where:* Q
- **Segment Anything** — click a thing to select it, Shift-click for more, or drag a box; runs on this computer after a one-time install. *Where:* the Object Selection tool (W). *Since:* 2.390.0
- **Select Subject** — the main subject selected in one step: built in (no download) or the AI matte (BiRefNet on this computer). *Where:* Select > Subject, Subject Settings. *Since:* 2.488.0
- **Remove Background** — the subject put into the layer's mask, the background hidden. *Where:* Layer > Remove Background. *Since:* 2.488.0
- **Find by words** — type what to select ("the person's head", "dog, car") and select it or make it a mask. *Where:* the Object Selection options bar, Select > Subject. *Since:* 2.390.0
- **Segment Layer** — split a layer into its parts, each on its own layer in a group. *Where:* Layer > Segment Layer. *Since:* 2.390.0
- **Select and Mask** — a workspace with Quick Selection, Refine Edge and Brush, views, edge radius, smooth, feather, contrast, shift edge, decontaminate colours and output to a selection, mask or new layer. *Where:* Select > Select and Mask (Alt+Ctrl+R). *Since:* 2.423.0
- **Magnetic Lasso** — the line snaps to an edge as you move along it. *Where:* L. *Since:* 2.423.0
- **Quick Selection** — paint and the selection grows to the edges, with Auto-Enhance. *Where:* W. *Since:* 2.423.0
- **Select Sky** — the sky reaching the top edge, soft along the skyline. *Where:* Select > Sky. *Since:* 2.423.0
- **Saved selections** — save a selection into an alpha channel and load it again. *Where:* Select > Save Selection, Load Selection. *Since:* 2.423.0
- **Mask overlay** — what a mask hides shows red while you paint it, or all the time. *Where:* View > Mask Overlay. *Since:* 2.391.0

### Painting and retouching

- **Brush and Pencil** — 20 brush presets (plus yours and imported .abr brushes), number keys for opacity, pen pressure for size and flow; a hard-edged pencil. *Where:* B
- **Brush Settings** — tip angle, roundness and flips; shape dynamics, scattering, texture, dual brush, colour dynamics, transfer and smoothing, kept per preset. *Where:* the Brush tab. *Since:* 2.484.0
- **Brush presets and .abr brushes** — save the current brush as your own preset (brushes/<name>.json) and import the sampled brushes of .abr brush files. *Where:* the Brush tab. *Since:* 2.484.0
- **Clone Stamp and History Brush** — clone from a source; paint a layer back as it was opened. *Where:* S and Y
- **Eraser, Dodge, Burn, Sponge, Blur, Sharpen, Smudge** — the classic retouching brushes. *Where:* E, O and R
- **Spot Healing** — content-aware or proximity match, filled from around the spot. *Where:* J. *Since:* 2.423.0
- **Healing Brush** — the copy takes the colour and light of where it lands. *Where:* J. *Since:* 2.423.0
- **Patch** — drag a selection onto clean texture; Normal mode with Transparent and Diffusion, or Content-Aware with Structure and Color. *Where:* J. *Since:* 2.423.0
- **Content-Aware Move** — move or copy a thing; its old place is filled, with Structure and Color settings. *Where:* J. *Since:* 2.423.0
- **Red Eye** — click the red pupil. *Where:* J. *Since:* 2.423.0
- **Content-Aware Fill** — fill a selection from the rest of the picture, with no AI. *Where:* Edit > Content-Aware Fill, Edit > Fill. *Since:* 2.423.0
- **The Content-Aware Fill workspace** — choose the sampling area (auto, rectangular or painted), see a live preview, set colour adaptation and the output layer. *Where:* Edit > Content-Aware Fill. *Since:* 2.448.0
- **Mixer Brush** — the paint picks up the canvas's colour as it goes. *Where:* B. *Since:* 2.423.0
- **Background and Magic Eraser** — erase what is like the colour under the brush, or a whole area of one colour. *Where:* E. *Since:* 2.423.0
- **Gradient tool** — linear, radial, angle, reflected or diamond. *Where:* G
- **Paint Bucket** — fill with the foreground, the background or a gradient, with tolerance, contiguous and all layers. *Where:* G, Shift+G. *Since:* 2.396.0
- **Crop** — drag a box, pick a ratio, Enter crops. *Where:* C

### Transforms and warps

- **Free Transform** — move, scale, rotate, or type X, Y, W, H and the angle. *Where:* Ctrl+T
- **Skew, Distort, Perspective and Warp** — corners along their sides, anywhere, in mirror, or a warp grid with presets and a bend. *Where:* Edit > Transform. *Since:* 2.422.0
- **Warp grids and split lines** — 3 x 3 to custom grids; split the warp crosswise, vertically or horizontally for more points. *Where:* Edit > Transform > Warp. *Since:* 2.450.0
- **Puppet Warp** — place pins and drag them to bend the layer naturally. *Where:* Edit > Puppet Warp. *Since:* 2.422.0
- **Pin depth and rotation** — which part goes on top where it folds; a pin's turn held fixed or left free. *Where:* the Puppet Warp options bar. *Since:* 2.465.0
- **Content-Aware Scale** — narrower or wider while faces, objects and edges keep their shape; protect the selection. *Where:* Edit > Content-Aware Scale (Alt+Shift+Ctrl+C). *Since:* 2.422.0
- **Liquify** — forward warp, reconstruct, twirl, pucker, bloat, freeze and thaw masks. *Where:* Filter > Liquify (Shift+Ctrl+X). *Since:* 2.422.0
- **Liquify extras** — Smooth, Push Left and face-aware sliders for the eyes, nose, mouth and face shape. *Where:* Filter > Liquify. *Since:* 2.450.0
- **Move tool handles** — one click for scale handles, a double-click for rotate and skew handles; type stays editable and shapes stay vector. *Where:* V. *Since:* 2.452.0
- **Transform options** — angle, rotate by 90, flips and W x H percentages round the centre. *Where:* the Move tool's options bar. *Since:* 2.452.0

### Smart objects and smart filters

- **Smart objects** — a layer or group goes inside and stays editable; scaling, turning and warping lose nothing. *Where:* Layer > Smart Objects. *Since:* 2.422.0
- **Edit Contents** — open the inside, change anything, and every copy follows. *Where:* double-click the thumbnail. *Since:* 2.422.0
- **Replace, export, convert, rasterize** — replace the contents from a file, export them, turn them back into layers or plain pixels; New Smart Object via Copy makes an independent one. *Where:* Layer > Smart Objects. *Since:* 2.422.0
- **Smart filters** — any filter or adjustment on a smart object is added as a re-editable filter: on / off, settings, opacity, order. *Where:* the rows under the layer. *Since:* 2.422.0
- **Filter mask** — paint where the smart filters show. *Where:* the Smart Filters row. *Since:* 2.422.0
- **Smart filter blend modes** — 24 blend modes and an opacity per smart filter. *Where:* right-click a smart filter. *Since:* 2.434.0
- **Linked smart objects** — the contents live in a file in the project's linked folder; change the file and the layer follows. *Where:* File > Place Linked. *Since:* 2.469.0
- **Convert, embed and relink** — make an embedded smart object linked, embed a linked one, or relink it to another file; a missing file is flagged. *Where:* Layer > Smart Objects. *Since:* 2.469.0

### Adjustments, filters and layer styles

- **Image adjustments** — all 24 adjustments applied to the pixels, plus Auto Tone, Auto Contrast and Auto Color. *Where:* Image > Adjustments
- **Shadows / Highlights and HDR Toning** — local tone: lift the shadows and hold the highlights by amount, tone and radius; the HDR look with edge glow, gamma, exposure and detail. *Where:* Image > Adjustments. *Since:* 2.480.0
- **Selective Color** — add or take away cyan, magenta, yellow and black in nine colour ranges, relative or absolute; also an adjustment layer. *Where:* Image > Adjustments, Layer > New Adjustment Layer. *Since:* 2.480.0
- **Replace Color and Match Color** — pick a colour on the picture and shift its hue, saturation and lightness; give a layer the colour of another layer, the merged picture or a file. *Where:* Image > Adjustments. *Since:* 2.480.0
- **Color Lookup** — 3D LUTs: the timeline's looks and .cube files from the shared LUT library, mixed by an amount; also an adjustment layer. *Where:* Image > Adjustments. *Since:* 2.480.0
- **Apply Image** — blend another layer, the merged picture or one of their channels onto a layer with 11 modes, opacity and invert. *Where:* Image > Apply Image. *Since:* 2.480.0
- **Image size and canvas** — Image Size, Canvas Size with an anchor, rotation, crop to the selection and trim. *Where:* the Image menu
- **Filters** — blur, distort, noise, pixelate, render, sharpen and stylize filters, each previewed live; Ctrl+F repeats the last. *Where:* the Filter menu
- **Lens Flare, Swirl, Drop Shadow, 3D Extrude** — click the picture to place a flare or swirl centre. *Where:* the Filter menu. *Since:* 2.397.0
- **Blur set and Blur Gallery** — Surface, Smart and Lens Blur (depth, iris blades, bokeh highlights), Average; Field, Iris, Path and Spin Blur with click-to-place centres. *Where:* Filter > Blur, Filter > Blur Gallery. *Since:* 2.481.0
- **Noise and Smart Sharpen** — Reduce Noise, Dust & Scratches, Despeckle; Smart Sharpen that removes Gaussian, lens or motion blur and fades in the shadows and highlights. *Where:* Filter > Noise, Filter > Sharpen. *Since:* 2.481.0
- **Other filters** — High Pass, Minimum, Maximum, Offset, a Custom 5 x 5 kernel and HSB / HSL. *Where:* Filter > Other. *Since:* 2.481.0
- **Distort and Pixelate sets** — Displace (a map from a layer), Polar Coordinates, Pinch, ZigZag, Shear, Glass; Color Halftone, Crystallize, Pointillize, Facet, Fragment, Mezzotint. *Where:* Filter > Distort, Filter > Pixelate. *Since:* 2.481.0
- **Lighting Effects and render set** — spot, point and infinite lights with a height texture; Fibers and Difference Clouds; Diffuse, Tiles and Trace Contour. *Where:* Filter > Render, Filter > Stylize. *Since:* 2.481.0
- **Artistic, Sketch and Texture** — Cutout, Poster Edges, Watercolor, Dry Brush, Graphic Pen, Charcoal, Grain and Craquelure. *Where:* Filter > Artistic, Sketch, Texture. *Since:* 2.481.0
- **Develop Filter** — a photo developer: white balance, exposure, tone, texture, clarity, dehaze, vibrance, a tone curve, an eight-colour mixer, black & white, colour grading, sharpening and noise reduction, optics, geometry, grain and vignettes, with presets and your own. *Where:* Filter > Develop Filter (Alt+Shift+Ctrl+A). *Since:* 2.482.0
- **Lens Correction** — remove barrel or pincushion distortion, colour fringes and vignetting; fix perspective, angle and scale with a grid; fill the edges. *Where:* Filter > Lens Correction (Alt+Shift+Ctrl+R). *Since:* 2.482.0
- **Navigator, Histogram, Info and Notes panels** — the view box over a small picture; channel histograms with statistics; RGB, HSB and CMYK under the pointer with colour samplers; every note listed. *Where:* the Color panel group, Window menu. *Since:* 2.483.0
- **Color Sampler, Ruler, Note and Count tools** — up to ten samplers, a ruler that straightens a layer or the picture, pinned notes and numbered count groups. *Where:* the Eyedropper's tool group (I). *Since:* 2.483.0
- **Perspective Crop** — four corners onto what should be square; Enter crops and squares the whole picture. *Where:* the Crop tool's group (C). *Since:* 2.483.0
- **Grow, Similar, Focus Area, Transform Selection, Matting** — grow or extend a selection by colour, select the sharp parts, move / scale / rotate the selection; defringe and remove black or white mattes. *Where:* the Select and Layer menus. *Since:* 2.483.0
- **Quick Adjust and Filter menus** — work on the active layer, only inside the selection when there is one. *Where:* the image editor
- **Layer styles** — drop shadow, inner shadow, outer and inner glow, stroke, colour, gradient and pattern overlay, bevel and emboss, satin; copy and paste them. *Where:* fx, or double-click a thumbnail
- **Style presets** — one-click Gold, Chrome, Neon, Embossed, Glass, 3D Pop, Retro, Fire, Ice and Letterpress. *Where:* the Layer Style dialog. *Since:* 2.397.0

### Type

- **Horizontal, Vertical and Type on a Path** — the letters follow a drawn line; move the start or flip the side. *Where:* T, Shift+T. *Since:* 2.397.0
- **All caps, underline, strikethrough, vertical** — buttons in the Type options bar. *Where:* the Type options bar. *Since:* 2.397.0
- **Text shape and 3D** — eleven warps, text round a circle, along a path, or extruded 3D letters, all still editable. *Where:* Layer > Text Shape. *Since:* 2.397.0
- **Character panel** — font, style, size, leading, kerning, tracking, scales, baseline shift, faux bold and italic, small caps, super- and subscript. *Where:* Window > Character. *Since:* 2.426.0
- **Paragraph panel** — alignment, justify, indents, space before and after, hyphenate. *Where:* Window > Paragraph. *Since:* 2.426.0
- **Paragraph text** — drag a box with the Type tool and the text wraps inside it; convert between point and paragraph text. *Where:* T. *Since:* 2.426.0
- **Character and paragraph styles** — make, apply, clear overrides and redefine styles. *Where:* the Character and Paragraph panels. *Since:* 2.426.0
- **Per-character settings** — select letters while typing and change only their font, size, colour or any Character setting. *Where:* the Type tool. *Since:* 2.449.0
- **OpenType features** — ligatures, alternates, swash, ordinals, fractions, figure styles, small caps and stylistic sets from the font's own file. *Where:* the Character panel. *Since:* 2.466.0
- **Optical kerning** — letters spaced from their shapes. *Where:* the Character panel. *Since:* 2.466.0
- **Type to outlines** — convert text to a shape layer of its outlines, or create a work path from it. *Where:* Layer > Type. *Since:* 2.466.0
- **Text in a shape** — click inside a shape with the Type tool and the text flows inside its outline. *Where:* the Type tool. *Since:* 2.466.0
- **Text effect presets** — the same layered 3D text presets as the timeline, drawn live. *Where:* the Type options bar, a text layer's Properties. *Since:* 2.411.0

### Pen, paths and vector masks

- **Pen** — corner and smooth anchors, close, cusp, 45-degree steps, auto add and delete. *Where:* P. *Since:* 2.421.0
- **Freeform Pen and point tools** — draw by hand and fit curves; add, delete and convert anchor points. *Where:* Shift+P. *Since:* 2.421.0
- **Curvature Pen and Rubber Band** — the curve bends smoothly through the points you click; preview the next segment. *Where:* P. *Since:* 2.425.0
- **Path Selection** — move, copy, combine and transform whole components; align and distribute them. *Where:* A. *Since:* 2.421.0
- **Direct Selection** — anchors and handles, nudge, corner or smooth. *Where:* A. *Since:* 2.421.0
- **Shape or Path mode** — draw a shape layer or the work path; combine, subtract, intersect or exclude. *Where:* the options bar. *Since:* 2.421.0
- **Custom Shape tool** — heart, star, burst, arrow, speech bubble, cloud and more, plus your own. *Where:* U, Edit > Define Custom Shape. *Since:* 2.421.0
- **The Paths panel** — the work path, saved paths, shape paths and vector masks; fill, stroke, make a selection or a mask. *Where:* the Paths tab. *Since:* 2.421.0
- **Vector masks** — reveal all, hide all, the current path; density, feather, invert, link and rasterize. *Where:* Layer > Vector Mask. *Since:* 2.421.0
- **Paths follow the picture** — crop, canvas size, image size and rotate move the paths too. *Where:* the image editor. *Since:* 2.421.0
- **Round corners on any path** — round the picked corners of a path, a joined shape or a vector mask. *Where:* Direct Selection, the Radius box. *Since:* 2.466.0

### Vector lines and drawing tools

- **Bézier tool** — cusp and smooth nodes, 15-degree steps, close, or carry an open line on. *Where:* F5. *Since:* 2.425.0
- **Freehand, 2-Point Line, Polyline, 3-Point Curve, B-Spline, Node Pen** — the other curve tools. *Where:* F5 again. *Since:* 2.425.0
- **Arrowheads and line styles** — solid, dashed, dotted, dash-dot and custom lines, with start and end arrowheads (arrow, triangle, circle, square, diamond, bar and more). *Where:* the curve tools' property bar. *Since:* 2.425.0
- **Shape tool (nodes)** — pick and drag nodes, handles and segments; add, delete, join, break, reverse, close and reduce nodes. *Where:* F10. *Since:* 2.425.0
- **Outline Pen** — colour, width, dashes, corners, caps, position, arrowheads, behind fill, scale with object. *Where:* F12. *Since:* 2.425.0
- **Convert to Curves** — a rectangle, ellipse, polygon or line becomes an editable vector line. *Where:* Ctrl+Q. *Since:* 2.425.0
- **Vector line and path** — a line becomes a path that remembers its outline, and back again. *Where:* Layer > Vector Line. *Since:* 2.425.0
- **Shape tools** — rectangle with per-corner round, scallop or chamfer corners, 3-point rectangle, ellipse with pie and arc, 3-point ellipse, polygon, star, complex star, spiral, graph paper and common shapes, all live. *Where:* F6. *Since:* 2.428.0
- **Draw modes into a shape** — new, add, subtract, intersect or exclude a new shape into the picked one. *Where:* the shape tools' bar. *Since:* 2.439.0
- **Artistic Media** — preset, calligraphic, pressure and sprayer strokes that become filled shapes. *Where:* F5. *Since:* 2.428.0
- **Connectors** — straight, right-angle or rounded lines that follow the objects they join. *Where:* F8. *Since:* 2.428.0
- **Callouts** — a 3-point callout with its text. *Where:* F8. *Since:* 2.428.0
- **Auto-fill** — a closed curve or new shape is filled with the colour picked last. *Where:* the curve tools' bar. *Since:* 2.430.0
- **Hover and pick highlight** — with the Move tool the object under the pointer is outlined in blue and the picked one in orange; a click on empty canvas picks nothing. *Where:* the Move tool. *Since:* 2.470.0
- **Move tool after drawing** — after a shape is drawn the Move tool is picked with the new shape selected (can be switched off). *Where:* the CAD toolbar's settings. *Since:* 2.470.0

### Dockers for vector work

- **Transform docker** — position, rotate, scale and mirror, size and skew about nine anchor points, with copies. *Where:* Window > Dockers (Alt+F7). *Since:* 2.429.0
- **Shaping docker** — weld, trim, intersect, simplify, front minus back, back minus front, boundary. *Where:* Window > Dockers. *Since:* 2.429.0
- **Align and Distribute** — to the active object, the selection, the page edge or centre. *Where:* Shift+Ctrl+A. *Since:* 2.429.0
- **Object Properties** — fill (uniform or gradient), outline and transparency of a vector shape. *Where:* Alt+Enter. *Since:* 2.429.0

### Frames and artboards

- **Frames** — place layers inside a closed shape; they show only within it and move, turn and scale with it. *Where:* Layer > Frame > Place Inside Frame. *Since:* 2.442.0
- **Edit and extract frame contents** — work on the contents alone, finish editing, or take them out. *Where:* double-click or right-click a frame. *Since:* 2.442.0
- **Locked frame contents** — the Move tool takes the frame and its handles transform the contents with it. *Where:* Lock Contents to Frame. *Since:* 2.453.0
- **Artboards** — several pages of their own size in one picture, from presets or your own size. *Where:* Layer > New > Artboard. *Since:* 2.447.0
- **Artboard tool and from group** — drag a new artboard, or turn a group into one. *Where:* V again, Layer > New > Artboard from Group. *Since:* 2.447.0
- **Export artboards** — each artboard as its own PNG. *Where:* File > Export > Artboards to Files. *Since:* 2.447.0

### Dimensions

- **Dimension tools** — parallel, horizontal / vertical and angular dimensions, with units at a dpi. *Where:* F8. *Since:* 2.428.0
- **Exact points** — dimensions snap to nodes, side middles, corners, outlines and guideline crossings, named as you hover. *Where:* the dimension tools. *Since:* 2.441.0
- **Live ends** — drag a dimension's end and its number follows. *Where:* the Move tool on a dimension. *Since:* 2.441.0
- **A scale per picture** — type a dimension's real size and unit and every dimension is measured with that scale. *Where:* the property bar. *Since:* 2.441.0
- **Dimension groups** — each dimension is a group of extension lines and a dimension line, redrawn from its measurements. *Where:* the Layers panel. *Since:* 2.457.0
- **Auto Dimension** — the picked object's overall width and height. *Where:* Layer > Auto Dimension. *Since:* 2.458.0
- **Floorplan Dimensions** — every wall of a closed shape dimensioned outside, plus the overall size. *Where:* Layer > Floorplan Dimensions. *Since:* 2.458.0
- **Chain Dimension tool** — a dimension between every two points along a line, plus the total. *Where:* F8. *Since:* 2.458.0

### Rulers, guidelines and snapping

- **Rulers in units** — pixels, millimetres, centimetres, inches or points. *Where:* View > Rulers (Ctrl+R). *Since:* 2.440.0
- **Guidelines** — drag out of a ruler, move, lock, type a place, list and clear. *Where:* View > Guidelines. *Since:* 2.440.0
- **Snapping** — to the grid, guidelines, objects, nodes, midpoints, intersections and the page; the Move tool snaps the layer's box. *Where:* View > Snap To. *Since:* 2.440.0
- **Grid button and settings** — spacing, major lines, lines or dots, colours and snap distance. *Where:* the top bar and the Grids and Guides settings. *Since:* 2.445.0

### Channels

- **Channels panel** — view RGB, Red, Green or Blue alone, or load a channel's lightness as a selection. *Where:* the Channels tab. *Since:* 2.423.0
- **Alpha channels** — saved selections you can view, load, rename and paint. *Where:* the Channels tab. *Since:* 2.423.0
- **Edit single colour channels** — painting, fills, filters and adjustments change only the picked channels. *Where:* the Channels panel (Ctrl+3 to Ctrl+5). *Since:* 2.467.0
- **Spot channels** — an ink colour and solidity shown over the picture, merged into a layer when you want. *Where:* the Channels panel, Select > New Spot Channel. *Since:* 2.467.0

### Colour, gradients and patterns

- **Colour swatches** — default colours, swap (which repaints a plain background), large outlined swatches. *Where:* D and X. *Since:* 2.396.0
- **The colour palette** — a strip of colours: click for the fill, right-click for the outline of a shape or type, or the foreground and background on pixels. *Where:* the right edge of the editor. *Since:* 2.430.0
- **Transparent swatch** — as the foreground a brush paints transparency. *Where:* the palette and Swatches panel. *Since:* 2.430.0
- **Gradient Editor** — presets plus your own, stops with colour, opacity and location; used by the Gradient tool, the bucket, fill layers and shapes. *Where:* Edit > Gradient Editor. *Since:* 2.434.0
- **Pattern library** — define patterns from the picture, pattern fill layers, fill with a pattern, and your patterns in Pattern Overlay. *Where:* Edit > Define Pattern, Pattern Library. *Since:* 2.437.0

### Actions and automation

- **Actions** — record menu commands, dialogs, filters and Layers panel changes, then play them; sets of actions with a default set. *Where:* the Actions tab (Alt+F9). *Since:* 2.427.0
- **Edit actions** — step on / off, stop in a dialog, insert stops and menu items, function keys, button mode, load and save. *Where:* the Actions tab. *Since:* 2.427.0
- **Batch** — play an action on many pictures or a folder, saved to the project, the gallery or downloads. *Where:* File > Automate > Batch. *Since:* 2.427.0
- **Brush strokes and hand-made selections recorded** — played back at the same place, scaled to the picture. *Where:* the Actions tab. *Since:* 2.468.0
- **Conditional steps** — if the document is landscape, portrait or square, has a selection, or a kind of layer, play one action, else another. *Where:* Actions > Insert Conditional. *Since:* 2.468.0
- **Image Processor** — save pictures as JPEG and / or PNG, resized, optionally after an action. *Where:* File > Scripts > Image Processor. *Since:* 2.468.0
- **Droplets** — a tile you drop pictures on to run an action on each. *Where:* File > Automate > Create Droplet. *Since:* 2.468.0
- **.atn action files** — load action sets from .atn files; matched steps play, the rest come in switched off. *Where:* Actions > Load Actions. *Since:* 2.469.0

### Files

- **New, Open and Save to Images** — a new picture in the background colour; save the visible picture into the project's Images. *Where:* File (Ctrl+N, Ctrl+O, Ctrl+S)
- **Export As** — PNG, JPEG, WebP, JPEG XL, AVIF, GIF, TIFF, BMP or TGA with quality, scale, a preview and the file size. *Where:* File > Export As
- **File Info** — title, author, description, keywords, copyright and URL, kept with the document and written into exported PNG and JPEG files. *Where:* File > File Info (Alt+Shift+Ctrl+I). *Since:* 2.485.0
- **Print** — fit to the page, a size or a percentage, portrait or landscape, then the system's print dialog. *Where:* File > Print (Ctrl+P). *Since:* 2.485.0
- **Contact Sheet** — pictures from files or the open documents in a grid on a new document, one layer each, with captions. *Where:* File > Automate > Contact Sheet. *Since:* 2.485.0
- **Crop and Straighten Photos** — each photo on a scan found, turned straight and opened as its own document. *Where:* File > Automate > Crop and Straighten Photos. *Since:* 2.485.0
- **Auto-Align Layers** — line the picked layers up on one of them: perspective, move / turn / scale, or move only. *Where:* Edit > Auto-Align Layers. *Since:* 2.486.0
- **Auto-Blend Layers** — masks that blend layers into a panorama (soft seams, matched tones) or a focus stack (the sharpest layer at each spot). *Where:* Edit > Auto-Blend Layers. *Since:* 2.486.0
- **Photomerge** — stitch overlapping pictures (files or the open documents) into a panorama document with one masked layer each. *Where:* File > Automate > Photomerge. *Since:* 2.486.0
- **Merge to HDR** — fuse bracketed exposures, lined up first, into one well-exposed picture. *Where:* File > Automate > Merge to HDR. *Since:* 2.486.0
- **Image modes** — Bitmap, Grayscale, Duotone (1-4 inks), Indexed Color (palettes, dither, Color Table with .act files), RGB and CMYK (a press model: paper, black generation, total ink). *Where:* Image > Mode. *Since:* 2.487.0
- **Proof colours and gamut warning** — see the picture as a press would print it and which colours it cannot print; on screen only. *Where:* View > Proof Setup, Proof Colors (Alt+Ctrl+Y), Gamut Warning (Shift+Ctrl+Y). *Since:* 2.487.0
- **CMYK TIFF** — export the four printing inks for a print shop. *Where:* File > Export As > TIFF (CMYK, for print). *Since:* 2.487.0
- **JPEG XL files** — open, place and drop .jxl pictures; export JPEG XL with a quality or lossless; .jxl pictures show everywhere in the app and are sent to ComfyUI and the compile as PNG. *Where:* File > Open, Export As > JPEG XL, the Assets docker. *Since:* 2.479.0
- **Copy and paste** — copy, cut, paste, paste in place, copy merged and system clipboard pictures. *Where:* the Edit menu
- **PSD files** — layers, groups, masks, opacity, blend modes, visibility, layer styles, vector masks and shapes come across both ways. *Where:* File > Open PSD, Save as PSD. *Since:* 2.390.0
- **PSD smart objects kept** — embedded smart objects open as smart objects and are saved back as placed layers. *Where:* PSD files. *Since:* 2.469.0
- **SVG paths and shapes** — export a path as SVG, place an SVG as a shape layer. *Where:* File > Export Path as SVG, Place SVG as Shape Layer. *Since:* 2.421.0
- **PDF files** — a page opens as its picture without its text plus one type layer per line of text; edit with every tool. *Where:* File > Open PDF. *Since:* 2.424.0
- **PDF pages** — add blank pages or another PDF's pages, move pages (buttons or drag) and take pages out; saved in the new order with untouched pages kept as they were. *Where:* the PDF Pages strip, File > Add / Remove PDF Pages. *Since:* 2.488.0
- **Save PDF** — changed pages saved back with real, searchable text; unchanged pages stay vector. *Where:* File > Save PDF, Save as New. *Since:* 2.424.0
- **Embed fonts in PDFs** — each line written in its own font from this computer or the fonts folder, so any alphabet stays real text. *Where:* the Save PDF dialog. *Since:* 2.435.0
- **.bgi project files** — layers, masks, live text, shapes, fills, adjustments, styles, smart objects with their filters, paths, channels, the selection and layer comps kept fully editable, in a zip any unzip opens. *Where:* File > Save Project (Alt+Ctrl+S). *Since:* 2.436.0

### AI in the image editor

- **AI panel** — the model sees the selection plus a context margin and answers as a new layer inside the feathered selection. *Where:* the AI panel
- **Generate** — renders into the selection of the selected layer from the prompt docker; Apply blends it in. *Where:* the AI panel's Generate tab. *Since:* 2.444.0
- **Edit** — follow an instruction with Qwen Image 2.1 edit, typed in the prompt docker. *Where:* the AI panel's Edit tab. *Since:* 2.444.0
- **Refine, Remove and Background** — rework at a strength, remove what is selected, or regenerate everything else. *Where:* the AI panel
- **Expand** — grow the canvas and continue the picture into it. *Where:* the AI panel
- **Results** — make 1 to 4 versions, compare them, apply or discard. *Where:* the AI panel
- **Control layers** — scribble, line art, soft edge, canny, depth, normal, pose or segmentation layers guide the AI through ControlNet. *Where:* the Control panel
- **Compose** — layers as references: put the thing from one layer into the scene of another. *Where:* the AI panel. *Since:* 2.390.0
- **Send to References** — the picked layers go to the reference dock for any render. *Where:* Layer > Send to References. *Since:* 2.390.0
- **Generate Fill in Shape or Mask** — generate inside a shape's outline or a layer's mask, clipped to it. *Where:* the Layer menu. *Since:* 2.437.0
- **Generate into a shape** — with a closed shape active the result goes inside it as a frame. *Where:* the AI panel. *Since:* 2.442.0
- **The prompt docker follows the tab** — the Edit tab switches the prompt docker to image editing, the Generate tab to generating into the selection. *Where:* the AI panel. *Since:* 2.451.0
- **Generate from a 3D layer** — a new image made from the 3D view as you see it. *Where:* the 3D tab. *Since:* 2.460.0

## CAD and 3D

Precise drawing with constraints, measuring, CAD files, and parametric 3D bodies built from sketches.

### Sketch layers

- **Sketch layers** — a CAD sketch of lines, rectangles, circles and arcs held in shape by constraints and dimensions, with a fixed origin and two construction axes. *Where:* Layer > New Sketch, or any sketch tool. *Since:* 2.462.0
- **Sketch tools** — Sketch Select, Line, 2-Point and Center Rectangle, Circle, 3-Point Arc, Point and Sketch Dimension, each with its own letter. *Where:* N in the tool column. *Since:* 2.462.0
- **Line chains** — click point after point; nearly level or upright lines snap and get Horizontal or Vertical; ends join where they meet. *Where:* the Line tool. *Since:* 2.462.0
- **Construction geometry** — turn what is picked into dashed construction lines that are never drawn in the picture. *Where:* X. *Since:* 2.462.0
- **Sketch Select** — pick and drag points, lines and circle edges while the constraints hold. *Where:* S with a sketch tool. *Since:* 2.462.0
- **Colours while sketching** — blue is still free, black is fully constrained, orange dashed is construction, grey numbers are driven dimensions. *Where:* the sketch. *Since:* 2.462.0
- **Profiles to shapes** — every closed region becomes a shape layer above the sketch. *Where:* Profiles > Shapes. *Since:* 2.462.0
- **Fill profiles** — the closed regions filled, with the line colour and width you choose. *Where:* the Sketch tab. *Since:* 2.462.0
- **Finish Sketch** — back to the Move tool. *Where:* the Sketch tab. *Since:* 2.462.0
- **Kept in .bgi** — a .bgi keeps every constraint; moving or scaling the layer moves its sketch. *Where:* .bgi files. *Since:* 2.462.0

### Constraints and dimensions

- **Constraints** — Coincident, Collinear, Concentric, Midpoint, Fix, Parallel, Perpendicular, Horizontal, Vertical, Tangent, Equal and Symmetric. *Where:* the Sketch tab. *Since:* 2.462.0
- **Degrees of freedom** — how many are left, with a tick when fully constrained. *Where:* the Sketch tab. *Since:* 2.462.0
- **Over-constraint refused** — a constraint already set by the others is refused, and a dimension becomes a driven one instead. *Where:* the sketch. *Since:* 2.462.0
- **Sketch dimensions** — a line's length, two points' distance, two lines' angle, a circle's diameter or an arc's radius; type the value, sums work. *Where:* D. *Since:* 2.462.0
- **Typed sizes while drawing** — type a length and angle, width and height, diameter or radius as you draw; the values are kept as dimensions. *Where:* any sketch tool. *Since:* 2.464.0

### More sketch tools

- **Polygon** — a centre and a corner, the number of sides, kept on a construction circle. *Where:* the N tools. *Since:* 2.463.0
- **Slot** — two half-circles joined by tangent lines. *Where:* the N tools. *Since:* 2.463.0
- **2-Point and 3-Point Circle** — a circle from a diameter or three points. *Where:* the N tools. *Since:* 2.463.0
- **Spline** — a smooth curve through every point you click. *Where:* the N tools. *Since:* 2.463.0
- **Trim** — cut away the piece of a line, circle or arc between the nearest crossings. *Where:* T. *Since:* 2.463.0
- **Extend** — run a line on to the next line or circle. *Where:* E. *Since:* 2.463.0
- **Fillet and Chamfer** — a tangent arc or a straight cut at a corner, with its value as a dimension. *Where:* F. *Since:* 2.463.0
- **Offset** — a copy at a distance that stays parallel or concentric. *Where:* the Sketch tab > Modify. *Since:* 2.463.0
- **Offset tool** — click a chain, then the pointer picks the side and distance (or type it); lines drawn any way round go out or in together and rounded corners stay joined. *Where:* the Sketch tab > Modify > Offset (O). *Since:* 2.494.0
- **Mirror** — mirrored copies held symmetric about a line. *Where:* the Sketch tab > Modify. *Since:* 2.463.0
- **Rectangular and Circular Patterns** — copies in rows and columns or round a point, with the same constraints. *Where:* the Sketch tab > Modify. *Since:* 2.463.0

### Measure, units and CAD files

- **Measure** — lengths, angles, radii, areas and perimeters of one item, between two, or inside a closed region; copy the numbers. *Where:* M with a sketch tool. *Since:* 2.464.0
- **Units** — pixels, or millimetres and inches with a scale. *Where:* the Sketch tab > Measure and CAD files. *Since:* 2.464.0
- **Export DXF** — an R12 DXF that CAD, laser and CNC programs open, with construction lines and dimensions on their own layers. *Where:* File > Export Sketch as DXF. *Since:* 2.464.0
- **Export SVG** — the sketch at a real size with its lines and profiles. *Where:* File > Export Sketch as SVG. *Since:* 2.464.0
- **Import DXF** — lines, circles, arcs, polylines, splines and ellipses into a sketch, fitted or at real size, ends joined into profiles. *Where:* File > Import DXF. *Since:* 2.464.0

### The CAD toolbar

- **A ribbon toolbar** — tabs over groups of big buttons; each group's name opens every item in it; fold it down to its tabs. *Where:* along the top of the image editor and the timeline. *Since:* 2.470.0
- **Sketch tab** — Create (new sketch, lines, rectangles, circles, arc, polygon, slot, spline, point), Modify (fillet, chamfer, trim, extend, offset, mirror, patterns, construction), the 12 constraints, Inspect (dimension, measure), Insert (DXF in and out, SVG out) and Finish Sketch. *Where:* the CAD toolbar. *Since:* 2.470.0
- **Shapes tab** — Select (the Move tool, pick nothing), Draw (the shape tools) and the after-drawing switch. *Where:* the CAD toolbar. *Since:* 2.470.0
- **The tab follows the work** — picking a sketch tool or sketch layer opens the Sketch tab; a 3D layer opens the 3D tab on the timeline. *Where:* the CAD toolbar. *Since:* 2.470.0
- **Timeline tabs** — Create (text, 3D text, 3D model, camera, path, the canvas tools), 3D (widget, views, key, bake) and Sketch. *Where:* the timeline's CAD toolbar. *Since:* 2.470.0
- **Sketch on a frame** — the frame at the playhead, or a blank picture of the timeline's size, opens in the image editor with a new sketch layer. *Where:* the timeline's Sketch tab. *Since:* 2.470.0
- **Show or hide it** — the toolbar can be kept on or left to show only when needed. *Where:* Window > CAD Toolbar, or the ⌬ CAD buttons. *Since:* 2.470.0
- **The CAD button** — the CAD toolbar shows by itself while a sketch, a sketch tool or a 3D body is picked; the ⌬ CAD button in the tool column keeps it on (the timeline has its own). *Where:* the image editor's and the timeline's tool columns. *Since:* 2.494.0
- **Sketch flow** — Select leads the Sketch tab, Create Sketch hides while a sketch is edited, Finish Sketch goes on to the Solid tab. *Where:* the CAD toolbar. *Since:* 2.494.0
- **Draw on from a line** — a ＋ beyond each end of the picked line starts the Line tool from that end. *Where:* Sketch Select. *Since:* 2.494.0

### Parametric 3D bodies

- **Body layers** — a 3D body drawn from its features as a smart object, so moving, scaling, filters and masks all work. *Where:* the CAD toolbar's Solid tab, Layer > 3D Body. *Since:* 2.471.0
- **Extrude** — a sketch's closed profiles by a distance, one side, symmetric or two sides, as a new body or joined, cut or intersected with one. *Where:* the Solid tab. *Since:* 2.471.0
- **Pick the profile** — Extrude and Revolve let you click the closed regions to use, highlighted under the pointer. *Where:* the Solid tab. *Since:* 2.494.0
- **Revolve** — profiles spun round the sketch's X or Y axis or one of its lines, by an angle. *Where:* the Solid tab. *Since:* 2.471.0
- **Fillet and Chamfer** — round or bevel all, top, bottom, vertical or horizontal edges. *Where:* the Solid tab. *Since:* 2.471.0
- **Shell** — hollow the body, open at the top or bottom. *Where:* the Solid tab. *Since:* 2.471.0
- **Split Body** — cut by a plane; one side stays, the other becomes a new body layer. *Where:* the Solid tab. *Since:* 2.471.0
- **Parameters** — named values and expressions with units (mm, cm, m, in, deg) used by every feature; change one and the body rebuilds. *Where:* the Solid tab's Change Parameters. *Since:* 2.471.0
- **The feature list** — every feature in order: suppress, edit, delete or reorder, with errors in red. *Where:* the Body tab. *Since:* 2.471.0
- **Rebuilds from the sketch** — a sketch edited later rebuilds the bodies made from it. *Where:* body layers. *Since:* 2.471.0
- **Views and orbit** — home, front, top, right, left, back, or drag the body round. *Where:* the Solid tab. *Since:* 2.471.0
- **The view cube and 3D navigation** — click a face or corner of the cube for that view, drag it to orbit; Shift + middle-drag orbits a body, middle-drag pans, the wheel zooms. *Where:* the canvas while a body is picked. *Since:* 2.494.0
- **The look** — colour, metal, roughness and edges, and the view's turn, tilt and roll. *Where:* the Body tab. *Since:* 2.471.0
- **Export STL, glTF and STEP** — the body as a file for printing, 3D apps or CAD. *Where:* the Solid tab > Export. *Since:* 2.471.0
- **Bodies on the timeline** — send a body to the timeline as a 3D layer; it updates by itself when the body changes. *Where:* the timeline's Solid tab. *Since:* 2.471.0
- **Edit in Image Editor** — open the image editor with that body picked. *Where:* the timeline's Solid tab. *Since:* 2.471.0
- **Two engines** — OpenCascade running in the page (exact fillets, booleans and shells, nothing to install) or Blender on this computer. *Where:* Settings > 3D. *Since:* 2.471.0

### 3D layers in the image editor

- **3D layers** — a Daz or Blender scene in a picture, drawn again by Blender whenever its view changes; masks, filters and blend modes work. *Where:* Layer > New 3D Layer. *Since:* 2.460.0
- **Camera** — the scene camera, front, back, left, right or top, or turn, tilt, distance and lens; drag on the canvas to orbit, pan and zoom. *Where:* the 3D tab. *Since:* 2.460.0
- **Pose** — pick a figure and bone and turn it on top of its pose. *Where:* the 3D tab. *Since:* 2.460.0
- **Frame and render** — pick a frame of an animated scene; render it Quick, EEVEE or Cycles, with a transparent background. *Where:* the 3D tab. *Since:* 2.460.0

### 3D scenes and models from pictures

- **Image to 3D** — Hunyuan3D 2.1 (shape) or TRELLIS.2 (shape and texture) make a .glb from any picture. *Where:* the 3D button on Gallery and Assets pictures. *Since:* 2.404.0
- **Build a scene with AI** — the local LLM plans a 3D scene from 58 kinds of object, a camera path and 3D models for the rest; Blender builds it. *Where:* the Blender preview's Build button. *Since:* 2.404.0

## Bridges

Live links to Blender, Daz Studio and Unreal Engine 5.8, all on the same computer.

### Blender

- **The Blender add-on** — a bitGen tab in Blender's sidebar: send a scene or selection as glTF (or as a 3D layer), a live link that re-sends on every save, and get the project's 3D models into Blender. *Where:* Blender's sidebar (N). *Since:* 2.385.0
- **Render scene to real** — renders a Blender layout through its camera and has LTX 2.3 with 3DREAL make it photoreal. *Where:* the add-on's Render scene button. *Since:* 2.402.0
- **A .blend in the preview canvas** — open a .blend over the timeline canvas: look through its camera or a free view, select, move, key, duplicate, hide and delete objects. *Where:* the Blender button in the canvas tools. *Since:* 2.403.0
- **Segments and saving** — set an In and Out, save only in bitGen, back to the original, or to a new file. *Where:* the .blend preview's Properties. *Since:* 2.403.0
- **Render to real from the preview** — render the segment and queue an LTX 2.3 3DREAL job. *Where:* the .blend preview. *Since:* 2.403.0
- **Add models** — add a project 3D model to the open scene. *Where:* the .blend preview's Properties. *Since:* 2.404.0
- **Poses in the preview** — turn a figure's bones; Blender keys the pose on save and render. *Where:* the .blend preview's Pose section. *Since:* 2.461.0
- **To the image editor** — the scene as a 3D layer with this pose and view. *Where:* the .blend preview. *Since:* 2.461.0

### Daz Studio

- **The bitGen Bridge script** — render the animation to real, render a frame to a picture, send the scene as 3D to open or merge, or a figure as a 3D model. *Where:* Daz Studio's Scripts > bitGen. *Since:* 2.405.0
- **The Merge dialog** — pick the figures, lights and cameras to merge into the open scene, the scene camera and the frame range. *Where:* bitGen, when a Daz scene arrives. *Since:* 2.405.0
- **Daz scenes as 3D layers** — send a scene and open it as a 3D layer in the image editor. *Where:* bitGen Bridge > Scene. *Since:* 2.460.0
- **The live link (experimental)** — bitGen moves the camera and poses in Daz Studio itself. *Where:* Daz Studio's bitGen Live Link, the 3D tab, the timeline's Pose section. *Since:* 2.461.0

### Unreal Engine 5.8

- **The bitGen Bridge plugin** — a Python-only plugin for the Unreal Editor that lists the project's levels, Level Sequences, cameras, MetaHumans and animations, answering only on this computer. *Where:* the project's Plugins folder. *Since:* 2.472.0
- **Unreal settings** — the port, an "alpha is inverted" switch, Test connection and how to install the plugin. *Where:* Settings > 3D > Unreal Engine. *Since:* 2.472.0
- **Unreal layers in the image editor** — a level seen through one of its cameras, or the level viewport as it is now, as a picture layer. *Where:* the CAD toolbar's Unreal tab, Layer > New Unreal Layer. *Since:* 2.472.0
- **MetaHuman layers in the image editor** — a MetaHuman in the pose of an animation at a time, framed face, bust or full body, turned, on a clear background. *Where:* the Unreal tab, Layer > New MetaHuman Layer. *Since:* 2.472.0
- **The Unreal tab** — nudge the camera's turn, tilt, dolly and field of view (or the figure's turn, pose time and framing), use the viewport now, render again. *Where:* the layer's Unreal tab in Properties. *Since:* 2.472.0
- **Unreal layers on the timeline** — a Level Sequence, or a level through a camera for a length you pick, rendered by the Movie Render Queue at the timeline's size and frame rate. *Where:* the timeline's Unreal tab. *Since:* 2.472.0
- **MetaHuman layers on the timeline** — a MetaHuman playing an animation on a clear background, over the other layers. *Where:* the timeline's Unreal tab. *Since:* 2.472.0
- **The Unreal camera** — your own camera with keys of time, place, turn and field of view taken from Unreal's viewport or cameras, rendered through the level. *Where:* the timeline's Unreal tab. *Since:* 2.472.0
- **Render again** — each clip remembers how it was made and renders anew after the Unreal project or the keys change. *Where:* the Unreal tab. *Since:* 2.472.0
- **The Unreal camera tool** — move the camera of an Unreal or MetaHuman layer in the scene: drag to orbit, Ctrl to look, Shift to pan, Alt to roll, the wheel to dolly, Ctrl+wheel to zoom; small previews while dragging. *Where:* the image editor's UNREAL tab, Camera. *Since:* 2.475.0
- **The Camera tab** — lens presets (18-200 mm, macro, anamorphic, your own), focal length linked to the field of view, filmback, f-stop and focus distance (depth of field, click to focus), exposure (EV), place and roll / pitch / yaw, to and from Unreal's viewport. *Where:* Properties, Window > Unreal Camera. *Since:* 2.475.0
- **The timeline camera's lens** — focal length, f-stop, focus and exposure for an Unreal camera's render. *Where:* the timeline's UNREAL tab, Keys. *Since:* 2.475.0
- **Unreal lights** — point, spot, rect (softbox), sun and sky lights with colour or temperature, intensity, reach, cone, size, volumetric scattering and shadows; presets (three-point, golden hour, night street, neon, softbox). *Where:* the image editor's Lights tab, UNREAL > Lights & Fog. *Since:* 2.476.0
- **Fog and volumetric fog** — exponential height fog (density, falloff, colour, start) with volumetric fog (albedo, extinction, distance) and fog presets. *Where:* the Lights tab, the timeline's Lights & Fog. *Since:* 2.476.0
- **The light tool** — each light as a marker on the picture: drag it across, Shift-drag nearer or further, Alt-drag its aim. *Where:* the image editor's UNREAL tab, Lights. *Since:* 2.476.0
- **Lights on the timeline** — the same lights and fog for an Unreal, MetaHuman or Unreal camera clip, or the image editor's ones brought over. *Where:* the timeline's UNREAL tab, Lights & Fog. *Since:* 2.476.0

## Delivery and formats

Getting the work out: movies in every format, files for other editors, and bitGen's own project files.

### Compile and export

- **Compile** — the timeline into one movie in the project folder. *Where:* the timeline
- **Export formats** — MP4 H.264, H.265, H.265 10-bit, H.264 10-bit and AV1; MOV ProRes 422 HQ, ProRes 4444 with alpha and DNxHR HQ; WebM VP9; GIF; WAV and MP3. *Where:* the Export dialog. *Since:* 2.407.0
- **One compile, every format** — size, reframe (crop, pad or blur), frame rate and quality per format; packs add several at once. *Where:* the Export dialog. *Since:* 2.407.0
- **Smart reframe** — a vertical or square version whose crop follows the subject. *Where:* the Export dialog's fit. *Since:* 2.413.0
- **HDR output** — HDR10, HLG or Rec.2020 on the 10-bit presets. *Where:* the Export dialog. *Since:* 2.417.0
- **Graphics card encoders** — NVENC, Quick Sync, AMF or VAAPI when one works here. *Where:* the Export dialog. *Since:* 2.411.0
- **In / Out export and frames** — export just the ruler selection, or the frame at the marker as a PNG. *Where:* the Export dialog, Ctrl+Shift+E. *Since:* 2.410.0
- **Loudness targets** — -14, -16, -23 or -24 LUFS. *Where:* the Mix dialog. *Since:* 2.406.0
- **Captions out** — burned in, or an .srt beside each movie. *Where:* the Captions dialog. *Since:* 2.406.0

### Exchange with other editors

- **Final Cut Pro 7 XML** — clips, trims, layers, speed, moves, keyframes, opacity, volume, captions, markers and the grade as .cube LUTs; out and in. *Where:* the Exchange dialog. *Since:* 2.407.0
- **FCPXML 1.10** — for Final Cut Pro X, both ways. *Where:* the Exchange dialog. *Since:* 2.414.0
- **EDL and OpenTimelineIO** — CMX3600 EDL (V1) and OTIO, with markers. *Where:* the Exchange dialog. *Since:* 2.407.0
- **AAF** — the cut for Avid Media Composer and Pro Tools. *Where:* the Exchange dialog. *Since:* 2.417.0
- **Bring in a timeline** — an XML or EDL opens as a new named timeline, clips matched by name. *Where:* the Exchange dialog. *Since:* 2.407.0

### bitGen's own files

- **.bgi** — the image editor's project, a zip of XML and PNGs. *Where:* the image editor's File menu. *Since:* 2.436.0
- **.bgv** — a timeline with every layer, clip, keyframe, effect, caption, marker and its nested timelines, as XML. *Where:* the timeline toolbar. *Since:* 2.436.0
- **.bgp** — the whole project, self-contained or as a manifest. *Where:* the menu bar. *Since:* 2.436.0
- **CAD and 3D files** — DXF and SVG sketches; STL, glTF and STEP bodies. *Where:* the CAD toolbar. *Since:* 2.464.0
- **VR files** — VR videos carry spherical metadata and the players' name suffixes. *Where:* VR World and the swap

### Guides

- **The PDF guide** — the step-by-step instructions plus a one-page view of every shortcut key, in the studio's dark theme. *Where:* docs/bitGen-Studio-Guide.pdf. *Since:* 2.391.1
- **The brochure** — a 3-page brochure. *Where:* docs/bitGen-Studio-Brochure.pdf. *Since:* 2.392.0
- **The Feature Reference** — this catalogue of every feature by area (what it does, where it is, since which version), made again for every release. *Where:* docs/bitGen-Studio-Features.pdf. *Since:* 2.473.0
- **In-app help** — help pages for the timeline and the image editor. *Where:* the Help buttons. *Since:* 2.380.0

## Keyboard shortcuts

The full list of keys is in the PDF guide (docs/bitGen-Studio-Guide.pdf) and in the image editor's Help > Keyboard Shortcuts.

### The most used keys

- **P, S, L, 2, 1** — the prompt docker, Basic Settings, LLM tokens, the negative prompt docker and Tools and Properties. *Where:* anywhere (not while typing)
- **Space, J, K, L** — pause and play; shuttle backwards, stop and forwards. *Where:* the timeline
- **V, B, N, Y, U** — the timeline's Select, Ripple, Roll, Slip and Slide tools. *Where:* over the timeline's layers
- **Ctrl+K, M, I, O** — split, marker, In and Out. *Where:* the timeline
- **F5, F6, F8, F10, F12, Ctrl+Q** — curve tools, shape tools, dimensions, the node Shape tool, the Outline Pen, Convert to Curves. *Where:* the image editor
- **N, then S, L, R, C, A, P, D, X, T, E, F, M** — the sketch tools and their letters. *Where:* the image editor
- **Alt+Shift+S, Alt+Shift+R** — screenshot and screen recording. *Where:* anywhere
