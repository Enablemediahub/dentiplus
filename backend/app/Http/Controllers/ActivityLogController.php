<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Database;
use App\Support\Response;
use PDO;

final class ActivityLogController extends Controller
{
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
            'items' => array_map([$this, 'mapActivityRow'], $statement->fetchAll(PDO::FETCH_ASSOC)),
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

    private function mapActivityRow(array $row): array
    {
        $createdAt = (string) ($row['created_at'] ?? '');
        $actorRole = trim((string) ($row['actor_role'] ?? ''));

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
        ];
    }
}
