<?php
require_once __DIR__ . '/inc/bg-auth.php';
if (isset($_GET['me'])) { $u = bg_user(); bg_json($u ? ['ok' => true, 'name' => $u['name'], 'email' => $u['email']] : ['ok' => false], $u ? 200 : 401); }
$u = bg_require_login();
$orders = '';
try {
  $st = bg_db()->prepare("SELECT number, DATE_FORMAT(created_at, '%Y-%m-%d') d, total, status FROM orders WHERE email = ? ORDER BY created_at DESC LIMIT 50"); $st->execute([$u['email']]);
  foreach ($st as $o) $orders .= '<tr><td>' . bg_h($o['d']) . '</td><td>' . bg_h($o['number']) . '</td><td>' . bg_h($o['status']) . '</td><td>' . bg_h(number_format((float)$o['total'], 2)) . '</td></tr>';
} catch (Throwable $e) { /* no shop tables */ }
bg_page('Your account', '<h1>Hello ' . bg_h($u['name'] ?: $u['email']) . '</h1><p class="bg-dim">' . bg_h($u['email']) . '</p>'
  . ($orders ? '<h2>Your orders</h2><table style="width:100%">' . $orders . '</table>' : '')
  . '<form method="post" action="logout.php"><input type="hidden" name="csrf" value="' . bg_csrf() . '"><button class="bg-btn ghost" type="submit">Log out</button></form>');
