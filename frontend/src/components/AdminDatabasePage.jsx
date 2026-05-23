import React from 'react';
import { PortalIcon } from './PortalIcon';

function clampPage(page, totalPages) {
  if (totalPages <= 0) {
    return 1;
  }

  return Math.min(Math.max(page, 1), totalPages);
}

function countStatuses(items, selector) {
  return items.reduce((accumulator, item) => {
    const key = selector(item);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
}

function createExplorerRows({ appointments, billing, expenses, insurance, patients, staff, store }) {
  return [
    ...patients.map((item) => ({
      source: 'Patients',
      module: 'patients',
      primary: item.patientName,
      secondary: item.folderId,
      meta: [item.phone, item.visitReason, item.oldFolderId].filter(Boolean).join(' | '),
      status: item.status,
    })),
    ...appointments.map((item) => ({
      source: 'Appointments',
      module: 'appointments',
      primary: item.patientName,
      secondary: `${item.dateLabel} ${item.time}`,
      meta: [item.dentistName, item.procedure, item.branch].filter(Boolean).join(' | '),
      status: item.status,
    })),
    ...billing.map((item) => ({
      source: 'Sales',
      module: 'sales',
      primary: item.bill,
      secondary: item.patientName,
      meta: [item.chargeSummary, item.amountLabel, item.balanceLabel].filter(Boolean).join(' | '),
      status: item.status,
    })),
    ...expenses.map((item) => ({
      source: 'Expenses',
      module: 'expenses',
      primary: item.reference,
      secondary: item.detail,
      meta: [item.category, item.amountLabel, item.expenseDateLabel].filter(Boolean).join(' | '),
      status: item.branch || 'Main clinic',
    })),
    ...insurance.map((item) => ({
      source: 'Insurance',
      module: 'insurance',
      primary: item.bill,
      secondary: item.patientName,
      meta: [item.insuranceType, item.company, item.coveredAmountLabel].filter(Boolean).join(' | '),
      status: item.status,
    })),
    ...store.map((item) => ({
      source: 'Store',
      module: 'store',
      primary: item.name,
      secondary: item.priceLabel,
      meta: [item.stockLabel, item.status, item.description].filter(Boolean).join(' | '),
      status: item.status,
    })),
    ...staff.map((item) => ({
      source: 'Staff',
      module: 'staff',
      primary: item.name,
      secondary: item.role,
      meta: [item.branch, item.status].filter(Boolean).join(' | '),
      status: item.status,
    })),
  ];
}

function matchesSearch(item, query) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }

  return [
    item.source,
    item.primary,
    item.secondary,
    item.meta,
    item.status,
  ].join(' ').toLowerCase().includes(trimmed);
}

