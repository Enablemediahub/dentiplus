import React from 'react';
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

function matchesSearch(item, query) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }

  return [
    item.patientName,
    item.folderId,
    item.oldFolderId,
    item.phone,
    item.visitReason,
    item.dentistName,
    item.status,
  ]
    .join(' ')
    .toLowerCase()
    .includes(trimmed);
}

function clampPage(page, totalPages) {
  if (totalPages <= 0) {
    return 1;
  }

  return Math.min(Math.max(page, 1), totalPages);
}

function AssignPatientModal({ candidatePatients, dentists, isOpen, onClose, onSuccess, onSubmit }) {
  const [form, setForm] = React.useState({
    patient_id: '',
    dentist_id: '',
    assignment_visit_reason: '',
  });
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');
  const [patientSearch, setPatientSearch] = React.useState('');

  React.useEffect(() => {
    if (isOpen) {
      setForm({
        patient_id: '',
        dentist_id: '',
        assignment_visit_reason: '',
      });
      setPatientSearch('');
      setFeedback('');
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const filteredPatients = candidatePatients.filter((item) => matchesSearch(item, patientSearch));

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
        patient_id: Number(form.patient_id),
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
      <div className="workspace-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="workspace-modal__header">
          <div>
            <p className="eyebrow eyebrow--modal">Assign patient</p>
            <h3>Move a patient into the waiting queue</h3>
            <p>Search the registered list, pick the dentist, and capture the exact reason for visit before handoff.</p>
          </div>
          <button className="ghost-button secondary-action--compact" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <form className="workspace-modal__body" onSubmit={handleSubmit}>
          <label className="field-block reception-inline-field reception-search-field">
            <span>Search patients</span>
            <PortalIcon className="reception-search-icon" name="search" />
            <input
              onChange={(event) => setPatientSearch(event.target.value)}
              placeholder="Patient, folder, phone..."
              type="text"
              value={patientSearch}
            />
          </label>

          <div className="form-grid">
            <label className="field-block field-block--wide">
              <span>Patient</span>
              <select name="patient_id" onChange={updateField} required value={form.patient_id}>
                <option value="">Choose patient</option>
                {filteredPatients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.patientName}
                    {' | '}
                    {patient.folderId}
                    {' | '}
                    {formatPhoneNumber(patient.phone)}
                    {' | '}
                    {patient.status}
                    {' | '}
                    {patient.dentistName ?? 'Unassigned'}
                  </option>
                ))}
              </select>
            </label>

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
                placeholder="Pain, review, SNP..."
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

export function ReceptionAssignPatientPage({ assignments, onAssignPatient, onCompleteAssignment }) {
  const [search, setSearch] = React.useState('');
  const [successMessage, setSuccessMessage] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [savingId, setSavingId] = React.useState(null);
  const [rowsPerPage, setRowsPerPage] = React.useState(15);
  const [page, setPage] = React.useState(1);

  const queueItems = assignments?.items ?? [];
  const candidatePatients = assignments?.candidatePatients ?? [];
  const dentists = assignments?.dentists ?? [];
  const filteredQueueItems = queueItems.filter((item) => matchesSearch(item, search));
  const totalPages = Math.max(1, Math.ceil(filteredQueueItems.length / rowsPerPage));
  const currentPage = clampPage(page, totalPages);
  const paginatedQueueItems = filteredQueueItems.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  React.useEffect(() => {
    setPage(1);
  }, [search, rowsPerPage]);

  React.useEffect(() => {
    setPage((current) => clampPage(current, totalPages));
  }, [totalPages]);

  async function handleComplete(item) {
    setSavingId(item.assignmentId);

    try {
      const response = await onCompleteAssignment({
        assignment_id: item.assignmentId,
        patient_id: item.patientId,
      });
      setSuccessMessage(response?.message ?? 'Patient assignment updated successfully.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
      <section className="module-card reception-toolbar-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Patient assignment</p>
            <h3>Assign patients into the dentist queue</h3>
            <p>Based on the ASDental receptionist flow: choose a patient, assign a dentist, and keep the live waiting list tidy.</p>
          </div>
          <button className="primary-button" onClick={() => setIsModalOpen(true)} type="button">
            Assign patient
          </button>
        </div>

        <div className="reception-filter-strip">
          {successMessage ? <p className="form-success">{successMessage}</p> : null}
          <label className="field-block reception-inline-field reception-search-field">
            <span>Search waiting list</span>
            <PortalIcon className="reception-search-icon" name="search" />
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Patient, phone, reason, dentist..."
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

        <div className="frontdesk-command-grid">
          <div className="frontdesk-highlight">
            <span>Active queue</span>
            <strong>{queueItems.length}</strong>
            <p>Patients currently waiting for clinician handoff.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Available dentists</span>
            <strong>{dentists.length}</strong>
            <p>Branch-filtered dentist roster for the receptionist desk.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Search results</span>
            <strong>{filteredQueueItems.length}</strong>
            <p>Live filtered waiting queue entries.</p>
          </div>
        </div>
      </section>

      <div className="workspace-grid">
        <section className="module-card">
          <div className="panel-heading workspace-card__header">
            <div>
              <p className="eyebrow">Waiting list</p>
              <h3>Assigned patient queue</h3>
            </div>
            <span className="table-counter">
              {filteredQueueItems.length} results | Page {currentPage} of {totalPages}
            </span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Phone</th>
                  <th>Reason</th>
                  <th>Dentist</th>
                  <th>Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedQueueItems.length ? paginatedQueueItems.map((item) => (
                  <tr key={`assignment-${item.assignmentId}`}>
                    <td>
                      <strong>{item.patientName}</strong>
                      <span className="table-subcopy">{item.folderId}</span>
                    </td>
                    <td>{formatPhoneNumber(item.phone)}</td>
                    <td>{item.visitReason}</td>
                    <td>{item.dentistName}</td>
                    <td>{item.assignmentTime}</td>
                    <td>
                      <button
                        className="ghost-button secondary-action--compact"
                        disabled={savingId === item.assignmentId}
                        onClick={() => handleComplete(item)}
                        type="button"
                      >
                        {savingId === item.assignmentId ? 'Updating...' : 'Complete'}
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="6">No patients are currently in the waiting list.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="table-pagination">
            <span className="table-counter">
              Showing {paginatedQueueItems.length ? (currentPage - 1) * rowsPerPage + 1 : 0}
              {' - '}
              {Math.min(currentPage * rowsPerPage, filteredQueueItems.length)} of {filteredQueueItems.length}
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
      </div>

      <AssignPatientModal
        candidatePatients={candidatePatients}
        dentists={dentists}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(response) => setSuccessMessage(response?.message ?? 'Patient assigned successfully.')}
        onSubmit={onAssignPatient}
      />
    </>
  );
}
