<?php
require_once __DIR__ . '/inc/bg-auth.php';
$err = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  if (!bg_csrf_ok()) $err = 'The form was out of date - try again.';
  else if (!($err = bg_login((string)($_POST['email'] ?? ''), (string)($_POST['password'] ?? '')))) { header('Location: ' . bg_next()); exit; }
}
bg_page('Log in', '<h1>Log in</h1>' . ($err ? '<p class="bg-note err">' . bg_h($err) . '</p>' : '')
  . '<form class="bg-form" method="post"><input type="hidden" name="csrf" value="' . bg_csrf() . '"><input type="hidden" name="next" value="' . bg_h(bg_next()) . '">'
  . '<label>Email <input name="email" type="email" required autocomplete="email" value="' . bg_h($_POST['email'] ?? '') . '"></label>'
  . '<label>Password <input name="password" type="password" required autocomplete="current-password"></label>'
  . '<button class="bg-btn" type="submit">Log in</button></form><p>No account yet? <a href="register.php">Make one</a></p>');
