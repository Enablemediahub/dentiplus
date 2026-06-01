import React from 'react';
import { PortalIcon } from './PortalIcon';

function clampPage(page, totalPages) {
  if (totalPages <= 0) {
    return 1;
  }

  return Math.min(Math.max(page, 1), totalPages);
}

function matchesSearch(item, query) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }

  return [
    item.actionLabel,
    item.entityLabel,
    item.actorName,
    item.actorRole,
    item.patientName,
    item.billReference,
    item.branch,
    item.summary,
  ].join(' ').toLowerCase().includes(trimmed);
}

function formatCurrency(value) {
  return `GHS ${Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function AdminDeletionAuditPage({ data }) {
  const [search, setSearch] = React.useState('');
  const [rowsPerPage, setRowsPerPage] = React.useState(15);
  const [page, setPage] = React.useState(1);

  const items = data?.items ?? [];
  const filteredItems = items.filter((item) => matchesSearch(item, search));
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));
  const currentPage = clampPage(page, totalPages);
  const paginatedItems = filteredItems.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const receptionistDeletes = items.filter((item) => item.actorRole === 'Receptionist').length;

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
            <p className="eyebrow">Deletion audit</p>
            <h3>Track destructive front-desk activity</h3>
            <p>Review receptionist and admin deletions from one audit surface so billing removals and similar actions stay visible.</p>
          </div>
        </div>

        <div className="reception-filter-strip">
          <label className="field-block reception-inline-field reception-search-field">
            <span>Search audit log</span>
            <PortalIcon className="reception-search-icon" name="search" />
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Staff, patient, branch, bill reference..."
              type="text"
              value={search}
            />
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
            <span>Total logged deletions</span>
            <strong>{items.length}</strong>
            <p>All destructive audit records currently stored for this admin scope.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Receptionist deletions</span>
            <strong>{receptionistDeletes}</strong>
            <p>Entries performed by front-desk staff.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Visible results</span>
            <strong>{filteredItems.length}</strong>
            <p>Filtered by your current search and branch scope.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Current coverage</span>
            <strong>Billing deletes</strong>
            <p>This page is now recording payment-desk bill deletions and is ready for more destructive actions.</p>
          </div>
        </div>
      </section>

      <section className="module-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Audit records</p>
            <h3>Deletion activity log</h3>
          </div>
          <span className="table-counter">
            {filteredItems.length} results | Page {currentPage} of {totalPages}
          </span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Staff</th>
                <th>Role</th>
                <th>Action</th>
                <th>Patient / Bill</th>
                <th>Amount</th>
                <th>Branch</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length ? paginatedItems.map((item) => (
                <tr key={`audit-log-${item.id}`}>
                  <td>{item.createdAtLabel}</td>
                  <td>{item.actorName}</td>
                  <td>{item.actorRole}</td>
                  <td>{item.actionLabel}</td>
                  <td>
                    <strong>{item.patientName || 'Unknown patient'}</strong>
                    <span className="table-subcopy">{item.billReference || item.entityLabel}</span>
                  </td>
                  <td>{item.amount > 0 ? formatCurrency(item.amount) : '--'}</td>
                  <td>{item.branch || 'Main clinic'}</td>
                  <td>{item.summary || '--'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="8">No deletion activity matches the current search.</td>
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
    </>
  );
}
