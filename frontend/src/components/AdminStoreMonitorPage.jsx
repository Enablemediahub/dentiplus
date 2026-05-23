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

function matchesSaleSearch(sale, query) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }

  return [
    sale.saleId,
    sale.totalAmountLabel,
    sale.itemCountLabel,
    sale.unitsSoldLabel,
    sale.itemNames,
    sale.cashierLabel,
    sale.createdAtLabel,
    sale.createdDateLabel,
    sale.branch,
  ].join(' ').toLowerCase().includes(trimmed);
}

function matchesInventorySearch(item, query) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }

  return [
    item.name,
    item.description,
    item.priceLabel,
    item.stockLabel,
    item.status,
    item.branch,
  ].join(' ').toLowerCase().includes(trimmed);
}

export function AdminStoreMonitorPage({ data, onNavigate }) {
  const [salesSearch, setSalesSearch] = React.useState('');
  const [inventorySearch, setInventorySearch] = React.useState('');
  const [salesPage, setSalesPage] = React.useState(1);
  const [rowsPerPage, setRowsPerPage] = React.useState(12);

  const metrics = data?.metrics ?? {};
  const sales = data?.sales ?? [];
  const items = data?.items ?? [];
  const filteredSales = sales.filter((sale) => matchesSaleSearch(sale, salesSearch));
  const filteredInventory = items.filter((item) => matchesInventorySearch(item, inventorySearch));
  const totalPages = Math.max(1, Math.ceil(filteredSales.length / rowsPerPage));
  const currentPage = clampPage(salesPage, totalPages);
  const paginatedSales = filteredSales.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const lowStockItems = filteredInventory.filter((item) => item.stock > 0 && item.stock <= 10);
  const outOfStockItems = filteredInventory.filter((item) => item.stock <= 0);
  const widgets = [
    {
      label: 'Store Revenue Today',
      value: metrics.revenueTodayLabel ?? formatCurrency(0),
      trend: `${metrics.transactionsTodayLabel ?? '0'} transactions posted today`,
      icon: 'trend',
    },
    {
      label: 'Units Sold Today',
      value: metrics.unitsSoldTodayLabel ?? '0 units',
      trend: `Average sale ${metrics.averageSaleTodayLabel ?? formatCurrency(0)}`,
      icon: 'receipt',
    },
    {
      label: 'Low Stock Watch',
      value: metrics.lowStockCountLabel ?? '0',
      trend: `${metrics.outOfStockCountLabel ?? '0'} items fully out of stock`,
      icon: 'inventory',
    },
    {
      label: 'Inventory Tracked',
      value: String(items.length),
      trend: `${sales.length} sale records available for review`,
      icon: 'layers',
    },
  ];

  React.useEffect(() => {
    setSalesPage(1);
  }, [salesSearch, rowsPerPage]);

  React.useEffect(() => {
    setSalesPage((current) => clampPage(current, totalPages));
  }, [totalPages]);

  return (
    <>
      <section className="stats-grid content-grid">
        {widgets.map((item) => (
          <article className="stat-card" key={item.label}>
            <div className="stat-card-icon">
              <PortalIcon className="nav-icon stat-card-icon-svg" name={item.icon} />
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
            <p className="eyebrow">Store monitoring</p>
            <h3>Admin watch over daily store movement</h3>
            <p>Monitor today&apos;s store turnover, live-search sale activity, and keep stock pressure visible without blending it into the clinic billing sales desk.</p>
          </div>
          <div className="workspace-card__actions reception-action-row reception-action-row--end">
            <button className="primary-button workspace-inline-action" onClick={() => onNavigate('store')} type="button">
              <PortalIcon className="workspace-submit-icon" name="inventory" />
              <span>Open store desk</span>
            </button>
            <button className="ghost-button workspace-inline-action" onClick={() => onNavigate('database')} type="button">
              <PortalIcon className="workspace-submit-icon" name="layers" />
              <span>Back to database</span>
            </button>
          </div>
        </div>

        <div className="reception-filter-strip reception-filter-strip--ledger">
          <label className="field-block reception-inline-field reception-search-field">
            <span>Search store sales</span>
            <PortalIcon className="reception-search-icon" name="search" />
            <input onChange={(event) => setSalesSearch(event.target.value)} placeholder="Sale ID, item name, cashier, branch, date..." type="text" value={salesSearch} />
          </label>
          <label className="field-block reception-inline-field">
            <span>Search inventory</span>
            <input onChange={(event) => setInventorySearch(event.target.value)} placeholder="Item, description, stock status..." type="text" value={inventorySearch} />
          </label>
          <label className="field-block reception-inline-field">
            <span>Sales rows</span>
            <select onChange={(event) => setRowsPerPage(Number(event.target.value))} value={rowsPerPage}>
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={48}>48</option>
            </select>
          </label>
        </div>

        <div className="frontdesk-command-grid">
          <div className="frontdesk-highlight">
            <span>Visible sale records</span>
            <strong>{filteredSales.length}</strong>
            <p>Live-filtered store receipts ready for operational review.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Low stock items</span>
            <strong>{lowStockItems.length}</strong>
            <p>Products that should be restocked soon based on the current counts.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Out of stock</span>
            <strong>{outOfStockItems.length}</strong>
            <p>Products that cannot be sold until replenished.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Inventory matches search</span>
            <strong>{filteredInventory.length}</strong>
            <p>Store items visible under the current inventory live search.</p>
          </div>
        </div>
      </section>

      <section className="module-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Daily store sales</p>
            <h3>Searchable store turnover log</h3>
          </div>
          <span className="table-counter">
            {filteredSales.length} results | Page {currentPage} of {totalPages}
          </span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sale ID</th>
                <th>Total</th>
                <th>Units</th>
                <th>Items</th>
                <th>Cashier</th>
                <th>Branch</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSales.length ? paginatedSales.map((sale) => (
                <tr key={`admin-store-sale-${sale.id}`}>
                  <td><strong>{sale.saleId}</strong></td>
                  <td><strong>{sale.totalAmountLabel}</strong></td>
                  <td>{sale.unitsSoldLabel}</td>
                  <td>
                    {sale.itemCountLabel}
                    {sale.itemNames ? <span className="table-subcopy">{sale.itemNames}</span> : null}
                  </td>
                  <td>{sale.cashierLabel}</td>
                  <td>{sale.branch || 'Main branch'}</td>
                  <td>{sale.createdAtLabel}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="7">No store sales match the current monitoring search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-pagination">
          <span className="table-counter">
            Showing {paginatedSales.length ? (currentPage - 1) * rowsPerPage + 1 : 0}
            {' - '}
            {Math.min(currentPage * rowsPerPage, filteredSales.length)} of {filteredSales.length}
          </span>
          <div className="reception-action-row">
            <button className="ghost-button secondary-action--compact" disabled={currentPage <= 1} onClick={() => setSalesPage((value) => Math.max(1, value - 1))} type="button">Previous</button>
            <button className="ghost-button secondary-action--compact" disabled={currentPage >= totalPages} onClick={() => setSalesPage((value) => Math.min(totalPages, value + 1))} type="button">Next</button>
          </div>
        </div>
      </section>

      <section className="module-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Inventory pressure</p>
            <h3>Live stock watchlist</h3>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Branch</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.length ? filteredInventory.slice(0, 18).map((item) => (
                <tr key={`admin-store-item-${item.id}`}>
                  <td>
                    <strong>{item.name}</strong>
                    {item.description ? <span className="table-subcopy">{item.description}</span> : null}
                  </td>
                  <td>{item.priceLabel}</td>
                  <td>{item.stockLabel}</td>
                  <td>{item.status}</td>
                  <td>{item.branch || 'Main branch'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5">No inventory items match the current live search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
