<?php
// bitGen Community (2.713.0) - the discussions (shown on the website, tigerart.com.au/discussions.php).
// Tim: "add a discussions page on tigerart for registered users to talk and allow guest access too" - his pick: guests
// read and post, and a guest's post waits until an admin approves it. Members (a confirmed email) post at once.
// Real names are never shown here - only the user ID and display name (admins see the real name, in admin_user).
// A banned member's posts are hidden, like their chat messages. Everything is plain text (the page escapes it).
declare(strict_types=1);
if (!defined('BGC')) { http_response_code(404); exit; }

// 2.714.0: + bugs - its discussions are made by bug_report (act_bugs.php), not forum_new
const BGC_FORUM_CATS = ['help' => 'Help', 'bugs' => 'Bug reports', 'showcase' => 'Show your work', 'ideas' => 'Ideas', 'general' => 'General'];
const BGC_TOPICS_PAGE = 25;
const BGC_POSTS_PAGE = 30;

// a topic / post's author: a member (not banned), a guest, or someone who left
const BGC_FORUM_AUTHOR = 'LEFT JOIN bgc_users u ON u.id = x.user_id';
const BGC_FORUM_NOT_BANNED = '(u.id IS NULL OR u.banned = 0)';

const BGC_OFFICIAL = 'bitGen Studio';       // 2.721.0: who an official discussion is by (community/notes/)

function forum_author(array $r): array
{
    if (!empty($r['official'])) return ['official' => true, 'name' => BGC_OFFICIAL];
    if (!empty($r['guest_name']) && $r['user_id'] === null) return ['guest' => true, 'name' => (string) $r['guest_name']];
    if ($r['u_handle'] === null) return ['left' => true, 'name' => BGC_LEFT];
    return ['handle' => (string) $r['u_handle'], 'name' => (string) $r['u_display']];
}

function v_category(array $b, bool $optional): ?string
{
    $c = $b['category'] ?? null;
    if ($optional && ($c === null || $c === '')) return null;
    if (!is_string($c) || !array_key_exists($c, BGC_FORUM_CATS)) throw new ApiError(400, 'Pick a category: ' . implode(', ', BGC_FORUM_CATS) . '.');
    return $c;
}

function forum_cats(): array
{
    $out = [];
    foreach (BGC_FORUM_CATS as $k => $label) $out[] = ['id' => $k, 'label' => $label];
    return $out;
}

/** the topics, newest activity first - {categories, topics, page, pages, pending (admins: how many wait)} */
function act_forum_list(array $b, ?array $me): array
{
    $cat = v_category($b, true);
    $page = v_int($b, 'page', 1, 100000, 1);
    $where = 'x.deleted = 0 AND x.pending = 0 AND ' . BGC_FORUM_NOT_BANNED . ($cat !== null ? ' AND x.category = ?' : '');
    $args = $cat !== null ? [$cat] : [];
    try { forum_notes_sync(); } catch (Throwable $e) { error_log('bgc notes: ' . $e->getMessage()); }   // 2.721.0: never stops the list
    $total = (int) q_val('SELECT COUNT(*) FROM bgc_topics x ' . BGC_FORUM_AUTHOR . ' WHERE ' . $where, $args);
    $pages = max(1, (int) ceil($total / BGC_TOPICS_PAGE));
    $rows = q_all('SELECT x.*, u.handle AS u_handle, u.display AS u_display, b.status AS b_status, b.severity AS b_severity, b.app_version AS b_version '
        . 'FROM bgc_topics x ' . BGC_FORUM_AUTHOR . ' LEFT JOIN bgc_bugs b ON b.topic_id = x.id WHERE ' . $where
        . ' ORDER BY x.pinned DESC, x.last_at DESC, x.id DESC LIMIT ' . BGC_TOPICS_PAGE . ' OFFSET ' . (($page - 1) * BGC_TOPICS_PAGE), $args);
    $topics = [];
    foreach ($rows as $r) {
        $t = ['id' => (int) $r['id'], 'category' => (string) $r['category'], 'title' => (string) $r['title'], 'author' => forum_author($r),
            'created' => iso((int) $r['created_at']), 'last_at' => iso((int) $r['last_at']), 'replies' => (int) $r['replies'], 'pinned' => (int) $r['pinned'] === 1];
        if ($r['b_status'] !== null) $t['bug'] = ['status' => (string) $r['b_status'], 'status_label' => BGC_BUG_STATUS[$r['b_status']] ?? $r['b_status'],
            'severity' => (string) $r['b_severity'], 'severity_label' => BGC_BUG_SEV[$r['b_severity']] ?? $r['b_severity'], 'app_version' => (string) $r['b_version']];
        $topics[] = $t;
    }
    $out = ['categories' => forum_cats(), 'topics' => $topics, 'page' => $page, 'pages' => $pages, 'total' => $total];
    if ($me !== null && is_admin($me)) $out['pending'] = (int) q_val('SELECT COUNT(*) FROM bgc_posts WHERE pending = 1 AND deleted = 0');
    return $out;
}

