<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Database;
use App\Support\Request;
use App\Support\Response;
use PDO;
use Throwable;

final class InsuranceController extends Controller
{
    public function index(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $pdo = Database::connection();
        $branch = $this->resolvedBranchFilter($pdo, $user);

        $this->ensureSchema($pdo);

        $items = $this->insuranceItems($pdo, $role, $staffId, $branch);

        Response::json([
            'summary' => $this->insuranceSummary($items),
            'items' => $items,
            'catalog' => $this->insuranceCatalogItems($pdo),
        ]);
    }

    public function storeCatalog(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        if (!in_array($role, ['receptionist', 'admin'], true)) {
            Response::json(['message' => 'Only reception or admin can add insurance names.'], 403);
        }

        $payload = Request::json();
        $pdo = Database::connection();
        $this->ensureSchema($pdo);

        $name = trim((string) ($payload['name'] ?? ''));
        if ($name === '') {
            Response::json(['message' => 'Insurance name is required.'], 422);
        }

        $statement = $pdo->prepare('SELECT id FROM insurance_catalog WHERE name = :name LIMIT 1');
        $statement->execute(['name' => $name]);
        if ($statement->fetch(PDO::FETCH_ASSOC)) {
            Response::json(['message' => 'That insurance name already exists.'], 409);
        }

        $insert = $pdo->prepare('INSERT INTO insurance_catalog (name, created_at, updated_at) VALUES (:name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)');
        $insert->execute(['name' => $name]);

        Response::json([
            'message' => 'Insurance name added successfully.',
            'catalog' => $this->insuranceCatalogItems($pdo),
        ]);
    }

    public function updateCatalog(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        if (!in_array($role, ['receptionist', 'admin'], true)) {
            Response::json(['message' => 'Only reception or admin can update insurance names.'], 403);
        }

        $payload = Request::json();
        $pdo = Database::connection();
        $this->ensureSchema($pdo);

        $id = isset($payload['id']) ? (int) $payload['id'] : 0;
        $name = trim((string) ($payload['name'] ?? ''));

        if ($id <= 0) {
            Response::json(['message' => 'Insurance name ID is required.'], 422);
        }

        if ($name === '') {
            Response::json(['message' => 'Insurance name is required.'], 422);
        }

        $statement = $pdo->prepare('SELECT id FROM insurance_catalog WHERE name = :name AND id <> :id LIMIT 1');
        $statement->execute([
            'id' => $id,
            'name' => $name,
        ]);
        if ($statement->fetch(PDO::FETCH_ASSOC)) {
            Response::json(['message' => 'That insurance name already exists.'], 409);
        }

        $update = $pdo->prepare('UPDATE insurance_catalog SET name = :name, updated_at = CURRENT_TIMESTAMP WHERE id = :id LIMIT 1');
        $update->execute([
            'id' => $id,
            'name' => $name,
        ]);

        Response::json([
            'message' => 'Insurance name updated successfully.',
            'catalog' => $this->insuranceCatalogItems($pdo),
        ]);
    }

    public function deleteCatalog(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        if (!in_array($role, ['receptionist', 'admin'], true)) {
            Response::json(['message' => 'Only reception or admin can delete insurance names.'], 403);
        }

        $payload = Request::json();
        $pdo = Database::connection();
        $this->ensureSchema($pdo);

        $id = isset($payload['id']) ? (int) $payload['id'] : 0;
        if ($id <= 0) {
            Response::json(['message' => 'Insurance name ID is required.'], 422);
        }

        try {
            $delete = $pdo->prepare('DELETE FROM insurance_catalog WHERE id = :id LIMIT 1');
            $delete->execute(['id' => $id]);
        } catch (Throwable $exception) {
            Response::json(['message' => 'Unable to delete this insurance name right now.'], 409);
        }

        Response::json([
            'message' => 'Insurance name deleted successfully.',
            'catalog' => $this->insuranceCatalogItems($pdo),
        ]);
    }

