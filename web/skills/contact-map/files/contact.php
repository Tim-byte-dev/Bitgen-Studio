<?php
// bitGen web skill: 📍 the contact form - js/bg-contact.js posts {name, email, subject, message, website}. Saved in the site's database
// (the CRM's ✉ Messages - the messages table 🗂 CRM ▸ 🗄 made) and, when inc/config.php defines CONTACT_EMAIL, emailed there.
// "website" is a hidden trap field: a robot that fills it gets a thank-you and nothing is kept.
require_once __DIR__ . '/inc/bg-db.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') bg_json(['ok' => false, 'message' => 'POST only'], 405);
$in = json_decode(file_get_contents('php://input'), true); if (!is_array($in)) $in = $_POST;
$s = fn($k, $n) => mb_substr(trim((string)($in[$k] ?? '')), 0, $n);
if ($s('website', 200) !== '') bg_json(['ok' => true, 'message' => 'Thank you - we will be in touch.']);
$name = $s('name', 120); $email = $s('email', 200); $subject = $s('subject', 200); $message = $s('message', 10000);
if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) bg_json(['ok' => false, 'message' => 'Your name and a real email address, please.'], 400);
if (mb_strlen($message) < 2) bg_json(['ok' => false, 'message' => 'Please write your message.'], 400);
$ip = mb_substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
try {
  $db = bg_db();
  $st = $db->prepare('SELECT COUNT(*) FROM messages WHERE ip = ? AND created_at > (NOW() - INTERVAL 10 MINUTE)'); $st->execute([$ip]);
  if ((int)$st->fetchColumn() >= 5) bg_json(['ok' => false, 'message' => 'That is a lot of messages - please wait a few minutes.'], 429);
  $db->prepare("INSERT INTO messages (name, email, subject, message, ip, status) VALUES (?, ?, ?, ?, ?, 'new')")->execute([$name, $email, $subject, $message, $ip]);
} catch (Throwable $e) { error_log('contact: ' . $e->getMessage()); bg_json(['ok' => false, 'message' => 'The message could not be sent - please email or call us.'], 500); }
if (defined('CONTACT_EMAIL') && filter_var(CONTACT_EMAIL, FILTER_VALIDATE_EMAIL)) {
  $safe = fn($t) => str_replace(["\r", "\n"], ' ', $t);
  @mail(CONTACT_EMAIL, 'Website: ' . $safe($subject !== '' ? $subject : 'a message from ' . $name), "From: $name <$email>\n\n$message\n", "Reply-To: " . $safe($email) . "\r\nContent-Type: text/plain; charset=utf-8");
}
bg_json(['ok' => true, 'message' => 'Thank you, ' . $name . ' - we will be in touch.']);
