<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Database;
use App\Support\Request;
use App\Support\Response;
use PDO;
use Throwable;

final class BillingController extends Controller
{
    private array $procedureNameCache = [];

    public function index(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $branch = trim((string) ($user['branch'] ?? ''));
        $pdo = Database::connection();

        $this->ensureSchema($pdo);

        Response::json([
            'items' => $this->openBills($pdo, $role, $staffId, $branch),
            'history' => $this->paymentHistory($pdo, $role, $staffId, $branch),
        ]);
    }

    public function storeFrontdeskBill(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $branch = trim((string) ($user['branch'] ?? ''));
        $payload = Request::json();
        $pdo = Database::connection();

        $this->ensureSchema($pdo);

        if (!in_array($role, ['receptionist', 'admin'], true)) {
            Response::json(['message' => 'Only reception or admin can create consultation and registration bills.'], 403);
        }

        $patientId = isset($payload['patient_id']) ? (int) $payload['patient_id'] : 0;
        $registrationFee = round((float) ($payload['registration_fee'] ?? 0), 2);
        $consultationFee = round((float) ($payload['consultation_fee'] ?? 0), 2);
        $notes = trim((string) ($payload['notes'] ?? ''));

        if ($patientId <= 0) {
            Response::json(['message' => 'Select a patient before creating a frontdesk bill.'], 422);
        }

        if ($registrationFee < 0 || $consultationFee < 0) {
            Response::json(['message' => 'Registration and consultation fees must be zero or more.'], 422);
        }

        $amount = round($registrationFee + $consultationFee, 2);
        if ($amount <= 0) {
            Response::json(['message' => 'Add at least one fee amount before saving the bill.'], 422);
        }

        $patient = $this->patientById($pdo, $patientId);
        if (!$patient) {
            Response::json(['message' => 'The selected patient could not be found.'], 404);
        }

        $patientName = $this->patientDisplayName($patient);
        $summaryNotes = [];
        if ($registrationFee > 0) {
            $summaryNotes[] = 'Registration fee: GHS ' . number_format($registrationFee, 2);
        }
        if ($consultationFee > 0) {
            $summaryNotes[] = 'Consultation fee: GHS ' . number_format($consultationFee, 2);
        }
        if ($notes !== '') {
            $summaryNotes[] = $notes;
        }

        $statement = $pdo->prepare(
            'INSERT INTO billing_records (
                patient_id,
                patient_name,
                amount,
                remaining_amount,
                status,
                created_at,
                notes,
                procedures_data,
                bill_type,
                registration_fee,
                consultation_fee,
                branch
            ) VALUES (
                :patient_id,
                :patient_name,
                :amount,
                :remaining_amount,
                :status,
                CURRENT_TIMESTAMP,
                :notes,
                :procedures_data,
                :bill_type,
                :registration_fee,
                :consultation_fee,
                :branch
            )'
        );
        $statement->execute([
            'patient_id' => $patientId,
            'patient_name' => $patientName,
            'amount' => $amount,
            'remaining_amount' => $amount,
            'status' => 'pending',
            'notes' => implode(' | ', $summaryNotes),
            'procedures_data' => json_encode([], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'bill_type' => 'frontdesk_fees',
            'registration_fee' => $registrationFee,
            'consultation_fee' => $consultationFee,
            'branch' => $branch !== '' ? $branch : null,
        ]);

        $billingId = (int) $pdo->lastInsertId();

        Response::json([
            'message' => 'Frontdesk bill created successfully.',
            'bill' => $this->billingItemById($pdo, $billingId, $role, $staffId, $branch),
            'items' => $this->openBills($pdo, $role, $staffId, $branch),
            'history' => $this->paymentHistory($pdo, $role, $staffId, $branch),
        ]);
    }

