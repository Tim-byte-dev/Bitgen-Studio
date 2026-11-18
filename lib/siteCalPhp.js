// bitGen Studio — lib/siteCalPhp.js (2.846.0): 📅 inc/calendar.php of a built website (lib/siteBuild.js) - bgcal('slug', 'lang')
// prints a booking calendar: the month (‹ ›), a day's free times, the form (name, email, phone, notes; a CSRF token), booked -
// PDO prepared statements, a row lock so a time is never booked twice (or more than its people per time). The rules of
// static/sitecal.js slotsFor (opening hours in slot steps, notice, days ahead, closed days).
// Tim (verbatim): "... so users of the website that is being deleloped can make appointments and see what times are available".
"use strict";
  /** inc/calendar.php - bgcal('slug', 'lang') prints the calendar: month -> day -> time -> the form -> booked */
const PHP_WIDGET = `<?php
// 📅 Booking calendars - made by bitGen Studio. bgcal('slug') prints one; its settings are in bg_calendars / bg_cal_hours,
// closed days in bg_cal_closed, the bookings in bg_cal_bookings (view bg_cal_upcoming = what is coming).
require_once __DIR__ . '/db.php';
if (session_status() === PHP_SESSION_NONE) session_start();
function bgcal_h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function bgcal_token() { if (empty($_SESSION['bgcal_csrf'])) $_SESSION['bgcal_csrf'] = bin2hex(random_bytes(16)); return $_SESSION['bgcal_csrf']; }
function bgcal_url($slug, $q) { $base = strtok($_SERVER['REQUEST_URI'] ?? '', '?'); return bgcal_h($base . '?' . http_build_query(['cal' => $slug] + $q) . '#bgcal-' . $slug); }
function bgcal_taken($id, $from, $to) {
  $q = db()->prepare("SELECT DATE_FORMAT(starts_at, '%Y-%m-%d') AS d, DATE_FORMAT(starts_at, '%H:%i') AS t, COUNT(*) AS n FROM bg_cal_bookings WHERE calendar_id = ? AND status = 'booked' AND starts_at >= ? AND starts_at < ? GROUP BY d, t");
  $q->execute([$id, $from . ' 00:00:00', $to . ' 23:59:59']); $out = [];
  foreach ($q as $r) $out[$r['d']][$r['t']] = (int)$r['n'];
  return $out;
}
function bgcal_closed($id, $from, $to) {
  $q = db()->prepare('SELECT day FROM bg_cal_closed WHERE calendar_id = ? AND day BETWEEN ? AND ?'); $q->execute([$id, $from, $to]);
  return array_flip(array_column($q->fetchAll(), 'day'));
}
function bgcal_slots($cal, $hours, $day, $taken, $closed, $now) {
  $out = []; if (isset($closed[$day])) return $out;
  $step = max(5, (int)$cal['slot_minutes']); $wd = (int)date('w', strtotime($day . ' 12:00:00'));
  $dayN = (int)round((strtotime($day . ' 00:00:00') - strtotime($now->format('Y-m-d') . ' 00:00:00')) / 86400);
  $nowMin = (int)$now->format('G') * 60 + (int)$now->format('i');
  foreach ($hours[$wd] ?? [] as $r) {
    [$a, $b] = $r; $t0 = (int)substr($a, 0, 2) * 60 + (int)substr($a, 3, 2); $t1 = (int)substr($b, 0, 2) * 60 + (int)substr($b, 3, 2); if ($b === '23:59:59') $t1 = 1440;
    for ($t = $t0; $t + $step <= $t1; $t += $step) {
      $k = sprintf('%02d:%02d', intdiv($t, 60), $t % 60); $n = $taken[$k] ?? 0;
      $free = $dayN >= 0 && $dayN <= (int)$cal['days_ahead'] && ($dayN * 1440 + $t - $nowMin) >= (int)$cal['lead_hours'] * 60 && $n < (int)$cal['capacity'];
      $out[] = ['time' => $k, 'free' => $free, 'left' => max(0, (int)$cal['capacity'] - $n)];
    }
  }
  return $out;
}
function bgcal_names($lang) {
  $m = []; $d = [];
  for ($i = 1; $i <= 12; $i++) $m[$i] = date('F', mktime(12, 0, 0, $i, 1, 2023));
  for ($i = 0; $i < 7; $i++) $d[$i] = date('D', mktime(12, 0, 0, 1, 1 + $i, 2023));
  if (class_exists('IntlDateFormatter')) {
    $fm = new IntlDateFormatter($lang, IntlDateFormatter::NONE, IntlDateFormatter::NONE, 'UTC', null, 'LLLL');
    $fd = new IntlDateFormatter($lang, IntlDateFormatter::NONE, IntlDateFormatter::NONE, 'UTC', null, 'EEE');
    for ($i = 1; $i <= 12; $i++) { $v = $fm->format(gmmktime(12, 0, 0, $i, 1, 2023)); if ($v) $m[$i] = $v; }
    for ($i = 0; $i < 7; $i++) { $v = $fd->format(gmmktime(12, 0, 0, 1, 1 + $i, 2023)); if ($v) $d[$i] = $v; }
  }
  return [$m, $d];
}
function bgcal($slug, $lang = 'en') {
  try { $q = db()->prepare('SELECT * FROM bg_calendars WHERE slug = ?'); $q->execute([$slug]); $cal = $q->fetch(); }
  catch (Throwable $e) { echo '<p class="bgcal-msg">The calendar needs its database tables (import schema.sql).</p>'; return; }
  if (!$cal) { echo '<p class="bgcal-msg">This calendar is not in the database yet (import schema.sql).</p>'; return; }
  @date_default_timezone_set($cal['timezone'] ?: 'UTC');
  $id = (int)$cal['id']; $now = new DateTime(); $hours = [];
  $q = db()->prepare('SELECT weekday, TIME_FORMAT(opens, \\'%H:%i\\') AS o, TIME_FORMAT(closes, \\'%H:%i:%s\\') AS c FROM bg_cal_hours WHERE calendar_id = ? ORDER BY weekday, opens');
  $q->execute([$id]); foreach ($q as $r) $hours[(int)$r['weekday']][] = [$r['o'], $r['c'] === '23:59:59' ? '23:59:59' : substr($r['c'], 0, 5)];
  $mine = ($_REQUEST['cal'] ?? '') === $slug; $msg = ''; $ok = false;
  if ($mine && ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $day = $_POST['d'] ?? ''; $time = $_POST['t'] ?? ''; $name = trim($_POST['name'] ?? ''); $email = trim($_POST['email'] ?? '');
    $phone = trim($_POST['phone'] ?? ''); $notes = trim($_POST['notes'] ?? '');
    if (!hash_equals(bgcal_token(), (string)($_POST['token'] ?? ''))) $msg = 'The form had expired - please choose the time again.';
    elseif (!preg_match('/^\\d{4}-\\d{2}-\\d{2}$/', $day) || !preg_match('/^\\d{2}:\\d{2}$/', $time)) $msg = 'Please choose a day and a time.';
    elseif ($name === '' || mb_strlen($name) > 120 || !filter_var($email, FILTER_VALIDATE_EMAIL)) $msg = 'Please give your name and a valid email address.';
    else {
      $pdo = db(); $pdo->beginTransaction();
      try {
        $pdo->prepare('SELECT id FROM bg_calendars WHERE id = ? FOR UPDATE')->execute([$id]);   // one booking at a time: a time is never booked twice
        $taken = bgcal_taken($id, $day, $day); $closed = bgcal_closed($id, $day, $day); $free = false;
        foreach (bgcal_slots($cal, $hours, $day, $taken[$day] ?? [], $closed, $now) as $s) if ($s['time'] === $time && $s['free']) $free = true;
        if ($free) {
          $start = $day . ' ' . $time . ':00'; $end = date('Y-m-d H:i:s', strtotime($start) + 60 * (int)$cal['slot_minutes']);
          $pdo->prepare('INSERT INTO bg_cal_bookings (calendar_id, starts_at, ends_at, name, email, phone, notes, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
              ->execute([$id, $start, $end, mb_substr($name, 0, 120), mb_substr($email, 0, 200), mb_substr($phone, 0, 40), mb_substr($notes, 0, 4000), $_SERVER['REMOTE_ADDR'] ?? '']);
          $pdo->commit(); $ok = true; $msg = 'Booked: ' . date('l j F Y', strtotime($day)) . ' at ' . $time . '. Thank you, ' . $name . '.';
          unset($_SESSION['bgcal_csrf']);
        } else { $pdo->rollBack(); $msg = 'Sorry - that time has just been taken. Please choose another.'; }
      } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); $msg = 'The booking could not be saved - please try again.'; }
    }
  }
  $m = $mine && preg_match('/^\\d{4}-\\d{2}$/', $_GET['m'] ?? '') ? $_GET['m'] : $now->format('Y-m');
  $d = $mine && !$ok && preg_match('/^\\d{4}-\\d{2}-\\d{2}$/', $_REQUEST['d'] ?? '') ? $_REQUEST['d'] : null;
  $t = $mine && !$ok && $d && preg_match('/^\\d{2}:\\d{2}$/', $_REQUEST['t'] ?? '') ? $_REQUEST['t'] : null;
  if ($d) $m = substr($d, 0, 7);
  [$mn, $dn] = bgcal_names($lang);
  $first = strtotime($m . '-01 12:00:00'); $ws = (int)$cal['week_start']; $off = ((int)date('w', $first) - $ws + 7) % 7;
  $start = strtotime('-' . $off . ' days', $first); $last = strtotime('+41 days', $start);
  $taken = bgcal_taken($id, date('Y-m-d', $start), date('Y-m-d', $last)); $closed = bgcal_closed($id, date('Y-m-d', $start), date('Y-m-d', $last));
  $prev = date('Y-m', strtotime('-1 month', $first)); $next = date('Y-m', strtotime('+1 month', $first));
  echo '<div class="bgcal bgcal-' . bgcal_h($slug) . '" id="bgcal-' . bgcal_h($slug) . '"><div class="bgcal-head">';
  echo '<a class="bgcal-nav" href="' . bgcal_url($slug, ['m' => $prev]) . '" aria-label="Previous month">‹</a>';
  echo '<h3 class="bgcal-month">' . bgcal_h($mn[(int)date('n', $first)] . ' ' . date('Y', $first)) . '</h3>';
  echo '<a class="bgcal-nav" href="' . bgcal_url($slug, ['m' => $next]) . '" aria-label="Next month">›</a></div><div class="bgcal-grid">';
  for ($i = 0; $i < 7; $i++) echo '<span class="bgcal-wd">' . bgcal_h($dn[($ws + $i) % 7]) . '</span>';
  $today = $now->format('Y-m-d');
  for ($i = 0; $i < 42; $i++) {
    $ts = strtotime('+' . $i . ' days', $start); $iso = date('Y-m-d', $ts); $in = date('Y-m', $ts) === $m;
    $sl = $in ? bgcal_slots($cal, $hours, $iso, $taken[$iso] ?? [], $closed, $now) : [];
    $free = false; foreach ($sl as $s) if ($s['free']) $free = true;
    $cls = !$in || $iso < $today ? 'past' : ($free ? 'open' : 'full'); if ($iso === $today) $cls .= ' today'; if ($iso === $d) $cls .= ' sel';
    if ($in && $free) echo '<a class="bgcal-day ' . $cls . '" href="' . bgcal_url($slug, ['d' => $iso]) . '">' . date('j', $ts) . '</a>';
    else echo '<span class="bgcal-day ' . $cls . '">' . date('j', $ts) . '</span>';
  }
  echo '</div>';
  if ($msg !== '') echo '<p class="bgcal-msg" role="status">' . bgcal_h($msg) . '</p>';
  if ($d) {
    echo '<div class="bgcal-times">';
    foreach (bgcal_slots($cal, $hours, $d, $taken[$d] ?? [], $closed, $now) as $s) {
      if ($s['free']) echo '<a class="bgcal-slot' . ($s['time'] === $t ? ' sel' : '') . '" href="' . bgcal_url($slug, ['d' => $d, 't' => $s['time']]) . '">' . bgcal_h($s['time']) . ((int)$cal['capacity'] > 1 ? ' (' . $s['left'] . ')' : '') . '</a>';
      else echo '<span class="bgcal-slot taken">' . bgcal_h($s['time']) . '</span>';
    }
    echo '</div>';
  }
  if ($d && $t) {
    echo '<form class="bgcal-form" method="post" action="' . bgcal_url($slug, ['d' => $d, 't' => $t]) . '">';
    echo '<input type="hidden" name="cal" value="' . bgcal_h($slug) . '"><input type="hidden" name="d" value="' . bgcal_h($d) . '"><input type="hidden" name="t" value="' . bgcal_h($t) . '"><input type="hidden" name="token" value="' . bgcal_token() . '">';
    echo '<strong>' . bgcal_h(date('l j F Y', strtotime($d)) . ' · ' . $t) . '</strong>';
    echo '<input name="name" required maxlength="120" placeholder="Your name"><input name="email" type="email" required maxlength="200" placeholder="Email">';
    if ((int)$cal['ask_phone']) echo '<input name="phone" maxlength="40" placeholder="Phone">';
    if ((int)$cal['ask_notes']) echo '<textarea name="notes" rows="3" maxlength="4000" placeholder="Anything we should know?"></textarea>';
    echo '<button class="bgcal-btn" type="submit">Book</button></form>';
  }
  echo '</div>';
}
`;
module.exports = { PHP_WIDGET };
