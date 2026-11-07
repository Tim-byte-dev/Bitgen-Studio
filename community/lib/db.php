<?php
// bitGen Community (2.710.0) - the database: one PDO (MySQL / MariaDB or SQLite), prepared statements only,
// the tables made on first use (CREATE TABLE IF NOT EXISTS) from SQL both drivers take, times as UTC milliseconds.
declare(strict_types=1);
if (!defined('BGC')) { http_response_code(404); exit; }

// 2: names + email (verified) on bgc_users, banned emails, the discussions (bgc_topics, bgc_posts) - 2.713.0
// 3: bug reports (bgc_bugs) - 2.714.0
// 4: language packs (bgc_packs) - 2.716.0
const BGC_SCHEMA = '4';

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $s = bgc_settings();
    $pdo = new PDO($s['dsn'], $s['user'], $s['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 5,
    ]);
    $driver = db_driver($pdo);
    if ($driver === 'mysql') {
        $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
        $pdo->exec('SET NAMES utf8mb4');
        $pdo->exec("SET time_zone = '+00:00'");
    } elseif ($driver === 'sqlite') {
        $pdo->exec('PRAGMA busy_timeout = 5000');
    } else {
        throw new RuntimeException('unsupported PDO driver: ' . $driver);
    }
    db_schema($pdo, $driver);
    return $pdo;
}

function db_driver(PDO $pdo): string
{
    return (string) $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
}

/** run one prepared statement; ints bind as ints, null as NULL, bools as 0 / 1 */
function q(string $sql, array $args = []): PDOStatement
{
    $st = db()->prepare($sql);
    $i = 1;
    foreach ($args as $v) {
        if (is_int($v)) $st->bindValue($i, $v, PDO::PARAM_INT);
        elseif (is_bool($v)) $st->bindValue($i, $v ? 1 : 0, PDO::PARAM_INT);
        elseif ($v === null) $st->bindValue($i, null, PDO::PARAM_NULL);
        else $st->bindValue($i, (string) $v, PDO::PARAM_STR);
        $i++;
    }
    $st->execute();
    return $st;
}

function q_row(string $sql, array $args = []): ?array
{
    $r = q($sql, $args)->fetch();
    return $r === false ? null : $r;
}

function q_all(string $sql, array $args = []): array
{
    return q($sql, $args)->fetchAll();
}

function q_val(string $sql, array $args = [])
{
    $v = q($sql, $args)->fetchColumn();
    return $v === false ? null : $v;
}

/** an INSERT that may hit a UNIQUE / PRIMARY KEY - false instead of an error (both drivers' INSERT IGNORE differ) */
function q_insert_once(string $sql, array $args): bool
{
    try {
        q($sql, $args);
        return true;
    } catch (PDOException $e) {
        if (db_is_duplicate($e)) return false;
        throw $e;
    }
}

function db_is_duplicate(PDOException $e): bool
{
    return (string) $e->getCode() === '23000';
}

