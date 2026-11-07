<?php
// bitGen Community (2.716.0) - LANGUAGE PACKS shared by the community: a member uploads a pack (.zip - bitGen Studio's
// Settings ▸ Languages ▸ ⇪ Share, or the website's Language packs page), an admin checks it, then anyone can download it
// (the app installs it in one click; the website offers the .zip).
// Tim: "if we could have a master pack so users can translate the strings and upload to tigerart for the community it
// would be ideal". The pack format: bitGen Studio's lib/langPacks.js (pack.json, ui.json, USAGE.md, ...). Here the zip is
// read just enough to know what it is - pack.json (the language) and how many of the app's words ui.json translates - and
// kept as it came; the app checks and cleans every part again when it installs one.
//   pack_list            live packs, newest per language first; + yours (any status); admins + the waiting ones
//   pack_get             {id} -> {zip (base64), ...} - a live pack (or yours / an admin's look at a waiting one)
//   pack_upload          {zip (base64), note?, coverage?} -> {id, pending} - confirmed members; an admin's goes live at once
//   pack_delete          {id} - yours, or any for an admin
//   admin_pack_moderate  {id, approve, note?} - approve = live (the same person's older live pack of that language goes);
//                        refuse = refused with the note (the uploader sees why), the zip dropped
declare(strict_types=1);
if (!defined('BGC')) { http_response_code(404); exit; }

const BGC_PACK_MAX = 5242880;            // 5 MB of zip (the master pack is about 0.5 MB)
const BGC_PACK_UNPACKED = 33554432;      // 32 MB unpacked at most
const BGC_PACK_ID = '/^[a-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/';
const BGC_PACK_PARTS = '~^(pack\.json|ui\.json|USAGE\.md|shortcuts\.json|FEATURES\.md|site\.json|help/[a-z0-9_-]{1,40}\.html|TRANSLATING\.txt|README[^/]*)$~i';
const BGC_PACK_COLS = 'p.id, p.code, p.native, p.name, p.version, p.app, p.user_id, p.status, p.note, p.review_note, p.counts, p.size, p.downloads, p.created_at, p.updated_at, u.handle AS u_handle, u.display AS u_display';

/** the entries of a zip (the central directory): [{name, method, csize, usize, offset}] */
function pack_zip_entries(string $z): array
{
    $n = strlen($z);
    $e = -1;
    for ($i = $n - 22; $i >= max(0, $n - 22 - 65535); $i--) {
        if (substr($z, $i, 4) === "PK\x05\x06") { $e = $i; break; }
    }
    if ($e < 0) throw new ApiError(400, 'That is not a .zip file.');
    $h = unpack('vcount/Vsize/Voff', substr($z, $e + 10, 10));
    if ($h['count'] > 500) throw new ApiError(400, 'That zip has too many files for a language pack.');
    $p = $h['off'];
    $out = [];
    for ($k = 0; $k < $h['count']; $k++) {
        if (substr($z, $p, 4) !== "PK\x01\x02") throw new ApiError(400, 'That zip is damaged.');
        $c = unpack('vmethod/Vtime/Vcrc/Vcsize/Vusize/vnlen/vxlen/vclen/vdisk/vint/Vext/Voff', substr($z, $p + 10, 36));
        $name = str_replace('\\', '/', substr($z, $p + 46, $c['nlen']));
        $p += 46 + $c['nlen'] + $c['xlen'] + $c['clen'];
        if ($name === '' || str_ends_with($name, '/')) continue;
        $out[] = ['name' => $name, 'method' => $c['method'], 'csize' => $c['csize'], 'usize' => $c['usize'], 'offset' => $c['off']];
    }
    return $out;
}

