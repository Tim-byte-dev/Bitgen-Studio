<?php
// bitGen Community (2.710.0) - talking: send, poll, history, report.
declare(strict_types=1);
if (!defined('BGC')) { http_response_code(404); exit; }

function act_send(array $b, array $me): array
{
    $to = v_room($b, 'to');
    $body = v_text($b, 'body', 1, 2000, true, 'A message');
    $id = (int) $me['id'];
    $toId = null;
    if ($to !== 'help') {
        $u = other_user(['to' => $to], $me, 'to');
        $toId = (int) $u['id'];
        if (blocked_either($id, $toId) || !are_friends($id, $toId)) {
            throw new ApiError(403, 'You can only send a message to a friend.');
        }
    }
    $lim = bgc_settings()['limits']['send_per_minute'];
    rl_check('send:' . $id, $lim, 60000, "That is too fast - $lim messages a minute at most.");
    rl_hit('send:' . $id);
    q('INSERT INTO bgc_messages (room, from_id, to_id, body, at, deleted) VALUES (?, ?, ?, ?, ?, ?)',
        [$toId === null ? 'help' : 'dm', $id, $toId, $body, now_ms(), 0]);
    $mid = (int) db()->lastInsertId();
    return ['message' => msg_get($mid)];
}

/** everything new the user can see (id > since), the ids deleted since the last poll, the waiting requests */
function act_poll(array $b, array $me): array
{
    $since = v_int($b, 'since', 0, PHP_INT_MAX, 0);
    $at = null;
    if (isset($b['at'])) {
        if (!is_string($b['at']) || ($at = iso_to_ms($b['at'])) === null) {
            throw new ApiError(400, '"at" must be an ISO-8601 time (the "now" of your last poll).');
        }
    }
    $id = (int) $me['id'];
    $now = now_ms();
    q('UPDATE bgc_users SET last_seen = ? WHERE id = ?', [$now, $id]);
    $messages = [];
    foreach (q_all(BGC_MSG_SELECT . ' WHERE m.id > ? AND ' . BGC_MSG_VISIBLE
        . " AND (m.room = 'help' OR m.from_id = ? OR m.to_id = ?) ORDER BY m.id ASC LIMIT 200",
        [$since, $id, $id, $id]) as $r) {
        $messages[] = msg_out($r);
    }
    $deleted = [];
    if ($at !== null) {
        // ">=": a delete in the very millisecond of the last poll's "now" is sent again rather than missed
        foreach (q_all('SELECT id FROM bgc_messages WHERE deleted = 1 AND deleted_at >= ? ORDER BY id LIMIT 1000', [$at]) as $r) {
            $deleted[] = (int) $r['id'];
        }
    }
    $incoming = (int) q_val('SELECT COUNT(*) FROM bgc_requests r JOIN bgc_users u ON u.id = r.from_id WHERE r.to_id = ? AND u.banned = 0', [$id]);
    return ['messages' => $messages, 'deleted' => $deleted, 'incoming' => $incoming, 'now' => iso($now)];
}

/** the newest `limit` messages of a room with id < before, oldest first */
function act_history(array $b, array $me): array
{
    $room = v_room($b, 'room');
    $before = v_int($b, 'before', 1, PHP_INT_MAX, PHP_INT_MAX);
    $limit = v_int($b, 'limit', 1, 200, 50);
    $id = (int) $me['id'];
    if ($room === 'help') {
        $rows = q_all(BGC_MSG_SELECT . " WHERE m.room = 'help' AND m.id < ? AND " . BGC_MSG_VISIBLE
            . ' ORDER BY m.id DESC LIMIT ?', [$before, $id, $limit]);
    } else {
        $u = user_by_handle($room);
        if ($u === null || $room === $me['handle']) throw new ApiError(404, 'There is no user "' . $room . '".');
        $o = (int) $u['id'];
        $rows = q_all(BGC_MSG_SELECT . " WHERE m.room = 'dm' AND ((m.from_id = ? AND m.to_id = ?) OR (m.from_id = ? AND m.to_id = ?)) "
            . 'AND m.id < ? AND ' . BGC_MSG_VISIBLE . ' ORDER BY m.id DESC LIMIT ?', [$id, $o, $o, $id, $before, $id, $limit]);
    }
    return ['messages' => array_map('msg_out', array_reverse($rows))];
}

function act_report(array $b, array $me): array
{
    $mid = v_int($b, 'id', 1, PHP_INT_MAX, null);
    $reason = v_text($b, 'reason', 1, 500, true, 'A reason');
    if (msg_visible($mid, (int) $me['id']) === null) throw new ApiError(404, 'There is no such message.');
    q('INSERT INTO bgc_reports (message_id, reporter_id, reason, at) VALUES (?, ?, ?, ?)', [$mid, (int) $me['id'], $reason, now_ms()]);
    return [];
}