/** a topic and a page of its posts (oldest first). Admins also see posts waiting (pending: true). */
function act_forum_topic(array $b, ?array $me): array
{
    $id = v_int($b, 'id', 1, PHP_INT_MAX, null);
    $admin = $me !== null && is_admin($me);
    $t = q_row('SELECT x.*, u.handle AS u_handle, u.display AS u_display FROM bgc_topics x ' . BGC_FORUM_AUTHOR . ' WHERE x.id = ? AND x.deleted = 0', [$id]);
    if ($t === null || (!$admin && ((int) $t['pending'] === 1 || ($t['u_handle'] !== null && (int) q_val('SELECT banned FROM bgc_users WHERE id = ?', [(int) $t['user_id']]) === 1)))) {
        throw new ApiError(404, 'There is no such discussion (it may have been removed).');
    }
    $where = 'x.topic_id = ? AND x.deleted = 0 AND ' . BGC_FORUM_NOT_BANNED . ($admin ? '' : ' AND x.pending = 0');
    $total = (int) q_val('SELECT COUNT(*) FROM bgc_posts x ' . BGC_FORUM_AUTHOR . ' WHERE ' . $where, [$id]);
    $pages = max(1, (int) ceil($total / BGC_POSTS_PAGE));
    $page = v_int($b, 'page', 1, 100000, 1);
    if ($page > $pages) $page = $pages;
    $first = (int) q_val('SELECT MIN(id) FROM bgc_posts WHERE topic_id = ?', [$id]);
    $posts = [];
    foreach (q_all('SELECT x.*, u.handle AS u_handle, u.display AS u_display FROM bgc_posts x ' . BGC_FORUM_AUTHOR . ' WHERE ' . $where
        . ' ORDER BY x.id ASC LIMIT ' . BGC_POSTS_PAGE . ' OFFSET ' . (($page - 1) * BGC_POSTS_PAGE), [$id]) as $r) {
        $mine = $me !== null && $r['user_id'] !== null && (int) $r['user_id'] === (int) $me['id'];
        $p = ['id' => (int) $r['id'], 'author' => forum_author($r), 'body' => (string) $r['body'], 'at' => iso((int) $r['at']),
            'first' => (int) $r['id'] === $first, 'mine' => $mine, 'can_delete' => $mine || $admin];
        if ($admin) $p['pending'] = (int) $r['pending'] === 1;
        $posts[] = $p;
    }
    return ['topic' => ['id' => (int) $t['id'], 'category' => (string) $t['category'], 'title' => (string) $t['title'], 'author' => forum_author($t),
        'created' => iso((int) $t['created_at']), 'replies' => (int) $t['replies'], 'pending' => (int) $t['pending'] === 1, 'pinned' => (int) $t['pinned'] === 1],
        'categories' => forum_cats(), 'posts' => $posts, 'page' => $page, 'pages' => $pages,
        'bug' => $t['category'] === 'bugs' ? bug_for_topic((int) $t['id'], $admin) : null];
}

/** who is writing: a member (confirmed - the dispatcher checks), or a guest with a name. Rate limits either way. */
function forum_writer(array $b, ?array $me, bool $topic): array
{
    if ($me !== null) {
        $k = ($topic ? 'ft:u:' : 'fp:u:') . (int) $me['id'];
        rl_check($k, $topic ? 6 : 40, 3600 * 1000, $topic ? 'That is a lot of new discussions - try again in an hour.' : 'That is a lot of posts - try again in an hour.');
        rl_hit($k);
        return ['user_id' => (int) $me['id'], 'guest_name' => null, 'pending' => 0];
    }
    if (!is_string($b['guest_name'] ?? null) || trim($b['guest_name']) === '') throw new ApiError(400, 'Your name is needed to post as a guest (or join, and post as yourself).');
    $name = v_text($b, 'guest_name', 2, 40, false, 'Your name');
    // 2.721.0: bitGen Studio's own posts carry its name - a guest cannot borrow it
    if (str_contains(preg_replace('/[^a-z]/', '', strtolower($name)), 'bitgen')) throw new ApiError(400, 'That name is kept for bitGen Studio\'s own posts - pick another.');
    $k = 'fg:' . bgc_client_ip();
    rl_check($k, 4, 3600 * 1000, 'Guests can post 4 times an hour - join the community to post more.');
    rl_hit($k);
    return ['user_id' => null, 'guest_name' => $name, 'pending' => 1];
}

