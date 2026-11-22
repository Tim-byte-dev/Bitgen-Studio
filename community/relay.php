<?php
// bitGen Community (2.913.0) - relay.php: the 📱 bitGen app <-> its PC when the phone is away from the Wi-Fi (lib/relay.php).
//   GET  relay.php?a=info                                   {ok, relay: 1, max}  (is there a relay here?)
//   POST relay.php?a=register                               {ok, id, secret}     (bitGen Studio, once)
//   POST relay.php?a=poll&wait=8      X-Relay-Id + Authorization: Bearer <secret>   {ok, reqs: [{rid, box (base64)}]}
//   POST relay.php?a=answer&rid=...   (the same)  body = the sealed answer          {ok}
//   POST relay.php?a=send&pc=<id>     body = the app's sealed request -> 200 the sealed answer (application/octet-stream)
// Errors: JSON {ok: false, error}. HTTPS only (this computer let through for tests). CORS for the app (http://localhost).
// MIT licence (the bitGen Studio repo).
declare(strict_types=1);
const BGC = 1;                      // the loaded-by-an-entry-point mark every lib/*.php checks (relay.php loads only lib/relay.php - no database)
ini_set('display_errors', '0');
ini_set('html_errors', '0');
ini_set('log_errors', '1');
require __DIR__ . '/lib/relay.php';

function relay_json(int $status, array $data): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP);
}

function relay_main(): void
{
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store');
    header('Referrer-Policy: no-referrer');
    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    if (in_array($origin, ['http://localhost', 'https://localhost', 'capacitor://localhost'], true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
        header('Access-Control-Max-Age: 600');
    }
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if ($method === 'OPTIONS') { http_response_code(204); return; }
    try {
        $https = (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off')
            || (string) ($_SERVER['SERVER_PORT'] ?? '') === '443'
            || strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
        $local = in_array((string) ($_SERVER['REMOTE_ADDR'] ?? ''), ['127.0.0.1', '::1'], true);
        if (!$https && !$local) throw new RelayError(403, 'The relay only answers over HTTPS.');
        $a = (string) ($_GET['a'] ?? '');
        if ($a === 'info') { relay_json(200, ['ok' => true, 'relay' => 1, 'max' => RELAY_MAX]); return; }
        if ($method !== 'POST') throw new RelayError(405, 'Use POST.');
        $len = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
        if ($len > RELAY_MAX + 4096) throw new RelayError(413, 'That is too big for the relay (7 MB at most).');
        $body = (string) file_get_contents('php://input', false, null, 0, RELAY_MAX + 1);
        if ($a === 'register') { relay_json(200, ['ok' => true] + relay_register((string) ($_SERVER['REMOTE_ADDR'] ?? ''))); return; }
        if ($a === 'send') {
            $ans = relay_send((string) ($_GET['pc'] ?? ''), $body);
            http_response_code(200);
            header('Content-Type: application/octet-stream');
            header('Content-Length: ' . strlen($ans));
            echo $ans;
            return;
        }
        if ($a === 'poll' || $a === 'answer') {
            $auth = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
            if ($auth === '' && function_exists('getallheaders')) foreach (getallheaders() as $k => $v) if (strcasecmp((string) $k, 'Authorization') === 0) $auth = (string) $v;
            $secret = preg_match('/^Bearer\s+(\S+)$/', $auth, $m) ? $m[1] : (string) ($_SERVER['HTTP_X_RELAY_SECRET'] ?? '');
            $d = relay_pc((string) ($_SERVER['HTTP_X_RELAY_ID'] ?? ''), $secret);
            if ($a === 'poll') {
                ignore_user_abort(false);
                set_time_limit(RELAY_POLL_WAIT + 20);
                relay_json(200, ['ok' => true, 'reqs' => relay_poll($d, (int) ($_GET['wait'] ?? 0))]);
            } else {
                relay_answer($d, (string) ($_GET['rid'] ?? ''), $body);
                relay_json(200, ['ok' => true]);
            }
            return;
        }
        throw new RelayError(400, 'Unknown action - relay.php?a=info, register, poll, answer, send.');
    } catch (RelayError $e) {
        relay_json($e->status, ['ok' => false, 'error' => $e->getMessage()]);
    } catch (Throwable $e) {
        error_log('bitGen relay: ' . get_class($e) . ': ' . $e->getMessage() . ' at ' . basename($e->getFile()) . ':' . $e->getLine());
        relay_json(500, ['ok' => false, 'error' => 'Something went wrong on the relay - please try again later.']);
    }
}

if (PHP_SAPI !== 'cli' || getenv('BGR_RUN')) { set_time_limit(RELAY_SEND_WAIT + 20); relay_main(); }
