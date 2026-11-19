---
name: write-video-prompt
description: writing or improving a prompt for a video (a shot, a clip, a scene) in the prompt box
---

1. Look first: use app_state to see the video style picked and the prompt there now.
2. Write ONE complete prompt for one shot, in plain sentences, in this order:
   - who or what is in it (looks, clothes, age, expression) - a character's @tag when the user uses one;
   - what happens, step by step, in the time of the shot (one main action, nothing that needs a cut);
   - where (place, time of day, weather) and the light;
   - the camera (shot size, angle, movement: slow push in, tracking, handheld, static);
   - the sound (ambience, music, effects).
3. Speech: put each spoken line on its own line as `Name: words` - the colon promises that words follow; say how it is said
   (whispers, laughs) in the sentence before it, never inside the words.
4. Never name things the user did not ask for "just as examples" - a named object tends to appear in the picture.
5. Put it in with app_set_prompt (app_add_to_prompt when they asked to add to what is there). Say in one sentence what the
   shot is. Press app_generate only when the user asked to make / render it.
