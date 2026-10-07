import React from 'react';
import { DateInputField } from './DateInputField';
import { PortalIcon } from './PortalIcon';
import { displayDateToIso, isoToDisplayDate, normalizeDateEntry } from '../lib/dateInput';

function clampPage(page, totalPages) {
  if (totalPages <= 0) {
    return 1;
  }

  return Math.min(Math.max(page, 1), totalPages);
}

function normalizeLeadingUppercase(value) {
  return String(value ?? '').replace(/^([a-z])/, (match) => match.toUpperCase());
}

function matchesSearch(item, query) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }

  return [
    item.bill,
    item.patientName,
    item.insuranceType,
    item.company,
    item.insuranceNumber,
    item.insuranceCategory,
    item.status,
    item.billTypeLabel,
  ].join(' ').toLowerCase().includes(trimmed);
}

function InsuranceCatalogModal({ feedback, isEditMode, isOpen, name, onChange, onClose, onSubmit, saving }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="workspace-modal-backdrop" onClick={onClose} role="presentation">
      <div aria-modal="true" className="workspace-modal workspace-modal--wide" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="workspace-modal__header">
          <div className="workspace-patient-summary">
            <p className="eyebrow eyebrow--modal">Insurance catalog</p>
            <h3>{isEditMode ? 'Edit insurance name' : 'Add a new insurance name'}</h3>
            <div className="workspace-patient-meta">
              <span>Available on receptionist payment forms after save</span>
            </div>
          </div>
          <button className="ghost-button secondary-action--compact" onClick={onClose} type="button">Close</button>
        </div>
        <form className="workspace-modal__body" onSubmit={onSubmit}>
          <div className="form-grid">
            <label className="field-block field-block--wide">
              <span>Insurance name</span>
              <input autoFocus name="name" onChange={onChange} placeholder="e.g. NHIS, Vanguard, Enterprise Life" required type="text" value={name} />
            </label>
          </div>
          {feedback ? <p className="form-error">{feedback}</p> : null}
          <div className="workspace-card__actions">
            <button className="primary-button workspace-inline-action" disabled={saving} type="submit">
              <PortalIcon className="workspace-submit-icon" name="plus-square" />
              <span>{saving ? 'Saving...' : (isEditMode ? 'Save changes' : 'Add insurance name')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InsuranceModal({ deleting, feedback, form, isOpen, onChange, onClose, onDelete, onSubmit, saving }) {
  if (!isOpen || !form) {
    return null;
  }

  return (
    <div className="workspace-modal-backdrop" onClick={onClose} role="presentation">
      <div aria-modal="true" className="workspace-modal workspace-modal--wide" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="workspace-modal__header">
          <div className="workspace-patient-summary">
            <p className="eyebrow eyebrow--modal">Insurance record</p>
            <h3>{form.patientName}</h3>
            <div className="workspace-patient-meta">
              <span>{form.bill}</span>
              <span>{form.status}</span>
            </div>
          </div>
          <button className="ghost-button secondary-action--compact" onClick={onClose} type="button">Close</button>
        </div>
        <form className="workspace-modal__body" onSubmit={onSubmit}>
          <div className="form-grid">
            <label className="field-block">
              <span>Insurance type</span>
              <input name="insurance_type" onChange={onChange} required type="text" value={form.insurance_type} />
            </label>
            <label className="field-block">
              <span>Company</span>
              <input name="company" onChange={onChange} type="text" value={form.company} />
            </label>
            <label className="field-block">
              <span>Insurance number</span>
              <input name="insurance_number" onChange={onChange} required type="text" value={form.insurance_number} />
            </label>
            <label className="field-block">
              <span>Category</span>
              <input name="insurance_category" onChange={onChange} type="text" value={form.insurance_category} />
            </label>
            <label className="field-block">
              <span>Expiry date</span>
              <DateInputField name="expiry_date" onChange={onChange} placeholder="dd/mm/yyyy" required value={form.expiry_date} />
            </label>
            <label className="field-block">
              <span>Covered amount</span>
              <input min="0" name="insurance_covered_amount" onChange={onChange} required step="0.01" type="number" value={form.insurance_covered_amount} />
            </label>
          </div>
          {feedback ? <p className="form-error">{feedback}</p> : null}
          <div className="workspace-card__actions workspace-card__actions--between">
            <button className="danger-button workspace-inline-action" disabled={saving || deleting} onClick={onDelete} type="button">
              <PortalIcon className="workspace-submit-icon" name="close" />
              <span>{deleting ? 'Deleting...' : 'Delete Record'}</span>
            </button>
            <button className="primary-button workspace-inline-action" disabled={saving || deleting} type="submit">
              <PortalIcon className="workspace-submit-icon" name="plus-square" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ReceptionInsurancePage({ data, onCreateInsuranceName, onDeleteInsurance, onUpdateInsurance, onDeleteInsuranceName, onUpdateInsuranceName }) {
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [page, setPage] = React.useState(1);
  const [rowsPerPage, setRowsPerPage] = React.useState(15);
  const [catalogOpen, setCatalogOpen] = React.useState(false);
  const [catalogName, setCatalogName] = React.useState('');
  const [catalogFeedback, setCatalogFeedback] = React.useState('');
  const [catalogSaving, setCatalogSaving] = React.useState(false);
  const [catalogEditItem, setCatalogEditItem] = React.useState(null);
  const [activeRecord, setActiveRecord] = React.useState(null);
  const [form, setForm] = React.useState(null);
  const [feedback, setFeedback] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const items = data?.items ?? [];
  const catalogItems = data?.catalog ?? [];
  const summary = data?.summary ?? {};
  const filteredItems = items.filter((item) => {
    const statusMatch = statusFilter === 'all' || String(item.status ?? '').toLowerCase().replace(/\s+/g, '_') === statusFilter;
    const typeMatch = typeFilter === 'all' || String(item.billTypeLabel ?? '').toLowerCase().includes(typeFilter === 'frontdesk_fees' ? 'consultation' : 'procedure');
    return statusMatch && typeMatch && matchesSearch(item, search);
  });
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));
  const currentPage = clampPage(page, totalPages);
  const paginatedItems = filteredItems.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  React.useEffect(() => {
    setPage(1);
  }, [search, statusFilter, typeFilter, rowsPerPage]);

  React.useEffect(() => {
    setPage((current) => clampPage(current, totalPages));
  }, [totalPages]);

  function openCatalogModal(item = null) {
    setCatalogEditItem(item);
    setCatalogName(item?.name ?? '');
    setCatalogFeedback('');
    setCatalogOpen(true);
  }

  async function handleCatalogSubmit(event) {
    event.preventDefault();
    if (!onCreateInsuranceName) {
      return;
    }

    setCatalogSaving(true);
    setCatalogFeedback('');
    try {
      if (catalogEditItem?.id && onUpdateInsuranceName) {
        await onUpdateInsuranceName({ id: catalogEditItem.id, name: catalogName });
      } else {
        await onCreateInsuranceName({ name: catalogName });
      }
      setCatalogOpen(false);
      setCatalogName('');
      setCatalogEditItem(null);
    } catch (error) {
      setCatalogFeedback(error.message);
    } finally {
      setCatalogSaving(false);
    }
  }

  async function handleDeleteCatalogItem(item) {
    if (!item?.id || !onDeleteInsuranceName) {
      return;
    }

    const confirmed = window.confirm(`Delete insurance name "${item.name}"?`);
    if (!confirmed) {
      return;
    }

    setCatalogSaving(true);
    setCatalogFeedback('');
    try {
      await onDeleteInsuranceName({ id: item.id });
      if (catalogEditItem?.id === item.id) {
        setCatalogOpen(false);
        setCatalogEditItem(null);
        setCatalogName('');
      }
    } catch (error) {
      setCatalogFeedback(error.message);
    } finally {
      setCatalogSaving(false);
    }
  }

  function openRecord(item) {
    setActiveRecord(item);
    setFeedback('');
    setForm({
      id: item.id,
      patientName: item.patientName,
      bill: item.bill,
      status: item.status,
      insurance_type: item.insuranceType ?? '',
      company: item.company ?? '',
      insurance_number: item.insuranceNumber ?? '',
      insurance_category: item.insuranceCategory ?? '',
      expiry_date: isoToDisplayDate(item.expiryDate ?? ''),
      insurance_covered_amount: item.coveredAmount ?? '',
    });
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: name === 'expiry_date'
        ? normalizeDateEntry(value)
        : name === 'insurance_covered_amount'
          ? value
          : normalizeLeadingUppercase(value),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form) {
      return;
    }

    setSaving(true);
    setFeedback('');
    try {
      const expiryDate = displayDateToIso(form.expiry_date);
      if (!expiryDate) {
        throw new Error('Expiry date must use the dd/mm/yyyy format.');
      }

      await onUpdateInsurance({
        ...form,
        expiry_date: expiryDate,
      });
      setActiveRecord(null);
      setForm(null);
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!form?.id) {
      return;
    }

    const confirmed = window.confirm('Delete this insurance record?');
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setFeedback('');
    try {
      await onDeleteInsurance({ id: form.id });
      setActiveRecord(null);
      setForm(null);
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <section className="stats-grid insurance-stats-grid">
        {[
          {
            label: 'Insurance Records',
            value: summary.totalRecords ?? items.length,
            trend: 'All insurance-linked settlement records currently in view.',
            icon: 'shield',
          },
          {
            label: 'Covered Amount',
            value: summary.totalCoveredLabel ?? 'GHS 0.00',
            trend: 'Total amount being handled through insurance coverage.',
            icon: 'receipt',
          },
          {
            label: 'Open Balance',
            value: summary.openBalanceLabel ?? 'GHS 0.00',
            trend: 'Outstanding bill balance still remaining after insurance entries.',
            icon: 'finance',
          },
          {
            label: 'Completed vs Pending',
            value: `${summary.completedCount ?? 0} / ${summary.pendingCount ?? 0}`,
            trend: 'Completed insurance settlements compared with open ones.',
            icon: 'reports',
          },
        ].map((item) => (
          <article className="stat-card insurance-stat-card" key={item.label}>
            <div className="stat-card-icon">
              <PortalIcon className="nav-icon stat-card-icon-svg" name={item.icon} />
            </div>
            <span className="stat-card__label">{item.label}</span>
            <h3>{item.value}</h3>
            <p className="stat-card__trend">{item.trend}</p>
          </article>
        ))}
      </section>

      <section className="module-card reception-toolbar-card insurance-action-panel">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Action panel</p>
            <h3>Insurance names</h3>
            <p>Add a new insurance name here so it becomes available on the reception payment screen for registration, consultation, and procedure billing.</p>
          </div>
          <button className="primary-button workspace-inline-action" onClick={openCatalogModal} type="button">
            <PortalIcon className="workspace-submit-icon" name="plus-square" />
            <span>Add insurance name</span>
          </button>
        </div>
        <div className="reception-filter-strip" style={{ marginTop: '10px' }}>
          <div className="field-block field-block--wide">
            <span>Current insurance names</span>
            <div className="reception-action-row" style={{ flexWrap: 'wrap' }}>
              {catalogItems.length ? catalogItems.map((item) => (
                <span className="workspace-edited-chip" key={`catalog-${item.id}`}>
                  <span>{item.name}</span>
                  <button className="ghost-button secondary-action--compact" onClick={() => openCatalogModal(item)} type="button">Edit</button>
                  <button className="ghost-button secondary-action--compact destructive-button" onClick={() => handleDeleteCatalogItem(item)} type="button">Delete</button>
                </span>
              )) : <span className="table-subcopy">No insurance names saved yet.</span>}
            </div>
          </div>
        </div>
      </section>

      <section className="module-card reception-toolbar-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Insurance desk</p>
            <h3>Insurance records</h3>
            <p>Work through the insurance ledger in one column with live search, filters, and edit or delete access for each claim record.</p>
          </div>
        </div>
        <div className="reception-filter-strip">
          <label className="field-block reception-inline-field reception-search-field">
            <span>Search insurance</span>
            <PortalIcon className="reception-search-icon" name="search" />
            <input onChange={(event) => setSearch(event.target.value)} placeholder="Patient, bill, insurance type, company..." type="text" value={search} />
          </label>
          <label className="field-block reception-inline-field">
            <span>Status</span>
            <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="partially_paid">Partially paid</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label className="field-block reception-inline-field">
            <span>Bill type</span>
            <select onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}>
              <option value="all">All bill types</option>
              <option value="procedure_charge">Procedure charges</option>
              <option value="frontdesk_fees">Consultation / registration</option>
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
      </section>

      <section className="module-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Insurance table</p>
            <h3>All insurance records</h3>
          </div>
          <span className="table-counter">
            {filteredItems.length} results | Page {currentPage} of {totalPages}
          </span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Bill</th>
                <th>Patient</th>
                <th>Insurance</th>
                <th>Covered</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length ? paginatedItems.map((item) => (
                <tr key={`insurance-${item.id}`}>
                  <td>
                    <strong>{item.bill}</strong>
                    <span className="table-subcopy">{item.billTypeLabel}</span>
                  </td>
                  <td>{item.patientName}</td>
                  <td>
                    <strong>{item.insuranceType}</strong>
                    <span className="table-subcopy">{item.company || item.insuranceNumber}</span>
                  </td>
                  <td>{item.coveredAmountLabel}</td>
                  <td>{item.balanceLabel}</td>
                  <td>{item.status}</td>
                  <td>
                    <button className="clinical-workspace-button secondary-action--compact" onClick={() => openRecord(item)} type="button">
                      Edit record
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="7">No insurance records match the current search and filters.</td>
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
            <button className="ghost-button secondary-action--compact" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">Previous</button>
            <button className="ghost-button secondary-action--compact" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} type="button">Next</button>
          </div>
        </div>
      </section>

      <InsuranceModal
        deleting={deleting}
        feedback={feedback}
        form={form}
        isOpen={Boolean(activeRecord && form)}
        onChange={handleChange}
        onClose={() => {
          setActiveRecord(null);
          setForm(null);
          setFeedback('');
        }}
        onDelete={handleDelete}
        onSubmit={handleSubmit}
        saving={saving}
      />

      <InsuranceCatalogModal
        feedback={catalogFeedback}
        isEditMode={Boolean(catalogEditItem)}
        isOpen={catalogOpen}
        name={catalogName}
        onChange={(event) => setCatalogName(event.target.value)}
        onClose={() => {
          setCatalogOpen(false);
          setCatalogFeedback('');
          setCatalogEditItem(null);
          setCatalogName('');
        }}
        onSubmit={handleCatalogSubmit}
        saving={catalogSaving}
      />
    </>
  );
}
