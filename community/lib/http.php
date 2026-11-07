<?php
// bitGen Community (2.710.0) - the HTTP side: the JSON reply, the request body, the token, the caller's address.
// MIT licence (the bitGen Studio repo). JSON only - nothing here ever prints HTML.
declare(strict_types=1);
if (!defined('BGC')) { http_response_code(404); exit; }

const BGC_MAX_BODY = 16384;   // 16 KB - a request body any bigger is refused (413)
const BGC_MAX_BUG_BODY = 7340032;   // 2.714.0: 7 MB for bug_report only (the logs + a screenshot; PHP's post_max_size is 8 MB)

/** an error a person can read; $status is the HTTP status it goes out with */
final class ApiError extends Exception
{
    public int $status;
    /** more fields for the reply, e.g. ['need' => 'verify'] (2.713.0) */
    public array $extra;
    public function __construct(int $status, string $message, array $extra = [])
    {
        parent::__construct($message);
        $this->status = $status;
        $this->extra = $extra;
    }
}

function bgc_headers(): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store');
    header('Referrer-Policy: no-referrer');
    header('X-Frame-Options: DENY');
    header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
}

/** the one way out: status + JSON, then stop */
function bgc_reply(int $status, array $data): void
{
    http_response_code($status);
    // HEX_TAG / HEX_AMP: no "<" or "&" ever leaves as-is, so nothing can be read as HTML even if a client sniffs
    $flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_INVALID_UTF8_SUBSTITUTE;
    $json = json_encode($data, $flags);
    if ($json === false) {
        http_response_code(500);
        $json = '{"ok":false,"error":"The server could not write its reply."}';
    }
    echo $json;
}

/** the request body as an array (an empty body = {}); 400 for anything that is not a JSON object, 413 over 16 KB */
function bgc_read_body(int $max = BGC_MAX_BODY): array
{
    $say = $max >= 1048576 ? round($max / 1048576) . ' MB' : round($max / 1024) . ' KB';
    $len = $_SERVER['CONTENT_LENGTH'] ?? '';
    if ($len !== '' && ctype_digit((string) $len) && (int) $len > $max) {
        throw new ApiError(413, "That request is too big ($say at most).");
    }
    $raw = file_get_contents('php://input', false, null, 0, $max + 1);
    if ($raw === false) $raw = '';
    if (strlen($raw) > $max) throw new ApiError(413, "That request is too big ($say at most).");
    if (trim($raw) === '') return [];
    try {
        $data = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
    } catch (JsonException $e) {
        throw new ApiError(400, 'The request body is not valid JSON.');
    }
    if (!is_array($data) || ($data !== [] && array_is_list($data))) {
        throw new ApiError(400, 'The request body must be a JSON object.');
    }
    return $data;
}

/** the token: "Authorization: Bearer <token>", or the body's "token" field for hosts that strip Authorization */
function bgc_token(array $body): ?string
{
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if ($h === '' && function_exists('getallheaders')) {
        foreach ((array) getallheaders() as $k => $v) {
            if (strcasecmp((string) $k, 'Authorization') === 0) { $h = (string) $v; break; }
        }
    }
    if (is_string($h) && preg_match('/^\s*Bearer\s+([0-9a-fA-F]{64})\s*$/', $h, $m)) return strtolower($m[1]);
    $t = $body['token'] ?? null;
    if (is_string($t) && preg_match('/^[0-9a-fA-F]{64}$/', $t)) return strtolower($t);
    return null;
}

/** the caller's address - REMOTE_ADDR, or the header named in config 'ip_header' (only behind a proxy you trust) */
function bgc_client_ip(): string
{
    $hdr = bgc_settings()['ip_header'];
    if (is_string($hdr) && $hdr !== '' && !empty($_SERVER[$hdr])) {
        $first = trim(explode(',', (string) $_SERVER[$hdr])[0]);
        if (filter_var($first, FILTER_VALIDATE_IP)) return $first;
    }
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    return $ip !== '' ? substr($ip, 0, 64) : 'unknown';
}

/** HTTPS only (config 'require_https', on by default) - this computer (127.0.0.1 / ::1) is let through for tests */
function bgc_require_https(): void
{
    if (!bgc_settings()['require_https']) return;
    $https = (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off')
        || (string) ($_SERVER['SERVER_PORT'] ?? '') === '443'
        || strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
    $local = in_array((string) ($_SERVER['REMOTE_ADDR'] ?? ''), ['127.0.0.1', '::1'], true);
    if (!$https && !$local) throw new ApiError(403, 'This server only answers over HTTPS - use the https:// address.');
}
