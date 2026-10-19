bitGen Bridge for Unreal Engine 5.8 - 1.3.0 (bitGen Studio 2.540.0)

Links the Unreal Editor to bitGen Studio on the same computer. bitGen lists your project's levels, Level Sequences,
cameras, MetaHumans and animations, takes stills from a camera for its image editor (Unreal and MetaHuman layers) and
renders sequences with the Movie Render Queue for its timeline (Unreal, MetaHuman and Unreal camera layers).

Install - the easy way (bitGen Studio 2.513.0 and later)
  In bitGen Studio press 🎮 (Load UE project) in the menu bar, pick your project's folder and press Select. bitGen puts
  this plugin into <YourProject>\Plugins\bitGenBridge (or updates it), switches on the plugins it needs in the
  .uproject (the old file is kept as .uproject.bitgen-bak), closes Unreal if it has the project open (Unreal asks you to
  save first) and starts Unreal again with the project. Open your projects in Unreal as always - bitGen links to them.

Install - by hand
  1. Close the Unreal Editor. Copy the "bitGenBridge" folder from this zip into your project's Plugins folder:
       <YourProject>\Plugins\bitGenBridge\bitGenBridge.uplugin
     (make the Plugins folder if there is none). It is Python only - nothing to compile.
  2. Open the project. If Unreal asks, enable the plugins it needs: Python Editor Script Plugin, Editor Scripting
     Utilities, Sequencer Scripting, Movie Render Queue (Edit -> Plugins). Restart when asked.
  3. Window -> Output Log shows "[bitGen Bridge] listening on http://127.0.0.1:30020/bitgen".
  4. In bitGen Studio: Settings -> 3D -> Unreal Engine -> Test connection.

Transparent backgrounds (MetaHuman layers)
  Project Settings -> Engine -> Rendering -> Post Processing -> "Enable alpha channel support in post processing" ->
  "Allow through tonemapper", then restart the editor. Without it the stills and renders have a solid background.
  If the background comes out solid where it should be clear and the figure clear, tick "alpha is inverted" in
  bitGen's Settings -> 3D -> Unreal Engine.

What it does in your project
  - Stills: a Scene Capture is placed where the camera is for one picture, then removed. A MetaHuman layer places
    the MetaHuman (named bitGen_MetaHuman) for the picture and removes it again.
  - Renders: a Level Sequence of your own is rendered as it is. For bitGen's camera keys / MetaHuman layers a Level
    Sequence /Game/bitGen/bitGen_<id> is made (a CineCamera keyed like bitGen's camera, the MetaHuman with its
    animation). The Movie Render Queue writes PNG frames into bitGen's project folder; bitGen makes the video.
  - Nothing is sent anywhere else: the bridge only answers on 127.0.0.1 (this computer).
  - Another port: set the environment variable BITGEN_UE_PORT before starting the editor, and the same port in
    bitGen's settings.

1.1.0 (bitGen 2.475.0): the camera moves from bitGen
  - bitGen's image editor has an Unreal camera tool (orbit, look, pan, dolly, roll) and a Camera tab: lens (focal
    length, filmback), f-stop + focus distance (depth of field), exposure (EV), presets. Stills and renders carry them.
  - "To Unreal's viewport" points your level viewport through bitGen's camera; "Click to focus" asks Unreal how far
    away the clicked point is (a line trace).

1.2.0 (bitGen 2.476.0): lights and fog from bitGen
  - bitGen's Lights tab (image editor) and Lights & Fog (timeline) send point / spot / rect / sun / sky lights
    (colour or temperature, intensity, reach, cone, size, volumetric scattering, shadows) and an exponential height
    fog with volumetric fog. They are placed in the level as bitGen_light_* / bitGen_fog for the picture or the
    render and taken away after it - unless "keep them in the Unreal level" is ticked.
  - Volumetric fog in renders follows your project's settings (Project Settings -> Rendering -> Volumetric Fog on).

Units: Unreal centimetres, Z up; rotations (roll, pitch, yaw) in degrees.

This plugin was written from Unreal Engine 5.8's Python API documentation and tested in bitGen Studio against a
stand-in server, not a real Unreal Editor. If a command fails, the Output Log has a "[bitGen Bridge]" line and
bitGen shows Unreal's error - please send that back so it can be fixed.

1.3.0 (bitGen 2.540.0): the objects a camera sees
  - "actors_in_view": the level's mesh actors (their bounds) and the camera - bitGen puts each on the picture and gives
    it a picture from its reference docker (the image editor's 🖼 References / ✨ Make it real, the timeline's
    UNREAL ▸ Render to Real). Hidden, bitGen_*, landscape / sky / light / camera / fog actors are left out.
