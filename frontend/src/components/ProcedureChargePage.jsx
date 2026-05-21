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

function formatCurrency(value) {
  return `GHS ${Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function matchesSearch(item, query) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }

  return [
    item.patientName,
    item.folderId,
    item.phone,
    item.visitReason,
    item.assignmentTime,
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

function ChargeProcedureModal({ isOpen, onClose, onSubmit, patient, procedures }) {
  const [rows, setRows] = React.useState([{ procedure_id: '', amount: '', topup_notes: '' }]);
  const [notes, setNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    setRows([{ procedure_id: '', amount: '', topup_notes: '' }]);
    setNotes('');
    setFeedback('');
  }, [isOpen, patient]);

  if (!isOpen || !patient) {
    return null;
  }

  function updateRow(index, field, value) {
    setRows((current) => current.map((row, rowIndex) => (
      rowIndex === index ? { ...row, [field]: value } : row
    )));
  }

  function addRow() {
    setRows((current) => [...current, { procedure_id: '', amount: '', topup_notes: '' }]);
  }

  function removeRow(index) {
    setRows((current) => (current.length > 1 ? current.filter((_, rowIndex) => rowIndex !== index) : current));
  }

  const totalCharge = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setFeedback('');

    try {
      await onSubmit({
        patient_id: patient.patientId,
        assignment_id: patient.assignmentId,
        notes,
        procedures: rows.map((row) => ({
          procedure_id: Number(row.procedure_id),
          amount: Number(row.amount),
          topup_notes: row.topup_notes,
        })),
      });
      onClose();
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="workspace-modal-backdrop" onClick={onClose} role="presentation">
      <div aria-modal="true" className="workspace-modal workspace-modal--wide" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="workspace-modal__header">
          <div className="workspace-patient-summary">
            <p className="eyebrow eyebrow--modal">Procedure charges</p>
            <h3>Charge {patient.patientName}</h3>
            <div className="workspace-patient-meta">
              <span>{patient.folderId}</span>
              <span>{formatPhoneNumber(patient.phone)}</span>
              <span>{patient.visitReason}</span>
              <span>Total {formatCurrency(totalCharge)}</span>
            </div>
          </div>
          <button className="ghost-button secondary-action--compact" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <form className="workspace-modal__body" onSubmit={handleSubmit}>
          {rows.map((row, index) => {
            const procedure = procedures.find((item) => item.id === Number(row.procedure_id));

            return (
              <div className="workspace-form-section" key={`charge-row-${index}`}>
                <div className="panel-heading workspace-history-record__header">
                  <div>
                    <h4>Procedure line {index + 1}</h4>
                    <div className="workspace-record-meta">
                      {procedure ? <span className="workspace-edited-chip">Allowed range {formatCurrency(procedure.minCharge)} to {formatCurrency(procedure.maxCharge)}</span> : null}
                    </div>
                  </div>
                  {rows.length > 1 ? (
                    <button className="ghost-button secondary-action--compact workspace-inline-action" onClick={() => removeRow(index)} type="button">
                      Remove
                    </button>
                  ) : null}
                </div>

                <div className="form-grid">
                  <label className="field-block">
                    <span>Procedure</span>
                    <select required value={row.procedure_id} onChange={(event) => updateRow(index, 'procedure_id', event.target.value)}>
                      <option value="">Choose procedure</option>
                      {procedures.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} | {formatCurrency(item.minCharge)} - {formatCurrency(item.maxCharge)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field-block">
                    <span>Amount charged</span>
                    <input
                      min="0"
                      onChange={(event) => updateRow(index, 'amount', event.target.value)}
                      placeholder="0.00"
                      required
                      step="0.01"
                      type="number"
                      value={row.amount}
                    />
                  </label>

                  <label className="field-block field-block--wide">
                    <span>Top-up justification</span>
                    <textarea
                      onChange={(event) => updateRow(index, 'topup_notes', event.target.value)}
                      placeholder="Required if the amount goes above the approved range."
                      rows={3}
                      value={row.topup_notes}
                    />
                  </label>
                </div>
              </div>
            );
          })}

          <button className="ghost-button workspace-inline-action" onClick={addRow} type="button">
            <PortalIcon className="workspace-submit-icon" name="plus-square" />
            <span>Add another procedure</span>
          </button>

          <label className="field-block">
            <span>Clinical notes for reception</span>
            <textarea
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Materials used, special chair notes, or any handoff instruction for payment desk."
              rows={4}
              value={notes}
            />
          </label>

          {feedback ? <p className="form-error">{feedback}</p> : null}

          <div className="workspace-card__actions">
            <button className="primary-button" disabled={saving} type="submit">
              <PortalIcon className="workspace-submit-icon" name="receipt" />
              <span>{saving ? 'Submitting charges...' : 'Submit to payment desk'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ProcedureChargePage({ data, onCreateProcedureCharge }) {
  const [search, setSearch] = React.useState('');
  const [rowsPerPage, setRowsPerPage] = React.useState(15);
  const [page, setPage] = React.useState(1);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [selectedPatient, setSelectedPatient] = React.useState(null);

  const queueItems = data?.queueItems ?? [];
  const procedures = data?.procedures ?? [];
  const pendingItems = data?.pendingItems ?? [];
  const filteredQueueItems = queueItems.filter((item) => matchesSearch(item, search));
  const totalPages = Math.max(1, Math.ceil(filteredQueueItems.length / rowsPerPage));
  const currentPage = clampPage(page, totalPages);
  const paginatedQueue = filteredQueueItems.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const averageProcedureCharge = procedures.length
    ? procedures.reduce((sum, item) => sum + Number(item.charge ?? 0), 0) / procedures.length
    : 0;

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
            <p className="eyebrow">Procedure charges and billing</p>
            <h3>Dentist billing handoff</h3>
            <p>Build one grouped charge package per patient, validate amounts against approved ranges, and push the bill to reception for payment and thermal receipt printing.</p>
          </div>
        </div>

        <div className="reception-filter-strip">
          <label className="field-block reception-inline-field reception-search-field">
            <span>Search chair queue</span>
            <PortalIcon className="reception-search-icon" name="search" />
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Patient, folder, phone, reason..."
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
            <span>Chair queue</span>
            <strong>{queueItems.length}</strong>
            <p>Patients still waiting for the dentist to submit billable procedures.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Procedure catalog</span>
            <strong>{procedures.length}</strong>
            <p>Database-backed procedures with live charge ranges and defaults.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Pending handoffs</span>
            <strong>{pendingItems.length}</strong>
            <p>Submitted grouped charge packages still waiting at the payment desk.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Average default charge</span>
            <strong>{formatCurrency(averageProcedureCharge)}</strong>
            <p>A quick benchmark from the live procedure catalog while you prepare today’s charges.</p>
          </div>
        </div>
      </section>

      <section className="module-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Assigned patients</p>
            <h3>Ready to charge</h3>
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
                <th>Visit reason</th>
                <th>Time</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedQueue.length ? paginatedQueue.map((item) => (
                <tr key={`procedure-charge-${item.assignmentId}`}>
                  <td>
                    <strong>{item.patientName}</strong>
                    <span className="table-subcopy">{item.folderId}</span>
                  </td>
                  <td>{formatPhoneNumber(item.phone)}</td>
                  <td>{item.visitReason}</td>
                  <td>{item.assignmentTime}</td>
                  <td>
                    <button
                      className="clinical-workspace-button secondary-action--compact"
                      onClick={() => {
                        setSelectedPatient(item);
                        setIsModalOpen(true);
                      }}
                      type="button"
                    >
                      Charge procedures
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5">No assigned patients are waiting for procedure charges.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-pagination">
          <span className="table-counter">
            Showing {paginatedQueue.length ? (currentPage - 1) * rowsPerPage + 1 : 0}
            {' - '}
            {Math.min(currentPage * rowsPerPage, filteredQueueItems.length)} of {filteredQueueItems.length}
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

      <ChargeProcedureModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={onCreateProcedureCharge}
        patient={selectedPatient}
        procedures={procedures}
      />
    </>
  );
}