/** $fn inside one transaction */
function db_tx(callable $fn)
{
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $r = $fn();
        $pdo->commit();
        return $r;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function now_ms(): int
{
    return (int) floor(microtime(true) * 1000);
}

/** UTC milliseconds -> "2026-11-07T10:20:30.123Z" */
function iso(int $ms): string
{
    return gmdate('Y-m-d\TH:i:s', intdiv($ms, 1000)) . sprintf('.%03dZ', $ms % 1000);
}

/** an ISO-8601 string -> UTC milliseconds (null when it is not one) */
function iso_to_ms(string $s): ?int
{
    if (strlen($s) > 40 || !preg_match('/^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d{1,6})?)?(Z|[+-]\d\d:?\d\d)$/', $s)) return null;
    try {
        $d = new DateTimeImmutable($s);
    } catch (Exception $e) {
        return null;
    }
    return $d->getTimestamp() * 1000 + (int) $d->format('v');
}

// ---- the tables ---------------------------------------------------------------------------------------------------
// {PK} is the one column type the drivers spell differently; indexes go inline for MySQL (it has no CREATE INDEX IF NOT
// EXISTS) and as separate CREATE INDEX IF NOT EXISTS for SQLite.

function db_tables(): array
{
    return [
        'bgc_meta' => ['k VARCHAR(40) NOT NULL PRIMARY KEY, v VARCHAR(200) NOT NULL', []],
        'bgc_users' => ['id {PK}, handle VARCHAR(24) NOT NULL UNIQUE, display VARCHAR(40) NOT NULL, pass_hash VARCHAR(255) NOT NULL, '
            . 'created_at BIGINT NOT NULL, last_seen BIGINT NOT NULL DEFAULT 0, banned SMALLINT NOT NULL DEFAULT 0, '
            . implode(', ', array_map(fn ($c, $d) => "$c $d", array_keys(BGC_USER_V2), BGC_USER_V2)), []],
        'bgc_tokens' => ['token_hash CHAR(64) NOT NULL PRIMARY KEY, user_id BIGINT NOT NULL, created_at BIGINT NOT NULL, last_used BIGINT NOT NULL',
            ['bgc_tokens_user' => 'user_id']],
        'bgc_requests' => ['from_id BIGINT NOT NULL, to_id BIGINT NOT NULL, at BIGINT NOT NULL, PRIMARY KEY (from_id, to_id)',
            ['bgc_requests_to' => 'to_id']],
        'bgc_friends' => ['a_id BIGINT NOT NULL, b_id BIGINT NOT NULL, since BIGINT NOT NULL, PRIMARY KEY (a_id, b_id)',
            ['bgc_friends_b' => 'b_id']],
        'bgc_blocks' => ['blocker_id BIGINT NOT NULL, blocked_id BIGINT NOT NULL, at BIGINT NOT NULL, PRIMARY KEY (blocker_id, blocked_id)',
            ['bgc_blocks_blocked' => 'blocked_id']],
        'bgc_messages' => ['id {PK}, room VARCHAR(8) NOT NULL, from_id BIGINT NULL, to_id BIGINT NULL, body TEXT NOT NULL, '
            . 'at BIGINT NOT NULL, deleted SMALLINT NOT NULL DEFAULT 0, deleted_at BIGINT NULL',
            ['bgc_messages_room' => 'room, id', 'bgc_messages_from' => 'from_id', 'bgc_messages_to' => 'to_id', 'bgc_messages_del' => 'deleted_at']],
        'bgc_reports' => ['id {PK}, message_id BIGINT NOT NULL, reporter_id BIGINT NULL, reason VARCHAR(500) NOT NULL, at BIGINT NOT NULL',
            ['bgc_reports_msg' => 'message_id']],
        'bgc_hits' => ['id {PK}, k VARCHAR(100) NOT NULL, at BIGINT NOT NULL',
            ['bgc_hits_k' => 'k, at', 'bgc_hits_at' => 'at']],
        // 2.713.0: an email address an admin banned (its email_key) can never join again
        'bgc_banned_emails' => ['email_key VARCHAR(190) NOT NULL PRIMARY KEY, at BIGINT NOT NULL', []],
        // 2.713.0: the discussions on the website - a topic, its posts (the first post is the topic's text); a guest's
        // post has guest_name and no user_id and waits (pending) until an admin approves it
        'bgc_topics' => ['id {PK}, category VARCHAR(16) NOT NULL, title VARCHAR(200) NOT NULL, user_id BIGINT NULL, guest_name VARCHAR(40) NULL, '
            . 'created_at BIGINT NOT NULL, last_at BIGINT NOT NULL, replies INT NOT NULL DEFAULT 0, pending SMALLINT NOT NULL DEFAULT 0, deleted SMALLINT NOT NULL DEFAULT 0',
            ['bgc_topics_list' => 'deleted, pending, last_at', 'bgc_topics_cat' => 'category, last_at', 'bgc_topics_user' => 'user_id']],
        'bgc_posts' => ['id {PK}, topic_id BIGINT NOT NULL, user_id BIGINT NULL, guest_name VARCHAR(40) NULL, body TEXT NOT NULL, at BIGINT NOT NULL, '
            . 'pending SMALLINT NOT NULL DEFAULT 0, deleted SMALLINT NOT NULL DEFAULT 0',
            ['bgc_posts_topic' => 'topic_id, id', 'bgc_posts_pending' => 'pending', 'bgc_posts_user' => 'user_id']],
        // 2.714.0: a bug report - from bitGen Studio's 🐞 docker (with its system, settings, logs and screenshot) or the
        // website's form; its public face is a discussion in the "bugs" category (topic_id). details = JSON, shot = base64.
        'bgc_bugs' => ['id {PK}, topic_id BIGINT NULL, user_id BIGINT NULL, anon SMALLINT NOT NULL DEFAULT 0, title VARCHAR(200) NOT NULL, '
            . 'severity VARCHAR(16) NOT NULL, area VARCHAR(120) NOT NULL, app_version VARCHAR(40) NOT NULL, happened TEXT NOT NULL, '
            . 'expected TEXT NOT NULL, steps TEXT NOT NULL, details MEDIUMTEXT NULL, shot MEDIUMTEXT NULL, shot_type VARCHAR(16) NULL, '
            . "source VARCHAR(8) NOT NULL DEFAULT 'app', status VARCHAR(16) NOT NULL DEFAULT 'open', created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL",
            ['bgc_bugs_topic' => 'topic_id', 'bgc_bugs_status' => 'status, id']],
        // 2.716.0: a language pack a member shared (act_packs.php) - the .zip as base64; pending until an admin approves it
        'bgc_packs' => ['id {PK}, code VARCHAR(24) NOT NULL, native VARCHAR(40) NOT NULL, name VARCHAR(60) NOT NULL, version VARCHAR(20) NOT NULL, '
            . "app VARCHAR(20) NOT NULL, user_id BIGINT NULL, status VARCHAR(10) NOT NULL DEFAULT 'pending', note VARCHAR(600) NOT NULL, "
            . 'review_note VARCHAR(600) NOT NULL, counts TEXT NOT NULL, zip MEDIUMTEXT NULL, size INT NOT NULL, sha CHAR(64) NOT NULL, '
            . 'downloads INT NOT NULL DEFAULT 0, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL',
            ['bgc_packs_status' => 'status, code', 'bgc_packs_user' => 'user_id']],
    ];
}

// the columns schema 2 adds to bgc_users (a new install gets them in CREATE TABLE; an older one by ALTER TABLE)
const BGC_USER_V2 = [
    'first_name' => 'VARCHAR(40) NULL',
    'last_name' => 'VARCHAR(40) NULL',
    'email' => 'VARCHAR(190) NULL',
    'email_key' => 'VARCHAR(190) NULL',          // the address reduced (lower-case, no +tag; Gmail without dots) - unique
    'email_verified' => 'SMALLINT NOT NULL DEFAULT 0',
    'code_hash' => 'CHAR(64) NULL',               // the emailed code's sha256 (with the user id)
    'code_expires' => 'BIGINT NULL',
    'code_tries' => 'SMALLINT NOT NULL DEFAULT 0',
];

/** an older database (schema 1): the new bgc_users columns and the unique index on email_key */
function db_migrate_users(PDO $pdo): void
{
    foreach (BGC_USER_V2 as $col => $def) {
        try {
            $pdo->prepare("SELECT $col FROM bgc_users WHERE 1 = 0")->execute();      // $col: from BGC_USER_V2 only
        } catch (PDOException $e) {
            $pdo->exec("ALTER TABLE bgc_users ADD COLUMN $col $def");
        }
    }
    // one account per email address (NULLs - accounts from before 2.713.0 - do not count). Made once: "already there"
    // is fine (MySQL has no CREATE INDEX IF NOT EXISTS)
    try {
        $pdo->exec('CREATE UNIQUE INDEX bgc_users_email ON bgc_users (email_key)');
    } catch (PDOException $e) {
        if (!preg_match('/exists|Duplicate key name|1061/i', $e->getMessage())) throw $e;
    }
}

function db_dialect(string $driver): array
{
    return $driver === 'mysql'
        ? ['pk' => 'BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY', 'tail' => ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci', 'inline_index' => true]
        : ['pk' => 'INTEGER PRIMARY KEY AUTOINCREMENT', 'tail' => '', 'inline_index' => false];
}

function db_schema(PDO $pdo, string $driver): void
{
    try {
        $st = $pdo->prepare('SELECT v FROM bgc_meta WHERE k = ?');
        $st->execute(['schema']);
        if ($st->fetchColumn() === BGC_SCHEMA) return;
    } catch (PDOException $e) {
        // no tables yet - made below
    }
    $d = db_dialect($driver);
    foreach (db_tables() as $name => [$cols, $indexes]) {
        $cols = str_replace('{PK}', $d['pk'], $cols);
        if ($d['inline_index']) {
            foreach ($indexes as $iname => $icols) $cols .= ", KEY $iname ($icols)";
        }
        $pdo->exec("CREATE TABLE IF NOT EXISTS $name ($cols)" . $d['tail']);
        if (!$d['inline_index']) {
            foreach ($indexes as $iname => $icols) $pdo->exec("CREATE INDEX IF NOT EXISTS $iname ON $name ($icols)");
        }
    }
    db_migrate_users($pdo);
    $pdo->prepare('DELETE FROM bgc_meta WHERE k = ?')->execute(['schema']);
    try {
        $pdo->prepare('INSERT INTO bgc_meta (k, v) VALUES (?, ?)')->execute(['schema', BGC_SCHEMA]);
    } catch (PDOException $e) {
        if (!db_is_duplicate($e)) throw $e;     // two first requests at once - the other one wrote it
    }
}
