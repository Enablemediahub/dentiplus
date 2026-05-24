<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Database;
use App\Support\Request;
use App\Support\Response;
use PDO;
use Throwable;

final class DatabaseAdminController extends Controller
{
    private const PREFERRED_TABLES = [
        'patients',
        'appointments',
        'billing_records',
        'payments',
        'receipts',
        'health_insurance',
        'expenses',
        'medical_records',
        'prescriptions',
        'staff',
        'staff_branches',
        'users',
        'store_items',
        'store_sales',
        'store_sale_items',
        'patient_assignments',
        'follow_up_patients',
        'follow_up_history',
        'procedures',
        'settings',
        'branches',
    ];

    private const EXCLUDED_TABLES = [
        'sessions',
        'message_reads',
        'conversation_participants',
    ];

    private array $metadataCache = [];

    public function meta(): void
    {
        [$pdo, $user, $branch] = $this->authorizedContext();
        $tableSearch = trim((string) ($_GET['table_search'] ?? ''));
        $tables = $this->listTables($pdo, $tableSearch);

        Response::json([
            'database_name' => $this->databaseName($pdo),
            'branch' => $branch,
            'branch_label' => $branch !== '' ? $branch : 'Merged View',
            'available_branches' => $this->availableBranchNames($pdo),
            'table_search' => $tableSearch,
            'tables' => $tables,
            'stats' => [
                'table_count' => count($tables),
                'row_count' => 0,
                'column_count' => 0,
                'writable' => true,
            ],
        ]);
    }

    public function table(): void
    {
        [$pdo, $user, $branch] = $this->authorizedContext();
        $tableSearch = trim((string) ($_GET['table_search'] ?? ''));
        $selectedTable = trim((string) ($_GET['table'] ?? ''));
        $search = trim((string) ($_GET['search'] ?? ''));
        $patientSearch = trim((string) ($_GET['patient_search'] ?? ''));
        $dateColumn = trim((string) ($_GET['date_column'] ?? ''));
        $dateFrom = trim((string) ($_GET['date_from'] ?? ''));
        $dateTo = trim((string) ($_GET['date_to'] ?? ''));
        $page = max(1, (int) ($_GET['page'] ?? 1));
        $perPage = min(100, max(10, (int) ($_GET['per_page'] ?? 25)));

        $tables = $this->listTables($pdo, $tableSearch);
        $selectedTable = $this->resolveSelectedTable($selectedTable, $tables);
        if ($selectedTable === '') {
            Response::json([
                'message' => 'No accessible table is available for the current filter.',
                'database_name' => $this->databaseName($pdo),
                'branch' => $branch,
                'branch_label' => $branch !== '' ? $branch : 'Merged View',
                'available_branches' => $this->availableBranchNames($pdo),
                'table_search' => $tableSearch,
                'search' => $search,
                'tables' => $tables,
            ], 404);
        }

        $payload = $this->buildTablePayload($pdo, $selectedTable, $branch, $search, $patientSearch, $dateColumn, $dateFrom, $dateTo, $page, $perPage);

        Response::json([
            'database_name' => $this->databaseName($pdo),
            'branch' => $branch,
            'branch_label' => $branch !== '' ? $branch : 'Merged View',
            'available_branches' => $this->availableBranchNames($pdo),
            'table_search' => $tableSearch,
            'search' => $search,
            'patient_search' => $patientSearch,
            'date_column' => $payload['active_filters']['date_column'] ?? '',
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'selected_table' => $selectedTable,
            'tables' => $tables,
            'stats' => [
                'table_count' => count($tables),
                'row_count' => (int) ($payload['pagination']['total'] ?? 0),
                'column_count' => count($payload['schema']['columns'] ?? []),
                'writable' => (bool) ($payload['schema']['writable'] ?? false),
            ],
            'table' => $payload,
        ]);
    }

    public function row(): void
    {
        [$pdo, $user, $branch] = $this->authorizedContext();
        $table = trim((string) ($_GET['table'] ?? ''));
        $recordId = trim((string) ($_GET['record_id'] ?? ''));

        $metadata = $this->validatedMetadata($pdo, $table);
        if (!$metadata) {
            Response::json(['message' => 'The selected table is not available in the database workspace.'], 404);
        }

        $record = $this->findRecord($pdo, $metadata, $recordId, $branch);
        if (!$record) {
            Response::json(['message' => 'The selected row could not be found in this branch view.'], 404);
        }

        Response::json([
            'table' => $metadata['name'],
            'schema' => $this->serializeSchema($metadata),
            'record' => $record,
            'can_write' => $metadata['writable'],
        ]);
    }

