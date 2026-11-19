---
name: music-video
description: making a music video from a song in bitGen - the song cut into segments, one scene per segment, lip sync
---

bitGen makes a music video as one scene (clip) per segment of the song, each scene sung to its own part of the song, all
put on the timeline over the whole song. Guide the user through it - most steps are theirs to do on screen:

1. Show the StoryBoard (app_show "storyboard"). The song: the StoryBoard's Audio picker (a song of the project, or one
   added with ＋).
2. 🌊 beside the Audio picker shows the song's waveform with red cut lines - the user drags them to where the scenes should
   change (lines of a verse, the chorus); a duration can be typed to lock it.
3. 💾 "Save segments → scenes" makes one blank scene per segment with its start and length filled in.
4. Then the scenes' words: the user pastes the lyrics and asks "create the music video" in the chat - the writer fills every
   blank scene (its part of the song, the cast's @tags, the place, the camera).
5. The video style for singing scenes is a native-audio MiniMax H3 style (its name has NativeAudio) - pick it with app_set_style
   kind "video" when the user agrees.
6. Render one scene at a time (app_render_scene n) when the user asks, from scene 1 on; each one lands on the timeline at its
   place in the song. Keep the whole song on one sound layer with the clips' own sound muted, so the lip sync matches.
