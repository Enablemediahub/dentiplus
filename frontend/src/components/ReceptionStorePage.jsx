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

function normalizeLeadingUppercase(value) {
  return String(value ?? '').replace(/^([a-z])/, (match) => match.toUpperCase());
}

function matchesSearch(item, query) {
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
  ].join(' ').toLowerCase().includes(trimmed);
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

function printStoreReceipt(receipt) {
  const popup = window.open('', '_blank', 'width=420,height=720');
  if (!popup) {
    return;
  }

  popup.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Store Sale ${receipt.saleId}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 12px; color: #111; }
          .receipt { width: 302px; margin: 0 auto; }
          .center { text-align: center; }
          .title { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
          .small { font-size: 12px; color: #333; }
          .section { border-top: 1px dashed #666; padding-top: 8px; margin-top: 8px; }
          .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 6px; }
          .line { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; margin-bottom: 4px; }
          .totals { border-top: 1px dashed #666; margin-top: 10px; padding-top: 8px; }
          .strong { font-weight: 700; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="center">
            <div class="title">eDENTAL CLINICS STORE</div>
            <div class="small">Thermal receipt</div>
            <div class="small">Sale #${receipt.saleId}</div>
            <div class="small">${receipt.branch || 'Main branch'}</div>
            <div class="small">${receipt.dateLabel}</div>
          </div>
          <div class="section">
            <div class="section-title">Items</div>
            ${receipt.items.map((item) => `
              <div class="line"><span>${item.name} x${item.quantity}</span><span>${item.subtotalLabel}</span></div>
              <div class="line"><span>@ ${item.priceLabel}</span><span></span></div>
            `).join('')}
          </div>
          <div class="totals">
            <div class="line strong"><span>Total</span><span>${receipt.totalAmountLabel}</span></div>
          </div>
          <div class="center small" style="margin-top:12px;">Thank you for choosing eDENTAL CLINICS</div>
        </div>
        <script>
          window.onload = function () {
            window.print();
            setTimeout(function () { window.close(); }, 150);
          };
        </script>
      </body>
    </html>
  `);
  popup.document.close();
}

function ItemModal({ deleting, feedback, form, isOpen, onChange, onClose, onDelete, onSubmit, saving }) {
  if (!isOpen || !form) {
    return null;
  }

  return (
    <div className="workspace-modal-backdrop" onClick={onClose} role="presentation">
      <div aria-modal="true" className="workspace-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="workspace-modal__header">
          <div className="workspace-patient-summary">
            <p className="eyebrow eyebrow--modal">Store inventory</p>
            <h3>{form.id ? 'Edit item' : 'Add item'}</h3>
          </div>
          <button className="ghost-button secondary-action--compact" onClick={onClose} type="button">Close</button>
        </div>
        <form className="workspace-modal__body" onSubmit={onSubmit}>
          <label className="field-block">
            <span>Item name</span>
            <input name="name" onChange={onChange} required type="text" value={form.name} />
          </label>
          <label className="field-block field-block--wide">
            <span>Description</span>
            <textarea name="description" onChange={onChange} rows={4} value={form.description} />
          </label>
          <label className="field-block">
            <span>Price</span>
            <input min="0" name="price" onChange={onChange} required step="0.01" type="number" value={form.price} />
          </label>
          <label className="field-block">
            <span>Stock quantity</span>
            <input min="0" name="stock" onChange={onChange} required type="number" value={form.stock} />
          </label>
          {feedback ? <p className="form-error">{feedback}</p> : null}
          <div className="workspace-card__actions workspace-card__actions--between">
            {form.id ? (
              <button className="danger-button workspace-inline-action" disabled={saving || deleting} onClick={onDelete} type="button">
                <PortalIcon className="workspace-submit-icon" name="close" />
                <span>{deleting ? 'Deleting...' : 'Delete Item'}</span>
              </button>
            ) : <span />}
            <button className="primary-button workspace-inline-action" disabled={saving || deleting} type="submit">
              <PortalIcon className="workspace-submit-icon" name="plus-square" />
              <span>{saving ? 'Saving...' : form.id ? 'Save Changes' : 'Add Item'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SaleModal({ feedback, form, inventory, isOpen, onAddLine, onChange, onClose, onLineChange, onRemoveLine, onSubmit, saving }) {
  if (!isOpen || !form) {
    return null;
  }

  const totalAmount = form.items.reduce((sum, line) => {
    const item = inventory.find((entry) => entry.id === Number(line.item_id));
    return sum + ((item?.price ?? 0) * Number(line.quantity || 0));
  }, 0);

  return (
    <div className="workspace-modal-backdrop" onClick={onClose} role="presentation">
      <div aria-modal="true" className="workspace-modal workspace-modal--wide" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="workspace-modal__header">
          <div className="workspace-patient-summary">
            <p className="eyebrow eyebrow--modal">Store sale</p>
            <h3>Process sale</h3>
            <div className="workspace-patient-meta">
              <span>Estimated total GHS {totalAmount.toFixed(2)}</span>
            </div>
          </div>
          <button className="ghost-button secondary-action--compact" onClick={onClose} type="button">Close</button>
        </div>
        <form className="workspace-modal__body" onSubmit={onSubmit}>
          <div className="workspace-repeatable-list">
            {form.items.map((line, index) => {
              const selected = inventory.find((entry) => entry.id === Number(line.item_id));
              return (
                <section className="workspace-form-section workspace-subsection" key={`sale-line-${index}`}>
                  <div className="panel-heading workspace-history-record__header">
                    <div>
                      <h4>Sale line {index + 1}</h4>
                      <p className="table-counter">{selected ? `${selected.stock} in stock | ${selected.priceLabel}` : 'Choose an item'}</p>
                    </div>
                    {form.items.length > 1 ? (
                      <button className="ghost-button secondary-action--compact workspace-inline-action" onClick={() => onRemoveLine(index)} type="button">Remove</button>
                    ) : null}
                  </div>
                  <div className="form-grid">
                    <label className="field-block">
                      <span>Item</span>
                      <select onChange={(event) => onLineChange(index, 'item_id', event.target.value)} required value={line.item_id}>
                        <option value="">Choose item</option>
                        {inventory.map((item) => (
                          <option key={item.id} value={item.id}>{item.name} | {item.priceLabel} | {item.stock} left</option>
                        ))}
                      </select>
                    </label>
                    <label className="field-block">
                      <span>Quantity</span>
                      <input min="1" onChange={(event) => onLineChange(index, 'quantity', event.target.value)} required type="number" value={line.quantity} />
                    </label>
                  </div>
                </section>
              );
            })}
          </div>
          {feedback ? <p className="form-error">{feedback}</p> : null}
          <div className="workspace-card__actions workspace-card__actions--between">
            <button className="ghost-button workspace-inline-action" onClick={onAddLine} type="button">
              <PortalIcon className="workspace-submit-icon" name="plus-square" />
              <span>Add item</span>
            </button>
            <button className="primary-button workspace-inline-action" disabled={saving} type="submit">
              <PortalIcon className="workspace-submit-icon" name="receipt" />
              <span>{saving ? 'Processing...' : 'Process Sale'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReceiptModal({ isOpen, onClose, onPrint, receipt }) {
  if (!isOpen || !receipt) {
    return null;
  }

  return (
    <div className="workspace-modal-backdrop" onClick={onClose} role="presentation">
      <div aria-modal="true" className="workspace-modal receipt-preview-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="workspace-modal__header">
          <div className="workspace-patient-summary">
            <p className="eyebrow eyebrow--modal">Store receipt</p>
            <h3>Sale #{receipt.saleId}</h3>
            <p>{receipt.dateLabel}</p>
          </div>
          <div className="reception-action-row">
            <button className="ghost-button secondary-action--compact workspace-inline-action" onClick={() => onPrint(receipt)} type="button">
              <PortalIcon className="workspace-submit-icon" name="receipt" />
              <span>Print receipt</span>
            </button>
            <button className="ghost-button secondary-action--compact" onClick={onClose} type="button">Close</button>
          </div>
        </div>
        <div className="workspace-modal__body">
          <div className="workspace-form-section receipt-preview-sheet">
            <div className="receipt-preview-sheet__center">
              <strong>eDENTAL CLINICS STORE</strong>
              <span>{receipt.branch || 'Main branch'}</span>
              <span>{receipt.dateLabel}</span>
            </div>
            <div className="receipt-preview-sheet__section">
              {receipt.items.map((item, index) => (
                <div className="receipt-preview-sheet__line" key={`store-receipt-${index}`}>
                  <span>{item.name} x{item.quantity}</span>
                  <span>{item.subtotalLabel}</span>
                </div>
              ))}
            </div>
            <div className="receipt-preview-sheet__section receipt-preview-sheet__totals">
              <div className="receipt-preview-sheet__line"><span>Total</span><strong>{receipt.totalAmountLabel}</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReceptionStorePage({ data, onCreateStoreItem, onDeleteStoreItem, onProcessStoreSale, onUpdateStoreItem }) {
  const [search, setSearch] = React.useState('');
  const [stockFilter, setStockFilter] = React.useState('all');
  const [page, setPage] = React.useState(1);
  const [rowsPerPage, setRowsPerPage] = React.useState(15);
  const [salesSearch, setSalesSearch] = React.useState('');
  const [salesPage, setSalesPage] = React.useState(1);
  const [salesRowsPerPage, setSalesRowsPerPage] = React.useState(10);
  const [itemModalOpen, setItemModalOpen] = React.useState(false);
  const [saleModalOpen, setSaleModalOpen] = React.useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = React.useState(false);
  const [activeReceipt, setActiveReceipt] = React.useState(null);
  const [itemForm, setItemForm] = React.useState(null);
  const [saleForm, setSaleForm] = React.useState({ items: [{ item_id: '', quantity: 1 }] });
  const [feedback, setFeedback] = React.useState('');
  const [saleFeedback, setSaleFeedback] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [saleSaving, setSaleSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const inventory = data?.items ?? [];
  const sales = data?.sales ?? [];
  const metrics = data?.metrics ?? {};
  const filteredItems = inventory.filter((item) => {
    const matchesStock = stockFilter === 'all'
      || (stockFilter === 'low' && item.stock > 0 && item.stock <= 10)
      || (stockFilter === 'out' && item.stock <= 0)
      || (stockFilter === 'ready' && item.stock > 10);
    return matchesStock && matchesSearch(item, search);
  });
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));
  const currentPage = clampPage(page, totalPages);
  const paginatedItems = filteredItems.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const filteredSales = sales.filter((sale) => matchesSaleSearch(sale, salesSearch));
  const salesTotalPages = Math.max(1, Math.ceil(filteredSales.length / salesRowsPerPage));
  const currentSalesPage = clampPage(salesPage, salesTotalPages);
  const paginatedSales = filteredSales.slice((currentSalesPage - 1) * salesRowsPerPage, currentSalesPage * salesRowsPerPage);
  const statsWidgets = [
    {
      label: 'Store Revenue Today',
      value: metrics.revenueTodayLabel ?? formatCurrency(0),
      trend: `${metrics.transactionsTodayLabel ?? '0'} sales closed today`,
      icon: 'trend',
    },
    {
      label: 'Units Sold Today',
      value: metrics.unitsSoldTodayLabel ?? '0 units',
      trend: `Average ticket ${metrics.averageSaleTodayLabel ?? formatCurrency(0)}`,
      icon: 'receipt',
    },
    {
      label: 'Low Stock Items',
      value: metrics.lowStockCountLabel ?? '0',
      trend: `${metrics.outOfStockCountLabel ?? '0'} fully out of stock`,
      icon: 'inventory',
    },
    {
      label: 'Inventory Tracked',
      value: String(inventory.length),
      trend: `${sales.length} recorded sale entries available`,
      icon: 'layers',
    },
  ];

  React.useEffect(() => {
    setPage(1);
  }, [search, stockFilter, rowsPerPage]);

  React.useEffect(() => {
    setPage((current) => clampPage(current, totalPages));
  }, [totalPages]);

  React.useEffect(() => {
    setSalesPage(1);
  }, [salesSearch, salesRowsPerPage]);

  React.useEffect(() => {
    setSalesPage((current) => clampPage(current, salesTotalPages));
  }, [salesTotalPages]);

  function openNewItem() {
    setFeedback('');
    setItemForm({ id: 0, name: '', description: '', price: '', stock: 0 });
    setItemModalOpen(true);
  }

  function openEditItem(item) {
    setFeedback('');
    setItemForm({
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      price: item.price,
      stock: item.stock,
    });
    setItemModalOpen(true);
  }

  function handleItemChange(event) {
    const { name, value } = event.target;
    setItemForm((current) => ({
      ...current,
      [name]: ['price', 'stock'].includes(name) ? value : normalizeLeadingUppercase(value),
    }));
  }

  function handleSaleLineChange(index, field, value) {
    setSaleForm((current) => ({
      ...current,
      items: current.items.map((line, lineIndex) => (
        lineIndex === index ? { ...line, [field]: value } : line
      )),
    }));
  }

  async function submitItem(event) {
    event.preventDefault();
    if (!itemForm) {
      return;
    }

    setSaving(true);
    setFeedback('');
    try {
      if (itemForm.id) {
        await onUpdateStoreItem(itemForm);
      } else {
        await onCreateStoreItem(itemForm);
      }
      setItemModalOpen(false);
      setItemForm(null);
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitSale(event) {
    event.preventDefault();
    setSaleSaving(true);
    setSaleFeedback('');
    try {
      const response = await onProcessStoreSale({
        items: saleForm.items.map((line) => ({
          item_id: Number(line.item_id),
          quantity: Number(line.quantity),
        })),
      });
      setSaleModalOpen(false);
      setActiveReceipt(response?.receipt ?? null);
      setReceiptModalOpen(Boolean(response?.receipt));
      setSaleForm({ items: [{ item_id: '', quantity: 1 }] });
    } catch (error) {
      setSaleFeedback(error.message);
    } finally {
      setSaleSaving(false);
    }
  }

  async function handleDeleteItem() {
    if (!itemForm?.id) {
      return;
    }

    const confirmed = window.confirm('Delete this store item?');
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setFeedback('');
    try {
      await onDeleteStoreItem({ id: itemForm.id });
      setItemModalOpen(false);
      setItemForm(null);
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <section className="stats-grid content-grid">
        {statsWidgets.map((item) => (
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
            <p className="eyebrow">eDental store</p>
            <h3>Inventory and sales desk</h3>
            <p>Manage live stock, process over-the-counter sales, and keep today&apos;s store turnover visible without mixing it into the clinic billing sales lane.</p>
          </div>
          <div className="workspace-card__actions reception-action-row reception-action-row--end">
            <button className="primary-button workspace-inline-action" onClick={openNewItem} type="button">
              <PortalIcon className="workspace-submit-icon" name="plus-square" />
              <span>Add item</span>
            </button>
            <button className="ghost-button workspace-inline-action" onClick={() => setSaleModalOpen(true)} type="button">
              <PortalIcon className="workspace-submit-icon" name="receipt" />
              <span>Process sale</span>
            </button>
          </div>
        </div>

        <div className="reception-filter-strip">
          <label className="field-block reception-inline-field reception-search-field">
            <span>Search store</span>
            <PortalIcon className="reception-search-icon" name="search" />
            <input onChange={(event) => setSearch(event.target.value)} placeholder="Item name, description, price..." type="text" value={search} />
          </label>
          <label className="field-block reception-inline-field">
            <span>Stock filter</span>
            <select onChange={(event) => setStockFilter(event.target.value)} value={stockFilter}>
              <option value="all">All stock levels</option>
              <option value="ready">Ready stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
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
            <p className="eyebrow">Inventory</p>
            <h3>Store items</h3>
          </div>
          <span className="table-counter">
            {filteredItems.length} results | Page {currentPage} of {totalPages}
          </span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length ? paginatedItems.map((item) => (
                <tr key={`store-item-${item.id}`}>
                  <td>
                    <strong>{item.name}</strong>
                    {item.description ? <span className="table-subcopy">{item.description}</span> : null}
                  </td>
                  <td>{item.priceLabel}</td>
                  <td>{item.stockLabel}</td>
                  <td>{item.status}</td>
                  <td>
                    <button className="clinical-workspace-button secondary-action--compact" onClick={() => openEditItem(item)} type="button">
                      Edit item
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5">No store items match the current search and stock filter.</td>
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

      <section className="module-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Recent sales</p>
            <h3>Latest branch store sales</h3>
          </div>
          <span className="table-counter">
            {filteredSales.length} results | Page {currentSalesPage} of {salesTotalPages}
          </span>
        </div>
        <div className="reception-filter-strip">
          <label className="field-block reception-inline-field reception-search-field">
            <span>Search store sales</span>
            <PortalIcon className="reception-search-icon" name="search" />
            <input onChange={(event) => setSalesSearch(event.target.value)} placeholder="Sale ID, item names, date, branch..." type="text" value={salesSearch} />
          </label>
          <label className="field-block reception-inline-field">
            <span>Sales rows</span>
            <select onChange={(event) => setSalesRowsPerPage(Number(event.target.value))} value={salesRowsPerPage}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={40}>40</option>
            </select>
          </label>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sale ID</th>
                <th>Total</th>
                <th>Units</th>
                <th>Items</th>
                <th>Branch</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSales.length ? paginatedSales.map((sale) => (
                <tr key={`store-sale-${sale.id}`}>
                  <td>
                    <strong>{sale.saleId}</strong>
                    <span className="table-subcopy">{sale.cashierLabel}</span>
                  </td>
                  <td><strong>{sale.totalAmountLabel}</strong></td>
                  <td>{sale.unitsSoldLabel}</td>
                  <td>
                    {sale.itemCountLabel}
                    {sale.itemNames ? <span className="table-subcopy">{sale.itemNames}</span> : null}
                  </td>
                  <td>{sale.branch || 'Main branch'}</td>
                  <td>{sale.createdAtLabel}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6">No store sales match the current live search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-pagination">
          <span className="table-counter">
            Showing {paginatedSales.length ? (currentSalesPage - 1) * salesRowsPerPage + 1 : 0}
            {' - '}
            {Math.min(currentSalesPage * salesRowsPerPage, filteredSales.length)} of {filteredSales.length}
          </span>
          <div className="reception-action-row">
            <button className="ghost-button secondary-action--compact" disabled={currentSalesPage <= 1} onClick={() => setSalesPage((value) => Math.max(1, value - 1))} type="button">Previous</button>
            <button className="ghost-button secondary-action--compact" disabled={currentSalesPage >= salesTotalPages} onClick={() => setSalesPage((value) => Math.min(salesTotalPages, value + 1))} type="button">Next</button>
          </div>
        </div>
      </section>

      <ItemModal
        deleting={deleting}
        feedback={feedback}
        form={itemForm}
        isOpen={itemModalOpen}
        onChange={handleItemChange}
        onClose={() => {
          setItemModalOpen(false);
          setItemForm(null);
          setFeedback('');
        }}
        onDelete={handleDeleteItem}
        onSubmit={submitItem}
        saving={saving}
      />

      <SaleModal
        feedback={saleFeedback}
        form={saleForm}
        inventory={inventory}
        isOpen={saleModalOpen}
        onAddLine={() => setSaleForm((current) => ({ ...current, items: [...current.items, { item_id: '', quantity: 1 }] }))}
        onChange={() => {}}
        onClose={() => {
          setSaleModalOpen(false);
          setSaleForm({ items: [{ item_id: '', quantity: 1 }] });
          setSaleFeedback('');
        }}
        onLineChange={handleSaleLineChange}
        onRemoveLine={(index) => setSaleForm((current) => ({ ...current, items: current.items.filter((_, lineIndex) => lineIndex !== index) }))}
        onSubmit={submitSale}
        saving={saleSaving}
      />

      <ReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        onPrint={printStoreReceipt}
        receipt={activeReceipt}
      />
    </>
  );
}
