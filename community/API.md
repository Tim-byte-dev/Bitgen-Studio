# bitGen Community — the server's API (2.710.0)

Tim: "i would like to make bitgen a community, can we add a little chat to bitgen like fb - if a user adds a user id to
bitgen they join the community and can add other users as friends, first they ask, then if approved they become
friends. this should enable people to get help". Hosted as PHP 8.3 + MariaDB on Tim's tigerart.com.au hosting (any PHP
8.1+ host works; SQLite for a small / test install). bitGen's own Node server (lib/community.js) is the only client: it
calls this API server-to-server and keeps the user's token, so there is no CORS and no token in the browser.

ONE ENDPOINT: `POST <base>/api.php?a=<action>` with a JSON body; `Authorization: Bearer <token>` for every action but
`info`, `register`, `login`. Every reply is JSON: `{ok: true, ...}` or `{ok: false, error: "words for a person"}` with an
HTTP 4xx/5xx status (400 bad input, 401 no / bad token, 403 not allowed / banned / blocked, 404 no such user, 409 taken,
429 too fast). Times are ISO-8601 UTC strings. A user as returned: `{handle, display, online}` (online = seen in the last
2 minutes). Handles: 3-24 characters a-z 0-9 _ . - (stored lower-case; unique); display: 1-40 printable characters
(default = the handle); password: 8-200 characters.

| action | body | reply |
|---|---|---|
| info | - | `{name, version, rules, users, help_room: "help"}` |
| register | `{handle, password, display?}` | `{token, user}` (409 when the handle is taken) |
| login | `{handle, password}` | `{token, user}` (401 wrong; 403 banned) |
| logout | - | `{}` (this token only) |
| me | - | `{user, admin: bool}` |
| delete_account | `{password}` | `{}` - the user, their tokens, friendships, requests, blocks go; their messages show as from "(left)" |
| search | `{q}` | `{users: [{handle, display, online, relation}]}` - prefix match on handle or display, 20 at most, banned / blocked-either-way left out; relation = none / friend / requested (I asked) / incoming (they asked) |
| friend_request | `{handle}` | `{status: "requested" | "friends"}` - asking someone who already asked you = friends at once; 403 if either blocked the other |
| friend_respond | `{handle, accept}` | `{status: "friends" | "declined"}` (404 if there is no request from them) |
| friend_remove | `{handle}` | `{}` - unfriend, or cancel my request |
| friends | - | `{friends: [user + since], incoming: [user + at], outgoing: [user + at]}` |
| send | `{to: "help" | <friend handle>, body}` | `{message}` - body 1-2000 characters (trimmed); DMs only to an accepted friend; 30 messages a minute at most (429) |
| poll | `{since, at?}` | `{messages, deleted, incoming, now}` - every message with id > since the user can see (the Help room + their DMs, blocked / banned users' left out, deleted ones left out), oldest first, 200 at most; `deleted` = ids of messages deleted after `at` (the `now` of the client's previous poll); `incoming` = how many friend requests wait; marks the user seen (online) |
| history | `{room: "help" | <friend handle>, before?, limit?}` | `{messages}` - newest `limit` (default 50, max 200) with id < before, oldest first |
| block / unblock | `{handle}` | `{}` - block also ends a friendship / request; a blocked user's Help messages are hidden from the blocker and neither can ask or DM the other |
| report | `{id, reason}` | `{}` - a message reported to the admins (reason 1-500) |
| admin_reports | - | `{reports: [{id, message, reporter, reason, at}]}` (admins only) |
| admin_delete | `{id}` | `{}` - the message becomes deleted (body ""), every client drops it on its next poll |
| admin_ban | `{handle, banned}` | `{}` - a banned user cannot log in, their tokens stop working, their messages are hidden |

A message: `{id, room: "help" | "dm", from: handle, from_display, to: handle | null, body, at}`. Deleted messages never
come back in poll / history; poll's `deleted` tells a client which ones to drop.

Config: `config.php` (copied from config.sample.php, never in git): `$BGC = ['dsn' => 'mysql:host=localhost;dbname=bitgen_community;charset=utf8mb4', 'user' => ..., 'pass' => ..., 'admins' => ['tim'], 'rules' => '...']`.
The environment variable BGC_DSN (sqlite:/path/file.db) overrides the dsn (tests). Tables are created on first use.
