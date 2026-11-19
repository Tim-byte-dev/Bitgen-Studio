<?php
// bitGen web skill: 🧾 checkout - js/bg-shop.js posts {items [{slug, qty}], customer {...}}. The prices come from data/content.json
// HERE (never from the browser); the order goes into the site's database (the Web editor's 🗂 CRM ▸ 🗄 tables: clients, orders,
// order_items) and shows in the CRM's 🧾 Orders. Answers JSON {ok, number, message} (+ pay_url: 💳 Stripe's card page when inc/bg-pay.php is set up).
require_once __DIR__ . '/inc/bg-db.php';
require_once __DIR__ . '/inc/bg-pay.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') bg_json(['ok' => false, 'message' => 'POST only'], 405);
$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in) || empty($in['items']) || !is_array($in['items'])) bg_json(['ok' => false, 'message' => 'The cart is empty.'], 400);
$c = is_array($in['customer'] ?? null) ? $in['customer'] : [];
$s = fn($k, $n) => mb_substr(trim((string)($c[$k] ?? '')), 0, $n);
$name = $s('name', 120); $email = $s('email', 200); $phone = $s('phone', 40);
if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) bg_json(['ok' => false, 'message' => 'Your name and a real email address, please.'], 400);
$data = json_decode((string)@file_get_contents(__DIR__ . '/data/content.json'), true);
$bySlug = [];
foreach (($data['products'] ?? []) as $p) if (($p['published'] ?? true) !== false) $bySlug[$p['slug']] = $p;
$lines = []; $total = 0.0;
foreach (array_slice($in['items'], 0, 100) as $it) {
  $p = $bySlug[(string)($it['slug'] ?? '')] ?? null; $q = max(0, min(999, (int)($it['qty'] ?? 0)));
  if (!$p || !$q) continue;
  $stock = (isset($p['stock']) && $p['stock'] !== null && $p['stock'] !== '') ? (int)$p['stock'] : null;   // null = not counted
  if ($stock === 0) continue;
  if ($stock !== null && $stock < $q) $q = $stock;
  $unit = (isset($p['sale']) && $p['sale'] !== null && $p['sale'] !== '' && (float)$p['sale'] < (float)$p['price']) ? (float)$p['sale'] : (float)$p['price'];
  $lines[] = ['name' => mb_substr((string)$p['name'], 0, 200), 'sku' => mb_substr((string)$p['slug'], 0, 60), 'qty' => $q, 'unit' => $unit, 'total' => round($unit * $q, 2)];
  $total += $unit * $q;
}
if (!$lines) bg_json(['ok' => false, 'message' => 'Nothing in the cart can be ordered now.'], 400);
$total = round($total, 2);
try {
  $db = bg_db(); $db->beginTransaction();
  $st = $db->prepare('SELECT id FROM clients WHERE email = ? LIMIT 1'); $st->execute([$email]); $cid = $st->fetchColumn();
  if (!$cid) {
    $parts = preg_split('/\s+/', $name); $last = count($parts) > 1 ? array_pop($parts) : ''; $first = implode(' ', $parts);
    $db->prepare("INSERT INTO clients (first_name, last_name, email, phone, source) VALUES (?, ?, ?, ?, 'website')")->execute([$first, $last, $email, $phone]);
    $cid = (int)$db->lastInsertId();
  }
  $number = 'ORD-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
  $db->prepare("INSERT INTO orders (number, client_id, status, payment_status, subtotal, total, email, ship_name, ship_line1, ship_city, ship_state, ship_postcode, ship_country, notes, ip) VALUES (?, ?, 'pending', 'unpaid', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
     ->execute([$number, $cid, $total, $total, $email, $name, $s('address', 120), $s('city', 80), $s('state', 80), $s('postcode', 20), $s('country', 80), $s('notes', 5000), mb_substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45)]);
  $oid = (int)$db->lastInsertId();
  $token = bin2hex(random_bytes(16));
  $db->prepare('UPDATE orders SET currency = ?, view_token = ?, payment_method = ? WHERE id = ?')->execute([strtoupper(bg_pay_currency()), $token, bg_pay_on() ? 'card' : '', $oid]);
  $ins = $db->prepare('INSERT INTO order_items (order_id, sku, name, qty, unit_price, total) VALUES (?, ?, ?, ?, ?, ?)');
  foreach ($lines as $l) $ins->execute([$oid, $l['sku'], $l['name'], $l['qty'], $l['unit'], $l['total']]);
  $db->commit();
} catch (Throwable $e) {
  if (isset($db) && $db->inTransaction()) $db->rollBack();
  error_log('checkout: ' . $e->getMessage());
  bg_json(['ok' => false, 'message' => 'The order could not be saved - please try again or contact us.'], 500);
}
if (bg_pay_on()) {   // 💳 the buyer goes to Stripe's page; paid.php / the webhook mark the order paid
  [$url, $why] = bg_pay_session($number, $email, $lines, $token);
  if ($url) bg_json(['ok' => true, 'number' => $number, 'total' => $total, 'pay_url' => $url, 'message' => 'Taking you to the card payment…']);
  bg_json(['ok' => true, 'number' => $number, 'total' => $total, 'message' => 'We have your order, but the card payment page could not open - we will contact you about payment.']);
}
@mail($email, 'Your order ' . $number, "Thank you for your order $number.\nTotal: " . number_format($total, 2) . "\nWe will be in touch about payment and delivery.", 'Content-Type: text/plain; charset=utf-8');
bg_json(['ok' => true, 'number' => $number, 'total' => $total, 'message' => 'We have emailed you the details.']);
