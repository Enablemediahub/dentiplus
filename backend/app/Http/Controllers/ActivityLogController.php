<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Auth;
use App\Support\Database;
use App\Support\Response;
use PDO;

final class ActivityLogController extends Controller
{
    private array $patientContextCache = [];

    private array $latestHistoryCache = [];

    private array $patientIdByBillingIdCache = [];

    public function index(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        if ($role !== 'admin') {
            Response::json(['message' => 'Only admin users can review deletion activity.'], 403);
        }

        $pdo = Database::connection();
        $this->ensureSchema($pdo);
        $branch = $this->resolvedBranchFilter($pdo, $user);

        $sql = 'SELECT * FROM activity_log WHERE action_type = :action_type';
        $params = ['action_type' => 'delete'];

        if ($branch !== '') {
            $sql .= ' AND branch = :branch';
            $params['branch'] = $branch;
        }

        $sql .= ' ORDER BY created_at DESC, id DESC LIMIT 250';

        $statement = $pdo->prepare($sql);
        $statement->execute($params);

        Response::json([
            'items' => array_map(fn (array $row): array => $this->mapActivityRow($pdo, $row), $statement->fetchAll(PDO::FETCH_ASSOC)),
            'branch' => $branch,
        ]);
    }

    public function ensureSchema(PDO $pdo): void
    {
        $pdo->exec(
            "CREATE TABLE IF NOT EXISTS activity_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                action_type VARCHAR(50) NOT NULL,
                entity_type VARCHAR(50) NOT NULL,
                entity_id INT NULL,
                actor_staff_id INT NULL,
                actor_name VARCHAR(150) NOT NULL,
                actor_role VARCHAR(50) NOT NULL,
                branch VARCHAR(100) NULL,
                patient_name VARCHAR(255) NULL,
                reference VARCHAR(100) NULL,
                amount DECIMAL(10,2) DEFAULT 0.00,
                summary TEXT NULL,
                payload LONGTEXT NULL,
                created_at DATETIME NOT NULL,
                INDEX idx_activity_log_created (created_at),
                INDEX idx_activity_log_branch (branch),
                INDEX idx_activity_log_action (action_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
    }

    private function mapActivityRow(PDO $pdo, array $row): array
    {
        $createdAt = (string) ($row['created_at'] ?? '');
        $actorRole = trim((string) ($row['actor_role'] ?? ''));
        $patientContext = $this->patientContext($pdo, $row);
        $payload = $this->decodePayload($row['payload'] ?? null);

        return [
            'id' => (int) ($row['id'] ?? 0),
            'actionType' => (string) ($row['action_type'] ?? ''),
            'actionLabel' => ucfirst(str_replace('_', ' ', (string) ($row['action_type'] ?? 'delete'))),
            'entityType' => (string) ($row['entity_type'] ?? ''),
            'entityLabel' => ucfirst(str_replace('_', ' ', (string) ($row['entity_type'] ?? 'record'))),
            'entityId' => isset($row['entity_id']) ? (int) $row['entity_id'] : null,
            'actorStaffId' => isset($row['actor_staff_id']) ? (int) $row['actor_staff_id'] : null,
            'actorName' => (string) ($row['actor_name'] ?? 'Unknown staff'),
            'actorRole' => $actorRole !== '' ? ucfirst($actorRole) : 'Unknown',
            'branch' => (string) ($row['branch'] ?? ''),
            'patientName' => (string) ($row['patient_name'] ?? ''),
            'billReference' => (string) ($row['reference'] ?? ''),
            'amount' => round((float) ($row['amount'] ?? 0), 2),
            'summary' => (string) ($row['summary'] ?? ''),
            'payload' => (string) ($row['payload'] ?? ''),
            'createdAt' => $createdAt,
            'createdAtLabel' => $createdAt !== '' ? date('d M Y h:i A', strtotime($createdAt)) : '',
            'lastDentistName' => $patientContext['lastDentistName'],
            'lastDentistAssignedAtLabel' => $patientContext['lastDentistAssignedAtLabel'],
            'lastReceiptNumber' => $patientContext['lastReceiptNumber'],
            'lastReceiptDateLabel' => $patientContext['lastReceiptDateLabel'],
            'lastTransactionLabel' => $patientContext['lastTransactionLabel'],
            'latestBillingReference' => $patientContext['latestBillingReference'],
            'latestBillingDateLabel' => $patientContext['latestBillingDateLabel'],
            'latestBillingAmountLabel' => $patientContext['latestBillingAmountLabel'],
            'latestBillingStatus' => $patientContext['latestBillingStatus'],
            'patientContextLabel' => $this->patientContextLabel($payload, $patientContext),
        ];
    }

    private function patientContext(PDO $pdo, array $row): array
    {
        $patientId = $this->resolvePatientIdForRow($pdo, $row);
        if ($patientId <= 0) {
            return $this->emptyPatientContext();
        }

        if (isset($this->patientContextCache[$patientId])) {
            return $this->patientContextCache[$patientId];
        }

        $latestAssignment = $this->latestAssignmentForPatient($pdo, $patientId);
        $latestHistory = $this->latestHistoryForPatient($pdo, $patientId);
        $latestBilling = $this->latestBillingForPatient($pdo, $patientId);

        $context = [
            'lastDentistName' => $latestAssignment['dentistName'] ?? 'Unassigned',
            'lastDentistAssignedAtLabel' => $latestAssignment['assignedAtLabel'] ?? '--',
            'lastReceiptNumber' => $latestHistory['receiptNumber'] ?? '--',
            'lastReceiptDateLabel' => $latestHistory['receiptDateLabel'] ?? '--',
            'lastTransactionLabel' => $latestHistory['transactionLabel'] ?? '--',
            'latestBillingReference' => $latestBilling['billingReference'] ?? '--',
            'latestBillingDateLabel' => $latestBilling['billingDateLabel'] ?? '--',
            'latestBillingAmountLabel' => $latestBilling['billingAmountLabel'] ?? '--',
            'latestBillingStatus' => $latestBilling['billingStatus'] ?? '--',
        ];

        return $this->patientContextCache[$patientId] = $context;
    }

    private function resolvePatientIdForRow(PDO $pdo, array $row): int
    {
        $payload = $this->decodePayload($row['payload'] ?? null);
        $patientId = (int) ($payload['patient_id'] ?? 0);
        if ($patientId > 0) {
            return $patientId;
        }

        $billingId = (int) ($row['entity_id'] ?? 0);
        if ($billingId <= 0) {
            return 0;
        }

        if (isset($this->patientIdByBillingIdCache[$billingId])) {
            return $this->patientIdByBillingIdCache[$billingId];
        }

        $statement = $pdo->prepare(
            'SELECT patient_id
             FROM billing_records
             WHERE id = :billing_id
             LIMIT 1'
        );
        $statement->execute(['billing_id' => $billingId]);
        $resolvedPatientId = (int) ($statement->fetchColumn() ?: 0);

        return $this->patientIdByBillingIdCache[$billingId] = $resolvedPatientId;
    }

    private function latestAssignmentForPatient(PDO $pdo, int $patientId): array
    {
        $statement = $pdo->prepare(
            'SELECT
                pa.assignment_time,
                pa.id,
                s.first_name,
                s.last_name,
                s.other_names
             FROM patient_assignments pa
             LEFT JOIN staff s ON s.id = pa.dentist_id
             WHERE pa.patient_id = :patient_id
             ORDER BY pa.assignment_time DESC, pa.id DESC
             LIMIT 1'
        );
        $statement->execute(['patient_id' => $patientId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return [];
        }

        return [
            'dentistName' => trim((string) Auth::staffDisplayName([
                'first_name' => $row['first_name'] ?? '',
                'last_name' => $row['last_name'] ?? '',
                'other_names' => $row['other_names'] ?? '',
                'staff_role' => 'dentist',
            ])),
            'assignedAtLabel' => !empty($row['assignment_time']) ? date('d M Y h:i A', strtotime((string) $row['assignment_time'])) : '--',
        ];
    }

    private function latestHistoryForPatient(PDO $pdo, int $patientId): array
    {
        if (isset($this->latestHistoryCache[$patientId])) {
            return $this->latestHistoryCache[$patientId];
        }

        $statement = $pdo->prepare(
            'SELECT
                r.receipt_number,
                r.created_at AS receipt_created_at,
                p.amount AS payment_amount,
                p.payment_method,
                p.transaction_id
             FROM receipts r
             INNER JOIN payments p ON p.id = r.payment_id
             INNER JOIN billing_records br ON br.id = r.billing_id
             WHERE br.patient_id = :patient_id
             ORDER BY r.created_at DESC, r.id DESC
             LIMIT 1'
        );
        $statement->execute(['patient_id' => $patientId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return $this->latestHistoryCache[$patientId] = [
                'receiptNumber' => '--',
                'receiptDateLabel' => '--',
                'transactionLabel' => '--',
            ];
        }

        $paymentMethod = ucwords(str_replace('_', ' ', (string) ($row['payment_method'] ?? 'cash')));
        $amountLabel = 'GHS ' . number_format((float) ($row['payment_amount'] ?? 0), 2);

        return $this->latestHistoryCache[$patientId] = [
            'receiptNumber' => (string) ($row['receipt_number'] ?? '--'),
            'receiptDateLabel' => !empty($row['receipt_created_at']) ? date('d M Y h:i A', strtotime((string) $row['receipt_created_at'])) : '--',
            'transactionLabel' => trim(($paymentMethod !== '' ? $paymentMethod . ' | ' : '') . $amountLabel . (($row['transaction_id'] ?? '') !== '' ? ' | Txn ' . $row['transaction_id'] : '')),
        ];
    }

    private function latestBillingForPatient(PDO $pdo, int $patientId): array
    {
        $statement = $pdo->prepare(
            'SELECT
                id,
                amount,
                status,
                created_at
             FROM billing_records
             WHERE patient_id = :patient_id
             ORDER BY created_at DESC, id DESC
             LIMIT 1'
        );
        $statement->execute(['patient_id' => $patientId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return [];
        }

        return [
            'billingReference' => sprintf('INV-%05d', (int) ($row['id'] ?? 0)),
            'billingDateLabel' => !empty($row['created_at']) ? date('d M Y h:i A', strtotime((string) $row['created_at'])) : '--',
            'billingAmountLabel' => 'GHS ' . number_format((float) ($row['amount'] ?? 0), 2),
            'billingStatus' => ucfirst(str_replace('_', ' ', (string) ($row['status'] ?? 'pending'))),
        ];
    }

    private function decodePayload(mixed $payload): array
    {
        if (!is_string($payload) || trim($payload) === '') {
            return [];
        }

        $decoded = json_decode($payload, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function emptyPatientContext(): array
    {
        return [
            'lastDentistName' => 'Unassigned',
            'lastDentistAssignedAtLabel' => '--',
            'lastReceiptNumber' => '--',
            'lastReceiptDateLabel' => '--',
            'lastTransactionLabel' => '--',
            'latestBillingReference' => '--',
            'latestBillingDateLabel' => '--',
            'latestBillingAmountLabel' => '--',
            'latestBillingStatus' => '--',
        ];
    }

    private function patientContextLabel(array $payload, array $context): string
    {
        $patientName = trim((string) ($payload['patient_name'] ?? ''));

        return trim(implode(' | ', array_filter([
            $patientName !== '' ? $patientName : null,
            'Dentist: ' . ($context['lastDentistName'] ?? 'Unassigned'),
            'Receipt: ' . ($context['lastReceiptNumber'] ?? '--'),
            'Txn: ' . ($context['lastTransactionLabel'] ?? '--'),
            'Billing: ' . ($context['latestBillingReference'] ?? '--'),
        ])));
    }
}
