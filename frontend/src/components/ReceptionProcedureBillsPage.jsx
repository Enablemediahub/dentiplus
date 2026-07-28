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

const ORTHODONTIC_PROCEDURES = [
  'Orthodontic treatment ( traditional braces)',
  'Orthodontic treatment ( Invisalign)',
];

function normalizeProcedureText(value) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function isOrthodonticBill(item) {
  const procedureIds = (item?.proceduresData ?? []).map((entry) => Number(entry?.procedure_id ?? 0));
  if (procedureIds.some((id) => [96, 98].includes(id))) {
    return true;
  }

  const haystack = normalizeProcedureText([
    item?.chargeSummary,
    item?.procedureSummary,
    item?.procedure,
    ...(item?.proceduresData ?? []).map((entry) => entry?.name),
  ].join(' '));

  return haystack.includes('invisalign') || (
    haystack.includes('braces') && (
      haystack.includes('orthodontic')
      || haystack.includes('traditional')
      || haystack.includes('dental braces')
    )
  );
}

function paymentHistoryForBill(history, billingId) {
  return (history ?? []).filter((item) => String(item.billingId ?? '') === String(billingId));
}

function OrthodonticPaymentBreakdown({ history }) {
  const totalPaid = history.reduce((sum, item) => sum + Number(item.paidAmount ?? 0), 0);

  if (!history.length) {
    return (
      <div className="orthodontic-payment-breakdown">
        <strong>{formatCurrency(0)}</strong>
        <span className="table-subcopy">No payment has been processed yet.</span>
      </div>
    );
  }

  return (
    <div className="orthodontic-payment-breakdown">
      <strong>{formatCurrency(totalPaid)}</strong>
      <div className="orthodontic-payment-breakdown__list">
        {history.map((entry) => {
          const transactionText = (entry.transactionIds ?? []).length
            ? `Ref: ${entry.transactionIds.join(', ')}`
            : 'No reference';
          const paymentLines = (entry.paymentLines ?? []).length
            ? entry.paymentLines
            : [{
              method: entry.paymentMethod || 'Payment',
              amountLabel: entry.paidAmountLabel,
              transactionId: (entry.transactionIds ?? []).join(', '),
            }];

          return (
            <div className="orthodontic-payment-breakdown__item" key={`orthodontic-payment-${entry.receiptNumber}`}>
              <div className="orthodontic-payment-breakdown__topline">
                <span>{entry.dateLabel || 'No date'}</span>
                <strong>{entry.paidAmountLabel}</strong>
              </div>
              <span className="table-subcopy">{entry.receiptNumber}</span>
              <div className="orthodontic-payment-breakdown__methods">
                {paymentLines.map((line, index) => (
                  <span className="table-subcopy" key={`orthodontic-payment-line-${entry.receiptNumber}-${index}`}>
                    {line.method}: {line.amountLabel}{line.transactionId ? ` (${line.transactionId})` : ''}
                  </span>
                ))}
              </div>
              <span className="table-subcopy">Processed by {entry.receptionistName || 'Reception desk'}</span>
              <span className="table-subcopy">{transactionText}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProcedureBillsTable({
  title,
  description,
  items,
  emptyMessage,
  onProcess,
  headerAction = null,
}) {
  return (
    <section className="module-card">
      <div className="panel-heading workspace-card__header">
        <div>
          <p className="eyebrow">Procedure bills</p>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <div className="reception-action-row reception-action-row--end">
          {headerAction}
          <span className="table-counter">{items.length} bills</span>
        </div>
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

function OrthodonticTrackerModal({
  isOpen,
  onClose,
  bills,
  history,
  patients,
  onCreateBill,
  onProcessPayment,
}) {
  const [search, setSearch] = React.useState('');
  const [patientSearch, setPatientSearch] = React.useState('');
  const [selectedPatientId, setSelectedPatientId] = React.useState('');
  const [procedureName, setProcedureName] = React.useState(ORTHODONTIC_PROCEDURES[0]);
  const [amount, setAmount] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSearch('');
    setPatientSearch('');
    setSelectedPatientId('');
    setProcedureName(ORTHODONTIC_PROCEDURES[0]);
    setAmount('');
    setNotes('');
    setFeedback('');
  }, [isOpen]);

  const filteredBills = React.useMemo(() => (
    bills.filter((item) => matchesSearch(item, search))
  ), [bills, search]);

  const filteredPatients = React.useMemo(() => {
    const trimmed = patientSearch.trim().toLowerCase();
    return (patients ?? []).filter((item) => {
      if (!trimmed) {
        return true;
      }

      return [
        item.patientName,
        item.folderId,
        item.oldFolderId,
        item.phone,
      ].join(' ').toLowerCase().includes(trimmed);
    }).slice(0, 12);
  }, [patientSearch, patients]);

  const selectedPatient = (patients ?? []).find((item) => String(item.id) === String(selectedPatientId)) ?? null;
  const totalBilling = filteredBills.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const totalBalance = filteredBills.reduce((sum, item) => sum + Number(item.balance ?? 0), 0);
  const totalPaid = Math.max(0, totalBilling - totalBalance);

  if (!isOpen) {
    return null;
  }

  async function handleCreateBill(event) {
    event.preventDefault();
    setSaving(true);
    setFeedback('');

    try {
      const response = await onCreateBill({
        patient_id: Number(selectedPatientId),
        procedure_name: procedureName,
        amount: Number(amount || 0),
        notes,
      });
      setFeedback(response?.message ?? 'Orthodontic tracker bill added successfully.');
      setSelectedPatientId('');
      setAmount('');
      setNotes('');
      setPatientSearch('');
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="workspace-modal-backdrop" onClick={onClose} role="presentation">
      <div aria-modal="true" className="workspace-modal workspace-modal--wide" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="workspace-modal__header">
          <div className="workspace-patient-summary">
            <p className="eyebrow eyebrow--modal">Orthodontic payment tracker</p>
            <h3>Long-term braces and Invisalign bills</h3>
            <div className="workspace-patient-meta">
              <span>{bills.length} active patients</span>
              <span>Total billing {formatCurrency(totalBilling)}</span>
              <span>Balance {formatCurrency(totalBalance)}</span>
            </div>
          </div>
          <button className="ghost-button secondary-action--compact" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="workspace-modal__body">
          {feedback ? <p className={feedback.toLowerCase().includes('success') ? 'form-success' : 'form-error'}>{feedback}</p> : null}

          <div className="frontdesk-command-grid">
            <div className="frontdesk-highlight">
              <span>Total billing</span>
              <strong>{formatCurrency(totalBilling)}</strong>
              <p>Open orthodontic bills from dentist billing plus manual tracker entries.</p>
            </div>
            <div className="frontdesk-highlight">
              <span>Total paid</span>
              <strong>{formatCurrency(totalPaid)}</strong>
              <p>Calculated from total billing less the current open balance.</p>
            </div>
          </div>

          <form className="workspace-form-section" onSubmit={handleCreateBill}>
            <div className="panel-heading workspace-history-record__header">
              <div>
                <h4>Add patient manually</h4>
                <p className="table-subcopy">Use this when reception needs to begin an orthodontic payment plan before it appears from the dentist billing queue.</p>
              </div>
            </div>
            <div className="reception-filter-strip">
              <label className="field-block reception-inline-field reception-search-field">
                <span>Search patients</span>
                <PortalIcon className="reception-search-icon" name="search" />
                <input onChange={(event) => setPatientSearch(event.target.value)} placeholder="Patient, folder, phone..." type="text" value={patientSearch} />
              </label>
              <label className="field-block reception-inline-field">
                <span>Selected patient</span>
                <select onChange={(event) => setSelectedPatientId(event.target.value)} value={selectedPatientId}>
                  <option value="">Choose patient</option>
                  {filteredPatients.map((item) => (
                    <option key={`orthodontic-patient-${item.id}`} value={item.id}>
                      {item.patientName} | {item.folderId}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label className="field-block">
                <span>Procedure</span>
                <select onChange={(event) => setProcedureName(event.target.value)} value={procedureName}>
                  {ORTHODONTIC_PROCEDURES.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="field-block">
                <span>Total bill</span>
                <input min="0" onChange={(event) => setAmount(event.target.value)} placeholder="0.00" step="0.01" type="number" value={amount} />
              </label>
              <label className="field-block field-block--wide">
                <span>Tracker note</span>
                <textarea onChange={(event) => setNotes(event.target.value)} placeholder="Payment plan note, expected duration, or manual billing reason" rows={3} value={notes} />
              </label>
              <label className="field-block field-block--wide">
                <span>Patient preview</span>
                <input readOnly type="text" value={selectedPatient ? `${selectedPatient.patientName} | ${selectedPatient.folderId}` : 'Choose a patient above'} />
              </label>
            </div>
            <div className="workspace-card__actions">
              <button className="primary-button" disabled={saving || !selectedPatientId || Number(amount || 0) <= 0} type="submit">
                <PortalIcon className="workspace-submit-icon" name="plus-square" />
                <span>{saving ? 'Adding...' : 'Add to orthodontic tracker'}</span>
              </button>
            </div>
          </form>

          <div className="workspace-form-section">
            <div className="panel-heading workspace-history-record__header">
              <div>
                <h4>Tracked orthodontic bills</h4>
                <p className="table-subcopy">Dentist-created braces and Invisalign bills appear here automatically while they still have a balance.</p>
              </div>
              <label className="field-block reception-inline-field reception-search-field orthodontic-tracker-search">
                <span>Search tracker</span>
                <PortalIcon className="reception-search-icon" name="search" />
                <input onChange={(event) => setSearch(event.target.value)} placeholder="Bill, patient, payment, receptionist..." type="text" value={search} />
              </label>
            </div>

            <div className="table-wrap">
              <table className="data-table payments-open-bills-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Procedure</th>
                    <th>Total</th>
                    <th>Balance</th>
                    <th>Past payments</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBills.length ? filteredBills.map((item) => {
                    const billHistory = paymentHistoryForBill(history, item.billingId);

                    return (
                      <tr key={`orthodontic-tracker-${item.billingId}`}>
                        <td>
                          <strong>{item.patientName}</strong>
                          <span className="table-subcopy">{item.bill} | {item.dentistName}</span>
                        </td>
                        <td className="payments-open-bills-table__charge-cell">
                          <div className="payments-open-bills-table__charge-copy" title={item.chargeSummary}>{item.chargeSummary}</div>
                        </td>
                        <td><strong>{item.amountLabel}</strong></td>
                        <td className="table-balance-negative"><strong>{item.balanceLabel}</strong></td>
                        <td>
                          <OrthodonticPaymentBreakdown history={billHistory} />
                        </td>
                        <td>
                          <button className="clinical-workspace-button secondary-action--compact" onClick={() => onProcessPayment(item)} type="button">
                            Process payment
                          </button>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan="6">No active traditional braces or Invisalign bills match this tracker.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReceptionProcedureBillsPage({
  billing,
  onCreateBillingPayment,
  onCreateOrthodonticBill,
  patients,
}) {
  const [search, setSearch] = React.useState('');
  const [selectedBill, setSelectedBill] = React.useState(null);
  const [orthodonticTrackerOpen, setOrthodonticTrackerOpen] = React.useState(false);
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

  const orthodonticBills = React.useMemo(() => (
    openProcedureBills.filter(isOrthodonticBill)
  ), [openProcedureBills]);

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
        headerAction={(
          <button className="primary-button workspace-inline-action" onClick={() => setOrthodonticTrackerOpen(true)} type="button">
            <PortalIcon className="workspace-submit-icon" name="briefcase" />
            <span>Orthodontic tracker</span>
          </button>
        )}
        items={pendingBilling}
        onProcess={setSelectedBill}
        title="Pending billing"
      />

      <OrthodonticTrackerModal
        bills={orthodonticBills}
        history={billing?.history ?? []}
        isOpen={orthodonticTrackerOpen}
        onClose={() => setOrthodonticTrackerOpen(false)}
        onCreateBill={onCreateOrthodonticBill}
        onProcessPayment={(item) => {
          setOrthodonticTrackerOpen(false);
          setSelectedBill(item);
        }}
        patients={patients?.items ?? []}
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
