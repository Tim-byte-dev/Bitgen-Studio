<?php
// bitGen Community (2.714.0) - bug reports.
// Tim: "can we also add the bug report discussion to the website and have the app allow the user to send the bug report
// to the db if they are registered. if not registered bug report will be sent as anon. compile the list of bugs so i can
// give it to you".
//   bug_report    from bitGen Studio's 🐞 docker (system, settings, logs, recorded steps, screenshot) or the website's
//                 form. A confirmed member's goes up at once; without a token it is ANONYMOUS and waits for an admin,
//                 like a guest's post. Its public face is a discussion in the "bugs" category: the title and the words
//                 the person wrote. The details (system, settings, logs, steps, errors) and the screenshot: admins only.
//   bug_shot      the screenshot (admins)          admin_bug_status   open / working / fixed / duplicate / notabug / wontfix
//   bug_export_rows()  everything, for the admin page's "Download the bug list" (the zip Tim hands over)
declare(strict_types=1);
if (!defined('BGC')) { http_response_code(404); exit; }

const BGC_BUG_SEV = ['crash' => '💥 Crash / freeze', 'broken' => '⛔ Something does not work', 'wrong' => '⚠ Wrong result',
    'looks' => '🎨 Looks wrong', 'idea' => '💡 Idea / wish'];
const BGC_BUG_STATUS = ['open' => 'Open', 'working' => 'Being fixed', 'fixed' => 'Fixed', 'duplicate' => 'Duplicate',
    'notabug' => 'Not a bug', 'wontfix' => "Won't fix"];
const BGC_BUG_DETAILS_MAX = 2097152;     // 2 MB of JSON (logs trimmed by the app first)
const BGC_BUG_SHOT_MAX = 4194304;        // 4 MB of picture

/** optional text, cut to $max characters (control characters out; newlines kept) */
function bug_text(array $b, string $key, int $max): string
{
    $v = $b[$key] ?? '';
    if (!is_string($v)) return '';
    $v = trim(str_replace("\r\n", "\n", $v));
    $v = preg_replace(BGC_BAD_CHARS, '', $v) ?? '';
    if (!preg_match('//u', $v)) $v = mb_convert_encoding($v, 'UTF-8', 'UTF-8');
    return function_exists('mb_substr') ? mb_substr($v, 0, $max, 'UTF-8') : substr($v, 0, $max);
}

/** the words the public sees: the first post of the bug's discussion */
function bug_public_text(array $r): string
{
    $L = ['Severity: ' . (BGC_BUG_SEV[$r['severity']] ?? $r['severity'])];
    if ($r['area'] !== '') $L[] = 'Where: ' . $r['area'];
    if ($r['app_version'] !== '') $L[] = 'bitGen Studio ' . $r['app_version'];
    foreach (['happened' => 'What happened', 'expected' => 'What I expected', 'steps' => 'Steps to reproduce'] as $k => $h) {
        if ($r[$k] !== '') $L[] = "\n" . $h . ":\n" . $r[$k];
    }
    return implode("\n", $L);
}

/** {title, severity, area?, app_version?, happened?, expected?, steps?, details? {…}, screenshot? (data: URL or base64 PNG /
 *  JPEG), guest_name? (website guests)} -> {bug_id, topic_id, pending} */
