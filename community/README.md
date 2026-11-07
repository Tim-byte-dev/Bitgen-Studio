# bitGen Community - the server (2.710.0)

The little chat / friends service behind bitGen Studio's 💬 Community panel: a Help room everybody shares, friend
requests, and direct messages between friends. It is plain PHP (8.1 or newer) with MariaDB / MySQL - or SQLite for a
tiny install - no libraries, no composer. The API is in [API.md](API.md). MIT licence, like the rest of bitGen.

```
community/
  api.php              the one endpoint the web can reach
  .htaccess            denies everything else (lib/, config.php, *.db, *.sql, *.md)
  config.sample.php    copy to config.php and fill in (config.php is never in git)
  lib/                 the parts (http, settings, db, validate, ratelimit, auth, users, messages, the actions)
```

## Install on shared hosting (cPanel - e.g. tigerart.com.au)

1. **Make the database.** cPanel ▸ *MySQL® Databases*:
   - Create a database, e.g. `bitgen_community` (cPanel names it `CPANELUSER_bitgen_community`).
   - Create a user, e.g. `bgc`, with a long random password (cPanel names it `CPANELUSER_bgc`).
   - *Add User To Database* ▸ tick **ALL PRIVILEGES** (it needs CREATE the first time, then SELECT / INSERT /
     UPDATE / DELETE). The tables are `utf8mb4` / InnoDB and all start with `bgc_`, so a shared database is fine too.
2. **Copy the folder.** Upload this whole `community/` folder to `public_html/bitgen-community/`
   (File Manager or FTP). Upload `.htaccess` too - it is a hidden file; turn on "show hidden files".
3. **Fill in the settings.** In `public_html/bitgen-community/` copy `config.sample.php` to `config.php` and set
   `dsn` (the database name), `user`, `pass`. Leave `admins` for step 6.
4. **HTTPS only.** The site must have a certificate (cPanel ▸ *SSL/TLS Status* ▸ AutoSSL). `api.php` refuses plain
   `http://` (`require_https`), because passwords and tokens would cross the internet readable.
5. **First request makes the tables.** Open `https://tigerart.com.au/bitgen-community/api.php?a=info` in a browser.
   You should see `{"ok":true,"name":"bitGen Community",...,"users":0,...}`. That request created the `bgc_` tables
   (`CREATE TABLE IF NOT EXISTS` - it is safe to run again).
   Check that the rest is shut: `https://tigerart.com.au/bitgen-community/config.php` and `.../lib/db.php` must give
   **403 Forbidden** (or an empty page) - never the file.
6. **Make yourself admin.** In bitGen: 💬 ▸ Join, register your user id (e.g. `tim`). *Then* put it in `config.php`:
   `'admins' => ['tim'],`. (Register first: an admin id nobody has registered yet could be taken by somebody else.)
   bitGen's `me` now says `admin: true`, and you can see reports, delete messages and ban accounts.
7. **Point bitGen at it.** The address to put into bitGen (the Community panel's server address) is

   ```
   https://<your site>/bitgen-community/api.php        e.g. https://tigerart.com.au/bitgen-community/api.php
   ```

### "Sign in first (no token)" although you are signed in

Many shared hosts run PHP as CGI / FastCGI and **drop the `Authorization` header**. `.htaccess` hands it to PHP with a
rewrite rule; and bitGen also sends the token in the JSON body (`"token": "..."`), which `api.php` accepts when the
header is missing - so it works either way. If your host still loses it, ask them to allow `CGIPassAuth On`.

### Behind Cloudflare or another proxy

The rate limits count per IP address (`REMOTE_ADDR`). Behind a proxy every request seems to come from the proxy, so set
`'ip_header' => 'HTTP_CF_CONNECTING_IP'` (Cloudflare) in `config.php`. Never set it without a proxy - the header can
be faked.

### nginx (no .htaccess)

nginx ignores `.htaccess`. Allow only `api.php`:

```
location ^~ /bitgen-community/ { deny all; }
location = /bitgen-community/api.php { include fastcgi_params; fastcgi_param SCRIPT_FILENAME $request_filename; fastcgi_pass php; }
```

(Every file in `lib/` and `config.sample.php` also refuses to run unless `api.php` loaded it, so a slip shows nothing.)

## Settings without config.php (2.712.1)

With no `config.php`, the server reads a private folder **outside** the site's folder - on Plesk
`/var/www/vhosts/<domain>/bitgen-private/`, on cPanel `/home/<user>/bitgen-private/` (the folder above the site's
document root; `BITGEN_PRIVATE_DIR` moves it):

- `db.json` - `{"host": "localhost", "name": "timpaul_bitgen", "user": "timpaul_bitgen", "admins": ["tim"]}` (no password;
  the host may end in `:port`, as Plesk shows it: `localhost:3306`)
- `db-pass.txt` - the password, encrypted: `bgx1:` + base64(24-byte nonce + libsodium secretbox), or `bgx2:` +
  base64(12-byte IV + 16-byte tag + AES-256-GCM)
- `secret.key` - the 32-byte key, base64

On tigerart.com.au the site's admin page (`/b_admin/`, in the tigerart repo) writes these, puts this folder on the site
(Update) and makes the tables (Create database). A wrong key or a damaged `db-pass.txt` is refused in words, never tried
as a password. `config.php` still wins when it is there.

## SQLite (a tiny install, and the tests)

`'dsn' => 'sqlite:/home/CPANELUSER/bitgen-community.db'` - keep the file **outside** `public_html` and in a folder PHP
can write (SQLite writes a journal file next to it). Fine for a few dozen people; use MariaDB for more.

## Settings from the environment

| variable | replaces | used for |
|---|---|---|
| `BGC_DSN` | `dsn` | tests / tiny installs: `sqlite:/tmp/bgc.db`. With it set, `config.php` is optional. |
| `BGC_ADMINS` | `admins` | a comma list of user ids, e.g. `tim,lili` |
| `BGC_REGISTER_PER_HOUR` | `limits.register_per_hour` | the tests register more than 5 users from 127.0.0.1 |

## Security, in short

- Passwords: `password_hash` / `password_verify` (over a sha384 of the password, so bcrypt's 72-byte limit never
  cuts a long one).
- Tokens: 32 random bytes as hex, given once; only their sha256 is stored. `logout` ends that token; a ban ends all.
- Prepared statements only (PDO). Errors go to the server's error log; the client only gets
  `{"ok":false,"error":"..."}`, never SQL or a stack trace.
- Rate limits live in the database: 30 messages a minute per user, 5 new accounts an hour per IP, 10 wrong passwords
  per 15 minutes per user id or per IP (then 429).
- A request body is 16 KB at most (413). Replies are JSON only (`application/json; charset=utf-8`,
  `X-Content-Type-Options: nosniff`, `<` and `&` escaped).
- Banned: no sign-in (403), their tokens are gone, their messages hidden. Blocked: their Help messages hidden from the
  blocker; no friend requests or DMs either way.

## Test

From the bitGen folder (needs `php` with pdo_sqlite and Node 18+):

```
node scripts/test-community710-server.js
```

It starts `php -S` on a free port with a temporary SQLite database and runs every action over real HTTP.