/** one entry's bytes (stored or deflate), at most $max of them */
function pack_zip_read(string $z, array $e, int $max): string
{
    $o = $e['offset'];
    if (substr($z, $o, 4) !== "PK\x03\x04") throw new ApiError(400, 'That zip is damaged.');
    $l = unpack('vnlen/vxlen', substr($z, $o + 26, 4));
    $data = substr($z, $o + 30 + $l['nlen'] + $l['xlen'], $e['csize']);
    if ($e['method'] === 0) return $data;
    if ($e['method'] !== 8) throw new ApiError(400, 'That zip uses a compression a language pack does not (only stored or deflate).');
    $out = @gzinflate($data, $max);
    if ($out === false) throw new ApiError(400, $e['name'] . ' could not be read from the zip (or is too big).');
    return $out;
}

/** a pack .zip -> what it is: {code, native, name, version, app, counts {ui, patterns, files}} (400 when it is not a pack) */
function pack_inspect(string $zip): array
{
    $ents = pack_zip_entries($zip);
    $names = array_column($ents, 'name');
    $prefix = '';
    if (!in_array('pack.json', $names, true)) {
        $pj = array_values(array_filter($names, fn ($n) => (bool) preg_match('~^[^/]+/pack\.json$~', $n)));
        if (count($pj) !== 1) throw new ApiError(400, 'That zip has no pack.json - a language pack has pack.json at its top (see TRANSLATING.txt in the master pack).');
        $prefix = substr($pj[0], 0, -strlen('pack.json'));
    }
    $total = 0;
    $byName = [];
    $files = 0;
    foreach ($ents as $e) {
        $n = $e['name'];
        if (str_starts_with($n, '/') || preg_match('~(^|/)\.\.(/|$)|^[A-Za-z]:~', $n)) throw new ApiError(400, 'That zip has a file outside its folder - not a language pack.');
        if (preg_match('~(^|/)(__MACOSX|\.DS_Store|Thumbs\.db)(/|$)~', $n) || !str_starts_with($n, $prefix)) continue;
        $rel = substr($n, strlen($prefix));
        if (!preg_match(BGC_PACK_PARTS, $rel)) continue;
        $total += $e['usize'];
        if ($total > BGC_PACK_UNPACKED) throw new ApiError(413, 'That pack unpacks to more than 32 MB.');
        $byName[$rel] = $e;
        $files++;
    }
    $pj = json_decode(pack_zip_read($zip, $byName['pack.json'], 65536), true);
    if (!is_array($pj)) throw new ApiError(400, 'pack.json is not valid JSON.');
    $code = is_string($pj['id'] ?? null) ? trim($pj['id']) : '';
    if (!preg_match(BGC_PACK_ID, $code)) throw new ApiError(400, 'pack.json "id" must be a language code like ko, es, pt-BR or zh-Hant.');
    if (strtolower($code) === 'en') throw new ApiError(400, 'English is built in - give the pack another language\'s code.');
    if ($code === 'xx') throw new ApiError(400, 'pack.json still has the master pack\'s "id": "xx" - put your language\'s code there (like ko, es, pt-BR).');
    $clean = static fn ($v, int $max): string => is_string($v) || is_int($v) ? mb_substr(trim((string) preg_replace(BGC_BAD_CHARS, '', (string) $v)), 0, $max, 'UTF-8') : '';
    $native = $clean($pj['native'] ?? '', 40);
    if ($native === '' || preg_match('/^Your language/i', $native)) throw new ApiError(400, 'pack.json needs "native": the language\'s name in its own words (like 한국어, Español).');
    $name = $clean($pj['name'] ?? '', 60);
    if ($name === '' || preg_match('/^Your language/i', $name)) $name = $native;
    $ui = 0;
    $pats = 0;
    if (isset($byName['ui.json'])) {
        $u = json_decode(pack_zip_read($zip, $byName['ui.json'], 16777216), true);
        if (is_array($u)) {
            foreach ((is_array($u['strings'] ?? null) ? $u['strings'] : []) as $v) if (is_string($v) && $v !== '') $ui++;
            foreach ((is_array($u['patterns'] ?? null) ? $u['patterns'] : []) as $v) if (is_string($v) && $v !== '') $pats++;
        }
    }
    return ['code' => $code, 'native' => $native, 'name' => $name, 'version' => $clean($pj['version'] ?? '', 20) ?: '1', 'app' => $clean($pj['app'] ?? '', 20),
        'counts' => ['ui' => $ui, 'patterns' => $pats, 'files' => $files]];
}

