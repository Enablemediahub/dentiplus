<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Auth;
use App\Support\Database;
use App\Support\Request;
use App\Support\Response;
use PDO;
use Throwable;

final class ProcedureChargeController extends Controller
{
    public function index(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $pdo = Database::connection();

        $this->ensureBillingColumns($pdo);

        Response::json([
            'queueItems' => $role === 'dentist' ? $this->queueItems($pdo, $role, $staffId) : [],
            'procedures' => $this->procedures($pdo),
            'pendingItems' => $role === 'dentist' ? $this->pendingItems($pdo, $role, $staffId) : [],
            'metrics' => $this->procedureMetrics($pdo),
        ]);
    }

    public function store(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $branch = trim((string) ($user['branch'] ?? ''));
        $pdo = Database::connection();
        $payload = Request::json();

        $this->ensureBillingColumns($pdo);

        if ($role !== 'dentist' || $staffId <= 0) {
            Response::json(['message' => 'Only dentists can create procedure charges.'], 403);
        }

        $patientId = isset($payload['patient_id']) ? (int) $payload['patient_id'] : 0;
        $assignmentId = isset($payload['assignment_id']) ? (int) ($payload['assignment_id'] ?? 0) : 0;
        $notes = trim((string) ($payload['notes'] ?? ''));
        $procedures = is_array($payload['procedures'] ?? null) ? $payload['procedures'] : [];

        if ($patientId <= 0 || $assignmentId <= 0 || $procedures === []) {
            Response::json(['message' => 'Patient, assignment, and at least one procedure are required.'], 422);
        }

        $patient = $this->patientById($pdo, $patientId);
        if (!$patient) {
            Response::json(['message' => 'The selected patient could not be found.'], 404);
        }

        $dentist = $this->dentistById($pdo, $staffId);
        if (!$dentist) {
            Response::json(['message' => 'The dentist profile could not be loaded.'], 404);
        }

        $dentistName = Auth::staffDisplayName($dentist, 'dentist');
        $patientName = $this->patientDisplayName($patient);
        $lineItems = [];
        $totalAmount = 0.0;
        $topupNotes = [];
        $firstProcedureId = 0;

        foreach ($procedures as $entry) {
            $procedureId = isset($entry['procedure_id']) ? (int) $entry['procedure_id'] : 0;
            $amount = round((float) ($entry['amount'] ?? 0), 2);
            $topupNote = trim((string) ($entry['topup_notes'] ?? ''));

            if ($procedureId <= 0 || $amount <= 0) {
                Response::json(['message' => 'Each selected procedure must have a valid amount.'], 422);
            }

            $procedure = $this->procedureById($pdo, $procedureId);
            if (!$procedure) {
                Response::json(['message' => 'One of the selected procedures could not be found.'], 404);
            }

            $minCharge = (float) ($procedure['min_charge'] ?? 0);
            $maxCharge = (float) ($procedure['max_charge'] ?? 0);

            if ($amount < $minCharge) {
                Response::json(['message' => sprintf('%s must be charged at least GHS %.2f.', (string) ($procedure['name'] ?? 'The procedure'), $minCharge)], 422);
            }

            if ($amount > $maxCharge && $topupNote === '') {
                Response::json(['message' => sprintf('%s exceeds the approved range. Add a top-up justification first.', (string) ($procedure['name'] ?? 'This procedure'))], 422);
            }

            if ($firstProcedureId <= 0) {
                $firstProcedureId = $procedureId;
            }

            if ($topupNote !== '') {
                $topupNotes[] = (string) ($procedure['name'] ?? 'Procedure') . ': ' . $topupNote;
            }

            $lineItems[] = [
                'procedure_id' => $procedureId,
                'name' => (string) ($procedure['name'] ?? ''),
                'amount' => $amount,
                'min_charge' => $minCharge,
                'max_charge' => $maxCharge,
                'topup_notes' => $topupNote,
            ];
            $totalAmount += $amount;
        }

        $pdo->beginTransaction();

        try {
            $statement = $pdo->prepare(
                'INSERT INTO billing_records (
                    patient_id,
                    dentist_id,
                    dentist_name,
                    patient_name,
                    procedure_id,
                    procedures_data,
                    amount,
                    remaining_amount,
                    status,
                    created_at,
                    notes,
                    topup_notes,
                    bill_type,
                    branch
                ) VALUES (
                    :patient_id,
                    :dentist_id,
                    :dentist_name,
                    :patient_name,
                    :procedure_id,
                    :procedures_data,
                    :amount,
                    :remaining_amount,
                    :status,
                    CURRENT_TIMESTAMP,
                    :notes,
                    :topup_notes,
                    :bill_type,
                    :branch
                )'
            );
            $statement->execute([
                'patient_id' => $patientId,
                'dentist_id' => $staffId,
                'dentist_name' => $dentistName,
                'patient_name' => $patientName,
                'procedure_id' => $firstProcedureId > 0 ? $firstProcedureId : null,
                'procedures_data' => json_encode($lineItems, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'amount' => round($totalAmount, 2),
                'remaining_amount' => round($totalAmount, 2),
                'status' => 'pending',
                'notes' => $notes !== '' ? $notes : null,
                'topup_notes' => $topupNotes !== [] ? implode(' | ', $topupNotes) : null,
                'bill_type' => 'procedure_charge',
                'branch' => $branch !== '' ? $branch : null,
            ]);

            $updateAssignment = $pdo->prepare(
                'UPDATE patient_assignments
                 SET status = :status
                 WHERE id = :id
                   AND dentist_id = :dentist_id
                   AND status = :current_status'
            );
            $updateAssignment->execute([
                'status' => 'completed',
                'id' => $assignmentId,
                'dentist_id' => $staffId,
                'current_status' => 'waiting',
            ]);

            $updatePatient = $pdo->prepare(
                'UPDATE patients
                 SET status = :status,
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
            Response::json(['message' => $exception->getMessage() ?: 'Unable to save procedure charges right now.'], 422);
        }

        Response::json([
            'message' => 'Procedure charges submitted to reception successfully.',
            'queueItems' => $this->queueItems($pdo, $role, $staffId),
            'procedures' => $this->procedures($pdo),
            'pendingItems' => $this->pendingItems($pdo, $role, $staffId),
            'metrics' => $this->procedureMetrics($pdo),
        ]);
    }

    public function storeProcedure(): void
    {
        $this->requireAdminRole();

        $payload = Request::json();
        $pdo = Database::connection();
        $name = trim((string) ($payload['name'] ?? ''));
        $charge = round((float) ($payload['charge'] ?? 0), 2);
        $minCharge = round((float) ($payload['min_charge'] ?? 0), 2);
        $maxCharge = round((float) ($payload['max_charge'] ?? 0), 2);

        $this->validateProcedurePayload($name, $charge, $minCharge, $maxCharge);

        $statement = $pdo->prepare(
            'INSERT INTO procedures (name, charge, min_charge, max_charge, created_at)
             VALUES (:name, :charge, :min_charge, :max_charge, CURRENT_TIMESTAMP)'
        );
        $statement->execute([
            'name' => $name,
            'charge' => $charge,
            'min_charge' => $minCharge,
            'max_charge' => $maxCharge,
        ]);

        Response::json([
            'message' => 'Procedure added successfully.',
            'procedures' => $this->procedures($pdo),
            'metrics' => $this->procedureMetrics($pdo),
        ]);
    }

    public function updateProcedure(): void
    {
        $this->requireAdminRole();

        $payload = Request::json();
        $pdo = Database::connection();
        $id = isset($payload['id']) ? (int) $payload['id'] : 0;
        $name = trim((string) ($payload['name'] ?? ''));
        $charge = round((float) ($payload['charge'] ?? 0), 2);
        $minCharge = round((float) ($payload['min_charge'] ?? 0), 2);
        $maxCharge = round((float) ($payload['max_charge'] ?? 0), 2);

        if ($id <= 0) {
            Response::json(['message' => 'Choose a valid procedure to update.'], 422);
        }

        $this->validateProcedurePayload($name, $charge, $minCharge, $maxCharge);

        if (!$this->procedureById($pdo, $id)) {
            Response::json(['message' => 'The selected procedure could not be found.'], 404);
        }

        $statement = $pdo->prepare(
            'UPDATE procedures
             SET name = :name,
                 charge = :charge,
                 min_charge = :min_charge,
                 max_charge = :max_charge
             WHERE id = :id
             LIMIT 1'
        );
        $statement->execute([
            'id' => $id,
            'name' => $name,
            'charge' => $charge,
            'min_charge' => $minCharge,
            'max_charge' => $maxCharge,
        ]);

        Response::json([
            'message' => 'Procedure updated successfully.',
            'procedures' => $this->procedures($pdo),
            'metrics' => $this->procedureMetrics($pdo),
        ]);
    }

    public function deleteProcedure(): void
    {
        $this->requireAdminRole();

        $payload = Request::json();
        $pdo = Database::connection();
        $id = isset($payload['id']) ? (int) $payload['id'] : 0;

        if ($id <= 0) {
            Response::json(['message' => 'Choose a valid procedure to delete.'], 422);
        }

        try {
            $statement = $pdo->prepare('DELETE FROM procedures WHERE id = :id LIMIT 1');
            $statement->execute(['id' => $id]);
        } catch (Throwable $exception) {
            Response::json(['message' => 'Unable to delete this procedure right now.'], 409);
        }

        if ($statement->rowCount() === 0) {
            Response::json(['message' => 'The selected procedure could not be found.'], 404);
        }

        Response::json([
            'message' => 'Procedure deleted successfully.',
            'procedures' => $this->procedures($pdo),
            'metrics' => $this->procedureMetrics($pdo),
        ]);
    }

    private function queueItems(PDO $pdo, string $role, int $staffId): array
    {
        if ($role !== 'dentist' || $staffId <= 0) {
            return [];
        }

        $statement = $pdo->prepare(
            "SELECT
                pa.id,
                pa.patient_id,
                pa.assignment_visit_reason,
                pa.assignment_time,
                p.folder_id,
                p.phone,
                p.first_name,
                p.last_name,
                p.other_names
             FROM patient_assignments pa
             INNER JOIN patients p ON p.id = pa.patient_id
             WHERE pa.status = 'waiting'
               AND pa.dentist_id = :dentist_id
             ORDER BY pa.assignment_time ASC, pa.id ASC"
        );
        $statement->execute(['dentist_id' => $staffId]);

        return array_map(static function (array $row): array {
            return [
                'assignmentId' => (int) $row['id'],
                'patientId' => (int) $row['patient_id'],
                'patientName' => trim(implode(' ', array_filter([
                    $row['first_name'] ?? '',
                    $row['other_names'] ?? '',
                    $row['last_name'] ?? '',
                ]))),
                'folderId' => (string) ($row['folder_id'] ?? ''),
                'phone' => (string) ($row['phone'] ?? ''),
                'visitReason' => (string) ($row['assignment_visit_reason'] ?? ''),
                'assignmentTime' => isset($row['assignment_time']) ? date('g:i A', strtotime((string) $row['assignment_time'])) : '',
            ];
        }, $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    private function procedures(PDO $pdo): array
    {
        $statement = $pdo->query(
            'SELECT id, name, charge, min_charge, max_charge
             FROM procedures
             ORDER BY name ASC'
        );

        return array_map(static fn (array $row): array => [
            'id' => (int) $row['id'],
            'name' => (string) ($row['name'] ?? ''),
            'charge' => (float) ($row['charge'] ?? 0),
            'minCharge' => (float) ($row['min_charge'] ?? 0),
            'maxCharge' => (float) ($row['max_charge'] ?? 0),
        ], $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    private function pendingItems(PDO $pdo, string $role, int $staffId): array
    {
        if ($role !== 'dentist' || $staffId <= 0) {
            return [];
        }

        $statement = $pdo->prepare(
            "SELECT
                br.id,
                br.patient_name,
                br.amount,
                br.remaining_amount,
                br.status,
                br.created_at,
                br.procedures_data,
                br.notes
             FROM billing_records br
             WHERE br.dentist_id = :dentist_id
               AND br.bill_type = 'procedure_charge'
               AND br.status IN ('pending', 'partially_paid')
             ORDER BY br.created_at DESC
             LIMIT 40"
        );
        $statement->execute(['dentist_id' => $staffId]);

        return array_map(function (array $row): array {
            $proceduresData = json_decode((string) ($row['procedures_data'] ?? '[]'), true);
            $procedureNames = [];
            if (is_array($proceduresData)) {
                foreach ($proceduresData as $entry) {
                    $name = trim((string) ($entry['name'] ?? ''));
                    if ($name !== '') {
                        $procedureNames[] = $name;
                    }
                }
            }

            return [
                'id' => (int) $row['id'],
                'patientName' => (string) ($row['patient_name'] ?? 'Unknown patient'),
                'procedureSummary' => $procedureNames !== [] ? implode(', ', $procedureNames) : 'Not specified',
                'amount' => (float) ($row['amount'] ?? 0),
                'remainingAmount' => (float) ($row['remaining_amount'] ?? 0),
                'status' => ucfirst(str_replace('_', ' ', (string) ($row['status'] ?? 'pending'))),
                'dateLabel' => !empty($row['created_at']) ? date('d M Y', strtotime((string) $row['created_at'])) : '',
                'notes' => (string) ($row['notes'] ?? ''),
            ];
        }, $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    private function procedureMetrics(PDO $pdo): array
    {
        $summary = $pdo->query(
            'SELECT
                COUNT(*) AS total_procedures,
                COALESCE(AVG(charge), 0) AS average_charge,
                COALESCE(MIN(min_charge), 0) AS lowest_entry_charge,
                COALESCE(MAX(max_charge), 0) AS highest_entry_charge
             FROM procedures'
        )->fetch(PDO::FETCH_ASSOC) ?: [];

        $wideRangeCount = $pdo->query(
            'SELECT COUNT(*) FROM procedures WHERE max_charge > min_charge'
        )->fetchColumn();

        return [
            'totalProcedures' => (int) ($summary['total_procedures'] ?? 0),
            'averageCharge' => round((float) ($summary['average_charge'] ?? 0), 2),
            'lowestEntryCharge' => round((float) ($summary['lowest_entry_charge'] ?? 0), 2),
            'highestEntryCharge' => round((float) ($summary['highest_entry_charge'] ?? 0), 2),
            'wideRangeCount' => (int) ($wideRangeCount ?: 0),
        ];
    }

    private function patientById(PDO $pdo, int $patientId): ?array
    {
        $statement = $pdo->prepare(
            'SELECT id, first_name, last_name, other_names
             FROM patients
             WHERE id = :id
             LIMIT 1'
        );
        $statement->execute(['id' => $patientId]);

        $patient = $statement->fetch(PDO::FETCH_ASSOC);

        return $patient ?: null;
    }

    private function dentistById(PDO $pdo, int $staffId): ?array
    {
        $statement = $pdo->prepare(
            "SELECT id, first_name, last_name, other_names, role AS staff_role
             FROM staff
             WHERE id = :id
             LIMIT 1"
        );
        $statement->execute(['id' => $staffId]);

        $dentist = $statement->fetch(PDO::FETCH_ASSOC);

        return $dentist ?: null;
    }

    private function procedureById(PDO $pdo, int $procedureId): ?array
    {
        $statement = $pdo->prepare(
            'SELECT id, name, min_charge, max_charge
             FROM procedures
             WHERE id = :id
             LIMIT 1'
        );
        $statement->execute(['id' => $procedureId]);

        $procedure = $statement->fetch(PDO::FETCH_ASSOC);

        return $procedure ?: null;
    }

    private function patientDisplayName(array $patient): string
    {
        return trim(implode(' ', array_filter([
            $patient['first_name'] ?? '',
            $patient['other_names'] ?? '',
            $patient['last_name'] ?? '',
        ])));
    }

    private function requireAdminRole(): void
    {
        $user = $this->authUser();
        if ($this->normalizedRole($user) !== 'admin') {
            Response::json(['message' => 'Only admin users can manage procedure charges.'], 403);
        }
    }

    private function validateProcedurePayload(string $name, float $charge, float $minCharge, float $maxCharge): void
    {
        if ($name === '') {
            Response::json(['message' => 'Procedure name is required.'], 422);
        }

        if ($charge < 0 || $minCharge < 0 || $maxCharge <= 0) {
            Response::json(['message' => 'Charge values must be zero or greater, and the maximum charge must be above zero.'], 422);
        }

        if ($minCharge > $charge) {
            Response::json(['message' => 'The default charge must be greater than or equal to the minimum charge.'], 422);
        }

        if ($charge > $maxCharge) {
            Response::json(['message' => 'The default charge cannot exceed the maximum charge.'], 422);
        }
    }

    private function ensureBillingColumns(PDO $pdo): void
    {
        $this->ensureColumn($pdo, 'billing_records', 'bill_type', "ALTER TABLE billing_records ADD COLUMN bill_type VARCHAR(50) DEFAULT 'procedure_charge' AFTER procedures_data");
        $this->ensureColumn($pdo, 'billing_records', 'registration_fee', "ALTER TABLE billing_records ADD COLUMN registration_fee DECIMAL(10,2) DEFAULT 0.00 AFTER bill_type");
        $this->ensureColumn($pdo, 'billing_records', 'consultation_fee', "ALTER TABLE billing_records ADD COLUMN consultation_fee DECIMAL(10,2) DEFAULT 0.00 AFTER registration_fee");
        $this->ensureColumn($pdo, 'billing_records', 'branch', 'ALTER TABLE billing_records ADD COLUMN branch VARCHAR(100) NULL AFTER consultation_fee');
    }

    private function ensureColumn(PDO $pdo, string $table, string $column, string $sql): void
    {
        $statement = $pdo->query("SHOW COLUMNS FROM {$table} LIKE " . $pdo->quote($column));
        $exists = $statement !== false && $statement->fetch(PDO::FETCH_ASSOC);

        if (!$exists) {
            $pdo->exec($sql);
        }
    }
}
