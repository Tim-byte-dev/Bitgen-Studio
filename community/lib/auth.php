<?php
// bitGen Community (2.710.0) - passwords and tokens. A token is 32 random bytes as hex, given to the client once and
// kept here only as its sha256. Passwords: password_hash over a sha384 of the password, so bcrypt's 72-byte cut-off
// never drops the end of a long one.
declare(strict_types=1);
if (!defined('BGC')) { http_response_code(404); exit; }

function pw_prep(string $password): string
{
    return base64_encode(hash('sha384', $password, true));
}

function pw_hash(string $password): string
{
    return password_hash(pw_prep($password), PASSWORD_DEFAULT);
}

function pw_check(string $password, string $hash): bool
{
    return password_verify(pw_prep($password), $hash);
}

/** a new token for the user -> the token itself (only its hash is stored) */
function token_issue(int $userId): string
{
    $token = bin2hex(random_bytes(32));
    $now = now_ms();
    q('INSERT INTO bgc_tokens (token_hash, user_id, created_at, last_used) VALUES (?, ?, ?, ?)',
        [hash('sha256', $token), $userId, $now, $now]);
    return $token;
}

/** the signed-in user's row (401 without a good token; a banned user's tokens are gone, and refused if one is left) */
function auth_user(array $body): array
{
    $token = bgc_token($body);
    if ($token === null) throw new ApiError(401, 'Sign in first (no token).');
    $hash = hash('sha256', $token);
    $u = q_row('SELECT u.*, t.last_used AS token_used FROM bgc_tokens t JOIN bgc_users u ON u.id = t.user_id WHERE t.token_hash = ?', [$hash]);
    if ($u === null) throw new ApiError(401, 'You are signed out - please sign in again.');
    if ((int) $u['banned'] !== 0) {
        q('DELETE FROM bgc_tokens WHERE user_id = ?', [(int) $u['id']]);
        throw new ApiError(401, 'This account is banned.');
    }
    $now = now_ms();
    if (user_suspended($u, $now)) {                            // 2.723.0: suspended - signed out until it ends
        q('DELETE FROM bgc_tokens WHERE user_id = ?', [(int) $u['id']]);
        throw new ApiError(401, user_suspended_msg($u));
    }
    if ((int) $u['token_used'] < $now - 60000) q('UPDATE bgc_tokens SET last_used = ? WHERE token_hash = ?', [$now, $hash]);
    $u['token_hash'] = $hash;
    return $u;
}

function is_admin(array $user): bool
{
    return in_array(strtolower((string) $user['handle']), bgc_settings()['admins'], true);
}

/** 2.723.0: is this member suspended now? (suspended_until in the future) */
function user_suspended(array $u, ?int $now = null): bool
{
    $until = (int) ($u['suspended_until'] ?? 0);
    return $until > ($now ?? now_ms());
}

/** what a suspended member is told (the date it ends, UTC) */
function user_suspended_msg(array $u): string
{
    return 'This account is suspended until ' . gmdate('j M Y, H:i', intdiv((int) $u['suspended_until'], 1000)) . ' UTC.';
}

