<?php
// bitGen web skill: 💳 Stripe tells the site about a payment (Stripe ▸ Developers ▸ Webhooks ▸ this address, event
// checkout.session.completed; its signing secret = STRIPE_WEBHOOK_SECRET in inc/config.php). Signed or nothing happens.
require_once __DIR__ . '/inc/bg-db.php';
require_once __DIR__ . '/inc/bg-pay.php';
$payload = file_get_contents('php://input');
if (!bg_pay_on() || !defined('STRIPE_WEBHOOK_SECRET') || !bg_pay_sig_ok($payload, (string)($_SERVER['HTTP_STRIPE_SIGNATURE'] ?? ''), (string)STRIPE_WEBHOOK_SECRET)) bg_json(['ok' => false, 'message' => 'bad signature'], 400);
$e = json_decode($payload, true);
if (!is_array($e)) bg_json(['ok' => false], 400);
$type = (string)($e['type'] ?? '');
if (in_array($type, ['checkout.session.completed', 'checkout.session.async_payment_succeeded'], true)) {
  try { $r = bg_pay_mark(bg_db(), (array)($e['data']['object'] ?? [])); } catch (Throwable $x) { error_log('webhook: ' . $x->getMessage()); bg_json(['ok' => false], 500); }
  bg_json(['ok' => true, 'result' => $r]);
}
bg_json(['ok' => true, 'ignored' => $type]);
