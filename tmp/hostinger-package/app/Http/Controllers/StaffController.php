<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Auth;
use App\Support\Database;
use App\Support\Env;
use App\Support\Request;
use App\Support\Response;
use PDO;
use Throwable;

final class StaffController extends Controller
{
    public function index(): void
    {
        $user = $this->authUser();

        if ($this->normalizedRole($user) !== 'admin') {
            Response::json(['message' => 'Only admin users can manage staff.'], 403);
        }

        $pdo = Database::connection();
        $this->ensureStaffSchema($pdo);

        $statement = $pdo->query(
            "SELECT
                s.id AS staff_id,
                s.user_id,
                s.first_name,
                s.last_name,
                s.other_names,
                s.phone,
                s.email AS staff_email,
                s.role AS staff_role,
                s.profile_image,
                u.username,
                u.email AS user_email,
                u.role AS user_role,
                u.is_active,
                u.last_login,
                COALESCE(sb.branch, 'Main clinic') AS branch
             FROM staff s
             INNER JOIN users u ON u.id = s.user_id
             LEFT JOIN staff_branches sb ON sb.staff_id = s.id
             ORDER BY s.created_at DESC, s.id DESC"
        );

        $items = array_map(function (array $row): array {
            $staffRole = (string) ($row['staff_role'] ?? 'Admin');

            return [
                'id' => (int) ($row['staff_id'] ?? 0),
                'staffId' => (int) ($row['staff_id'] ?? 0),
                'userId' => (int) ($row['user_id'] ?? 0),
                'name' => Auth::staffDisplayName([
                    'first_name' => $row['first_name'] ?? '',
                    'other_names' => $row['other_names'] ?? '',
                    'last_name' => $row['last_name'] ?? '',
                    'staff_role' => $staffRole,
                    'username' => $row['username'] ?? '',
                ], strtolower($staffRole)),
                'firstName' => (string) ($row['first_name'] ?? ''),
                'lastName' => (string) ($row['last_name'] ?? ''),
                'otherNames' => (string) ($row['other_names'] ?? ''),
                'phone' => (string) ($row['phone'] ?? ''),
                'email' => (string) ($row['user_email'] ?? $row['staff_email'] ?? ''),
                'username' => (string) ($row['username'] ?? ''),
                'role' => $staffRole,
                'branch' => (string) ($row['branch'] ?? 'Main clinic'),
                'status' => (int) ($row['is_active'] ?? 0) === 1 ? 'Active' : 'Inactive',
                'isActive' => (int) ($row['is_active'] ?? 0) === 1,
                'lastLogin' => (string) ($row['last_login'] ?? ''),
                'lastLoginLabel' => !empty($row['last_login']) ? date('d M Y h:i A', strtotime((string) $row['last_login'])) : 'Never',
                'profileImage' => $this->assetUrl($row['profile_image'] ?? null),
            ];
        }, $statement->fetchAll(PDO::FETCH_ASSOC) ?: []);

        Response::json([
            'items' => $items,
        ]);
    }

