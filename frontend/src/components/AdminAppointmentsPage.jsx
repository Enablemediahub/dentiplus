import React from 'react';
import { AppointmentBookingModal } from './ReceptionDeskModals';
import { PortalIcon } from './PortalIcon';

function clampPage(page, totalPages) {
  if (totalPages <= 0) {
    return 1;
  }

  return Math.min(Math.max(page, 1), totalPages);
}

function formatPhoneNumber(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) {
    return '-';
  }

  if (digits.startsWith('233') && digits.length === 12) {
    return `0${digits.slice(3)}`;
  }

  if (digits.length === 9) {
    return `0${digits}`;
  }

  if (digits.length === 10 && digits.startsWith('0')) {
    return digits;
  }

  return digits;
}

function matchesSearch(item, query) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }

  return [
    item.patientName,
    item.patient,
    item.procedure,
    item.dentistName,
    item.clinician,
    item.phone,
    item.dateLabel,
    item.time,
    item.status,
    item.branch,
  ].join(' ').toLowerCase().includes(trimmed);
}

export function AdminAppointmentsPage({ appointments, onCreateAppointment, patients }) {
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [dateFilter, setDateFilter] = React.useState('all');
  const [rowsPerPage, setRowsPerPage] = React.useState(15);
  const [page, setPage] = React.useState(1);
  const [modalOpen, setModalOpen] = React.useState(false);

  const items = appointments?.items ?? [];
  const dentists = appointments?.dentists ?? [];
  const patientItems = patients?.items ?? [];

  const filteredItems = items.filter((item) => {
    const normalizedStatus = String(item.status ?? '').toLowerCase().replace(/\s+/g, '_');
    const matchesStatus = statusFilter === 'all' || normalizedStatus === statusFilter;
    const matchesDate = dateFilter === 'all'
      || (dateFilter === 'today' && item.isToday)
      || (dateFilter === 'upcoming' && !item.isToday);

    return matchesStatus && matchesDate && matchesSearch(item, search);
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));
  const currentPage = clampPage(page, totalPages);
  const paginatedItems = filteredItems.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const statusCounts = items.reduce((accumulator, item) => {
    const key = String(item.status ?? '').toLowerCase();
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});

  React.useEffect(() => {
    setPage(1);
  }, [search, statusFilter, dateFilter, rowsPerPage]);

  React.useEffect(() => {
    setPage((current) => clampPage(current, totalPages));
  }, [totalPages]);

  return (
    <>
      <section className="module-card reception-toolbar-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Admin appointments</p>
            <h3>Clinic-wide appointment command</h3>
            <p>Search and filter the whole appointment ledger from one full-width surface, then book new visits without dropping into a split layout.</p>
          </div>
          <div className="workspace-card__actions reception-action-row reception-action-row--end">
            <button className="primary-button workspace-inline-action" onClick={() => setModalOpen(true)} type="button">
              <PortalIcon className="workspace-submit-icon" name="plus-square" />
              <span>New appointment</span>
            </button>
          </div>
        </div>

        <div className="reception-filter-strip">
          <label className="field-block reception-inline-field reception-search-field">
            <span>Search appointments</span>
            <PortalIcon className="reception-search-icon" name="search" />
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Patient, dentist, procedure, phone, branch..."
              type="text"
              value={search}
            />
          </label>
          <label className="field-block reception-inline-field">
            <span>Status</span>
            <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="all">All statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="waiting">Waiting</option>
            </select>
          </label>
          <label className="field-block reception-inline-field">
            <span>Date focus</span>
            <select onChange={(event) => setDateFilter(event.target.value)} value={dateFilter}>
              <option value="all">All dates</option>
              <option value="today">Today only</option>
              <option value="upcoming">Upcoming only</option>
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
            <span>Total appointments</span>
            <strong>{items.length}</strong>
            <p>Every branch and every clinician in the live appointment ledger.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Today</span>
            <strong>{items.filter((item) => item.isToday).length}</strong>
            <p>Same-day bookings that need immediate desk visibility.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Scheduled</span>
            <strong>{statusCounts.scheduled ?? 0}</strong>
            <p>Appointments still moving toward chair time.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Visible dentists</span>
            <strong>{dentists.length}</strong>
            <p>The current clinician roster available for booking.</p>
          </div>
        </div>
      </section>

      <section className="module-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Appointment table</p>
            <h3>All appointment records</h3>
          </div>
          <span className="table-counter">
            {filteredItems.length} results | Page {currentPage} of {totalPages}
          </span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Patient</th>
                <th>Phone</th>
                <th>Dentist</th>
                <th>Procedure</th>
                <th>Status</th>
                <th>Branch</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length ? paginatedItems.map((item) => (
                <tr key={`admin-appointment-${item.id}`}>
                  <td>{item.dateLabel}</td>
                  <td>{item.time}</td>
                  <td>{item.patientName}</td>
                  <td>{formatPhoneNumber(item.phone)}</td>
                  <td>{item.dentistName}</td>
                  <td>{item.procedure}</td>
                  <td>{item.status}</td>
                  <td>{item.branch || 'Main clinic'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="8">No appointment records match the current search and filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-pagination">
          <span className="table-counter">
            Showing {paginatedItems.length ? (currentPage - 1) * rowsPerPage + 1 : 0}
            {' - '}
            {Math.min(currentPage * rowsPerPage, filteredItems.length)} of {filteredItems.length}
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

      <AppointmentBookingModal
        dentists={dentists}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={onCreateAppointment}
        patients={patientItems}
      />
    </>
  );
}
