<?php
// bitGen Community (2.710.0) - messages: the shape a client gets, and which ones a user may see.
// Seen = not deleted, the author not banned, the author not blocked by the viewer, and the Help room or the viewer's DMs.
declare(strict_types=1);
if (!defined('BGC')) { http_response_code(404); exit; }

const BGC_LEFT = '(left)';   // a deleted account's name on what it wrote

const BGC_MSG_SELECT = 'SELECT m.id, m.room, m.body, m.at, m.from_id, m.to_id, fu.handle AS from_handle, '
    . 'fu.display AS from_display, tu.handle AS to_handle FROM bgc_messages m '
    . 'LEFT JOIN bgc_users fu ON fu.id = m.from_id LEFT JOIN bgc_users tu ON tu.id = m.to_id';

/** the visibility filter for viewer ? (one argument: the viewer's id) */
const BGC_MSG_VISIBLE = 'm.deleted = 0 AND (fu.id IS NULL OR fu.banned = 0) '
    . 'AND (m.from_id IS NULL OR m.from_id NOT IN (SELECT blocked_id FROM bgc_blocks WHERE blocker_id = ?))';

function msg_out(array $r): array
{
    $dm = $r['room'] === 'dm';
    return [
        'id' => (int) $r['id'],
        'room' => $dm ? 'dm' : 'help',
        'from' => $r['from_handle'] !== null ? (string) $r['from_handle'] : BGC_LEFT,
        'from_display' => $r['from_display'] !== null ? (string) $r['from_display'] : BGC_LEFT,
        'to' => $dm ? ($r['to_handle'] !== null ? (string) $r['to_handle'] : BGC_LEFT) : null,
        'body' => (string) $r['body'],
        'at' => iso((int) $r['at']),
    ];
}

function msg_get(int $id): ?array
{
    $r = q_row(BGC_MSG_SELECT . ' WHERE m.id = ?', [$id]);
    return $r === null ? null : msg_out($r);
}

/** the message with this id if the viewer can see it, else null */
function msg_visible(int $id, int $viewer): ?array
{
    $r = q_row(BGC_MSG_SELECT . ' WHERE m.id = ? AND ' . BGC_MSG_VISIBLE
        . " AND (m.room = 'help' OR m.from_id = ? OR m.to_id = ?)", [$id, $viewer, $viewer, $viewer]);
    return $r === null ? null : msg_out($r);
}
