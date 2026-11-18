<?php
require_once __DIR__ . '/inc/bg-auth.php';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && bg_csrf_ok()) { $_SESSION = []; session_destroy(); header('Location: index.html'); exit; }
header('Location: account.php');