    public function store(): void
    {
        $user = $this->authUser();

        if ($this->normalizedRole($user) !== 'admin') {
            Response::json(['message' => 'Only admin users can create staff accounts.'], 403);
        }

        $pdo = Database::connection();
        $this->ensureStaffSchema($pdo);

        $firstName = trim((string) ($_POST['first_name'] ?? ''));
        $lastName = trim((string) ($_POST['last_name'] ?? ''));
        $otherNames = trim((string) ($_POST['other_names'] ?? ''));
        $phone = trim((string) ($_POST['phone'] ?? ''));
        $email = trim((string) ($_POST['email'] ?? ''));
        $username = trim((string) ($_POST['username'] ?? ''));
        $role = $this->normalizeStaffRole((string) ($_POST['role'] ?? ''));
        $branch = trim((string) ($_POST['branch'] ?? ''));
        $password = (string) ($_POST['password'] ?? '');
        $isActive = (int) ($_POST['is_active'] ?? 1) === 1 ? 1 : 0;

        if ($firstName === '' || $lastName === '' || $phone === '' || $email === '' || $username === '' || $role === '' || $branch === '' || strlen($password) < 6) {
            Response::json(['message' => 'First name, last name, phone, email, username, role, branch, and a password of at least 6 characters are required.'], 422);
        }

        $profileImage = null;

        try {
            if (isset($_FILES['profile_image']) && (int) ($_FILES['profile_image']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
                $profileImage = $this->storeUpload($_FILES['profile_image'], 'staff-profile');
            }
        } catch (Throwable $exception) {
            Response::json(['message' => $exception->getMessage()], 422);
        }

        $pdo->beginTransaction();

        try {
            $insertUser = $pdo->prepare(
                'INSERT INTO users (username, password, email, role, is_active)
                 VALUES (:username, :password, :email, :role, :is_active)'
            );
            $insertUser->execute([
                'username' => $username,
                'password' => password_hash($password, PASSWORD_DEFAULT),
                'email' => $email,
                'role' => $this->mapUserRole($role),
                'is_active' => $isActive,
            ]);

            $userId = (int) $pdo->lastInsertId();

            $insertStaff = $pdo->prepare(
                'INSERT INTO staff (user_id, first_name, last_name, other_names, phone, role, email, profile_image)
                 VALUES (:user_id, :first_name, :last_name, :other_names, :phone, :role, :email, :profile_image)'
            );
            $insertStaff->execute([
                'user_id' => $userId,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'other_names' => $otherNames !== '' ? $otherNames : null,
                'phone' => $phone,
                'role' => $role,
                'email' => $email,
                'profile_image' => $profileImage,
            ]);

            $staffId = (int) $pdo->lastInsertId();

            $insertBranch = $pdo->prepare(
                'INSERT INTO staff_branches (staff_id, branch)
                 VALUES (:staff_id, :branch)'
            );
            $insertBranch->execute([
                'staff_id' => $staffId,
                'branch' => $branch,
            ]);

            $pdo->commit();
        } catch (Throwable $exception) {
            $pdo->rollBack();
            Response::json(['message' => 'Unable to create this staff account right now. Check that the username and email are unique.'], 409);
        }

        $this->index();
    }

    public function update(): void
    {
        $user = $this->authUser();

        if ($this->normalizedRole($user) !== 'admin') {
            Response::json(['message' => 'Only admin users can update staff accounts.'], 403);
        }

        $pdo = Database::connection();
        $this->ensureStaffSchema($pdo);

        $staffId = (int) ($_POST['staff_id'] ?? 0);
        if ($staffId <= 0) {
            Response::json(['message' => 'Choose a valid staff record to update.'], 422);
        }

        $current = $this->staffRow($pdo, $staffId);
        if (!$current) {
            Response::json(['message' => 'The selected staff record could not be found.'], 404);
        }

        $firstName = trim((string) ($_POST['first_name'] ?? $current['first_name'] ?? ''));
        $lastName = trim((string) ($_POST['last_name'] ?? $current['last_name'] ?? ''));
        $otherNames = trim((string) ($_POST['other_names'] ?? $current['other_names'] ?? ''));
        $phone = trim((string) ($_POST['phone'] ?? $current['phone'] ?? ''));
        $email = trim((string) ($_POST['email'] ?? $current['user_email'] ?? ''));
        $username = trim((string) ($_POST['username'] ?? $current['username'] ?? ''));
        $role = $this->normalizeStaffRole((string) ($_POST['role'] ?? $current['staff_role'] ?? ''));
        $branch = trim((string) ($_POST['branch'] ?? $current['branch'] ?? 'Main clinic'));
        $isActive = (int) ($_POST['is_active'] ?? ((int) ($current['is_active'] ?? 1))) === 1 ? 1 : 0;

        if ($firstName === '' || $lastName === '' || $phone === '' || $email === '' || $username === '' || $role === '' || $branch === '') {
            Response::json(['message' => 'First name, last name, phone, email, username, role, and branch are required.'], 422);
        }

        $profileImage = (string) ($current['profile_image'] ?? '');

        try {
            if (isset($_FILES['profile_image']) && (int) ($_FILES['profile_image']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
                $profileImage = $this->storeUpload($_FILES['profile_image'], 'staff-profile');
            }
        } catch (Throwable $exception) {
            Response::json(['message' => $exception->getMessage()], 422);
        }

        $pdo->beginTransaction();

        try {
            $updateUser = $pdo->prepare(
                'UPDATE users
                 SET username = :username,
                     email = :email,
                     role = :role,
                     is_active = :is_active
                 WHERE id = :user_id
                 LIMIT 1'
            );
            $updateUser->execute([
                'username' => $username,
                'email' => $email,
                'role' => $this->mapUserRole($role),
                'is_active' => $isActive,
                'user_id' => (int) ($current['user_id'] ?? 0),
            ]);

            $updateStaff = $pdo->prepare(
                'UPDATE staff
                 SET first_name = :first_name,
                     last_name = :last_name,
                     other_names = :other_names,
                     phone = :phone,
                     role = :role,
                     email = :email,
                     profile_image = :profile_image
                 WHERE id = :staff_id
                 LIMIT 1'
            );
            $updateStaff->execute([
                'first_name' => $firstName,
                'last_name' => $lastName,
                'other_names' => $otherNames !== '' ? $otherNames : null,
                'phone' => $phone,
                'role' => $role,
                'email' => $email,
                'profile_image' => $profileImage !== '' ? $profileImage : null,
                'staff_id' => $staffId,
            ]);

            $deleteBranch = $pdo->prepare('DELETE FROM staff_branches WHERE staff_id = :staff_id');
            $deleteBranch->execute(['staff_id' => $staffId]);

            $insertBranch = $pdo->prepare('INSERT INTO staff_branches (staff_id, branch) VALUES (:staff_id, :branch)');
            $insertBranch->execute([
                'staff_id' => $staffId,
                'branch' => $branch,
            ]);

            $pdo->commit();
        } catch (Throwable $exception) {
            $pdo->rollBack();
            Response::json(['message' => 'Unable to update this staff account right now. Check that the username and email are unique.'], 409);
        }

        $this->index();
    }

    public function resetPassword(): void
    {
        $user = $this->authUser();

        if ($this->normalizedRole($user) !== 'admin') {
            Response::json(['message' => 'Only admin users can reset staff passwords.'], 403);
        }

        $payload = Request::json();
        $staffId = (int) ($payload['staff_id'] ?? 0);
        $newPassword = (string) ($payload['new_password'] ?? '');

        if ($staffId <= 0 || strlen($newPassword) < 6) {
            Response::json(['message' => 'Choose a staff user and provide a new password of at least 6 characters.'], 422);
        }

        $pdo = Database::connection();
        $this->ensureStaffSchema($pdo);
        $current = $this->staffRow($pdo, $staffId);

        if (!$current) {
            Response::json(['message' => 'The selected staff record could not be found.'], 404);
        }

        $statement = $pdo->prepare(
            'UPDATE users
             SET password = :password
             WHERE id = :user_id
             LIMIT 1'
        );
        $statement->execute([
            'password' => password_hash($newPassword, PASSWORD_DEFAULT),
            'user_id' => (int) ($current['user_id'] ?? 0),
        ]);

        Response::json([
            'message' => 'Password reset successfully.',
        ]);
    }

    public function delete(): void
    {
        $user = $this->authUser();

        if ($this->normalizedRole($user) !== 'admin') {
            Response::json(['message' => 'Only admin users can delete staff accounts.'], 403);
        }

        $payload = Request::json();
        $staffId = (int) ($payload['staff_id'] ?? 0);

        if ($staffId <= 0) {
            Response::json(['message' => 'Choose a valid staff record to delete.'], 422);
        }

        $pdo = Database::connection();
        $this->ensureStaffSchema($pdo);
        $current = $this->staffRow($pdo, $staffId);

        if (!$current) {
            Response::json(['message' => 'The selected staff record could not be found.'], 404);
        }

        if ((int) ($current['user_id'] ?? 0) === (int) ($user['id'] ?? 0)) {
            Response::json(['message' => 'You cannot delete the account you are currently signed in with.'], 422);
        }

        $pdo->beginTransaction();

        try {
            $deleteSessions = $pdo->prepare('DELETE FROM sessions WHERE user_id = :user_id');
            $deleteSessions->execute(['user_id' => (int) ($current['user_id'] ?? 0)]);

            $deleteBranches = $pdo->prepare('DELETE FROM staff_branches WHERE staff_id = :staff_id');
            $deleteBranches->execute(['staff_id' => $staffId]);

            $deleteStaff = $pdo->prepare('DELETE FROM staff WHERE id = :staff_id LIMIT 1');
            $deleteStaff->execute(['staff_id' => $staffId]);

            $deleteUser = $pdo->prepare('DELETE FROM users WHERE id = :user_id LIMIT 1');
            $deleteUser->execute(['user_id' => (int) ($current['user_id'] ?? 0)]);

            $pdo->commit();
        } catch (Throwable $exception) {
            $pdo->rollBack();
            Response::json(['message' => 'Unable to delete this staff account right now.'], 409);
        }

        $this->index();
    }

    private function staffRow(PDO $pdo, int $staffId): ?array
    {
        $statement = $pdo->prepare(
            "SELECT
                s.*,
                u.username,
                u.email AS user_email,
                u.role AS user_role,
                u.is_active,
                COALESCE(sb.branch, 'Main clinic') AS branch
             FROM staff s
             INNER JOIN users u ON u.id = s.user_id
             LEFT JOIN staff_branches sb ON sb.staff_id = s.id
             WHERE s.id = :staff_id
             LIMIT 1"
        );
        $statement->execute(['staff_id' => $staffId]);

        $row = $statement->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    private function ensureStaffSchema(PDO $pdo): void
    {
        $columns = $pdo->query('SHOW COLUMNS FROM staff')->fetchAll(PDO::FETCH_COLUMN) ?: [];

        if (!in_array('profile_image', $columns, true)) {
            $pdo->exec('ALTER TABLE staff ADD COLUMN profile_image VARCHAR(255) DEFAULT NULL AFTER email');
        }
    }

    private function normalizeStaffRole(string $role): string
    {
        $normalized = strtolower(trim($role));

        return match ($normalized) {
            'ceo' => 'CEO',
            'dentist' => 'Dentist',
            'receptionist' => 'Receptionist',
            'nurse' => 'Nurse',
            'accountant' => 'Accountant',
            default => '',
        };
    }

    private function mapUserRole(string $staffRole): string
    {
        return match (strtolower(trim($staffRole))) {
            'dentist' => 'dentist',
            'receptionist' => 'receptionist',
            'nurse' => 'nurse',
            default => 'admin',
        };
    }

    private function storeUpload(array $file, string $prefix): string
    {
        $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);

        if ($error !== UPLOAD_ERR_OK) {
            throw new \RuntimeException('The uploaded profile image could not be processed.');
        }

        $tmpName = (string) ($file['tmp_name'] ?? '');
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            throw new \RuntimeException('The uploaded profile image is invalid.');
        }

        $mimeType = mime_content_type($tmpName) ?: '';
        $allowedTypes = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
        ];

        if (!isset($allowedTypes[$mimeType])) {
            throw new \RuntimeException('Please upload a JPG, PNG, or WEBP profile image.');
        }

        if (((int) ($file['size'] ?? 0)) > 5 * 1024 * 1024) {
            throw new \RuntimeException('Please keep the profile image under 5MB.');
        }

        $uploadDir = dirname(__DIR__, 3) . '/public/uploads/staff';
        if (!is_dir($uploadDir) && !mkdir($uploadDir, 0777, true) && !is_dir($uploadDir)) {
            throw new \RuntimeException('The staff upload folder could not be created.');
        }

        $filename = sprintf('%s-%s.%s', $prefix, date('YmdHis') . '-' . bin2hex(random_bytes(3)), $allowedTypes[$mimeType]);
        $destination = $uploadDir . '/' . $filename;

        if (!move_uploaded_file($tmpName, $destination)) {
            throw new \RuntimeException('The uploaded profile image could not be saved.');
        }

        return 'uploads/staff/' . $filename;
    }

    private function assetUrl(?string $path): ?string
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
}
