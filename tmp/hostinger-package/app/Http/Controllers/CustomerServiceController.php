<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Database;
use App\Support\Request;
use App\Support\Response;
use PDO;
use Throwable;

final class CustomerServiceController extends Controller
{
    public function index(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $branch = trim((string) ($user['branch'] ?? ''));
        $pdo = Database::connection();

        $this->ensureSchema($pdo);
        $this->syncFollowUps($pdo, $branch);

        Response::json([
            'templates' => $this->templates($pdo),
            'birthdays' => $this->birthdayQueue($pdo),
            'appointments' => $this->appointmentQueue($pdo, $role, $staffId, $branch),
            'dormantPatients' => $this->dormantQueue($pdo, $role, $staffId, $branch),
            'followUps' => $this->followUps($pdo, $role, $staffId, $branch),
            'smsLogs' => $this->smsLogs($pdo),
        ]);
    }

    public function storeTemplate(): void
    {
        $pdo = Database::connection();
        $payload = Request::json();
        $this->ensureSchema($pdo);

        $category = trim((string) ($payload['category'] ?? ''));
        $templateName = trim((string) ($payload['template_name'] ?? ''));
        $messageText = trim((string) ($payload['message_text'] ?? ''));

        if ($category === '' || $templateName === '' || $messageText === '') {
            Response::json(['message' => 'Category, template name, and message are required.'], 422);
        }

        $statement = $pdo->prepare(
            'INSERT INTO message_templates (category, template_name, message_text, created_at)
             VALUES (:category, :template_name, :message_text, CURRENT_TIMESTAMP)'
        );
        $statement->execute([
            'category' => $category,
            'template_name' => $templateName,
            'message_text' => $messageText,
        ]);

        Response::json([
            'message' => 'Template saved successfully.',
            'templates' => $this->templates($pdo),
        ]);
    }

    public function updateTemplate(): void
    {
        $pdo = Database::connection();
        $payload = Request::json();
        $this->ensureSchema($pdo);

        $templateId = isset($payload['id']) ? (int) $payload['id'] : 0;
        $category = trim((string) ($payload['category'] ?? ''));
        $templateName = trim((string) ($payload['template_name'] ?? ''));
        $messageText = trim((string) ($payload['message_text'] ?? ''));

        if ($templateId <= 0 || $category === '' || $templateName === '' || $messageText === '') {
            Response::json(['message' => 'Template, category, template name, and message are required.'], 422);
        }

        $statement = $pdo->prepare(
            'UPDATE message_templates
             SET category = :category,
                 template_name = :template_name,
                 message_text = :message_text
             WHERE id = :id
             LIMIT 1'
        );
        $statement->execute([
            'id' => $templateId,
            'category' => $category,
            'template_name' => $templateName,
            'message_text' => $messageText,
        ]);

        Response::json([
            'message' => 'Template updated successfully.',
            'templates' => $this->templates($pdo),
        ]);
    }

    public function deleteTemplate(): void
    {
        $pdo = Database::connection();
        $payload = Request::json();
        $this->ensureSchema($pdo);

        $templateId = isset($payload['id']) ? (int) $payload['id'] : 0;
        if ($templateId <= 0) {
            Response::json(['message' => 'Template ID is required.'], 422);
        }

        $statement = $pdo->prepare('DELETE FROM message_templates WHERE id = :id LIMIT 1');
        $statement->execute(['id' => $templateId]);

        Response::json([
            'message' => 'Template deleted successfully.',
            'templates' => $this->templates($pdo),
        ]);
    }

