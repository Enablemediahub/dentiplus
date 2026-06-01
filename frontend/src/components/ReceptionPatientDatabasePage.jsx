import React from 'react';
import { DateInputField } from './DateInputField';
import { PortalIcon } from './PortalIcon';
import { displayDateToIso, isoToDisplayDate, normalizeDateEntry } from '../lib/dateInput';

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

function clampPage(page, totalPages) {
  if (totalPages <= 0) {
    return 1;
  }

  return Math.min(Math.max(page, 1), totalPages);
}

function normalizeLeadingUppercase(value) {
  return String(value ?? '').replace(/^([a-z])/, (match) => match.toUpperCase());
}

function matchesSearch(patient, query) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }

  return [
    patient.patientName,
    patient.folderId,
    patient.oldFolderId,
    patient.phone,
    patient.email,
    patient.gender,
    patient.address,
    patient.visitReason,
    patient.status,
  ]
    .join(' ')
    .toLowerCase()
    .includes(trimmed);
}

function matchesFilters(patient, statusFilter, typeFilter) {
  const normalizedStatus = String(patient.status ?? '').toLowerCase();
  const matchesStatus = statusFilter === 'all' || normalizedStatus === statusFilter;
  const patientType = patient.isWalkin ? 'walkin' : 'registered';
  const matchesType = typeFilter === 'all' || patientType === typeFilter;
  return matchesStatus && matchesType;
}

