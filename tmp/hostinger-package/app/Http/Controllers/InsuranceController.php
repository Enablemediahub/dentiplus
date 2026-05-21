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
        $branch = trim((string) ($user['branch'] ?? ''));
        $pdo = Database::connection();

        Response::json([
            'items' => $this->insuranceItems($pdo, $role, $staffId, $branch),
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
                COALESCE(br.branch, sb.branch, '') AS access_branch
            FROM health_insurance hi
            LEFT JOIN billing_records br ON br.id = hi.billing_id
            LEFT JOIN staff_branches sb ON sb.staff_id = br.dentist_id
            WHERE 1=1";
        $params = [];

        if ($role === 'receptionist' && $branch !== '') {
            $sql .= ' AND COALESCE(br.branch, sb.branch, \'\') IN (\'\', :branch)';
            $params['branch'] = $branch;
        } elseif ($role === 'dentist' && $staffId > 0) {
            $sql .= ' AND br.dentist_id = :dentist_id';
            $params['dentist_id'] = $staffId;
        }

        $sql .= ' ORDER BY hi.created_at DESC, hi.id DESC';
        $statement = $pdo->prepare($sql);
        $statement->execute($params);

        return array_map(static function (array $row): array {
            return [
                'id' => (int) ($row['id'] ?? 0),
                'billingId' => isset($row['billing_id']) ? (int) $row['billing_id'] : 0,
                'bill' => isset($row['billing_id']) ? sprintf('INV-%05d', (int) ($row['billing_id'] ?? 0)) : '-',
                'patientName' => (string) ($row['patient_name'] ?? 'Unknown patient'),
                'insuranceType' => (string) ($row['insurance_type'] ?? ''),
                'company' => (string) ($row['company'] ?? ''),
                'insuranceNumber' => (string) ($row['insurance_number'] ?? ''),
                'insuranceCategory' => (string) ($row['insurance_category'] ?? ''),
                'expiryDate' => (string) ($row['expiry_date'] ?? ''),
                'expiryDateLabel' => !empty($row['expiry_date']) ? date('d M Y', strtotime((string) ($row['expiry_date'] ?? ''))) : '',
                'coveredAmount' => (float) ($row['insurance_covered_amount'] ?? 0),
                'coveredAmountLabel' => 'GHS ' . number_format((float) ($row['insurance_covered_amount'] ?? 0), 2),
                'billAmountLabel' => 'GHS ' . number_format((float) ($row['amount'] ?? 0), 2),
                'balanceLabel' => 'GHS ' . number_format((float) ($row['remaining_amount'] ?? 0), 2),
                'status' => ucfirst(str_replace('_', ' ', (string) ($row['status'] ?? 'pending'))),
                'billTypeLabel' => (string) ($row['bill_type'] ?? '') === 'frontdesk_fees' ? 'Consultation / Registration' : 'Procedure charges',
                'createdAt' => (string) ($row['created_at'] ?? ''),
                'createdAtLabel' => !empty($row['created_at']) ? date('d M Y h:i A', strtotime((string) ($row['created_at'] ?? ''))) : '',
            ];
        }, $statement->fetchAll(PDO::FETCH_ASSOC));
    }
}
