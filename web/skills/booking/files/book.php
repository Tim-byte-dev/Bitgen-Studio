<?php
// bitGen web skill: 📅 booking widget - the free times and the booking itself, from the CRM's booking calendar (bg_calendars,
// bg_cal_hours (0 = Sunday), bg_cal_services, bg_cal_closed, bg_cal_bookings). The same rules as the site's booking calendar: the
// opening hours, the step, days ahead, the notice (lead hours), how many at once (capacity) with the buffer, the most a day.
//   GET  book.php?cal=<slug>&info=1                 {ok, name, services, slot, ahead, askPhone, askNotes}
//   GET  book.php?cal=<slug>&day=YYYY-MM-DD&service=i {ok, closed, times [{time, free}]}
//   POST book.php?cal=<slug>  {day, time, service, name, email, phone, notes, website}  -> {ok, message}  (checked again, locked)
require_once __DIR__ . '/inc/bg-db.php';
header('Cache-Control: no-store');
$slug = preg_replace('/[^a-z0-9_-]/', '', strtolower((string)($_GET['cal'] ?? 'bookings')));
try {
  $db = bg_db();
  $st = $db->prepare('SELECT * FROM bg_calendars WHERE slug = ?'); $st->execute([$slug]); $cal = $st->fetch();
} catch (Throwable $e) { error_log('book: ' . $e->getMessage()); bg_json(['ok' => false, 'message' => 'Booking is not open yet.'], 503); }
if (!$cal) bg_json(['ok' => false, 'message' => 'Booking is not open yet.'], 404);
if (@date_default_timezone_set((string)$cal['timezone']) === false) date_default_timezone_set('UTC');
$id = (int)$cal['id'];
$st = $db->prepare('SELECT name, minutes, price FROM bg_cal_services WHERE calendar_id = ? ORDER BY sort'); $st->execute([$id]); $services = $st->fetchAll();
$hours = [];
$st = $db->prepare("SELECT weekday, TIME_FORMAT(opens, '%H:%i') AS o, TIME_FORMAT(closes, '%H:%i:%s') AS c FROM bg_cal_hours WHERE calendar_id = ? ORDER BY weekday, opens"); $st->execute([$id]);
foreach ($st as $r) $hours[(int)$r['weekday']][] = [$r['o'], $r['c'] === '23:59:59' ? '24:00' : substr($r['c'], 0, 5)];
if (!$hours) for ($d = 1; $d <= 5; $d++) $hours[$d] = [['09:00', '17:00']];   // none set yet: Monday - Friday 9 - 5
$mins = fn($t) => (int)substr($t, 0, 2) * 60 + (int)substr($t, 3, 2);
$lenOf = function ($i) use ($services, $cal) { $s = $services[(int)$i] ?? null; return max(5, $s ? (int)$s['minutes'] : (int)$cal['slot_minutes']); };
function bg_book_times($db, $cal, $hours, $day, $len, $mins) {
  $id = (int)$cal['id'];
  $c = $db->prepare('SELECT 1 FROM bg_cal_closed WHERE calendar_id = ? AND day = ?'); $c->execute([$id, $day]);
  if ($c->fetchColumn()) return ['closed' => true, 'times' => []];
  $b = $db->prepare("SELECT HOUR(starts_at) * 60 + MINUTE(starts_at) AS s, TIMESTAMPDIFF(MINUTE, starts_at, ends_at) AS n FROM bg_cal_bookings WHERE calendar_id = ? AND status IN ('booked', 'pending') AND starts_at >= ? AND starts_at <= ?");
  $b->execute([$id, $day . ' 00:00:00', $day . ' 23:59:59']); $busy = [];
  foreach ($b as $r) $busy[] = [(int)$r['s'], (int)$r['s'] + (int)$r['n']];
  $now = new DateTime('now');
  $step = max(5, (int)$cal['slot_minutes']); $buf = (int)$cal['buffer_minutes']; $cap = max(1, (int)$cal['capacity']);
  $wd = (int)date('w', strtotime($day . ' 12:00:00'));
  $dayN = (int)round((strtotime($day . ' 00:00:00') - strtotime($now->format('Y-m-d') . ' 00:00:00')) / 86400);
  $nowMin = (int)$now->format('G') * 60 + (int)$now->format('i');
  $full = (int)$cal['max_per_day'] > 0 && count($busy) >= (int)$cal['max_per_day'];
  $out = [];
  foreach ($hours[$wd] ?? [] as $r) {
    $t0 = $mins($r[0]); $t1 = $mins($r[1]);
    for ($t = $t0; $t + $len <= $t1; $t += $step) {
      $n = 0; foreach ($busy as $x) if ($x[0] - $buf < $t + $len && $x[1] + $buf > $t) $n++;
      $free = $dayN >= 0 && $dayN <= (int)$cal['days_ahead'] && ($dayN * 1440 + $t - $nowMin) >= (int)$cal['lead_hours'] * 60 && $n < $cap && !$full;
      $out[] = ['time' => sprintf('%02d:%02d', intdiv($t, 60), $t % 60), 'free' => $free];
    }
  }
  return ['closed' => !($hours[$wd] ?? null), 'times' => $out];
}
$okDay = fn($d) => is_string($d) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) && checkdate((int)substr($d, 5, 2), (int)substr($d, 8, 2), (int)substr($d, 0, 4));
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  if (isset($_GET['info'])) bg_json(['ok' => true, 'name' => $cal['name'], 'slot' => (int)$cal['slot_minutes'], 'ahead' => (int)$cal['days_ahead'], 'askPhone' => (bool)$cal['ask_phone'], 'askNotes' => (bool)$cal['ask_notes'],
    'services' => array_map(fn($s) => ['name' => $s['name'], 'minutes' => (int)$s['minutes'], 'price' => $s['price']], $services)]);
  $day = (string)($_GET['day'] ?? ''); if (!$okDay($day)) bg_json(['ok' => false, 'message' => 'Pick a day.'], 400);
  bg_json(['ok' => true] + bg_book_times($db, $cal, $hours, $day, $lenOf($_GET['service'] ?? 0), $mins));
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') bg_json(['ok' => false, 'message' => 'GET or POST only'], 405);
$in = json_decode(file_get_contents('php://input'), true); if (!is_array($in)) bg_json(['ok' => false, 'message' => 'Nothing was sent.'], 400);
$s = fn($k, $n) => mb_substr(trim((string)($in[$k] ?? '')), 0, $n);
if ($s('website', 200) !== '') bg_json(['ok' => true, 'message' => 'Thank you - your booking is in.']);   // a robot filled the hidden field
$day = $s('day', 10); $time = $s('time', 5); $svc = max(0, (int)($in['service'] ?? 0)); $name = $s('name', 120); $email = $s('email', 200);
if (!$okDay($day) || !preg_match('/^\d{2}:\d{2}$/', $time)) bg_json(['ok' => false, 'message' => 'Pick a day and a time.'], 400);
if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) bg_json(['ok' => false, 'message' => 'Your name and a real email address, please.'], 400);
$len = $lenOf($svc); $sname = $services[$svc]['name'] ?? 'Appointment';
try {
  $db->beginTransaction();
  $db->prepare('SELECT id FROM bg_calendars WHERE id = ? FOR UPDATE')->execute([$id]);   // one booking at a time for this calendar
  $free = false; foreach (bg_book_times($db, $cal, $hours, $day, $len, $mins)['times'] as $t) if ($t['time'] === $time) $free = $t['free'];
  if (!$free) { $db->rollBack(); bg_json(['ok' => false, 'message' => 'Sorry - that time has just gone. Please pick another.'], 409); }
  $st = $db->prepare('SELECT id FROM clients WHERE email = ? LIMIT 1'); $st->execute([$email]); $cid = $st->fetchColumn();
  if (!$cid) {
    $parts = preg_split('/\s+/', $name); $last = count($parts) > 1 ? array_pop($parts) : ''; $first = implode(' ', $parts);
    $db->prepare("INSERT INTO clients (first_name, last_name, email, phone, source) VALUES (?, ?, ?, ?, 'website')")->execute([$first, $last, $email, $s('phone', 40)]);
    $cid = (int)$db->lastInsertId();
  }
  $status = (int)$cal['approve'] ? 'pending' : 'booked'; $start = $day . ' ' . $time . ':00';
  $db->prepare("INSERT INTO bg_cal_bookings (calendar_id, starts_at, ends_at, name, email, phone, notes, service, status, token, client_id, source, ip) VALUES (?, ?, DATE_ADD(?, INTERVAL ? MINUTE), ?, ?, ?, ?, ?, ?, ?, ?, 'website', ?)")
     ->execute([$id, $start, $start, $len, $name, $email, $s('phone', 40), $s('notes', 2000), $sname, $status, bin2hex(random_bytes(16)), $cid, mb_substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45)]);
  $db->commit();
} catch (Throwable $e) {
  if ($db->inTransaction()) $db->rollBack();
  error_log('book: ' . $e->getMessage()); bg_json(['ok' => false, 'message' => 'The booking could not be saved - please try again or contact us.'], 500);
}
$when = date('l j F Y', strtotime($day)) . ' at ' . $time;
@mail($email, $cal['name'] . ': ' . $sname, "Thank you, $name.\n" . ($status === 'pending' ? "We have your request for $when - we will confirm it soon." : "You are booked for $when.") . "\n", 'Content-Type: text/plain; charset=utf-8');
bg_json(['ok' => true, 'status' => $status, 'message' => ($status === 'pending' ? 'Thank you - we have your request for ' : 'You are booked for ') . $when . '. We have emailed you.']);
