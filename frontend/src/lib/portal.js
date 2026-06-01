export const ROLE_LABELS = {
  admin: 'Admin',
  receptionist: 'Receptionist',
  dentist: 'Dentist',
  accountant: 'Accountant',
};

export const NAVIGATION = {
  receptionist: [
    {
      title: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', navLabel: 'Dashboard Overview', icon: 'dashboard' },
      ],
    },
    {
      title: 'Front Desk',
      items: [
        { id: 'appointments', label: 'Appointments', navLabel: 'Appointments', icon: 'calendar' },
        { id: 'assign-patient', label: 'Assign Patient', navLabel: 'Assign Patient', icon: 'patients' },
        { id: 'walkin-registration', label: 'Walk-ins', navLabel: 'Walk-in Registration', icon: 'briefcase' },
        { id: 'payments', label: 'Payments', navLabel: 'Payments', icon: 'receipt' },
        { id: 'procedure-bills', label: 'Procedure Bills', navLabel: 'Procedure Bills', icon: 'receipt' },
        { id: 'past-receipts', label: 'Past Receipts', navLabel: 'Past Receipts', icon: 'receipt' },
        { id: 'patient-database', label: 'Patients', navLabel: 'Patient Database', icon: 'patients' },
      ],
    },
    {
      title: 'Customer Care',
      items: [
        { id: 'reminders', label: 'Reminders', navLabel: 'Patient Reminders', icon: 'clock' },
        { id: 'customer-service', label: 'Customer Service', navLabel: 'Customer Service', icon: 'support' },
        { id: 'messages', label: 'Messages', navLabel: 'Messages', icon: 'message' },
      ],
    },
    {
      title: 'Operations',
      items: [
        { id: 'insurance', label: 'Insurance', navLabel: 'Insurance Payments', icon: 'shield' },
        { id: 'expenses', label: 'Expenses', navLabel: 'Expenses', icon: 'finance' },
        { id: 'store', label: 'Store', navLabel: 'eDental Store', icon: 'inventory' },
      ],
    },
  ],
  dentist: [
    {
      title: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', navLabel: 'Clinical Overview', icon: 'dashboard' },
      ],
    },
    {
      title: 'Patients',
      items: [
        { id: 'patients', label: 'Patients', navLabel: 'Patient Management', icon: 'patients' },
        { id: 'appointments', label: 'Appointments', navLabel: 'Appointments', icon: 'calendar' },
        { id: 'procedure-charge', label: 'Procedure Charges', navLabel: 'Procedure Charges', icon: 'receipt' },
      ],
    },
    {
      title: 'Clinical Records',
      items: [
        { id: 'medical-records', label: 'Medical Records', navLabel: 'Medical Records', icon: 'layers' },
        { id: 'new-medical-record', label: 'New Medical Record', navLabel: 'New Medical Record', icon: 'briefcase' },
        { id: 'prescription-history', label: 'Prescription History', navLabel: 'Prescription History', icon: 'check-badge' },
        { id: 'new-prescription', label: 'New Prescription', navLabel: 'New Prescription', icon: 'receipt' },
        { id: 'messages', label: 'Messages', navLabel: 'Messages', icon: 'message' },
      ],
    },
  ],
  accountant: [
    {
      title: 'Dashboard',
      items: [
        { id: 'dashboard', label: 'Dashboard', navLabel: 'Financial Overview', icon: 'dashboard' },
      ],
    },
    {
      title: 'Financial Management',
      items: [
        { id: 'revenue', label: 'Revenue', navLabel: 'Revenue Tracking', icon: 'trend' },
        { id: 'billing', label: 'Payments', navLabel: 'Billing / Payments', icon: 'receipt' },
        { id: 'expenses', label: 'Expenses', navLabel: 'Expenses', icon: 'finance' },
        { id: 'reports', label: 'Reports', navLabel: 'Reports', icon: 'reports' },
        { id: 'ledger', label: 'Financial Ledger', navLabel: 'Financial Ledger', icon: 'layers' },
      ],
    },
    {
      title: 'Profile',
      items: [{ id: 'messages', label: 'Messages', navLabel: 'Messages', icon: 'message' }],
    },
  ],
  admin: [
    {
      title: 'Executive Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', navLabel: 'Executive Dashboard', icon: 'dashboard' },
      ],
    },
    {
      title: 'Control Center',
      items: [
        { id: 'sales', label: 'Sales', navLabel: 'Sales Control', icon: 'trend' },
        { id: 'past-receipts', label: 'Past Receipts', navLabel: 'Past Receipts', icon: 'receipt' },
        { id: 'deletion-audit', label: 'Deletion Audit', navLabel: 'Deletion Audit', icon: 'clipboard' },
        { id: 'expenses', label: 'Expenses', navLabel: 'Expense Control', icon: 'finance' },
        { id: 'store-monitor', label: 'Store Monitor', navLabel: 'Store Monitor', icon: 'inventory' },
        { id: 'database', label: 'Database', navLabel: 'Platform Database', icon: 'layers' },
      ],
    },
    {
      title: 'Operations',
      items: [
        { id: 'staff', label: 'Users & Staff', navLabel: 'Users & Staff', icon: 'briefcase' },
        { id: 'patients', label: 'Patients', navLabel: 'Patients', icon: 'patients' },
        { id: 'appointments', label: 'Appointments', navLabel: 'Appointments', icon: 'calendar' },
        { id: 'procedure-charge', label: 'Procedure Charges', navLabel: 'Procedure Charges', icon: 'receipt' },
        { id: 'insurance', label: 'Insurance', navLabel: 'Insurance', icon: 'shield' },
        { id: 'store', label: 'Store', navLabel: 'Store', icon: 'inventory' },
      ],
    },
    {
      title: 'System',
      items: [
        { id: 'settings', label: 'Settings', navLabel: 'Settings', icon: 'settings' },
        { id: 'messages', label: 'Activity & Messages', navLabel: 'Activity & Messages', icon: 'message' },
      ],
    },
  ],
};

