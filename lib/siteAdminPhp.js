// bitGen Studio — lib/siteAdminPhp.js (2.848.0): 🔐 the built website's ADMIN AREA (PHP 8 + MySQL / MariaDB).
// Tim (verbatim): "add the calendar admin automatically, if a db doesn't exist for admin create one called myadmin and login
// page template and login table and fields, and table for login history, and tables for client details etc to make a fully
// comprehensive db for e-commerce and simple appointment websites like a vet or dentist etc"
// Files lib/siteBuild.js writes (when the site has a calendar, or the build's 🔐 tick is on):
//   inc/admindb.php   adb() - the admin database (ADMIN_DB_* in inc/config.php, default name myadmin); bgadm_client() -
//                     a booking / contact message makes or finds the client by email
//   inc/admin.php     the session (its own cookie, httponly, SameSite), CSRF tokens, the login (password_hash /
//                     password_verify, 5 wrong in a row = locked 15 min, 20 wrong from one address in 15 min = stopped,
//                     every try in admin_login_history), roles owner > admin > staff, the audit log, the page frame
//   inc/admin_pages.php   the pages: login, first-owner setup (ADMIN_SETUP_KEY - only while there is no login), dashboard,
//                     bookings (approve / cancel with e-mails, a phone booking, notes), closed days, hours + services,
//                     clients (with their pets, records, bookings, orders), records, staff, products, categories, coupons,
//                     shipping, orders (items, status history), invoices, payments, reviews, newsletter, users, login
//                     history, audit log, settings, my account
//   admin/index.php   the router;   admin/admin.css   its look
// No "${" or back-ticks in the PHP (they would be JavaScript's here).
"use strict";

/** inc/config.php's admin part: the database (myadmin unless the host names it otherwise) + the first-login key */
function configPart(key, dbName, siteName) {
  const k = String(key || "").replace(/[^A-Za-z0-9]/g, ""), n = /^[\w$]{1,64}$/.test(String(dbName || "")) ? dbName : "myadmin";
  const t = String(siteName || "").replace(/[\r\n]/g, " ").slice(0, 120).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `// The site's name (the admin's login page and title until Settings ▸ Business name is filled in)
define('SITE_NAME', '${t}');
// 🔐 The admin area (/admin/) and its database. By default a second database called ${n} (a host may name it
// <user>_${n} - put that name here). Only one database on your host? Put DB_NAME's name here - the admin's tables have
// names of their own.
define('ADMIN_DB_HOST', getenv('ADMIN_DB_HOST') ?: DB_HOST);
define('ADMIN_DB_NAME', getenv('ADMIN_DB_NAME') ?: '${n}');
define('ADMIN_DB_USER', getenv('ADMIN_DB_USER') ?: DB_USER);
define('ADMIN_DB_PASS', getenv('ADMIN_DB_PASS') !== false ? getenv('ADMIN_DB_PASS') : DB_PASS);
// The key that makes the FIRST (owner) login at /admin/ - it works only while there is no login yet. Keep it private.
define('ADMIN_SETUP_KEY', getenv('ADMIN_SETUP_KEY') ?: '${k}');
`;
}

const ADMIN_DB = String.raw`<?php
// 🔐 The admin database - made by bitGen Studio.
require_once __DIR__ . '/config.php';
function adb() {
  static $pdo = null;
  if ($pdo === null) $pdo = new PDO('mysql:host=' . ADMIN_DB_HOST . ';dbname=' . ADMIN_DB_NAME . ';charset=utf8mb4', ADMIN_DB_USER, ADMIN_DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
  return $pdo;
}
/** a client by email: found, or made (source booking / contact / order); an empty phone filled in -> the id, or null when the admin database is not reachable */
function bgadm_client($name, $email, $phone, $source) {
  try {
    $email = strtolower(trim((string)$email)); if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return null;
    $parts = preg_split('/\s+/', trim((string)$name), 2);
    $q = adb()->prepare('SELECT id, phone FROM clients WHERE email = ?'); $q->execute([$email]); $c = $q->fetch();
    if ($c) { if ($c['phone'] === '' && $phone !== '') adb()->prepare('UPDATE clients SET phone = ? WHERE id = ?')->execute([mb_substr($phone, 0, 40), $c['id']]); return (int)$c['id']; }
    adb()->prepare('INSERT INTO clients (first_name, last_name, email, phone, source) VALUES (?, ?, ?, ?, ?)')->execute([mb_substr($parts[0] ?? '', 0, 80), mb_substr($parts[1] ?? '', 0, 80), $email, mb_substr((string)$phone, 0, 40), $source]);
    return (int)adb()->lastInsertId();
  } catch (Throwable $e) { return null; }
}
`;

