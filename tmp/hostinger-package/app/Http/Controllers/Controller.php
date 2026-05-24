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
}
