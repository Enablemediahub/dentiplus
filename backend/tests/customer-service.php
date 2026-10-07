<?php

declare(strict_types=1);

// Run: C:\xampp\php\php.exe backend/tests/customer-service.php
// Fixtures live only in connection-local temporary tables; no client rows are changed.
require dirname(__DIR__) . '/bootstrap/app.php';

$pdo = App\Support\Database::connection();
$controller = new App\Http\Controllers\CustomerServiceController();
function invokeQueue(string $method, array $args): mixed
{
    global $controller;
    return (new ReflectionMethod($controller, $method))->invokeArgs($controller, $args);
}
function check(bool $condition, string $description): void
{
    if (!$condition) {
        throw new RuntimeException($description);
    }
    echo 'PASS: ' . $description . PHP_EOL;
}

foreach (['0241234567', '241234567', '233241234567', '+233241234567'] as $phone) {
    check(invokeQueue('normalizePhoneNumber', [$phone]) === '+233241234567', 'Normalize ' . $phone);
}
foreach (['', '123', '00441234567890', '+01234567890'] as $phone) {
    check(invokeQueue('normalizePhoneNumber', [$phone]) === null, 'Reject invalid number ' . $phone);
}
check(invokeQueue('personalizeMessage', ['Hello {first_name} {last_name}: {full_name}', ['first_name' => 'Test', 'last_name' => 'Client']]) === 'Hello Test Client: Test Client', 'Personalize saved template');

$pdo->exec("CREATE TEMPORARY TABLE patients (
    id INT PRIMARY KEY, first_name VARCHAR(100), last_name VARCHAR(100), other_names VARCHAR(100),
    phone VARCHAR(30), email VARCHAR(100), birth_date DATE, completed_time DATETIME,
    created_at DATETIME, branch VARCHAR(100), receptionist_id INT
)");
$pdo->exec("CREATE TEMPORARY TABLE appointments (
    id INT, patient_name VARCHAR(255), appointment_date DATE, status VARCHAR(50), dentist_id INT
)");
$pdo->exec('CREATE TEMPORARY TABLE staff (id INT)');
$pdo->exec('CREATE TEMPORARY TABLE staff_branches (staff_id INT, branch VARCHAR(100))');

$pdo->exec("INSERT INTO patients (id, first_name, last_name, phone, birth_date) VALUES
    (1, 'December', 'Client', '0241234567', '1990-12-31'),
    (2, 'January', 'Client', '0241234568', '1990-01-02'),
    (3, 'Later', 'Client', '0241234569', '1990-02-01'),
    (4, 'Today', 'Client', NULL, '1990-12-25')");
$birthdays = invokeQueue('birthdayQueue', [$pdo, new DateTimeImmutable('2026-12-25')]);
check(array_column($birthdays, 'patientId') === [4, 1, 2], 'Upcoming birthdays include today and wrap across year-end');
check($birthdays[2]['eventDate'] === '2027-01-02', 'Birthday displays its upcoming year');
check(count(invokeQueue('clientQueue', [$pdo])) === 4, 'All-client list retains clients with missing phones');

$pdo->exec('DELETE FROM patients');
$pdo->exec("INSERT INTO patients (id, first_name, last_name, phone, completed_time, created_at, branch) VALUES
    (1, 'Boundary', 'Client', '0241234567', DATE_SUB(CURDATE(), INTERVAL 6 MONTH), DATE_SUB(CURDATE(), INTERVAL 1 YEAR), 'Main'),
    (2, 'Recent', 'Client', '0241234568', CURDATE(), DATE_SUB(CURDATE(), INTERVAL 1 YEAR), 'Main'),
    (3, 'New', 'Client', '0241234569', NULL, CURDATE(), 'Main'),
    (4, 'Unknown', 'Client', '0241234570', NULL, DATE_SUB(CURDATE(), INTERVAL 1 YEAR), 'Main'),
    (5, 'Appointment', 'Client', '0241234571', NULL, DATE_SUB(CURDATE(), INTERVAL 1 YEAR), 'Other')");
$pdo->exec("INSERT INTO appointments VALUES
    (1, 'Appointment Client', DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'completed', 1),
    (2, 'Boundary Client', DATE_ADD(CURDATE(), INTERVAL 1 MONTH), 'scheduled', 1),
    (3, 'Unknown Client', CURDATE(), 'cancelled', 1)");
$recalls = invokeQueue('dormantQueue', [$pdo, 'receptionist', 0, '']);
$ids = array_column($recalls, 'patientId');
sort($ids);
check($ids === [1, 4], 'Recall includes six-month boundary and excludes recent visits and new registrations');
check(str_contains($recalls[0]['note'], 'No completed visit recorded'), 'Unknown visits are explicitly distinguished');
$branchRecalls = invokeQueue('dormantQueue', [$pdo, 'receptionist', 0, 'Other']);
check($branchRecalls === [], 'Recall respects receptionist branch');
echo 'Customer-service checks passed. No SMS dispatched.' . PHP_EOL;
