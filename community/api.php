<?php
// bitGen Community (2.710.0) - THE endpoint: POST api.php?a=<action> with a JSON body; JSON back, always.
// The contract is API.md. bitGen Studio's own Node server (lib/community.js) is the only client.
// MIT licence (the bitGen Studio repo).
declare(strict_types=1);

define('BGC', '2.710.0');
ini_set('display_errors', '0');
ini_set('html_errors', '0');
ini_set('log_errors', '1');

require __DIR__ . '/lib/http.php';
require __DIR__ . '/lib/settings.php';
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/validate.php';
require __DIR__ . '/lib/ratelimit.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/users.php';
require __DIR__ . '/lib/messages.php';
require __DIR__ . '/lib/act_account.php';
require __DIR__ . '/lib/act_friends.php';
require __DIR__ . '/lib/act_chat.php';
require __DIR__ . '/lib/act_admin.php';

// action => [handler, needs a token, admins only]
const BGC_ACTIONS = [
    'info' => ['act_info', false, false],
    'register' => ['act_register', false, false],
    'login' => ['act_login', false, false],
    'logout' => ['act_logout', true, false],
    'me' => ['act_me', true, false],
    'delete_account' => ['act_delete_account', true, false],
    'search' => ['act_search', true, false],
    'friend_request' => ['act_friend_request', true, false],
    'friend_respond' => ['act_friend_respond', true, false],
    'friend_remove' => ['act_friend_remove', true, false],
    'friends' => ['act_friends', true, false],
    'send' => ['act_send', true, false],
    'poll' => ['act_poll', true, false],
    'history' => ['act_history', true, false],
    'block' => ['act_block', true, false],
    'unblock' => ['act_unblock', true, false],
    'report' => ['act_report', true, false],
    'admin_reports' => ['act_admin_reports', true, true],
    'admin_delete' => ['act_admin_delete', true, true],
    'admin_ban' => ['act_admin_ban', true, true],
];

function bgc_main(): void
{
    bgc_headers();
    try {
        $action = $_GET['a'] ?? '';
        if (!is_string($action) || !array_key_exists($action, BGC_ACTIONS)) {
            throw new ApiError(400, 'Unknown action - see API.md (api.php?a=info, register, login, ...).');
        }
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        // GET only for info, so opening the address in a browser shows the server is alive
        if ($method !== 'POST' && !($method === 'GET' && $action === 'info')) {
            header('Allow: POST');
            throw new ApiError(405, 'Use POST.');
        }
        bgc_require_https();
        $body = $method === 'POST' ? bgc_read_body() : [];
        [$fn, $needsToken, $adminOnly] = BGC_ACTIONS[$action];
        $me = $needsToken ? auth_user($body) : null;
        if ($adminOnly && !is_admin($me)) throw new ApiError(403, 'Only an admin can do that.');
        $out = $fn($body, $me);
        bgc_reply(200, ['ok' => true] + $out);
    } catch (ApiError $e) {
        bgc_reply($e->status, ['ok' => false, 'error' => $e->getMessage()]);
    } catch (Throwable $e) {
        // the details go to the server's error log, never to the client
        error_log('bitGen Community: ' . get_class($e) . ': ' . $e->getMessage() . ' at ' . basename($e->getFile()) . ':' . $e->getLine());
        bgc_reply(500, ['ok' => false, 'error' => 'Something went wrong on the community server - please try again later.']);
    }
}

bgc_main();
