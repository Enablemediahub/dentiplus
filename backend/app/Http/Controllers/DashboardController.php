<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Database;
use App\Support\Response;
use PDO;

final class DashboardController extends Controller
{
    public function index(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        $pdo = Database::connection();
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $branch = trim((string) ($user['branch'] ?? ''));

        $todayAppointments = $this->todayAppointmentsCount($pdo, $role, $staffId, $branch);
        $waitingPatients = $this->waitingPatientsCount($pdo, $role, $staffId, $branch);
        $activeAssignments = $this->activeAssignmentsCount($pdo, $role, $staffId, $branch);
        $todayRegistrations = $this->todayRegistrationsCount($pdo, $role, $staffId, $branch);
        $openBills = $this->openBillsCount($pdo, $role, $staffId, $branch);
        $claims = $this->insuranceClaimsTotal($pdo, $role, $staffId, $branch);
        $staffCount = $this->staffCount($pdo, $role, $staffId, $branch);

        $todayRevenue = $this->todayPaymentsTotal($pdo, $role, $staffId, $branch);
        $paymentBreakdown = $this->todayPaymentBreakdown($pdo, $role, $staffId, $branch);
        $expensesSummary = $this->todayExpensesSummary($pdo, $role, $staffId, $branch);
        $expenses = $expensesSummary['total'];

        $widgets = match ($role) {
            'receptionist' => [
                ['label' => 'Today Appointments', 'value' => (string) $todayAppointments, 'trend' => 'Live from appointments', 'icon' => 'calendar'],
                ['label' => 'Waiting Queue', 'value' => (string) $activeAssignments, 'trend' => 'Active patient assignments', 'icon' => 'clock'],
                ['label' => 'Expenses Today', 'value' => 'GHS ' . number_format($expenses, 2), 'trend' => 'From today\'s expense records', 'icon' => 'finance'],
                ['label' => 'Sales Today', 'value' => 'GHS ' . number_format($todayRevenue, 2), 'trend' => 'From today\'s payments table', 'icon' => 'receipt'],
            ],
            'dentist' => [
                ['label' => 'Today Appointments', 'value' => (string) $todayAppointments, 'trend' => 'Current dentist schedule', 'icon' => 'calendar'],
                ['label' => 'Assigned Patients', 'value' => (string) $waitingPatients, 'trend' => 'Patients tied to this dentist', 'icon' => 'patients'],
                ['label' => 'Chair Queue', 'value' => (string) $activeAssignments, 'trend' => 'Patients assigned and waiting', 'icon' => 'clock'],
                ['label' => 'Pending Charges', 'value' => (string) $openBills, 'trend' => 'Charges awaiting payment closure', 'icon' => 'receipt'],
            ],
            'accountant' => [
                ['label' => 'Collections Today', 'value' => 'GHS ' . number_format($todayRevenue, 2), 'trend' => 'From payments table', 'icon' => 'receipt'],
                ['label' => 'Open Bills', 'value' => (string) $openBills, 'trend' => 'Pending settlement', 'icon' => 'briefcase'],
                ['label' => 'Expenses Today', 'value' => 'GHS ' . number_format($expenses, 2), 'trend' => 'Logged operational spend', 'icon' => 'finance'],
                ['label' => 'Insurance Claims', 'value' => 'GHS ' . number_format($claims, 2), 'trend' => 'Current insurance ledger', 'icon' => 'shield'],
            ],
            default => [
                ['label' => 'Active Staff', 'value' => (string) $staffCount, 'trend' => 'Across clinic roles', 'icon' => 'briefcase'],
                ['label' => 'Today Patients', 'value' => (string) $waitingPatients, 'trend' => 'Current waiting load', 'icon' => 'patients'],
                ['label' => 'Collections Today', 'value' => 'GHS ' . number_format($todayRevenue, 2), 'trend' => 'Payments booked today', 'icon' => 'trend'],
                ['label' => 'Open Bills', 'value' => (string) $openBills, 'trend' => 'Still requiring action', 'icon' => 'receipt'],
            ],
        };

        Response::json([
            'widgets' => $widgets,
            'today_revenue' => $todayRevenue,
            'payment_breakdown' => $paymentBreakdown,
            'today_expenses' => $expensesSummary['total'],
            'today_expense_count' => $expensesSummary['count'],
            'metrics' => [
                'today_appointments' => $todayAppointments,
                'waiting_patients' => $waitingPatients,
                'active_assignments' => $activeAssignments,
                'today_registrations' => $todayRegistrations,
                'open_bills' => $openBills,
                'staff_count' => $staffCount,
                'insurance_claims' => $claims,
            ],
        ]);
    }

