import React from 'react';
import { PortalIcon } from './PortalIcon';

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
    item.reference,
    item.detail,
    item.category,
    item.notes,
    item.amountLabel,
    item.expenseDateLabel,
  ].join(' ').toLowerCase().includes(trimmed);
}

function ExpenseModal({ deleting, feedback, form, isOpen, onChange, onClose, onDelete, onSubmit, saving }) {
  if (!isOpen || !form) {
    return null;
  }

  return (
    <div className="workspace-modal-backdrop" onClick={onClose} role="presentation">
      <div aria-modal="true" className="workspace-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="workspace-modal__header">
          <div className="workspace-patient-summary">
            <p className="eyebrow eyebrow--modal">Reception expense</p>
            <h3>{form.id ? 'Edit expense' : 'Log new expense'}</h3>
          </div>
          <button className="ghost-button secondary-action--compact" onClick={onClose} type="button">Close</button>
        </div>
        <form className="workspace-modal__body" onSubmit={onSubmit}>
          <label className="field-block">
            <span>Detail</span>
            <input name="detail" onChange={onChange} required type="text" value={form.detail} />
          </label>
          <label className="field-block">
            <span>Category</span>
            <select name="category" onChange={onChange} value={form.category}>
              <option value="Operations">Operations</option>
              <option value="Supplies">Supplies</option>
              <option value="Utilities">Utilities</option>
              <option value="Transport">Transport</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label className="field-block">
            <span>Amount</span>
            <input min="0" name="amount" onChange={onChange} required step="0.01" type="number" value={form.amount} />
          </label>
          <label className="field-block">
            <span>Expense date</span>
            <input name="expense_date" onChange={onChange} required type="date" value={form.expense_date} />
          </label>
          <label className="field-block field-block--wide">
            <span>Notes</span>
            <textarea name="notes" onChange={onChange} rows={4} value={form.notes} />
          </label>
          {feedback ? <p className="form-error">{feedback}</p> : null}
          <div className="workspace-card__actions workspace-card__actions--between">
            {form.id ? (
              <button className="danger-button workspace-inline-action" disabled={saving || deleting} onClick={onDelete} type="button">
                <PortalIcon className="workspace-submit-icon" name="close" />
                <span>{deleting ? 'Deleting...' : 'Delete Expense'}</span>
              </button>
            ) : <span />}
            <button className="primary-button workspace-inline-action" disabled={saving || deleting} type="submit">
              <PortalIcon className="workspace-submit-icon" name="plus-square" />
              <span>{saving ? 'Saving...' : form.id ? 'Save Changes' : 'Record Expense'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ReceptionExpensesPage({ data, onCreateExpense, onDeleteExpense, onUpdateExpense }) {
  const [search, setSearch] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState('all');
  const [monthFilter, setMonthFilter] = React.useState('all');
  const [rowsPerPage, setRowsPerPage] = React.useState(15);
  const [page, setPage] = React.useState(1);
  const [form, setForm] = React.useState(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const items = data?.items ?? [];
  const categories = Array.from(new Set(items.map((item) => item.category).filter(Boolean)));
  const filteredItems = items.filter((item) => {
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesMonth = monthFilter === 'all' || String(item.expenseDate ?? '').slice(0, 7) === monthFilter;
    return matchesCategory && matchesMonth && matchesSearch(item, search);
  });
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));
  const currentPage = clampPage(page, totalPages);
  const paginatedItems = filteredItems.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  React.useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, monthFilter, rowsPerPage]);

  React.useEffect(() => {
    setPage((current) => clampPage(current, totalPages));
  }, [totalPages]);

  function openNewExpense() {
    setFeedback('');
    setForm({
      id: 0,
      detail: '',
      category: 'Operations',
      amount: '',
      expense_date: new Date().toISOString().slice(0, 10),
      notes: '',
    });
    setModalOpen(true);
  }

  function openEditExpense(item) {
    setFeedback('');
    setForm({
      id: item.id,
      detail: item.detail ?? '',
      category: item.category ?? 'Operations',
      amount: item.amount ?? '',
      expense_date: item.expenseDate ?? '',
      notes: item.notes ?? '',
    });
    setModalOpen(true);
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: ['amount', 'expense_date', 'category'].includes(name) ? value : normalizeLeadingUppercase(value),
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
      if (form.id) {
        await onUpdateExpense(form);
      } else {
        await onCreateExpense(form);
      }
      setModalOpen(false);
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

    const confirmed = window.confirm('Delete this expense record?');
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setFeedback('');
    try {
      await onDeleteExpense({ id: form.id });
      setModalOpen(false);
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
            <p className="eyebrow">Expenses</p>
            <h3>Reception expense log</h3>
            <p>Record front-desk expenses, search the log, filter by category or month, and edit or delete entries when corrections are needed.</p>
          </div>
          <div className="workspace-card__actions reception-action-row reception-action-row--end">
            <button className="primary-button workspace-inline-action" onClick={openNewExpense} type="button">
              <PortalIcon className="workspace-submit-icon" name="plus-square" />
              <span>Log expense</span>
            </button>
          </div>
        </div>
        <div className="reception-filter-strip">
          <label className="field-block reception-inline-field reception-search-field">
            <span>Search expenses</span>
            <PortalIcon className="reception-search-icon" name="search" />
            <input onChange={(event) => setSearch(event.target.value)} placeholder="Reference, detail, category, notes..." type="text" value={search} />
          </label>
          <label className="field-block reception-inline-field">
            <span>Category</span>
            <select onChange={(event) => setCategoryFilter(event.target.value)} value={categoryFilter}>
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label className="field-block reception-inline-field">
            <span>Month</span>
            <input onChange={(event) => setMonthFilter(event.target.value || 'all')} type="month" value={monthFilter === 'all' ? '' : monthFilter} />
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
            <p className="eyebrow">Expense table</p>
            <h3>Recorded expenses</h3>
          </div>
          <span className="table-counter">
            {filteredItems.length} results | Page {currentPage} of {totalPages}
          </span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Detail</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length ? paginatedItems.map((item) => (
                <tr key={`expense-${item.id}`}>
                  <td>{item.reference}</td>
                  <td>
                    <strong>{item.detail}</strong>
                    {item.notes ? <span className="table-subcopy">{item.notes}</span> : null}
                  </td>
                  <td>{item.category}</td>
                  <td>{item.amountLabel}</td>
                  <td>{item.expenseDateLabel}</td>
                  <td>
                    <button className="clinical-workspace-button secondary-action--compact" onClick={() => openEditExpense(item)} type="button">
                      Edit expense
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6">No expenses match the current search and filters.</td>
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

      <ExpenseModal
        deleting={deleting}
        feedback={feedback}
        form={form}
        isOpen={modalOpen}
        onChange={handleChange}
        onClose={() => {
          setModalOpen(false);
          setForm(null);
          setFeedback('');
        }}
        onDelete={handleDelete}
        onSubmit={handleSubmit}
        saving={saving}
      />
    </>
  );
}
