<?php
// bitGen web skill: the site's database (PDO) - the settings in inc/config.php (DB_HOST may be host:port; the password from the server).
require_once __DIR__ . '/config.php';
function bg_db(): PDO {
  static $pdo = null;
  if ($pdo === null) {
    $host = DB_HOST; $port = '';
    if (strpos($host, ':') !== false) { [$host, $port] = explode(':', $host, 2); }
    $dsn = 'mysql:host=' . $host . ($port !== '' ? ';port=' . (int)$port : '') . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, defined('DB_PASS') ? DB_PASS : '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]);
  }
  return $pdo;
}
function bg_json($a, int $code = 200): void { http_response_code($code); header('Content-Type: application/json; charset=utf-8'); echo json_encode($a); exit; }
