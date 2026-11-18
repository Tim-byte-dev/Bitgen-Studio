<?php
require_once __DIR__ . '/inc/bg-auth.php';
$err = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  if (!bg_csrf_ok()) $err = 'The form was out of date - try again.';
  else if (!($err = bg_register((string)($_POST['name'] ?? ''), (string)($_POST['email'] ?? ''), (string)($_POST['password'] ?? '')))) { header('Location: account.php'); exit; }
}
bg_page('Make an account', '<h1>Make an account</h1>' . ($err ? '<p class="bg-note err">' . bg_h($err) . '</p>' : '')
  . '<form class="bg-form" method="post"><input type="hidden" name="csrf" value="' . bg_csrf() . '">'
  . '<label>Name <input name="name" required autocomplete="name" value="' . bg_h($_POST['name'] ?? '') . '"></label>'
  . '<label>Email <input name="email" type="email" required autocomplete="email" value="' . bg_h($_POST['email'] ?? '') . '"></label>'
  . '<label>Password (10 characters or more) <input name="password" type="password" required minlength="10" autocomplete="new-password"></label>'
  . '<button class="bg-btn" type="submit">Make the account</button></form><p>Have one? <a href="login.php">Log in</a></p>');
