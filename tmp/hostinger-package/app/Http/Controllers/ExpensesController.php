<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Database;
use App\Support\Request;
use App\Support\Response;
use PDO;
use Throwable;

final class ExpensesController extends Controller
{
    public function index(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $pdo = Database::connection();
        $branch = $this->resolvedBranchFilter($pdo, $user);

        $this->ensureSchema($pdo);

        Response::json([
            'items' => $this->expenseItems($pdo, $role, $staffId, $branch),
        ]);
    }

    public function store(): void
    {
        $user = $this->authUser();
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $branch = trim((string) ($user['branch'] ?? ''));
        $payload = Request::json();
        $pdo = Database::connection();

        $this->ensureSchema($pdo);

        $detail = trim((string) ($payload['detail'] ?? ''));
        $category = trim((string) ($payload['category'] ?? ''));
        $amount = round((float) ($payload['amount'] ?? 0), 2);
        $expenseDate = trim((string) ($payload['expense_date'] ?? date('Y-m-d')));
        $notes = trim((string) ($payload['notes'] ?? ''));

        if ($detail === '' || $category === '' || $amount <= 0 || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $expenseDate)) {
            Response::json(['message' => 'Detail, category, valid amount, and expense date are required.'], 422);
        }

        $statement = $pdo->prepare(
            'INSERT INTO expenses (
                detail,
                category,
                description,
                amount,
                expense_date,
                notes,
                receptionist_id,
                branch,
                created_at,
                updated_at
            ) VALUES (
                :detail,
                :category,
                :description,
                :amount,
                :expense_date,
                :notes,
                :receptionist_id,
                :branch,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            )'
        );
        $statement->execute([
            'detail' => $detail,
            'category' => $category,
            'description' => $detail,
            'amount' => $amount,
            'expense_date' => $expenseDate,
            'notes' => $notes !== '' ? $notes : null,
            'receptionist_id' => $staffId > 0 ? $staffId : null,
            'branch' => $branch !== '' ? $branch : null,
        ]);

        Response::json(['message' => 'Expense recorded successfully.']);
    }

    public function update(): void
    {
        $payload = Request::json();
        $pdo = Database::connection();
        $this->ensureSchema($pdo);

        $id = isset($payload['id']) ? (int) $payload['id'] : 0;
        $detail = trim((string) ($payload['detail'] ?? ''));
        $category = trim((string) ($payload['category'] ?? ''));
        $amount = round((float) ($payload['amount'] ?? 0), 2);
        $expenseDate = trim((string) ($payload['expense_date'] ?? ''));
        $notes = trim((string) ($payload['notes'] ?? ''));

        if ($id <= 0 || $detail === '' || $category === '' || $amount <= 0 || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $expenseDate)) {
            Response::json(['message' => 'Expense, detail, category, valid amount, and expense date are required.'], 422);
        }

        $statement = $pdo->prepare(
            'UPDATE expenses
             SET detail = :detail,
                 category = :category,
                 description = :description,
                 amount = :amount,
                 expense_date = :expense_date,
                 notes = :notes,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = :id
             LIMIT 1'
        );
        $statement->execute([
            'id' => $id,
            'detail' => $detail,
            'category' => $category,
            'description' => $detail,
            'amount' => $amount,
            'expense_date' => $expenseDate,
            'notes' => $notes !== '' ? $notes : null,
        ]);

        Response::json(['message' => 'Expense updated successfully.']);
    }

    public function delete(): void
    {
        $payload = Request::json();
        $pdo = Database::connection();
        $this->ensureSchema($pdo);

        $id = isset($payload['id']) ? (int) $payload['id'] : 0;
        if ($id <= 0) {
            Response::json(['message' => 'Expense ID is required.'], 422);
        }

        try {
            $statement = $pdo->prepare('DELETE FROM expenses WHERE id = :id LIMIT 1');
            $statement->execute(['id' => $id]);
        } catch (Throwable $exception) {
            Response::json(['message' => 'Unable to delete this expense right now.'], 409);
        }

        Response::json(['message' => 'Expense deleted successfully.']);
    }

    private function expenseItems(PDO $pdo, string $role, int $staffId, string $branch): array
    {
        $sql = "
            SELECT id, detail, category, description, amount, expense_date, notes, receptionist_id, branch, created_at
            FROM expenses
            WHERE 1=1";
        $params = [];

        if ($role === 'receptionist') {
            if ($staffId > 0) {
                $sql .= ' AND receptionist_id = :staff_id';
                $params['staff_id'] = $staffId;
            } elseif ($branch !== '') {
                $sql .= ' AND branch = :branch';
                $params['branch'] = $branch;
            }
        } elseif ($role === 'admin' && $branch !== '') {
            $sql .= ' AND branch = :branch';
            $params['branch'] = $branch;
        }

        $sql .= ' ORDER BY expense_date DESC, id DESC';
        $statement = $pdo->prepare($sql);
        $statement->execute($params);

        return array_map(static function (array $row): array {
            $detail = trim((string) ($row['detail'] ?? ''));
            $description = trim((string) ($row['description'] ?? ''));

            if ($detail === '' || ($detail === 'Operational expense' && $description !== '')) {
                $detail = $description !== '' ? $description : 'Operational expense';
            }

            return [
                'id' => (int) ($row['id'] ?? 0),
                'reference' => 'EXP-' . str_pad((string) ($row['id'] ?? 0), 5, '0', STR_PAD_LEFT),
                'detail' => $detail,
                'category' => (string) ($row['category'] ?? ''),
                'amount' => (float) ($row['amount'] ?? 0),
                'amountLabel' => 'GHS ' . number_format((float) ($row['amount'] ?? 0), 2),
                'expenseDate' => (string) ($row['expense_date'] ?? ''),
                'expenseDateLabel' => !empty($row['expense_date']) ? date('d M Y', strtotime((string) ($row['expense_date'] ?? ''))) : '',
                'notes' => (string) ($row['notes'] ?? ''),
                'branch' => (string) ($row['branch'] ?? ''),
                'createdAtLabel' => !empty($row['created_at']) ? date('d M Y h:i A', strtotime((string) ($row['created_at'] ?? ''))) : '',
            ];
        }, $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    private function ensureSchema(PDO $pdo): void
    {
        $pdo->exec("CREATE TABLE IF NOT EXISTS expenses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            detail VARCHAR(255) NOT NULL,
            category VARCHAR(100) NOT NULL,
            amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            expense_date DATE NOT NULL,
            notes TEXT NULL,
            receptionist_id INT NULL,
            branch VARCHAR(100) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $detailAdded = $this->ensureColumn($pdo, 'expenses', 'detail', 'ALTER TABLE expenses ADD COLUMN detail VARCHAR(255) NOT NULL DEFAULT \'Operational expense\' AFTER id');
        $categoryAdded = $this->ensureColumn($pdo, 'expenses', 'category', 'ALTER TABLE expenses ADD COLUMN category VARCHAR(100) NOT NULL DEFAULT \'Operations\' AFTER detail');
        $descriptionAdded = $this->ensureColumn($pdo, 'expenses', 'description', 'ALTER TABLE expenses ADD COLUMN description VARCHAR(255) NULL AFTER category');
        $expenseDateAdded = $this->ensureColumn($pdo, 'expenses', 'expense_date', 'ALTER TABLE expenses ADD COLUMN expense_date DATE NULL AFTER amount');
        $notesAdded = $this->ensureColumn($pdo, 'expenses', 'notes', 'ALTER TABLE expenses ADD COLUMN notes TEXT NULL AFTER expense_date');
        $branchAdded = $this->ensureColumn($pdo, 'expenses', 'branch', 'ALTER TABLE expenses ADD COLUMN branch VARCHAR(100) NULL AFTER receptionist_id');
        $updatedAtAdded = $this->ensureColumn($pdo, 'expenses', 'updated_at', 'ALTER TABLE expenses ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');

        if ($detailAdded || $categoryAdded || $descriptionAdded || $expenseDateAdded || $notesAdded || $branchAdded || $updatedAtAdded) {
            $pdo->exec("UPDATE expenses SET expense_date = DATE(created_at) WHERE expense_date IS NULL");
            $pdo->exec("UPDATE expenses SET detail = CASE
                WHEN detail IS NULL OR detail = '' OR (detail = 'Operational expense' AND COALESCE(description, '') <> '')
                    THEN COALESCE(NULLIF(description, ''), 'Operational expense')
                ELSE detail
            END");
            $pdo->exec("UPDATE expenses SET description = COALESCE(NULLIF(description, ''), detail)");
            $pdo->exec("UPDATE expenses SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)");
        }
    }

    private function ensureColumn(PDO $pdo, string $table, string $column, string $sql): bool
    {
        $statement = $pdo->query("SHOW COLUMNS FROM {$table} LIKE " . $pdo->quote($column));
        $exists = $statement !== false && $statement->fetch(PDO::FETCH_ASSOC);

        if (!$exists) {
            $pdo->exec($sql);
            return true;
        }

        return false;
    }
}