export const HERO_COPY = {
  admin: {
    eyebrow: 'Executive overview',
    title: 'Dentiplus keeps the whole clinic visible at a glance.',
    body: 'Track staff readiness, patient demand, collections, and system posture from a single elevated control surface.',
    actions: ['Review staff activity', 'Open settings'],
  },
  receptionist: {
    eyebrow: 'Front desk command',
    title: 'Keep arrivals, walk-ins, payments, and reminders moving cleanly.',
    body: "Today's schedule, walk-in registration, queue assignments, and payment coordination stay close without making the desk feel cramped.",
    actions: ['Register walk-in', 'Open payments'],
  },
  dentist: {
    eyebrow: 'Clinical focus',
    title: 'See your chair flow, treatment workload, and follow-up needs.',
    body: 'Dentiplus surfaces the schedule, active treatment context, and patient records in the same polished workspace.',
    actions: ['Open appointments', 'Review notes'],
  },
  accountant: {
    eyebrow: 'Financial visibility',
    title: 'Collections, expenses, claims, and cashflow sit in one readable plane.',
    body: 'Wide finance-first panels keep the numbers legible and operational instead of squeezing them into dashboard crumbs.',
    actions: ['Review collections', 'Export reports'],
  },
};

export function normalizeRole(rawRole) {
  if (!rawRole) {
    return 'admin';
  }

  const role = String(rawRole).trim().toLowerCase();

  if (role === 'ceo' || role === 'superadmin' || role === 'admin') {
    return 'admin';
  }

  if (role === 'accountant') {
    return 'accountant';
  }

  if (role === 'receptionist') {
    return 'receptionist';
  }

  if (role === 'dentist') {
    return 'dentist';
  }

  return 'admin';
}

