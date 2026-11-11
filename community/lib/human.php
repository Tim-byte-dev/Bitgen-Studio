<?php
// bitGen Community (2.756.3) - JOINING IS FOR PEOPLE. Tim pasted /b_admin/ ▸ Members: a row of sign-ups with random user
// IDs, random names ("aJizTlgdmOafqerJwBanQA") and other people's email addresses - bots using the Join form so the
// community emails codes to strangers. Tim: "yes please go ahead with all 4". Here:
//   looks_made_up(name)   a first / last name a person would not type (random capitals inside a word, a long word with
//                         no vowel) -> register / set_profile refuse it BEFORE any email goes out (pure; Latin letters only)
//   join_check            a small sum for the joining program: {c: "<time>.<random>.<signature>", bits}. register
//                         needs pow {c, n} where sha256(c + ":" + n) starts with `bits` zero bits (bitGen Studio finds n
//                         in about a second - lib/community.js). Each check works once, for 10 minutes.
//   The website's own Join form (bgc_call in the same PHP process) checks a person with its slider instead and says so
//   with bgc_human_checked(true) - nothing over HTTP can set that.
//   BGC_POW_BITS = how hard (default 20; 0 = no sum asked - the tests of older parts).
declare(strict_types=1);
if (!defined('BGC')) { http_response_code(404); exit; }

const BGC_POW_AGE_MS = 600000;

/** does a name look machine-made? Only plain Latin words are judged - accents, CJK, Arabic ... never */
function looks_made_up(string $name): bool
{
    foreach (preg_split('/[\s\'’.-]+/u', trim($name)) ?: [] as $w) {
        if (!preg_match('/^[A-Za-z]+$/', $w)) continue;
        $inner = preg_match_all('/(?<=[a-z])[A-Z]/', $w);          // a capital straight after a small letter (McDonald: 1)
        if ($inner >= 3 || ($inner >= 2 && strlen($w) >= 10)) return true;
        if (strlen($w) >= 7 && !preg_match('/[aeiouyAEIOUY]/', $w)) return true;
    }
    return false;
}

function bgc_pow_bits(): int
{
    $e = getenv('BGC_POW_BITS');
    return is_string($e) && ctype_digit($e) ? min(28, (int) $e) : 20;
}

/** the website says its slider checked a person (in-process only) */
function bgc_human_checked(?bool $set = null): bool
{
    static $ok = false;
    if ($set !== null) $ok = $set;
    return $ok;
}

/** this server's own key for the checks (made once, kept in bgc_meta) */
function bgc_pow_key(): string
{
    $k = q_val('SELECT v FROM bgc_meta WHERE k = ?', ['pow_key']);
    if (is_string($k) && strlen($k) === 64) return $k;
    $k = bin2hex(random_bytes(32));
    try { q('INSERT INTO bgc_meta (k, v) VALUES (?, ?)', ['pow_key', $k]); }
    catch (PDOException $e) { $k = (string) q_val('SELECT v FROM bgc_meta WHERE k = ?', ['pow_key']); }   // another request made it first
    return $k;
}

/** leading zero bits of a binary string */
function pow_zero_bits(string $bin): int
{
    $n = 0;
    for ($i = 0; $i < strlen($bin); $i++) {
        $b = ord($bin[$i]);
        if ($b === 0) { $n += 8; continue; }
        for ($m = 0x80; $m > 0 && !($b & $m); $m >>= 1) $n++;
        break;
    }
    return $n;
}

function act_join_check(array $b, ?array $me): array
{
    $body = now_ms() . '.' . bin2hex(random_bytes(8));
    return ['c' => $body . '.' . hash_hmac('sha256', $body, bgc_pow_key()), 'bits' => bgc_pow_bits()];
}

/** register's check: the website's slider, or the sum done; throws in plain words */
function human_check(array $b): void
{
    if (bgc_human_checked()) return;
    $bits = bgc_pow_bits();
    if ($bits === 0) return;
    $p = $b['pow'] ?? null;
    $c = is_array($p) ? (string) ($p['c'] ?? '') : '';
    $n = is_array($p) ? (string) ($p['n'] ?? '') : '';
    if ($c === '' || !preg_match('/^(\d{10,15})\.([0-9a-f]{16})\.([0-9a-f]{64})$/', $c, $m) || !preg_match('/^\d{1,12}$/', $n)) {
        throw new ApiError(400, 'Joining needs bitGen Studio 2.756.3 or newer - update it, or join on the website.');
    }
    if (!hash_equals(hash_hmac('sha256', $m[1] . '.' . $m[2], bgc_pow_key()), $m[3]) || now_ms() - (int) $m[1] > BGC_POW_AGE_MS || (int) $m[1] > now_ms() + 60000) {
        throw new ApiError(400, 'The joining check ran out - try again.');
    }
    if (pow_zero_bits(hash('sha256', $c . ':' . $n, true)) < $bits) throw new ApiError(400, 'The joining check was not done - try again.');
    $key = 'pow:' . substr($m[3], 0, 32);
    rl_check($key, 1, BGC_POW_AGE_MS, 'The joining check was used already - try again.');
    rl_hit($key);
}