/** the app's own count of what the pack translates (it knows the English) - only small whole numbers kept */
function pack_coverage($c): array
{
    $out = [];
    if (!is_array($c)) return $out;
    foreach (['ui', 'patterns', 'guide', 'shortcuts', 'help', 'features', 'site'] as $k) {
        $x = $c[$k] ?? null;
        if (!is_array($x)) continue;
        $d = $x['done'] ?? null;
        $t = $x['total'] ?? null;
        if (is_int($d) && $d >= 0 && $d < 1000000 && (is_int($t) && $t >= $d && $t < 1000000 || $t === null)) $out[$k] = ['done' => $d, 'total' => $t];
    }
    return $out;
}

function pack_out(array $r, bool $full = false): array
{
    $o = ['id' => (int) $r['id'], 'code' => (string) $r['code'], 'native' => (string) $r['native'], 'name' => (string) $r['name'],
        'version' => (string) $r['version'], 'app' => (string) $r['app'], 'status' => (string) $r['status'],
        'by' => $r['u_handle'] === null ? ['left' => true, 'name' => BGC_LEFT] : ['handle' => (string) $r['u_handle'], 'name' => (string) $r['u_display']],
        'note' => (string) $r['note'], 'counts' => json_decode((string) $r['counts'], true) ?: new stdClass(),
        'size' => (int) $r['size'], 'downloads' => (int) $r['downloads'], 'created' => iso((int) $r['created_at']), 'updated' => iso((int) $r['updated_at'])];
    if ($full || $r['status'] === 'refused') $o['review_note'] = (string) $r['review_note'];
    return $o;
}

function act_pack_list(array $b, ?array $me): array
{
    $live = array_map('pack_out', q_all('SELECT ' . BGC_PACK_COLS . ' FROM bgc_packs p LEFT JOIN bgc_users u ON u.id = p.user_id '
        . "WHERE p.status = 'live' AND (u.id IS NULL OR u.banned = 0) ORDER BY p.code ASC, p.updated_at DESC LIMIT 500"));
    $out = ['packs' => $live, 'max_bytes' => BGC_PACK_MAX];
    if ($me !== null) {
        $out['mine'] = array_map(fn ($r) => pack_out($r, true), q_all('SELECT ' . BGC_PACK_COLS . ' FROM bgc_packs p LEFT JOIN bgc_users u ON u.id = p.user_id WHERE p.user_id = ? ORDER BY p.updated_at DESC LIMIT 100', [(int) $me['id']]));
        if (is_admin($me)) $out['pending'] = array_map(fn ($r) => pack_out($r, true), q_all('SELECT ' . BGC_PACK_COLS . " FROM bgc_packs p LEFT JOIN bgc_users u ON u.id = p.user_id WHERE p.status = 'pending' ORDER BY p.id ASC LIMIT 200"));
    }
    return $out;
}

function act_pack_get(array $b, ?array $me): array
{
    $id = v_int($b, 'id', 1, PHP_INT_MAX, null);
    $r = q_row('SELECT p.*, u.handle AS u_handle, u.display AS u_display, u.banned AS u_banned FROM bgc_packs p LEFT JOIN bgc_users u ON u.id = p.user_id WHERE p.id = ?', [$id]);
    $mine = $r !== null && $me !== null && (int) $r['user_id'] === (int) $me['id'];
    $admin = $me !== null && is_admin($me);
    if ($r === null || $r['zip'] === null || ($r['status'] !== 'live' && !$mine && !$admin) || ((int) ($r['u_banned'] ?? 0) === 1 && !$admin)) throw new ApiError(404, 'That language pack is not there (any more).');
    if ($r['status'] === 'live' && !$mine) q('UPDATE bgc_packs SET downloads = downloads + 1 WHERE id = ?', [$id]);
    return pack_out($r) + ['zip' => (string) $r['zip']];
}

