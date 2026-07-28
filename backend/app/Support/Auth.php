<?php

declare(strict_types=1);

namespace App\Support;

use PDO;
use App\Support\Env;

final class Auth
{
    private const SESSION_IDLE_TIMEOUT_SECONDS = 1800;
    private const SESSION_MAX_AGE_SECONDS = 43200;

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
        self::deleteExpiredSessions($pdo);
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
                sessions.user_agent AS session_user_agent,
                sessions.created_at,
                sessions.last_activity,
                UNIX_TIMESTAMP(sessions.created_at) AS created_at_ts,
                UNIX_TIMESTAMP(sessions.last_activity) AS last_activity_ts,
                UNIX_TIMESTAMP(CURRENT_TIMESTAMP) AS current_ts
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

        $storedUserAgent = trim((string) ($user['session_user_agent'] ?? ''));
        $currentUserAgent = trim(Request::userAgent());
        if ($storedUserAgent !== '' && $currentUserAgent !== '' && !hash_equals($storedUserAgent, $currentUserAgent)) {
            $delete = $pdo->prepare('DELETE FROM sessions WHERE session_id = :token');
            $delete->execute(['token' => $token]);
            Response::json(['message' => 'Your session could not be verified. Please sign in again.'], 401);
        }

        $currentTime = (int) ($user['current_ts'] ?? time());
        $lastActivity = (int) ($user['last_activity_ts'] ?? 0);
        if ($lastActivity <= 0 || $currentTime - $lastActivity > self::SESSION_IDLE_TIMEOUT_SECONDS) {
            $delete = $pdo->prepare('DELETE FROM sessions WHERE session_id = :token');
            $delete->execute(['token' => $token]);
            Response::json(['message' => 'Your session expired after inactivity. Please sign in again.'], 401);
        }

        $createdAt = (int) ($user['created_at_ts'] ?? 0);
        if ($createdAt > 0 && $currentTime - $createdAt > self::SESSION_MAX_AGE_SECONDS) {
            $delete = $pdo->prepare('DELETE FROM sessions WHERE session_id = :token');
            $delete->execute(['token' => $token]);
            Response::json(['message' => 'Your session expired. Please sign in again.'], 401);
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

    public static function deleteExpiredSessions(PDO $pdo): void
    {
        $statement = $pdo->prepare(
            'DELETE FROM sessions
             WHERE last_activity < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ' . self::SESSION_IDLE_TIMEOUT_SECONDS . ' SECOND)
                OR created_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ' . self::SESSION_MAX_AGE_SECONDS . ' SECOND)'
        );
        $statement->execute();
    }
}
