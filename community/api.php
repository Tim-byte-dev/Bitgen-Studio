<?php
// bitGen Community (2.710.0) - THE endpoint: POST api.php?a=<action> with a JSON body; JSON back, always.
// The contract is API.md. Its clients: bitGen Studio's own Node server (lib/community.js) and, in-process through
// lib/boot.php + bgc_call(), the tigerart.com.au website (2.713.0). MIT licence (the bitGen Studio repo).
declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('html_errors', '0');
ini_set('log_errors', '1');

require __DIR__ . '/lib/boot.php';

function bgc_main(): void
{
    bgc_headers();
    try {
        $action = $_GET['a'] ?? '';
        if (!is_string($action) || !array_key_exists($action, BGC_ACTIONS)) {
            throw new ApiError(400, 'Unknown action - see API.md (api.php?a=info, register, login, ...).');
        }
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        // GET only for info, so opening the address in a browser shows the server is alive
        if ($method !== 'POST' && !($method === 'GET' && $action === 'info')) {
            header('Allow: POST');
            throw new ApiError(405, 'Use POST.');
        }
        bgc_require_https();
        $body = $method === 'POST' ? bgc_read_body() : [];
        bgc_reply(200, ['ok' => true] + bgc_dispatch($action, $body));
    } catch (ApiError $e) {
        bgc_reply($e->status, ['ok' => false, 'error' => $e->getMessage()] + $e->extra);
    } catch (Throwable $e) {
        // the details go to the server's error log, never to the client
        error_log('bitGen Community: ' . get_class($e) . ': ' . $e->getMessage() . ' at ' . basename($e->getFile()) . ':' . $e->getLine());
        bgc_reply(500, ['ok' => false, 'error' => 'Something went wrong on the community server - please try again later.']);
    }
}

bgc_main();