    public function storePayment(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $branch = trim((string) ($user['branch'] ?? ''));
        $payload = Request::json();
        $pdo = Database::connection();

        $this->ensureSchema($pdo);

        $billingId = isset($payload['billing_id']) ? (int) $payload['billing_id'] : 0;
        $status = strtolower(trim((string) ($payload['status'] ?? '')));
        $payments = is_array($payload['payments'] ?? null) ? $payload['payments'] : [];
        $insurance = is_array($payload['insurance'] ?? null) ? $payload['insurance'] : [];

        if ($billingId <= 0 || !in_array($status, ['partially_paid', 'completed', 'rejected'], true)) {
            Response::json(['message' => 'A valid bill and payment status are required.'], 422);
        }

        $billing = $this->billingById($pdo, $billingId, $role, $staffId, $branch);
        if (!$billing) {
            Response::json(['message' => 'The selected billing record could not be found.'], 404);
        }

        $remainingAmount = (float) ($billing['remaining_amount'] ?? $billing['amount'] ?? 0);
        $validatedPayments = [];
        $totalPaidAmount = 0.0;
        $usesInsurance = false;
        $insurancePaymentAmount = 0.0;
        $insuranceLineCount = 0;

        foreach ($payments as $entry) {
            $method = strtolower(trim((string) ($entry['method'] ?? '')));
            $amount = round((float) ($entry['amount'] ?? 0), 2);
            $transactionId = trim((string) ($entry['transaction_id'] ?? ''));

            if ($method === '' || $amount <= 0) {
                continue;
            }

            if (!in_array($method, ['cash', 'mobile_money', 'card', 'insurance'], true)) {
                Response::json(['message' => 'One of the payment methods is invalid.'], 422);
            }

            if (in_array($method, ['mobile_money', 'card'], true) && $transactionId === '') {
                Response::json(['message' => 'Transaction ID is required for Mobile Money and Card payments.'], 422);
            }

            if ($method === 'insurance') {
                $usesInsurance = true;
                $insurancePaymentAmount += $amount;
                $insuranceLineCount++;
            }

            $validatedPayments[] = [
                'method' => $method,
                'amount' => $amount,
                'transaction_id' => $transactionId !== '' ? $transactionId : null,
            ];
            $totalPaidAmount += $amount;
        }

        if (in_array($status, ['completed', 'partially_paid'], true) && $validatedPayments === []) {
            Response::json(['message' => 'Add at least one payment line before saving this payment.'], 422);
        }

        if ($totalPaidAmount > $remainingAmount + 0.01) {
            Response::json(['message' => 'Total paid amount cannot exceed the remaining bill balance.'], 422);
        }

        if (in_array($status, ['completed', 'partially_paid'], true) && $totalPaidAmount <= 0) {
            Response::json(['message' => 'Enter a payment amount greater than zero before issuing a receipt.'], 422);
        }

        if ($usesInsurance) {
            if ($insuranceLineCount > 1) {
                Response::json(['message' => 'Use only one insurance line, then add cash or Mobile Money as the second payment method if needed.'], 422);
            }

            $insuranceType = trim((string) ($insurance['insurance_type'] ?? ''));
            $insuranceNumber = trim((string) ($insurance['insurance_number'] ?? ''));
            $expiryDate = trim((string) ($insurance['expiry_date'] ?? ''));
            $coveredAmount = round((float) ($insurance['insurance_covered_amount'] ?? 0), 2);

            if ($insuranceType === '' || $insuranceNumber === '' || $expiryDate === '' || $coveredAmount <= 0) {
                Response::json(['message' => 'Insurance type, number, expiry date, and covered amount are required for insurance payments.'], 422);
            }

            if (abs($insurancePaymentAmount - $coveredAmount) > 0.01) {
                Response::json(['message' => 'The insurance payment line must match the covered amount for this split payment.'], 422);
            }
        }

        $newRemainingAmount = max(0, round($remainingAmount - $totalPaidAmount, 2));
        $newStatus = $status === 'rejected'
            ? 'rejected'
            : ($newRemainingAmount > 0.009 ? 'partially_paid' : 'completed');
        $nonInsurancePayments = array_values(array_filter(
            $validatedPayments,
            static fn (array $payment): bool => ($payment['method'] ?? '') !== 'insurance',
        ));
        $receiptNumber = ($usesInsurance || $nonInsurancePayments !== []) ? $this->nextReceiptNumber($pdo) : '';

        $pdo->beginTransaction();

        try {
            $update = $pdo->prepare(
                'UPDATE billing_records
                 SET remaining_amount = :remaining_amount,
                     status = :status,
                     notes = :notes
                 WHERE id = :id'
            );
            $update->execute([
                'remaining_amount' => $newRemainingAmount,
                'status' => $newStatus,
                'notes' => $this->appendPaymentNotes((string) ($billing['notes'] ?? ''), $validatedPayments),
                'id' => $billingId,
            ]);

            foreach ($nonInsurancePayments as $payment) {
                $paymentInsert = $pdo->prepare(
                    'INSERT INTO payments (
                        billing_id,
                        patient_id,
                        patient_name,
                        amount,
                        payment_method,
                        transaction_id,
                        payment_date,
                        receptionist_id
                    ) VALUES (
                        :billing_id,
                        :patient_id,
                        :patient_name,
                        :amount,
                        :payment_method,
                        :transaction_id,
                        CURRENT_DATE,
                        :receptionist_id
                    )'
                );
                $paymentInsert->execute([
                    'billing_id' => $billingId,
                    'patient_id' => $billing['patient_id'] ? (int) $billing['patient_id'] : null,
                    'patient_name' => $billing['patient_name'] ?? null,
                    'amount' => $payment['amount'],
                    'payment_method' => $payment['method'],
                    'transaction_id' => $payment['transaction_id'],
                    'receptionist_id' => $staffId > 0 ? $staffId : null,
                ]);

                $paymentId = (int) $pdo->lastInsertId();

                $paymentsNewInsert = $pdo->prepare(
                    'INSERT INTO payments_new (
                        payment_id,
                        billing_id,
                        amount,
                        created_at
                    ) VALUES (
                        :payment_id,
                        :billing_id,
                        :amount,
                        CURRENT_TIMESTAMP
                    )'
                );
                $paymentsNewInsert->execute([
                    'payment_id' => $this->nextPaymentReference(),
                    'billing_id' => $billingId,
                    'amount' => $payment['amount'],
                ]);

                $receiptInsert = $pdo->prepare(
                    'INSERT INTO receipts (
                        receipt_number,
                        billing_id,
                        payment_id,
                        patient_id,
                        receptionist_id,
                        branch,
                        created_at,
                        patient_name
                    ) VALUES (
                        :receipt_number,
                        :billing_id,
                        :payment_id,
                        :patient_id,
                        :receptionist_id,
                        :branch,
                        CURRENT_TIMESTAMP,
                        :patient_name
                    )'
                );
                $receiptInsert->execute([
                    'receipt_number' => $receiptNumber,
                    'billing_id' => $billingId,
                    'payment_id' => $paymentId,
                    'patient_id' => $billing['patient_id'] ? (int) $billing['patient_id'] : 0,
                    'receptionist_id' => $staffId > 0 ? $staffId : null,
                    'branch' => $branch !== '' ? $branch : ($billing['branch'] ?? null),
                    'patient_name' => $billing['patient_name'] ?? null,
                ]);
            }

            if ($usesInsurance) {
                $insuranceInsert = $pdo->prepare(
                    'INSERT INTO health_insurance (
                        billing_id,
                        receipt_number,
                        patient_name,
                        insurance_type,
                        company,
                        insurance_number,
                        insurance_category,
                        expiry_date,
                        created_at,
                        insurance_covered_amount
                    ) VALUES (
                        :billing_id,
                        :receipt_number,
                        :patient_name,
                        :insurance_type,
                        :company,
                        :insurance_number,
                        :insurance_category,
                        :expiry_date,
                        CURRENT_TIMESTAMP,
                        :insurance_covered_amount
                    )'
                );
                $insuranceInsert->execute([
                    'billing_id' => $billingId,
                    'receipt_number' => $receiptNumber !== '' ? $receiptNumber : null,
                    'patient_name' => $billing['patient_name'] ?? 'Unknown patient',
                    'insurance_type' => trim((string) ($insurance['insurance_type'] ?? '')),
                    'company' => $this->nullableString($insurance['company'] ?? null),
                    'insurance_number' => trim((string) ($insurance['insurance_number'] ?? '')),
                    'insurance_category' => $this->nullableString($insurance['insurance_category'] ?? null),
                    'expiry_date' => trim((string) ($insurance['expiry_date'] ?? '')),
                    'insurance_covered_amount' => $insurancePaymentAmount,
                ]);

                if ($nonInsurancePayments === [] && $receiptNumber !== '') {
                    $insuranceReceiptInsert = $pdo->prepare(
                        'INSERT INTO receipts (
                            receipt_number,
                            billing_id,
                            payment_id,
                            patient_id,
                            receptionist_id,
                            branch,
                            created_at,
                            patient_name
                        ) VALUES (
                            :receipt_number,
                            :billing_id,
                            NULL,
                            :patient_id,
                            :receptionist_id,
                            :branch,
                            CURRENT_TIMESTAMP,
                            :patient_name
                        )'
                    );
                    $insuranceReceiptInsert->execute([
                        'receipt_number' => $receiptNumber,
                        'billing_id' => $billingId,
                        'patient_id' => $billing['patient_id'] ? (int) $billing['patient_id'] : 0,
                        'receptionist_id' => $staffId > 0 ? $staffId : null,
                        'branch' => $branch !== '' ? $branch : ($billing['branch'] ?? null),
                        'patient_name' => $billing['patient_name'] ?? null,
                    ]);
                }
            }

            $pdo->commit();
        } catch (Throwable $exception) {
            $pdo->rollBack();
            Response::json(['message' => $exception->getMessage() ?: 'Unable to save the payment right now.'], 500);
        }

        Response::json([
            'message' => 'Payment saved successfully.',
            'receipt' => $receiptNumber !== '' ? $this->receiptDetailsByNumber($pdo, $receiptNumber, $role, $staffId, $branch) : null,
            'items' => $this->openBills($pdo, $role, $staffId, $branch),
            'history' => $this->paymentHistory($pdo, $role, $staffId, $branch),
        ]);
    }

    public function receipt(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $branch = trim((string) ($user['branch'] ?? ''));
        $receiptNumber = trim((string) ($_GET['receipt_number'] ?? ''));
        $pdo = Database::connection();

        $this->ensureSchema($pdo);

        if ($receiptNumber === '') {
            Response::json(['message' => 'Receipt number is required.'], 422);
        }

        $receipt = $this->receiptDetailsByNumber($pdo, $receiptNumber, $role, $staffId, $branch);
        if (!$receipt) {
            Response::json(['message' => 'The selected receipt could not be found.'], 404);
        }

        Response::json($receipt);
    }

    public function delete(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $branch = trim((string) ($user['branch'] ?? ''));
        $payload = Request::json();
        $pdo = Database::connection();

        $this->ensureSchema($pdo);

        if (!in_array($role, ['receptionist', 'admin'], true)) {
            Response::json(['message' => 'Only reception or admin can delete billing entries.'], 403);
        }

        $billingId = isset($payload['billing_id']) ? (int) $payload['billing_id'] : 0;
        if ($billingId <= 0) {
            Response::json(['message' => 'Billing entry ID is required.'], 422);
        }

        $billing = $this->billingById($pdo, $billingId, $role, $staffId, $branch);
        if (!$billing) {
            Response::json(['message' => 'The selected billing record could not be found.'], 404);
        }

        $paymentCount = $this->countRows($pdo, 'SELECT COUNT(*) FROM payments WHERE billing_id = :billing_id', ['billing_id' => $billingId]);
        $receiptCount = $this->countRows($pdo, 'SELECT COUNT(*) FROM receipts WHERE billing_id = :billing_id', ['billing_id' => $billingId]);
        $insuranceCount = $this->countRows($pdo, 'SELECT COUNT(*) FROM health_insurance WHERE billing_id = :billing_id', ['billing_id' => $billingId]);

        if ($paymentCount > 0 || $receiptCount > 0) {
            Response::json(['message' => 'This bill already has linked payments or receipts, so it cannot be deleted here.'], 409);
        }

        $pdo->beginTransaction();

        try {
            if ($insuranceCount > 0) {
                $insuranceDelete = $pdo->prepare('DELETE FROM health_insurance WHERE billing_id = :billing_id');
                $insuranceDelete->execute(['billing_id' => $billingId]);
            }

            $paymentsNewDelete = $pdo->prepare('DELETE FROM payments_new WHERE billing_id = :billing_id');
            $paymentsNewDelete->execute(['billing_id' => $billingId]);

            $billingDelete = $pdo->prepare('DELETE FROM billing_records WHERE id = :billing_id LIMIT 1');
            $billingDelete->execute(['billing_id' => $billingId]);

            $pdo->commit();
        } catch (Throwable $exception) {
            $pdo->rollBack();
            Response::json(['message' => 'Unable to delete this billing entry right now.'], 500);
        }

        Response::json([
            'message' => 'Billing entry deleted successfully.',
            'items' => $this->openBills($pdo, $role, $staffId, $branch),
            'history' => $this->paymentHistory($pdo, $role, $staffId, $branch),
        ]);
    }

    private function openBills(PDO $pdo, string $role, int $staffId, string $branch): array
    {
        $sql = "
            SELECT
                br.*,
                pr.name AS procedure_name,
                p.first_name,
                p.last_name,
                p.other_names,
                COALESCE(br.branch, sb.branch, '') AS access_branch
            FROM billing_records br
            LEFT JOIN procedures pr ON pr.id = br.procedure_id
            LEFT JOIN patients p ON p.id = br.patient_id
            LEFT JOIN staff_branches sb ON sb.staff_id = br.dentist_id
            WHERE COALESCE(br.remaining_amount, br.amount, 0) > 0.009
              AND br.status <> 'rejected'";

        $params = [];

        if ($role === 'receptionist' && $branch !== '') {
            $sql .= ' AND COALESCE(br.branch, sb.branch, \'\') IN (\'\', :branch_match)';
            $params['branch_match'] = $branch;
        } elseif ($role === 'dentist' && $staffId > 0) {
            $sql .= ' AND br.dentist_id = :dentist_id';
            $params['dentist_id'] = $staffId;
        }

        $sql .= ' ORDER BY br.created_at DESC, br.id DESC LIMIT 160';

        $statement = $pdo->prepare($sql);
        $statement->execute($params);

        return array_map(fn (array $row): array => $this->mapBillingRow($pdo, $row), $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    private function paymentHistory(PDO $pdo, string $role, int $staffId, string $branch): array
    {
        $sql = "
            SELECT
                r.receipt_number,
                r.created_at AS receipt_created_at,
                r.branch AS receipt_branch,
                p.id AS payment_id,
                p.amount AS payment_amount,
                p.payment_method,
                p.transaction_id,
                br.*,
                pt.first_name,
                pt.last_name,
                pt.other_names,
                COALESCE(br.branch, sb.branch, '') AS access_branch
            FROM receipts r
            INNER JOIN payments p ON p.id = r.payment_id
            INNER JOIN billing_records br ON br.id = r.billing_id
            LEFT JOIN patients pt ON pt.id = br.patient_id
            LEFT JOIN staff_branches sb ON sb.staff_id = br.dentist_id
            WHERE p.payment_method <> 'insurance'";

        $params = [];

        if ($role === 'receptionist' && $branch !== '') {
            $sql .= ' AND COALESCE(br.branch, sb.branch, \'\') IN (\'\', :branch_match)';
            $params['branch_match'] = $branch;
        } elseif ($role === 'dentist' && $staffId > 0) {
            $sql .= ' AND br.dentist_id = :dentist_id';
            $params['dentist_id'] = $staffId;
        }

        $sql .= ' ORDER BY r.created_at DESC, r.id DESC';

        $statement = $pdo->prepare($sql);
        $statement->execute($params);
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC);

        $grouped = [];
        foreach ($rows as $row) {
            $receiptNumber = (string) ($row['receipt_number'] ?? '');
            if ($receiptNumber === '') {
                continue;
            }

            if (!isset($grouped[$receiptNumber])) {
                $bill = $this->mapBillingRow($pdo, $row);
                $grouped[$receiptNumber] = [
                    'receiptNumber' => $receiptNumber,
                    'bill' => $bill['bill'],
                    'patientName' => $bill['patientName'],
                    'dentistName' => $bill['dentistName'],
                    'billType' => $bill['billType'],
                    'chargeSummary' => $bill['chargeSummary'],
                    'paidAmount' => 0.0,
                    'paidAmountLabel' => '',
                    'paymentMethod' => '',
                    'methods' => [],
                    'transactionIds' => [],
                    'paymentDate' => (string) ($row['receipt_created_at'] ?? ''),
                    'dateLabel' => !empty($row['receipt_created_at']) ? date('d M Y', strtotime((string) $row['receipt_created_at'])) : '',
                    'status' => ucfirst(str_replace('_', ' ', (string) ($row['status'] ?? 'completed'))),
                    'remainingAmountLabel' => 'GHS ' . number_format((float) ($row['remaining_amount'] ?? 0), 2),
                    'totalAmountLabel' => 'GHS ' . number_format((float) ($row['amount'] ?? 0), 2),
                ];
            }

            $grouped[$receiptNumber]['paidAmount'] += (float) ($row['payment_amount'] ?? 0);
            $methodLabel = ucwords(str_replace('_', ' ', (string) ($row['payment_method'] ?? 'cash')));
            if (!in_array($methodLabel, $grouped[$receiptNumber]['methods'], true)) {
                $grouped[$receiptNumber]['methods'][] = $methodLabel;
            }

            $transactionId = trim((string) ($row['transaction_id'] ?? ''));
            if ($transactionId !== '' && !in_array($transactionId, $grouped[$receiptNumber]['transactionIds'], true)) {
                $grouped[$receiptNumber]['transactionIds'][] = $transactionId;
            }
        }

        return array_values(array_map(static function (array $entry): array {
            $entry['paidAmountLabel'] = 'GHS ' . number_format((float) $entry['paidAmount'], 2);
            $entry['paymentMethod'] = implode(', ', $entry['methods']);
            return $entry;
        }, $grouped));
    }

    private function billingById(PDO $pdo, int $billingId, string $role, int $staffId, string $branch): ?array
    {
        $statement = $pdo->prepare(
            "SELECT
                br.*,
                p.first_name,
                p.last_name,
                p.other_names,
                COALESCE(br.branch, sb.branch, '') AS access_branch
             FROM billing_records br
             LEFT JOIN patients p ON p.id = br.patient_id
             LEFT JOIN staff_branches sb ON sb.staff_id = br.dentist_id
             WHERE br.id = :id
             LIMIT 1"
        );
        $statement->execute(['id' => $billingId]);
        $billing = $statement->fetch(PDO::FETCH_ASSOC);

        if (!$billing) {
            return null;
        }

        if ($role === 'receptionist' && $branch !== '' && !in_array((string) ($billing['access_branch'] ?? ''), ['', $branch], true)) {
            return null;
        }

        if ($role === 'dentist' && $staffId > 0 && (int) ($billing['dentist_id'] ?? 0) !== $staffId) {
            return null;
        }

        $resolvedPatientName = trim((string) ($billing['patient_name'] ?? ''));
        if ($resolvedPatientName === '') {
            $resolvedPatientName = trim(implode(' ', array_filter([
                $billing['first_name'] ?? '',
                $billing['other_names'] ?? '',
                $billing['last_name'] ?? '',
            ])));
            $billing['patient_name'] = $resolvedPatientName;
        }

        return $billing;
    }

    private function billingItemById(PDO $pdo, int $billingId, string $role, int $staffId, string $branch): ?array
    {
        $billing = $this->billingById($pdo, $billingId, $role, $staffId, $branch);

        return $billing ? $this->mapBillingRow($pdo, $billing) : null;
    }

    private function receiptDetailsByNumber(PDO $pdo, string $receiptNumber, string $role, int $staffId, string $branch): ?array
    {
        $sql = "
            SELECT
                r.receipt_number,
                r.created_at AS receipt_created_at,
                r.branch AS receipt_branch,
                p.id AS payment_id,
                p.amount AS payment_amount,
                p.payment_method,
                p.transaction_id,
                br.*,
                pt.first_name,
                pt.last_name,
                pt.other_names,
                COALESCE(br.branch, sb.branch, '') AS access_branch
            FROM receipts r
            LEFT JOIN payments p ON p.id = r.payment_id
            INNER JOIN billing_records br ON br.id = r.billing_id
            LEFT JOIN patients pt ON pt.id = br.patient_id
            LEFT JOIN staff_branches sb ON sb.staff_id = br.dentist_id
            WHERE r.receipt_number = :receipt_number
            ORDER BY r.id ASC";

        $statement = $pdo->prepare($sql);
        $statement->execute(['receipt_number' => $receiptNumber]);
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC);

        if ($rows === []) {
            return null;
        }

        $first = $rows[0];
        if ($role === 'receptionist' && $branch !== '' && !in_array((string) ($first['access_branch'] ?? ''), ['', $branch], true)) {
            return null;
        }

        if ($role === 'dentist' && $staffId > 0 && (int) ($first['dentist_id'] ?? 0) !== $staffId) {
            return null;
        }

        $bill = $this->mapBillingRow($pdo, $first);
        $paymentLines = array_values(array_filter(array_map(static function (array $row): ?array {
            $method = strtolower(trim((string) ($row['payment_method'] ?? '')));
            if ($method === '' || $method === 'insurance' || (float) ($row['payment_amount'] ?? 0) <= 0) {
                return null;
            }

            return [
                'paymentId' => (int) ($row['payment_id'] ?? 0),
                'method' => ucwords(str_replace('_', ' ', $method)),
                'amount' => (float) ($row['payment_amount'] ?? 0),
                'amountLabel' => 'GHS ' . number_format((float) ($row['payment_amount'] ?? 0), 2),
                'transactionId' => (string) ($row['transaction_id'] ?? ''),
            ];
        }, $rows)));
        $insurance = $this->insuranceByReceiptNumber($pdo, $receiptNumber, (int) ($first['id'] ?? 0));
        $insuranceAmount = (float) ($insurance['coveredAmount'] ?? 0);
        $receiptTotal = array_reduce($paymentLines, static fn (float $sum, array $line): float => $sum + (float) $line['amount'], 0.0) + $insuranceAmount;

        return [
            'receiptNumber' => $receiptNumber,
            'branch' => (string) ($first['receipt_branch'] ?? $first['branch'] ?? ''),
            'createdAt' => (string) ($first['receipt_created_at'] ?? ''),
            'createdAtLabel' => !empty($first['receipt_created_at']) ? date('d M Y h:i A', strtotime((string) $first['receipt_created_at'])) : '',
            'bill' => $bill,
            'paymentLines' => $paymentLines,
            'totalPaid' => $receiptTotal,
            'totalPaidLabel' => 'GHS ' . number_format($receiptTotal, 2),
            'insurance' => $insurance,
        ];
    }

    private function insuranceByReceiptNumber(PDO $pdo, string $receiptNumber, int $billingId): ?array
    {
        if ($receiptNumber === '' && $billingId <= 0) {
            return null;
        }

        $hasReceiptColumn = $this->tableHasColumn($pdo, 'health_insurance', 'receipt_number');
        if ($receiptNumber !== '' && $hasReceiptColumn) {
            $statement = $pdo->prepare(
                'SELECT insurance_type, company, insurance_number, insurance_category, expiry_date, insurance_covered_amount
                 FROM health_insurance
                 WHERE receipt_number = :receipt_number
                 ORDER BY id DESC
                 LIMIT 1'
            );
            $statement->execute(['receipt_number' => $receiptNumber]);
            $row = $statement->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                return [
                    'insuranceType' => (string) ($row['insurance_type'] ?? ''),
                    'company' => (string) ($row['company'] ?? ''),
                    'insuranceNumber' => (string) ($row['insurance_number'] ?? ''),
                    'insuranceCategory' => (string) ($row['insurance_category'] ?? ''),
                    'expiryDate' => (string) ($row['expiry_date'] ?? ''),
                    'coveredAmount' => (float) ($row['insurance_covered_amount'] ?? 0),
                    'coveredAmountLabel' => 'GHS ' . number_format((float) ($row['insurance_covered_amount'] ?? 0), 2),
                ];
            }
        }

        $statement = $pdo->prepare(
            'SELECT insurance_type, company, insurance_number, insurance_category, expiry_date, insurance_covered_amount
             FROM health_insurance
             WHERE billing_id = :billing_id
             ORDER BY id DESC
             LIMIT 1'
        );
        $statement->execute(['billing_id' => $billingId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return null;
        }

        return [
            'insuranceType' => (string) ($row['insurance_type'] ?? ''),
            'company' => (string) ($row['company'] ?? ''),
            'insuranceNumber' => (string) ($row['insurance_number'] ?? ''),
            'insuranceCategory' => (string) ($row['insurance_category'] ?? ''),
            'expiryDate' => (string) ($row['expiry_date'] ?? ''),
            'coveredAmount' => (float) ($row['insurance_covered_amount'] ?? 0),
            'coveredAmountLabel' => 'GHS ' . number_format((float) ($row['insurance_covered_amount'] ?? 0), 2),
        ];
    }

    private function mapBillingRow(PDO $pdo, array $row): array
    {
        $patientName = trim((string) ($row['patient_name'] ?? ''));
        if ($patientName === '') {
            $patientName = trim(implode(' ', array_filter([
                $row['first_name'] ?? '',
                $row['other_names'] ?? '',
                $row['last_name'] ?? '',
            ])));
        }

        $billType = trim((string) ($row['bill_type'] ?? ''));
        if ($billType === '') {
            $billType = !empty($row['procedures_data']) ? 'procedure_charge' : 'procedure_charge';
        }

        $procedureSummary = $this->procedureSummary($pdo, $row);
        $chargeSummary = $billType === 'frontdesk_fees'
            ? $this->frontdeskChargeSummary($row)
            : $procedureSummary;

        return [
            'id' => (int) ($row['id'] ?? 0),
            'billingId' => (int) ($row['id'] ?? 0),
            'bill' => sprintf('INV-%05d', (int) ($row['id'] ?? 0)),
            'patientId' => (int) ($row['patient_id'] ?? 0),
            'patient' => $patientName !== '' ? $patientName : 'Unknown patient',
            'patientName' => $patientName !== '' ? $patientName : 'Unknown patient',
            'procedure' => $chargeSummary,
            'chargeSummary' => $chargeSummary,
            'procedureSummary' => $procedureSummary,
            'billType' => $billType,
            'billTypeLabel' => $billType === 'frontdesk_fees' ? 'Consultation / Registration' : 'Procedure charges',
            'dentistName' => $this->formatDentistName((string) ($row['dentist_name'] ?? 'Reception desk')),
            'amount' => (float) ($row['amount'] ?? 0),
            'amountLabel' => 'GHS ' . number_format((float) ($row['amount'] ?? 0), 2),
            'balance' => (float) ($row['remaining_amount'] ?? 0),
            'balanceLabel' => 'GHS ' . number_format((float) ($row['remaining_amount'] ?? 0), 2),
            'status' => ucfirst(str_replace('_', ' ', (string) ($row['status'] ?? 'pending'))),
            'notes' => (string) ($row['notes'] ?? ''),
            'createdAt' => (string) ($row['created_at'] ?? ''),
            'dateLabel' => !empty($row['created_at']) ? date('d M Y', strtotime((string) $row['created_at'])) : '',
            'registrationFee' => (float) ($row['registration_fee'] ?? 0),
            'consultationFee' => (float) ($row['consultation_fee'] ?? 0),
            'registrationFeeLabel' => 'GHS ' . number_format((float) ($row['registration_fee'] ?? 0), 2),
            'consultationFeeLabel' => 'GHS ' . number_format((float) ($row['consultation_fee'] ?? 0), 2),
            'proceduresData' => $this->decodeProceduresData($row['procedures_data'] ?? null),
        ];
    }

    private function frontdeskChargeSummary(array $row): string
    {
        $parts = [];
        if ((float) ($row['registration_fee'] ?? 0) > 0) {
            $parts[] = 'Registration fee';
        }
        if ((float) ($row['consultation_fee'] ?? 0) > 0) {
            $parts[] = 'Consultation fee';
        }

        return $parts !== [] ? implode(' + ', $parts) : 'Frontdesk fees';
    }

    private function procedureSummary(PDO $pdo, array $row): string
    {
        $proceduresData = $this->decodeProceduresData($row['procedures_data'] ?? null);
        if ($proceduresData !== []) {
            $labels = [];
            foreach ($proceduresData as $entry) {
                $name = trim((string) ($entry['name'] ?? ''));
                if ($name === '') {
                    $name = $this->procedureNameById($pdo, (int) ($entry['procedure_id'] ?? 0));
                }

                if ($name !== '') {
                    $labels[] = $name;
                }
            }

            if ($labels !== []) {
                return implode(', ', array_values(array_unique($labels)));
            }
        }

        $procedureName = trim((string) ($row['procedure_name'] ?? ''));
        if ($procedureName !== '') {
            return $procedureName;
        }

        $fallbackName = $this->procedureNameById($pdo, (int) ($row['procedure_id'] ?? 0));
        return $fallbackName !== '' ? $fallbackName : 'Not specified';
    }

    private function procedureNameById(PDO $pdo, int $procedureId): string
    {
        if ($procedureId <= 0) {
            return '';
        }

        if (array_key_exists($procedureId, $this->procedureNameCache)) {
            return $this->procedureNameCache[$procedureId];
        }

        $statement = $pdo->prepare('SELECT name FROM procedures WHERE id = :id LIMIT 1');
        $statement->execute(['id' => $procedureId]);
        $name = trim((string) ($statement->fetchColumn() ?: ''));
        $this->procedureNameCache[$procedureId] = $name;

        return $name;
    }

    private function decodeProceduresData(mixed $value): array
    {
        if (!is_string($value) || trim($value) === '') {
            return [];
        }

        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : [];
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

    private function patientDisplayName(array $patient): string
    {
        return trim(implode(' ', array_filter([
            $patient['first_name'] ?? '',
            $patient['other_names'] ?? '',
            $patient['last_name'] ?? '',
        ])));
    }

    private function nextReceiptNumber(PDO $pdo): string
    {
        $prefix = 'EDC/RCPT-';
        $statement = $pdo->query(
            "SELECT receipt_number
             FROM receipts
             WHERE receipt_number LIKE 'EDC/RCPT-%'
             ORDER BY id DESC
             LIMIT 1"
        );
        $lastReceipt = (string) ($statement->fetchColumn() ?: '');
        $nextNumber = 1;

        if ($lastReceipt !== '' && preg_match('/(\d+)$/', $lastReceipt, $matches)) {
            $nextNumber = ((int) $matches[1]) + 1;
        }

        return $prefix . str_pad((string) $nextNumber, 4, '0', STR_PAD_LEFT);
    }

    private function nextPaymentReference(): string
    {
        return 'PAY-' . str_pad((string) (int) fmod(microtime(true) * 10000, 100000000), 8, '0', STR_PAD_LEFT);
    }

    private function appendPaymentNotes(string $existingNotes, array $payments): string
    {
        $summary = implode(', ', array_map(
            static fn (array $payment): string => ucfirst(str_replace('_', ' ', (string) $payment['method'])) . ' GHS ' . number_format((float) $payment['amount'], 2),
            $payments,
        ));

        $line = 'Payment processed: ' . $summary;
        return trim($existingNotes) !== '' ? trim($existingNotes) . ' | ' . $line : $line;
    }

    private function nullableString(mixed $value): ?string
    {
        $trimmed = trim((string) $value);
        return $trimmed !== '' ? $trimmed : null;
    }

    private function countRows(PDO $pdo, string $sql, array $params): int
    {
        $statement = $pdo->prepare($sql);
        $statement->execute($params);

        return (int) $statement->fetchColumn();
    }

    private function formatDentistName(string $value): string
    {
        $trimmed = trim($value);
        if ($trimmed === '' || strcasecmp($trimmed, 'Reception desk') === 0) {
            return $trimmed !== '' ? $trimmed : 'Reception desk';
        }

        if (str_starts_with(strtolower($trimmed), 'dr. (dent)')) {
            return $trimmed;
        }

        return 'Dr. (Dent) ' . $trimmed;
    }

    private function ensureSchema(PDO $pdo): void
    {
        $this->ensureColumn($pdo, 'billing_records', 'bill_type', "ALTER TABLE billing_records ADD COLUMN bill_type VARCHAR(50) DEFAULT 'procedure_charge' AFTER procedures_data");
        $this->ensureColumn($pdo, 'billing_records', 'registration_fee', "ALTER TABLE billing_records ADD COLUMN registration_fee DECIMAL(10,2) DEFAULT 0.00 AFTER bill_type");
        $this->ensureColumn($pdo, 'billing_records', 'consultation_fee', "ALTER TABLE billing_records ADD COLUMN consultation_fee DECIMAL(10,2) DEFAULT 0.00 AFTER registration_fee");
        $this->ensureColumn($pdo, 'billing_records', 'branch', 'ALTER TABLE billing_records ADD COLUMN branch VARCHAR(100) NULL AFTER consultation_fee');
        $this->ensureColumn($pdo, 'health_insurance', 'receipt_number', 'ALTER TABLE health_insurance ADD COLUMN receipt_number VARCHAR(50) NULL AFTER billing_id');

        $this->ensureTable($pdo, 'payments_new', "CREATE TABLE IF NOT EXISTS payments_new (
            payment_id VARCHAR(12) PRIMARY KEY,
            billing_id INT NOT NULL,
            amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            created_at DATETIME NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $this->ensureRepeatableReceiptNumbers($pdo);
    }

    private function ensureTable(PDO $pdo, string $table, string $sql): void
    {
        $statement = $pdo->query('SHOW TABLES LIKE ' . $pdo->quote($table));
        $exists = $statement !== false && $statement->fetchColumn();

        if (!$exists) {
            $pdo->exec($sql);
        }
    }

    private function ensureColumn(PDO $pdo, string $table, string $column, string $sql): void
    {
        $exists = $this->tableHasColumn($pdo, $table, $column);

        if (!$exists) {
            $pdo->exec($sql);
        }
    }

    private function tableHasColumn(PDO $pdo, string $table, string $column): bool
    {
        $statement = $pdo->query("SHOW COLUMNS FROM {$table} LIKE " . $pdo->quote($column));
        return $statement !== false && (bool) $statement->fetch(PDO::FETCH_ASSOC);
    }

    private function ensureRepeatableReceiptNumbers(PDO $pdo): void
    {
        $statement = $pdo->query("SHOW INDEX FROM receipts WHERE Column_name = 'receipt_number'");
        if ($statement === false) {
            return;
        }

        $indexes = $statement->fetchAll(PDO::FETCH_ASSOC);
        $hasNonUniqueIndex = false;

        foreach ($indexes as $index) {
            $keyName = (string) ($index['Key_name'] ?? '');
            $isUnique = (int) ($index['Non_unique'] ?? 1) === 0;

            if ($keyName === 'receipt_number' && $isUnique) {
                $pdo->exec('ALTER TABLE receipts DROP INDEX receipt_number');
                continue;
            }

            if ((string) ($index['Column_name'] ?? '') === 'receipt_number') {
                $hasNonUniqueIndex = true;
            }
        }

        if (!$hasNonUniqueIndex) {
            $pdo->exec('ALTER TABLE receipts ADD INDEX idx_receipts_receipt_number (receipt_number)');
        }
    }
}
