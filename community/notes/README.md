# bitGen Studio's own discussions (2.721.0)

Each `*.json` here becomes a discussion on the website (tigerart.com.au/discussions.php), posted by **bitGen Studio**
the first time the discussions list is read after /b_admin/'s Update puts it on the site (lib/act_forum.php
forum_notes_sync). Plain text, like any post.

    {"key": "a-short-id", "rev": 1, "category": "general", "pinned": true, "title": "…", "lines": ["…", "…"]}

- key: 3-30 of a-z 0-9 -; it is never posted twice (an admin can remove it - it does not come back).
- rev: raise it to change the title / text of a discussion already posted (its replies and pin stay).
- category: help, showcase, ideas or general. title: up to 120 characters; the text up to 8000.
- pinned: shown at the top of the list (admins can pin / unpin any discussion on its page).
A server whose database comes from BGC_DSN (tests) posts none unless BGC_NOTES_DIR names a folder.