    public function duplicates(): void
    {
        [$pdo, $user, $branch] = $this->authorizedContext();
        $table = trim((string) ($_GET['table'] ?? ''));
        $metadata = $this->validatedMetadata($pdo, $table);
        if (!$metadata) {
            Response::json(['message' => 'The selected table is not available in the database workspace.'], 404);
        }

        $candidateColumns = $this->duplicateCandidateColumns($metadata);
        if ($candidateColumns === []) {
            Response::json([
                'table' => $metadata['name'],
                'label' => $metadata['label'],
                'selected_column' => null,
                'available_columns' => [],
                'duplicate_groups' => [],
                'summary' => [
                    'group_count' => 0,
                    'row_count' => 0,
                ],
                'message' => 'No likely duplicate-check columns were detected for this table yet.',
            ]);
        }

        $requestedColumn = trim((string) ($_GET['column'] ?? ''));
        $selectedColumn = $candidateColumns[0]['name'];
        foreach ($candidateColumns as $candidateColumn) {
            if ($candidateColumn['name'] === $requestedColumn) {
                $selectedColumn = $requestedColumn;
                break;
            }
        }

        $groups = $this->duplicateGroups($pdo, $metadata, $branch, $selectedColumn);
        $rowCount = array_sum(array_map(static fn (array $group): int => (int) ($group['count'] ?? 0), $groups));

        Response::json([
            'table' => $metadata['name'],
            'label' => $metadata['label'],
            'selected_column' => $selectedColumn,
            'available_columns' => $candidateColumns,
            'duplicate_groups' => $groups,
            'summary' => [
                'group_count' => count($groups),
                'row_count' => $rowCount,
            ],
        ]);
    }

    public function update(): void
    {
        [$pdo, $user, $branch] = $this->authorizedContext();
        $payload = Request::json();
        $table = trim((string) ($payload['table'] ?? ''));
        $recordId = trim((string) ($payload['record_id'] ?? ''));
        $values = is_array($payload['values'] ?? null) ? $payload['values'] : [];

        $metadata = $this->validatedMetadata($pdo, $table);
        if (!$metadata || !$metadata['writable']) {
            Response::json(['message' => 'This table is read-only in the database workspace.'], 422);
        }

        $record = $this->findRecord($pdo, $metadata, $recordId, $branch);
        if (!$record) {
            Response::json(['message' => 'The selected row could not be found in this branch view.'], 404);
        }

        $updatePayload = $this->buildUpdatePayload($metadata, $values);
        if ($updatePayload === []) {
            Response::json(['message' => 'No editable fields were changed for this row.'], 422);
        }

        $sql = 'UPDATE ' . $this->quoted($metadata['name']) . ' SET ';
        $assignments = [];
        $params = [];
        foreach ($updatePayload as $column => $value) {
            $assignments[] = $this->quoted($column) . ' = :' . $column;
            $params[$column] = $value;
        }

        $sql .= implode(', ', $assignments);
        $sql .= ' WHERE ' . $this->quoted($metadata['primary_key']) . ' = :record_id';
        $params['record_id'] = $recordId;

        if ($branch !== '') {
            if ($metadata['has_branch_id']) {
                $branchId = $this->branchIdByName($pdo, $branch);
                if ($branchId > 0) {
                    $sql .= ' AND ' . $this->quoted('branch_id') . ' = :scope_branch_id';
                    $params['scope_branch_id'] = $branchId;
                }
            } elseif ($metadata['has_branch']) {
                $sql .= ' AND ' . $this->quoted('branch') . ' = :scope_branch';
                $params['scope_branch'] = $branch;
            }
        }

        $statement = $pdo->prepare($sql);
        $statement->execute($params);

        Response::json([
            'message' => sprintf('%s row updated successfully.', $metadata['label']),
            'record' => $this->findRecord($pdo, $metadata, $recordId, $branch),
        ]);
    }

