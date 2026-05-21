<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Database;
use App\Support\Request;
use App\Support\Response;
use PDO;
use Throwable;

final class StoreController extends Controller
{
    public function index(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $branch = trim((string) ($user['branch'] ?? ''));
        $pdo = Database::connection();

        $this->ensureSchema($pdo);

        Response::json([
            'items' => $this->storeItems($pdo, $role, $staffId, $branch),
            'sales' => $this->recentSales($pdo, $role, $staffId, $branch),
        ]);
    }

    public function storeItem(): void
    {
        $user = $this->authUser();
        $branch = trim((string) ($user['branch'] ?? ''));
        $payload = Request::json();
        $pdo = Database::connection();

        $this->ensureSchema($pdo);

        $name = trim((string) ($payload['name'] ?? ''));
        $description = trim((string) ($payload['description'] ?? ''));
        $price = round((float) ($payload['price'] ?? 0), 2);
        $stock = (int) ($payload['stock'] ?? 0);

        if ($name === '' || $price <= 0 || $stock < 0) {
            Response::json(['message' => 'Name, valid price, and stock are required.'], 422);
        }

        $statement = $pdo->prepare(
            'INSERT INTO store_items (name, description, price, stock, branch, created_at)
             VALUES (:name, :description, :price, :stock, :branch, CURRENT_TIMESTAMP)'
        );
        $statement->execute([
            'name' => $name,
            'description' => $description !== '' ? $description : null,
            'price' => $price,
            'stock' => $stock,
            'branch' => $branch !== '' ? $branch : null,
        ]);

        Response::json(['message' => 'Store item added successfully.']);
    }

    public function updateItem(): void
    {
        $payload = Request::json();
        $pdo = Database::connection();
        $this->ensureSchema($pdo);

        $id = isset($payload['id']) ? (int) $payload['id'] : 0;
        $name = trim((string) ($payload['name'] ?? ''));
        $description = trim((string) ($payload['description'] ?? ''));
        $price = round((float) ($payload['price'] ?? 0), 2);
        $stock = (int) ($payload['stock'] ?? 0);

        if ($id <= 0 || $name === '' || $price <= 0 || $stock < 0) {
            Response::json(['message' => 'Item, name, valid price, and stock are required.'], 422);
        }

        $statement = $pdo->prepare(
            'UPDATE store_items
             SET name = :name,
                 description = :description,
                 price = :price,
                 stock = :stock
             WHERE id = :id
             LIMIT 1'
        );
        $statement->execute([
            'id' => $id,
            'name' => $name,
            'description' => $description !== '' ? $description : null,
            'price' => $price,
            'stock' => $stock,
        ]);

        Response::json(['message' => 'Store item updated successfully.']);
    }

    public function deleteItem(): void
    {
        $payload = Request::json();
        $pdo = Database::connection();
        $this->ensureSchema($pdo);

        $id = isset($payload['id']) ? (int) $payload['id'] : 0;
        if ($id <= 0) {
            Response::json(['message' => 'Store item ID is required.'], 422);
        }

        try {
            $statement = $pdo->prepare('DELETE FROM store_items WHERE id = :id LIMIT 1');
            $statement->execute(['id' => $id]);
        } catch (Throwable $exception) {
            Response::json(['message' => 'Unable to delete this store item right now.'], 409);
        }

        Response::json(['message' => 'Store item deleted successfully.']);
    }

    public function processSale(): void
    {
        $user = $this->authUser();
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $branch = trim((string) ($user['branch'] ?? ''));
        $payload = Request::json();
        $pdo = Database::connection();

        $this->ensureSchema($pdo);

        $items = is_array($payload['items'] ?? null) ? $payload['items'] : [];
        if ($items === []) {
            Response::json(['message' => 'Select at least one store item before processing a sale.'], 422);
        }

        $saleItems = [];
        $totalAmount = 0.0;

        foreach ($items as $entry) {
          $itemId = isset($entry['item_id']) ? (int) $entry['item_id'] : 0;
          $quantity = isset($entry['quantity']) ? (int) $entry['quantity'] : 0;
          if ($itemId <= 0 || $quantity <= 0) {
              Response::json(['message' => 'Each sale line must have a valid item and quantity.'], 422);
          }

          $statement = $pdo->prepare('SELECT id, name, price, stock, branch FROM store_items WHERE id = :id LIMIT 1');
          $statement->execute(['id' => $itemId]);
          $item = $statement->fetch(PDO::FETCH_ASSOC);
          if (!$item) {
              Response::json(['message' => 'One of the selected store items could not be found.'], 404);
          }

          if ($branch !== '' && !in_array((string) ($item['branch'] ?? ''), ['', $branch], true)) {
              Response::json(['message' => 'One of the selected store items does not belong to your branch.'], 422);
          }

          $stock = (int) ($item['stock'] ?? 0);
          if ($stock < $quantity) {
              Response::json(['message' => 'Insufficient stock for ' . (string) ($item['name'] ?? 'selected item') . '.'], 422);
          }

          $price = round((float) ($item['price'] ?? 0), 2);
          $subtotal = round($price * $quantity, 2);
          $totalAmount += $subtotal;
          $saleItems[] = [
              'id' => (int) ($item['id'] ?? 0),
              'name' => (string) ($item['name'] ?? ''),
              'price' => $price,
              'quantity' => $quantity,
              'subtotal' => $subtotal,
          ];
        }

        $pdo->beginTransaction();

        try {
            foreach ($saleItems as $entry) {
                $stockUpdate = $pdo->prepare('UPDATE store_items SET stock = stock - :quantity WHERE id = :id');
                $stockUpdate->execute([
                    'id' => $entry['id'],
                    'quantity' => $entry['quantity'],
                ]);
            }

            $saleInsert = $pdo->prepare(
                'INSERT INTO store_sales (receptionist_id, branch, total_amount, created_at)
                 VALUES (:receptionist_id, :branch, :total_amount, CURRENT_TIMESTAMP)'
            );
            $saleInsert->execute([
                'receptionist_id' => $staffId > 0 ? $staffId : null,
                'branch' => $branch !== '' ? $branch : null,
                'total_amount' => round($totalAmount, 2),
            ]);

            $saleId = (int) $pdo->lastInsertId();
            $saleItemInsert = $pdo->prepare(
                'INSERT INTO store_sale_items (sale_id, item_id, quantity, price)
                 VALUES (:sale_id, :item_id, :quantity, :price)'
            );

            foreach ($saleItems as $entry) {
                $saleItemInsert->execute([
                    'sale_id' => $saleId,
                    'item_id' => $entry['id'],
                    'quantity' => $entry['quantity'],
                    'price' => $entry['price'],
                ]);
            }

            $pdo->commit();
        } catch (Throwable $exception) {
            $pdo->rollBack();
            Response::json(['message' => $exception->getMessage() ?: 'Unable to process store sale right now.'], 500);
        }

        Response::json([
            'message' => 'Store sale processed successfully.',
            'receipt' => [
                'saleId' => $saleId,
                'branch' => $branch,
                'dateLabel' => date('d M Y h:i A'),
                'totalAmountLabel' => 'GHS ' . number_format(round($totalAmount, 2), 2),
                'items' => array_map(static fn (array $entry): array => [
                    'name' => $entry['name'],
                    'quantity' => $entry['quantity'],
                    'priceLabel' => 'GHS ' . number_format($entry['price'], 2),
                    'subtotalLabel' => 'GHS ' . number_format($entry['subtotal'], 2),
                ], $saleItems),
            ],
        ]);
    }

