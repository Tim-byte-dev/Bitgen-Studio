# bitGen Community — the server's API (2.710.0; names, email and the discussions 2.713.0)

Tim: "i would like to make bitgen a community, can we add a little chat to bitgen like fb - if a user adds a user id to
bitgen they join the community and can add other users as friends, first they ask, then if approved they become
friends. this should enable people to get help". Hosted as PHP 8.3 + MariaDB on Tim's tigerart.com.au hosting (any PHP
8.1+ host works; SQLite for a small / test install). bitGen's own Node server (lib/community.js) is the only client: it
calls this API server-to-server and keeps the user's token, so there is no CORS and no token in the browser. The
tigerart.com.au website (its account and discussions pages) runs the same actions in-process: `lib/boot.php` +
`bgc_call($action, $body, $token)` - the same checks, no HTTP hop.

2.713.0 (Tim: "let users enter first name, last name and email - and verify email so if we ban a user they can't just
change their username ... add a discussions page on tigerart for registered users to talk and allow guest access too"):
every member has a first name, last name and a CONFIRMED email address. Until the address is confirmed (a 6-digit code
emailed to it) an account may only `me`, `verify_email`, `resend_code`, `set_profile`, `logout`, `delete_account` and read
the discussions - anything else is `403` with `need: "verify"` (or `need: "profile"` for an account from before 2.713.0
that has no email yet). One account per address, compared reduced (lower-case, no `+tag`, Gmail without dots). A ban
also bans the address. Real names and addresses are never in a user object - only in `profile` (your own) and
`admin_user` (admins).

ONE ENDPOINT: `POST <base>/api.php?a=<action>` with a JSON body; `Authorization: Bearer <token>` for every action but
`info`, `register`, `login`. Every reply is JSON: `{ok: true, ...}` or `{ok: false, error: "words for a person"}` with an
HTTP 4xx/5xx status (400 bad input, 401 no / bad token, 403 not allowed / banned / blocked, 404 no such user, 409 taken,
429 too fast). Times are ISO-8601 UTC strings. A user as returned: `{handle, display, online}` (online = seen in the last
2 minutes). Handles: 3-24 characters a-z 0-9 _ . - (stored lower-case; unique); display: 1-40 printable characters
(default = the handle); password: 8-200 characters.

| action | body | reply |
|---|---|---|
| info | - | `{name, version, rules, users, help_room: "help"}` |
| register | `{handle, password, display?, first_name, last_name, email}` | `{token, user, profile, mail_sent}` - a code goes to the address (409 when the handle or the address is taken, 403 a banned address) |
| login | `{handle, password}` | `{token, user, profile}` (401 wrong; 403 banned) |
| verify_email | `{code}` | `{profile}` - 6 digits, 15 minutes, 5 tries (400 wrong / run out, 429 too many) |
| resend_code | - | `{profile, mail_sent}` - 4 an hour per account, 10 per caller address |
| set_profile | `{first_name, last_name, email}` | `{profile, mail_sent}` - a new address is unconfirmed until its code is typed |
| logout | - | `{}` (this token only) |
| me | - | `{user, admin: bool, profile: {first_name, last_name, email, verified, needs_profile}}` |
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
| admin_ban | `{handle, banned}` | `{}` - a banned user cannot log in, their tokens stop working, their messages and posts are hidden, and their email address can never join again (banned: false lifts both) |
| admin_user | `{handle}` | `{user: {handle, display, online, first_name, last_name, email, verified, banned, joined}}` (admins only) |
| forum_list | `{category?, page?}` | `{categories: [{id, label}], topics: [{id, category, title, author, created, last_at, replies}], page, pages, total, pending? (admins)}` - a guest or a member; 25 a page, newest activity first |
| forum_topic | `{id, page?}` | `{topic, categories, posts: [{id, author, body, at, first, mine, can_delete, pending? (admins)}], page, pages}` - 30 a page |
| forum_new | `{category, title, body, guest_name?}` | `{topic_id, post_id, pending}` - category help / showcase / ideas / general, title 3-120, body 1-8000; a member's is live, a guest's (with guest_name, no token) waits (pending) |
| forum_reply | `{topic_id, body, guest_name?}` | `{post_id, pending}` - members 40 posts / 6 topics an hour; guests 4 an hour per address |
| forum_delete | `{post_id}` | `{topic_deleted}` - its writer or an admin; the first post takes its whole discussion |
| admin_forum_pending | - | `{posts: [{id, topic_id, title, new_topic, guest_name, body, at}]}` (admins) |
| admin_forum_moderate | `{post_id, approve}` | `{approved}` - approved shows (with its discussion); refused is deleted (admins) |

An author (forum): `{handle, name}` for a member (name = the display name), `{guest: true, name}` for a guest,
`{left: true, name: "(left)"}` for a deleted account.

A message: `{id, room: "help" | "dm", from: handle, from_display, to: handle | null, body, at}`. Deleted messages never
come back in poll / history; poll's `deleted` tells a client which ones to drop.

Config: `config.php` (copied from config.sample.php, never in git): `$BGC = ['dsn' => 'mysql:host=localhost;dbname=bitgen_community;charset=utf8mb4', 'user' => ..., 'pass' => ..., 'admins' => ['tim'], 'rules' => '...']`.
The environment variable BGC_DSN (sqlite:/path/file.db) overrides the dsn (tests). Tables are created on first use.
