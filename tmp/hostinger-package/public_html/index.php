<?php

declare(strict_types=1);

use App\Support\Response;

require dirname(__DIR__) . '/bootstrap/app.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uri = $_SERVER['REQUEST_URI'] ?? '/';
$basePath = rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? ''), '/');
$path = parse_url($uri, PHP_URL_PATH) ?: '/';

if ($basePath !== '' && $basePath !== '/' && str_starts_with($path, $basePath)) {
    $path = substr($path, strlen($basePath));
}

$path = '/' . ltrim($path, '/');

if ($method === 'OPTIONS') {
    Response::json(['status' => 'ok']);
}

$routes = require dirname(__DIR__) . '/routes/api.php';
$handler = $routes[$method][$path] ?? null;

if (!$handler) {
    Response::json([
        'message' => 'Route not found.',
        'path' => $path,
    ], 404);
}

[$controllerClass, $controllerMethod] = $handler;
$controller = new $controllerClass();
$controller->{$controllerMethod}();
