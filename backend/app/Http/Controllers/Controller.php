<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Auth;
use App\Support\Request;
use PDO;
use Throwable;

abstract class Controller
{
    protected function authUser(): array
    {
        return Auth::userFromToken(Request::bearerToken());
    }

    protected function normalizedRole(array $user): string
    {
        $role = strtolower(trim((string) ($user['staff_role'] ?: $user['role'])));

        return match ($role) {
            'ceo', 'superadmin', 'admin' => 'admin',
            'receptionist' => 'receptionist',
            'dentist' => 'dentist',
            'accountant' => 'accountant',
            default => 'admin',
        };
    }

    protected function resolvedBranchFilter(PDO $pdo, array $user): string
    {
        $role = $this->normalizedRole($user);
        $userBranch = trim((string) ($user['branch'] ?? ''));

        if ($role !== 'admin') {
            return $userBranch;
        }

        $requestedBranch = trim((string) ($_GET['branch'] ?? ''));
        if ($requestedBranch === '') {
            return '';
        }

        return in_array($requestedBranch, $this->availableBranchNames($pdo), true) ? $requestedBranch : '';
    }

    protected function availableBranchNames(PDO $pdo): array
    {
        try {
            $statement = $pdo->query(
                "SELECT branch_name
                 FROM (
                    SELECT TRIM(name) AS branch_name FROM branches
                    UNION
                    SELECT TRIM(branch) AS branch_name FROM staff_branches
                 ) branch_list
                 WHERE branch_name IS NOT NULL
                   AND branch_name <> ''
                 ORDER BY branch_name ASC"
            );
        } catch (Throwable $exception) {
            $statement = $pdo->query(
                "SELECT DISTINCT TRIM(branch) AS branch_name
                 FROM staff_branches
                 WHERE branch IS NOT NULL
                   AND branch <> ''
                 ORDER BY branch ASC"
            );
        }

        return array_values(array_filter(array_map(
            static fn ($value): string => trim((string) $value),
            $statement->fetchAll(PDO::FETCH_COLUMN) ?: []
        )));
    }

    protected function availableBranchesWithIds(PDO $pdo): array
    {
        try {
            $statement = $pdo->query(
                "SELECT id, TRIM(name) AS name
                 FROM branches
                 WHERE name IS NOT NULL
                   AND TRIM(name) <> ''
                 ORDER BY name ASC"
            );

            $rows = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];
            if ($rows !== []) {
                return array_map(static fn (array $row): array => [
                    'id' => (int) ($row['id'] ?? 0),
                    'name' => trim((string) ($row['name'] ?? '')),
                ], $rows);
            }
        } catch (Throwable $exception) {
            // Fall back to branch names gathered from staff_branches.
        }

        $names = $this->availableBranchNames($pdo);

        return array_map(static fn (string $name, int $index): array => [
            'id' => $index + 1,
            'name' => $name,
        ], $names, array_keys($names));
    }
}
