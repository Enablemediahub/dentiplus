function buildHostedApiBase() {
  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:8000/api/v1';
  }

  const { origin, hostname, port } = window.location;
  const isLocalFrontend = (hostname === 'localhost' || hostname === '127.0.0.1') && port === '5176';
  if (isLocalFrontend) {
    return 'http://127.0.0.1:8000/api/v1';
  }

  return `${origin}/api/v1`;
}

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ??
  buildHostedApiBase()
).replace(/\/+$/, '');

export const TOKEN_KEY = 'dentiplus-token';

function withBranchQuery(path, branch = '') {
  const normalizedBranch = String(branch ?? '').trim();
  if (!normalizedBranch) {
    return path;
  }

  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}branch=${encodeURIComponent(normalizedBranch)}`;
}

function withQuery(path, params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  if (!query) {
    return path;
  }

  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${query}`;
}

async function request(path, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers ?? {}),
    },
    method: options.method ?? 'GET',
    body: options.body
      ? (isFormData ? options.body : JSON.stringify(options.body))
      : undefined,
  });

  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch (error) {
    throw new Error('The API returned a non-JSON response.');
  }

  if (!response.ok) {
    throw new Error(payload?.message ?? 'The request failed. Check the backend connection and try again.');
  }

  return payload;
}

export const api = {
  login: (credentials) => request('/auth/login', { method: 'POST', body: credentials }),
  session: (token) => request('/auth/session', { token }),
  logout: (token) => request('/auth/logout', { method: 'POST', token }),
  dashboard: (token, branch = '') => request(withBranchQuery('/dashboard', branch), { token }),
  appointments: (token, branch = '') => request(withBranchQuery('/appointments', branch), { token }),
  createAppointment: (token, body) => request('/appointments', { method: 'POST', token, body }),
  assignments: (token, branch = '') => request(withBranchQuery('/patient-assignments', branch), { token }),
  createAssignment: (token, body) => request('/patient-assignments', { method: 'POST', token, body }),
  completeAssignment: (token, body) => request('/patient-assignments/complete', { method: 'POST', token, body }),
  patients: (token, branch = '') => request(withBranchQuery('/patients', branch), { token }),
  createPatient: (token, body) => request('/patients', { method: 'POST', token, body }),
  updatePatient: (token, body) => request('/patients/update', { method: 'POST', token, body }),
  deletePatient: (token, body) => request('/patients/delete', { method: 'POST', token, body }),
  medicalRecords: (token, patientId) => request(`/medical-records?patient_id=${patientId}`, { token }),
  createMedicalRecord: (token, body) => request('/medical-records', { method: 'POST', token, body }),
  updateMedicalRecord: (token, body) => request('/medical-records/update', { method: 'POST', token, body }),
  prescriptions: (token, patientId) => request(`/prescriptions?patient_id=${patientId}`, { token }),
  createPrescription: (token, body) => request('/prescriptions', { method: 'POST', token, body }),
  updatePrescription: (token, body) => request('/prescriptions/update', { method: 'POST', token, body }),
  billing: (token, branch = '') => request(withBranchQuery('/billing', branch), { token }),
  createBillingPayment: (token, body) => request('/billing/payments', { method: 'POST', token, body }),
  createFrontdeskBill: (token, body) => request('/billing/frontdesk-bill', { method: 'POST', token, body }),
  deleteBilling: (token, body) => request('/billing/delete', { method: 'POST', token, body }),
  receipt: (token, receiptNumber) => request(`/billing/receipt?receipt_number=${encodeURIComponent(receiptNumber)}`, { token }),
  customerService: (token) => request('/customer-service', { token }),
  createCustomerTemplate: (token, body) => request('/customer-service/templates', { method: 'POST', token, body }),
  updateCustomerTemplate: (token, body) => request('/customer-service/templates/update', { method: 'POST', token, body }),
  deleteCustomerTemplate: (token, body) => request('/customer-service/templates/delete', { method: 'POST', token, body }),
  sendCustomerSms: (token, body) => request('/customer-service/send-sms', { method: 'POST', token, body }),
  updateFollowUp: (token, body) => request('/customer-service/follow-ups/update', { method: 'POST', token, body }),
  expenses: (token, branch = '') => request(withBranchQuery('/expenses', branch), { token }),
  createExpense: (token, body) => request('/expenses', { method: 'POST', token, body }),
  updateExpense: (token, body) => request('/expenses/update', { method: 'POST', token, body }),
  deleteExpense: (token, body) => request('/expenses/delete', { method: 'POST', token, body }),
  insurance: (token, branch = '') => request(withBranchQuery('/insurance', branch), { token }),
  updateInsurance: (token, body) => request('/insurance/update', { method: 'POST', token, body }),
  deleteInsurance: (token, body) => request('/insurance/delete', { method: 'POST', token, body }),
  procedureCharges: (token) => request('/procedure-charges', { token }),
  activityLog: (token, branch = '') => request(withBranchQuery('/activity-log', branch), { token }),
  createProcedureCharge: (token, body) => request('/procedure-charges', { method: 'POST', token, body }),
  updateProcedureChargeBilling: (token, body) => request('/procedure-charges/update-billing', { method: 'POST', token, body }),
  deleteProcedureChargeBilling: (token, body) => request('/procedure-charges/delete-billing', { method: 'POST', token, body }),
  createProcedureCatalog: (token, body) => request('/procedure-charges/catalog', { method: 'POST', token, body }),
  updateProcedureCatalog: (token, body) => request('/procedure-charges/catalog/update', { method: 'POST', token, body }),
  deleteProcedureCatalog: (token, body) => request('/procedure-charges/catalog/delete', { method: 'POST', token, body }),
  messages: (token) => request('/messages', { token }),
  staff: (token, branch = '') => request(withBranchQuery('/staff', branch), { token }),
  createStaff: (token, body) => request('/staff', { method: 'POST', token, body }),
  updateStaff: (token, body) => request('/staff/update', { method: 'POST', token, body }),
  deleteStaff: (token, body) => request('/staff/delete', { method: 'POST', token, body }),
  resetStaffPassword: (token, body) => request('/staff/reset-password', { method: 'POST', token, body }),
  settings: (token) => request('/settings', { token }),
  updateSettings: (token, body) => request('/settings', { method: 'POST', token, body }),
  createBranch: (token, body) => request('/settings/branches', { method: 'POST', token, body }),
  store: (token, branch = '') => request(withBranchQuery('/store', branch), { token }),
  createStoreItem: (token, body) => request('/store/items', { method: 'POST', token, body }),
  updateStoreItem: (token, body) => request('/store/items/update', { method: 'POST', token, body }),
  deleteStoreItem: (token, body) => request('/store/items/delete', { method: 'POST', token, body }),
  processStoreSale: (token, body) => request('/store/sales', { method: 'POST', token, body }),
  databaseMeta: (token, params = {}) => request(withQuery('/database-admin/meta', params), { token }),
  databaseTable: (token, params = {}) => request(withQuery('/database-admin/table', params), { token }),
  databaseRow: (token, params = {}) => request(withQuery('/database-admin/row', params), { token }),
  databaseDuplicates: (token, params = {}) => request(withQuery('/database-admin/duplicates', params), { token }),
  updateDatabaseRow: (token, body) => request('/database-admin/update', { method: 'POST', token, body }),
  deleteDatabaseRow: (token, body) => request('/database-admin/delete', { method: 'POST', token, body }),
};