    public function delete(): void
    {
        [$pdo, $user, $branch] = $this->authorizedContext();
        $payload = Request::json();
        $table = trim((string) ($payload['table'] ?? ''));
        $recordId = trim((string) ($payload['record_id'] ?? ''));

        $metadata = $this->validatedMetadata($pdo, $table);
        if (!$metadata || !$metadata['writable']) {
            Response::json(['message' => 'This table is read-only in the database workspace.'], 422);
        }

        $record = $this->findRecord($pdo, $metadata, $recordId, $branch);
        if (!$record) {
            Response::json(['message' => 'The selected row could not be found in this branch view.'], 404);
        }

        $sql = 'DELETE FROM ' . $this->quoted($metadata['name']) . ' WHERE ' . $this->quoted($metadata['primary_key']) . ' = :record_id';
        $params = ['record_id' => $recordId];

        if ($branch !== '') {
            if ($metadata['has_branch_id']) {
                $branchId = $this->branchIdByName($pdo, $branch);
                if ($branchId > 0) {
                    $sql .= ' AND ' . $this->quoted('branch_id') . ' = :scope_branch_id';
                    $params['scope_branch_id'] = $branchId;
                }
            } elseif ($metadata['has_branch']) {
                $sql .= ' AND ' . $this->quoted('branch') . ' = :scope_branch';
                $params['scope_branch'] = $branch;
            }
        }

        try {
            $statement = $pdo->prepare($sql);
            $statement->execute($params);
        } catch (Throwable $exception) {
            Response::json([
                'message' => 'This row could not be deleted right now. Remove linked records first or use the specific module for a safer cleanup.',
            ], 422);
        }

        Response::json([
            'message' => sprintf('%s row deleted successfully.', $metadata['label']),
        ]);
    }

    private function authorizedContext(): array
    {
        $user = $this->authUser();
        if ($this->normalizedRole($user) !== 'admin') {
            Response::json(['message' => 'Only admin users can open the database workspace.'], 403);
        }

        $pdo = Database::connection();
        $branch = $this->resolvedBranchFilter($pdo, $user);

        return [$pdo, $user, $branch];
    }

    private function databaseName(PDO $pdo): string
    {
        return (string) ($pdo->query('SELECT DATABASE()')->fetchColumn() ?: 'Unknown');
    }

    private function listTables(PDO $pdo, string $tableSearch = ''): array
    {
        $statement = $pdo->query(
            "SELECT TABLE_NAME, TABLE_ROWS
             FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_TYPE = 'BASE TABLE'"
        );
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $metadataList = [];

        foreach ($rows as $row) {
            $table = (string) ($row['TABLE_NAME'] ?? '');
            if ($table === '' || in_array($table, self::EXCLUDED_TABLES, true)) {
                continue;
            }

            if ($tableSearch !== '' && stripos($table, $tableSearch) === false && stripos($this->labelForTable($table), $tableSearch) === false) {
                continue;
            }

            $metadata = $this->tableMetadata($pdo, $table);
            if (!$metadata) {
                continue;
            }

            $metadataList[] = [
                'name' => $table,
                'label' => $metadata['label'],
                'rowCount' => (int) ($row['TABLE_ROWS'] ?? 0),
                'writable' => $metadata['writable'],
                'hasBranch' => $metadata['has_branch'],
                'hasBranchId' => $metadata['has_branch_id'],
                'primaryKey' => $metadata['primary_key'],
            ];
        }

        usort($metadataList, function (array $left, array $right): int {
            $leftRank = array_search($left['name'], self::PREFERRED_TABLES, true);
            $rightRank = array_search($right['name'], self::PREFERRED_TABLES, true);
            $leftScore = $leftRank === false ? PHP_INT_MAX : $leftRank;
            $rightScore = $rightRank === false ? PHP_INT_MAX : $rightRank;
            return $leftScore === $rightScore
                ? strcasecmp((string) $left['label'], (string) $right['label'])
                : ($leftScore <=> $rightScore);
        });

        return $metadataList;
    }

    private function resolveSelectedTable(string $selectedTable, array $tables): string
    {
        if ($selectedTable !== '') {
            foreach ($tables as $table) {
                if (($table['name'] ?? '') === $selectedTable) {
                    return $selectedTable;
                }
            }
        }

        return (string) ($tables[0]['name'] ?? '');
    }