function act_bug_report(array $b, ?array $me): array
{
    $title = bug_text($b, 'title', 120);
    if (v_len($title) < 3) throw new ApiError(400, 'Give the bug a title (3 characters or more).');
    $sev = is_string($b['severity'] ?? null) && array_key_exists($b['severity'], BGC_BUG_SEV) ? $b['severity'] : 'broken';
    $r = ['title' => $title, 'severity' => $sev, 'area' => bug_text($b, 'area', 120), 'app_version' => bug_text($b, 'app_version', 40),
        'happened' => bug_text($b, 'happened', 5000), 'expected' => bug_text($b, 'expected', 5000), 'steps' => bug_text($b, 'steps', 5000)];
    if ($r['happened'] === '' && $r['steps'] === '') throw new ApiError(400, 'Say what happened (or the steps that make it happen).');
    if ($r['app_version'] !== '' && !preg_match('/^[0-9A-Za-z.+_ -]+$/', $r['app_version'])) $r['app_version'] = '';
    // the details: kept as JSON, for the admins
    $details = null;
    if (isset($b['details'])) {
        if (!is_array($b['details'])) throw new ApiError(400, '"details" must be an object.');
        $details = json_encode($b['details'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
        if ($details === false || strlen($details) > BGC_BUG_DETAILS_MAX) throw new ApiError(413, 'The logs are too big - send the report without them, or attach fewer.');
    }
    // the screenshot: PNG or JPEG only, checked by its first bytes
    $shot = null;
    $type = null;
    if (!empty($b['screenshot']) && is_string($b['screenshot'])) {
        $s = preg_replace('#^data:image/(png|jpeg);base64,#', '', $b['screenshot']);
        $raw = base64_decode((string) $s, true);
        if ($raw === false || strlen($raw) > BGC_BUG_SHOT_MAX) throw new ApiError(413, 'The screenshot is too big (4 MB at most) - send it smaller or without it.');
        if (strncmp($raw, "\x89PNG\r\n\x1a\n", 8) === 0) $type = 'png';
        elseif (strncmp($raw, "\xFF\xD8\xFF", 3) === 0) $type = 'jpeg';
        else throw new ApiError(400, 'The screenshot must be a PNG or JPEG picture.');
        $shot = base64_encode($raw);
    }
    // who: a confirmed member (the dispatcher made sure), or anonymous - limited, and waiting for an admin
    if ($me !== null) {
        rl_check('bug:u:' . (int) $me['id'], 10, 3600 * 1000, 'That is a lot of bug reports - try again in an hour.');
        rl_hit('bug:u:' . (int) $me['id']);
        $uid = (int) $me['id'];
        $guest = null;
        $pending = 0;
    } else {
        $k = 'bug:ip:' . bgc_client_ip();
        rl_check($k, 5, 3600 * 1000, 'That is a lot of bug reports from here - try again in an hour, or join the community.');
        rl_hit($k);
        $uid = null;
        $guest = bug_text($b, 'guest_name', 40);
        if (v_len($guest) < 2) $guest = 'Anonymous';
        $pending = 1;
    }
    $now = now_ms();
    $source = ($b['source'] ?? '') === 'web' ? 'web' : 'app';
    $ids = db_tx(static function () use ($r, $uid, $guest, $pending, $now, $details, $shot, $type, $source): array {
        q('INSERT INTO bgc_topics (category, title, user_id, guest_name, created_at, last_at, replies, pending, deleted) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0)',
            ['bugs', $r['title'], $uid, $guest, $now, $now, $pending]);
        $tid = (int) db()->lastInsertId();
        q('INSERT INTO bgc_posts (topic_id, user_id, guest_name, body, at, pending, deleted) VALUES (?, ?, ?, ?, ?, ?, 0)',
            [$tid, $uid, $guest, bug_public_text($r), $now, $pending]);
        q('INSERT INTO bgc_bugs (topic_id, user_id, anon, title, severity, area, app_version, happened, expected, steps, details, shot, shot_type, source, status, created_at, updated_at) '
            . 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$tid, $uid, $uid === null ? 1 : 0, $r['title'], $r['severity'], $r['area'], $r['app_version'], $r['happened'], $r['expected'], $r['steps'],
                $details, $shot, $type, $source, 'open', $now, $now]);
        return [(int) db()->lastInsertId(), $tid];
    });
    return ['bug_id' => $ids[0], 'topic_id' => $ids[1], 'pending' => $pending === 1, 'anonymous' => $uid === null];
}

/** a bug as anyone sees it (no details) - for a discussion in the "bugs" category */
function bug_public(array $row): array
{
    return ['id' => (int) $row['id'], 'status' => (string) $row['status'], 'status_label' => BGC_BUG_STATUS[$row['status']] ?? $row['status'],
        'severity' => (string) $row['severity'], 'severity_label' => BGC_BUG_SEV[$row['severity']] ?? $row['severity'],
        'area' => (string) $row['area'], 'app_version' => (string) $row['app_version'], 'anonymous' => (int) $row['anon'] === 1,
        'source' => (string) $row['source'], 'has_details' => $row['details'] !== null && $row['details'] !== '', 'has_shot' => !empty($row['shot_type'])];
}

/** the bug behind a discussion: everyone gets bug_public; admins also get the details */
function bug_for_topic(int $topicId, bool $admin): ?array
{
    $row = q_row('SELECT id, status, severity, area, app_version, anon, source, details, shot_type FROM bgc_bugs WHERE topic_id = ?', [$topicId]);
    if ($row === null) return null;
    $out = bug_public($row);
    if ($admin && $out['has_details']) $out['details'] = json_decode((string) $row['details'], true);
    return $out;
}

/** admins: {bug_id} -> {type, data (base64)} */
function act_bug_shot(array $b, array $me): array
{
    $row = q_row('SELECT shot, shot_type FROM bgc_bugs WHERE id = ?', [v_int($b, 'bug_id', 1, PHP_INT_MAX, null)]);
    if ($row === null || empty($row['shot'])) throw new ApiError(404, 'That bug has no screenshot.');
    return ['type' => (string) $row['shot_type'], 'data' => (string) $row['shot']];
}

/** admins: {bug_id, status} */
function act_admin_bug_status(array $b, array $me): array
{
    $id = v_int($b, 'bug_id', 1, PHP_INT_MAX, null);
    $st = $b['status'] ?? null;
    if (!is_string($st) || !array_key_exists($st, BGC_BUG_STATUS)) throw new ApiError(400, 'A status is one of: ' . implode(', ', array_keys(BGC_BUG_STATUS)) . '.');
    if (q_val('SELECT 1 FROM bgc_bugs WHERE id = ?', [$id]) === null) throw new ApiError(404, 'There is no such bug.');
    q('UPDATE bgc_bugs SET status = ?, updated_at = ? WHERE id = ?', [$st, now_ms(), $id]);
    return ['status' => $st, 'status_label' => BGC_BUG_STATUS[$st]];
}

/** every bug for the admin page's export: $which = open (open + being fixed) | all. Newest first within each severity;
 *  with the reporter (real name - it goes to Tim only), the discussion's replies, the details and the screenshot. */
function bug_export_rows(string $which = 'open'): array
{
    $where = $which === 'all' ? '' : "WHERE b.status IN ('open', 'working')";
    $rows = q_all('SELECT b.*, t.deleted AS t_deleted, t.pending AS t_pending, u.handle AS u_handle, u.display AS u_display, u.first_name AS u_first, '
        . 'u.last_name AS u_last, u.email AS u_email FROM bgc_bugs b LEFT JOIN bgc_topics t ON t.id = b.topic_id LEFT JOIN bgc_users u ON u.id = b.user_id '
        . $where . ' ORDER BY b.id DESC');
    $order = array_flip(array_keys(BGC_BUG_SEV));
    usort($rows, static fn ($a, $c) => [($order[$a['severity']] ?? 9), -(int) $a['id']] <=> [($order[$c['severity']] ?? 9), -(int) $c['id']]);
    $out = [];
    foreach ($rows as $r) {
        $replies = [];
        if ($r['topic_id'] !== null) {
            $first = (int) q_val('SELECT MIN(id) FROM bgc_posts WHERE topic_id = ?', [(int) $r['topic_id']]);
            foreach (q_all('SELECT p.body, p.at, p.guest_name, u.handle FROM bgc_posts p LEFT JOIN bgc_users u ON u.id = p.user_id '
                . 'WHERE p.topic_id = ? AND p.id <> ? AND p.deleted = 0 AND p.pending = 0 ORDER BY p.id', [(int) $r['topic_id'], $first]) as $p) {
                $replies[] = ['by' => $p['handle'] !== null ? '@' . $p['handle'] : (($p['guest_name'] ?? '') !== '' ? $p['guest_name'] . ' (guest)' : '(left)'),
                    'at' => iso((int) $p['at']), 'body' => (string) $p['body']];
            }
        }
        $out[] = $r + ['replies' => $replies, 'status_label' => BGC_BUG_STATUS[$r['status']] ?? $r['status'], 'severity_label' => BGC_BUG_SEV[$r['severity']] ?? $r['severity']];
    }
    return $out;
}

/** how many bugs per status (the admin page) */
function bug_counts(): array
{
    $out = array_fill_keys(array_keys(BGC_BUG_STATUS), 0);
    foreach (q_all('SELECT status, COUNT(*) AS n FROM bgc_bugs GROUP BY status') as $r) $out[$r['status']] = (int) $r['n'];
    return $out;
}
