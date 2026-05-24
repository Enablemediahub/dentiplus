<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Database;
use App\Support\Request;
use App\Support\Response;
use PDO;
use Throwable;

final class PatientController extends Controller
{
    public function index(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $pdo = Database::connection();
        $branch = $this->resolvedBranchFilter($pdo, $user);

        $items = $this->patients($pdo, $role, $branch);
        $walkins = array_values(array_filter(
            $items,
            static fn (array $item): bool => ($item['isWalkin'] ?? false) === true
        ));
        $receptionWalkins = array_values(array_filter(
            $walkins,
            static fn (array $item): bool => $staffId <= 0 || (int) ($item['receptionistId'] ?? 0) === $staffId
        ));

        Response::json([
            'items' => $items,
            'walkinItems' => $receptionWalkins,
        ]);
    }

    public function store(): void
    {
        $user = $this->authUser();
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $payload = Request::json();
        $pdo = Database::connection();

        $firstName = trim((string) ($payload['first_name'] ?? ''));
        $lastName = trim((string) ($payload['last_name'] ?? ''));
        $otherNames = trim((string) ($payload['other_names'] ?? ''));
        $phone = trim((string) ($payload['phone'] ?? ''));
        $email = trim((string) ($payload['email'] ?? ''));
        $gender = strtolower(trim((string) ($payload['gender'] ?? '')));
        $birthDate = trim((string) ($payload['birth_date'] ?? ''));
        $address = trim((string) ($payload['address'] ?? ''));

        if ($firstName === '' || $lastName === '' || $phone === '' || $gender === '' || $birthDate === '' || $address === '') {
            Response::json(['message' => 'First name, last name, phone, gender, birth date, and address are required.'], 422);
        }

        if (!in_array($gender, ['male', 'female', 'other'], true)) {
            Response::json(['message' => 'Gender must be male, female, or other.'], 422);
        }

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $birthDate)) {
            Response::json(['message' => 'Birth date must use the YYYY-MM-DD format.'], 422);
        }

        $folderId = $this->generateFolderId($pdo, $firstName, $otherNames, $lastName);

        $statement = $pdo->prepare(
            'INSERT INTO patients (
                first_name,
                last_name,
                other_names,
                phone,
                email,
                birth_date,
                gender,
                address,
                marital_status,
                occupation,
                employer,
                emergency_contact_name,
                emergency_contact_phone,
                referral_source,
                visit_reason,
                assignment_visit_reason,
                medical_history,
                current_medications,
                allergies,
                dental_history,
                last_dental_visit,
                alcohol_use,
                smoking,
                pregnancy_status,
                social_media_consent,
                folder_id,
                old_folder_id,
                is_walkin,
                receptionist_id,
                status
             ) VALUES (
                :first_name,
                :last_name,
                :other_names,
                :phone,
                :email,
                :birth_date,
                :gender,
                :address,
                :marital_status,
                :occupation,
                :employer,
                :emergency_contact_name,
                :emergency_contact_phone,
                :referral_source,
                :visit_reason,
                :assignment_visit_reason,
                :medical_history,
                :current_medications,
                :allergies,
                :dental_history,
                :last_dental_visit,
                :alcohol_use,
                :smoking,
                :pregnancy_status,
                :social_media_consent,
                :folder_id,
                :old_folder_id,
                :is_walkin,
                :receptionist_id,
                :status
             )'
        );
        $statement->execute([
            'first_name' => $firstName,
            'last_name' => $lastName,
            'other_names' => $otherNames !== '' ? $otherNames : null,
            'phone' => $phone,
            'email' => $email,
            'birth_date' => $birthDate,
            'gender' => $gender,
            'address' => $address,
            'marital_status' => $this->nullableString($payload['marital_status'] ?? null),
            'occupation' => $this->nullableString($payload['occupation'] ?? null),
            'employer' => $this->nullableString($payload['employer'] ?? null),
            'emergency_contact_name' => $this->nullableString($payload['emergency_contact_name'] ?? null),
            'emergency_contact_phone' => $this->nullableString($payload['emergency_contact_phone'] ?? null),
            'referral_source' => $this->nullableString($payload['referral_source'] ?? null),
            'visit_reason' => $this->nullableString($payload['visit_reason'] ?? null),
            'assignment_visit_reason' => $this->nullableString($payload['assignment_visit_reason'] ?? null),
            'medical_history' => $this->medicalHistoryString($payload['medical_history'] ?? null),
            'current_medications' => $this->nullableString($payload['current_medications'] ?? null),
            'allergies' => $this->nullableString($payload['allergies'] ?? null),
            'dental_history' => $this->nullableString($payload['dental_history'] ?? null),
            'last_dental_visit' => $this->nullableDate($payload['last_dental_visit'] ?? null),
            'alcohol_use' => $this->nullableString($payload['alcohol_use'] ?? null),
            'smoking' => $this->nullableString($payload['smoking'] ?? null),
            'pregnancy_status' => $this->nullableString($payload['pregnancy_status'] ?? null),
            'social_media_consent' => $this->nullableString($payload['social_media_consent'] ?? null),
            'folder_id' => $folderId,
            'old_folder_id' => $this->nullableString($payload['old_folder_id'] ?? null),
            'is_walkin' => 1,
            'receptionist_id' => $staffId > 0 ? $staffId : null,
            'status' => 'waiting',
        ]);

        Response::json([
            'message' => 'Walk-in patient registered successfully.',
            'item' => $this->patientById($pdo, (int) $pdo->lastInsertId()),
        ]);
    }

    public function update(): void
    {
        $payload = Request::json();
        $pdo = Database::connection();

        $patientId = isset($payload['id']) ? (int) $payload['id'] : 0;
        $firstName = trim((string) ($payload['first_name'] ?? ''));
        $lastName = trim((string) ($payload['last_name'] ?? ''));
        $otherNames = trim((string) ($payload['other_names'] ?? ''));
        $phone = trim((string) ($payload['phone'] ?? ''));
        $email = trim((string) ($payload['email'] ?? ''));
        $gender = strtolower(trim((string) ($payload['gender'] ?? '')));
        $birthDate = trim((string) ($payload['birth_date'] ?? ''));
        $address = trim((string) ($payload['address'] ?? ''));

        if ($patientId <= 0 || $firstName === '' || $lastName === '' || $phone === '' || $gender === '' || $birthDate === '' || $address === '') {
            Response::json(['message' => 'Patient, first name, last name, phone, gender, birth date, and address are required.'], 422);
        }

        if (!in_array($gender, ['male', 'female', 'other'], true)) {
            Response::json(['message' => 'Gender must be male, female, or other.'], 422);
        }

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $birthDate)) {
            Response::json(['message' => 'Birth date must use the YYYY-MM-DD format.'], 422);
        }

        $existing = $this->patientByIdOrNull($pdo, $patientId);
        if (!$existing) {
            Response::json(['message' => 'The selected patient could not be found.'], 404);
        }

        $statement = $pdo->prepare(
            'UPDATE patients
             SET first_name = :first_name,
                 last_name = :last_name,
                 other_names = :other_names,
                 phone = :phone,
                 email = :email,
                 birth_date = :birth_date,
                 gender = :gender,
                 address = :address,
                 marital_status = :marital_status,
                 occupation = :occupation,
                 employer = :employer,
                 emergency_contact_name = :emergency_contact_name,
                 emergency_contact_phone = :emergency_contact_phone,
                 referral_source = :referral_source,
                 visit_reason = :visit_reason,
                 assignment_visit_reason = :assignment_visit_reason,
                 medical_history = :medical_history,
                 current_medications = :current_medications,
                 allergies = :allergies,
                 dental_history = :dental_history,
                 last_dental_visit = :last_dental_visit,
                 alcohol_use = :alcohol_use,
                 smoking = :smoking,
                 pregnancy_status = :pregnancy_status,
                 social_media_consent = :social_media_consent,
                 old_folder_id = :old_folder_id,
                 status = :status
             WHERE id = :id
             LIMIT 1'
        );
        $statement->execute([
            'id' => $patientId,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'other_names' => $otherNames !== '' ? $otherNames : null,
            'phone' => $phone,
            'email' => $email !== '' ? $email : null,
            'birth_date' => $birthDate,
            'gender' => $gender,
            'address' => $address,
            'marital_status' => $this->nullableString($payload['marital_status'] ?? null),
            'occupation' => $this->nullableString($payload['occupation'] ?? null),
            'employer' => $this->nullableString($payload['employer'] ?? null),
            'emergency_contact_name' => $this->nullableString($payload['emergency_contact_name'] ?? null),
            'emergency_contact_phone' => $this->nullableString($payload['emergency_contact_phone'] ?? null),
            'referral_source' => $this->nullableString($payload['referral_source'] ?? null),
            'visit_reason' => $this->nullableString($payload['visit_reason'] ?? null),
            'assignment_visit_reason' => $this->nullableString($payload['assignment_visit_reason'] ?? null),
            'medical_history' => $this->medicalHistoryString($payload['medical_history'] ?? null),
            'current_medications' => $this->nullableString($payload['current_medications'] ?? null),
            'allergies' => $this->nullableString($payload['allergies'] ?? null),
            'dental_history' => $this->nullableString($payload['dental_history'] ?? null),
            'last_dental_visit' => $this->nullableDate($payload['last_dental_visit'] ?? null),
            'alcohol_use' => $this->nullableString($payload['alcohol_use'] ?? null),
            'smoking' => $this->nullableString($payload['smoking'] ?? null),
            'pregnancy_status' => $this->nullableString($payload['pregnancy_status'] ?? null),
            'social_media_consent' => $this->nullableString($payload['social_media_consent'] ?? null),
            'old_folder_id' => $this->nullableString($payload['old_folder_id'] ?? null),
            'status' => $this->nullableString($payload['status'] ?? null) ?? strtolower((string) ($existing['status'] ?? 'waiting')),
        ]);

        Response::json([
            'message' => 'Patient record updated successfully.',
            'item' => $this->patientById($pdo, $patientId),
        ]);
    }

    public function delete(): void
    {
        $payload = Request::json();
        $pdo = Database::connection();

        $patientId = isset($payload['id']) ? (int) $payload['id'] : 0;
        if ($patientId <= 0) {
            Response::json(['message' => 'Patient ID is required.'], 422);
        }

        $existing = $this->patientByIdOrNull($pdo, $patientId);
        if (!$existing) {
            Response::json(['message' => 'The selected patient could not be found.'], 404);
        }

        try {
            $statement = $pdo->prepare('DELETE FROM patients WHERE id = :id LIMIT 1');
            $statement->execute(['id' => $patientId]);
        } catch (Throwable $exception) {
            Response::json(['message' => 'This patient record could not be deleted. Remove linked activity first or confirm it is only a duplicate entry.'], 409);
        }

        Response::json(['message' => 'Patient record deleted successfully.']);
    }

    private function patients(PDO $pdo, string $role, string $branch): array
    {
        $sql = "SELECT
                p.id,
                p.first_name,
                p.last_name,
                p.other_names,
                p.phone,
                p.email,
                p.birth_date,
                p.gender,
                p.address,
                p.marital_status,
                p.occupation,
                p.employer,
                p.emergency_contact_name,
                p.emergency_contact_phone,
                p.referral_source,
                p.visit_reason,
                p.assignment_visit_reason,
                p.medical_history,
                p.current_medications,
                p.allergies,
                p.dental_history,
                p.last_dental_visit,
                p.alcohol_use,
                p.smoking,
                p.pregnancy_status,
                p.social_media_consent,
                p.folder_id,
                p.old_folder_id,
                p.is_walkin,
                p.receptionist_id,
                p.status,
                p.created_at,
                COALESCE(NULLIF(p.branch, ''), sb.branch, '') AS access_branch
             FROM patients p
             LEFT JOIN staff_branches sb ON sb.staff_id = p.receptionist_id
             WHERE 1=1";
        $params = [];

        if ($role === 'admin' && $branch !== '') {
            $sql .= " AND COALESCE(NULLIF(p.branch, ''), sb.branch, '') = :branch";
            $params['branch'] = $branch;
        }

        $sql .= ' ORDER BY p.created_at DESC';

        $statement = $pdo->prepare($sql);
        $statement->execute($params);

        return array_map(fn (array $row): array => $this->formatPatientRow($row), $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    private function patientById(PDO $pdo, int $id): array
    {
        $statement = $pdo->prepare(
            "SELECT
                id,
                first_name,
                last_name,
                other_names,
                phone,
                email,
                birth_date,
                gender,
                address,
                marital_status,
                occupation,
                employer,
                emergency_contact_name,
                emergency_contact_phone,
                referral_source,
                visit_reason,
                assignment_visit_reason,
                medical_history,
                current_medications,
                allergies,
                dental_history,
                last_dental_visit,
                alcohol_use,
                smoking,
                pregnancy_status,
                social_media_consent,
                folder_id,
                old_folder_id,
                is_walkin,
                receptionist_id,
                status,
                created_at
             FROM patients
             WHERE id = :id
             LIMIT 1"
        );
        $statement->execute(['id' => $id]);

        return $this->formatPatientRow($statement->fetch(PDO::FETCH_ASSOC) ?: []);
    }

    private function patientByIdOrNull(PDO $pdo, int $id): ?array
    {
        $statement = $pdo->prepare(
            'SELECT id, status
             FROM patients
             WHERE id = :id
             LIMIT 1'
        );
        $statement->execute(['id' => $id]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    private function formatPatientRow(array $row): array
    {
        $displayName = trim(implode(' ', array_filter([
            $row['first_name'] ?? '',
            $row['other_names'] ?? '',
            $row['last_name'] ?? '',
        ])));

        $status = trim((string) ($row['status'] ?? ''));

        return [
            'id' => (int) ($row['id'] ?? 0),
            'folder' => (string) ($row['folder_id'] ?? ('DP-' . ($row['id'] ?? ''))),
            'folderId' => (string) ($row['folder_id'] ?? ('DP-' . ($row['id'] ?? ''))),
            'oldFolderId' => (string) ($row['old_folder_id'] ?? ''),
            'patient' => $displayName,
            'patientName' => $displayName,
            'firstName' => (string) ($row['first_name'] ?? ''),
            'lastName' => (string) ($row['last_name'] ?? ''),
            'otherNames' => (string) ($row['other_names'] ?? ''),
            'phone' => (string) ($row['phone'] ?? ''),
            'email' => (string) ($row['email'] ?? ''),
            'birthDate' => (string) ($row['birth_date'] ?? ''),
            'gender' => (string) ($row['gender'] ?? ''),
            'address' => (string) ($row['address'] ?? ''),
            'maritalStatus' => (string) ($row['marital_status'] ?? ''),
            'occupation' => (string) ($row['occupation'] ?? ''),
            'employer' => (string) ($row['employer'] ?? ''),
            'emergencyContactName' => (string) ($row['emergency_contact_name'] ?? ''),
            'emergencyContactPhone' => (string) ($row['emergency_contact_phone'] ?? ''),
            'referralSource' => (string) ($row['referral_source'] ?? ''),
            'visitReason' => (string) ($row['assignment_visit_reason'] ?: ($row['visit_reason'] ?? 'General care')),
            'rawVisitReason' => (string) ($row['visit_reason'] ?? ''),
            'assignmentVisitReason' => (string) ($row['assignment_visit_reason'] ?? ''),
            'medicalHistory' => $this->medicalHistoryArray($row['medical_history'] ?? null),
            'currentMedications' => (string) ($row['current_medications'] ?? ''),
            'allergies' => (string) ($row['allergies'] ?? ''),
            'dentalHistory' => (string) ($row['dental_history'] ?? ''),
            'lastDentalVisit' => (string) ($row['last_dental_visit'] ?? ''),
            'alcoholUse' => (string) ($row['alcohol_use'] ?? ''),
            'smoking' => (string) ($row['smoking'] ?? ''),
            'pregnancyStatus' => (string) ($row['pregnancy_status'] ?? ''),
            'socialMediaConsent' => (string) ($row['social_media_consent'] ?? ''),
            'isWalkin' => (bool) ($row['is_walkin'] ?? false),
            'receptionistId' => isset($row['receptionist_id']) ? (int) $row['receptionist_id'] : null,
            'status' => $status === '' ? 'Registered' : ucfirst($status),
            'createdAt' => (string) ($row['created_at'] ?? ''),
        ];
    }

    private function nullableString(mixed $value): ?string
    {
        $text = trim((string) ($value ?? ''));

        return $text !== '' ? $text : null;
    }

    private function nullableDate(mixed $value): ?string
    {
        $text = trim((string) ($value ?? ''));
        if ($text === '') {
            return null;
        }

        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $text) ? $text : null;
    }

    private function medicalHistoryString(mixed $value): ?string
    {
        if (is_array($value)) {
            $filtered = array_values(array_filter(array_map(static fn ($item) => trim((string) $item), $value)));

            return $filtered ? implode(',', $filtered) : null;
        }

        $text = trim((string) ($value ?? ''));

        return $text !== '' ? $text : null;
    }

    private function medicalHistoryArray(mixed $value): array
    {
        $text = trim((string) ($value ?? ''));
        if ($text === '') {
            return [];
        }

        return array_values(array_filter(array_map('trim', explode(',', $text))));
    }

    private function generateFolderId(PDO $pdo, string $firstName, string $otherNames, string $lastName): string
    {
        $initials = strtoupper(
            substr($firstName, 0, 1)
            . ($otherNames !== '' ? substr($otherNames, 0, 1) : '')
            . substr($lastName, 0, 1)
        );
        $year = date('Y');

        $statement = $pdo->prepare('SELECT COUNT(*) FROM patients WHERE YEAR(created_at) = :year');
        $statement->execute(['year' => $year]);
        $count = (int) $statement->fetchColumn() + 1;

        return sprintf('EDC-%s-%s/%04d', $initials, $year, $count);
    }
}
