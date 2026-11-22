<?php
// bitGen Community (2.913.0) - THE RELAY: the 📱 bitGen app reaches its PC when the phone is away from the PC's Wi-Fi.
//
// Tim: "stay connected for 6 hours if wifi connection is lost but phone has internet connection elsewhere" -> "Relay via
// tigerart.com.au". The phone cannot see 192.168.x.x from mobile data and the PC is behind its router, so both ask this
// server: the app leaves a request here (send), the PC fetches it (poll) and leaves the answer (answer), the app gets it.
// Every request and answer is a SEALED box (AES-256-GCM, a key only the app and its PC have - bitGen Studio's
// lib/relayBox.js / the app's www/lib/net.js): this server cannot read or change them. It only moves bytes, briefly:
//   <private folder>/relay/<pc>/pc.json     {h: sha256(the PC's secret), at, seen}   (registered once by the PC)
//   <private folder>/relay/<pc>/q/<rid>     a box waiting for the PC           (gone once the PC fetched it)
//   <private folder>/relay/<pc>/a/<rid>     the PC's answer waiting for the app (gone once the app got it)
// Nothing is kept longer than 2 minutes. No database. The private folder is the one /b_admin/ makes (outside the site).
// Limits for shared hosting: a box 7 MB at most (PHP's post_max_size is about 8 MB), the PC's poll waits at most 8 s,
// the app's send at most 25 s, 400 sends / 5 minutes per PC, 10 new PCs / hour per address.
// MIT licence (the bitGen Studio repo).
declare(strict_types=1);
if (!defined('BGC')) { http_response_code(404); exit; }

const RELAY_MAX = 7340032;          // 7 MB
const RELAY_POLL_WAIT = 8;          // s
const RELAY_SEND_WAIT = 25;         // s
const RELAY_KEEP = 120;             // s
const RELAY_ONLINE = 45;            // s - a PC that has not polled for this long is not there
const RELAY_SENDS = 400;            // per 5 minutes per PC
const RELAY_REGS = 10;              // per hour per address

final class RelayError extends Exception
{
    public int $status;
    public function __construct(int $status, string $message) { parent::__construct($message); $this->status = $status; }
}

/** the private folder (the same rule as /b_admin/ and the Community server) + /relay */
function relay_dir(): string
{
    $env = getenv('BITGEN_PRIVATE_DIR');
    if (is_string($env) && $env !== '') $base = rtrim($env, '/\\');
    else {
        $root = realpath((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''));
        if (!$root) throw new RelayError(503, 'The relay has no private folder on this server.');
        $base = dirname($root) . '/bitgen-private';
    }
    $d = $base . '/relay';
    if (!is_dir($d) && !@mkdir($d, 0700, true)) throw new RelayError(503, 'The relay cannot make its folder on this server.');
    return $d;
}
function relay_id_ok(string $id): bool { return (bool) preg_match('/^[A-Za-z0-9_-]{16,40}$/', $id); }
function relay_b64u(string $b): string { return rtrim(strtr(base64_encode($b), '+/', '-_'), '='); }

/** a counter in a small file (flock'd): events inside the window; 429 when there are $limit already */
function relay_limit(string $name, int $limit, int $window): void
{
    $f = relay_dir() . '/_rl_' . preg_replace('/[^A-Za-z0-9_.-]/', '_', $name);
    $h = @fopen($f, 'c+');
    if (!$h) return;
    flock($h, LOCK_EX);
    $now = time();
    $list = array_values(array_filter(array_map('intval', explode(',', (string) stream_get_contents($h))), fn($t) => $t > $now - $window));
    if (count($list) >= $limit) { flock($h, LOCK_UN); fclose($h); throw new RelayError(429, 'Too many requests through the relay - wait a few minutes.'); }
    $list[] = $now;
    ftruncate($h, 0); rewind($h); fwrite($h, implode(',', $list));
    flock($h, LOCK_UN); fclose($h);
}

/** 2.914.0 - who may register a PC (Tim: "only tigerart admin will be able to use it this relay through tigerart, other users
 *  can use cloudflare or their own hosts"): an admin of this Community server (the PC's 💬 Community sign-in token), or
 *  whoever has this relay's key (<private folder>/relay/key.txt - put one there to share your own relay.php) */
function relay_may_register(string $token, string $key): void
{
    $kf = relay_dir() . '/key.txt';
    $want = is_file($kf) ? trim((string) file_get_contents($kf)) : '';
    if ($want !== '' && $key !== '' && hash_equals($want, $key)) return;
    if ($token !== '') {
        require_once __DIR__ . '/boot.php';
        try {
            $s = bgc_settings();
            if (!empty($s['dsn'])) {
                $me = auth_user(['token' => $token]);
                if (is_admin($me)) return;
                throw new RelayError(403, 'This relay is only for the admins of its Community server - use your own relay.php or Cloudflare (bitGen Studio ▸ Settings ▸ General ▸ Remote access).');
            }
        } catch (ApiError $e) {
            throw new RelayError(403, 'This relay could not check your 💬 Community sign-in: ' . $e->getMessage());
        }
    }
    throw new RelayError(403, 'This relay is private: sign in to 💬 Community as an admin of this server, or give its relay key (bitGen Studio ▸ Settings ▸ General ▸ Remote access).');
}

