<?php
// bitGen Community (2.710.0) - finding people and friends: search, friend_request / respond / remove, friends,
// block / unblock.
declare(strict_types=1);
if (!defined('BGC')) { http_response_code(404); exit; }

/** prefix match on handle or display, 20 at most; banned and blocked-either-way users left out */
function act_search(array $b, array $me): array
{
    $q = v_lower(v_text($b, 'q', 1, 40, false, 'A search'));
    $like = strtr($q, ['!' => '!!', '%' => '!%', '_' => '!_']) . '%';
    $id = (int) $me['id'];
    $rows = q_all('SELECT id, handle, display, last_seen FROM bgc_users u WHERE u.banned = 0 AND u.id <> ? '
        . "AND (u.handle LIKE ? ESCAPE '!' OR LOWER(u.display) LIKE ? ESCAPE '!') "
        . 'AND u.id NOT IN (SELECT blocked_id FROM bgc_blocks WHERE blocker_id = ?) '
        . 'AND u.id NOT IN (SELECT blocker_id FROM bgc_blocks WHERE blocked_id = ?) '
        . 'ORDER BY u.handle LIMIT 20', [$id, $like, $like, $id, $id]);
    $users = [];
    foreach ($rows as $r) $users[] = user_out($r) + ['relation' => relation($id, (int) $r['id'])];
    return ['users' => $users];
}

function act_friend_request(array $b, array $me): array
{
    $u = other_user($b, $me);
    $a = (int) $me['id'];
    $o = (int) $u['id'];
    if (blocked_either($a, $o)) throw new ApiError(403, 'You cannot ask ' . $u['handle'] . ' to be friends.');
    return db_tx(static function () use ($a, $o): array {
        if (are_friends($a, $o)) return ['status' => 'friends'];
        if (has_request($o, $a)) {          // they asked me first: friends at once
            befriend($a, $o);
            return ['status' => 'friends'];
        }
        q_insert_once('INSERT INTO bgc_requests (from_id, to_id, at) VALUES (?, ?, ?)', [$a, $o, now_ms()]);
        return ['status' => 'requested'];
    });
}

function act_friend_respond(array $b, array $me): array
{
    $u = other_user($b, $me);
    $accept = v_bool($b, 'accept');
    $a = (int) $me['id'];
    $o = (int) $u['id'];
    if (!has_request($o, $a)) throw new ApiError(404, $u['handle'] . ' has not asked you to be friends.');
    if ($accept) {
        db_tx(static function () use ($a, $o): void { befriend($a, $o); });
        return ['status' => 'friends'];
    }
    q('DELETE FROM bgc_requests WHERE from_id = ? AND to_id = ?', [$o, $a]);
    return ['status' => 'declined'];
}

/** unfriend, or take back my request */
function act_friend_remove(array $b, array $me): array
{
    $u = other_user($b, $me);
    $a = (int) $me['id'];
    $o = (int) $u['id'];
    q('DELETE FROM bgc_friends WHERE a_id = ? AND b_id = ?', pair($a, $o));
    q('DELETE FROM bgc_requests WHERE from_id = ? AND to_id = ?', [$a, $o]);
    return [];
}

function act_friends(array $b, array $me): array
{
    $id = (int) $me['id'];
    $friends = [];
    foreach (q_all('SELECT u.handle, u.display, u.last_seen, f.since FROM bgc_friends f JOIN bgc_users u '
        . 'ON u.id = CASE WHEN f.a_id = ? THEN f.b_id ELSE f.a_id END '
        . 'WHERE (f.a_id = ? OR f.b_id = ?) AND u.banned = 0 ORDER BY u.handle', [$id, $id, $id]) as $r) {
        $friends[] = user_out($r) + ['since' => iso((int) $r['since'])];
    }
    $incoming = [];
    foreach (q_all('SELECT u.handle, u.display, u.last_seen, r.at FROM bgc_requests r JOIN bgc_users u ON u.id = r.from_id '
        . 'WHERE r.to_id = ? AND u.banned = 0 ORDER BY r.at', [$id]) as $r) {
        $incoming[] = user_out($r) + ['at' => iso((int) $r['at'])];
    }
    $outgoing = [];
    foreach (q_all('SELECT u.handle, u.display, u.last_seen, r.at FROM bgc_requests r JOIN bgc_users u ON u.id = r.to_id '
        . 'WHERE r.from_id = ? AND u.banned = 0 ORDER BY r.at', [$id]) as $r) {
        $outgoing[] = user_out($r) + ['at' => iso((int) $r['at'])];
    }
    return ['friends' => $friends, 'incoming' => $incoming, 'outgoing' => $outgoing];
}

/** block: also ends a friendship / request either way; their Help messages are hidden from me; no asks, no DMs */
function act_block(array $b, array $me): array
{
    $u = other_user($b, $me);
    $a = (int) $me['id'];
    $o = (int) $u['id'];
    db_tx(static function () use ($a, $o): void {
        unfriend_all($a, $o);
        q_insert_once('INSERT INTO bgc_blocks (blocker_id, blocked_id, at) VALUES (?, ?, ?)', [$a, $o, now_ms()]);
    });
    return [];
}

function act_unblock(array $b, array $me): array
{
    $u = other_user($b, $me);
    q('DELETE FROM bgc_blocks WHERE blocker_id = ? AND blocked_id = ?', [(int) $me['id'], (int) $u['id']]);
    return [];
}