    public function sendSms(): void
    {
        $user = $this->authUser();
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $payload = Request::json();
        $pdo = Database::connection();

        $this->ensureSchema($pdo);

        $message = trim((string) ($payload['message'] ?? ''));
        $templateId = isset($payload['template_id']) ? (int) $payload['template_id'] : 0;
        $recipients = is_array($payload['recipients'] ?? null) ? $payload['recipients'] : [];
        $followUpId = isset($payload['follow_up_id']) ? (int) $payload['follow_up_id'] : 0;

        if ($message === '' && $templateId > 0) {
            $templateStatement = $pdo->prepare('SELECT message_text FROM message_templates WHERE id = :id LIMIT 1');
            $templateStatement->execute(['id' => $templateId]);
            $message = trim((string) $templateStatement->fetchColumn());
        }

        if ($message === '' || $recipients === []) {
            Response::json(['message' => 'A message and at least one recipient are required.'], 422);
        }

        $apiKey = trim((string) getenv('ARKESEL_API_KEY'));
        $senderId = trim((string) getenv('ARKESEL_SENDER_ID'));
        $sentCount = 0;
        $failedCount = 0;

        foreach ($recipients as $recipient) {
            $phone = $this->normalizePhoneNumber((string) ($recipient['phone'] ?? ''));
            $patientId = isset($recipient['patient_id']) ? (int) $recipient['patient_id'] : 0;
            $personalizedMessage = $this->personalizeMessage($message, [
                'first_name' => (string) ($recipient['first_name'] ?? ''),
                'last_name' => (string) ($recipient['last_name'] ?? ''),
            ]);

            if ($phone === null) {
                $this->logSms($pdo, $patientId, (string) ($recipient['phone'] ?? ''), $personalizedMessage, 'failed', 'Invalid phone number format');
                $failedCount++;
                continue;
            }

            $status = 'queued';
            $responseText = 'Arkesel credentials not configured.';

            if ($apiKey !== '' && $senderId !== '') {
                [$status, $responseText] = $this->dispatchSms($phone, $personalizedMessage, $apiKey, $senderId);
            }

            $this->logSms($pdo, $patientId, $phone, $personalizedMessage, $status, $responseText);

            if ($status === 'sent') {
                $sentCount++;
            } else {
                $failedCount++;
            }
        }

        if ($followUpId > 0 && $staffId > 0) {
            $this->markFollowUpContacted($pdo, $followUpId, $staffId, $message);
        }

        Response::json([
            'message' => sprintf('SMS processed for %d recipient(s), %d failed.', $sentCount, $failedCount),
            'smsLogs' => $this->smsLogs($pdo),
            'followUps' => $this->followUps($pdo, $this->normalizedRole($user), $staffId, trim((string) ($user['branch'] ?? ''))),
        ]);
    }

    public function updateFollowUp(): void
    {
        $user = $this->authUser();
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $payload = Request::json();
        $pdo = Database::connection();

        $this->ensureSchema($pdo);

        $followUpId = isset($payload['id']) ? (int) $payload['id'] : 0;
        $status = trim((string) ($payload['follow_up_status'] ?? ''));
        $contactedVia = trim((string) ($payload['contacted_via'] ?? 'none'));
        $notes = trim((string) ($payload['notes'] ?? ''));

        if ($followUpId <= 0 || $status === '') {
            Response::json(['message' => 'Follow-up record and status are required.'], 422);
        }

        $statement = $pdo->prepare(
            'UPDATE follow_up_patients
             SET follow_up_status = :status,
                 contacted_via = :contacted_via,
                 contacted_by = :contacted_by,
                 contacted_date = CASE WHEN :contacted_via = \'none\' THEN contacted_date ELSE CURRENT_TIMESTAMP END,
                 notes = :notes,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = :id
             LIMIT 1'
        );
        $statement->execute([
            'id' => $followUpId,
            'status' => $status,
            'contacted_via' => $contactedVia !== '' ? $contactedVia : 'none',
            'contacted_by' => $staffId > 0 ? $staffId : null,
            'notes' => $notes !== '' ? $notes : null,
        ]);

        if ($staffId > 0 && in_array($contactedVia, ['sms', 'call', 'email'], true)) {
            $history = $pdo->prepare(
                'INSERT INTO follow_up_history (follow_up_id, contact_type, contacted_by, response, notes, contact_date)
                 VALUES (:follow_up_id, :contact_type, :contacted_by, :response, :notes, CURRENT_TIMESTAMP)'
            );
            $history->execute([
                'follow_up_id' => $followUpId,
                'contact_type' => $contactedVia,
                'contacted_by' => $staffId,
                'response' => 'neutral',
                'notes' => $notes !== '' ? $notes : null,
            ]);
        }

        Response::json([
            'message' => 'Follow-up record updated successfully.',
            'followUps' => $this->followUps($pdo, $this->normalizedRole($user), $staffId, trim((string) ($user['branch'] ?? ''))),
        ]);
    }

