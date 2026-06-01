import React from 'react';
import { PortalIcon } from './PortalIcon';
import {
  PaymentProcessingModal,
  ReceiptPreviewModal,
  printThermalReceipt,
} from './ReceptionPaymentsPage';

function formatCurrency(value) {
  return `GHS ${Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function matchesSearch(item, query) {
  const trimmed = String(query ?? '').trim().toLowerCase();
  if (!trimmed) {
    return true;
  }

  return [
    item.bill,
    item.patientName,
    item.chargeSummary,
    item.dentistName,
    item.status,
    item.notes,
    item.balanceLabel,
    item.amountLabel,
  ].join(' ').toLowerCase().includes(trimmed);
}

function ProcedureBillsTable({
  title,
  description,
  items,
  emptyMessage,
  onProcess,
}) {
  return (
    <section className="module-card">
      <div className="panel-heading workspace-card__header">
        <div>
          <p className="eyebrow">Procedure bills</p>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span className="table-counter">{items.length} bills</span>
      </div>
      <div className="table-wrap">
        <table className="data-table payments-open-bills-table">
          <colgroup>
            <col className="payments-open-bills-table__col-bill" />
            <col className="payments-open-bills-table__col-patient" />
            <col className="payments-open-bills-table__col-charge" />
            <col className="payments-open-bills-table__col-total" />
            <col className="payments-open-bills-table__col-balance" />
            <col className="payments-open-bills-table__col-status" />
            <col className="payments-open-bills-table__col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th>Bill</th>
              <th>Patient</th>
              <th>Charge</th>
              <th>Total</th>
              <th>Balance</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.length ? items.map((item) => (
              <tr key={`procedure-bill-${title}-${item.billingId}`}>
                <td className="payments-open-bills-table__bill-cell">{item.bill}</td>
                <td className="payments-open-bills-table__patient-cell">
                  <strong>{item.patientName}</strong>
                  <span className="table-subcopy">{item.dentistName}</span>
                </td>
                <td className="payments-open-bills-table__charge-cell">
                  <div className="payments-open-bills-table__charge-copy" title={item.chargeSummary}>{item.chargeSummary}</div>
                </td>
                <td className="payments-open-bills-table__money-cell"><strong>{item.amountLabel}</strong></td>
                <td className="table-balance-negative payments-open-bills-table__money-cell"><strong>{item.balanceLabel}</strong></td>
                <td className="payments-open-bills-table__status-cell">
                  <div className="payments-open-bills-table__status-copy">{item.status}</div>
                </td>
                <td className="payments-open-bills-table__actions-cell">
                  <div className="reception-action-row payments-open-bills-table__actions-row">
                    <button className="clinical-workspace-button secondary-action--compact" onClick={() => onProcess(item)} type="button">
                      Process payment
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="7">{emptyMessage}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ReceptionProcedureBillsPage({
  billing,
  onCreateBillingPayment,
}) {
  const [search, setSearch] = React.useState('');
  const [selectedBill, setSelectedBill] = React.useState(null);
  const [successMessage, setSuccessMessage] = React.useState('');
  const [receiptModalOpen, setReceiptModalOpen] = React.useState(false);
  const [activeReceipt, setActiveReceipt] = React.useState(null);

  const openProcedureBills = React.useMemo(() => (
    (billing?.items ?? []).filter((item) => item.billType === 'procedure_charge')
  ), [billing]);

  const searchedBills = React.useMemo(() => (
    openProcedureBills.filter((item) => matchesSearch(item, search))
  ), [openProcedureBills, search]);

  const newBilling = React.useMemo(() => (
    searchedBills.filter((item) => String(item.status ?? '').toLowerCase() === 'pending')
  ), [searchedBills]);

  const pendingBilling = React.useMemo(() => (
    searchedBills.filter((item) => String(item.status ?? '').toLowerCase() === 'partially paid')
  ), [searchedBills]);

  const totalOpenBalance = searchedBills.reduce((sum, item) => sum + Number(item.balance ?? 0), 0);
  const totalOpenAmount = searchedBills.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);

  return (
    <>
      <section className="stats-grid content-grid">
        <article className="stat-card">
          <div className="stat-card-icon">
            <PortalIcon className="nav-icon stat-card-icon-svg" name="receipt" />
          </div>
          <span className="stat-card__label">Procedure bills</span>
          <h3>{openProcedureBills.length}</h3>
          <p className="stat-card__trend">All open procedure-charge bills currently waiting on reception.</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-icon">
            <PortalIcon className="nav-icon stat-card-icon-svg" name="clock" />
          </div>
          <span className="stat-card__label">New billing</span>
          <h3>{newBilling.length}</h3>
          <p className="stat-card__trend">Freshly raised procedure bills that have not received any payment yet.</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-icon">
            <PortalIcon className="nav-icon stat-card-icon-svg" name="trend" />
          </div>
          <span className="stat-card__label">Pending billing</span>
          <h3>{pendingBilling.length}</h3>
          <p className="stat-card__trend">Partially paid procedure bills that still need follow-up clearance.</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-icon">
            <PortalIcon className="nav-icon stat-card-icon-svg" name="finance" />
          </div>
          <span className="stat-card__label">Open-bill balance</span>
          <h3>{formatCurrency(totalOpenBalance)}</h3>
          <p className="stat-card__trend">{formatCurrency(totalOpenAmount)} total raised across the visible procedure bills.</p>
        </article>
      </section>

      <section className="module-card reception-toolbar-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Procedure bills desk</p>
            <h3>Reception processing for procedure charges</h3>
            <p>Keep dentist-raised bills separated from the wider payments workspace, then move straight into the same payment modal used on the main payments page.</p>
          </div>
        </div>

        {successMessage ? <p className="form-success">{successMessage}</p> : null}

        <div className="reception-filter-strip">
          <label className="field-block reception-inline-field reception-search-field">
            <span>Search procedure bills</span>
            <PortalIcon className="reception-search-icon" name="search" />
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Bill, patient, charge, dentist, status..."
              type="text"
              value={search}
            />
          </label>
        </div>
      </section>

      <ProcedureBillsTable
        description="These are newly created procedure-charge bills that are ready for first payment processing."
        emptyMessage="No new procedure bills match the current search."
        items={newBilling}
        onProcess={setSelectedBill}
        title="New billing"
      />

      <ProcedureBillsTable
        description="These procedure bills already have a payment history and still need balance clearance."
        emptyMessage="No pending procedure bills match the current search."
        items={pendingBilling}
        onProcess={setSelectedBill}
        title="Pending billing"
      />

      <PaymentProcessingModal
        bill={selectedBill}
        isOpen={Boolean(selectedBill)}
        onClose={() => setSelectedBill(null)}
        onPaymentSaved={(receipt, message = '') => {
          if (message) {
            setSuccessMessage(message);
          }
          if (receipt) {
            setActiveReceipt(receipt);
            setReceiptModalOpen(true);
          }
        }}
        onSubmit={onCreateBillingPayment}
      />

      <ReceiptPreviewModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        onPrint={printThermalReceipt}
        receipt={activeReceipt}
      />
    </>
  );
}
