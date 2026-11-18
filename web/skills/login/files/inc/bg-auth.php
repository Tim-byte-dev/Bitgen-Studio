<?php
// bitGen web skill: 🔐 member login - sessions with safe cookies, passwords hashed (password_hash), a CSRF token on every form,
// 5 wrong tries = a 10-minute wait. The table bg_site_users is made in the site's database the first time.
require_once __DIR__ . '/bg-db.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
  session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => !empty($_SERVER['HTTPS']), 'httponly' => true, 'samesite' => 'Lax']);
  session_start();
}
function bg_users_table(): void {
  static $done = false; if ($done) return;
  bg_db()->exec("CREATE TABLE IF NOT EXISTS bg_site_users (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, email VARCHAR(200) NOT NULL UNIQUE, name VARCHAR(120) NOT NULL DEFAULT '', pass_hash VARCHAR(255) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, last_login DATETIME NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $done = true;
}
function bg_csrf(): string { if (empty($_SESSION['bg_csrf'])) $_SESSION['bg_csrf'] = bin2hex(random_bytes(16)); return $_SESSION['bg_csrf']; }
function bg_csrf_ok(): bool { return isset($_POST['csrf'], $_SESSION['bg_csrf']) && hash_equals($_SESSION['bg_csrf'], (string)$_POST['csrf']); }
function bg_user(): ?array { return $_SESSION['bg_user'] ?? null; }
function bg_require_login(): array { $u = bg_user(); if (!$u) { header('Location: login.php?next=' . rawurlencode($_SERVER['REQUEST_URI'] ?? 'account.php')); exit; } return $u; }
function bg_h($s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function bg_next(): string { $n = (string)($_GET['next'] ?? $_POST['next'] ?? 'account.php'); return (preg_match('#^/?[\w./?=&%-]*$#', $n) && strpos($n, '//') === false) ? $n : 'account.php'; }
function bg_login(string $email, string $pass): ?string {
  $t = $_SESSION['bg_tries'] ?? ['n' => 0, 'at' => 0];
  if ($t['n'] >= 5 && time() - $t['at'] < 600) return 'Too many tries - wait 10 minutes.';
  bg_users_table();
  $st = bg_db()->prepare('SELECT id, email, name, pass_hash FROM bg_site_users WHERE email = ? LIMIT 1'); $st->execute([mb_strtolower(trim($email))]); $u = $st->fetch();
  if (!$u || !password_verify($pass, $u['pass_hash'])) { $_SESSION['bg_tries'] = ['n' => $t['n'] + 1, 'at' => time()]; return 'That email and password do not match.'; }
  session_regenerate_id(true); unset($_SESSION['bg_tries']);
  $_SESSION['bg_user'] = ['id' => (int)$u['id'], 'email' => $u['email'], 'name' => $u['name']];
  bg_db()->prepare('UPDATE bg_site_users SET last_login = NOW() WHERE id = ?')->execute([$u['id']]);
  return null;
}
function bg_register(string $name, string $email, string $pass): ?string {
  $email = mb_strtolower(trim($email)); $name = mb_substr(trim($name), 0, 120);
  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return 'A real email address, please.';
  if (mb_strlen($pass) < 10) return 'The password needs at least 10 characters.';
  bg_users_table();
  try { bg_db()->prepare('INSERT INTO bg_site_users (email, name, pass_hash) VALUES (?, ?, ?)')->execute([$email, $name, password_hash($pass, PASSWORD_DEFAULT)]); }
  catch (PDOException $e) { return 'There is already an account with that email - log in instead.'; }
  return bg_login($email, $pass);
}
function bg_page(string $title, string $body): void {
  echo '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' . bg_h($title) . '</title>'
    . '<link rel="stylesheet" href="css/style.css"><link rel="stylesheet" href="css/bg-theme.css"></head><body><main><section style="max-width:520px;margin:40px auto;padding:0 16px">' . $body . '</section></main></body></html>';
}
