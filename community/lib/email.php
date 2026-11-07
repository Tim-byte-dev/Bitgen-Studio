<?php
// bitGen Community (2.713.0) - every member has a first name, last name and a confirmed email address.
// Tim: "let users enter first name, last name and email - and verify email so if we ban a user they can't just change
// their username". One account per address; an address an admin banned can never join again. The address is compared
// reduced (email_key): lower-case, without a "+tag", and for Gmail without dots - so "Tim.Paul+x@gmail.com" and
// "timpaul@googlemail.com" are the same person. A 6-digit code goes to the address; it works for 15 minutes and 5 tries.
declare(strict_types=1);
if (!defined('BGC')) { http_response_code(404); exit; }

const BGC_CODE_MS = 15 * 60 * 1000;
const BGC_CODE_TRIES = 5;
const BGC_STALE_MS = 7 * 24 * 3600 * 1000;    // an account never confirmed is let go after a week (its ID + address free again)

/** a first / last name: 1-40 printable characters on one line */
function v_name(array $b, string $key, string $what): string
{
    return v_text($b, $key, 1, 40, false, $what);
}

/** an email address: at most 190 characters, a plain address with a domain that has a dot */
function v_email(array $b, string $key = 'email'): string
{
    $e = trim(v_string($b, $key));
    if (strlen($e) > 190 || !filter_var($e, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n<>"]/', $e)
        || !str_contains(substr($e, (int) strrpos($e, '@')), '.')) {
        throw new ApiError(400, 'That is not an email address.');
    }
    return $e;
}

/** the address reduced, so one person = one key */
function email_key(string $email): string
{
    $e = strtolower(trim($email));
    $at = (int) strrpos($e, '@');
    $local = explode('+', substr($e, 0, $at), 2)[0];
    $domain = substr($e, $at + 1);
    if ($domain === 'googlemail.com') $domain = 'gmail.com';
    if ($domain === 'gmail.com') $local = str_replace('.', '', $local);
    return $local . '@' . $domain;
}

function email_banned(string $key): bool
{
    return q_val('SELECT 1 FROM bgc_banned_emails WHERE email_key = ?', [$key]) !== null;
}

/** 403 when banned, 409 when another account has it */
function email_free_or_fail(string $key, int $exceptUserId = 0): void
{
    if (email_banned($key)) throw new ApiError(403, 'This email address cannot join the community.');
    $other = q_val('SELECT id FROM bgc_users WHERE email_key = ? AND id <> ?', [$key, $exceptUserId]);
    if ($other !== null) throw new ApiError(409, 'That email address already has an account - sign in with it instead.');
}

/** accounts nobody confirmed for a week go (they could never post, so nothing of theirs stays) */
function email_drop_stale(): void
{
    $cut = now_ms() - BGC_STALE_MS;
    $ids = array_map(fn ($r) => (int) $r['id'], q_all('SELECT id FROM bgc_users WHERE email_verified = 0 AND email IS NOT NULL AND created_at < ?', [$cut]));
    foreach ($ids as $id) {
        q('DELETE FROM bgc_tokens WHERE user_id = ?', [$id]);
        q('DELETE FROM bgc_users WHERE id = ?', [$id]);
    }
}

function code_hash(int $userId, string $code): string { return hash('sha256', $userId . ':' . $code); }

/** a new code for the user, emailed -> true when the email went. $limited (asking again, a new address): 4 an hour per
 *  account and 10 per caller's address */
function code_send(array $u, bool $limited = true): bool
{
    $id = (int) $u['id'];
    if ($limited) {
        rl_check('code:u:' . $id, 4, 3600 * 1000, 'Too many codes asked for - wait an hour, or check your spam folder.');
        rl_check('code:ip:' . bgc_client_ip(), 10, 3600 * 1000, 'Too many codes asked for from here - wait an hour.');
        rl_hit('code:u:' . $id);
        rl_hit('code:ip:' . bgc_client_ip());
    }
    $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    q('UPDATE bgc_users SET code_hash = ?, code_expires = ?, code_tries = 0 WHERE id = ?', [code_hash($id, $code), now_ms() + BGC_CODE_MS, $id]);
    $s = bgc_settings();
    $first = trim((string) ($u['first_name'] ?? ''));
    $text = ($first !== '' ? "Hi $first,\n\n" : "Hi,\n\n")
        . "Your bitGen Community code is:\n\n    $code\n\n"
        . "Type it in bitGen Studio's Community panel, or on " . $s['site_url'] . "/account.php, to confirm this email address.\n"
        . "It works for 15 minutes.\n\n"
        . "If you did not ask to join the bitGen Community, ignore this email - nothing happens without the code.\n\n"
        . "- " . $s['name'] . "\n";
    return bgc_mail((string) $u['email'], 'Your bitGen Community code: ' . $code, $text);
}

/** the code typed -> the address confirmed, or 400 / 429 in words */
function code_check(array $u, string $code): void
{
    $id = (int) $u['id'];
    if ((int) $u['email_verified'] === 1) return;
    if (empty($u['code_hash'])) throw new ApiError(400, 'There is no code waiting - ask for a new one.');
    if ((int) $u['code_tries'] >= BGC_CODE_TRIES) throw new ApiError(429, 'Too many wrong codes - ask for a new one.');
    if ((int) $u['code_expires'] < now_ms()) throw new ApiError(400, 'That code has run out (15 minutes) - ask for a new one.');
    $code = preg_replace('/\D/', '', $code);
    if (strlen($code) !== 6 || !hash_equals((string) $u['code_hash'], code_hash($id, $code))) {
        q('UPDATE bgc_users SET code_tries = code_tries + 1 WHERE id = ?', [$id]);
        $left = BGC_CODE_TRIES - (int) $u['code_tries'] - 1;
        throw new ApiError(400, 'That code is not right' . ($left > 0 ? " - $left " . ($left === 1 ? 'try' : 'tries') . ' left.' : ' - ask for a new one.'));
    }
    q('UPDATE bgc_users SET email_verified = 1, code_hash = NULL, code_expires = NULL, code_tries = 0 WHERE id = ?', [$id]);
}

/** what a member sees about their own account */
function profile_out(array $u): array
{
    return [
        'first_name' => (string) ($u['first_name'] ?? ''),
        'last_name' => (string) ($u['last_name'] ?? ''),
        'email' => (string) ($u['email'] ?? ''),
        'verified' => (int) ($u['email_verified'] ?? 0) === 1,
        'needs_profile' => empty($u['email']),
    ];
}
