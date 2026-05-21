import React from 'react';

export function DataTable({ title, columns, rows, actionLabel = 'Open' }) {
  return (
    <section className="module-card">
      <div className="panel-heading workspace-card__header">
        <div>
          <p className="eyebrow">Workspace view</p>
          <h3>{title}</h3>
        </div>
        <button className="ghost-button secondary-action--compact" type="button">
          {actionLabel}
        </button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${title}-${index}`}>
                {columns.map((column) => (
                  <td key={column.key}>{row[column.key] ?? '-'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