    private function todayAppointmentsCount(PDO $pdo, string $role, int $staffId, string $branch): int
    {
        if ($role === 'dentist' && $staffId > 0) {
            $statement = $pdo->prepare('SELECT COUNT(*) FROM appointments WHERE dentist_id = :staff_id AND appointment_date = CURDATE()');
            $statement->execute(['staff_id' => $staffId]);

            return (int) $statement->fetchColumn();
        }

        if ($role === 'receptionist' && $branch !== '') {
            $statement = $pdo->prepare(
                "SELECT COUNT(*)
                 FROM appointments a
                 INNER JOIN staff_branches sb ON sb.staff_id = a.dentist_id
                 WHERE sb.branch = :branch
                   AND a.appointment_date = CURDATE()"
            );
            $statement->execute(['branch' => $branch]);

            return (int) $statement->fetchColumn();
        }

        return (int) $pdo->query("SELECT COUNT(*) FROM appointments WHERE appointment_date = CURDATE()")->fetchColumn();
    }

    private function waitingPatientsCount(PDO $pdo, string $role, int $staffId, string $branch): int
    {
        if ($role === 'dentist' && $staffId > 0) {
            $statement = $pdo->prepare("SELECT COUNT(*) FROM patients WHERE status = 'waiting' AND dentist_id = :staff_id");
            $statement->execute(['staff_id' => $staffId]);

            return (int) $statement->fetchColumn();
        }

        if ($role === 'receptionist' && $staffId > 0) {
            $statement = $pdo->prepare("SELECT COUNT(*) FROM patients WHERE status = 'waiting' AND receptionist_id = :staff_id");
            $statement->execute(['staff_id' => $staffId]);

            return (int) $statement->fetchColumn();
        }

        if ($role === 'receptionist' && $branch !== '') {
            $statement = $pdo->prepare(
                "SELECT COUNT(*)
                 FROM patients p
                 INNER JOIN staff_branches sb ON sb.staff_id = p.receptionist_id
                 WHERE p.status = 'waiting'
                   AND sb.branch = :branch"
            );
            $statement->execute(['branch' => $branch]);

            return (int) $statement->fetchColumn();
        }

        return (int) $pdo->query("SELECT COUNT(*) FROM patients WHERE status = 'waiting'")->fetchColumn();
    }

    private function activeAssignmentsCount(PDO $pdo, string $role, int $staffId, string $branch): int
    {
        if ($role === 'dentist' && $staffId > 0) {
            $statement = $pdo->prepare("SELECT COUNT(*) FROM patient_assignments WHERE status = 'waiting' AND dentist_id = :staff_id");
            $statement->execute(['staff_id' => $staffId]);

            return (int) $statement->fetchColumn();
        }

        if ($role === 'receptionist' && $staffId > 0) {
            $statement = $pdo->prepare("SELECT COUNT(*) FROM patient_assignments WHERE status = 'waiting' AND receptionist_id = :staff_id");
            $statement->execute(['staff_id' => $staffId]);

            return (int) $statement->fetchColumn();
        }

        if ($role === 'receptionist' && $branch !== '') {
            $statement = $pdo->prepare(
                "SELECT COUNT(*)
                 FROM patient_assignments pa
                 INNER JOIN staff_branches sb ON sb.staff_id = pa.dentist_id
                 WHERE pa.status = 'waiting'
                   AND sb.branch = :branch"
            );
            $statement->execute(['branch' => $branch]);

            return (int) $statement->fetchColumn();
        }

        return (int) $pdo->query("SELECT COUNT(*) FROM patient_assignments WHERE status = 'waiting'")->fetchColumn();
    }

    private function todayRegistrationsCount(PDO $pdo, string $role, int $staffId, string $branch): int
    {
        if ($role === 'receptionist' && $staffId > 0) {
            $statement = $pdo->prepare("SELECT COUNT(*) FROM patients WHERE receptionist_id = :staff_id AND DATE(created_at) = CURDATE()");
            $statement->execute(['staff_id' => $staffId]);

            return (int) $statement->fetchColumn();
        }

        return (int) $pdo->query("SELECT COUNT(*) FROM patients WHERE DATE(created_at) = CURDATE()")->fetchColumn();
    }

    private function openBillsCount(PDO $pdo, string $role, int $staffId, string $branch): int
    {
        if ($role === 'dentist' && $staffId > 0) {
            $statement = $pdo->prepare("SELECT COUNT(*) FROM billing_records WHERE dentist_id = :staff_id AND status IN ('pending', 'partially_paid')");
            $statement->execute(['staff_id' => $staffId]);

            return (int) $statement->fetchColumn();
        }

        return (int) $pdo->query("SELECT COUNT(*) FROM billing_records WHERE status IN ('pending', 'partially_paid')")->fetchColumn();
    }

    private function insuranceClaimsTotal(PDO $pdo, string $role, int $staffId, string $branch): float
    {
        return (float) $pdo->query("SELECT COALESCE(SUM(insurance_covered_amount), 0) FROM health_insurance")->fetchColumn();
    }

