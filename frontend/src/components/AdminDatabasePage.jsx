import React from 'react';
import { PortalIcon } from './PortalIcon';

function clampPage(page, totalPages) {
  if (totalPages <= 0) {
    return 1;
  }

  return Math.min(Math.max(page, 1), totalPages);
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') {
    return '--';
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }

  return String(value);
}

function fieldLabel(name) {
  return String(name ?? '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function scoreVisibleColumn(columnName) {
  const name = String(columnName ?? '').toLowerCase();

  if (name === 'name' || name.endsWith('_name') || name.includes('patient_name')) {
    return 200;
  }

  if (name.includes('patient')) {
    return 180;
  }

  if (name.includes('full_name') || name.includes('company_name') || name.includes('staff_name')) {
    return 175;
  }

  if (name.includes('folder') || name.includes('receipt') || name.includes('invoice') || name.includes('reference')) {
    return 160;
  }

  if (name === 'id' || name.endsWith('_id')) {
    return 140;
  }

  if (name.includes('phone') || name.includes('email')) {
    return 130;
  }

  if (name.includes('amount') || name.includes('price') || name.includes('balance') || name.includes('total')) {
    return 120;
  }

  if (name.includes('status') || name.includes('type') || name.includes('method')) {
    return 110;
  }

  if (name.includes('date') || name.includes('time') || name.includes('created') || name.includes('updated')) {
    return 100;
  }

  if (name.includes('branch')) {
    return 90;
  }

  if (name.includes('description') || name.includes('notes')) {
    return 40;
  }

  return 60;
}

function pickVisibleColumns(columns, limit = 7) {
  return [...(columns ?? [])]
    .sort((left, right) => {
      const scoreGap = scoreVisibleColumn(right.name) - scoreVisibleColumn(left.name);
      if (scoreGap !== 0) {
        return scoreGap;
      }

      return String(left.label ?? left.name ?? '').localeCompare(String(right.label ?? right.name ?? ''));
    })
    .slice(0, limit);
}

function RowModal({
  deleting,
  loading,
  onChange,
  onClose,
  onDelete,
  onSave,
  rowData,
  saving,
}) {
  if (!rowData) {
    return null;
  }

  const columns = rowData.schema?.columns ?? [];
  const record = rowData.record ?? {};

  return (
    <div className="workspace-modal-backdrop" onClick={onClose} role="presentation">
      <div
        aria-modal="true"
        className="workspace-modal workspace-modal--wide database-row-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="workspace-modal__header">
          <div>
            <p className="eyebrow eyebrow--modal">Database row</p>
            <h3>{rowData.table}</h3>
            <p>Edit supported fields directly here, or remove the row if you are sure it should no longer exist.</p>
          </div>
          <button className="ghost-button secondary-action--compact" onClick={onClose} type="button">
            Close
          </button>
        </div>

        {loading ? (
          <div className="workspace-modal__body">
            <p>Loading row details...</p>
          </div>
        ) : (
          <form className="workspace-modal__body" onSubmit={onSave}>
            <div className="form-grid">
              {columns.map((column) => (
                <label className={`field-block ${column.editable ? '' : 'field-block--readonly'}`} key={column.name}>
                  <span>{column.label}</span>
                  {column.editable ? (
                    Array.isArray(column.options) && column.options.length > 0 ? (
                      <select
                        name={column.name}
                        onChange={onChange}
                        value={record[column.name] ?? ''}
                      >
                        {column.nullable ? <option value="">Select {column.label}</option> : null}
                        {column.options.map((option) => (
                          <option key={`${column.name}-${option.value}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        name={column.name}
                        onChange={onChange}
                        type="text"
                        value={record[column.name] ?? ''}
                      />
                    )
                  ) : (
                    <div className="database-readonly-value">{formatValue(record[column.name])}</div>
                  )}
                </label>
              ))}
            </div>

            <div className="workspace-card__actions workspace-card__actions--between">
              <button className="danger-button workspace-inline-action" disabled={saving || deleting} onClick={onDelete} type="button">
                <PortalIcon className="workspace-submit-icon" name="close" />
                <span>{deleting ? 'Deleting...' : 'Delete row'}</span>
              </button>
              <button className="primary-button workspace-inline-action" disabled={saving || deleting} type="submit">
                <PortalIcon className="workspace-submit-icon" name="plus-square" />
                <span>{saving ? 'Saving...' : 'Save changes'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function AdminDatabasePage({
  activeBranch,
  onDeleteDatabaseRow,
  onLoadDatabaseDuplicates,
  onLoadDatabaseMeta,
  onLoadDatabaseRow,
  onLoadDatabaseTable,
  onNavigate,
  onUpdateDatabaseRow,
}) {
  const [meta, setMeta] = React.useState(null);
  const [tableSearch, setTableSearch] = React.useState('');
  const [selectedTable, setSelectedTable] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [patientSearch, setPatientSearch] = React.useState('');
  const [dateColumn, setDateColumn] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [rowsPerPage, setRowsPerPage] = React.useState(25);
  const [page, setPage] = React.useState(1);
  const [loadingMeta, setLoadingMeta] = React.useState(true);
  const [loadingTable, setLoadingTable] = React.useState(true);
  const [tablePayload, setTablePayload] = React.useState(null);
  const [duplicateData, setDuplicateData] = React.useState(null);
  const [duplicateLoading, setDuplicateLoading] = React.useState(false);
  const [rowData, setRowData] = React.useState(null);
  const [rowLoading, setRowLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');

  React.useEffect(() => {
    let active = true;

    async function loadMeta() {
      setLoadingMeta(true);
      setFeedback('');

      try {
        const response = await onLoadDatabaseMeta({
          branch: activeBranch,
          table_search: tableSearch,
        });

        if (!active) {
          return;
        }

        setMeta(response);
        const tables = response?.tables ?? [];
        if (tables.length > 0) {
          setSelectedTable((current) => (
            current && tables.some((item) => item.name === current) ? current : tables[0].name
          ));
        } else {
          setSelectedTable('');
          setTablePayload(null);
          setDuplicateData(null);
        }
      } catch (error) {
        if (active) {
          setFeedback(error.message);
        }
      } finally {
        if (active) {
          setLoadingMeta(false);
        }
      }
    }

    loadMeta();

    return () => {
      active = false;
    };
  }, [activeBranch, onLoadDatabaseMeta, tableSearch]);

  React.useEffect(() => {
    if (!selectedTable) {
      return;
    }

    let active = true;

    async function loadTable() {
      setLoadingTable(true);
      setFeedback('');

      try {
        const response = await onLoadDatabaseTable({
          branch: activeBranch,
          table_search: tableSearch,
          table: selectedTable,
          search,
          patient_search: patientSearch,
          date_column: dateColumn,
          date_from: dateFrom,
          date_to: dateTo,
          page,
          per_page: rowsPerPage,
        });

        if (!active) {
          return;
        }

        setMeta((current) => ({
          ...(current ?? {}),
          database_name: response?.database_name ?? current?.database_name,
          branch: response?.branch ?? current?.branch,
          branch_label: response?.branch_label ?? current?.branch_label,
          available_branches: response?.available_branches ?? current?.available_branches,
          table_search: response?.table_search ?? current?.table_search,
          tables: response?.tables ?? current?.tables ?? [],
          stats: response?.stats ?? current?.stats,
        }));
        setTablePayload(response?.table ?? null);
      } catch (error) {
        if (active) {
          setFeedback(error.message);
          setTablePayload(null);
        }
      } finally {
        if (active) {
          setLoadingTable(false);
        }
      }
    }

    loadTable();

    return () => {
      active = false;
    };
  }, [activeBranch, dateColumn, dateFrom, dateTo, onLoadDatabaseTable, page, patientSearch, rowsPerPage, search, selectedTable, tableSearch]);

  React.useEffect(() => {
    setPage(1);
  }, [search, patientSearch, dateColumn, dateFrom, dateTo, rowsPerPage, selectedTable, tableSearch, activeBranch]);

  React.useEffect(() => {
    const availableDateColumns = tablePayload?.schema?.date_filter_columns ?? [];
    if (availableDateColumns.length === 0) {
      if (dateColumn !== '') {
        setDateColumn('');
      }
      return;
    }

    if (!availableDateColumns.includes(dateColumn)) {
      setDateColumn(availableDateColumns[0]);
    }
  }, [dateColumn, tablePayload]);

  async function openRow(recordId) {
    setRowLoading(true);
    setRowData(null);
    setFeedback('');

    try {
      const response = await onLoadDatabaseRow({
        branch: activeBranch,
        table: selectedTable,
        record_id: recordId,
      });
      setRowData(response);
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setRowLoading(false);
    }
  }

  async function loadDuplicates(column = '') {
    if (!selectedTable) {
      return;
    }

    setDuplicateLoading(true);
    setFeedback('');

    try {
      const response = await onLoadDatabaseDuplicates({
        branch: activeBranch,
        table: selectedTable,
        column,
      });
      setDuplicateData(response);
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setDuplicateLoading(false);
    }
  }

  function updateRowField(event) {
    const { name, value } = event.target;
    setRowData((current) => (
      current
        ? {
            ...current,
            record: {
              ...(current.record ?? {}),
              [name]: value,
            },
          }
        : current
    ));
  }

  async function saveRow(event) {
    event.preventDefault();
    if (!rowData) {
      return;
    }

    setSaving(true);
    setFeedback('');

    try {
      const response = await onUpdateDatabaseRow({
        table: rowData.table,
        record_id: rowData.record?.[rowData.schema?.primary_key],
        values: rowData.record,
        branch: activeBranch,
      });
      setRowData((current) => (current ? { ...current, record: response?.record ?? current.record } : current));
      await openRow(rowData.record?.[rowData.schema?.primary_key]);
      await loadDuplicates(duplicateData?.selected_column ?? '');
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow() {
    if (!rowData) {
      return;
    }

    const confirmed = window.confirm('Delete this row from the database workspace?');
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setFeedback('');

    try {
      await onDeleteDatabaseRow({
        table: rowData.table,
        record_id: rowData.record?.[rowData.schema?.primary_key],
        branch: activeBranch,
      });
      setRowData(null);
      setPage(1);
      await loadDuplicates(duplicateData?.selected_column ?? '');
      const refreshed = await onLoadDatabaseTable({
        branch: activeBranch,
        table_search: tableSearch,
        table: selectedTable,
        search,
        patient_search: patientSearch,
        date_column: dateColumn,
        date_from: dateFrom,
        date_to: dateTo,
        page: 1,
        per_page: rowsPerPage,
      });
      setMeta((current) => ({
        ...(current ?? {}),
        tables: refreshed?.tables ?? current?.tables ?? [],
        stats: refreshed?.stats ?? current?.stats,
      }));
      setTablePayload(refreshed?.table ?? null);
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setDeleting(false);
    }
  }

  const tables = meta?.tables ?? [];
  const rows = tablePayload?.rows ?? [];
  const schemaColumns = tablePayload?.schema?.columns ?? [];
  const primaryKey = tablePayload?.schema?.primary_key ?? null;
  const pagination = tablePayload?.pagination ?? {};
  const totalPages = Math.max(1, Number(pagination.total_pages ?? 1));
  const currentPage = clampPage(Number(pagination.page ?? page), totalPages);
  const branchLabel = meta?.branch_label ?? (activeBranch || 'Merged View');
  const visibleColumns = React.useMemo(() => pickVisibleColumns(schemaColumns, 7), [schemaColumns]);
  const selectedTableMeta = tables.find((table) => table.name === selectedTable) ?? null;
  const dateColumns = tablePayload?.schema?.date_filter_columns ?? [];

  return (
    <>
      <section className="module-card database-workspace">
        <div className="panel-heading workspace-card__header database-page-header">
          <div>
            <p className="eyebrow">Database workspace</p>
            <h3>Admin database control</h3>
            <p>Move through live tables the same way as the Opticplus database workspace, with branch-aware tabs and direct row access.</p>
          </div>
          <div className="database-toolbar">
            <label className="database-table-search">
              Table search
              <input
                onChange={(event) => setTableSearch(event.target.value)}
                placeholder="patients, billing, store..."
                type="text"
                value={tableSearch}
              />
            </label>
            <button className="ghost-button" onClick={() => loadDuplicates('')} type="button">
              {duplicateLoading ? 'Checking...' : 'Duplicates'}
            </button>
            <button
              className="ghost-button"
              onClick={() => {
                setSearch('');
                setPage(1);
                setFeedback('');
                setDuplicateData(null);
              }}
              type="button"
            >
              Refresh
            </button>
            <button className="ghost-button" onClick={() => onNavigate('dashboard')} type="button">
              Back to dashboard
            </button>
          </div>
        </div>

        <div className="database-tab-strip">
          {loadingMeta ? (
            <div className="database-inline-banner">
              <strong>Loading table catalogue...</strong>
              <span>Pulling the live database table list for this branch view.</span>
            </div>
          ) : tables.length ? tables.map((table) => (
            <button
              key={table.name}
              type="button"
              className={table.name === selectedTable ? 'database-tab active' : 'database-tab'}
              onClick={() => setSelectedTable(table.name)}
            >
              <span className="database-tab-label">{table.label}</span>
              <span className="database-tab-meta">{table.name}</span>
            </button>
          )) : (
            <div className="database-inline-banner danger">
              <strong>No tables match this filter</strong>
              <span>Try a broader table search or switch branch view from the hero selector.</span>
            </div>
          )}
        </div>

        <div className="database-notice-row">
          <div className="finance-chip">
            <span>Database</span>
            <strong>{meta?.database_name ?? 'Loading...'}</strong>
          </div>
          <div className="finance-chip">
            <span>Branch view</span>
            <strong>{branchLabel}</strong>
          </div>
          <div className="finance-chip">
            <span>Primary key</span>
            <strong>{tablePayload?.schema?.primary_key ?? selectedTableMeta?.primaryKey ?? '--'}</strong>
          </div>
          <div className="finance-chip">
            <span>Branch aware</span>
            <strong>{tablePayload?.schema?.has_branch_id || selectedTableMeta?.hasBranchId || tablePayload?.schema?.has_branch || selectedTableMeta?.hasBranch ? 'Yes' : 'No'}</strong>
          </div>
          <div className="finance-chip">
            <span>Writable</span>
            <strong>{tablePayload?.schema?.writable || selectedTableMeta?.writable ? 'Yes' : 'No'}</strong>
          </div>
          <div className="finance-chip">
            <span>Visible columns</span>
            <strong>{visibleColumns.length}</strong>
          </div>
          <div className="finance-chip">
            <span>Rows in view</span>
            <strong>{pagination.total ?? meta?.stats?.row_count ?? 0}</strong>
          </div>
        </div>

        <div className="database-explorer-grid">
          <article className="database-records-panel">
            <div className="panel-heading workspace-card__header database-main-heading">
              <div>
                <p className="eyebrow">Rows</p>
                <h3>{tablePayload?.label ?? 'Select a table'}</h3>
                <p>{selectedTable ? `Working on ${selectedTable} with ${meta?.stats?.column_count ?? 0} columns.` : 'Choose a table tab above to begin.'}</p>
              </div>
              <span className="panel-tag">{pagination.total ?? meta?.stats?.row_count ?? 0} rows</span>
            </div>

            <form
              className="database-filter-row"
              onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
              }}
            >
              <label className="full-span">
                Search rows
                <input
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search visible columns..."
                  type="text"
                  value={search}
                />
              </label>
              <label>
                Patient search
                <input
                  onChange={(event) => setPatientSearch(event.target.value)}
                  placeholder="Search patient names..."
                  type="text"
                  value={patientSearch}
                />
              </label>
              {dateColumns.length ? (
                <label className="database-table-select">
                  Date column
                  <select onChange={(event) => setDateColumn(event.target.value)} value={dateColumn}>
                    {dateColumns.map((columnName) => (
                      <option key={columnName} value={columnName}>
                        {fieldLabel(columnName)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label>
                Date from
                <input
                  onChange={(event) => setDateFrom(event.target.value)}
                  type="date"
                  value={dateFrom}
                />
              </label>
              <label>
                Date to
                <input
                  onChange={(event) => setDateTo(event.target.value)}
                  type="date"
                  value={dateTo}
                />
              </label>
              <div className="filter-actions-row full-span">
                <label className="database-table-select">
                  Rows per page
                  <select onChange={(event) => setRowsPerPage(Number(event.target.value))} value={rowsPerPage}>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>
                <button className="primary-button" type="submit">
                  Search
                </button>
                <button
                  className="ghost-button"
                  onClick={() => {
                    setSearch('');
                    setPatientSearch('');
                    setDateFrom('');
                    setDateTo('');
                    setDateColumn(dateColumns[0] ?? '');
                    setPage(1);
                  }}
                  type="button"
                >
                  Clear filters
                </button>
              </div>
            </form>

            <div className="database-inline-banner">
              <strong>Live table browsing is active.</strong>
              <span>Use the tabs to switch tables, search the current result set by row or patient name, then narrow by date range before opening any row for direct edits or deletion.</span>
            </div>

            {feedback ? <p className="form-error">{feedback}</p> : null}

            <div className="table-wrap table-shell database-grid-shell">
              <table className="data-table data-table--compact database-grid">
                <thead>
                  <tr>
                    {visibleColumns.map((column) => (
                      <th key={column.name}>
                        <div className="database-header-chip">
                          <strong>{column.label}</strong>
                          <span>{column.type}</span>
                        </div>
                      </th>
                    ))}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingTable ? (
                    <tr>
                      <td colSpan={Math.max(2, visibleColumns.length + 1)}>Loading table rows...</td>
                    </tr>
                  ) : rows.length ? rows.map((row, index) => (
                    <tr key={`database-table-row-${row[primaryKey] ?? index}`}>
                      {visibleColumns.map((column) => (
                        <td key={`${row[primaryKey] ?? index}-${column.name}`}>
                          <div className="database-cell">
                            <strong>{formatValue(row[column.name])}</strong>
                            <span>{column.type}</span>
                          </div>
                        </td>
                      ))}
                      <td>
                        <div className="manager-action-row">
                          <button className="clinical-workspace-button secondary-action--compact" onClick={() => openRow(row[primaryKey])} type="button">
                            Open row
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={Math.max(2, visibleColumns.length + 1)}>No rows matched this view for {selectedTable || 'the selected table'}.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="database-footer">
              <span>Page {currentPage} of {totalPages}</span>
              <span>{pagination.total ?? meta?.stats?.row_count ?? 0} rows</span>
              <div className="modal-actions reception-action-row">
                <button className="ghost-button secondary-action--compact" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">
                  Previous
                </button>
                <button className="ghost-button secondary-action--compact" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} type="button">
                  Next
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="module-card database-workspace">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Duplicates</p>
            <h3>{tablePayload?.label ?? selectedTableMeta?.label ?? 'Duplicate review'}</h3>
            <p className="muted-copy">Review repeated names, folder IDs, receipt numbers, and similar identifiers before deleting or editing rows.</p>
          </div>
          {duplicateData?.available_columns?.length ? (
            <div className="database-toolbar">
              <label className="database-table-select">
                Duplicate column
                <select onChange={(event) => loadDuplicates(event.target.value)} value={duplicateData.selected_column ?? ''}>
                  {duplicateData.available_columns.map((column) => (
                    <option key={column.name} value={column.name}>
                      {column.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </div>

        {duplicateData?.available_columns?.length ? (
          <>
            <div className="database-notice-row">
              <div className="finance-chip">
                <span>Duplicate groups</span>
                <strong>{duplicateData.duplicate_groups?.length ?? 0}</strong>
              </div>
              <div className="finance-chip">
                <span>Branch view</span>
                <strong>{branchLabel}</strong>
              </div>
            </div>

            {duplicateLoading ? (
              <div className="database-inline-banner">
                <strong>Checking duplicates...</strong>
                <span>Loading repeated values for the selected table and branch view.</span>
              </div>
            ) : duplicateData.duplicate_groups?.length ? (
              <div className="database-duplicate-groups">
                {duplicateData.duplicate_groups.map((group, index) => (
                  <section className="database-duplicate-card" key={`duplicate-group-${index}`}>
                    <div className="database-duplicate-header">
                      <div>
                        <span>Duplicate value</span>
                        <strong>{group.value || '--'}</strong>
                      </div>
                      <div className="finance-chip">
                        <span>Matches</span>
                        <strong>{group.count}</strong>
                      </div>
                    </div>
                    <div className="table-wrap table-shell">
                      <table className="data-table database-duplicate-table">
                        <thead>
                          <tr>
                            {(group.preview_columns ?? []).map((columnName) => (
                              <th key={columnName}>{fieldLabel(columnName)}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(group.records ?? []).map((record, recordIndex) => (
                            <tr key={`${group.value}-${recordIndex}`}>
                              {(group.preview_columns ?? []).map((columnName) => (
                                <td key={`${group.value}-${recordIndex}-${columnName}`}>{formatValue(record[columnName])}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="database-inline-banner">
                <strong>No duplicates found</strong>
                <span>The selected duplicate-check column is clear for the current branch view.</span>
              </div>
            )}
          </>
        ) : (
          <div className="database-inline-banner">
            <strong>No duplicate-check columns loaded yet</strong>
            <span>Choose a table and click Duplicates to review repeated values.</span>
          </div>
        )}
      </section>

      <RowModal
        deleting={deleting}
        loading={rowLoading}
        onChange={updateRowField}
        onClose={() => setRowData(null)}
        onDelete={deleteRow}
        onSave={saveRow}
        rowData={rowData}
        saving={saving}
      />
    </>
  );
}
