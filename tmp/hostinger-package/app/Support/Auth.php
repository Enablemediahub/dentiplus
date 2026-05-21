<?php

declare(strict_types=1);

namespace App\Support;

use PDO;
use App\Support\Env;

final class Auth
{
    public static function ensureStaffProfileColumn(PDO $pdo): void
    {
        $columns = $pdo->query('SHOW COLUMNS FROM staff')->fetchAll(PDO::FETCH_COLUMN) ?: [];

        if (!in_array('profile_image', $columns, true)) {
            $pdo->exec('ALTER TABLE staff ADD COLUMN profile_image VARCHAR(255) DEFAULT NULL AFTER email');
        }
    }

    public static function staffDisplayName(array $user, ?string $forceRole = null): string
    {
        $parts = array_filter([
            $user['first_name'] ?? null,
            $user['other_names'] ?? null,
            $user['last_name'] ?? null,
        ], static fn ($value): bool => trim((string) $value) !== '');

        $baseName = $parts ? implode(' ', $parts) : (string) ($user['username'] ?? 'Dentiplus User');
        $role = strtolower(trim((string) ($forceRole ?? ($user['staff_role'] ?? $user['role'] ?? ''))));

        if ($role === 'dentist') {
            return 'Dr. (Dent) ' . $baseName;
        }

        return $baseName;
    }

    public static function userFromToken(?string $token): array
    {
        if (!$token) {
            Response::json(['message' => 'Authentication required.'], 401);
        }

        $pdo = Database::connection();
        self::ensureStaffProfileColumn($pdo);
        $statement = $pdo->prepare(
            'SELECT 
                u.id,
                u.username,
                u.email,
                u.role,
                u.is_active,
                s.id AS staff_id,
                s.first_name,
                s.last_name,
                s.other_names,
                s.profile_image,
                s.role AS staff_role,
                sb.branch,
                sessions.last_activity
             FROM sessions
             INNER JOIN users u ON u.id = sessions.user_id
             LEFT JOIN staff s ON s.user_id = u.id
             LEFT JOIN staff_branches sb ON sb.staff_id = s.id
             WHERE sessions.session_id = :token
             LIMIT 1'
        );
        $statement->execute(['token' => $token]);
        $user = $statement->fetch(PDO::FETCH_ASSOC);

        if (!$user || (int) ($user['is_active'] ?? 0) !== 1) {
            Response::json(['message' => 'Your session is no longer active.'], 401);
        }

        $touch = $pdo->prepare('UPDATE sessions SET last_activity = CURRENT_TIMESTAMP WHERE session_id = :token');
        $touch->execute(['token' => $token]);

        return $user;
    }

    public static function assetUrl(?string $path): ?string
    {
        $relativePath = trim((string) $path);
        if ($relativePath === '') {
            return null;
        }

        $baseUrl = rtrim((string) Env::get('APP_URL', ''), '/');
        if ($baseUrl === '') {
            return '/' . ltrim($relativePath, '/');
        }

        return $baseUrl . '/' . ltrim($relativePath, '/');
    }

    public static function roleLabel(array $user): string
    {
        $role = strtolower(trim((string) ($user['staff_role'] ?: $user['role'])));

        return match ($role) {
            'ceo', 'superadmin', 'admin' => 'Admin',
            'receptionist' => 'Receptionist',
            'dentist' => 'Dentist',
            'accountant' => 'Accountant',
            default => 'Admin',
        };
    }

    public static function displayName(array $user): string
    {
        return self::staffDisplayName($user);
    }
}
