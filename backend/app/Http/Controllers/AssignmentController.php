<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Auth;
use App\Support\Database;
use App\Support\Request;
use App\Support\Response;
use PDO;
use Throwable;

final class AssignmentController extends Controller
{
    public function index(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $branch = trim((string) ($user['branch'] ?? ''));
        $pdo = Database::connection();

        Response::json([
            'items' => $this->activeAssignments($pdo, $role, $staffId, $branch),
            'candidatePatients' => $this->candidatePatients($pdo, $role, $staffId, $branch),
            'dentists' => $this->dentists($pdo, $role, $staffId, $branch),
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
        $visitReason = trim((string) ($payload['assignment_visit_reason'] ?? ''));

        if ($patientId <= 0 || $dentistId <= 0 || $visitReason === '') {
            Response::json(['message' => 'Patient, dentist, and reason for visit are required.'], 422);
        }

        if ($role === 'receptionist' && $branch !== '' && !$this->dentistBelongsToBranch($pdo, $dentistId, $branch)) {
            Response::json(['message' => 'The selected dentist is not available for your branch.'], 422);
        }

        $existing = $pdo->prepare('SELECT id FROM patient_assignments WHERE patient_id = :patient_id AND status = :status LIMIT 1');
        $existing->execute([
            'patient_id' => $patientId,
            'status' => 'waiting',
        ]);
        if ($existing->fetchColumn()) {
            Response::json(['message' => 'This patient is already in the waiting queue.'], 422);
        }

        $pdo->beginTransaction();

        try {
            $assignmentTime = date('Y-m-d H:i:s');

            $insert = $pdo->prepare(
                'INSERT INTO patient_assignments (patient_id, dentist_id, receptionist_id, assignment_visit_reason, assignment_time, status)
                 VALUES (:patient_id, :dentist_id, :receptionist_id, :assignment_visit_reason, :assignment_time, :status)'
            );
            $insert->execute([
                'patient_id' => $patientId,
                'dentist_id' => $dentistId,
                'receptionist_id' => $staffId,
                'assignment_visit_reason' => $visitReason,
                'assignment_time' => $assignmentTime,
                'status' => 'waiting',
            ]);

            $updatePatient = $pdo->prepare(
                'UPDATE patients
                 SET status = :status,
                     dentist_id = :dentist_id,
                     assignment_visit_reason = :assignment_visit_reason,
                     assignment_time = :assignment_time
                 WHERE id = :id'
            );
            $updatePatient->execute([
                'status' => 'waiting',
                'dentist_id' => $dentistId,
                'assignment_visit_reason' => $visitReason,
                'assignment_time' => date('H:i:s'),
                'id' => $patientId,
            ]);

            $pdo->commit();
        } catch (Throwable $exception) {
            $pdo->rollBack();
            Response::json(['message' => 'Unable to assign the patient right now.'], 500);
        }

        Response::json([
            'message' => 'Patient assigned successfully.',
            'items' => $this->activeAssignments($pdo, $role, $staffId, $branch),
            'candidatePatients' => $this->candidatePatients($pdo, $role, $staffId, $branch),
            'dentists' => $this->dentists($pdo, $role, $staffId, $branch),
        ]);
    }

    public function complete(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $branch = trim((string) ($user['branch'] ?? ''));
        $payload = Request::json();
        $pdo = Database::connection();

        $assignmentId = isset($payload['assignment_id']) ? (int) $payload['assignment_id'] : 0;
        $patientId = isset($payload['patient_id']) ? (int) ($payload['patient_id'] ?? 0) : 0;

        if ($assignmentId <= 0 || $patientId <= 0) {
            Response::json(['message' => 'Assignment and patient IDs are required.'], 422);
        }

        $pdo->beginTransaction();

        try {
            $updateAssignment = $pdo->prepare(
                'UPDATE patient_assignments
                 SET status = :status
                 WHERE id = :id AND status = :current_status'
            );
            $updateAssignment->execute([
                'status' => 'completed',
                'id' => $assignmentId,
                'current_status' => 'waiting',
            ]);

            $updatePatient = $pdo->prepare(
                'UPDATE patients
                 SET status = :status,
                     dentist_id = NULL,
                     completed_time = :completed_time
                 WHERE id = :id'
            );
            $updatePatient->execute([
                'status' => 'completed',
                'completed_time' => date('Y-m-d H:i:s'),
                'id' => $patientId,
            ]);

            $pdo->commit();
        } catch (Throwable $exception) {
            $pdo->rollBack();
            Response::json(['message' => 'Unable to update the assignment right now.'], 500);
        }

        Response::json([
            'message' => 'Patient removed from the waiting queue.',
            'items' => $this->activeAssignments($pdo, $role, $staffId, $branch),
            'candidatePatients' => $this->candidatePatients($pdo, $role, $staffId, $branch),
            'dentists' => $this->dentists($pdo, $role, $staffId, $branch),
        ]);
    }

    private function activeAssignments(PDO $pdo, string $role, int $staffId, string $branch): array
    {
        $sql = "
            SELECT
                pa.id,
                pa.patient_id,
                pa.dentist_id,
                pa.receptionist_id,
                pa.assignment_visit_reason,
                pa.assignment_time,
                pa.status,
                p.folder_id,
                p.old_folder_id,
                p.phone,
                p.first_name,
                p.last_name,
                p.other_names,
                s.first_name AS dentist_first_name,
                s.last_name AS dentist_last_name,
                s.other_names AS dentist_other_names,
                sb.branch
            FROM patient_assignments pa
            INNER JOIN patients p ON p.id = pa.patient_id
            LEFT JOIN staff s ON s.id = pa.dentist_id
            LEFT JOIN staff_branches sb ON sb.staff_id = pa.dentist_id
            WHERE pa.status = :status";

        $params = ['status' => 'waiting'];

        if ($role === 'receptionist' && $staffId > 0) {
            $sql .= ' AND pa.receptionist_id = :receptionist_id';
            $params['receptionist_id'] = $staffId;
        } elseif ($role === 'dentist' && $staffId > 0) {
            $sql .= ' AND pa.dentist_id = :dentist_id';
            $params['dentist_id'] = $staffId;
        }

        if ($role === 'receptionist' && $branch !== '') {
            $sql .= ' AND (sb.branch = :branch OR sb.branch IS NULL)';
            $params['branch'] = $branch;
        }

        $sql .= ' ORDER BY pa.assignment_time ASC, pa.id ASC';

        $statement = $pdo->prepare($sql);
        $statement->execute($params);

        return array_map(static function (array $row): array {
            $name = trim(implode(' ', array_filter([
                $row['first_name'] ?? '',
                $row['other_names'] ?? '',
                $row['last_name'] ?? '',
            ])));

            return [
                'id' => (int) $row['id'],
                'assignmentId' => (int) $row['id'],
                'patientId' => (int) $row['patient_id'],
                'folderId' => (string) ($row['folder_id'] ?? ''),
                'oldFolderId' => (string) ($row['old_folder_id'] ?? ''),
                'patientName' => $name,
                'phone' => (string) ($row['phone'] ?? ''),
                'visitReason' => (string) ($row['assignment_visit_reason'] ?? ''),
                'dentistName' => !empty($row['dentist_first_name']) ? Auth::staffDisplayName([
                    'first_name' => $row['dentist_first_name'] ?? '',
                    'last_name' => $row['dentist_last_name'] ?? '',
                    'other_names' => $row['dentist_other_names'] ?? '',
                    'staff_role' => 'dentist',
                ]) : 'Unassigned',
                'assignmentTime' => isset($row['assignment_time']) ? date('g:i A', strtotime((string) $row['assignment_time'])) : '',
                'status' => ucfirst((string) ($row['status'] ?? 'waiting')),
            ];
        }, $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    private function candidatePatients(PDO $pdo, string $role, int $staffId, string $branch): array
    {
        $sql = "
            SELECT
                p.id,
                p.folder_id,
                p.old_folder_id,
                p.phone,
                p.first_name,
                p.last_name,
                p.other_names,
                COALESCE(p.assignment_visit_reason, p.visit_reason, 'General care') AS visit_reason,
                p.status,
                p.receptionist_id,
                sb.branch
            FROM patients p
            LEFT JOIN patient_assignments pa ON pa.patient_id = p.id AND pa.status = 'waiting'
            LEFT JOIN staff_branches sb ON sb.staff_id = p.receptionist_id
            WHERE pa.id IS NULL";

        $params = [];

        if ($role === 'receptionist' && $branch !== '') {
            $sql .= ' AND (sb.branch = :branch OR sb.branch IS NULL)';
            $params['branch'] = $branch;
        }

        if ($role === 'receptionist' && $staffId > 0) {
            $sql .= ' AND (p.receptionist_id = :receptionist_id OR p.receptionist_id IS NULL)';
            $params['receptionist_id'] = $staffId;
        }

        $sql .= " ORDER BY p.status = 'waiting' DESC, p.created_at DESC";

        $statement = $pdo->prepare($sql);
        $statement->execute($params);

        return array_map(static function (array $row): array {
            $name = trim(implode(' ', array_filter([
                $row['first_name'] ?? '',
                $row['other_names'] ?? '',
                $row['last_name'] ?? '',
            ])));

            return [
                'id' => (int) $row['id'],
                'folderId' => (string) ($row['folder_id'] ?? ''),
                'oldFolderId' => (string) ($row['old_folder_id'] ?? ''),
                'patientName' => $name,
                'phone' => (string) ($row['phone'] ?? ''),
                'visitReason' => (string) ($row['visit_reason'] ?? 'General care'),
                'status' => ucfirst((string) ($row['status'] ?? 'registered')),
            ];
        }, $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    private function dentists(PDO $pdo, string $role, int $staffId, string $branch): array
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

        if ($role === 'receptionist' && $branch !== '') {
            $sql .= ' AND sb.branch = :branch';
            $params['branch'] = $branch;
        } elseif ($role === 'dentist' && $staffId > 0) {
            $sql .= ' AND s.id = :dentist_id';
            $params['dentist_id'] = $staffId;
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
}