export function createFallbackWorkspace(role) {
  const baseWidgets = {
    receptionist: [
      { label: 'Today Appointments', value: '24', trend: '+6 from yesterday', icon: 'calendar' },
      { label: 'Waiting Queue', value: '8', trend: '3 ready for chairing', icon: 'clock' },
      { label: 'New Registrations', value: '5', trend: '2 walk-ins today', icon: 'patients' },
      { label: 'Billing Handoffs', value: '4', trend: '1 urgent clearance', icon: 'receipt' },
    ],
    dentist: [
      { label: 'Today Schedule', value: '17', trend: '5 high-priority cases', icon: 'calendar' },
      { label: 'Active Queue', value: '6', trend: '2 procedures in progress', icon: 'clock' },
      { label: 'Follow-Ups Due', value: '9', trend: '4 requiring calls', icon: 'support' },
      { label: 'Draft Notes', value: '3', trend: '1 pending signature', icon: 'layers' },
    ],
    accountant: [
      { label: 'Collections Today', value: 'GHS 12,480', trend: 'Up 11%', icon: 'receipt' },
      { label: 'Insurance Claims', value: 'GHS 4,260', trend: '6 awaiting remittance', icon: 'shield' },
      { label: 'Expenses Logged', value: 'GHS 1,940', trend: '2 require review', icon: 'finance' },
      { label: 'Outstanding Balances', value: 'GHS 8,530', trend: '14 partially paid bills', icon: 'reports' },
    ],
    admin: [
      { label: 'Active Staff', value: '31', trend: '4 branches online', icon: 'briefcase' },
      { label: 'Today Patients', value: '42', trend: '7 check-ins pending', icon: 'patients' },
      { label: 'Collections Snapshot', value: 'GHS 16,740', trend: 'Across all desks', icon: 'trend' },
      { label: 'Alerts & Tasks', value: '6', trend: '2 policy items pending', icon: 'check-badge' },
    ],
  };

  const tables = {
    appointments: [
      { patient: 'Ama Glover', procedure: 'Scaling and polishing', clinician: 'Dr. Mensah', time: '09:30', status: 'Scheduled' },
      { patient: 'Kojo Biney', procedure: 'Root canal review', clinician: 'Dr. Arthur', time: '10:45', status: 'Waiting' },
      { patient: 'Linda Tetteh', procedure: 'Composite filling', clinician: 'Dr. Quaye', time: '12:15', status: 'Completed' },
    ],
    patients: [
      { folder: 'DP-1042', patient: 'Naana Ofori', phone: '+233 24 000 1111', visitReason: 'Tooth pain', status: 'Waiting' },
      { folder: 'DP-1043', patient: 'Yaw Ghartey', phone: '+233 55 000 2222', visitReason: 'Crown review', status: 'Completed' },
      { folder: 'DP-1044', patient: 'Priscilla Addo', phone: '+233 20 000 3333', visitReason: 'Consultation', status: 'Registered' },
    ],
    billing: [
      { bill: 'INV-2026-019', patient: 'Mabel Osei', amount: 'GHS 860.00', balance: 'GHS 120.00', status: 'Partially paid' },
      { bill: 'INV-2026-020', patient: 'Kelvin Nartey', amount: 'GHS 240.00', balance: 'GHS 0.00', status: 'Completed' },
      { bill: 'INV-2026-021', patient: 'Felicia Donkor', amount: 'GHS 1,450.00', balance: 'GHS 680.00', status: 'Pending' },
    ],
    messages: [
      { thread: 'Reception to Billing', latest: 'Patient file ready for payment clearance.', participants: '2 staff', unread: '1' },
      { thread: 'Clinical Handover', latest: 'X-ray review uploaded for afternoon chair.', participants: '4 staff', unread: '3' },
      { thread: 'Admin Brief', latest: 'Branch inventory count closes by 5pm.', participants: '5 staff', unread: '0' },
    ],
    reminders: [
      { patient: 'Naana Ofori', note: 'Confirm tomorrow review appointment.', due: 'Today 4:00 PM' },
      { patient: 'Yaw Ghartey', note: 'Follow up on partially paid billing file.', due: 'Today 5:30 PM' },
      { patient: 'Priscilla Addo', note: 'Send consultation readiness message.', due: 'Tomorrow 8:30 AM' },
    ],
    expenses: [
      { reference: 'EXP-26019', detail: 'Courier and dispatch', amount: 'GHS 120.00', period: 'Today' },
      { reference: 'EXP-26020', detail: 'Front desk supplies', amount: 'GHS 340.00', period: 'This week' },
      { reference: 'EXP-26021', detail: 'Branch refreshments', amount: 'GHS 85.00', period: 'Today' },
    ],
    store: [
      { item: 'Whitening kit', sku: 'STR-114', stock: '18 units', status: 'Ready' },
      { item: 'Children brush pack', sku: 'STR-128', stock: '9 units', status: 'Low stock' },
      { item: 'Mouthwash 500ml', sku: 'STR-211', stock: '26 units', status: 'Ready' },
    ],
    staff: [
      { name: 'Dorcas Armah', role: 'Receptionist', branch: 'Airport branch', status: 'On shift' },
      { name: 'Dr. Eric Tetteh', role: 'Dentist', branch: 'Main clinic', status: 'Booked' },
      { name: 'Rita Minta', role: 'Accountant', branch: 'Head office', status: 'Reviewing ledgers' },
    ],
  };

  return {
    widgets: baseWidgets[role] ?? baseWidgets.admin,
    tables,
  };
}
