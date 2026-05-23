import React, { useEffect, useMemo, useState } from 'react';
import { api, TOKEN_KEY } from './lib/api';
import {
  createFallbackWorkspace,
  HERO_COPY,
  NAVIGATION,
  normalizeRole,
  ROLE_LABELS,
} from './lib/portal';
import { SessionRestore } from './components/SessionRestore';
import { LoginScreen } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { HeaderHero } from './components/HeaderHero';
import { StatGrid } from './components/StatGrid';
import { DataTable } from './components/DataTable';
import { FormPanel } from './components/FormPanel';
import { FooterBar } from './components/FooterBar';
import { ReceptionistDashboard } from './components/ReceptionistDashboard';
import { SettingsPanel } from './components/SettingsPanel';
import { ReceptionAppointmentsPage } from './components/ReceptionAppointmentsPage';
import { ReceptionWalkinPage } from './components/ReceptionWalkinPage';
import { ReceptionAssignPatientPage } from './components/ReceptionAssignPatientPage';
import { ReceptionPaymentsPage } from './components/ReceptionPaymentsPage';
import { ReceptionPatientDatabasePage } from './components/ReceptionPatientDatabasePage';
import { ReceptionCustomerServicePage } from './components/ReceptionCustomerServicePage';
import { ReceptionInsurancePage } from './components/ReceptionInsurancePage';
import { ReceptionExpensesPage } from './components/ReceptionExpensesPage';
import { ReceptionStorePage } from './components/ReceptionStorePage';
import { PastReceiptsPage } from './components/PastReceiptsPage';
import { ProcedureChargePage } from './components/ProcedureChargePage';
import { DentistDashboard } from './components/DentistDashboard';
import { DentistPatientsPage } from './components/DentistPatientsPage';
import { AdminAppointmentsPage } from './components/AdminAppointmentsPage';
import { AdminStaffPage } from './components/AdminStaffPage';
import { AdminDatabasePage } from './components/AdminDatabasePage';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminStoreMonitorPage } from './components/AdminStoreMonitorPage';

const THEME_KEY = 'edental-theme';