function act_pack_upload(array $b, array $me): array
{
    rl_check('pack:u:' . (int) $me['id'], 10, 86400 * 1000, 'That is a lot of language packs for one day - try again tomorrow.');
    $raw = is_string($b['zip'] ?? null) ? base64_decode(preg_replace('#^data:[^,]*,#', '', $b['zip']), true) : false;
    if ($raw === false || $raw === '') throw new ApiError(400, 'Send the language pack as "zip" (base64).');
    if (strlen($raw) > BGC_PACK_MAX) throw new ApiError(413, 'That pack is ' . round(strlen($raw) / 1048576, 1) . ' MB - 5 MB at most.');
    $info = pack_inspect($raw);
    $counts = $info['counts'] + ['coverage' => pack_coverage($b['coverage'] ?? null)];
    $note = isset($b['note']) ? v_text($b, 'note', 0, 500, true, 'The note') : '';
    rl_hit('pack:u:' . (int) $me['id']);
    $admin = is_admin($me);
    $now = now_ms();
    $id = db_tx(static function () use ($info, $counts, $note, $raw, $me, $admin, $now): int {
        q('INSERT INTO bgc_packs (code, native, name, version, app, user_id, status, note, review_note, counts, zip, size, sha, downloads, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)',
            [$info['code'], $info['native'], $info['name'], $info['version'], $info['app'], (int) $me['id'], $admin ? 'live' : 'pending', $note, '',
                json_encode($counts, JSON_UNESCAPED_UNICODE), base64_encode($raw), strlen($raw), hash('sha256', $raw), $now, $now]);
        $id = (int) db()->lastInsertId();
        if ($admin) pack_retire_older($id, (int) $me['id'], $info['code']);
        return $id;
    });
    return ['id' => $id, 'pending' => !$admin, 'code' => $info['code'], 'native' => $info['native'], 'version' => $info['version'], 'counts' => $counts];
}

/** a newer live pack replaces the same person's older live one of the same language */
function pack_retire_older(int $id, int $userId, string $code): void
{
    q("DELETE FROM bgc_packs WHERE user_id = ? AND code = ? AND status = 'live' AND id <> ?", [$userId, $code, $id]);
}

function act_pack_delete(array $b, array $me): array
{
    $id = v_int($b, 'id', 1, PHP_INT_MAX, null);
    $r = q_row('SELECT id, user_id FROM bgc_packs WHERE id = ?', [$id]);
    if ($r === null) throw new ApiError(404, 'That language pack is not there (any more).');
    if ((int) $r['user_id'] !== (int) $me['id'] && !is_admin($me)) throw new ApiError(403, 'Only its uploader or an admin can delete a language pack.');
    q('DELETE FROM bgc_packs WHERE id = ?', [$id]);
    return ['deleted' => $id];
}

function act_admin_pack_moderate(array $b, array $me): array
{
    $id = v_int($b, 'id', 1, PHP_INT_MAX, null);
    $approve = v_bool($b, 'approve');
    $note = isset($b['note']) ? v_text($b, 'note', 0, 500, true, 'The note') : '';
    $r = q_row("SELECT id, user_id, code FROM bgc_packs WHERE id = ? AND status = 'pending'", [$id]);
    if ($r === null) throw new ApiError(404, 'That language pack is not waiting any more.');
    db_tx(static function () use ($r, $id, $approve, $note): void {
        if ($approve) {
            q("UPDATE bgc_packs SET status = 'live', review_note = ?, updated_at = ? WHERE id = ?", [$note, now_ms(), $id]);
            pack_retire_older($id, (int) $r['user_id'], (string) $r['code']);
        } else {
            q("UPDATE bgc_packs SET status = 'refused', review_note = ?, zip = NULL, updated_at = ? WHERE id = ?", [$note, now_ms(), $id]);
        }
    });
    return ['approved' => $approve];
}
