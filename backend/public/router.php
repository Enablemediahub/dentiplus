<?php

declare(strict_types=1);

$requestUri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$filePath = __DIR__ . $requestUri;

if ($requestUri !== '/' && is_file($filePath)) {
    return false;
}

require __DIR__ . '/index.php';
