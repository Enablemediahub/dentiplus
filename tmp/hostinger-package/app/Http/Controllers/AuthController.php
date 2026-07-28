<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Auth;
use App\Support\Database;
use App\Support\Request;
use App\Support\Response;
use PDO;

final class AuthController extends Controller
{
    public function login(): void
    {
        $payload = Request::json();
        $login = trim((string) ($payload['login'] ?? ''));
        $password = (string) ($payload['password'] ?? '');

        if ($login === '' || $password === '') {
            Response::json(['message' => 'Username/email and password are required.'], 422);
        }

        $pdo = Database::connection();
        Auth::deleteExpiredSessions($pdo);
        Auth::ensureStaffProfileColumn($pdo);
        $statement = $pdo->prepare(
            'SELECT 
                u.id,
                u.username,
                u.email,
                u.password,
                u.role,
                u.is_active,
                s.role AS staff_role,
                s.first_name,
                s.last_name,
                s.other_names,
                s.profile_image,
                s.id AS staff_id,
                sb.branch
             FROM users u
             LEFT JOIN staff s ON s.user_id = u.id
             LEFT JOIN staff_branches sb ON sb.staff_id = s.id
             WHERE u.username = :login OR u.email = :login
             LIMIT 1'
        );
        $statement->execute(['login' => $login]);
        $user = $statement->fetch(PDO::FETCH_ASSOC);

        if (!$user || !password_verify($password, (string) $user['password'])) {
            Response::json(['message' => 'Invalid sign-in details.'], 401);
        }

        if ((int) ($user['is_active'] ?? 0) !== 1) {
            Response::json(['message' => 'This user account is inactive.'], 403);
        }

        $token = bin2hex(random_bytes(32));

        $deleteExistingSessions = $pdo->prepare('DELETE FROM sessions WHERE user_id = :user_id');
        $deleteExistingSessions->execute(['user_id' => $user['id']]);

        $insert = $pdo->prepare(
            'INSERT INTO sessions (session_id, user_id, ip_address, user_agent, created_at, last_activity)
             VALUES (:session_id, :user_id, :ip_address, :user_agent, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
        );
        $insert->execute([
            'session_id' => $token,
            'user_id' => $user['id'],
            'ip_address' => Request::ip(),
            'user_agent' => Request::userAgent(),
        ]);

        $updateLastLogin = $pdo->prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = :id');
        $updateLastLogin->execute(['id' => $user['id']]);

        Response::json([
            'message' => 'Signed in.',
            'token' => $token,
            'user' => [
                'id' => (int) $user['id'],
                'name' => Auth::displayName($user),
                'last_name' => $user['last_name'],
                'username' => $user['username'],
                'email' => $user['email'],
                'role' => strtolower((string) $user['role']),
                'staff_role' => $user['staff_role'],
                'role_label' => Auth::roleLabel($user),
                'branch' => $user['branch'],
                'profile_image' => Auth::assetUrl($user['profile_image'] ?? null),
            ],
        ]);
    }

    public function session(): void
    {
        $user = $this->authUser();

        Response::json([
            'message' => 'Session restored.',
            'user' => [
                'id' => (int) $user['id'],
                'name' => Auth::displayName($user),
                'last_name' => $user['last_name'],
                'username' => $user['username'],
                'email' => $user['email'],
                'role' => strtolower((string) $user['role']),
                'staff_role' => $user['staff_role'],
                'role_label' => Auth::roleLabel($user),
                'branch' => $user['branch'],
                'staff_id' => $user['staff_id'] ? (int) $user['staff_id'] : null,
                'profile_image' => Auth::assetUrl($user['profile_image'] ?? null),
            ],
        ]);
    }

    public function logout(): void
    {
        $token = Request::bearerToken();
        if ($token) {
            $pdo = Database::connection();
            $statement = $pdo->prepare('DELETE FROM sessions WHERE session_id = :token');
            $statement->execute(['token' => $token]);
        }

        Response::json(['message' => 'Signed out.']);
    }
}
