<?php
// bitGen Community - the settings. COPY this file to config.php (same folder) and fill it in.
// config.php holds your database password: it is never in git and .htaccess never serves it.
//
// The environment can override some of it (handy for tests and tiny installs):
//   BGC_DSN                 replaces 'dsn' (e.g. sqlite:/home/you/bgc.db) - with it set, config.php is optional
//   BGC_ADMINS              replaces 'admins' (a comma list: "tim,lili")
//   BGC_REGISTER_PER_HOUR   replaces limits.register_per_hour
//   BGC_MAIL_LOG            writes the emails to this file instead of sending them (tests)
if (!defined('BGC')) { http_response_code(404); exit; }

$BGC = [
    // ---- the database ------------------------------------------------------------------------------------------
    // MariaDB / MySQL (the usual on shared hosting) - the database and user you made in cPanel (MySQL Databases):
    'dsn' => 'mysql:host=localhost;dbname=CPANELUSER_bitgen_community;charset=utf8mb4',
    'user' => 'CPANELUSER_bgc',
    'pass' => 'the database user\'s password',
    // ... or SQLite for a small install (one file; keep it OUTSIDE public_html, the folder must be writable by PHP):
    // 'dsn' => 'sqlite:/home/CPANELUSER/bitgen-community.db',  'user' => '',  'pass' => '',

    // ---- who runs it -------------------------------------------------------------------------------------------
    // Admins = these user ids (lower-case). REGISTER YOUR USER ID IN BITGEN FIRST, then put it here - an admin id
    // nobody has taken yet could be registered by somebody else and they would be the admin.
    'admins' => ['tim'],

    // what bitGen shows as the community's name and rules (api.php?a=info)
    'name' => 'bitGen Community',
    'rules' => 'Be kind. Help each other. No spam, no hate, nothing illegal. Admins may delete messages and ban accounts.',

    // ---- email (2.713.0): the code that confirms a new member's address ---------------------------------------
    // sent by the hosting's own mail server (PHP mail()); empty = noreply@<this site>
    'mail_from' => '',
    // the website named in the email (where members can also type the code: <site_url>/account.php)
    // 'site_url' => 'https://tigerart.com.au',

    // ---- safety ------------------------------------------------------------------------------------------------
    // refuse plain http:// (passwords and tokens would cross the internet readable). Leave on.
    'require_https' => true,
    // the caller's address is REMOTE_ADDR. Only if the site sits behind a proxy / CDN you trust, name the header that
    // carries the real address, e.g. 'HTTP_CF_CONNECTING_IP' for Cloudflare. Anyone can fake it otherwise.
    'ip_header' => null,
    // the rate limits (these are the defaults)
    'limits' => [
        'send_per_minute' => 30,            // messages per user
        'register_per_hour' => 5,           // new accounts per IP address
        'login_failures_per_15min' => 10,   // wrong passwords per user id, and per IP address
    ],
];
