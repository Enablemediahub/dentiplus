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

function matchesSearch(item, query) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }

  return [
    item.bill,
    item.patientName,
    item.procedure,
    item.chargeSummary,
    item.dentistName,
    item.status,
    item.notes,
    item.billTypeLabel,
  ]
    .join(' ')
    .toLowerCase()
    .includes(trimmed);
}

function matchesBillFilters(item, billTypeFilter, statusFilter) {
  const matchesBillType = billTypeFilter === 'all' || item.billType === billTypeFilter;
  const normalizedStatus = String(item.status ?? '').toLowerCase().replace(/\s+/g, '_');
  const matchesStatus = statusFilter === 'all' || normalizedStatus === statusFilter;
  return matchesBillType && matchesStatus;
}

function printThermalReceipt(receipt) {
  const popup = window.open('', '_blank', 'width=420,height=720');
  if (!popup) {
    return;
  }

  const insuranceSection = receipt.insurance ? `
    <div class="section">
      <div class="section-title">Insurance</div>
      <div class="line"><span>Type</span><span>${receipt.insurance.insuranceType || '-'}</span></div>
      <div class="line"><span>Covered</span><span>${receipt.insurance.coveredAmountLabel}</span></div>
      <div class="line"><span>Number</span><span>${receipt.insurance.insuranceNumber || '-'}</span></div>
    </div>
  ` : '';

  const billDetail = receipt.bill.billType === 'frontdesk_fees'
    ? `
      <div class="section">
        <div class="section-title">Frontdesk Fees</div>
        <div class="line"><span>Registration</span><span>${receipt.bill.registrationFeeLabel}</span></div>
        <div class="line"><span>Consultation</span><span>${receipt.bill.consultationFeeLabel}</span></div>
      </div>
    `
    : `
      <div class="section">
        <div class="section-title">Procedures</div>
        ${receipt.bill.proceduresData.map((entry) => `<div class="line"><span>${entry.name}</span><span>${formatCurrency(entry.amount)}</span></div>`).join('')}
      </div>
    `;

  popup.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${receipt.receiptNumber}</title>
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
            <div class="title">eDENTAL CLINICS</div>
            <div class="small">Thermal receipt</div>
            <div class="small">${receipt.receiptNumber}</div>
            <div class="small">${receipt.createdAtLabel}</div>
          </div>
          <div class="section">
            <div class="line"><span>Patient</span><span>${receipt.bill.patientName}</span></div>
            <div class="line"><span>Bill</span><span>${receipt.bill.bill}</span></div>
            <div class="line"><span>Charge Type</span><span>${receipt.bill.billTypeLabel}</span></div>
            <div class="line"><span>Dentist</span><span>${receipt.bill.dentistName}</span></div>
          </div>
          ${billDetail}
          <div class="section">
            <div class="section-title">Payments</div>
            ${receipt.paymentLines.map((line) => `<div class="line"><span>${line.method}${line.transactionId ? ` (${line.transactionId})` : ''}</span><span>${line.amountLabel}</span></div>`).join('')}
          </div>
          ${insuranceSection}
          <div class="totals">
            <div class="line"><span>Total Bill</span><span>${receipt.bill.amountLabel}</span></div>
            <div class="line strong"><span>Total Paid</span><span>${receipt.totalPaidLabel}</span></div>
            <div class="line"><span>Balance</span><span>${receipt.bill.balanceLabel}</span></div>
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

function FrontdeskBillingModal({ isOpen, onClose, onSubmit, patients }) {
  const [search, setSearch] = React.useState('');
  const [selectedPatientId, setSelectedPatientId] = React.useState('');
  const [registrationFee, setRegistrationFee] = React.useState('50');
  const [consultationFee, setConsultationFee] = React.useState('100');
  const [notes, setNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSearch('');
    setSelectedPatientId('');
    setRegistrationFee('50');
    setConsultationFee('100');
    setNotes('');
    setFeedback('');
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const filteredPatients = (patients ?? []).filter((item) => {
    const trimmed = search.trim().toLowerCase();
    if (!trimmed) {
      return true;
    }

    return [
      item.patientName,
      item.folderId,
      item.oldFolderId,
      item.phone,
      item.visitReason,
    ]
      .join(' ')
      .toLowerCase()
      .includes(trimmed);
  });

  const selectedPatient = filteredPatients.find((item) => String(item.id) === String(selectedPatientId))
    ?? (patients ?? []).find((item) => String(item.id) === String(selectedPatientId))
    ?? null;
  const total = Number(registrationFee || 0) + Number(consultationFee || 0);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setFeedback('');

    try {
      const response = await onSubmit({
        patient_id: Number(selectedPatientId),
        registration_fee: Number(registrationFee),
        consultation_fee: Number(consultationFee),
        notes,
      });
      onClose(response?.bill ?? null);
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="workspace-modal-backdrop" onClick={() => onClose(null)} role="presentation">
      <div aria-modal="true" className="workspace-modal workspace-modal--wide" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="workspace-modal__header">
          <div>
            <p className="eyebrow eyebrow--modal">Consultation and registration</p>
            <h3>Create frontdesk bill</h3>
            <p>Build the registration and consultation bill here, then send it straight into the payment modal for settlement.</p>
          </div>
          <button className="ghost-button secondary-action--compact" onClick={() => onClose(null)} type="button">
            Close
          </button>
        </div>

        <form className="workspace-modal__body" onSubmit={handleSubmit}>
          <div className="workspace-form-section">
            <div className="reception-filter-strip">
              <label className="field-block reception-inline-field reception-search-field">
                <span>Search patients</span>
                <PortalIcon className="reception-search-icon" name="search" />
                <input onChange={(event) => setSearch(event.target.value)} placeholder="Patient, folder, phone..." type="text" value={search} />
              </label>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Folder</th>
                    <th>Patient</th>
                    <th>Visit reason</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.slice(0, 12).map((item) => (
                    <tr key={`frontdesk-patient-${item.id}`}>
                      <td>
                        <input checked={String(selectedPatientId) === String(item.id)} onChange={() => setSelectedPatientId(String(item.id))} type="radio" />
                      </td>
                      <td>{item.folderId}</td>
                      <td>{item.patientName}</td>
                      <td>{item.visitReason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="workspace-form-section">
            <h4>Fee breakdown</h4>
            <div className="form-grid">
              <label className="field-block">
                <span>Selected patient</span>
                <input readOnly type="text" value={selectedPatient ? `${selectedPatient.patientName} | ${selectedPatient.folderId}` : 'Choose a patient above'} />
              </label>
              <label className="field-block">
                <span>Total</span>
                <input readOnly type="text" value={formatCurrency(total)} />
              </label>
              <label className="field-block">
                <span>Registration fee</span>
                <input min="0" onChange={(event) => setRegistrationFee(event.target.value)} step="0.01" type="number" value={registrationFee} />
              </label>
              <label className="field-block">
                <span>Consultation fee</span>
                <input min="0" onChange={(event) => setConsultationFee(event.target.value)} step="0.01" type="number" value={consultationFee} />
              </label>
              <label className="field-block field-block--wide">
                <span>Notes</span>
                <textarea onChange={(event) => setNotes(event.target.value)} placeholder="Any walk-in billing note or desk remark" rows={3} value={notes} />
              </label>
            </div>
          </div>

          {feedback ? <p className="form-error">{feedback}</p> : null}

          <div className="workspace-card__actions">
            <button className="primary-button" disabled={saving || !selectedPatientId} type="submit">
              <PortalIcon className="workspace-submit-icon" name="receipt" />
              <span>{saving ? 'Creating bill...' : 'Create bill and continue to payment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReceiptPreviewModal({ isOpen, onClose, onPrint, receipt }) {
  if (!isOpen || !receipt) {
    return null;
  }

  return (
    <div className="workspace-modal-backdrop" onClick={onClose} role="presentation">
      <div aria-modal="true" className="workspace-modal receipt-preview-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="workspace-modal__header">
          <div>
            <p className="eyebrow eyebrow--modal">Thermal receipt</p>
            <h3>{receipt.receiptNumber}</h3>
            <p>{receipt.createdAtLabel}</p>
          </div>
          <div className="reception-action-row">
            <button className="ghost-button secondary-action--compact workspace-inline-action" onClick={() => onPrint(receipt)} type="button">
              <PortalIcon className="workspace-submit-icon" name="receipt" />
              <span>Print receipt</span>
            </button>
            <button className="ghost-button secondary-action--compact" onClick={onClose} type="button">
              Close
            </button>
          </div>
        </div>

        <div className="workspace-modal__body">
          <div className="workspace-form-section receipt-preview-sheet">
            <div className="receipt-preview-sheet__center">
              <strong>eDENTAL CLINICS</strong>
              <span>{receipt.receiptNumber}</span>
              <span>{receipt.createdAtLabel}</span>
            </div>

            <div className="receipt-preview-sheet__section">
              <div className="receipt-preview-sheet__line"><span>Patient</span><span>{receipt.bill.patientName}</span></div>
              <div className="receipt-preview-sheet__line"><span>Bill</span><span>{receipt.bill.bill}</span></div>
              <div className="receipt-preview-sheet__line"><span>Charge Type</span><span>{receipt.bill.billTypeLabel}</span></div>
              <div className="receipt-preview-sheet__line"><span>Dentist</span><span>{receipt.bill.dentistName}</span></div>
            </div>

            <div className="receipt-preview-sheet__section">
              <strong>Charge detail</strong>
              {receipt.bill.billType === 'frontdesk_fees' ? (
                <>
                  <div className="receipt-preview-sheet__line"><span>Registration</span><span>{receipt.bill.registrationFeeLabel}</span></div>
                  <div className="receipt-preview-sheet__line"><span>Consultation</span><span>{receipt.bill.consultationFeeLabel}</span></div>
                </>
              ) : (
                receipt.bill.proceduresData.map((entry, index) => (
                  <div className="receipt-preview-sheet__line" key={`receipt-procedure-${index}`}>
                    <span>{entry.name}</span>
                    <span>{formatCurrency(entry.amount)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="receipt-preview-sheet__section">
              <strong>Payments</strong>
              {receipt.paymentLines.map((line) => (
                <div className="receipt-preview-sheet__line" key={`receipt-payment-${line.paymentId}`}>
                  <span>{line.method}{line.transactionId ? ` (${line.transactionId})` : ''}</span>
                  <span>{line.amountLabel}</span>
                </div>
              ))}
            </div>

            {receipt.insurance ? (
              <div className="receipt-preview-sheet__section">
                <strong>Insurance</strong>
                <div className="receipt-preview-sheet__line"><span>Type</span><span>{receipt.insurance.insuranceType}</span></div>
                <div className="receipt-preview-sheet__line"><span>Covered</span><span>{receipt.insurance.coveredAmountLabel}</span></div>
              </div>
            ) : null}

            <div className="receipt-preview-sheet__section receipt-preview-sheet__totals">
              <div className="receipt-preview-sheet__line"><span>Total bill</span><span>{receipt.bill.amountLabel}</span></div>
              <div className="receipt-preview-sheet__line"><span>Total paid</span><strong>{receipt.totalPaidLabel}</strong></div>
              <div className="receipt-preview-sheet__line"><span>Balance</span><span>{receipt.bill.balanceLabel}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceiptHistoryModal({ history, isOpen, onClose, onReprint, receiptLoading }) {
  const [page, setPage] = React.useState(1);
  const rowsPerPage = 15;
  const totalPages = Math.max(1, Math.ceil(history.length / rowsPerPage));
  const currentPage = clampPage(page, totalPages);
  const paginatedHistory = history.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  React.useEffect(() => {
    if (!isOpen) {
      setPage(1);
      return;
    }

    setPage((current) => clampPage(current, totalPages));
  }, [isOpen, totalPages]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="workspace-modal-backdrop" onClick={onClose} role="presentation">
      <div aria-modal="true" className="workspace-modal workspace-modal--wide" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="workspace-modal__header">
          <div className="workspace-patient-summary">
            <p className="eyebrow eyebrow--modal">Recent receipts</p>
            <h3>Thermal reprint desk</h3>
            <div className="workspace-patient-meta">
              <span>{history.length} receipts</span>
              <span>Page {currentPage} of {totalPages}</span>
            </div>
          </div>
          <button className="ghost-button secondary-action--compact" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="workspace-modal__body">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Patient</th>
                  <th>Method(s)</th>
                  <th>Paid</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedHistory.length ? paginatedHistory.map((item) => (
                  <tr key={`payment-history-${item.receiptNumber}`}>
                    <td>
                      <strong>{item.receiptNumber}</strong>
                      <span className="table-subcopy">{item.bill}</span>
                    </td>
                    <td>{item.patientName}</td>
                    <td>{item.paymentMethod}</td>
                    <td>{item.paidAmountLabel}</td>
                    <td>{item.dateLabel}</td>
                    <td>
                      <button className="ghost-button secondary-action--compact workspace-inline-action" disabled={receiptLoading} onClick={() => onReprint(item.receiptNumber)} type="button">
                        <PortalIcon className="workspace-submit-icon" name="receipt" />
                        <span>{receiptLoading ? 'Loading...' : 'Reprint'}</span>
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="6">No payments have been recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="table-pagination">
            <span className="table-counter">
              Showing {paginatedHistory.length ? (currentPage - 1) * rowsPerPage + 1 : 0}
              {' - '}
              {Math.min(currentPage * rowsPerPage, history.length)} of {history.length}
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
        </div>
      </div>
    </div>
  );
}

function PaymentProcessingModal({ bill, isOpen, onClose, onSubmit, onPaymentSaved }) {
  const [status, setStatus] = React.useState('partially_paid');
  const [payments, setPayments] = React.useState([{ method: 'cash', amount: '', transaction_id: '' }]);
  const [insurance, setInsurance] = React.useState({
    insurance_type: '',
    company: '',
    insurance_number: '',
    insurance_category: '',
    expiry_date: '',
    insurance_covered_amount: '',
  });
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');

  React.useEffect(() => {
    if (!isOpen || !bill) {
      return;
    }

    setStatus(Number(bill.balance ?? 0) > 0 ? 'partially_paid' : 'completed');
    setPayments([{ method: 'cash', amount: '', transaction_id: '' }]);
    setInsurance({
      insurance_type: '',
      company: '',
      insurance_number: '',
      insurance_category: '',
      expiry_date: '',
      insurance_covered_amount: '',
    });
    setFeedback('');
  }, [isOpen, bill]);

  if (!isOpen || !bill) {
    return null;
  }

  function updatePayment(index, field, value) {
    setPayments((current) => current.map((entry, entryIndex) => (
      entryIndex === index ? { ...entry, [field]: value } : entry
    )));
  }

  function addPaymentLine() {
    setPayments((current) => [...current, { method: 'cash', amount: '', transaction_id: '' }]);
  }

  function removePaymentLine(index) {
    setPayments((current) => (current.length > 1 ? current.filter((_, entryIndex) => entryIndex !== index) : current));
  }

  const totalEntered = payments.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const usesInsurance = payments.some((entry) => entry.method === 'insurance');

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setFeedback('');

    try {
      const response = await onSubmit({
        billing_id: bill.billingId,
        status,
        payments: payments.map((entry) => ({
          method: entry.method,
          amount: Number(entry.amount),
          transaction_id: entry.transaction_id,
        })),
        insurance: {
          ...insurance,
          insurance_covered_amount: Number(insurance.insurance_covered_amount),
        },
      });
      onPaymentSaved(response?.receipt ?? null);
      onClose();
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
            <p className="eyebrow eyebrow--modal">Payment modal</p>
            <h3>Process {bill.bill}</h3>
            <div className="workspace-patient-meta">
              <span>{bill.patientName}</span>
              <span>{bill.billTypeLabel}</span>
              <span>{bill.dentistName}</span>
              <span>Balance {bill.balanceLabel}</span>
            </div>
          </div>
          <button className="ghost-button secondary-action--compact" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <form className="workspace-modal__body" onSubmit={handleSubmit}>
          <div className="workspace-form-section">
            <h4>Bill summary</h4>
            <div className="form-grid">
              <label className="field-block field-block--wide">
                <span>Charge summary</span>
                <input readOnly type="text" value={bill.chargeSummary} />
              </label>
              <label className="field-block">
                <span>Total bill</span>
                <input readOnly type="text" value={bill.amountLabel} />
              </label>
              <label className="field-block">
                <span>Current balance</span>
                <input readOnly type="text" value={bill.balanceLabel} />
              </label>
              {bill.billType === 'frontdesk_fees' ? (
                <>
                  <label className="field-block">
                    <span>Registration fee</span>
                    <input readOnly type="text" value={bill.registrationFeeLabel} />
                  </label>
                  <label className="field-block">
                    <span>Consultation fee</span>
                    <input readOnly type="text" value={bill.consultationFeeLabel} />
                  </label>
                </>
              ) : null}
            </div>
          </div>

          <label className="field-block">
            <span>Payment status</span>
            <select onChange={(event) => setStatus(event.target.value)} value={status}>
              <option value="partially_paid">Partially paid</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>

          {status !== 'rejected' ? payments.map((entry, index) => (
            <div className="workspace-form-section" key={`payment-line-${index}`}>
              <div className="panel-heading workspace-history-record__header">
                <div>
                  <h4>Payment line {index + 1}</h4>
                  <div className="workspace-record-meta">
                    <span className="workspace-edited-chip">Entered total {formatCurrency(totalEntered)}</span>
                  </div>
                </div>
                {payments.length > 1 ? (
                  <button className="ghost-button secondary-action--compact workspace-inline-action" onClick={() => removePaymentLine(index)} type="button">
                    Remove
                  </button>
                ) : null}
              </div>

              <div className="form-grid">
                <label className="field-block">
                  <span>Method</span>
                  <select onChange={(event) => updatePayment(index, 'method', event.target.value)} value={entry.method}>
                    <option value="cash">Cash</option>
                    <option value="mobile_money">Mobile Money</option>
                    <option value="card">Card / Paystack</option>
                    <option value="insurance">Insurance</option>
                  </select>
                </label>

                <label className="field-block">
                  <span>Amount</span>
                  <input min="0" onChange={(event) => updatePayment(index, 'amount', event.target.value)} placeholder="0.00" step="0.01" type="number" value={entry.amount} />
                </label>

                <label className="field-block field-block--wide">
                  <span>Transaction ID</span>
                  <input onChange={(event) => updatePayment(index, 'transaction_id', event.target.value)} placeholder="Required for Mobile Money or Card" type="text" value={entry.transaction_id} />
                </label>
              </div>
            </div>
          )) : null}

          {status !== 'rejected' ? (
            <button className="ghost-button workspace-inline-action" onClick={addPaymentLine} type="button">
              <PortalIcon className="workspace-submit-icon" name="plus-square" />
              <span>Add another payment method</span>
            </button>
          ) : null}

          {usesInsurance ? (
            <div className="workspace-form-section">
              <h4>Insurance details</h4>
              <div className="form-grid">
                <label className="field-block">
                  <span>Insurance type</span>
                  <select onChange={(event) => setInsurance((current) => ({ ...current, insurance_type: event.target.value }))} value={insurance.insurance_type}>
                    <option value="">Choose insurance type</option>
                    <option value="Cosmopolitan Health Insurance">Cosmopolitan Health Insurance</option>
                    <option value="Equity Health Insurance">Equity Health Insurance</option>
                    <option value="Glico">Glico</option>
                    <option value="Premier Health Insurance">Premier Health Insurance</option>
                    <option value="Acacia">Acacia</option>
                    <option value="Metropolitan">Metropolitan</option>
                    <option value="ACE Health Insurance">ACE Health Insurance</option>
                    <option value="GAB Insurance">GAB Insurance</option>
                  </select>
                </label>
                <label className="field-block">
                  <span>Covered amount</span>
                  <input min="0" onChange={(event) => setInsurance((current) => ({ ...current, insurance_covered_amount: event.target.value }))} placeholder="0.00" step="0.01" type="number" value={insurance.insurance_covered_amount} />
                </label>
                <label className="field-block">
                  <span>Insurance number</span>
                  <input onChange={(event) => setInsurance((current) => ({ ...current, insurance_number: event.target.value }))} placeholder="Membership or card number" type="text" value={insurance.insurance_number} />
                </label>
                <label className="field-block">
                  <span>Expiry date</span>
                  <input onChange={(event) => setInsurance((current) => ({ ...current, expiry_date: event.target.value }))} type="date" value={insurance.expiry_date} />
                </label>
                <label className="field-block">
                  <span>Company</span>
                  <input onChange={(event) => setInsurance((current) => ({ ...current, company: event.target.value }))} placeholder="Optional company" type="text" value={insurance.company} />
                </label>
                <label className="field-block">
                  <span>Category</span>
                  <input onChange={(event) => setInsurance((current) => ({ ...current, insurance_category: event.target.value }))} placeholder="Benefit category" type="text" value={insurance.insurance_category} />
                </label>
              </div>
            </div>
          ) : null}

          {feedback ? <p className="form-error">{feedback}</p> : null}

          <div className="workspace-card__actions">
            <button className="primary-button" disabled={saving} type="submit">
              <PortalIcon className="workspace-submit-icon" name="receipt" />
              <span>{saving ? 'Saving payment...' : 'Process payment and issue receipt'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ReceptionPaymentsPage({
  billing,
  onCreateBillingPayment,
  onCreateFrontdeskBill,
  onDeleteBilling,
  onLoadReceipt,
  patients,
}) {
  const [search, setSearch] = React.useState('');
  const [billTypeFilter, setBillTypeFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [rowsPerPage, setRowsPerPage] = React.useState(15);
  const [page, setPage] = React.useState(1);
  const [selectedBill, setSelectedBill] = React.useState(null);
  const [frontdeskModalOpen, setFrontdeskModalOpen] = React.useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = React.useState(false);
  const [receiptHistoryModalOpen, setReceiptHistoryModalOpen] = React.useState(false);
  const [activeReceipt, setActiveReceipt] = React.useState(null);
  const [receiptLoading, setReceiptLoading] = React.useState(false);
  const [deletingBillingId, setDeletingBillingId] = React.useState(null);

  const items = billing?.items ?? [];
  const history = billing?.history ?? [];
  const filteredItems = items.filter((item) => matchesSearch(item, search) && matchesBillFilters(item, billTypeFilter, statusFilter));
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));
  const currentPage = clampPage(page, totalPages);
  const paginatedItems = filteredItems.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  React.useEffect(() => {
    setPage(1);
  }, [search, rowsPerPage, billTypeFilter, statusFilter]);

  React.useEffect(() => {
    setPage((current) => clampPage(current, totalPages));
  }, [totalPages]);

  async function handleReprint(receiptNumber) {
    setReceiptLoading(true);
    try {
      const receipt = await onLoadReceipt(receiptNumber);
      setActiveReceipt(receipt);
      setReceiptModalOpen(true);
    } finally {
      setReceiptLoading(false);
    }
  }

  async function handleDeleteBill(item) {
    const confirmed = window.confirm(`Delete ${item.bill} for ${item.patientName}? Use this only for duplicate unpaid bills.`);
    if (!confirmed) {
      return;
    }

    setDeletingBillingId(item.billingId);
    try {
      await onDeleteBilling({ billing_id: item.billingId });
      if (selectedBill?.billingId === item.billingId) {
        setSelectedBill(null);
      }
    } catch (error) {
      window.alert(error.message);
    } finally {
      setDeletingBillingId(null);
    }
  }

  return (
    <>
      <section className="module-card reception-toolbar-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Payments and receipts</p>
            <h3>Reception payment desk</h3>
            <p>Process grouped dentist procedure bills, create consultation and registration charges, and print thermal receipts from one billing modal.</p>
          </div>
          <div className="workspace-card__actions reception-action-row reception-action-row--end">
            <button className="primary-button workspace-inline-action" onClick={() => setFrontdeskModalOpen(true)} type="button">
              <PortalIcon className="workspace-submit-icon" name="plus-square" />
              <span>Consultation / registration bill</span>
            </button>
            <button className="ghost-button workspace-inline-action" onClick={() => setReceiptHistoryModalOpen(true)} type="button">
              <PortalIcon className="workspace-submit-icon" name="receipt" />
              <span>Recent receipts</span>
            </button>
          </div>
        </div>

        <div className="reception-filter-strip">
          <label className="field-block reception-inline-field reception-search-field">
            <span>Search open bills</span>
            <PortalIcon className="reception-search-icon" name="search" />
            <input onChange={(event) => setSearch(event.target.value)} placeholder="Bill, patient, charge, dentist..." type="text" value={search} />
          </label>
          <label className="field-block reception-inline-field">
            <span>Bill type</span>
            <select onChange={(event) => setBillTypeFilter(event.target.value)} value={billTypeFilter}>
              <option value="all">All bill types</option>
              <option value="procedure_charge">Procedure charges</option>
              <option value="frontdesk_fees">Consultation / registration</option>
            </select>
          </label>
          <label className="field-block reception-inline-field">
            <span>Status</span>
            <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="all">All open statuses</option>
              <option value="pending">Pending</option>
              <option value="partially_paid">Partially paid</option>
            </select>
          </label>
          <label className="field-block reception-inline-field">
            <span>Rows per page</span>
            <select value={rowsPerPage} onChange={(event) => setRowsPerPage(Number(event.target.value))}>
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={45}>45</option>
            </select>
          </label>
        </div>

        <div className="frontdesk-command-grid">
          <div className="frontdesk-highlight">
            <span>Open bills</span>
            <strong>{items.length}</strong>
            <p>Pending or partially paid grouped bills waiting at reception.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Visible results</span>
            <strong>{filteredItems.length}</strong>
            <p>Open bills matching your current live search.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Receipt history</span>
            <strong>{history.length}</strong>
            <p>Processed payments ready for reprint and branch desk follow-up.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Outstanding balance</span>
            <strong>{formatCurrency(items.reduce((sum, item) => sum + Number(item.balance ?? 0), 0))}</strong>
            <p>Total remaining open balance from both procedure and frontdesk fee bills.</p>
          </div>
        </div>
      </section>

      <section className="module-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Open bills</p>
            <h3>Ready for payment</h3>
          </div>
          <span className="table-counter">
            {filteredItems.length} results | Page {currentPage} of {totalPages}
          </span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Bill</th>
                <th>Patient</th>
                <th>Charge</th>
                <th>Bill type</th>
                <th>Total</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length ? paginatedItems.map((item) => (
                <tr key={`open-bill-${item.billingId}`}>
                  <td>{item.bill}</td>
                  <td>
                    <strong>{item.patientName}</strong>
                    <span className="table-subcopy">{item.dentistName}</span>
                  </td>
                  <td>{item.chargeSummary}</td>
                  <td>{item.billTypeLabel}</td>
                  <td>{item.amountLabel}</td>
                  <td>{item.balanceLabel}</td>
                  <td>{item.status}</td>
                  <td>
                    <div className="reception-action-row">
                      <button className="clinical-workspace-button secondary-action--compact" onClick={() => setSelectedBill(item)} type="button">
                        Process payment
                      </button>
                      <button
                        className="ghost-button secondary-action--compact workspace-inline-action destructive-button"
                        disabled={deletingBillingId === item.billingId}
                        onClick={() => handleDeleteBill(item)}
                        type="button"
                      >
                        <span>{deletingBillingId === item.billingId ? 'Deleting...' : 'Delete bill'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="8">No open bills match the current search.</td>
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

      <FrontdeskBillingModal
        isOpen={frontdeskModalOpen}
        onClose={(bill) => {
          setFrontdeskModalOpen(false);
          if (bill) {
            setSelectedBill(bill);
          }
        }}
        onSubmit={onCreateFrontdeskBill}
        patients={patients?.items ?? []}
      />

      <PaymentProcessingModal
        bill={selectedBill}
        isOpen={Boolean(selectedBill)}
        onClose={() => setSelectedBill(null)}
        onPaymentSaved={(receipt) => {
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

      <ReceiptHistoryModal
        history={history}
        isOpen={receiptHistoryModalOpen}
        onClose={() => setReceiptHistoryModalOpen(false)}
        onReprint={handleReprint}
        receiptLoading={receiptLoading}
      />
    </>
  );
}
