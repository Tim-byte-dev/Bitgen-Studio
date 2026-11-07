<?php
// bitGen Community (2.710.0) - strict checks of the request fields (API.md): every failure is a 400 with words.
declare(strict_types=1);
if (!defined('BGC')) { http_response_code(404); exit; }

// characters never let into a name or a message: control characters (but a message's newline / tab), the line /
// paragraph separators and the bidi overrides that make text read backwards
const BGC_BAD_CHARS = '/[\x{0000}-\x{0008}\x{000B}-\x{001F}\x{007F}-\x{009F}\x{2028}\x{2029}\x{202A}-\x{202E}\x{2066}-\x{2069}]/u';

/** a UTF-8 string's length in characters (-1 when it is not valid UTF-8) */
function v_len(string $s): int
{
    if (!preg_match('//u', $s)) return -1;
    return function_exists('mb_strlen') ? mb_strlen($s, 'UTF-8') : (int) preg_match_all('/./su', $s);
}

function v_lower(string $s): string
{
    return function_exists('mb_strtolower') ? mb_strtolower($s, 'UTF-8') : strtolower($s);
}

function v_string(array $b, string $key): string
{
    $v = $b[$key] ?? null;
    if (!is_string($v)) throw new ApiError(400, "\"$key\" is missing (it must be text).");
    return $v;
}

/** a handle: 3-24 of a-z 0-9 _ . - (given in any case, used lower-case) */
function v_handle(array $b, string $key = 'handle'): string
{
    $h = strtolower(trim(v_string($b, $key)));
    if (!preg_match('/^[a-z0-9_.\-]{3,24}$/', $h)) {
        throw new ApiError(400, 'A user id is 3-24 characters: letters a-z, digits 0-9, _ . and -');
    }
    return $h;
}

/** display: 1-40 printable characters; absent / null / empty -> $default */
function v_display(array $b, string $default): string
{
    if (!array_key_exists('display', $b) || $b['display'] === null) return $default;
    if (!is_string($b['display'])) throw new ApiError(400, '"display" must be text.');
    $d = trim($b['display']);
    if ($d === '') return $default;
    $n = v_len($d);
    if ($n < 1 || $n > 40 || preg_match(BGC_BAD_CHARS, $d) || preg_match('/[\r\n\t]/', $d)) {
        throw new ApiError(400, 'A display name is 1-40 printable characters.');
    }
    return $d;
}

function v_password(array $b, string $key = 'password'): string
{
    $p = v_string($b, $key);
    $n = v_len($p);
    if ($n < 8 || $n > 200) throw new ApiError(400, 'A password is 8-200 characters.');
    return $p;
}

/** trimmed text of $min-$max characters ($multiline: newlines and tabs allowed) */
function v_text(array $b, string $key, int $min, int $max, bool $multiline, string $what): string
{
    $t = trim(str_replace("\r\n", "\n", v_string($b, $key)));
    $n = v_len($t);
    if ($n < 0 || preg_match(BGC_BAD_CHARS, $t) || (!$multiline && preg_match('/[\r\n\t]/', $t))) {
        throw new ApiError(400, "$what has characters that are not allowed.");
    }
    if ($n < $min || $n > $max) throw new ApiError(400, "$what is $min-$max characters.");
    return $t;
}

function v_bool(array $b, string $key): bool
{
    $v = $b[$key] ?? null;
    if (!is_bool($v)) throw new ApiError(400, "\"$key\" must be true or false.");
    return $v;
}

/** a whole number $min..$max; absent / null -> $default (null $default = required) */
function v_int(array $b, string $key, int $min, int $max, ?int $default): ?int
{
    $v = $b[$key] ?? null;
    if ($v === null) {
        if ($default === null) throw new ApiError(400, "\"$key\" is missing (a whole number).");
        return $default;
    }
    if (is_string($v) && preg_match('/^\d{1,18}$/', $v)) $v = (int) $v;
    if (!is_int($v) || $v < $min || $v > $max) throw new ApiError(400, "\"$key\" must be a whole number from $min to $max.");
    return $v;
}

/** a room: "help" or a user id */
function v_room(array $b, string $key): string
{
    $r = strtolower(trim(v_string($b, $key)));
    if ($r === 'help') return 'help';
    return v_handle([$key => $r], $key);
}
