<?php
// bitGen Community (2.713.0) - every part, loaded in order. api.php uses it, and so does the tigerart.com.au website
// (its discussions and account pages call bgc_call() in-process - the same actions, the same checks, no HTTP hop).
declare(strict_types=1);
if (!defined('BGC')) define('BGC', '2.721.0');

require __DIR__ . '/http.php';
require __DIR__ . '/settings.php';
require __DIR__ . '/db.php';
require __DIR__ . '/validate.php';
require __DIR__ . '/ratelimit.php';
require __DIR__ . '/mail.php';
require __DIR__ . '/auth.php';
require __DIR__ . '/users.php';
require __DIR__ . '/email.php';
require __DIR__ . '/messages.php';
require __DIR__ . '/act_account.php';
require __DIR__ . '/act_friends.php';
require __DIR__ . '/act_chat.php';
require __DIR__ . '/act_admin.php';
require __DIR__ . '/act_forum.php';
require __DIR__ . '/act_bugs.php';
require __DIR__ . '/act_packs.php';            // 2.716.0: language packs
require __DIR__ . '/dispatch.php';
