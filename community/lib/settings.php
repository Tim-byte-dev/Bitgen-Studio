<?php
// bitGen Community (2.710.0) - the settings: config.php (never in git) + the environment overrides.
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
