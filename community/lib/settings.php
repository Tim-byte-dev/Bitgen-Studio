<?php
// bitGen Community (2.710.0) - the settings: config.php (never in git) + the environment overrides.
// 2.712.1: no config.php -> the private folder the tigerart.com.au admin page (/b_admin/) writes, OUTSIDE public_html:
//   <home>/bitgen-private/db.json      {"host", "name", "user", "admins": [...]}  (no password in it)
//   <home>/bitgen-private/db-pass.txt  the database password, encrypted with secret.key (bgc_secret_open)
//   <home>/bitgen-private/secret.key   32 random bytes, base64
// <home> = the folder above the site's document root; BITGEN_PRIVATE_DIR overrides the whole path.
//   BGC_DSN                 overrides 'dsn' (e.g. sqlite:/tmp/test.db); when it is set config.php is optional
//   BGC_ADMINS              overrides 'admins' (a comma list of handles)
//   BGC_REGISTER_PER_HOUR   overrides limits.register_per_hour (tests register more than 5 users from 127.0.0.1)
declare(strict_types=1);
if (!defined('BGC')) { http_response_code(404); exit; }

function bgc_settings(): array
{
    static $s = null;
    if ($s !== null) return $s;

    $BGC = [];
    $file = dirname(__DIR__) . '/config.php';
    if (is_file($file)) require $file;          // sets $BGC (local to this function)
    if (!is_array($BGC)) $BGC = [];
    if (!is_file($file)) $BGC = array_merge($BGC, bgc_private_settings());

    $env = getenv('BGC_DSN');
    if (is_string($env) && $env !== '') $BGC['dsn'] = $env;
    if (empty($BGC['dsn']) || !is_string($BGC['dsn'])) {
        throw new ApiError(500, 'The community server is not set up yet: copy config.sample.php to config.php and fill it in.');
    }

    $admins = $BGC['admins'] ?? [];
    $envAdmins = getenv('BGC_ADMINS');
    if (is_string($envAdmins) && $envAdmins !== '') $admins = explode(',', $envAdmins);
    $admins = array_values(array_filter(array_map(
        static fn ($h) => strtolower(trim((string) $h)), is_array($admins) ? $admins : []
    ), static fn ($h) => $h !== ''));

    $limits = array_merge(
        ['send_per_minute' => 30, 'register_per_hour' => 5, 'login_failures_per_15min' => 10],
        is_array($BGC['limits'] ?? null) ? $BGC['limits'] : []
    );
    $envReg = getenv('BGC_REGISTER_PER_HOUR');
    if (is_string($envReg) && ctype_digit($envReg)) $limits['register_per_hour'] = (int) $envReg;

    $s = [
        'dsn' => $BGC['dsn'],
        'user' => isset($BGC['user']) && $BGC['user'] !== '' ? (string) $BGC['user'] : null,
        'pass' => isset($BGC['pass']) && $BGC['pass'] !== '' ? (string) $BGC['pass'] : null,
        'admins' => $admins,
        'name' => (string) ($BGC['name'] ?? 'bitGen Community'),
        'rules' => (string) ($BGC['rules'] ?? 'Be kind. Help each other. No spam, no hate, nothing illegal. Admins may delete messages and ban accounts.'),
        'require_https' => (bool) ($BGC['require_https'] ?? true),
        'ip_header' => isset($BGC['ip_header']) ? (string) $BGC['ip_header'] : null,
        'limits' => array_map('intval', $limits),
    ];
    return $s;
}

/** the private folder (outside public_html) the admin page writes; '' when there is none */
function bgc_private_dir(): string
{
    $env = getenv('BITGEN_PRIVATE_DIR');
    if (is_string($env) && $env !== '') return rtrim($env, '/\\');
    $root = realpath((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''));
    return $root ? dirname($root) . '/bitgen-private' : '';
}

/** db.json + the decrypted db-pass.txt -> the same keys as config.php's $BGC ([] when the folder is not there) */
function bgc_private_settings(): array
{
    $dir = bgc_private_dir();
    if ($dir === '' || !is_file($dir . '/db.json')) return [];
    $j = json_decode((string) @file_get_contents($dir . '/db.json'), true);
    if (!is_array($j) || empty($j['name'])) return [];
    $out = [
        'dsn' => 'mysql:host=' . ($j['host'] ?? 'localhost') . ';dbname=' . $j['name'] . ';charset=utf8mb4',
        'user' => (string) ($j['user'] ?? ''),
        'admins' => is_array($j['admins'] ?? null) ? $j['admins'] : [],
    ];
    $box = @file_get_contents($dir . '/db-pass.txt');
    $key = @file_get_contents($dir . '/secret.key');
    if (is_string($box) && is_string($key)) {
        $pass = bgc_secret_open(trim($box), base64_decode(trim($key), true) ?: '');
        if ($pass === null) throw new ApiError(500, 'The community server cannot read its database password - save it again on the admin page.');
        $out['pass'] = $pass;
    }
    return $out;
}

/** decrypt "bgx1:" (libsodium secretbox) or "bgx2:" (AES-256-GCM) - the admin page's format; null if it does not open */
function bgc_secret_open(string $box, string $key): ?string
{
    if (strlen($key) !== 32) return null;
    $raw = base64_decode(substr($box, 5), true);
    if ($raw === false) return null;
    if (strncmp($box, 'bgx1:', 5) === 0 && function_exists('sodium_crypto_secretbox_open')) {
        if (strlen($raw) < 24 + 16) return null;
        $p = sodium_crypto_secretbox_open(substr($raw, 24), substr($raw, 0, 24), $key);
        return $p === false ? null : $p;
    }
    if (strncmp($box, 'bgx2:', 5) === 0) {
        if (strlen($raw) < 12 + 16) return null;
        $p = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', $key, OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16));
        return $p === false ? null : $p;
    }
    return null;
}
