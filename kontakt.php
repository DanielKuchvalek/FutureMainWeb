<?php
/**
 * Utopia Corp. – příjem zpráv z kontaktního formuláře.
 *
 * Každá zpráva se uloží do storage/zpravy.jsonl (jeden JSON na řádek).
 * Když vyplníte RECIPIENT, přijde zpráva navíc e-mailem.
 */
declare(strict_types=1);

// ---------- Nastavení ----------
const RECIPIENT = '';          // kam posílat zprávy, např. 'info@vase-domena.cz' (prázdné = jen ukládat)
const SENDER = '';             // odesílatel na vaší doméně, např. 'web@vase-domena.cz' (prázdné = RECIPIENT)
const RATE_LIMIT = 5;          // kolik zpráv smí jedna IP adresa poslat…
const RATE_WINDOW = 600;       // …za tolik sekund
const MIN_FILL_SECONDS = 3;    // rychlejší odeslání je skoro jistě robot

const STORAGE_DIR = __DIR__ . '/storage';
const SERVICES = ['Web', 'E-shop', 'Aplikace', 'Něco jiného'];

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function respond(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function text_length(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

function clean(string $value): string
{
    // odstraní řídicí znaky kromě konců řádků a tabulátorů
    return trim((string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value));
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'error' => 'Zprávu pošlete přes formulář na webu.']);
}

// ---------- Ochrana proti robotům ----------
$honeypot = (string) ($_POST['web'] ?? '');
$started = (int) ($_POST['t'] ?? 0);
if ($honeypot !== '' || ($started > 0 && time() - $started < MIN_FILL_SECONDS)) {
    // robotovi odpovíme jako by vše prošlo, ale nic neuložíme
    respond(200, ['ok' => true]);
}

// ---------- Kontrola údajů ----------
$name = clean((string) ($_POST['jmeno'] ?? ''));
$email = clean((string) ($_POST['email'] ?? ''));
$message = clean((string) ($_POST['zprava'] ?? ''));
$services = array_values(array_intersect(SERVICES, (array) ($_POST['sluzby'] ?? [])));

if (text_length($name) < 2 || text_length($name) > 120) {
    respond(422, ['ok' => false, 'field' => 'jmeno', 'error' => 'Napište nám, jak vám máme říkat.']);
}
if (strlen($email) > 200 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(422, ['ok' => false, 'field' => 'email', 'error' => 'Zadejte e-mail ve tvaru jmeno@domena.cz.']);
}
if (text_length($message) < 10 || text_length($message) > 5000) {
    respond(422, ['ok' => false, 'field' => 'zprava', 'error' => 'Zpráva musí mít 10 až 5 000 znaků.']);
}

// ---------- Úložiště ----------
if (!is_dir(STORAGE_DIR) && !mkdir(STORAGE_DIR, 0750, true) && !is_dir(STORAGE_DIR)) {
    respond(500, ['ok' => false, 'error' => 'Zprávu se nepodařilo uložit. Zkuste to prosím později.']);
}

// ---------- Omezení počtu zpráv z jedné adresy ----------
$ipKey = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . __FILE__);
$limitsFile = STORAGE_DIR . '/limity.json';
$fh = fopen($limitsFile, 'c+');
if ($fh && flock($fh, LOCK_EX)) {
    $limits = json_decode((string) stream_get_contents($fh), true) ?: [];
    $now = time();
    foreach ($limits as $key => $times) {
        $limits[$key] = array_values(array_filter((array) $times, fn ($t) => $now - (int) $t < RATE_WINDOW));
        if (!$limits[$key]) {
            unset($limits[$key]);
        }
    }
    if (count($limits[$ipKey] ?? []) >= RATE_LIMIT) {
        flock($fh, LOCK_UN);
        fclose($fh);
        respond(429, ['ok' => false, 'error' => 'Poslali jste víc zpráv za sebou. Zkuste to prosím za pár minut.']);
    }
    $limits[$ipKey][] = $now;
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, (string) json_encode($limits));
    flock($fh, LOCK_UN);
}
if ($fh) {
    fclose($fh);
}

// ---------- Uložení zprávy ----------
$record = [
    'cas' => date('c'),
    'jmeno' => $name,
    'email' => $email,
    'sluzby' => $services,
    'zprava' => $message,
];
$saved = file_put_contents(
    STORAGE_DIR . '/zpravy.jsonl',
    json_encode($record, JSON_UNESCAPED_UNICODE) . "\n",
    FILE_APPEND | LOCK_EX
);

// ---------- E-mail ----------
$mailed = false;
if (RECIPIENT !== '' && function_exists('mail')) {
    $from = SENDER !== '' ? SENDER : RECIPIENT;
    $subject = 'Nová zpráva z webu: ' . $name;
    $encodedSubject = function_exists('mb_encode_mimeheader')
        ? mb_encode_mimeheader($subject, 'UTF-8', 'B', "\r\n")
        : '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $body = "Jméno: {$name}\nE-mail: {$email}\n"
        . 'S čím pomůžeme: ' . ($services ? implode(', ', $services) : '–') . "\n\n"
        . $message . "\n";
    $headers = implode("\r\n", [
        'From: Utopia Corp. <' . $from . '>',
        'Reply-To: ' . $email,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
    ]);
    $mailed = @mail(RECIPIENT, $encodedSubject, $body, $headers);
}

if ($saved === false && !$mailed) {
    respond(500, ['ok' => false, 'error' => 'Zprávu se nepodařilo uložit. Zkuste to prosím později.']);
}

respond(200, ['ok' => true]);