/** a new discussion: {category, title, body, guest_name (a guest)} -> {topic_id, post_id, pending} */
function act_forum_new(array $b, ?array $me): array
{
    $cat = v_category($b, false);
    if ($cat === 'bugs') throw new ApiError(400, 'A bug report has its own form - Report a bug (or 🐞 in bitGen Studio).');
    $title = v_text($b, 'title', 3, 120, false, 'The title');
    $body = v_text($b, 'body', 1, 8000, true, 'The text');
    $w = forum_writer($b, $me, true);
    $now = now_ms();
    $ids = db_tx(static function () use ($cat, $title, $body, $w, $now): array {
        q('INSERT INTO bgc_topics (category, title, user_id, guest_name, created_at, last_at, replies, pending, deleted) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0)',
            [$cat, $title, $w['user_id'], $w['guest_name'], $now, $now, $w['pending']]);
        $tid = (int) db()->lastInsertId();
        q('INSERT INTO bgc_posts (topic_id, user_id, guest_name, body, at, pending, deleted) VALUES (?, ?, ?, ?, ?, ?, 0)',
            [$tid, $w['user_id'], $w['guest_name'], $body, $now, $w['pending']]);
        return [$tid, (int) db()->lastInsertId()];
    });
    return ['topic_id' => $ids[0], 'post_id' => $ids[1], 'pending' => $w['pending'] === 1];
}

/** a reply: {topic_id, body, guest_name (a guest)} -> {post_id, pending} */
function act_forum_reply(array $b, ?array $me): array
{
    $tid = v_int($b, 'topic_id', 1, PHP_INT_MAX, null);
    $body = v_text($b, 'body', 1, 8000, true, 'The text');
    $t = q_row('SELECT id, pending FROM bgc_topics WHERE id = ? AND deleted = 0', [$tid]);
    $admin = $me !== null && is_admin($me);
    if ($t === null || ((int) $t['pending'] === 1 && !$admin)) throw new ApiError(404, 'There is no such discussion (it may have been removed).');
    $w = forum_writer($b, $me, false);
    $now = now_ms();
    $pid = db_tx(static function () use ($tid, $body, $w, $now): int {
        q('INSERT INTO bgc_posts (topic_id, user_id, guest_name, body, at, pending, deleted) VALUES (?, ?, ?, ?, ?, ?, 0)',
            [$tid, $w['user_id'], $w['guest_name'], $body, $now, $w['pending']]);
        $pid = (int) db()->lastInsertId();
        if ($w['pending'] === 0) q('UPDATE bgc_topics SET replies = replies + 1, last_at = ? WHERE id = ?', [$now, $tid]);
        return $pid;
    });
    return ['post_id' => $pid, 'pending' => $w['pending'] === 1];
}

/** one post gone (its writer or an admin); the first post takes its whole discussion with it -> {topic_deleted} */
function act_forum_delete(array $b, array $me): array
{
    $pid = v_int($b, 'post_id', 1, PHP_INT_MAX, null);
    $p = q_row('SELECT * FROM bgc_posts WHERE id = ? AND deleted = 0', [$pid]);
    if ($p === null) throw new ApiError(404, 'There is no such post.');
    $mine = $p['user_id'] !== null && (int) $p['user_id'] === (int) $me['id'];
    if (!$mine && !is_admin($me)) throw new ApiError(403, 'Only its writer or an admin can remove a post.');
    $tid = (int) $p['topic_id'];
    $first = (int) q_val('SELECT MIN(id) FROM bgc_posts WHERE topic_id = ?', [$tid]) === $pid;
    db_tx(static function () use ($p, $pid, $tid, $first): void {
        if ($first) {
            q('UPDATE bgc_topics SET deleted = 1 WHERE id = ?', [$tid]);
            q('UPDATE bgc_posts SET deleted = 1 WHERE topic_id = ?', [$tid]);
        } else {
            q('UPDATE bgc_posts SET deleted = 1 WHERE id = ?', [$pid]);
            if ((int) $p['pending'] === 0) q('UPDATE bgc_topics SET replies = CASE WHEN replies > 0 THEN replies - 1 ELSE 0 END WHERE id = ?', [$tid]);
        }
    });
    return ['topic_deleted' => $first];
}

