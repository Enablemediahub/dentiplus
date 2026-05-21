<?php

declare(strict_types=1);

spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';
    $baseDir = dirname(__DIR__) . '/app/';

    if (!str_starts_with($class, $prefix)) {
        return;
    }

    $relativeClass = substr($class, strlen($prefix));
    $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';

    if (is_file($file)) {
        require $file;
    }
});

App\Support\Env::load(dirname(__DIR__) . '/.env');
App\Support\Response::configureCors(
    App\Support\Env::get('CORS_ALLOWED_ORIGIN', '*'),
);