    private function storeItems(PDO $pdo, string $role, int $staffId, string $branch): array
    {
        $sql = 'SELECT id, name, description, price, stock, branch, created_at FROM store_items WHERE 1=1';
        $params = [];

        if ($role === 'receptionist' && $branch !== '') {
            $sql .= ' AND branch = :branch';
            $params['branch'] = $branch;
        }

        $sql .= ' ORDER BY name ASC';
        $statement = $pdo->prepare($sql);
        $statement->execute($params);

        return array_map(static fn (array $row): array => [
            'id' => (int) ($row['id'] ?? 0),
            'name' => (string) ($row['name'] ?? ''),
            'description' => (string) ($row['description'] ?? ''),
            'price' => (float) ($row['price'] ?? 0),
            'priceLabel' => 'GHS ' . number_format((float) ($row['price'] ?? 0), 2),
            'stock' => (int) ($row['stock'] ?? 0),
            'stockLabel' => (int) ($row['stock'] ?? 0) . ' units',
            'status' => ((int) ($row['stock'] ?? 0) <= 0) ? 'Out of stock' : (((int) ($row['stock'] ?? 0) <= 10) ? 'Low stock' : 'Ready'),
            'branch' => (string) ($row['branch'] ?? ''),
        ], $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    private function recentSales(PDO $pdo, string $role, int $staffId, string $branch): array
    {
        $sql = "
            SELECT
                s.id,
                s.total_amount,
                s.created_at,
                s.branch,
                COUNT(ssi.id) AS item_count
            FROM store_sales s
            LEFT JOIN store_sale_items ssi ON ssi.sale_id = s.id
            WHERE 1=1";
        $params = [];

        if ($role === 'receptionist' && $staffId > 0 && $branch !== '') {
            $sql .= ' AND s.receptionist_id = :staff_id AND s.branch = :branch';
            $params['staff_id'] = $staffId;
            $params['branch'] = $branch;
        }

        $sql .= ' GROUP BY s.id, s.total_amount, s.created_at, s.branch ORDER BY s.created_at DESC LIMIT 20';
        $statement = $pdo->prepare($sql);
        $statement->execute($params);

        return array_map(static fn (array $row): array => [
            'id' => (int) ($row['id'] ?? 0),
            'saleId' => 'SALE-' . str_pad((string) ($row['id'] ?? 0), 5, '0', STR_PAD_LEFT),
            'totalAmountLabel' => 'GHS ' . number_format((float) ($row['total_amount'] ?? 0), 2),
            'itemCountLabel' => (int) ($row['item_count'] ?? 0) . ' item(s)',
            'createdAtLabel' => !empty($row['created_at']) ? date('d M Y h:i A', strtotime((string) ($row['created_at'] ?? ''))) : '',
            'branch' => (string) ($row['branch'] ?? ''),
        ], $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    private function ensureSchema(PDO $pdo): void
    {
        $pdo->exec("CREATE TABLE IF NOT EXISTS store_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT NULL,
            price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            stock INT NOT NULL DEFAULT 0,
            branch VARCHAR(100) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS store_sales (
            id INT AUTO_INCREMENT PRIMARY KEY,
            receptionist_id INT NULL,
            branch VARCHAR(50) NULL,
            total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS store_sale_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sale_id INT NOT NULL,
            item_id INT NOT NULL,
            quantity INT NOT NULL DEFAULT 1,
            price DECIMAL(10,2) NOT NULL DEFAULT 0.00
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $this->ensureColumn($pdo, 'store_items', 'branch', 'ALTER TABLE store_items ADD COLUMN branch VARCHAR(100) NULL AFTER stock');
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
