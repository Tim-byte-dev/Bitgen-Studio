<?php
// bitGen Community (2.710.0) - the admins' actions (admins = the handles in config 'admins'): reports, delete, ban.
// 2.713.0: a ban also bans the email address; admin_user shows a member's real name and email.
declare(strict_types=1);
if (!defined('BGC')) { http_response_code(404); exit; }

/** the reports waiting, newest first (a deleted message's reports go with it) */
function act_admin_reports(array $b, array $me): array
{
    $reports = [];
    foreach (q_all('SELECT r.id, r.message_id, r.reason, r.at, ru.handle AS reporter FROM bgc_reports r '
        . 'LEFT JOIN bgc_users ru ON ru.id = r.reporter_id ORDER BY r.id DESC LIMIT 200') as $r) {
        $reports[] = [
            'id' => (int) $r['id'],
            'message' => msg_get((int) $r['message_id']),
            'reporter' => $r['reporter'] !== null ? (string) $r['reporter'] : BGC_LEFT,
            'reason' => (string) $r['reason'],
            'at' => iso((int) $r['at']),
        ];
    }
    return ['reports' => $reports];
}

/** the message becomes deleted (body ""); every client drops it on its next poll */
function act_admin_delete(array $b, array $me): array
{
    $mid = v_int($b, 'id', 1, PHP_INT_MAX, null);
    $row = q_row('SELECT id, deleted FROM bgc_messages WHERE id = ?', [$mid]);
    if ($row === null) throw new ApiError(404, 'There is no such message.');
    db_tx(static function () use ($mid, $row): void {
        if ((int) $row['deleted'] === 0) {
            q('UPDATE bgc_messages SET deleted = 1, body = ?, deleted_at = ? WHERE id = ?', ['', now_ms(), $mid]);
        }
        q('DELETE FROM bgc_reports WHERE message_id = ?', [$mid]);
    });
    return [];
}

/** banned: no sign-in, every token gone, every message hidden. banned: false lifts it */
function act_admin_ban(array $b, array $me): array
{
    $h = v_handle($b);
    $banned = v_bool($b, 'banned');
    if ($h === $me['handle']) throw new ApiError(400, 'You cannot ban yourself.');
    $u = user_by_handle($h);
    if ($u === null) throw new ApiError(404, 'There is no user "' . $h . '".');
    user_set_banned($u, $banned);
    return [];
}

/** 2.713.0: banned = no sign-in, every token gone, everything they wrote hidden, AND their email address can never
 *  join again (Tim: "so if we ban a user they can't just change their username"). Unbanned lifts both. */
function user_set_banned(array $u, bool $banned): void
{
    db_tx(static function () use ($u, $banned): void {
        q('UPDATE bgc_users SET banned = ? WHERE id = ?', [$banned ? 1 : 0, (int) $u['id']]);
        if ($banned) q('DELETE FROM bgc_tokens WHERE user_id = ?', [(int) $u['id']]);
        $key = (string) ($u['email_key'] ?? '');
        if ($key !== '') {
            if ($banned) q_insert_once('INSERT INTO bgc_banned_emails (email_key, at) VALUES (?, ?)', [$key, now_ms()]);
            else q('DELETE FROM bgc_banned_emails WHERE email_key = ?', [$key]);
        }
    });
}

/** 2.713.0: who someone really is - name and email (admins only; nobody else ever sees them) */
function act_admin_user(array $b, array $me): array
{
    $u = user_by_handle(v_handle($b));
    if ($u === null) throw new ApiError(404, 'There is no such user.');
    return ['user' => user_out($u) + profile_out($u) + ['banned' => (int) $u['banned'] === 1, 'joined' => iso((int) $u['created_at'])]];
}