const ADMIN_LIB = String.raw`<?php
// 🔐 The admin area's core - made by bitGen Studio. The pages: inc/admin_pages.php; the router: admin/index.php.
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/admindb.php';
if (session_status() === PHP_SESSION_NONE) {
  $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
  session_name('bgadmin');
  session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => $https]);
  session_start();
}
if (is_file(__DIR__ . '/calendar.php')) require_once __DIR__ . '/calendar.php';
if (!headers_sent()) { header('X-Frame-Options: DENY'); header('X-Content-Type-Options: nosniff'); header('Referrer-Policy: same-origin'); header('Cache-Control: no-store'); }
const ADM_ROLES = ['staff' => 1, 'admin' => 2, 'owner' => 3];
const ADM_MAX_FAILS = 5;      // wrong passwords in a row -> the login locked
const ADM_LOCK_MIN = 15;      // for this many minutes
const ADM_IP_FAILS = 20;      // wrong tries from one address in ADM_LOCK_MIN minutes -> that address stopped
const ADM_IDLE = 7200;        // logged out after 2 hours without a click
function adm_ip() { return substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45); }
function adm_csrf() { if (empty($_SESSION['adm_csrf'])) $_SESSION['adm_csrf'] = bin2hex(random_bytes(16)); return $_SESSION['adm_csrf']; }
function adm_csrf_field() { return '<input type="hidden" name="csrf" value="' . adm_csrf() . '">'; }
function adm_posted() { return ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST'; }
function adm_post_ok() { return adm_posted() && hash_equals(adm_csrf(), (string)($_POST['csrf'] ?? '')); }
function adm_url($p, $q = []) { return 'index.php?' . http_build_query(['p' => $p] + $q); }
function adm_go($p, $q = [], $msg = '') { if ($msg !== '') $_SESSION['adm_flash'] = $msg; header('Location: ' . adm_url($p, $q)); exit; }
function adm_flash() { $m = $_SESSION['adm_flash'] ?? ''; unset($_SESSION['adm_flash']); return $m; }
function adm_has_cal() { return function_exists('bgcal'); }
function adm_biz() { $b = adm_setting('business_name', ''); return $b !== '' ? $b : (defined('SITE_NAME') ? SITE_NAME : ''); }
function adm_setting($name, $def = '') { try { $q = adb()->prepare('SELECT value FROM settings WHERE name = ?'); $q->execute([$name]); $v = $q->fetchColumn(); return $v === false ? $def : $v; } catch (Throwable $e) { return $def; } }
function adm_user() {
  static $u = false; if ($u !== false) return $u;
  $u = null;
  if (!empty($_SESSION['adm_uid'])) {
    if (time() - (int)($_SESSION['adm_at'] ?? 0) > ADM_IDLE) { unset($_SESSION['adm_uid']); return null; }
    $q = adb()->prepare('SELECT * FROM admin_users WHERE id = ? AND active = 1'); $q->execute([(int)$_SESSION['adm_uid']]);
    $u = $q->fetch() ?: null;
    if ($u) $_SESSION['adm_at'] = time(); else unset($_SESSION['adm_uid']);
  }
  return $u;
}
function adm_can($role) { $u = adm_user(); return $u && ADM_ROLES[$u['role']] >= ADM_ROLES[$role]; }
function adm_need($role) { if (!adm_user()) adm_go('login'); if (!adm_can($role)) { http_response_code(403); adm_page('Not allowed', '<p class="msg bad">Your login cannot open this page.</p>'); exit; } }
function adm_log_login($uid, $username, $ok, $reason) {
  adb()->prepare('INSERT INTO admin_login_history (user_id, username, success, reason, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)')
    ->execute([$uid, mb_substr((string)$username, 0, 60), $ok ? 1 : 0, $reason, adm_ip(), mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255)]);
}
function adm_audit($action, $entity = '', $id = '', $details = '') {
  try { $u = adm_user(); adb()->prepare('INSERT INTO admin_audit_log (user_id, action, entity, entity_id, details, ip) VALUES (?, ?, ?, ?, ?, ?)')->execute([$u ? $u['id'] : null, $action, $entity, (string)$id, mb_substr((string)$details, 0, 2000), adm_ip()]); } catch (Throwable $e) { }
}
function adm_password_ok($p) { return is_string($p) && strlen($p) >= 10 && strlen($p) <= 200; }
/** log in -> '' or why not. Every try is in admin_login_history. */
function adm_login($username, $password) {
  $username = trim((string)$username); $password = (string)$password;
  $q = adb()->prepare('SELECT COUNT(*) FROM admin_login_history WHERE ip = ? AND success = 0 AND created_at > NOW() - INTERVAL ' . ADM_LOCK_MIN . ' MINUTE'); $q->execute([adm_ip()]);
  if ((int)$q->fetchColumn() >= ADM_IP_FAILS) { adm_log_login(null, $username, false, 'too many tries from this address'); return 'Too many tries - please wait ' . ADM_LOCK_MIN . ' minutes.'; }
  $q = adb()->prepare('SELECT * FROM admin_users WHERE username = ?'); $q->execute([$username]); $u = $q->fetch();
  if (!$u) { password_verify($password, password_hash('-', PASSWORD_DEFAULT)); adm_log_login(null, $username, false, 'no such login'); return 'Wrong username or password.'; }
  if (!(int)$u['active']) { adm_log_login($u['id'], $username, false, 'login turned off'); return 'Wrong username or password.'; }
  if ($u['locked_until'] && strtotime($u['locked_until']) > time()) { adm_log_login($u['id'], $username, false, 'locked'); return 'This login is locked for a while after too many wrong passwords.'; }
  if (!password_verify($password, $u['password_hash'])) {
    $f = (int)$u['failed_logins'] + 1; $lock = $f >= ADM_MAX_FAILS;
    adb()->prepare('UPDATE admin_users SET failed_logins = ?, locked_until = ? WHERE id = ?')->execute([$lock ? 0 : $f, $lock ? date('Y-m-d H:i:s', time() + 60 * ADM_LOCK_MIN) : null, $u['id']]);
    adm_log_login($u['id'], $username, false, $lock ? 'wrong password - locked' : 'wrong password');
    return $lock ? 'This login is locked for a while after too many wrong passwords.' : 'Wrong username or password.';
  }
  if (password_needs_rehash($u['password_hash'], PASSWORD_DEFAULT)) adb()->prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?')->execute([password_hash($password, PASSWORD_DEFAULT), $u['id']]);
  session_regenerate_id(true); $_SESSION['adm_uid'] = (int)$u['id']; $_SESSION['adm_at'] = time(); unset($_SESSION['adm_csrf']);
  adb()->prepare('UPDATE admin_users SET failed_logins = 0, locked_until = NULL, last_login_at = NOW(), last_login_ip = ? WHERE id = ?')->execute([adm_ip(), $u['id']]);
  adm_log_login($u['id'], $username, true, '');
  return '';
}
function adm_logout() { $u = adm_user(); if ($u) adm_audit('logout', 'admin_users', $u['id']); $_SESSION = []; session_regenerate_id(true); }
/* ---------------- the page frame */
function adm_nav() {
  $items = [['dashboard', 'Dashboard', 'staff']];
  if (adm_has_cal()) { $items[] = ['bookings', 'Bookings', 'staff']; $items[] = ['closed', 'Closed days', 'staff']; $items[] = ['hours', 'Hours & services', 'admin']; }
  foreach ([['t:clients', 'Clients', 'staff'], ['t:client_records', 'Records', 'staff'], ['t:pets', 'Pets', 'staff'], ['t:orders', 'Orders', 'staff'], ['t:products', 'Products', 'admin'], ['t:categories', 'Categories', 'admin'],
    ['t:coupons', 'Coupons', 'admin'], ['t:shipping_methods', 'Shipping', 'admin'], ['t:invoices', 'Invoices', 'admin'], ['t:payments', 'Payments', 'admin'], ['t:reviews', 'Reviews', 'admin'], ['t:newsletter_subscribers', 'Newsletter', 'admin'],
    ['t:staff', 'Staff', 'admin'], ['users', 'Logins', 'admin'], ['history', 'Login history', 'staff'], ['audit', 'Audit log', 'admin'], ['settings', 'Settings', 'admin'], ['account', 'My account', 'staff']] as $i) $items[] = $i;
  $p = $_GET['p'] ?? 'dashboard'; $t = $_GET['t'] ?? ''; $out = '';
  foreach ($items as [$id, $label, $role]) {
    if (!adm_can($role)) continue;
    $href = strpos($id, 't:') === 0 ? adm_url('t', ['t' => substr($id, 2)]) : adm_url($id);
    $on = strpos($id, 't:') === 0 ? (in_array($p, ['t', 'e'], true) && $t === substr($id, 2)) : $p === $id;
    $out .= '<a href="' . h($href) . '"' . ($on ? ' aria-current="page"' : '') . '>' . h($label) . '</a>';
  }
  return $out;
}
function adm_page($title, $body) {
  $u = adm_user(); $biz = adm_biz(); $flash = adm_flash();
  echo '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">'
    . '<title>' . h($title) . ' - Admin</title><link rel="stylesheet" href="admin.css"></head><body class="adm">';
  if ($u) {
    echo '<header class="adm-top"><strong>' . h($biz !== '' ? $biz : 'Admin') . '</strong><span class="sp"></span><span>' . h($u['full_name'] !== '' ? $u['full_name'] : $u['username']) . ' · ' . h($u['role']) . '</span>'
      . '<form method="post" action="' . h(adm_url('logout')) . '">' . adm_csrf_field() . '<button class="ghost" type="submit">Log out</button></form></header>'
      . '<div class="adm-wrap"><nav class="adm-nav">' . adm_nav() . '</nav><main class="adm-main"><h1>' . h($title) . '</h1>';
    if ($flash !== '') echo '<p class="msg ok" role="status">' . h($flash) . '</p>';
    echo $body . '</main></div>';
  } else echo $body;
  echo '</body></html>';
}
/* ---------------- forms + the generic tables */
/** a field: [column, label, type, flags, extra] - type text | email | tel | url | textarea | int | money | decimal | date | datetime | time | bool | enum | fk | color | password; flags 'req' required, 'null' empty = NULL, 'ro' read only */
function adm_tables() {
  $enum = function ($a) { return $a; };
  return [
    'clients' => ['Clients', 'staff', 'last_name, first_name', ['first_name', 'last_name', 'company', 'email', 'phone', 'source'], ['first_name', 'last_name', 'company', 'email', 'phone', 'mobile', 'tags'], [
      ['kind', 'Kind', 'enum', '', ['person', 'business']], ['title', 'Title', 'text'], ['first_name', 'First name', 'text'], ['last_name', 'Last name', 'text'], ['company', 'Company', 'text'],
      ['email', 'Email', 'email', 'null'], ['phone', 'Phone', 'tel'], ['mobile', 'Mobile', 'tel'], ['address_line1', 'Address', 'text'], ['address_line2', 'Address (line 2)', 'text'], ['city', 'City / suburb', 'text'],
      ['state', 'State', 'text'], ['postcode', 'Postcode', 'text'], ['country', 'Country', 'text'], ['date_of_birth', 'Date of birth', 'date', 'null'], ['emergency_name', 'Emergency contact', 'text'],
      ['emergency_phone', 'Emergency phone', 'tel'], ['preferred_contact', 'Preferred contact', 'enum', '', ['email', 'phone', 'sms']], ['marketing_opt_in', 'Agreed to marketing', 'bool'], ['tags', 'Tags', 'text'],
      ['notes', 'Notes', 'textarea'], ['source', 'Came from', 'text', 'ro'], ['active', 'Active', 'bool']]],
    'pets' => ['Pets', 'staff', 'name', ['name', 'species', 'breed', 'client_id'], ['name', 'species', 'breed', 'microchip'], [
      ['client_id', 'Owner', 'fk', 'req', ['clients', "CONCAT(first_name, ' ', last_name)"]], ['name', 'Name', 'text', 'req'], ['species', 'Species', 'text'], ['breed', 'Breed', 'text'], ['sex', 'Sex', 'enum', '', ['', 'male', 'female']],
      ['desexed', 'Desexed', 'bool'], ['date_of_birth', 'Date of birth', 'date', 'null'], ['colour', 'Colour', 'text'], ['weight_kg', 'Weight (kg)', 'decimal', 'null'], ['microchip', 'Microchip', 'text'], ['notes', 'Notes', 'textarea'], ['active', 'Active', 'bool']]],
    'client_records' => ['Records', 'staff', 'created_at DESC', ['created_at', 'client_id', 'kind', 'title', 'follow_up_on'], ['title', 'body'], [
      ['client_id', 'Client', 'fk', 'req', ['clients', "CONCAT(first_name, ' ', last_name)"]], ['pet_id', 'Pet', 'fk', 'null', ['pets', 'name']], ['staff_id', 'Seen by', 'fk', 'null', ['staff', 'name']],
      ['kind', 'Kind', 'enum', '', ['note', 'consultation', 'treatment', 'prescription', 'follow_up', 'vaccination', 'file']], ['title', 'Title', 'text', 'req'], ['body', 'Details', 'textarea'],
      ['follow_up_on', 'Follow up on', 'date', 'null'], ['booking_ref', 'Booking', 'text', 'ro'], ['created_at', 'Made', 'datetime', 'ro']]],
    'staff' => ['Staff', 'admin', 'name', ['name', 'job_title', 'email', 'phone', 'calendar_slug'], ['name', 'job_title', 'email'], [
      ['name', 'Name', 'text', 'req'], ['job_title', 'Job title', 'text'], ['email', 'Email', 'email'], ['phone', 'Phone', 'tel'], ['user_id', 'Login', 'fk', 'null', ['admin_users', 'username']],
      ['calendar_slug', 'Calendar', 'text'], ['colour', 'Colour', 'color'], ['active', 'Active', 'bool']]],
    'products' => ['Products', 'admin', 'name', ['sku', 'name', 'price', 'stock', 'active'], ['sku', 'name', 'short_description'], [
      ['sku', 'SKU', 'text', 'null'], ['name', 'Name', 'text', 'req'], ['slug', 'Web address name', 'text'], ['short_description', 'Short description', 'text'], ['description', 'Description', 'textarea'],
      ['price', 'Price', 'money', 'req'], ['sale_price', 'Sale price', 'money', 'null'], ['cost', 'Cost', 'money', 'null'], ['tax_rate', 'Tax rate % (empty = the settings\' rate)', 'decimal', 'null'],
      ['stock', 'Stock', 'int'], ['track_stock', 'Track stock', 'bool'], ['allow_backorder', 'Sell when out of stock', 'bool'], ['weight_g', 'Weight (g)', 'int', 'null'], ['image', 'Picture (file in assets/)', 'text'],
      ['featured', 'Featured', 'bool'], ['active', 'On sale', 'bool']]],
    'categories' => ['Categories', 'admin', 'sort, name', ['name', 'slug', 'parent_id', 'sort', 'active'], ['name', 'slug'], [
      ['name', 'Name', 'text', 'req'], ['slug', 'Web address name', 'text'], ['parent_id', 'Inside', 'fk', 'null', ['categories', 'name']], ['description', 'Description', 'textarea'], ['image', 'Picture', 'text'], ['sort', 'Order', 'int'], ['active', 'Shown', 'bool']]],
    'coupons' => ['Coupons', 'admin', 'code', ['code', 'kind', 'value', 'used', 'active'], ['code'], [
      ['code', 'Code', 'text', 'req'], ['kind', 'Kind', 'enum', '', ['percent', 'fixed', 'free_shipping']], ['value', 'Value', 'money'], ['min_spend', 'Least spend', 'money', 'null'], ['starts_at', 'From', 'datetime', 'null'],
      ['ends_at', 'Until', 'datetime', 'null'], ['max_uses', 'Most uses', 'int', 'null'], ['used', 'Used', 'int', 'ro'], ['active', 'Active', 'bool']]],
    'shipping_methods' => ['Shipping', 'admin', 'sort, name', ['name', 'price', 'free_over', 'active'], ['name'], [
      ['name', 'Name', 'text', 'req'], ['price', 'Price', 'money'], ['free_over', 'Free over', 'money', 'null'], ['sort', 'Order', 'int'], ['active', 'Active', 'bool']]],
    'orders' => ['Orders', 'staff', 'created_at DESC', ['number', 'created_at', 'client_id', 'status', 'payment_status', 'total'], ['number', 'email', 'ship_name', 'tracking'], [
      ['number', 'Number', 'text'], ['client_id', 'Client', 'fk', 'null', ['clients', "CONCAT(first_name, ' ', last_name)"]], ['email', 'Email', 'email'],
      ['status', 'Status', 'enum', '', ['pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled', 'refunded']], ['payment_status', 'Payment', 'enum', '', ['unpaid', 'paid', 'partially_refunded', 'refunded', 'failed']],
      ['currency', 'Currency', 'text'], ['subtotal', 'Subtotal', 'money'], ['discount', 'Discount', 'money'], ['shipping', 'Shipping', 'money'], ['tax', 'Tax', 'money'], ['total', 'Total', 'money'],
      ['coupon_code', 'Coupon', 'text'], ['shipping_method', 'Shipping method', 'text'], ['ship_name', 'Ship to', 'text'], ['ship_line1', 'Address', 'text'], ['ship_line2', 'Address (line 2)', 'text'],
      ['ship_city', 'City', 'text'], ['ship_state', 'State', 'text'], ['ship_postcode', 'Postcode', 'text'], ['ship_country', 'Country', 'text'], ['tracking', 'Tracking', 'text'], ['notes', 'Notes', 'textarea'], ['created_at', 'Made', 'datetime', 'ro']]],
    'invoices' => ['Invoices', 'admin', 'issued_on DESC', ['number', 'issued_on', 'client_id', 'status', 'total'], ['number', 'notes'], [
      ['number', 'Number', 'text'], ['client_id', 'Client', 'fk', 'null', ['clients', "CONCAT(first_name, ' ', last_name)"]], ['order_id', 'Order', 'fk', 'null', ['orders', 'number']], ['issued_on', 'Issued', 'date', 'req'],
      ['due_on', 'Due', 'date', 'null'], ['status', 'Status', 'enum', '', ['draft', 'sent', 'paid', 'overdue', 'void']], ['currency', 'Currency', 'text'], ['subtotal', 'Subtotal', 'money'], ['tax', 'Tax', 'money'], ['total', 'Total', 'money'], ['notes', 'Notes', 'textarea']]],
    'payments' => ['Payments', 'admin', 'created_at DESC', ['created_at', 'provider', 'reference', 'amount', 'status'], ['reference', 'provider'], [
      ['order_id', 'Order', 'fk', 'null', ['orders', 'number']], ['invoice_id', 'Invoice', 'fk', 'null', ['invoices', 'number']], ['client_id', 'Client', 'fk', 'null', ['clients', "CONCAT(first_name, ' ', last_name)"]],
      ['provider', 'Paid by', 'text'], ['reference', 'Reference', 'text'], ['amount', 'Amount', 'money', 'req'], ['currency', 'Currency', 'text'], ['status', 'Status', 'enum', '', ['pending', 'succeeded', 'failed', 'refunded']], ['created_at', 'When', 'datetime', 'ro']]],
    'reviews' => ['Reviews', 'admin', 'created_at DESC', ['created_at', 'product_id', 'name', 'rating', 'approved'], ['name', 'title', 'body'], [
      ['product_id', 'Product', 'fk', 'null', ['products', 'name']], ['client_id', 'Client', 'fk', 'null', ['clients', "CONCAT(first_name, ' ', last_name)"]], ['name', 'Name', 'text'], ['rating', 'Stars (1-5)', 'int'],
      ['title', 'Title', 'text'], ['body', 'Review', 'textarea'], ['approved', 'Shown', 'bool']]],
    'newsletter_subscribers' => ['Newsletter', 'admin', 'created_at DESC', ['email', 'name', 'confirmed', 'created_at'], ['email', 'name'], [
      ['email', 'Email', 'email', 'req'], ['name', 'Name', 'text'], ['confirmed', 'Confirmed', 'bool'], ['unsubscribed_at', 'Unsubscribed', 'datetime', 'null']]],
  ];
}
function adm_spec($t) { $all = adm_tables(); return $all[$t] ?? null; }
function adm_slugify($s) { $s = strtolower(trim(preg_replace('/[^A-Za-z0-9]+/', '-', (string)$s), '-')); return $s !== '' ? substr($s, 0, 200) : 'item-' . bin2hex(random_bytes(3)); }
function adm_fk_options($tbl, $label, $cur) {
  if (!preg_match('/^[a-z_]+$/', $tbl)) return '';
  $rows = adb()->query('SELECT id, ' . $label . ' AS l FROM ' . $tbl . ' ORDER BY l LIMIT 1000')->fetchAll();
  $o = '<option value="">—</option>';
  foreach ($rows as $r) $o .= '<option value="' . (int)$r['id'] . '"' . ((string)$cur === (string)$r['id'] ? ' selected' : '') . '>' . h($r['l']) . '</option>';
  return $o;
}
function adm_input($f, $v) {
  [$col, $label, $type] = $f; $flags = $f[3] ?? ''; $extra = $f[4] ?? null; $n = ' name="' . h($col) . '" id="f_' . h($col) . '"';
  $req = strpos($flags, 'req') !== false ? ' required' : ''; $ro = strpos($flags, 'ro') !== false;
  if ($ro) return '<span class="ro">' . h($v) . '</span>';
  switch ($type) {
    case 'textarea': return '<textarea' . $n . ' rows="4"' . $req . '>' . h($v) . '</textarea>';
    case 'bool': return '<input type="hidden" name="' . h($col) . '" value="0"><input type="checkbox"' . $n . ' value="1"' . ((int)$v ? ' checked' : '') . '>';
    case 'enum': $o = ''; foreach ($extra as $x) $o .= '<option' . ((string)$v === $x ? ' selected' : '') . ' value="' . h($x) . '">' . h($x === '' ? '—' : str_replace('_', ' ', $x)) . '</option>'; return '<select' . $n . '>' . $o . '</select>';
    case 'fk': return '<select' . $n . $req . '>' . adm_fk_options($extra[0], $extra[1], $v) . '</select>';
    case 'int': return '<input type="number" step="1"' . $n . ' value="' . h($v) . '"' . $req . '>';
    case 'money': case 'decimal': return '<input type="number" step="0.01"' . $n . ' value="' . h($v) . '"' . $req . '>';
    case 'date': return '<input type="date"' . $n . ' value="' . h($v ? substr($v, 0, 10) : '') . '"' . $req . '>';
    case 'datetime': return '<input type="datetime-local"' . $n . ' value="' . h($v ? str_replace(' ', 'T', substr($v, 0, 16)) : '') . '"' . $req . '>';
    case 'color': return '<input type="color"' . $n . ' value="' . h($v ?: '#3b82f6') . '">';
    default: return '<input type="' . (in_array($type, ['email', 'tel', 'url'], true) ? $type : 'text') . '"' . $n . ' value="' . h($v) . '" maxlength="255"' . $req . '>';
  }
}
/** a posted field -> its value (null for an empty nullable one) or throws why */
function adm_value($f, $raw) {
  [$col, $label, $type] = $f; $flags = $f[3] ?? ''; $v = is_string($raw) ? trim($raw) : '';
  if ($v === '' && strpos($flags, 'req') !== false) throw new RuntimeException($label . ' is needed.');
  if ($v === '' && (strpos($flags, 'null') !== false || in_array($type, ['fk', 'date', 'datetime'], true))) return null;
  switch ($type) {
    case 'bool': return $v === '1' ? 1 : 0;
    case 'int': case 'fk': if ($v === '') return 0; if (!preg_match('/^-?\d{1,10}$/', $v)) throw new RuntimeException($label . ' is a whole number.'); return (int)$v;
    case 'money': case 'decimal': if ($v === '') return 0; if (!is_numeric($v)) throw new RuntimeException($label . ' is a number.'); return round((float)$v, 2);
    case 'email': if (!filter_var($v, FILTER_VALIDATE_EMAIL)) throw new RuntimeException($label . ' is not an email address.'); return strtolower($v);
    case 'date': if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) throw new RuntimeException($label . ' is a date.'); return $v;
    case 'datetime': if (!preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/', $v)) throw new RuntimeException($label . ' is a date and time.'); return str_replace('T', ' ', $v) . ':00';
    case 'enum': if (!in_array($v, $f[4], true)) throw new RuntimeException($label . ' is not one of the choices.'); return $v;
    case 'color': return preg_match('/^#[0-9a-f]{6}$/i', $v) ? $v : '#3b82f6';
    case 'textarea': return mb_substr($v, 0, 20000);
    default: return mb_substr($v, 0, 255);
  }
}
`;

