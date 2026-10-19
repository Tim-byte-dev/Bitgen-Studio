bitGen Bridge for Daz Studio 1.1.0 (bitGen Studio 2.461.0)

Install
  1. Copy the "Scripts" folder from this zip into one of your Daz content libraries, for example
     Documents\DAZ 3D\Studio\My Library  (it becomes My Library\Scripts\bitGen\bitGen Bridge.dsa).
  2. In Daz Studio: Content Library -> (your library) -> Scripts -> bitGen -> double-click "bitGen Bridge".
     Optional: Window -> Workspace -> Customize -> drag it onto a toolbar or menu.
  3. bitGen Studio must be running on the same computer. "Test connection" checks it.

What it sends
  - Render the animation -> real: Daz renders the timeline's play range with your render settings (Iray, Filament
    or 3Delight) and bitGen turns it into daz_<scene>.mp4 (Video assets); ticked, LTX 2.3 + 3DREAL renders it real.
  - Render this frame -> a picture: into bitGen's Gallery and Images assets.
  - The scene as 3D -> open in bitGen's .blend preview (figures with their rig and animation, props, lights, cameras).
  - The scene as 3D -> merge: bitGen opens its Merge dialog - tick the objects, lights and cameras to bring into the
    .blend open in its preview (and which camera becomes the scene camera).
  - The selected figure / prop -> a 3D model in the project's models3d (+ optionally a 3D layer on the timeline).
  The 3D sends need Blender (bitGen finds it; bitGen's Blender settings have its path).

Works with Daz Studio 4.2x and Daz Studio 2025 / 6. Needs curl (built into Windows 10+ and macOS).

bitGen Live Link (1.1.0, EXPERIMENTAL)
  Content Library -> Scripts -> bitGen -> double-click "bitGen Live Link". A small window stays open while Daz is linked
  (Stop ends it). About once a second it asks bitGen what to do:
  - bitGen's image editor (the 3D layer's tab: Camera -> Daz / Pose -> Daz, or "as I change") and the timeline's
    .blend preview (View + pose -> Daz) move a camera "bitGen Camera" in Daz - the viewport looks through it - and
    turn the selected figure's bones of the same name (on top of where they were; the turns use Daz's own axes, which
    may not match Blender's). "<-" (reset) takes the turns back.
  - Render with Daz as usual, and send it back with bitGen Bridge -> Render this frame -> a picture.
  It was written from Daz Studio's scripting documentation and could not be tried in a real Daz Studio when it was
  made - the window's log says what did not work.

