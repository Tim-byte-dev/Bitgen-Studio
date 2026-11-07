<?php
// bitGen Community (2.710.0) - the account actions: info, register, login, logout, me, delete_account.
declare(strict_types=1);
if (!defined('BGC')) { http_response_code(404); exit; }

function act_info(array $b, ?array $me): array
{
    $s = bgc_settings();
    return [
        'name' => $s['name'],
        'version' => BGC,
        'rules' => $s['rules'],
        'users' => (int) q_val('SELECT COUNT(*) FROM bgc_users WHERE banned = ?', [0]),
        'help_room' => 'help',
    ];
}

function act_register(array $b, ?array $me): array
{
    $handle = v_handle($b);
    $password = v_password($b);
    $display = v_display($b, $handle);
    $ip = bgc_client_ip();
    $lim = bgc_settings()['limits']['register_per_hour'];
    rl_check('reg:' . $ip, $lim, 3600 * 1000, 'Too many new accounts from here - try again in an hour.');
    rl_hit('reg:' . $ip);
    if (in_array($handle, BGC_RESERVED, true) || user_by_handle($handle) !== null) {
        throw new ApiError(409, 'The user id "' . $handle . '" is taken - pick another.');
    }
    $now = now_ms();
    try {
        q('INSERT INTO bgc_users (handle, display, pass_hash, created_at, last_seen, banned) VALUES (?, ?, ?, ?, ?, ?)',
            [$handle, $display, pw_hash($password), $now, $now, 0]);
    } catch (PDOException $e) {
        if (db_is_duplicate($e)) throw new ApiError(409, 'The user id "' . $handle . '" is taken - pick another.');
        throw $e;
    }
    $u = user_by_handle($handle);
    return ['token' => token_issue((int) $u['id']), 'user' => user_out($u)];
}

// a real bcrypt hash of nothing anybody types - checked when the handle does not exist, so a miss takes as long as a hit
const BGC_DUMMY_HASH = '$2y$10$ViyNdsCdVcyExerbr9opIuFRqHd1a5KvcwafencT6ebv964D53kR6';

function act_login(array $b, ?array $me): array
{
    $handle = v_handle($b);
    $password = v_password($b);
    $ip = bgc_client_ip();
    $lim = bgc_settings()['limits']['login_failures_per_15min'];
    $win = 15 * 60 * 1000;
    $msg = 'Too many wrong passwords - wait 15 minutes and try again.';
    rl_check('lf:h:' . $handle, $lim, $win, $msg);
    rl_check('lf:ip:' . $ip, $lim, $win, $msg);
    $u = user_by_handle($handle);
    $ok = pw_check($password, $u !== null ? (string) $u['pass_hash'] : BGC_DUMMY_HASH);
    if ($u === null || !$ok) {
        rl_hit('lf:h:' . $handle);
        rl_hit('lf:ip:' . $ip);
        throw new ApiError(401, 'That user id and password do not match.');
    }
    if ((int) $u['banned'] !== 0) throw new ApiError(403, 'This account is banned.');
    q('UPDATE bgc_users SET last_seen = ? WHERE id = ?', [now_ms(), (int) $u['id']]);
    $u = user_by_handle($handle);
    return ['token' => token_issue((int) $u['id']), 'user' => user_out($u)];
}

function act_logout(array $b, array $me): array
{
    q('DELETE FROM bgc_tokens WHERE token_hash = ?', [$me['token_hash']]);
    return [];
}

function act_me(array $b, array $me): array
{
    return ['user' => user_out($me), 'admin' => is_admin($me)];
}

/** the user goes with their tokens, friendships, requests and blocks; what they wrote stays, from "(left)" */
function act_delete_account(array $b, array $me): array
{
    $password = v_string($b, 'password');
    if (!pw_check($password, (string) $me['pass_hash'])) {
        // 403, not 401: 401 means "your token is no good" and makes the client sign out
        throw new ApiError(403, 'That password is wrong - the account was not deleted.');
    }
    $id = (int) $me['id'];
    db_tx(static function () use ($id): void {
        q('DELETE FROM bgc_tokens WHERE user_id = ?', [$id]);
        q('DELETE FROM bgc_friends WHERE a_id = ? OR b_id = ?', [$id, $id]);
        q('DELETE FROM bgc_requests WHERE from_id = ? OR to_id = ?', [$id, $id]);
        q('DELETE FROM bgc_blocks WHERE blocker_id = ? OR blocked_id = ?', [$id, $id]);
        q('UPDATE bgc_messages SET from_id = NULL WHERE from_id = ?', [$id]);
        q('UPDATE bgc_messages SET to_id = NULL WHERE to_id = ?', [$id]);
        q('UPDATE bgc_reports SET reporter_id = NULL WHERE reporter_id = ?', [$id]);
        q('DELETE FROM bgc_users WHERE id = ?', [$id]);
    });
    return [];
}