const ADMIN_PAGES = String.raw`<?php
// 🔐 The admin area's pages - made by bitGen Studio.
require_once __DIR__ . '/admin.php';
function adm_route($p) {
  if ($p === 'logout') { if (adm_post_ok()) adm_logout(); adm_go('login'); }
  $users = 0;
  try { $users = (int)adb()->query('SELECT COUNT(*) FROM admin_users')->fetchColumn(); }
  catch (Throwable $e) { adm_page('Admin', '<main class="adm-login"><div class="card"><h1>Admin</h1><p class="msg bad">The admin database is not there yet. Import admin-schema.sql into it (its name is ADMIN_DB_NAME in inc/config.php - ' . h(ADMIN_DB_NAME) . ').</p></div></main>'); return; }
  if ($users === 0) { adm_p_setup(); return; }
  if ($p === 'setup') adm_go('login');
  if ($p === 'login' || !adm_user()) { adm_p_login(); return; }
  $pages = ['dashboard' => 'adm_p_dashboard', 'bookings' => 'adm_p_bookings', 'closed' => 'adm_p_closed', 'hours' => 'adm_p_hours', 't' => 'adm_p_list', 'e' => 'adm_p_edit', 'client' => 'adm_p_client',
    'order' => 'adm_p_order', 'users' => 'adm_p_users', 'history' => 'adm_p_history', 'audit' => 'adm_p_audit', 'settings' => 'adm_p_settings', 'account' => 'adm_p_account'];
  $fn = $pages[$p] ?? 'adm_p_dashboard';
  if (in_array($p, ['bookings', 'closed', 'hours'], true) && !adm_has_cal()) $fn = 'adm_p_dashboard';
  $fn();
}
/* ---------------- the login page (the template) + the first owner */
function adm_login_frame($title, $inner) {
  $biz = adm_biz();
  adm_page($title, '<main class="adm-login"><form class="card" method="post" autocomplete="on"><div class="brand">' . h($biz !== '' ? $biz : 'Admin') . '</div><h1>' . h($title) . '</h1>' . $inner . '</form></main>');
}
function adm_p_login() {
  $msg = '';
  if (adm_posted()) {
    if (!adm_post_ok()) $msg = 'The form had expired - please try again.';
    else { $msg = adm_login($_POST['username'] ?? '', $_POST['password'] ?? ''); if ($msg === '') adm_go('dashboard'); }
  }
  adm_login_frame('Log in', ($msg !== '' ? '<p class="msg bad" role="alert">' . h($msg) . '</p>' : '') . adm_csrf_field()
    . '<label>Username <input name="username" required maxlength="60" autocomplete="username" autofocus value="' . h($_POST['username'] ?? '') . '"></label>'
    . '<label>Password <input name="password" type="password" required maxlength="200" autocomplete="current-password"></label><button class="go" type="submit">Log in</button>');
}
function adm_p_setup() {
  $msg = '';
  if (ADMIN_SETUP_KEY === '') { adm_login_frame('Set up', '<p class="msg bad">Put a setup key in inc/config.php (ADMIN_SETUP_KEY) to make the first login.</p>'); return; }
  if (adm_posted()) {
    $u = trim($_POST['username'] ?? ''); $e = trim($_POST['email'] ?? ''); $p1 = (string)($_POST['password'] ?? '');
    if (!adm_post_ok()) $msg = 'The form had expired - please try again.';
    elseif (!hash_equals(ADMIN_SETUP_KEY, (string)($_POST['key'] ?? ''))) { $msg = 'That is not the setup key.'; adm_log_login(null, $u, false, 'wrong setup key'); }
    elseif (!preg_match('/^[A-Za-z0-9_.@-]{3,60}$/', $u)) $msg = 'A username is 3-60 letters, digits or _ . @ -';
    elseif (!filter_var($e, FILTER_VALIDATE_EMAIL)) $msg = 'Please give a valid email address.';
    elseif (!adm_password_ok($p1)) $msg = 'A password is at least 10 characters.';
    elseif ($p1 !== (string)($_POST['password2'] ?? '')) $msg = 'The two passwords are not the same.';
    else {
      $pdo = adb(); $pdo->beginTransaction();
      if ((int)$pdo->query('SELECT COUNT(*) FROM admin_users FOR UPDATE')->fetchColumn() === 0) {
        $pdo->prepare("INSERT INTO admin_users (username, email, full_name, password_hash, role, password_changed_at) VALUES (?, ?, ?, ?, 'owner', NOW())")->execute([$u, strtolower($e), mb_substr(trim($_POST['full_name'] ?? ''), 0, 120), password_hash($p1, PASSWORD_DEFAULT)]);
        $pdo->commit(); adm_login($u, $p1); adm_audit('setup', 'admin_users', adm_user()['id'] ?? ''); adm_go('dashboard', [], 'Your owner login is made. Welcome!');
      }
      $pdo->rollBack(); adm_go('login');
    }
  }
  adm_login_frame('Set up the admin', '<p>Make the owner login. The setup key is in the website\'s inc/config.php (ADMIN_SETUP_KEY) and its README.</p>' . ($msg !== '' ? '<p class="msg bad" role="alert">' . h($msg) . '</p>' : '') . adm_csrf_field()
    . '<label>Setup key <input name="key" required autocomplete="off"></label><label>Username <input name="username" required maxlength="60" value="' . h($_POST['username'] ?? '') . '"></label>'
    . '<label>Your name <input name="full_name" maxlength="120" value="' . h($_POST['full_name'] ?? '') . '"></label><label>Email <input name="email" type="email" required maxlength="200" value="' . h($_POST['email'] ?? '') . '"></label>'
    . '<label>Password (10+ characters) <input name="password" type="password" required minlength="10" autocomplete="new-password"></label><label>Password again <input name="password2" type="password" required minlength="10" autocomplete="new-password"></label>'
    . '<button class="go" type="submit">Make the owner login</button>');
}
/* ---------------- the dashboard */
function adm_count($sql, $args = [], $pdo = null) { try { $q = ($pdo ?: adb())->prepare($sql); $q->execute($args); return (int)$q->fetchColumn(); } catch (Throwable $e) { return 0; } }
function adm_p_dashboard() {
  adm_need('staff'); $cards = [];
  if (adm_has_cal()) {
    $cards[] = ['Waiting for approval', adm_count("SELECT COUNT(*) FROM bg_cal_bookings WHERE status = 'pending' AND starts_at >= NOW()", [], db()), adm_url('bookings', ['status' => 'pending'])];
    $cards[] = ['Booked today', adm_count("SELECT COUNT(*) FROM bg_cal_bookings WHERE status IN ('booked', 'pending') AND DATE(starts_at) = CURDATE()", [], db()), adm_url('bookings', ['from' => date('Y-m-d'), 'to' => date('Y-m-d')])];
    $cards[] = ['Next 7 days', adm_count("SELECT COUNT(*) FROM bg_cal_bookings WHERE status IN ('booked', 'pending') AND starts_at >= NOW() AND starts_at < NOW() + INTERVAL 7 DAY", [], db()), adm_url('bookings')];
  }
  $cards[] = ['New clients this week', adm_count('SELECT COUNT(*) FROM clients WHERE created_at >= NOW() - INTERVAL 7 DAY'), adm_url('t', ['t' => 'clients'])];
  $cards[] = ['Follow-ups due', adm_count('SELECT COUNT(*) FROM v_follow_ups WHERE follow_up_on <= CURDATE() + INTERVAL 7 DAY'), adm_url('t', ['t' => 'client_records'])];
  $cards[] = ['Orders to send', adm_count("SELECT COUNT(*) FROM orders WHERE status IN ('paid', 'processing')"), adm_url('t', ['t' => 'orders'])];
  $cards[] = ['Low on stock', adm_count('SELECT COUNT(*) FROM v_low_stock'), adm_url('t', ['t' => 'products'])];
  $b = '<div class="cards">';
  foreach ($cards as [$l, $n, $href]) $b .= '<a class="cardn" href="' . h($href) . '"><b>' . $n . '</b><span>' . h($l) . '</span></a>';
  $b .= '</div>';
  if (adm_has_cal()) {
    $q = db()->query("SELECT b.*, c.name AS cal FROM bg_cal_bookings b JOIN bg_calendars c ON c.id = b.calendar_id WHERE b.status IN ('booked', 'pending') AND b.starts_at >= NOW() ORDER BY b.starts_at LIMIT 8");
    $b .= '<h2>Coming up</h2>' . adm_bookings_table($q->fetchAll(), false);
  }
  $q = adb()->prepare('SELECT created_at, success, reason, ip FROM admin_login_history WHERE user_id = ? ORDER BY id DESC LIMIT 5'); $q->execute([adm_user()['id']]);
  $b .= '<h2>Your last logins</h2><table><tr><th>When</th><th>Result</th><th>From</th></tr>';
  foreach ($q as $r) $b .= '<tr><td>' . h($r['created_at']) . '</td><td>' . ((int)$r['success'] ? 'logged in' : h('failed: ' . $r['reason'])) . '</td><td>' . h($r['ip']) . '</td></tr>';
  adm_page('Dashboard', $b . '</table>');
}
/* ---------------- bookings (the site's own database) */
function adm_cals() { return db()->query('SELECT * FROM bg_calendars ORDER BY name')->fetchAll(); }
function adm_cal($id) { $q = db()->prepare('SELECT * FROM bg_calendars WHERE id = ?'); $q->execute([(int)$id]); return $q->fetch() ?: null; }
function adm_bookings_table($rows, $actions) {
  if (!$rows) return '<p class="dim">No bookings.</p>';
  $o = '<table><tr><th>When</th><th>Calendar</th><th>Service</th><th>Who</th><th>Status</th><th>Note</th>' . ($actions ? '<th></th>' : '') . '</tr>';
  foreach ($rows as $r) {
    $who = h($r['name']) . '<br><span class="dim">' . h($r['email']) . ($r['phone'] !== '' ? ' · ' . h($r['phone']) : '') . '</span>' . (!empty($r['client_id']) ? ' <a href="' . h(adm_url('client', ['id' => $r['client_id']])) . '">client</a>' : '');
    $o .= '<tr><td>' . h(substr($r['starts_at'], 0, 16)) . ' – ' . h(substr($r['ends_at'], 11, 5)) . '</td><td>' . h($r['cal'] ?? '') . '</td><td>' . h($r['service']) . '</td><td>' . $who . '</td><td><span class="st st-' . h($r['status']) . '">' . h($r['status']) . '</span></td><td>' . h($r['admin_note'] ?? '') . '</td>';
    if ($actions) {
      $f = function ($act, $label, $cls) use ($r) { return '<form method="post" class="inl">' . adm_csrf_field() . '<input type="hidden" name="id" value="' . (int)$r['id'] . '"><input type="hidden" name="act" value="' . $act . '"><button class="' . $cls . '" type="submit">' . $label . '</button></form>'; };
      $o .= '<td class="acts">' . ($r['status'] === 'pending' ? $f('approve', 'Approve', 'go') : '') . (in_array($r['status'], ['pending', 'booked'], true) ? $f('cancel', 'Cancel', 'ghost') : '')
        . '<form method="post" class="inl">' . adm_csrf_field() . '<input type="hidden" name="id" value="' . (int)$r['id'] . '"><input type="hidden" name="act" value="note"><input name="note" maxlength="500" placeholder="Note" value="' . h($r['admin_note'] ?? '') . '"><button class="ghost" type="submit">✓</button></form></td>';
    }
    $o .= '</tr>';
  }
  return $o . '</table>';
}
function adm_p_bookings() {
  adm_need('staff');
  if (adm_posted()) {
    if (!adm_post_ok()) adm_go('bookings', [], 'The form had expired - nothing was changed.');
    $act = $_POST['act'] ?? ''; $id = (int)($_POST['id'] ?? 0);
    $q = db()->prepare('SELECT * FROM bg_cal_bookings WHERE id = ?'); $q->execute([$id]); $bk = $q->fetch();
    if ($act === 'add') {
      $cal = adm_cal($_POST['calendar_id'] ?? 0); $d = $_POST['d'] ?? ''; $t = $_POST['t'] ?? ''; $mins = max(5, min(720, (int)($_POST['minutes'] ?? 30)));
      $name = trim($_POST['name'] ?? ''); $email = trim($_POST['email'] ?? '');
      if (!$cal || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) || !preg_match('/^\d{2}:\d{2}$/', $t) || $name === '') adm_go('bookings', [], 'A booking needs its calendar, day, time and name.');
      $start = $d . ' ' . $t . ':00'; $end = date('Y-m-d H:i:s', strtotime($start) + 60 * $mins); $phone = trim($_POST['phone'] ?? '');
      $cid = filter_var($email, FILTER_VALIDATE_EMAIL) ? bgadm_client($name, $email, $phone, 'booking') : null;
      db()->prepare("INSERT INTO bg_cal_bookings (calendar_id, starts_at, ends_at, name, email, phone, notes, service, status, token, client_id, source, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'booked', ?, ?, 'admin', ?)")
        ->execute([$cal['id'], $start, $end, mb_substr($name, 0, 120), mb_substr($email, 0, 200), mb_substr($phone, 0, 40), mb_substr(trim($_POST['notes'] ?? ''), 0, 4000), mb_substr(trim($_POST['service'] ?? ''), 0, 80), bin2hex(random_bytes(16)), $cid, adm_ip()]);
      adm_audit('booking add', 'bg_cal_bookings', db()->lastInsertId(), $start . ' ' . $name);
      adm_go('bookings', [], 'Booked: ' . $name . ', ' . $start . '.');
    }
    if (!$bk) adm_go('bookings', [], 'That booking is not there.');
    $cal = adm_cal($bk['calendar_id']);
    if ($act === 'approve' && $bk['status'] === 'pending') {
      db()->prepare("UPDATE bg_cal_bookings SET status = 'booked' WHERE id = ?")->execute([$id]); adm_audit('booking approve', 'bg_cal_bookings', $id);
      if ($cal && function_exists('bgcal_mail')) bgcal_mail($cal, $bk['email'], $cal['name'] . ': booking confirmed', 'Hello ' . $bk['name'] . ",\n\nYour booking for " . bgcal_when($bk) . ($bk['service'] !== '' ? ' (' . $bk['service'] . ')' : '') . " is confirmed.\n");
      adm_go('bookings', [], 'Approved - ' . $bk['name'] . ' is booked.');
    }
    if ($act === 'cancel' && in_array($bk['status'], ['pending', 'booked'], true)) {
      db()->prepare("UPDATE bg_cal_bookings SET status = 'cancelled', cancelled_at = NOW() WHERE id = ?")->execute([$id]); adm_audit('booking cancel', 'bg_cal_bookings', $id);
      if ($cal && function_exists('bgcal_mail')) bgcal_mail($cal, $bk['email'], $cal['name'] . ': booking cancelled', 'Hello ' . $bk['name'] . ",\n\nYour booking for " . bgcal_when($bk) . " has been cancelled. Please get in touch to make another time.\n");
      adm_go('bookings', [], 'Cancelled.');
    }
    if ($act === 'note') { db()->prepare('UPDATE bg_cal_bookings SET admin_note = ? WHERE id = ?')->execute([mb_substr(trim($_POST['note'] ?? ''), 0, 500), $id]); adm_go('bookings', [], 'Note kept.'); }
    adm_go('bookings');
  }
  $cals = adm_cals(); $cid = (int)($_GET['cal'] ?? 0); $st = $_GET['status'] ?? 'open';
  $from = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['from'] ?? '') ? $_GET['from'] : date('Y-m-d'); $to = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['to'] ?? '') ? $_GET['to'] : date('Y-m-d', strtotime('+60 days'));
  $w = ['b.starts_at >= ?', 'b.starts_at < ? + INTERVAL 1 DAY']; $a = [$from . ' 00:00:00', $to];
  if ($cid) { $w[] = 'b.calendar_id = ?'; $a[] = $cid; }
  if ($st === 'open') $w[] = "b.status IN ('booked', 'pending')"; elseif (in_array($st, ['pending', 'booked', 'cancelled'], true)) { $w[] = 'b.status = ?'; $a[] = $st; }
  $q = db()->prepare('SELECT b.*, c.name AS cal FROM bg_cal_bookings b JOIN bg_calendars c ON c.id = b.calendar_id WHERE ' . implode(' AND ', $w) . ' ORDER BY b.starts_at LIMIT 500'); $q->execute($a);
  $opt = '<option value="0">All calendars</option>'; foreach ($cals as $c) $opt .= '<option value="' . (int)$c['id'] . '"' . ($cid === (int)$c['id'] ? ' selected' : '') . '>' . h($c['name']) . '</option>';
  $sto = ''; foreach (['open' => 'Booked + waiting', 'pending' => 'Waiting for approval', 'booked' => 'Booked', 'cancelled' => 'Cancelled', 'all' => 'All'] as $k => $l) $sto .= '<option value="' . $k . '"' . ($st === $k ? ' selected' : '') . '>' . $l . '</option>';
  $b = '<form class="bar" method="get"><input type="hidden" name="p" value="bookings"><select name="cal">' . $opt . '</select><select name="status">' . $sto . '</select><label>From <input type="date" name="from" value="' . h($from) . '"></label><label>To <input type="date" name="to" value="' . h($to) . '"></label><button class="ghost">Show</button></form>';
  $b .= adm_bookings_table($q->fetchAll(), true);
  $copt = ''; foreach ($cals as $c) $copt .= '<option value="' . (int)$c['id'] . '">' . h($c['name']) . '</option>';
  $b .= '<details class="box"><summary>＋ A phone booking</summary><form method="post" class="grid">' . adm_csrf_field() . '<input type="hidden" name="act" value="add"><label>Calendar <select name="calendar_id">' . $copt . '</select></label>'
    . '<label>Day <input type="date" name="d" required></label><label>Time <input type="time" name="t" required></label><label>Minutes <input type="number" name="minutes" value="30" min="5" max="720"></label><label>Service <input name="service" maxlength="80"></label>'
    . '<label>Name <input name="name" required maxlength="120"></label><label>Email <input type="email" name="email" maxlength="200"></label><label>Phone <input name="phone" maxlength="40"></label><label class="wide">Notes <textarea name="notes" rows="2"></textarea></label><button class="go" type="submit">Book it</button></form></details>';
  adm_page('Bookings', $b);
}
function adm_p_closed() {
  adm_need('staff');
  if (adm_posted()) {
    if (!adm_post_ok()) adm_go('closed', [], 'The form had expired - nothing was changed.');
    $cal = adm_cal($_POST['calendar_id'] ?? 0); if (!$cal) adm_go('closed');
    if (($_POST['act'] ?? '') === 'add') {
      $d1 = $_POST['d1'] ?? ''; $d2 = ($_POST['d2'] ?? '') !== '' ? $_POST['d2'] : $d1; $why = mb_substr(trim($_POST['reason'] ?? ''), 0, 200);
      if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $d1) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $d2) || $d2 < $d1) adm_go('closed', [], 'Please give the day (and the last day for several).');
      $n = 0; $q = db()->prepare("INSERT INTO bg_cal_closed (calendar_id, day, reason, source) VALUES (?, ?, ?, 'admin') ON DUPLICATE KEY UPDATE reason = VALUES(reason), source = 'admin'");
      for ($t = strtotime($d1 . ' 12:00:00'); $t <= strtotime($d2 . ' 12:00:00') && $n < 400; $t += 86400) { $q->execute([$cal['id'], date('Y-m-d', $t), $why]); $n++; }
      adm_audit('closed add', 'bg_cal_closed', $cal['id'], $d1 . ($d2 !== $d1 ? ' - ' . $d2 : '') . ' ' . $why); adm_go('closed', [], $n . ' day(s) closed on ' . $cal['name'] . '.');
    }
    if (($_POST['act'] ?? '') === 'open' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $_POST['day'] ?? '')) {
      db()->prepare('DELETE FROM bg_cal_closed WHERE calendar_id = ? AND day = ?')->execute([$cal['id'], $_POST['day']]); adm_audit('closed remove', 'bg_cal_closed', $cal['id'], $_POST['day']); adm_go('closed', [], 'Open again: ' . $_POST['day'] . '.');
    }
    adm_go('closed');
  }
  $b = '';
  foreach (adm_cals() as $c) {
    $q = db()->prepare('SELECT day, reason, source FROM bg_cal_closed WHERE calendar_id = ? AND day >= CURDATE() ORDER BY day'); $q->execute([$c['id']]); $rows = $q->fetchAll();
    $b .= '<h2>' . h($c['name']) . '</h2><table><tr><th>Day</th><th>Why</th><th>Closed by</th><th></th></tr>';
    foreach ($rows as $r) $b .= '<tr><td>' . h($r['day']) . '</td><td>' . h($r['reason']) . '</td><td>' . ($r['source'] === 'admin' ? 'this admin' : 'bitGen Studio') . '</td><td><form method="post" class="inl">' . adm_csrf_field() . '<input type="hidden" name="act" value="open"><input type="hidden" name="calendar_id" value="' . (int)$c['id'] . '"><input type="hidden" name="day" value="' . h($r['day']) . '"><button class="ghost">Open again</button></form></td></tr>';
    if (!$rows) $b .= '<tr><td colspan="4" class="dim">No closed days ahead.</td></tr>';
    $b .= '</table><form method="post" class="bar">' . adm_csrf_field() . '<input type="hidden" name="act" value="add"><input type="hidden" name="calendar_id" value="' . (int)$c['id'] . '"><label>Close <input type="date" name="d1" required></label><label>until <input type="date" name="d2"></label><input name="reason" placeholder="Why (for you)" maxlength="200"><button class="go">Close</button></form>';
  }
  adm_page('Closed days', $b !== '' ? $b : '<p class="dim">No calendars yet.</p>');
}
function adm_p_hours() {
  adm_need('admin');
  $cals = adm_cals(); $cal = adm_cal($_GET['cal'] ?? ($cals[0]['id'] ?? 0)); if (!$cal) { adm_page('Hours & services', '<p class="dim">No calendars yet.</p>'); return; }
  $days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  if (adm_posted()) {
    if (!adm_post_ok()) adm_go('hours', ['cal' => $cal['id']], 'The form had expired - nothing was changed.');
    $pdo = db(); $pdo->beginTransaction();
    try {
      $pdo->prepare('DELETE FROM bg_cal_hours WHERE calendar_id = ?')->execute([$cal['id']]);
      $ins = $pdo->prepare('INSERT INTO bg_cal_hours (calendar_id, weekday, opens, closes) VALUES (?, ?, ?, ?)');
      for ($d = 0; $d < 7; $d++) for ($r = 0; $r < 2; $r++) {
        $a = $_POST['h'][$d][$r][0] ?? ''; $z = $_POST['h'][$d][$r][1] ?? '';
        if (!empty($_POST['open'][$d]) && preg_match('/^\d{2}:\d{2}$/', $a) && preg_match('/^\d{2}:\d{2}$/', $z) && $z > $a) $ins->execute([$cal['id'], $d, $a . ':00', $z . ':00']);
      }
      $pdo->prepare('DELETE FROM bg_cal_services WHERE calendar_id = ?')->execute([$cal['id']]);
      $ins = $pdo->prepare('INSERT INTO bg_cal_services (calendar_id, sort, name, minutes, price) VALUES (?, ?, ?, ?, ?)'); $i = 0;
      foreach ((array)($_POST['sv'] ?? []) as $s) { $n = mb_substr(trim($s['name'] ?? ''), 0, 80); if ($n === '' || $i >= 20) continue; $ins->execute([$cal['id'], $i++, $n, max(5, min(720, (int)($s['mins'] ?? 30))), mb_substr(trim($s['price'] ?? ''), 0, 20)]); }
      $pdo->prepare('UPDATE bg_calendars SET admin_edited = 1, slot_minutes = ?, capacity = ?, buffer_minutes = ?, max_per_day = ?, approve = ?, cancel_hours = ?, send_emails = ?, notify_email = ? WHERE id = ?')
        ->execute([max(5, min(480, (int)$_POST['slot'])), max(1, min(500, (int)$_POST['cap'])), max(0, min(240, (int)$_POST['buffer'])), max(0, min(500, (int)$_POST['maxday'])), !empty($_POST['approve']) ? 1 : 0, max(0, min(720, (int)$_POST['cancel'])), !empty($_POST['emails']) ? 1 : 0, filter_var($_POST['notify'] ?? '', FILTER_VALIDATE_EMAIL) ? $_POST['notify'] : '', $cal['id']]);
      $pdo->commit();
    } catch (Throwable $e) { $pdo->rollBack(); adm_go('hours', ['cal' => $cal['id']], 'Not kept: ' . $e->getMessage()); }
    adm_audit('hours', 'bg_calendars', $cal['id']); adm_go('hours', ['cal' => $cal['id']], 'Kept - the website uses these hours and services now.');
  }
  $q = db()->prepare("SELECT weekday, TIME_FORMAT(opens, '%H:%i') o, TIME_FORMAT(closes, '%H:%i') c FROM bg_cal_hours WHERE calendar_id = ? ORDER BY weekday, opens"); $q->execute([$cal['id']]); $hrs = [];
  foreach ($q as $r) $hrs[(int)$r['weekday']][] = [$r['o'], $r['c']];
  $q = db()->prepare('SELECT name, minutes, price FROM bg_cal_services WHERE calendar_id = ? ORDER BY sort'); $q->execute([$cal['id']]); $svc = $q->fetchAll();
  $b = '<form class="bar" method="get"><input type="hidden" name="p" value="hours"><select name="cal" onchange="this.form.submit()">';
  foreach ($cals as $c) $b .= '<option value="' . (int)$c['id'] . '"' . ((int)$c['id'] === (int)$cal['id'] ? ' selected' : '') . '>' . h($c['name']) . '</option>';
  $b .= '</select><noscript><button class="ghost">Show</button></noscript></form><form method="post">' . adm_csrf_field() . '<h2>Opening hours</h2><table>';
  foreach ([1, 2, 3, 4, 5, 6, 0] as $d) {
    $r = $hrs[$d] ?? []; $b .= '<tr><td><label><input type="checkbox" name="open[' . $d . ']" value="1"' . ($r ? ' checked' : '') . '> ' . $days[$d] . '</label></td>';
    for ($k = 0; $k < 2; $k++) $b .= '<td><input type="time" name="h[' . $d . '][' . $k . '][0]" value="' . h($r[$k][0] ?? ($k ? '' : '09:00')) . '"> – <input type="time" name="h[' . $d . '][' . $k . '][1]" value="' . h($r[$k][1] ?? ($k ? '' : '17:00')) . '"></td>';
    $b .= '</tr>';
  }
  $b .= '</table><h2>Services</h2><table><tr><th>Service</th><th>Minutes</th><th>Price</th></tr>';
  for ($i = 0; $i < count($svc) + 3; $i++) { $s = $svc[$i] ?? ['name' => '', 'minutes' => 30, 'price' => '']; $b .= '<tr><td><input name="sv[' . $i . '][name]" value="' . h($s['name']) . '" maxlength="80"></td><td><input type="number" name="sv[' . $i . '][mins]" value="' . (int)$s['minutes'] . '" min="5" max="720"></td><td><input name="sv[' . $i . '][price]" value="' . h($s['price']) . '" maxlength="20"></td></tr>'; }
  $b .= '</table><h2>Booking rules</h2><div class="grid"><label>Each booking (min) <input type="number" name="slot" value="' . (int)$cal['slot_minutes'] . '"></label><label>People per time <input type="number" name="cap" value="' . (int)$cal['capacity'] . '"></label>'
    . '<label>Buffer (min) <input type="number" name="buffer" value="' . (int)$cal['buffer_minutes'] . '"></label><label>Most a day (0 = no limit) <input type="number" name="maxday" value="' . (int)$cal['max_per_day'] . '"></label>'
    . '<label>Cancel online up to (hours before) <input type="number" name="cancel" value="' . (int)$cal['cancel_hours'] . '"></label><label>E-mails to <input type="email" name="notify" value="' . h($cal['notify_email']) . '"></label>'
    . '<label><input type="checkbox" name="approve" value="1"' . ((int)$cal['approve'] ? ' checked' : '') . '> Bookings wait for approval</label><label><input type="checkbox" name="emails" value="1"' . ((int)$cal['send_emails'] ? ' checked' : '') . '> Send e-mails</label></div>'
    . '<p class="dim">Kept here even when the calendar is uploaded again from bitGen Studio (unless it is told to replace them).</p><button class="go" type="submit">Keep</button></form>';
  adm_page('Hours & services', $b);
}
/* ---------------- the generic tables */
function adm_cell($f, $v) {
  if ($f === null) return h($v);
  if ($f[2] === 'bool') return (int)$v ? '✓' : '';
  if ($f[2] === 'fk' && $v !== null && preg_match('/^[a-z_]+$/', $f[4][0])) { $q = adb()->prepare('SELECT ' . $f[4][1] . ' FROM ' . $f[4][0] . ' WHERE id = ?'); $q->execute([$v]); return h((string)$q->fetchColumn()); }
  return h($v);
}
function adm_field($spec, $col) { foreach ($spec[5] as $f) if ($f[0] === $col) return $f; return null; }
function adm_p_list() {
  $t = $_GET['t'] ?? ''; $sp = adm_spec($t); if (!$sp) adm_go('dashboard'); adm_need($sp[1]);
  [$title, $role, $order, $cols, $search] = $sp; $qs = trim($_GET['q'] ?? ''); $pg = max(1, (int)($_GET['pg'] ?? 1)); $w = '1 = 1'; $a = [];
  if ($qs !== '') { $w = '(' . implode(' OR ', array_map(function ($c) { return $c . ' LIKE ?'; }, $search)) . ')'; foreach ($search as $c) $a[] = '%' . $qs . '%'; }
  foreach (['client_id', 'pet_id', 'order_id', 'product_id'] as $fk) if (isset($_GET[$fk]) && adm_field($sp, $fk)) { $w .= ' AND ' . $fk . ' = ?'; $a[] = (int)$_GET[$fk]; }
  $q = adb()->prepare('SELECT COUNT(*) FROM ' . $t . ' WHERE ' . $w); $q->execute($a); $n = (int)$q->fetchColumn();
  $q = adb()->prepare('SELECT * FROM ' . $t . ' WHERE ' . $w . ' ORDER BY ' . $order . ' LIMIT 50 OFFSET ' . (($pg - 1) * 50)); $q->execute($a);
  $b = '<form class="bar" method="get"><input type="hidden" name="p" value="t"><input type="hidden" name="t" value="' . h($t) . '"><input type="search" name="q" value="' . h($qs) . '" placeholder="Search"><button class="ghost">Search</button><span class="sp"></span><a class="btn go" href="' . h(adm_url('e', ['t' => $t] + array_intersect_key($_GET, ['client_id' => 1, 'pet_id' => 1]))) . '">＋ New</a></form>';
  $b .= '<table><tr>'; foreach ($cols as $c) { $f = adm_field($sp, $c); $b .= '<th>' . h($f ? $f[1] : $c) . '</th>'; } $b .= '<th></th></tr>';
  foreach ($q as $r) {
    $b .= '<tr>'; foreach ($cols as $c) $b .= '<td>' . adm_cell(adm_field($sp, $c), $r[$c]) . '</td>';
    $open = $t === 'clients' ? adm_url('client', ['id' => $r['id']]) : ($t === 'orders' ? adm_url('order', ['id' => $r['id']]) : adm_url('e', ['t' => $t, 'id' => $r['id']]));
    $b .= '<td><a href="' . h($open) . '">Open</a></td></tr>';
  }
  $b .= '</table><p class="dim">' . $n . ' found' . ($n > 50 ? ' · page ' . $pg . ' of ' . ceil($n / 50) . ($pg > 1 ? ' <a href="' . h(adm_url('t', ['t' => $t, 'q' => $qs, 'pg' => $pg - 1])) . '">‹ back</a>' : '') . ($pg * 50 < $n ? ' <a href="' . h(adm_url('t', ['t' => $t, 'q' => $qs, 'pg' => $pg + 1])) . '">next ›</a>' : '') : '') . '</p>';
  adm_page($title, $b);
}
function adm_p_edit() {
  $t = $_GET['t'] ?? ''; $sp = adm_spec($t); if (!$sp) adm_go('dashboard'); adm_need($sp[1]);
  $id = (int)($_GET['id'] ?? 0); $row = null; $msg = '';
  if ($id) { $q = adb()->prepare('SELECT * FROM ' . $t . ' WHERE id = ?'); $q->execute([$id]); $row = $q->fetch(); if (!$row) adm_go('t', ['t' => $t], 'That one is not there.'); }
  if (adm_posted()) {
    if (!adm_post_ok()) $msg = 'The form had expired - please try again.';
    elseif (($_POST['act'] ?? '') === 'delete' && $id) {
      if (!adm_can('admin')) $msg = 'Only an admin can delete.';
      else { try { adb()->prepare('DELETE FROM ' . $t . ' WHERE id = ?')->execute([$id]); adm_audit('delete', $t, $id); adm_go('t', ['t' => $t], 'Deleted.'); } catch (Throwable $e) { $msg = 'Not deleted - other things still use it.'; } }
    } else {
      try {
        $vals = [];
        foreach ($sp[5] as $f) { if (strpos($f[3] ?? '', 'ro') !== false) continue; $vals[$f[0]] = adm_value($f, $_POST[$f[0]] ?? ''); }
        if (array_key_exists('slug', $vals) && (string)$vals['slug'] === '') $vals['slug'] = adm_slugify($vals['name'] ?? '');
        if (array_key_exists('number', $vals) && (string)$vals['number'] === '') $vals['number'] = adm_setting($t === 'invoices' ? 'invoice_prefix' : 'order_prefix', strtoupper(substr($t, 0, 3)) . '-') . str_pad((string)((int)adb()->query('SELECT COALESCE(MAX(id), 0) + 1 FROM ' . $t)->fetchColumn()), 5, '0', STR_PAD_LEFT);
        if ($t === 'client_records' && !$id) $vals['created_by'] = adm_user()['id'];
        if ($id) { adb()->prepare('UPDATE ' . $t . ' SET ' . implode(', ', array_map(function ($c) { return $c . ' = ?'; }, array_keys($vals))) . ' WHERE id = ?')->execute(array_merge(array_values($vals), [$id])); adm_audit('edit', $t, $id); }
        else { adb()->prepare('INSERT INTO ' . $t . ' (' . implode(', ', array_keys($vals)) . ') VALUES (' . implode(', ', array_fill(0, count($vals), '?')) . ')')->execute(array_values($vals)); $id = (int)adb()->lastInsertId(); adm_audit('add', $t, $id); }
        if ($t === 'clients') adm_go('client', ['id' => $id], 'Kept.');
        if ($t === 'orders') adm_go('order', ['id' => $id], 'Kept.');
        adm_go('e', ['t' => $t, 'id' => $id], 'Kept.');
      } catch (PDOException $e) { $msg = $e->getCode() === '23000' ? 'Not kept - one of these is already used by another (an email, code or number), or a link is missing.' : 'Not kept - the database said no.'; }
      catch (RuntimeException $e) { $msg = $e->getMessage(); }
      $row = array_merge($row ?: [], array_map(function ($v) { return is_string($v) ? $v : ''; }, $_POST));
    }
  }
  $b = ($msg !== '' ? '<p class="msg bad" role="alert">' . h($msg) . '</p>' : '') . '<form method="post" class="grid">' . adm_csrf_field();
  foreach ($sp[5] as $f) { $v = $row[$f[0]] ?? ($_GET[$f[0]] ?? ($f[2] === 'bool' && $f[0] === 'active' ? 1 : '')); $b .= '<label class="' . ($f[2] === 'textarea' ? 'wide' : '') . '">' . h($f[1]) . ' ' . adm_input($f, $v) . '</label>'; }
  $b .= '<div class="wide"><button class="go" type="submit">Keep</button> <a href="' . h(adm_url('t', ['t' => $t])) . '">Back to ' . h($sp[0]) . '</a></div></form>';
  if ($id && adm_can('admin')) $b .= '<form method="post" class="del" onsubmit="return confirm(\'Delete this for good?\')">' . adm_csrf_field() . '<input type="hidden" name="act" value="delete"><button class="ghost" type="submit">Delete</button></form>';
  adm_page(($id ? '' : 'New - ') . $sp[0], $b);
}
function adm_p_client() {
  adm_need('staff'); $id = (int)($_GET['id'] ?? 0);
  $q = adb()->prepare('SELECT * FROM clients WHERE id = ?'); $q->execute([$id]); $c = $q->fetch(); if (!$c) adm_go('t', ['t' => 'clients'], 'That client is not there.');
  $name = trim($c['title'] . ' ' . $c['first_name'] . ' ' . $c['last_name']); if ($c['company'] !== '') $name .= ' · ' . $c['company'];
  $b = '<div class="box"><p><b>' . h($c['email'] ?? '') . '</b> · ' . h($c['phone']) . ($c['mobile'] !== '' ? ' · ' . h($c['mobile']) : '') . '<br>' . h(trim($c['address_line1'] . ' ' . $c['address_line2'] . ', ' . $c['city'] . ' ' . $c['state'] . ' ' . $c['postcode'], ' ,'))
    . ($c['emergency_name'] !== '' ? '<br>Emergency: ' . h($c['emergency_name'] . ' ' . $c['emergency_phone']) : '') . '</p>' . ($c['notes'] ? '<p>' . nl2br(h($c['notes'])) . '</p>' : '') . '<a class="btn ghost" href="' . h(adm_url('e', ['t' => 'clients', 'id' => $id])) . '">Edit</a></div>';
  $q = adb()->prepare('SELECT * FROM pets WHERE client_id = ? ORDER BY name'); $q->execute([$id]); $pets = $q->fetchAll();
  $b .= '<h2>Pets <a class="btn ghost" href="' . h(adm_url('e', ['t' => 'pets', 'client_id' => $id])) . '">＋</a></h2>';
  if ($pets) { $b .= '<table><tr><th>Name</th><th>Species</th><th>Breed</th><th>Born</th><th>Microchip</th><th></th></tr>'; foreach ($pets as $p) $b .= '<tr><td>' . h($p['name']) . '</td><td>' . h($p['species']) . '</td><td>' . h($p['breed']) . '</td><td>' . h($p['date_of_birth']) . '</td><td>' . h($p['microchip']) . '</td><td><a href="' . h(adm_url('e', ['t' => 'pets', 'id' => $p['id']])) . '">Open</a></td></tr>'; $b .= '</table>'; }
  $q = adb()->prepare('SELECT r.*, p.name AS pet FROM client_records r LEFT JOIN pets p ON p.id = r.pet_id WHERE r.client_id = ? ORDER BY r.created_at DESC LIMIT 100'); $q->execute([$id]);
  $b .= '<h2>Records <a class="btn ghost" href="' . h(adm_url('e', ['t' => 'client_records', 'client_id' => $id])) . '">＋</a></h2><table><tr><th>When</th><th>Kind</th><th>Title</th><th>Pet</th><th>Follow up</th><th></th></tr>';
  foreach ($q as $r) $b .= '<tr><td>' . h(substr($r['created_at'], 0, 16)) . '</td><td>' . h($r['kind']) . '</td><td>' . h($r['title']) . '</td><td>' . h($r['pet']) . '</td><td>' . h($r['follow_up_on']) . '</td><td><a href="' . h(adm_url('e', ['t' => 'client_records', 'id' => $r['id']])) . '">Open</a></td></tr>';
  $b .= '</table>';
  if (adm_has_cal()) {
    $q = db()->prepare('SELECT b.*, c.name AS cal FROM bg_cal_bookings b JOIN bg_calendars c ON c.id = b.calendar_id WHERE b.client_id = ? OR (b.client_id IS NULL AND b.email = ?) ORDER BY b.starts_at DESC LIMIT 100'); $q->execute([$id, (string)$c['email']]);
    $b .= '<h2>Bookings</h2>' . adm_bookings_table($q->fetchAll(), false);
  }
  $q = adb()->prepare('SELECT * FROM orders WHERE client_id = ? ORDER BY created_at DESC LIMIT 100'); $q->execute([$id]); $orders = $q->fetchAll();
  if ($orders) { $b .= '<h2>Orders</h2><table><tr><th>Number</th><th>When</th><th>Status</th><th>Total</th><th></th></tr>'; foreach ($orders as $o) $b .= '<tr><td>' . h($o['number']) . '</td><td>' . h(substr($o['created_at'], 0, 10)) . '</td><td>' . h($o['status']) . '</td><td>' . h($o['total']) . '</td><td><a href="' . h(adm_url('order', ['id' => $o['id']])) . '">Open</a></td></tr>'; $b .= '</table>'; }
  adm_page($name !== '' ? $name : 'Client', $b);
}
function adm_p_order() {
  adm_need('staff'); $id = (int)($_GET['id'] ?? 0);
  $q = adb()->prepare('SELECT * FROM orders WHERE id = ?'); $q->execute([$id]); $o = $q->fetch(); if (!$o) adm_go('t', ['t' => 'orders'], 'That order is not there.');
  $st = ['pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled', 'refunded'];
  if (adm_posted() && adm_post_ok() && in_array($_POST['status'] ?? '', $st, true)) {
    adb()->prepare('UPDATE orders SET status = ?, tracking = ? WHERE id = ?')->execute([$_POST['status'], mb_substr(trim($_POST['tracking'] ?? $o['tracking']), 0, 120), $id]);
    adb()->prepare('INSERT INTO order_status_history (order_id, status, note, user_id) VALUES (?, ?, ?, ?)')->execute([$id, $_POST['status'], mb_substr(trim($_POST['note'] ?? ''), 0, 500), adm_user()['id']]);
    adm_audit('order status', 'orders', $id, $_POST['status']); adm_go('order', ['id' => $id], 'Status: ' . $_POST['status'] . '.');
  }
  $q = adb()->prepare('SELECT * FROM order_items WHERE order_id = ?'); $q->execute([$id]);
  $b = '<div class="box"><p>' . h($o['email']) . ' · ' . h($o['ship_name']) . ', ' . h(trim($o['ship_line1'] . ' ' . $o['ship_line2'] . ', ' . $o['ship_city'] . ' ' . $o['ship_state'] . ' ' . $o['ship_postcode'] . ' ' . $o['ship_country'], ' ,')) . '<br>Payment: ' . h($o['payment_status']) . ($o['client_id'] ? ' · <a href="' . h(adm_url('client', ['id' => $o['client_id']])) . '">client</a>' : '') . ' · <a href="' . h(adm_url('e', ['t' => 'orders', 'id' => $id])) . '">Edit</a></p></div>';
  $b .= '<table><tr><th>Item</th><th>SKU</th><th>Qty</th><th>Each</th><th>Total</th></tr>';
  foreach ($q as $i) $b .= '<tr><td>' . h($i['name']) . '</td><td>' . h($i['sku']) . '</td><td>' . (int)$i['qty'] . '</td><td>' . h($i['unit_price']) . '</td><td>' . h($i['total']) . '</td></tr>';
  $b .= '<tr><td colspan="4">Subtotal · discount · shipping · tax</td><td>' . h($o['subtotal'] . ' · -' . $o['discount'] . ' · ' . $o['shipping'] . ' · ' . $o['tax']) . '</td></tr><tr><th colspan="4">Total (' . h($o['currency']) . ')</th><th>' . h($o['total']) . '</th></tr></table>';
  $opt = ''; foreach ($st as $s) $opt .= '<option' . ($o['status'] === $s ? ' selected' : '') . '>' . $s . '</option>';
  $b .= '<form method="post" class="bar">' . adm_csrf_field() . '<label>Status <select name="status">' . $opt . '</select></label><input name="tracking" placeholder="Tracking" value="' . h($o['tracking']) . '"><input name="note" placeholder="Note" maxlength="500"><button class="go">Change</button></form>';
  $q = adb()->prepare('SELECT h.*, u.username FROM order_status_history h LEFT JOIN admin_users u ON u.id = h.user_id WHERE h.order_id = ? ORDER BY h.id DESC'); $q->execute([$id]);
  $b .= '<h2>History</h2><table><tr><th>When</th><th>Status</th><th>Note</th><th>By</th></tr>'; foreach ($q as $r) $b .= '<tr><td>' . h($r['created_at']) . '</td><td>' . h($r['status']) . '</td><td>' . h($r['note']) . '</td><td>' . h($r['username']) . '</td></tr>';
  adm_page('Order ' . $o['number'], $b . '</table>');
}
/* ---------------- logins, their history, the audit log, settings, my account */
function adm_p_users() {
  adm_need('admin'); $me = adm_user(); $msg = '';
  if (adm_posted()) {
    if (!adm_post_ok()) $msg = 'The form had expired - please try again.';
    else {
      $act = $_POST['act'] ?? ''; $id = (int)($_POST['id'] ?? 0);
      $q = adb()->prepare('SELECT * FROM admin_users WHERE id = ?'); $q->execute([$id]); $u = $q->fetch();
      $role = $_POST['role'] ?? 'staff'; if (!isset(ADM_ROLES[$role]) || ($role === 'owner' && $me['role'] !== 'owner')) $role = 'staff';
      if ($act === 'add') {
        $un = trim($_POST['username'] ?? ''); $pw = (string)($_POST['password'] ?? '');
        if (!preg_match('/^[A-Za-z0-9_.@-]{3,60}$/', $un)) $msg = 'A username is 3-60 letters, digits or _ . @ -';
        elseif (!adm_password_ok($pw)) $msg = 'A password is at least 10 characters.';
        else { try { adb()->prepare('INSERT INTO admin_users (username, email, full_name, password_hash, role, password_changed_at) VALUES (?, ?, ?, ?, ?, NOW())')->execute([$un, strtolower(trim($_POST['email'] ?? '')), mb_substr(trim($_POST['full_name'] ?? ''), 0, 120), password_hash($pw, PASSWORD_DEFAULT), $role]); adm_audit('login add', 'admin_users', adb()->lastInsertId(), $un . ' ' . $role); adm_go('users', [], 'Login made: ' . $un . '.'); } catch (PDOException $e) { $msg = 'That username is already used.'; } }
      } elseif ($u && ($u['role'] !== 'owner' || $me['role'] === 'owner')) {
        if ($act === 'toggle' && (int)$u['id'] !== (int)$me['id']) { adb()->prepare('UPDATE admin_users SET active = 1 - active WHERE id = ?')->execute([$id]); adm_audit('login on/off', 'admin_users', $id); adm_go('users', [], 'Changed.'); }
        if ($act === 'unlock') { adb()->prepare('UPDATE admin_users SET failed_logins = 0, locked_until = NULL WHERE id = ?')->execute([$id]); adm_audit('login unlock', 'admin_users', $id); adm_go('users', [], 'Unlocked.'); }
        if ($act === 'role' && (int)$u['id'] !== (int)$me['id']) { adb()->prepare('UPDATE admin_users SET role = ? WHERE id = ?')->execute([$role, $id]); adm_audit('login role', 'admin_users', $id, $role); adm_go('users', [], 'Role: ' . $role . '.'); }
        if ($act === 'password') { $pw = (string)($_POST['password'] ?? ''); if (!adm_password_ok($pw)) $msg = 'A password is at least 10 characters.'; else { adb()->prepare('UPDATE admin_users SET password_hash = ?, password_changed_at = NOW(), failed_logins = 0, locked_until = NULL WHERE id = ?')->execute([password_hash($pw, PASSWORD_DEFAULT), $id]); adm_audit('login password', 'admin_users', $id); adm_go('users', [], 'New password kept.'); } }
      } else $msg = 'Only the owner can change an owner\'s login.';
    }
  }
  $ro = function ($cur) use ($me) { $o = ''; foreach (array_keys(ADM_ROLES) as $r) if ($r !== 'owner' || $me['role'] === 'owner') $o .= '<option' . ($cur === $r ? ' selected' : '') . '>' . $r . '</option>'; return $o; };
  $b = ($msg !== '' ? '<p class="msg bad" role="alert">' . h($msg) . '</p>' : '') . '<table><tr><th>Username</th><th>Name</th><th>Role</th><th>Last login</th><th>State</th><th></th></tr>';
  foreach (adb()->query('SELECT * FROM admin_users ORDER BY username') as $u) {
    $f = function ($act, $inner) use ($u) { return '<form method="post" class="inl">' . adm_csrf_field() . '<input type="hidden" name="id" value="' . (int)$u['id'] . '"><input type="hidden" name="act" value="' . $act . '">' . $inner . '</form>'; };
    $locked = $u['locked_until'] && strtotime($u['locked_until']) > time();
    $b .= '<tr><td>' . h($u['username']) . '</td><td>' . h($u['full_name']) . '</td><td>' . $f('role', '<select name="role" onchange="this.form.submit()">' . $ro($u['role']) . '</select>') . '</td><td>' . h($u['last_login_at']) . ' ' . h($u['last_login_ip']) . '</td>'
      . '<td>' . ((int)$u['active'] ? 'on' : 'off') . ($locked ? ' · locked' : '') . '</td><td class="acts">' . $f('toggle', '<button class="ghost">' . ((int)$u['active'] ? 'Turn off' : 'Turn on') . '</button>') . ($locked ? $f('unlock', '<button class="ghost">Unlock</button>') : '')
      . $f('password', '<input type="password" name="password" placeholder="New password" minlength="10"><button class="ghost">Set</button>') . '</td></tr>';
  }
  $b .= '</table><details class="box" open><summary>＋ A new login</summary><form method="post" class="grid">' . adm_csrf_field() . '<input type="hidden" name="act" value="add"><label>Username <input name="username" required maxlength="60"></label><label>Name <input name="full_name" maxlength="120"></label>'
    . '<label>Email <input type="email" name="email" maxlength="200"></label><label>Role <select name="role">' . $ro('staff') . '</select></label><label>Password (10+) <input type="password" name="password" required minlength="10" autocomplete="new-password"></label><button class="go">Make the login</button></form></details>';
  adm_page('Logins', $b);
}
function adm_p_history() {
  adm_need('staff'); $all = adm_can('admin');
  $q = $all ? adb()->query('SELECT * FROM admin_login_history ORDER BY id DESC LIMIT 300') : adb()->prepare('SELECT * FROM admin_login_history WHERE user_id = ? ORDER BY id DESC LIMIT 300');
  if (!$all) $q->execute([adm_user()['id']]);
  $b = '<table><tr><th>When</th><th>Username</th><th>Result</th><th>From</th><th>Browser</th></tr>';
  foreach ($q as $r) $b .= '<tr class="' . ((int)$r['success'] ? '' : 'fail') . '"><td>' . h($r['created_at']) . '</td><td>' . h($r['username']) . '</td><td>' . ((int)$r['success'] ? 'logged in' : h('failed: ' . $r['reason'])) . '</td><td>' . h($r['ip']) . '</td><td class="dim">' . h(mb_substr($r['user_agent'], 0, 80)) . '</td></tr>';
  adm_page('Login history', $b . '</table>');
}
function adm_p_audit() {
  adm_need('admin');
  $b = '<table><tr><th>When</th><th>Who</th><th>Did</th><th>What</th><th>Details</th><th>From</th></tr>';
  foreach (adb()->query('SELECT a.*, u.username FROM admin_audit_log a LEFT JOIN admin_users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 300') as $r) $b .= '<tr><td>' . h($r['created_at']) . '</td><td>' . h($r['username']) . '</td><td>' . h($r['action']) . '</td><td>' . h($r['entity'] . ' ' . $r['entity_id']) . '</td><td>' . h(mb_substr((string)$r['details'], 0, 120)) . '</td><td>' . h($r['ip']) . '</td></tr>';
  adm_page('Audit log', $b . '</table>');
}
function adm_p_settings() {
  adm_need('admin');
  $labels = ['business_name' => 'Business name', 'phone' => 'Phone', 'email' => 'Email', 'address' => 'Address', 'tax_id' => 'ABN / tax number', 'currency' => 'Currency', 'tax_rate' => 'Tax rate %', 'order_prefix' => 'Order numbers start', 'invoice_prefix' => 'Invoice numbers start', 'timezone' => 'Time zone'];
  if (adm_posted() && adm_post_ok()) { $q = adb()->prepare('INSERT INTO settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)'); foreach ($labels as $k => $l) $q->execute([$k, mb_substr(trim($_POST[$k] ?? ''), 0, 500)]); adm_audit('settings'); adm_go('settings', [], 'Kept.'); }
  $b = '<form method="post" class="grid">' . adm_csrf_field(); foreach ($labels as $k => $l) $b .= '<label>' . h($l) . ' <input name="' . $k . '" value="' . h(adm_setting($k)) . '" maxlength="500"></label>';
  adm_page('Settings', $b . '<div class="wide"><button class="go">Keep</button></div></form>');
}
function adm_p_account() {
  adm_need('staff'); $me = adm_user(); $msg = '';
  if (adm_posted()) {
    $p1 = (string)($_POST['new'] ?? '');
    if (!adm_post_ok()) $msg = 'The form had expired - please try again.';
    elseif (!password_verify((string)($_POST['current'] ?? ''), $me['password_hash'])) $msg = 'Your current password is not right.';
    elseif (!adm_password_ok($p1)) $msg = 'A password is at least 10 characters.';
    elseif ($p1 !== (string)($_POST['new2'] ?? '')) $msg = 'The two new passwords are not the same.';
    else { adb()->prepare('UPDATE admin_users SET password_hash = ?, password_changed_at = NOW() WHERE id = ?')->execute([password_hash($p1, PASSWORD_DEFAULT), $me['id']]); session_regenerate_id(true); adm_audit('password', 'admin_users', $me['id']); adm_go('account', [], 'Your new password is kept.'); }
  }
  adm_page('My account', ($msg !== '' ? '<p class="msg bad" role="alert">' . h($msg) . '</p>' : '') . '<p>' . h($me['username']) . ' · ' . h($me['role']) . ' · ' . h($me['email']) . '</p><form method="post" class="grid">' . adm_csrf_field()
    . '<label>Current password <input type="password" name="current" required autocomplete="current-password"></label><label>New password (10+) <input type="password" name="new" required minlength="10" autocomplete="new-password"></label><label>New password again <input type="password" name="new2" required minlength="10" autocomplete="new-password"></label><div class="wide"><button class="go">Change my password</button></div></form>');
}
`;

