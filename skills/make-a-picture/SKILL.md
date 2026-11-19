---
name: make-a-picture
description: making a still picture (an image) from a description - picking the image style and writing the prompt
---

1. Use app_state to see the image styles there are and the one picked.
2. Pick the style that fits what the user wants (photo, anime, painting, product shot ...) with app_set_style kind "image" and
   a name from the list - keep the one picked when the user named none and it fits.
3. Write a full prompt with app_set_prompt: the subject and its details, the setting, the light, the composition (close-up,
   wide, from above), the mood and the medium (photo / illustration / 3D). Plain sentences, no lists of tags unless the style is
   an anime / Pony style that wants them.
4. Size or shape asked for: app_set_setting "aspect" (16:9, 9:16, 1:1 ...).
5. Make it with app_generate_image only when the user asked to make it now; else say it is ready to make.