function getInitialViewFromHash() {
  const hashValue = String(window.location.hash || '').replace(/^#\/?/, '').trim();
  if (hashValue === 'procedures') {
    return 'procedure-charge';
  }
  if (hashValue === 'prescriptions') {
    return 'prescription-history';
  }

  return hashValue || 'dashboard';
}

function useDentiplusPortal() {
  const [bootState, setBootState] = useState('restoring');
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? '');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [portalData, setPortalData] = useState(null);
  const [assignmentsData, setAssignmentsData] = useState(null);
  const [procedureChargesData, setProcedureChargesData] = useState(null);
  const [publicBranding, setPublicBranding] = useState(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentView, setCurrentView] = useState(() => getInitialViewFromHash());

  async function loadPortalBundle(activeToken, existingSession = null) {
    const session = existingSession ?? await api.session(activeToken);
    const role = normalizeRole(
      session?.user?.staff_role ?? session?.user?.role,
    );

    if (role === 'admin') {
      const [dashboard, settings, appointments, patients, billing, messages, expenses, insurance, store, staff, assignments] = await Promise.all([
        api.dashboard(activeToken),
        api.settings(activeToken),
        api.appointments(activeToken),
        api.patients(activeToken),
        api.billing(activeToken),
        api.messages(activeToken),
        api.expenses(activeToken),
        api.insurance(activeToken),
        api.store(activeToken),
        api.staff(activeToken),
        api.assignments(activeToken),
      ]);

      return {
        role,
        session,
        portalData: {
          session,
          settings,
          dashboard,
          appointments,
          patients,
          billing,
          messages,
          customerService: null,
          expenses,
          insurance,
          store,
          staff,
        },
        assignments,
        procedureCharges: null,
      };
    }

    if (role === 'receptionist') {
      const [dashboard, appointments, patients, billing, messages, customerService, expenses, insurance, store, assignments] = await Promise.all([
        api.dashboard(activeToken),
        api.appointments(activeToken),
        api.patients(activeToken),
        api.billing(activeToken),
        api.messages(activeToken),
        api.customerService(activeToken),
        api.expenses(activeToken),
        api.insurance(activeToken),
        api.store(activeToken),
        api.assignments(activeToken),
      ]);

      return {
        role,
        session,
        portalData: {
          session,
          settings: null,
          dashboard,
          appointments,
          patients,
          billing,
          messages,
          customerService,
          expenses,
          insurance,
          store,
          staff: null,
        },
        assignments,
        procedureCharges: null,
      };
    }

    if (role === 'dentist') {
      const [dashboard, appointments, patients, billing, messages, assignments, procedureCharges] = await Promise.all([
        api.dashboard(activeToken),
        api.appointments(activeToken),
        api.patients(activeToken),
        api.billing(activeToken),
        api.messages(activeToken),
        api.assignments(activeToken),
        api.procedureCharges(activeToken),
      ]);

      return {
        role,
        session,
        portalData: {
          session,
          settings: null,
          dashboard,
          appointments,
          patients,
          billing,
          messages,
          customerService: null,
          expenses: null,
          insurance: null,
          store: null,
          staff: null,
        },
        assignments,
        procedureCharges,
      };
    }

    const [dashboard, billing, messages, expenses, insurance] = await Promise.all([
      api.dashboard(activeToken),
      api.billing(activeToken),
      api.messages(activeToken),
      api.expenses(activeToken),
      api.insurance(activeToken),
    ]);

    return {
      role,
      session,
      portalData: {
        session,
        settings: null,
        dashboard,
        appointments: null,
        patients: null,
        billing,
        messages,
        customerService: null,
        expenses,
        insurance,
        store: null,
        staff: null,
      },
      assignments: null,
      procedureCharges: null,
    };
  }

  useEffect(() => {
    function handleHashChange() {
      const nextView = getInitialViewFromHash();
      setCurrentView((current) => (current === nextView ? current : nextView));
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const nextHash = `#/${currentView}`;
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, [currentView]);

  useEffect(() => {
    let active = true;

    async function restore() {
      try {
        const settings = await api.settings();
        if (active) {
          setPublicBranding(settings?.branding ?? null);
        }
      } catch (error) {
        if (active) {
          setPublicBranding(null);
        }
      }

      if (!token) {
        if (active) {
          setBootState('guest');
        }
        return;
      }

      try {
        const session = await api.session(token);
        const bundle = await loadPortalBundle(token, session);

        if (!active) {
          return;
        }

        setPortalData(bundle.portalData);
        setAssignmentsData(bundle.assignments);
        setProcedureChargesData(bundle.procedureCharges);
        setCurrentView(getInitialViewFromHash());
        setBootState('ready');
      } catch (error) {
        localStorage.removeItem(TOKEN_KEY);
        if (active) {
          setPortalData(null);
          setAssignmentsData(null);
          setProcedureChargesData(null);
          setToken('');
          setBootState('guest');
        }
      }
    }

    restore();

    return () => {
      active = false;
    };
  }, [token]);

  async function refreshReceptionWorkspace(activeToken = token) {
    if (!activeToken) {
      return;
    }

    const [dashboard, appointments, patients, assignments, billing, customerService, expenses, insurance, store] = await Promise.all([
      api.dashboard(activeToken),
      api.appointments(activeToken),
      api.patients(activeToken),
      api.assignments(activeToken),
      api.billing(activeToken),
      api.customerService(activeToken),
      api.expenses(activeToken),
      api.insurance(activeToken),
      api.store(activeToken),
    ]);

    setAssignmentsData(assignments);

    setPortalData((current) => (
      current
        ? {
            ...current,
            dashboard,
            appointments,
            patients,
            billing,
            customerService,
            expenses,
            insurance,
            store,
          }
        : current
    ));
  }

  async function refreshDentistWorkspace(activeToken = token) {
    if (!activeToken) {
      return;
    }

    const [dashboard, appointments, patients, assignments, billing, messages, procedureCharges] = await Promise.all([
      api.dashboard(activeToken),
      api.appointments(activeToken),
      api.patients(activeToken),
      api.assignments(activeToken),
      api.billing(activeToken),
      api.messages(activeToken),
      api.procedureCharges(activeToken),
    ]);

    setAssignmentsData(assignments);
    setProcedureChargesData(procedureCharges);

    setPortalData((current) => (
      current
        ? {
            ...current,
            dashboard,
            appointments,
            patients,
            billing,
            messages,
          }
        : current
    ));
  }

  async function refreshAdminWorkspace(activeToken = token) {
    if (!activeToken) {
      return;
    }

    const bundle = await loadPortalBundle(activeToken);

    setAssignmentsData(bundle.assignments);
    setProcedureChargesData(bundle.procedureCharges);
    setPortalData((current) => (current ? { ...current, ...bundle.portalData } : current));
  }

  async function handleLogin(credentials) {
    setLoginLoading(true);
    setLoginError('');

    try {
      const response = await api.login(credentials);
      localStorage.setItem(TOKEN_KEY, response.token);
      setToken(response.token);
      setBootState('restoring');
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    try {
      if (token) {
        await api.logout(token);
      }
    } catch (error) {
      // We still clear local state even if the server session is already gone.
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      setPortalData(null);
      setAssignmentsData(null);
      setProcedureChargesData(null);
      setToken('');
      setBootState('guest');
      setMobileOpen(false);
    }
  }

  async function handleSaveSettings(values) {
    if (!token) {
      throw new Error('Sign in again before updating settings.');
    }

    const payload = new FormData();
    payload.append('clinic_name', values.clinicName);
    payload.append('address', values.address);
    payload.append('phone', values.phone);
    payload.append('email', values.email);

    if (values.loginWallpaper instanceof File) {
      payload.append('login_wallpaper', values.loginWallpaper);
    }

    if (values.heroImage instanceof File) {
      payload.append('hero_image', values.heroImage);
    }

    if (values.sidebarLogo instanceof File) {
      payload.append('sidebar_logo', values.sidebarLogo);
    }

    setSettingsSaving(true);

    try {
      const response = await api.updateSettings(token, payload);
      setPublicBranding(response?.branding ?? null);
      setPortalData((current) => (
        current
          ? {
              ...current,
              settings: { ...(current.settings ?? {}), branding: response?.branding ?? null },
            }
          : current
      ));
    } finally {
      setSettingsSaving(false);
    }
  }

  async function handleCreateAppointment(values) {
    if (!token) {
      throw new Error('Sign in again before booking an appointment.');
    }

    const response = await api.createAppointment(token, values);
    await refreshReceptionWorkspace(token);

    return response;
  }

  async function handleRegisterPatient(values) {
    if (!token) {
      throw new Error('Sign in again before registering a patient.');
    }

    const response = await api.createPatient(token, values);
    await refreshReceptionWorkspace(token);

    return response;
  }

  async function handleAssignPatient(values) {
    if (!token) {
      throw new Error('Sign in again before assigning a patient.');
    }

    const response = await api.createAssignment(token, values);
    await refreshReceptionWorkspace(token);

    return response;
  }

  async function handleCompleteAssignment(values) {
    if (!token) {
      throw new Error('Sign in again before updating an assignment.');
    }

    const response = await api.completeAssignment(token, values);
    await refreshReceptionWorkspace(token);

    return response;
  }

  async function handleCreateProcedureCharge(values) {
    if (!token) {
      throw new Error('Sign in again before saving procedure charges.');
    }

    const response = await api.createProcedureCharge(token, values);
    await refreshDentistWorkspace(token);

    return response;
  }

  async function handleCreateBillingPayment(values) {
    if (!token) {
      throw new Error('Sign in again before saving a payment.');
    }

    const response = await api.createBillingPayment(token, values);
    await refreshReceptionWorkspace(token);

    return response;
  }

  async function handleCreateFrontdeskBill(values) {
    if (!token) {
      throw new Error('Sign in again before creating a frontdesk bill.');
    }

    const response = await api.createFrontdeskBill(token, values);
    await refreshReceptionWorkspace(token);

    return response;
  }

  async function handleDeleteBilling(values) {
    if (!token) {
      throw new Error('Sign in again before deleting a billing entry.');
    }

    const response = await api.deleteBilling(token, values);
    await refreshReceptionWorkspace(token);

    return response;
  }

  async function handleLoadReceipt(receiptNumber) {
    if (!token) {
      throw new Error('Sign in again before loading a receipt.');
    }

    return api.receipt(token, receiptNumber);
  }

  async function handleLoadMedicalRecords(patientId) {
    if (!token) {
      throw new Error('Sign in again before loading medical records.');
    }

    return api.medicalRecords(token, patientId);
  }

  async function handleLoadPrescriptions(patientId) {
    if (!token) {
      throw new Error('Sign in again before loading prescription history.');
    }

    return api.prescriptions(token, patientId);
  }

  async function handleCreateMedicalRecord(values) {
    if (!token) {
      throw new Error('Sign in again before saving a medical record.');
    }

    const response = await api.createMedicalRecord(token, values);
    await refreshDentistWorkspace(token);

    return response;
  }

  async function handleUpdateMedicalRecord(values) {
    if (!token) {
      throw new Error('Sign in again before updating a medical record.');
    }

    const response = await api.updateMedicalRecord(token, values);
    await refreshDentistWorkspace(token);

    return response;
  }

  async function handleCreatePrescription(values) {
    if (!token) {
      throw new Error('Sign in again before saving a prescription.');
    }

    const response = await api.createPrescription(token, values);
    await refreshDentistWorkspace(token);

    return response;
  }

  async function handleUpdatePrescription(values) {
    if (!token) {
      throw new Error('Sign in again before updating a prescription.');
    }

    const response = await api.updatePrescription(token, values);
    await refreshDentistWorkspace(token);

    return response;
  }

  async function handleUpdatePatient(values) {
    if (!token) {
      throw new Error('Sign in again before updating a patient record.');
    }

    const response = await api.updatePatient(token, values);
    await refreshReceptionWorkspace(token);

    return response;
  }

  async function handleDeletePatient(values) {
    if (!token) {
      throw new Error('Sign in again before deleting a patient record.');
    }

    const response = await api.deletePatient(token, values);
    await refreshReceptionWorkspace(token);

    return response;
  }

  async function handleCreateCustomerTemplate(values) {
    if (!token) {
      throw new Error('Sign in again before saving a template.');
    }

    const response = await api.createCustomerTemplate(token, values);
    await refreshReceptionWorkspace(token);

    return response;
  }

  async function handleUpdateCustomerTemplate(values) {
    if (!token) {
      throw new Error('Sign in again before updating a template.');
    }

    const response = await api.updateCustomerTemplate(token, values);
    await refreshReceptionWorkspace(token);

    return response;
  }

  async function handleDeleteCustomerTemplate(values) {
    if (!token) {
      throw new Error('Sign in again before deleting a template.');
    }

    const response = await api.deleteCustomerTemplate(token, values);
    await refreshReceptionWorkspace(token);

    return response;
  }

  async function handleSendCustomerSms(values) {
    if (!token) {
      throw new Error('Sign in again before sending SMS.');
    }

    const response = await api.sendCustomerSms(token, values);
    await refreshReceptionWorkspace(token);

    return response;
  }

  async function handleUpdateFollowUp(values) {
    if (!token) {
      throw new Error('Sign in again before updating follow-up.');
    }

    const response = await api.updateFollowUp(token, values);
    await refreshReceptionWorkspace(token);

    return response;
  }

  async function handleUpdateInsurance(values) {
    if (!token) {
      throw new Error('Sign in again before updating insurance.');
    }

    const response = await api.updateInsurance(token, values);
    await refreshReceptionWorkspace(token);

    return response;
  }

  async function handleDeleteInsurance(values) {
    if (!token) {
      throw new Error('Sign in again before deleting insurance.');
    }

    const response = await api.deleteInsurance(token, values);
    await refreshReceptionWorkspace(token);

    return response;
  }

  async function handleCreateExpense(values) {
    if (!token) {
      throw new Error('Sign in again before recording an expense.');
    }

    const response = await api.createExpense(token, values);
    await refreshReceptionWorkspace(token);

    return response;
  }

  async function handleUpdateExpense(values) {
    if (!token) {
      throw new Error('Sign in again before updating an expense.');
    }

    const response = await api.updateExpense(token, values);
    await refreshReceptionWorkspace(token);

    return response;
  }

  async function handleDeleteExpense(values) {
    if (!token) {
      throw new Error('Sign in again before deleting an expense.');
    }

    const response = await api.deleteExpense(token, values);
    await refreshReceptionWorkspace(token);

    return response;
  }

  async function refreshStoreWorkspace(activeToken = token) {
    const currentRole = normalizeRole(
      portalData?.session?.user?.staff_role ?? portalData?.session?.user?.role,
    );

    if (currentRole === 'admin') {
      await refreshAdminWorkspace(activeToken);
      return;
    }

    if (currentRole === 'receptionist') {
      await refreshReceptionWorkspace(activeToken);
      return;
    }

    await refreshReceptionWorkspace(activeToken);
  }

  async function handleCreateStoreItem(values) {
    if (!token) {
      throw new Error('Sign in again before adding a store item.');
    }

    const response = await api.createStoreItem(token, values);
    await refreshStoreWorkspace(token);

    return response;
  }

  async function handleUpdateStoreItem(values) {
    if (!token) {
      throw new Error('Sign in again before updating a store item.');
    }

    const response = await api.updateStoreItem(token, values);
    await refreshStoreWorkspace(token);

    return response;
  }

  async function handleDeleteStoreItem(values) {
    if (!token) {
      throw new Error('Sign in again before deleting a store item.');
    }

    const response = await api.deleteStoreItem(token, values);
    await refreshStoreWorkspace(token);

    return response;
  }

  async function handleProcessStoreSale(values) {
    if (!token) {
      throw new Error('Sign in again before processing a store sale.');
    }

    const response = await api.processStoreSale(token, values);
    await refreshStoreWorkspace(token);

    return response;
  }

  async function handleCreateStaff(values) {
    if (!token) {
      throw new Error('Sign in again before creating a staff account.');
    }

    const response = await api.createStaff(token, values);
    await refreshAdminWorkspace(token);

    return response;
  }

  async function handleUpdateStaff(values) {
    if (!token) {
      throw new Error('Sign in again before updating a staff account.');
    }

    const response = await api.updateStaff(token, values);
    await refreshAdminWorkspace(token);

    return response;
  }

  async function handleDeleteStaff(values) {
    if (!token) {
      throw new Error('Sign in again before deleting a staff account.');
    }

    const response = await api.deleteStaff(token, values);
    await refreshAdminWorkspace(token);

    return response;
  }

  async function handleResetStaffPassword(values) {
    if (!token) {
      throw new Error('Sign in again before resetting a staff password.');
    }

    const response = await api.resetStaffPassword(token, values);
    await refreshAdminWorkspace(token);

    return response;
  }

  return {
    bootState,
    loginError,
    loginLoading,
    portalData,
    assignmentsData,
    procedureChargesData,
    publicBranding,
    settingsSaving,
    mobileOpen,
    currentView,
    setCurrentView,
    setMobileOpen,
    handleLogin,
    handleLogout,
    handleCreateAppointment,
    handleRegisterPatient,
    handleAssignPatient,
    handleCompleteAssignment,
    handleCreateProcedureCharge,
    handleCreateBillingPayment,
    handleCreateFrontdeskBill,
    handleDeleteBilling,
    handleLoadMedicalRecords,
    handleLoadPrescriptions,
    handleLoadReceipt,
    handleCreateMedicalRecord,
    handleUpdateMedicalRecord,
    handleCreatePrescription,
    handleUpdatePrescription,
    handleUpdatePatient,
    handleDeletePatient,
    handleCreateCustomerTemplate,
    handleUpdateCustomerTemplate,
    handleDeleteCustomerTemplate,
    handleSendCustomerSms,
    handleUpdateFollowUp,
    handleUpdateInsurance,
    handleDeleteInsurance,
    handleCreateExpense,
    handleUpdateExpense,
    handleDeleteExpense,
    handleCreateStaff,
    handleUpdateStaff,
    handleDeleteStaff,
    handleResetStaffPassword,
    handleCreateStoreItem,
    handleUpdateStoreItem,
    handleDeleteStoreItem,
    handleProcessStoreSale,
    handleSaveSettings,
  };
}

function AppWorkspace({
  portalData,
  currentView,
  setCurrentView,
  mobileOpen,
  setMobileOpen,
  onLogout,
  onCreateAppointment,
  onRegisterPatient,
  onAssignPatient,
  onCompleteAssignment,
  onCreateProcedureCharge,
  onCreateBillingPayment,
  onCreateFrontdeskBill,
  onDeleteBilling,
  onLoadMedicalRecords,
  onLoadPrescriptions,
  onLoadReceipt,
  onUpdatePatient,
  onDeletePatient,
  onCreateCustomerTemplate,
  onUpdateCustomerTemplate,
  onDeleteCustomerTemplate,
  onSendCustomerSms,
  onUpdateFollowUp,
  onUpdateInsurance,
  onDeleteInsurance,
  onCreateExpense,
  onUpdateExpense,
  onDeleteExpense,
  onCreateStaff,
  onUpdateStaff,
  onDeleteStaff,
  onResetStaffPassword,
  onCreateStoreItem,
  onUpdateStoreItem,
  onDeleteStoreItem,
  onProcessStoreSale,
  onCreateMedicalRecord,
  onUpdateMedicalRecord,
  onCreatePrescription,
  onUpdatePrescription,
  branding,
  onSaveSettings,
  settingsSaving,
  theme,
  setTheme,
  assignmentsData,
  procedureChargesData,
}) {
  const role = normalizeRole(
    portalData?.session?.user?.staff_role ?? portalData?.session?.user?.role,
  );
  const navSections = NAVIGATION[role] ?? NAVIGATION.admin;
  const user = {
    name: portalData?.session?.user?.name ?? 'Clinic user',
    roleLabel: ROLE_LABELS[role],
    branch: portalData?.session?.user?.branch ?? branding?.clinicName ?? '',
    profileImage: portalData?.session?.user?.profile_image ?? null,
  };
  const hero = HERO_COPY[role] ?? HERO_COPY.admin;
  const currentPage = navSections
    .flatMap((section) => section.items ?? [])
    .find((item) => item.id === currentView);
  const currentPageLabel = currentPage?.navLabel ?? currentPage?.label ?? 'Dashboard';

  useEffect(() => {
    const clinicName = branding?.clinicName || 'Dentiplus';
    document.title = `${currentPageLabel} | ${clinicName}`;
  }, [branding?.clinicName, currentPageLabel]);

  const fallbackWorkspace = useMemo(() => createFallbackWorkspace(role), [role]);
  const widgets = portalData?.dashboard?.widgets?.length
    ? portalData.dashboard.widgets
    : fallbackWorkspace.widgets;

  const appointmentsRows = portalData?.appointments?.items?.length
    ? portalData.appointments.items
    : fallbackWorkspace.tables.appointments;
  const patientsRows = portalData?.patients?.items?.length
    ? portalData.patients.items
    : fallbackWorkspace.tables.patients;
  const billingRows = portalData?.billing?.items?.length
    ? portalData.billing.items
    : fallbackWorkspace.tables.billing;
  const messageRows = portalData?.messages?.items?.length
    ? portalData.messages.items
    : fallbackWorkspace.tables.messages;
  const staffRows = portalData?.staff?.items?.length
    ? portalData.staff.items
    : fallbackWorkspace.tables.staff;
  const reminderRows = fallbackWorkspace.tables.reminders ?? [];
  const expenseRows = fallbackWorkspace.tables.expenses ?? [];
  const storeRows = fallbackWorkspace.tables.store ?? [];

  const panels = {
    dashboard:
      role === 'receptionist' ? (
        <ReceptionistDashboard
          appointmentsRows={appointmentsRows}
          billingRows={billingRows}
          dashboard={portalData?.dashboard}
          expenseRows={expenseRows}
          messageRows={messageRows}
          onNavigate={setCurrentView}
          patientsRows={patientsRows}
        />
      ) : role === 'dentist' ? (
        <DentistDashboard
          appointments={portalData?.appointments}
          assignments={assignmentsData}
          dashboard={portalData?.dashboard}
          procedureCharges={procedureChargesData}
        />
      ) : role === 'admin' ? (
        <AdminDashboard
          appointmentsRows={appointmentsRows}
          billingRows={billingRows}
          dashboard={portalData?.dashboard}
          onNavigate={setCurrentView}
          patientsRows={patientsRows}
          staffRows={staffRows}
        />
      ) : (
        <>
          <StatGrid items={widgets} />
          <div className="workspace-grid workspace-grid--wide">
            <DataTable
              title="Appointments in motion"
              columns={[
                { key: 'patient', label: 'Patient' },
                { key: 'procedure', label: 'Procedure' },
                { key: 'clinician', label: 'Clinician' },
                { key: 'time', label: 'Time' },
                { key: 'status', label: 'Status' },
              ]}
              rows={appointmentsRows}
              actionLabel="Open schedule"
            />
            <DataTable
              title="Patient intake snapshot"
              columns={[
                { key: 'folder', label: 'Folder' },
                { key: 'patient', label: 'Patient' },
                { key: 'phone', label: 'Phone' },
                { key: 'visitReason', label: 'Visit reason' },
                { key: 'status', label: 'Status' },
              ]}
              rows={patientsRows}
              actionLabel="Open patient desk"
            />
          </div>
        </>
      ),
    appointments: (
      role === 'admin' ? (
        <AdminAppointmentsPage
          appointments={portalData?.appointments}
          onCreateAppointment={onCreateAppointment}
          patients={portalData?.patients}
        />
      ) : role === 'receptionist' ? (
        <ReceptionAppointmentsPage
          appointments={portalData?.appointments}
          onCreateAppointment={onCreateAppointment}
          patients={portalData?.patients}
        />
      ) : (
        <AdminAppointmentsPage
          appointments={portalData?.appointments}
          onCreateAppointment={onCreateAppointment}
          patients={portalData?.patients}
        />
      )
    ),
    patients: (
      role === 'dentist' ? (
        <DentistPatientsPage
          currentView="patients"
          onCreateMedicalRecord={onCreateMedicalRecord}
          onUpdateMedicalRecord={onUpdateMedicalRecord}
          onCreatePrescription={onCreatePrescription}
          onUpdatePrescription={onUpdatePrescription}
          onLoadMedicalRecords={onLoadMedicalRecords}
          onLoadPrescriptions={onLoadPrescriptions}
          patients={portalData?.patients}
        />
      ) : role === 'admin' || role === 'receptionist' ? (
        <ReceptionPatientDatabasePage
          onDeletePatient={onDeletePatient}
          onUpdatePatient={onUpdatePatient}
          patients={portalData?.patients}
        />
      ) : (
        <ReceptionPatientDatabasePage
          onDeletePatient={onDeletePatient}
          onUpdatePatient={onUpdatePatient}
          patients={portalData?.patients}
        />
      )
    ),
    sales: (
      <ReceptionPaymentsPage
        billing={portalData?.billing}
        dashboard={portalData?.dashboard}
        insurance={portalData?.insurance}
        onCreateFrontdeskBill={onCreateFrontdeskBill}
        onCreateBillingPayment={onCreateBillingPayment}
        onDeleteBilling={onDeleteBilling}
        onLoadReceipt={onLoadReceipt}
        patients={portalData?.patients}
      />
    ),
    billing: (
      <ReceptionPaymentsPage
        billing={portalData?.billing}
        insurance={portalData?.insurance}
        onCreateFrontdeskBill={onCreateFrontdeskBill}
        onCreateBillingPayment={onCreateBillingPayment}
        onDeleteBilling={onDeleteBilling}
        onLoadReceipt={onLoadReceipt}
        patients={portalData?.patients}
      />
    ),
    'assign-patient': (
      role === 'receptionist' ? (
        <ReceptionAssignPatientPage
          assignments={assignmentsData}
          onAssignPatient={onAssignPatient}
          onCompleteAssignment={onCompleteAssignment}
        />
      ) : (
        <div className="workspace-grid workspace-grid--split">
          <DataTable
            title="Assign patient queue"
            columns={[
              { key: 'folder', label: 'Folder' },
              { key: 'patient', label: 'Patient' },
              { key: 'visitReason', label: 'Visit reason' },
              { key: 'status', label: 'Status' },
            ]}
            rows={patientsRows}
            actionLabel="Queue to dentist"
          />
          <FormPanel
            title="Assign to clinician"
            description="Reflects the ASDental receptionist pattern where the desk controls the next handoff into the chair workflow."
            fields={[
              { label: 'Patient folder', placeholder: 'Search or enter folder ID' },
              { label: 'Dentist', placeholder: 'Choose dentist' },
              { label: 'Priority', placeholder: 'Standard, urgent, follow-up...' },
              { label: 'Desk note', placeholder: 'Assignment notes', type: 'textarea' },
            ]}
            actionLabel="Assign patient"
          />
        </div>
      )
    ),
    'walkin-registration': (
      role === 'receptionist' ? (
        <ReceptionWalkinPage
          appointments={portalData?.appointments}
          assignments={assignmentsData}
          onAssignPatient={onAssignPatient}
          onCreateAppointment={onCreateAppointment}
          onRegisterPatient={onRegisterPatient}
          patients={portalData?.patients}
        />
      ) : (
        <div className="workspace-grid workspace-grid--split">
          <DataTable
            title="Walk-in registration log"
            columns={[
              { key: 'folder', label: 'Folder' },
              { key: 'patient', label: 'Patient' },
              { key: 'phone', label: 'Phone' },
              { key: 'visitReason', label: 'Visit reason' },
              { key: 'status', label: 'Status' },
            ]}
            rows={patientsRows}
            actionLabel="Open payment modal"
          />
          <FormPanel
            title="Register walk-in patient"
            description="Borrowing from ASDental, this desk form is for quick patient registration before payment or assignment."
            fields={[
              { label: 'First name', placeholder: 'Enter first name' },
              { label: 'Other names', placeholder: 'Optional middle names' },
              { label: 'Last name', placeholder: 'Enter last name' },
              { label: 'Phone', placeholder: '+233...' },
              { label: 'Visit reason', placeholder: 'Pain, consultation, review...' },
              { label: 'Old folder ID', placeholder: 'If returning from legacy records' },
              { label: 'Address', placeholder: 'Residential address', type: 'textarea' },
            ]}
            actionLabel="Register patient"
          />
        </div>
      )
    ),
    payments: (
      role === 'receptionist' ? (
        <ReceptionPaymentsPage
          billing={portalData?.billing}
          dashboard={portalData?.dashboard}
          insurance={portalData?.insurance}
          onCreateFrontdeskBill={onCreateFrontdeskBill}
          onCreateBillingPayment={onCreateBillingPayment}
          onDeleteBilling={onDeleteBilling}
          onLoadReceipt={onLoadReceipt}
          patients={portalData?.patients}
        />
      ) : (
        <div className="workspace-grid workspace-grid--split">
          <DataTable
            title="Reception payment queue"
            columns={[
              { key: 'bill', label: 'Bill' },
              { key: 'patient', label: 'Patient' },
              { key: 'amount', label: 'Amount' },
              { key: 'balance', label: 'Balance' },
              { key: 'status', label: 'Status' },
            ]}
            rows={billingRows}
            actionLabel="Process payment"
          />
          <FormPanel
            title="Process payment"
            description="Shaped by ASDental's receptionist payment flow with room for cash, MoMo, card, and insurance combinations."
            fields={[
              { label: 'Billing reference', placeholder: 'INV-00039' },
              { label: 'Payment method 1', placeholder: 'Cash, Mobile Money, Card, Insurance' },
              { label: 'Amount', placeholder: '0.00', type: 'number' },
              { label: 'Transaction ID', placeholder: 'Required for MoMo or card' },
              { label: 'Insurance covered amount', placeholder: 'Optional', type: 'number' },
              { label: 'Insurance company / notes', placeholder: 'Company, category, or desk note', type: 'textarea' },
            ]}
            actionLabel="Save payment"
          />
        </div>
      )
    ),
    'past-receipts': (
      <PastReceiptsPage
        billing={portalData?.billing}
        onLoadReceipt={onLoadReceipt}
      />
    ),
    'procedure-charge': (
      role === 'dentist' ? (
        <ProcedureChargePage
          data={procedureChargesData}
          onCreateProcedureCharge={onCreateProcedureCharge}
        />
      ) : (
        <FormPanel
          title="Procedure Charges"
          description="This space is reserved for dentists to create live procedure charges."
          fields={[
            { label: 'Dentist note', placeholder: 'Only dentists can work in this area right now.', type: 'textarea' },
          ]}
          actionLabel="Save draft"
        />
      )
    ),
    'medical-records': (
      role === 'dentist' ? (
        <DentistPatientsPage
          currentView="medical-records"
          onCreateMedicalRecord={onCreateMedicalRecord}
          onUpdateMedicalRecord={onUpdateMedicalRecord}
          onCreatePrescription={onCreatePrescription}
          onUpdatePrescription={onUpdatePrescription}
          onLoadMedicalRecords={onLoadMedicalRecords}
          onLoadPrescriptions={onLoadPrescriptions}
          patients={portalData?.patients}
        />
      ) : (
        <FormPanel
          title="Medical Records"
          description="This workspace is reserved for dentist clinical records."
          fields={[{ label: 'Note', placeholder: 'Clinical records are available for dentists.', type: 'textarea' }]}
          actionLabel="Save draft"
        />
      )
    ),
    'new-medical-record': (
      role === 'dentist' ? (
        <DentistPatientsPage
          currentView="new-medical-record"
          onCreateMedicalRecord={onCreateMedicalRecord}
          onUpdateMedicalRecord={onUpdateMedicalRecord}
          onCreatePrescription={onCreatePrescription}
          onUpdatePrescription={onUpdatePrescription}
          onLoadMedicalRecords={onLoadMedicalRecords}
          onLoadPrescriptions={onLoadPrescriptions}
          patients={portalData?.patients}
        />
      ) : (
        <FormPanel
          title="New Medical Record"
          description="This workspace is reserved for dentist clinical records."
          fields={[{ label: 'Note', placeholder: 'Clinical records are available for dentists.', type: 'textarea' }]}
          actionLabel="Save draft"
        />
      )
    ),
    'prescription-history': (
      role === 'dentist' ? (
        <DentistPatientsPage
          currentView="prescription-history"
          onCreateMedicalRecord={onCreateMedicalRecord}
          onUpdateMedicalRecord={onUpdateMedicalRecord}
          onCreatePrescription={onCreatePrescription}
          onUpdatePrescription={onUpdatePrescription}
          onLoadMedicalRecords={onLoadMedicalRecords}
          onLoadPrescriptions={onLoadPrescriptions}
          patients={portalData?.patients}
        />
      ) : (
        <FormPanel
          title="Prescription History"
          description="This workspace is reserved for dentist clinical records."
          fields={[{ label: 'Note', placeholder: 'Clinical records are available for dentists.', type: 'textarea' }]}
          actionLabel="Save draft"
        />
      )
    ),
    'new-prescription': (
      role === 'dentist' ? (
        <DentistPatientsPage
          currentView="new-prescription"
          onCreateMedicalRecord={onCreateMedicalRecord}
          onUpdateMedicalRecord={onUpdateMedicalRecord}
          onCreatePrescription={onCreatePrescription}
          onUpdatePrescription={onUpdatePrescription}
          onLoadMedicalRecords={onLoadMedicalRecords}
          onLoadPrescriptions={onLoadPrescriptions}
          patients={portalData?.patients}
        />
      ) : (
        <FormPanel
          title="New Prescription"
          description="This workspace is reserved for dentist clinical records."
          fields={[{ label: 'Note', placeholder: 'Clinical records are available for dentists.', type: 'textarea' }]}
          actionLabel="Save draft"
        />
      )
    ),
    'patient-database': (
      role === 'receptionist' ? (
        <ReceptionPatientDatabasePage
          onDeletePatient={onDeletePatient}
          onUpdatePatient={onUpdatePatient}
          patients={portalData?.patients}
        />
      ) : (
        <DataTable
          title="Patient database"
          columns={[
            { key: 'folder', label: 'Folder' },
            { key: 'patient', label: 'Patient' },
            { key: 'phone', label: 'Phone' },
            { key: 'visitReason', label: 'Visit reason' },
            { key: 'status', label: 'Status' },
          ]}
          rows={patientsRows}
          actionLabel="Open record"
        />
      )
    ),
    reminders: (
      <div className="workspace-grid workspace-grid--split">
        <DataTable
          title="Patient reminders"
          columns={[
            { key: 'patient', label: 'Patient' },
            { key: 'note', label: 'Reminder' },
            { key: 'due', label: 'Due' },
          ]}
          rows={reminderRows}
          actionLabel="Send reminder"
        />
        <FormPanel
          title="Create reminder"
          description="Use this desk panel for follow-up calls, missed appointment nudges, and pre-visit confirmations."
          fields={[
            { label: 'Patient', placeholder: 'Select patient' },
            { label: 'Reminder type', placeholder: 'Call, SMS, WhatsApp, review...' },
            { label: 'Due date', placeholder: 'Select date', type: 'date' },
            { label: 'Reminder note', placeholder: 'What should be communicated?', type: 'textarea' },
          ]}
          actionLabel="Save reminder"
        />
      </div>
    ),
    'customer-service': (
      role === 'receptionist' ? (
        <ReceptionCustomerServicePage
          data={portalData?.customerService}
          onCreateTemplate={onCreateCustomerTemplate}
          onDeleteTemplate={onDeleteCustomerTemplate}
          onSendSms={onSendCustomerSms}
          onUpdateFollowUp={onUpdateFollowUp}
          onUpdateTemplate={onUpdateCustomerTemplate}
        />
      ) : (
        <div className="workspace-grid workspace-grid--split">
          <DataTable
            title="Customer service threads"
            columns={[
              { key: 'thread', label: 'Thread' },
              { key: 'latest', label: 'Latest message' },
              { key: 'participants', label: 'Participants' },
              { key: 'unread', label: 'Unread' },
            ]}
            rows={messageRows}
            actionLabel="Open thread"
          />
          <FormPanel
            title="Customer service note"
            description="A front-desk service lane for escalations, callbacks, and patient relationship follow-through."
            fields={[
              { label: 'Patient or thread', placeholder: 'Select patient or thread' },
              { label: 'Channel', placeholder: 'Desk call, SMS, WhatsApp...' },
              { label: 'Summary', placeholder: 'Short issue summary' },
              { label: 'Action note', placeholder: 'What should happen next?', type: 'textarea' },
            ]}
            actionLabel="Save service note"
          />
        </div>
      )
    ),
    insurance: (
      role === 'receptionist' ? (
        <ReceptionInsurancePage
          data={portalData?.insurance}
          onDeleteInsurance={onDeleteInsurance}
          onUpdateInsurance={onUpdateInsurance}
        />
      ) : (
        <div className="workspace-grid workspace-grid--split">
          <DataTable
            title="Insurance payment desk"
            columns={[
              { key: 'bill', label: 'Bill' },
              { key: 'patient', label: 'Patient' },
              { key: 'amount', label: 'Amount' },
              { key: 'balance', label: 'Balance' },
              { key: 'status', label: 'Status' },
            ]}
            rows={billingRows}
            actionLabel="Open claim"
          />
          <FormPanel
            title="Insurance claim handoff"
            description="Mirrors the receptionist insurance handling from ASDental with claim details beside the open bill."
            fields={[
              { label: 'Billing reference', placeholder: 'INV-00039' },
              { label: 'Insurance type', placeholder: 'NHIS, private, corporate...' },
              { label: 'Company', placeholder: 'Insurance company' },
              { label: 'Insurance number', placeholder: 'Policy or membership number' },
              { label: 'Covered amount', placeholder: '0.00', type: 'number' },
              { label: 'Claim note', placeholder: 'Category, expiry, internal note', type: 'textarea' },
            ]}
            actionLabel="Save insurance note"
          />
        </div>
      )
    ),
    expenses: (
      role === 'admin' || role === 'receptionist' ? (
        <ReceptionExpensesPage
          data={portalData?.expenses}
          onCreateExpense={onCreateExpense}
          onDeleteExpense={onDeleteExpense}
          onUpdateExpense={onUpdateExpense}
        />
      ) : (
        <ReceptionExpensesPage
          data={portalData?.expenses}
          onCreateExpense={onCreateExpense}
          onDeleteExpense={onDeleteExpense}
          onUpdateExpense={onUpdateExpense}
        />
      )
    ),
    store: (
      role === 'admin' || role === 'receptionist' ? (
        <ReceptionStorePage
          data={portalData?.store}
          onCreateStoreItem={onCreateStoreItem}
          onDeleteStoreItem={onDeleteStoreItem}
          onProcessStoreSale={onProcessStoreSale}
          onUpdateStoreItem={onUpdateStoreItem}
        />
      ) : (
        <DataTable
          title="eDental store counter"
          columns={[
            { key: 'item', label: 'Item' },
            { key: 'sku', label: 'SKU' },
            { key: 'stock', label: 'Stock' },
            { key: 'status', label: 'Status' },
          ]}
          rows={storeRows}
          actionLabel="Open store"
        />
      )
    ),
    'store-monitor': (
      role === 'admin' ? (
        <AdminStoreMonitorPage
          data={portalData?.store}
          onNavigate={setCurrentView}
        />
      ) : (
        <ReceptionStorePage
          data={portalData?.store}
          onCreateStoreItem={onCreateStoreItem}
          onDeleteStoreItem={onDeleteStoreItem}
          onProcessStoreSale={onProcessStoreSale}
          onUpdateStoreItem={onUpdateStoreItem}
        />
      )
    ),
    messages: (
      <div className="workspace-grid workspace-grid--split">
        <DataTable
          title="Internal communication"
          columns={[
            { key: 'thread', label: 'Thread' },
            { key: 'latest', label: 'Latest message' },
            { key: 'participants', label: 'Participants' },
            { key: 'unread', label: 'Unread' },
          ]}
          rows={messageRows}
          actionLabel="Open inbox"
        />
        <FormPanel
          title="Compose update"
          description="Dentiplus leaves space for quick staff coordination without dropping out of the shell."
          fields={[
            { label: 'Recipient group', placeholder: 'Choose staff or team' },
            { label: 'Message subject', placeholder: 'Short operational subject' },
            { label: 'Message', placeholder: 'Type the update here', type: 'textarea' },
          ]}
          actionLabel="Send message"
        />
      </div>
    ),
    staff: (
      <AdminStaffPage
        currentUserId={portalData?.session?.user?.staff_id ?? null}
        onCreateStaff={onCreateStaff}
        onDeleteStaff={onDeleteStaff}
        onNavigate={setCurrentView}
        onResetStaffPassword={onResetStaffPassword}
        staff={portalData?.staff}
        onUpdateStaff={onUpdateStaff}
      />
    ),
    database: (
      <AdminDatabasePage
        appointments={portalData?.appointments}
        billing={portalData?.billing}
        expenses={portalData?.expenses}
        insurance={portalData?.insurance}
        onNavigate={setCurrentView}
        patients={portalData?.patients}
        staff={portalData?.staff}
        store={portalData?.store}
      />
    ),
    settings: role === 'admin' ? (
      <SettingsPanel branding={branding} onSave={onSaveSettings} saving={settingsSaving} />
    ) : (
      <FormPanel
        title="Clinic settings"
        description="Settings access is reserved for admin users."
        fields={[
          { label: 'Clinic name', placeholder: branding?.clinicName ?? 'Dentiplus clinic name' },
          { label: 'Clinic email', placeholder: branding?.email ?? 'clinic@example.com' },
        ]}
        actionLabel="Admin only"
      />
    ),
  };

  const fallbackPanel = (
    <FormPanel
      title="Workspace extension point"
      description="This shell is ready for deeper role-specific modules without changing the underlying design language."
      fields={[
        { label: 'Module title', placeholder: 'Future Dentiplus module' },
        { label: 'Owner note', placeholder: 'Implementation note', type: 'textarea' },
      ]}
      actionLabel="Save draft"
    />
  );

  return (
    <main className="portal-shell">
      <Sidebar
        branding={branding}
        role={ROLE_LABELS[role]}
        navSections={navSections}
        currentView={currentView}
        currentUser={user}
        isMobileOpen={mobileOpen}
        onNavigate={(view) => {
          setCurrentView(view);
          setMobileOpen(false);
        }}
        onClose={() => setMobileOpen(false)}
        onSignOut={onLogout}
      />

      <div className="portal-main">
          <HeaderHero
            branding={branding}
            currentPageLabel={currentPageLabel}
            hero={hero}
            onToggleSidebar={() => setMobileOpen(true)}
            onSignOut={onLogout}
          setTheme={setTheme}
          theme={theme}
          user={user}
        />
        <section className="content-stack">{panels[currentView] ?? fallbackPanel}</section>
        <FooterBar clinicName={branding?.clinicName} />
      </div>
    </main>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) ?? 'dark');
  const {
    bootState,
    loginError,
    loginLoading,
    portalData,
    assignmentsData,
    procedureChargesData,
    publicBranding,
    settingsSaving,
    mobileOpen,
    currentView,
    setCurrentView,
    setMobileOpen,
    handleAssignPatient,
    handleCreateAppointment,
    handleCreateBillingPayment,
    handleCreateFrontdeskBill,
    handleDeleteBilling,
    handleCreateProcedureCharge,
    handleCreateMedicalRecord,
    handleUpdateMedicalRecord,
    handleCreatePrescription,
    handleUpdatePrescription,
    handleUpdatePatient,
    handleDeletePatient,
    handleCreateCustomerTemplate,
    handleUpdateCustomerTemplate,
    handleDeleteCustomerTemplate,
    handleSendCustomerSms,
    handleUpdateFollowUp,
    handleUpdateInsurance,
    handleDeleteInsurance,
    handleCreateExpense,
    handleUpdateExpense,
    handleDeleteExpense,
    handleCreateStaff,
    handleUpdateStaff,
    handleDeleteStaff,
    handleResetStaffPassword,
    handleCreateStoreItem,
    handleUpdateStoreItem,
    handleDeleteStoreItem,
    handleProcessStoreSale,
    handleCompleteAssignment,
    handleLogin,
    handleLoadReceipt,
    handleLoadMedicalRecords,
    handleLoadPrescriptions,
    handleLogout,
    handleRegisterPatient,
    handleSaveSettings,
  } = useDentiplusPortal();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  if (bootState === 'restoring') {
    return <SessionRestore />;
  }

  if (bootState !== 'ready' || !portalData) {
    return (
      <LoginScreen
        branding={publicBranding}
        error={loginError}
        loading={loginLoading}
        onLogin={handleLogin}
        setTheme={setTheme}
        theme={theme}
      />
    );
  }

  return (
    <AppWorkspace
      branding={portalData?.settings?.branding ?? publicBranding}
      currentView={currentView}
      mobileOpen={mobileOpen}
      assignmentsData={assignmentsData}
      procedureChargesData={procedureChargesData}
      onAssignPatient={handleAssignPatient}
      onCreateAppointment={handleCreateAppointment}
      onCreateBillingPayment={handleCreateBillingPayment}
      onCreateFrontdeskBill={handleCreateFrontdeskBill}
      onDeleteBilling={handleDeleteBilling}
      onCreateMedicalRecord={handleCreateMedicalRecord}
      onUpdateMedicalRecord={handleUpdateMedicalRecord}
      onCreatePrescription={handleCreatePrescription}
      onUpdatePrescription={handleUpdatePrescription}
      onCreateProcedureCharge={handleCreateProcedureCharge}
      onCompleteAssignment={handleCompleteAssignment}
      onLoadMedicalRecords={handleLoadMedicalRecords}
      onLoadPrescriptions={handleLoadPrescriptions}
      onLoadReceipt={handleLoadReceipt}
      onUpdatePatient={handleUpdatePatient}
      onDeletePatient={handleDeletePatient}
      onCreateCustomerTemplate={handleCreateCustomerTemplate}
      onUpdateCustomerTemplate={handleUpdateCustomerTemplate}
      onDeleteCustomerTemplate={handleDeleteCustomerTemplate}
      onSendCustomerSms={handleSendCustomerSms}
      onUpdateFollowUp={handleUpdateFollowUp}
      onUpdateInsurance={handleUpdateInsurance}
      onDeleteInsurance={handleDeleteInsurance}
      onCreateExpense={handleCreateExpense}
      onUpdateExpense={handleUpdateExpense}
      onDeleteExpense={handleDeleteExpense}
      onCreateStaff={handleCreateStaff}
      onUpdateStaff={handleUpdateStaff}
      onDeleteStaff={handleDeleteStaff}
      onResetStaffPassword={handleResetStaffPassword}
      onCreateStoreItem={handleCreateStoreItem}
      onUpdateStoreItem={handleUpdateStoreItem}
      onDeleteStoreItem={handleDeleteStoreItem}
      onProcessStoreSale={handleProcessStoreSale}
      onLogout={handleLogout}
      onRegisterPatient={handleRegisterPatient}
      onSaveSettings={handleSaveSettings}
      portalData={portalData}
      setCurrentView={setCurrentView}
      setMobileOpen={setMobileOpen}
      settingsSaving={settingsSaving}
      setTheme={setTheme}
      theme={theme}
    />
  );
}
