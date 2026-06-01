import React from 'react';
import { AppointmentBookingModal, WalkinRegistrationModal } from './ReceptionDeskModals';
import { PortalIcon } from './PortalIcon';

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

function searchPatients(items, query) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return items;
  }

  return items.filter((item) =>
    [
      item.patientName,
      item.folderId,
      item.oldFolderId,
      item.phone,
      item.visitReason,
      item.status,
    ]
      .join(' ')
      .toLowerCase()
      .includes(trimmed)
  );
}

function clampPage(page, totalPages) {
  if (totalPages <= 0) {
    return 1;
  }

  return Math.min(Math.max(page, 1), totalPages);
}

function AssignFromWalkinModal({ dentists, isOpen, onClose, onSuccess, onSubmit, patient }) {
  const [form, setForm] = React.useState({
    dentist_id: '',
    assignment_visit_reason: '',
  });
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    setForm({
      dentist_id: '',
      assignment_visit_reason: patient?.visitReason ?? patient?.rawVisitReason ?? '',
    });
    setFeedback('');
  }, [isOpen, patient]);

  if (!isOpen || !patient) {
    return null;
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setFeedback('');

    try {
      const response = await onSubmit({
        patient_id: Number(patient.id),
        dentist_id: Number(form.dentist_id),
        assignment_visit_reason: form.assignment_visit_reason,
      });
      onSuccess?.(response);
      onClose();
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="workspace-modal-backdrop" onClick={onClose} role="presentation">
      <div
        aria-modal="true"
        className="workspace-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="workspace-modal__header">
          <div>
            <p className="eyebrow eyebrow--modal">Assign patient</p>
            <h3>Assign registered patient</h3>
            <p>{patient.patientName} will be moved into the live waiting list once you choose the dentist.</p>
          </div>
          <button className="ghost-button secondary-action--compact" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <form className="workspace-modal__body" onSubmit={handleSubmit}>
          <div className="workspace-form-section">
            <h4>Patient details</h4>
            <div className="form-grid">
              <label className="field-block">
                <span>Patient</span>
                <input readOnly type="text" value={patient.patientName} />
              </label>
              <label className="field-block">
                <span>Phone number</span>
                <input readOnly type="text" value={formatPhoneNumber(patient.phone)} />
              </label>
            </div>
          </div>

          <div className="form-grid">
            <label className="field-block">
              <span>Dentist</span>
              <select name="dentist_id" onChange={updateField} required value={form.dentist_id}>
                <option value="">Choose dentist</option>
                {dentists.map((dentist) => (
                  <option key={dentist.id} value={dentist.id}>
                    {dentist.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-block">
              <span>Reason for visit</span>
              <input
                name="assignment_visit_reason"
                onChange={updateField}
                placeholder="Pain, review, consultation..."
                required
                type="text"
                value={form.assignment_visit_reason}
              />
            </label>
          </div>

          {feedback ? <p className="form-error">{feedback}</p> : null}

          <div className="workspace-card__actions">
            <button className="primary-button" disabled={saving} type="submit">
              {saving ? 'Assigning patient...' : 'Assign patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ReceptionWalkinPage({
  appointments,
  assignments,
  onAssignPatient,
  onCreateAppointment,
  onRegisterPatient,
  patients,
}) {
  const [search, setSearch] = React.useState('');
  const [successMessage, setSuccessMessage] = React.useState('');
  const [isRegistrationOpen, setIsRegistrationOpen] = React.useState(false);
  const [isAppointmentOpen, setIsAppointmentOpen] = React.useState(false);
  const [isAssignOpen, setIsAssignOpen] = React.useState(false);
  const [appointmentPatient, setAppointmentPatient] = React.useState(null);
  const [assignPatient, setAssignPatient] = React.useState(null);
  const [rowsPerPage, setRowsPerPage] = React.useState(15);
  const [page, setPage] = React.useState(1);

  const allPatients = patients?.items ?? [];
  const filteredPatients = searchPatients(allPatients, search);
  const dentists = assignments?.dentists ?? appointments?.dentists ?? [];
  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / rowsPerPage));
  const currentPage = clampPage(page, totalPages);
  const paginatedPatients = filteredPatients.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  React.useEffect(() => {
    setPage(1);
  }, [search, rowsPerPage]);

  React.useEffect(() => {
    setPage((current) => clampPage(current, totalPages));
  }, [totalPages]);

  return (
    <>
      <section className="module-card reception-toolbar-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Walk-in registration</p>
            <h3>Registered patients and new intake from one desk</h3>
            <p>Use one searchable register for bookings and assignments, while new arrivals still come in through the walk-in intake modal.</p>
          </div>
          <div className="workspace-card__actions reception-action-row">
            <button
              className="ghost-button"
              onClick={() => {
                setAppointmentPatient(null);
                setIsAppointmentOpen(true);
              }}
              type="button"
            >
              Quick appointment
            </button>
            <button className="primary-button" onClick={() => setIsRegistrationOpen(true)} type="button">
              New walk-in registration
            </button>
          </div>
        </div>

        {successMessage ? <p className="form-success">{successMessage}</p> : null}

        <div className="reception-filter-strip">
          <label className="field-block reception-inline-field reception-search-field">
            <span>Search registered patients</span>
            <PortalIcon className="reception-search-icon" name="search" />
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Folder, old folder ID, patient, phone..."
              type="text"
              value={search}
            />
          </label>
          <label className="field-block reception-inline-field">
            <span>Rows per page</span>
            <select value={rowsPerPage} onChange={(event) => setRowsPerPage(Number(event.target.value))}>
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={45}>45</option>
            </select>
          </label>
        </div>
      </section>

      <section className="module-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Registered patients</p>
            <h3>Patient register</h3>
          </div>
          <span className="table-counter">
            {filteredPatients.length} results | Page {currentPage} of {totalPages}
          </span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Folder</th>
                <th>Patient</th>
                <th>Phone</th>
                <th>Visit reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPatients.length ? paginatedPatients.map((item) => (
                <tr key={`patient-${item.id}`}>
                  <td>
                    <strong>{item.folderId}</strong>
                    {item.oldFolderId ? <span className="table-subcopy">{item.oldFolderId}</span> : null}
                  </td>
                  <td>{item.patientName}</td>
                  <td>{formatPhoneNumber(item.phone)}</td>
                  <td>{item.visitReason}</td>
                  <td>{item.status}</td>
                  <td>
                    <div className="table-action-row">
                      <button
                        className="ghost-button secondary-action--compact"
                        onClick={() => {
                          setAppointmentPatient(item);
                          setIsAppointmentOpen(true);
                        }}
                        type="button"
                      >
                        Book appointment
                      </button>
                      <button
                        className="ghost-button secondary-action--compact"
                        onClick={() => {
                          setAssignPatient(item);
                          setIsAssignOpen(true);
                        }}
                        type="button"
                      >
                        Assign
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6">No registered patients match the current search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-pagination">
          <span className="table-counter">
            Showing {paginatedPatients.length ? (currentPage - 1) * rowsPerPage + 1 : 0}
            {' - '}
            {Math.min(currentPage * rowsPerPage, filteredPatients.length)} of {filteredPatients.length}
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

      <WalkinRegistrationModal
        isOpen={isRegistrationOpen}
        onClose={() => setIsRegistrationOpen(false)}
        onSuccess={(response) => setSuccessMessage(response?.message ?? 'Patient registered successfully.')}
        onSubmit={onRegisterPatient}
      />
      <AppointmentBookingModal
        dentists={appointments?.dentists ?? []}
        initialPatient={appointmentPatient}
        isOpen={isAppointmentOpen}
        onClose={() => setIsAppointmentOpen(false)}
        onSuccess={(response) => setSuccessMessage(response?.message ?? 'Appointment booked successfully.')}
        onSubmit={onCreateAppointment}
        patients={patients?.items ?? []}
      />
      <AssignFromWalkinModal
        dentists={dentists}
        isOpen={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        onSuccess={(response) => setSuccessMessage(response?.message ?? 'Patient assigned successfully.')}
        onSubmit={onAssignPatient}
        patient={assignPatient}
      />
    </>
  );
}
