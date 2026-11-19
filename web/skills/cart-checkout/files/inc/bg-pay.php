<?php
// bitGen web skill: 💳 card payments with Stripe Checkout - the card is typed on Stripe's own page, never on this site.
// On when inc/config.php (ON THE HOST - bitGen's 📤 Host can put them there, never in the project) defines STRIPE_SECRET_KEY
// (sk_test_… to try, sk_live_… for real), STRIPE_WEBHOOK_SECRET (whsec_…, Stripe ▸ Developers ▸ Webhooks ▸ the endpoint
// https://<your site>/stripe-webhook.php, event checkout.session.completed) and SHOP_CURRENCY (aud, usd, nzd …).
// An order is marked paid only when Stripe says so for THAT order, the same amount and currency (paid.php on the way back, the webhook
// even when the buyer closes the page); doing it twice changes nothing.
function bg_pay_on(): bool { return defined('STRIPE_SECRET_KEY') && preg_match('/^(sk|rk)_(test|live)_\w{8,}$/', (string)STRIPE_SECRET_KEY) === 1; }
function bg_pay_currency(): string { $c = strtolower(defined('SHOP_CURRENCY') ? (string)SHOP_CURRENCY : 'aud'); return preg_match('/^[a-z]{3}$/', $c) ? $c : 'aud'; }
/** the smallest unit: cents for most currencies, whole units for yen and the like */
function bg_pay_minor(float $amount, string $cur): int { return in_array($cur, ['bif','clp','djf','gnf','jpy','kmf','krw','mga','pyg','rwf','ugx','vnd','vuv','xaf','xof','xpf'], true) ? (int)round($amount) : (int)round($amount * 100); }
function bg_pay_api(string $method, string $path, array $params = null): array {
  $base = rtrim(defined('STRIPE_API_BASE') ? (string)STRIPE_API_BASE : 'https://api.stripe.com', '/');
  $ch = curl_init($base . '/v1' . $path . ($method === 'GET' && $params ? '?' . http_build_query($params) : ''));
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_USERPWD => STRIPE_SECRET_KEY . ':', CURLOPT_TIMEOUT => 30, CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_HTTPHEADER => ['Stripe-Version: 2024-06-20']]);
  if ($method !== 'GET' && $params !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
  $body = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); $err = curl_error($ch); curl_close($ch);
  if ($body === false) return [0, ['error' => ['message' => $err ?: 'no answer']]];
  return [$code, json_decode($body, true) ?: []];
}
function bg_pay_site(): string {
  $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
  $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
  return ($https ? 'https://' : 'http://') . preg_replace('/[^A-Za-z0-9.:\[\]-]/', '', (string)($_SERVER['HTTP_HOST'] ?? 'localhost')) . $dir;
}
/** a Stripe Checkout page for an order -> [url, id] (or [null, why]) */
function bg_pay_session(string $number, string $email, array $lines, string $token): array {
  $cur = bg_pay_currency(); $p = ['mode' => 'payment', 'client_reference_id' => $number, 'metadata' => ['order' => $number], 'customer_email' => $email,
    'success_url' => bg_pay_site() . '/paid.php?o=' . rawurlencode($number) . '&t=' . $token . '&s={CHECKOUT_SESSION_ID}',
    'cancel_url' => bg_pay_site() . '/cart.html?cancelled=' . rawurlencode($number), 'line_items' => []];
  foreach ($lines as $l) $p['line_items'][] = ['quantity' => $l['qty'], 'price_data' => ['currency' => $cur, 'unit_amount' => bg_pay_minor($l['unit'], $cur), 'product_data' => ['name' => $l['name']]]];
  [$code, $j] = bg_pay_api('POST', '/checkout/sessions', $p);
  if ($code !== 200 || empty($j['url'])) { error_log('stripe: ' . ($j['error']['message'] ?? ('HTTP ' . $code))); return [null, $j['error']['message'] ?? 'the card payment page could not be made']; }
  return [$j['url'], $j['id']];
}
/** mark the order paid when the Stripe session says so - THAT order, the same amount + currency; once */
function bg_pay_mark(PDO $db, array $s): string {
  $number = (string)($s['client_reference_id'] ?? ($s['metadata']['order'] ?? ''));
  if ($number === '' || ($s['payment_status'] ?? '') !== 'paid') return 'not paid';
  $st = $db->prepare('SELECT id, client_id, total, currency, payment_status, email FROM orders WHERE number = ?'); $st->execute([$number]); $o = $st->fetch();
  if (!$o) return 'no such order';
  $cur = strtolower((string)($s['currency'] ?? ''));
  if ($cur !== strtolower((string)$o['currency']) || (int)($s['amount_total'] ?? -1) !== bg_pay_minor((float)$o['total'], $cur)) { error_log("stripe: order $number amount / currency differ"); return 'amount differs'; }
  if ($o['payment_status'] === 'paid') return 'already';
  $db->beginTransaction();
  $up = $db->prepare("UPDATE orders SET payment_status = 'paid', status = IF(status = 'pending', 'paid', status), payment_method = 'card' WHERE id = ? AND payment_status <> 'paid'");
  $up->execute([$o['id']]);
  if ($up->rowCount()) {
    try { $db->prepare("INSERT INTO payments (order_id, client_id, provider, reference, amount, currency, status) VALUES (?, ?, 'stripe', ?, ?, ?, 'succeeded')")
      ->execute([$o['id'], $o['client_id'], mb_substr((string)($s['payment_intent'] ?? $s['id'] ?? ''), 0, 120), $o['total'], strtoupper($cur)]); } catch (Throwable $e) { /* an older database without payments */ }
  }
  $done = $up->rowCount() > 0;
  $db->commit();
  if ($done && filter_var($o['email'], FILTER_VALIDATE_EMAIL)) @mail($o['email'], 'Payment received - order ' . $number, "Thank you - your card payment for order $number (" . number_format((float)$o['total'], 2) . ' ' . strtoupper($cur) . ") is through.\nWe will be in touch about delivery.", 'Content-Type: text/plain; charset=utf-8');
  return 'paid';
}
/** Stripe-Signature: t=…,v1=… = HMAC-SHA256 of "t.payload" with the webhook secret; 5 minutes either way */
function bg_pay_sig_ok(string $payload, string $header, string $secret, int $tol = 300): bool {
  $t = null; $v = [];
  foreach (explode(',', $header) as $part) { [$k, $val] = array_pad(explode('=', trim($part), 2), 2, ''); if ($k === 't') $t = (int)$val; elseif ($k === 'v1') $v[] = $val; }
  if (!$t || !$v || abs(time() - $t) > $tol || $secret === '') return false;
  $want = hash_hmac('sha256', $t . '.' . $payload, $secret);
  foreach ($v as $x) if (hash_equals($want, $x)) return true;
  return false;
}
