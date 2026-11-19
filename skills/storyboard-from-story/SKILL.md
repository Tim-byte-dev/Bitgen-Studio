---
name: storyboard-from-story
description: turning a story, a script or an idea into StoryBoard scenes (shots) to render one by one
---

1. Read the story the user gave (or ask for it in one question when there is none). Use app_state to see how many scenes
   the StoryBoard has already.
2. Split it into shots of 5 to 15 seconds: a new shot for each new place, new moment or camera change. Keep the count
   sensible (3 to 12 unless the user says how many).
3. For each shot call app_add_scene with ONE full description: who (with their @tags when the user uses them), what happens,
   where, the light, the camera, the sound, and any spoken line as `Name: words` on its own line. Each scene must stand on its
   own - never "same as before".
4. Keep the people, their clothes and the places the same from shot to shot unless the story changes them.
5. Show the board with app_show "storyboard". List the shots back in one short line each. Render (app_render_scene) only when
   the user asks - and then one scene at a time, in order.
