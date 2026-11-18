// bitGen Studio — lib/siteCalPhp.js (2.846.0, 2.847.0): 📅 inc/calendar.php of a built website (lib/siteBuild.js).
// bgcal('slug', 'lang') prints a booking calendar: the month (‹ ›) -> a day -> (a service) -> its free / taken times -> the form
// (name, email, phone, notes; a CSRF token) -> booked (or waiting for approval) with a link to MANAGE it: see it, ⤓ add it to a
// calendar (.ics - bgcal-ics.php), ✕ cancel it (up to the calendar's cancel hours before). E-mails (PHP mail()) to the visitor
// and the owner when the calendar sends them. PDO prepared statements; a row lock on the calendar so a time never gets more
// bookings than its people per time. The rules of static/sitecal.js slotsFor: opening hours in slot steps, a booking's length
// (its service's, else the slot), the buffer round other bookings, the notice, the days ahead, closed days, the most a day.
// Tim (verbatim): "... so users of the website that is being deleloped can make appointments and see what times are available"
// + 2.847.0 "add the rest of the bookings features".
"use strict";
const PHP_WIDGET = String.raw`<?php
// 📅 Booking calendars - made by bitGen Studio. bgcal('slug') prints one. Settings: bg_calendars, bg_cal_hours,
// bg_cal_services; closed days: bg_cal_closed; bookings: bg_cal_bookings (view bg_cal_upcoming = what is coming).
require_once __DIR__ . '/db.php';
if (session_status() === PHP_SESSION_NONE && !headers_sent()) session_start();
function bgcal_h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function bgcal_token() { if (empty($_SESSION['bgcal_csrf'])) $_SESSION['bgcal_csrf'] = bin2hex(random_bytes(16)); return $_SESSION['bgcal_csrf']; }
function bgcal_base() { return strtok($_SERVER['REQUEST_URI'] ?? '', '?'); }
function bgcal_url($slug, $q) { return bgcal_h(bgcal_base() . '?' . http_build_query(['cal' => $slug] + $q) . '#bgcal-' . $slug); }
function bgcal_full_url($slug, $q) { $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'; return ($https ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? 'localhost') . bgcal_base() . '?' . http_build_query(['cal' => $slug] + $q); }
function bgcal_cal($slug) { $q = db()->prepare('SELECT * FROM bg_calendars WHERE slug = ?'); $q->execute([$slug]); return $q->fetch(); }
function bgcal_hours($id) {
  $q = db()->prepare("SELECT weekday, TIME_FORMAT(opens, '%H:%i') AS o, TIME_FORMAT(closes, '%H:%i:%s') AS c FROM bg_cal_hours WHERE calendar_id = ? ORDER BY weekday, opens");
  $q->execute([$id]); $h = [];
  foreach ($q as $r) $h[(int)$r['weekday']][] = [$r['o'], $r['c'] === '23:59:59' ? '24:00' : substr($r['c'], 0, 5)];
  return $h;
}
function bgcal_services($id) { $q = db()->prepare('SELECT name, minutes, price FROM bg_cal_services WHERE calendar_id = ? ORDER BY sort'); $q->execute([$id]); return $q->fetchAll(); }
/** that range's bookings (booked / waiting) per day: [day => [[startMin, endMin], …]] */
function bgcal_busy($id, $from, $to) {
  $q = db()->prepare("SELECT DATE_FORMAT(starts_at, '%Y-%m-%d') AS d, HOUR(starts_at) * 60 + MINUTE(starts_at) AS s, TIMESTAMPDIFF(MINUTE, starts_at, ends_at) AS n FROM bg_cal_bookings WHERE calendar_id = ? AND status IN ('booked', 'pending') AND starts_at >= ? AND starts_at <= ?");
  $q->execute([$id, $from . ' 00:00:00', $to . ' 23:59:59']); $out = [];
  foreach ($q as $r) $out[$r['d']][] = [(int)$r['s'], (int)$r['s'] + (int)$r['n']];
  return $out;
}
function bgcal_closed($id, $from, $to) { $q = db()->prepare('SELECT day FROM bg_cal_closed WHERE calendar_id = ? AND day BETWEEN ? AND ?'); $q->execute([$id, $from, $to]); return array_flip(array_column($q->fetchAll(), 'day')); }
function bgcal_min($t) { return (int)substr($t, 0, 2) * 60 + (int)substr($t, 3, 2); }
/** a day's times for a booking of $len minutes - static/sitecal.js slotsFor's rules */
function bgcal_slots($cal, $hours, $day, $busy, $closed, $now, $len) {
  $out = []; if (isset($closed[$day])) return $out;
  $step = max(5, (int)$cal['slot_minutes']); $len = max(5, (int)$len); $buf = (int)$cal['buffer_minutes']; $cap = (int)$cal['capacity'];
  $wd = (int)date('w', strtotime($day . ' 12:00:00'));
  $dayN = (int)round((strtotime($day . ' 00:00:00') - strtotime($now->format('Y-m-d') . ' 00:00:00')) / 86400);
  $nowMin = (int)$now->format('G') * 60 + (int)$now->format('i');
  $full = (int)$cal['max_per_day'] > 0 && count($busy) >= (int)$cal['max_per_day'];
  foreach ($hours[$wd] ?? [] as $r) {
    $t0 = bgcal_min($r[0]); $t1 = bgcal_min($r[1]);
    for ($t = $t0; $t + $len <= $t1; $t += $step) {
      $n = 0; foreach ($busy as $b) if ($b[0] - $buf < $t + $len && $b[1] + $buf > $t) $n++;
      $free = $dayN >= 0 && $dayN <= (int)$cal['days_ahead'] && ($dayN * 1440 + $t - $nowMin) >= (int)$cal['lead_hours'] * 60 && $n < $cap && !$full;
      $out[] = ['time' => sprintf('%02d:%02d', intdiv($t, 60), $t % 60), 'free' => $free, 'left' => $full ? 0 : max(0, $cap - $n)];
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
function bgcal_when($b) { return date('l j F Y, H:i', strtotime($b['starts_at'])) . ' – ' . date('H:i', strtotime($b['ends_at'])); }
function bgcal_mail($cal, $to, $subject, $body) {
  if (!(int)$cal['send_emails'] || !filter_var($to, FILTER_VALIDATE_EMAIL)) return false;
  $from = filter_var($cal['from_email'], FILTER_VALIDATE_EMAIL) ? $cal['from_email'] : (filter_var($cal['notify_email'], FILTER_VALIDATE_EMAIL) ? $cal['notify_email'] : '');
  $h = "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n" . ($from ? 'From: ' . $from . "\r\n" : '');
  return @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, $h);
}
function bgcal_booking($cal, $token) {
  if (!preg_match('/^[0-9a-f]{32}$/', (string)$token)) return null;
  $q = db()->prepare('SELECT * FROM bg_cal_bookings WHERE calendar_id = ? AND token = ?'); $q->execute([(int)$cal['id'], $token]); return $q->fetch() ?: null;
}
/** bgcal-ics.php: a booking as a calendar file (.ics) */
function bgcal_ics($token) {
  $q = db()->prepare('SELECT b.*, c.name AS cal_name FROM bg_cal_bookings b JOIN bg_calendars c ON c.id = b.calendar_id WHERE b.token = ?');
  $q->execute([preg_match('/^[0-9a-f]{32}$/', (string)$token) ? $token : '-']); $b = $q->fetch();
  if (!$b) { http_response_code(404); header('Content-Type: text/plain'); echo 'not found'; return; }
  $tzq = db()->prepare('SELECT timezone FROM bg_calendars WHERE id = ?'); $tzq->execute([(int)$b['calendar_id']]); $tz = $tzq->fetchColumn() ?: 'UTC';
  $utc = function ($s) use ($tz) { $d = new DateTime($s, new DateTimeZone($tz)); $d->setTimezone(new DateTimeZone('UTC')); return $d->format('Ymd\THis\Z'); };
  $esc = function ($s) { return str_replace(["\\", ";", ",", "\n"], ["\\\\", "\;", "\,", "\\n"], (string)$s); };
  header('Content-Type: text/calendar; charset=utf-8'); header('Content-Disposition: attachment; filename="booking.ics"');
  echo "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//bitGen Studio//Booking//EN\r\nBEGIN:VEVENT\r\nUID:" . $b['token'] . "@" . ($_SERVER['HTTP_HOST'] ?? 'site') . "\r\nDTSTAMP:" . gmdate('Ymd\THis\Z') . "\r\nDTSTART:" . $utc($b['starts_at']) . "\r\nDTEND:" . $utc($b['ends_at'])
    . "\r\nSUMMARY:" . $esc($b['cal_name'] . ($b['service'] !== '' ? ' - ' . $b['service'] : '')) . "\r\nSTATUS:" . ($b['status'] === 'cancelled' ? 'CANCELLED' : ($b['status'] === 'pending' ? 'TENTATIVE' : 'CONFIRMED')) . "\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
}
function bgcal($slug, $lang = 'en') {
  try { $cal = bgcal_cal($slug); }
  catch (Throwable $e) { echo '<p class="bgcal-msg">The calendar needs its database tables (import schema.sql).</p>'; return; }
  if (!$cal) { echo '<p class="bgcal-msg">This calendar is not in the database yet (import schema.sql).</p>'; return; }
  @date_default_timezone_set($cal['timezone'] ?: 'UTC');
  $id = (int)$cal['id']; $now = new DateTime(); $hours = bgcal_hours($id); $svc = bgcal_services($id);
  $mine = ($_REQUEST['cal'] ?? '') === $slug; $msg = ''; $done = null;
  $si = $mine && isset($_REQUEST['s']) && preg_match('/^\d{1,2}$/', (string)$_REQUEST['s']) && isset($svc[(int)$_REQUEST['s']]) ? (int)$_REQUEST['s'] : null;
  $len = $si !== null ? (int)$svc[$si]['minutes'] : (int)$cal['slot_minutes'];
  $post = $mine && ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST';
  $tokOk = $post && hash_equals(bgcal_token(), (string)($_POST['token'] ?? ''));
  // ---- manage a booking: ?b=TOKEN (see it, add it to a calendar, cancel it)
  $bk = $mine && isset($_REQUEST['b']) ? bgcal_booking($cal, $_REQUEST['b']) : null;
  if ($bk && $post && ($_POST['act'] ?? '') === 'cancel') {
    if (!$tokOk) $msg = 'The form had expired - please try again.';
    elseif (!in_array($bk['status'], ['booked', 'pending'], true)) $msg = 'This booking is already cancelled.';
    elseif ((strtotime($bk['starts_at']) - time()) < 3600 * (int)$cal['cancel_hours']) $msg = 'It is too late to cancel online - please get in touch.';
    else {
      db()->prepare("UPDATE bg_cal_bookings SET status = 'cancelled', cancelled_at = NOW() WHERE id = ?")->execute([(int)$bk['id']]);
      $bk = bgcal_booking($cal, $bk['token']); $msg = 'Your booking is cancelled.';
      bgcal_mail($cal, $bk['email'], $cal['name'] . ': booking cancelled', "Your booking for " . bgcal_when($bk) . " is cancelled.\n");
      bgcal_mail($cal, $cal['notify_email'], $cal['name'] . ': a booking was cancelled', $bk['name'] . ' <' . $bk['email'] . '> cancelled ' . bgcal_when($bk) . ($bk['service'] !== '' ? ' (' . $bk['service'] . ')' : '') . ".\n");
    }
  }
  if ($bk) {
    echo '<div class="bgcal bgcal-' . bgcal_h($slug) . '" id="bgcal-' . bgcal_h($slug) . '"><div class="bgcal-head"><h3 class="bgcal-month">' . bgcal_h($cal['name']) . '</h3></div>';
    if ($msg !== '') echo '<p class="bgcal-msg" role="status">' . bgcal_h($msg) . '</p>';
    $st = ['booked' => 'Booked', 'pending' => 'Waiting for confirmation', 'cancelled' => 'Cancelled'][$bk['status']] ?? $bk['status'];
    echo '<p class="bgcal-msg"><strong>' . bgcal_h(bgcal_when($bk)) . '</strong>' . ($bk['service'] !== '' ? ' · ' . bgcal_h($bk['service']) : '') . '<br>' . bgcal_h($bk['name']) . ' · ' . bgcal_h($st) . '</p>';
    echo '<div class="bgcal-times"><a class="bgcal-slot" href="' . bgcal_h('bgcal-ics.php?b=' . $bk['token']) . '">⤓ Add to my calendar</a><a class="bgcal-slot" href="' . bgcal_url($slug, []) . '">Book another time</a></div>';
    if (in_array($bk['status'], ['booked', 'pending'], true) && (strtotime($bk['starts_at']) - time()) >= 3600 * (int)$cal['cancel_hours'])
      echo '<form class="bgcal-form" method="post" action="' . bgcal_url($slug, ['b' => $bk['token']]) . '"><input type="hidden" name="cal" value="' . bgcal_h($slug) . '"><input type="hidden" name="b" value="' . bgcal_h($bk['token']) . '"><input type="hidden" name="act" value="cancel"><input type="hidden" name="token" value="' . bgcal_token() . '"><button class="bgcal-btn" type="submit">Cancel this booking</button></form>';
    echo '</div>'; return;
  }
  // ---- book a time
  if ($post && ($_POST['act'] ?? 'book') === 'book') {
    $day = $_POST['d'] ?? ''; $time = $_POST['t'] ?? ''; $name = trim($_POST['name'] ?? ''); $email = trim($_POST['email'] ?? '');
    $phone = trim($_POST['phone'] ?? ''); $notes = trim($_POST['notes'] ?? '');
    if (!$tokOk) $msg = 'The form had expired - please choose the time again.';
    elseif (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $day) || !preg_match('/^\d{2}:\d{2}$/', $time) || (count($svc) && $si === null)) $msg = 'Please choose a day and a time.';
    elseif ($name === '' || mb_strlen($name) > 120 || !filter_var($email, FILTER_VALIDATE_EMAIL)) $msg = 'Please give your name and a valid email address.';
    else {
      $pdo = db(); $pdo->beginTransaction();
      try {
        $pdo->prepare('SELECT id FROM bg_calendars WHERE id = ? FOR UPDATE')->execute([$id]);   // one booking at a time
        $busy = bgcal_busy($id, $day, $day); $closed = bgcal_closed($id, $day, $day); $free = false;
        foreach (bgcal_slots($cal, $hours, $day, $busy[$day] ?? [], $closed, $now, $len) as $s) if ($s['time'] === $time && $s['free']) $free = true;
        if ($free) {
          $start = $day . ' ' . $time . ':00'; $end = date('Y-m-d H:i:s', strtotime($start) + 60 * $len); $tok = bin2hex(random_bytes(16));
          $status = (int)$cal['approve'] ? 'pending' : 'booked';
          $pdo->prepare('INSERT INTO bg_cal_bookings (calendar_id, starts_at, ends_at, name, email, phone, notes, service, status, token, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
              ->execute([$id, $start, $end, mb_substr($name, 0, 120), mb_substr($email, 0, 200), mb_substr($phone, 0, 40), mb_substr($notes, 0, 4000), $si !== null ? $svc[$si]['name'] : '', $status, $tok, $_SERVER['REMOTE_ADDR'] ?? '']);
          $pdo->commit(); unset($_SESSION['bgcal_csrf']);
          $done = ['token' => $tok, 'status' => $status, 'starts_at' => $start, 'ends_at' => $end];
          $manage = bgcal_full_url($slug, ['b' => $tok]);
          bgcal_mail($cal, $email, $cal['name'] . ($status === 'pending' ? ': booking received' : ': booking confirmed'), "Hello $name,\n\n" . ($status === 'pending' ? 'We have your booking request for ' : 'You are booked for ') . bgcal_when($done) . ($si !== null ? ' (' . $svc[$si]['name'] . ')' : '') . ".\n" . ($status === 'pending' ? "We will confirm it soon.\n" : '') . "\nSee, add to your calendar or cancel it: $manage\n");
          bgcal_mail($cal, $cal['notify_email'], $cal['name'] . ': new booking' . ($status === 'pending' ? ' to confirm' : ''), "$name <$email>" . ($phone !== '' ? ", $phone" : '') . "\n" . bgcal_when($done) . ($si !== null ? ' (' . $svc[$si]['name'] . ')' : '') . "\n" . ($notes !== '' ? "\n$notes\n" : ''));
          $msg = ($status === 'pending' ? 'Thank you, ' . $name . ' - your request for ' : 'Booked: ') . bgcal_when($done) . ($status === 'pending' ? ' is waiting for confirmation.' : '. Thank you, ' . $name . '.');
        } else { $pdo->rollBack(); $msg = 'Sorry - that time has just been taken. Please choose another.'; }
      } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); $msg = 'The booking could not be saved - please try again.'; }
    }
  }
  $m = $mine && preg_match('/^\d{4}-\d{2}$/', $_GET['m'] ?? '') ? $_GET['m'] : $now->format('Y-m');
  $d = $mine && !$done && preg_match('/^\d{4}-\d{2}-\d{2}$/', $_REQUEST['d'] ?? '') ? $_REQUEST['d'] : null;
  $t = $mine && !$done && $d && preg_match('/^\d{2}:\d{2}$/', $_REQUEST['t'] ?? '') ? $_REQUEST['t'] : null;
  if ($d) $m = substr($d, 0, 7);
  [$mn, $dn] = bgcal_names($lang);
  $first = strtotime($m . '-01 12:00:00'); $ws = (int)$cal['week_start']; $off = ((int)date('w', $first) - $ws + 7) % 7;
  $start = strtotime('-' . $off . ' days', $first); $last = strtotime('+41 days', $start);
  $busy = bgcal_busy($id, date('Y-m-d', $start), date('Y-m-d', $last)); $closed = bgcal_closed($id, date('Y-m-d', $start), date('Y-m-d', $last));
  $shortest = $len; if ($si === null && count($svc)) { $shortest = PHP_INT_MAX; foreach ($svc as $v) $shortest = min($shortest, (int)$v['minutes']); }
  $prev = date('Y-m', strtotime('-1 month', $first)); $next = date('Y-m', strtotime('+1 month', $first));
  $keep = $si !== null ? ['s' => $si] : [];
  echo '<div class="bgcal bgcal-' . bgcal_h($slug) . '" id="bgcal-' . bgcal_h($slug) . '"><div class="bgcal-head">';
  echo '<a class="bgcal-nav" href="' . bgcal_url($slug, ['m' => $prev] + $keep) . '" aria-label="Previous month">‹</a>';
  echo '<h3 class="bgcal-month">' . bgcal_h($mn[(int)date('n', $first)] . ' ' . date('Y', $first)) . '</h3>';
  echo '<a class="bgcal-nav" href="' . bgcal_url($slug, ['m' => $next] + $keep) . '" aria-label="Next month">›</a></div><div class="bgcal-grid">';
  for ($i = 0; $i < 7; $i++) echo '<span class="bgcal-wd">' . bgcal_h($dn[($ws + $i) % 7]) . '</span>';
  $today = $now->format('Y-m-d');
  for ($i = 0; $i < 42; $i++) {
    $ts = strtotime('+' . $i . ' days', $start); $iso = date('Y-m-d', $ts); $in = date('Y-m', $ts) === $m;
    $free = false; if ($in) foreach (bgcal_slots($cal, $hours, $iso, $busy[$iso] ?? [], $closed, $now, $shortest) as $s) if ($s['free']) { $free = true; break; }
    $cls = !$in || $iso < $today ? 'past' : ($free ? 'open' : 'full'); if ($iso === $today) $cls .= ' today'; if ($iso === $d) $cls .= ' sel';
    if ($in && $free) echo '<a class="bgcal-day ' . $cls . '" href="' . bgcal_url($slug, ['d' => $iso] + $keep) . '">' . date('j', $ts) . '</a>';
    else echo '<span class="bgcal-day ' . $cls . '">' . date('j', $ts) . '</span>';
  }
  echo '</div>';
  if ($msg !== '') echo '<p class="bgcal-msg" role="status">' . bgcal_h($msg) . '</p>';
  if ($done) echo '<div class="bgcal-times"><a class="bgcal-slot" href="' . bgcal_url($slug, ['b' => $done['token']]) . '">See or cancel my booking</a><a class="bgcal-slot" href="' . bgcal_h('bgcal-ics.php?b=' . $done['token']) . '">⤓ Add to my calendar</a></div>';
  if ($d && count($svc) && $si === null) {
    echo '<div class="bgcal-times">';
    foreach ($svc as $i => $v) echo '<a class="bgcal-slot" href="' . bgcal_url($slug, ['d' => $d, 's' => $i]) . '">' . bgcal_h($v['name']) . ' · ' . (int)$v['minutes'] . ' min' . ($v['price'] !== '' ? ' · ' . bgcal_h($v['price']) : '') . '</a>';
    echo '</div>';
  } elseif ($d) {
    echo '<div class="bgcal-times">' . ($si !== null ? '<strong style="width:100%">' . bgcal_h($svc[$si]['name']) . ' · ' . (int)$svc[$si]['minutes'] . ' min</strong>' : '');
    foreach (bgcal_slots($cal, $hours, $d, $busy[$d] ?? [], $closed, $now, $len) as $s) {
      if ($s['free']) echo '<a class="bgcal-slot' . ($s['time'] === $t ? ' sel' : '') . '" href="' . bgcal_url($slug, ['d' => $d, 't' => $s['time']] + $keep) . '">' . bgcal_h($s['time']) . ((int)$cal['capacity'] > 1 ? ' (' . $s['left'] . ')' : '') . '</a>';
      else echo '<span class="bgcal-slot taken">' . bgcal_h($s['time']) . '</span>';
    }
    echo '</div>';
  }
  if ($d && $t && (!count($svc) || $si !== null)) {
    echo '<form class="bgcal-form" method="post" action="' . bgcal_url($slug, ['d' => $d, 't' => $t] + $keep) . '">';
    echo '<input type="hidden" name="cal" value="' . bgcal_h($slug) . '"><input type="hidden" name="act" value="book"><input type="hidden" name="d" value="' . bgcal_h($d) . '"><input type="hidden" name="t" value="' . bgcal_h($t) . '"><input type="hidden" name="token" value="' . bgcal_token() . '">' . ($si !== null ? '<input type="hidden" name="s" value="' . $si . '">' : '');
    echo '<strong>' . bgcal_h(date('l j F Y', strtotime($d)) . ' · ' . $t . ($si !== null ? ' · ' . $svc[$si]['name'] : '')) . '</strong>';
    echo '<input name="name" required maxlength="120" placeholder="Your name"><input name="email" type="email" required maxlength="200" placeholder="Email">';
    if ((int)$cal['ask_phone']) echo '<input name="phone" maxlength="40" placeholder="Phone">';
    if ((int)$cal['ask_notes']) echo '<textarea name="notes" rows="3" maxlength="4000" placeholder="Anything we should know?"></textarea>';
    echo '<button class="bgcal-btn" type="submit">' . ((int)$cal['approve'] ? 'Request this time' : 'Book') . '</button></form>';
  }
  echo '</div>';
}
`;
/** bgcal-ics.php - a booking as a calendar file */
const PHP_ICS = String.raw`<?php
require __DIR__ . '/inc/calendar.php';
bgcal_ics($_GET['b'] ?? '');
`;
module.exports = { PHP_WIDGET, PHP_ICS };
