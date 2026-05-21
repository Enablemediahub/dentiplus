<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Database;
use App\Support\Response;
use PDO;

final class StaffController extends Controller
{
    public function index(): void
    {
        $this->authUser();
        $pdo = Database::connection();
        $statement = $pdo->query(
            "SELECT
                TRIM(CONCAT(s.first_name, ' ', s.last_name, ' ', COALESCE(s.other_names, ''))) AS name,
                s.role,
                COALESCE(sb.branch, 'Main clinic') AS branch,
                CASE
                    WHEN u.is_active = 1 THEN 'Active'
                    ELSE 'Inactive'
                END AS status
             FROM staff s
             LEFT JOIN users u ON u.id = s.user_id
             LEFT JOIN staff_branches sb ON sb.staff_id = s.id
             ORDER BY s.created_at DESC
             LIMIT 20"
        );

        Response::json([
            'items' => $statement->fetchAll(PDO::FETCH_ASSOC),
        ]);
    }
}