const ADMIN_INDEX = String.raw`<?php
// 🔐 The admin area - made by bitGen Studio. The first visit makes the owner login (the setup key is in inc/config.php).
require __DIR__ . '/../inc/admin_pages.php';
adm_route((string)($_GET['p'] ?? 'dashboard'));
`;

const ADMIN_CSS = `/* 🔐 The admin area's look - made by bitGen Studio */
:root{--a:#2563eb;--bg:#f5f6f8;--ink:#1f2933;--dim:#6b7280;--line:#dde1e6;--card:#fff;--bad:#b42318;--ok:#067647}
*{box-sizing:border-box}body.adm{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
a{color:var(--a)}h1{font-size:22px;margin:0 0 14px}h2{font-size:17px;margin:22px 0 8px}
.adm-top{display:flex;align-items:center;gap:12px;padding:10px 18px;background:var(--card);border-bottom:1px solid var(--line)}.adm-top .sp,.bar .sp{flex:1}
.adm-wrap{display:flex;min-height:calc(100vh - 52px)}.adm-nav{width:200px;flex:none;padding:12px 8px;background:var(--card);border-right:1px solid var(--line)}
.adm-nav a{display:block;padding:7px 10px;border-radius:6px;color:var(--ink);text-decoration:none}.adm-nav a:hover{background:var(--bg)}.adm-nav a[aria-current]{background:var(--a);color:#fff}
.adm-main{flex:1;padding:20px 24px;min-width:0;overflow-x:auto}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:8px;margin:8px 0}th,td{padding:7px 9px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--dim)}tr.fail td{color:var(--bad)}
input,select,textarea{font:inherit;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:#fff;color:var(--ink);max-width:100%}
button,.btn{font:inherit;padding:6px 12px;border-radius:6px;border:1px solid var(--line);background:#fff;color:var(--ink);cursor:pointer;text-decoration:none;display:inline-block}
.go{background:var(--a);border-color:var(--a);color:#fff}.ghost{background:transparent}
.bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:6px 0 10px}.inl{display:inline-flex;gap:4px;margin:0 4px 4px 0}.acts{white-space:nowrap}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;background:var(--card);padding:14px;border:1px solid var(--line);border-radius:8px}
.grid label{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--dim)}.grid .wide{grid-column:1/-1}.grid label input[type=checkbox]{align-self:flex-start}
.box{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 14px;margin:10px 0}.box summary{cursor:pointer;font-weight:600}
.msg{padding:9px 12px;border-radius:6px;margin:8px 0}.msg.ok{background:#ecfdf3;color:var(--ok)}.msg.bad{background:#fef3f2;color:var(--bad)}.dim{color:var(--dim)}.ro{color:var(--dim)}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}.cardn{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;text-decoration:none;color:var(--ink)}
.cardn b{display:block;font-size:28px;color:var(--a)}.st{padding:2px 8px;border-radius:99px;font-size:12px;background:var(--bg)}.st-pending{background:#fffaeb;color:#b54708}.st-booked{background:#ecfdf3;color:var(--ok)}.st-cancelled{background:#fef3f2;color:var(--bad)}
.del{margin-top:14px}
.adm-login{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.adm-login .card{width:100%;max-width:380px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:28px;box-shadow:0 10px 30px rgba(16,24,40,.08);display:flex;flex-direction:column;gap:12px}
.adm-login .brand{font-weight:700;color:var(--a)}.adm-login h1{margin:0}.adm-login label{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--dim)}.adm-login button{padding:9px}
@media (max-width:760px){.adm-wrap{flex-direction:column}.adm-nav{width:auto;display:flex;flex-wrap:wrap;gap:4px;border-right:0;border-bottom:1px solid var(--line)}.adm-main{padding:14px}}
`;

module.exports = { configPart, ADMIN_DB, ADMIN_LIB, ADMIN_PAGES, ADMIN_INDEX, ADMIN_CSS };
