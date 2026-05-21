<?php

declare(strict_types=1);

namespace App\Support;

final class Request
{
    public static function json(): array
    {
        $raw = file_get_contents('php://input');
        if (!$raw) {
          return [];
        }

        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    public static function bearerToken(): ?string
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (!$header || !str_starts_with($header, 'Bearer ')) {
            return null;
        }

        return trim(substr($header, 7));
    }

    public static function ip(): ?string
    {
        return $_SERVER['REMOTE_ADDR'] ?? null;
    }

    public static function userAgent(): ?string
    {
        return $_SERVER['HTTP_USER_AGENT'] ?? null;
    }
}
