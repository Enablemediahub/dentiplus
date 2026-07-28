<?php

declare(strict_types=1);

$packageIndex = __DIR__ . '/public_html/index.php';
$localFrontendIndex = __DIR__ . '/frontend/dist/index.html';

if (is_file($packageIndex)) {
    require $packageIndex;
    return;
}

if (is_file($localFrontendIndex)) {
    header('Content-Type: text/html; charset=utf-8');
    readfile($localFrontendIndex);
    return;
}

http_response_code(500);
header('Content-Type: text/plain; charset=utf-8');
echo 'Dentiplus entrypoint could not find public_html/index.php or frontend/dist/index.html.';
