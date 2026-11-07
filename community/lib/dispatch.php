<?php
// bitGen Community (2.713.0) - which actions there are, and the checks before each: the token, admins only, and (new)
// a confirmed email address - until it is confirmed an account may only confirm it, change it, sign out or leave
// (403 with need: "verify"). bgc_call() runs one action in-process (the website); api.php runs it over HTTP.
declare(strict_types=1);
if (!defined('BGC')) { http_response_code(404); exit; }

// action => [handler, token (true = needed, false = none, 'opt' = a guest or a member), admins only, allowed before the
// email address is confirmed]
const BGC_ACTIONS = [
    'info' => ['act_info', false, false, true],
    'register' => ['act_register', false, false, false],
    'login' => ['act_login', false, false, false],
    'logout' => ['act_logout', true, false, true],
    'me' => ['act_me', true, false, true],
    'delete_account' => ['act_delete_account', true, false, true],
    'search' => ['act_search', true, false, false],
    'friend_request' => ['act_friend_request', true, false, false],
    'friend_respond' => ['act_friend_respond', true, false, false],
    'friend_remove' => ['act_friend_remove', true, false, false],
    'friends' => ['act_friends', true, false, false],
    'send' => ['act_send', true, false, false],
    'poll' => ['act_poll', true, false, false],
    'history' => ['act_history', true, false, false],
    'block' => ['act_block', true, false, false],
    'unblock' => ['act_unblock', true, false, false],
    'report' => ['act_report', true, false, false],
    'admin_reports' => ['act_admin_reports', true, true, false],
    'admin_delete' => ['act_admin_delete', true, true, false],
    'admin_ban' => ['act_admin_ban', true, true, false],
    // 2.713.0
    'verify_email' => ['act_verify_email', true, false, true],
    'resend_code' => ['act_resend_code', true, false, true],
    'set_profile' => ['act_set_profile', true, false, true],
    'admin_user' => ['act_admin_user', true, true, false],
    'forum_list' => ['act_forum_list', 'opt', false, true],
    'forum_topic' => ['act_forum_topic', 'opt', false, true],
    'forum_new' => ['act_forum_new', 'opt', false, false],
    'forum_reply' => ['act_forum_reply', 'opt', false, false],
    'forum_delete' => ['act_forum_delete', true, false, false],
    'admin_forum_pending' => ['act_admin_forum_pending', true, true, false],
    'admin_forum_moderate' => ['act_admin_forum_moderate', true, true, false],
];

/** one action -> its reply (without ok); throws ApiError. $body may carry "token" (the website keeps it in its session). */
function bgc_dispatch(string $action, array $body): array
{
    if (!array_key_exists($action, BGC_ACTIONS)) throw new ApiError(400, 'Unknown action - see API.md (api.php?a=info, register, login, ...).');
    [$fn, $token, $adminOnly, $unverifiedOk] = BGC_ACTIONS[$action];
    $me = null;
    if ($token === true || ($token === 'opt' && bgc_token($body) !== null)) $me = auth_user($body);
    if ($adminOnly && ($me === null || !is_admin($me))) throw new ApiError(403, 'Only an admin can do that.');
    if ($me !== null && !$unverifiedOk && (int) ($me['email_verified'] ?? 0) !== 1) {
        throw new ApiError(403, empty($me['email'])
            ? 'Add your name and email address to your account first (the community now needs them).'
            : 'Confirm your email address first - type the code we sent you, or ask for a new one.', ['need' => empty($me['email']) ? 'profile' : 'verify']);
    }
    return $fn($body, $me);
}

/** the website's way in: the same as an HTTP call, minus HTTP */
function bgc_call(string $action, array $body = [], ?string $token = null): array
{
    if ($token !== null) $body['token'] = $token;
    return bgc_dispatch($action, $body);
}