    private function staffCount(PDO $pdo, string $role, int $staffId, string $branch): int
    {
        if ($role === 'receptionist' && $branch !== '') {
            $statement = $pdo->prepare('SELECT COUNT(DISTINCT staff_id) FROM staff_branches WHERE branch = :branch');
            $statement->execute(['branch' => $branch]);

            return (int) $statement->fetchColumn();
        }

        return (int) $pdo->query('SELECT COUNT(*) FROM staff')->fetchColumn();
    }

    private function todayPaymentsTotal(PDO $pdo, string $role, int $staffId, string $branch): float
    {
        if ($role === 'receptionist' && $staffId > 0 && $branch !== '') {
            $statement = $pdo->prepare(
                "SELECT COALESCE(SUM(p.amount), 0)
                 FROM payments p
                 INNER JOIN staff_branches sb ON sb.staff_id = p.receptionist_id
                 WHERE p.receptionist_id = :staff_id
                   AND sb.branch = :branch
                   AND DATE(p.payment_date) = CURDATE()"
            );
            $statement->execute([
                'staff_id' => $staffId,
                'branch' => $branch,
            ]);

            return (float) $statement->fetchColumn();
        }

        return (float) $pdo->query("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE DATE(payment_date) = CURDATE()")->fetchColumn();
    }

    private function todayPaymentBreakdown(PDO $pdo, string $role, int $staffId, string $branch): array
    {
        $sql = "
            SELECT
                COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0) AS cash_total,
                COALESCE(SUM(CASE WHEN payment_method = 'mobile_money' THEN amount ELSE 0 END), 0) AS momo_total,
                COALESCE(SUM(CASE WHEN payment_method = 'card' THEN amount ELSE 0 END), 0) AS card_total,
                COALESCE(SUM(CASE WHEN payment_method = 'insurance' THEN amount ELSE 0 END), 0) AS insurance_total
            FROM payments
            WHERE DATE(payment_date) = CURDATE()";

        if ($role === 'receptionist' && $staffId > 0 && $branch !== '') {
            $sql = "
                SELECT
                    COALESCE(SUM(CASE WHEN p.payment_method = 'cash' THEN p.amount ELSE 0 END), 0) AS cash_total,
                    COALESCE(SUM(CASE WHEN p.payment_method = 'mobile_money' THEN p.amount ELSE 0 END), 0) AS momo_total,
                    COALESCE(SUM(CASE WHEN p.payment_method = 'card' THEN p.amount ELSE 0 END), 0) AS card_total,
                    COALESCE(SUM(CASE WHEN p.payment_method = 'insurance' THEN p.amount ELSE 0 END), 0) AS insurance_total
                FROM payments p
                INNER JOIN staff_branches sb ON sb.staff_id = p.receptionist_id
                WHERE p.receptionist_id = :staff_id
                  AND sb.branch = :branch
                  AND DATE(p.payment_date) = CURDATE()";

            $statement = $pdo->prepare($sql);
            $statement->execute([
                'staff_id' => $staffId,
                'branch' => $branch,
            ]);
        } else {
            $statement = $pdo->query($sql);
        }

        $row = $statement->fetch(PDO::FETCH_ASSOC) ?: [];

        return [
            'cash' => (float) ($row['cash_total'] ?? 0),
            'mobile_money' => (float) ($row['momo_total'] ?? 0),
            'card' => (float) ($row['card_total'] ?? 0),
            'insurance' => (float) ($row['insurance_total'] ?? 0),
        ];
    }

    private function todayExpensesSummary(PDO $pdo, string $role, int $staffId, string $branch): array
    {
        if ($role === 'receptionist' && $staffId > 0 && $branch !== '') {
            $statement = $pdo->prepare(
                "SELECT
                    COALESCE(SUM(e.amount), 0) AS total,
                    COUNT(*) AS expense_count
                 FROM expenses e
                 INNER JOIN staff_branches sb ON sb.staff_id = e.receptionist_id
                 WHERE e.receptionist_id = :staff_id
                   AND sb.branch = :branch
                   AND DATE(e.created_at) = CURDATE()"
            );
            $statement->execute([
                'staff_id' => $staffId,
                'branch' => $branch,
            ]);

            $row = $statement->fetch(PDO::FETCH_ASSOC) ?: [];

            return [
                'total' => (float) ($row['total'] ?? 0),
                'count' => (int) ($row['expense_count'] ?? 0),
            ];
        }

        $row = $pdo->query(
            "SELECT
                COALESCE(SUM(amount), 0) AS total,
                COUNT(*) AS expense_count
             FROM expenses
             WHERE DATE(created_at) = CURDATE()"
        )->fetch(PDO::FETCH_ASSOC) ?: [];

        return [
            'total' => (float) ($row['total'] ?? 0),
            'count' => (int) ($row['expense_count'] ?? 0),
        ];
    }
}