    public function update(): void
    {
        $payload = Request::json();
        $pdo = Database::connection();

        $id = isset($payload['id']) ? (int) $payload['id'] : 0;
        $insuranceType = trim((string) ($payload['insurance_type'] ?? ''));
        $company = trim((string) ($payload['company'] ?? ''));
        $insuranceNumber = trim((string) ($payload['insurance_number'] ?? ''));
        $insuranceCategory = trim((string) ($payload['insurance_category'] ?? ''));
        $expiryDate = trim((string) ($payload['expiry_date'] ?? ''));
        $coveredAmount = round((float) ($payload['insurance_covered_amount'] ?? 0), 2);

        if ($id <= 0 || $insuranceType === '' || $insuranceNumber === '' || $expiryDate === '' || $coveredAmount < 0) {
            Response::json(['message' => 'Insurance record, type, number, expiry date, and covered amount are required.'], 422);
        }

        $statement = $pdo->prepare(
            'UPDATE health_insurance
             SET insurance_type = :insurance_type,
                 company = :company,
                 insurance_number = :insurance_number,
                 insurance_category = :insurance_category,
                 expiry_date = :expiry_date,
                 insurance_covered_amount = :insurance_covered_amount
             WHERE id = :id
             LIMIT 1'
        );
        $statement->execute([
            'id' => $id,
            'insurance_type' => $insuranceType,
            'company' => $company !== '' ? $company : null,
            'insurance_number' => $insuranceNumber,
            'insurance_category' => $insuranceCategory !== '' ? $insuranceCategory : null,
            'expiry_date' => $expiryDate,
            'insurance_covered_amount' => $coveredAmount,
        ]);

        Response::json(['message' => 'Insurance record updated successfully.']);
    }

    public function delete(): void
    {
        $payload = Request::json();
        $pdo = Database::connection();

        $id = isset($payload['id']) ? (int) $payload['id'] : 0;
        if ($id <= 0) {
            Response::json(['message' => 'Insurance record ID is required.'], 422);
        }

        try {
            $statement = $pdo->prepare('DELETE FROM health_insurance WHERE id = :id LIMIT 1');
            $statement->execute(['id' => $id]);
        } catch (Throwable $exception) {
            Response::json(['message' => 'Unable to delete this insurance record right now.'], 409);
        }

        Response::json(['message' => 'Insurance record deleted successfully.']);
    }

