<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Auth;
use App\Support\Database;
use App\Support\Request;
use App\Support\Response;
use PDO;
use Throwable;

final class ClinicalRecordsController extends Controller
{
    public function medicalRecords(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $pdo = Database::connection();

        $this->ensureTables($pdo);

        $patientId = isset($_GET['patient_id']) ? (int) $_GET['patient_id'] : 0;
        if ($patientId <= 0) {
            Response::json(['message' => 'Patient ID is required.'], 422);
        }

        Response::json([
            'items' => $this->medicalRecordItems($pdo, $patientId, $role, $staffId),
        ]);
    }

    public function storeMedicalRecord(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $pdo = Database::connection();
        $payload = Request::json();

        $this->ensureTables($pdo);

        if ($role !== 'dentist' || $staffId <= 0) {
            Response::json(['message' => 'Only dentists can save medical records.'], 403);
        }

        $patientId = isset($payload['patient_id']) ? (int) $payload['patient_id'] : 0;
        $visitDate = trim((string) ($payload['visit_date'] ?? ''));
        $presentingComplaint = trim((string) ($payload['presenting_complaint'] ?? ''));
        $historyPresentingComplaint = trim((string) ($payload['history_presenting_complaint'] ?? ''));
        $examinationFindings = trim((string) ($payload['examination_findings'] ?? ''));
        $investigations = trim((string) ($payload['investigations'] ?? ''));
        $diagnosis = trim((string) ($payload['diagnosis'] ?? ''));
        $treatmentDone = trim((string) ($payload['treatment_done'] ?? ''));
        $treatmentPlan = trim((string) ($payload['treatment_plan'] ?? ''));
        $nextAppointment = trim((string) ($payload['next_appointment'] ?? ''));
        $notes = trim((string) ($payload['notes'] ?? ''));

        if (
            $patientId <= 0
            || $visitDate === ''
            || $presentingComplaint === ''
            || $historyPresentingComplaint === ''
            || $examinationFindings === ''
            || $diagnosis === ''
            || $treatmentDone === ''
            || $treatmentPlan === ''
        ) {
            Response::json(['message' => 'Patient, visit date, complaint, findings, diagnosis, treatment done, and treatment plan are required.'], 422);
        }

        $patient = $this->patientById($pdo, $patientId);
        if (!$patient) {
            Response::json(['message' => 'The selected patient could not be found.'], 404);
        }

        $dentistName = Auth::staffDisplayName($user, 'dentist');

        $statement = $pdo->prepare(
            'INSERT INTO medical_records (
                patient_id,
                dentist_id,
                dentist_name,
                visit_date,
                treatment_done,
                next_appointment,
                notes,
                created_at,
                presenting_complaint,
                history_presenting_complaint,
                examination_findings,
                investigations,
                diagnosis,
                treatment_plan,
                patient_name
            ) VALUES (
                :patient_id,
                :dentist_id,
                :dentist_name,
                :visit_date,
                :treatment_done,
                :next_appointment,
                :notes,
                :created_at,
                :presenting_complaint,
                :history_presenting_complaint,
                :examination_findings,
                :investigations,
                :diagnosis,
                :treatment_plan,
                :patient_name
            )'
        );
        $statement->execute([
            'patient_id' => $patientId,
            'dentist_id' => $staffId,
            'dentist_name' => $dentistName,
            'visit_date' => $visitDate,
            'treatment_done' => $treatmentDone,
            'next_appointment' => $nextAppointment !== '' ? $nextAppointment : null,
            'notes' => $notes !== '' ? $notes : null,
            'created_at' => date('Y-m-d H:i:s'),
            'presenting_complaint' => $presentingComplaint,
            'history_presenting_complaint' => $historyPresentingComplaint,
            'examination_findings' => $examinationFindings,
            'investigations' => $investigations !== '' ? $investigations : null,
            'diagnosis' => $diagnosis,
            'treatment_plan' => $treatmentPlan,
            'patient_name' => $this->patientDisplayName($patient),
        ]);