function PatientRecordModal({
  feedback,
  isOpen,
  onChange,
  onClose,
  onDelete,
  onSubmit,
  patient,
  saving,
  deleting,
}) {
  if (!isOpen || !patient) {
    return null;
  }

  return (
    <div className="workspace-modal-backdrop" onClick={onClose} role="presentation">
      <div aria-modal="true" className="workspace-modal workspace-modal--wide" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="workspace-modal__header">
          <div className="workspace-patient-summary">
            <p className="eyebrow eyebrow--modal">Patient registration record</p>
            <h3>{patient.patientName}</h3>
            <div className="workspace-patient-meta">
              <span>{patient.folderId}</span>
              <span>{formatPhoneNumber(patient.phone)}</span>
              <span>{patient.status}</span>
            </div>
          </div>
          <button className="ghost-button secondary-action--compact" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <form className="workspace-modal__body" onSubmit={onSubmit}>
          <div className="workspace-form-section">
            <h4>Registration details</h4>
            <div className="form-grid">
              <label className="field-block">
                <span>First name</span>
                <input name="first_name" onChange={onChange} required type="text" value={patient.first_name} />
              </label>
              <label className="field-block">
                <span>Other names</span>
                <input name="other_names" onChange={onChange} type="text" value={patient.other_names} />
              </label>
              <label className="field-block">
                <span>Last name</span>
                <input name="last_name" onChange={onChange} required type="text" value={patient.last_name} />
              </label>
              <label className="field-block">
                <span>Phone</span>
                <input name="phone" onChange={onChange} required type="text" value={patient.phone} />
              </label>
              <label className="field-block">
                <span>Email</span>
                <input name="email" onChange={onChange} type="email" value={patient.email} />
              </label>
              <label className="field-block">
                <span>Birth date</span>
                <DateInputField name="birth_date" onChange={onChange} placeholder="dd/mm/yyyy" required value={patient.birth_date} />
              </label>
              <label className="field-block">
                <span>Gender</span>
                <select name="gender" onChange={onChange} value={patient.gender}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="field-block">
                <span>Status</span>
                <select name="status" onChange={onChange} value={patient.status}>
                  <option value="waiting">Waiting</option>
                  <option value="assigned">Assigned</option>
                  <option value="registered">Registered</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
              <label className="field-block field-block--wide">
                <span>Address</span>
                <textarea name="address" onChange={onChange} required rows={3} value={patient.address} />
              </label>
              <label className="field-block">
                <span>Old folder ID</span>
                <input name="old_folder_id" onChange={onChange} type="text" value={patient.old_folder_id} />
              </label>
              <label className="field-block">
                <span>Visit reason</span>
                <input name="visit_reason" onChange={onChange} type="text" value={patient.visit_reason} />
              </label>
            </div>
          </div>

          {feedback ? <p className="form-error">{feedback}</p> : null}

          <div className="workspace-card__actions workspace-card__actions--between">
            <button className="danger-button workspace-inline-action" disabled={deleting || saving} onClick={onDelete} type="button">
              <PortalIcon className="workspace-submit-icon" name="close" />
              <span>{deleting ? 'Deleting...' : 'Delete Duplicate Entry'}</span>
            </button>
            <button className="primary-button workspace-inline-action" disabled={saving || deleting} type="submit">
              <PortalIcon className="workspace-submit-icon" name="plus-square" />
              <span>{saving ? 'Saving changes...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ReceptionPatientDatabasePage({
  onDeletePatient,
  onUpdatePatient,
  patients,
}) {
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [rowsPerPage, setRowsPerPage] = React.useState(15);
  const [page, setPage] = React.useState(1);
  const [activePatient, setActivePatient] = React.useState(null);
  const [form, setForm] = React.useState(null);
  const [feedback, setFeedback] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const items = patients?.items ?? [];
  const filteredItems = items.filter((item) => matchesSearch(item, search) && matchesFilters(item, statusFilter, typeFilter));
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));
  const currentPage = clampPage(page, totalPages);
  const paginatedItems = filteredItems.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  React.useEffect(() => {
    setPage(1);
  }, [search, statusFilter, typeFilter, rowsPerPage]);

  React.useEffect(() => {
    setPage((current) => clampPage(current, totalPages));
  }, [totalPages]);

  function openRecord(patient) {
    setActivePatient(patient);
    setFeedback('');
    setForm({
      id: patient.id,
      first_name: patient.firstName ?? '',
      other_names: patient.otherNames ?? '',
      last_name: patient.lastName ?? '',
      phone: patient.phone ?? '',
      email: patient.email ?? '',
      birth_date: isoToDisplayDate(patient.birthDate ?? ''),
      gender: String(patient.gender ?? 'male').toLowerCase() || 'male',
      address: patient.address ?? '',
      old_folder_id: patient.oldFolderId ?? '',
      visit_reason: patient.rawVisitReason ?? patient.visitReason ?? '',
      status: String(patient.status ?? 'Registered').toLowerCase(),
    });
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: name === 'birth_date'
        ? normalizeDateEntry(value)
        : ['gender', 'status', 'phone', 'email'].includes(name)
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
      const birthDate = displayDateToIso(form.birth_date);
      if (!birthDate) {
        throw new Error('Birth date must use the dd/mm/yyyy format.');
      }

      const response = await onUpdatePatient({
        ...form,
        birth_date: birthDate,
      });
      setActivePatient(response?.item ?? null);
      setForm((current) => current ? ({
        ...current,
        first_name: response?.item?.firstName ?? current.first_name,
        other_names: response?.item?.otherNames ?? current.other_names,
        last_name: response?.item?.lastName ?? current.last_name,
        phone: response?.item?.phone ?? current.phone,
        email: response?.item?.email ?? current.email,
        birth_date: isoToDisplayDate(response?.item?.birthDate ?? current.birth_date),
        gender: String(response?.item?.gender ?? current.gender).toLowerCase(),
        address: response?.item?.address ?? current.address,
        old_folder_id: response?.item?.oldFolderId ?? current.old_folder_id,
        visit_reason: response?.item?.rawVisitReason ?? response?.item?.visitReason ?? current.visit_reason,
        status: String(response?.item?.status ?? current.status).toLowerCase(),
      }) : current);
      setFeedback(response?.message ?? 'Patient record updated successfully.');
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

    const confirmed = window.confirm('Delete this patient record? Use this only for duplicate entries.');
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setFeedback('');
    try {
      await onDeletePatient({ id: form.id });
      setActivePatient(null);
      setForm(null);
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
            <p className="eyebrow">Patient database</p>
            <h3>Registration records</h3>
            <p>Search the full patient register, filter the entries, open registration records, make corrections, and remove duplicates when needed.</p>
          </div>
        </div>

        <div className="reception-filter-strip">
          <label className="field-block reception-inline-field reception-search-field">
            <span>Search patients</span>
            <PortalIcon className="reception-search-icon" name="search" />
            <input onChange={(event) => setSearch(event.target.value)} placeholder="Name, folder ID, phone, old folder..." type="text" value={search} />
          </label>
          <label className="field-block reception-inline-field">
            <span>Status</span>
            <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="all">All statuses</option>
              <option value="registered">Registered</option>
              <option value="waiting">Waiting</option>
              <option value="assigned">Assigned</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label className="field-block reception-inline-field">
            <span>Patient type</span>
            <select onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}>
              <option value="all">All patients</option>
              <option value="registered">Registered only</option>
              <option value="walkin">Walk-ins only</option>
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
            <p className="eyebrow">Patient records</p>
            <h3>All registrations</h3>
          </div>
          <span className="table-counter">
            {filteredItems.length} results | Page {currentPage} of {totalPages}
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
                <th>Type</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length ? paginatedItems.map((patient) => (
                <tr key={`patient-record-${patient.id}`}>
                  <td>
                    <strong>{patient.folderId}</strong>
                    {patient.oldFolderId ? <span className="table-subcopy">{patient.oldFolderId}</span> : null}
                  </td>
                  <td>{patient.patientName}</td>
                  <td>{formatPhoneNumber(patient.phone)}</td>
                  <td>{patient.visitReason}</td>
                  <td>{patient.status}</td>
                  <td>{patient.isWalkin ? 'Walk-in' : 'Registered'}</td>
                  <td>
                    <button className="clinical-workspace-button secondary-action--compact" onClick={() => openRecord(patient)} type="button">
                      Registration record
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="7">No patient records match the current search and filters.</td>
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

      <PatientRecordModal
        deleting={deleting}
        feedback={feedback}
        isOpen={Boolean(activePatient && form)}
        onChange={handleChange}
        onClose={() => {
          setActivePatient(null);
          setForm(null);
          setFeedback('');
        }}
        onDelete={handleDelete}
        onSubmit={handleSubmit}
        patient={form ? {
          patientName: activePatient?.patientName ?? '',
          folderId: activePatient?.folderId ?? '',
          phone: form.phone,
          status: form.status ? `${form.status.charAt(0).toUpperCase()}${form.status.slice(1)}` : '',
          ...form,
        } : null}
        saving={saving}
      />
    </>
  );
}