/** admins: the guests' posts waiting, oldest first */
function act_admin_forum_pending(array $b, array $me): array
{
    $out = [];
    foreach (q_all('SELECT p.id, p.topic_id, p.guest_name, p.body, p.at, t.title, t.category, t.pending AS t_pending FROM bgc_posts p JOIN bgc_topics t ON t.id = p.topic_id '
        . 'WHERE p.pending = 1 AND p.deleted = 0 AND t.deleted = 0 ORDER BY p.id ASC LIMIT 200') as $r) {
        $out[] = ['id' => (int) $r['id'], 'topic_id' => (int) $r['topic_id'], 'title' => (string) $r['title'], 'new_topic' => (int) $r['t_pending'] === 1,
            'category' => (string) $r['category'],
            'guest_name' => (string) $r['guest_name'], 'body' => (string) $r['body'], 'at' => iso((int) $r['at'])];
    }
    return ['posts' => $out];
}

/** admins: {post_id, approve} - approved goes up (a new discussion with it); refused is deleted for good */
function act_admin_forum_moderate(array $b, array $me): array
{
    $pid = v_int($b, 'post_id', 1, PHP_INT_MAX, null);
    $approve = v_bool($b, 'approve');
    $p = q_row('SELECT * FROM bgc_posts WHERE id = ? AND deleted = 0 AND pending = 1', [$pid]);
    if ($p === null) throw new ApiError(404, 'That post is not waiting any more.');
    $tid = (int) $p['topic_id'];
    $t = q_row('SELECT * FROM bgc_topics WHERE id = ?', [$tid]);
    $first = (int) q_val('SELECT MIN(id) FROM bgc_posts WHERE topic_id = ?', [$tid]) === $pid;
    db_tx(static function () use ($p, $pid, $tid, $t, $first, $approve): void {
        if ($approve) {
            q('UPDATE bgc_posts SET pending = 0 WHERE id = ?', [$pid]);
            if ($first) q('UPDATE bgc_topics SET pending = 0, last_at = ? WHERE id = ?', [max((int) $t['last_at'], (int) $p['at']), $tid]);
            else q('UPDATE bgc_topics SET replies = replies + 1, last_at = ? WHERE id = ?', [max((int) $t['last_at'], (int) $p['at']), $tid]);
        } elseif ($first) {
            q('DELETE FROM bgc_posts WHERE topic_id = ?', [$tid]);
            q('DELETE FROM bgc_topics WHERE id = ?', [$tid]);
            q('DELETE FROM bgc_bugs WHERE topic_id = ?', [$tid]);          // a refused (anonymous) bug report goes with it
        } else {
            q('DELETE FROM bgc_posts WHERE id = ?', [$pid]);
        }
    });
    return ['approved' => $approve];
}

/* ---------------- 2.721.0: a discussion pinned to the top; bitGen Studio's own discussions
 * Tim: "can you add a discussion to the website with that info and pin it please". */

/** admins: {topic_id, pinned} - pinned discussions come first in the list (newest activity first among them) */
function act_admin_forum_pin(array $b, array $me): array
{
    $tid = v_int($b, 'topic_id', 1, PHP_INT_MAX, null);
    $pin = v_bool($b, 'pinned');
    if (q_row('SELECT id FROM bgc_topics WHERE id = ? AND deleted = 0', [$tid]) === null) throw new ApiError(404, 'There is no such discussion (it may have been removed).');
    q('UPDATE bgc_topics SET pinned = ? WHERE id = ?', [$pin ? 1 : 0, $tid]);
    return ['pinned' => $pin];
}

/** where bitGen Studio's own discussions come from: BGC_NOTES_DIR, else community/notes/ - except on a server whose
 *  database is given by BGC_DSN (a test or a developer's run: no notes unless BGC_NOTES_DIR names a folder) */
function forum_notes_dir(): ?string
{
    $env = getenv('BGC_NOTES_DIR');
    if (is_string($env) && $env !== '') return is_dir($env) ? $env : null;
    $dsn = getenv('BGC_DSN');
    if (is_string($dsn) && $dsn !== '') return null;
    $d = dirname(__DIR__) . '/notes';
    return is_dir($d) ? $d : null;
}

