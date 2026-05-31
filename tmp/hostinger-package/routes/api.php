<?php

declare(strict_types=1);

use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\AssignmentController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BillingController;
use App\Http\Controllers\ClinicalRecordsController;
use App\Http\Controllers\CustomerServiceController;
use App\Http\Controllers\DatabaseAdminController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ExpensesController;
use App\Http\Controllers\InsuranceController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\PatientController;
use App\Http\Controllers\ProcedureChargeController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\StaffController;
use App\Http\Controllers\StoreController;

return [
    'GET' => [
        '/api/v1/auth/session' => [AuthController::class, 'session'],
        '/api/v1/dashboard' => [DashboardController::class, 'index'],
        '/api/v1/appointments' => [AppointmentController::class, 'index'],
        '/api/v1/patients' => [PatientController::class, 'index'],
        '/api/v1/medical-records' => [ClinicalRecordsController::class, 'medicalRecords'],
        '/api/v1/prescriptions' => [ClinicalRecordsController::class, 'prescriptions'],
        '/api/v1/billing' => [BillingController::class, 'index'],
        '/api/v1/billing/receipt' => [BillingController::class, 'receipt'],
        '/api/v1/customer-service' => [CustomerServiceController::class, 'index'],
        '/api/v1/expenses' => [ExpensesController::class, 'index'],
        '/api/v1/insurance' => [InsuranceController::class, 'index'],
        '/api/v1/procedure-charges' => [ProcedureChargeController::class, 'index'],
        '/api/v1/patient-assignments' => [AssignmentController::class, 'index'],
        '/api/v1/messages' => [MessageController::class, 'index'],
        '/api/v1/staff' => [StaffController::class, 'index'],
        '/api/v1/settings' => [SettingsController::class, 'index'],
        '/api/v1/store' => [StoreController::class, 'index'],
        '/api/v1/database-admin/meta' => [DatabaseAdminController::class, 'meta'],
        '/api/v1/database-admin/table' => [DatabaseAdminController::class, 'table'],
        '/api/v1/database-admin/row' => [DatabaseAdminController::class, 'row'],
        '/api/v1/database-admin/duplicates' => [DatabaseAdminController::class, 'duplicates'],
    ],
    'POST' => [
        '/api/v1/auth/login' => [AuthController::class, 'login'],
        '/api/v1/auth/logout' => [AuthController::class, 'logout'],
        '/api/v1/appointments' => [AppointmentController::class, 'store'],
        '/api/v1/billing/payments' => [BillingController::class, 'storePayment'],
        '/api/v1/billing/frontdesk-bill' => [BillingController::class, 'storeFrontdeskBill'],
        '/api/v1/billing/delete' => [BillingController::class, 'delete'],
        '/api/v1/customer-service/templates' => [CustomerServiceController::class, 'storeTemplate'],
        '/api/v1/customer-service/templates/update' => [CustomerServiceController::class, 'updateTemplate'],
        '/api/v1/customer-service/templates/delete' => [CustomerServiceController::class, 'deleteTemplate'],
        '/api/v1/customer-service/send-sms' => [CustomerServiceController::class, 'sendSms'],
        '/api/v1/customer-service/follow-ups/update' => [CustomerServiceController::class, 'updateFollowUp'],
        '/api/v1/expenses' => [ExpensesController::class, 'store'],
        '/api/v1/expenses/update' => [ExpensesController::class, 'update'],
        '/api/v1/expenses/delete' => [ExpensesController::class, 'delete'],
        '/api/v1/insurance/update' => [InsuranceController::class, 'update'],
        '/api/v1/insurance/delete' => [InsuranceController::class, 'delete'],
        '/api/v1/medical-records' => [ClinicalRecordsController::class, 'storeMedicalRecord'],
        '/api/v1/medical-records/update' => [ClinicalRecordsController::class, 'updateMedicalRecord'],
        '/api/v1/patient-assignments' => [AssignmentController::class, 'store'],
        '/api/v1/patient-assignments/complete' => [AssignmentController::class, 'complete'],
        '/api/v1/patients' => [PatientController::class, 'store'],
        '/api/v1/patients/update' => [PatientController::class, 'update'],
        '/api/v1/patients/delete' => [PatientController::class, 'delete'],
        '/api/v1/prescriptions' => [ClinicalRecordsController::class, 'storePrescription'],
        '/api/v1/prescriptions/update' => [ClinicalRecordsController::class, 'updatePrescription'],
        '/api/v1/procedure-charges' => [ProcedureChargeController::class, 'store'],
        '/api/v1/procedure-charges/catalog' => [ProcedureChargeController::class, 'storeProcedure'],
        '/api/v1/procedure-charges/catalog/update' => [ProcedureChargeController::class, 'updateProcedure'],
        '/api/v1/procedure-charges/catalog/delete' => [ProcedureChargeController::class, 'deleteProcedure'],
        '/api/v1/settings' => [SettingsController::class, 'store'],
        '/api/v1/settings/branches' => [SettingsController::class, 'storeBranch'],
        '/api/v1/staff' => [StaffController::class, 'store'],
        '/api/v1/staff/update' => [StaffController::class, 'update'],
        '/api/v1/staff/delete' => [StaffController::class, 'delete'],
        '/api/v1/staff/reset-password' => [StaffController::class, 'resetPassword'],
        '/api/v1/store/items' => [StoreController::class, 'storeItem'],
        '/api/v1/store/items/update' => [StoreController::class, 'updateItem'],
        '/api/v1/store/items/delete' => [StoreController::class, 'deleteItem'],
        '/api/v1/store/sales' => [StoreController::class, 'processSale'],
        '/api/v1/database-admin/update' => [DatabaseAdminController::class, 'update'],
        '/api/v1/database-admin/delete' => [DatabaseAdminController::class, 'delete'],
    ],
];
