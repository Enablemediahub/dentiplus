<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Auth;
use App\Support\Request;

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
}