export function AdminDatabasePage({
  appointments,
  billing,
  expenses,
  insurance,
  onNavigate,
  patients,
  staff,
  store,
}) {
  const [search, setSearch] = React.useState('');
  const [sourceFilter, setSourceFilter] = React.useState('all');
  const [rowsPerPage, setRowsPerPage] = React.useState(15);
  const [page, setPage] = React.useState(1);

  const patientItems = patients?.items ?? [];
  const appointmentItems = appointments?.items ?? [];
  const billingItems = billing?.items ?? [];
  const expenseItems = expenses?.items ?? [];
  const insuranceItems = insurance?.items ?? [];
  const storeItems = store?.items ?? [];
  const storeSales = store?.sales ?? [];
  const staffItems = staff?.items ?? [];

  const explorerRows = React.useMemo(() => createExplorerRows({
    appointments: appointmentItems,
    billing: billingItems,
    expenses: expenseItems,
    insurance: insuranceItems,
    patients: patientItems,
    staff: staffItems,
    store: storeItems,
  }), [appointmentItems, billingItems, expenseItems, insuranceItems, patientItems, staffItems, storeItems]);

  const filteredRows = explorerRows.filter((item) => {
    const matchesSource = sourceFilter === 'all' || item.module === sourceFilter;
    return matchesSource && matchesSearch(item, search);
  });

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const currentPage = clampPage(page, totalPages);
  const paginatedRows = filteredRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const patientStatuses = countStatuses(patientItems, (item) => String(item.status ?? 'Unknown'));
  const billingStatuses = countStatuses(billingItems, (item) => String(item.status ?? 'Unknown'));

  React.useEffect(() => {
    setPage(1);
  }, [search, sourceFilter, rowsPerPage]);

  React.useEffect(() => {
    setPage((current) => clampPage(current, totalPages));
  }, [totalPages]);

  return (
    <>
      <section className="module-card reception-toolbar-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Platform database</p>
            <h3>Admin control over the full platform</h3>
            <p>Use one searchable explorer to move across patients, appointments, sales, expenses, insurance, stock, and staff without a cramped split layout.</p>
          </div>
        </div>

        <div className="reception-filter-strip">
          <label className="field-block reception-inline-field reception-search-field">
            <span>Search platform data</span>
            <PortalIcon className="reception-search-icon" name="search" />
            <input onChange={(event) => setSearch(event.target.value)} placeholder="Patient, bill, item, staff, branch..." type="text" value={search} />
          </label>
          <label className="field-block reception-inline-field">
            <span>Module</span>
            <select onChange={(event) => setSourceFilter(event.target.value)} value={sourceFilter}>
              <option value="all">All modules</option>
              <option value="patients">Patients</option>
              <option value="appointments">Appointments</option>
              <option value="sales">Sales</option>
              <option value="expenses">Expenses</option>
              <option value="insurance">Insurance</option>
              <option value="store">Store</option>
              <option value="staff">Staff</option>
            </select>
          </label>
          <label className="field-block reception-inline-field">
            <span>Rows per page</span>
            <select onChange={(event) => setRowsPerPage(Number(event.target.value))} value={rowsPerPage}>
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={45}>45</option>
            </select>
          </label>
        </div>

        <div className="frontdesk-command-grid">
          <div className="frontdesk-highlight">
            <span>Patients</span>
            <strong>{patientItems.length}</strong>
            <p>{patientStatuses.Registered ?? patientStatuses.registered ?? 0} registered and visible in the database.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Open bills</span>
            <strong>{billingItems.length}</strong>
            <p>{billingStatuses.Pending ?? billingStatuses.pending ?? 0} still waiting for settlement.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Expenses</span>
            <strong>{expenseItems.length}</strong>
            <p>Editable operational spending records across the live expense log.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Store items</span>
            <strong>{storeItems.length}</strong>
            <p>{storeSales.length} recent store sale entries are ready for monitoring.</p>
          </div>
        </div>
      </section>

      <section className="module-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Control surfaces</p>
            <h3>Jump straight into management pages</h3>
          </div>
        </div>

        <div className="admin-control-grid">
          {[
            { id: 'sales', icon: 'trend', title: 'Sales desk', copy: 'Create bills, process payments, reprint receipts, and clear billing issues.' },
            { id: 'expenses', icon: 'finance', title: 'Expenses', copy: 'Log, edit, filter, and delete operational expense records.' },
            { id: 'store-monitor', icon: 'inventory', title: 'Store monitor', copy: 'Track daily store turnover, live-search sales, and watch stock pressure from one admin page.' },
            { id: 'patients', icon: 'patients', title: 'Patient database', copy: 'Correct registrations, clean duplicates, and review the full patient register.' },
            { id: 'appointments', icon: 'calendar', title: 'Appointments', copy: 'Search the booking ledger and create new clinic appointments.' },
            { id: 'insurance', icon: 'shield', title: 'Insurance', copy: 'Review, edit, and remove insurance claims and coverage details.' },
            { id: 'store', icon: 'inventory', title: 'Store', copy: 'Manage inventory and process over-the-counter sales from one screen.' },
            { id: 'staff', icon: 'briefcase', title: 'Users and staff', copy: 'Search the staff directory and keep branch visibility close at hand.' },
            { id: 'settings', icon: 'settings', title: 'Settings', copy: 'Update branding, shell media, and platform presentation controls.' },
          ].map((item) => (
            <article className="admin-control-card" key={item.id}>
              <div className="admin-control-card__icon">
                <PortalIcon className="workspace-submit-icon" name={item.icon} />
              </div>
              <div className="admin-control-card__copy">
                <h4>{item.title}</h4>
                <p>{item.copy}</p>
              </div>
              <button className="ghost-button secondary-action--compact workspace-inline-action" onClick={() => onNavigate(item.id)} type="button">
                Open
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="module-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Unified explorer</p>
            <h3>Cross-platform records</h3>
          </div>
          <span className="table-counter">
            {filteredRows.length} results | Page {currentPage} of {totalPages}
          </span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Module</th>
                <th>Primary</th>
                <th>Secondary</th>
                <th>Context</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.length ? paginatedRows.map((item, index) => (
                <tr key={`database-row-${item.module}-${index}`}>
                  <td>{item.source}</td>
                  <td>{item.primary}</td>
                  <td>{item.secondary || '-'}</td>
                  <td>{item.meta || '-'}</td>
                  <td>{item.status || '-'}</td>
                  <td>
                    <button className="clinical-workspace-button secondary-action--compact" onClick={() => onNavigate(item.module)} type="button">
                      Open module
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6">No platform records match the current search and module filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-pagination">
          <span className="table-counter">
            Showing {paginatedRows.length ? (currentPage - 1) * rowsPerPage + 1 : 0}
            {' - '}
            {Math.min(currentPage * rowsPerPage, filteredRows.length)} of {filteredRows.length}
          </span>
          <div className="reception-action-row">
            <button className="ghost-button secondary-action--compact" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">
              Previous
            </button>
            <button className="ghost-button secondary-action--compact" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} type="button">
              Next
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