        Response::json([
            'message' => 'Medical record saved successfully.',
            'items' => $this->medicalRecordItems($pdo, $patientId, $role, $staffId),
        ]);
    }

    public function updateMedicalRecord(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $pdo = Database::connection();
        $payload = Request::json();

        $this->ensureTables($pdo);

        if ($role !== 'dentist' || $staffId <= 0) {
            Response::json(['message' => 'Only dentists can edit medical records.'], 403);
        }

        $recordId = isset($payload['id']) ? (int) $payload['id'] : 0;
        $patientId = isset($payload['patient_id']) ? (int) $payload['patient_id'] : 0;
        $visitDate = trim((string) ($payload['visit_date'] ?? ''));
        $presentingComplaint = trim((string) ($payload['presenting_complaint'] ?? ''));
        $historyPresentingComplaint = trim((string) ($payload['history_presenting_complaint'] ?? ''));
        $examinationFindings = trim((string) ($payload['examination_findings'] ?? ''));
        $investigations = trim((string) ($payload['investigations'] ?? ''));
        $diagnosis = trim((string) ($payload['diagnosis'] ?? ''));
        $treatmentDone = trim((string) ($payload['treatment_done'] ?? ''));
        $treatmentPlan = trim((string) ($payload['treatment_plan'] ?? ''));
        $nextAppointment = trim((string) ($payload['next_appointment'] ?? ''));
        $notes = trim((string) ($payload['notes'] ?? ''));

        if (
            $recordId <= 0
            || $patientId <= 0
            || $visitDate === ''
            || $presentingComplaint === ''
            || $historyPresentingComplaint === ''
            || $examinationFindings === ''
            || $diagnosis === ''
            || $treatmentDone === ''
            || $treatmentPlan === ''
        ) {
            Response::json(['message' => 'Record, patient, visit date, complaint, findings, diagnosis, treatment done, and treatment plan are required.'], 422);
        }

        $existing = $this->medicalRecordById($pdo, $recordId);
        if (!$existing || (int) ($existing['patient_id'] ?? 0) !== $patientId) {
            Response::json(['message' => 'The selected medical record could not be found.'], 404);
        }

        $editorName = Auth::staffDisplayName($user, 'dentist');

        $statement = $pdo->prepare(
            'UPDATE medical_records
             SET visit_date = :visit_date,
                 treatment_done = :treatment_done,
                 next_appointment = :next_appointment,
                 notes = :notes,
                 presenting_complaint = :presenting_complaint,
                 history_presenting_complaint = :history_presenting_complaint,
                 examination_findings = :examination_findings,
                 investigations = :investigations,
                 diagnosis = :diagnosis,
                 treatment_plan = :treatment_plan,
                 edited_by_name = :edited_by_name,
                 edited_at = :edited_at
             WHERE id = :id
             LIMIT 1'
        );
        $statement->execute([
            'id' => $recordId,
            'visit_date' => $visitDate,
            'treatment_done' => $treatmentDone,
            'next_appointment' => $nextAppointment !== '' ? $nextAppointment : null,
            'notes' => $notes !== '' ? $notes : null,
            'presenting_complaint' => $presentingComplaint,
            'history_presenting_complaint' => $historyPresentingComplaint,
            'examination_findings' => $examinationFindings,
            'investigations' => $investigations !== '' ? $investigations : null,
            'diagnosis' => $diagnosis,
            'treatment_plan' => $treatmentPlan,
            'edited_by_name' => $editorName,
            'edited_at' => date('Y-m-d H:i:s'),
        ]);

        Response::json([
            'message' => 'Medical record updated successfully.',
            'items' => $this->medicalRecordItems($pdo, $patientId, $role, $staffId),
        ]);
    }

    public function prescriptions(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $pdo = Database::connection();

        $this->ensureTables($pdo);

        $patientId = isset($_GET['patient_id']) ? (int) $_GET['patient_id'] : 0;
        if ($patientId <= 0) {
            Response::json(['message' => 'Patient ID is required.'], 422);
        }

        Response::json([
            'items' => $this->prescriptionItems($pdo, $patientId, $role, $staffId),
            'suggestions' => $this->clinicalSuggestionsPayload($pdo),
        ]);
    }

    public function storePrescription(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $pdo = Database::connection();
        $payload = Request::json();

        $this->ensureTables($pdo);

        if ($role !== 'dentist' || $staffId <= 0) {
            Response::json(['message' => 'Only dentists can save prescriptions.'], 403);
        }

        $patientId = isset($payload['patient_id']) ? (int) $payload['patient_id'] : 0;
        $datePrescribed = trim((string) ($payload['date_prescribed'] ?? ''));
        $entries = is_array($payload['entries'] ?? null) ? $payload['entries'] : [];

        if ($patientId <= 0 || $datePrescribed === '') {
            Response::json(['message' => 'Patient and prescription date are required.'], 422);
        }

        if ($entries === []) {
            $entries = [[
                'medication' => $payload['medication'] ?? '',
                'dosage' => $payload['dosage'] ?? '',
                'frequency' => $payload['frequency'] ?? '',
                'duration' => $payload['duration'] ?? '',
                'instructions' => $payload['instructions'] ?? '',
            ]];
        }

        $patient = $this->patientById($pdo, $patientId);
        if (!$patient) {
            Response::json(['message' => 'The selected patient could not be found.'], 404);
        }

        $dentistName = Auth::staffDisplayName($user, 'dentist');

        $statement = $pdo->prepare(
            'INSERT INTO prescriptions (
                patient_id,
                dentist_id,
                date_prescribed,
                medication,
                dosage,
                frequency,
                duration,
                instructions,
                dentist_name,
                created_at,
                patient_name
            ) VALUES (
                :patient_id,
                :dentist_id,
                :date_prescribed,
                :medication,
                :dosage,
                :frequency,
                :duration,
                :instructions,
                :dentist_name,
                :created_at,
                :patient_name
            )'
        );

        $savedAny = false;
        foreach ($entries as $entry) {
            $medication = trim((string) ($entry['medication'] ?? ''));
            $dosage = trim((string) ($entry['dosage'] ?? ''));
            $frequency = trim((string) ($entry['frequency'] ?? ''));
            $duration = trim((string) ($entry['duration'] ?? ''));
            $instructions = trim((string) ($entry['instructions'] ?? ''));

            if ($medication === '' && $dosage === '' && $frequency === '' && $duration === '' && $instructions === '') {
                continue;
            }

            if ($medication === '' || $dosage === '' || $frequency === '' || $duration === '') {
                Response::json(['message' => 'Each prescription line must include medication, dosage, frequency, and duration.'], 422);
            }

            $statement->execute([
                'patient_id' => $patientId,
                'dentist_id' => $staffId,
                'date_prescribed' => $datePrescribed,
                'medication' => $medication,
                'dosage' => $dosage,
                'frequency' => $frequency,
                'duration' => $duration,
                'instructions' => $instructions !== '' ? $instructions : null,
                'dentist_name' => $dentistName,
                'created_at' => date('Y-m-d H:i:s'),
                'patient_name' => $this->patientDisplayName($patient),
            ]);
            $this->learnPrescriptionSuggestions($pdo, [
                'medication' => $medication,
                'dosage' => $dosage,
                'frequency' => $frequency,
                'duration' => $duration,
            ]);
            $savedAny = true;
        }

        if (!$savedAny) {
            Response::json(['message' => 'Add at least one complete prescription line before saving.'], 422);
        }

        Response::json([
            'message' => 'Prescription saved successfully.',
            'items' => $this->prescriptionItems($pdo, $patientId, $role, $staffId),
            'suggestions' => $this->clinicalSuggestionsPayload($pdo),
        ]);
    }

    public function updatePrescription(): void
    {
        $user = $this->authUser();
        $role = $this->normalizedRole($user);
        $staffId = isset($user['staff_id']) ? (int) $user['staff_id'] : 0;
        $pdo = Database::connection();
        $payload = Request::json();

        $this->ensureTables($pdo);

        if ($role !== 'dentist' || $staffId <= 0) {
            Response::json(['message' => 'Only dentists can edit prescriptions.'], 403);
        }

        $prescriptionId = isset($payload['id']) ? (int) $payload['id'] : 0;
        $patientId = isset($payload['patient_id']) ? (int) $payload['patient_id'] : 0;
        $datePrescribed = trim((string) ($payload['date_prescribed'] ?? ''));
        $medication = trim((string) ($payload['medication'] ?? ''));
        $dosage = trim((string) ($payload['dosage'] ?? ''));
        $frequency = trim((string) ($payload['frequency'] ?? ''));
        $duration = trim((string) ($payload['duration'] ?? ''));
        $instructions = trim((string) ($payload['instructions'] ?? ''));

        if ($prescriptionId <= 0 || $patientId <= 0 || $datePrescribed === '' || $medication === '' || $dosage === '' || $frequency === '' || $duration === '') {
            Response::json(['message' => 'Prescription, patient, date, medication, dosage, frequency, and duration are required.'], 422);
        }

        $existing = $this->prescriptionById($pdo, $prescriptionId);
        if (!$existing || (int) ($existing['patient_id'] ?? 0) !== $patientId) {
            Response::json(['message' => 'The selected prescription could not be found.'], 404);
        }

        $editorName = Auth::staffDisplayName($user, 'dentist');

        $statement = $pdo->prepare(
            'UPDATE prescriptions
             SET date_prescribed = :date_prescribed,
                 medication = :medication,
                 dosage = :dosage,
                 frequency = :frequency,
                 duration = :duration,
                 instructions = :instructions,
                 edited_by_name = :edited_by_name,
                 edited_at = :edited_at
             WHERE id = :id
             LIMIT 1'
        );
        $statement->execute([
            'id' => $prescriptionId,
            'date_prescribed' => $datePrescribed,
            'medication' => $medication,
            'dosage' => $dosage,
            'frequency' => $frequency,
            'duration' => $duration,
            'instructions' => $instructions !== '' ? $instructions : null,
            'edited_by_name' => $editorName,
            'edited_at' => date('Y-m-d H:i:s'),
        ]);

        $this->learnPrescriptionSuggestions($pdo, [
            'medication' => $medication,
            'dosage' => $dosage,
            'frequency' => $frequency,
            'duration' => $duration,
        ]);

        Response::json([
            'message' => 'Prescription updated successfully.',
            'items' => $this->prescriptionItems($pdo, $patientId, $role, $staffId),
            'suggestions' => $this->clinicalSuggestionsPayload($pdo),
        ]);
    }

    private function medicalRecordItems(PDO $pdo, int $patientId, string $role, int $staffId): array
    {
        $sql = "
            SELECT
                id,
                patient_id,
                dentist_id,
                dentist_name,
                visit_date,
                treatment_done,
                next_appointment,
                notes,
                created_at,
                presenting_complaint,
                history_presenting_complaint,
                examination_findings,
                investigations,
                diagnosis,
                treatment_plan,
                patient_name,
                edited_by_name,
                edited_at
            FROM medical_records
            WHERE patient_id = :patient_id";

        $params = ['patient_id' => $patientId];

        $sql .= ' ORDER BY visit_date DESC, id DESC';

        $statement = $pdo->prepare($sql);
        $statement->execute($params);

        return array_map(static fn (array $row): array => [
            'id' => (int) $row['id'],
            'patientId' => (int) $row['patient_id'],
            'dentistName' => (string) ($row['dentist_name'] ?? ''),
            'visitDate' => (string) ($row['visit_date'] ?? ''),
            'visitDateLabel' => !empty($row['visit_date']) ? date('d M Y', strtotime((string) $row['visit_date'])) : '',
            'presentingComplaint' => (string) ($row['presenting_complaint'] ?? ''),
            'historyPresentingComplaint' => (string) ($row['history_presenting_complaint'] ?? ''),
            'examinationFindings' => (string) ($row['examination_findings'] ?? ''),
            'investigations' => (string) ($row['investigations'] ?? ''),
            'diagnosis' => (string) ($row['diagnosis'] ?? ''),
            'treatmentDone' => (string) ($row['treatment_done'] ?? ''),
            'treatmentPlan' => (string) ($row['treatment_plan'] ?? ''),
            'nextAppointment' => (string) ($row['next_appointment'] ?? ''),
            'notes' => (string) ($row['notes'] ?? ''),
            'editedByName' => (string) ($row['edited_by_name'] ?? ''),
            'editedAt' => (string) ($row['edited_at'] ?? ''),
            'editedAtLabel' => !empty($row['edited_at']) ? date('d M Y h:i A', strtotime((string) $row['edited_at'])) : '',
        ], $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    private function prescriptionItems(PDO $pdo, int $patientId, string $role, int $staffId): array
    {
        $sql = "
            SELECT
                id,
                patient_id,
                dentist_id,
                date_prescribed,
                medication,
                dosage,
                frequency,
                duration,
                instructions,
                dentist_name,
                created_at,
                patient_name,
                edited_by_name,
                edited_at
            FROM prescriptions
            WHERE patient_id = :patient_id";

        $params = ['patient_id' => $patientId];

        $sql .= ' ORDER BY date_prescribed DESC, id DESC';

        $statement = $pdo->prepare($sql);
        $statement->execute($params);

        return array_map(static fn (array $row): array => [
            'id' => (int) $row['id'],
            'patientId' => (int) $row['patient_id'],
            'dentistName' => (string) ($row['dentist_name'] ?? ''),
            'datePrescribed' => (string) ($row['date_prescribed'] ?? ''),
            'datePrescribedLabel' => !empty($row['date_prescribed']) ? date('d M Y', strtotime((string) $row['date_prescribed'])) : '',
            'medication' => (string) ($row['medication'] ?? ''),
            'dosage' => (string) ($row['dosage'] ?? ''),
            'frequency' => (string) ($row['frequency'] ?? ''),
            'duration' => (string) ($row['duration'] ?? ''),
            'instructions' => (string) ($row['instructions'] ?? ''),
            'editedByName' => (string) ($row['edited_by_name'] ?? ''),
            'editedAt' => (string) ($row['edited_at'] ?? ''),
            'editedAtLabel' => !empty($row['edited_at']) ? date('d M Y h:i A', strtotime((string) $row['edited_at'])) : '',
        ], $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    private function medicalRecordById(PDO $pdo, int $recordId): ?array
    {
        $statement = $pdo->prepare('SELECT id, patient_id FROM medical_records WHERE id = :id LIMIT 1');
        $statement->execute(['id' => $recordId]);
        $record = $statement->fetch(PDO::FETCH_ASSOC);

        return $record ?: null;
    }

    private function prescriptionById(PDO $pdo, int $prescriptionId): ?array
    {
        $statement = $pdo->prepare('SELECT id, patient_id FROM prescriptions WHERE id = :id LIMIT 1');
        $statement->execute(['id' => $prescriptionId]);
        $record = $statement->fetch(PDO::FETCH_ASSOC);

        return $record ?: null;
    }

    private function patientById(PDO $pdo, int $patientId): ?array
    {
        $statement = $pdo->prepare(
            'SELECT id, first_name, last_name, other_names
             FROM patients
             WHERE id = :id
             LIMIT 1'
        );
        $statement->execute(['id' => $patientId]);

        $patient = $statement->fetch(PDO::FETCH_ASSOC);

        return $patient ?: null;
    }

    private function patientDisplayName(array $patient): string
    {
        return trim(implode(' ', array_filter([
            $patient['first_name'] ?? '',
            $patient['other_names'] ?? '',
            $patient['last_name'] ?? '',
        ])));
    }

    private function ensureTables(PDO $pdo): void
    {
        $pdo->exec(
            "CREATE TABLE IF NOT EXISTS medical_records (
                id INT AUTO_INCREMENT PRIMARY KEY,
                patient_id INT NOT NULL,
                dentist_id INT NOT NULL,
                dentist_name VARCHAR(100) NOT NULL,
                visit_date DATE NOT NULL,
                treatment_done TEXT NOT NULL,
                next_appointment DATETIME NULL,
                notes TEXT NULL,
                created_at DATETIME NOT NULL,
                presenting_complaint TEXT NOT NULL,
                history_presenting_complaint TEXT NOT NULL,
                examination_findings TEXT NOT NULL,
                investigations TEXT NULL,
                diagnosis TEXT NOT NULL,
                treatment_plan TEXT NOT NULL,
                patient_name VARCHAR(255) NULL,
                edited_by_name VARCHAR(100) NULL,
                edited_at DATETIME NULL,
                INDEX idx_medical_records_patient (patient_id),
                INDEX idx_medical_records_dentist (dentist_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );

        $pdo->exec(
            "CREATE TABLE IF NOT EXISTS prescriptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                patient_id INT NOT NULL,
                dentist_id INT NOT NULL,
                date_prescribed DATE NOT NULL,
                medication VARCHAR(255) NOT NULL,
                dosage VARCHAR(100) NOT NULL,
                frequency VARCHAR(100) NOT NULL,
                duration VARCHAR(100) NOT NULL,
                instructions TEXT NULL,
                dentist_name VARCHAR(100) NOT NULL,
                created_at DATETIME NOT NULL,
                patient_name VARCHAR(255) NULL,
                edited_by_name VARCHAR(100) NULL,
                edited_at DATETIME NULL,
                INDEX idx_prescriptions_patient (patient_id),
                INDEX idx_prescriptions_dentist (dentist_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );

        $pdo->exec(
            "CREATE TABLE IF NOT EXISTS clinical_suggestions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                suggestion_type VARCHAR(120) NOT NULL,
                value TEXT NOT NULL,
                normalized_value VARCHAR(255) NOT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                UNIQUE KEY uniq_clinical_suggestion (suggestion_type, normalized_value)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );

        $this->ensureColumn($pdo, 'medical_records', 'edited_by_name', 'ALTER TABLE medical_records ADD COLUMN edited_by_name VARCHAR(100) NULL AFTER patient_name');
        $this->ensureColumn($pdo, 'medical_records', 'edited_at', 'ALTER TABLE medical_records ADD COLUMN edited_at DATETIME NULL AFTER edited_by_name');
        $this->ensureColumn($pdo, 'prescriptions', 'edited_by_name', 'ALTER TABLE prescriptions ADD COLUMN edited_by_name VARCHAR(100) NULL AFTER patient_name');
        $this->ensureColumn($pdo, 'prescriptions', 'edited_at', 'ALTER TABLE prescriptions ADD COLUMN edited_at DATETIME NULL AFTER edited_by_name');
    }

    private function clinicalSuggestionsPayload(PDO $pdo): array
    {
        return [
            'prescription' => [
                'medication' => $this->suggestionsForType($pdo, 'prescription.medication'),
                'dosage' => $this->suggestionsForType($pdo, 'prescription.dosage'),
                'frequency' => $this->suggestionsForType($pdo, 'prescription.frequency'),
                'duration' => $this->suggestionsForType($pdo, 'prescription.duration'),
            ],
        ];
    }

    private function learnPrescriptionSuggestions(PDO $pdo, array $values): void
    {
        foreach ($values as $field => $value) {
            $this->saveSuggestion($pdo, 'prescription.' . $field, (string) $value);
        }
    }

    private function saveSuggestion(PDO $pdo, string $type, string $value): void
    {
        $trimmedValue = trim($value);
        if ($trimmedValue === '') {
            return;
        }

        $normalizedValue = function_exists('mb_strtolower')
            ? mb_strtolower($trimmedValue, 'UTF-8')
            : strtolower($trimmedValue);
        $timestamp = date('Y-m-d H:i:s');

        $statement = $pdo->prepare(
            'INSERT INTO clinical_suggestions (suggestion_type, value, normalized_value, created_at, updated_at)
             VALUES (:suggestion_type, :value, :normalized_value, :created_at, :updated_at)
             ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)'
        );
        $statement->execute([
            'suggestion_type' => $type,
            'value' => $trimmedValue,
            'normalized_value' => $normalizedValue,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ]);
    }

    private function suggestionsForType(PDO $pdo, string $type): array
    {
        $values = [];
        $statement = $pdo->prepare(
            'SELECT value
             FROM clinical_suggestions
             WHERE suggestion_type = :suggestion_type
             ORDER BY updated_at DESC, id DESC
             LIMIT 12'
        );
        $statement->execute(['suggestion_type' => $type]);
        $values = array_map(
            static fn (array $row): string => trim((string) ($row['value'] ?? '')),
            $statement->fetchAll(PDO::FETCH_ASSOC)
        );

        foreach ($this->fallbackSuggestionsForType($pdo, $type) as $fallbackValue) {
            $values[] = $fallbackValue;
        }

        return $this->uniqueSuggestionValues($values);
    }

    private function fallbackSuggestionsForType(PDO $pdo, string $type): array
    {
        $map = [
            'prescription.medication' => ['table' => 'prescriptions', 'column' => 'medication'],
            'prescription.dosage' => ['table' => 'prescriptions', 'column' => 'dosage'],
            'prescription.frequency' => ['table' => 'prescriptions', 'column' => 'frequency'],
            'prescription.duration' => ['table' => 'prescriptions', 'column' => 'duration'],
        ];

        if (!isset($map[$type])) {
            return [];
        }

        $table = $map[$type]['table'];
        $column = $map[$type]['column'];
        $statement = $pdo->query(
            "SELECT DISTINCT {$column} AS value
             FROM {$table}
             WHERE {$column} IS NOT NULL AND TRIM({$column}) <> ''
             ORDER BY id DESC
             LIMIT 12"
        );

        return array_map(
            static fn (array $row): string => trim((string) ($row['value'] ?? '')),
            $statement ? $statement->fetchAll(PDO::FETCH_ASSOC) : []
        );
    }

    private function uniqueSuggestionValues(array $values): array
    {
        $seen = [];
        $result = [];

        foreach ($values as $value) {
            $trimmedValue = trim((string) $value);
            if ($trimmedValue === '') {
                continue;
            }

            $normalizedValue = function_exists('mb_strtolower')
                ? mb_strtolower($trimmedValue, 'UTF-8')
                : strtolower($trimmedValue);
            if (isset($seen[$normalizedValue])) {
                continue;
            }

            $seen[$normalizedValue] = true;
            $result[] = $trimmedValue;

            if (count($result) >= 12) {
                break;
            }
        }

        return $result;
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
