<?php
// bitGen Community (2.710.0) - the database: one PDO (MySQL / MariaDB or SQLite), prepared statements only,
// the tables made on first use (CREATE TABLE IF NOT EXISTS) from SQL both drivers take, times as UTC milliseconds.
declare(strict_types=1);
if (!defined('BGC')) { http_response_code(404); exit; }

const BGC_SCHEMA = '1';

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
            . 'created_at BIGINT NOT NULL, last_seen BIGINT NOT NULL DEFAULT 0, banned SMALLINT NOT NULL DEFAULT 0', []],
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
    ];
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
    $pdo->prepare('DELETE FROM bgc_meta WHERE k = ?')->execute(['schema']);
    try {
        $pdo->prepare('INSERT INTO bgc_meta (k, v) VALUES (?, ?)')->execute(['schema', BGC_SCHEMA]);
    } catch (PDOException $e) {
        if (!db_is_duplicate($e)) throw $e;     // two first requests at once - the other one wrote it
    }
}
