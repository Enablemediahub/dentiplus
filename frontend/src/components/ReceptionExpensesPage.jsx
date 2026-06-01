import React from 'react';
import { DateInputField } from './DateInputField';
import { PortalIcon } from './PortalIcon';
import { displayDateToIso, formatDateRangeLabel, isoToDisplayDate, normalizeDateEntry } from '../lib/dateInput';

function clampPage(page, totalPages) {
  if (totalPages <= 0) {
    return 1;
  }

  return Math.min(Math.max(page, 1), totalPages);
}

function normalizeLeadingUppercase(value) {
  return String(value ?? '').replace(/^([a-z])/, (match) => match.toUpperCase());
}

function normalizeDateOnly(value) {
  const text = String(value ?? '').trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    return displayDateToIso(text);
  }

  return text.slice(0, 10);
}

function inDateRange(value, startDate, endDate) {
  const dateValue = normalizeDateOnly(value);
  const startValue = normalizeDateOnly(startDate);
  const endValue = normalizeDateOnly(endDate);
  if (!dateValue) {
    return false;
  }

  if (startDate && (!startValue || dateValue < startValue)) {
    return false;
  }

  if (endDate && (!endValue || dateValue > endValue)) {
    return false;
  }

  return true;
}

function createExcelBlob(title, columns, rows) {
  const tableRows = rows.map((row) => `
    <tr>
      ${row.map((cell) => `<td>${String(cell ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`).join('')}
    </tr>
  `).join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="utf-8" /><title>${title}</title></head>
      <body>
        <table>
          <thead><tr>${columns.map((column) => `<th>${column}</th>`).join('')}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
    </html>
  `;

  return new Blob([html], { type: 'application/vnd.ms-excel' });
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function openPrintableReport(title, subtitle, columns, rows, totals = []) {
  const popup = window.open('', '_blank', 'width=1200,height=900');
  if (!popup) {
    return;
  }

  popup.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
          h1 { margin: 0 0 8px; }
          p { margin: 0 0 20px; color: #555; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; font-size: 13px; }
          th { background: #f3f4f6; text-transform: uppercase; letter-spacing: 0.04em; font-size: 12px; }
          .totals { margin-top: 18px; display: grid; gap: 8px; max-width: 420px; }
          .totals-line { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
          .totals-line strong { font-size: 15px; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>${subtitle}</p>
        <table>
          <thead><tr>${columns.map((column) => `<th>${column}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.map((row) => `
              <tr>${row.map((cell) => `<td>${String(cell ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`).join('')}</tr>
            `).join('') || `<tr><td colspan="${columns.length}">No records in the selected range.</td></tr>`}
          </tbody>
        </table>
        <div class="totals">
          ${totals.map((line) => `<div class="totals-line"><span>${line.label}</span><strong>${line.value}</strong></div>`).join('')}
        </div>
        <script>window.onload = function () { window.print(); };</script>
      </body>
    </html>
  `);
  popup.document.close();
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
            <DateInputField name="expense_date" onChange={onChange} placeholder="dd/mm/yyyy" required value={form.expense_date} />
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
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [rowsPerPage, setRowsPerPage] = React.useState(15);
  const [page, setPage] = React.useState(1);
  const [form, setForm] = React.useState(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const items = data?.items ?? [];
  const categories = Array.from(new Set(items.map((item) => item.category).filter(Boolean)));
  const todayKey = new Date().toISOString().slice(0, 10);
  const selectedRangeLabel = startDate || endDate
    ? formatDateRangeLabel(startDate, endDate)
    : 'All available dates';
  const filteredItems = items.filter((item) => {
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesDates = inDateRange(item.expenseDate, startDate, endDate);
    return matchesCategory && matchesDates && matchesSearch(item, search);
  });
  const largestExpense = filteredItems.reduce((largest, item) => (Number(item.amount ?? 0) > Number(largest?.amount ?? 0) ? item : largest), null);
  const todayItems = filteredItems.filter((item) => String(item.expenseDate ?? '') === todayKey);
  const filteredTotal = filteredItems.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const todayTotal = todayItems.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const uniqueCategoriesInRange = new Set(filteredItems.map((item) => item.category).filter(Boolean)).size;
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));
  const currentPage = clampPage(page, totalPages);
  const paginatedItems = filteredItems.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  React.useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, startDate, endDate, rowsPerPage]);

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
      expense_date: isoToDisplayDate(new Date().toISOString().slice(0, 10)),
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
      expense_date: isoToDisplayDate(item.expenseDate ?? ''),
      notes: item.notes ?? '',
    });
    setModalOpen(true);
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: name === 'expense_date'
        ? normalizeDateEntry(value)
        : ['amount', 'category'].includes(name)
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
      const expenseDate = displayDateToIso(form.expense_date);
      if (!expenseDate) {
        throw new Error('Expense date must use the dd/mm/yyyy format.');
      }

      if (form.id) {
        await onUpdateExpense({
          ...form,
          expense_date: expenseDate,
        });
      } else {
        await onCreateExpense({
          ...form,
          expense_date: expenseDate,
        });
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

  function exportExpensesExcel() {
    const rows = filteredItems.map((item) => ([
      item.reference,
      item.detail,
      item.category,
      item.amountLabel,
      item.expenseDateLabel,
      item.notes,
    ]));

    rows.push(['', 'TOTAL', '', `GHS ${filteredTotal.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, selectedRangeLabel, '']);

    downloadBlob(
      createExcelBlob('Dentiplus Expenses Report', ['Reference', 'Detail', 'Category', 'Amount', 'Date', 'Notes'], rows),
      'dentiplus-expenses-report.xls',
    );
  }

  function exportExpensesPdf() {
    openPrintableReport(
      'Dentiplus Expenses Report',
      `Range: ${selectedRangeLabel}`,
      ['Reference', 'Detail', 'Category', 'Amount', 'Date', 'Notes'],
      filteredItems.map((item) => [
        item.reference,
        item.detail,
        item.category,
        item.amountLabel,
        item.expenseDateLabel,
        item.notes || '-',
      ]),
      [
        { label: 'Total Expenses', value: `GHS ${filteredTotal.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
      ],
    );
  }

  return (
    <>
      <section className="stats-grid content-grid">
        {[
          {
            label: 'Expenses In Range',
            value: `GHS ${filteredTotal.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            trend: selectedRangeLabel,
          },
          {
            label: 'Expenses Today',
            value: `GHS ${todayTotal.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            trend: `${todayItems.length} expense ${todayItems.length === 1 ? 'entry' : 'entries'} from the active range fell on today`,
          },
          {
            label: 'Visible Results',
            value: String(filteredItems.length),
            trend: `${uniqueCategoriesInRange} categories represented inside the selected range`,
          },
          {
            label: 'Largest In Range',
            value: largestExpense?.amountLabel ?? 'GHS 0.00',
            trend: largestExpense?.detail ?? 'No expense records in the selected range',
          },
        ].map((item) => (
          <article className="stat-card" key={item.label}>
            <div className="stat-card-icon">
              <PortalIcon className="nav-icon stat-card-icon-svg" name="finance" />
            </div>
            <span className="stat-card__label">{item.label}</span>
            <h3>{item.value}</h3>
            <p className="stat-card__trend">{item.trend}</p>
          </article>
        ))}
      </section>

      <section className="module-card reception-toolbar-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Expenses</p>
            <h3>Accounting expense workspace</h3>
            <p>Review expenses by date range, keep the figures aligned with the widgets above, export the ledger, and then make edits only when needed.</p>
          </div>
          <div className="workspace-card__actions reception-action-row reception-action-row--end">
            <button className="ghost-button workspace-inline-action" onClick={exportExpensesPdf} type="button">
              <PortalIcon className="workspace-submit-icon" name="reports" />
              <span>Export PDF</span>
            </button>
            <button className="ghost-button workspace-inline-action" onClick={exportExpensesExcel} type="button">
              <PortalIcon className="workspace-submit-icon" name="layers" />
              <span>Export Excel</span>
            </button>
            <button className="primary-button workspace-inline-action" onClick={openNewExpense} type="button">
              <PortalIcon className="workspace-submit-icon" name="plus-square" />
              <span>Log expense</span>
            </button>
          </div>
        </div>
        <div className="reception-filter-strip reception-filter-strip--expenses">
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
            <span>Start date</span>
            <DateInputField name="start_date" onChange={(event) => setStartDate(normalizeDateEntry(event.target.value))} placeholder="dd/mm/yyyy" value={startDate} />
          </label>
          <label className="field-block reception-inline-field">
            <span>End date</span>
            <DateInputField name="end_date" onChange={(event) => setEndDate(normalizeDateEntry(event.target.value))} placeholder="dd/mm/yyyy" value={endDate} />
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
                  <td><strong>{item.amountLabel}</strong></td>
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
            <tfoot>
              <tr className="table-total-row">
                <td colSpan="3">Totals</td>
                <td><strong>{`GHS ${filteredTotal.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</strong></td>
                <td>{selectedRangeLabel}</td>
                <td>-</td>
              </tr>
            </tfoot>
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
