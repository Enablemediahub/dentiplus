import React from 'react';
import { PortalIcon } from './PortalIcon';

function formatCurrency(value) {
  return `GHS ${Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function clampPage(page, totalPages) {
  if (totalPages <= 0) {
    return 1;
  }

  return Math.min(Math.max(page, 1), totalPages);
}

function matchesProcedureSearch(item, query) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }

  return [
    item.name,
    item.charge,
    item.minCharge,
    item.maxCharge,
    formatCurrency(item.charge),
    formatCurrency(item.minCharge),
    formatCurrency(item.maxCharge),
  ].join(' ').toLowerCase().includes(trimmed);
}

function ProcedureModal({ deleting, feedback, form, isOpen, onChange, onClose, onDelete, onSubmit, saving }) {
  if (!isOpen || !form) {
    return null;
  }

  return (
    <div className="workspace-modal-backdrop" onClick={onClose} role="presentation">
      <div aria-modal="true" className="workspace-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="workspace-modal__header">
          <div className="workspace-patient-summary">
            <p className="eyebrow eyebrow--modal">Procedure catalog</p>
            <h3>{form.id ? 'Edit procedure' : 'Add procedure'}</h3>
          </div>
          <button className="ghost-button secondary-action--compact" onClick={onClose} type="button">Close</button>
        </div>

        <form className="workspace-modal__body" onSubmit={onSubmit}>
          <label className="field-block">
            <span>Procedure name</span>
            <input name="name" onChange={onChange} required type="text" value={form.name} />
          </label>

          <div className="form-grid">
            <label className="field-block">
              <span>Default charge</span>
              <input min="0" name="charge" onChange={onChange} required step="0.01" type="number" value={form.charge} />
            </label>

            <label className="field-block">
              <span>Minimum charge</span>
              <input min="0" name="min_charge" onChange={onChange} required step="0.01" type="number" value={form.min_charge} />
            </label>

            <label className="field-block">
              <span>Maximum charge</span>
              <input min="0.01" name="max_charge" onChange={onChange} required step="0.01" type="number" value={form.max_charge} />
            </label>
          </div>

          {feedback ? <p className="form-error">{feedback}</p> : null}

          <div className="workspace-card__actions workspace-card__actions--between">
            {form.id ? (
              <button className="danger-button workspace-inline-action" disabled={saving || deleting} onClick={onDelete} type="button">
                <PortalIcon className="workspace-submit-icon" name="close" />
                <span>{deleting ? 'Deleting...' : 'Delete procedure'}</span>
              </button>
            ) : <span />}
            <button className="primary-button workspace-inline-action" disabled={saving || deleting} type="submit">
              <PortalIcon className="workspace-submit-icon" name="plus-square" />
              <span>{saving ? 'Saving...' : form.id ? 'Save changes' : 'Add procedure'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminProcedureChargesPage({
  data,
  onCreateProcedureCatalog,
  onDeleteProcedureCatalog,
  onUpdateProcedureCatalog,
}) {
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [rowsPerPage, setRowsPerPage] = React.useState(15);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [procedureForm, setProcedureForm] = React.useState(null);
  const [feedback, setFeedback] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const procedures = data?.procedures ?? [];
  const metrics = data?.metrics ?? {};
  const filteredProcedures = procedures.filter((item) => matchesProcedureSearch(item, search));
  const totalPages = Math.max(1, Math.ceil(filteredProcedures.length / rowsPerPage));
  const currentPage = clampPage(page, totalPages);
  const paginatedProcedures = filteredProcedures.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const narrowRangeCount = procedures.filter((item) => Number(item.maxCharge ?? 0) === Number(item.minCharge ?? 0)).length;

  React.useEffect(() => {
    setPage(1);
  }, [search, rowsPerPage]);

  React.useEffect(() => {
    setPage((current) => clampPage(current, totalPages));
  }, [totalPages]);

  function openCreateModal() {
    setFeedback('');
    setProcedureForm({ id: 0, name: '', charge: '', min_charge: '', max_charge: '' });
    setIsModalOpen(true);
  }

  function openEditModal(item) {
    setFeedback('');
    setProcedureForm({
      id: item.id,
      name: item.name ?? '',
      charge: item.charge ?? '',
      min_charge: item.minCharge ?? '',
      max_charge: item.maxCharge ?? '',
    });
    setIsModalOpen(true);
  }

  function handleFormChange(event) {
    const { name, value } = event.target;
    setProcedureForm((current) => ({
      ...current,
      [name]: name === 'name' ? value : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!procedureForm) {
      return;
    }

    setSaving(true);
    setFeedback('');

    try {
      const payload = {
        ...procedureForm,
        charge: Number(procedureForm.charge),
        min_charge: Number(procedureForm.min_charge),
        max_charge: Number(procedureForm.max_charge),
      };

      if (procedureForm.id) {
        await onUpdateProcedureCatalog(payload);
      } else {
        await onCreateProcedureCatalog(payload);
      }

      setIsModalOpen(false);
      setProcedureForm(null);
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!procedureForm?.id) {
      return;
    }

    const confirmed = window.confirm('Delete this procedure from the catalog?');
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setFeedback('');

    try {
      await onDeleteProcedureCatalog({ id: procedureForm.id });
      setIsModalOpen(false);
      setProcedureForm(null);
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <section className="module-card reception-toolbar-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Procedure charges</p>
            <h3>Procedure catalog and charge controls</h3>
            <p>Manage the clinic&apos;s procedures, default charges, and approved charge ranges from the live `procedures` table so dentists always bill against the latest approved pricing.</p>
          </div>
          <div className="workspace-card__actions reception-action-row reception-action-row--end">
            <button className="primary-button workspace-inline-action" onClick={openCreateModal} type="button">
              <PortalIcon className="workspace-submit-icon" name="plus-square" />
              <span>Add procedure</span>
            </button>
          </div>
        </div>

        <div className="reception-filter-strip">
          <label className="field-block reception-inline-field reception-search-field">
            <span>Search procedures</span>
            <PortalIcon className="reception-search-icon" name="search" />
            <input onChange={(event) => setSearch(event.target.value)} placeholder="Procedure name or charge..." type="text" value={search} />
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
            <span>Catalog size</span>
            <strong>{metrics.totalProcedures ?? procedures.length}</strong>
            <p>Live procedures available for dentist billing and chair-side charge selection.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Average default charge</span>
            <strong>{formatCurrency(metrics.averageCharge ?? 0)}</strong>
            <p>A quick benchmark across the active procedure catalog.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Lowest to highest range</span>
            <strong>{formatCurrency(metrics.lowestEntryCharge ?? 0)} - {formatCurrency(metrics.highestEntryCharge ?? 0)}</strong>
            <p>The current charge guardrails available to the dentists.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Fixed-price procedures</span>
            <strong>{narrowRangeCount}</strong>
            <p>Procedures where the minimum and maximum charge are the same.</p>
          </div>
        </div>
      </section>

      <section className="module-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Procedure table</p>
            <h3>Approved pricing catalog</h3>
          </div>
          <span className="table-counter">
            {filteredProcedures.length} results | Page {currentPage} of {totalPages}
          </span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Procedure</th>
                <th>Default charge</th>
                <th>Min charge</th>
                <th>Max charge</th>
                <th>Range width</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProcedures.length ? paginatedProcedures.map((item) => (
                <tr key={`admin-procedure-${item.id}`}>
                  <td><strong>{item.name}</strong></td>
                  <td>{formatCurrency(item.charge)}</td>
                  <td>{formatCurrency(item.minCharge)}</td>
                  <td>{formatCurrency(item.maxCharge)}</td>
                  <td>{formatCurrency(Number(item.maxCharge ?? 0) - Number(item.minCharge ?? 0))}</td>
                  <td>
                    <button className="clinical-workspace-button secondary-action--compact" onClick={() => openEditModal(item)} type="button">
                      Edit procedure
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6">No procedures match the current search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-pagination">
          <span className="table-counter">
            Showing {paginatedProcedures.length ? (currentPage - 1) * rowsPerPage + 1 : 0}
            {' - '}
            {Math.min(currentPage * rowsPerPage, filteredProcedures.length)} of {filteredProcedures.length}
          </span>
          <div className="reception-action-row">
            <button className="ghost-button secondary-action--compact" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">Previous</button>
            <button className="ghost-button secondary-action--compact" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} type="button">Next</button>
          </div>
        </div>
      </section>

      <ProcedureModal
        deleting={deleting}
        feedback={feedback}
        form={procedureForm}
        isOpen={isModalOpen}
        onChange={handleFormChange}
        onClose={() => {
          setIsModalOpen(false);
          setProcedureForm(null);
          setFeedback('');
        }}
        onDelete={handleDelete}
        onSubmit={handleSubmit}
        saving={saving}
      />
    </>
  );
}
