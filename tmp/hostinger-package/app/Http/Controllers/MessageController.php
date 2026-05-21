<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Database;
use App\Support\Response;
use PDO;

final class MessageController extends Controller
{
    public function index(): void
    {
        $user = $this->authUser();
        $pdo = Database::connection();
        $staffId = $user['staff_id'] ? (int) $user['staff_id'] : 0;

        if ($staffId === 0) {
            Response::json(['items' => []]);
        }

        $statement = $pdo->prepare(
            "SELECT
                COALESCE(c.name, CONCAT('Conversation #', c.id)) AS thread,
                COALESCE(MAX(m.content), 'No messages yet') AS latest,
                CONCAT(COUNT(DISTINCT cp2.staff_id), ' staff') AS participants,
                CAST(SUM(CASE WHEN mr.id IS NULL AND m.sender_id != :staff_id THEN 1 ELSE 0 END) AS CHAR) AS unread
             FROM conversation_participants cp
             INNER JOIN conversations c ON c.id = cp.conversation_id
             LEFT JOIN conversation_participants cp2 ON cp2.conversation_id = c.id
             LEFT JOIN messages m ON m.conversation_id = c.id
             LEFT JOIN message_reads mr ON mr.message_id = m.id AND mr.staff_id = :staff_id
             WHERE cp.staff_id = :staff_id
             GROUP BY c.id, c.name
             ORDER BY MAX(m.created_at) DESC
             LIMIT 12"
        );
        $statement->execute(['staff_id' => $staffId]);

        Response::json([
            'items' => $statement->fetchAll(PDO::FETCH_ASSOC),
        ]);
    }
}
