<?php

declare(strict_types=1);

namespace App\Support;

final class Response
{
    public static function configureCors(string $allowedOrigin): void
    {
        header('Access-Control-Allow-Origin: ' . $allowedOrigin);
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    }

    public static function json(array $payload, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($payload, JSON_UNESCAPED_SLASHES);
        exit;
    }
}