    private function buildTablePayload(
        PDO $pdo,
        string $table,
        string $branch,
        string $search,
        string $patientSearch,
        string $dateColumn,
        string $dateFrom,
        string $dateTo,
        int $page,
        int $perPage
    ): array
    {
        $metadata = $this->validatedMetadata($pdo, $table);
        if (!$metadata) {
            Response::json(['message' => 'The selected table is not available in the database workspace.'], 404);
        }

        $whereSql = [];
        $params = [];
        $branchId = $branch !== '' ? $this->branchIdByName($pdo, $branch) : 0;

        if ($branch !== '') {
            if ($metadata['has_branch_id'] && $branchId > 0) {
                $whereSql[] = $this->quoted('branch_id') . ' = :branch_id';
                $params['branch_id'] = $branchId;
            } elseif ($metadata['has_branch']) {
                $whereSql[] = $this->quoted('branch') . ' = :branch';
                $params['branch'] = $branch;
            }
        }

        if ($search !== '' && $metadata['searchable_columns'] !== []) {
            $clauses = [];
            foreach (array_slice($metadata['searchable_columns'], 0, 8) as $index => $column) {
                $param = 'search_' . $index;
                $clauses[] = $this->quoted($column) . ' LIKE :' . $param;
                $params[$param] = '%' . $search . '%';
            }
            if ($clauses !== []) {
                $whereSql[] = '(' . implode(' OR ', $clauses) . ')';
            }
        }

        $patientSearchSql = $this->patientSearchClause($metadata, $patientSearch);
        if ($patientSearchSql !== null) {
            $whereSql[] = $patientSearchSql['sql'];
            foreach ($patientSearchSql['params'] as $key => $value) {
                $params[$key] = $value;
            }
        }

        $dateColumns = $metadata['date_filter_columns'];
        $activeDateColumn = '';
        if ($dateColumns !== []) {
            $activeDateColumn = in_array($dateColumn, $dateColumns, true) ? $dateColumn : $dateColumns[0];
            if ($dateFrom !== '') {
                $whereSql[] = 'DATE(' . $this->quoted($activeDateColumn) . ') >= :date_from';
                $params['date_from'] = $dateFrom;
            }
            if ($dateTo !== '') {
                $whereSql[] = 'DATE(' . $this->quoted($activeDateColumn) . ') <= :date_to';
                $params['date_to'] = $dateTo;
            }
        }

        $whereClause = $whereSql !== [] ? (' WHERE ' . implode(' AND ', $whereSql)) : '';
        $countSql = 'SELECT COUNT(*) FROM ' . $this->quoted($metadata['name']) . $whereClause;
        $countStatement = $pdo->prepare($countSql);
        $countStatement->execute($params);
        $total = (int) ($countStatement->fetchColumn() ?: 0);

        $offset = max(0, ($page - 1) * $perPage);
        $orderBy = $metadata['primary_key'] !== null
            ? ' ORDER BY ' . $this->quoted($metadata['primary_key']) . ' DESC'
            : '';
        $sql = 'SELECT * FROM ' . $this->quoted($metadata['name']) . $whereClause . $orderBy . ' LIMIT :limit OFFSET :offset';
        $statement = $pdo->prepare($sql);
        foreach ($params as $key => $value) {
            $statement->bindValue(':' . $key, $value);
        }
        $statement->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return [
            'name' => $metadata['name'],
            'label' => $metadata['label'],
            'schema' => $this->serializeSchema($metadata),
            'rows' => array_map(
                fn (array $row): array => $this->hydrateDisplayRow($pdo, $metadata, $row),
                $statement->fetchAll(PDO::FETCH_ASSOC) ?: []
            ),
            'active_filters' => [
                'search' => $search,
                'patient_search' => $patientSearch,
                'date_column' => $activeDateColumn,
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
            ],
            'pagination' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'total_pages' => max(1, (int) ceil($total / max($perPage, 1))),
            ],
        ];
    }

    private function findRecord(PDO $pdo, array $metadata, string $recordId, string $branch): ?array
    {
        if ($metadata['primary_key'] === null || $recordId === '') {
            return null;
        }

        $sql = 'SELECT * FROM ' . $this->quoted($metadata['name']) . ' WHERE ' . $this->quoted($metadata['primary_key']) . ' = :record_id';
        $params = ['record_id' => $recordId];
        if ($branch !== '') {
            if ($metadata['has_branch_id']) {
                $branchId = $this->branchIdByName($pdo, $branch);
                if ($branchId > 0) {
                    $sql .= ' AND ' . $this->quoted('branch_id') . ' = :branch_id';
                    $params['branch_id'] = $branchId;
                }
            } elseif ($metadata['has_branch']) {
                $sql .= ' AND ' . $this->quoted('branch') . ' = :branch';
                $params['branch'] = $branch;
            }
        }
        $sql .= ' LIMIT 1';
        $statement = $pdo->prepare($sql);
        $statement->execute($params);
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        return $row ? $this->hydrateDisplayRow($pdo, $metadata, $row) : null;
    }

    private function buildUpdatePayload(array $metadata, array $values): array
    {
        $payload = [];

        foreach ($metadata['columns'] as $column) {
            $name = $column['name'];
            if (!($column['editable'] ?? false) || !array_key_exists($name, $values)) {
                continue;
            }

            $value = $values[$name];
            if ($value === '' && ($column['nullable'] ?? false)) {
                $payload[$name] = null;
                continue;
            }

            $dataType = strtolower((string) ($column['data_type'] ?? ''));
            if (in_array($dataType, ['int', 'bigint', 'smallint', 'tinyint', 'mediumint'], true)) {
                $payload[$name] = ($value === '' || $value === null) ? null : (int) $value;
            } elseif (in_array($dataType, ['decimal', 'float', 'double'], true)) {
                $payload[$name] = ($value === '' || $value === null) ? null : (float) $value;
            } else {
                $payload[$name] = $value;
            }
        }

        return $payload;
    }

    private function validatedMetadata(PDO $pdo, string $table): ?array
    {
        if ($table === '' || in_array($table, self::EXCLUDED_TABLES, true)) {
            return null;
        }

        return $this->tableMetadata($pdo, $table);
    }

    private function tableMetadata(PDO $pdo, string $table): ?array
    {
        if (isset($this->metadataCache[$table])) {
            return $this->metadataCache[$table];
        }

        $statement = $pdo->prepare(
            "SELECT
                COLUMN_NAME,
                COLUMN_TYPE,
                DATA_TYPE,
                IS_NULLABLE,
                COLUMN_KEY,
                EXTRA
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = :table
             ORDER BY ORDINAL_POSITION"
        );
        $statement->execute(['table' => $table]);
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];
        if ($rows === []) {
            return null;
        }

        $columns = [];
        $primaryKey = null;
        $searchable = [];
        $hasBranch = false;
        $hasBranchId = false;
        $dateFilterColumns = [];

        foreach ($rows as $row) {
            $name = (string) ($row['COLUMN_NAME'] ?? '');
            $dataType = strtolower((string) ($row['DATA_TYPE'] ?? ''));
            $isPrimary = (string) ($row['COLUMN_KEY'] ?? '') === 'PRI';
            if ($isPrimary && $primaryKey === null) {
                $primaryKey = $name;
            }

            if ($name === 'branch') {
                $hasBranch = true;
            }

            if ($name === 'branch_id') {
                $hasBranchId = true;
            }

            if (in_array($dataType, ['char', 'varchar', 'text', 'tinytext', 'mediumtext', 'longtext', 'enum'], true)) {
                $searchable[] = $name;
            }

            if (in_array($dataType, ['date', 'datetime', 'timestamp'], true)) {
                $dateFilterColumns[] = $name;
            }

            $editable = !$isPrimary
                && !in_array($name, ['created_at', 'updated_at', 'last_login'], true)
                && !str_contains((string) ($row['EXTRA'] ?? ''), 'auto_increment');

            $columns[] = [
                'name' => $name,
                'label' => $this->labelForColumn($name),
                'type' => (string) ($row['COLUMN_TYPE'] ?? ''),
                'data_type' => $dataType,
                'nullable' => (string) ($row['IS_NULLABLE'] ?? '') === 'YES',
                'editable' => $editable,
            ];
        }

        $metadata = [
            'name' => $table,
            'label' => $this->labelForTable($table),
            'primary_key' => $primaryKey,
            'columns' => $columns,
            'searchable_columns' => $searchable,
            'date_filter_columns' => $this->rankDateFilterColumns($dateFilterColumns),
            'has_branch' => $hasBranch,
            'has_branch_id' => $hasBranchId,
            'writable' => $primaryKey !== null && !in_array($table, self::EXCLUDED_TABLES, true),
        ];

        $this->metadataCache[$table] = $metadata;

        return $metadata;
    }

    private function serializeSchema(array $metadata): array
    {
        return [
            'columns' => $metadata['columns'],
            'primary_key' => $metadata['primary_key'],
            'writable' => $metadata['writable'],
            'has_branch' => $metadata['has_branch'],
            'has_branch_id' => $metadata['has_branch_id'],
            'date_filter_columns' => $metadata['date_filter_columns'] ?? [],
        ];
    }

    private function rankDateFilterColumns(array $columns): array
    {
        usort($columns, function (string $left, string $right): int {
            $score = static function (string $name): int {
                $name = strtolower($name);
                return match (true) {
                    $name === 'payment_date' => 0,
                    $name === 'appointment_date' => 1,
                    $name === 'created_at' => 2,
                    $name === 'updated_at' => 3,
                    str_contains($name, 'date') => 4,
                    str_contains($name, 'created') => 5,
                    str_contains($name, 'updated') => 6,
                    default => 10,
                };
            };

            $leftScore = $score($left);
            $rightScore = $score($right);
            return $leftScore === $rightScore ? strcmp($left, $right) : ($leftScore <=> $rightScore);
        });

        return array_values(array_unique($columns));
    }

    private function patientSearchClause(array $metadata, string $patientSearch): ?array
    {
        $patientSearch = trim($patientSearch);
        if ($patientSearch === '') {
            return null;
        }

        $quotedTable = $this->quoted($metadata['name']);
        $searchTerm = '%' . $patientSearch . '%';

        if ($metadata['name'] === 'patients') {
            return [
                'sql' => "TRIM(CONCAT_WS(' ', `first_name`, `other_names`, `last_name`)) LIKE :patient_search_full
                    OR `first_name` LIKE :patient_search_first
                    OR `other_names` LIKE :patient_search_other
                    OR `last_name` LIKE :patient_search_last",
                'params' => [
                    'patient_search_full' => $searchTerm,
                    'patient_search_first' => $searchTerm,
                    'patient_search_other' => $searchTerm,
                    'patient_search_last' => $searchTerm,
                ],
            ];
        }

        $columnNames = array_map(static fn (array $column): string => (string) ($column['name'] ?? ''), $metadata['columns']);
        $clauses = [];
        $params = [];

        if (in_array('patient_name', $columnNames, true)) {
            $clauses[] = $this->quoted('patient_name') . ' LIKE :patient_search_name';
            $params['patient_search_name'] = $searchTerm;
        }

        if (in_array('patient_id', $columnNames, true)) {
            $clauses[] = 'EXISTS (
                SELECT 1
                FROM `patients` p
                WHERE p.`id` = ' . $quotedTable . '.`patient_id`
                  AND TRIM(CONCAT_WS(\' \', p.`first_name`, p.`other_names`, p.`last_name`)) LIKE :patient_search_linked
            )';
            $params['patient_search_linked'] = $searchTerm;
        }

        if (in_array('billing_id', $columnNames, true) && !in_array('patient_id', $columnNames, true)) {
            $clauses[] = 'EXISTS (
                SELECT 1
                FROM `billing_records` br
                LEFT JOIN `patients` p ON p.`id` = br.`patient_id`
                WHERE br.`id` = ' . $quotedTable . '.`billing_id`
                  AND (
                    br.`patient_name` LIKE :patient_search_billing
                    OR TRIM(CONCAT_WS(\' \', p.`first_name`, p.`other_names`, p.`last_name`)) LIKE :patient_search_billing_linked
                  )
            )';
            $params['patient_search_billing'] = $searchTerm;
            $params['patient_search_billing_linked'] = $searchTerm;
        }

        if ($clauses === []) {
            return null;
        }

        return [
            'sql' => '(' . implode(' OR ', $clauses) . ')',
            'params' => $params,
        ];
    }

    private function duplicateCandidateColumns(array $metadata): array
    {
        return array_values(array_filter(
            array_map(static function (array $column): ?array {
                $dataType = strtolower((string) ($column['data_type'] ?? ''));
                if (!in_array($dataType, ['char', 'varchar', 'text', 'tinytext', 'mediumtext', 'longtext'], true)) {
                    return null;
                }

                $name = (string) ($column['name'] ?? '');
                if ($name === '' || str_ends_with($name, '_id') || in_array($name, ['notes', 'description', 'medical_history', 'current_medications'], true)) {
                    return null;
                }

                return [
                    'name' => $name,
                    'label' => (string) ($column['label'] ?? $name),
                ];
            }, $metadata['columns']),
            static fn (?array $column): bool => $column !== null
        ));
    }

    private function duplicateGroups(PDO $pdo, array $metadata, string $branch, string $column): array
    {
        $sql = 'SELECT ' . $this->quoted($column) . ' AS duplicate_value, COUNT(*) AS duplicate_count FROM ' . $this->quoted($metadata['name']) . ' WHERE ' . $this->quoted($column) . " IS NOT NULL AND " . $this->quoted($column) . " <> ''";
        $params = [];
        if ($branch !== '') {
            if ($metadata['has_branch_id']) {
                $branchId = $this->branchIdByName($pdo, $branch);
                if ($branchId > 0) {
                    $sql .= ' AND ' . $this->quoted('branch_id') . ' = :branch_id';
                    $params['branch_id'] = $branchId;
                }
            } elseif ($metadata['has_branch']) {
                $sql .= ' AND ' . $this->quoted('branch') . ' = :branch';
                $params['branch'] = $branch;
            }
        }

        $sql .= ' GROUP BY ' . $this->quoted($column) . ' HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC, ' . $this->quoted($column) . ' ASC LIMIT 40';
        $statement = $pdo->prepare($sql);
        $statement->execute($params);

        return array_map(static fn (array $row): array => [
            'value' => (string) ($row['duplicate_value'] ?? ''),
            'count' => (int) ($row['duplicate_count'] ?? 0),
        ], $statement->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    private function hydrateDisplayRow(PDO $pdo, array $metadata, array $row): array
    {
        $table = (string) ($metadata['name'] ?? '');

        if (in_array($table, ['billing_records', 'payments', 'health_insurance', 'receipts'], true)) {
            $resolvedPatientName = $this->resolvePatientName($pdo, $table, $row);
            if ($resolvedPatientName !== '') {
                $row['patient_name'] = $resolvedPatientName;
            }
        }

        return $row;
    }

    private function resolvePatientName(PDO $pdo, string $table, array $row): string
    {
        $existingName = trim((string) ($row['patient_name'] ?? ''));
        if ($existingName !== '' && strcasecmp($existingName, 'Unknown patient') !== 0) {
            return $existingName;
        }

        $patientId = 0;
        if (isset($row['patient_id'])) {
            $patientId = (int) $row['patient_id'];
        }

        if ($patientId <= 0 && in_array($table, ['payments', 'health_insurance', 'receipts'], true)) {
            $billingId = (int) ($row['billing_id'] ?? 0);
            if ($billingId > 0) {
                $billingStatement = $pdo->prepare('SELECT patient_id, patient_name FROM billing_records WHERE id = :billing_id LIMIT 1');
                $billingStatement->execute(['billing_id' => $billingId]);
                $billing = $billingStatement->fetch(PDO::FETCH_ASSOC) ?: [];
                $billingName = trim((string) ($billing['patient_name'] ?? ''));
                if ($billingName !== '' && strcasecmp($billingName, 'Unknown patient') !== 0) {
                    return $billingName;
                }

                $patientId = (int) ($billing['patient_id'] ?? 0);
            }
        }

        if ($patientId > 0) {
            $patientStatement = $pdo->prepare(
                "SELECT
                    TRIM(CONCAT_WS(' ', first_name, other_names, last_name)) AS patient_name
                 FROM patients
                 WHERE id = :patient_id
                 LIMIT 1"
            );
            $patientStatement->execute(['patient_id' => $patientId]);
            $patientName = trim((string) ($patientStatement->fetchColumn() ?: ''));
            if ($patientName !== '') {
                return $patientName;
            }
        }

        return $existingName;
    }

    private function branchIdByName(PDO $pdo, string $branch): int
    {
        if ($branch === '') {
            return 0;
        }

        $statement = $pdo->prepare('SELECT id FROM branches WHERE name = :name LIMIT 1');
        $statement->execute(['name' => $branch]);

        return (int) ($statement->fetchColumn() ?: 0);
    }

    private function labelForTable(string $table): string
    {
        return ucwords(str_replace('_', ' ', $table));
    }

    private function labelForColumn(string $column): string
    {
        return ucwords(str_replace('_', ' ', $column));
    }

    private function quoted(string $identifier): string
    {
        return '`' . str_replace('`', '``', $identifier) . '`';
    }
}
