<?php
// bitGen Community (2.710.0) - rate limits, kept in the database (bgc_hits: one row per counted event) so they hold
// across PHP processes on shared hosting:  send 30 / minute per user, register 5 / hour per IP,
// login 10 failures / 15 minutes per handle or per IP.
declare(strict_types=1);
if (!defined('BGC')) { http_response_code(404); exit; }

function rl_count(string $key, int $windowMs): int
{
    return (int) q_val('SELECT COUNT(*) FROM bgc_hits WHERE k = ? AND at > ?', [$key, now_ms() - $windowMs]);
}

function rl_hit(string $key): void
{
    $now = now_ms();
    q('INSERT INTO bgc_hits (k, at) VALUES (?, ?)', [$key, $now]);
    if (random_int(1, 50) === 1) q('DELETE FROM bgc_hits WHERE at < ?', [$now - 3600 * 1000]);   // nothing counts past an hour
}

/** 429 when $key already has $limit events inside the window */
function rl_check(string $key, int $limit, int $windowMs, string $message): void
{
    if (rl_count($key, $windowMs) >= $limit) throw new ApiError(429, $message);
}