    private function templates(PDO $pdo): array
    {
        $statement = $pdo->query(
            'SELECT id, category, template_name, message_text, created_at
             FROM message_templates
             ORDER BY category ASC, template_name ASC'
        );

        return array_map(static fn (array $row): array => [
            'id' => (int) ($row['id'] ?? 0),
            'category' => (string) ($row['category'] ?? ''),
            'templateName' => (string) ($row['template_name'] ?? ''),
            'messageText' => (string) ($row['message_text'] ?? ''),
            'createdAt' => (string) ($row['created_at'] ?? ''),
        ], $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    private function birthdayQueue(PDO $pdo): array
    {
        $statement = $pdo->query(
            "SELECT id, first_name, last_name, other_names, phone, email, birth_date
             FROM patients
             WHERE birth_date IS NOT NULL
               AND DATE_FORMAT(birth_date, '%m-%d') BETWEEN DATE_FORMAT(CURDATE(), '%m-%d')
               AND DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 7 DAY), '%m-%d')
             ORDER BY DATE_FORMAT(birth_date, '%m-%d') ASC"
        );

        return array_map(fn (array $row): array => $this->mapPatientQueueRow($row, 'Birthday outreach', 'birthday', (string) ($row['birth_date'] ?? '')), $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    private function appointmentQueue(PDO $pdo, string $role, int $staffId, string $branch): array
    {
        $sql = "
            SELECT
                a.id,
                a.patient_name,
                a.phone,
                a.appointment_date,
                a.appointment_time,
                a.status,
                a.notes,
                s.first_name,
                s.last_name,
                s.other_names,
                sb.branch
            FROM appointments a
            LEFT JOIN staff s ON s.id = a.dentist_id
            LEFT JOIN staff_branches sb ON sb.staff_id = s.id
            WHERE a.appointment_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)";
        $params = [];

        if ($role === 'receptionist' && $branch !== '') {
            $sql .= ' AND sb.branch = :branch';
            $params['branch'] = $branch;
        } elseif ($role === 'dentist' && $staffId > 0) {
            $sql .= ' AND a.dentist_id = :dentist_id';
            $params['dentist_id'] = $staffId;
        }

        $sql .= ' ORDER BY a.appointment_date ASC, a.appointment_time ASC';
        $statement = $pdo->prepare($sql);
        $statement->execute($params);

        return array_map(function (array $row): array {
            return [
                'id' => 'appointment-' . (int) ($row['id'] ?? 0),
                'patientId' => 0,
                'patientName' => (string) ($row['patient_name'] ?? ''),
                'firstName' => $this->extractFirstName((string) ($row['patient_name'] ?? '')),
                'lastName' => $this->extractLastName((string) ($row['patient_name'] ?? '')),
                'phone' => (string) ($row['phone'] ?? ''),
                'email' => '',
                'queueType' => 'appointment',
                'queueLabel' => 'Upcoming appointments',
                'eventDate' => (string) ($row['appointment_date'] ?? ''),
                'eventDateLabel' => !empty($row['appointment_date']) ? date('d M Y', strtotime((string) $row['appointment_date'])) : '',
                'timeLabel' => substr((string) ($row['appointment_time'] ?? ''), 0, 5),
                'status' => ucfirst((string) ($row['status'] ?? 'scheduled')),
                'note' => (string) ($row['notes'] ?? ''),
            ];
        }, $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    private function dormantQueue(PDO $pdo, string $role, int $staffId, string $branch): array
    {
        $sql = "
            SELECT
                p.id,
                p.first_name,
                p.last_name,
                p.other_names,
                p.phone,
                p.email,
                MAX(a.appointment_date) AS last_visit
            FROM patients p
            LEFT JOIN appointments a ON a.patient_name = CONCAT_WS(' ', p.first_name, NULLIF(p.other_names, ''), p.last_name)
            LEFT JOIN staff s ON s.id = a.dentist_id
            LEFT JOIN staff_branches sb ON sb.staff_id = s.id
            WHERE p.phone IS NOT NULL
              AND p.phone <> ''";
        $params = [];

        if ($role === 'receptionist' && $branch !== '') {
            $sql .= ' AND (sb.branch = :branch OR sb.branch IS NULL)';
            $params['branch'] = $branch;
        } elseif ($role === 'dentist' && $staffId > 0) {
            $sql .= ' AND a.dentist_id = :dentist_id';
            $params['dentist_id'] = $staffId;
        }

        $sql .= "
            GROUP BY p.id, p.first_name, p.last_name, p.other_names, p.phone, p.email
            HAVING last_visit IS NULL OR last_visit < DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            ORDER BY last_visit ASC, p.first_name ASC";

        $statement = $pdo->prepare($sql);
        $statement->execute($params);

        return array_map(fn (array $row): array => $this->mapPatientQueueRow($row, 'Dormant patients', 'dormant', (string) ($row['last_visit'] ?? '')), $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    private function followUps(PDO $pdo, string $role, int $staffId, string $branch): array
    {
        $sql = "
            SELECT
                f.id,
                f.patient_id,
                f.patient_name,
                f.phone,
                f.email,
                f.last_appointment_date,
                f.days_since_last_visit,
                f.contacted_via,
                f.contacted_date,
                f.follow_up_status,
                f.notes
            FROM follow_up_patients f
            WHERE 1=1";
        $params = [];

        if ($role === 'dentist' && $staffId > 0) {
            $sql .= ' AND EXISTS (
                SELECT 1
                FROM appointments a
                WHERE a.patient_name COLLATE utf8mb4_unicode_ci = f.patient_name
                  AND a.dentist_id = :dentist_id
            )';
            $params['dentist_id'] = $staffId;
        }

        $sql .= ' ORDER BY f.days_since_last_visit DESC, f.updated_at DESC';
        $statement = $pdo->prepare($sql);
        $statement->execute($params);

        return array_map(static fn (array $row): array => [
            'id' => (int) ($row['id'] ?? 0),
            'patientId' => (int) ($row['patient_id'] ?? 0),
            'patientName' => (string) ($row['patient_name'] ?? ''),
            'phone' => (string) ($row['phone'] ?? ''),
            'email' => (string) ($row['email'] ?? ''),
            'lastAppointmentDate' => (string) ($row['last_appointment_date'] ?? ''),
            'lastAppointmentLabel' => !empty($row['last_appointment_date']) ? date('d M Y', strtotime((string) ($row['last_appointment_date'] ?? ''))) : 'No appointment yet',
            'daysSinceLastVisit' => isset($row['days_since_last_visit']) ? (int) $row['days_since_last_visit'] : null,
            'contactedVia' => ucfirst((string) ($row['contacted_via'] ?? 'none')),
            'contactedDateLabel' => !empty($row['contacted_date']) ? date('d M Y h:i A', strtotime((string) ($row['contacted_date'] ?? ''))) : 'Not contacted',
            'followUpStatus' => ucfirst(str_replace('_', ' ', (string) ($row['follow_up_status'] ?? 'pending'))),
            'notes' => (string) ($row['notes'] ?? ''),
        ], $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    private function smsLogs(PDO $pdo): array
    {
        $statement = $pdo->query(
            'SELECT id, patient_id, phone, message, status, response, created_at
             FROM sms_logs
             ORDER BY created_at DESC, id DESC
             LIMIT 60'
        );

        return array_map(static fn (array $row): array => [
            'id' => (int) ($row['id'] ?? 0),
            'patientId' => isset($row['patient_id']) ? (int) $row['patient_id'] : 0,
            'phone' => (string) ($row['phone'] ?? ''),
            'message' => (string) ($row['message'] ?? ''),
            'status' => ucfirst((string) ($row['status'] ?? 'queued')),
            'response' => (string) ($row['response'] ?? ''),
            'createdAtLabel' => !empty($row['created_at']) ? date('d M Y h:i A', strtotime((string) ($row['created_at'] ?? ''))) : '',
        ], $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    private function mapPatientQueueRow(array $row, string $queueLabel, string $queueType, string $eventDate): array
    {
        return [
            'id' => (int) ($row['id'] ?? 0),
            'patientId' => (int) ($row['id'] ?? 0),
            'patientName' => trim(implode(' ', array_filter([
                $row['first_name'] ?? '',
                $row['other_names'] ?? '',
                $row['last_name'] ?? '',
            ]))),
            'firstName' => (string) ($row['first_name'] ?? ''),
            'lastName' => (string) ($row['last_name'] ?? ''),
            'phone' => (string) ($row['phone'] ?? ''),
            'email' => (string) ($row['email'] ?? ''),
            'queueType' => $queueType,
            'queueLabel' => $queueLabel,
            'eventDate' => $eventDate,
            'eventDateLabel' => $eventDate !== '' ? date('d M Y', strtotime($eventDate)) : 'Not available',
            'timeLabel' => '',
            'status' => 'Pending',
            'note' => '',
        ];
    }

    private function syncFollowUps(PDO $pdo, string $branch): void
    {
        $dormantItems = $this->dormantQueue($pdo, 'receptionist', 0, $branch);
        $existing = $pdo->query('SELECT patient_id FROM follow_up_patients')->fetchAll(PDO::FETCH_COLUMN);
        $existingIds = array_map('intval', $existing ?: []);

        $insert = $pdo->prepare(
            'INSERT INTO follow_up_patients (
                patient_id,
                patient_name,
                phone,
                email,
                last_appointment_date,
                days_since_last_visit,
                contacted_via,
                follow_up_status,
                created_at,
                updated_at
            ) VALUES (
                :patient_id,
                :patient_name,
                :phone,
                :email,
                :last_appointment_date,
                :days_since_last_visit,
                :contacted_via,
                :follow_up_status,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            )'
        );

        foreach ($dormantItems as $item) {
            $patientId = (int) ($item['patientId'] ?? 0);
            if ($patientId <= 0 || in_array($patientId, $existingIds, true)) {
                continue;
            }

            $days = null;
            if (!empty($item['eventDate']) && strtotime((string) $item['eventDate']) !== false) {
                $days = (int) floor((time() - strtotime((string) $item['eventDate'])) / 86400);
            }

            $insert->execute([
                'patient_id' => $patientId,
                'patient_name' => (string) ($item['patientName'] ?? ''),
                'phone' => (string) ($item['phone'] ?? ''),
                'email' => (string) ($item['email'] ?? ''),
                'last_appointment_date' => $item['eventDate'] !== '' ? $item['eventDate'] : null,
                'days_since_last_visit' => $days,
                'contacted_via' => 'none',
                'follow_up_status' => 'pending',
            ]);
        }
    }

    private function ensureSchema(PDO $pdo): void
    {
        $pdo->exec("CREATE TABLE IF NOT EXISTS message_templates (
            id INT AUTO_INCREMENT PRIMARY KEY,
            category VARCHAR(100) NOT NULL,
            template_name VARCHAR(255) NOT NULL,
            message_text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS sms_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            patient_id INT NULL,
            phone VARCHAR(30) NULL,
            message TEXT NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'queued',
            response TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS follow_up_patients (
            id INT AUTO_INCREMENT PRIMARY KEY,
            patient_id INT NOT NULL,
            patient_name VARCHAR(255) NOT NULL,
            phone VARCHAR(30) NULL,
            email VARCHAR(255) NULL,
            last_appointment_date DATE NULL,
            days_since_last_visit INT NULL,
            contacted_via VARCHAR(20) NOT NULL DEFAULT 'none',
            contacted_date DATETIME NULL,
            contacted_by INT NULL,
            follow_up_status VARCHAR(50) NOT NULL DEFAULT 'pending',
            notes TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_follow_up_patient (patient_id),
            INDEX idx_follow_up_status (follow_up_status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS follow_up_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            follow_up_id INT NOT NULL,
            contact_type VARCHAR(20) NOT NULL,
            contact_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            contacted_by INT NULL,
            response VARCHAR(50) NOT NULL DEFAULT 'neutral',
            notes TEXT NULL,
            INDEX idx_follow_up_history (follow_up_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    }

    private function normalizePhoneNumber(string $phone): ?string
    {
        $clean = preg_replace('/[^0-9+]/', '', $phone);
        if ($clean === null || $clean === '') {
            return null;
        }

        if (preg_match('/^0\d{9}$/', $clean) === 1) {
            $clean = '+233' . substr($clean, 1);
        } elseif (preg_match('/^233\d{9}$/', $clean) === 1) {
            $clean = '+' . $clean;
        } elseif ($clean[0] !== '+') {
            $clean = '+233' . ltrim($clean, '0');
        }

        return preg_match('/^\+\d{10,15}$/', $clean) === 1 ? $clean : null;
    }

    private function personalizeMessage(string $message, array $recipient): string
    {
        $firstName = trim((string) ($recipient['first_name'] ?? ''));
        $lastName = trim((string) ($recipient['last_name'] ?? ''));
        $fullName = trim($firstName . ' ' . $lastName);

        return str_replace(
            ['{first_name}', '{last_name}', '{full_name}'],
            [$firstName, $lastName, $fullName],
            $message
        );
    }

    private function dispatchSms(string $phone, string $message, string $apiKey, string $senderId): array
    {
        $url = 'https://sms.arkesel.com/sms/api?' . http_build_query([
            'action' => 'send-sms',
            'api_key' => $apiKey,
            'to' => $phone,
            'from' => $senderId,
            'sms' => $message,
        ]);

        $handle = curl_init($url);
        curl_setopt($handle, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($handle, CURLOPT_TIMEOUT, 30);
        $response = curl_exec($handle);
        $httpCode = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
        $error = curl_error($handle);
        curl_close($handle);

        if ($error !== '') {
            return ['failed', $error];
        }

        if ($httpCode === 200 && is_string($response) && str_contains($response, '"code":"ok"')) {
            return ['sent', $response];
        }

        return ['failed', is_string($response) ? $response : 'Unable to send SMS right now.'];
    }

    private function logSms(PDO $pdo, int $patientId, string $phone, string $message, string $status, string $response): void
    {
        $statement = $pdo->prepare(
            'INSERT INTO sms_logs (patient_id, phone, message, status, response, created_at)
             VALUES (:patient_id, :phone, :message, :status, :response, CURRENT_TIMESTAMP)'
        );
        $statement->execute([
            'patient_id' => $patientId > 0 ? $patientId : null,
            'phone' => $phone,
            'message' => $message,
            'status' => $status,
            'response' => $response,
        ]);
    }

    private function markFollowUpContacted(PDO $pdo, int $followUpId, int $staffId, string $message): void
    {
        $statement = $pdo->prepare(
            'UPDATE follow_up_patients
             SET contacted_via = :contacted_via,
                 contacted_date = CURRENT_TIMESTAMP,
                 contacted_by = :contacted_by,
                 follow_up_status = :follow_up_status,
                 notes = CONCAT(COALESCE(notes, \'\'), CASE WHEN COALESCE(notes, \'\') = \'\' THEN \'\' ELSE CHAR(10) END, :notes)
             WHERE id = :id
             LIMIT 1'
        );
        $statement->execute([
            'id' => $followUpId,
            'contacted_via' => 'sms',
            'contacted_by' => $staffId,
            'follow_up_status' => 'contacted',
            'notes' => 'SMS sent: ' . $message,
        ]);

        $history = $pdo->prepare(
            'INSERT INTO follow_up_history (follow_up_id, contact_type, contacted_by, response, notes, contact_date)
             VALUES (:follow_up_id, :contact_type, :contacted_by, :response, :notes, CURRENT_TIMESTAMP)'
        );
        $history->execute([
            'follow_up_id' => $followUpId,
            'contact_type' => 'sms',
            'contacted_by' => $staffId,
            'response' => 'neutral',
            'notes' => 'SMS sent from customer service workspace.',
        ]);
    }

    private function extractFirstName(string $fullName): string
    {
        $parts = preg_split('/\s+/', trim($fullName)) ?: [];
        return $parts[0] ?? '';
    }

    private function extractLastName(string $fullName): string
    {
        $parts = preg_split('/\s+/', trim($fullName)) ?: [];
        return count($parts) > 1 ? (string) end($parts) : '';
    }
}
