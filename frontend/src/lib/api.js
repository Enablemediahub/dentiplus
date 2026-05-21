const API_BASE =
  import.meta.env.VITE_API_BASE_URL ??
  'http://127.0.0.1:8000/api/v1';

export const TOKEN_KEY = 'dentiplus-token';

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
  dashboard: (token) => request('/dashboard', { token }),
  appointments: (token) => request('/appointments', { token }),
  createAppointment: (token, body) => request('/appointments', { method: 'POST', token, body }),
  assignments: (token) => request('/patient-assignments', { token }),
  createAssignment: (token, body) => request('/patient-assignments', { method: 'POST', token, body }),
  completeAssignment: (token, body) => request('/patient-assignments/complete', { method: 'POST', token, body }),
  patients: (token) => request('/patients', { token }),
  createPatient: (token, body) => request('/patients', { method: 'POST', token, body }),
  updatePatient: (token, body) => request('/patients/update', { method: 'POST', token, body }),
  deletePatient: (token, body) => request('/patients/delete', { method: 'POST', token, body }),
  medicalRecords: (token, patientId) => request(`/medical-records?patient_id=${patientId}`, { token }),
  createMedicalRecord: (token, body) => request('/medical-records', { method: 'POST', token, body }),
  updateMedicalRecord: (token, body) => request('/medical-records/update', { method: 'POST', token, body }),
  prescriptions: (token, patientId) => request(`/prescriptions?patient_id=${patientId}`, { token }),
  createPrescription: (token, body) => request('/prescriptions', { method: 'POST', token, body }),
  updatePrescription: (token, body) => request('/prescriptions/update', { method: 'POST', token, body }),
  billing: (token) => request('/billing', { token }),
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
  expenses: (token) => request('/expenses', { token }),
  createExpense: (token, body) => request('/expenses', { method: 'POST', token, body }),
  updateExpense: (token, body) => request('/expenses/update', { method: 'POST', token, body }),
  deleteExpense: (token, body) => request('/expenses/delete', { method: 'POST', token, body }),
  insurance: (token) => request('/insurance', { token }),
  updateInsurance: (token, body) => request('/insurance/update', { method: 'POST', token, body }),
  deleteInsurance: (token, body) => request('/insurance/delete', { method: 'POST', token, body }),
  procedureCharges: (token) => request('/procedure-charges', { token }),
  createProcedureCharge: (token, body) => request('/procedure-charges', { method: 'POST', token, body }),
  messages: (token) => request('/messages', { token }),
  staff: (token) => request('/staff', { token }),
  settings: (token) => request('/settings', { token }),
  updateSettings: (token, body) => request('/settings', { method: 'POST', token, body }),
  store: (token) => request('/store', { token }),
  createStoreItem: (token, body) => request('/store/items', { method: 'POST', token, body }),
  updateStoreItem: (token, body) => request('/store/items/update', { method: 'POST', token, body }),
  deleteStoreItem: (token, body) => request('/store/items/delete', { method: 'POST', token, body }),
  processStoreSale: (token, body) => request('/store/sales', { method: 'POST', token, body }),
};