function relay_register(string $ip): array
{
    $id = relay_b64u(random_bytes(15));
    $secret = relay_b64u(random_bytes(32));
    $d = relay_dir() . '/' . $id;
    if (!@mkdir($d . '/q', 0700, true) || !@mkdir($d . '/a', 0700, true)) throw new RelayError(503, 'The relay could not register this PC.');
    file_put_contents($d . '/pc.json', json_encode(['h' => hash('sha256', $secret), 'at' => time(), 'seen' => 0]), LOCK_EX);
    return ['id' => $id, 'secret' => $secret];
}

/** the PC's own calls: its id + its secret (Authorization: Bearer) -> its folder */
function relay_pc(string $id, string $secret): string
{
    if (!relay_id_ok($id)) throw new RelayError(400, 'Not a relay id.');
    $d = relay_dir() . '/' . $id;
    $pc = is_file($d . '/pc.json') ? json_decode((string) file_get_contents($d . '/pc.json'), true) : null;
    if (!is_array($pc) || !hash_equals((string) ($pc['h'] ?? ''), hash('sha256', $secret))) throw new RelayError(403, 'This PC is not registered with the relay (or its secret is wrong) - bitGen Studio registers again by itself.');
    return $d;
}
function relay_seen(string $d): void
{
    $pc = json_decode((string) @file_get_contents($d . '/pc.json'), true);
    if (!is_array($pc)) return;
    $pc['seen'] = time();
    @file_put_contents($d . '/pc.json', json_encode($pc), LOCK_EX);
}
function relay_sweep(string $d): void
{
    foreach (['q', 'a'] as $s) foreach (glob($d . '/' . $s . '/*') ?: [] as $f) if (@filemtime($f) < time() - RELAY_KEEP) @unlink($f);
}
/** the PC fetches what is waiting -> [{rid, box (base64)}], waiting up to $wait seconds for the first one */
function relay_poll(string $d, int $wait): array
{
    relay_seen($d);
    relay_sweep($d);
    $until = microtime(true) + max(0, min(RELAY_POLL_WAIT, $wait));
    $out = [];
    do {
        $size = 0;
        foreach (glob($d . '/q/*') ?: [] as $f) {
            $rid = basename($f);
            if (!relay_id_ok($rid)) continue;
            $taken = $f . '.taken';
            if (!@rename($f, $taken)) continue;                    // another poll took it
            $box = (string) @file_get_contents($taken);
            @unlink($taken);
            $out[] = ['rid' => $rid, 'box' => base64_encode($box)];
            $size += strlen($box);
            if ($size > RELAY_MAX) break;
        }
        if ($out || microtime(true) >= $until) break;
        usleep(250000);
        clearstatcache();
    } while (true);
    return $out;
}
function relay_answer(string $d, string $rid, string $box): void
{
    if (!relay_id_ok($rid)) throw new RelayError(400, 'Not a request id.');
    if (strlen($box) > RELAY_MAX) throw new RelayError(413, 'That answer is too big for the relay.');
    $tmp = $d . '/a/' . $rid . '.tmp';
    file_put_contents($tmp, $box, LOCK_EX);
    rename($tmp, $d . '/a/' . $rid);
}
/** the app's request -> the PC's answer (the box), or an error the app can show */
function relay_send(string $id, string $box): string
{
    if (!relay_id_ok($id)) throw new RelayError(400, 'Not a relay id.');
    $d = relay_dir() . '/' . $id;
    $pc = is_file($d . '/pc.json') ? json_decode((string) file_get_contents($d . '/pc.json'), true) : null;
    if (!is_array($pc)) throw new RelayError(404, 'Your PC is not known to the relay - connect at home on the Wi-Fi once.');
    if ($box === '' || strlen($box) > RELAY_MAX) throw new RelayError(413, 'That request is too big for the relay (7 MB at most).');
    if ((int) ($pc['seen'] ?? 0) < time() - RELAY_ONLINE) throw new RelayError(503, 'Your PC is not online - bitGen Studio has to be running, with Remote access on.');
    relay_limit('send_' . $id, RELAY_SENDS, 300);
    $rid = relay_b64u(random_bytes(15));
    $tmp = $d . '/q/' . $rid . '.tmp';
    file_put_contents($tmp, $box, LOCK_EX);
    rename($tmp, $d . '/q/' . $rid);
    $ans = $d . '/a/' . $rid;
    $until = microtime(true) + RELAY_SEND_WAIT;
    while (microtime(true) < $until) {
        clearstatcache(true, $ans);
        if (is_file($ans)) {
            $b = (string) file_get_contents($ans);
            @unlink($ans);
            return $b;
        }
        usleep(150000);
    }
    @unlink($d . '/q/' . $rid);
    throw new RelayError(504, 'Your PC did not answer through the relay in time.');
}
