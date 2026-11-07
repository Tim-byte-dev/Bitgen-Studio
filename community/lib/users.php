<?php
// bitGen Community (2.710.0) - users and how two users stand: friends, requests, blocks.
declare(strict_types=1);
if (!defined('BGC')) { http_response_code(404); exit; }

const BGC_ONLINE_MS = 120000;     // online = seen in the last 2 minutes
const BGC_RESERVED = ['help'];    // "help" is the Help room's name in send / history, so nobody can be it

function user_out(array $u): array
{
    return [
        'handle' => (string) $u['handle'],
        'display' => (string) $u['display'],
        'online' => (int) $u['last_seen'] >= now_ms() - BGC_ONLINE_MS,
    ];
}

function user_by_handle(string $handle): ?array
{
    return q_row('SELECT * FROM bgc_users WHERE handle = ?', [$handle]);
}

/** the user named by $b[$key] who is not me and not banned (404 otherwise, 400 for myself) */
function other_user(array $b, array $me, string $key = 'handle'): array
{
    $h = v_handle($b, $key);
    if ($h === $me['handle']) throw new ApiError(400, 'That is you.');
    $u = user_by_handle($h);
    if ($u === null || (int) $u['banned'] !== 0) throw new ApiError(404, 'There is no user "' . $h . '".');
    return $u;
}

/** a friendship row's key: the smaller id first */
function pair(int $a, int $b): array
{
    return $a < $b ? [$a, $b] : [$b, $a];
}

function are_friends(int $a, int $b): bool
{
    return q_val('SELECT 1 FROM bgc_friends WHERE a_id = ? AND b_id = ?', pair($a, $b)) !== null;
}

function has_request(int $from, int $to): bool
{
    return q_val('SELECT 1 FROM bgc_requests WHERE from_id = ? AND to_id = ?', [$from, $to]) !== null;
}

function blocked_either(int $a, int $b): bool
{
    return q_val('SELECT 1 FROM bgc_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)', [$a, $b, $b, $a]) !== null;
}

/** none / friend / requested (I asked) / incoming (they asked) */
function relation(int $me, int $other): string
{
    if (are_friends($me, $other)) return 'friend';
    if (has_request($me, $other)) return 'requested';
    if (has_request($other, $me)) return 'incoming';
    return 'none';
}

/** make two users friends (and drop any request either way) */
function befriend(int $a, int $b): void
{
    q('DELETE FROM bgc_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)', [$a, $b, $b, $a]);
    q_insert_once('INSERT INTO bgc_friends (a_id, b_id, since) VALUES (?, ?, ?)', array_merge(pair($a, $b), [now_ms()]));
}

/** end everything between two users: friendship and requests either way */
function unfriend_all(int $a, int $b): void
{
    q('DELETE FROM bgc_friends WHERE a_id = ? AND b_id = ?', pair($a, $b));
    q('DELETE FROM bgc_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)', [$a, $b, $b, $a]);
}
