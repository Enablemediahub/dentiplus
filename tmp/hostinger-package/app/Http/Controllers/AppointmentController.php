<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Auth;
use App\Support\Database;
use App\Support\Request;
use App\Support\Response;
use PDO;

final class AppointmentController extends Controller
{
    public function index(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $pdo = Database::connection();
        $branch = $this->resolvedBranchFilter($pdo, $user);

        $items = $this->appointments($pdo, $role, $staffId, $branch);
        $todayItems = array_values(array_filter(
            $items,
            static fn (array $item): bool => ($item['isToday'] ?? false) === true
        ));

        Response::json([
            'items' => $items,
            'todayItems' => $todayItems,
            'dentists' => $this->dentists($pdo, $role, $branch),
            'branch' => $branch,
        ]);
    }

    public function store(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $branch = trim((string) ($user['branch'] ?? ''));
        $payload = Request::json();
        $pdo = Database::connection();

        $patientId = isset($payload['patient_id']) ? (int) $payload['patient_id'] : 0;
        $dentistId = isset($payload['dentist_id']) ? (int) $payload['dentist_id'] : 0;
        $appointmentDate = trim((string) ($payload['appointment_date'] ?? ''));
        $appointmentTime = trim((string) ($payload['appointment_time'] ?? ''));
        $procedure = trim((string) ($payload['procedure'] ?? ''));
        $notes = trim((string) ($payload['notes'] ?? ''));
        $manualPatientName = trim((string) ($payload['patient_name'] ?? ''));
        $manualPhone = trim((string) ($payload['phone'] ?? ''));

        if ($dentistId <= 0 || $appointmentDate === '' || $appointmentTime === '' || $procedure === '') {
            Response::json(['message' => 'Dentist, appointment date, time, and procedure are required.'], 422);
        }

        $patientName = $manualPatientName;
        $phone = $manualPhone;

        if ($patientId > 0) {
            $patient = $this->patientById($pdo, $patientId);
            if (!$patient) {
                Response::json(['message' => 'The selected patient could not be found.'], 404);
            }

            $patientName = $this->patientDisplayName($patient);
            $phone = trim((string) ($patient['phone'] ?? ''));
        }

        if ($patientName === '' || $phone === '') {
            Response::json(['message' => 'Patient name and phone number are required.'], 422);
        }

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $appointmentDate)) {
            Response::json(['message' => 'Appointment date must use the YYYY-MM-DD format.'], 422);
        }

        if (!preg_match('/^\d{2}:\d{2}$/', $appointmentTime)) {
            Response::json(['message' => 'Appointment time must use the HH:MM format.'], 422);
        }

        if ($role === 'receptionist' && $branch !== '' && !$this->dentistBelongsToBranch($pdo, $dentistId, $branch)) {
            Response::json(['message' => 'The selected dentist is not available for your branch.'], 422);
        }

        $statement = $pdo->prepare(
            'INSERT INTO appointments (patient_name, appointment_date, appointment_time, phone, `procedure`, status, dentist_id, notes)
             VALUES (:patient_name, :appointment_date, :appointment_time, :phone, :procedure_name, :status, :dentist_id, :notes)'
        );
        $statement->execute([
            'patient_name' => $patientName,
            'appointment_date' => $appointmentDate,
            'appointment_time' => $appointmentTime,
            'phone' => $phone,
            'procedure_name' => $procedure,
            'status' => 'scheduled',
            'dentist_id' => $dentistId,
            'notes' => $notes !== '' ? $notes : null,
        ]);

        Response::json([
            'message' => 'Appointment booked successfully.',
            'item' => $this->appointmentById($pdo, (int) $pdo->lastInsertId()),
        ]);
    }

    private function appointments(PDO $pdo, string $role, int $staffId, string $branch): array
    {
        $sql = "
            SELECT
                a.id,
                a.patient_name,
                a.appointment_date,
                a.appointment_time,
                a.phone,
                a.`procedure`,
                a.status,
                a.notes,
                a.dentist_id,
                s.first_name AS dentist_first_name,
                s.last_name AS dentist_last_name,
                s.other_names AS dentist_other_names,
                sb.branch
            FROM appointments a
            LEFT JOIN staff s ON s.id = a.dentist_id
            LEFT JOIN staff_branches sb ON sb.staff_id = s.id
            WHERE 1=1";

        $params = [];

        if ($role === 'receptionist' && $staffId > 0 && $branch !== '') {
            $sql .= ' AND sb.branch = :branch';
            $params['branch'] = $branch;
        } elseif ($role === 'admin' && $branch !== '') {
            $sql .= ' AND sb.branch = :branch';
            $params['branch'] = $branch;
        } elseif ($role === 'dentist' && $staffId > 0) {
            $sql .= ' AND a.dentist_id = :dentist_id';
            $params['dentist_id'] = $staffId;
        }

        $sql .= ' ORDER BY a.appointment_date = CURDATE() DESC, a.appointment_date ASC, a.appointment_time ASC, a.id DESC';

        $statement = $pdo->prepare($sql);
        $statement->execute($params);

        return array_map(function (array $row): array {
            $date = (string) ($row['appointment_date'] ?? '');

            return [
                'id' => (int) $row['id'],
                'patientId' => null,
                'patient' => (string) $row['patient_name'],
                'patientName' => (string) $row['patient_name'],
                'clinician' => !empty($row['dentist_first_name']) ? Auth::staffDisplayName([
                    'first_name' => $row['dentist_first_name'] ?? '',
                    'last_name' => $row['dentist_last_name'] ?? '',
                    'other_names' => $row['dentist_other_names'] ?? '',
                    'staff_role' => 'dentist',
                ]) : 'Unassigned',
                'dentistName' => !empty($row['dentist_first_name']) ? Auth::staffDisplayName([
                    'first_name' => $row['dentist_first_name'] ?? '',
                    'last_name' => $row['dentist_last_name'] ?? '',
                    'other_names' => $row['dentist_other_names'] ?? '',
                    'staff_role' => 'dentist',
                ]) : 'Unassigned',
                'dentistId' => $row['dentist_id'] !== null ? (int) $row['dentist_id'] : null,
                'date' => $date,
                'dateLabel' => $date !== '' ? date('d M Y', strtotime($date)) : '',
                'time' => substr((string) $row['appointment_time'], 0, 5),
                'phone' => (string) ($row['phone'] ?? ''),
                'procedure' => (string) ($row['procedure'] ?? ''),
                'status' => ucfirst((string) ($row['status'] ?? 'scheduled')),
                'notes' => (string) ($row['notes'] ?? ''),
                'branch' => (string) ($row['branch'] ?? ''),
                'isToday' => $date === date('Y-m-d'),
            ];
        }, $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    private function dentists(PDO $pdo, string $role, string $branch): array
    {
        $sql = "
            SELECT DISTINCT
                s.id,
                s.first_name,
                s.last_name,
                s.other_names,
                sb.branch
            FROM staff s
            LEFT JOIN staff_branches sb ON sb.staff_id = s.id
            WHERE s.role = 'Dentist'";

        $params = [];

        if (in_array($role, ['receptionist', 'admin'], true) && $branch !== '') {
            $sql .= ' AND sb.branch = :branch';
            $params['branch'] = $branch;
        }

        $sql .= ' ORDER BY s.first_name ASC, s.last_name ASC';

        $statement = $pdo->prepare($sql);
        $statement->execute($params);

        return array_map(static fn (array $row): array => [
            'id' => (int) $row['id'],
            'name' => Auth::staffDisplayName([
                'first_name' => $row['first_name'] ?? '',
                'last_name' => $row['last_name'] ?? '',
                'other_names' => $row['other_names'] ?? '',
                'staff_role' => 'dentist',
            ]),
            'branch' => (string) ($row['branch'] ?? ''),
        ], $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    private function patientById(PDO $pdo, int $patientId): ?array
    {
        $statement = $pdo->prepare(
            'SELECT id, first_name, last_name, other_names, phone
             FROM patients
             WHERE id = :id
             LIMIT 1'
        );
        $statement->execute(['id' => $patientId]);

        $patient = $statement->fetch(PDO::FETCH_ASSOC);

        return $patient ?: null;
    }

    private function patientDisplayName(array $patient): string
    {
        return trim(implode(' ', array_filter([
            $patient['first_name'] ?? '',
            $patient['other_names'] ?? '',
            $patient['last_name'] ?? '',
        ])));
    }

    private function dentistBelongsToBranch(PDO $pdo, int $dentistId, string $branch): bool
    {
        $statement = $pdo->prepare(
            'SELECT COUNT(*)
             FROM staff_branches
             WHERE staff_id = :staff_id
               AND branch = :branch'
        );
        $statement->execute([
            'staff_id' => $dentistId,
            'branch' => $branch,
        ]);

        return (int) $statement->fetchColumn() > 0;
    }

    private function appointmentById(PDO $pdo, int $id): array
    {
        $statement = $pdo->prepare(
            "SELECT
                a.id,
                a.patient_name,
                a.appointment_date,
                a.appointment_time,
                a.phone,
                a.`procedure`,
                a.status,
                a.notes,
                a.dentist_id,
                s.first_name AS dentist_first_name,
                s.last_name AS dentist_last_name,
                s.other_names AS dentist_other_names,
                sb.branch
             FROM appointments a
             LEFT JOIN staff s ON s.id = a.dentist_id
             LEFT JOIN staff_branches sb ON sb.staff_id = s.id
             WHERE a.id = :id
             LIMIT 1"
        );
        $statement->execute(['id' => $id]);

        $row = $statement->fetch(PDO::FETCH_ASSOC) ?: [];

        return [
            'id' => (int) ($row['id'] ?? 0),
            'patient' => (string) ($row['patient_name'] ?? ''),
            'patientName' => (string) ($row['patient_name'] ?? ''),
            'clinician' => !empty($row['dentist_first_name']) ? Auth::staffDisplayName([
                'first_name' => $row['dentist_first_name'] ?? '',
                'last_name' => $row['dentist_last_name'] ?? '',
                'other_names' => $row['dentist_other_names'] ?? '',
                'staff_role' => 'dentist',
            ]) : 'Unassigned',
            'dentistName' => !empty($row['dentist_first_name']) ? Auth::staffDisplayName([
                'first_name' => $row['dentist_first_name'] ?? '',
                'last_name' => $row['dentist_last_name'] ?? '',
                'other_names' => $row['dentist_other_names'] ?? '',
                'staff_role' => 'dentist',
            ]) : 'Unassigned',
            'dentistId' => isset($row['dentist_id']) ? (int) $row['dentist_id'] : null,
            'date' => (string) ($row['appointment_date'] ?? ''),
            'dateLabel' => !empty($row['appointment_date']) ? date('d M Y', strtotime((string) $row['appointment_date'])) : '',
            'time' => isset($row['appointment_time']) ? substr((string) $row['appointment_time'], 0, 5) : '',
            'phone' => (string) ($row['phone'] ?? ''),
            'procedure' => (string) ($row['procedure'] ?? ''),
            'status' => ucfirst((string) ($row['status'] ?? 'scheduled')),
            'notes' => (string) ($row['notes'] ?? ''),
            'branch' => (string) ($row['branch'] ?? ''),
            'isToday' => (($row['appointment_date'] ?? '') === date('Y-m-d')),
        ];
    }
}
