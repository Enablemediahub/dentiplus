import React from 'react';

function formatCountLabel(value, singular, plural) {
  const count = Number(value ?? 0);
  return `${count} ${count === 1 ? singular : plural}`;
}

function clampPage(page, totalPages) {
  if (totalPages <= 0) {
    return 1;
  }

  return Math.min(Math.max(page, 1), totalPages);
}

function PaginatedTable({ title, eyebrow, columns, rows }) {
  const [page, setPage] = React.useState(1);
  const rowsPerPage = 15;
  const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const currentPage = clampPage(page, totalPages);
  const paginatedRows = rows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  React.useEffect(() => {
    setPage((current) => clampPage(current, totalPages));
  }, [totalPages]);

  return (
    <section className="module-card">
      <div className="panel-heading workspace-card__header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
        <span className="table-counter">
          {rows.length} results | Page {currentPage} of {totalPages}
        </span>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.length ? paginatedRows.map((row, index) => (
              <tr key={`${title}-${currentPage}-${index}`}>
                {columns.map((column) => (
                  <td key={column.key}>{row[column.key] ?? '-'}</td>
                ))}
              </tr>
            )) : (
              <tr>
                <td colSpan={columns.length}>No records are available right now.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="table-pagination">
        <span className="table-counter">
          Showing {paginatedRows.length ? (currentPage - 1) * rowsPerPage + 1 : 0}
          {' - '}
          {Math.min(currentPage * rowsPerPage, rows.length)} of {rows.length}
        </span>
        <div className="reception-action-row">
          <button
            className="ghost-button secondary-action--compact"
            disabled={currentPage <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            type="button"
          >
            Previous
          </button>
          <button
            className="ghost-button secondary-action--compact"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            type="button"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

export function DentistDashboard({ dashboard, appointments, assignments, procedureCharges }) {
  const metrics = dashboard?.metrics ?? {};
  const queueItems = assignments?.items ?? [];
  const appointmentRows = appointments?.todayItems ?? [];
  const pendingChargeRows = procedureCharges?.pendingItems ?? [];

  const statItems = [
    {
      label: 'Today Appointments',
      value: formatCountLabel(metrics.today_appointments ?? appointmentRows.length, 'appointment', 'appointments'),
      note: 'Pulled from the dentist schedule for today.',
    },
    {
      label: 'Assigned Patients',
      value: formatCountLabel(metrics.waiting_patients ?? queueItems.length, 'patient', 'patients'),
      note: 'Patients currently tied to this dentist.',
    },
    {
      label: 'Chair Queue',
      value: formatCountLabel(metrics.active_assignments ?? queueItems.length, 'patient', 'patients'),
      note: 'Waiting patients still in the live queue.',
    },
    {
      label: 'Pending Charges',
      value: formatCountLabel(metrics.open_bills ?? pendingChargeRows.length, 'charge', 'charges'),
      note: 'Charges still awaiting payment closure.',
    },
  ];

  return (
    <>
      <section className="module-card reception-toolbar-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Clinical overview</p>
            <h3>Dentist dashboard</h3>
            <p>See your assigned patients, live queue, and appointments without finance widgets crowding the clinical view.</p>
          </div>
        </div>

        <div className="frontdesk-command-grid">
          {statItems.map((item) => (
            <div className="frontdesk-highlight" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.note}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="workspace-grid workspace-grid--split">
        <PaginatedTable
          columns={[
            { key: 'patientName', label: 'Patient' },
            { key: 'folderId', label: 'Folder' },
            { key: 'visitReason', label: 'Visit reason' },
            { key: 'assignmentTime', label: 'Queue time' },
          ]}
          eyebrow="Assigned queue"
          rows={queueItems}
          title="Patients assigned and in queue"
        />

        <PaginatedTable
          columns={[
            { key: 'patientName', label: 'Patient' },
            { key: 'procedure', label: 'Appointment' },
            { key: 'time', label: 'Time' },
            { key: 'status', label: 'Status' },
          ]}
          eyebrow="Today schedule"
          rows={appointmentRows}
          title="Dentist appointments"
        />
      </div>
    </>
  );
}
