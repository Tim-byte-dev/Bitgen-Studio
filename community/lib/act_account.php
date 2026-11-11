<?php
// bitGen Community (2.710.0) - the account actions: info, register, login, logout, me, delete_account.
// 2.713.0: register needs first_name, last_name, email (a code is emailed); verify_email, resend_code, set_profile.
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
        'packs' => true,                 // 2.716.0: language packs (act_packs.php)
    ];
}

function act_register(array $b, ?array $me): array
{
    if (!isset($b['email']) && !isset($b['first_name']) && !isset($b['last_name'])) {
        throw new ApiError(400, 'Joining now needs your first name, last name and email address - update bitGen Studio, or join on the website.');
    }
    $handle = v_handle($b);
    $password = v_password($b);
    $display = v_display($b, $handle);
    $first = v_name($b, 'first_name', 'A first name');
    $last = v_name($b, 'last_name', 'A last name');
    $email = v_email($b);
    human_check($b);                        // 2.756.3: the website's slider, or the joining program's sum
    $key = email_key($email);
    $ip = bgc_client_ip();
    $lim = bgc_settings()['limits']['register_per_hour'];
    rl_check('reg:' . $ip, $lim, 3600 * 1000, 'Too many new accounts from here - try again in an hour.');
    rl_hit('reg:' . $ip);
    email_drop_stale();
    if (in_array($handle, BGC_RESERVED, true) || user_by_handle($handle) !== null) {
        throw new ApiError(409, 'The user id "' . $handle . '" is taken - pick another.');
    }
    email_free_or_fail($key);
    $now = now_ms();
    try {
        q('INSERT INTO bgc_users (handle, display, pass_hash, created_at, last_seen, banned, first_name, last_name, email, email_key, email_verified) '
            . 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [$handle, $display, pw_hash($password), $now, $now, 0, $first, $last, $email, $key, 0]);
    } catch (PDOException $e) {
        if (db_is_duplicate($e)) throw new ApiError(409, 'That user id or email address was just taken - try again.');
        throw $e;
    }
    $u = user_by_handle($handle);
    $sent = code_send($u, false);           // register has its own limit (per address, per hour)
    return ['token' => token_issue((int) $u['id']), 'user' => user_out($u), 'profile' => profile_out(user_by_handle($handle)), 'mail_sent' => $sent];
}

/** the emailed code -> the address confirmed (then everything else opens up) */
function act_verify_email(array $b, array $me): array
{
    code_check($me, v_string($b, 'code'));
    return ['profile' => profile_out(user_by_handle((string) $me['handle']))];
}

/** another code to the same address */
function act_resend_code(array $b, array $me): array
{
    if ((int) $me['email_verified'] === 1) return ['profile' => profile_out($me), 'mail_sent' => false];
    if (empty($me['email'])) throw new ApiError(400, 'Add your name and email address first.');
    return ['profile' => profile_out($me), 'mail_sent' => code_send($me)];
}

/** names, and the email address: a new address must be confirmed again (a code goes to it) */
function act_set_profile(array $b, array $me): array
{
    $first = v_name($b, 'first_name', 'A first name');
    $last = v_name($b, 'last_name', 'A last name');
    $email = v_email($b);
    $key = email_key($email);
    $id = (int) $me['id'];
    $changed = $key !== (string) ($me['email_key'] ?? '') || $email !== (string) ($me['email'] ?? '');
    if ($changed) email_free_or_fail($key, $id);
    try {
        if ($changed) {
            q('UPDATE bgc_users SET first_name = ?, last_name = ?, email = ?, email_key = ?, email_verified = ? WHERE id = ?',
                [$first, $last, $email, $key, $key === (string) ($me['email_key'] ?? '') ? (int) $me['email_verified'] : 0, $id]);
        } else {
            q('UPDATE bgc_users SET first_name = ?, last_name = ? WHERE id = ?', [$first, $last, $id]);
        }
    } catch (PDOException $e) {
        if (db_is_duplicate($e)) throw new ApiError(409, 'That email address already has an account.');
        throw $e;
    }
    $u = user_by_handle((string) $me['handle']);
    $sent = false;
    if ((int) $u['email_verified'] === 0) $sent = code_send($u);
    return ['profile' => profile_out($u), 'mail_sent' => $sent];
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
    if (user_suspended($u)) throw new ApiError(403, user_suspended_msg($u));          // 2.723.0
    q('UPDATE bgc_users SET last_seen = ? WHERE id = ?', [now_ms(), (int) $u['id']]);
    $u = user_by_handle($handle);
    return ['token' => token_issue((int) $u['id']), 'user' => user_out($u), 'profile' => profile_out($u)];
}

function act_logout(array $b, array $me): array
{
    q('DELETE FROM bgc_tokens WHERE token_hash = ?', [$me['token_hash']]);
    return [];
}

function act_me(array $b, array $me): array
{
    return ['user' => user_out($me), 'admin' => is_admin($me), 'profile' => profile_out($me)];
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
        q('UPDATE bgc_topics SET user_id = NULL WHERE user_id = ?', [$id]);
        q('UPDATE bgc_posts SET user_id = NULL WHERE user_id = ?', [$id]);
        q('UPDATE bgc_bugs SET user_id = NULL WHERE user_id = ?', [$id]);
        q('DELETE FROM bgc_users WHERE id = ?', [$id]);
    });
    return [];
}