/** a note (community/notes/<name>.json): {key, rev, category, title, lines: [...] | body, pinned} -> checked, or null */
function forum_note_read(string $file): ?array
{
    $n = json_decode((string) @file_get_contents($file), true);
    if (!is_array($n)) return null;
    $key = is_string($n['key'] ?? null) ? $n['key'] : '';
    $body = is_array($n['lines'] ?? null) ? implode("\n", array_map('strval', $n['lines'])) : (string) ($n['body'] ?? '');
    $title = trim((string) ($n['title'] ?? ''));
    $cat = (string) ($n['category'] ?? 'general');
    if (!preg_match('/^[a-z0-9-]{3,30}$/', $key) || $title === '' || mb_strlen($title) > 120 || trim($body) === '' || mb_strlen($body) > 8000
        || !array_key_exists($cat, BGC_FORUM_CATS) || $cat === 'bugs') return null;
    return ['key' => $key, 'rev' => max(1, (int) ($n['rev'] ?? 1)), 'category' => $cat, 'title' => $title, 'body' => $body, 'pinned' => !empty($n['pinned'])];
}

/** bitGen Studio's own discussions, shipped with the server (community/notes/*.json, put on the site by /b_admin/'s
 *  Update): each is posted once, by "bitGen Studio" (official), pinned when the note says so; a higher rev updates its
 *  title and text (its replies and pin stay). One a discussion an admin removed is not posted again. Runs when the list
 *  is read and the notes changed (bgc_meta notes_sig) -> {added, updated} */
function forum_notes_sync(): array
{
    $dir = forum_notes_dir();
    $out = ['added' => 0, 'updated' => 0];
    if ($dir === null) return $out;
    $files = glob($dir . '/*.json') ?: [];
    sort($files);
    $sig = substr(hash('sha256', implode('|', array_map(static fn ($f) => basename($f) . ':' . hash_file('sha256', $f), $files))), 0, 40);
    if (q_val('SELECT v FROM bgc_meta WHERE k = ?', ['notes_sig']) === $sig) return $out;
    foreach ($files as $f) {
        $n = forum_note_read($f);
        if ($n === null) { error_log('bgc notes: ' . basename($f) . ' is not a note (key, title, text, category)'); continue; }
        $mk = 'note:' . $n['key'];
        $have = q_val('SELECT v FROM bgc_meta WHERE k = ?', [$mk]);           // "<topic id>:<rev>"
        $now = now_ms();
        if ($have === null) {
            db_tx(static function () use ($n, $mk, $now): void {
                q('INSERT INTO bgc_topics (category, title, user_id, guest_name, created_at, last_at, replies, pending, deleted, pinned, official) VALUES (?, ?, NULL, NULL, ?, ?, 0, 0, 0, ?, 1)',
                    [$n['category'], $n['title'], $now, $now, $n['pinned'] ? 1 : 0]);
                $tid = (int) db()->lastInsertId();
                q('INSERT INTO bgc_posts (topic_id, user_id, guest_name, body, at, pending, deleted, official) VALUES (?, NULL, NULL, ?, ?, 0, 0, 1)', [$tid, $n['body'], $now]);
                q('INSERT INTO bgc_meta (k, v) VALUES (?, ?)', [$mk, $tid . ':' . $n['rev']]);
            });
            $out['added']++;
            continue;
        }
        [$tid, $rev] = array_map('intval', explode(':', (string) $have) + [0, 0]);
        if ($n['rev'] <= $rev) continue;
        db_tx(static function () use ($n, $mk, $tid): void {
            if (q_row('SELECT id FROM bgc_topics WHERE id = ? AND deleted = 0', [$tid]) !== null) {
                q('UPDATE bgc_topics SET title = ?, category = ? WHERE id = ?', [$n['title'], $n['category'], $tid]);
                q('UPDATE bgc_posts SET body = ? WHERE id = (SELECT MIN(id) FROM bgc_posts WHERE topic_id = ?)', [$n['body'], $tid]);
            }
            q('UPDATE bgc_meta SET v = ? WHERE k = ?', [$tid . ':' . $n['rev'], $mk]);
        });
        $out['updated']++;
    }
    q('DELETE FROM bgc_meta WHERE k = ?', ['notes_sig']);
    q('INSERT INTO bgc_meta (k, v) VALUES (?, ?)', ['notes_sig', $sig]);
    return $out;
}
