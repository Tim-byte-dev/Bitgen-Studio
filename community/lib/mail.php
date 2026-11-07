<?php
// bitGen Community (2.713.0) - email: the code that confirms an address. PHP's mail() - the hosting's own mail server
// (Plesk / cPanel have one) - plain text, UTF-8, from settings 'mail_from' (noreply@<the site> unless set).
// BGC_MAIL_LOG=<file> writes each email there as a JSON line instead of sending it (tests; a server without mail).
declare(strict_types=1);
if (!defined('BGC')) { http_response_code(404); exit; }

/** true when it went (or was logged) */
function bgc_mail(string $to, string $subject, string $text): bool
{
    if (!filter_var($to, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $to)) return false;
    $log = getenv('BGC_MAIL_LOG');
    if (is_string($log) && $log !== '') {
        $line = json_encode(['to' => $to, 'subject' => $subject, 'text' => $text, 'from' => bgc_settings()['mail_from']], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        return @file_put_contents($log, $line . "\n", FILE_APPEND | LOCK_EX) !== false;
    }
    $from = bgc_settings()['mail_from'];
    $headers = [
        'From' => 'bitGen Community <' . $from . '>',
        'MIME-Version' => '1.0',
        'Content-Type' => 'text/plain; charset=UTF-8',
        'Content-Transfer-Encoding' => '8bit',
        'Auto-Submitted' => 'auto-generated',
    ];
    $subj = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $body = str_replace("\n", "\r\n", str_replace("\r\n", "\n", $text));
    // -f: the envelope sender = the From address (SPF); some hosts refuse the extra parameter - then without it
    if (@mail($to, $subj, $body, $headers, '-f' . $from)) return true;
    return @mail($to, $subj, $body, $headers);
}
