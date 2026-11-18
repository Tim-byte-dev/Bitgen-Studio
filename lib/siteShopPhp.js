// bitGen Studio — lib/siteShopPhp.js (2.850.0): 🛒 the built website's SHOP FRONT END (PHP 8 + MySQL / MariaDB) on the
// admin database's shop tables (lib/siteAdminSql.js: products, variants, categories, coupons, shipping, orders …).
// Tim (verbatim): "build she shopfrot end, the public catalog and checkout pages after this."
// Files lib/siteBuild.js writes with the 🛒 Shop tick (the admin area comes with it):
//   inc/shop.php   the cart in the session, prices (a sale price wins; a variant's own price), totals - coupon, shipping
//                  (free over), tax included or added (Settings), placing an order in ONE transaction: every product row
//                  locked (FOR UPDATE), stock checked and taken (stock_movements), the client found / made by email, the
//                  order + items + status history + a pending payment, the coupon counted; e-mails to the buyer + the shop
//   shop.php       the catalogue: categories, search, sale prices, out of stock
//   product.php    a product: pictures, description, variants, quantity, ＋ Add to cart
//   cart.php       the cart: quantities, remove, a coupon, shipping, the totals, ➜ Checkout
//   checkout.php   name, email, phone, the address, how to pay (bank transfer / on pick-up - Settings), notes -> Place order
//   order.php      the order's own page (its number + a private key): items, totals, how to pay, its status
// No online card payments: those need the shop's own account with a payment provider (offered, not built).
// No "${" or back-ticks in the PHP (they would be JavaScript's here).
"use strict";
const SHOP_LIB = String.raw`<?php
// 🛒 The shop - made by bitGen Studio. Products, orders, clients: the admin database (inc/admindb.php, /admin/).
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/admindb.php';
/** a reason in words for the buyer (a database error is never shown) */
class ShopRefused extends Exception { }
if (session_status() === PHP_SESSION_NONE && !headers_sent()) { session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax', 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']); session_start(); }
function shop_csrf() { if (empty($_SESSION['shop_csrf'])) $_SESSION['shop_csrf'] = bin2hex(random_bytes(16)); return $_SESSION['shop_csrf']; }
function shop_csrf_field() { return '<input type="hidden" name="csrf" value="' . shop_csrf() . '">'; }
function shop_post_ok() { return ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && hash_equals(shop_csrf(), (string)($_POST['csrf'] ?? '')); }
function shop_set($name, $def = '') { static $all = null; if ($all === null) { $all = []; try { foreach (adb()->query('SELECT name, value FROM settings') as $r) $all[$r['name']] = (string)$r['value']; } catch (Throwable $e) { } } return array_key_exists($name, $all) && $all[$name] !== '' ? $all[$name] : $def; }
function shop_money($v) { $c = shop_set('currency', 'AUD'); return in_array($c, ['AUD', 'USD', 'NZD', 'CAD', 'SGD', 'HKD'], true) ? '$' . number_format((float)$v, 2) : number_format((float)$v, 2) . ' ' . h($c); }
function shop_img($f) { $f = basename((string)$f); return preg_match('/^[\w.-]{1,120}\.(png|jpe?g|webp|gif|svg)$/i', $f) ? 'assets/' . rawurlencode($f) : ''; }
function shop_unit($p, $v = null) { if ($v && $v['price'] !== null) return (float)$v['price']; return $p['sale_price'] !== null && (float)$p['sale_price'] < (float)$p['price'] ? (float)$p['sale_price'] : (float)$p['price']; }
function shop_cart() { return isset($_SESSION['cart']) && is_array($_SESSION['cart']) ? $_SESSION['cart'] : []; }
function shop_count() { return array_sum(shop_cart()); }
/** how many of this one can be bought now (null = no limit) */
function shop_room($p, $v) { $track = (int)$p['track_stock'] && !(int)$p['allow_backorder']; if (!$track) return null; return max(0, (int)($v ? $v['stock'] : $p['stock'])); }
/** the cart's lines from the database (gone / off-sale ones dropped): [key, product, variant, qty, unit, total] */
function shop_lines() {
  $out = [];
  foreach (shop_cart() as $key => $qty) {
    if (!preg_match('/^(\d+)(?::(\d+))?$/', (string)$key, $m) || (int)$qty < 1) continue;
    $q = adb()->prepare('SELECT * FROM products WHERE id = ? AND active = 1'); $q->execute([(int)$m[1]]); $p = $q->fetch(); if (!$p) continue;
    $v = null; if (!empty($m[2])) { $q = adb()->prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ? AND active = 1'); $q->execute([(int)$m[2], $p['id']]); $v = $q->fetch() ?: null; if (!$v) continue; }
    $unit = shop_unit($p, $v); $out[] = ['key' => $key, 'p' => $p, 'v' => $v, 'qty' => (int)$qty, 'unit' => $unit, 'total' => round($unit * (int)$qty, 2)];
  }
  return $out;
}
function shop_add($pid, $vid, $qty) {
  $q = adb()->prepare('SELECT * FROM products WHERE id = ? AND active = 1'); $q->execute([(int)$pid]); $p = $q->fetch(); if (!$p) return 'That product is not for sale.';
  $v = null; if ($vid) { $q = adb()->prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ? AND active = 1'); $q->execute([(int)$vid, $p['id']]); $v = $q->fetch(); if (!$v) return 'Please choose an option.'; }
  $key = $p['id'] . ($v ? ':' . $v['id'] : ''); $cart = shop_cart(); $want = (int)($cart[$key] ?? 0) + max(1, min(999, (int)$qty)); $room = shop_room($p, $v);
  if ($room !== null && $want > $room) { if ($room <= (int)($cart[$key] ?? 0)) return 'Sorry - there are no more of those in stock.'; $want = $room; }
  $cart[$key] = $want; $_SESSION['cart'] = $cart; return '';
}
function shop_setqty($key, $qty) { $cart = shop_cart(); if (!isset($cart[$key])) return; if ((int)$qty < 1) unset($cart[$key]); else $cart[$key] = min(999, (int)$qty); $_SESSION['cart'] = $cart; }
/** a coupon code -> the row or why not (subtotal for its least spend) */
function shop_coupon($code, $subtotal) {
  $code = trim((string)$code); if ($code === '') return [null, ''];
  $q = adb()->prepare('SELECT * FROM coupons WHERE code = ? AND active = 1'); $q->execute([$code]); $c = $q->fetch();
  if (!$c) return [null, 'That code is not one of ours.'];
  if (($c['starts_at'] && strtotime($c['starts_at']) > time()) || ($c['ends_at'] && strtotime($c['ends_at']) < time())) return [null, 'That code is not on now.'];
  if ($c['max_uses'] !== null && (int)$c['used'] >= (int)$c['max_uses']) return [null, 'That code has been used up.'];
  if ($c['min_spend'] !== null && $subtotal < (float)$c['min_spend']) return [null, 'That code needs a spend of ' . shop_money($c['min_spend']) . '.'];
  return [$c, ''];
}
function shop_methods() { try { return adb()->query('SELECT * FROM shipping_methods WHERE active = 1 ORDER BY sort, price, name')->fetchAll(); } catch (Throwable $e) { return []; } }
/** the totals: subtotal - discount + shipping (free over its amount; a free-shipping coupon) and the tax (included or added) */
function shop_totals($lines, $coupon, $method) {
  $sub = 0.0; foreach ($lines as $l) $sub += $l['total']; $sub = round($sub, 2);
  $disc = 0.0; if ($coupon) { if ($coupon['kind'] === 'percent') $disc = round($sub * min(100, (float)$coupon['value']) / 100, 2); elseif ($coupon['kind'] === 'fixed') $disc = min($sub, round((float)$coupon['value'], 2)); }
  $ship = $method ? (float)$method['price'] : 0.0;
  if ($method && $method['free_over'] !== null && $sub - $disc >= (float)$method['free_over']) $ship = 0.0;
  if ($coupon && $coupon['kind'] === 'free_shipping') $ship = 0.0;
  $rate = max(0, (float)shop_set('tax_rate', '0')); $base = round($sub - $disc + $ship, 2);
  if (shop_set('prices_include_tax', '1') === '1') { $tax = round($base * $rate / (100 + $rate), 2); $total = $base; }
  else { $tax = round($base * $rate / 100, 2); $total = round($base + $tax, 2); }
  return ['subtotal' => $sub, 'discount' => $disc, 'shipping' => round($ship, 2), 'tax' => $tax, 'total' => $total, 'included' => shop_set('prices_include_tax', '1') === '1', 'rate' => $rate];
}
function shop_method($id) { foreach (shop_methods() as $m) if ((int)$m['id'] === (int)$id) return $m; return null; }
function shop_pay_methods() { $m = []; if (shop_set('pay_bank', '1') === '1') $m['bank'] = 'Bank transfer'; if (shop_set('pay_pickup', '1') === '1') $m['pickup'] = 'Pay on pick-up'; if (!$m) $m['invoice'] = 'We will send an invoice'; return $m; }
function shop_mail($to, $subject, $body) {
  if (!filter_var($to, FILTER_VALIDATE_EMAIL)) return false;
  $from = shop_set('email', ''); $h = "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n" . (filter_var($from, FILTER_VALIDATE_EMAIL) ? 'From: ' . $from . "\r\n" : '');
  return @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, $h);
}
/** place the order -> ['number', 'token'] or throws why (in words) */
function shop_place($f) {
  $pdo = adb(); $pdo->beginTransaction();
  try {
    $lines = []; $sub = 0;
    foreach (shop_lines() as $l) {
      $q = $pdo->prepare('SELECT * FROM products WHERE id = ? AND active = 1 FOR UPDATE'); $q->execute([$l['p']['id']]); $p = $q->fetch(); if (!$p) throw new ShopRefused($l['p']['name'] . ' is no longer for sale.');
      $v = null; if ($l['v']) { $q = $pdo->prepare('SELECT * FROM product_variants WHERE id = ? FOR UPDATE'); $q->execute([$l['v']['id']]); $v = $q->fetch(); }
      $room = shop_room($p, $v); if ($room !== null && $l['qty'] > $room) throw new ShopRefused('Only ' . $room . ' of ' . $p['name'] . ($v ? ' (' . $v['name'] . ')' : '') . ' left - please change the cart.');
      $unit = shop_unit($p, $v); $lines[] = ['p' => $p, 'v' => $v, 'qty' => $l['qty'], 'unit' => $unit, 'total' => round($unit * $l['qty'], 2)];
    }
    if (!$lines) throw new ShopRefused('The cart is empty.');
    $sub = array_sum(array_column($lines, 'total'));
    [$coupon, $why] = shop_coupon($_SESSION['shop_coupon'] ?? '', $sub); if ($why !== '') { unset($_SESSION['shop_coupon']); throw new ShopRefused($why); }
    if ($coupon) { $q = $pdo->prepare('SELECT * FROM coupons WHERE id = ? FOR UPDATE'); $q->execute([$coupon['id']]); $coupon = $q->fetch(); if ($coupon['max_uses'] !== null && (int)$coupon['used'] >= (int)$coupon['max_uses']) throw new ShopRefused('That code has just been used up.'); }
    $method = shop_method($_SESSION['shop_ship'] ?? 0); if (shop_methods() && !$method) throw new ShopRefused('Please choose the shipping.');
    $t = shop_totals($lines, $coupon, $method);
    $cid = bgadm_client($f['name'], $f['email'], $f['phone'], 'order');
    if ($cid) $pdo->prepare("UPDATE clients SET address_line1 = IF(address_line1 = '', ?, address_line1), city = IF(city = '', ?, city), state = IF(state = '', ?, state), postcode = IF(postcode = '', ?, postcode), country = IF(country = '', ?, country) WHERE id = ?")->execute([$f['line1'], $f['city'], $f['state'], $f['postcode'], $f['country'], $cid]);
    $tok = bin2hex(random_bytes(16));
    $pdo->prepare("INSERT INTO orders (number, client_id, status, payment_status, currency, subtotal, discount, shipping, tax, total, coupon_code, shipping_method, email, ship_name, ship_line1, ship_line2, ship_city, ship_state, ship_postcode, ship_country, payment_method, view_token, notes, ip) VALUES (?, ?, 'pending', 'unpaid', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      ->execute(['TMP-' . substr($tok, 0, 24), $cid, substr(shop_set('currency', 'AUD'), 0, 3), $t['subtotal'], $t['discount'], $t['shipping'], $t['tax'], $t['total'], $coupon ? $coupon['code'] : '', $method ? $method['name'] : '', strtolower($f['email']), $f['name'], $f['line1'], $f['line2'], $f['city'], $f['state'], $f['postcode'], $f['country'], $f['pay'], $tok, $f['notes'], substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45)]);
    $oid = (int)$pdo->lastInsertId(); $number = shop_set('order_prefix', 'ORD-') . str_pad((string)$oid, 5, '0', STR_PAD_LEFT);
    $pdo->prepare('UPDATE orders SET number = ? WHERE id = ?')->execute([$number, $oid]);
    $ii = $pdo->prepare('INSERT INTO order_items (order_id, product_id, variant_id, sku, name, qty, unit_price, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $sm = $pdo->prepare("INSERT INTO stock_movements (product_id, variant_id, qty_change, reason, order_id, note) VALUES (?, ?, ?, 'sale', ?, 'website order')");
    foreach ($lines as $l) {
      $ii->execute([$oid, $l['p']['id'], $l['v'] ? $l['v']['id'] : null, (string)($l['v'] ? $l['v']['sku'] : $l['p']['sku']), $l['p']['name'] . ($l['v'] ? ' - ' . $l['v']['name'] : ''), $l['qty'], $l['unit'], $l['total']]);
      if ((int)$l['p']['track_stock']) { if ($l['v']) $pdo->prepare('UPDATE product_variants SET stock = stock - ? WHERE id = ?')->execute([$l['qty'], $l['v']['id']]); else $pdo->prepare('UPDATE products SET stock = stock - ? WHERE id = ?')->execute([$l['qty'], $l['p']['id']]); $sm->execute([$l['p']['id'], $l['v'] ? $l['v']['id'] : null, -$l['qty'], $oid]); }
    }
    if ($coupon) $pdo->prepare('UPDATE coupons SET used = used + 1 WHERE id = ?')->execute([$coupon['id']]);
    $pdo->prepare("INSERT INTO order_status_history (order_id, status, note) VALUES (?, 'pending', 'placed on the website')")->execute([$oid]);
    $pdo->prepare("INSERT INTO payments (order_id, client_id, provider, amount, currency, status) VALUES (?, ?, ?, ?, ?, 'pending')")->execute([$oid, $cid, $f['pay'], $t['total'], substr(shop_set('currency', 'AUD'), 0, 3)]);
    $pdo->commit();
  } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw ($e instanceof ShopRefused ? $e : new ShopRefused('The order could not be saved - please try again.')); }
  unset($_SESSION['cart'], $_SESSION['shop_coupon'], $_SESSION['shop_csrf']);
  $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'; $base = ($https ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? 'localhost') . rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/'), '/\\');
  $link = $base . '/order.php?' . http_build_query(['n' => $number, 'k' => $tok]); $biz = shop_set('business_name', defined('SITE_NAME') ? SITE_NAME : 'the shop');
  $list = ''; foreach ($lines as $l) $list .= $l['qty'] . ' x ' . $l['p']['name'] . ($l['v'] ? ' - ' . $l['v']['name'] : '') . '  ' . shop_money($l['total']) . "\n";
  shop_mail($f['email'], $biz . ': order ' . $number, "Thank you, " . $f['name'] . "!\n\nYour order " . $number . ":\n" . $list . "\nTotal " . shop_money($t['total']) . "\n\n" . shop_how_to_pay($f['pay'], $number) . "\n\nSee your order: " . $link . "\n");
  shop_mail(shop_set('order_email', shop_set('email', '')), 'New order ' . $number . ' - ' . shop_money($t['total']), $f['name'] . ' <' . $f['email'] . '> ' . $f['phone'] . "\n" . $list . "\nTotal " . shop_money($t['total']) . ' (' . $f['pay'] . ")\n" . ($f['notes'] !== '' ? "\n" . $f['notes'] . "\n" : ''));
  return ['number' => $number, 'token' => $tok];
}
function shop_how_to_pay($pay, $number) {
  if ($pay === 'bank') return 'Please pay by bank transfer with your order number ' . $number . ' as the reference.' . (shop_set('bank_details') !== '' ? "\n" . shop_set('bank_details') : '');
  if ($pay === 'pickup') return 'Please pay when you pick it up.' . (shop_set('pickup_note') !== '' ? ' ' . shop_set('pickup_note') : '');
  return 'We will send you an invoice.';
}
function shop_cards($rows) {
  if (!$rows) return '<p class="shop-none">Nothing here yet.</p>';
  $o = '<div class="shop-grid">';
  foreach ($rows as $p) {
    $img = shop_img($p['image']); $sale = $p['sale_price'] !== null && (float)$p['sale_price'] < (float)$p['price']; $out = (int)$p['track_stock'] && !(int)$p['allow_backorder'] && (int)$p['stock'] < 1;
    $o .= '<a class="shop-card" href="product.php?p=' . rawurlencode($p['slug']) . '">' . ($img !== '' ? '<img src="' . h($img) . '" alt="' . h($p['name']) . '" loading="lazy">' : '<span class="shop-noimg"></span>')
      . '<span class="shop-name">' . h($p['name']) . '</span><span class="shop-price">' . ($sale ? '<s>' . shop_money($p['price']) . '</s> ' . shop_money($p['sale_price']) : shop_money($p['price'])) . '</span>' . ($out ? '<span class="shop-out">Out of stock</span>' : '') . '</a>';
  }
  return $o . '</div>';
}
`;
const SHOP_PAGE = String.raw`<?php
// 🛒 The catalogue - made by bitGen Studio.
require_once __DIR__ . '/inc/shop.php';
$page_title = 'Shop';
$cats = []; try { $cats = adb()->query('SELECT id, name, slug FROM categories WHERE active = 1 ORDER BY sort, name')->fetchAll(); } catch (Throwable $e) { }
$c = null; foreach ($cats as $x) if ($x['slug'] === ($_GET['c'] ?? '')) $c = $x;
$qs = trim((string)($_GET['q'] ?? '')); $w = 'p.active = 1'; $a = [];
if ($c) { $w .= ' AND p.id IN (SELECT product_id FROM product_categories WHERE category_id = ?)'; $a[] = $c['id']; }
if ($qs !== '') { $w .= ' AND (p.name LIKE ? OR p.short_description LIKE ? OR p.sku = ?)'; $a[] = '%' . $qs . '%'; $a[] = '%' . $qs . '%'; $a[] = $qs; }
$rows = []; try { $q = adb()->prepare('SELECT p.* FROM products p WHERE ' . $w . ' ORDER BY p.featured DESC, p.name LIMIT 200'); $q->execute($a); $rows = $q->fetchAll(); } catch (Throwable $e) { }
include __DIR__ . '/inc/header.php';
?>
<main class="shop">
<h1><?= h($c ? $c['name'] : 'Shop') ?></h1>
<form class="shop-bar" method="get" action="shop.php"><input type="search" name="q" value="<?= h($qs) ?>" placeholder="Search"><?php if ($c): ?><input type="hidden" name="c" value="<?= h($c['slug']) ?>"><?php endif; ?><button type="submit">Search</button></form>
<?php if ($cats): ?><nav class="shop-cats"><a href="shop.php"<?= $c ? '' : ' aria-current="page"' ?>>All</a><?php foreach ($cats as $x): ?><a href="shop.php?c=<?= rawurlencode($x['slug']) ?>"<?= $c && $c['id'] === $x['id'] ? ' aria-current="page"' : '' ?>><?= h($x['name']) ?></a><?php endforeach; ?></nav><?php endif; ?>
<?= shop_cards($rows) ?>
</main>
<?php include __DIR__ . '/inc/footer.php'; ?>
`;
const PRODUCT_PAGE = String.raw`<?php
// 🛒 A product - made by bitGen Studio.
require_once __DIR__ . '/inc/shop.php';
$q = adb()->prepare('SELECT * FROM products WHERE slug = ? AND active = 1'); $q->execute([(string)($_GET['p'] ?? '')]); $p = $q->fetch();
if (!$p) { http_response_code(404); $page_title = 'Not found'; include __DIR__ . '/inc/header.php'; echo '<main class="shop"><h1>Not found</h1><p>That product is not here. <a href="shop.php">Back to the shop</a></p></main>'; include __DIR__ . '/inc/footer.php'; exit; }
$msg = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
  if (!shop_post_ok()) $msg = 'The form had expired - please try again.';
  else { $msg = shop_add($p['id'], (int)($_POST['v'] ?? 0), (int)($_POST['qty'] ?? 1)); if ($msg === '') { header('Location: cart.php?added=1'); exit; } }
}
$q = adb()->prepare('SELECT * FROM product_variants WHERE product_id = ? AND active = 1 ORDER BY id'); $q->execute([$p['id']]); $vars = $q->fetchAll();
$q = adb()->prepare('SELECT file, alt FROM product_images WHERE product_id = ? ORDER BY sort'); $q->execute([$p['id']]); $imgs = $q->fetchAll();
$main = shop_img($p['image']); $sale = $p['sale_price'] !== null && (float)$p['sale_price'] < (float)$p['price']; $room = shop_room($p, null);
$page_title = $p['name'];
include __DIR__ . '/inc/header.php';
?>
<main class="shop shop-product">
<p><a href="shop.php">← Shop</a></p>
<div class="shop-pp">
<div class="shop-pics"><?php if ($main !== ''): ?><img src="<?= h($main) ?>" alt="<?= h($p['name']) ?>"><?php endif; ?><?php foreach ($imgs as $i): if (shop_img($i['file']) === '') continue; ?><img src="<?= h(shop_img($i['file'])) ?>" alt="<?= h($i['alt']) ?>" loading="lazy"><?php endforeach; ?></div>
<div class="shop-info">
<h1><?= h($p['name']) ?></h1>
<p class="shop-price"><?= $sale ? '<s>' . shop_money($p['price']) . '</s> ' . shop_money($p['sale_price']) : shop_money($p['price']) ?></p>
<?php if ($p['short_description'] !== ''): ?><p class="shop-short"><?= h($p['short_description']) ?></p><?php endif; ?>
<?php if ($msg !== ''): ?><p class="shop-msg" role="alert"><?= h($msg) ?></p><?php endif; ?>
<?php if ($room === 0 && !$vars): ?><p class="shop-out">Out of stock</p><?php else: ?>
<form method="post" class="shop-buy"><?= shop_csrf_field() ?>
<?php if ($vars): ?><label>Option <select name="v" required><?php foreach ($vars as $v): $vr = shop_room($p, $v); ?><option value="<?= (int)$v['id'] ?>"<?= $vr === 0 ? ' disabled' : '' ?>><?= h($v['name']) ?> - <?= shop_money(shop_unit($p, $v)) ?><?= $vr === 0 ? ' (out of stock)' : '' ?></option><?php endforeach; ?></select></label><?php endif; ?>
<label>Quantity <input type="number" name="qty" value="1" min="1" max="<?= $room === null ? 999 : max(1, $room) ?>"></label>
<button type="submit" class="shop-go">Add to cart</button></form>
<?php endif; ?>
<?php if ((string)$p['description'] !== ''): ?><div class="shop-desc"><?= nl2br(h($p['description'])) ?></div><?php endif; ?>
</div></div>
</main>
<?php include __DIR__ . '/inc/footer.php'; ?>
`;
const CART_PAGE = String.raw`<?php
// 🛒 The cart - made by bitGen Studio.
require_once __DIR__ . '/inc/shop.php';
$msg = isset($_GET['added']) ? 'Added to your cart.' : '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
  if (!shop_post_ok()) $msg = 'The form had expired - please try again.';
  else {
    foreach ((array)($_POST['qty'] ?? []) as $k => $n) shop_setqty((string)$k, (int)$n);
    if (isset($_POST['remove'])) shop_setqty((string)$_POST['remove'], 0);
    if (isset($_POST['ship'])) $_SESSION['shop_ship'] = (int)$_POST['ship'];
    if (isset($_POST['coupon'])) { $_SESSION['shop_coupon'] = trim((string)$_POST['coupon']); }
    if (isset($_POST['checkout'])) { header('Location: checkout.php'); exit; }
    $msg = 'Cart updated.';
  }
}
$lines = shop_lines(); $sub = array_sum(array_column($lines, 'total')); $methods = shop_methods();
if ($methods && !shop_method($_SESSION['shop_ship'] ?? 0)) $_SESSION['shop_ship'] = (int)$methods[0]['id'];
[$coupon, $why] = shop_coupon($_SESSION['shop_coupon'] ?? '', $sub); $t = shop_totals($lines, $coupon, shop_method($_SESSION['shop_ship'] ?? 0));
$page_title = 'Cart';
include __DIR__ . '/inc/header.php';
?>
<main class="shop shop-cart">
<h1>Your cart</h1>
<?php if ($msg !== ''): ?><p class="shop-msg" role="status"><?= h($msg) ?></p><?php endif; ?>
<?php if (!$lines): ?><p>Your cart is empty. <a href="shop.php">Go shopping</a></p><?php else: ?>
<form method="post"><?= shop_csrf_field() ?>
<table class="shop-table"><tr><th>Item</th><th>Price</th><th>Quantity</th><th>Total</th><th></th></tr>
<?php foreach ($lines as $l): ?><tr><td><a href="product.php?p=<?= rawurlencode($l['p']['slug']) ?>"><?= h($l['p']['name']) ?></a><?= $l['v'] ? ' <span class="shop-var">' . h($l['v']['name']) . '</span>' : '' ?></td><td><?= shop_money($l['unit']) ?></td>
<td><input type="number" name="qty[<?= h($l['key']) ?>]" value="<?= (int)$l['qty'] ?>" min="0" max="999"></td><td><?= shop_money($l['total']) ?></td><td><button type="submit" name="remove" value="<?= h($l['key']) ?>" class="shop-x" aria-label="Remove">✕</button></td></tr><?php endforeach; ?>
</table>
<div class="shop-sum">
<?php if ($methods): ?><label>Shipping <select name="ship"><?php foreach ($methods as $m): ?><option value="<?= (int)$m['id'] ?>"<?= (int)($_SESSION['shop_ship'] ?? 0) === (int)$m['id'] ? ' selected' : '' ?>><?= h($m['name']) ?> - <?= (float)$m['price'] > 0 ? shop_money($m['price']) : 'free' ?><?= $m['free_over'] !== null ? ' (free over ' . shop_money($m['free_over']) . ')' : '' ?></option><?php endforeach; ?></select></label><?php endif; ?>
<label>Code <input name="coupon" value="<?= h($_SESSION['shop_coupon'] ?? '') ?>" maxlength="40"></label><?php if ($why !== ''): ?><span class="shop-msg"><?= h($why) ?></span><?php endif; ?>
<button type="submit">Update</button>
<dl class="shop-tot"><dt>Subtotal</dt><dd><?= shop_money($t['subtotal']) ?></dd><?php if ($t['discount'] > 0): ?><dt>Discount</dt><dd>-<?= shop_money($t['discount']) ?></dd><?php endif; ?><?php if ($methods): ?><dt>Shipping</dt><dd><?= $t['shipping'] > 0 ? shop_money($t['shipping']) : 'free' ?></dd><?php endif; ?>
<dt><?= $t['included'] ? 'Includes tax' : 'Tax' ?> (<?= h($t['rate']) ?>%)</dt><dd><?= shop_money($t['tax']) ?></dd><dt class="shop-grand">Total</dt><dd class="shop-grand"><?= shop_money($t['total']) ?></dd></dl>
<button type="submit" name="checkout" value="1" class="shop-go">Checkout ➜</button>
</div></form>
<?php endif; ?>
</main>
<?php include __DIR__ . '/inc/footer.php'; ?>
`;
const CHECKOUT_PAGE = String.raw`<?php
// 🛒 Checkout - made by bitGen Studio.
require_once __DIR__ . '/inc/shop.php';
$lines = shop_lines(); if (!$lines) { header('Location: cart.php'); exit; }
$pays = shop_pay_methods(); $msg = ''; $f = ['name' => '', 'email' => '', 'phone' => '', 'line1' => '', 'line2' => '', 'city' => '', 'state' => '', 'postcode' => '', 'country' => '', 'pay' => array_key_first($pays), 'notes' => ''];
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
  foreach ($f as $k => $v) if (isset($_POST[$k])) $f[$k] = mb_substr(trim((string)$_POST[$k]), 0, $k === 'notes' ? 2000 : 120);
  if (!shop_post_ok()) $msg = 'The form had expired - please try again.';
  elseif ($f['name'] === '' || !filter_var($f['email'], FILTER_VALIDATE_EMAIL)) $msg = 'Please give your name and a valid email address.';
  elseif (!isset($pays[$f['pay']])) $msg = 'Please choose how to pay.';
  elseif (shop_methods() && ($f['line1'] === '' || $f['city'] === '' || $f['postcode'] === '')) $msg = 'Please give the address to send it to.';
  else { try { $o = shop_place($f); header('Location: order.php?' . http_build_query(['n' => $o['number'], 'k' => $o['token'], 'new' => 1])); exit; } catch (ShopRefused $e) { $msg = $e->getMessage(); } }
  $lines = shop_lines();
}
[$coupon] = shop_coupon($_SESSION['shop_coupon'] ?? '', array_sum(array_column($lines, 'total'))); $t = shop_totals($lines, $coupon, shop_method($_SESSION['shop_ship'] ?? 0));
$page_title = 'Checkout';
include __DIR__ . '/inc/header.php';
?>
<main class="shop shop-checkout">
<h1>Checkout</h1>
<?php if ($msg !== ''): ?><p class="shop-msg" role="alert"><?= h($msg) ?></p><?php endif; ?>
<form method="post" class="shop-form"><?= shop_csrf_field() ?>
<fieldset><legend>You</legend><label>Name <input name="name" required maxlength="120" value="<?= h($f['name']) ?>" autocomplete="name"></label><label>Email <input type="email" name="email" required maxlength="120" value="<?= h($f['email']) ?>" autocomplete="email"></label><label>Phone <input name="phone" maxlength="40" value="<?= h($f['phone']) ?>" autocomplete="tel"></label></fieldset>
<?php if (shop_methods()): ?><fieldset><legend>Send it to</legend><label>Address <input name="line1" required value="<?= h($f['line1']) ?>" autocomplete="address-line1"></label><label>Address (line 2) <input name="line2" value="<?= h($f['line2']) ?>" autocomplete="address-line2"></label>
<label>City / suburb <input name="city" required value="<?= h($f['city']) ?>" autocomplete="address-level2"></label><label>State <input name="state" value="<?= h($f['state']) ?>" autocomplete="address-level1"></label><label>Postcode <input name="postcode" required value="<?= h($f['postcode']) ?>" autocomplete="postal-code"></label><label>Country <input name="country" value="<?= h($f['country']) ?>" autocomplete="country-name"></label></fieldset><?php endif; ?>
<fieldset><legend>How to pay</legend><?php foreach ($pays as $k => $l): ?><label class="shop-radio"><input type="radio" name="pay" value="<?= h($k) ?>"<?= $f['pay'] === $k ? ' checked' : '' ?>> <?= h($l) ?></label><?php endforeach; ?></fieldset>
<label>Notes <textarea name="notes" rows="3" maxlength="2000"><?= h($f['notes']) ?></textarea></label>
<dl class="shop-tot"><?php foreach ($lines as $l): ?><dt><?= (int)$l['qty'] ?> × <?= h($l['p']['name']) ?><?= $l['v'] ? ' - ' . h($l['v']['name']) : '' ?></dt><dd><?= shop_money($l['total']) ?></dd><?php endforeach; ?>
<?php if ($t['discount'] > 0): ?><dt>Discount</dt><dd>-<?= shop_money($t['discount']) ?></dd><?php endif; ?><dt>Shipping</dt><dd><?= $t['shipping'] > 0 ? shop_money($t['shipping']) : 'free' ?></dd><dt><?= $t['included'] ? 'Includes tax' : 'Tax' ?></dt><dd><?= shop_money($t['tax']) ?></dd><dt class="shop-grand">Total</dt><dd class="shop-grand"><?= shop_money($t['total']) ?></dd></dl>
<button type="submit" class="shop-go">Place order</button> <a href="cart.php">Back to the cart</a>
</form>
</main>
<?php include __DIR__ . '/inc/footer.php'; ?>
`;
const ORDER_PAGE = String.raw`<?php
// 🛒 An order's own page (its number + a private key) - made by bitGen Studio.
require_once __DIR__ . '/inc/shop.php';
$q = adb()->prepare('SELECT * FROM orders WHERE number = ?'); $q->execute([(string)($_GET['n'] ?? '')]); $o = $q->fetch();
if (!$o || $o['view_token'] === '' || !hash_equals($o['view_token'], (string)($_GET['k'] ?? ''))) { http_response_code(404); $page_title = 'Not found'; include __DIR__ . '/inc/header.php'; echo '<main class="shop"><h1>Not found</h1><p>That order is not here.</p></main>'; include __DIR__ . '/inc/footer.php'; exit; }
$q = adb()->prepare('SELECT * FROM order_items WHERE order_id = ?'); $q->execute([$o['id']]); $items = $q->fetchAll();
$page_title = 'Order ' . $o['number'];
include __DIR__ . '/inc/header.php';
?>
<main class="shop shop-order">
<h1><?= isset($_GET['new']) ? 'Thank you!' : 'Your order' ?></h1>
<p>Order <strong><?= h($o['number']) ?></strong> · <?= h(substr($o['created_at'], 0, 16)) ?> · <span class="shop-status"><?= h($o['status']) ?></span><?= $o['payment_status'] === 'paid' ? ' · paid' : '' ?></p>
<table class="shop-table"><tr><th>Item</th><th>Quantity</th><th>Total</th></tr><?php foreach ($items as $i): ?><tr><td><?= h($i['name']) ?></td><td><?= (int)$i['qty'] ?></td><td><?= shop_money($i['total']) ?></td></tr><?php endforeach; ?></table>
<dl class="shop-tot"><dt>Subtotal</dt><dd><?= shop_money($o['subtotal']) ?></dd><?php if ((float)$o['discount'] > 0): ?><dt>Discount</dt><dd>-<?= shop_money($o['discount']) ?></dd><?php endif; ?><dt>Shipping</dt><dd><?= (float)$o['shipping'] > 0 ? shop_money($o['shipping']) : 'free' ?></dd><dt>Tax</dt><dd><?= shop_money($o['tax']) ?></dd><dt class="shop-grand">Total</dt><dd class="shop-grand"><?= shop_money($o['total']) ?></dd></dl>
<?php if ($o['payment_status'] !== 'paid'): ?><p class="shop-pay"><?= nl2br(h(shop_how_to_pay($o['payment_method'], $o['number']))) ?></p><?php endif; ?>
<p>We have e-mailed this to <?= h($o['email']) ?>. <a href="shop.php">Back to the shop</a></p>
</main>
<?php include __DIR__ . '/inc/footer.php'; ?>
`;
const SHOP_CSS = `
/* 🛒 the shop */
.shop{max-width:1100px;margin:0 auto;padding:24px 20px}.shop h1{margin:0 0 14px}
.shop-bar{display:flex;gap:8px;margin:0 0 12px}.shop-bar input{flex:1;max-width:360px}
.shop input,.shop select,.shop textarea,.shop button{font:inherit;padding:7px 10px;border:1px solid #c9ced6;border-radius:6px;background:#fff;color:#1f2933}
.shop button{cursor:pointer}.shop .shop-go{background:var(--accent,#1f6feb);border-color:var(--accent,#1f6feb);color:#fff;font-weight:600;padding:9px 18px}
.shop-cats{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 16px}.shop-cats a{padding:5px 12px;border-radius:99px;border:1px solid #d5d9df;text-decoration:none;color:inherit}.shop-cats a[aria-current]{background:#1f2933;color:#fff}
.shop-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:18px}
.shop-card{display:flex;flex-direction:column;gap:6px;text-decoration:none;color:inherit;border:1px solid #e3e6ea;border-radius:10px;padding:10px;background:#fff}
.shop-card img,.shop-noimg{width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;background:#f1f3f5;display:block}.shop-name{font-weight:600}
.shop-price{font-weight:700}.shop-price s{color:#8a9099;font-weight:400}.shop-out{color:#b42318;font-size:.9em}.shop-msg{color:#b54708}
.shop-pp{display:grid;grid-template-columns:1fr 1fr;gap:28px}.shop-pics{display:grid;gap:10px}.shop-pics img{width:100%;border-radius:10px}
.shop-buy{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;margin:14px 0}.shop-buy label,.shop-form label{display:flex;flex-direction:column;gap:4px}
.shop-table{width:100%;border-collapse:collapse;margin:10px 0}.shop-table th,.shop-table td{padding:8px;border-bottom:1px solid #e3e6ea;text-align:left}.shop-table input{width:80px}
.shop-sum{display:flex;flex-direction:column;align-items:flex-end;gap:10px}.shop-tot{display:grid;grid-template-columns:auto auto;gap:4px 20px;margin:10px 0}.shop-tot dd{margin:0;text-align:right}.shop-grand{font-weight:700;font-size:1.15em}
.shop-form{display:flex;flex-direction:column;gap:14px;max-width:640px}.shop-form fieldset{display:grid;grid-template-columns:1fr 1fr;gap:10px;border:1px solid #e3e6ea;border-radius:10px;padding:14px}
.shop-radio{flex-direction:row!important;align-items:center;gap:8px!important}.shop-pay{white-space:pre-line;background:#fffaeb;border-radius:8px;padding:12px}.shop-var{color:#6b7280}
@media (max-width:760px){.shop-pp,.shop-form fieldset{grid-template-columns:1fr}}
`;
module.exports = { SHOP_LIB, SHOP_PAGE, PRODUCT_PAGE, CART_PAGE, CHECKOUT_PAGE, ORDER_PAGE, SHOP_CSS };
