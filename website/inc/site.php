<?php
/* tigerart.com.au — the bitGen Studio site (2.712.0): what every page shares.
 * Tim: "can you create the full tigerart.com.au website and only use bitgen as the only product" (+ "add github link").
 * Plain PHP 8.1+, no database: the pages read data/site.json (made by scripts/website-sync.py from the app's repo).
 * The community server (../bitgen-community/api.php, community/ in the repo) is asked for its member count. */
declare(strict_types=1);

const SITE_NAME = 'bitGen Studio';
const SITE_BY = 'Tiger Art';
const GITHUB = 'https://github.com/Tim-byte-dev/Bitgen-Studio';
const GITHUB_ZIP = GITHUB . '/archive/refs/heads/main.zip';
const GITHUB_RAW = GITHUB . '/raw/main/';
const GITHUB_ISSUES = GITHUB . '/issues';
const COMMUNITY_PATH = '/bitgen-community/api.php';

/** the site's own address prefix ("/" at the top of a domain, "/site/" in a folder) - every link and asset starts
 *  from it, so a 404 for a deep old address still finds the stylesheet */
function u(string $path = ''): string {
    static $b = null;
    if ($b === null) { $d = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')); $b = rtrim($d, '/') . '/'; }
    return htmlspecialchars($b . $path, ENT_QUOTES, 'UTF-8');
}

/** text for HTML */
function h(?string $s): string { return htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

/** data/site.json (the version, the features, the credits) - read once */
function site(): array {
    static $d = null;
    if ($d === null) {
        $raw = @file_get_contents(__DIR__ . '/../data/site.json');
        $d = $raw ? (json_decode($raw, true) ?: []) : [];
        $d += ['version' => '', 'featureCount' => 0, 'features' => [], 'credits' => [], 'pdfs' => []];
    }
    return $d;
}

/** the community server's info ({users, ...}) or null - cached 5 minutes so a busy page never waits on it */
function community_info(): ?array {
    $cache = rtrim(sys_get_temp_dir(), '/\\') . '/bitgen-site-community.json';
    if (is_file($cache) && filemtime($cache) > time() - 300) {
        $j = json_decode((string) @file_get_contents($cache), true);
        return is_array($j) && !empty($j['ok']) ? $j : null;
    }
    $host = preg_replace('/[^A-Za-z0-9.:-]/', '', $_SERVER['HTTP_HOST'] ?? '');
    if ($host === '') return null;
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $ctx = stream_context_create(['http' => ['method' => 'GET', 'timeout' => 3, 'ignore_errors' => true, 'header' => "Accept: application/json\r\nUser-Agent: tigerart-site\r\n"]]);
    $raw = @file_get_contents(($https ? 'https://' : 'http://') . $host . COMMUNITY_PATH . '?a=info', false, $ctx);
    $j = $raw ? json_decode($raw, true) : null;
    @file_put_contents($cache, json_encode(is_array($j) ? $j : ['ok' => false]));
    return is_array($j) && !empty($j['ok']) ? $j : null;
}

/** the GitHub mark (inline, so nothing loads from GitHub to draw it) */
function gh_icon(): string {
    return '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';
}
function dl_icon(): string {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 3h2v10.17l3.59-3.58L18 11l-6 6-6-6 1.41-1.41L11 13.17zM5 19h14v2H5z"/></svg>';
}

const NAV = [
    'features.php' => 'Features',
    'download.php' => 'Download',
    'guide.php' => 'Guide',
    'community.php' => 'Community',
    'about.php' => 'About',
];
