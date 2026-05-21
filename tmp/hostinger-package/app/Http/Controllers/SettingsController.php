<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Database;
use App\Support\Env;
use App\Support\Response;
use PDO;
use Throwable;

final class SettingsController extends Controller
{
    public function index(): void
    {
        $pdo = Database::connection();
        $this->ensureSettingsSchema($pdo);
        $settings = $this->latestSettings($pdo);

        Response::json([
            'branding' => $this->brandingPayload($settings),
        ]);
    }

    public function store(): void
    {
        $user = $this->authUser();

        if ($this->normalizedRole($user) !== 'admin') {
            Response::json(['message' => 'Only admin users can update settings.'], 403);
        }

        $pdo = Database::connection();
        $this->ensureSettingsSchema($pdo);
        $current = $this->latestSettings($pdo);

        $clinicName = trim((string) ($_POST['clinic_name'] ?? $current['clinic_name'] ?? ''));
        $address = trim((string) ($_POST['address'] ?? $current['address'] ?? ''));
        $phone = trim((string) ($_POST['phone'] ?? $current['phone'] ?? ''));
        $email = trim((string) ($_POST['email'] ?? $current['email'] ?? ''));

        if ($clinicName === '' || $address === '' || $phone === '' || $email === '') {
            Response::json(['message' => 'Clinic name, address, phone, and email are required.'], 422);
        }

        $loginWallpaper = $current['login_wallpaper'] ?? null;
        $heroImage = $current['hero_image'] ?? null;
        $sidebarLogo = $current['sidebar_logo'] ?? null;

        try {
            if (isset($_FILES['login_wallpaper']) && (int) ($_FILES['login_wallpaper']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
                $loginWallpaper = $this->storeUpload($_FILES['login_wallpaper'], 'login-wallpaper');
            }

            if (isset($_FILES['hero_image']) && (int) ($_FILES['hero_image']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
                $heroImage = $this->storeUpload($_FILES['hero_image'], 'hero-image');
            }

            if (isset($_FILES['sidebar_logo']) && (int) ($_FILES['sidebar_logo']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
                $sidebarLogo = $this->storeUpload($_FILES['sidebar_logo'], 'sidebar-logo');
            }
        } catch (Throwable $exception) {
            Response::json(['message' => $exception->getMessage()], 422);
        }

        if ($current) {
            $statement = $pdo->prepare(
                'UPDATE settings
                 SET clinic_name = :clinic_name,
                     address = :address,
                     phone = :phone,
                     email = :email,
                     login_wallpaper = :login_wallpaper,
                     hero_image = :hero_image,
                     sidebar_logo = :sidebar_logo
                 WHERE id = :id'
            );
            $statement->execute([
                'clinic_name' => $clinicName,
                'address' => $address,
                'phone' => $phone,
                'email' => $email,
                'login_wallpaper' => $loginWallpaper,
                'hero_image' => $heroImage,
                'sidebar_logo' => $sidebarLogo,
                'id' => $current['id'],
            ]);
        } else {
            $statement = $pdo->prepare(
                'INSERT INTO settings (clinic_name, address, phone, email, login_wallpaper, hero_image, sidebar_logo)
                 VALUES (:clinic_name, :address, :phone, :email, :login_wallpaper, :hero_image, :sidebar_logo)'
            );
            $statement->execute([
                'clinic_name' => $clinicName,
                'address' => $address,
                'phone' => $phone,
                'email' => $email,
                'login_wallpaper' => $loginWallpaper,
                'hero_image' => $heroImage,
                'sidebar_logo' => $sidebarLogo,
            ]);
        }

        Response::json([
            'message' => 'Settings updated successfully.',
            'branding' => $this->brandingPayload($this->latestSettings($pdo)),
        ]);
    }

    private function latestSettings(PDO $pdo): array
    {
        $statement = $pdo->query(
            'SELECT id, clinic_name, address, phone, email, login_wallpaper, hero_image, sidebar_logo
             FROM settings
             ORDER BY id DESC
             LIMIT 1'
        );

        return $statement->fetch(PDO::FETCH_ASSOC) ?: [];
    }

    private function brandingPayload(array $settings): array
    {
        $clinicName = trim((string) ($settings['clinic_name'] ?? ''));
        if ($clinicName === '' || $clinicName === 'Dentiplus Clinic Network' || $clinicName === 'Dentiplus Management Software') {
            $clinicName = 'eDENTAL CLINICS';
        }

        return [
            'clinicName' => $clinicName,
            'address' => $settings['address'] ?? 'Clinic address not yet configured',
            'phone' => $settings['phone'] ?? '+233 000 000 000',
            'email' => $settings['email'] ?? 'support@dentiplus.local',
            'loginWallpaper' => $this->assetUrl($settings['login_wallpaper'] ?? null),
            'heroImage' => $this->assetUrl($settings['hero_image'] ?? null),
            'dashboardWallpaper' => $this->assetUrl($settings['hero_image'] ?? null),
            'sidebarLogo' => $this->assetUrl($settings['sidebar_logo'] ?? null) ?? '/edental-clinics-logo.jpeg',
        ];
    }

    private function ensureSettingsSchema(PDO $pdo): void
    {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS settings (
                id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
                clinic_name VARCHAR(255) NOT NULL,
                address VARCHAR(255) NOT NULL,
                phone VARCHAR(50) NOT NULL,
                email VARCHAR(255) NOT NULL,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );

        $columns = $pdo->query('SHOW COLUMNS FROM settings')->fetchAll(PDO::FETCH_COLUMN) ?: [];

        if (!in_array('login_wallpaper', $columns, true)) {
            $pdo->exec('ALTER TABLE settings ADD COLUMN login_wallpaper VARCHAR(255) DEFAULT NULL AFTER email');
        }

        if (!in_array('hero_image', $columns, true)) {
            $pdo->exec('ALTER TABLE settings ADD COLUMN hero_image VARCHAR(255) DEFAULT NULL AFTER login_wallpaper');
        }

        if (!in_array('sidebar_logo', $columns, true)) {
            $pdo->exec('ALTER TABLE settings ADD COLUMN sidebar_logo VARCHAR(255) DEFAULT NULL AFTER hero_image');
        }
    }

    private function storeUpload(array $file, string $prefix): string
    {
        $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);

        if ($error !== UPLOAD_ERR_OK) {
            throw new \RuntimeException('One of the uploaded images could not be processed.');
        }

        $tmpName = (string) ($file['tmp_name'] ?? '');
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            throw new \RuntimeException('The uploaded image is invalid.');
        }

        $mimeType = mime_content_type($tmpName) ?: '';
        $allowedTypes = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
        ];

        if (!isset($allowedTypes[$mimeType])) {
            throw new \RuntimeException('Please upload a JPG, PNG, or WEBP image.');
        }

        if (((int) ($file['size'] ?? 0)) > 5 * 1024 * 1024) {
            throw new \RuntimeException('Please keep each uploaded image under 5MB.');
        }

        $uploadDir = dirname(__DIR__, 3) . '/public/uploads/settings';
        if (!is_dir($uploadDir) && !mkdir($uploadDir, 0777, true) && !is_dir($uploadDir)) {
            throw new \RuntimeException('The settings upload folder could not be created.');
        }

        $filename = sprintf('%s-%s.%s', $prefix, date('YmdHis'), $allowedTypes[$mimeType]);
        $destination = $uploadDir . '/' . $filename;

        if (!move_uploaded_file($tmpName, $destination)) {
            throw new \RuntimeException('The uploaded image could not be saved.');
        }

        return 'uploads/settings/' . $filename;
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
