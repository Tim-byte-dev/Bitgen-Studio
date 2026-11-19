<?php
// bitGen web skill: 💳 back from Stripe's payment page - the order is checked with Stripe and marked paid (the webhook does the same).
require_once __DIR__ . '/inc/bg-db.php';
require_once __DIR__ . '/inc/bg-pay.php';
$h = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
$number = preg_replace('/[^A-Za-z0-9-]/', '', (string)($_GET['o'] ?? '')); $sid = preg_replace('/[^A-Za-z0-9_]/', '', (string)($_GET['s'] ?? ''));
$state = 'unknown';
if (bg_pay_on() && $number !== '' && $sid !== '') {
  [$code, $s] = bg_pay_api('GET', '/checkout/sessions/' . $sid);
  if ($code === 200 && (string)($s['client_reference_id'] ?? '') === $number) { try { $state = bg_pay_mark(bg_db(), $s); } catch (Throwable $e) { error_log('paid: ' . $e->getMessage()); } }
}
$ok = $state === 'paid' || $state === 'already';
?><!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title><?= $ok ? 'Thank you' : 'Payment' ?></title>
<link rel="stylesheet" href="css/style.css"><link rel="stylesheet" href="css/bg-theme.css"><link rel="stylesheet" href="css/bg-shop.css"></head>
<body><main><section>
<?php if ($ok): ?><h1>Thank you!</h1><div class="bg-note">Your payment for order <b><?= $h($number) ?></b> is through. We have emailed you the details.</div>
<?php else: ?><h1>Payment not finished</h1><div class="bg-note err">We have order <b><?= $h($number) ?></b>, but the card payment is not through yet. If you paid, it will show here shortly - otherwise please contact us.</div><?php endif; ?>
<p><a class="bg-btn" href="index.html">Back to the shop</a></p>
</section></main></body></html>