    private function insuranceItems(PDO $pdo, string $role, int $staffId, string $branch): array
    {
        $sql = "
            SELECT
                hi.*,
                br.amount,
                br.remaining_amount,
                br.status,
                br.bill_type,
                br.branch AS billing_branch,
                br.patient_name AS billing_patient_name,
                p.first_name,
                p.last_name,
                p.other_names,
                COALESCE(br.branch, sb.branch, '') AS access_branch
            FROM health_insurance hi
            LEFT JOIN billing_records br ON br.id = hi.billing_id
            LEFT JOIN patients p ON p.id = br.patient_id
            LEFT JOIN staff_branches sb ON sb.staff_id = br.dentist_id
            WHERE 1=1";
        $params = [];

        if ($role === 'receptionist' && $branch !== '') {
            $sql .= ' AND COALESCE(br.branch, sb.branch, \'\') IN (\'\', :branch)';
            $params['branch'] = $branch;
        } elseif ($role === 'admin' && $branch !== '') {
            $sql .= ' AND COALESCE(NULLIF(br.branch, \'\'), sb.branch, \'\') = :branch';
            $params['branch'] = $branch;
        } elseif ($role === 'dentist' && $staffId > 0) {
            $sql .= ' AND br.dentist_id = :dentist_id';
            $params['dentist_id'] = $staffId;
        }

        $sql .= ' ORDER BY hi.created_at DESC, hi.id DESC';
        $statement = $pdo->prepare($sql);
        $statement->execute($params);

        return array_map(static function (array $row): array {
            $patientName = trim((string) ($row['patient_name'] ?? ''));
            if ($patientName === '') {
                $patientName = trim((string) ($row['billing_patient_name'] ?? ''));
            }
            if ($patientName === '') {
                $patientName = trim(implode(' ', array_filter([
                    $row['first_name'] ?? '',
                    $row['other_names'] ?? '',
                    $row['last_name'] ?? '',
                ])));
            }

            return [
                'id' => (int) ($row['id'] ?? 0),
                'billingId' => isset($row['billing_id']) ? (int) $row['billing_id'] : 0,
                'bill' => isset($row['billing_id']) ? sprintf('INV-%05d', (int) ($row['billing_id'] ?? 0)) : '-',
                'patientName' => $patientName !== '' ? $patientName : 'Unknown patient',
                'insuranceType' => (string) ($row['insurance_type'] ?? ''),
                'company' => (string) ($row['company'] ?? ''),
                'insuranceNumber' => (string) ($row['insurance_number'] ?? ''),
                'insuranceCategory' => (string) ($row['insurance_category'] ?? ''),
                'expiryDate' => (string) ($row['expiry_date'] ?? ''),
                'expiryDateLabel' => !empty($row['expiry_date']) ? date('d M Y', strtotime((string) ($row['expiry_date'] ?? ''))) : '',
                'coveredAmount' => (float) ($row['insurance_covered_amount'] ?? 0),
                'coveredAmountLabel' => 'GHS ' . number_format((float) ($row['insurance_covered_amount'] ?? 0), 2),
                'balance' => (float) ($row['remaining_amount'] ?? 0),
                'billAmountLabel' => 'GHS ' . number_format((float) ($row['amount'] ?? 0), 2),
                'balanceLabel' => 'GHS ' . number_format((float) ($row['remaining_amount'] ?? 0), 2),
                'status' => ucfirst(str_replace('_', ' ', (string) ($row['status'] ?? 'pending'))),
                'billTypeLabel' => (string) ($row['bill_type'] ?? '') === 'frontdesk_fees' ? 'Consultation / Registration' : 'Procedure charges',
                'createdAt' => (string) ($row['created_at'] ?? ''),
                'createdAtLabel' => !empty($row['created_at']) ? date('d M Y h:i A', strtotime((string) ($row['created_at'] ?? ''))) : '',
            ];
        }, $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    private function insuranceSummary(array $items): array
    {
        $totalCovered = 0.0;
        $openBalance = 0.0;
        $completed = 0;
        $pending = 0;

        foreach ($items as $item) {
            $totalCovered += (float) ($item['coveredAmount'] ?? 0);
            $openBalance += (float) ($item['balance'] ?? 0);
            $normalizedStatus = strtolower(str_replace(' ', '_', (string) ($item['status'] ?? 'pending')));

            if ($normalizedStatus === 'completed') {
                $completed++;
            } else {
                $pending++;
            }
        }

        return [
            'totalRecords' => count($items),
            'totalCovered' => $totalCovered,
            'totalCoveredLabel' => 'GHS ' . number_format($totalCovered, 2),
            'openBalance' => $openBalance,
            'openBalanceLabel' => 'GHS ' . number_format($openBalance, 2),
            'completedCount' => $completed,
            'pendingCount' => $pending,
        ];
    }

    private function insuranceCatalogItems(PDO $pdo): array
    {
        $statement = $pdo->query('SELECT id, name, created_at FROM insurance_catalog ORDER BY name ASC, id ASC');
        return array_map(static function (array $row): array {
            return [
                'id' => (int) ($row['id'] ?? 0),
                'name' => (string) ($row['name'] ?? ''),
                'createdAtLabel' => !empty($row['created_at']) ? date('d M Y h:i A', strtotime((string) ($row['created_at'] ?? ''))) : '',
            ];
        }, $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    private function ensureSchema(PDO $pdo): void
    {
        $pdo->exec("CREATE TABLE IF NOT EXISTS insurance_catalog (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY insurance_catalog_name_unique (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $defaults = [
            'Cosmopolitan Health Insurance',
            'Equity Health Insurance',
            'Glico',
            'Premier Health Insurance',
            'Acacia',
            'Metropolitan',
            'ACE Health Insurance',
            'GAB Insurance',
        ];

        foreach ($defaults as $defaultName) {
            $statement = $pdo->prepare('SELECT id FROM insurance_catalog WHERE name = :name LIMIT 1');
            $statement->execute(['name' => $defaultName]);
            if ($statement->fetch(PDO::FETCH_ASSOC)) {
                continue;
            }

            $insert = $pdo->prepare('INSERT INTO insurance_catalog (name, created_at, updated_at) VALUES (:name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)');
            $insert->execute(['name' => $defaultName]);
        }
    }
}
